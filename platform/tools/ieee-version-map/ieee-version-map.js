(() => {
  /**
   * IEEE construct → version map (literacy, not LRM legalese).
   * Eras:
   *   v95  — IEEE 1364-1995 (classic Verilog)
   *   v01  — IEEE 1364-2001 (+ 2005 refinements lumped here)
   *   sv   — IEEE 1800 (SystemVerilog; 2005+)
   */

  /** @type {{id:string,name:string,era:'v95'|'v01'|'sv',std:string,blurb:string,sample:string}[]} */
  const CONSTRUCTS = [
    {
      id: "wire-reg",
      name: "wire / reg",
      era: "v95",
      std: "IEEE 1364-1995",
      blurb: "Classic net vs variable split.",
      sample: "wire a; reg b;",
    },
    {
      id: "always-at",
      name: "always @(...)",
      era: "v95",
      std: "IEEE 1364-1995",
      blurb: "Procedural block with explicit sensitivity.",
      sample: "always @(posedge clk) q <= d;",
    },
    {
      id: "module-ports-95",
      name: "non-ANSI ports",
      era: "v95",
      std: "IEEE 1364-1995",
      blurb: "Port list separate from direction decls.",
      sample: "module m(a,b); input a; output b;",
    },
    {
      id: "ansi-ports",
      name: "ANSI ports",
      era: "v01",
      std: "IEEE 1364-2001",
      blurb: "Directions in the port list.",
      sample: "module m(input a, output b);",
    },
    {
      id: "generate",
      name: "generate / genvar",
      era: "v01",
      std: "IEEE 1364-2001",
      blurb: "Elaborate instance arrays and conditionals.",
      sample: "generate for (genvar i=0;i<N;i++) ...",
    },
    {
      id: "signed",
      name: "signed types / ops",
      era: "v01",
      std: "IEEE 1364-2001",
      blurb: "Signed arithmetic and declarations.",
      sample: "wire signed [7:0] s;",
    },
    {
      id: "star-sens",
      name: "always @(*)",
      era: "v01",
      std: "IEEE 1364-2001",
      blurb: "Implicit combo sensitivity.",
      sample: "always @(*) y = a & b;",
    },
    {
      id: "logic",
      name: "logic",
      era: "sv",
      std: "IEEE 1800",
      blurb: "4-state variable; preferred over wire/reg for RTL.",
      sample: "logic [7:0] d;",
    },
    {
      id: "bit",
      name: "bit (2-state)",
      era: "sv",
      std: "IEEE 1800",
      blurb: "2-state type — common in testbenches.",
      sample: "bit [31:0] addr;",
    },
    {
      id: "always-ff",
      name: "always_ff",
      era: "sv",
      std: "IEEE 1800",
      blurb: "Sequential intent process.",
      sample: "always_ff @(posedge clk) q <= d;",
    },
    {
      id: "always-comb",
      name: "always_comb",
      era: "sv",
      std: "IEEE 1800",
      blurb: "Combinational intent; auto sensitivity.",
      sample: "always_comb y = a ^ b;",
    },
    {
      id: "always-latch",
      name: "always_latch",
      era: "sv",
      std: "IEEE 1800",
      blurb: "Intentional latch process.",
      sample: "always_latch if (en) q <= d;",
    },
    {
      id: "interface",
      name: "interface / modport",
      era: "sv",
      std: "IEEE 1800",
      blurb: "Bundled ports with role directions.",
      sample: "interface bus_if; modport m(...);",
    },
    {
      id: "package",
      name: "package / import",
      era: "sv",
      std: "IEEE 1800",
      blurb: "Shared types and constants across units.",
      sample: "package p; endpackage\nimport p::*;",
    },
    {
      id: "typedef",
      name: "typedef / enum / struct",
      era: "sv",
      std: "IEEE 1800",
      blurb: "User types, enums, packed structs.",
      sample: "typedef struct packed {...} pkt_t;",
    },
    {
      id: "unique-case",
      name: "unique / priority case",
      era: "sv",
      std: "IEEE 1800",
      blurb: "Case qualifiers for overlap / completeness checks.",
      sample: "unique case (s) ... endcase",
    },
    {
      id: "assert",
      name: "assert property (SVA)",
      era: "sv",
      std: "IEEE 1800",
      blurb: "Concurrent assertions / properties.",
      sample: "assert property (@(posedge clk) req |-> ack);",
    },
    {
      id: "class",
      name: "class (OOP)",
      era: "sv",
      std: "IEEE 1800",
      blurb: "TB OOP; not synthesizable RTL structure.",
      sample: "class txn; endclass",
    },
  ];

  const ERA_META = {
    v95: {
      title: "1364-1995",
      label: "Verilog-95",
      note: "Classic Verilog baseline",
    },
    v01: {
      title: "1364-2001",
      label: "Verilog-2001",
      note: "ANSI ports, generate, @(*)",
    },
    sv: {
      title: "1800",
      label: "SystemVerilog",
      note: "logic, always_*, interface, …",
    },
  };

  function makeStarter() {
    return {
      filterEra: "all", // all | v95 | v01 | sv
      selectedId: "logic",
      query: "",
      lastAction: "",
      explained: false,
      filtered: false,
      setLogic: false,
      setFf: false,
      setGenerate: false,
      setV95: false,
      setSv: false,
      log: [],
      trace: [],
    };
  }

  function getConstruct(id) {
    return CONSTRUCTS.find((c) => c.id === id) || CONSTRUCTS[0];
  }

  function filteredList(state) {
    const q = state.query.trim().toLowerCase();
    return CONSTRUCTS.filter((c) => {
      if (state.filterEra !== "all" && c.era !== state.filterEra) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.id.includes(q) ||
        c.std.toLowerCase().includes(q) ||
        c.blurb.toLowerCase().includes(q)
      );
    });
  }

  const CLEARED_KEY = "ddv-ieee-version-map-cleared-v1";
  const STORE_KEY = "ddv-ieee-version-map-session-v1";

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

  const root = document.getElementById("iv-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> select <code>logic</code> —
        introduced with <strong>IEEE 1800</strong> (SystemVerilog).
        Filter the timeline to see what each era unlocked.</p>
      <button type="button" class="btn btn-secondary" id="iv-starter">Load starter example</button>
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
            <h3>1364</h3>
            <p>Verilog language family (1995 → 2001/2005).</p>
          </div>
          <div class="idea-card">
            <h3>1800</h3>
            <p>SystemVerilog — RTL + TB extensions.</p>
          </div>
          <div class="idea-card">
            <h3>Map</h3>
            <p>Know which features need an SV-capable tool.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Timeline &amp; constructs</h2></div>
        <div class="panel-body">
          <div class="timeline" id="timeline"></div>
          <div class="ctrl-row">
            <label>Filter era
              <select id="era-sel">
                <option value="all" selected>all</option>
                <option value="v95">1364-1995 only</option>
                <option value="v01">1364-2001 only</option>
                <option value="sv">1800 only</option>
              </select>
            </label>
            <label>Search
              <input type="search" id="search-in" placeholder="logic, generate…">
            </label>
          </div>
          <p class="legend">Click a construct. Tags: V95 · V01 · SV.</p>
          <div class="construct-list" id="construct-list"></div>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-logic">Select logic (1800)</button>
            <button type="button" id="btn-ff">Select always_ff (1800)</button>
            <button type="button" id="btn-gen">Select generate (2001)</button>
            <button type="button" id="btn-wire">Select wire/reg (1995)</button>
            <button type="button" id="btn-sv-filter">Filter 1800 only</button>
            <button type="button" id="btn-explain">Explain eras</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Construct detail</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card is-ok" id="card-std">
              <h3>Introduced in</h3>
              <p class="val" id="val-std">—</p>
              <p class="note" id="note-std"></p>
            </div>
            <div class="status-card" id="card-count">
              <h3>Visible rows</h3>
              <p class="val" id="val-count">—</p>
              <p class="note" id="note-count"></p>
            </div>
          </div>
          <div class="detail-box" id="detail-box">
            <h3 id="detail-name">—</h3>
            <p class="std" id="detail-std"></p>
            <p id="detail-blurb"></p>
          </div>
          <pre class="code-box" id="code-box"></pre>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Era</th><th>Standard</th><th>Headline adds</th></tr></thead>
          <tbody>
            <tr><td>V95</td><td>1364-1995</td><td>wire/reg, always @, classic modules</td></tr>
            <tr><td>V01</td><td>1364-2001</td><td>ANSI ports, generate, signed, @(*)</td></tr>
            <tr><td>SV</td><td>1800</td><td>logic, always_*, interface, package, SVA…</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: <code>logic</code> → IEEE 1800.</li>
          <li>Later 1800 revisions refine; this map uses “1800” as the SV bucket.</li>
        </ul>
      </div>
    </div>
  `;

  const timeline = document.getElementById("timeline");
  const eraSel = document.getElementById("era-sel");
  const searchIn = document.getElementById("search-in");
  const constructList = document.getElementById("construct-list");
  const warnBox = document.getElementById("warn-box");
  const valStd = document.getElementById("val-std");
  const noteStd = document.getElementById("note-std");
  const valCount = document.getElementById("val-count");
  const noteCount = document.getElementById("note-count");
  const detailName = document.getElementById("detail-name");
  const detailStd = document.getElementById("detail-std");
  const detailBlurb = document.getElementById("detail-blurb");
  const codeBox = document.getElementById("code-box");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  Object.keys(ERA_META).forEach((era) => {
    const m = ERA_META[era];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "tl-card";
    card.dataset.era = era;
    card.innerHTML = `<h3>${m.title}</h3><div class="meta">${m.label} — ${m.note}</div>`;
    card.addEventListener("click", () => {
      state.filterEra = era;
      state.filtered = true;
      if (era === "sv") state.setSv = true;
      if (era === "v95") state.setV95 = true;
      state.lastAction = "timeline";
      pushLog("run", `# filter → ${era}`);
      renderAll();
    });
    timeline.appendChild(card);
  });

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

  function selectConstruct(id) {
    state.selectedId = id;
    if (id === "logic") state.setLogic = true;
    if (id === "always-ff") state.setFf = true;
    if (id === "generate") state.setGenerate = true;
    state.lastAction = "select";
    pushLog("run", `# select ${id}`);
    renderAll();
  }

  function renderTimeline() {
    timeline.querySelectorAll(".tl-card").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.era === state.filterEra);
    });
  }

  function renderList() {
    const list = filteredList(state);
    constructList.innerHTML = "";
    list.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "construct-row" + (c.id === state.selectedId ? " is-sel" : "");
      const tag =
        c.era === "v95" ? "V95" : c.era === "v01" ? "V01" : "SV";
      btn.innerHTML = `<span>${escapeHtml(c.name)}</span>
        <span class="era">${escapeHtml(c.std)}</span>
        <span class="tag ${c.era === "v95" ? "v95" : c.era === "v01" ? "v01" : "sv"}">${tag}</span>`;
      btn.addEventListener("click", () => selectConstruct(c.id));
      constructList.appendChild(btn);
    });
    valCount.textContent = String(list.length);
    noteCount.textContent =
      state.filterEra === "all"
        ? `of ${CONSTRUCTS.length} total`
        : `filtered to ${ERA_META[state.filterEra].label}`;
  }

  function renderDetail() {
    const c = getConstruct(state.selectedId);
    valStd.textContent = c.std;
    noteStd.textContent = ERA_META[c.era].label;
    detailName.textContent = c.name;
    detailStd.textContent = `Introduced: ${c.std}`;
    detailBlurb.textContent = c.blurb;
    codeBox.textContent = `// ${c.name}\n${c.sample}`;
  }

  function renderWarn() {
    const c = getConstruct(state.selectedId);
    warnBox.classList.remove("is-ok");
    if (state.filterEra !== "all" && c.era !== state.filterEra) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Selected construct is hidden by the current era filter — clear filter or change selection.";
    } else if (c.era === "sv") {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent =
        "Needs a SystemVerilog (IEEE 1800) mode / tool — not plain Verilog-95.";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(explain eras for a summary)</span>';
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
    eraSel.value = state.filterEra;
    searchIn.value = state.query;
    renderTimeline();
    renderList();
    renderDetail();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setLogic = true;
    pushLog("muted", "# starter logic → IEEE 1800");
    state.trace = [];
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    const c = getConstruct(state.selectedId);
    state.trace = [
      { kind: "muted", text: "IEEE eras (literacy map)" },
      { kind: "hi", text: "1364-1995 — classic Verilog" },
      { kind: "hi", text: "1364-2001 — ANSI, generate, @(*)" },
      { kind: "ok", text: "1800 — SystemVerilog RTL + TB" },
      {
        kind: "run",
        text: `selected ${c.name} → ${c.std}`,
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("iv-starter").addEventListener("click", loadStarter);

  eraSel.addEventListener("change", () => {
    state.filterEra = eraSel.value;
    state.filtered = true;
    if (state.filterEra === "sv") state.setSv = true;
    if (state.filterEra === "v95") state.setV95 = true;
    state.lastAction = "filter";
    pushLog("run", `# filter → ${state.filterEra}`);
    renderAll();
  });

  searchIn.addEventListener("input", () => {
    state.query = searchIn.value;
    state.lastAction = "search";
    renderAll();
  });

  document.getElementById("btn-logic").addEventListener("click", () => {
    state.filterEra = "all";
    state.query = "";
    state.setLogic = true;
    state.selectedId = "logic";
    state.lastAction = "preset-logic";
    pushLog("ok", "# select logic");
    renderAll();
  });

  document.getElementById("btn-ff").addEventListener("click", () => {
    state.filterEra = "all";
    state.query = "";
    state.setFf = true;
    state.selectedId = "always-ff";
    state.lastAction = "preset-ff";
    pushLog("ok", "# select always_ff");
    renderAll();
  });

  document.getElementById("btn-gen").addEventListener("click", () => {
    state.filterEra = "all";
    state.query = "";
    state.setGenerate = true;
    state.selectedId = "generate";
    state.lastAction = "preset-gen";
    pushLog("ok", "# select generate");
    renderAll();
  });

  document.getElementById("btn-wire").addEventListener("click", () => {
    state.filterEra = "all";
    state.query = "";
    state.setV95 = true;
    state.selectedId = "wire-reg";
    state.lastAction = "preset-wire";
    pushLog("ok", "# select wire/reg");
    renderAll();
  });

  document.getElementById("btn-sv-filter").addEventListener("click", () => {
    state.filterEra = "sv";
    state.filtered = true;
    state.setSv = true;
    state.lastAction = "preset-sv-filter";
    pushLog("ok", "# filter 1800");
    renderAll();
  });

  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-1800",
      title: "Quiz: 1800",
      prompt: "SystemVerilog IEEE number? Answer: <code>1800</code>",
      hint: "cheat sheet SV row",
      type: "text",
      answer: "1800",
      alt: ["ieee 1800", "1800-2005"],
    },
    {
      id: "quiz-1364",
      title: "Quiz: 1364",
      prompt: "Classic Verilog IEEE number? Answer: <code>1364</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "1364",
      alt: ["ieee 1364"],
    },
    {
      id: "quiz-logic",
      title: "Quiz: logic era",
      prompt: "<code>logic</code> arrives with? Answer: <code>1800</code>",
      hint: "starter",
      type: "text",
      answer: "1800",
      alt: ["sv", "systemverilog", "ieee 1800"],
    },
    {
      id: "quiz-generate",
      title: "Quiz: generate",
      prompt: "<code>generate</code> arrives with? Answer: <code>2001</code>",
      hint: "1364-2001",
      type: "text",
      answer: "2001",
      alt: ["1364-2001", "v2001", "verilog-2001"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — logic selected, IEEE 1800.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const c = getConstruct(state.selectedId);
        return c.id === "logic" && c.std.includes("1800");
      },
    },
    {
      id: "preset-logic",
      title: "Select logic",
      prompt: "Select logic (1800).",
      hint: "Select logic button",
      type: "state",
      setup: () => {
        state.selectedId = "wire-reg";
        renderAll();
      },
      check: () =>
        state.setLogic &&
        state.selectedId === "logic" &&
        state.lastAction === "preset-logic",
    },
    {
      id: "preset-ff",
      title: "Select always_ff",
      prompt: "Select always_ff (1800).",
      hint: "Select always_ff button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setFf &&
        state.selectedId === "always-ff" &&
        getConstruct("always-ff").era === "sv",
    },
    {
      id: "preset-gen",
      title: "Select generate",
      prompt: "Select generate (2001).",
      hint: "Select generate button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setGenerate &&
        state.selectedId === "generate" &&
        getConstruct("generate").era === "v01",
    },
    {
      id: "preset-wire",
      title: "Select wire/reg",
      prompt: "Select wire/reg (1995).",
      hint: "Select wire/reg button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.selectedId === "wire-reg" &&
        getConstruct("wire-reg").era === "v95",
    },
    {
      id: "filter-sv",
      title: "Filter SV",
      prompt: "Filter 1800 only — all visible rows are SV era.",
      hint: "Filter 1800 only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setSv &&
        state.filterEra === "sv" &&
        filteredList(state).every((c) => c.era === "sv"),
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain eras.",
      hint: "Explain eras",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "timeline-v01",
      title: "Timeline 2001",
      prompt: "Click the 1364-2001 timeline card.",
      hint: "Middle timeline card",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.filterEra === "v01" && state.lastAction === "timeline",
    },
    {
      id: "search-interface",
      title: "Search interface",
      prompt: "Search “interface” and select that construct.",
      hint: "Search box → click interface row",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.query.toLowerCase().includes("interface") &&
        state.selectedId === "interface",
    },
    {
      id: "quiz-ansi",
      title: "Quiz: ANSI",
      prompt: "ANSI ports arrive in? Answer: <code>2001</code>",
      hint: "V01 row",
      type: "text",
      answer: "2001",
      alt: ["1364-2001", "v2001"],
    },
    {
      id: "quiz-interface",
      title: "Quiz: interface",
      prompt: "interface / modport standard family? Answer: <code>1800</code>",
      hint: "SV",
      type: "text",
      answer: "1800",
      alt: ["sv", "systemverilog"],
    },
    {
      id: "code-logic",
      title: "Code logic",
      prompt: "With logic selected, sample shows <code>logic [7:0]</code>.",
      hint: "Select logic",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.selectedId === "logic" &&
        getConstruct("logic").sample.includes("logic [7:0]"),
    },
    {
      id: "count-sv",
      title: "Count SV",
      prompt: "Filter 1800 — visible count equals number of SV constructs.",
      hint: "Filter 1800 only",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const n = CONSTRUCTS.filter((c) => c.era === "sv").length;
        return (
          state.filterEra === "sv" &&
          filteredList(state).length === n &&
          Number(valCount.textContent) === n
        );
      },
    },
    {
      id: "package-sv",
      title: "package era",
      prompt: "Select package / import — era is sv.",
      hint: "Click package row (filter all)",
      type: "state",
      setup: () => {
        state.filterEra = "all";
        state.query = "";
        renderAll();
      },
      check: () =>
        state.selectedId === "package" &&
        getConstruct("package").era === "sv",
    },
    {
      id: "star-sens",
      title: "@(*)",
      prompt: "Select always @(*) — era v01.",
      hint: "Click always @(*) row",
      type: "state",
      setup: () => {
        state.filterEra = "all";
        renderAll();
      },
      check: () =>
        state.selectedId === "star-sens" &&
        getConstruct("star-sens").era === "v01",
    },
    {
      id: "filter-dropdown",
      title: "Filter dropdown",
      prompt: "Set Filter era dropdown to 1364-1995 only.",
      hint: "Filter era select",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.filterEra === "v95" && state.lastAction === "filter",
    },
    {
      id: "sv-warn",
      title: "SV note",
      prompt: "With an SV construct selected (filter all), ok warning shows.",
      hint: "Select logic",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        getConstruct(state.selectedId).era === "sv" &&
        state.filterEra === "all" &&
        !warnBox.classList.contains("hidden") &&
        warnBox.classList.contains("is-ok"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → always_ff preset → explain.",
      hint: "Load → Select always_ff → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.selectedId === "always-ff" &&
        state.setFf &&
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
