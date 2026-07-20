(() => {
  /**
   * Multi-dimensional arrays — packed vs unpacked layout literacy.
   *
   * Packed dims before the identifier:  logic [A-1:0][B-1:0] p;
   *   → one contiguous vector of A*B bits; [i][j] selects bits.
   * Unpacked dims after:                logic [B-1:0] u [A-1:0];
   *   → A separate B-bit elements; not one assignable vector.
   * Mixed (common mem):                 logic [B-1:0] m [A-1:0];
   *   → same as unpacked form with packed width B.
   */

  function clampDim(n) {
    return Math.max(2, Math.min(4, Number(n) || 2));
  }

  function makeStarter() {
    return {
      mode: "mixed", // packed | unpacked | mixed
      outer: 2, // first index size (rows / word count)
      inner: 4, // second index size (bits per word / packed width)
      selOuter: 0,
      selInner: 0,
      lastAction: "",
      explained: false,
      clickedCell: false,
      setPacked: false,
      setUnpacked: false,
      setMixed: false,
      log: [],
      trace: [],
    };
  }

  /** Bit cells for packed 2D: [o][i] with o = outer-1 .. 0 as MSB groups */
  function packedCells(outer, inner) {
    const cells = [];
    const total = outer * inner;
    let bit = total - 1;
    for (let o = outer - 1; o >= 0; o--) {
      for (let i = inner - 1; i >= 0; i--) {
        cells.push({
          outer: o,
          inner: i,
          bit,
          label: `[${o}][${i}]`,
        });
        bit--;
      }
    }
    return cells;
  }

  function totalBits(state) {
    return state.outer * state.inner;
  }

  function declCode(state) {
    const oHi = state.outer - 1;
    const iHi = state.inner - 1;
    if (state.mode === "packed") {
      return `logic [${oHi}:0][${iHi}:0] p;  // packed 2D — ${totalBits(state)} contiguous bits
// p[${state.selOuter}][${state.selInner}]  → one bit
// int x = p;  // OK — whole vector assignable`;
    }
    if (state.mode === "unpacked") {
      return `logic u [${oHi}:0][${iHi}:0];  // unpacked 2D — ${state.outer}×${state.inner} separate bits
// u[${state.selOuter}][${state.selInner}]  → one element (1 bit here)
// int x = u;  // ILLEGAL — not one vector`;
    }
    // mixed: packed width, unpacked depth (classic memory)
    return `logic [${iHi}:0] m [${oHi}:0];  // mixed — ${state.outer} words × ${state.inner} bits
// m[${state.selOuter}]     → logic [${iHi}:0]
// m[${state.selOuter}][${state.selInner}] → one bit
// int x = m;  // ILLEGAL — unpacked array`;
  }

  const CLEARED_KEY = "ddv-multi-dim-arrays-cleared-v1";
  const STORE_KEY = "ddv-multi-dim-arrays-session-v1";

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

  const root = document.getElementById("md-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> mixed memory
        <code>logic [3:0] m [1:0]</code> — 2 words × 4 bits. Compare packed
        <code>[1:0][3:0]</code> (one vector) vs unpacked dims after the name.</p>
      <button type="button" class="btn btn-secondary" id="md-starter">Load starter example</button>
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
            <h3>Packed</h3>
            <p>Dims <em>before</em> the name — one contiguous bit vector.</p>
          </div>
          <div class="idea-card">
            <h3>Unpacked</h3>
            <p>Dims <em>after</em> the name — separate elements / memories.</p>
          </div>
          <div class="idea-card">
            <h3>Mixed</h3>
            <p>Packed width + unpacked depth — classic <code>mem[addr]</code>.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Declaration &amp; layout</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Layout
              <select id="mode-sel">
                <option value="packed">packed 2D</option>
                <option value="unpacked">unpacked 2D</option>
                <option value="mixed" selected>mixed (mem)</option>
              </select>
            </label>
            <label>Outer size
              <input type="number" id="dim-outer" min="2" max="4" value="2">
            </label>
            <label>Inner size
              <input type="number" id="dim-inner" min="2" max="4" value="4">
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="layout-wrap">
            <p class="layout-label" id="layout-label"></p>
            <div id="layout-body"></div>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-packed">Preset packed [1:0][3:0]</button>
            <button type="button" id="btn-unpacked">Preset unpacked [1:0][3:0]</button>
            <button type="button" id="btn-mixed">Preset mixed mem</button>
            <button type="button" id="btn-sel-msb">Select MSB cell</button>
            <button type="button" id="btn-sel-lsb">Select LSB cell</button>
            <button type="button" id="btn-explain">Explain layout</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Counts &amp; selection</h2></div>
        <div class="panel-body">
          <div class="stats">
            <div class="stat-card">
              <h3>Total bits</h3>
              <p class="val" id="stat-bits">—</p>
            </div>
            <div class="stat-card">
              <h3>Elements</h3>
              <p class="val" id="stat-elems">—</p>
            </div>
            <div class="stat-card">
              <h3>Selected</h3>
              <p class="val" id="stat-sel">—</p>
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
          <thead><tr><th>Form</th><th>Syntax sketch</th><th>One vector?</th></tr></thead>
          <tbody>
            <tr><td>Packed 2D</td><td><code>logic [1:0][3:0] p;</code></td><td>Yes — 8 bits</td></tr>
            <tr><td>Unpacked 2D</td><td><code>logic u [1:0][3:0];</code></td><td>No</td></tr>
            <tr><td>Mixed mem</td><td><code>logic [3:0] m [1:0];</code></td><td>No (words are packed)</td></tr>
            <tr><td>Index order</td><td>Left packed index = MSB group</td><td></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter mixed: <code>m[1:0]</code> of <code>[3:0]</code> → 8 storage bits, 2 elements.</li>
          <li>Packed can assign to a wide vector; unpacked arrays cannot.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const dimOuter = document.getElementById("dim-outer");
  const dimInner = document.getElementById("dim-inner");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const layoutLabel = document.getElementById("layout-label");
  const layoutBody = document.getElementById("layout-body");
  const modeLegend = document.getElementById("mode-legend");
  const statBits = document.getElementById("stat-bits");
  const statElems = document.getElementById("stat-elems");
  const statSel = document.getElementById("stat-sel");
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
      state.outer = clampDim(state.outer);
      state.inner = clampDim(state.inner);
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function selectCell(o, i) {
    state.selOuter = o;
    state.selInner = i;
    state.clickedCell = true;
    state.lastAction = "select";
    pushLog("run", `# select [${o}][${i}]`);
    renderAll();
  }

  function renderLayout() {
    layoutBody.innerHTML = "";
    const o = state.outer;
    const inn = state.inner;

    if (state.mode === "packed") {
      layoutLabel.textContent =
        "Packed bit strip (MSB left). Click a cell → index [outer][inner].";
      const strip = document.createElement("div");
      strip.className = "bit-strip";
      const cells = packedCells(o, inn);
      cells.forEach((c, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bit-cell";
        if (c.outer === state.selOuter && c.inner === state.selInner)
          btn.classList.add("is-sel");
        if (idx === 0) btn.classList.add("is-msb");
        if (idx === cells.length - 1) btn.classList.add("is-lsb");
        btn.textContent = String(c.bit);
        btn.title = `${c.label} → bit ${c.bit}`;
        btn.addEventListener("click", () => selectCell(c.outer, c.inner));
        strip.appendChild(btn);
      });
      layoutBody.appendChild(strip);
      return;
    }

    if (state.mode === "unpacked") {
      layoutLabel.textContent =
        "Unpacked grid — each cell is a separate element (1-bit here).";
      const grid = document.createElement("div");
      grid.className = "elem-grid";
      for (let ou = 0; ou < o; ou++) {
        const row = document.createElement("div");
        row.className =
          "elem-row" + (ou === state.selOuter ? " is-sel" : "");
        const title = document.createElement("p");
        title.className = "elem-title";
        title.textContent = `u[${ou}][*]`;
        row.appendChild(title);
        const strip = document.createElement("div");
        strip.className = "bit-strip";
        for (let i = 0; i < inn; i++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "bit-cell";
          if (ou === state.selOuter && i === state.selInner)
            btn.classList.add("is-sel");
          btn.textContent = `[${i}]`;
          btn.title = `u[${ou}][${i}]`;
          btn.addEventListener("click", () => selectCell(ou, i));
          strip.appendChild(btn);
        }
        row.appendChild(strip);
        grid.appendChild(row);
      }
      layoutBody.appendChild(grid);
      return;
    }

    // mixed
    layoutLabel.textContent =
      "Mixed memory — each row is one packed word; index after name is address.";
    const grid = document.createElement("div");
    grid.className = "elem-grid";
    for (let ou = 0; ou < o; ou++) {
      const row = document.createElement("div");
      row.className =
        "elem-row" + (ou === state.selOuter ? " is-sel" : "");
      const title = document.createElement("p");
      title.className = "elem-title";
      title.textContent = `m[${ou}]  // logic [${inn - 1}:0]`;
      row.appendChild(title);
      const strip = document.createElement("div");
      strip.className = "bit-strip";
      for (let i = inn - 1; i >= 0; i--) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bit-cell";
        if (ou === state.selOuter && i === state.selInner)
          btn.classList.add("is-sel");
        if (i === inn - 1) btn.classList.add("is-msb");
        if (i === 0) btn.classList.add("is-lsb");
        btn.textContent = String(i);
        btn.title = `m[${ou}][${i}]`;
        btn.addEventListener("click", () => selectCell(ou, i));
        strip.appendChild(btn);
      }
      row.appendChild(strip);
      grid.appendChild(row);
    }
    layoutBody.appendChild(grid);
  }

  function renderWarn() {
    if (state.mode === "packed") {
      warnBox.classList.add("hidden");
      return;
    }
    warnBox.classList.remove("hidden");
    warnBox.textContent =
      state.mode === "unpacked"
        ? "Unpacked array is not one vector — whole-array assign to int/logic vector is illegal."
        : "Mixed: each word is packed, but the array of words is unpacked — no whole-mem vector assign.";
  }

  function renderStats() {
    const bits = totalBits(state);
    statBits.textContent = String(bits);
    if (state.mode === "packed") {
      statElems.textContent = "1 vector";
    } else if (state.mode === "unpacked") {
      statElems.textContent = `${state.outer}×${state.inner} elems`;
    } else {
      statElems.textContent = `${state.outer} words`;
    }
    if (state.mode === "mixed") {
      statSel.textContent = `m[${state.selOuter}][${state.selInner}]`;
    } else if (state.mode === "packed") {
      const cells = packedCells(state.outer, state.inner);
      const hit = cells.find(
        (c) => c.outer === state.selOuter && c.inner === state.selInner
      );
      statSel.textContent = hit
        ? `p${hit.label} bit ${hit.bit}`
        : `p[${state.selOuter}][${state.selInner}]`;
    } else {
      statSel.textContent = `u[${state.selOuter}][${state.selInner}]`;
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(select a cell or explain)</span>';
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

  function syncInputs() {
    modeSel.value = state.mode;
    dimOuter.value = String(state.outer);
    dimInner.value = String(state.inner);
  }

  function legendText() {
    if (state.mode === "packed")
      return "Packed dims before the identifier — contiguous bits, MSB group = highest outer index.";
    if (state.mode === "unpacked")
      return "Both dims after the name — array of arrays; not synthesizable as one bus.";
    return "Packed width before name, unpacked depth after — typical RAM / register file.";
  }

  function renderAll() {
    // clamp selection
    state.selOuter = Math.min(state.selOuter, state.outer - 1);
    state.selInner = Math.min(state.selInner, state.inner - 1);
    syncInputs();
    modeLegend.textContent = legendText();
    codeBox.textContent = declCode(state);
    renderWarn();
    renderLayout();
    renderStats();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setMixed = true;
    pushLog("muted", "# starter mixed logic [3:0] m [1:0]");
    state.trace = [];
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    const bits = totalBits(state);
    if (state.mode === "packed") {
      const cells = packedCells(state.outer, state.inner);
      const hit = cells.find(
        (c) => c.outer === state.selOuter && c.inner === state.selInner
      );
      state.trace = [
        { kind: "muted", text: "packed layout" },
        { kind: "hi", text: `logic [${state.outer - 1}:0][${state.inner - 1}:0] → ${bits} bits` },
        {
          kind: "ok",
          text: `MSB group = [${state.outer - 1}][*]; LSB group = [0][*]`,
        },
        {
          kind: "run",
          text: hit
            ? `selected ${hit.label} maps to bit ${hit.bit}`
            : "select a cell",
        },
        { kind: "ok", text: "whole object assignable as one vector" },
      ];
    } else if (state.mode === "unpacked") {
      state.trace = [
        { kind: "muted", text: "unpacked layout" },
        {
          kind: "hi",
          text: `logic u [${state.outer - 1}:0][${state.inner - 1}:0]`,
        },
        { kind: "warn", text: "not one vector — no int x = u" },
        {
          kind: "run",
          text: `selected u[${state.selOuter}][${state.selInner}]`,
        },
      ];
    } else {
      state.trace = [
        { kind: "muted", text: "mixed memory" },
        {
          kind: "hi",
          text: `logic [${state.inner - 1}:0] m [${state.outer - 1}:0]`,
        },
        {
          kind: "ok",
          text: `${state.outer} packed words × ${state.inner} bits = ${bits} storage bits`,
        },
        {
          kind: "run",
          text: `m[${state.selOuter}] is a ${state.inner}-bit vector; bit [${state.selInner}] selected`,
        },
        { kind: "warn", text: "array of words is unpacked — no int x = m" },
      ];
    }
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("md-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "packed") state.setPacked = true;
    if (state.mode === "unpacked") state.setUnpacked = true;
    if (state.mode === "mixed") state.setMixed = true;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  dimOuter.addEventListener("change", () => {
    state.outer = clampDim(dimOuter.value);
    state.lastAction = "dim-outer";
    pushLog("run", `# outer → ${state.outer}`);
    renderAll();
  });

  dimInner.addEventListener("change", () => {
    state.inner = clampDim(dimInner.value);
    state.lastAction = "dim-inner";
    pushLog("run", `# inner → ${state.inner}`);
    renderAll();
  });

  document.getElementById("btn-packed").addEventListener("click", () => {
    state.mode = "packed";
    state.outer = 2;
    state.inner = 4;
    state.selOuter = 1;
    state.selInner = 3;
    state.setPacked = true;
    state.lastAction = "preset-packed";
    pushLog("ok", "# preset packed [1:0][3:0]");
    renderAll();
  });

  document.getElementById("btn-unpacked").addEventListener("click", () => {
    state.mode = "unpacked";
    state.outer = 2;
    state.inner = 4;
    state.selOuter = 0;
    state.selInner = 0;
    state.setUnpacked = true;
    state.lastAction = "preset-unpacked";
    pushLog("ok", "# preset unpacked");
    renderAll();
  });

  document.getElementById("btn-mixed").addEventListener("click", () => {
    state.mode = "mixed";
    state.outer = 2;
    state.inner = 4;
    state.selOuter = 0;
    state.selInner = 0;
    state.setMixed = true;
    state.lastAction = "preset-mixed";
    pushLog("ok", "# preset mixed mem");
    renderAll();
  });

  document.getElementById("btn-sel-msb").addEventListener("click", () => {
    if (state.mode === "packed") {
      state.selOuter = state.outer - 1;
      state.selInner = state.inner - 1;
    } else if (state.mode === "mixed") {
      state.selOuter = 0;
      state.selInner = state.inner - 1;
    } else {
      state.selOuter = 0;
      state.selInner = 0;
    }
    state.clickedCell = true;
    state.lastAction = "sel-msb";
    pushLog("ok", "# select MSB cell");
    explain();
  });

  document.getElementById("btn-sel-lsb").addEventListener("click", () => {
    if (state.mode === "packed") {
      state.selOuter = 0;
      state.selInner = 0;
    } else if (state.mode === "mixed") {
      state.selOuter = state.outer - 1;
      state.selInner = 0;
    } else {
      state.selOuter = state.outer - 1;
      state.selInner = state.inner - 1;
    }
    state.clickedCell = true;
    state.lastAction = "sel-lsb";
    pushLog("ok", "# select LSB cell");
    explain();
  });

  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-packed",
      title: "Quiz: packed",
      prompt: "Dims before the identifier are? Answer: <code>packed</code>",
      hint: "contiguous vector",
      type: "text",
      answer: "packed",
      alt: ["packed dims", "packed dimensions"],
    },
    {
      id: "quiz-unpacked",
      title: "Quiz: unpacked",
      prompt: "Dims after the identifier are? Answer: <code>unpacked</code>",
      hint: "memories / arrays of objects",
      type: "text",
      answer: "unpacked",
      alt: ["unpacked dims", "unpacked dimensions"],
    },
    {
      id: "quiz-mixed",
      title: "Quiz: mixed",
      prompt: "Classic RAM style is packed width + unpacked depth. Name? Answer: <code>mixed</code>",
      hint: "logic [W-1:0] mem [D-1:0]",
      type: "text",
      answer: "mixed",
      alt: ["mixed mem", "memory", "mem"],
    },
    {
      id: "quiz-vector",
      title: "Quiz: vector",
      prompt: "Which layout is one contiguous vector? Answer: <code>packed</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "packed",
      alt: ["packed 2d", "packed 2D"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — mixed, outer=2, inner=4.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "mixed" &&
        state.outer === 2 &&
        state.inner === 4 &&
        totalBits(state) === 8,
    },
    {
      id: "preset-packed",
      title: "Preset packed",
      prompt: "Preset packed [1:0][3:0] — 8 contiguous bits.",
      hint: "Preset packed button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setPacked &&
        state.mode === "packed" &&
        state.outer === 2 &&
        state.inner === 4 &&
        totalBits(state) === 8,
    },
    {
      id: "preset-unpacked",
      title: "Preset unpacked",
      prompt: "Preset unpacked 2D view.",
      hint: "Preset unpacked button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setUnpacked && state.mode === "unpacked",
    },
    {
      id: "preset-mixed",
      title: "Preset mixed",
      prompt: "Preset mixed mem (after visiting another mode).",
      hint: "Packed preset then Mixed",
      type: "state",
      setup: () => {
        state.mode = "packed";
        state.setPacked = true;
        renderAll();
      },
      check: () =>
        state.setMixed &&
        state.mode === "mixed" &&
        state.lastAction === "preset-mixed",
    },
    {
      id: "msb-packed",
      title: "MSB packed",
      prompt: "On packed preset, Select MSB cell — outer=1, inner=3, bit 7.",
      hint: "Preset packed → Select MSB cell",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (state.mode !== "packed") return false;
        const cells = packedCells(state.outer, state.inner);
        const hit = cells.find(
          (c) => c.outer === state.selOuter && c.inner === state.selInner
        );
        return (
          state.lastAction === "explain" &&
          state.selOuter === state.outer - 1 &&
          state.selInner === state.inner - 1 &&
          hit &&
          hit.bit === totalBits(state) - 1
        );
      },
    },
    {
      id: "lsb-packed",
      title: "LSB packed",
      prompt: "On packed, Select LSB cell — maps to bit 0.",
      hint: "Preset packed → Select LSB cell",
      type: "state",
      setup: () => {
        state.mode = "packed";
        state.outer = 2;
        state.inner = 4;
        state.setPacked = true;
        renderAll();
      },
      check: () => {
        const cells = packedCells(state.outer, state.inner);
        const hit = cells.find(
          (c) => c.outer === state.selOuter && c.inner === state.selInner
        );
        return (
          state.mode === "packed" &&
          state.selOuter === 0 &&
          state.selInner === 0 &&
          hit &&
          hit.bit === 0
        );
      },
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain layout on any mode.",
      hint: "Explain layout",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-packed",
      title: "Mode packed",
      prompt: "Switch Layout dropdown to packed 2D.",
      hint: "Layout select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "packed" && state.lastAction === "mode",
    },
    {
      id: "bits-12",
      title: "Bits 12",
      prompt: "Set outer=3, inner=4 — total bits 12 (any mode).",
      hint: "Outer size 3, Inner size 4",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.outer === 3 && state.inner === 4 && totalBits(state) === 12,
    },
    {
      id: "quiz-before",
      title: "Quiz: before",
      prompt: "Packed dimensions appear? Answer: <code>before</code>",
      hint: "before the name",
      type: "text",
      answer: "before",
      alt: ["before name", "before identifier", "left"],
    },
    {
      id: "quiz-after",
      title: "Quiz: after",
      prompt: "Unpacked dimensions appear? Answer: <code>after</code>",
      hint: "after the name",
      type: "text",
      answer: "after",
      alt: ["after name", "after identifier", "right"],
    },
    {
      id: "quiz-assign",
      title: "Quiz: assign",
      prompt: "Whole-object assign to int — legal for? Answer: <code>packed</code>",
      hint: "warn box on other modes",
      type: "text",
      answer: "packed",
      alt: ["packed only", "packed 2d"],
    },
    {
      id: "click-cell",
      title: "Click cell",
      prompt: "Click any layout cell (or use Select MSB/LSB).",
      hint: "Click a bit cell",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.clickedCell === true,
    },
    {
      id: "warn-visible",
      title: "Warn unpacked",
      prompt: "On unpacked or mixed, warning box is visible.",
      hint: "Preset unpacked or stay on mixed",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        (state.mode === "unpacked" || state.mode === "mixed") &&
        !warnBox.classList.contains("hidden"),
    },
    {
      id: "code-mixed",
      title: "Code mixed",
      prompt: "On mixed starter, code shows <code>logic [3:0] m [1:0]</code>.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "mixed" &&
        declCode(state).includes("logic [3:0] m [1:0]"),
    },
    {
      id: "code-packed",
      title: "Code packed",
      prompt: "Packed preset source has <code>[1:0][3:0]</code>.",
      hint: "Preset packed",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "packed" &&
        declCode(state).includes("[1:0][3:0]"),
    },
    {
      id: "words-2",
      title: "Two words",
      prompt: "Mixed mode with outer=2 — Elements reads “2 words”.",
      hint: "Preset mixed",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "mixed" &&
        state.outer === 2 &&
        statElems.textContent.includes("2 words"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → packed preset → Select MSB → explain done.",
      hint: "Load → Preset packed → Select MSB cell",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "packed" &&
        state.setPacked &&
        state.explained &&
        state.selOuter === state.outer - 1 &&
        state.selInner === state.inner - 1 &&
        totalBits(state) === 8,
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
