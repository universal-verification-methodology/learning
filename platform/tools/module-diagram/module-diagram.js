import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-module-diagram-v1";
const CLEARED_KEY = "ddv-module-diagram-cleared-v1";

/** @type {any} */
let hdl = null;

const PRESETS = {
  and2: {
    id: "and2",
    title: "and2 (starter)",
    blurb: "One module, two inputs, one output — classic port picture.",
    focus: "and2",
    source: `module and2(
  input  a,
  input  b,
  output y
);
  assign y = a & b;
endmodule
`,
  },
  hierarchy: {
    id: "hierarchy",
    title: "top + and2 instance",
    blurb: "Parent instantiates child with named port connects.",
    focus: "top",
    source: `module and2(
  input  a,
  input  b,
  output y
);
  assign y = a & b;
endmodule

module top(
  input  a,
  input  b,
  output y
);
  and2 u0(
    .a(a),
    .b(b),
    .y(y)
  );
endmodule
`,
  },
  counter: {
    id: "counter",
    title: "Counter ports",
    blurb: "clk / rst_n / enable / q[3:0] — mixed directions & a bus.",
    focus: "counter",
    source: `module counter(
  input        clk,
  input        rst_n,
  input        en,
  output [3:0] q
);
  // body omitted — ports are the lesson
endmodule
`,
  },
  param_gate: {
    id: "param_gate",
    title: "Parameterized slice",
    blurb: "#(.WIDTH(8)) on an instance — parameters + ports.",
    focus: "top",
    source: `module bus_slice #(
  parameter WIDTH = 8
) (
  input  [WIDTH-1:0] din,
  output [WIDTH-1:0] dout
);
  assign dout = din;
endmodule

module top;
  wire [7:0] x, y;
  bus_slice #(.WIDTH(8)) u_slice(
    .din(x),
    .dout(y)
  );
endmodule
`,
  },
  dual: {
    id: "dual",
    title: "Two instances",
    blurb: "top wires two and2 gates — hierarchy list grows.",
    focus: "top",
    source: `module and2(
  input  a,
  input  b,
  output y
);
  assign y = a & b;
endmodule

module top(
  input  a0,
  input  b0,
  input  a1,
  input  b1,
  output y0,
  output y1
);
  and2 u0(.a(a0), .b(b0), .y(y0));
  and2 u1(.a(a1), .b(b1), .y(y1));
endmodule
`,
  },
};

const CHALLENGES = [
  {
    id: "quiz-module",
    title: "Quiz: module",
    type: "quiz",
    prompt: "A Verilog module…",
    hint: "Boundary.",
    choices: [
      "defines a named design unit with ports (and optional internals)",
      "is only a $finish call",
      "must be analog",
      "cannot be instantiated",
    ],
    answer: "defines a named design unit with ports (and optional internals)",
  },
  {
    id: "quiz-port",
    title: "Quiz: port",
    type: "quiz",
    prompt: "A port is…",
    hint: "Interface.",
    choices: [
      "a named connection on the module boundary (input / output / inout)",
      "always a parameter",
      "only legal inside always_ff",
      "a GTKWave marker",
    ],
    answer: "a named connection on the module boundary (input / output / inout)",
  },
  {
    id: "quiz-input",
    title: "Quiz: input",
    type: "quiz",
    prompt: "An input port…",
    hint: "Driven from outside.",
    choices: [
      "is driven by the parent / testbench into this module",
      "must drive the parent",
      "is the same as a parameter",
      "cannot appear on and2",
    ],
    answer: "is driven by the parent / testbench into this module",
  },
  {
    id: "quiz-output",
    title: "Quiz: output",
    type: "quiz",
    prompt: "An output port…",
    hint: "Driven inside.",
    choices: [
      "is driven by this module toward the parent",
      "must be undriven forever",
      "is only for clocks",
      "forbids named connects",
    ],
    answer: "is driven by this module toward the parent",
  },
  {
    id: "quiz-instance",
    title: "Quiz: instance",
    type: "quiz",
    prompt: "Instantiating a module creates…",
    hint: "Child.",
    choices: [
      "a named child instance of that module type inside the parent",
      "a new programming language",
      "a VCD file automatically",
      "a forbidden hierarchy",
    ],
    answer: "a named child instance of that module type inside the parent",
  },
  {
    id: "quiz-named",
    title: "Quiz: named connect",
    type: "quiz",
    prompt: "`.a(a)` means…",
    hint: "Port ← expression.",
    choices: [
      "connect formal port a to actual expression a (named port association)",
      "declare a new module named a",
      "delete port a",
      "set parameter a only",
    ],
    answer: "connect formal port a to actual expression a (named port association)",
  },
  {
    id: "quiz-param",
    title: "Quiz: parameter",
    type: "quiz",
    prompt: "#(.WIDTH(8)) on an instance…",
    hint: "Override.",
    choices: [
      "overrides the child’s parameter WIDTH for that instance",
      "renames the instance to WIDTH",
      "is a port direction",
      "ends simulation",
    ],
    answer: "overrides the child’s parameter WIDTH for that instance",
  },
  {
    id: "quiz-hier",
    title: "Quiz: hierarchy",
    type: "quiz",
    prompt: "Design hierarchy is…",
    hint: "Tree.",
    choices: [
      "the tree of parent modules and child instances",
      "only the clock period",
      "a flat list of $display calls",
      "FPGA pin GPS data",
    ],
    answer: "the tree of parent modules and child instances",
  },
  {
    id: "quiz-ansi",
    title: "Quiz: ANSI ports",
    type: "quiz",
    prompt: "ANSI-style port lists put direction…",
    hint: "In the header.",
    choices: [
      "in the module header next to each port name (modern style)",
      "only inside GTKWave",
      "after $finish",
      "in the Makefile",
    ],
    answer: "in the module header next to each port name (modern style)",
  },
  {
    id: "quiz-inout",
    title: "Quiz: inout",
    type: "quiz",
    prompt: "inout ports…",
    hint: "Bidirectional.",
    choices: [
      "are bidirectional — use carefully (buses / pads); rarer in simple RTL",
      "mean input twice",
      "are required on every FF",
      "replace always blocks",
    ],
    answer: "are bidirectional — use carefully (buses / pads); rarer in simple RTL",
  },
  {
    id: "run-starter",
    title: "Load and2",
    type: "run",
    prompt: "Load the and2 starter preset and focus module and2.",
    hint: "Starter / preset.",
    check: (st) => st.presetId === "and2" && st.focus === "and2",
  },
  {
    id: "run-port-a",
    title: "Select port a",
    type: "run",
    prompt: "On and2, click port a (input).",
    hint: "Left/inputs column.",
    check: (st) =>
      st.focus === "and2" && st.selectedPort === "a" && portDir(st, "and2", "a") === "input",
  },
  {
    id: "run-port-y",
    title: "Select port y",
    type: "run",
    prompt: "On and2, select output y.",
    hint: "Outputs column.",
    check: (st) =>
      st.focus === "and2" && st.selectedPort === "y" && portDir(st, "and2", "y") === "output",
  },
  {
    id: "run-count-ports",
    title: "and2 has 3 ports",
    type: "run",
    prompt: "and2 starter: model should report exactly 3 ports.",
    hint: "a, b, y.",
    check: (st) => {
      const m = modByName(st.model, "and2");
      return st.presetId === "and2" && m && m.ports.length === 3;
    },
  },
  {
    id: "run-hier-top",
    title: "Load hierarchy",
    type: "run",
    prompt: "Load “top + and2 instance” and focus top.",
    hint: "Hierarchy preset.",
    check: (st) => st.presetId === "hierarchy" && st.focus === "top",
  },
  {
    id: "run-find-u0",
    title: "See instance u0",
    type: "run",
    prompt: "Hierarchy preset focused on top: instance list includes u0 of type and2.",
    hint: "Child card.",
    check: (st) => {
      const m = modByName(st.model, "top");
      return (
        st.presetId === "hierarchy" &&
        m &&
        m.instances.some((i) => i.name === "u0" && i.module === "and2")
      );
    },
  },
  {
    id: "run-focus-child",
    title: "Focus and2 type",
    type: "run",
    prompt: "From hierarchy preset, switch focus to module and2 (type definition).",
    hint: "Hierarchy list / view select.",
    check: (st) => st.presetId === "hierarchy" && st.focus === "and2",
  },
  {
    id: "run-counter-bus",
    title: "Counter q bus",
    type: "run",
    prompt: "Counter preset: select port q (output bus).",
    hint: "Load counter, click q.",
    check: (st) =>
      st.presetId === "counter" && st.selectedPort === "q" && portDir(st, "counter", "q") === "output",
  },
  {
    id: "run-param-inst",
    title: "Parameterized instance",
    type: "run",
    prompt: "Parameterized slice preset: top has instance u_slice of bus_slice.",
    hint: "Load param preset.",
    check: (st) => {
      const m = modByName(st.model, "top");
      return (
        st.presetId === "param_gate" &&
        m &&
        m.instances.some((i) => i.name === "u_slice" && i.module === "bus_slice")
      );
    },
  },
  {
    id: "run-param-width",
    title: "WIDTH override",
    type: "run",
    prompt: "Parameterized preset: u_slice has named param WIDTH=8.",
    hint: "Param chips on the instance.",
    check: (st) => {
      const m = modByName(st.model, "top");
      const inst = m?.instances.find((i) => i.name === "u_slice");
      return st.presetId === "param_gate" && inst && inst.params.some((p) => p.name === "WIDTH" && p.value === "8");
    },
  },
  {
    id: "run-dual-two",
    title: "Two instances",
    type: "run",
    prompt: "Two-instances preset: top contains u0 and u1.",
    hint: "Load dual preset.",
    check: (st) => {
      const m = modByName(st.model, "top");
      if (!m || st.presetId !== "dual") return false;
      const names = m.instances.map((i) => i.name);
      return names.includes("u0") && names.includes("u1");
    },
  },
  {
    id: "run-parse-ok",
    title: "Parse succeeds",
    type: "run",
    prompt: "Any preset/paste that parses with no error (status ok).",
    hint: "Fix syntax if red.",
    check: (st) => st.parseOk && st.model && st.model.modules.length > 0,
  },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function modByName(model, name) {
  return model?.modules?.find((m) => m.name === name) || null;
}

function portDir(st, modName, portName) {
  const m = modByName(st.model, modName);
  const p = m?.ports.find((x) => x.name === portName);
  return p?.direction || null;
}

function exprToStr(e) {
  if (!e) return "?";
  if (e.type === "Number") return String(e.value);
  if (e.type === "Ident") return e.name;
  if (e.type === "Binary") return `${exprToStr(e.left)}${e.op}${exprToStr(e.right)}`;
  if (e.type === "Unary") return `${e.op}${exprToStr(e.expr || e.right || e.arg)}`;
  if (e.type === "Concat") return `{…}`;
  return e.type || "?";
}

function rangeToStr(range, width) {
  if (range?.msb && range?.lsb) {
    return `[${exprToStr(range.msb)}:${exprToStr(range.lsb)}]`;
  }
  if (width != null && width > 1) return `[${width - 1}:0]`;
  return "";
}

/**
 * @param {any} ast
 */
function modelFromAst(ast) {
  const modules = (ast.modules || []).map((m) => {
    const ports = (m.ports || []).map((p) => ({
      name: p.name,
      direction: p.direction || "inout",
      kind: p.kind || "wire",
      rangeText: rangeToStr(p.range, p.width),
    }));
    const parameters = (m.parameters || []).map((p) => ({
      name: p.name,
      value: exprToStr(p.expr),
    }));
    const instances = [];
    for (const it of m.items || []) {
      if (it.type !== "Instance") continue;
      instances.push({
        name: it.name,
        module: it.module,
        params: (it.params || []).map((p) => ({
          name: p.name || p.type,
          value: exprToStr(p.expr),
        })),
        conns: (it.conns || []).map((c) => ({
          port: c.port || c.name || "?",
          expr: exprToStr(c.expr),
        })),
      });
    }
    return { name: m.name, ports, parameters, instances };
  });
  return { modules };
}

const state = {
  presetId: "and2",
  source: PRESETS.and2.source,
  focus: "and2",
  model: null,
  parseOk: false,
  parseErr: "",
  selectedPort: "",
  selectedInst: "",
  msg: "",
  msgOk: true,
  challengeId: "quiz-module",
  challengeOn: false,
  challengeHint: false,
  quizChoice: "",
  clearedIds: [],
};

function challengeById(id) {
  return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
}

function reparse() {
  if (!hdl || typeof hdl.parse !== "function") {
    state.parseOk = false;
    state.parseErr = "HDL parse() not available";
    state.model = null;
    return;
  }
  try {
    const ast = hdl.parse(state.source);
    state.model = modelFromAst(ast);
    state.parseOk = true;
    state.parseErr = "";
    const names = state.model.modules.map((m) => m.name);
    if (!names.includes(state.focus)) {
      state.focus = names[0] || "";
    }
    const m = modByName(state.model, state.focus);
    if (m && state.selectedPort && !m.ports.some((p) => p.name === state.selectedPort)) {
      state.selectedPort = "";
    }
  } catch (e) {
    state.parseOk = false;
    state.parseErr = e.message || String(e);
    state.model = null;
  }
}

function loadPreset(id, opts = {}) {
  const { announce = true } = opts;
  const p = PRESETS[id];
  if (!p) return;
  state.presetId = id;
  state.source = p.source;
  state.focus = p.focus;
  state.selectedPort = "";
  state.selectedInst = "";
  reparse();
  if (announce) {
    state.msg = `Loaded ${p.title}.`;
    state.msgOk = state.parseOk;
  }
}

function loadStarter() {
  state.challengeOn = false;
  state.challengeHint = false;
  loadPreset("and2");
  state.msg = "Starter: and2 — click ports a / b / y to inspect directions.";
  state.msgOk = true;
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
  const id = state.challengeId;
  if (!state.clearedIds.includes(id)) {
    state.clearedIds = [...state.clearedIds, id];
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
        source: state.source,
        focus: state.focus,
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
    if (typeof d.source === "string" && d.source.trim()) state.source = d.source;
    if (typeof d.focus === "string") state.focus = d.focus;
    if (d.challengeId && challengeById(d.challengeId)) state.challengeId = d.challengeId;
    return true;
  } catch {
    return false;
  }
}

const root = document.getElementById("md-root");

function renderPortBtn(p) {
  const active = state.selectedPort === p.name ? " active" : "";
  const dirCls = `dir-${p.direction}`;
  const range = p.rangeText ? ` ${escapeHtml(p.rangeText)}` : "";
  return `<li><button type="button" class="port-btn ${dirCls}${active}" data-port="${escapeHtml(
    p.name
  )}">
    <span>${escapeHtml(p.name)}${range}</span>
    <span class="dir">${escapeHtml(p.direction)}</span>
  </button></li>`;
}

function renderModuleCard(m, opts = {}) {
  const { child = false, instName = "" } = opts;
  const inputs = m.ports.filter((p) => p.direction === "input");
  const outputs = m.ports.filter((p) => p.direction === "output");
  const other = m.ports.filter((p) => p.direction !== "input" && p.direction !== "output");
  const focusCls = !child && m.name === state.focus ? " is-focus" : "";
  const title = child ? `${instName} : ${m.name}` : m.name;
  const kind = child ? "instance" : "module";

  const params =
    m.parameters?.length || opts.instParams?.length
      ? `<div class="param-chips">${(opts.instParams || m.parameters || [])
          .map((p) => `<span>#(.${escapeHtml(p.name)}(${escapeHtml(p.value)}))</span>`)
          .join("")}</div>`
      : "";

  let instHtml = "";
  if (!child && m.instances.length) {
    instHtml = `<div class="inst-block"><h3>Instances inside ${escapeHtml(m.name)}</h3>`;
    for (const inst of m.instances) {
      const childMod = modByName(state.model, inst.module) || {
        name: inst.module,
        ports: inst.conns.map((c) => ({
          name: c.port,
          direction: "inout",
          rangeText: "",
        })),
        parameters: [],
        instances: [],
      };
      const hlPort = state.selectedPort;
      const connRows = inst.conns
        .map((c) => {
          const hl = hlPort && (c.port === hlPort || c.expr === hlPort) ? " hl" : "";
          return `<tr class="${hl}"><td>.${escapeHtml(c.port)}</td><td>${escapeHtml(c.expr)}</td></tr>`;
        })
        .join("");
      instHtml += `
        <div class="mod-card child">
          <div class="mod-head">
            <span class="mod-name">${escapeHtml(inst.name)} : ${escapeHtml(inst.module)}</span>
            <span class="mod-kind">instance</span>
          </div>
          ${
            inst.params.length
              ? `<div class="param-chips">${inst.params
                  .map((p) => `<span>#(.${escapeHtml(p.name)}(${escapeHtml(p.value)}))</span>`)
                  .join("")}</div>`
              : ""
          }
          <table class="conn-table">
            <thead><tr><th>Port</th><th>Actual</th></tr></thead>
            <tbody>${connRows || `<tr><td colspan="2">(no named connects)</td></tr>`}</tbody>
          </table>
          <p class="md-hint" style="margin-top:0.45rem">Type definition ports (${escapeHtml(
            childMod.ports.length
          )}): ${childMod.ports.map((p) => escapeHtml(p.name)).join(", ") || "—"}</p>
        </div>`;
    }
    instHtml += `</div>`;
  }

  return `
    <div class="mod-card${child ? " child" : ""}${focusCls}">
      <div class="mod-head">
        <span class="mod-name">${escapeHtml(title)}</span>
        <span class="mod-kind">${kind}</span>
      </div>
      ${params}
      <div class="port-columns">
        <div class="port-col">
          <h3>Inputs</h3>
          <ul class="port-list">${
            inputs.map(renderPortBtn).join("") || `<li class="md-hint">None</li>`
          }</ul>
        </div>
        <div class="port-col">
          <h3>Outputs / other</h3>
          <ul class="port-list">${
            [...outputs, ...other].map(renderPortBtn).join("") || `<li class="md-hint">None</li>`
          }</ul>
        </div>
      </div>
      ${instHtml}
    </div>`;
}

function renderDetail() {
  const m = modByName(state.model, state.focus);
  if (!m || !state.selectedPort) {
    return `<div class="detail-card"><h3>Port detail</h3><p>Click a port pin to see its direction and role.</p></div>`;
  }
  const p = m.ports.find((x) => x.name === state.selectedPort);
  if (!p) return "";
  const role =
    p.direction === "input"
      ? "Driven from outside into this module."
      : p.direction === "output"
        ? "Driven by this module toward the parent / TB."
        : "Bidirectional — both sides may drive (careful).";
  return `<div class="detail-card">
    <h3>${escapeHtml(m.name)}.${escapeHtml(p.name)}</h3>
    <p><strong>${escapeHtml(p.direction)}</strong>${
      p.rangeText ? ` ${escapeHtml(p.rangeText)}` : ""
    } · ${escapeHtml(role)}</p>
  </div>`;
}

function render() {
  noteCleared();
  const ch = challengeById(state.challengeId);
  const passed = challengePassed();
  const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;

  const presetBtns = Object.values(PRESETS)
    .map(
      (pr) => `
      <button type="button" class="${pr.id === state.presetId ? "is-active" : ""}" data-preset="${pr.id}">
        <span class="title">${escapeHtml(pr.title)}</span>
        <span class="meta">${escapeHtml(pr.blurb)}</span>
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
          `<label><input type="radio" name="md-quiz" value="${escapeHtml(c)}" ${
            state.quizChoice === c ? "checked" : ""
          }> ${escapeHtml(c)}</label>`
      )
      .join("")}</div>`;
  }

  const modNames = state.model?.modules.map((m) => m.name) || [];
  const focusOpts = modNames
    .map((n) => `<option value="${escapeHtml(n)}" ${n === state.focus ? "selected" : ""}>${escapeHtml(n)}</option>`)
    .join("");

  const hier = (state.model?.modules || [])
    .map((m) => {
      const kids = m.instances
        .map((i) => `<div class="path">└─ ${escapeHtml(i.name)} : ${escapeHtml(i.module)}</div>`)
        .join("");
      return `<li><button type="button" data-focus="${escapeHtml(m.name)}">${escapeHtml(
        m.name
      )}</button> <span class="path">(${m.ports.length} ports, ${m.instances.length} inst)</span>${kids}</li>`;
    })
    .join("");

  const focusMod = modByName(state.model, state.focus);
  const diagram = state.parseOk && focusMod
    ? renderModuleCard(focusMod) + renderDetail()
    : `<p class="md-msg err">${escapeHtml(state.parseErr || "Nothing to draw — fix parse errors.")}</p>`;

  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>and2(input a, b, output y)</code> — parse ports and click pins.
      Try the hierarchy preset to see instance <code>u0</code>.</p>
      <button type="button" class="btn btn-secondary" id="md-starter">Load starter example</button>
    </div>

    <div class="challenge">
      <h2>Challenges <span class="md-hint">${clearedCount}/${CHALLENGES.length}</span></h2>
      <div class="md-field" style="margin-bottom:0.5rem">
        <label for="md-chal">Pick one</label>
        <select id="md-chal">${chalOpts}</select>
      </div>
      <p>${escapeHtml(ch.prompt)}</p>
      ${
        state.challengeHint
          ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
          : ""
      }
      ${quizHtml}
      <div class="tool-actions">
        <button type="button" class="btn btn-secondary" id="md-chal-start">${
          state.challengeOn ? "Restart" : "Start"
        }</button>
        <button type="button" class="btn btn-ghost" id="md-chal-hint">${
          state.challengeHint ? "Hide hint" : "Show hint"
        }</button>
        <button type="button" class="btn btn-ghost" id="md-chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="md-chal-next" ${passed ? "" : "disabled"}>Next</button>
        <button type="button" class="btn btn-ghost" id="md-chal-stop" ${
          state.challengeOn ? "" : "disabled"
        }>Stop</button>
        <span class="challenge-status ${passed ? "pass" : "idle"}">${
          passed ? "Matched" : state.challengeOn ? "In progress" : "Idle"
        }</span>
      </div>
    </div>

    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Source</h2></div>
        <div class="panel-body">
          <div class="md-preset-grid">${presetBtns}</div>
          <textarea class="md-source" id="md-source" spellcheck="false">${escapeHtml(
            state.source
          )}</textarea>
          <div class="tool-actions" style="margin-top:0.55rem">
            <button type="button" class="btn btn-primary" id="md-parse">Parse / redraw</button>
            <button type="button" class="btn btn-ghost" id="md-reset-src">Reset to preset text</button>
          </div>
          <p class="md-msg ${state.parseOk ? "ok" : "err"}">${
            state.parseOk
              ? `Parsed ${state.model.modules.length} module(s).`
              : escapeHtml(state.parseErr || "Parse failed")
          }</p>
          <p class="md-hint">Uses the HDL engine <code>parse</code> API — teaching subset, not a full LRM front-end.</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Hierarchy</h2></div>
        <div class="panel-body">
          <div class="md-controls">
            <div class="md-field">
              <label for="md-focus">View module</label>
              <select id="md-focus">${focusOpts || `<option value="">(none)</option>`}</select>
            </div>
          </div>
          <ul class="hier-list">${hier || `<li class="md-hint">No modules yet</li>`}</ul>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Port diagram</h2></div>
      <div class="panel-body">
        <div class="diagram-panel">${diagram}</div>
        <p class="md-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
      </div>
    </div>
  `;

  bind();
  persist();
}

function bind() {
  root.querySelector("#md-starter")?.addEventListener("click", () => {
    loadStarter();
    render();
  });
  root.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadPreset(btn.getAttribute("data-preset"));
      render();
    });
  });
  root.querySelector("#md-parse")?.addEventListener("click", () => {
    state.source = root.querySelector("#md-source").value;
    state.presetId = "custom";
    reparse();
    state.msg = state.parseOk ? "Redrawn from pasted source." : "Parse error — see message.";
    state.msgOk = state.parseOk;
    render();
  });
  root.querySelector("#md-reset-src")?.addEventListener("click", () => {
    const p = PRESETS[state.presetId] || PRESETS.and2;
    if (PRESETS[state.presetId]) {
      state.source = p.source;
      state.focus = p.focus;
    } else {
      loadPreset("and2", { announce: false });
    }
    reparse();
    state.msg = "Source reset.";
    state.msgOk = true;
    render();
  });
  root.querySelector("#md-focus")?.addEventListener("change", (e) => {
    state.focus = e.target.value;
    state.selectedPort = "";
    render();
  });
  root.querySelectorAll("[data-focus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.focus = btn.getAttribute("data-focus");
      state.selectedPort = "";
      render();
    });
  });
  root.querySelectorAll("[data-port]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedPort = btn.getAttribute("data-port");
      state.msg = `Selected port ${state.focus}.${state.selectedPort}`;
      state.msgOk = true;
      render();
    });
  });

  root.querySelector("#md-chal")?.addEventListener("change", (e) => {
    state.challengeId = e.target.value;
    state.challengeOn = false;
    state.challengeHint = false;
    state.quizChoice = "";
    render();
  });
  root.querySelector("#md-chal-start")?.addEventListener("click", () => {
    const ch = challengeById(state.challengeId);
    state.challengeOn = true;
    state.challengeHint = false;
    state.quizChoice = "";
    if (ch.type === "run") {
      if (ch.id.includes("hier") || ch.id === "run-find-u0" || ch.id === "run-focus-child")
        loadPreset("hierarchy", { announce: false });
      else if (ch.id.includes("counter")) loadPreset("counter", { announce: false });
      else if (ch.id.includes("param")) loadPreset("param_gate", { announce: false });
      else if (ch.id.includes("dual")) loadPreset("dual", { announce: false });
      else if (ch.id !== "run-parse-ok") loadPreset("and2", { announce: false });
    }
    state.msg = `Challenge “${ch.title}” — ${ch.prompt}`;
    state.msgOk = true;
    render();
  });
  root.querySelector("#md-chal-hint")?.addEventListener("click", () => {
    state.challengeHint = !state.challengeHint;
    render();
  });
  root.querySelector("#md-chal-check")?.addEventListener("click", () => {
    state.challengeOn = true;
    noteCleared();
    const ok = challengePassed();
    state.msg = ok ? "Challenge matched." : "Not yet — keep going.";
    state.msgOk = ok;
    render();
  });
  root.querySelector("#md-chal-next")?.addEventListener("click", () => {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    state.challengeId = CHALLENGES[(i + 1) % CHALLENGES.length].id;
    state.challengeOn = false;
    state.challengeHint = false;
    state.quizChoice = "";
    render();
  });
  root.querySelector("#md-chal-stop")?.addEventListener("click", () => {
    state.challengeOn = false;
    render();
  });
  root.querySelectorAll('input[name="md-quiz"]').forEach((inp) => {
    inp.addEventListener("change", () => {
      state.quizChoice = inp.value;
      if (state.challengeOn) noteCleared();
      render();
    });
  });
}

async function main() {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) state.clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  root.innerHTML = `<p class="md-hint">Loading HDL engine…</p>`;
  try {
    hdl = await loadHdlEngine();
    if (typeof hdl.parse !== "function") throw new Error("parse() missing from engine.mjs");
    tryRestore();
    reparse();
    if (!state.parseOk) loadStarter();
    else {
      state.msg = "Ready — click ports or load a hierarchy preset.";
      state.msgOk = true;
    }
    render();
  } catch (e) {
    root.innerHTML = `<p class="md-msg err">Failed to load HDL engine: ${escapeHtml(
      e.message || String(e)
    )}</p>`;
  }
}

main();
