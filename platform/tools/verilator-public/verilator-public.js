(() => {
  /**
   * Verilator public (concept)
   *   verilator public / public_flat hierarchy visibility
   * Starter: u_core.state marked public — VISIBLE
   */

  const NODES = [
    {
      id: "clk",
      path: "top.clk",
      kind: "port",
      blurb: "Top ports are already TB-visible without a public mark.",
      defaultPublic: true,
      alwaysVisible: true,
    },
    {
      id: "state",
      path: "top.u_core.state",
      kind: "internal",
      blurb: "Internal FSM state — needs /*verilator public*/ (or public_flat) for C++ access.",
      defaultPublic: false,
      alwaysVisible: false,
    },
    {
      id: "cnt",
      path: "top.u_core.u_alu.cnt",
      kind: "deep",
      blurb: "Deep hierarchy signal — mark public or it may be optimized / inaccessible.",
      defaultPublic: false,
      alwaysVisible: false,
    },
    {
      id: "dbg",
      path: "top.u_core.dbg_bus",
      kind: "internal",
      blurb: "Debug bus wire — public keeps it in the model for TB peek/poke.",
      defaultPublic: false,
      alwaysVisible: false,
    },
  ];

  const MARKS = [
    {
      id: "public",
      label: "public",
      blurb: "/*verilator public*/ — keep this signal visible to the C++ TB hierarchy.",
    },
    {
      id: "public_flat",
      label: "public_flat",
      blurb: "/*verilator public_flat*/ — flatten into the parent for easier C++ naming.",
    },
    {
      id: "none",
      label: "(none)",
      blurb: "No public mark — Verilator may hide or optimize the signal away from the TB.",
    },
  ];

  function nodeOf(id) {
    return NODES.find((n) => n.id === id);
  }

  function markOf(id) {
    return MARKS.find((m) => m.id === id);
  }

  function isVisible(node, markId) {
    if (node.alwaysVisible) return true;
    return markId === "public" || markId === "public_flat";
  }

  function cppAccess(node, markId) {
    if (!isVisible(node, markId)) return "// inaccessible from C++ TB";
    if (markId === "public_flat" && !node.alwaysVisible) {
      return `top->${node.id}  // public_flat`;
    }
    if (node.id === "clk") return "top->clk";
    if (node.id === "state") return "top->u_core->state";
    if (node.id === "cnt") return "top->u_core->u_alu->cnt";
    if (node.id === "dbg") return "top->u_core->dbg_bus";
    return `top->…->${node.id}`;
  }

  function evaluate(marks, probeId) {
    const node = nodeOf(probeId);
    const mark = marks[probeId] || "none";
    const visible = isVisible(node, mark);
    let status = "HIDDEN";
    let ready = false;
    let reason = `${node.path} not public`;

    if (visible) {
      status = "VISIBLE";
      ready = true;
      reason =
        node.alwaysVisible
          ? `${node.path} is a port (always TB-visible)`
          : `${node.path} marked ${mark} — C++ can see it`;
    } else {
      status = "HIDDEN";
      reason = `${node.path} hidden / may be optimized — mark public`;
    }

    const publicN = NODES.filter((n) => isVisible(n, marks[n.id] || "none")).length;
    return { status, ready, reason, visible, publicN, access: cppAccess(node, mark) };
  }

  const PRESETS = {
    starter: {
      label: "starter: state public",
      marks: { clk: "none", state: "public", cnt: "none", dbg: "none" },
      probe: "state",
      note: "u_core.state marked public — VISIBLE.",
      autoScan: true,
    },
    flat: {
      label: "public_flat state",
      marks: { clk: "none", state: "public_flat", cnt: "none", dbg: "none" },
      probe: "state",
      note: "state with public_flat — VISIBLE (flattened name).",
      autoScan: true,
    },
    hidden: {
      label: "state hidden",
      marks: { clk: "none", state: "none", cnt: "none", dbg: "none" },
      probe: "state",
      note: "Internal state with no mark — HIDDEN.",
      autoScan: true,
    },
    deep: {
      label: "deep cnt public",
      marks: { clk: "none", state: "none", cnt: "public", dbg: "none" },
      probe: "cnt",
      note: "Deep alu.cnt marked public — VISIBLE.",
      autoScan: true,
    },
    port: {
      label: "probe top.clk",
      marks: { clk: "none", state: "none", cnt: "none", dbg: "none" },
      probe: "clk",
      note: "Top port clk — always VISIBLE without a mark.",
      autoScan: true,
    },
    all_public: {
      label: "all internals public",
      marks: { clk: "none", state: "public", cnt: "public", dbg: "public" },
      probe: "dbg",
      note: "All internals public — dbg VISIBLE.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      marks: { clk: "none", state: "none", cnt: "none", dbg: "none" },
      probe: "state",
      note: "Idle — mark nodes / pick probe, then Scan.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Verilator public literacy (document aid — not a real Verilator run)
//
//   logic [1:0] state /*verilator public*/;
//   // or: /*verilator public_flat*/
//
// Why
//   Verilator optimizes / scopes internals for C++ speed.
//   public keeps a signal in the hierarchy for TB peek/poke.
//   Ports at the top are already visible.
//
// C++ sketch (concept):
//   top->u_core->state   // after public on state
//
// Prefer marking only what the TB needs — not every wire.
// Pair with dpi-cpp-tb for the broader C++ TB story.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.marks, p.probe);
    return {
      preset: "starter",
      marks: { ...p.marks },
      probe: p.probe,
      selMark: "public",
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      access: ev.access,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: ${ev.status}`],
    };
  }

  const CLEARED_KEY = "ddv-verilator-public-cleared-v1";
  const STORE_KEY = "ddv-verilator-public-session-v1";

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

  const root = document.getElementById("vpu-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>top.u_core.state</code> with
        <code>/*verilator public*/</code>
        — VISIBLE to the C++ TB.</p>
      <button type="button" class="btn btn-secondary" id="vpu-starter">Load starter example</button>
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
        <div class="idea-card"><h3>public</h3><p>Keep a signal visible to the C++ TB.</p></div>
        <div class="idea-card"><h3>public_flat</h3><p>Flatten name into the parent scope.</p></div>
        <div class="idea-card"><h3>hierarchy</h3><p>Deep internals need an explicit mark.</p></div>
        <div class="idea-card"><h3>ports</h3><p>Top ports are already TB-visible.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vpu-controls">
        <div class="vpu-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>state public</option>
            <option value="flat">public_flat state</option>
            <option value="hidden">state hidden</option>
            <option value="deep">deep cnt public</option>
            <option value="port">probe top.clk</option>
            <option value="all_public">all internals public</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-apply">Apply mark</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan visibility</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo hidden</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vpu-layout">
        <div class="panel-box">
          <h3>Mark chips</h3>
          <div class="chip-row" id="mark-row"></div>
          <h3>Hierarchy</h3>
          <ul class="node-list" id="node-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Probe</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <div class="access-box" id="access-box">// —</div>
          <h3 style="margin-top:0.85rem">Visibility sketch</h3>
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
    const lines = NODES.map((n) => {
      const m = state.marks[n.id] || "none";
      const vis = isVisible(n, m);
      return `${n.path.padEnd(22)} mark=${m.padEnd(12)} ${vis ? "VISIBLE" : "HIDDEN"}`;
    });
    return `# hierarchy visibility
probe: ${nodeOf(state.probe).path}
${lines.join("\n")}
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
    const ev = evaluate(state.marks, state.probe);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.access = ev.access;
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
    pushLog("# starter VISIBLE");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.marks = { ...p.marks };
    state.probe = p.probe;
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.access = "// —";
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

  function applyMark() {
    if (!state.probe || !state.selMark) {
      state.lastAction = "apply-bad";
      pushLog("# apply FAIL");
      renderAll();
      return;
    }
    const node = nodeOf(state.probe);
    if (node.alwaysVisible && state.selMark !== "none") {
      // ports ignore marks for visibility; still record none
      state.marks[state.probe] = "none";
    } else {
      state.marks[state.probe] = state.selMark;
    }
    state.preset = "custom";
    pushTrace(`apply: ${state.probe} → ${state.marks[state.probe]}`);
    pushLog(`# apply ${state.probe} ${state.marks[state.probe]}`);
    runScan(true);
    state.lastAction = "apply";
    renderAll();
  }

  function selectProbe(id) {
    state.probe = id;
    state.lastAction = "select";
    renderAll();
  }

  function selectMark(id) {
    state.selMark = id;
    state.lastAction = "select-mark";
    renderAll();
  }

  function demo() {
    applyPreset("hidden", "demo");
    state.demoed = true;
    pushLog("# demo hidden HIDDEN");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain public");
    pushTrace("explain: /*verilator public*/ keeps hierarchy visible to C++ TB");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const node = nodeOf(state.probe);
    const markMeta = markOf(state.selMark);
    const curMark = state.marks[state.probe] || "none";
    const ev = evaluate(state.marks, state.probe);

    document.getElementById("mark-row").innerHTML = MARKS.map((m) => {
      const on = state.selMark === m.id;
      return `<button type="button" class="chip ${on ? "is-on" : ""}" data-mark="${m.id}">
        <span class="k">mark</span>${m.label}
      </button>`;
    }).join("");
    document.querySelectorAll("[data-mark]").forEach((el) => {
      el.addEventListener("click", () =>
        selectMark(/** @type {string} */ (el.getAttribute("data-mark")))
      );
    });

    document.getElementById("node-list").innerHTML = NODES.map((n) => {
      const m = state.marks[n.id] || "none";
      const vis = isVisible(n, m);
      const sel = state.probe === n.id;
      return `<li class="${sel ? "is-sel" : ""}" data-node="${n.id}">
        <span class="id">${n.path}</span>
        <span class="tag">${m}</span>
        <span class="tag ${vis ? "is-ok" : "is-bad"}">${vis ? "VIS" : "HID"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-node]").forEach((el) => {
      el.addEventListener("click", () =>
        selectProbe(/** @type {string} */ (el.getAttribute("data-node")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a hierarchy node and a mark chip, then Apply mark / Scan.";
    if (state.lastAction === "select-mark" && markMeta) blurb = markMeta.blurb;
    else if (node) blurb = node.blurb;
    document.getElementById("role-blurb").textContent = blurb;
    document.getElementById("access-box").textContent = state.lastScanned
      ? state.access
      : "// Scan for C++ access sketch";

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
      v.textContent = "Idle — Load preset, Apply mark, or Scan visibility";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `VISIBLE — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag is-ok">probe=${state.probe}</span>
      <span class="flag ${curMark !== "none" || node.alwaysVisible ? "is-ok" : "is-bad"}">mark=${curMark}</span>
      <span class="flag is-ok">visible_n=${ev.publicN}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          marks: state.marks,
          probe: state.probe,
          selMark: state.selMark,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-public",
      title: "Quiz: public",
      type: "quiz",
      prompt: "/*verilator public*/ is used to…",
      hint: "TB visibility.",
      choices: [
        "keep a signal visible to the C++ testbench hierarchy",
        "enable --trace-fst automatically",
        "set the timescale",
        "silence UNUSED warnings",
      ],
      answer: "keep a signal visible to the C++ testbench hierarchy",
    },
    {
      id: "quiz-flat",
      title: "Quiz: public_flat",
      type: "quiz",
      prompt: "public_flat roughly means…",
      hint: "Flatten name.",
      choices: [
        "flatten the signal into the parent for a simpler C++ name",
        "delete the hierarchy entirely",
        "force VCD-only dumps",
        "disable lint",
      ],
      answer: "flatten the signal into the parent for a simpler C++ name",
    },
    {
      id: "quiz-port",
      title: "Quiz: ports",
      type: "quiz",
      prompt: "Top-level ports…",
      hint: "Already visible.",
      choices: [
        "are already TB-visible without a public mark",
        "always require /*verilator public*/",
        "cannot be read from C++",
        "are identical to plusargs",
      ],
      answer: "are already TB-visible without a public mark",
    },
    {
      id: "quiz-hidden",
      title: "Quiz: hidden",
      type: "quiz",
      prompt: "An unmarked internal signal may be…",
      hint: "Optimize.",
      choices: [
        "hidden or optimized away from the C++ TB",
        "always present as top->sig",
        "converted to a plusarg",
        "printed only in GTKWave cursors",
      ],
      answer: "hidden or optimized away from the C++ TB",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — VISIBLE.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "VISIBLE",
    },
    {
      id: "load-flat",
      title: "Load public_flat",
      prompt: "Load public_flat state — VISIBLE.",
      hint: "public_flat → Load",
      setup: () => {
        selPreset.value = "flat";
        loadPreset();
      },
      check: () =>
        state.marks.state === "public_flat" &&
        state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-hidden",
      title: "Load hidden",
      prompt: "Load state hidden — HIDDEN.",
      hint: "state hidden → Load",
      setup: () => {
        selPreset.value = "hidden";
        loadPreset();
      },
      check: () =>
        state.status === "HIDDEN" && !state.ready,
    },
    {
      id: "load-deep",
      title: "Load deep",
      prompt: "Load deep cnt public — VISIBLE.",
      hint: "deep cnt → Load",
      setup: () => {
        selPreset.value = "deep";
        loadPreset();
      },
      check: () =>
        state.probe === "cnt" &&
        state.ready &&
        state.marks.cnt === "public",
    },
    {
      id: "load-port",
      title: "Load port",
      prompt: "Load probe top.clk — VISIBLE.",
      hint: "probe top.clk → Load",
      setup: () => {
        selPreset.value = "port";
        loadPreset();
      },
      check: () =>
        state.probe === "clk" && state.ready,
    },
    {
      id: "load-all",
      title: "Load all public",
      prompt: "Load all internals public — dbg VISIBLE.",
      hint: "all internals → Load",
      setup: () => {
        selPreset.value = "all_public";
        loadPreset();
      },
      check: () =>
        state.probe === "dbg" &&
        state.marks.dbg === "public" &&
        state.ready,
    },
    {
      id: "apply",
      title: "Apply mark",
      prompt: "From hidden, Apply public on state — VISIBLE.",
      hint: "hidden → public → Apply",
      setup: () => {
        selPreset.value = "hidden";
        loadPreset();
        state.probe = "state";
        state.selMark = "public";
        applyMark();
      },
      check: () =>
        state.marks.state === "public" &&
        state.ready &&
        state.lastAction === "apply",
    },
    {
      id: "select",
      title: "Select probe",
      prompt: "Click the deep cnt hierarchy row.",
      hint: "Click cnt path",
      setup: () => {
        loadStarter();
        selectProbe("cnt");
      },
      check: () =>
        state.probe === "cnt" && state.lastAction === "select",
    },
    {
      id: "select-mark",
      title: "Select mark",
      prompt: "Click the public_flat mark chip.",
      hint: "Click public_flat",
      setup: () => {
        loadStarter();
        selectMark("public_flat");
      },
      check: () =>
        state.selMark === "public_flat" &&
        state.lastAction === "select-mark",
    },
    {
      id: "scan-ok",
      title: "Scan VISIBLE",
      prompt: "On starter, Scan — VISIBLE.",
      hint: "Scan visibility",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan HIDDEN",
      prompt: "On hidden, Scan — HIDDEN.",
      hint: "hidden → Scan",
      setup: () => {
        selPreset.value = "hidden";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo hidden",
      prompt: "Click Demo hidden.",
      hint: "Demo hidden",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "HIDDEN" &&
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
      prompt: "Literacy sketch mentions public or hierarchy.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /public|hierarchy/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Visibility sketch",
      prompt: "On starter, sketch shows VISIBLE for state.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /u_core\.state.*VISIBLE/.test(
          document.getElementById("plan-box").textContent
        ),
    },
    {
      id: "access",
      title: "C++ access",
      prompt: "Starter access sketch mentions state.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /state/.test(state.access),
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
      prompt: "From hidden, Reset — VISIBLE again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "hidden";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "VISIBLE",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vpu-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vpu-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-apply").addEventListener("click", () => applyMark());
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
        state.probe = saved.probe || state.probe;
        state.selMark = saved.selMark || state.selMark;
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
