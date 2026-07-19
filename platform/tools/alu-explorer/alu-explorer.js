(() => {
  const STORAGE_KEY = "ddv-alu-explorer-v1";
  const CLEARED_KEY = "ddv-alu-explorer-cleared-v1";

  const OPS = [
    { id: "ADD", label: "ADD", expr: "A + B" },
    { id: "SUB", label: "SUB", expr: "A − B" },
    { id: "AND", label: "AND", expr: "A & B" },
    { id: "OR", label: "OR", expr: "A | B" },
    { id: "XOR", label: "XOR", expr: "A ^ B" },
    { id: "NOT", label: "NOT", expr: "~A" },
    { id: "NAND", label: "NAND", expr: "~(A & B)" },
    { id: "NOR", label: "NOR", expr: "~(A | B)" },
    { id: "SHL", label: "SHL", expr: "A << 1" },
    { id: "SHR", label: "SHR", expr: "A >> 1" },
    { id: "SLT", label: "SLT", expr: "A < B (u)" },
    { id: "SLTS", label: "SLT.S", expr: "A < B (s)" },
    { id: "PASSA", label: "PASSA", expr: "A" },
    { id: "PASSB", label: "PASSB", expr: "B" },
  ];

  function mask(w) {
    return (1 << w) - 1;
  }

  function toBits(n, w) {
    return (n & mask(w)).toString(2).padStart(w, "0");
  }

  function toSigned(u, w) {
    const sign = 1 << (w - 1);
    return u & sign ? u - (1 << w) : u;
  }

  function bitsToInt(bits) {
    return parseInt(bits.join(""), 2) >>> 0;
  }

  function intToBits(n, w) {
    const s = toBits(n, w);
    return s.split("").map((c) => (c === "1" ? 1 : 0));
  }

  function evalAlu(op, a, b, w) {
    const m = mask(w);
    const A = a & m;
    const B = b & m;
    let y = 0;
    let c = 0;
    let v = 0;

    switch (op) {
      case "ADD": {
        const sum = A + B;
        y = sum & m;
        c = sum > m ? 1 : 0;
        // signed overflow: same sign operands, result different sign
        const as = toSigned(A, w);
        const bs = toSigned(B, w);
        const ys = toSigned(y, w);
        v = (as >= 0 && bs >= 0 && ys < 0) || (as < 0 && bs < 0 && ys >= 0) ? 1 : 0;
        break;
      }
      case "SUB": {
        const diff = A - B;
        y = diff & m;
        c = A >= B ? 1 : 0; // not-borrow (common teaching: C=1 means no borrow)
        const as = toSigned(A, w);
        const bs = toSigned(B, w);
        const ys = toSigned(y, w);
        v = (as >= 0 && bs < 0 && ys < 0) || (as < 0 && bs >= 0 && ys >= 0) ? 1 : 0;
        break;
      }
      case "AND":
        y = A & B;
        break;
      case "OR":
        y = A | B;
        break;
      case "XOR":
        y = A ^ B;
        break;
      case "NOT":
        y = (~A) & m;
        break;
      case "NAND":
        y = (~(A & B)) & m;
        break;
      case "NOR":
        y = (~(A | B)) & m;
        break;
      case "SHL":
        c = (A >> (w - 1)) & 1;
        y = (A << 1) & m;
        break;
      case "SHR":
        c = A & 1;
        y = A >>> 1;
        break;
      case "SLT":
        y = A < B ? 1 : 0;
        break;
      case "SLTS":
        y = toSigned(A, w) < toSigned(B, w) ? 1 : 0;
        break;
      case "PASSA":
        y = A;
        break;
      case "PASSB":
        y = B;
        break;
      default:
        y = 0;
    }

    const z = y === 0 ? 1 : 0;
    const n = (y >> (w - 1)) & 1;
    return { y, z, n, c, v, bits: toBits(y, w), aU: A, bU: B, aS: toSigned(A, w), bS: toSigned(B, w), yS: toSigned(y, w) };
  }

  const CHALLENGES = [
    {
      id: "add-5-3",
      title: "ADD 5+3",
      type: "run",
      prompt: "4-bit ADD with A=5, B=3 → Y=8, Z=0.",
      hint: "Opcode ADD; set A/B bits or decimals.",
      setup: { w: 4, op: "ADD", a: 5, b: 3 },
      check: (r, s) => s.op === "ADD" && s.w === 4 && r.y === 8 && r.z === 0,
    },
    {
      id: "add-carry",
      title: "ADD carry",
      type: "run",
      prompt: "4-bit ADD A=15, B=1 → Y=0, C=1, Z=1.",
      hint: "Unsigned wrap.",
      setup: { w: 4, op: "ADD", a: 15, b: 1 },
      check: (r, s) => s.op === "ADD" && r.y === 0 && r.c === 1 && r.z === 1,
    },
    {
      id: "add-overflow",
      title: "ADD overflow V",
      type: "run",
      prompt: "4-bit ADD A=7, B=1 → Y=8 (−8 signed), V=1.",
      hint: "7+1 overflows signed 4-bit.",
      setup: { w: 4, op: "ADD", a: 7, b: 1 },
      check: (r, s) => s.op === "ADD" && r.y === 8 && r.v === 1,
    },
    {
      id: "sub-basic",
      title: "SUB 9−4",
      type: "run",
      prompt: "4-bit SUB A=9, B=4 → Y=5, C=1 (no borrow).",
      hint: "C=1 means A≥B.",
      setup: { w: 4, op: "SUB", a: 9, b: 4 },
      check: (r, s) => s.op === "SUB" && r.y === 5 && r.c === 1,
    },
    {
      id: "sub-borrow",
      title: "SUB borrow",
      type: "run",
      prompt: "4-bit SUB A=3, B=5 → Y=14, C=0.",
      hint: "Borrow → C=0.",
      setup: { w: 4, op: "SUB", a: 3, b: 5 },
      check: (r, s) => s.op === "SUB" && r.y === 14 && r.c === 0,
    },
    {
      id: "and-op",
      title: "AND",
      type: "run",
      prompt: "AND A=0b1100, B=0b1010 → Y=0b1000.",
      hint: "A=12, B=10.",
      setup: { w: 4, op: "AND", a: 12, b: 10 },
      check: (r, s) => s.op === "AND" && r.y === 8,
    },
    {
      id: "or-op",
      title: "OR",
      type: "run",
      prompt: "OR A=0b0101, B=0b0011 → Y=0b0111.",
      hint: "A=5, B=3.",
      setup: { w: 4, op: "OR", a: 5, b: 3 },
      check: (r, s) => s.op === "OR" && r.y === 7,
    },
    {
      id: "xor-op",
      title: "XOR",
      type: "run",
      prompt: "XOR A=0b1100, B=0b1010 → Y=0b0110.",
      hint: "A=12, B=10.",
      setup: { w: 4, op: "XOR", a: 12, b: 10 },
      check: (r, s) => s.op === "XOR" && r.y === 6,
    },
    {
      id: "not-op",
      title: "NOT",
      type: "run",
      prompt: "NOT A=0b1010 → Y=0b0101.",
      hint: "Unary ~A.",
      setup: { w: 4, op: "NOT", a: 10, b: 0 },
      check: (r, s) => s.op === "NOT" && r.y === 5,
    },
    {
      id: "shl-op",
      title: "SHL",
      type: "run",
      prompt: "SHL A=0b0101 → Y=0b1010; C gets old MSB=0.",
      hint: "Shift left one.",
      setup: { w: 4, op: "SHL", a: 5, b: 0 },
      check: (r, s) => s.op === "SHL" && r.y === 10 && r.c === 0,
    },
    {
      id: "shr-op",
      title: "SHR",
      type: "run",
      prompt: "SHR A=0b1010 → Y=0b0101; C=0 (old LSB).",
      hint: "Logical right.",
      setup: { w: 4, op: "SHR", a: 10, b: 0 },
      check: (r, s) => s.op === "SHR" && r.y === 5 && r.c === 0,
    },
    {
      id: "slt-u",
      title: "SLT unsigned",
      type: "run",
      prompt: "SLT A=2, B=10 → Y=1 (unsigned).",
      hint: "2 < 10.",
      setup: { w: 4, op: "SLT", a: 2, b: 10 },
      check: (r, s) => s.op === "SLT" && r.y === 1,
    },
    {
      id: "slts",
      title: "SLT signed",
      type: "run",
      prompt: "SLT.S A=15 (−1), B=1 → Y=1.",
      hint: "Signed compare.",
      setup: { w: 4, op: "SLTS", a: 15, b: 1 },
      check: (r, s) => s.op === "SLTS" && r.y === 1,
    },
    {
      id: "slt-disagree",
      title: "SLT vs SLT.S",
      type: "run",
      prompt: "A=15, B=1: SLT (unsigned) → 0; confirm with SLT then note SLT.S would be 1.",
      hint: "Load setup; opcode SLT → Y=0.",
      setup: { w: 4, op: "SLT", a: 15, b: 1 },
      check: (r, s) => s.op === "SLT" && r.y === 0 && bitsToInt(s.aBits) === 15,
    },
    {
      id: "z-flag",
      title: "Zero flag",
      type: "run",
      prompt: "AND A=0b1100, B=0b0011 → Y=0, Z=1.",
      hint: "Disjoint bits.",
      setup: { w: 4, op: "AND", a: 12, b: 3 },
      check: (r, s) => s.op === "AND" && r.y === 0 && r.z === 1,
    },
    {
      id: "n-flag",
      title: "Negative flag",
      type: "run",
      prompt: "PASSA A=0b1000 → N=1.",
      hint: "MSB is sign/N.",
      setup: { w: 4, op: "PASSA", a: 8, b: 0 },
      check: (r, s) => s.op === "PASSA" && r.n === 1 && r.y === 8,
    },
    {
      id: "8bit-add",
      title: "8-bit ADD",
      type: "run",
      prompt: "Width 8: ADD A=200, B=100 → Y=44, C=1.",
      hint: "300 wraps in 8 bits.",
      setup: { w: 8, op: "ADD", a: 200, b: 100 },
      check: (r, s) => s.w === 8 && s.op === "ADD" && r.y === 44 && r.c === 1,
    },
    {
      id: "quiz-z",
      title: "Quiz: Z",
      type: "quiz",
      prompt: "Flag Z is set when…",
      hint: "Look at Y.",
      choices: ["Y is zero", "carry occurred", "overflow occurred", "MSB is 1"],
      answer: "Y is zero",
    },
    {
      id: "quiz-v",
      title: "Quiz: V",
      type: "quiz",
      prompt: "Flag V (overflow) matters for…",
      hint: "Two’s complement add/sub.",
      choices: ["signed add/sub", "bitwise AND only", "shifts only", "PASS ops"],
      answer: "signed add/sub",
    },
    {
      id: "quiz-c-add",
      title: "Quiz: C on ADD",
      type: "quiz",
      prompt: "On ADD, C=1 means…",
      hint: "Unsigned wrap.",
      choices: ["unsigned carry out of MSB", "result is negative", "Y is zero", "borrow"],
      answer: "unsigned carry out of MSB",
    },
    {
      id: "quiz-opcode",
      title: "Quiz: ALU role",
      type: "quiz",
      prompt: "An ALU opcode primarily selects…",
      hint: "Which function.",
      choices: ["which arithmetic/logic function to apply", "the clock frequency", "a memory address only", "reset polarity"],
      answer: "which arithmetic/logic function to apply",
    },
    {
      id: "nand-op",
      title: "NAND",
      type: "run",
      prompt: "NAND A=0b1111, B=0b1111 → Y=0.",
      hint: "All ones NAND → zeros.",
      setup: { w: 4, op: "NAND", a: 15, b: 15 },
      check: (r, s) => s.op === "NAND" && r.y === 0 && r.z === 1,
    },
  ];

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const state = {
    w: 4,
    op: "ADD",
    aBits: intToBits(5, 4),
    bBits: intToBits(3, 4),
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.w = 4;
    state.op = "ADD";
    state.aBits = intToBits(5, 4);
    state.bBits = intToBits(3, 4);
  }

  function ensureWidth() {
    const a = bitsToInt(state.aBits) & mask(state.w);
    const b = bitsToInt(state.bBits) & mask(state.w);
    state.aBits = intToBits(a, state.w);
    state.bBits = intToBits(b, state.w);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          w: state.w,
          op: state.op,
          a: bitsToInt(state.aBits),
          b: bitsToInt(state.bBits),
        })
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
      state.w = d.w === 8 ? 8 : 4;
      if (OPS.some((o) => o.id === d.op)) state.op = d.op;
      state.aBits = intToBits(Number(d.a) || 0, state.w);
      state.bBits = intToBits(Number(d.b) || 0, state.w);
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("alu-root");
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
        <h2>ALU</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="alu-controls">
          <div class="alu-field">
            <label for="width-sel">Width</label>
            <select id="width-sel">
              <option value="4">4-bit</option>
              <option value="8">8-bit</option>
            </select>
          </div>
          <div class="alu-field">
            <label for="a-dec">A (decimal)</label>
            <input id="a-dec" type="number">
          </div>
          <div class="alu-field">
            <label for="b-dec">B (decimal)</label>
            <input id="b-dec" type="number">
          </div>
        </div>
        <div class="op-grid" id="op-grid"></div>
        <p class="alu-meta">A bits</p>
        <div class="bit-row" id="a-bits"></div>
        <p class="alu-meta">B bits</p>
        <div class="bit-row" id="b-bits"></div>
        <div class="alu-stage" id="stage"></div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function addBitRow(el, bits, onToggle) {
    el.innerHTML = "";
    bits.forEach((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bit-btn" + (v ? " on" : "");
      b.textContent = `b${state.w - 1 - i}=${v}`;
      b.addEventListener("click", () => {
        bits[i] = v ? 0 : 1;
        onToggle();
      });
      el.appendChild(b);
    });
  }

  function renderLab() {
    ensureWidth();
    const a = bitsToInt(state.aBits);
    const b = bitsToInt(state.bBits);
    const r = evalAlu(state.op, a, b, state.w);
    const op = OPS.find((o) => o.id === state.op);

    document.getElementById("starter-note").textContent =
      "Starter example: 4-bit ADD, A=5, B=3 → Y=1000₂ (8), flags Z=0 N=1 C=0 V=0.";
    document.getElementById("width-sel").value = String(state.w);
    document.getElementById("a-dec").value = String(a);
    document.getElementById("b-dec").value = String(b);

    const grid = document.getElementById("op-grid");
    grid.innerHTML = "";
    OPS.forEach((o) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = o.label;
      if (o.id === state.op) btn.classList.add("active");
      btn.addEventListener("click", () => {
        state.op = o.id;
        saveSession();
        renderLab();
      });
      grid.appendChild(btn);
    });

    addBitRow(document.getElementById("a-bits"), state.aBits, () => {
      saveSession();
      renderLab();
    });
    addBitRow(document.getElementById("b-bits"), state.bBits, () => {
      saveSession();
      renderLab();
    });

    document.getElementById("stage").innerHTML = `
      <div class="alu-expr">${op.expr} · opcode ${op.label}</div>
      <div class="alu-y">Y = ${r.bits}₂ (${r.y}u / ${r.yS}s)</div>
      <div class="flag-row">
        <span class="flag${r.z ? " on" : ""}">Z=${r.z}</span>
        <span class="flag${r.n ? " on" : ""}">N=${r.n}</span>
        <span class="flag${r.c ? " on" : ""}">C=${r.c}</span>
        <span class="flag${r.v ? " on" : ""}">V=${r.v}</span>
      </div>
      <p class="alu-meta">A=${toBits(a, state.w)}₂ (${r.aU}u / ${r.aS}s) · B=${toBits(b, state.w)}₂ (${r.bU}u / ${r.bS}s)</p>
      <p class="alu-meta">C on ADD = unsigned carry; on SUB = not-borrow (1 if A≥B); on SHL/SHR = shifted-out bit. V = signed overflow on ADD/SUB.</p>
    `;
  }

  function renderChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
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
            `<label><input type="radio" name="alu-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
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

  function loadChallengeSetup() {
    const ch = CHALLENGES[state.challengeIdx];
    if (!ch.setup) {
      setChalStatus("idle", "Quiz — pick an answer");
      return;
    }
    state.w = ch.setup.w;
    state.op = ch.setup.op;
    state.aBits = intToBits(ch.setup.a, state.w);
    state.bBits = intToBits(ch.setup.b, state.w);
    saveSession();
    renderAll();
    setChalStatus("idle", "Setup loaded");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else {
      const a = bitsToInt(state.aBits);
      const b = bitsToInt(state.bBits);
      const r = evalAlu(state.op, a, b, state.w);
      ok = !!ch.check(r, { ...state, aBits: state.aBits, bBits: state.bBits });
    }
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds = [...clearedIds, ch.id];
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("pass", "Pass");
      renderChallenge();
    } else setChalStatus("fail", "Not yet");
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("width-sel").addEventListener("change", (e) => {
    state.w = Number(e.target.value) === 8 ? 8 : 4;
    ensureWidth();
    saveSession();
    renderAll();
  });
  document.getElementById("a-dec").addEventListener("change", (e) => {
    state.aBits = intToBits(Number(e.target.value) || 0, state.w);
    saveSession();
    renderLab();
  });
  document.getElementById("b-dec").addEventListener("change", (e) => {
    state.bBits = intToBits(Number(e.target.value) || 0, state.w);
    saveSession();
    renderLab();
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.quizChoice = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeSetup);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
