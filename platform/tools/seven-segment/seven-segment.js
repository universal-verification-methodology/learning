(() => {
  /**
   * Seven-segment decoder (hex nibble → a–g).
   * Layout:
   *    a
   *  f   b
   *    g
   *  e   c
   *    d
   * Common-cathode: 1 = segment ON. Common-anode: drive bits inverted.
   */

  const SEG_NAMES = ["a", "b", "c", "d", "e", "f", "g"];

  /** Active-high (common-cathode) patterns, index 0..15, bits abcdefg */
  const CC_PATTERNS = [
    "1111110", // 0
    "0110000", // 1
    "1101101", // 2
    "1111001", // 3
    "0110011", // 4
    "1011011", // 5
    "1011111", // 6
    "1110000", // 7
    "1111111", // 8
    "1111011", // 9
    "1110111", // A
    "0011111", // b
    "1001110", // C
    "0111101", // d
    "1001111", // E
    "1000111", // F
  ];

  const GLYPH = "0123456789AbCdEF";

  function patternFor(nibble, polarity) {
    const n = nibble & 0xf;
    const cc = CC_PATTERNS[n];
    if (polarity === "ca") {
      return cc
        .split("")
        .map((b) => (b === "1" ? "0" : "1"))
        .join("");
    }
    return cc;
  }

  function litMask(nibble, polarity) {
    // Which segments are visually ON (always interpret as lit geometry)
    const cc = CC_PATTERNS[nibble & 0xf];
    return cc.split("").map((b) => b === "1");
  }

  function makeStarter() {
    return {
      nibble: 0xa,
      polarity: "cc", // cc = common cathode, ca = common anode
      lastAction: "",
      setPolarity: false,
      explained: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-seven-segment-cleared-v1";
  const STORE_KEY = "ddv-seven-segment-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("ss-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> nibble <code>0xA</code> → glyph <code>A</code>,
        common-cathode <code>abcdefg = 1110111</code> (all but <code>d</code>).</p>
      <button type="button" class="btn btn-secondary" id="ss-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Core ideas</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Nibble</h3>
            <p>4-bit code <code>0…F</code> selects one of 16 glyphs.</p>
          </div>
          <div class="idea-card">
            <h3>a–g</h3>
            <p>Seven segments; decoder is a ROM / SOP cover.</p>
          </div>
          <div class="idea-card">
            <h3>Polarity</h3>
            <p>Common-cathode: 1=ON. Anode: invert the bus.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Decoder</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Polarity
              <select id="pol-sel">
                <option value="cc" selected>Common cathode (1=ON)</option>
                <option value="ca">Common anode (0=ON)</option>
              </select>
            </label>
          </div>
          <p class="legend">Pick a hex digit:</p>
          <div class="nibble-row" id="nibble-row"></div>
          <div class="layout-mini"> a<br>f b<br> g<br>e c<br> d</div>
          <div class="display-wrap">
            <svg class="seg-svg" id="seg-svg" viewBox="0 0 100 160" role="img" aria-label="Seven segment display"></svg>
          </div>
          <div class="seg-bits" id="seg-bits"></div>
          <div class="action-grid">
            <button type="button" id="btn-0">Show 0</button>
            <button type="button" id="btn-8">Show 8 (all on)</button>
            <button type="button" id="btn-1">Show 1</button>
            <button type="button" id="btn-f">Show F</button>
            <button type="button" id="btn-anode">Flip to common anode</button>
            <button type="button" id="btn-explain">Explain decode</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Code &amp; table</h2></div>
        <div class="panel-body">
          <div class="out-grid">
            <div class="out-card">
              <h3>Glyph</h3>
              <p class="val" id="glyph-val">—</p>
            </div>
            <div class="out-card">
              <h3>Drive abcdefg</h3>
              <p class="val" id="pat-val">—</p>
            </div>
          </div>
          <div style="max-height:14rem;overflow:auto">
            <table class="tt">
              <thead>
                <tr><th>N</th><th>g</th><th>abcdefg</th></tr>
              </thead>
              <tbody id="tt-body"></tbody>
            </table>
          </div>
          <pre class="trace-box" id="trace-box" style="margin-top:0.65rem"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Idea</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>Segment order</td><td>This lab uses <code>abcdefg</code> MSB→LSB style string</td></tr>
            <tr><td>Digit 8</td><td>All seven segments on</td></tr>
            <tr><td>Digit 1</td><td>Only <code>b</code> and <code>c</code></td></tr>
            <tr><td>Common anode</td><td>Drive bus = NOT(common-cathode pattern)</td></tr>
            <tr><td>Hex letters</td><td>A,b,C,d,E,F — mixed case for clarity</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter A: <code>1110111</code> — segment <code>d</code> off.</li>
          <li>Decoder RTL is often a <code>case</code> / ROM, not seven huge SOPs.</li>
        </ul>
      </div>
    </div>
  `;

  const polSel = document.getElementById("pol-sel");
  const nibbleRow = document.getElementById("nibble-row");
  const segSvg = document.getElementById("seg-svg");
  const segBits = document.getElementById("seg-bits");
  const glyphVal = document.getElementById("glyph-val");
  const patVal = document.getElementById("pat-val");
  const ttBody = document.getElementById("tt-body");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  // Segment polygons (approximate classic digit)
  const SEG_PATHS = {
    a: "M22,12 L78,12 L70,20 L30,20 Z",
    b: "M80,14 L88,22 L88,68 L80,76 L72,68 L72,22 Z",
    c: "M80,84 L88,92 L88,138 L80,146 L72,138 L72,92 Z",
    d: "M22,148 L78,148 L70,140 L30,140 Z",
    e: "M12,84 L20,92 L20,138 L12,146 L4,138 L4,92 Z",
    f: "M12,14 L20,22 L20,68 L12,76 L4,68 L4,22 Z",
    g: "M22,80 L78,80 L70,88 L30,88 L22,80 L30,72 L70,72 Z",
  };

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 40) state.log = state.log.slice(-30);
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function renderNibbleRow() {
    nibbleRow.innerHTML = "";
    for (let i = 0; i < 16; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = GLYPH[i];
      if (i === state.nibble) b.className = "is-active";
      b.addEventListener("click", () => {
        state.nibble = i;
        state.lastAction = "pick";
        pushLog("run", `# nibble → 0x${i.toString(16).toUpperCase()}`);
        renderAll();
      });
      nibbleRow.appendChild(b);
    }
  }

  function renderDisplay() {
    const lit = litMask(state.nibble, state.polarity);
    let html = "";
    SEG_NAMES.forEach((name, i) => {
      html += `<path class="seg${lit[i] ? " on" : ""}" d="${SEG_PATHS[name]}" data-seg="${name}"/>`;
    });
    // labels
    html += `<text class="seg-label" x="46" y="10" text-anchor="middle">a</text>`;
    html += `<text class="seg-label" x="92" y="48">b</text>`;
    html += `<text class="seg-label" x="92" y="118">c</text>`;
    html += `<text class="seg-label" x="46" y="158" text-anchor="middle">d</text>`;
    html += `<text class="seg-label" x="0" y="118">e</text>`;
    html += `<text class="seg-label" x="0" y="48">f</text>`;
    html += `<text class="seg-label" x="46" y="86" text-anchor="middle">g</text>`;
    segSvg.innerHTML = html;
  }

  function renderSegBits() {
    const drive = patternFor(state.nibble, state.polarity);
    const lit = litMask(state.nibble, state.polarity);
    segBits.innerHTML = "";
    SEG_NAMES.forEach((name, i) => {
      const s = document.createElement("span");
      s.className = lit[i] ? "on" : "";
      s.textContent = `${name}=${drive[i]}`;
      segBits.appendChild(s);
    });
  }

  function renderOut() {
    glyphVal.textContent = `${GLYPH[state.nibble]}  (0x${state.nibble
      .toString(16)
      .toUpperCase()})`;
    const pat = patternFor(state.nibble, state.polarity);
    patVal.textContent = `${pat}  (${state.polarity === "cc" ? "CC" : "CA"})`;
  }

  function renderTable() {
    ttBody.innerHTML = "";
    for (let i = 0; i < 16; i++) {
      const tr = document.createElement("tr");
      if (i === state.nibble) tr.className = "is-active";
      const pat = patternFor(i, state.polarity);
      tr.innerHTML = `<td>0x${i.toString(16).toUpperCase()}</td><td>${GLYPH[i]}</td><td>${pat}</td>`;
      ttBody.appendChild(tr);
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(pick a digit or explain)</span>';
      return;
    }
    traceBox.innerHTML = state.trace
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no actions yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll() {
    polSel.value = state.polarity;
    renderNibbleRow();
    renderDisplay();
    renderSegBits();
    renderOut();
    renderTable();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter 0xA → 1110111 (CC)");
    state.trace = [];
    renderAll();
  }

  function explain() {
    const pat = patternFor(state.nibble, state.polarity);
    const lit = litMask(state.nibble, state.polarity);
    const on = SEG_NAMES.filter((_, i) => lit[i]).join("");
    const off = SEG_NAMES.filter((_, i) => !lit[i]).join("") || "—";
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: `decode 0x${state.nibble.toString(16).toUpperCase()} → ${GLYPH[state.nibble]}` },
      { kind: "hi", text: `lit segments: ${on}` },
      { kind: "hi", text: `dark: ${off}` },
      {
        kind: "ok",
        text: `drive abcdefg=${pat} (${state.polarity === "cc" ? "1=ON" : "0=ON"})`,
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("ss-starter").addEventListener("click", loadStarter);
  polSel.addEventListener("change", () => {
    state.polarity = polSel.value;
    state.setPolarity = true;
    state.lastAction = "polarity";
    pushLog("run", `# polarity → ${state.polarity}`);
    renderAll();
  });
  document.getElementById("btn-0").addEventListener("click", () => {
    state.nibble = 0;
    state.lastAction = "preset-0";
    pushLog("ok", "# show 0");
    renderAll();
  });
  document.getElementById("btn-8").addEventListener("click", () => {
    state.nibble = 8;
    state.lastAction = "preset-8";
    pushLog("ok", "# show 8");
    renderAll();
  });
  document.getElementById("btn-1").addEventListener("click", () => {
    state.nibble = 1;
    state.lastAction = "preset-1";
    pushLog("ok", "# show 1");
    renderAll();
  });
  document.getElementById("btn-f").addEventListener("click", () => {
    state.nibble = 0xf;
    state.lastAction = "preset-f";
    pushLog("ok", "# show F");
    renderAll();
  });
  document.getElementById("btn-anode").addEventListener("click", () => {
    state.polarity = "ca";
    state.setPolarity = true;
    state.lastAction = "anode";
    pushLog("ok", "# common anode");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-count",
      title: "Quiz: segments",
      prompt: "A classic digit has how many segments? Answer: <code>7</code>",
      hint: "a–g",
      type: "text",
      answer: "7",
      alt: ["seven"],
    },
    {
      id: "quiz-nibble",
      title: "Quiz: nibble",
      prompt: "Hex digit input width is? Answer: <code>4</code>",
      hint: "nibble",
      type: "text",
      answer: "4",
      alt: ["four", "nibble"],
    },
    {
      id: "quiz-cc",
      title: "Quiz: CC",
      prompt: "Common-cathode active level for ON is? Answer: <code>1</code>",
      hint: "1=ON",
      type: "text",
      answer: "1",
      alt: ["high", "one"],
    },
    {
      id: "quiz-ca",
      title: "Quiz: CA",
      prompt: "Common-anode ON drive bit is usually? Answer: <code>0</code>",
      hint: "active low segments",
      type: "text",
      answer: "0",
      alt: ["low", "zero"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — nibble A, common cathode.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.nibble === 0xa &&
        state.polarity === "cc" &&
        patternFor(0xa, "cc") === "1110111",
    },
    {
      id: "starter-d-off",
      title: "A missing d",
      prompt: "On starter A, segment d should be off (drive bit 0 in CC).",
      hint: "abcdefg … d is 4th bit index 3",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const p = patternFor(state.nibble, "cc");
        return state.nibble === 0xa && p[3] === "0" && p === "1110111";
      },
    },
    {
      id: "show-8",
      title: "All on",
      prompt: "Show 8 — pattern 1111111 (CC).",
      hint: "Show 8 button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.nibble === 8 &&
        state.polarity === "cc" &&
        patternFor(8, "cc") === "1111111",
    },
    {
      id: "show-1",
      title: "Digit 1",
      prompt: "Show 1 — only b and c (0110000 CC).",
      hint: "Show 1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.nibble === 1 && patternFor(1, "cc") === "0110000",
    },
    {
      id: "show-0",
      title: "Digit 0",
      prompt: "Show 0 — g off (1111110 CC).",
      hint: "Show 0",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.nibble === 0 && patternFor(0, "cc") === "1111110",
    },
    {
      id: "show-f",
      title: "Digit F",
      prompt: "Show F — pattern 1000111 (CC).",
      hint: "Show F",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.nibble === 0xf && patternFor(0xf, "cc") === "1000111",
    },
    {
      id: "anode",
      title: "Anode",
      prompt: "Flip to common anode (same glyph, inverted bus).",
      hint: "Flip to common anode",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.polarity === "ca" && state.setPolarity,
    },
    {
      id: "anode-a",
      title: "Anode A",
      prompt: "On A with CA, drive should be 0001000.",
      hint: "Starter then anode",
      type: "state",
      setup: () => {
        loadStarter();
        state.polarity = "ca";
        state.setPolarity = true;
        renderAll();
      },
      check: () =>
        state.nibble === 0xa &&
        state.polarity === "ca" &&
        patternFor(0xa, "ca") === "0001000",
    },
    {
      id: "pick-5",
      title: "Pick 5",
      prompt: "Select glyph 5 from the nibble row.",
      hint: "Click 5",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.nibble === 5 && state.lastAction === "pick",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain decode.",
      hint: "Explain decode",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "quiz-order",
      title: "Quiz: order",
      prompt: "This lab’s bit string order starts with segment? Answer: <code>a</code>",
      hint: "abcdefg",
      type: "text",
      answer: "a",
      alt: ["A"],
    },
    {
      id: "quiz-8",
      title: "Quiz: 8",
      prompt: "Digit that lights all segments? Answer: <code>8</code>",
      hint: "all ones",
      type: "text",
      answer: "8",
      alt: ["eight"],
    },
    {
      id: "b-only",
      title: "b and c",
      prompt: "Which digit uses only b,c? Answer: <code>1</code>",
      hint: "right side",
      type: "text",
      answer: "1",
      alt: ["one"],
    },
    {
      id: "invert-eq",
      title: "Invert eq",
      prompt: "CA pattern for 0 equals NOT of CC 1111110 → 0000001.",
      hint: "Show 0, switch to CA",
      type: "state",
      setup: () => {
        state.nibble = 0;
        state.polarity = "cc";
        renderAll();
      },
      check: () =>
        state.nibble === 0 &&
        state.polarity === "ca" &&
        patternFor(0, "ca") === "0000001",
    },
    {
      id: "glyph-b",
      title: "Glyph b",
      prompt: "Select hex B (lowercase b glyph).",
      hint: "Click b",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.nibble === 0xb && GLYPH[0xb] === "b",
    },
    {
      id: "quiz-rom",
      title: "Quiz: impl",
      prompt: "Decoder is often implemented as a? Answer: <code>ROM</code>",
      hint: "or case statement",
      type: "text",
      answer: "rom",
      alt: ["ROM", "case", "lookup", "lut"],
    },
    {
      id: "g-on-8",
      title: "g on 8",
      prompt: "On digit 8 (CC), g drive bit is 1.",
      hint: "Show 8",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.nibble === 8 &&
        state.polarity === "cc" &&
        patternFor(8, "cc")[6] === "1",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter A → explain (see lit segments without d).",
      hint: "Load starter → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.nibble === 0xa &&
        state.explained &&
        state.lastAction === "explain" &&
        patternFor(0xa, "cc")[3] === "0",
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function renderChallenge() {
    const c = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (clearedIds.length ? ` · ${clearedIds.length} cleared` : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${c.title}.</strong> ${c.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? "Hint: " + c.hint : "";
    const row = document.getElementById("chal-answer-row");
    row.innerHTML = "";
    if (c.type === "text") {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = "chal-input";
      inp.placeholder = "Your answer";
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
      row.appendChild(inp);
    }
    const st = document.getElementById("chal-status");
    st.textContent = isCleared(c.id) ? "Cleared" : "Idle";
    st.className =
      "challenge-status " + (isCleared(c.id) ? "pass" : "idle");

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kbd" + (i === challengeIdx ? " is-active" : "");
      b.textContent = (isCleared(ch.id) ? "✓ " : "") + ch.id;
      b.title = ch.title;
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    const c = CHALLENGES[challengeIdx];
    if (typeof c.setup === "function") c.setup();
    renderChallenge();
    saveSession();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const c = CHALLENGES[challengeIdx];
    const st = document.getElementById("chal-status");
    let ok = false;
    if (c.type === "text") {
      const got = normalizeAns(answerDraft || "");
      const targets = [c.answer, ...(c.alt || [])].map(normalizeAns);
      ok = targets.includes(got);
    } else if (c.type === "state") {
      ok = !!c.check();
    }
    if (ok) {
      markCleared(c.id);
      st.textContent = "Pass";
      st.className = "challenge-status pass";
      pushLog("ok", `# challenge ${c.id} pass`);
    } else {
      st.textContent = "Fail";
      st.className = "challenge-status fail";
      pushLog("warn", `# challenge ${c.id} fail`);
    }
    renderChallenge();
    renderLog();
    saveSession();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
