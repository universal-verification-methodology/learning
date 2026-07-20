(() => {
  /**
   * Risk-based plan matrix (concept)
   *   risk × impact → priority (P0/P1/P2/defer)
   * Starter: four items correctly prioritized — ALIGNED
   */

  const ITEMS = [
    {
      id: "uart_parity",
      label: "uart_parity",
      risk: "H",
      impact: "H",
      blurb: "High likelihood of parity bugs; high silicon impact — P0.",
    },
    {
      id: "fifo_overflow",
      label: "fifo_overflow",
      risk: "M",
      impact: "H",
      blurb: "Medium chance of overflow; high impact if it escapes — P0.",
    },
    {
      id: "baud_edge",
      label: "baud_edge",
      risk: "L",
      impact: "M",
      blurb: "Rare edge timing; moderate impact — P2.",
    },
    {
      id: "spi_idle",
      label: "spi_idle",
      risk: "L",
      impact: "L",
      blurb: "Idle-line cosmetic noise — defer behind core risks.",
    },
  ];

  const PRIOS = [
    {
      id: "P0",
      label: "P0",
      blurb: "Must-test this milestone — high risk×impact.",
    },
    {
      id: "P1",
      label: "P1",
      blurb: "Strong next-wave coverage after P0.",
    },
    {
      id: "P2",
      label: "P2",
      blurb: "Nice-to-have / later milestone depth.",
    },
    {
      id: "defer",
      label: "defer",
      blurb: "Low risk and impact — park unless bandwidth allows.",
    },
  ];

  /** risk row × impact col → suggested priority */
  const MATRIX = {
    L: { L: "defer", M: "P2", H: "P1" },
    M: { L: "P2", M: "P1", H: "P0" },
    H: { L: "P1", M: "P0", H: "P0" },
  };

  function suggest(item) {
    return MATRIX[item.risk][item.impact];
  }

  const PRESETS = {
    starter: {
      label: "starter: aligned",
      prios: {
        uart_parity: "P0",
        fifo_overflow: "P0",
        baud_edge: "P2",
        spi_idle: "defer",
      },
      selItem: "uart_parity",
      selPrio: "P0",
      note: "Four items match risk×impact suggestions — ALIGNED.",
      autoScan: true,
    },
    missing: {
      label: "one open",
      prios: {
        uart_parity: "P0",
        fifo_overflow: "P0",
        baud_edge: "P2",
        spi_idle: "open",
      },
      selItem: "spi_idle",
      selPrio: "defer",
      note: "spi_idle still open — prioritize it.",
      autoScan: true,
    },
    mismatch: {
      label: "priority mismatch",
      prios: {
        uart_parity: "defer",
        fifo_overflow: "P0",
        baud_edge: "P2",
        spi_idle: "defer",
      },
      selItem: "uart_parity",
      selPrio: "P0",
      note: "uart_parity is H×H but marked defer — MISMATCH.",
      autoScan: true,
    },
    all_open: {
      label: "all open",
      prios: {
        uart_parity: "open",
        fifo_overflow: "open",
        baud_edge: "open",
        spi_idle: "open",
      },
      selItem: "uart_parity",
      selPrio: "P0",
      note: "Empty priority column — nothing ranked yet.",
      autoScan: true,
    },
    all_p0: {
      label: "everything P0",
      prios: {
        uart_parity: "P0",
        fifo_overflow: "P0",
        baud_edge: "P0",
        spi_idle: "P0",
      },
      selItem: "spi_idle",
      selPrio: "defer",
      note: "Everything P0 — MISMATCH (no triage).",
      autoScan: true,
    },
    idle: {
      label: "idle",
      prios: {
        uart_parity: "open",
        fifo_overflow: "open",
        baud_edge: "open",
        spi_idle: "open",
      },
      selItem: null,
      selPrio: null,
      note: "Idle — select an item and priority, then Prioritize.",
      autoScan: false,
    },
  };

  function sourceSketch() {
    return `// Risk-based plan matrix literacy (document aid)
//
// 1. List features / failure modes
// 2. Score risk (likelihood) L/M/H
// 3. Score impact (severity if escapes) L/M/H
// 4. Map to priority via the matrix; assign P0/P1/P2/defer
//
//        impact→  L      M      H
//  risk L         defer  P2     P1
//       M         P2     P1     P0
//       H         P1     P0     P0
//
// OPEN      = unprioritized rows
// MISMATCH  = assigned ≠ matrix suggestion
// ALIGNED   = every row matches suggestion
// Pair with test-taxonomy and feature-matrix.`;
  }

  function openCount(prios) {
    return ITEMS.filter((i) => (prios[i.id] || "open") === "open").length;
  }

  function mismatchCount(prios) {
    return ITEMS.filter((i) => {
      const p = prios[i.id];
      return p && p !== "open" && p !== suggest(i);
    }).length;
  }

  function countPrio(prios, id) {
    return ITEMS.filter((i) => prios[i.id] === id).length;
  }

  function evaluate(prios) {
    const open = openCount(prios);
    if (open > 0) {
      return {
        status: "OPEN",
        ready: false,
        reason: `${open} item(s) still unprioritized`,
      };
    }
    const bad = mismatchCount(prios);
    if (bad > 0) {
      return {
        status: "MISMATCH",
        ready: false,
        reason: `${bad} item(s) disagree with risk×impact`,
      };
    }
    return {
      status: "ALIGNED",
      ready: true,
      reason: "priorities match risk×impact matrix",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.prios);
    return {
      preset: "starter",
      prios: { ...p.prios },
      selItem: p.selItem,
      selPrio: p.selPrio,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["scan: ALIGNED open=0"],
    };
  }

  const CLEARED_KEY = "ddv-risk-plan-cleared-v1";
  const STORE_KEY = "ddv-risk-plan-session-v1";

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

  const root = document.getElementById("rsk-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>uart_parity</code> H×H→P0,
        <code>fifo_overflow</code> M×H→P0,
        <code>baud_edge</code> L×M→P2,
        <code>spi_idle</code> L×L→defer —
        plan ALIGNED.</p>
      <button type="button" class="btn btn-secondary" id="rsk-starter">Load starter example</button>
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
        <div class="idea-card"><h3>risk</h3><p>Likelihood the failure mode shows up.</p></div>
        <div class="idea-card"><h3>impact</h3><p>Severity if it escapes to silicon / field.</p></div>
        <div class="idea-card"><h3>priority</h3><p>P0 / P1 / P2 / defer from the matrix.</p></div>
        <div class="idea-card"><h3>ALIGNED</h3><p>Every row matches risk×impact suggestion.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="rsk-controls">
        <div class="rsk-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>aligned</option>
            <option value="missing">one open</option>
            <option value="mismatch">priority mismatch</option>
            <option value="all_open">all open</option>
            <option value="all_p0">everything P0</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-prio">Prioritize</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan matrix</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="rsk-layout">
        <div class="panel-box">
          <h3>Risk × impact → priority</h3>
          <table class="matrix-table" id="matrix-table" aria-label="Risk impact matrix"></table>
          <h3>Priority buckets</h3>
          <div class="prio-row" id="prio-row"></div>
          <h3>Items</h3>
          <ul class="item-list" id="item-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Plan sketch</h3>
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
    const lines = ITEMS.map((i) => {
      const p = state.prios[i.id] || "open";
      const sug = suggest(i);
      const mark = p === "open" ? "?" : p === sug ? "ok" : "≠";
      return `${i.label.padEnd(14)} ${i.risk}×${i.impact} → ${String(p).padEnd(5)} (sug ${sug}) ${mark}`;
    });
    return `# risk plan
${lines.join("\n")}
# open:   ${openCount(state.prios)}
# bad:    ${mismatchCount(state.prios)}
# status: ${state.lastScanned ? state.status : "— (Scan matrix)"}
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
    pushLog("# starter ALIGNED");
    renderAll();
  }

  function runScan(silent) {
    const ev = evaluate(state.prios);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(
      `scan: ${ev.status} open=${openCount(state.prios)} bad=${mismatchCount(state.prios)}`
    );
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
    state.prios = { ...p.prios };
    state.selItem = p.selItem;
    state.selPrio = p.selPrio;
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

  function prioritize() {
    if (!state.selItem || !state.selPrio) {
      state.lastAction = "prio-bad";
      pushLog("# prioritize FAIL (need item + priority)");
      renderAll();
      return;
    }
    state.prios[state.selItem] = state.selPrio;
    pushTrace(`prio: ${state.selItem} → ${state.selPrio}`);
    pushLog(`# prioritize ${state.selItem} → ${state.selPrio}`);
    runScan(true);
    state.lastAction = "prio";
    renderAll();
  }

  function demo() {
    applyPreset("mismatch", "demo");
    state.demoed = true;
    pushLog("# demo mismatch");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain matrix");
    pushTrace("explain: risk×impact → P0/P1/P2/defer → ALIGNED");
    renderAll();
  }

  function selectItem(id) {
    state.selItem = id;
    state.lastAction = "select-item";
    renderAll();
  }

  function selectPrio(id) {
    state.selPrio = id;
    state.lastAction = "select-prio";
    renderAll();
  }

  function prioClass(p) {
    if (p === "open") return "is-open";
    if (p === "P0") return "is-p0";
    if (p === "P1") return "is-p1";
    if (p === "P2") return "is-p2";
    return "is-defer";
  }

  function renderLab() {
    syncInputs();
    const item = ITEMS.find((i) => i.id === state.selItem);
    const prio = PRIOS.find((p) => p.id === state.selPrio);

    const risks = ["L", "M", "H"];
    const impacts = ["L", "M", "H"];
    const hitRisk = item ? item.risk : null;
    const hitImpact = item ? item.impact : null;
    document.getElementById("matrix-table").innerHTML = `
      <thead><tr><th>risk \\ impact</th>${impacts.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>
        ${risks
          .map(
            (r) => `<tr><th>${r}</th>${impacts
              .map((c) => {
                const hit = hitRisk === r && hitImpact === c;
                return `<td class="${hit ? "is-hit" : ""}">${MATRIX[r][c]}</td>`;
              })
              .join("")}</tr>`
          )
          .join("")}
      </tbody>`;

    document.getElementById("prio-row").innerHTML = PRIOS.map((p) => {
      const n = countPrio(state.prios, p.id);
      const on = state.selPrio === p.id;
      return `<button type="button" class="prio-card ${on ? "is-sel" : ""}" data-prio="${p.id}">
        <div class="k">${p.label} · ${n}</div>
        <div class="v">${p.id}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-prio]").forEach((el) => {
      el.addEventListener("click", () =>
        selectPrio(/** @type {string} */ (el.getAttribute("data-prio")))
      );
    });

    document.getElementById("item-list").innerHTML = ITEMS.map((i) => {
      const p = state.prios[i.id] || "open";
      const sug = suggest(i);
      const sel = state.selItem === i.id;
      const match =
        p === "open" ? "" : p === sug ? "is-ok" : "is-bad";
      const matchLabel = p === "open" ? "—" : p === sug ? "OK" : "≠";
      return `<li class="${sel ? "is-sel" : ""}" data-item="${i.id}">
        <span class="id">${i.label}</span>
        <span class="tag">${i.risk}×${i.impact}</span>
        <span class="tag ${prioClass(p)}">${p}</span>
        <span class="tag ${match}">${matchLabel}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-item]").forEach((el) => {
      el.addEventListener("click", () =>
        selectItem(/** @type {string} */ (el.getAttribute("data-item")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select an item, pick a priority, then Prioritize.";
    if (item && state.lastAction === "select-item") blurb = item.blurb;
    else if (prio && state.lastAction === "select-prio") blurb = prio.blurb;
    else if (item && prio)
      blurb = `${item.label} ${item.risk}×${item.impact} → sug ${suggest(item)}; pick ${prio.label}.`;
    else if (item) blurb = item.blurb;
    else if (prio) blurb = prio.blurb;
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
      v.textContent = "Idle — Load preset, Prioritize, or Scan matrix";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Plan ALIGNED — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const openN = openCount(state.prios);
    const badN = mismatchCount(state.prios);
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${openN ? "is-bad" : "is-ok"}">open=${openN}</span>
      <span class="flag ${badN ? "is-bad" : "is-ok"}">bad=${badN}</span>
      <span class="flag is-ok">P0=${countPrio(state.prios, "P0")}</span>
      <span class="flag is-ok">P1=${countPrio(state.prios, "P1")}</span>
      <span class="flag is-ok">P2=${countPrio(state.prios, "P2")}</span>
      <span class="flag is-ok">defer=${countPrio(state.prios, "defer")}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          prios: state.prios,
          selItem: state.selItem,
          selPrio: state.selPrio,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-risk",
      title: "Quiz: risk",
      type: "quiz",
      prompt: "In this matrix, risk means…",
      hint: "Likelihood.",
      choices: [
        "likelihood that the failure mode shows up in verification / field",
        "only synthesis area",
        "a Makefile PHONY target",
        "always the same as impact",
      ],
      answer:
        "likelihood that the failure mode shows up in verification / field",
    },
    {
      id: "quiz-impact",
      title: "Quiz: impact",
      type: "quiz",
      prompt: "Impact scores…",
      hint: "Severity.",
      choices: [
        "severity if the bug escapes to silicon or customers",
        "simulation wall-clock only",
        "number of plusargs",
        "VCD file size",
      ],
      answer: "severity if the bug escapes to silicon or customers",
    },
    {
      id: "quiz-p0",
      title: "Quiz: P0",
      type: "quiz",
      prompt: "H×H (high risk, high impact) maps to…",
      hint: "Must-test.",
      choices: [
        "P0 — must-test this milestone",
        "defer always",
        "P2 only",
        "ignore until sign-off",
      ],
      answer: "P0 — must-test this milestone",
    },
    {
      id: "quiz-aligned",
      title: "Quiz: ALIGNED",
      type: "quiz",
      prompt: "Plan ALIGNED means…",
      hint: "Match.",
      choices: [
        "every item’s priority matches the risk×impact suggestion",
        "all tests are directed",
        "CI is green only",
        "coverage is 100%",
      ],
      answer:
        "every item’s priority matches the risk×impact suggestion",
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
      id: "load-missing",
      title: "Load one open",
      prompt: "Load one open — OPEN.",
      hint: "one open → Load",
      setup: () => {
        selPreset.value = "missing";
        loadPreset();
      },
      check: () =>
        state.status === "OPEN" &&
        !state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load priority mismatch — MISMATCH.",
      hint: "priority mismatch → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.status === "MISMATCH" && !state.ready,
    },
    {
      id: "load-all-open",
      title: "Load all open",
      prompt: "Load all open — open=4.",
      hint: "all open → Load",
      setup: () => {
        selPreset.value = "all_open";
        loadPreset();
      },
      check: () =>
        openCount(state.prios) === 4 && state.status === "OPEN",
    },
    {
      id: "load-all-p0",
      title: "Load all P0",
      prompt: "Load everything P0 — MISMATCH.",
      hint: "everything P0 → Load",
      setup: () => {
        selPreset.value = "all_p0";
        loadPreset();
      },
      check: () =>
        state.status === "MISMATCH" &&
        countPrio(state.prios, "P0") === 4,
    },
    {
      id: "prio",
      title: "Prioritize",
      prompt: "From one open, Prioritize spi_idle → defer — ALIGNED.",
      hint: "one open → Prioritize",
      setup: () => {
        selPreset.value = "missing";
        loadPreset();
        state.selItem = "spi_idle";
        state.selPrio = "defer";
        prioritize();
      },
      check: () =>
        state.prios.spi_idle === "defer" &&
        state.ready &&
        state.lastAction === "prio",
    },
    {
      id: "select-item",
      title: "Select item",
      prompt: "Click fifo_overflow row.",
      hint: "Click fifo_overflow",
      setup: () => {
        loadStarter();
        selectItem("fifo_overflow");
      },
      check: () =>
        state.selItem === "fifo_overflow" &&
        state.lastAction === "select-item",
    },
    {
      id: "select-prio",
      title: "Select priority",
      prompt: "Click the P2 priority card.",
      hint: "Click P2",
      setup: () => {
        loadStarter();
        selectPrio("P2");
      },
      check: () =>
        state.selPrio === "P2" &&
        state.lastAction === "select-prio",
    },
    {
      id: "scan-ok",
      title: "Scan ALIGNED",
      prompt: "On starter, Scan matrix — ALIGNED.",
      hint: "Scan matrix",
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
      prompt: "On all open, Scan — OPEN.",
      hint: "all open → Scan",
      setup: () => {
        selPreset.value = "all_open";
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
      prompt: "Literacy sketch mentions ALIGNED or P0.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /ALIGNED|P0/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Plan sketch",
      prompt: "On starter, plan sketch shows ALIGNED.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /ALIGNED/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "open-zero",
      title: "Open zero",
      prompt: "Starter open count is 0.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => openCount(state.prios) === 0,
    },
    {
      id: "suggest-hh",
      title: "Suggest H×H",
      prompt: "uart_parity suggestion is P0.",
      hint: "Starter / matrix",
      setup: () => loadStarter(),
      check: () =>
        suggest(ITEMS.find((i) => i.id === "uart_parity")) === "P0",
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
      prompt: "From all open, Reset — ALIGNED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "all_open";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="rsk-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("rsk-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-prio").addEventListener("click", () => prioritize());
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
        state.prios = saved.prios || state.prios;
        state.selItem = saved.selItem || null;
        state.selPrio = saved.selPrio || null;
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
