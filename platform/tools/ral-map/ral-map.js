(() => {
  /**
   * Register model map (concept)
   *   block → reg → field · address · frontdoor vs backdoor
   * Starter: CTRL@0x00 ENABLE, front-door write 1
   */

  /** @typedef {"frontdoor"|"backdoor"} AccessDoor */

  const REGS = {
    CTRL: {
      name: "CTRL",
      offset: 0x00,
      field: "ENABLE",
      bits: "[0]",
      access: "RW",
      hdl: "dut.u_regs.ctrl",
    },
    STATUS: {
      name: "STATUS",
      offset: 0x04,
      field: "BUSY",
      bits: "[0]",
      access: "RO",
      hdl: "dut.u_regs.status",
    },
    DATA: {
      name: "DATA",
      offset: 0x08,
      field: "VALUE",
      bits: "[7:0]",
      access: "RW",
      hdl: "dut.u_regs.data",
    },
  };

  const BASE = 0x1000;

  const PRESETS = {
    starter: {
      label: "starter: CTRL frontdoor write 1",
      reg: "CTRL",
      door: /** @type {AccessDoor} */ ("frontdoor"),
      desired: 1,
      mirror: 0,
      dut: 0,
      note: "Front-door write ENABLE=1 via bus/adapter — DUT and mirror update.",
      autoWrite: true,
    },
    status_ro: {
      label: "STATUS RO peek",
      reg: "STATUS",
      door: /** @type {AccessDoor} */ ("backdoor"),
      desired: 0,
      mirror: 0,
      dut: 1,
      note: "STATUS is RO — backdoor peek shows DUT BUSY without a bus cycle.",
      autoWrite: false,
    },
    data_backdoor: {
      label: "DATA backdoor poke",
      reg: "DATA",
      door: /** @type {AccessDoor} */ ("backdoor"),
      desired: 0xa5,
      mirror: 0,
      dut: 0,
      note: "Back-door poke DATA — skips adapter; updates DUT (+ mirror if you predict).",
      autoWrite: true,
    },
    reset_map: {
      label: "reset map (all 0)",
      reg: "CTRL",
      door: /** @type {AccessDoor} */ ("frontdoor"),
      desired: 0,
      mirror: 0,
      dut: 0,
      note: "Clean map — pick a register and Write / Peek.",
      autoWrite: false,
    },
  };

  function hex(n) {
    return "0x" + (n >>> 0).toString(16).toUpperCase();
  }

  function addrOf(regName) {
    const r = REGS[regName] || REGS.CTRL;
    return BASE + r.offset;
  }

  function sourceSketch() {
    return `// RAL literacy (not a full UVM RAL library)
// block  = address map container (base + offsets)
// reg    = named register with fields + access policy
// field  = bit slice inside a register
//
// frontdoor = bus transaction via reg2bus adapter (real protocol)
// backdoor  = peek/poke HDL path (no bus cycles)
//
// mirror  = model's predicted HW value
// desired = value software wants to write
//
// Typical: map.write(status, UVM_FRONTDOOR) / peek(UVM_BACKDOOR)`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      reg: p.reg,
      door: p.door,
      desired: p.desired,
      mirror: p.desired,
      dut: p.desired,
      note: p.note,
      selected: "reg",
      lastOp: "write",
      lastDoor: p.door,
      lastOk: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      writes: 1,
      peeks: 0,
      log: [],
      trace: ["frontdoor write CTRL ENABLE=1 @ " + hex(addrOf("CTRL"))],
    };
  }

  const CLEARED_KEY = "ddv-ral-map-cleared-v1";
  const STORE_KEY = "ddv-ral-map-session-v1";

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

  const root = document.getElementById("ral-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> block <code>uart_reg_block</code> base
        <code>${hex(BASE)}</code>, register <code>CTRL</code> @ offset
        <code>0x00</code>, field <code>ENABLE</code> written front-door to
        <code>1</code>.</p>
      <button type="button" class="btn btn-secondary" id="ral-starter">Load starter example</button>
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
        <div class="idea-card"><h3>block → reg → field</h3><p>Named hierarchy over raw addresses.</p></div>
        <div class="idea-card"><h3>address map</h3><p>base + offset → absolute bus address.</p></div>
        <div class="idea-card"><h3>front-door</h3><p>Access via bus + adapter (real cycles).</p></div>
        <div class="idea-card"><h3>back-door</h3><p>Peek/poke HDL path — no bus traffic.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ral-controls">
        <div class="ral-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>CTRL frontdoor write 1</option>
            <option value="status_ro">STATUS RO peek</option>
            <option value="data_backdoor">DATA backdoor poke</option>
            <option value="reset_map">reset map</option>
          </select>
        </div>
        <div class="ral-field">
          <label for="sel-reg">Register</label>
          <select id="sel-reg">
            <option value="CTRL">CTRL</option>
            <option value="STATUS">STATUS</option>
            <option value="DATA">DATA</option>
          </select>
        </div>
        <div class="ral-field">
          <label for="sel-door">Access</label>
          <select id="sel-door">
            <option value="frontdoor">front-door</option>
            <option value="backdoor">back-door</option>
          </select>
        </div>
        <div class="ral-field">
          <label for="inp-val">Value</label>
          <input id="inp-val" type="text" value="1" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-write">Write</button>
        <button type="button" class="btn btn-secondary" id="btn-peek">Peek / read</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo backdoor</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ral-layout">
        <div class="panel-box">
          <h3>Map tree</h3>
          <div class="tree-row" id="tree-row"></div>
          <div class="door-row" id="door-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Access sketch</h3>
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
  const selReg = /** @type {HTMLSelectElement} */ (document.getElementById("sel-reg"));
  const selDoor = /** @type {HTMLSelectElement} */ (document.getElementById("sel-door"));
  const inpVal = /** @type {HTMLInputElement} */ (document.getElementById("inp-val"));

  function parseVal(raw) {
    const t = String(raw || "").trim();
    if (!t) return 0;
    const n = t.startsWith("0x") || t.startsWith("0X") ? parseInt(t, 16) : parseInt(t, 10);
    return Number.isFinite(n) ? n >>> 0 : 0;
  }

  function reg() {
    return REGS[state.reg] || REGS.CTRL;
  }

  function codeSketch() {
    const r = reg();
    return `// uart_reg_block base=${hex(BASE)}
// ${r.name} offset=${hex(r.offset)} → addr=${hex(addrOf(state.reg))}
// field ${r.field} ${r.bits} access=${r.access}
// hdl path: ${r.hdl}
//
// door=${state.door}
// desired=${hex(state.desired)} mirror=${hex(state.mirror)} dut=${hex(state.dut)}
// last: ${state.lastOp || "—"} via ${state.lastDoor || "—"} ok=${state.lastOk == null ? "—" : state.lastOk ? 1 : 0}`;
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
    selReg.value = state.reg;
    selDoor.value = state.door;
    inpVal.value = String(state.desired);
  }

  function applyPreset(id, markAction) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.reg = p.reg;
    state.door = p.door;
    state.desired = p.desired;
    state.mirror = p.mirror;
    state.dut = p.dut;
    state.note = p.note;
    state.lastOk = null;
    state.lastOp = null;
    state.lastDoor = null;
    if (p.autoWrite) {
      doWrite(true);
      if (markAction) state.lastAction = markAction;
    } else if (markAction) {
      state.lastAction = markAction;
    }
    syncInputs();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter CTRL frontdoor write 1");
    renderAll();
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function doWrite(silent) {
    const r = reg();
    const v = parseVal(inpVal.value);
    state.desired = v;
    if (r.access === "RO") {
      state.lastOk = false;
      state.lastOp = "write";
      state.lastDoor = state.door;
      if (!silent) {
        state.lastAction = "write-ro";
        pushLog("# write blocked — RO");
        pushTrace(`blocked write ${r.name} (RO)`);
        renderAll();
      }
      return;
    }
    state.dut = v;
    state.mirror = v;
    state.lastOk = true;
    state.lastOp = "write";
    state.lastDoor = state.door;
    state.writes += 1;
    if (!silent) {
      state.lastAction = "write";
      const via = state.door === "frontdoor" ? "bus/adapter" : "hdl poke";
      pushLog(`# write ${r.name}=${hex(v)} ${state.door}`);
      pushTrace(`${state.door} write ${r.name}.${r.field}=${hex(v)} @ ${hex(addrOf(state.reg))} (${via})`);
      renderAll();
    }
  }

  function doPeek() {
    const r = reg();
    const via = state.door === "frontdoor" ? "bus read" : "hdl peek";
    // Frontdoor read samples DUT through bus; backdoor peeks HDL.
    // Mirror updates on successful observe (concept).
    state.mirror = state.dut;
    state.lastOk = true;
    state.lastOp = "peek";
    state.lastDoor = state.door;
    state.peeks += 1;
    state.lastAction = "peek";
    pushLog(`# peek ${r.name}=${hex(state.dut)} ${state.door}`);
    pushTrace(`${state.door} peek ${r.name}=${hex(state.dut)} (${via})`);
    renderAll();
  }

  function demo() {
    state.preset = "data_backdoor";
    state.reg = "DATA";
    state.door = "backdoor";
    state.desired = 0xa5;
    inpVal.value = "0xA5";
    state.demoed = true;
    syncInputs();
    doWrite(false);
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo backdoor DATA=0xA5");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: block maps base+offset; fields name bits; " +
        "frontdoor uses bus+adapter; backdoor peeks/pokes HDL."
    );
    renderAll();
  }

  function selectNode(which) {
    state.selected = which;
    state.lastAction = "select";
    renderAll();
  }

  const SEL_BLURB = {
    block: "The register block owns the base address and contains named registers.",
    reg: "A register has an offset in the map, access policy, and one or more fields.",
    field: "A field is a named bit slice — tests write fields instead of raw masks.",
  };

  function renderLab() {
    syncInputs();
    const r = reg();
    const tree = document.getElementById("tree-row");
    tree.innerHTML = `
      <button type="button" class="tree-node ${state.selected === "block" ? "is-sel" : ""}" data-node="block">
        <div class="k">block</div><div class="v">uart_reg_block base=${hex(BASE)}</div>
      </button>
      <button type="button" class="tree-node indent-1 ${state.selected === "reg" ? "is-sel" : ""}" data-node="reg">
        <div class="k">register</div><div class="v">${r.name} @ ${hex(r.offset)} → ${hex(addrOf(state.reg))} (${r.access})</div>
      </button>
      <button type="button" class="tree-node indent-2 ${state.selected === "field" ? "is-sel" : ""}" data-node="field">
        <div class="k">field</div><div class="v">${r.field} ${r.bits}</div>
      </button>
    `;
    tree.querySelectorAll("[data-node]").forEach((el) => {
      el.addEventListener("click", () =>
        selectNode(/** @type {string} */ (el.getAttribute("data-node")))
      );
    });

    document.getElementById("door-row").innerHTML = `
      <div class="door-card ${state.door === "frontdoor" ? "is-active" : ""}">
        <div class="k">front-door</div>
        <div class="v">bus + adapter → ${hex(addrOf(state.reg))}</div>
      </div>
      <div class="door-card ${state.door === "backdoor" ? "is-active" : ""}">
        <div class="k">back-door</div>
        <div class="v">HDL ${r.hdl}</div>
      </div>
    `;

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      SEL_BLURB[state.selected] || SEL_BLURB.reg;
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
      v.className = "verdict warn";
      v.textContent = `Blocked — ${r.name} is ${r.access}; cannot Write`;
    } else if (state.lastOp === "write") {
      v.className = "verdict yes";
      v.textContent = `Wrote ${r.name}.${r.field}=${hex(state.desired)} via ${state.lastDoor}`;
    } else if (state.lastOp === "peek") {
      v.className = "verdict yes";
      v.textContent = `Peek ${r.name}=${hex(state.dut)} via ${state.lastDoor}`;
    } else {
      v.className = "verdict idle";
      v.textContent = `${r.name} selected — Write or Peek`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">reg=${state.reg}</span>
      <span class="flag is-on">door=${state.door}</span>
      <span class="flag is-on">addr=${hex(addrOf(state.reg))}</span>
      <span class="flag ${state.mirror === state.dut ? "is-ok" : ""}">mirror=${hex(state.mirror)}</span>
      <span class="flag is-on">dut=${hex(state.dut)}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          reg: state.reg,
          door: state.door,
          desired: state.desired,
          mirror: state.mirror,
          dut: state.dut,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-hierarchy",
      title: "Quiz: hierarchy",
      type: "quiz",
      prompt: "A RAL model is typically organized as…",
      hint: "Tree.",
      choices: [
        "block → register → field over an address map",
        "only VCD dump variables",
        "Makefile targets exclusively",
        "factory overrides without addresses",
      ],
      answer: "block → register → field over an address map",
    },
    {
      id: "quiz-frontdoor",
      title: "Quiz: front-door",
      type: "quiz",
      prompt: "A front-door register access…",
      hint: "Bus.",
      choices: [
        "goes through the bus / protocol via an adapter",
        "always skips the DUT entirely",
        "only works in report_phase",
        "replaces the scoreboard",
      ],
      answer: "goes through the bus / protocol via an adapter",
    },
    {
      id: "quiz-backdoor",
      title: "Quiz: back-door",
      type: "quiz",
      prompt: "A back-door peek/poke…",
      hint: "HDL.",
      choices: [
        "uses an HDL path and does not generate bus cycles",
        "must always use the UART baud divider",
        "deletes the register block",
        "is identical to analysis_port.write",
      ],
      answer: "uses an HDL path and does not generate bus cycles",
    },
    {
      id: "quiz-mirror",
      title: "Quiz: mirror",
      type: "quiz",
      prompt: "The register mirror value represents…",
      hint: "Model.",
      choices: [
        "the model’s predicted / tracked hardware value",
        "the GTKWave cursor only",
        "the objection count",
        "the simulator timescale",
      ],
      answer: "the model’s predicted / tracked hardware value",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — CTRL written front-door to 1.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.reg === "CTRL" &&
        state.door === "frontdoor" &&
        state.dut === 1,
    },
    {
      id: "addr-ctrl",
      title: "CTRL address",
      prompt: "On starter, absolute addr is 0x1000.",
      hint: "base+offset",
      setup: () => loadStarter(),
      check: () => state.reg === "CTRL" && addrOf("CTRL") === 0x1000,
    },
    {
      id: "load-status",
      title: "Load STATUS",
      prompt: "Load STATUS RO peek — reg STATUS, door backdoor.",
      hint: "STATUS RO peek → Load",
      setup: () => {
        selPreset.value = "status_ro";
        loadPreset();
      },
      check: () =>
        state.reg === "STATUS" &&
        state.door === "backdoor" &&
        state.lastAction === "load",
    },
    {
      id: "peek-busy",
      title: "Peek BUSY",
      prompt: "On STATUS preset, Peek — dut shows 1.",
      hint: "Peek / read",
      setup: () => {
        selPreset.value = "status_ro";
        loadPreset();
        doPeek();
      },
      check: () =>
        state.reg === "STATUS" &&
        state.lastOp === "peek" &&
        state.dut === 1 &&
        state.lastAction === "peek",
    },
    {
      id: "write-ro",
      title: "Write RO blocked",
      prompt: "On STATUS, try Write — blocked.",
      hint: "STATUS is RO",
      setup: () => {
        selPreset.value = "status_ro";
        loadPreset();
        doWrite(false);
      },
      check: () => state.lastOk === false && state.lastAction === "write-ro",
    },
    {
      id: "load-data",
      title: "Load DATA",
      prompt: "Load DATA backdoor poke preset.",
      hint: "DATA backdoor → Load",
      setup: () => {
        selPreset.value = "data_backdoor";
        loadPreset();
      },
      check: () =>
        state.reg === "DATA" &&
        state.door === "backdoor" &&
        state.dut === 0xa5,
    },
    {
      id: "door-front",
      title: "Door front",
      prompt: "Set Access to front-door.",
      hint: "Access → front-door",
      setup: () => {
        loadStarter();
        selDoor.value = "frontdoor";
        state.door = "frontdoor";
        state.lastAction = "door";
        renderAll();
      },
      check: () => state.door === "frontdoor" && state.lastAction === "door",
    },
    {
      id: "door-back",
      title: "Door back",
      prompt: "Set Access to back-door.",
      hint: "Access → back-door",
      setup: () => {
        loadStarter();
        selDoor.value = "backdoor";
        state.door = "backdoor";
        state.lastAction = "door";
        renderAll();
      },
      check: () => state.door === "backdoor",
    },
    {
      id: "select-reg",
      title: "Select DATA",
      prompt: "Choose register DATA in the dropdown.",
      hint: "Register → DATA",
      setup: () => {
        selPreset.value = "reset_map";
        loadPreset();
        selReg.value = "DATA";
        state.reg = "DATA";
        state.lastAction = "reg";
        renderAll();
      },
      check: () => state.reg === "DATA" && state.lastAction === "reg",
    },
    {
      id: "write-data",
      title: "Write DATA",
      prompt: "From reset map, DATA=0x5A, Write.",
      hint: "DATA · Value 0x5A · Write",
      setup: () => {
        selPreset.value = "reset_map";
        loadPreset();
        state.reg = "DATA";
        state.door = "frontdoor";
        inpVal.value = "0x5A";
        syncInputs();
        doWrite(false);
      },
      check: () =>
        state.reg === "DATA" &&
        state.dut === 0x5a &&
        state.lastAction === "write",
    },
    {
      id: "demo",
      title: "Demo backdoor",
      prompt: "Click Demo backdoor — DATA=0xA5.",
      hint: "Demo backdoor",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.reg === "DATA" &&
        state.dut === 0xa5 &&
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
      id: "select-field",
      title: "Select field",
      prompt: "Click the field node in the tree.",
      hint: "Click field box",
      setup: () => {
        loadStarter();
        selectNode("field");
      },
      check: () => state.selected === "field" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions frontdoor.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /frontdoor/i.test(sourceSketch()),
    },
    {
      id: "sketch-hdl",
      title: "Sketch HDL",
      prompt: "Access sketch shows hdl path.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /hdl path:/i.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "addr-status",
      title: "STATUS address",
      prompt: "With STATUS selected, addr is 0x1004.",
      hint: "base+0x04",
      setup: () => {
        state.reg = "STATUS";
        state.lastAction = "reg";
        renderAll();
      },
      check: () => state.reg === "STATUS" && addrOf("STATUS") === 0x1004,
    },
    {
      id: "mirror-match",
      title: "Mirror match",
      prompt: "After starter write, mirror equals dut.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.mirror === state.dut && state.dut === 1,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From reset map, click Reset — CTRL=1 again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "reset_map";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.reg === "CTRL" &&
        state.dut === 1,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ral-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ral-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-write").addEventListener("click", () => doWrite(false));
  document.getElementById("btn-peek").addEventListener("click", () => doPeek());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selReg.addEventListener("change", () => {
    state.reg = selReg.value;
    state.lastAction = "reg";
    renderAll();
  });
  selDoor.addEventListener("change", () => {
    state.door = /** @type {AccessDoor} */ (selDoor.value);
    state.lastAction = "door";
    renderAll();
  });
  inpVal.addEventListener("change", () => {
    state.desired = parseVal(inpVal.value);
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
      if (saved && saved.reg) {
        state.reg = saved.reg;
        state.door = saved.door || "frontdoor";
        state.desired = saved.desired ?? 0;
        state.mirror = saved.mirror ?? 0;
        state.dut = saved.dut ?? 0;
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
