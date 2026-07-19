import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-blocking-vs-nonblocking-v1";
const CLEARED_KEY = "ddv-blocking-vs-nonblocking-cleared-v1";

/**
 * Side-by-side labs: same stimulus, blocking `=` vs non-blocking `<=`.
 * Path id: blocking-vs-nonblocking (not “nba” — clearer for learners).
 */
const SCENARIOS = {
  swap: {
    id: "swap",
    title: "Register swap",
    blurb: "Try to swap a and b in one always block — classic gotcha.",
    teaching:
      "Blocking `=` runs in order: after `a = b`, both hold b’s old value, so `b = a` copies that again. Non-blocking `<=` samples both RHS values first, then updates — a real swap.",
    watch: ["a", "b"],
    pokeFields: [],
    clock: "clk",
    blockingSnippet: "a = b;\nb = a;",
    nonblockingSnippet: "a <= b;\nb <= a;",
    blockingSource: `module tb;
  reg clk, a, b;
  always @(posedge clk) begin
    a = b;
    b = a;
  end
  initial begin
    clk = 0;
    a = 1;
    b = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
    nonblockingSource: `module tb;
  reg clk, a, b;
  always @(posedge clk) begin
    a <= b;
    b <= a;
  end
  initial begin
    clk = 0;
    a = 1;
    b = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  pipeline: {
    id: "pipeline",
    title: "Two-stage pipeline",
    blurb: "q1 ← d, q2 ← q1 — one cycle delay only with <= .",
    teaching:
      "With `=`, `q2 = q1` sees the new q1 in the same edge, so both stages take d at once. With `<=`, q2 still sees the old q1 — a true pipeline.",
    watch: ["d", "q1", "q2"],
    pokeFields: [{ name: "d", label: "D", width: 1 }],
    clock: "clk",
    blockingSnippet: "q1 = d;\nq2 = q1;",
    nonblockingSnippet: "q1 <= d;\nq2 <= q1;",
    blockingSource: `module tb;
  reg clk, d, q1, q2;
  always @(posedge clk) begin
    q1 = d;
    q2 = q1;
  end
  initial begin
    clk = 0;
    d = 1;
    q1 = 0;
    q2 = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
    nonblockingSource: `module tb;
  reg clk, d, q1, q2;
  always @(posedge clk) begin
    q1 <= d;
    q2 <= q1;
  end
  initial begin
    clk = 0;
    d = 1;
    q1 = 0;
    q2 = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  chain: {
    id: "chain",
    title: "Copy chain",
    blurb: "b ← a, c ← b — does c get the new or old a?",
    teaching:
      "Blocking copies propagate within the edge (`c` sees the new `b`). Non-blocking freezes all RHS at the start of the edge, so `c` keeps the old `b`.",
    watch: ["a", "b", "c"],
    pokeFields: [{ name: "a", label: "A", width: 1 }],
    clock: "clk",
    blockingSnippet: "b = a;\nc = b;",
    nonblockingSnippet: "b <= a;\nc <= b;",
    blockingSource: `module tb;
  reg clk, a, b, c;
  always @(posedge clk) begin
    b = a;
    c = b;
  end
  initial begin
    clk = 0;
    a = 1;
    b = 0;
    c = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
    nonblockingSource: `module tb;
  reg clk, a, b, c;
  always @(posedge clk) begin
    b <= a;
    c <= b;
  end
  initial begin
    clk = 0;
    a = 1;
    b = 0;
    c = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  rhs_order: {
    id: "rhs_order",
    title: "RHS read order",
    blurb: "a = 1; b = a — does b see the new a?",
    teaching:
      "Blocking assigns immediately, so `b = a` sees a already 1. Non-blocking schedules both from the pre-edge values: a becomes 1, but b keeps the old a (0).",
    watch: ["a", "b"],
    pokeFields: [],
    clock: "clk",
    blockingSnippet: "a = 1'b1;\nb = a;",
    nonblockingSnippet: "a <= 1'b1;\nb <= a;",
    blockingSource: `module tb;
  reg clk, a, b;
  always @(posedge clk) begin
    a = 1'b1;
    b = a;
  end
  initial begin
    clk = 0;
    a = 0;
    b = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
    nonblockingSource: `module tb;
  reg clk, a, b;
  always @(posedge clk) begin
    a <= 1'b1;
    b <= a;
  end
  initial begin
    clk = 0;
    a = 0;
    b = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
  pipe3: {
    id: "pipe3",
    title: "Three-stage pipe",
    blurb: "q1←d, q2←q1, q3←q2 — delay vs collapse.",
    teaching:
      "Blocking collapses the whole chain in one edge. Non-blocking shifts one stage per cycle.",
    watch: ["d", "q1", "q2", "q3"],
    pokeFields: [{ name: "d", label: "D", width: 1 }],
    clock: "clk",
    blockingSnippet: "q1 = d;\nq2 = q1;\nq3 = q2;",
    nonblockingSnippet: "q1 <= d;\nq2 <= q1;\nq3 <= q2;",
    blockingSource: `module tb;
  reg clk, d, q1, q2, q3;
  always @(posedge clk) begin
    q1 = d;
    q2 = q1;
    q3 = q2;
  end
  initial begin
    clk = 0;
    d = 1;
    q1 = 0;
    q2 = 0;
    q3 = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
    nonblockingSource: `module tb;
  reg clk, d, q1, q2, q3;
  always @(posedge clk) begin
    q1 <= d;
    q2 <= q1;
    q3 <= q2;
  end
  initial begin
    clk = 0;
    d = 1;
    q1 = 0;
    q2 = 0;
    q3 = 0;
    forever #5 clk = ~clk;
  end
endmodule
`,
  },
};

const CHALLENGES = [
  {
    id: "swap-lost",
    title: "Blocking loses a bit",
    scenario: "swap",
    prompt: "On Register swap, take one ↗posedge. Blocking side should show a=0 and b=0 (the 1 is gone).",
    hint: "Reset if needed, then click ↗posedge once. Compare the two columns.",
    check: (st) =>
      st.scenarioId === "swap" &&
      st.edgeCount >= 1 &&
      st.peekB.a === "0" &&
      st.peekB.b === "0",
  },
  {
    id: "swap-ok",
    title: "Non-blocking swaps",
    scenario: "swap",
    prompt: "Same edge: non-blocking side should show a=0 and b=1 (values traded).",
    hint: "After one posedge from a=1,b=0, the <= column should be a=0, b=1.",
    check: (st) =>
      st.scenarioId === "swap" &&
      st.edgeCount >= 1 &&
      st.peekN.a === "0" &&
      st.peekN.b === "1",
  },
  {
    id: "swap-second-edge",
    title: "Swap again",
    scenario: "swap",
    prompt: "After two posedges on swap: non-blocking should be back to a=1, b=0.",
    hint: "Two edges restore the original pair with <= .",
    check: (st) =>
      st.scenarioId === "swap" &&
      st.edgeCount >= 2 &&
      st.peekN.a === "1" &&
      st.peekN.b === "0",
  },
  {
    id: "swap-block-stuck",
    title: "Blocking stays zero",
    scenario: "swap",
    prompt: "After two posedges, blocking should still be a=0, b=0.",
    hint: "Once both are 0, blocking swap cannot recover the lost 1.",
    check: (st) =>
      st.scenarioId === "swap" &&
      st.edgeCount >= 2 &&
      st.peekB.a === "0" &&
      st.peekB.b === "0",
  },
  {
    id: "pipe-same-cycle",
    title: "Blocking collapses stages",
    scenario: "pipeline",
    prompt: "Pipeline lab, D=1, one posedge: blocking q1 and q2 should both be 1.",
    hint: "Load Two-stage pipeline (D starts at 1), ↗posedge once.",
    check: (st) =>
      st.scenarioId === "pipeline" &&
      st.edgeCount >= 1 &&
      st.peekB.q1 === "1" &&
      st.peekB.q2 === "1",
  },
  {
    id: "pipe-delay",
    title: "Non-blocking delays q2",
    scenario: "pipeline",
    prompt: "Same first posedge: non-blocking should have q1=1 but q2 still 0.",
    hint: "After one edge with D=1, <= keeps the old q1 in q2.",
    check: (st) =>
      st.scenarioId === "pipeline" &&
      st.edgeCount >= 1 &&
      st.peekN.q1 === "1" &&
      st.peekN.q2 === "0",
  },
  {
    id: "pipe-second",
    title: "Second edge catches up",
    scenario: "pipeline",
    prompt: "Take a second posedge (keep D=1): non-blocking q2 should become 1.",
    hint: "↗posedge twice from the pipeline starter.",
    check: (st) =>
      st.scenarioId === "pipeline" &&
      st.edgeCount >= 2 &&
      st.peekN.q2 === "1",
  },
  {
    id: "pipe-clear-d",
    title: "Drop D mid-pipe",
    scenario: "pipeline",
    prompt: "After q2 is 1 on non-blocking, poke D=0 and take one more posedge so q1=0 while q2 stays 1.",
    hint: "Reach q2=1, set D=0, Apply poke, ↗posedge.",
    check: (st) =>
      st.scenarioId === "pipeline" &&
      st.peekN.d === "0" &&
      st.peekN.q1 === "0" &&
      st.peekN.q2 === "1",
  },
  {
    id: "chain-diff",
    title: "Chain: new vs old",
    scenario: "chain",
    prompt: "Copy chain, one posedge: blocking c=1, non-blocking c=0 (same A=1).",
    hint: "Load Copy chain, ↗posedge once — highlight the c row.",
    check: (st) =>
      st.scenarioId === "chain" &&
      st.edgeCount >= 1 &&
      st.peekB.c === "1" &&
      st.peekN.c === "0",
  },
  {
    id: "chain-b-both",
    title: "Chain: b updates",
    scenario: "chain",
    prompt: "After one posedge with A=1: both sides should have b=1.",
    hint: "b gets a on both styles in the first edge.",
    check: (st) =>
      st.scenarioId === "chain" &&
      st.edgeCount >= 1 &&
      st.peekB.b === "1" &&
      st.peekN.b === "1",
  },
  {
    id: "chain-nba-second",
    title: "Chain: c catches up",
    scenario: "chain",
    prompt: "Second posedge (A still 1): non-blocking c should become 1.",
    hint: "Two edges: c gets the previous b.",
    check: (st) =>
      st.scenarioId === "chain" &&
      st.edgeCount >= 2 &&
      st.peekN.c === "1",
  },
  {
    id: "chain-drop-a",
    title: "Chain: drop A",
    scenario: "chain",
    prompt: "After both c=1, poke A=0 and one posedge: blocking c=0, non-blocking c still 1.",
    hint: "A=0 → Apply poke → ↗posedge; compare c.",
    check: (st) =>
      st.scenarioId === "chain" &&
      st.peekB.a === "0" &&
      st.peekB.c === "0" &&
      st.peekN.c === "1",
  },
  {
    id: "rhs-block-both",
    title: "RHS: blocking both 1",
    scenario: "rhs_order",
    prompt: "RHS read order: one posedge — blocking a=1 and b=1.",
    hint: "Load RHS read order, ↗posedge once.",
    check: (st) =>
      st.scenarioId === "rhs_order" &&
      st.edgeCount >= 1 &&
      st.peekB.a === "1" &&
      st.peekB.b === "1",
  },
  {
    id: "rhs-nba-split",
    title: "RHS: non-blocking split",
    scenario: "rhs_order",
    prompt: "Same edge: non-blocking a=1 but b still 0.",
    hint: "b <= a samples the old a.",
    check: (st) =>
      st.scenarioId === "rhs_order" &&
      st.edgeCount >= 1 &&
      st.peekN.a === "1" &&
      st.peekN.b === "0",
  },
  {
    id: "rhs-nba-second",
    title: "RHS: b catches a",
    scenario: "rhs_order",
    prompt: "Second posedge: non-blocking b becomes 1.",
    hint: "Another edge copies the now-1 a into b.",
    check: (st) =>
      st.scenarioId === "rhs_order" &&
      st.edgeCount >= 2 &&
      st.peekN.b === "1",
  },
  {
    id: "pipe3-collapse",
    title: "3-stage collapse",
    scenario: "pipe3",
    prompt: "Three-stage pipe, D=1, one posedge: blocking q1=q2=q3=1.",
    hint: "Load Three-stage pipe, ↗posedge once.",
    check: (st) =>
      st.scenarioId === "pipe3" &&
      st.edgeCount >= 1 &&
      st.peekB.q1 === "1" &&
      st.peekB.q2 === "1" &&
      st.peekB.q3 === "1",
  },
  {
    id: "pipe3-first",
    title: "3-stage first hop",
    scenario: "pipe3",
    prompt: "One posedge: non-blocking q1=1, q2=0, q3=0.",
    hint: "Only the first stage updates on the first edge.",
    check: (st) =>
      st.scenarioId === "pipe3" &&
      st.edgeCount >= 1 &&
      st.peekN.q1 === "1" &&
      st.peekN.q2 === "0" &&
      st.peekN.q3 === "0",
  },
  {
    id: "pipe3-second",
    title: "3-stage second hop",
    scenario: "pipe3",
    prompt: "Two posedges: non-blocking q2=1 while q3 still 0.",
    hint: "↗posedge ×2 with D=1.",
    check: (st) =>
      st.scenarioId === "pipe3" &&
      st.edgeCount >= 2 &&
      st.peekN.q2 === "1" &&
      st.peekN.q3 === "0",
  },
  {
    id: "pipe3-third",
    title: "3-stage arrives",
    scenario: "pipe3",
    prompt: "Three posedges: non-blocking q3=1.",
    hint: "Three edges for a three-stage <= pipe.",
    check: (st) =>
      st.scenarioId === "pipe3" &&
      st.edgeCount >= 3 &&
      st.peekN.q3 === "1",
  },
  {
    id: "pipe3-vs-block",
    title: "3-stage diverge",
    scenario: "pipe3",
    prompt: "After exactly one posedge: blocking q3=1 and non-blocking q3=0.",
    hint: "Highlight the q3 difference after one edge.",
    check: (st) =>
      st.scenarioId === "pipe3" &&
      st.edgeCount === 1 &&
      st.peekB.q3 === "1" &&
      st.peekN.q3 === "0",
  },
];

/** @type {null | Awaited<ReturnType<typeof loadHdlEngine>>} */
let hdl = null;

const state = {
  scenarioId: "swap",
  /** @type {null | { peek: Function, poke: Function, start: Function, runToEdge: Function, getTime: Function, getResult: Function }} */
  sessionB: null,
  /** @type {null | typeof state.sessionB} */
  sessionN: null,
  edgeCount: 0,
  pokeDraft: {},
  msg: "",
  msgOk: true,
  outcome: "",
  challengeOn: false,
  challengeId: "swap-lost",
  challengeHint: false,
  clearedIds: loadCleared(),
};

const root = document.getElementById("bn-root");

function loadCleared() {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function saveCleared() {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify(state.clearedIds));
  } catch {
    /* ignore */
  }
}

function scenario() {
  return SCENARIOS[state.scenarioId] || SCENARIOS.swap;
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

function peekSide(session, names) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!session) return out;
  for (const n of names) out[n] = session.peek(n) ?? "x";
  return out;
}

function challengePassed() {
  if (!state.challengeOn) return false;
  const ch = challengeById(state.challengeId);
  const sc = scenario();
  try {
    return !!ch.check({
      scenarioId: state.scenarioId,
      edgeCount: state.edgeCount,
      peekB: peekSide(state.sessionB, sc.watch),
      peekN: peekSide(state.sessionN, sc.watch),
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
        scenarioId: state.scenarioId,
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
    if (data.scenarioId && SCENARIOS[data.scenarioId]) state.scenarioId = data.scenarioId;
    if (data.pokeDraft && typeof data.pokeDraft === "object") state.pokeDraft = data.pokeDraft;
    return true;
  } catch {
    return false;
  }
}

function initPokeDraft() {
  const sc = scenario();
  for (const f of sc.pokeFields) {
    if (state.pokeDraft[f.name] != null) continue;
    state.pokeDraft[f.name] = f.width > 1 ? "0".repeat(f.width) : "0";
  }
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

function applyPokesTo(session) {
  const sc = scenario();
  for (const f of sc.pokeFields) {
    const bits = normalizePoke(state.pokeDraft[f.name], f.width);
    session.poke(f.name, bits);
    state.pokeDraft[f.name] = bits;
  }
}

function restartSessions(opts = {}) {
  const { announce = true } = opts;
  if (!hdl || typeof hdl.createSession !== "function") {
    throw new Error("HDL createSession not available — rebuild vendor engine.mjs");
  }
  const sc = scenario();
  state.sessionB = hdl.createSession(sc.blockingSource, { top: "tb", maxTime: 5000 });
  state.sessionN = hdl.createSession(sc.nonblockingSource, { top: "tb", maxTime: 5000 });
  state.sessionB.start();
  state.sessionN.start();
  state.edgeCount = 0;
  state.outcome = "";
  initPokeDraft();
  applyPokesTo(state.sessionB);
  applyPokesTo(state.sessionN);
  if (announce) {
    state.msg = `Ready — ${sc.title}. Advance both sides with ↗posedge.`;
    state.msgOk = true;
  }
}

function describeOutcome() {
  const sc = scenario();
  const b = peekSide(state.sessionB, sc.watch);
  const n = peekSide(state.sessionN, sc.watch);
  const fmt = (m) => sc.watch.map((k) => `${k}=${m[k]}`).join(", ");
  return `After edge #${state.edgeCount}: blocking (${fmt(b)}) · non-blocking (${fmt(n)}). ${sc.teaching}`;
}

function doPosedge() {
  if (!state.sessionB || !state.sessionN) restartSessions({ announce: false });
  const clk = scenario().clock;
  state.sessionB.runToEdge(clk, "posedge");
  state.sessionN.runToEdge(clk, "posedge");
  state.edgeCount += 1;
  state.outcome = describeOutcome();
  state.msg = `↗posedge → t=${state.sessionB.getTime()} (both sides)`;
  state.msgOk = true;
}

function applyPokes() {
  if (!state.sessionB || !state.sessionN) restartSessions({ announce: false });
  try {
    applyPokesTo(state.sessionB);
    applyPokesTo(state.sessionN);
    state.msg = "Poke applied on both sides (before the next edge).";
    state.msgOk = true;
  } catch (e) {
    state.msg = e.message || String(e);
    state.msgOk = false;
  }
}

function loadScenario(id, opts = {}) {
  const { announce = true } = opts;
  if (!SCENARIOS[id]) return;
  state.scenarioId = id;
  state.pokeDraft = {};
  initPokeDraft();
  // Match Verilog initial values for pokeable inputs
  if (id === "pipeline" || id === "pipe3") state.pokeDraft.d = "1";
  if (id === "chain") state.pokeDraft.a = "1";
  restartSessions({ announce });
  if (announce) {
    state.msg = `Loaded ${scenario().title}.`;
    state.msgOk = true;
  }
}

function loadStarter() {
  state.challengeOn = false;
  state.challengeHint = false;
  loadScenario("swap");
  state.msg = "Starter: Register swap (a=1, b=0). Take one ↗posedge and compare columns.";
  state.msgOk = true;
}

function startChallenge(id) {
  const ch = challengeById(id);
  state.challengeId = ch.id;
  state.challengeOn = true;
  state.challengeHint = false;
  loadScenario(ch.scenario, { announce: false });
  state.msg = `Challenge “${ch.title}” — ${ch.prompt}`;
  state.msgOk = true;
}

/** Column for one assignment style; bits from that side only. */
function renderCol(kind, peek, otherPeek, snippet) {
  const sc = scenario();
  const label = kind === "blocking" ? "Blocking" : "Non-blocking";
  const op = kind === "blocking" ? "=" : "<=";
  const names = sc.watch;
  return `
    <div class="bn-col">
      <div class="panel">
        <div class="panel-head"><h2>${label} <code>${escapeHtml(op)}</code></h2></div>
        <div class="panel-body">
          <p class="bn-col-label">Registers now</p>
          <div class="bn-sigs">${names
            .map((n) => {
              const v = peek[n] ?? "x";
              const o = otherPeek[n] ?? "x";
              const diff = v !== o;
              return `
                <div class="bn-sig${diff ? " is-diff" : ""}">
                  <span class="name">${escapeHtml(n)}</span>
                  <span class="bits">${escapeHtml(v)}</span>
                </div>`;
            })
            .join("")}</div>
          <pre class="bn-code">${escapeHtml(snippet)}</pre>
        </div>
      </div>
    </div>`;
}

function render() {
  noteCleared();
  const sc = scenario();
  const ch = challengeById(state.challengeId);
  const passed = challengePassed();
  const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
  const t = state.sessionB ? state.sessionB.getTime() : 0;
  const peekB = peekSide(state.sessionB, sc.watch);
  const peekN = peekSide(state.sessionN, sc.watch);

  const scenarioBtns = Object.values(SCENARIOS)
    .map(
      (s) => `
      <button type="button" class="${s.id === state.scenarioId ? "is-active" : ""}" data-scenario="${s.id}">
        <span class="title">${escapeHtml(s.title)}</span>
        <span class="meta">${escapeHtml(s.blurb)}</span>
      </button>`
    )
    .join("");

  const pokeFields = sc.pokeFields
    .map(
      (f) => `
      <div class="bn-field">
        <label for="bn-poke-${f.name}">${escapeHtml(f.label)}</label>
        <input id="bn-poke-${f.name}" data-poke="${f.name}" value="${escapeHtml(
          state.pokeDraft[f.name] ?? "0"
        )}" maxlength="8" spellcheck="false">
      </div>`
    )
    .join("");

  const chalList = CHALLENGES.map((c) => {
    const active = c.id === state.challengeId;
    const cleared = state.clearedIds.includes(c.id);
    return `
      <button type="button" class="bn-chal-item${active ? " is-active" : ""}${
        cleared ? " is-cleared" : ""
      }" data-chal="${c.id}">
        <span class="bn-chal-mark">${cleared ? "✓" : "○"}</span>
        <span>
          <span class="bn-chal-title">${escapeHtml(c.title)}</span>
          <span class="bn-chal-meta">${escapeHtml(SCENARIOS[c.scenario]?.title || c.scenario)}</span>
        </span>
      </button>`;
  }).join("");

  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Register swap with <code>a=1</code>, <code>b=0</code>.
        One <strong>↗posedge</strong> — blocking loses the 1; non-blocking swaps.</p>
      <button type="button" class="btn btn-secondary" id="bn-starter">Load starter example</button>
    </div>

    <div class="challenge">
      <div class="bn-chal-head">
        <h2>Challenges</h2>
        <span class="bn-chal-progress">${clearedCount} / ${CHALLENGES.length} cleared</span>
      </div>
      <div class="bn-chal-catalog">${chalList}</div>
      <p><strong>${escapeHtml(ch.title)}:</strong> ${escapeHtml(ch.prompt)}</p>
      ${
        state.challengeHint
          ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
          : ""
      }
      <div class="tool-actions">
        <button type="button" class="btn btn-secondary" id="bn-chal-start">${
          state.challengeOn ? "Restart" : "Start"
        }</button>
        <button type="button" class="btn btn-ghost" id="bn-chal-hint">${
          state.challengeHint ? "Hide hint" : "Show hint"
        }</button>
        <button type="button" class="btn btn-ghost" id="bn-chal-next" ${passed ? "" : "disabled"}>Next</button>
        <button type="button" class="btn btn-ghost" id="bn-chal-stop" ${
          state.challengeOn ? "" : "disabled"
        }>Stop</button>
        <span class="challenge-status ${passed ? "pass" : "idle"}">${
          passed ? "Matched" : state.challengeOn ? "Checking…" : "Idle"
        }</span>
      </div>
    </div>

    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Scenario</h2></div>
      <div class="panel-body">
        <div class="bn-scenario-grid">${scenarioBtns}</div>
        <p class="bn-meta">time <strong>t=${t}</strong> · edges <strong>${state.edgeCount}</strong></p>
        <div class="bn-toolbar">
          <button type="button" class="btn btn-secondary" id="bn-reset">Reset both</button>
          <button type="button" class="btn btn-primary" id="bn-posedge">↗posedge clk</button>
        </div>
        ${
          sc.pokeFields.length
            ? `<div class="bn-poke-row">
                ${pokeFields}
                <button type="button" class="btn btn-secondary" id="bn-apply-poke">Apply poke</button>
              </div>`
            : ""
        }
        <p class="bn-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
        <p class="bn-hint">Both sides share the same clock and pokes. Highlighted rows differ between <code>=</code> and <code>&lt;=</code>.</p>
      </div>
    </div>

    <div class="bn-compare">
      ${renderCol("blocking", peekB, peekN, sc.blockingSnippet)}
      ${renderCol("nonblocking", peekN, peekB, sc.nonblockingSnippet)}
    </div>

    ${
      state.outcome
        ? `<div class="bn-outcome"><strong>What happened</strong>${escapeHtml(state.outcome)}</div>`
        : ""
    }
  `;

  bind();
  persist();
}

function bind() {
  root.querySelector("#bn-starter").addEventListener("click", () => {
    loadStarter();
    render();
  });

  root.querySelectorAll("[data-scenario]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadScenario(btn.getAttribute("data-scenario"));
      render();
    });
  });

  root.querySelector("#bn-reset").addEventListener("click", () => {
    try {
      restartSessions();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });

  root.querySelector("#bn-posedge").addEventListener("click", () => {
    try {
      doPosedge();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  });

  const pokeBtn = root.querySelector("#bn-apply-poke");
  if (pokeBtn) {
    pokeBtn.addEventListener("click", () => {
      applyPokes();
      render();
    });
  }

  root.querySelectorAll("[data-poke]").forEach((inp) => {
    inp.addEventListener("change", () => {
      state.pokeDraft[inp.getAttribute("data-poke")] = inp.value;
    });
  });

  root.querySelectorAll("[data-chal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.challengeId = btn.getAttribute("data-chal");
      state.challengeHint = false;
      render();
    });
  });

  root.querySelector("#bn-chal-start").addEventListener("click", () => {
    startChallenge(state.challengeId);
    render();
  });

  root.querySelector("#bn-chal-hint").addEventListener("click", () => {
    state.challengeHint = !state.challengeHint;
    render();
  });

  root.querySelector("#bn-chal-next").addEventListener("click", () => {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    const next = CHALLENGES[(i + 1) % CHALLENGES.length];
    startChallenge(next.id);
    render();
  });

  root.querySelector("#bn-chal-stop").addEventListener("click", () => {
    state.challengeOn = false;
    state.challengeHint = false;
    state.msg = "Challenge stopped.";
    state.msgOk = true;
    render();
  });
}

async function main() {
  root.innerHTML = `<p class="bn-hint">Loading…</p>`;
  try {
    hdl = await loadHdlEngine();
    if (typeof hdl.createSession !== "function") {
      throw new Error("createSession missing from engine.mjs — run scripts/build-engine-vendor.mjs");
    }
  } catch (e) {
    root.innerHTML = `<p class="bn-hint" style="color:#b00">Could not load HDL engine: ${escapeHtml(
      e.message || String(e)
    )}</p>`;
    return;
  }

  const restored = tryRestore();
  initPokeDraft();
  if (state.scenarioId === "pipeline" || state.scenarioId === "pipe3") {
    if (state.pokeDraft.d == null) state.pokeDraft.d = "1";
  }
  if (state.scenarioId === "chain" && state.pokeDraft.a == null) state.pokeDraft.a = "1";
  try {
    restartSessions({ announce: !restored });
    if (!restored) {
      state.msg = "Starter: Register swap. Take one ↗posedge and compare columns.";
      state.msgOk = true;
    } else {
      state.msg = `Restored ${scenario().title}.`;
      state.msgOk = true;
    }
  } catch (e) {
    state.msg = e.message || String(e);
    state.msgOk = false;
  }
  render();
}

main();
