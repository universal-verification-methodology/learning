(() => {
  /**
   * Package / import explorer:
   *   package  — shared typedefs, params, functions (not RTL always blocks)
   *   import pkg::*           — wildcard into scope
   *   import pkg::WIDTH       — selective
   *   types_pkg::WIDTH        — explicit scope (no import needed)
   * Import is scoped to the module / compilation-unit region where it appears.
   */

  const PKG_ITEMS = [
    { name: "WIDTH", kind: "parameter", desc: "bus width = 8" },
    { name: "byte_t", kind: "typedef", desc: "logic [7:0]" },
    { name: "IDLE", kind: "localparam", desc: "state const = 0" },
    { name: "clog2", kind: "function", desc: "ceiling log2" },
  ];

  function makeStarter() {
    return {
      mode: "wildcard", // none | wildcard | selective | scope | wrong-pkg
      importItem: "WIDTH", // for selective
      lastAction: "",
      explained: false,
      checked: false,
      setWildcard: false,
      setSelective: false,
      setScope: false,
      setNone: false,
      setWrong: false,
      log: [],
      trace: [],
    };
  }

  /** Visibility of bare name in module scope */
  function bareVisible(state, itemName) {
    if (state.mode === "wildcard") return true;
    if (state.mode === "selective") return itemName === state.importItem;
    return false; // none, scope, wrong-pkg
  }

  function qualifiedOk(state) {
    return state.mode !== "wrong-pkg";
  }

  function importLine(state) {
    if (state.mode === "wildcard") return "import types_pkg::*;";
    if (state.mode === "selective")
      return `import types_pkg::${state.importItem};`;
    if (state.mode === "scope") return "// no import — use types_pkg::NAME";
    if (state.mode === "wrong-pkg")
      return "import other_pkg::*; // wrong package";
    return "// no import";
  }

  function pkgCode() {
    return `package types_pkg;
  parameter  WIDTH = 8;
  localparam IDLE  = 0;
  typedef logic [7:0] byte_t;
  function automatic int clog2(input int n);
    // ...
  endfunction
endpackage`;
  }

  function moduleCode(state) {
    const imp = importLine(state);
    let body;
    if (state.mode === "scope") {
      body = `  logic [types_pkg::WIDTH-1:0] d;
  types_pkg::byte_t b;
  // bare WIDTH would be undeclared here`;
    } else if (state.mode === "none") {
      body = `  // logic [WIDTH-1:0] d;  // ERROR: WIDTH unknown
  logic [types_pkg::WIDTH-1:0] d; // OK with ::`;
    } else if (state.mode === "wrong-pkg") {
      body = `  // WIDTH from other_pkg? — not our WIDTH
  // types_pkg::WIDTH still works if used explicitly`;
    } else if (state.mode === "selective") {
      body =
        state.importItem === "WIDTH"
          ? `  logic [WIDTH-1:0] d;     // OK
  // byte_t b;             // ERROR unless imported
  types_pkg::byte_t b;     // OK via ::`
          : `  ${state.importItem} ... // imported
  // other bare names need :: or more imports`;
    } else {
      body = `  logic [WIDTH-1:0] d;
  byte_t b;
  int n = clog2(16);`;
    }
    return `module dut (...);
  ${imp}
${body}
endmodule`;
  }

  function sourceCode(state) {
    return `${pkgCode()}

${moduleCode(state)}`;
  }

  const CLEARED_KEY = "ddv-sv-packages-cleared-v1";
  const STORE_KEY = "ddv-sv-packages-session-v1";

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

  const root = document.getElementById("pk-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>types_pkg</code> holds WIDTH, byte_t, IDLE, clog2.
        Module uses <code>import types_pkg::*</code>. Compare selective import and
        <code>types_pkg::WIDTH</code> without importing.</p>
      <button type="button" class="btn btn-secondary" id="pk-starter">Load starter example</button>
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
            <h3>package</h3>
            <p>Share typedefs, params, functions across units.</p>
          </div>
          <div class="idea-card">
            <h3>import</h3>
            <p>Bring names into the enclosing scope.</p>
          </div>
          <div class="idea-card">
            <h3>::</h3>
            <p>Explicit <code>pkg::name</code> — no import required.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Import style</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="wildcard" selected>import pkg::*</option>
                <option value="selective">import pkg::item</option>
                <option value="scope">pkg:: only (no import)</option>
                <option value="none">no import / no ::</option>
                <option value="wrong-pkg">import wrong package</option>
              </select>
            </label>
            <label id="item-wrap" hidden>Selective item
              <select id="item-sel">
                <option value="WIDTH">WIDTH</option>
                <option value="byte_t">byte_t</option>
                <option value="IDLE">IDLE</option>
                <option value="clog2">clog2</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="belong-grid">
            <div class="belong-card is-pkg">
              <h3>Belongs in package</h3>
              <ul>
                <li>typedef / enum</li>
                <li>parameter / localparam</li>
                <li>functions / tasks</li>
                <li>classes (TB)</li>
              </ul>
            </div>
            <div class="belong-card is-mod">
              <h3>Belongs in module</h3>
              <ul>
                <li>ports &amp; instances</li>
                <li>always_ff / always_comb</li>
                <li>continuous assign</li>
                <li>structural hierarchy</li>
              </ul>
            </div>
          </div>
          <table class="scope-table" id="scope-table">
            <thead>
              <tr><th>Name</th><th>Bare OK?</th><th>pkg:: OK?</th></tr>
            </thead>
            <tbody></tbody>
          </table>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-wild">Preset import *</button>
            <button type="button" id="btn-sel">Preset import WIDTH</button>
            <button type="button" id="btn-scope">Preset pkg:: only</button>
            <button type="button" id="btn-none">Preset no import</button>
            <button type="button" id="btn-wrong">Preset wrong package</button>
            <button type="button" id="btn-check">Check name visibility</button>
            <button type="button" id="btn-explain">Explain package/import</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Visibility</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card" id="card-mode">
              <h3>Import mode</h3>
              <p class="val" id="val-mode">—</p>
              <p class="note" id="note-mode"></p>
            </div>
            <div class="status-card" id="card-bare">
              <h3>Bare WIDTH</h3>
              <p class="val" id="val-bare">—</p>
              <p class="note" id="note-bare"></p>
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
          <thead><tr><th>Form</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td><code>package</code></td><td>Reusable declarations, not hardware structure</td></tr>
            <tr><td><code>import pkg::*</code></td><td>All names into current scope</td></tr>
            <tr><td><code>import pkg::X</code></td><td>Only X visible as bare name</td></tr>
            <tr><td><code>pkg::X</code></td><td>Always legal (if pkg compiled)</td></tr>
            <tr><td>Scope</td><td>Import applies where written (module / CU)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: wildcard — every package name is bare-visible.</li>
          <li>Do not put <code>always_ff</code> / instances in a package.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const itemWrap = document.getElementById("item-wrap");
  const itemSel = document.getElementById("item-sel");
  const modeLegend = document.getElementById("mode-legend");
  const scopeBody = document.querySelector("#scope-table tbody");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardMode = document.getElementById("card-mode");
  const cardBare = document.getElementById("card-bare");
  const valMode = document.getElementById("val-mode");
  const valBare = document.getElementById("val-bare");
  const noteMode = document.getElementById("note-mode");
  const noteBare = document.getElementById("note-bare");
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

  function modeLabel(m) {
    if (m === "wildcard") return "import *";
    if (m === "selective") return "import item";
    if (m === "scope") return "pkg:: only";
    if (m === "wrong-pkg") return "wrong pkg";
    return "none";
  }

  function renderTable() {
    scopeBody.innerHTML = "";
    PKG_ITEMS.forEach((it) => {
      const bare = bareVisible(state, it.name);
      const qual = qualifiedOk(state);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${it.name} <span style="color:var(--muted);font-size:0.75rem">(${it.kind})</span></td>
        <td class="${bare ? "yes" : "no"}">${bare ? "yes" : "no"}</td>
        <td class="${qual ? "qual" : "no"}">${qual ? "types_pkg::" + it.name : "n/a"}</td>`;
      scopeBody.appendChild(tr);
    });
  }

  function renderStatus() {
    valMode.textContent = modeLabel(state.mode);
    noteMode.textContent = importLine(state);
    cardMode.className =
      "status-card " +
      (state.mode === "none" || state.mode === "wrong-pkg" ? "is-warn" : "is-ok");

    const w = bareVisible(state, "WIDTH");
    valBare.textContent = w ? "visible" : "hidden";
    noteBare.textContent = w
      ? "can write WIDTH"
      : "use types_pkg::WIDTH";
    cardBare.className = "status-card " + (w ? "is-ok" : "is-warn");
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (state.mode === "none") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Bare package names are undeclared — import or qualify with types_pkg::";
    } else if (state.mode === "wrong-pkg") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Wrong package import does not bring types_pkg names into bare scope.";
    } else if (state.mode === "selective") {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent = `Only ${state.importItem} is bare-visible; others need :: or more imports.`;
    } else if (state.mode === "wildcard" || state.mode === "scope") {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent =
        state.mode === "wildcard"
          ? "Wildcard import: all types_pkg names are bare-visible in this module."
          : "No import pollution — every use is explicitly types_pkg::name.";
    } else {
      warnBox.classList.add("hidden");
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(check visibility or explain)</span>';
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
    if (state.mode === "wildcard")
      return "import types_pkg::* — convenient; watch name clashes.";
    if (state.mode === "selective")
      return "Selective import — minimal namespace pollution.";
    if (state.mode === "scope")
      return "Explicit :: everywhere — clearest for large designs.";
    if (state.mode === "wrong-pkg")
      return "Importing the wrong package does not help.";
    return "Without import or ::, package names are unknown.";
  }

  function renderAll() {
    modeSel.value = state.mode;
    itemSel.value = state.importItem;
    itemWrap.hidden = state.mode !== "selective";
    modeLegend.textContent = legendText();
    renderTable();
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
    state.setWildcard = true;
    pushLog("muted", "# starter import types_pkg::*");
    state.trace = [];
    renderAll();
  }

  function doCheck() {
    state.checked = true;
    state.lastAction = "check";
    const lines = PKG_ITEMS.map((it) => {
      const bare = bareVisible(state, it.name);
      return {
        kind: bare ? "ok" : "warn",
        text: `${it.name}: bare=${bare ? "yes" : "no"}  ::=${qualifiedOk(state) ? "yes" : "no"}`,
      };
    });
    state.trace = [
      { kind: "muted", text: `visibility @ ${modeLabel(state.mode)}` },
      ...lines,
    ];
    pushLog("ok", "# checked visibility");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "package vs module" },
      { kind: "ok", text: "package: types, params, functions" },
      { kind: "ok", text: "module: ports, hierarchy, always_*" },
      { kind: "hi", text: "import brings names into that scope only" },
      { kind: "run", text: "pkg::name works without import" },
      {
        kind: "warn",
        text: "avoid always_ff / instances inside packages",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("pk-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "wildcard") state.setWildcard = true;
    if (state.mode === "selective") state.setSelective = true;
    if (state.mode === "scope") state.setScope = true;
    if (state.mode === "none") state.setNone = true;
    if (state.mode === "wrong-pkg") state.setWrong = true;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  itemSel.addEventListener("change", () => {
    state.importItem = itemSel.value;
    state.lastAction = "item";
    pushLog("run", `# selective → ${state.importItem}`);
    renderAll();
  });

  document.getElementById("btn-wild").addEventListener("click", () => {
    state.mode = "wildcard";
    state.setWildcard = true;
    state.lastAction = "preset-wild";
    pushLog("ok", "# preset import *");
    renderAll();
  });

  document.getElementById("btn-sel").addEventListener("click", () => {
    state.mode = "selective";
    state.importItem = "WIDTH";
    state.setSelective = true;
    state.lastAction = "preset-sel";
    pushLog("ok", "# preset import WIDTH");
    renderAll();
  });

  document.getElementById("btn-scope").addEventListener("click", () => {
    state.mode = "scope";
    state.setScope = true;
    state.lastAction = "preset-scope";
    pushLog("ok", "# preset pkg:: only");
    renderAll();
  });

  document.getElementById("btn-none").addEventListener("click", () => {
    state.mode = "none";
    state.setNone = true;
    state.lastAction = "preset-none";
    pushLog("warn", "# preset no import");
    renderAll();
  });

  document.getElementById("btn-wrong").addEventListener("click", () => {
    state.mode = "wrong-pkg";
    state.setWrong = true;
    state.lastAction = "preset-wrong";
    pushLog("warn", "# preset wrong package");
    renderAll();
  });

  document.getElementById("btn-check").addEventListener("click", doCheck);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-package",
      title: "Quiz: package",
      prompt: "Shared declaration container is a? Answer: <code>package</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "package",
      alt: ["pkg", "packages"],
    },
    {
      id: "quiz-import",
      title: "Quiz: import",
      prompt: "Bring names into scope with? Answer: <code>import</code>",
      hint: "import pkg::*",
      type: "text",
      answer: "import",
      alt: ["imports"],
    },
    {
      id: "quiz-star",
      title: "Quiz: *",
      prompt: "Wildcard import form ends with? Answer: <code>::*</code>",
      hint: "import pkg::*",
      type: "text",
      answer: "::*",
      alt: ["*", "pkg::*", "::* "],
    },
    {
      id: "quiz-scope",
      title: "Quiz: ::",
      prompt: "Package scope operator is? Answer: <code>::</code>",
      hint: "types_pkg::WIDTH",
      type: "text",
      answer: "::",
      alt: ["scope", "pkg::", "colon colon"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — wildcard import, bare WIDTH visible.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wildcard" && bareVisible(state, "WIDTH"),
    },
    {
      id: "preset-wild",
      title: "Preset *",
      prompt: "Preset import *.",
      hint: "Preset import *",
      type: "state",
      setup: () => {
        state.mode = "none";
        renderAll();
      },
      check: () =>
        state.setWildcard &&
        state.mode === "wildcard" &&
        state.lastAction === "preset-wild",
    },
    {
      id: "preset-sel",
      title: "Preset WIDTH",
      prompt: "Preset import WIDTH — bare WIDTH yes, bare byte_t no.",
      hint: "Preset import WIDTH",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setSelective &&
        state.mode === "selective" &&
        state.importItem === "WIDTH" &&
        bareVisible(state, "WIDTH") &&
        !bareVisible(state, "byte_t"),
    },
    {
      id: "preset-scope",
      title: "Preset ::",
      prompt: "Preset pkg:: only — no bare names.",
      hint: "Preset pkg:: only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setScope &&
        state.mode === "scope" &&
        !bareVisible(state, "WIDTH") &&
        qualifiedOk(state),
    },
    {
      id: "preset-none",
      title: "Preset none",
      prompt: "Preset no import — bare WIDTH hidden.",
      hint: "Preset no import",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setNone &&
        state.mode === "none" &&
        !bareVisible(state, "WIDTH"),
    },
    {
      id: "preset-wrong",
      title: "Wrong pkg",
      prompt: "Preset wrong package.",
      hint: "Preset wrong package",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setWrong &&
        state.mode === "wrong-pkg" &&
        !bareVisible(state, "WIDTH"),
    },
    {
      id: "check",
      title: "Check",
      prompt: "Run Check name visibility.",
      hint: "Check name visibility",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.checked && state.lastAction === "check",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain package/import.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-scope",
      title: "Mode ::",
      prompt: "Switch Mode dropdown to pkg:: only.",
      hint: "Mode select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "scope" && state.lastAction === "mode",
    },
    {
      id: "sel-byte",
      title: "Select byte_t",
      prompt: "Selective mode importing byte_t — bare byte_t yes, WIDTH no.",
      hint: "Preset WIDTH then Selective item → byte_t",
      type: "state",
      setup: () => {
        state.mode = "selective";
        state.importItem = "WIDTH";
        state.setSelective = true;
        renderAll();
      },
      check: () =>
        state.mode === "selective" &&
        state.importItem === "byte_t" &&
        bareVisible(state, "byte_t") &&
        !bareVisible(state, "WIDTH"),
    },
    {
      id: "quiz-module",
      title: "Quiz: module",
      prompt: "always_ff belongs in a? Answer: <code>module</code>",
      hint: "belong cards",
      type: "text",
      answer: "module",
      alt: ["modules", "rtl module"],
    },
    {
      id: "quiz-typedef",
      title: "Quiz: typedef",
      prompt: "Shared typedefs usually live in a? Answer: <code>package</code>",
      hint: "belong cards",
      type: "text",
      answer: "package",
      alt: ["pkg"],
    },
    {
      id: "code-pkg",
      title: "Code package",
      prompt: "Source contains <code>package types_pkg</code>.",
      hint: "Always on starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode(state).includes("package types_pkg"),
    },
    {
      id: "code-import-star",
      title: "Code *",
      prompt: "Wildcard mode source has <code>import types_pkg::*</code>.",
      hint: "Preset import *",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wildcard" &&
        sourceCode(state).includes("import types_pkg::*"),
    },
    {
      id: "warn-none",
      title: "Warn none",
      prompt: "No-import mode shows warning (not is-ok).",
      hint: "Preset no import",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "none" &&
        !warnBox.classList.contains("hidden") &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "all-bare-wild",
      title: "All bare",
      prompt: "Under wildcard, all four package names are bare-visible.",
      hint: "Preset import *",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wildcard" &&
        PKG_ITEMS.every((it) => bareVisible(state, it.name)),
    },
    {
      id: "scope-qual",
      title: "Qualified",
      prompt: "In pkg:: mode, types_pkg::WIDTH is still OK.",
      hint: "Preset pkg:: only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "scope" &&
        !bareVisible(state, "WIDTH") &&
        qualifiedOk(state),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → selective WIDTH → check → explain.",
      hint: "Load → Preset import WIDTH → Check → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "selective" &&
        state.importItem === "WIDTH" &&
        state.checked &&
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
