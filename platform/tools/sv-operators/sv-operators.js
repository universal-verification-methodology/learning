import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-sv-operators-v1";
const CLEARED_KEY = "ddv-sv-operators-cleared-v1";

/** @type {null | Awaited<ReturnType<typeof loadHdlEngine>>} */
let hdl = null;

function groupBits(bin) {
  return String(bin).replace(/(.{4})(?=.)/g, "$1_");
}

function padBits(bits, w) {
  let b = String(bits).toLowerCase().replace(/[^01xz]/g, "");
  if (b.length > w) b = b.slice(-w);
  while (b.length < w) b = "0" + b;
  return b || "0".repeat(Math.max(1, w));
}

function bitsToUint(bits) {
  if (/[xz]/.test(bits)) return null;
  return parseInt(bits, 2) >>> 0;
}

function isTruthy(bits) {
  if (/[xz]/.test(bits)) return null; // X/Z → unknown; treat as falsey for teaching 1-bit? SV: x is unknown
  return /1/.test(bits);
}

function zipBits(a, b, fn) {
  const w = Math.max(a.length, b.length);
  const A = padBits(a, w);
  const B = padBits(b, w);
  let out = "";
  for (let i = 0; i < w; i++) out += fn(A[i], B[i]);
  return out;
}

function bitAnd(x, y) {
  if (x === "0" || y === "0") return "0";
  if (x === "1" && y === "1") return "1";
  return "x";
}
function bitOr(x, y) {
  if (x === "1" || y === "1") return "1";
  if (x === "0" && y === "0") return "0";
  return "x";
}
function bitXor(x, y) {
  if (/[xz]/.test(x + y)) return "x";
  return x === y ? "0" : "1";
}
function bitNot(x) {
  if (x === "0") return "1";
  if (x === "1") return "0";
  return "x";
}

function reduceAnd(bits) {
  return bits.split("").reduce((a, b) => bitAnd(a, b));
}
function reduceOr(bits) {
  return bits.split("").reduce((a, b) => bitOr(a, b));
}
function reduceXor(bits) {
  return bits.split("").reduce((a, b) => bitXor(a, b));
}

function shl(bits, n) {
  const w = bits.length;
  const k = Math.min(Math.max(0, n | 0), w);
  return bits.slice(k) + "0".repeat(k);
}
function shrLogical(bits, n) {
  const w = bits.length;
  const k = Math.min(Math.max(0, n | 0), w);
  return "0".repeat(k) + bits.slice(0, w - k);
}
function shrArith(bits, n) {
  const w = bits.length;
  const k = Math.min(Math.max(0, n | 0), w);
  const fill = bits[0] || "0";
  return fill.repeat(k) + bits.slice(0, w - k);
}

function replicate(bits, n) {
  const k = Math.max(0, n | 0);
  return bits.repeat(k) || "0";
}

async function parseOperand(text, fallbackWidth) {
  const t = String(text).trim();
  if (hdl && typeof hdl.parseLiteral === "function") {
    try {
      const raw = hdl.parseLiteral(t);
      if (raw && raw.ok && raw.value && raw.value.bits) {
        return { bits: String(raw.value.bits).toLowerCase(), width: raw.size || raw.value.bits.length, ok: true };
      }
    } catch {
      /* fall through */
    }
  }
  // fallback: bare binary or 0b / hex
  let bits = t.toLowerCase().replace(/^0b/, "").replace(/_/g, "");
  if (/^[01xz]+$/.test(bits)) return { bits, width: bits.length, ok: true };
  if (/^0x[0-9a-f]+$/.test(bits)) {
    const n = parseInt(bits.slice(2), 16);
    const w = fallbackWidth || Math.max(4, n.toString(2).length);
    return { bits: padBits(n.toString(2), w), width: w, ok: true };
  }
  if (/^\d+$/.test(bits)) {
    const n = parseInt(bits, 10);
    const w = fallbackWidth || Math.max(4, n.toString(2).length);
    return { bits: padBits(n.toString(2), w), width: w, ok: true };
  }
  return { bits: padBits("0", fallbackWidth || 4), width: fallbackWidth || 4, ok: false, error: "Could not parse operand" };
}

const OPS = [
  { id: "band", label: "&", group: "bitwise", arity: 2, note: "Bitwise AND — per bit" },
  { id: "bor", label: "|", group: "bitwise", arity: 2, note: "Bitwise OR — per bit" },
  { id: "bxor", label: "^", group: "bitwise", arity: 2, note: "Bitwise XOR — per bit" },
  { id: "bnot", label: "~", group: "bitwise", arity: 1, note: "Bitwise NOT — invert each bit" },
  { id: "land", label: "&&", group: "logical", arity: 2, note: "Logical AND — 1-bit truth of nonzero" },
  { id: "lor", label: "||", group: "logical", arity: 2, note: "Logical OR — 1-bit truth of nonzero" },
  { id: "lnot", label: "!", group: "logical", arity: 1, note: "Logical NOT — 1 if operand is all-zero" },
  { id: "rand", label: "&()", group: "reduce", arity: 1, note: "Reduction AND" },
  { id: "ror", label: "|()", group: "reduce", arity: 1, note: "Reduction OR" },
  { id: "rxor", label: "^()", group: "reduce", arity: 1, note: "Reduction XOR (parity)" },
  { id: "concat", label: "{,}", group: "struct", arity: 2, note: "Concatenation {A,B}" },
  { id: "repl", label: "{n{}}", group: "struct", arity: 1, note: "Replication {N{A}} — N from shift field" },
  { id: "shl", label: "<<", group: "shift", arity: 1, note: "Logical left shift — amount from N" },
  { id: "shr", label: ">>", group: "shift", arity: 1, note: "Logical right shift" },
  { id: "ashr", label: ">>>", group: "shift", arity: 1, note: "Arithmetic right shift (sign fill)" },
  { id: "eq", label: "==", group: "cmp", arity: 2, note: "Equality (X/Z → x)" },
  { id: "caseeq", label: "===", group: "cmp", arity: 2, note: "Case equality (X/Z must match)" },
];

function evalOp(opId, aBits, bBits, n) {
  switch (opId) {
    case "band":
      return { bits: zipBits(aBits, bBits, bitAnd), width: Math.max(aBits.length, bBits.length), explain: "per-bit AND" };
    case "bor":
      return { bits: zipBits(aBits, bBits, bitOr), width: Math.max(aBits.length, bBits.length), explain: "per-bit OR" };
    case "bxor":
      return { bits: zipBits(aBits, bBits, bitXor), width: Math.max(aBits.length, bBits.length), explain: "per-bit XOR" };
    case "bnot":
      return { bits: aBits.split("").map(bitNot).join(""), width: aBits.length, explain: "invert each bit" };
    case "land": {
      const ta = isTruthy(aBits);
      const tb = isTruthy(bBits);
      const bits = ta === null || tb === null ? "x" : ta && tb ? "1" : "0";
      return { bits, width: 1, explain: "1 iff both operands nonzero" };
    }
    case "lor": {
      const ta = isTruthy(aBits);
      const tb = isTruthy(bBits);
      const bits = ta === null || tb === null ? "x" : ta || tb ? "1" : "0";
      return { bits, width: 1, explain: "1 iff either operand nonzero" };
    }
    case "lnot": {
      const t = isTruthy(aBits);
      return { bits: t === null ? "x" : t ? "0" : "1", width: 1, explain: "1 iff operand is zero" };
    }
    case "rand":
      return { bits: reduceAnd(aBits), width: 1, explain: "AND of all bits" };
    case "ror":
      return { bits: reduceOr(aBits), width: 1, explain: "OR of all bits" };
    case "rxor":
      return { bits: reduceXor(aBits), width: 1, explain: "XOR of all bits (parity)" };
    case "concat":
      return { bits: aBits + bBits, width: aBits.length + bBits.length, explain: "{A,B} left then right" };
    case "repl":
      return { bits: replicate(aBits, n), width: aBits.length * Math.max(0, n | 0), explain: `{${n}{A}}` };
    case "shl":
      return { bits: shl(aBits, n), width: aBits.length, explain: `A << ${n}` };
    case "shr":
      return { bits: shrLogical(aBits, n), width: aBits.length, explain: `A >> ${n}` };
    case "ashr":
      return { bits: shrArith(aBits, n), width: aBits.length, explain: `A >>> ${n} (arith)` };
    case "eq": {
      const w = Math.max(aBits.length, bBits.length);
      const A = padBits(aBits, w);
      const B = padBits(bBits, w);
      if (/[xz]/.test(A + B)) return { bits: "x", width: 1, explain: "== with X/Z → x" };
      return { bits: A === B ? "1" : "0", width: 1, explain: "bitwise equal" };
    }
    case "caseeq": {
      const w = Math.max(aBits.length, bBits.length);
      const A = padBits(aBits, w);
      const B = padBits(bBits, w);
      return { bits: A === B ? "1" : "0", width: 1, explain: "=== matches X/Z exactly" };
    }
    default:
      return { bits: "0", width: 1, explain: "" };
  }
}

function formatExpr(op, aLit, bLit, n) {
  const o = OPS.find((x) => x.id === op);
  if (!o) return "";
  if (o.arity === 1) {
    if (op === "repl") return `{${n}{${aLit}}}`;
    if (op === "shl") return `${aLit} << ${n}`;
    if (op === "shr") return `${aLit} >> ${n}`;
    if (op === "ashr") return `${aLit} >>> ${n}`;
    if (op.startsWith("r")) return `${o.label[0]}${aLit}`;
    return `${o.label}${aLit}`;
  }
  if (op === "concat") return `{${aLit}, ${bLit}}`;
  return `${aLit} ${o.label} ${bLit}`;
}

const CHALLENGES = [
  {
    id: "quiz-bw-vs-log",
    title: "Quiz: & vs &&",
    type: "quiz",
    prompt: "For multi-bit vectors, & is _____ while && is _____.",
    hint: "Per-bit vs truthiness.",
    choices: ["bitwise / logical (1-bit)", "logical / bitwise", "the same", "only for X/Z"],
    answer: "bitwise / logical (1-bit)",
  },
  {
    id: "quiz-land-width",
    title: "Quiz: && width",
    type: "quiz",
    prompt: "A && B yields a result of width…",
    hint: "Logical ops collapse to 1 bit.",
    choices: ["1", "same as A", "same as B", "A.width+B.width"],
    answer: "1",
  },
  {
    id: "quiz-bnot",
    title: "Quiz: ~ vs !",
    type: "quiz",
    prompt: "~A inverts _____; !A inverts _____.",
    hint: "Bits vs truth.",
    choices: ["each bit / truth of nonzero", "truth / each bit", "only MSB / only LSB", "nothing / everything"],
    answer: "each bit / truth of nonzero",
  },
  {
    id: "quiz-reduce",
    title: "Quiz: reduction &",
    type: "quiz",
    prompt: "&4'b1101 equals…",
    hint: "AND all bits.",
    choices: ["0", "1", "4'b1101", "x"],
    answer: "0",
  },
  {
    id: "quiz-ror",
    title: "Quiz: reduction |",
    type: "quiz",
    prompt: "|4'b1000 equals…",
    hint: "Any bit 1?",
    choices: ["1", "0", "4'b1000", "8"],
    answer: "1",
  },
  {
    id: "quiz-concat",
    title: "Quiz: concat",
    type: "quiz",
    prompt: "{2'b10, 2'b01} equals…",
    hint: "Left then right.",
    choices: ["4'b1001", "4'b0110", "2'b11", "4'b1010"],
    answer: "4'b1001",
  },
  {
    id: "quiz-repl",
    title: "Quiz: replicate",
    type: "quiz",
    prompt: "{2{2'b10}} equals…",
    hint: "Repeat the pattern.",
    choices: ["4'b1010", "4'b1001", "2'b10", "4'b0101"],
    answer: "4'b1010",
  },
  {
    id: "quiz-shl",
    title: "Quiz: <<",
    type: "quiz",
    prompt: "4'b0001 << 2 equals…",
    hint: "Shift left, zeros in.",
    choices: ["4'b0100", "4'b0010", "4'b1000", "4'b0001"],
    answer: "4'b0100",
  },
  {
    id: "quiz-ashr",
    title: "Quiz: >>>",
    type: "quiz",
    prompt: "Arithmetic >>> on 4'b1000 by 1 fills with…",
    hint: "Sign bit.",
    choices: ["1 (MSB)", "0", "x", "z"],
    answer: "1 (MSB)",
  },
  {
    id: "quiz-caseeq",
    title: "Quiz: ===",
    type: "quiz",
    prompt: "4'b10x0 === 4'b10x0 is…",
    hint: "Case equality matches X.",
    choices: ["1", "0", "x", "z"],
    answer: "1",
  },
  {
    id: "run-band",
    title: "Run: bitwise &",
    type: "run",
    prompt: "Set A=4'b1010, B=4'b1100, op &. Result should be 1000.",
    hint: "Load starter-like values; click &.",
    setup: { a: "4'b1010", b: "4'b1100", op: "band", n: 1 },
    check: (r) => r.bits === "1000",
  },
  {
    id: "run-land",
    title: "Run: logical &&",
    type: "run",
    prompt: "Same A/B with && → result 1 (both nonzero).",
    hint: "Switch to &&.",
    setup: { a: "4'b1010", b: "4'b1100", op: "land", n: 1 },
    check: (r) => r.bits === "1",
  },
  {
    id: "run-land0",
    title: "Run: && with zero",
    type: "run",
    prompt: "A=4'b1010, B=4'b0000, && → 0.",
    hint: "B is zero.",
    setup: { a: "4'b1010", b: "4'b0000", op: "land", n: 1 },
    check: (r) => r.bits === "0",
  },
  {
    id: "run-bnot",
    title: "Run: bitwise ~",
    type: "run",
    prompt: "A=4'b1010, ~ → 0101.",
    hint: "Unary ~.",
    setup: { a: "4'b1010", b: "4'b0000", op: "bnot", n: 1 },
    check: (r) => r.bits === "0101",
  },
  {
    id: "run-lnot",
    title: "Run: logical !",
    type: "run",
    prompt: "A=4'b0000, ! → 1.",
    hint: "Zero is false.",
    setup: { a: "4'b0000", b: "4'b0000", op: "lnot", n: 1 },
    check: (r) => r.bits === "1",
  },
  {
    id: "run-rand",
    title: "Run: & reduction",
    type: "run",
    prompt: "A=4'b1111, reduction & → 1.",
    hint: "All ones.",
    setup: { a: "4'b1111", b: "4'b0000", op: "rand", n: 1 },
    check: (r) => r.bits === "1",
  },
  {
    id: "run-concat",
    title: "Run: concat",
    type: "run",
    prompt: "A=2'b10, B=2'b01, {,} → 1001.",
    hint: "Concat op.",
    setup: { a: "2'b10", b: "2'b01", op: "concat", n: 1 },
    check: (r) => r.bits === "1001",
  },
  {
    id: "run-repl",
    title: "Run: replicate",
    type: "run",
    prompt: "A=2'b10, N=2, {n{}} → 1010.",
    hint: "Set N=2.",
    setup: { a: "2'b10", b: "2'b00", op: "repl", n: 2 },
    check: (r) => r.bits === "1010",
  },
  {
    id: "run-shl",
    title: "Run: <<",
    type: "run",
    prompt: "A=4'b0001, N=3, << → 1000.",
    hint: "Shift left 3.",
    setup: { a: "4'b0001", b: "4'b0000", op: "shl", n: 3 },
    check: (r) => r.bits === "1000",
  },
  {
    id: "run-ashr",
    title: "Run: >>>",
    type: "run",
    prompt: "A=4'b1000, N=1, >>> → 1100.",
    hint: "Sign fill with 1.",
    setup: { a: "4'b1000", b: "4'b0000", op: "ashr", n: 1 },
    check: (r) => r.bits === "1100",
  },
  {
    id: "run-disagree",
    title: "See & vs &&",
    type: "run",
    prompt: "A=4'b1010, B=4'b0101: note & is 0000 while && is 1.",
    hint: "Use & then check; compare panes show the pair.",
    setup: { a: "4'b1010", b: "4'b0101", op: "band", n: 1 },
    check: (r, ctx) => r.bits === "0000" && ctx.landBits === "1",
  },
  {
    id: "quiz-rxor",
    title: "Quiz: parity ^",
    type: "quiz",
    prompt: "^4'b1011 (reduction XOR) equals…",
    hint: "Odd number of 1s → 1.",
    choices: ["1", "0", "4'b1011", "x"],
    answer: "1",
  },
];

function loadCleared() {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(String);
  } catch {
    return [];
  }
}

const state = {
  aLit: "4'b1010",
  bLit: "4'b1100",
  n: 1,
  op: "band",
  aBits: "1010",
  bBits: "1100",
  clearedIds: loadCleared(),
  challengeIdx: 0,
  showHint: false,
  quizChoice: "",
  engineNote: "",
};

function saveCleared() {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify(state.clearedIds));
  } catch {
    /* ignore */
  }
}

function saveSession() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ aLit: state.aLit, bLit: state.bLit, n: state.n, op: state.op })
    );
  } catch {
    /* ignore */
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.aLit) state.aLit = d.aLit;
    if (d.bLit) state.bLit = d.bLit;
    if (d.n != null) state.n = Number(d.n) || 1;
    if (d.op && OPS.some((o) => o.id === d.op)) state.op = d.op;
    return true;
  } catch {
    return false;
  }
}

function loadStarter() {
  state.aLit = "4'b1010";
  state.bLit = "4'b1100";
  state.n = 1;
  state.op = "band";
}

async function refreshOperands() {
  const a = await parseOperand(state.aLit, 4);
  const b = await parseOperand(state.bLit, 4);
  state.aBits = a.bits;
  state.bBits = b.bits;
  state.engineNote = a.ok && b.ok ? (hdl ? "Literals via HDL parseLiteral" : "Local literal parse") : "Check operand syntax";
}

const root = document.getElementById("op-root");
root.innerHTML = `
  <p class="starter-note" id="starter-note"></p>
  <div class="challenge">
    <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
    <p id="chal-prompt"></p>
    <p class="chal-hint" id="chal-hint" hidden></p>
    <div id="chal-quiz" class="quiz-choices" hidden></div>
    <div class="tool-actions">
      <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
      <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
      <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
      <button type="button" class="btn btn-ghost" id="chal-load">Load challenge setup</button>
      <span class="challenge-status idle" id="chal-status">Idle</span>
    </div>
    <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <h2>Operands &amp; operators</h2>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="op-controls">
        <div class="op-field">
          <label for="a-in">A</label>
          <input id="a-in" type="text" value="4'b1010">
        </div>
        <div class="op-field">
          <label for="b-in">B</label>
          <input id="b-in" type="text" value="4'b1100">
        </div>
        <div class="op-field">
          <label for="n-in">N (shift / replicate)</label>
          <input id="n-in" type="number" min="0" max="16" value="1" style="min-width:4.5rem">
        </div>
      </div>
      <div class="op-btns" id="op-btns"></div>
      <div class="result-card" id="result"></div>
      <p class="op-meta" id="meta"></p>
    </div>
  </div>
`;

function setChalStatus(kind, msg) {
  const el = document.getElementById("chal-status");
  el.className = "challenge-status " + kind;
  el.textContent = msg;
}

function currentResult() {
  return evalOp(state.op, state.aBits, state.bBits, state.n);
}

async function renderLab() {
  document.getElementById("starter-note").textContent =
    "Starter example: 4'b1010 & 4'b1100 → 1000; switch to && → 1 (both nonzero).";
  document.getElementById("a-in").value = state.aLit;
  document.getElementById("b-in").value = state.bLit;
  document.getElementById("n-in").value = String(state.n);

  const btns = document.getElementById("op-btns");
  btns.innerHTML = "";
  OPS.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = o.label;
    b.title = o.note;
    if (o.id === state.op) b.classList.add("active");
    b.addEventListener("click", async () => {
      state.op = o.id;
      saveSession();
      await renderLab();
    });
    btns.appendChild(b);
  });

  await refreshOperands();
  const r = currentResult();
  const op = OPS.find((x) => x.id === state.op);
  const expr = formatExpr(state.op, state.aLit, state.bLit, state.n);
  const land = evalOp("land", state.aBits, state.bBits, state.n);
  const band = evalOp("band", state.aBits, state.bBits, state.n);
  const showCmp = state.op === "band" || state.op === "land" || state.op === "bor" || state.op === "lor";

  document.getElementById("result").innerHTML = `
    <div class="expr">${expr}</div>
    <div class="bits">${groupBits(r.bits)} <span style="font-size:0.85rem;font-weight:500;color:var(--muted)">(${r.width}'b)</span></div>
    <p class="note">${op ? op.note : ""} — ${r.explain}</p>
    <p class="note">A=${groupBits(state.aBits)} · B=${groupBits(state.bBits)}</p>
    ${
      showCmp
        ? `<div class="compare-row">
      <div class="compare-pane${band.bits !== land.bits && band.bits.length !== land.bits.length ? " diff" : ""}">
        <strong>Bitwise &amp;</strong>${groupBits(band.bits)}
      </div>
      <div class="compare-pane">
        <strong>Logical &amp;&amp;</strong>${groupBits(land.bits)}
      </div>
    </div>`
        : ""
    }`;
  document.getElementById("meta").textContent = state.engineNote;
}

function renderChallenge() {
  const ch = CHALLENGES[state.challengeIdx];
  const cleared = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
  document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
  document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
  const hintEl = document.getElementById("chal-hint");
  if (state.showHint) {
    hintEl.hidden = false;
    hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
  } else hintEl.hidden = true;
  document.getElementById("chal-hint-btn").textContent = state.showHint ? "Hide hint" : "Show hint";

  const quiz = document.getElementById("chal-quiz");
  if (ch.type === "quiz") {
    quiz.hidden = false;
    quiz.innerHTML = ch.choices
      .map(
        (c) =>
          `<label><input type="radio" name="op-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
            state.quizChoice === c ? "checked" : ""
          }> ${c}</label>`
      )
      .join("");
    quiz.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("change", () => {
        state.quizChoice = inp.value;
      });
    });
  } else {
    quiz.hidden = true;
    quiz.innerHTML = "";
  }

  const cat = document.getElementById("chal-catalog");
  cat.innerHTML = "";
  CHALLENGES.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = (state.clearedIds.includes(c.id) ? "✓ " : "") + c.title;
    if (i === state.challengeIdx) b.style.outline = "2px solid var(--accent)";
    b.addEventListener("click", () => {
      state.challengeIdx = i;
      state.showHint = false;
      state.quizChoice = "";
      setChalStatus("idle", "Idle");
      renderChallenge();
    });
    cat.appendChild(b);
  });
}

async function loadChallengeSetup() {
  const ch = CHALLENGES[state.challengeIdx];
  if (ch.setup) {
    state.aLit = ch.setup.a;
    state.bLit = ch.setup.b;
    state.op = ch.setup.op;
    state.n = ch.setup.n;
    saveSession();
    await renderLab();
    setChalStatus("idle", "Setup loaded — Check when ready");
  } else setChalStatus("idle", "Quiz — pick an answer");
}

async function checkChallenge() {
  const ch = CHALLENGES[state.challengeIdx];
  let ok = false;
  if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
  else {
    await refreshOperands();
    const r = currentResult();
    const land = evalOp("land", state.aBits, state.bBits, state.n);
    ok = !!ch.check(r, { landBits: land.bits });
    if (ch.setup && state.op !== ch.setup.op) {
      setChalStatus("fail", "Wrong operator — Load challenge setup");
      return;
    }
  }
  if (ok) {
    if (!state.clearedIds.includes(ch.id)) {
      state.clearedIds = [...state.clearedIds, ch.id];
      saveCleared();
    }
    setChalStatus("pass", "Pass");
    renderChallenge();
  } else setChalStatus("fail", "Not yet");
}

async function boot() {
  try {
    hdl = await loadHdlEngine();
  } catch {
    hdl = null;
  }
  if (!restoreSession()) loadStarter();
  document.getElementById("a-in").addEventListener("change", async (e) => {
    state.aLit = e.target.value;
    saveSession();
    await renderLab();
  });
  document.getElementById("b-in").addEventListener("change", async (e) => {
    state.bLit = e.target.value;
    saveSession();
    await renderLab();
  });
  document.getElementById("n-in").addEventListener("change", async (e) => {
    state.n = Number(e.target.value) || 0;
    saveSession();
    await renderLab();
  });
  document.getElementById("btn-starter").addEventListener("click", async () => {
    loadStarter();
    saveSession();
    await renderLab();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", () => checkChallenge());
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.quizChoice = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", () => loadChallengeSetup());

  await renderLab();
  renderChallenge();
}

boot();
