(() => {
  /**
   * Self-checking TB pattern (concept)
   *   Stimulus → DUT model → expect → compare → pass/fail
   * Starter: and2 a=1,b=1 expect y=1 → PASS
   */

  /** @typedef {"and2"|"adder"|"mux"} DutId */

  const DUTS = {
    and2: {
      title: "and2",
      inputs: [
        { id: "a", label: "a", min: 0, max: 1 },
        { id: "b", label: "b", min: 0, max: 1 },
      ],
      outName: "y",
      model: (v) => (v.a & v.b) & 1,
      hint: "Classic: drive inputs, compute expect, compare DUT out.",
      tbSketch: (v, exp, got, ok) => `module tb;
  reg a, b; wire y;
  and2 dut(.a(a), .b(b), .y(y));
  initial begin
    a = ${v.a}; b = ${v.b};
    #1;
    if (y !== ${exp}) $error("FAIL y=%b expect=${exp}", y);
    else $display("PASS");
    // got=${got} ok=${ok ? 1 : 0}
    $finish;
  end
endmodule`,
    },
    adder: {
      title: "add4",
      inputs: [
        { id: "x", label: "x[3:0]", min: 0, max: 15 },
        { id: "y", label: "y[3:0]", min: 0, max: 15 },
      ],
      outName: "sum",
      model: (v) => (v.x + v.y) & 0xf,
      hint: "Expect is a golden function — not copied from the DUT output.",
      tbSketch: (v, exp, got, ok) => `module tb;
  reg [3:0] x, y; wire [3:0] sum;
  add4 dut(.x(x), .y(y), .sum(sum));
  initial begin
    x = 4'd${v.x}; y = 4'd${v.y};
    #1;
    if (sum !== 4'd${exp}) $error("FAIL");
    else $display("PASS");
    // got=${got} ok=${ok ? 1 : 0}
    $finish;
  end
endmodule`,
    },
    mux: {
      title: "mux2",
      inputs: [
        { id: "d0", label: "d0", min: 0, max: 1 },
        { id: "d1", label: "d1", min: 0, max: 1 },
        { id: "sel", label: "sel", min: 0, max: 1 },
      ],
      outName: "q",
      model: (v) => (v.sel ? v.d1 : v.d0) & 1,
      hint: "Wrong expect → intentional FAIL to practice $error path.",
      tbSketch: (v, exp, got, ok) => `module tb;
  reg d0, d1, sel; wire q;
  mux2 dut(.d0(d0), .d1(d1), .sel(sel), .q(q));
  initial begin
    d0=${v.d0}; d1=${v.d1}; sel=${v.sel};
    #1;
    if (q !== ${exp}) $error("FAIL q=%b", q);
    else $display("PASS");
    // got=${got} ok=${ok ? 1 : 0}
    $finish;
  end
endmodule`,
    },
  };

  function sourceSketch() {
    return `// Self-checking TB (pre-UVM)
// 1) apply stimulus to DUT inputs
// 2) compute expected (golden / reference)
// 3) sample DUT outputs after delay/#1
// 4) if (got !== exp) $error / else $display PASS
// 5) tally errors; $finish
// Do not "check" by only staring at waves.`;
  }

  function defaultInputs(dutId) {
    const d = DUTS[dutId];
    const v = {};
    d.inputs.forEach((inp) => {
      v[inp.id] = 0;
    });
    return v;
  }

  function makeStarter() {
    return {
      dut: "and2",
      stim: { a: 1, b: 1 },
      expect: 1,
      got: 1,
      ok: true,
      checked: true,
      errors: 0,
      passes: 1,
      history: [{ label: "a=1 b=1 exp=1 got=1", ok: true }],
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-self-check-tb-cleared-v1";
  const STORE_KEY = "ddv-self-check-tb-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let quizChoice = "";
  let state = makeStarter();

  const root = document.getElementById("sct-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>and2</code> with <code>a=1,b=1</code>,
        expect <code>y=1</code>, already checked — <strong>PASS</strong>.</p>
      <button type="button" class="btn btn-secondary" id="sct-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions" id="chal-quiz" hidden></div>
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
      <div class="idea-grid">
        <div class="idea-card"><h3>Stimulus</h3><p>Drive DUT inputs from the TB.</p></div>
        <div class="idea-card"><h3>Expect</h3><p>Golden value from a reference model.</p></div>
        <div class="idea-card"><h3>Compare</h3><p>got !== exp → $error (fail).</p></div>
        <div class="idea-card"><h3>Tally</h3><p>Count errors; exit with a clear result.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="sct-controls">
        <div class="sct-field">
          <label for="sel-dut">DUT</label>
          <select id="sel-dut">
            <option value="and2" selected>and2</option>
            <option value="adder">add4</option>
            <option value="mux">mux2</option>
          </select>
        </div>
        <div id="stim-fields" class="sct-controls" style="margin:0"></div>
        <div class="sct-field">
          <label for="inp-exp">Expect</label>
          <input id="inp-exp" type="number" min="0" max="15" value="1">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load DUT</button>
        <button type="button" class="btn btn-ghost" id="btn-auto-exp">Auto expect</button>
        <button type="button" class="btn btn-secondary" id="btn-run">Run check</button>
        <button type="button" class="btn btn-ghost" id="btn-all-vecs">Sweep vectors</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo fail</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="flow" id="flow-row"></div>
      <div class="sct-layout">
        <div class="panel-box">
          <h3>Compare</h3>
          <div id="compare-box" class="compare-box">Run check</div>
          <p id="dut-hint" style="font-size:0.88rem;color:var(--muted);margin:0"></p>
          <h3 style="margin:0.75rem 0 0.35rem;font-size:0.9rem">History</h3>
          <ul class="vector-list" id="hist-list"></ul>
        </div>
        <div class="panel-box">
          <h3>TB sketch</h3>
          <pre class="tb-code" id="tb-code"></pre>
        </div>
      </div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Literacy sketch</h3>
      <pre class="code-box" id="code-box"></pre>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Trace</h3>
        <pre class="trace-box" id="trace-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Log</h3>
        <pre class="log-box" id="log-box"></pre>
      </div>
    </div>
  `;

  const selDut = /** @type {HTMLSelectElement} */ (document.getElementById("sel-dut"));
  const inpExp = /** @type {HTMLInputElement} */ (document.getElementById("inp-exp"));

  function dut() {
    return DUTS[state.dut] || DUTS.and2;
  }

  function golden() {
    return dut().model(state.stim);
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function rebuildStimFields() {
    const wrap = document.getElementById("stim-fields");
    wrap.innerHTML = "";
    dut().inputs.forEach((inp) => {
      const div = document.createElement("div");
      div.className = "sct-field";
      div.innerHTML = `<label for="stim-${inp.id}">${inp.label}</label>
        <input id="stim-${inp.id}" type="number" min="${inp.min}" max="${inp.max}" value="${state.stim[inp.id] ?? 0}">`;
      wrap.appendChild(div);
    });
  }

  function readStim() {
    const v = {};
    dut().inputs.forEach((inp) => {
      const el = /** @type {HTMLInputElement} */ (document.getElementById(`stim-${inp.id}`));
      let n = Number(el?.value ?? 0);
      if (Number.isNaN(n)) n = 0;
      n = Math.max(inp.min, Math.min(inp.max, Math.floor(n)));
      v[inp.id] = n;
      if (el) el.value = String(n);
    });
    state.stim = v;
    state.expect = Number(inpExp.value);
    if (Number.isNaN(state.expect)) state.expect = 0;
  }

  function syncInputs() {
    selDut.value = state.dut;
    inpExp.value = String(state.expect);
    rebuildStimFields();
    dut().inputs.forEach((inp) => {
      const el = /** @type {HTMLInputElement} */ (document.getElementById(`stim-${inp.id}`));
      if (el) el.value = String(state.stim[inp.id] ?? 0);
    });
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter and2 PASS");
    pushTrace("got=1 exp=1 PASS");
    renderAll();
  }

  function loadDut() {
    state.dut = selDut.value in DUTS ? selDut.value : "and2";
    state.stim = defaultInputs(state.dut);
    state.expect = golden();
    state.checked = false;
    state.ok = null;
    state.got = null;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${state.dut}`);
    renderAll();
  }

  function autoExpect() {
    readStim();
    state.expect = golden();
    inpExp.value = String(state.expect);
    state.lastAction = "auto-exp";
    pushTrace(`auto expect=${state.expect}`);
    renderAll();
  }

  function runCheck() {
    readStim();
    const got = golden();
    state.got = got;
    state.ok = got === state.expect;
    state.checked = true;
    if (state.ok) state.passes += 1;
    else state.errors += 1;
    const label = Object.entries(state.stim)
      .map(([k, val]) => `${k}=${val}`)
      .join(" ");
    state.history = [
      ...state.history.slice(-12),
      {
        label: `${label} exp=${state.expect} got=${got}`,
        ok: state.ok,
      },
    ];
    state.lastAction = "run";
    pushTrace(
      state.ok
        ? `PASS got=${got} exp=${state.expect}`
        : `FAIL got=${got} exp=${state.expect}`
    );
    pushLog(state.ok ? "# $display PASS" : "# $error FAIL");
    renderAll();
  }

  function sweep() {
    if (state.dut !== "and2") {
      state.dut = "and2";
      state.stim = { a: 0, b: 0 };
      syncInputs();
    }
    state.errors = 0;
    state.passes = 0;
    state.history = [];
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        state.stim = { a, b };
        state.expect = a & b;
        const got = golden();
        state.got = got;
        state.ok = got === state.expect;
        if (state.ok) state.passes += 1;
        else state.errors += 1;
        state.history.push({
          label: `a=${a} b=${b} exp=${state.expect} got=${got}`,
          ok: state.ok,
        });
      }
    }
    state.checked = true;
    state.lastAction = "sweep";
    syncInputs();
    pushLog("# sweep 4 vectors");
    pushTrace(`passes=${state.passes} errors=${state.errors}`);
    renderAll();
  }

  function demo() {
    state.dut = "and2";
    state.stim = { a: 1, b: 1 };
    state.expect = 0;
    state.got = 1;
    state.ok = false;
    state.checked = true;
    state.errors = 1;
    state.passes = 0;
    state.history = [{ label: "a=1 b=1 exp=0 got=1", ok: false }];
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo intentional FAIL");
    pushTrace("FAIL wrong expect");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Self-checking TBs compute an expected value and compare it to the DUT. " +
        "PASS/$display vs FAIL/$error — do not rely on wave eyeballing alone."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const d = dut();

    document.getElementById("dut-hint").textContent = d.hint;
    document.getElementById("flow-row").innerHTML = `
      <span class="flow-chip is-on">stimulus</span>→
      <span class="flow-chip is-on">DUT ${d.title}</span>→
      <span class="flow-chip is-on">got</span>→
      <span class="flow-chip ${state.checked ? "is-on" : ""}">compare expect</span>→
      <span class="flow-chip ${state.ok === true ? "is-on" : ""}">${
        state.ok === null ? "?" : state.ok ? "PASS" : "FAIL"
      }</span>`;

    const box = document.getElementById("compare-box");
    if (!state.checked) {
      box.className = "compare-box";
      box.textContent = "Set stimulus + expect, then Run check";
    } else if (state.ok) {
      box.className = "compare-box pass";
      box.textContent = `PASS  ${d.outName}=${state.got} === expect ${state.expect}`;
    } else {
      box.className = "compare-box fail";
      box.textContent = `FAIL  ${d.outName}=${state.got} !== expect ${state.expect}  → $error`;
    }

    const hist = document.getElementById("hist-list");
    hist.innerHTML = "";
    if (!state.history.length) {
      hist.innerHTML = "<li>// empty</li>";
    } else {
      state.history.forEach((h) => {
        const li = document.createElement("li");
        li.className = h.ok ? "is-pass" : "is-fail";
        li.textContent = `${h.ok ? "PASS" : "FAIL"}  ${h.label}`;
        hist.appendChild(li);
      });
    }

    document.getElementById("tb-code").textContent = state.checked
      ? d.tbSketch(state.stim, state.expect, state.got, state.ok)
      : "// run check to fill TB sketch";

    const v = document.getElementById("verdict");
    if (!state.checked) {
      v.className = "verdict idle";
      v.textContent = `${d.title} · awaiting Run check`;
    } else if (state.ok) {
      v.className = "verdict yes";
      v.textContent = `PASS · ${d.title} · errors=${state.errors} passes=${state.passes}`;
    } else {
      v.className = "verdict no";
      v.textContent = `FAIL · ${d.title} · errors=${state.errors} passes=${state.passes}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.dut}</span>
      <span class="flag is-on">exp=${state.expect}</span>
      <span class="flag">got=${state.got == null ? "—" : state.got}</span>
      <span class="flag ${state.ok === true ? "is-ok" : state.ok === false ? "is-bad" : ""}">ok=${
        state.ok === null ? "—" : state.ok ? 1 : 0
      }</span>
      <span class="flag ${state.errors ? "is-bad" : "is-ok"}">errors=${state.errors}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          dut: state.dut,
          stim: state.stim,
          expect: state.expect,
          errors: state.errors,
          passes: state.passes,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-goal",
      title: "Quiz: goal",
      type: "quiz",
      prompt: "A self-checking TB’s main job is…",
      hint: "Compare.",
      choices: [
        "compare DUT outputs to an expected value and report pass/fail",
        "only dump VCD for manual review",
        "synthesize the DUT",
        "replace Accellera UVM",
      ],
      answer: "compare DUT outputs to an expected value and report pass/fail",
    },
    {
      id: "quiz-error",
      title: "Quiz: $error",
      type: "quiz",
      prompt: "When got !== expect, a typical TB…",
      hint: "Fail path.",
      choices: [
        "calls $error (or similar) and tallies a failure",
        "always $finish without a message",
        "ignores the mismatch",
        "forces the DUT output to match",
      ],
      answer: "calls $error (or similar) and tallies a failure",
    },
    {
      id: "quiz-golden",
      title: "Quiz: expect",
      type: "quiz",
      prompt: "The expected value should come from…",
      hint: "Independent.",
      choices: [
        "a golden/reference model — not blindly from the DUT itself",
        "only the previous $display string",
        "the SDF annotation file",
        "place-and-route congestion",
      ],
      answer: "a golden/reference model — not blindly from the DUT itself",
    },
    {
      id: "quiz-waves",
      title: "Quiz: waves",
      type: "quiz",
      prompt: "Waveforms alone are…",
      hint: "Not enough.",
      choices: [
        "helpful debug — but not a substitute for automated compares",
        "the only acceptable pass criterion",
        "illegal in self-checking TBs",
        "required for synthesis",
      ],
      answer: "helpful debug — but not a substitute for automated compares",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — and2 PASS with expect 1.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.dut === "and2" &&
        state.ok === true &&
        state.expect === 1,
    },
    {
      id: "run-pass",
      title: "Run PASS",
      prompt: "Run check on starter — ok=1.",
      hint: "Run check",
      setup: () => {
        loadStarter();
        runCheck();
      },
      check: () => state.lastAction === "run" && state.ok === true,
    },
    {
      id: "wrong-exp",
      title: "Wrong expect",
      prompt: "Set expect=0 on a=1,b=1 and Run check — FAIL.",
      hint: "Expect 0 → Run check",
      setup: () => {
        loadStarter();
        inpExp.value = "0";
        runCheck();
      },
      check: () => state.ok === false && state.expect === 0 && state.got === 1,
    },
    {
      id: "auto-exp",
      title: "Auto expect",
      prompt: "Change stim then Auto expect — expect equals golden.",
      hint: "Auto expect",
      setup: () => {
        loadStarter();
        state.stim = { a: 1, b: 0 };
        syncInputs();
        autoExpect();
      },
      check: () => state.expect === golden() && state.lastAction === "auto-exp",
    },
    {
      id: "load-adder",
      title: "Load adder",
      prompt: "Load add4 DUT.",
      hint: "DUT → add4 → Load",
      setup: () => {
        selDut.value = "adder";
        loadDut();
      },
      check: () => state.dut === "adder" && state.lastAction === "load",
    },
    {
      id: "adder-pass",
      title: "Adder PASS",
      prompt: "On add4: x=3,y=4, Auto expect, Run — PASS (sum=7).",
      hint: "Load adder, set 3+4",
      setup: () => {
        selDut.value = "adder";
        loadDut();
        state.stim = { x: 3, y: 4 };
        syncInputs();
        autoExpect();
        runCheck();
      },
      check: () => state.dut === "adder" && state.ok === true && state.got === 7,
    },
    {
      id: "load-mux",
      title: "Load mux",
      prompt: "Load mux2 DUT.",
      hint: "mux2 → Load",
      setup: () => {
        selDut.value = "mux";
        loadDut();
      },
      check: () => state.dut === "mux" && state.lastAction === "load",
    },
    {
      id: "mux-sel",
      title: "Mux select",
      prompt: "mux2: d0=0,d1=1,sel=1 → Auto expect → Run PASS (q=1).",
      hint: "Load mux, set sel=1",
      setup: () => {
        selDut.value = "mux";
        loadDut();
        state.stim = { d0: 0, d1: 1, sel: 1 };
        syncInputs();
        autoExpect();
        runCheck();
      },
      check: () => state.dut === "mux" && state.ok === true && state.got === 1,
    },
    {
      id: "sweep",
      title: "Sweep",
      prompt: "Sweep vectors on and2 — 4 passes, 0 errors.",
      hint: "Sweep vectors",
      setup: () => {
        loadStarter();
        sweep();
      },
      check: () =>
        state.lastAction === "sweep" && state.passes === 4 && state.errors === 0,
    },
    {
      id: "demo",
      title: "Demo fail",
      prompt: "Click Demo fail — ok=0.",
      hint: "Demo fail",
      setup: () => loadStarter(),
      check: () => state.demoed && state.ok === false && state.lastAction === "demo",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Click Explain.",
      hint: "Explain",
      setup: () => loadStarter(),
      check: () => state.explained === true,
    },
    {
      id: "tb-error",
      title: "TB $error",
      prompt: "After Demo fail, TB sketch mentions $error.",
      hint: "Demo fail",
      setup: () => demo(),
      check: () => /\$error/.test(document.getElementById("tb-code").textContent),
    },
    {
      id: "tb-pass",
      title: "TB PASS",
      prompt: "Starter TB sketch mentions PASS.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /PASS/.test(document.getElementById("tb-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions $error.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /\$error/.test(sourceSketch()),
    },
    {
      id: "errors-flag",
      title: "Errors tally",
      prompt: "Demo fail leaves errors≥1.",
      hint: "Demo fail",
      setup: () => demo(),
      check: () => state.errors >= 1,
    },
    {
      id: "and-zero",
      title: "and2 zero",
      prompt: "and2 a=0,b=0 Auto expect Run — got=0 PASS.",
      hint: "Set zeros",
      setup: () => {
        loadStarter();
        state.stim = { a: 0, b: 0 };
        syncInputs();
        autoExpect();
        runCheck();
      },
      check: () => state.ok === true && state.got === 0,
    },
    {
      id: "compare-text",
      title: "Compare box",
      prompt: "On starter, compare box shows PASS.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /^PASS/.test(document.getElementById("compare-box").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to and2 PASS starter.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.dut === "and2" && state.ok === true && state.expect === 1;
      },
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent =
      `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint
      ? "Hide hint"
      : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "quiz") {
      ansRow.innerHTML = "";
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="sct-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
      ansRow.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = clearedIds.includes(c.id) ? `✓ ${i + 1}` : String(i + 1);
      b.style.opacity = i === challengeIdx ? "1" : "0.7";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        else renderAll();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("sct-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadDut());
  document.getElementById("btn-auto-exp").addEventListener("click", () => autoExpect());
  document.getElementById("btn-run").addEventListener("click", () => runCheck());
  document.getElementById("btn-all-vecs").addEventListener("click", () => sweep());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    quizChoice = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    else renderAll();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else if (typeof ch.check === "function") ok = !!ch.check();
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds.push(ch.id);
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("ok", "Cleared");
    } else setChalStatus("bad", "Not yet");
    renderChallenge();
  });

  loadStarter();
})();
