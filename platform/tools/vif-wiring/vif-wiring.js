(() => {
  /**
   * Virtual interface wiring (concept)
   *   Checklist: declare IF → instance → DUT connect → virtual in class → drive
   * Starter: UART bus_if with declare + instance + DUT already checked
   */

  /** @typedef {"uart"|"spi"} ProtoId */

  const STEPS = [
    {
      id: "declare",
      label: "Declare interface",
      blurb: "interface bus_if(input logic clk); … endinterface",
      node: "if-decl",
    },
    {
      id: "instance",
      label: "Instantiate in TB",
      blurb: "bus_if bif(.clk(clk)); in the testbench module",
      node: "if-inst",
    },
    {
      id: "dut",
      label: "Connect DUT ports",
      blurb: "dut(.clk(bif.clk), .tx(bif.tx), …) or modport",
      node: "dut",
    },
    {
      id: "virtual",
      label: "Virtual handle in class",
      blurb: "virtual bus_if vif; inside driver / monitor",
      node: "class",
    },
    {
      id: "assign",
      label: "Assign / ConfigDB set",
      blurb: "drv.vif = bif; or uvm_config_db#(virtual bus_if)::set(…)",
      node: "assign",
    },
    {
      id: "drive",
      label: "Drive / sample via vif",
      blurb: "vif.tx <= 1'b0; @(posedge vif.clk);",
      node: "drive",
    },
  ];

  const PROTOS = {
    uart: {
      title: "UART bus_if",
      ifName: "uart_if",
      signals: ["clk", "tx", "rx"],
      dut: "uart_tx",
      className: "uart_driver",
      code: (done) => {
        const lines = [];
        if (done.has("declare")) {
          lines.push("interface uart_if(input logic clk);");
          lines.push("  logic tx, rx;");
          lines.push("endinterface");
          lines.push("");
        }
        if (done.has("instance") || done.has("dut") || done.has("assign")) {
          lines.push("module tb;");
          lines.push("  logic clk;");
          if (done.has("instance")) lines.push("  uart_if bif(.clk(clk));");
          if (done.has("dut"))
            lines.push("  uart_tx dut(.clk(bif.clk), .tx(bif.tx));");
          lines.push("  // …");
          lines.push("endmodule");
          lines.push("");
        }
        if (done.has("virtual") || done.has("assign") || done.has("drive")) {
          lines.push("class uart_driver;");
          if (done.has("virtual") || done.has("assign") || done.has("drive"))
            lines.push("  virtual uart_if vif;");
          if (done.has("drive")) {
            lines.push("  task drive_bit(bit v);");
            lines.push("    @(posedge vif.clk);");
            lines.push("    vif.tx <= v;");
            lines.push("  endtask");
          }
          lines.push("endclass");
        }
        if (done.has("assign")) {
          lines.push("");
          lines.push("// TB or build_phase:");
          lines.push("// drv.vif = bif;  // or config_db set/get");
        }
        return lines.length ? lines.join("\n") : "// check wiring steps";
      },
    },
    spi: {
      title: "SPI bus_if",
      ifName: "spi_if",
      signals: ["clk", "sclk", "mosi", "miso", "cs_n"],
      dut: "spi_master",
      className: "spi_driver",
      code: (done) => {
        const lines = [];
        if (done.has("declare")) {
          lines.push("interface spi_if(input logic clk);");
          lines.push("  logic sclk, mosi, miso, cs_n;");
          lines.push("endinterface");
          lines.push("");
        }
        if (done.has("instance") || done.has("dut")) {
          lines.push("module tb;");
          lines.push("  logic clk;");
          if (done.has("instance")) lines.push("  spi_if bif(.clk(clk));");
          if (done.has("dut"))
            lines.push(
              "  spi_master dut(.clk(bif.clk), .sclk(bif.sclk), .mosi(bif.mosi), .miso(bif.miso), .cs_n(bif.cs_n));"
            );
          lines.push("endmodule");
          lines.push("");
        }
        if (done.has("virtual") || done.has("assign") || done.has("drive")) {
          lines.push("class spi_driver;");
          lines.push("  virtual spi_if vif;");
          if (done.has("drive")) {
            lines.push("  task xfer(bit [7:0] d);");
            lines.push("    vif.cs_n <= 0;");
            lines.push("    // … shift on vif.sclk");
            lines.push("  endtask");
          }
          lines.push("endclass");
        }
        if (done.has("assign")) {
          lines.push("");
          lines.push("// drv.vif = bif;");
        }
        return lines.length ? lines.join("\n") : "// check wiring steps";
      },
    },
  };

  const REQUIRED = ["declare", "instance", "dut", "virtual", "assign"];

  function sourceSketch() {
    return `// Virtual interface wiring (diagram only)
// 1) interface + signals (+ optional modports)
// 2) instantiate interface in the TB module
// 3) connect DUT ports to the interface instance
// 4) class holds: virtual if_type vif;
// 5) assign handle (direct or config_db)
// 6) drive/sample through vif — never synthesize virtual`;
  }

  function makeStarter() {
    return {
      proto: "uart",
      checked: new Set(["declare", "instance", "dut"]),
      selected: "dut",
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-vif-wiring-cleared-v1";
  const STORE_KEY = "ddv-vif-wiring-session-v1";

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

  const root = document.getElementById("vif-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> UART <code>uart_if</code> with
        declare, instance, and DUT connect already checked. Add virtual + assign.</p>
      <button type="button" class="btn btn-secondary" id="vif-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Interface</h3><p>Bundles related DUT signals in one type.</p></div>
        <div class="idea-card"><h3>Instance</h3><p>Lives in the TB module next to the DUT.</p></div>
        <div class="idea-card"><h3>virtual</h3><p>Class handle that points at an IF instance.</p></div>
        <div class="idea-card"><h3>Assign</h3><p>Wire the handle (or ConfigDB set/get).</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vif-controls">
        <div class="vif-field">
          <label for="sel-proto">Protocol sketch</label>
          <select id="sel-proto">
            <option value="uart" selected>UART uart_if</option>
            <option value="spi">SPI spi_if</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load protocol</button>
        <button type="button" class="btn btn-ghost" id="btn-req">Check required</button>
        <button type="button" class="btn btn-ghost" id="btn-clear">Clear all</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo full wire</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vif-layout">
        <div class="panel-box">
          <h3>Wiring checklist</h3>
          <ul class="wire-list" id="wire-list"></ul>
        </div>
        <div class="panel-box">
          <h3>Connection diagram</h3>
          <div class="diagram" id="diagram"></div>
          <h3 style="margin:0.75rem 0 0.35rem;font-size:0.9rem">Code sketch</h3>
          <pre class="sketch-code" id="sketch-box"></pre>
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

  const selProto = /** @type {HTMLSelectElement} */ (document.getElementById("sel-proto"));

  function proto() {
    return PROTOS[state.proto] || PROTOS.uart;
  }

  function checkedCount() {
    return state.checked.size;
  }

  function requiredDone() {
    return REQUIRED.every((id) => state.checked.has(id));
  }

  function syncInputs() {
    selProto.value = state.proto;
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
    pushLog("# starter uart 3 steps");
    pushTrace("checked=declare,instance,dut");
    renderAll();
  }

  function loadProto() {
    state.proto = selProto.value in PROTOS ? selProto.value : "uart";
    state.checked = new Set();
    state.selected = "declare";
    state.lastAction = "load";
    pushLog(`# load ${state.proto}`);
    renderAll();
  }

  function toggleStep(id, on) {
    if (on) state.checked.add(id);
    else state.checked.delete(id);
    state.selected = id;
    state.lastAction = "toggle";
    pushTrace(`check ${id}=${on ? 1 : 0}`);
    renderAll();
  }

  function selectStep(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function checkRequired() {
    REQUIRED.forEach((id) => state.checked.add(id));
    state.lastAction = "check-req";
    pushLog("# check required");
    renderAll();
  }

  function clearAll() {
    state.checked = new Set();
    state.lastAction = "clear";
    pushLog("# clear");
    renderAll();
  }

  function demo() {
    state = makeStarter();
    STEPS.forEach((s) => state.checked.add(s.id));
    state.selected = "drive";
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo full wire");
    pushTrace("all 6 steps checked");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "An interface instance sits in the TB beside the DUT. Classes cannot touch " +
        "module ports directly — they hold a virtual interface handle assigned to that instance."
    );
    pushLog("# explain");
    renderAll();
  }

  function nodeOn(nodeId) {
    const step = STEPS.find((s) => s.node === nodeId);
    return step ? state.checked.has(step.id) : false;
  }

  function renderLab() {
    syncInputs();
    const p = proto();

    const list = document.getElementById("wire-list");
    list.innerHTML = "";
    STEPS.forEach((st) => {
      const on = state.checked.has(st.id);
      const li = document.createElement("label");
      li.className =
        "wire-item" + (on ? " is-done" : "") + (state.selected === st.id ? " is-sel" : "");
      li.innerHTML = `
        <input type="checkbox" ${on ? "checked" : ""}>
        <div><strong>${st.label}</strong><span class="blurb">${st.blurb}</span></div>`;
      const inp = li.querySelector("input");
      inp.addEventListener("change", (e) => {
        toggleStep(st.id, /** @type {HTMLInputElement} */ (e.target).checked);
      });
      li.addEventListener("click", (e) => {
        if (e.target !== inp) selectStep(st.id);
      });
      list.appendChild(li);
    });

    const nodes = [
      {
        id: "if-decl",
        title: `interface ${p.ifName}`,
        meta: p.signals.join(", "),
      },
      { id: "if-inst", title: `${p.ifName} bif`, meta: "TB instance" },
      { id: "dut", title: `${p.dut} dut`, meta: "ports ← bif.*" },
      {
        id: "class",
        title: `class ${p.className}`,
        meta: `virtual ${p.ifName} vif`,
      },
      { id: "assign", title: "assign handle", meta: "drv.vif = bif" },
      { id: "drive", title: "drive / sample", meta: "via vif.signals" },
    ];

    const diag = document.getElementById("diagram");
    diag.innerHTML = nodes
      .map((n, i) => {
        const on = nodeOn(n.id);
        const arrow =
          i < nodes.length - 1
            ? `<div class="arrow">${on && nodeOn(nodes[i + 1].id) ? "↓ wired" : "↓"}</div>`
            : "";
        return `<div class="node ${on ? "is-on" : "is-missing"}"><div class="title">${n.title}</div><div class="meta">${n.meta}</div></div>${arrow}`;
      })
      .join("");

    document.getElementById("sketch-box").textContent = p.code(state.checked);

    const req = requiredDone();
    const v = document.getElementById("verdict");
    if (req && state.checked.has("drive")) {
      v.className = "verdict yes";
      v.textContent = `${p.title} · full path wired · ${checkedCount()}/6 steps`;
    } else if (req) {
      v.className = "verdict yes";
      v.textContent = `${p.title} · required done — optional: check Drive/sample`;
    } else {
      v.className = "verdict idle";
      v.textContent = `${p.title} · ${checkedCount()}/6 · required ${REQUIRED.filter((id) => state.checked.has(id)).length}/${REQUIRED.length}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.proto}</span>
      <span class="flag is-on">sel=${state.selected}</span>
      <span class="flag ${checkedCount() ? "is-ok" : ""}">wired=${checkedCount()}</span>
      <span class="flag ${req ? "is-ok" : ""}">required=${req ? "OK" : "…"}</span>
      <span class="flag ${state.checked.has("virtual") ? "is-ok" : ""}">virtual=${state.checked.has("virtual") ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    document.getElementById("code-box").textContent = sourceSketch();
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
          checked: [...state.checked],
          selected: state.selected,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-why",
      title: "Quiz: why virtual",
      type: "quiz",
      prompt: "Classes use a virtual interface because…",
      hint: "Class vs module.",
      choices: [
        "class objects cannot connect to module ports like a DUT instance",
        "synthesis requires virtual in every RTL module",
        "VCD dump only works with virtual",
        "objections need a virtual clock",
      ],
      answer: "class objects cannot connect to module ports like a DUT instance",
    },
    {
      id: "quiz-where",
      title: "Quiz: instance",
      type: "quiz",
      prompt: "The concrete interface instance usually lives…",
      hint: "TB module.",
      choices: [
        "in the testbench module beside the DUT",
        "inside a synthesizable always_ff only",
        "in the SDF file",
        "in the bitstream",
      ],
      answer: "in the testbench module beside the DUT",
    },
    {
      id: "quiz-assign",
      title: "Quiz: assign",
      type: "quiz",
      prompt: "drv.vif = bif assigns…",
      hint: "Handle.",
      choices: [
        "the driver’s virtual handle to the TB interface instance",
        "a new DUT netlist",
        "the factory override type",
        "coverage bins",
      ],
      answer: "the driver’s virtual handle to the TB interface instance",
    },
    {
      id: "quiz-synth",
      title: "Quiz: synth",
      type: "quiz",
      prompt: "Virtual interfaces are…",
      hint: "TB construct.",
      choices: [
        "simulation / TB constructs — not for synthesizable RTL",
        "required in every FPGA top",
        "the same as generate blocks",
        "only legal in always_comb",
      ],
      answer: "simulation / TB constructs — not for synthesizable RTL",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — uart with declare+instance+dut.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.proto === "uart" &&
        state.checked.has("declare") &&
        state.checked.has("instance") &&
        state.checked.has("dut"),
    },
    {
      id: "check-virtual",
      title: "Check virtual",
      prompt: "Check Virtual handle in class.",
      hint: "Checklist → Virtual handle",
      setup: () => loadStarter(),
      check: () => state.checked.has("virtual"),
    },
    {
      id: "check-assign",
      title: "Check assign",
      prompt: "Check Assign / ConfigDB set.",
      hint: "Checklist → Assign",
      setup: () => loadStarter(),
      check: () => state.checked.has("assign"),
    },
    {
      id: "required",
      title: "Check required",
      prompt: "Click Check required — required=OK.",
      hint: "Check required",
      setup: () => {
        loadStarter();
        checkRequired();
      },
      check: () => requiredDone() && state.lastAction === "check-req",
    },
    {
      id: "check-drive",
      title: "Check drive",
      prompt: "Check Drive / sample via vif.",
      hint: "Drive step",
      setup: () => {
        loadStarter();
        checkRequired();
      },
      check: () => state.checked.has("drive"),
    },
    {
      id: "load-spi",
      title: "SPI protocol",
      prompt: "Switch to SPI and Load protocol.",
      hint: "SPI → Load",
      setup: () => {
        loadStarter();
        selProto.value = "spi";
        loadProto();
      },
      check: () => state.proto === "spi" && state.checked.size === 0 && state.lastAction === "load",
    },
    {
      id: "spi-declare",
      title: "SPI declare",
      prompt: "On SPI, check Declare — sketch shows spi_if.",
      hint: "Load SPI, check Declare",
      setup: () => {
        selProto.value = "spi";
        loadProto();
        state.checked.add("declare");
        state.lastAction = "toggle";
        renderAll();
      },
      check: () =>
        state.proto === "spi" &&
        state.checked.has("declare") &&
        /interface spi_if/.test(document.getElementById("sketch-box").textContent),
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo full wire — wired=6.",
      hint: "Demo full wire",
      setup: () => loadStarter(),
      check: () => state.demoed && checkedCount() === 6 && state.lastAction === "demo",
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
      prompt: "Clear all — wired=0.",
      hint: "Clear all",
      setup: () => {
        loadStarter();
        clearAll();
      },
      check: () => checkedCount() === 0 && state.lastAction === "clear",
    },
    {
      id: "sketch-uart",
      title: "UART sketch",
      prompt: "Starter sketch mentions uart_if or uart_tx.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /uart_if|uart_tx/.test(document.getElementById("sketch-box").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions virtual.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /virtual/i.test(sourceSketch()),
    },
    {
      id: "select-assign",
      title: "Select assign",
      prompt: "Select the Assign step (click row).",
      hint: "Click Assign row",
      setup: () => loadStarter(),
      check: () => state.selected === "assign",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Check required + drive — all 6 wired.",
      hint: "Check required, then Drive",
      setup: () => {
        loadStarter();
        checkRequired();
        state.checked.add("drive");
        state.lastAction = "toggle";
        renderAll();
      },
      check: () => checkedCount() === 6 && requiredDone(),
    },
    {
      id: "diagram-dut",
      title: "DUT node",
      prompt: "With starter, DUT node is on (dut checked).",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.checked.has("dut") && nodeOn("dut"),
    },
    {
      id: "no-virtual-yet",
      title: "Virtual off",
      prompt: "Starter has virtual=0 until you check it.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => !state.checked.has("virtual"),
    },
    {
      id: "assign-code",
      title: "Assign in sketch",
      prompt: "With assign checked, sketch mentions drv.vif or config_db.",
      hint: "Check Assign",
      setup: () => {
        loadStarter();
        state.checked.add("assign");
        renderAll();
      },
      check: () =>
        state.checked.has("assign") &&
        /drv\.vif|config_db/i.test(document.getElementById("sketch-box").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to starter 3 steps.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return (
          state.proto === "uart" &&
          checkedCount() === 3 &&
          state.checked.has("dut") &&
          !state.checked.has("virtual")
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vif-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vif-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadProto());
  document.getElementById("btn-req").addEventListener("click", () => checkRequired());
  document.getElementById("btn-clear").addEventListener("click", () => clearAll());
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
