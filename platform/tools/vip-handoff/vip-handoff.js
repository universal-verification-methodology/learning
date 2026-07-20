(() => {
  /**
   * VIP handoff checklist (concept)
   *   docs + API + self-test deliverables
   * Starter: all three met — handoff READY
   */

  const DELIVERABLES = [
    {
      id: "docs",
      label: "docs_pack",
      kind: "docs",
      blurb: "README, quickstart, examples, known limits — consumers can onboard.",
    },
    {
      id: "api",
      label: "api_surface",
      kind: "API",
      blurb: "Sequences, config knobs, callbacks, and vif contract documented.",
    },
    {
      id: "self_test",
      label: "self_test",
      kind: "self-test",
      blurb: "Shipped smoke / self-check that proves the VIP runs standalone.",
    },
  ];

  const STATUSES = [
    {
      id: "met",
      label: "met",
      blurb: "Deliverable present with evidence — counts for READY.",
    },
    {
      id: "open",
      label: "open",
      blurb: "Not delivered yet — blocks handoff.",
    },
    {
      id: "fail",
      label: "fail",
      blurb: "Broken or rejected (e.g. self-test red) — BLOCKED.",
    },
    {
      id: "waived",
      label: "waived",
      blurb: "Documented waiver with owner — closed for READY.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: all met",
      marks: { docs: "met", api: "met", self_test: "met" },
      selDeliv: "docs",
      selStatus: "met",
      note: "Docs, API, and self-test all met — handoff READY.",
      autoScan: true,
    },
    docs_gap: {
      label: "docs open",
      marks: { docs: "open", api: "met", self_test: "met" },
      selDeliv: "docs",
      selStatus: "met",
      note: "API + self-test present; docs still open.",
      autoScan: true,
    },
    self_fail: {
      label: "self-test fail",
      marks: { docs: "met", api: "met", self_test: "fail" },
      selDeliv: "self_test",
      selStatus: "met",
      note: "Self-test red — handoff BLOCKED.",
      autoScan: true,
    },
    waived_docs: {
      label: "docs waived",
      marks: { docs: "waived", api: "met", self_test: "met" },
      selDeliv: "docs",
      selStatus: "waived",
      note: "Docs waived with owner — still READY.",
      autoScan: true,
    },
    all_open: {
      label: "all open",
      marks: { docs: "open", api: "open", self_test: "open" },
      selDeliv: "docs",
      selStatus: "met",
      note: "Empty handoff pack — nothing delivered.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      marks: { docs: "open", api: "open", self_test: "open" },
      selDeliv: null,
      selStatus: null,
      note: "Idle — select a deliverable and status, then Check off.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// VIP handoff checklist literacy (document aid)
//
// Before transferring a VIP to another team, ship:
//
// 1. docs      — README / quickstart / examples / limits
// 2. api       — sequences, config, callbacks, vif contract
// 3. self_test — standalone smoke that proves it runs
//
// Marks: met | open | fail | waived
//
// READY   = every deliverable met or waived
// OPEN    = something still missing
// BLOCKED = any fail (especially self-test)
//
// Pair with vip-anatomy and signoff-checklist.`;
  }

  function openCount(marks) {
    return DELIVERABLES.filter((d) => (marks[d.id] || "open") === "open")
      .length;
  }

  function failCount(marks) {
    return DELIVERABLES.filter((d) => marks[d.id] === "fail").length;
  }

  function countStatus(marks, id) {
    return DELIVERABLES.filter((d) => marks[d.id] === id).length;
  }

  function evaluate(marks) {
    const fails = failCount(marks);
    if (fails > 0) {
      return {
        status: "BLOCKED",
        ready: false,
        reason: `${fails} deliverable fail(s) — fix before handoff`,
      };
    }
    const open = openCount(marks);
    if (open > 0) {
      return {
        status: "OPEN",
        ready: false,
        reason: `${open} deliverable still open`,
      };
    }
    return {
      status: "READY",
      ready: true,
      reason: "docs + API + self-test met or waived",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.marks);
    return {
      preset: "starter",
      marks: { ...p.marks },
      selDeliv: p.selDeliv,
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

  const CLEARED_KEY = "ddv-vip-handoff-cleared-v1";
  const STORE_KEY = "ddv-vip-handoff-session-v1";

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

  const root = document.getElementById("vph-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>docs_pack</code>,
        <code>api_surface</code>, and
        <code>self_test</code>
        all <strong>met</strong> — handoff READY.</p>
      <button type="button" class="btn btn-secondary" id="vph-starter">Load starter example</button>
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
        <div class="idea-card"><h3>docs</h3><p>README, quickstart, examples, limits.</p></div>
        <div class="idea-card"><h3>API</h3><p>Sequences, config, callbacks, vif.</p></div>
        <div class="idea-card"><h3>self-test</h3><p>Standalone smoke that proves it runs.</p></div>
        <div class="idea-card"><h3>READY</h3><p>All met or waived — safe to hand off.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vph-controls">
        <div class="vph-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>all met</option>
            <option value="docs_gap">docs open</option>
            <option value="self_fail">self-test fail</option>
            <option value="waived_docs">docs waived</option>
            <option value="all_open">all open</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-mark">Check off</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan handoff</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo blocked</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vph-layout">
        <div class="panel-box">
          <h3>Status marks</h3>
          <div class="status-row" id="status-row"></div>
          <h3>Deliverables</h3>
          <ul class="deliv-list" id="deliv-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Handoff sketch</h3>
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
    const lines = DELIVERABLES.map((d) => {
      const m = state.marks[d.id] || "open";
      return `${d.label.padEnd(14)} ${m}`;
    });
    return `# VIP handoff
${lines.join("\n")}
# open:   ${openCount(state.marks)}
# fail:   ${failCount(state.marks)}
# status: ${state.lastScanned ? state.status : "— (Scan handoff)"}
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
    state.selDeliv = p.selDeliv;
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
    if (!state.selDeliv || !state.selStatus) {
      state.lastAction = "mark-bad";
      pushLog("# check-off FAIL (need deliverable + status)");
      renderAll();
      return;
    }
    state.marks[state.selDeliv] = state.selStatus;
    pushTrace(`mark: ${state.selDeliv} → ${state.selStatus}`);
    pushLog(`# check-off ${state.selDeliv} → ${state.selStatus}`);
    runScan(true);
    state.lastAction = "mark";
    renderAll();
  }

  function demo() {
    applyPreset("self_fail", "demo");
    state.demoed = true;
    pushLog("# demo self_test BLOCKED");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain handoff");
    pushTrace("explain: docs|api|self_test → READY if met/waived");
    renderAll();
  }

  function selectDeliv(id) {
    state.selDeliv = id;
    state.lastAction = "select-deliv";
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
    const deliv = DELIVERABLES.find((d) => d.id === state.selDeliv);
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

    document.getElementById("deliv-list").innerHTML = DELIVERABLES.map((d) => {
      const m = state.marks[d.id] || "open";
      const sel = state.selDeliv === d.id;
      return `<li class="${sel ? "is-sel" : ""}" data-deliv="${d.id}">
        <span><span class="id">${d.label}</span><br><span class="kind">${d.kind}</span></span>
        <span class="tag ${tagClass(m)}">${m.toUpperCase()}</span>
        <span></span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-deliv]").forEach((el) => {
      el.addEventListener("click", () =>
        selectDeliv(/** @type {string} */ (el.getAttribute("data-deliv")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a deliverable, pick a status, then Check off.";
    if (deliv && state.lastAction === "select-deliv") blurb = deliv.blurb;
    else if (st && state.lastAction === "select-status") blurb = st.blurb;
    else if (deliv && st) blurb = `${deliv.label} → ${st.label}. ${deliv.blurb}`;
    else if (deliv) blurb = deliv.blurb;
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
      v.textContent = "Idle — Load preset, Check off, or Scan handoff";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Handoff READY — ${state.reason}`;
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
          selDeliv: state.selDeliv,
          selStatus: state.selStatus,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-docs",
      title: "Quiz: docs",
      type: "quiz",
      prompt: "VIP docs for handoff should include…",
      hint: "Onboard.",
      choices: [
        "README / quickstart / examples / known limits for consumers",
        "only a Makefile PHONY",
        "place-and-route scripts",
        "font choices",
      ],
      answer:
        "README / quickstart / examples / known limits for consumers",
    },
    {
      id: "quiz-api",
      title: "Quiz: API",
      type: "quiz",
      prompt: "The API surface deliverable covers…",
      hint: "Contract.",
      choices: [
        "sequences, config knobs, callbacks, and vif contract",
        "only waveform colors",
        "synthesis area",
        "CI badge SVG",
      ],
      answer:
        "sequences, config knobs, callbacks, and vif contract",
    },
    {
      id: "quiz-self",
      title: "Quiz: self-test",
      type: "quiz",
      prompt: "A VIP self-test proves…",
      hint: "Standalone.",
      choices: [
        "the VIP runs standalone via a shipped smoke / self-check",
        "coverage is always 100%",
        "the DUT is taped out",
        "plusargs are unused",
      ],
      answer:
        "the VIP runs standalone via a shipped smoke / self-check",
    },
    {
      id: "quiz-ready",
      title: "Quiz: READY",
      type: "quiz",
      prompt: "Handoff READY means…",
      hint: "Closed rows.",
      choices: [
        "docs, API, and self-test are each met or waived",
        "CI failed once",
        "only docs exist",
        "self-test is red",
      ],
      answer:
        "docs, API, and self-test are each met or waived",
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
      title: "Load docs open",
      prompt: "Load docs open — OPEN.",
      hint: "docs open → Load",
      setup: () => {
        selPreset.value = "docs_gap";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" &&
        !state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-blocked",
      title: "Load self-test fail",
      prompt: "Load self-test fail — BLOCKED.",
      hint: "self-test fail → Load",
      setup: () => {
        selPreset.value = "self_fail";
        loadPreset();
      },
      check: () =>
        state.status === "BLOCKED" && !state.ready,
    },
    {
      id: "load-waived",
      title: "Load docs waived",
      prompt: "Load docs waived — READY.",
      hint: "docs waived → Load",
      setup: () => {
        selPreset.value = "waived_docs";
        loadPreset();
      },
      check: () =>
        state.ready && state.marks.docs === "waived",
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
      prompt: "From docs open, Check off docs → met — READY.",
      hint: "docs open → Check off",
      setup: () => {
        selPreset.value = "docs_gap";
        loadPreset();
        state.selDeliv = "docs";
        state.selStatus = "met";
        checkOff();
      },
      check: () =>
        state.marks.docs === "met" &&
        state.ready &&
        state.lastAction === "mark",
    },
    {
      id: "select-deliv",
      title: "Select deliverable",
      prompt: "Click api_surface row.",
      hint: "Click api_surface",
      setup: () => {
        loadStarter();
        selectDeliv("api");
      },
      check: () =>
        state.selDeliv === "api" &&
        state.lastAction === "select-deliv",
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
      prompt: "On starter, Scan handoff — READY.",
      hint: "Scan handoff",
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
      prompt: "Literacy sketch mentions READY or self_test.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /READY|self_test/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Handoff sketch",
      prompt: "On starter, handoff sketch shows READY.",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vph-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vph-starter").addEventListener("click", () => {
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
        state.selDeliv = saved.selDeliv || null;
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
