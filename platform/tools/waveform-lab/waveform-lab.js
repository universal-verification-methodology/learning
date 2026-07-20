import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-waveform-lab-v1";
const CLEARED_KEY = "ddv-waveform-lab-cleared-v1";

/** @type {any} */
let hdl = null;

const PRESETS = {
  dff: {
    id: "dff",
    title: "D flip-flop",
    blurb: "Starter: poke D, ↗posedge — watch q rise on the wave.",
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
    blurb: "EN=0 holds q — the wave stays flat across edges.",
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
  counter: {
    id: "counter",
    title: "4-bit counter",
    blurb: "Multi-bit bus wave — labels show binary on each change.",
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
  pipeline2: {
    id: "pipeline2",
    title: "2-stage pipeline",
    blurb: "q2 lags q1 by one clock — clear on the wave.",
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
};

const CHALLENGES = [
  {
    id: "quiz-wave",
    title: "Quiz: waveform",
    type: "quiz",
    prompt: "A digital waveform plot shows…",
    hint: "Value vs time.",
    choices: [
      "each watched signal’s value over simulation time",
      "only the Verilog source text",
      "place-and-route congestion",
      "analog SPICE currents only",
    ],
    answer: "each watched signal’s value over simulation time",
  },
  {
    id: "quiz-cursor",
    title: "Quiz: cursor",
    type: "quiz",
    prompt: "Clicking the wave sets a time cursor so you can…",
    hint: "Inspect.",
    choices: [
      "read every visible signal’s value at that instant",
      "delete the DUT",
      "change the HDL language version",
      "force synthesis",
    ],
    answer: "read every visible signal’s value at that instant",
  },
  {
    id: "quiz-clk",
    title: "Quiz: clock on wave",
    type: "quiz",
    prompt: "On a forever #5 clock, a full period is usually…",
    hint: "Rise + fall.",
    choices: [
      "10 time units (high 5 + low 5) in this starter TB",
      "1 time unit always",
      "undefined without $finish",
      "equal to the counter width",
    ],
    answer: "10 time units (high 5 + low 5) in this starter TB",
  },
  {
    id: "quiz-posedge",
    title: "Quiz: posedge mark",
    type: "quiz",
    prompt: "A rising edge on clk is where…",
    hint: "0→1.",
    choices: [
      "clk transitions 0→1 — often where FFs sample",
      "clk stays high forever",
      "d must equal q always",
      "$display is illegal",
    ],
    answer: "clk transitions 0→1 — often where FFs sample",
  },
  {
    id: "quiz-naming",
    title: "Quiz: signal names",
    type: "quiz",
    prompt: "Wave / signal names in a viewer usually match…",
    hint: "Netlist identifiers.",
    choices: [
      "hierarchical or top-level identifiers from the elaborated design (e.g. clk, q)",
      "random GUI colors only",
      "Git commit hashes",
      "FPGA pin GPS coordinates",
    ],
    answer: "hierarchical or top-level identifiers from the elaborated design (e.g. clk, q)",
  },
  {
    id: "quiz-x",
    title: "Quiz: X/Z",
    type: "quiz",
    prompt: "Seeing x or z on a wave commonly means…",
    hint: "Unknown / undriven.",
    choices: [
      "unknown or undriven / high-impedance — not a clean 0/1",
      "the signal is always faster",
      "the clock stopped legally",
      "synthesis succeeded",
    ],
    answer: "unknown or undriven / high-impedance — not a clean 0/1",
  },
  {
    id: "quiz-bus",
    title: "Quiz: bus wave",
    type: "quiz",
    prompt: "A multi-bit signal on a wave is often drawn as…",
    hint: "Bus.",
    choices: [
      "a bus ribbon with a value label when the bits change",
      "only the LSB forever",
      "an analog sine",
      "a Git blame lane",
    ],
    answer: "a bus ribbon with a value label when the bits change",
  },
  {
    id: "quiz-vs-gtkwave",
    title: "Quiz: scope",
    type: "quiz",
    prompt: "This lab is for…",
    hint: "Teaching subset.",
    choices: [
      "small in-browser waves from the HDL engine — not a full GTKWave / huge VCD workflow",
      "replacing all offline simulators",
      "analog IBIS models only",
      "UVM RAL browsers",
    ],
    answer: "small in-browser waves from the HDL engine — not a full GTKWave / huge VCD workflow",
  },
  {
    id: "quiz-sample",
    title: "Quiz: FF sample",
    type: "quiz",
    prompt: "On the D-FF wave, q updates at…",
    hint: "NBA after edge.",
    choices: [
      "the posedge of clk (nonblocking update), not when d alone toggles mid-cycle",
      "random times",
      "only $finish",
      "negedge only in this starter",
    ],
    answer: "the posedge of clk (nonblocking update), not when d alone toggles mid-cycle",
  },
  {
    id: "quiz-hide",
    title: "Quiz: watch list",
    type: "quiz",
    prompt: "Toggling signal checkboxes…",
    hint: "Visibility.",
    choices: [
      "shows or hides rows in the wave view (watch list)",
      "deletes nets from the DUT",
      "changes the clock period in silicon",
      "commits to Git",
    ],
    answer: "shows or hides rows in the wave view (watch list)",
  },
  {
    id: "run-starter",
    title: "Load D-FF",
    type: "run",
    prompt: "Load the D flip-flop starter preset.",
    hint: "Load starter / preset.",
    check: (st) => st.presetId === "dff",
  },
  {
    id: "run-capture-1",
    title: "q rises on wave",
    type: "run",
    prompt: "D-FF: poke D=1, ↗posedge so q=1 (visible on the wave).",
    hint: "Apply poke, then ↗posedge.",
    check: (st) => st.presetId === "dff" && st.peek.q === "1" && st.edgeCount >= 1,
  },
  {
    id: "run-clk-toggle",
    title: "Grow clk edges",
    type: "run",
    prompt: "Any preset: take at least two ↗posedge so the clk wave has multiple rises.",
    hint: "↗posedge twice.",
    check: (st) => st.edgeCount >= 2 && waveHasTransitions(st, "clk", 2),
  },
  {
    id: "run-cursor-set",
    title: "Set cursor",
    type: "run",
    prompt: "After at least one edge, click the wave so the cursor time is > 0.",
    hint: "Click inside the wave panel.",
    check: (st) => st.cursorT > 0 && st.edgeCount >= 1,
  },
  {
    id: "run-cursor-q",
    title: "Cursor reads q",
    type: "run",
    prompt: "D-FF with q=1: set cursor at a time where value-at-cursor for q is 1.",
    hint: "Capture q=1, click after the rising update.",
    check: (st) =>
      st.presetId === "dff" && st.peek.q === "1" && valueAtCursor(st, "q") === "1",
  },
  {
    id: "run-d-before-edge",
    title: "d before sample",
    type: "run",
    prompt: "D-FF: poke D=1 without a new posedge yet — d=1 while q still 0.",
    hint: "Reset, poke D=1, do not edge (or edge only while D was 0 first).",
    check: (st) => st.presetId === "dff" && st.peek.d === "1" && st.peek.q === "0",
  },
  {
    id: "run-en-hold",
    title: "Flat q (enable off)",
    type: "run",
    prompt: "Enable register: EN=0, D=1, ↗posedge — q stays 0.",
    hint: "Load reg+en preset.",
    check: (st) =>
      st.presetId === "reg_en" &&
      st.peek.en === "0" &&
      st.peek.q === "0" &&
      st.edgeCount >= 1,
  },
  {
    id: "run-en-load",
    title: "Enable capture",
    type: "run",
    prompt: "Enable register: EN=1, D=1, ↗posedge — q=1.",
    hint: "EN must be 1.",
    check: (st) =>
      st.presetId === "reg_en" && st.peek.en === "1" && st.peek.q === "1",
  },
  {
    id: "run-count-3",
    title: "Counter bus = 0011",
    type: "run",
    prompt: "Counter: clear (RST=1 + edge), RST=0, count until q is 0011.",
    hint: "Watch the bus labels on the wave.",
    check: (st) => st.presetId === "counter" && st.peek.q === "0011",
  },
  {
    id: "run-pipe-lag",
    title: "Pipeline lag on wave",
    type: "run",
    prompt: "Pipeline: D=1, one posedge — q1=1 and q2=0 (lag visible).",
    hint: "One edge only.",
    check: (st) =>
      st.presetId === "pipeline2" &&
      st.peek.q1 === "1" &&
      st.peek.q2 === "0" &&
      st.edgeCount >= 1,
  },
  {
    id: "run-pipe-catch",
    title: "q2 catches up",
    type: "run",
    prompt: "Pipeline: after D=1, two posedges so q2=1.",
    hint: "Second edge moves q1→q2.",
    check: (st) =>
      st.presetId === "pipeline2" && st.peek.q2 === "1" && st.edgeCount >= 2,
  },
  {
    id: "run-hide-d",
    title: "Hide d row",
    type: "run",
    prompt: "D-FF preset: uncheck signal d so it is hidden from the wave.",
    hint: "Watch-list checkboxes.",
    check: (st) => st.presetId === "dff" && st.hidden.d === true,
  },
];

function waveHasTransitions(st, name, minEdges) {
  const series = seriesFor(st.waves, name);
  let flips = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i].value !== series[i - 1].value) flips++;
  }
  return flips >= minEdges;
}

function valueAtCursor(st, name) {
  return valueAt(seriesFor(st.waves, name), st.cursorT);
}

function seriesFor(waves, name) {
  const ev = (waves || []).filter((w) => w.name === name);
  if (!ev.length) return [{ time: 0, value: "x" }];
  return ev;
}

function valueAt(series, t) {
  let v = series[0]?.value ?? "x";
  for (const e of series) {
    if (e.time > t) break;
    v = e.value;
  }
  return v;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortBits(b) {
  if (b == null) return "?";
  const s = String(b);
  if (s.length <= 8) return s;
  return s.slice(0, 4) + "…" + s.slice(-2);
}

function bitsToHex(bits) {
  if (!/^[01]+$/.test(bits)) return shortBits(bits);
  const n = BigInt("0b" + bits);
  return "0x" + n.toString(16).toUpperCase();
}

function normalizePoke(raw, width) {
  let s = String(raw).trim().toLowerCase().replace(/^0b/, "");
  if (s === "1" || s === "0") return s.padStart(width, "0");
  if (/^[01]+$/.test(s)) {
    if (s.length > width) s = s.slice(-width);
    return s.padStart(width, "0");
  }
  if (/^[0-9]+$/.test(s)) {
    const v = BigInt(s);
    return v.toString(2).padStart(width, "0").slice(-width);
  }
  throw new Error(`Bad poke value '${raw}'`);
}

function isBus(bits) {
  return bits != null && String(bits).length > 1;
}

function busSegments(series, tMax) {
  const segs = [];
  for (let i = 0; i < series.length; i++) {
    const t0 = series[i].time;
    const t1 = i + 1 < series.length ? series[i + 1].time : tMax;
    if (t1 <= t0) continue;
    segs.push({ t0, t1, value: series[i].value });
  }
  return segs;
}

const state = {
  presetId: "dff",
  session: null,
  snapshot: null,
  waves: [],
  peek: {},
  pokeDraft: {},
  hidden: {},
  cursorT: 0,
  edgeCount: 0,
  msg: "",
  msgOk: true,
  challengeId: "quiz-wave",
  challengeOn: false,
  challengeHint: false,
  quizChoice: "",
  clearedIds: [],
};

function preset() {
  return PRESETS[state.presetId] || PRESETS.dff;
}

function peekMap() {
  const out = {};
  if (!state.session) return out;
  for (const n of preset().watch) out[n] = state.session.peek(n) ?? "x";
  return out;
}

function syncFromSession() {
  if (!state.session) return;
  state.snapshot = state.session.getResult();
  state.waves = state.snapshot.waves || [];
  state.peek = peekMap();
  const t = state.session.getTime();
  if (state.cursorT > t) state.cursorT = t;
}

function initPokeDraft() {
  for (const f of preset().pokeFields) {
    if (state.pokeDraft[f.name] != null) continue;
    state.pokeDraft[f.name] = f.name === "rst" ? "1" : f.width > 1 ? "0".repeat(f.width) : "0";
  }
}

function initHidden() {
  const next = {};
  for (const n of preset().watch) next[n] = !!state.hidden[n];
  state.hidden = next;
}

function restartSession(opts = {}) {
  const { announce = true } = opts;
  if (!hdl || typeof hdl.createSession !== "function") {
    throw new Error("HDL createSession not available — rebuild vendor engine.mjs");
  }
  const p = preset();
  state.session = hdl.createSession(p.source, { top: "tb", maxTime: 5000 });
  state.session.start();
  state.edgeCount = 0;
  state.cursorT = 0;
  initPokeDraft();
  for (const f of p.pokeFields) {
    const bits = normalizePoke(state.pokeDraft[f.name], f.width);
    state.session.poke(f.name, bits);
  }
  syncFromSession();
  if (announce) {
    state.msg = `Session started — ${p.title}. Grow the wave with Step / ↗posedge.`;
    state.msgOk = true;
  }
}

function loadPreset(id, opts = {}) {
  if (!PRESETS[id]) return;
  state.presetId = id;
  state.pokeDraft = {};
  state.hidden = {};
  initPokeDraft();
  initHidden();
  restartSession(opts);
}

function loadStarter() {
  state.challengeOn = false;
  state.challengeHint = false;
  loadPreset("dff");
  state.msg = "Starter: D-FF. Poke D=1, ↗posedge — q rises on the wave. Click to set the cursor.";
  state.msgOk = true;
}

function doStep() {
  if (!state.session) restartSession({ announce: false });
  state.session.step();
  syncFromSession();
  state.msg = `Step → t=${state.session.getTime()}`;
  state.msgOk = true;
}

function doPosedge() {
  if (!state.session) restartSession({ announce: false });
  state.session.runToEdge(preset().clock, "posedge");
  state.edgeCount += 1;
  syncFromSession();
  state.msg = `↗posedge ${preset().clock} → t=${state.session.getTime()}`;
  state.msgOk = true;
}

function doNegedge() {
  if (!state.session) restartSession({ announce: false });
  state.session.runToEdge(preset().clock, "negedge");
  syncFromSession();
  state.msg = `↘negedge → t=${state.session.getTime()}`;
  state.msgOk = true;
}

function applyPokes() {
  if (!state.session) restartSession({ announce: false });
  try {
    for (const f of preset().pokeFields) {
      const el = root.querySelector(`[data-poke="${f.name}"]`);
      if (el && "value" in el) state.pokeDraft[f.name] = el.value;
      const bits = normalizePoke(state.pokeDraft[f.name], f.width);
      state.session.poke(f.name, bits);
      state.pokeDraft[f.name] = bits;
    }
    syncFromSession();
    state.msg = "Poke applied — d may move on the wave before the next edge.";
    state.msgOk = true;
  } catch (e) {
    state.msg = e.message || String(e);
    state.msgOk = false;
  }
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
  if (!state.challengeOn) return;
  const ch = challengeById(state.challengeId);
  if (!challengePassed()) return;
  if (!state.clearedIds.includes(ch.id)) {
    state.clearedIds = [...state.clearedIds, ch.id];
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
        pokeDraft: state.pokeDraft,
        hidden: state.hidden,
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
    if (d.pokeDraft && typeof d.pokeDraft === "object") state.pokeDraft = d.pokeDraft;
    if (d.hidden && typeof d.hidden === "object") state.hidden = d.hidden;
    if (d.challengeId && challengeById(d.challengeId)) state.challengeId = d.challengeId;
    return true;
  } catch {
    return false;
  }
}

function renderWaveSvg() {
  const names = preset().watch.filter((n) => !state.hidden[n]);
  const tNow = state.session ? state.session.getTime() : 0;
  const lastWaveT = state.waves.reduce((m, w) => Math.max(m, w.time), 0);
  const tMax = Math.max(tNow, lastWaveT, 20);
  const labelW = 72;
  const left = labelW + 8;
  const rowH = 36;
  const top = 22;
  const plotW = Math.max(420, Math.min(900, 40 + tMax * 4));
  const height = top + names.length * rowH + 16;
  const width = left + plotW + 12;

  const xOf = (t) => left + (t / tMax) * plotW;

  // time ticks
  const tickStep = tMax <= 40 ? 5 : tMax <= 100 ? 10 : 20;
  let axis = "";
  for (let t = 0; t <= tMax; t += tickStep) {
    const x = xOf(t);
    axis += `<line class="grid" x1="${x}" y1="${top - 4}" x2="${x}" y2="${height - 8}"/>`;
    axis += `<text class="axis" x="${x}" y="12" text-anchor="middle">${t}</text>`;
  }

  let rows = "";
  names.forEach((name, i) => {
    const y0 = top + i * rowH;
    const yMid = y0 + rowH / 2;
    const yHi = y0 + 8;
    const yLo = y0 + rowH - 8;
    const series = seriesFor(state.waves, name);
    const atC = valueAt(series, state.cursorT);
    const sample = series[series.length - 1]?.value ?? "x";
    rows += `<rect class="row-bg" x="0" y="${y0}" width="${width}" height="${rowH}"/>`;
    rows += `<text class="sig-label" x="6" y="${yMid + 4}">${escapeHtml(name)}</text>`;
    rows += `<text class="sig-val" x="6" y="${yMid + 16}">${escapeHtml(shortBits(atC))}</text>`;

    if (isBus(sample) || series.some((e) => isBus(e.value))) {
      for (const seg of busSegments(series, tMax)) {
        const x1 = xOf(seg.t0);
        const x2 = xOf(seg.t1);
        const mid = (x1 + x2) / 2;
        const y1 = yHi;
        const y2 = yLo;
        // hexagon-ish bus
        const notch = Math.min(6, (x2 - x1) / 4);
        const pts = `${x1 + notch},${yMid} ${x1},${y1} ${x2},${y1} ${x2 - notch},${yMid} ${x2},${y2} ${x1},${y2}`;
        rows += `<polygon class="bus" points="${pts}"/>`;
        if (x2 - x1 > 28) {
          const label = /^[01]+$/.test(seg.value) ? bitsToHex(seg.value) : shortBits(seg.value);
          rows += `<text class="bus-text" x="${mid}" y="${yMid + 3}" text-anchor="middle">${escapeHtml(
            label
          )}</text>`;
        }
      }
    } else {
      const xz = series.some((e) => /[xz]/i.test(e.value));
      const cls = name === preset().clock ? "rail clk" : xz ? "rail xz" : "rail";
      // Fix rail drawing with cleaner algorithm
      rows += `<path class="${cls}" d="${escapeHtml(buildRailD(series, tMax, xOf, yHi, yLo))}"/>`;
    }
  });

  const cx = xOf(state.cursorT);
  const cursor = `<line class="cursor" x1="${cx}" y1="${top - 6}" x2="${cx}" y2="${height - 6}"/>`;

  return `<svg class="wave-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-tmax="${tMax}" data-left="${left}" data-plotw="${plotW}" role="img" aria-label="Digital waveforms">
    ${axis}${rows}${cursor}
  </svg>`;
}

function buildRailD(series, tMax, xOf, yHi, yLo) {
  if (!series.length) return "";
  function yFor(bits) {
    if (/[xz]/i.test(bits)) return (yHi + yLo) / 2;
    return bits === "1" ? yHi : yLo;
  }
  let d = "";
  let y = yFor(series[0].value);
  d += `M ${xOf(0)} ${y}`;
  // ensure we start from t=0 even if first event later
  if (series[0].time > 0) {
    d += ` L ${xOf(series[0].time)} ${y}`;
  }
  for (let i = 0; i < series.length; i++) {
    const cur = series[i];
    const ny = yFor(cur.value);
    const x = xOf(cur.time);
    if (ny !== y) {
      d += ` L ${x} ${y} L ${x} ${ny}`;
      y = ny;
    }
    const nextT = i + 1 < series.length ? series[i + 1].time : tMax;
    d += ` L ${xOf(nextT)} ${y}`;
  }
  return d;
}

const root = document.getElementById("wl-root");

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
      <div class="wl-field">
        <label for="wl-poke-${f.name}">${escapeHtml(f.label)} <span class="wl-hint">(${f.width}b)</span></label>
        <input id="wl-poke-${f.name}" data-poke="${f.name}" value="${escapeHtml(
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

  const toggles = p.watch
    .map(
      (n) => `
      <label><input type="checkbox" data-vis="${n}" ${state.hidden[n] ? "" : "checked"}> ${escapeHtml(
        n
      )}</label>`
    )
    .join("");

  const cursorVals = p.watch
    .filter((n) => !state.hidden[n])
    .map((n) => {
      const v = valueAt(seriesFor(state.waves, n), state.cursorT);
      return `<span><strong>${escapeHtml(n)}</strong>=${escapeHtml(shortBits(v))}</span>`;
    })
    .join("");

  let quizHtml = "";
  if (ch.type === "quiz") {
    quizHtml = `<div class="quiz-choices" style="margin:0.5rem 0">${ch.choices
      .map(
        (c) =>
          `<label><input type="radio" name="wl-quiz" value="${escapeHtml(c)}" ${
            state.quizChoice === c ? "checked" : ""
          }> ${escapeHtml(c)}</label>`
      )
      .join("")}</div>`;
  }

  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> D flip-flop with forever <code>#5</code> clock. Poke <code>D=1</code>,
      <strong>↗posedge</strong>, then click the wave to read values at the cursor.</p>
      <button type="button" class="btn btn-secondary" id="wl-starter">Load starter example</button>
    </div>

    <div class="challenge">
      <h2>Challenges <span class="wl-hint">${clearedCount}/${CHALLENGES.length}</span></h2>
      <div class="wl-field" style="margin-bottom:0.5rem">
        <label for="wl-chal">Pick one</label>
        <select id="wl-chal">${chalOpts}</select>
      </div>
      <p>${escapeHtml(ch.prompt)}</p>
      ${
        state.challengeHint
          ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
          : ""
      }
      ${quizHtml}
      <div class="tool-actions">
        <button type="button" class="btn btn-secondary" id="wl-chal-start">${
          state.challengeOn ? "Restart" : "Start"
        }</button>
        <button type="button" class="btn btn-ghost" id="wl-chal-hint">${
          state.challengeHint ? "Hide hint" : "Show hint"
        }</button>
        <button type="button" class="btn btn-ghost" id="wl-chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="wl-chal-next" ${passed ? "" : "disabled"}>Next</button>
        <button type="button" class="btn btn-ghost" id="wl-chal-stop" ${
          state.challengeOn ? "" : "disabled"
        }>Stop</button>
        <span class="challenge-status ${passed ? "pass" : "idle"}" id="wl-chal-status">${
          passed ? "Matched" : state.challengeOn ? "In progress" : "Idle"
        }</span>
      </div>
    </div>

    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Drive the sim</h2></div>
        <div class="panel-body">
          <div class="wl-preset-grid">${presetBtns}</div>
          <p class="wl-meta">time <strong>t=${t}</strong> · edges <strong>${state.edgeCount}</strong> · wave events <strong>${
            state.waves.length
          }</strong></p>
          <div class="wl-toolbar">
            <button type="button" class="btn btn-secondary" id="wl-reset">Reset session</button>
            <button type="button" class="btn btn-ghost" id="wl-step">Step</button>
            <button type="button" class="btn btn-primary" id="wl-posedge">↗posedge clk</button>
            <button type="button" class="btn btn-ghost" id="wl-negedge">↘negedge</button>
          </div>
          <div class="wl-poke-row">
            ${pokeFields}
            <button type="button" class="btn btn-secondary" id="wl-apply-poke">Apply poke</button>
          </div>
          <p class="wl-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
          <p class="wl-hint">Waves come from the HDL engine dump (same session API as clock-stepper).</p>
        </div>
      </div>
      <div class="wl-side">
        <div class="panel">
          <div class="panel-head"><h2>Source</h2></div>
          <div class="panel-body"><pre class="wl-code">${escapeHtml(p.source.trim())}</pre></div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Waveform</h2></div>
      <div class="panel-body">
        <div class="wl-sig-toggles">${toggles}</div>
        <div class="wave-panel" id="wave-panel">${renderWaveSvg()}</div>
        <div class="cursor-card">
          <span>cursor <strong>t=${state.cursorT}</strong></span>
          ${cursorVals || "<span class=\"wl-hint\">No visible signals</span>"}
        </div>
        <p class="wl-hint">Click the plot to move the cursor. Uncheck signals to declutter.</p>
      </div>
    </div>
  `;

  bind();
  persist();
}

function bind() {
  root.querySelector("#wl-starter")?.addEventListener("click", () => {
    loadStarter();
    render();
  });
  root.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadPreset(btn.getAttribute("data-preset"));
      render();
    });
  });
  root.querySelector("#wl-reset")?.addEventListener("click", () => {
    try {
      restartSession();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#wl-step")?.addEventListener("click", () => {
    try {
      doStep();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#wl-posedge")?.addEventListener("click", () => {
    try {
      doPosedge();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#wl-negedge")?.addEventListener("click", () => {
    try {
      doNegedge();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#wl-apply-poke")?.addEventListener("click", () => {
    applyPokes();
    render();
  });
  root.querySelectorAll("[data-poke]").forEach((inp) => {
    const sync = () => {
      state.pokeDraft[inp.getAttribute("data-poke")] = inp.value;
    };
    inp.addEventListener("input", sync);
    inp.addEventListener("change", sync);
  });
  root.querySelectorAll("[data-vis]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const n = inp.getAttribute("data-vis");
      state.hidden[n] = !inp.checked;
      render();
    });
  });

  const svg = root.querySelector(".wave-svg");
  svg?.addEventListener("click", (ev) => {
    const tMax = Number(svg.getAttribute("data-tmax")) || 1;
    const left = Number(svg.getAttribute("data-left")) || 0;
    const plotW = Number(svg.getAttribute("data-plotw")) || 1;
    const rect = svg.getBoundingClientRect();
    const scaleX = svg.viewBox.baseVal.width / rect.width;
    const x = (ev.clientX - rect.left) * scaleX;
    const t = Math.max(0, Math.min(tMax, Math.round(((x - left) / plotW) * tMax)));
    state.cursorT = t;
    state.msg = `Cursor → t=${t}`;
    state.msgOk = true;
    render();
  });

  root.querySelector("#wl-chal")?.addEventListener("change", (e) => {
    state.challengeId = e.target.value;
    state.challengeOn = false;
    state.challengeHint = false;
    state.quizChoice = "";
    render();
  });
  root.querySelector("#wl-chal-start")?.addEventListener("click", () => {
    const ch = challengeById(state.challengeId);
    state.challengeOn = true;
    state.challengeHint = false;
    state.quizChoice = "";
    if (ch.type === "run" && ch.id.startsWith("run-")) {
      // soft setup
      if (ch.id.includes("en-") || ch.id === "run-en-hold" || ch.id === "run-en-load")
        loadPreset("reg_en", { announce: false });
      else if (ch.id.includes("count")) loadPreset("counter", { announce: false });
      else if (ch.id.includes("pipe")) loadPreset("pipeline2", { announce: false });
      else if (ch.id !== "run-clk-toggle") loadPreset("dff", { announce: false });
    }
    state.msg = `Challenge “${ch.title}” — ${ch.prompt}`;
    state.msgOk = true;
    render();
  });
  root.querySelector("#wl-chal-hint")?.addEventListener("click", () => {
    state.challengeHint = !state.challengeHint;
    render();
  });
  root.querySelector("#wl-chal-check")?.addEventListener("click", () => {
    state.challengeOn = true;
    noteCleared();
    const ok = challengePassed();
    state.msg = ok ? "Challenge matched." : "Not yet — keep going.";
    state.msgOk = ok;
    render();
  });
  root.querySelector("#wl-chal-next")?.addEventListener("click", () => {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    state.challengeId = CHALLENGES[(i + 1) % CHALLENGES.length].id;
    state.challengeOn = false;
    state.challengeHint = false;
    state.quizChoice = "";
    render();
  });
  root.querySelector("#wl-chal-stop")?.addEventListener("click", () => {
    state.challengeOn = false;
    render();
  });
  root.querySelectorAll('input[name="wl-quiz"]').forEach((inp) => {
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

  root.innerHTML = `<p class="wl-hint">Loading HDL engine…</p>`;
  try {
    hdl = await loadHdlEngine();
    if (typeof hdl.createSession !== "function") {
      throw new Error("createSession missing from engine.mjs");
    }
    tryRestore();
    initPokeDraft();
    initHidden();
    restartSession({ announce: false });
    state.msg =
      "Starter ready: D-FF wave. Poke D=1 → Apply poke → ↗posedge, then click the plot.";
    state.msgOk = true;
    render();
  } catch (e) {
    root.innerHTML = `<p class="wl-msg err">Failed to load HDL engine: ${escapeHtml(
      e.message || String(e)
    )}</p>`;
  }
}

main();
