(() => {
  /**
   * Objection raise/drop (concept)
   *   Who holds run open — raise/drop counts until 0
   * Starter: test raised → run open
   */

  const ACTORS = ["test", "env", "agent", "sequence"];

  const PRESETS = {
    starter: {
      label: "starter: test holding run",
      counts: { test: 1, env: 0, agent: 0, sequence: 0 },
      actor: "test",
      note: "test raised once — total>0 so run stays open.",
    },
    multi: {
      label: "two holders",
      counts: { test: 1, env: 0, agent: 0, sequence: 1 },
      actor: "sequence",
      note: "test + sequence both hold — must drop both to end run.",
    },
    closed: {
      label: "all dropped (run ended)",
      counts: { test: 0, env: 0, agent: 0, sequence: 0 },
      actor: "test",
      note: "Total 0 — run phase can end; check/report follow.",
    },
    drain: {
      label: "mid-drain (1 left)",
      counts: { test: 0, env: 0, agent: 1, sequence: 0 },
      actor: "agent",
      note: "One agent objection left — almost done.",
    },
  };

  function sourceSketch() {
    return `// Objection literacy (not a full phasing engine)
// In run_phase:
//   phase.raise_objection(this);
//   ... do work / start sequences ...
//   phase.drop_objection(this);
//
// Run stays open while the objection count > 0.
// Whoever raised should drop (balanced).
// Multiple components can hold at once — all must drop.
// Forgetting to drop → sim hangs in run (common bug).
// Dropping too early → short tests / missing stimulus.`;
  }

  function totalOf(counts) {
    return ACTORS.reduce((s, a) => s + (counts[a] || 0), 0);
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      counts: { ...p.counts },
      actor: p.actor,
      note: p.note,
      runEnded: false,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-objections-cleared-v1";
  const STORE_KEY = "ddv-uvm-objections-session-v1";

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

  const root = document.getElementById("uobj-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>test</code> has
        <code>raise_objection</code> — total count 1, run stays open.</p>
      <button type="button" class="btn btn-secondary" id="uobj-starter">Load starter example</button>
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
        <div class="idea-card"><h3>raise</h3><p>Keep run (and sim time) alive while work continues.</p></div>
        <div class="idea-card"><h3>drop</h3><p>Release your hold; when total hits 0, run can end.</p></div>
        <div class="idea-card"><h3>Who</h3><p>Tests, sequences, agents… anyone in run may hold.</p></div>
        <div class="idea-card"><h3>Balance</h3><p>Raise without drop → hang; drop too soon → short test.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="uobj-controls">
        <div class="uobj-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>test holding</option>
            <option value="multi">two holders</option>
            <option value="drain">one left</option>
            <option value="closed">all dropped</option>
          </select>
        </div>
        <div class="uobj-field">
          <label for="sel-actor">Actor</label>
          <select id="sel-actor">
            <option value="test">test</option>
            <option value="env">env</option>
            <option value="agent">agent</option>
            <option value="sequence">sequence</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-raise">raise_objection</button>
        <button type="button" class="btn btn-secondary" id="btn-drop">drop_objection</button>
        <button type="button" class="btn btn-ghost" id="btn-drop-all">Drop all</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo multi</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="uobj-layout">
        <div class="panel-box">
          <h3>Run-phase hold</h3>
          <div id="phase-pill" class="phase-pill">run</div>
          <div id="count-big" class="count-big">0</div>
          <table class="holder-table">
            <thead><tr><th>component</th><th>count</th></tr></thead>
            <tbody id="holder-body"></tbody>
          </table>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Code sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:18rem"></pre>
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
  const selActor = /** @type {HTMLSelectElement} */ (document.getElementById("sel-actor"));

  function codeSketch() {
    const t = totalOf(state.counts);
    return `task run_phase(uvm_phase phase);
  phase.raise_objection(this);   // ${state.actor} style
  // … stimulus / wait …
  phase.drop_objection(this);
endtask

// holders now:
${ACTORS.map((a) => `  ${a}: ${state.counts[a]}`).join("\n")}
// total=${t}  run_open=${t > 0 ? 1 : 0}`;
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

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    selActor.value = state.actor;
  }

  function pullActor() {
    state.actor = selActor.value;
  }

  function maybeEnd() {
    if (totalOf(state.counts) === 0) {
      state.runEnded = true;
      pushTrace("total=0 → run can end");
    } else {
      state.runEnded = false;
    }
  }

  function raise() {
    pullActor();
    state.counts[state.actor] = (state.counts[state.actor] || 0) + 1;
    state.runEnded = false;
    state.lastAction = "raise";
    pushLog(`# raise ${state.actor}`);
    pushTrace(`${state.actor} raise → ${state.counts[state.actor]} (total ${totalOf(state.counts)})`);
    renderAll();
  }

  function drop() {
    pullActor();
    if ((state.counts[state.actor] || 0) <= 0) {
      state.lastAction = "drop-empty";
      pushLog(`# drop ${state.actor} (already 0)`);
      renderAll();
      return;
    }
    state.counts[state.actor] -= 1;
    state.lastAction = "drop";
    pushLog(`# drop ${state.actor}`);
    pushTrace(`${state.actor} drop → ${state.counts[state.actor]} (total ${totalOf(state.counts)})`);
    maybeEnd();
    renderAll();
  }

  function dropAll() {
    ACTORS.forEach((a) => {
      state.counts[a] = 0;
    });
    state.lastAction = "drop-all";
    pushLog("# drop all");
    pushTrace("all dropped");
    maybeEnd();
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter test holding");
    pushTrace("total=1 run open");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.counts = { ...p.counts };
    state.actor = p.actor;
    state.note = p.note;
    state.runEnded = totalOf(state.counts) === 0;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function demo() {
    const p = PRESETS.multi;
    state.preset = "multi";
    state.counts = { ...p.counts };
    state.actor = p.actor;
    state.note = p.note;
    state.demoed = true;
    state.runEnded = false;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo two holders");
    pushTrace("test=1 sequence=1 — drop one still open");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: raise keeps run open; drop until total 0 ends run; " +
        "balance raises/drops per component."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const total = totalOf(state.counts);
    const open = total > 0;

    const pill = document.getElementById("phase-pill");
    pill.className = "phase-pill " + (open ? "is-run" : "is-done");
    pill.textContent = open ? "run OPEN" : "run ENDED → check/report";

    const big = document.getElementById("count-big");
    big.className = "count-big " + (open ? "is-open" : "is-closed");
    big.textContent = String(total);

    const body = document.getElementById("holder-body");
    body.innerHTML = ACTORS.map((a) => {
      const n = state.counts[a] || 0;
      return `<tr class="${n ? "is-on" : ""}"><td>${a}</td><td>${n}</td></tr>`;
    }).join("");

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (open) {
      v.className = "verdict warn";
      v.textContent = `Run held open — total objections = ${total}`;
    } else {
      v.className = "verdict yes";
      v.textContent = "No objections — run can end";
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">total=${total}</span>
      <span class="flag ${open ? "is-on" : "is-ok"}">open=${open ? 1 : 0}</span>
      <span class="flag is-on">actor=${state.actor}</span>
      <span class="flag ${state.counts.test ? "is-on" : ""}">test=${state.counts.test}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          counts: state.counts,
          actor: state.actor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-raise",
      title: "Quiz: raise",
      type: "quiz",
      prompt: "raise_objection in run_phase…",
      hint: "Keep alive.",
      choices: [
        "keeps the run phase open while work continues",
        "deletes the env hierarchy",
        "skips connect_phase",
        "forces $finish immediately",
      ],
      answer: "keeps the run phase open while work continues",
    },
    {
      id: "quiz-drop",
      title: "Quiz: drop",
      type: "quiz",
      prompt: "When the total objection count reaches 0…",
      hint: "End run.",
      choices: [
        "the run phase can end (then check/report)",
        "build_phase restarts",
        "the DUT is resynthesized",
        "ConfigDB is wiped always",
      ],
      answer: "the run phase can end (then check/report)",
    },
    {
      id: "quiz-multi",
      title: "Quiz: multi",
      type: "quiz",
      prompt: "If two components each raised once…",
      hint: "Both must drop.",
      choices: [
        "both must drop before total hits 0",
        "one drop ends run immediately",
        "raises cancel each other",
        "only the test may drop",
      ],
      answer: "both must drop before total hits 0",
    },
    {
      id: "quiz-hang",
      title: "Quiz: hang",
      type: "quiz",
      prompt: "A common hang is…",
      hint: "Forgot drop.",
      choices: [
        "raise without a matching drop (count stuck > 0)",
        "calling $display too often",
        "using virtual interfaces",
        "having a scoreboard",
      ],
      answer: "raise without a matching drop (count stuck > 0)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — test=1, total=1, run open.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.counts.test === 1 &&
        totalOf(state.counts) === 1,
    },
    {
      id: "raise",
      title: "Raise",
      prompt: "From closed preset, raise as test → total=1.",
      hint: "Load closed → raise",
      setup: () => {
        selPreset.value = "closed";
        loadPreset();
        selActor.value = "test";
        raise();
      },
      check: () => state.counts.test >= 1 && state.lastAction === "raise",
    },
    {
      id: "drop",
      title: "Drop",
      prompt: "On starter, drop as test → total=0.",
      hint: "Actor=test → drop",
      setup: () => {
        loadStarter();
        selActor.value = "test";
        drop();
      },
      check: () =>
        state.counts.test === 0 &&
        totalOf(state.counts) === 0 &&
        state.lastAction === "drop",
    },
    {
      id: "load-multi",
      title: "Load multi",
      prompt: "Load two holders — total=2.",
      hint: "two holders → Load",
      setup: () => {
        selPreset.value = "multi";
        loadPreset();
      },
      check: () => state.preset === "multi" && totalOf(state.counts) === 2,
    },
    {
      id: "drop-one-still",
      title: "Drop one still open",
      prompt: "On multi, drop sequence once — total still 1.",
      hint: "multi → actor sequence → drop",
      setup: () => {
        selPreset.value = "multi";
        loadPreset();
        selActor.value = "sequence";
        drop();
      },
      check: () =>
        state.counts.sequence === 0 &&
        state.counts.test === 1 &&
        totalOf(state.counts) === 1,
    },
    {
      id: "load-closed",
      title: "Load closed",
      prompt: "Load all dropped — open=0.",
      hint: "all dropped → Load",
      setup: () => {
        selPreset.value = "closed";
        loadPreset();
      },
      check: () => totalOf(state.counts) === 0 && state.runEnded,
    },
    {
      id: "load-drain",
      title: "Load drain",
      prompt: "Load one left — agent=1.",
      hint: "one left → Load",
      setup: () => {
        selPreset.value = "drain";
        loadPreset();
      },
      check: () => state.counts.agent === 1 && totalOf(state.counts) === 1,
    },
    {
      id: "drop-all",
      title: "Drop all",
      prompt: "From multi, Drop all → total=0.",
      hint: "Drop all",
      setup: () => {
        selPreset.value = "multi";
        loadPreset();
        dropAll();
      },
      check: () => totalOf(state.counts) === 0 && state.lastAction === "drop-all",
    },
    {
      id: "demo",
      title: "Demo multi",
      prompt: "Click Demo multi — total=2.",
      hint: "Demo multi",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        totalOf(state.counts) === 2 &&
        state.lastAction === "demo",
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
      id: "sketch-raise",
      title: "Sketch raise",
      prompt: "Code sketch mentions raise_objection.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /raise_objection/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions hanging in run.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /hangs in run/i.test(sourceSketch()),
    },
    {
      id: "pill-open",
      title: "Pill open",
      prompt: "Starter phase pill says run OPEN.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /OPEN/.test(document.getElementById("phase-pill").textContent),
    },
    {
      id: "pill-ended",
      title: "Pill ended",
      prompt: "After Drop all from starter, pill shows ENDED.",
      hint: "Drop all",
      setup: () => {
        loadStarter();
        dropAll();
      },
      check: () => /ENDED/.test(document.getElementById("phase-pill").textContent),
    },
    {
      id: "double-raise",
      title: "Double raise",
      prompt: "On starter, raise test again → test=2.",
      hint: "raise again",
      setup: () => {
        loadStarter();
        selActor.value = "test";
        raise();
      },
      check: () => state.counts.test === 2,
    },
    {
      id: "env-raise",
      title: "Env raise",
      prompt: "From closed, raise as env → env=1.",
      hint: "closed → actor env → raise",
      setup: () => {
        selPreset.value = "closed";
        loadPreset();
        selActor.value = "env";
        raise();
      },
      check: () => state.counts.env === 1 && state.lastAction === "raise",
    },
    {
      id: "drop-empty",
      title: "Drop empty",
      prompt: "On closed, drop test — drop-empty action.",
      hint: "closed → drop",
      setup: () => {
        selPreset.value = "closed";
        loadPreset();
        selActor.value = "test";
        drop();
      },
      check: () => state.lastAction === "drop-empty",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to test holding (total=1).",
      hint: "Reset",
      setup: () => {
        dropAll();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.counts.test === 1 && totalOf(state.counts) === 1;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="uobj-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("uobj-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-raise").addEventListener("click", () => raise());
  document.getElementById("btn-drop").addEventListener("click", () => drop());
  document.getElementById("btn-drop-all").addEventListener("click", () => dropAll());
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

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.counts) {
        state.counts = { ...PRESETS.starter.counts, ...saved.counts };
        state.actor = saved.actor || "test";
        state.preset = saved.preset || "starter";
        state.runEnded = totalOf(state.counts) === 0;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
