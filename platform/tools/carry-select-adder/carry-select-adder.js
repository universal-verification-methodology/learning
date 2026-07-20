(() => {
  /**
   * Carry-select adder sketch — 8-bit = lower 4 + upper 4
   *   Lower: ripple A[3:0]+B[3:0] → Slo, C4
   *   Upper: two parallel adders with Cin=0 and Cin=1 → (Shi0,C8_0), (Shi1,C8_1)
   *   Mux: select by C4 → Shi, Cout
   */

  function parseNibble(s) {
    const t = String(s).trim().replace(/^0x/i, "");
    let n;
    if (/^[01]{1,4}$/.test(t)) n = parseInt(t.padStart(4, "0"), 2);
    else n = parseInt(t, 16);
    if (Number.isNaN(n)) n = 0;
    return n & 0xf;
  }

  function parseByte(hi, lo) {
    return ((parseNibble(hi) & 0xf) << 4) | (parseNibble(lo) & 0xf);
  }

  function toBin(n, w) {
    return (n >>> 0).toString(2).padStart(w, "0");
  }

  function toHex(n, w) {
    return "0x" + (n >>> 0).toString(16).padStart(w, "0");
  }

  /** 4-bit add with cin → {sum:4, cout} */
  function add4(a, b, cin) {
    const t = (a & 0xf) + (b & 0xf) + (cin & 1);
    return { sum: t & 0xf, cout: t > 0xf ? 1 : 0 };
  }

  function compute(a, b) {
    const aLo = a & 0xf;
    const bLo = b & 0xf;
    const aHi = (a >> 4) & 0xf;
    const bHi = (b >> 4) & 0xf;
    const lo = add4(aLo, bLo, 0);
    const up0 = add4(aHi, bHi, 0);
    const up1 = add4(aHi, bHi, 1);
    const c4 = lo.cout;
    const shi = c4 ? up1.sum : up0.sum;
    const cout = c4 ? up1.cout : up0.cout;
    const sum = (shi << 4) | lo.sum;
    return { aLo, bLo, aHi, bHi, lo, up0, up1, c4, shi, cout, sum };
  }

  function sourceCode() {
    return `// Carry-select (2×4-bit) — concept
// lower: {C4, S[3:0]} = A[3:0] + B[3:0]
// upper dual:
//   {C8_0, S0} = A[7:4] + B[7:4] + 0
//   {C8_1, S1} = A[7:4] + B[7:4] + 1
// mux: S[7:4] = C4 ? S1 : S0;  Cout = C4 ? C8_1 : C8_0`;
  }

  function makeStarter() {
    return {
      aHi: "A",
      aLo: "5",
      bHi: "3",
      bLo: "C",
      phase: 0, // 0 idle 1 dual 2 carry 3 mux 4 done
      result: null,
      lastAction: "",
      explained: false,
      computed: false,
      steppedPhase: false,
      setExample: false,
      setOverflow: false,
      log: [],
      trace: [],
    };
  }

  const PHASES = ["idle", "dual paths", "lower carry", "mux select", "done"];

  const CLEARED_KEY = "ddv-carry-select-adder-cleared-v1";
  const STORE_KEY = "ddv-carry-select-adder-session-v1";

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

  const root = document.getElementById("csa-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> A=<code>0xA5</code>, B=<code>0x3C</code> —
        animate dual upper paths, then mux on carry from the lower nibble.</p>
      <button type="button" class="btn btn-secondary" id="csa-starter">Load starter example</button>
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
            <h3>Speculate</h3>
            <p>Upper block adds twice — Cin 0 and 1 — in parallel.</p>
          </div>
          <div class="idea-card">
            <h3>Select</h3>
            <p>Real Cin (from lower) picks the correct sum via mux.</p>
          </div>
          <div class="idea-card">
            <h3>Why</h3>
            <p>Hide upper carry chain latency behind lower compute.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>8-bit CSA (2×4)</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>A[7:4] <input id="in-ahi" type="text" value="A" maxlength="4"></label>
            <label>A[3:0] <input id="in-alo" type="text" value="5" maxlength="4"></label>
            <label>B[7:4] <input id="in-bhi" type="text" value="3" maxlength="4"></label>
            <label>B[3:0] <input id="in-blo" type="text" value="C" maxlength="4"></label>
          </div>
          <p class="legend">Nibbles: hex digit or 4-bit binary. Phase through the CSA animation.</p>
          <div class="phase-pills" id="phase-pills"></div>
          <div class="blocks" id="blocks"></div>
          <div class="result-bar" id="result-bar">Sum: —</div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box is-ok" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-compute">Compute / refresh</button>
            <button type="button" id="btn-phase">Next phase ▶</button>
            <button type="button" id="btn-run">Run all phases</button>
            <button type="button" id="btn-ex">Example A5+3C</button>
            <button type="button" id="btn-ov">Example FF+01 (Cout)</button>
            <button type="button" id="btn-cin0">Force case C4=0</button>
            <button type="button" id="btn-cin1">Force case C4=1</button>
            <button type="button" id="btn-demo">Demo: mux pick</button>
            <button type="button" id="btn-explain">Explain CSA</button>
            <button type="button" id="btn-reset">Reset phase</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>C4 / pick</h3>
              <p class="val" id="val-c4">—</p>
              <p class="note" id="note-c4"></p>
            </div>
            <div class="status-card">
              <h3>Sum / Cout</h3>
              <p class="val" id="val-sum">—</p>
              <p class="note" id="note-sum"></p>
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
          <thead><tr><th>Piece</th><th>Role</th></tr></thead>
          <tbody>
            <tr><td>Lower adder</td><td>True sum + carry-out C4</td></tr>
            <tr><td>Upper Cin=0</td><td>Speculative sum if no carry</td></tr>
            <tr><td>Upper Cin=1</td><td>Speculative sum if carry</td></tr>
            <tr><td>Mux</td><td>C4 selects which upper result</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Hardware cost: ~2× upper adder + mux; gain: less carry wait.</li>
          <li>Starter A5+3C → 0xE1; lower 5+C produces C4=1 so mux picks Cin=1 path.</li>
        </ul>
      </div>
    </div>
  `;

  const inAhi = /** @type {HTMLInputElement} */ (document.getElementById("in-ahi"));
  const inAlo = /** @type {HTMLInputElement} */ (document.getElementById("in-alo"));
  const inBhi = /** @type {HTMLInputElement} */ (document.getElementById("in-bhi"));
  const inBlo = /** @type {HTMLInputElement} */ (document.getElementById("in-blo"));
  const phasePills = document.getElementById("phase-pills");
  const blocks = document.getElementById("blocks");
  const resultBar = document.getElementById("result-bar");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const valC4 = document.getElementById("val-c4");
  const noteC4 = document.getElementById("note-c4");
  const valSum = document.getElementById("val-sum");
  const noteSum = document.getElementById("note-sum");
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

  function readInputs() {
    state.aHi = inAhi.value;
    state.aLo = inAlo.value;
    state.bHi = inBhi.value;
    state.bLo = inBlo.value;
    const a = parseByte(state.aHi, state.aLo);
    const b = parseByte(state.bHi, state.bLo);
    return { a, b };
  }

  function refreshResult() {
    const { a, b } = readInputs();
    state.result = compute(a, b);
    state.computed = true;
    return state.result;
  }

  function setInputs(ahi, alo, bhi, blo) {
    inAhi.value = ahi;
    inAlo.value = alo;
    inBhi.value = bhi;
    inBlo.value = blo;
    state.aHi = ahi;
    state.aLo = alo;
    state.bHi = bhi;
    state.bLo = blo;
  }

  function goPhase(p) {
    state.phase = p;
    state.steppedPhase = true;
    refreshResult();
    const r = state.result;
    if (p === 1) {
      pushTrace("phase dual: upper Cin=0 and Cin=1 computed");
      pushLog("# dual upper paths ready");
    } else if (p === 2) {
      pushTrace(`phase carry: C4=${r.c4} from lower`);
      pushLog(`# lower carry C4=${r.c4}`);
    } else if (p === 3) {
      pushTrace(`phase mux: pick Cin=${r.c4} path → Shi=${toBin(r.shi, 4)}`);
      pushLog(`# mux select path ${r.c4}`);
    } else if (p === 4) {
      pushTrace(`done: sum=${toHex(r.sum, 2)} Cout=${r.cout}`);
      pushLog(`# sum ${toHex(r.sum, 2)}`);
    }
    state.lastAction = "phase";
    renderAll();
  }

  function nextPhase() {
    refreshResult();
    const p = Math.min(4, state.phase + 1);
    if (state.phase === 0) goPhase(1);
    else goPhase(p);
  }

  function runAll() {
    refreshResult();
    state.phase = 4;
    state.steppedPhase = true;
    state.lastAction = "run";
    const r = state.result;
    pushTrace(`run: C4=${r.c4} pick path${r.c4} sum=${toHex(r.sum, 2)}`);
    pushLog(`# run all → ${toHex(r.sum, 2)} Cout=${r.cout}`);
    renderAll();
  }

  function loadExample() {
    setInputs("A", "5", "3", "C");
    state.setExample = true;
    state.phase = 0;
    refreshResult();
    state.lastAction = "example";
    pushLog("# example A5+3C");
    renderAll();
  }

  function loadOverflow() {
    setInputs("F", "F", "0", "1");
    state.setOverflow = true;
    state.phase = 4;
    refreshResult();
    state.lastAction = "overflow";
    pushTrace(`FF+01 → sum=${toHex(state.result.sum, 2)} Cout=${state.result.cout}`);
    pushLog("# example FF+01");
    renderAll();
  }

  /** Force C4 by choosing operands */
  function forceC4(want) {
    if (want === 0) {
      // lo sum without carry: 1+1 = 2
      setInputs("2", "1", "4", "1");
    } else {
      // lo carry: F+1
      setInputs("2", "F", "4", "1");
    }
    state.phase = 4;
    refreshResult();
    state.lastAction = want === 0 ? "force0" : "force1";
    pushLog(`# force C4=${state.result.c4}`);
    pushTrace(`C4=${state.result.c4} pick path ${state.result.c4}`);
    renderAll();
  }

  function runDemo() {
    setInputs("A", "5", "3", "C");
    state.setExample = true;
    refreshResult();
    state.phase = 4;
    state.lastAction = "demo";
    const r = state.result;
    pushTrace(`demo A5+3C: up0=${toBin(r.up0.sum, 4)} up1=${toBin(r.up1.sum, 4)} C4=${r.c4}→pick${r.c4}`);
    pushLog("# demo mux pick");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# speculate both Cin · mux on true carry · trade area for delay");
    pushTrace("explain: CSA vs plain ripple on upper block");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    setInputs("A", "5", "3", "C");
    state.setExample = true;
    refreshResult();
    state.lastAction = "starter";
    pushLog("# starter A5+3C idle");
    renderAll();
  }

  function renderBlocks() {
    const r = state.result || refreshResult();
    const p = state.phase;
    const showDual = p >= 1;
    const showCarry = p >= 2;
    const showMux = p >= 3;
    const showDone = p >= 4;
    const pick = r.c4;

    const loCls = showCarry ? "is-sel" : "";
    const up0Cls = showMux && pick === 0 ? "is-pick" : showDual ? "" : "";
    const up1Cls = showMux && pick === 1 ? "is-pick" : showDual ? "" : "";

    blocks.innerHTML = `
      <div class="block ${loCls}">
        <h3>Lower nibble</h3>
        <div class="mono">A[3:0]=${toBin(r.aLo, 4)} (${toHex(r.aLo, 1)})</div>
        <div class="mono">B[3:0]=${toBin(r.bLo, 4)} (${toHex(r.bLo, 1)})</div>
        <div class="mono" style="margin-top:0.35rem">S[3:0]=${showCarry || showDone ? toBin(r.lo.sum, 4) : "····"}</div>
        <div class="mono">C4=${showCarry || showDone ? r.c4 : "?"}</div>
      </div>
      <div class="carry-pipe">
        <span>C4</span>
        <span class="cval">${showCarry || showDone ? r.c4 : "·"}</span>
        <span>→ mux</span>
      </div>
      <div class="block ${showMux ? "is-sel" : ""}">
        <h3>Upper nibble (dual)</h3>
        <div class="mono">A[7:4]=${toBin(r.aHi, 4)}  B[7:4]=${toBin(r.bHi, 4)}</div>
        <div class="dual" style="margin-top:0.4rem">
          <div class="path ${up0Cls} ${!showDual ? "is-dim" : ""}">
            Cin=0 → S=${showDual ? toBin(r.up0.sum, 4) : "····"} Cout=${showDual ? r.up0.cout : "?"}
          </div>
          <div class="path ${up1Cls} ${!showDual ? "is-dim" : ""}">
            Cin=1 → S=${showDual ? toBin(r.up1.sum, 4) : "····"} Cout=${showDual ? r.up1.cout : "?"}
          </div>
        </div>
        <div class="mux-label">${
          showMux || showDone
            ? `mux picks Cin=${pick} → S[7:4]=${toBin(r.shi, 4)} Cout=${r.cout}`
            : "mux waits for C4"
        }</div>
      </div>
    `;

    resultBar.textContent = showDone
      ? `Sum = ${toHex(r.sum, 2)} (${toBin(r.sum, 8)}b)  Cout=${r.cout}`
      : `Sum = (pending — phase ${PHASES[p]})`;
  }

  function renderAll() {
    inAhi.value = state.aHi;
    inAlo.value = state.aLo;
    inBhi.value = state.bHi;
    inBlo.value = state.bLo;
    codeBox.textContent = sourceCode();

    phasePills.innerHTML = PHASES.map((name, i) => {
      const on = i === state.phase ? "is-on" : "";
      return `<span class="${on}">${i}:${name}</span>`;
    }).join("");

    if (!state.result) refreshResult();
    renderBlocks();

    const r = state.result;
    valC4.textContent = `${r.c4} / path ${r.c4}`;
    noteC4.textContent = r.c4 ? "select Cin=1 adder" : "select Cin=0 adder";
    valSum.textContent = state.phase >= 4 ? `${toHex(r.sum, 2)} / ${r.cout}` : "—";
    noteSum.textContent = `golden ${(r.aLo | (r.aHi << 4)) + (r.bLo | (r.bHi << 4)) === r.sum + (r.cout << 8) || (parseByte(state.aHi, state.aLo) + parseByte(state.bHi, state.bLo)) === r.sum + (r.cout << 8) ? "ok" : "check"}`;

    // simpler note
    const a = parseByte(state.aHi, state.aLo);
    const b = parseByte(state.bHi, state.bLo);
    const full = a + b;
    noteSum.textContent =
      state.phase >= 4
        ? `check ${a}+${b}=${full} → sum ${r.sum} cout ${r.cout}`
        : "run phases to commit";

    warnBox.textContent =
      state.phase >= 3
        ? `Mux selected the Cin=${r.c4} speculative path.`
        : "Step phases: dual compute → see C4 → mux → done.";

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no activity";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ a: toHex(a, 2), b: toHex(b, 2), phase: state.phase })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("csa-starter").addEventListener("click", loadStarter);

  ["in-ahi", "in-alo", "in-bhi", "in-blo"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      state.phase = Math.min(state.phase, 1);
      refreshResult();
      state.lastAction = "edit";
      pushLog("# operands edited");
      renderAll();
    });
  });

  document.getElementById("btn-compute").addEventListener("click", () => {
    refreshResult();
    state.lastAction = "compute";
    pushLog("# compute refreshed");
    renderAll();
  });

  document.getElementById("btn-phase").addEventListener("click", nextPhase);
  document.getElementById("btn-run").addEventListener("click", runAll);
  document.getElementById("btn-ex").addEventListener("click", loadExample);
  document.getElementById("btn-ov").addEventListener("click", loadOverflow);
  document.getElementById("btn-cin0").addEventListener("click", () => forceC4(0));
  document.getElementById("btn-cin1").addEventListener("click", () => forceC4(1));
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-reset").addEventListener("click", () => {
    state.phase = 0;
    state.lastAction = "reset";
    pushLog("# phase reset");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-csa",
      title: "Quiz: CSA",
      prompt: "Adder that muxes dual Cin paths is a? Answer: <code>carry-select</code>",
      hint: "select on carry",
      type: "text",
      answer: "carry-select",
      alt: ["csa", "carry select", "carry-select adder"],
    },
    {
      id: "quiz-mux",
      title: "Quiz: mux",
      prompt: "Block that picks Cin=0 vs Cin=1 sum? Answer: <code>mux</code>",
      hint: "multiplexer",
      type: "text",
      answer: "mux",
      alt: ["multiplexer", "muxer"],
    },
    {
      id: "quiz-speculate",
      title: "Quiz: dual",
      prompt: "Upper block computes how many speculative sums? Answer: <code>2</code>",
      hint: "Cin 0 and 1",
      type: "text",
      answer: "2",
      alt: ["two", "dual"],
    },
    {
      id: "quiz-c4",
      title: "Quiz: C4",
      prompt: "Select signal from lower nibble is? Answer: <code>C4</code>",
      hint: "carry into bit 4",
      type: "text",
      answer: "c4",
      alt: ["C4", "carry", "cout"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — A5 + 3C.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setExample &&
        parseByte(state.aHi, state.aLo) === 0xa5 &&
        parseByte(state.bHi, state.bLo) === 0x3c,
    },
    {
      id: "example",
      title: "Example",
      prompt: "Load Example A5+3C.",
      hint: "Example A5+3C",
      type: "state",
      setup: () => {
        loadStarter();
        setInputs("0", "0", "0", "0");
        renderAll();
      },
      check: () =>
        state.setExample &&
        state.lastAction === "example" &&
        parseByte(state.aHi, state.aLo) === 0xa5,
    },
    {
      id: "compute",
      title: "Compute",
      prompt: "Compute / refresh.",
      hint: "Compute / refresh",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.computed && state.lastAction === "compute",
    },
    {
      id: "phase",
      title: "Phase",
      prompt: "Advance Next phase at least once.",
      hint: "Next phase ▶",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.steppedPhase && state.phase >= 1,
    },
    {
      id: "run",
      title: "Run all",
      prompt: "Run all phases — phase done.",
      hint: "Run all phases",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.phase === 4 && state.lastAction === "run",
    },
    {
      id: "sum-e1",
      title: "Sum E1",
      prompt: "A5+3C → sum 0xE1 (run or demo).",
      hint: "Example + Run all",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refreshResult();
        return state.result.sum === 0xe1 && state.result.cout === 0;
      },
    },
    {
      id: "c4-zero",
      title: "C4=0",
      prompt: "Force case C4=0 — mux path 0.",
      hint: "Force case C4=0",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "force0" &&
        state.result.c4 === 0 &&
        state.phase === 4,
    },
    {
      id: "c4-one",
      title: "C4=1",
      prompt: "Force case C4=1 — mux path 1.",
      hint: "Force case C4=1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "force1" &&
        state.result.c4 === 1 &&
        state.phase === 4,
    },
    {
      id: "overflow",
      title: "Cout",
      prompt: "Example FF+01 — Cout=1.",
      hint: "Example FF+01",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setOverflow &&
        state.result.cout === 1 &&
        state.result.sum === 0x00,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: mux pick.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "demo" && state.phase === 4,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain CSA.",
      hint: "Explain CSA",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "dual-visible",
      title: "Dual visible",
      prompt: "Reach phase ≥ dual paths so both Cin rows show.",
      hint: "Next phase once",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.phase >= 1,
    },
    {
      id: "mux-phase",
      title: "Mux phase",
      prompt: "Reach mux select phase (phase ≥ 3).",
      hint: "Next phase a few times or Run all",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.phase >= 3,
    },
    {
      id: "code-mux",
      title: "Code mux",
      prompt: "Code box mentions <code>C4 ? S1 : S0</code>.",
      hint: "Always visible in code",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode().includes("C4 ? S1 : S0"),
    },
    {
      id: "paths-differ",
      title: "Paths differ",
      prompt: "Use operands where up0.sum ≠ up1.sum (e.g. starter).",
      hint: "Starter A5+3C",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refreshResult();
        return state.result.up0.sum !== state.result.up1.sum;
      },
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset phase to idle (0).",
      hint: "Reset phase",
      type: "state",
      setup: () => {
        loadStarter();
        runAll();
      },
      check: () => state.phase === 0 && state.lastAction === "reset",
    },
    {
      id: "pick-match",
      title: "Pick match",
      prompt: "Done phase: Shi equals the selected upper path sum.",
      hint: "Run all phases",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        refreshResult();
        const r = state.result;
        const expect = r.c4 ? r.up1.sum : r.up0.sum;
        return state.phase === 4 && r.shi === expect;
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
        state.result.sum === 0xe1,
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
