(() => {
  /**
   * cocotb Clock helper (concept)
   *   Clock(dut.clk, period, units="ns").start()
   * Starter: period 10 → posedges at 10, 20, 30
   */

  const IDEAS = {
    period: "period sets the time between successive posedges.",
    start: ".start() launches a background coroutine toggling clk.",
    edges: "First three posedges land at period, 2×period, 3×period.",
    units: 'units="ns" (or ps/us) labels sim-time for the helper.',
  };

  const UNITS = {
    ns: { label: "ns", factor: 1 },
    ps: { label: "ps", factor: 0.001 },
    us: { label: "us", factor: 1000 },
  };

  const PRESETS = {
    starter: {
      label: "starter: period 10 → 10/20/30",
      periodNs: 10,
      edgeCount: 3,
      units: "ns",
      note: "Clock.start with period 10 ns — posedges at 10, 20, 30.",
      autoStart: true,
    },
    fast: {
      label: "fast: period 5",
      periodNs: 5,
      edgeCount: 3,
      units: "ns",
      note: "Shorter period — edges at 5, 10, 15.",
      autoStart: true,
    },
    slow: {
      label: "slow: period 25",
      periodNs: 25,
      edgeCount: 3,
      units: "ns",
      note: "Longer period — edges at 25, 50, 75.",
      autoStart: true,
    },
    five_edges: {
      label: "five edges @ period 8",
      periodNs: 8,
      edgeCount: 5,
      units: "ns",
      note: "Show five posedges — 8, 16, 24, 32, 40.",
      autoStart: true,
    },
    one_edge: {
      label: "single edge preview",
      periodNs: 12,
      edgeCount: 1,
      units: "ns",
      note: "Only the first posedge at t=12.",
      autoStart: true,
    },
    wide: {
      label: "period 100 (wide)",
      periodNs: 100,
      edgeCount: 3,
      units: "ns",
      note: "Wide period for slow-clock literacy — 100, 200, 300.",
      autoStart: true,
    },
    micro: {
      label: "micro: 2 us period",
      periodNs: 2,
      edgeCount: 3,
      units: "us",
      note: "units='us' — period 2 µs → posedges at 2000, 4000, 6000 ns display.",
      autoStart: true,
    },
    idle: {
      label: "idle (edit then Start)",
      periodNs: 10,
      edgeCount: 3,
      units: "ns",
      note: "Idle — Load a preset or change period, then Start clock.",
      autoStart: false,
    },
  };

  function sourceSketch() {
    return `# cocotb Clock literacy (not a live simulator)
# from cocotb.clock import Clock
#
# clk_gen = Clock(dut.clk, 10, units="ns")
# clk_gen.start()          # background toggle coroutine
#
# # first posedges (sketch):
# #   t = period, 2*period, 3*period, ...
#
# period  → half-period low, half-period high
# .start() → runs alongside your test coroutine
# await RisingEdge(dut.clk) → sync to generated edges
#
# Do not confuse Clock helper with manual dut.clk.value toggling.`;
  }

  function toDisplayNs(period, units) {
    const u = UNITS[units] || UNITS.ns;
    return Math.max(1, Math.round(Number(period) * u.factor));
  }

  function computeEdges(periodVal, edgeCount, units) {
    const u = units in UNITS ? units : "ns";
    const p = toDisplayNs(periodVal, u);
    const n = Math.max(1, Math.min(10, Number(edgeCount) || 3));
    const edges = [];
    const halfMarks = [0];
    for (let i = 1; i <= n; i++) {
      edges.push(p * i);
      if (i <= n) halfMarks.push(p * i - p / 2);
    }
    halfMarks.sort((a, b) => a - b);
    return { periodNs: p, periodVal: Math.max(1, Number(periodVal) || 10), edgeCount: n, edges, halfMarks, units: u };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const calc = computeEdges(p.periodNs, p.edgeCount, p.units || "ns");
    return {
      preset: "starter",
      periodNs: calc.periodNs,
      periodVal: calc.periodVal,
      units: calc.units,
      edgeCount: calc.edgeCount,
      edges: calc.edges,
      halfMarks: calc.halfMarks,
      started: true,
      note: p.note,
      selected: "period",
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`start: period=${calc.periodNs} edges=${calc.edges.join(",")}`],
    };
  }

  const CLEARED_KEY = "ddv-cocotb-clock-helper-cleared-v1";
  const STORE_KEY = "ddv-cocotb-clock-helper-session-v1";

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

  const root = document.getElementById("cclk-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>Clock(dut.clk, 10, units="ns").start()</code> —
        posedges at <code>10, 20, 30</code> ns.</p>
      <button type="button" class="btn btn-secondary" id="cclk-starter">Load starter example</button>
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
        <div class="idea-card"><h3>period</h3><p>Time between successive posedges.</p></div>
        <div class="idea-card"><h3>.start()</h3><p>Background coroutine toggles clk.</p></div>
        <div class="idea-card"><h3>edges</h3><p>Posedges at period × n.</p></div>
        <div class="idea-card"><h3>units</h3><p>ns/ps/us label sim-time.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="cclk-controls">
        <div class="cclk-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>period 10 → 10/20/30</option>
            <option value="fast">fast period 5</option>
            <option value="slow">slow period 25</option>
            <option value="five_edges">five edges @8</option>
            <option value="one_edge">single edge</option>
            <option value="wide">period 100</option>
            <option value="micro">2 us period</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="cclk-field">
          <label for="inp-period">Period</label>
          <input id="inp-period" type="number" min="1" max="500" value="10" />
        </div>
        <div class="cclk-field">
          <label for="sel-units">Units</label>
          <select id="sel-units">
            <option value="ns" selected>ns</option>
            <option value="ps">ps</option>
            <option value="us">us</option>
          </select>
        </div>
        <div class="cclk-field">
          <label for="inp-count">Edge count</label>
          <input id="inp-count" type="number" min="1" max="10" value="3" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-start">Start clock</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo wide period</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="cclk-layout">
        <div class="panel-box">
          <h3>Edge timeline (ns)</h3>
          <div class="edge-timeline" id="edge-timeline"></div>
          <h3>Half-period marks</h3>
          <div class="half-timeline" id="half-timeline"></div>
          <h3>Wave sketch</h3>
          <div class="wave-strip" id="wave-strip"></div>
          <h3>Ideas</h3>
          <div class="idea-row" id="idea-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Start sketch</h3>
          <pre class="start-box" id="start-box"></pre>
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
  const inpPeriod = /** @type {HTMLInputElement} */ (document.getElementById("inp-period"));
  const inpCount = /** @type {HTMLInputElement} */ (document.getElementById("inp-count"));
  const selUnits = /** @type {HTMLSelectElement} */ (document.getElementById("sel-units"));

  function startSketch() {
    const u = UNITS[state.units] || UNITS.ns;
    return `# clk_gen = Clock(dut.clk, ${state.periodVal}, units="${u.label}")
# clk_gen.start()
#
# posedges (ns): ${state.started ? state.edges.join(", ") : "— (Start clock)"}
# period=${state.periodVal}${u.label} (${state.periodNs} ns display)  count=${state.edgeCount}`;
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
    if (document.activeElement !== inpPeriod) inpPeriod.value = String(state.periodVal ?? state.periodNs);
    if (document.activeElement !== inpCount) inpCount.value = String(state.edgeCount);
    selUnits.value = state.units in UNITS ? state.units : "ns";
  }

  function readInputs() {
    state.periodVal = Math.max(1, Number(inpPeriod.value) || 10);
    state.units = selUnits.value in UNITS ? selUnits.value : "ns";
    state.edgeCount = Math.max(1, Math.min(10, Number(inpCount.value) || 3));
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter period 10 edges 10/20/30");
    renderAll();
  }

  function runStart(silent) {
    readInputs();
    const calc = computeEdges(state.periodVal, state.edgeCount, state.units);
    state.periodNs = calc.periodNs;
    state.periodVal = calc.periodVal;
    state.units = calc.units;
    state.edgeCount = calc.edgeCount;
    state.edges = calc.edges;
    state.halfMarks = calc.halfMarks;
    state.started = true;
    pushTrace(`start: period=${calc.periodVal}${calc.units} edges=${calc.edges.join(",")}`);
    if (!silent) {
      state.lastAction = "start-ok";
      pushLog(`# start period=${calc.periodNs}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.periodVal = p.periodNs;
    state.periodNs = toDisplayNs(p.periodNs, p.units || "ns");
    state.units = p.units || "ns";
    state.edgeCount = p.edgeCount;
    state.note = p.note;
    state.started = false;
    state.edges = [];
    state.halfMarks = [];
    syncInputs();
    if (p.autoStart) {
      runStart(true);
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
    applyPreset("wide", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo wide period 100");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: Clock.start runs a background toggle; posedges at n×period."
    );
    renderAll();
  }

  function selectIdea(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();

    const allTimes = [0, ...state.edges];
    const maxT = state.edges.length ? state.edges[state.edges.length - 1] : state.periodNs * 3;
    document.getElementById("edge-timeline").innerHTML = state.started
      ? allTimes
          .map((t) => {
            const isEdge = state.edges.includes(t);
            const isFirst = t === state.edges[0];
            return `<span class="edge-tick ${isEdge ? "is-edge" : ""} ${isFirst ? "is-first" : ""}">${t}${isEdge ? " ↑" : ""}</span>`;
          })
          .join("")
      : `<span class="edge-tick">—</span>`;

    document.getElementById("half-timeline").innerHTML = state.started
      ? state.halfMarks
          .filter((t) => t >= 0 && t <= maxT)
          .map((t) => {
            const isHalf = t > 0 && !state.edges.includes(t);
            return `<span class="edge-tick ${isHalf ? "is-half" : ""}">${Number.isInteger(t) ? t : t.toFixed(1)}${isHalf ? " ◦" : t === 0 ? " 0" : ""}</span>`;
          })
          .join("")
      : `<span class="edge-tick">—</span>`;

    const wave = document.getElementById("wave-strip");
    if (!state.started) {
      wave.innerHTML = `<span class="queue-empty">(Start clock to draw wave sketch)</span>`;
    } else {
      const segs = [];
      for (let i = 0; i < state.edges.length; i++) {
        const t = state.edges[i];
        segs.push(
          `<div class="wave-seg ${i % 2 === 0 ? "is-high" : ""}"><span class="edge-mark">${t}↑</span></div>`
        );
      }
      wave.innerHTML = `<span>0</span>${segs.join("")}<span>${maxT}ns</span>`;
    }

    document.getElementById("idea-row").innerHTML = Object.entries(IDEAS)
      .map(
        ([id]) => `
      <button type="button" class="idea-btn ${state.selected === id ? "is-sel" : ""}" data-idea="${id}">
        <div class="k">${id}</div>
        <div class="v">${id === "start" ? ".start()" : id}</div>
      </button>`
      )
      .join("");
    document.querySelectorAll("[data-idea]").forEach((el) => {
      el.addEventListener("click", () =>
        selectIdea(/** @type {string} */ (el.getAttribute("data-idea")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      IDEAS[state.selected] || IDEAS.period;
    document.getElementById("start-box").textContent = startSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.started) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Start clock";
    } else {
      v.className = "verdict yes";
      v.textContent = `Clock started — period ${state.periodVal}${(UNITS[state.units] || UNITS.ns).label} (${state.periodNs} ns), edges: ${state.edges.join(", ")}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">period=${state.periodVal}${(UNITS[state.units] || UNITS.ns).label}</span>
      <span class="flag ${state.started ? "is-ok" : ""}">started=${state.started ? 1 : 0}</span>
      <span class="flag ${state.edges.length ? "is-ok" : ""}">edges=${state.started ? state.edges.length : "—"}</span>
      <span class="flag ${state.started && state.edges[0] === state.periodNs ? "is-ok" : ""}">e0=${state.started ? state.edges[0] : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          periodVal: state.periodVal,
          periodNs: state.periodNs,
          units: state.units,
          edgeCount: state.edgeCount,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-period",
      title: "Quiz: period",
      type: "quiz",
      prompt: "Clock(dut.clk, period, …) period means…",
      hint: "Between posedges.",
      choices: [
        "sim-time between successive posedges",
        "number of test failures allowed",
        "VCD file size in MB",
        "UVM verbosity level",
      ],
      answer: "sim-time between successive posedges",
    },
    {
      id: "quiz-start",
      title: "Quiz: .start()",
      type: "quiz",
      prompt: "clk_gen.start()…",
      hint: "Background.",
      choices: [
        "launches a background coroutine that toggles the clock",
        "stops the simulator immediately",
        "replaces await RisingEdge forever",
        "writes the Makefile",
      ],
      answer: "launches a background coroutine that toggles the clock",
    },
    {
      id: "quiz-edges",
      title: "Quiz: edge times",
      type: "quiz",
      prompt: "With period P, first three posedges land at…",
      hint: "n×P.",
      choices: ["P, 2P, 3P", "0, P, 2P", "P/2, P, 3P/2", "random times"],
      answer: "P, 2P, 3P",
    },
    {
      id: "quiz-units",
      title: "Quiz: units",
      type: "quiz",
      prompt: 'units="ns" on Clock…',
      hint: "Time label.",
      choices: [
        "labels the period argument in nanoseconds of sim-time",
        "sets Python logging level",
        "disables cocotb triggers",
        "converts hex to binary",
      ],
      answer: "labels the period argument in nanoseconds of sim-time",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — edges 10, 20, 30.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.started &&
        state.edges.join(",") === "10,20,30",
    },
    {
      id: "load-fast",
      title: "Load fast",
      prompt: "Load fast period 5 — edges 5,10,15.",
      hint: "fast period 5 → Load",
      setup: () => {
        selPreset.value = "fast";
        loadPreset();
      },
      check: () => state.periodNs === 5 && state.edges.join(",") === "5,10,15",
    },
    {
      id: "load-slow",
      title: "Load slow",
      prompt: "Load slow period 25 — first edge 25.",
      hint: "slow period 25 → Load",
      setup: () => {
        selPreset.value = "slow";
        loadPreset();
      },
      check: () => state.periodNs === 25 && state.edges[0] === 25,
    },
    {
      id: "load-five",
      title: "Load five edges",
      prompt: "Load five edges @8 — 5 edges ending 40.",
      hint: "five edges @8 → Load",
      setup: () => {
        selPreset.value = "five_edges";
        loadPreset();
      },
      check: () => state.edges.length === 5 && state.edges[4] === 40,
    },
    {
      id: "load-one",
      title: "Load single edge",
      prompt: "Load single edge — only one posedge.",
      hint: "single edge → Load",
      setup: () => {
        selPreset.value = "one_edge";
        loadPreset();
      },
      check: () => state.edges.length === 1 && state.edges[0] === 12,
    },
    {
      id: "load-wide",
      title: "Load wide",
      prompt: "Load period 100 — edges 100,200,300.",
      hint: "period 100 → Load",
      setup: () => {
        selPreset.value = "wide";
        loadPreset();
      },
      check: () => state.edges.join(",") === "100,200,300",
    },
    {
      id: "start-ok",
      title: "Start OK",
      prompt: "From idle, Start clock — edges computed.",
      hint: "idle → Start clock",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        inpPeriod.value = "7";
        inpCount.value = "3";
        runStart(false);
      },
      check: () =>
        state.lastAction === "start-ok" &&
        state.edges.join(",") === "7,14,21",
    },
    {
      id: "demo",
      title: "Demo wide",
      prompt: "Click Demo wide period.",
      hint: "Demo wide period",
      setup: () => loadStarter(),
      check: () => state.demoed && state.periodNs === 100,
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
      id: "select-start",
      title: "Select start",
      prompt: "Click the start idea card.",
      hint: "Click start",
      setup: () => {
        loadStarter();
        selectIdea("start");
      },
      check: () => state.selected === "start" && state.lastAction === "select",
    },
    {
      id: "select-edges",
      title: "Select edges",
      prompt: "Click the edges idea card.",
      hint: "Click edges",
      setup: () => {
        loadStarter();
        selectIdea("edges");
      },
      check: () => state.selected === "edges" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions Clock and .start().",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /Clock/.test(sourceSketch()) && /\.start\(\)/.test(sourceSketch()),
    },
    {
      id: "start-sketch",
      title: "Start sketch",
      prompt: "On starter, start sketch shows period 10.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /period=10/.test(document.getElementById("start-box").textContent),
    },
    {
      id: "edge-second",
      title: "Second edge",
      prompt: "Starter second edge is 20.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.edges[1] === 20,
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet started.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () => !state.started && state.lastAction === "load",
    },
    {
      id: "load-micro",
      title: "Load micro",
      prompt: "Load 2 us period — edges 2000, 4000, 6000 ns.",
      hint: "2 us period → Load",
      setup: () => {
        selPreset.value = "micro";
        loadPreset();
      },
      check: () => state.units === "us" && state.edges.join(",") === "2000,4000,6000",
    },
    {
      id: "period-knob",
      title: "Period knob",
      prompt: "On starter, periodNs is 10.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.periodNs === 10 && state.started,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From wide, Reset — starter edges again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "wide";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.edges.join(",") === "10,20,30",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="cclk-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("cclk-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-start").addEventListener("click", () => runStart(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  inpPeriod.addEventListener("input", () => {
    state.started = false;
    state.lastAction = "edit";
  });
  inpCount.addEventListener("input", () => {
    state.started = false;
    state.lastAction = "edit";
  });
  selUnits.addEventListener("change", () => {
    state.started = false;
    state.lastAction = "edit";
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
      if (saved && (saved.periodNs || saved.periodVal)) {
        state.periodVal = saved.periodVal || saved.periodNs || 10;
        state.periodNs = saved.periodNs || 10;
        state.units = saved.units || "ns";
        state.edgeCount = saved.edgeCount || 3;
        state.preset = saved.preset || "starter";
        state.started = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
