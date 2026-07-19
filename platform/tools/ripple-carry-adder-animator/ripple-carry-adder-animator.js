(() => {
  const STORAGE_KEY = "ddv-ripple-carry-adder-animator-v1";
  const CLEARED_KEY = "ddv-ripple-carry-adder-animator-cleared-v1";

  function mask(w) {
    return (1 << w) - 1;
  }

  function toBitsLSB(n, w) {
    const bits = [];
    for (let i = 0; i < w; i++) bits.push((n >> i) & 1);
    return bits; // index 0 = LSB
  }

  function bitsToIntLSB(bits) {
    let n = 0;
    for (let i = 0; i < bits.length; i++) n |= (bits[i] & 1) << i;
    return n >>> 0;
  }

  function fullAdd(a, b, cin) {
    const sum = a ^ b ^ cin;
    const cout = (a & b) | (a & cin) | (b & cin);
    return { sum, cout };
  }

  /** Compute all stages LSB→MSB. carries[i] is Cin to stage i; carries[w] is final Cout. */
  function ripple(aBits, bBits, cin) {
    const w = aBits.length;
    const stages = [];
    let c = cin & 1;
    const carries = [c];
    for (let i = 0; i < w; i++) {
      const fa = fullAdd(aBits[i], bBits[i], c);
      stages.push({ i, a: aBits[i], b: bBits[i], cin: c, sum: fa.sum, cout: fa.cout });
      c = fa.cout;
      carries.push(c);
    }
    const sumBits = stages.map((s) => s.sum);
    const sum = bitsToIntLSB(sumBits);
    const a = bitsToIntLSB(aBits);
    const b = bitsToIntLSB(bBits);
    return { w, stages, carries, sumBits, sum, a, b, cin: cin & 1, cout: c };
  }

  const CHALLENGES = [
    {
      id: "quiz-fa-sum",
      title: "Quiz: FA sum",
      type: "quiz",
      prompt: "A full adder sum bit is…",
      hint: "Three-input XOR.",
      choices: ["A ⊕ B ⊕ Cin", "A & B & Cin", "A | B", "only A ⊕ B"],
      answer: "A ⊕ B ⊕ Cin",
    },
    {
      id: "quiz-fa-cout",
      title: "Quiz: FA Cout",
      type: "quiz",
      prompt: "Full-adder Cout is 1 when…",
      hint: "Majority.",
      choices: [
        "at least two of A, B, Cin are 1",
        "exactly one input is 1",
        "A ⊕ B is 1",
        "always when Cin is 1",
      ],
      answer: "at least two of A, B, Cin are 1",
    },
    {
      id: "quiz-ripple",
      title: "Quiz: ripple",
      type: "quiz",
      prompt: "In a ripple-carry adder, Cin of bit i comes from…",
      hint: "Previous stage.",
      choices: [
        "Cout of bit i−1 (LSB first)",
        "Cout of the MSB",
        "always 0",
        "the clock",
      ],
      answer: "Cout of bit i−1 (LSB first)",
    },
    {
      id: "quiz-delay",
      title: "Quiz: delay",
      type: "quiz",
      prompt: "Worst-case RCA delay grows roughly…",
      hint: "Carry chain length.",
      choices: [
        "linearly with bit width (carry must propagate)",
        "logarithmically always",
        "independent of width",
        "only with the clock period",
      ],
      answer: "linearly with bit width (carry must propagate)",
    },
    {
      id: "quiz-lsb-first",
      title: "Quiz: LSB first",
      type: "quiz",
      prompt: "Why start at the LSB?",
      hint: "Carry dependence.",
      choices: [
        "each higher bit needs the carry from the lower bit",
        "MSB has no inputs",
        "synthesis requires it for one-hot",
        "LSB never produces carry",
      ],
      answer: "each higher bit needs the carry from the lower bit",
    },
    {
      id: "quiz-cin",
      title: "Quiz: Cin",
      type: "quiz",
      prompt: "Cin=1 on an adder is commonly used for…",
      hint: "A + ~B + 1.",
      choices: [
        "two’s-complement subtract (A + ~B + 1)",
        "forcing sum to zero",
        "disabling the MSB",
        "creating a latch",
      ],
      answer: "two’s-complement subtract (A + ~B + 1)",
    },
    {
      id: "quiz-half",
      title: "Quiz: half adder",
      type: "quiz",
      prompt: "A half adder differs from a full adder because it has…",
      hint: "No Cin.",
      choices: ["no Cin (only A,B → S,Cout)", "no sum output", "three Cin pins", "only OR gates"],
      answer: "no Cin (only A,B → S,Cout)",
    },
    {
      id: "quiz-unsigned-ov",
      title: "Quiz: Cout meaning",
      type: "quiz",
      prompt: "Final Cout=1 on an unsigned add means…",
      hint: "Overflow of the width.",
      choices: [
        "the true sum needs an extra bit (wrap in w bits)",
        "the sum is negative",
        "A equals B",
        "no bits flipped",
      ],
      answer: "the true sum needs an extra bit (wrap in w bits)",
    },
    {
      id: "run-5plus3",
      title: "5 + 3",
      type: "run",
      prompt: "4-bit: A=5, B=3, Cin=0. Step until complete — sum 8, Cout 0.",
      hint: "Starter.",
      check: (s, r) =>
        s.w === 4 && r.a === 5 && r.b === 3 && r.cin === 0 && r.sum === 8 && r.cout === 0 && s.step >= s.w,
    },
    {
      id: "run-15plus1",
      title: "15 + 1 wrap",
      type: "run",
      prompt: "4-bit: A=15, B=1, Cin=0 → sum 0, Cout 1 (unsigned wrap).",
      hint: "All ones + 1.",
      check: (s, r) =>
        s.w === 4 && r.a === 15 && r.b === 1 && r.cin === 0 && r.sum === 0 && r.cout === 1 && s.step >= s.w,
    },
    {
      id: "run-7plus9",
      title: "7 + 9",
      type: "run",
      prompt: "4-bit: 7+9 → sum 0, Cout 1 (16).",
      hint: "7+9=16.",
      check: (s, r) =>
        s.w === 4 && r.a === 7 && r.b === 9 && r.cin === 0 && r.sum === 0 && r.cout === 1 && s.step >= s.w,
    },
    {
      id: "run-cin1",
      title: "Cin = 1",
      type: "run",
      prompt: "4-bit: A=5, B=3, Cin=1 → sum 9.",
      hint: "5+3+1.",
      check: (s, r) =>
        s.w === 4 && r.a === 5 && r.b === 3 && r.cin === 1 && r.sum === 9 && s.step >= s.w,
    },
    {
      id: "run-carry-chain",
      title: "Long carry",
      type: "run",
      prompt: "4-bit: A=1, B=15, Cin=0. After full ripple, Cout=1 and sum=0. Bit0 must produce Cout into bit1.",
      hint: "1+15=16.",
      check: (s, r) => {
        if (!(s.w === 4 && r.a === 1 && r.b === 15 && r.cin === 0 && r.sum === 0 && r.cout === 1 && s.step >= 4))
          return false;
        return r.stages[0].cout === 1;
      },
    },
    {
      id: "run-step2",
      title: "Step to bit1",
      type: "run",
      prompt: "4-bit starter values (5+3). Advance step until bit1 is revealed (step ≥ 2) but not past complete if you want — any step≥2 with A=5,B=3 OK.",
      hint: "Step carry once or twice.",
      check: (s, r) => s.w === 4 && r.a === 5 && r.b === 3 && s.step >= 2,
    },
    {
      id: "run-8bit",
      title: "8-bit 100+50",
      type: "run",
      prompt: "8-bit: A=100, B=50, Cin=0 → sum 150, Cout 0.",
      hint: "Switch width to 8.",
      check: (s, r) =>
        s.w === 8 && r.a === 100 && r.b === 50 && r.cin === 0 && r.sum === 150 && r.cout === 0 && s.step >= s.w,
    },
    {
      id: "run-8-overflow",
      title: "8-bit overflow",
      type: "run",
      prompt: "8-bit: A=200, B=100 → sum 44 (mod 256), Cout 1.",
      hint: "200+100=300.",
      check: (s, r) =>
        s.w === 8 && r.a === 200 && r.b === 100 && r.cin === 0 && r.sum === 44 && r.cout === 1 && s.step >= s.w,
    },
    {
      id: "run-zero",
      title: "0 + 0",
      type: "run",
      prompt: "Any width: A=B=Cin=0 → sum 0, Cout 0 after complete.",
      hint: "Clear inputs.",
      check: (s, r) => r.a === 0 && r.b === 0 && r.cin === 0 && r.sum === 0 && r.cout === 0 && s.step >= s.w,
    },
    {
      id: "run-bit0-sum",
      title: "Bit0 sum of 5+3",
      type: "run",
      prompt: "4-bit 5+3: after at least one step, stage0 sum bit must be 0 (1⊕1⊕0).",
      hint: "LSB of 5 and 3 are both 1.",
      check: (s, r) =>
        s.w === 4 && r.a === 5 && r.b === 3 && r.cin === 0 && s.step >= 1 && r.stages[0].sum === 0 && r.stages[0].cout === 1,
    },
    {
      id: "quiz-generate",
      title: "Quiz: generate",
      type: "quiz",
      prompt: "Carry generate G for bit i is often defined as…",
      hint: "Forces Cout.",
      choices: ["Aᵢ · Bᵢ", "Aᵢ ⊕ Bᵢ", "Aᵢ + Bᵢ", "Cin alone"],
      answer: "Aᵢ · Bᵢ",
    },
    {
      id: "quiz-propagate",
      title: "Quiz: propagate",
      type: "quiz",
      prompt: "Carry propagate P is often…",
      hint: "Pass Cin through.",
      choices: ["Aᵢ ⊕ Bᵢ", "Aᵢ · Bᵢ", "Aᵢ ∧ ¬Bᵢ", "always 0"],
      answer: "Aᵢ ⊕ Bᵢ",
    },
    {
      id: "quiz-vs-cla",
      title: "Quiz: vs CLA",
      type: "quiz",
      prompt: "Compared with a carry-lookahead adder, an RCA is…",
      hint: "Simple vs fast.",
      choices: [
        "simpler hardware, usually slower for wide adds",
        "always faster for 64-bit",
        "unable to add Cin",
        "only for floating point",
      ],
      answer: "simpler hardware, usually slower for wide adds",
    },
    {
      id: "run-show-all",
      title: "Reveal all",
      type: "run",
      prompt: "Any interesting add: use “Show all” or step until step equals width (all stages revealed).",
      hint: "Show all button.",
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
    cin: 0,
    step: 0, // number of stages revealed (0 = none, w = all)
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function result() {
    return ripple(toBitsLSB(state.a, state.w), toBitsLSB(state.b, state.w), state.cin);
  }

  function clampOperands() {
    state.a &= mask(state.w);
    state.b &= mask(state.w);
    state.cin &= 1;
    if (state.step > state.w) state.step = state.w;
  }

  function loadStarter() {
    state.w = 4;
    state.a = 5;
    state.b = 3;
    state.cin = 0;
    state.step = 0;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ w: state.w, a: state.a, b: state.b, cin: state.cin, step: state.step })
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
      state.cin = d.cin ? 1 : 0;
      state.step = Math.min(state.w, Math.max(0, Number(d.step) || 0));
      clampOperands();
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("rca-root");
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
        <h2>Ripple animator</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="rca-controls">
          <div class="rca-field">
            <label for="w-sel">Width</label>
            <select id="w-sel">
              <option value="4">4-bit</option>
              <option value="8">8-bit</option>
            </select>
          </div>
          <div class="rca-field">
            <label for="a-dec">A (decimal)</label>
            <input id="a-dec" type="number" min="0" step="1">
          </div>
          <div class="rca-field">
            <label for="b-dec">B (decimal)</label>
            <input id="b-dec" type="number" min="0" step="1">
          </div>
          <div class="rca-field">
            <label for="cin-sel">Cin</label>
            <select id="cin-sel">
              <option value="0">0</option>
              <option value="1">1</option>
            </select>
          </div>
        </div>
        <p class="eq-note" id="bit-labs"></p>
        <div id="a-bits" class="bit-row"></div>
        <div id="b-bits" class="bit-row"></div>
        <div class="step-bar">
          <button type="button" class="btn btn-secondary" id="btn-step">Step carry →</button>
          <button type="button" class="btn btn-ghost" id="btn-back">Step back</button>
          <button type="button" class="btn btn-ghost" id="btn-all">Show all</button>
          <button type="button" class="btn btn-ghost" id="btn-reset-step">Reset steps</button>
          <span class="step-label" id="step-label"></span>
        </div>
        <div class="fa-chain" id="fa-chain"></div>
        <div class="result-strip" id="result-strip"></div>
        <p class="delay-note" id="delay-note"></p>
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
      "Starter example: 4-bit 5 + 3. Press “Step carry →” to ripple from bit0; Cout of each FA feeds the next.";

    document.getElementById("w-sel").value = String(state.w);
    document.getElementById("a-dec").value = String(state.a);
    document.getElementById("b-dec").value = String(state.b);
    document.getElementById("cin-sel").value = String(state.cin);
    document.getElementById("a-dec").max = mask(state.w);
    document.getElementById("b-dec").max = mask(state.w);

    document.getElementById("bit-labs").textContent = `A=${state.a}, B=${state.b}, Cin=${state.cin} (toggle bits MSB…LSB)`;
    addBitRow(document.getElementById("a-bits"), state.a, "A");
    addBitRow(document.getElementById("b-bits"), state.b, "B");

    document.getElementById("step-label").textContent =
      state.step === 0
        ? "Steps: 0 (idle — no stage revealed)"
        : state.step >= state.w
          ? `Steps: ${state.step} / ${state.w} (complete)`
          : `Steps: ${state.step} / ${state.w} (through bit${state.step - 1})`;

    const chain = document.getElementById("fa-chain");
    chain.innerHTML = "";
    // row-reverse: visual MSB on the left, LSB on the right (usual adder drawing)
    for (let i = state.w - 1; i >= 0; i--) {
      if (i < state.w - 1) {
        const arrow = document.createElement("div");
        arrow.className = "ripple-arrow" + (state.step > i + 1 ? " revealed" : "");
        arrow.textContent = "←C";
        arrow.title = "Carry ripples toward higher bits";
        chain.appendChild(arrow);
      }
      const st = r.stages[i];
      const div = document.createElement("div");
      const revealed = state.step > i;
      const active = state.step === i + 1;
      div.className = "fa-stage" + (revealed ? " revealed" : "") + (active ? " active" : "");
      div.innerHTML = `
        <h3>FA${i}</h3>
        <div class="carry-in">Cin=${revealed ? st.cin : "?"}</div>
        <div class="row"><span>A${i}</span><span>${st.a}</span></div>
        <div class="row"><span>B${i}</span><span>${st.b}</span></div>
        <div class="sum">S${i}=${revealed ? st.sum : "?"}</div>
        <div class="cout ${revealed && st.cout ? "on" : ""}">Cout=${revealed ? st.cout : "?"}</div>
      `;
      chain.appendChild(div);
    }

    const done = state.step >= state.w;
    const sumStr = done
      ? r.sumBits
          .slice()
          .reverse()
          .join("")
      : r.sumBits
          .map((b, i) => (state.step > i ? b : "?"))
          .reverse()
          .join("");
    document.getElementById("result-strip").innerHTML = `
      <span class="big">Sum = ${done ? r.sum : "…"} <span style="color:var(--muted);font-weight:500">${sumStr}</span></span>
      <span>Cout = ${done ? r.cout : "…"}</span>
      <span>A+B+Cin = ${r.a + r.b + r.cin} (unlimited)</span>
    `;
    document.getElementById("delay-note").innerHTML = `
      Critical path ≈ <strong>${state.w}</strong> full-adder carry delays (LSB→MSB).
      Wide adders often use carry-lookahead / prefix trees instead of pure ripple.
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
            `<label><input type="radio" name="rca-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    if (ch.id === "run-5plus3" || ch.id === "run-step2" || ch.id === "run-bit0-sum") {
      state.w = 4;
      state.a = 5;
      state.b = 3;
      state.cin = 0;
    } else if (ch.id === "run-cin1") {
      state.w = 4;
      state.a = 5;
      state.b = 3;
      state.cin = 0;
    } else if (ch.id === "run-15plus1") {
      state.w = 4;
      state.a = 15;
      state.b = 1;
      state.cin = 0;
    } else if (ch.id === "run-7plus9") {
      state.w = 4;
      state.a = 7;
      state.b = 9;
      state.cin = 0;
    } else if (ch.id === "run-carry-chain") {
      state.w = 4;
      state.a = 1;
      state.b = 15;
      state.cin = 0;
    } else if (ch.id === "run-8bit") {
      state.w = 8;
      state.a = 100;
      state.b = 50;
      state.cin = 0;
    } else if (ch.id === "run-8-overflow") {
      state.w = 8;
      state.a = 200;
      state.b = 100;
      state.cin = 0;
    } else if (ch.id === "run-zero") {
      state.w = 4;
      state.a = 0;
      state.b = 0;
      state.cin = 0;
    } else if (ch.id === "run-show-all") {
      /* keep current operands */
    }
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
  document.getElementById("cin-sel").addEventListener("change", (e) => {
    state.cin = Number(e.target.value) ? 1 : 0;
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
