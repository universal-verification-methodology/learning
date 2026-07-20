(() => {
  /**
   * Lab Qm.n (signed two’s complement):
   *   total width W = m + n
   *   m = integer bits INCLUDING sign
   *   n = fractional bits
   *   value = signed_raw / 2^n
   *   step  = 2^(-n)
   *   range ≈ [−2^(m−1), 2^(m−1) − 2^(−n)]
   */

  function widthOf(m, n) {
    return m + n;
  }

  function maskW(w) {
    return (1n << BigInt(w)) - 1n;
  }

  function toSigned(u, w) {
    const v = BigInt(u) & maskW(w);
    const sign = 1n << BigInt(w - 1);
    return v & sign ? v - (maskW(w) + 1n) : v;
  }

  function toUnsigned(s, w) {
    return BigInt.asUintN(w, BigInt(s));
  }

  function bitsOf(u, w) {
    return (BigInt(u) & maskW(w)).toString(2).padStart(w, "0");
  }

  function step(n) {
    return 2 ** -n;
  }

  function rangeMin(m) {
    return -(2 ** (m - 1));
  }

  function rangeMax(m, n) {
    return 2 ** (m - 1) - 2 ** -n;
  }

  function decode(raw, m, n) {
    const w = widthOf(m, n);
    const s = toSigned(raw, w);
    return Number(s) / 2 ** n;
  }

  function encode(real, m, n) {
    const w = widthOf(m, n);
    const min = rangeMin(m);
    const max = rangeMax(m, n);
    let sat = false;
    let x = real;
    if (x < min) {
      x = min;
      sat = true;
    } else if (x > max) {
      x = max;
      sat = true;
    }
    const scaled = Math.round(x * 2 ** n);
    const raw = toUnsigned(BigInt(scaled), w);
    return { raw, sat, value: decode(raw, m, n) };
  }

  function makeStarter() {
    // Q4.4: m=4,n=4, W=8 — raw 0x18 = 24 → 24/16 = 1.5
    return {
      m: 4,
      n: 4,
      raw: 0x18n,
      lastAction: "",
      lastSat: false,
      encoded: false,
      decoded: false,
      setFormat: false,
      sawBinaryPoint: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-fixed-point-cleared-v1";
  const STORE_KEY = "ddv-fixed-point-session-v1";

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

  const root = document.getElementById("fp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>Q4.4</code> (8 bits). Pattern
        <code>0001_1000</code> is raw 24 → real <code>1.5</code>
        (<code>24 / 2^4</code>). Move the binary point by changing <code>n</code>.</p>
      <button type="button" class="btn btn-secondary" id="fp-starter">Load starter example</button>
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
            <h3>Qm.n</h3>
            <p><code>m</code> integer bits (incl. sign) + <code>n</code> fraction bits. Scale <code>2^(−n)</code>.</p>
          </div>
          <div class="idea-card">
            <h3>Decode</h3>
            <p>Real = signed raw integer ÷ <code>2^n</code>. Encode multiplies then rounds.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Format &amp; bits</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>m (int+sign)
              <select id="m-sel">
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4" selected>4</option>
                <option value="5">5</option>
                <option value="8">8</option>
              </select>
            </label>
            <label>n (frac)
              <select id="n-sel">
                <option value="0">0</option>
                <option value="2">2</option>
                <option value="4" selected>4</option>
                <option value="8">8</option>
                <option value="15">15</option>
              </select>
            </label>
          </div>
          <p class="legend"><span class="int"></span>integer/sign &nbsp; <span class="frac"></span>fraction</p>
          <div class="scale-viz" id="scale-viz"></div>
          <div class="range-bar" id="range-bar"></div>
          <div class="bits-row" id="bits-row"></div>
          <div class="vals-grid">
            <div class="val-card"><span class="lbl">Format</span><span id="val-fmt"></span></div>
            <div class="val-card"><span class="lbl">Raw (hex)</span><span id="val-hex"></span></div>
            <div class="val-card"><span class="lbl">Signed raw</span><span id="val-signed"></span></div>
            <div class="val-card" id="card-real"><span class="lbl">Real value</span><span id="val-real"></span></div>
            <div class="val-card"><span class="lbl">Step 2^(−n)</span><span id="val-step"></span></div>
            <div class="val-card"><span class="lbl">Width</span><span id="val-w"></span></div>
          </div>
          <div class="ctrl-row">
            <label>Real
              <input id="real-in" type="text" inputmode="decimal" style="width:7rem" placeholder="1.5">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-encode" style="padding:0.3rem 0.55rem;font-size:0.8rem">Encode</button>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-decode">Decode current raw</button>
            <button type="button" id="btn-half">Encode 0.5</button>
            <button type="button" id="btn-neg">Encode −1.25</button>
            <button type="button" id="btn-sat">Encode 100 (saturate)</button>
            <button type="button" id="btn-q15">Set Q1.15</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Trace &amp; log</h2></div>
        <div class="panel-body">
          <pre class="trace-box" id="trace-box"></pre>
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
            <tr><td>Lab Qm.n</td><td>W=m+n; m includes sign; n = fraction bits</td></tr>
            <tr><td>Decode</td><td><code>real = signed(raw) / 2^n</code></td></tr>
            <tr><td>Encode</td><td><code>raw = round(real × 2^n)</code> then sat to range</td></tr>
            <tr><td>Step</td><td>Smallest change = <code>2^(−n)</code></td></tr>
            <tr><td>Q1.15</td><td>Common audio/DSP: 1 sign+int bit, 15 fraction</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Same raw bits mean different reals if <code>n</code> changes.</li>
          <li>Multiply Q formats: fraction bits add; watch growth of integer bits.</li>
          <li>Notation varies by vendor — always check whether <code>m</code> includes the sign.</li>
        </ul>
      </div>
    </div>
  `;

  const mSel = document.getElementById("m-sel");
  const nSel = document.getElementById("n-sel");
  const bitsRow = document.getElementById("bits-row");
  const rangeBar = document.getElementById("range-bar");
  const scaleViz = document.getElementById("scale-viz");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const realIn = document.getElementById("real-in");

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

  function fmtReal(x) {
    if (!Number.isFinite(x)) return String(x);
    const s = x.toFixed(Math.min(8, Math.max(2, state.n + 1)));
    return s.replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m)) || "0";
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state: { ...state, raw: state.raw.toString() },
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
      state.raw = BigInt(data.state.raw);
      challengeIdx = Number(data.challengeIdx) || 0;
      mSel.value = String(state.m);
      nSel.value = String(state.n);
      return true;
    } catch {
      return false;
    }
  }

  function clampRawToWidth() {
    const w = widthOf(state.m, state.n);
    state.raw = state.raw & maskW(w);
  }

  function renderBits() {
    const w = widthOf(state.m, state.n);
    const bin = bitsOf(state.raw, w);
    bitsRow.innerHTML = "";
    for (let i = w - 1; i >= 0; i--) {
      // after finishing integer bits (indices m-1..0 of the int part), insert point
      const bitPosFromMsb = w - 1 - i;
      if (bitPosFromMsb === state.m) {
        const pt = document.createElement("div");
        pt.className = "bit-cell point";
        pt.textContent = ".";
        pt.title = "binary point";
        bitsRow.appendChild(pt);
        state.sawBinaryPoint = true;
      }
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
      if (i < state.n) btn.classList.add("is-frac");
      btn.addEventListener("click", () => toggleBit(i));
      cell.appendChild(idx);
      cell.appendChild(btn);
      bitsRow.appendChild(cell);
    }
  }

  function renderVals() {
    const { m, n, raw } = state;
    const w = widthOf(m, n);
    const signed = toSigned(raw, w);
    const real = decode(raw, m, n);
    document.getElementById("val-fmt").textContent = `Q${m}.${n}`;
    document.getElementById("val-hex").textContent =
      "0x" + raw.toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0");
    document.getElementById("val-signed").textContent = String(signed);
    document.getElementById("val-real").textContent = fmtReal(real);
    document.getElementById("val-step").textContent = String(step(n));
    document.getElementById("val-w").textContent = String(w);
    document.getElementById("card-real").classList.toggle("warn", state.lastSat);
    rangeBar.textContent = `range ≈ [${rangeMin(m)} … ${fmtReal(rangeMax(m, n))}]`;
    realIn.value = fmtReal(real);
    const intPct = (m / w) * 100;
    scaleViz.innerHTML = `<div class="int" style="width:${intPct}%"></div><div class="frac" style="width:${100 - intPct}%"></div>`;
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(encode/decode for a trace)</span>';
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
    mSel.value = String(state.m);
    nSel.value = String(state.n);
    clampRawToWidth();
    renderBits();
    renderVals();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter Q4.4 raw=0x18 → 1.5");
    state.trace = [];
    renderAll();
  }

  function toggleBit(i) {
    state.raw ^= 1n << BigInt(i);
    state.lastSat = false;
    state.lastAction = "toggle";
    pushLog("run", `# toggle bit ${i}`);
    renderAll();
  }

  function setFormat(m, n) {
    state.m = m;
    state.n = n;
    state.setFormat = true;
    state.lastSat = false;
    clampRawToWidth();
    state.lastAction = "format";
    pushLog("run", `# format Q${m}.${n} (W=${widthOf(m, n)})`);
    renderAll();
  }

  function doEncode(real) {
    const x = Number(real);
    if (!Number.isFinite(x)) {
      pushLog("warn", "# invalid real");
      renderAll();
      return;
    }
    const { raw, sat, value } = encode(x, state.m, state.n);
    state.raw = raw;
    state.lastSat = sat;
    state.encoded = true;
    state.lastAction = "encode";
    const w = widthOf(state.m, state.n);
    state.trace = [
      { kind: "muted", text: `encode ${x} as Q${state.m}.${state.n}` },
      { kind: "hi", text: `× 2^${state.n} → round → sat` },
      {
        kind: sat ? "warn" : "ok",
        text: `raw ${bitsOf(raw, w)} (0x${raw.toString(16).toUpperCase()}) → ${fmtReal(value)}${sat ? " SAT" : ""}`,
      },
    ];
    pushLog(sat ? "warn" : "ok", `# encode ${x} → ${fmtReal(value)}`);
    renderAll();
  }

  function doDecode() {
    const w = widthOf(state.m, state.n);
    const signed = toSigned(state.raw, w);
    const real = decode(state.raw, state.m, state.n);
    state.decoded = true;
    state.lastAction = "decode";
    state.trace = [
      { kind: "muted", text: `decode Q${state.m}.${state.n}` },
      { kind: "hi", text: `raw bits ${bitsOf(state.raw, w)}` },
      { kind: "hi", text: `signed integer ${signed}` },
      { kind: "ok", text: `÷ 2^${state.n} → ${fmtReal(real)}` },
    ];
    pushLog("ok", `# decode → ${fmtReal(real)}`);
    renderAll();
  }

  document.getElementById("fp-starter").addEventListener("click", loadStarter);
  mSel.addEventListener("change", () => setFormat(Number(mSel.value), state.n));
  nSel.addEventListener("change", () => setFormat(state.m, Number(nSel.value)));
  document.getElementById("btn-encode").addEventListener("click", () => doEncode(realIn.value));
  realIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doEncode(realIn.value);
  });
  document.getElementById("btn-decode").addEventListener("click", doDecode);
  document.getElementById("btn-half").addEventListener("click", () => doEncode(0.5));
  document.getElementById("btn-neg").addEventListener("click", () => doEncode(-1.25));
  document.getElementById("btn-sat").addEventListener("click", () => doEncode(100));
  document.getElementById("btn-q15").addEventListener("click", () => {
    setFormat(1, 15);
    doEncode(0.5);
    state.lastAction = "q15";
  });

  const CHALLENGES = [
    {
      id: "quiz-scale",
      title: "Quiz: scale",
      prompt: "Decode divides signed raw by? Answer: <code>2^n</code>",
      hint: "fraction weight",
      type: "text",
      answer: "2^n",
      alt: ["2**n", "pow(2,n)", "1<<n"],
    },
    {
      id: "quiz-step",
      title: "Quiz: step",
      prompt: "Smallest positive step is? Answer: <code>2^-n</code>",
      hint: "LSB weight",
      type: "text",
      answer: "2^-n",
      alt: ["2**(-n)", "1/2^n"],
    },
    {
      id: "quiz-width",
      title: "Quiz: width",
      prompt: "In this lab, W equals? Answer: <code>m+n</code>",
      hint: "sum",
      type: "text",
      answer: "m+n",
      alt: ["m + n", "m+n bits"],
    },
    {
      id: "quiz-sign",
      title: "Quiz: m includes",
      prompt: "Lab m includes the? Answer: <code>sign</code>",
      hint: "sign bit",
      type: "text",
      answer: "sign",
      alt: ["sign bit", "the sign"],
    },
    {
      id: "starter-1p5",
      title: "Starter 1.5",
      prompt: "Load starter — Q4.4 raw 0x18 decodes to 1.5.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.m === 4 &&
        state.n === 4 &&
        state.raw === 0x18n &&
        Math.abs(decode(state.raw, 4, 4) - 1.5) < 1e-9,
    },
    {
      id: "decode-it",
      title: "Decode",
      prompt: "Click Decode current raw on the starter.",
      hint: "Decode button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.decoded && state.lastAction === "decode",
    },
    {
      id: "encode-half",
      title: "Encode 0.5",
      prompt: "Q4.4: encode 0.5 → raw 0x08.",
      hint: "Encode 0.5 button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.m === 4 &&
        state.n === 4 &&
        state.encoded &&
        state.raw === 0x08n,
    },
    {
      id: "encode-neg",
      title: "Encode −1.25",
      prompt: "Q4.4: encode −1.25.",
      hint: "Encode −1.25",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (!(state.m === 4 && state.n === 4 && state.encoded)) return false;
        return Math.abs(decode(state.raw, 4, 4) - -1.25) < 1e-9;
      },
    },
    {
      id: "saturate",
      title: "Saturate",
      prompt: "Encode 100 in Q4.4 — lastSat true (clamped to max).",
      hint: "Encode 100 button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastSat && state.encoded,
    },
    {
      id: "change-n",
      title: "Change n",
      prompt: "Keep raw, set n=2 (Q4.2) — real value changes.",
      hint: "n selector → 2",
      type: "state",
      setup: () => {
        loadStarter();
        // raw 0x18
      },
      check: () =>
        state.n === 2 &&
        state.m === 4 &&
        state.raw === 0x18n &&
        Math.abs(decode(0x18n, 4, 2) - 6) < 1e-9 &&
        state.setFormat,
    },
    {
      id: "quiz-q15",
      title: "Quiz: Q1.15",
      prompt: "Q1.15 total bits? Answer: <code>16</code>",
      hint: "1+15",
      type: "text",
      answer: "16",
      alt: ["16 bits"],
    },
    {
      id: "set-q15",
      title: "Set Q1.15",
      prompt: "Use Set Q1.15 (encodes 0.5).",
      hint: "Q1.15 button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.m === 1 &&
        state.n === 15 &&
        widthOf(1, 15) === 16 &&
        state.encoded,
    },
    {
      id: "binary-point",
      title: "Binary point",
      prompt: "View bits so the binary point separator is shown (any Q).",
      hint: "load starter — point between int and frac",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.sawBinaryPoint && state.n > 0,
    },
    {
      id: "quiz-1p5-raw",
      title: "Quiz: raw 1.5",
      prompt: "Q4.4 raw integer for 1.5? Answer: <code>24</code>",
      hint: "1.5×16",
      type: "text",
      answer: "24",
      alt: ["0x18", "18"],
    },
    {
      id: "encode-zero",
      title: "Encode 0",
      prompt: "Encode real 0 — raw 0.",
      hint: "type 0 → Encode",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.encoded && state.raw === 0n,
    },
    {
      id: "toggle-lsb",
      title: "Toggle LSB",
      prompt: "From starter, toggle bit 0 — step changes real by 2^(−n).",
      hint: "click rightmost bit",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const base = decode(0x18n, 4, 4);
        const now = decode(state.raw, state.m, state.n);
        return (
          state.m === 4 &&
          state.n === 4 &&
          state.lastAction === "toggle" &&
          Math.abs(Math.abs(now - base) - step(4)) < 1e-12
        );
      },
    },
    {
      id: "quiz-range-min",
      title: "Quiz: Q4.4 min",
      prompt: "Q4.4 approx min? Answer: <code>-8</code>",
      hint: "−2^(m−1)",
      type: "text",
      answer: "-8",
      alt: ["−8"],
    },
    {
      id: "n-zero",
      title: "n=0 integer",
      prompt: "Set n=0 — step is 1 (pure integer).",
      hint: "n → 0",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.n === 0 && step(0) === 1 && state.setFormat,
    },
    {
      id: "roundtrip",
      title: "Round-trip",
      prompt: "Encode 1.5 then Decode — real back to 1.5 on Q4.4.",
      hint: "encode 1.5 → decode",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.encoded &&
        state.decoded &&
        state.m === 4 &&
        state.n === 4 &&
        Math.abs(decode(state.raw, 4, 4) - 1.5) < 1e-9,
    },
    {
      id: "quiz-vendor",
      title: "Quiz: notation",
      prompt: "Qm.n meaning is identical across all vendors? Answer: <code>no</code>",
      hint: "check docs",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "m5-n4",
      title: "Q5.4",
      prompt: "Set m=5,n=4 (W=9) and encode 1.0.",
      hint: "m=5 n=4 → encode 1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.m === 5 &&
        state.n === 4 &&
        state.encoded &&
        Math.abs(decode(state.raw, 5, 4) - 1) < 1e-9,
    },
    {
      id: "full-q",
      title: "Full Q story",
      prompt: "Decode starter, encode 0.5, and saturate once.",
      hint: "decode → 0.5 → sat 100",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.decoded &&
        state.encoded &&
        state.lastSat &&
        state.raw !== 0x18n,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use Qm.n controls, then Check.</span>`;
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
