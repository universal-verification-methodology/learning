(() => {
  /**
   * Bit-field extract / insert (little-endian bit index 0 = LSB):
   *   mask(hi,lo) = ((1<<(hi-lo+1))-1) << lo
   *   extract     = (word & mask) >> lo
   *   insert(v)   = (word & ~mask) | ((v & fieldMask) << lo)
   *
   * Demo CSR (16-bit):
   *   ENABLE [0]    MODE [2:1]    COUNT [7:3]    TAG [15:8]
   */

  const WIDTH = 16;

  const FIELDS = [
    { id: "enable", name: "ENABLE", hi: 0, lo: 0 },
    { id: "mode", name: "MODE", hi: 2, lo: 1 },
    { id: "count", name: "COUNT", hi: 7, lo: 3 },
    { id: "tag", name: "TAG", hi: 15, lo: 8 },
  ];

  function maskW() {
    return (1n << BigInt(WIDTH)) - 1n;
  }

  function fieldMask(hi, lo) {
    const w = hi - lo + 1;
    return ((1n << BigInt(w)) - 1n) << BigInt(lo);
  }

  function fieldWidth(hi, lo) {
    return hi - lo + 1;
  }

  function extract(word, hi, lo) {
    return (BigInt(word) & fieldMask(hi, lo)) >> BigInt(lo);
  }

  function insert(word, hi, lo, value) {
    const m = fieldMask(hi, lo);
    const v = BigInt(value) & ((1n << BigInt(fieldWidth(hi, lo))) - 1n);
    return (BigInt(word) & ~m & maskW()) | ((v << BigInt(lo)) & m);
  }

  function bitsOf(u) {
    return (BigInt(u) & maskW()).toString(2).padStart(WIDTH, "0");
  }

  function makeStarter() {
    // ENABLE=1, MODE=2, COUNT=5, TAG=0xA5
    // bits: [15:8]=A5, [7:3]=00101, [2:1]=10, [0]=1 → 0xA52D
    return {
      word: 0xa52dn,
      hi: 7,
      lo: 3,
      lastExtract: null,
      lastAction: "",
      extracted: false,
      inserted: false,
      packed: false,
      clearedField: false,
      usedNamed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-bit-fields-cleared-v1";
  const STORE_KEY = "ddv-bit-fields-session-v1";

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

  const root = document.getElementById("bf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 16-bit CSR <code>0xA52D</code> —
        <code>ENABLE=1</code>, <code>MODE=2</code>, <code>COUNT=5</code>, <code>TAG=0xA5</code>.
        Extract <code>[7:3]</code>, then insert a new COUNT.</p>
      <button type="button" class="btn btn-secondary" id="bf-starter">Load starter example</button>
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
            <h3>Extract</h3>
            <p><code>(word &amp; mask) &gt;&gt; lo</code> — isolate <code>[hi:lo]</code>.</p>
          </div>
          <div class="idea-card">
            <h3>Insert</h3>
            <p>Clear the field with <code>~mask</code>, then OR the shifted value.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Word &amp; slice</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Word hex
              <input id="word-in" type="text" style="width:6rem" placeholder="A529">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-set-word" style="padding:0.3rem 0.5rem;font-size:0.8rem">Set</button>
            <label>hi <input id="hi-in" type="number" min="0" max="15" value="7"></label>
            <label>lo <input id="lo-in" type="number" min="0" max="15" value="3"></label>
          </div>
          <div class="bits-row" id="bits-row"></div>
          <div class="vals-grid">
            <div class="val-card"><span class="lbl">Word</span><span id="val-word"></span></div>
            <div class="val-card"><span class="lbl">Slice</span><span id="val-slice"></span></div>
            <div class="val-card"><span class="lbl">Mask</span><span id="val-mask"></span></div>
            <div class="val-card"><span class="lbl">Extracted</span><span id="val-ext"></span></div>
          </div>
          <div class="ctrl-row">
            <label>Insert value
              <input id="ins-in" type="text" style="width:5rem" placeholder="5">
            </label>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-extract">Extract [hi:lo]</button>
            <button type="button" id="btn-insert">Insert value into [hi:lo]</button>
            <button type="button" id="btn-clear">Clear field (insert 0)</button>
            <button type="button" id="btn-show-mask">Show mask formula</button>
            <button type="button" id="btn-pack">Pack ENABLE=1 MODE=2 COUNT=7 TAG=0x3C</button>
          </div>
          <pre class="meta-box" id="meta-box"></pre>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Named CSR fields</h2></div>
        <div class="panel-body">
          <table class="field-table">
            <thead><tr><th>Field</th><th>Bits</th><th>Value</th><th></th></tr></thead>
            <tbody id="field-body"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Op</th><th>Pattern</th></tr></thead>
          <tbody>
            <tr><td>Mask</td><td><code>((1&lt;&lt;w)-1) &lt;&lt; lo</code> with <code>w=hi-lo+1</code></td></tr>
            <tr><td>Extract</td><td><code>(word &amp; mask) &gt;&gt; lo</code></td></tr>
            <tr><td>Insert</td><td><code>(word &amp; ~mask) | ((v &amp; ((1&lt;&lt;w)-1)) &lt;&lt; lo)</code></td></tr>
            <tr><td>HDL</td><td><code>word[hi:lo]</code> part-select (same idea)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Always mask the insert value to the field width — or it spills.</li>
          <li>Bit 0 is LSB in this lab (and typical C / Verilog little-endian bit numbering).</li>
          <li>Packing = successive inserts into a zeroed word.</li>
        </ul>
      </div>
    </div>
  `;

  const bitsRow = document.getElementById("bits-row");
  const metaBox = document.getElementById("meta-box");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const fieldBody = document.getElementById("field-body");
  const wordIn = document.getElementById("word-in");
  const hiIn = document.getElementById("hi-in");
  const loIn = document.getElementById("lo-in");
  const insIn = document.getElementById("ins-in");

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

  function clampSlice() {
    let hi = Number(hiIn.value);
    let lo = Number(loIn.value);
    if (!Number.isFinite(hi)) hi = 0;
    if (!Number.isFinite(lo)) lo = 0;
    hi = Math.max(0, Math.min(WIDTH - 1, hi | 0));
    lo = Math.max(0, Math.min(WIDTH - 1, lo | 0));
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    state.hi = hi;
    state.lo = lo;
    hiIn.value = String(hi);
    loIn.value = String(lo);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state: {
            ...state,
            word: state.word.toString(),
            lastExtract:
              state.lastExtract == null ? null : state.lastExtract.toString(),
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
      state.word = BigInt(data.state.word);
      state.lastExtract =
        data.state.lastExtract == null ? null : BigInt(data.state.lastExtract);
      challengeIdx = Number(data.challengeIdx) || 0;
      hiIn.value = String(state.hi);
      loIn.value = String(state.lo);
      return true;
    } catch {
      return false;
    }
  }

  function renderBits() {
    clampSlice();
    const bin = bitsOf(state.word);
    bitsRow.innerHTML = "";
    for (let i = WIDTH - 1; i >= 0; i--) {
      const bit = bin[WIDTH - 1 - i];
      const cell = document.createElement("div");
      cell.className = "bit-cell";
      const idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = String(i);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = bit;
      if (bit === "1") btn.classList.add("is-one");
      if (i >= state.lo && i <= state.hi) btn.classList.add("in-field");
      btn.addEventListener("click", () => {
        state.word ^= 1n << BigInt(i);
        state.lastAction = "toggle";
        pushLog("run", `# toggle bit ${i}`);
        renderAll();
      });
      cell.appendChild(idx);
      cell.appendChild(btn);
      bitsRow.appendChild(cell);
    }
  }

  function renderVals() {
    clampSlice();
    const m = fieldMask(state.hi, state.lo);
    const ext = extract(state.word, state.hi, state.lo);
    document.getElementById("val-word").textContent =
      "0x" + state.word.toString(16).toUpperCase().padStart(4, "0");
    document.getElementById("val-slice").textContent = `[${state.hi}:${state.lo}]`;
    document.getElementById("val-mask").textContent =
      "0x" + m.toString(16).toUpperCase().padStart(4, "0");
    document.getElementById("val-ext").textContent =
      state.lastExtract == null
        ? `(live ${ext})`
        : `0x${state.lastExtract.toString(16).toUpperCase()} (${state.lastExtract})`;
    wordIn.value = state.word.toString(16).toUpperCase().padStart(4, "0");
    metaBox.innerHTML = `<span class="hi">w=${fieldWidth(state.hi, state.lo)} bits</span>
<span class="muted">mask = ((1&lt;&lt;w)-1)&lt;&lt;lo</span>
<span class="ok">live extract = ${ext}</span>`;
  }

  function renderFields() {
    clampSlice();
    fieldBody.innerHTML = "";
    FIELDS.forEach((f) => {
      const v = extract(state.word, f.hi, f.lo);
      const active = state.hi === f.hi && state.lo === f.lo;
      const tr = document.createElement("tr");
      if (active) tr.className = "is-active";
      tr.innerHTML = `<td>${escapeHtml(f.name)}</td>
        <td>[${f.hi}:${f.lo}]</td>
        <td>0x${v.toString(16).toUpperCase()} (${v})</td>`;
      const td = document.createElement("td");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Select";
      b.addEventListener("click", () => {
        state.hi = f.hi;
        state.lo = f.lo;
        state.usedNamed = true;
        state.lastAction = "select-" + f.id;
        hiIn.value = String(f.hi);
        loIn.value = String(f.lo);
        pushLog("run", `# select ${f.name} [${f.hi}:${f.lo}]`);
        renderAll();
      });
      td.appendChild(b);
      tr.appendChild(td);
      fieldBody.appendChild(tr);
    });
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(extract / insert for a trace)</span>';
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
    renderBits();
    renderVals();
    renderFields();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    hiIn.value = "7";
    loIn.value = "3";
    state.lastAction = "load-starter";
    pushLog("muted", "# starter CSR 0xA52D — COUNT in [7:3]");
    state.trace = [];
    renderAll();
  }

  function setWord(raw) {
    let hex = String(raw).trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      pushLog("warn", "# invalid hex");
      renderAll();
      return;
    }
    state.word = BigInt("0x" + hex) & maskW();
    state.lastAction = "set-word";
    pushLog("ok", `# word = 0x${state.word.toString(16).toUpperCase()}`);
    renderAll();
  }

  function doExtract() {
    clampSlice();
    const m = fieldMask(state.hi, state.lo);
    const v = extract(state.word, state.hi, state.lo);
    state.lastExtract = v;
    state.extracted = true;
    state.lastAction = "extract";
    state.trace = [
      { kind: "muted", text: `extract word[${state.hi}:${state.lo}]` },
      { kind: "hi", text: `mask 0x${m.toString(16).toUpperCase()}` },
      { kind: "hi", text: `(word & mask) >> ${state.lo}` },
      { kind: "ok", text: `→ 0x${v.toString(16).toUpperCase()} (${v})` },
    ];
    pushLog("ok", `# extract → ${v}`);
    renderAll();
  }

  function doInsert(rawVal) {
    clampSlice();
    let v;
    const s = String(rawVal).trim();
    try {
      v = s.toLowerCase().startsWith("0x") ? BigInt(s) : BigInt(parseInt(s, 10));
    } catch {
      pushLog("warn", "# invalid insert value");
      renderAll();
      return;
    }
    const before = state.word;
    const m = fieldMask(state.hi, state.lo);
    state.word = insert(state.word, state.hi, state.lo, v);
    state.inserted = true;
    if (v === 0n) state.clearedField = true;
    state.lastAction = "insert";
    state.trace = [
      { kind: "muted", text: `insert ${v} into [${state.hi}:${state.lo}]` },
      { kind: "hi", text: `clear: word & ~0x${m.toString(16).toUpperCase()}` },
      { kind: "hi", text: `or: (v << ${state.lo}) & mask` },
      {
        kind: "ok",
        text: `0x${before.toString(16).toUpperCase()} → 0x${state.word.toString(16).toUpperCase()}`,
      },
    ];
    pushLog("ok", `# insert → 0x${state.word.toString(16).toUpperCase()}`);
    renderAll();
  }

  function showMask() {
    clampSlice();
    const w = fieldWidth(state.hi, state.lo);
    const m = fieldMask(state.hi, state.lo);
    state.lastAction = "mask";
    state.trace = [
      { kind: "muted", text: `mask for [${state.hi}:${state.lo}]` },
      { kind: "hi", text: `w = hi-lo+1 = ${w}` },
      { kind: "ok", text: `((1<<${w})-1)<<${state.lo} = 0x${m.toString(16).toUpperCase()}` },
    ];
    pushLog("ok", `# mask 0x${m.toString(16).toUpperCase()}`);
    renderAll();
  }

  function doPack() {
    let w = 0n;
    w = insert(w, 0, 0, 1n);
    w = insert(w, 2, 1, 2n);
    w = insert(w, 7, 3, 7n);
    w = insert(w, 15, 8, 0x3cn);
    state.word = w;
    state.packed = true;
    state.inserted = true;
    state.lastAction = "pack";
    state.hi = 7;
    state.lo = 3;
    hiIn.value = "7";
    loIn.value = "3";
    state.trace = [
      { kind: "muted", text: "pack fields into zero word" },
      { kind: "hi", text: "ENABLE=1 MODE=2 COUNT=7 TAG=0x3C" },
      { kind: "ok", text: `→ 0x${w.toString(16).toUpperCase()}` },
    ];
    pushLog("ok", `# packed 0x${w.toString(16).toUpperCase()}`);
    renderAll();
  }

  document.getElementById("bf-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-set-word").addEventListener("click", () => setWord(wordIn.value));
  wordIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setWord(wordIn.value);
  });
  hiIn.addEventListener("change", () => {
    clampSlice();
    renderAll();
  });
  loIn.addEventListener("change", () => {
    clampSlice();
    renderAll();
  });
  document.getElementById("btn-extract").addEventListener("click", doExtract);
  document.getElementById("btn-insert").addEventListener("click", () => doInsert(insIn.value || "0"));
  document.getElementById("btn-clear").addEventListener("click", () => doInsert(0));
  document.getElementById("btn-show-mask").addEventListener("click", showMask);
  document.getElementById("btn-pack").addEventListener("click", doPack);

  const CHALLENGES = [
    {
      id: "quiz-extract",
      title: "Quiz: extract",
      prompt: "Extract formula ends with? Answer: <code>>> lo</code>",
      hint: "shift down",
      type: "text",
      answer: ">> lo",
      alt: [">>lo", "shift right lo", ">>lo"],
    },
    {
      id: "quiz-mask",
      title: "Quiz: width",
      prompt: "Field width w = ? Answer: <code>hi-lo+1</code>",
      hint: "inclusive",
      type: "text",
      answer: "hi-lo+1",
      alt: ["hi - lo + 1", "hi-lo+1"],
    },
    {
      id: "quiz-insert",
      title: "Quiz: insert",
      prompt: "Before OR, clear field with? Answer: <code>~mask</code>",
      hint: "AND not mask",
      type: "text",
      answer: "~mask",
      alt: ["~mask", "and not mask", "& ~mask"],
    },
    {
      id: "quiz-lsb",
      title: "Quiz: bit 0",
      prompt: "Bit 0 in this lab is the? Answer: <code>lsb</code>",
      hint: "least",
      type: "text",
      answer: "lsb",
      alt: ["least significant", "least significant bit"],
    },
    {
      id: "starter-word",
      title: "Starter word",
      prompt: "Load starter — word 0xA52D.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.word === 0xa52dn,
    },
    {
      id: "extract-count",
      title: "Extract COUNT",
      prompt: "Extract [7:3] — value 5.",
      hint: "hi=7 lo=3 → Extract",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.extracted &&
        state.hi === 7 &&
        state.lo === 3 &&
        state.lastExtract === 5n,
    },
    {
      id: "extract-tag",
      title: "Extract TAG",
      prompt: "Select TAG, extract — 0xA5.",
      hint: "Select TAG → Extract",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.usedNamed &&
        state.hi === 15 &&
        state.lo === 8 &&
        state.lastExtract === 0xa5n,
    },
    {
      id: "extract-enable",
      title: "Extract ENABLE",
      prompt: "Select ENABLE [0:0], extract — 1.",
      hint: "Select ENABLE → Extract",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.hi === 0 &&
        state.lo === 0 &&
        state.lastExtract === 1n,
    },
    {
      id: "insert-count",
      title: "Insert COUNT",
      prompt: "On [7:3], insert 7 — COUNT becomes 7.",
      hint: "slice COUNT → insert 7",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.inserted &&
        extract(state.word, 7, 3) === 7n &&
        extract(state.word, 15, 8) === 0xa5n,
    },
    {
      id: "clear-field",
      title: "Clear field",
      prompt: "Clear [7:3] (insert 0) — COUNT 0, TAG unchanged.",
      hint: "Clear field button on COUNT",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.clearedField &&
        extract(state.word, 7, 3) === 0n &&
        extract(state.word, 15, 8) === 0xa5n,
    },
    {
      id: "show-mask",
      title: "Show mask",
      prompt: "Show mask formula for current slice.",
      hint: "Show mask formula",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "mask" && state.trace.length > 0,
    },
    {
      id: "pack-csr",
      title: "Pack CSR",
      prompt: "Pack ENABLE=1 MODE=2 COUNT=7 TAG=0x3C.",
      hint: "Pack button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (!state.packed) return false;
        return (
          extract(state.word, 0, 0) === 1n &&
          extract(state.word, 2, 1) === 2n &&
          extract(state.word, 7, 3) === 7n &&
          extract(state.word, 15, 8) === 0x3cn
        );
      },
    },
    {
      id: "quiz-mode-bits",
      title: "Quiz: MODE width",
      prompt: "MODE [2:1] width? Answer: <code>2</code>",
      hint: "2-1+1",
      type: "text",
      answer: "2",
      alt: ["2 bits"],
    },
    {
      id: "extract-mode",
      title: "Extract MODE",
      prompt: "Starter MODE extract = 2.",
      hint: "Select MODE → Extract",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.hi === 2 &&
        state.lo === 1 &&
        state.lastExtract === 2n,
    },
    {
      id: "set-word",
      title: "Set word",
      prompt: "Set word to 0x00FF via hex input.",
      hint: "type 00FF → Set",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.word === 0x00ffn && state.lastAction === "set-word",
    },
    {
      id: "quiz-spill",
      title: "Quiz: spill",
      prompt: "Insert without masking v can? Answer: <code>spill</code>",
      hint: "overwrite neighbors",
      type: "text",
      answer: "spill",
      alt: ["overflow", "spill bits", "corrupt"],
    },
    {
      id: "toggle-bit",
      title: "Toggle bit",
      prompt: "Toggle any bit in the word display.",
      hint: "click a bit",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "toggle",
    },
    {
      id: "quiz-hdl",
      title: "Quiz: HDL",
      prompt: "Verilog part-select looks like? Answer: <code>[hi:lo]</code>",
      hint: "brackets",
      type: "text",
      answer: "[hi:lo]",
      alt: ["[hi : lo]", "word[hi:lo]"],
    },
    {
      id: "insert-tag",
      title: "Insert TAG",
      prompt: "Select TAG, insert 0x10 — high byte 0x10.",
      hint: "TAG → insert 0x10 or 16",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.inserted && extract(state.word, 15, 8) === 0x10n,
    },
    {
      id: "roundtrip-count",
      title: "Round-trip COUNT",
      prompt: "Extract COUNT, insert 6, extract again — 6.",
      hint: "extract → insert 6 → extract",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.extracted &&
        state.inserted &&
        state.hi === 7 &&
        state.lo === 3 &&
        state.lastExtract === 6n &&
        extract(state.word, 7, 3) === 6n,
    },
    {
      id: "quiz-pack",
      title: "Quiz: pack",
      prompt: "Packing fields starts from? Answer: <code>zero</code>",
      hint: "empty word",
      type: "text",
      answer: "zero",
      alt: ["0", "zero word", "zeroed word"],
    },
    {
      id: "full-fields",
      title: "Full fields",
      prompt: "Extract COUNT, clear it, then pack the demo CSR.",
      hint: "extract → clear → pack",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.extracted &&
        state.clearedField &&
        state.packed &&
        extract(state.word, 7, 3) === 7n,
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use extract/insert, then Check.</span>`;
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
