(() => {
  /**
   * Packed BCD: each decimal digit → 4-bit nibble (0–9 valid; A–F invalid).
   * Encode: decimal digits → packed word (MSD on the left).
   * Decode: unpack nibbles → decimal (fail if any nibble > 9).
   */

  function digitsOfDecimal(n, width) {
    const s = String(Math.abs(Number(n))).padStart(width, "0");
    if (s.length > width) return null;
    return s.split("").map((c) => Number(c));
  }

  function encodeDigits(digits) {
    let packed = 0n;
    for (const d of digits) {
      packed = (packed << 4n) | BigInt(d & 0xf);
    }
    return packed;
  }

  function unpackNibbles(packed, width) {
    const nibs = [];
    let v = BigInt(packed);
    for (let i = 0; i < width; i++) {
      nibs.unshift(Number(v & 0xfn));
      v >>= 4n;
    }
    return nibs;
  }

  function nibblesValid(nibs) {
    return nibs.every((n) => n >= 0 && n <= 9);
  }

  function decodeNibbles(nibs) {
    if (!nibsValid(nibs)) return null;
    return Number(nibs.join(""));
  }

  function bitsOfNibble(n) {
    return (n & 0xf).toString(2).padStart(4, "0");
  }

  function hexOfPacked(packed, width) {
    return packed
      .toString(16)
      .toUpperCase()
      .padStart(width, "0");
  }

  function makeStarter() {
    return {
      width: 2,
      decimal: 42,
      packed: 0x42n,
      nibbles: [4, 2],
      valid: true,
      lastAction: "",
      encoded: false,
      decoded: false,
      sawInvalid: false,
      setHex: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-bcd-lab-cleared-v1";
  const STORE_KEY = "ddv-bcd-lab-session-v1";

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

  const root = document.getElementById("bcd-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Two-digit decimal <code>42</code> packs to BCD
        nibbles <code>4</code> and <code>2</code> → hex <code>0x42</code>.
        Try an invalid nibble like <code>0x4A</code>.</p>
      <button type="button" class="btn btn-secondary" id="bcd-starter">Load starter example</button>
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
            <h3>One digit → 4 bits</h3>
            <p>BCD stores each decimal digit in a nibble (<code>0–9</code> only).</p>
          </div>
          <div class="idea-card">
            <h3>Invalid codes</h3>
            <p>Nibbles <code>A–F</code> (10–15) are not decimal digits — decode fails.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Pack / unpack</h2></div>
        <div class="panel-body">
          <div class="status-pill ok" id="status-pill">valid BCD</div>
          <div class="ctrl-row">
            <label>Digits
              <select id="width-sel">
                <option value="1">1</option>
                <option value="2" selected>2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
            <label>Decimal
              <input id="dec-in" type="text" inputmode="numeric" style="width:6rem" placeholder="42">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-encode" style="padding:0.3rem 0.55rem;font-size:0.8rem">Encode</button>
          </div>
          <div class="ctrl-row">
            <label>Packed hex
              <input id="hex-in" type="text" style="width:7rem" placeholder="42">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-decode" style="padding:0.3rem 0.55rem;font-size:0.8rem">Decode</button>
          </div>
          <div class="nibble-row" id="nibble-row"></div>
          <pre class="meta-box" id="meta-box"></pre>
          <div class="preset-row">
            <button type="button" data-d="0">0</button>
            <button type="button" data-d="9">9</button>
            <button type="button" data-d="42">42</button>
            <button type="button" data-d="99">99</button>
            <button type="button" data-d="255">255</button>
            <button type="button" data-d="2026">2026</button>
          </div>
          <div class="action-grid" style="margin-top:0.65rem">
            <button type="button" id="btn-invalid">Load invalid 0x4A (2-digit)</button>
            <button type="button" id="btn-trace">Show encode trace</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Trace</h3>
          <pre class="trace-box" id="trace-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Digit → nibble map</h2></div>
        <div class="panel-body">
          <div class="table-wrap">
            <table class="digit-table">
              <thead><tr><th>Digit</th><th>Nibble</th><th>Binary</th><th>Hex</th></tr></thead>
              <tbody id="map-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Idea</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>Encode</td><td>Each decimal digit → 4 bits; pack MSD left</td></tr>
            <tr><td>Decode</td><td>Split into nibbles; reject if any &gt; 9</td></tr>
            <tr><td>vs binary</td><td><code>42</code> binary is <code>0x2A</code>; BCD is <code>0x42</code></td></tr>
            <tr><td>Width</td><td>N digits need <code>4N</code> bits</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Seven-segment and decimal displays often speak BCD digits.</li>
          <li>Packed BCD is denser than one-byte-per-digit ASCII.</li>
          <li>Binary 255 ≠ BCD 255 — different encodings.</li>
        </ul>
      </div>
    </div>
  `;

  const widthSel = document.getElementById("width-sel");
  const decIn = document.getElementById("dec-in");
  const hexIn = document.getElementById("hex-in");
  const nibbleRow = document.getElementById("nibble-row");
  const metaBox = document.getElementById("meta-box");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const statusPill = document.getElementById("status-pill");
  const mapBody = document.getElementById("map-body");

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
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state: { ...state, packed: state.packed.toString() },
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
      state.packed = BigInt(data.state.packed);
      challengeIdx = Number(data.challengeIdx) || 0;
      widthSel.value = String(state.width);
      return true;
    } catch {
      return false;
    }
  }

  function syncFromNibbles() {
    state.packed = encodeDigits(state.nibbles.map((n) => Math.min(15, Math.max(0, n))));
    state.valid = nibblesValid(state.nibbles);
    if (state.valid) state.decimal = decodeNibbles(state.nibbles);
    else state.decimal = null;
  }

  function renderNibbles() {
    nibbleRow.innerHTML = "";
    state.nibbles.forEach((n, i) => {
      const el = document.createElement("div");
      el.className = "nibble" + (n > 9 ? " invalid" : "") + (i === 0 ? " msd" : "");
      const label = n > 9 ? n.toString(16).toUpperCase() : String(n);
      el.innerHTML = `<span class="tag">${i === 0 ? "MSD" : "d" + i}</span>
        <span class="dig">${escapeHtml(label)}</span>
        ${bitsOfNibble(n)}`;
      nibbleRow.appendChild(el);
    });
  }

  function renderMeta() {
    const w = state.width;
    const lines = [];
    lines.push(
      state.valid
        ? `<span class="ok">valid BCD · decimal ${state.decimal}</span>`
        : `<span class="err">INVALID · nibble &gt;9 present</span>`
    );
    lines.push(
      `<span class="hi">packed 0x${hexOfPacked(state.packed, w)} · ${w * 4} bits</span>`
    );
    const binWord = state.packed
      .toString(2)
      .padStart(w * 4, "0")
      .replace(/(.{4})(?=.)/g, "$1_");
    lines.push(`<span class="muted">bits ${binWord}</span>`);
    if (state.valid && state.decimal != null) {
      const pure = BigInt(state.decimal);
      lines.push(
        `<span class="muted">same number as binary int: 0x${pure.toString(16).toUpperCase()} (≠ BCD packing unless digits match)</span>`
      );
    }
    metaBox.innerHTML = lines.join("\n");
    statusPill.className = "status-pill " + (state.valid ? "ok" : "bad");
    statusPill.textContent = state.valid ? "valid BCD" : "invalid BCD";
    decIn.value = state.decimal == null ? "" : String(state.decimal);
    hexIn.value = hexOfPacked(state.packed, w);
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(encode/decode trace)</span>';
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

  function renderMap() {
    const rows = [];
    for (let d = 0; d <= 15; d++) {
      const bad = d > 9;
      rows.push(`<tr class="${bad ? "bad" : ""}">
        <td>${bad ? "—" : d}</td>
        <td>${d}</td>
        <td>${bitsOfNibble(d)}</td>
        <td>${d.toString(16).toUpperCase()}${bad ? " invalid" : ""}</td>
      </tr>`);
    }
    mapBody.innerHTML = rows.join("");
  }

  function renderAll() {
    widthSel.value = String(state.width);
    renderNibbles();
    renderMeta();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: decimal 42 → BCD 0x42 (nibbles 4,2)");
    state.trace = [];
    renderAll();
  }

  function doEncode(raw) {
    const w = state.width;
    const n = Number(String(raw).trim());
    if (!Number.isInteger(n) || n < 0) {
      pushLog("warn", "# need non-negative integer");
      renderAll();
      return;
    }
    const digs = digitsOfDecimal(n, w);
    if (!digs) {
      pushLog("err", `# ${n} needs more than ${w} digits — raise Digits`);
      renderAll();
      return;
    }
    state.nibbles = digs;
    syncFromNibbles();
    state.encoded = true;
    state.lastAction = "encode";
    state.trace = [
      { kind: "muted", text: `encode decimal ${n} → ${w} BCD digits` },
      ...digs.map((d, i) => ({
        kind: "hi",
        text: `  digit[${i}]=${d} → ${bitsOfNibble(d)}`,
      })),
      { kind: "ok", text: `packed 0x${hexOfPacked(state.packed, w)}` },
    ];
    pushLog("ok", `# encode ${n} → 0x${hexOfPacked(state.packed, w)}`);
    renderAll();
  }

  function doDecode(raw) {
    const w = state.width;
    let hex = String(raw).trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      pushLog("warn", "# invalid hex");
      renderAll();
      return;
    }
    const packed = BigInt("0x" + hex);
    const max = (1n << BigInt(w * 4)) - 1n;
    state.packed = packed & max;
    state.nibbles = unpackNibbles(state.packed, w);
    state.valid = nibblesValid(state.nibbles);
    state.setHex = true;
    state.decoded = true;
    state.lastAction = "decode";
    if (!state.valid) {
      state.sawInvalid = true;
      state.decimal = null;
      state.trace = [
        { kind: "err", text: `decode 0x${hexOfPacked(state.packed, w)} — INVALID` },
        ...state.nibbles.map((n, i) => ({
          kind: n > 9 ? "err" : "hi",
          text: `  nib[${i}]=${n.toString(16).toUpperCase()}${n > 9 ? " (>9)" : ""}`,
        })),
      ];
      pushLog("err", "# invalid BCD nibble");
    } else {
      state.decimal = decodeNibbles(state.nibbles);
      state.trace = [
        { kind: "ok", text: `decode 0x${hexOfPacked(state.packed, w)} → ${state.decimal}` },
        ...state.nibbles.map((n, i) => ({
          kind: "hi",
          text: `  nib[${i}]=${n}`,
        })),
      ];
      pushLog("ok", `# decode → ${state.decimal}`);
    }
    renderAll();
  }

  function loadInvalid() {
    state.width = 2;
    widthSel.value = "2";
    doDecode("4A");
    state.lastAction = "invalid";
  }

  function showTrace() {
    doEncode(state.decimal != null ? state.decimal : decIn.value || 0);
    state.lastAction = "trace";
  }

  document.getElementById("bcd-starter").addEventListener("click", loadStarter);
  widthSel.addEventListener("change", () => {
    const w = Number(widthSel.value);
    state.width = w;
    // re-encode current decimal if possible
    if (state.decimal != null) {
      const digs = digitsOfDecimal(state.decimal, w);
      if (digs) {
        state.nibbles = digs;
        syncFromNibbles();
      } else {
        state.nibbles = unpackNibbles(state.packed, w);
        syncFromNibbles();
      }
    } else {
      state.nibbles = unpackNibbles(state.packed, w);
      state.valid = nibblesValid(state.nibbles);
    }
    state.lastAction = "width";
    pushLog("run", `# digits → ${w}`);
    renderAll();
  });
  document.getElementById("btn-encode").addEventListener("click", () => doEncode(decIn.value));
  document.getElementById("btn-decode").addEventListener("click", () => doDecode(hexIn.value));
  decIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doEncode(decIn.value);
  });
  hexIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doDecode(hexIn.value);
  });
  document.getElementById("btn-invalid").addEventListener("click", loadInvalid);
  document.getElementById("btn-trace").addEventListener("click", showTrace);
  document.querySelectorAll(".preset-row button").forEach((b) => {
    b.addEventListener("click", () => {
      const d = b.getAttribute("data-d");
      const need = String(d).length;
      if (need > state.width) {
        state.width = need;
        widthSel.value = String(need);
      }
      doEncode(d);
    });
  });

  const CHALLENGES = [
    {
      id: "quiz-nibble",
      title: "Quiz: bits/digit",
      prompt: "Bits per BCD digit? Answer: <code>4</code>",
      hint: "nibble",
      type: "text",
      answer: "4",
      alt: ["four", "4 bits"],
    },
    {
      id: "quiz-valid",
      title: "Quiz: max digit",
      prompt: "Largest valid BCD digit? Answer: <code>9</code>",
      hint: "decimal",
      type: "text",
      answer: "9",
    },
    {
      id: "quiz-invalid",
      title: "Quiz: invalid",
      prompt: "Is nibble 0xA valid BCD? Answer: <code>no</code>",
      hint: "10 decimal",
      type: "text",
      answer: "no",
      alt: ["n", "false", "invalid"],
    },
    {
      id: "quiz-pack42",
      title: "Quiz: 42 packing",
      prompt: "Decimal 42 as packed BCD hex? Answer: <code>0x42</code>",
      hint: "not 0x2A",
      type: "text",
      answer: "0x42",
      alt: ["42", "0X42"],
    },
    {
      id: "starter-42",
      title: "Starter 42",
      prompt: "Load starter — packed 0x42, valid, decimal 42.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 2 &&
        state.packed === 0x42n &&
        state.valid &&
        state.decimal === 42,
    },
    {
      id: "encode-99",
      title: "Encode 99",
      prompt: "Encode decimal 99 (2 digits) → 0x99.",
      hint: "preset 99 or Encode",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.encoded &&
        state.width === 2 &&
        state.packed === 0x99n &&
        state.decimal === 99,
    },
    {
      id: "encode-0",
      title: "Encode 0",
      prompt: "Encode 0 → packed 0x00 (2-digit).",
      hint: "preset 0",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 2 && state.packed === 0x00n && state.decimal === 0,
    },
    {
      id: "see-invalid",
      title: "See invalid",
      prompt: "Load invalid 0x4A — valid false, sawInvalid.",
      hint: "invalid button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sawInvalid && !state.valid && state.packed === 0x4an,
    },
    {
      id: "decode-42",
      title: "Decode 42",
      prompt: "Decode hex 42 → decimal 42.",
      hint: "Decode button",
      type: "state",
      setup: () => {
        loadStarter();
        state.decimal = null;
        state.packed = 0n;
        state.nibbles = [0, 0];
        state.decoded = false;
        renderAll();
      },
      check: () =>
        state.decoded && state.valid && state.decimal === 42 && state.packed === 0x42n,
    },
    {
      id: "three-255",
      title: "Three-digit 255",
      prompt: "Encode 255 with 3 digits → packed 0x255.",
      hint: "preset 255",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 3 &&
        state.packed === 0x255n &&
        state.decimal === 255,
    },
    {
      id: "quiz-vs-bin",
      title: "Quiz: vs binary",
      prompt: "Binary encoding of 42 is 0x2A; BCD is 0x42. Same? Answer: <code>no</code>",
      hint: "different layouts",
      type: "text",
      answer: "no",
      alt: ["n", "false", "different"],
    },
    {
      id: "four-2026",
      title: "Year 2026",
      prompt: "Encode 2026 (4 digits) → 0x2026.",
      hint: "preset 2026",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 4 &&
        state.packed === 0x2026n &&
        state.decimal === 2026,
    },
    {
      id: "show-trace",
      title: "Encode trace",
      prompt: "Show encode trace for current value.",
      hint: "Show encode trace",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.trace.length > 0 && state.encoded,
    },
    {
      id: "quiz-width-bits",
      title: "Quiz: width bits",
      prompt: "4 BCD digits need how many bits? Answer: <code>16</code>",
      hint: "4×4",
      type: "text",
      answer: "16",
      alt: ["16 bits"],
    },
    {
      id: "roundtrip",
      title: "Round-trip",
      prompt: "Encode 73, then decode the packed hex — still 73.",
      hint: "encode 73 → decode",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.encoded &&
        state.decoded &&
        state.decimal === 73 &&
        state.packed === 0x73n,
    },
    {
      id: "overflow-digits",
      title: "Need more digits",
      prompt: "With Digits=2, try Encode 100 — stays not encoded as 100 (error path).",
      hint: "width 2 → encode 100",
      type: "state",
      setup: () => {
        loadStarter();
        state.width = 2;
        widthSel.value = "2";
        renderAll();
      },
      check: () => {
        // User attempted; we detect via log message or decimal still not 100 with width 2
        return (
          state.width === 2 &&
          state.log.some((l) => /more than 2 digits/i.test(l.text))
        );
      },
    },
    {
      id: "quiz-msd",
      title: "Quiz: MSD",
      prompt: "Leftmost nibble is the? Answer: <code>msd</code>",
      hint: "most significant digit",
      type: "text",
      answer: "msd",
      alt: ["most significant digit", "most significant"],
    },
    {
      id: "nibble9",
      title: "Digit 9",
      prompt: "Encode 9 (1 digit) → nibble 1001.",
      hint: "Digits=1, encode 9",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 1 &&
        state.nibbles[0] === 9 &&
        state.packed === 0x9n,
    },
    {
      id: "fix-after-invalid",
      title: "Recover valid",
      prompt: "After invalid 0x4A, encode 42 again — valid.",
      hint: "invalid → encode 42",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sawInvalid &&
        state.valid &&
        state.decimal === 42 &&
        state.packed === 0x42n,
    },
    {
      id: "quiz-use",
      title: "Quiz: use",
      prompt: "BCD often feeds? Answer: <code>displays</code>",
      hint: "seven-seg / decimal UI",
      type: "text",
      answer: "displays",
      alt: ["display", "seven segment", "7-segment", "decimal displays"],
    },
    {
      id: "set-hex-af",
      title: "Hex path",
      prompt: "Decode any value via packed hex input (setHex).",
      hint: "type hex → Decode",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setHex && state.decoded,
    },
    {
      id: "full-bcd",
      title: "Full BCD",
      prompt: "Encode 42, see invalid once, encode 2026 valid.",
      hint: "42 → invalid → 2026",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sawInvalid &&
        state.valid &&
        state.decimal === 2026 &&
        state.packed === 0x2026n,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use BCD encode/decode, then Check.</span>`;
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

  renderMap();
  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
