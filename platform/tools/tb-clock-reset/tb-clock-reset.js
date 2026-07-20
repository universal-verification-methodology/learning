(() => {
  /**
   * TB clock + reset patterns (concept)
   *   forever clk toggle · rst_n assert N cycles · sync vs async release
   * Starter: free-running clk; rst_n low ×2 posedges, then sync release
   */

  const HALF = 12;

  /** @typedef {"classic"|"async_mid"|"hold"|"idle"|"long"} PresetId */

  const PRESETS = {
    classic: {
      label: "classic: assert ×2, sync release",
      // half: 0 1 2 3 4 5 6 7 8 9 10 11
      // clk:  0 1 0 1 0 1 0 1 0 1  0  1
      // rst:  0 0 0 0 1 1 1 1 1 1  1  1
      clk: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      rst_n: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      cursor: 4,
      releaseHalf: 4,
      note: "rst_n low for two posedges (h1,h3), then high from h4 (sync-ish).",
    },
    async_mid: {
      label: "async mid: release between edges",
      clk: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      rst_n: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      cursor: 2,
      releaseHalf: 2,
      note: "rst_n rises at h2 while clk=0 — between posedges (async release).",
    },
    hold: {
      label: "hold: never deassert",
      clk: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      rst_n: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      cursor: 0,
      releaseHalf: null,
      note: "Clock runs; rst_n stays 0 — DUT stays in reset.",
    },
    idle: {
      label: "idle: no reset (rst_n=1)",
      clk: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      rst_n: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      cursor: 1,
      releaseHalf: null,
      note: "Free-running clock only — no assert phase.",
    },
    long: {
      label: "long: assert ×4 posedges",
      clk: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      rst_n: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      cursor: 8,
      releaseHalf: 8,
      note: "Four posedges with rst_n=0, then release.",
    },
  };

  function sourceSketch() {
    return `// TB clock + reset (literacy sketch — not a full simulator)
// initial clk = 0;
// forever #(PERIOD/2) clk = ~clk;   // free-running clock
//
// initial begin
//   rst_n = 0;                       // assert (active-low)
//   repeat (N) @(posedge clk);       // hold N cycles
//   rst_n = 1;                       // sync deassert at/after posedge
// end
//
// Async release: change rst_n between edges (#delay mid-cycle).
// Prefer sync deassert into flops that sample on posedge clk.`;
  }

  function cloneWave(arr) {
    return arr.slice();
  }

  function makeStarter() {
    const p = PRESETS.classic;
    return {
      preset: "classic",
      clk: cloneWave(p.clk),
      rst_n: cloneWave(p.rst_n),
      cursor: p.cursor,
      releaseHalf: p.releaseHalf,
      note: p.note,
      evaluated: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  /** Posedge half indices where clk rises 0→1 */
  function posedgeHalves(clk) {
    const out = [];
    for (let i = 1; i < clk.length; i++) {
      if (clk[i - 1] === 0 && clk[i] === 1) out.push(i);
    }
    return out;
  }

  function analyze(s) {
    const edges = posedgeHalves(s.clk);
    let assertEdges = 0;
    let firstReleaseEdge = null;
    for (const e of edges) {
      if (s.rst_n[e] === 0) assertEdges++;
      else if (firstReleaseEdge === null && assertEdges > 0) firstReleaseEdge = e;
    }
    const asserted = s.rst_n.some((v) => v === 0);
    const released = asserted && s.rst_n.some((v) => v === 1);
    let releaseHalf = null;
    for (let i = 0; i < s.rst_n.length; i++) {
      if (i > 0 && s.rst_n[i - 1] === 0 && s.rst_n[i] === 1) {
        releaseHalf = i;
        break;
      }
    }
    const isAsync = asyncMid(s, releaseHalf);
    const isSync = released && releaseHalf !== null && !isAsync;
    const clocksOk = edges.length >= 2;
    return {
      edges,
      assertEdges,
      firstReleaseEdge,
      asserted,
      released,
      releaseHalf,
      syncRelease: isSync,
      asyncRelease: isAsync,
      clocksOk,
      summary: summarize(asserted, released, assertEdges, releaseHalf, s),
    };
  }

  function asyncMid(s, releaseHalf) {
    if (releaseHalf === null) return false;
    // Mid-cycle async: release on clk low that is NOT the usual post-2-edge classic slot
    // Treat async_mid preset pattern: release at h2 while previous edge was h1 with rst still 0
    return releaseHalf === 2 && s.rst_n[1] === 0 && s.rst_n[2] === 1;
  }

  function summarize(asserted, released, assertEdges, releaseHalf, s) {
    if (!asserted) return "no assert — rst_n stays 1 (clock only)";
    if (!released) return `held in reset — ${assertEdges} posedge(s) with rst_n=0`;
    const kind = asyncMid(s, releaseHalf) ? "async mid" : "sync-style";
    return `asserted ${assertEdges} posedge(s), release @h${releaseHalf} (${kind})`;
  }

  const CLEARED_KEY = "ddv-tb-clock-reset-cleared-v1";
  const STORE_KEY = "ddv-tb-clock-reset-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let quizChoice = "";
  let state = makeStarter();

  const root = document.getElementById("tcr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> free-running <code>clk</code>;
        <code>rst_n</code> low for two posedges, then release (classic sync-style).</p>
      <button type="button" class="btn btn-secondary" id="tcr-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions" id="chal-quiz" hidden></div>
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
      <div class="idea-grid">
        <div class="idea-card"><h3>forever clk</h3><p>TB clock is a free-running toggle, not a DUT output.</p></div>
        <div class="idea-card"><h3>Assert</h3><p>Drive <code>rst_n=0</code> for N clock cycles at bring-up.</p></div>
        <div class="idea-card"><h3>Sync release</h3><p>Deassert near a clock edge so flops see a clean sample.</p></div>
        <div class="idea-card"><h3>Async release</h3><p>Change reset between edges — still legal; know the hazard.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="tcr-controls">
        <div class="tcr-field">
          <label for="sel-preset">Wave preset</label>
          <select id="sel-preset">
            <option value="classic" selected>classic ×2 sync</option>
            <option value="async_mid">async mid release</option>
            <option value="hold">hold forever</option>
            <option value="idle">idle (no reset)</option>
            <option value="long">long ×4 assert</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-eval">Analyze</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-toggle-rst">Toggle rst_n@cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo async</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="tcr-layout">
        <div class="panel-box">
          <h3>TB sketch</h3>
          <pre class="prop-code" id="prop-code"></pre>
          <p id="prop-hint" style="font-size:0.88rem;margin:0;color:var(--muted)"></p>
        </div>
        <div class="panel-box">
          <h3>Timeline (half-cycles)</h3>
          <div class="wave" id="wave-box"></div>
          <div class="cell-btns" id="cursor-btns"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
      </div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Literacy sketch</h3>
      <pre class="code-box" id="code-box"></pre>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Trace</h3>
        <pre class="trace-box" id="trace-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Log</h3>
        <pre class="log-box" id="log-box"></pre>
      </div>
    </div>
  `;

  const selPreset = /** @type {HTMLSelectElement} */ (document.getElementById("sel-preset"));

  function tbSketch() {
    const a = analyze(state);
    const n = a.assertEdges || 2;
    return `initial clk = 0;
forever #(T/2) clk = ~clk;

initial begin
  rst_n = 1'b0;
  repeat (${n}) @(posedge clk);
  rst_n = 1'b1;  // ${a.asyncRelease ? "prefer sync; this wave shows async mid" : "sync-style deassert"}
end
// cursor=h${state.cursor}  release=${a.releaseHalf === null ? "none" : "h" + a.releaseHalf}`;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "classic";
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter classic assert×2");
    pushTrace(analyze(state).summary);
    renderAll();
  }

  function loadPreset() {
    const id = /** @type {PresetId} */ (selPreset.value);
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.clk = cloneWave(p.clk);
    state.rst_n = cloneWave(p.rst_n);
    state.cursor = p.cursor;
    state.releaseHalf = p.releaseHalf;
    state.note = p.note;
    state.evaluated = false;
    state.lastAction = "load";
    pushLog(`# load ${id}`);
    renderAll();
  }

  function doEval() {
    state.evaluated = true;
    state.lastAction = "eval";
    const a = analyze(state);
    pushTrace(a.summary);
    pushLog(`# analyze ${a.summary}`);
    renderAll();
  }

  function stepCursor() {
    state.cursor = (state.cursor + 1) % HALF;
    state.lastAction = "step";
    pushLog(`# step → h${state.cursor}`);
    renderAll();
  }

  function setCursor(h) {
    state.cursor = h;
    state.lastAction = "cursor";
    pushLog(`# cursor h${h}`);
    renderAll();
  }

  function toggleRst() {
    const c = state.cursor;
    state.rst_n[c] = state.rst_n[c] ? 0 : 1;
    state.evaluated = false;
    state.lastAction = "toggle-rst";
    pushLog(`# toggle rst_n@h${c}=${state.rst_n[c]}`);
    renderAll();
  }

  function demo() {
    const p = PRESETS.async_mid;
    state.preset = "async_mid";
    state.clk = cloneWave(p.clk);
    state.rst_n = cloneWave(p.rst_n);
    state.cursor = p.cursor;
    state.releaseHalf = p.releaseHalf;
    state.note = p.note;
    state.demoed = true;
    state.evaluated = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo async mid release");
    pushTrace(analyze(state).summary);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    const a = analyze(state);
    pushLog(
      `# explain: forever clk; assert rst_n=0 for N posedges; ` +
        `deassert (sync preferred). Now: ${a.summary}`
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const a = analyze(state);
    document.getElementById("prop-code").textContent = tbSketch();
    document.getElementById("prop-hint").textContent = state.note || "";
    document.getElementById("meta-note").textContent =
      `Posedges at h=${a.edges.join(",") || "—"}. ${a.summary}`;

    const edges = new Set(a.edges);
    let head = "<tr><th></th>";
    for (let i = 0; i < HALF; i++) head += `<th>h${i}</th>`;
    head += "</tr>";

    function row(name, arr, mark) {
      let html = `<tr><td class="sig">${name}</td>`;
      for (let i = 0; i < HALF; i++) {
        const cls = [
          arr[i] ? "is-hi" : "",
          i === state.cursor ? "is-cursor" : "",
          mark === "rst" && a.releaseHalf === i ? "is-release" : "",
          mark === "rst" && arr[i] === 0 ? "is-assert" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const tip = edges.has(i) ? "↑" : "";
        html += `<td class="${cls}">${arr[i]}${tip}</td>`;
      }
      html += "</tr>";
      return html;
    }

    document.getElementById("wave-box").innerHTML =
      `<table class="wave-table"><thead>${head}</thead><tbody>` +
      row("clk", state.clk, "clk") +
      row("rst_n", state.rst_n, "rst") +
      `</tbody></table>`;

    const btns = document.getElementById("cursor-btns");
    btns.innerHTML = "";
    for (let i = 0; i < HALF; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `h${i}`;
      if (i === state.cursor) b.classList.add("is-on");
      b.addEventListener("click", () => setCursor(i));
      btns.appendChild(b);
    }

    const v = document.getElementById("verdict");
    if (!state.evaluated) {
      v.className = "verdict idle";
      v.textContent = `cursor=h${state.cursor} · not analyzed`;
    } else {
      v.className = "verdict yes";
      v.textContent = a.summary;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${a.clocksOk ? "is-ok" : "is-bad"}">clk_edges=${a.edges.length}</span>
      <span class="flag ${a.asserted ? "is-on" : ""}">asserted=${a.asserted ? 1 : 0}</span>
      <span class="flag is-on">assert_posedges=${a.assertEdges}</span>
      <span class="flag ${a.released ? "is-ok" : a.asserted ? "is-bad" : ""}">released=${a.released ? 1 : 0}</span>
      <span class="flag ${a.asyncRelease ? "is-on" : a.syncRelease ? "is-ok" : ""}">${
        a.asyncRelease ? "release=async" : a.syncRelease ? "release=sync" : "release=—"
      }</span>
      <span class="flag is-on">cursor=h${state.cursor}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          clk: state.clk,
          rst_n: state.rst_n,
          cursor: state.cursor,
          evaluated: state.evaluated,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-forever",
      title: "Quiz: clock",
      type: "quiz",
      prompt: "A typical TB clock is generated with…",
      hint: "Free-running.",
      choices: [
        "a forever toggle (or equivalent) in the testbench",
        "only the DUT's clock-gating cell",
        "$finish inside the clock block",
        "randomize() on clk each ns",
      ],
      answer: "a forever toggle (or equivalent) in the testbench",
    },
    {
      id: "quiz-assert",
      title: "Quiz: assert",
      type: "quiz",
      prompt: "Active-low reset assert means…",
      hint: "rst_n.",
      choices: [
        "drive rst_n = 0 for a chosen number of cycles",
        "drive rst_n = 1 forever",
        "delete the clock",
        "call $fatal immediately",
      ],
      answer: "drive rst_n = 0 for a chosen number of cycles",
    },
    {
      id: "quiz-sync",
      title: "Quiz: sync release",
      type: "quiz",
      prompt: "Sync-style deassert usually…",
      hint: "Relative to posedge.",
      choices: [
        "releases reset aligned to the clock so flops sample cleanly",
        "removes the clock forever",
        "only works without a clock",
        "means rst_n never returns to 1",
      ],
      answer: "releases reset aligned to the clock so flops sample cleanly",
    },
    {
      id: "quiz-async",
      title: "Quiz: async",
      type: "quiz",
      prompt: "An async mid-cycle release…",
      hint: "Between edges.",
      choices: [
        "changes rst_n between clock edges",
        "is identical to forever clk = 0",
        "requires UVM factory overrides",
        "only happens after $finish",
      ],
      answer: "changes rst_n between clock edges",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — classic assert ×2, then release.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.preset === "classic" &&
        analyze(state).assertEdges === 2 &&
        analyze(state).released,
    },
    {
      id: "analyze",
      title: "Analyze",
      prompt: "On starter, Analyze — see assert_posedges=2.",
      hint: "Analyze",
      setup: () => {
        loadStarter();
        doEval();
      },
      check: () =>
        state.evaluated &&
        analyze(state).assertEdges === 2 &&
        state.lastAction === "eval",
    },
    {
      id: "load-async",
      title: "Load async",
      prompt: "Load async mid release and Analyze.",
      hint: "Preset async → Load → Analyze",
      setup: () => {
        selPreset.value = "async_mid";
        loadPreset();
        doEval();
      },
      check: () => state.preset === "async_mid" && analyze(state).asyncRelease,
    },
    {
      id: "load-hold",
      title: "Load hold",
      prompt: "Load hold forever — released=0.",
      hint: "hold → Load → Analyze",
      setup: () => {
        selPreset.value = "hold";
        loadPreset();
        doEval();
      },
      check: () => state.preset === "hold" && !analyze(state).released && analyze(state).asserted,
    },
    {
      id: "load-idle",
      title: "Load idle",
      prompt: "Load idle — no assert (rst_n all 1).",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doEval();
      },
      check: () => state.preset === "idle" && !analyze(state).asserted,
    },
    {
      id: "load-long",
      title: "Load long",
      prompt: "Load long ×4 — assert_posedges=4.",
      hint: "long → Load → Analyze",
      setup: () => {
        selPreset.value = "long";
        loadPreset();
        doEval();
      },
      check: () => state.preset === "long" && analyze(state).assertEdges === 4,
    },
    {
      id: "step",
      title: "Step cursor",
      prompt: "From starter (cursor h4), Step once → h5.",
      hint: "Step cursor",
      setup: () => {
        loadStarter();
        stepCursor();
      },
      check: () => state.cursor === 5 && state.lastAction === "step",
    },
    {
      id: "toggle-rst",
      title: "Toggle rst_n",
      prompt: "Toggle rst_n at the cursor.",
      hint: "Toggle rst_n@cursor",
      setup: () => {
        loadStarter();
        toggleRst();
      },
      check: () => state.lastAction === "toggle-rst",
    },
    {
      id: "demo",
      title: "Demo async",
      prompt: "Click Demo async — async release flags on.",
      hint: "Demo async",
      setup: () => loadStarter(),
      check: () => state.demoed && analyze(state).asyncRelease && state.lastAction === "demo",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Click Explain.",
      hint: "Explain",
      setup: () => loadStarter(),
      check: () => state.explained === true,
    },
    {
      id: "sketch-forever",
      title: "Sketch forever",
      prompt: "TB sketch mentions forever clk toggle.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /forever/i.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions sync deassert.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /sync deassert/i.test(sourceSketch()),
    },
    {
      id: "posedge-mark",
      title: "Posedges",
      prompt: "Starter has 6 posedges on the half-cycle wave.",
      hint: "Analyze meta note",
      setup: () => loadStarter(),
      check: () => analyze(state).edges.length === 6,
    },
    {
      id: "release-flag",
      title: "Release half",
      prompt: "Starter release is at h4.",
      hint: "Starter Analyze",
      setup: () => loadStarter(),
      check: () => analyze(state).releaseHalf === 4,
    },
    {
      id: "cursor-btn",
      title: "Cursor h0",
      prompt: "Click timeline button h0.",
      hint: "h0 under wave",
      setup: () => {
        loadStarter();
        setCursor(0);
      },
      check: () => state.cursor === 0 && state.lastAction === "cursor",
    },
    {
      id: "sync-flag",
      title: "Sync flag",
      prompt: "Starter Analyze shows release=sync (not async).",
      hint: "Starter → Analyze",
      setup: () => {
        loadStarter();
        doEval();
      },
      check: () => analyze(state).syncRelease && !analyze(state).asyncRelease,
    },
    {
      id: "repeat-n",
      title: "repeat(N)",
      prompt: "On long preset, sketch uses repeat (4).",
      hint: "long → Load",
      setup: () => {
        selPreset.value = "long";
        loadPreset();
      },
      check: () => /repeat \(4\)/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to classic assert ×2.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.preset === "classic" && analyze(state).assertEdges === 2;
      },
    },
  ];

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

    const quiz = document.getElementById("chal-quiz");
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "quiz") {
      ansRow.innerHTML = "";
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="tcr-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
      ansRow.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = clearedIds.includes(c.id) ? `✓ ${i + 1}` : String(i + 1);
      b.style.opacity = i === challengeIdx ? "1" : "0.7";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        else renderAll();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("tcr-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-eval").addEventListener("click", () => doEval());
  document.getElementById("btn-step").addEventListener("click", () => stepCursor());
  document.getElementById("btn-toggle-rst").addEventListener("click", () => toggleRst());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    quizChoice = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    else renderAll();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") {
      ok = quizChoice === ch.answer;
    } else if (typeof ch.check === "function") {
      ok = !!ch.check();
    }
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds.push(ch.id);
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("ok", "Cleared");
    } else {
      setChalStatus("bad", "Not yet");
    }
    renderChallenge();
  });

  // boot
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.clk) && saved.clk.length === HALF) {
        state.clk = saved.clk;
        state.rst_n = saved.rst_n;
        state.cursor = saved.cursor | 0;
        state.preset = saved.preset || "classic";
        state.evaluated = !!saved.evaluated;
        state.note = (PRESETS[state.preset] && PRESETS[state.preset].note) || "";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }
  syncInputs();
  renderAll();
})();
