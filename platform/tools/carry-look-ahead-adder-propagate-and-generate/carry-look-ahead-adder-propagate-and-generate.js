(() => {
  const STORAGE_KEY = "ddv-carry-look-ahead-adder-propagate-and-generate-v1";
  const CLEARED_KEY = "ddv-carry-look-ahead-adder-propagate-and-generate-cleared-v1";

  function mask(w) {
    return (1 << w) - 1;
  }

  function toBitsLSB(n, w) {
    const bits = [];
    for (let i = 0; i < w; i++) bits.push((n >> i) & 1);
    return bits;
  }

  function bitsToIntLSB(bits) {
    let n = 0;
    for (let i = 0; i < bits.length; i++) n |= (bits[i] & 1) << i;
    return n >>> 0;
  }

  /**
   * Classic CLA bit equations (XOR propagate):
   *   Gi = Ai · Bi
   *   Pi = Ai ⊕ Bi
   *   Si = Pi ⊕ Ci
   *   C{i+1} = Gi + Pi · Ci
   * Expanded forms shown for teaching (4-bit fully expanded).
   */
  function cla(aBits, bBits, c0) {
    const w = aBits.length;
    const G = [];
    const P = [];
    for (let i = 0; i < w; i++) {
      G.push(aBits[i] & bBits[i]);
      P.push(aBits[i] ^ bBits[i]);
    }
    const C = [c0 & 1];
    const expansions = [];
    for (let i = 0; i < w; i++) {
      // C{i+1} = Gi + Pi*Ci  (recursive)
      const cin = C[i];
      const cout = G[i] | (P[i] & cin);
      C.push(cout);

      // Build expanded symbolic + numeric for display
      expansions.push(expandCarry(i + 1, G, P, c0 & 1));
    }
    const S = [];
    for (let i = 0; i < w; i++) S.push(P[i] ^ C[i]);
    const sum = bitsToIntLSB(S);
    const a = bitsToIntLSB(aBits);
    const b = bitsToIntLSB(bBits);
    return {
      w,
      G,
      P,
      C,
      S,
      expansions,
      sum,
      cout: C[w],
      a,
      b,
      c0: c0 & 1,
    };
  }

  /** Fully expanded C_k in terms of G/P and C0 (for k>=1). */
  function expandCarry(k, G, P, c0) {
    // C_k = G_{k-1} + P_{k-1} G_{k-2} + ... + (P_{k-1}...P_0) C0
    const terms = [];
    for (let j = k - 1; j >= 0; j--) {
      const pPrefix = [];
      for (let t = k - 1; t > j; t--) pPrefix.push(`P${t}`);
      const label = pPrefix.length ? `${pPrefix.join("·")}·G${j}` : `G${j}`;
      let val = G[j];
      for (let t = k - 1; t > j; t--) val &= P[t];
      terms.push({ label, val });
    }
    const pAll = [];
    for (let t = k - 1; t >= 0; t--) pAll.push(`P${t}`);
    const cLabel = `${pAll.join("·")}·C0`;
    let cVal = c0;
    for (let t = k - 1; t >= 0; t--) cVal &= P[t];
    terms.push({ label: cLabel, val: cVal });

    let total = 0;
    terms.forEach((t) => {
      total |= t.val;
    });
    const sym = terms.map((t) => t.label).join(" + ");
    return { k, sym, terms, value: total };
  }

  const CHALLENGES = [
    {
      id: "quiz-g",
      title: "Quiz: generate",
      type: "quiz",
      prompt: "Generate Gᵢ is defined here as…",
      hint: "AND.",
      choices: ["Aᵢ · Bᵢ", "Aᵢ ⊕ Bᵢ", "Aᵢ + Bᵢ", "Cᵢ alone"],
      answer: "Aᵢ · Bᵢ",
    },
    {
      id: "quiz-p",
      title: "Quiz: propagate",
      type: "quiz",
      prompt: "Propagate Pᵢ (XOR form) is…",
      hint: "Sum without Cin.",
      choices: ["Aᵢ ⊕ Bᵢ", "Aᵢ · Bᵢ", "Aᵢ ∧ ¬Bᵢ", "always 1"],
      answer: "Aᵢ ⊕ Bᵢ",
    },
    {
      id: "quiz-recur",
      title: "Quiz: recur carry",
      type: "quiz",
      prompt: "The recursive CLA carry is…",
      hint: "G or P and Cin.",
      choices: ["Cᵢ₊₁ = Gᵢ + Pᵢ·Cᵢ", "Cᵢ₊₁ = Aᵢ ⊕ Bᵢ", "Cᵢ₊₁ = Gᵢ · Pᵢ", "Cᵢ₊₁ = Cᵢ only"],
      answer: "Cᵢ₊₁ = Gᵢ + Pᵢ·Cᵢ",
    },
    {
      id: "quiz-sum",
      title: "Quiz: sum",
      type: "quiz",
      prompt: "With XOR propagate, the sum bit is…",
      hint: "P xor C.",
      choices: ["Sᵢ = Pᵢ ⊕ Cᵢ", "Sᵢ = Gᵢ", "Sᵢ = Pᵢ · Cᵢ", "Sᵢ = Aᵢ + Bᵢ"],
      answer: "Sᵢ = Pᵢ ⊕ Cᵢ",
    },
    {
      id: "quiz-why",
      title: "Quiz: why CLA",
      type: "quiz",
      prompt: "CLA expands carries from G/P so that…",
      hint: "Less serial ripple.",
      choices: [
        "all carries can be computed from G/P/C0 with logic depth growing slower than pure ripple",
        "no adders are needed",
        "FFs store every carry",
        "Cin is ignored",
      ],
      answer: "all carries can be computed from G/P/C0 with logic depth growing slower than pure ripple",
    },
    {
      id: "quiz-g-force",
      title: "Quiz: G=1",
      type: "quiz",
      prompt: "If Gᵢ=1, then Cᵢ₊₁ is…",
      hint: "Generate forces carry out.",
      choices: ["1 regardless of Cᵢ", "0 always", "equal to Pᵢ", "undefined"],
      answer: "1 regardless of Cᵢ",
    },
    {
      id: "quiz-p-pass",
      title: "Quiz: P pass",
      type: "quiz",
      prompt: "If Gᵢ=0 and Pᵢ=1, then Cᵢ₊₁ equals…",
      hint: "Propagate Cin.",
      choices: ["Cᵢ", "0", "1", "Gᵢ"],
      answer: "Cᵢ",
    },
    {
      id: "quiz-kill",
      title: "Quiz: kill",
      type: "quiz",
      prompt: "If Gᵢ=0 and Pᵢ=0, carry is “killed”: Cᵢ₊₁ is…",
      hint: "Neither generate nor propagate.",
      choices: ["0", "1", "Cᵢ", "Aᵢ"],
      answer: "0",
    },
    {
      id: "run-5plus3",
      title: "5 + 3",
      type: "run",
      prompt: "4-bit: A=5, B=3, C0=0. Reveal all carries — sum 8, Cout 0.",
      hint: "Starter.",
      check: (s, r) =>
        s.w === 4 && r.a === 5 && r.b === 3 && r.c0 === 0 && r.sum === 8 && r.cout === 0 && s.step >= s.w,
    },
    {
      id: "run-g0",
      title: "See G0",
      type: "run",
      prompt: "4-bit 5+3: bit0 has A0=B0=1 so G0 must be 1.",
      hint: "LSB both 1.",
      check: (s, r) => s.w === 4 && r.a === 5 && r.b === 3 && r.G[0] === 1,
    },
    {
      id: "run-p1",
      title: "See P1",
      type: "run",
      prompt: "4-bit 5+3: A=0101, B=0011 → P1 = A1⊕B1 = 0⊕1 = 1.",
      hint: "Bit1.",
      check: (s, r) => s.w === 4 && r.a === 5 && r.b === 3 && r.P[1] === 1,
    },
    {
      id: "run-c1",
      title: "C1 from G0",
      type: "run",
      prompt: "4-bit 5+3, C0=0: after ≥1 step, C1 must be 1 (from G0).",
      hint: "Step once.",
      check: (s, r) =>
        s.w === 4 && r.a === 5 && r.b === 3 && r.c0 === 0 && s.step >= 1 && r.C[1] === 1,
    },
    {
      id: "run-15plus1",
      title: "15 + 1",
      type: "run",
      prompt: "4-bit: 15+1 → sum 0, Cout 1. All Gᵢ or propagate chain yields final Cout.",
      hint: "Show all.",
      check: (s, r) =>
        s.w === 4 && r.a === 15 && r.b === 1 && r.c0 === 0 && r.sum === 0 && r.cout === 1 && s.step >= 4,
    },
    {
      id: "run-cin1",
      title: "C0 = 1",
      type: "run",
      prompt: "4-bit: A=5, B=3, C0=1 → sum 9.",
      hint: "Set Cin.",
      check: (s, r) =>
        s.w === 4 && r.a === 5 && r.b === 3 && r.c0 === 1 && r.sum === 9 && s.step >= s.w,
    },
    {
      id: "run-8bit",
      title: "8-bit 100+50",
      type: "run",
      prompt: "8-bit: 100+50 → 150, Cout 0 (reveal all).",
      hint: "Width 8.",
      check: (s, r) =>
        s.w === 8 && r.a === 100 && r.b === 50 && r.c0 === 0 && r.sum === 150 && r.cout === 0 && s.step >= 8,
    },
    {
      id: "run-all-g",
      title: "All generates",
      type: "run",
      prompt: "4-bit A=B=15: every Gᵢ=1 (and Pᵢ=0).",
      hint: "All ones.",
      check: (s, r) =>
        s.w === 4 && r.a === 15 && r.b === 15 && r.G.every((g) => g === 1) && r.P.every((p) => p === 0),
    },
    {
      id: "run-all-p",
      title: "XOR ones",
      type: "run",
      prompt: "4-bit A=15, B=0: every Pᵢ=1 and Gᵢ=0.",
      hint: "A all 1, B 0.",
      check: (s, r) =>
        s.w === 4 && r.a === 15 && r.b === 0 && r.P.every((p) => p === 1) && r.G.every((g) => g === 0),
    },
    {
      id: "run-expand-c2",
      title: "Expand C2",
      type: "run",
      prompt: "4-bit any add: step until C2 is revealed (step≥2). C2 expansion must include G1 and P1·G0 terms.",
      hint: "Step twice on starter.",
      check: (s, r) => {
        if (s.step < 2) return false;
        const e = r.expansions[1];
        return e && e.sym.includes("G1") && e.sym.includes("P1·G0");
      },
    },
    {
      id: "quiz-or-p",
      title: "Quiz: OR propagate",
      type: "quiz",
      prompt: "Some texts define Pᵢ = Aᵢ∨Bᵢ. That form…",
      hint: "Still CLA, different sum wiring.",
      choices: [
        "also works for carry lookahead (sum uses a different expression)",
        "is illegal in hardware",
        "means Gᵢ = Aᵢ⊕Bᵢ",
        "removes the need for Cin",
      ],
      answer: "also works for carry lookahead (sum uses a different expression)",
    },
    {
      id: "quiz-vs-rca",
      title: "Quiz: vs RCA",
      type: "quiz",
      prompt: "Versus a ripple-carry adder, CLA trades…",
      hint: "Area vs delay.",
      choices: [
        "more G/P/lookahead gate area for shorter carry delay",
        "fewer gates and longer delay",
        "no Cin pin",
        "only decimal adds",
      ],
      answer: "more G/P/lookahead gate area for shorter carry delay",
    },
    {
      id: "run-zero",
      title: "0 + 0",
      type: "run",
      prompt: "A=B=C0=0, show all → sum 0, all G=P=0, Cout 0.",
      hint: "Clear.",
      check: (s, r) =>
        r.a === 0 &&
        r.b === 0 &&
        r.c0 === 0 &&
        r.sum === 0 &&
        r.cout === 0 &&
        s.step >= s.w &&
        r.G.every((g) => g === 0),
    },
    {
      id: "run-show-all",
      title: "Reveal all",
      type: "run",
      prompt: "Use Show all (or step) until every carry C1…Cw is revealed.",
      hint: "Show all.",
      check: (s) => s.step >= s.w,
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
    a: 5,
    b: 3,
    c0: 0,
    step: 0, // how many carries C1.. beyond C0 are revealed (0=only C0 known conceptually)
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function result() {
    return cla(toBitsLSB(state.a, state.w), toBitsLSB(state.b, state.w), state.c0);
  }

  function clampOperands() {
    state.a &= mask(state.w);
    state.b &= mask(state.w);
    state.c0 &= 1;
    if (state.step > state.w) state.step = state.w;
  }

  function loadStarter() {
    state.w = 4;
    state.a = 5;
    state.b = 3;
    state.c0 = 0;
    state.step = 0;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ w: state.w, a: state.a, b: state.b, c0: state.c0, step: state.step })
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
      if (d.w !== 4 && d.w !== 8) return false;
      state.w = d.w;
      state.a = Number(d.a) || 0;
      state.b = Number(d.b) || 0;
      state.c0 = d.c0 ? 1 : 0;
      state.step = Math.min(state.w, Math.max(0, Number(d.step) || 0));
      clampOperands();
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("cla-root");
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
        <h2>G / P / carry expand</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="cla-controls">
          <div class="cla-field">
            <label for="w-sel">Width</label>
            <select id="w-sel">
              <option value="4">4-bit</option>
              <option value="8">8-bit</option>
            </select>
          </div>
          <div class="cla-field">
            <label for="a-dec">A (decimal)</label>
            <input id="a-dec" type="number" min="0" step="1">
          </div>
          <div class="cla-field">
            <label for="b-dec">B (decimal)</label>
            <input id="b-dec" type="number" min="0" step="1">
          </div>
          <div class="cla-field">
            <label for="c0-sel">C0 (Cin)</label>
            <select id="c0-sel">
              <option value="0">0</option>
              <option value="1">1</option>
            </select>
          </div>
        </div>
        <p class="cla-meta" id="bit-labs"></p>
        <div id="a-bits" class="bit-row"></div>
        <div id="b-bits" class="bit-row"></div>
        <div class="step-bar">
          <button type="button" class="btn btn-secondary" id="btn-step">Reveal next carry</button>
          <button type="button" class="btn btn-ghost" id="btn-back">Step back</button>
          <button type="button" class="btn btn-ghost" id="btn-all">Show all</button>
          <button type="button" class="btn btn-ghost" id="btn-reset-step">Reset reveals</button>
          <span class="step-label" id="step-label"></span>
        </div>
        <div class="gp-wrap">
          <table class="gp-table" id="gp-table"></table>
        </div>
        <p class="cla-meta" style="color:var(--ink);font-weight:600">Expanded carries (from G, P, C0)</p>
        <ul class="carry-eqs" id="carry-eqs"></ul>
        <div class="result-strip" id="result-strip"></div>
        <p class="tree-note" id="tree-note"></p>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function addBitRow(el, value, which) {
    el.innerHTML = "";
    const bits = toBitsLSB(value, state.w);
    for (let i = state.w - 1; i >= 0; i--) {
      const b = document.createElement("button");
      b.type = "button";
      const v = bits[i];
      b.className = "bit-btn" + (v ? " on" : "");
      b.textContent = `${which}${i}=${v}`;
      b.addEventListener("click", () => {
        const cur = which === "A" ? state.a : state.b;
        const next = cur ^ (1 << i);
        if (which === "A") state.a = next;
        else state.b = next;
        state.step = 0;
        clampOperands();
        saveSession();
        renderAll();
      });
      el.appendChild(b);
    }
  }

  function renderLab() {
    clampOperands();
    const r = result();
    document.getElementById("starter-note").textContent =
      "Starter example: 4-bit 5 + 3. Read G/P per bit, then reveal C1, C2, … from the expanded lookahead equations.";

    document.getElementById("w-sel").value = String(state.w);
    document.getElementById("a-dec").value = String(state.a);
    document.getElementById("b-dec").value = String(state.b);
    document.getElementById("c0-sel").value = String(state.c0);
    document.getElementById("a-dec").max = mask(state.w);
    document.getElementById("b-dec").max = mask(state.w);

    document.getElementById("bit-labs").textContent = `A=${state.a}, B=${state.b}, C0=${state.c0}`;
    addBitRow(document.getElementById("a-bits"), state.a, "A");
    addBitRow(document.getElementById("b-bits"), state.b, "B");

    document.getElementById("step-label").textContent =
      state.step === 0
        ? "Revealed: C0 only"
        : state.step >= state.w
          ? `Revealed: C0…C${state.w} (complete)`
          : `Revealed: C0…C${state.step}`;

    // Table columns: bit w-1 … 0
    const idxs = [];
    for (let i = state.w - 1; i >= 0; i--) idxs.push(i);
    const head = `<tr><th></th>${idxs.map((i) => `<th>${i}</th>`).join("")}</tr>`;
    const row = (lab, cells) =>
      `<tr><td class="lab">${lab}</td>${cells
        .map((c) => `<td class="${c ? "on" : "dim"}">${c}</td>`)
        .join("")}</tr>`;
    const aBits = toBitsLSB(state.a, state.w);
    const bBits = toBitsLSB(state.b, state.w);
    // C0 always known; C_i for i>0 when step >= i. S_i needs C_i.
    const cCells = idxs.map((i) => (i === 0 || state.step >= i ? r.C[i] : "?"));
    const sCells = idxs.map((i) => (i === 0 || state.step >= i ? r.S[i] : "?"));
    document.getElementById("gp-table").innerHTML = `
      <thead>${head}</thead>
      <tbody>
        ${row("A", idxs.map((i) => aBits[i]))}
        ${row("B", idxs.map((i) => bBits[i]))}
        ${row("G = A·B", idxs.map((i) => r.G[i]))}
        ${row("P = A⊕B", idxs.map((i) => r.P[i]))}
        ${(() => {
          const cells = cCells
            .map((c) =>
              c === "?"
                ? `<td class="dim">?</td>`
                : `<td class="${c ? "on" : "dim"}">${c}</td>`
            )
            .join("");
          return `<tr><td class="lab">C (into bit)</td>${cells}</tr>`;
        })()}
        ${(() => {
          const cells = sCells
            .map((c) =>
              c === "?"
                ? `<td class="dim">?</td>`
                : `<td class="${c ? "on" : "dim"}">${c}</td>`
            )
            .join("");
          return `<tr><td class="lab">S = P⊕C</td>${cells}</tr>`;
        })()}
      </tbody>
    `;

    const eqs = document.getElementById("carry-eqs");
    eqs.innerHTML = "";
    const c0li = document.createElement("li");
    c0li.innerHTML = `C0 = Cin <span class="val ${state.c0 ? "one" : ""}">${state.c0}</span>`;
    eqs.appendChild(c0li);

    for (let k = 1; k <= state.w; k++) {
      const exp = r.expansions[k - 1];
      const li = document.createElement("li");
      const revealed = state.step >= k;
      if (revealed) li.classList.add("active");
      const valShow = revealed ? exp.value : "?";
      li.innerHTML = `C${k} = ${exp.sym} <span class="val ${revealed && exp.value ? "one" : ""}">${valShow}</span>`;
      eqs.appendChild(li);
    }

    const done = state.step >= state.w;
    const sumBits = r.S.map((b, i) => (i === 0 || state.step >= i ? b : "?"))
      .reverse()
      .join("");
    document.getElementById("result-strip").innerHTML = `
      <span class="big">Sum = ${done ? r.sum : "…"} <span style="color:var(--muted);font-weight:500">${sumBits}</span></span>
      <span>Cout = C${state.w} = ${done ? r.cout : "…"}</span>
      <span>A+B+C0 = ${r.a + r.b + r.c0}</span>
    `;
    document.getElementById("tree-note").textContent =
      "Wide CLAs group bits into blocks (prefix / Brent–Kung / Kogge–Stone). This lab shows the flat expanded equations for a small width.";
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
            `<label><input type="radio" name="cla-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    if (ch.type !== "run") {
      setChalStatus("idle", "Quiz — pick an answer");
      return;
    }
    state.step = 0;
    const map = {
      "run-5plus3": { w: 4, a: 5, b: 3, c0: 0 },
      "run-g0": { w: 4, a: 5, b: 3, c0: 0 },
      "run-p1": { w: 4, a: 5, b: 3, c0: 0 },
      "run-c1": { w: 4, a: 5, b: 3, c0: 0 },
      "run-15plus1": { w: 4, a: 15, b: 1, c0: 0 },
      "run-cin1": { w: 4, a: 5, b: 3, c0: 0 },
      "run-8bit": { w: 8, a: 100, b: 50, c0: 0 },
      "run-all-g": { w: 4, a: 15, b: 15, c0: 0 },
      "run-all-p": { w: 4, a: 15, b: 0, c0: 0 },
      "run-expand-c2": { w: 4, a: 5, b: 3, c0: 0 },
      "run-zero": { w: 4, a: 0, b: 0, c0: 0 },
    };
    if (map[ch.id]) Object.assign(state, map[ch.id]);
    clampOperands();
    saveSession();
    renderAll();
    setChalStatus("idle", "Setup loaded — finish, then Check");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else ok = !!ch.check(state, result());
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

  document.getElementById("w-sel").addEventListener("change", (e) => {
    state.w = Number(e.target.value);
    state.step = 0;
    clampOperands();
    saveSession();
    renderAll();
  });
  document.getElementById("a-dec").addEventListener("change", (e) => {
    state.a = Number(e.target.value) || 0;
    state.step = 0;
    clampOperands();
    saveSession();
    renderAll();
  });
  document.getElementById("b-dec").addEventListener("change", (e) => {
    state.b = Number(e.target.value) || 0;
    state.step = 0;
    clampOperands();
    saveSession();
    renderAll();
  });
  document.getElementById("c0-sel").addEventListener("change", (e) => {
    state.c0 = Number(e.target.value) ? 1 : 0;
    state.step = 0;
    saveSession();
    renderAll();
  });
  document.getElementById("btn-step").addEventListener("click", () => {
    if (state.step < state.w) state.step++;
    saveSession();
    renderAll();
  });
  document.getElementById("btn-back").addEventListener("click", () => {
    if (state.step > 0) state.step--;
    saveSession();
    renderAll();
  });
  document.getElementById("btn-all").addEventListener("click", () => {
    state.step = state.w;
    saveSession();
    renderAll();
  });
  document.getElementById("btn-reset-step").addEventListener("click", () => {
    state.step = 0;
    saveSession();
    renderAll();
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
