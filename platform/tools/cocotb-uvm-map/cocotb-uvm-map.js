(() => {
  /**
   * cocotb vs UVM map (concept)
   *   cocotb / pyuvm roles ↔ SV UVM roles
   * Starter: DUT handle ↔ vif selected + mapped
   */

  const PAIRS = [
    {
      id: "dut",
      py: {
        title: "dut.signal",
        blurb: "Hierarchical handle from the simulator into Python",
      },
      uvm: {
        title: "vif / hierarchical",
        blurb: "Virtual interface or hierarchical path into the DUT",
      },
      bridge: "Both sides need a handle into the DUT — Python dut vs SV vif.",
      pyFlow: ["sim", "dut", "sig"],
      uvmFlow: ["ConfigDB", "vif", "DUT"],
    },
    {
      id: "test",
      py: {
        title: "@cocotb.test / pyuvm test",
        blurb: "async def entry; Makefile MODULE=… selects the test",
      },
      uvm: {
        title: "uvm_test + +UVM_TESTNAME",
        blurb: "Factory-built test; plusarg picks which test runs",
      },
      bridge: "The top-level test is the entry — decorator/MODULE vs UVM_TESTNAME.",
      pyFlow: ["MODULE", "@test", "async"],
      uvmFlow: ["+UVM_TESTNAME", "uvm_test", "run_test"],
    },
    {
      id: "await",
      py: {
        title: "RisingEdge / Timer",
        blurb: "await triggers advance simulation time from Python",
      },
      uvm: {
        title: "@posedge / #delay / wait",
        blurb: "SV event controls and delays inside components",
      },
      bridge: "Time moves when you await a trigger — same idea as @ / # in SV.",
      pyFlow: ["await", "RisingEdge", "Timer"],
      uvmFlow: ["@", "#", "wait"],
    },
    {
      id: "drive",
      py: {
        title: "Python pin assigns",
        blurb: "dut.sig.value = … in a coroutine (plain cocotb)",
      },
      uvm: {
        title: "Driver + vif",
        blurb: "Driver pulls items and drives pins via the vif",
      },
      bridge: "Plain cocotb wiggles pins in Python; UVM (and pyuvm) hide that in a driver.",
      pyFlow: ["coro", "dut.sig", "value"],
      uvmFlow: ["item", "driver", "vif"],
    },
    {
      id: "agent",
      py: {
        title: "pyuvm agent",
        blurb: "Python UVM-style agent: sequencer / driver / monitor",
      },
      uvm: {
        title: "uvm_agent",
        blurb: "SV agent bundles active/passive stimulus + observe",
      },
      bridge: "pyuvm mirrors the agent box — same roles, Python classes.",
      pyFlow: ["pyuvm", "agent", "drv/mon"],
      uvmFlow: ["uvm_agent", "sqr", "drv/mon"],
    },
    {
      id: "check",
      py: {
        title: "assert / pyuvm scoreboard",
        blurb: "Inline asserts or a transaction compare component",
      },
      uvm: {
        title: "Scoreboard",
        blurb: "Predict vs observe compare on transactions",
      },
      bridge: "Checks climb from assert in the coro to expect/actual scoreboards.",
      pyFlow: ["assert", "or", "scoreboard"],
      uvmFlow: ["predict", "scoreboard", "actual"],
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: DUT ↔ vif mapped",
      pair: "dut",
      mapped: ["dut"],
      note: "Start here: Python dut handle maps to the SV virtual interface idea.",
    },
    none: {
      label: "nothing mapped",
      pair: "test",
      mapped: [],
      note: "Select pairs and Mark mapped to build the bridge.",
    },
    half: {
      label: "half map (3)",
      pair: "await",
      mapped: ["dut", "test", "await"],
      note: "Three pairs already checked — finish the rest.",
    },
    all: {
      label: "all mapped",
      pair: "check",
      mapped: PAIRS.map((p) => p.id),
      note: "Full role map — Demo or Reset to practice again.",
    },
  };

  function sourceSketch() {
    return `// cocotb / pyuvm ↔ SV UVM literacy (roles, not APIs)
// Plain cocotb  = async Python TB (triggers, dut handles, asserts)
// pyuvm         = UVM-like components in Python on top of cocotb
// SV UVM        = Accellera class library in SystemVerilog
//
// Rough map:
//   @cocotb.test / MODULE     ↔  uvm_test + +UVM_TESTNAME
//   await RisingEdge/Timer    ↔  @posedge / #delay
//   dut.signal                ↔  virtual interface
//   Python assigns / pyuvm drv↔  uvm_driver + vif
//   pyuvm agent               ↔  uvm_agent
//   assert / scoreboard       ↔  uvm scoreboard
//
// Same jobs — different language and packaging.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      pairId: p.pair,
      mapped: new Set(p.mapped),
      note: p.note,
      side: "py",
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["mapped dut — dut.signal ↔ vif"],
    };
  }

  const CLEARED_KEY = "ddv-cocotb-uvm-map-cleared-v1";
  const STORE_KEY = "ddv-cocotb-uvm-map-session-v1";

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

  const root = document.getElementById("cum-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>dut.signal</code> ↔ virtual interface
        already selected and marked mapped.</p>
      <button type="button" class="btn btn-secondary" id="cum-starter">Load starter example</button>
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
        <div class="idea-card"><h3>cocotb</h3><p>Async Python TB: triggers + DUT handles.</p></div>
        <div class="idea-card"><h3>pyuvm</h3><p>UVM-shaped components written in Python.</p></div>
        <div class="idea-card"><h3>SV UVM</h3><p>Same roles in SystemVerilog classes.</p></div>
        <div class="idea-card"><h3>map roles</h3><p>Jobs match; APIs and packaging differ.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="cum-controls">
        <div class="cum-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>DUT ↔ vif mapped</option>
            <option value="none">nothing mapped</option>
            <option value="half">half map (3)</option>
            <option value="all">all mapped</option>
          </select>
        </div>
        <div class="cum-field">
          <label for="sel-pair">Pair</label>
          <select id="sel-pair">
            ${PAIRS.map((p) => `<option value="${p.id}">${p.id}</option>`).join("")}
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-mark">Mark mapped</button>
        <button type="button" class="btn btn-ghost" id="btn-unmap">Unmap</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo all</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="bridge-box" id="bridge-box"></div>
      <div class="cum-layout">
        <div class="col-panel">
          <h3>cocotb / pyuvm</h3>
          <div id="col-py"></div>
        </div>
        <div class="col-panel">
          <h3>SV UVM</h3>
          <div id="col-uvm"></div>
        </div>
      </div>
      <p class="meta-note" id="meta-note"></p>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Selected pair</h3>
        <p class="role-blurb" id="role-blurb"></p>
        <pre class="code-box" id="prop-code" style="max-height:14rem;margin-top:0.5rem"></pre>
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
  const selPair = /** @type {HTMLSelectElement} */ (document.getElementById("sel-pair"));

  function pair() {
    return PAIRS.find((p) => p.id === state.pairId) || PAIRS[0];
  }

  function mappedCount() {
    return state.mapped.size;
  }

  function codeSketch() {
    const p = pair();
    return `// selected pair: ${p.id}
// py:  ${p.py.title}
// uvm: ${p.uvm.title}
// mapped=${state.mapped.has(p.id) ? 1 : 0}  total=${mappedCount()}/${PAIRS.length}
//
// bridge:
// ${p.bridge}`;
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
    selPair.value = state.pairId;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter dut mapped");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.pairId = p.pair;
    state.mapped = new Set(p.mapped);
    state.note = p.note;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function selectPair(id) {
    state.pairId = id;
    state.lastAction = "select";
    syncInputs();
    pushLog(`# select ${id}`);
    renderAll();
  }

  function markMapped() {
    state.mapped.add(state.pairId);
    state.lastAction = "mark";
    pushLog(`# mark ${state.pairId}`);
    pushTrace(`mapped ${state.pairId}`);
    renderAll();
  }

  function unmap() {
    state.mapped.delete(state.pairId);
    state.lastAction = "unmap";
    pushLog(`# unmap ${state.pairId}`);
    renderAll();
  }

  function demo() {
    state.preset = "all";
    state.mapped = new Set(PAIRS.map((p) => p.id));
    state.pairId = "check";
    state.note = PRESETS.all.note;
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo all mapped");
    pushTrace("demo: all 6 pairs mapped");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: cocotb = async Python TB; pyuvm ≈ UVM in Python; " +
        "SV UVM = same roles in SystemVerilog — map jobs, not syntax."
    );
    renderAll();
  }

  function flowHtml(flow) {
    return `<div class="flow-row">${flow
      .map((c) => `<span class="flow-chip">${c}</span>`)
      .join("<span>→</span>")}</div>`;
  }

  function renderLab() {
    syncInputs();
    const p = pair();
    const colPy = document.getElementById("col-py");
    const colUvm = document.getElementById("col-uvm");
    colPy.innerHTML = "";
    colUvm.innerHTML = "";
    PAIRS.forEach((pairItem) => {
      const mapped = state.mapped.has(pairItem.id);
      const sel = state.pairId === pairItem.id;
      const pyBtn = document.createElement("button");
      pyBtn.type = "button";
      pyBtn.className = `pair-btn ${sel ? "is-sel" : ""} ${mapped ? "is-mapped" : ""}`;
      pyBtn.innerHTML = `<div class="k">${pairItem.id}${mapped ? " · mapped" : ""}</div>
        <div class="v">${pairItem.py.title}</div>
        <div class="b">${pairItem.py.blurb}</div>`;
      pyBtn.addEventListener("click", () => {
        state.side = "py";
        selectPair(pairItem.id);
      });
      colPy.appendChild(pyBtn);

      const uvmBtn = document.createElement("button");
      uvmBtn.type = "button";
      uvmBtn.className = `pair-btn ${sel ? "is-sel" : ""} ${mapped ? "is-mapped" : ""}`;
      uvmBtn.innerHTML = `<div class="k">${pairItem.id}${mapped ? " · mapped" : ""}</div>
        <div class="v">${pairItem.uvm.title}</div>
        <div class="b">${pairItem.uvm.blurb}</div>`;
      uvmBtn.addEventListener("click", () => {
        state.side = "uvm";
        selectPair(pairItem.id);
      });
      colUvm.appendChild(uvmBtn);
    });

    document.getElementById("bridge-box").innerHTML = `
      <strong>Bridge:</strong> ${p.bridge}
      ${flowHtml(p.pyFlow)}
      ${flowHtml(p.uvmFlow)}
    `;
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      state.side === "uvm"
        ? `SV UVM side: ${p.uvm.title} — ${p.uvm.blurb}`
        : `Python side: ${p.py.title} — ${p.py.blurb}`;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    const n = mappedCount();
    if (n === PAIRS.length) {
      v.className = "verdict yes";
      v.textContent = `All ${n} pairs mapped — role bridge complete`;
    } else if (state.mapped.has(state.pairId)) {
      v.className = "verdict yes";
      v.textContent = `${p.id} mapped · ${n}/${PAIRS.length}`;
    } else {
      v.className = "verdict warn";
      v.textContent = `${p.id} selected — Mark mapped · ${n}/${PAIRS.length}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">pair=${state.pairId}</span>
      <span class="flag ${state.mapped.has(state.pairId) ? "is-ok" : ""}">this=${state.mapped.has(state.pairId) ? 1 : 0}</span>
      <span class="flag ${n ? "is-ok" : ""}">mapped=${n}/${PAIRS.length}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          pairId: state.pairId,
          mapped: [...state.mapped],
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-cocotb",
      title: "Quiz: cocotb",
      type: "quiz",
      prompt: "Plain cocotb is best described as…",
      hint: "Async Python TB.",
      choices: [
        "an async Python testbench library (triggers + DUT handles)",
        "a SystemVerilog synthesis subset",
        "a GTKWave theme pack",
        "a Makefile-only lint tool",
      ],
      answer: "an async Python testbench library (triggers + DUT handles)",
    },
    {
      id: "quiz-pyuvm",
      title: "Quiz: pyuvm",
      type: "quiz",
      prompt: "pyuvm’s relationship to UVM is closest to…",
      hint: "Same shape.",
      choices: [
        "UVM-like components and phases implemented in Python",
        "a replacement for Verilator only",
        "a VCD-to-SVG converter",
        "an objection-free synthesis flow",
      ],
      answer: "UVM-like components and phases implemented in Python",
    },
    {
      id: "quiz-dut",
      title: "Quiz: DUT handle",
      type: "quiz",
      prompt: "dut.signal in cocotb maps most closely to…",
      hint: "Handle into DUT.",
      choices: [
        "a virtual interface / hierarchical DUT access in SV UVM",
        "a factory type override",
        "a coverage bin name only",
        "the objection count",
      ],
      answer: "a virtual interface / hierarchical DUT access in SV UVM",
    },
    {
      id: "quiz-await",
      title: "Quiz: await",
      type: "quiz",
      prompt: "await RisingEdge(dut.clk) is the Python cousin of…",
      hint: "Edge wait.",
      choices: [
        "@(posedge clk) / waiting on an event in SV",
        "only $finish",
        "defparam overrides",
        "timescale pragmas alone",
      ],
      answer: "@(posedge clk) / waiting on an event in SV",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — dut pair mapped.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.pairId === "dut" &&
        state.mapped.has("dut"),
    },
    {
      id: "select-test",
      title: "Select test",
      prompt: "Select the test pair.",
      hint: "Click test or Pair → test",
      setup: () => {
        loadStarter();
        selectPair("test");
      },
      check: () => state.pairId === "test" && state.lastAction === "select",
    },
    {
      id: "mark-test",
      title: "Mark test",
      prompt: "Select test and Mark mapped.",
      hint: "test → Mark mapped",
      setup: () => {
        loadStarter();
        selectPair("test");
        markMapped();
      },
      check: () => state.mapped.has("test") && state.lastAction === "mark",
    },
    {
      id: "select-await",
      title: "Select await",
      prompt: "Select the await pair.",
      hint: "Pair → await",
      setup: () => {
        selectPair("await");
      },
      check: () => state.pairId === "await",
    },
    {
      id: "mark-await",
      title: "Mark await",
      prompt: "Mark await mapped.",
      hint: "await → Mark mapped",
      setup: () => {
        selectPair("await");
        markMapped();
      },
      check: () => state.mapped.has("await") && state.lastAction === "mark",
    },
    {
      id: "select-drive",
      title: "Select drive",
      prompt: "Select the drive pair.",
      hint: "drive",
      setup: () => selectPair("drive"),
      check: () => state.pairId === "drive",
    },
    {
      id: "mark-agent",
      title: "Mark agent",
      prompt: "Select agent and Mark mapped.",
      hint: "agent → Mark mapped",
      setup: () => {
        selectPair("agent");
        markMapped();
      },
      check: () => state.mapped.has("agent"),
    },
    {
      id: "mark-check",
      title: "Mark check",
      prompt: "Select check and Mark mapped.",
      hint: "check → Mark mapped",
      setup: () => {
        selectPair("check");
        markMapped();
      },
      check: () => state.mapped.has("check") && state.lastAction === "mark",
    },
    {
      id: "unmap",
      title: "Unmap",
      prompt: "On starter dut, Unmap — this=0.",
      hint: "Unmap",
      setup: () => {
        loadStarter();
        unmap();
      },
      check: () => !state.mapped.has("dut") && state.lastAction === "unmap",
    },
    {
      id: "load-none",
      title: "Load none",
      prompt: "Load nothing mapped — mapped=0.",
      hint: "nothing mapped → Load",
      setup: () => {
        selPreset.value = "none";
        loadPreset();
      },
      check: () => mappedCount() === 0 && state.lastAction === "load",
    },
    {
      id: "load-half",
      title: "Load half",
      prompt: "Load half map — mapped=3.",
      hint: "half map → Load",
      setup: () => {
        selPreset.value = "half";
        loadPreset();
      },
      check: () => mappedCount() === 3 && state.pairId === "await",
    },
    {
      id: "demo",
      title: "Demo all",
      prompt: "Click Demo all — mapped=6.",
      hint: "Demo all",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        mappedCount() === PAIRS.length &&
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
      id: "bridge-dut",
      title: "Bridge text",
      prompt: "On dut, bridge mentions virtual interface.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.pairId === "dut" &&
        /virtual interface/i.test(document.getElementById("bridge-box").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions pyuvm.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /pyuvm/i.test(sourceSketch()),
    },
    {
      id: "side-uvm",
      title: "SV side",
      prompt: "Click an SV UVM column card (sets side=uvm).",
      hint: "Click right column",
      setup: () => {
        loadStarter();
        state.side = "uvm";
        state.lastAction = "select";
        renderAll();
      },
      check: () => state.side === "uvm",
    },
    {
      id: "sketch-pair",
      title: "Sketch pair",
      prompt: "Access sketch shows selected pair.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /selected pair:/i.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From none, Reset — dut mapped again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "none";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.pairId === "dut" &&
        state.mapped.has("dut"),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="cum-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("cum-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-mark").addEventListener("click", () => markMapped());
  document.getElementById("btn-unmap").addEventListener("click", () => unmap());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selPair.addEventListener("change", () => selectPair(selPair.value));

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
      if (saved && saved.pairId) {
        state.pairId = saved.pairId;
        state.mapped = new Set(saved.mapped || []);
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
