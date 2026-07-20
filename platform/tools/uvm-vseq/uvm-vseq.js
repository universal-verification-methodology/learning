(() => {
  /**
   * Virtual sequence (concept)
   *   vsequencer holds refs · vseq coordinates · seq vs parallel
   * Starter: UART then SPI sequential, both refs wired
   */

  /** @typedef {"sequential"|"parallel"} Mode */

  const PRESETS = {
    starter: {
      label: "starter: UART then SPI",
      uartRef: true,
      spiRef: true,
      mode: /** @type {Mode} */ ("sequential"),
      note: "Both sequencer refs wired; sequential start already ran UART → SPI.",
      autoStart: true,
    },
    parallel: {
      label: "parallel fork-join",
      uartRef: true,
      spiRef: true,
      mode: /** @type {Mode} */ ("parallel"),
      note: "Same refs — Start runs both sub-sequences concurrently.",
      autoStart: true,
    },
    missing_spi: {
      label: "SPI ref missing",
      uartRef: true,
      spiRef: false,
      mode: /** @type {Mode} */ ("sequential"),
      note: "uart_sqr wired; spi_sqr null — Start will fail on SPI.",
      autoStart: false,
    },
    unwired: {
      label: "refs not connected",
      uartRef: false,
      spiRef: false,
      mode: /** @type {Mode} */ ("sequential"),
      note: "Virtual sequencer exists but refs are null — Wire first.",
      autoStart: false,
    },
  };

  function sourceSketch() {
    return `// Virtual sequence literacy (not a full UVM library)
// virtual sequencer  = holds handles to agent sequencers (does not create them)
// virtual sequence   = coordinates sub-sequences across those handles
//
// connect_phase: vsqr.uart_sqr = env.uart.sequencer;
//                vsqr.spi_sqr  = env.spi.sequencer;
//
// body():
//   sequential: uart_seq.start(uart_sqr); spi_seq.start(spi_sqr);
//   parallel:   fork … join  both start() calls
//
// Start vseq on the virtual sequencer (or null with assigned refs).`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      uartRef: p.uartRef,
      spiRef: p.spiRef,
      mode: p.mode,
      note: p.note,
      selected: "vseq",
      uartDone: true,
      spiDone: true,
      lastOk: true,
      lastDetail: "sequential: UART → SPI",
      lastAction: "starter",
      explained: false,
      demoed: false,
      starts: 1,
      log: [],
      trace: [
        "wire uart_sqr",
        "wire spi_sqr",
        "start uart_seq @ uart_sqr",
        "start spi_seq @ spi_sqr",
        "done sequential",
      ],
    };
  }

  const CLEARED_KEY = "ddv-uvm-vseq-cleared-v1";
  const STORE_KEY = "ddv-uvm-vseq-session-v1";

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

  const root = document.getElementById("uvs-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> virtual sequencer holds
        <code>uart_sqr</code> and <code>spi_sqr</code>; virtual sequence started
        them <strong>sequentially</strong> (UART then SPI).</p>
      <button type="button" class="btn btn-secondary" id="uvs-starter">Load starter example</button>
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
        <div class="idea-card"><h3>vsequencer</h3><p>Holds refs to agent sequencers — does not create them.</p></div>
        <div class="idea-card"><h3>vsequence</h3><p>Starts sub-sequences on those refs.</p></div>
        <div class="idea-card"><h3>sequential</h3><p>Ordered start() — wait for one, then next.</p></div>
        <div class="idea-card"><h3>parallel</h3><p>fork-join starts both agents together.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="uvs-controls">
        <div class="uvs-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>UART then SPI</option>
            <option value="parallel">parallel fork-join</option>
            <option value="missing_spi">SPI ref missing</option>
            <option value="unwired">refs not connected</option>
          </select>
        </div>
        <div class="uvs-field">
          <label for="sel-mode">Start mode</label>
          <select id="sel-mode">
            <option value="sequential">sequential</option>
            <option value="parallel">parallel</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-wire">Wire refs</button>
        <button type="button" class="btn btn-ghost" id="btn-unwire">Unwire</button>
        <button type="button" class="btn btn-secondary" id="btn-start">Start vseq</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo parallel</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="uvs-layout">
        <div class="panel-box">
          <h3>Coordination</h3>
          <div class="arch-row" id="arch-row"></div>
          <div class="agent-grid" id="agent-grid"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Body sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:16rem"></pre>
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
  const selMode = /** @type {HTMLSelectElement} */ (document.getElementById("sel-mode"));

  function bothWired() {
    return state.uartRef && state.spiRef;
  }

  function codeSketch() {
    return `// virtual_sequencer vsqr;
//   uart_sqr = ${state.uartRef ? "env.uart.sequencer" : "null"}
//   spi_sqr  = ${state.spiRef ? "env.spi.sequencer" : "null"}
// mode = ${state.mode}
//
// virtual_seq body():
${
  state.mode === "parallel"
    ? `//   fork
//     uart_seq.start(uart_sqr);
//     spi_seq.start(spi_sqr);
//   join`
    : `//   uart_seq.start(uart_sqr);
//   spi_seq.start(spi_sqr);`
}
//
// last: ${state.lastOk == null ? "—" : state.lastOk ? "OK" : "FAIL"} ${state.lastDetail}`;
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
    selMode.value = state.mode;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter UART→SPI sequential");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.uartRef = p.uartRef;
    state.spiRef = p.spiRef;
    state.mode = p.mode;
    state.note = p.note;
    state.uartDone = false;
    state.spiDone = false;
    state.lastOk = null;
    state.lastDetail = "";
    syncInputs();
    if (p.autoStart) {
      startVseq(true);
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

  function wireRefs() {
    state.uartRef = true;
    state.spiRef = true;
    state.lastAction = "wire";
    pushLog("# wire uart_sqr + spi_sqr");
    pushTrace("wire uart_sqr");
    pushTrace("wire spi_sqr");
    renderAll();
  }

  function unwire() {
    state.uartRef = false;
    state.spiRef = false;
    state.uartDone = false;
    state.spiDone = false;
    state.lastOk = null;
    state.lastAction = "unwire";
    pushLog("# unwire refs");
    renderAll();
  }

  function startVseq(silent) {
    state.mode = /** @type {Mode} */ (selMode.value || state.mode);
    state.uartDone = false;
    state.spiDone = false;
    if (!state.uartRef || !state.spiRef) {
      const missing = !state.uartRef && !state.spiRef ? "uart_sqr+spi_sqr" : !state.uartRef ? "uart_sqr" : "spi_sqr";
      state.lastOk = false;
      state.lastDetail = `null ref: ${missing}`;
      if (!silent) {
        state.lastAction = "start-fail";
        pushLog(`# start FAIL — ${missing} null`);
        pushTrace(`blocked: ${missing} null`);
        renderAll();
      }
      return;
    }
    if (state.mode === "parallel") {
      state.uartDone = true;
      state.spiDone = true;
      state.lastOk = true;
      state.lastDetail = "parallel: UART ∥ SPI";
      if (!silent) {
        pushTrace("fork uart_seq.start(uart_sqr)");
        pushTrace("fork spi_seq.start(spi_sqr)");
        pushTrace("join — both done");
      } else {
        pushTrace("parallel UART ∥ SPI");
      }
    } else {
      state.uartDone = true;
      state.spiDone = true;
      state.lastOk = true;
      state.lastDetail = "sequential: UART → SPI";
      if (!silent) {
        pushTrace("start uart_seq @ uart_sqr");
        pushTrace("start spi_seq @ spi_sqr");
        pushTrace("done sequential");
      }
    }
    state.starts += 1;
    if (!silent) {
      state.lastAction = "start";
      pushLog(`# start ${state.mode} OK`);
      renderAll();
    }
  }

  function demo() {
    state.preset = "parallel";
    state.uartRef = true;
    state.spiRef = true;
    state.mode = "parallel";
    state.note = PRESETS.parallel.note;
    state.demoed = true;
    syncInputs();
    startVseq(false);
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo parallel");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: vsequencer holds agent sequencer refs; " +
        "vseq starts sub-sequences sequentially or in parallel."
    );
    renderAll();
  }

  function selectNode(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  const SEL_BLURB = {
    vsqr: "Virtual sequencer: a container of sequencer handles set in connect_phase.",
    vseq: "Virtual sequence: body() starts agent sequences on those handles.",
    uart: "UART agent sequencer — one leaf where uart_seq runs.",
    spi: "SPI agent sequencer — one leaf where spi_seq runs.",
  };

  function renderLab() {
    syncInputs();
    document.getElementById("arch-row").innerHTML = `
      <button type="button" class="arch-box ${state.selected === "vsqr" ? "is-sel" : ""} ${bothWired() ? "is-ok" : "is-warn"}" data-node="vsqr">
        <div class="k">virtual sequencer</div>
        <div class="v">vsqr · uart_sqr=${state.uartRef ? "✓" : "null"} · spi_sqr=${state.spiRef ? "✓" : "null"}</div>
      </button>
      <button type="button" class="arch-box ${state.selected === "vseq" ? "is-sel" : ""}" data-node="vseq">
        <div class="k">virtual sequence</div>
        <div class="v">mode=${state.mode} · last=${state.lastOk == null ? "—" : state.lastOk ? "OK" : "FAIL"}</div>
      </button>
    `;
    document.querySelectorAll("#arch-row [data-node]").forEach((el) => {
      el.addEventListener("click", () =>
        selectNode(/** @type {string} */ (el.getAttribute("data-node")))
      );
    });

    document.getElementById("agent-grid").innerHTML = `
      <button type="button" class="agent-card ${state.uartDone ? "is-live" : ""} ${state.selected === "uart" ? "is-sel" : ""}" data-node="uart" style="cursor:pointer;text-align:left;width:100%;font:inherit">
        <div class="k">UART agent</div>
        <div class="v">sqr ${state.uartRef ? "wired" : "null"} · seq ${state.uartDone ? "ran" : "—"}</div>
      </button>
      <button type="button" class="agent-card ${state.spiDone ? "is-live" : ""} ${state.selected === "spi" ? "is-sel" : ""}" data-node="spi" style="cursor:pointer;text-align:left;width:100%;font:inherit">
        <div class="k">SPI agent</div>
        <div class="v">sqr ${state.spiRef ? "wired" : "null"} · seq ${state.spiDone ? "ran" : "—"}</div>
      </button>
    `;
    document.querySelectorAll("#agent-grid [data-node]").forEach((el) => {
      el.addEventListener("click", () =>
        selectNode(/** @type {string} */ (el.getAttribute("data-node")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      SEL_BLURB[state.selected] || SEL_BLURB.vseq;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (state.lastOk === false) {
      v.className = "verdict no";
      v.textContent = "FAIL — " + state.lastDetail;
    } else if (state.lastOk === true) {
      v.className = "verdict yes";
      v.textContent = "OK — " + state.lastDetail;
    } else if (!bothWired()) {
      v.className = "verdict warn";
      v.textContent = "Wire sequencer refs before Start";
    } else {
      v.className = "verdict idle";
      v.textContent = `Ready — mode=${state.mode}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.uartRef ? "is-ok" : "is-bad"}">uart=${state.uartRef ? 1 : 0}</span>
      <span class="flag ${state.spiRef ? "is-ok" : "is-bad"}">spi=${state.spiRef ? 1 : 0}</span>
      <span class="flag is-on">mode=${state.mode}</span>
      <span class="flag ${state.lastOk ? "is-ok" : state.lastOk === false ? "is-bad" : ""}">last=${state.lastOk == null ? "—" : state.lastOk ? "ok" : "fail"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          uartRef: state.uartRef,
          spiRef: state.spiRef,
          mode: state.mode,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-vsqr",
      title: "Quiz: vsequencer",
      type: "quiz",
      prompt: "A virtual sequencer primarily…",
      hint: "Handles.",
      choices: [
        "holds references to agent sequencers (does not create them)",
        "replaces the DUT netlist",
        "only dumps VCD files",
        "sets the timescale pragma",
      ],
      answer: "holds references to agent sequencers (does not create them)",
    },
    {
      id: "quiz-vseq",
      title: "Quiz: vsequence",
      type: "quiz",
      prompt: "A virtual sequence’s job is to…",
      hint: "Coordinate.",
      choices: [
        "coordinate sub-sequences across multiple sequencers",
        "synthesize gates",
        "replace ConfigDB entirely",
        "compile only Makefiles",
      ],
      answer: "coordinate sub-sequences across multiple sequencers",
    },
    {
      id: "quiz-seq",
      title: "Quiz: sequential",
      type: "quiz",
      prompt: "Sequential coordination means…",
      hint: "Order.",
      choices: [
        "start one sub-sequence, wait, then start the next",
        "always delete the scoreboard",
        "only use FATAL reports",
        "skip connect_phase forever",
      ],
      answer: "start one sub-sequence, wait, then start the next",
    },
    {
      id: "quiz-par",
      title: "Quiz: parallel",
      type: "quiz",
      prompt: "Parallel virtual-sequence starts usually use…",
      hint: "fork.",
      choices: [
        "fork-join (or similar) so both agents run together",
        "only $finish",
        "defparam overrides",
        "GTKWave themes",
      ],
      answer: "fork-join (or similar) so both agents run together",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — both refs wired, sequential OK.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        bothWired() &&
        state.mode === "sequential" &&
        state.lastOk === true,
    },
    {
      id: "load-parallel",
      title: "Load parallel",
      prompt: "Load parallel preset — mode parallel, OK.",
      hint: "parallel → Load",
      setup: () => {
        selPreset.value = "parallel";
        loadPreset();
      },
      check: () =>
        state.mode === "parallel" &&
        state.lastOk === true &&
        state.lastAction === "load",
    },
    {
      id: "load-missing",
      title: "Load missing SPI",
      prompt: "Load SPI ref missing — spi=0.",
      hint: "SPI ref missing → Load",
      setup: () => {
        selPreset.value = "missing_spi";
        loadPreset();
      },
      check: () => state.uartRef && !state.spiRef && state.lastAction === "load",
    },
    {
      id: "start-fail",
      title: "Start fail",
      prompt: "From missing SPI, Start — fail.",
      hint: "Start vseq",
      setup: () => {
        selPreset.value = "missing_spi";
        loadPreset();
        startVseq(false);
      },
      check: () => state.lastOk === false && state.lastAction === "start-fail",
    },
    {
      id: "wire",
      title: "Wire refs",
      prompt: "From unwired, Wire refs — both 1.",
      hint: "unwired → Load → Wire refs",
      setup: () => {
        selPreset.value = "unwired";
        loadPreset();
        wireRefs();
      },
      check: () => bothWired() && state.lastAction === "wire",
    },
    {
      id: "start-ok",
      title: "Start OK",
      prompt: "Wire then Start sequential — OK.",
      hint: "Wire → Start",
      setup: () => {
        selPreset.value = "unwired";
        loadPreset();
        wireRefs();
        selMode.value = "sequential";
        startVseq(false);
      },
      check: () =>
        state.lastOk === true &&
        state.mode === "sequential" &&
        state.lastAction === "start",
    },
    {
      id: "unwire",
      title: "Unwire",
      prompt: "On starter, Unwire — both refs 0.",
      hint: "Unwire",
      setup: () => {
        loadStarter();
        unwire();
      },
      check: () => !state.uartRef && !state.spiRef && state.lastAction === "unwire",
    },
    {
      id: "mode-par",
      title: "Mode parallel",
      prompt: "Set Start mode to parallel.",
      hint: "Start mode → parallel",
      setup: () => {
        loadStarter();
        selMode.value = "parallel";
        state.mode = "parallel";
        state.lastAction = "mode";
        renderAll();
      },
      check: () => state.mode === "parallel" && state.lastAction === "mode",
    },
    {
      id: "start-par",
      title: "Start parallel",
      prompt: "On wired env, Start parallel — detail has ∥ or parallel.",
      hint: "mode parallel → Start",
      setup: () => {
        wireRefs();
        selMode.value = "parallel";
        startVseq(false);
      },
      check: () =>
        state.mode === "parallel" &&
        state.lastOk === true &&
        /parallel|∥/.test(state.lastDetail),
    },
    {
      id: "demo",
      title: "Demo parallel",
      prompt: "Click Demo parallel.",
      hint: "Demo parallel",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.mode === "parallel" &&
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
      id: "select-vsqr",
      title: "Select vsqr",
      prompt: "Click the virtual sequencer box.",
      hint: "Click top arch box",
      setup: () => {
        loadStarter();
        selectNode("vsqr");
      },
      check: () => state.selected === "vsqr" && state.lastAction === "select",
    },
    {
      id: "select-uart",
      title: "Select UART",
      prompt: "Click the UART agent card.",
      hint: "Click UART",
      setup: () => {
        loadStarter();
        selectNode("uart");
      },
      check: () => state.selected === "uart",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions fork-join.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /fork-join|fork/i.test(sourceSketch()),
    },
    {
      id: "sketch-refs",
      title: "Sketch refs",
      prompt: "Body sketch shows uart_sqr =.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /uart_sqr =/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "agents-done",
      title: "Agents done",
      prompt: "After starter, both uartDone and spiDone.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.uartDone && state.spiDone,
    },
    {
      id: "detail-seq",
      title: "Detail sequential",
      prompt: "Starter detail mentions UART → SPI.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /UART → SPI/.test(state.lastDetail),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From unwired, Reset — sequential OK again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "unwired";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        bothWired() &&
        state.lastOk === true &&
        state.mode === "sequential",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="uvs-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("uvs-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-wire").addEventListener("click", () => wireRefs());
  document.getElementById("btn-unwire").addEventListener("click", () => unwire());
  document.getElementById("btn-start").addEventListener("click", () => startVseq(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selMode.addEventListener("change", () => {
    state.mode = /** @type {Mode} */ (selMode.value);
    state.lastAction = "mode";
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
      if (saved && typeof saved.uartRef === "boolean") {
        state.uartRef = saved.uartRef;
        state.spiRef = !!saved.spiRef;
        state.mode = saved.mode || "sequential";
        state.preset = saved.preset || "starter";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
