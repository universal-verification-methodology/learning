(() => {
  /**
   * Agent anatomy (concept)
   *   sequencer · driver · monitor · active vs passive
   * Starter: active agent, driver selected
   */

  /** @typedef {"sequencer"|"driver"|"monitor"|"agent"} PartId */

  const PARTS = {
    agent: {
      title: "agent",
      blurb: "Protocol unit that groups sequencer, driver, and monitor around one interface.",
    },
    sequencer: {
      title: "sequencer",
      blurb: "Receives sequences and hands seq_items to the driver (TLM).",
    },
    driver: {
      title: "driver",
      blurb: "Active path: pulls items and drives pins through the virtual interface.",
    },
    monitor: {
      title: "monitor",
      blurb: "Passive path: samples the bus and publishes transactions (analysis).",
    },
  };

  const PRESETS = {
    starter: {
      label: "starter: active agent",
      active: true,
      selected: "driver",
      note: "Active agent builds sequencer + driver + monitor.",
    },
    passive: {
      label: "passive (monitor only)",
      active: false,
      selected: "monitor",
      note: "Passive agent: monitor on; sequencer/driver not used to drive.",
    },
    at_sqr: {
      label: "focus sequencer",
      active: true,
      selected: "sequencer",
      note: "Sequencer is the sequence↔driver meeting point.",
    },
    at_mon: {
      label: "focus monitor",
      active: true,
      selected: "monitor",
      note: "Monitor still runs in an active agent — observe while driving.",
    },
  };

  function sourceSketch() {
    return `// Agent anatomy literacy (not a class library)
// agent (uvm_agent)
//   ├── sequencer   (if is_active == UVM_ACTIVE)
//   ├── driver      (if active)  →  vif  →  DUT
//   └── monitor     (always)     →  analysis port
//
// Active:  can drive + observe
// Passive: observe only (no drive path)
// ConfigDB often sets is_active / vif on the agent path.
// One agent ≈ one protocol interface.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      active: p.active,
      selected: /** @type {PartId} */ (p.selected),
      note: p.note,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-agent-cleared-v1";
  const STORE_KEY = "ddv-uvm-agent-session-v1";

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

  const root = document.getElementById("uag-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> active agent with sequencer, driver, and
        monitor — <code>driver</code> selected on the drive path.</p>
      <button type="button" class="btn btn-secondary" id="uag-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Bundle</h3><p>Agent groups sequencer, driver, and monitor for one protocol.</p></div>
        <div class="idea-card"><h3>Active</h3><p>Builds drive path (sequencer + driver) plus monitor.</p></div>
        <div class="idea-card"><h3>Passive</h3><p>Monitor only — observe without driving.</p></div>
        <div class="idea-card"><h3>vif</h3><p>Shared handle: driver drives, monitor samples.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="uag-controls">
        <div class="uag-field">
          <label for="sel-preset">Agent preset</label>
          <select id="sel-preset">
            <option value="starter" selected>active + driver</option>
            <option value="passive">passive</option>
            <option value="at_sqr">focus sequencer</option>
            <option value="at_mon">focus monitor</option>
          </select>
        </div>
        <div class="uag-field">
          <label for="sel-mode">is_active</label>
          <select id="sel-mode">
            <option value="active">UVM_ACTIVE</option>
            <option value="passive">UVM_PASSIVE</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo passive</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="uag-layout">
        <div class="panel-box">
          <h3>Inside the agent</h3>
          <div id="agent-box"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected role</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Build sketch</h3>
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
  const selMode = /** @type {HTMLSelectElement} */ (document.getElementById("sel-mode"));

  function buildSketch() {
    if (state.active) {
      return `// build_phase (active agent)
if (get_is_active() == UVM_ACTIVE) begin
  sqr = sequencer::type_id::create("sqr", this);
  drv = driver::type_id::create("drv", this);
end
mon = monitor::type_id::create("mon", this);
// connect: drv.seq_item_port.connect(sqr.seq_item_export);
// selected=${state.selected}`;
    }
    return `// build_phase (passive agent)
// no sequencer / driver
mon = monitor::type_id::create("mon", this);
// selected=${state.selected}`;
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
    selMode.value = state.active ? "active" : "passive";
  }

  function selectPart(id) {
    if (!state.active && (id === "sequencer" || id === "driver")) {
      state.lastAction = "blocked";
      pushLog(`# blocked — ${id} off in passive`);
      renderAll();
      return;
    }
    state.selected = /** @type {PartId} */ (id);
    state.lastAction = "select";
    pushLog(`# select ${id}`);
    pushTrace(`role ${id}`);
    renderAll();
  }

  function setMode(active) {
    state.active = active;
    if (!active && (state.selected === "sequencer" || state.selected === "driver")) {
      state.selected = "monitor";
    }
    state.lastAction = "mode";
    pushLog(`# is_active=${active ? "ACTIVE" : "PASSIVE"}`);
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter active driver");
    pushTrace("selected driver");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.active = p.active;
    state.selected = /** @type {PartId} */ (p.selected);
    state.note = p.note;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function demo() {
    const p = PRESETS.passive;
    state.preset = "passive";
    state.active = p.active;
    state.selected = /** @type {PartId} */ (p.selected);
    state.note = p.note;
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo passive");
    pushTrace("monitor only");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: agent = sequencer+driver+monitor (active) or monitor-only (passive); " +
        "one agent per protocol interface."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const parts = [
      { id: "sequencer", on: state.active, sub: "seq ↔ drv" },
      { id: "driver", on: state.active, sub: "drive vif" },
      { id: "monitor", on: true, sub: "sample → analysis" },
    ];
    let html = `<div class="agent-shell ${state.active ? "is-active" : "is-passive"}">
      <div class="agent-title"><button type="button" data-id="agent" style="border:0;background:transparent;font:inherit;color:inherit;cursor:pointer;padding:0">uart_agent</button>
        · ${state.active ? "UVM_ACTIVE" : "UVM_PASSIVE"}</div>
      <div class="parts">`;
    parts.forEach((p) => {
      const cls = [
        "part",
        state.selected === p.id ? "is-sel" : "",
        !p.on ? "is-off" : "",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<button type="button" class="${cls}" data-id="${p.id}" ${
        p.on ? "" : "disabled"
      }><span class="part-name">${p.id}${p.on ? "" : " (off)"}</span><span class="part-sub">${p.sub}</span></button>`;
    });
    html += `</div><div class="vif-row">virtual interface · shared with DUT pins</div></div>`;
    const box = document.getElementById("agent-box");
    box.innerHTML = html;
    box.querySelectorAll("[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        if (el.hasAttribute("disabled")) return;
        selectPart(/** @type {string} */ (el.getAttribute("data-id")));
      });
    });

    const part = PARTS[state.selected] || PARTS.agent;
    document.getElementById("role-blurb").textContent = `${part.title}: ${part.blurb}`;
    document.getElementById("prop-code").textContent = buildSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    v.className = "verdict yes";
    v.textContent = `${state.active ? "Active" : "Passive"} agent · selected=${state.selected}`;

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.active ? "is-ok" : "is-on"}">active=${state.active ? 1 : 0}</span>
      <span class="flag is-on">sel=${state.selected}</span>
      <span class="flag ${state.active ? "is-ok" : ""}">has_drv=${state.active ? 1 : 0}</span>
      <span class="flag is-ok">has_mon=1</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          active: state.active,
          selected: state.selected,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-bundle",
      title: "Quiz: bundle",
      type: "quiz",
      prompt: "An agent usually contains…",
      hint: "Three parts.",
      choices: [
        "sequencer, driver, and monitor for one protocol",
        "only the scoreboard",
        "only the DUT RTL",
        "Makefile targets",
      ],
      answer: "sequencer, driver, and monitor for one protocol",
    },
    {
      id: "quiz-active",
      title: "Quiz: active",
      type: "quiz",
      prompt: "UVM_ACTIVE typically means…",
      hint: "Can drive.",
      choices: [
        "the agent builds sequencer + driver (and usually a monitor)",
        "the agent is deleted",
        "phases run backwards",
        "ConfigDB is disabled",
      ],
      answer: "the agent builds sequencer + driver (and usually a monitor)",
    },
    {
      id: "quiz-passive",
      title: "Quiz: passive",
      type: "quiz",
      prompt: "A passive agent…",
      hint: "Observe.",
      choices: [
        "observes with a monitor and does not drive pins",
        "must always include a driver",
        "replaces the virtual interface",
        "only runs report_phase",
      ],
      answer: "observes with a monitor and does not drive pins",
    },
    {
      id: "quiz-mon",
      title: "Quiz: monitor",
      type: "quiz",
      prompt: "Even in an active agent, the monitor…",
      hint: "Still there.",
      choices: [
        "still samples the bus for analysis / scoreboard",
        "is illegal",
        "drives the DUT instead of the driver",
        "deletes seq_items",
      ],
      answer: "still samples the bus for analysis / scoreboard",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — active=1, selected=driver.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.active &&
        state.selected === "driver",
    },
    {
      id: "select-mon",
      title: "Select monitor",
      prompt: "Click the monitor part.",
      hint: "Click monitor",
      setup: () => {
        loadStarter();
        selectPart("monitor");
      },
      check: () => state.selected === "monitor" && state.lastAction === "select",
    },
    {
      id: "select-sqr",
      title: "Select sequencer",
      prompt: "Click the sequencer part.",
      hint: "Click sequencer",
      setup: () => {
        loadStarter();
        selectPart("sequencer");
      },
      check: () => state.selected === "sequencer",
    },
    {
      id: "select-agent",
      title: "Select agent",
      prompt: "Click the agent title (uart_agent).",
      hint: "Click uart_agent",
      setup: () => {
        loadStarter();
        selectPart("agent");
      },
      check: () => state.selected === "agent",
    },
    {
      id: "mode-passive",
      title: "Set passive",
      prompt: "Set is_active to UVM_PASSIVE.",
      hint: "Dropdown → passive",
      setup: () => {
        loadStarter();
        setMode(false);
      },
      check: () => !state.active && state.lastAction === "mode",
    },
    {
      id: "mode-active",
      title: "Set active",
      prompt: "From passive, set UVM_ACTIVE.",
      hint: "Dropdown → active",
      setup: () => {
        setMode(false);
        setMode(true);
      },
      check: () => state.active && state.lastAction === "mode",
    },
    {
      id: "load-passive",
      title: "Load passive",
      prompt: "Load passive preset — selected monitor.",
      hint: "passive → Load",
      setup: () => {
        selPreset.value = "passive";
        loadPreset();
      },
      check: () => !state.active && state.selected === "monitor",
    },
    {
      id: "load-sqr",
      title: "Load sequencer focus",
      prompt: "Load focus sequencer.",
      hint: "focus sequencer → Load",
      setup: () => {
        selPreset.value = "at_sqr";
        loadPreset();
      },
      check: () => state.selected === "sequencer" && state.active,
    },
    {
      id: "blocked-drv",
      title: "Blocked driver",
      prompt: "In passive, trying driver is blocked.",
      hint: "Load passive → click driver (disabled) via selectPart",
      setup: () => {
        selPreset.value = "passive";
        loadPreset();
        selectPart("driver");
      },
      check: () => !state.active && state.lastAction === "blocked",
    },
    {
      id: "demo",
      title: "Demo passive",
      prompt: "Click Demo passive.",
      hint: "Demo passive",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.active &&
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
      id: "sketch-active",
      title: "Sketch active",
      prompt: "Active build sketch mentions sequencer create.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.active &&
        /sequencer::type_id::create/.test(
          document.getElementById("prop-code").textContent
        ),
    },
    {
      id: "sketch-passive",
      title: "Sketch passive",
      prompt: "Passive sketch says no sequencer / driver.",
      hint: "Load passive",
      setup: () => {
        selPreset.value = "passive";
        loadPreset();
      },
      check: () =>
        !state.active &&
        /no sequencer/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions UVM_ACTIVE.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /UVM_ACTIVE/.test(sourceSketch()),
    },
    {
      id: "has-mon",
      title: "Always monitor",
      prompt: "Starter has_mon flag is 1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /has_mon=1/.test(document.getElementById("flag-row").textContent),
    },
    {
      id: "blurb-drv",
      title: "Driver blurb",
      prompt: "Starter driver blurb mentions virtual interface.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.selected === "driver" &&
        /virtual interface/i.test(document.getElementById("role-blurb").textContent),
    },
    {
      id: "passive-sel",
      title: "Passive forces monitor",
      prompt: "Switch to passive while on driver → selected becomes monitor.",
      hint: "Starter → set passive",
      setup: () => {
        loadStarter();
        setMode(false);
      },
      check: () => !state.active && state.selected === "monitor",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to active driver.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.active && state.selected === "driver";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="uag-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("uag-starter").addEventListener("click", () => {
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
  selMode.addEventListener("change", () => setMode(selMode.value === "active"));

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
        state.active = saved.active !== false;
        state.selected = saved.selected;
        state.preset = saved.preset || "starter";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
