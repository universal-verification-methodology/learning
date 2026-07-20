(() => {
  /**
   * Stimulus as data (concept)
   *   Python list of {a,b,y} vectors checked against AND gate
   * Starter: 4 rows, Apply all → PASS
   */

  const STARTER_VECTORS = [
    { a: 0, b: 0, y: 0 },
    { a: 0, b: 1, y: 0 },
    { a: 1, b: 0, y: 0 },
    { a: 1, b: 1, y: 1 },
  ];

  const STARTER_JSON = JSON.stringify(STARTER_VECTORS, null, 2);

  const IDEAS = {
    vectors: "A list of dicts — each row is one stimulus/expect pair.",
    loop: "for v in vectors: drive inputs, compare outputs.",
    assert: "assert v['y'] == model(a,b) — fail fast on mismatch.",
    golden: "Golden vectors live in Python data, not ad-hoc poke calls.",
  };

  const PRESETS = {
    starter: {
      label: "starter: 4 AND rows PASS",
      jsonText: STARTER_JSON,
      note: "Four truth-table rows for AND — Apply all → PASS.",
      autoApply: true,
    },
    single_row: {
      label: "single row (1,1,1)",
      jsonText: JSON.stringify([{ a: 1, b: 1, y: 1 }], null, 2),
      note: "Minimal vector list — one row, PASS.",
      autoApply: true,
    },
    one_fail: {
      label: "one bad y (FAIL)",
      jsonText: JSON.stringify(
        [
          { a: 0, b: 0, y: 0 },
          { a: 1, b: 1, y: 0 },
        ],
        null,
        2
      ),
      note: "Second row y wrong — Apply all → FAIL.",
      autoApply: true,
    },
    xor_mismatch: {
      label: "XOR expectations (all FAIL)",
      jsonText: JSON.stringify(
        [
          { a: 0, b: 0, y: 0 },
          { a: 0, b: 1, y: 1 },
          { a: 1, b: 0, y: 1 },
          { a: 1, b: 1, y: 0 },
        ],
        null,
        2
      ),
      note: "XOR truth table checked against AND — every row FAIL.",
      autoApply: true,
    },
    empty: {
      label: "empty list",
      jsonText: "[]",
      note: "Empty vector list — Apply all → PASS (vacuous).",
      autoApply: true,
    },
    bad_json: {
      label: "invalid JSON",
      jsonText: "[{ a: 0 }]",
      note: "Malformed JSON — Apply all → ERROR.",
      autoApply: true,
    },
    idle: {
      label: "idle (edit then Apply)",
      jsonText: STARTER_JSON,
      note: "Idle — Load a preset or edit JSON, then Apply all.",
      autoApply: false,
    },
  };

  function sourceSketch() {
    return `# Stimulus-as-data literacy (not a live cocotb run)
# vectors = [
#     {"a": 0, "b": 0, "y": 0},
#     {"a": 0, "b": 1, "y": 0},
#     {"a": 1, "b": 0, "y": 0},
#     {"a": 1, "b": 1, "y": 1},
# ]
# for v in vectors:
#     dut.a.value = v["a"]
#     dut.b.value = v["b"]
#     await RisingEdge(dut.clk)
#     assert int(dut.y.value) == v["y"]
#
# vectors  → structured stimulus + expected outputs
# loop     → replay every row the same way
# assert   → golden check per row
# data     → easier to review than scattered poke calls`;
  }

  function parseVectors(text) {
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) return { ok: false, err: "Root must be a JSON array" };
      return { ok: true, vectors: arr };
    } catch (e) {
      return { ok: false, err: String(e.message || e) };
    }
  }

  function applyAll(vectors) {
    const rows = [];
    let allPass = true;
    for (let i = 0; i < vectors.length; i++) {
      const v = vectors[i];
      const a = Number(v.a) & 1;
      const b = Number(v.b) & 1;
      const expect = a & b;
      const y = Number(v.y) & 1;
      const pass = y === expect;
      if (!pass) allPass = false;
      rows.push({ i, a, b, y, expect, pass });
    }
    return {
      rows,
      verdict: vectors.length === 0 ? "PASS" : allPass ? "PASS" : "FAIL",
      count: vectors.length,
      passCount: rows.filter((r) => r.pass).length,
      failCount: rows.filter((r) => !r.pass).length,
    };
  }

  function evaluate(jsonText) {
    const parsed = parseVectors(jsonText);
    if (!parsed.ok) {
      return {
        ok: false,
        error: parsed.err,
        rows: [],
        verdict: "ERROR",
        count: 0,
        passCount: 0,
        failCount: 0,
      };
    }
    const r = applyAll(parsed.vectors);
    return { ok: true, error: "", ...r };
  }

  function makeStarter() {
    const ev = evaluate(STARTER_JSON);
    return {
      preset: "starter",
      jsonText: STARTER_JSON,
      note: PRESETS.starter.note,
      selected: "vectors",
      rows: ev.rows,
      verdict: ev.verdict,
      count: ev.count,
      passCount: ev.passCount,
      failCount: ev.failCount,
      error: ev.error,
      lastApplied: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`apply: verdict=${ev.verdict} rows=${ev.count}`],
    };
  }

  const CLEARED_KEY = "ddv-stim-as-data-cleared-v1";
  const STORE_KEY = "ddv-stim-as-data-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let quizChoice = "";
  let state = makeStarter();

  const root = document.getElementById("sad-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        four AND-gate rows in JSON —
        <code>Apply all</code> → PASS with per-row ✓.</p>
      <button type="button" class="btn btn-secondary" id="sad-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions" id="chal-quiz" hidden></div>
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
      <div class="idea-grid">
        <div class="idea-card"><h3>vectors</h3><p>List of dict rows — stimulus + expect.</p></div>
        <div class="idea-card"><h3>loop</h3><p>Same drive/compare pattern every row.</p></div>
        <div class="idea-card"><h3>assert</h3><p>Golden check — fail on first mismatch.</p></div>
        <div class="idea-card"><h3>data</h3><p>Reviewable table, not scattered pokes.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="sad-controls">
        <div class="sad-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>4 AND rows PASS</option>
            <option value="single_row">single row</option>
            <option value="one_fail">one bad y</option>
            <option value="xor_mismatch">XOR expectations</option>
            <option value="empty">empty list</option>
            <option value="bad_json">invalid JSON</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-apply">Apply all</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo bad row</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="sad-layout">
        <div class="panel-box">
          <h3>Vector JSON (AND gate)</h3>
          <textarea class="sad-json" id="inp-json" spellcheck="false"></textarea>
          <h3>Result table</h3>
          <div id="table-wrap"></div>
          <h3>Ideas</h3>
          <div class="idea-row" id="idea-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Apply sketch</h3>
          <pre class="apply-box" id="apply-box"></pre>
        </div>
      </div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Literacy sketch</h3>
      <pre class="code-box" id="code-box"></pre>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Trace</h3>
        <pre class="trace-box" id="trace-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Log</h3>
        <pre class="log-box" id="log-box"></pre>
      </div>
    </div>
  `;

  const selPreset = /** @type {HTMLSelectElement} */ (document.getElementById("sel-preset"));
  const inpJson = /** @type {HTMLTextAreaElement} */ (document.getElementById("inp-json"));

  function applySketch() {
    return `# for v in vectors:  (${state.count} rows)
#     assert v["y"] == (v["a"] & v["b"])
#
# verdict: ${state.lastApplied ? state.verdict : "— (Apply all)"}
# pass:    ${state.lastApplied ? state.passCount : "—"} / ${state.lastApplied ? state.count : "—"}
# fail:    ${state.lastApplied ? state.failCount : "—"}
${state.error ? "# error: " + state.error : ""}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kindName, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kindName;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    if (document.activeElement !== inpJson) inpJson.value = state.jsonText;
  }

  function readJsonFromInput() {
    state.jsonText = inpJson.value;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter 4 AND rows PASS");
    renderAll();
  }

  function runApply(silent) {
    readJsonFromInput();
    const ev = evaluate(state.jsonText);
    state.rows = ev.rows;
    state.verdict = ev.verdict;
    state.count = ev.count;
    state.passCount = ev.passCount;
    state.failCount = ev.failCount;
    state.error = ev.error;
    state.lastApplied = true;
    pushTrace(
      `apply: verdict=${ev.verdict} rows=${ev.count} pass=${ev.passCount} fail=${ev.failCount}`
    );
    if (!silent) {
      state.lastAction = ev.verdict === "ERROR" ? "apply-error" : ev.verdict === "PASS" ? "apply-ok" : "apply-bad";
      pushLog(`# apply ${ev.verdict}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.jsonText = p.jsonText;
    state.note = p.note;
    state.lastApplied = false;
    state.rows = [];
    state.verdict = "—";
    state.count = 0;
    state.passCount = 0;
    state.failCount = 0;
    state.error = "";
    syncInputs();
    if (p.autoApply) {
      runApply(true);
      if (mark) state.lastAction = mark;
    } else if (mark) {
      state.lastAction = mark;
    }
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function demo() {
    const parsed = parseVectors(state.jsonText);
    let vecs = parsed.ok ? [...parsed.vectors] : [...STARTER_VECTORS];
    if (vecs.length) vecs[0] = { a: 1, b: 1, y: 0 };
    state.jsonText = JSON.stringify(vecs, null, 2);
    state.preset = "idle";
    state.demoed = true;
    runApply(true);
    state.lastAction = "demo";
    pushLog("# demo inserted bad row at index 0");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: vectors hold stimulus+expect; loop replays; assert checks golden AND model."
    );
    renderAll();
  }

  function selectIdea(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderTable() {
    const wrap = document.getElementById("table-wrap");
    if (!state.lastApplied || state.verdict === "ERROR") {
      wrap.innerHTML = `<div class="table-empty">${state.error || "(Apply all to build table)"}</div>`;
      return;
    }
    if (!state.rows.length) {
      wrap.innerHTML = `<div class="table-empty">Empty list — vacuous PASS (0 rows)</div>`;
      return;
    }
    wrap.innerHTML = `
      <table class="vector-table">
        <thead><tr><th>#</th><th>a</th><th>b</th><th>y</th><th>expect</th><th>result</th></tr></thead>
        <tbody>
          ${state.rows
            .map(
              (r) => `
            <tr class="${r.pass ? "is-pass" : "is-fail"}">
              <td>${r.i}</td><td>${r.a}</td><td>${r.b}</td><td>${r.y}</td><td>${r.expect}</td>
              <td><span class="row-tag ${r.pass ? "pass" : "fail"}">${r.pass ? "PASS" : "FAIL"}</span></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderLab() {
    syncInputs();
    renderTable();

    document.getElementById("idea-row").innerHTML = Object.entries(IDEAS)
      .map(
        ([id]) => `
      <button type="button" class="idea-btn ${state.selected === id ? "is-sel" : ""}" data-idea="${id}">
        <div class="k">${id}</div>
        <div class="v">${id === "vectors" ? "list[dict]" : id === "assert" ? "assert y" : id}</div>
      </button>`
      )
      .join("");
    document.querySelectorAll("[data-idea]").forEach((el) => {
      el.addEventListener("click", () =>
        selectIdea(/** @type {string} */ (el.getAttribute("data-idea")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      IDEAS[state.selected] || IDEAS.vectors;
    document.getElementById("apply-box").textContent = applySketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastApplied) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Apply all";
    } else if (state.verdict === "ERROR") {
      v.className = "verdict error";
      v.textContent = `ERROR — ${state.error}`;
    } else if (state.verdict === "PASS") {
      v.className = "verdict yes";
      v.textContent = `Apply PASS — ${state.passCount}/${state.count} rows OK`;
    } else {
      v.className = "verdict no";
      v.textContent = `Apply FAIL — ${state.failCount} row(s) mismatch`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">rows=${state.lastApplied ? state.count : "—"}</span>
      <span class="flag ${state.lastApplied && state.passCount === state.count ? "is-ok" : state.lastApplied ? "is-bad" : ""}">pass=${state.lastApplied ? state.passCount : "—"}</span>
      <span class="flag ${state.failCount ? "is-bad" : state.lastApplied ? "is-ok" : ""}">fail=${state.lastApplied ? state.failCount : "—"}</span>
      <span class="flag ${state.verdict === "PASS" && state.lastApplied ? "is-ok" : state.verdict === "FAIL" ? "is-bad" : ""}">verdict=${state.lastApplied ? state.verdict : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ preset: state.preset, jsonText: state.jsonText })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-vectors",
      title: "Quiz: vectors",
      type: "quiz",
      prompt: "Stimulus-as-data means…",
      hint: "List of rows.",
      choices: [
        "stimulus and expected outputs live in a structured list you loop over",
        "only waveform dumps define stimulus",
        "assert is replaced by print()",
        "vectors must be SystemVerilog packages",
      ],
      answer: "stimulus and expected outputs live in a structured list you loop over",
    },
    {
      id: "quiz-loop",
      title: "Quiz: loop",
      type: "quiz",
      prompt: "The for v in vectors loop…",
      hint: "Same pattern.",
      choices: [
        "replays the same drive/compare steps for every row",
        "runs only the first row",
        "compiles the DUT",
        "disables assertions",
      ],
      answer: "replays the same drive/compare steps for every row",
    },
    {
      id: "quiz-assert",
      title: "Quiz: assert",
      type: "quiz",
      prompt: "assert v['y'] == model(a,b)…",
      hint: "Golden check.",
      choices: [
        "fails the test when actual y does not match the golden expect",
        "silently ignores mismatches",
        "only works in C++ DPI",
        "replaces the clock generator",
      ],
      answer: "fails the test when actual y does not match the golden expect",
    },
    {
      id: "quiz-and",
      title: "Quiz: AND model",
      type: "quiz",
      prompt: "For AND gate rows, expect y equals…",
      hint: "Bitwise AND.",
      choices: ["a & b (both bits)", "a | b", "a ^ b", "always 1"],
      answer: "a & b (both bits)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — Apply PASS, 4 rows all ✓.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.verdict === "PASS" &&
        state.count === 4 &&
        state.failCount === 0,
    },
    {
      id: "load-single",
      title: "Load single row",
      prompt: "Load single row — 1 row PASS.",
      hint: "single row → Load",
      setup: () => {
        selPreset.value = "single_row";
        loadPreset();
      },
      check: () => state.count === 1 && state.verdict === "PASS",
    },
    {
      id: "load-fail",
      title: "Load one bad y",
      prompt: "Load one bad y — FAIL.",
      hint: "one bad y → Load",
      setup: () => {
        selPreset.value = "one_fail";
        loadPreset();
      },
      check: () => state.verdict === "FAIL" && state.failCount >= 1,
    },
    {
      id: "load-xor",
      title: "Load XOR mismatch",
      prompt: "Load XOR expectations — multiple FAIL rows.",
      hint: "XOR expectations → Load",
      setup: () => {
        selPreset.value = "xor_mismatch";
        loadPreset();
      },
      check: () => state.verdict === "FAIL" && state.failCount >= 2,
    },
    {
      id: "load-empty",
      title: "Load empty",
      prompt: "Load empty list — vacuous PASS.",
      hint: "empty list → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () => state.count === 0 && state.verdict === "PASS",
    },
    {
      id: "load-bad-json",
      title: "Load bad JSON",
      prompt: "Load invalid JSON — ERROR.",
      hint: "invalid JSON → Load",
      setup: () => {
        selPreset.value = "bad_json";
        loadPreset();
      },
      check: () => state.verdict === "ERROR" && state.error,
    },
    {
      id: "apply-ok",
      title: "Apply OK",
      prompt: "From idle, Apply all — PASS.",
      hint: "idle → Apply all",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        runApply(false);
      },
      check: () => state.lastAction === "apply-ok" && state.verdict === "PASS",
    },
    {
      id: "apply-bad",
      title: "Apply FAIL",
      prompt: "Demo bad row then check FAIL.",
      hint: "Demo bad row",
      setup: () => {
        loadStarter();
        demo();
      },
      check: () => state.demoed && state.verdict === "FAIL" && state.lastAction === "demo",
    },
    {
      id: "demo",
      title: "Demo bad row",
      prompt: "Click Demo bad row — FAIL at row 0.",
      hint: "Demo bad row",
      setup: () => loadStarter(),
      check: () => state.demoed && state.verdict === "FAIL",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Click Explain.",
      hint: "Explain",
      setup: () => loadStarter(),
      check: () => state.explained === true,
    },
    {
      id: "select-assert",
      title: "Select assert",
      prompt: "Click the assert idea card.",
      hint: "Click assert",
      setup: () => {
        loadStarter();
        selectIdea("assert");
      },
      check: () => state.selected === "assert" && state.lastAction === "select",
    },
    {
      id: "select-golden",
      title: "Select golden",
      prompt: "Click the golden idea card.",
      hint: "Click golden",
      setup: () => {
        loadStarter();
        selectIdea("golden");
      },
      check: () => state.selected === "golden" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions vectors and assert.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /vectors/.test(sourceSketch()) && /assert/.test(sourceSketch()),
    },
    {
      id: "apply-sketch",
      title: "Apply sketch",
      prompt: "On starter, apply sketch shows PASS verdict.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /verdict: PASS/.test(document.getElementById("apply-box").textContent),
    },
    {
      id: "table-pass",
      title: "Table all pass",
      prompt: "Starter table — 4 rows, all PASS tags.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.rows.length === 4 && state.rows.every((r) => r.pass),
    },
    {
      id: "row0",
      title: "Row 0 check",
      prompt: "Starter row 0: a=0 b=0 y=0 expect=0 PASS.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => {
        const r = state.rows[0];
        return r && r.a === 0 && r.b === 0 && r.y === 0 && r.pass;
      },
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet applied.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () => !state.lastApplied && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From one_fail, Reset — PASS again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "one_fail";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.verdict === "PASS" &&
        state.count === 4,
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent =
      `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint
      ? "Hide hint"
      : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "quiz") {
      ansRow.innerHTML = "";
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="sad-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
      ansRow.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = clearedIds.includes(c.id) ? `✓ ${i + 1}` : String(i + 1);
      b.style.opacity = i === challengeIdx ? "1" : "0.7";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        else renderAll();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("sad-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-apply").addEventListener("click", () => runApply(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    quizChoice = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    else renderAll();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else if (typeof ch.check === "function") ok = !!ch.check();
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds.push(ch.id);
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("ok", "Cleared");
    } else setChalStatus("bad", "Not yet");
    renderChallenge();
  });

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.jsonText) {
        state.jsonText = saved.jsonText;
        state.preset = saved.preset || "starter";
        state.lastApplied = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
