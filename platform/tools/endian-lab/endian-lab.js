(() => {
  /**
   * Endian packing for a 32-bit word at base address 0x1000:
   *   Little-endian: addr+0 = LSB … addr+3 = MSB
   *   Big-endian:    addr+0 = MSB … addr+3 = LSB
   * Network / “wire” order is typically big-endian.
   */

  const BASE = 0x1000;

  function mask32(u) {
    return BigInt(u) & 0xffffffffn;
  }

  function bytesOfWord(word, endian) {
    const w = Number(mask32(word));
    const b0 = (w >>> 0) & 0xff;
    const b1 = (w >>> 8) & 0xff;
    const b2 = (w >>> 16) & 0xff;
    const b3 = (w >>> 24) & 0xff;
    // logical byte significance: b0=LSB … b3=MSB of the integer value
    if (endian === "le") return [b0, b1, b2, b3]; // addr order
    return [b3, b2, b1, b0];
  }

  function wordFromBytes(bytes, endian) {
    const [a, b, c, d] = bytes.map((x) => x & 0xff);
    if (endian === "le") {
      return mask32(
        BigInt(a) |
          (BigInt(b) << 8n) |
          (BigInt(c) << 16n) |
          (BigInt(d) << 24n)
      );
    }
    return mask32(
      (BigInt(a) << 24n) |
        (BigInt(b) << 16n) |
        (BigInt(c) << 8n) |
        BigInt(d)
    );
  }

  function swapEndian(word) {
    const b = bytesOfWord(word, "le");
    return wordFromBytes(b, "be"); // reinterpret LE layout as BE packing
  }

  function hexByte(n) {
    return (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function hexWord(w) {
    return mask32(w).toString(16).toUpperCase().padStart(8, "0");
  }

  function makeStarter() {
    // 0x12345678 classic demo
    return {
      word: 0x12345678n,
      endian: "le",
      bytes: bytesOfWord(0x12345678n, "le"),
      lastAction: "",
      packed: false,
      unpacked: false,
      swapped: false,
      setWord: false,
      compared: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-endian-lab-cleared-v1";
  const STORE_KEY = "ddv-endian-lab-session-v1";

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

  const root = document.getElementById("en-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Word <code>0x12345678</code>.
        Little-endian memory is <code>78 56 34 12</code>; big-endian is
        <code>12 34 56 78</code>. Flip the mode and pack/unpack.</p>
      <button type="button" class="btn btn-secondary" id="en-starter">Load starter example</button>
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
            <h3>Little-endian</h3>
            <p>Lowest address stores the <strong>LSB</strong> of the word.</p>
          </div>
          <div class="idea-card">
            <h3>Big-endian</h3>
            <p>Lowest address stores the <strong>MSB</strong> — common on the wire.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Word ↔ memory</h2></div>
        <div class="panel-body">
          <div class="mode-row">
            <label><input type="radio" name="endian" value="le" checked> Little-endian</label>
            <label><input type="radio" name="endian" value="be"> Big-endian</label>
          </div>
          <div class="ctrl-row">
            <label>Word
              <input id="word-in" type="text" style="width:8rem" placeholder="12345678">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-set-word" style="padding:0.3rem 0.55rem;font-size:0.8rem">Set word</button>
          </div>
          <div class="word-card">
            <span class="lbl">Integer value (endian-independent)</span>
            <span id="val-word"></span>
          </div>
          <div class="mem-grid" id="mem-grid"></div>
          <div class="action-grid">
            <button type="button" id="btn-unpack">Unpack word → bytes</button>
            <button type="button" id="btn-pack">Pack bytes → word</button>
            <button type="button" id="btn-swap">Byte-swap word (endian flip)</button>
            <button type="button" id="btn-preset">Preset 0x12345678</button>
            <button type="button" id="btn-compare">Compare LE vs BE layouts</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Trace</h3>
          <pre class="trace-box" id="trace-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Side-by-side</h2></div>
        <div class="panel-body">
          <table class="compare-table">
            <thead><tr><th>Addr</th><th>LE byte</th><th>BE byte</th><th>Role @+0</th></tr></thead>
            <tbody id="compare-body"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Idea</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>Value</td><td>The integer <code>0x12345678</code> is the same; only byte <em>placement</em> changes</td></tr>
            <tr><td>LE</td><td><code>[78,56,34,12]</code> at rising addresses</td></tr>
            <tr><td>BE</td><td><code>[12,34,56,78]</code> at rising addresses</td></tr>
            <tr><td>Swap</td><td>Reverse the four bytes in memory order</td></tr>
            <tr><td>Network</td><td>Often big-endian (“network byte order”)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Host endianness ≠ wire format — convert at the boundary.</li>
          <li>Misreading endianness looks like a “wrong” constant in dumps.</li>
          <li>Halfwords/words must agree on endianness across CPU and peripherals.</li>
        </ul>
      </div>
    </div>
  `;

  const memGrid = document.getElementById("mem-grid");
  const compareBody = document.getElementById("compare-body");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const wordIn = document.getElementById("word-in");

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
          state: { ...state, word: state.word.toString() },
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
      challengeIdx = Number(data.challengeIdx) || 0;
      document.querySelectorAll('input[name="endian"]').forEach((el) => {
        el.checked = el.value === state.endian;
      });
      return true;
    } catch {
      return false;
    }
  }

  function syncBytesFromWord() {
    state.bytes = bytesOfWord(state.word, state.endian);
  }

  function renderMem() {
    memGrid.innerHTML = "";
    state.bytes.forEach((b, i) => {
      const isMsb =
        (state.endian === "be" && i === 0) || (state.endian === "le" && i === 3);
      const isLsb =
        (state.endian === "le" && i === 0) || (state.endian === "be" && i === 3);
      const cell = document.createElement("div");
      cell.className =
        "mem-cell" + (isMsb ? " msb" : "") + (isLsb ? " lsb" : "");
      const addr = BASE + i;
      cell.innerHTML = `<span class="addr">0x${addr.toString(16).toUpperCase()}</span>`;
      const inp = document.createElement("input");
      inp.value = hexByte(b);
      inp.addEventListener("change", () => {
        const v = parseInt(inp.value, 16);
        if (Number.isFinite(v)) {
          state.bytes[i] = v & 0xff;
          state.lastAction = "edit-byte";
          renderAll();
        }
      });
      cell.appendChild(inp);
      const lane = document.createElement("span");
      lane.className = "lane";
      lane.textContent = isMsb ? "MSB" : isLsb ? "LSB" : `+${i}`;
      cell.appendChild(lane);
      memGrid.appendChild(cell);
    });
  }

  function renderWord() {
    document.getElementById("val-word").textContent = "0x" + hexWord(state.word);
    wordIn.value = hexWord(state.word);
  }

  function renderCompare() {
    const le = bytesOfWord(state.word, "le");
    const be = bytesOfWord(state.word, "be");
    compareBody.innerHTML = [0, 1, 2, 3]
      .map((i) => {
        const role =
          i === 0
            ? state.endian === "le"
              ? "LE:LSB / BE:MSB"
              : "LE:LSB / BE:MSB"
            : "";
        const roleFixed =
          i === 0 ? "LSB if LE · MSB if BE" : i === 3 ? "MSB if LE · LSB if BE" : "—";
        return `<tr>
          <td>0x${(BASE + i).toString(16).toUpperCase()}</td>
          <td>${hexByte(le[i])}</td>
          <td>${hexByte(be[i])}</td>
          <td>${roleFixed}</td>
        </tr>`;
      })
      .join("");
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(pack / unpack for a trace)</span>';
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
    renderWord();
    renderMem();
    renderCompare();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    document.querySelectorAll('input[name="endian"]').forEach((el) => {
      el.checked = el.value === "le";
    });
    state.lastAction = "load-starter";
    pushLog("muted", "# starter 0x12345678 — LE bytes 78 56 34 12");
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
    state.word = mask32(BigInt("0x" + hex));
    syncBytesFromWord();
    state.setWord = true;
    state.lastAction = "set-word";
    pushLog("ok", `# word 0x${hexWord(state.word)}`);
    renderAll();
  }

  function doUnpack() {
    syncBytesFromWord();
    state.unpacked = true;
    state.lastAction = "unpack";
    const label = state.endian === "le" ? "little-endian" : "big-endian";
    state.trace = [
      { kind: "muted", text: `unpack 0x${hexWord(state.word)} as ${label}` },
      {
        kind: "hi",
        text: state.endian === "le" ? "addr+0 ← LSB" : "addr+0 ← MSB",
      },
      {
        kind: "ok",
        text: state.bytes.map(hexByte).join(" "),
      },
    ];
    pushLog("ok", `# unpack → ${state.bytes.map(hexByte).join(" ")}`);
    renderAll();
  }

  function doPack() {
    state.word = wordFromBytes(state.bytes, state.endian);
    state.packed = true;
    state.lastAction = "pack";
    const label = state.endian === "le" ? "LE" : "BE";
    state.trace = [
      { kind: "muted", text: `pack ${label} bytes → word` },
      { kind: "hi", text: state.bytes.map(hexByte).join(" ") },
      { kind: "ok", text: `→ 0x${hexWord(state.word)}` },
    ];
    pushLog("ok", `# pack → 0x${hexWord(state.word)}`);
    renderAll();
  }

  function doSwap() {
    const before = state.word;
    state.word = swapEndian(before);
    syncBytesFromWord();
    state.swapped = true;
    state.lastAction = "swap";
    state.trace = [
      { kind: "muted", text: "byte-swap (reverse memory order of LE layout)" },
      { kind: "hi", text: `0x${hexWord(before)} → 0x${hexWord(state.word)}` },
      { kind: "ok", text: `bytes now ${state.bytes.map(hexByte).join(" ")}` },
    ];
    pushLog("ok", `# swap → 0x${hexWord(state.word)}`);
    renderAll();
  }

  function doCompare() {
    state.compared = true;
    state.lastAction = "compare";
    const le = bytesOfWord(state.word, "le").map(hexByte).join(" ");
    const be = bytesOfWord(state.word, "be").map(hexByte).join(" ");
    state.trace = [
      { kind: "muted", text: `compare layouts for 0x${hexWord(state.word)}` },
      { kind: "hi", text: `LE: ${le}` },
      { kind: "ok", text: `BE: ${be}` },
    ];
    pushLog("ok", "# compared LE vs BE");
    renderAll();
  }

  document.getElementById("en-starter").addEventListener("click", loadStarter);
  document.querySelectorAll('input[name="endian"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      state.endian = el.value;
      syncBytesFromWord();
      state.lastAction = "mode";
      pushLog("run", `# mode → ${state.endian === "le" ? "little" : "big"}-endian`);
      renderAll();
    });
  });
  document.getElementById("btn-set-word").addEventListener("click", () => setWord(wordIn.value));
  wordIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setWord(wordIn.value);
  });
  document.getElementById("btn-unpack").addEventListener("click", doUnpack);
  document.getElementById("btn-pack").addEventListener("click", doPack);
  document.getElementById("btn-swap").addEventListener("click", doSwap);
  document.getElementById("btn-compare").addEventListener("click", doCompare);
  document.getElementById("btn-preset").addEventListener("click", () => {
    state.word = 0x12345678n;
    syncBytesFromWord();
    state.lastAction = "preset";
    pushLog("ok", "# preset 0x12345678");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-le",
      title: "Quiz: LE",
      prompt: "Little-endian stores at lowest address the? Answer: <code>lsb</code>",
      hint: "least significant byte",
      type: "text",
      answer: "lsb",
      alt: ["least significant", "least significant byte"],
    },
    {
      id: "quiz-be",
      title: "Quiz: BE",
      prompt: "Big-endian stores at lowest address the? Answer: <code>msb</code>",
      hint: "most significant byte",
      type: "text",
      answer: "msb",
      alt: ["most significant", "most significant byte"],
    },
    {
      id: "quiz-network",
      title: "Quiz: network",
      prompt: "Network byte order is usually? Answer: <code>big</code>",
      hint: "BE",
      type: "text",
      answer: "big",
      alt: ["be", "big-endian", "big endian"],
    },
    {
      id: "quiz-value",
      title: "Quiz: value",
      prompt: "Endianness changes the integer value of 0x12345678? Answer: <code>no</code>",
      hint: "placement only",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "starter-word",
      title: "Starter word",
      prompt: "Load starter — word 0x12345678.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.word === 0x12345678n,
    },
    {
      id: "unpack-le",
      title: "Unpack LE",
      prompt: "LE mode: unpack — bytes 78 56 34 12.",
      hint: "LE → Unpack",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.endian === "le" &&
        state.unpacked &&
        state.bytes.map(hexByte).join("") === "78563412",
    },
    {
      id: "unpack-be",
      title: "Unpack BE",
      prompt: "BE mode: unpack — bytes 12 34 56 78.",
      hint: "Big-endian → Unpack",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.endian === "be" &&
        state.unpacked &&
        state.bytes.map(hexByte).join("") === "12345678",
    },
    {
      id: "compare-layouts",
      title: "Compare",
      prompt: "Click Compare LE vs BE layouts.",
      hint: "Compare button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.compared && state.lastAction === "compare",
    },
    {
      id: "swap-word",
      title: "Byte-swap",
      prompt: "From starter, byte-swap → 0x78563412.",
      hint: "Byte-swap button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.swapped && state.word === 0x78563412n,
    },
    {
      id: "pack-le",
      title: "Pack LE",
      prompt: "LE: set memory bytes to AA BB CC DD, pack → 0xDDCCBBAA.",
      hint: "edit cells → Pack",
      type: "state",
      setup: () => {
        loadStarter();
        state.endian = "le";
        document.querySelectorAll('input[name="endian"]').forEach((el) => {
          el.checked = el.value === "le";
        });
        renderAll();
      },
      check: () =>
        state.endian === "le" &&
        state.packed &&
        state.word === 0xddccbbaan,
    },
    {
      id: "pack-be",
      title: "Pack BE",
      prompt: "BE: bytes AA BB CC DD at +0..+3, pack → 0xAABBCCDD.",
      hint: "BE → edit → Pack",
      type: "state",
      setup: () => {
        loadStarter();
        state.endian = "be";
        document.querySelectorAll('input[name="endian"]').forEach((el) => {
          el.checked = el.value === "be";
        });
        syncBytesFromWord();
        renderAll();
      },
      check: () =>
        state.endian === "be" &&
        state.packed &&
        state.word === 0xaabbccddn,
    },
    {
      id: "quiz-le-first",
      title: "Quiz: LE first",
      prompt: "For 0x12345678 LE, byte at +0? Answer: <code>78</code>",
      hint: "LSB",
      type: "text",
      answer: "78",
      alt: ["0x78"],
    },
    {
      id: "quiz-be-first",
      title: "Quiz: BE first",
      prompt: "For 0x12345678 BE, byte at +0? Answer: <code>12</code>",
      hint: "MSB",
      type: "text",
      answer: "12",
      alt: ["0x12"],
    },
    {
      id: "set-deadbeef",
      title: "Set DEADBEEF",
      prompt: "Set word to 0xDEADBEEF.",
      hint: "type DEADBEEF → Set word",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.word === 0xdeadbeefn && state.setWord,
    },
    {
      id: "preset",
      title: "Preset",
      prompt: "After changing word, Preset 0x12345678.",
      hint: "Preset button",
      type: "state",
      setup: () => {
        loadStarter();
        state.word = 0n;
        syncBytesFromWord();
        renderAll();
      },
      check: () => state.word === 0x12345678n && state.lastAction === "preset",
    },
    {
      id: "mode-switch",
      title: "Mode switch",
      prompt: "Switch to big-endian (mode action).",
      hint: "Big-endian radio",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.endian === "be" && state.lastAction === "mode",
    },
    {
      id: "quiz-host",
      title: "Quiz: host",
      prompt: "Host endian always equals wire endian? Answer: <code>no</code>",
      hint: "convert at boundary",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "roundtrip",
      title: "Round-trip",
      prompt: "Unpack then pack in same mode — word unchanged 0x12345678.",
      hint: "unpack → pack",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.unpacked &&
        state.packed &&
        state.word === 0x12345678n,
    },
    {
      id: "swap-twice",
      title: "Swap twice",
      prompt: "Byte-swap twice — back to 0x12345678.",
      hint: "swap → swap",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.swapped && state.word === 0x12345678n,
    },
    {
      id: "quiz-dump",
      title: "Quiz: dump",
      prompt: "Wrong endian in a dump looks like a wrong? Answer: <code>constant</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "constant",
      alt: ["value", "constant value", "number"],
    },
    {
      id: "edit-byte",
      title: "Edit byte",
      prompt: "Edit any memory cell (edit-byte action).",
      hint: "change a hex cell",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "edit-byte",
    },
    {
      id: "full-endian",
      title: "Full endian",
      prompt: "Unpack LE, switch BE & unpack, compare, and swap once.",
      hint: "LE unpack → BE unpack → compare → swap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.unpacked &&
        state.endian === "be" &&
        state.compared &&
        state.swapped,
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use endian actions, then Check.</span>`;
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
