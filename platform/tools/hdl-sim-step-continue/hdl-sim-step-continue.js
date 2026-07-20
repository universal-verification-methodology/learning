(() => {
  /**
   * Step & continue (concept)
   *   Step · Continue · $stop / breakpoints
   * Starter: Step + Continue-to-bp practiced — READY
   */

  const CTRL_BLURB = {
    step: "Step advances one conceptual time unit, then pauses — fine-grained walk.",
    continue:
      "Continue runs until a breakpoint, $stop, or the end of the short window.",
    bp: "A breakpoint pauses Continue when simulation time reaches that tick.",
    stop:
      "$stop is a TB/system call that " +
      "halts the run (like hitting a breakpoint).",
  };

  const MAX_T = 10;
  const STOP_ANSWER =
    "is a TB/system call that " +
    "halts the run (like a dynamic breakpoint)";

  function evaluate(s) {
    const triad = s.didStep && s.didContinue && s.didHalt;
    let status = "IDLE";
    let ready = false;
    let reason = "practice Step, Continue, and a halt ($stop / breakpoint)";

    if (s.mode === "running") {
      status = "RUNNING";
      reason = `continuing · t=${s.time}`;
    } else if (triad) {
      status = "READY";
      ready = true;
      reason = `Step + Continue + halt practiced · t=${s.time}`;
    } else if (s.mode === "halted") {
      status = "HALTED";
      reason = `halted at t=${s.time} (${s.haltReason})`;
    } else if (s.didStep || s.didContinue) {
      status = "PAUSED";
      reason = `paused at t=${s.time} — finish Step / Continue / halt triad`;
    } else {
      status = "IDLE";
      reason = `idle at t=${s.time}`;
    }

    return { status, ready, reason, triad };
  }

  const PRESETS = {
    starter: {
      label: "starter: ready",
      time: 5,
      bpOn: true,
      bpAt: 5,
      mode: "halted",
      haltReason: "breakpoint",
      didStep: true,
      didContinue: true,
      didHalt: true,
      note: "Stepped, then Continue hit bp @5 — READY.",
      autoScan: true,
    },
    idle: {
      label: "idle @0",
      time: 0,
      bpOn: true,
      bpAt: 5,
      mode: "idle",
      haltReason: "",
      didStep: false,
      didContinue: false,
      didHalt: false,
      note: "Idle at t=0 with bp@5 — Step or Continue.",
      autoScan: true,
    },
    stepped: {
      label: "after Step",
      time: 1,
      bpOn: true,
      bpAt: 5,
      mode: "paused",
      haltReason: "",
      didStep: true,
      didContinue: false,
      didHalt: false,
      note: "One Step done — still need Continue + halt.",
      autoScan: true,
    },
    bp_hit: {
      label: "bp hit",
      time: 5,
      bpOn: true,
      bpAt: 5,
      mode: "halted",
      haltReason: "breakpoint",
      didStep: false,
      didContinue: true,
      didHalt: true,
      note: "Continue hit breakpoint — HALTED (add Step for READY).",
      autoScan: true,
    },
    stop_hit: {
      label: "$stop hit",
      time: 3,
      bpOn: false,
      bpAt: 5,
      mode: "halted",
      haltReason: "$stop",
      didStep: true,
      didContinue: true,
      didHalt: true,
      note: "TB $stop halted the run — READY.",
      autoScan: true,
    },
    no_bp: {
      label: "no breakpoint",
      time: 0,
      bpOn: false,
      bpAt: 5,
      mode: "idle",
      haltReason: "",
      didStep: false,
      didContinue: false,
      didHalt: false,
      note: "No bp — Continue runs to window end or use Inject $stop.",
      autoScan: true,
    },
    unscanned: {
      label: "idle unscanned",
      time: 0,
      bpOn: true,
      bpAt: 5,
      mode: "idle",
      haltReason: "",
      didStep: false,
      didContinue: false,
      didHalt: false,
      note: "Idle — Step / Continue / Scan.",
      autoScan: false,
    },
  };

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p);
    return {
      preset: "starter",
      time: p.time,
      bpOn: p.bpOn,
      bpAt: p.bpAt,
      mode: p.mode,
      haltReason: p.haltReason,
      didStep: p.didStep,
      didContinue: p.didContinue,
      didHalt: p.didHalt,
      selCtrl: "step",
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

  const CLEARED_KEY = "ddv-hdl-sim-step-continue-cleared-v1";
  const STORE_KEY = "ddv-hdl-sim-step-continue-session-v1";

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

  const root = document.getElementById("hsc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        Step practiced · Continue hit breakpoint @5 — READY.</p>
      <button type="button" class="btn btn-secondary" id="hsc-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Step</h3><p>One time unit, then pause.</p></div>
        <div class="idea-card"><h3>Continue</h3><p>Run until bp / $stop / end.</p></div>
        <div class="idea-card"><h3>Breakpoint</h3><p>Pause when t hits the mark.</p></div>
        <div class="idea-card"><h3>$stop</h3><p>TB/system halt of the run.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="hsc-controls">
        <div class="hsc-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>ready starter</option>
            <option value="idle">idle @0</option>
            <option value="stepped">after Step</option>
            <option value="bp_hit">bp hit</option>
            <option value="stop_hit">$stop hit</option>
            <option value="no_bp">no breakpoint</option>
            <option value="unscanned">idle unscanned</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-step">Step</button>
        <button type="button" class="btn btn-secondary" id="btn-continue">Continue</button>
        <button type="button" class="btn btn-ghost" id="btn-bp">Toggle bp@5</button>
        <button type="button" class="btn btn-ghost" id="btn-stop">Inject $stop</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo Continue→bp</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="hsc-layout">
        <div class="panel-box">
          <h3>Controls</h3>
          <div class="chip-row" id="ctrl-row"></div>
          <h3>Timeline (0–10)</h3>
          <div class="timeline" id="timeline"></div>
          <div class="state-box" id="state-box"></div>
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

  function literacyText() {
    return [
      "// Step & continue literacy (document aid — not a full IDE debugger)",
      "//",
      "//   Step      → advance one time unit, then pause",
      "//   Continue  → run until breakpoint, $stop, or end",
      "//   Breakpoint→ pause when t reaches the marked tick",
      "//   $stop     → TB/system call that " + "halts the run (like a dynamic bp)",
      "//",
      "// READY = you practiced Step, Continue, and at least one halt.",
      "// Pair with hdl-sim-hello-dut (Run/Stop/Reset) and hdl-sim-tour.",
    ].join("\n");
  }

  function planSketch() {
    return `# step / continue session
t:       ${state.time}
bp:      ${state.bpOn ? `@${state.bpAt}` : "off"}
mode:    ${state.mode}
halt:    ${state.haltReason || "—"}
did:     step=${state.didStep ? 1 : 0} cont=${state.didContinue ? 1 : 0} halt=${state.didHalt ? 1 : 0}
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
    state.time = p.time;
    state.bpOn = p.bpOn;
    state.bpAt = p.bpAt;
    state.mode = p.mode;
    state.haltReason = p.haltReason;
    state.didStep = p.didStep;
    state.didContinue = p.didContinue;
    state.didHalt = p.didHalt;
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

  function doStep() {
    if (state.time >= MAX_T) {
      state.mode = "halted";
      state.haltReason = "end";
      state.didHalt = true;
    } else {
      state.time += 1;
      state.mode = "paused";
      state.haltReason = "";
      if (state.bpOn && state.time === state.bpAt) {
        state.mode = "halted";
        state.haltReason = "breakpoint";
        state.didHalt = true;
      }
    }
    state.didStep = true;
    state.selCtrl = "step";
    state.preset = "custom";
    pushTrace(`step: t=${state.time}`);
    pushLog(`# step t=${state.time}`);
    runScan(true);
    state.lastAction = "step";
    renderAll();
  }

  function doContinue() {
    state.didContinue = true;
    state.selCtrl = "continue";
    state.preset = "custom";
    state.mode = "running";
    let guard = 0;
    while (guard++ < MAX_T + 2) {
      if (state.time >= MAX_T) {
        state.mode = "halted";
        state.haltReason = "end";
        state.didHalt = true;
        break;
      }
      state.time += 1;
      if (state.bpOn && state.time === state.bpAt) {
        state.mode = "halted";
        state.haltReason = "breakpoint";
        state.didHalt = true;
        break;
      }
    }
    if (state.mode === "running") state.mode = "paused";
    pushTrace(`continue: t=${state.time} halt=${state.haltReason || "—"}`);
    pushLog(`# continue → t=${state.time}`);
    runScan(true);
    state.lastAction = "continue";
    renderAll();
  }

  function toggleBp() {
    state.bpOn = !state.bpOn;
    state.selCtrl = "bp";
    state.preset = "custom";
    pushTrace(`bp: ${state.bpOn ? "on@" + state.bpAt : "off"}`);
    pushLog(`# bp ${state.bpOn ? "on" : "off"}`);
    runScan(true);
    state.lastAction = "bp";
    renderAll();
  }

  function injectStop() {
    state.mode = "halted";
    state.haltReason = "$stop";
    state.didHalt = true;
    state.didContinue = true;
    state.selCtrl = "stop";
    state.preset = "custom";
    pushTrace(`$stop: t=${state.time}`);
    pushLog("# inject $stop");
    runScan(true);
    state.lastAction = "stop";
    renderAll();
  }

  function demo() {
    applyPreset("idle", null);
    state.didStep = true;
    state.time = 1;
    state.mode = "paused";
    doContinue();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo Continue→bp");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain Step/Continue/$stop");
    pushTrace("explain: Step · Continue · bp/$stop → READY");
    renderAll();
  }

  function selectCtrl(id) {
    state.selCtrl = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const ev = evaluate(state);

    document.getElementById("ctrl-row").innerHTML = ["step", "continue", "bp", "stop"]
      .map((id) => {
        const on = state.selCtrl === id;
        const label =
          id === "bp"
            ? "Breakpoint"
            : id === "stop"
              ? "$stop"
              : id[0].toUpperCase() + id.slice(1);
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

    document.getElementById("timeline").innerHTML = Array.from(
      { length: MAX_T + 1 },
      (_, t) => {
        const isNow = t === state.time;
        const isBp = state.bpOn && t === state.bpAt;
        return `<span class="tick ${isNow ? "is-now" : ""} ${isBp ? "is-bp" : ""}">${t}${
          isBp ? "*" : ""
        }</span>`;
      }
    ).join("");

    document.getElementById("state-box").textContent =
      `t=${state.time}  mode=${state.mode}  bp=${state.bpOn ? "@" + state.bpAt : "off"}
halt=${state.haltReason || "—"}
didStep=${state.didStep ? 1 : 0} didContinue=${state.didContinue ? 1 : 0} didHalt=${state.didHalt ? 1 : 0}`;

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      CTRL_BLURB[state.selCtrl] ||
      "Use Step, Continue, Toggle bp@5, or Inject $stop. Click a chip for tips.";

    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("code-box").textContent = literacyText();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastScanned) {
      v.className = "verdict idle";
      v.textContent = "Idle — Step / Continue / Scan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag is-ok">t=${state.time}</span>
      <span class="flag ${state.bpOn ? "is-ok" : ""}">bp=${state.bpOn ? state.bpAt : "off"}</span>
      <span class="flag ${ev.triad ? "is-ok" : "is-bad"}">triad=${ev.triad ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          time: state.time,
          bpOn: state.bpOn,
          bpAt: state.bpAt,
          mode: state.mode,
          haltReason: state.haltReason,
          didStep: state.didStep,
          didContinue: state.didContinue,
          didHalt: state.didHalt,
          selCtrl: state.selCtrl,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-step",
      title: "Quiz: Step",
      type: "quiz",
      prompt: "Step…",
      hint: "One unit.",
      choices: [
        "advances one conceptual time unit, then pauses",
        "deletes breakpoints",
        "only opens the Files pane",
        "compiles with -Wall",
      ],
      answer: "advances one conceptual time unit, then pauses",
    },
    {
      id: "quiz-continue",
      title: "Quiz: Continue",
      type: "quiz",
      prompt: "Continue runs until…",
      hint: "Halt conditions.",
      choices: [
        "a breakpoint, $stop, or the end of the run window",
        "you close the browser tab only",
        "coverage hits 100%",
        "GTKWave exports PDF",
      ],
      answer: "a breakpoint, $stop, or the end of the run window",
    },
    {
      id: "quiz-bp",
      title: "Quiz: breakpoint",
      type: "quiz",
      prompt: "A breakpoint…",
      hint: "Pause mark.",
      choices: [
        "pauses Continue when simulation time reaches the marked tick",
        "is identical to Reset",
        "turns off -Wall",
        "sets UVM_TESTNAME",
      ],
      answer:
        "pauses Continue when simulation time reaches the marked tick",
    },
    {
      id: "quiz-stop",
      title: "Quiz: $stop",
      type: "quiz",
      prompt: "$stop…",
      hint: "TB halt.",
      choices: [
        STOP_ANSWER,
        "only prints the hierarchy",
        "forces FST format",
        "clears localStorage",
      ],
      answer: STOP_ANSWER,
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
      prompt: "Load idle @0 — IDLE.",
      hint: "idle @0 → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        state.status === "IDLE" &&
        state.time === 0 &&
        state.lastAction === "load",
    },
    {
      id: "load-stepped",
      title: "Load stepped",
      prompt: "Load after Step — PAUSED.",
      hint: "after Step → Load",
      setup: () => {
        selPreset.value = "stepped";
        loadPreset();
      },
      check: () =>
        state.status === "PAUSED" && state.didStep,
    },
    {
      id: "load-bp",
      title: "Load bp hit",
      prompt: "Load bp hit — HALTED.",
      hint: "bp hit → Load",
      setup: () => {
        selPreset.value = "bp_hit";
        loadPreset();
      },
      check: () =>
        state.status === "HALTED" &&
        state.haltReason === "breakpoint",
    },
    {
      id: "load-stop",
      title: "Load $stop",
      prompt: "Load $stop hit — READY.",
      hint: "$stop hit → Load",
      setup: () => {
        selPreset.value = "stop_hit";
        loadPreset();
      },
      check: () =>
        state.ready && state.haltReason === "$stop",
    },
    {
      id: "step",
      title: "Step",
      prompt: "From idle, Step once — t=1.",
      hint: "Step",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doStep();
      },
      check: () =>
        state.time === 1 &&
        state.didStep &&
        state.lastAction === "step",
    },
    {
      id: "continue",
      title: "Continue to bp",
      prompt: "From idle, Continue — halt at bp@5.",
      hint: "Continue",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doContinue();
      },
      check: () =>
        state.time === 5 &&
        state.haltReason === "breakpoint" &&
        state.lastAction === "continue",
    },
    {
      id: "triad",
      title: "Full triad",
      prompt: "From idle: Step, then Continue — READY.",
      hint: "Step → Continue",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doStep();
        doContinue();
      },
      check: () =>
        state.ready &&
        state.didStep &&
        state.didContinue &&
        state.didHalt,
    },
    {
      id: "inject-stop",
      title: "Inject $stop",
      prompt: "From stepped, Inject $stop.",
      hint: "Inject $stop",
      setup: () => {
        selPreset.value = "stepped";
        loadPreset();
        injectStop();
      },
      check: () =>
        state.haltReason === "$stop" &&
        state.lastAction === "stop",
    },
    {
      id: "toggle-bp",
      title: "Toggle bp",
      prompt: "From idle, Toggle bp@5 off.",
      hint: "Toggle bp@5",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        toggleBp();
      },
      check: () =>
        !state.bpOn && state.lastAction === "bp",
    },
    {
      id: "select",
      title: "Select Continue tip",
      prompt: "Click the Continue control chip.",
      hint: "Click Continue chip",
      setup: () => {
        loadStarter();
        selectCtrl("continue");
      },
      check: () =>
        state.selCtrl === "continue" &&
        state.lastAction === "select",
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
      prompt: "On idle, Scan — IDLE.",
      hint: "idle → Scan",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo Continue→bp",
      prompt: "Click Demo Continue→bp.",
      hint: "Demo Continue→bp",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.haltReason === "breakpoint" &&
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
      prompt: "Literacy sketch mentions Continue or breakpoint.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /Continue|breakpoint/i.test(literacyText()),
    },
    {
      id: "idle-scan",
      title: "Load unscanned",
      prompt: "Load idle unscanned — not yet scanned.",
      hint: "idle unscanned → Load",
      setup: () => {
        selPreset.value = "unscanned";
        loadPreset();
      },
      check: () =>
        !state.lastScanned && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From idle, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="hsc-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("hsc-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-step").addEventListener("click", () => doStep());
  document.getElementById("btn-continue").addEventListener("click", () => doContinue());
  document.getElementById("btn-bp").addEventListener("click", () => toggleBp());
  document.getElementById("btn-stop").addEventListener("click", () => injectStop());
  document.getElementById("btn-scan").addEventListener("click", () => runScan(false));
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

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved) {
        state.time = saved.time || 0;
        state.bpOn = !!saved.bpOn;
        state.bpAt = saved.bpAt || 5;
        state.mode = saved.mode || "idle";
        state.haltReason = saved.haltReason || "";
        state.didStep = !!saved.didStep;
        state.didContinue = !!saved.didContinue;
        state.didHalt = !!saved.didHalt;
        state.selCtrl = saved.selCtrl || "step";
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
