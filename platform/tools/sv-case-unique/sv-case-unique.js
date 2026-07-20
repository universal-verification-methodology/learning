(() => {
  /**
   * unique / priority case — overlap & incomplete semantics (concept model).
   *
   * plain case     — first match; no uniqueness / completeness checks
   * unique case    — items mutually exclusive; every value must match (or default)
   * priority case  — first match intentional; still warn if no match
   * unique0/priority0 — same as unique/priority but no incomplete warning (mentioned in cheat sheet)
   */

  const VALS = [
    { v: 0, bin: "00" },
    { v: 1, bin: "01" },
    { v: 2, bin: "10" },
    { v: 3, bin: "11" },
  ];

  /** Preset item sets: each item = { label, pattern, set: number[] } */
  const PRESETS = {
    clean: {
      name: "clean (full, no overlap)",
      items: [
        { label: "A", pattern: "2'b00", set: [0] },
        { label: "B", pattern: "2'b01", set: [1] },
        { label: "C", pattern: "2'b10", set: [2] },
        { label: "D", pattern: "2'b11", set: [3] },
      ],
      hasDefault: false,
    },
    incomplete: {
      name: "incomplete (no 11, no default)",
      items: [
        { label: "A", pattern: "2'b00", set: [0] },
        { label: "B", pattern: "2'b01", set: [1] },
        { label: "C", pattern: "2'b10", set: [2] },
      ],
      hasDefault: false,
    },
    overlap: {
      name: "overlap (wildcards hit same values)",
      items: [
        { label: "Lo", pattern: "2'b0?", set: [0, 1] },
        { label: "Even", pattern: "2'b?0", set: [0, 2] },
        { label: "Hi", pattern: "2'b11", set: [3] },
      ],
      hasDefault: false,
    },
    with_default: {
      name: "partial + default",
      items: [
        { label: "A", pattern: "2'b00", set: [0] },
        { label: "B", pattern: "2'b01", set: [1] },
      ],
      hasDefault: true,
    },
  };

  function makeStarter() {
    return {
      qualifier: "unique", // plain | unique | priority
      preset: "clean",
      sel: 0,
      lastAction: "",
      explained: false,
      analyzed: false,
      setUnique: false,
      setPriority: false,
      setPlain: false,
      setOverlap: false,
      setIncomplete: false,
      setClean: false,
      setDefault: false,
      log: [],
      trace: [],
    };
  }

  function presetData(state) {
    return PRESETS[state.preset] || PRESETS.clean;
  }

  /** Which item indices match sel */
  function matchIndices(state) {
    const p = presetData(state);
    const hits = [];
    p.items.forEach((it, i) => {
      if (it.set.includes(state.sel)) hits.push(i);
    });
    return hits;
  }

  function coverage(state) {
    const p = presetData(state);
    const map = [0, 0, 0, 0];
    p.items.forEach((it) => {
      it.set.forEach((v) => {
        map[v]++;
      });
    });
    if (p.hasDefault) {
      for (let i = 0; i < 4; i++) {
        if (map[i] === 0) map[i] = -1; // covered by default
      }
    }
    return map;
  }

  function hasOverlap(state) {
    return coverage(state).some((c) => c > 1);
  }

  function hasIncomplete(state) {
    const map = coverage(state);
    // incomplete if any value has 0 item matches and no default
    return map.some((c) => c === 0);
  }

  /** First-match branch (plain / priority / unique all select first in SV) */
  function chosen(state) {
    const hits = matchIndices(state);
    const p = presetData(state);
    if (hits.length) return { kind: "item", index: hits[0], label: p.items[hits[0]].label };
    if (p.hasDefault) return { kind: "default", index: -1, label: "default" };
    return { kind: "none", index: -1, label: "(none)" };
  }

  function warnings(state) {
    const hits = matchIndices(state);
    const w = [];
    if (state.qualifier === "plain") return w;

    if (state.qualifier === "unique") {
      if (hits.length > 1)
        w.push({ kind: "overlap", text: "unique violation: multiple items match" });
      if (hits.length === 0 && !presetData(state).hasDefault)
        w.push({ kind: "incomplete", text: "unique violation: no item matches" });
    }
    if (state.qualifier === "priority") {
      // overlap OK
      if (hits.length === 0 && !presetData(state).hasDefault)
        w.push({ kind: "incomplete", text: "priority violation: no item matches" });
    }
    return w;
  }

  function staticIssues(state) {
    const issues = [];
    if (state.qualifier === "unique" && hasOverlap(state))
      issues.push("static: overlapping item sets (unique expects mutex)");
    if (
      (state.qualifier === "unique" || state.qualifier === "priority") &&
      hasIncomplete(state)
    )
      issues.push("static: not all 2-bit values covered (no default)");
    return issues;
  }

  function sourceCode(state) {
    const p = presetData(state);
    const q =
      state.qualifier === "plain"
        ? "case"
        : state.qualifier === "unique"
          ? "unique case"
          : "priority case";
    const lines = p.items.map(
      (it) => `  ${it.pattern}: y = ${it.label};`
    );
    if (p.hasDefault) lines.push("  default: y = DEF;");
    const ch = chosen(state);
    const ws = warnings(state);
    return `${q} (sel) // sel=2'b${VALS[state.sel].bin}
${lines.join("\n")}
endcase
// chosen → ${ch.label}${ws.length ? "\n// WARN: " + ws.map((x) => x.text).join("; ") : ""}`;
  }

  const CLEARED_KEY = "ddv-sv-case-unique-cleared-v1";
  const STORE_KEY = "ddv-sv-case-unique-session-v1";

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

  const root = document.getElementById("cu-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>unique case</code> over a clean 2-bit decode.
        Switch to an overlapping or incomplete item set and watch simulator-style warnings.</p>
      <button type="button" class="btn btn-secondary" id="cu-starter">Load starter example</button>
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
            <h3>unique</h3>
            <p>Items must be mutex; every value must hit (or default).</p>
          </div>
          <div class="idea-card">
            <h3>priority</h3>
            <p>First match intentional; still expect a match.</p>
          </div>
          <div class="idea-card">
            <h3>plain case</h3>
            <p>First match, silent on overlap / holes.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Case explorer</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Qualifier
              <select id="qual-sel">
                <option value="plain">case (plain)</option>
                <option value="unique" selected>unique case</option>
                <option value="priority">priority case</option>
              </select>
            </label>
            <label>Item set
              <select id="preset-sel">
                <option value="clean" selected>clean</option>
                <option value="incomplete">incomplete</option>
                <option value="overlap">overlap</option>
                <option value="with_default">partial + default</option>
              </select>
            </label>
          </div>
          <p class="legend">Click a 2-bit sel value. Green = covered once; orange = multi-match; purple = gap.</p>
          <div class="cover-grid" id="cover-grid"></div>
          <div class="case-items" id="case-items"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-clean">Preset unique + clean</button>
            <button type="button" id="btn-overlap">Preset unique + overlap</button>
            <button type="button" id="btn-incomplete">Preset unique + incomplete</button>
            <button type="button" id="btn-priority">Preset priority + overlap</button>
            <button type="button" id="btn-plain">Preset plain + overlap</button>
            <button type="button" id="btn-analyze">Analyze warnings</button>
            <button type="button" id="btn-explain">Explain qualifiers</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Match &amp; checks</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card" id="card-chosen">
              <h3>Chosen branch</h3>
              <p class="val" id="val-chosen">—</p>
              <p class="note" id="note-chosen"></p>
            </div>
            <div class="status-card" id="card-warn">
              <h3>Runtime check</h3>
              <p class="val" id="val-warn">—</p>
              <p class="note" id="note-warn"></p>
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
          <thead><tr><th>Qualifier</th><th>Overlap</th><th>No match</th></tr></thead>
          <tbody>
            <tr><td><code>case</code></td><td>silent (first wins)</td><td>silent / holds</td></tr>
            <tr><td><code>unique case</code></td><td>violation / warning</td><td>violation / warning</td></tr>
            <tr><td><code>priority case</code></td><td>OK (ordered)</td><td>violation / warning</td></tr>
            <tr><td><code>unique0</code> / <code>priority0</code></td><td>same as unique/priority</td><td>no incomplete warning</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: unique + clean — no warnings for any sel.</li>
          <li>Overlap set: <code>2'b0?</code> and <code>2'b?0</code> both hit <code>00</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const qualSel = document.getElementById("qual-sel");
  const presetSel = document.getElementById("preset-sel");
  const coverGrid = document.getElementById("cover-grid");
  const caseItems = document.getElementById("case-items");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardChosen = document.getElementById("card-chosen");
  const cardWarn = document.getElementById("card-warn");
  const valChosen = document.getElementById("val-chosen");
  const valWarn = document.getElementById("val-warn");
  const noteChosen = document.getElementById("note-chosen");
  const noteWarn = document.getElementById("note-warn");
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

  function renderCover() {
    const map = coverage(state);
    coverGrid.innerHTML = "";
    VALS.forEach((cell) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cover-cell";
      const c = map[cell.v];
      if (c > 1) btn.classList.add("is-multi");
      else if (c === 1 || c === -1) btn.classList.add("is-covered");
      else btn.classList.add("is-gap");
      if (state.sel === cell.v) btn.classList.add("is-sel");
      btn.textContent = `2'b${cell.bin}`;
      btn.title =
        c > 1
          ? "multi-match"
          : c === 0
            ? "uncovered"
            : c === -1
              ? "default covers"
              : "one item";
      btn.addEventListener("click", () => {
        state.sel = cell.v;
        state.lastAction = "sel";
        pushLog("run", `# sel → 2'b${cell.bin}`);
        renderAll();
      });
      coverGrid.appendChild(btn);
    });
  }

  function renderItems() {
    const p = presetData(state);
    const hits = matchIndices(state);
    caseItems.innerHTML = "";
    p.items.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "case-item";
      if (hits.includes(i)) row.classList.add("is-hit");
      if (hits.length > 1 && hits.includes(i)) row.classList.add("is-overlap");
      if (!hits.includes(i)) row.classList.add("is-miss");
      row.innerHTML = `<span class="tag">${hits[0] === i ? "HIT" : hits.includes(i) ? "ALSO" : "—"}</span>
        <span>${it.pattern} → ${it.label}</span>`;
      caseItems.appendChild(row);
    });
    if (p.hasDefault) {
      const row = document.createElement("div");
      row.className = "case-item";
      if (!hits.length) row.classList.add("is-hit");
      else row.classList.add("is-miss");
      row.innerHTML = `<span class="tag">${!hits.length ? "HIT" : "—"}</span>
        <span>default → DEF</span>`;
      caseItems.appendChild(row);
    }
  }

  function renderStatus() {
    const ch = chosen(state);
    const ws = warnings(state);
    valChosen.textContent = ch.label;
    noteChosen.textContent =
      ch.kind === "item"
        ? `first match (item ${ch.index})`
        : ch.kind === "default"
          ? "fell through to default"
          : "no match — latch/X risk in combo";

    cardChosen.className =
      "status-card " + (ch.kind === "none" ? "is-warn" : "is-ok");

    if (state.qualifier === "plain") {
      valWarn.textContent = "none";
      noteWarn.textContent = "plain case does not check";
      cardWarn.className = "status-card";
    } else if (ws.length) {
      valWarn.textContent = "WARN";
      noteWarn.textContent = ws.map((w) => w.kind).join(", ");
      cardWarn.className = "status-card is-warn";
    } else {
      valWarn.textContent = "OK";
      noteWarn.textContent = `${state.qualifier} checks pass for this sel`;
      cardWarn.className = "status-card is-ok";
    }
  }

  function renderWarn() {
    const ws = warnings(state);
    const statics = staticIssues(state);
    warnBox.classList.remove("is-ok");
    if (ws.length) {
      warnBox.classList.remove("hidden");
      warnBox.textContent = ws.map((w) => w.text).join(" · ");
    } else if (statics.length && state.qualifier !== "plain") {
      warnBox.classList.remove("hidden");
      warnBox.textContent = statics[0];
    } else if (state.qualifier !== "plain") {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent = "No runtime violation for current sel.";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(analyze or explain)</span>';
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
    qualSel.value = state.qualifier;
    presetSel.value = state.preset;
  }

  function renderAll() {
    syncInputs();
    renderCover();
    renderItems();
    codeBox.textContent = sourceCode(state);
    renderStatus();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setUnique = true;
    state.setClean = true;
    pushLog("muted", "# starter unique + clean");
    state.trace = [];
    renderAll();
  }

  function analyze() {
    state.analyzed = true;
    state.lastAction = "analyze";
    const hits = matchIndices(state);
    const ws = warnings(state);
    const ch = chosen(state);
    state.trace = [
      { kind: "muted", text: `${state.qualifier} · ${presetData(state).name}` },
      {
        kind: "hi",
        text: `sel=2'b${VALS[state.sel].bin}  matches=${hits.length}`,
      },
      { kind: "run", text: `chosen → ${ch.label}` },
      {
        kind: hasOverlap(state) ? "warn" : "ok",
        text: hasOverlap(state) ? "item sets overlap" : "no set overlap",
      },
      {
        kind: hasIncomplete(state) ? "warn" : "ok",
        text: hasIncomplete(state) ? "coverage has gaps" : "full coverage / default",
      },
      {
        kind: ws.length ? "bad" : "ok",
        text: ws.length
          ? ws.map((w) => w.text).join("; ")
          : "no runtime violation",
      },
    ];
    pushLog(ws.length ? "warn" : "ok", "# analyzed");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "case qualifiers" },
      { kind: "ok", text: "unique → mutex items + complete (or default)" },
      { kind: "ok", text: "priority → ordered match OK; still need a hit" },
      { kind: "hi", text: "plain case → silent first-match" },
      {
        kind: "warn",
        text: "unique0/priority0 skip incomplete warnings",
      },
      {
        kind: "run",
        text: `now: ${state.qualifier} + ${state.preset}`,
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("cu-starter").addEventListener("click", loadStarter);

  qualSel.addEventListener("change", () => {
    state.qualifier = qualSel.value;
    if (state.qualifier === "unique") state.setUnique = true;
    if (state.qualifier === "priority") state.setPriority = true;
    if (state.qualifier === "plain") state.setPlain = true;
    state.lastAction = "qual";
    pushLog("run", `# qualifier → ${state.qualifier}`);
    renderAll();
  });

  presetSel.addEventListener("change", () => {
    state.preset = presetSel.value;
    if (state.preset === "overlap") state.setOverlap = true;
    if (state.preset === "incomplete") state.setIncomplete = true;
    if (state.preset === "clean") state.setClean = true;
    if (state.preset === "with_default") state.setDefault = true;
    state.lastAction = "preset";
    pushLog("run", `# items → ${state.preset}`);
    renderAll();
  });

  document.getElementById("btn-clean").addEventListener("click", () => {
    state.qualifier = "unique";
    state.preset = "clean";
    state.sel = 0;
    state.setUnique = true;
    state.setClean = true;
    state.lastAction = "preset-clean";
    pushLog("ok", "# preset unique + clean");
    renderAll();
  });

  document.getElementById("btn-overlap").addEventListener("click", () => {
    state.qualifier = "unique";
    state.preset = "overlap";
    state.sel = 0; // hits both Lo and Even
    state.setUnique = true;
    state.setOverlap = true;
    state.lastAction = "preset-overlap";
    pushLog("warn", "# preset unique + overlap");
    renderAll();
  });

  document.getElementById("btn-incomplete").addEventListener("click", () => {
    state.qualifier = "unique";
    state.preset = "incomplete";
    state.sel = 3; // 11 missing
    state.setUnique = true;
    state.setIncomplete = true;
    state.lastAction = "preset-incomplete";
    pushLog("warn", "# preset unique + incomplete");
    renderAll();
  });

  document.getElementById("btn-priority").addEventListener("click", () => {
    state.qualifier = "priority";
    state.preset = "overlap";
    state.sel = 0;
    state.setPriority = true;
    state.setOverlap = true;
    state.lastAction = "preset-priority";
    pushLog("ok", "# preset priority + overlap");
    renderAll();
  });

  document.getElementById("btn-plain").addEventListener("click", () => {
    state.qualifier = "plain";
    state.preset = "overlap";
    state.sel = 0;
    state.setPlain = true;
    state.setOverlap = true;
    state.lastAction = "preset-plain";
    pushLog("ok", "# preset plain + overlap");
    renderAll();
  });

  document.getElementById("btn-analyze").addEventListener("click", analyze);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-unique",
      title: "Quiz: unique",
      prompt: "Qualifier that forbids overlapping items? Answer: <code>unique</code>",
      hint: "mutex",
      type: "text",
      answer: "unique",
      alt: ["unique case"],
    },
    {
      id: "quiz-priority",
      title: "Quiz: priority",
      prompt: "Qualifier that allows ordered overlap? Answer: <code>priority</code>",
      hint: "first match intentional",
      type: "text",
      answer: "priority",
      alt: ["priority case"],
    },
    {
      id: "quiz-plain",
      title: "Quiz: plain",
      prompt: "Unqualified keyword is just? Answer: <code>case</code>",
      hint: "no unique/priority",
      type: "text",
      answer: "case",
      alt: ["plain case", "case statement"],
    },
    {
      id: "quiz-unique0",
      title: "Quiz: unique0",
      prompt: "Like unique but no incomplete warning? Answer: <code>unique0</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "unique0",
      alt: ["unique 0"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — unique + clean.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.qualifier === "unique" &&
        state.preset === "clean" &&
        !hasOverlap(state) &&
        !hasIncomplete(state),
    },
    {
      id: "preset-clean",
      title: "Preset clean",
      prompt: "Preset unique + clean.",
      hint: "Preset unique + clean",
      type: "state",
      setup: () => {
        state.preset = "overlap";
        renderAll();
      },
      check: () =>
        state.setClean &&
        state.qualifier === "unique" &&
        state.preset === "clean" &&
        state.lastAction === "preset-clean",
    },
    {
      id: "preset-overlap",
      title: "Preset overlap",
      prompt: "Preset unique + overlap with sel=00 — runtime WARN.",
      hint: "Preset unique + overlap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setOverlap &&
        state.qualifier === "unique" &&
        state.preset === "overlap" &&
        state.sel === 0 &&
        warnings(state).some((w) => w.kind === "overlap"),
    },
    {
      id: "preset-incomplete",
      title: "Preset incomplete",
      prompt: "Preset unique + incomplete with sel=11 — incomplete WARN.",
      hint: "Preset unique + incomplete",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setIncomplete &&
        state.sel === 3 &&
        warnings(state).some((w) => w.kind === "incomplete"),
    },
    {
      id: "preset-priority",
      title: "Preset priority",
      prompt: "Preset priority + overlap — sel=00 chooses Lo, no overlap WARN.",
      hint: "Preset priority + overlap",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const ch = chosen(state);
        return (
          state.setPriority &&
          state.qualifier === "priority" &&
          state.preset === "overlap" &&
          ch.label === "Lo" &&
          !warnings(state).some((w) => w.kind === "overlap")
        );
      },
    },
    {
      id: "preset-plain",
      title: "Preset plain",
      prompt: "Preset plain + overlap — runtime check is none.",
      hint: "Preset plain + overlap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setPlain &&
        state.qualifier === "plain" &&
        warnings(state).length === 0 &&
        valWarn.textContent === "none",
    },
    {
      id: "analyze",
      title: "Analyze",
      prompt: "Run Analyze warnings.",
      hint: "Analyze warnings",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.analyzed && state.lastAction === "analyze",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain qualifiers.",
      hint: "Explain qualifiers",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "sel-11",
      title: "Sel 11",
      prompt: "On clean unique, click sel 2'b11 — chosen D.",
      hint: "Click 2'b11 cell",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.preset === "clean" &&
        state.sel === 3 &&
        chosen(state).label === "D",
    },
    {
      id: "default-covers",
      title: "Default",
      prompt: "Item set partial+default, sel=11 — chosen default.",
      hint: "Item set → partial + default, click 11",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.preset === "with_default" &&
        state.sel === 3 &&
        chosen(state).kind === "default",
    },
    {
      id: "quiz-overlap",
      title: "Quiz: overlap",
      prompt: "Two items matching one sel under unique is? Answer: <code>violation</code>",
      hint: "unique violation",
      type: "text",
      answer: "violation",
      alt: ["warn", "warning", "error", "unique violation"],
    },
    {
      id: "quiz-first",
      title: "Quiz: first",
      prompt: "Which item wins when several match? Answer: <code>first</code>",
      hint: "first listed",
      type: "text",
      answer: "first",
      alt: ["first match", "first item", "top"],
    },
    {
      id: "qual-priority",
      title: "Qual priority",
      prompt: "Switch Qualifier dropdown to priority case.",
      hint: "Qualifier select",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.qualifier === "priority" && state.lastAction === "qual",
    },
    {
      id: "priority-no-warn-overlap",
      title: "Priority OK",
      prompt: "priority + overlap + sel=00 → no runtime warnings.",
      hint: "Preset priority + overlap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.qualifier === "priority" &&
        state.preset === "overlap" &&
        state.sel === 0 &&
        warnings(state).length === 0,
    },
    {
      id: "code-unique",
      title: "Code unique",
      prompt: "Starter source begins with <code>unique case</code>.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode(state).startsWith("unique case"),
    },
    {
      id: "warn-box-overlap",
      title: "Warn box",
      prompt: "unique + overlap + sel=00 shows warn box (not is-ok).",
      hint: "Preset unique + overlap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.qualifier === "unique" &&
        state.preset === "overlap" &&
        state.sel === 0 &&
        !warnBox.classList.contains("hidden") &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "hits-two",
      title: "Two hits",
      prompt: "On overlap preset sel=00, match count is 2.",
      hint: "Preset overlap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.preset === "overlap" &&
        state.sel === 0 &&
        matchIndices(state).length === 2,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → unique overlap preset → analyze → explain.",
      hint: "Load → overlap → Analyze → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.qualifier === "unique" &&
        state.preset === "overlap" &&
        state.analyzed &&
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
