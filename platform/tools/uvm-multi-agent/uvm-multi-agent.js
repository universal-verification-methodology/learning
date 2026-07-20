(() => {
  /**
   * Multi-agent env (concept)
   *   env → uart + spi agents + shared scoreboard
   * Starter: both agents present, both analysis → sb wired
   */

  const PRESETS = {
    starter: {
      label: "starter: UART+SPI → shared sb",
      uart: true,
      spi: true,
      sb: true,
      uartAp: true,
      spiAp: true,
      uartActive: true,
      spiActive: true,
      note: "Two agents under env; both monitor analysis ports fan into one scoreboard.",
    },
    uart_only: {
      label: "UART only",
      uart: true,
      spi: false,
      sb: true,
      uartAp: true,
      spiAp: false,
      uartActive: true,
      spiActive: false,
      note: "Single-agent env — add SPI to go multi-agent.",
    },
    ap_gap: {
      label: "SPI ap not connected",
      uart: true,
      spi: true,
      sb: true,
      uartAp: true,
      spiAp: false,
      uartActive: true,
      spiActive: true,
      note: "SPI agent exists but its analysis link to sb is missing.",
    },
    bare: {
      label: "empty env",
      uart: false,
      spi: false,
      sb: false,
      uartAp: false,
      spiAp: false,
      uartActive: false,
      spiActive: false,
      note: "Build agents + scoreboard, then Connect analysis.",
    },
  };

  function sourceSketch() {
    return `// Multi-agent env literacy (not a full UVM env)
// env
//   ├── uart_agent  (sqr / drv / mon)  — interface A
//   ├── spi_agent   (sqr / drv / mon)  — interface B
//   └── scoreboard  (shared expect/actual)
//
// connect_phase:
//   uart.mon.ap.connect(sb.uart_export);
//   spi.mon.ap.connect(sb.spi_export);
//
// One scoreboard, many producers — fan-in via analysis
// Active vs passive still per agent (is_active).`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      uart: p.uart,
      spi: p.spi,
      sb: p.sb,
      uartAp: p.uartAp,
      spiAp: p.spiAp,
      uartActive: p.uartActive,
      spiActive: p.spiActive,
      note: p.note,
      selected: "env",
      lastTxn: null,
      lastOk: null,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [
        "build uart_agent + spi_agent + scoreboard",
        "connect uart.mon.ap → sb",
        "connect spi.mon.ap → sb",
      ],
    };
  }

  const CLEARED_KEY = "ddv-uvm-multi-agent-cleared-v1";
  const STORE_KEY = "ddv-uvm-multi-agent-session-v1";

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

  const root = document.getElementById("uma-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> env holds UART and SPI agents plus a
        shared scoreboard; both monitor analysis ports are connected.</p>
      <button type="button" class="btn btn-secondary" id="uma-starter">Load starter example</button>
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
        <div class="idea-card"><h3>env</h3><p>Parent that owns agents and shared checkers.</p></div>
        <div class="idea-card"><h3>N agents</h3><p>One agent per interface / protocol role.</p></div>
        <div class="idea-card"><h3>shared sb</h3><p>One scoreboard; many analysis fans-in.</p></div>
        <div class="idea-card"><h3>connect</h3><p>Wire each mon.ap → sb export in connect_phase.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="uma-controls">
        <div class="uma-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>UART+SPI → sb</option>
            <option value="uart_only">UART only</option>
            <option value="ap_gap">SPI ap gap</option>
            <option value="bare">empty env</option>
          </select>
        </div>
        <div class="uma-field">
          <label for="sel-focus">Focus agent</label>
          <select id="sel-focus">
            <option value="uart">UART</option>
            <option value="spi">SPI</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-add">Add agent</button>
        <button type="button" class="btn btn-ghost" id="btn-remove">Remove agent</button>
        <button type="button" class="btn btn-secondary" id="btn-connect">Connect ap</button>
        <button type="button" class="btn btn-ghost" id="btn-disconnect">Disconnect ap</button>
        <button type="button" class="btn btn-secondary" id="btn-observe">Observe beat</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo fan-in</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="uma-layout">
        <div class="panel-box">
          <h3>Environment tree</h3>
          <div class="env-tree" id="env-tree"></div>
          <div class="link-row" id="link-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Connect sketch</h3>
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
  const selFocus = /** @type {HTMLSelectElement} */ (document.getElementById("sel-focus"));

  function agentCount() {
    return (state.uart ? 1 : 0) + (state.spi ? 1 : 0);
  }

  function isMulti() {
    return agentCount() >= 2 && state.sb;
  }

  function bothAp() {
    return state.uart && state.spi && state.uartAp && state.spiAp && state.sb;
  }

  function codeSketch() {
    return `// env
//   uart_agent = ${state.uart ? (state.uartActive ? "active" : "passive") : "absent"}
//   spi_agent  = ${state.spi ? (state.spiActive ? "active" : "passive") : "absent"}
//   scoreboard = ${state.sb ? "present" : "absent"}
//
// analysis:
//   uart.mon.ap → sb  ${state.uartAp ? "CONNECTED" : "open"}
//   spi.mon.ap  → sb  ${state.spiAp ? "CONNECTED" : "open"}
//
// multi-agent = ${isMulti() ? 1 : 0}  both_ap = ${bothAp() ? 1 : 0}
// last observe: ${state.lastTxn ? state.lastTxn.from + " " + state.lastTxn.data + " " + (state.lastOk ? "OK" : "FAIL") : "—"}`;
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
    pushLog("# starter UART+SPI shared sb");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.uart = p.uart;
    state.spi = p.spi;
    state.sb = p.sb;
    state.uartAp = p.uartAp;
    state.spiAp = p.spiAp;
    state.uartActive = p.uartActive;
    state.spiActive = p.spiActive;
    state.note = p.note;
    state.lastTxn = null;
    state.lastOk = null;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function addAgent() {
    const focus = selFocus.value;
    if (focus === "uart") {
      state.uart = true;
      state.uartActive = true;
      if (state.sb && state.uartAp === false) {
        /* leave ap as-is */
      }
    } else {
      state.spi = true;
      state.spiActive = true;
    }
    if (!state.sb) state.sb = true;
    state.lastAction = "add";
    pushLog(`# add ${focus}_agent`);
    pushTrace(`build ${focus}_agent`);
    renderAll();
  }

  function removeAgent() {
    const focus = selFocus.value;
    if (focus === "uart") {
      state.uart = false;
      state.uartAp = false;
    } else {
      state.spi = false;
      state.spiAp = false;
    }
    state.lastAction = "remove";
    pushLog(`# remove ${focus}_agent`);
    renderAll();
  }

  function connectAp() {
    const focus = selFocus.value;
    if (!state.sb) state.sb = true;
    if (focus === "uart") {
      if (!state.uart) {
        state.lastAction = "connect-miss";
        pushLog("# connect fail — uart absent");
        renderAll();
        return;
      }
      state.uartAp = true;
    } else {
      if (!state.spi) {
        state.lastAction = "connect-miss";
        pushLog("# connect fail — spi absent");
        renderAll();
        return;
      }
      state.spiAp = true;
    }
    state.lastAction = "connect";
    pushLog(`# connect ${focus}.mon.ap → sb`);
    pushTrace(`connect ${focus}.mon.ap → sb`);
    renderAll();
  }

  function disconnectAp() {
    const focus = selFocus.value;
    if (focus === "uart") state.uartAp = false;
    else state.spiAp = false;
    state.lastAction = "disconnect";
    pushLog(`# disconnect ${focus} ap`);
    renderAll();
  }

  function observe() {
    const focus = selFocus.value;
    const present = focus === "uart" ? state.uart : state.spi;
    const ap = focus === "uart" ? state.uartAp : state.spiAp;
    if (!present || !state.sb || !ap) {
      state.lastOk = false;
      state.lastTxn = { from: focus, data: "0xA5" };
      state.lastAction = "observe-fail";
      pushLog(`# observe FAIL — ${focus} ap not ready`);
      pushTrace(`blocked: ${focus} → sb`);
      renderAll();
      return;
    }
    state.lastOk = true;
    state.lastTxn = { from: focus, data: "0xA5" };
    state.lastAction = "observe";
    pushLog(`# observe ${focus} 0xA5 → sb`);
    pushTrace(`${focus}.mon.write → sb actual`);
    renderAll();
  }

  function demo() {
    state.preset = "starter";
    state.uart = true;
    state.spi = true;
    state.sb = true;
    state.uartAp = true;
    state.spiAp = true;
    state.uartActive = true;
    state.spiActive = true;
    state.note = PRESETS.starter.note;
    state.demoed = true;
    syncInputs();
    selFocus.value = "uart";
    observe();
    selFocus.value = "spi";
    observe();
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo fan-in both agents");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: env owns N agents + shared scoreboard; " +
        "each monitor analysis_port connects into the sb."
    );
    renderAll();
  }

  function selectNode(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  const SEL_BLURB = {
    env: "The environment owns agents and shared components like the scoreboard.",
    uart: "UART agent: one interface’s sequencer / driver / monitor bundle.",
    spi: "SPI agent: second interface — same pattern, different protocol.",
    sb: "Shared scoreboard: fans in analysis from every monitor that connects.",
  };

  function renderLab() {
    syncInputs();
    const tree = document.getElementById("env-tree");
    tree.innerHTML = `
      <button type="button" class="node ${state.selected === "env" ? "is-sel" : ""} is-ok" data-node="env">
        <div class="k">env</div><div class="v">agents=${agentCount()} · sb=${state.sb ? 1 : 0}</div>
      </button>
      <button type="button" class="node indent-1 ${state.selected === "uart" ? "is-sel" : ""} ${state.uart ? "is-ok" : "is-off"}" data-node="uart">
        <div class="k">uart_agent</div><div class="v">${state.uart ? (state.uartActive ? "active" : "passive") : "absent"} · ap=${state.uartAp ? 1 : 0}</div>
      </button>
      <button type="button" class="node indent-1 ${state.selected === "spi" ? "is-sel" : ""} ${state.spi ? "is-ok" : "is-off"}" data-node="spi">
        <div class="k">spi_agent</div><div class="v">${state.spi ? (state.spiActive ? "active" : "passive") : "absent"} · ap=${state.spiAp ? 1 : 0}</div>
      </button>
      <button type="button" class="node indent-1 ${state.selected === "sb" ? "is-sel" : ""} ${state.sb ? "is-ok" : "is-off"}" data-node="sb">
        <div class="k">scoreboard</div><div class="v">${state.sb ? "shared" : "absent"} · fan-in</div>
      </button>
    `;
    tree.querySelectorAll("[data-node]").forEach((el) => {
      el.addEventListener("click", () =>
        selectNode(/** @type {string} */ (el.getAttribute("data-node")))
      );
    });

    document.getElementById("link-row").innerHTML = `
      <div class="link-card ${state.uartAp ? "is-on" : ""}">
        <div class="k">UART analysis</div>
        <div>uart.mon.ap ${state.uartAp ? "→ sb" : "(open)"}</div>
      </div>
      <div class="link-card ${state.spiAp ? "is-on" : ""}">
        <div class="k">SPI analysis</div>
        <div>spi.mon.ap ${state.spiAp ? "→ sb" : "(open)"}</div>
      </div>
    `;

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      SEL_BLURB[state.selected] || SEL_BLURB.env;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (state.lastOk === false) {
      v.className = "verdict warn";
      v.textContent = `Observe blocked — connect ${state.lastTxn?.from || "agent"} ap first`;
    } else if (bothAp()) {
      v.className = "verdict yes";
      v.textContent = "Multi-agent env — both analysis links into shared sb";
    } else if (isMulti()) {
      v.className = "verdict warn";
      v.textContent = "Two agents present — finish analysis connects";
    } else {
      v.className = "verdict idle";
      v.textContent = `Agents=${agentCount()} — add SPI / connect ap for full fan-in`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.uart ? "is-ok" : ""}">uart=${state.uart ? 1 : 0}</span>
      <span class="flag ${state.spi ? "is-ok" : ""}">spi=${state.spi ? 1 : 0}</span>
      <span class="flag ${state.sb ? "is-ok" : ""}">sb=${state.sb ? 1 : 0}</span>
      <span class="flag ${state.uartAp ? "is-ok" : ""}">u_ap=${state.uartAp ? 1 : 0}</span>
      <span class="flag ${state.spiAp ? "is-ok" : ""}">s_ap=${state.spiAp ? 1 : 0}</span>
      <span class="flag ${bothAp() ? "is-ok" : ""}">fanin=${bothAp() ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          uart: state.uart,
          spi: state.spi,
          sb: state.sb,
          uartAp: state.uartAp,
          spiAp: state.spiAp,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-env",
      title: "Quiz: env",
      type: "quiz",
      prompt: "A multi-agent environment typically…",
      hint: "N interfaces.",
      choices: [
        "owns two or more agents plus shared checkers like a scoreboard",
        "replaces the DUT with a Makefile",
        "only runs in report_phase",
        "disables all TLM ports",
      ],
      answer: "owns two or more agents plus shared checkers like a scoreboard",
    },
    {
      id: "quiz-fanin",
      title: "Quiz: fan-in",
      type: "quiz",
      prompt: "Monitors from different agents usually…",
      hint: "Analysis.",
      choices: [
        "connect analysis ports into a shared scoreboard",
        "must each own a separate DUT",
        "cannot share an env",
        "only use $dumpvars",
      ],
      answer: "connect analysis ports into a shared scoreboard",
    },
    {
      id: "quiz-agent",
      title: "Quiz: agent",
      type: "quiz",
      prompt: "Each agent is usually scoped to…",
      hint: "Interface.",
      choices: [
        "one interface / protocol role (its own sqr/drv/mon)",
        "the entire chip netlist exclusively",
        "only the factory type override table",
        "GTKWave cursor literacy",
      ],
      answer: "one interface / protocol role (its own sqr/drv/mon)",
    },
    {
      id: "quiz-connect",
      title: "Quiz: connect",
      type: "quiz",
      prompt: "Analysis links into the shared sb are wired in…",
      hint: "Phase.",
      choices: [
        "connect_phase (port.connect(export))",
        "only after $finish",
        "synthesis",
        "timescale pragmas",
      ],
      answer: "connect_phase (port.connect(export))",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — both agents + both ap links.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" && bothAp() && isMulti(),
    },
    {
      id: "load-uart",
      title: "Load UART only",
      prompt: "Load UART only — spi=0.",
      hint: "UART only → Load",
      setup: () => {
        selPreset.value = "uart_only";
        loadPreset();
      },
      check: () => state.uart && !state.spi && state.lastAction === "load",
    },
    {
      id: "add-spi",
      title: "Add SPI",
      prompt: "From UART only, Add agent with focus SPI.",
      hint: "Focus SPI → Add agent",
      setup: () => {
        selPreset.value = "uart_only";
        loadPreset();
        selFocus.value = "spi";
        addAgent();
      },
      check: () => state.spi && state.lastAction === "add",
    },
    {
      id: "connect-spi",
      title: "Connect SPI ap",
      prompt: "From ap_gap, Connect ap on SPI.",
      hint: "SPI ap gap → Load → Focus SPI → Connect",
      setup: () => {
        selPreset.value = "ap_gap";
        loadPreset();
        selFocus.value = "spi";
        connectAp();
      },
      check: () => state.spiAp && state.lastAction === "connect",
    },
    {
      id: "disconnect",
      title: "Disconnect",
      prompt: "On starter, Disconnect UART ap.",
      hint: "Focus UART → Disconnect ap",
      setup: () => {
        loadStarter();
        selFocus.value = "uart";
        disconnectAp();
      },
      check: () => !state.uartAp && state.lastAction === "disconnect",
    },
    {
      id: "observe-ok",
      title: "Observe OK",
      prompt: "On starter, Observe beat (UART) — OK.",
      hint: "Observe beat",
      setup: () => {
        loadStarter();
        selFocus.value = "uart";
        observe();
      },
      check: () =>
        state.lastOk === true &&
        state.lastTxn?.from === "uart" &&
        state.lastAction === "observe",
    },
    {
      id: "observe-fail",
      title: "Observe fail",
      prompt: "From ap_gap, Observe SPI — fail.",
      hint: "ap_gap → Focus SPI → Observe",
      setup: () => {
        selPreset.value = "ap_gap";
        loadPreset();
        selFocus.value = "spi";
        observe();
      },
      check: () =>
        state.lastOk === false && state.lastAction === "observe-fail",
    },
    {
      id: "remove",
      title: "Remove",
      prompt: "On starter, Remove SPI agent.",
      hint: "Focus SPI → Remove agent",
      setup: () => {
        loadStarter();
        selFocus.value = "spi";
        removeAgent();
      },
      check: () => !state.spi && state.lastAction === "remove",
    },
    {
      id: "load-bare",
      title: "Load bare",
      prompt: "Load empty env — agents=0.",
      hint: "empty env → Load",
      setup: () => {
        selPreset.value = "bare";
        loadPreset();
      },
      check: () => agentCount() === 0 && !state.sb,
    },
    {
      id: "add-uart",
      title: "Add UART",
      prompt: "From bare, Add UART agent.",
      hint: "Focus UART → Add agent",
      setup: () => {
        selPreset.value = "bare";
        loadPreset();
        selFocus.value = "uart";
        addAgent();
      },
      check: () => state.uart && state.sb && state.lastAction === "add",
    },
    {
      id: "demo",
      title: "Demo fan-in",
      prompt: "Click Demo fan-in — both ap up, last observe OK.",
      hint: "Demo fan-in",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        bothAp() &&
        state.lastOk === true &&
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
      id: "select-sb",
      title: "Select sb",
      prompt: "Click the scoreboard node.",
      hint: "Click scoreboard",
      setup: () => {
        loadStarter();
        selectNode("sb");
      },
      check: () => state.selected === "sb" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions fan-in.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /fan-in/i.test(sourceSketch()),
    },
    {
      id: "sketch-agents",
      title: "Sketch agents",
      prompt: "Connect sketch shows uart_agent =.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /uart_agent =/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "multi-flag",
      title: "Multi flag",
      prompt: "On starter, isMulti is true.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => isMulti() === true,
    },
    {
      id: "fanin-flag",
      title: "Fan-in flag",
      prompt: "On starter, bothAp / fanin=1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => bothAp() === true,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From bare, Reset — both ap linked again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "bare";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" && bothAp() && isMulti(),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="uma-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("uma-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-add").addEventListener("click", () => addAgent());
  document.getElementById("btn-remove").addEventListener("click", () => removeAgent());
  document.getElementById("btn-connect").addEventListener("click", () => connectAp());
  document.getElementById("btn-disconnect").addEventListener("click", () => disconnectAp());
  document.getElementById("btn-observe").addEventListener("click", () => observe());
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
      if (saved && typeof saved.uart === "boolean") {
        state.uart = saved.uart;
        state.spi = !!saved.spi;
        state.sb = !!saved.sb;
        state.uartAp = !!saved.uartAp;
        state.spiAp = !!saved.spiAp;
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
