(() => {
  const STORAGE_KEY = "ddv-state-encoding-v1";
  const CLEARED_KEY = "ddv-state-encoding-cleared-v1";

  const ENCODINGS = ["binary", "onehot", "gray"];

  function clog2(n) {
    let w = 0;
    let x = Math.max(1, n - 1);
    while (x > 0) {
      w++;
      x >>= 1;
    }
    return Math.max(1, w);
  }

  function ffCount(enc, nStates) {
    if (enc === "onehot") return nStates;
    return clog2(nStates);
  }

  function toBits(val, w) {
    return val
      .toString(2)
      .padStart(w, "0")
      .split("")
      .map((c) => (c === "1" ? 1 : 0));
  }

  function bitsStr(bits) {
    return bits.join("");
  }

  function hamming(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
  }

  /** Binary reflected Gray code for index i */
  function grayCode(i) {
    return i ^ (i >> 1);
  }

  function encodeState(enc, idx, nStates) {
    const w = ffCount(enc, nStates);
    if (enc === "binary") return toBits(idx, w);
    if (enc === "gray") return toBits(grayCode(idx), w);
    // one-hot: bit idx is 1 (MSB = state n-1 at left, or LSB = S0 at right — use LSB = S0)
    const bits = Array(nStates).fill(0);
    bits[nStates - 1 - idx] = 1; // display MSB left: S0 → …0001
    return bits;
  }

  function stateName(i) {
    return `S${i}`;
  }

  /**
   * Default ring transitions: Si → S[(i+1)%n] for teaching Hamming on a cycle.
   * Also include a few extra arcs for non-power-of-2 demos when n>3.
   */
  function defaultArcs(n) {
    const arcs = [];
    for (let i = 0; i < n; i++) {
      arcs.push({ from: i, to: (i + 1) % n, label: "next" });
    }
    if (n >= 4) arcs.push({ from: 0, to: n - 1, label: "wrap-back" });
    if (n >= 5) arcs.push({ from: 2, to: 0, label: "abort" });
    return arcs;
  }

  function analyze(enc, nStates, arcs) {
    const w = ffCount(enc, nStates);
    const codes = [];
    for (let i = 0; i < nStates; i++) {
      const bits = encodeState(enc, i, nStates);
      codes.push({ i, name: stateName(i), bits, str: bitsStr(bits) });
    }
    const arcInfo = arcs.map((a) => {
      const fb = codes[a.from].bits;
      const tb = codes[a.to].bits;
      const hd = hamming(fb, tb);
      const flips = fb.map((b, k) => ({ k, from: b, to: tb[k], flip: b !== tb[k] }));
      return { ...a, hd, flips, fromCode: codes[a.from].str, toCode: codes[a.to].str };
    });
    const multi = arcInfo.filter((a) => a.hd > 1).length;
    const maxHd = arcInfo.reduce((m, a) => Math.max(m, a.hd), 0);
    const avgHd =
      arcInfo.length === 0 ? 0 : arcInfo.reduce((s, a) => s + a.hd, 0) / arcInfo.length;
    return { w, codes, arcInfo, multi, maxHd, avgHd };
  }

  function encLabel(enc) {
    if (enc === "binary") return "Binary";
    if (enc === "onehot") return "One-hot";
    return "Gray";
  }

  function encBlurb(enc) {
    if (enc === "binary")
      return "Compact: ⌈log₂ N⌉ FFs. Adjacent ring steps often flip multiple bits → decode glitch risk.";
    if (enc === "onehot")
      return "N FFs, exactly one bit high. Most arcs flip exactly two bits (leave + enter); decode is a single wire.";
    return "⌈log₂ N⌉ FFs like binary, but consecutive Gray codes differ by one bit — good for counters / sequential rings.";
  }

  const CHALLENGES = [
    {
      id: "quiz-binary-ff",
      title: "Quiz: binary FFs",
      type: "quiz",
      prompt: "Binary encoding of N states needs how many flip-flops?",
      hint: "Ceiling log2.",
      choices: ["⌈log₂ N⌉", "N", "N−1", "2N"],
      answer: "⌈log₂ N⌉",
    },
    {
      id: "quiz-onehot-ff",
      title: "Quiz: one-hot FFs",
      type: "quiz",
      prompt: "One-hot encoding of N states uses…",
      hint: "One FF per state.",
      choices: ["N flip-flops", "⌈log₂ N⌉ flip-flops", "1 flip-flop", "N² flip-flops"],
      answer: "N flip-flops",
    },
    {
      id: "quiz-gray",
      title: "Quiz: Gray",
      type: "quiz",
      prompt: "Gray codes for consecutive indices are designed so that…",
      hint: "Adjacent codes.",
      choices: [
        "they differ in exactly one bit",
        "they are always one-hot",
        "they need 2N FFs",
        "no bits ever change",
      ],
      answer: "they differ in exactly one bit",
    },
    {
      id: "quiz-hamming",
      title: "Quiz: Hamming",
      type: "quiz",
      prompt: "Hamming distance between two state codes is…",
      hint: "Bit flips.",
      choices: [
        "how many bits differ (flip) on that transition",
        "the number of states",
        "always 1 for binary",
        "the clock period",
      ],
      answer: "how many bits differ (flip) on that transition",
    },
    {
      id: "quiz-glitch",
      title: "Quiz: glitch risk",
      type: "quiz",
      prompt: "Multi-bit flips on a transition matter mainly because…",
      hint: "Decode hazards.",
      choices: [
        "intermediate illegal codes can glitch combo decode briefly",
        "FFs cannot store multi-bit codes",
        "synthesis forbids binary",
        "simulation ignores them",
      ],
      answer: "intermediate illegal codes can glitch combo decode briefly",
    },
    {
      id: "quiz-onehot-decode",
      title: "Quiz: one-hot decode",
      type: "quiz",
      prompt: "“Are we in S2?” for one-hot is typically…",
      hint: "One wire.",
      choices: [
        "just the S2 FF output bit",
        "a full equality compare of ⌈log₂ N⌉ bits",
        "impossible",
        "always Gray XOR",
      ],
      answer: "just the S2 FF output bit",
    },
    {
      id: "quiz-unused",
      title: "Quiz: unused codes",
      type: "quiz",
      prompt: "5 states in binary (3 FFs) leave unused codes. Good practice is to…",
      hint: "Safe recovery.",
      choices: [
        "define a recovery / default next-state for illegal codes",
        "ignore them forever",
        "ban binary encoding",
        "use blocking assigns only",
      ],
      answer: "define a recovery / default next-state for illegal codes",
    },
    {
      id: "quiz-tradeoff",
      title: "Quiz: tradeoff",
      type: "quiz",
      prompt: "One-hot vs binary — a common tradeoff is…",
      hint: "Area vs decode.",
      choices: [
        "more FFs, simpler / faster state decode",
        "fewer FFs and harder decode",
        "identical FF count always",
        "one-hot needs no clock",
      ],
      answer: "more FFs, simpler / faster state decode",
    },
    {
      id: "run-4-bin",
      title: "4-state binary",
      type: "run",
      prompt: "Set 4 states + Binary. Confirm FF count is 2.",
      hint: "Starter settings.",
      check: (s, a) => s.nStates === 4 && s.encoding === "binary" && a.w === 2,
    },
    {
      id: "run-4-oh",
      title: "4-state one-hot",
      type: "run",
      prompt: "4 states + One-hot → 4 FFs.",
      hint: "Switch encoding.",
      check: (s, a) => s.nStates === 4 && s.encoding === "onehot" && a.w === 4,
    },
    {
      id: "run-5-bin",
      title: "5-state binary FFs",
      type: "run",
      prompt: "5 states + Binary → 3 FFs (⌈log₂ 5⌉).",
      hint: "Need 3 bits for 5 codes.",
      check: (s, a) => s.nStates === 5 && s.encoding === "binary" && a.w === 3,
    },
    {
      id: "run-8-oh",
      title: "8-state one-hot",
      type: "run",
      prompt: "8 states + One-hot → 8 FFs.",
      hint: "Max size in this lab.",
      check: (s, a) => s.nStates === 8 && s.encoding === "onehot" && a.w === 8,
    },
    {
      id: "run-gray-ring",
      title: "Gray ring HD=1",
      type: "run",
      prompt: "4 states + Gray. On the ring S0→S1→S2→S3→S0, every “next” arc must have Hamming distance 1.",
      hint: "Gray consecutive codes.",
      check: (s, a) => {
        if (s.nStates !== 4 || s.encoding !== "gray") return false;
        const nexts = a.arcInfo.filter((x) => x.label === "next");
        return nexts.length === 4 && nexts.every((x) => x.hd === 1);
      },
    },
    {
      id: "run-bin-multi",
      title: "Binary multi-bit",
      type: "run",
      prompt: "4 states + Binary. Select the ring arc S1→S2 (codes 01→10) — Hamming distance must be 2.",
      hint: "Click that arc in the list.",
      check: (s, a) => {
        if (s.nStates !== 4 || s.encoding !== "binary") return false;
        if (s.selFrom !== 1 || s.selTo !== 2) return false;
        const arc = a.arcInfo.find((x) => x.from === 1 && x.to === 2);
        return arc && arc.hd === 2;
      },
    },
    {
      id: "run-oh-hd2",
      title: "One-hot next HD",
      type: "run",
      prompt: "4 states + One-hot. A “next” ring step (leave one bit, enter another) has Hamming distance 2.",
      hint: "Select any next arc.",
      check: (s, a) => {
        if (s.nStates !== 4 || s.encoding !== "onehot") return false;
        const arc = a.arcInfo.find((x) => x.from === s.selFrom && x.to === s.selTo);
        return arc && arc.label === "next" && arc.hd === 2;
      },
    },
    {
      id: "run-s0-code",
      title: "S0 binary code",
      type: "run",
      prompt: "4-state Binary: S0 code must be 00.",
      hint: "Read the table.",
      check: (s, a) => s.nStates === 4 && s.encoding === "binary" && a.codes[0].str === "00",
    },
    {
      id: "run-s0-oh",
      title: "S0 one-hot code",
      type: "run",
      prompt: "4-state One-hot: S0 must be 0001 (LSB = S0).",
      hint: "Rightmost bit.",
      check: (s, a) => s.nStates === 4 && s.encoding === "onehot" && a.codes[0].str === "0001",
    },
    {
      id: "run-compare-ff",
      title: "Compare FF counts",
      type: "run",
      prompt: "With 6 states selected, Binary/Gray use 3 FFs and One-hot uses 6 — set encoding to One-hot to confirm 6.",
      hint: "n=6, one-hot.",
      check: (s, a) => s.nStates === 6 && s.encoding === "onehot" && a.w === 6,
    },
    {
      id: "quiz-gray-ff",
      title: "Quiz: Gray FFs",
      type: "quiz",
      prompt: "Gray encoding of N states uses the same FF count as…",
      hint: "Same width as binary.",
      choices: ["binary (⌈log₂ N⌉)", "one-hot (N)", "always 1", "always N−1"],
      answer: "binary (⌈log₂ N⌉)",
    },
    {
      id: "quiz-not-always-gray",
      title: "Quiz: not always Gray",
      type: "quiz",
      prompt: "Gray helps ring/counter steps, but arbitrary FSM arcs…",
      hint: "Not every edge is consecutive.",
      choices: [
        "may still have Hamming distance > 1",
        "are always distance 1",
        "forbid one-hot",
        "need no recovery logic",
      ],
      answer: "may still have Hamming distance > 1",
    },
    {
      id: "run-3-bin",
      title: "3-state binary",
      type: "run",
      prompt: "3 states + Binary → 2 FFs (one unused code).",
      hint: "⌈log₂ 3⌉ = 2.",
      check: (s, a) => s.nStates === 3 && s.encoding === "binary" && a.w === 2,
    },
    {
      id: "pick-enc-oh",
      title: "Pick: densest decode",
      type: "quiz",
      prompt: "For the simplest “in state Si?” decode wire, prefer…",
      hint: "One-hot.",
      choices: ["one-hot", "binary only", "Gray only", "no encoding"],
      answer: "one-hot",
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
    nStates: 4,
    encoding: "binary",
    selFrom: 0,
    selTo: 1,
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function arcs() {
    return defaultArcs(state.nStates);
  }

  function current() {
    return analyze(state.encoding, state.nStates, arcs());
  }

  function loadStarter() {
    state.nStates = 4;
    state.encoding = "binary";
    state.selFrom = 0;
    state.selTo = 1;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nStates: state.nStates,
          encoding: state.encoding,
          selFrom: state.selFrom,
          selTo: state.selTo,
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
      const n = Number(d.nStates);
      if (!(n >= 3 && n <= 8)) return false;
      if (!ENCODINGS.includes(d.encoding)) return false;
      state.nStates = n;
      state.encoding = d.encoding;
      state.selFrom = Number(d.selFrom) || 0;
      state.selTo = Number(d.selTo) || 1;
      if (state.selFrom >= n) state.selFrom = 0;
      if (state.selTo >= n) state.selTo = 1;
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("se-root");
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
        <h2>Encoding explorer</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="se-controls">
          <div class="se-field">
            <label for="n-sel">States</label>
            <select id="n-sel"></select>
          </div>
        </div>
        <div class="enc-tabs" id="enc-tabs"></div>
        <p class="se-meta" id="blurb"></p>
        <div class="stat-row" id="stats"></div>
        <table class="code-table" id="code-table"></table>
        <p class="ring-hint">Transition arcs (ring + a few extras). Click an arc to inspect bit flips. Yellow rows flip more than one bit.</p>
        <div class="arc-grid" id="arc-grid"></div>
        <div id="arc-detail"></div>
        <div class="compare-grid" id="compare"></div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const a = current();
    document.getElementById("starter-note").textContent =
      "Starter example: 4 states, binary (2 FFs). Open One-hot and Gray tabs; click S1→S2 in binary to see Hamming distance 2.";

    const nSel = document.getElementById("n-sel");
    nSel.innerHTML = [3, 4, 5, 6, 7, 8]
      .map((n) => `<option value="${n}">${n} states</option>`)
      .join("");
    nSel.value = String(state.nStates);

    const tabs = document.getElementById("enc-tabs");
    tabs.innerHTML = "";
    ENCODINGS.forEach((enc) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = encLabel(enc);
      if (enc === state.encoding) b.classList.add("active");
      b.addEventListener("click", () => {
        state.encoding = enc;
        saveSession();
        renderAll();
      });
      tabs.appendChild(b);
    });

    document.getElementById("blurb").textContent = encBlurb(state.encoding);
    document.getElementById("stats").innerHTML = `
      <span><strong>${a.w}</strong> flip-flops</span>
      <span>max Hamming <strong>${a.maxHd}</strong></span>
      <span>avg Hamming <strong>${a.avgHd.toFixed(2)}</strong></span>
      <span>multi-bit arcs <strong>${a.multi}</strong> / ${a.arcInfo.length}</span>
    `;

    const table = document.getElementById("code-table");
    table.innerHTML = `
      <thead><tr><th>State</th><th>Code (${a.w} bits)</th><th>Decimal</th></tr></thead>
      <tbody>
        ${a.codes
          .map((c) => {
            const sel = c.i === state.selFrom || c.i === state.selTo ? "selected" : "";
            return `<tr class="${sel}"><td>${c.name}</td><td class="bits">${c.str}</td><td>${parseInt(c.str, 2)}</td></tr>`;
          })
          .join("")}
      </tbody>
    `;

    const grid = document.getElementById("arc-grid");
    grid.innerHTML = "";
    a.arcInfo.forEach((arc) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "arc-row" + (arc.hd > 1 ? " multi" : "");
      if (arc.from === state.selFrom && arc.to === state.selTo) row.classList.add("active");
      row.innerHTML = `
        <span>${stateName(arc.from)} → ${stateName(arc.to)} <span style="color:var(--muted)">(${arc.label})</span></span>
        <span class="bits">${arc.fromCode} → ${arc.toCode}</span>
        <span class="hd ${arc.hd > 1 ? "warn" : "ok"}">HD ${arc.hd}</span>
      `;
      row.addEventListener("click", () => {
        state.selFrom = arc.from;
        state.selTo = arc.to;
        saveSession();
        renderAll();
      });
      grid.appendChild(row);
    });

    const sel = a.arcInfo.find((x) => x.from === state.selFrom && x.to === state.selTo) || a.arcInfo[0];
    if (sel) {
      state.selFrom = sel.from;
      state.selTo = sel.to;
      document.getElementById("arc-detail").innerHTML = `
        <p class="se-meta" style="color:var(--ink)"><strong>Selected:</strong> ${stateName(sel.from)} → ${stateName(sel.to)} · Hamming ${sel.hd}</p>
        <div class="bitflip">
          ${sel.flips
            .map(
              (f, i) =>
                `<span class="${f.flip ? "flip" : ""}">b${sel.flips.length - 1 - i}: ${f.from}→${f.to}</span>`
            )
            .join("")}
        </div>
      `;
    }

    document.getElementById("compare").innerHTML = ENCODINGS.map((enc) => {
      const x = analyze(enc, state.nStates, arcs());
      return `<div class="compare-card ${enc === state.encoding ? "current" : ""}">
        <h3>${encLabel(enc)}</h3>
        <div>${x.w} FFs</div>
        <div>max HD ${x.maxHd}</div>
        <div>${x.multi} multi-bit arcs</div>
      </div>`;
    }).join("");
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
            `<label><input type="radio" name="se-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    if (ch.type === "run") {
      if (ch.id === "run-4-bin" || ch.id === "run-s0-code" || ch.id === "run-bin-multi") {
        state.nStates = 4;
        state.encoding = "binary";
        state.selFrom = ch.id === "run-bin-multi" ? 0 : 0;
        state.selTo = ch.id === "run-bin-multi" ? 1 : 1;
      } else if (ch.id === "run-4-oh" || ch.id === "run-s0-oh" || ch.id === "run-oh-hd2") {
        state.nStates = 4;
        state.encoding = "onehot";
        state.selFrom = 0;
        state.selTo = 1;
      } else if (ch.id === "run-5-bin") {
        state.nStates = 5;
        state.encoding = "binary";
      } else if (ch.id === "run-8-oh") {
        state.nStates = 8;
        state.encoding = "onehot";
      } else if (ch.id === "run-gray-ring") {
        state.nStates = 4;
        state.encoding = "gray";
      } else if (ch.id === "run-compare-ff") {
        state.nStates = 6;
        state.encoding = "binary";
      } else if (ch.id === "run-3-bin") {
        state.nStates = 3;
        state.encoding = "binary";
      }
      saveSession();
      renderAll();
      setChalStatus("idle", "Setup loaded — finish the goal, then Check");
    } else setChalStatus("idle", "Quiz — pick an answer");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else ok = !!ch.check(state, current());
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

  document.getElementById("n-sel").addEventListener("change", (e) => {
    state.nStates = Number(e.target.value);
    state.selFrom = 0;
    state.selTo = 1;
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
