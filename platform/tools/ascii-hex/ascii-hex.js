(() => {
  /**
   * Hex dump literacy (xxd / hexdump -C style):
   *   offset | hex bytes | ASCII (printable 0x20–0x7E, else '.')
   */

  const BASE = 0x0000;
  const COLS = 16;

  function isPrintable(b) {
    return b >= 0x20 && b <= 0x7e;
  }

  function ascChar(b) {
    return isPrintable(b) ? String.fromCharCode(b) : ".";
  }

  function hexByte(b) {
    return (b & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function encodeAscii(str) {
    return Array.from(str).map((ch) => ch.charCodeAt(0) & 0xff);
  }

  function makeStarter() {
    // "Hi\nOK\0" + padding demo: Hi, LF, OK, NUL
    const bytes = encodeAscii("Hi\nOK");
    bytes.push(0x00);
    while (bytes.length < 16) bytes.push(0x00);
    // also put "ABC" at offset 8 for variety
    bytes[8] = 0x41;
    bytes[9] = 0x42;
    bytes[10] = 0x43;
    bytes[11] = 0xff; // non-printable
    return {
      bytes,
      sel: 0,
      lastAction: "",
      loadedText: false,
      edited: false,
      foundLf: false,
      foundNul: false,
      foundSpace: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-ascii-hex-cleared-v1";
  const STORE_KEY = "ddv-ascii-hex-session-v1";

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

  const root = document.getElementById("ah-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Buffer starts with <code>Hi</code>, a newline
        (<code>0x0A</code>), <code>OK</code>, then <code>NUL</code>. Read the dump’s
        offset, hex, and ASCII columns together.</p>
      <button type="button" class="btn btn-secondary" id="ah-starter">Load starter example</button>
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
            <h3>Three columns</h3>
            <p>Offset · hex bytes · ASCII glyph (or <code>.</code> if not printable).</p>
          </div>
          <div class="idea-card">
            <h3>Printable</h3>
            <p>Usually <code>0x20–0x7E</code>. Controls like <code>LF=0x0A</code> show as <code>.</code>.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Hex dump</h2></div>
        <div class="panel-body">
          <pre class="dump-box" id="dump-box"></pre>
          <div class="detail-card">
            <span class="lbl">Selected byte</span>
            <div id="detail"></div>
          </div>
          <div class="byte-grid" id="byte-grid"></div>
          <div class="ctrl-row">
            <label>Text → bytes
              <input id="text-in" type="text" style="min-width:12rem" placeholder="Hello">
            </label>
            <button type="button" class="btn btn-secondary" id="btn-load-text" style="padding:0.3rem 0.55rem;font-size:0.8rem">Load text</button>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-lf">Write LF (0x0A) at sel</button>
            <button type="button" id="btn-sp">Write space (0x20) at sel</button>
            <button type="button" id="btn-nul">Write NUL (0x00) at sel</button>
            <button type="button" id="btn-clear">Fill zeros</button>
            <button type="button" id="btn-explain">Explain selected</button>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Common ASCII</h2></div>
        <div class="panel-body">
          <div class="table-wrap">
            <table class="ascii-table">
              <thead><tr><th>Hex</th><th>Dec</th><th>Glyph / name</th></tr></thead>
              <tbody id="ascii-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Byte</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>0x00</code></td><td>NUL — C string terminator; shows as <code>.</code></td></tr>
            <tr><td><code>0x0A</code></td><td>LF newline</td></tr>
            <tr><td><code>0x0D</code></td><td>CR (often with LF on Windows)</td></tr>
            <tr><td><code>0x20</code></td><td>Space (printable)</td></tr>
            <tr><td><code>0x30–0x39</code></td><td><code>'0'</code>–<code>'9'</code></td></tr>
            <tr><td><code>0x41–0x5A</code></td><td><code>'A'</code>–<code>'Z'</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>ASCII column is a hint, not a decoder for UTF-8 multi-byte text.</li>
          <li>Offset is usually hex; row length is often 16 bytes.</li>
          <li>Binary files are full of <code>.</code> in the ASCII gutter.</li>
        </ul>
      </div>
    </div>
  `;

  const dumpBox = document.getElementById("dump-box");
  const byteGrid = document.getElementById("byte-grid");
  const detail = document.getElementById("detail");
  const asciiBody = document.getElementById("ascii-body");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const textIn = document.getElementById("text-in");

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

  function renderDump() {
    const lines = [];
    for (let off = 0; off < state.bytes.length; off += COLS) {
      const slice = state.bytes.slice(off, off + COLS);
      const hexParts = [];
      for (let i = 0; i < COLS; i++) {
        if (i < slice.length) {
          const b = slice[i];
          const idx = off + i;
          const cls = idx === state.sel ? "hex is-sel" : "hex";
          hexParts.push(`<span class="${cls}">${hexByte(b)}</span>`);
        } else hexParts.push("  ");
        if (i === 7) hexParts.push("");
      }
      const asc = slice
        .map((b, i) => {
          const idx = off + i;
          const ch = ascChar(b);
          const cls =
            (idx === state.sel ? "asc is-sel" : "asc") +
            (isPrintable(b) ? "" : " dot");
          return `<span class="${cls}">${escapeHtml(ch)}</span>`;
        })
        .join("");
      const o = (BASE + off).toString(16).toUpperCase().padStart(8, "0");
      lines.push(
        `<span class="off">${o}</span>  ${hexParts.join(" ")}  |${asc}|`
      );
    }
    dumpBox.innerHTML = lines.join("\n");
  }

  function renderDetail() {
    const b = state.bytes[state.sel] ?? 0;
    const ch = isPrintable(b) ? JSON.stringify(String.fromCharCode(b)) : "(non-printable)";
    detail.innerHTML = `offset 0x${state.sel.toString(16).toUpperCase()} · hex ${hexByte(b)} · dec ${b} · ASCII ${escapeHtml(ch)} · glyph <strong>${escapeHtml(ascChar(b))}</strong>`;
  }

  function renderGrid() {
    byteGrid.innerHTML = "";
    state.bytes.forEach((b, i) => {
      const cell = document.createElement("div");
      cell.className = "byte-cell" + (i === state.sel ? " is-active" : "");
      cell.innerHTML = `<span class="i">${i}</span>`;
      const inp = document.createElement("input");
      inp.value = hexByte(b);
      inp.addEventListener("focus", () => {
        state.sel = i;
        renderAll();
      });
      inp.addEventListener("change", () => {
        const v = parseInt(inp.value, 16);
        if (Number.isFinite(v)) {
          state.bytes[i] = v & 0xff;
          state.edited = true;
          state.sel = i;
          state.lastAction = "edit";
          if (state.bytes[i] === 0x0a) state.foundLf = true;
          if (state.bytes[i] === 0x00) state.foundNul = true;
          if (state.bytes[i] === 0x20) state.foundSpace = true;
          pushLog("run", `# edit [${i}] = ${hexByte(state.bytes[i])}`);
          renderAll();
        }
      });
      cell.addEventListener("click", () => {
        state.sel = i;
        state.lastAction = "select";
        renderAll();
      });
      cell.appendChild(inp);
      byteGrid.appendChild(cell);
    });
  }

  function renderAsciiTable() {
    const rows = [
      [0x00, "NUL"],
      [0x09, "TAB"],
      [0x0a, "LF"],
      [0x0d, "CR"],
      [0x20, "' ' space"],
      [0x30, "'0'"],
      [0x39, "'9'"],
      [0x41, "'A'"],
      [0x61, "'a'"],
      [0x7e, "'~'"],
      [0x7f, "DEL"],
      [0xff, "(often .)"],
    ];
    const b = state.bytes[state.sel] ?? -1;
    asciiBody.innerHTML = rows
      .map(([h, name]) => {
        const hi = h === b ? " is-hi" : "";
        return `<tr class="${hi}"><td>${hexByte(h)}</td><td>${h}</td><td>${escapeHtml(name)}</td></tr>`;
      })
      .join("");
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(explain a byte for a trace)</span>';
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
    renderDump();
    renderDetail();
    renderGrid();
    renderAsciiTable();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: Hi \\n OK \\0 … and ABC at offset 8");
    state.trace = [];
    renderAll();
  }

  function loadText() {
    const t = textIn.value;
    const arr = encodeAscii(t);
    while (arr.length < 16) arr.push(0);
    state.bytes = arr.slice(0, 32);
    state.loadedText = true;
    state.sel = 0;
    state.lastAction = "load-text";
    pushLog("ok", `# loaded ${t.length} chars → ${state.bytes.length} bytes`);
    renderAll();
  }

  function writeAtSel(val, flag) {
    state.bytes[state.sel] = val & 0xff;
    state.edited = true;
    if (flag === "lf") state.foundLf = true;
    if (flag === "nul") state.foundNul = true;
    if (flag === "sp") state.foundSpace = true;
    state.lastAction = flag || "write";
    pushLog("ok", `# [${state.sel}] = ${hexByte(val)}`);
    renderAll();
  }

  function explain() {
    const b = state.bytes[state.sel] ?? 0;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: `byte @ 0x${state.sel.toString(16)}` },
      { kind: "hi", text: `hex ${hexByte(b)}  dec ${b}` },
      {
        kind: "ok",
        text: isPrintable(b)
          ? `printable ASCII ${JSON.stringify(String.fromCharCode(b))}`
          : `non-printable → dump shows '.'`,
      },
    ];
    if (b === 0x0a) state.foundLf = true;
    if (b === 0x00) state.foundNul = true;
    if (b === 0x20) state.foundSpace = true;
    pushLog("ok", "# explained selection");
    renderAll();
  }

  document.getElementById("ah-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-load-text").addEventListener("click", loadText);
  textIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadText();
  });
  document.getElementById("btn-lf").addEventListener("click", () => writeAtSel(0x0a, "lf"));
  document.getElementById("btn-sp").addEventListener("click", () => writeAtSel(0x20, "sp"));
  document.getElementById("btn-nul").addEventListener("click", () => writeAtSel(0x00, "nul"));
  document.getElementById("btn-clear").addEventListener("click", () => {
    state.bytes = state.bytes.map(() => 0);
    state.lastAction = "clear";
    pushLog("muted", "# filled zeros");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-printable",
      title: "Quiz: printable",
      prompt: "Printable ASCII range starts at? Answer: <code>0x20</code>",
      hint: "space",
      type: "text",
      answer: "0x20",
      alt: ["20", "32", "0x20"],
    },
    {
      id: "quiz-lf",
      title: "Quiz: LF",
      prompt: "Newline LF hex? Answer: <code>0x0a</code>",
      hint: "10 decimal",
      type: "text",
      answer: "0x0a",
      alt: ["0a", "10", "0x0A"],
    },
    {
      id: "quiz-nul",
      title: "Quiz: NUL",
      prompt: "C string terminator byte? Answer: <code>0x00</code>",
      hint: "zero",
      type: "text",
      answer: "0x00",
      alt: ["0", "00", "nul"],
    },
    {
      id: "quiz-dot",
      title: "Quiz: dot",
      prompt: "Non-printable bytes show as? Answer: <code>.</code>",
      hint: "gutter",
      type: "text",
      answer: ".",
      alt: ["dot", "period"],
    },
    {
      id: "starter-hi",
      title: "Starter Hi",
      prompt: "Load starter — byte0 is 'H' (0x48).",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.bytes[0] === 0x48 && state.bytes[1] === 0x69,
    },
    {
      id: "find-lf",
      title: "Find LF",
      prompt: "Select the newline byte (offset 2 = 0x0A) and Explain.",
      hint: "click offset 2 → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sel === 2 &&
        state.bytes[2] === 0x0a &&
        state.lastAction === "explain",
    },
    {
      id: "find-nul",
      title: "Find NUL",
      prompt: "Select offset 5 (NUL after OK) and Explain.",
      hint: "Hi\\nOK then NUL",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sel === 5 &&
        state.bytes[5] === 0x00 &&
        (state.lastAction === "explain" || state.foundNul),
    },
    {
      id: "write-lf",
      title: "Write LF",
      prompt: "Write LF at the current selection.",
      hint: "Write LF button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.foundLf && state.bytes[state.sel] === 0x0a,
    },
    {
      id: "write-space",
      title: "Write space",
      prompt: "Write space 0x20 at selection.",
      hint: "Write space button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.foundSpace && state.bytes[state.sel] === 0x20,
    },
    {
      id: "write-nul",
      title: "Write NUL",
      prompt: "Write NUL at selection.",
      hint: "Write NUL button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.foundNul && state.bytes[state.sel] === 0x00,
    },
    {
      id: "load-hello",
      title: "Load Hello",
      prompt: "Load text <code>Hello</code> into the buffer.",
      hint: "type Hello → Load text",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.loadedText &&
        state.bytes[0] === 0x48 &&
        state.bytes[4] === 0x6f,
    },
    {
      id: "quiz-A",
      title: "Quiz: 'A'",
      prompt: "ASCII 'A' hex? Answer: <code>0x41</code>",
      hint: "table",
      type: "text",
      answer: "0x41",
      alt: ["41", "65"],
    },
    {
      id: "see-abc",
      title: "See ABC",
      prompt: "Starter has 'A' at offset 8 — select it.",
      hint: "click byte 8",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.sel === 8 && state.bytes[8] === 0x41,
    },
    {
      id: "ff-dot",
      title: "0xFF is dot",
      prompt: "Select offset 11 (0xFF) — glyph is '.' .",
      hint: "byte 11",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sel === 11 &&
        state.bytes[11] === 0xff &&
        !isPrintable(0xff),
    },
    {
      id: "edit-byte",
      title: "Edit byte",
      prompt: "Edit any hex cell in the grid.",
      hint: "change an input",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.edited && state.lastAction === "edit",
    },
    {
      id: "quiz-cols",
      title: "Quiz: columns",
      prompt: "Classic dump row length (bytes)? Answer: <code>16</code>",
      hint: "this lab",
      type: "text",
      answer: "16",
      alt: ["16 bytes"],
    },
    {
      id: "clear-buf",
      title: "Fill zeros",
      prompt: "Fill zeros — all bytes 0.",
      hint: "Fill zeros",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "clear" &&
        state.bytes.every((b) => b === 0),
    },
    {
      id: "quiz-cr",
      title: "Quiz: CR",
      prompt: "Carriage return hex? Answer: <code>0x0d</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "0x0d",
      alt: ["0d", "13", "0x0D"],
    },
    {
      id: "explain-space",
      title: "Explain space",
      prompt: "Write space, then Explain — printable.",
      hint: "space → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.foundSpace &&
        state.lastAction === "explain" &&
        state.bytes[state.sel] === 0x20 &&
        state.trace.some((l) => /printable/i.test(l.text)),
    },
    {
      id: "quiz-utf8",
      title: "Quiz: UTF-8",
      prompt: "ASCII column fully decodes UTF-8? Answer: <code>no</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "offset-zero",
      title: "Offset 0",
      prompt: "Select offset 0 and Explain the 'H'.",
      hint: "sel 0 → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sel === 0 &&
        state.bytes[0] === 0x48 &&
        state.lastAction === "explain",
    },
    {
      id: "full-dump",
      title: "Full dump",
      prompt: "Explain LF, write a space somewhere, and load text once.",
      hint: "find LF → space → Load text",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.foundLf &&
        state.foundSpace &&
        state.loadedText,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the dump, then Check.</span>`;
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
