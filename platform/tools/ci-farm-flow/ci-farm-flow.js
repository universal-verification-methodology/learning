(() => {
  /**
   * CI / farm regression flow (concept)
   *   local → CI → farm stages
   * Starter: all three pass — flow READY
   */

  const STAGES = [
    {
      id: "local",
      label: "local",
      suite: "sanity / smoke",
      blurb: "Developer laptop: fast sanity before push.",
    },
    {
      id: "ci",
      label: "ci",
      suite: "PR gate / nightly slice",
      blurb: "CI agent: merge gate or scheduled slice.",
    },
    {
      id: "farm",
      label: "farm",
      suite: "full / stress parallel",
      blurb: "Simulation farm: scale-out regression & soak.",
    },
  ];

  const STATUSES = [
    {
      id: "pass",
      label: "pass",
      blurb: "Stage completed green — may advance.",
    },
    {
      id: "open",
      label: "open",
      blurb: "Not run yet — flow incomplete.",
    },
    {
      id: "fail",
      label: "fail",
      blurb: "Stage red — blocks promotion to later stages.",
    },
    {
      id: "skip",
      label: "skip",
      blurb: "Skipped — breaks the local→CI→farm chain for full flow.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: all pass",
      marks: { local: "pass", ci: "pass", farm: "pass" },
      selStage: "local",
      selStatus: "pass",
      note: "Local → CI → farm all green — flow READY.",
      autoScan: true,
    },
    local_fail: {
      label: "local fail",
      marks: { local: "fail", ci: "open", farm: "open" },
      selStage: "local",
      selStatus: "pass",
      note: "Local sanity failed — do not promote to CI.",
      autoScan: true,
    },
    ci_open: {
      label: "CI still open",
      marks: { local: "pass", ci: "open", farm: "open" },
      selStage: "ci",
      selStatus: "pass",
      note: "Local green; CI gate not run — OPEN.",
      autoScan: true,
    },
    skip_ci: {
      label: "skip CI",
      marks: { local: "pass", ci: "skip", farm: "pass" },
      selStage: "ci",
      selStatus: "pass",
      note: "Farm without CI gate — GAPPED chain.",
      autoScan: true,
    },
    all_open: {
      label: "all open",
      marks: { local: "open", ci: "open", farm: "open" },
      selStage: "local",
      selStatus: "pass",
      note: "Empty pipeline — nothing executed.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      marks: { local: "open", ci: "open", farm: "open" },
      selStage: null,
      selStatus: null,
      note: "Idle — select a stage and status, then Set stage.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// CI / farm regression flow literacy (document aid)
//
// Promote work through stages:
//
//   local  →  CI  →  farm
//   smoke     gate    scale
//
// local = developer sanity before push
// ci    = PR / nightly merge gate
// farm  = large parallel / stress regression
//
// READY  = local+ci+farm all pass (in order)
// OPEN   = a required stage still open
// BLOCKED= any fail (stop promotion)
// GAPPED = skip breaks the chain
//
// Pair with seed-tags and regression-triage.`;
  }

  function openCount(marks) {
    return STAGES.filter((s) => (marks[s.id] || "open") === "open").length;
  }

  function failCount(marks) {
    return STAGES.filter((s) => marks[s.id] === "fail").length;
  }

  function skipCount(marks) {
    return STAGES.filter((s) => marks[s.id] === "skip").length;
  }

  function countStatus(marks, id) {
    return STAGES.filter((s) => marks[s.id] === id).length;
  }

  function evaluate(marks) {
    const fails = failCount(marks);
    if (fails > 0) {
      return {
        status: "BLOCKED",
        ready: false,
        reason: `${fails} stage fail(s) — stop promotion`,
      };
    }
    const skips = skipCount(marks);
    if (skips > 0) {
      return {
        status: "GAPPED",
        ready: false,
        reason: `${skips} stage skip(s) — chain broken`,
      };
    }
    const open = openCount(marks);
    if (open > 0) {
      return {
        status: "OPEN",
        ready: false,
        reason: `${open} stage(s) still open`,
      };
    }
    return {
      status: "READY",
      ready: true,
      reason: "local → CI → farm all pass",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.marks);
    return {
      preset: "starter",
      marks: { ...p.marks },
      selStage: p.selStage,
      selStatus: p.selStatus,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: READY open=0 fail=0"],
    };
  }

  const CLEARED_KEY = "ddv-ci-farm-flow-cleared-v1";
  const STORE_KEY = "ddv-ci-farm-flow-session-v1";

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

  const root = document.getElementById("cif-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>local</code> → <code>ci</code> → <code>farm</code>
        all <strong>pass</strong> — flow READY.</p>
      <button type="button" class="btn btn-secondary" id="cif-starter">Load starter example</button>
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
        <div class="idea-card"><h3>local</h3><p>Laptop sanity / smoke before push.</p></div>
        <div class="idea-card"><h3>CI</h3><p>PR gate or scheduled nightly slice.</p></div>
        <div class="idea-card"><h3>farm</h3><p>Scale-out full / stress regression.</p></div>
        <div class="idea-card"><h3>READY</h3><p>All three pass — chain complete.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="cif-controls">
        <div class="cif-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>all pass</option>
            <option value="local_fail">local fail</option>
            <option value="ci_open">CI still open</option>
            <option value="skip_ci">skip CI</option>
            <option value="all_open">all open</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-set">Set stage</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan flow</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo gap</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="cif-layout">
        <div class="panel-box">
          <h3>Pipeline</h3>
          <div class="pipe-row" id="pipe-row"></div>
          <h3>Status marks</h3>
          <div class="status-row" id="status-row"></div>
          <h3>Stages</h3>
          <ul class="stage-list" id="stage-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Flow sketch</h3>
          <pre class="flow-box" id="flow-box"></pre>
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

  function flowSketch() {
    const lines = STAGES.map((s) => {
      const m = state.marks[s.id] || "open";
      return `${s.label.padEnd(8)} ${m.padEnd(6)} (${s.suite})`;
    });
    return `# regression flow
${lines.join("\n")}
# chain:  local → ci → farm
# open:   ${openCount(state.marks)}
# fail:   ${failCount(state.marks)}
# skip:   ${skipCount(state.marks)}
# status: ${state.lastScanned ? state.status : "— (Scan flow)"}
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
    pushLog("# starter READY");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.marks);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(
      `scan: ${ev.status} open=${openCount(state.marks)} fail=${failCount(state.marks)}`
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
    state.marks = { ...p.marks };
    state.selStage = p.selStage;
    state.selStatus = p.selStatus;
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

  function setStage() {
    if (!state.selStage || !state.selStatus) {
      state.lastAction = "set-bad";
      pushLog("# set FAIL (need stage + status)");
      renderAll();
      return;
    }
    state.marks[state.selStage] = state.selStatus;
    pushTrace(`set: ${state.selStage} → ${state.selStatus}`);
    pushLog(`# set ${state.selStage} → ${state.selStatus}`);
    runScan(true);
    state.lastAction = "set";
    renderAll();
  }

  function demo() {
    applyPreset("skip_ci", "demo");
    state.demoed = true;
    pushLog("# demo skip CI GAPPED");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain flow");
    pushTrace("explain: local→ci→farm → READY if all pass");
    renderAll();
  }

  function selectStage(id) {
    state.selStage = id;
    state.lastAction = "select-stage";
    renderAll();
  }

  function selectStatus(id) {
    state.selStatus = id;
    state.lastAction = "select-status";
    renderAll();
  }

  function tagClass(m) {
    if (m === "pass") return "is-pass";
    if (m === "fail") return "is-fail";
    if (m === "skip") return "is-skip";
    return "is-open";
  }

  function renderLab() {
    syncInputs();
    const stage = STAGES.find((s) => s.id === state.selStage);
    const st = STATUSES.find((s) => s.id === state.selStatus);

    document.getElementById("pipe-row").innerHTML = STAGES.map((s, i) => {
      const m = state.marks[s.id] || "open";
      const sel = state.selStage === s.id;
      const arrow =
        i < STAGES.length - 1
          ? `<div class="pipe-arrow" aria-hidden="true">→</div>`
          : "";
      return `<button type="button" class="pipe-stage ${sel ? "is-sel" : ""}" data-pipe="${s.id}">
        <div class="k">${s.suite}</div>
        <div class="v">${s.label}</div>
        <div class="s">${m}</div>
      </button>${arrow}`;
    }).join("");
    document.querySelectorAll("[data-pipe]").forEach((el) => {
      el.addEventListener("click", () =>
        selectStage(/** @type {string} */ (el.getAttribute("data-pipe")))
      );
    });

    document.getElementById("status-row").innerHTML = STATUSES.map((s) => {
      const n = countStatus(state.marks, s.id);
      const on = state.selStatus === s.id;
      return `<button type="button" class="status-card ${on ? "is-sel" : ""}" data-status="${s.id}">
        <div class="k">${s.label} · ${n}</div>
        <div class="v">${s.id}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-status]").forEach((el) => {
      el.addEventListener("click", () =>
        selectStatus(/** @type {string} */ (el.getAttribute("data-status")))
      );
    });

    document.getElementById("stage-list").innerHTML = STAGES.map((s) => {
      const m = state.marks[s.id] || "open";
      const sel = state.selStage === s.id;
      return `<li class="${sel ? "is-sel" : ""}" data-stage="${s.id}">
        <span class="id">${s.label}</span>
        <span class="tag">${s.suite}</span>
        <span class="tag ${tagClass(m)}">${m.toUpperCase()}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-stage]").forEach((el) => {
      el.addEventListener("click", () =>
        selectStage(/** @type {string} */ (el.getAttribute("data-stage")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a stage, pick a status, then Set stage.";
    if (stage && state.lastAction === "select-stage") blurb = stage.blurb;
    else if (st && state.lastAction === "select-status") blurb = st.blurb;
    else if (stage && st) blurb = `${stage.label} → ${st.label}. ${stage.blurb}`;
    else if (stage) blurb = stage.blurb;
    else if (st) blurb = st.blurb;
    document.getElementById("role-blurb").textContent = blurb;
    document.getElementById("flow-box").textContent = flowSketch();
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
      v.textContent = "Idle — Load preset, Set stage, or Scan flow";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Flow READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const openN = openCount(state.marks);
    const failN = failCount(state.marks);
    const skipN = skipCount(state.marks);
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${openN ? "is-bad" : "is-ok"}">open=${openN}</span>
      <span class="flag ${failN ? "is-bad" : "is-ok"}">fail=${failN}</span>
      <span class="flag ${skipN ? "is-bad" : "is-ok"}">skip=${skipN}</span>
      <span class="flag is-ok">pass=${countStatus(state.marks, "pass")}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          marks: state.marks,
          selStage: state.selStage,
          selStatus: state.selStatus,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-local",
      title: "Quiz: local",
      type: "quiz",
      prompt: "The local stage is for…",
      hint: "Laptop.",
      choices: [
        "fast developer sanity / smoke before pushing",
        "only farm-scale soak",
        "replacing the scoreboard",
        "synthesis area reports",
      ],
      answer: "fast developer sanity / smoke before pushing",
    },
    {
      id: "quiz-ci",
      title: "Quiz: CI",
      type: "quiz",
      prompt: "CI typically runs…",
      hint: "Gate.",
      choices: [
        "a PR merge gate or scheduled nightly slice",
        "only interactive GTKWave clicks",
        "place-and-route",
        "font lint",
      ],
      answer: "a PR merge gate or scheduled nightly slice",
    },
    {
      id: "quiz-farm",
      title: "Quiz: farm",
      type: "quiz",
      prompt: "The farm stage provides…",
      hint: "Scale.",
      choices: [
        "scale-out full / stress parallel regressions",
        "a single local compile only",
        "Makefile PHONY targets",
        "UART baud tables",
      ],
      answer: "scale-out full / stress parallel regressions",
    },
    {
      id: "quiz-ready",
      title: "Quiz: READY",
      type: "quiz",
      prompt: "Flow READY means…",
      hint: "All pass.",
      choices: [
        "local, CI, and farm all pass with no skips or fails",
        "CI ran once with failures ignored",
        "farm ran without local",
        "coverage is ignored",
      ],
      answer:
        "local, CI, and farm all pass with no skips or fails",
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
      id: "load-fail",
      title: "Load local fail",
      prompt: "Load local fail — BLOCKED.",
      hint: "local fail → Load",
      setup: () => {
        selPreset.value = "local_fail";
        loadPreset();
      },
      check: () =>
        state.status === "BLOCKED" &&
        !state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-open",
      title: "Load CI open",
      prompt: "Load CI still open — OPEN.",
      hint: "CI still open → Load",
      setup: () => {
        selPreset.value = "ci_open";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" && state.marks.ci === "open",
    },
    {
      id: "load-gap",
      title: "Load skip CI",
      prompt: "Load skip CI — GAPPED.",
      hint: "skip CI → Load",
      setup: () => {
        selPreset.value = "skip_ci";
        loadPreset();
      },
      check: () =>
        state.status === "GAPPED" && state.marks.ci === "skip",
    },
    {
      id: "load-all-open",
      title: "Load all open",
      prompt: "Load all open — open=3.",
      hint: "all open → Load",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
      },
      check: () =>
        openCount(state.marks) === 3 && state.status === "OPEN",
    },
    {
      id: "set",
      title: "Set stage",
      prompt: "From CI open, Set ci → pass (farm still open) — OPEN.",
      hint: "CI still open → Set stage",
      setup: () => {
        selPreset.value = "ci_open";
        loadPreset();
        state.selStage = "ci";
        state.selStatus = "pass";
        setStage();
      },
      check: () =>
        state.marks.ci === "pass" &&
        state.marks.farm === "open" &&
        state.status === "OPEN" &&
        state.lastAction === "set",
    },
    {
      id: "select-stage",
      title: "Select stage",
      prompt: "Click the farm stage row.",
      hint: "Click farm",
      setup: () => {
        loadStarter();
        selectStage("farm");
      },
      check: () =>
        state.selStage === "farm" &&
        state.lastAction === "select-stage",
    },
    {
      id: "select-status",
      title: "Select status",
      prompt: "Click the fail status card.",
      hint: "Click fail",
      setup: () => {
        loadStarter();
        selectStatus("fail");
      },
      check: () =>
        state.selStatus === "fail" &&
        state.lastAction === "select-status",
    },
    {
      id: "scan-ok",
      title: "Scan READY",
      prompt: "On starter, Scan flow — READY.",
      hint: "Scan flow",
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
      prompt: "On all open, Scan — OPEN.",
      hint: "all open → Scan",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo gap",
      prompt: "Click Demo gap.",
      hint: "Demo gap",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "GAPPED" &&
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
      prompt: "Literacy sketch mentions READY or farm.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /READY|farm/i.test(sourceSketch()),
    },
    {
      id: "flow-sketch",
      title: "Flow sketch",
      prompt: "On starter, flow sketch shows READY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /READY/.test(document.getElementById("flow-box").textContent),
    },
    {
      id: "open-zero",
      title: "Open zero",
      prompt: "Starter open count is 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => openCount(state.marks) === 0,
    },
    {
      id: "all-pass",
      title: "All pass",
      prompt: "Starter has pass=3.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => countStatus(state.marks, "pass") === 3,
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
      prompt: "From all open, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "all_open";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="cif-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("cif-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-set").addEventListener("click", () => setStage());
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
        state.marks = saved.marks || state.marks;
        state.selStage = saved.selStage || null;
        state.selStatus = saved.selStatus || null;
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
