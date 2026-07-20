(() => {
  /**
   * Verification metrics board (concept)
   *   pass rate, coverage %, bug escape
   * Starter: all bars met — board HEALTHY
   */

  const METRICS = [
    {
      id: "pass",
      label: "pass_rate",
      kind: "pass rate",
      unit: "%",
      bar: 95,
      higherBetter: true,
      blurb: "Fraction of regression jobs that pass — below the bar means instability.",
      levels: { good: 98, warn: 90, bad: 80 },
    },
    {
      id: "cov",
      label: "coverage_pct",
      kind: "coverage %",
      unit: "%",
      bar: 90,
      higherBetter: true,
      blurb: "Plan / functional coverage hit rate vs the agreed goal.",
      levels: { good: 95, warn: 85, bad: 70 },
    },
    {
      id: "escape",
      label: "bug_escape",
      kind: "bug escape",
      unit: "",
      bar: 0,
      higherBetter: false,
      blurb: "Sev-1 escapes found late / in silicon — bar is usually zero.",
      levels: { good: 0, warn: 1, bad: 3 },
    },
  ];

  const LEVELS = [
    { id: "good", label: "good", blurb: "At or above the healthy sample for this metric." },
    { id: "warn", label: "warn", blurb: "Borderline — may fail the bar depending on metric." },
    { id: "bad", label: "bad", blurb: "Clearly under / over the bar — board not healthy." },
  ];

  function valueOf(metric, levelId) {
    return metric.levels[levelId];
  }

  function meets(metric, levelId) {
    const v = valueOf(metric, levelId);
    if (metric.higherBetter) return v >= metric.bar;
    return v <= metric.bar;
  }

  const PRESETS = {
    starter: {
      label: "starter: all good",
      levels: { pass: "good", cov: "good", escape: "good" },
      selMetric: "pass",
      selLevel: "good",
      note: "Pass, coverage, and escapes all healthy — board HEALTHY.",
      autoScan: true,
    },
    low_pass: {
      label: "low pass rate",
      levels: { pass: "bad", cov: "good", escape: "good" },
      selMetric: "pass",
      selLevel: "good",
      note: "Pass rate under bar — OPEN.",
      autoScan: true,
    },
    escape_hit: {
      label: "bug escape",
      levels: { pass: "good", cov: "good", escape: "bad" },
      selMetric: "escape",
      selLevel: "good",
      note: "Bug escapes above bar — BLOCKED.",
      autoScan: true,
    },
    cov_warn: {
      label: "coverage warn",
      levels: { pass: "good", cov: "warn", escape: "good" },
      selMetric: "cov",
      selLevel: "good",
      note: "Coverage warn sample is below 90% bar — OPEN.",
      autoScan: true,
    },
    all_bad: {
      label: "all bad",
      levels: { pass: "bad", cov: "bad", escape: "bad" },
      selMetric: "pass",
      selLevel: "good",
      note: "Every metric fails its bar.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      levels: { pass: "warn", cov: "warn", escape: "warn" },
      selMetric: null,
      selLevel: null,
      note: "Idle — select a metric and level, then Apply.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Verification metrics board literacy (document aid)
//
// Track a few closure numbers — not a full BI tool:
//
//   pass_rate     % jobs green vs bar (e.g. ≥95%)
//   coverage_pct  plan / functional coverage vs bar (e.g. ≥90%)
//   bug_escape    late / field sev-1 count vs bar (usually 0)
//
// HEALTHY = every metric meets its bar
// OPEN    = under-bar on pass or coverage (fixable)
// BLOCKED = bug escapes above bar (stop the gate)
//
// Pair with signoff-checklist, coverage-closure, regression-triage.`;
  }

  function failEscape(levels) {
    const m = METRICS.find((x) => x.id === "escape");
    return !meets(m, levels.escape);
  }

  function openOthers(levels) {
    return METRICS.filter((m) => m.id !== "escape" && !meets(m, levels[m.id]))
      .length;
  }

  function evaluate(levels) {
    if (failEscape(levels)) {
      return {
        status: "BLOCKED",
        ready: false,
        reason: "bug escapes above bar — fix before sign-off",
      };
    }
    const open = openOthers(levels);
    if (open > 0) {
      return {
        status: "OPEN",
        ready: false,
        reason: `${open} metric(s) under bar`,
      };
    }
    return {
      status: "HEALTHY",
      ready: true,
      reason: "pass + coverage + escapes meet bars",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.levels);
    return {
      preset: "starter",
      levels: { ...p.levels },
      selMetric: p.selMetric,
      selLevel: p.selLevel,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: HEALTHY"],
    };
  }

  const CLEARED_KEY = "ddv-verif-metrics-cleared-v1";
  const STORE_KEY = "ddv-verif-metrics-session-v1";

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

  const root = document.getElementById("vmx-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        pass <code>98%</code>, coverage <code>95%</code>, escapes <code>0</code>
        — board HEALTHY.</p>
      <button type="button" class="btn btn-secondary" id="vmx-starter">Load starter example</button>
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
        <div class="idea-card"><h3>pass rate</h3><p>Regression green % vs bar.</p></div>
        <div class="idea-card"><h3>coverage %</h3><p>Plan hit rate vs goal.</p></div>
        <div class="idea-card"><h3>bug escape</h3><p>Late / field sev-1 count.</p></div>
        <div class="idea-card"><h3>HEALTHY</h3><p>Every metric meets its bar.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vmx-controls">
        <div class="vmx-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>all good</option>
            <option value="low_pass">low pass rate</option>
            <option value="escape_hit">bug escape</option>
            <option value="cov_warn">coverage warn</option>
            <option value="all_bad">all bad</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-apply">Apply level</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan board</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo escape</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vmx-layout">
        <div class="panel-box">
          <h3>Sample levels</h3>
          <div class="level-row" id="level-row"></div>
          <h3>Metrics</h3>
          <ul class="metric-list" id="metric-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <div class="bar" id="bar-box"><span style="width:0%"></span></div>
          <h3 style="margin-top:0.85rem">Board sketch</h3>
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
    const lines = METRICS.map((m) => {
      const lvl = state.levels[m.id];
      const v = valueOf(m, lvl);
      const ok = meets(m, lvl);
      return `${m.label.padEnd(14)} ${String(v).padStart(3)}${m.unit}  bar ${m.bar}${m.unit}  ${ok ? "OK" : "FAIL"} (${lvl})`;
    });
    return `# metrics board
${lines.join("\n")}
# status: ${state.lastScanned ? state.status : "— (Scan board)"}
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
    pushLog("# starter HEALTHY");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.levels);
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

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.levels = { ...p.levels };
    state.selMetric = p.selMetric;
    state.selLevel = p.selLevel;
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

  function applyLevel() {
    if (!state.selMetric || !state.selLevel) {
      state.lastAction = "apply-bad";
      pushLog("# apply FAIL (need metric + level)");
      renderAll();
      return;
    }
    state.levels[state.selMetric] = state.selLevel;
    pushTrace(`apply: ${state.selMetric} → ${state.selLevel}`);
    pushLog(`# apply ${state.selMetric} → ${state.selLevel}`);
    runScan(true);
    state.lastAction = "apply";
    renderAll();
  }

  function demo() {
    applyPreset("escape_hit", "demo");
    state.demoed = true;
    pushLog("# demo bug escape BLOCKED");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain metrics");
    pushTrace("explain: pass% · cov% · escapes → HEALTHY if bars met");
    renderAll();
  }

  function selectMetric(id) {
    state.selMetric = id;
    state.lastAction = "select-metric";
    renderAll();
  }

  function selectLevel(id) {
    state.selLevel = id;
    state.lastAction = "select-level";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const metric = METRICS.find((m) => m.id === state.selMetric);
    const level = LEVELS.find((l) => l.id === state.selLevel);

    document.getElementById("level-row").innerHTML = LEVELS.map((l) => {
      const on = state.selLevel === l.id;
      return `<button type="button" class="level-card ${on ? "is-sel" : ""}" data-level="${l.id}">
        <div class="k">${l.label}</div>
        <div class="v">${l.id}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-level]").forEach((el) => {
      el.addEventListener("click", () =>
        selectLevel(/** @type {string} */ (el.getAttribute("data-level")))
      );
    });

    document.getElementById("metric-list").innerHTML = METRICS.map((m) => {
      const lvl = state.levels[m.id];
      const v = valueOf(m, lvl);
      const ok = meets(m, lvl);
      const sel = state.selMetric === m.id;
      return `<li class="${sel ? "is-sel" : ""}" data-metric="${m.id}">
        <span class="id">${m.label}</span>
        <span class="tag">${v}${m.unit}</span>
        <span class="tag">bar ${m.bar}${m.unit}</span>
        <span class="tag ${ok ? "is-ok" : "is-bad"}">${ok ? "OK" : "FAIL"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-metric]").forEach((el) => {
      el.addEventListener("click", () =>
        selectMetric(/** @type {string} */ (el.getAttribute("data-metric")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a metric and sample level, then Apply level.";
    if (metric && state.lastAction === "select-metric") blurb = metric.blurb;
    else if (level && state.lastAction === "select-level") blurb = level.blurb;
    else if (metric && level) {
      const v = valueOf(metric, level.id);
      blurb = `${metric.label}=${v}${metric.unit} (${level.id}). ${metric.blurb}`;
    } else if (metric) blurb = metric.blurb;
    else if (level) blurb = level.blurb;
    document.getElementById("role-blurb").textContent = blurb;

    const bar = document.getElementById("bar-box");
    if (metric) {
      const lvl = state.levels[metric.id];
      const v = valueOf(metric, lvl);
      const pct = metric.higherBetter
        ? Math.min(100, v)
        : Math.max(0, 100 - v * 25);
      const ok = meets(metric, lvl);
      bar.className = `bar ${ok ? "" : "is-bad"}`.trim();
      bar.innerHTML = `<span style="width:${pct}%"></span>`;
    } else {
      bar.className = "bar";
      bar.innerHTML = `<span style="width:0%"></span>`;
    }

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
      v.textContent = "Idle — Load preset, Apply level, or Scan board";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Board HEALTHY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const failN = METRICS.filter((m) => !meets(m, state.levels[m.id])).length;
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${failN ? "is-bad" : "is-ok"}">fail=${failN}</span>
      <span class="flag is-ok">pass=${valueOf(METRICS[0], state.levels.pass)}%</span>
      <span class="flag is-ok">cov=${valueOf(METRICS[1], state.levels.cov)}%</span>
      <span class="flag is-ok">escape=${valueOf(METRICS[2], state.levels.escape)}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          levels: state.levels,
          selMetric: state.selMetric,
          selLevel: state.selLevel,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-pass",
      title: "Quiz: pass rate",
      type: "quiz",
      prompt: "Pass rate tracks…",
      hint: "Green jobs.",
      choices: [
        "the fraction of regression jobs that pass versus a bar",
        "only synthesis area",
        "GTKWave cursor count",
        "Makefile PHONY targets",
      ],
      answer:
        "the fraction of regression jobs that pass versus a bar",
    },
    {
      id: "quiz-cov",
      title: "Quiz: coverage",
      type: "quiz",
      prompt: "Coverage % on this board means…",
      hint: "Plan hit.",
      choices: [
        "plan / functional coverage hit rate versus an agreed goal",
        "VCD file size",
        "always 100% if CI is green",
        "lint warning count",
      ],
      answer:
        "plan / functional coverage hit rate versus an agreed goal",
    },
    {
      id: "quiz-escape",
      title: "Quiz: bug escape",
      type: "quiz",
      prompt: "Bug escape usually counts…",
      hint: "Late sev-1.",
      choices: [
        "late / field sev-1 defects that slipped past the gate",
        "passing directed tests",
        "plusarg length",
        "font choices",
      ],
      answer:
        "late / field sev-1 defects that slipped past the gate",
    },
    {
      id: "quiz-healthy",
      title: "Quiz: HEALTHY",
      type: "quiz",
      prompt: "Board HEALTHY means…",
      hint: "Bars.",
      choices: [
        "pass rate, coverage, and escapes all meet their bars",
        "CI ran once",
        "only coverage is tracked",
        "escapes are ignored",
      ],
      answer:
        "pass rate, coverage, and escapes all meet their bars",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — HEALTHY.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "HEALTHY",
    },
    {
      id: "load-pass",
      title: "Load low pass",
      prompt: "Load low pass rate — OPEN.",
      hint: "low pass rate → Load",
      setup: () => {
        selPreset.value = "low_pass";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" &&
        !state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-escape",
      title: "Load escape",
      prompt: "Load bug escape — BLOCKED.",
      hint: "bug escape → Load",
      setup: () => {
        selPreset.value = "escape_hit";
        loadPreset();
      },
      check: () =>
        state.status === "BLOCKED" && !state.ready,
    },
    {
      id: "load-cov",
      title: "Load coverage warn",
      prompt: "Load coverage warn — OPEN.",
      hint: "coverage warn → Load",
      setup: () => {
        selPreset.value = "cov_warn";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" && state.levels.cov === "warn",
    },
    {
      id: "load-all-bad",
      title: "Load all bad",
      prompt: "Load all bad — BLOCKED (escapes).",
      hint: "all bad → Load",
      setup: () => {
        selPreset.value = "all_bad";
        loadPreset();
      },
      check: () =>
        state.status === "BLOCKED" && state.levels.escape === "bad",
    },
    {
      id: "apply",
      title: "Apply level",
      prompt: "From low pass, Apply pass→good — HEALTHY.",
      hint: "low pass → Apply",
      setup: () => {
        selPreset.value = "low_pass";
        loadPreset();
        state.selMetric = "pass";
        state.selLevel = "good";
        applyLevel();
      },
      check: () =>
        state.levels.pass === "good" &&
        state.ready &&
        state.lastAction === "apply",
    },
    {
      id: "select-metric",
      title: "Select metric",
      prompt: "Click coverage_pct row.",
      hint: "Click coverage_pct",
      setup: () => {
        loadStarter();
        selectMetric("cov");
      },
      check: () =>
        state.selMetric === "cov" &&
        state.lastAction === "select-metric",
    },
    {
      id: "select-level",
      title: "Select level",
      prompt: "Click the warn level card.",
      hint: "Click warn",
      setup: () => {
        loadStarter();
        selectLevel("warn");
      },
      check: () =>
        state.selLevel === "warn" &&
        state.lastAction === "select-level",
    },
    {
      id: "scan-ok",
      title: "Scan HEALTHY",
      prompt: "On starter, Scan board — HEALTHY.",
      hint: "Scan board",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan OPEN",
      prompt: "On low pass, Scan — OPEN.",
      hint: "low pass → Scan",
      setup: () => {
        selPreset.value = "low_pass";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo escape",
      prompt: "Click Demo escape.",
      hint: "Demo escape",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "BLOCKED" &&
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
      prompt: "Literacy sketch mentions HEALTHY or escape.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /HEALTHY|escape/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Board sketch",
      prompt: "On starter, board sketch shows HEALTHY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /HEALTHY/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "bar-pass",
      title: "Pass bar",
      prompt: "Pass-rate bar is 95.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => METRICS.find((m) => m.id === "pass")?.bar === 95,
    },
    {
      id: "escape-bar",
      title: "Escape bar",
      prompt: "Bug-escape bar is 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => METRICS.find((m) => m.id === "escape")?.bar === 0,
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
      prompt: "From all bad, Reset — HEALTHY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "all_bad";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "HEALTHY",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vmx-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vmx-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-apply").addEventListener("click", () => applyLevel());
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
        state.levels = saved.levels || state.levels;
        state.selMetric = saved.selMetric || null;
        state.selLevel = saved.selLevel || null;
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
