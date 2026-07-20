(() => {
  /**
   * Wave dump literacy (concept)
   *   VCD vs FST roles (not GTKWave)
   * Starter: long farm → FST — MATCHED
   */

  const SCENARIOS = [
    {
      id: "quick",
      label: "quick_debug",
      suggest: "vcd",
      blurb: "Short directed debug — VCD is fine (readable, portable).",
    },
    {
      id: "farm",
      label: "long_farm",
      suggest: "fst",
      blurb: "Long / many-signal farm dump — prefer compact FST.",
    },
    {
      id: "share",
      label: "portable_share",
      suggest: "vcd",
      blurb: "Hand a dump to a teammate / tool that expects text VCD.",
    },
  ];

  const FORMATS = [
    {
      id: "vcd",
      label: "VCD",
      blurb: "Text Value Change Dump — portable, larger, easy to grep.",
    },
    {
      id: "fst",
      label: "FST",
      blurb: "Compact binary Fast Signal Trace — smaller/faster for big runs.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: farm → FST",
      scenarioId: "farm",
      formatId: "fst",
      dumpOn: true,
      note: "Long farm run paired with FST — MATCHED.",
      autoScan: true,
    },
    quick_vcd: {
      label: "quick → VCD",
      scenarioId: "quick",
      formatId: "vcd",
      dumpOn: true,
      note: "Quick debug with VCD — MATCHED.",
      autoScan: true,
    },
    mismatch: {
      label: "farm → VCD",
      scenarioId: "farm",
      formatId: "vcd",
      dumpOn: true,
      note: "Farm-scale with VCD — MISMATCH (prefer FST).",
      autoScan: true,
    },
    no_dump: {
      label: "dump off",
      scenarioId: "farm",
      formatId: "fst",
      dumpOn: false,
      note: "Format chosen but dump disabled — NEED_DUMP.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      scenarioId: null,
      formatId: null,
      dumpOn: false,
      note: "Idle — pick a scenario and format, then Choose.",
      autoScan: false,
    },
    empty_fmt: {
      label: "no format",
      scenarioId: "share",
      formatId: null,
      dumpOn: true,
      note: "Scenario set but format missing — NEED_FORMAT.",
      autoScan: true,
    },
  };

  function sourceSketch() {
    return `// Wave dump literacy (document aid)
//
// Enable a dump, then pick a format for the job:
//
//   VCD  — text, portable, larger; great for short debug / sharing
//   FST  — compact binary; better for long / wide farm dumps
//
// iverilog:  $dumpfile/$dumpvars → usually .vcd
// Verilator: --trace / --trace-fst → VCD or FST
//
// Viewer (GTKWave, etc.) is separate — this lab is format roles only.
//
// MATCHED   = dump on + format fits the scenario
// NEED_DUMP = dumping still off
// NEED_*    = scenario or format missing
// MISMATCH  = dump on but wrong format for the job
// Pair with sim-pipeline and waveform-lab / gtkwave-cursors.`;
  }

  function suggest(scenarioId) {
    const s = SCENARIOS.find((x) => x.id === scenarioId);
    return s ? s.suggest : null;
  }

  function evaluate(scenarioId, formatId, dumpOn) {
    if (!dumpOn) {
      return {
        status: "NEED_DUMP",
        ready: false,
        reason: "enable dumping before choosing a file role",
      };
    }
    if (!scenarioId) {
      return {
        status: "NEED_SCENARIO",
        ready: false,
        reason: "pick a dump scenario",
      };
    }
    if (!formatId) {
      return {
        status: "NEED_FORMAT",
        ready: false,
        reason: "pick VCD or FST",
      };
    }
    const sug = suggest(scenarioId);
    if (formatId !== sug) {
      return {
        status: "MISMATCH",
        ready: false,
        reason: `scenario prefers ${sug}, not ${formatId}`,
      };
    }
    return {
      status: "MATCHED",
      ready: true,
      reason: `${formatId.toUpperCase()} fits the scenario`,
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.scenarioId, p.formatId, p.dumpOn);
    return {
      preset: "starter",
      scenarioId: p.scenarioId,
      formatId: p.formatId,
      dumpOn: p.dumpOn,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: MATCHED farm→fst"],
    };
  }

  const CLEARED_KEY = "ddv-wave-dump-cleared-v1";
  const STORE_KEY = "ddv-wave-dump-session-v1";

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

  const root = document.getElementById("wvd-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        scenario <code>long_farm</code> → format <code>FST</code>
        with dump on — MATCHED.</p>
      <button type="button" class="btn btn-secondary" id="wvd-starter">Load starter example</button>
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
        <div class="idea-card"><h3>VCD</h3><p>Text dump — portable, larger.</p></div>
        <div class="idea-card"><h3>FST</h3><p>Compact binary — long / wide runs.</p></div>
        <div class="idea-card"><h3>dump on</h3><p>Must enable before a file appears.</p></div>
        <div class="idea-card"><h3>MATCHED</h3><p>Format fits the dump scenario.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="wvd-controls">
        <div class="wvd-field">
          <label for="sel-preset">Scenario pack</label>
          <select id="sel-preset">
            <option value="starter" selected>farm → FST</option>
            <option value="quick_vcd">quick → VCD</option>
            <option value="mismatch">farm → VCD</option>
            <option value="no_dump">dump off</option>
            <option value="empty_fmt">no format</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-choose">Choose</button>
        <button type="button" class="btn btn-ghost" id="btn-dump">Toggle dump</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan choice</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="wvd-layout">
        <div class="panel-box">
          <h3>Choice chain</h3>
          <div class="chain" id="chain-box"></div>
          <h3>VCD vs FST</h3>
          <table class="compare-table" id="compare-table" aria-label="VCD vs FST"></table>
          <h3>Dump scenarios</h3>
          <div class="pick-row" id="scenario-row"></div>
          <h3>Formats</h3>
          <div class="fmt-row" id="format-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Dump sketch</h3>
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
    const fm = FORMATS.find((f) => f.id === state.formatId);
    const sug = suggest(state.scenarioId);
    return `# wave dump
dump:     ${state.dumpOn ? "ON" : "OFF"}
scenario: ${sc ? sc.label : "—"}
format:   ${fm ? fm.label : "—"}
suggest:  ${sug ? sug.toUpperCase() : "—"}
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
    const ev = evaluate(state.scenarioId, state.formatId, state.dumpOn);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(
      `scan: ${ev.status} dump=${state.dumpOn ? 1 : 0} ${state.scenarioId || "—"}→${state.formatId || "—"}`
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
    state.formatId = p.formatId;
    state.dumpOn = p.dumpOn;
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
    if (!state.scenarioId || !state.formatId) {
      state.lastAction = "choose-bad";
      pushLog("# choose FAIL (need scenario + format)");
      renderAll();
      return;
    }
    if (!state.dumpOn) state.dumpOn = true;
    pushTrace(`choose: ${state.scenarioId} → ${state.formatId}`);
    pushLog(`# choose ${state.scenarioId} → ${state.formatId}`);
    runScan(true);
    state.lastAction = "choose";
    renderAll();
  }

  function toggleDump() {
    state.dumpOn = !state.dumpOn;
    pushTrace(`dump: ${state.dumpOn ? "ON" : "OFF"}`);
    pushLog(`# dump ${state.dumpOn ? "ON" : "OFF"}`);
    runScan(true);
    state.lastAction = "dump";
    renderAll();
  }

  function demo() {
    applyPreset("mismatch", "demo");
    state.demoed = true;
    pushLog("# demo farm→VCD MISMATCH");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain formats");
    pushTrace("explain: VCD portable · FST compact · viewer separate");
    renderAll();
  }

  function selectScenario(id) {
    state.scenarioId = id;
    state.lastAction = "select-scenario";
    state.lastScanned = false;
    renderAll();
  }

  function selectFormat(id) {
    state.formatId = id;
    state.lastAction = "select-format";
    state.lastScanned = false;
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const sc = SCENARIOS.find((s) => s.id === state.scenarioId);
    const fm = FORMATS.find((f) => f.id === state.formatId);
    const sug = suggest(state.scenarioId);

    document.getElementById("chain-box").innerHTML = `${
      state.dumpOn ? "dump ON" : '<span class="gap">dump OFF</span>'
    } · ${sc ? sc.label : '<span class="gap">?scenario</span>'} → ${
      fm ? fm.label : '<span class="gap">?format</span>'
    }`;

    document.getElementById("compare-table").innerHTML = `
      <thead><tr><th></th><th>VCD</th><th>FST</th></tr></thead>
      <tbody>
        <tr><th>shape</th><td class="${state.formatId === "vcd" ? "is-hit" : ""}">text</td><td class="${state.formatId === "fst" ? "is-hit" : ""}">binary</td></tr>
        <tr><th>size</th><td class="${state.formatId === "vcd" ? "is-hit" : ""}">larger</td><td class="${state.formatId === "fst" ? "is-hit" : ""}">compact</td></tr>
        <tr><th>best for</th><td class="${state.formatId === "vcd" ? "is-hit" : ""}">short / share</td><td class="${state.formatId === "fst" ? "is-hit" : ""}">long / wide</td></tr>
      </tbody>`;

    document.getElementById("scenario-row").innerHTML = SCENARIOS.map((s) => {
      const on = state.scenarioId === s.id;
      return `<button type="button" class="pick-card ${on ? "is-sel is-on" : ""}" data-scenario="${s.id}">
        <div class="k">→ ${s.suggest.toUpperCase()}</div>
        <div class="v">${s.label}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-scenario]").forEach((el) => {
      el.addEventListener("click", () =>
        selectScenario(/** @type {string} */ (el.getAttribute("data-scenario")))
      );
    });

    document.getElementById("format-row").innerHTML = FORMATS.map((f) => {
      const on = state.formatId === f.id;
      const hit = sug && sug === f.id;
      return `<button type="button" class="pick-card ${on ? "is-sel is-on" : ""}" data-format="${f.id}">
        <div class="k">${hit ? "suggested" : "format"}</div>
        <div class="v">${f.label}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-format]").forEach((el) => {
      el.addEventListener("click", () =>
        selectFormat(/** @type {string} */ (el.getAttribute("data-format")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Pick a scenario and format, enable dump, then Choose / Scan.";
    if (sc && state.lastAction === "select-scenario") blurb = sc.blurb;
    else if (fm && state.lastAction === "select-format") blurb = fm.blurb;
    else if (sc && fm) blurb = `${sc.label} → ${fm.label}. Suggest ${sug?.toUpperCase()}.`;
    else if (sc) blurb = sc.blurb;
    else if (fm) blurb = fm.blurb;
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
      <span class="flag ${state.dumpOn ? "is-ok" : "is-bad"}">dump=${state.dumpOn ? 1 : 0}</span>
      <span class="flag is-ok">scenario=${state.scenarioId || "—"}</span>
      <span class="flag is-ok">format=${state.formatId || "—"}</span>
      <span class="flag is-ok">suggest=${sug || "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          scenarioId: state.scenarioId,
          formatId: state.formatId,
          dumpOn: state.dumpOn,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-vcd",
      title: "Quiz: VCD",
      type: "quiz",
      prompt: "VCD is best described as…",
      hint: "Text.",
      choices: [
        "a portable text value-change dump — larger, easy to share/grep",
        "a place-and-route database",
        "GTKWave itself",
        "only a Verilator C++ header",
      ],
      answer:
        "a portable text value-change dump — larger, easy to share/grep",
    },
    {
      id: "quiz-fst",
      title: "Quiz: FST",
      type: "quiz",
      prompt: "FST is preferred when…",
      hint: "Compact.",
      choices: [
        "dumps are long or wide — compact binary saves space/time",
        "you need a Makefile PHONY",
        "you never enable tracing",
        "coverage replaces waves",
      ],
      answer:
        "dumps are long or wide — compact binary saves space/time",
    },
    {
      id: "quiz-viewer",
      title: "Quiz: viewer",
      type: "quiz",
      prompt: "GTKWave in this lab is…",
      hint: "Separate.",
      choices: [
        "out of scope — this lab teaches dump format roles, not the viewer UI",
        "required to write VCD",
        "the same as FST",
        "a compile stage",
      ],
      answer:
        "out of scope — this lab teaches dump format roles, not the viewer UI",
    },
    {
      id: "quiz-matched",
      title: "Quiz: MATCHED",
      type: "quiz",
      prompt: "MATCHED means…",
      hint: "Fit.",
      choices: [
        "dump is on and the format fits the chosen scenario",
        "CI failed once",
        "elaborate was skipped",
        "only VCD is ever allowed",
      ],
      answer:
        "dump is on and the format fits the chosen scenario",
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
      id: "load-quick",
      title: "Load quick VCD",
      prompt: "Load quick → VCD — MATCHED.",
      hint: "quick → VCD → Load",
      setup: () => {
        selPreset.value = "quick_vcd";
        loadPreset();
      },
      check: () =>
        state.ready &&
        state.formatId === "vcd" &&
        state.lastAction === "load",
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load farm → VCD — MISMATCH.",
      hint: "farm → VCD → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.status === "MISMATCH" && !state.ready,
    },
    {
      id: "load-nodump",
      title: "Load dump off",
      prompt: "Load dump off — NEED_DUMP.",
      hint: "dump off → Load",
      setup: () => {
        selPreset.value = "no_dump";
        loadPreset();
      },
      check: () =>
        state.status === "NEED_DUMP" && !state.dumpOn,
    },
    {
      id: "load-empty",
      title: "Load no format",
      prompt: "Load no format — NEED_FORMAT.",
      hint: "no format → Load",
      setup: () => {
        selPreset.value = "empty_fmt";
        loadPreset();
      },
      check: () =>
        state.status === "NEED_FORMAT" && !state.formatId,
    },
    {
      id: "choose",
      title: "Choose",
      prompt: "From dump off, Choose farm+FST — MATCHED.",
      hint: "dump off → Choose",
      setup: () => {
        selPreset.value = "no_dump";
        loadPreset();
        state.scenarioId = "farm";
        state.formatId = "fst";
        choose();
      },
      check: () =>
        state.dumpOn &&
        state.ready &&
        state.lastAction === "choose",
    },
    {
      id: "select-scenario",
      title: "Select scenario",
      prompt: "Click portable_share.",
      hint: "Click portable_share",
      setup: () => {
        loadStarter();
        selectScenario("share");
      },
      check: () =>
        state.scenarioId === "share" &&
        state.lastAction === "select-scenario",
    },
    {
      id: "select-format",
      title: "Select format",
      prompt: "Click VCD.",
      hint: "Click VCD",
      setup: () => {
        loadStarter();
        selectFormat("vcd");
      },
      check: () =>
        state.formatId === "vcd" &&
        state.lastAction === "select-format",
    },
    {
      id: "toggle-dump",
      title: "Toggle dump",
      prompt: "On starter, Toggle dump off — NEED_DUMP.",
      hint: "Toggle dump",
      setup: () => {
        loadStarter();
        toggleDump();
      },
      check: () =>
        !state.dumpOn &&
        state.status === "NEED_DUMP" &&
        state.lastAction === "dump",
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
      prompt: "On farm→VCD, Scan — MISMATCH.",
      hint: "farm → VCD → Scan",
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
      prompt: "Literacy sketch mentions MATCHED or FST.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /MATCHED|FST/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Dump sketch",
      prompt: "On starter, dump sketch shows MATCHED.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /MATCHED/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "suggest-farm",
      title: "Suggest farm",
      prompt: "long_farm suggestion is fst.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => suggest("farm") === "fst",
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
      prompt: "From dump off, Reset — MATCHED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "no_dump";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="wvd-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("wvd-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-choose").addEventListener("click", () => choose());
  document.getElementById("btn-dump").addEventListener("click", () => toggleDump());
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
        state.formatId = saved.formatId || null;
        state.dumpOn = !!saved.dumpOn;
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
