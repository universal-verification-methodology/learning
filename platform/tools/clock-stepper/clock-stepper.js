import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-clock-stepper-v1";

const PRESETS = {
  dff: {
    id: "dff",
    title: "D flip-flop",
    blurb: "q <= d on every posedge clk. Poke d, then ↗posedge.",
    watch: ["clk", "d", "q"],
    pokeFields: [{ name: "d", label: "D", width: 1 }],
    clock: "clk",
    source: `module dff(input clk, input d, output reg q);
  always @(posedge clk) q <= d;
endmodule
module tb;
  reg clk, d;
  wire q;
  dff uut(.clk(clk), .d(d), .q(q));
  initial begin
    clk = 0;
    d = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  reg_en: {
    id: "reg_en",
    title: "Register + enable",
    blurb: "q updates only when en=1 on posedge.",
    watch: ["clk", "en", "d", "q"],
    pokeFields: [
      { name: "d", label: "D", width: 1 },
      { name: "en", label: "EN", width: 1 },
    ],
    clock: "clk",
    source: `module reg_en(input clk, input en, input d, output reg q);
  always @(posedge clk) if (en) q <= d;
endmodule
module tb;
  reg clk, en, d;
  wire q;
  reg_en uut(.clk(clk), .en(en), .d(d), .q(q));
  initial begin
    clk = 0; en = 0; d = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  tff: {
    id: "tff",
    title: "T flip-flop",
    blurb: "When T=1, Q toggles each posedge; T=0 holds.",
    watch: ["clk", "rst", "t", "q"],
    pokeFields: [
      { name: "rst", label: "RST", width: 1 },
      { name: "t", label: "T", width: 1 },
    ],
    clock: "clk",
    source: `module tff(input clk, input rst, input t, output reg q);
  always @(posedge clk) begin
    if (rst) q <= 1'b0;
    else if (t) q <= ~q;
  end
endmodule
module tb;
  reg clk, rst, t;
  wire q;
  tff uut(.clk(clk), .rst(rst), .t(t), .q(q));
  initial begin
    clk = 0; rst = 1; t = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  counter: {
    id: "counter",
    title: "4-bit counter",
    blurb: "Sync reset: RST=1 clears on posedge; then RST=0 to count.",
    watch: ["clk", "rst", "q"],
    pokeFields: [{ name: "rst", label: "RST", width: 1 }],
    clock: "clk",
    source: `module counter(input clk, input rst, output reg [3:0] q);
  always @(posedge clk) begin
    if (rst) q <= 4'b0000;
    else q <= q + 4'b0001;
  end
endmodule
module tb;
  reg clk, rst;
  wire [3:0] q;
  counter uut(.clk(clk), .rst(rst), .q(q));
  initial begin
    clk = 0;
    rst = 1;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  updown: {
    id: "updown",
    title: "Up / down counter",
    blurb: "DIR=1 counts up, DIR=0 counts down (after clear).",
    watch: ["clk", "rst", "dir", "q"],
    pokeFields: [
      { name: "rst", label: "RST", width: 1 },
      { name: "dir", label: "DIR", width: 1 },
    ],
    clock: "clk",
    source: `module updown(input clk, input rst, input dir, output reg [3:0] q);
  always @(posedge clk) begin
    if (rst) q <= 4'b0000;
    else if (dir) q <= q + 4'b0001;
    else q <= q - 4'b0001;
  end
endmodule
module tb;
  reg clk, rst, dir;
  wire [3:0] q;
  updown uut(.clk(clk), .rst(rst), .dir(dir), .q(q));
  initial begin
    clk = 0; rst = 1; dir = 1;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  shift4: {
    id: "shift4",
    title: "4-bit shift register",
    blurb: "Serial in DIN; Q shifts left each posedge ({q[2:0], din}).",
    watch: ["clk", "rst", "din", "q"],
    pokeFields: [
      { name: "rst", label: "RST", width: 1 },
      { name: "din", label: "DIN", width: 1 },
    ],
    clock: "clk",
    source: `module shift4(input clk, input rst, input din, output reg [3:0] q);
  always @(posedge clk) begin
    if (rst) q <= 4'b0000;
    else q <= {q[2:0], din};
  end
endmodule
module tb;
  reg clk, rst, din;
  wire [3:0] q;
  shift4 uut(.clk(clk), .rst(rst), .din(din), .q(q));
  initial begin
    clk = 0; rst = 1; din = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  pipeline2: {
    id: "pipeline2",
    title: "2-stage pipeline",
    blurb: "q1 <= d; q2 <= q1 — two-cycle delay from D to Q2.",
    watch: ["clk", "d", "q1", "q2"],
    pokeFields: [{ name: "d", label: "D", width: 1 }],
    clock: "clk",
    source: `module pipe2(input clk, input d, output reg q1, output reg q2);
  always @(posedge clk) begin
    q1 <= d;
    q2 <= q1;
  end
endmodule
module tb;
  reg clk, d;
  wire q1, q2;
  pipe2 uut(.clk(clk), .d(d), .q1(q1), .q2(q2));
  initial begin
    clk = 0; d = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  loadreg: {
    id: "loadreg",
    title: "Loadable register",
    blurb: "When LOAD=1, Q takes D[3:0]; otherwise Q holds.",
    watch: ["clk", "load", "d", "q"],
    pokeFields: [
      { name: "load", label: "LOAD", width: 1 },
      { name: "d", label: "D", width: 4 },
    ],
    clock: "clk",
    source: `module loadreg(input clk, input load, input [3:0] d, output reg [3:0] q);
  always @(posedge clk) begin
    if (load) q <= d;
  end
endmodule
module tb;
  reg clk, load;
  reg [3:0] d;
  wire [3:0] q;
  loadreg uut(.clk(clk), .load(load), .d(d), .q(q));
  initial begin
    clk = 0; load = 0; d = 4'b0000;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
};

const CHALLENGES = [
  {
    id: "load-one",
    title: "Capture a 1",
    preset: "dff",
    prompt: "With the D-FF lab, poke D=1 and advance to a posedge so Q becomes 1.",
    hint: "Set D to 1, click ↗posedge clk.",
    check: (st) => st.presetId === "dff" && st.peek.q === "1",
  },
  {
    id: "then-zero",
    title: "Then clear",
    preset: "dff",
    prompt: "After Q is 1, poke D=0 and take another posedge so Q returns to 0.",
    hint: "D=0, then ↗posedge again.",
    check: (st) => st.presetId === "dff" && st.peek.q === "0" && st.edgeCount >= 2,
  },
  {
    id: "enable-gate",
    title: "Enable gate",
    preset: "reg_en",
    prompt: "On the enable register: with EN=0 and D=1, a posedge must leave Q unchanged (still 0).",
    hint: "Load preset, keep EN=0, set D=1, ↗posedge — Q stays 0/z until enabled.",
    check: (st) =>
      st.presetId === "reg_en" &&
      st.peek.en === "0" &&
      (st.peek.q === "0" || st.peek.q === "z") &&
      st.edgeCount >= 1,
  },
  {
    id: "toggle-twice",
    title: "Toggle twice",
    preset: "tff",
    prompt: "T flip-flop: clear with RST, then with T=1 take two posedges so Q returns to 0.",
    hint: "RST=1 → posedge → RST=0, T=1 → posedge (Q=1) → posedge (Q=0).",
    check: (st) => st.presetId === "tff" && st.peek.q === "0" && st.edgeCount >= 3,
  },
  {
    id: "count-up",
    title: "Count to 3",
    preset: "counter",
    prompt: "Counter lab: clear with RST=1 + posedge, set RST=0, then advance until Q is 0011.",
    hint: "Apply poke RST=1 → ↗posedge → RST=0 → Apply poke → ↗posedge ×3.",
    check: (st) => st.presetId === "counter" && st.peek.q === "0011",
  },
  {
    id: "shift-in",
    title: "Shift in 1010",
    preset: "shift4",
    prompt: "Shift register: clear, then shift DIN bits 1,0,1,0 (MSB first into the chain) until Q is 1010.",
    hint: "After reset, each posedge with DIN set: 1 → 0 → 1 → 0 (four edges).",
    check: (st) => st.presetId === "shift4" && st.peek.q === "1010",
  },
  {
    id: "pipe-delay",
    title: "Two-cycle delay",
    preset: "pipeline2",
    prompt: "Pipeline: set D=1, take two posedges so Q2 becomes 1 (Q1 was 1 one cycle earlier).",
    hint: "D=1 → posedge (q1=1,q2=?) → posedge (q2=1).",
    check: (st) => st.presetId === "pipeline2" && st.peek.q2 === "1" && st.edgeCount >= 2,
  },
  {
    id: "load-a5",
    title: "Load 0xA",
    preset: "loadreg",
    prompt: "Loadable register: LOAD=1, D=1010 (or 10), posedge so Q is 1010.",
    hint: "Set LOAD=1, D=1010 or 10, Apply poke, ↗posedge.",
    check: (st) => st.presetId === "loadreg" && st.peek.q === "1010",
  },
  {
    id: "en-capture-1",
    title: "Enable then load 1",
    preset: "reg_en",
    prompt: "Enable register: EN=1, D=1, Apply poke, ↗posedge so Q becomes 1.",
    hint: "Unlike the gate challenge, EN must be 1 to capture D.",
    check: (st) => st.presetId === "reg_en" && st.peek.en === "1" && st.peek.q === "1",
  },
  {
    id: "count-five",
    title: "Count to 5",
    preset: "counter",
    prompt: "Counter: clear (RST=1 + posedge), RST=0, advance until Q is 0101.",
    hint: "Reset edge, then five count posedges from 0000 → 0101.",
    check: (st) => st.presetId === "counter" && st.peek.q === "0101",
  },
  {
    id: "count-seven",
    title: "Count to 7",
    preset: "counter",
    prompt: "Counter: after clear, count up until Q is 0111 (decimal 7).",
    hint: "RST=1 → posedge → RST=0 → Apply poke → ↗posedge ×7.",
    check: (st) => st.presetId === "counter" && st.peek.q === "0111",
  },
  {
    id: "updown-wrap",
    title: "Count down after clear",
    preset: "updown",
    prompt: "Up/down: clear, set DIR=0, one posedge from 0000 — Q wraps to 1111.",
    hint: "RST=1 → posedge → RST=0, DIR=0 → Apply poke → ↗posedge.",
    check: (st) =>
      st.presetId === "updown" && st.peek.dir === "0" && st.peek.q === "1111" && st.edgeCount >= 2,
  },
  {
    id: "shift-all-ones",
    title: "Shift 1111",
    preset: "shift4",
    prompt: "Shift register: clear, then shift DIN=1 four times (MSB first) until Q is 1111.",
    hint: "After reset, four posedges each with DIN=1.",
    check: (st) => st.presetId === "shift4" && st.peek.q === "1111",
  },
  {
    id: "shift-lsb-one",
    title: "Shift 0001",
    preset: "shift4",
    prompt: "Shift register: clear, then shift DIN bits 0,0,0,1 (MSB first) so Q is 0001.",
    hint: "Three zeros then a one — the 1 lands in the LSB.",
    check: (st) => st.presetId === "shift4" && st.peek.q === "0001",
  },
  {
    id: "pipe-q1-only",
    title: "Pipeline Q1 first",
    preset: "pipeline2",
    prompt: "Pipeline: D=1, one posedge — Q1 should be 1 while Q2 is still 0.",
    hint: "First stage captures D; second stage is one cycle behind.",
    check: (st) =>
      st.presetId === "pipeline2" && st.peek.q1 === "1" && st.peek.q2 === "0" && st.edgeCount >= 1,
  },
  {
    id: "load-zero",
    title: "Load 0000",
    preset: "loadreg",
    prompt: "Loadable register: LOAD=1, D=0000, posedge so Q is 0000.",
    hint: "Explicit zero load — useful after unknown startup state.",
    check: (st) => st.presetId === "loadreg" && st.peek.load === "1" && st.peek.q === "0000",
  },
  {
    id: "load-hold",
    title: "Hold without load",
    preset: "loadreg",
    prompt: "Load 1010 with LOAD=1, then LOAD=0 and D=1111; posedge must leave Q at 1010.",
    hint: "When LOAD=0 the register holds — D changes do not matter.",
    check: (st) =>
      st.presetId === "loadreg" && st.peek.load === "0" && st.peek.q === "1010" && st.edgeCount >= 2,
  },
  {
    id: "tff-hold",
    title: "T=0 holds",
    preset: "tff",
    prompt: "T flip-flop: clear with RST, then T=0 — posedge must leave Q at 0.",
    hint: "RST=1 → posedge → RST=0, T=0 → ↗posedge — no toggle.",
    check: (st) =>
      st.presetId === "tff" && st.peek.rst === "0" && st.peek.t === "0" && st.peek.q === "0" && st.edgeCount >= 2,
  },
  {
    id: "en-hold-one",
    title: "Enable off holds",
    preset: "reg_en",
    prompt: "Enable register: capture D=1 with EN=1, then EN=0 and D=0; Q must stay 1.",
    hint: "EN=1, D=1 → posedge → EN=0, D=0 → posedge — Q holds.",
    check: (st) =>
      st.presetId === "reg_en" && st.peek.en === "0" && st.peek.q === "1" && st.edgeCount >= 2,
  },
  {
    id: "updown-up-3",
    title: "Up/down count to 3",
    preset: "updown",
    prompt: "Up/down: clear, DIR=1, count up until Q is 0011.",
    hint: "Same reset dance as the counter lab, but on the up/down preset with DIR=1.",
    check: (st) => st.presetId === "updown" && st.peek.dir === "1" && st.peek.q === "0011",
  },
  {
    id: "tff-toggle-once",
    title: "Toggle once",
    preset: "tff",
    prompt: "T flip-flop: after reset, T=1 and one posedge so Q becomes 1.",
    hint: "RST=1 → posedge → RST=0, T=1 → ↗posedge.",
    check: (st) => st.presetId === "tff" && st.peek.t === "1" && st.peek.q === "1" && st.edgeCount >= 2,
  },
  {
    id: "counter-fifteen",
    title: "Count to 15",
    preset: "counter",
    prompt: "Counter: after clear, count up until Q is 1111 (decimal 15).",
    hint: "Fifteen posedges after releasing reset.",
    check: (st) => st.presetId === "counter" && st.peek.q === "1111",
  },
];

/** @type {null | Awaited<ReturnType<typeof loadHdlEngine>>} */
let hdl = null;

const state = {
  presetId: "dff",
  session: null,
  snapshot: null,
  /** @type {{ t: number, values: Record<string, string>, note: string }[]} */
  trace: [],
  pokeDraft: {},
  edgeCount: 0,
  msg: "",
  msgOk: true,
  challengeOn: false,
  challengeId: "load-one",
  challengeHint: false,
  clearedIds: loadCleared(),
};

const root = document.getElementById("cs-root");

function loadCleared() {
  try {
    const raw = localStorage.getItem("ddv-clock-stepper-cleared-v1");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function saveCleared() {
  try {
    localStorage.setItem("ddv-clock-stepper-cleared-v1", JSON.stringify(state.clearedIds));
  } catch {
    /* ignore */
  }
}

function preset() {
  return PRESETS[state.presetId] || PRESETS.dff;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function challengeById(id) {
  return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
}

function peekMap() {
  const watch = preset().watch;
  /** @type {Record<string, string>} */
  const out = {};
  if (!state.session) return out;
  for (const n of watch) out[n] = state.session.peek(n) ?? "x";
  return out;
}

function challengePassed() {
  if (!state.challengeOn) return false;
  const ch = challengeById(state.challengeId);
  try {
    return !!ch.check({
      presetId: state.presetId,
      peek: peekMap(),
      edgeCount: state.edgeCount,
      time: state.session ? state.session.getTime() : 0,
    });
  } catch {
    return false;
  }
}

function noteCleared() {
  if (!challengePassed()) return;
  if (!state.clearedIds.includes(state.challengeId)) {
    state.clearedIds = [...state.clearedIds, state.challengeId];
    saveCleared();
  }
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        presetId: state.presetId,
        pokeDraft: state.pokeDraft,
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
    const data = JSON.parse(raw);
    if (data.presetId && PRESETS[data.presetId]) state.presetId = data.presetId;
    if (data.pokeDraft && typeof data.pokeDraft === "object") state.pokeDraft = data.pokeDraft;
    return true;
  } catch {
    return false;
  }
}

function initPokeDraft() {
  const p = preset();
  for (const f of p.pokeFields) {
    if (state.pokeDraft[f.name] != null) continue;
    if (f.name === "rst") state.pokeDraft[f.name] = "1";
    else if (f.name === "dir") state.pokeDraft[f.name] = "1";
    else if (f.width > 1) state.pokeDraft[f.name] = "0".repeat(f.width);
    else state.pokeDraft[f.name] = "0";
  }
}

/**
 * Append one truth-table row from current peeks (sequential lab history).
 * @param {string} note
 */
function pushTraceRow(note) {
  if (!state.session) return;
  const values = peekMap();
  state.trace.push({
    t: state.session.getTime(),
    values,
    note: note || "",
  });
  const maxRows = 32;
  if (state.trace.length > maxRows) state.trace = state.trace.slice(-maxRows);
}

function cellClass(bits) {
  if (/[xz]/i.test(bits)) return "xz";
  if (/1/.test(bits) && !/^0+$/.test(bits.replace(/1/g, ""))) {
    // multi-bit: highlight if any 1; single-bit hi/lo
  }
  if (bits === "1" || (/1/.test(bits) && bits.length === 1)) return "hi";
  if (bits === "0" || /^0+$/.test(bits)) return "lo";
  return /1/.test(bits) ? "hi" : "lo";
}

function restartSession(opts = {}) {
  const { announce = true } = opts;
  if (!hdl || typeof hdl.createSession !== "function") {
    throw new Error("HDL createSession not available — rebuild vendor engine.mjs");
  }
  const p = preset();
  state.session = hdl.createSession(p.source, { top: "tb", maxTime: 5000 });
  state.snapshot = state.session.start();
  state.edgeCount = 0;
  state.trace = [];
  initPokeDraft();
  // Apply draft pokes after start
  for (const f of p.pokeFields) {
    const bits = normalizePoke(state.pokeDraft[f.name], f.width);
    state.session.poke(f.name, bits);
  }
  state.snapshot = state.session.getResult();
  pushTraceRow("start");
  if (announce) {
    state.msg = `Session started — ${p.title}. Use Step or ↗posedge.`;
    state.msgOk = true;
  }
}

function normalizePoke(raw, width) {
  let s = String(raw).trim().toLowerCase().replace(/^0b/, "");
  if (s === "1" || s === "0") return s.padStart(width, "0");
  if (/^[01]+$/.test(s)) {
    if (s.length > width) s = s.slice(-width);
    return s.padStart(width, "0");
  }
  // decimal
  if (/^[0-9]+$/.test(s)) {
    const v = BigInt(s);
    return v.toString(2).padStart(width, "0").slice(-width);
  }
  throw new Error(`Bad poke value '${raw}'`);
}

function doStep() {
  if (!state.session) restartSession({ announce: false });
  state.snapshot = state.session.step();
  pushTraceRow("step");
  state.msg = `Step → t=${state.session.getTime()}`;
  state.msgOk = true;
}

function doPosedge() {
  if (!state.session) restartSession({ announce: false });
  const clk = preset().clock;
  state.snapshot = state.session.runToEdge(clk, "posedge");
  state.edgeCount += 1;
  pushTraceRow("posedge");
  state.msg = `↗posedge ${clk} → t=${state.session.getTime()}`;
  state.msgOk = true;
}

function doNegedge() {
  if (!state.session) restartSession({ announce: false });
  const clk = preset().clock;
  state.snapshot = state.session.runToEdge(clk, "negedge");
  pushTraceRow("negedge");
  state.msg = `↘negedge ${clk} → t=${state.session.getTime()}`;
  state.msgOk = true;
}

function applyPokes() {
  if (!state.session) restartSession({ announce: false });
  const p = preset();
  try {
    for (const f of p.pokeFields) {
      const bits = normalizePoke(state.pokeDraft[f.name], f.width);
      state.session.poke(f.name, bits);
      state.pokeDraft[f.name] = bits;
    }
    state.snapshot = state.session.getResult();
    pushTraceRow("poke");
    state.msg = "Poke applied (settled).";
    state.msgOk = true;
  } catch (e) {
    state.msg = e.message || String(e);
    state.msgOk = false;
  }
}

function loadPreset(id, opts = {}) {
  const { announce = true } = opts;
  if (!PRESETS[id]) return;
  state.presetId = id;
  state.pokeDraft = {};
  initPokeDraft();
  restartSession({ announce });
  if (announce) {
    state.msg = `Loaded ${preset().title}.`;
    state.msgOk = true;
  }
}

function loadStarter() {
  state.challengeOn = false;
  state.challengeHint = false;
  loadPreset("dff");
  state.msg = "Starter: D flip-flop. Poke D=1, then ↗posedge — Q follows D.";
  state.msgOk = true;
}

function startChallenge(id) {
  const ch = challengeById(id);
  state.challengeId = ch.id;
  state.challengeOn = true;
  state.challengeHint = false;
  loadPreset(ch.preset, { announce: false });
  state.msg = `Challenge “${ch.title}” — ${ch.prompt}`;
  state.msgOk = true;
}

function renderTruthTableHtml() {
  const names = preset().watch;
  if (!state.trace.length) {
    return `<p class="cs-hint">No rows yet — step or take an edge to fill the table.</p>`;
  }
  const head = ["#", "t", "event", ...names]
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");
  const body = state.trace
    .map((row, i) => {
      const cells = names
        .map((n) => {
          const b = row.values[n] ?? "x";
          return `<td class="${cellClass(b)}">${escapeHtml(shortBits(b))}</td>`;
        })
        .join("");
      return `<tr><td>${i}</td><td>${row.t}</td><td>${escapeHtml(row.note)}</td>${cells}</tr>`;
    })
    .join("");
  return `<div class="cs-tt"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function shortBits(b) {
  if (b.length <= 8) return b;
  return b.slice(0, 4) + "…" + b.slice(-2);
}

function renderSigHtml() {
  const snap = state.snapshot;
  if (!snap) return "";
  const names = preset().watch;
  return `<div class="cs-sigs">${names
    .map((n) => {
      const s = snap.signals[n];
      const bits = s ? s.bits : state.session?.peek(n) || "?";
      const kind = s ? s.kind : "";
      return `<div class="cs-sig"><span class="name">${escapeHtml(n)}</span><span class="bits">${escapeHtml(
        bits
      )}</span><span class="kind">${escapeHtml(kind)}</span></div>`;
    })
    .join("")}</div>`;
}

function render() {
  noteCleared();
  const p = preset();
  const ch = challengeById(state.challengeId);
  const passed = challengePassed();
  const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
  const t = state.session ? state.session.getTime() : 0;

  const presetBtns = Object.values(PRESETS)
    .map(
      (pr) => `
      <button type="button" class="${pr.id === state.presetId ? "is-active" : ""}" data-preset="${pr.id}">
        <span class="title">${escapeHtml(pr.title)}</span>
        <span class="meta">${escapeHtml(pr.blurb)}</span>
      </button>`
    )
    .join("");

  const pokeFields = p.pokeFields
    .map(
      (f) => `
      <div class="cs-field">
        <label for="cs-poke-${f.name}">${escapeHtml(f.label)} <span class="cs-hint">(${f.width}b)</span></label>
        <input id="cs-poke-${f.name}" data-poke="${f.name}" value="${escapeHtml(
          state.pokeDraft[f.name] ?? "0"
        )}" maxlength="16" spellcheck="false">
      </div>`
    )
    .join("");

  const chalOpts = CHALLENGES.map(
    (c) =>
      `<option value="${c.id}" ${c.id === state.challengeId ? "selected" : ""}>${escapeHtml(
        c.title
      )}</option>`
  ).join("");

  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> D flip-flop with a forever <code>#5</code> clock. Poke <code>D</code>, then <strong>↗posedge clk</strong> (same idea as the HDL Simulator toolbar).</p>
      <button type="button" class="btn btn-secondary" id="cs-starter">Load starter example</button>
    </div>

    <div class="challenge">
      <h2>Challenges <span class="cs-hint">${clearedCount}/${CHALLENGES.length}</span></h2>
      <div class="cs-field" style="margin-bottom:0.5rem">
        <label for="cs-chal">Pick one</label>
        <select id="cs-chal">${chalOpts}</select>
      </div>
      <p>${escapeHtml(ch.prompt)}</p>
      ${
        state.challengeHint
          ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
          : ""
      }
      <div class="tool-actions">
        <button type="button" class="btn btn-secondary" id="cs-chal-start">${
          state.challengeOn ? "Restart" : "Start"
        }</button>
        <button type="button" class="btn btn-ghost" id="cs-chal-hint">${
          state.challengeHint ? "Hide hint" : "Show hint"
        }</button>
        <button type="button" class="btn btn-ghost" id="cs-chal-next" ${passed ? "" : "disabled"}>Next</button>
        <button type="button" class="btn btn-ghost" id="cs-chal-stop" ${
          state.challengeOn ? "" : "disabled"
        }>Stop</button>
        <span class="challenge-status ${passed ? "pass" : "idle"}">${
          passed ? "Matched" : state.challengeOn ? "Checking…" : "Idle"
        }</span>
      </div>
    </div>

    <div class="tool-layout split-wide cs-main">
      <div class="panel">
        <div class="panel-head"><h2>Lab</h2></div>
        <div class="panel-body">
          <div class="cs-preset-grid">${presetBtns}</div>
          <p class="cs-meta" style="margin-top:0.85rem">
            time <strong>t=${t}</strong>
            · edges <strong>${state.edgeCount}</strong>
            · pending <strong>${state.snapshot?.pending ?? "—"}</strong>
          </p>
          <div class="cs-toolbar">
            <button type="button" class="btn btn-secondary" id="cs-reset">Reset session</button>
            <button type="button" class="btn btn-ghost" id="cs-step">Step</button>
            <button type="button" class="btn btn-primary" id="cs-posedge">↗posedge clk</button>
            <button type="button" class="btn btn-ghost" id="cs-negedge">↘negedge</button>
          </div>
          <div class="cs-poke-row">
            ${pokeFields}
            <button type="button" class="btn btn-secondary" id="cs-apply-poke">Apply poke</button>
          </div>
          <p class="cs-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
          <p class="cs-hint">Poke settles combo immediately; sequential updates wait for the clock edge (NBA).</p>
        </div>
      </div>
      <div class="cs-side">
        <div class="panel">
          <div class="panel-head"><h2>Signals now</h2></div>
          <div class="panel-body">${renderSigHtml()}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Signal trace</h2></div>
          <div class="panel-body">
            ${renderTruthTableHtml()}
            <p class="cs-hint">One row per step / edge / poke — a value history over time, not a combinational truth table.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Source</h2></div>
      <div class="panel-body">
        <pre class="cs-code">${escapeHtml(p.source.trim())}</pre>
      </div>
    </div>
  `;

  bind();
  persist();
}

function bind() {
  root.querySelector("#cs-starter").addEventListener("click", () => {
    loadStarter();
    render();
  });
  root.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadPreset(btn.getAttribute("data-preset"));
      render();
    });
  });
  root.querySelector("#cs-reset").addEventListener("click", () => {
    try {
      restartSession();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#cs-step").addEventListener("click", () => {
    try {
      doStep();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#cs-posedge").addEventListener("click", () => {
    try {
      doPosedge();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#cs-negedge").addEventListener("click", () => {
    try {
      doNegedge();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#cs-apply-poke").addEventListener("click", () => {
    applyPokes();
    render();
  });
  root.querySelectorAll("[data-poke]").forEach((inp) => {
    inp.addEventListener("change", () => {
      state.pokeDraft[inp.getAttribute("data-poke")] = inp.value;
    });
  });
  root.querySelector("#cs-chal").addEventListener("change", (e) => {
    state.challengeId = e.target.value;
    state.challengeHint = false;
    render();
  });
  root.querySelector("#cs-chal-start").addEventListener("click", () => {
    startChallenge(state.challengeId);
    render();
  });
  root.querySelector("#cs-chal-hint").addEventListener("click", () => {
    state.challengeHint = !state.challengeHint;
    render();
  });
  root.querySelector("#cs-chal-next").addEventListener("click", () => {
    if (!challengePassed()) return;
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    const next = CHALLENGES[(i + 1) % CHALLENGES.length];
    startChallenge(next.id);
    render();
  });
  root.querySelector("#cs-chal-stop").addEventListener("click", () => {
    state.challengeOn = false;
    state.challengeHint = false;
    state.msg = "Stopped challenge checking.";
    state.msgOk = true;
    render();
  });
}

async function boot() {
  root.innerHTML = `<p class="cs-hint">Loading HDL engine…</p>`;
  try {
    hdl = await loadHdlEngine();
    if (typeof hdl.createSession !== "function") {
      throw new Error("createSession missing from engine.mjs — run scripts/build-engine-vendor.mjs");
    }
  } catch (e) {
    root.innerHTML = `<p class="cs-hint" style="color:#b00">Could not load HDL engine: ${escapeHtml(
      e.message || String(e)
    )}</p>`;
    return;
  }
  tryRestore();
  loadStarter();
  render();
}

boot();
