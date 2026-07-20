(() => {
  /**
   * SV typedef / enum / packed vs unpacked struct (layout literacy).
   * Packed: contiguous bits, first field = MSB by default in SV.
   * Unpacked: members are separate objects — not one vector.
   */

  const COLORS = ["#86efac", "#93c5fd", "#fcd34d", "#f9a8d4", "#c4b5fd"];

  const ENUM_AUTO = [
    { name: "IDLE", value: 0 },
    { name: "LOAD", value: 1 },
    { name: "RUN", value: 2 },
    { name: "DONE", value: 3 },
  ];

  const ENUM_EXPLICIT = [
    { name: "IDLE", value: 0 },
    { name: "LOAD", value: 1 },
    { name: "RUN", value: 4 },
    { name: "DONE", value: 5 },
  ];

  const PACKED_FIELDS = [
    { name: "valid", width: 1 },
    { name: "opcode", width: 3 },
    { name: "data", width: 8 },
  ]; // total 12; valid is MSB

  function enumWidth(members) {
    const max = Math.max(...members.map((m) => m.value));
    return Math.max(1, Math.ceil(Math.log2(max + 1)));
  }

  function packedTotal() {
    return PACKED_FIELDS.reduce((s, f) => s + f.width, 0);
  }

  function packedLayout() {
    // MSB-first: valid at top
    let msb = packedTotal() - 1;
    return PACKED_FIELDS.map((f) => {
      const hi = msb;
      const lo = msb - f.width + 1;
      msb = lo - 1;
      return { ...f, hi, lo };
    });
  }

  function makeStarter() {
    return {
      mode: "enum", // typedef | enum | packed | unpacked
      enumStyle: "auto", // auto | explicit
      enumSel: 0,
      lastAction: "",
      explained: false,
      setPacked: false,
      setUnpacked: false,
      setTypedef: false,
      setExplicit: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-sv-typedefs-cleared-v1";
  const STORE_KEY = "ddv-sv-typedefs-session-v1";

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

  const root = document.getElementById("td-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>typedef enum logic [1:0] {IDLE, LOAD, RUN, DONE} state_t;</code>
        — auto values 0..3. Then compare packed packet vs unpacked fields.</p>
      <button type="button" class="btn btn-secondary" id="td-starter">Load starter example</button>
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
            <h3>typedef</h3>
            <p>Alias a type once; reuse <code>_t</code> names everywhere.</p>
          </div>
          <div class="idea-card">
            <h3>enum</h3>
            <p>Named encodings; auto-increment or explicit values.</p>
          </div>
          <div class="idea-card">
            <h3>packed</h3>
            <p>One contiguous vector — assignable as bits.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Explorer</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>View
              <select id="mode-sel">
                <option value="typedef">typedef alias</option>
                <option value="enum" selected>enum</option>
                <option value="packed">packed struct</option>
                <option value="unpacked">unpacked struct</option>
              </select>
            </label>
            <label id="enum-style-wrap">Enum style
              <select id="enum-style">
                <option value="auto">auto 0,1,2…</option>
                <option value="explicit">explicit gaps</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <pre class="code-box" id="code-box"></pre>
          <div id="view-body"></div>
          <div class="action-grid">
            <button type="button" id="btn-enum">Preset auto enum</button>
            <button type="button" id="btn-explicit">Preset explicit enum</button>
            <button type="button" id="btn-packed">Preset packed packet</button>
            <button type="button" id="btn-unpacked">Preset unpacked fields</button>
            <button type="button" id="btn-typedef">Show typedef bus_t</button>
            <button type="button" id="btn-explain">Explain layout</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Details</h2></div>
        <div class="panel-body">
          <div class="out-grid">
            <div class="out-card">
              <h3>Summary</h3>
              <p class="val" id="sum-val">—</p>
            </div>
            <div class="out-card">
              <h3>Width / note</h3>
              <p class="val" id="width-val">—</p>
            </div>
          </div>
          <div id="detail-table"></div>
          <pre class="trace-box" id="trace-box" style="margin-top:0.65rem"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Construct</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td><code>typedef</code></td><td>Name a type; does not allocate storage by itself</td></tr>
            <tr><td><code>enum</code></td><td>Labels map to integral values; base type sets width</td></tr>
            <tr><td>packed struct</td><td>Members concatenate; first listed = MSB</td></tr>
            <tr><td>unpacked struct</td><td>Members are separate — no single bit vector</td></tr>
            <tr><td>Cast / assign</td><td>Packed structs assign like <code>logic [W-1:0]</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter enum: IDLE=0 … DONE=3 on <code>logic [1:0]</code>.</li>
          <li>Packed packet: valid|opcode|data = 12 bits.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const enumStyle = document.getElementById("enum-style");
  const enumStyleWrap = document.getElementById("enum-style-wrap");
  const modeLegend = document.getElementById("mode-legend");
  const codeBox = document.getElementById("code-box");
  const viewBody = document.getElementById("view-body");
  const sumVal = document.getElementById("sum-val");
  const widthVal = document.getElementById("width-val");
  const detailTable = document.getElementById("detail-table");
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

  function enumMembers() {
    return state.enumStyle === "explicit" ? ENUM_EXPLICIT : ENUM_AUTO;
  }

  function sourceCode() {
    if (state.mode === "typedef") {
      return `typedef logic [7:0] byte_t;\ntypedef byte_t [3:0] bus_t; // 4 bytes\nbus_t data;`;
    }
    if (state.mode === "enum") {
      const mem = enumMembers();
      const w = enumWidth(mem);
      if (state.enumStyle === "auto") {
        return `typedef enum logic [${w - 1}:0] {\n  IDLE, LOAD, RUN, DONE\n} state_t;\nstate_t st;`;
      }
      return `typedef enum logic [${w - 1}:0] {\n  IDLE = 0,\n  LOAD = 1,\n  RUN  = 4,\n  DONE = 5\n} state_t;\nstate_t st;`;
    }
    if (state.mode === "packed") {
      return `typedef struct packed {\n  logic       valid;\n  logic [2:0] opcode;\n  logic [7:0] data;\n} pkt_t; // 12 bits, valid = MSB\npkt_t p;`;
    }
    return `typedef struct {\n  logic       valid;\n  logic [2:0] opcode;\n  logic [7:0] data;\n} pkt_u; // unpacked — not one vector\npkt_u u;`;
  }

  function renderView() {
    viewBody.innerHTML = "";
    if (state.mode === "enum") {
      const mem = enumMembers();
      const row = document.createElement("div");
      row.className = "enum-row";
      mem.forEach((m, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "enum-chip" + (i === state.enumSel ? " is-active" : "");
        b.textContent = `${m.name}=${m.value}`;
        b.addEventListener("click", () => {
          state.enumSel = i;
          state.lastAction = "enum-pick";
          pushLog("run", `# st → ${m.name}`);
          renderAll();
        });
        row.appendChild(b);
      });
      viewBody.appendChild(row);
    } else if (state.mode === "packed") {
      const layout = packedLayout();
      const total = packedTotal();
      const bar = document.createElement("div");
      bar.className = "layout-bar";
      layout.forEach((f, i) => {
        const d = document.createElement("div");
        d.className = "field";
        d.style.flex = String(f.width);
        d.style.background = COLORS[i % COLORS.length];
        d.textContent = `${f.name}[${f.hi}:${f.lo}]`;
        bar.appendChild(d);
      });
      viewBody.appendChild(bar);
      const note = document.createElement("p");
      note.className = "legend";
      note.textContent = `MSB left · total ${total} bits · assignable as logic [${total - 1}:0]`;
      viewBody.appendChild(note);
    } else if (state.mode === "unpacked") {
      const list = document.createElement("div");
      list.className = "unpacked-list";
      PACKED_FIELDS.forEach((f) => {
        const d = document.createElement("div");
        d.className = "field";
        d.textContent = `u.${f.name}  // ${f.width}-bit member (separate)`;
        list.appendChild(d);
      });
      viewBody.appendChild(list);
      const note = document.createElement("p");
      note.className = "legend";
      note.textContent =
        "No single bit range — cannot assign the whole struct as one vector.";
      viewBody.appendChild(note);
    } else {
      const note = document.createElement("p");
      note.className = "legend";
      note.textContent =
        "typedef only names types. Storage appears when you declare a variable.";
      viewBody.appendChild(note);
    }
  }

  function renderDetails() {
    if (state.mode === "enum") {
      const mem = enumMembers();
      const m = mem[state.enumSel] || mem[0];
      const w = enumWidth(mem);
      sumVal.textContent = `${m.name} → ${m.value}`;
      widthVal.textContent = `logic [${w - 1}:0]`;
      let html =
        "<table class='tt'><thead><tr><th>name</th><th>value</th></tr></thead><tbody>";
      mem.forEach((e, i) => {
        html += `<tr class="${i === state.enumSel ? "is-active" : ""}"><td>${e.name}</td><td>${e.value}</td></tr>`;
      });
      html += "</tbody></table>";
      detailTable.innerHTML = html;
    } else if (state.mode === "packed") {
      const layout = packedLayout();
      sumVal.textContent = "pkt_t packed";
      widthVal.textContent = `${packedTotal()} bits`;
      let html =
        "<table class='tt'><thead><tr><th>field</th><th>bits</th></tr></thead><tbody>";
      layout.forEach((f) => {
        html += `<tr><td>${f.name}</td><td>[${f.hi}:${f.lo}]</td></tr>`;
      });
      html += "</tbody></table>";
      detailTable.innerHTML = html;
    } else if (state.mode === "unpacked") {
      sumVal.textContent = "pkt_u unpacked";
      widthVal.textContent = "not a vector";
      detailTable.innerHTML =
        "<p class='legend'>Members: valid, opcode, data — three objects.</p>";
    } else {
      sumVal.textContent = "byte_t / bus_t";
      widthVal.textContent = "bus_t = 32 bits";
      detailTable.innerHTML =
        "<p class='legend'><code>bus_t</code> = 4× <code>byte_t</code> packed array sketch.</p>";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(change view or explain)</span>';
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
    enumStyle.value = state.enumStyle;
    enumStyleWrap.style.display =
      state.mode === "enum" ? "" : "none";
    if (state.mode === "typedef")
      modeLegend.textContent = "Aliases improve readability and portability.";
    else if (state.mode === "enum")
      modeLegend.textContent =
        "Click a label to select. Auto vs explicit encodings.";
    else if (state.mode === "packed")
      modeLegend.textContent =
        "First field in the struct is the MSB of the vector.";
    else
      modeLegend.textContent =
        "Unpacked structs group names without bit packing.";
    codeBox.textContent = sourceCode();
    renderView();
    renderDetails();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter enum IDLE..DONE");
    state.trace = [];
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    if (state.mode === "enum") {
      const mem = enumMembers();
      const m = mem[state.enumSel];
      state.trace = [
        { kind: "muted", text: "enum encoding" },
        {
          kind: "hi",
          text: `${m.name} encodes as ${m.value} on ${enumWidth(mem)} bits`,
        },
        {
          kind: "ok",
          text:
            state.enumStyle === "auto"
              ? "auto: next label = previous + 1"
              : "explicit: you may leave gaps (RUN=4)",
        },
      ];
    } else if (state.mode === "packed") {
      state.trace = [
        { kind: "muted", text: "packed layout" },
        { kind: "hi", text: "valid is MSB; data is LSB field" },
        {
          kind: "ok",
          text: `p ≡ logic [${packedTotal() - 1}:0] — whole-struct assign OK`,
        },
      ];
    } else if (state.mode === "unpacked") {
      state.trace = [
        { kind: "muted", text: "unpacked layout" },
        { kind: "warn", text: "no contiguous bit vector for the struct" },
        { kind: "ok", text: "assign field-by-field: u.valid = 1'b1;" },
      ];
    } else {
      state.trace = [
        { kind: "muted", text: "typedef" },
        { kind: "hi", text: "byte_t names logic [7:0]" },
        { kind: "ok", text: "bus_t reuses byte_t — still just a type name" },
      ];
    }
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("td-starter").addEventListener("click", loadStarter);
  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "packed") state.setPacked = true;
    if (state.mode === "unpacked") state.setUnpacked = true;
    if (state.mode === "typedef") state.setTypedef = true;
    state.lastAction = "mode";
    pushLog("run", `# view → ${state.mode}`);
    renderAll();
  });
  enumStyle.addEventListener("change", () => {
    state.enumStyle = enumStyle.value;
    if (state.enumStyle === "explicit") state.setExplicit = true;
    state.enumSel = 0;
    state.lastAction = "enum-style";
    pushLog("run", `# enum style → ${state.enumStyle}`);
    renderAll();
  });
  document.getElementById("btn-enum").addEventListener("click", () => {
    state.mode = "enum";
    state.enumStyle = "auto";
    state.enumSel = 0;
    state.lastAction = "preset-enum";
    pushLog("ok", "# preset auto enum");
    renderAll();
  });
  document.getElementById("btn-explicit").addEventListener("click", () => {
    state.mode = "enum";
    state.enumStyle = "explicit";
    state.setExplicit = true;
    state.enumSel = 2; // RUN=4
    state.lastAction = "preset-explicit";
    pushLog("ok", "# preset explicit enum");
    renderAll();
  });
  document.getElementById("btn-packed").addEventListener("click", () => {
    state.mode = "packed";
    state.setPacked = true;
    state.lastAction = "preset-packed";
    pushLog("ok", "# preset packed");
    renderAll();
  });
  document.getElementById("btn-unpacked").addEventListener("click", () => {
    state.mode = "unpacked";
    state.setUnpacked = true;
    state.lastAction = "preset-unpacked";
    pushLog("ok", "# preset unpacked");
    renderAll();
  });
  document.getElementById("btn-typedef").addEventListener("click", () => {
    state.mode = "typedef";
    state.setTypedef = true;
    state.lastAction = "preset-typedef";
    pushLog("ok", "# typedef view");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-typedef",
      title: "Quiz: typedef",
      prompt: "Keyword that aliases a type? Answer: <code>typedef</code>",
      hint: "type name",
      type: "text",
      answer: "typedef",
      alt: ["type def", "type"],
    },
    {
      id: "quiz-enum",
      title: "Quiz: enum",
      prompt: "Named integral encodings use? Answer: <code>enum</code>",
      hint: "state labels",
      type: "text",
      answer: "enum",
      alt: ["enumeration"],
    },
    {
      id: "quiz-packed",
      title: "Quiz: packed",
      prompt: "Contiguous bit struct is declared? Answer: <code>packed</code>",
      hint: "struct packed",
      type: "text",
      answer: "packed",
      alt: ["struct packed", "packed struct"],
    },
    {
      id: "quiz-msb",
      title: "Quiz: MSB",
      prompt: "In a packed struct, the first field is the? Answer: <code>MSB</code>",
      hint: "default SV packing",
      type: "text",
      answer: "msb",
      alt: ["MSB", "most significant", "left"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — auto enum, IDLE selected.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enum" &&
        state.enumStyle === "auto" &&
        state.enumSel === 0 &&
        enumMembers()[0].value === 0,
    },
    {
      id: "enum-done",
      title: "Select DONE",
      prompt: "On auto enum, select DONE (value 3).",
      hint: "Click DONE=3",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enum" &&
        state.enumStyle === "auto" &&
        state.enumSel === 3 &&
        enumMembers()[3].value === 3,
    },
    {
      id: "enum-width",
      title: "Enum width",
      prompt: "Auto enum 0..3 fits in how many bits? Answer: <code>2</code>",
      hint: "logic [1:0]",
      type: "text",
      answer: "2",
      alt: ["two"],
    },
    {
      id: "explicit",
      title: "Explicit",
      prompt: "Preset explicit enum — RUN value is 4.",
      hint: "Preset explicit enum",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setExplicit &&
        state.enumStyle === "explicit" &&
        ENUM_EXPLICIT[2].value === 4 &&
        state.enumSel === 2,
    },
    {
      id: "explicit-width",
      title: "Explicit width",
      prompt: "Explicit enum max 5 needs how many bits? Answer: <code>3</code>",
      hint: "ceil log2(6)",
      type: "text",
      answer: "3",
      alt: ["three"],
    },
    {
      id: "packed-preset",
      title: "Packed",
      prompt: "Preset packed packet — total width 12.",
      hint: "Preset packed packet",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setPacked &&
        state.mode === "packed" &&
        packedTotal() === 12,
    },
    {
      id: "packed-valid-msb",
      title: "valid MSB",
      prompt: "On packed view, valid occupies bit [11].",
      hint: "Preset packed — check table",
      type: "state",
      setup: () => {
        state.mode = "packed";
        state.setPacked = true;
        renderAll();
      },
      check: () => {
        const v = packedLayout().find((f) => f.name === "valid");
        return state.mode === "packed" && v && v.hi === 11 && v.lo === 11;
      },
    },
    {
      id: "packed-data-lsb",
      title: "data LSB",
      prompt: "Packed data field is [7:0].",
      hint: "packed layout table",
      type: "state",
      setup: () => {
        state.mode = "packed";
        renderAll();
      },
      check: () => {
        const d = packedLayout().find((f) => f.name === "data");
        return d && d.hi === 7 && d.lo === 0;
      },
    },
    {
      id: "unpacked",
      title: "Unpacked",
      prompt: "Preset unpacked fields view.",
      hint: "Preset unpacked fields",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setUnpacked && state.mode === "unpacked",
    },
    {
      id: "typedef-view",
      title: "typedef",
      prompt: "Show typedef bus_t view.",
      hint: "Show typedef bus_t",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setTypedef && state.mode === "typedef",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain layout.",
      hint: "Explain layout",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "quiz-unpacked",
      title: "Quiz: unpacked",
      prompt: "Unpacked struct is one bit vector? Answer: <code>no</code>",
      hint: "separate members",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "mode-packed",
      title: "Mode packed",
      prompt: "Switch View dropdown to packed struct.",
      hint: "View select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "packed" && state.lastAction === "mode",
    },
    {
      id: "quiz-storage",
      title: "Quiz: storage",
      prompt: "Does typedef alone allocate storage? Answer: <code>no</code>",
      hint: "need a variable",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "opcode-bits",
      title: "opcode width",
      prompt: "Packed opcode field width? Answer: <code>3</code>",
      hint: "logic [2:0]",
      type: "text",
      answer: "3",
      alt: ["three", "[2:0]"],
    },
    {
      id: "idle-zero",
      title: "IDLE=0",
      prompt: "Auto enum IDLE value is 0.",
      hint: "starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enum" &&
        state.enumStyle === "auto" &&
        ENUM_AUTO[0].value === 0,
    },
    {
      id: "gap",
      title: "Gap",
      prompt: "Explicit style has a gap between LOAD=1 and RUN=4.",
      hint: "Preset explicit",
      type: "state",
      setup: () => {
        document.getElementById("btn-explicit").click();
      },
      check: () =>
        state.enumStyle === "explicit" &&
        ENUM_EXPLICIT[1].value === 1 &&
        ENUM_EXPLICIT[2].value === 4,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter enum → packed preset → explain.",
      hint: "Load → Preset packed → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "packed" &&
        state.setPacked &&
        state.explained &&
        state.lastAction === "explain" &&
        packedTotal() === 12,
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
