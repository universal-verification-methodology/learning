(() => {
  /**
   * iverilog vs Verilator chooser (concept)
   *   When to pick each tool (matrix quiz)
   * Starter: long regression → Verilator — MATCHED
   */

  const SCENARIOS = [
    {
      id: "course",
      label: "course_event_tb",
      suggest: "iverilog",
      blurb: "Teaching event-driven TB, #delay, easy vvp + VCD — prefer iverilog.",
    },
    {
      id: "speed",
      label: "long_regression",
      suggest: "verilator",
      blurb: "Long / large regressions needing cycle speed — prefer Verilator.",
    },
    {
      id: "timing",
      label: "delay_race_debug",
      suggest: "iverilog",
      blurb: "Full delay / race / event semantics matter — iverilog event engine.",
    },
    {
      id: "cpp",
      label: "cpp_cosim_host",
      suggest: "verilator",
      blurb: "C++ / SystemC host around a Verilated model — Verilator.",
    },
  ];

  const TOOLS = [
    {
      id: "iverilog",
      label: "iverilog",
      blurb: "Icarus: event-driven, vvp runtime, great for courses and delay semantics.",
    },
    {
      id: "verilator",
      label: "Verilator",
      blurb: "Cycle-accurate C++ model: fast regressions and C++ TB hosts.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: speed → Verilator",
      scenarioId: "speed",
      toolId: "verilator",
      note: "Long regression paired with Verilator — MATCHED.",
      autoScan: true,
    },
    course_ok: {
      label: "course → iverilog",
      scenarioId: "course",
      toolId: "iverilog",
      note: "Course event TB with iverilog — MATCHED.",
      autoScan: true,
    },
    mismatch: {
      label: "speed → iverilog",
      scenarioId: "speed",
      toolId: "iverilog",
      note: "Long regression on iverilog — MISMATCH (prefer Verilator).",
      autoScan: true,
    },
    cpp_ok: {
      label: "C++ host → Verilator",
      scenarioId: "cpp",
      toolId: "verilator",
      note: "C++ cosim host with Verilator — MATCHED.",
      autoScan: true,
    },
    no_tool: {
      label: "no tool",
      scenarioId: "timing",
      toolId: null,
      note: "Scenario set but tool missing — NEED_TOOL.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      scenarioId: null,
      toolId: null,
      note: "Idle — pick a use case and tool, then Choose.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// iverilog vs Verilator chooser (document aid)
//
// Pick the tool that fits the job:
//
//   iverilog (Icarus)
//     + event-driven · #delay / races · vvp · easy course VCD
//     − slower on huge regressions
//
//   Verilator
//     + cycle-accurate speed · C++ / SystemC host · lint-ish compile
//     − not a full delay-accurate event simulator
//
// MATCHED   = tool fits the use-case suggestion
// NEED_*    = scenario or tool still missing
// MISMATCH  = wrong tool for the job
//
// Concept matrix only — pair with sim-pipeline / dpi-cpp-tb.`;
  }

  function suggest(scenarioId) {
    const s = SCENARIOS.find((x) => x.id === scenarioId);
    return s ? s.suggest : null;
  }

  function evaluate(scenarioId, toolId) {
    if (!scenarioId) {
      return {
        status: "NEED_SCENARIO",
        ready: false,
        reason: "pick a use-case scenario",
      };
    }
    if (!toolId) {
      return {
        status: "NEED_TOOL",
        ready: false,
        reason: "pick iverilog or Verilator",
      };
    }
    const sug = suggest(scenarioId);
    if (toolId !== sug) {
      return {
        status: "MISMATCH",
        ready: false,
        reason: `scenario prefers ${sug}, not ${toolId}`,
      };
    }
    return {
      status: "MATCHED",
      ready: true,
      reason: `${toolId} fits the use case`,
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.scenarioId, p.toolId);
    return {
      preset: "starter",
      scenarioId: p.scenarioId,
      toolId: p.toolId,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: MATCHED speed→verilator"],
    };
  }

  const CLEARED_KEY = "ddv-iverilog-vs-verilator-cleared-v1";
  const STORE_KEY = "ddv-iverilog-vs-verilator-session-v1";

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

  const root = document.getElementById("ivv-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        use case <code>long_regression</code> → tool <code>Verilator</code> —
        MATCHED.</p>
      <button type="button" class="btn btn-secondary" id="ivv-starter">Load starter example</button>
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
        <div class="idea-card"><h3>iverilog</h3><p>Event-driven · delays · course VCD.</p></div>
        <div class="idea-card"><h3>Verilator</h3><p>Cycle speed · C++ host · big regs.</p></div>
        <div class="idea-card"><h3>use case</h3><p>Job first — then pick the tool.</p></div>
        <div class="idea-card"><h3>MATCHED</h3><p>Tool fits the matrix suggestion.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ivv-controls">
        <div class="ivv-field">
          <label for="sel-preset">Scenario pack</label>
          <select id="sel-preset">
            <option value="starter" selected>speed → Verilator</option>
            <option value="course_ok">course → iverilog</option>
            <option value="mismatch">speed → iverilog</option>
            <option value="cpp_ok">C++ host → Verilator</option>
            <option value="no_tool">no tool</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-choose">Choose</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan choice</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ivv-layout">
        <div class="panel-box">
          <h3>Choice chain</h3>
          <div class="chain" id="chain-box"></div>
          <h3>Tool matrix</h3>
          <table class="compare-table" id="compare-table" aria-label="iverilog vs Verilator"></table>
          <h3>Use cases</h3>
          <div class="scenario-row" id="scenario-row"></div>
          <h3>Tools</h3>
          <div class="pick-row" id="tool-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Chooser sketch</h3>
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

  function planSketch() {
    const sc = SCENARIOS.find((s) => s.id === state.scenarioId);
    const tl = TOOLS.find((t) => t.id === state.toolId);
    const sug = suggest(state.scenarioId);
    return `# tool chooser
scenario: ${sc ? sc.label : "—"}
tool:     ${tl ? tl.label : "—"}
suggest:  ${sug || "—"}
#
# status: ${state.lastScanned ? state.status : "— (Scan choice)"}
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

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter MATCHED");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.scenarioId, state.toolId);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(
      `scan: ${ev.status} ${state.scenarioId || "—"}→${state.toolId || "—"}`
    );
    if (!silent) {
      state.lastAction = ev.ready ? "scan-ok" : "scan-bad";
      pushLog(`# scan ${ev.status}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.scenarioId = p.scenarioId;
    state.toolId = p.toolId;
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

  function choose() {
    if (!state.scenarioId || !state.toolId) {
      state.lastAction = "choose-bad";
      pushLog("# choose FAIL (need scenario + tool)");
      renderAll();
      return;
    }
    pushTrace(`choose: ${state.scenarioId} → ${state.toolId}`);
    pushLog(`# choose ${state.scenarioId} → ${state.toolId}`);
    runScan(true);
    state.lastAction = "choose";
    renderAll();
  }

  function demo() {
    applyPreset("mismatch", "demo");
    state.demoed = true;
    pushLog("# demo speed→iverilog MISMATCH");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain matrix");
    pushTrace("explain: iverilog event/delay · Verilator speed/C++");
    renderAll();
  }

  function selectScenario(id) {
    state.scenarioId = id;
    state.lastAction = "select-scenario";
    state.lastScanned = false;
    renderAll();
  }

  function selectTool(id) {
    state.toolId = id;
    state.lastAction = "select-tool";
    state.lastScanned = false;
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const sc = SCENARIOS.find((s) => s.id === state.scenarioId);
    const tl = TOOLS.find((t) => t.id === state.toolId);
    const sug = suggest(state.scenarioId);

    document.getElementById("chain-box").innerHTML = `${
      sc ? sc.label : '<span class="gap">?scenario</span>'
    } → ${tl ? tl.label : '<span class="gap">?tool</span>'}`;

    document.getElementById("compare-table").innerHTML = `
      <thead><tr><th></th><th>iverilog</th><th>Verilator</th></tr></thead>
      <tbody>
        <tr><th>engine</th><td class="${state.toolId === "iverilog" ? "is-hit" : ""}">event / vvp</td><td class="${state.toolId === "verilator" ? "is-hit" : ""}">cycle / C++</td></tr>
        <tr><th>strength</th><td class="${state.toolId === "iverilog" ? "is-hit" : ""}">delays · courses</td><td class="${state.toolId === "verilator" ? "is-hit" : ""}">speed · cosim</td></tr>
        <tr><th>weakness</th><td class="${state.toolId === "iverilog" ? "is-hit" : ""}">slow huge regs</td><td class="${state.toolId === "verilator" ? "is-hit" : ""}">not full #delay</td></tr>
      </tbody>`;

    document.getElementById("scenario-row").innerHTML = SCENARIOS.map((s) => {
      const on = state.scenarioId === s.id;
      return `<button type="button" class="pick-card ${on ? "is-sel is-on" : ""}" data-scenario="${s.id}">
        <div class="k">→ ${s.suggest}</div>
        <div class="v">${s.label}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-scenario]").forEach((el) => {
      el.addEventListener("click", () =>
        selectScenario(/** @type {string} */ (el.getAttribute("data-scenario")))
      );
    });

    document.getElementById("tool-row").innerHTML = TOOLS.map((t) => {
      const on = state.toolId === t.id;
      const hit = sug && sug === t.id;
      return `<button type="button" class="pick-card ${on ? "is-sel is-on" : ""}" data-tool="${t.id}">
        <div class="k">${hit ? "suggested" : "tool"}</div>
        <div class="v">${t.label}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-tool]").forEach((el) => {
      el.addEventListener("click", () =>
        selectTool(/** @type {string} */ (el.getAttribute("data-tool")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Pick a use case and tool, then Choose / Scan.";
    if (sc && state.lastAction === "select-scenario") blurb = sc.blurb;
    else if (tl && state.lastAction === "select-tool") blurb = tl.blurb;
    else if (sc && tl) blurb = `${sc.label} → ${tl.label}. Suggest ${sug}.`;
    else if (sc) blurb = sc.blurb;
    else if (tl) blurb = tl.blurb;
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
      v.textContent = "Idle — Load preset, Choose, or Scan choice";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Choice MATCHED — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag is-ok">scenario=${state.scenarioId || "—"}</span>
      <span class="flag is-ok">tool=${state.toolId || "—"}</span>
      <span class="flag is-ok">suggest=${sug || "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          scenarioId: state.scenarioId,
          toolId: state.toolId,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-iverilog",
      title: "Quiz: iverilog",
      type: "quiz",
      prompt: "Prefer iverilog when you need…",
      hint: "Events.",
      choices: [
        "event-driven semantics, #delay / races, or easy course vvp+VCD",
        "only the fastest huge farm regression",
        "a C++ SystemC host only",
        "place-and-route",
      ],
      answer:
        "event-driven semantics, #delay / races, or easy course vvp+VCD",
    },
    {
      id: "quiz-verilator",
      title: "Quiz: Verilator",
      type: "quiz",
      prompt: "Prefer Verilator when you need…",
      hint: "Speed / C++.",
      choices: [
        "cycle-accurate speed and/or a C++ / SystemC host around the model",
        "full Verilog delay race teaching only",
        "GTKWave as the compiler",
        "Makefile PHONY targets",
      ],
      answer:
        "cycle-accurate speed and/or a C++ / SystemC host around the model",
    },
    {
      id: "quiz-not-delay",
      title: "Quiz: delay limit",
      type: "quiz",
      prompt: "Verilator is a weak fit when…",
      hint: "#delay.",
      choices: [
        "you rely on full event-delay / race-accurate simulation semantics",
        "you want faster long regressions",
        "you use a C++ TB host",
        "you enable --trace",
      ],
      answer:
        "you rely on full event-delay / race-accurate simulation semantics",
    },
    {
      id: "quiz-matched",
      title: "Quiz: MATCHED",
      type: "quiz",
      prompt: "MATCHED means…",
      hint: "Fit.",
      choices: [
        "the chosen tool matches the use-case matrix suggestion",
        "both tools failed",
        "coverage is 100%",
        "elaborate was skipped",
      ],
      answer:
        "the chosen tool matches the use-case matrix suggestion",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — MATCHED.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "MATCHED",
    },
    {
      id: "load-course",
      title: "Load course",
      prompt: "Load course → iverilog — MATCHED.",
      hint: "course → iverilog → Load",
      setup: () => {
        selPreset.value = "course_ok";
        loadPreset();
      },
      check: () =>
        state.ready &&
        state.toolId === "iverilog" &&
        state.lastAction === "load",
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load speed → iverilog — MISMATCH.",
      hint: "speed → iverilog → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.status === "MISMATCH" && !state.ready,
    },
    {
      id: "load-cpp",
      title: "Load C++ host",
      prompt: "Load C++ host → Verilator — MATCHED.",
      hint: "C++ host → Verilator → Load",
      setup: () => {
        selPreset.value = "cpp_ok";
        loadPreset();
      },
      check: () =>
        state.ready && state.scenarioId === "cpp",
    },
    {
      id: "load-notool",
      title: "Load no tool",
      prompt: "Load no tool — NEED_TOOL.",
      hint: "no tool → Load",
      setup: () => {
        selPreset.value = "no_tool";
        loadPreset();
      },
      check: () =>
        state.status === "NEED_TOOL" && !state.toolId,
    },
    {
      id: "choose",
      title: "Choose",
      prompt: "From no tool, Choose timing→iverilog — MATCHED.",
      hint: "no tool → Choose",
      setup: () => {
        selPreset.value = "no_tool";
        loadPreset();
        state.scenarioId = "timing";
        state.toolId = "iverilog";
        choose();
      },
      check: () =>
        state.ready &&
        state.lastAction === "choose",
    },
    {
      id: "select-scenario",
      title: "Select scenario",
      prompt: "Click delay_race_debug.",
      hint: "Click delay_race_debug",
      setup: () => {
        loadStarter();
        selectScenario("timing");
      },
      check: () =>
        state.scenarioId === "timing" &&
        state.lastAction === "select-scenario",
    },
    {
      id: "select-tool",
      title: "Select tool",
      prompt: "Click iverilog.",
      hint: "Click iverilog",
      setup: () => {
        loadStarter();
        selectTool("iverilog");
      },
      check: () =>
        state.toolId === "iverilog" &&
        state.lastAction === "select-tool",
    },
    {
      id: "scan-ok",
      title: "Scan MATCHED",
      prompt: "On starter, Scan choice — MATCHED.",
      hint: "Scan choice",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan MISMATCH",
      prompt: "On speed→iverilog, Scan — MISMATCH.",
      hint: "speed → iverilog → Scan",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo mismatch",
      prompt: "Click Demo mismatch.",
      hint: "Demo mismatch",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "MISMATCH" &&
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
      prompt: "Literacy sketch mentions MATCHED or Verilator.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /MATCHED|Verilator/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Chooser sketch",
      prompt: "On starter, chooser sketch shows MATCHED.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /MATCHED/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "suggest-speed",
      title: "Suggest speed",
      prompt: "long_regression suggestion is verilator.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => suggest("speed") === "verilator",
    },
    {
      id: "suggest-course",
      title: "Suggest course",
      prompt: "course_event_tb suggestion is iverilog.",
      hint: "Matrix",
      setup: () => loadStarter(),
      check: () => suggest("course") === "iverilog",
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet scanned.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastScanned && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From no tool, Reset — MATCHED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "no_tool";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "MATCHED",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ivv-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ivv-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-choose").addEventListener("click", () => choose());
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
        state.scenarioId = saved.scenarioId || null;
        state.toolId = saved.toolId || null;
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
