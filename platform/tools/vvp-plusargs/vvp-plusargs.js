(() => {
  /**
   * vvp plusargs (concept)
   *   runtime +ARGS on vvp; $test$plusargs / $value$plusargs
   * Starter: vvp sim.vvp +SEED=1 +VERBOSE — READY
   */

  const KNOB_BLURB = {
    vvp: "vvp runs the compiled .vvp; plusargs after the binary are runtime knobs (not iverilog compile flags).",
    test: "$test$plusargs(\"NAME\") is true when +NAME (or +NAME=…) appears on the vvp command line.",
    value: "$value$plusargs(\"KEY=%fmt\", var) copies the value from +KEY=… into a TB variable.",
    seed: "+SEED=N is a common replay knob read with $value$plusargs(\"SEED=%d\", seed).",
    flag: "Bare +VERBOSE / +DUMP style flags are presence-only — use $test$plusargs.",
  };

  const PRESETS = {
    starter: {
      label: "starter: SEED + VERBOSE",
      cli: "vvp sim.vvp +SEED=1 +VERBOSE",
      note: "Runtime plusargs present — $value$plusargs SEED and $test$plusargs VERBOSE both hit — READY.",
      autoParse: true,
    },
    dump: {
      label: "DUMP + MODE",
      cli: "vvp sim.vvp +DUMP +MODE=waves",
      note: "Flag + valued knob — typical dump enable.",
      autoParse: true,
    },
    seed_only: {
      label: "SEED only",
      cli: "vvp sim.vvp +SEED=42",
      note: "Value plusarg only — still READY (TB can read SEED).",
      autoParse: true,
    },
    no_plus: {
      label: "vvp, no plusargs",
      cli: "vvp sim.vvp",
      note: "Binary only — OPEN (no runtime knobs for the TB).",
      autoParse: true,
    },
    miss_seed: {
      label: "VERBOSE without SEED",
      cli: "vvp sim.vvp +VERBOSE",
      note: "Flag present, but TB seed probe MISS if it requires +SEED.",
      autoParse: true,
      requireSeed: true,
    },
    empty: {
      label: "empty",
      cli: "",
      note: "Empty — type a vvp line or Load a preset, then Parse.",
      autoParse: false,
    },
  };

  function sourceSketch() {
    return `// vvp plusargs literacy (document aid — not a real vvp run)
//
//   iverilog -o sim.vvp tb.v dut.v     // compile (see iverilog-flags)
//   vvp sim.vvp +SEED=1 +VERBOSE      // runtime plusargs
//
// In the TB:
//   if ($test$plusargs("VERBOSE")) …           // presence
//   if ($value$plusargs("SEED=%d", seed)) …    // valued
//
// Compile-time +incdir+… is NOT a vvp plusarg.
// UVM +UVM_TESTNAME is a different stack (see uvm-plusargs).
//
// READY = vvp binary + ≥1 plusarg, and required probes hit.`;
  }

  function parseCli(cli, opts) {
    const requireSeed = !!(opts && opts.requireSeed);
    const raw = String(cli || "").trim();
    const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];
    let binary = "";
    /** @type {Record<string, string>} */
    const map = {};
    const flags = [];
    const valued = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "vvp") {
        binary = tokens[i + 1] || "";
        if (tokens[i + 1] && !tokens[i + 1].startsWith("+")) i++;
        continue;
      }
      if (!t.startsWith("+")) {
        if (!binary && /\.vvp$/i.test(t)) binary = t;
        continue;
      }
      const body = t.slice(1);
      const eq = body.indexOf("=");
      if (eq < 0) {
        const k = body.toUpperCase();
        map[k] = "1";
        flags.push(k);
      } else {
        const k = body.slice(0, eq).toUpperCase();
        const v = body.slice(eq + 1);
        map[k] = v;
        valued.push({ key: k, value: v });
      }
    }

    const seed = map.SEED || "";
    const verbose = !!map.VERBOSE;
    const dump = !!map.DUMP;
    const mode = map.MODE || "";
    const plusCount = flags.length + valued.length;
    const hasVvp = !!binary || tokens[0] === "vvp" || /\.vvp$/i.test(raw);
    const testVerbose = verbose;
    const testDump = dump;
    const valueSeed = seed !== "";
    const valueMode = mode !== "";

    let seedProbe = true;
    if (requireSeed) seedProbe = valueSeed;

    let status = "OPEN";
    let ready = false;
    let reason = "need vvp binary and plusargs";

    if (!raw) {
      status = "OPEN";
      reason = "empty command line";
    } else if (!hasVvp && plusCount === 0) {
      status = "OPEN";
      reason = "no vvp / plusargs recognized";
    } else if (plusCount === 0) {
      status = "OPEN";
      reason = "vvp with no +plusargs";
    } else if (!seedProbe) {
      status = "MISS";
      ready = false;
      reason = "$value$plusargs SEED miss — +SEED not on line";
    } else {
      status = "READY";
      ready = true;
      reason = `$test$ / $value$ probes hit (${plusCount} plusarg(s))`;
    }

    return {
      tokens,
      binary: binary || (hasVvp ? "sim.vvp" : ""),
      map,
      flags,
      valued,
      seed,
      verbose,
      dump,
      mode,
      plusCount,
      hasVvp,
      testVerbose,
      testDump,
      valueSeed,
      valueMode,
      seedProbe,
      requireSeed,
      status,
      ready,
      reason,
    };
  }

  function makeStarter() {
    const p = parseCli(PRESETS.starter.cli, {});
    return {
      preset: "starter",
      cli: PRESETS.starter.cli,
      note: PRESETS.starter.note,
      requireSeed: false,
      selected: "seed",
      parsed: p,
      lastParsed: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`parse: ${p.status} plus=${p.plusCount}`],
    };
  }

  const CLEARED_KEY = "ddv-vvp-plusargs-cleared-v1";
  const STORE_KEY = "ddv-vvp-plusargs-session-v1";

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

  const root = document.getElementById("vpp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>vvp sim.vvp +SEED=1 +VERBOSE</code> —
        $value$plusargs SEED and $test$plusargs VERBOSE — READY.</p>
      <button type="button" class="btn btn-secondary" id="vpp-starter">Load starter example</button>
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
        <div class="idea-card"><h3>vvp +ARGS</h3><p>Runtime knobs after the .vvp binary.</p></div>
        <div class="idea-card"><h3>$test$plusargs</h3><p>True when a +NAME flag is present.</p></div>
        <div class="idea-card"><h3>$value$plusargs</h3><p>Copies +KEY=value into a TB var.</p></div>
        <div class="idea-card"><h3>≠ +incdir</h3><p>Compile-time includes are not vvp plusargs.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vpp-controls">
        <div class="vpp-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>SEED + VERBOSE</option>
            <option value="dump">DUMP + MODE</option>
            <option value="seed_only">SEED only</option>
            <option value="no_plus">no plusargs</option>
            <option value="miss_seed">miss SEED</option>
            <option value="empty">empty</option>
          </select>
        </div>
        <div class="vpp-field" style="flex:1;min-width:12rem">
          <label for="inp-cli">vvp command line</label>
          <input id="inp-cli" class="cli" type="text" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-parse">Parse</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo no plusargs</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vpp-layout">
        <div class="panel-box">
          <h3>TB probes</h3>
          <div class="knob-row" id="knob-row"></div>
          <h3>Parsed plusargs</h3>
          <ul class="arg-list" id="arg-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Parse sketch</h3>
          <pre class="parse-box" id="parse-box"></pre>
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
  const inpCli = /** @type {HTMLInputElement} */ (document.getElementById("inp-cli"));

  function parseSketch() {
    const p = state.parsed;
    return `// cmdline: ${state.cli || "(empty)"}
// binary: ${p.binary || "—"}
//
// $test$plusargs("VERBOSE") = ${p.testVerbose ? 1 : 0}
// $test$plusargs("DUMP")    = ${p.testDump ? 1 : 0}
// $value$plusargs SEED      = ${p.valueSeed ? p.seed : "— (miss)"}
// $value$plusargs MODE      = ${p.valueMode ? p.mode : "— (miss)"}
//
# status: ${state.lastParsed ? p.status : "— (Parse)"}
# reason: ${state.lastParsed ? p.reason : "—"}`;
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
    inpCli.value = state.cli;
  }

  function runParse(silent) {
    state.cli = (inpCli.value || "").trim();
    const p = parseCli(state.cli, { requireSeed: state.requireSeed });
    state.parsed = p;
    state.lastParsed = true;
    pushTrace(`parse: ${p.status} plus=${p.plusCount}`);
    if (!silent) {
      state.lastAction = p.ready ? "parse-ok" : "parse-bad";
      pushLog(`# parse ${p.status}`);
      renderAll();
    }
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter READY");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.cli = p.cli;
    state.note = p.note;
    state.requireSeed = !!p.requireSeed;
    state.parsed = parseCli("");
    state.lastParsed = false;
    syncInputs();
    if (p.autoParse) {
      runParse(true);
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
    applyPreset("no_plus", "demo");
    state.demoed = true;
    pushLog("# demo no plusargs OPEN");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain $test$ / $value$plusargs");
    pushTrace("explain: vvp +ARGS → $test$plusargs / $value$plusargs (runtime)");
    renderAll();
  }

  function selectKnob(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const p = state.parsed;

    document.getElementById("knob-row").innerHTML = `
      <button type="button" class="knob-card ${state.selected === "seed" ? "is-sel" : ""}" data-knob="seed">
        <div class="k">$value$plusargs SEED</div>
        <div class="v">${p.valueSeed ? p.seed : "—"}</div>
      </button>
      <button type="button" class="knob-card ${state.selected === "test" ? "is-sel" : ""}" data-knob="test">
        <div class="k">$test$plusargs VERBOSE</div>
        <div class="v">${p.testVerbose ? "true" : "false"}</div>
      </button>
      <button type="button" class="knob-card ${state.selected === "flag" ? "is-sel" : ""}" data-knob="flag">
        <div class="k">$test$plusargs DUMP</div>
        <div class="v">${p.testDump ? "true" : "false"}</div>
      </button>
      <button type="button" class="knob-card ${state.selected === "value" ? "is-sel" : ""}" data-knob="value">
        <div class="k">$value$plusargs MODE</div>
        <div class="v">${p.valueMode ? p.mode : "—"}</div>
      </button>
    `;
    document.querySelectorAll("[data-knob]").forEach((el) => {
      el.addEventListener("click", () =>
        selectKnob(/** @type {string} */ (el.getAttribute("data-knob")))
      );
    });

    const items = [
      ...p.flags.map((k) => ({ id: `+${k}`, val: "(flag)" })),
      ...p.valued.map((x) => ({ id: `+${x.key}`, val: x.value })),
    ];
    document.getElementById("arg-list").innerHTML = items.length
      ? items
          .map(
            (it) =>
              `<li><span class="id">${it.id}</span><span class="val">${it.val}</span></li>`
          )
          .join("")
      : `<li><span class="id">(none)</span><span class="val">—</span></li>`;

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      KNOB_BLURB[state.selected] || KNOB_BLURB.vvp;

    document.getElementById("parse-box").textContent = parseSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastParsed) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Parse";
    } else if (p.ready) {
      v.className = "verdict yes";
      v.textContent = `READY — ${p.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${p.status} — ${p.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${p.ready && state.lastParsed ? "is-ok" : state.lastParsed ? "is-bad" : ""}">ready=${state.lastParsed ? (p.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${p.hasVvp ? "is-ok" : "is-bad"}">vvp=${p.binary || "—"}</span>
      <span class="flag ${p.plusCount ? "is-ok" : "is-bad"}">plus=${p.plusCount}</span>
      <span class="flag ${p.valueSeed ? "is-ok" : ""}">SEED=${p.seed || "—"}</span>
      <span class="flag ${p.testVerbose ? "is-ok" : ""}">VERBOSE=${p.testVerbose ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          cli: state.cli,
          selected: state.selected,
          requireSeed: state.requireSeed,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-vvp",
      title: "Quiz: vvp +ARGS",
      type: "quiz",
      prompt: "Plusargs after vvp sim.vvp are…",
      hint: "Runtime.",
      choices: [
        "runtime knobs visible to the TB via $test$ / $value$plusargs",
        "the same as iverilog +incdir compile flags",
        "GTKWave cursor names",
        "only Makefile variables",
      ],
      answer:
        "runtime knobs visible to the TB via $test$ / $value$plusargs",
    },
    {
      id: "quiz-test",
      title: "Quiz: $test$plusargs",
      type: "quiz",
      prompt: "$test$plusargs(\"VERBOSE\") is true when…",
      hint: "Presence.",
      choices: [
        "+VERBOSE (or +VERBOSE=…) appears on the vvp command line",
        "SEED equals 1",
        "the VCD file exists",
        "iverilog used -Wall",
      ],
      answer:
        "+VERBOSE (or +VERBOSE=…) appears on the vvp command line",
    },
    {
      id: "quiz-value",
      title: "Quiz: $value$plusargs",
      type: "quiz",
      prompt: "$value$plusargs(\"SEED=%d\", seed)…",
      hint: "Copy value.",
      choices: [
        "copies the value from +SEED=… into the TB variable when present",
        "compiles the design",
        "always returns true",
        "sets UVM_TESTNAME",
      ],
      answer:
        "copies the value from +SEED=… into the TB variable when present",
    },
    {
      id: "quiz-incdir",
      title: "Quiz: not +incdir",
      type: "quiz",
      prompt: "+incdir+path is…",
      hint: "Compile time.",
      choices: [
        "an iverilog compile-time include search path — not a vvp runtime plusarg",
        "read by $test$plusargs at runtime",
        "a Verilator --trace option",
        "identical to +SEED",
      ],
      answer:
        "an iverilog compile-time include search path — not a vvp runtime plusarg",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — READY.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.parsed.ready &&
        state.parsed.status === "READY",
    },
    {
      id: "load-dump",
      title: "Load DUMP",
      prompt: "Load DUMP + MODE — READY.",
      hint: "DUMP + MODE → Load",
      setup: () => {
        selPreset.value = "dump";
        loadPreset();
      },
      check: () =>
        state.parsed.testDump &&
        state.parsed.valueMode &&
        state.parsed.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-seed",
      title: "Load SEED only",
      prompt: "Load SEED only — READY.",
      hint: "SEED only → Load",
      setup: () => {
        selPreset.value = "seed_only";
        loadPreset();
      },
      check: () =>
        state.parsed.valueSeed &&
        !state.parsed.testVerbose &&
        state.parsed.ready,
    },
    {
      id: "load-no-plus",
      title: "Load no plusargs",
      prompt: "Load no plusargs — OPEN.",
      hint: "no plusargs → Load",
      setup: () => {
        selPreset.value = "no_plus";
        loadPreset();
      },
      check: () =>
        state.parsed.status === "OPEN" &&
        state.parsed.plusCount === 0,
    },
    {
      id: "load-miss",
      title: "Load miss SEED",
      prompt: "Load miss SEED — MISS.",
      hint: "miss SEED → Load",
      setup: () => {
        selPreset.value = "miss_seed";
        loadPreset();
      },
      check: () =>
        state.parsed.status === "MISS" &&
        !state.parsed.ready,
    },
    {
      id: "parse-ok",
      title: "Parse READY",
      prompt: "On starter, Parse — READY.",
      hint: "Parse",
      setup: () => {
        loadStarter();
        runParse(false);
      },
      check: () =>
        state.parsed.ready && state.lastAction === "parse-ok",
    },
    {
      id: "parse-bad",
      title: "Parse OPEN",
      prompt: "On no plusargs, Parse — OPEN.",
      hint: "no plusargs → Parse",
      setup: () => {
        selPreset.value = "no_plus";
        loadPreset();
        runParse(false);
      },
      check: () =>
        !state.parsed.ready && state.lastAction === "parse-bad",
    },
    {
      id: "select-seed",
      title: "Select SEED probe",
      prompt: "Click the SEED probe card.",
      hint: "Click SEED",
      setup: () => {
        loadStarter();
        selectKnob("seed");
      },
      check: () =>
        state.selected === "seed" && state.lastAction === "select",
    },
    {
      id: "select-test",
      title: "Select VERBOSE probe",
      prompt: "Click the VERBOSE probe card.",
      hint: "Click VERBOSE",
      setup: () => {
        loadStarter();
        selectKnob("test");
      },
      check: () =>
        state.selected === "test" && state.lastAction === "select",
    },
    {
      id: "demo",
      title: "Demo no plusargs",
      prompt: "Click Demo no plusargs.",
      hint: "Demo no plusargs",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.parsed.plusCount === 0 &&
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
      prompt: "Literacy sketch mentions $test$plusargs or $value$plusargs.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /\$test\$plusargs|\$value\$plusargs/.test(sourceSketch()),
    },
    {
      id: "parse-sketch",
      title: "Parse sketch",
      prompt: "On starter, parse sketch shows READY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /READY/.test(document.getElementById("parse-box").textContent),
    },
    {
      id: "seed-value",
      title: "SEED value",
      prompt: "Starter SEED value is 1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.parsed.seed === "1",
    },
    {
      id: "verbose-true",
      title: "VERBOSE true",
      prompt: "Starter $test$plusargs VERBOSE is true.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.parsed.testVerbose === true,
    },
    {
      id: "idle-load",
      title: "Load empty",
      prompt: "Load empty — not yet parsed.",
      hint: "empty → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        !state.lastParsed && state.lastAction === "load",
    },
    {
      id: "mode-waves",
      title: "MODE waves",
      prompt: "On DUMP preset, MODE is waves.",
      hint: "DUMP + MODE → Load",
      setup: () => {
        selPreset.value = "dump";
        loadPreset();
      },
      check: () => state.parsed.mode === "waves",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From no plusargs, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "no_plus";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.parsed.ready,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vpp-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vpp-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-parse").addEventListener("click", () => runParse(false));
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
        state.cli = saved.cli || state.cli;
        state.selected = saved.selected || state.selected;
        state.requireSeed = !!saved.requireSeed;
        state.preset = saved.preset || "starter";
        state.lastParsed = false;
        state.lastAction = "restore";
        syncInputs();
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
