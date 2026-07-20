(() => {
  /**
   * Simulator UI tour (concept)
   *   Files / Hierarchy / Signals / Wave / Console map
   * Starter: all five panes visited — ORIENTED
   */

  const PANES = [
    {
      id: "files",
      label: "Files",
      blurb: "Project sources — open, edit, and pick the top / TB files for the run.",
      cue: "top.v · tb.v",
    },
    {
      id: "hierarchy",
      label: "Hierarchy",
      blurb: "Instance tree of the elaborated design — pick a scope to browse signals.",
      cue: "top · u_dut · u_tb",
    },
    {
      id: "signals",
      label: "Signals",
      blurb: "Nets and variables in the selected scope — add them to the wave pane.",
      cue: "clk · rst_n · q",
    },
    {
      id: "wave",
      label: "Wave",
      blurb: "Timeline of sampled values — cursors, zoom, and radix live here.",
      cue: "C1 · C2 · zoom",
    },
    {
      id: "console",
      label: "Console",
      blurb: "Tool messages, $display, errors, and run/stop status from the sim.",
      cue: "$display · errors",
    },
  ];

  function paneOf(id) {
    return PANES.find((p) => p.id === id);
  }

  function evaluate(visited) {
    const n = PANES.filter((p) => visited[p.id]).length;
    const ready = n === PANES.length;
    return {
      status: ready ? "ORIENTED" : "TOURING",
      ready,
      reason: ready
        ? "Files · Hierarchy · Signals · Wave · Console all visited"
        : `${n} / ${PANES.length} panes visited`,
      visitedN: n,
    };
  }

  const PRESETS = {
    starter: {
      label: "starter: all visited",
      visited: {
        files: true,
        hierarchy: true,
        signals: true,
        wave: true,
        console: true,
      },
      sel: "files",
      note: "All five panes visited — ORIENTED.",
      autoScan: true,
    },
    fresh: {
      label: "fresh tour",
      visited: {
        files: false,
        hierarchy: false,
        signals: false,
        wave: false,
        console: false,
      },
      sel: null,
      note: "Nothing visited yet — click panes to tour.",
      autoScan: true,
    },
    mid: {
      label: "files + hierarchy",
      visited: {
        files: true,
        hierarchy: true,
        signals: false,
        wave: false,
        console: false,
      },
      sel: "hierarchy",
      note: "Two panes visited — still TOURING.",
      autoScan: true,
    },
    waves: {
      label: "signals + wave",
      visited: {
        files: true,
        hierarchy: true,
        signals: true,
        wave: true,
        console: false,
      },
      sel: "wave",
      note: "Missing Console — still TOURING.",
      autoScan: true,
    },
    console_only: {
      label: "console only",
      visited: {
        files: false,
        hierarchy: false,
        signals: false,
        wave: false,
        console: true,
      },
      sel: "console",
      note: "Only Console visited — TOURING.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      visited: {
        files: true,
        hierarchy: false,
        signals: false,
        wave: false,
        console: false,
      },
      sel: "files",
      note: "Idle — visit panes, then Scan map.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Browser HDL Simulator UI tour (document aid — not a second IDE)
//
// Typical layout map:
//
//   Files       project sources / top + TB
//   Hierarchy   elaborated instance tree
//   Signals     nets in the selected scope
//   Wave        timeline · cursors · radix
//   Console     $display · errors · run status
//
// ORIENTED = you can name all five panes and their jobs.
// Practice surface: public HDL Simulator (linked from tools index).
// Next labs: hello-dut · step/continue · waves · multi-file.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.visited);
    return {
      preset: "starter",
      visited: { ...p.visited },
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

  const CLEARED_KEY = "ddv-hdl-sim-tour-cleared-v1";
  const STORE_KEY = "ddv-hdl-sim-tour-session-v1";

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

  const root = document.getElementById("hst-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        all five panes visited (Files · Hierarchy · Signals · Wave · Console)
        — map ORIENTED.</p>
      <button type="button" class="btn btn-secondary" id="hst-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Files</h3><p>Sources and top/TB pick.</p></div>
        <div class="idea-card"><h3>Hierarchy</h3><p>Instance tree / scope.</p></div>
        <div class="idea-card"><h3>Signals</h3><p>Nets to add to waves.</p></div>
        <div class="idea-card"><h3>Wave</h3><p>Timeline · cursors · radix.</p></div>
        <div class="idea-card"><h3>Console</h3><p>$display · errors · status.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="hst-controls">
        <div class="hst-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>all visited</option>
            <option value="fresh">fresh tour</option>
            <option value="mid">files + hierarchy</option>
            <option value="waves">signals + wave</option>
            <option value="console_only">console only</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-visit">Visit selected</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan map</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo fresh</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="hst-layout">
        <div class="panel-box">
          <h3>IDE map</h3>
          <div class="ide-mock" id="ide-mock"></div>
          <h3>Panes</h3>
          <ul class="pane-list" id="pane-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Map sketch</h3>
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
    const lines = PANES.map((p) => {
      const v = state.visited[p.id];
      return `${p.label.padEnd(12)} ${v ? "visited" : "—"}  ${p.cue}`;
    });
    return `# simulator UI map
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
    const ev = evaluate(state.visited);
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
    pushLog("# starter ORIENTED");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.visited = { ...p.visited };
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

  function visitSelected() {
    if (!state.sel) {
      state.lastAction = "visit-bad";
      pushLog("# visit FAIL (select a pane)");
      renderAll();
      return;
    }
    state.visited[state.sel] = true;
    state.preset = "custom";
    pushTrace(`visit: ${state.sel}`);
    pushLog(`# visit ${state.sel}`);
    runScan(true);
    state.lastAction = "visit";
    renderAll();
  }

  function selectPane(id, alsoVisit) {
    state.sel = id;
    if (alsoVisit) {
      state.visited[id] = true;
      state.preset = "custom";
      runScan(true);
      state.lastAction = "click";
      pushTrace(`click: ${id}`);
      pushLog(`# click ${id}`);
    } else {
      state.lastAction = "select";
    }
    renderAll();
  }

  function demo() {
    applyPreset("fresh", "demo");
    state.demoed = true;
    pushLog("# demo fresh TOURING");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain UI map");
    pushTrace("explain: Files · Hierarchy · Signals · Wave · Console → ORIENTED");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const pane = paneOf(state.sel);
    const ev = evaluate(state.visited);

    document.getElementById("ide-mock").innerHTML = PANES.map((p) => {
      const on = state.sel === p.id;
      const vis = !!state.visited[p.id];
      return `<button type="button" class="ide-pane ${on ? "is-on" : ""} ${vis ? "is-visited" : ""}" data-pane="${p.id}">
        <span class="k">${vis ? "visited" : "pane"}</span>
        <span class="v">${p.label}</span>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-pane]").forEach((el) => {
      el.addEventListener("click", () =>
        selectPane(/** @type {string} */ (el.getAttribute("data-pane")), true)
      );
    });

    document.getElementById("pane-list").innerHTML = PANES.map((p) => {
      const vis = !!state.visited[p.id];
      return `<li class="${state.sel === p.id ? "is-sel" : ""}" data-list="${p.id}">
        <span class="id">${p.label}</span>
        <span class="tag">${p.id}</span>
        <span class="tag ${vis ? "is-ok" : "is-bad"}">${vis ? "done" : "todo"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-list]").forEach((el) => {
      el.addEventListener("click", () =>
        selectPane(/** @type {string} */ (el.getAttribute("data-list")), false)
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent = pane
      ? pane.blurb
      : "Click an IDE pane (visits it) or a list row (select only), then Visit / Scan.";

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
      v.textContent = "Idle — Load preset, visit panes, or Scan map";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `ORIENTED — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${ev.visitedN === 5 ? "is-ok" : "is-bad"}">visited=${ev.visitedN}/5</span>
      <span class="flag is-ok">sel=${state.sel || "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          visited: state.visited,
          sel: state.sel,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-files",
      title: "Quiz: Files",
      type: "quiz",
      prompt: "The Files pane is for…",
      hint: "Sources.",
      choices: [
        "project sources — open/edit and pick top / TB files",
        "only wave cursors",
        "UVM_TESTNAME selection",
        "GTKWave color themes",
      ],
      answer: "project sources — open/edit and pick top / TB files",
    },
    {
      id: "quiz-hier",
      title: "Quiz: Hierarchy",
      type: "quiz",
      prompt: "Hierarchy shows…",
      hint: "Instance tree.",
      choices: [
        "the elaborated instance tree so you can pick a scope",
        "only Makefile targets",
        "plusarg values",
        "coverage holes",
      ],
      answer: "the elaborated instance tree so you can pick a scope",
    },
    {
      id: "quiz-wave",
      title: "Quiz: Wave",
      type: "quiz",
      prompt: "The Wave pane is where…",
      hint: "Timeline.",
      choices: [
        "timelines, cursors, zoom, and radix live",
        "you only edit Verilog text",
        "lint warnings are silenced",
        "DPI imports are declared",
      ],
      answer: "timelines, cursors, zoom, and radix live",
    },
    {
      id: "quiz-console",
      title: "Quiz: Console",
      type: "quiz",
      prompt: "Console typically shows…",
      hint: "Messages.",
      choices: [
        "$display output, errors, and run/stop status",
        "only the hierarchy tree",
        "FST file bytes",
        "public_flat marks",
      ],
      answer: "$display output, errors, and run/stop status",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — ORIENTED.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "ORIENTED",
    },
    {
      id: "load-fresh",
      title: "Load fresh",
      prompt: "Load fresh tour — TOURING.",
      hint: "fresh tour → Load",
      setup: () => {
        selPreset.value = "fresh";
        loadPreset();
      },
      check: () =>
        state.status === "TOURING" &&
        evaluate(state.visited).visitedN === 0 &&
        state.lastAction === "load",
    },
    {
      id: "load-mid",
      title: "Load mid",
      prompt: "Load files + hierarchy — TOURING.",
      hint: "files + hierarchy → Load",
      setup: () => {
        selPreset.value = "mid";
        loadPreset();
      },
      check: () =>
        state.visited.files &&
        state.visited.hierarchy &&
        !state.ready,
    },
    {
      id: "load-waves",
      title: "Load waves",
      prompt: "Load signals + wave — missing console.",
      hint: "signals + wave → Load",
      setup: () => {
        selPreset.value = "waves";
        loadPreset();
      },
      check: () =>
        state.visited.wave &&
        !state.visited.console &&
        state.status === "TOURING",
    },
    {
      id: "load-console",
      title: "Load console only",
      prompt: "Load console only — TOURING.",
      hint: "console only → Load",
      setup: () => {
        selPreset.value = "console_only";
        loadPreset();
      },
      check: () =>
        state.visited.console &&
        !state.visited.files &&
        !state.ready,
    },
    {
      id: "visit",
      title: "Visit console",
      prompt: "From waves preset, Visit console — ORIENTED.",
      hint: "Select console → Visit",
      setup: () => {
        selPreset.value = "waves";
        loadPreset();
        state.sel = "console";
        visitSelected();
      },
      check: () =>
        state.visited.console &&
        state.ready &&
        state.lastAction === "visit",
    },
    {
      id: "select",
      title: "Select Signals",
      prompt: "Click Signals in the pane list (select only).",
      hint: "Click Signals row",
      setup: () => {
        loadStarter();
        selectPane("signals", false);
      },
      check: () =>
        state.sel === "signals" && state.lastAction === "select",
    },
    {
      id: "click-ide",
      title: "Click IDE pane",
      prompt: "From fresh, click Wave on the IDE map.",
      hint: "Click Wave",
      setup: () => {
        selPreset.value = "fresh";
        loadPreset();
        selectPane("wave", true);
      },
      check: () =>
        state.visited.wave &&
        state.sel === "wave" &&
        state.lastAction === "click",
    },
    {
      id: "scan-ok",
      title: "Scan ORIENTED",
      prompt: "On starter, Scan map — ORIENTED.",
      hint: "Scan map",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan TOURING",
      prompt: "On fresh, Scan — TOURING.",
      hint: "fresh → Scan",
      setup: () => {
        selPreset.value = "fresh";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo fresh",
      prompt: "Click Demo fresh.",
      hint: "Demo fresh",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "TOURING" &&
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
      prompt: "Literacy sketch mentions Hierarchy or Console.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /Hierarchy|Console/.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Map sketch",
      prompt: "On starter, map sketch shows ORIENTED.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /ORIENTED/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "all-five",
      title: "All five",
      prompt: "Starter has visited=5/5.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => evaluate(state.visited).visitedN === 5,
    },
    {
      id: "signals-blurb",
      title: "Signals job",
      prompt: "Select Signals — blurb mentions wave.",
      hint: "Click Signals row",
      setup: () => {
        loadStarter();
        selectPane("signals", false);
      },
      check: () =>
        state.sel === "signals" &&
        /wave/i.test(paneOf("signals").blurb),
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
      prompt: "From fresh, Reset — ORIENTED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "fresh";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "ORIENTED",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="hst-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("hst-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-visit").addEventListener("click", () => visitSelected());
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
        state.visited = saved.visited || state.visited;
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
