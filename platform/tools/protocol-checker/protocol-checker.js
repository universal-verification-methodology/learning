(() => {
  /**
   * Protocol checker sketch (concept)
   *   bus rules (passive) vs scoreboard (expect/actual)
   * Starter: valid∧ready, stable data — all rules PASS
   */

  const RULES = [
    {
      id: "HS",
      title: "handshake",
      blurb: "Do not drop valid while stalled waiting for ready.",
    },
    {
      id: "HOLD",
      title: "data hold",
      blurb: "While valid && !ready, data must not change.",
    },
    {
      id: "X",
      title: "no X when valid",
      blurb: "When valid is high, data must be known (not X).",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: clean beat PASS",
      valid: 1,
      ready: 1,
      data: "0xA5",
      prevData: "0xA5",
      stalled: false,
      note: "valid∧ready with stable data — checker PASS; sb would compare payload separately.",
      autoCheck: true,
    },
    drop_valid: {
      label: "drop valid before ready",
      valid: 0,
      ready: 0,
      data: "0xA5",
      prevData: "0xA5",
      stalled: true,
      note: "Was stalled then valid dropped without ready — HS fails.",
      autoCheck: true,
      force: { HS: false, HOLD: true, X: true },
    },
    data_change: {
      label: "data changes while stalled",
      valid: 1,
      ready: 0,
      data: "0x5A",
      prevData: "0xA5",
      stalled: true,
      note: "valid&&!ready but data changed — HOLD fails.",
      autoCheck: true,
    },
    data_x: {
      label: "X while valid",
      valid: 1,
      ready: 1,
      data: "X",
      prevData: "X",
      stalled: false,
      note: "valid with unknown data — X rule fails.",
      autoCheck: true,
    },
    idle: {
      label: "idle bus",
      valid: 0,
      ready: 1,
      data: "0x00",
      prevData: "0x00",
      stalled: false,
      note: "Idle — no transfer; checker quiet until you Check rules.",
      autoCheck: false,
    },
  };

  function sourceSketch() {
    return `// Protocol checker literacy (not a full assertion library)
// Checker  = passive: watches pins / handshake; flags RULE violations
// Scoreboard = transaction expect vs actual (payload / ordering)
//
// They answer different questions:
//   checker: "Was the bus legal?"
//   scoreboard: "Was the data correct?"
//
// Example rules (valid/ready):
//   HS   — do not drop valid while stalled for ready
//   HOLD — data stable while valid && !ready
//   X    — no X/Z on data when valid
//
// Bind / monitor samples each cycle; does not drive the DUT.`;
  }

  function makeStarter() {
    return {
      preset: "starter",
      valid: 1,
      ready: 1,
      data: "0xA5",
      prevData: "0xA5",
      stalled: false,
      note: PRESETS.starter.note,
      selected: "checker",
      results: { HS: true, HOLD: true, X: true },
      lastChecked: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      sbExpect: "0xA5",
      sbActual: "0xA5",
      sbOk: true,
      log: [],
      trace: ["check: HS=pass HOLD=pass X=pass"],
    };
  }

  const CLEARED_KEY = "ddv-protocol-checker-cleared-v1";
  const STORE_KEY = "ddv-protocol-checker-session-v1";

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

  const root = document.getElementById("pchk-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> clean handshake beat
        (<code>valid=1</code>, <code>ready=1</code>, data <code>0xA5</code>) —
        all protocol rules PASS.</p>
      <button type="button" class="btn btn-secondary" id="pchk-starter">Load starter example</button>
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
        <div class="idea-card"><h3>checker</h3><p>Passive bus-rule watch — legal vs illegal cycles.</p></div>
        <div class="idea-card"><h3>scoreboard</h3><p>Expect vs actual on transactions / payload.</p></div>
        <div class="idea-card"><h3>handshake</h3><p>valid∧ready defines a beat; hold while stalled.</p></div>
        <div class="idea-card"><h3>separate jobs</h3><p>Legal bus ≠ correct data — check both.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="pchk-controls">
        <div class="pchk-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>clean beat PASS</option>
            <option value="drop_valid">drop valid</option>
            <option value="data_change">data while stalled</option>
            <option value="data_x">X while valid</option>
            <option value="idle">idle bus</option>
          </select>
        </div>
        <div class="pchk-field">
          <label for="sel-valid">valid</label>
          <select id="sel-valid"><option value="0">0</option><option value="1">1</option></select>
        </div>
        <div class="pchk-field">
          <label for="sel-ready">ready</label>
          <select id="sel-ready"><option value="0">0</option><option value="1">1</option></select>
        </div>
        <div class="pchk-field">
          <label for="inp-data">data</label>
          <input id="inp-data" type="text" value="0xA5" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-eval">Check rules</button>
        <button type="button" class="btn btn-ghost" id="btn-sb">Compare sb</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo HOLD fail</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="pchk-layout">
        <div class="panel-box">
          <h3>Roles</h3>
          <div class="role-row" id="role-row"></div>
          <h3>Signals</h3>
          <div class="sig-row" id="sig-row"></div>
          <h3>Rules</h3>
          <div class="rule-list" id="rule-list"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Check sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:16rem"></pre>
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
  const selValid = /** @type {HTMLSelectElement} */ (document.getElementById("sel-valid"));
  const selReady = /** @type {HTMLSelectElement} */ (document.getElementById("sel-ready"));
  const inpData = /** @type {HTMLInputElement} */ (document.getElementById("inp-data"));

  function computeResults(force) {
    if (force) return { HS: !!force.HS, HOLD: !!force.HOLD, X: !!force.X };
    const valid = state.valid;
    const ready = state.ready;
    const data = String(state.data).trim();
    const prev = String(state.prevData).trim();
    let hold = true;
    if (valid && !ready) hold = data === prev;
    else if (state.stalled && !ready && data !== prev) hold = false;
    const xOk = !(valid && /^[XZ]$/i.test(data));
    const hsOk = !(state.stalled && !valid);
    return { HS: hsOk, HOLD: hold, X: xOk };
  }

  function allPass(r) {
    return !!(r.HS && r.HOLD && r.X);
  }

  function codeSketch() {
    const r = state.results;
    return `// signals: valid=${state.valid} ready=${state.ready} data=${state.data}
// prev_data=${state.prevData} stalled=${state.stalled ? 1 : 0}
//
// checker results:
//   HS   ${r.HS == null ? "—" : r.HS ? "PASS" : "FAIL"}
//   HOLD ${r.HOLD == null ? "—" : r.HOLD ? "PASS" : "FAIL"}
//   X    ${r.X == null ? "—" : r.X ? "PASS" : "FAIL"}
//
// scoreboard (separate job):
//   expect=${state.sbExpect} actual=${state.sbActual} → ${state.sbOk == null ? "—" : state.sbOk ? "MATCH" : "MISMATCH"}`;
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
    selValid.value = String(state.valid);
    selReady.value = String(state.ready);
    inpData.value = state.data;
  }

  function readInputs() {
    state.valid = Number(selValid.value);
    state.ready = Number(selReady.value);
    state.data = (inpData.value || "").trim() || "0x00";
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter clean beat PASS");
    renderAll();
  }

  function runCheck(silent, force) {
    readInputs();
    const r = computeResults(force);
    state.results = r;
    state.lastChecked = true;
    const line = `check: HS=${r.HS ? "pass" : "fail"} HOLD=${r.HOLD ? "pass" : "fail"} X=${r.X ? "pass" : "fail"}`;
    pushTrace(line);
    if (!silent) {
      state.lastAction = allPass(r) ? "check-pass" : "check-fail";
      pushLog(`# check ${allPass(r) ? "PASS" : "FAIL"}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.valid = p.valid;
    state.ready = p.ready;
    state.data = p.data;
    state.prevData = p.prevData;
    state.stalled = p.stalled;
    state.note = p.note;
    state.results = { HS: null, HOLD: null, X: null };
    state.lastChecked = false;
    state.sbOk = null;
    syncInputs();
    if (p.autoCheck) {
      runCheck(true, p.force);
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

  function compareSb() {
    readInputs();
    state.sbActual = state.data;
    state.sbOk = state.sbExpect === state.sbActual;
    state.lastAction = state.sbOk ? "sb-pass" : "sb-fail";
    pushLog(`# sb ${state.sbOk ? "MATCH" : "MISMATCH"} ${state.sbExpect} vs ${state.sbActual}`);
    pushTrace(`scoreboard expect=${state.sbExpect} actual=${state.sbActual}`);
    renderAll();
  }

  function demo() {
    applyPreset("data_change", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo HOLD fail");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: checker = legal bus rules (passive); " +
        "scoreboard = correct payload; both needed."
    );
    renderAll();
  }

  function selectRole(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  const SEL_BLURB = {
    checker:
      "Protocol checker: samples the bus, flags rule violations, never drives pins.",
    scoreboard:
      "Scoreboard: compares expected vs actual transactions — orthogonal to bus legality.",
  };

  function renderLab() {
    syncInputs();
    document.getElementById("role-row").innerHTML = `
      <button type="button" class="role-card ${state.selected === "checker" ? "is-sel" : ""}" data-role="checker">
        <div class="k">protocol checker</div>
        <div class="v">bus rules · passive</div>
      </button>
      <button type="button" class="role-card ${state.selected === "scoreboard" ? "is-sel" : ""}" data-role="scoreboard">
        <div class="k">scoreboard</div>
        <div class="v">expect vs actual</div>
      </button>
    `;
    document.querySelectorAll("[data-role]").forEach((el) => {
      el.addEventListener("click", () =>
        selectRole(/** @type {string} */ (el.getAttribute("data-role")))
      );
    });

    document.getElementById("sig-row").innerHTML = `
      <span class="sig-chip ${state.valid ? "is-hi" : ""}">valid=${state.valid}</span>
      <span class="sig-chip ${state.ready ? "is-hi" : ""}">ready=${state.ready}</span>
      <span class="sig-chip">data=${state.data}</span>
      <span class="sig-chip">beat=${state.valid && state.ready ? 1 : 0}</span>
    `;

    document.getElementById("rule-list").innerHTML = RULES.map((rule) => {
      const v = state.results[rule.id];
      const cls = v == null ? "" : v ? "is-pass" : "is-fail";
      const tag = v == null ? "—" : v ? "PASS" : "FAIL";
      return `<div class="rule-row ${cls}"><span class="id">${rule.id} · ${rule.title}</span><span>${tag}</span></div>`;
    }).join("");

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      SEL_BLURB[state.selected] || SEL_BLURB.checker;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastChecked) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Check rules";
    } else if (allPass(state.results)) {
      v.className = "verdict yes";
      v.textContent = "Checker PASS — bus rules clean";
    } else {
      v.className = "verdict no";
      const fails = RULES.filter((r) => state.results[r.id] === false)
        .map((r) => r.id)
        .join(",");
      v.textContent = `Checker FAIL — ${fails}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">v=${state.valid}</span>
      <span class="flag is-on">r=${state.ready}</span>
      <span class="flag ${state.results.HS ? "is-ok" : state.results.HS === false ? "is-bad" : ""}">HS=${state.results.HS == null ? "—" : state.results.HS ? 1 : 0}</span>
      <span class="flag ${state.results.HOLD ? "is-ok" : state.results.HOLD === false ? "is-bad" : ""}">HOLD=${state.results.HOLD == null ? "—" : state.results.HOLD ? 1 : 0}</span>
      <span class="flag ${state.results.X ? "is-ok" : state.results.X === false ? "is-bad" : ""}">X=${state.results.X == null ? "—" : state.results.X ? 1 : 0}</span>
      <span class="flag ${state.sbOk ? "is-ok" : state.sbOk === false ? "is-bad" : ""}">sb=${state.sbOk == null ? "—" : state.sbOk ? "ok" : "bad"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          valid: state.valid,
          ready: state.ready,
          data: state.data,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-role",
      title: "Quiz: role",
      type: "quiz",
      prompt: "A protocol checker’s main job is to…",
      hint: "Bus legality.",
      choices: [
        "flag bus-rule / handshake violations (usually passively)",
        "replace the scoreboard for payload compares",
        "synthesize the DUT",
        "set +UVM_TESTNAME",
      ],
      answer: "flag bus-rule / handshake violations (usually passively)",
    },
    {
      id: "quiz-sb",
      title: "Quiz: scoreboard",
      type: "quiz",
      prompt: "Compared to a checker, a scoreboard focuses on…",
      hint: "Payload.",
      choices: [
        "expected vs actual transaction / payload correctness",
        "only pin X detection",
        "Makefile PHONY targets",
        "timescale pragmas",
      ],
      answer: "expected vs actual transaction / payload correctness",
    },
    {
      id: "quiz-passive",
      title: "Quiz: passive",
      type: "quiz",
      prompt: "A protocol checker typically…",
      hint: "No drive.",
      choices: [
        "does not drive the bus — only observes and reports",
        "must own the sequencer",
        "replaces connect_phase",
        "disables all agents",
      ],
      answer: "does not drive the bus — only observes and reports",
    },
    {
      id: "quiz-hold",
      title: "Quiz: HOLD",
      type: "quiz",
      prompt: "While valid && !ready, data should…",
      hint: "Stall.",
      choices: [
        "stay stable (hold) until ready completes the beat",
        "always become X",
        "toggle every cycle by rule",
        "clear the scoreboard queue",
      ],
      answer: "stay stable (hold) until ready completes the beat",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — all rules PASS.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        allPass(state.results) &&
        state.lastChecked,
    },
    {
      id: "load-hold",
      title: "Load HOLD fail",
      prompt: "Load data while stalled — HOLD fails.",
      hint: "data while stalled → Load",
      setup: () => {
        selPreset.value = "data_change";
        loadPreset();
      },
      check: () =>
        state.results.HOLD === false && state.lastAction === "load",
    },
    {
      id: "load-x",
      title: "Load X fail",
      prompt: "Load X while valid — X fails.",
      hint: "X while valid → Load",
      setup: () => {
        selPreset.value = "data_x";
        loadPreset();
      },
      check: () => state.results.X === false && state.data === "X",
    },
    {
      id: "load-drop",
      title: "Load drop valid",
      prompt: "Load drop valid — HS fails.",
      hint: "drop valid → Load",
      setup: () => {
        selPreset.value = "drop_valid";
        loadPreset();
      },
      check: () => state.results.HS === false,
    },
    {
      id: "check-pass",
      title: "Check pass",
      prompt: "From idle, set valid=1 ready=1 data=0xA5, Check rules — PASS.",
      hint: "idle → knobs → Check rules",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        selValid.value = "1";
        selReady.value = "1";
        inpData.value = "0xA5";
        state.prevData = "0xA5";
        state.stalled = false;
        runCheck(false);
      },
      check: () =>
        allPass(state.results) && state.lastAction === "check-pass",
    },
    {
      id: "check-fail",
      title: "Check fail",
      prompt: "Set valid=1 ready=0 data≠prev, Check — HOLD fail.",
      hint: "Stall + change data → Check",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        selValid.value = "1";
        selReady.value = "0";
        inpData.value = "0x5A";
        state.prevData = "0xA5";
        state.stalled = true;
        runCheck(false);
      },
      check: () =>
        state.results.HOLD === false && state.lastAction === "check-fail",
    },
    {
      id: "sb-pass",
      title: "SB match",
      prompt: "On starter, Compare sb — MATCH.",
      hint: "Compare sb",
      setup: () => {
        loadStarter();
        compareSb();
      },
      check: () => state.sbOk === true && state.lastAction === "sb-pass",
    },
    {
      id: "sb-fail",
      title: "SB mismatch",
      prompt: "Set data 0x00, Compare sb — MISMATCH.",
      hint: "data=0x00 → Compare sb",
      setup: () => {
        loadStarter();
        inpData.value = "0x00";
        state.data = "0x00";
        compareSb();
      },
      check: () => state.sbOk === false && state.lastAction === "sb-fail",
    },
    {
      id: "demo",
      title: "Demo HOLD",
      prompt: "Click Demo HOLD fail.",
      hint: "Demo HOLD fail",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.results.HOLD === false &&
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
      id: "select-sb",
      title: "Select scoreboard",
      prompt: "Click the scoreboard role card.",
      hint: "Click scoreboard",
      setup: () => {
        loadStarter();
        selectRole("scoreboard");
      },
      check: () =>
        state.selected === "scoreboard" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions scoreboard.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /scoreboard/i.test(sourceSketch()),
    },
    {
      id: "sketch-rules",
      title: "Sketch rules",
      prompt: "Check sketch lists HOLD.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /HOLD/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "beat-flag",
      title: "Beat",
      prompt: "On starter, valid∧ready beat=1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.valid === 1 && state.ready === 1,
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — lastChecked false until Check.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        state.valid === 0 &&
        !state.lastChecked &&
        state.lastAction === "load",
    },
    {
      id: "orthogonal",
      title: "Orthogonal",
      prompt: "On X fail preset, sb can still MATCH if expect=X.",
      hint: "data_x → Compare with expect X",
      setup: () => {
        selPreset.value = "data_x";
        loadPreset();
        state.sbExpect = "X";
        compareSb();
      },
      check: () => state.results.X === false && state.sbOk === true,
    },
    {
      id: "all-pass-flag",
      title: "All pass",
      prompt: "Starter allPass(results) is true.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => allPass(state.results),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From idle, Reset — all rules PASS again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" && allPass(state.results),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="pchk-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("pchk-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-eval").addEventListener("click", () => runCheck(false));
  document.getElementById("btn-sb").addEventListener("click", () => compareSb());
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
      if (saved && saved.data != null) {
        state.valid = saved.valid ?? 0;
        state.ready = saved.ready ?? 0;
        state.data = saved.data;
        state.preset = saved.preset || "starter";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
