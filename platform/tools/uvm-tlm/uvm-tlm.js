(() => {
  /**
   * TLM port wiring (concept)
   *   seq_item port↔export · put/get · analysis broadcast
   * Starter: drv↔sqr connected + mon ap → sb
   */

  /** @typedef {"seq_item"|"put"|"get"|"analysis"} ConnKind */

  const KINDS = {
    seq_item: {
      title: "seq_item port ↔ export",
      left: { who: "driver", port: "seq_item_port" },
      right: { who: "sequencer", port: "seq_item_export" },
      arrow: "← get_next_item / item_done →",
      blurb: "Driver pulls transactions from the sequencer (pull model).",
      connect: "drv.seq_item_port.connect(sqr.seq_item_export);",
      send: "get",
    },
    put: {
      title: "blocking put",
      left: { who: "producer", port: "put_port" },
      right: { who: "consumer", port: "put_export" },
      arrow: "put(txn) →",
      blurb: "Producer pushes a transaction into the consumer (push model).",
      connect: "prod.put_port.connect(cons.put_export);",
      send: "put",
    },
    get: {
      title: "blocking get",
      left: { who: "consumer", port: "get_port" },
      right: { who: "producer", port: "get_export" },
      arrow: "← get(txn)",
      blurb: "Consumer pulls a transaction from the producer.",
      connect: "cons.get_port.connect(prod.get_export);",
      send: "get",
    },
    analysis: {
      title: "analysis broadcast",
      left: { who: "monitor", port: "analysis_port" },
      right: { who: "scoreboard", port: "analysis_export / imp" },
      arrow: "write(txn) → (1:N)",
      blurb: "Monitor broadcasts; many subscribers can listen (non-blocking).",
      connect: "mon.ap.connect(sb.analysis_export);",
      send: "write",
    },
  };

  const PRESETS = {
    starter: {
      label: "starter: seq_item + analysis both up",
      kind: "seq_item",
      seqConnected: true,
      analysisConnected: true,
      note: "Classic agent connect: driver↔sequencer and monitor→scoreboard.",
    },
    seq_only: {
      label: "seq_item only",
      kind: "seq_item",
      seqConnected: true,
      analysisConnected: false,
      note: "Stimulus path wired; analysis not connected yet.",
    },
    analysis_only: {
      label: "analysis only",
      kind: "analysis",
      seqConnected: false,
      analysisConnected: true,
      note: "Observe path wired; no seq_item connect.",
    },
    put: {
      label: "put port",
      kind: "put",
      seqConnected: false,
      analysisConnected: false,
      note: "Push-style TLM: producer.put → consumer.",
    },
    unconnected: {
      label: "nothing connected",
      kind: "seq_item",
      seqConnected: false,
      analysisConnected: false,
      note: "Send will fail until you Connect.",
    },
  };

  function sourceSketch() {
    return `// TLM literacy (not a full TLM library)
// Port  = initiator side (asks to put/get/write)
// Export/imp = target side (implements the call)
// connect_phase: port.connect(export);
//
// seq_item:  drv.seq_item_port.connect(sqr.seq_item_export);
// analysis:  mon.ap.connect(sb.analysis_export);  // 1→many write()
// put/get:   blocking push or pull of a transaction
//
// Wire in connect_phase — after build creates the ports.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      kind: /** @type {ConnKind} */ (p.kind),
      seqConnected: p.seqConnected,
      analysisConnected: p.analysisConnected,
      note: p.note,
      lastTxn: null,
      lastOk: null,
      selected: "left",
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-tlm-cleared-v1";
  const STORE_KEY = "ddv-uvm-tlm-session-v1";

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

  const root = document.getElementById("utlm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>seq_item_port</code> ↔ sequencer export
        and monitor <code>analysis_port</code> → scoreboard are both connected.</p>
      <button type="button" class="btn btn-secondary" id="utlm-starter">Load starter example</button>
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
        <div class="idea-card"><h3>port → export</h3><p>Connect initiator port to a target export in connect_phase.</p></div>
        <div class="idea-card"><h3>seq_item</h3><p>Driver pulls items from the sequencer.</p></div>
        <div class="idea-card"><h3>analysis</h3><p>Monitor write() broadcasts to subscribers.</p></div>
        <div class="idea-card"><h3>put / get</h3><p>Push or pull a transaction across components.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="utlm-controls">
        <div class="utlm-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>seq_item + analysis</option>
            <option value="seq_only">seq_item only</option>
            <option value="analysis_only">analysis only</option>
            <option value="put">put port</option>
            <option value="unconnected">unconnected</option>
          </select>
        </div>
        <div class="utlm-field">
          <label for="sel-kind">TLM kind</label>
          <select id="sel-kind">
            <option value="seq_item">seq_item</option>
            <option value="put">put</option>
            <option value="get">get</option>
            <option value="analysis">analysis</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-connect">Connect</button>
        <button type="button" class="btn btn-ghost" id="btn-disconnect">Disconnect</button>
        <button type="button" class="btn btn-secondary" id="btn-send">Send txn</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo analysis</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="utlm-layout">
        <div class="panel-box">
          <h3>Wiring</h3>
          <div class="wire-row" id="wire-row"></div>
          <div class="txn-box" id="txn-box">No transaction yet</div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected end</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Connect sketch</h3>
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
  const selKind = /** @type {HTMLSelectElement} */ (document.getElementById("sel-kind"));

  function kind() {
    return KINDS[state.kind] || KINDS.seq_item;
  }

  function isConnected() {
    if (state.kind === "seq_item") return state.seqConnected;
    if (state.kind === "analysis") return state.analysisConnected;
    // put/get use a generic flag stored on seqConnected for simplicity when kind is put/get
    return state.seqConnected;
  }

  function codeSketch() {
    const k = kind();
    return `// connect_phase:
${k.connect}
// seq_item linked=${state.seqConnected ? 1 : 0}
// analysis linked=${state.analysisConnected ? 1 : 0}
// current kind=${state.kind} connected=${isConnected() ? 1 : 0}`;
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
    selKind.value = state.kind;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter both links");
    pushTrace("seq_item+analysis connected");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.kind = /** @type {ConnKind} */ (p.kind);
    state.seqConnected = p.seqConnected;
    state.analysisConnected = p.analysisConnected;
    state.note = p.note;
    state.lastTxn = null;
    state.lastOk = null;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function setKind(k) {
    state.kind = /** @type {ConnKind} */ (k);
    state.lastAction = "kind";
    pushLog(`# kind ${k}`);
    renderAll();
  }

  function connect() {
    if (state.kind === "analysis") state.analysisConnected = true;
    else state.seqConnected = true;
    state.lastAction = "connect";
    pushLog(`# connect ${state.kind}`);
    pushTrace(`connected ${state.kind}`);
    renderAll();
  }

  function disconnect() {
    if (state.kind === "analysis") state.analysisConnected = false;
    else state.seqConnected = false;
    state.lastOk = null;
    state.lastAction = "disconnect";
    pushLog(`# disconnect ${state.kind}`);
    renderAll();
  }

  function sendTxn() {
    const k = kind();
    if (!isConnected()) {
      state.lastOk = false;
      state.lastTxn = null;
      state.lastAction = "send-fail";
      pushLog("# send FAIL — not connected");
      pushTrace("blocked: connect first");
      renderAll();
      return;
    }
    const txn = { id: Date.now() % 1000, data: "0xA5", via: k.send };
    state.lastTxn = txn;
    state.lastOk = true;
    state.lastAction = "send";
    pushLog(`# send ${k.send}`);
    pushTrace(`${k.left.port} ${k.send} → ${k.right.port} data=${txn.data}`);
    renderAll();
  }

  function demo() {
    state.preset = "analysis_only";
    state.kind = "analysis";
    state.seqConnected = false;
    state.analysisConnected = true;
    state.note = PRESETS.analysis_only.note;
    state.demoed = true;
    syncInputs();
    sendTxn();
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo analysis write");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: connect port to export; seq_item for driver↔sequencer; " +
        "analysis write for monitor→scoreboard; put/get for push/pull."
    );
    renderAll();
  }

  function selectEnd(which) {
    state.selected = which;
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const k = kind();
    const live = isConnected();
    const row = document.getElementById("wire-row");
    row.innerHTML = `
      <button type="button" class="endp ${state.selected === "left" ? "is-sel" : ""} ${live ? "is-live" : ""}" data-end="left">
        <div class="k">${k.left.who}</div><div class="v">${k.left.port}</div>
      </button>
      <div class="wire-arrow ${live ? "is-on" : ""}">${live ? k.arrow : "(not connected)"}</div>
      <button type="button" class="endp ${state.selected === "right" ? "is-sel" : ""} ${live ? "is-live" : ""}" data-end="right">
        <div class="k">${k.right.who}</div><div class="v">${k.right.port}</div>
      </button>
    `;
    row.querySelectorAll("[data-end]").forEach((el) => {
      el.addEventListener("click", () =>
        selectEnd(/** @type {string} */ (el.getAttribute("data-end")))
      );
    });

    const end = state.selected === "left" ? k.left : k.right;
    document.getElementById("role-blurb").textContent =
      `${k.title}: ${k.blurb} Looking at ${end.who}.${end.port}.`;

    const txn = document.getElementById("txn-box");
    if (state.lastOk === false) {
      txn.textContent = "Send failed — connect the ports first";
    } else if (state.lastTxn) {
      txn.textContent = `txn #${state.lastTxn.id} data=${state.lastTxn.data} via ${state.lastTxn.via} — OK`;
    } else {
      txn.textContent = "No transaction yet — Connect then Send txn";
    }

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
    if (!live) {
      v.className = "verdict warn";
      v.textContent = `${k.title} — not connected`;
    } else if (state.lastOk) {
      v.className = "verdict yes";
      v.textContent = `${k.title} — connected; last send OK`;
    } else {
      v.className = "verdict yes";
      v.textContent = `${k.title} — connected`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">kind=${state.kind}</span>
      <span class="flag ${live ? "is-ok" : "is-bad"}">linked=${live ? 1 : 0}</span>
      <span class="flag ${state.seqConnected ? "is-ok" : ""}">seq=${state.seqConnected ? 1 : 0}</span>
      <span class="flag ${state.analysisConnected ? "is-ok" : ""}">ap=${state.analysisConnected ? 1 : 0}</span>
      <span class="flag ${state.lastOk ? "is-ok" : state.lastOk === false ? "is-bad" : ""}">send=${state.lastOk == null ? "—" : state.lastOk ? "ok" : "fail"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          kind: state.kind,
          seqConnected: state.seqConnected,
          analysisConnected: state.analysisConnected,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-connect",
      title: "Quiz: connect",
      type: "quiz",
      prompt: "TLM ports are usually wired in…",
      hint: "Phase.",
      choices: [
        "connect_phase (port.connect(export))",
        "only after $finish",
        "synthesis",
        "report_phase exclusively",
      ],
      answer: "connect_phase (port.connect(export))",
    },
    {
      id: "quiz-seq",
      title: "Quiz: seq_item",
      type: "quiz",
      prompt: "Driver ↔ sequencer typically uses…",
      hint: "Pull.",
      choices: [
        "seq_item_port connected to seq_item_export",
        "only analysis_port",
        "ConfigDB instead of TLM",
        "VCD dumps",
      ],
      answer: "seq_item_port connected to seq_item_export",
    },
    {
      id: "quiz-ap",
      title: "Quiz: analysis",
      type: "quiz",
      prompt: "An analysis_port write()…",
      hint: "Broadcast.",
      choices: [
        "broadcasts a transaction to connected subscribers",
        "deletes the sequencer",
        "raises objections only",
        "drives DUT pins directly",
      ],
      answer: "broadcasts a transaction to connected subscribers",
    },
    {
      id: "quiz-put",
      title: "Quiz: put",
      type: "quiz",
      prompt: "A put_port is a…",
      hint: "Push.",
      choices: [
        "push-style initiator that sends a transaction to an export",
        "monitor-only broadcast always",
        "factory override type",
        "timescale pragma",
      ],
      answer: "push-style initiator that sends a transaction to an export",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — seq and analysis both linked.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.seqConnected &&
        state.analysisConnected,
    },
    {
      id: "send-ok",
      title: "Send OK",
      prompt: "On starter, Send txn — send ok.",
      hint: "Send txn",
      setup: () => {
        loadStarter();
        sendTxn();
      },
      check: () => state.lastOk === true && state.lastAction === "send",
    },
    {
      id: "disconnect",
      title: "Disconnect",
      prompt: "Disconnect current kind — linked=0.",
      hint: "Disconnect",
      setup: () => {
        loadStarter();
        disconnect();
      },
      check: () => !isConnected() && state.lastAction === "disconnect",
    },
    {
      id: "send-fail",
      title: "Send fail",
      prompt: "Load unconnected, Send — fail.",
      hint: "unconnected → Load → Send",
      setup: () => {
        selPreset.value = "unconnected";
        loadPreset();
        sendTxn();
      },
      check: () => state.lastOk === false && state.lastAction === "send-fail",
    },
    {
      id: "connect",
      title: "Connect",
      prompt: "From unconnected, Connect — linked=1.",
      hint: "Connect",
      setup: () => {
        selPreset.value = "unconnected";
        loadPreset();
        connect();
      },
      check: () => isConnected() && state.lastAction === "connect",
    },
    {
      id: "load-analysis",
      title: "Load analysis",
      prompt: "Load analysis only — kind analysis, ap=1.",
      hint: "analysis only → Load",
      setup: () => {
        selPreset.value = "analysis_only";
        loadPreset();
      },
      check: () =>
        state.kind === "analysis" &&
        state.analysisConnected &&
        !state.seqConnected,
    },
    {
      id: "load-put",
      title: "Load put",
      prompt: "Load put port preset — kind put.",
      hint: "put → Load",
      setup: () => {
        selPreset.value = "put";
        loadPreset();
      },
      check: () => state.kind === "put",
    },
    {
      id: "kind-get",
      title: "Kind get",
      prompt: "Set TLM kind to get.",
      hint: "TLM kind → get",
      setup: () => {
        loadStarter();
        selKind.value = "get";
        setKind("get");
      },
      check: () => state.kind === "get" && state.lastAction === "kind",
    },
    {
      id: "demo",
      title: "Demo analysis",
      prompt: "Click Demo analysis — send ok on analysis.",
      hint: "Demo analysis",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.kind === "analysis" &&
        state.lastOk === true &&
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
      id: "sketch-connect",
      title: "Sketch connect",
      prompt: "Connect sketch shows .connect(.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /\.connect\(/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions analysis write.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /analysis write/i.test(sourceSketch()) || /analysis:/.test(sourceSketch()),
    },
    {
      id: "select-left",
      title: "Select left",
      prompt: "Click the left endpoint.",
      hint: "Click left box",
      setup: () => {
        loadStarter();
        selectEnd("left");
      },
      check: () => state.selected === "left" && state.lastAction === "select",
    },
    {
      id: "select-right",
      title: "Select right",
      prompt: "Click the right endpoint.",
      hint: "Click right box",
      setup: () => {
        loadStarter();
        selectEnd("right");
      },
      check: () => state.selected === "right",
    },
    {
      id: "arrow-text",
      title: "Arrow",
      prompt: "On starter seq_item, arrow mentions get_next_item.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "seq_item" &&
        /get_next_item/.test(document.querySelector(".wire-arrow").textContent),
    },
    {
      id: "txn-data",
      title: "Txn data",
      prompt: "After Send on starter, txn data is 0xA5.",
      hint: "Send txn",
      setup: () => {
        loadStarter();
        sendTxn();
      },
      check: () => state.lastTxn && state.lastTxn.data === "0xA5",
    },
    {
      id: "blurb-ap",
      title: "Analysis blurb",
      prompt: "On analysis kind, blurb mentions broadcast.",
      hint: "kind=analysis",
      setup: () => {
        selKind.value = "analysis";
        setKind("analysis");
        state.analysisConnected = true;
      },
      check: () =>
        state.kind === "analysis" &&
        /broadcast/i.test(document.getElementById("role-blurb").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From unconnected, click Reset — both links up again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "unconnected";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.seqConnected &&
        state.analysisConnected,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="utlm-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("utlm-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-connect").addEventListener("click", () => connect());
  document.getElementById("btn-disconnect").addEventListener("click", () => disconnect());
  document.getElementById("btn-send").addEventListener("click", () => sendTxn());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selKind.addEventListener("change", () => setKind(selKind.value));

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
      if (saved && saved.kind) {
        state.kind = saved.kind;
        state.seqConnected = !!saved.seqConnected;
        state.analysisConnected = !!saved.analysisConnected;
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
