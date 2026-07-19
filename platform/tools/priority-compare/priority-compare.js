(() => {
  const STORAGE_KEY = "ddv-priority-compare-v1";
  const CLEARED_KEY = "ddv-priority-compare-cleared-v1";

  function bitsToInt(bits) {
    return bits.reduce((acc, b) => (acc << 1) | (b ? 1 : 0), 0);
  }

  function intToBits(n, w) {
    const out = [];
    for (let i = w - 1; i >= 0; i--) out.push((n >> i) & 1);
    return out;
  }

  function toSigned(u, w) {
    const sign = 1 << (w - 1);
    return u & sign ? u - (1 << w) : u;
  }

  function mask(w) {
    return (1 << w) - 1;
  }

  function encodePriority(ins, { highFirst, ei }) {
    if (!ei) return { y: 0, v: 0, eo: 0, winner: -1, yBits: intToBits(0, Math.ceil(Math.log2(ins.length || 1))) };
    const outBits = Math.ceil(Math.log2(ins.length));
    let winner = -1;
    if (highFirst) {
      for (let i = ins.length - 1; i >= 0; i--) {
        if (ins[i]) {
          winner = i;
          break;
        }
      }
    } else {
      for (let i = 0; i < ins.length; i++) {
        if (ins[i]) {
          winner = i;
          break;
        }
      }
    }
    const v = winner >= 0 ? 1 : 0;
    const y = v ? winner : 0;
    const eo = ei && !v ? 1 : 0; // cascade: pass enable when no local request
    return { y, v, eo, winner, yBits: intToBits(y, outBits) };
  }

  function compare(aBits, bBits, width) {
    const aU = bitsToInt(aBits) & mask(width);
    const bU = bitsToInt(bBits) & mask(width);
    const aS = toSigned(aU, width);
    const bS = toSigned(bU, width);
    return {
      aU,
      bU,
      aS,
      bS,
      unsigned: {
        eq: aU === bU ? 1 : 0,
        gt: aU > bU ? 1 : 0,
        lt: aU < bU ? 1 : 0,
      },
      signed: {
        eq: aS === bS ? 1 : 0,
        gt: aS > bS ? 1 : 0,
        lt: aS < bS ? 1 : 0,
      },
    };
  }

  function flagsDisagree(cmp) {
    return (
      cmp.unsigned.gt !== cmp.signed.gt ||
      cmp.unsigned.lt !== cmp.signed.lt
    );
  }

  const CHALLENGES = [
    {
      id: "pe-high-i2",
      title: "High-pri: I2 wins",
      kind: "encoder",
      prompt: "4-input, high-index-first: set I2=1 and I0=1; winner must be 2.",
      hint: "Priority = high · EI=1.",
      check: (s, pe) =>
        s.kind === "encoder" &&
        s.encN === 4 &&
        s.highFirst &&
        s.ei &&
        s.ins[2] === 1 &&
        s.ins[0] === 1 &&
        pe.winner === 2,
    },
    {
      id: "pe-low-i0",
      title: "Low-pri: I0 wins",
      kind: "encoder",
      prompt: "Same bits I2=I0=1 but low-index-first → winner 0.",
      hint: "Switch priority to low-index-first.",
      check: (s, pe) =>
        s.kind === "encoder" &&
        s.encN === 4 &&
        !s.highFirst &&
        s.ei &&
        s.ins[2] === 1 &&
        s.ins[0] === 1 &&
        pe.winner === 0,
    },
    {
      id: "pe-none",
      title: "No request",
      kind: "encoder",
      prompt: "All inputs 0, EI=1 → V=0 and EO=1 (cascade).",
      hint: "Clear every I; leave EI on.",
      check: (s, pe) => s.kind === "encoder" && s.ei && s.ins.every((x) => !x) && pe.v === 0 && pe.eo === 1,
    },
    {
      id: "pe-ei-off",
      title: "EI disabled",
      kind: "encoder",
      prompt: "With any I high but EI=0 → V=0 (block ignored).",
      hint: "Turn EI off.",
      check: (s, pe) => s.kind === "encoder" && !s.ei && s.ins.some((x) => x) && pe.v === 0,
    },
    {
      id: "pe-i3",
      title: "Encode I3",
      kind: "encoder",
      prompt: "Only I3=1, high-first → Y=3, V=1.",
      hint: "Clear others; high priority.",
      check: (s, pe) =>
        s.kind === "encoder" &&
        s.encN === 4 &&
        s.highFirst &&
        s.ei &&
        s.ins[3] === 1 &&
        s.ins.slice(0, 3).every((x) => !x) &&
        pe.y === 3 &&
        pe.v === 1,
    },
    {
      id: "pe8-i6",
      title: "8-in: I6 wins",
      kind: "encoder",
      prompt: "8-input high-first: I1 and I6 on → winner 6.",
      hint: "Width 8; highest index among 1s.",
      check: (s, pe) =>
        s.kind === "encoder" &&
        s.encN === 8 &&
        s.highFirst &&
        s.ei &&
        s.ins[1] === 1 &&
        s.ins[6] === 1 &&
        pe.winner === 6,
    },
    {
      id: "pe8-low",
      title: "8-in low priority",
      kind: "encoder",
      prompt: "8-input low-first: I1 and I6 on → winner 1.",
      hint: "Low-index-first.",
      check: (s, pe) =>
        s.kind === "encoder" &&
        s.encN === 8 &&
        !s.highFirst &&
        s.ei &&
        s.ins[1] === 1 &&
        s.ins[6] === 1 &&
        pe.winner === 1,
    },
    {
      id: "quiz-eo",
      title: "Quiz: EO meaning",
      kind: "quiz",
      prompt: "Enable-out (EO) is typically asserted when…",
      hint: "Cascade to the next encoder.",
      choices: [
        "EI is high and no local request is active",
        "any input is high",
        "Y equals zero",
        "priority is low-index-first",
      ],
      answer: "EI is high and no local request is active",
    },
    {
      id: "quiz-priority",
      title: "Quiz: priority",
      kind: "quiz",
      prompt: "High-index-first with I1=I3=1 encodes…",
      hint: "Higher index wins.",
      choices: ["1", "3", "0", "2"],
      answer: "3",
    },
    {
      id: "cmp-eq",
      title: "Compare equal",
      kind: "compare",
      prompt: "4-bit: set A=B=5 so EQ=1 (unsigned and signed).",
      hint: "A and B both 0101.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        s.cmpW === 4 &&
        bitsToInt(s.a) === 5 &&
        bitsToInt(s.b) === 5 &&
        cmp.unsigned.eq === 1,
    },
    {
      id: "cmp-ugt",
      title: "Unsigned A>B",
      kind: "compare",
      prompt: "4-bit unsigned: A=9, B=3 → GT=1, LT=0.",
      hint: "A=1001, B=0011.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        s.cmpW === 4 &&
        bitsToInt(s.a) === 9 &&
        bitsToInt(s.b) === 3 &&
        cmp.unsigned.gt === 1 &&
        cmp.unsigned.lt === 0,
    },
    {
      id: "cmp-ult",
      title: "Unsigned A<B",
      kind: "compare",
      prompt: "4-bit: A=2, B=10 → unsigned LT=1.",
      hint: "A=0010, B=1010.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        bitsToInt(s.a) === 2 &&
        bitsToInt(s.b) === 10 &&
        cmp.unsigned.lt === 1,
    },
    {
      id: "cmp-signed-neg",
      title: "Signed −1 vs 1",
      kind: "compare",
      prompt: "4-bit: A=1111 (−1), B=0001 (1). Signed: A<B; unsigned: A>B.",
      hint: "Classic disagree case.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        s.cmpW === 4 &&
        bitsToInt(s.a) === 15 &&
        bitsToInt(s.b) === 1 &&
        cmp.signed.lt === 1 &&
        cmp.unsigned.gt === 1,
    },
    {
      id: "cmp-disagree",
      title: "Flags disagree",
      kind: "compare",
      prompt: "Any 4-bit A,B where unsigned GT ≠ signed GT (panels highlight).",
      hint: "Try A=MSB set, B small positive.",
      check: (s, _pe, cmp) => s.kind === "compare" && flagsDisagree(cmp),
    },
    {
      id: "cmp-signed-gt",
      title: "Signed A>B",
      kind: "compare",
      prompt: "4-bit: A=3, B=−2 (1110). Signed GT=1.",
      hint: "B=1110 is −2.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        bitsToInt(s.a) === 3 &&
        bitsToInt(s.b) === 14 &&
        cmp.signed.gt === 1 &&
        cmp.signed.lt === 0,
    },
    {
      id: "cmp8-ff",
      title: "8-bit 0xFF vs 0x01",
      kind: "compare",
      prompt: "Width 8: A=0xFF, B=0x01 — unsigned A>B, signed A<B.",
      hint: "A all ones; B=1.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        s.cmpW === 8 &&
        bitsToInt(s.a) === 0xff &&
        bitsToInt(s.b) === 1 &&
        cmp.unsigned.gt === 1 &&
        cmp.signed.lt === 1,
    },
    {
      id: "cmp8-eq",
      title: "8-bit equal",
      kind: "compare",
      prompt: "Width 8: A=B=0x2A → EQ=1.",
      hint: "Both 0010_1010.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        s.cmpW === 8 &&
        bitsToInt(s.a) === 0x2a &&
        bitsToInt(s.b) === 0x2a &&
        cmp.unsigned.eq === 1,
    },
    {
      id: "quiz-signed",
      title: "Quiz: signed MSB",
      kind: "quiz",
      prompt: "In 4-bit two’s complement, bit pattern 1000 is…",
      hint: "Most negative 4-bit value.",
      choices: ["−8", "8", "−1", "0"],
      answer: "−8",
    },
    {
      id: "quiz-unsigned",
      title: "Quiz: unsigned 1000",
      kind: "quiz",
      prompt: "Same pattern 1000 as unsigned 4-bit is…",
      hint: "No sign bit meaning.",
      choices: ["8", "−8", "−1", "0"],
      answer: "8",
    },
    {
      id: "quiz-when-disagree",
      title: "Quiz: when flags differ",
      kind: "quiz",
      prompt: "Unsigned vs signed GT/LT most often disagree when…",
      hint: "MSB interpretation.",
      choices: [
        "the MSB differs and values straddle the sign boundary",
        "A equals B",
        "width is 1",
        "priority is high-first",
      ],
      answer: "the MSB differs and values straddle the sign boundary",
    },
    {
      id: "pe-cascade-story",
      title: "Quiz: cascade use",
      kind: "quiz",
      prompt: "Cascaded priority encoders use EO→EI to…",
      hint: "Widen the request vector.",
      choices: [
        "expand to more request lines across chips",
        "convert unsigned to signed",
        "generate a clock",
        "replace the comparator",
      ],
      answer: "expand to more request lines across chips",
    },
    {
      id: "cmp-zero",
      title: "Both zero",
      kind: "compare",
      prompt: "4-bit A=B=0 → EQ=1, GT=LT=0.",
      hint: "Clear all A/B bits.",
      check: (s, _pe, cmp) =>
        s.kind === "compare" &&
        bitsToInt(s.a) === 0 &&
        bitsToInt(s.b) === 0 &&
        cmp.unsigned.eq === 1 &&
        cmp.unsigned.gt === 0 &&
        cmp.unsigned.lt === 0,
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
    kind: "encoder", // encoder | compare
    encN: 4,
    highFirst: true,
    ei: 1,
    ins: [1, 0, 1, 0],
    cmpW: 4,
    a: [0, 1, 0, 1],
    b: [0, 0, 1, 1],
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.kind = "encoder";
    state.encN = 4;
    state.highFirst = true;
    state.ei = 1;
    state.ins = [1, 0, 1, 0]; // I0 and I2 → high-first winner 2
  }

  function ensureSizes() {
    if (state.ins.length !== state.encN) {
      const next = Array(state.encN).fill(0);
      for (let i = 0; i < Math.min(state.ins.length, next.length); i++) next[i] = state.ins[i] ? 1 : 0;
      state.ins = next;
    }
    if (state.a.length !== state.cmpW) {
      state.a = intToBits(bitsToInt(state.a) & mask(state.cmpW), state.cmpW);
      state.b = intToBits(bitsToInt(state.b) & mask(state.cmpW), state.cmpW);
    }
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          kind: state.kind,
          encN: state.encN,
          highFirst: state.highFirst,
          ei: state.ei,
          ins: state.ins,
          cmpW: state.cmpW,
          a: state.a,
          b: state.b,
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
      if (d.kind !== "encoder" && d.kind !== "compare") return false;
      Object.assign(state, {
        kind: d.kind,
        encN: d.encN === 8 ? 8 : 4,
        highFirst: !!d.highFirst,
        ei: d.ei ? 1 : 0,
        ins: Array.isArray(d.ins) ? d.ins.map((x) => (x ? 1 : 0)) : state.ins,
        cmpW: d.cmpW === 8 ? 8 : 4,
        a: Array.isArray(d.a) ? d.a.map((x) => (x ? 1 : 0)) : state.a,
        b: Array.isArray(d.b) ? d.b.map((x) => (x ? 1 : 0)) : state.b,
      });
      ensureSizes();
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("pc-root");
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
    <div class="tool-layout pc-split">
      <div class="panel">
        <div class="panel-head">
          <h2>Lab</h2>
          <div class="tool-actions">
            <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="pc-controls">
            <div class="pc-field">
              <label for="kind-sel">Block</label>
              <select id="kind-sel">
                <option value="encoder">Priority encoder</option>
                <option value="compare">Comparator</option>
              </select>
            </div>
            <div class="pc-field" id="enc-n-field">
              <label for="enc-n">Inputs</label>
              <select id="enc-n">
                <option value="4">4 → 2</option>
                <option value="8">8 → 3</option>
              </select>
            </div>
            <div class="pc-field" id="pri-field">
              <label for="pri-sel">Priority</label>
              <select id="pri-sel">
                <option value="high">High-index first</option>
                <option value="low">Low-index first</option>
              </select>
            </div>
            <div class="pc-field" id="cmp-w-field" hidden>
              <label for="cmp-w">Width</label>
              <select id="cmp-w">
                <option value="4">4-bit</option>
                <option value="8">8-bit</option>
              </select>
            </div>
          </div>
          <div id="bit-controls" class="bit-row"></div>
          <div class="block-card" id="viz"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Notes</h2></div>
        <div class="panel-body">
          <pre class="formula" id="formula"></pre>
          <p class="pc-meta" id="meta"></p>
        </div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function addToggle(box, label, get, set) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bit-btn" + (get() ? " on" : "");
    b.textContent = `${label}=${get() ? 1 : 0}`;
    b.addEventListener("click", () => {
      set(get() ? 0 : 1);
      saveSession();
      renderLab();
    });
    box.appendChild(b);
  }

  function renderBits() {
    ensureSizes();
    const box = document.getElementById("bit-controls");
    box.innerHTML = "";
    if (state.kind === "encoder") {
      addToggle(box, "EI", () => state.ei, (v) => (state.ei = v));
      state.ins.forEach((_, i) => addToggle(box, `I${i}`, () => state.ins[i], (v) => (state.ins[i] = v)));
    } else {
      state.a.forEach((_, i) =>
        addToggle(box, `A${state.cmpW - 1 - i}`, () => state.a[i], (v) => (state.a[i] = v))
      );
      state.b.forEach((_, i) =>
        addToggle(box, `B${state.cmpW - 1 - i}`, () => state.b[i], (v) => (state.b[i] = v))
      );
    }
  }

  function renderLab() {
    ensureSizes();
    document.getElementById("kind-sel").value = state.kind;
    document.getElementById("enc-n").value = String(state.encN);
    document.getElementById("pri-sel").value = state.highFirst ? "high" : "low";
    document.getElementById("cmp-w").value = String(state.cmpW);
    document.getElementById("enc-n-field").hidden = state.kind !== "encoder";
    document.getElementById("pri-field").hidden = state.kind !== "encoder";
    document.getElementById("cmp-w-field").hidden = state.kind !== "compare";
    document.getElementById("starter-note").textContent =
      "Starter example: 4-input priority encoder, high-index-first, I0=I2=1 → winner I2 (Y=2).";

    renderBits();
    const viz = document.getElementById("viz");

    if (state.kind === "encoder") {
      const pe = encodePriority(state.ins, { highFirst: state.highFirst, ei: !!state.ei });
      const outBits = Math.ceil(Math.log2(state.encN));
      viz.innerHTML = `
        <h3 class="block-title">Priority encoder (${state.encN}→${outBits})</h3>
        <div class="chip-grid">
          ${state.ins
            .map(
              (v, i) =>
                `<div class="chip${v ? " active" : ""}${pe.winner === i ? " winner" : ""}">I${i}<strong>${v}</strong></div>`
            )
            .join("")}
        </div>
        <div class="flag-row">
          <span class="flag${state.ei ? " on" : ""}">EI=${state.ei ? 1 : 0}</span>
          <span class="flag${pe.v ? " on" : ""}">V=${pe.v}</span>
          <span class="flag${pe.eo ? " on" : ""}">EO=${pe.eo}</span>
          ${pe.yBits
            .map((b, i) => `<span class="flag on">Y${outBits - 1 - i}=${b}</span>`)
            .join("")}
        </div>`;
      document.getElementById("formula").textContent = state.highFirst
        ? "Y = max { i | Ii=1 } when EI=1; else idle. EO = EI ∧ ¬V"
        : "Y = min { i | Ii=1 } when EI=1; else idle. EO = EI ∧ ¬V";
      document.getElementById("meta").textContent = pe.v
        ? `Winner I${pe.winner} → Y=${pe.yBits.join("")}₂ (${pe.y})`
        : state.ei
          ? "No request — EO asserts for the next cascaded encoder"
          : "EI low — encoder disabled (V=0, EO=0)";
      return;
    }

    const cmp = compare(state.a, state.b, state.cmpW);
    const disagree = flagsDisagree(cmp);
    const flagHtml = (side) => `
      <div class="flag-row">
        <span class="flag${side.eq ? " on" : ""}">EQ=${side.eq}</span>
        <span class="flag${side.gt ? " on" : ""}">A>B=${side.gt}</span>
        <span class="flag${side.lt ? " on" : ""}">A<B=${side.lt}</span>
      </div>`;
    viz.innerHTML = `
      <h3 class="block-title">Comparator (${state.cmpW}-bit)</h3>
      <p class="pc-meta">A=${state.a.join("")}₂ (${cmp.aU}u / ${cmp.aS}s) · B=${state.b.join("")}₂ (${cmp.bU}u / ${cmp.bS}s)</p>
      <div class="compare-split">
        <div class="compare-pane${disagree ? " disagree" : ""}">
          <h3>Unsigned</h3>
          ${flagHtml(cmp.unsigned)}
        </div>
        <div class="compare-pane${disagree ? " disagree" : ""}">
          <h3>Signed (two’s complement)</h3>
          ${flagHtml(cmp.signed)}
        </div>
      </div>
      ${disagree ? `<p class="pc-meta">Unsigned and signed relational flags disagree — MSB treated as sign.</p>` : ""}`;
    document.getElementById("formula").textContent =
      "EQ: A==B · GT/LT: magnitude (unsigned) vs two’s-complement (signed)";
    document.getElementById("meta").textContent = disagree
      ? "Teaching case: same bit patterns, different ordered comparisons"
      : "Unsigned and signed relational results match for this pair";
  }

  function currentEval() {
    ensureSizes();
    const pe = encodePriority(state.ins, { highFirst: state.highFirst, ei: !!state.ei });
    const cmp = compare(state.a, state.b, state.cmpW);
    return { pe, cmp };
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
    if (ch.kind === "quiz") {
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="pc-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    if (ch.kind === "encoder") {
      state.kind = "encoder";
      state.encN = /8-in|8-input|pe8/.test(ch.id) || /8-input/.test(ch.prompt) ? 8 : 4;
      if (ch.id === "pe8-i6" || ch.id === "pe8-low") state.encN = 8;
      state.highFirst = !/low/i.test(ch.id) && !/low-index/i.test(ch.prompt);
      if (ch.id === "pe-low-i0" || ch.id === "pe8-low") state.highFirst = false;
      if (ch.id === "pe-high-i2" || ch.id === "pe-i3" || ch.id === "pe8-i6") state.highFirst = true;
      state.ei = ch.id === "pe-ei-off" ? 0 : 1;
      state.ins = Array(state.encN).fill(0);
      if (ch.id === "pe-none") {
        /* all zero */
      } else if (ch.id === "pe-ei-off") {
        state.ins[1] = 1;
      } else if (ch.id === "pe-i3") {
        state.ins[3] = 1;
      } else if (ch.id === "pe8-i6" || ch.id === "pe8-low") {
        state.ins[1] = 1;
        state.ins[6] = 1;
      } else {
        state.ins[0] = 1;
        state.ins[2] = 1;
      }
    } else if (ch.kind === "compare") {
      state.kind = "compare";
      state.cmpW = /8-bit|cmp8/.test(ch.id) || /Width 8|0xFF/.test(ch.prompt) ? 8 : 4;
      if (ch.id === "cmp8-ff") {
        state.a = intToBits(0xff, 8);
        state.b = intToBits(0x01, 8);
      } else if (ch.id === "cmp8-eq") {
        state.a = intToBits(0x2a, 8);
        state.b = intToBits(0x2a, 8);
      } else if (ch.id === "cmp-eq") {
        state.a = intToBits(5, 4);
        state.b = intToBits(5, 4);
      } else if (ch.id === "cmp-ugt") {
        state.a = intToBits(9, 4);
        state.b = intToBits(3, 4);
      } else if (ch.id === "cmp-ult") {
        state.a = intToBits(2, 4);
        state.b = intToBits(10, 4);
      } else if (ch.id === "cmp-signed-neg" || ch.id === "cmp-disagree") {
        state.a = intToBits(15, 4);
        state.b = intToBits(1, 4);
      } else if (ch.id === "cmp-signed-gt") {
        state.a = intToBits(3, 4);
        state.b = intToBits(14, 4);
      } else if (ch.id === "cmp-zero") {
        state.a = intToBits(0, 4);
        state.b = intToBits(0, 4);
      } else {
        state.a = intToBits(5, 4);
        state.b = intToBits(3, 4);
      }
    }
    saveSession();
    renderAll();
    setChalStatus("idle", "Setup loaded — adjust if needed, then Check");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.kind === "quiz") {
      ok = state.quizChoice === ch.answer;
    } else {
      const { pe, cmp } = currentEval();
      try {
        ok = !!ch.check(state, pe, cmp);
      } catch {
        ok = false;
      }
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

  document.getElementById("kind-sel").addEventListener("change", (e) => {
    state.kind = e.target.value;
    saveSession();
    renderAll();
  });
  document.getElementById("enc-n").addEventListener("change", (e) => {
    state.encN = Number(e.target.value);
    ensureSizes();
    saveSession();
    renderAll();
  });
  document.getElementById("pri-sel").addEventListener("change", (e) => {
    state.highFirst = e.target.value === "high";
    saveSession();
    renderAll();
  });
  document.getElementById("cmp-w").addEventListener("change", (e) => {
    const w = Number(e.target.value);
    const aU = bitsToInt(state.a) & mask(w);
    const bU = bitsToInt(state.b) & mask(w);
    state.cmpW = w;
    state.a = intToBits(aU, w);
    state.b = intToBits(bU, w);
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
