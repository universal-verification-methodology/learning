(() => {
  /**
   * Coverage / plan checklist (concept)
   *   feature → scenario → coverage item mapping
   * Starter: UART TX → send one byte → tx_byte_done — COMPLETE
   */

  const LAYERS = [
    {
      id: "feature",
      title: "feature",
      blurb: "What the product must do (requirement / capability).",
    },
    {
      id: "scenario",
      title: "scenario",
      blurb: "How you exercise the feature in a test story.",
    },
    {
      id: "coverage",
      title: "coverage",
      blurb: "Measurable item (bin / coverpoint / checklist) that proves the scenario ran.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: UART TX linked",
      feature: "UART TX",
      scenario: "send one byte",
      coverage: "tx_byte_done",
      featureOn: true,
      scenarioOn: true,
      coverageOn: true,
      note: "Feature, scenario, and coverage item all present and linked — COMPLETE.",
      autoCheck: true,
    },
    no_cov: {
      label: "missing coverage",
      feature: "UART TX",
      scenario: "send one byte",
      coverage: "tx_byte_done",
      featureOn: true,
      scenarioOn: true,
      coverageOn: false,
      note: "Scenario exists but no coverage item — INCOMPLETE (unmeasurable).",
      autoCheck: true,
    },
    no_scenario: {
      label: "missing scenario",
      feature: "UART TX",
      scenario: "send one byte",
      coverage: "tx_byte_done",
      featureOn: true,
      scenarioOn: false,
      coverageOn: true,
      note: "Feature + cov without a scenario story — INCOMPLETE.",
      autoCheck: true,
    },
    orphan: {
      label: "orphan coverage",
      feature: "UART TX",
      scenario: "send one byte",
      coverage: "tx_byte_done",
      featureOn: false,
      scenarioOn: false,
      coverageOn: true,
      note: "Coverage with no feature/scenario — orphan item in the plan.",
      autoCheck: true,
    },
    spi: {
      label: "SPI transfer linked",
      feature: "SPI master",
      scenario: "mode0 byte xfer",
      coverage: "spi_xfer_done",
      featureOn: true,
      scenarioOn: true,
      coverageOn: true,
      note: "Same checklist shape for SPI — COMPLETE.",
      autoCheck: true,
    },
    empty: {
      label: "empty checklist",
      feature: "UART TX",
      scenario: "send one byte",
      coverage: "tx_byte_done",
      featureOn: false,
      scenarioOn: false,
      coverageOn: false,
      note: "Empty — toggle layers in, then Check plan.",
      autoCheck: false,
    },
  };

  function sourceSketch() {
    return `// Verification plan checklist literacy (document aid)
// Traceability chain:
//
//   feature   →  what must work
//   scenario  →  how we exercise it
//   coverage  →  what we measure when it ran
//
// COMPLETE  = feature ∧ scenario ∧ coverage all linked
// INCOMPLETE = any gap (untested feature, unmeasurable scenario, orphan bin)
//
// Not a coverage database — a planning checklist before / beside covergroups.`;
  }

  function isComplete(s) {
    return !!(s.featureOn && s.scenarioOn && s.coverageOn);
  }

  function gaps(s) {
    const miss = [];
    if (!s.featureOn) miss.push("feature");
    if (!s.scenarioOn) miss.push("scenario");
    if (!s.coverageOn) miss.push("coverage");
    return miss;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      feature: p.feature,
      scenario: p.scenario,
      coverage: p.coverage,
      featureOn: true,
      scenarioOn: true,
      coverageOn: true,
      note: p.note,
      selected: "feature",
      complete: true,
      lastChecked: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["check: COMPLETE feature→scenario→coverage"],
    };
  }

  const CLEARED_KEY = "ddv-verif-plan-check-cleared-v1";
  const STORE_KEY = "ddv-verif-plan-check-session-v1";

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

  const root = document.getElementById("vpc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>UART TX</code> → <code>send one byte</code> → <code>tx_byte_done</code> —
        plan chain COMPLETE.</p>
      <button type="button" class="btn btn-secondary" id="vpc-starter">Load starter example</button>
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
        <div class="idea-card"><h3>feature</h3><p>Capability / requirement to verify.</p></div>
        <div class="idea-card"><h3>scenario</h3><p>Test story that exercises it.</p></div>
        <div class="idea-card"><h3>coverage</h3><p>Measurable proof the scenario ran.</p></div>
        <div class="idea-card"><h3>traceability</h3><p>All three linked — no orphans or gaps.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vpc-controls">
        <div class="vpc-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>UART TX linked</option>
            <option value="no_cov">missing coverage</option>
            <option value="no_scenario">missing scenario</option>
            <option value="orphan">orphan coverage</option>
            <option value="spi">SPI linked</option>
            <option value="empty">empty</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-checkplan">Check plan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo gap</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vpc-layout">
        <div class="panel-box">
          <h3>Plan chain</h3>
          <div class="chain" id="chain-box"></div>
          <p style="margin:0 0 0.5rem;font-size:0.82rem;color:var(--muted)">Click a card to select; click again to toggle in/out of the checklist.</p>
          <div class="link-row" id="link-row"></div>
          <h3>Checklist</h3>
          <ul class="check-list" id="check-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Map sketch</h3>
          <pre class="map-box" id="map-box"></pre>
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

  function mapSketch() {
    const f = state.featureOn ? state.feature : "(missing feature)";
    const s = state.scenarioOn ? state.scenario : "(missing scenario)";
    const c = state.coverageOn ? state.coverage : "(missing coverage)";
    return `# plan row
# feature:   ${f}
# scenario:  ${s}
# coverage:  ${c}
#
# status: ${state.lastChecked ? (state.complete ? "COMPLETE" : "INCOMPLETE") : "— (Check plan)"}
# gaps:   ${gaps(state).join(", ") || "none"}`;
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
    pushLog("# starter UART TX linked COMPLETE");
    renderAll();
  }

  function checkPlan(silent) {
    state.complete = isComplete(state);
    state.lastChecked = true;
    const line = state.complete
      ? "check: COMPLETE feature→scenario→coverage"
      : `check: INCOMPLETE missing=${gaps(state).join(",")}`;
    pushTrace(line);
    if (!silent) {
      state.lastAction = state.complete ? "check-ok" : "check-bad";
      pushLog(`# check ${state.complete ? "COMPLETE" : "INCOMPLETE"}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.feature = p.feature;
    state.scenario = p.scenario;
    state.coverage = p.coverage;
    state.featureOn = p.featureOn;
    state.scenarioOn = p.scenarioOn;
    state.coverageOn = p.coverageOn;
    state.note = p.note;
    state.complete = false;
    state.lastChecked = false;
    syncInputs();
    if (p.autoCheck) {
      checkPlan(true);
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

  function demo() {
    applyPreset("no_cov", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo missing coverage gap");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: feature → scenario → coverage keeps the plan traceable; " +
        "gaps mean untested, unmeasurable, or orphan items."
    );
    renderAll();
  }

  function selectLayer(id) {
    if (state.selected === id) {
      const key = id + "On";
      state[key] = !state[key];
      state.lastChecked = false;
      state.complete = false;
      state.lastAction = "toggle";
      pushTrace(`toggle ${id}=${state[key] ? 1 : 0}`);
      pushLog(`# toggle ${id} ${state[key] ? "in" : "out"}`);
    } else {
      state.selected = id;
      state.lastAction = "select";
    }
    renderAll();
  }

  function layerValue(id) {
    if (id === "feature") return state.feature;
    if (id === "scenario") return state.scenario;
    return state.coverage;
  }

  function layerOn(id) {
    if (id === "feature") return state.featureOn;
    if (id === "scenario") return state.scenarioOn;
    return state.coverageOn;
  }

  function renderLab() {
    syncInputs();
    const parts = [
      state.featureOn ? state.feature : '<span class="gap">?</span>',
      state.scenarioOn ? state.scenario : '<span class="gap">?</span>',
      state.coverageOn ? state.coverage : '<span class="gap">?</span>',
    ];
    document.getElementById("chain-box").innerHTML = parts.join(" → ");

    document.getElementById("link-row").innerHTML = LAYERS.map((L) => {
      const on = layerOn(L.id);
      const sel = state.selected === L.id;
      return `<button type="button" class="link-card ${on ? "is-on" : "is-off"} ${sel ? "is-sel" : ""}" data-layer="${L.id}">
        <div class="k">${L.title}</div>
        <div class="v">${layerValue(L.id)}</div>
        <span class="tag">${on ? "IN" : "OUT"}</span>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-layer]").forEach((el) => {
      el.addEventListener("click", () =>
        selectLayer(/** @type {string} */ (el.getAttribute("data-layer")))
      );
    });

    document.getElementById("check-list").innerHTML = LAYERS.map((L) => {
      const on = layerOn(L.id);
      return `<li><span class="id">${L.id}</span><span class="${on ? "ok" : "bad"}">${on ? "OK" : "MISSING"}</span></li>`;
    }).join("");

    document.getElementById("meta-note").textContent = state.note;
    const sel = LAYERS.find((L) => L.id === state.selected) || LAYERS[0];
    document.getElementById("role-blurb").textContent = sel.blurb;
    document.getElementById("map-box").textContent = mapSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastChecked) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Check plan";
    } else if (state.complete) {
      v.className = "verdict yes";
      v.textContent = "Plan COMPLETE — feature → scenario → coverage linked";
    } else {
      v.className = "verdict no";
      v.textContent = `Plan INCOMPLETE — missing ${gaps(state).join(", ")}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.featureOn ? "is-ok" : "is-bad"}">feat=${state.featureOn ? 1 : 0}</span>
      <span class="flag ${state.scenarioOn ? "is-ok" : "is-bad"}">scen=${state.scenarioOn ? 1 : 0}</span>
      <span class="flag ${state.coverageOn ? "is-ok" : "is-bad"}">cov=${state.coverageOn ? 1 : 0}</span>
      <span class="flag ${state.complete && state.lastChecked ? "is-ok" : state.lastChecked ? "is-bad" : ""}">ok=${state.lastChecked ? (state.complete ? 1 : 0) : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          featureOn: state.featureOn,
          scenarioOn: state.scenarioOn,
          coverageOn: state.coverageOn,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-chain",
      title: "Quiz: chain",
      type: "quiz",
      prompt: "A plan checklist links…",
      hint: "Three layers.",
      choices: [
        "feature → scenario → coverage item",
        "only Makefile PHONY targets",
        "synthesis → place → route only",
        "+UVM_TESTNAME → seed only",
      ],
      answer: "feature → scenario → coverage item",
    },
    {
      id: "quiz-feature",
      title: "Quiz: feature",
      type: "quiz",
      prompt: "A feature in the plan is…",
      hint: "Capability.",
      choices: [
        "a product capability / requirement to verify",
        "a GTKWave cursor position",
        "a Verilator public pragma",
        "a random seed tag only",
      ],
      answer: "a product capability / requirement to verify",
    },
    {
      id: "quiz-cov",
      title: "Quiz: coverage",
      type: "quiz",
      prompt: "Coverage items in this checklist…",
      hint: "Measure.",
      choices: [
        "measure that the scenario actually ran (bin / coverpoint / check)",
        "replace the DUT RTL",
        "disable all agents",
        "compile the design",
      ],
      answer:
        "measure that the scenario actually ran (bin / coverpoint / check)",
    },
    {
      id: "quiz-gap",
      title: "Quiz: gap",
      type: "quiz",
      prompt: "A scenario with no coverage item means…",
      hint: "Unmeasurable.",
      choices: [
        "the plan cannot measure whether that story was exercised",
        "the feature is automatically signed off",
        "cocotb is required",
        "the scoreboard is deleted",
      ],
      answer:
        "the plan cannot measure whether that story was exercised",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — plan COMPLETE.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.complete &&
        state.lastChecked,
    },
    {
      id: "load-nocov",
      title: "Load no coverage",
      prompt: "Load missing coverage — INCOMPLETE.",
      hint: "missing coverage → Load",
      setup: () => {
        selPreset.value = "no_cov";
        loadPreset();
      },
      check: () =>
        !state.coverageOn &&
        !state.complete &&
        state.lastAction === "load",
    },
    {
      id: "load-noscen",
      title: "Load no scenario",
      prompt: "Load missing scenario — INCOMPLETE.",
      hint: "missing scenario → Load",
      setup: () => {
        selPreset.value = "no_scenario";
        loadPreset();
      },
      check: () => !state.scenarioOn && !state.complete,
    },
    {
      id: "load-orphan",
      title: "Load orphan",
      prompt: "Load orphan coverage — only cov on.",
      hint: "orphan coverage → Load",
      setup: () => {
        selPreset.value = "orphan";
        loadPreset();
      },
      check: () =>
        state.coverageOn &&
        !state.featureOn &&
        !state.scenarioOn,
    },
    {
      id: "load-spi",
      title: "Load SPI",
      prompt: "Load SPI linked — COMPLETE.",
      hint: "SPI linked → Load",
      setup: () => {
        selPreset.value = "spi";
        loadPreset();
      },
      check: () =>
        state.feature === "SPI master" && state.complete,
    },
    {
      id: "check-ok",
      title: "Check COMPLETE",
      prompt: "From empty, toggle all three in, Check plan — COMPLETE.",
      hint: "empty → toggle all → Check plan",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.featureOn = true;
        state.scenarioOn = true;
        state.coverageOn = true;
        checkPlan(false);
      },
      check: () =>
        state.complete && state.lastAction === "check-ok",
    },
    {
      id: "check-bad",
      title: "Check INCOMPLETE",
      prompt: "From orphan, Check plan — INCOMPLETE.",
      hint: "orphan → Check plan",
      setup: () => {
        selPreset.value = "orphan";
        applyPreset("orphan", null);
        state.lastChecked = false;
        checkPlan(false);
      },
      check: () =>
        !state.complete && state.lastAction === "check-bad",
    },
    {
      id: "toggle-out",
      title: "Toggle out",
      prompt: "On starter, toggle coverage out.",
      hint: "Click coverage twice",
      setup: () => {
        loadStarter();
        state.selected = "coverage";
        state.coverageOn = false;
        state.lastChecked = false;
        state.complete = false;
        state.lastAction = "toggle";
        pushTrace("toggle coverage=0");
        renderAll();
      },
      check: () =>
        !state.coverageOn && state.lastAction === "toggle",
    },
    {
      id: "toggle-in",
      title: "Toggle in",
      prompt: "From no_cov, toggle coverage back in.",
      hint: "Load no_cov → click coverage twice",
      setup: () => {
        selPreset.value = "no_cov";
        loadPreset();
        state.selected = "coverage";
        state.coverageOn = true;
        state.lastChecked = false;
        state.complete = false;
        state.lastAction = "toggle";
        pushTrace("toggle coverage=1");
        renderAll();
      },
      check: () =>
        state.coverageOn && state.lastAction === "toggle",
    },
    {
      id: "demo",
      title: "Demo gap",
      prompt: "Click Demo gap.",
      hint: "Demo gap",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.coverageOn &&
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
      id: "select-scen",
      title: "Select scenario",
      prompt: "Click the scenario layer card (select).",
      hint: "Click scenario once from another selection",
      setup: () => {
        loadStarter();
        state.selected = "feature";
        renderAll();
        selectLayer("scenario");
      },
      check: () =>
        state.selected === "scenario" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions traceability or COMPLETE.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /traceability|COMPLETE/i.test(sourceSketch()),
    },
    {
      id: "map-complete",
      title: "Map COMPLETE",
      prompt: "On starter, map sketch shows COMPLETE.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /COMPLETE/.test(document.getElementById("map-box").textContent),
    },
    {
      id: "gaps-list",
      title: "Gaps list",
      prompt: "On no_cov, gaps includes coverage.",
      hint: "missing coverage → Load",
      setup: () => {
        selPreset.value = "no_cov";
        loadPreset();
      },
      check: () => gaps(state).includes("coverage"),
    },
    {
      id: "all-three",
      title: "All three",
      prompt: "Starter has feature∧scenario∧coverage.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => isComplete(state),
    },
    {
      id: "empty-idle",
      title: "Load empty",
      prompt: "Load empty — not yet checked.",
      hint: "empty → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        !state.lastChecked &&
        !state.featureOn &&
        state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From empty, Reset — COMPLETE again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" && state.complete,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vpc-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vpc-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-checkplan").addEventListener("click", () => checkPlan(false));
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
      if (saved && typeof saved.featureOn === "boolean") {
        state.featureOn = saved.featureOn;
        state.scenarioOn = !!saved.scenarioOn;
        state.coverageOn = !!saved.coverageOn;
        state.preset = saved.preset || "starter";
        state.lastChecked = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
