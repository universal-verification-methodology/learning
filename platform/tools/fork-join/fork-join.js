(() => {
  /**
   * Fork / join sketch
   *   Two child threads: A finishes at durA, B at durB (default 30 / 10)
   *   join      — parent resumes when ALL children done (max)
   *   join_any  — parent resumes when FIRST child done (min); others may keep running
   *   join_none — parent resumes immediately (t=0); both children keep running
   */

  const TMAX = 40;

  function makeStarter() {
    return {
      mode: "join", // join | join_any | join_none
      durA: 30,
      durB: 10,
      t: 0,
      // thread states: pending | running | done
      parent: "waiting", // waiting | resumed | done
      a: "pending",
      b: "pending",
      parentResumeT: null,
      disabledOthers: false, // after join_any + disable
      started: false,
      finished: false,
      lastAction: "",
      explained: false,
      setJoin: false,
      setJoinAny: false,
      setJoinNone: false,
      events: [],
      log: [],
      trace: [],
    };
  }

  function sourceCode(state) {
    const joinKw =
      state.mode === "join"
        ? "join"
        : state.mode === "join_any"
          ? "join_any"
          : "join_none";
    return `fork
  begin #${state.durA}; $display("A done"); end
  begin #${state.durB}; $display("B done"); end
${joinKw}
$display("parent resumes");`;
  }

  function modeLegend(mode) {
    if (mode === "join") return "Parent waits until every forked thread finishes.";
    if (mode === "join_any")
      return "Parent waits until the first thread finishes; others may still run.";
    return "Parent continues immediately; children run in the background.";
  }

  function resumeTime(state) {
    if (state.mode === "join") return Math.max(state.durA, state.durB);
    if (state.mode === "join_any") return Math.min(state.durA, state.durB);
    return 0;
  }

  const CLEARED_KEY = "ddv-fork-join-cleared-v1";
  const STORE_KEY = "ddv-fork-join-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("fj-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> A takes 30, B takes 10 —
        step time and watch when the parent resumes under each join flavor.</p>
      <button type="button" class="btn btn-secondary" id="fj-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
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
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>join</h3>
            <p>Wait for <em>all</em> — parent @ max(durations).</p>
          </div>
          <div class="idea-card">
            <h3>join_any</h3>
            <p>Wait for <em>first</em> — parent @ min; others may linger.</p>
          </div>
          <div class="idea-card">
            <h3>join_none</h3>
            <p>Do not wait — parent resumes at once.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Timeline</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Join style
              <select id="mode-sel">
                <option value="join" selected>join</option>
                <option value="join_any">join_any</option>
                <option value="join_none">join_none</option>
              </select>
            </label>
            <label>dur A
              <select id="dur-a">
                <option value="20">20</option>
                <option value="30" selected>30</option>
                <option value="40">40</option>
              </select>
            </label>
            <label>dur B
              <select id="dur-b">
                <option value="5">5</option>
                <option value="10" selected>10</option>
                <option value="15">15</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="time-ruler">
            <span>t=0</span><span>10</span><span>20</span><span>30</span><span>40</span>
          </div>
          <div class="lanes" id="lanes"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box" id="warn-box"></div>
          <div class="event-list" id="event-list"></div>
          <div class="action-grid">
            <button type="button" id="btn-start">Start fork</button>
            <button type="button" id="btn-step">Step +5 time</button>
            <button type="button" id="btn-run">Run to parent resume</button>
            <button type="button" id="btn-disable">disable fork (after join_any)</button>
            <button type="button" id="btn-join">Preset join</button>
            <button type="button" id="btn-any">Preset join_any</button>
            <button type="button" id="btn-none">Preset join_none</button>
            <button type="button" id="btn-demo">Demo: compare resume times</button>
            <button type="button" id="btn-explain">Explain join flavors</button>
            <button type="button" id="btn-reset">Reset timeline</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Now / parent resume</h3>
              <p class="val" id="val-t">—</p>
              <p class="note" id="note-t"></p>
            </div>
            <div class="status-card">
              <h3>Threads</h3>
              <p class="val" id="val-thr">—</p>
              <p class="note" id="note-thr"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Style</th><th>Parent resumes when</th></tr></thead>
          <tbody>
            <tr><td>join</td><td>All children finish</td></tr>
            <tr><td>join_any</td><td>First child finishes</td></tr>
            <tr><td>join_none</td><td>Immediately (spawn only)</td></tr>
            <tr><td>disable fork</td><td>Kill remaining children (often after join_any)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: A=30, B=10 → join@30, join_any@10, join_none@0.</li>
          <li>After <code>join_any</code>, leftover threads keep running unless disabled.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = /** @type {HTMLSelectElement} */ (document.getElementById("mode-sel"));
  const durASel = /** @type {HTMLSelectElement} */ (document.getElementById("dur-a"));
  const durBSel = /** @type {HTMLSelectElement} */ (document.getElementById("dur-b"));
  const modeLegendEl = document.getElementById("mode-legend");
  const lanes = document.getElementById("lanes");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const eventList = document.getElementById("event-list");
  const valT = document.getElementById("val-t");
  const noteT = document.getElementById("note-t");
  const valThr = document.getElementById("val-thr");
  const noteThr = document.getElementById("note-thr");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function pushLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function pushEvent(t, msg) {
    state.events.push({ t, msg });
  }

  function applyModeFlags() {
    if (state.mode === "join") state.setJoin = true;
    if (state.mode === "join_any") state.setJoinAny = true;
    if (state.mode === "join_none") state.setJoinNone = true;
  }

  function softResetKeepMode() {
    const mode = state.mode;
    const durA = state.durA;
    const durB = state.durB;
    const flags = {
      setJoin: state.setJoin,
      setJoinAny: state.setJoinAny,
      setJoinNone: state.setJoinNone,
      explained: state.explained,
    };
    state = makeStarter();
    state.mode = mode;
    state.durA = durA;
    state.durB = durB;
    Object.assign(state, flags);
    applyModeFlags();
  }

  function startFork() {
    softResetKeepMode();
    state.started = true;
    state.a = "running";
    state.b = "running";
    state.parent = "waiting";
    state.parentResumeT = resumeTime(state);
    state.t = 0;
    state.lastAction = "start";
    pushEvent(0, "fork — spawn A & B");
    if (state.mode === "join_none") {
      state.parent = "resumed";
      pushEvent(0, "parent resumes (join_none)");
      pushTrace("t=0: join_none → parent continues");
    } else {
      pushTrace(`t=0: fork; parent waits (${state.mode}) until t=${state.parentResumeT}`);
    }
    pushLog(`# start ${state.mode} A=${state.durA} B=${state.durB}`);
    renderAll();
  }

  function applyAtTime() {
    if (!state.started) return;

    // complete children
    if (state.a === "running" && state.t >= state.durA) {
      state.a = "done";
      pushEvent(state.durA, "A done");
      pushTrace(`t=${state.durA}: A finished`);
    }
    if (
      state.b === "running" &&
      !state.disabledOthers &&
      state.t >= state.durB
    ) {
      state.b = "done";
      pushEvent(state.durB, "B done");
      pushTrace(`t=${state.durB}: B finished`);
    }
    if (state.disabledOthers && state.b !== "done" && state.t >= state.durB) {
      // already killed — ignore
    }

    // parent resume
    const rt = state.parentResumeT;
    if (
      state.parent === "waiting" &&
      rt !== null &&
      state.t >= rt
    ) {
      state.parent = "resumed";
      pushEvent(rt, `parent resumes (${state.mode})`);
      pushTrace(`t=${rt}: parent resumes`);
    }

    // finished when parent resumed and (join: both done) or (others)
    if (state.parent === "resumed") {
      if (state.mode === "join") {
        if (state.a === "done" && state.b === "done") state.finished = true;
      } else if (state.mode === "join_none") {
        if (state.a === "done" && state.b === "done") state.finished = true;
      } else {
        // join_any — finished when parent resumed (first done); mark finished if both done or disabled
        if (
          (state.a === "done" || state.b === "done") &&
          (state.disabledOthers || (state.a === "done" && state.b === "done"))
        ) {
          state.finished = true;
        }
        if (state.a === "done" && state.b === "done") state.finished = true;
      }
    }
  }

  function stepTime(dt) {
    if (!state.started) {
      startFork();
    }
    const target = Math.min(TMAX, state.t + dt);
    // advance through event boundaries for clean logs
    const marks = [state.durA, state.durB, state.parentResumeT, target]
      .filter((x) => x !== null && x > state.t && x <= target)
      .sort((a, b) => a - b);
    const uniq = [...new Set(marks)];
    for (const m of uniq) {
      state.t = m;
      applyAtTime();
    }
    if (state.t < target) {
      state.t = target;
      applyAtTime();
    }
    state.lastAction = "step";
    pushLog(`# step → t=${state.t}`);
    renderAll();
  }

  function runToResume() {
    if (!state.started) startFork();
    const rt = resumeTime(state);
    state.parentResumeT = rt;
    while (state.t < rt && state.t < TMAX) {
      state.t = Math.min(rt, state.t + 5);
      applyAtTime();
    }
    state.t = rt;
    applyAtTime();
    state.lastAction = "run";
    pushLog(`# run to parent resume t=${rt}`);
    renderAll();
  }

  function doDisable() {
    softResetKeepMode();
    state.mode = "join_any";
    state.setJoinAny = true;
    state.started = true;
    state.a = "running";
    state.b = "running";
    state.parent = "waiting";
    state.parentResumeT = resumeTime(state);
    state.t = 0;
    state.events = [];
    pushEvent(0, "fork — spawn A & B");
    state.t = state.parentResumeT;
    applyAtTime();
    state.disabledOthers = true;
    if (state.a !== "done") {
      state.a = "done";
      pushEvent(state.t, "disable fork — kill A");
      pushTrace(`t=${state.t}: disable killed A`);
    }
    if (state.b !== "done") {
      state.b = "done";
      pushEvent(state.t, "disable fork — kill B");
      pushTrace(`t=${state.t}: disable killed B`);
    }
    state.finished = true;
    state.lastAction = "disable";
    pushLog("# disable fork after join_any");
    renderAll();
  }

  function runDemo() {
    // Show three resume times in events
    state = makeStarter();
    state.setJoin = true;
    state.setJoinAny = true;
    state.setJoinNone = true;
    state.mode = "join";
    state.started = true;
    state.events = [
      { t: 0, msg: "join_none → parent @ 0" },
      { t: 10, msg: "join_any → parent @ min(30,10)=10" },
      { t: 30, msg: "join → parent @ max(30,10)=30" },
    ];
    state.t = 30;
    state.a = "done";
    state.b = "done";
    state.parent = "resumed";
    state.parentResumeT = 30;
    state.finished = true;
    state.lastAction = "demo";
    pushTrace("demo: resume @ 0 / 10 / 30");
    pushLog("# demo compared join flavors");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# join=all · join_any=first · join_none=now");
    pushTrace("explain: disable fork cleans leftovers after join_any");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setJoin = true;
    state.lastAction = "starter";
    pushLog("# starter join A=30 B=10");
    renderAll();
  }

  function pct(t) {
    return Math.min(100, (t / TMAX) * 100);
  }

  function laneHtml(name, dur, status, isParent) {
    const fillCls =
      status === "done"
        ? "is-done"
        : status === "running" || status === "resumed"
          ? "is-active"
          : "";
    const fillW = isParent
      ? state.parentResumeT !== null && state.parent !== "waiting"
        ? pct(state.parentResumeT)
        : state.started
          ? pct(Math.min(state.t, state.parentResumeT ?? state.t))
          : 0
      : status === "pending"
        ? 0
        : pct(Math.min(state.t, dur));
    const cursor = state.started ? pct(state.t) : 0;
    const stLabel =
      status === "waiting"
        ? "wait"
        : status === "resumed"
          ? "resume"
          : status;
    return `<div class="lane ${isParent ? "is-parent" : ""}">
      <span class="name">${name}</span>
      <div class="lane-bar">
        <div class="lane-fill ${fillCls}" style="width:${fillW}%"></div>
        <div class="lane-cursor" style="left:${cursor}%"></div>
      </div>
      <span class="status">${stLabel}</span>
    </div>`;
  }

  function renderAll() {
    modeSel.value = state.mode;
    durASel.value = String(state.durA);
    durBSel.value = String(state.durB);
    modeLegendEl.textContent = modeLegend(state.mode);
    codeBox.textContent = sourceCode(state);

    lanes.innerHTML =
      laneHtml("parent", state.parentResumeT ?? 0, state.parent, true) +
      laneHtml("A", state.durA, state.a, false) +
      laneHtml("B", state.durB, state.b, false);

    const rt = resumeTime(state);
    warnBox.className = "warn-box is-ok";
    warnBox.textContent = `Expected parent resume @ t=${rt} for ${state.mode} (A=${state.durA}, B=${state.durB}).`;

    eventList.innerHTML = state.events.length
      ? state.events
          .map((e) => `<div><span class="t">t=${e.t}</span> ${e.msg}</div>`)
          .join("")
      : `<div><span class="t">—</span> Start fork to log events</div>`;

    valT.textContent = `${state.t} / ${state.parentResumeT ?? "—"}`;
    noteT.textContent = state.parent === "resumed" ? "parent resumed" : "parent waiting / idle";
    valThr.textContent = `A:${state.a} B:${state.b}`;
    noteThr.textContent = state.disabledOthers
      ? "disable fork used"
      : state.finished
        ? "scene complete"
        : "in progress";

    traceBox.textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no activity";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ mode: state.mode, t: state.t })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("fj-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    applyModeFlags();
    softResetKeepMode();
    state.lastAction = "mode";
    pushLog(`# mode → ${state.mode}`);
    renderAll();
  });

  durASel.addEventListener("change", () => {
    state.durA = Number(durASel.value);
    softResetKeepMode();
    state.lastAction = "dur";
    pushLog(`# durA → ${state.durA}`);
    renderAll();
  });

  durBSel.addEventListener("change", () => {
    state.durB = Number(durBSel.value);
    softResetKeepMode();
    state.lastAction = "dur";
    pushLog(`# durB → ${state.durB}`);
    renderAll();
  });

  document.getElementById("btn-start").addEventListener("click", startFork);
  document.getElementById("btn-step").addEventListener("click", () => stepTime(5));
  document.getElementById("btn-run").addEventListener("click", runToResume);
  document.getElementById("btn-disable").addEventListener("click", doDisable);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-reset").addEventListener("click", () => {
    softResetKeepMode();
    state.lastAction = "reset";
    pushLog("# timeline reset");
    renderAll();
  });

  function preset(mode, flag) {
    state.mode = mode;
    state[flag] = true;
    applyModeFlags();
    softResetKeepMode();
    state.lastAction = `preset-${mode}`;
    pushLog(`# preset ${mode}`);
    renderAll();
  }

  document.getElementById("btn-join").addEventListener("click", () => preset("join", "setJoin"));
  document
    .getElementById("btn-any")
    .addEventListener("click", () => preset("join_any", "setJoinAny"));
  document
    .getElementById("btn-none")
    .addEventListener("click", () => preset("join_none", "setJoinNone"));

  const CHALLENGES = [
    {
      id: "quiz-join",
      title: "Quiz: join",
      prompt: "Wait for all children? Answer: <code>join</code>",
      hint: "all must finish",
      type: "text",
      answer: "join",
      alt: ["join all"],
    },
    {
      id: "quiz-any",
      title: "Quiz: join_any",
      prompt: "Wait for the first child? Answer: <code>join_any</code>",
      hint: "first wins",
      type: "text",
      answer: "join_any",
      alt: ["join any"],
    },
    {
      id: "quiz-none",
      title: "Quiz: join_none",
      prompt: "Do not wait for children? Answer: <code>join_none</code>",
      hint: "spawn and continue",
      type: "text",
      answer: "join_none",
      alt: ["join none"],
    },
    {
      id: "quiz-disable",
      title: "Quiz: disable",
      prompt: "Kill leftover forked threads with? Answer: <code>disable fork</code>",
      hint: "after join_any often",
      type: "text",
      answer: "disable fork",
      alt: ["disable", "disable fork;"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — join mode, A=30 B=10.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "join" &&
        state.setJoin &&
        state.durA === 30 &&
        state.durB === 10,
    },
    {
      id: "preset-join",
      title: "Preset join",
      prompt: "Preset join.",
      hint: "Preset join",
      type: "state",
      setup: () => {
        state.mode = "join_none";
        renderAll();
      },
      check: () =>
        state.setJoin &&
        state.mode === "join" &&
        state.lastAction === "preset-join",
    },
    {
      id: "preset-any",
      title: "Preset join_any",
      prompt: "Preset join_any.",
      hint: "Preset join_any",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setJoinAny && state.mode === "join_any",
    },
    {
      id: "preset-none",
      title: "Preset join_none",
      prompt: "Preset join_none.",
      hint: "Preset join_none",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setJoinNone && state.mode === "join_none",
    },
    {
      id: "start",
      title: "Start",
      prompt: "Start fork.",
      hint: "Start fork",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.started && state.lastAction === "start",
    },
    {
      id: "step",
      title: "Step",
      prompt: "Step +5 time at least once (t ≥ 5).",
      hint: "Start then Step +5",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.started && state.t >= 5,
    },
    {
      id: "join-resume",
      title: "join resume",
      prompt: "join mode: run until parent resumes at t=30.",
      hint: "Preset join → Run to parent resume",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "join";
        state.setJoin = true;
        renderAll();
      },
      check: () =>
        state.mode === "join" &&
        state.parent === "resumed" &&
        state.parentResumeT === 30 &&
        state.t >= 30,
    },
    {
      id: "any-resume",
      title: "join_any resume",
      prompt: "join_any: parent resumes at t=10.",
      hint: "Preset join_any → Run to parent resume",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "join_any";
        state.setJoinAny = true;
        renderAll();
      },
      check: () =>
        state.mode === "join_any" &&
        state.parent === "resumed" &&
        state.t >= 10 &&
        state.parentResumeT === 10,
    },
    {
      id: "none-resume",
      title: "join_none resume",
      prompt: "join_none: Start fork — parent resumed at t=0.",
      hint: "Preset join_none → Start fork",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "join_none";
        state.setJoinNone = true;
        renderAll();
      },
      check: () =>
        state.mode === "join_none" &&
        state.started &&
        state.parent === "resumed" &&
        state.parentResumeT === 0,
    },
    {
      id: "b-first",
      title: "B finishes first",
      prompt: "With A=30 B=10, reach t≥10 so B is done.",
      hint: "Start → step or run",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.b === "done" && state.t >= 10,
    },
    {
      id: "disable",
      title: "Disable",
      prompt: "Run disable fork (after join_any).",
      hint: "disable fork button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.disabledOthers &&
        state.lastAction === "disable" &&
        state.mode === "join_any",
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: compare resume times.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "demo" && state.events.length >= 3,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain join flavors.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-any",
      title: "Mode join_any",
      prompt: "Switch Join style dropdown to join_any.",
      hint: "Join style select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "join_any" && state.lastAction === "mode",
    },
    {
      id: "code-join",
      title: "Code join",
      prompt: "join mode source ends parent wait with bare <code>join</code>.",
      hint: "Preset join",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "join" &&
        /join\n\$display/.test(sourceCode(state)),
    },
    {
      id: "code-any",
      title: "Code join_any",
      prompt: "join_any source contains <code>join_any</code>.",
      hint: "Preset join_any",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "join_any" &&
        sourceCode(state).includes("join_any"),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset timeline (t=0, not started).",
      hint: "Reset timeline",
      type: "state",
      setup: () => {
        loadStarter();
        startFork();
        stepTime(10);
      },
      check: () =>
        !state.started && state.t === 0 && state.lastAction === "reset",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.explained &&
        state.lastAction === "explain" &&
        state.events.length >= 3,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function setStatus(kind, text) {
    const el = document.getElementById("chal-status");
    el.className = `challenge-status ${kind}`;
    el.textContent = text;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (isCleared(ch.id) ? " · cleared" : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}.</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? `Hint: ${ch.hint}` : "";
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      ansRow.innerHTML = `<label class="sr-only" for="chal-answer">Answer</label>
        <input type="text" id="chal-answer" class="chal-input" autocomplete="off" placeholder="Type answer…">`;
      const inp = /** @type {HTMLInputElement} */ (document.getElementById("chal-answer"));
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
    } else {
      ansRow.innerHTML = "";
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = CHALLENGES.map((c, i) => {
      const cls = [
        "kbd",
        i === challengeIdx ? "is-active" : "",
        isCleared(c.id) ? "is-cleared" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-chal="${i}">${c.id}</button>`;
    }).join(" ");
    cat.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        challengeIdx = Number(btn.getAttribute("data-chal"));
        showHint = false;
        answerDraft = "";
        setStatus("idle", "Idle");
        const next = CHALLENGES[challengeIdx];
        if (next.setup) next.setup();
        renderChallenge();
      });
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });

  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setStatus("idle", "Idle");
    const next = CHALLENGES[challengeIdx];
    if (next.setup) next.setup();
    renderChallenge();
  });

  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const got = normalizeAns(answerDraft);
      const want = normalizeAns(ch.answer);
      const alts = (ch.alt || []).map(normalizeAns);
      ok = got === want || alts.includes(got);
    } else {
      ok = !!ch.check();
    }
    if (ok) {
      markCleared(ch.id);
      setStatus("ok", "Cleared");
    } else {
      setStatus("bad", "Not yet");
    }
    renderChallenge();
  });

  loadStarter();
  renderChallenge();
})();
