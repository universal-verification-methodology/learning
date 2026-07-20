(() => {
  /**
   * Seed / config / tags (concept)
   *   test metadata for replay & triage
   * Starter: seed + config + tags filled — REPLAYABLE
   */

  const FIELDS = [
    {
      id: "seed",
      label: "seed",
      blurb: "Fixed RNG seed so the failing stimulus can be replayed.",
    },
    {
      id: "config",
      label: "config",
      blurb: "Plusargs / knobs that selected the test and DUT mode.",
    },
    {
      id: "tags",
      label: "tags",
      blurb: "Labels for triage buckets (smoke, nightly, flake, …).",
    },
  ];

  const OPTIONS = {
    seed: [
      { id: "42", label: "42", blurb: "Classic fixed seed for replay." },
      { id: "7", label: "7", blurb: "Alternate fixed seed." },
    ],
    config: [
      {
        id: "uart_byte",
        label: "+UVM_TESTNAME=uart_byte +BAUD=115200",
        blurb: "Named test + baud — enough to re-launch the same config.",
      },
      {
        id: "bare",
        label: "+SEED only",
        blurb: "Seed alone without testname — weak for replay.",
      },
    ],
    tags: [
      {
        id: "smoke_nightly",
        label: "smoke,nightly",
        blurb: "Tier tags for which regression slice found it.",
      },
      {
        id: "flake",
        label: "flake",
        blurb: "Quarantine / flake tag for triage boards.",
      },
    ],
  };

  const PRESETS = {
    starter: {
      label: "starter: complete card",
      meta: { seed: "42", config: "uart_byte", tags: "smoke_nightly" },
      selField: "seed",
      selOpt: "42",
      note: "Seed, config, and tags filled — REPLAYABLE.",
      autoScan: true,
    },
    no_seed: {
      label: "missing seed",
      meta: { seed: null, config: "uart_byte", tags: "smoke_nightly" },
      selField: "seed",
      selOpt: "42",
      note: "Config + tags present but seed missing — NEED_SEED.",
      autoScan: true,
    },
    no_config: {
      label: "missing config",
      meta: { seed: "42", config: null, tags: "smoke_nightly" },
      selField: "config",
      selOpt: "uart_byte",
      note: "Seed + tags but no config — NEED_CONFIG.",
      autoScan: true,
    },
    weak: {
      label: "weak config",
      meta: { seed: "42", config: "bare", tags: "flake" },
      selField: "config",
      selOpt: "uart_byte",
      note: "Seed-only config — WEAK for full replay.",
      autoScan: true,
    },
    empty: {
      label: "empty card",
      meta: { seed: null, config: null, tags: null },
      selField: "seed",
      selOpt: "42",
      note: "Blank metadata card — nothing to replay.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      meta: { seed: null, config: null, tags: null },
      selField: null,
      selOpt: null,
      note: "Idle — select a field and value, then Attach.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Seed / config / tags literacy (document aid)
//
// Every interesting run should record:
//
// 1. seed   — fixed RNG seed for replay
// 2. config — plusargs / knobs (testname, baud, …)
// 3. tags   — smoke / nightly / flake / quarantine
//
// REPLAYABLE = seed + strong config + tags
// NEED_*     = a required field still empty
// WEAK       = seed-only config (hard to re-launch the same test)
//
// Log these in CI artifacts and triage boards.
// Pair with regression-triage and uvm-plusargs.`;
  }

  function optLabel(field, id) {
    if (!id) return null;
    const o = (OPTIONS[field] || []).find((x) => x.id === id);
    return o ? o.label : id;
  }

  function openFields(meta) {
    return FIELDS.filter((f) => !meta[f.id]);
  }

  function evaluate(meta) {
    if (!meta.seed) {
      return { status: "NEED_SEED", ready: false, reason: "attach a fixed seed" };
    }
    if (!meta.config) {
      return {
        status: "NEED_CONFIG",
        ready: false,
        reason: "attach plusargs / knobs",
      };
    }
    if (!meta.tags) {
      return { status: "NEED_TAGS", ready: false, reason: "attach triage tags" };
    }
    if (meta.config === "bare") {
      return {
        status: "WEAK",
        ready: false,
        reason: "config is seed-only — prefer named test + knobs",
      };
    }
    return {
      status: "REPLAYABLE",
      ready: true,
      reason: "seed + config + tags complete",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.meta);
    return {
      preset: "starter",
      meta: { ...p.meta },
      selField: p.selField,
      selOpt: p.selOpt,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: REPLAYABLE"],
    };
  }

  const CLEARED_KEY = "ddv-seed-tags-cleared-v1";
  const STORE_KEY = "ddv-seed-tags-session-v1";

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

  const root = document.getElementById("sdt-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        seed <code>42</code>,
        config <code>+UVM_TESTNAME=uart_byte +BAUD=115200</code>,
        tags <code>smoke,nightly</code> —
        card REPLAYABLE.</p>
      <button type="button" class="btn btn-secondary" id="sdt-starter">Load starter example</button>
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
        <div class="idea-card"><h3>seed</h3><p>Fixed RNG seed for exact replay.</p></div>
        <div class="idea-card"><h3>config</h3><p>Plusargs / knobs that select the run.</p></div>
        <div class="idea-card"><h3>tags</h3><p>smoke / nightly / flake for triage.</p></div>
        <div class="idea-card"><h3>REPLAYABLE</h3><p>All three present with a strong config.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="sdt-controls">
        <div class="sdt-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>complete card</option>
            <option value="no_seed">missing seed</option>
            <option value="no_config">missing config</option>
            <option value="weak">weak config</option>
            <option value="empty">empty card</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-attach">Attach</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan card</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo weak</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="sdt-layout">
        <div class="panel-box">
          <h3>Metadata chain</h3>
          <div class="meta-chain" id="meta-chain"></div>
          <h3>Fields</h3>
          <ul class="field-list" id="field-list"></ul>
          <h3>Values</h3>
          <div class="pick-row" id="opt-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Run card</h3>
          <pre class="card-box" id="card-box"></pre>
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

  function cardSketch() {
    return `# run card
seed:   ${optLabel("seed", state.meta.seed) || "—"}
config: ${optLabel("config", state.meta.config) || "—"}
tags:   ${optLabel("tags", state.meta.tags) || "—"}
#
# open:   ${openFields(state.meta).map((f) => f.id).join(", ") || "(none)"}
# status: ${state.lastScanned ? state.status : "— (Scan card)"}
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
    pushLog("# starter REPLAYABLE");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.meta);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status}`);
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
    state.meta = { ...p.meta };
    state.selField = p.selField;
    state.selOpt = p.selOpt;
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

  function attach() {
    if (!state.selField || !state.selOpt) {
      state.lastAction = "attach-bad";
      pushLog("# attach FAIL (need field + value)");
      renderAll();
      return;
    }
    const opts = OPTIONS[state.selField] || [];
    if (!opts.some((o) => o.id === state.selOpt)) {
      state.lastAction = "attach-bad";
      pushLog("# attach FAIL (value not for field)");
      renderAll();
      return;
    }
    state.meta[state.selField] = state.selOpt;
    pushTrace(`attach: ${state.selField}=${state.selOpt}`);
    pushLog(`# attach ${state.selField}=${state.selOpt}`);
    runScan(true);
    state.lastAction = "attach";
    renderAll();
  }

  function demo() {
    applyPreset("weak", "demo");
    state.demoed = true;
    pushLog("# demo weak config");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain metadata");
    pushTrace("explain: seed|config|tags → REPLAYABLE");
    renderAll();
  }

  function selectField(id) {
    state.selField = id;
    const opts = OPTIONS[id] || [];
    if (!opts.some((o) => o.id === state.selOpt)) {
      state.selOpt = opts[0] ? opts[0].id : null;
    }
    state.lastAction = "select-field";
    renderAll();
  }

  function selectOpt(id) {
    state.selOpt = id;
    state.lastAction = "select-opt";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const field = FIELDS.find((f) => f.id === state.selField);
    const opts = state.selField ? OPTIONS[state.selField] || [] : [];
    const opt = opts.find((o) => o.id === state.selOpt);

    const parts = FIELDS.map((f) => {
      const lab = optLabel(f.id, state.meta[f.id]);
      return lab || `<span class="gap">?${f.id}</span>`;
    });
    document.getElementById("meta-chain").innerHTML = parts.join(" · ");

    document.getElementById("field-list").innerHTML = FIELDS.map((f) => {
      const set = !!state.meta[f.id];
      const sel = state.selField === f.id;
      return `<li class="${sel ? "is-sel" : ""}" data-field="${f.id}">
        <span class="id">${f.label}</span>
        <span class="tag ${set ? "is-set" : "is-open"}">${set ? "SET" : "OPEN"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("click", () =>
        selectField(/** @type {string} */ (el.getAttribute("data-field")))
      );
    });

    document.getElementById("opt-row").innerHTML = (opts.length
      ? opts
      : [{ id: "", label: "(pick a field)", blurb: "" }]
    )
      .map((o) => {
        if (!o.id) {
          return `<button type="button" class="pick-card" disabled>
            <div class="k">value</div>
            <div class="v">${o.label}</div>
          </button>`;
        }
        const on = state.meta[state.selField] === o.id;
        const sel = state.selOpt === o.id;
        return `<button type="button" class="pick-card ${on ? "is-on" : ""} ${sel ? "is-sel" : ""}" data-opt="${o.id}">
          <div class="k">${state.selField}</div>
          <div class="v">${o.label}</div>
        </button>`;
      })
      .join("");
    document.querySelectorAll("[data-opt]").forEach((el) => {
      el.addEventListener("click", () =>
        selectOpt(/** @type {string} */ (el.getAttribute("data-opt")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a field, pick a value, then Attach.";
    if (field && state.lastAction === "select-field") blurb = field.blurb;
    else if (opt && state.lastAction === "select-opt") blurb = opt.blurb;
    else if (field && opt) blurb = `${field.label}: ${opt.blurb}`;
    else if (field) blurb = field.blurb;
    else if (opt) blurb = opt.blurb;
    document.getElementById("role-blurb").textContent = blurb;
    document.getElementById("card-box").textContent = cardSketch();
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
      v.textContent = "Idle — Load preset, Attach, or Scan card";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Card REPLAYABLE — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const openN = openFields(state.meta).length;
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${openN ? "is-bad" : "is-ok"}">open=${openN}</span>
      <span class="flag ${state.meta.seed ? "is-ok" : "is-bad"}">seed=${state.meta.seed || "—"}</span>
      <span class="flag ${state.meta.config && state.meta.config !== "bare" ? "is-ok" : state.meta.config ? "is-bad" : "is-bad"}">config=${state.meta.config || "—"}</span>
      <span class="flag ${state.meta.tags ? "is-ok" : "is-bad"}">tags=${state.meta.tags || "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          meta: state.meta,
          selField: state.selField,
          selOpt: state.selOpt,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-seed",
      title: "Quiz: seed",
      type: "quiz",
      prompt: "A fixed seed is recorded so that…",
      hint: "Replay.",
      choices: [
        "the same RNG path can be replayed when debugging a fail",
        "synthesis area shrinks",
        "coverage is ignored",
        "Makefile PHONY works",
      ],
      answer:
        "the same RNG path can be replayed when debugging a fail",
    },
    {
      id: "quiz-config",
      title: "Quiz: config",
      type: "quiz",
      prompt: "Config metadata should include…",
      hint: "Plusargs.",
      choices: [
        "plusargs / knobs that selected the test and DUT mode",
        "only the hostname",
        "VCD file size",
        "font choice in the IDE",
      ],
      answer:
        "plusargs / knobs that selected the test and DUT mode",
    },
    {
      id: "quiz-tags",
      title: "Quiz: tags",
      type: "quiz",
      prompt: "Tags help with…",
      hint: "Triage.",
      choices: [
        "triage buckets such as smoke, nightly, flake, quarantine",
        "replacing the scoreboard",
        "gate-level netlists",
        "UART baud only",
      ],
      answer:
        "triage buckets such as smoke, nightly, flake, quarantine",
    },
    {
      id: "quiz-replayable",
      title: "Quiz: REPLAYABLE",
      type: "quiz",
      prompt: "REPLAYABLE means…",
      hint: "Complete card.",
      choices: [
        "seed + strong config + tags are all present",
        "CI is green only",
        "coverage is 100%",
        "seed alone is enough",
      ],
      answer: "seed + strong config + tags are all present",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — REPLAYABLE.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "REPLAYABLE",
    },
    {
      id: "load-no-seed",
      title: "Load missing seed",
      prompt: "Load missing seed — NEED_SEED.",
      hint: "missing seed → Load",
      setup: () => {
        selPreset.value = "no_seed";
        loadPreset();
      },
      check: () =>
        state.status === "NEED_SEED" &&
        !state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-no-config",
      title: "Load missing config",
      prompt: "Load missing config — NEED_CONFIG.",
      hint: "missing config → Load",
      setup: () => {
        selPreset.value = "no_config";
        loadPreset();
      },
      check: () =>
        state.status === "NEED_CONFIG" && !state.ready,
    },
    {
      id: "load-weak",
      title: "Load weak",
      prompt: "Load weak config — WEAK.",
      hint: "weak config → Load",
      setup: () => {
        selPreset.value = "weak";
        loadPreset();
      },
      check: () =>
        state.status === "WEAK" && state.meta.config === "bare",
    },
    {
      id: "load-empty",
      title: "Load empty",
      prompt: "Load empty card — open=3.",
      hint: "empty card → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        openFields(state.meta).length === 3 &&
        state.status === "NEED_SEED",
    },
    {
      id: "attach",
      title: "Attach",
      prompt: "From missing seed, Attach seed 42 — REPLAYABLE.",
      hint: "missing seed → Attach",
      setup: () => {
        selPreset.value = "no_seed";
        loadPreset();
        state.selField = "seed";
        state.selOpt = "42";
        attach();
      },
      check: () =>
        state.meta.seed === "42" &&
        state.ready &&
        state.lastAction === "attach",
    },
    {
      id: "select-field",
      title: "Select field",
      prompt: "Click the tags field row.",
      hint: "Click tags",
      setup: () => {
        loadStarter();
        selectField("tags");
      },
      check: () =>
        state.selField === "tags" &&
        state.lastAction === "select-field",
    },
    {
      id: "select-opt",
      title: "Select value",
      prompt: "On seed field, click value 7.",
      hint: "seed → 7",
      setup: () => {
        loadStarter();
        selectField("seed");
        selectOpt("7");
      },
      check: () =>
        state.selOpt === "7" &&
        state.lastAction === "select-opt",
    },
    {
      id: "scan-ok",
      title: "Scan REPLAYABLE",
      prompt: "On starter, Scan card — REPLAYABLE.",
      hint: "Scan card",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan NEED_SEED",
      prompt: "On empty, Scan — NEED_SEED.",
      hint: "empty → Scan",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo weak",
      prompt: "Click Demo weak.",
      hint: "Demo weak",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "WEAK" &&
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
      prompt: "Literacy sketch mentions REPLAYABLE or seed.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /REPLAYABLE|seed/i.test(sourceSketch()),
    },
    {
      id: "card-sketch",
      title: "Run card",
      prompt: "On starter, run card shows REPLAYABLE.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /REPLAYABLE/.test(document.getElementById("card-box").textContent),
    },
    {
      id: "open-zero",
      title: "Open zero",
      prompt: "Starter open count is 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => openFields(state.meta).length === 0,
    },
    {
      id: "starter-config",
      title: "Starter config",
      prompt: "Starter config is uart_byte (strong).",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.meta.config === "uart_byte",
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
      prompt: "From empty, Reset — REPLAYABLE again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "REPLAYABLE",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="sdt-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("sdt-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-attach").addEventListener("click", () => attach());
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
        state.meta = saved.meta || state.meta;
        state.selField = saved.selField || null;
        state.selOpt = saved.selOpt || null;
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
