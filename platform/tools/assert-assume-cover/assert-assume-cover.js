(() => {
  /**
   * Assert / assume / cover (concept)
   *   Tag SV-style statements · score roles · PASS vs PARTIAL
   * Starter: out==f(in) assert, reset assume, opcode cover → PASS 3/3
   */

  const ROWS = [
    { id: 0, text: "out == f(in)", role: "assert" },
    { id: 1, text: "reset deasserted", role: "assume" },
    { id: 2, text: "saw opcode 3", role: "cover" },
  ];

  const PRESETS = {
    starter: {
      label: "starter: PASS 3/3",
      roles: { 0: "assert", 1: "assume", 2: "cover" },
      note: "Classic trio — functional assert, env assume, scenario cover.",
      autoScore: true,
    },
    swap_mess: {
      label: "swap assert/assume",
      roles: { 0: "assume", 1: "assert", 2: "cover" },
      note: "Rows 0/1 swapped — only cover line correct.",
      autoScore: true,
    },
    all_assume: {
      label: "all assume",
      roles: { 0: "assume", 1: "assume", 2: "assume" },
      note: "Only middle line is truly assume in the key.",
      autoScore: true,
    },
    opcode_wrong: {
      label: "opcode as assert",
      roles: { 0: "assert", 1: "assume", 2: "assert" },
      note: "Observability mis-tagged as mandatory proof.",
      autoScore: true,
    },
    all_cover: {
      label: "all cover",
      roles: { 0: "cover", 1: "cover", 2: "cover" },
      note: "Everything treated as coverage — score 1/3.",
      autoScore: true,
    },
    mixed_partial: {
      label: "partial 2/3",
      roles: { 0: "assert", 1: "cover", 2: "cover" },
      note: "Assert ok; reset and opcode mis-tagged.",
      autoScore: true,
    },
    formal_strict: {
      label: "formal env focus",
      roles: { 0: "assert", 1: "assume", 2: "assume" },
      note: "Opcode line tagged assume — formal over-constraint sketch.",
      autoScore: true,
    },
    idle: {
      label: "idle (edit then Score)",
      roles: { 0: "assert", 1: "assume", 2: "cover" },
      note: "Correct tags loaded — press Score roles when ready.",
      autoScore: false,
    },
  };

  function sourceSketch() {
    return `// SVA roles literacy (not a full formal run)
// assert property (out == f(in));   // must hold — bug if false
// assume property (reset_deasserted); // legal environment
// cover property (saw_opcode_3);    // did scenario occur?
//
// Mis-tagging cover as assert changes proof meaning.
// In formal: assert = obligation, assume = env, cover = observability.`;
  }

  function cloneRoles(roles) {
    return { ...roles };
  }

  function scoreRoles(roles) {
    let ok = 0;
    for (const row of ROWS) {
      if (roles[row.id] === row.role) ok++;
    }
    return {
      score: ok,
      total: ROWS.length,
      verdict: ok === ROWS.length ? "PASS" : "PARTIAL",
      lines: ROWS.map((r) => {
        const chosen = roles[r.id] || "?";
        const hit = chosen === r.role;
        return `  [${r.id}] ${r.text} → ${chosen} ${hit ? "ok" : `want ${r.role}`}`;
      }),
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const roles = cloneRoles(p.roles);
    const scored = scoreRoles(roles);
    return {
      preset: "starter",
      roles,
      note: p.note,
      scored: true,
      score: scored.score,
      total: scored.total,
      verdict: scored.verdict,
      detail: scored.lines.join("\n"),
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["score PASS 3/3"],
    };
  }

  const CLEARED_KEY = "ddv-assert-assume-cover-cleared-v1";
  const STORE_KEY = "ddv-assert-assume-cover-session-v1";

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

  const root = document.getElementById("aac-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>out==f(in)</code> → assert,
        <code>reset deasserted</code> → assume, <code>saw opcode 3</code> → cover.
        Score roles → <strong>PASS 3/3</strong>.</p>
      <button type="button" class="btn btn-secondary" id="aac-starter">Load starter example</button>
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
        <div class="idea-card"><h3>assert</h3><p>Must hold — failure is a bug or spec violation.</p></div>
        <div class="idea-card"><h3>assume</h3><p>Constrains inputs or environment for legal scenarios.</p></div>
        <div class="idea-card"><h3>cover</h3><p>Tracks whether interesting scenarios occurred.</p></div>
        <div class="idea-card"><h3>Tag correctly</h3><p>Wrong role changes proof vs coverage meaning.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="aac-controls">
        <div class="aac-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>starter PASS 3/3</option>
            <option value="swap_mess">swap assert/assume</option>
            <option value="all_assume">all assume</option>
            <option value="opcode_wrong">opcode as assert</option>
            <option value="all_cover">all cover</option>
            <option value="mixed_partial">partial 2/3</option>
            <option value="formal_strict">formal env focus</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-score">Score roles</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo swap fail</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict yes">PASS 3/3</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="aac-layout">
        <div class="panel-box">
          <h3>Statement tags</h3>
          <table class="role-table" id="aac-table">
            <thead><tr><th>Statement</th><th>Role</th><th>Key</th></tr></thead>
            <tbody id="aac-tbody"></tbody>
          </table>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Score breakdown</h3>
          <div id="score-box" class="score-box"></div>
          <h3 style="margin-top:0.75rem">Role legend</h3>
          <div class="legend-row">
            <span class="role-pill is-assert">assert</span>
            <span class="role-pill is-assume">assume</span>
            <span class="role-pill is-cover">cover</span>
          </div>
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

  function readRolesFromDom() {
    const roles = { ...state.roles };
    document.querySelectorAll("#aac-tbody select").forEach((sel) => {
      const id = Number(sel.getAttribute("data-row"));
      roles[id] = sel.value;
    });
    state.roles = roles;
  }

  function doScore() {
    readRolesFromDom();
    const r = scoreRoles(state.roles);
    state.scored = true;
    state.score = r.score;
    state.total = r.total;
    state.verdict = r.verdict;
    state.detail = r.lines.join("\n");
    state.lastAction = "score";
    pushTrace(`score ${r.verdict} ${r.score}/${r.total}`);
    pushLog(`# score → ${r.verdict}`);
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter PASS 3/3");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value in PRESETS ? selPreset.value : "starter";
    const p = PRESETS[id];
    state.preset = id;
    state.roles = cloneRoles(p.roles);
    state.note = p.note;
    state.scored = false;
    state.verdict = "—";
    state.score = 0;
    state.lastAction = "load";
    if (p.autoScore) doScore();
    else {
      pushLog(`# load ${id}`);
      renderAll();
    }
  }

  function demo() {
    selPreset.value = "swap_mess";
    const p = PRESETS.swap_mess;
    state.preset = "swap_mess";
    state.roles = cloneRoles(p.roles);
    state.note = p.note;
    state.demoed = true;
    state.lastAction = "demo";
    doScore();
    pushLog("# demo swap fail");
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "assert = proof obligation; assume = environment; cover = observability. " +
        "Mis-tagging changes formal meaning."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderTable() {
    const tbody = document.getElementById("aac-tbody");
    tbody.innerHTML = "";
    for (const row of ROWS) {
      const chosen = state.roles[row.id] || "assert";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.text}</td>
        <td><select data-row="${row.id}">
          <option value="assert"${chosen === "assert" ? " selected" : ""}>assert</option>
          <option value="assume"${chosen === "assume" ? " selected" : ""}>assume</option>
          <option value="cover"${chosen === "cover" ? " selected" : ""}>cover</option>
        </select></td>
        <td class="key-cell">${row.role}</td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("change", () => {
        readRolesFromDom();
        state.scored = false;
        state.lastAction = "edit";
        pushTrace(`edit row ${sel.getAttribute("data-row")}=${sel.value}`);
        renderAll();
      });
    });
  }

  function renderLab() {
    syncInputs();
    renderTable();

    const r = state.scored ? scoreRoles(state.roles) : null;
    const v = document.getElementById("verdict");
    if (!state.scored || !r) {
      v.className = "verdict idle";
      v.textContent = "Not scored — press Score roles";
    } else if (r.verdict === "PASS") {
      v.className = "verdict yes";
      v.textContent = `PASS ${r.score}/${r.total}`;
    } else {
      v.className = "verdict warn";
      v.textContent = `PARTIAL ${r.score}/${r.total}`;
    }

    const scoreBox = document.getElementById("score-box");
    if (r) {
      scoreBox.className = "score-box " + (r.verdict === "PASS" ? "pass" : "partial");
      scoreBox.textContent = r.lines.join("\n");
    } else {
      scoreBox.className = "score-box";
      scoreBox.textContent = "Load a preset or edit tags, then Score roles.";
    }

    document.getElementById("meta-note").textContent = state.note || "";
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    document.getElementById("flag-row").innerHTML = ROWS.map((row) => {
      const chosen = state.roles[row.id] || "?";
      const ok = chosen === row.role;
      return `<span class="flag ${ok ? "is-ok" : chosen !== "?" ? "is-bad" : ""}">${row.text.slice(0, 12)}→${chosen}</span>`;
    }).join("") +
      `<span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>`;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ preset: state.preset, roles: state.roles, scored: state.scored })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-assert",
      title: "Quiz: assert",
      type: "quiz",
      prompt: "assert property failure means…",
      hint: "Must hold.",
      choices: [
        "design or bug vs spec",
        "input constraint only",
        "scenario was seen",
        "vacuous pass",
      ],
      answer: "design or bug vs spec",
    },
    {
      id: "quiz-assume",
      title: "Quiz: assume",
      type: "quiz",
      prompt: "assume restricts…",
      hint: "Constrain world.",
      choices: [
        "legal input/environment scenarios",
        "only cover points",
        "only Git",
        "BMC k",
      ],
      answer: "legal input/environment scenarios",
    },
    {
      id: "quiz-cover",
      title: "Quiz: cover",
      type: "quiz",
      prompt: "cover asks whether…",
      hint: "Observability.",
      choices: [
        "a scenario occurred during sim/formal",
        "DUT is syntactically valid",
        "Git is clean",
        "clock period is 0",
      ],
      answer: "a scenario occurred during sim/formal",
    },
    {
      id: "quiz-formal-a",
      title: "Quiz: formal assert",
      type: "quiz",
      prompt: "In formal, assert is proof…",
      hint: "Must prove.",
      choices: ["obligation", "environment only", "coverage hit", "vacuity"],
      answer: "obligation",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — PASS 3/3 after Score.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" && state.verdict === "PASS" && state.score === 3,
    },
    {
      id: "score-starter",
      title: "Score starter",
      prompt: "On starter, Score roles → PASS 3/3.",
      hint: "Score roles",
      setup: () => {
        loadStarter();
        doScore();
      },
      check: () => state.scored && state.verdict === "PASS" && state.lastAction === "score",
    },
    {
      id: "load-swap",
      title: "Load swap",
      prompt: "Load swap assert/assume — PARTIAL not PASS.",
      hint: "swap preset → Load",
      setup: () => {
        selPreset.value = "swap_mess";
        loadPreset();
      },
      check: () => state.preset === "swap_mess" && state.verdict === "PARTIAL",
    },
    {
      id: "load-all-assume",
      title: "All assume",
      prompt: "Load all assume — score 1/3.",
      hint: "all assume preset",
      setup: () => {
        selPreset.value = "all_assume";
        loadPreset();
      },
      check: () => state.score === 1 && state.preset === "all_assume",
    },
    {
      id: "opcode-wrong",
      title: "Opcode wrong",
      prompt: "Load opcode as assert — score 2/3.",
      hint: "opcode as assert",
      setup: () => {
        selPreset.value = "opcode_wrong";
        loadPreset();
      },
      check: () => state.score === 2 && state.roles[2] === "assert",
    },
    {
      id: "fix-pass",
      title: "Fix to PASS",
      prompt: "Set row 2 to cover, Score — PASS 3/3.",
      hint: "opcode → cover",
      setup: () => {
        selPreset.value = "opcode_wrong";
        loadPreset();
        state.roles[2] = "cover";
        doScore();
      },
      check: () => state.verdict === "PASS" && state.roles[2] === "cover",
    },
    {
      id: "all-cover",
      title: "All cover",
      prompt: "Load all cover — score 1/3.",
      hint: "all cover preset",
      setup: () => {
        selPreset.value = "all_cover";
        loadPreset();
      },
      check: () => state.score === 1,
    },
    {
      id: "mixed-partial",
      title: "Mixed partial",
      prompt: "Load partial 2/3 — score exactly 2.",
      hint: "mixed_partial preset",
      setup: () => {
        selPreset.value = "mixed_partial";
        loadPreset();
      },
      check: () => state.score === 2 && state.verdict === "PARTIAL",
    },
    {
      id: "edit-row",
      title: "Edit row",
      prompt: "From starter, change row 0 to cover, Score — drops score.",
      hint: "Edit select then Score",
      setup: () => {
        loadStarter();
        state.roles[0] = "cover";
        doScore();
      },
      check: () => state.score === 2 && state.roles[0] === "cover",
    },
    {
      id: "demo",
      title: "Demo swap",
      prompt: "Demo swap fail — PARTIAL and demo=1.",
      hint: "Demo swap fail",
      setup: () => loadStarter(),
      check: () => state.demoed && state.verdict === "PARTIAL" && state.lastAction === "demo",
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
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions assume.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /assume/i.test(sourceSketch()),
    },
    {
      id: "flag-row",
      title: "Flags",
      prompt: "Starter flags show all three rows tagged.",
      hint: "Load starter",
      setup: () => loadStarter(),
      check: () => {
        const html = document.getElementById("flag-row").textContent || "";
        return html.includes("assert") && html.includes("assume") && html.includes("cover");
      },
    },
    {
      id: "formal-strict",
      title: "Formal strict",
      prompt: "Load formal env focus — PARTIAL (opcode tagged assume).",
      hint: "formal_strict preset",
      setup: () => {
        selPreset.value = "formal_strict";
        loadPreset();
      },
      check: () => state.preset === "formal_strict" && state.verdict === "PARTIAL",
    },
    {
      id: "idle-score",
      title: "Idle score",
      prompt: "Load idle, Score — PASS 3/3.",
      hint: "idle → Score roles",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doScore();
      },
      check: () => state.preset === "idle" && state.verdict === "PASS",
    },
    {
      id: "quiz-overassume",
      title: "Quiz: over-assume",
      type: "quiz",
      prompt: "Over-constraining with assume can…",
      hint: "Too narrow env.",
      choices: [
        "hide real bugs (false proof)",
        "guarantee FPGA works",
        "fix synthesis",
        "run pytest",
      ],
      answer: "hide real bugs (false proof)",
    },
    {
      id: "quiz-role",
      title: "Quiz: mis-tag",
      type: "quiz",
      prompt: "Mis-tagging cover as assert would…",
      hint: "Wrong severity.",
      choices: [
        "treat observability as mandatory proof",
        "relax proof",
        "run Git",
        "start clock",
      ],
      answer: "treat observability as mandatory proof",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to starter PASS 3/3.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => state.verdict === "PASS" && state.score === 3,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="aac-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("aac-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-score").addEventListener("click", () => doScore());
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

  loadStarter();
})();
