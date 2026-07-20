(() => {
  /**
   * localparam vs parameter:
   *   parameter  — overridable via #(.NAME(val)) at instance
   *   localparam — not overridable; often derived from parameters
   *   defparam   — hierarchical override (deprecated / discouraged)
   *
   * Demo module:
   *   parameter  WIDTH = 8;
   *   localparam DEPTH = WIDTH * 2;  // tracks WIDTH, not overridable
   */

  function makeStarter() {
    return {
      defaultWidth: 8,
      overrideWidth: null, // null = no #() override
      triedLocalOverride: false,
      useDefparam: false,
      lastAction: "",
      explained: false,
      appliedPound: false,
      log: [],
      trace: [],
    };
  }

  function effective(state) {
    const width =
      state.overrideWidth == null ? state.defaultWidth : state.overrideWidth;
    // localparam always derived — ignore attempted local override
    const depth = width * 2;
    return { width, depth };
  }

  const CLEARED_KEY = "ddv-localparam-lab-cleared-v1";
  const STORE_KEY = "ddv-localparam-lab-session-v1";

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

  const root = document.getElementById("lp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>parameter WIDTH = 8</code> and
        <code>localparam DEPTH = WIDTH*2</code>. Override WIDTH to 4 via
        <code>#(.WIDTH(4))</code> — DEPTH becomes 8. You cannot override DEPTH.</p>
      <button type="button" class="btn btn-secondary" id="lp-starter">Load starter example</button>
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
            <h3>parameter</h3>
            <p>Public constant — instance may override with <code>#()</code>.</p>
          </div>
          <div class="idea-card">
            <h3>localparam</h3>
            <p>Private / derived — not overridable from outside.</p>
          </div>
          <div class="idea-card">
            <h3>defparam</h3>
            <p>Hierarchical poke — deprecated; prefer <code>#()</code>.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Module &amp; instance</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Default WIDTH
              <input type="number" id="def-w" min="1" max="64" value="8">
            </label>
            <label>Override WIDTH
              <input type="number" id="ovr-w" min="1" max="64" placeholder="(none)">
            </label>
          </div>
          <p class="legend">Leave override empty for the default. localparam DEPTH always = WIDTH×2.</p>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-apply">Apply #(.WIDTH(…)) override</button>
            <button type="button" id="btn-clear">Clear override</button>
            <button type="button" id="btn-try-local">Try #(.DEPTH(99)) — illegal</button>
            <button type="button" id="btn-defparam">Show defparam (discouraged)</button>
            <button type="button" id="btn-w4">Preset WIDTH→4</button>
            <button type="button" id="btn-explain">Explain rules</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Elaborated values</h2></div>
        <div class="panel-body">
          <div class="values">
            <div class="val-card" id="card-w">
              <h3>parameter WIDTH</h3>
              <p class="val" id="val-w">—</p>
              <p class="note" id="note-w"></p>
            </div>
            <div class="val-card locked" id="card-d">
              <h3>localparam DEPTH</h3>
              <p class="val" id="val-d">—</p>
              <p class="note" id="note-d"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Construct</th><th>Override?</th><th>Use for</th></tr></thead>
          <tbody>
            <tr><td><code>parameter</code></td><td>Yes — <code>#(.P(v))</code></td><td>Tunable knobs</td></tr>
            <tr><td><code>localparam</code></td><td>No</td><td>Derived widths, local constants</td></tr>
            <tr><td><code>defparam</code></td><td>Yes (legacy)</td><td>Avoid — hard to trace</td></tr>
            <tr><td>Pattern</td><td></td><td><code>parameter W;</code> then <code>localparam MSB = W-1;</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: WIDTH=8 → DEPTH=16; override 4 → DEPTH=8.</li>
          <li><code>#(.DEPTH(99))</code> is illegal — DEPTH is localparam.</li>
        </ul>
      </div>
    </div>
  `;

  const defW = document.getElementById("def-w");
  const ovrW = document.getElementById("ovr-w");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardW = document.getElementById("card-w");
  const cardD = document.getElementById("card-d");
  const valW = document.getElementById("val-w");
  const valD = document.getElementById("val-d");
  const noteW = document.getElementById("note-w");
  const noteD = document.getElementById("note-d");
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
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function sourceCode() {
    const e = effective(state);
    let inst;
    if (state.useDefparam) {
      inst = `fifo u (.d(d), .q(q));\ndefparam u.WIDTH = ${e.width}; // discouraged`;
    } else if (state.overrideWidth != null) {
      inst = `fifo #(.WIDTH(${state.overrideWidth})) u (.d(d), .q(q));`;
    } else {
      inst = `fifo u (.d(d), .q(q)); // WIDTH defaults to ${state.defaultWidth}`;
    }
    return `module fifo #(
  parameter  WIDTH = ${state.defaultWidth}
) (
  input  logic [WIDTH-1:0] d,
  output logic [WIDTH-1:0] q
);
  localparam DEPTH = WIDTH * 2; // not overridable
  // ... memory [0:DEPTH-1] ...
endmodule

// parent:
${inst}`;
  }

  function renderValues() {
    const e = effective(state);
    valW.textContent = String(e.width);
    valD.textContent = String(e.depth);
    const overridden = state.overrideWidth != null;
    cardW.classList.toggle("overridden", overridden);
    noteW.textContent = overridden
      ? `overridden from default ${state.defaultWidth}`
      : "using module default";
    noteD.textContent = state.triedLocalOverride
      ? "still WIDTH×2 — localparam ignore attempted override"
      : "derived = WIDTH × 2";
  }

  function renderWarn() {
    if (state.useDefparam) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "defparam is hierarchical and order-sensitive — prefer #(.WIDTH(n)) at the instance.";
    } else if (state.triedLocalOverride) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Illegal / ignored: cannot override localparam DEPTH via #(.DEPTH(…)).";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(apply override or explain)</span>';
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
    defW.value = String(state.defaultWidth);
    ovrW.value =
      state.overrideWidth == null ? "" : String(state.overrideWidth);
  }

  function renderAll() {
    syncInputs();
    codeBox.textContent = sourceCode();
    renderValues();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter WIDTH=8 DEPTH=16");
    state.trace = [];
    renderAll();
  }

  function explain() {
    const e = effective(state);
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "override rules" },
      {
        kind: "hi",
        text: `parameter WIDTH → ${e.width}${state.overrideWidth != null ? " (overridden)" : " (default)"}`,
      },
      {
        kind: "ok",
        text: `localparam DEPTH → ${e.depth} (= WIDTH*2, not overridable)`,
      },
      {
        kind: "warn",
        text: "defparam works but obscures the instance site — avoid",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("lp-starter").addEventListener("click", loadStarter);
  defW.addEventListener("change", () => {
    state.defaultWidth = Math.max(1, Math.min(64, Number(defW.value) || 8));
    state.lastAction = "default";
    pushLog("run", `# default WIDTH → ${state.defaultWidth}`);
    renderAll();
  });
  document.getElementById("btn-apply").addEventListener("click", () => {
    const raw = ovrW.value.trim();
    if (raw === "") {
      pushLog("warn", "# override empty — use Clear or type a value");
      renderLog();
      return;
    }
    state.overrideWidth = Math.max(1, Math.min(64, Number(raw) || 1));
    state.useDefparam = false;
    state.triedLocalOverride = false;
    state.appliedPound = true;
    state.lastAction = "apply";
    pushLog("ok", `# #(.WIDTH(${state.overrideWidth}))`);
    renderAll();
  });
  document.getElementById("btn-clear").addEventListener("click", () => {
    state.overrideWidth = null;
    state.useDefparam = false;
    state.triedLocalOverride = false;
    state.lastAction = "clear";
    pushLog("muted", "# cleared override");
    renderAll();
  });
  document.getElementById("btn-try-local").addEventListener("click", () => {
    state.triedLocalOverride = true;
    state.useDefparam = false;
    state.lastAction = "try-local";
    pushLog("warn", "# tried #(.DEPTH(99)) — rejected");
    state.trace = [
      { kind: "bad", text: "fifo #(.DEPTH(99)) u (...);  // ERROR" },
      { kind: "ok", text: `DEPTH remains ${effective(state).depth}` },
    ];
    renderAll();
  });
  document.getElementById("btn-defparam").addEventListener("click", () => {
    if (state.overrideWidth == null) state.overrideWidth = 4;
    state.useDefparam = true;
    state.triedLocalOverride = false;
    state.lastAction = "defparam";
    pushLog("warn", "# defparam style shown");
    renderAll();
  });
  document.getElementById("btn-w4").addEventListener("click", () => {
    state.overrideWidth = 4;
    state.useDefparam = false;
    state.triedLocalOverride = false;
    state.appliedPound = true;
    state.lastAction = "preset-4";
    pushLog("ok", "# preset WIDTH→4");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-param",
      title: "Quiz: parameter",
      prompt: "Overridable module constant is a? Answer: <code>parameter</code>",
      hint: "#(.P(v))",
      type: "text",
      answer: "parameter",
      alt: ["param"],
    },
    {
      id: "quiz-local",
      title: "Quiz: localparam",
      prompt: "Non-overridable local constant is a? Answer: <code>localparam</code>",
      hint: "derived widths",
      type: "text",
      answer: "localparam",
      alt: ["local param", "localparameter"],
    },
    {
      id: "quiz-defparam",
      title: "Quiz: defparam",
      prompt: "Legacy hierarchical override is? Answer: <code>defparam</code>",
      hint: "discouraged",
      type: "text",
      answer: "defparam",
      alt: ["def param"],
    },
    {
      id: "quiz-prefer",
      title: "Quiz: prefer",
      prompt: "Preferred override style? Answer: <code>#()</code>",
      hint: "instance parameter port list",
      type: "text",
      answer: "#()",
      alt: ["#", "pound", "ansi #()", "#(.width(n))"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — WIDTH=8, DEPTH=16, no override.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const e = effective(state);
        return (
          state.defaultWidth === 8 &&
          state.overrideWidth == null &&
          e.width === 8 &&
          e.depth === 16
        );
      },
    },
    {
      id: "override-4",
      title: "Override 4",
      prompt: "Preset WIDTH→4 — WIDTH=4 and DEPTH=8.",
      hint: "Preset WIDTH→4",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const e = effective(state);
        return (
          state.overrideWidth === 4 &&
          e.width === 4 &&
          e.depth === 8 &&
          state.appliedPound
        );
      },
    },
    {
      id: "apply-btn",
      title: "Apply #()",
      prompt: "Type override 16 and Apply #(.WIDTH(…)).",
      hint: "Override field → Apply",
      type: "state",
      setup: () => {
        loadStarter();
        ovrW.value = "16";
      },
      check: () =>
        state.lastAction === "apply" &&
        state.overrideWidth === 16 &&
        effective(state).depth === 32,
    },
    {
      id: "clear",
      title: "Clear",
      prompt: "After an override, Clear override — back to defaults.",
      hint: "Preset 4 then Clear",
      type: "state",
      setup: () => {
        state.overrideWidth = 4;
        renderAll();
      },
      check: () =>
        state.lastAction === "clear" &&
        state.overrideWidth == null &&
        effective(state).width === state.defaultWidth,
    },
    {
      id: "try-local",
      title: "Illegal DEPTH",
      prompt: "Try #(.DEPTH(99)) — DEPTH unchanged (still WIDTH×2).",
      hint: "Try #(.DEPTH(99)) button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.triedLocalOverride &&
        state.lastAction === "try-local" &&
        effective(state).depth === effective(state).width * 2,
    },
    {
      id: "defparam-show",
      title: "defparam",
      prompt: "Show defparam (discouraged) style.",
      hint: "Show defparam button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.useDefparam && state.lastAction === "defparam",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain rules.",
      hint: "Explain rules",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "derived",
      title: "Derived",
      prompt: "With WIDTH override 5, DEPTH must be 10.",
      hint: "Set override 5 → Apply",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.overrideWidth === 5 && effective(state).depth === 10,
    },
    {
      id: "quiz-derived",
      title: "Quiz: pattern",
      prompt: "MSB = WIDTH-1 should be a? Answer: <code>localparam</code>",
      hint: "cheat sheet pattern",
      type: "text",
      answer: "localparam",
      alt: ["local param"],
    },
    {
      id: "default-change",
      title: "Default WIDTH",
      prompt: "Change Default WIDTH to 16 (no override).",
      hint: "Default WIDTH field",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.defaultWidth === 16 &&
        state.overrideWidth == null &&
        effective(state).depth === 32 &&
        state.lastAction === "default",
    },
    {
      id: "code-has-localparam",
      title: "Code localparam",
      prompt: "Module source includes <code>localparam DEPTH</code>.",
      hint: "Always true on starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode().includes("localparam DEPTH"),
    },
    {
      id: "code-pound",
      title: "Code #()",
      prompt: "After WIDTH→4, instance line has <code>#(.WIDTH(4))</code>.",
      hint: "Preset WIDTH→4",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.overrideWidth === 4 &&
        !state.useDefparam &&
        sourceCode().includes("#(.WIDTH(4))"),
    },
    {
      id: "quiz-track",
      title: "Quiz: track",
      prompt: "When WIDTH changes, DEPTH should? Answer: <code>recompute</code>",
      hint: "derived",
      type: "text",
      answer: "recompute",
      alt: ["update", "follow", "change", "recalculate"],
    },
    {
      id: "warn-local",
      title: "Warn local",
      prompt: "After illegal DEPTH try, warning box is visible.",
      hint: "Try #(.DEPTH(99))",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.triedLocalOverride &&
        !warnBox.classList.contains("hidden"),
    },
    {
      id: "quiz-public",
      title: "Quiz: public",
      prompt: "Instance-visible knobs should be? Answer: <code>parameter</code>",
      hint: "not localparam",
      type: "text",
      answer: "parameter",
      alt: ["param"],
    },
    {
      id: "no-defparam-prefer",
      title: "Prefer #()",
      prompt: "With WIDTH→4 via preset (not defparam), useDefparam is false.",
      hint: "Preset WIDTH→4",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.overrideWidth === 4 &&
        state.useDefparam === false &&
        state.lastAction === "preset-4",
    },
    {
      id: "depth-formula",
      title: "Formula",
      prompt: "DEPTH formula in this lab is WIDTH times? Answer: <code>2</code>",
      hint: "WIDTH * 2",
      type: "text",
      answer: "2",
      alt: ["two", "*2"],
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → WIDTH→4 → explain.",
      hint: "Load → Preset WIDTH→4 → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.overrideWidth === 4 &&
        effective(state).depth === 8 &&
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
