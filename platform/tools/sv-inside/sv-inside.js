(() => {
  /**
   * inside / wildcard equality (concept model, 4-bit):
   *   a inside {v0, v1, [lo:hi]}  — membership / ranges
   *   a ==? mask   — RHS x/? bits are don't-care; other bits must match
   *   a !=? mask   — negation of ==?
   * Note: wildcards live on the right of ==? / !=? (LRM).
   */

  const WIDTH = 4;

  /** Set presets: list of members (numbers) + optional ranges {lo,hi} */
  const SETS = {
    small: {
      label: "{0, 1, 3}",
      members: [0, 1, 3],
      ranges: [],
    },
    range: {
      label: "{[4:6], 9}",
      members: [9],
      ranges: [{ lo: 4, hi: 6 }],
    },
    mixed: {
      label: "{0, 1, [8:10]}",
      members: [0, 1],
      ranges: [{ lo: 8, hi: 10 }],
    },
  };

  const MASKS = {
    "1?0?": ["1", "?", "0", "?"],
    "11??": ["1", "1", "?", "?"],
    "????": ["?", "?", "?", "?"],
    "1010": ["1", "0", "1", "0"],
  };

  function makeStarter() {
    return {
      mode: "inside", // inside | wild
      value: 0b1000, // 8 — in mixed set via range
      setId: "mixed",
      maskId: "1?0?",
      lastAction: "",
      explained: false,
      evaluated: false,
      setInside: false,
      setWild: false,
      setHit: false,
      setMiss: false,
      log: [],
      trace: [],
    };
  }

  function toBin(v) {
    return (v & 15).toString(2).padStart(WIDTH, "0");
  }

  function parseBin(str) {
    const cleaned = String(str).replace(/[^01]/g, "").slice(-WIDTH);
    if (!cleaned) return 0;
    return parseInt(cleaned.padStart(WIDTH, "0"), 2) & 15;
  }

  function expandSet(setId) {
    const s = SETS[setId];
    const vals = new Set(s.members);
    s.ranges.forEach((r) => {
      for (let i = r.lo; i <= r.hi; i++) vals.add(i);
    });
    return [...vals].sort((a, b) => a - b);
  }

  function insideOf(value, setId) {
    return expandSet(setId).includes(value & 15);
  }

  /** Bitwise wildcard eq: mask bits '?' skip; '0'/'1' must match value bit */
  function wildEq(value, maskBits) {
    const bin = toBin(value);
    const details = [];
    let ok = true;
    for (let i = 0; i < WIDTH; i++) {
      const vb = bin[i];
      const mb = maskBits[i];
      if (mb === "?" || mb === "x" || mb === "z") {
        details.push({ i, vb, mb, kind: "skip" });
      } else if (vb === mb) {
        details.push({ i, vb, mb, kind: "match" });
      } else {
        details.push({ i, vb, mb, kind: "fail" });
        ok = false;
      }
    }
    return { ok, details };
  }

  function maskBits(state) {
    return MASKS[state.maskId] || MASKS["1?0?"];
  }

  function sourceCode(state) {
    const bin = toBin(state.value);
    if (state.mode === "inside") {
      const hit = insideOf(state.value, state.setId);
      return `logic [3:0] a = 4'b${bin}; // ${state.value}
bit hit = a inside ${SETS[state.setId].label};
// hit → ${hit ? "1" : "0"}`;
    }
    const m = maskBits(state).join("");
    const { ok } = wildEq(state.value, maskBits(state));
    return `logic [3:0] a = 4'b${bin};
bit eq  = (a ==? 4'b${m});  // → ${ok ? "1" : "0"}
bit neq = (a !=? 4'b${m});  // → ${ok ? "0" : "1"}
// '?' / x / z on RHS are don't-care`;
  }

  const CLEARED_KEY = "ddv-sv-inside-cleared-v1";
  const STORE_KEY = "ddv-sv-inside-session-v1";

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

  const root = document.getElementById("in-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>a = 4'b1000</code> (8) with
        <code>a inside {0, 1, [8:10]}</code> → true. Then try
        <code>a ==? 4'b1?0?</code> wildcard compare.</p>
      <button type="button" class="btn btn-secondary" id="in-starter">Load starter example</button>
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
            <h3>inside</h3>
            <p>Membership in a set or value range.</p>
          </div>
          <div class="idea-card">
            <h3>==?</h3>
            <p>Wildcard equality — RHS <code>?</code>/x/z ignored.</p>
          </div>
          <div class="idea-card">
            <h3>!=?</h3>
            <p>Wildcard inequality — not (==?).</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Value &amp; operator</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="inside" selected>inside {…}</option>
                <option value="wild">==? / !=?</option>
              </select>
            </label>
            <label>a (binary)
              <input type="text" class="bin" id="val-in" maxlength="4" value="1000">
            </label>
            <label id="set-wrap">Set
              <select id="set-sel">
                <option value="small">{0, 1, 3}</option>
                <option value="range">{[4:6], 9}</option>
                <option value="mixed" selected>{0, 1, [8:10]}</option>
              </select>
            </label>
            <label id="mask-wrap" hidden>Mask (RHS)
              <select id="mask-sel">
                <option value="1?0?" selected>4'b1?0?</option>
                <option value="11??">4'b11??</option>
                <option value="????">4'b????</option>
                <option value="1010">4'b1010</option>
              </select>
            </label>
          </div>
          <p class="legend">Click bits of <code>a</code> to toggle. Purple bits on mask = don’t-care.</p>
          <div class="bit-row" id="val-bits"></div>
          <div class="bit-row" id="mask-bits" hidden></div>
          <div class="set-chips" id="set-chips"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-inside-hit">Preset inside hit (a=8)</button>
            <button type="button" id="btn-inside-miss">Preset inside miss (a=2)</button>
            <button type="button" id="btn-wild-hit">Preset ==? hit (a=1000 vs 1?0?)</button>
            <button type="button" id="btn-wild-miss">Preset ==? miss (a=1110 vs 1?0?)</button>
            <button type="button" id="btn-eval">Evaluate</button>
            <button type="button" id="btn-explain">Explain operators</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Results</h2></div>
        <div class="panel-body">
          <div class="result-grid">
            <div class="result-card" id="card-inside">
              <h3>inside</h3>
              <p class="val" id="val-inside">—</p>
              <p class="note" id="note-inside"></p>
            </div>
            <div class="result-card" id="card-eq">
              <h3>==?</h3>
              <p class="val" id="val-eq">—</p>
              <p class="note" id="note-eq"></p>
            </div>
            <div class="result-card" id="card-neq">
              <h3>!=?</h3>
              <p class="val" id="val-neq">—</p>
              <p class="note" id="note-neq"></p>
            </div>
          </div>
          <div class="cmp-row" id="cmp-row"></div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Operator</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>inside</code></td><td>True if value matches any set member / range</td></tr>
            <tr><td><code>[lo:hi]</code></td><td>Inclusive range inside a set</td></tr>
            <tr><td><code>==?</code></td><td>Equality with RHS wildcards (?/x/z)</td></tr>
            <tr><td><code>!=?</code></td><td>Inequality with RHS wildcards</td></tr>
            <tr><td>vs <code>==</code></td><td>Ordinary == treats X as X (not don’t-care)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: 8 inside {0,1,[8:10]} → 1.</li>
          <li>Wildcards belong on the <em>right</em> of <code>==?</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const valIn = document.getElementById("val-in");
  const setWrap = document.getElementById("set-wrap");
  const setSel = document.getElementById("set-sel");
  const maskWrap = document.getElementById("mask-wrap");
  const maskSel = document.getElementById("mask-sel");
  const valBits = document.getElementById("val-bits");
  const maskBitsEl = document.getElementById("mask-bits");
  const setChips = document.getElementById("set-chips");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardInside = document.getElementById("card-inside");
  const cardEq = document.getElementById("card-eq");
  const cardNeq = document.getElementById("card-neq");
  const valInside = document.getElementById("val-inside");
  const valEq = document.getElementById("val-eq");
  const valNeq = document.getElementById("val-neq");
  const noteInside = document.getElementById("note-inside");
  const noteEq = document.getElementById("note-eq");
  const noteNeq = document.getElementById("note-neq");
  const cmpRow = document.getElementById("cmp-row");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

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
      state.value &= 15;
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function renderValBits() {
    valBits.innerHTML = "";
    const bin = toBin(state.value);
    for (let i = 0; i < WIDTH; i++) {
      const bitIndex = WIDTH - 1 - i;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bit-cell" + (bin[i] === "1" ? " is-one" : "");
      btn.textContent = bin[i];
      btn.title = `a[${bitIndex}]`;
      btn.addEventListener("click", () => {
        state.value ^= 1 << bitIndex;
        state.lastAction = "flip";
        pushLog("run", `# a → 4'b${toBin(state.value)}`);
        renderAll();
      });
      valBits.appendChild(btn);
    }
  }

  function renderMaskBits() {
    maskBitsEl.innerHTML = "";
    const bits = maskBits(state);
    bits.forEach((b, i) => {
      const cell = document.createElement("div");
      cell.className =
        "bit-cell" + (b === "?" ? " is-wild" : b === "1" ? " is-one" : "");
      cell.textContent = b;
      cell.title = `mask[${WIDTH - 1 - i}]`;
      maskBitsEl.appendChild(cell);
    });
  }

  function renderChips() {
    setChips.innerHTML = "";
    if (state.mode !== "inside") {
      setChips.hidden = true;
      return;
    }
    setChips.hidden = false;
    expandSet(state.setId).forEach((v) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (v === (state.value & 15) ? " is-hit" : "");
      chip.textContent = `${v} (4'b${toBin(v)})`;
      setChips.appendChild(chip);
    });
  }

  function renderResults() {
    const hit = insideOf(state.value, state.setId);
    const { ok, details } = wildEq(state.value, maskBits(state));

    valInside.textContent = hit ? "1" : "0";
    noteInside.textContent = SETS[state.setId].label;
    cardInside.className =
      "result-card" + (hit ? " is-true" : " is-false");

    valEq.textContent = ok ? "1" : "0";
    noteEq.textContent = `==? 4'b${maskBits(state).join("")}`;
    cardEq.className = "result-card" + (ok ? " is-true" : " is-false");

    valNeq.textContent = ok ? "0" : "1";
    noteNeq.textContent = "!=? is not (==?)";
    cardNeq.className = "result-card" + (!ok ? " is-true" : " is-false");

    cmpRow.innerHTML = "";
    if (state.mode === "wild") {
      details.forEach((d) => {
        const cell = document.createElement("div");
        cell.className =
          "cmp-cell is-" +
          (d.kind === "skip" ? "skip" : d.kind === "match" ? "match" : "fail");
        cell.textContent = `${d.vb}/${d.mb}`;
        cell.title = `bit ${WIDTH - 1 - d.i}: a=${d.vb} mask=${d.mb}`;
        cmpRow.appendChild(cell);
      });
    }
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (state.mode === "inside") {
      const hit = insideOf(state.value, state.setId);
      warnBox.classList.remove("hidden");
      if (hit) {
        warnBox.classList.add("is-ok");
        warnBox.textContent = "Membership hit — a matches the open_range_list.";
      } else {
        warnBox.textContent = "Membership miss — value not in set/ranges.";
      }
    } else {
      const { ok } = wildEq(state.value, maskBits(state));
      warnBox.classList.remove("hidden");
      if (ok) {
        warnBox.classList.add("is-ok");
        warnBox.textContent =
          "Wildcard match — constrained bits equal; ? bits skipped.";
      } else {
        warnBox.textContent =
          "Wildcard miss — at least one non-? bit differed.";
      }
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(evaluate or explain)</span>';
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

  function syncInputs() {
    modeSel.value = state.mode;
    valIn.value = toBin(state.value);
    setSel.value = state.setId;
    maskSel.value = state.maskId;
    setWrap.hidden = state.mode !== "inside";
    maskWrap.hidden = state.mode !== "wild";
    maskBitsEl.hidden = state.mode !== "wild";
  }

  function renderAll() {
    state.value &= 15;
    syncInputs();
    renderValBits();
    renderMaskBits();
    renderChips();
    codeBox.textContent = sourceCode(state);
    renderResults();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setInside = true;
    state.setHit = true;
    pushLog("muted", "# starter a=8 inside mixed → 1");
    state.trace = [];
    renderAll();
  }

  function evaluate() {
    state.evaluated = true;
    state.lastAction = "eval";
    const hit = insideOf(state.value, state.setId);
    const { ok, details } = wildEq(state.value, maskBits(state));
    if (state.mode === "inside") {
      state.trace = [
        { kind: "muted", text: "inside" },
        {
          kind: "hi",
          text: `a=4'b${toBin(state.value)} (${state.value})`,
        },
        { kind: "run", text: `set ${SETS[state.setId].label}` },
        {
          kind: hit ? "ok" : "warn",
          text: `result → ${hit ? "1" : "0"}`,
        },
      ];
    } else {
      state.trace = [
        { kind: "muted", text: "wildcard ==" },
        {
          kind: "hi",
          text: `a=4'b${toBin(state.value)}  mask=4'b${maskBits(state).join("")}`,
        },
        ...details.map((d) => ({
          kind:
            d.kind === "fail" ? "bad" : d.kind === "skip" ? "hi" : "ok",
          text: `bit${WIDTH - 1 - d.i}: ${d.vb} vs ${d.mb} (${d.kind})`,
        })),
        {
          kind: ok ? "ok" : "warn",
          text: `==? → ${ok ? "1" : "0"}   !=? → ${ok ? "0" : "1"}`,
        },
      ];
    }
    pushLog("ok", "# evaluated");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "inside & wildcard equality" },
      { kind: "ok", text: "inside — set / range membership" },
      { kind: "ok", text: "==? — RHS ?/x/z are don't-care" },
      { kind: "hi", text: "!=? — logical not of ==?" },
      {
        kind: "warn",
        text: "Ordinary == does not treat X as wildcard",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("in-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "inside") state.setInside = true;
    if (state.mode === "wild") state.setWild = true;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  valIn.addEventListener("change", () => {
    state.value = parseBin(valIn.value);
    state.lastAction = "val";
    pushLog("run", `# a → ${state.value}`);
    renderAll();
  });

  setSel.addEventListener("change", () => {
    state.setId = setSel.value;
    state.lastAction = "set";
    pushLog("run", `# set → ${state.setId}`);
    renderAll();
  });

  maskSel.addEventListener("change", () => {
    state.maskId = maskSel.value;
    state.lastAction = "mask";
    pushLog("run", `# mask → ${state.maskId}`);
    renderAll();
  });

  document.getElementById("btn-inside-hit").addEventListener("click", () => {
    state.mode = "inside";
    state.setId = "mixed";
    state.value = 8;
    state.setInside = true;
    state.setHit = true;
    state.lastAction = "preset-inside-hit";
    pushLog("ok", "# inside hit a=8");
    renderAll();
  });

  document.getElementById("btn-inside-miss").addEventListener("click", () => {
    state.mode = "inside";
    state.setId = "mixed";
    state.value = 2;
    state.setInside = true;
    state.setMiss = true;
    state.lastAction = "preset-inside-miss";
    pushLog("warn", "# inside miss a=2");
    renderAll();
  });

  document.getElementById("btn-wild-hit").addEventListener("click", () => {
    state.mode = "wild";
    state.maskId = "1?0?";
    state.value = 0b1000; // 1000 vs 1?0? → match
    state.setWild = true;
    state.setHit = true;
    state.lastAction = "preset-wild-hit";
    pushLog("ok", "# ==? hit");
    renderAll();
  });

  document.getElementById("btn-wild-miss").addEventListener("click", () => {
    state.mode = "wild";
    state.maskId = "1?0?";
    state.value = 0b1110; // 1110 vs 1?0? — bit[1] is 1 vs 0
    state.setWild = true;
    state.setMiss = true;
    state.lastAction = "preset-wild-miss";
    pushLog("warn", "# ==? miss");
    renderAll();
  });

  document.getElementById("btn-eval").addEventListener("click", evaluate);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-inside",
      title: "Quiz: inside",
      prompt: "Set-membership operator is? Answer: <code>inside</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "inside",
      alt: ["inside operator"],
    },
    {
      id: "quiz-eq",
      title: "Quiz: ==?",
      prompt: "Wildcard equality operator? Answer: <code>==?</code>",
      hint: "don't-care compare",
      type: "text",
      answer: "==?",
      alt: ["== ?", "wildcard equality"],
    },
    {
      id: "quiz-neq",
      title: "Quiz: !=?",
      prompt: "Wildcard inequality operator? Answer: <code>!=?</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "!=?",
      alt: ["!= ?", "wildcard inequality"],
    },
    {
      id: "quiz-rhs",
      title: "Quiz: RHS",
      prompt: "Wildcards for ==? belong on the? Answer: <code>right</code>",
      hint: "RHS",
      type: "text",
      answer: "right",
      alt: ["rhs", "right-hand", "right hand", "mask"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — a=8, mixed set, inside true.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.value === 8 &&
        state.setId === "mixed" &&
        insideOf(state.value, state.setId),
    },
    {
      id: "preset-inside-hit",
      title: "Inside hit",
      prompt: "Preset inside hit (a=8).",
      hint: "Preset inside hit",
      type: "state",
      setup: () => {
        state.value = 0;
        renderAll();
      },
      check: () =>
        state.setHit &&
        state.mode === "inside" &&
        state.value === 8 &&
        insideOf(8, "mixed"),
    },
    {
      id: "preset-inside-miss",
      title: "Inside miss",
      prompt: "Preset inside miss (a=2) — inside is 0.",
      hint: "Preset inside miss",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setMiss &&
        state.value === 2 &&
        !insideOf(state.value, state.setId),
    },
    {
      id: "preset-wild-hit",
      title: "==? hit",
      prompt: "Preset ==? hit — equality true.",
      hint: "Preset ==? hit",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setWild &&
        state.mode === "wild" &&
        wildEq(state.value, maskBits(state)).ok,
    },
    {
      id: "preset-wild-miss",
      title: "==? miss",
      prompt: "Preset ==? miss — equality false.",
      hint: "Preset ==? miss",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wild" &&
        state.value === 0b1110 &&
        !wildEq(state.value, maskBits(state)).ok,
    },
    {
      id: "eval",
      title: "Evaluate",
      prompt: "Click Evaluate.",
      hint: "Evaluate button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.evaluated && state.lastAction === "eval",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain operators.",
      hint: "Explain operators",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-wild",
      title: "Mode wild",
      prompt: "Switch Mode dropdown to ==? / !=?.",
      hint: "Mode select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "wild" && state.lastAction === "mode",
    },
    {
      id: "range-5",
      title: "Range hit",
      prompt: "Set range {[4:6],9}, a=5 — inside true.",
      hint: "Set → range, set a=0101",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setId === "range" &&
        state.value === 5 &&
        insideOf(5, "range"),
    },
    {
      id: "mask-all",
      title: "Mask ????",
      prompt: "Wild mode with mask ???? — ==? always 1.",
      hint: "Mode wild, Mask 4'b????",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wild" &&
        state.maskId === "????" &&
        wildEq(state.value, maskBits(state)).ok,
    },
    {
      id: "quiz-range",
      title: "Quiz: range",
      prompt: "Inclusive range in a set uses? Answer: <code>[lo:hi]</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "[lo:hi]",
      alt: ["[lo : hi]", "range", "[4:6]"],
    },
    {
      id: "flip-bit",
      title: "Toggle bit",
      prompt: "Click any value bit to toggle.",
      hint: "Click a bit cell",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "flip",
    },
    {
      id: "neq-inverse",
      title: "!=? inverse",
      prompt: "On any state, !=? result is opposite of ==?.",
      hint: "Always true — Check",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const ok = wildEq(state.value, maskBits(state)).ok;
        return (
          valEq.textContent === (ok ? "1" : "0") &&
          valNeq.textContent === (ok ? "0" : "1")
        );
      },
    },
    {
      id: "code-inside",
      title: "Code inside",
      prompt: "Inside mode source contains <code>inside</code>.",
      hint: "Starter / inside mode",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "inside" &&
        sourceCode(state).includes("inside"),
    },
    {
      id: "code-wild",
      title: "Code ==?",
      prompt: "Wild mode source contains <code>==?</code>.",
      hint: "Preset ==? hit",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wild" && sourceCode(state).includes("==?"),
    },
    {
      id: "small-3",
      title: "Set {0,1,3}",
      prompt: "small set, a=3 — inside hit.",
      hint: "Set {0,1,3}, a=0011",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setId === "small" &&
        state.value === 3 &&
        insideOf(3, "small"),
    },
    {
      id: "exact-mask",
      title: "Exact mask",
      prompt: "Mask 1010 with a=1010 — ==? true.",
      hint: "Wild mode, mask 1010, a=1010",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wild" &&
        state.maskId === "1010" &&
        state.value === 0b1010 &&
        wildEq(state.value, maskBits(state)).ok,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → ==? hit preset → evaluate → explain.",
      hint: "Load → ==? hit → Evaluate → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "wild" &&
        wildEq(state.value, maskBits(state)).ok &&
        state.evaluated &&
        state.explained &&
        state.lastAction === "explain",
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
