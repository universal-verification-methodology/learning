(() => {
  const STORAGE_KEY = "ddv-seq-detector-v1";
  const CLEARED_KEY = "ddv-seq-detector-cleared-v1";

  const PATTERNS = ["1011", "1101", "1001", "1010", "1110"];

  /**
   * Build a Mealy detector for pattern bits.
   * States 0..n = matched prefix length.
   * On match: Z=1; next = longest proper prefix of (matched+bit) that is prefix of pattern
   *           if overlap, else 0 (or restart from bit if it starts pattern).
   */
  function buildMealy(pattern, overlap) {
    const p = pattern.split("").map((c) => (c === "1" ? 1 : 0));
    const n = p.length;
    const states = [];
    for (let i = 0; i <= n - 1; i++) {
      states.push({ id: i, name: `S${i}`, meaning: i === 0 ? "∅" : p.slice(0, i).join("") });
    }
    /** delta[s][x] = { next, z } */
    const delta = [];
    for (let s = 0; s < n; s++) {
      delta[s] = [];
      for (const x of [0, 1]) {
        let z = 0;
        let next;
        if (s === n - 1 && x === p[n - 1]) {
          z = 1;
          const matched = p.slice(0, n - 1).concat([x]);
          next = overlap ? longestPrefix(p, matched) : restartAfterDetect(p, x);
        } else if (p[s] === x) {
          next = s + 1;
          // if next would be n, handled above; here next < n
        } else {
          // failure: longest prefix of (prefix_s + x)
          const seq = p.slice(0, s).concat([x]);
          next = longestPrefix(p, seq);
        }
        // Cap: if we advanced to n without going through detect branch — shouldn't happen
        if (next >= n) next = overlap ? longestPrefix(p, p) : 0;
        delta[s][x] = { next, z };
      }
    }
    return { kind: "mealy", pattern: pattern, overlap, states, delta, n };
  }

  /**
   * Moore: states 0..n where state n is detect (Z=1). Output depends on state only.
   */
  function buildMoore(pattern, overlap) {
    const p = pattern.split("").map((c) => (c === "1" ? 1 : 0));
    const n = p.length;
    const states = [];
    for (let i = 0; i <= n; i++) {
      states.push({
        id: i,
        name: `S${i}`,
        meaning: i === 0 ? "∅" : i < n ? p.slice(0, i).join("") : "DETECT",
        z: i === n ? 1 : 0,
      });
    }
    const delta = [];
    for (let s = 0; s <= n; s++) {
      delta[s] = [];
      for (const x of [0, 1]) {
        let next;
        if (s === n) {
          // leave detect
          next = overlap ? longestPrefix(p, p.concat([x]).slice(-n)) : restartAfterDetect(p, x);
          // better: from detect, treat as having matched full pattern then consume x
          const after = overlap ? longestPrefix(p, p.concat([x])) : restartAfterDetect(p, x);
          next = after;
        } else if (p[s] === x) {
          next = s + 1;
        } else {
          next = longestPrefix(p, p.slice(0, s).concat([x]));
        }
        if (next > n) next = n;
        delta[s][x] = { next, z: null }; // z from state
      }
    }
    return { kind: "moore", pattern, overlap, states, delta, n };
  }

  /** Longest k < seq.length (or <= for detect restart) such that p[0..k) == seq.slice(-k) and k is prefix len of p */
  function longestPrefix(p, seq) {
    // Find largest k in 0..min(n-1, seq.length) where p[0..k) equals seq ending
    const n = p.length;
    const maxK = Math.min(n - 1, seq.length);
    for (let k = maxK; k >= 0; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (p[i] !== seq[seq.length - k + i]) {
          ok = false;
          break;
        }
      }
      if (ok) return k;
    }
    return 0;
  }

  function restartAfterDetect(p, x) {
    // Non-overlap: after detecting, start fresh with bit x
    return p[0] === x ? 1 : 0;
  }

  function buildMachine(pattern, style, overlap) {
    return style === "moore" ? buildMoore(pattern, overlap) : buildMealy(pattern, overlap);
  }

  function stepMachine(m, state, x) {
    const d = m.delta[state][x];
    if (m.kind === "mealy") {
      return { next: d.next, z: d.z };
    }
    const next = d.next;
    const z = m.states[next].z;
    return { next, z };
  }

  /** Run full stream from S0; return z array and state path */
  function runStream(m, bits) {
    let s = 0;
    const zs = [];
    const path = [0];
    for (const b of bits) {
      const r = stepMachine(m, s, b);
      s = r.next;
      zs.push(r.z);
      path.push(s);
    }
    return { zs, path };
  }

  const CHALLENGES = [
    {
      id: "quiz-seq",
      title: "Quiz: detector",
      type: "quiz",
      prompt: "A sequence detector FSM recognizes…",
      hint: "Pattern in a stream.",
      choices: [
        "a specific bit pattern in a serial input stream",
        "only combinational AND",
        "DRAM refresh timing",
        "I²C address only",
      ],
      answer: "a specific bit pattern in a serial input stream",
    },
    {
      id: "quiz-mealy",
      title: "Quiz: Mealy",
      type: "quiz",
      prompt: "In a Mealy detector, output Z depends on…",
      hint: "State + input.",
      choices: [
        "current state and current input",
        "state only",
        "the clock period only",
        "tag and index",
      ],
      answer: "current state and current input",
    },
    {
      id: "quiz-moore",
      title: "Quiz: Moore",
      type: "quiz",
      prompt: "In a Moore detector, output Z depends on…",
      hint: "State only.",
      choices: [
        "current state only (often a dedicated DETECT state)",
        "input only",
        "FIFO count",
        "always 1",
      ],
      answer: "current state only (often a dedicated DETECT state)",
    },
    {
      id: "quiz-overlap",
      title: "Quiz: overlap",
      type: "quiz",
      prompt: "Overlapping detection means…",
      hint: "Reuse suffix.",
      choices: [
        "a suffix of a match can start the next match",
        "patterns never share bits",
        "the FSM has no states",
        "Z is ignored",
      ],
      answer: "a suffix of a match can start the next match",
    },
    {
      id: "quiz-prefix",
      title: "Quiz: states",
      type: "quiz",
      prompt: "State Sₖ typically means…",
      hint: "Prefix length.",
      choices: [
        "the first k bits of the target pattern have been matched",
        "k clocks of reset",
        "k cache sets",
        "Gray code k",
      ],
      answer: "the first k bits of the target pattern have been matched",
    },
    {
      id: "quiz-z",
      title: "Quiz: Z=1",
      type: "quiz",
      prompt: "Z=1 means…",
      hint: "Detect pulse.",
      choices: [
        "the target sequence was recognized on this step",
        "the FIFO is full",
        "a cache miss",
        "parse error",
      ],
      answer: "the target sequence was recognized on this step",
    },
    {
      id: "quiz-serial",
      title: "Quiz: serial",
      type: "quiz",
      prompt: "Input arrives…",
      hint: "One bit / step.",
      choices: [
        "one bit per step (serial stream)",
        "as a parallel bus only",
        "only on reset",
        "from the tag field",
      ],
      answer: "one bit per step (serial stream)",
    },
    {
      id: "quiz-nonoverlap",
      title: "Quiz: non-overlap",
      type: "quiz",
      prompt: "Non-overlapping mode after a detect typically…",
      hint: "Restart.",
      choices: [
        "restarts matching (does not immediately reuse the detect bits as a new prefix)",
        "stays in DETECT forever",
        "clears the pattern",
        "forces Moore only",
      ],
      answer: "restarts matching (does not immediately reuse the detect bits as a new prefix)",
    },
    {
      id: "run-1011-hit",
      title: "Detect 1011",
      type: "run",
      prompt: "Mealy + overlap, pattern 1011. Stream 1011 — after full step-through, final Z must be 1.",
      hint: "Starter stream.",
      check: (s, m) => {
        if (s.pattern !== "1011" || s.style !== "mealy") return false;
        const bits = s.stream.map(Number);
        if (bits.join("") !== "1011") return false;
        const { zs } = runStream(m, bits);
        return s.pos >= bits.length && zs[zs.length - 1] === 1;
      },
    },
    {
      id: "run-step2",
      title: "After 10",
      type: "run",
      prompt: "Pattern 1011 Mealy: stream starting 10… Step twice — state must be S2.",
      hint: "Reset, stream 1011, Step×2.",
      check: (s) => s.pattern === "1011" && s.style === "mealy" && s.pos === 2 && s.state === 2,
    },
    {
      id: "run-z-pulse",
      title: "Z on last bit",
      type: "run",
      prompt: "Pattern 1011 Mealy, stream 1011: Z history must be 0001.",
      hint: "Step all four bits.",
      check: (s, m) => {
        if (s.pattern !== "1011" || s.stream.join("") !== "1011") return false;
        const { zs } = runStream(m, s.stream.map(Number));
        return s.pos >= 4 && zs.join("") === "0001";
      },
    },
    {
      id: "run-no-false",
      title: "No false detect",
      type: "run",
      prompt: "Pattern 1011, stream 1010 — after complete run, no Z=1.",
      hint: "Change last bit.",
      check: (s, m) => {
        if (s.pattern !== "1011" || s.stream.join("") !== "1010") return false;
        const { zs } = runStream(m, s.stream.map(Number));
        return s.pos >= 4 && zs.every((z) => z === 0);
      },
    },
    {
      id: "run-overlap",
      title: "Overlap 1011",
      type: "run",
      prompt: "Mealy overlap ON, pattern 1011, stream 1011011 — Z must pulse twice (positions of completes).",
      hint: "1011 then …011 with overlap.",
      check: (s, m) => {
        if (!s.overlap || s.style !== "mealy" || s.pattern !== "1011") return false;
        if (s.stream.join("") !== "1011011") return false;
        const { zs } = runStream(m, s.stream.map(Number));
        return s.pos >= 7 && zs.filter((z) => z === 1).length === 2;
      },
    },
    {
      id: "run-moore-detect",
      title: "Moore DETECT",
      type: "run",
      prompt: "Moore + 1011, stream 1011: after completion, state is S4 (DETECT) and Z=1.",
      hint: "Switch style to Moore.",
      check: (s, m) => {
        if (s.style !== "moore" || s.pattern !== "1011" || s.stream.join("") !== "1011") return false;
        return s.pos >= 4 && s.state === m.n && s.zHist[s.zHist.length - 1] === 1;
      },
    },
    {
      id: "run-1101",
      title: "Pattern 1101",
      type: "run",
      prompt: "Select pattern 1101 (Mealy), stream 1101 — final Z=1 after full steps.",
      hint: "Change pattern.",
      check: (s, m) => {
        if (s.pattern !== "1101" || s.stream.join("") !== "1101") return false;
        const { zs } = runStream(m, s.stream.map(Number));
        return s.pos >= 4 && zs[zs.length - 1] === 1;
      },
    },
    {
      id: "run-reset-s0",
      title: "Reset to S0",
      type: "run",
      prompt: "After some steps, Reset run — state S0 and pos 0.",
      hint: "Reset run button.",
      check: (s) => s.state === 0 && s.pos === 0,
    },
    {
      id: "run-custom-stream",
      title: "Stream 111011",
      type: "run",
      prompt: "Pattern 1011 Mealy: set stream to 111011 and step through — Z never 1.",
      hint: "Edit stream.",
      check: (s, m) => {
        if (s.pattern !== "1011" || s.stream.join("") !== "111011") return false;
        const { zs } = runStream(m, s.stream.map(Number));
        return s.pos >= 6 && !zs.includes(1);
      },
    },
    {
      id: "quiz-fail",
      title: "Quiz: mismatch",
      type: "quiz",
      prompt: "If the next bit does not continue the prefix, the FSM…",
      hint: "Failure function.",
      choices: [
        "falls back to the longest prefix still consistent with the bits seen",
        "always resets the clock",
        "enters DETECT",
        "sets full",
      ],
      answer: "falls back to the longest prefix still consistent with the bits seen",
    },
    {
      id: "run-s1",
      title: "First 1 → S1",
      type: "run",
      prompt: "Pattern 1011: from reset, step a leading 1 — state S1.",
      hint: "Stream starting with 1.",
      check: (s) => s.pattern === "1011" && s.pos === 1 && s.state === 1 && s.stream[0] === "1",
    },
    {
      id: "run-show-all",
      title: "Step all",
      type: "run",
      prompt: "Any valid stream: use Step until pos equals stream length (complete).",
      hint: "Step repeatedly.",
      check: (s) => s.pos >= s.stream.length && s.stream.length > 0,
    },
    {
      id: "quiz-vs-fsm-lab",
      title: "Quiz: vs FSM lab",
      type: "quiz",
      prompt: "This tool focuses on…",
      hint: "Pattern FSM.",
      choices: [
        "a fixed pattern-detector FSM you step with a bit stream",
        "drawing arbitrary state diagrams from scratch",
        "cache tag compare",
        "CLA generate only",
      ],
      answer: "a fixed pattern-detector FSM you step with a bit stream",
    },
    {
      id: "run-z-count",
      title: "Count detects",
      type: "run",
      prompt: "Mealy 1011 overlap, stream 1011: exactly one detect in Z history after full run.",
      hint: "One match.",
      check: (s, m) => {
        if (s.pattern !== "1011" || s.stream.join("") !== "1011") return false;
        const { zs } = runStream(m, s.stream.map(Number));
        return s.pos >= 4 && zs.filter((z) => z === 1).length === 1;
      },
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
    pattern: "1011",
    style: "mealy",
    overlap: true,
    stream: ["1", "0", "1", "1"],
    pos: 0,
    state: 0,
    zHist: [],
    log: [],
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function machine() {
    return buildMachine(state.pattern, state.style, state.overlap);
  }

  function loadStarter() {
    state.pattern = "1011";
    state.style = "mealy";
    state.overlap = true;
    state.stream = ["1", "0", "1", "1"];
    state.pos = 0;
    state.state = 0;
    state.zHist = [];
    state.log = ["Starter: detect 1011 (Mealy, overlap). Step through 1,0,1,1 — Z=1 on the last bit."];
  }

  function resetRun() {
    state.pos = 0;
    state.state = 0;
    state.zHist = [];
    state.log = ["Run reset → S0."];
  }

  function doStep() {
    if (state.pos >= state.stream.length) return;
    const m = machine();
    const x = Number(state.stream[state.pos]);
    const r = stepMachine(m, state.state, x);
    state.log.unshift(
      `x=${x}: ${m.states[state.state].name} → ${m.states[r.next].name}, Z=${r.z}`
    );
    if (state.log.length > 40) state.log.length = 40;
    state.state = r.next;
    state.zHist.push(r.z);
    state.pos++;
    saveSession();
    renderAll();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          pattern: state.pattern,
          style: state.style,
          overlap: state.overlap,
          stream: state.stream,
          pos: state.pos,
          state: state.state,
          zHist: state.zHist,
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
      if (!PATTERNS.includes(d.pattern)) return false;
      state.pattern = d.pattern;
      state.style = d.style === "moore" ? "moore" : "mealy";
      state.overlap = !!d.overlap;
      if (Array.isArray(d.stream) && d.stream.length) state.stream = d.stream.map(String);
      state.pos = Number(d.pos) || 0;
      state.state = Number(d.state) || 0;
      state.zHist = Array.isArray(d.zHist) ? d.zHist : [];
      state.log = ["Session restored."];
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("sd-root");
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
        <h2>Detector stepper</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-reset">Reset run</button>
          <button type="button" class="btn btn-secondary" id="btn-step">Step</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="sd-controls">
          <div class="sd-field">
            <label for="pat">Pattern</label>
            <select id="pat"></select>
          </div>
          <div class="sd-field">
            <label for="style">Style</label>
            <select id="style">
              <option value="mealy">Mealy</option>
              <option value="moore">Moore</option>
            </select>
          </div>
          <div class="sd-field">
            <label for="overlap">Overlap</label>
            <select id="overlap">
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
          <div class="sd-field">
            <label for="stream">Bit stream</label>
            <input id="stream" type="text" spellcheck="false" placeholder="1011">
          </div>
        </div>
        <p class="sd-meta" id="meaning"></p>
        <div class="stream-row" id="stream-view"></div>
        <div class="status-strip" id="status"></div>
        <div class="state-row" id="states"></div>
        <p class="sd-meta" style="font-weight:600;color:var(--ink)">Transition table</p>
        <table class="ttable" id="ttable"></table>
        <p class="sd-meta">Z history</p>
        <div class="wave-z" id="wave-z"></div>
        <ul class="log-list" id="log"></ul>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function parseStream(str) {
    return String(str)
      .replace(/[^01]/g, "")
      .split("")
      .filter(Boolean);
  }

  function renderLab() {
    const m = machine();
    document.getElementById("starter-note").textContent =
      "Starter example: Mealy overlapping detector for 1011. Step the stream 1011 — Z goes 0,0,0,1.";

    const pat = document.getElementById("pat");
    pat.innerHTML = PATTERNS.map((p) => `<option value="${p}">${p}</option>`).join("");
    pat.value = state.pattern;
    document.getElementById("style").value = state.style;
    document.getElementById("overlap").value = state.overlap ? "1" : "0";
    document.getElementById("stream").value = state.stream.join("");

    document.getElementById("meaning").textContent =
      `${state.style} · overlap=${state.overlap ? "yes" : "no"} · pattern ${state.pattern} · states encode matched prefix`;

    const sv = document.getElementById("stream-view");
    sv.innerHTML = "";
    state.stream.forEach((b, i) => {
      const span = document.createElement("span");
      span.className = "bit";
      if (i < state.pos) span.classList.add("done");
      if (i === state.pos) span.classList.add("cur");
      if (state.zHist[i] === 1) span.classList.add("z1");
      span.textContent = b;
      sv.appendChild(span);
    });

    const zNow = state.zHist.length ? state.zHist[state.zHist.length - 1] : 0;
    document.getElementById("status").innerHTML = `
      <span>state <strong>${m.states[state.state]?.name || "S?"}</strong></span>
      <span>pos ${state.pos}/${state.stream.length}</span>
      <span class="${zNow ? "z-on" : ""}">last Z=${zNow}</span>
    `;

    document.getElementById("states").innerHTML = m.states
      .map((st) => {
        const cls =
          "state-chip" +
          (st.id === state.state ? " active" : "") +
          (st.meaning === "DETECT" || (m.kind === "moore" && st.z) ? " detect" : "");
        return `<span class="${cls}">${st.name}<br><span style="font-size:0.7rem;color:var(--muted)">${st.meaning}</span></span>`;
      })
      .join("");

    // Transition table
    let rows = "";
    for (const st of m.states) {
      if (m.kind === "mealy" && st.id >= m.n) continue;
      if (m.kind === "moore" && !m.delta[st.id]) continue;
      const d0 = m.delta[st.id][0];
      const d1 = m.delta[st.id][1];
      const z0 = m.kind === "mealy" ? d0.z : m.states[d0.next].z;
      const z1 = m.kind === "mealy" ? d1.z : m.states[d1.next].z;
      rows += `<tr class="${st.id === state.state ? "cur" : ""}">
        <td>${st.name}</td>
        <td>${m.states[d0.next].name} / Z=${z0}</td>
        <td>${m.states[d1.next].name} / Z=${z1}</td>
        ${m.kind === "moore" ? `<td>${st.z}</td>` : ""}
      </tr>`;
    }
    document.getElementById("ttable").innerHTML = `
      <thead><tr><th>State</th><th>x=0 → next/Z</th><th>x=1 → next/Z</th>${
        m.kind === "moore" ? "<th>Moore Z</th>" : ""
      }</tr></thead>
      <tbody>${rows}</tbody>
    `;

    document.getElementById("wave-z").textContent =
      state.zHist.length ? "Z: " + state.zHist.join(" ") : "Z: (none yet)";
    document.getElementById("log").innerHTML = state.log.map((l) => `<li>${l}</li>`).join("") ||
      `<li style="color:var(--muted)">Step to advance</li>`;
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
            `<label><input type="radio" name="sd-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    if (ch.type === "quiz") {
      setChalStatus("idle", "Quiz — pick an answer");
      return;
    }
    state.style = "mealy";
    state.overlap = true;
    state.pattern = "1011";
    state.stream = ["1", "0", "1", "1"];
    resetRun();

    if (ch.id === "run-no-false") state.stream = ["1", "0", "1", "0"];
    else if (ch.id === "run-overlap") state.stream = ["1", "0", "1", "1", "0", "1", "1"];
    else if (ch.id === "run-moore-detect") {
      state.style = "moore";
      state.stream = ["1", "0", "1", "1"];
    } else if (ch.id === "run-1101") {
      state.pattern = "1101";
      state.stream = ["1", "1", "0", "1"];
    } else if (ch.id === "run-custom-stream") state.stream = ["1", "1", "1", "0", "1", "1"];
    else if (ch.id === "run-s1") state.stream = ["1", "0", "1", "1"];
    else if (ch.id === "run-reset-s0") {
      state.stream = ["1", "0", "1", "1"];
      doStep();
      return;
    }

    saveSession();
    renderAll();
    setChalStatus("idle", "Setup loaded — Step as needed, then Check");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else ok = !!ch.check(state, machine());
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

  function applyConfigChange() {
    resetRun();
    saveSession();
    renderAll();
  }

  document.getElementById("pat").addEventListener("change", (e) => {
    state.pattern = e.target.value;
    applyConfigChange();
  });
  document.getElementById("style").addEventListener("change", (e) => {
    state.style = e.target.value;
    applyConfigChange();
  });
  document.getElementById("overlap").addEventListener("change", (e) => {
    state.overlap = e.target.value === "1";
    applyConfigChange();
  });
  document.getElementById("stream").addEventListener("change", (e) => {
    const bits = parseStream(e.target.value);
    if (bits.length) state.stream = bits;
    applyConfigChange();
  });
  document.getElementById("btn-step").addEventListener("click", doStep);
  document.getElementById("btn-reset").addEventListener("click", () => {
    resetRun();
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
