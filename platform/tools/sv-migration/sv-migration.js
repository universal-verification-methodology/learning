(() => {
  /**
   * 1364 → 1800 migration quiz — side-by-side idiom checklist.
   * Prefer modern SV forms; classic Verilog still legal in many tools.
   */

  const IDIOMS = [
    {
      id: "logic",
      title: "wire/reg → logic",
      topic: "types",
      answer: "logic",
      alt: ["logic type"],
      old: "wire [7:0] a;\nreg  [7:0] q;",
      neu: "logic [7:0] a;\nlogic [7:0] q;",
      tip: "logic covers most RTL nets/vars; keep wire for multi-driver nets.",
    },
    {
      id: "always-ff",
      title: "always @(posedge) → always_ff",
      topic: "process",
      answer: "always_ff",
      alt: ["always ff"],
      old: "always @(posedge clk or negedge rst_n)\n  if (!rst_n) q <= 0;\n  else q <= d;",
      neu: "always_ff @(posedge clk or negedge rst_n)\n  if (!rst_n) q <= '0;\n  else q <= d;",
      tip: "States sequential intent; tools can check misuse.",
    },
    {
      id: "always-comb",
      title: "always @(*) → always_comb",
      topic: "process",
      answer: "always_comb",
      alt: ["always comb"],
      old: "always @(*) begin\n  y = a & b;\nend",
      neu: "always_comb begin\n  y = a & b;\nend",
      tip: "Auto sensitivity + combo intent checks.",
    },
    {
      id: "ansi",
      title: "non-ANSI → ANSI ports",
      topic: "ports",
      answer: "ansi",
      alt: ["ansi ports", "ansi port"],
      old: "module m(a, y);\n  input a;\n  output y;\n  ...\nendmodule",
      neu: "module m(\n  input  logic a,\n  output logic y\n);\n  ...\nendmodule",
      tip: "Directions live in the port list.",
    },
    {
      id: "int",
      title: "integer → int",
      topic: "types",
      answer: "int",
      alt: ["int type"],
      old: "integer i;\nfor (i = 0; i < N; i = i + 1)",
      neu: "int i;\nfor (i = 0; i < N; i++)",
      tip: "int is 2-state 32-bit; integer is 4-state.",
    },
    {
      id: "unique",
      title: "case → unique case",
      topic: "case",
      answer: "unique case",
      alt: ["unique", "unique_case"],
      old: "case (sel)\n  2'b00: y = a;\n  2'b01: y = b;\n  // ...\nendcase",
      neu: "unique case (sel)\n  2'b00: y = a;\n  2'b01: y = b;\n  // ...\nendcase",
      tip: "When items are mutex and complete (or have default).",
    },
    {
      id: "typedef",
      title: "repeat widths → typedef",
      topic: "types",
      answer: "typedef",
      alt: ["typedef byte_t", "type alias"],
      old: "wire [7:0] d0, d1, d2;",
      neu: "typedef logic [7:0] byte_t;\nbyte_t d0, d1, d2;",
      tip: "Share width/type via package + typedef.",
    },
    {
      id: "interface",
      title: "port lists → interface",
      topic: "ports",
      answer: "interface",
      alt: ["iface", "interfaces"],
      old: "module prod(output valid, input ready, output [7:0] data);\nmodule cons(input valid, output ready, input [7:0] data);",
      neu: "interface stream_if;\n  logic valid, ready;\n  logic [7:0] data;\n  modport src(...);\n  modport dst(...);\nendinterface",
      tip: "Bundle + modport directions per role.",
    },
    {
      id: "package",
      title: "shared consts → package",
      topic: "types",
      answer: "package",
      alt: ["pkg", "packages"],
      old: "// copied `define WIDTH 8 in every file",
      neu: "package types_pkg;\n  parameter WIDTH = 8;\nendpackage\nimport types_pkg::*;",
      tip: "Prefer package/parameter over global `define.",
    },
    {
      id: "cast",
      title: "$signed habit → typed signed",
      topic: "types",
      answer: "signed",
      alt: ["logic signed", "$signed"],
      old: "wire [7:0] a, b;\nwire [7:0] s = $signed(a) + $signed(b);",
      neu: "logic signed [7:0] a, b;\nlogic signed [7:0] s = a + b;",
      tip: "Declare signedness; use $signed when casting expressions.",
    },
  ];

  function makeStarter() {
    return {
      idx: 0,
      done: {}, // id -> true
      lastAction: "",
      explained: false,
      marked: false,
      setLogic: false,
      setFf: false,
      setComb: false,
      setAnsi: false,
      log: [],
      trace: [],
    };
  }

  function current(state) {
    return IDIOMS[state.idx] || IDIOMS[0];
  }

  function doneCount(state) {
    return Object.keys(state.done).filter((k) => state.done[k]).length;
  }

  const CLEARED_KEY = "ddv-sv-migration-cleared-v1";
  const STORE_KEY = "ddv-sv-migration-session-v1";

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

  const root = document.getElementById("mg-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> migrate <code>wire</code>/<code>reg</code> to
        <code>logic</code>. Walk the checklist, mark idioms done, and quiz the SV form.</p>
      <button type="button" class="btn btn-secondary" id="mg-starter">Load starter example</button>
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
            <p>Classic Verilog idioms still compile in many flows.</p>
          </div>
          <div class="idea-card">
            <h3>1800</h3>
            <p>Clearer intent: logic, always_*, ANSI, packages.</p>
          </div>
          <div class="idea-card">
            <h3>Migrate</h3>
            <p>Prefer SV forms for new RTL; convert hot spots first.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Idiom checklist</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Topic
              <select id="topic-sel">
                <option value="all" selected>all</option>
                <option value="types">types</option>
                <option value="process">process</option>
                <option value="ports">ports</option>
                <option value="case">case</option>
              </select>
            </label>
          </div>
          <p class="legend">Click a row. Mark done when you’ve internalized the SV form.</p>
          <div class="idiom-list" id="idiom-list"></div>
          <div class="compare">
            <div class="pane is-old">
              <div class="pane-head">1364-style</div>
              <pre id="code-old"></pre>
            </div>
            <div class="pane is-new">
              <div class="pane-head">1800-style</div>
              <pre id="code-new"></pre>
            </div>
          </div>
          <div class="note-box" id="tip-box"></div>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-logic">Open wire/reg → logic</button>
            <button type="button" id="btn-ff">Open always_ff migrate</button>
            <button type="button" id="btn-comb">Open always_comb migrate</button>
            <button type="button" id="btn-ansi">Open ANSI ports</button>
            <button type="button" id="btn-mark">Mark current done</button>
            <button type="button" id="btn-next-idiom">Next idiom</button>
            <button type="button" id="btn-explain">Explain migration</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Progress</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card" id="card-cur">
              <h3>Current</h3>
              <p class="val" id="val-cur">—</p>
              <p class="note" id="note-cur"></p>
            </div>
            <div class="status-card" id="card-prog">
              <h3>Marked done</h3>
              <p class="val" id="val-prog">—</p>
              <p class="note" id="note-prog"></p>
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
          <thead><tr><th>From (1364)</th><th>Toward (1800)</th></tr></thead>
          <tbody>
            <tr><td><code>wire</code> / <code>reg</code></td><td><code>logic</code> (usually)</td></tr>
            <tr><td><code>always @(posedge clk)</code></td><td><code>always_ff</code></td></tr>
            <tr><td><code>always @(*)</code></td><td><code>always_comb</code></td></tr>
            <tr><td>non-ANSI ports</td><td>ANSI port list</td></tr>
            <tr><td><code>integer</code></td><td><code>int</code></td></tr>
            <tr><td>long port lists</td><td><code>interface</code> + modport</td></tr>
            <tr><td><code>\`define</code> widths</td><td><code>package</code> / <code>parameter</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: wire/reg → logic.</li>
          <li>Migration is style + tool mode — not every line must change overnight.</li>
        </ul>
      </div>
    </div>
  `;

  const topicSel = document.getElementById("topic-sel");
  const idiomList = document.getElementById("idiom-list");
  const codeOld = document.getElementById("code-old");
  const codeNew = document.getElementById("code-new");
  const tipBox = document.getElementById("tip-box");
  const warnBox = document.getElementById("warn-box");
  const valCur = document.getElementById("val-cur");
  const noteCur = document.getElementById("note-cur");
  const valProg = document.getElementById("val-prog");
  const noteProg = document.getElementById("note-prog");
  const cardProg = document.getElementById("card-prog");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  let topicFilter = "all";

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
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ state, challengeIdx, topicFilter })
      );
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
      if (!state.done) state.done = {};
      challengeIdx = Number(data.challengeIdx) || 0;
      topicFilter = data.topicFilter || "all";
      return true;
    } catch {
      return false;
    }
  }

  function jumpTo(id) {
    const i = IDIOMS.findIndex((x) => x.id === id);
    if (i >= 0) state.idx = i;
    if (id === "logic") state.setLogic = true;
    if (id === "always-ff") state.setFf = true;
    if (id === "always-comb") state.setComb = true;
    if (id === "ansi") state.setAnsi = true;
    state.lastAction = "jump";
    pushLog("run", `# open ${id}`);
    renderAll();
  }

  function renderList() {
    idiomList.innerHTML = "";
    IDIOMS.forEach((it, i) => {
      if (topicFilter !== "all" && it.topic !== topicFilter) return;
      const row = document.createElement("button");
      row.type = "button";
      row.className =
        "idiom-row" +
        (i === state.idx ? " is-sel" : "") +
        (state.done[it.id] ? " is-done" : "");
      row.innerHTML = `<span class="mark">${state.done[it.id] ? "✓" : "○"}</span>
        <span>${escapeHtml(it.title)}</span>
        <span class="tag">${it.topic}</span>`;
      row.addEventListener("click", () => {
        state.idx = i;
        state.lastAction = "select";
        pushLog("run", `# select ${it.id}`);
        renderAll();
      });
      idiomList.appendChild(row);
    });
  }

  function renderCompare() {
    const it = current(state);
    codeOld.textContent = it.old;
    codeNew.textContent = it.neu;
    tipBox.textContent = it.tip;
    valCur.textContent = it.answer;
    noteCur.textContent = it.title;
    const n = doneCount(state);
    valProg.textContent = `${n} / ${IDIOMS.length}`;
    noteProg.textContent = n === IDIOMS.length ? "checklist complete" : "keep marking";
    cardProg.className =
      "status-card" + (n === IDIOMS.length ? " is-ok" : "");
  }

  function renderWarn() {
    const it = current(state);
    warnBox.classList.remove("is-ok");
    if (state.done[it.id]) {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent = "Marked done — quiz answer focuses on: " + it.answer;
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(mark done or explain)</span>';
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
    topicSel.value = topicFilter;
    renderList();
    renderCompare();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setLogic = true;
    topicFilter = "all";
    pushLog("muted", "# starter wire/reg → logic");
    state.trace = [];
    renderAll();
  }

  function markDone() {
    const it = current(state);
    state.done[it.id] = true;
    state.marked = true;
    state.lastAction = "mark";
    pushLog("ok", `# marked ${it.id}`);
    state.trace = [
      { kind: "ok", text: `done: ${it.title}` },
      { kind: "hi", text: `prefer: ${it.answer}` },
      { kind: "run", text: `progress ${doneCount(state)}/${IDIOMS.length}` },
    ];
    renderAll();
  }

  function nextIdiom() {
    const visible = IDIOMS.map((it, i) => ({ it, i })).filter(
      ({ it }) => topicFilter === "all" || it.topic === topicFilter
    );
    if (!visible.length) return;
    const pos = visible.findIndex(({ i }) => i === state.idx);
    const next = visible[(pos + 1) % visible.length];
    state.idx = next.i;
    state.lastAction = "next-idiom";
    pushLog("run", `# next → ${next.it.id}`);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "1364 → 1800 migration" },
      { kind: "ok", text: "logic replaces most wire/reg" },
      { kind: "ok", text: "always_ff / always_comb state intent" },
      { kind: "hi", text: "ANSI ports, typedef, package, interface" },
      {
        kind: "warn",
        text: "Old idioms can remain — migrate for clarity & checks",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("mg-starter").addEventListener("click", loadStarter);

  topicSel.addEventListener("change", () => {
    topicFilter = topicSel.value;
    state.lastAction = "topic";
    // snap idx to first visible
    const first = IDIOMS.findIndex(
      (it) => topicFilter === "all" || it.topic === topicFilter
    );
    if (first >= 0) state.idx = first;
    pushLog("run", `# topic → ${topicFilter}`);
    renderAll();
  });

  document.getElementById("btn-logic").addEventListener("click", () => {
    topicFilter = "all";
    jumpTo("logic");
    state.lastAction = "preset-logic";
    saveSession();
  });

  document.getElementById("btn-ff").addEventListener("click", () => {
    topicFilter = "all";
    jumpTo("always-ff");
    state.lastAction = "preset-ff";
    saveSession();
  });

  document.getElementById("btn-comb").addEventListener("click", () => {
    topicFilter = "all";
    jumpTo("always-comb");
    state.lastAction = "preset-comb";
    saveSession();
  });

  document.getElementById("btn-ansi").addEventListener("click", () => {
    topicFilter = "all";
    jumpTo("ansi");
    state.lastAction = "preset-ansi";
    saveSession();
  });

  document.getElementById("btn-mark").addEventListener("click", markDone);
  document.getElementById("btn-next-idiom").addEventListener("click", nextIdiom);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-logic",
      title: "Quiz: logic",
      prompt: "Replace most wire/reg with? Answer: <code>logic</code>",
      hint: "starter idiom",
      type: "text",
      answer: "logic",
      alt: ["logic type"],
    },
    {
      id: "quiz-ff",
      title: "Quiz: always_ff",
      prompt: "Replace always @(posedge clk) with? Answer: <code>always_ff</code>",
      hint: "sequential intent",
      type: "text",
      answer: "always_ff",
      alt: ["always ff"],
    },
    {
      id: "quiz-comb",
      title: "Quiz: always_comb",
      prompt: "Replace always @(*) with? Answer: <code>always_comb</code>",
      hint: "combo intent",
      type: "text",
      answer: "always_comb",
      alt: ["always comb"],
    },
    {
      id: "quiz-ansi",
      title: "Quiz: ANSI",
      prompt: "Modern port list style name? Answer: <code>ansi</code>",
      hint: "ANSI ports",
      type: "text",
      answer: "ansi",
      alt: ["ansi ports", "ansi port"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — on wire/reg → logic idiom.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => current(state).id === "logic",
    },
    {
      id: "preset-logic",
      title: "Open logic",
      prompt: "Open wire/reg → logic.",
      hint: "Open wire/reg → logic button",
      type: "state",
      setup: () => {
        state.idx = 3;
        renderAll();
      },
      check: () =>
        state.setLogic &&
        current(state).id === "logic" &&
        state.lastAction === "preset-logic",
    },
    {
      id: "preset-ff",
      title: "Open FF",
      prompt: "Open always_ff migrate.",
      hint: "Open always_ff migrate",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setFf && current(state).id === "always-ff",
    },
    {
      id: "preset-comb",
      title: "Open comb",
      prompt: "Open always_comb migrate.",
      hint: "Open always_comb migrate",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setComb && current(state).id === "always-comb",
    },
    {
      id: "preset-ansi",
      title: "Open ANSI",
      prompt: "Open ANSI ports.",
      hint: "Open ANSI ports",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setAnsi && current(state).id === "ansi",
    },
    {
      id: "mark",
      title: "Mark done",
      prompt: "Mark current idiom done.",
      hint: "Mark current done",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.marked &&
        state.done[current(state).id] === true &&
        state.lastAction === "mark",
    },
    {
      id: "next-idiom",
      title: "Next idiom",
      prompt: "Click Next idiom (leaves logic).",
      hint: "Next idiom button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "next-idiom" &&
        current(state).id !== "logic",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain migration.",
      hint: "Explain migration",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "quiz-int",
      title: "Quiz: int",
      prompt: "Prefer instead of integer? Answer: <code>int</code>",
      hint: "cheat sheet / idiom",
      type: "text",
      answer: "int",
      alt: ["int type"],
    },
    {
      id: "quiz-interface",
      title: "Quiz: interface",
      prompt: "Bundle long port lists with? Answer: <code>interface</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "interface",
      alt: ["iface", "interfaces"],
    },
    {
      id: "quiz-package",
      title: "Quiz: package",
      prompt: "Share WIDTH instead of `define via? Answer: <code>package</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "package",
      alt: ["pkg", "packages"],
    },
    {
      id: "topic-process",
      title: "Topic process",
      prompt: "Set Topic dropdown to process.",
      hint: "Topic select",
      type: "state",
      setup: () => loadStarter(),
      check: () => topicFilter === "process" && state.lastAction === "topic",
    },
    {
      id: "code-logic-new",
      title: "Code logic",
      prompt: "On logic idiom, 1800 pane contains <code>logic [7:0]</code>.",
      hint: "Open wire/reg → logic",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        current(state).id === "logic" &&
        current(state).neu.includes("logic [7:0]"),
    },
    {
      id: "code-ff",
      title: "Code FF",
      prompt: "On always_ff idiom, new code starts with always_ff.",
      hint: "Open always_ff migrate",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        current(state).id === "always-ff" &&
        current(state).neu.startsWith("always_ff"),
    },
    {
      id: "mark-logic",
      title: "Mark logic",
      prompt: "Mark the logic idiom done (open it first if needed).",
      hint: "Open logic → Mark current done",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.done.logic === true,
    },
    {
      id: "progress-2",
      title: "Progress 2+",
      prompt: "Mark at least two idioms done.",
      hint: "Mark two different idioms",
      type: "state",
      setup: () => loadStarter(),
      check: () => doneCount(state) >= 2,
    },
    {
      id: "select-unique",
      title: "Select unique",
      prompt: "Click the case → unique case checklist row.",
      hint: "Idiom list",
      type: "state",
      setup: () => {
        topicFilter = "all";
        loadStarter();
      },
      check: () =>
        current(state).id === "unique" && state.lastAction === "select",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → mark logic done → open always_ff → explain.",
      hint: "Load → Mark → Open always_ff → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.done.logic === true &&
        current(state).id === "always-ff" &&
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
      // Prefer idiom answer when challenge is text matching current — no, use challenge answer
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
