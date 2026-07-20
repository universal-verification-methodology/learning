(() => {
  /**
   * iverilog timescale (concept)
   *   `timescale unit/precision vs timeunit/timeprecision
   * Starter: `timescale 1ns/1ps · #10 → 10ns — ALIGNED
   */

  const UNITS = [
    { id: "1ns", label: "1ns", fs: 1e6, blurb: "One nanosecond time unit — common TB default." },
    { id: "10ns", label: "10ns", fs: 1e7, blurb: "Coarser unit — #1 means 10 ns of wall time." },
    { id: "1ps", label: "1ps", fs: 1e3, blurb: "Picosecond unit — fine delays need matching precision." },
    { id: "1us", label: "1us", fs: 1e9, blurb: "Microsecond unit — rare in gate-level TB, fine for slow stimuli." },
  ];

  const PRECS = [
    { id: "1ps", label: "1ps", fs: 1e3, blurb: "Precision 1 ps — can resolve # delays down to 1 ps steps." },
    { id: "100ps", label: "100ps", fs: 1e5, blurb: "Precision 100 ps — delays round to 100 ps grid." },
    { id: "1ns", label: "1ns", fs: 1e6, blurb: "Precision 1 ns — cannot express sub-ns delays." },
    { id: "10ns", label: "10ns", fs: 1e7, blurb: "Coarse precision — often a hazard if unit is finer." },
  ];

  const STYLES = [
    {
      id: "timescale",
      label: "`timescale",
      blurb: "Compiler directive: `timescale <unit>/<precision> — classic Verilog / iverilog style.",
    },
    {
      id: "timeunit",
      label: "timeunit",
      blurb: "SV declarations: timeunit / timeprecision inside a module or package scope.",
    },
    {
      id: "none",
      label: "(none)",
      blurb: "No timescale / timeunit — tool defaults apply; delays are ambiguous across files.",
    },
    {
      id: "mixed",
      label: "mixed",
      blurb: "Hazard: both `timescale and timeunit in play without a clear single source of truth.",
    },
  ];

  const DELAYS = [
    { id: "10", ticks: 10, label: "#10" },
    { id: "1", ticks: 1, label: "#1" },
    { id: "100", ticks: 100, label: "#100" },
  ];

  function unitOf(id) {
    return UNITS.find((u) => u.id === id);
  }
  function precOf(id) {
    return PRECS.find((p) => p.id === id);
  }
  function styleOf(id) {
    return STYLES.find((s) => s.id === id);
  }
  function delayOf(id) {
    return DELAYS.find((d) => d.id === id);
  }

  function formatFs(fs) {
    if (fs >= 1e9) return `${fs / 1e9} us`;
    if (fs >= 1e6) return `${fs / 1e6} ns`;
    if (fs >= 1e3) return `${fs / 1e3} ps`;
    return `${fs} fs`;
  }

  function evaluate(styleId, unitId, precId, delayId) {
    const unit = unitOf(unitId);
    const prec = precOf(precId);
    const delay = delayOf(delayId);
    const style = styleOf(styleId);
    const delayFs = unit.fs * delay.ticks;
    const delayLabel = formatFs(delayFs);
    const precOk = prec.fs <= unit.fs;
    const hasDecl = styleId === "timescale" || styleId === "timeunit";
    const mixed = styleId === "mixed";
    const none = styleId === "none";

    let status = "OPEN";
    let ready = false;
    let reason = "declare a timescale or timeunit";

    if (mixed) {
      status = "HAZARD";
      reason = "mixed `timescale and timeunit — pick one story";
    } else if (none) {
      status = "OPEN";
      reason = "no declaration — delays inherit tool/file defaults";
    } else if (!precOk) {
      status = "HAZARD";
      reason = `precision ${prec.label} coarser than unit ${unit.label}`;
    } else {
      status = "ALIGNED";
      ready = true;
      reason = `${style.label} ${unit.label}/${prec.label}; ${delay.label} → ${delayLabel}`;
    }

    return {
      status,
      ready,
      reason,
      delayFs,
      delayLabel,
      precOk,
      hasDecl,
      mixed,
      none,
    };
  }

  function declSketch(styleId, unitId, precId) {
    if (styleId === "timescale") {
      return `\`timescale ${unitId}/${precId}`;
    }
    if (styleId === "timeunit") {
      return `timeunit ${unitId};\ntimeprecision ${precId};`;
    }
    if (styleId === "mixed") {
      return `\`timescale ${unitId}/${precId}\n// …and also:\ntimeunit ${unitId};\ntimeprecision ${precId};`;
    }
    return "// (no timescale / timeunit)";
  }

  const PRESETS = {
    starter: {
      label: "starter: 1ns/1ps",
      style: "timescale",
      unit: "1ns",
      prec: "1ps",
      delay: "10",
      note: "`timescale 1ns/1ps with #10 → 10 ns — ALIGNED.",
      autoScan: true,
    },
    timeunit_sv: {
      label: "SV timeunit",
      style: "timeunit",
      unit: "1ns",
      prec: "1ps",
      delay: "10",
      note: "timeunit/timeprecision pair — ALIGNED (SV style).",
      autoScan: true,
    },
    coarse_prec: {
      label: "coarse precision",
      style: "timescale",
      unit: "1ns",
      prec: "10ns",
      delay: "10",
      note: "Precision coarser than unit — HAZARD.",
      autoScan: true,
    },
    none: {
      label: "no declaration",
      style: "none",
      unit: "1ns",
      prec: "1ps",
      delay: "10",
      note: "No directive — OPEN (ambiguous defaults).",
      autoScan: true,
    },
    mixed: {
      label: "mixed styles",
      style: "mixed",
      unit: "1ns",
      prec: "1ps",
      delay: "10",
      note: "Both styles at once — HAZARD.",
      autoScan: true,
    },
    ten_ns: {
      label: "10ns unit",
      style: "timescale",
      unit: "10ns",
      prec: "1ns",
      delay: "1",
      note: "`timescale 10ns/1ns; #1 → 10 ns — ALIGNED.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      style: "timescale",
      unit: "1ns",
      prec: "1ps",
      delay: "10",
      note: "Idle — change fields, Apply, or Scan.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Timescale literacy (document aid — not a real iverilog run)
//
//   \`timescale <time_unit>/<time_precision>
//     unit      → what #1 means (e.g. 1ns)
//     precision → simulation time grid (e.g. 1ps)
//
//   SystemVerilog alternative (scoped):
//     timeunit 1ns;
//     timeprecision 1ps;
//
// Pitfalls
//   · precision coarser than unit  → HAZARD (can't resolve the unit)
//   · missing declaration          → OPEN (tool/file defaults)
//   · mixing \`timescale + timeunit → HAZARD (two sources of truth)
//
// ALIGNED = one clear style + precision ≤ unit
// Pair with delay-event-wait for # / @ / wait literacy.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.style, p.unit, p.prec, p.delay);
    return {
      preset: "starter",
      style: p.style,
      unit: p.unit,
      prec: p.prec,
      delay: p.delay,
      selField: "unit",
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      delayLabel: ev.delayLabel,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: ${ev.status}`],
    };
  }

  const CLEARED_KEY = "ddv-iverilog-timescale-cleared-v1";
  const STORE_KEY = "ddv-iverilog-timescale-session-v1";

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

  const root = document.getElementById("its-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>\`timescale 1ns/1ps</code> with <code>#10</code>
        → 10&nbsp;ns — ALIGNED.</p>
      <button type="button" class="btn btn-secondary" id="its-starter">Load starter example</button>
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
        <div class="idea-card"><h3>time unit</h3><p>What <code>#1</code> means in wall time.</p></div>
        <div class="idea-card"><h3>precision</h3><p>Simulation time grid / rounding.</p></div>
        <div class="idea-card"><h3>\`timescale</h3><p>Classic directive: unit/precision.</p></div>
        <div class="idea-card"><h3>timeunit</h3><p>SV scoped unit + timeprecision.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="its-controls">
        <div class="its-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>1ns/1ps starter</option>
            <option value="timeunit_sv">SV timeunit</option>
            <option value="coarse_prec">coarse precision</option>
            <option value="none">no declaration</option>
            <option value="mixed">mixed styles</option>
            <option value="ten_ns">10ns unit</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="its-field">
          <label for="sel-style">Style</label>
          <select id="sel-style">
            <option value="timescale">\`timescale</option>
            <option value="timeunit">timeunit</option>
            <option value="none">(none)</option>
            <option value="mixed">mixed</option>
          </select>
        </div>
        <div class="its-field">
          <label for="sel-unit">Unit</label>
          <select id="sel-unit">
            <option value="1ns">1ns</option>
            <option value="10ns">10ns</option>
            <option value="1ps">1ps</option>
            <option value="1us">1us</option>
          </select>
        </div>
        <div class="its-field">
          <label for="sel-prec">Precision</label>
          <select id="sel-prec">
            <option value="1ps">1ps</option>
            <option value="100ps">100ps</option>
            <option value="1ns">1ns</option>
            <option value="10ns">10ns</option>
          </select>
        </div>
        <div class="its-field">
          <label for="sel-delay">Delay</label>
          <select id="sel-delay">
            <option value="10">#10</option>
            <option value="1">#1</option>
            <option value="100">#100</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-apply">Apply</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo coarse prec</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="its-layout">
        <div class="panel-box">
          <h3>Fields</h3>
          <ul class="metric-list" id="field-list"></ul>
          <h3>Style chips</h3>
          <div class="chip-row" id="chip-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <div class="delay-box" id="delay-box">#10 → —</div>
          <h3 style="margin-top:0.85rem">Decl sketch</h3>
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
  const selStyle = /** @type {HTMLSelectElement} */ (document.getElementById("sel-style"));
  const selUnit = /** @type {HTMLSelectElement} */ (document.getElementById("sel-unit"));
  const selPrec = /** @type {HTMLSelectElement} */ (document.getElementById("sel-prec"));
  const selDelay = /** @type {HTMLSelectElement} */ (document.getElementById("sel-delay"));

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
    selStyle.value = state.style;
    selUnit.value = state.unit;
    selPrec.value = state.prec;
    selDelay.value = state.delay;
  }

  function runScan(silent) {
    const ev = evaluate(state.style, state.unit, state.prec, state.delay);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.delayLabel = ev.delayLabel;
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
    pushLog("# starter ALIGNED");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.style = p.style;
    state.unit = p.unit;
    state.prec = p.prec;
    state.delay = p.delay;
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.delayLabel = "—";
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

  function applyFields() {
    state.style = selStyle.value;
    state.unit = selUnit.value;
    state.prec = selPrec.value;
    state.delay = selDelay.value;
    state.preset = "custom";
    pushTrace(`apply: ${state.style} ${state.unit}/${state.prec} ${delayOf(state.delay).label}`);
    pushLog(`# apply ${state.style} ${state.unit}/${state.prec}`);
    runScan(true);
    state.lastAction = "apply";
    renderAll();
  }

  function demo() {
    applyPreset("coarse_prec", "demo");
    state.demoed = true;
    pushLog("# demo coarse precision HAZARD");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain timescale");
    pushTrace("explain: unit · precision · `timescale vs timeunit → ALIGNED if prec≤unit");
    renderAll();
  }

  function selectField(id) {
    state.selField = id;
    state.lastAction = "select-field";
    renderAll();
  }

  function selectStyleChip(id) {
    state.style = id;
    state.selField = "style";
    state.preset = "custom";
    syncInputs();
    runScan(true);
    state.lastAction = "select-style";
    pushLog(`# style ${id}`);
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const unit = unitOf(state.unit);
    const prec = precOf(state.prec);
    const style = styleOf(state.style);
    const delay = delayOf(state.delay);
    const ev = evaluate(state.style, state.unit, state.prec, state.delay);

    const fields = [
      { id: "style", label: "style", val: style.label, ok: state.style !== "mixed" && state.style !== "none" },
      { id: "unit", label: "unit", val: unit.label, ok: true },
      { id: "prec", label: "precision", val: prec.label, ok: ev.precOk },
      { id: "delay", label: "delay", val: delay.label, ok: true },
    ];

    document.getElementById("field-list").innerHTML = fields
      .map(
        (f) => `<li class="${state.selField === f.id ? "is-sel" : ""}" data-field="${f.id}">
        <span class="id">${f.label}</span>
        <span class="tag">${f.val}</span>
        <span class="tag ${f.ok ? "is-ok" : "is-bad"}">${f.ok ? "OK" : "FAIL"}</span>
      </li>`
      )
      .join("");
    document.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("click", () =>
        selectField(/** @type {string} */ (el.getAttribute("data-field")))
      );
    });

    document.getElementById("chip-row").innerHTML = STYLES.map((s) => {
      const on = state.style === s.id;
      return `<button type="button" class="chip ${on ? "is-on" : ""}" data-style="${s.id}">
        <span class="k">style</span>${s.label}
      </button>`;
    }).join("");
    document.querySelectorAll("[data-style]").forEach((el) => {
      el.addEventListener("click", () =>
        selectStyleChip(/** @type {string} */ (el.getAttribute("data-style")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;

    let blurb = "Pick style / unit / precision / delay, then Apply or Scan.";
    if (state.selField === "style") blurb = style.blurb;
    else if (state.selField === "unit") blurb = unit.blurb;
    else if (state.selField === "prec") blurb = prec.blurb;
    else if (state.selField === "delay") {
      blurb = `${delay.label} with unit ${unit.label} → ${ev.delayLabel} of simulated time.`;
    }
    document.getElementById("role-blurb").textContent = blurb;
    document.getElementById("delay-box").textContent =
      `${delay.label} → ${state.lastScanned ? ev.delayLabel : "— (Scan)"}`;

    document.getElementById("plan-box").textContent = `${declSketch(
      state.style,
      state.unit,
      state.prec
    )}
// ${delay.label} → ${ev.delayLabel}
# status: ${state.lastScanned ? state.status : "— (Scan)"}
# reason: ${state.lastScanned ? state.reason : "—"}`;

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
      v.textContent = "Idle — Load preset, Apply, or Scan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `ALIGNED — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag is-ok">style=${state.style}</span>
      <span class="flag is-ok">unit=${state.unit}</span>
      <span class="flag ${ev.precOk ? "is-ok" : "is-bad"}">prec=${state.prec}</span>
      <span class="flag is-ok">delay=${delay.label}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          style: state.style,
          unit: state.unit,
          prec: state.prec,
          delay: state.delay,
          selField: state.selField,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-unit",
      title: "Quiz: unit",
      type: "quiz",
      prompt: "The time unit in `timescale sets…",
      hint: "#1 meaning.",
      choices: [
        "what #1 means in simulated wall time",
        "only the VCD file name",
        "the GTKWave color map",
        "UVM_TESTNAME",
      ],
      answer: "what #1 means in simulated wall time",
    },
    {
      id: "quiz-prec",
      title: "Quiz: precision",
      type: "quiz",
      prompt: "Time precision is…",
      hint: "Grid.",
      choices: [
        "the simulation time grid / rounding resolution",
        "always equal to the unit",
        "a plusarg for seeds",
        "the Makefile PHONY target",
      ],
      answer: "the simulation time grid / rounding resolution",
    },
    {
      id: "quiz-timescale",
      title: "Quiz: `timescale",
      type: "quiz",
      prompt: "`timescale is…",
      hint: "Directive.",
      choices: [
        "a compiler directive of the form unit/precision",
        "a runtime vvp plusarg",
        "a Verilator --trace flag",
        "a coverage bin",
      ],
      answer: "a compiler directive of the form unit/precision",
    },
    {
      id: "quiz-timeunit",
      title: "Quiz: timeunit",
      type: "quiz",
      prompt: "timeunit / timeprecision are…",
      hint: "SV scoped.",
      choices: [
        "SystemVerilog scoped declarations (often with timeprecision)",
        "identical to `define macros only",
        "GTKWave cursor names",
        "cocotb trigger types",
      ],
      answer: "SystemVerilog scoped declarations (often with timeprecision)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — ALIGNED.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "ALIGNED",
    },
    {
      id: "load-sv",
      title: "Load SV timeunit",
      prompt: "Load SV timeunit — ALIGNED.",
      hint: "SV timeunit → Load",
      setup: () => {
        selPreset.value = "timeunit_sv";
        loadPreset();
      },
      check: () =>
        state.style === "timeunit" &&
        state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-coarse",
      title: "Load coarse prec",
      prompt: "Load coarse precision — HAZARD.",
      hint: "coarse precision → Load",
      setup: () => {
        selPreset.value = "coarse_prec";
        loadPreset();
      },
      check: () =>
        state.status === "HAZARD" && !state.ready,
    },
    {
      id: "load-none",
      title: "Load none",
      prompt: "Load no declaration — OPEN.",
      hint: "no declaration → Load",
      setup: () => {
        selPreset.value = "none";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" && state.style === "none",
    },
    {
      id: "load-mixed",
      title: "Load mixed",
      prompt: "Load mixed styles — HAZARD.",
      hint: "mixed styles → Load",
      setup: () => {
        selPreset.value = "mixed";
        loadPreset();
      },
      check: () =>
        state.status === "HAZARD" && state.style === "mixed",
    },
    {
      id: "load-ten",
      title: "Load 10ns unit",
      prompt: "Load 10ns unit — ALIGNED; #1 → 10 ns.",
      hint: "10ns unit → Load",
      setup: () => {
        selPreset.value = "ten_ns";
        loadPreset();
      },
      check: () =>
        state.unit === "10ns" &&
        state.ready &&
        state.delayLabel === "10 ns",
    },
    {
      id: "apply",
      title: "Apply fields",
      prompt: "From coarse, Apply unit/prec back to 1ns/1ps — ALIGNED.",
      hint: "Set fields → Apply",
      setup: () => {
        selPreset.value = "coarse_prec";
        loadPreset();
        selStyle.value = "timescale";
        selUnit.value = "1ns";
        selPrec.value = "1ps";
        selDelay.value = "10";
        applyFields();
      },
      check: () =>
        state.ready &&
        state.prec === "1ps" &&
        state.lastAction === "apply",
    },
    {
      id: "select-field",
      title: "Select field",
      prompt: "Click the precision row.",
      hint: "Click precision",
      setup: () => {
        loadStarter();
        selectField("prec");
      },
      check: () =>
        state.selField === "prec" &&
        state.lastAction === "select-field",
    },
    {
      id: "select-style",
      title: "Select style chip",
      prompt: "Click the timeunit style chip.",
      hint: "Click timeunit",
      setup: () => {
        loadStarter();
        selectStyleChip("timeunit");
      },
      check: () =>
        state.style === "timeunit" &&
        state.lastAction === "select-style",
    },
    {
      id: "scan-ok",
      title: "Scan ALIGNED",
      prompt: "On starter, Scan — ALIGNED.",
      hint: "Scan",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan HAZARD",
      prompt: "On coarse precision, Scan — HAZARD.",
      hint: "coarse → Scan",
      setup: () => {
        selPreset.value = "coarse_prec";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo coarse",
      prompt: "Click Demo coarse prec.",
      hint: "Demo coarse prec",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "HAZARD" &&
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
      prompt: "Literacy sketch mentions timeunit or precision.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /timeunit|precision/i.test(sourceSketch()),
    },
    {
      id: "decl-sketch",
      title: "Decl sketch",
      prompt: "On starter, decl sketch shows `timescale 1ns/1ps.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /timescale 1ns\/1ps/.test(
          document.getElementById("plan-box").textContent
        ),
    },
    {
      id: "delay-map",
      title: "Delay map",
      prompt: "Starter #10 maps to 10 ns.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.delayLabel === "10 ns",
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
      prompt: "From mixed, Reset — ALIGNED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "mixed";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "ALIGNED",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="its-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("its-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-apply").addEventListener("click", () => applyFields());
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
        state.style = saved.style || state.style;
        state.unit = saved.unit || state.unit;
        state.prec = saved.prec || state.prec;
        state.delay = saved.delay || state.delay;
        state.selField = saved.selField || state.selField;
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
