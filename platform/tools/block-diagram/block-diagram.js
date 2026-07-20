(() => {
  const STORAGE_KEY = "ddv-block-diagram-v1";
  const CLEARED_KEY = "ddv-block-diagram-cleared-v1";

  /**
   * Teaching model: blocks with typed ports (addr/data/ctrl/instr).
   * Wire out→in; same type required. Required edges define a “complete” system.
   */

  const BLOCK_CATALOG = {
    cpu: {
      id: "cpu",
      title: "CPU",
      role: "control",
      kind: "cpu",
      x: 40,
      y: 40,
      ports: [
        { id: "instr_in", dir: "in", type: "instr", label: "instr" },
        { id: "addr_out", dir: "out", type: "addr", label: "addr" },
        { id: "data_io", dir: "out", type: "data", label: "wdata" },
        { id: "rdata_in", dir: "in", type: "data", label: "rdata" },
        { id: "alu_op", dir: "out", type: "ctrl", label: "alu_op" },
        { id: "rf_ctrl", dir: "out", type: "ctrl", label: "rf_we" },
      ],
    },
    alu: {
      id: "alu",
      title: "ALU",
      role: "datapath",
      kind: "alu",
      x: 260,
      y: 40,
      ports: [
        { id: "a", dir: "in", type: "data", label: "A" },
        { id: "b", dir: "in", type: "data", label: "B" },
        { id: "op", dir: "in", type: "ctrl", label: "op" },
        { id: "y", dir: "out", type: "data", label: "Y" },
      ],
    },
    rf: {
      id: "rf",
      title: "RegFile",
      role: "datapath",
      kind: "reg",
      x: 260,
      y: 230,
      ports: [
        { id: "rs1", dir: "out", type: "data", label: "rs1" },
        { id: "rs2", dir: "out", type: "data", label: "rs2" },
        { id: "rd", dir: "in", type: "data", label: "rd" },
        { id: "we", dir: "in", type: "ctrl", label: "we" },
      ],
    },
    mem: {
      id: "mem",
      title: "Memory",
      role: "memory",
      kind: "mem",
      x: 480,
      y: 120,
      ports: [
        { id: "addr", dir: "in", type: "addr", label: "addr" },
        { id: "wdata", dir: "in", type: "data", label: "wdata" },
        { id: "rdata", dir: "out", type: "data", label: "rdata" },
        { id: "instr", dir: "out", type: "instr", label: "instr" },
      ],
    },
    bus: {
      id: "bus",
      title: "SysBus",
      role: "interconnect",
      kind: "bus",
      x: 480,
      y: 40,
      ports: [
        { id: "m_addr", dir: "in", type: "addr", label: "m_addr" },
        { id: "m_data", dir: "in", type: "data", label: "m_wdata" },
        { id: "s_rdata", dir: "out", type: "data", label: "s_rdata" },
        { id: "s_addr", dir: "out", type: "addr", label: "s_addr" },
        { id: "s_wdata", dir: "out", type: "data", label: "s_wdata" },
        { id: "m_rdata", dir: "in", type: "data", label: "m_rdata" },
      ],
    },
  };

  function cloneWires(wires) {
    return wires.map((w) => ({ ...w }));
  }

  const PRESETS = {
    starter: {
      id: "starter",
      title: "Mini CPU (starter)",
      blurb: "ALU + RegFile wired — add Memory links to finish.",
      blocks: ["cpu", "alu", "rf", "mem"],
      wires: [
        { from: "rf.rs1", to: "alu.a" },
        { from: "rf.rs2", to: "alu.b" },
        { from: "cpu.alu_op", to: "alu.op" },
        { from: "alu.y", to: "rf.rd" },
        { from: "cpu.rf_ctrl", to: "rf.we" },
      ],
      required: [
        "rf.rs1->alu.a",
        "rf.rs2->alu.b",
        "cpu.alu_op->alu.op",
        "alu.y->rf.rd",
        "cpu.rf_ctrl->rf.we",
        "cpu.addr_out->mem.addr",
        "cpu.data_io->mem.wdata",
        "mem.rdata->cpu.rdata_in",
        "mem.instr->cpu.instr_in",
      ],
    },
    complete: {
      id: "complete",
      title: "Complete mini system",
      blurb: "CPU + ALU + RegFile + Memory — all required edges present.",
      blocks: ["cpu", "alu", "rf", "mem"],
      wires: [
        { from: "rf.rs1", to: "alu.a" },
        { from: "rf.rs2", to: "alu.b" },
        { from: "cpu.alu_op", to: "alu.op" },
        { from: "alu.y", to: "rf.rd" },
        { from: "cpu.rf_ctrl", to: "rf.we" },
        { from: "cpu.addr_out", to: "mem.addr" },
        { from: "cpu.data_io", to: "mem.wdata" },
        { from: "mem.rdata", to: "cpu.rdata_in" },
        { from: "mem.instr", to: "cpu.instr_in" },
      ],
      required: [
        "rf.rs1->alu.a",
        "rf.rs2->alu.b",
        "cpu.alu_op->alu.op",
        "alu.y->rf.rd",
        "cpu.rf_ctrl->rf.we",
        "cpu.addr_out->mem.addr",
        "cpu.data_io->mem.wdata",
        "mem.rdata->cpu.rdata_in",
        "mem.instr->cpu.instr_in",
      ],
    },
    blank: {
      id: "blank",
      title: "Blank canvas",
      blurb: "Same blocks, no wires — build the datapath yourself.",
      blocks: ["cpu", "alu", "rf", "mem"],
      wires: [],
      required: [
        "rf.rs1->alu.a",
        "rf.rs2->alu.b",
        "cpu.alu_op->alu.op",
        "alu.y->rf.rd",
        "cpu.rf_ctrl->rf.we",
        "cpu.addr_out->mem.addr",
        "cpu.data_io->mem.wdata",
        "mem.rdata->cpu.rdata_in",
        "mem.instr->cpu.instr_in",
      ],
    },
    with_bus: {
      id: "with_bus",
      title: "Via system bus",
      blurb: "CPU talks to Memory through SysBus (addr/data hop).",
      blocks: ["cpu", "bus", "mem"],
      wires: [
        { from: "cpu.addr_out", to: "bus.m_addr" },
        { from: "cpu.data_io", to: "bus.m_data" },
        { from: "bus.s_addr", to: "mem.addr" },
        { from: "bus.s_wdata", to: "mem.wdata" },
        { from: "mem.rdata", to: "bus.m_rdata" },
        { from: "bus.s_rdata", to: "cpu.rdata_in" },
        { from: "mem.instr", to: "cpu.instr_in" },
      ],
      required: [
        "cpu.addr_out->bus.m_addr",
        "cpu.data_io->bus.m_data",
        "bus.s_addr->mem.addr",
        "bus.s_wdata->mem.wdata",
        "mem.rdata->bus.m_rdata",
        "bus.s_rdata->cpu.rdata_in",
        "mem.instr->cpu.instr_in",
      ],
    },
  };

  const CHALLENGES = [
    {
      id: "quiz-block",
      title: "Quiz: block",
      type: "quiz",
      prompt: "In a system block diagram, a block usually represents…",
      hint: "Unit.",
      choices: [
        "a major functional unit (CPU, ALU, memory, bus, …)",
        "only a single NAND gate always",
        "a SPICE transistor",
        "a Git commit",
      ],
      answer: "a major functional unit (CPU, ALU, memory, bus, …)",
    },
    {
      id: "quiz-port",
      title: "Quiz: port",
      type: "quiz",
      prompt: "A port on a block is…",
      hint: "Interface.",
      choices: [
        "a named interface pin with direction (in/out) and often a type",
        "always undirected",
        "only a clock period",
        "a VCD dump file",
      ],
      answer: "a named interface pin with direction (in/out) and often a type",
    },
    {
      id: "quiz-wire",
      title: "Quiz: wire rule",
      type: "quiz",
      prompt: "A legal wire in this lab goes…",
      hint: "out → in, same type.",
      choices: [
        "from an output to an input of the same type (addr/data/ctrl/instr)",
        "from any input to any input",
        "only between identical block titles",
        "without types ever",
      ],
      answer: "from an output to an input of the same type (addr/data/ctrl/instr)",
    },
    {
      id: "quiz-datapath",
      title: "Quiz: datapath",
      type: "quiz",
      prompt: "ALU + register file together are typically called…",
      hint: "Execute path.",
      choices: [
        "the datapath (data computation / storage path)",
        "the linker script",
        "the async FIFO only",
        "the UART PHY",
      ],
      answer: "the datapath (data computation / storage path)",
    },
    {
      id: "quiz-mem",
      title: "Quiz: memory ports",
      type: "quiz",
      prompt: "A simple memory block often exposes…",
      hint: "addr + data.",
      choices: [
        "address and data (and maybe instruction fetch) ports",
        "only a setup-time slider",
        "only $finish",
        "only Gray codes",
      ],
      answer: "address and data (and maybe instruction fetch) ports",
    },
    {
      id: "quiz-bus",
      title: "Quiz: bus",
      type: "quiz",
      prompt: "A system bus block is useful to…",
      hint: "Interconnect.",
      choices: [
        "decouple masters (e.g. CPU) from slaves (e.g. memory) via shared addr/data hops",
        "replace all clocks",
        "synthesize SPICE nets",
        "store Git history",
      ],
      answer:
        "decouple masters (e.g. CPU) from slaves (e.g. memory) via shared addr/data hops",
    },
    {
      id: "quiz-type",
      title: "Quiz: type mismatch",
      type: "quiz",
      prompt: "Connecting addr → data should…",
      hint: "Reject.",
      choices: [
        "be rejected — types must match in this teaching model",
        "always be legal",
        "clear the ALU",
        "force hold violations",
      ],
      answer: "be rejected — types must match in this teaching model",
    },
    {
      id: "quiz-dir",
      title: "Quiz: direction",
      type: "quiz",
      prompt: "Wiring two outputs together…",
      hint: "Illegal here.",
      choices: [
        "is illegal here — need out → in",
        "is the default for buses",
        "means inout automatically",
        "only works for instr",
      ],
      answer: "is illegal here — need out → in",
    },
    {
      id: "quiz-scope",
      title: "Quiz: scope",
      type: "quiz",
      prompt: "This lab is…",
      hint: "Integration sketch.",
      choices: [
        "a conceptual integration sketch — not a full SoC generator or P&R tool",
        "a complete Vivado project",
        "an IBIS model",
        "a UVM RAL browser",
      ],
      answer: "a conceptual integration sketch — not a full SoC generator or P&R tool",
    },
    {
      id: "quiz-cpu",
      title: "Quiz: CPU role",
      type: "quiz",
      prompt: "In this diagram the CPU block mainly…",
      hint: "Control + master.",
      choices: [
        "issues control/addr/data toward datapath and memory (master-ish role)",
        "is only a single full adder",
        "replaces memory",
        "must be analog",
      ],
      answer: "issues control/addr/data toward datapath and memory (master-ish role)",
    },
    {
      id: "run-starter",
      title: "Load starter",
      type: "run",
      prompt: "Load the Mini CPU starter preset.",
      hint: "Preset.",
      check: (s) => s.presetId === "starter",
    },
    {
      id: "run-complete-load",
      title: "Load complete",
      type: "run",
      prompt: "Load Complete mini system — integration should validate OK.",
      hint: "Preset.",
      check: (s) => s.presetId === "complete" && validate(s).ok,
    },
    {
      id: "run-finish-starter",
      title: "Finish starter",
      type: "run",
      prompt: "From starter, add the four CPU↔Memory wires so validation passes.",
      hint: "addr, wdata, rdata, instr.",
      check: (s) => s.presetId === "starter" && validate(s).ok,
    },
    {
      id: "run-blank-build",
      title: "Build from blank",
      type: "run",
      prompt: "Blank canvas: create a complete valid mini system (all required edges).",
      hint: "Wire datapath + memory.",
      check: (s) => s.presetId === "blank" && validate(s).ok,
    },
    {
      id: "run-wire-count",
      title: "At least 5 wires",
      type: "run",
      prompt: "Have at least 5 legal wires on the canvas.",
      hint: "Click out then in.",
      check: (s) => s.wires.length >= 5 && validate(s).illegal === 0,
    },
    {
      id: "run-has-alu-y",
      title: "ALU → RegFile",
      type: "run",
      prompt: "Ensure wire alu.y → rf.rd exists.",
      hint: "Datapath result writeback.",
      check: (s) => hasWire(s, "alu.y", "rf.rd"),
    },
    {
      id: "run-has-mem-instr",
      title: "Mem instr → CPU",
      type: "run",
      prompt: "Ensure mem.instr → cpu.instr_in exists.",
      hint: "Fetch path.",
      check: (s) => hasWire(s, "mem.instr", "cpu.instr_in"),
    },
    {
      id: "run-bus-preset",
      title: "Bus preset OK",
      type: "run",
      prompt: "Load Via system bus — validation should pass.",
      hint: "Preset.",
      check: (s) => s.presetId === "with_bus" && validate(s).ok,
    },
    {
      id: "run-clear-one",
      title: "Delete a wire",
      type: "run",
      prompt: "From complete preset, delete one wire so validation fails.",
      hint: "Remove button on connection list.",
      check: (s) => s.presetId === "complete" && !validate(s).ok && s.wires.length < 9,
    },
    {
      id: "run-select-port",
      title: "Select a port",
      type: "run",
      prompt: "Click any output port so pendingFrom is set (selection active).",
      hint: "Orange outline.",
      check: (s) => !!s.pendingFrom,
    },
    {
      id: "run-no-illegal",
      title: "No illegal wires",
      type: "run",
      prompt: "Canvas has ≥1 wire and zero illegal (type/dir) wires.",
      hint: "Fix red connections.",
      check: (s) => s.wires.length >= 1 && validate(s).illegal === 0,
    },
    {
      id: "run-required-mem-addr",
      title: "CPU addr → Mem",
      type: "run",
      prompt: "Have cpu.addr_out → mem.addr (direct, not via bus).",
      hint: "Starter/complete style.",
      check: (s) => hasWire(s, "cpu.addr_out", "mem.addr"),
    },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parsePort(ref) {
    const [block, port] = String(ref).split(".");
    return { block, port };
  }

  function getPort(blockId, portId) {
    const b = BLOCK_CATALOG[blockId];
    return b?.ports.find((p) => p.id === portId) || null;
  }

  function wireKey(from, to) {
    return `${from}->${to}`;
  }

  function hasWire(s, from, to) {
    return s.wires.some((w) => w.from === from && w.to === to);
  }

  function wireStatus(from, to) {
    const a = parsePort(from);
    const b = parsePort(to);
    const pa = getPort(a.block, a.port);
    const pb = getPort(b.block, b.port);
    if (!pa || !pb) return { ok: false, reason: "unknown port" };
    if (pa.dir !== "out" || pb.dir !== "in") return { ok: false, reason: "need out → in" };
    if (pa.type !== pb.type) return { ok: false, reason: `type ${pa.type}≠${pb.type}` };
    if (a.block === b.block) return { ok: false, reason: "same block" };
    return { ok: true, reason: "ok" };
  }

  function validate(s) {
    let illegal = 0;
    for (const w of s.wires) {
      if (!wireStatus(w.from, w.to).ok) illegal++;
    }
    const have = new Set(s.wires.map((w) => wireKey(w.from, w.to)));
    const missing = (s.required || []).filter((k) => !have.has(k));
    const ok = illegal === 0 && missing.length === 0 && (s.required || []).length > 0;
    return { ok, illegal, missing, have };
  }

  const state = {
    presetId: "starter",
    blockIds: [],
    wires: [],
    required: [],
    pendingFrom: "",
    selectedWire: "",
    msg: "",
    msgOk: true,
    challengeId: "quiz-block",
    challengeOn: false,
    challengeHint: false,
    quizChoice: "",
    clearedIds: [],
  };

  function loadPreset(id, opts = {}) {
    const p = PRESETS[id];
    if (!p) return;
    state.presetId = id;
    state.blockIds = p.blocks.slice();
    state.wires = cloneWires(p.wires);
    state.required = p.required.slice();
    state.pendingFrom = "";
    state.selectedWire = "";
    if (opts.announce !== false) {
      state.msg = `Loaded ${p.title}.`;
      state.msgOk = true;
    }
  }

  function loadStarter() {
    state.challengeOn = false;
    state.challengeHint = false;
    loadPreset("starter");
    state.msg =
      "Starter: datapath wired. Connect CPU ↔ Memory (addr, wdata, rdata, instr) to pass checks.";
    state.msgOk = true;
  }

  function challengeById(id) {
    return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
  }

  function challengePassed() {
    if (!state.challengeOn) return false;
    const ch = challengeById(state.challengeId);
    if (ch.type === "quiz") return state.quizChoice === ch.answer;
    try {
      return !!ch.check(state);
    } catch {
      return false;
    }
  }

  function noteCleared() {
    if (!state.challengeOn || !challengePassed()) return;
    if (!state.clearedIds.includes(state.challengeId)) {
      state.clearedIds = [...state.clearedIds, state.challengeId];
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(state.clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          presetId: state.presetId,
          wires: state.wires,
          blockIds: state.blockIds,
          required: state.required,
          challengeId: state.challengeId,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function tryRestore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.presetId && PRESETS[d.presetId]) state.presetId = d.presetId;
      if (Array.isArray(d.wires)) state.wires = cloneWires(d.wires);
      if (Array.isArray(d.blockIds)) state.blockIds = d.blockIds;
      if (Array.isArray(d.required)) state.required = d.required;
      else if (PRESETS[state.presetId]) state.required = PRESETS[state.presetId].required.slice();
      if (d.challengeId && challengeById(d.challengeId)) state.challengeId = d.challengeId;
      return true;
    } catch {
      return false;
    }
  }

  function portCenter(blockId, portId) {
    const el = document.querySelector(`[data-pref="${blockId}.${portId}"]`);
    const canvas = document.querySelector(".canvas-wrap");
    if (!el || !canvas) return null;
    const er = el.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    return {
      x: er.left - cr.left + er.width / 2 + canvas.scrollLeft,
      y: er.top - cr.top + er.height / 2 + canvas.scrollTop,
    };
  }

  function renderWiresSvg() {
    const paths = state.wires
      .map((w, i) => {
        const a = portCenter(...w.from.split("."));
        const b = portCenter(...w.to.split("."));
        if (!a || !b) return "";
        const midX = (a.x + b.x) / 2;
        const st = wireStatus(w.from, w.to);
        const cls = !st.ok ? "bad" : state.selectedWire === wireKey(w.from, w.to) ? "sel" : "";
        const d = `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
        return `<path class="${cls}" data-wk="${escapeHtml(wireKey(w.from, w.to))}" d="${d}"/>`;
      })
      .join("");
    return `<svg class="wire-svg" aria-hidden="true">${paths}</svg>`;
  }

  function tryConnect(toRef) {
    if (!state.pendingFrom) {
      state.msg = "Select an output port first.";
      state.msgOk = false;
      return;
    }
    const from = state.pendingFrom;
    const st = wireStatus(from, toRef);
    if (!st.ok) {
      state.msg = `Illegal wire: ${st.reason}`;
      state.msgOk = false;
      state.pendingFrom = "";
      return;
    }
    if (hasWire(state, from, toRef)) {
      state.msg = "Wire already exists.";
      state.msgOk = false;
      state.pendingFrom = "";
      return;
    }
    // one driver per input
    state.wires = state.wires.filter((w) => w.to !== toRef);
    state.wires.push({ from, to: toRef });
    state.pendingFrom = "";
    state.msg = `Wired ${from} → ${toRef}`;
    state.msgOk = true;
  }

  const root = document.getElementById("bd-root");

  function render() {
    noteCleared();
    const v = validate(state);
    const ch = challengeById(state.challengeId);
    const passed = challengePassed();
    const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;

    const presetBtns = Object.values(PRESETS)
      .map(
        (p) => `
        <button type="button" class="${p.id === state.presetId ? "is-active" : ""}" data-preset="${p.id}">
          <span class="title">${escapeHtml(p.title)}</span>
          <span class="meta">${escapeHtml(p.blurb)}</span>
        </button>`
      )
      .join("");

    const chalOpts = CHALLENGES.map(
      (c) =>
        `<option value="${c.id}" ${c.id === state.challengeId ? "selected" : ""}>${escapeHtml(
          c.title
        )}</option>`
    ).join("");

    let quizHtml = "";
    if (ch.type === "quiz") {
      quizHtml = `<div class="quiz-choices" style="margin:0.5rem 0">${ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="bd-quiz" value="${escapeHtml(c)}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${escapeHtml(c)}</label>`
        )
        .join("")}</div>`;
    }

    const blocksHtml = state.blockIds
      .map((id) => {
        const b = BLOCK_CATALOG[id];
        const ports = b.ports
          .map((p) => {
            const ref = `${b.id}.${p.id}`;
            const wired = state.wires.some((w) => w.from === ref || w.to === ref);
            const active = state.pendingFrom === ref ? " active" : "";
            const wcls = wired ? " wired" : "";
            return `<button type="button" class="port ${p.dir} type-${p.type}${active}${wcls}" data-pref="${ref}" data-dir="${p.dir}">
              <span>${escapeHtml(p.label)}</span>
              <span class="tag">${escapeHtml(p.type)} · ${p.dir}</span>
            </button>`;
          })
          .join("");
        return `<div class="block kind-${b.kind}" style="left:${b.x}px;top:${b.y}px" data-block="${b.id}">
          <span class="block-role">${escapeHtml(b.role)}</span>
          <p class="block-title">${escapeHtml(b.title)}</p>
          <div class="ports">${ports}</div>
        </div>`;
      })
      .join("");

    const connHtml = state.wires.length
      ? state.wires
          .map((w) => {
            const st = wireStatus(w.from, w.to);
            return `<li class="${st.ok ? "" : "bad"}">
              <span>${escapeHtml(w.from)} → ${escapeHtml(w.to)}${st.ok ? "" : ` (${escapeHtml(st.reason)})`}</span>
              <button type="button" data-del="${escapeHtml(wireKey(w.from, w.to))}">Remove</button>
            </li>`;
          })
          .join("")
      : `<li class="bd-hint">No wires yet — click an output, then an input.</li>`;

    const missingHtml = v.missing.length
      ? `<p class="bd-hint">Missing required: ${v.missing.map(escapeHtml).join(", ")}</p>`
      : "";

    root.innerHTML = `
      <div class="starter-note no-print">
        <p><strong>Starter example:</strong> ALU and RegFile are wired. Finish the mini system by
        connecting CPU address/data to Memory and routing <code>rdata</code>/<code>instr</code> back.</p>
        <button type="button" class="btn btn-secondary" id="bd-starter">Load starter example</button>
      </div>

      <div class="challenge">
        <h2>Challenges <span class="bd-hint">${clearedCount}/${CHALLENGES.length}</span></h2>
        <div style="margin-bottom:0.5rem">
          <label for="bd-chal" class="bd-hint">Pick one</label>
          <select id="bd-chal">${chalOpts}</select>
        </div>
        <p>${escapeHtml(ch.prompt)}</p>
        ${
          state.challengeHint
            ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
            : ""
        }
        ${quizHtml}
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="bd-chal-start">${
            state.challengeOn ? "Restart" : "Start"
          }</button>
          <button type="button" class="btn btn-ghost" id="bd-chal-hint">${
            state.challengeHint ? "Hide hint" : "Show hint"
          }</button>
          <button type="button" class="btn btn-ghost" id="bd-chal-check">Check</button>
          <button type="button" class="btn btn-ghost" id="bd-chal-next" ${passed ? "" : "disabled"}>Next</button>
          <button type="button" class="btn btn-ghost" id="bd-chal-stop" ${
            state.challengeOn ? "" : "disabled"
          }>Stop</button>
          <span class="challenge-status ${passed ? "pass" : "idle"}">${
            passed ? "Matched" : state.challengeOn ? "In progress" : "Idle"
          }</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Integrate</h2></div>
        <div class="panel-body">
          <div class="bd-preset-grid">${presetBtns}</div>
          <div class="rule-box">Click <strong>out</strong> port, then <strong>in</strong> port · types must match · required edges listed below</div>
          <div class="verdict ${v.ok ? "ok" : v.illegal ? "bad" : "warn"}">${
            v.ok
              ? "Integration OK — required wires present"
              : v.illegal
                ? `${v.illegal} illegal wire(s)`
                : `Incomplete — ${v.missing.length} required missing`
          }</div>
          <div class="bd-toolbar">
            <button type="button" class="btn btn-ghost" id="bd-clear-sel">Clear selection</button>
            <button type="button" class="btn btn-ghost" id="bd-clear-wires">Clear all wires</button>
            <button type="button" class="btn btn-secondary" id="bd-autoload">Autofill required</button>
          </div>
          <div class="canvas-wrap" id="canvas">
            <div class="blocks">${blocksHtml}</div>
          </div>
          ${missingHtml}
          <p class="bd-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
          <p class="bd-hint">Pending: ${
            state.pendingFrom ? escapeHtml(state.pendingFrom) : "(none)"
          }</p>
          <h3 class="bd-hint" style="font-weight:650;color:var(--ink)">Connections</h3>
          <ul class="conn-list">${connHtml}</ul>
        </div>
      </div>
    `;

    // Draw wires after layout
    requestAnimationFrame(() => {
      const canvas = root.querySelector("#canvas");
      if (!canvas) return;
      const old = canvas.querySelector(".wire-svg");
      if (old) old.remove();
      canvas.insertAdjacentHTML("afterbegin", renderWiresSvg());
    });

    bind();
    persist();
  }

  function bind() {
    root.querySelector("#bd-starter")?.addEventListener("click", () => {
      loadStarter();
      render();
    });
    root.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        loadPreset(btn.getAttribute("data-preset"));
        render();
      });
    });
    root.querySelector("#bd-clear-sel")?.addEventListener("click", () => {
      state.pendingFrom = "";
      state.msg = "Selection cleared.";
      state.msgOk = true;
      render();
    });
    root.querySelector("#bd-clear-wires")?.addEventListener("click", () => {
      state.wires = [];
      state.pendingFrom = "";
      state.msg = "All wires cleared.";
      state.msgOk = true;
      render();
    });
    root.querySelector("#bd-autoload")?.addEventListener("click", () => {
      const id =
        state.presetId === "with_bus"
          ? "with_bus"
          : state.presetId === "blank" || state.presetId === "starter" || state.presetId === "complete"
            ? "complete"
            : "complete";
      if (id === "with_bus") {
        loadPreset("with_bus", { announce: false });
      } else {
        // Keep current blocks; apply complete wires that fit
        const complete = PRESETS.complete;
        state.wires = cloneWires(
          complete.wires.filter((w) => {
            const a = parsePort(w.from).block;
            const b = parsePort(w.to).block;
            return state.blockIds.includes(a) && state.blockIds.includes(b);
          })
        );
        if (!state.required.length) state.required = complete.required.slice();
      }
      state.pendingFrom = "";
      state.msg = "Autofilled required-style wiring.";
      state.msgOk = true;
      render();
    });

    root.querySelectorAll("[data-pref]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ref = btn.getAttribute("data-pref");
        const dir = btn.getAttribute("data-dir");
        if (dir === "out") {
          state.pendingFrom = ref;
          state.msg = `Selected ${ref} — now click an input.`;
          state.msgOk = true;
          render();
          return;
        }
        tryConnect(ref);
        render();
      });
    });

    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-del");
        state.wires = state.wires.filter((w) => wireKey(w.from, w.to) !== key);
        state.msg = `Removed ${key}`;
        state.msgOk = true;
        render();
      });
    });

    root.querySelector("#bd-chal")?.addEventListener("change", (e) => {
      state.challengeId = e.target.value;
      state.challengeOn = false;
      state.challengeHint = false;
      state.quizChoice = "";
      render();
    });
    root.querySelector("#bd-chal-start")?.addEventListener("click", () => {
      const ch = challengeById(state.challengeId);
      state.challengeOn = true;
      state.challengeHint = false;
      state.quizChoice = "";
      if (ch.type === "run") {
        if (ch.id === "run-complete-load") loadPreset("complete", { announce: false });
        else if (ch.id === "run-blank-build") loadPreset("blank", { announce: false });
        else if (ch.id === "run-bus-preset") loadPreset("with_bus", { announce: false });
        else if (ch.id === "run-clear-one") loadPreset("complete", { announce: false });
        else if (ch.id === "run-finish-starter" || ch.id === "run-starter")
          loadPreset("starter", { announce: false });
        else loadPreset("starter", { announce: false });
      }
      state.msg = `Challenge “${ch.title}” — ${ch.prompt}`;
      state.msgOk = true;
      render();
    });
    root.querySelector("#bd-chal-hint")?.addEventListener("click", () => {
      state.challengeHint = !state.challengeHint;
      render();
    });
    root.querySelector("#bd-chal-check")?.addEventListener("click", () => {
      state.challengeOn = true;
      noteCleared();
      const ok = challengePassed();
      state.msg = ok ? "Challenge matched." : "Not yet — keep going.";
      state.msgOk = ok;
      render();
    });
    root.querySelector("#bd-chal-next")?.addEventListener("click", () => {
      const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
      state.challengeId = CHALLENGES[(i + 1) % CHALLENGES.length].id;
      state.challengeOn = false;
      state.challengeHint = false;
      state.quizChoice = "";
      render();
    });
    root.querySelector("#bd-chal-stop")?.addEventListener("click", () => {
      state.challengeOn = false;
      render();
    });
    root.querySelectorAll('input[name="bd-quiz"]').forEach((inp) => {
      inp.addEventListener("change", () => {
        state.quizChoice = inp.value;
        if (state.challengeOn) noteCleared();
        render();
      });
    });
  }

  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) state.clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  if (!tryRestore()) loadStarter();
  else {
    if (!state.blockIds.length) loadStarter();
    else {
      state.msg = "Session restored — click ports to wire.";
      state.msgOk = true;
    }
  }
  render();
})();
