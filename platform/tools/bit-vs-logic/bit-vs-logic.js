(() => {
  /**
   * bit (2-state) vs logic (4-state):
   *   logic ∈ {0,1,X,Z} — RTL / nets that need unknowns & Hi-Z
   *   bit   ∈ {0,1}     — TB / DUT ports when you want speed & no X
   * Assigning X/Z into bit collapses to 0 (concept model; simulators warn).
   */

  const STATES = ["0", "1", "x", "z"];

  function makeStarter() {
    return {
      target: "logic", // logic | bit
      drive: "x", // 0 | 1 | x | z
      other: "1", // second operand for & / |
      lastAction: "",
      explained: false,
      assigned: false,
      showedProp: false,
      setBit: false,
      setLogic: false,
      droveXZ: false,
      log: [],
      trace: [],
    };
  }

  /** 4-state AND (concept table) */
  function and4(a, b) {
    if (a === "0" || b === "0") return "0";
    if (a === "1" && b === "1") return "1";
    return "x";
  }

  /** 4-state OR (concept table) */
  function or4(a, b) {
    if (a === "1" || b === "1") return "1";
    if (a === "0" && b === "0") return "0";
    return "x";
  }

  /** Stored value after assign into target type */
  function stored(state) {
    if (state.target === "logic") return state.drive;
    // bit: X/Z → 0
    if (state.drive === "x" || state.drive === "z") return "0";
    return state.drive;
  }

  function collapsed(state) {
    return (
      state.target === "bit" &&
      (state.drive === "x" || state.drive === "z")
    );
  }

  function sourceCode(state) {
    const t = state.target;
    const d = state.drive;
    const lit =
      d === "x" ? "1'bx" : d === "z" ? "1'bz" : `1'b${d}`;
    const s = stored(state);
    const note = collapsed(state)
      ? `// bit cannot hold ${d.toUpperCase()} → stores 0`
      : `// ${t} holds ${s.toUpperCase()}`;
    return `${t} a, b, y;
initial begin
  a = ${lit};  ${note}
  b = 1'b${state.other};
  y = a & b;   // → ${and4(s, state.other)}
  y = a | b;   // → ${or4(s, state.other)}
end`;
  }

  const CLEARED_KEY = "ddv-bit-vs-logic-cleared-v1";
  const STORE_KEY = "ddv-bit-vs-logic-session-v1";

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

  const root = document.getElementById("bl-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> drive <code>1'bx</code> into
        <code>logic a</code> (stays X) vs <code>bit a</code> (collapses to 0).
        Watch <code>&amp;</code> / <code>|</code> with a second operand.</p>
      <button type="button" class="btn btn-secondary" id="bl-starter">Load starter example</button>
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
            <h3>logic (4-state)</h3>
            <p>0, 1, X, Z — default for SV RTL nets / variables.</p>
          </div>
          <div class="idea-card">
            <h3>bit (2-state)</h3>
            <p>0, 1 only — common in testbenches; faster sims.</p>
          </div>
          <div class="idea-card">
            <h3>Collapse</h3>
            <p>X/Z into <code>bit</code> becomes 0 — bugs can hide.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Drive &amp; type</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Target type
              <select id="type-sel">
                <option value="logic" selected>logic (4-state)</option>
                <option value="bit">bit (2-state)</option>
              </select>
            </label>
            <label>Other operand (b)
              <select id="other-sel">
                <option value="0">0</option>
                <option value="1" selected>1</option>
                <option value="x">X</option>
                <option value="z">Z</option>
              </select>
            </label>
          </div>
          <p class="legend">Drive value into <code>a</code>:</p>
          <div class="state-pills" id="drive-pills"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-assign">Apply assign a = drive</button>
            <button type="button" id="btn-logic-x">Preset: logic ← X</button>
            <button type="button" id="btn-bit-x">Preset: bit ← X (collapse)</button>
            <button type="button" id="btn-logic-z">Preset: logic ← Z</button>
            <button type="button" id="btn-prop">Show &amp; / | propagation</button>
            <button type="button" id="btn-explain">Explain 2 vs 4 state</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Stored &amp; ops</h2></div>
        <div class="panel-body">
          <div class="values">
            <div class="val-card" id="card-stored">
              <h3>a after assign</h3>
              <p class="val" id="val-stored">—</p>
              <p class="note" id="note-stored"></p>
            </div>
            <div class="val-card" id="card-drive">
              <h3>Drive literal</h3>
              <p class="val" id="val-drive">—</p>
              <p class="note" id="note-drive"></p>
            </div>
          </div>
          <div class="prop-grid" id="prop-grid">
            <div class="prop-card">
              <div class="op">a &amp; b</div>
              <div id="prop-and">—</div>
            </div>
            <div class="prop-card">
              <div class="op">a | b</div>
              <div id="prop-or">—</div>
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
          <thead><tr><th>Type</th><th>States</th><th>Typical use</th></tr></thead>
          <tbody>
            <tr><td><code>logic</code></td><td>0 1 X Z</td><td>RTL nets, X-aware TB checks</td></tr>
            <tr><td><code>bit</code></td><td>0 1</td><td>TB stimulus / scoreboard speed</td></tr>
            <tr><td>Assign X→bit</td><td>→ 0</td><td>Can mask uninitialized bugs</td></tr>
            <tr><td>AND with 0</td><td>→ 0</td><td>X is masked on that path</td></tr>
            <tr><td>AND with 1</td><td>propagates X</td><td>Unknown stays visible on logic</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: logic←X stores X; bit←X stores 0.</li>
          <li>Prefer <code>logic</code> when you need to catch X; use <code>bit</code> when you intentionally ignore it.</li>
        </ul>
      </div>
    </div>
  `;

  const typeSel = document.getElementById("type-sel");
  const otherSel = document.getElementById("other-sel");
  const drivePills = document.getElementById("drive-pills");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardStored = document.getElementById("card-stored");
  const cardDrive = document.getElementById("card-drive");
  const valStored = document.getElementById("val-stored");
  const valDrive = document.getElementById("val-drive");
  const noteStored = document.getElementById("note-stored");
  const noteDrive = document.getElementById("note-drive");
  const propAnd = document.getElementById("prop-and");
  const propOr = document.getElementById("prop-or");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  STATES.forEach((v) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "state-pill";
    b.dataset.v = v;
    b.textContent = v.toUpperCase();
    b.addEventListener("click", () => {
      state.drive = v;
      if (v === "x" || v === "z") state.droveXZ = true;
      state.lastAction = "drive";
      pushLog("run", `# drive → ${v.toUpperCase()}`);
      renderAll();
    });
    drivePills.appendChild(b);
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

  function renderPills() {
    drivePills.querySelectorAll(".state-pill").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.v === state.drive);
    });
  }

  function renderValues() {
    const s = stored(state);
    valStored.textContent = s.toUpperCase();
    valDrive.textContent = state.drive.toUpperCase();
    noteDrive.textContent =
      state.drive === "x"
        ? "1'bx unknown"
        : state.drive === "z"
          ? "1'bz Hi-Z"
          : `1'b${state.drive}`;
    noteStored.textContent = collapsed(state)
      ? `collapsed from ${state.drive.toUpperCase()}`
      : `holds as ${state.target}`;

    cardStored.className = "val-card";
    cardDrive.className = "val-card";
    if (collapsed(state)) cardStored.classList.add("is-collapse");
    else if (s === "x") cardStored.classList.add("is-x");
    else if (s === "z") cardStored.classList.add("is-z");
    else if (state.assigned) cardStored.classList.add("is-ok");

    if (state.drive === "x") cardDrive.classList.add("is-x");
    else if (state.drive === "z") cardDrive.classList.add("is-z");

    propAnd.textContent = `${s.toUpperCase()} & ${state.other.toUpperCase()} = ${and4(s, state.other).toUpperCase()}`;
    propOr.textContent = `${s.toUpperCase()} | ${state.other.toUpperCase()} = ${or4(s, state.other).toUpperCase()}`;
  }

  function renderWarn() {
    if (collapsed(state)) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "2-state collapse: assigning X/Z to bit stores 0 — X bugs may be silent.";
    } else if (state.target === "logic" && (state.drive === "x" || state.drive === "z")) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "4-state: logic keeps X/Z so downstream & / | can still propagate unknowns.";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(assign, propagate, or explain)</span>';
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
    typeSel.value = state.target;
    otherSel.value = state.other;
  }

  function renderAll() {
    syncInputs();
    renderPills();
    codeBox.textContent = sourceCode(state);
    renderValues();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setLogic = true;
    pushLog("muted", "# starter logic ← X, b=1");
    state.trace = [];
    renderAll();
  }

  function doAssign() {
    state.assigned = true;
    state.lastAction = "assign";
    if (state.drive === "x" || state.drive === "z") state.droveXZ = true;
    const s = stored(state);
    state.trace = [
      { kind: "muted", text: `assign into ${state.target}` },
      {
        kind: collapsed(state) ? "warn" : "ok",
        text: collapsed(state)
          ? `a = 1'b${state.drive} → stored 0 (collapse)`
          : `a = 1'b${state.drive} → stored ${s.toUpperCase()}`,
      },
    ];
    pushLog(
      collapsed(state) ? "warn" : "ok",
      `# assign ${state.target} ← ${state.drive.toUpperCase()} → ${s.toUpperCase()}`
    );
    renderAll();
  }

  function showProp() {
    state.showedProp = true;
    state.assigned = true;
    state.lastAction = "prop";
    const s = stored(state);
    const aand = and4(s, state.other);
    const aor = or4(s, state.other);
    state.trace = [
      { kind: "muted", text: "propagation (concept)" },
      {
        kind: "hi",
        text: `a=${s.toUpperCase()}  b=${state.other.toUpperCase()}`,
      },
      { kind: "run", text: `a & b → ${aand.toUpperCase()}` },
      { kind: "run", text: `a | b → ${aor.toUpperCase()}` },
      {
        kind: s === "x" || s === "z" ? "warn" : "ok",
        text:
          s === "x" || s === "z"
            ? "unknown/Hi-Z still visible on this type"
            : "2-state path — no X left to propagate",
      },
    ];
    pushLog("ok", "# showed & / |");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "2-state vs 4-state" },
      { kind: "hi", text: "logic ∈ {0,1,X,Z} — keeps unknowns" },
      { kind: "hi", text: "bit ∈ {0,1} — X/Z → 0 on assign" },
      {
        kind: "warn",
        text: "Use logic when debugging X; bit when TB wants clean 0/1",
      },
      {
        kind: "ok",
        text: `now: ${state.target} drive ${state.drive.toUpperCase()} → store ${stored(state).toUpperCase()}`,
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("bl-starter").addEventListener("click", loadStarter);

  typeSel.addEventListener("change", () => {
    state.target = typeSel.value;
    if (state.target === "bit") state.setBit = true;
    if (state.target === "logic") state.setLogic = true;
    state.lastAction = "type";
    pushLog("run", `# type → ${state.target}`);
    renderAll();
  });

  otherSel.addEventListener("change", () => {
    state.other = otherSel.value;
    state.lastAction = "other";
    pushLog("run", `# b → ${state.other.toUpperCase()}`);
    renderAll();
  });

  document.getElementById("btn-assign").addEventListener("click", doAssign);

  document.getElementById("btn-logic-x").addEventListener("click", () => {
    state.target = "logic";
    state.drive = "x";
    state.other = "1";
    state.setLogic = true;
    state.droveXZ = true;
    state.assigned = true;
    state.lastAction = "preset-logic-x";
    pushLog("ok", "# preset logic ← X");
    doAssign();
    state.lastAction = "preset-logic-x";
    saveSession();
  });

  document.getElementById("btn-bit-x").addEventListener("click", () => {
    state.target = "bit";
    state.drive = "x";
    state.other = "1";
    state.setBit = true;
    state.droveXZ = true;
    state.assigned = true;
    state.lastAction = "preset-bit-x";
    pushLog("ok", "# preset bit ← X");
    doAssign();
    state.lastAction = "preset-bit-x";
    saveSession();
  });

  document.getElementById("btn-logic-z").addEventListener("click", () => {
    state.target = "logic";
    state.drive = "z";
    state.other = "1";
    state.setLogic = true;
    state.droveXZ = true;
    state.assigned = true;
    state.lastAction = "preset-logic-z";
    pushLog("ok", "# preset logic ← Z");
    doAssign();
    state.lastAction = "preset-logic-z";
    saveSession();
  });

  document.getElementById("btn-prop").addEventListener("click", showProp);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-logic",
      title: "Quiz: logic",
      prompt: "4-state SV type is? Answer: <code>logic</code>",
      hint: "0 1 X Z",
      type: "text",
      answer: "logic",
      alt: ["logic type"],
    },
    {
      id: "quiz-bit",
      title: "Quiz: bit",
      prompt: "2-state SV type is? Answer: <code>bit</code>",
      hint: "0 1 only",
      type: "text",
      answer: "bit",
      alt: ["bit type"],
    },
    {
      id: "quiz-4state",
      title: "Quiz: 4-state",
      prompt: "How many values can logic hold? Answer: <code>4</code>",
      hint: "0 1 X Z",
      type: "text",
      answer: "4",
      alt: ["four"],
    },
    {
      id: "quiz-2state",
      title: "Quiz: 2-state",
      prompt: "How many values can bit hold? Answer: <code>2</code>",
      hint: "0 1",
      type: "text",
      answer: "2",
      alt: ["two"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — logic target, drive X.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "logic" &&
        state.drive === "x" &&
        stored(state) === "x",
    },
    {
      id: "preset-logic-x",
      title: "logic ← X",
      prompt: "Preset: logic ← X — stored value X.",
      hint: "Preset: logic ← X",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "logic" &&
        state.drive === "x" &&
        stored(state) === "x" &&
        state.assigned,
    },
    {
      id: "preset-bit-x",
      title: "bit ← X",
      prompt: "Preset: bit ← X — stored value collapses to 0.",
      hint: "Preset: bit ← X (collapse)",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "bit" &&
        state.drive === "x" &&
        stored(state) === "0" &&
        collapsed(state) &&
        state.setBit,
    },
    {
      id: "preset-logic-z",
      title: "logic ← Z",
      prompt: "Preset: logic ← Z — stored Z.",
      hint: "Preset: logic ← Z",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "logic" &&
        state.drive === "z" &&
        stored(state) === "z",
    },
    {
      id: "assign",
      title: "Apply assign",
      prompt: "Click Apply assign a = drive (any drive).",
      hint: "Apply assign button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.assigned && state.lastAction === "assign",
    },
    {
      id: "prop",
      title: "Propagation",
      prompt: "Show & / | propagation.",
      hint: "Show & / | propagation",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.showedProp && state.lastAction === "prop",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain 2 vs 4 state.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "type-bit",
      title: "Type bit",
      prompt: "Switch Target type dropdown to bit.",
      hint: "Target type select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.target === "bit" && state.lastAction === "type",
    },
    {
      id: "and-x1",
      title: "AND X&1",
      prompt: "On logic←X with b=1, a&b must be X (after prop or assign).",
      hint: "Preset logic←X, b=1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "logic" &&
        state.drive === "x" &&
        state.other === "1" &&
        and4(stored(state), state.other) === "x",
    },
    {
      id: "and-bit-x",
      title: "AND after collapse",
      prompt: "bit←X then b=1: a&b is 0 (collapsed).",
      hint: "Preset bit←X",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "bit" &&
        state.drive === "x" &&
        state.other === "1" &&
        and4(stored(state), "1") === "0",
    },
    {
      id: "quiz-collapse",
      title: "Quiz: collapse",
      prompt: "X assigned to bit becomes? Answer: <code>0</code>",
      hint: "2-state collapse",
      type: "text",
      answer: "0",
      alt: ["zero", "'0", "1'b0"],
    },
    {
      id: "quiz-tb",
      title: "Quiz: TB",
      prompt: "Faster 2-state TB variables often use? Answer: <code>bit</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "bit",
      alt: ["bit type"],
    },
    {
      id: "quiz-rtl",
      title: "Quiz: RTL",
      prompt: "Default 4-state RTL type? Answer: <code>logic</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "logic",
      alt: ["logic type"],
    },
    {
      id: "warn-collapse",
      title: "Warn collapse",
      prompt: "With bit←X, warning box is visible.",
      hint: "Preset bit←X",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        collapsed(state) && !warnBox.classList.contains("hidden"),
    },
    {
      id: "drive-z",
      title: "Drive Z",
      prompt: "Select drive Z pill (on any type).",
      hint: "Z pill",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.drive === "z" && state.droveXZ,
    },
    {
      id: "or-1x",
      title: "OR 1|X",
      prompt: "logic a=1, b=X: a|b is 1.",
      hint: "Drive 1, set b to X",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "logic" &&
        state.drive === "1" &&
        state.other === "x" &&
        or4(stored(state), "x") === "1",
    },
    {
      id: "code-bit",
      title: "Code bit",
      prompt: "On bit target, source starts with <code>bit a</code>.",
      hint: "Switch to bit",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "bit" && sourceCode(state).startsWith("bit a"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → bit←X preset → explain.",
      hint: "Load → Preset bit←X → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.target === "bit" &&
        stored(state) === "0" &&
        collapsed(state) &&
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
