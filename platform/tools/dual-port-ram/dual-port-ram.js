(() => {
  /**
   * Dual-port RAM — 8×8-bit, sync ports A & B
   *   Collision policies when addrA==addrB:
   *     write_first — write(s) commit; reads see new data (A wins if both write: last-writer A)
   *     read_first  — reads see old data; then writes commit
   *     dont_care   — colliding read/write → dout X (255 sentinel shown as "X")
   */

  const DEPTH = 8;
  const X = -1; // collision don't-care readout

  function parseNibble(s) {
    const t = String(s).trim().replace(/^0x/i, "");
    if (/^[01]{1,3}$/.test(t)) return parseInt(t, 2) & 7;
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 7;
  }

  function parseByte(s) {
    const t = String(s).trim().replace(/^0x/i, "");
    if (/^[01]{1,8}$/.test(t)) return parseInt(t.padStart(8, "0"), 2) & 0xff;
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function toHex(n) {
    if (n === X) return "X";
    return "0x" + (n & 0xff).toString(16).padStart(2, "0");
  }

  function fmtCell(n) {
    if (n === X) return "X";
    return (n & 0xff).toString(16).padStart(2, "0");
  }

  function makeMem() {
    return Array.from({ length: DEPTH }, (_, i) => (i * 0x11) & 0xff);
  }

  function makeStarter() {
    return {
      mem: makeMem(),
      policy: "write_first", // write_first | read_first | dont_care
      a: { addr: 0, we: 0, din: 0xaa, dout: 0 },
      b: { addr: 1, we: 0, din: 0xbb, dout: 0 },
      cycle: 0,
      collision: false,
      collisionKind: "", // none | ww | wr | rw | rr
      lastAction: "",
      explained: false,
      stepped: false,
      setPolicy: false,
      sawCollision: false,
      log: [],
      trace: [],
    };
  }

  function classify(state) {
    if (state.a.addr !== state.b.addr) return { collision: false, kind: "none" };
    const wa = state.a.we;
    const wb = state.b.we;
    if (wa && wb) return { collision: true, kind: "ww" };
    if (wa && !wb) return { collision: true, kind: "wr" };
    if (!wa && wb) return { collision: true, kind: "rw" };
    return { collision: false, kind: "rr" };
  }

  function sourceCode(policy) {
    return `// True dual-port (concept)
always_ff @(posedge clk) begin
  if (we_a) mem[addr_a] <= din_a;
  if (we_b) mem[addr_b] <= din_b;
end
// same-addr collision policy: ${policy}
// write_first | read_first | dont_care (X)`;
  }

  const CLEARED_KEY = "ddv-dual-port-ram-cleared-v1";
  const STORE_KEY = "ddv-dual-port-ram-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("dpr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 8×8 RAM, ports on different addresses —
        then force a same-address collision and compare policies.</p>
      <button type="button" class="btn btn-secondary" id="dpr-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Core ideas</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Two ports</h3>
            <p>Independent addr / we / din — one shared array.</p>
          </div>
          <div class="idea-card">
            <h3>Collision</h3>
            <p>Same address + a write → policy decides dout / final data.</p>
          </div>
          <div class="idea-card">
            <h3>Policies</h3>
            <p>write-first, read-first, or don’t-care (X).</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Memory + ports</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Collision policy
              <select id="policy-sel">
                <option value="write_first" selected>write_first</option>
                <option value="read_first">read_first</option>
                <option value="dont_care">dont_care (X)</option>
              </select>
            </label>
          </div>
          <p class="legend">Blue outline = port A addr · violet = B · amber = both.</p>
          <div class="mem-grid" id="mem-grid"></div>
          <div class="ports">
            <div class="port" id="port-a">
              <h3>Port A</h3>
              <label>addr <input id="a-addr" type="text" value="0" maxlength="4"></label>
              <label>we <select id="a-we"><option value="0">0</option><option value="1">1</option></select></label>
              <label>din <input id="a-din" type="text" value="AA" maxlength="8"></label>
              <p class="dout">dout = <span id="a-dout">—</span></p>
            </div>
            <div class="port" id="port-b">
              <h3>Port B</h3>
              <label>addr <input id="b-addr" type="text" value="1" maxlength="4"></label>
              <label>we <select id="b-we"><option value="0">0</option><option value="1">1</option></select></label>
              <label>din <input id="b-din" type="text" value="BB" maxlength="8"></label>
              <p class="dout">dout = <span id="b-dout">—</span></p>
            </div>
          </div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-step">Step clk ↑ (both ports)</button>
            <button type="button" id="btn-clear">Clear mem to 00</button>
            <button type="button" id="btn-indep">Preset independent R</button>
            <button type="button" id="btn-ww">Preset W/W collision</button>
            <button type="button" id="btn-wr">Preset W/R collision</button>
            <button type="button" id="btn-wf">Policy write_first</button>
            <button type="button" id="btn-rf">Policy read_first</button>
            <button type="button" id="btn-dc">Policy dont_care</button>
            <button type="button" id="btn-demo">Demo: collide + policies</button>
            <button type="button" id="btn-explain">Explain dual-port</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Cycle / collide</h3>
              <p class="val" id="val-c">—</p>
              <p class="note" id="note-c"></p>
            </div>
            <div class="status-card">
              <h3>Policy</h3>
              <p class="val" id="val-p">—</p>
              <p class="note" id="note-p"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Case</th><th>Note</th></tr></thead>
          <tbody>
            <tr><td>Different addr</td><td>Fully independent</td></tr>
            <tr><td>W/W same addr</td><td>Final data = priority / undefined — pick a policy</td></tr>
            <tr><td>W/R same addr</td><td>Read-old vs read-new vs X</td></tr>
            <tr><td>R/R same addr</td><td>OK — both see same data</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Vendor BRAMs document collision behavior — never assume.</li>
          <li>This lab: W/W same addr → port A data wins when stored.</li>
        </ul>
      </div>
    </div>
  `;

  const policySel = /** @type {HTMLSelectElement} */ (document.getElementById("policy-sel"));
  const memGrid = document.getElementById("mem-grid");
  const portA = document.getElementById("port-a");
  const portB = document.getElementById("port-b");
  const aAddr = /** @type {HTMLInputElement} */ (document.getElementById("a-addr"));
  const aWe = /** @type {HTMLSelectElement} */ (document.getElementById("a-we"));
  const aDin = /** @type {HTMLInputElement} */ (document.getElementById("a-din"));
  const aDout = document.getElementById("a-dout");
  const bAddr = /** @type {HTMLInputElement} */ (document.getElementById("b-addr"));
  const bWe = /** @type {HTMLSelectElement} */ (document.getElementById("b-we"));
  const bDin = /** @type {HTMLInputElement} */ (document.getElementById("b-din"));
  const bDout = document.getElementById("b-dout");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const valC = document.getElementById("val-c");
  const noteC = document.getElementById("note-c");
  const valP = document.getElementById("val-p");
  const noteP = document.getElementById("note-p");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function pushLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function syncFromInputs() {
    state.a.addr = parseNibble(aAddr.value);
    state.a.we = Number(aWe.value);
    state.a.din = parseByte(aDin.value);
    state.b.addr = parseNibble(bAddr.value);
    state.b.we = Number(bWe.value);
    state.b.din = parseByte(bDin.value);
    state.policy = policySel.value;
  }

  function syncToInputs() {
    aAddr.value = String(state.a.addr);
    aWe.value = String(state.a.we);
    aDin.value = fmtCell(state.a.din).toUpperCase();
    bAddr.value = String(state.b.addr);
    bWe.value = String(state.b.we);
    bDin.value = fmtCell(state.b.din).toUpperCase();
    policySel.value = state.policy;
  }

  /** Clean step implementation */
  function doStep() {
    syncFromInputs();
    const addrA = state.a.addr;
    const addrB = state.b.addr;
    const old = state.mem.slice();
    const { collision, kind } = classify(state);
    state.collision = collision && kind !== "rr";
    state.collisionKind = kind;
    if (state.collision) state.sawCollision = true;

    let doutA;
    let doutB;

    if (!collision || kind === "rr") {
      if (state.policy === "read_first") {
        doutA = old[addrA];
        doutB = old[addrB];
        if (state.a.we) state.mem[addrA] = state.a.din & 0xff;
        if (state.b.we) state.mem[addrB] = state.b.din & 0xff;
      } else {
        if (state.a.we) state.mem[addrA] = state.a.din & 0xff;
        if (state.b.we) state.mem[addrB] = state.b.din & 0xff;
        doutA = state.mem[addrA];
        doutB = state.mem[addrB];
      }
    } else if (kind === "ww") {
      // A wins store
      if (state.policy === "read_first") {
        doutA = old[addrA];
        doutB = old[addrB];
        state.mem[addrA] = state.a.din & 0xff;
      } else if (state.policy === "dont_care") {
        state.mem[addrA] = state.a.din & 0xff;
        doutA = X;
        doutB = X;
      } else {
        state.mem[addrA] = state.a.din & 0xff;
        doutA = state.mem[addrA];
        doutB = state.mem[addrA];
      }
    } else if (kind === "wr") {
      // A write, B read
      if (state.policy === "read_first") {
        doutA = old[addrA];
        doutB = old[addrB];
        state.mem[addrA] = state.a.din & 0xff;
      } else if (state.policy === "dont_care") {
        state.mem[addrA] = state.a.din & 0xff;
        doutA = state.mem[addrA];
        doutB = X;
      } else {
        state.mem[addrA] = state.a.din & 0xff;
        doutA = state.mem[addrA];
        doutB = state.mem[addrA];
      }
    } else {
      // rw: B write, A read
      if (state.policy === "read_first") {
        doutA = old[addrA];
        doutB = old[addrB];
        state.mem[addrB] = state.b.din & 0xff;
      } else if (state.policy === "dont_care") {
        state.mem[addrB] = state.b.din & 0xff;
        doutA = X;
        doutB = state.mem[addrB];
      } else {
        state.mem[addrB] = state.b.din & 0xff;
        doutA = state.mem[addrB];
        doutB = state.mem[addrB];
      }
    }

    state.a.dout = doutA;
    state.b.dout = doutB;
    state.cycle += 1;
    state.stepped = true;
    state.lastAction = "step";
    pushTrace(
      `t${state.cycle}: A[${addrA}]${state.a.we ? "W" : "R"}=${toHex(doutA)} B[${addrB}]${state.b.we ? "W" : "R"}=${toHex(doutB)} kind=${kind}`
    );
    pushLog(`# step kind=${kind} policy=${state.policy}`);
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    // seed dout from mem
    state.a.dout = state.mem[state.a.addr];
    state.b.dout = state.mem[state.b.addr];
    state.lastAction = "starter";
    pushLog("# starter independent ports");
    renderAll();
  }

  function presetIndep() {
    state.a = { addr: 0, we: 0, din: 0xaa, dout: state.mem[0] };
    state.b = { addr: 3, we: 0, din: 0xbb, dout: state.mem[3] };
    state.collision = false;
    state.lastAction = "indep";
    pushLog("# preset independent read");
    renderAll();
  }

  function presetWW() {
    state.a = { addr: 2, we: 1, din: 0xa1, dout: state.a.dout };
    state.b = { addr: 2, we: 1, din: 0xb2, dout: state.b.dout };
    state.lastAction = "ww";
    pushLog("# preset W/W @2");
    renderAll();
  }

  function presetWR() {
    state.a = { addr: 4, we: 1, din: 0x44, dout: state.a.dout };
    state.b = { addr: 4, we: 0, din: 0x00, dout: state.b.dout };
    state.lastAction = "wr";
    pushLog("# preset W/R @4");
    renderAll();
  }

  function setPolicy(p) {
    state.policy = p;
    state.setPolicy = true;
    state.lastAction = `policy-${p}`;
    pushLog(`# policy → ${p}`);
    renderAll();
  }

  function runDemo() {
    state.mem = makeMem();
    state.policy = "write_first";
    state.setPolicy = true;
    state.a = { addr: 5, we: 1, din: 0x55, dout: 0 };
    state.b = { addr: 5, we: 0, din: 0, dout: 0 };
    doStep();
    const wf = state.b.dout;
    state.mem[5] = 0x11;
    state.policy = "read_first";
    state.a = { addr: 5, we: 1, din: 0x55, dout: 0 };
    state.b = { addr: 5, we: 0, din: 0, dout: 0 };
    // manual step without full doStep side effects on lastAction
    syncToInputs();
    const old = state.mem[5];
    state.b.dout = old;
    state.a.dout = old;
    state.mem[5] = 0x55;
    state.cycle += 1;
    const rf = state.b.dout;
    state.policy = "dont_care";
    state.mem[5] = 0x11;
    state.a = { addr: 5, we: 1, din: 0x55, dout: 0 };
    state.b = { addr: 5, we: 0, din: 0, dout: X };
    state.a.dout = 0x55;
    state.mem[5] = 0x55;
    state.cycle += 1;
    state.sawCollision = true;
    state.collision = true;
    state.collisionKind = "wr";
    state.stepped = true;
    state.lastAction = "demo";
    pushTrace(`demo W/R: write_first B=${toHex(wf)} read_first B=${toHex(rf)} dont_care B=X`);
    pushLog("# demo collide policies");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# two ports · collide if same addr+write · check BRAM docs");
    pushTrace("explain: true dual-port vs simple dual-port");
    renderAll();
  }

  function renderAll() {
    syncToInputs();
    codeBox.textContent = sourceCode(state.policy);
    const { collision, kind } = classify(state);
    const showCol = collision && kind !== "rr";

    memGrid.innerHTML = state.mem
      .map((v, i) => {
        const hitA = i === state.a.addr;
        const hitB = i === state.b.addr;
        const cls =
          hitA && hitB ? "is-both" : hitA ? "is-a" : hitB ? "is-b" : "";
        return `<div class="mem-cell ${cls}"><h3>${i}</h3><p class="v">${fmtCell(v)}</p></div>`;
      })
      .join("");

    portA.classList.toggle("is-collide", showCol);
    portB.classList.toggle("is-collide", showCol);
    aDout.textContent = toHex(state.a.dout);
    bDout.textContent = toHex(state.b.dout);

    if (showCol) {
      warnBox.className = "warn-box is-warn";
      warnBox.textContent = `Collision ${kind} @ addr ${state.a.addr} — policy ${state.policy}.`;
    } else {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent =
        kind === "rr" && state.a.addr === state.b.addr
          ? "Same address, both reading — OK."
          : "Ports independent (or idle).";
    }

    valC.textContent = `${state.cycle} / ${showCol ? kind : "—"}`;
    noteC.textContent = state.sawCollision ? "saw collision" : "no collision yet";
    valP.textContent = state.policy;
    noteP.textContent = "BRAM behavior varies";

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no steps";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ policy: state.policy, cycle: state.cycle }));
    } catch {
      /* ignore */
    }
  }

  document.getElementById("dpr-starter").addEventListener("click", loadStarter);

  policySel.addEventListener("change", () => {
    state.policy = policySel.value;
    state.setPolicy = true;
    state.lastAction = "policy";
    pushLog(`# policy → ${state.policy}`);
    renderAll();
  });

  ["a-addr", "a-we", "a-din", "b-addr", "b-we", "b-din"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      syncFromInputs();
      state.lastAction = "edit";
      renderAll();
    });
  });

  document.getElementById("btn-step").addEventListener("click", doStep);
  document.getElementById("btn-clear").addEventListener("click", () => {
    state.mem = Array(DEPTH).fill(0);
    state.lastAction = "clear";
    pushLog("# mem cleared");
    renderAll();
  });
  document.getElementById("btn-indep").addEventListener("click", presetIndep);
  document.getElementById("btn-ww").addEventListener("click", presetWW);
  document.getElementById("btn-wr").addEventListener("click", presetWR);
  document.getElementById("btn-wf").addEventListener("click", () => setPolicy("write_first"));
  document.getElementById("btn-rf").addEventListener("click", () => setPolicy("read_first"));
  document.getElementById("btn-dc").addEventListener("click", () => setPolicy("dont_care"));
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-dual",
      title: "Quiz: dual",
      prompt: "RAM with two independent access ports is? Answer: <code>dual-port</code>",
      hint: "two ports",
      type: "text",
      answer: "dual-port",
      alt: ["dual port", "dpram", "true dual-port"],
    },
    {
      id: "quiz-collide",
      title: "Quiz: collide",
      prompt: "Same address + write conflict is a? Answer: <code>collision</code>",
      hint: "port collision",
      type: "text",
      answer: "collision",
      alt: ["collide", "conflict"],
    },
    {
      id: "quiz-wf",
      title: "Quiz: write-first",
      prompt: "Policy where read sees new data? Answer: <code>write_first</code>",
      hint: "read-new",
      type: "text",
      answer: "write_first",
      alt: ["write-first", "write first", "read-new"],
    },
    {
      id: "quiz-rf",
      title: "Quiz: read-first",
      prompt: "Policy where read sees old data? Answer: <code>read_first</code>",
      hint: "read-old",
      type: "text",
      answer: "read_first",
      alt: ["read-first", "read first", "read-old"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter example.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "starter" && state.a.addr !== state.b.addr,
    },
    {
      id: "step",
      title: "Step",
      prompt: "Step clk ↑ at least once.",
      hint: "Step clk ↑",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cycle >= 1,
    },
    {
      id: "indep",
      title: "Independent",
      prompt: "Preset independent R.",
      hint: "Preset independent R",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "indep" &&
        state.a.addr !== state.b.addr &&
        state.a.we === 0,
    },
    {
      id: "preset-ww",
      title: "Preset W/W",
      prompt: "Preset W/W collision.",
      hint: "Preset W/W collision",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "ww" &&
        state.a.addr === state.b.addr &&
        state.a.we === 1 &&
        state.b.we === 1,
    },
    {
      id: "preset-wr",
      title: "Preset W/R",
      prompt: "Preset W/R collision.",
      hint: "Preset W/R collision",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "wr" &&
        state.a.we === 1 &&
        state.b.we === 0 &&
        state.a.addr === state.b.addr,
    },
    {
      id: "step-ww",
      title: "Step W/W",
      prompt: "W/W @ same addr, write_first, step — mem gets A's din.",
      hint: "Preset W/W → Policy write_first → Step",
      type: "state",
      setup: () => {
        loadStarter();
        presetWW();
        setPolicy("write_first");
      },
      check: () => {
        return (
          state.collisionKind === "ww" &&
          state.stepped &&
          state.mem[state.a.addr] === (state.a.din & 0xff)
        );
      },
    },
    {
      id: "step-wr-wf",
      title: "W/R write_first",
      prompt: "W/R collision, write_first: after step B.dout equals new data.",
      hint: "Preset W/R → write_first → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mem[4] = 0x00;
        presetWR();
        setPolicy("write_first");
      },
      check: () =>
        state.policy === "write_first" &&
        state.collisionKind === "wr" &&
        state.b.dout === (state.a.din & 0xff),
    },
    {
      id: "step-wr-rf",
      title: "W/R read_first",
      prompt: "W/R, read_first: B.dout equals old mem value.",
      hint: "Preset W/R → read_first → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mem[4] = 0x99;
        presetWR();
        state.a.din = 0x44;
        setPolicy("read_first");
      },
      check: () =>
        state.policy === "read_first" &&
        state.collisionKind === "wr" &&
        state.b.dout === 0x99,
    },
    {
      id: "dont-care",
      title: "dont_care",
      prompt: "W/R + dont_care: B.dout is X after step.",
      hint: "Preset W/R → dont_care → Step",
      type: "state",
      setup: () => {
        loadStarter();
        presetWR();
        setPolicy("dont_care");
      },
      check: () =>
        state.policy === "dont_care" &&
        state.collisionKind === "wr" &&
        state.b.dout === X,
    },
    {
      id: "policy-wf",
      title: "Policy WF",
      prompt: "Set policy write_first via button.",
      hint: "Policy write_first",
      type: "state",
      setup: () => {
        loadStarter();
        state.policy = "read_first";
        renderAll();
      },
      check: () =>
        state.policy === "write_first" &&
        state.lastAction === "policy-write_first",
    },
    {
      id: "policy-sel",
      title: "Policy select",
      prompt: "Change Collision policy dropdown.",
      hint: "Dropdown",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "policy" && state.setPolicy,
    },
    {
      id: "clear",
      title: "Clear",
      prompt: "Clear mem to 00.",
      hint: "Clear mem",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "clear" && state.mem.every((v) => v === 0),
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: collide + policies.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "demo" && state.sawCollision,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain dual-port.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "code-we",
      title: "Code we",
      prompt: "Code shows <code>if (we_a)</code>.",
      hint: "Always in code box",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode(state.policy).includes("if (we_a)"),
    },
    {
      id: "write-cell",
      title: "Write cell",
      prompt: "Write mem[1]=0x7E via port A (B on another addr), then Step.",
      hint: "A: addr=1 we=1 din=7E; B addr≠1; Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mem = Array(DEPTH).fill(0);
        state.a = { addr: 1, we: 1, din: 0x7e, dout: 0 };
        state.b = { addr: 2, we: 0, din: 0, dout: 0 };
        renderAll();
      },
      check: () => state.mem[1] === 0x7e && state.cycle >= 1,
    },
    {
      id: "rr-ok",
      title: "R/R OK",
      prompt: "Both ports read same addr (we=0), step — no collision warn kind rr.",
      hint: "Same addr, we=0 both, Step",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.a.addr === state.b.addr &&
        state.a.we === 0 &&
        state.b.we === 0 &&
        state.collisionKind === "rr" &&
        state.stepped,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.explained &&
        state.lastAction === "explain" &&
        state.sawCollision,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function setStatus(kind, text) {
    const el = document.getElementById("chal-status");
    el.className = `challenge-status ${kind}`;
    el.textContent = text;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (isCleared(ch.id) ? " · cleared" : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}.</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? `Hint: ${ch.hint}` : "";
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      ansRow.innerHTML = `<label class="sr-only" for="chal-answer">Answer</label>
        <input type="text" id="chal-answer" class="chal-input" autocomplete="off" placeholder="Type answer…">`;
      const inp = /** @type {HTMLInputElement} */ (document.getElementById("chal-answer"));
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
    } else {
      ansRow.innerHTML = "";
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = CHALLENGES.map((c, i) => {
      const cls = [
        "kbd",
        i === challengeIdx ? "is-active" : "",
        isCleared(c.id) ? "is-cleared" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-chal="${i}">${c.id}</button>`;
    }).join(" ");
    cat.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        challengeIdx = Number(btn.getAttribute("data-chal"));
        showHint = false;
        answerDraft = "";
        setStatus("idle", "Idle");
        const next = CHALLENGES[challengeIdx];
        if (next.setup) next.setup();
        renderChallenge();
      });
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });

  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setStatus("idle", "Idle");
    const next = CHALLENGES[challengeIdx];
    if (next.setup) next.setup();
    renderChallenge();
  });

  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const got = normalizeAns(answerDraft);
      const want = normalizeAns(ch.answer);
      const alts = (ch.alt || []).map(normalizeAns);
      ok = got === want || alts.includes(got);
    } else {
      ok = !!ch.check();
    }
    if (ok) {
      markCleared(ch.id);
      setStatus("ok", "Cleared");
    } else {
      setStatus("bad", "Not yet");
    }
    renderChallenge();
  });

  loadStarter();
  renderChallenge();
})();
