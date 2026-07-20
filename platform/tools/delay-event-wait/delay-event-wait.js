(() => {
  /**
   * Delay / event / wait — TB timing controls
   *   delay  — #N advances simulation time by N
   *   event  — @(posedge clk) blocks until rising edge
   *   wait   — wait(ready) blocks until expression is true (level)
   */

  function makeStarter() {
    return {
      mode: "delay", // delay | event | wait
      t: 0,
      clk: 0,
      ready: 0,
      data: 0,
      // process
      blocked: false,
      blockReason: "",
      unblockAt: null, // for #delay
      done: false,
      started: false,
      lastAction: "",
      explained: false,
      setDelay: false,
      setEvent: false,
      setWait: false,
      delayAmt: 10,
      events: [],
      log: [],
      trace: [],
    };
  }

  function sourceCode(state) {
    if (state.mode === "delay") {
      return `// #delay — advance time (TB / sim only)
initial begin
  $display("start t=%0t", $time);
  #${state.delayAmt};
  $display("after delay");
end`;
    }
    if (state.mode === "event") {
      return `// @event — edge / event control
initial begin
  @(posedge clk);   // wait rising edge
  data <= 1;
end`;
    }
    return `// wait — level-sensitive
initial begin
  wait(ready);      // resume when ready==1
  $display("ready seen");
end`;
  }

  function modeLegend(mode) {
    if (mode === "delay") return "#N sleeps for N time units — no signal needed.";
    if (mode === "event") return "@(posedge clk) wakes only on a 0→1 transition.";
    return "wait(ready) wakes when the expression is true (checked continuously).";
  }

  const CLEARED_KEY = "ddv-delay-event-wait-cleared-v1";
  const STORE_KEY = "ddv-delay-event-wait-session-v1";

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

  const root = document.getElementById("dew-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>#10</code> delay —
        compare with <code>@(posedge clk)</code> and <code>wait(ready)</code>.</p>
      <button type="button" class="btn btn-secondary" id="dew-starter">Load starter example</button>
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
            <h3>#delay</h3>
            <p>Advance sim time by a fixed amount.</p>
          </div>
          <div class="idea-card">
            <h3>@event</h3>
            <p>Block until an edge (or named event) fires.</p>
          </div>
          <div class="idea-card">
            <h3>wait</h3>
            <p>Block until a boolean expression is true.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Timing control</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Construct
              <select id="mode-sel">
                <option value="delay" selected>#delay</option>
                <option value="event">@event (posedge)</option>
                <option value="wait">wait(expr)</option>
              </select>
            </label>
            <label>#amount
              <select id="delay-sel">
                <option value="5">5</option>
                <option value="10" selected>10</option>
                <option value="20">20</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="proc-badge" id="proc-badge">idle</div>
          <div class="signal-row" id="signal-row"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box" id="warn-box"></div>
          <div class="timeline" id="timeline"></div>
          <div class="action-grid">
            <button type="button" id="btn-arm">Arm / start block</button>
            <button type="button" id="btn-step">Step +5 time</button>
            <button type="button" id="btn-tick">Toggle clk (posedge?)</button>
            <button type="button" id="btn-ready">Toggle ready</button>
            <button type="button" id="btn-delay">Preset #delay</button>
            <button type="button" id="btn-event">Preset @event</button>
            <button type="button" id="btn-wait">Preset wait</button>
            <button type="button" id="btn-demo">Demo: all three</button>
            <button type="button" id="btn-explain">Explain timing</button>
            <button type="button" id="btn-reset">Reset</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Sim time</h3>
              <p class="val" id="val-t">—</p>
              <p class="note" id="note-t"></p>
            </div>
            <div class="status-card">
              <h3>Process</h3>
              <p class="val" id="val-proc">—</p>
              <p class="note" id="note-proc"></p>
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
          <thead><tr><th>Control</th><th>Wakes when</th><th>Typical use</th></tr></thead>
          <tbody>
            <tr><td><code>#N</code></td><td>N time units pass</td><td>TB gaps, clocks in initial</td></tr>
            <tr><td><code>@(posedge clk)</code></td><td>Rising edge</td><td>Cycle-accurate TB</td></tr>
            <tr><td><code>wait(e)</code></td><td>e becomes true</td><td>Handshake / ready</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>If <code>ready</code> is already 1, <code>wait(ready)</code> does not block.</li>
          <li><code>@(posedge)</code> needs a transition — level alone is not enough.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = /** @type {HTMLSelectElement} */ (document.getElementById("mode-sel"));
  const delaySel = /** @type {HTMLSelectElement} */ (document.getElementById("delay-sel"));
  const modeLegendEl = document.getElementById("mode-legend");
  const procBadge = document.getElementById("proc-badge");
  const signalRow = document.getElementById("signal-row");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const timeline = document.getElementById("timeline");
  const valT = document.getElementById("val-t");
  const noteT = document.getElementById("note-t");
  const valProc = document.getElementById("val-proc");
  const noteProc = document.getElementById("note-proc");
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

  function pushEvent(msg) {
    state.events.push({ t: state.t, msg });
  }

  function applyModeFlags() {
    if (state.mode === "delay") state.setDelay = true;
    if (state.mode === "event") state.setEvent = true;
    if (state.mode === "wait") state.setWait = true;
  }

  function softResetKeepMode() {
    const keep = {
      mode: state.mode,
      delayAmt: state.delayAmt,
      setDelay: state.setDelay,
      setEvent: state.setEvent,
      setWait: state.setWait,
      explained: state.explained,
    };
    state = makeStarter();
    Object.assign(state, keep);
    applyModeFlags();
  }

  function finishProcess(msg) {
    state.blocked = false;
    state.blockReason = "";
    state.unblockAt = null;
    state.done = true;
    pushEvent(msg);
    pushTrace(`t=${state.t}: ${msg}`);
    pushLog(`# unblocked — ${msg}`);
  }

  function armBlock() {
    softResetKeepMode();
    state.started = true;
    state.lastAction = "arm";

    if (state.mode === "delay") {
      state.blocked = true;
      state.blockReason = `#${state.delayAmt}`;
      state.unblockAt = state.t + state.delayAmt;
      pushEvent(`block on #${state.delayAmt} until t=${state.unblockAt}`);
      pushTrace(`t=${state.t}: enter #${state.delayAmt}`);
      pushLog(`# armed delay → wake @ ${state.unblockAt}`);
    } else if (state.mode === "event") {
      state.blocked = true;
      state.blockReason = "@(posedge clk)";
      state.clk = 0;
      pushEvent("block on @(posedge clk)");
      pushTrace(`t=${state.t}: waiting for posedge`);
      pushLog("# armed @posedge");
    } else {
      // wait
      if (state.ready) {
        finishProcess("wait(ready) — already true, no block");
      } else {
        state.blocked = true;
        state.blockReason = "wait(ready)";
        pushEvent("block on wait(ready)");
        pushTrace(`t=${state.t}: waiting for ready==1`);
        pushLog("# armed wait(ready)");
      }
    }
    renderAll();
  }

  function checkUnblock() {
    if (!state.blocked) return;
    if (state.mode === "delay" && state.unblockAt !== null && state.t >= state.unblockAt) {
      finishProcess("after #delay");
    }
  }

  function stepTime(dt) {
    if (!state.started) armBlock();
    const target = state.t + dt;
    if (state.mode === "delay" && state.blocked && state.unblockAt !== null && state.unblockAt <= target) {
      state.t = state.unblockAt;
      checkUnblock();
      if (state.t < target) state.t = target;
    } else {
      state.t = target;
      checkUnblock();
    }
    state.lastAction = "step";
    pushLog(`# step → t=${state.t}`);
    renderAll();
  }

  function toggleClk() {
    const prev = state.clk;
    state.clk = state.clk ? 0 : 1;
    state.lastAction = "toggle-clk";
    pushEvent(`clk ${prev}→${state.clk}`);
    pushLog(`# clk → ${state.clk}`);

    if (state.blocked && state.mode === "event" && prev === 0 && state.clk === 1) {
      state.data = 1;
      finishProcess("posedge clk seen — data<=1");
    } else if (state.blocked && state.mode === "event") {
      pushTrace(`t=${state.t}: clk=${state.clk} (need 0→1)`);
    }
    renderAll();
  }

  function toggleReady() {
    state.ready = state.ready ? 0 : 1;
    state.lastAction = "toggle-ready";
    pushEvent(`ready → ${state.ready}`);
    pushLog(`# ready → ${state.ready}`);

    if (state.blocked && state.mode === "wait" && state.ready === 1) {
      finishProcess("wait(ready) satisfied");
    }
    renderAll();
  }

  function runDemo() {
    state = makeStarter();
    state.setDelay = true;
    state.setEvent = true;
    state.setWait = true;
    state.mode = "delay";
    state.started = true;
    state.done = true;
    state.t = 10;
    state.events = [
      { t: 0, msg: "#10 armed" },
      { t: 10, msg: "after #delay" },
      { t: 10, msg: "@(posedge) armed; clk 0→1" },
      { t: 10, msg: "posedge — unblocked" },
      { t: 10, msg: "wait(ready) — ready=1 unblocks" },
    ];
    state.clk = 1;
    state.ready = 1;
    state.data = 1;
    state.lastAction = "demo";
    pushTrace("demo: #delay · @posedge · wait(ready)");
    pushLog("# demo all three controls");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# #=time · @=edge · wait=level");
    pushTrace("explain: none of these are synthesizable RTL style");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setDelay = true;
    state.lastAction = "starter";
    pushLog("# starter #delay");
    renderAll();
  }

  function renderSignals() {
    const items = [
      { name: "clk", v: state.clk, hi: state.clk, block: state.mode === "event" && state.blocked },
      { name: "ready", v: state.ready, hi: state.ready, block: state.mode === "wait" && state.blocked },
      { name: "data", v: state.data, hi: state.data, block: false },
    ];
    signalRow.innerHTML = items
      .map((s) => {
        const cls = [s.hi ? "is-hi" : "", s.block ? "is-blocked" : ""].filter(Boolean).join(" ");
        return `<div class="sig ${cls}"><h3>${s.name}</h3><p class="val">${s.v}</p></div>`;
      })
      .join("");
  }

  function renderAll() {
    modeSel.value = state.mode;
    delaySel.value = String(state.delayAmt);
    modeLegendEl.textContent = modeLegend(state.mode);
    codeBox.textContent = sourceCode(state);
    renderSignals();

    if (state.blocked) {
      procBadge.className = "proc-badge is-blocked";
      procBadge.textContent = `BLOCKED: ${state.blockReason}`;
      warnBox.className = "warn-box is-wait";
      warnBox.textContent =
        state.mode === "delay"
          ? `Sleeping until t=${state.unblockAt}. Step time to wake.`
          : state.mode === "event"
            ? "Waiting for clk 0→1. Toggle clk (from 0 to 1)."
            : "Waiting for ready==1. Toggle ready.";
    } else if (state.done) {
      procBadge.className = "proc-badge is-run";
      procBadge.textContent = "DONE — unblocked";
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = "Process resumed after timing control.";
    } else {
      procBadge.className = "proc-badge";
      procBadge.textContent = "idle — Arm to start";
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = "Arm / start block to enter the timing control.";
    }

    timeline.innerHTML = state.events.length
      ? state.events
          .map((e) => `<div class="row"><span class="t">t=${e.t}</span><span>${e.msg}</span></div>`)
          .join("")
      : `<div class="row"><span class="t">—</span><span>No events yet</span></div>`;

    valT.textContent = String(state.t);
    noteT.textContent =
      state.unblockAt !== null && state.blocked
        ? `wake @ ${state.unblockAt}`
        : "sim time";
    valProc.textContent = state.blocked ? "blocked" : state.done ? "done" : "idle";
    noteProc.textContent = state.blockReason || (state.done ? "finished" : "—");

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no activity";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ mode: state.mode, t: state.t }));
    } catch {
      /* ignore */
    }
  }

  document.getElementById("dew-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    applyModeFlags();
    softResetKeepMode();
    state.lastAction = "mode";
    pushLog(`# mode → ${state.mode}`);
    renderAll();
  });

  delaySel.addEventListener("change", () => {
    state.delayAmt = Number(delaySel.value);
    softResetKeepMode();
    state.lastAction = "delay-amt";
    pushLog(`# amount → ${state.delayAmt}`);
    renderAll();
  });

  document.getElementById("btn-arm").addEventListener("click", armBlock);
  document.getElementById("btn-step").addEventListener("click", () => stepTime(5));
  document.getElementById("btn-tick").addEventListener("click", toggleClk);
  document.getElementById("btn-ready").addEventListener("click", toggleReady);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-reset").addEventListener("click", () => {
    softResetKeepMode();
    state.lastAction = "reset";
    pushLog("# reset");
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

  document.getElementById("btn-delay").addEventListener("click", () => preset("delay", "setDelay"));
  document.getElementById("btn-event").addEventListener("click", () => preset("event", "setEvent"));
  document.getElementById("btn-wait").addEventListener("click", () => preset("wait", "setWait"));

  const CHALLENGES = [
    {
      id: "quiz-delay",
      title: "Quiz: delay",
      prompt: "Fixed time advance uses? Answer: <code>#delay</code>",
      hint: "hash N",
      type: "text",
      answer: "#delay",
      alt: ["delay", "#", "#n", "#10"],
    },
    {
      id: "quiz-event",
      title: "Quiz: event",
      prompt: "Edge control uses? Answer: <code>@event</code>",
      hint: "@(posedge …)",
      type: "text",
      answer: "@event",
      alt: ["@", "@(", "posedge", "@(posedge)", "event"],
    },
    {
      id: "quiz-wait",
      title: "Quiz: wait",
      prompt: "Level-sensitive block keyword? Answer: <code>wait</code>",
      hint: "wait(expr)",
      type: "text",
      answer: "wait",
      alt: ["wait()", "wait(expr)"],
    },
    {
      id: "quiz-posedge",
      title: "Quiz: posedge",
      prompt: "0→1 clock edge name? Answer: <code>posedge</code>",
      hint: "positive edge",
      type: "text",
      answer: "posedge",
      alt: ["rising", "rising edge"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — #delay mode.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "delay" && state.setDelay,
    },
    {
      id: "preset-delay",
      title: "Preset delay",
      prompt: "Preset #delay.",
      hint: "Preset #delay",
      type: "state",
      setup: () => {
        state.mode = "wait";
        renderAll();
      },
      check: () =>
        state.setDelay &&
        state.mode === "delay" &&
        state.lastAction === "preset-delay",
    },
    {
      id: "preset-event",
      title: "Preset event",
      prompt: "Preset @event.",
      hint: "Preset @event",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setEvent && state.mode === "event",
    },
    {
      id: "preset-wait",
      title: "Preset wait",
      prompt: "Preset wait.",
      hint: "Preset wait",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setWait && state.mode === "wait",
    },
    {
      id: "arm",
      title: "Arm",
      prompt: "Arm / start block.",
      hint: "Arm / start block",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.started && state.lastAction === "arm",
    },
    {
      id: "delay-wake",
      title: "Delay wake",
      prompt: "#10: Arm then Step until done (t≥10).",
      hint: "Preset #delay → Arm → Step +5 twice",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "delay";
        state.delayAmt = 10;
        state.setDelay = true;
        renderAll();
      },
      check: () =>
        state.mode === "delay" &&
        state.done &&
        !state.blocked &&
        state.t >= 10,
    },
    {
      id: "posedge-wake",
      title: "Posedge wake",
      prompt: "@event: Arm (clk=0), Toggle clk to 1 — process done.",
      hint: "Preset @event → Arm → Toggle clk",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "event";
        state.setEvent = true;
        renderAll();
      },
      check: () =>
        state.mode === "event" &&
        state.done &&
        state.clk === 1 &&
        state.data === 1,
    },
    {
      id: "wait-wake",
      title: "Wait wake",
      prompt: "wait: Arm with ready=0, Toggle ready → done.",
      hint: "Preset wait → Arm → Toggle ready",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "wait";
        state.setWait = true;
        state.ready = 0;
        renderAll();
      },
      check: () =>
        state.mode === "wait" && state.done && state.ready === 1,
    },
    {
      id: "wait-already",
      title: "Wait already",
      prompt: "Set ready=1 first, Arm wait — done immediately (no block).",
      hint: "Toggle ready on, Preset wait, Arm",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "wait";
        state.setWait = true;
        state.ready = 0;
        renderAll();
      },
      check: () =>
        state.mode === "wait" &&
        state.done &&
        state.ready === 1 &&
        state.events.some((e) => /already true/.test(e.msg)),
    },
    {
      id: "toggle-clk",
      title: "Toggle clk",
      prompt: "Toggle clk.",
      hint: "Toggle clk",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "toggle-clk",
    },
    {
      id: "toggle-ready",
      title: "Toggle ready",
      prompt: "Toggle ready.",
      hint: "Toggle ready",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "toggle-ready",
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: all three.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "demo" && state.events.length >= 5,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain timing.",
      hint: "Explain timing",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-event",
      title: "Mode event",
      prompt: "Switch Construct to @event.",
      hint: "Construct select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "event" && state.lastAction === "mode",
    },
    {
      id: "code-delay",
      title: "Code delay",
      prompt: "delay source contains <code>#</code> and amount.",
      hint: "Preset #delay",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "delay" &&
        sourceCode(state).includes(`#${state.delayAmt}`),
    },
    {
      id: "code-event",
      title: "Code event",
      prompt: "event source has <code>@(posedge clk)</code>.",
      hint: "Preset @event",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "event" &&
        sourceCode(state).includes("@(posedge clk)"),
    },
    {
      id: "code-wait",
      title: "Code wait",
      prompt: "wait source has <code>wait(ready)</code>.",
      hint: "Preset wait",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wait" && sourceCode(state).includes("wait(ready)"),
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
        state.events.length >= 5,
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
