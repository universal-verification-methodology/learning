(() => {
  /**
   * UVM reporting ladder (concept)
   *   severity · verbosity · ID filter
   * Starter: thresh MEDIUM, uvm_info("DRV", UVM_LOW) → shown
   */

  const VERB = {
    UVM_NONE: 0,
    UVM_LOW: 100,
    UVM_MEDIUM: 200,
    UVM_HIGH: 300,
    UVM_FULL: 400,
    UVM_DEBUG: 500,
  };

  const SEV = ["INFO", "WARNING", "ERROR", "FATAL"];

  const PRESETS = {
    starter: {
      label: "starter: INFO DRV @ LOW → shown",
      threshold: "UVM_MEDIUM",
      severity: "INFO",
      msgVerb: "UVM_LOW",
      id: "DRV",
      filterId: "",
      text: "byte accepted",
      note: "Verbosity LOW ≤ threshold MEDIUM — INFO is printed.",
      autoEmit: true,
    },
    filtered: {
      label: "filtered: HIGH > MEDIUM",
      threshold: "UVM_MEDIUM",
      severity: "INFO",
      msgVerb: "UVM_HIGH",
      id: "MON",
      filterId: "",
      text: "sample detail",
      note: "Message verbosity HIGH > threshold MEDIUM — filtered out.",
      autoEmit: true,
    },
    error: {
      label: "ERROR ignores verbosity",
      threshold: "UVM_NONE",
      severity: "ERROR",
      msgVerb: "UVM_NONE",
      id: "SB",
      filterId: "",
      text: "mismatch",
      note: "ERROR/FATAL always report (concept) — verbosity gate does not hide them.",
      autoEmit: true,
    },
    id_filter: {
      label: "ID filter blocks DRV",
      threshold: "UVM_FULL",
      severity: "INFO",
      msgVerb: "UVM_LOW",
      id: "DRV",
      filterId: "DRV",
      text: "suppressed by ID",
      note: "ID filter matches DRV — message dropped before print.",
      autoEmit: true,
    },
    quiet: {
      label: "quiet (no emit yet)",
      threshold: "UVM_MEDIUM",
      severity: "INFO",
      msgVerb: "UVM_LOW",
      id: "DRV",
      filterId: "",
      text: "hello",
      note: "Set knobs, then Emit.",
      autoEmit: false,
    },
  };

  function sourceSketch() {
    return `// Reporting literacy (not a full uvm_report_server)
// severity: INFO < WARNING < ERROR < FATAL  (action / gravity)
// verbosity: NONE < LOW < MEDIUM < HIGH < FULL < DEBUG
//
// uvm_info(ID, msg, VERB) prints if VERB <= configured threshold
// uvm_error / uvm_fatal typically always print (severity wins)
//
// ID filter: drop or demote messages whose ID matches a rule
//
// Knobs: +UVM_VERBOSITY=…  set_report_verbosity_level  set_report_id_action`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      threshold: p.threshold,
      severity: p.severity,
      msgVerb: p.msgVerb,
      id: p.id,
      filterId: p.filterId,
      text: p.text,
      note: p.note,
      lastShown: true,
      lastReason: "verbosity LOW <= threshold MEDIUM",
      lastLine: 'UVM_INFO DRV [UVM_LOW] "byte accepted"',
      lastAction: "starter",
      explained: false,
      demoed: false,
      emits: 1,
      shown: 1,
      filtered: 0,
      log: [],
      trace: ['shown: UVM_INFO DRV [UVM_LOW] "byte accepted"'],
    };
  }

  const CLEARED_KEY = "ddv-uvm-reporting-cleared-v1";
  const STORE_KEY = "ddv-uvm-reporting-session-v1";

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

  const root = document.getElementById("urp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> threshold <code>UVM_MEDIUM</code>,
        emit <code>uvm_info("DRV", "byte accepted", UVM_LOW)</code> — shown.</p>
      <button type="button" class="btn btn-secondary" id="urp-starter">Load starter example</button>
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
        <div class="idea-card"><h3>severity</h3><p>INFO → WARNING → ERROR → FATAL gravity.</p></div>
        <div class="idea-card"><h3>verbosity</h3><p>How chatty INFO/WARNING may be.</p></div>
        <div class="idea-card"><h3>threshold</h3><p>Print if message verb ≤ configured level.</p></div>
        <div class="idea-card"><h3>ID filter</h3><p>Drop or demote by report ID string.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="urp-controls">
        <div class="urp-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>INFO DRV shown</option>
            <option value="filtered">HIGH filtered</option>
            <option value="error">ERROR always</option>
            <option value="id_filter">ID filter DRV</option>
            <option value="quiet">quiet</option>
          </select>
        </div>
        <div class="urp-field">
          <label for="sel-thresh">Threshold</label>
          <select id="sel-thresh">
            ${Object.keys(VERB)
              .map((k) => `<option value="${k}">${k}</option>`)
              .join("")}
          </select>
        </div>
        <div class="urp-field">
          <label for="sel-sev">Severity</label>
          <select id="sel-sev">
            ${SEV.map((s) => `<option value="${s}">${s}</option>`).join("")}
          </select>
        </div>
        <div class="urp-field">
          <label for="sel-verb">Msg verb</label>
          <select id="sel-verb">
            ${Object.keys(VERB)
              .map((k) => `<option value="${k}">${k}</option>`)
              .join("")}
          </select>
        </div>
        <div class="urp-field">
          <label for="inp-id">ID</label>
          <input id="inp-id" type="text" value="DRV" spellcheck="false" />
        </div>
        <div class="urp-field">
          <label for="inp-filter">Filter ID</label>
          <input id="inp-filter" type="text" value="" placeholder="(none)" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-emit">Emit</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo filter</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="urp-layout">
        <div class="panel-box">
          <h3>Severity ladder</h3>
          <div class="ladder" id="sev-ladder"></div>
          <h3>Last message</h3>
          <div class="msg-box" id="msg-box">No emit yet</div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Gate decision</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Report sketch</h3>
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
  const selThresh = /** @type {HTMLSelectElement} */ (document.getElementById("sel-thresh"));
  const selSev = /** @type {HTMLSelectElement} */ (document.getElementById("sel-sev"));
  const selVerb = /** @type {HTMLSelectElement} */ (document.getElementById("sel-verb"));
  const inpId = /** @type {HTMLInputElement} */ (document.getElementById("inp-id"));
  const inpFilter = /** @type {HTMLInputElement} */ (document.getElementById("inp-filter"));

  function decide() {
    const id = (inpId.value || state.id || "").trim() || "ID";
    const filter = (inpFilter.value || "").trim();
    const sev = selSev.value || state.severity;
    const msgVerb = selVerb.value || state.msgVerb;
    const thresh = selThresh.value || state.threshold;
    const text = state.text || "msg";

    if (filter && filter === id) {
      return {
        shown: false,
        reason: `ID filter matched "${id}"`,
        line: `(filtered) UVM_${sev} ${id} [${msgVerb}] "${text}"`,
      };
    }
    if (sev === "ERROR" || sev === "FATAL") {
      return {
        shown: true,
        reason: `${sev} bypasses verbosity gate (concept)`,
        line: `UVM_${sev} ${id} "${text}"`,
      };
    }
    const mv = VERB[msgVerb] ?? 0;
    const th = VERB[thresh] ?? 0;
    if (mv <= th) {
      return {
        shown: true,
        reason: `verbosity ${msgVerb}(${mv}) <= threshold ${thresh}(${th})`,
        line: `UVM_${sev} ${id} [${msgVerb}] "${text}"`,
      };
    }
    return {
      shown: false,
      reason: `verbosity ${msgVerb}(${mv}) > threshold ${thresh}(${th})`,
      line: `(filtered) UVM_${sev} ${id} [${msgVerb}] "${text}"`,
    };
  }

  function codeSketch() {
    return `// threshold = ${state.threshold} (${VERB[state.threshold]})
// emit: uvm_${state.severity.toLowerCase()}("${state.id}", "${state.text}"${
      state.severity === "INFO" || state.severity === "WARNING"
        ? `, ${state.msgVerb}`
        : ""
    })
// filter_id = ${state.filterId ? `"${state.filterId}"` : "(none)"}
//
// last: ${state.lastShown == null ? "—" : state.lastShown ? "SHOWN" : "FILTERED"}
// reason: ${state.lastReason || "—"}`;
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
    selThresh.value = state.threshold;
    selSev.value = state.severity;
    selVerb.value = state.msgVerb;
    inpId.value = state.id;
    inpFilter.value = state.filterId;
  }

  function readInputs() {
    state.threshold = selThresh.value;
    state.severity = selSev.value;
    state.msgVerb = selVerb.value;
    state.id = (inpId.value || "").trim() || "ID";
    state.filterId = (inpFilter.value || "").trim();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter INFO DRV shown");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.threshold = p.threshold;
    state.severity = p.severity;
    state.msgVerb = p.msgVerb;
    state.id = p.id;
    state.filterId = p.filterId;
    state.text = p.text;
    state.note = p.note;
    state.lastShown = null;
    state.lastReason = "";
    state.lastLine = "";
    syncInputs();
    if (p.autoEmit) {
      emit(true);
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

  function emit(silent) {
    readInputs();
    const d = decide();
    state.lastShown = d.shown;
    state.lastReason = d.reason;
    state.lastLine = d.line;
    state.emits += 1;
    if (d.shown) state.shown += 1;
    else state.filtered += 1;
    if (!silent) {
      state.lastAction = d.shown ? "emit-show" : "emit-filter";
      pushLog(`# emit ${d.shown ? "SHOWN" : "FILTERED"}`);
      pushTrace(`${d.shown ? "shown" : "filtered"}: ${d.line}`);
      renderAll();
    } else {
      pushTrace(`${d.shown ? "shown" : "filtered"}: ${d.line}`);
    }
  }

  function demo() {
    applyPreset("filtered", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo HIGH filtered");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: severity = gravity; verbosity gates INFO/WARNING; " +
        "ERROR/FATAL always show; ID filter can drop a message family."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const ladder = document.getElementById("sev-ladder");
    const cls = { INFO: "is-info", WARNING: "is-warn", ERROR: "is-err", FATAL: "is-fatal" };
    ladder.innerHTML = SEV.map(
      (s) =>
        `<div class="rung is-sev ${cls[s] || ""} ${state.severity === s ? "is-active" : ""}">
          <span>${s}</span>
          <span>${s === "INFO" || s === "WARNING" ? "verb-gated" : "always"}</span>
        </div>`
    ).join("");

    const box = document.getElementById("msg-box");
    if (state.lastShown == null) {
      box.className = "msg-box";
      box.textContent = "No emit yet — Load preset or Emit";
    } else {
      box.className = "msg-box " + (state.lastShown ? "is-shown" : "is-filtered");
      box.textContent = state.lastLine + "\n// " + state.lastReason;
    }

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      state.lastShown == null
        ? `Threshold ${state.threshold}. Pick severity/verb/ID, then Emit.`
        : state.lastShown
          ? `Shown — ${state.lastReason}`
          : `Filtered — ${state.lastReason}`;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (state.lastShown == null) {
      v.className = "verdict idle";
      v.textContent = "Idle — emit a report";
    } else if (state.lastShown) {
      v.className = "verdict yes";
      v.textContent = "SHOWN — " + state.lastReason;
    } else {
      v.className = "verdict warn";
      v.textContent = "FILTERED — " + state.lastReason;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">thresh=${state.threshold}</span>
      <span class="flag is-on">sev=${state.severity}</span>
      <span class="flag is-on">verb=${state.msgVerb}</span>
      <span class="flag is-on">id=${state.id}</span>
      <span class="flag ${state.lastShown ? "is-ok" : state.lastShown === false ? "is-bad" : ""}">last=${state.lastShown == null ? "—" : state.lastShown ? "show" : "filt"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          threshold: state.threshold,
          severity: state.severity,
          msgVerb: state.msgVerb,
          id: state.id,
          filterId: state.filterId,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-severity",
      title: "Quiz: severity",
      type: "quiz",
      prompt: "UVM report severity ladder (light → heavy) is…",
      hint: "INFO…FATAL.",
      choices: [
        "INFO → WARNING → ERROR → FATAL",
        "DEBUG → FULL → NONE only",
        "PASS → FAIL → SKIP",
        "build → connect → run",
      ],
      answer: "INFO → WARNING → ERROR → FATAL",
    },
    {
      id: "quiz-verb",
      title: "Quiz: verbosity",
      type: "quiz",
      prompt: "uvm_info prints when…",
      hint: "≤ threshold.",
      choices: [
        "its verbosity is less than or equal to the configured threshold",
        "the objection count is zero",
        "ConfigDB is empty",
        "only in report_phase",
      ],
      answer: "its verbosity is less than or equal to the configured threshold",
    },
    {
      id: "quiz-error",
      title: "Quiz: ERROR",
      type: "quiz",
      prompt: "In this lab’s model, uvm_error…",
      hint: "Severity wins.",
      choices: [
        "still prints even if verbosity threshold is UVM_NONE",
        "is always filtered by verbosity",
        "replaces the sequencer",
        "sets the timescale",
      ],
      answer: "still prints even if verbosity threshold is UVM_NONE",
    },
    {
      id: "quiz-id",
      title: "Quiz: ID",
      type: "quiz",
      prompt: "A report ID filter is used to…",
      hint: "String tag.",
      choices: [
        "drop or demote messages that match an ID string",
        "compile the DUT netlist",
        "raise objections automatically",
        "choose +UVM_TESTNAME exclusively",
      ],
      answer: "drop or demote messages that match an ID string",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — INFO DRV shown.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.lastShown === true &&
        state.id === "DRV",
    },
    {
      id: "load-filtered",
      title: "Load filtered",
      prompt: "Load HIGH filtered — last filtered.",
      hint: "HIGH filtered → Load",
      setup: () => {
        selPreset.value = "filtered";
        loadPreset();
      },
      check: () =>
        state.lastShown === false &&
        state.msgVerb === "UVM_HIGH" &&
        state.lastAction === "load",
    },
    {
      id: "load-error",
      title: "Load ERROR",
      prompt: "Load ERROR always — shown despite UVM_NONE.",
      hint: "ERROR always → Load",
      setup: () => {
        selPreset.value = "error";
        loadPreset();
      },
      check: () =>
        state.severity === "ERROR" &&
        state.threshold === "UVM_NONE" &&
        state.lastShown === true,
    },
    {
      id: "load-id",
      title: "Load ID filter",
      prompt: "Load ID filter DRV — filtered by ID.",
      hint: "ID filter → Load",
      setup: () => {
        selPreset.value = "id_filter";
        loadPreset();
      },
      check: () =>
        state.filterId === "DRV" &&
        state.lastShown === false &&
        /ID filter/i.test(state.lastReason),
    },
    {
      id: "emit-show",
      title: "Emit show",
      prompt: "From quiet, Emit — shown.",
      hint: "quiet → Load → Emit",
      setup: () => {
        selPreset.value = "quiet";
        loadPreset();
        emit(false);
      },
      check: () => state.lastShown === true && state.lastAction === "emit-show",
    },
    {
      id: "emit-filter",
      title: "Emit filter",
      prompt: "Threshold LOW, msg HIGH, Emit — filtered.",
      hint: "Set knobs → Emit",
      setup: () => {
        selPreset.value = "quiet";
        loadPreset();
        selThresh.value = "UVM_LOW";
        selVerb.value = "UVM_HIGH";
        selSev.value = "INFO";
        emit(false);
      },
      check: () => state.lastShown === false && state.lastAction === "emit-filter",
    },
    {
      id: "set-thresh",
      title: "Set threshold",
      prompt: "Set Threshold to UVM_HIGH.",
      hint: "Threshold → UVM_HIGH",
      setup: () => {
        loadStarter();
        selThresh.value = "UVM_HIGH";
        state.threshold = "UVM_HIGH";
        state.lastAction = "thresh";
        renderAll();
      },
      check: () => state.threshold === "UVM_HIGH" && state.lastAction === "thresh",
    },
    {
      id: "set-sev-warn",
      title: "Set WARNING",
      prompt: "Set Severity to WARNING.",
      hint: "Severity → WARNING",
      setup: () => {
        selSev.value = "WARNING";
        state.severity = "WARNING";
        state.lastAction = "sev";
        renderAll();
      },
      check: () => state.severity === "WARNING",
    },
    {
      id: "set-id",
      title: "Set ID",
      prompt: "Set ID to MON.",
      hint: "ID → MON",
      setup: () => {
        inpId.value = "MON";
        state.id = "MON";
        state.lastAction = "id";
        renderAll();
      },
      check: () => state.id === "MON" && state.lastAction === "id",
    },
    {
      id: "demo",
      title: "Demo filter",
      prompt: "Click Demo filter — HIGH filtered.",
      hint: "Demo filter",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.lastShown === false &&
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
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions uvm_info.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /uvm_info/i.test(sourceSketch()),
    },
    {
      id: "sketch-thresh",
      title: "Sketch thresh",
      prompt: "Report sketch shows threshold =.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /threshold =/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "fatal-bypass",
      title: "FATAL bypass",
      prompt: "Emit FATAL with thresh NONE — shown.",
      hint: "Severity FATAL → Emit",
      setup: () => {
        selPreset.value = "quiet";
        loadPreset();
        selThresh.value = "UVM_NONE";
        selSev.value = "FATAL";
        state.text = "abort";
        emit(false);
      },
      check: () =>
        state.severity === "FATAL" &&
        state.lastShown === true &&
        /bypasses/i.test(state.lastReason),
    },
    {
      id: "ladder-active",
      title: "Ladder active",
      prompt: "On starter, INFO rung is active.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.severity === "INFO" &&
        !!document.querySelector(".rung.is-info.is-active"),
    },
    {
      id: "reason-verb",
      title: "Reason verb",
      prompt: "After starter, reason mentions <= threshold.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /<= threshold/i.test(state.lastReason),
    },
    {
      id: "counts",
      title: "Shown count",
      prompt: "After starter, shown ≥ 1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.shown >= 1,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From quiet, Reset — INFO DRV shown again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "quiet";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.lastShown === true &&
        state.id === "DRV",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="urp-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("urp-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-emit").addEventListener("click", () => emit(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selThresh.addEventListener("change", () => {
    state.threshold = selThresh.value;
    state.lastAction = "thresh";
    renderAll();
  });
  selSev.addEventListener("change", () => {
    state.severity = selSev.value;
    state.lastAction = "sev";
    renderAll();
  });
  selVerb.addEventListener("change", () => {
    state.msgVerb = selVerb.value;
    state.lastAction = "verb";
    renderAll();
  });
  inpId.addEventListener("change", () => {
    state.id = (inpId.value || "").trim() || "ID";
    state.lastAction = "id";
    renderAll();
  });
  inpFilter.addEventListener("change", () => {
    state.filterId = (inpFilter.value || "").trim();
    state.lastAction = "filter";
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
      if (saved && saved.threshold) {
        state.threshold = saved.threshold;
        state.severity = saved.severity || "INFO";
        state.msgVerb = saved.msgVerb || "UVM_LOW";
        state.id = saved.id || "DRV";
        state.filterId = saved.filterId || "";
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
