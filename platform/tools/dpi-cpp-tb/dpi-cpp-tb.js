(() => {
  /**
   * C++ TB / DPI sketch (concept)
   *   Verilator C++ TB vs SV TB paradigms
   * Starter: C++ model + eval loop — READY
   */

  const PARADIGMS = [
    {
      id: "cpp",
      label: "verilator_cpp",
      need: ["model", "eval_loop"],
      blurb: "Host is C++ main: construct Vtop*, poke ports, eval() in a loop.",
    },
    {
      id: "sv",
      label: "classic_sv",
      need: ["initial_block", "finish"],
      blurb: "Host is SystemVerilog TB: initial/always drive DUT; $finish ends.",
    },
  ];

  const PIECES = [
    {
      id: "model",
      label: "Vtop* model",
      paradigms: ["cpp"],
      blurb: "Verilated class instance — the DUT model in C++.",
    },
    {
      id: "eval_loop",
      label: "eval() loop",
      paradigms: ["cpp"],
      blurb: "Advance time / clock and call top->eval() each step.",
    },
    {
      id: "initial_block",
      label: "initial/always",
      paradigms: ["sv"],
      blurb: "SV procedural TB that drives and samples the DUT.",
    },
    {
      id: "finish",
      label: "$finish",
      paradigms: ["sv"],
      blurb: "End the SV simulation cleanly.",
    },
    {
      id: "dpi",
      label: "DPI import/export",
      paradigms: ["cpp", "sv"],
      blurb: "Optional bridge: SV ↔ C/C++ function calls (not required for READY).",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: C++ READY",
      paradigmId: "cpp",
      pieces: { model: true, eval_loop: true, initial_block: false, finish: false, dpi: false },
      note: "Verilator C++ TB with model + eval loop — READY.",
      autoScan: true,
    },
    sv_ready: {
      label: "SV READY",
      paradigmId: "sv",
      pieces: { model: false, eval_loop: false, initial_block: true, finish: true, dpi: false },
      note: "Classic SV TB with initial + $finish — READY.",
      autoScan: true,
    },
    cpp_dpi: {
      label: "C++ + DPI",
      paradigmId: "cpp",
      pieces: { model: true, eval_loop: true, initial_block: false, finish: false, dpi: true },
      note: "C++ path with optional DPI — still READY.",
      autoScan: true,
    },
    mismatch: {
      label: "C++ + SV pieces",
      paradigmId: "cpp",
      pieces: { model: false, eval_loop: false, initial_block: true, finish: true, dpi: false },
      note: "C++ paradigm but only SV pieces — MISMATCH.",
      autoScan: true,
    },
    missing: {
      label: "C++ missing eval",
      paradigmId: "cpp",
      pieces: { model: true, eval_loop: false, initial_block: false, finish: false, dpi: false },
      note: "Model without eval loop — NEED_PIECE.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      paradigmId: null,
      pieces: { model: false, eval_loop: false, initial_block: false, finish: false, dpi: false },
      note: "Idle — pick a paradigm and toggle pieces, then Build.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// C++ TB / DPI literacy (document aid)
//
// Two host paradigms around the same DUT RTL:
//
//   Verilator C++ TB          Classic SV TB
//   ----------------          -------------
//   Vtop* model               module tb;
//   top->eval() loop          initial / always
//   main() returns            $finish
//
// DPI (optional): import "DPI-C" / export "DPI-C"
//   — call C from SV or SV from C; not required for a minimal READY sketch.
//
// READY    = paradigm's required pieces present (DPI optional)
// NEED_*   = paradigm or required piece missing
// MISMATCH = pieces belong to the other paradigm
//
// Concept only — not a browser Verilator build.`;
  }

  function missingNeed(paradigmId, pieces) {
    const p = PARADIGMS.find((x) => x.id === paradigmId);
    if (!p) return [];
    return p.need.filter((id) => !pieces[id]);
  }

  function foreignPieces(paradigmId, pieces) {
    return PIECES.filter(
      (pc) =>
        pieces[pc.id] &&
        pc.id !== "dpi" &&
        !pc.paradigms.includes(paradigmId)
    ).map((pc) => pc.id);
  }

  function evaluate(paradigmId, pieces) {
    if (!paradigmId) {
      return {
        status: "NEED_PARADIGM",
        ready: false,
        reason: "pick verilator_cpp or classic_sv",
      };
    }
    const foreign = foreignPieces(paradigmId, pieces);
    if (foreign.length) {
      return {
        status: "MISMATCH",
        ready: false,
        reason: `wrong pieces for ${paradigmId}: ${foreign.join(", ")}`,
      };
    }
    const miss = missingNeed(paradigmId, pieces);
    if (miss.length) {
      return {
        status: "NEED_PIECE",
        ready: false,
        reason: `missing ${miss.join(", ")}`,
      };
    }
    return {
      status: "READY",
      ready: true,
      reason: pieces.dpi
        ? `${paradigmId} stack + DPI optional`
        : `${paradigmId} stack complete`,
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.paradigmId, p.pieces);
    return {
      preset: "starter",
      paradigmId: p.paradigmId,
      pieces: { ...p.pieces },
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: READY cpp model+eval"],
    };
  }

  const CLEARED_KEY = "ddv-dpi-cpp-tb-cleared-v1";
  const STORE_KEY = "ddv-dpi-cpp-tb-session-v1";

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

  const root = document.getElementById("dpi-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        paradigm <code>verilator_cpp</code> with
        <code>Vtop* model</code> + <code>eval() loop</code> —
        stack READY.</p>
      <button type="button" class="btn btn-secondary" id="dpi-starter">Load starter example</button>
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
        <div class="idea-card"><h3>C++ TB</h3><p>Vtop* + eval() host around Verilator.</p></div>
        <div class="idea-card"><h3>SV TB</h3><p>initial/always + $finish host.</p></div>
        <div class="idea-card"><h3>DPI</h3><p>Optional SV ↔ C bridge calls.</p></div>
        <div class="idea-card"><h3>READY</h3><p>Required pieces for the paradigm.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="dpi-controls">
        <div class="dpi-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>C++ READY</option>
            <option value="sv_ready">SV READY</option>
            <option value="cpp_dpi">C++ + DPI</option>
            <option value="mismatch">C++ + SV pieces</option>
            <option value="missing">C++ missing eval</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-build">Build sketch</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan stack</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="dpi-layout">
        <div class="panel-box">
          <h3>Stack chain</h3>
          <div class="chain" id="chain-box"></div>
          <h3>Paradigm compare</h3>
          <table class="compare-table" id="compare-table" aria-label="C++ vs SV"></table>
          <h3>Paradigm</h3>
          <div class="pick-row" id="paradigm-row"></div>
          <h3>Pieces (toggle)</h3>
          <div class="piece-row" id="piece-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Stack sketch</h3>
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
    const p = PARADIGMS.find((x) => x.id === state.paradigmId);
    const on = PIECES.filter((pc) => state.pieces[pc.id]).map((pc) => pc.id);
    return `# TB / DPI stack
paradigm: ${p ? p.label : "—"}
pieces:   ${on.join(", ") || "(none)"}
need:     ${p ? p.need.join(", ") : "—"}
dpi:      ${state.pieces.dpi ? "yes (optional)" : "no"}
#
# status: ${state.lastScanned ? state.status : "— (Scan stack)"}
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
    const ev = evaluate(state.paradigmId, state.pieces);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status} ${state.paradigmId || "—"}`);
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
    state.paradigmId = p.paradigmId;
    state.pieces = { ...p.pieces };
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

  function build() {
    if (!state.paradigmId) {
      state.lastAction = "build-bad";
      pushLog("# build FAIL (need paradigm)");
      renderAll();
      return;
    }
    pushTrace(`build: ${state.paradigmId}`);
    pushLog(`# build ${state.paradigmId}`);
    runScan(true);
    state.lastAction = "build";
    renderAll();
  }

  function demo() {
    applyPreset("mismatch", "demo");
    state.demoed = true;
    pushLog("# demo MISMATCH");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain paradigms");
    pushTrace("explain: cpp Vtop+eval · sv initial+$finish · DPI optional");
    renderAll();
  }

  function selectParadigm(id) {
    state.paradigmId = id;
    state.lastAction = "select-paradigm";
    state.lastScanned = false;
    renderAll();
  }

  function togglePiece(id) {
    state.pieces[id] = !state.pieces[id];
    state.lastAction = "toggle-piece";
    state.lastScanned = false;
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const p = PARADIGMS.find((x) => x.id === state.paradigmId);
    const onPieces = PIECES.filter((pc) => state.pieces[pc.id]);

    document.getElementById("chain-box").innerHTML = `${
      p ? p.label : '<span class="gap">?paradigm</span>'
    } · ${
      onPieces.length
        ? onPieces.map((pc) => pc.id).join(" + ")
        : '<span class="gap">?pieces</span>'
    }`;

    document.getElementById("compare-table").innerHTML = `
      <thead><tr><th></th><th>C++ TB</th><th>SV TB</th></tr></thead>
      <tbody>
        <tr><th>host</th><td class="${state.paradigmId === "cpp" ? "is-hit" : ""}">main() / Vtop*</td><td class="${state.paradigmId === "sv" ? "is-hit" : ""}">module tb</td></tr>
        <tr><th>step</th><td class="${state.paradigmId === "cpp" ? "is-hit" : ""}">eval()</td><td class="${state.paradigmId === "sv" ? "is-hit" : ""}">#delay / @edge</td></tr>
        <tr><th>end</th><td class="${state.paradigmId === "cpp" ? "is-hit" : ""}">return</td><td class="${state.paradigmId === "sv" ? "is-hit" : ""}">$finish</td></tr>
        <tr><th>DPI</th><td colspan="2">optional import/export either side</td></tr>
      </tbody>`;

    document.getElementById("paradigm-row").innerHTML = PARADIGMS.map((x) => {
      const on = state.paradigmId === x.id;
      return `<button type="button" class="pick-card ${on ? "is-sel is-on" : ""}" data-paradigm="${x.id}">
        <div class="k">need ${x.need.join("+")}</div>
        <div class="v">${x.label}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-paradigm]").forEach((el) => {
      el.addEventListener("click", () =>
        selectParadigm(/** @type {string} */ (el.getAttribute("data-paradigm")))
      );
    });

    document.getElementById("piece-row").innerHTML = PIECES.map((pc) => {
      const on = !!state.pieces[pc.id];
      const fit =
        !state.paradigmId ||
        pc.paradigms.includes(state.paradigmId) ||
        pc.id === "dpi";
      return `<button type="button" class="pick-card ${on ? "is-on" : ""} ${on ? "is-sel" : ""}" data-piece="${pc.id}">
        <div class="k">${fit ? (pc.id === "dpi" ? "optional" : "piece") : "foreign"}</div>
        <div class="v">${pc.label}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-piece]").forEach((el) => {
      el.addEventListener("click", () =>
        togglePiece(/** @type {string} */ (el.getAttribute("data-piece")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Pick a paradigm, toggle pieces, then Build sketch / Scan.";
    if (p && state.lastAction === "select-paradigm") blurb = p.blurb;
    else if (state.lastAction === "toggle-piece") {
      const lastOn = onPieces[onPieces.length - 1];
      blurb = lastOn ? lastOn.blurb : blurb;
    } else if (p) blurb = p.blurb;
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
      v.textContent = "Idle — Load preset, Build sketch, or Scan stack";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Stack READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const miss = state.paradigmId
      ? missingNeed(state.paradigmId, state.pieces).length
      : "—";
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag is-ok">paradigm=${state.paradigmId || "—"}</span>
      <span class="flag ${miss && miss !== "—" ? "is-bad" : "is-ok"}">missing=${miss}</span>
      <span class="flag ${state.pieces.dpi ? "is-ok" : ""}">dpi=${state.pieces.dpi ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          paradigmId: state.paradigmId,
          pieces: state.pieces,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-cpp",
      title: "Quiz: C++ TB",
      type: "quiz",
      prompt: "A Verilator C++ TB typically…",
      hint: "eval.",
      choices: [
        "constructs a Vtop* model and advances it with eval() in a loop",
        "only opens GTKWave",
        "replaces the DUT RTL",
        "skips the Verilated model",
      ],
      answer:
        "constructs a Vtop* model and advances it with eval() in a loop",
    },
    {
      id: "quiz-sv",
      title: "Quiz: SV TB",
      type: "quiz",
      prompt: "A classic SV TB host uses…",
      hint: "Procedural.",
      choices: [
        "initial/always stimulus and $finish to end",
        "only Vtop* without SV",
        "place-and-route scripts",
        "Makefile PHONY alone",
      ],
      answer: "initial/always stimulus and $finish to end",
    },
    {
      id: "quiz-dpi",
      title: "Quiz: DPI",
      type: "quiz",
      prompt: "DPI in this sketch is…",
      hint: "Optional bridge.",
      choices: [
        "an optional SV ↔ C/C++ call bridge — not required for READY",
        "mandatory for every Verilator run",
        "the same as FST",
        "a compile stage name",
      ],
      answer:
        "an optional SV ↔ C/C++ call bridge — not required for READY",
    },
    {
      id: "quiz-ready",
      title: "Quiz: READY",
      type: "quiz",
      prompt: "Stack READY means…",
      hint: "Required pieces.",
      choices: [
        "the paradigm’s required pieces are present (DPI optional)",
        "coverage is 100%",
        "only DPI is set",
        "SV pieces on a C++ paradigm",
      ],
      answer:
        "the paradigm’s required pieces are present (DPI optional)",
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
      id: "load-sv",
      title: "Load SV",
      prompt: "Load SV READY — READY.",
      hint: "SV READY → Load",
      setup: () => {
        selPreset.value = "sv_ready";
        loadPreset();
      },
      check: () =>
        state.paradigmId === "sv" &&
        state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-dpi",
      title: "Load C++ DPI",
      prompt: "Load C++ + DPI — READY with dpi=1.",
      hint: "C++ + DPI → Load",
      setup: () => {
        selPreset.value = "cpp_dpi";
        loadPreset();
      },
      check: () =>
        state.ready && state.pieces.dpi === true,
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load C++ + SV pieces — MISMATCH.",
      hint: "C++ + SV pieces → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.status === "MISMATCH" && !state.ready,
    },
    {
      id: "load-missing",
      title: "Load missing",
      prompt: "Load C++ missing eval — NEED_PIECE.",
      hint: "C++ missing eval → Load",
      setup: () => {
        selPreset.value = "missing";
        loadPreset();
      },
      check: () =>
        state.status === "NEED_PIECE" && !state.pieces.eval_loop,
    },
    {
      id: "build",
      title: "Build",
      prompt: "From missing, toggle eval_loop, Build — READY.",
      hint: "missing → toggle eval → Build",
      setup: () => {
        selPreset.value = "missing";
        loadPreset();
        state.pieces.eval_loop = true;
        build();
      },
      check: () =>
        state.ready && state.lastAction === "build",
    },
    {
      id: "toggle-model",
      title: "Toggle model",
      prompt: "From idle C++ paradigm, toggle Vtop* model on.",
      hint: "idle → cpp → model",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        selectParadigm("cpp");
        if (!state.pieces.model) togglePiece("model");
      },
      check: () =>
        state.paradigmId === "cpp" &&
        state.pieces.model === true &&
        state.lastAction === "toggle-piece",
    },
    {
      id: "select-paradigm",
      title: "Select paradigm",
      prompt: "Click classic_sv.",
      hint: "Click classic_sv",
      setup: () => {
        loadStarter();
        selectParadigm("sv");
      },
      check: () =>
        state.paradigmId === "sv" &&
        state.lastAction === "select-paradigm",
    },
    {
      id: "toggle-dpi",
      title: "Toggle DPI",
      prompt: "On starter, toggle DPI on.",
      hint: "Click DPI import/export",
      setup: () => {
        loadStarter();
        if (!state.pieces.dpi) togglePiece("dpi");
      },
      check: () =>
        state.pieces.dpi === true &&
        state.lastAction === "toggle-piece",
    },
    {
      id: "scan-ok",
      title: "Scan READY",
      prompt: "On starter, Scan stack — READY.",
      hint: "Scan stack",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan MISMATCH",
      prompt: "On mismatch, Scan — MISMATCH.",
      hint: "C++ + SV → Scan",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo mismatch",
      prompt: "Click Demo mismatch.",
      hint: "Demo mismatch",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "MISMATCH" &&
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
      prompt: "Literacy sketch mentions READY or DPI.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /READY|DPI/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Stack sketch",
      prompt: "On starter, stack sketch shows READY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /READY/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "need-cpp",
      title: "C++ needs",
      prompt: "C++ paradigm needs model + eval_loop.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => {
        const p = PARADIGMS.find((x) => x.id === "cpp");
        return (
          p &&
          p.need.includes("model") &&
          p.need.includes("eval_loop")
        );
      },
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
      prompt: "From missing, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "missing";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="dpi-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("dpi-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-build").addEventListener("click", () => build());
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
        state.paradigmId = saved.paradigmId || null;
        state.pieces = saved.pieces || state.pieces;
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
