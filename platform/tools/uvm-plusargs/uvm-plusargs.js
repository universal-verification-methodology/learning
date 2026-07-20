(() => {
  /**
   * Plusargs / CLP (concept)
   *   +UVM_TESTNAME picks test; other +ARGS are knobs
   * Starter: +UVM_TESTNAME=base_test +SEED=1 — selected OK
   */

  const KNOWN_TESTS = ["base_test", "smoke_test", "err_inj_test"];

  const KNOB_BLURB = {
    testname:
      "+UVM_TESTNAME=<class> selects which uvm_test the run-time factory builds.",
    seed: "+SEED (or +ntb_random_seed) sets the random seed for replay.",
    verbosity:
      "+UVM_VERBOSITY / +VERBOSITY raise or lower message volume for the run.",
    custom:
      "Custom plusargs (+NUM_PKTS, +MODE, …) are project knobs read via $value$plusargs / uvm_cmdline_processor.",
  };

  const PRESETS = {
    starter: {
      label: "starter: base_test + seed",
      cli: "+UVM_TESTNAME=base_test +SEED=1",
      note: "Testname present and known — run can select base_test; seed knob applied.",
      autoParse: true,
    },
    smoke: {
      label: "smoke_test + verbosity",
      cli: "+UVM_TESTNAME=smoke_test +UVM_VERBOSITY=UVM_HIGH",
      note: "Different test + verbosity knob.",
      autoParse: true,
    },
    no_test: {
      label: "knobs only (no testname)",
      cli: "+SEED=42 +NUM_PKTS=8",
      note: "Seed/custom knobs alone — no +UVM_TESTNAME → cannot select a test.",
      autoParse: true,
    },
    bad_test: {
      label: "unknown testname",
      cli: "+UVM_TESTNAME=ghost_test +SEED=1",
      note: "Plusarg present but class not in factory/registry — select fails.",
      autoParse: true,
    },
    full: {
      label: "full CLP line",
      cli: "+UVM_TESTNAME=err_inj_test +SEED=7 +UVM_VERBOSITY=UVM_MEDIUM +NUM_PKTS=16 +MODE=inj",
      note: "Test + seed + verbosity + custom knobs — typical regression CLP.",
      autoParse: true,
    },
    empty: {
      label: "empty cmdline",
      cli: "",
      note: "Empty — type plusargs or Load a preset, then Parse.",
      autoParse: false,
    },
  };

  function sourceSketch() {
    return `// Plusargs / CLP literacy (not a full UVM cmdline_processor)
// simv +UVM_TESTNAME=base_test +SEED=1 +UVM_VERBOSITY=UVM_LOW …
//
// +UVM_TESTNAME  → which uvm_test class to run (factory)
// +SEED          → random seed for replay
// +UVM_VERBOSITY → message volume for this run
// +CUSTOM=…     → project knobs ($value$plusargs / CLP get_arg_value)
//
// Missing or unknown testname → no legal test selection.
// Knobs without testname still parse, but the run has no test.`;
  }

  function parseCli(cli) {
    const raw = String(cli || "").trim();
    const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];
    /** @type {Record<string, string>} */
    const map = {};
    for (const t of tokens) {
      if (!t.startsWith("+")) continue;
      const body = t.slice(1);
      const eq = body.indexOf("=");
      if (eq < 0) map[body.toUpperCase()] = "1";
      else {
        const k = body.slice(0, eq).toUpperCase();
        const v = body.slice(eq + 1);
        map[k] = v;
      }
    }
    const testname =
      map.UVM_TESTNAME || map.TESTNAME || map.UVM_TEST || "";
    const seed = map.SEED || map.NTB_RANDOM_SEED || "";
    const verbosity = map.UVM_VERBOSITY || map.VERBOSITY || "";
    const custom = {};
    for (const [k, v] of Object.entries(map)) {
      if (
        k === "UVM_TESTNAME" ||
        k === "TESTNAME" ||
        k === "UVM_TEST" ||
        k === "SEED" ||
        k === "NTB_RANDOM_SEED" ||
        k === "UVM_VERBOSITY" ||
        k === "VERBOSITY"
      ) {
        continue;
      }
      custom[k] = v;
    }
    const known = !!(testname && KNOWN_TESTS.includes(testname));
    const selected = known;
    const ok = selected;
    return {
      tokens,
      map,
      testname,
      seed,
      verbosity,
      custom,
      known,
      selected,
      ok,
    };
  }

  function makeStarter() {
    const p = parseCli(PRESETS.starter.cli);
    return {
      preset: "starter",
      cli: PRESETS.starter.cli,
      note: PRESETS.starter.note,
      selected: "testname",
      parsed: p,
      lastParsed: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [
        `parse: TEST=${p.testname} seed=${p.seed || "—"} ok=${p.ok ? 1 : 0}`,
      ],
    };
  }

  const CLEARED_KEY = "ddv-uvm-plusargs-cleared-v1";
  const STORE_KEY = "ddv-uvm-plusargs-session-v1";

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

  const root = document.getElementById("upa-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>+UVM_TESTNAME=base_test +SEED=1</code> —
        known test selected; seed knob applied.</p>
      <button type="button" class="btn btn-secondary" id="upa-starter">Load starter example</button>
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
        <div class="idea-card"><h3>+UVM_TESTNAME</h3><p>Picks which uvm_test class to run.</p></div>
        <div class="idea-card"><h3>+SEED</h3><p>Random seed for replayable runs.</p></div>
        <div class="idea-card"><h3>verbosity</h3><p>Message volume for this invocation.</p></div>
        <div class="idea-card"><h3>custom knobs</h3><p>Project plusargs read via CLP / $value$plusargs.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="upa-controls">
        <div class="upa-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>base_test + seed</option>
            <option value="smoke">smoke + verbosity</option>
            <option value="no_test">knobs only</option>
            <option value="bad_test">unknown test</option>
            <option value="full">full CLP</option>
            <option value="empty">empty</option>
          </select>
        </div>
        <div class="upa-field" style="flex:1;min-width:12rem">
          <label for="inp-cli">Command-line plusargs</label>
          <input id="inp-cli" class="cli" type="text" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-parse">Parse</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo no testname</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="upa-layout">
        <div class="panel-box">
          <h3>Resolved knobs</h3>
          <div class="knob-row" id="knob-row"></div>
          <h3>Parsed tokens</h3>
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
    const customs = Object.entries(p.custom || {})
      .map(([k, v]) => `  +${k}=${v}`)
      .join("\n");
    return `// cmdline: ${state.cli || "(empty)"}
//
// UVM_TESTNAME = ${p.testname || "—"}
// known test?  = ${p.known ? "yes" : "no"}
// selected     = ${p.selected ? "yes" : "no"}
// SEED         = ${p.seed || "—"}
// VERBOSITY    = ${p.verbosity || "—"}
// custom:
${customs || "  (none)"}`;
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

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter base_test + SEED=1");
    renderAll();
  }

  function runParse(silent) {
    state.cli = (inpCli.value || "").trim();
    const p = parseCli(state.cli);
    state.parsed = p;
    state.lastParsed = true;
    const line = `parse: TEST=${p.testname || "—"} seed=${p.seed || "—"} ok=${p.ok ? 1 : 0}`;
    pushTrace(line);
    if (!silent) {
      state.lastAction = p.ok ? "parse-ok" : "parse-bad";
      pushLog(`# parse ${p.ok ? "OK" : "FAIL"}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.cli = p.cli;
    state.note = p.note;
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
    applyPreset("no_test", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo no testname");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: +UVM_TESTNAME selects the test; other plusargs are knobs " +
        "(seed, verbosity, custom) read by CLP / $value$plusargs."
    );
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
    const customStr =
      Object.keys(p.custom || {}).length === 0
        ? "—"
        : Object.entries(p.custom)
            .map(([k, v]) => `${k}=${v}`)
            .join(",");

    document.getElementById("knob-row").innerHTML = `
      <button type="button" class="knob-card ${state.selected === "testname" ? "is-sel" : ""}" data-knob="testname">
        <div class="k">+UVM_TESTNAME</div>
        <div class="v">${p.testname || "—"}</div>
      </button>
      <button type="button" class="knob-card ${state.selected === "seed" ? "is-sel" : ""}" data-knob="seed">
        <div class="k">+SEED</div>
        <div class="v">${p.seed || "—"}</div>
      </button>
      <button type="button" class="knob-card ${state.selected === "verbosity" ? "is-sel" : ""}" data-knob="verbosity">
        <div class="k">verbosity</div>
        <div class="v">${p.verbosity || "—"}</div>
      </button>
      <button type="button" class="knob-card ${state.selected === "custom" ? "is-sel" : ""}" data-knob="custom">
        <div class="k">custom</div>
        <div class="v">${customStr}</div>
      </button>
    `;
    document.querySelectorAll("[data-knob]").forEach((el) => {
      el.addEventListener("click", () =>
        selectKnob(/** @type {string} */ (el.getAttribute("data-knob")))
      );
    });

    const tokens = p.tokens || [];
    document.getElementById("arg-list").innerHTML = tokens.length
      ? tokens
          .map((t) => {
            const body = t.startsWith("+") ? t.slice(1) : t;
            const eq = body.indexOf("=");
            const k = eq < 0 ? body : body.slice(0, eq);
            const v = eq < 0 ? "1" : body.slice(eq + 1);
            return `<li><span class="id">+${k}</span><span class="val">${v}</span></li>`;
          })
          .join("")
      : `<li><span class="id">(none)</span><span class="val">—</span></li>`;

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      KNOB_BLURB[state.selected] || KNOB_BLURB.testname;
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
      v.textContent = "Idle — Load preset or Parse cmdline";
    } else if (p.ok) {
      v.className = "verdict yes";
      v.textContent = `Test selected: ${p.testname}`;
    } else if (!p.testname) {
      v.className = "verdict no";
      v.textContent = "No +UVM_TESTNAME — cannot select a test";
    } else {
      v.className = "verdict no";
      v.textContent = `Unknown test '${p.testname}' — not in registry`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${p.testname ? "is-ok" : "is-bad"}">test=${p.testname || "—"}</span>
      <span class="flag ${p.known ? "is-ok" : p.testname ? "is-bad" : ""}">known=${p.known ? 1 : 0}</span>
      <span class="flag ${p.seed ? "is-ok" : ""}">seed=${p.seed || "—"}</span>
      <span class="flag ${p.verbosity ? "is-ok" : ""}">verb=${p.verbosity || "—"}</span>
      <span class="flag ${Object.keys(p.custom || {}).length ? "is-ok" : ""}">custom=${Object.keys(p.custom || {}).length}</span>
      <span class="flag ${p.ok && state.lastParsed ? "is-ok" : state.lastParsed ? "is-bad" : ""}">ok=${state.lastParsed ? (p.ok ? 1 : 0) : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ preset: state.preset, cli: state.cli })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-testname",
      title: "Quiz: testname",
      type: "quiz",
      prompt: "+UVM_TESTNAME primarily…",
      hint: "Which test.",
      choices: [
        "selects which uvm_test class the run builds",
        "compiles the DUT netlist",
        "replaces the scoreboard",
        "sets the synthesis top",
      ],
      answer: "selects which uvm_test class the run builds",
    },
    {
      id: "quiz-seed",
      title: "Quiz: seed",
      type: "quiz",
      prompt: "A +SEED plusarg is used to…",
      hint: "Replay.",
      choices: [
        "set the random seed so a run can be replayed",
        "pick the factory override type",
        "disable all agents",
        "write the VCD dump path only",
      ],
      answer: "set the random seed so a run can be replayed",
    },
    {
      id: "quiz-clp",
      title: "Quiz: CLP",
      type: "quiz",
      prompt: "uvm_cmdline_processor / $value$plusargs help you…",
      hint: "Read knobs.",
      choices: [
        "read plusarg knobs from the simulation command line",
        "synthesize SystemVerilog to gates",
        "replace connect_phase wiring",
        "delete objections",
      ],
      answer: "read plusarg knobs from the simulation command line",
    },
    {
      id: "quiz-missing",
      title: "Quiz: missing",
      type: "quiz",
      prompt: "If +UVM_TESTNAME is absent…",
      hint: "No test.",
      choices: [
        "the run has no selected test class from that plusarg",
        "SEED is ignored forever",
        "UVM always defaults to smoke_test",
        "the DUT is auto-synthesized",
      ],
      answer: "the run has no selected test class from that plusarg",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — base_test selected OK.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.parsed.ok &&
        state.parsed.testname === "base_test",
    },
    {
      id: "load-smoke",
      title: "Load smoke",
      prompt: "Load smoke_test + verbosity.",
      hint: "smoke + verbosity → Load",
      setup: () => {
        selPreset.value = "smoke";
        loadPreset();
      },
      check: () =>
        state.parsed.testname === "smoke_test" &&
        state.parsed.verbosity === "UVM_HIGH" &&
        state.lastAction === "load",
    },
    {
      id: "load-notest",
      title: "Load knobs only",
      prompt: "Load knobs only — parse fails (no testname).",
      hint: "knobs only → Load",
      setup: () => {
        selPreset.value = "no_test";
        loadPreset();
      },
      check: () =>
        !state.parsed.testname &&
        !state.parsed.ok &&
        state.lastParsed,
    },
    {
      id: "load-bad",
      title: "Load unknown",
      prompt: "Load unknown test — known=0.",
      hint: "unknown test → Load",
      setup: () => {
        selPreset.value = "bad_test";
        loadPreset();
      },
      check: () =>
        state.parsed.testname === "ghost_test" && !state.parsed.known,
    },
    {
      id: "load-full",
      title: "Load full CLP",
      prompt: "Load full CLP — custom NUM_PKTS present.",
      hint: "full CLP → Load",
      setup: () => {
        selPreset.value = "full";
        loadPreset();
      },
      check: () =>
        state.parsed.custom.NUM_PKTS === "16" &&
        state.parsed.testname === "err_inj_test",
    },
    {
      id: "parse-ok",
      title: "Parse OK",
      prompt: "From empty, type starter line, Parse — OK.",
      hint: "empty → type CLI → Parse",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        inpCli.value = "+UVM_TESTNAME=base_test +SEED=1";
        runParse(false);
      },
      check: () =>
        state.parsed.ok && state.lastAction === "parse-ok",
    },
    {
      id: "parse-bad",
      title: "Parse fail",
      prompt: "Parse +SEED=9 only — FAIL.",
      hint: "empty → +SEED=9 → Parse",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        inpCli.value = "+SEED=9";
        runParse(false);
      },
      check: () =>
        !state.parsed.ok && state.lastAction === "parse-bad",
    },
    {
      id: "demo",
      title: "Demo no testname",
      prompt: "Click Demo no testname.",
      hint: "Demo no testname",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.parsed.testname &&
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
      id: "select-seed",
      title: "Select seed",
      prompt: "Click the +SEED knob card.",
      hint: "Click +SEED",
      setup: () => {
        loadStarter();
        selectKnob("seed");
      },
      check: () =>
        state.selected === "seed" && state.lastAction === "select",
    },
    {
      id: "select-custom",
      title: "Select custom",
      prompt: "On full CLP, select custom knobs card.",
      hint: "full → Load → click custom",
      setup: () => {
        selPreset.value = "full";
        loadPreset();
        selectKnob("custom");
      },
      check: () =>
        state.selected === "custom" &&
        state.parsed.custom.MODE === "inj",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions cmdline_processor or $value$plusargs.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () =>
        /cmdline_processor|\$value\$plusargs/i.test(sourceSketch()),
    },
    {
      id: "known-list",
      title: "Known tests",
      prompt: "Starter testname is in the known registry.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => KNOWN_TESTS.includes(state.parsed.testname),
    },
    {
      id: "seed-flag",
      title: "Seed flag",
      prompt: "Starter has seed=1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.parsed.seed === "1",
    },
    {
      id: "verbosity-smoke",
      title: "Verbosity",
      prompt: "Smoke preset has UVM_HIGH.",
      hint: "smoke → Load",
      setup: () => {
        selPreset.value = "smoke";
        loadPreset();
      },
      check: () => state.parsed.verbosity === "UVM_HIGH",
    },
    {
      id: "empty-idle",
      title: "Empty idle",
      prompt: "Load empty — not yet parsed.",
      hint: "empty → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        !state.lastParsed &&
        !state.cli &&
        state.lastAction === "load",
    },
    {
      id: "parse-sketch",
      title: "Parse sketch",
      prompt: "On starter, parse sketch lists UVM_TESTNAME.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /UVM_TESTNAME/.test(document.getElementById("parse-box").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From empty, Reset — base_test OK again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.parsed.ok &&
        state.parsed.testname === "base_test",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="upa-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("upa-starter").addEventListener("click", () => {
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
      if (saved && saved.cli != null) {
        state.cli = saved.cli;
        state.preset = saved.preset || "starter";
        state.lastParsed = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
