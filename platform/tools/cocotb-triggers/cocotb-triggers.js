(() => {
  /**
   * cocotb triggers (concept)
   *   RisingEdge / Timer / First / Combine on a tiny timeline
   * Starter: await RisingEdge(clk) fires at t=10
   */

  const TRIGGERS = {
    rising: {
      title: "RisingEdge",
      blurb: "await RisingEdge(clk) — resumes on the next 0→1 clock edge.",
    },
    falling: {
      title: "FallingEdge",
      blurb: "await FallingEdge(clk) — resumes on the next 1→0 clock edge.",
    },
    timer: {
      title: "Timer",
      blurb: "await Timer(N, units='ns') — resumes after N time units (no edge needed).",
    },
    first: {
      title: "First",
      blurb: "await First(A, B) — resumes when the earliest of A or B completes (cancel the rest).",
    },
    combine: {
      title: "Combine",
      blurb: "await Combine(A, B) — resumes only when all listed triggers have completed.",
    },
  };

  const PRESETS = {
    starter: {
      label: "starter: RisingEdge @10",
      kind: "rising",
      edges: [10, 20, 30],
      falls: [15, 25],
      timerNs: 50,
      horizon: 40,
      note: "RisingEdge waits for clk↑ — first rise at t=10 fires the await.",
      autoAwait: true,
    },
    falling: {
      label: "FallingEdge @15",
      kind: "falling",
      edges: [10, 20],
      falls: [15, 25],
      timerNs: 50,
      horizon: 40,
      note: "FallingEdge fires on first fall at t=15.",
      autoAwait: true,
    },
    timer: {
      label: "Timer(25)",
      kind: "timer",
      edges: [10, 20, 30],
      falls: [15],
      timerNs: 25,
      horizon: 40,
      note: "Timer ignores edges — completes at t=25.",
      autoAwait: true,
    },
    first_edge: {
      label: "First(edge, Timer) — edge wins",
      kind: "first",
      edges: [10, 20],
      falls: [15],
      timerNs: 40,
      horizon: 50,
      note: "First(RisingEdge, Timer(40)) — edge at 10 beats the timer.",
      autoAwait: true,
    },
    first_timer: {
      label: "First(edge, Timer) — timer wins",
      kind: "first",
      edges: [30, 40],
      falls: [35],
      timerNs: 12,
      horizon: 50,
      note: "First(RisingEdge, Timer(12)) — timer fires before the late edge.",
      autoAwait: true,
    },
    combine: {
      label: "Combine(edge, Timer)",
      kind: "combine",
      edges: [10, 20],
      falls: [15],
      timerNs: 25,
      horizon: 40,
      note: "Combine waits for both — completes at max(edge=10, timer=25) → t=25.",
      autoAwait: true,
    },
    no_edge: {
      label: "RisingEdge but no rise",
      kind: "rising",
      edges: [],
      falls: [5, 15],
      timerNs: 20,
      horizon: 30,
      note: "No rising edges in horizon — RisingEdge await fails / hangs (sketch: FAIL).",
      autoAwait: true,
    },
    idle: {
      label: "idle (edit then Await)",
      kind: "rising",
      edges: [10],
      falls: [15],
      timerNs: 20,
      horizon: 40,
      note: "Idle — Load a preset or change knobs, then Await.",
      autoAwait: false,
    },
  };

  function sourceSketch() {
    return `# cocotb trigger literacy (not a live simulator)
# async def test(dut):
#     await RisingEdge(dut.clk)          # next 0→1
#     await FallingEdge(dut.clk)         # next 1→0
#     await Timer(25, units="ns")        # delay
#     await First(RisingEdge(dut.clk), Timer(40, units="ns"))
#     await Combine(RisingEdge(dut.clk), Timer(25, units="ns"))
#
# RisingEdge / FallingEdge  → pin edge events
# Timer                     → time delay (no edge)
# First                     → earliest wins
# Combine                   → wait for all
#
# pyuvm tests still await cocotb triggers under the hood.`;
  }

  function simulate(kind, edges, falls, timerNs, horizon) {
    const rises = [...edges].filter((t) => t >= 0 && t <= horizon).sort((a, b) => a - b);
    const downs = [...falls].filter((t) => t >= 0 && t <= horizon).sort((a, b) => a - b);
    const edgeT = rises.length ? rises[0] : null;
    const fallT = downs.length ? downs[0] : null;
    const timerT = timerNs;

    let fireAt = null;
    let winner = null;
    let ok = false;

    if (kind === "rising") {
      fireAt = edgeT;
      winner = edgeT != null ? "RisingEdge" : null;
      ok = edgeT != null;
    } else if (kind === "falling") {
      fireAt = fallT;
      winner = fallT != null ? "FallingEdge" : null;
      ok = fallT != null;
    } else if (kind === "timer") {
      fireAt = timerT <= horizon ? timerT : null;
      winner = fireAt != null ? "Timer" : null;
      ok = fireAt != null;
    } else if (kind === "first") {
      const candidates = [];
      if (edgeT != null) candidates.push({ t: edgeT, name: "RisingEdge" });
      if (timerT <= horizon) candidates.push({ t: timerT, name: "Timer" });
      candidates.sort((a, b) => a.t - b.t || a.name.localeCompare(b.name));
      if (candidates.length) {
        fireAt = candidates[0].t;
        winner = candidates[0].name;
        ok = true;
      }
    } else if (kind === "combine") {
      if (edgeT != null && timerT <= horizon) {
        fireAt = Math.max(edgeT, timerT);
        winner = "Combine";
        ok = true;
      } else {
        fireAt = null;
        winner = null;
        ok = false;
      }
    }

    return { rises, downs, edgeT, fallT, timerT, fireAt, winner, ok };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const sim = simulate(p.kind, p.edges, p.falls, p.timerNs, p.horizon);
    return {
      preset: "starter",
      kind: p.kind,
      edges: [...p.edges],
      falls: [...p.falls],
      timerNs: p.timerNs,
      horizon: p.horizon,
      note: p.note,
      selected: "rising",
      sim,
      lastAwaited: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`await: ${sim.winner}@${sim.fireAt} ok=${sim.ok ? 1 : 0}`],
    };
  }

  const CLEARED_KEY = "ddv-cocotb-triggers-cleared-v1";
  const STORE_KEY = "ddv-cocotb-triggers-session-v1";

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

  const root = document.getElementById("ctrig-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>await RisingEdge(clk)</code> —
        first rise at <code>t=10</code> completes the await.</p>
      <button type="button" class="btn btn-secondary" id="ctrig-starter">Load starter example</button>
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
        <div class="idea-card"><h3>RisingEdge</h3><p>Wait for next 0→1 on a pin.</p></div>
        <div class="idea-card"><h3>Timer</h3><p>Wait a duration — no edge required.</p></div>
        <div class="idea-card"><h3>First</h3><p>Earliest of several triggers wins.</p></div>
        <div class="idea-card"><h3>Combine</h3><p>Resume only when all triggers done.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ctrig-controls">
        <div class="ctrig-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>RisingEdge @10</option>
            <option value="falling">FallingEdge @15</option>
            <option value="timer">Timer(25)</option>
            <option value="first_edge">First — edge wins</option>
            <option value="first_timer">First — timer wins</option>
            <option value="combine">Combine</option>
            <option value="no_edge">no rising edge</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="ctrig-field">
          <label for="sel-kind">Trigger</label>
          <select id="sel-kind">
            <option value="rising">RisingEdge</option>
            <option value="falling">FallingEdge</option>
            <option value="timer">Timer</option>
            <option value="first">First(edge, Timer)</option>
            <option value="combine">Combine(edge, Timer)</option>
          </select>
        </div>
        <div class="ctrig-field">
          <label for="inp-timer">Timer ns</label>
          <input id="inp-timer" type="number" min="1" max="200" value="50" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-await">Await</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo no edge</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ctrig-layout">
        <div class="panel-box">
          <h3>Timeline (ns)</h3>
          <div class="timeline" id="timeline"></div>
          <h3>Trigger cards</h3>
          <div class="trigger-row" id="trigger-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Await sketch</h3>
          <pre class="await-box" id="await-box"></pre>
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
  const selKind = /** @type {HTMLSelectElement} */ (document.getElementById("sel-kind"));
  const inpTimer = /** @type {HTMLInputElement} */ (document.getElementById("inp-timer"));

  function awaitSketch() {
    const s = state.sim;
    const kind = state.kind;
    let line = "";
    if (kind === "rising") line = "await RisingEdge(dut.clk)";
    else if (kind === "falling") line = "await FallingEdge(dut.clk)";
    else if (kind === "timer") line = `await Timer(${state.timerNs}, units="ns")`;
    else if (kind === "first")
      line = `await First(RisingEdge(dut.clk), Timer(${state.timerNs}, units="ns"))`;
    else line = `await Combine(RisingEdge(dut.clk), Timer(${state.timerNs}, units="ns"))`;

    return `# ${line}
#
# rises @ ${state.edges.join(",") || "—"}
# falls @ ${state.falls.join(",") || "—"}
# timer = ${state.timerNs} ns   horizon = ${state.horizon}
#
# result: ${s.ok ? `OK · ${s.winner} @ t=${s.fireAt}` : "FAIL · no completion in horizon"}`;
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
    selKind.value = state.kind;
    inpTimer.value = String(state.timerNs);
  }

  function readInputs() {
    state.kind = selKind.value;
    state.timerNs = Math.max(1, Number(inpTimer.value) || 1);
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter RisingEdge @10");
    renderAll();
  }

  function runAwait(silent) {
    readInputs();
    state.sim = simulate(
      state.kind,
      state.edges,
      state.falls,
      state.timerNs,
      state.horizon
    );
    state.lastAwaited = true;
    const s = state.sim;
    pushTrace(
      `await: ${s.winner || "—"}@${s.fireAt == null ? "—" : s.fireAt} ok=${s.ok ? 1 : 0}`
    );
    if (!silent) {
      state.lastAction = s.ok ? "await-ok" : "await-bad";
      pushLog(`# await ${s.ok ? "OK" : "FAIL"}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.kind = p.kind;
    state.edges = [...p.edges];
    state.falls = [...p.falls];
    state.timerNs = p.timerNs;
    state.horizon = p.horizon;
    state.note = p.note;
    state.selected = p.kind === "first" || p.kind === "combine" ? p.kind : p.kind;
    state.sim = simulate(p.kind, p.edges, p.falls, p.timerNs, p.horizon);
    state.lastAwaited = false;
    syncInputs();
    if (p.autoAwait) {
      runAwait(true);
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
    applyPreset("no_edge", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo no rising edge");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: RisingEdge/FallingEdge wait pins; Timer waits time; " +
        "First = earliest; Combine = all done."
    );
    renderAll();
  }

  function selectTrigger(id) {
    state.selected = id;
    if (id === "rising" || id === "falling" || id === "timer" || id === "first" || id === "combine") {
      state.kind = id;
      selKind.value = id;
    }
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const s = state.sim;
    const marks = new Map();
    for (const t of state.edges) marks.set(t, (marks.get(t) || "") + "↑");
    for (const t of state.falls) marks.set(t, (marks.get(t) || "") + "↓");
    if (state.kind === "timer" || state.kind === "first" || state.kind === "combine") {
      const cur = marks.get(state.timerNs) || "";
      if (!cur.includes("T")) marks.set(state.timerNs, cur + "T");
    }
    const times = [...new Set([0, ...marks.keys(), s.fireAt].filter((x) => x != null))]
      .filter((t) => t >= 0 && t <= state.horizon)
      .sort((a, b) => a - b);

    document.getElementById("timeline").innerHTML = times
      .map((t) => {
        const tag = marks.get(t) || "";
        const isEdge = /[↑↓]/.test(tag);
        const isFire = s.fireAt === t && state.lastAwaited;
        return `<span class="tick ${isEdge ? "is-edge" : ""} ${isFire ? "is-fire" : ""}">${t}${tag ? " " + tag : ""}</span>`;
      })
      .join("");

    document.getElementById("trigger-row").innerHTML = Object.entries(TRIGGERS)
      .map(
        ([id, info]) => `
      <button type="button" class="trigger-card ${state.selected === id ? "is-sel" : ""}" data-trig="${id}">
        <div class="k">${info.title}</div>
        <div class="v">${id === state.kind ? "active" : "—"}</div>
      </button>`
      )
      .join("");
    document.querySelectorAll("[data-trig]").forEach((el) => {
      el.addEventListener("click", () =>
        selectTrigger(/** @type {string} */ (el.getAttribute("data-trig")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      (TRIGGERS[state.selected] || TRIGGERS.rising).blurb;
    document.getElementById("await-box").textContent = awaitSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastAwaited) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Await";
    } else if (s.ok) {
      v.className = "verdict yes";
      v.textContent = `Await OK — ${s.winner} @ t=${s.fireAt}`;
    } else {
      v.className = "verdict no";
      v.textContent = "Await FAIL — no completion in horizon";
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">kind=${state.kind}</span>
      <span class="flag ${s.ok && state.lastAwaited ? "is-ok" : state.lastAwaited ? "is-bad" : ""}">ok=${state.lastAwaited ? (s.ok ? 1 : 0) : "—"}</span>
      <span class="flag ${s.fireAt != null ? "is-ok" : ""}">t=${s.fireAt == null ? "—" : s.fireAt}</span>
      <span class="flag ${s.winner ? "is-ok" : ""}">win=${s.winner || "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          kind: state.kind,
          timerNs: state.timerNs,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-rising",
      title: "Quiz: RisingEdge",
      type: "quiz",
      prompt: "await RisingEdge(clk) resumes when…",
      hint: "0→1.",
      choices: [
        "the clock next transitions 0→1",
        "any amount of time passes",
        "FallingEdge fires first always",
        "the DUT is synthesized",
      ],
      answer: "the clock next transitions 0→1",
    },
    {
      id: "quiz-timer",
      title: "Quiz: Timer",
      type: "quiz",
      prompt: "await Timer(N, units='ns')…",
      hint: "Delay.",
      choices: [
        "waits N time units without needing a pin edge",
        "only works on RisingEdge",
        "replaces the scoreboard",
        "sets +UVM_TESTNAME",
      ],
      answer: "waits N time units without needing a pin edge",
    },
    {
      id: "quiz-first",
      title: "Quiz: First",
      type: "quiz",
      prompt: "await First(A, B) completes when…",
      hint: "Earliest.",
      choices: [
        "the earliest of A or B finishes (others cancelled)",
        "both A and B must finish",
        "neither A nor B may finish",
        "only after reset",
      ],
      answer: "the earliest of A or B finishes (others cancelled)",
    },
    {
      id: "quiz-combine",
      title: "Quiz: Combine",
      type: "quiz",
      prompt: "await Combine(A, B) completes when…",
      hint: "All.",
      choices: [
        "all listed triggers have completed",
        "only the first trigger completes",
        "the Makefile PHONY runs",
        "verbosity is UVM_NONE",
      ],
      answer: "all listed triggers have completed",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — RisingEdge @10 OK.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.sim.ok &&
        state.sim.fireAt === 10 &&
        state.sim.winner === "RisingEdge",
    },
    {
      id: "load-fall",
      title: "Load FallingEdge",
      prompt: "Load FallingEdge @15.",
      hint: "FallingEdge @15 → Load",
      setup: () => {
        selPreset.value = "falling";
        loadPreset();
      },
      check: () =>
        state.sim.winner === "FallingEdge" &&
        state.sim.fireAt === 15 &&
        state.lastAction === "load",
    },
    {
      id: "load-timer",
      title: "Load Timer",
      prompt: "Load Timer(25) — winner Timer @25.",
      hint: "Timer(25) → Load",
      setup: () => {
        selPreset.value = "timer";
        loadPreset();
      },
      check: () =>
        state.sim.winner === "Timer" && state.sim.fireAt === 25,
    },
    {
      id: "load-first-edge",
      title: "First edge wins",
      prompt: "Load First — edge wins.",
      hint: "First — edge wins → Load",
      setup: () => {
        selPreset.value = "first_edge";
        loadPreset();
      },
      check: () =>
        state.kind === "first" &&
        state.sim.winner === "RisingEdge" &&
        state.sim.fireAt === 10,
    },
    {
      id: "load-first-timer",
      title: "First timer wins",
      prompt: "Load First — timer wins.",
      hint: "First — timer wins → Load",
      setup: () => {
        selPreset.value = "first_timer";
        loadPreset();
      },
      check: () =>
        state.sim.winner === "Timer" && state.sim.fireAt === 12,
    },
    {
      id: "load-combine",
      title: "Load Combine",
      prompt: "Load Combine — fires at max(10,25)=25.",
      hint: "Combine → Load",
      setup: () => {
        selPreset.value = "combine";
        loadPreset();
      },
      check: () =>
        state.sim.winner === "Combine" && state.sim.fireAt === 25,
    },
    {
      id: "await-ok",
      title: "Await OK",
      prompt: "From idle RisingEdge, Await — OK @10.",
      hint: "idle → Await",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        selKind.value = "rising";
        state.kind = "rising";
        state.edges = [10];
        runAwait(false);
      },
      check: () =>
        state.sim.ok &&
        state.lastAction === "await-ok" &&
        state.sim.fireAt === 10,
    },
    {
      id: "await-bad",
      title: "Await FAIL",
      prompt: "Load no rising edge — Await FAIL.",
      hint: "no rising edge → Load",
      setup: () => {
        selPreset.value = "no_edge";
        loadPreset();
      },
      check: () => !state.sim.ok && state.lastAwaited,
    },
    {
      id: "demo",
      title: "Demo no edge",
      prompt: "Click Demo no edge.",
      hint: "Demo no edge",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.sim.ok &&
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
      id: "select-timer",
      title: "Select Timer",
      prompt: "Click the Timer trigger card.",
      hint: "Click Timer",
      setup: () => {
        loadStarter();
        selectTrigger("timer");
      },
      check: () =>
        state.selected === "timer" && state.lastAction === "select",
    },
    {
      id: "select-first",
      title: "Select First",
      prompt: "Click the First trigger card.",
      hint: "Click First",
      setup: () => {
        loadStarter();
        selectTrigger("first");
      },
      check: () =>
        state.selected === "first" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions First or Combine.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /First|Combine/.test(sourceSketch()),
    },
    {
      id: "await-sketch",
      title: "Await sketch",
      prompt: "On starter, await sketch shows RisingEdge.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /RisingEdge/.test(document.getElementById("await-box").textContent),
    },
    {
      id: "timer-knob",
      title: "Timer knob",
      prompt: "On timer preset, timerNs is 25.",
      hint: "Timer(25) → Load",
      setup: () => {
        selPreset.value = "timer";
        loadPreset();
      },
      check: () => state.timerNs === 25,
    },
    {
      id: "combine-max",
      title: "Combine max",
      prompt: "Combine fireAt equals max(edge, timer).",
      hint: "Combine → Load",
      setup: () => {
        selPreset.value = "combine";
        loadPreset();
      },
      check: () =>
        state.sim.fireAt === Math.max(state.sim.edgeT, state.sim.timerT),
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet awaited.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastAwaited && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From no_edge, Reset — RisingEdge @10 OK.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "no_edge";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.sim.ok &&
        state.sim.fireAt === 10,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ctrig-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ctrig-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-await").addEventListener("click", () => runAwait(false));
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
      if (saved && saved.kind) {
        state.kind = saved.kind;
        state.timerNs = saved.timerNs || state.timerNs;
        state.preset = saved.preset || "starter";
        state.lastAwaited = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
