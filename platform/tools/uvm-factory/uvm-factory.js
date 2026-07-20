(() => {
  /**
   * Factory override sketch (concept)
   *   requested type → factory → constructed type
   * Starter: base_driver type-overridden to error_driver
   */

  const TYPES = {
    base_driver: { kind: "driver", label: "base_driver" },
    error_driver: { kind: "driver", label: "error_driver", extends: "base_driver" },
    quiet_driver: { kind: "driver", label: "quiet_driver", extends: "base_driver" },
    base_seq: { kind: "sequence", label: "base_seq" },
    stress_seq: { kind: "sequence", label: "stress_seq", extends: "base_seq" },
    base_agent: { kind: "agent", label: "base_agent" },
    vip_agent: { kind: "agent", label: "vip_agent", extends: "base_agent" },
  };

  const PRESETS = {
    starter: {
      label: "starter: type override driver",
      requested: "base_driver",
      instPath: "env.agent.drv",
      typeOverrides: [{ from: "base_driver", to: "error_driver" }],
      instOverrides: [],
      note: "create(base_driver) → constructed error_driver via type override.",
    },
    none: {
      label: "no override",
      requested: "base_driver",
      instPath: "env.agent.drv",
      typeOverrides: [],
      instOverrides: [],
      note: "No overrides — requested type is constructed.",
    },
    inst: {
      label: "instance override one path",
      requested: "base_driver",
      instPath: "env.agent.drv",
      typeOverrides: [{ from: "base_driver", to: "quiet_driver" }],
      instOverrides: [
        { from: "base_driver", to: "error_driver", path: "env.agent.drv" },
      ],
      note: "Instance override beats type override for that path.",
    },
    seq: {
      label: "sequence type override",
      requested: "base_seq",
      instPath: "env.agent.sqr",
      typeOverrides: [{ from: "base_seq", to: "stress_seq" }],
      instOverrides: [],
      note: "Same idea for sequences — swap stimulus without editing start code.",
    },
    agent: {
      label: "agent VIP swap",
      requested: "base_agent",
      instPath: "env.agent",
      typeOverrides: [{ from: "base_agent", to: "vip_agent" }],
      instOverrides: [],
      note: "Swap a whole agent type at the factory — reuse hierarchy code.",
    },
  };

  function sourceSketch() {
    return `// UVM factory literacy (not a class library)
// Registration:  class … extends …; \`uvm_component_utils(…)
// Creation:      type_id::create("name", parent)
// Type override:  set_type_override_by_type(base::get_type(), err::get_type())
// Inst override:  set_inst_override_by_type(…, "env.agent.drv")
//
// Requested type is what the source code asks for.
// Constructed type is what the factory actually builds.
// Instance override wins over type override for a matching path.
// Why: swap error/VIP/test variants without editing the hierarchy.`;
  }

  function resolve(state) {
    const req = state.requested;
    const path = state.instPath;
    const instHit = state.instOverrides.find(
      (o) => o.from === req && o.path === path
    );
    if (instHit) {
      return {
        constructed: instHit.to,
        via: "inst",
        detail: `inst override ${instHit.from} → ${instHit.to} @ ${instHit.path}`,
      };
    }
    const typeHit = state.typeOverrides.find((o) => o.from === req);
    if (typeHit) {
      return {
        constructed: typeHit.to,
        via: "type",
        detail: `type override ${typeHit.from} → ${typeHit.to}`,
      };
    }
    return {
      constructed: req,
      via: "none",
      detail: "no override — identity create",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      requested: p.requested,
      instPath: p.instPath,
      typeOverrides: p.typeOverrides.map((o) => ({ ...o })),
      instOverrides: p.instOverrides.map((o) => ({ ...o })),
      note: p.note,
      created: false,
      lastResult: null,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-factory-cleared-v1";
  const STORE_KEY = "ddv-uvm-factory-session-v1";

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

  const root = document.getElementById("ufac-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> code asks for <code>base_driver</code>;
        a type override redirects create to <code>error_driver</code>.</p>
      <button type="button" class="btn btn-secondary" id="ufac-starter">Load starter example</button>
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
        <div class="idea-card"><h3>create</h3><p>Ask the factory for a type by name — do not <code>new</code> components by hand.</p></div>
        <div class="idea-card"><h3>Type override</h3><p>Everywhere: requested base → alternate derived type.</p></div>
        <div class="idea-card"><h3>Inst override</h3><p>One hierarchical path gets a different type.</p></div>
        <div class="idea-card"><h3>Why</h3><p>Swap error/VIP variants without rewriting the env.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ufac-controls">
        <div class="ufac-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>type override driver</option>
            <option value="none">no override</option>
            <option value="inst">instance override</option>
            <option value="seq">sequence override</option>
            <option value="agent">agent VIP swap</option>
          </select>
        </div>
        <div class="ufac-field">
          <label for="sel-req">Requested type</label>
          <select id="sel-req">
            <option value="base_driver">base_driver</option>
            <option value="base_seq">base_seq</option>
            <option value="base_agent">base_agent</option>
          </select>
        </div>
        <div class="ufac-field">
          <label for="inp-path">Instance path</label>
          <input id="inp-path" type="text" spellcheck="false">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-create">type_id::create</button>
        <button type="button" class="btn btn-ghost" id="btn-clear">Clear overrides</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo inst wins</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ufac-layout">
        <div class="panel-box">
          <h3>Create flow</h3>
          <div class="flow" id="flow-box"></div>
          <p class="meta-note" id="meta-note"></p>
          <h3 style="margin-top:0.75rem">Active overrides</h3>
          <pre class="override-list" id="override-list"></pre>
        </div>
        <div class="panel-box">
          <h3>Code sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:18rem"></pre>
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
  const selReq = /** @type {HTMLSelectElement} */ (document.getElementById("sel-req"));
  const inpPath = /** @type {HTMLInputElement} */ (document.getElementById("inp-path"));

  function codeSketch() {
    const r = resolve(state);
    const typeLines = state.typeOverrides.length
      ? state.typeOverrides
          .map(
            (o) =>
              `  ${o.from}::type_id::set_type_override(${o.to}::get_type());`
          )
          .join("\n")
      : "  // (no type overrides)";
    const instLines = state.instOverrides.length
      ? state.instOverrides
          .map(
            (o) =>
              `  ${o.from}::type_id::set_inst_override(${o.to}::get_type(), "${o.path}");`
          )
          .join("\n")
      : "  // (no inst overrides)";
    return `// before build / create:
${typeLines}
${instLines}

// in build_phase / sequence:
${state.requested} d;
d = ${state.requested}::type_id::create("obj", this);
// requested  = ${state.requested}
// path       = ${state.instPath}
// constructed= ${r.constructed}  via ${r.via}`;
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

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    selReq.value = state.requested;
    inpPath.value = state.instPath;
  }

  function pullInputs() {
    state.requested = selReq.value in TYPES ? selReq.value : state.requested;
    state.instPath = inpPath.value.trim() || state.instPath;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    doCreate();
    state.lastAction = "starter";
    pushLog("# starter type override");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.requested = p.requested;
    state.instPath = p.instPath;
    state.typeOverrides = p.typeOverrides.map((o) => ({ ...o }));
    state.instOverrides = p.instOverrides.map((o) => ({ ...o }));
    state.note = p.note;
    state.created = false;
    state.lastResult = null;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function doCreate() {
    pullInputs();
    const r = resolve(state);
    state.created = true;
    state.lastResult = r;
    state.lastAction = "create";
    pushTrace(`create ${state.requested} → ${r.constructed} (${r.via})`);
    pushLog(`# create via=${r.via}`);
    renderAll();
  }

  function clearOverrides() {
    state.typeOverrides = [];
    state.instOverrides = [];
    state.created = false;
    state.lastResult = null;
    state.note = "Overrides cleared — create will return the requested type.";
    state.lastAction = "clear";
    pushLog("# clear overrides");
    renderAll();
  }

  function demo() {
    const p = PRESETS.inst;
    state.preset = "inst";
    state.requested = p.requested;
    state.instPath = p.instPath;
    state.typeOverrides = p.typeOverrides.map((o) => ({ ...o }));
    state.instOverrides = p.instOverrides.map((o) => ({ ...o }));
    state.note = p.note;
    state.demoed = true;
    syncInputs();
    doCreate();
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo inst wins over type");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: factory create uses overrides so tests can swap " +
        "driver/seq/agent types without editing hierarchy source."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const r = state.lastResult || resolve(state);
    const overridden = r.via !== "none";

    document.getElementById("flow-box").innerHTML = `
      <div class="flow-box"><div class="k">Requested</div><div class="v">${state.requested}</div></div>
      <div class="flow-arrow">→</div>
      <div class="flow-box ${overridden ? "is-hi" : ""}"><div class="k">Factory</div><div class="v">${r.via}</div></div>
      <div class="flow-arrow">→</div>
      <div class="flow-box is-hi"><div class="k">Constructed</div><div class="v">${r.constructed}</div></div>
    `;

    const ov = [];
    state.typeOverrides.forEach((o) => ov.push(`type: ${o.from} → ${o.to}`));
    state.instOverrides.forEach((o) =>
      ov.push(`inst: ${o.from} → ${o.to} @ ${o.path}`)
    );
    document.getElementById("override-list").textContent = ov.length
      ? ov.join("\n")
      : "// none";
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.created) {
      v.className = "verdict idle";
      v.textContent = "Set overrides / path, then type_id::create";
    } else if (r.via === "none") {
      v.className = "verdict yes";
      v.textContent = `Created ${r.constructed} (identity — no override matched)`;
    } else {
      v.className = "verdict warn";
      v.textContent = `Created ${r.constructed} via ${r.via} override — not the requested name`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">req=${state.requested}</span>
      <span class="flag is-ok">got=${r.constructed}</span>
      <span class="flag ${r.via !== "none" ? "is-on" : ""}">via=${r.via}</span>
      <span class="flag is-on">path=${state.instPath}</span>
      <span class="flag ${state.created ? "is-ok" : ""}">created=${state.created ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          requested: state.requested,
          instPath: state.instPath,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-create",
      title: "Quiz: create",
      type: "quiz",
      prompt: "Preferred way to build a UVM component is…",
      hint: "Factory.",
      choices: [
        "type_id::create through the factory",
        "always raw new() with no registration",
        "$finish inside build_phase",
        "only $readmemh",
      ],
      answer: "type_id::create through the factory",
    },
    {
      id: "quiz-type",
      title: "Quiz: type override",
      type: "quiz",
      prompt: "A type override means…",
      hint: "Everywhere.",
      choices: [
        "requests for a base type construct an alternate type instead",
        "the DUT netlist is rewritten",
        "objections are disabled",
        "phases run backwards",
      ],
      answer: "requests for a base type construct an alternate type instead",
    },
    {
      id: "quiz-inst",
      title: "Quiz: inst override",
      type: "quiz",
      prompt: "An instance override…",
      hint: "One path.",
      choices: [
        "applies to a specific hierarchical path",
        "deletes all agents",
        "only works without a factory",
        "forces report_phase to skip",
      ],
      answer: "applies to a specific hierarchical path",
    },
    {
      id: "quiz-wins",
      title: "Quiz: precedence",
      type: "quiz",
      prompt: "When both type and matching inst overrides exist…",
      hint: "More specific.",
      choices: [
        "the instance override wins for that path",
        "the type override always wins",
        "create fails hard",
        "both types are constructed",
      ],
      answer: "the instance override wins for that path",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — create yields error_driver via type.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () => {
        const r = resolve(state);
        return (
          state.lastAction === "starter" &&
          r.constructed === "error_driver" &&
          r.via === "type"
        );
      },
    },
    {
      id: "create",
      title: "Create",
      prompt: "On starter, click type_id::create.",
      hint: "type_id::create",
      setup: () => {
        state = makeStarter();
        syncInputs();
        doCreate();
      },
      check: () => state.created && state.lastAction === "create",
    },
    {
      id: "load-none",
      title: "Load none",
      prompt: "Load no override, create → got=base_driver via=none.",
      hint: "no override → Load → create",
      setup: () => {
        selPreset.value = "none";
        loadPreset();
        doCreate();
      },
      check: () => {
        const r = resolve(state);
        return r.via === "none" && r.constructed === "base_driver";
      },
    },
    {
      id: "load-inst",
      title: "Load inst",
      prompt: "Load instance override, create → error_driver via=inst.",
      hint: "instance override → Load → create",
      setup: () => {
        selPreset.value = "inst";
        loadPreset();
        doCreate();
      },
      check: () => {
        const r = resolve(state);
        return r.via === "inst" && r.constructed === "error_driver";
      },
    },
    {
      id: "load-seq",
      title: "Load seq",
      prompt: "Load sequence override — constructed stress_seq.",
      hint: "sequence → Load → create",
      setup: () => {
        selPreset.value = "seq";
        loadPreset();
        doCreate();
      },
      check: () => resolve(state).constructed === "stress_seq",
    },
    {
      id: "load-agent",
      title: "Load agent",
      prompt: "Load agent VIP swap — constructed vip_agent.",
      hint: "agent VIP → Load → create",
      setup: () => {
        selPreset.value = "agent";
        loadPreset();
        doCreate();
      },
      check: () => resolve(state).constructed === "vip_agent",
    },
    {
      id: "clear",
      title: "Clear overrides",
      prompt: "From starter, Clear overrides — list empty.",
      hint: "Clear overrides",
      setup: () => {
        loadStarter();
        clearOverrides();
      },
      check: () =>
        state.typeOverrides.length === 0 &&
        state.instOverrides.length === 0 &&
        state.lastAction === "clear",
    },
    {
      id: "clear-create",
      title: "Create after clear",
      prompt: "Clear then create — via=none.",
      hint: "Clear → create",
      setup: () => {
        loadStarter();
        clearOverrides();
        doCreate();
      },
      check: () => resolve(state).via === "none" && state.created,
    },
    {
      id: "demo",
      title: "Demo inst wins",
      prompt: "Click Demo inst wins — via=inst.",
      hint: "Demo inst wins",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        resolve(state).via === "inst" &&
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
      id: "sketch-override",
      title: "Sketch override",
      prompt: "Code sketch shows set_type_override on starter.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /set_type_override/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions Instance override wins.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /Instance override wins/i.test(sourceSketch()),
    },
    {
      id: "path-flag",
      title: "Path",
      prompt: "Starter instance path is env.agent.drv.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.instPath === "env.agent.drv",
    },
    {
      id: "req-base",
      title: "Requested",
      prompt: "Starter requested type is base_driver.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.requested === "base_driver",
    },
    {
      id: "mismatch",
      title: "Name mismatch",
      prompt: "Starter: constructed !== requested.",
      hint: "Starter create",
      setup: () => loadStarter(),
      check: () => resolve(state).constructed !== state.requested,
    },
    {
      id: "type-list",
      title: "Override list",
      prompt: "Starter override list mentions error_driver.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /error_driver/.test(document.getElementById("override-list").textContent),
    },
    {
      id: "inst-beats",
      title: "Inst beats type",
      prompt: "On inst preset, type would be quiet_driver but inst → error_driver.",
      hint: "Load inst",
      setup: () => {
        selPreset.value = "inst";
        loadPreset();
      },
      check: () => {
        const typeOnly = state.typeOverrides[0]?.to;
        const r = resolve(state);
        return typeOnly === "quiet_driver" && r.constructed === "error_driver";
      },
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to starter error_driver via type.",
      hint: "Reset",
      setup: () => {
        clearOverrides();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        const r = resolve(state);
        return r.constructed === "error_driver" && r.via === "type";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ufac-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ufac-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-create").addEventListener("click", () => doCreate());
  document.getElementById("btn-clear").addEventListener("click", () => clearOverrides());
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
      if (saved && saved.requested) {
        state.requested = saved.requested;
        state.instPath = saved.instPath || state.instPath;
        state.preset = saved.preset || "starter";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  doCreate();
  state.lastAction = "starter";
  renderAll();
})();
