(() => {
  /**
   * Task vs function vs always
   *   task         — TB procedural helper; may consume time (# / @)
   *   function     — zero-time; returns a value; combo-friendly
   *   always_ff    — RTL sequential procedural block
   *   always_comb  — RTL combinational procedural block
   */

  const META = {
    task: {
      label: "task",
      role: "TB helper",
      timing: "yes (# / @)",
      returns: "no (void / outs)",
      synth: "no (sim only)",
      hardware: "—",
      yesTiming: true,
      yesReturn: false,
      yesSynth: false,
      isRtl: false,
    },
    function: {
      label: "function",
      role: "TB or RTL helper",
      timing: "no (zero time)",
      returns: "yes",
      synth: "if pure combo",
      hardware: "combo / none",
      yesTiming: false,
      yesReturn: true,
      yesSynth: true,
      isRtl: false,
    },
    always_ff: {
      label: "always_ff",
      role: "RTL sequential",
      timing: "edge-triggered",
      returns: "n/a (assigns)",
      synth: "yes → FFs",
      hardware: "flip-flops",
      yesTiming: true,
      yesReturn: false,
      yesSynth: true,
      isRtl: true,
    },
    always_comb: {
      label: "always_comb",
      role: "RTL combinational",
      timing: "zero (reactive)",
      returns: "n/a (assigns)",
      synth: "yes → gates",
      hardware: "combo logic",
      yesTiming: false,
      yesReturn: false,
      yesSynth: true,
      isRtl: true,
    },
  };

  function makeStarter() {
    return {
      mode: "task", // task | function | always_ff | always_comb
      simTime: 0,
      result: null,
      ran: false,
      timeline: [],
      lastAction: "",
      explained: false,
      setTask: false,
      setFunction: false,
      setAlwaysFf: false,
      setAlwaysComb: false,
      compared: false,
      illegalTried: false,
      log: [],
      trace: [],
    };
  }

  function sourceCode(mode) {
    if (mode === "task") {
      return `// Task — may wait / drive pins (testbench)
task automatic drive_bit(input bit b);
  @(posedge clk);
  din <= b;
  @(posedge clk);
endtask`;
    }
    if (mode === "function") {
      return `// Function — zero time; returns a value
function automatic logic [7:0] add8(
  input logic [7:0] a, b
);
  return a + b;   // no #delay, no @event
endfunction`;
    }
    if (mode === "always_ff") {
      return `// always_ff — synthesizable sequential RTL
always_ff @(posedge clk or negedge rst_n) begin
  if (!rst_n) q <= '0;
  else        q <= d;
end`;
    }
    return `// always_comb — synthesizable combo RTL
always_comb begin
  y = a & b;   // sensitivity inferred
end`;
  }

  function callSite(mode) {
    if (mode === "task") return `initial begin\n  drive_bit(1'b1);\nend`;
    if (mode === "function") return `assign sum = add8(x, y);\n// or: s = add8(x, y); inside always_comb`;
    if (mode === "always_ff") return `// not "called" — lives in the module\n// runs on every posedge clk`;
    return `// not "called" — reacts when a or b changes`;
  }

  function modeLegend(mode) {
    const m = META[mode];
    return `${m.label}: ${m.role} · timing ${m.timing} · synth ${m.synth}`;
  }

  const CLEARED_KEY = "ddv-task-vs-function-cleared-v1";
  const STORE_KEY = "ddv-task-vs-function-session-v1";

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

  const root = document.getElementById("tvf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> a <code>task</code> that waits on clock —
        compare with a zero-time <code>function</code> and RTL <code>always_*</code> blocks.</p>
      <button type="button" class="btn btn-secondary" id="tvf-starter">Load starter example</button>
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
            <h3>task</h3>
            <p>TB sequences — may <code>#</code> / <code>@</code>; no return value.</p>
          </div>
          <div class="idea-card">
            <h3>function</h3>
            <p>Zero-time computation; returns; OK in combo if pure.</p>
          </div>
          <div class="idea-card">
            <h3>always_*</h3>
            <p>Hardware processes — synthesis maps to FFs or gates.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Construct explorer</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Construct
              <select id="mode-sel">
                <option value="task" selected>task</option>
                <option value="function">function</option>
                <option value="always_ff">always_ff</option>
                <option value="always_comb">always_comb</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="compare-row" id="compare-row"></div>
          <div class="prop-grid" id="prop-grid"></div>
          <pre class="code-box" id="code-box"></pre>
          <pre class="code-box" id="call-box" style="opacity:0.92"></pre>
          <div class="timeline" id="timeline"></div>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-run">Run / call once</button>
            <button type="button" id="btn-illegal">Try illegal # in function</button>
            <button type="button" id="btn-task">Preset task</button>
            <button type="button" id="btn-function">Preset function</button>
            <button type="button" id="btn-ff">Preset always_ff</button>
            <button type="button" id="btn-comb">Preset always_comb</button>
            <button type="button" id="btn-compare">Compare all three roles</button>
            <button type="button" id="btn-demo">Demo: task waits, fn returns</button>
            <button type="button" id="btn-explain">Explain roles</button>
            <button type="button" id="btn-reset-time">Reset sim time</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Sim sketch</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Sim time</h3>
              <p class="val" id="val-time">—</p>
              <p class="note" id="note-time"></p>
            </div>
            <div class="status-card">
              <h3>Last result</h3>
              <p class="val" id="val-result">—</p>
              <p class="note" id="note-result"></p>
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
          <thead><tr><th></th><th>task</th><th>function</th><th>always_*</th></tr></thead>
          <tbody>
            <tr><td>Time advance</td><td>yes</td><td>no</td><td>event-driven</td></tr>
            <tr><td>Return value</td><td>no*</td><td>yes</td><td>n/a</td></tr>
            <tr><td>Synthesis</td><td>no</td><td>limited</td><td>yes (RTL)</td></tr>
            <tr><td>Typical home</td><td>TB</td><td>TB + RTL</td><td>DUT</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>*SV tasks can use <code>output</code> / <code>ref</code>; still not a function return.</li>
          <li>Do not put <code>#delay</code> inside a function — illegal / non-synth.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = /** @type {HTMLSelectElement} */ (document.getElementById("mode-sel"));
  const modeLegendEl = document.getElementById("mode-legend");
  const compareRow = document.getElementById("compare-row");
  const propGrid = document.getElementById("prop-grid");
  const codeBox = document.getElementById("code-box");
  const callBox = document.getElementById("call-box");
  const timeline = document.getElementById("timeline");
  const warnBox = document.getElementById("warn-box");
  const valTime = document.getElementById("val-time");
  const noteTime = document.getElementById("note-time");
  const valResult = document.getElementById("val-result");
  const noteResult = document.getElementById("note-result");
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

  function applyModeFlags() {
    if (state.mode === "task") state.setTask = true;
    if (state.mode === "function") state.setFunction = true;
    if (state.mode === "always_ff") state.setAlwaysFf = true;
    if (state.mode === "always_comb") state.setAlwaysComb = true;
  }

  function runOnce() {
    const mode = state.mode;
    state.ran = true;
    state.lastAction = "run";
    state.timeline = [];

    if (mode === "task") {
      const t0 = state.simTime;
      state.timeline.push({ t: t0, msg: "enter drive_bit" });
      state.simTime += 10;
      state.timeline.push({ t: state.simTime, msg: "@(posedge) — drive din" });
      state.simTime += 10;
      state.timeline.push({ t: state.simTime, msg: "@(posedge) — task returns" });
      state.result = "(void)";
      pushTrace(`t=${state.simTime}: task done (Δ20 time units)`);
      pushLog(`# task advanced time ${t0} → ${state.simTime}`);
    } else if (mode === "function") {
      const t0 = state.simTime;
      state.timeline.push({ t: t0, msg: "call add8(3,5)" });
      state.result = 8;
      state.timeline.push({ t: t0, msg: "return 8 (same time)" });
      pushTrace(`t=${t0}: function returned 8 (zero time)`);
      pushLog(`# function @ t=${t0} → 8`);
    } else if (mode === "always_ff") {
      state.simTime += 10;
      state.timeline.push({ t: state.simTime, msg: "posedge clk → q <= d" });
      state.result = "q updated";
      pushTrace(`t=${state.simTime}: always_ff sampled`);
      pushLog(`# always_ff edge @ t=${state.simTime}`);
    } else {
      const t0 = state.simTime;
      state.timeline.push({ t: t0, msg: "a/b change → recompute y" });
      state.result = "y = a&b";
      pushTrace(`t=${t0}: always_comb reacted (0 delay)`);
      pushLog(`# always_comb @ t=${t0}`);
    }
    renderAll();
  }

  function tryIllegal() {
    state.illegalTried = true;
    state.lastAction = "illegal";
    state.mode = "function";
    state.setFunction = true;
    warnBox.classList.remove("hidden", "is-ok");
    warnBox.textContent =
      "Illegal: function cannot contain #delay or @event — use a task (TB) or move timing outside.";
    pushLog("# rejected: # inside function");
    pushTrace("error: timing control in function");
    renderAll();
  }

  function runCompare() {
    state.compared = true;
    state.lastAction = "compare";
    state.timeline = [
      { t: 0, msg: "task: TB sequence with time" },
      { t: 0, msg: "function: value @ time 0" },
      { t: 0, msg: "always_*: continuous RTL process" },
    ];
    pushLog("# compared task / function / always roles");
    pushTrace("compare: TB helpers vs RTL blocks");
    renderAll();
  }

  function runDemo() {
    state.mode = "task";
    state.setTask = true;
    state.simTime = 0;
    state.timeline = [];
    state.trace = [];
    // task part
    state.simTime = 20;
    state.timeline.push({ t: 0, msg: "task enter" });
    state.timeline.push({ t: 10, msg: "task @posedge" });
    state.timeline.push({ t: 20, msg: "task done" });
    // function part at same final time
    state.mode = "function";
    state.setFunction = true;
    state.result = 8;
    state.timeline.push({ t: 20, msg: "function add8 → 8 (no time advance)" });
    state.ran = true;
    state.lastAction = "demo";
    pushTrace("demo: task Δt=20 then function Δt=0");
    pushLog("# demo task waits, function returns");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# task=TB time · function=value · always=hardware");
    pushTrace("explain: synthesis only maps always_* (and pure fn)");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setTask = true;
    state.lastAction = "starter";
    pushLog("# starter task loaded");
    renderAll();
  }

  function renderCompare() {
    const roles = [
      { id: "task", title: "task", body: "TB · time OK" },
      { id: "function", title: "function", body: "return · t=0" },
      { id: "always", title: "always_*", body: "RTL process" },
    ];
    const active =
      state.mode === "always_ff" || state.mode === "always_comb"
        ? "always"
        : state.mode;
    compareRow.innerHTML = roles
      .map((r) => {
        const on = r.id === active ? "is-active" : "";
        return `<div class="compare-card ${on}"><h3>${r.title}</h3>${r.body}</div>`;
      })
      .join("");
  }

  function renderProps() {
    const m = META[state.mode];
    const cells = [
      { h: "Role", v: m.role, cls: m.isRtl ? "is-rtl" : "" },
      {
        h: "Timing controls",
        v: m.timing,
        cls: m.yesTiming ? "is-yes" : "is-no",
      },
      {
        h: "Return value",
        v: m.returns,
        cls: m.yesReturn ? "is-yes" : "is-no",
      },
      {
        h: "Synthesis",
        v: m.synth,
        cls: m.yesSynth ? "is-yes" : "is-no",
      },
      { h: "Maps to", v: m.hardware, cls: m.isRtl ? "is-rtl" : "" },
      {
        h: "Home",
        v: m.isRtl ? "DUT / RTL" : m.label === "function" ? "TB or RTL" : "testbench",
        cls: "",
      },
    ];
    propGrid.innerHTML = cells
      .map(
        (c) =>
          `<div class="prop ${c.cls}"><h3>${c.h}</h3><p class="val">${c.v}</p></div>`
      )
      .join("");
  }

  function renderTimeline() {
    if (!state.timeline.length) {
      timeline.innerHTML = `<div class="t-row"><span class="t-time">—</span><span>Run to sketch time / return</span></div>`;
      return;
    }
    timeline.innerHTML = state.timeline
      .map(
        (e) =>
          `<div class="t-row"><span class="t-time">t=${e.t}</span><span>${e.msg}</span></div>`
      )
      .join("");
  }

  function renderAll() {
    modeSel.value = state.mode;
    modeLegendEl.textContent = modeLegend(state.mode);
    codeBox.textContent = sourceCode(state.mode);
    callBox.textContent = "// Call / trigger site\n" + callSite(state.mode);
    renderCompare();
    renderProps();
    renderTimeline();

    if (state.lastAction !== "illegal") {
      if (state.mode === "task") {
        warnBox.classList.remove("hidden");
        warnBox.classList.add("is-ok");
        warnBox.textContent = "OK in TB: tasks may wait on clocks and drive DUT pins.";
      } else if (state.mode === "function") {
        warnBox.classList.remove("hidden");
        warnBox.classList.add("is-ok");
        warnBox.textContent = "Keep functions zero-time; synthesizable if side-effect free.";
      } else {
        warnBox.classList.remove("hidden");
        warnBox.classList.add("is-ok");
        warnBox.textContent = "RTL procedural block — this is what synthesis turns into gates/FFs.";
      }
    }

    valTime.textContent = `${state.simTime}`;
    noteTime.textContent = META[state.mode].yesTiming
      ? "may advance / edge"
      : "zero-time / reactive";
    valResult.textContent =
      state.result === null || state.result === undefined
        ? "—"
        : String(state.result);
    noteResult.textContent = state.ran ? "after last Run" : "not run yet";

    traceBox.textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no activity";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ mode: state.mode }));
    } catch {
      /* ignore */
    }
  }

  document.getElementById("tvf-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    applyModeFlags();
    state.lastAction = "mode";
    state.illegalTried = state.illegalTried; // keep
    pushLog(`# construct → ${state.mode}`);
    renderAll();
  });

  document.getElementById("btn-run").addEventListener("click", runOnce);
  document.getElementById("btn-illegal").addEventListener("click", tryIllegal);
  document.getElementById("btn-compare").addEventListener("click", runCompare);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-reset-time").addEventListener("click", () => {
    state.simTime = 0;
    state.timeline = [];
    state.result = null;
    state.ran = false;
    state.lastAction = "reset-time";
    pushLog("# sim time reset");
    renderAll();
  });

  function preset(mode, flag) {
    state.mode = mode;
    state[flag] = true;
    applyModeFlags();
    state.lastAction = `preset-${mode}`;
    pushLog(`# preset ${mode}`);
    renderAll();
  }

  document.getElementById("btn-task").addEventListener("click", () => preset("task", "setTask"));
  document
    .getElementById("btn-function")
    .addEventListener("click", () => preset("function", "setFunction"));
  document
    .getElementById("btn-ff")
    .addEventListener("click", () => preset("always_ff", "setAlwaysFf"));
  document
    .getElementById("btn-comb")
    .addEventListener("click", () => preset("always_comb", "setAlwaysComb"));

  const CHALLENGES = [
    {
      id: "quiz-task",
      title: "Quiz: task",
      prompt: "TB helper that may wait on clock is a? Answer: <code>task</code>",
      hint: "can use @ and #",
      type: "text",
      answer: "task",
      alt: ["tasks"],
    },
    {
      id: "quiz-function",
      title: "Quiz: function",
      prompt: "Zero-time helper that returns a value is a? Answer: <code>function</code>",
      hint: "no delay inside",
      type: "text",
      answer: "function",
      alt: ["func", "fn"],
    },
    {
      id: "quiz-always",
      title: "Quiz: always",
      prompt: "RTL procedural block keyword family? Answer: <code>always</code>",
      hint: "always_ff / always_comb",
      type: "text",
      answer: "always",
      alt: ["always_ff", "always_comb", "always_*"],
    },
    {
      id: "quiz-synth",
      title: "Quiz: synth",
      prompt: "Tasks are generally? Answer: <code>not synthesizable</code>",
      hint: "TB only",
      type: "text",
      answer: "not synthesizable",
      alt: ["non-synthesizable", "unsynthesizable", "no", "sim only"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — task construct.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "task" && state.setTask,
    },
    {
      id: "preset-task",
      title: "Preset task",
      prompt: "Preset task.",
      hint: "Preset task",
      type: "state",
      setup: () => {
        state.mode = "function";
        renderAll();
      },
      check: () =>
        state.setTask && state.mode === "task" && state.lastAction === "preset-task",
    },
    {
      id: "preset-function",
      title: "Preset function",
      prompt: "Preset function.",
      hint: "Preset function",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setFunction && state.mode === "function",
    },
    {
      id: "preset-ff",
      title: "Preset always_ff",
      prompt: "Preset always_ff.",
      hint: "Preset always_ff",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setAlwaysFf && state.mode === "always_ff",
    },
    {
      id: "preset-comb",
      title: "Preset always_comb",
      prompt: "Preset always_comb.",
      hint: "Preset always_comb",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setAlwaysComb && state.mode === "always_comb",
    },
    {
      id: "run-task",
      title: "Run task",
      prompt: "On task mode, Run once — sim time advances (e.g. to 20).",
      hint: "Preset task → Run / call once",
      type: "state",
      setup: () => {
        loadStarter();
        state.simTime = 0;
        renderAll();
      },
      check: () =>
        state.mode === "task" && state.ran && state.simTime >= 20,
    },
    {
      id: "run-fn",
      title: "Run function",
      prompt: "Function mode: Run — result is 8, time unchanged from before run.",
      hint: "Reset time → Preset function → Run",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "function";
        state.setFunction = true;
        state.simTime = 5;
        state.result = null;
        state.ran = false;
        renderAll();
      },
      check: () =>
        state.mode === "function" &&
        state.ran &&
        state.result === 8 &&
        state.simTime === 5,
    },
    {
      id: "illegal",
      title: "Illegal timing",
      prompt: "Try illegal # in function — warning about timing in function.",
      hint: "Try illegal # in function",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.illegalTried &&
        state.lastAction === "illegal" &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "compare",
      title: "Compare",
      prompt: "Run Compare all three roles.",
      hint: "Compare all three roles",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.compared && state.lastAction === "compare",
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: task waits, fn returns.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" &&
        state.mode === "function" &&
        state.result === 8 &&
        state.simTime === 20,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain roles.",
      hint: "Explain roles",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-ff",
      title: "Mode always_ff",
      prompt: "Switch Construct dropdown to always_ff.",
      hint: "Construct select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "always_ff" && state.lastAction === "mode",
    },
    {
      id: "code-task",
      title: "Code task",
      prompt: "Task source contains <code>@(posedge clk)</code>.",
      hint: "Preset task",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "task" && sourceCode(state.mode).includes("@(posedge clk)"),
    },
    {
      id: "code-fn",
      title: "Code function",
      prompt: "Function source contains <code>return</code>.",
      hint: "Preset function",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "function" && sourceCode(state.mode).includes("return"),
    },
    {
      id: "code-ff",
      title: "Code always_ff",
      prompt: "always_ff source has <code>always_ff @(posedge clk</code>.",
      hint: "Preset always_ff",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "always_ff" &&
        sourceCode(state.mode).includes("always_ff @(posedge clk"),
    },
    {
      id: "prop-timing",
      title: "Prop timing",
      prompt: "On task mode, Timing controls prop shows yes.",
      hint: "Preset task — check props",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "task" && META.task.yesTiming === true,
    },
    {
      id: "reset-time",
      title: "Reset time",
      prompt: "Reset sim time to 0.",
      hint: "Reset sim time",
      type: "state",
      setup: () => {
        loadStarter();
        state.simTime = 40;
        renderAll();
      },
      check: () => state.simTime === 0 && state.lastAction === "reset-time",
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
        state.result === 8,
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
