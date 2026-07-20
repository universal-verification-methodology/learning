(() => {
  /**
   * Radix-4 Booth encode grid
   *   Multiplier Y (8-bit), y[-1]=0
   *   For i = 0,1,2,3: triplet (y[2i+1], y[2i], y[2i-1]) → digit d_i ∈ {0,±1,±2}
   *   Partial product i: d_i * X, shifted by 2i
   */

  const WIDTH = 8;

  /** Booth radix-4 encode from triplet bits [hi, mid, lo] = [y2i+1, y2i, y2i-1] */
  function boothDigit(hi, mid, lo) {
    const code = (hi << 2) | (mid << 1) | lo;
    const map = {
      0b000: 0,
      0b001: 1,
      0b010: 1,
      0b011: 2,
      0b100: -2,
      0b101: -1,
      0b110: -1,
      0b111: 0,
    };
    return map[code];
  }

  function parseByte(s) {
    const t = String(s).trim();
    if (/^[01]{1,8}$/.test(t)) return parseInt(t.padStart(8, "0"), 2) & 0xff;
    const n = parseInt(t.replace(/^0x/i, ""), 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function toBin(n, w = WIDTH) {
    return (n & ((1 << w) - 1)).toString(2).padStart(w, "0");
  }

  function toHex(n) {
    return "0x" + (n & 0xff).toString(16).padStart(2, "0");
  }

  function bitsOf(n) {
    // bits[i] = y[i], i=0 LSB
    const out = [];
    for (let i = 0; i < WIDTH; i++) out.push((n >> i) & 1);
    return out;
  }

  function encodeY(y) {
    const bits = bitsOf(y);
    const digits = [];
    for (let i = 0; i < WIDTH / 2; i++) {
      const lo = i === 0 ? 0 : bits[2 * i - 1];
      const mid = bits[2 * i];
      const hi = bits[2 * i + 1];
      const d = boothDigit(hi, mid, lo);
      digits.push({ i, hi, mid, lo, d, shift: 2 * i });
    }
    return { bits, digits };
  }

  function signedByte(n) {
    return n > 127 ? n - 256 : n;
  }

  function partialProducts(x, digits) {
    const xs = signedByte(x);
    return digits.map((g) => {
      const raw = g.d * xs;
      const contrib = raw << g.shift;
      return { ...g, raw, contrib };
    });
  }

  function productFromDigits(x, digits) {
    return partialProducts(x, digits).reduce((a, p) => a + p.contrib, 0);
  }

  function sourceCode() {
    return `// Radix-4 Booth digit from (y[2i+1], y[2i], y[2i-1])
// 000→0  001→+1  010→+1  011→+2
// 100→-2 101→-1  110→-1  111→0
// PP_i = digit_i * X  << (2*i);  y[-1]=0`;
  }

  function digitLabel(d) {
    if (d === 0) return "0";
    if (d > 0) return `+${d}`;
    return String(d);
  }

  function makeStarter() {
    return {
      xStr: "0C",
      yStr: "1A",
      encoded: false,
      lastAction: "",
      explained: false,
      setEx: false,
      setNeg: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-booth-encode-cleared-v1";
  const STORE_KEY = "ddv-booth-encode-session-v1";

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

  const root = document.getElementById("booth-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> X=<code>0x0C</code> (12), Y=<code>0x1A</code> (26) —
        encode Y into radix-4 Booth digits and form partial products.</p>
      <button type="button" class="btn btn-secondary" id="booth-starter">Load starter example</button>
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
            <h3>Triplets</h3>
            <p>Overlap by one bit; include y[−1]=0 for the first group.</p>
          </div>
          <div class="idea-card">
            <h3>Digits</h3>
            <p>Each triplet → 0, ±1, or ±2 (not ±3).</p>
          </div>
          <div class="idea-card">
            <h3>Fewer PPs</h3>
            <p>n/2 partial products vs n for radix-2.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Encode grid</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>X (multiplicand) <input id="in-x" type="text" value="0C" maxlength="10"></label>
            <label>Y (multiplier) <input id="in-y" type="text" value="1A" maxlength="10"></label>
          </div>
          <p class="legend">Hex byte or 8-bit binary. Y bits shown LSB on the right.</p>
          <div class="bit-grid" id="bit-grid"></div>
          <div class="digit-row" id="digit-row"></div>
          <div class="pp-list" id="pp-list"></div>
          <div class="result-bar" id="result-bar">Product: —</div>
          <pre class="code-box" id="code-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-encode">Encode Y</button>
            <button type="button" id="btn-ex">Example 0C × 1A</button>
            <button type="button" id="btn-neg">Example with −2 digit</button>
            <button type="button" id="btn-zero-y">Y = 0 (all digits 0)</button>
            <button type="button" id="btn-table">Highlight 011 → +2</button>
            <button type="button" id="btn-demo">Demo: digits → product</button>
            <button type="button" id="btn-explain">Explain radix-4 Booth</button>
            <button type="button" id="btn-swap">Swap X ↔ Y</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Digits</h3>
              <p class="val" id="val-dig">—</p>
              <p class="note" id="note-dig"></p>
            </div>
            <div class="status-card">
              <h3>Product check</h3>
              <p class="val" id="val-prod">—</p>
              <p class="note" id="note-prod"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Booth radix-4 table</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead>
            <tr><th>y2i+1</th><th>y2i</th><th>y2i−1</th><th>digit</th></tr>
          </thead>
          <tbody>
            <tr><td>0</td><td>0</td><td>0</td><td>0</td></tr>
            <tr><td>0</td><td>0</td><td>1</td><td>+1</td></tr>
            <tr><td>0</td><td>1</td><td>0</td><td>+1</td></tr>
            <tr><td>0</td><td>1</td><td>1</td><td>+2</td></tr>
            <tr><td>1</td><td>0</td><td>0</td><td>−2</td></tr>
            <tr><td>1</td><td>0</td><td>1</td><td>−1</td></tr>
            <tr><td>1</td><td>1</td><td>0</td><td>−1</td></tr>
            <tr><td>1</td><td>1</td><td>1</td><td>0</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>8-bit Y → 4 digits; each covers two multiplier bits of weight.</li>
          <li>Signed interpretation of X used for −1/−2 partial products.</li>
        </ul>
      </div>
    </div>
  `;

  const inX = /** @type {HTMLInputElement} */ (document.getElementById("in-x"));
  const inY = /** @type {HTMLInputElement} */ (document.getElementById("in-y"));
  const bitGrid = document.getElementById("bit-grid");
  const digitRow = document.getElementById("digit-row");
  const ppList = document.getElementById("pp-list");
  const resultBar = document.getElementById("result-bar");
  const codeBox = document.getElementById("code-box");
  const valDig = document.getElementById("val-dig");
  const noteDig = document.getElementById("note-dig");
  const valProd = document.getElementById("val-prod");
  const noteProd = document.getElementById("note-prod");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function pushLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function current() {
    const x = parseByte(state.xStr);
    const y = parseByte(state.yStr);
    const enc = encodeY(y);
    const pps = partialProducts(x, enc.digits);
    const boothProd = productFromDigits(x, enc.digits);
    const direct = signedByte(x) * signedByte(y);
    return { x, y, enc, pps, boothProd, direct };
  }

  function doEncode() {
    state.xStr = inX.value;
    state.yStr = inY.value;
    state.encoded = true;
    state.lastAction = "encode";
    const c = current();
    pushTrace(
      `digits [${c.enc.digits.map((d) => digitLabel(d.d)).join(", ")}]`
    );
    pushLog(`# encode Y=${toHex(c.y)} → ${c.enc.digits.map((d) => digitLabel(d.d)).join(" ")}`);
    renderAll();
  }

  function loadExample() {
    state.xStr = "0C";
    state.yStr = "1A";
    state.setEx = true;
    state.encoded = true;
    state.lastAction = "example";
    pushLog("# example 0C × 1A");
    renderAll();
  }

  function loadNeg() {
    // Y with a -2 digit: triplet 100 → need y pattern
    // For i=0: hi=y1, mid=y0, lo=0 → 100 means y1=1,y0=0 → Y LSB ...x10
    // Use Y = 0b00000010 = 0x02 → first digit -2? hi=1 mid=0 lo=0 → -2 yes
    state.xStr = "05";
    state.yStr = "02";
    state.setNeg = true;
    state.encoded = true;
    state.lastAction = "neg";
    pushLog("# example with −2 digit (Y=02)");
    pushTrace("group0 triplet 100 → digit −2");
    renderAll();
  }

  function loadZeroY() {
    state.yStr = "00";
    state.encoded = true;
    state.lastAction = "zero-y";
    pushLog("# Y=0 → all digits 0");
    renderAll();
  }

  function highlightPlus2() {
    // i=1 triplet 011: y3=0,y2=1,y1=1 → Y=0x06
    state.yStr = "06";
    state.xStr = "03";
    state.encoded = true;
    state.lastAction = "plus2";
    pushLog("# Y=06 has 011 → +2 in group 1");
    pushTrace("digit1 triplet 011 → +2");
    renderAll();
  }

  function runDemo() {
    state.xStr = "0C";
    state.yStr = "1A";
    state.setEx = true;
    state.encoded = true;
    state.lastAction = "demo";
    const c = current();
    pushTrace(`demo product booth=${c.boothProd} direct=${c.direct}`);
    pushLog("# demo digits → product");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# radix-4: n/2 PPs · digits 0,±1,±2 · overlap triplets");
    pushTrace("explain: recoding reduces adder tree height");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setEx = true;
    state.encoded = true;
    state.lastAction = "starter";
    pushLog("# starter 0C × 1A");
    renderAll();
  }

  function renderGrid(c) {
    const bits = c.enc.bits;
    // header indices 7..0
    let head = "<tr><th></th>";
    for (let i = WIDTH - 1; i >= 0; i--) head += `<th>y${i}</th>`;
    head += "<th>y−1</th></tr>";

    let row = "<tr><th>Y</th>";
    for (let i = WIDTH - 1; i >= 0; i--) {
      const g = Math.floor(i / 2);
      const cls = g % 2 === 0 ? "is-group" : "is-group-alt";
      row += `<td class="${cls}">${bits[i]}</td>`;
    }
    row += `<td class="is-neg1">0</td></tr>`;

    // group brackets row
    let gRow = "<tr><th>grp</th>";
    for (let i = WIDTH - 1; i >= 0; i--) {
      const g = Math.floor(i / 2);
      gRow += `<td>${g}</td>`;
    }
    gRow += "<td>0</td></tr>";

    bitGrid.innerHTML = `<table>${head}${row}${gRow}</table>`;
  }

  function renderDigits(c) {
    digitRow.innerHTML = c.enc.digits
      .map((g) => {
        const cls =
          g.d === 0 ? "is-zero" : g.d > 0 ? "is-pos" : "is-neg";
        return `<div class="digit-card ${cls}">
          <h3>digit ${g.i} · (${g.hi}${g.mid}${g.lo})</h3>
          <p class="dig">${digitLabel(g.d)}</p>
          <div>≪ ${g.shift}</div>
        </div>`;
      })
      .join("");
  }

  function renderPps(c) {
    ppList.innerHTML = c.pps
      .map(
        (p) =>
          `<div>PP${p.i}: ${digitLabel(p.d)}×X = ${p.raw} ≪ ${p.shift} → ${p.contrib}</div>`
      )
      .join("");
    resultBar.textContent = `Booth Σ = ${c.boothProd}  ·  X×Y (signed) = ${c.direct}  ·  ${
      c.boothProd === c.direct ? "match ✓" : "mismatch"
    }`;
  }

  function renderAll() {
    inX.value = state.xStr;
    inY.value = state.yStr;
    codeBox.textContent = sourceCode();
    const c = current();
    renderGrid(c);
    renderDigits(c);
    renderPps(c);

    valDig.textContent = c.enc.digits.map((d) => digitLabel(d.d)).join(" ");
    noteDig.textContent = `${c.enc.digits.length} digits (n/2)`;
    valProd.textContent = String(c.boothProd);
    noteProd.textContent =
      c.boothProd === c.direct ? "matches signed product" : "check signed X,Y";

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no activity";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ x: state.xStr, y: state.yStr })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("booth-starter").addEventListener("click", loadStarter);

  inX.addEventListener("change", () => {
    state.xStr = inX.value;
    state.lastAction = "edit";
    renderAll();
  });
  inY.addEventListener("change", () => {
    state.yStr = inY.value;
    state.lastAction = "edit";
    renderAll();
  });

  document.getElementById("btn-encode").addEventListener("click", doEncode);
  document.getElementById("btn-ex").addEventListener("click", loadExample);
  document.getElementById("btn-neg").addEventListener("click", loadNeg);
  document.getElementById("btn-zero-y").addEventListener("click", loadZeroY);
  document.getElementById("btn-table").addEventListener("click", highlightPlus2);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-swap").addEventListener("click", () => {
    const t = state.xStr;
    state.xStr = state.yStr;
    state.yStr = t;
    state.lastAction = "swap";
    pushLog("# swap X ↔ Y");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-booth",
      title: "Quiz: Booth",
      prompt: "Multiplier recoding family name? Answer: <code>Booth</code>",
      hint: "Booth encoding",
      type: "text",
      answer: "booth",
      alt: ["Booth", "booth encoding"],
    },
    {
      id: "quiz-radix4",
      title: "Quiz: radix-4",
      prompt: "This lab uses radix-? Answer: <code>4</code>",
      hint: "two bits per digit",
      type: "text",
      answer: "4",
      alt: ["radix-4", "radix 4"],
    },
    {
      id: "quiz-digits",
      title: "Quiz: digit set",
      prompt: "Radix-4 Booth digit set includes? Answer: <code>0, ±1, ±2</code>",
      hint: "not ±3",
      type: "text",
      answer: "0, ±1, ±2",
      alt: ["0 ±1 ±2", "0,+1,-1,+2,-2", "0,±1,±2"],
    },
    {
      id: "quiz-half",
      title: "Quiz: count",
      prompt: "8-bit Y yields how many digits? Answer: <code>4</code>",
      hint: "n/2",
      type: "text",
      answer: "4",
      alt: ["four", "n/2"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 0C × 1A.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setEx &&
        parseByte(state.xStr) === 0x0c &&
        parseByte(state.yStr) === 0x1a,
    },
    {
      id: "encode",
      title: "Encode",
      prompt: "Press Encode Y.",
      hint: "Encode Y",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.encoded && state.lastAction === "encode",
    },
    {
      id: "example",
      title: "Example",
      prompt: "Load Example 0C × 1A.",
      hint: "Example button",
      type: "state",
      setup: () => {
        loadStarter();
        state.xStr = "01";
        state.yStr = "01";
        renderAll();
      },
      check: () =>
        state.lastAction === "example" && parseByte(state.yStr) === 0x1a,
    },
    {
      id: "neg-digit",
      title: "−2 digit",
      prompt: "Load example with −2 digit — digit0 = −2.",
      hint: "Example with −2 digit",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const c = current();
        return (
          state.setNeg &&
          state.lastAction === "neg" &&
          c.enc.digits[0].d === -2
        );
      },
    },
    {
      id: "plus2",
      title: "+2 digit",
      prompt: "Highlight 011 → +2 — some digit equals +2.",
      hint: "Highlight 011 → +2",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const c = current();
        return (
          state.lastAction === "plus2" &&
          c.enc.digits.some((d) => d.d === 2)
        );
      },
    },
    {
      id: "zero-y",
      title: "Y=0",
      prompt: "Y=0 — all digits 0.",
      hint: "Y = 0 button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const c = current();
        return (
          state.lastAction === "zero-y" &&
          c.enc.digits.every((d) => d.d === 0)
        );
      },
    },
    {
      id: "product-match",
      title: "Product match",
      prompt: "Starter values: Booth Σ equals signed X×Y.",
      hint: "Load starter / Encode",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const c = current();
        return c.boothProd === c.direct && c.direct === 12 * 26;
      },
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: digits → product.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "demo" && state.encoded,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain radix-4 Booth.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "swap",
      title: "Swap",
      prompt: "Swap X ↔ Y.",
      hint: "Swap button",
      type: "state",
      setup: () => {
        loadStarter();
        state.xStr = "0C";
        state.yStr = "1A";
        renderAll();
      },
      check: () =>
        state.lastAction === "swap" &&
        parseByte(state.xStr) === 0x1a &&
        parseByte(state.yStr) === 0x0c,
    },
    {
      id: "triplet0",
      title: "Triplet0",
      prompt: "On starter Y=1A, digit0 triplet ends with y−1=0.",
      hint: "Encode starter — digit 0 card",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const c = current();
        return c.enc.digits[0].lo === 0 && parseByte(state.yStr) === 0x1a;
      },
    },
    {
      id: "code-table",
      title: "Code table",
      prompt: "Code mentions <code>011→+2</code>.",
      hint: "Always in code box",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode().includes("011→+2"),
    },
    {
      id: "digit-count",
      title: "Digit count",
      prompt: "Encoded Y always has 4 digit cards visible.",
      hint: "Any encode",
      type: "state",
      setup: () => loadStarter(),
      check: () => current().enc.digits.length === 4,
    },
    {
      id: "shift-step",
      title: "Shift step",
      prompt: "digit1 shift is 2; digit2 shift is 4.",
      hint: "Starter encode",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = current().enc.digits;
        return d[1].shift === 2 && d[2].shift === 4;
      },
    },
    {
      id: "booth-000",
      title: "Encode 000",
      prompt: "Manual: boothDigit(0,0,0) idea — have a 0 digit present.",
      hint: "Y=0 or starter may include 0",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        current().enc.digits.some((d) => d.d === 0) ||
        boothDigit(0, 0, 0) === 0,
    },
    {
      id: "edit-y",
      title: "Edit Y",
      prompt: "Change Y input and Encode (lastAction encode).",
      hint: "Edit Y field → Encode Y",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "encode" && state.encoded,
    },
    {
      id: "neg-pp",
      title: "Neg PP",
      prompt: "With −2 example, PP0 raw is negative.",
      hint: "Example with −2 digit",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        loadNeg();
        const c = current();
        return c.pps[0].raw < 0;
      },
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.explained &&
        state.lastAction === "explain" &&
        parseByte(state.yStr) === 0x1a,
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

  function setStatus(kind, text) {
    const el = document.getElementById("chal-status");
    el.className = `challenge-status ${kind}`;
    el.textContent = text;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (isCleared(ch.id) ? " · cleared" : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}.</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? `Hint: ${ch.hint}` : "";
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      ansRow.innerHTML = `<label class="sr-only" for="chal-answer">Answer</label>
        <input type="text" id="chal-answer" class="chal-input" autocomplete="off" placeholder="Type answer…">`;
      const inp = /** @type {HTMLInputElement} */ (document.getElementById("chal-answer"));
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
    } else {
      ansRow.innerHTML = "";
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = CHALLENGES.map((c, i) => {
      const cls = [
        "kbd",
        i === challengeIdx ? "is-active" : "",
        isCleared(c.id) ? "is-cleared" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-chal="${i}">${c.id}</button>`;
    }).join(" ");
    cat.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        challengeIdx = Number(btn.getAttribute("data-chal"));
        showHint = false;
        answerDraft = "";
        setStatus("idle", "Idle");
        const next = CHALLENGES[challengeIdx];
        if (next.setup) next.setup();
        renderChallenge();
      });
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
    setStatus("idle", "Idle");
    const next = CHALLENGES[challengeIdx];
    if (next.setup) next.setup();
    renderChallenge();
  });

  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const got = normalizeAns(answerDraft);
      const want = normalizeAns(ch.answer);
      const alts = (ch.alt || []).map(normalizeAns);
      ok = got === want || alts.includes(got);
    } else {
      ok = !!ch.check();
    }
    if (ok) {
      markCleared(ch.id);
      setStatus("ok", "Cleared");
    } else {
      setStatus("bad", "Not yet");
    }
    renderChallenge();
  });

  loadStarter();
  renderChallenge();
})();
