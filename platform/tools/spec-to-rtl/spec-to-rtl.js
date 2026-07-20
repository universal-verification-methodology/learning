(() => {
  /**
   * Spec → RTL checklist (concept)
   *   Pick UART / SPI / I2C mini-spec
   *   Check off ports → params → blocks → timing notes
   *   Skeleton module grows as items are checked
   * Starter: UART TX — clk/rst + bus ports + BAUD_DIV checked
   */

  /** @typedef {"uart"|"spi"|"i2c"} SpecId */

  const SPECS = {
    uart: {
      title: "UART TX (8N1)",
      module: "uart_tx",
      bullets: [
        "8 data bits, no parity, 1 stop bit",
        "Master-side TX: serialize tx_data when tx_valid",
        "Busy until frame complete; sample at baud rate",
      ],
      required: ["ports-clk", "ports-bus", "param-baud", "block-baud", "block-shifter", "block-fsm"],
      items: [
        {
          id: "ports-clk",
          label: "Clock + reset ports",
          tag: "ports",
          hint: "clk, active-low rst_n",
          skel: "  input  logic       clk,\n  input  logic       rst_n,",
        },
        {
          id: "ports-bus",
          label: "Host + line ports",
          tag: "ports",
          hint: "tx, tx_valid, tx_busy",
          skel: "  input  logic       tx_valid,\n  input  logic [7:0] tx_data,\n  output logic       tx,\n  output logic       tx_busy,",
        },
        {
          id: "param-baud",
          label: "Baud parameter / divider",
          tag: "params",
          hint: "BAUD_DIV from f_clk / baud",
          skel: "  parameter int BAUD_DIV = 434;  // e.g. 50MHz / 115200",
        },
        {
          id: "block-baud",
          label: "Block: baud_gen",
          tag: "blocks",
          hint: "tick every BAUD_DIV cycles",
          skel: "  // baud_gen → baud_tick",
          block: "baud_gen",
        },
        {
          id: "block-shifter",
          label: "Block: shift / serializer",
          tag: "blocks",
          hint: "load parallel, shift LSB first",
          skel: "  // shifter: load tx_data, shift on baud_tick",
          block: "shifter",
        },
        {
          id: "block-fsm",
          label: "Block: byte FSM",
          tag: "blocks",
          hint: "idle → start → 8 data → stop",
          skel: "  // fsm: IDLE | START | DATA | STOP",
          block: "byte_fsm",
        },
        {
          id: "timing-8n1",
          label: "Timing note: 8N1 frame",
          tag: "timing",
          hint: "start=0, data MSB..LSB or LSB per spec, stop=1",
          skel: "  // frame: start(0) + 8 data + stop(1)",
        },
        {
          id: "tb-stimulus",
          label: "TB hook: valid/ready style",
          tag: "tb",
          hint: "drive tx_valid when not tx_busy",
          skel: "  // TB: wait !tx_busy; assert tx_valid + data",
        },
      ],
    },
    spi: {
      title: "SPI master (mode 0)",
      module: "spi_master",
      bullets: [
        "Mode 0: CPOL=0 CPHA=0 — sample ↑, change ↓",
        "CS active-low; MSB first full duplex",
        "One byte per CS assertion",
      ],
      required: ["ports-clk", "ports-spi", "param-mode", "block-shifter", "block-cs", "block-fsm"],
      items: [
        {
          id: "ports-clk",
          label: "Clock + reset ports",
          tag: "ports",
          hint: "clk, rst_n",
          skel: "  input  logic       clk,\n  input  logic       rst_n,",
        },
        {
          id: "ports-spi",
          label: "SPI pins + host",
          tag: "ports",
          hint: "sclk, mosi, miso, cs_n + start/done",
          skel:
            "  output logic       sclk,\n  output logic       mosi,\n  input  logic       miso,\n  output logic       cs_n,\n  input  logic       start,\n  input  logic [7:0] tx_data,\n  output logic [7:0] rx_data,\n  output logic       busy,",
        },
        {
          id: "param-mode",
          label: "Mode parameters",
          tag: "params",
          hint: "CPOL, CPHA or MODE=0",
          skel: "  parameter bit CPOL = 0, CPHA = 0;",
        },
        {
          id: "block-shifter",
          label: "Block: shift register",
          tag: "blocks",
          hint: "8-bit TX/RX shift",
          skel: "  // shifter: MOSI out, MISO in each edge",
          block: "shifter",
        },
        {
          id: "block-cs",
          label: "Block: CS controller",
          tag: "blocks",
          hint: "assert cs_n for one byte",
          skel: "  // cs_ctrl: cs_n low during transfer",
          block: "cs_ctrl",
        },
        {
          id: "block-fsm",
          label: "Block: bit/byte FSM",
          tag: "blocks",
          hint: "bit counter 7..0",
          skel: "  // fsm: IDLE | SHIFT | DONE",
          block: "bit_fsm",
        },
        {
          id: "timing-mode0",
          label: "Timing note: mode 0 edges",
          tag: "timing",
          hint: "sample rising, change falling",
          skel: "  // mode0: sample ↑ change ↓",
        },
        {
          id: "tb-stimulus",
          label: "TB hook: start pulse",
          tag: "tb",
          hint: "pulse start, wait !busy",
          skel: "  // TB: start=1; wait busy==0; check rx_data",
        },
      ],
    },
    i2c: {
      title: "I²C master (byte write)",
      module: "i2c_master",
      bullets: [
        "Open-drain SCL/SDA + pull-ups",
        "START → addr+W → data → STOP",
        "Slave ACK on 9th bit of each byte",
      ],
      required: ["ports-clk", "ports-i2c", "note-od", "block-bit", "block-fsm", "timing-start-stop"],
      items: [
        {
          id: "ports-clk",
          label: "Clock + reset ports",
          tag: "ports",
          hint: "clk, rst_n",
          skel: "  input  logic       clk,\n  input  logic       rst_n,",
        },
        {
          id: "ports-i2c",
          label: "Open-drain bus + host",
          tag: "ports",
          hint: "scl_o/scl_oe, sda_o/sda_oe + i",
          skel:
            "  output logic       scl_o, sda_o,\n  output logic       scl_oe, sda_oe,\n  input  logic       scl_i, sda_i,\n  input  logic       start,\n  input  logic [6:0] addr,\n  input  logic [7:0] wr_data,\n  output logic       busy,",
        },
        {
          id: "note-od",
          label: "Open-drain model noted",
          tag: "params",
          hint: "drive 0 or release; wired-AND on bus",
          skel: "  // open-drain: oe=1 pulls low; wire = i when released",
        },
        {
          id: "block-bit",
          label: "Block: bit banger / shift",
          tag: "blocks",
          hint: "SCL toggle + SDA setup/hold",
          skel: "  // bit_engine: toggle SCL, set SDA",
          block: "bit_engine",
        },
        {
          id: "block-fsm",
          label: "Block: transaction FSM",
          tag: "blocks",
          hint: "START | ADDR | DATA | STOP",
          skel: "  // fsm: IDLE | START | ADDR | ACK | DATA | STOP",
          block: "txn_fsm",
        },
        {
          id: "timing-start-stop",
          label: "Timing: START / STOP",
          tag: "timing",
          hint: "SDA edge while SCL=1",
          skel: "  // START: SDA↓ SCL=1; STOP: SDA↑ SCL=1",
        },
        {
          id: "timing-ack",
          label: "Timing: ACK bit",
          tag: "timing",
          hint: "slave pulls SDA=0 on 9th clock",
          skel: "  // ACK: release SDA; sample slave pull-low",
        },
        {
          id: "tb-stimulus",
          label: "TB hook: start + addr",
          tag: "tb",
          hint: "drive start; wait busy",
          skel: "  // TB: start + addr + wr_data; wait !busy",
        },
      ],
    },
  };

  function sourceCode() {
    return `// Spec → RTL workflow (concept)
// 1) Read spec → list ports (clk/rst/bus)
// 2) Parameters (baud, mode, addr width)
// 3) Block diagram (gen, shifter, FSM)
// 4) Stub module + // TODO per block
// 5) Then implement bit-level logic + TB`;
  }

  function makeStarter() {
    return {
      spec: "uart",
      checked: new Set(["ports-clk", "ports-bus", "param-baud"]),
      lastAction: "starter",
      explained: false,
      demoed: false,
      rebuilt: false,
      generated: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-spec-to-rtl-cleared-v1";
  const STORE_KEY = "ddv-spec-to-rtl-session-v1";

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

  const root = document.getElementById("str-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>UART TX</strong> spec with
        clock/reset, bus ports, and <code>BAUD_DIV</code> already checked.
        Add blocks and click <em>Generate skeleton</em>.</p>
      <button type="button" class="btn btn-secondary" id="str-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Ports first</h3><p>clk/rst + bus-facing pins before logic.</p></div>
        <div class="idea-card"><h3>Parameters</h3><p>Baud, mode, widths from the spec.</p></div>
        <div class="idea-card"><h3>Blocks</h3><p>Name generators, shifters, FSMs on paper.</p></div>
        <div class="idea-card"><h3>Skeleton</h3><p>Stub module + TODO — not finished RTL.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="str-controls">
        <div class="str-field">
          <label for="sel-spec">Spec preset</label>
          <select id="sel-spec">
            <option value="uart" selected>UART TX (8N1)</option>
            <option value="spi">SPI master (mode 0)</option>
            <option value="i2c">I²C master (byte write)</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Load spec</button>
        <button type="button" class="btn btn-ghost" id="btn-check-all-req">Check required</button>
        <button type="button" class="btn btn-ghost" id="btn-clear">Clear all</button>
        <button type="button" class="btn btn-secondary" id="btn-generate">Generate skeleton</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo UART skeleton</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset checks</button>
      </div>
      <div class="str-layout">
        <div>
          <div class="spec-box" id="spec-box"></div>
          <ul class="checklist" id="checklist"></ul>
        </div>
        <div>
          <div id="verdict" class="verdict idle">Idle</div>
          <div class="flag-row" id="flag-row"></div>
          <h3 style="margin:0.5rem 0 0.35rem;font-size:0.95rem">Block list</h3>
          <ul class="block-list" id="block-list"></ul>
          <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">RTL skeleton</h3>
          <pre class="code-box" id="skeleton-box">// check items, then Generate skeleton</pre>
          <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Workflow sketch</h3>
          <pre class="code-box" id="code-box"></pre>
        </div>
      </div>
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

  const selSpec = /** @type {HTMLSelectElement} */ (document.getElementById("sel-spec"));

  function spec() {
    return SPECS[state.spec];
  }

  function checkedCount() {
    return state.checked.size;
  }

  function requiredDone() {
    const s = spec();
    return s.required.every((id) => state.checked.has(id));
  }

  function blocksListed() {
    return spec()
      .items.filter((it) => it.block && state.checked.has(it.id))
      .map((it) => it.block);
  }

  function buildSkeletonPretty() {
    const s = spec();
    const portItems = s.items.filter((it) => it.tag === "ports" && state.checked.has(it.id));
    const other = s.items.filter((it) => it.tag !== "ports" && state.checked.has(it.id));
    const portLines = portItems.flatMap((it) => it.skel.split("\n"));
    if (!portLines.length && !other.length) return "// check items first";
    let header;
    if (portLines.length) {
      const lines = [...portLines];
      lines[lines.length - 1] = lines[lines.length - 1].replace(/,\s*$/, "");
      header = `module ${s.module} (\n${lines.join("\n")}\n);`;
    } else {
      header = `module ${s.module} ();`;
    }
    const body = other.map((it) => it.skel).join("\n\n");
    return `${header}\n\n${body}\n\n  // TODO: implement\nendmodule`;
  }

  function syncInputs() {
    selSpec.value = state.spec;
  }

  function readInputs() {
    state.spec = selSpec.value in SPECS ? selSpec.value : "uart";
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
    pushLog("# starter UART — ports + BAUD_DIV");
    pushTrace("checked=3 required pending");
    renderAll();
  }

  function rebuild() {
    readInputs();
    state.checked = new Set();
    state.rebuilt = true;
    state.lastAction = "rebuild";
    state.generated = false;
    pushLog(`# load spec ${state.spec}`);
    renderAll();
  }

  function toggleItem(id, on) {
    if (on) state.checked.add(id);
    else state.checked.delete(id);
    state.lastAction = "toggle";
    pushTrace(`check ${id}=${on ? 1 : 0}`);
    renderAll();
  }

  function checkRequired() {
    const s = spec();
    s.required.forEach((id) => state.checked.add(id));
    state.lastAction = "check-req";
    pushLog("# check all required");
    renderAll();
  }

  function clearAll() {
    state.checked = new Set();
    state.generated = false;
    state.lastAction = "clear";
    pushLog("# clear all");
    renderAll();
  }

  function generate() {
    state.generated = true;
    state.lastAction = "generate";
    pushLog(`# generate skeleton ${spec().module}`);
    pushTrace(`blocks=[${blocksListed().join(", ")}]`);
    renderAll();
  }

  function demo() {
    state = makeStarter();
    syncInputs();
    checkRequired();
    generate();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo UART full skeleton");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Read the spec → checklist ports, parameters, named blocks, timing notes → stub module. " +
        "Skeleton is structure only; implementation comes after the block diagram matches the spec."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const s = spec();
    const req = requiredDone();
    const blocks = blocksListed();

    document.getElementById("spec-box").innerHTML = `
      <h3>${s.title}</h3>
      <ul>${s.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;

    const list = document.getElementById("checklist");
    list.innerHTML = "";
    s.items.forEach((it) => {
      const li = document.createElement("li");
      const on = state.checked.has(it.id);
      if (on) li.className = "is-done";
      li.innerHTML = `
        <input type="checkbox" id="chk-${it.id}" ${on ? "checked" : ""}>
        <div><strong>${it.label}</strong><span class="tag">${it.tag}${it.block ? " · " + it.block : ""}</span></div>`;
      li.querySelector("input").addEventListener("change", (e) => {
        toggleItem(it.id, /** @type {HTMLInputElement} */ (e.target).checked);
      });
      list.appendChild(li);
    });

    const v = document.getElementById("verdict");
    if (state.generated && req) {
      v.className = "verdict yes";
      v.textContent = `Skeleton ready · ${s.module} · ${checkedCount()}/${s.items.length} checked · ${blocks.length} blocks`;
    } else if (req) {
      v.className = "verdict idle";
      v.textContent = `Required done · ${checkedCount()} checked — click Generate skeleton`;
    } else {
      v.className = "verdict idle";
      v.textContent = `${checkedCount()}/${s.items.length} checked · required ${s.required.filter((id) => state.checked.has(id)).length}/${s.required.length}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.spec}</span>
      <span class="flag">checked=${checkedCount()}</span>
      <span class="flag ${req ? "is-ok" : ""}">required=${req ? "OK" : "…"}</span>
      <span class="flag ${blocks.length ? "is-on" : ""}">blocks=${blocks.length}</span>
      <span class="flag ${state.generated ? "is-ok" : ""}">generated=${state.generated ? 1 : 0}</span>
    `;

    document.getElementById("block-list").innerHTML = blocks.length
      ? blocks.map((b) => `<li>${b}</li>`).join("")
      : "<li style=\"color:var(--muted)\">— check block items —</li>";

    document.getElementById("skeleton-box").textContent = state.generated
      ? buildSkeletonPretty()
      : checkedCount()
        ? "// click Generate skeleton\n" + buildSkeletonPretty().split("\n").slice(0, 6).join("\n") + "\n// ..."
        : "// check items, then Generate skeleton";

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
          spec: state.spec,
          checked: [...state.checked],
          generated: state.generated,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-order",
      title: "Quiz: order",
      type: "quiz",
      prompt: "Spec → RTL usually starts with…",
      hint: "Before FSM details.",
      choices: [
        "ports and block diagram from the spec",
        "random testbench first",
        "synthesis constraints only",
        "VIP agents before ports",
      ],
      answer: "ports and block diagram from the spec",
    },
    {
      id: "quiz-skeleton",
      title: "Quiz: skeleton",
      type: "quiz",
      prompt: "An RTL skeleton is…",
      hint: "Not done chip.",
      choices: [
        "stub module + named blocks/TODO — not finished logic",
        "placed-and-routed netlist",
        "UVM scoreboard only",
        "waveform dump file",
      ],
      answer: "stub module + named blocks/TODO — not finished logic",
    },
    {
      id: "quiz-baud",
      title: "Quiz: UART param",
      type: "quiz",
      prompt: "UART baud from f_clk usually becomes…",
      hint: "Divider.",
      choices: [
        "a BAUD_DIV (or equivalent) parameter",
        "only a comment",
        "SDA pull-up value",
        "SPI CPOL bit",
      ],
      answer: "a BAUD_DIV (or equivalent) parameter",
    },
    {
      id: "quiz-i2c",
      title: "Quiz: I²C note",
      type: "quiz",
      prompt: "I²C spec checklist should note…",
      hint: "Bus electrical model.",
      choices: [
        "open-drain + pull-ups on SCL/SDA",
        "push-pull only on SDA",
        "CS active-high",
        "16× oversampling only",
      ],
      answer: "open-drain + pull-ups on SCL/SDA",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — UART with 3 items checked.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.spec === "uart" &&
        state.checked.has("ports-clk") &&
        state.checked.has("ports-bus") &&
        state.checked.has("param-baud"),
    },
    {
      id: "toggle-fsm",
      title: "Check FSM block",
      prompt: "Check the byte FSM block item.",
      hint: "Checklist → Block: byte FSM",
      setup: () => loadStarter(),
      check: () => state.checked.has("block-fsm"),
    },
    {
      id: "see-blocks",
      title: "Two blocks",
      prompt: "Check baud_gen + shifter — block list shows both.",
      hint: "Check block-baud and block-shifter",
      setup: () => loadStarter(),
      check: () => {
        state.checked.add("block-baud");
        state.checked.add("block-shifter");
        const b = blocksListed();
        return b.includes("baud_gen") && b.includes("shifter");
      },
    },
    {
      id: "required-done",
      title: "Required done",
      prompt: "Click Check required on UART — required=OK.",
      hint: "Check required button",
      setup: () => loadStarter(),
      check: () => state.lastAction === "check-req" && requiredDone(),
    },
    {
      id: "generate",
      title: "Generate",
      prompt: "Generate skeleton with required checked — generated=1.",
      hint: "Check required → Generate",
      setup: () => {
        loadStarter();
        checkRequired();
        generate();
      },
      check: () => state.generated && requiredDone() && state.lastAction === "generate",
    },
    {
      id: "skel-module",
      title: "Module name",
      prompt: "Generated UART skeleton contains module uart_tx.",
      hint: "Generate after required",
      setup: () => {
        loadStarter();
        checkRequired();
        generate();
      },
      check: () => /module uart_tx/.test(document.getElementById("skeleton-box").textContent),
    },
    {
      id: "switch-spi",
      title: "SPI spec",
      prompt: "Switch preset to SPI master and Load spec.",
      hint: "Spec → SPI, Load spec",
      setup: () => {
        loadStarter();
        state.spec = "spi";
        syncInputs();
        rebuild();
      },
      check: () => state.spec === "spi" && state.checked.size === 0,
    },
    {
      id: "spi-cs",
      title: "SPI CS block",
      prompt: "On SPI: check CS controller — block list includes cs_ctrl.",
      hint: "Check block-cs",
      setup: () => {
        loadStarter();
        state.spec = "spi";
        syncInputs();
        rebuild();
      },
      check: () => {
        state.checked.add("block-cs");
        return blocksListed().includes("cs_ctrl");
      },
    },
    {
      id: "switch-i2c",
      title: "I²C spec",
      prompt: "Switch to I²C master preset and Load spec.",
      hint: "Spec → I²C",
      setup: () => {
        loadStarter();
        state.spec = "i2c";
        syncInputs();
        rebuild();
      },
      check: () => state.spec === "i2c" && state.checked.size === 0,
    },
    {
      id: "i2c-od",
      title: "I²C open-drain",
      prompt: "I²C: check open-drain note item.",
      hint: "Check note-od",
      setup: () => {
        loadStarter();
        state.spec = "i2c";
        syncInputs();
        rebuild();
      },
      check: () => state.checked.has("note-od"),
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo UART skeleton.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.generated && state.spec === "uart",
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
      prompt: "Clear all — checked=0.",
      hint: "Clear all",
      setup: () => {
        loadStarter();
        clearAll();
      },
      check: () => state.checked.size === 0 && state.lastAction === "clear",
    },
    {
      id: "timing-note",
      title: "Timing note",
      prompt: "UART: check 8N1 timing note.",
      hint: "timing-8n1",
      setup: () => loadStarter(),
      check: () => state.checked.has("timing-8n1"),
    },
    {
      id: "sketch",
      title: "Sketch",
      prompt: "Workflow sketch mentions block diagram.",
      hint: "Read Workflow sketch",
      setup: () => loadStarter(),
      check: () => /block diagram/i.test(sourceCode()),
    },
    {
      id: "count-6",
      title: "Six checked",
      prompt: "UART: Check required — at least 6 items checked.",
      hint: "Check required",
      setup: () => loadStarter(),
      check: () => requiredDone() && checkedCount() >= 6,
    },
    {
      id: "reset-checks",
      title: "Reset checks",
      prompt: "Reset checks — back to starter 3 items.",
      hint: "Reset checks",
      setup: () => {
        loadStarter();
        checkRequired();
      },
      check: () => {
        loadStarter();
        return state.checked.size === 3 && state.lastAction === "starter";
      },
    },
    {
      id: "i2c-skel",
      title: "I²C skeleton",
      prompt: "I²C: check required + Generate — module i2c_master.",
      hint: "I²C preset",
      setup: () => {
        loadStarter();
        state.spec = "i2c";
        syncInputs();
        rebuild();
        checkRequired();
        generate();
      },
      check: () =>
        state.spec === "i2c" &&
        state.generated &&
        /module i2c_master/.test(document.getElementById("skeleton-box").textContent),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="str-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("str-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-rebuild").addEventListener("click", () => rebuild());
  document.getElementById("btn-check-all-req").addEventListener("click", () => checkRequired());
  document.getElementById("btn-clear").addEventListener("click", () => clearAll());
  document.getElementById("btn-generate").addEventListener("click", () => generate());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset checks");
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
