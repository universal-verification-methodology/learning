(() => {
  /**
   * always_comb / always_ff / always_latch — procedural intent literacy.
   *
   * always_comb  — combo; auto sensitivity; expect full assignment (no latch)
   * always_ff    — sequential edge; FF / register
   * always_latch — intentional level-sensitive storage
   * Incomplete if without else under always_comb → latch cue / tool warning
   */

  function makeStarter() {
    return {
      kind: "comb", // comb | ff | latch | legacy
      branch: "full", // full | incomplete | ff-template
      hasClock: true,
      hasReset: true,
      lastAction: "",
      explained: false,
      checked: false,
      setComb: false,
      setFf: false,
      setLatch: false,
      setLegacy: false,
      setIncomplete: false,
      setFull: false,
      log: [],
      trace: [],
    };
  }

  function inferred(state) {
    if (state.kind === "ff") return "flip-flop";
    if (state.kind === "latch") return "latch";
    if (state.kind === "legacy") {
      return state.branch === "incomplete" ? "latch (risk)" : "combo (legacy)";
    }
    // comb
    if (state.branch === "incomplete") return "latch (unintended)";
    return "combinational";
  }

  function intentMatch(state) {
    const inf = inferred(state);
    if (state.kind === "comb") return inf === "combinational";
    if (state.kind === "ff") return inf === "flip-flop";
    if (state.kind === "latch") return inf === "latch";
    // legacy: incomplete is mismatch with "wanted combo"
    return state.branch !== "incomplete";
  }

  function sourceCode(state) {
    if (state.kind === "ff") {
      const sens = state.hasClock
        ? state.hasReset
          ? "@(posedge clk or negedge rst_n)"
          : "@(posedge clk)"
        : "@(*) /* missing edge — wrong for FF */";
      return `always_ff ${sens} begin
  if (!rst_n) q <= '0;
  else        q <= d;
end
// intent: flip-flop / register`;
    }
    if (state.kind === "latch") {
      return `always_latch begin
  if (en) q <= d;  // holds when en=0 — intentional
end
// intent: latch`;
    }
    if (state.kind === "legacy") {
      if (state.branch === "incomplete") {
        return `always @(*) begin
  if (sel) y = a;
  // missing else → latch risk
end`;
      }
      return `always @(*) begin
  if (sel) y = a;
  else     y = b;
end
// legacy combo — prefer always_comb`;
    }
    // comb
    if (state.branch === "incomplete") {
      return `always_comb begin
  if (sel) y = a;
  // no else — tools warn: latch inferred under always_comb
end`;
    }
    return `always_comb begin
  if (sel) y = a;
  else     y = b;
end
// intent: pure combinational`;
  }

  function cues(state) {
    const list = [];
    if (state.kind === "comb" && state.branch === "full") {
      list.push({ ok: true, text: "Full if/else — every path assigns y" });
      list.push({ ok: true, text: "always_comb implies combo sensitivity" });
    }
    if (state.kind === "comb" && state.branch === "incomplete") {
      list.push({ ok: false, text: "Incomplete assignment → latch cue" });
      list.push({ ok: false, text: "Mismatches always_comb intent" });
    }
    if (state.kind === "ff") {
      list.push({
        ok: state.hasClock,
        text: state.hasClock
          ? "Edge sensitivity (posedge clk)"
          : "No clock edge — not a proper FF template",
      });
      list.push({
        ok: true,
        text: "Nonblocking <= for sequential style",
      });
    }
    if (state.kind === "latch") {
      list.push({ ok: true, text: "Level-sensitive hold when en=0" });
      list.push({ ok: true, text: "Document intentional latches" });
    }
    if (state.kind === "legacy") {
      list.push({
        ok: state.branch === "full",
        text:
          state.branch === "full"
            ? "@(*) combo — migrate to always_comb"
            : "@(*) with hole → same latch risk",
      });
    }
    return list;
  }

  const CLEARED_KEY = "ddv-sv-always-procs-cleared-v1";
  const STORE_KEY = "ddv-sv-always-procs-session-v1";

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

  const root = document.getElementById("ap-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>always_comb</code> with full if/else
        (pure combo). Flip to incomplete assign to see a latch warning, then compare
        <code>always_ff</code> and <code>always_latch</code>.</p>
      <button type="button" class="btn btn-secondary" id="ap-starter">Load starter example</button>
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
            <h3>always_comb</h3>
            <p>Combo intent — assign on all paths; no edges.</p>
          </div>
          <div class="idea-card">
            <h3>always_ff</h3>
            <p>Sequential intent — <code>@(posedge clk)</code>, <code>&lt;=</code>.</p>
          </div>
          <div class="idea-card">
            <h3>always_latch</h3>
            <p>Intentional latch — level-sensitive hold.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Process template</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Process
              <select id="kind-sel">
                <option value="comb" selected>always_comb</option>
                <option value="ff">always_ff</option>
                <option value="latch">always_latch</option>
                <option value="legacy">always @(*) legacy</option>
              </select>
            </label>
            <label id="branch-wrap">Branches
              <select id="branch-sel">
                <option value="full" selected>full if/else</option>
                <option value="incomplete">incomplete (no else)</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-comb">Preset always_comb (full)</button>
            <button type="button" id="btn-incomplete">Preset comb incomplete → latch cue</button>
            <button type="button" id="btn-ff">Preset always_ff</button>
            <button type="button" id="btn-latch">Preset always_latch</button>
            <button type="button" id="btn-legacy">Preset legacy @(*)</button>
            <button type="button" id="btn-check">Check intent vs inferred</button>
            <button type="button" id="btn-explain">Explain processes</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Intent vs inferred</h2></div>
        <div class="panel-body">
          <div class="intent-grid">
            <div class="intent-card" id="card-intent">
              <h3>Declared intent</h3>
              <p class="val" id="val-intent">—</p>
              <p class="note" id="note-intent"></p>
            </div>
            <div class="intent-card" id="card-infer">
              <h3>Inferred structure</h3>
              <p class="val" id="val-infer">—</p>
              <p class="note" id="note-infer"></p>
            </div>
          </div>
          <ul class="cue-list" id="cue-list"></ul>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Construct</th><th>Use for</th><th>Red flag</th></tr></thead>
          <tbody>
            <tr><td><code>always_comb</code></td><td>Mux / combo next-state</td><td>Missing else / default</td></tr>
            <tr><td><code>always_ff</code></td><td>Registers</td><td>No clock edge; blocking <code>=</code> habits</td></tr>
            <tr><td><code>always_latch</code></td><td>Rare intentional latches</td><td>Accidental incomplete combo</td></tr>
            <tr><td><code>always @(*)</code></td><td>Legacy Verilog combo</td><td>Prefer <code>always_comb</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: full always_comb → combinational, intent matches.</li>
          <li>Incomplete under always_comb → latch warning (don't ship that).</li>
        </ul>
      </div>
    </div>
  `;

  const kindSel = document.getElementById("kind-sel");
  const branchSel = document.getElementById("branch-sel");
  const branchWrap = document.getElementById("branch-wrap");
  const modeLegend = document.getElementById("mode-legend");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardIntent = document.getElementById("card-intent");
  const cardInfer = document.getElementById("card-infer");
  const valIntent = document.getElementById("val-intent");
  const valInfer = document.getElementById("val-infer");
  const noteIntent = document.getElementById("note-intent");
  const noteInfer = document.getElementById("note-infer");
  const cueList = document.getElementById("cue-list");
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

  function intentLabel(state) {
    if (state.kind === "comb") return "always_comb";
    if (state.kind === "ff") return "always_ff";
    if (state.kind === "latch") return "always_latch";
    return "always @(*)";
  }

  function renderCards() {
    const inf = inferred(state);
    const match = intentMatch(state);
    valIntent.textContent = intentLabel(state);
    valInfer.textContent = inf;
    noteIntent.textContent =
      state.kind === "ff"
        ? "sequential / register"
        : state.kind === "latch"
          ? "intentional level-sensitive"
          : "combinational";
    noteInfer.textContent = match ? "matches intent" : "mismatch — fix template";

    cardIntent.className = "intent-card is-ok";
    cardInfer.className = "intent-card";
    if (inf.includes("latch")) cardInfer.classList.add("is-latch");
    else if (match) cardInfer.classList.add("is-ok");
    else cardInfer.classList.add("is-warn");

    cueList.innerHTML = "";
    cues(state).forEach((c) => {
      const li = document.createElement("li");
      li.className = c.ok ? "ok" : "bad";
      li.textContent = c.text;
      cueList.appendChild(li);
    });
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (state.kind === "comb" && state.branch === "incomplete") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Latch inferred under always_comb — add else/default or use always_latch if intentional.";
    } else if (state.kind === "legacy" && state.branch === "incomplete") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Legacy @(*) with incomplete assign — same latch hazard; prefer always_comb + full paths.";
    } else if (intentMatch(state)) {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent = "Intent matches inferred structure.";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(check intent or explain)</span>';
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
    kindSel.value = state.kind;
    branchSel.value = state.branch === "incomplete" ? "incomplete" : "full";
    const showBranch = state.kind === "comb" || state.kind === "legacy";
    branchWrap.hidden = !showBranch;
  }

  function legendText() {
    if (state.kind === "comb")
      return "always_comb: tools check that the block is combo-safe.";
    if (state.kind === "ff")
      return "always_ff: edge-triggered register template.";
    if (state.kind === "latch")
      return "always_latch: document intentional latches; rare in FPGA RTL.";
    return "Legacy always @(*): works, but always_comb states intent better.";
  }

  function renderAll() {
    syncInputs();
    modeLegend.textContent = legendText();
    codeBox.textContent = sourceCode(state);
    renderCards();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setComb = true;
    state.setFull = true;
    pushLog("muted", "# starter always_comb full");
    state.trace = [];
    renderAll();
  }

  function doCheck() {
    state.checked = true;
    state.lastAction = "check";
    const match = intentMatch(state);
    const inf = inferred(state);
    state.trace = [
      { kind: "muted", text: "intent check" },
      { kind: "hi", text: `declared: ${intentLabel(state)}` },
      {
        kind: match ? "ok" : "warn",
        text: `inferred: ${inf}`,
      },
      {
        kind: match ? "ok" : "bad",
        text: match ? "OK — ship pattern" : "Fix branches or change process kind",
      },
    ];
    pushLog(match ? "ok" : "warn", `# check → ${match ? "match" : "mismatch"}`);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "process kinds" },
      { kind: "ok", text: "always_comb → combo, full assignment" },
      { kind: "ok", text: "always_ff → @(posedge clk), registers" },
      { kind: "hi", text: "always_latch → intentional level-sensitive" },
      {
        kind: "warn",
        text: "Incomplete if under comb → latch — usually a bug",
      },
      {
        kind: "run",
        text: `current: ${intentLabel(state)} → ${inferred(state)}`,
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("ap-starter").addEventListener("click", loadStarter);

  kindSel.addEventListener("change", () => {
    state.kind = kindSel.value;
    if (state.kind === "comb") state.setComb = true;
    if (state.kind === "ff") {
      state.setFf = true;
      state.branch = "ff-template";
    }
    if (state.kind === "latch") state.setLatch = true;
    if (state.kind === "legacy") state.setLegacy = true;
    if (state.kind === "comb" || state.kind === "legacy") {
      if (state.branch === "ff-template") state.branch = "full";
    }
    state.lastAction = "kind";
    pushLog("run", `# kind → ${state.kind}`);
    renderAll();
  });

  branchSel.addEventListener("change", () => {
    state.branch = branchSel.value;
    if (state.branch === "incomplete") state.setIncomplete = true;
    if (state.branch === "full") state.setFull = true;
    state.lastAction = "branch";
    pushLog("run", `# branch → ${state.branch}`);
    renderAll();
  });

  document.getElementById("btn-comb").addEventListener("click", () => {
    state.kind = "comb";
    state.branch = "full";
    state.setComb = true;
    state.setFull = true;
    state.lastAction = "preset-comb";
    pushLog("ok", "# preset always_comb full");
    renderAll();
  });

  document.getElementById("btn-incomplete").addEventListener("click", () => {
    state.kind = "comb";
    state.branch = "incomplete";
    state.setComb = true;
    state.setIncomplete = true;
    state.lastAction = "preset-incomplete";
    pushLog("warn", "# preset incomplete comb");
    renderAll();
  });

  document.getElementById("btn-ff").addEventListener("click", () => {
    state.kind = "ff";
    state.branch = "ff-template";
    state.hasClock = true;
    state.hasReset = true;
    state.setFf = true;
    state.lastAction = "preset-ff";
    pushLog("ok", "# preset always_ff");
    renderAll();
  });

  document.getElementById("btn-latch").addEventListener("click", () => {
    state.kind = "latch";
    state.setLatch = true;
    state.lastAction = "preset-latch";
    pushLog("ok", "# preset always_latch");
    renderAll();
  });

  document.getElementById("btn-legacy").addEventListener("click", () => {
    state.kind = "legacy";
    state.branch = "full";
    state.setLegacy = true;
    state.setFull = true;
    state.lastAction = "preset-legacy";
    pushLog("ok", "# preset legacy @(*)");
    renderAll();
  });

  document.getElementById("btn-check").addEventListener("click", doCheck);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-comb",
      title: "Quiz: comb",
      prompt: "SV process for combo intent? Answer: <code>always_comb</code>",
      hint: "no clock edge",
      type: "text",
      answer: "always_comb",
      alt: ["always comb"],
    },
    {
      id: "quiz-ff",
      title: "Quiz: ff",
      prompt: "SV process for flip-flops? Answer: <code>always_ff</code>",
      hint: "posedge clk",
      type: "text",
      answer: "always_ff",
      alt: ["always ff"],
    },
    {
      id: "quiz-latch",
      title: "Quiz: latch",
      prompt: "SV process for intentional latches? Answer: <code>always_latch</code>",
      hint: "level-sensitive",
      type: "text",
      answer: "always_latch",
      alt: ["always latch"],
    },
    {
      id: "quiz-legacy",
      title: "Quiz: legacy",
      prompt: "Legacy Verilog combo sensitivity? Answer: <code>always @(*)</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "always @(*)",
      alt: ["@(*)", "always@(*)", "always @ *"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — always_comb full, combinational.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "comb" &&
        state.branch === "full" &&
        inferred(state) === "combinational",
    },
    {
      id: "preset-comb",
      title: "Preset comb",
      prompt: "Preset always_comb (full).",
      hint: "Preset always_comb (full)",
      type: "state",
      setup: () => {
        state.kind = "ff";
        renderAll();
      },
      check: () =>
        state.setComb &&
        state.kind === "comb" &&
        state.branch === "full" &&
        state.lastAction === "preset-comb",
    },
    {
      id: "preset-incomplete",
      title: "Incomplete",
      prompt: "Preset comb incomplete → inferred latch (unintended).",
      hint: "Preset comb incomplete",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setIncomplete &&
        state.kind === "comb" &&
        inferred(state) === "latch (unintended)",
    },
    {
      id: "preset-ff",
      title: "Preset FF",
      prompt: "Preset always_ff — inferred flip-flop.",
      hint: "Preset always_ff",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setFf &&
        state.kind === "ff" &&
        inferred(state) === "flip-flop",
    },
    {
      id: "preset-latch",
      title: "Preset latch",
      prompt: "Preset always_latch.",
      hint: "Preset always_latch",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setLatch &&
        state.kind === "latch" &&
        inferred(state) === "latch",
    },
    {
      id: "preset-legacy",
      title: "Preset legacy",
      prompt: "Preset legacy @(*).",
      hint: "Preset legacy @(*)",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setLegacy &&
        state.kind === "legacy" &&
        state.lastAction === "preset-legacy",
    },
    {
      id: "check-ok",
      title: "Check match",
      prompt: "On starter, Check intent vs inferred — match.",
      hint: "Load starter → Check intent",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.checked &&
        intentMatch(state) &&
        state.lastAction === "check",
    },
    {
      id: "check-mismatch",
      title: "Check mismatch",
      prompt: "Incomplete comb → Check shows mismatch.",
      hint: "Preset incomplete → Check",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "comb" &&
        state.branch === "incomplete" &&
        state.checked &&
        !intentMatch(state) &&
        state.lastAction === "check",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain processes.",
      hint: "Explain processes",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "kind-ff",
      title: "Kind FF",
      prompt: "Switch Process dropdown to always_ff.",
      hint: "Process select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.kind === "ff" && state.lastAction === "kind",
    },
    {
      id: "branch-incomplete",
      title: "Branch incomplete",
      prompt: "On comb, set Branches to incomplete (no else).",
      hint: "Branches dropdown",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "comb" &&
        state.branch === "incomplete" &&
        state.lastAction === "branch",
    },
    {
      id: "quiz-incomplete",
      title: "Quiz: hole",
      prompt: "Missing else under always_comb often infers a? Answer: <code>latch</code>",
      hint: "latch cue",
      type: "text",
      answer: "latch",
      alt: ["a latch", "latches"],
    },
    {
      id: "quiz-edge",
      title: "Quiz: edge",
      prompt: "always_ff sensitivity is typically? Answer: <code>posedge</code>",
      hint: "posedge clk",
      type: "text",
      answer: "posedge",
      alt: ["posedge clk", "@(posedge clk)", "rising edge"],
    },
    {
      id: "warn-latch",
      title: "Warn latch",
      prompt: "Incomplete comb shows latch warning box.",
      hint: "Preset comb incomplete",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "comb" &&
        state.branch === "incomplete" &&
        !warnBox.classList.contains("hidden") &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "code-ff",
      title: "Code FF",
      prompt: "always_ff preset source contains <code>posedge clk</code>.",
      hint: "Preset always_ff",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "ff" &&
        sourceCode(state).includes("posedge clk"),
    },
    {
      id: "code-comb",
      title: "Code comb",
      prompt: "Starter source starts with <code>always_comb</code>.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode(state).startsWith("always_comb"),
    },
    {
      id: "match-latch",
      title: "Latch match",
      prompt: "always_latch preset — intent matches inferred latch.",
      hint: "Preset always_latch",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "latch" &&
        intentMatch(state) &&
        inferred(state) === "latch",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → incomplete preset → check → explain.",
      hint: "Load → incomplete → Check → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.kind === "comb" &&
        state.branch === "incomplete" &&
        state.checked &&
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
