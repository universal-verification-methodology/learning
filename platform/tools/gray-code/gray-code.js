(() => {
  /**
   * Binary ↔ Gray (reflected binary):
   *   gray  = bin ^ (bin >> 1)
   *   bin   = iterative XOR from MSB
   * Adjacent Gray codes differ by exactly one bit — async FIFO pointers.
   */

  function maskW(w) {
    return (1n << BigInt(w)) - 1n;
  }

  function toGray(bin, w) {
    const b = BigInt(bin) & maskW(w);
    return (b ^ (b >> 1n)) & maskW(w);
  }

  function fromGray(gray, w) {
    let g = BigInt(gray) & maskW(w);
    let b = g;
    for (let i = 1; i < w; i++) {
      b ^= g >> BigInt(i);
    }
    return b & maskW(w);
  }

  function bitsOf(u, w) {
    return (BigInt(u) & maskW(w)).toString(2).padStart(w, "0");
  }

  function popcountXor(a, b) {
    let x = BigInt(a) ^ BigInt(b);
    let n = 0;
    while (x) {
      n += Number(x & 1n);
      x >>= 1n;
    }
    return n;
  }

  function flippedIndices(a, b, w) {
    const ba = bitsOf(a, w);
    const bb = bitsOf(b, w);
    const out = [];
    for (let i = 0; i < w; i++) {
      if (ba[i] !== bb[i]) out.push(w - 1 - i);
    }
    return out;
  }

  function makeStarter() {
    return {
      width: 4,
      bin: 0n,
      lastAction: "",
      convertedToGray: false,
      convertedToBin: false,
      stepped: false,
      comparedStep: false,
      sawSingleBit: false,
      sawMultiBit: false,
      setManual: false,
      log: [],
      formula: [],
      prevBin: null,
      prevGray: null,
    };
  }

  const CLEARED_KEY = "ddv-gray-code-cleared-v1";
  const STORE_KEY = "ddv-gray-code-session-v1";

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

  const root = document.getElementById("gc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Width 4, binary <code>0000</code>.
        Step the counter and compare how many bits flip in binary vs Gray —
        Gray always flips one.</p>
      <button type="button" class="btn btn-secondary" id="gc-starter">Load starter example</button>
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
            <h3>Binary → Gray</h3>
            <p><code>G = B XOR (B &gt;&gt; 1)</code> — each step changes one bit.</p>
          </div>
          <div class="idea-card">
            <h3>Async FIFO</h3>
            <p>Pointers cross clock domains as Gray so metastability hits one bit.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Converter</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Width
              <select id="width-sel">
                <option value="3">3</option>
                <option value="4" selected>4</option>
                <option value="5">5</option>
                <option value="8">8</option>
              </select>
            </label>
            <label>Binary (dec)
              <input id="bin-in" type="text" inputmode="numeric" style="width:5rem" placeholder="0">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-set-bin" style="padding:0.3rem 0.55rem;font-size:0.8rem">Set</button>
          </div>
          <div class="pair-grid">
            <div class="pair-card">
              <span class="lbl">Binary</span>
              <div class="bits-row" id="bin-bits"></div>
              <div id="bin-meta"></div>
            </div>
            <div class="pair-card">
              <span class="lbl">Gray</span>
              <div class="bits-row" id="gray-bits"></div>
              <div id="gray-meta"></div>
            </div>
          </div>
          <p class="diff-row" id="diff-row"></p>
          <div class="action-grid" style="margin-top:0.65rem">
            <button type="button" id="btn-step">Step +1 (bin count)</button>
            <button type="button" id="btn-step-back">Step −1</button>
            <button type="button" id="btn-show-formula">Show convert formula</button>
            <button type="button" id="btn-from-gray">Decode Gray → binary (verify)</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Formula trace</h3>
          <pre class="formula-box" id="formula-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Sequence (bin count → Gray)</h2></div>
        <div class="panel-body">
          <div class="seq-wrap">
            <table class="seq-table">
              <thead>
                <tr><th>#</th><th>Binary</th><th>Gray</th><th>Δbin</th><th>Δgray</th></tr>
              </thead>
              <tbody id="seq-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Op</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>To Gray</td><td><code>G = B ^ (B &gt;&gt; 1)</code></td></tr>
            <tr><td>To binary</td><td>MSB same; each lower bit = XOR of Gray bit and already-decoded higher binary</td></tr>
            <tr><td>Property</td><td>Adjacent codes differ by <strong>one</strong> bit</td></tr>
            <tr><td>FIFO</td><td>Gray pointers survive CDC better than binary</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Binary 7→8 can flip many bits; Gray flips one.</li>
          <li>Reflected Gray is the usual async-FIFO encoding.</li>
          <li>Always convert Gray→binary before arithmetic.</li>
        </ul>
      </div>
    </div>
  `;

  const widthSel = document.getElementById("width-sel");
  const binIn = document.getElementById("bin-in");
  const binBits = document.getElementById("bin-bits");
  const grayBits = document.getElementById("gray-bits");
  const binMeta = document.getElementById("bin-meta");
  const grayMeta = document.getElementById("gray-meta");
  const diffRow = document.getElementById("diff-row");
  const formulaBox = document.getElementById("formula-box");
  const logBox = document.getElementById("log-box");
  const seqBody = document.getElementById("seq-body");

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

  function grayNow() {
    return toGray(state.bin, state.width);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state: {
            ...state,
            bin: state.bin.toString(),
            prevBin: state.prevBin == null ? null : state.prevBin.toString(),
            prevGray: state.prevGray == null ? null : state.prevGray.toString(),
          },
          challengeIdx,
        })
      );
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
      state.bin = BigInt(data.state.bin);
      state.prevBin = data.state.prevBin == null ? null : BigInt(data.state.prevBin);
      state.prevGray = data.state.prevGray == null ? null : BigInt(data.state.prevGray);
      challengeIdx = Number(data.challengeIdx) || 0;
      widthSel.value = String(state.width);
      return true;
    } catch {
      return false;
    }
  }

  function renderBitRow(el, value, w, flipSet) {
    const bin = bitsOf(value, w);
    el.innerHTML = "";
    for (let i = 0; i < w; i++) {
      const bitIndex = w - 1 - i;
      const span = document.createElement("span");
      span.className = "bit";
      span.textContent = bin[i];
      if (bin[i] === "1") span.classList.add("is-one");
      if (flipSet && flipSet.has(bitIndex)) span.classList.add("flipped");
      el.appendChild(span);
    }
  }

  function renderConverter() {
    const w = state.width;
    const g = grayNow();
    const flipBin =
      state.prevBin == null
        ? null
        : new Set(flippedIndices(state.prevBin, state.bin, w));
    const flipGray =
      state.prevGray == null
        ? null
        : new Set(flippedIndices(state.prevGray, g, w));

    renderBitRow(binBits, state.bin, w, flipBin);
    renderBitRow(grayBits, g, w, flipGray);
    binMeta.textContent = `dec ${state.bin} · 0x${state.bin.toString(16).toUpperCase()}`;
    grayMeta.textContent = `dec ${g} · 0x${g.toString(16).toUpperCase()}`;
    binIn.value = String(state.bin);

    if (state.prevBin == null) {
      diffRow.innerHTML = "<strong>Δ:</strong> step once to compare bit flips";
    } else {
      const db = popcountXor(state.prevBin, state.bin);
      const dg = popcountXor(state.prevGray, g);
      diffRow.innerHTML = `<strong>Δ bits:</strong> binary flipped <strong>${db}</strong> · Gray flipped <strong>${dg}</strong>${
        dg === 1 ? " ✓" : ""
      }`;
      if (dg === 1) state.sawSingleBit = true;
      if (db > 1) state.sawMultiBit = true;
      state.comparedStep = true;
    }
  }

  function renderFormula() {
    if (!state.formula.length) {
      formulaBox.innerHTML = '<span class="muted">(show convert formula)</span>';
      return;
    }
    formulaBox.innerHTML = state.formula
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

  function renderSeq() {
    const w = state.width;
    const n = 1 << w;
    const rows = [];
    let prevB = null;
    let prevG = null;
    for (let i = 0; i < n; i++) {
      const b = BigInt(i);
      const g = toGray(b, w);
      const db = prevB == null ? "—" : String(popcountXor(prevB, b));
      const dg = prevG == null ? "—" : String(popcountXor(prevG, g));
      const cur = b === state.bin;
      rows.push(`<tr class="${cur ? "is-cur" : ""}">
        <td>${i}</td>
        <td>${bitsOf(b, w)}</td>
        <td>${bitsOf(g, w)}</td>
        <td class="${db !== "—" && Number(db) > 1 ? "flip" : ""}">${db}</td>
        <td class="${dg === "1" ? "" : dg !== "—" ? "flip" : ""}">${dg}</td>
      </tr>`);
      prevB = b;
      prevG = g;
    }
    // wrap from last to 0
    const wrapDb = popcountXor(BigInt(n - 1), 0n);
    const wrapDg = popcountXor(toGray(BigInt(n - 1), w), toGray(0n, w));
    rows.push(`<tr>
      <td>wrap</td>
      <td colspan="2" style="color:var(--muted)">last → 0</td>
      <td class="${wrapDb > 1 ? "flip" : ""}">${wrapDb}</td>
      <td>${wrapDg}</td>
    </tr>`);
    seqBody.innerHTML = rows.join("");
  }

  function renderAll() {
    widthSel.value = String(state.width);
    renderConverter();
    renderFormula();
    renderLog();
    renderSeq();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: w=4, bin=0 — step to see Gray single-bit property");
    state.formula = [];
    renderAll();
  }

  function setBin(raw) {
    const w = state.width;
    let n;
    try {
      n = BigInt(String(raw).trim());
    } catch {
      pushLog("warn", "# invalid number");
      renderAll();
      return;
    }
    state.prevBin = state.bin;
    state.prevGray = grayNow();
    state.bin = n & maskW(w);
    state.setManual = true;
    state.lastAction = "set";
    state.convertedToGray = true;
    pushLog("ok", `# set bin=${state.bin} gray=${toGray(state.bin, w)}`);
    renderAll();
  }

  function step(dir) {
    const w = state.width;
    const mod = 1n << BigInt(w);
    state.prevBin = state.bin;
    state.prevGray = grayNow();
    state.bin = (state.bin + BigInt(dir) + mod) % mod;
    state.stepped = true;
    state.lastAction = dir > 0 ? "step" : "step-back";
    state.convertedToGray = true;
    const g = grayNow();
    const db = popcountXor(state.prevBin, state.bin);
    const dg = popcountXor(state.prevGray, g);
    pushLog(
      "run",
      `# step ${dir > 0 ? "+1" : "−1"}: bin ${bitsOf(state.prevBin, w)}→${bitsOf(state.bin, w)} (Δ${db}) · gray Δ${dg}`
    );
    if (dg === 1) state.sawSingleBit = true;
    if (db > 1) state.sawMultiBit = true;
    state.comparedStep = true;
    renderAll();
  }

  function showFormula() {
    const w = state.width;
    const b = state.bin;
    const g = toGray(b, w);
    state.convertedToGray = true;
    state.lastAction = "formula";
    state.formula = [
      { kind: "muted", text: `Binary → Gray  (w=${w})` },
      { kind: "hi", text: `B      = ${bitsOf(b, w)}` },
      { kind: "hi", text: `B>>1   = ${bitsOf(b >> 1n, w)}` },
      { kind: "ok", text: `G=B^(B>>1) = ${bitsOf(g, w)}` },
    ];
    pushLog("ok", `# formula: gray=${bitsOf(g, w)}`);
    renderAll();
  }

  function decodeVerify() {
    const w = state.width;
    const g = grayNow();
    const b = fromGray(g, w);
    state.convertedToBin = true;
    state.lastAction = "decode";
    state.formula = [
      { kind: "muted", text: `Gray → Binary verify` },
      { kind: "hi", text: `G = ${bitsOf(g, w)}` },
      { kind: "ok", text: `B = ${bitsOf(b, w)}  (match count ${b === state.bin ? "yes" : "NO"})` },
    ];
    pushLog(b === state.bin ? "ok" : "warn", `# decode gray → ${b}`);
    renderAll();
  }

  document.getElementById("gc-starter").addEventListener("click", loadStarter);
  widthSel.addEventListener("change", () => {
    state.width = Number(widthSel.value);
    state.bin = state.bin & maskW(state.width);
    state.prevBin = null;
    state.prevGray = null;
    state.lastAction = "width";
    pushLog("run", `# width → ${state.width}`);
    renderAll();
  });
  document.getElementById("btn-set-bin").addEventListener("click", () => setBin(binIn.value));
  binIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setBin(binIn.value);
  });
  document.getElementById("btn-step").addEventListener("click", () => step(1));
  document.getElementById("btn-step-back").addEventListener("click", () => step(-1));
  document.getElementById("btn-show-formula").addEventListener("click", showFormula);
  document.getElementById("btn-from-gray").addEventListener("click", decodeVerify);

  const CHALLENGES = [
    {
      id: "quiz-formula",
      title: "Quiz: to Gray",
      prompt: "Binary→Gray formula? Answer: <code>B^(B>>1)</code>",
      hint: "XOR with shift",
      type: "text",
      answer: "b^(b>>1)",
      alt: ["b ^ (b >> 1)", "b xor (b>>1)", "g=b^(b>>1)", "xor shift"],
    },
    {
      id: "quiz-one-bit",
      title: "Quiz: property",
      prompt: "Adjacent Gray codes flip how many bits? Answer: <code>1</code>",
      hint: "single",
      type: "text",
      answer: "1",
      alt: ["one", "1 bit"],
    },
    {
      id: "quiz-fifo",
      title: "Quiz: FIFO",
      prompt: "Async FIFO pointers prefer? Answer: <code>gray</code>",
      hint: "CDC",
      type: "text",
      answer: "gray",
      alt: ["gray code", "grey", "grey code"],
    },
    {
      id: "quiz-arith",
      title: "Quiz: math",
      prompt: "Do arithmetic on Gray bits directly? Answer: <code>no</code>",
      hint: "decode first",
      type: "text",
      answer: "no",
      alt: ["n", "false", "never"],
    },
    {
      id: "starter-zero",
      title: "Starter 0",
      prompt: "Load starter — width 4, binary 0, Gray 0.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 4 && state.bin === 0n && toGray(0n, 4) === 0n,
    },
    {
      id: "step-once",
      title: "Step once",
      prompt: "Step +1 from 0 — Gray flips exactly one bit.",
      hint: "Step +1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.stepped &&
        state.bin === 1n &&
        state.sawSingleBit,
    },
    {
      id: "show-formula",
      title: "Show formula",
      prompt: "Click Show convert formula for current binary.",
      hint: "formula button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "formula" && state.formula.length > 0,
    },
    {
      id: "decode-ok",
      title: "Decode verify",
      prompt: "Run Gray→binary verify — matches current count.",
      hint: "Decode button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.convertedToBin &&
        fromGray(toGray(state.bin, state.width), state.width) === state.bin,
    },
    {
      id: "set-7",
      title: "Set 7",
      prompt: "Width 4: set binary 7 — Gray should be 0100.",
      hint: "Set 7",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 4 &&
        state.bin === 7n &&
        toGray(7n, 4) === 0x4n,
    },
    {
      id: "seven-to-eight",
      title: "7→8 multi flip",
      prompt: "From 7, step +1 to 8 — binary flips &gt;1 bits; Gray flips 1.",
      hint: "set 7 → step",
      type: "state",
      setup: () => {
        loadStarter();
        setBin(7);
        state.stepped = false;
        state.sawMultiBit = false;
        state.sawSingleBit = false;
      },
      check: () =>
        state.bin === 8n &&
        state.sawMultiBit &&
        state.sawSingleBit,
    },
    {
      id: "quiz-3bit-1",
      title: "Quiz: Gray of 1",
      prompt: "3-bit binary 001 → Gray? Answer: <code>001</code>",
      hint: "1^(0)=1",
      type: "text",
      answer: "001",
      alt: ["1", "0b001"],
    },
    {
      id: "width3-step",
      title: "Width 3 tour",
      prompt: "Set width 3 and step at least once.",
      hint: "width 3 → step",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.width === 3 && state.stepped,
    },
    {
      id: "wrap-gray",
      title: "Wrap still one",
      prompt: "Width 4: go to 15, step +1 → 0; Gray Δ is 1.",
      hint: "set 15 → step",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (state.width !== 4 || state.bin !== 0n || state.prevBin !== 15n) return false;
        return popcountXor(state.prevGray, grayNow()) === 1;
      },
    },
    {
      id: "quiz-gray-of-2",
      title: "Quiz: Gray of 2",
      prompt: "4-bit binary 0010 → Gray? Answer: <code>0011</code>",
      hint: "2^(1)=3",
      type: "text",
      answer: "0011",
      alt: ["3", "0b0011"],
    },
    {
      id: "manual-set",
      title: "Manual set",
      prompt: "Set any binary via the Set control (not only step).",
      hint: "type + Set",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setManual,
    },
    {
      id: "step-back",
      title: "Step back",
      prompt: "From starter, step +1 then step −1 back to 0.",
      hint: "+1 then −1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.bin === 0n &&
        state.lastAction === "step-back" &&
        state.stepped,
    },
    {
      id: "quiz-cdc",
      title: "Quiz: why Gray",
      prompt: "Gray helps because only ___ bit may be metastable. Answer: <code>one</code>",
      hint: "one bit",
      type: "text",
      answer: "one",
      alt: ["1", "a single", "single"],
    },
    {
      id: "compare-deltas",
      title: "Compare deltas",
      prompt: "After any step, comparedStep true and sawSingleBit.",
      hint: "Step +1",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.comparedStep && state.sawSingleBit,
    },
    {
      id: "encode-5",
      title: "Encode 5",
      prompt: "Width 4: binary 5 → Gray 0111.",
      hint: "Set 5",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 4 &&
        state.bin === 5n &&
        toGray(5n, 4) === 0x7n,
    },
    {
      id: "roundtrip",
      title: "Round-trip",
      prompt: "Set 10 (w=4), show formula, decode verify — bin stays 10.",
      hint: "set 10 → formula → decode",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.bin === 10n &&
        state.convertedToGray &&
        state.convertedToBin &&
        fromGray(toGray(10n, 4), 4) === 10n,
    },
    {
      id: "quiz-reflect",
      title: "Quiz: name",
      prompt: "Common name for this Gray? Answer: <code>reflected</code>",
      hint: "reflected binary",
      type: "text",
      answer: "reflected",
      alt: ["reflected binary", "binary reflected"],
    },
    {
      id: "full-insight",
      title: "Full insight",
      prompt: "See multi-bit binary flip and single-bit Gray (e.g. 7→8), plus formula.",
      hint: "7→8 and formula",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sawMultiBit &&
        state.sawSingleBit &&
        state.formula.length > 0,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/⊕/g, "^")
      .replace(/xor/g, "^");
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent =
      `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint
      ? "Hide hint"
      : "Show hint";
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:14rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use Gray converter, then Check.</span>`;
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
    saveSession();
  }

  function checkChallenge() {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const ans = normalizeAns(document.getElementById("chal-ans")?.value || "");
      const want = [ch.answer, ...(ch.alt || [])].map(normalizeAns);
      ok = want.includes(ans);
    } else {
      try {
        ok = !!ch.check();
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

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
