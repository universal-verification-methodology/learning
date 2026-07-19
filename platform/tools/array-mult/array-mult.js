(() => {
  const STORAGE_KEY = "ddv-array-mult-v1";
  const CLEARED_KEY = "ddv-array-mult-cleared-v1";

  function mask(w) {
    return (1 << w) - 1;
  }

  function toBits(n, w) {
    const s = (n & mask(w)).toString(2).padStart(w, "0");
    return s.split("").map((c) => (c === "1" ? 1 : 0));
  }

  function bitsToInt(bits) {
    return parseInt(bits.join(""), 2) >>> 0;
  }

  function intToBits(n, w) {
    return toBits(n, w);
  }

  /**
   * Unsigned array multiply: partials[j][i] = a[i] & b[j], placed at column i+j
   * bits indexed MSB-first in arrays (index 0 = MSB).
   * For math, use LSB index: aLsb[k] = bits[w-1-k]
   */
  function multiply(aBits, bBits) {
    const n = aBits.length;
    const m = bBits.length;
    const aL = aBits.map((_, i) => aBits[n - 1 - i]); // LSB at 0
    const bL = bBits.map((_, i) => bBits[m - 1 - i]);
    const prodW = n + m;
    const columns = Array(prodW).fill(0); // weight 2^k at index k (LSB=0)
    const grid = []; // rows j: for each column weight, PP bit or null

    for (let j = 0; j < m; j++) {
      const row = Array(prodW).fill(null);
      for (let i = 0; i < n; i++) {
        const pp = aL[i] & bL[j];
        const col = i + j;
        row[col] = pp;
        columns[col] += pp;
      }
      grid.push({ j, b: bL[j], row });
    }

    // column sums may need carries for display of "sum bits" — compute true product
    const product = bitsToInt(aBits) * bitsToInt(bBits);
    const prodBits = toBits(product, prodW);

    // Also compute each partial product integer (a * b_j) << j
    const partialInts = bL.map((bj, j) => (bitsToInt(aBits) * bj) << j);

    return { n, m, prodW, grid, columns, product, prodBits, partialInts, aL, bL };
  }

  const CHALLENGES = [
    {
      id: "quiz-pp",
      title: "Quiz: partial product",
      type: "quiz",
      prompt: "Each cell Aᵢ·Bⱼ in an unsigned array multiplier is…",
      hint: "AND.",
      choices: ["an AND of one multiplicand bit and one multiplier bit", "an XOR only", "a flop", "a $clog2"],
      answer: "an AND of one multiplicand bit and one multiplier bit",
    },
    {
      id: "quiz-shift",
      title: "Quiz: row shift",
      type: "quiz",
      prompt: "Row for Bⱼ is shifted left by…",
      hint: "Weight of that multiplier bit.",
      choices: ["j bit positions", "always 0", "WIDTH bits", "j+WIDTH"],
      answer: "j bit positions",
    },
    {
      id: "quiz-width",
      title: "Quiz: product width",
      type: "quiz",
      prompt: "N-bit × N-bit unsigned product needs up to…",
      hint: "2N.",
      choices: ["2N bits", "N bits", "N+1 bits", "4 bits always"],
      answer: "2N bits",
    },
    {
      id: "quiz-zero-row",
      title: "Quiz: Bⱼ=0",
      type: "quiz",
      prompt: "If Bⱼ=0, that partial-product row is…",
      hint: "All ANDs zero.",
      choices: ["all zeros", "all ones", "a copy of A", "undefined"],
      answer: "all zeros",
    },
    {
      id: "quiz-array",
      title: "Quiz: why “array”",
      type: "quiz",
      prompt: "An array multiplier is so named because…",
      hint: "AND array + adders.",
      choices: [
        "it lays out a 2D array of AND/add hardware for every bit pair",
        "it only uses SRAM arrays",
        "it needs no adders",
        "it is only for floating point",
      ],
      answer: "it lays out a 2D array of AND/add hardware for every bit pair",
    },
    {
      id: "run-5x3",
      title: "5 × 3",
      type: "run",
      prompt: "4-bit: set A=5, B=3 → product 15.",
      hint: "Starter values.",
      check: (s, r) => s.w === 4 && bitsToInt(s.aBits) === 5 && bitsToInt(s.bBits) === 3 && r.product === 15,
    },
    {
      id: "run-7x9",
      title: "7 × 9",
      type: "run",
      prompt: "4-bit: A=7, B=9 → 63.",
      hint: "7×9=63.",
      check: (s, r) => s.w === 4 && bitsToInt(s.aBits) === 7 && bitsToInt(s.bBits) === 9 && r.product === 63,
    },
    {
      id: "run-15x15",
      title: "15 × 15",
      type: "run",
      prompt: "4-bit max: A=B=15 → 225.",
      hint: "All ones.",
      check: (s, r) => s.w === 4 && bitsToInt(s.aBits) === 15 && bitsToInt(s.bBits) === 15 && r.product === 225,
    },
    {
      id: "run-0x",
      title: "× 0",
      type: "run",
      prompt: "Any A with B=0 → product 0.",
      hint: "Clear B.",
      check: (s, r) => bitsToInt(s.bBits) === 0 && r.product === 0,
    },
    {
      id: "run-1x",
      title: "× 1",
      type: "run",
      prompt: "A=10, B=1 → product 10.",
      hint: "B=0001.",
      check: (s, r) => bitsToInt(s.aBits) === 10 && bitsToInt(s.bBits) === 1 && r.product === 10,
    },
    {
      id: "run-pp-count",
      title: "PP ones for 5×3",
      type: "run",
      prompt: "With A=5 (0101), B=3 (0011), how many AND cells are 1? Set that state then Check (answer is 4).",
      hint: "Two 1s in B × two 1s in A overlapping.",
      check: (s, r) => {
        if (!(bitsToInt(s.aBits) === 5 && bitsToInt(s.bBits) === 3)) return false;
        let ones = 0;
        r.grid.forEach((g) => g.row.forEach((v) => { if (v === 1) ones++; }));
        return ones === 4;
      },
    },
    {
      id: "run-3bit-5x3",
      title: "3-bit 5×3",
      type: "run",
      prompt: "Width 3: A=5, B=3 → product 15 (fits in 6 bits).",
      hint: "Switch width to 3.",
      check: (s, r) => s.w === 3 && bitsToInt(s.aBits) === 5 && bitsToInt(s.bBits) === 3 && r.product === 15,
    },
    {
      id: "run-3bit-7x7",
      title: "3-bit 7×7",
      type: "run",
      prompt: "Width 3: A=B=7 → 49.",
      hint: "All ones × all ones.",
      check: (s, r) => s.w === 3 && bitsToInt(s.aBits) === 7 && bitsToInt(s.bBits) === 7 && r.product === 49,
    },
    {
      id: "quiz-lsb",
      title: "Quiz: LSB product",
      type: "quiz",
      prompt: "Product bit 0 (LSB) equals…",
      hint: "Only A0 AND B0.",
      choices: ["A₀ · B₀", "A₀ XOR B₀", "Aₙ · Bₙ", "carry only"],
      answer: "A₀ · B₀",
    },
    {
      id: "quiz-unsigned",
      title: "Quiz: signed?",
      type: "quiz",
      prompt: "This explorer models…",
      hint: "No booth.",
      choices: ["unsigned array multiply", "IEEE float multiply", "Booth only", "CORDIC"],
      answer: "unsigned array multiply",
    },
    {
      id: "run-6x6",
      title: "6 × 6",
      type: "run",
      prompt: "4-bit: A=6, B=6 → 36.",
      hint: "0110 × 0110.",
      check: (s, r) => s.w === 4 && bitsToInt(s.aBits) === 6 && bitsToInt(s.bBits) === 6 && r.product === 36,
    },
    {
      id: "run-12x5",
      title: "12 × 5",
      type: "run",
      prompt: "4-bit: A=12, B=5 → 60.",
      hint: "1100 × 0101.",
      check: (s, r) => s.w === 4 && bitsToInt(s.aBits) === 12 && bitsToInt(s.bBits) === 5 && r.product === 60,
    },
    {
      id: "run-partial0",
      title: "Partial row0",
      type: "run",
      prompt: "A=5, B=3: first partial (×B₀) integer should be 5. Set values and Check.",
      hint: "partialInts[0] = A when B0=1.",
      check: (s, r) => bitsToInt(s.aBits) === 5 && bitsToInt(s.bBits) === 3 && r.partialInts[0] === 5,
    },
    {
      id: "run-partial1",
      title: "Partial row1",
      type: "run",
      prompt: "A=5, B=3: second partial (×B₁)<<1 should be 10.",
      hint: "5<<1.",
      check: (s, r) => bitsToInt(s.aBits) === 5 && bitsToInt(s.bBits) === 3 && r.partialInts[1] === 10,
    },
    {
      id: "quiz-adders",
      title: "Quiz: summing",
      type: "quiz",
      prompt: "After forming partial products, hardware must…",
      hint: "Add the rows.",
      choices: ["add the shifted partial-product rows (with carries)", "discard all ANDs", "only OR the rows", "store them in ROM forever"],
      answer: "add the shifted partial-product rows (with carries)",
    },
    {
      id: "quiz-area",
      title: "Quiz: area growth",
      type: "quiz",
      prompt: "Array multiplier AND-array size grows roughly as…",
      hint: "N×N.",
      choices: ["O(N²)", "O(N)", "O(1)", "O(log N) only"],
      answer: "O(N²)",
    },
    {
      id: "run-powers",
      title: "8 × 4",
      type: "run",
      prompt: "4-bit: A=8, B=4 → 32.",
      hint: "1000 × 0100.",
      check: (s, r) => s.w === 4 && bitsToInt(s.aBits) === 8 && bitsToInt(s.bBits) === 4 && r.product === 32,
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
    aBits: intToBits(5, 4),
    bBits: intToBits(3, 4),
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.w = 4;
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
      state.w = d.w === 3 ? 3 : 4;
      state.aBits = intToBits(Number(d.a) || 0, state.w);
      state.bBits = intToBits(Number(d.b) || 0, state.w);
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("am-root");
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
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>Multiplier</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="am-controls">
          <div class="am-field">
            <label for="w-sel">Width</label>
            <select id="w-sel">
              <option value="3">3 × 3 → 6</option>
              <option value="4">4 × 4 → 8</option>
            </select>
          </div>
          <div class="am-field">
            <label for="a-dec">A (unsigned)</label>
            <input id="a-dec" type="number" min="0">
          </div>
          <div class="am-field">
            <label for="b-dec">B (unsigned)</label>
            <input id="b-dec" type="number" min="0">
          </div>
        </div>
        <p class="am-meta">A bits (MSB left)</p>
        <div class="bit-row" id="a-bits"></div>
        <p class="am-meta">B bits (MSB left)</p>
        <div class="bit-row" id="b-bits"></div>
        <div class="pp-wrap" id="pp-wrap"></div>
        <div class="result-card" id="result"></div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function addBitRow(el, bits, onChange) {
    el.innerHTML = "";
    bits.forEach((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bit-btn" + (v ? " on" : "");
      const name = el.id.startsWith("b") ? "B" : "A";
      b.textContent = `${name}${state.w - 1 - i}=${v}`;
      b.addEventListener("click", () => {
        bits[i] = v ? 0 : 1;
        onChange();
      });
      el.appendChild(b);
    });
  }

  function renderLab() {
    ensureWidth();
    const a = bitsToInt(state.aBits);
    const b = bitsToInt(state.bBits);
    const r = multiply(state.aBits, state.bBits);

    document.getElementById("starter-note").textContent =
      "Starter example: 4-bit unsigned 5 × 3 — partial-product rows for B₀ and B₁, product 001111₂ = 15.";
    document.getElementById("w-sel").value = String(state.w);
    document.getElementById("a-dec").value = String(a);
    document.getElementById("b-dec").value = String(b);
    document.getElementById("a-dec").max = String(mask(state.w));
    document.getElementById("b-dec").max = String(mask(state.w));

    addBitRow(document.getElementById("a-bits"), state.aBits, () => {
      saveSession();
      renderLab();
    });
    addBitRow(document.getElementById("b-bits"), state.bBits, () => {
      saveSession();
      renderLab();
    });

    // Table: columns = product bit weights from MSB (left) to LSB (right)
    let html = `<table class="pp-table"><thead><tr><th></th>`;
    for (let k = r.prodW - 1; k >= 0; k--) html += `<th>2<sup>${k}</sup></th>`;
    html += `</tr></thead><tbody>`;

    r.grid.forEach((g) => {
      html += `<tr><td class="row-lab">A·B<sub>${g.j}</sub> (B=${g.b})</td>`;
      for (let k = r.prodW - 1; k >= 0; k--) {
        const v = g.row[k];
        if (v == null) html += `<td></td>`;
        else html += `<td class="${v ? "pp1" : "pp0"}">${v}</td>`;
      }
      html += `</tr>`;
    });

    html += `<tr><td class="row-lab">product</td>`;
    for (let k = r.prodW - 1; k >= 0; k--) {
      const bit = r.prodBits[r.prodW - 1 - k];
      html += `<td class="sum">${bit}</td>`;
    }
    html += `</tr></tbody></table>`;
    document.getElementById("pp-wrap").innerHTML = html;

    const ppList = r.partialInts.map((p, j) => `PP${j}=${p}`).join(" + ");
    document.getElementById("result").innerHTML = `
      <div class="eq">${a} × ${b} = ${r.product}</div>
      <div>${a.toString(2).padStart(state.w, "0")}₂ × ${b.toString(2).padStart(state.w, "0")}₂ = ${r.prodBits.join("")}₂</div>
      <p class="am-meta">Partial integers: ${ppList} → sum ${r.product}. Grid cells are AND bits before carry-save / CPA reduction.</p>
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
            `<label><input type="radio" name="am-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else {
      ensureWidth();
      const r = multiply(state.aBits, state.bBits);
      ok = !!ch.check(state, r);
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

  document.getElementById("w-sel").addEventListener("change", (e) => {
    state.w = Number(e.target.value) === 3 ? 3 : 4;
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

  if (!restoreSession()) loadStarter();
  renderAll();
})();
