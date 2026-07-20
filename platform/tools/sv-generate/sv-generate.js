(() => {
  /**
   * Generate / replication explorer (structure sketch):
   *   replication: {N{expr}} → concat of N copies (elaboration / expression)
   *   generate for + genvar → instance array names
   *   generate if → exactly one branch elaborated
   */

  function replicate(expr, n) {
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(expr);
    return "{" + parts.join(", ") + "}";
  }

  function makeStarter() {
    return {
      mode: "replication", // replication | gen_for | gen_if
      n: 4,
      expr: "1'b1",
      width: 8, // for gen_if threshold
      threshold: 4,
      lastAction: "",
      expanded: false,
      explained: false,
      setFor: false,
      setIf: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-sv-generate-cleared-v1";
  const STORE_KEY = "ddv-sv-generate-session-v1";

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

  const root = document.getElementById("sg-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> replication <code>{4{1'b1}}</code> →
        <code>{1'b1, 1'b1, 1'b1, 1'b1}</code> (width 4). Then try <code>generate for</code> / <code>if</code>.</p>
      <button type="button" class="btn btn-secondary" id="sg-starter">Load starter example</button>
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
            <h3>Replication</h3>
            <p><code>{N{e}}</code> copies expression <code>e</code> N times in a concat.</p>
          </div>
          <div class="idea-card">
            <h3>generate for</h3>
            <p><code>genvar</code> loop elaborates an instance per index.</p>
          </div>
          <div class="idea-card">
            <h3>generate if</h3>
            <p>Parameter test picks one structural branch — not runtime.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Explorer</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="replication">Replication {N{e}}</option>
                <option value="gen_for">generate for</option>
                <option value="gen_if">generate if</option>
              </select>
            </label>
            <label>N / WIDTH
              <input type="number" id="n-in" min="1" max="16" value="4">
            </label>
            <label>Expr
              <select id="expr-sel">
                <option value="1'b1">1'b1</option>
                <option value="1'b0">1'b0</option>
                <option value="2'b10">2'b10</option>
                <option value="a">a</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <pre class="code-box" id="code-box"></pre>
          <div id="expand-area"></div>
          <div class="action-grid">
            <button type="button" id="btn-expand">Expand / elaborate</button>
            <button type="button" id="btn-rep">Preset {4{1'b1}}</button>
            <button type="button" id="btn-for">Preset for N=4 bit cells</button>
            <button type="button" id="btn-if-wide">Preset if WIDTH=8 (&gt;4)</button>
            <button type="button" id="btn-if-narrow">Preset if WIDTH=2 (≤4)</button>
            <button type="button" id="btn-explain">Explain elaboration</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Result</h2></div>
        <div class="panel-body">
          <p class="meta-line" id="result-meta"></p>
          <div class="expand-box" id="result-box">—</div>
          <div class="inst-grid" id="inst-grid"></div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Construct</th><th>When it runs</th></tr></thead>
          <tbody>
            <tr><td><code>{N{expr}}</code></td><td>Expression / concat width math</td></tr>
            <tr><td><code>genvar</code> + <code>generate for</code></td><td>Elaboration — builds hierarchy</td></tr>
            <tr><td><code>generate if</code></td><td>Elaboration — one branch kept</td></tr>
            <tr><td>Runtime <code>for</code> in <code>always</code></td><td>Simulation time — different tool</td></tr>
            <tr><td>Instance name</td><td>Often <code>block[i].u</code> or <code>u[i]</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: <code>{4{1'b1}}</code> has bit width 4.</li>
          <li><code>generate</code> cannot depend on a plain signal — only constants/parameters.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const nIn = document.getElementById("n-in");
  const exprSel = document.getElementById("expr-sel");
  const modeLegend = document.getElementById("mode-legend");
  const codeBox = document.getElementById("code-box");
  const expandArea = document.getElementById("expand-area");
  const resultMeta = document.getElementById("result-meta");
  const resultBox = document.getElementById("result-box");
  const instGrid = document.getElementById("inst-grid");
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
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function exprWidth(expr) {
    if (expr === "2'b10") return 2;
    if (expr === "a") return 1; // treat as 1-bit for sketch
    return 1;
  }

  function sourceCode() {
    if (state.mode === "replication") {
      return `wire [${state.n * exprWidth(state.expr) - 1}:0] bus;\nassign bus = {${state.n}{${state.expr}}};`;
    }
    if (state.mode === "gen_for") {
      return `genvar i;\ngenerate\n  for (i = 0; i < ${state.n}; i = i + 1) begin : bit_cell\n    cell u (.d(d[i]), .q(q[i]));\n  end\nendgenerate`;
    }
    return `localparam WIDTH = ${state.width};\ngenerate\n  if (WIDTH > ${state.threshold}) begin : wide\n    wide_path u (.d(d));\n  end else begin : narrow\n    narrow_path u (.d(d));\n  end\nendgenerate`;
  }

  function elaborate() {
    if (state.mode === "replication") {
      const exp = replicate(state.expr, state.n);
      const w = state.n * exprWidth(state.expr);
      return {
        meta: `replication · bit width ${w}`,
        text: exp,
        chips: Array.from({ length: state.n }, (_, i) => ({
          label: `copy[${i}] ${state.expr}`,
          on: true,
        })),
        branch: null,
      };
    }
    if (state.mode === "gen_for") {
      return {
        meta: `generate for · ${state.n} instances`,
        text: Array.from(
          { length: state.n },
          (_, i) => `bit_cell[${i}].u`
        ).join("\n"),
        chips: Array.from({ length: state.n }, (_, i) => ({
          label: `bit_cell[${i}].u`,
          on: true,
        })),
        branch: null,
      };
    }
    const takeWide = state.width > state.threshold;
    return {
      meta: `generate if (WIDTH=${state.width} > ${state.threshold}) → ${takeWide ? "wide" : "narrow"}`,
      text: takeWide
        ? "wide.u  (narrow branch discarded)"
        : "narrow.u  (wide branch discarded)",
      chips: [
        { label: "wide.u", on: takeWide },
        { label: "narrow.u", on: !takeWide },
      ],
      branch: takeWide ? "then" : "else",
    };
  }

  function renderCode() {
    codeBox.textContent = sourceCode();
    if (state.mode === "replication") {
      modeLegend.textContent =
        "Concat replication — N must be a constant expression.";
    } else if (state.mode === "gen_for") {
      modeLegend.textContent =
        "genvar loop builds hierarchy; indices are elaboration-time.";
    } else {
      modeLegend.textContent =
        "Parameter/localparam condition selects one structural branch.";
    }
  }

  function renderExpandArea() {
    if (state.mode === "gen_if") {
      expandArea.innerHTML = `<p class="legend">Threshold fixed at WIDTH &gt; ${state.threshold}. N/WIDTH field sets WIDTH.</p>`;
    } else if (state.mode === "replication") {
      expandArea.innerHTML = `<p class="legend">Syntax sugar: <code>{${state.n}{${state.expr}}}</code></p>`;
    } else {
      expandArea.innerHTML = `<p class="legend">Named block <code>bit_cell</code> scopes each iteration.</p>`;
    }
  }

  function renderResult() {
    if (!state.expanded) {
      resultMeta.textContent = "Click Expand / elaborate";
      resultBox.textContent = "—";
      instGrid.innerHTML = "";
      return;
    }
    const r = elaborate();
    resultMeta.textContent = r.meta;
    resultBox.textContent = r.text;
    if (r.branch) {
      resultBox.innerHTML =
        `<span class="branch-pill ${r.branch}">${r.branch === "then" ? "if branch" : "else branch"}</span><br>` +
        escapeHtml(r.text);
    }
    instGrid.innerHTML = "";
    r.chips.forEach((c) => {
      const d = document.createElement("div");
      d.className = "inst-chip " + (c.on ? "on" : "off");
      d.textContent = c.label;
      instGrid.appendChild(d);
    });
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(expand or explain)</span>';
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

  function renderAll() {
    modeSel.value = state.mode;
    nIn.value = String(
      state.mode === "gen_if" ? state.width : state.n
    );
    exprSel.value = state.expr;
    exprSel.disabled = state.mode !== "replication";
    renderCode();
    renderExpandArea();
    renderResult();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter {4{1'b1}}");
    state.trace = [];
    renderAll();
  }

  function doExpand() {
    state.expanded = true;
    state.lastAction = "expand";
    const r = elaborate();
    state.trace = [
      { kind: "muted", text: `elaborate ${state.mode}` },
      { kind: "hi", text: r.meta },
      { kind: "ok", text: r.text.split("\n")[0] },
    ];
    pushLog("ok", "# expanded");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.expanded = true;
    state.lastAction = "explain";
    if (state.mode === "replication") {
      state.trace = [
        { kind: "muted", text: "replication is concat sugar" },
        {
          kind: "hi",
          text: `{${state.n}{${state.expr}}} width = ${state.n}*${exprWidth(state.expr)}`,
        },
        { kind: "ok", text: replicate(state.expr, state.n) },
      ];
    } else if (state.mode === "gen_for") {
      state.trace = [
        { kind: "muted", text: "generate for is not a sim loop" },
        {
          kind: "hi",
          text: `genvar i elaborates ${state.n} copies of cell u`,
        },
        { kind: "ok", text: "hierarchical names bit_cell[i].u" },
      ];
    } else {
      const wide = state.width > state.threshold;
      state.trace = [
        { kind: "muted", text: "generate if is structural" },
        {
          kind: "hi",
          text: `WIDTH=${state.width} ${wide ? ">" : "≤"} ${state.threshold}`,
        },
        {
          kind: "ok",
          text: wide
            ? "keep wide.u — narrow never exists in netlist"
            : "keep narrow.u — wide never exists in netlist",
        },
      ];
    }
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("sg-starter").addEventListener("click", loadStarter);
  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "gen_for") state.setFor = true;
    if (state.mode === "gen_if") state.setIf = true;
    state.expanded = false;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });
  nIn.addEventListener("change", () => {
    const v = Math.max(1, Math.min(16, Number(nIn.value) || 1));
    if (state.mode === "gen_if") state.width = v;
    else state.n = v;
    state.expanded = false;
    state.lastAction = "n";
    pushLog("run", `# N/WIDTH → ${v}`);
    renderAll();
  });
  exprSel.addEventListener("change", () => {
    state.expr = exprSel.value;
    state.expanded = false;
    state.lastAction = "expr";
    pushLog("run", `# expr → ${state.expr}`);
    renderAll();
  });
  document.getElementById("btn-expand").addEventListener("click", doExpand);
  document.getElementById("btn-rep").addEventListener("click", () => {
    state.mode = "replication";
    state.n = 4;
    state.expr = "1'b1";
    state.expanded = true;
    state.lastAction = "preset-rep";
    pushLog("ok", "# preset replication");
    renderAll();
  });
  document.getElementById("btn-for").addEventListener("click", () => {
    state.mode = "gen_for";
    state.setFor = true;
    state.n = 4;
    state.expanded = true;
    state.lastAction = "preset-for";
    pushLog("ok", "# preset generate for");
    renderAll();
  });
  document.getElementById("btn-if-wide").addEventListener("click", () => {
    state.mode = "gen_if";
    state.setIf = true;
    state.width = 8;
    state.expanded = true;
    state.lastAction = "preset-if-wide";
    pushLog("ok", "# preset if wide");
    renderAll();
  });
  document.getElementById("btn-if-narrow").addEventListener("click", () => {
    state.mode = "gen_if";
    state.setIf = true;
    state.width = 2;
    state.expanded = true;
    state.lastAction = "preset-if-narrow";
    pushLog("ok", "# preset if narrow");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-rep",
      title: "Quiz: syntax",
      prompt: "Replication uses braces like? Answer: <code>{N{e}}</code>",
      hint: "double braces",
      type: "text",
      answer: "{n{e}}",
      alt: ["{N{e}}", "{n{expr}}", "N{e}", "{4{1'b1}}"],
    },
    {
      id: "quiz-genvar",
      title: "Quiz: genvar",
      prompt: "Loop index type for generate for is? Answer: <code>genvar</code>",
      hint: "not integer in classic generate",
      type: "text",
      answer: "genvar",
      alt: ["Genvar"],
    },
    {
      id: "quiz-elab",
      title: "Quiz: when",
      prompt: "generate runs at? Answer: <code>elaboration</code>",
      hint: "before simulation",
      type: "text",
      answer: "elaboration",
      alt: ["elaborate", "compile", "elaboration time"],
    },
    {
      id: "quiz-runtime",
      title: "Quiz: not runtime",
      prompt: "Can generate if depend on a plain signal? Answer: <code>no</code>",
      hint: "constants/parameters only",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — mode replication, N=4, 1'b1.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "replication" &&
        state.n === 4 &&
        state.expr === "1'b1",
    },
    {
      id: "expand-rep",
      title: "Expand rep",
      prompt: "Expand starter — result starts with {1'b1, 1'b1",
      hint: "Expand / elaborate",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = elaborate();
        return (
          state.expanded &&
          state.mode === "replication" &&
          r.text === "{1'b1, 1'b1, 1'b1, 1'b1}"
        );
      },
    },
    {
      id: "width-4",
      title: "Width 4",
      prompt: "Starter replication bit width is 4.",
      hint: "1 bit × 4",
      type: "state",
      setup: () => {
        loadStarter();
        state.expanded = true;
        renderAll();
      },
      check: () =>
        state.mode === "replication" &&
        state.n * exprWidth(state.expr) === 4,
    },
    {
      id: "rep-2b",
      title: "2-bit expr",
      prompt: "Replication N=3 of 2'b10 → width 6.",
      hint: "Expr 2'b10, N=3, expand",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "replication" &&
        state.expr === "2'b10" &&
        state.n === 3 &&
        state.n * exprWidth(state.expr) === 6,
    },
    {
      id: "preset-for",
      title: "generate for",
      prompt: "Preset for N=4 bit cells — 4 instance chips.",
      hint: "Preset for N=4",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setFor &&
        state.mode === "gen_for" &&
        state.n === 4 &&
        state.expanded &&
        elaborate().chips.length === 4,
    },
    {
      id: "for-name",
      title: "Instance name",
      prompt: "After for preset, names include bit_cell[0].u",
      hint: "Preset for",
      type: "state",
      setup: () => {
        document.getElementById("btn-for").click();
      },
      check: () => elaborate().text.includes("bit_cell[0].u"),
    },
    {
      id: "if-wide",
      title: "if wide",
      prompt: "Preset if WIDTH=8 — wide branch kept.",
      hint: "Preset if WIDTH=8",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = elaborate();
        return (
          state.mode === "gen_if" &&
          state.width === 8 &&
          r.branch === "then" &&
          state.expanded
        );
      },
    },
    {
      id: "if-narrow",
      title: "if narrow",
      prompt: "Preset if WIDTH=2 — else/narrow branch.",
      hint: "Preset if WIDTH=2",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = elaborate();
        return (
          state.mode === "gen_if" &&
          state.width === 2 &&
          r.branch === "else"
        );
      },
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain elaboration.",
      hint: "Explain elaboration",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-for",
      title: "Mode for",
      prompt: "Switch mode dropdown to generate for.",
      hint: "Mode select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "gen_for" && state.lastAction === "mode",
    },
    {
      id: "quiz-block",
      title: "Quiz: block",
      prompt: "Named generate block in the for sketch is? Answer: <code>bit_cell</code>",
      hint: "begin : bit_cell",
      type: "text",
      answer: "bit_cell",
      alt: ["bit-cell", "bitcell"],
    },
    {
      id: "n-change",
      title: "Change N",
      prompt: "In replication, set N to 8.",
      hint: "N / WIDTH field",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "replication" &&
        state.n === 8 &&
        state.lastAction === "n",
    },
    {
      id: "quiz-concat",
      title: "Quiz: meaning",
      prompt: "{N{e}} is sugar for a? Answer: <code>concatenation</code>",
      hint: "copies in {}",
      type: "text",
      answer: "concatenation",
      alt: ["concat", "concatenate"],
    },
    {
      id: "for-n2",
      title: "for N=2",
      prompt: "generate for with N=2 elaborates 2 instances.",
      hint: "Mode for, N=2, expand",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "gen_for" &&
        state.n === 2 &&
        state.expanded &&
        elaborate().chips.length === 2,
    },
    {
      id: "quiz-param",
      title: "Quiz: if cond",
      prompt: "generate if condition uses? Answer: <code>parameter</code>",
      hint: "or localparam / constant",
      type: "text",
      answer: "parameter",
      alt: ["localparam", "constant", "param"],
    },
    {
      id: "discard",
      title: "Discarded branch",
      prompt: "On wide preset, narrow.u chip is off (discarded).",
      hint: "Preset if WIDTH=8",
      type: "state",
      setup: () => {
        document.getElementById("btn-if-wide").click();
      },
      check: () => {
        const r = elaborate();
        const narrow = r.chips.find((c) => c.label === "narrow.u");
        return narrow && narrow.on === false;
      },
    },
    {
      id: "preset-rep-btn",
      title: "Preset rep",
      prompt: "Use Preset {4{1'b1}} button.",
      hint: "Preset replication",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "preset-rep" &&
        state.expanded &&
        elaborate().text.includes("1'b1, 1'b1, 1'b1, 1'b1"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → expand replication → explain.",
      hint: "Load → Expand → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "replication" &&
        state.n === 4 &&
        state.expanded &&
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
