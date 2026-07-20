(() => {
  /**
   * Sign-off criteria (concept)
   *   coverage / bug bar / stability exit criteria
   * Starter: all three met — gate READY
   */

  const CRITERIA = [
    {
      id: "coverage",
      label: "coverage_goal",
      kind: "coverage",
      blurb: "Plan covergroups / requirements hit the agreed % — no open P0 holes.",
    },
    {
      id: "bug_bar",
      label: "bug_bar",
      kind: "bug bar",
      blurb: "Zero open sev-1 / blocker bugs against the DUT for this milestone.",
    },
    {
      id: "stability",
      label: "stability_window",
      kind: "stability",
      blurb: "Agreed green nights / flake bar held — regression is trustworthy.",
    },
  ];

  const STATUSES = [
    {
      id: "met",
      label: "met",
      blurb: "Evidence exists — criterion satisfied for this gate.",
    },
    {
      id: "open",
      label: "open",
      blurb: "Not yet demonstrated — blocks READY.",
    },
    {
      id: "fail",
      label: "fail",
      blurb: "Criterion broken (e.g. sev-1 open) — gate BLOCKED.",
    },
    {
      id: "waived",
      label: "waived",
      blurb: "Documented waiver with owner / expiry — counts as closed for READY.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: all met",
      marks: { coverage: "met", bug_bar: "met", stability: "met" },
      selCrit: "coverage",
      selStatus: "met",
      note: "Coverage, bug bar, and stability all met — gate READY.",
      autoScan: true,
    },
    coverage_gap: {
      label: "coverage open",
      marks: { coverage: "open", bug_bar: "met", stability: "met" },
      selCrit: "coverage",
      selStatus: "met",
      note: "Coverage goal still open — not READY.",
      autoScan: true,
    },
    bug_fail: {
      label: "bug bar fail",
      marks: { coverage: "met", bug_bar: "fail", stability: "met" },
      selCrit: "bug_bar",
      selStatus: "met",
      note: "Sev-1 still open — gate BLOCKED.",
      autoScan: true,
    },
    waived: {
      label: "stability waived",
      marks: { coverage: "met", bug_bar: "met", stability: "waived" },
      selCrit: "stability",
      selStatus: "waived",
      note: "Stability waived with owner — still READY.",
      autoScan: true,
    },
    all_open: {
      label: "all open",
      marks: { coverage: "open", bug_bar: "open", stability: "open" },
      selCrit: "coverage",
      selStatus: "met",
      note: "Empty gate — nothing demonstrated yet.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      marks: { coverage: "open", bug_bar: "open", stability: "open" },
      selCrit: null,
      selStatus: null,
      note: "Idle — select a criterion and status, then Check off.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Sign-off criteria literacy (document aid)
//
// Exit criteria for a milestone / tape-out gate:
//
// 1. coverage  — plan holes closed / % goal met
// 2. bug bar   — no open sev-1 / blockers
// 3. stability — green window / flake bar held
//
// Marks: met | open | fail | waived
//
// READY   = every row is met or waived (no open, no fail)
// OPEN    = some criterion still open
// BLOCKED = any fail (especially bug bar)
//
// Waivers need owner + reason + expiry — not a silent skip.
// Pair with coverage-closure, regression-triage, risk-plan.`;
  }

  function openCount(marks) {
    return CRITERIA.filter((c) => (marks[c.id] || "open") === "open").length;
  }

  function failCount(marks) {
    return CRITERIA.filter((c) => marks[c.id] === "fail").length;
  }

  function countStatus(marks, id) {
    return CRITERIA.filter((c) => marks[c.id] === id).length;
  }

  function evaluate(marks) {
    const fails = failCount(marks);
    if (fails > 0) {
      return {
        status: "BLOCKED",
        ready: false,
        reason: `${fails} criterion fail(s) — fix before sign-off`,
      };
    }
    const open = openCount(marks);
    if (open > 0) {
      return {
        status: "OPEN",
        ready: false,
        reason: `${open} criterion still open`,
      };
    }
    return {
      status: "READY",
      ready: true,
      reason: "all criteria met or waived",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.marks);
    return {
      preset: "starter",
      marks: { ...p.marks },
      selCrit: p.selCrit,
      selStatus: p.selStatus,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: READY open=0 fail=0"],
    };
  }

  const CLEARED_KEY = "ddv-signoff-checklist-cleared-v1";
  const STORE_KEY = "ddv-signoff-checklist-session-v1";

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

  const root = document.getElementById("sgf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>coverage_goal</code>,
        <code>bug_bar</code>, and
        <code>stability_window</code>
        all <strong>met</strong> — gate READY.</p>
      <button type="button" class="btn btn-secondary" id="sgf-starter">Load starter example</button>
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
        <div class="idea-card"><h3>coverage</h3><p>Plan % / P0 holes closed for the gate.</p></div>
        <div class="idea-card"><h3>bug bar</h3><p>No open sev-1 / blockers against the DUT.</p></div>
        <div class="idea-card"><h3>stability</h3><p>Green window / flake bar held.</p></div>
        <div class="idea-card"><h3>READY</h3><p>All met or waived — no open, no fail.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="sgf-controls">
        <div class="sgf-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>all met</option>
            <option value="coverage_gap">coverage open</option>
            <option value="bug_fail">bug bar fail</option>
            <option value="waived">stability waived</option>
            <option value="all_open">all open</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-mark">Check off</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan gate</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo blocked</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="sgf-layout">
        <div class="panel-box">
          <h3>Status marks</h3>
          <div class="status-row" id="status-row"></div>
          <h3>Exit criteria</h3>
          <ul class="crit-list" id="crit-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Gate sketch</h3>
          <pre class="plan-box" id="plan-box"></pre>
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

  function planSketch() {
    const lines = CRITERIA.map((c) => {
      const m = state.marks[c.id] || "open";
      return `${c.label.padEnd(18)} ${m}`;
    });
    return `# sign-off gate
${lines.join("\n")}
# open:   ${openCount(state.marks)}
# fail:   ${failCount(state.marks)}
# status: ${state.lastScanned ? state.status : "— (Scan gate)"}
# reason: ${state.lastScanned ? state.reason : "—"}`;
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
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter READY");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.marks);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(
      `scan: ${ev.status} open=${openCount(state.marks)} fail=${failCount(state.marks)}`
    );
    if (!silent) {
      state.lastAction = ev.ready ? "scan-ok" : "scan-bad";
      pushLog(`# scan ${ev.status}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.marks = { ...p.marks };
    state.selCrit = p.selCrit;
    state.selStatus = p.selStatus;
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.lastScanned = false;
    syncInputs();
    if (p.autoScan) {
      runScan(true);
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

  function checkOff() {
    if (!state.selCrit || !state.selStatus) {
      state.lastAction = "mark-bad";
      pushLog("# check-off FAIL (need criterion + status)");
      renderAll();
      return;
    }
    state.marks[state.selCrit] = state.selStatus;
    pushTrace(`mark: ${state.selCrit} → ${state.selStatus}`);
    pushLog(`# check-off ${state.selCrit} → ${state.selStatus}`);
    runScan(true);
    state.lastAction = "mark";
    renderAll();
  }

  function demo() {
    applyPreset("bug_fail", "demo");
    state.demoed = true;
    pushLog("# demo bug_bar BLOCKED");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain gate");
    pushTrace("explain: coverage|bug_bar|stability → READY if met/waived");
    renderAll();
  }

  function selectCrit(id) {
    state.selCrit = id;
    state.lastAction = "select-crit";
    renderAll();
  }

  function selectStatus(id) {
    state.selStatus = id;
    state.lastAction = "select-status";
    renderAll();
  }

  function tagClass(m) {
    if (m === "met") return "is-met";
    if (m === "fail") return "is-fail";
    if (m === "waived") return "is-waived";
    return "is-open";
  }

  function renderLab() {
    syncInputs();
    const crit = CRITERIA.find((c) => c.id === state.selCrit);
    const st = STATUSES.find((s) => s.id === state.selStatus);

    document.getElementById("status-row").innerHTML = STATUSES.map((s) => {
      const n = countStatus(state.marks, s.id);
      const on = state.selStatus === s.id;
      return `<button type="button" class="status-card ${on ? "is-sel" : ""}" data-status="${s.id}">
        <div class="k">${s.label} · ${n}</div>
        <div class="v">${s.id}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-status]").forEach((el) => {
      el.addEventListener("click", () =>
        selectStatus(/** @type {string} */ (el.getAttribute("data-status")))
      );
    });

    document.getElementById("crit-list").innerHTML = CRITERIA.map((c) => {
      const m = state.marks[c.id] || "open";
      const sel = state.selCrit === c.id;
      return `<li class="${sel ? "is-sel" : ""}" data-crit="${c.id}">
        <span><span class="id">${c.label}</span><br><span class="kind">${c.kind}</span></span>
        <span class="tag ${tagClass(m)}">${m.toUpperCase()}</span>
        <span></span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-crit]").forEach((el) => {
      el.addEventListener("click", () =>
        selectCrit(/** @type {string} */ (el.getAttribute("data-crit")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a criterion, pick a status, then Check off.";
    if (crit && state.lastAction === "select-crit") blurb = crit.blurb;
    else if (st && state.lastAction === "select-status") blurb = st.blurb;
    else if (crit && st) blurb = `${crit.label} → ${st.label}. ${crit.blurb}`;
    else if (crit) blurb = crit.blurb;
    else if (st) blurb = st.blurb;
    document.getElementById("role-blurb").textContent = blurb;
    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastScanned) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset, Check off, or Scan gate";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Gate READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const openN = openCount(state.marks);
    const failN = failCount(state.marks);
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${openN ? "is-bad" : "is-ok"}">open=${openN}</span>
      <span class="flag ${failN ? "is-bad" : "is-ok"}">fail=${failN}</span>
      <span class="flag is-ok">met=${countStatus(state.marks, "met")}</span>
      <span class="flag is-ok">waived=${countStatus(state.marks, "waived")}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          marks: state.marks,
          selCrit: state.selCrit,
          selStatus: state.selStatus,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-coverage",
      title: "Quiz: coverage",
      type: "quiz",
      prompt: "Coverage exit criteria usually mean…",
      hint: "Plan goal.",
      choices: [
        "agreed cover / requirement goals met with no open P0 holes",
        "a Makefile PHONY target",
        "only lint clean",
        "VCD file size under 1 MB",
      ],
      answer:
        "agreed cover / requirement goals met with no open P0 holes",
    },
    {
      id: "quiz-bug-bar",
      title: "Quiz: bug bar",
      type: "quiz",
      prompt: "A bug bar for sign-off typically requires…",
      hint: "Sev-1.",
      choices: [
        "zero open sev-1 / blocker bugs against the DUT for the milestone",
        "ignoring all failures",
        "only UI polish bugs",
        "coverage ignored",
      ],
      answer:
        "zero open sev-1 / blocker bugs against the DUT for the milestone",
    },
    {
      id: "quiz-stability",
      title: "Quiz: stability",
      type: "quiz",
      prompt: "Stability criteria look for…",
      hint: "Green window.",
      choices: [
        "an agreed green / flake window so the regression is trustworthy",
        "a single seed run once",
        "synthesis area only",
        "plusarg count",
      ],
      answer:
        "an agreed green / flake window so the regression is trustworthy",
    },
    {
      id: "quiz-ready",
      title: "Quiz: READY",
      type: "quiz",
      prompt: "Gate READY means…",
      hint: "Closed rows.",
      choices: [
        "every criterion is met or waived — no open, no fail",
        "CI ran once",
        "all tests are directed",
        "coverage is ignored",
      ],
      answer:
        "every criterion is met or waived — no open, no fail",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — READY.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "READY",
    },
    {
      id: "load-gap",
      title: "Load coverage open",
      prompt: "Load coverage open — OPEN.",
      hint: "coverage open → Load",
      setup: () => {
        selPreset.value = "coverage_gap";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" &&
        !state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-blocked",
      title: "Load bug fail",
      prompt: "Load bug bar fail — BLOCKED.",
      hint: "bug bar fail → Load",
      setup: () => {
        selPreset.value = "bug_fail";
        loadPreset();
      },
      check: () =>
        state.status === "BLOCKED" && !state.ready,
    },
    {
      id: "load-waived",
      title: "Load waived",
      prompt: "Load stability waived — READY.",
      hint: "stability waived → Load",
      setup: () => {
        selPreset.value = "waived";
        loadPreset();
      },
      check: () =>
        state.ready &&
        state.marks.stability === "waived",
    },
    {
      id: "load-all-open",
      title: "Load all open",
      prompt: "Load all open — open=3.",
      hint: "all open → Load",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
      },
      check: () =>
        openCount(state.marks) === 3 && state.status === "OPEN",
    },
    {
      id: "mark",
      title: "Check off",
      prompt: "From coverage open, Check off coverage → met — READY.",
      hint: "coverage open → Check off",
      setup: () => {
        selPreset.value = "coverage_gap";
        loadPreset();
        state.selCrit = "coverage";
        state.selStatus = "met";
        checkOff();
      },
      check: () =>
        state.marks.coverage === "met" &&
        state.ready &&
        state.lastAction === "mark",
    },
    {
      id: "select-crit",
      title: "Select criterion",
      prompt: "Click bug_bar row.",
      hint: "Click bug_bar",
      setup: () => {
        loadStarter();
        selectCrit("bug_bar");
      },
      check: () =>
        state.selCrit === "bug_bar" &&
        state.lastAction === "select-crit",
    },
    {
      id: "select-status",
      title: "Select status",
      prompt: "Click the waived status card.",
      hint: "Click waived",
      setup: () => {
        loadStarter();
        selectStatus("waived");
      },
      check: () =>
        state.selStatus === "waived" &&
        state.lastAction === "select-status",
    },
    {
      id: "scan-ok",
      title: "Scan READY",
      prompt: "On starter, Scan gate — READY.",
      hint: "Scan gate",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan OPEN",
      prompt: "On all open, Scan — OPEN.",
      hint: "all open → Scan",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo blocked",
      prompt: "Click Demo blocked.",
      hint: "Demo blocked",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "BLOCKED" &&
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
      prompt: "Literacy sketch mentions READY or bug bar.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /READY|bug bar/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Gate sketch",
      prompt: "On starter, gate sketch shows READY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /READY/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "open-zero",
      title: "Open zero",
      prompt: "Starter open count is 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => openCount(state.marks) === 0,
    },
    {
      id: "all-met",
      title: "All met",
      prompt: "Starter has met=3.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => countStatus(state.marks, "met") === 3,
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet scanned.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastScanned && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From all open, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "READY",
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) =>
      CHALLENGES.some((c) => c.id === id)
    ).length;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="sgf-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("sgf-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-mark").addEventListener("click", () => checkOff());
  document.getElementById("btn-scan").addEventListener("click", () => runScan(false));
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
      if (saved) {
        state.marks = saved.marks || state.marks;
        state.selCrit = saved.selCrit || null;
        state.selStatus = saved.selStatus || null;
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
