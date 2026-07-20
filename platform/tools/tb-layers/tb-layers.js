(() => {
  /**
   * Testbench layer diagram (concept)
   *   test → env → agent(sqr/drv/mon) + scoreboard → vif → DUT
   * Starter: single active agent; scoreboard on analysis path
   */

  /** @typedef {"test"|"env"|"agent"|"sequencer"|"driver"|"monitor"|"scoreboard"|"vif"|"dut"} BlockId */

  const BLOCKS = {
    test: {
      title: "test",
      blurb: "Top verification component: builds the env, starts the default sequence.",
      path: ["test", "env", "agent", "sequencer", "driver", "vif", "dut"],
    },
    env: {
      title: "env",
      blurb: "Container for agents + scoreboard (and other analysis). Owns the TB structure.",
      path: ["env", "agent", "scoreboard"],
    },
    agent: {
      title: "agent",
      blurb: "Protocol unit: sequencer + driver (+ monitor). Active agents drive; passive only monitor.",
      path: ["agent", "sequencer", "driver", "monitor", "vif"],
    },
    sequencer: {
      title: "sequencer",
      blurb: "Arbitration point between sequences and the driver (TLM seq_item_port).",
      path: ["sequencer", "driver"],
    },
    driver: {
      title: "driver",
      blurb: "Consumes seq_items and wiggles pins through the virtual interface.",
      path: ["driver", "vif", "dut"],
    },
    monitor: {
      title: "monitor",
      blurb: "Passive observer: samples the bus and publishes transactions (analysis port).",
      path: ["dut", "vif", "monitor", "scoreboard"],
    },
    scoreboard: {
      title: "scoreboard",
      blurb: "Predict vs observe compare — usually subscribed to monitor analysis.",
      path: ["monitor", "scoreboard"],
    },
    vif: {
      title: "virtual interface",
      blurb: "Handle that lets class-based TB code touch DUT signals safely.",
      path: ["driver", "vif", "dut", "monitor"],
    },
    dut: {
      title: "DUT",
      blurb: "Design under test — not a UVM component; sits under the interface.",
      path: ["vif", "dut"],
    },
  };

  const PRESETS = {
    starter: {
      label: "starter: 1 agent + scoreboard",
      agents: 1,
      hasSb: true,
      active: true,
      selected: "agent",
      note: "Classic single-agent env with scoreboard on the analysis path.",
    },
    dual: {
      label: "dual agents (TX + RX)",
      agents: 2,
      hasSb: true,
      active: true,
      selected: "env",
      note: "Env can hold multiple agents; scoreboard still compares transactions.",
    },
    passive: {
      label: "passive agent (monitor only)",
      agents: 1,
      hasSb: true,
      active: false,
      selected: "monitor",
      note: "Passive agent: no driver/sequencer activity — observe only.",
    },
    no_sb: {
      label: "env without scoreboard",
      agents: 1,
      hasSb: false,
      active: true,
      selected: "env",
      note: "Legal but incomplete: stimulus without a compare layer.",
    },
  };

  function sourceSketch() {
    return `// UVM layer literacy (not a class library)
// test
//   └── env
//         ├── agent (active)
//         │     ├── sequencer  →  driver  →  vif  →  DUT
//         │     └── monitor    →  analysis  →  scoreboard
//         └── scoreboard
//
// Hierarchy: test builds env; env builds agent(s) + scoreboard.
// Stimulus path: sequence → sequencer → driver → vif → DUT
// Observe path:  DUT → vif → monitor → scoreboard
// Flat classic TB collapses these roles into one module.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      agents: p.agents,
      hasSb: p.hasSb,
      active: p.active,
      selected: /** @type {BlockId} */ (p.selected),
      note: p.note,
      pathMode: "stimulus",
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-tb-layers-cleared-v1";
  const STORE_KEY = "ddv-tb-layers-session-v1";

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

  const root = document.getElementById("tbl-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> one active agent under the env, with a
        scoreboard on the monitor analysis path — click <code>agent</code> to see roles.</p>
      <button type="button" class="btn btn-secondary" id="tbl-starter">Load starter example</button>
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
        <div class="idea-card"><h3>test → env</h3><p>Test builds the env; env owns agents and analysis.</p></div>
        <div class="idea-card"><h3>agent</h3><p>Bundles sequencer, driver, and monitor for one protocol.</p></div>
        <div class="idea-card"><h3>scoreboard</h3><p>Compares predicted vs observed transactions.</p></div>
        <div class="idea-card"><h3>vif → DUT</h3><p>Virtual interface is the bridge to pins.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="tbl-controls">
        <div class="tbl-field">
          <label for="sel-preset">Stack preset</label>
          <select id="sel-preset">
            <option value="starter" selected>1 agent + scoreboard</option>
            <option value="dual">dual agents</option>
            <option value="passive">passive agent</option>
            <option value="no_sb">no scoreboard</option>
          </select>
        </div>
        <div class="tbl-field">
          <label for="sel-path">Highlight path</label>
          <select id="sel-path">
            <option value="stimulus">stimulus (seq→DUT)</option>
            <option value="observe">observe (DUT→SB)</option>
            <option value="select">selection only</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo dual</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="tbl-layout">
        <div class="panel-box">
          <h3>Layer stack</h3>
          <div class="stack" id="stack-box"></div>
          <div class="flow-line" id="flow-line"></div>
        </div>
        <div class="panel-box">
          <h3>Selected role</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Hierarchy sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:16rem"></pre>
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
  const selPath = /** @type {HTMLSelectElement} */ (document.getElementById("sel-path"));

  function pathSet() {
    if (state.pathMode === "stimulus") {
      return new Set(
        state.active
          ? ["test", "env", "agent", "sequencer", "driver", "vif", "dut"]
          : ["test", "env", "agent", "monitor", "vif", "dut"]
      );
    }
    if (state.pathMode === "observe") {
      const s = ["dut", "vif", "monitor"];
      if (state.hasSb) s.push("scoreboard");
      s.push("agent", "env");
      return new Set(s);
    }
    const b = BLOCKS[state.selected];
    return new Set(b ? b.path : [state.selected]);
  }

  function hierarchyText() {
    const agentLine = state.active
      ? `│     ├── sequencer → driver → vif → DUT
│     └── monitor${state.hasSb ? " → scoreboard" : ""}`
      : `│     └── monitor (passive)${state.hasSb ? " → scoreboard" : ""}`;
    const agents =
      state.agents === 2
        ? `  ├── agent0 (TX)
  │     …same innards…
  ├── agent1 (RX)
  │     …same innards…`
        : `  ├── agent
${agentLine}`;
    const sb = state.hasSb ? `  └── scoreboard\n` : `  └── (no scoreboard)\n`;
    return `test
└── env
${agents}
${sb}// selected=${state.selected}  path=${state.pathMode}`;
  }

  function flowText() {
    if (state.pathMode === "stimulus") {
      return state.active
        ? "stimulus: sequence → sequencer → driver → vif → DUT"
        : "passive: no drive path — monitor only";
    }
    if (state.pathMode === "observe") {
      return state.hasSb
        ? "observe: DUT → vif → monitor → scoreboard"
        : "observe: DUT → vif → monitor (no scoreboard)";
    }
    const b = BLOCKS[state.selected];
    return b ? `focus: ${b.path.join(" → ")}` : "";
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

  function selectBlock(id) {
    if (!(id in BLOCKS)) return;
    state.selected = /** @type {BlockId} */ (id);
    state.lastAction = "select";
    pushLog(`# select ${id}`);
    pushTrace(`role ${id}`);
    renderAll();
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    selPath.value = state.pathMode;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter 1 agent + SB");
    pushTrace("selected agent");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.agents = p.agents;
    state.hasSb = p.hasSb;
    state.active = p.active;
    state.selected = /** @type {BlockId} */ (p.selected);
    state.note = p.note;
    state.lastAction = "load";
    pushLog(`# load ${id}`);
    pushTrace(p.note);
    renderAll();
  }

  function setPathMode(mode) {
    state.pathMode = mode;
    state.lastAction = "path";
    selPath.value = mode;
    pushLog(`# path ${mode}`);
    renderAll();
  }

  function demo() {
    const p = PRESETS.dual;
    state.preset = "dual";
    state.agents = p.agents;
    state.hasSb = p.hasSb;
    state.active = p.active;
    state.selected = /** @type {BlockId} */ (p.selected);
    state.note = p.note;
    state.pathMode = "observe";
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo dual agents");
    pushTrace(p.note);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: test→env→agent(sqr/drv/mon)+scoreboard→vif→DUT; " +
        "stimulus and observe are different paths through the same stack."
    );
    renderAll();
  }

  function layerBtn(id, title, sub, extraClass) {
    const path = pathSet();
    const classes = [
      "layer",
      state.selected === id ? "is-sel" : "",
      path.has(id) ? "is-path" : "",
      extraClass || "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<button type="button" class="${classes}" data-id="${id}">
      <div class="layer-title">${title}</div>
      <div class="layer-sub">${sub}</div>
    </button>`;
  }

  function renderStack() {
    const path = pathSet();
    const agentLabel =
      state.agents === 2 ? "agents ×2 (TX / RX)" : state.active ? "agent (active)" : "agent (passive)";
    let agentInner = `<div class="agent-innards">`;
    ["sequencer", "driver", "monitor"].forEach((id) => {
      const muted = !state.active && (id === "sequencer" || id === "driver");
      const cls = [
        "mini",
        path.has(id) ? "is-path" : "",
        state.selected === id ? "is-sel" : "",
        muted ? "is-muted" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const label =
        muted && id !== "monitor" ? `${id} (off)` : id;
      agentInner += `<button type="button" class="${cls}" data-id="${id}" ${
        muted ? 'style="opacity:0.45"' : ""
      }>${label}</button>`;
    });
    agentInner += `</div>`;

    const agentSel =
      state.selected === "agent" ||
      ["sequencer", "driver", "monitor"].includes(state.selected);
    const agentBlock = `<div class="layer ${agentSel ? "is-sel" : ""} ${
      path.has("agent") ? "is-path" : ""
    }">
      <button type="button" data-id="agent" style="display:block;width:100%;border:0;padding:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer">
        <div class="layer-title">${agentLabel}</div>
        <div class="layer-sub">sequencer · driver · monitor</div>
      </button>
      ${agentInner}
    </div>`;

    const sb = state.hasSb
      ? layerBtn("scoreboard", "scoreboard", "predict vs observe", "")
      : `<div class="layer is-muted" style="cursor:default"><div class="layer-title">(no scoreboard)</div><div class="layer-sub">optional analysis missing</div></div>`;

    const html =
      layerBtn("test", "test", "builds env · starts sequence", "") +
      layerBtn("env", "env", "holds agents + analysis", "") +
      `<div class="env-row">${agentBlock}${sb}</div>` +
      layerBtn("vif", "virtual interface", "class ↔ pins", "") +
      layerBtn("dut", "DUT", "design under test", "");

    const box = document.getElementById("stack-box");
    box.innerHTML = html;
    box.querySelectorAll("[data-id]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectBlock(/** @type {string} */ (el.getAttribute("data-id")));
      });
    });
  }

  function renderLab() {
    syncInputs();
    renderStack();
    const b = BLOCKS[state.selected];
    document.getElementById("role-blurb").textContent = b
      ? `${b.title}: ${b.blurb}`
      : "";
    document.getElementById("prop-code").textContent = hierarchyText();
    document.getElementById("flow-line").textContent = flowText();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    v.className = "verdict yes";
    v.textContent = `${state.note} · selected=${state.selected}`;

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">preset=${state.preset}</span>
      <span class="flag is-on">agents=${state.agents}</span>
      <span class="flag ${state.active ? "is-ok" : "is-on"}">active=${state.active ? 1 : 0}</span>
      <span class="flag ${state.hasSb ? "is-ok" : ""}">scoreboard=${state.hasSb ? 1 : 0}</span>
      <span class="flag is-on">sel=${state.selected}</span>
      <span class="flag is-on">path=${state.pathMode}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          selected: state.selected,
          pathMode: state.pathMode,
          agents: state.agents,
          hasSb: state.hasSb,
          active: state.active,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-test",
      title: "Quiz: test",
      type: "quiz",
      prompt: "In this stack, the test typically…",
      hint: "Top component.",
      choices: [
        "builds the env and starts the default sequence",
        "is the synthesizable DUT",
        "only dumps VCD files",
        "replaces the virtual interface",
      ],
      answer: "builds the env and starts the default sequence",
    },
    {
      id: "quiz-agent",
      title: "Quiz: agent",
      type: "quiz",
      prompt: "An agent usually bundles…",
      hint: "Three roles.",
      choices: [
        "sequencer, driver, and monitor for one protocol",
        "only the scoreboard",
        "only the DUT netlist",
        "Makefile targets",
      ],
      answer: "sequencer, driver, and monitor for one protocol",
    },
    {
      id: "quiz-sb",
      title: "Quiz: scoreboard",
      type: "quiz",
      prompt: "A scoreboard’s job is to…",
      hint: "Compare.",
      choices: [
        "compare predicted vs observed transactions",
        "generate the system clock forever",
        "synthesize the DUT",
        "replace $readmemh",
      ],
      answer: "compare predicted vs observed transactions",
    },
    {
      id: "quiz-vif",
      title: "Quiz: vif",
      type: "quiz",
      prompt: "The virtual interface…",
      hint: "Class ↔ pins.",
      choices: [
        "lets class-based TB code drive/sample DUT signals",
        "is another name for the scoreboard",
        "must live inside the DUT RTL",
        "disables the monitor",
      ],
      answer: "lets class-based TB code drive/sample DUT signals",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 1 agent, scoreboard on, selected=agent.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.agents === 1 &&
        state.hasSb &&
        state.selected === "agent",
    },
    {
      id: "select-test",
      title: "Select test",
      prompt: "Click the test layer.",
      hint: "Click test",
      setup: () => {
        loadStarter();
        selectBlock("test");
      },
      check: () => state.selected === "test" && state.lastAction === "select",
    },
    {
      id: "select-sb",
      title: "Select scoreboard",
      prompt: "Click the scoreboard block.",
      hint: "Click scoreboard",
      setup: () => {
        loadStarter();
        selectBlock("scoreboard");
      },
      check: () => state.selected === "scoreboard",
    },
    {
      id: "select-driver",
      title: "Select driver",
      prompt: "Click driver inside the agent.",
      hint: "Click driver",
      setup: () => {
        loadStarter();
        selectBlock("driver");
      },
      check: () => state.selected === "driver",
    },
    {
      id: "path-stim",
      title: "Stimulus path",
      prompt: "Set Highlight path to stimulus (seq→DUT).",
      hint: "Highlight path → stimulus",
      setup: () => {
        loadStarter();
        setPathMode("stimulus");
      },
      check: () => state.pathMode === "stimulus" && state.lastAction === "path",
    },
    {
      id: "path-obs",
      title: "Observe path",
      prompt: "Set Highlight path to observe (DUT→SB).",
      hint: "Highlight path → observe",
      setup: () => {
        loadStarter();
        setPathMode("observe");
      },
      check: () => state.pathMode === "observe",
    },
    {
      id: "load-dual",
      title: "Load dual",
      prompt: "Load dual agents preset — agents=2.",
      hint: "dual → Load preset",
      setup: () => {
        selPreset.value = "dual";
        loadPreset();
      },
      check: () => state.preset === "dual" && state.agents === 2,
    },
    {
      id: "load-passive",
      title: "Load passive",
      prompt: "Load passive agent — active=0, selected monitor.",
      hint: "passive → Load",
      setup: () => {
        selPreset.value = "passive";
        loadPreset();
      },
      check: () => !state.active && state.selected === "monitor",
    },
    {
      id: "load-no-sb",
      title: "Load no SB",
      prompt: "Load env without scoreboard — scoreboard=0.",
      hint: "no scoreboard → Load",
      setup: () => {
        selPreset.value = "no_sb";
        loadPreset();
      },
      check: () => state.preset === "no_sb" && !state.hasSb,
    },
    {
      id: "demo",
      title: "Demo dual",
      prompt: "Click Demo dual — agents=2, path observe.",
      hint: "Demo dual",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.agents === 2 &&
        state.pathMode === "observe" &&
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
      id: "hier-test",
      title: "Hierarchy test",
      prompt: "Hierarchy sketch starts with test.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /^test/m.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions scoreboard.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /scoreboard/i.test(sourceSketch()),
    },
    {
      id: "flow-stim",
      title: "Flow line",
      prompt: "On stimulus path, flow line mentions sequencer.",
      hint: "path=stimulus",
      setup: () => {
        loadStarter();
        setPathMode("stimulus");
      },
      check: () => /sequencer/.test(document.getElementById("flow-line").textContent),
    },
    {
      id: "role-mon",
      title: "Monitor blurb",
      prompt: "Select monitor — blurb mentions analysis.",
      hint: "Click monitor",
      setup: () => {
        loadStarter();
        selectBlock("monitor");
      },
      check: () =>
        state.selected === "monitor" &&
        /analysis/i.test(document.getElementById("role-blurb").textContent),
    },
    {
      id: "select-vif",
      title: "Select vif",
      prompt: "Click virtual interface.",
      hint: "Click vif",
      setup: () => {
        loadStarter();
        selectBlock("vif");
      },
      check: () => state.selected === "vif",
    },
    {
      id: "select-dut",
      title: "Select DUT",
      prompt: "Click DUT.",
      hint: "Click DUT",
      setup: () => {
        loadStarter();
        selectBlock("dut");
      },
      check: () => state.selected === "dut",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to starter agent + SB.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.agents === 1 && state.hasSb && state.selected === "agent";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="tbl-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("tbl-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selPath.addEventListener("change", () => setPathMode(selPath.value));

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
      if (saved && saved.selected) {
        state.selected = saved.selected;
        state.pathMode = saved.pathMode || "stimulus";
        state.preset = saved.preset || "starter";
        state.agents = saved.agents || 1;
        state.hasSb = saved.hasSb !== false;
        state.active = saved.active !== false;
        const p = PRESETS[state.preset];
        if (p) state.note = p.note;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
