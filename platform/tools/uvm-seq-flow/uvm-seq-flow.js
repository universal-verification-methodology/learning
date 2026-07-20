(() => {
  /**
   * Sequence → driver flow (concept)
   *   item: sequence → sequencer → driver → vif → DUT
   * Starter: UART byte at sequencer, ready to step
   */

  /** @typedef {"sequence"|"sequencer"|"driver"|"vif"|"dut"} StageId */

  const STAGES = [
    {
      id: "sequence",
      title: "sequence",
      sub: "create / randomize item",
      blurb: "Sequence builds a seq_item (transaction) and starts it on a sequencer.",
    },
    {
      id: "sequencer",
      title: "sequencer",
      sub: "arbitrate / hand off",
      blurb: "Sequencer arbitrates and delivers the item to the connected driver (TLM).",
    },
    {
      id: "driver",
      title: "driver",
      sub: "get_next_item",
      blurb: "Driver pulls the item (get_next_item / try_next_item) and translates it to pin wiggles.",
    },
    {
      id: "vif",
      title: "vif",
      sub: "drive pins",
      blurb: "Virtual interface is how the class driver touches DUT signals.",
    },
    {
      id: "dut",
      title: "DUT",
      sub: "sees stimulus",
      blurb: "Design under test samples the driven pins — end of the stimulus path.",
    },
  ];

  const BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const ORDER = STAGES.map((s) => s.id);

  const PRESETS = {
    starter: {
      label: "starter: item at sequencer",
      stage: "sequencer",
      item: { kind: "uart_byte", data: "0xA5", id: 1 },
      note: "Item left the sequence; waiting on the sequencer for the driver.",
    },
    at_seq: {
      label: "at sequence (just created)",
      stage: "sequence",
      item: { kind: "uart_byte", data: "0x3C", id: 2 },
      note: "Fresh item inside the sequence body.",
    },
    at_drv: {
      label: "at driver (get_next_item)",
      stage: "driver",
      item: { kind: "spi_word", data: "0x55AA", id: 3 },
      note: "Driver owns the item and is about to drive the vif.",
    },
    at_dut: {
      label: "delivered to DUT",
      stage: "dut",
      item: { kind: "uart_byte", data: "0xA5", id: 1 },
      note: "Stimulus path complete for this item.",
    },
    blocked: {
      label: "no item yet",
      stage: "sequence",
      item: null,
      note: "Start / create an item before it can move down the path.",
    },
  };

  function sourceSketch() {
    return `// Sequence → driver literacy (not a UVM library)
// sequence:  item = type_id::create(...); start_item(item); ... finish_item(item);
// sequencer: arbitration + TLM to driver
// driver:    seq_item_port.get_next_item(req); drive via vif; item_done();
// path:      sequence → sequencer → driver → vif → DUT
//
// Sequences describe *what*; drivers describe *how* on pins.
// Do not wiggle pins directly from the sequence body.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      stage: p.stage,
      item: p.item ? { ...p.item } : null,
      note: p.note,
      delivered: false,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-seq-flow-cleared-v1";
  const STORE_KEY = "ddv-uvm-seq-flow-session-v1";

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

  const root = document.getElementById("usf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> UART byte <code>0xA5</code> sits on the
        <code>sequencer</code> — Step to hand it to the driver, then vif, then DUT.</p>
      <button type="button" class="btn btn-secondary" id="usf-starter">Load starter example</button>
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
        <div class="idea-card"><h3>seq_item</h3><p>Transaction object — the currency between sequence and driver.</p></div>
        <div class="idea-card"><h3>sequencer</h3><p>Hands items to the driver; sequences do not drive pins.</p></div>
        <div class="idea-card"><h3>driver</h3><p>get_next_item → pin protocol on the vif.</p></div>
        <div class="idea-card"><h3>DUT</h3><p>End of the stimulus path — sees the driven signals.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="usf-controls">
        <div class="usf-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>at sequencer</option>
            <option value="at_seq">at sequence</option>
            <option value="at_drv">at driver</option>
            <option value="at_dut">at DUT</option>
            <option value="blocked">no item</option>
          </select>
        </div>
        <div class="usf-field">
          <label for="inp-data">item data</label>
          <input id="inp-data" type="text" spellcheck="false">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-start">start_item</button>
        <button type="button" class="btn btn-secondary" id="btn-step">Step path</button>
        <button type="button" class="btn btn-ghost" id="btn-deliver">Run to DUT</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo full path</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="usf-layout">
        <div class="panel-box">
          <h3>Stimulus path</h3>
          <div class="flow-rail" id="flow-rail"></div>
          <div class="item-card" id="item-card"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Current stage</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Code sketch</h3>
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
  const inpData = /** @type {HTMLInputElement} */ (document.getElementById("inp-data"));

  function stageIdx() {
    return ORDER.indexOf(state.stage);
  }

  function codeSketch() {
    const it = state.item;
    return `// sequence body (concept):
req = uart_item::type_id::create("req");
start_item(req);
req.data = ${it ? it.data : "…"};
finish_item(req);          // → sequencer → driver

// driver run:
seq_item_port.get_next_item(req);
drive_byte(vif, req.data); // pins via vif
seq_item_port.item_done();

// item now @ ${state.stage}${it ? `  kind=${it.kind}` : "  (none)"}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    inpData.value = state.item ? state.item.data : "";
  }

  function setStage(id) {
    if (!state.item && id !== "sequence") {
      state.lastAction = "blocked";
      pushLog("# blocked — no item");
      renderAll();
      return;
    }
    state.stage = id;
    state.delivered = id === "dut";
    state.lastAction = "stage";
    pushLog(`# stage ${id}`);
    pushTrace(`item @ ${id}`);
    renderAll();
  }

  function startItem() {
    const data = (inpData.value.trim() || "0xA5");
    state.item = { kind: "uart_byte", data, id: (state.item && state.item.id) || 1 };
    state.stage = "sequence";
    state.delivered = false;
    state.lastAction = "start";
    pushLog("# start_item");
    pushTrace(`create item data=${data}`);
    renderAll();
  }

  function stepPath() {
    if (!state.item) {
      state.lastAction = "blocked";
      pushLog("# blocked — start_item first");
      renderAll();
      return;
    }
    const i = stageIdx();
    if (i < 0 || i >= ORDER.length - 1) {
      state.lastAction = "at-end";
      pushLog("# already at DUT");
      renderAll();
      return;
    }
    state.stage = ORDER[i + 1];
    state.delivered = state.stage === "dut";
    state.lastAction = "step";
    pushLog(`# step → ${state.stage}`);
    pushTrace(`move → ${state.stage}`);
    renderAll();
  }

  function runToDut() {
    if (!state.item) {
      startItem();
    }
    state.stage = "dut";
    state.delivered = true;
    state.lastAction = "deliver";
    pushLog("# run to DUT");
    pushTrace("delivered");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter @ sequencer");
    pushTrace("item 0xA5 @ sequencer");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.stage = p.stage;
    state.item = p.item ? { ...p.item } : null;
    state.note = p.note;
    state.delivered = p.stage === "dut";
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function demo() {
    state.preset = "at_seq";
    state.item = { kind: "uart_byte", data: "0xA5", id: 9 };
    state.stage = "sequence";
    state.note = "Demo: step the full path sequence→…→DUT.";
    state.demoed = true;
    syncInputs();
    // animate conceptually by jumping after logging
    pushLog("# demo full path");
    pushTrace("sequence");
    state.stage = "sequencer";
    pushTrace("sequencer");
    state.stage = "driver";
    pushTrace("driver");
    state.stage = "vif";
    pushTrace("vif");
    state.stage = "dut";
    state.delivered = true;
    state.lastAction = "demo";
    state.demoed = true;
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: sequences make items; sequencer hands off; " +
        "driver drives pins via vif into the DUT."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const here = stageIdx();
    const rail = document.getElementById("flow-rail");
    rail.innerHTML = "";
    STAGES.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = [
        "stage",
        i === here ? "is-here" : "",
        i < here ? "is-done" : "",
      ]
        .filter(Boolean)
        .join(" ");
      b.innerHTML = `<span class="stage-name">${s.title}</span><span class="stage-sub">${s.sub}</span>`;
      b.addEventListener("click", () => setStage(s.id));
      rail.appendChild(b);
    });

    const card = document.getElementById("item-card");
    if (!state.item) {
      card.textContent = "No item — click start_item";
    } else {
      card.textContent = `seq_item #${state.item.id}  kind=${state.item.kind}  data=${state.item.data}\nlocation: ${state.stage}`;
    }

    const st = BY_ID[state.stage];
    document.getElementById("role-blurb").textContent = st
      ? `${st.title}: ${st.blurb}`
      : "";
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    v.className = "verdict yes";
    if (!state.item) {
      v.className = "verdict idle";
      v.textContent = "No item on the path yet";
    } else if (state.delivered) {
      v.textContent = `Item ${state.item.data} delivered to DUT`;
    } else {
      v.textContent = `Item at ${state.stage} — Step path to advance`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">stage=${state.stage}</span>
      <span class="flag ${state.item ? "is-ok" : "is-on"}">item=${state.item ? 1 : 0}</span>
      <span class="flag ${state.delivered ? "is-ok" : ""}">delivered=${state.delivered ? 1 : 0}</span>
      <span class="flag is-on">data=${state.item ? state.item.data : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          stage: state.stage,
          item: state.item,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-path",
      title: "Quiz: path",
      type: "quiz",
      prompt: "The stimulus handoff path is…",
      hint: "Catalog order.",
      choices: [
        "sequence → sequencer → driver → vif → DUT",
        "DUT → driver → sequence only",
        "scoreboard → factory → DUT",
        "report → build → connect",
      ],
      answer: "sequence → sequencer → driver → vif → DUT",
    },
    {
      id: "quiz-seq",
      title: "Quiz: sequence",
      type: "quiz",
      prompt: "A sequence’s job is mainly to…",
      hint: "What, not pins.",
      choices: [
        "create/randomize seq_items and start them on a sequencer",
        "synthesize the DUT netlist",
        "replace the virtual interface",
        "dump VCD only",
      ],
      answer: "create/randomize seq_items and start them on a sequencer",
    },
    {
      id: "quiz-drv",
      title: "Quiz: driver",
      type: "quiz",
      prompt: "The driver typically…",
      hint: "get_next_item.",
      choices: [
        "pulls items and drives pins through the vif",
        "only prints $display forever",
        "builds the env hierarchy",
        "runs check_phase",
      ],
      answer: "pulls items and drives pins through the vif",
    },
    {
      id: "quiz-sep",
      title: "Quiz: separation",
      type: "quiz",
      prompt: "Sequences should not…",
      hint: "Pins.",
      choices: [
        "wiggle DUT pins directly (that is the driver’s job)",
        "create seq_items",
        "call start_item / finish_item",
        "run on a sequencer",
      ],
      answer: "wiggle DUT pins directly (that is the driver’s job)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — item at sequencer, data 0xA5.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.stage === "sequencer" &&
        state.item &&
        state.item.data === "0xA5",
    },
    {
      id: "step",
      title: "Step",
      prompt: "From starter, Step once → driver.",
      hint: "Step path",
      setup: () => {
        loadStarter();
        stepPath();
      },
      check: () => state.stage === "driver" && state.lastAction === "step",
    },
    {
      id: "step-vif",
      title: "Step to vif",
      prompt: "From starter, Step twice → vif.",
      hint: "Step ×2",
      setup: () => {
        loadStarter();
        stepPath();
        stepPath();
      },
      check: () => state.stage === "vif",
    },
    {
      id: "deliver",
      title: "Run to DUT",
      prompt: "From starter, Run to DUT — delivered=1.",
      hint: "Run to DUT",
      setup: () => {
        loadStarter();
        runToDut();
      },
      check: () => state.delivered && state.stage === "dut",
    },
    {
      id: "load-seq",
      title: "Load at sequence",
      prompt: "Load at sequence preset.",
      hint: "at sequence → Load",
      setup: () => {
        selPreset.value = "at_seq";
        loadPreset();
      },
      check: () => state.stage === "sequence" && state.item,
    },
    {
      id: "load-drv",
      title: "Load at driver",
      prompt: "Load at driver — kind spi_word.",
      hint: "at driver → Load",
      setup: () => {
        selPreset.value = "at_drv";
        loadPreset();
      },
      check: () => state.stage === "driver" && state.item && state.item.kind === "spi_word",
    },
    {
      id: "load-dut",
      title: "Load at DUT",
      prompt: "Load delivered to DUT.",
      hint: "at DUT → Load",
      setup: () => {
        selPreset.value = "at_dut";
        loadPreset();
      },
      check: () => state.stage === "dut" && state.delivered,
    },
    {
      id: "blocked",
      title: "Blocked",
      prompt: "Load no item, Step — blocked.",
      hint: "no item → Load → Step",
      setup: () => {
        selPreset.value = "blocked";
        loadPreset();
        stepPath();
      },
      check: () => !state.item && state.lastAction === "blocked",
    },
    {
      id: "start-item",
      title: "start_item",
      prompt: "From blocked, start_item — item appears at sequence.",
      hint: "start_item",
      setup: () => {
        selPreset.value = "blocked";
        loadPreset();
        inpData.value = "0x11";
        startItem();
      },
      check: () =>
        state.item &&
        state.stage === "sequence" &&
        state.lastAction === "start",
    },
    {
      id: "demo",
      title: "Demo full",
      prompt: "Click Demo full path — stage=dut.",
      hint: "Demo full path",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.stage === "dut" &&
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
      id: "sketch-get",
      title: "Sketch driver",
      prompt: "Code sketch mentions get_next_item.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /get_next_item/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch says sequences describe what.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /Sequences describe \*what\*/.test(sourceSketch()),
    },
    {
      id: "click-drv",
      title: "Click driver",
      prompt: "From starter, click the driver stage.",
      hint: "Click driver",
      setup: () => {
        loadStarter();
        setStage("driver");
      },
      check: () => state.stage === "driver" && state.lastAction === "stage",
    },
    {
      id: "data-flag",
      title: "Data",
      prompt: "Starter item data is 0xA5.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.item && state.item.data === "0xA5",
    },
    {
      id: "order-sqr",
      title: "Order",
      prompt: "sequencer comes before driver in ORDER.",
      hint: "Path order",
      setup: () => loadStarter(),
      check: () => ORDER.indexOf("sequencer") < ORDER.indexOf("driver"),
    },
    {
      id: "blurb-sqr",
      title: "Sequencer blurb",
      prompt: "At sequencer, blurb mentions arbitrates.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.stage === "sequencer" &&
        /arbitrat/i.test(document.getElementById("role-blurb").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to sequencer with 0xA5.",
      hint: "Reset",
      setup: () => {
        runToDut();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.stage === "sequencer" && state.item && state.item.data === "0xA5";
      },
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="usf-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("usf-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-start").addEventListener("click", () => startItem());
  document.getElementById("btn-step").addEventListener("click", () => stepPath());
  document.getElementById("btn-deliver").addEventListener("click", () => runToDut());
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
      if (saved && saved.stage) {
        state.stage = saved.stage;
        state.item = saved.item || state.item;
        state.preset = saved.preset || "starter";
        state.delivered = state.stage === "dut";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
