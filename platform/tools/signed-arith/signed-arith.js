(() => {
  /**
   * Signed arithmetic / overflow — 8-bit two's complement
   *   Add:  r = (a + b) mod 256; C = carry out; V = signed overflow
   *   Sub:  r = (a - b) mod 256; C = ~borrow (or borrow depending on ISA);
   *         here C = 1 if unsigned a >= b (no borrow), classic ARM-style
   *   V add: same sign in, different sign out
   *   V sub: treat as a + (~b+1); overflow if signs of a and (~b) match and result differs
   *          equiv: (a>0 && b<0 && r<0) || (a<0 && b>0 && r>=0) for a-b
   */

  function parseByte(s) {
    const t = String(s).trim();
    if (/^[+-]?\d+$/.test(t)) {
      let n = parseInt(t, 10);
      if (n < -128 || n > 255) n = n & 0xff;
      if (n < 0) n = (n + 256) & 0xff;
      return n & 0xff;
    }
    if (/^[01]{1,8}$/.test(t)) return parseInt(t.padStart(8, "0"), 2) & 0xff;
    const n = parseInt(t.replace(/^0x/i, ""), 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function toBin(n) {
    return (n & 0xff).toString(2).padStart(8, "0");
  }

  function toHex(n) {
    return "0x" + (n & 0xff).toString(16).padStart(2, "0");
  }

  function signed(n) {
    const u = n & 0xff;
    return u > 127 ? u - 256 : u;
  }

  function msb(n) {
    return (n >> 7) & 1;
  }

  function compute(a, b, op) {
    const au = a & 0xff;
    const bu = b & 0xff;
    let raw;
    let c;
    let v;
    if (op === "add") {
      raw = au + bu;
      c = raw > 0xff ? 1 : 0;
      const r = raw & 0xff;
      // overflow: both pos → neg, or both neg → pos
      v =
        (msb(au) === msb(bu) && msb(r) !== msb(au)) ? 1 : 0;
      return {
        op,
        a: au,
        b: bu,
        r,
        c,
        v,
        n: msb(r),
        z: r === 0 ? 1 : 0,
        sa: signed(au),
        sb: signed(bu),
        sr: signed(r),
        trueSigned: signed(au) + signed(bu),
      };
    }
    // sub a - b
    raw = au - bu;
    c = au >= bu ? 1 : 0; // no borrow
    const r = raw & 0xff;
    // overflow for subtraction
    v =
      (msb(au) !== msb(bu) && msb(r) !== msb(au)) ? 1 : 0;
    return {
      op,
      a: au,
      b: bu,
      r,
      c,
      v,
      n: msb(r),
      z: r === 0 ? 1 : 0,
      sa: signed(au),
      sb: signed(bu),
      sr: signed(r),
      trueSigned: signed(au) - signed(bu),
    };
  }

  function sourceCode(op) {
    if (op === "add") {
      return `// 8-bit add — flags
assign {C, r} = a + b;           // C = unsigned carry
assign N = r[7];
assign Z = (r == 0);
// V: signed overflow
assign V = (a[7]==b[7]) && (r[7]!=a[7]);`;
    }
    return `// 8-bit sub a - b
assign {C, r} = a - b;           // C = ~borrow (a>=b)
assign N = r[7];
assign Z = (r == 0);
assign V = (a[7]!=b[7]) && (r[7]!=a[7]);`;
  }

  function makeStarter() {
    return {
      aStr: "100",
      bStr: "50",
      op: "add",
      result: null,
      lastAction: "",
      explained: false,
      computed: false,
      setOv: false,
      setOk: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-signed-arith-cleared-v1";
  const STORE_KEY = "ddv-signed-arith-session-v1";

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

  const root = document.getElementById("sa-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>100 + 50</code> in 8-bit two’s complement —
        compare a clean add with an overflowing one (e.g. 100+100).</p>
      <button type="button" class="btn btn-secondary" id="sa-starter">Load starter example</button>
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
            <h3>Two’s complement</h3>
            <p>MSB is sign; range −128…+127 for 8-bit.</p>
          </div>
          <div class="idea-card">
            <h3>Overflow V</h3>
            <p>Signed result doesn’t fit — not the same as carry C.</p>
          </div>
          <div class="idea-card">
            <h3>Flags</h3>
            <p>N negative · Z zero · C carry/borrow · V overflow.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>ALU sketch</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>A <input id="in-a" type="text" value="100" maxlength="8"></label>
            <label>op
              <select id="op-sel">
                <option value="add" selected>+</option>
                <option value="sub">−</option>
              </select>
            </label>
            <label>B <input id="in-b" type="text" value="50" maxlength="8"></label>
          </div>
          <p class="legend">Enter decimal (−128…255), hex (<code>0x64</code>), or 8-bit binary.</p>
          <div class="range-bar">Signed range: −128 … +127 · Unsigned bits: 0 … 255</div>
          <div class="op-display" id="op-display"></div>
          <div class="flags" id="flags"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-compute">Compute</button>
            <button type="button" id="btn-ok">Example: no overflow</button>
            <button type="button" id="btn-ov">Example: V=1 (100+100)</button>
            <button type="button" id="btn-neg">Example: −50 + −90</button>
            <button type="button" id="btn-carry">Example: C=1 V=0 (200+100)</button>
            <button type="button" id="btn-sub">Example: sub overflow</button>
            <button type="button" id="btn-demo">Demo: C vs V</button>
            <button type="button" id="btn-explain">Explain flags</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Wrapped result</h3>
              <p class="val" id="val-r">—</p>
              <p class="note" id="note-r"></p>
            </div>
            <div class="status-card">
              <h3>True signed</h3>
              <p class="val" id="val-true">—</p>
              <p class="note" id="note-true"></p>
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
          <thead><tr><th>Flag</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>N</td><td>Result MSB = 1 (negative if signed)</td></tr>
            <tr><td>Z</td><td>Result is zero</td></tr>
            <tr><td>C</td><td>Unsigned carry (add) / ~borrow (sub)</td></tr>
            <tr><td>V</td><td>Signed overflow — true sum/diff out of −128…127</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>100+100 = 200 → wraps to −56, <strong>V=1</strong>; unsigned carry may be 0.</li>
          <li>200+100 unsigned carry <strong>C=1</strong> but signed view differs — compare demos.</li>
        </ul>
      </div>
    </div>
  `;

  const inA = /** @type {HTMLInputElement} */ (document.getElementById("in-a"));
  const inB = /** @type {HTMLInputElement} */ (document.getElementById("in-b"));
  const opSel = /** @type {HTMLSelectElement} */ (document.getElementById("op-sel"));
  const opDisplay = document.getElementById("op-display");
  const flagsEl = document.getElementById("flags");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const valR = document.getElementById("val-r");
  const noteR = document.getElementById("note-r");
  const valTrue = document.getElementById("val-true");
  const noteTrue = document.getElementById("note-true");
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

  function refresh() {
    state.aStr = inA.value;
    state.bStr = inB.value;
    state.op = opSel.value;
    const a = parseByte(state.aStr);
    const b = parseByte(state.bStr);
    state.result = compute(a, b, state.op);
    state.computed = true;
    return state.result;
  }

  function doCompute() {
    const r = refresh();
    state.lastAction = "compute";
    pushTrace(
      `${r.sa} ${r.op === "add" ? "+" : "−"} ${r.sb} → r=${r.sr} (${toHex(r.r)}) NZCV=${r.n}${r.z}${r.c}${r.v}`
    );
    pushLog(`# compute V=${r.v} C=${r.c}`);
    renderAll();
  }

  function loadCase(a, b, op, action, flags) {
    inA.value = String(a);
    inB.value = String(b);
    opSel.value = op;
    state.aStr = String(a);
    state.bStr = String(b);
    state.op = op;
    if (flags?.setOk) state.setOk = true;
    if (flags?.setOv) state.setOv = true;
    refresh();
    state.lastAction = action;
    pushLog(`# ${action}: ${a} ${op === "add" ? "+" : "−"} ${b}`);
    renderAll();
  }

  function runDemo() {
    // First: C=1 V=0 then V=1 C=0
    loadCase(200, 100, "add", "demo", {});
    const r1 = state.result;
    pushTrace(`demo1: 200+100 → C=${r1.c} V=${r1.v} (unsigned carry)`);
    // switch view to overflow case but keep demo action
    inA.value = "100";
    inB.value = "100";
    state.aStr = "100";
    state.bStr = "100";
    refresh();
    state.setOv = true;
    state.lastAction = "demo";
    const r2 = state.result;
    pushTrace(`demo2: 100+100 → C=${r2.c} V=${r2.v} (signed overflow)`);
    pushLog("# demo C vs V");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# N Z C V · C=unsigned · V=signed fit · two’s complement wrap");
    pushTrace("explain: same hardware adder; interpret flags by type");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    inA.value = "100";
    inB.value = "50";
    opSel.value = "add";
    state.setOk = true;
    refresh();
    state.lastAction = "starter";
    pushLog("# starter 100+50");
    renderAll();
  }

  function renderAll() {
    if (!state.result) refresh();
    const r = state.result;
    inA.value = state.aStr;
    inB.value = state.bStr;
    opSel.value = state.op;
    codeBox.textContent = sourceCode(state.op);

    const sym = state.op === "add" ? "+" : "−";
    opDisplay.innerHTML = `
      <div>${r.sa} (${toBin(r.a)}) ${sym} ${r.sb} (${toBin(r.b)})</div>
      <div class="big">= ${r.sr} &nbsp; ${toHex(r.r)} &nbsp; ${toBin(r.r)}b</div>
    `;

    flagsEl.innerHTML = [
      { k: "N", v: r.n, warn: false },
      { k: "Z", v: r.z, warn: false },
      { k: "C", v: r.c, warn: false },
      { k: "V", v: r.v, warn: true },
    ]
      .map((f) => {
        const on = f.v ? (f.warn ? "is-warn" : "is-on") : "";
        return `<div class="flag ${on}"><h3>${f.k}</h3><p class="bit">${f.v}</p></div>`;
      })
      .join("");

    const fits = r.trueSigned === r.sr;
    if (r.v) {
      warnBox.className = "warn-box is-warn";
      warnBox.textContent = `Signed overflow: true ${r.trueSigned} ≠ wrapped ${r.sr}. V=1.`;
    } else if (r.c && state.op === "add") {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = `Unsigned carry C=1; signed result ${fits ? "OK" : "check"} (V=${r.v}).`;
    } else {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = fits
        ? "Wrapped result matches true signed value — no signed overflow."
        : `True signed ${r.trueSigned} vs wrapped ${r.sr}.`;
    }

    valR.textContent = `${r.sr} / ${toHex(r.r)}`;
    noteR.textContent = `NZCV=${r.n}${r.z}${r.c}${r.v}`;
    valTrue.textContent = String(r.trueSigned);
    noteTrue.textContent =
      r.trueSigned < -128 || r.trueSigned > 127
        ? "outside 8-bit signed"
        : "in range";

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no activity";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ a: state.aStr, b: state.bStr, op: state.op })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("sa-starter").addEventListener("click", loadStarter);

  inA.addEventListener("change", () => {
    state.aStr = inA.value;
    refresh();
    state.lastAction = "edit";
    renderAll();
  });
  inB.addEventListener("change", () => {
    state.bStr = inB.value;
    refresh();
    state.lastAction = "edit";
    renderAll();
  });
  opSel.addEventListener("change", () => {
    state.op = opSel.value;
    refresh();
    state.lastAction = "op";
    pushLog(`# op → ${state.op}`);
    renderAll();
  });

  document.getElementById("btn-compute").addEventListener("click", doCompute);
  document
    .getElementById("btn-ok")
    .addEventListener("click", () =>
      loadCase(100, 50, "add", "ok", { setOk: true })
    );
  document
    .getElementById("btn-ov")
    .addEventListener("click", () =>
      loadCase(100, 100, "add", "ov", { setOv: true })
    );
  document
    .getElementById("btn-neg")
    .addEventListener("click", () => loadCase(-50, -90, "add", "neg", {}));
  document
    .getElementById("btn-carry")
    .addEventListener("click", () => loadCase(200, 100, "add", "carry", {}));
  document
    .getElementById("btn-sub")
    .addEventListener("click", () => loadCase(-100, 50, "sub", "sub-ov", { setOv: true }));
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-twos",
      title: "Quiz: 2's",
      prompt: "Signed encoding used here? Answer: <code>two's complement</code>",
      hint: "MSB = sign",
      type: "text",
      answer: "two's complement",
      alt: ["twos complement", "2's complement", "2s complement"],
    },
    {
      id: "quiz-v",
      title: "Quiz: V",
      prompt: "Signed overflow flag letter? Answer: <code>V</code>",
      hint: "oVerflow",
      type: "text",
      answer: "v",
      alt: ["V", "overflow"],
    },
    {
      id: "quiz-c",
      title: "Quiz: C",
      prompt: "Unsigned carry flag letter? Answer: <code>C</code>",
      hint: "Carry",
      type: "text",
      answer: "c",
      alt: ["C", "carry"],
    },
    {
      id: "quiz-range",
      title: "Quiz: range",
      prompt: "8-bit signed max positive? Answer: <code>127</code>",
      hint: "2^7 − 1",
      type: "text",
      answer: "127",
      alt: ["+127"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 100+50.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setOk &&
        parseByte(state.aStr) === 100 &&
        parseByte(state.bStr) === 50,
    },
    {
      id: "compute",
      title: "Compute",
      prompt: "Press Compute.",
      hint: "Compute",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.computed && state.lastAction === "compute",
    },
    {
      id: "no-ov",
      title: "No overflow",
      prompt: "Example: no overflow — V=0, result 150.",
      hint: "Example: no overflow",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return (
          state.lastAction === "ok" &&
          state.result.v === 0 &&
          state.result.sr === 150
        );
      },
    },
    {
      id: "overflow",
      title: "Overflow",
      prompt: "Example: V=1 (100+100) — V set.",
      hint: "Example: V=1",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return (
          state.setOv &&
          state.lastAction === "ov" &&
          state.result.v === 1 &&
          state.result.sr === -56
        );
      },
    },
    {
      id: "carry-no-v",
      title: "C without V",
      prompt: "Example: C=1 V=0 (200+100).",
      hint: "Example: C=1 V=0",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return (
          state.lastAction === "carry" &&
          state.result.c === 1 &&
          state.result.v === 0
        );
      },
    },
    {
      id: "neg-ov",
      title: "Neg overflow",
      prompt: "Example −50 + −90 — V=1.",
      hint: "Example: −50 + −90",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return state.lastAction === "neg" && state.result.v === 1;
      },
    },
    {
      id: "sub-ov",
      title: "Sub overflow",
      prompt: "Example: sub overflow (−100 − 50).",
      hint: "Example: sub overflow",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return (
          state.op === "sub" &&
          state.lastAction === "sub-ov" &&
          state.result.v === 1
        );
      },
    },
    {
      id: "op-sub",
      title: "Mode sub",
      prompt: "Switch op dropdown to −.",
      hint: "op select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.op === "sub" && state.lastAction === "op",
    },
    {
      id: "flag-z",
      title: "Flag Z",
      prompt: "Compute a case with Z=1 (e.g. 5−5).",
      hint: "Set A=5 B=5 op=− → Compute",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return state.result.z === 1;
      },
    },
    {
      id: "flag-n",
      title: "Flag N",
      prompt: "Result with N=1 (negative wrapped).",
      hint: "100+100 or any neg result",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return state.result.n === 1;
      },
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: C vs V.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "demo" && state.result.v === 1,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain flags.",
      hint: "Explain flags",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "code-v",
      title: "Code V",
      prompt: "Add mode code has <code>V = (a[7]==b[7])</code>.",
      hint: "op + ",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.op === "add" &&
        sourceCode("add").includes("V = (a[7]==b[7])"),
    },
    {
      id: "true-out",
      title: "True out of range",
      prompt: "100+100: true signed 200 is outside −128…127.",
      hint: "Example V=1",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return (
          state.result.trueSigned === 200 &&
          (state.result.trueSigned > 127 || state.result.trueSigned < -128)
        );
      },
    },
    {
      id: "hex-in",
      title: "Hex input",
      prompt: "Set A to 0x7F, B to 1, add, Compute — V=1.",
      hint: "A=0x7F B=1 +",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return (
          parseByte(state.aStr) === 0x7f &&
          parseByte(state.bStr) === 1 &&
          state.op === "add" &&
          state.result.v === 1
        );
      },
    },
    {
      id: "wrap-neg",
      title: "Wrap neg",
      prompt: "100+100 wraps to signed −56.",
      hint: "Example V=1",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return state.result.sa === 100 && state.result.sb === 100 && state.result.sr === -56;
      },
    },
    {
      id: "c-vs-v",
      title: "C≠V",
      prompt: "Have a result where C≠V (either demo case).",
      hint: "200+100 or 100+100",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refresh();
        return state.result.c !== state.result.v;
      },
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
        state.result &&
        state.result.v === 1,
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
