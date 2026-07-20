(() => {
  /**
   * CDC / 2-FF synchronizer (concept, no SPICE):
   *   async_in (src domain) → FF1 (dst clk, metastability risk) → FF2 → sync_out
   * Modes: 2ff (safe single-bit), 1ff (unsafe), multibit (wrong for classic 2ff)
   */

  const HIST_MAX = 12;

  function makeStarter() {
    return {
      mode: "2ff", // 2ff | 1ff | multibit
      asyncIn: 0,
      q1: 0,
      q2: 0,
      meta: false, // FF1 conceptually metastable this cycle
      nearEdge: false, // next sample flagged risky
      cycle: 0,
      hist: [], // {asyncIn,q1,q2,meta}
      lastAction: "",
      explained: false,
      stepped: false,
      set2ff: false,
      set1ff: false,
      setMulti: false,
      toggled: false,
      riskArmed: false,
      log: [],
      trace: [],
    };
  }

  function syncOut(state) {
    if (state.mode === "1ff") return state.meta ? "M" : state.q1;
    return state.q2;
  }

  function sourceCode(state) {
    if (state.mode === "1ff") {
      return `// UNSAFE single-flop CDC
always_ff @(posedge clk_dst)
  q1 <= async_in;  // may be metastable — used directly!
assign sync_out = q1;`;
    }
    if (state.mode === "multibit") {
      return `// WRONG: classic 2-FF is for ONE bit
logic [7:0] async_bus; // multi-bit CDC needs Gray / handshake / FIFO
always_ff @(posedge clk_dst) begin
  q1 <= async_bus; // bits can skew — don't do this
  q2 <= q1;
end`;
    }
    return `// 2-FF synchronizer (single bit)
always_ff @(posedge clk_dst) begin
  q1 <= async_in;  // may sample near edge → metastable risk
  q2 <= q1;        // extra cycle to settle
end
assign sync_out = q2;`;
  }

  const CLEARED_KEY = "ddv-cdc-sync-cleared-v1";
  const STORE_KEY = "ddv-cdc-sync-session-v1";

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

  const root = document.getElementById("cdc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 2-FF sync — toggle async_in, step
        <code>clk_dst</code>, watch q1 (risk) then q2 (settled). Compare unsafe 1-FF
        and multi-bit misuse.</p>
      <button type="button" class="btn btn-secondary" id="cdc-starter">Load starter example</button>
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
            <h3>CDC</h3>
            <p>Signal crosses unrelated clocks — timing not guaranteed.</p>
          </div>
          <div class="idea-card">
            <h3>Metastability</h3>
            <p>First dst flop can hang between 0/1 after a bad sample.</p>
          </div>
          <div class="idea-card">
            <h3>2-FF</h3>
            <p>Second flop samples after settle time — use q2, not q1.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Synchronizer chain</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Style
              <select id="mode-sel">
                <option value="2ff" selected>2-FF (safe single-bit)</option>
                <option value="1ff">1-FF (unsafe)</option>
                <option value="multibit">multi-bit misuse</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="chain" id="chain"></div>
          <div class="wave-strip">
            <span class="lbl">async</span><div class="wave-cells" id="w-async"></div>
            <span class="lbl">q1</span><div class="wave-cells" id="w-q1"></div>
            <span class="lbl">q2/out</span><div class="wave-cells" id="w-q2"></div>
          </div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-toggle">Toggle async_in</button>
            <button type="button" id="btn-risk">Arm near-edge sample (meta risk)</button>
            <button type="button" id="btn-step">Step clk_dst ↑</button>
            <button type="button" id="btn-2ff">Preset 2-FF</button>
            <button type="button" id="btn-1ff">Preset unsafe 1-FF</button>
            <button type="button" id="btn-multi">Preset multi-bit misuse</button>
            <button type="button" id="btn-demo">Demo: toggle → risk → 2 steps</button>
            <button type="button" id="btn-explain">Explain CDC / 2-FF</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Domain status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card" id="card-out">
              <h3>sync_out</h3>
              <p class="val" id="val-out">—</p>
              <p class="note" id="note-out"></p>
            </div>
            <div class="status-card" id="card-risk">
              <h3>FF1 status</h3>
              <p class="val" id="val-risk">—</p>
              <p class="note" id="note-risk"></p>
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
          <thead><tr><th>Topic</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>CDC</td><td>No shared timing between src and dst clocks</td></tr>
            <tr><td>2-FF</td><td>Single control/status bit; consume q2</td></tr>
            <tr><td>1-FF</td><td>Unsafe — metastable value used downstream</td></tr>
            <tr><td>Multi-bit</td><td>Use Gray code, handshake, or async FIFO</td></tr>
            <tr><td>MTBF</td><td>Extra flops / slower clk improve mean time between failures</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: 2-FF chain; arm risk then step to see M on q1.</li>
          <li>Never fan out q1 into combo logic in the dst domain.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const modeLegend = document.getElementById("mode-legend");
  const chain = document.getElementById("chain");
  const wAsync = document.getElementById("w-async");
  const wQ1 = document.getElementById("w-q1");
  const wQ2 = document.getElementById("w-q2");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardOut = document.getElementById("card-out");
  const cardRisk = document.getElementById("card-risk");
  const valOut = document.getElementById("val-out");
  const valRisk = document.getElementById("val-risk");
  const noteOut = document.getElementById("note-out");
  const noteRisk = document.getElementById("note-risk");
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

  function pushHist() {
    const out = syncOut(state);
    state.hist.push({
      asyncIn: state.asyncIn,
      q1: state.meta ? "M" : state.q1,
      q2: state.mode === "1ff" ? out : state.q2,
      meta: state.meta,
    });
    if (state.hist.length > HIST_MAX) state.hist = state.hist.slice(-HIST_MAX);
  }

  function stepClock() {
    state.stepped = true;
    state.cycle += 1;
    // shift chain
    if (state.mode === "1ff") {
      state.meta = state.nearEdge;
      state.q1 = state.asyncIn;
      state.nearEdge = false;
    } else {
      // 2ff / multibit: q2 gets previous q1 (resolved), q1 samples async
      const prevQ1 = state.q1;
      // q2 captures prior q1 after a settle time (even if q1 was flagged meta)
      state.q2 = prevQ1;
      state.meta = state.nearEdge;
      state.q1 = state.asyncIn;
      state.nearEdge = false;
    }
    state.riskArmed = false;
    state.lastAction = "step";
    pushHist();
    pushLog(
      state.meta ? "warn" : "ok",
      `# clk_dst #${state.cycle}  q1=${state.meta ? "M" : state.q1}  out=${syncOut(state)}`
    );
    renderAll();
  }

  function renderChain() {
    const out = syncOut(state);
    const q1show = state.meta ? "M" : String(state.q1);
    chain.innerHTML = `
      <div class="ff-box is-async">
        <h3>async_in</h3>
        <p class="val">${state.asyncIn}</p>
      </div>
      <span class="arrow">→</span>
      <div class="ff-box ${state.meta ? "is-meta" : "is-ok"}">
        <h3>FF1 q1</h3>
        <p class="val">${q1show}</p>
      </div>
      <span class="arrow">${state.mode === "1ff" ? "⇒" : "→"}</span>
      ${
        state.mode === "1ff"
          ? `<div class="ff-box ${state.meta ? "is-meta" : "is-ok"}"><h3>sync_out</h3><p class="val">${out}</p></div>`
          : `<div class="ff-box is-ok"><h3>FF2 q2</h3><p class="val">${state.q2}</p></div>
             <span class="arrow">→</span>
             <div class="ff-box is-ok"><h3>sync_out</h3><p class="val">${out}</p></div>`
      }`;
  }

  function renderWave() {
    function paint(el, key) {
      el.innerHTML = "";
      state.hist.forEach((h, i) => {
        const cell = document.createElement("div");
        const v = h[key];
        cell.className = "wave-cell";
        if (v === "M") cell.classList.add("is-m");
        else if (v === 1 || v === "1") cell.classList.add("is-1");
        if (i === state.hist.length - 1) cell.classList.add("is-now");
        cell.textContent = String(v);
        el.appendChild(cell);
      });
      if (!state.hist.length) {
        el.innerHTML = '<span style="color:var(--muted)">(step clock)</span>';
      }
    }
    paint(wAsync, "asyncIn");
    paint(wQ1, "q1");
    paint(wQ2, "q2");
  }

  function renderStatus() {
    const out = syncOut(state);
    valOut.textContent = String(out);
    noteOut.textContent =
      state.mode === "1ff"
        ? "taken from q1 (unsafe)"
        : "taken from q2 (safe path)";
    cardOut.className =
      "status-card" +
      (out === "M" || state.mode === "1ff" ? " is-warn" : " is-ok");

    valRisk.textContent = state.meta ? "metastable" : "stable";
    noteRisk.textContent = state.nearEdge
      ? "next edge armed for risk"
      : state.meta
        ? "do not use q1 downstream"
        : "FF1 settled";
    cardRisk.className =
      "status-card" + (state.meta || state.nearEdge ? " is-warn" : " is-ok");
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (state.mode === "1ff") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "1-FF CDC: sync_out can be metastable — never ship this for async inputs.";
    } else if (state.mode === "multibit") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Multi-bit buses need Gray, handshake, or async FIFO — not a naked 2-FF each bit.";
    } else if (state.meta) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "FF1 metastable (concept) — q2 still holds the previous settled bit.";
    } else if (state.mode === "2ff") {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent =
        "2-FF single-bit path: consume q2 in the destination domain.";
    } else {
      warnBox.classList.add("hidden");
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(step, demo, or explain)</span>';
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
    if (state.mode === "1ff")
      return "Unsafe: one destination flop — metastability can corrupt logic.";
    if (state.mode === "multibit")
      return "Classic 2-FF is a single-bit tool; buses need other CDC structures.";
    return "Safe pattern for one async bit: two flops on clk_dst, use q2.";
  }

  function renderAll() {
    modeSel.value = state.mode;
    modeLegend.textContent = legendText();
    renderChain();
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
    state.set2ff = true;
    pushLog("muted", "# starter 2-FF synchronizer");
    state.trace = [];
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "CDC / 2-FF" },
      { kind: "hi", text: "async_in can change anytime vs clk_dst" },
      {
        kind: "warn",
        text: "FF1 may go metastable if sampled near the edge",
      },
      { kind: "ok", text: "FF2 samples later — MTBF improves" },
      {
        kind: "run",
        text: "Use q2 only; single-bit; buses need Gray/FIFO/handshake",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  function runDemo() {
    state.mode = "2ff";
    state.set2ff = true;
    state.asyncIn = 0;
    state.q1 = 0;
    state.q2 = 0;
    state.meta = false;
    state.nearEdge = false;
    state.hist = [];
    state.asyncIn = 1;
    state.toggled = true;
    state.nearEdge = true;
    state.riskArmed = true;
    stepClock(); // q1 may be M, q2=0
    state.nearEdge = false;
    stepClock(); // q2 gets settled, q1=1 stable
    state.lastAction = "demo";
    state.trace = [
      { kind: "muted", text: "demo" },
      { kind: "run", text: "async_in→1, near-edge sample, two clk_dst steps" },
      {
        kind: "ok",
        text: `now out=${syncOut(state)}  q1=${state.meta ? "M" : state.q1}`,
      },
    ];
    pushLog("ok", "# demo done");
    renderAll();
  }

  document.getElementById("cdc-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "2ff") state.set2ff = true;
    if (state.mode === "1ff") state.set1ff = true;
    if (state.mode === "multibit") state.setMulti = true;
    state.meta = false;
    state.nearEdge = false;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  document.getElementById("btn-toggle").addEventListener("click", () => {
    state.asyncIn = state.asyncIn ? 0 : 1;
    state.toggled = true;
    state.lastAction = "toggle";
    pushLog("run", `# async_in → ${state.asyncIn}`);
    renderAll();
  });

  document.getElementById("btn-risk").addEventListener("click", () => {
    state.nearEdge = true;
    state.riskArmed = true;
    state.lastAction = "risk";
    pushLog("warn", "# near-edge sample armed");
    renderAll();
  });

  document.getElementById("btn-step").addEventListener("click", stepClock);

  document.getElementById("btn-2ff").addEventListener("click", () => {
    state.mode = "2ff";
    state.set2ff = true;
    state.meta = false;
    state.nearEdge = false;
    state.lastAction = "preset-2ff";
    pushLog("ok", "# preset 2-FF");
    renderAll();
  });

  document.getElementById("btn-1ff").addEventListener("click", () => {
    state.mode = "1ff";
    state.set1ff = true;
    state.meta = false;
    state.nearEdge = false;
    state.lastAction = "preset-1ff";
    pushLog("warn", "# preset 1-FF unsafe");
    renderAll();
  });

  document.getElementById("btn-multi").addEventListener("click", () => {
    state.mode = "multibit";
    state.setMulti = true;
    state.lastAction = "preset-multi";
    pushLog("warn", "# preset multi-bit misuse");
    renderAll();
  });

  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-cdc",
      title: "Quiz: CDC",
      prompt: "Clock-domain crossing acronym? Answer: <code>CDC</code>",
      hint: "title",
      type: "text",
      answer: "cdc",
      alt: ["CDC", "clock domain crossing"],
    },
    {
      id: "quiz-meta",
      title: "Quiz: meta",
      prompt: "Bad sample can leave FF1 in? Answer: <code>metastability</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "metastability",
      alt: ["metastable", "meta"],
    },
    {
      id: "quiz-2ff",
      title: "Quiz: 2-FF",
      prompt: "Safe single-bit sync uses how many dst flops? Answer: <code>2</code>",
      hint: "two-flop",
      type: "text",
      answer: "2",
      alt: ["two", "2-ff", "2ff"],
    },
    {
      id: "quiz-q2",
      title: "Quiz: q2",
      prompt: "Which flop output should dst logic use? Answer: <code>q2</code>",
      hint: "not q1",
      type: "text",
      answer: "q2",
      alt: ["ff2", "second", "sync_out"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 2-FF mode.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "2ff" && state.set2ff,
    },
    {
      id: "toggle",
      title: "Toggle",
      prompt: "Toggle async_in.",
      hint: "Toggle async_in",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggled && state.lastAction === "toggle",
    },
    {
      id: "step",
      title: "Step clock",
      prompt: "Step clk_dst at least once.",
      hint: "Step clk_dst ↑",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cycle >= 1,
    },
    {
      id: "risk-arm",
      title: "Arm risk",
      prompt: "Arm near-edge sample (meta risk).",
      hint: "Arm near-edge sample",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.riskArmed &&
        state.nearEdge &&
        state.lastAction === "risk",
    },
    {
      id: "meta-step",
      title: "Meta on q1",
      prompt: "Arm risk then Step — q1 shows metastable.",
      hint: "Arm → Step clk_dst",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.meta === true,
    },
    {
      id: "preset-2ff",
      title: "Preset 2-FF",
      prompt: "Preset 2-FF.",
      hint: "Preset 2-FF",
      type: "state",
      setup: () => {
        state.mode = "1ff";
        renderAll();
      },
      check: () =>
        state.set2ff &&
        state.mode === "2ff" &&
        state.lastAction === "preset-2ff",
    },
    {
      id: "preset-1ff",
      title: "Preset 1-FF",
      prompt: "Preset unsafe 1-FF.",
      hint: "Preset unsafe 1-FF",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.set1ff && state.mode === "1ff",
    },
    {
      id: "preset-multi",
      title: "Preset multi",
      prompt: "Preset multi-bit misuse.",
      hint: "Preset multi-bit misuse",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setMulti && state.mode === "multibit",
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: toggle → risk → 2 steps.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "demo" && state.cycle >= 2,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain CDC / 2-FF.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-1ff",
      title: "Mode 1-FF",
      prompt: "Switch Style dropdown to 1-FF (unsafe).",
      hint: "Style select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "1ff" && state.lastAction === "mode",
    },
    {
      id: "quiz-bus",
      title: "Quiz: bus",
      prompt: "Multi-bit CDC often uses? Answer: <code>fifo</code>",
      hint: "async FIFO / Gray / handshake — fifo accepted",
      type: "text",
      answer: "fifo",
      alt: ["async fifo", "gray", "handshake", "gray code"],
    },
    {
      id: "code-2ff",
      title: "Code 2-FF",
      prompt: "2-FF source assigns sync_out from q2.",
      hint: "Preset 2-FF",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "2ff" &&
        sourceCode(state).includes("sync_out = q2"),
    },
    {
      id: "code-1ff",
      title: "Code 1-FF",
      prompt: "1-FF source uses q1 as sync_out.",
      hint: "Preset unsafe 1-FF",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "1ff" &&
        sourceCode(state).includes("sync_out = q1"),
    },
    {
      id: "warn-1ff",
      title: "Warn 1-FF",
      prompt: "1-FF mode shows warning (not is-ok).",
      hint: "Preset unsafe 1-FF",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "1ff" &&
        !warnBox.classList.contains("hidden") &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "propagate",
      title: "Propagate",
      prompt: "On 2-FF: set async_in=1 (toggle if needed), step twice — q2 becomes 1.",
      hint: "Toggle to 1 → Step → Step",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "2ff" &&
        state.asyncIn === 1 &&
        state.q2 === 1 &&
        !state.meta,
    },
    {
      id: "hist",
      title: "History",
      prompt: "After at least one step, wave history is non-empty.",
      hint: "Step clk_dst",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.hist.length >= 1,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "2ff" &&
        state.cycle >= 2 &&
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
