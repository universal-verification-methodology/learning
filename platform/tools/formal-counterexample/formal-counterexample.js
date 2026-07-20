(() => {
  /**
   * Formal counterexample (concept)
   *   Step CEX wave · fail at t=3 · Prev/Next cursor · signal lanes
   * Starter: cursor on t=3 where ok=false
   */

  const STARTER_WAVE = [
    { t: 0, a: 0, b: 0, ok: true },
    { t: 1, a: 1, b: 0, ok: true },
    { t: 2, a: 1, b: 1, ok: true },
    { t: 3, a: 0, b: 1, ok: false },
    { t: 4, a: 1, b: 1, ok: true },
  ];

  const ASSERT_PROPERTY = `property p_ab_eq;
  @(posedge clk) (a == b);
endproperty
assert property (p_ab_eq);`;

  const SIGNALS = [
    { key: "a", label: "a", kind: "bit" },
    { key: "b", label: "b", kind: "bit" },
    { key: "ok", label: "ok", kind: "ok" },
  ];

  const PRESETS = {
    starter: {
      label: "starter: fail @t=3",
      wave: STARTER_WAVE,
      cursor: 3,
      note: "Property fails at t=3 — ok=false while a=0 b=1 (a != b).",
    },
    before_fail: {
      label: "before fail t=2",
      wave: STARTER_WAVE,
      cursor: 2,
      note: "Step before violation — still ok=true; a=1 b=1 satisfies assert.",
    },
    at_start: {
      label: "at start t=0",
      wave: STARTER_WAVE,
      cursor: 0,
      note: "Beginning of witness trace — a=0 b=0.",
    },
    after_fail: {
      label: "after fail t=4",
      wave: STARTER_WAVE,
      cursor: 4,
      note: "After failure cycle — ok true again (a=1 b=1).",
    },
    early_fail: {
      label: "early fail @t=1",
      wave: [
        { t: 0, a: 0, b: 0, ok: true },
        { t: 1, a: 1, b: 0, ok: false },
        { t: 2, a: 0, b: 0, ok: true },
      ],
      cursor: 1,
      note: "Immediate violation when a=1 b=0 at t=1.",
    },
    late_fail: {
      label: "late fail @t=4",
      wave: [
        { t: 0, a: 0, b: 1, ok: true },
        { t: 1, a: 0, b: 1, ok: true },
        { t: 2, a: 1, b: 1, ok: true },
        { t: 3, a: 1, b: 1, ok: true },
        { t: 4, a: 1, b: 0, ok: false },
      ],
      cursor: 4,
      note: "Failure deep in trace at t=4.",
    },
    all_ok: {
      label: "all ok (no CEX)",
      wave: [
        { t: 0, a: 0, b: 0, ok: true },
        { t: 1, a: 1, b: 1, ok: true },
        { t: 2, a: 0, b: 0, ok: true },
      ],
      cursor: 0,
      note: "Sketch wave with no ok=false — no violation row.",
    },
    idle: {
      label: "idle (step wave)",
      wave: STARTER_WAVE,
      cursor: 0,
      note: "Use Prev/Next or Jump to fail.",
    },
  };

  function cloneWave(wave) {
    return wave.map((r) => ({ ...r }));
  }

  function sourceSketch() {
    return `# Counterexample wave literacy (not VCD parser)
# formal tool exports witness trace when assert fails
# each row: time t, signals a/b, ok = property check that cycle
#
# cex[t=3] = {a:0, b:1, ok:false}  ← first failure in starter
# assert: (a == b) failed at t=3
# step cursor Prev/Next to inspect cycle-by-cycle
# replay in sim to confirm waveform matches formal`;
  }

  function failIndex(wave) {
    for (let i = 0; i < wave.length; i++) {
      if (!wave[i].ok) return i;
    }
    return -1;
  }

  function rowVerdict(row) {
    if (!row) return { verdict: "—", message: "no row" };
    if (!row.ok) {
      return {
        verdict: "FAIL",
        message: `CEX fails at t=${row.t} (ok=false, a=${row.a} b=${row.b})`,
      };
    }
    return { verdict: "OK", message: `Step t=${row.t} ok=true` };
  }

  function assertFailedAt(row) {
    if (!row || row.ok) return null;
    return {
      t: row.t,
      a: row.a,
      b: row.b,
      expr: `(a == b)`,
      eval: `${row.a} == ${row.b} → false`,
      summary: `assert property (p_ab_eq) failed at t=${row.t}: a=${row.a}, b=${row.b}`,
    };
  }

  function propertyPanelText(row, fi) {
    const lines = [ASSERT_PROPERTY, ""];
    if (fi >= 0) {
      const failRow = row && !row.ok ? row : null;
      if (failRow) {
        const af = assertFailedAt(failRow);
        lines.push(`# FAILED at cursor t=${failRow.t}`);
        lines.push(`# ${af.summary}`);
        lines.push(`# check: ${af.expr} → ${af.eval}`);
      } else if (row) {
        lines.push(`# cursor t=${row.t} — property holds (a=${row.a} b=${row.b})`);
        lines.push(`# first fail in wave: t=${fi >= 0 ? fi : "—"}`);
      }
    } else {
      lines.push("# no ok=false row — assert never violated in this wave");
      if (row) {
        lines.push(`# cursor t=${row.t} a=${row.a} b=${row.b} ok=${row.ok}`);
      }
    }
    return lines.join("\n");
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const wave = cloneWave(p.wave);
    const row = wave[p.cursor];
    const rv = rowVerdict(row);
    return {
      preset: "starter",
      wave,
      cursor: p.cursor,
      verdict: rv.verdict,
      message: rv.message,
      note: p.note,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`cursor t=${p.cursor} ${rv.verdict}`],
    };
  }

  const CLEARED_KEY = "ddv-formal-counterexample-cleared-v1";
  const STORE_KEY = "ddv-formal-counterexample-session-v1";

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

  const root = document.getElementById("fcex-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> counterexample wave — cursor on
        <strong>t=3</strong> where <code>ok=false</code> and <code>a≠b</code>.</p>
      <button type="button" class="btn btn-secondary" id="fcex-starter">Load starter example</button>
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
        <div class="idea-card"><h3>CEX trace</h3><p>Formal tools emit a time-indexed witness when assert fails.</p></div>
        <div class="idea-card"><h3>Step cursor</h3><p>Walk cycles to see when inputs and ok flip.</p></div>
        <div class="idea-card"><h3>First fail</h3><p>Starter failure is at t=3 with ok=false.</p></div>
        <div class="idea-card"><h3>Debug loop</h3><p>Use CEX to fix RTL or constraints, then re-run formal.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="fcex-controls">
        <div class="fcex-field">
          <label for="sel-preset">Wave preset</label>
          <select id="sel-preset">
            <option value="starter" selected>starter fail @3</option>
            <option value="before_fail">before fail t=2</option>
            <option value="at_start">at start t=0</option>
            <option value="after_fail">after fail t=4</option>
            <option value="early_fail">early fail @1</option>
            <option value="late_fail">late fail @4</option>
            <option value="all_ok">all ok</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-ghost" id="btn-prev">◀ Prev</button>
        <button type="button" class="btn btn-ghost" id="btn-next">Next ▶</button>
        <button type="button" class="btn btn-secondary" id="btn-jump">Jump to fail</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo early fail</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict no">FAIL</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="fcex-layout">
        <div class="panel-box">
          <h3>Signal lanes</h3>
          <div class="fcex-time-axis" id="time-axis"></div>
          <div class="fcex-lanes" id="signal-lanes"></div>
          <h3 style="margin:0.75rem 0 0.35rem;font-size:0.9rem">CEX wave table</h3>
          <table class="wave-table" id="wave-table"></table>
          <div class="wave-row" id="wave-row"></div>
        </div>
        <div class="panel-box">
          <h3>Assert property</h3>
          <pre class="prop-panel" id="prop-panel"></pre>
          <h3 style="margin:0.5rem 0 0.35rem;font-size:0.9rem">Cycle detail</h3>
          <pre class="detail-box" id="detail-box"></pre>
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

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
  }

  function updateCursor(c) {
    const w = state.wave;
    let idx = c;
    if (idx < 0) idx = 0;
    if (idx >= w.length) idx = w.length - 1;
    state.cursor = idx;
    const rv = rowVerdict(w[idx]);
    state.verdict = rv.verdict;
    state.message = rv.message;
  }

  function stepCursor(delta) {
    updateCursor(state.cursor + delta);
    state.lastAction = delta < 0 ? "prev" : "next";
    pushTrace(`${state.lastAction} t=${state.wave[state.cursor].t} ${state.verdict}`);
    renderAll();
  }

  function jumpToFail() {
    const fi = failIndex(state.wave);
    if (fi >= 0) updateCursor(fi);
    else {
      state.verdict = "OK";
      state.message = "No ok=false row in wave";
    }
    state.lastAction = "jump";
    pushTrace(`jump fail t=${state.wave[state.cursor]?.t ?? "—"}`);
    pushLog("# jump to fail");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter fail @t=3");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value in PRESETS ? selPreset.value : "starter";
    const p = PRESETS[id];
    state.preset = id;
    state.wave = cloneWave(p.wave);
    state.note = p.note;
    updateCursor(p.cursor);
    state.lastAction = "load";
    pushLog(`# load ${id}`);
    pushTrace(`load cursor t=${state.wave[state.cursor].t}`);
    renderAll();
  }

  function demo() {
    selPreset.value = "early_fail";
    const p = PRESETS.early_fail;
    state.preset = "early_fail";
    state.wave = cloneWave(p.wave);
    state.note = p.note;
    updateCursor(p.cursor);
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo early fail @1");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "CEX is a witness trace — step to find first ok=false cycle. " +
        "Lanes show a/b/ok per cycle; property panel shows which assert failed."
    );
    pushLog("# explain");
    renderAll();
  }

  function setCursor(idx) {
    updateCursor(idx);
    state.lastAction = "cursor";
    pushTrace(`cursor t=${state.wave[idx].t}`);
    renderAll();
  }

  function cellHiLo(sig, row) {
    const v = row[sig.key];
    if (sig.kind === "ok") {
      return {
        cls: v ? "is-hi" : "is-bad",
        label: v ? "1" : "0",
        title: `ok=${v}`,
      };
    }
    return {
      cls: v ? "is-hi" : "is-lo",
      label: String(v),
      title: `${sig.label}=${v}`,
    };
  }

  function renderTimeAxis(w, c, fi) {
    let html = "";
    for (let i = 0; i < w.length; i++) {
      const cls = [
        i === c ? "is-cur" : "",
        i === fi ? "is-fail" : "",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<span class="fcex-time-tick ${cls}">t${w[i].t}</span>`;
    }
    document.getElementById("time-axis").innerHTML = html;
  }

  function renderSignalLanes() {
    const w = state.wave;
    const c = state.cursor;
    const fi = failIndex(w);
    const n = w.length;
    const colPct = n > 0 ? 100 / n : 100;
    const cursorLeft = c * colPct + colPct / 2;
    const failLeft = fi >= 0 ? fi * colPct : 0;
    const failWidth = fi >= 0 ? colPct : 0;

    renderTimeAxis(w, c, fi);

    let html = "";
    for (const sig of SIGNALS) {
      html += `<div class="fcex-lane-row"><div class="fcex-lane-name">${sig.label}</div><div class="fcex-lane-track">`;
      if (fi >= 0) {
        html += `<div class="fcex-fail-band" style="left:calc(${failLeft}% - 1px);width:calc(${failWidth}% + 2px)" title="fail cycle t=${w[fi].t}"></div>`;
      }
      html += `<div class="fcex-cursor-band" style="left:calc(${cursorLeft}% - 1px)" title="cursor t=${w[c]?.t ?? "—"}"></div>`;
      for (let i = 0; i < w.length; i++) {
        const row = w[i];
        const { cls, label, title } = cellHiLo(sig, row);
        const extra = [
          cls,
          i === c ? "is-cursor" : "",
          i === fi ? "is-fail-col" : "",
        ]
          .filter(Boolean)
          .join(" ");
        html += `<button type="button" class="fcex-lane-cell ${extra}" data-idx="${i}" title="${title}">${label}</button>`;
      }
      html += `</div></div>`;
    }
    const lanesEl = document.getElementById("signal-lanes");
    lanesEl.innerHTML = html;
    lanesEl.querySelectorAll(".fcex-lane-cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        setCursor(Number(btn.getAttribute("data-idx")));
      });
    });
  }

  function renderPropertyPanel() {
    const w = state.wave;
    const c = state.cursor;
    const row = w[c];
    const fi = failIndex(w);
    const el = document.getElementById("prop-panel");
    el.textContent = propertyPanelText(row, fi);
    if (row && !row.ok) el.className = "prop-panel is-fail";
    else if (fi >= 0) el.className = "prop-panel is-ok";
    else el.className = "prop-panel is-ok";
  }

  function renderWaveTable() {
    const w = state.wave;
    const c = state.cursor;
    let html = `<thead><tr><th>t</th><th>a</th><th>b</th><th class="ok-col">ok</th></tr></thead><tbody>`;
    for (let i = 0; i < w.length; i++) {
      const row = w[i];
      const cls = [
        i === c ? "is-cursor" : "",
        !row.ok ? "is-fail" : "is-ok-row",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<tr class="${cls}"><td>${row.t}</td><td>${row.a}</td><td>${row.b}</td><td class="ok-col">${row.ok}</td></tr>`;
    }
    html += `</tbody>`;
    document.getElementById("wave-table").innerHTML = html;

    const rowEl = document.getElementById("wave-row");
    rowEl.innerHTML = "";
    for (let i = 0; i < w.length; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wave-cell";
      if (i === c) b.className += " is-cur";
      if (!w[i].ok) b.className += " is-bad";
      b.textContent = `t${w[i].t}`;
      b.title = `a=${w[i].a} b=${w[i].b} ok=${w[i].ok}`;
      b.addEventListener("click", () => setCursor(i));
      rowEl.appendChild(b);
    }
  }

  function renderDetailBox() {
    const row = state.wave[state.cursor];
    const fi = failIndex(state.wave);
    if (!row) {
      document.getElementById("detail-box").textContent = "—";
      return;
    }
    const lines = [
      `t=${row.t}  a=${row.a}  b=${row.b}  ok=${row.ok}`,
      `# property check ${row.ok ? "passed" : "FAILED"} this cycle`,
      `# (a == b) → ${row.a == row.b ? "true" : "false"}`,
    ];
    if (!row.ok) {
      const af = assertFailedAt(row);
      lines.push(`# assert: ${af.summary}`);
    } else if (fi >= 0 && state.cursor !== fi) {
      lines.push(`# first fail in wave at t=${state.wave[fi].t}`);
    }
    document.getElementById("detail-box").textContent = lines.join("\n");
  }

  function renderLab() {
    syncInputs();
    renderSignalLanes();
    renderPropertyPanel();
    renderWaveTable();
    renderDetailBox();

    const row = state.wave[state.cursor];
    const v = document.getElementById("verdict");
    if (state.verdict === "FAIL") {
      v.className = "verdict no";
      v.textContent = `${state.verdict}: ${state.message}`;
    } else if (state.verdict === "OK") {
      v.className = "verdict yes";
      v.textContent = `${state.verdict}: ${state.message}`;
    } else {
      v.className = "verdict idle";
      v.textContent = state.message || "Idle";
    }

    document.getElementById("meta-note").textContent = state.note || "";
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const fi = failIndex(state.wave);
    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">cursor=${state.cursor}</span>
      <span class="flag is-on">t=${row ? row.t : "—"}</span>
      <span class="flag ${state.verdict === "FAIL" ? "is-bad" : "is-ok"}">${state.verdict}</span>
      <span class="flag ${fi >= 0 ? "is-bad" : "is-ok"}">fail@${fi >= 0 ? state.wave[fi].t : "—"}</span>
      <span class="flag">a=${row ? row.a : "—"}</span>
      <span class="flag">b=${row ? row.b : "—"}</span>
      <span class="flag ${row && row.a === row.b ? "is-ok" : row ? "is-bad" : ""}">a==b</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          cursor: state.cursor,
          lastAction: state.lastAction,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-cex",
      title: "Quiz: CEX",
      type: "quiz",
      prompt: "A formal counterexample is…",
      hint: "Witness wave.",
      choices: [
        "a time trace showing assert failure",
        "a coverage hit only",
        "vacuous pass",
        "Git diff",
      ],
      answer: "a time trace showing assert failure",
    },
    {
      id: "quiz-fail-cycle",
      title: "Quiz: fail cycle",
      type: "quiz",
      prompt: "First ok=false cycle is where…",
      hint: "Violation start.",
      choices: [
        "property first violated",
        "proof completes",
        "cover always hits",
        "clock stops forever",
      ],
      answer: "property first violated",
    },
    {
      id: "quiz-wave",
      title: "Quiz: stepping",
      type: "quiz",
      prompt: "Stepping a CEX wave helps you…",
      hint: "Temporal debug.",
      choices: [
        "see signals cycle-by-cycle",
        "synthesize design",
        "run Git",
        "skip debug",
      ],
      answer: "see signals cycle-by-cycle",
    },
    {
      id: "quiz-ok-col",
      title: "Quiz: ok=false",
      type: "quiz",
      prompt: "ok=false on a row means…",
      hint: "Property check.",
      choices: [
        "check failed that cycle",
        "assume failed syntax",
        "cover missed",
        "clock started",
      ],
      answer: "check failed that cycle",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — cursor at t=3, verdict FAIL.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () => state.cursor === 3 && state.verdict === "FAIL",
    },
    {
      id: "prev-ok",
      title: "Prev to OK",
      prompt: "From starter, Prev to t=2 — verdict OK.",
      hint: "◀ Prev",
      setup: () => {
        loadStarter();
        stepCursor(-1);
      },
      check: () => state.cursor === 2 && state.verdict === "OK",
    },
    {
      id: "next-fail",
      title: "Next to fail",
      prompt: "From t=2, Next to t=3 — FAIL.",
      hint: "Next ▶",
      setup: () => {
        loadStarter();
        updateCursor(2);
        stepCursor(1);
      },
      check: () => state.cursor === 3 && state.verdict === "FAIL",
    },
    {
      id: "jump-fail",
      title: "Jump to fail",
      prompt: "From t=0, Jump to fail — cursor t=3.",
      hint: "Jump to fail",
      setup: () => {
        loadStarter();
        updateCursor(0);
        jumpToFail();
      },
      check: () => state.cursor === 3 && state.verdict === "FAIL",
    },
    {
      id: "after-fail",
      title: "After fail",
      prompt: "Load after fail t=4 — verdict OK.",
      hint: "after_fail preset",
      setup: () => {
        selPreset.value = "after_fail";
        loadPreset();
      },
      check: () => state.cursor === 4 && state.verdict === "OK",
    },
    {
      id: "before-fail",
      title: "Before fail",
      prompt: "Load before fail t=2 — OK.",
      hint: "before_fail preset",
      setup: () => {
        selPreset.value = "before_fail";
        loadPreset();
      },
      check: () => state.cursor === 2 && state.verdict === "OK",
    },
    {
      id: "early-fail",
      title: "Early fail",
      prompt: "Load early fail — cursor t=1 FAIL.",
      hint: "early_fail preset",
      setup: () => {
        selPreset.value = "early_fail";
        loadPreset();
      },
      check: () => state.cursor === 1 && state.verdict === "FAIL",
    },
    {
      id: "late-fail",
      title: "Late fail",
      prompt: "Load late fail — cursor t=4 FAIL.",
      hint: "late_fail preset",
      setup: () => {
        selPreset.value = "late_fail";
        loadPreset();
      },
      check: () => state.cursor === 4 && state.verdict === "FAIL",
    },
    {
      id: "all-ok",
      title: "All ok",
      prompt: "Load all ok — no fail index.",
      hint: "all_ok preset",
      setup: () => {
        selPreset.value = "all_ok";
        loadPreset();
      },
      check: () => failIndex(state.wave) === -1,
    },
    {
      id: "wave-btn",
      title: "Wave button",
      prompt: "Click wave button t0 — cursor=0.",
      hint: "t0 under wave",
      setup: () => {
        loadStarter();
        setCursor(0);
      },
      check: () => state.cursor === 0 && state.lastAction === "cursor",
    },
    {
      id: "demo",
      title: "Demo early",
      prompt: "Demo early fail — cursor t=1 FAIL.",
      hint: "Demo early fail",
      setup: () => loadStarter(),
      check: () => state.demoed && state.cursor === 1 && state.verdict === "FAIL",
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
      id: "detail-box",
      title: "Detail",
      prompt: "Starter detail shows ok=false at t=3.",
      hint: "Cycle detail panel",
      setup: () => loadStarter(),
      check: () => /ok=false/.test(document.getElementById("detail-box").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions witness.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /witness/i.test(sourceSketch()),
    },
    {
      id: "walk-back",
      title: "Walk back",
      prompt: "From t=4, Prev twice — land t=2 OK.",
      hint: "Prev twice",
      setup: () => {
        loadStarter();
        updateCursor(4);
        stepCursor(-1);
        stepCursor(-1);
      },
      check: () => state.cursor === 2 && state.verdict === "OK",
    },
    {
      id: "quiz-replay",
      title: "Quiz: replay",
      type: "quiz",
      prompt: "Replay CEX in sim can…",
      hint: "Cross-check.",
      choices: [
        "confirm waveform matches formal",
        "prove vacuity",
        "replace Git",
        "delete RTL",
      ],
      answer: "confirm waveform matches formal",
    },
    {
      id: "quiz-local",
      title: "Quiz: local",
      type: "quiz",
      prompt: "Real CEX files come from…",
      hint: "Tool output.",
      choices: [
        "formal tool export",
        "browser sketch only",
        "Git tag",
        "README typo",
      ],
      answer: "formal tool export",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — starter t=3 FAIL.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => state.cursor === 3 && state.verdict === "FAIL",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="fcex-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (saved.preset && PRESETS[saved.preset]) {
        state.preset = saved.preset;
        state.wave = cloneWave(PRESETS[saved.preset].wave);
        state.note = PRESETS[saved.preset].note;
        if (typeof saved.cursor === "number") updateCursor(saved.cursor);
        syncInputs();
        pushLog("# restore session");
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  document.getElementById("fcex-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-prev").addEventListener("click", () => stepCursor(-1));
  document.getElementById("btn-next").addEventListener("click", () => stepCursor(1));
  document.getElementById("btn-jump").addEventListener("click", () => jumpToFail());
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
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else if (typeof ch.check === "function") ok = !!ch.check();
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
    } else setChalStatus("bad", "Not yet");
    renderChallenge();
  });

  if (!restoreSession()) loadStarter();
  else renderAll();
})();
