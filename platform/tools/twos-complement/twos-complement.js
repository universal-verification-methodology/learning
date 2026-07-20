(() => {
  /**
   * Two’s complement:
   *   range [−2^(w−1), 2^(w−1)−1]
   *   negate = invert bits + 1 (mod 2^w)
   *   wrap = asIntN / modular interpretation
   */

  function maskW(w) {
    return (1n << BigInt(w)) - 1n;
  }

  function toSigned(u, w) {
    const m = maskW(w);
    const v = BigInt(u) & m;
    const sign = 1n << BigInt(w - 1);
    return v & sign ? v - (m + 1n) : v;
  }

  function toUnsigned(s, w) {
    return BigInt.asUintN(w, BigInt(s));
  }

  function bitsOf(u, w) {
    const v = BigInt(u) & maskW(w);
    return v.toString(2).padStart(w, "0");
  }

  function invert(u, w) {
    return (~BigInt(u)) & maskW(w);
  }

  function negate(u, w) {
    return (invert(u, w) + 1n) & maskW(w);
  }

  function makeStarter() {
    return {
      width: 8,
      bits: 0x05n, // +5
      lastAction: "",
      lastOverflow: false,
      didNegate: false,
      didInvert: false,
      setMin: false,
      setMax: false,
      setNeg1: false,
      wrapped: false,
      toggledMsb: false,
      log: [],
      steps: [],
    };
  }

  const CLEARED_KEY = "ddv-twos-complement-cleared-v1";
  const STORE_KEY = "ddv-twos-complement-session-v1";

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

  const root = document.getElementById("tc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Width 8, pattern for <code>+5</code>
        (<code>0000_0101</code>). Negate to see invert+1 → <code>−5</code>.
        Try min/max and a value that wraps.</p>
      <button type="button" class="btn btn-secondary" id="tc2-starter">Load starter example</button>
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
            <h3>Signed range</h3>
            <p>Width <code>w</code>: from <code>−2^(w−1)</code> to <code>2^(w−1)−1</code>.</p>
          </div>
          <div class="idea-card">
            <h3>Negate</h3>
            <p>Bitwise invert, then add 1 (mod <code>2^w</code>). All ones is <code>−1</code>.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Bit pattern</h2></div>
        <div class="panel-body">
          <div class="width-row">
            <label>Width
              <select id="width-sel">
                <option value="4">4</option>
                <option value="8" selected>8</option>
                <option value="16">16</option>
              </select>
            </label>
            <label>Signed decimal
              <input id="signed-in" type="text" inputmode="numeric" placeholder="e.g. -5" style="width:6rem">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-apply-signed" style="padding:0.3rem 0.55rem;font-size:0.8rem">Apply</button>
          </div>
          <div class="range-bar" id="range-bar"></div>
          <div class="bits-row" id="bits-row"></div>
          <div class="vals-grid">
            <div class="val-card" id="card-u"><span class="lbl">Unsigned</span><span class="num" id="val-u"></span></div>
            <div class="val-card" id="card-s"><span class="lbl">Signed (two’s)</span><span class="num" id="val-s"></span></div>
            <div class="val-card"><span class="lbl">Hex</span><span class="num" id="val-h"></span></div>
            <div class="val-card"><span class="lbl">Binary</span><span class="num" id="val-b"></span></div>
          </div>
          <div class="preset-row">
            <button type="button" data-p="0">0</button>
            <button type="button" data-p="1">+1</button>
            <button type="button" data-p="-1">−1</button>
            <button type="button" data-p="min">min</button>
            <button type="button" data-p="max">max</button>
            <button type="button" data-p="5">+5</button>
            <button type="button" data-p="-5">−5</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Ops</h2></div>
        <div class="panel-body">
          <div class="action-grid">
            <button type="button" id="btn-invert">Invert bits (~)</button>
            <button type="button" id="btn-negate">Negate (invert + 1)</button>
            <button type="button" id="btn-inc">+1 (wrap)</button>
            <button type="button" id="btn-dec">−1 (wrap)</button>
            <button type="button" id="btn-wrap-demo">Force signed 200 @ width 8 (wrap)</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Negate steps</h3>
          <pre class="step-box" id="step-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
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
            <tr><td>MSB</td><td>Sign bit — 1 means negative (for two’s complement)</td></tr>
            <tr><td>Range (w=8)</td><td>−128 … +127</td></tr>
            <tr><td>−x</td><td>~x + 1 (mod 2^w)</td></tr>
            <tr><td>All ones</td><td>Always −1</td></tr>
            <tr><td>Min negate</td><td>−(−2^(w−1)) wraps back to the same pattern</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Unsigned and signed share the same bits — interpretation differs.</li>
          <li>Out-of-range signed input wraps with <code>asUintN</code> / modular mask.</li>
          <li>HDL <code>signed</code> arithmetic uses this encoding.</li>
        </ul>
      </div>
    </div>
  `;

  const bitsRow = document.getElementById("bits-row");
  const rangeBar = document.getElementById("range-bar");
  const stepBox = document.getElementById("step-box");
  const logBox = document.getElementById("log-box");
  const widthSel = document.getElementById("width-sel");
  const signedIn = document.getElementById("signed-in");

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

  function setSteps(lines) {
    state.steps = lines;
  }

  function rangeMin(w) {
    return -(1n << BigInt(w - 1));
  }

  function rangeMax(w) {
    return (1n << BigInt(w - 1)) - 1n;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state: { ...state, bits: state.bits.toString() },
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
      state.bits = BigInt(data.state.bits);
      challengeIdx = Number(data.challengeIdx) || 0;
      widthSel.value = String(state.width);
      return true;
    } catch {
      return false;
    }
  }

  function renderBits() {
    const w = state.width;
    const bin = bitsOf(state.bits, w);
    bitsRow.innerHTML = "";
    for (let i = w - 1; i >= 0; i--) {
      const bit = bin[w - 1 - i];
      const cell = document.createElement("div");
      cell.className = "bit-cell";
      const idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = String(i);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = bit;
      if (bit === "1") btn.classList.add("is-one");
      if (i === w - 1) btn.classList.add("is-sign");
      btn.title = i === w - 1 ? "MSB / sign" : `bit ${i}`;
      btn.addEventListener("click", () => toggleBit(i));
      cell.appendChild(idx);
      cell.appendChild(btn);
      bitsRow.appendChild(cell);
    }
  }

  function renderVals() {
    const w = state.width;
    const u = state.bits & maskW(w);
    const s = toSigned(u, w);
    document.getElementById("val-u").textContent = String(u);
    const sEl = document.getElementById("val-s");
    sEl.textContent = String(s);
    document.getElementById("card-s").classList.toggle("neg", s < 0n);
    document.getElementById("card-s").classList.toggle("wrap-warn", state.lastOverflow);
    document.getElementById("val-h").textContent =
      "0x" + u.toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0");
    document.getElementById("val-b").textContent = bitsOf(u, w).replace(/(.{4})(?=.)/g, "$1_");
    signedIn.value = String(s);
    rangeBar.textContent = `range w=${w}: [${rangeMin(w)} … ${rangeMax(w)}]`;
  }

  function renderSteps() {
    if (!state.steps.length) {
      stepBox.innerHTML = '<span class="muted">(negate to see invert + 1)</span>';
      return;
    }
    stepBox.innerHTML = state.steps
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no ops yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll() {
    widthSel.value = String(state.width);
    renderBits();
    renderVals();
    renderSteps();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    setSteps([]);
    pushLog("muted", "# starter: w=8, bits=0000_0101 (+5 signed)");
    renderAll();
  }

  function setWidth(w) {
    state.width = w;
    state.bits = state.bits & maskW(w);
    state.lastAction = "width";
    state.lastOverflow = false;
    pushLog("run", `# width → ${w}`);
    renderAll();
  }

  function setBits(u, opts = {}) {
    const w = state.width;
    const next = BigInt(u) & maskW(w);
    state.bits = next;
    if (opts.overflow) state.lastOverflow = true;
    else if (!opts.keepOverflow) state.lastOverflow = false;
    renderAll();
  }

  function applySigned(raw) {
    const w = state.width;
    let n;
    try {
      n = BigInt(String(raw).trim().replace(/^\+/, ""));
    } catch {
      pushLog("warn", "# invalid signed decimal");
      renderAll();
      return;
    }
    const min = rangeMin(w);
    const max = rangeMax(w);
    const wrapped = n < min || n > max;
    const u = toUnsigned(n, w);
    state.lastAction = "apply-signed";
    if (wrapped) {
      state.wrapped = true;
      state.lastOverflow = true;
      pushLog("warn", `# ${n} out of [${min}…${max}] → wrap to bits ${bitsOf(u, w)}`);
    } else {
      pushLog("ok", `# set signed ${n}`);
    }
    if (n === min) state.setMin = true;
    if (n === max) state.setMax = true;
    if (n === -1n) state.setNeg1 = true;
    setBits(u, { overflow: wrapped, keepOverflow: true });
  }

  function toggleBit(i) {
    const w = state.width;
    const bit = 1n << BigInt(i);
    state.bits = state.bits ^ bit;
    state.lastAction = "toggle";
    if (i === w - 1) state.toggledMsb = true;
    state.lastOverflow = false;
    pushLog("run", `# toggle bit ${i}`);
    renderAll();
  }

  function doInvert() {
    const w = state.width;
    const before = bitsOf(state.bits, w);
    const after = invert(state.bits, w);
    state.didInvert = true;
    state.lastAction = "invert";
    setSteps([
      { kind: "muted", text: `invert ~` },
      { kind: "hi", text: `  ${before}` },
      { kind: "ok", text: `→ ${bitsOf(after, w)}` },
    ]);
    pushLog("run", "# invert bits");
    setBits(after);
  }

  function doNegate() {
    const w = state.width;
    const before = state.bits;
    const inv = invert(before, w);
    const after = negate(before, w);
    state.didNegate = true;
    state.lastAction = "negate";
    setSteps([
      { kind: "muted", text: `negate (−x) at w=${w}` },
      { kind: "hi", text: `x   ${bitsOf(before, w)}  (${toSigned(before, w)})` },
      { kind: "hi", text: `~x  ${bitsOf(inv, w)}` },
      { kind: "ok", text: `+1  ${bitsOf(after, w)}  (${toSigned(after, w)})` },
    ]);
    pushLog("ok", `# negate → ${toSigned(after, w)}`);
    setBits(after);
  }

  function doInc() {
    const w = state.width;
    const next = (state.bits + 1n) & maskW(w);
    state.lastAction = "inc";
    if (state.bits === maskW(w)) {
      state.wrapped = true;
      state.lastOverflow = true;
      pushLog("warn", "# +1 wrapped through all-ones");
    } else pushLog("run", "# +1");
    setBits(next, { keepOverflow: true });
  }

  function doDec() {
    const w = state.width;
    const next = (state.bits - 1n) & maskW(w);
    state.lastAction = "dec";
    if (state.bits === 0n) {
      state.wrapped = true;
      state.lastOverflow = true;
      pushLog("warn", "# −1 wrapped under zero (unsigned view)");
    } else pushLog("run", "# −1");
    setBits(next, { keepOverflow: true });
  }

  function wrapDemo() {
    state.width = 8;
    widthSel.value = "8";
    state.wrapped = true;
    state.lastAction = "wrap-demo";
    applySigned(200);
  }

  document.getElementById("tc2-starter").addEventListener("click", loadStarter);
  widthSel.addEventListener("change", () => setWidth(Number(widthSel.value)));
  document.getElementById("btn-apply-signed").addEventListener("click", () => {
    applySigned(signedIn.value);
  });
  signedIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applySigned(signedIn.value);
  });
  document.getElementById("btn-invert").addEventListener("click", doInvert);
  document.getElementById("btn-negate").addEventListener("click", doNegate);
  document.getElementById("btn-inc").addEventListener("click", doInc);
  document.getElementById("btn-dec").addEventListener("click", doDec);
  document.getElementById("btn-wrap-demo").addEventListener("click", wrapDemo);

  document.querySelectorAll(".preset-row button").forEach((b) => {
    b.addEventListener("click", () => {
      const p = b.getAttribute("data-p");
      const w = state.width;
      if (p === "min") applySigned(rangeMin(w));
      else if (p === "max") applySigned(rangeMax(w));
      else applySigned(p);
    });
  });

  const CHALLENGES = [
    {
      id: "quiz-msb",
      title: "Quiz: MSB",
      prompt: "In two’s complement, the MSB is the? Answer: <code>sign</code>",
      hint: "sign bit",
      type: "text",
      answer: "sign",
      alt: ["sign bit", "the sign"],
    },
    {
      id: "quiz-neg1",
      title: "Quiz: all ones",
      prompt: "All-ones pattern signed value? Answer: <code>-1</code>",
      hint: "any width",
      type: "text",
      answer: "-1",
      alt: ["−1"],
    },
    {
      id: "quiz-negate",
      title: "Quiz: negate",
      prompt: "Negate steps? Answer: <code>invert + 1</code>",
      hint: "two steps",
      type: "text",
      answer: "invert + 1",
      alt: ["invert+1", "~x + 1", "invert then add 1", "~ + 1"],
    },
    {
      id: "quiz-range8",
      title: "Quiz: 8-bit min",
      prompt: "8-bit two’s min? Answer: <code>-128</code>",
      hint: "−2^7",
      type: "text",
      answer: "-128",
      alt: ["−128"],
    },
    {
      id: "starter-plus5",
      title: "Starter +5",
      prompt: "Load starter — signed is +5, bits end with 0101.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 8 &&
        state.bits === 0x05n &&
        toSigned(state.bits, 8) === 5n,
    },
    {
      id: "negate-5",
      title: "Negate +5",
      prompt: "From +5, Negate → signed −5 (0xFB).",
      hint: "Negate button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.didNegate &&
        state.bits === 0xfbn &&
        toSigned(state.bits, 8) === -5n,
    },
    {
      id: "set-neg1",
      title: "Set −1",
      prompt: "Width 8: set signed −1 (preset or apply).",
      hint: "−1 preset",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 8 && state.bits === 0xffn && toSigned(state.bits, 8) === -1n,
    },
    {
      id: "set-min",
      title: "Set min",
      prompt: "Width 8: set min (−128).",
      hint: "min preset",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 8 &&
        state.bits === 0x80n &&
        toSigned(state.bits, 8) === -128n,
    },
    {
      id: "set-max",
      title: "Set max",
      prompt: "Width 8: set max (+127).",
      hint: "max preset",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 8 &&
        state.bits === 0x7fn &&
        toSigned(state.bits, 8) === 127n,
    },
    {
      id: "wrap-200",
      title: "Wrap 200",
      prompt: "Force signed 200 @ width 8 — wraps; bits 0xC8.",
      hint: "Force wrap button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.wrapped &&
        state.lastOverflow &&
        state.width === 8 &&
        state.bits === 0xc8n,
    },
    {
      id: "width4-neg",
      title: "Width 4 −1",
      prompt: "Width 4, set −1 — bits 1111.",
      hint: "width 4 → −1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 4 && state.bits === 0xfn && toSigned(state.bits, 4) === -1n,
    },
    {
      id: "quiz-max8",
      title: "Quiz: 8-bit max",
      prompt: "8-bit two’s max? Answer: <code>127</code>",
      hint: "2^7 − 1",
      type: "text",
      answer: "127",
      alt: ["+127"],
    },
    {
      id: "invert-then",
      title: "Invert +5",
      prompt: "From starter +5, Invert — pattern 1111_1010 (not yet −5).",
      hint: "Invert only",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.didInvert && state.bits === 0xfan,
    },
    {
      id: "msb-toggle",
      title: "Toggle MSB",
      prompt: "From +5, toggle bit 7 — signed becomes negative.",
      hint: "click leftmost bit",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.toggledMsb &&
        toSigned(state.bits, state.width) < 0n &&
        (state.bits & 0x80n) !== 0n,
    },
    {
      id: "min-negate",
      title: "Negate min",
      prompt: "Set min (−128), Negate — pattern stays 0x80 (wrap).",
      hint: "min → Negate",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.didNegate &&
        state.setMin &&
        state.bits === 0x80n &&
        toSigned(state.bits, 8) === -128n,
    },
    {
      id: "inc-wrap",
      title: "+1 from −1",
      prompt: "Set −1, then +1 — become 0.",
      hint: "−1 → +1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "inc" &&
        state.bits === 0n &&
        toSigned(state.bits, state.width) === 0n,
    },
    {
      id: "quiz-range4",
      title: "Quiz: 4-bit range",
      prompt: "4-bit signed range low? Answer: <code>-8</code>",
      hint: "−2^3",
      type: "text",
      answer: "-8",
      alt: ["−8"],
    },
    {
      id: "encode-neg5",
      title: "Encode −5",
      prompt: "Apply signed −5 at width 8 without relying on Negate from +5.",
      hint: "type -5 → Apply",
      type: "state",
      setup: () => {
        loadStarter();
        state.bits = 0n;
        state.didNegate = false;
        renderAll();
      },
      check: () =>
        state.width === 8 &&
        state.bits === 0xfbn &&
        toSigned(state.bits, 8) === -5n,
    },
    {
      id: "width16-neg1",
      title: "16-bit −1",
      prompt: "Width 16, set −1 — hex FFFF.",
      hint: "width 16 → −1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 16 && state.bits === 0xffffn,
    },
    {
      id: "quiz-same-bits",
      title: "Quiz: same bits",
      prompt: "Unsigned and signed share the same bit pattern? Answer: <code>yes</code>",
      hint: "interpretation",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "dec-from-0",
      title: "−1 from 0",
      prompt: "From 0, press −1 — become all ones (−1 signed).",
      hint: "0 preset → −1 button",
      type: "state",
      setup: () => {
        loadStarter();
        applySigned(0);
      },
      check: () =>
        state.lastAction === "dec" &&
        state.bits === maskW(state.width) &&
        toSigned(state.bits, state.width) === -1n,
    },
    {
      id: "full-story",
      title: "Full story",
      prompt: "Negate +5→−5, set min, and trigger a wrap (200 or ±1 edge).",
      hint: "negate, min, wrap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.didNegate &&
        state.setMin &&
        state.wrapped &&
        toSigned(0xfbn, 8) === -5n,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/−/g, "-");
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use bit ops, then Check.</span>`;
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
