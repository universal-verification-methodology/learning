(() => {
  /**
   * Shift-register lab — 4-bit chain
   *   SISO — serial in → serial out (shift toward SO)
   *   SIPO — serial in → parallel out (same shift; read q*)
   *   PISO — parallel load, then serial out
   *   PIPO — parallel in → parallel out (register load)
   *
   * Shift toward SO (MSB = q3): so = q3; q <= {q2,q1,q0,si}
   */

  const W = 4;
  const HIST_MAX = 10;

  function bitsToStr(bits) {
    return bits.map(String).join("");
  }

  function cloneBits(bits) {
    return bits.slice();
  }

  function makeStarter() {
    return {
      mode: "siso", // siso | sipo | piso | pipo
      q: [0, 0, 0, 0], // q0 = near SI, q3 = near SO / MSB
      si: 1,
      pi: [1, 0, 1, 0], // parallel in [pi0..pi3]
      load: 0, // PISO: 1 = parallel load this edge
      so: 0,
      cycle: 0,
      hist: [],
      lastAction: "",
      explained: false,
      stepped: false,
      setSiso: false,
      setSipo: false,
      setPiso: false,
      setPipo: false,
      toggledSi: false,
      toggledPi: false,
      toggledLoad: false,
      cleared: false,
      log: [],
      trace: [],
    };
  }

  function sourceCode(state) {
    if (state.mode === "siso") {
      return `// SISO — serial in, serial out
// so = q[3]; q <= {q[2:0], si};
always_ff @(posedge clk) begin
  q <= {q[2:0], si};
end
assign so = q[3];`;
    }
    if (state.mode === "sipo") {
      return `// SIPO — serial in, parallel out
always_ff @(posedge clk) begin
  q <= {q[2:0], si};
end
assign po = q;  // read all bits`;
    }
    if (state.mode === "piso") {
      return `// PISO — parallel load, then shift out
always_ff @(posedge clk) begin
  if (load) q <= pi;
  else      q <= {q[2:0], 1'b0}; // shift toward SO
end
assign so = q[3];`;
    }
    return `// PIPO — parallel in, parallel out
always_ff @(posedge clk) begin
  if (load) q <= pi;
end
assign po = q;`;
  }

  function modeLegend(mode) {
    if (mode === "siso") return "Serial bit walks q0→q3; SO is the bit leaving q3.";
    if (mode === "sipo") return "Same shift as SISO; parallel out is the whole q vector.";
    if (mode === "piso") return "Load=1 captures PI; Load=0 shifts toward SO.";
    return "Load=1 writes PI into q; parallel out is q (no serial path).";
  }

  const CLEARED_KEY = "ddv-shift-register-lab-cleared-v1";
  const STORE_KEY = "ddv-shift-register-lab-session-v1";

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

  const root = document.getElementById("sr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> SISO with <code>si=1</code>, empty chain —
        step the clock to walk bits toward serial out.</p>
      <button type="button" class="btn btn-secondary" id="sr-starter">Load starter example</button>
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
            <h3>SISO</h3>
            <p>One bit in, one bit out — delay line / serializer core.</p>
          </div>
          <div class="idea-card">
            <h3>SIPO</h3>
            <p>Serial gather, then read the parallel word.</p>
          </div>
          <div class="idea-card">
            <h3>PISO</h3>
            <p>Load a word, then clock bits out serially.</p>
          </div>
          <div class="idea-card">
            <h3>PIPO</h3>
            <p>Ordinary parallel register (load / hold).</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>4-bit chain</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="siso" selected>SISO</option>
                <option value="sipo">SIPO</option>
                <option value="piso">PISO</option>
                <option value="pipo">PIPO</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="chain" id="chain" aria-label="Flip-flop chain"></div>
          <div class="pi-row" id="pi-row"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-toggle-si">Toggle SI</button>
            <button type="button" id="btn-toggle-load">Toggle load</button>
            <button type="button" id="btn-step">Step clk ↑</button>
            <button type="button" id="btn-clear">Clear q</button>
            <button type="button" id="btn-siso">Preset SISO</button>
            <button type="button" id="btn-sipo">Preset SIPO</button>
            <button type="button" id="btn-piso">Preset PISO</button>
            <button type="button" id="btn-pipo">Preset PIPO</button>
            <button type="button" id="btn-demo">Demo: shift 1010 in</button>
            <button type="button" id="btn-explain">Explain modes</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Ports &amp; status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>q[3:0]</h3>
              <p class="val" id="val-q">—</p>
              <p class="note" id="note-q"></p>
            </div>
            <div class="status-card">
              <h3>SO / cycle</h3>
              <p class="val" id="val-so">—</p>
              <p class="note" id="note-so"></p>
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
          <thead><tr><th>Mode</th><th>In</th><th>Out</th></tr></thead>
          <tbody>
            <tr><td>SISO</td><td>SI</td><td>SO</td></tr>
            <tr><td>SIPO</td><td>SI</td><td>PO = q</td></tr>
            <tr><td>PISO</td><td>PI + load</td><td>SO</td></tr>
            <tr><td>PIPO</td><td>PI + load</td><td>PO = q</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Shift toward SO: <code>q &lt;= {q[2:0], si}</code>; bit that leaves is former q3.</li>
          <li>Demo shifts <code>1,0,1,0</code> into a cleared SISO/SIPO chain (LSB first).</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = /** @type {HTMLSelectElement} */ (document.getElementById("mode-sel"));
  const modeLegendEl = document.getElementById("mode-legend");
  const chain = document.getElementById("chain");
  const piRow = document.getElementById("pi-row");
  const codeBox = document.getElementById("code-box");
  const valQ = document.getElementById("val-q");
  const noteQ = document.getElementById("note-q");
  const valSo = document.getElementById("val-so");
  const noteSo = document.getElementById("note-so");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function pushLog(kind, msg) {
    state.log.unshift({ kind, msg, t: state.cycle });
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushHist() {
    state.hist.push({
      q: bitsToStr(state.q),
      si: state.si,
      so: state.so,
      load: state.load,
    });
    if (state.hist.length > HIST_MAX) state.hist.shift();
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function applyModeFlags() {
    if (state.mode === "siso") state.setSiso = true;
    if (state.mode === "sipo") state.setSipo = true;
    if (state.mode === "piso") state.setPiso = true;
    if (state.mode === "pipo") state.setPipo = true;
  }

  function stepPosedge() {
    const prev = cloneBits(state.q);
    const leaving = prev[W - 1];
    let next = cloneBits(prev);

    if (state.mode === "siso" || state.mode === "sipo") {
      next = [state.si, prev[0], prev[1], prev[2]];
      state.so = leaving;
    } else if (state.mode === "piso") {
      if (state.load) {
        next = cloneBits(state.pi);
        state.so = leaving; // old MSB still "seen" conceptually; keep leaving
      } else {
        next = [0, prev[0], prev[1], prev[2]];
        state.so = leaving;
      }
    } else {
      // pipo
      if (state.load) next = cloneBits(state.pi);
      state.so = 0;
    }

    state.q = next;
    state.cycle += 1;
    state.stepped = true;
    state.lastAction = "step";
    pushHist();
    pushTrace(
      `t${state.cycle}: ${state.mode} q=${bitsToStr(prev)}→${bitsToStr(next)} si=${state.si} load=${state.load} so=${state.so}`
    );
    pushLog("ok", `# step → q=${bitsToStr(state.q)} so=${state.so}`);
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setSiso = true;
    state.lastAction = "starter";
    pushLog("ok", "# starter SISO loaded");
    renderAll();
  }

  function runDemo() {
    state.mode = "siso";
    state.setSiso = true;
    state.q = [0, 0, 0, 0];
    state.load = 0;
    state.so = 0;
    state.cycle = 0;
    state.hist = [];
    state.trace = [];
    // Shift in 1,0,1,0 LSB-first (si sequence) → after 4 clocks q = 0,1,0,1 (q0..q3) i.e. "0101" as string q0q1q2q3
    // Wait: q <= {si into q0}: after si=1: q=[1,0,0,0]
    // si=0: [0,1,0,0]
    // si=1: [1,0,1,0]
    // si=0: [0,1,0,1] → bitsToStr = "0101"
    const seq = [1, 0, 1, 0];
    for (const bit of seq) {
      state.si = bit;
      const prev = cloneBits(state.q);
      const leaving = prev[W - 1];
      state.q = [state.si, prev[0], prev[1], prev[2]];
      state.so = leaving;
      state.cycle += 1;
      state.stepped = true;
      pushHist();
      pushTrace(
        `t${state.cycle}: demo q=${bitsToStr(prev)}→${bitsToStr(state.q)} si=${bit}`
      );
    }
    state.lastAction = "demo";
    pushLog("ok", `# demo shifted 1010 → q=${bitsToStr(state.q)}`);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "ok",
      "# SISO/SIPO share shift; PISO adds load; PIPO is parallel register"
    );
    pushTrace("explain: SI↔SO vs PI↔PO axes");
    renderAll();
  }

  function renderChain() {
    const showSi = state.mode === "siso" || state.mode === "sipo";
    const showSo = state.mode === "siso" || state.mode === "piso";
    const showPo = state.mode === "sipo" || state.mode === "pipo";

    let html = "";
    if (showSi) {
      html += `<div class="port-label">SI<span class="port-val">${state.si}</span></div><span class="chain-arrow">→</span>`;
    } else {
      html += `<div class="port-label">PI<span class="port-val">${bitsToStr(state.pi)}</span></div><span class="chain-arrow">↓</span>`;
    }

    for (let i = 0; i < W; i++) {
      if (i > 0) html += `<span class="chain-arrow">→</span>`;
      const b = state.q[i];
      html += `<div class="ff-cell ${b ? "is-hi" : "is-lo"}"><h3>q${i}</h3><p class="bit">${b}</p></div>`;
    }

    if (showSo) {
      html += `<span class="chain-arrow">→</span><div class="port-label">SO<span class="port-val">${state.so}</span></div>`;
    }
    if (showPo) {
      html += `<span class="chain-arrow">⇒</span><div class="port-label">PO<span class="port-val">${bitsToStr(state.q)}</span></div>`;
    }

    chain.innerHTML = html;
  }

  function renderPiRow() {
    const needPi = state.mode === "piso" || state.mode === "pipo";
    if (!needPi) {
      piRow.innerHTML = `<span style="color:var(--muted)">SI=${state.si} · toggle SI to feed the chain · load unused in this mode</span>`;
      return;
    }
    let html = `<span>PI bits</span>`;
    for (let i = 0; i < W; i++) {
      const hi = state.pi[i] ? "is-hi" : "";
      html += `<button type="button" class="bit-btn ${hi}" data-pi="${i}" title="Toggle pi${i}">pi${i}=${state.pi[i]}</button>`;
    }
    html += `<span style="margin-left:0.5rem">load=<strong>${state.load}</strong></span>`;
    piRow.innerHTML = html;
    piRow.querySelectorAll("[data-pi]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-pi"));
        state.pi[i] = state.pi[i] ? 0 : 1;
        state.toggledPi = true;
        state.lastAction = "toggle-pi";
        pushLog("run", `# pi${i} → ${state.pi[i]}`);
        renderAll();
      });
    });
  }

  function renderAll() {
    modeSel.value = state.mode;
    modeLegendEl.textContent = modeLegend(state.mode);
    codeBox.textContent = sourceCode(state);
    renderChain();
    renderPiRow();
    valQ.textContent = bitsToStr(state.q);
    noteQ.textContent = `SI=${state.si}  PI=${bitsToStr(state.pi)}  load=${state.load}`;
    valSo.textContent = `${state.so} / ${state.cycle}`;
    noteSo.textContent =
      state.mode === "pipo" || state.mode === "sipo"
        ? `PO=${bitsToStr(state.q)}`
        : `last leaving bit → SO`;
    traceBox.textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps yet";
    logBox.textContent = state.log.length
      ? state.log.map((e) => e.msg).join("\n")
      : "// idle";
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ mode: state.mode, q: state.q }));
    } catch {
      /* ignore */
    }
  }

  document.getElementById("sr-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    applyModeFlags();
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  document.getElementById("btn-toggle-si").addEventListener("click", () => {
    state.si = state.si ? 0 : 1;
    state.toggledSi = true;
    state.lastAction = "toggle-si";
    pushLog("run", `# si → ${state.si}`);
    renderAll();
  });

  document.getElementById("btn-toggle-load").addEventListener("click", () => {
    state.load = state.load ? 0 : 1;
    state.toggledLoad = true;
    state.lastAction = "toggle-load";
    pushLog("run", `# load → ${state.load}`);
    renderAll();
  });

  document.getElementById("btn-step").addEventListener("click", stepPosedge);

  document.getElementById("btn-clear").addEventListener("click", () => {
    state.q = [0, 0, 0, 0];
    state.so = 0;
    state.cleared = true;
    state.lastAction = "clear";
    pushLog("ok", "# q cleared");
    renderAll();
  });

  function preset(mode, flag) {
    state.mode = mode;
    state[flag] = true;
    applyModeFlags();
    state.lastAction = `preset-${mode}`;
    pushLog("ok", `# preset ${mode.toUpperCase()}`);
    renderAll();
  }

  document.getElementById("btn-siso").addEventListener("click", () => preset("siso", "setSiso"));
  document.getElementById("btn-sipo").addEventListener("click", () => preset("sipo", "setSipo"));
  document.getElementById("btn-piso").addEventListener("click", () => preset("piso", "setPiso"));
  document.getElementById("btn-pipo").addEventListener("click", () => preset("pipo", "setPipo"));
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-siso",
      title: "Quiz: SISO",
      prompt: "Serial-in serial-out acronym? Answer: <code>SISO</code>",
      hint: "one bit in, one bit out",
      type: "text",
      answer: "siso",
      alt: ["SISO", "serial in serial out"],
    },
    {
      id: "quiz-sipo",
      title: "Quiz: SIPO",
      prompt: "Serial-in parallel-out acronym? Answer: <code>SIPO</code>",
      hint: "gather then read word",
      type: "text",
      answer: "sipo",
      alt: ["SIPO", "serial in parallel out"],
    },
    {
      id: "quiz-piso",
      title: "Quiz: PISO",
      prompt: "Parallel-in serial-out acronym? Answer: <code>PISO</code>",
      hint: "load then shift out",
      type: "text",
      answer: "piso",
      alt: ["PISO", "parallel in serial out"],
    },
    {
      id: "quiz-pipo",
      title: "Quiz: PIPO",
      prompt: "Parallel-in parallel-out acronym? Answer: <code>PIPO</code>",
      hint: "ordinary register load",
      type: "text",
      answer: "pipo",
      alt: ["PIPO", "parallel in parallel out"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — SISO mode.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "siso" && state.setSiso,
    },
    {
      id: "preset-siso",
      title: "Preset SISO",
      prompt: "Preset SISO.",
      hint: "Preset SISO",
      type: "state",
      setup: () => {
        state.mode = "pipo";
        renderAll();
      },
      check: () => state.setSiso && state.mode === "siso" && state.lastAction === "preset-siso",
    },
    {
      id: "preset-sipo",
      title: "Preset SIPO",
      prompt: "Preset SIPO.",
      hint: "Preset SIPO",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setSipo && state.mode === "sipo",
    },
    {
      id: "preset-piso",
      title: "Preset PISO",
      prompt: "Preset PISO.",
      hint: "Preset PISO",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setPiso && state.mode === "piso",
    },
    {
      id: "preset-pipo",
      title: "Preset PIPO",
      prompt: "Preset PIPO.",
      hint: "Preset PIPO",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setPipo && state.mode === "pipo",
    },
    {
      id: "toggle-si",
      title: "Toggle SI",
      prompt: "Toggle SI.",
      hint: "Toggle SI",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledSi && state.lastAction === "toggle-si",
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
      id: "shift-in",
      title: "Shift in",
      prompt: "SISO: clear, si=1, step once → q starts with 1 (<code>q0=1</code>).",
      hint: "Clear → SI=1 → Step",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "siso" &&
        state.q[0] === 1 &&
        state.cycle >= 1 &&
        state.stepped,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: shift 1010 in — q becomes <code>0101</code>.",
      hint: "Demo: shift 1010 in",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" && bitsToStr(state.q) === "0101",
    },
    {
      id: "parallel-load",
      title: "Parallel load",
      prompt: "PISO: set load=1, step so q equals PI.",
      hint: "Preset PISO → Toggle load → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "piso";
        state.setPiso = true;
        state.pi = [1, 0, 1, 0];
        state.load = 0;
        state.q = [0, 0, 0, 0];
        renderAll();
      },
      check: () =>
        state.mode === "piso" &&
        bitsToStr(state.q) === bitsToStr(state.pi) &&
        state.cycle >= 1,
    },
    {
      id: "toggle-load",
      title: "Toggle load",
      prompt: "Toggle load.",
      hint: "Toggle load",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledLoad && state.lastAction === "toggle-load",
    },
    {
      id: "pipo-load",
      title: "PIPO load",
      prompt: "PIPO: load=1, step so q equals PI.",
      hint: "Preset PIPO → load=1 → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "pipo";
        state.setPipo = true;
        state.pi = [1, 1, 0, 0];
        state.load = 0;
        state.q = [0, 0, 0, 0];
        renderAll();
      },
      check: () =>
        state.mode === "pipo" &&
        bitsToStr(state.q) === bitsToStr(state.pi) &&
        state.load === 1 &&
        state.cycle >= 1,
    },
    {
      id: "clear",
      title: "Clear",
      prompt: "Clear q (all zeros) via Clear button.",
      hint: "Clear q",
      type: "state",
      setup: () => {
        loadStarter();
        state.q = [1, 1, 1, 1];
        renderAll();
      },
      check: () =>
        state.cleared &&
        bitsToStr(state.q) === "0000" &&
        state.lastAction === "clear",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain modes.",
      hint: "Explain modes",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-sipo",
      title: "Mode SIPO",
      prompt: "Switch Mode dropdown to SIPO.",
      hint: "Mode select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "sipo" && state.lastAction === "mode",
    },
    {
      id: "code-siso",
      title: "Code SISO",
      prompt: "SISO source has <code>{q[2:0], si}</code>.",
      hint: "Preset SISO",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "siso" && sourceCode(state).includes("{q[2:0], si}"),
    },
    {
      id: "code-piso",
      title: "Code PISO",
      prompt: "PISO source has <code>if (load)</code>.",
      hint: "Preset PISO",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "piso" && sourceCode(state).includes("if (load)"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        bitsToStr(state.q) === "0101" &&
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
