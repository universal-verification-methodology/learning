(() => {
  /**
   * One-driver / multi-driver nets:
   *   wire/logic net resolution — Z floats, 0&1 fight → X
   *   RTL: one continuous/procedural driver (or mux / one-hot enables)
   * Modes:
   *   fight  — two continuous assigns both strong
   *   mux    — single driver selected by sel
   *   tri    — tri-state enables (Z when off)
   */

  const DRIVES = ["z", "0", "1"]; // off / drive 0 / drive 1

  function makeStarter() {
    return {
      mode: "fight", // fight | mux | tri
      driveA: "1",
      driveB: "0",
      sel: 0, // mux: 0→A, 1→B
      enA: true,
      enB: true, // both on → fight in tri when both drive
      lastAction: "",
      explained: false,
      resolved: false,
      setMux: false,
      setTri: false,
      setFight: false,
      fixedSafe: false,
      log: [],
      trace: [],
    };
  }

  /** Resolve two contributions (concept wire model) */
  function resolve2(a, b) {
    if (a === "z" && b === "z") return "z";
    if (a === "z") return b;
    if (b === "z") return a;
    if (a === b) return a;
    return "x"; // 0 vs 1
  }

  function effectiveDrives(state) {
    if (state.mode === "mux") {
      // one procedural/continuous driver via mux — other is not on the net
      const v = state.sel === 0 ? state.driveA : state.driveB;
      return { a: v, b: "z", note: "mux picks one source" };
    }
    if (state.mode === "tri") {
      const a = state.enA ? state.driveA : "z";
      const b = state.enB ? state.driveB : "z";
      // if enabled but user set drive to z, treat as Z
      return { a, b, note: "enable gates" };
    }
    // fight: both always contribute (unless set to z = "not driving")
    return { a: state.driveA, b: state.driveB, note: "two assigns" };
  }

  function netValue(state) {
    const { a, b } = effectiveDrives(state);
    return resolve2(a, b);
  }

  function activeCount(state) {
    const { a, b } = effectiveDrives(state);
    let n = 0;
    if (a !== "z") n++;
    if (b !== "z") n++;
    return n;
  }

  function isContested(state) {
    return netValue(state) === "x";
  }

  function isSafe(state) {
    const n = activeCount(state);
    const v = netValue(state);
    return n <= 1 && v !== "x";
  }

  function sourceCode(state) {
    const v = netValue(state);
    if (state.mode === "mux") {
      return `logic net;
logic a = 1'b${state.driveA === "z" ? "0" : state.driveA};
logic b = 1'b${state.driveB === "z" ? "0" : state.driveB};
assign net = sel ? b : a;  // ONE driver
// sel=${state.sel} → net = ${v.toUpperCase()}`;
    }
    if (state.mode === "tri") {
      return `wire net;
assign net = en_a ? 1'b${state.driveA === "z" ? "z" : state.driveA} : 1'bz;
assign net = en_b ? 1'b${state.driveB === "z" ? "z" : state.driveB} : 1'bz;
// en_a=${state.enA} en_b=${state.enB} → net = ${v.toUpperCase()}`;
    }
    return `wire net;
assign net = 1'b${state.driveA};  // driver A
assign net = 1'b${state.driveB};  // driver B
// contested? → net = ${v.toUpperCase()}`;
  }

  const CLEARED_KEY = "ddv-one-driver-cleared-v1";
  const STORE_KEY = "ddv-one-driver-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("od-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> two assigns drive the same wire —
        A=1 and B=0 → resolve <strong>X</strong>. Fix with a mux (one driver)
        or tri-state with only one enable.</p>
      <button type="button" class="btn btn-secondary" id="od-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
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
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>One driver</h3>
            <p>RTL nets: one assign / one always — or a mux.</p>
          </div>
          <div class="idea-card">
            <h3>Multi-driver</h3>
            <p>0 vs 1 on a wire → <code>X</code> (contention).</p>
          </div>
          <div class="idea-card">
            <h3>Tri-state OK</h3>
            <p>Multiple assigns allowed if at most one is not Z.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Drivers on the net</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Style
              <select id="mode-sel">
                <option value="fight" selected>two assigns (fight)</option>
                <option value="mux">mux (one driver)</option>
                <option value="tri">tri-state enables</option>
              </select>
            </label>
            <label id="sel-wrap" hidden>Mux sel
              <select id="sel-sel">
                <option value="0">0 → A</option>
                <option value="1">1 → B</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="net-diagram">
            <div class="driver-card" id="card-a">
              <h3>Driver A</h3>
              <div class="drive-pills" id="pills-a"></div>
              <div class="ctrl-row" id="en-a-wrap" style="margin-top:0.45rem" hidden>
                <label><input type="checkbox" id="en-a"> en_a</label>
              </div>
            </div>
            <div class="net-hub" id="net-hub">
              <span class="lbl">net</span>
              <span id="hub-val">—</span>
            </div>
            <div class="driver-card" id="card-b">
              <h3>Driver B</h3>
              <div class="drive-pills" id="pills-b"></div>
              <div class="ctrl-row" id="en-b-wrap" style="margin-top:0.45rem" hidden>
                <label><input type="checkbox" id="en-b"> en_b</label>
              </div>
            </div>
          </div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-fight">Preset fight 1 vs 0</button>
            <button type="button" id="btn-safe-z">Release B → Z (one driver)</button>
            <button type="button" id="btn-mux">Preset mux (safe)</button>
            <button type="button" id="btn-tri-safe">Preset tri one-enable</button>
            <button type="button" id="btn-tri-fight">Preset tri both-enable fight</button>
            <button type="button" id="btn-resolve">Resolve net now</button>
            <button type="button" id="btn-explain">Explain rules</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Resolution</h2></div>
        <div class="panel-body">
          <div class="resolve-card" id="resolve-card">
            <h3>Resolved value</h3>
            <p class="val" id="val-net">—</p>
            <p class="note" id="note-net"></p>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Situation</th><th>Result</th></tr></thead>
          <tbody>
            <tr><td>One strong driver</td><td>Net = that value</td></tr>
            <tr><td>All Z</td><td>Net = Z (floating)</td></tr>
            <tr><td>0 and 1</td><td>Net = X (contention)</td></tr>
            <tr><td>Mux / if-else</td><td>Still one driver structurally</td></tr>
            <tr><td>Tri-state bus</td><td>OK if enables are one-hot / mutex</td></tr>
            <tr><td>Two always_ff → same var</td><td>Illegal / last-write chaos — don't</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter fight: A=1, B=0 → X. Release B to Z → net=1.</li>
          <li>Prefer mux in RTL over multi-driven wires.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const selWrap = document.getElementById("sel-wrap");
  const selSel = document.getElementById("sel-sel");
  const modeLegend = document.getElementById("mode-legend");
  const pillsA = document.getElementById("pills-a");
  const pillsB = document.getElementById("pills-b");
  const enAWrap = document.getElementById("en-a-wrap");
  const enBWrap = document.getElementById("en-b-wrap");
  const enA = document.getElementById("en-a");
  const enB = document.getElementById("en-b");
  const cardA = document.getElementById("card-a");
  const cardB = document.getElementById("card-b");
  const netHub = document.getElementById("net-hub");
  const hubVal = document.getElementById("hub-val");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const valNet = document.getElementById("val-net");
  const noteNet = document.getElementById("note-net");
  const resolveCard = document.getElementById("resolve-card");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function makePills(container, which) {
    container.innerHTML = "";
    DRIVES.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "drive-pill";
      b.dataset.v = d;
      b.textContent = d === "z" ? "Z" : d;
      b.addEventListener("click", () => {
        if (which === "a") state.driveA = d;
        else state.driveB = d;
        state.lastAction = "drive-" + which;
        pushLog("run", `# driver ${which.toUpperCase()} → ${d.toUpperCase()}`);
        renderAll();
      });
      container.appendChild(b);
    });
  }
  makePills(pillsA, "a");
  makePills(pillsB, "b");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 40) state.log = state.log.slice(-30);
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function syncPills() {
    pillsA.querySelectorAll(".drive-pill").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.v === state.driveA);
    });
    pillsB.querySelectorAll(".drive-pill").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.v === state.driveB);
    });
  }

  function renderDiagram() {
    const { a, b } = effectiveDrives(state);
    const v = netValue(state);
    const n = activeCount(state);

    cardA.className = "driver-card";
    cardB.className = "driver-card";
    if (a === "z") cardA.classList.add("is-off");
    else cardA.classList.add("is-active");
    if (b === "z") cardB.classList.add("is-off");
    else cardB.classList.add("is-active");
    if (v === "x") {
      cardA.classList.add("is-fight");
      cardB.classList.add("is-fight");
    }

    hubVal.textContent = v.toUpperCase();
    netHub.className = "net-hub";
    if (v === "x") netHub.classList.add("is-x");
    else if (v === "z") netHub.classList.add("is-z");
    else netHub.classList.add("is-ok");

    valNet.textContent = v.toUpperCase();
    noteNet.textContent =
      n === 0
        ? "floating — no active drivers"
        : n === 1
          ? "single active driver — safe"
          : v === "x"
            ? "two drivers fight — contention"
            : "two drivers agree";

    resolveCard.style.borderColor =
      v === "x" ? "#b45309" : v === "z" ? "#6366f1" : "";
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (isContested(state)) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Contention: 0 and 1 both drive the net → X. Use mux or mutex enables.";
    } else if (isSafe(state) && activeCount(state) === 1) {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent = "Safe: exactly one active driver.";
    } else if (netValue(state) === "z") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Floating Z — OK on a bus idle; latch/X risk if sampled as a logic input.";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderModeUI() {
    selWrap.hidden = state.mode !== "mux";
    enAWrap.hidden = state.mode !== "tri";
    enBWrap.hidden = state.mode !== "tri";
    if (state.mode === "fight")
      modeLegend.textContent =
        "Two continuous assigns both drive — classic multi-driver bug.";
    else if (state.mode === "mux")
      modeLegend.textContent =
        "Mux collapses sources to one assign — preferred RTL style.";
    else
      modeLegend.textContent =
        "Tri-state: multiple assigns OK only when enables are exclusive.";
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(resolve or explain)</span>';
      return;
    }
    traceBox.innerHTML = state.trace
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no actions yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function syncInputs() {
    modeSel.value = state.mode;
    selSel.value = String(state.sel);
    enA.checked = state.enA;
    enB.checked = state.enB;
  }

  function renderAll() {
    syncInputs();
    syncPills();
    renderModeUI();
    codeBox.textContent = sourceCode(state);
    renderDiagram();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setFight = true;
    pushLog("muted", "# starter fight 1 vs 0 → X");
    state.trace = [];
    renderAll();
  }

  function doResolve() {
    state.resolved = true;
    state.lastAction = "resolve";
    const { a, b } = effectiveDrives(state);
    const v = netValue(state);
    state.trace = [
      { kind: "muted", text: `mode=${state.mode}` },
      { kind: "hi", text: `A contrib=${a.toUpperCase()}  B contrib=${b.toUpperCase()}` },
      {
        kind: v === "x" ? "bad" : v === "z" ? "warn" : "ok",
        text: `resolve → ${v.toUpperCase()}`,
      },
      {
        kind: isSafe(state) ? "ok" : "warn",
        text: isSafe(state)
          ? "≤1 active driver"
          : "multi-driver / float — check design",
      },
    ];
    pushLog(v === "x" ? "warn" : "ok", `# resolve → ${v.toUpperCase()}`);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "one-driver rules" },
      { kind: "ok", text: "Prefer one assign or one always_* writing a net/var" },
      { kind: "hi", text: "Mux / priority if-else = still one driver" },
      { kind: "warn", text: "0 vs 1 → X; Z vs value → value" },
      {
        kind: "run",
        text: `now: ${activeCount(state)} active → net ${netValue(state).toUpperCase()}`,
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("od-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "mux") state.setMux = true;
    if (state.mode === "tri") state.setTri = true;
    if (state.mode === "fight") state.setFight = true;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  selSel.addEventListener("change", () => {
    state.sel = Number(selSel.value) ? 1 : 0;
    state.lastAction = "sel";
    pushLog("run", `# sel → ${state.sel}`);
    renderAll();
  });

  enA.addEventListener("change", () => {
    state.enA = enA.checked;
    state.lastAction = "en-a";
    pushLog("run", `# en_a → ${state.enA}`);
    renderAll();
  });

  enB.addEventListener("change", () => {
    state.enB = enB.checked;
    state.lastAction = "en-b";
    pushLog("run", `# en_b → ${state.enB}`);
    renderAll();
  });

  document.getElementById("btn-fight").addEventListener("click", () => {
    state.mode = "fight";
    state.driveA = "1";
    state.driveB = "0";
    state.setFight = true;
    state.lastAction = "preset-fight";
    pushLog("warn", "# preset fight 1 vs 0");
    renderAll();
  });

  document.getElementById("btn-safe-z").addEventListener("click", () => {
    state.mode = "fight";
    state.driveA = "1";
    state.driveB = "z";
    state.fixedSafe = true;
    state.lastAction = "safe-z";
    pushLog("ok", "# B released to Z");
    renderAll();
  });

  document.getElementById("btn-mux").addEventListener("click", () => {
    state.mode = "mux";
    state.driveA = "1";
    state.driveB = "0";
    state.sel = 0;
    state.setMux = true;
    state.fixedSafe = true;
    state.lastAction = "preset-mux";
    pushLog("ok", "# preset mux");
    renderAll();
  });

  document.getElementById("btn-tri-safe").addEventListener("click", () => {
    state.mode = "tri";
    state.driveA = "1";
    state.driveB = "0";
    state.enA = true;
    state.enB = false;
    state.setTri = true;
    state.fixedSafe = true;
    state.lastAction = "preset-tri-safe";
    pushLog("ok", "# preset tri one-enable");
    renderAll();
  });

  document.getElementById("btn-tri-fight").addEventListener("click", () => {
    state.mode = "tri";
    state.driveA = "1";
    state.driveB = "0";
    state.enA = true;
    state.enB = true;
    state.setTri = true;
    state.lastAction = "preset-tri-fight";
    pushLog("warn", "# preset tri both-enable");
    renderAll();
  });

  document.getElementById("btn-resolve").addEventListener("click", doResolve);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-x",
      title: "Quiz: X",
      prompt: "0 and 1 both driving a wire resolve to? Answer: <code>X</code>",
      hint: "contention",
      type: "text",
      answer: "x",
      alt: ["X", "1'bx"],
    },
    {
      id: "quiz-z",
      title: "Quiz: Z",
      prompt: "No drivers (all Hi-Z) → net is? Answer: <code>Z</code>",
      hint: "floating",
      type: "text",
      answer: "z",
      alt: ["Z", "1'bz", "hi-z", "hiz"],
    },
    {
      id: "quiz-one",
      title: "Quiz: one",
      prompt: "Preferred number of drivers on an RTL net? Answer: <code>1</code>",
      hint: "one-driver",
      type: "text",
      answer: "1",
      alt: ["one", "single"],
    },
    {
      id: "quiz-mux",
      title: "Quiz: mux",
      prompt: "Select-one structure that keeps a single driver? Answer: <code>mux</code>",
      hint: "assign net = sel ? b : a",
      type: "text",
      answer: "mux",
      alt: ["multiplexer", "muxes"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — fight mode, A=1 B=0 → X.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "fight" &&
        state.driveA === "1" &&
        state.driveB === "0" &&
        netValue(state) === "x",
    },
    {
      id: "preset-fight",
      title: "Preset fight",
      prompt: "Preset fight 1 vs 0.",
      hint: "Preset fight button",
      type: "state",
      setup: () => {
        state.driveA = "z";
        state.driveB = "z";
        renderAll();
      },
      check: () =>
        state.setFight &&
        state.driveA === "1" &&
        state.driveB === "0" &&
        state.lastAction === "preset-fight",
    },
    {
      id: "safe-z",
      title: "Release B",
      prompt: "Release B → Z so only A drives (net=1).",
      hint: "Release B → Z button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.driveB === "z" &&
        state.driveA === "1" &&
        netValue(state) === "1" &&
        state.fixedSafe,
    },
    {
      id: "preset-mux",
      title: "Preset mux",
      prompt: "Preset mux (safe) — net is 1 with sel=0.",
      hint: "Preset mux button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setMux &&
        state.mode === "mux" &&
        isSafe(state) &&
        netValue(state) === "1",
    },
    {
      id: "preset-tri-safe",
      title: "Tri safe",
      prompt: "Preset tri one-enable — safe single driver.",
      hint: "Preset tri one-enable",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setTri &&
        state.mode === "tri" &&
        state.enA &&
        !state.enB &&
        isSafe(state),
    },
    {
      id: "preset-tri-fight",
      title: "Tri fight",
      prompt: "Preset tri both-enable fight → X.",
      hint: "Preset tri both-enable fight",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "tri" &&
        state.enA &&
        state.enB &&
        netValue(state) === "x",
    },
    {
      id: "resolve",
      title: "Resolve",
      prompt: "Click Resolve net now.",
      hint: "Resolve net now",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.resolved && state.lastAction === "resolve",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain rules.",
      hint: "Explain rules",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-mux",
      title: "Mode mux",
      prompt: "Switch Style dropdown to mux.",
      hint: "Style select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "mux" && state.lastAction === "mode",
    },
    {
      id: "mux-sel-b",
      title: "Mux sel B",
      prompt: "On mux preset, set sel to 1 → B so net=0.",
      hint: "Preset mux → Mux sel 1→B",
      type: "state",
      setup: () => {
        state.mode = "mux";
        state.driveA = "1";
        state.driveB = "0";
        state.sel = 0;
        state.setMux = true;
        renderAll();
      },
      check: () =>
        state.mode === "mux" &&
        state.sel === 1 &&
        netValue(state) === "0",
    },
    {
      id: "quiz-contend",
      title: "Quiz: contend",
      prompt: "0 vs 1 on one net is called? Answer: <code>contention</code>",
      hint: "warn box",
      type: "text",
      answer: "contention",
      alt: ["conflict", "fight", "multi-driver"],
    },
    {
      id: "quiz-tri",
      title: "Quiz: tri",
      prompt: "Bus style with Z when off? Answer: <code>tri-state</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "tri-state",
      alt: ["tristate", "tri state", "tri"],
    },
    {
      id: "active-1",
      title: "Active count",
      prompt: "After Release B→Z, active driver count is 1.",
      hint: "Release B → Z",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.driveB === "z" && activeCount(state) === 1,
    },
    {
      id: "warn-x",
      title: "Warn X",
      prompt: "On starter fight, contention warning is visible.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        isContested(state) && !warnBox.classList.contains("hidden"),
    },
    {
      id: "code-mux",
      title: "Code mux",
      prompt: "Mux mode source includes <code>assign net = sel</code>.",
      hint: "Preset mux",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "mux" &&
        sourceCode(state).includes("assign net = sel"),
    },
    {
      id: "agree-11",
      title: "Agree 1&1",
      prompt: "Fight mode with A=1 and B=1 → net=1 (agree, still multi-driver).",
      hint: "Set both pills to 1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "fight" &&
        state.driveA === "1" &&
        state.driveB === "1" &&
        netValue(state) === "1" &&
        activeCount(state) === 2,
    },
    {
      id: "float",
      title: "Float",
      prompt: "Both drivers Z in fight mode → net Z.",
      hint: "Set A and B pills to Z",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "fight" &&
        state.driveA === "z" &&
        state.driveB === "z" &&
        netValue(state) === "z",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → Release B→Z → explain.",
      hint: "Load → Release B → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.driveB === "z" &&
        netValue(state) === "1" &&
        state.explained &&
        state.lastAction === "explain",
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function renderChallenge() {
    const c = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (clearedIds.length ? ` · ${clearedIds.length} cleared` : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${c.title}.</strong> ${c.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? "Hint: " + c.hint : "";
    const row = document.getElementById("chal-answer-row");
    row.innerHTML = "";
    if (c.type === "text") {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = "chal-input";
      inp.placeholder = "Your answer";
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
      row.appendChild(inp);
    }
    const st = document.getElementById("chal-status");
    st.textContent = isCleared(c.id) ? "Cleared" : "Idle";
    st.className =
      "challenge-status " + (isCleared(c.id) ? "pass" : "idle");

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kbd" + (i === challengeIdx ? " is-active" : "");
      b.textContent = (isCleared(ch.id) ? "✓ " : "") + ch.id;
      b.title = ch.title;
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    const c = CHALLENGES[challengeIdx];
    if (typeof c.setup === "function") c.setup();
    renderChallenge();
    saveSession();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const c = CHALLENGES[challengeIdx];
    const st = document.getElementById("chal-status");
    let ok = false;
    if (c.type === "text") {
      const got = normalizeAns(answerDraft || "");
      const targets = [c.answer, ...(c.alt || [])].map(normalizeAns);
      ok = targets.includes(got);
    } else if (c.type === "state") {
      ok = !!c.check();
    }
    if (ok) {
      markCleared(c.id);
      st.textContent = "Pass";
      st.className = "challenge-status pass";
      pushLog("ok", `# challenge ${c.id} pass`);
    } else {
      st.textContent = "Fail";
      st.className = "challenge-status fail";
      pushLog("warn", `# challenge ${c.id} fail`);
    }
    renderChallenge();
    renderLog();
    saveSession();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
