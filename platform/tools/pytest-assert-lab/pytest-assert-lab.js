(() => {
  /**
   * pytest assert / golden (concept)
   *   expected vs actual hex/int compare
   * Starter: 0xA5 == 0xA5 → PASS
   */

  const IDEAS = {
    golden: "Golden / expected is the known-good reference you compare against.",
    assert: "assert expected == actual — pytest raises AssertionError on mismatch.",
    hex: "Hex literals are case-insensitive: 0xA5 and 0xa5 are the same byte.",
    debug: "0xA5 vs 0x5A often hints at endian or bit-order confusion.",
  };

  const PRESETS = {
    starter: {
      label: "starter: 0xA5 == 0xA5",
      expect: "0xA5",
      actual: "0xA5",
      note: "Both sides match — Run assert → PASS.",
      autoRun: true,
    },
    mismatch: {
      label: "mismatch: 0xA5 vs 0x5A",
      expect: "0xA5",
      actual: "0x5A",
      note: "Same nybbles reversed — Run assert → FAIL.",
      autoRun: true,
    },
    case_mix: {
      label: "case mix: 0xa5 vs 0xA5",
      expect: "0xa5",
      actual: "0xA5",
      note: "Case-insensitive hex compare → PASS.",
      autoRun: true,
    },
    decimal: {
      label: "decimal 165 vs 0xA5",
      expect: "165",
      actual: "0xA5",
      note: "Int parse: 165 == 0xA5 → PASS.",
      autoRun: true,
    },
    ff_zero: {
      label: "0xFF vs 0x00",
      expect: "0xFF",
      actual: "0x00",
      note: "All ones vs all zeros — FAIL.",
      autoRun: true,
    },
    invalid: {
      label: "invalid hex",
      expect: "0xZZ",
      actual: "0xA5",
      note: "Bad literal — Run assert → ERROR.",
      autoRun: true,
    },
    idle: {
      label: "idle",
      expect: "0xA5",
      actual: "0xA5",
      note: "Idle — Load preset or edit values, then Run assert.",
      autoRun: false,
    },
  };

  function parseValue(s) {
    const t = String(s).trim();
    if (!t) return { ok: false, err: "empty" };
    if (/^0x[0-9a-fA-F]+$/.test(t)) {
      const n = parseInt(t.slice(2), 16);
      return { ok: true, n, raw: t, kind: "hex" };
    }
    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      return { ok: true, n, raw: t, kind: "int" };
    }
    return { ok: false, err: "invalid literal" };
  }

  function normHex(s) {
    return String(s).trim().toLowerCase().replace(/^0x/, "");
  }

  function hexDisplay(n) {
    return "0x" + (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function evaluate(expectStr, actualStr) {
    const e = parseValue(expectStr);
    const a = parseValue(actualStr);
    if (!e.ok || !a.ok) {
      return {
        verdict: "ERROR",
        match: false,
        message: `Invalid literal: expect=${expectStr} actual=${actualStr}`,
        expectNum: e.ok ? e.n : null,
        actualNum: a.ok ? a.n : null,
      };
    }
    const hexMatch = normHex(expectStr) === normHex(actualStr);
    const intMatch = e.n === a.n;
    const match = hexMatch || intMatch;
    return {
      verdict: match ? "PASS" : "FAIL",
      match,
      message: match
        ? `expect ${expectStr} == actual ${actualStr}`
        : `AssertionError: expected ${expectStr}, got ${actualStr}`,
      expectNum: e.n,
      actualNum: a.n,
      expectKind: e.kind,
      actualKind: a.kind,
    };
  }

  function sourceSketch() {
    return `# pytest assert literacy (not a live pytest run)
# def test_read_byte(dut):
#     actual = dut.read()          # observed
#     expected = 0xA5              # golden reference
#     assert actual == expected    # FAIL → AssertionError
#
# Golden check  → compare DUT output to known-good value
# assert        → stops test on mismatch (pytest marks FAILED)
# Hex literals  → 0xA5 == 0xa5 (case-insensitive digits)
# Debug tip     → 0xA5 vs 0x5A often means byte/bit order mix-up
#
# Browser lab compares literals; real runs use local pytest + simulator.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.expect, p.actual);
    return {
      preset: "starter",
      expect: p.expect,
      actual: p.actual,
      note: p.note,
      selected: "golden",
      verdict: ev.verdict,
      match: ev.match,
      message: ev.message,
      expectNum: ev.expectNum,
      actualNum: ev.actualNum,
      ran: true,
      lastRun: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`run: verdict=${ev.verdict} expect=${p.expect} actual=${p.actual}`],
    };
  }

  const CLEARED_KEY = "ddv-pytest-assert-lab-cleared-v1";
  const STORE_KEY = "ddv-pytest-assert-lab-session-v1";

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

  const root = document.getElementById("pal-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        expect and actual both <code>0xA5</code> —
        Run assert → <strong>PASS</strong>.
        Try preset <em>mismatch</em> for <code>0xA5</code> vs <code>0x5A</code>.</p>
      <button type="button" class="btn btn-secondary" id="pal-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Golden check</h3><p>Compare DUT output to a known-good expected value.</p></div>
        <div class="idea-card"><h3>assert</h3><p>pytest stops the test on mismatch with AssertionError.</p></div>
        <div class="idea-card"><h3>Hex literals</h3><p>0xA5 and 0xa5 are the same byte — compare is case-insensitive.</p></div>
        <div class="idea-card"><h3>Debug hint</h3><p>Mismatch 0xA5 vs 0x5A often means endian or bit-order confusion.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="pal-controls">
        <div class="pal-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>0xA5 == 0xA5</option>
            <option value="mismatch">0xA5 vs 0x5A</option>
            <option value="case_mix">case mix</option>
            <option value="decimal">165 vs 0xA5</option>
            <option value="ff_zero">0xFF vs 0x00</option>
            <option value="invalid">invalid hex</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-run">Run assert</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div class="pal-input-row">
        <div class="pal-field">
          <label for="inp-expect">expect</label>
          <input id="inp-expect" type="text" spellcheck="false" autocomplete="off">
        </div>
        <div class="pal-field">
          <label for="inp-actual">actual</label>
          <input id="inp-actual" type="text" spellcheck="false" autocomplete="off">
        </div>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="compare-row" id="compare-row"></div>
      <div class="pal-layout">
        <div class="panel-box">
          <h3>Compare sketch</h3>
          <div class="idea-row" id="idea-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Run sketch</h3>
          <pre class="run-box" id="run-box"></pre>
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
  const inpExpect = /** @type {HTMLInputElement} */ (document.getElementById("inp-expect"));
  const inpActual = /** @type {HTMLInputElement} */ (document.getElementById("inp-actual"));

  function runSketch() {
    return `# assert ${state.expect} == ${state.actual}
#
# verdict: ${state.lastRun ? state.verdict : "— (Run assert)"}
# match:   ${state.lastRun ? (state.match ? "yes" : "no") : "—"}
# expect#: ${state.lastRun && state.expectNum != null ? hexDisplay(state.expectNum) + " (" + state.expectNum + ")" : "—"}
# actual#: ${state.lastRun && state.actualNum != null ? hexDisplay(state.actualNum) + " (" + state.actualNum + ")" : "—"}`;
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
    if (document.activeElement !== inpExpect) inpExpect.value = state.expect;
    if (document.activeElement !== inpActual) inpActual.value = state.actual;
  }

  function applyEval() {
    const ev = evaluate(state.expect, state.actual);
    state.verdict = ev.verdict;
    state.match = ev.match;
    state.message = ev.message;
    state.expectNum = ev.expectNum;
    state.actualNum = ev.actualNum;
    state.ran = true;
    state.lastRun = true;
  }

  function readInputs() {
    state.expect = inpExpect.value;
    state.actual = inpActual.value;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter 0xA5 == 0xA5 PASS");
    renderAll();
  }

  function runAssert(mark) {
    readInputs();
    applyEval();
    pushTrace(`run: verdict=${state.verdict} expect=${state.expect} actual=${state.actual}`);
    if (mark) state.lastAction = mark;
    else state.lastAction = state.match ? "run-ok" : state.verdict === "ERROR" ? "run-err" : "run-bad";
    pushLog(`# run ${state.verdict}: ${state.message}`);
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.expect = p.expect;
    state.actual = p.actual;
    state.note = p.note;
    state.verdict = "—";
    state.match = false;
    state.message = "";
    state.ran = false;
    state.lastRun = false;
    syncInputs();
    if (p.autoRun) {
      applyEval();
      pushTrace(`preset ${id}: verdict=${state.verdict}`);
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
    applyPreset("mismatch", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo mismatch 0xA5 vs 0x5A FAIL");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: golden check compares expected vs actual; " +
        "hex is case-insensitive; 0xA5 vs 0x5A hints bit-order bugs."
    );
    renderAll();
  }

  function selectIdea(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderCompareCards() {
    const row = document.getElementById("compare-row");
    if (!state.lastRun) {
      row.innerHTML = `
        <div class="value-card"><h4>expect</h4><p class="val">${state.expect}</p><p class="sub">(Run assert)</p></div>
        <div class="compare-op"><span class="op">==</span><span class="result-badge idle">—</span></div>
        <div class="value-card"><h4>actual</h4><p class="val">${state.actual}</p><p class="sub">(Run assert)</p></div>`;
      return;
    }
    const cls = state.match ? "is-match" : state.verdict === "ERROR" ? "" : "is-mismatch";
    const badgeCls = state.verdict === "PASS" ? "pass" : state.verdict === "FAIL" ? "fail" : "idle";
    const subE =
      state.expectNum != null ? `${hexDisplay(state.expectNum)} (${state.expectNum})` : "invalid";
    const subA =
      state.actualNum != null ? `${hexDisplay(state.actualNum)} (${state.actualNum})` : "invalid";
    row.innerHTML = `
      <div class="value-card ${state.match ? "is-match" : cls}">
        <h4>expect</h4>
        <p class="val">${state.expect}</p>
        <p class="sub">${subE}</p>
      </div>
      <div class="compare-op">
        <span class="op">==</span>
        <span class="result-badge ${badgeCls}">${state.verdict}</span>
      </div>
      <div class="value-card ${state.match ? "is-match" : cls}">
        <h4>actual</h4>
        <p class="val">${state.actual}</p>
        <p class="sub">${subA}</p>
      </div>`;
  }

  function renderLab() {
    syncInputs();

    document.getElementById("idea-row").innerHTML = Object.entries(IDEAS)
      .map(
        ([id, blurb]) => `
      <button type="button" class="idea-btn ${state.selected === id ? "is-sel" : ""}" data-idea="${id}">
        <div class="k">${id}</div>
        <div class="v">${id === "assert" ? "assert ==" : id === "golden" ? "expected" : id}</div>
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
      IDEAS[state.selected] || IDEAS.golden;
    document.getElementById("run-box").textContent = runSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    renderCompareCards();

    const v = document.getElementById("verdict");
    if (!state.lastRun) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Run assert";
    } else if (state.verdict === "PASS") {
      v.className = "verdict yes";
      v.textContent = `PASS — ${state.message}`;
    } else if (state.verdict === "ERROR") {
      v.className = "verdict warn";
      v.textContent = `ERROR — ${state.message}`;
    } else {
      v.className = "verdict no";
      v.textContent = `FAIL — ${state.message}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.lastRun ? (state.match ? "is-ok" : "is-bad") : ""}">match=${state.lastRun ? (state.match ? 1 : 0) : "—"}</span>
      <span class="flag is-ok">expect=${state.expect}</span>
      <span class="flag is-ok">actual=${state.actual}</span>
      <span class="flag ${state.verdict === "PASS" ? "is-ok" : state.lastRun && state.verdict === "FAIL" ? "is-bad" : ""}">verdict=${state.lastRun ? state.verdict : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          expect: state.expect,
          actual: state.actual,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-assert",
      title: "Quiz: assert",
      type: "quiz",
      prompt: "pytest assert compares expected vs actual and raises…",
      hint: "Failed assert stops the test.",
      choices: [
        "AssertionError on mismatch",
        "SyntaxError always",
        "ImportError",
        "KeyboardInterrupt",
      ],
      answer: "AssertionError on mismatch",
    },
    {
      id: "quiz-golden",
      title: "Quiz: golden",
      type: "quiz",
      prompt: "A golden / reference value in HW tests is usually…",
      hint: "Compare DUT output to reference.",
      choices: [
        "known-good expected output",
        "random seed only",
        "synthesis constraint",
        "Git branch name",
      ],
      answer: "known-good expected output",
    },
    {
      id: "quiz-hex",
      title: "Quiz: hex case",
      type: "quiz",
      prompt: "0xA5 and 0xa5 represent the same byte because hex is…",
      hint: "Literals differ only by case.",
      choices: [
        "case-insensitive for digits A–F",
        "always signed",
        "BCD encoded",
        "vacuous",
      ],
      answer: "case-insensitive for digits A–F",
    },
    {
      id: "quiz-bitrev",
      title: "Quiz: 0xA5 vs 0x5A",
      type: "quiz",
      prompt: "0xA5 vs 0x5A often indicates…",
      hint: "Reversed nybbles/bytes.",
      choices: [
        "byte/bit order mix-up",
        "successful induction",
        "vacuous cover",
        "clock period 0",
      ],
      answer: "byte/bit order mix-up",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — Run assert PASS, both 0xA5.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.verdict === "PASS" &&
        normHex(state.expect) === "a5" &&
        normHex(state.actual) === "a5",
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load mismatch preset — FAIL, 0xA5 vs 0x5A.",
      hint: "mismatch → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.verdict === "FAIL" &&
        normHex(state.expect) === "a5" &&
        normHex(state.actual) === "5a",
    },
    {
      id: "load-case",
      title: "Load case mix",
      prompt: "Load case mix — PASS (0xa5 vs 0xA5).",
      hint: "case_mix → Load",
      setup: () => {
        selPreset.value = "case_mix";
        loadPreset();
      },
      check: () => state.verdict === "PASS" && state.match,
    },
    {
      id: "load-decimal",
      title: "Load decimal",
      prompt: "Load decimal preset — 165 vs 0xA5 PASS.",
      hint: "decimal → Load",
      setup: () => {
        selPreset.value = "decimal";
        loadPreset();
      },
      check: () => state.verdict === "PASS" && state.expect === "165",
    },
    {
      id: "load-ff",
      title: "Load 0xFF vs 0x00",
      prompt: "Load 0xFF vs 0x00 — FAIL.",
      hint: "ff_zero → Load",
      setup: () => {
        selPreset.value = "ff_zero";
        loadPreset();
      },
      check: () => state.verdict === "FAIL" && !state.match,
    },
    {
      id: "load-invalid",
      title: "Load invalid",
      prompt: "Load invalid hex — ERROR.",
      hint: "invalid → Load",
      setup: () => {
        selPreset.value = "invalid";
        loadPreset();
      },
      check: () => state.verdict === "ERROR",
    },
    {
      id: "run-ok",
      title: "Run OK",
      prompt: "From idle, Run assert — PASS.",
      hint: "idle → Run assert",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        runAssert("run-ok");
      },
      check: () =>
        state.verdict === "PASS" &&
        (state.lastAction === "run-ok" || state.lastAction === "load"),
    },
    {
      id: "run-bad",
      title: "Run FAIL",
      prompt: "Set expect 0xFF, actual 0x00, Run — FAIL.",
      hint: "Edit inputs then Run",
      setup: () => {
        loadStarter();
        inpExpect.value = "0xFF";
        inpActual.value = "0x00";
        runAssert("run-bad");
      },
      check: () => state.verdict === "FAIL" && state.lastAction === "run-bad",
    },
    {
      id: "demo",
      title: "Demo mismatch",
      prompt: "Click Demo mismatch — FAIL 0xA5 vs 0x5A.",
      hint: "Demo mismatch",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.verdict === "FAIL" &&
        state.lastAction === "demo",
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
      id: "select-hex",
      title: "Select hex",
      prompt: "Click the hex idea card.",
      hint: "Click hex",
      setup: () => {
        loadStarter();
        selectIdea("hex");
      },
      check: () => state.selected === "hex" && state.lastAction === "select",
    },
    {
      id: "select-debug",
      title: "Select debug",
      prompt: "Click the debug idea card.",
      hint: "Click debug",
      setup: () => {
        loadStarter();
        selectIdea("debug");
      },
      check: () => state.selected === "debug" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions assert or golden.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /assert|golden/i.test(sourceSketch()),
    },
    {
      id: "run-sketch",
      title: "Run sketch",
      prompt: "On starter, run sketch shows assert line.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /assert/.test(document.getElementById("run-box").textContent),
    },
    {
      id: "compare-cards",
      title: "Compare cards",
      prompt: "After starter, compare cards show PASS badge.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        document.querySelector(".result-badge.pass") !== null &&
        state.verdict === "PASS",
    },
    {
      id: "case-run",
      title: "Case run",
      prompt: "Set expect 0xa5, actual 0xA5, Run — PASS.",
      hint: "Lowercase vs uppercase",
      setup: () => {
        loadStarter();
        inpExpect.value = "0xa5";
        inpActual.value = "0xA5";
        runAssert("case-run");
      },
      check: () => state.verdict === "PASS" && state.lastAction === "case-run",
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet run.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () => !state.lastRun && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From mismatch, Reset — PASS again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.verdict === "PASS" &&
        state.match,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="pal-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("pal-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-run").addEventListener("click", () => runAssert(null));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  inpExpect.addEventListener("input", () => {
    state.expect = inpExpect.value;
    state.lastRun = false;
  });
  inpActual.addEventListener("input", () => {
    state.actual = inpActual.value;
    state.lastRun = false;
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
      if (saved && saved.expect) {
        state.expect = saved.expect;
        state.actual = saved.actual || "0xA5";
        state.preset = saved.preset || "starter";
        state.lastRun = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
