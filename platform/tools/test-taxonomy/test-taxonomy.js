(() => {
  /**
   * Test taxonomy planner (concept)
   *   directed / random / stress / corner tiers
   * Starter: one test per tier — plan BALANCED
   */

  const TESTS = [
    {
      id: "uart_byte",
      label: "uart_byte",
      blurb: "Send one known byte — classic directed feature check.",
    },
    {
      id: "uart_stream",
      label: "uart_stream",
      blurb: "Constrained-random byte stream — explore legal space.",
    },
    {
      id: "fifo_soak",
      label: "fifo_soak",
      blurb: "Long backpressure / fill-drain soak — stress the pipe.",
    },
    {
      id: "parity_bad",
      label: "parity_bad",
      blurb: "Illegal parity / framing — corner / negative case.",
    },
  ];

  const TIERS = [
    {
      id: "directed",
      label: "directed",
      blurb: "Hand-crafted stimulus for a known scenario or requirement.",
    },
    {
      id: "random",
      label: "random",
      blurb: "Constrained-random legal traffic — breadth over the space.",
    },
    {
      id: "stress",
      label: "stress",
      blurb: "Long-run / backlog / concurrent pressure — stability & perf.",
    },
    {
      id: "corner",
      label: "corner",
      blurb: "Illegal, boundary, or rare sequences — negative & edge cases.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: one per tier",
      tiers: {
        uart_byte: "directed",
        uart_stream: "random",
        fifo_soak: "stress",
        parity_bad: "corner",
      },
      selTest: "uart_byte",
      selTier: "directed",
      note: "One test per tier — plan BALANCED.",
      autoScan: true,
    },
    missing: {
      label: "one untyped",
      tiers: {
        uart_byte: "directed",
        uart_stream: "random",
        fifo_soak: "stress",
        parity_bad: "open",
      },
      selTest: "parity_bad",
      selTier: "corner",
      note: "parity_bad still open — classify it.",
      autoScan: true,
    },
    all_open: {
      label: "all open",
      tiers: {
        uart_byte: "open",
        uart_stream: "open",
        fifo_soak: "open",
        parity_bad: "open",
      },
      selTest: "uart_byte",
      selTier: "directed",
      note: "Empty catalogue — nothing classified yet.",
      autoScan: true,
    },
    all_directed: {
      label: "all directed",
      tiers: {
        uart_byte: "directed",
        uart_stream: "directed",
        fifo_soak: "directed",
        parity_bad: "directed",
      },
      selTest: "uart_byte",
      selTier: "directed",
      note: "All directed — classified but SKEWED (missing tiers).",
      autoScan: true,
    },
    no_corner: {
      label: "no corner",
      tiers: {
        uart_byte: "directed",
        uart_stream: "random",
        fifo_soak: "stress",
        parity_bad: "random",
      },
      selTest: "parity_bad",
      selTier: "corner",
      note: "No corner tier — SKEWED (negative gaps).",
      autoScan: true,
    },
    idle: {
      label: "idle",
      tiers: {
        uart_byte: "open",
        uart_stream: "open",
        fifo_soak: "open",
        parity_bad: "open",
      },
      selTest: null,
      selTier: null,
      note: "Idle — select a test and tier, then Classify.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Test taxonomy planner literacy (document aid)
//
// 1. List tests in the catalogue
// 2. Assign each a tier: directed | random | stress | corner
// 3. Prefer coverage across tiers (not all directed)
// 4. Scan → BALANCED when open=0 and all four tiers present
//
// directed = known scenario / requirement depth
// random   = constrained-random legal space
// stress   = long-run / backlog pressure
// corner   = illegal / boundary / negative
//
// OPEN     = untyped rows remain
// SKEWED   = typed but missing a tier
// BALANCED = complete + all four tiers
// Pair with feature-matrix and risk-plan.`;
  }

  function openCount(tiers) {
    return TESTS.filter((t) => (tiers[t.id] || "open") === "open").length;
  }

  function countTier(tiers, id) {
    return TESTS.filter((t) => tiers[t.id] === id).length;
  }

  function tierSet(tiers) {
    return new Set(
      TESTS.map((t) => tiers[t.id]).filter((x) => x && x !== "open")
    );
  }

  function evaluate(tiers) {
    const open = openCount(tiers);
    if (open > 0) {
      return {
        status: "OPEN",
        ready: false,
        reason: `${open} test(s) still untyped`,
      };
    }
    const set = tierSet(tiers);
    const need = TIERS.map((t) => t.id);
    const missing = need.filter((id) => !set.has(id));
    if (missing.length) {
      return {
        status: "SKEWED",
        ready: false,
        reason: `missing tier(s): ${missing.join(", ")}`,
      };
    }
    return {
      status: "BALANCED",
      ready: true,
      reason: "all tiers present, none open",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.tiers);
    return {
      preset: "starter",
      tiers: { ...p.tiers },
      selTest: p.selTest,
      selTier: p.selTier,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: BALANCED open=0"],
    };
  }

  const CLEARED_KEY = "ddv-test-taxonomy-cleared-v1";
  const STORE_KEY = "ddv-test-taxonomy-session-v1";

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

  const root = document.getElementById("ttx-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>uart_byte</code>→directed,
        <code>uart_stream</code>→random,
        <code>fifo_soak</code>→stress,
        <code>parity_bad</code>→corner —
        plan BALANCED.</p>
      <button type="button" class="btn btn-secondary" id="ttx-starter">Load starter example</button>
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
        <div class="idea-card"><h3>directed</h3><p>Known scenario / requirement depth.</p></div>
        <div class="idea-card"><h3>random</h3><p>Constrained-random legal breadth.</p></div>
        <div class="idea-card"><h3>stress</h3><p>Long-run / backlog pressure.</p></div>
        <div class="idea-card"><h3>corner</h3><p>Illegal / boundary / negative.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ttx-controls">
        <div class="ttx-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>one per tier</option>
            <option value="missing">one untyped</option>
            <option value="all_open">all open</option>
            <option value="all_directed">all directed</option>
            <option value="no_corner">no corner</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-classify">Classify</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan plan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo skew</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ttx-layout">
        <div class="panel-box">
          <h3>Tiers</h3>
          <div class="tier-row" id="tier-row"></div>
          <h3>Test catalogue</h3>
          <ul class="test-list" id="test-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Plan sketch</h3>
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
    const lines = TESTS.map((t) => {
      const tier = state.tiers[t.id] || "open";
      return `${t.label.padEnd(14)} ${tier}`;
    });
    return `# taxonomy
${lines.join("\n")}
# open:   ${openCount(state.tiers)}
# tiers:  ${[...tierSet(state.tiers)].join(", ") || "(none)"}
# status: ${state.lastScanned ? state.status : "— (Scan plan)"}
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
    pushLog("# starter BALANCED");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.tiers);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status} open=${openCount(state.tiers)}`);
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
    state.tiers = { ...p.tiers };
    state.selTest = p.selTest;
    state.selTier = p.selTier;
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

  function classify() {
    if (!state.selTest || !state.selTier) {
      state.lastAction = "classify-bad";
      pushLog("# classify FAIL (need test + tier)");
      renderAll();
      return;
    }
    state.tiers[state.selTest] = state.selTier;
    pushTrace(`classify: ${state.selTest} → ${state.selTier}`);
    pushLog(`# classify ${state.selTest} → ${state.selTier}`);
    runScan(true);
    state.lastAction = "classify";
    renderAll();
  }

  function demo() {
    applyPreset("all_directed", "demo");
    state.demoed = true;
    pushLog("# demo all_directed SKEWED");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain tiers");
    pushTrace("explain: directed|random|stress|corner → BALANCED");
    renderAll();
  }

  function selectTest(id) {
    state.selTest = id;
    state.lastAction = "select-test";
    renderAll();
  }

  function selectTier(id) {
    state.selTier = id;
    state.lastAction = "select-tier";
    renderAll();
  }

  function tagClass(tier) {
    if (tier === "open") return "is-open";
    if (tier === "directed") return "is-dir";
    if (tier === "random") return "is-rand";
    if (tier === "stress") return "is-stress";
    return "is-corner";
  }

  function renderLab() {
    syncInputs();
    const test = TESTS.find((t) => t.id === state.selTest);
    const tier = TIERS.find((t) => t.id === state.selTier);

    document.getElementById("tier-row").innerHTML = TIERS.map((t) => {
      const n = countTier(state.tiers, t.id);
      const on = state.selTier === t.id;
      return `<button type="button" class="tier-card ${on ? "is-sel" : ""}" data-tier="${t.id}">
        <div class="k">${t.label} · ${n}</div>
        <div class="v">${t.id}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-tier]").forEach((el) => {
      el.addEventListener("click", () =>
        selectTier(/** @type {string} */ (el.getAttribute("data-tier")))
      );
    });

    document.getElementById("test-list").innerHTML = TESTS.map((t) => {
      const tierId = state.tiers[t.id] || "open";
      const sel = state.selTest === t.id;
      return `<li class="${sel ? "is-sel" : ""}" data-test="${t.id}">
        <span class="id">${t.label}</span>
        <span class="tag ${tagClass(tierId)}">${tierId.toUpperCase()}</span>
        <span></span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-test]").forEach((el) => {
      el.addEventListener("click", () =>
        selectTest(/** @type {string} */ (el.getAttribute("data-test")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a test, pick a tier, then Classify.";
    if (test && state.lastAction === "select-test") blurb = test.blurb;
    else if (tier && state.lastAction === "select-tier") blurb = tier.blurb;
    else if (test && tier) blurb = `${test.label} → ${tier.label}. ${test.blurb}`;
    else if (test) blurb = test.blurb;
    else if (tier) blurb = tier.blurb;
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
      v.textContent = "Idle — Load preset, Classify, or Scan plan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Plan BALANCED — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const openN = openCount(state.tiers);
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${openN ? "is-bad" : "is-ok"}">open=${openN}</span>
      <span class="flag is-ok">dir=${countTier(state.tiers, "directed")}</span>
      <span class="flag is-ok">rand=${countTier(state.tiers, "random")}</span>
      <span class="flag is-ok">stress=${countTier(state.tiers, "stress")}</span>
      <span class="flag is-ok">corner=${countTier(state.tiers, "corner")}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          tiers: state.tiers,
          selTest: state.selTest,
          selTier: state.selTier,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-directed",
      title: "Quiz: directed",
      type: "quiz",
      prompt: "A directed test is…",
      hint: "Hand-crafted.",
      choices: [
        "hand-crafted stimulus for a known scenario or requirement",
        "only illegal opcodes",
        "a Makefile PHONY target",
        "always a multi-day soak",
      ],
      answer: "hand-crafted stimulus for a known scenario or requirement",
    },
    {
      id: "quiz-random",
      title: "Quiz: random",
      type: "quiz",
      prompt: "Constrained-random tests aim to…",
      hint: "Breadth.",
      choices: [
        "explore legal stimulus space with seeds / constraints",
        "replace all directed tests forever",
        "skip scoreboards",
        "only run once without seeds",
      ],
      answer: "explore legal stimulus space with seeds / constraints",
    },
    {
      id: "quiz-stress",
      title: "Quiz: stress",
      type: "quiz",
      prompt: "Stress tests emphasize…",
      hint: "Pressure.",
      choices: [
        "long-run / backlog / concurrent pressure for stability",
        "a single happy-path byte",
        "coverage bin names only",
        "synthesis lint rules",
      ],
      answer: "long-run / backlog / concurrent pressure for stability",
    },
    {
      id: "quiz-balanced",
      title: "Quiz: BALANCED",
      type: "quiz",
      prompt: "Plan BALANCED means…",
      hint: "All four.",
      choices: [
        "no open rows and all four tiers are present",
        "every test is directed",
        "CI is green only",
        "coverage is 100%",
      ],
      answer: "no open rows and all four tiers are present",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — BALANCED.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "BALANCED",
    },
    {
      id: "load-missing",
      title: "Load missing",
      prompt: "Load one untyped — OPEN.",
      hint: "one untyped → Load",
      setup: () => {
        selPreset.value = "missing";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" &&
        !state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-all-open",
      title: "Load all open",
      prompt: "Load all open — open=4.",
      hint: "all open → Load",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
      },
      check: () =>
        openCount(state.tiers) === 4 && state.status === "OPEN",
    },
    {
      id: "load-skew",
      title: "Load all directed",
      prompt: "Load all directed — SKEWED.",
      hint: "all directed → Load",
      setup: () => {
        selPreset.value = "all_directed";
        loadPreset();
      },
      check: () =>
        state.status === "SKEWED" &&
        countTier(state.tiers, "directed") === 4,
    },
    {
      id: "load-no-corner",
      title: "Load no corner",
      prompt: "Load no corner — SKEWED missing corner.",
      hint: "no corner → Load",
      setup: () => {
        selPreset.value = "no_corner";
        loadPreset();
      },
      check: () =>
        state.status === "SKEWED" &&
        /corner/.test(state.reason),
    },
    {
      id: "classify",
      title: "Classify",
      prompt: "From missing, Classify parity → corner — BALANCED.",
      hint: "one untyped → Classify",
      setup: () => {
        selPreset.value = "missing";
        loadPreset();
        state.selTest = "parity_bad";
        state.selTier = "corner";
        classify();
      },
      check: () =>
        state.tiers.parity_bad === "corner" &&
        state.ready &&
        state.lastAction === "classify",
    },
    {
      id: "select-test",
      title: "Select test",
      prompt: "Click fifo_soak row.",
      hint: "Click fifo_soak",
      setup: () => {
        loadStarter();
        selectTest("fifo_soak");
      },
      check: () =>
        state.selTest === "fifo_soak" &&
        state.lastAction === "select-test",
    },
    {
      id: "select-tier",
      title: "Select tier",
      prompt: "Click the stress tier card.",
      hint: "Click stress",
      setup: () => {
        loadStarter();
        selectTier("stress");
      },
      check: () =>
        state.selTier === "stress" &&
        state.lastAction === "select-tier",
    },
    {
      id: "scan-ok",
      title: "Scan BALANCED",
      prompt: "On starter, Scan plan — BALANCED.",
      hint: "Scan plan",
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
      title: "Demo skew",
      prompt: "Click Demo skew.",
      hint: "Demo skew",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "SKEWED" &&
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
      prompt: "Literacy sketch mentions BALANCED or corner.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /BALANCED|corner/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Plan sketch",
      prompt: "On starter, plan sketch shows BALANCED.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /BALANCED/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "open-zero",
      title: "Open zero",
      prompt: "Starter open count is 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => openCount(state.tiers) === 0,
    },
    {
      id: "starter-mix",
      title: "Starter mix",
      prompt: "Starter has one of each tier.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        countTier(state.tiers, "directed") === 1 &&
        countTier(state.tiers, "random") === 1 &&
        countTier(state.tiers, "stress") === 1 &&
        countTier(state.tiers, "corner") === 1,
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
      prompt: "From all open, Reset — BALANCED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "BALANCED",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ttx-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ttx-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-classify").addEventListener("click", () => classify());
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
        state.tiers = saved.tiers || state.tiers;
        state.selTest = saved.selTest || null;
        state.selTier = saved.selTier || null;
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
