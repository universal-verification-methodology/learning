(() => {
  /**
   * Verilator trace (concept)
   *   --trace / --trace-fst → VCD/FST + C++ dump calls
   * Starter: --trace · VCD · open+dump — READY
   */

  const FORMATS = [
    {
      id: "vcd",
      label: "VCD",
      flag: "--trace",
      blurb: "Default text Value Change Dump — portable, larger.",
    },
    {
      id: "fst",
      label: "FST",
      flag: "--trace-fst",
      blurb: "Compact Fast Signal Trace — prefer for long / fat dumps.",
    },
  ];

  const STEPS = [
    {
      id: "trace",
      label: "--trace flag",
      blurb: "Compile with --trace (or --trace-fst) so Verilated models include tracing support.",
    },
    {
      id: "open",
      label: "tfp->open",
      blurb: "C++ TB opens a VerilatedVcd/Fst file (VerilatedVcdC / VerilatedFstC).",
    },
    {
      id: "dump",
      label: "tfp->dump",
      blurb: "Call dump(time) each step (or on change) so the file gets samples.",
    },
    {
      id: "close",
      label: "tfp->close",
      blurb: "Close the dump at end of sim so the wave file is complete.",
    },
  ];

  function formatOf(id) {
    return FORMATS.find((f) => f.id === id);
  }

  function evaluate(steps, formatId) {
    const fmt = formatOf(formatId);
    const hasTrace = !!steps.trace;
    const hasOpen = !!steps.open;
    const hasDump = !!steps.dump;
    const hasClose = !!steps.close;

    let status = "OPEN";
    let ready = false;
    let reason = "enable --trace and TB dump calls";

    if (!hasTrace && (hasOpen || hasDump)) {
      status = "BLIND";
      reason = "TB dump calls without --trace / --trace-fst — no wave model";
    } else if (!hasTrace) {
      status = "OPEN";
      reason = "missing --trace / --trace-fst";
    } else if (!hasOpen || !hasDump) {
      status = "OPEN";
      const miss = [];
      if (!hasOpen) miss.push("open");
      if (!hasDump) miss.push("dump");
      reason = `trace on, missing TB ${miss.join("+")}`;
    } else {
      status = "READY";
      ready = true;
      reason = `${fmt.flag} → ${fmt.label}${hasClose ? " (closed)" : " (close optional)"}`;
    }

    return {
      status,
      ready,
      reason,
      hasTrace,
      hasOpen,
      hasDump,
      hasClose,
      fmt,
    };
  }

  const PRESETS = {
    starter: {
      label: "starter: VCD ready",
      steps: { trace: true, open: true, dump: true, close: true },
      format: "vcd",
      sel: "trace",
      note: "--trace · VCD · open+dump+close — READY.",
      autoScan: true,
    },
    fst: {
      label: "FST farm",
      steps: { trace: true, open: true, dump: true, close: true },
      format: "fst",
      sel: "trace",
      note: "--trace-fst · FST · full TB dump path — READY.",
      autoScan: true,
    },
    no_dump: {
      label: "trace, no dump",
      steps: { trace: true, open: false, dump: false, close: false },
      format: "vcd",
      sel: "dump",
      note: "--trace alone — OPEN (need TB open/dump).",
      autoScan: true,
    },
    blind: {
      label: "dump without --trace",
      steps: { trace: false, open: true, dump: true, close: false },
      format: "vcd",
      sel: "trace",
      note: "TB dump without compile --trace — BLIND.",
      autoScan: true,
    },
    open_only: {
      label: "open, no dump",
      steps: { trace: true, open: true, dump: false, close: false },
      format: "vcd",
      sel: "dump",
      note: "File opened but never dumped — OPEN.",
      autoScan: true,
    },
    no_close: {
      label: "ready, no close",
      steps: { trace: true, open: true, dump: true, close: false },
      format: "vcd",
      sel: "close",
      note: "open+dump without close — still READY (close recommended).",
      autoScan: true,
    },
    idle: {
      label: "idle",
      steps: { trace: false, open: false, dump: false, close: false },
      format: "vcd",
      sel: null,
      note: "Idle — toggle steps / format, then Scan.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Verilator trace literacy (document aid — not a real Verilator run)
//
// Compile:
//   verilator --cc --exe --build --trace top.v tb.cpp
//   // or: --trace-fst  for FST instead of VCD
//
// C++ TB sketch:
//   VerilatedVcdC* tfp = new VerilatedVcdC;   // or VerilatedFstC
//   top->trace(tfp, 99);
//   tfp->open("dump.vcd");
//   … eval loop …
//   tfp->dump(time);
//   tfp->close();
//
// --trace enables tracing support in the model.
// TB open/dump/close actually writes the wave file.
// Pair with wave-dump for VCD vs FST format choice.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.steps, p.format);
    return {
      preset: "starter",
      steps: { ...p.steps },
      format: p.format,
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

  const CLEARED_KEY = "ddv-verilator-trace-cleared-v1";
  const STORE_KEY = "ddv-verilator-trace-session-v1";

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

  const root = document.getElementById("vtr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>--trace</code> · VCD · <code>open</code>+<code>dump</code>+<code>close</code>
        — READY.</p>
      <button type="button" class="btn btn-secondary" id="vtr-starter">Load starter example</button>
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
        <div class="idea-card"><h3>--trace</h3><p>Compile-time enable for wave models.</p></div>
        <div class="idea-card"><h3>--trace-fst</h3><p>Same path, FST instead of VCD.</p></div>
        <div class="idea-card"><h3>tfp->dump</h3><p>TB must sample time into the file.</p></div>
        <div class="idea-card"><h3>VCD / FST</h3><p>Portable text vs compact binary dump.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vtr-controls">
        <div class="vtr-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>VCD ready</option>
            <option value="fst">FST farm</option>
            <option value="no_dump">trace, no dump</option>
            <option value="blind">dump without --trace</option>
            <option value="open_only">open, no dump</option>
            <option value="no_close">ready, no close</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-arm">Arm selected</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan trace</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo no dump</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vtr-layout">
        <div class="panel-box">
          <h3>Format</h3>
          <div class="chip-row" id="fmt-row"></div>
          <h3>Pipeline steps</h3>
          <ul class="step-list" id="step-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Trace sketch</h3>
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
    const fmt = formatOf(state.format);
    const s = state.steps;
    return `# verilator … ${s.trace ? fmt.flag : "(no --trace)"}
# format: ${fmt.label}
# TB:
#   open  ${s.open ? "yes" : "no"}
#   dump  ${s.dump ? "yes" : "no"}
#   close ${s.close ? "yes" : "no"}
# status: ${state.lastScanned ? state.status : "— (Scan)"}
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

  function runScan(silent) {
    const ev = evaluate(state.steps, state.format);
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
    pushLog("# starter READY");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.steps = { ...p.steps };
    state.format = p.format;
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

  function armSelected() {
    if (!state.sel) {
      state.lastAction = "arm-bad";
      pushLog("# arm FAIL (select a step)");
      renderAll();
      return;
    }
    state.steps[state.sel] = true;
    pushTrace(`arm: ${state.sel}`);
    pushLog(`# arm ${state.sel}`);
    runScan(true);
    state.lastAction = "arm";
    renderAll();
  }

  function toggleStep(id) {
    state.steps[id] = !state.steps[id];
    state.sel = id;
    state.preset = "custom";
    pushTrace(`toggle: ${id} → ${state.steps[id] ? "on" : "off"}`);
    runScan(true);
    state.lastAction = "toggle";
    pushLog(`# toggle ${id}`);
    renderAll();
  }

  function selectStep(id) {
    state.sel = id;
    state.lastAction = "select";
    renderAll();
  }

  function selectFormat(id) {
    state.format = id;
    state.preset = "custom";
    runScan(true);
    state.lastAction = "format";
    pushLog(`# format ${id}`);
    renderAll();
  }

  function demo() {
    applyPreset("no_dump", "demo");
    state.demoed = true;
    pushLog("# demo no dump OPEN");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain --trace");
    pushTrace("explain: --trace/--trace-fst · open · dump · close → READY");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const step = STEPS.find((s) => s.id === state.sel);
    const fmt = formatOf(state.format);
    const ev = evaluate(state.steps, state.format);

    document.getElementById("fmt-row").innerHTML = FORMATS.map((f) => {
      const on = state.format === f.id;
      return `<button type="button" class="chip ${on ? "is-on" : ""}" data-fmt="${f.id}">
        <span class="k">${f.flag}</span>${f.label}
      </button>`;
    }).join("");
    document.querySelectorAll("[data-fmt]").forEach((el) => {
      el.addEventListener("click", () =>
        selectFormat(/** @type {string} */ (el.getAttribute("data-fmt")))
      );
    });

    document.getElementById("step-list").innerHTML = STEPS.map((s) => {
      const on = !!state.steps[s.id];
      return `<li class="${state.sel === s.id ? "is-sel" : ""}" data-step="${s.id}">
        <span class="id">${s.label}</span>
        <span class="tag">${s.id}</span>
        <span class="tag ${on ? "is-ok" : "is-bad"}">${on ? "on" : "off"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-step]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = /** @type {string} */ (el.getAttribute("data-step"));
        if (state.sel === id) toggleStep(id);
        else selectStep(id);
      });
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a pipeline step (click again to toggle). Pick VCD or FST format.";
    if (step) blurb = step.blurb;
    else if (state.lastAction === "format") blurb = fmt.blurb;
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
      v.textContent = "Idle — Load preset, Arm selected, or Scan trace";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${ev.hasTrace ? "is-ok" : "is-bad"}">trace=${ev.hasTrace ? 1 : 0}</span>
      <span class="flag is-ok">fmt=${state.format}</span>
      <span class="flag ${ev.hasOpen ? "is-ok" : "is-bad"}">open=${ev.hasOpen ? 1 : 0}</span>
      <span class="flag ${ev.hasDump ? "is-ok" : "is-bad"}">dump=${ev.hasDump ? 1 : 0}</span>
      <span class="flag ${ev.hasClose ? "is-ok" : ""}">close=${ev.hasClose ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          steps: state.steps,
          format: state.format,
          sel: state.sel,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-trace",
      title: "Quiz: --trace",
      type: "quiz",
      prompt: "--trace is…",
      hint: "Compile enable.",
      choices: [
        "a compile-time flag that enables tracing support in the Verilated model",
        "a GTKWave cursor name",
        "the same as +SEED",
        "only a Makefile PHONY target",
      ],
      answer:
        "a compile-time flag that enables tracing support in the Verilated model",
    },
    {
      id: "quiz-fst",
      title: "Quiz: --trace-fst",
      type: "quiz",
      prompt: "--trace-fst selects…",
      hint: "Format.",
      choices: [
        "FST dump format instead of the default VCD path",
        "only lint warnings",
        "UVM_TESTNAME",
        "timescale 1ns/1ps",
      ],
      answer: "FST dump format instead of the default VCD path",
    },
    {
      id: "quiz-dump",
      title: "Quiz: dump",
      type: "quiz",
      prompt: "tfp->dump(time)…",
      hint: "Sample.",
      choices: [
        "writes wave samples at the given simulation time into the dump file",
        "compiles the RTL",
        "disables --trace",
        "sets the random seed",
      ],
      answer:
        "writes wave samples at the given simulation time into the dump file",
    },
    {
      id: "quiz-roles",
      title: "Quiz: roles",
      type: "quiz",
      prompt: "VCD vs FST in this lab…",
      hint: "Portable vs compact.",
      choices: [
        "VCD is portable text; FST is a compact binary farm-friendly format",
        "they are identical bit-for-bit",
        "FST is only for iverilog",
        "VCD cannot be opened in GTKWave",
      ],
      answer:
        "VCD is portable text; FST is a compact binary farm-friendly format",
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
      id: "load-fst",
      title: "Load FST",
      prompt: "Load FST farm — READY with fst.",
      hint: "FST farm → Load",
      setup: () => {
        selPreset.value = "fst";
        loadPreset();
      },
      check: () =>
        state.format === "fst" &&
        state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-no-dump",
      title: "Load no dump",
      prompt: "Load trace, no dump — OPEN.",
      hint: "trace, no dump → Load",
      setup: () => {
        selPreset.value = "no_dump";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" &&
        state.steps.trace &&
        !state.steps.dump,
    },
    {
      id: "load-blind",
      title: "Load blind",
      prompt: "Load dump without --trace — BLIND.",
      hint: "dump without --trace → Load",
      setup: () => {
        selPreset.value = "blind";
        loadPreset();
      },
      check: () =>
        state.status === "BLIND" && !state.steps.trace,
    },
    {
      id: "load-open",
      title: "Load open only",
      prompt: "Load open, no dump — OPEN.",
      hint: "open, no dump → Load",
      setup: () => {
        selPreset.value = "open_only";
        loadPreset();
      },
      check: () =>
        state.steps.open &&
        !state.steps.dump &&
        state.status === "OPEN",
    },
    {
      id: "load-no-close",
      title: "Load no close",
      prompt: "Load ready, no close — still READY.",
      hint: "ready, no close → Load",
      setup: () => {
        selPreset.value = "no_close";
        loadPreset();
      },
      check: () =>
        state.ready &&
        !state.steps.close &&
        state.lastAction === "load",
    },
    {
      id: "arm",
      title: "Arm dump",
      prompt: "From open_only, Arm dump — READY.",
      hint: "Select dump → Arm",
      setup: () => {
        selPreset.value = "open_only";
        loadPreset();
        state.sel = "dump";
        armSelected();
      },
      check: () =>
        state.steps.dump &&
        state.ready &&
        state.lastAction === "arm",
    },
    {
      id: "select",
      title: "Select step",
      prompt: "Click the dump step row.",
      hint: "Click dump",
      setup: () => {
        loadStarter();
        selectStep("dump");
      },
      check: () =>
        state.sel === "dump" && state.lastAction === "select",
    },
    {
      id: "toggle",
      title: "Toggle step",
      prompt: "From starter, toggle close off.",
      hint: "Click close twice",
      setup: () => {
        loadStarter();
        state.sel = "close";
        toggleStep("close");
      },
      check: () =>
        !state.steps.close && state.lastAction === "toggle",
    },
    {
      id: "format-fst",
      title: "Select FST",
      prompt: "On starter, click FST format chip.",
      hint: "Click FST",
      setup: () => {
        loadStarter();
        selectFormat("fst");
      },
      check: () =>
        state.format === "fst" && state.lastAction === "format",
    },
    {
      id: "scan-ok",
      title: "Scan READY",
      prompt: "On starter, Scan trace — READY.",
      hint: "Scan trace",
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
      prompt: "On no dump, Scan — OPEN.",
      hint: "no dump → Scan",
      setup: () => {
        selPreset.value = "no_dump";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo no dump",
      prompt: "Click Demo no dump.",
      hint: "Demo no dump",
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
      prompt: "Literacy sketch mentions --trace or dump.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /--trace|dump/.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Trace sketch",
      prompt: "On starter, sketch shows READY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /READY/.test(document.getElementById("plan-box").textContent),
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
      prompt: "From blind, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "blind";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vtr-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vtr-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-arm").addEventListener("click", () => armSelected());
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
        state.steps = saved.steps || state.steps;
        state.format = saved.format || state.format;
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
