(() => {
  /**
   * Byte-enable memory — 4 words × 32-bit, little-endian byte lanes
   *   mem[addr] is 4 bytes [b0,b1,b2,b3] (b0 = LSB / be[0])
   *   on we: for each i, if be[i] then byte_i <= din byte_i
   */

  const DEPTH = 4;

  function makeMem() {
    // Distinct patterns per word
    return [
      [0xaa, 0xbb, 0xcc, 0xdd],
      [0x11, 0x22, 0x33, 0x44],
      [0x00, 0x00, 0x00, 0x00],
      [0xff, 0xee, 0xdd, 0xcc],
    ];
  }

  function parseAddr(s) {
    const n = parseInt(String(s).trim(), 10);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(DEPTH - 1, n));
  }

  function parseWord(s) {
    const t = String(s).trim().replace(/^0x/i, "");
    if (/^[01]{1,32}$/.test(t)) {
      const n = parseInt(t.padStart(32, "0"), 2) >>> 0;
      return wordToBytes(n);
    }
    const n = parseInt(t, 16);
    if (Number.isNaN(n)) return [0, 0, 0, 0];
    return wordToBytes(n >>> 0);
  }

  function wordToBytes(n) {
    return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
  }

  function bytesToWord(b) {
    return ((b[3] << 24) | (b[2] << 16) | (b[1] << 8) | b[0]) >>> 0;
  }

  function toHexWord(b) {
    return (
      "0x" +
      bytesToWord(b)
        .toString(16)
        .padStart(8, "0")
    );
  }

  function toHexByte(n) {
    return n.toString(16).padStart(2, "0");
  }

  function beMask(be) {
    // display as be[3:0] (MSB lane first)
    return [be[3], be[2], be[1], be[0]].map((x) => (x ? "1" : "0")).join("");
  }

  function applyWrite(mem, addr, din, be, we) {
    const next = mem.map((w) => w.slice());
    if (!we) return next;
    for (let i = 0; i < 4; i++) {
      if (be[i]) next[addr][i] = din[i] & 0xff;
    }
    return next;
  }

  function sourceCode() {
    return `// Byte enables on a 32-bit word RAM
always_ff @(posedge clk) begin
  if (we) begin
    if (be[0]) mem[addr][7:0]   <= din[7:0];
    if (be[1]) mem[addr][15:8]  <= din[15:8];
    if (be[2]) mem[addr][23:16] <= din[23:16];
    if (be[3]) mem[addr][31:24] <= din[31:24];
  end
end
// be=0000 → no bytes change even if we=1`;
  }

  function makeStarter() {
    return {
      mem: makeMem(),
      addr: 0,
      we: 1,
      be: [1, 0, 0, 0], // only LSB
      din: [0x55, 0x66, 0x77, 0x88],
      dout: [0xaa, 0xbb, 0xcc, 0xdd],
      cycle: 0,
      lastAction: "",
      explained: false,
      stepped: false,
      wrotePartial: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-byte-enable-mem-cleared-v1";
  const STORE_KEY = "ddv-byte-enable-mem-session-v1";

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

  const root = document.getElementById("be-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> word 0 is <code>DDCCBBAA</code> —
        write with <code>be=0001</code> to change only the LSB.</p>
      <button type="button" class="btn btn-secondary" id="be-starter">Load starter example</button>
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
            <h3>Word + lanes</h3>
            <p>32-bit word = 4 byte lanes; address selects the word.</p>
          </div>
          <div class="idea-card">
            <h3>be[3:0]</h3>
            <p>Each bit enables one lane on write.</p>
          </div>
          <div class="idea-card">
            <h3>Merge</h3>
            <p>Disabled lanes keep old data — RMW without a full read.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>4×32-bit memory</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>addr <input id="in-addr" type="text" value="0" maxlength="2"></label>
            <label>we
              <select id="in-we">
                <option value="1" selected>1</option>
                <option value="0">0</option>
              </select>
            </label>
            <label>din <input id="in-din" type="text" value="88776655" maxlength="10"></label>
          </div>
          <div class="be-toggles" id="be-toggles"></div>
          <p class="legend">Little-endian: be[0] = byte0 (LSB). Green = enabled lane on selected word.</p>
          <div class="mem-rows" id="mem-rows"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-step">Step clk ↑ (write if we)</button>
            <button type="button" id="btn-read">Sample dout = mem[addr]</button>
            <button type="button" id="btn-be1">be = 0001 (LSB only)</button>
            <button type="button" id="btn-beF">be = 1111 (full word)</button>
            <button type="button" id="btn-beA">be = 1010 (odd lanes)</button>
            <button type="button" id="btn-half">Write halfword low (be=0011)</button>
            <button type="button" id="btn-demo">Demo: patch one byte</button>
            <button type="button" id="btn-explain">Explain byte enables</button>
            <button type="button" id="btn-reset">Reset mem patterns</button>
            <button type="button" id="btn-zero-be">be = 0000 (we ignored)</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>be / we</h3>
              <p class="val" id="val-be">—</p>
              <p class="note" id="note-be"></p>
            </div>
            <div class="status-card">
              <h3>dout / cycle</h3>
              <p class="val" id="val-dout">—</p>
              <p class="note" id="note-dout"></p>
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
          <thead><tr><th>be</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td>0001</td><td>Store byte (LSB)</td></tr>
            <tr><td>0011</td><td>Store halfword (low)</td></tr>
            <tr><td>1111</td><td>Store full word</td></tr>
            <tr><td>0000</td><td>No lane updates (even if we=1)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>CPU stores (SB/SH/SW) map to different be patterns.</li>
          <li>Starter: patch byte0 of word0 from AA→55; BBCCDD stay.</li>
        </ul>
      </div>
    </div>
  `;

  const inAddr = /** @type {HTMLInputElement} */ (document.getElementById("in-addr"));
  const inWe = /** @type {HTMLSelectElement} */ (document.getElementById("in-we"));
  const inDin = /** @type {HTMLInputElement} */ (document.getElementById("in-din"));
  const beToggles = document.getElementById("be-toggles");
  const memRows = document.getElementById("mem-rows");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const valBe = document.getElementById("val-be");
  const noteBe = document.getElementById("note-be");
  const valDout = document.getElementById("val-dout");
  const noteDout = document.getElementById("note-dout");
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
    state.addr = parseAddr(inAddr.value);
    state.we = Number(inWe.value);
    state.din = parseWord(inDin.value);
  }

  function syncToInputs() {
    inAddr.value = String(state.addr);
    inWe.value = String(state.we);
    inDin.value = bytesToWord(state.din).toString(16).padStart(8, "0");
  }

  function doStep() {
    syncFromInputs();
    const before = state.mem[state.addr].slice();
    state.mem = applyWrite(state.mem, state.addr, state.din, state.be, state.we);
    const after = state.mem[state.addr];
    state.dout = after.slice();
    state.cycle += 1;
    state.stepped = true;
    if (state.we && state.be.some(Boolean) && state.be.some((b) => !b)) {
      state.wrotePartial = true;
    }
    state.lastAction = "step";
    pushTrace(
      `t${state.cycle}: addr=${state.addr} we=${state.we} be=${beMask(state.be)} ${toHexWord(before)}→${toHexWord(after)}`
    );
    pushLog(`# step be=${beMask(state.be)}`);
    renderAll();
  }

  function sampleRead() {
    syncFromInputs();
    state.dout = state.mem[state.addr].slice();
    state.lastAction = "read";
    pushLog(`# dout ← ${toHexWord(state.dout)}`);
    renderAll();
  }

  function setBe(bits) {
    state.be = bits.slice();
    state.lastAction = "be";
    pushLog(`# be → ${beMask(state.be)}`);
    renderAll();
  }

  function runDemo() {
    state.mem = makeMem();
    state.addr = 0;
    state.we = 1;
    state.be = [1, 0, 0, 0];
    state.din = [0x55, 0x66, 0x77, 0x88];
    syncToInputs();
    doStep();
    state.wrotePartial = true;
    state.lastAction = "demo";
    pushTrace("demo: only byte0 patched AA→55");
    pushLog("# demo patch one byte");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# be masks lanes · we gates write · SB/SH/SW → be patterns");
    pushTrace("explain: partial store without full-word RMW bus cycle");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "starter";
    pushLog("# starter word0, be=0001");
    renderAll();
  }

  function renderBeToggles() {
    beToggles.innerHTML =
      `<span>be[3:0]</span>` +
      [3, 2, 1, 0]
        .map((i) => {
          const on = state.be[i] ? "is-on" : "";
          return `<button type="button" class="${on}" data-be="${i}">be${i}=${state.be[i]}</button>`;
        })
        .join("") +
      `<span style="color:var(--muted);margin-left:0.35rem">${beMask(state.be)}b</span>`;
    beToggles.querySelectorAll("[data-be]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-be"));
        state.be[i] = state.be[i] ? 0 : 1;
        state.lastAction = "toggle-be";
        pushLog(`# toggle be${i} → ${state.be[i]}`);
        renderAll();
      });
    });
  }

  function renderMem() {
    memRows.innerHTML = state.mem
      .map((w, addr) => {
        const sel = addr === state.addr ? "is-sel" : "";
        const cells = w
          .map((b, i) => {
            const en = sel && state.we && state.be[i] ? "is-en" : "";
            const hit = sel ? "is-hit" : "";
            return `<div class="byte-cell ${en} ${hit}"><h3>b${i}</h3><p class="v">${toHexByte(b)}</p></div>`;
          })
          .join("");
        return `<div class="word-row ${sel}"><span class="idx">[${addr}]</span>${cells}<span class="full">${toHexWord(w)}</span></div>`;
      })
      .join("");
  }

  function renderAll() {
    syncToInputs();
    codeBox.textContent = sourceCode();
    renderBeToggles();
    renderMem();

    const active = state.be.filter(Boolean).length;
    if (state.we && active === 0) {
      warnBox.className = "warn-box is-warn";
      warnBox.textContent = "we=1 but be=0000 — no bytes will change on Step.";
    } else if (state.we && active < 4) {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = `Partial write: ${active} lane(s) update; others keep old data.`;
    } else if (state.we) {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = "Full-word write (be=1111).";
    } else {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = "we=0 — Step will not write (dout still samples on Read).";
    }

    valBe.textContent = `${beMask(state.be)} / we=${state.we}`;
    noteBe.textContent = `${active} byte lane(s) enabled`;
    valDout.textContent = toHexWord(state.dout);
    noteDout.textContent = `cycle ${state.cycle}`;

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no steps";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ addr: state.addr, be: state.be, cycle: state.cycle })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("be-starter").addEventListener("click", loadStarter);

  inAddr.addEventListener("change", () => {
    syncFromInputs();
    state.lastAction = "edit";
    renderAll();
  });
  inWe.addEventListener("change", () => {
    syncFromInputs();
    state.lastAction = "edit";
    renderAll();
  });
  inDin.addEventListener("change", () => {
    syncFromInputs();
    state.lastAction = "edit";
    renderAll();
  });

  document.getElementById("btn-step").addEventListener("click", doStep);
  document.getElementById("btn-read").addEventListener("click", sampleRead);
  document.getElementById("btn-be1").addEventListener("click", () => setBe([1, 0, 0, 0]));
  document.getElementById("btn-beF").addEventListener("click", () => setBe([1, 1, 1, 1]));
  document.getElementById("btn-beA").addEventListener("click", () => setBe([0, 1, 0, 1]));
  document.getElementById("btn-zero-be").addEventListener("click", () => setBe([0, 0, 0, 0]));

  document.getElementById("btn-half").addEventListener("click", () => {
    state.be = [1, 1, 0, 0];
    state.we = 1;
    state.din = [0x34, 0x12, 0x00, 0x00];
    state.lastAction = "half";
    pushLog("# halfword low be=0011 din=00001234");
    renderAll();
  });

  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-reset").addEventListener("click", () => {
    state.mem = makeMem();
    state.dout = state.mem[state.addr].slice();
    state.lastAction = "reset";
    pushLog("# mem patterns reset");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-be",
      title: "Quiz: be",
      prompt: "Partial-word write mask is called? Answer: <code>byte enable</code>",
      hint: "be[3:0]",
      type: "text",
      answer: "byte enable",
      alt: ["byte-enable", "byte enables", "be"],
    },
    {
      id: "quiz-lanes",
      title: "Quiz: lanes",
      prompt: "32-bit word has how many byte lanes? Answer: <code>4</code>",
      hint: "32/8",
      type: "text",
      answer: "4",
      alt: ["four"],
    },
    {
      id: "quiz-lsb",
      title: "Quiz: LSB",
      prompt: "In this lab be[0] enables the? Answer: <code>LSB</code>",
      hint: "little-endian byte0",
      type: "text",
      answer: "lsb",
      alt: ["LSB", "byte0", "low byte"],
    },
    {
      id: "quiz-zero",
      title: "Quiz: be=0",
      prompt: "be=0000 with we=1 changes? Answer: <code>nothing</code>",
      hint: "no lanes",
      type: "text",
      answer: "nothing",
      alt: ["no change", "none", "0 bytes"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — addr 0, be=0001.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.addr === 0 &&
        state.be[0] === 1 &&
        state.be[1] === 0 &&
        state.be[2] === 0 &&
        state.be[3] === 0,
    },
    {
      id: "toggle-be",
      title: "Toggle be",
      prompt: "Toggle a be lane button.",
      hint: "Click be0…be3",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "toggle-be",
    },
    {
      id: "be-lsb",
      title: "be LSB",
      prompt: "Set be = 0001 (LSB only).",
      hint: "be = 0001 button",
      type: "state",
      setup: () => {
        loadStarter();
        state.be = [1, 1, 1, 1];
        renderAll();
      },
      check: () =>
        state.be[0] === 1 &&
        state.be[1] === 0 &&
        state.be[2] === 0 &&
        state.be[3] === 0 &&
        state.lastAction === "be",
    },
    {
      id: "be-full",
      title: "be full",
      prompt: "Set be = 1111.",
      hint: "be = 1111 button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.be.every((b) => b === 1) && state.lastAction === "be",
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
      id: "patch-lsb",
      title: "Patch LSB",
      prompt: "On word0, be=0001, step so byte0=0x55 and byte1 stays 0xBB.",
      hint: "Starter → Step (or Demo)",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mem[0][0] === 0x55 &&
        state.mem[0][1] === 0xbb &&
        state.mem[0][2] === 0xcc &&
        state.mem[0][3] === 0xdd,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: patch one byte.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" &&
        state.wrotePartial &&
        state.mem[0][0] === 0x55,
    },
    {
      id: "half",
      title: "Halfword",
      prompt: "Write halfword low (be=0011) preset.",
      hint: "Write halfword low",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "half" &&
        state.be[0] === 1 &&
        state.be[1] === 1 &&
        state.be[2] === 0,
    },
    {
      id: "half-step",
      title: "Half step",
      prompt: "After halfword preset, Step — low 16 bits become 0x1234.",
      hint: "Halfword button → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.addr = 1;
        state.mem[1] = [0x11, 0x22, 0x33, 0x44];
        state.be = [1, 1, 0, 0];
        state.din = [0x34, 0x12, 0x00, 0x00];
        state.we = 1;
        renderAll();
      },
      check: () =>
        state.mem[1][0] === 0x34 &&
        state.mem[1][1] === 0x12 &&
        state.mem[1][2] === 0x33 &&
        state.mem[1][3] === 0x44,
    },
    {
      id: "zero-be",
      title: "Zero be",
      prompt: "be=0000 then Step — word unchanged from reset pattern word0.",
      hint: "Reset mem → be=0000 → we=1 → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mem = makeMem();
        state.addr = 0;
        state.be = [0, 0, 0, 0];
        state.we = 1;
        state.din = [0x11, 0x22, 0x33, 0x44];
        renderAll();
      },
      check: () => {
        const w = state.mem[0];
        return (
          state.cycle >= 1 &&
          w[0] === 0xaa &&
          w[1] === 0xbb &&
          w[2] === 0xcc &&
          w[3] === 0xdd
        );
      },
    },
    {
      id: "read",
      title: "Read",
      prompt: "Sample dout = mem[addr].",
      hint: "Sample dout button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "read",
    },
    {
      id: "odd-lanes",
      title: "Odd lanes",
      prompt: "Set be = 1010.",
      hint: "be = 1010 button",
      type: "state",
      setup: () => loadStarter(),
      check: () => beMask(state.be) === "1010" && state.lastAction === "be",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain byte enables.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "code-be0",
      title: "Code be0",
      prompt: "Code has <code>if (be[0])</code>.",
      hint: "Always in code box",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode().includes("if (be[0])"),
    },
    {
      id: "we-off",
      title: "we off",
      prompt: "we=0, Step — mem[0] stays starter pattern after reset.",
      hint: "Reset → we=0 → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mem = makeMem();
        state.we = 0;
        state.be = [1, 1, 1, 1];
        state.din = [0, 0, 0, 0];
        state.addr = 0;
        renderAll();
      },
      check: () => {
        const w = state.mem[0];
        return (
          state.cycle >= 1 &&
          state.we === 0 &&
          w[0] === 0xaa &&
          w[3] === 0xdd
        );
      },
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset mem patterns.",
      hint: "Reset mem patterns",
      type: "state",
      setup: () => {
        loadStarter();
        state.mem[0] = [1, 2, 3, 4];
        renderAll();
      },
      check: () =>
        state.lastAction === "reset" && state.mem[0][0] === 0xaa,
    },
    {
      id: "partial-flag",
      title: "Partial flag",
      prompt: "Perform a partial write (not all be bits) via Step.",
      hint: "be not 1111, we=1, Step",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.wrotePartial === true,
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
        state.mem[0][0] === 0x55,
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
