(() => {
  /**
   * Feature × scenario matrix (concept)
   *   traceability grid — planned / covered / gap
   * Starter: UART TX/RX × byte/idle — no empty cells
   */

  const FEATURES = ["UART TX", "UART RX"];
  const SCENARIOS = ["byte", "idle", "err"];

  /** @typedef {""|"P"|"C"} Cell */

  const IDEAS = {
    feature: "Rows are features (capabilities) the plan must cover.",
    scenario: "Columns are scenarios (test stories) that exercise features.",
    planned: "P = planned intersection — we intend a test, not yet proven.",
    covered: "C = covered — evidence exists (test ran / bin hit).",
    gap: "Empty cell = gap — no plan and no proof for that pair.",
  };

  const PRESETS = {
    starter: {
      label: "starter: no gaps",
      /** @type {Cell[][]} */
      grid: [
        ["C", "P", "P"],
        ["P", "C", "P"],
      ],
      note: "TX/RX × byte/idle/err all filled (P or C) — Scan gaps = 0.",
      autoScan: true,
    },
    one_gap: {
      label: "one gap (TX×err)",
      grid: [
        ["C", "P", ""],
        ["P", "C", "P"],
      ],
      note: "TX×err empty — one gap to fill.",
      autoScan: true,
    },
    many_gaps: {
      label: "many gaps",
      grid: [
        ["C", "", ""],
        ["", "C", ""],
      ],
      note: "Only diagonal covered — four gaps.",
      autoScan: true,
    },
    all_covered: {
      label: "all covered",
      grid: [
        ["C", "C", "C"],
        ["C", "C", "C"],
      ],
      note: "Every intersection covered — strong (sketch) closure.",
      autoScan: true,
    },
    all_planned: {
      label: "all planned",
      grid: [
        ["P", "P", "P"],
        ["P", "P", "P"],
      ],
      note: "Everything planned, nothing covered yet — gaps=0 but no C.",
      autoScan: true,
    },
    empty: {
      label: "empty grid",
      grid: [
        ["", "", ""],
        ["", "", ""],
      ],
      note: "Empty — click cells to cycle — / P / C, then Scan gaps.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Feature × scenario matrix literacy (document aid)
//
//            scenarioA   scenarioB   scenarioC
// feature1      C            P           —
// feature2      P            C           P
//
// Cell legend:
//   —  gap      (no plan, no proof)
//   P  planned  (test intent)
//   C  covered  (evidence / bin hit)
//
// Scan gaps counts empty cells.
// Pair with verif-plan-check (feature→scenario→coverage chain).`;
  }

  function cloneGrid(g) {
    return g.map((row) => row.slice());
  }

  function countGaps(grid) {
    let n = 0;
    const list = [];
    for (let r = 0; r < FEATURES.length; r++) {
      for (let c = 0; c < SCENARIOS.length; c++) {
        if (!grid[r][c]) {
          n++;
          list.push(`${FEATURES[r]}×${SCENARIOS[c]}`);
        }
      }
    }
    return { n, list };
  }

  function countCovered(grid) {
    let n = 0;
    for (const row of grid) for (const cell of row) if (cell === "C") n++;
    return n;
  }

  function countPlanned(grid) {
    let n = 0;
    for (const row of grid) for (const cell of row) if (cell === "P") n++;
    return n;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const gaps = countGaps(p.grid);
    return {
      preset: "starter",
      grid: cloneGrid(p.grid),
      note: p.note,
      selected: "feature",
      selR: 0,
      selC: 0,
      gaps: gaps.n,
      gapList: gaps.list,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: gaps=0 covered=${countCovered(p.grid)}`],
    };
  }

  const CLEARED_KEY = "ddv-feature-matrix-cleared-v1";
  const STORE_KEY = "ddv-feature-matrix-session-v1";

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

  const root = document.getElementById("fmx-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        UART TX/RX × byte/idle/err — every cell is
        <code>P</code> or <code>C</code> (no gaps).</p>
      <button type="button" class="btn btn-secondary" id="fmx-starter">Load starter example</button>
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
        <div class="idea-card"><h3>feature</h3><p>Row: capability to verify.</p></div>
        <div class="idea-card"><h3>scenario</h3><p>Column: test story.</p></div>
        <div class="idea-card"><h3>P / C</h3><p>Planned intent vs covered evidence.</p></div>
        <div class="idea-card"><h3>gap</h3><p>Empty cell — unplanned intersection.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="fmx-controls">
        <div class="fmx-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>no gaps</option>
            <option value="one_gap">one gap</option>
            <option value="many_gaps">many gaps</option>
            <option value="all_covered">all covered</option>
            <option value="all_planned">all planned</option>
            <option value="empty">empty</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-scan">Scan gaps</button>
        <button type="button" class="btn btn-ghost" id="btn-cycle">Cycle cell</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo gap</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="fmx-layout">
        <div class="panel-box">
          <h3>Matrix</h3>
          <div class="legend">
            <span>— gap</span>
            <span>P planned</span>
            <span>C covered</span>
          </div>
          <div class="matrix-wrap">
            <table class="matrix" id="matrix"></table>
          </div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <div class="idea-row" id="idea-row"></div>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Scan sketch</h3>
          <pre class="scan-box" id="scan-box"></pre>
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

  function cellLabel(v) {
    return v === "C" ? "C" : v === "P" ? "P" : "—";
  }

  function nextCell(v) {
    if (!v) return "P";
    if (v === "P") return "C";
    return "";
  }

  function scanSketch() {
    const g = countGaps(state.grid);
    return `# features × scenarios
# gaps:    ${state.lastScanned ? g.n : "— (Scan gaps)"}
# planned: ${countPlanned(state.grid)}
# covered: ${countCovered(state.grid)}
# selected: ${FEATURES[state.selR]}×${SCENARIOS[state.selC]} = ${cellLabel(state.grid[state.selR][state.selC])}
#
# gap list:
${state.lastScanned ? (g.list.length ? g.list.map((x) => `#   ${x}`).join("\n") : "#   (none)") : "#   —"}`;
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
    pushLog("# starter no gaps");
    renderAll();
  }

  function runScan(silent) {
    const g = countGaps(state.grid);
    state.gaps = g.n;
    state.gapList = g.list;
    state.lastScanned = true;
    pushTrace(`scan: gaps=${g.n} covered=${countCovered(state.grid)}`);
    if (!silent) {
      state.lastAction = g.n === 0 ? "scan-ok" : "scan-gaps";
      pushLog(`# scan gaps=${g.n}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.grid = cloneGrid(p.grid);
    state.note = p.note;
    state.selR = 0;
    state.selC = 0;
    state.gaps = 0;
    state.gapList = [];
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

  function cycleSelected() {
    const r = state.selR;
    const c = state.selC;
    const before = state.grid[r][c];
    state.grid[r][c] = /** @type {Cell} */ (nextCell(before));
    state.lastScanned = false;
    state.lastAction = "cycle";
    pushTrace(
      `cycle: ${FEATURES[r]}×${SCENARIOS[c]} ${cellLabel(before)}→${cellLabel(state.grid[r][c])}`
    );
    pushLog(`# cycle ${FEATURES[r]}×${SCENARIOS[c]}`);
    renderAll();
  }

  function selectCell(r, c) {
    if (state.selR === r && state.selC === c) {
      cycleSelected();
      return;
    }
    state.selR = r;
    state.selC = c;
    state.lastAction = "select-cell";
    renderAll();
  }

  function demo() {
    applyPreset("one_gap", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo one gap");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: matrix = features × scenarios; P=planned, C=covered, empty=gap; " +
        "Scan gaps finds unplanned intersections."
    );
    renderAll();
  }

  function selectIdea(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    let html = "<thead><tr><th></th>";
    for (const s of SCENARIOS) html += `<th>${s}</th>`;
    html += "</tr></thead><tbody>";
    for (let r = 0; r < FEATURES.length; r++) {
      html += `<tr><th class="row-head">${FEATURES[r]}</th>`;
      for (let c = 0; c < SCENARIOS.length; c++) {
        const v = state.grid[r][c];
        const cls =
          v === "C" ? "is-covered" : v === "P" ? "is-planned" : "is-gap";
        const sel = state.selR === r && state.selC === c ? "is-sel" : "";
        html += `<td class="cell ${cls} ${sel}" data-r="${r}" data-c="${c}">${cellLabel(v)}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
    document.getElementById("matrix").innerHTML = html;
    document.querySelectorAll("td.cell").forEach((el) => {
      el.addEventListener("click", () => {
        const r = Number(el.getAttribute("data-r"));
        const c = Number(el.getAttribute("data-c"));
        selectCell(r, c);
      });
    });

    document.getElementById("idea-row").innerHTML = ["feature", "scenario", "planned", "gap"]
      .map(
        (id) => `
      <button type="button" class="idea-btn ${state.selected === id ? "is-sel" : ""}" data-idea="${id}">
        <div class="k">${id}</div>
        <div class="v">${id === "planned" ? "P" : id === "gap" ? "—" : id}</div>
      </button>`
      )
      .join("");
    document.querySelectorAll("[data-idea]").forEach((el) => {
      el.addEventListener("click", () =>
        selectIdea(/** @type {string} */ (el.getAttribute("data-idea")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      IDEAS[state.selected] || IDEAS.feature;
    document.getElementById("scan-box").textContent = scanSketch();
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
      v.textContent = "Idle — Load preset or Scan gaps";
    } else if (state.gaps === 0) {
      v.className = "verdict yes";
      v.textContent = "No gaps — every feature×scenario has P or C";
    } else {
      v.className = "verdict no";
      v.textContent = `${state.gaps} gap${state.gaps === 1 ? "" : "s"} — fill empty cells`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.gaps === 0 && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">gaps=${state.lastScanned ? state.gaps : "—"}</span>
      <span class="flag is-ok">P=${countPlanned(state.grid)}</span>
      <span class="flag is-ok">C=${countCovered(state.grid)}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ preset: state.preset, grid: state.grid })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-matrix",
      title: "Quiz: matrix",
      type: "quiz",
      prompt: "A feature × scenario matrix is…",
      hint: "Grid.",
      choices: [
        "a traceability grid of capabilities vs test stories",
        "a synthesis netlist",
        "only a Makefile PHONY list",
        "a VCD dump format",
      ],
      answer: "a traceability grid of capabilities vs test stories",
    },
    {
      id: "quiz-p",
      title: "Quiz: P",
      type: "quiz",
      prompt: "A P cell means…",
      hint: "Intent.",
      choices: [
        "the intersection is planned (test intent, not yet proven)",
        "the DUT is synthesized",
        "coverage is 100%",
        "the cell is a gap",
      ],
      answer: "the intersection is planned (test intent, not yet proven)",
    },
    {
      id: "quiz-c",
      title: "Quiz: C",
      type: "quiz",
      prompt: "A C cell means…",
      hint: "Evidence.",
      choices: [
        "covered — evidence exists that the pair was exercised",
        "compile error",
        "plusarg missing",
        "always a gap",
      ],
      answer: "covered — evidence exists that the pair was exercised",
    },
    {
      id: "quiz-gap",
      title: "Quiz: gap",
      type: "quiz",
      prompt: "An empty matrix cell is…",
      hint: "Hole.",
      choices: [
        "a gap — no plan and no proof for that feature×scenario",
        "automatically covered",
        "a cocotb trigger",
        "a sign-off stamp",
      ],
      answer: "a gap — no plan and no proof for that feature×scenario",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — gaps=0.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.gaps === 0 &&
        state.lastScanned,
    },
    {
      id: "load-one",
      title: "Load one gap",
      prompt: "Load one gap — gaps=1.",
      hint: "one gap → Load",
      setup: () => {
        selPreset.value = "one_gap";
        loadPreset();
      },
      check: () =>
        state.gaps === 1 && state.lastAction === "load",
    },
    {
      id: "load-many",
      title: "Load many gaps",
      prompt: "Load many gaps — gaps=4.",
      hint: "many gaps → Load",
      setup: () => {
        selPreset.value = "many_gaps";
        loadPreset();
      },
      check: () => state.gaps === 4,
    },
    {
      id: "load-covered",
      title: "Load all covered",
      prompt: "Load all covered — C=6.",
      hint: "all covered → Load",
      setup: () => {
        selPreset.value = "all_covered";
        loadPreset();
      },
      check: () =>
        countCovered(state.grid) === 6 && state.gaps === 0,
    },
    {
      id: "load-planned",
      title: "Load all planned",
      prompt: "Load all planned — P=6, C=0.",
      hint: "all planned → Load",
      setup: () => {
        selPreset.value = "all_planned";
        loadPreset();
      },
      check: () =>
        countPlanned(state.grid) === 6 &&
        countCovered(state.grid) === 0,
    },
    {
      id: "scan-ok",
      title: "Scan OK",
      prompt: "From empty, fill all cells then Scan — gaps=0.",
      hint: "empty → cycle all → Scan",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.grid = [
          ["P", "P", "P"],
          ["P", "P", "P"],
        ];
        runScan(false);
      },
      check: () =>
        state.gaps === 0 && state.lastAction === "scan-ok",
    },
    {
      id: "scan-gaps",
      title: "Scan gaps",
      prompt: "From empty, Scan — gaps=6.",
      hint: "empty → Scan gaps",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        runScan(false);
      },
      check: () =>
        state.gaps === 6 && state.lastAction === "scan-gaps",
    },
    {
      id: "cycle",
      title: "Cycle cell",
      prompt: "On starter, Cycle the selected cell.",
      hint: "Cycle cell",
      setup: () => {
        loadStarter();
        cycleSelected();
      },
      check: () => state.lastAction === "cycle",
    },
    {
      id: "select-cell",
      title: "Select cell",
      prompt: "Click RX×idle cell (select, not cycle).",
      hint: "Click RX idle once from TX byte",
      setup: () => {
        loadStarter();
        state.selR = 0;
        state.selC = 0;
        renderAll();
        selectCell(1, 1);
      },
      check: () =>
        state.selR === 1 &&
        state.selC === 1 &&
        state.lastAction === "select-cell",
    },
    {
      id: "demo",
      title: "Demo gap",
      prompt: "Click Demo gap.",
      hint: "Demo gap",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.gaps === 1 &&
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
      id: "select-idea",
      title: "Select idea",
      prompt: "Click the gap idea card.",
      hint: "Click gap",
      setup: () => {
        loadStarter();
        selectIdea("gap");
      },
      check: () =>
        state.selected === "gap" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions planned or gap.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /planned|gap/i.test(sourceSketch()),
    },
    {
      id: "scan-sketch",
      title: "Scan sketch",
      prompt: "On starter, scan sketch shows gaps: 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /gaps:\s+0/.test(document.getElementById("scan-box").textContent),
    },
    {
      id: "gap-list",
      title: "Gap list",
      prompt: "On one_gap, gap list includes TX×err.",
      hint: "one gap → Load",
      setup: () => {
        selPreset.value = "one_gap";
        loadPreset();
      },
      check: () => state.gapList.some((x) => /TX.*err|err/i.test(x)),
    },
    {
      id: "tx-byte-c",
      title: "TX×byte covered",
      prompt: "Starter TX×byte is C.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.grid[0][0] === "C",
    },
    {
      id: "empty-idle",
      title: "Load empty",
      prompt: "Load empty — not yet scanned.",
      hint: "empty → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        !state.lastScanned && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From empty, Reset — gaps=0 again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" && state.gaps === 0,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="fmx-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("fmx-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-scan").addEventListener("click", () => runScan(false));
  document.getElementById("btn-cycle").addEventListener("click", () => cycleSelected());
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
      if (saved && Array.isArray(saved.grid)) {
        state.grid = cloneGrid(saved.grid);
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
