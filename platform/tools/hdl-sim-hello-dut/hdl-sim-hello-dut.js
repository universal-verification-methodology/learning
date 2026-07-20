(() => {
  /**
   * Hello DUT in browser (concept)
   *   Tiny module → Run / Stop / Reset
   * Starter: counter loaded · Run→Stop→Reset done — READY
   */

  const DUTS = [
    {
      id: "counter",
      label: "counter",
      blurb: "Tiny up-counter — q increments while Run is active (concept clock).",
      sketch: "module counter(input clk, rst_n, output [3:0] q);",
    },
    {
      id: "toggle",
      label: "toggle",
      blurb: "1-bit toggle FF — q flips each conceptual clock while running.",
      sketch: "module toggle(input clk, rst_n, output q);",
    },
    {
      id: "and2",
      label: "and2",
      blurb: "Combo AND — q mirrors a∧b; Run still advances sim time for literacy.",
      sketch: "module and2(input a, b, output q);",
    },
  ];

  const CTRL_BLURB = {
    run: "Run starts (or resumes) simulation time — the DUT updates each step.",
    stop: "Stop freezes time — inspect state without advancing the model.",
    reset: "Reset returns the DUT to its initial state and leaves sim stopped.",
    load: "Load picks which tiny DUT sketch is in the browser sandbox.",
  };

  function dutOf(id) {
    return DUTS.find((d) => d.id === id);
  }

  function evaluate(s) {
    const loaded = !!s.dut;
    const triad = s.didRun && s.didStop && s.didReset;
    let status = "OPEN";
    let ready = false;
    let reason = "load a DUT and practice Run / Stop / Reset";

    if (!loaded) {
      status = "OPEN";
      reason = "no DUT loaded";
    } else if (s.running) {
      status = "RUNNING";
      reason = `${s.dut} running · q=${s.q} · t=${s.time}`;
    } else if (triad) {
      status = "READY";
      ready = true;
      reason = `${s.dut} · Run/Stop/Reset practiced · q=${s.q}`;
    } else if (s.time > 0 || s.didRun) {
      status = "STOPPED";
      reason = `${s.dut} stopped · still need full Run/Stop/Reset practice`;
    } else {
      status = "IDLE";
      reason = `${s.dut} loaded · idle (q=${s.q})`;
    }

    return { status, ready, reason, triad, loaded };
  }

  function stepQ(dutId, q) {
    if (dutId === "counter") return (q + 1) & 0xf;
    if (dutId === "toggle") return q ^ 1;
    if (dutId === "and2") return 1; // concept: a=1,b=1 while running
    return q;
  }

  const PRESETS = {
    starter: {
      label: "starter: ready",
      dut: "counter",
      running: false,
      q: 0,
      time: 0,
      didRun: true,
      didStop: true,
      didReset: true,
      note: "Counter loaded; Run→Stop→Reset already practiced — READY.",
      autoScan: true,
    },
    idle_load: {
      label: "loaded idle",
      dut: "counter",
      running: false,
      q: 0,
      time: 0,
      didRun: false,
      didStop: false,
      didReset: false,
      note: "Counter loaded, never run — IDLE.",
      autoScan: true,
    },
    running: {
      label: "running",
      dut: "counter",
      running: true,
      q: 3,
      time: 3,
      didRun: true,
      didStop: false,
      didReset: false,
      note: "Sim running — STOP to freeze.",
      autoScan: true,
    },
    stopped: {
      label: "stopped mid",
      dut: "counter",
      running: false,
      q: 5,
      time: 5,
      didRun: true,
      didStop: true,
      didReset: false,
      note: "Stopped mid-count — Reset to clear.",
      autoScan: true,
    },
    toggle: {
      label: "toggle DUT",
      dut: "toggle",
      running: false,
      q: 0,
      time: 0,
      didRun: false,
      didStop: false,
      didReset: false,
      note: "Toggle FF loaded — IDLE.",
      autoScan: true,
    },
    empty: {
      label: "no DUT",
      dut: null,
      running: false,
      q: 0,
      time: 0,
      didRun: false,
      didStop: false,
      didReset: false,
      note: "Empty sandbox — Load a DUT first.",
      autoScan: true,
    },
    idle: {
      label: "idle scan",
      dut: "and2",
      running: false,
      q: 0,
      time: 0,
      didRun: false,
      didStop: false,
      didReset: false,
      note: "Idle — Load / Run / Stop / Reset, then Scan.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Hello DUT literacy (document aid — not the full HDL Simulator)
//
//   1. Load a tiny module (counter / toggle / and2)
//   2. Run  — advance sim time, DUT updates
//   3. Stop — freeze to inspect
//   4. Reset — back to initial state, stopped
//
// READY = DUT loaded and you have practiced Run, Stop, and Reset.
// Practice surface: public HDL Simulator for real edits.
// Pair with hdl-sim-tour (panes) and hdl-sim-step-continue (step).`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p);
    return {
      preset: "starter",
      dut: p.dut,
      running: p.running,
      q: p.q,
      time: p.time,
      didRun: p.didRun,
      didStop: p.didStop,
      didReset: p.didReset,
      selCtrl: "run",
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: ${ev.status}`],
    };
  }

  const CLEARED_KEY = "ddv-hdl-sim-hello-dut-cleared-v1";
  const STORE_KEY = "ddv-hdl-sim-hello-dut-session-v1";

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

  const root = document.getElementById("hhd-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        tiny <code>counter</code> loaded; Run → Stop → Reset practiced — READY.</p>
      <button type="button" class="btn btn-secondary" id="hhd-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Load DUT</h3><p>Pick a tiny module for the sandbox.</p></div>
        <div class="idea-card"><h3>Run</h3><p>Advance sim time; DUT updates.</p></div>
        <div class="idea-card"><h3>Stop</h3><p>Freeze time to inspect state.</p></div>
        <div class="idea-card"><h3>Reset</h3><p>Return to initial state, stopped.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="hhd-controls">
        <div class="hhd-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>ready starter</option>
            <option value="idle_load">loaded idle</option>
            <option value="running">running</option>
            <option value="stopped">stopped mid</option>
            <option value="toggle">toggle DUT</option>
            <option value="empty">no DUT</option>
            <option value="idle">idle scan</option>
          </select>
        </div>
        <div class="hhd-field">
          <label for="sel-dut">DUT</label>
          <select id="sel-dut">
            <option value="counter">counter</option>
            <option value="toggle">toggle</option>
            <option value="and2">and2</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-loaddut">Load DUT</button>
        <button type="button" class="btn btn-secondary" id="btn-run">Run</button>
        <button type="button" class="btn btn-ghost" id="btn-stop">Stop</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo run</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset-lab">Reset lab</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="hhd-layout">
        <div class="panel-box">
          <h3>Controls</h3>
          <div class="chip-row" id="ctrl-row"></div>
          <h3>DUT state</h3>
          <div class="dut-box" id="dut-box"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Session sketch</h3>
          <pre class="plan-box" id="plan-box"></pre>
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

  const selPreset = /** @type {HTMLSelectElement} */ (document.getElementById("sel-preset"));
  const selDut = /** @type {HTMLSelectElement} */ (document.getElementById("sel-dut"));

  function planSketch() {
    const d = state.dut ? dutOf(state.dut) : null;
    return `# hello DUT session
dut:     ${state.dut || "(none)"}
running: ${state.running ? 1 : 0}
q:       ${state.q}
time:    ${state.time}
did:     run=${state.didRun ? 1 : 0} stop=${state.didStop ? 1 : 0} reset=${state.didReset ? 1 : 0}
${d ? `# ${d.sketch}` : "# (load a DUT)"}
# status: ${state.lastScanned ? state.status : "— (Scan)"}
# reason: ${state.lastScanned ? state.reason : "—"}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kindName, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kindName;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    if (state.dut) selDut.value = state.dut;
  }

  function runScan(silent) {
    const ev = evaluate(state);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status}`);
    if (!silent) {
      state.lastAction = ev.ready ? "scan-ok" : "scan-bad";
      pushLog(`# scan ${ev.status}`);
      renderAll();
    }
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter READY");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.dut = p.dut;
    state.running = p.running;
    state.q = p.q;
    state.time = p.time;
    state.didRun = p.didRun;
    state.didStop = p.didStop;
    state.didReset = p.didReset;
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.lastScanned = false;
    syncInputs();
    if (p.autoScan) {
      runScan(true);
      if (mark) state.lastAction = mark;
    } else if (mark) {
      state.lastAction = mark;
    }
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function loadDut() {
    const id = selDut.value;
    state.dut = id;
    state.running = false;
    state.q = 0;
    state.time = 0;
    state.didRun = false;
    state.didStop = false;
    state.didReset = false;
    state.preset = "custom";
    state.selCtrl = "load";
    pushTrace(`load: ${id}`);
    pushLog(`# load DUT ${id}`);
    runScan(true);
    state.lastAction = "loaddut";
    renderAll();
  }

  function doRun() {
    if (!state.dut) {
      state.lastAction = "run-bad";
      pushLog("# run FAIL (no DUT)");
      renderAll();
      return;
    }
    state.running = true;
    state.didRun = true;
    state.time += 1;
    state.q = stepQ(state.dut, state.q);
    state.selCtrl = "run";
    state.preset = "custom";
    pushTrace(`run: t=${state.time} q=${state.q}`);
    pushLog(`# run t=${state.time}`);
    runScan(true);
    state.lastAction = "run";
    renderAll();
  }

  function doStop() {
    if (!state.dut) {
      state.lastAction = "stop-bad";
      pushLog("# stop FAIL (no DUT)");
      renderAll();
      return;
    }
    state.running = false;
    state.didStop = true;
    state.selCtrl = "stop";
    state.preset = "custom";
    pushTrace(`stop: t=${state.time} q=${state.q}`);
    pushLog("# stop");
    runScan(true);
    state.lastAction = "stop";
    renderAll();
  }

  function doReset() {
    if (!state.dut) {
      state.lastAction = "reset-bad";
      pushLog("# reset FAIL (no DUT)");
      renderAll();
      return;
    }
    state.running = false;
    state.q = 0;
    state.time = 0;
    state.didReset = true;
    state.selCtrl = "reset";
    state.preset = "custom";
    pushTrace("reset: q=0 t=0");
    pushLog("# reset");
    runScan(true);
    state.lastAction = "reset";
    renderAll();
  }

  function demo() {
    applyPreset("idle_load", null);
    state.didRun = true;
    state.running = true;
    state.time = 2;
    state.q = 2;
    runScan(true);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo running");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain Run/Stop/Reset");
    pushTrace("explain: Load DUT · Run · Stop · Reset → READY");
    renderAll();
  }

  function selectCtrl(id) {
    state.selCtrl = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const d = state.dut ? dutOf(state.dut) : null;
    const ev = evaluate(state);

    document.getElementById("ctrl-row").innerHTML = ["run", "stop", "reset", "load"]
      .map((id) => {
        const on = state.selCtrl === id;
        const label = id === "load" ? "Load DUT" : id[0].toUpperCase() + id.slice(1);
        return `<button type="button" class="chip ${on ? "is-on" : ""}" data-ctrl="${id}">
          <span class="k">ctrl</span>${label}
        </button>`;
      })
      .join("");
    document.querySelectorAll("[data-ctrl]").forEach((el) => {
      el.addEventListener("click", () =>
        selectCtrl(/** @type {string} */ (el.getAttribute("data-ctrl")))
      );
    });

    document.getElementById("dut-box").textContent = state.dut
      ? `${d.sketch}
running=${state.running ? 1 : 0}  q=${state.q}  t=${state.time}
didRun=${state.didRun ? 1 : 0} didStop=${state.didStop ? 1 : 0} didReset=${state.didReset ? 1 : 0}`
      : "(no DUT — Load DUT or a preset)";

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Load a DUT, then use Run / Stop / Reset. Click a control chip for its tip.";
    if (state.selCtrl && CTRL_BLURB[state.selCtrl]) blurb = CTRL_BLURB[state.selCtrl];
    else if (d) blurb = d.blurb;
    document.getElementById("role-blurb").textContent = blurb;

    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastScanned) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load DUT, Run / Stop / Reset, or Scan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${state.dut ? "is-ok" : "is-bad"}">dut=${state.dut || "—"}</span>
      <span class="flag ${state.running ? "is-ok" : ""}">run=${state.running ? 1 : 0}</span>
      <span class="flag is-ok">q=${state.q}</span>
      <span class="flag ${ev.triad ? "is-ok" : "is-bad"}">triad=${ev.triad ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          dut: state.dut,
          running: state.running,
          q: state.q,
          time: state.time,
          didRun: state.didRun,
          didStop: state.didStop,
          didReset: state.didReset,
          selCtrl: state.selCtrl,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-run",
      title: "Quiz: Run",
      type: "quiz",
      prompt: "Run does…",
      hint: "Advance time.",
      choices: [
        "start or resume simulation so the DUT can update",
        "delete the project files",
        "only open GTKWave",
        "set UVM_TESTNAME",
      ],
      answer: "start or resume simulation so the DUT can update",
    },
    {
      id: "quiz-stop",
      title: "Quiz: Stop",
      type: "quiz",
      prompt: "Stop is for…",
      hint: "Freeze.",
      choices: [
        "freezing sim time so you can inspect state",
        "compiling with -Wall",
        "forcing all signals to X",
        "exporting FST only",
      ],
      answer: "freezing sim time so you can inspect state",
    },
    {
      id: "quiz-reset",
      title: "Quiz: Reset",
      type: "quiz",
      prompt: "Reset…",
      hint: "Initial state.",
      choices: [
        "returns the DUT to its initial state and leaves sim stopped",
        "is identical to Run",
        "only clears the Console font",
        "enables --trace-fst",
      ],
      answer: "returns the DUT to its initial state and leaves sim stopped",
    },
    {
      id: "quiz-ready",
      title: "Quiz: READY",
      type: "quiz",
      prompt: "This lab’s READY means…",
      hint: "Triad.",
      choices: [
        "a DUT is loaded and you practiced Run, Stop, and Reset",
        "coverage is 100%",
        "only Files pane is open",
        "plusargs are parsed",
      ],
      answer: "a DUT is loaded and you practiced Run, Stop, and Reset",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — READY.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "READY",
    },
    {
      id: "load-idle",
      title: "Load idle",
      prompt: "Load loaded idle — IDLE.",
      hint: "loaded idle → Load",
      setup: () => {
        selPreset.value = "idle_load";
        loadPreset();
      },
      check: () =>
        state.status === "IDLE" &&
        state.dut === "counter" &&
        state.lastAction === "load",
    },
    {
      id: "load-running",
      title: "Load running",
      prompt: "Load running — RUNNING.",
      hint: "running → Load",
      setup: () => {
        selPreset.value = "running";
        loadPreset();
      },
      check: () =>
        state.status === "RUNNING" && state.running,
    },
    {
      id: "load-stopped",
      title: "Load stopped",
      prompt: "Load stopped mid — STOPPED.",
      hint: "stopped mid → Load",
      setup: () => {
        selPreset.value = "stopped";
        loadPreset();
      },
      check: () =>
        state.status === "STOPPED" &&
        state.didStop &&
        !state.didReset,
    },
    {
      id: "load-empty",
      title: "Load empty",
      prompt: "Load no DUT — OPEN.",
      hint: "no DUT → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" && !state.dut,
    },
    {
      id: "loaddut",
      title: "Load DUT",
      prompt: "From empty, Load DUT counter — IDLE.",
      hint: "empty → Load DUT",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        selDut.value = "counter";
        loadDut();
      },
      check: () =>
        state.dut === "counter" &&
        state.status === "IDLE" &&
        state.lastAction === "loaddut",
    },
    {
      id: "run",
      title: "Run",
      prompt: "From idle load, Run — RUNNING.",
      hint: "Run",
      setup: () => {
        selPreset.value = "idle_load";
        loadPreset();
        doRun();
      },
      check: () =>
        state.running &&
        state.didRun &&
        state.lastAction === "run",
    },
    {
      id: "stop",
      title: "Stop",
      prompt: "From running, Stop — STOPPED.",
      hint: "Stop",
      setup: () => {
        selPreset.value = "running";
        loadPreset();
        doStop();
      },
      check: () =>
        !state.running &&
        state.didStop &&
        state.lastAction === "stop",
    },
    {
      id: "reset-ctrl",
      title: "Reset",
      prompt: "From stopped, Reset — q=0 and triad path.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "stopped";
        loadPreset();
        doReset();
      },
      check: () =>
        state.q === 0 &&
        state.didReset &&
        state.lastAction === "reset",
    },
    {
      id: "triad",
      title: "Full triad",
      prompt: "From idle: Run, Stop, Reset — READY.",
      hint: "Run → Stop → Reset",
      setup: () => {
        selPreset.value = "idle_load";
        loadPreset();
        doRun();
        doStop();
        doReset();
      },
      check: () =>
        state.ready &&
        state.didRun &&
        state.didStop &&
        state.didReset,
    },
    {
      id: "select",
      title: "Select Stop tip",
      prompt: "Click the Stop control chip.",
      hint: "Click Stop chip",
      setup: () => {
        loadStarter();
        selectCtrl("stop");
      },
      check: () =>
        state.selCtrl === "stop" && state.lastAction === "select",
    },
    {
      id: "scan-ok",
      title: "Scan READY",
      prompt: "On starter, Scan — READY.",
      hint: "Scan",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan IDLE",
      prompt: "On loaded idle, Scan — IDLE.",
      hint: "loaded idle → Scan",
      setup: () => {
        selPreset.value = "idle_load";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo run",
      prompt: "Click Demo run.",
      hint: "Demo run",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.running &&
        state.lastAction === "demo",
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
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions Run or Reset.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /Run|Reset/.test(sourceSketch()),
    },
    {
      id: "idle-scan",
      title: "Load idle scan",
      prompt: "Load idle scan — not yet scanned.",
      hint: "idle scan → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastScanned && state.lastAction === "load",
    },
    {
      id: "reset-lab",
      title: "Reset lab",
      prompt: "From empty, Reset lab — READY again.",
      hint: "Reset lab",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset-lab" &&
        state.status === "READY",
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) =>
      CHALLENGES.some((c) => c.id === id)
    ).length;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="hhd-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("hhd-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-loaddut").addEventListener("click", () => loadDut());
  document.getElementById("btn-run").addEventListener("click", () => doRun());
  document.getElementById("btn-stop").addEventListener("click", () => doStop());
  document.getElementById("btn-reset").addEventListener("click", () => doReset());
  document.getElementById("btn-scan").addEventListener("click", () => runScan(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset-lab").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset-lab";
    pushLog("# reset lab");
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

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved) {
        state.dut = saved.dut;
        state.running = !!saved.running;
        state.q = saved.q || 0;
        state.time = saved.time || 0;
        state.didRun = !!saved.didRun;
        state.didStop = !!saved.didStop;
        state.didReset = !!saved.didReset;
        state.selCtrl = saved.selCtrl || "run";
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
        syncInputs();
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
