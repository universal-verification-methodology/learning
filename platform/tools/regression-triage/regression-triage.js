(() => {
  /**
   * Regression triage board (concept)
   *   fail / flake / new / env buckets
   * Starter: three fails already bucketed — board CLEAN
   */

  const FAILS = [
    {
      id: "uart_parity",
      label: "uart_parity",
      blurb: "Parity mismatch on RX — usually a real DUT or VIP fail.",
    },
    {
      id: "spi_timeout",
      label: "spi_timeout",
      blurb: "Intermittent timeout — often a flake (seed / race / farm noise).",
    },
    {
      id: "i2c_nack",
      label: "i2c_nack",
      blurb: "First-seen NACK this night — mark new until root-caused.",
    },
  ];

  const BUCKETS = [
    {
      id: "fail",
      label: "fail",
      blurb: "Reproducible DUT / VIP / scoreboard failure — own and fix.",
    },
    {
      id: "flake",
      label: "flake",
      blurb: "Intermittent / seed-sensitive — quarantine, stabilize, don't bury.",
    },
    {
      id: "new",
      label: "new",
      blurb: "First appearance this run — escalate; don't assume known.",
    },
    {
      id: "env",
      label: "env",
      blurb: "Farm / license / disk / tool crash — infra, not design.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: all triaged",
      buckets: { uart_parity: "fail", spi_timeout: "flake", i2c_nack: "new" },
      selFail: "uart_parity",
      selBucket: "fail",
      note: "Three fails already bucketed — board CLEAN.",
      autoScan: true,
    },
    open_one: {
      label: "one still open",
      buckets: { uart_parity: "open", spi_timeout: "flake", i2c_nack: "new" },
      selFail: "uart_parity",
      selBucket: "fail",
      note: "uart_parity still open — triage it.",
      autoScan: true,
    },
    all_open: {
      label: "all open",
      buckets: { uart_parity: "open", spi_timeout: "open", i2c_nack: "open" },
      selFail: "uart_parity",
      selBucket: "fail",
      note: "Nightly dump — nothing triaged yet.",
      autoScan: true,
    },
    all_flake: {
      label: "all flake",
      buckets: { uart_parity: "flake", spi_timeout: "flake", i2c_nack: "flake" },
      selFail: "spi_timeout",
      selBucket: "flake",
      note: "Everything marked flake — CLEAN but investigate stability.",
      autoScan: true,
    },
    env_hit: {
      label: "env crash",
      buckets: { uart_parity: "env", spi_timeout: "flake", i2c_nack: "new" },
      selFail: "uart_parity",
      selBucket: "env",
      note: "uart_parity is farm/license noise — env bucket.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      buckets: { uart_parity: "open", spi_timeout: "open", i2c_nack: "open" },
      selFail: null,
      selBucket: null,
      note: "Idle — select a fail and bucket, then Triage.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Regression triage board literacy (document aid)
//
// 1. Ingest fail list from nightly / CI
// 2. Bucket each: fail | flake | new | env
// 3. Do not leave items "open"
// 4. Re-scan → CLEAN when open count is 0
//
// fail  = reproducible design/VIP issue
// flake = intermittent — quarantine + stabilize
// new   = first-seen this run — escalate
// env   = infra / tool / license — not DUT
//
// CLEAN = no open rows
// Pair with seed-tags and ci-farm-flow when those ship.`;
  }

  function openCount(buckets) {
    return FAILS.filter((f) => (buckets[f.id] || "open") === "open").length;
  }

  function countBucket(buckets, id) {
    return FAILS.filter((f) => buckets[f.id] === id).length;
  }

  function evaluate(buckets) {
    const open = openCount(buckets);
    if (open === 0) {
      return { status: "CLEAN", clean: true, reason: "no open fails" };
    }
    return {
      status: "OPEN",
      clean: false,
      reason: `${open} fail(s) still untriaged`,
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.buckets);
    return {
      preset: "starter",
      buckets: { ...p.buckets },
      selFail: p.selFail,
      selBucket: p.selBucket,
      note: p.note,
      status: ev.status,
      clean: ev.clean,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: CLEAN open=0"],
    };
  }

  const CLEARED_KEY = "ddv-regression-triage-cleared-v1";
  const STORE_KEY = "ddv-regression-triage-session-v1";

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

  const root = document.getElementById("rtr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>uart_parity</code>→fail,
        <code>spi_timeout</code>→flake,
        <code>i2c_nack</code>→new —
        board CLEAN.</p>
      <button type="button" class="btn btn-secondary" id="rtr-starter">Load starter example</button>
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
        <div class="idea-card"><h3>fail</h3><p>Reproducible DUT / VIP / checker break.</p></div>
        <div class="idea-card"><h3>flake</h3><p>Intermittent — quarantine, don't ignore.</p></div>
        <div class="idea-card"><h3>new</h3><p>First-seen this night — escalate early.</p></div>
        <div class="idea-card"><h3>CLEAN</h3><p>Zero open rows — triage complete.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="rtr-controls">
        <div class="rtr-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>all triaged</option>
            <option value="open_one">one still open</option>
            <option value="all_open">all open</option>
            <option value="all_flake">all flake</option>
            <option value="env_hit">env crash</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-triage">Triage</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan board</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo open</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="rtr-layout">
        <div class="panel-box">
          <h3>Buckets</h3>
          <div class="bucket-row" id="bucket-row"></div>
          <h3>Fail list</h3>
          <ul class="fail-list" id="fail-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Board sketch</h3>
          <pre class="board-box" id="board-box"></pre>
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

  function boardSketch() {
    const lines = FAILS.map((f) => {
      const b = state.buckets[f.id] || "open";
      return `${f.label.padEnd(14)} ${b}`;
    });
    return `# board
${lines.join("\n")}
# open:   ${openCount(state.buckets)}
# status: ${state.lastScanned ? state.status : "— (Scan board)"}
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
    pushLog("# starter CLEAN");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.buckets);
    state.status = ev.status;
    state.clean = ev.clean;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status} open=${openCount(state.buckets)}`);
    if (!silent) {
      state.lastAction = ev.clean ? "scan-ok" : "scan-bad";
      pushLog(`# scan ${ev.status}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.buckets = { ...p.buckets };
    state.selFail = p.selFail;
    state.selBucket = p.selBucket;
    state.note = p.note;
    state.status = "—";
    state.clean = false;
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

  function triage() {
    if (!state.selFail || !state.selBucket) {
      state.lastAction = "triage-bad";
      pushLog("# triage FAIL (need fail + bucket)");
      renderAll();
      return;
    }
    state.buckets[state.selFail] = state.selBucket;
    pushTrace(`triage: ${state.selFail} → ${state.selBucket}`);
    pushLog(`# triage ${state.selFail} → ${state.selBucket}`);
    runScan(true);
    state.lastAction = "triage";
    renderAll();
  }

  function demo() {
    applyPreset("open_one", "demo");
    state.demoed = true;
    pushLog("# demo open_one");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain buckets");
    pushTrace("explain: fail|flake|new|env → CLEAN when open=0");
    renderAll();
  }

  function selectFail(id) {
    state.selFail = id;
    state.lastAction = "select-fail";
    state.lastScanned = state.lastScanned;
    renderAll();
  }

  function selectBucket(id) {
    state.selBucket = id;
    state.lastAction = "select-bucket";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const fail = FAILS.find((f) => f.id === state.selFail);
    const bucket = BUCKETS.find((b) => b.id === state.selBucket);

    document.getElementById("bucket-row").innerHTML = BUCKETS.map((b) => {
      const n = countBucket(state.buckets, b.id);
      const on = state.selBucket === b.id;
      return `<button type="button" class="bucket-card ${on ? "is-sel" : ""}" data-bucket="${b.id}">
        <div class="k">${b.label} · ${n}</div>
        <div class="v">${b.id}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-bucket]").forEach((el) => {
      el.addEventListener("click", () =>
        selectBucket(/** @type {string} */ (el.getAttribute("data-bucket")))
      );
    });

    document.getElementById("fail-list").innerHTML = FAILS.map((f) => {
      const b = state.buckets[f.id] || "open";
      const sel = state.selFail === f.id;
      const tagClass =
        b === "open"
          ? "is-open"
          : b === "fail"
            ? "is-fail"
            : b === "flake"
              ? "is-flake"
              : b === "new"
                ? "is-new"
                : "is-env";
      return `<li class="${sel ? "is-sel" : ""}" data-fail="${f.id}">
        <span class="id">${f.label}</span>
        <span class="tag ${tagClass}">${b.toUpperCase()}</span>
        <span></span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-fail]").forEach((el) => {
      el.addEventListener("click", () =>
        selectFail(/** @type {string} */ (el.getAttribute("data-fail")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a fail, pick a bucket, then Triage.";
    if (fail && state.lastAction === "select-fail") blurb = fail.blurb;
    else if (bucket && state.lastAction === "select-bucket") blurb = bucket.blurb;
    else if (fail && bucket) blurb = `${fail.label} → ${bucket.label}. ${fail.blurb}`;
    else if (fail) blurb = fail.blurb;
    else if (bucket) blurb = bucket.blurb;
    document.getElementById("role-blurb").textContent = blurb;
    document.getElementById("board-box").textContent = boardSketch();
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
      v.textContent = "Idle — Load preset, Triage, or Scan board";
    } else if (state.clean) {
      v.className = "verdict yes";
      v.textContent = `Board CLEAN — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const openN = openCount(state.buckets);
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.clean && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">clean=${state.lastScanned ? (state.clean ? 1 : 0) : "—"}</span>
      <span class="flag ${openN ? "is-bad" : "is-ok"}">open=${openN}</span>
      <span class="flag is-ok">fail=${countBucket(state.buckets, "fail")}</span>
      <span class="flag is-ok">flake=${countBucket(state.buckets, "flake")}</span>
      <span class="flag is-ok">new=${countBucket(state.buckets, "new")}</span>
      <span class="flag is-ok">env=${countBucket(state.buckets, "env")}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          buckets: state.buckets,
          selFail: state.selFail,
          selBucket: state.selBucket,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-fail",
      title: "Quiz: fail",
      type: "quiz",
      prompt: "The fail bucket is for…",
      hint: "Reproducible.",
      choices: [
        "reproducible DUT / VIP / scoreboard failures to own and fix",
        "any license-server timeout",
        "passing tests only",
        "Makefile PHONY targets",
      ],
      answer: "reproducible DUT / VIP / scoreboard failures to own and fix",
    },
    {
      id: "quiz-flake",
      title: "Quiz: flake",
      type: "quiz",
      prompt: "A flake is…",
      hint: "Intermittent.",
      choices: [
        "an intermittent / seed-sensitive fail — quarantine and stabilize",
        "always a DUT bug to ignore",
        "a coverage hole",
        "a sign-off stamp",
      ],
      answer: "an intermittent / seed-sensitive fail — quarantine and stabilize",
    },
    {
      id: "quiz-new",
      title: "Quiz: new",
      type: "quiz",
      prompt: "Mark new when…",
      hint: "First-seen.",
      choices: [
        "the fail first appears this run / night — escalate early",
        "the test always passed",
        "coverage is 100%",
        "the farm is offline",
      ],
      answer: "the fail first appears this run / night — escalate early",
    },
    {
      id: "quiz-clean",
      title: "Quiz: CLEAN",
      type: "quiz",
      prompt: "Board CLEAN means…",
      hint: "Open=0.",
      choices: [
        "every fail row has a bucket — open count is zero",
        "all tests passed",
        "coverage is closed",
        "CI is green only",
      ],
      answer: "every fail row has a bucket — open count is zero",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — CLEAN.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.clean &&
        state.status === "CLEAN",
    },
    {
      id: "load-open",
      title: "Load open one",
      prompt: "Load one still open — OPEN.",
      hint: "one still open → Load",
      setup: () => {
        selPreset.value = "open_one";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" &&
        !state.clean &&
        state.lastAction === "load",
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
        openCount(state.buckets) === 3 && state.status === "OPEN",
    },
    {
      id: "load-flake",
      title: "Load all flake",
      prompt: "Load all flake — CLEAN.",
      hint: "all flake → Load",
      setup: () => {
        selPreset.value = "all_flake";
        loadPreset();
      },
      check: () =>
        state.clean &&
        countBucket(state.buckets, "flake") === 3,
    },
    {
      id: "load-env",
      title: "Load env",
      prompt: "Load env crash — uart_parity is env.",
      hint: "env crash → Load",
      setup: () => {
        selPreset.value = "env_hit";
        loadPreset();
      },
      check: () =>
        state.buckets.uart_parity === "env" && state.clean,
    },
    {
      id: "triage",
      title: "Triage",
      prompt: "From open_one, Triage uart → fail — CLEAN.",
      hint: "one still open → Triage",
      setup: () => {
        selPreset.value = "open_one";
        loadPreset();
        state.selFail = "uart_parity";
        state.selBucket = "fail";
        triage();
      },
      check: () =>
        state.buckets.uart_parity === "fail" &&
        state.clean &&
        state.lastAction === "triage",
    },
    {
      id: "select-fail",
      title: "Select fail",
      prompt: "Click spi_timeout row.",
      hint: "Click spi_timeout",
      setup: () => {
        loadStarter();
        selectFail("spi_timeout");
      },
      check: () =>
        state.selFail === "spi_timeout" &&
        state.lastAction === "select-fail",
    },
    {
      id: "select-bucket",
      title: "Select bucket",
      prompt: "Click the flake bucket card.",
      hint: "Click flake",
      setup: () => {
        loadStarter();
        selectBucket("flake");
      },
      check: () =>
        state.selBucket === "flake" &&
        state.lastAction === "select-bucket",
    },
    {
      id: "scan-ok",
      title: "Scan CLEAN",
      prompt: "On starter, Scan board — CLEAN.",
      hint: "Scan board",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.clean && state.lastAction === "scan-ok",
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
        !state.clean && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo open",
      prompt: "Click Demo open.",
      hint: "Demo open",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "OPEN" &&
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
      prompt: "Literacy sketch mentions CLEAN or flake.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /CLEAN|flake/i.test(sourceSketch()),
    },
    {
      id: "board-sketch",
      title: "Board sketch",
      prompt: "On starter, board sketch shows CLEAN.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /CLEAN/.test(document.getElementById("board-box").textContent),
    },
    {
      id: "open-zero",
      title: "Open zero",
      prompt: "Starter open count is 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => openCount(state.buckets) === 0,
    },
    {
      id: "starter-mix",
      title: "Starter mix",
      prompt: "Starter has fail+flake+new one each.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        countBucket(state.buckets, "fail") === 1 &&
        countBucket(state.buckets, "flake") === 1 &&
        countBucket(state.buckets, "new") === 1,
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
      prompt: "From all open, Reset — CLEAN again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "CLEAN",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="rtr-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("rtr-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-triage").addEventListener("click", () => triage());
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
        state.buckets = saved.buckets || state.buckets;
        state.selFail = saved.selFail || null;
        state.selBucket = saved.selBucket || null;
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
