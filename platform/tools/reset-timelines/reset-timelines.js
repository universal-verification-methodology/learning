import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-reset-timelines-v1";
const CLEARED_KEY = "ddv-reset-timelines-cleared-v1";

/** @type {any} */
let hdl = null;

const SYNC_SRC = `module dff_sync(
  input clk,
  input rst_n,
  input d,
  output reg q
);
  always @(posedge clk) begin
    if (!rst_n) q <= 1'b0;
    else        q <= d;
  end
endmodule
module tb;
  reg clk, rst_n, d;
  wire q;
  dff_sync uut(.clk(clk), .rst_n(rst_n), .d(d), .q(q));
  initial begin
    clk = 0; rst_n = 1; d = 0;
    forever #5 clk = ~clk;
  end
endmodule
`;

const ASYNC_SRC = `module dff_async(
  input clk,
  input rst_n,
  input d,
  output reg q
);
  // Reset path uses blocking "=" so clear is visible in the same poke settle
  // (this engine applies NBA from edge processes on a later delta/step).
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) q = 1'b0;
    else        q <= d;
  end
endmodule
module tb;
  reg clk, rst_n, d;
  wire q;
  dff_async uut(.clk(clk), .rst_n(rst_n), .d(d), .q(q));
  initial begin
    clk = 0; rst_n = 1; d = 0;
    forever #5 clk = ~clk;
  end
endmodule
`;

const CODE_SYNC = `always @(posedge clk) begin
  if (!rst_n) q <= 1'b0;
  else        q <= d;
end`;

const CODE_ASYNC = `always @(posedge clk or negedge rst_n) begin
  if (!rst_n) q = 1'b0;  // immediate clear (lab)
  else        q <= d;
end`;

/**
 * Scenario scripts: sequence of actions after start.
 * Actions: { poke: {rst_n?, d?}, edge?: "posedge"|"negedge", step?: n, note }
 */
const SCENARIOS = {
  midcycle: {
    id: "midcycle",
    title: "Mid-cycle reset (starter)",
    blurb: "Load q=1, then assert rst_n=0 between edges — async clears now; sync waits.",
    steps: [
      { poke: { d: "1", rst_n: "1" }, note: "Drive D=1" },
      { edge: "posedge", note: "Capture → q=1" },
      { poke: { rst_n: "0" }, note: "Assert reset mid-cycle (clk still high or low)" },
    ],
  },
  at_edge: {
    id: "at_edge",
    title: "Reset at posedge",
    blurb: "Both styles clear when reset is seen with the sampling edge.",
    steps: [
      { poke: { d: "1", rst_n: "1" }, note: "D=1" },
      { edge: "posedge", note: "q←1" },
      { poke: { rst_n: "0" }, note: "rst_n=0" },
      { edge: "posedge", note: "Sync samples reset; async already clear" },
    ],
  },
  release_capture: {
    id: "release_capture",
    title: "Release then capture",
    blurb: "Clear, release rst_n, then load D=1 on the next edge.",
    steps: [
      { poke: { rst_n: "0", d: "0" }, note: "Assert reset" },
      { edge: "posedge", note: "Ensure cleared (sync)" },
      { poke: { rst_n: "1", d: "1" }, note: "Release + D=1" },
      { edge: "posedge", note: "Both capture 1" },
    ],
  },
  hold_sync: {
    id: "hold_sync",
    title: "Sync ignores mid-cycle",
    blurb: "After q=1, pulse rst_n low then high again before the next posedge.",
    steps: [
      { poke: { d: "1", rst_n: "1" }, note: "D=1" },
      { edge: "posedge", note: "q=1" },
      { poke: { rst_n: "0" }, note: "Pulse low" },
      { poke: { rst_n: "1" }, note: "Release before next edge" },
    ],
  },
};

const CHALLENGES = [
  {
    id: "quiz-sync",
    title: "Quiz: sync reset",
    type: "quiz",
    prompt: "A synchronous reset is typically…",
    hint: "Clocked only.",
    choices: [
      "sampled only on the clock edge (inside always @(posedge clk))",
      "sensitive to rst_n with no clock",
      "the same as $finish",
      "analog only",
    ],
    answer: "sampled only on the clock edge (inside always @(posedge clk))",
  },
  {
    id: "quiz-async",
    title: "Quiz: async reset",
    type: "quiz",
    prompt: "An asynchronous reset usually appears in the sensitivity list as…",
    hint: "negedge rst_n.",
    choices: [
      "posedge clk or negedge rst_n (active-low reset common)",
      "only posedge d",
      "posedge rst_n only with no clock",
      "$monitor only",
    ],
    answer: "posedge clk or negedge rst_n (active-low reset common)",
  },
  {
    id: "quiz-mid",
    title: "Quiz: mid-cycle",
    type: "quiz",
    prompt: "If rst_n falls between clock edges…",
    hint: "Async reacts now.",
    choices: [
      "async reset can clear q immediately; sync reset waits for the next posedge",
      "both always ignore reset",
      "sync always clears first",
      "the clock stops forever",
    ],
    answer: "async reset can clear q immediately; sync reset waits for the next posedge",
  },
  {
    id: "quiz-active-low",
    title: "Quiz: active-low",
    type: "quiz",
    prompt: "rst_n naming usually means…",
    hint: "n = negative.",
    choices: [
      "active-low reset — clear when rst_n is 0",
      "reset never asserts",
      "reset is differential LVDS only",
      "the net is undriven Z",
    ],
    answer: "active-low reset — clear when rst_n is 0",
  },
  {
    id: "quiz-release",
    title: "Quiz: release",
    type: "quiz",
    prompt: "After releasing reset (rst_n→1), new data…",
    hint: "Next edge.",
    choices: [
      "is typically captured on a later clock edge (not magically mid-cycle for a FF)",
      "must appear without any clock",
      "deletes the module",
      "forces q to X forever",
    ],
    answer: "is typically captured on a later clock edge (not magically mid-cycle for a FF)",
  },
  {
    id: "quiz-code-sync",
    title: "Quiz: sync code",
    type: "quiz",
    prompt: "Which sensitivity is synchronous reset?",
    hint: "clk only.",
    choices: [
      "always @(posedge clk) with if (!rst_n) inside",
      "always @(negedge rst_n) alone for data path FFs (no clk)",
      "always @(*) for the FF",
      "initial forever q=0",
    ],
    answer: "always @(posedge clk) with if (!rst_n) inside",
  },
  {
    id: "quiz-code-async",
    title: "Quiz: async code",
    type: "quiz",
    prompt: "Which matches classic async active-low reset?",
    hint: "or negedge.",
    choices: [
      "always @(posedge clk or negedge rst_n)",
      "always @(posedge clk) only — never lists rst_n",
      "assign q = rst_n",
      "always_comb q = d",
    ],
    answer: "always @(posedge clk or negedge rst_n)",
  },
  {
    id: "quiz-glitch",
    title: "Quiz: async caution",
    type: "quiz",
    prompt: "Async reset needs care because…",
    hint: "Timing / recovery.",
    choices: [
      "glitches or poorly timed release can disturb FFs (recovery/removal); sync is quieter on the clock domain",
      "it cannot clear q",
      "it forbids named ports",
      "it requires SPICE",
    ],
    answer:
      "glitches or poorly timed release can disturb FFs (recovery/removal); sync is quieter on the clock domain",
  },
  {
    id: "quiz-scope",
    title: "Quiz: scope",
    type: "quiz",
    prompt: "This lab compares…",
    hint: "Teaching.",
    choices: [
      "sync vs async FF reset timing on a simple timeline — not a full CDC / reset-tree methodology",
      "full SoC reset controllers only",
      "analog bandgap startup",
      "UVM phasing",
    ],
    answer:
      "sync vs async FF reset timing on a simple timeline — not a full CDC / reset-tree methodology",
  },
  {
    id: "quiz-both-clear",
    title: "Quiz: at edge",
    type: "quiz",
    prompt: "When reset is asserted and then a posedge arrives with rst_n still low…",
    hint: "Both clear.",
    choices: [
      "both sync and async end up cleared (sync finally samples the reset)",
      "only the clock dies",
      "q must stay 1",
      "d is forced to z",
    ],
    answer: "both sync and async end up cleared (sync finally samples the reset)",
  },
  {
    id: "run-starter",
    title: "Load mid-cycle",
    type: "run",
    prompt: "Load the Mid-cycle reset starter scenario.",
    hint: "Preset.",
    check: (st) => st.scenarioId === "midcycle",
  },
  {
    id: "run-play-mid",
    title: "Play to divergence",
    type: "run",
    prompt: "Mid-cycle scenario: Run script (or step actions) until async q=0 while sync q=1.",
    hint: "Run scenario / Step action.",
    check: (st) =>
      st.scenarioId === "midcycle" && st.peekSync.q === "1" && st.peekAsync.q === "0",
  },
  {
    id: "run-load-one",
    title: "Both q=1 first",
    type: "run",
    prompt: "From a fresh run: get both sync and async q to 1 (before asserting reset).",
    hint: "D=1, ↗posedge.",
    check: (st) => st.peekSync.q === "1" && st.peekAsync.q === "1",
  },
  {
    id: "run-async-clears",
    title: "Async clears now",
    type: "run",
    prompt: "With both at q=1, poke rst_n=0 (no new posedge) so only async is 0.",
    hint: "Apply poke rst_n=0.",
    check: (st) =>
      st.peekSync.rst_n === "0" &&
      st.peekAsync.rst_n === "0" &&
      st.peekSync.q === "1" &&
      st.peekAsync.q === "0",
  },
  {
    id: "run-sync-catches",
    title: "Sync catches up",
    type: "run",
    prompt: "With rst_n=0 and sync still 1, take ↗posedge so sync also clears.",
    hint: "↗posedge while reset asserted.",
    check: (st) =>
      st.peekSync.rst_n === "0" && st.peekSync.q === "0" && st.peekAsync.q === "0",
  },
  {
    id: "run-at-edge",
    title: "At-edge scenario",
    type: "run",
    prompt: "Load “Reset at posedge” and run the script to the end — both q=0.",
    hint: "Run scenario.",
    check: (st) =>
      st.scenarioId === "at_edge" &&
      st.actionIdx >= SCENARIOS.at_edge.steps.length &&
      st.peekSync.q === "0" &&
      st.peekAsync.q === "0",
  },
  {
    id: "run-release",
    title: "Release + capture",
    type: "run",
    prompt: "Release-then-capture scenario: finish with both q=1.",
    hint: "Load + Run scenario.",
    check: (st) =>
      st.scenarioId === "release_capture" &&
      st.actionIdx >= SCENARIOS.release_capture.steps.length &&
      st.peekSync.q === "1" &&
      st.peekAsync.q === "1",
  },
  {
    id: "run-hold-sync",
    title: "Pulse ignored by sync",
    type: "run",
    prompt: "hold_sync scenario after Run: sync q still 1, async q 0 (pulse released).",
    hint: "Mid-cycle pulse then release.",
    check: (st) =>
      st.scenarioId === "hold_sync" &&
      st.actionIdx >= SCENARIOS.hold_sync.steps.length &&
      st.peekSync.q === "1" &&
      st.peekAsync.q === "0" &&
      st.peekSync.rst_n === "1",
  },
  {
    id: "run-cursor",
    title: "Set cursor",
    type: "run",
    prompt: "After at least one edge, click the wave so cursor t > 0.",
    hint: "Click plot.",
    check: (st) => st.cursorT > 0 && st.edgeCount >= 1,
  },
  {
    id: "run-diverge-flag",
    title: "Verdict: differ",
    type: "run",
    prompt: "Reach a state where sync q and async q differ (divergence).",
    hint: "Mid-cycle reset.",
    check: (st) => st.peekSync.q !== st.peekAsync.q,
  },
  {
    id: "run-edges-2",
    title: "Two posedges",
    type: "run",
    prompt: "Take at least two ↗posedge edges in the session.",
    hint: "↗posedge ×2.",
    check: (st) => st.edgeCount >= 2,
  },
  {
    id: "run-rst-high",
    title: "Released reset",
    type: "run",
    prompt: "Leave rst_n=1 on both sessions (reset released).",
    hint: "Poke rst_n=1.",
    check: (st) => st.peekSync.rst_n === "1" && st.peekAsync.rst_n === "1",
  },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function seriesFor(waves, name) {
  const ev = (waves || []).filter((w) => w.name === name);
  return ev.length ? ev : [{ time: 0, value: "x" }];
}

function valueAt(series, t) {
  let v = series[0]?.value ?? "x";
  for (const e of series) {
    if (e.time > t) break;
    v = e.value;
  }
  return v;
}

function normalizeBit(raw) {
  const s = String(raw).trim();
  if (s === "1" || s === "0") return s;
  throw new Error(`Need 0 or 1, got '${raw}'`);
}

const state = {
  scenarioId: "midcycle",
  actionIdx: 0,
  sessionS: null,
  sessionA: null,
  peekSync: {},
  peekAsync: {},
  waves: [],
  pokeDraft: { d: "0", rst_n: "1" },
  cursorT: 0,
  edgeCount: 0,
  msg: "",
  msgOk: true,
  challengeId: "quiz-sync",
  challengeOn: false,
  challengeHint: false,
  quizChoice: "",
  clearedIds: [],
};

function scenario() {
  return SCENARIOS[state.scenarioId] || SCENARIOS.midcycle;
}

function challengeById(id) {
  return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
}

function peekPair() {
  const names = ["clk", "rst_n", "d", "q"];
  const ps = {};
  const pa = {};
  for (const n of names) {
    ps[n] = state.sessionS?.peek(n) ?? "x";
    pa[n] = state.sessionA?.peek(n) ?? "x";
  }
  state.peekSync = ps;
  state.peekAsync = pa;
}

function syncWaves() {
  const rs = state.sessionS.getResult();
  const ra = state.sessionA.getResult();
  const qA = (ra.waves || [])
    .filter((w) => w.name === "q")
    .map((w) => ({ time: w.time, name: "q_async", value: w.value }));
  const base = (rs.waves || []).map((w) =>
    w.name === "q" ? { ...w, name: "q_sync" } : { ...w }
  );
  state.waves = [...base, ...qA].sort(
    (a, b) => a.time - b.time || a.name.localeCompare(b.name)
  );
  peekPair();
  const t = Math.max(state.sessionS.getTime(), state.sessionA.getTime());
  if (state.cursorT > t) state.cursorT = t;
}

function pokeBoth(fields) {
  for (const [name, bits] of Object.entries(fields)) {
    const b = normalizeBit(bits);
    state.sessionS.poke(name, b);
    state.sessionA.poke(name, b);
    state.pokeDraft[name] = b;
  }
  syncWaves();
}

function restartSessions(opts = {}) {
  const { announce = true } = opts;
  if (!hdl?.createSession) throw new Error("createSession unavailable");
  state.sessionS = hdl.createSession(SYNC_SRC, { top: "tb", maxTime: 5000 });
  state.sessionA = hdl.createSession(ASYNC_SRC, { top: "tb", maxTime: 5000 });
  state.sessionS.start();
  state.sessionA.start();
  state.edgeCount = 0;
  state.cursorT = 0;
  state.actionIdx = 0;
  pokeBoth({
    d: state.pokeDraft.d ?? "0",
    rst_n: state.pokeDraft.rst_n ?? "1",
  });
  if (announce) {
    state.msg = "Twin sessions started (sync + async).";
    state.msgOk = true;
  }
}

function doPosedge() {
  state.sessionS.runToEdge("clk", "posedge");
  state.sessionA.runToEdge("clk", "posedge");
  state.edgeCount += 1;
  syncWaves();
  state.msg = `↗posedge → t=${state.sessionS.getTime()}`;
  state.msgOk = true;
}

function doNegedge() {
  state.sessionS.runToEdge("clk", "negedge");
  state.sessionA.runToEdge("clk", "negedge");
  syncWaves();
  state.msg = `↘negedge → t=${state.sessionS.getTime()}`;
  state.msgOk = true;
}

function doStep() {
  state.sessionS.step();
  state.sessionA.step();
  syncWaves();
  state.msg = `Step → t=${state.sessionS.getTime()}`;
  state.msgOk = true;
}

function applyPokes() {
  try {
    const d = normalizeBit(state.pokeDraft.d);
    const r = normalizeBit(state.pokeDraft.rst_n);
    pokeBoth({ d, rst_n: r });
    state.msg = "Poke applied to both FFs.";
    state.msgOk = true;
  } catch (e) {
    state.msg = e.message || String(e);
    state.msgOk = false;
  }
}

function runAction(act) {
  if (act.poke) pokeBoth(act.poke);
  if (act.edge === "posedge") doPosedge();
  else if (act.edge === "negedge") doNegedge();
  if (act.step) {
    for (let i = 0; i < act.step; i++) doStep();
  }
  if (act.note) {
    state.msg = act.note;
    state.msgOk = true;
  }
}

function stepScenario() {
  const sc = scenario();
  if (state.actionIdx >= sc.steps.length) {
    state.msg = "Scenario complete — Reset session to replay.";
    state.msgOk = true;
    return;
  }
  runAction(sc.steps[state.actionIdx]);
  state.actionIdx += 1;
}

function runScenarioAll() {
  restartSessions({ announce: false });
  const sc = scenario();
  for (const act of sc.steps) runAction(act);
  state.actionIdx = sc.steps.length;
  state.msg = `Ran “${sc.title}” (${sc.steps.length} actions).`;
  state.msgOk = true;
}

function loadScenario(id, opts = {}) {
  if (!SCENARIOS[id]) return;
  state.scenarioId = id;
  state.pokeDraft = { d: "0", rst_n: "1" };
  restartSessions(opts);
}

function loadStarter() {
  state.challengeOn = false;
  state.challengeHint = false;
  loadScenario("midcycle");
  runScenarioAll();
  state.msg =
    "Starter: mid-cycle reset — async q cleared, sync still 1 until the next edge.";
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
        scenarioId: state.scenarioId,
        pokeDraft: state.pokeDraft,
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
    if (d.scenarioId && SCENARIOS[d.scenarioId]) state.scenarioId = d.scenarioId;
    if (d.pokeDraft) state.pokeDraft = { ...state.pokeDraft, ...d.pokeDraft };
    if (d.challengeId && challengeById(d.challengeId)) state.challengeId = d.challengeId;
    return true;
  } catch {
    return false;
  }
}

function buildRailD(series, tMax, xOf, yHi, yLo) {
  if (!series.length) return "";
  const yFor = (bits) => (/[xz]/i.test(bits) ? (yHi + yLo) / 2 : bits === "1" ? yHi : yLo);
  let y = yFor(series[0].value);
  let d = `M ${xOf(0)} ${y}`;
  if (series[0].time > 0) d += ` L ${xOf(series[0].time)} ${y}`;
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

function renderWaveSvg() {
  const names = [
    { id: "clk", cls: "clk" },
    { id: "rst_n", cls: "rst" },
    { id: "d", cls: "" },
    { id: "q_sync", cls: "sync" },
    { id: "q_async", cls: "async" },
  ];
  const tNow = state.sessionS ? state.sessionS.getTime() : 0;
  const last = state.waves.reduce((m, w) => Math.max(m, w.time), 0);
  const tMax = Math.max(tNow, last, 20);
  const labelW = 78;
  const left = labelW + 8;
  const rowH = 34;
  const top = 22;
  const plotW = Math.max(420, Math.min(900, 40 + tMax * 4));
  const height = top + names.length * rowH + 16;
  const width = left + plotW + 12;
  const xOf = (t) => left + (t / tMax) * plotW;

  let axis = "";
  const tick = tMax <= 40 ? 5 : 10;
  for (let t = 0; t <= tMax; t += tick) {
    const x = xOf(t);
    axis += `<line class="grid" x1="${x}" y1="${top - 4}" x2="${x}" y2="${height - 8}"/>`;
    axis += `<text class="axis" x="${x}" y="12" text-anchor="middle">${t}</text>`;
  }

  let rows = "";
  names.forEach((sig, i) => {
    const y0 = top + i * rowH;
    const yHi = y0 + 8;
    const yLo = y0 + rowH - 8;
    const yMid = y0 + rowH / 2;
    const series = seriesFor(state.waves, sig.id);
    const atC = valueAt(series, state.cursorT);
    rows += `<rect class="row-bg" x="0" y="${y0}" width="${width}" height="${rowH}"/>`;
    rows += `<text class="sig-label" x="6" y="${yMid + 4}">${escapeHtml(sig.id)}</text>`;
    rows += `<text class="sig-val" x="6" y="${yMid + 16}">${escapeHtml(atC)}</text>`;
    rows += `<path class="rail ${sig.cls}" d="${buildRailD(series, tMax, xOf, yHi, yLo)}"/>`;
  });

  const cx = xOf(state.cursorT);
  return `<svg class="wave-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-tmax="${tMax}" data-left="${left}" data-plotw="${plotW}" role="img" aria-label="Reset comparison waves">
    ${axis}${rows}<line class="cursor" x1="${cx}" y1="${top - 6}" x2="${cx}" y2="${height - 6}"/>
  </svg>`;
}

const root = document.getElementById("rt-root");

function render() {
  noteCleared();
  const ch = challengeById(state.challengeId);
  const passed = challengePassed();
  const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
  const t = state.sessionS ? state.sessionS.getTime() : 0;
  const diverge = state.peekSync.q !== state.peekAsync.q;

  const presetBtns = Object.values(SCENARIOS)
    .map(
      (sc) => `
      <button type="button" class="${sc.id === state.scenarioId ? "is-active" : ""}" data-sc="${sc.id}">
        <span class="title">${escapeHtml(sc.title)}</span>
        <span class="meta">${escapeHtml(sc.blurb)}</span>
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
          `<label><input type="radio" name="rt-quiz" value="${escapeHtml(c)}" ${
            state.quizChoice === c ? "checked" : ""
          }> ${escapeHtml(c)}</label>`
      )
      .join("")}</div>`;
  }

  const sc = scenario();
  const nextNote =
    state.actionIdx < sc.steps.length
      ? sc.steps[state.actionIdx].note
      : "(scenario finished)";

  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> capture <code>q=1</code>, then assert <code>rst_n=0</code> mid-cycle —
      async clears immediately; sync still shows 1 until the next <code>posedge</code>.</p>
      <button type="button" class="btn btn-secondary" id="rt-starter">Load starter example</button>
    </div>

    <div class="challenge">
      <h2>Challenges <span class="rt-hint">${clearedCount}/${CHALLENGES.length}</span></h2>
      <div class="rt-field" style="margin-bottom:0.5rem">
        <label for="rt-chal">Pick one</label>
        <select id="rt-chal">${chalOpts}</select>
      </div>
      <p>${escapeHtml(ch.prompt)}</p>
      ${
        state.challengeHint
          ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
          : ""
      }
      ${quizHtml}
      <div class="tool-actions">
        <button type="button" class="btn btn-secondary" id="rt-chal-start">${
          state.challengeOn ? "Restart" : "Start"
        }</button>
        <button type="button" class="btn btn-ghost" id="rt-chal-hint">${
          state.challengeHint ? "Hide hint" : "Show hint"
        }</button>
        <button type="button" class="btn btn-ghost" id="rt-chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="rt-chal-next" ${passed ? "" : "disabled"}>Next</button>
        <button type="button" class="btn btn-ghost" id="rt-chal-stop" ${
          state.challengeOn ? "" : "disabled"
        }>Stop</button>
        <span class="challenge-status ${passed ? "pass" : "idle"}">${
          passed ? "Matched" : state.challengeOn ? "In progress" : "Idle"
        }</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Stimulus</h2></div>
      <div class="panel-body">
        <div class="rt-preset-grid">${presetBtns}</div>
        <div class="rule-box">sync: <code>@(posedge clk)</code> only &nbsp;·&nbsp; async: <code>@(posedge clk or negedge rst_n)</code></div>
        <div class="verdict ${diverge ? "diff" : "same"}">${
          diverge ? "q differs — sync vs async divergence" : "q matches on both styles"
        }</div>
        <p class="rt-meta">
          time <strong>t=${t}</strong> · edges <strong>${state.edgeCount}</strong> ·
          scenario step <strong>${state.actionIdx}/${sc.steps.length}</strong> ·
          next: <strong>${escapeHtml(nextNote)}</strong>
        </p>
        <div class="rt-toolbar">
          <button type="button" class="btn btn-secondary" id="rt-reset">Reset session</button>
          <button type="button" class="btn btn-primary" id="rt-run-sc">Run scenario</button>
          <button type="button" class="btn btn-ghost" id="rt-step-sc">Step action</button>
          <button type="button" class="btn btn-ghost" id="rt-step">Step</button>
          <button type="button" class="btn btn-ghost" id="rt-posedge">↗posedge</button>
          <button type="button" class="btn btn-ghost" id="rt-negedge">↘negedge</button>
        </div>
        <div class="rt-poke-row">
          <div class="rt-field">
            <label for="rt-d">D</label>
            <input id="rt-d" data-poke="d" value="${escapeHtml(state.pokeDraft.d)}" maxlength="1">
          </div>
          <div class="rt-field">
            <label for="rt-rst">rst_n</label>
            <input id="rt-rst" data-poke="rst_n" value="${escapeHtml(state.pokeDraft.rst_n)}" maxlength="1">
          </div>
          <button type="button" class="btn btn-secondary" id="rt-apply">Apply poke</button>
        </div>
        <p class="rt-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
      </div>
    </div>

    <div class="compare" style="margin-top:1rem">
      <div class="style-card sync">
        <div class="head"><h3>Synchronous reset</h3><span class="badge">sync</span></div>
        <div class="body">
          <pre>${escapeHtml(CODE_SYNC)}</pre>
          <p class="q-now ${state.peekSync.q === "0" ? "cleared" : "held"}">q = ${escapeHtml(
            state.peekSync.q ?? "?"
          )}</p>
          <p class="rt-hint">rst_n=${escapeHtml(state.peekSync.rst_n ?? "?")} · d=${escapeHtml(
            state.peekSync.d ?? "?"
          )} · clk=${escapeHtml(state.peekSync.clk ?? "?")}</p>
        </div>
      </div>
      <div class="style-card async">
        <div class="head"><h3>Asynchronous reset</h3><span class="badge">async</span></div>
        <div class="body">
          <pre>${escapeHtml(CODE_ASYNC)}</pre>
          <p class="q-now ${state.peekAsync.q === "0" ? "cleared" : "held"}">q = ${escapeHtml(
            state.peekAsync.q ?? "?"
          )}</p>
          <p class="rt-hint">rst_n=${escapeHtml(state.peekAsync.rst_n ?? "?")} · d=${escapeHtml(
            state.peekAsync.d ?? "?"
          )} · clk=${escapeHtml(state.peekAsync.clk ?? "?")}</p>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Timeline</h2></div>
      <div class="panel-body">
        <div class="wave-panel">${renderWaveSvg()}</div>
        <div class="cursor-card">
          <span>cursor <strong>t=${state.cursorT}</strong></span>
          <span>q_sync=<strong>${escapeHtml(valueAt(seriesFor(state.waves, "q_sync"), state.cursorT))}</strong></span>
          <span>q_async=<strong>${escapeHtml(valueAt(seriesFor(state.waves, "q_async"), state.cursorT))}</strong></span>
          <span>rst_n=<strong>${escapeHtml(valueAt(seriesFor(state.waves, "rst_n"), state.cursorT))}</strong></span>
        </div>
        <p class="rt-hint">Click the plot to move the cursor. Twin HDL sessions share the same pokes and edges.</p>
      </div>
    </div>
  `;

  bind();
  persist();
}

function bind() {
  root.querySelector("#rt-starter")?.addEventListener("click", () => {
    loadStarter();
    render();
  });
  root.querySelectorAll("[data-sc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadScenario(btn.getAttribute("data-sc"));
      render();
    });
  });
  root.querySelector("#rt-reset")?.addEventListener("click", () => {
    try {
      restartSessions();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#rt-run-sc")?.addEventListener("click", () => {
    try {
      runScenarioAll();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#rt-step-sc")?.addEventListener("click", () => {
    try {
      stepScenario();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#rt-step")?.addEventListener("click", () => {
    try {
      doStep();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#rt-posedge")?.addEventListener("click", () => {
    try {
      doPosedge();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#rt-negedge")?.addEventListener("click", () => {
    try {
      doNegedge();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });
  root.querySelector("#rt-apply")?.addEventListener("click", () => {
    root.querySelectorAll("[data-poke]").forEach((inp) => {
      state.pokeDraft[inp.getAttribute("data-poke")] = inp.value;
    });
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

  const svg = root.querySelector(".wave-svg");
  svg?.addEventListener("click", (ev) => {
    const tMax = Number(svg.getAttribute("data-tmax")) || 1;
    const left = Number(svg.getAttribute("data-left")) || 0;
    const plotW = Number(svg.getAttribute("data-plotw")) || 1;
    const rect = svg.getBoundingClientRect();
    const scaleX = svg.viewBox.baseVal.width / rect.width;
    const x = (ev.clientX - rect.left) * scaleX;
    state.cursorT = Math.max(0, Math.min(tMax, Math.round(((x - left) / plotW) * tMax)));
    state.msg = `Cursor → t=${state.cursorT}`;
    state.msgOk = true;
    render();
  });

  root.querySelector("#rt-chal")?.addEventListener("change", (e) => {
    state.challengeId = e.target.value;
    state.challengeOn = false;
    state.challengeHint = false;
    state.quizChoice = "";
    render();
  });
  root.querySelector("#rt-chal-start")?.addEventListener("click", () => {
    const ch = challengeById(state.challengeId);
    state.challengeOn = true;
    state.challengeHint = false;
    state.quizChoice = "";
    if (ch.type === "run") {
      if (ch.id.includes("at-edge") || ch.id === "run-at-edge") loadScenario("at_edge", { announce: false });
      else if (ch.id.includes("release")) loadScenario("release_capture", { announce: false });
      else if (ch.id.includes("hold")) loadScenario("hold_sync", { announce: false });
      else if (ch.id === "run-play-mid" || ch.id === "run-starter")
        loadScenario("midcycle", { announce: false });
      else restartSessions({ announce: false });
    }
    state.msg = `Challenge “${ch.title}” — ${ch.prompt}`;
    state.msgOk = true;
    render();
  });
  root.querySelector("#rt-chal-hint")?.addEventListener("click", () => {
    state.challengeHint = !state.challengeHint;
    render();
  });
  root.querySelector("#rt-chal-check")?.addEventListener("click", () => {
    state.challengeOn = true;
    noteCleared();
    const ok = challengePassed();
    state.msg = ok ? "Challenge matched." : "Not yet — keep going.";
    state.msgOk = ok;
    render();
  });
  root.querySelector("#rt-chal-next")?.addEventListener("click", () => {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    state.challengeId = CHALLENGES[(i + 1) % CHALLENGES.length].id;
    state.challengeOn = false;
    state.challengeHint = false;
    state.quizChoice = "";
    render();
  });
  root.querySelector("#rt-chal-stop")?.addEventListener("click", () => {
    state.challengeOn = false;
    render();
  });
  root.querySelectorAll('input[name="rt-quiz"]').forEach((inp) => {
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

  root.innerHTML = `<p class="rt-hint">Loading HDL engine…</p>`;
  try {
    hdl = await loadHdlEngine();
    if (typeof hdl.createSession !== "function") {
      throw new Error("createSession missing from engine.mjs");
    }
    tryRestore();
    loadStarter();
    render();
  } catch (e) {
    root.innerHTML = `<p class="rt-msg err">Failed to load HDL engine: ${escapeHtml(
      e.message || String(e)
    )}</p>`;
  }
}

main();
