(() => {
  /**
   * Basic TB vs UVM map (concept)
   *   Side-by-side: wiggle-pins classic TB ↔ UVM roles
   *   Click a pair → bridge + vignette; Mark mapped to check off
   * Starter: UART TX — pin-drive ↔ driver already selected + mapped
   */

  /** @typedef {"uart"|"spi"|"i2c"} ProtoId */

  const PAIRS = [
    {
      id: "pin-drive",
      classic: {
        title: "Pin wiggle",
        blurb: "initial / task drives DUT pins with #delays",
      },
      uvm: {
        title: "Driver + vif",
        blurb: "Driver pulls items; drives pins via virtual interface",
      },
      bridge: "Procedural pin writes become a reusable driver behind a vif.",
      classicFlow: ["initial", "pins", "DUT"],
      uvmFlow: ["seq_item", "driver", "vif", "DUT"],
    },
    {
      id: "stimulus",
      classic: {
        title: "Hard-coded vectors",
        blurb: "Fixed lists / nested tasks for each scenario",
      },
      uvm: {
        title: "Sequence + sequencer",
        blurb: "Sequences generate items; sequencer feeds the driver",
      },
      bridge: "Scenario intent moves up: sequences compose items, not raw pin edges.",
      classicFlow: ["vectors", "tasks", "pins"],
      uvmFlow: ["sequence", "sequencer", "driver"],
    },
    {
      id: "observe",
      classic: {
        title: "$display peek",
        blurb: "TB reads wires and prints in the same initial",
      },
      uvm: {
        title: "Monitor + analysis",
        blurb: "Passive monitor samples bus → analysis port / TLM",
      },
      bridge: "Observation splits from stimulus: one monitor, many subscribers.",
      classicFlow: ["DUT", "wires", "$display"],
      uvmFlow: ["DUT", "monitor", "analysis_port"],
    },
    {
      id: "check",
      classic: {
        title: "Inline expect",
        blurb: "if (got !== exp) $error inside the same block",
      },
      uvm: {
        title: "Scoreboard",
        blurb: "Predict vs observe compare on transactions",
      },
      bridge: "Checks become transaction-level: expect vs actual on items.",
      classicFlow: ["got", "===", "exp"],
      uvmFlow: ["predict", "scoreboard", "actual"],
    },
    {
      id: "structure",
      classic: {
        title: "module tb + DUT",
        blurb: "One flat wrapper: clocks, stimulus, checks, finish",
      },
      uvm: {
        title: "Env + agent(s)",
        blurb: "Env holds agents; agent = driver/monitor/sequencer",
      },
      bridge: "Hierarchy: test → env → agent → (drv/mon/sqr) around the DUT.",
      classicFlow: ["tb", "DUT", "$finish"],
      uvmFlow: ["test", "env", "agent", "DUT"],
    },
    {
      id: "reuse",
      classic: {
        title: "Copy-paste TB",
        blurb: "Fork the whole TB for the next block / protocol",
      },
      uvm: {
        title: "Factory / VIP reuse",
        blurb: "Type overrides + packaged agents (VIP) across projects",
      },
      bridge: "Reuse moves to components and factory overrides, not file clones.",
      classicFlow: ["copy", "tb.v"],
      uvmFlow: ["factory", "agent", "VIP"],
    },
  ];

  const PROTOS = {
    uart: {
      title: "UART TX byte",
      vignette: {
        "pin-drive":
          "Classic: #baud delays on tx. UVM: uart_driver drives tx via vif each baud tick.",
        stimulus:
          "Classic: send_byte(8'hA5) task. UVM: uart_seq builds uart_item{data:8'hA5}.",
        observe:
          "Classic: $display(tx) in TB. UVM: uart_monitor packs start/data/stop into items.",
        check:
          "Classic: if (rx !== 8'hA5). UVM: scoreboard compares predicted vs monitored bytes.",
        structure:
          "Classic: module uart_tb. UVM: uart_env with one active agent around uart_tx DUT.",
        reuse:
          "Classic: duplicate uart_tb for SPI. UVM: swap agent type / VIP; keep env shape.",
      },
    },
    spi: {
      title: "SPI master word",
      vignette: {
        "pin-drive":
          "Classic: toggle sclk/mosi/cs_n in a loop. UVM: spi_driver owns mode-0 edge timing.",
        stimulus:
          "Classic: xfer(8'h5A) task. UVM: spi_seq emits spi_item{tx, cs_id}.",
        observe:
          "Classic: sample miso into a reg. UVM: spi_monitor publishes full-duplex items.",
        check:
          "Classic: if (rx !== golden). UVM: scoreboard on transaction fields.",
        structure:
          "Classic: flat spi_tb. UVM: spi_env; multi-CS → more agents or CS in item.",
        reuse:
          "Classic: copy TB per mode. UVM: factory override driver for CPOL/CPHA.",
      },
    },
    i2c: {
      title: "I²C byte write",
      vignette: {
        "pin-drive":
          "Classic: bit-bang SCL/SDA open-drain. UVM: i2c_driver + vif with pull-up model.",
        stimulus:
          "Classic: write(addr, data) task. UVM: i2c_seq builds start/addr/data/stop item.",
        observe:
          "Classic: peek ACK bit. UVM: monitor emits ACK/NACK as transaction fields.",
        check:
          "Classic: if (!ack) $error. UVM: scoreboard / protocol checker on items.",
        structure:
          "Classic: module i2c_tb. UVM: i2c_env with master agent (+ optional slave).",
        reuse:
          "Classic: new TB per EEPROM. UVM: VIP agent + config for address width.",
      },
    },
  };

  function sourceCode() {
    return `// Classic TB → UVM map (concept)
// pin wiggle     → driver + virtual interface
// hard-coded vec → sequence + sequencer
// $display peek  → monitor + analysis port
// inline expect  → scoreboard
// module tb      → env + agent(s)
// copy-paste TB  → factory / VIP reuse
// Not a UVM library — literacy only.`;
  }

  function makeStarter() {
    return {
      proto: "uart",
      selected: "pin-drive",
      mapped: new Set(["pin-drive"]),
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-tb-vs-uvm-map-cleared-v1";
  const STORE_KEY = "ddv-tb-vs-uvm-map-session-v1";

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

  const root = document.getElementById("tvm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>UART TX byte</strong> with
        <em>pin wiggle ↔ driver</em> selected and marked mapped.
        Click other pairs, Mark mapped, or Demo all.</p>
      <button type="button" class="btn btn-secondary" id="tvm-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Pins → transactions</h3><p>UVM moves intent from edges to items.</p></div>
        <div class="idea-card"><h3>Split roles</h3><p>Drive, watch, and check are separate components.</p></div>
        <div class="idea-card"><h3>Agent</h3><p>Driver + monitor + sequencer around one interface.</p></div>
        <div class="idea-card"><h3>Reuse</h3><p>Factory and VIP beat copy-paste TBs.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="tvm-controls">
        <div class="tvm-field">
          <label for="sel-proto">Protocol vignette</label>
          <select id="sel-proto">
            <option value="uart" selected>UART TX byte</option>
            <option value="spi">SPI master word</option>
            <option value="i2c">I²C byte write</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-apply-proto">Apply protocol</button>
        <button type="button" class="btn btn-ghost" id="btn-mark">Mark mapped</button>
        <button type="button" class="btn btn-ghost" id="btn-unmark">Unmark</button>
        <button type="button" class="btn btn-ghost" id="btn-map-all">Map all</button>
        <button type="button" class="btn btn-ghost" id="btn-clear">Clear mapped</button>
        <button type="button" class="btn btn-secondary" id="btn-demo">Demo all</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="bridge" id="bridge-box"></div>
      <div class="tvm-layout">
        <div class="col-panel classic">
          <h3>Classic TB (wiggle pins)</h3>
          <ul class="map-list" id="classic-list"></ul>
        </div>
        <div class="col-panel uvm">
          <h3>UVM (transactions / agents)</h3>
          <ul class="map-list" id="uvm-list"></ul>
        </div>
      </div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Flow chips</h3>
      <div id="flow-box"></div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Map sketch</h3>
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

  const selProto = /** @type {HTMLSelectElement} */ (document.getElementById("sel-proto"));

  function pair() {
    return PAIRS.find((p) => p.id === state.selected) || PAIRS[0];
  }

  function proto() {
    return PROTOS[state.proto] || PROTOS.uart;
  }

  function mappedCount() {
    return state.mapped.size;
  }

  function allMapped() {
    return PAIRS.every((p) => state.mapped.has(p.id));
  }

  function syncInputs() {
    selProto.value = state.proto;
  }

  function readProto() {
    state.proto = selProto.value in PROTOS ? selProto.value : "uart";
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

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter UART pin-drive mapped");
    pushTrace("selected=pin-drive mapped=1");
    renderAll();
  }

  function selectPair(id) {
    if (!PAIRS.some((p) => p.id === id)) return;
    state.selected = id;
    state.lastAction = "select";
    pushTrace(`select ${id}`);
    renderAll();
  }

  function applyProto() {
    readProto();
    state.lastAction = "proto";
    pushLog(`# protocol ${state.proto}`);
    renderAll();
  }

  function markMapped() {
    state.mapped.add(state.selected);
    state.lastAction = "mark";
    pushTrace(`map ${state.selected}`);
    pushLog(`# mapped ${state.selected}`);
    renderAll();
  }

  function unmarkMapped() {
    state.mapped.delete(state.selected);
    state.lastAction = "unmark";
    pushTrace(`unmap ${state.selected}`);
    renderAll();
  }

  function mapAll() {
    PAIRS.forEach((p) => state.mapped.add(p.id));
    state.lastAction = "map-all";
    pushLog("# map all");
    renderAll();
  }

  function clearMapped() {
    state.mapped = new Set();
    state.lastAction = "clear";
    pushLog("# clear mapped");
    renderAll();
  }

  function demo() {
    state = makeStarter();
    syncInputs();
    PAIRS.forEach((p) => state.mapped.add(p.id));
    state.selected = "structure";
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo all pairs mapped");
    pushTrace("demo → structure selected, mapped=6");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Classic TB wiggles pins in one module. UVM splits stimulus (seq), drive (driver+vif), " +
        "observe (monitor), check (scoreboard), and structure (env/agent) for reuse."
    );
    pushLog("# explain");
    renderAll();
  }

  function chipsHtml(ids, onClass) {
    return ids
      .map((id, i) => {
        const arrow =
          i < ids.length - 1 ? `<span style="color:var(--muted)">→</span>` : "";
        return `<span class="flow-chip ${onClass}">${id}</span>${arrow}`;
      })
      .join(" ");
  }

  function renderLab() {
    syncInputs();
    const p = pair();
    const pr = proto();
    const vig = pr.vignette[p.id] || "";

    document.getElementById("bridge-box").innerHTML = `
      <h3>${p.classic.title} → ${p.uvm.title}</h3>
      <p class="arrow">${p.id}</p>
      <p>${p.bridge}</p>
      <p class="vignette"><strong>${pr.title}:</strong> ${vig}</p>`;

    const classic = document.getElementById("classic-list");
    const uvm = document.getElementById("uvm-list");
    classic.innerHTML = "";
    uvm.innerHTML = "";
    PAIRS.forEach((row) => {
      const sel = row.id === state.selected;
      const mapped = state.mapped.has(row.id);
      const cls = `map-item${sel ? " is-sel" : ""}${mapped ? " is-mapped" : ""}`;

      const cBtn = document.createElement("button");
      cBtn.type = "button";
      cBtn.className = cls;
      cBtn.innerHTML = `<strong>${row.classic.title}</strong><span class="tag">${row.id}${mapped ? " · ✓" : ""}</span><span class="blurb">${row.classic.blurb}</span>`;
      cBtn.addEventListener("click", () => selectPair(row.id));
      classic.appendChild(cBtn);

      const uBtn = document.createElement("button");
      uBtn.type = "button";
      uBtn.className = cls;
      uBtn.innerHTML = `<strong>${row.uvm.title}</strong><span class="tag">${row.id}${mapped ? " · ✓" : ""}</span><span class="blurb">${row.uvm.blurb}</span>`;
      uBtn.addEventListener("click", () => selectPair(row.id));
      uvm.appendChild(uBtn);
    });

    document.getElementById("flow-box").innerHTML = `
      <div class="flow-row"><span style="min-width:4.5rem;color:var(--muted)">Classic</span>${chipsHtml(p.classicFlow, "is-on")}</div>
      <div class="flow-row"><span style="min-width:4.5rem;color:var(--muted)">UVM</span>${chipsHtml(p.uvmFlow, "uvm-on")}</div>`;

    const v = document.getElementById("verdict");
    if (allMapped()) {
      v.className = "verdict yes";
      v.textContent = `Full map · ${pr.title} · ${mappedCount()}/6 pairs · selected ${p.id}`;
    } else {
      v.className = "verdict idle";
      v.textContent = `${mappedCount()}/6 mapped · selected ${p.id} · ${pr.title}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.proto}</span>
      <span class="flag is-on">sel=${state.selected}</span>
      <span class="flag ${mappedCount() ? "is-ok" : ""}">mapped=${mappedCount()}</span>
      <span class="flag ${allMapped() ? "is-ok" : ""}">all=${allMapped() ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    document.getElementById("code-box").textContent = sourceCode();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          proto: state.proto,
          selected: state.selected,
          mapped: [...state.mapped],
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-goal",
      title: "Quiz: goal",
      type: "quiz",
      prompt: "This lab’s main idea is…",
      hint: "Map, don’t replace Accellera.",
      choices: [
        "map classic pin TB roles onto UVM components",
        "compile Accellera UVM in the browser",
        "synthesize a UART VIP",
        "replace all $display with SVA",
      ],
      answer: "map classic pin TB roles onto UVM components",
    },
    {
      id: "quiz-driver",
      title: "Quiz: driver",
      type: "quiz",
      prompt: "Classic pin wiggles map most closely to…",
      hint: "Who touches pins?",
      choices: [
        "driver + virtual interface",
        "scoreboard only",
        "RAL model only",
        "covergroup only",
      ],
      answer: "driver + virtual interface",
    },
    {
      id: "quiz-seq",
      title: "Quiz: sequences",
      type: "quiz",
      prompt: "Hard-coded vector lists become…",
      hint: "Stimulus intent.",
      choices: [
        "sequences feeding a sequencer",
        "only $finish",
        "synthesis constraints",
        "place-and-route scripts",
      ],
      answer: "sequences feeding a sequencer",
    },
    {
      id: "quiz-mon",
      title: "Quiz: monitor",
      type: "quiz",
      prompt: "A $display peek of bus wires maps to…",
      hint: "Passive.",
      choices: [
        "a monitor publishing via analysis ports",
        "the factory alone",
        "objections only",
        "plusargs only",
      ],
      answer: "a monitor publishing via analysis ports",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — UART, pin-drive selected and mapped.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.proto === "uart" &&
        state.selected === "pin-drive" &&
        state.mapped.has("pin-drive"),
    },
    {
      id: "select-check",
      title: "Select check",
      prompt: "Select the inline-expect ↔ scoreboard pair.",
      hint: "Click Check / Scoreboard",
      setup: () => loadStarter(),
      check: () => state.selected === "check",
    },
    {
      id: "mark-check",
      title: "Mark check",
      prompt: "Select check and Mark mapped.",
      hint: "Select check → Mark mapped",
      setup: () => {
        loadStarter();
        selectPair("check");
        markMapped();
      },
      check: () =>
        state.selected === "check" &&
        state.mapped.has("check") &&
        state.lastAction === "mark",
    },
    {
      id: "select-observe",
      title: "Select observe",
      prompt: "Select $display peek ↔ monitor.",
      hint: "Click Observe",
      setup: () => loadStarter(),
      check: () => state.selected === "observe",
    },
    {
      id: "select-structure",
      title: "Select structure",
      prompt: "Select module tb ↔ env/agent.",
      hint: "Click Structure",
      setup: () => loadStarter(),
      check: () => state.selected === "structure",
    },
    {
      id: "select-reuse",
      title: "Select reuse",
      prompt: "Select copy-paste ↔ factory/VIP.",
      hint: "Click Reuse",
      setup: () => loadStarter(),
      check: () => state.selected === "reuse",
    },
    {
      id: "proto-spi",
      title: "SPI vignette",
      prompt: "Switch protocol to SPI and Apply.",
      hint: "Protocol → SPI → Apply",
      setup: () => {
        loadStarter();
        selProto.value = "spi";
        applyProto();
      },
      check: () => state.proto === "spi" && state.lastAction === "proto",
    },
    {
      id: "proto-i2c",
      title: "I²C vignette",
      prompt: "Switch protocol to I²C and Apply.",
      hint: "Protocol → I²C → Apply",
      setup: () => {
        loadStarter();
        selProto.value = "i2c";
        applyProto();
      },
      check: () => state.proto === "i2c" && state.lastAction === "proto",
    },
    {
      id: "map-all",
      title: "Map all",
      prompt: "Click Map all — mapped=6, all=1.",
      hint: "Map all",
      setup: () => {
        loadStarter();
        mapAll();
      },
      check: () => allMapped() && state.lastAction === "map-all",
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo all — demo=1 and all mapped.",
      hint: "Demo all",
      setup: () => loadStarter(),
      check: () => state.demoed && allMapped() && state.lastAction === "demo",
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
      id: "clear",
      title: "Clear",
      prompt: "Clear mapped — mapped=0.",
      hint: "Clear mapped",
      setup: () => {
        loadStarter();
        clearMapped();
      },
      check: () => mappedCount() === 0 && state.lastAction === "clear",
    },
    {
      id: "unmark",
      title: "Unmark",
      prompt: "On starter, Unmark pin-drive — mapped loses pin-drive.",
      hint: "Unmark",
      setup: () => {
        loadStarter();
        unmarkMapped();
      },
      check: () => !state.mapped.has("pin-drive") && state.lastAction === "unmark",
    },
    {
      id: "bridge-text",
      title: "Bridge text",
      prompt: "With pin-drive selected, bridge mentions driver.",
      hint: "Starter already selects pin-drive",
      setup: () => loadStarter(),
      check: () =>
        state.selected === "pin-drive" &&
        /driver/i.test(document.getElementById("bridge-box").textContent),
    },
    {
      id: "sketch",
      title: "Sketch",
      prompt: "Map sketch mentions scoreboard.",
      hint: "Read Map sketch",
      setup: () => loadStarter(),
      check: () => /scoreboard/i.test(sourceCode()),
    },
    {
      id: "stimulus-map",
      title: "Stimulus map",
      prompt: "Select stimulus and Mark mapped.",
      hint: "stimulus → Mark",
      setup: () => {
        loadStarter();
        selectPair("stimulus");
        markMapped();
      },
      check: () => state.mapped.has("stimulus") && state.selected === "stimulus",
    },
    {
      id: "uart-vig",
      title: "UART vignette",
      prompt: "UART + pin-drive vignette mentions baud or tx.",
      hint: "Starter UART",
      setup: () => loadStarter(),
      check: () =>
        state.proto === "uart" &&
        /baud|tx/i.test(document.getElementById("bridge-box").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to starter (pin-drive mapped).",
      hint: "Reset",
      setup: () => {
        mapAll();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return (
          state.proto === "uart" &&
          state.selected === "pin-drive" &&
          state.mapped.has("pin-drive") &&
          mappedCount() === 1
        );
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="tvm-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("tvm-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-apply-proto").addEventListener("click", () => applyProto());
  document.getElementById("btn-mark").addEventListener("click", () => markMapped());
  document.getElementById("btn-unmark").addEventListener("click", () => unmarkMapped());
  document.getElementById("btn-map-all").addEventListener("click", () => mapAll());
  document.getElementById("btn-clear").addEventListener("click", () => clearMapped());
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

  loadStarter();
})();
