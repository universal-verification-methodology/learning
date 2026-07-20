(() => {
  /**
   * Clock enable vs gated clock:
   *   enable (CE) — free-running clk; if (ce) q <= d;  (preferred RTL style)
   *   gated       — clk_g = clk & en; always_ff @(posedge clk_g)  (glitch risk)
   *   icg         — latch-based integrated clock gate sketch (safer when gating needed)
   */

  const HIST_MAX = 12;

  function makeStarter() {
    return {
      mode: "enable", // enable | gated | icg
      clk: 0,
      ce: 1, // clock enable / gate enable
      d: 1,
      q: 0,
      glitch: false,
      enChangeArmed: false, // change enable near rising edge → glitch on gated
      cycle: 0,
      hist: [],
      lastAction: "",
      explained: false,
      stepped: false,
      setEnable: false,
      setGated: false,
      setIcg: false,
      toggledCe: false,
      toggledD: false,
      log: [],
      trace: [],
    };
  }

  function clkToFlop(state) {
    if (state.mode === "enable") return state.clk; // free-running
    if (state.mode === "icg") return state.clk && state.ce ? 1 : 0; // clean gate concept
    // gated AND
    return state.clk && state.ce ? 1 : 0;
  }

  function sourceCode(state) {
    if (state.mode === "enable") {
      return `// Preferred: clock enable on the D-path
always_ff @(posedge clk) begin
  if (ce) q <= d;   // clk always toggles; load when ce=1
end`;
    }
    if (state.mode === "icg") {
      return `// Integrated clock gate (cell) — when power gating is required
// latch en when clk low, then AND — avoids most AND-glitches
logic en_latched;
always_latch if (!clk) en_latched <= ce;
assign clk_g = clk & en_latched;
always_ff @(posedge clk_g) q <= d;`;
    }
    return `// Risky: AND-gated clock
assign clk_g = clk & ce;  // ce change while clk=1 → GLITCH
always_ff @(posedge clk_g) q <= d;`;
  }

  const CLEARED_KEY = "ddv-clock-enable-cleared-v1";
  const STORE_KEY = "ddv-clock-enable-session-v1";

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

  const root = document.getElementById("ce-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> clock-enable style —
        free-running <code>clk</code>, load with <code>if (ce)</code>.
        Compare AND-gated clock (glitch risk) and ICG sketch.</p>
      <button type="button" class="btn btn-secondary" id="ce-starter">Load starter example</button>
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
            <h3>Clock enable</h3>
            <p>Mux/hold on D — clock stays clean and free-running.</p>
          </div>
          <div class="idea-card">
            <h3>Gated clock</h3>
            <p>AND on clk — glitches &amp; skew if enable is raw combo.</p>
          </div>
          <div class="idea-card">
            <h3>ICG</h3>
            <p>Library clock-gate cell when you truly must gate.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Enable vs gate</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Style
              <select id="mode-sel">
                <option value="enable" selected>clock enable (CE)</option>
                <option value="gated">AND-gated clock</option>
                <option value="icg">ICG sketch</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="diagram" id="diagram"></div>
          <div class="wave-strip">
            <span class="lbl">clk</span><div class="wave-cells" id="w-clk"></div>
            <span class="lbl">ce/en</span><div class="wave-cells" id="w-ce"></div>
            <span class="lbl">q</span><div class="wave-cells" id="w-q"></div>
          </div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-toggle-ce">Toggle ce / en</button>
            <button type="button" id="btn-toggle-d">Toggle d</button>
            <button type="button" id="btn-step">Step clk ↑ (posedge)</button>
            <button type="button" id="btn-glitch">Arm enable glitch (gated)</button>
            <button type="button" id="btn-ce">Preset clock enable</button>
            <button type="button" id="btn-gated">Preset AND-gated</button>
            <button type="button" id="btn-icg">Preset ICG</button>
            <button type="button" id="btn-demo">Demo: CE load then hold</button>
            <button type="button" id="btn-explain">Explain CE vs gate</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Capture status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card" id="card-q">
              <h3>q</h3>
              <p class="val" id="val-q">—</p>
              <p class="note" id="note-q"></p>
            </div>
            <div class="status-card" id="card-clk">
              <h3>Clock into FF</h3>
              <p class="val" id="val-clk">—</p>
              <p class="note" id="note-clk"></p>
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
          <thead><tr><th>Style</th><th>Pros / cons</th></tr></thead>
          <tbody>
            <tr><td>Clock enable</td><td>Clean clk tree; easy STA; preferred default</td></tr>
            <tr><td>AND gate on clk</td><td>Glitch / skew risk — avoid raw gating</td></tr>
            <tr><td>ICG cell</td><td>Power savings with library-qualified gating</td></tr>
            <tr><td>Hold</td><td>CE=0 → q keeps value (recycle)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: CE=1 loads d on each posedge; CE=0 holds.</li>
          <li>Arm glitch on gated mode: enable flips while clock high.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const modeLegend = document.getElementById("mode-legend");
  const diagram = document.getElementById("diagram");
  const wClk = document.getElementById("w-clk");
  const wCe = document.getElementById("w-ce");
  const wQ = document.getElementById("w-q");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardQ = document.getElementById("card-q");
  const cardClk = document.getElementById("card-clk");
  const valQ = document.getElementById("val-q");
  const valClk = document.getElementById("val-clk");
  const noteQ = document.getElementById("note-q");
  const noteClk = document.getElementById("note-clk");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 40) state.log = state.log.slice(-30);
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      if (!Array.isArray(state.hist)) state.hist = [];
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function pushHist(extra) {
    state.hist.push({
      clk: 1,
      ce: state.ce,
      q: state.q,
      glitch: !!extra?.glitch,
    });
    if (state.hist.length > HIST_MAX) state.hist = state.hist.slice(-HIST_MAX);
  }

  function stepPosedge() {
    state.stepped = true;
    state.cycle += 1;
    state.glitch = false;

    if (state.mode === "gated" && state.enChangeArmed) {
      // enable changed while conceptually clk high → spurious edge
      state.glitch = true;
      state.enChangeArmed = false;
      // glitch may false-trigger capture
      state.q = state.d;
      state.lastAction = "step";
      pushHist({ glitch: true });
      pushLog("bad", `# GLITCH capture  q→${state.q}`);
      renderAll();
      return;
    }

    if (state.mode === "enable") {
      if (state.ce) state.q = state.d;
      // else hold
    } else {
      // gated / icg: rising clk_g only if ce allows
      if (state.ce) state.q = state.d;
    }
    state.enChangeArmed = false;
    state.lastAction = "step";
    pushHist({});
    pushLog(
      "ok",
      `# posedge #${state.cycle}  ce=${state.ce}  q=${state.q}${state.ce ? " (load)" : " (hold)"}`
    );
    renderAll();
  }

  function renderDiagram() {
    const gated = state.mode !== "enable";
    const clkFF = gated ? `clk&en=${clkToFlop({ ...state, clk: 1 })}` : "clk";
    diagram.innerHTML = `
      <div class="node is-clk">
        <h3>clk</h3>
        <p class="val">free</p>
      </div>
      <span class="arrow">${state.mode === "enable" ? "→ FF" : state.mode === "icg" ? "→ ICG →" : "→ AND →"}</span>
      <div class="node ${state.glitch ? "is-warn" : "is-ok"}">
        <h3>${state.mode === "enable" ? "q (CE path)" : "q (gated clk)"}</h3>
        <p class="val">${state.q}</p>
      </div>`;
    void clkFF;
  }

  function renderWave() {
    function paint(el, key) {
      el.innerHTML = "";
      if (!state.hist.length) {
        el.innerHTML = '<span style="color:var(--muted)">(step)</span>';
        return;
      }
      state.hist.forEach((h, i) => {
        const cell = document.createElement("div");
        cell.className = "wave-cell";
        let v = h[key];
        if (key === "clk") v = "↑";
        if (h.glitch && key === "clk") {
          cell.classList.add("is-g");
          cell.textContent = "G";
        } else {
          if (v === 1 || v === "1" || v === "↑") cell.classList.add("is-1");
          cell.textContent = String(v);
        }
        if (i === state.hist.length - 1) cell.classList.add("is-now");
        el.appendChild(cell);
      });
    }
    paint(wClk, "clk");
    paint(wCe, "ce");
    paint(wQ, "q");
  }

  function renderStatus() {
    valQ.textContent = String(state.q);
    noteQ.textContent = state.ce
      ? "last edge could load"
      : "holding while ce/en=0";
    cardQ.className = "status-card is-ok";

    if (state.mode === "enable") {
      valClk.textContent = "free-running";
      noteClk.textContent = "posedge clk always reaches FF";
      cardClk.className = "status-card is-ok";
    } else if (state.mode === "icg") {
      valClk.textContent = "ICG clk_g";
      noteClk.textContent = "qualified gate cell sketch";
      cardClk.className = "status-card is-ok";
    } else {
      valClk.textContent = state.glitch ? "GLITCH" : "clk & en";
      noteClk.textContent = "raw AND — fragile";
      cardClk.className =
        "status-card" + (state.glitch ? " is-warn" : " is-warn");
    }
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (state.glitch) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Glitch: enable changed into an AND-gated clock — spurious capture.";
    } else if (state.mode === "gated") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Raw clk&en gating is hazardous — prefer CE or a library ICG.";
    } else if (state.mode === "enable") {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent =
        "Clock-enable style keeps a single clean clock network.";
    } else if (state.mode === "icg") {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent =
        "ICG: use when power requires gating — still not a random AND.";
    } else {
      warnBox.classList.add("hidden");
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(demo or explain)</span>';
      return;
    }
    traceBox.innerHTML = state.trace
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no actions yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function legendText() {
    if (state.mode === "enable")
      return "CE on datapath: clk always clocks; ce chooses load vs hold.";
    if (state.mode === "icg")
      return "ICG latches enable while clk low — power gating done safely.";
    return "AND gate on clock: enable transitions can create extra edges.";
  }

  function renderAll() {
    modeSel.value = state.mode;
    modeLegend.textContent = legendText();
    renderDiagram();
    renderWave();
    codeBox.textContent = sourceCode(state);
    renderStatus();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setEnable = true;
    pushLog("muted", "# starter clock enable");
    state.trace = [];
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "CE vs gated clock" },
      { kind: "ok", text: "Prefer if (ce) q<=d on free-running clk" },
      {
        kind: "bad",
        text: "assign clk_g = clk & en — glitch / STA pain",
      },
      { kind: "hi", text: "ICG cell when you must gate for power" },
      {
        kind: "run",
        text: `now: mode=${state.mode}  q=${state.q}  ce=${state.ce}`,
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  function runDemo() {
    state.mode = "enable";
    state.setEnable = true;
    state.q = 0;
    state.d = 1;
    state.ce = 1;
    state.hist = [];
    state.glitch = false;
    stepPosedge(); // load 1
    state.ce = 0;
    state.d = 0;
    state.toggledCe = true;
    stepPosedge(); // hold 1
    state.lastAction = "demo";
    state.trace = [
      { kind: "muted", text: "demo CE" },
      { kind: "ok", text: "ce=1 → load d=1" },
      { kind: "run", text: "ce=0 → hold q=1 even if d=0" },
    ];
    pushLog("ok", "# demo done");
    renderAll();
  }

  document.getElementById("ce-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "enable") state.setEnable = true;
    if (state.mode === "gated") state.setGated = true;
    if (state.mode === "icg") state.setIcg = true;
    state.glitch = false;
    state.enChangeArmed = false;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  document.getElementById("btn-toggle-ce").addEventListener("click", () => {
    state.ce = state.ce ? 0 : 1;
    state.toggledCe = true;
    state.lastAction = "toggle-ce";
    pushLog("run", `# ce/en → ${state.ce}`);
    renderAll();
  });

  document.getElementById("btn-toggle-d").addEventListener("click", () => {
    state.d = state.d ? 0 : 1;
    state.toggledD = true;
    state.lastAction = "toggle-d";
    pushLog("run", `# d → ${state.d}`);
    renderAll();
  });

  document.getElementById("btn-step").addEventListener("click", stepPosedge);

  document.getElementById("btn-glitch").addEventListener("click", () => {
    if (state.mode !== "gated") {
      state.mode = "gated";
      state.setGated = true;
    }
    state.enChangeArmed = true;
    state.lastAction = "arm-glitch";
    pushLog("warn", "# enable-glitch armed for next step");
    renderAll();
  });

  document.getElementById("btn-ce").addEventListener("click", () => {
    state.mode = "enable";
    state.setEnable = true;
    state.glitch = false;
    state.enChangeArmed = false;
    state.lastAction = "preset-ce";
    pushLog("ok", "# preset clock enable");
    renderAll();
  });

  document.getElementById("btn-gated").addEventListener("click", () => {
    state.mode = "gated";
    state.setGated = true;
    state.glitch = false;
    state.lastAction = "preset-gated";
    pushLog("warn", "# preset AND-gated");
    renderAll();
  });

  document.getElementById("btn-icg").addEventListener("click", () => {
    state.mode = "icg";
    state.setIcg = true;
    state.glitch = false;
    state.enChangeArmed = false;
    state.lastAction = "preset-icg";
    pushLog("ok", "# preset ICG");
    renderAll();
  });

  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-ce",
      title: "Quiz: CE",
      prompt: "Preferred style uses a? Answer: <code>clock enable</code>",
      hint: "if (ce) q<=d",
      type: "text",
      answer: "clock enable",
      alt: ["ce", "enable", "clock-enable"],
    },
    {
      id: "quiz-gate",
      title: "Quiz: gate",
      prompt: "Risky clk&en style is a? Answer: <code>gated clock</code>",
      hint: "AND on clock",
      type: "text",
      answer: "gated clock",
      alt: ["gated", "clock gating", "and gate"],
    },
    {
      id: "quiz-icg",
      title: "Quiz: ICG",
      prompt: "Library clock-gate cell acronym? Answer: <code>ICG</code>",
      hint: "integrated clock gate",
      type: "text",
      answer: "icg",
      alt: ["ICG", "integrated clock gate"],
    },
    {
      id: "quiz-glitch",
      title: "Quiz: glitch",
      prompt: "Enable flipping into AND-gated clk can cause a? Answer: <code>glitch</code>",
      hint: "spurious edge",
      type: "text",
      answer: "glitch",
      alt: ["glitches", "hazard"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — clock enable mode.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "enable" && state.setEnable,
    },
    {
      id: "preset-ce",
      title: "Preset CE",
      prompt: "Preset clock enable.",
      hint: "Preset clock enable",
      type: "state",
      setup: () => {
        state.mode = "gated";
        renderAll();
      },
      check: () =>
        state.setEnable &&
        state.mode === "enable" &&
        state.lastAction === "preset-ce",
    },
    {
      id: "preset-gated",
      title: "Preset gated",
      prompt: "Preset AND-gated.",
      hint: "Preset AND-gated",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setGated && state.mode === "gated",
    },
    {
      id: "preset-icg",
      title: "Preset ICG",
      prompt: "Preset ICG.",
      hint: "Preset ICG",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setIcg && state.mode === "icg",
    },
    {
      id: "toggle-ce",
      title: "Toggle ce",
      prompt: "Toggle ce / en.",
      hint: "Toggle ce / en",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledCe && state.lastAction === "toggle-ce",
    },
    {
      id: "step",
      title: "Step",
      prompt: "Step clk ↑ at least once.",
      hint: "Step clk ↑",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cycle >= 1,
    },
    {
      id: "load",
      title: "Load",
      prompt: "On CE mode with ce=1, step so q equals d.",
      hint: "Ensure ce=1, set d, Step",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enable" &&
        state.ce === 1 &&
        state.q === state.d &&
        state.cycle >= 1,
    },
    {
      id: "hold",
      title: "Hold",
      prompt: "CE mode: load q=1, set ce=0 and d=0, step — q stays 1.",
      hint: "Demo button or manual hold",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enable" &&
        state.ce === 0 &&
        state.d === 0 &&
        state.q === 1,
    },
    {
      id: "glitch",
      title: "Glitch",
      prompt: "Arm enable glitch then Step — glitch flag true.",
      hint: "Preset gated → Arm glitch → Step",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.glitch === true,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: CE load then hold.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" && state.q === 1 && state.ce === 0,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain CE vs gate.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-gated",
      title: "Mode gated",
      prompt: "Switch Style dropdown to AND-gated clock.",
      hint: "Style select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "gated" && state.lastAction === "mode",
    },
    {
      id: "code-ce",
      title: "Code CE",
      prompt: "CE mode source has <code>if (ce)</code>.",
      hint: "Preset clock enable",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enable" && sourceCode(state).includes("if (ce)"),
    },
    {
      id: "code-gated",
      title: "Code gated",
      prompt: "Gated mode source has <code>clk & ce</code> or <code>clk &amp; ce</code>.",
      hint: "Preset AND-gated",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "gated" && sourceCode(state).includes("clk & ce"),
    },
    {
      id: "code-icg",
      title: "Code ICG",
      prompt: "ICG source mentions <code>en_latched</code>.",
      hint: "Preset ICG",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "icg" &&
        sourceCode(state).includes("en_latched"),
    },
    {
      id: "warn-gated",
      title: "Warn gated",
      prompt: "Gated mode warning visible (not is-ok) when no glitch.",
      hint: "Preset AND-gated",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "gated" &&
        !state.glitch &&
        !warnBox.classList.contains("hidden") &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "toggle-d",
      title: "Toggle d",
      prompt: "Toggle d.",
      hint: "Toggle d",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledD && state.lastAction === "toggle-d",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enable" &&
        state.q === 1 &&
        state.explained &&
        state.lastAction === "explain",
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

  function renderChallenge() {
    const c = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (clearedIds.length ? ` · ${clearedIds.length} cleared` : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${c.title}.</strong> ${c.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? "Hint: " + c.hint : "";
    const row = document.getElementById("chal-answer-row");
    row.innerHTML = "";
    if (c.type === "text") {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = "chal-input";
      inp.placeholder = "Your answer";
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
      row.appendChild(inp);
    }
    const st = document.getElementById("chal-status");
    st.textContent = isCleared(c.id) ? "Cleared" : "Idle";
    st.className =
      "challenge-status " + (isCleared(c.id) ? "pass" : "idle");

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kbd" + (i === challengeIdx ? " is-active" : "");
      b.textContent = (isCleared(ch.id) ? "✓ " : "") + ch.id;
      b.title = ch.title;
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
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
    const c = CHALLENGES[challengeIdx];
    if (typeof c.setup === "function") c.setup();
    renderChallenge();
    saveSession();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const c = CHALLENGES[challengeIdx];
    const st = document.getElementById("chal-status");
    let ok = false;
    if (c.type === "text") {
      const got = normalizeAns(answerDraft || "");
      const targets = [c.answer, ...(c.alt || [])].map(normalizeAns);
      ok = targets.includes(got);
    } else if (c.type === "state") {
      ok = !!c.check();
    }
    if (ok) {
      markCleared(c.id);
      st.textContent = "Pass";
      st.className = "challenge-status pass";
      pushLog("ok", `# challenge ${c.id} pass`);
    } else {
      st.textContent = "Fail";
      st.className = "challenge-status fail";
      pushLog("warn", `# challenge ${c.id} fail`);
    }
    renderChallenge();
    renderLog();
    saveSession();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
