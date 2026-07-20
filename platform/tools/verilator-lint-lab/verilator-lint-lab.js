(() => {
  /**
   * Verilator lint lab (concept)
   *   -Wall warning teaching
   * Starter: -Wall on · findings fixed — CLEAN
   */

  const FINDINGS = [
    {
      id: "unused",
      code: "UNUSED",
      label: "unused_sig",
      blurb: "Signal declared but never read — often dead code or a missing connection.",
    },
    {
      id: "width",
      code: "WIDTH",
      label: "width_mismatch",
      blurb: "Assignment or port width mismatch — silent truncation / extension risk.",
    },
    {
      id: "latch",
      code: "LATCH",
      label: "inferred_latch",
      blurb: "Combinational always incomplete — tool warns about an inferred latch.",
    },
    {
      id: "case",
      code: "CASEINCOMPLETE",
      label: "case_holes",
      blurb: "Case missing default / arms — synthesis and sim can disagree.",
    },
  ];

  const FLAG_BLURB = {
    wall: "-Wall turns on a useful set of lint warning categories (concept stand-in for Verilator’s Wall family).",
    werror: "-Werror promotes remaining warnings to errors — CI gate style.",
    silence: "-Wno-<CODE> silences one category (use sparingly; prefer fixing RTL).",
    lintonly: "--lint-only checks without building C++ / running sim.",
  };

  function evaluate(open, flags) {
    const openN = FINDINGS.filter((f) => open[f.id]).length;
    const visible = flags.wall ? openN : 0;
    const silenced = flags.silence
      ? FINDINGS.filter((f) => open[f.id] && flags.silence === f.code).length
      : 0;
    const effective = flags.wall
      ? Math.max(0, openN - (flags.silence ? silenced : 0))
      : 0;

    let status = "BLIND";
    let ready = false;
    let reason = "-Wall off — findings not reported";

    if (!flags.wall) {
      status = "BLIND";
      reason =
        openN > 0
          ? `${openN} open finding(s) hidden without -Wall`
          : "no -Wall (nothing to report)";
    } else if (effective === 0) {
      status = "CLEAN";
      ready = true;
      reason =
        openN === 0
          ? "no open findings"
          : `open findings silenced via -Wno-${flags.silence}`;
    } else if (flags.werror) {
      status = "FAIL";
      reason = `${effective} warning(s) elevated by -Werror`;
    } else {
      status = "WARN";
      reason = `${effective} warning(s) under -Wall`;
    }

    return { status, ready, reason, openN, visible, effective, silenced };
  }

  const PRESETS = {
    starter: {
      label: "starter: clean",
      open: { unused: false, width: false, latch: false, case: false },
      wall: true,
      werror: false,
      silence: "",
      sel: "unused",
      note: "-Wall on, all findings fixed — CLEAN.",
      autoScan: true,
    },
    unused_hit: {
      label: "UNUSED open",
      open: { unused: true, width: false, latch: false, case: false },
      wall: true,
      werror: false,
      silence: "",
      sel: "unused",
      note: "One UNUSED finding — WARN.",
      autoScan: true,
    },
    multi: {
      label: "multi findings",
      open: { unused: true, width: true, latch: true, case: false },
      wall: true,
      werror: false,
      silence: "",
      sel: "width",
      note: "Several categories open — WARN.",
      autoScan: true,
    },
    werror: {
      label: "-Werror gate",
      open: { unused: true, width: false, latch: false, case: false },
      wall: true,
      werror: true,
      silence: "",
      sel: "unused",
      note: "Warning + -Werror — FAIL.",
      autoScan: true,
    },
    silence: {
      label: "silence UNUSED",
      open: { unused: true, width: false, latch: false, case: false },
      wall: true,
      werror: false,
      silence: "UNUSED",
      sel: "unused",
      note: "-Wno-UNUSED hides the open finding — CLEAN (with caveat).",
      autoScan: true,
    },
    blind: {
      label: "no -Wall",
      open: { unused: true, width: true, latch: false, case: false },
      wall: false,
      werror: false,
      silence: "",
      sel: "unused",
      note: "Findings exist but -Wall off — BLIND.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      open: { unused: true, width: false, latch: false, case: false },
      wall: true,
      werror: false,
      silence: "",
      sel: null,
      note: "Idle — toggle findings / flags, then Scan.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Verilator lint literacy (document aid — not a real verilator run)
//
//   verilator --lint-only -Wall top.v
//
// Common warning ideas (names simplified):
//   UNUSED          declared but never read
//   WIDTH           width mismatch / truncation risk
//   LATCH           incomplete combo → inferred latch
//   CASEINCOMPLETE  case holes / missing default
//
// Flags in this lab
//   -Wall           enable useful warning set
//   -Werror         promote remaining warns → errors
//   -Wno-<CODE>     silence one category (prefer fixing RTL)
//
// CLEAN = no effective warnings under -Wall
// WARN  = findings reported
// FAIL  = findings + -Werror
// BLIND = findings exist but -Wall is off`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.open, {
      wall: p.wall,
      werror: p.werror,
      silence: p.silence,
    });
    return {
      preset: "starter",
      open: { ...p.open },
      wall: p.wall,
      werror: p.werror,
      silence: p.silence,
      sel: p.sel,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: ${ev.status}`],
    };
  }

  const CLEARED_KEY = "ddv-verilator-lint-lab-cleared-v1";
  const STORE_KEY = "ddv-verilator-lint-lab-session-v1";

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

  const root = document.getElementById("vll-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>-Wall</code> on · all findings fixed — board CLEAN.</p>
      <button type="button" class="btn btn-secondary" id="vll-starter">Load starter example</button>
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
        <div class="idea-card"><h3>-Wall</h3><p>Enable useful lint warning categories.</p></div>
        <div class="idea-card"><h3>UNUSED / WIDTH</h3><p>Dead signals and size mismatches.</p></div>
        <div class="idea-card"><h3>-Werror</h3><p>Promote remaining warns to CI failures.</p></div>
        <div class="idea-card"><h3>-Wno-*</h3><p>Silence one code — prefer fixing RTL.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vll-controls">
        <div class="vll-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>clean starter</option>
            <option value="unused_hit">UNUSED open</option>
            <option value="multi">multi findings</option>
            <option value="werror">-Werror gate</option>
            <option value="silence">silence UNUSED</option>
            <option value="blind">no -Wall</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-fix">Fix selected</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan lint</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo UNUSED</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vll-layout">
        <div class="panel-box">
          <h3>Flags</h3>
          <div class="flag-chips" id="flag-chips"></div>
          <h3>Findings</h3>
          <ul class="find-list" id="find-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Lint sketch</h3>
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

  function flagsObj() {
    return { wall: state.wall, werror: state.werror, silence: state.silence };
  }

  function planSketch() {
    const ev = evaluate(state.open, flagsObj());
    const lines = FINDINGS.map((f) => {
      const open = state.open[f.id];
      const muted = state.silence === f.code;
      const shown = state.wall && open && !muted;
      return `${f.code.padEnd(14)} ${open ? "OPEN" : "fixed"}  ${
        muted ? "silenced" : shown ? "reported" : "—"
      }`;
    });
    return `# verilator --lint-only ${state.wall ? "-Wall" : ""} ${
      state.werror ? "-Werror" : ""
    } ${state.silence ? `-Wno-${state.silence}` : ""}
${lines.join("\n")}
# status: ${state.lastScanned ? state.status : "— (Scan)"}
# reason: ${state.lastScanned ? state.reason : "—"}
# effective: ${ev.effective}`;
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

  function runScan(silent) {
    const ev = evaluate(state.open, flagsObj());
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

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter CLEAN");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.open = { ...p.open };
    state.wall = p.wall;
    state.werror = p.werror;
    state.silence = p.silence;
    state.sel = p.sel;
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

  function fixSelected() {
    if (!state.sel) {
      state.lastAction = "fix-bad";
      pushLog("# fix FAIL (select a finding)");
      renderAll();
      return;
    }
    state.open[state.sel] = false;
    pushTrace(`fix: ${state.sel}`);
    pushLog(`# fix ${state.sel}`);
    runScan(true);
    state.lastAction = "fix";
    renderAll();
  }

  function toggleFinding(id) {
    state.open[id] = !state.open[id];
    state.sel = id;
    state.preset = "custom";
    pushTrace(`toggle: ${id} → ${state.open[id] ? "OPEN" : "fixed"}`);
    runScan(true);
    state.lastAction = "toggle";
    pushLog(`# toggle ${id}`);
    renderAll();
  }

  function selectFinding(id) {
    state.sel = id;
    state.lastAction = "select";
    renderAll();
  }

  function toggleFlag(kind) {
    if (kind === "wall") state.wall = !state.wall;
    else if (kind === "werror") state.werror = !state.werror;
    else if (kind === "silence") {
      state.silence = state.silence === "UNUSED" ? "" : "UNUSED";
    }
    state.preset = "custom";
    runScan(true);
    state.lastAction = "flag";
    pushLog(`# flag ${kind}`);
    renderAll();
  }

  function demo() {
    applyPreset("unused_hit", "demo");
    state.demoed = true;
    pushLog("# demo UNUSED WARN");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain -Wall lint");
    pushTrace("explain: -Wall · findings · -Werror / -Wno-* → CLEAN if fixed");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const finding = FINDINGS.find((f) => f.id === state.sel);
    const ev = evaluate(state.open, flagsObj());

    document.getElementById("flag-chips").innerHTML = `
      <button type="button" class="chip ${state.wall ? "is-on" : ""}" data-flag="wall">
        <span class="k">enable</span>-Wall
      </button>
      <button type="button" class="chip ${state.werror ? "is-on" : ""}" data-flag="werror">
        <span class="k">gate</span>-Werror
      </button>
      <button type="button" class="chip ${state.silence === "UNUSED" ? "is-on" : ""}" data-flag="silence">
        <span class="k">silence</span>-Wno-UNUSED
      </button>
    `;
    document.querySelectorAll("[data-flag]").forEach((el) => {
      el.addEventListener("click", () =>
        toggleFlag(/** @type {string} */ (el.getAttribute("data-flag")))
      );
    });

    document.getElementById("find-list").innerHTML = FINDINGS.map((f) => {
      const open = state.open[f.id];
      const muted = state.silence === f.code;
      const tag = !open
        ? "fixed"
        : muted
          ? "silenced"
          : state.wall
            ? "OPEN"
            : "hidden";
      const tagCls = !open
        ? "is-ok"
        : muted
          ? "is-mute"
          : state.wall
            ? "is-bad"
            : "is-mute";
      return `<li class="${state.sel === f.id ? "is-sel" : ""}" data-find="${f.id}">
        <span class="id">${f.code}</span>
        <span class="tag">${f.label}</span>
        <span class="tag ${tagCls}">${tag}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-find]").forEach((el) => {
      el.addEventListener("click", (evClick) => {
        const id = /** @type {string} */ (el.getAttribute("data-find"));
        if (state.sel === id && evClick.detail === 1) {
          // single click when already selected → toggle open/fixed
          toggleFinding(id);
        } else {
          selectFinding(id);
        }
      });
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a finding; click again to toggle open/fixed. Use flag chips for -Wall / -Werror / -Wno-UNUSED.";
    if (finding) blurb = finding.blurb;
    else if (state.lastAction === "flag") {
      if (!state.wall) blurb = FLAG_BLURB.wall;
      else if (state.werror) blurb = FLAG_BLURB.werror;
      else if (state.silence) blurb = FLAG_BLURB.silence;
      else blurb = FLAG_BLURB.lintonly;
    }
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
      v.textContent = "Idle — Load preset, Fix selected, or Scan lint";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `CLEAN — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${state.wall ? "is-ok" : "is-bad"}">Wall=${state.wall ? 1 : 0}</span>
      <span class="flag ${state.werror ? "is-bad" : ""}">Werror=${state.werror ? 1 : 0}</span>
      <span class="flag ${ev.openN ? "is-bad" : "is-ok"}">open=${ev.openN}</span>
      <span class="flag ${ev.effective ? "is-bad" : "is-ok"}">effective=${ev.effective}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          open: state.open,
          wall: state.wall,
          werror: state.werror,
          silence: state.silence,
          sel: state.sel,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-wall",
      title: "Quiz: -Wall",
      type: "quiz",
      prompt: "-Wall is used to…",
      hint: "Enable warns.",
      choices: [
        "enable a useful set of lint warning categories",
        "wipe the VCD file",
        "select UVM_TESTNAME",
        "force --trace off",
      ],
      answer: "enable a useful set of lint warning categories",
    },
    {
      id: "quiz-unused",
      title: "Quiz: UNUSED",
      type: "quiz",
      prompt: "UNUSED typically means…",
      hint: "Dead signal.",
      choices: [
        "a signal is declared but never read",
        "the clock is too fast",
        "coverage is 100%",
        "plusargs are missing",
      ],
      answer: "a signal is declared but never read",
    },
    {
      id: "quiz-werror",
      title: "Quiz: -Werror",
      type: "quiz",
      prompt: "-Werror…",
      hint: "Promote.",
      choices: [
        "promotes remaining warnings to errors (CI gate style)",
        "disables all warnings",
        "only affects GTKWave",
        "is identical to +incdir",
      ],
      answer: "promotes remaining warnings to errors (CI gate style)",
    },
    {
      id: "quiz-silence",
      title: "Quiz: -Wno-*",
      type: "quiz",
      prompt: "-Wno-UNUSED…",
      hint: "Silence one code.",
      choices: [
        "silences that warning category (prefer fixing RTL instead)",
        "deletes the signal from the netlist forever",
        "turns on tracing",
        "sets the timescale",
      ],
      answer: "silences that warning category (prefer fixing RTL instead)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — CLEAN.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "CLEAN",
    },
    {
      id: "load-unused",
      title: "Load UNUSED",
      prompt: "Load UNUSED open — WARN.",
      hint: "UNUSED open → Load",
      setup: () => {
        selPreset.value = "unused_hit";
        loadPreset();
      },
      check: () =>
        state.status === "WARN" &&
        state.open.unused &&
        state.lastAction === "load",
    },
    {
      id: "load-multi",
      title: "Load multi",
      prompt: "Load multi findings — WARN.",
      hint: "multi findings → Load",
      setup: () => {
        selPreset.value = "multi";
        loadPreset();
      },
      check: () =>
        state.status === "WARN" &&
        state.open.width &&
        state.open.latch,
    },
    {
      id: "load-werror",
      title: "Load -Werror",
      prompt: "Load -Werror gate — FAIL.",
      hint: "-Werror gate → Load",
      setup: () => {
        selPreset.value = "werror";
        loadPreset();
      },
      check: () =>
        state.status === "FAIL" && state.werror,
    },
    {
      id: "load-silence",
      title: "Load silence",
      prompt: "Load silence UNUSED — CLEAN.",
      hint: "silence UNUSED → Load",
      setup: () => {
        selPreset.value = "silence";
        loadPreset();
      },
      check: () =>
        state.ready &&
        state.silence === "UNUSED" &&
        state.open.unused,
    },
    {
      id: "load-blind",
      title: "Load blind",
      prompt: "Load no -Wall — BLIND.",
      hint: "no -Wall → Load",
      setup: () => {
        selPreset.value = "blind";
        loadPreset();
      },
      check: () =>
        state.status === "BLIND" && !state.wall,
    },
    {
      id: "fix",
      title: "Fix selected",
      prompt: "From UNUSED open, Fix selected — CLEAN.",
      hint: "UNUSED → Fix selected",
      setup: () => {
        selPreset.value = "unused_hit";
        loadPreset();
        state.sel = "unused";
        fixSelected();
      },
      check: () =>
        !state.open.unused &&
        state.ready &&
        state.lastAction === "fix",
    },
    {
      id: "select",
      title: "Select finding",
      prompt: "Click the WIDTH finding row.",
      hint: "Click WIDTH",
      setup: () => {
        loadStarter();
        selectFinding("width");
      },
      check: () =>
        state.sel === "width" && state.lastAction === "select",
    },
    {
      id: "toggle",
      title: "Toggle finding",
      prompt: "From starter, open LATCH via toggle.",
      hint: "Click LATCH twice",
      setup: () => {
        loadStarter();
        state.sel = "latch";
        toggleFinding("latch");
      },
      check: () =>
        state.open.latch && state.lastAction === "toggle",
    },
    {
      id: "scan-ok",
      title: "Scan CLEAN",
      prompt: "On starter, Scan lint — CLEAN.",
      hint: "Scan lint",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan WARN",
      prompt: "On UNUSED open, Scan — WARN.",
      hint: "UNUSED → Scan",
      setup: () => {
        selPreset.value = "unused_hit";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo UNUSED",
      prompt: "Click Demo UNUSED.",
      hint: "Demo UNUSED",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "WARN" &&
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
      prompt: "Literacy sketch mentions -Wall or UNUSED.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /-Wall|UNUSED/.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Lint sketch",
      prompt: "On starter, lint sketch shows CLEAN.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /CLEAN/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "flag-wall",
      title: "Toggle -Wall",
      prompt: "From unused open, turn -Wall off — BLIND.",
      hint: "Click -Wall chip",
      setup: () => {
        selPreset.value = "unused_hit";
        loadPreset();
        toggleFlag("wall");
      },
      check: () =>
        !state.wall &&
        state.status === "BLIND" &&
        state.lastAction === "flag",
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
      prompt: "From multi, Reset — CLEAN again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "multi";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vll-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vll-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-fix").addEventListener("click", () => fixSelected());
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
        state.open = saved.open || state.open;
        state.wall = !!saved.wall;
        state.werror = !!saved.werror;
        state.silence = saved.silence || "";
        state.sel = saved.sel || null;
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
        syncInputs();
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
