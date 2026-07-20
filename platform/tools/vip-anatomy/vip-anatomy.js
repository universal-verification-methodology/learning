(() => {
  /**
   * VIP anatomy (concept)
   *   agent + checker + coverage + docs package
   * Starter: UART VIP — all four pieces present → COMPLETE
   */

  const PIECES = [
    {
      id: "agent",
      title: "agent",
      blurb:
        "Protocol unit: sequencer / driver / monitor + interface around one bus.",
    },
    {
      id: "checker",
      title: "checker",
      blurb:
        "Passive protocol rules (handshake / legality) — orthogonal to scoreboard payload.",
    },
    {
      id: "coverage",
      title: "coverage",
      blurb:
        "Covergroups / bins that measure which scenarios the VIP exercised.",
    },
    {
      id: "docs",
      title: "docs",
      blurb:
        "Handoff: API notes, README, examples, and a self-test so consumers can integrate.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: complete UART VIP",
      agent: true,
      checker: true,
      coverage: true,
      docs: true,
      note: "All four deliverables present — package COMPLETE for handoff.",
      autoAssemble: true,
    },
    no_checker: {
      label: "missing checker",
      agent: true,
      checker: false,
      coverage: true,
      docs: true,
      note: "Agent + cov + docs, but no protocol checker — INCOMPLETE.",
      autoAssemble: true,
    },
    no_cov: {
      label: "missing coverage",
      agent: true,
      checker: true,
      coverage: false,
      docs: true,
      note: "Stimulus/check OK, but no coverage model — INCOMPLETE.",
      autoAssemble: true,
    },
    no_docs: {
      label: "missing docs",
      agent: true,
      checker: true,
      coverage: true,
      docs: false,
      note: "Code pieces present, but no docs/self-test handoff — INCOMPLETE.",
      autoAssemble: true,
    },
    agent_only: {
      label: "agent only",
      agent: true,
      checker: false,
      coverage: false,
      docs: false,
      note: "Only the agent — useful scaffold, not a VIP package yet.",
      autoAssemble: true,
    },
    empty: {
      label: "empty package",
      agent: false,
      checker: false,
      coverage: false,
      docs: false,
      note: "Empty — toggle pieces or Load a preset, then Assemble.",
      autoAssemble: false,
    },
  };

  function sourceSketch() {
    return `// VIP anatomy literacy (not a commercial VIP)
// Verification IP package (reuse unit) typically includes:
//
//   agent     — drive / observe one interface
//   checker   — bus-rule / protocol legality (passive)
//   coverage  — scenario / bin measurement
//   docs      — API + README + examples + self-test
//
// Incomplete VIP = missing handoff pieces.
// Scoreboard may live in the env; VIP often ships checker + coverage.
// Consumer: integrate agent, bind checker, close coverage, read docs.`;
  }

  function makeStarter() {
    return {
      preset: "starter",
      agent: true,
      checker: true,
      coverage: true,
      docs: true,
      note: PRESETS.starter.note,
      selected: "agent",
      complete: true,
      lastAssembled: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: ["assemble: COMPLETE agent+checker+coverage+docs"],
    };
  }

  const CLEARED_KEY = "ddv-vip-anatomy-cleared-v1";
  const STORE_KEY = "ddv-vip-anatomy-session-v1";

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

  const root = document.getElementById("vip-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> UART VIP with
        <code>agent</code> + <code>checker</code> + <code>coverage</code> + <code>docs</code>
        — package COMPLETE.</p>
      <button type="button" class="btn btn-secondary" id="vip-starter">Load starter example</button>
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
        <div class="idea-card"><h3>agent</h3><p>Drive / observe one protocol interface.</p></div>
        <div class="idea-card"><h3>checker</h3><p>Passive bus-rule watch shipped with the VIP.</p></div>
        <div class="idea-card"><h3>coverage</h3><p>Bins that prove which scenarios ran.</p></div>
        <div class="idea-card"><h3>docs</h3><p>API + examples + self-test for handoff.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="vip-controls">
        <div class="vip-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>complete UART VIP</option>
            <option value="no_checker">missing checker</option>
            <option value="no_cov">missing coverage</option>
            <option value="no_docs">missing docs</option>
            <option value="agent_only">agent only</option>
            <option value="empty">empty package</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-assemble">Assemble</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo incomplete</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="vip-layout">
        <div class="panel-box">
          <h3>Package pieces</h3>
          <p style="margin:0 0 0.5rem;font-size:0.82rem;color:var(--muted)">Click a card to select; click again to toggle in/out of the package.</p>
          <div class="piece-row" id="piece-row"></div>
          <h3>Handoff checklist</h3>
          <ul class="checklist" id="check-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Package tree</h3>
          <pre class="tree-box" id="tree-box"></pre>
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

  function isComplete() {
    return !!(state.agent && state.checker && state.coverage && state.docs);
  }

  function missingList() {
    return PIECES.filter((p) => !state[p.id]).map((p) => p.id);
  }

  function treeSketch() {
    const mark = (on) => (on ? "[x]" : "[ ]");
    return `uart_vip/
├── ${mark(state.agent)} agent/          # sqr + drv + mon + if
├── ${mark(state.checker)} checker/        # protocol rules
├── ${mark(state.coverage)} coverage/       # covergroups / bins
└── ${mark(state.docs)} docs/           # API · README · self-test

status: ${state.lastAssembled ? (state.complete ? "COMPLETE" : "INCOMPLETE") : "— (Assemble)"}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kindName, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kindName;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter complete UART VIP");
    renderAll();
  }

  function assemble(silent) {
    state.complete = isComplete();
    state.lastAssembled = true;
    const miss = missingList();
    const line = state.complete
      ? "assemble: COMPLETE agent+checker+coverage+docs"
      : `assemble: INCOMPLETE missing=${miss.join(",") || "—"}`;
    pushTrace(line);
    if (!silent) {
      state.lastAction = state.complete ? "assemble-ok" : "assemble-bad";
      pushLog(`# assemble ${state.complete ? "COMPLETE" : "INCOMPLETE"}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.agent = p.agent;
    state.checker = p.checker;
    state.coverage = p.coverage;
    state.docs = p.docs;
    state.note = p.note;
    state.complete = false;
    state.lastAssembled = false;
    syncInputs();
    if (p.autoAssemble) {
      assemble(true);
      if (mark) state.lastAction = mark;
    } else if (mark) {
      state.lastAction = mark;
    }
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function demo() {
    applyPreset("no_checker", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo incomplete (no checker)");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: VIP = reusable agent + checker + coverage + docs handoff; " +
        "agent alone is not a full package."
    );
    renderAll();
  }

  function selectPiece(id) {
    if (state.selected === id) {
      state[id] = !state[id];
      state.lastAssembled = false;
      state.complete = false;
      state.lastAction = "toggle";
      pushTrace(`toggle ${id}=${state[id] ? 1 : 0}`);
      pushLog(`# toggle ${id} ${state[id] ? "in" : "out"}`);
    } else {
      state.selected = id;
      state.lastAction = "select";
    }
    renderAll();
  }

  function renderLab() {
    syncInputs();
    document.getElementById("piece-row").innerHTML = PIECES.map((p) => {
      const on = !!state[p.id];
      const sel = state.selected === p.id;
      return `<button type="button" class="piece-card ${on ? "is-on" : "is-off"} ${sel ? "is-sel" : ""}" data-piece="${p.id}">
        <div class="k">${p.title}</div>
        <div class="v">${on ? "included" : "missing"}</div>
        <span class="tag">${on ? "IN" : "OUT"}</span>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-piece]").forEach((el) => {
      el.addEventListener("click", () =>
        selectPiece(/** @type {string} */ (el.getAttribute("data-piece")))
      );
    });

    document.getElementById("check-list").innerHTML = PIECES.map((p) => {
      const on = !!state[p.id];
      return `<li><span class="id">${p.id}</span><span class="${on ? "ok" : "bad"}">${on ? "OK" : "MISSING"}</span></li>`;
    }).join("");

    document.getElementById("meta-note").textContent = state.note;
    const sel = PIECES.find((p) => p.id === state.selected) || PIECES[0];
    document.getElementById("role-blurb").textContent = sel.blurb;
    document.getElementById("tree-box").textContent = treeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastAssembled) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Assemble package";
    } else if (state.complete) {
      v.className = "verdict yes";
      v.textContent = "Package COMPLETE — ready for handoff";
    } else {
      v.className = "verdict no";
      v.textContent = `Package INCOMPLETE — missing ${missingList().join(", ")}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.agent ? "is-ok" : "is-bad"}">agent=${state.agent ? 1 : 0}</span>
      <span class="flag ${state.checker ? "is-ok" : "is-bad"}">checker=${state.checker ? 1 : 0}</span>
      <span class="flag ${state.coverage ? "is-ok" : "is-bad"}">coverage=${state.coverage ? 1 : 0}</span>
      <span class="flag ${state.docs ? "is-ok" : "is-bad"}">docs=${state.docs ? 1 : 0}</span>
      <span class="flag ${state.complete && state.lastAssembled ? "is-ok" : state.lastAssembled ? "is-bad" : ""}">pkg=${state.lastAssembled ? (state.complete ? "ok" : "bad") : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          agent: state.agent,
          checker: state.checker,
          coverage: state.coverage,
          docs: state.docs,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-vip",
      title: "Quiz: VIP",
      type: "quiz",
      prompt: "A verification IP (VIP) package is mainly…",
      hint: "Reusable deliverable.",
      choices: [
        "a reusable agent + checker + coverage + docs handoff",
        "only a Makefile PHONY target",
        "a replacement for the DUT",
        "just +UVM_TESTNAME",
      ],
      answer: "a reusable agent + checker + coverage + docs handoff",
    },
    {
      id: "quiz-agent",
      title: "Quiz: agent",
      type: "quiz",
      prompt: "Inside a VIP, the agent’s job is to…",
      hint: "Interface unit.",
      choices: [
        "drive / observe one protocol interface",
        "synthesize the RTL netlist",
        "replace coverage bins",
        "own the chip foundry flow",
      ],
      answer: "drive / observe one protocol interface",
    },
    {
      id: "quiz-checker",
      title: "Quiz: checker",
      type: "quiz",
      prompt: "A VIP protocol checker typically…",
      hint: "Legality.",
      choices: [
        "flags bus-rule / handshake violations (usually passively)",
        "must write DUT registers every cycle",
        "deletes the scoreboard",
        "sets the synthesis top",
      ],
      answer: "flags bus-rule / handshake violations (usually passively)",
    },
    {
      id: "quiz-docs",
      title: "Quiz: docs",
      type: "quiz",
      prompt: "Docs in a VIP handoff usually include…",
      hint: "Consumer.",
      choices: [
        "API notes, README/examples, and a self-test path",
        "only a blank waveform window",
        "foundry PDK files",
        "timescale pragmas alone",
      ],
      answer: "API notes, README/examples, and a self-test path",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — package COMPLETE.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.complete &&
        state.lastAssembled,
    },
    {
      id: "load-nocheck",
      title: "Load no checker",
      prompt: "Load missing checker — INCOMPLETE.",
      hint: "missing checker → Load",
      setup: () => {
        selPreset.value = "no_checker";
        loadPreset();
      },
      check: () =>
        !state.checker &&
        state.lastAssembled &&
        !state.complete &&
        state.lastAction === "load",
    },
    {
      id: "load-nocov",
      title: "Load no coverage",
      prompt: "Load missing coverage — INCOMPLETE.",
      hint: "missing coverage → Load",
      setup: () => {
        selPreset.value = "no_cov";
        loadPreset();
      },
      check: () => !state.coverage && !state.complete,
    },
    {
      id: "load-nodocs",
      title: "Load no docs",
      prompt: "Load missing docs — INCOMPLETE.",
      hint: "missing docs → Load",
      setup: () => {
        selPreset.value = "no_docs";
        loadPreset();
      },
      check: () => !state.docs && !state.complete,
    },
    {
      id: "load-agent",
      title: "Load agent only",
      prompt: "Load agent only — only agent flag set.",
      hint: "agent only → Load",
      setup: () => {
        selPreset.value = "agent_only";
        loadPreset();
      },
      check: () =>
        state.agent &&
        !state.checker &&
        !state.coverage &&
        !state.docs,
    },
    {
      id: "assemble-ok",
      title: "Assemble complete",
      prompt: "From empty, include all four pieces, Assemble — COMPLETE.",
      hint: "empty → toggle all in → Assemble",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.agent = true;
        state.checker = true;
        state.coverage = true;
        state.docs = true;
        assemble(false);
      },
      check: () =>
        state.complete && state.lastAction === "assemble-ok",
    },
    {
      id: "assemble-bad",
      title: "Assemble incomplete",
      prompt: "From agent only, Assemble — INCOMPLETE.",
      hint: "agent only → Assemble",
      setup: () => {
        selPreset.value = "agent_only";
        applyPreset("agent_only", null);
        state.lastAssembled = false;
        assemble(false);
      },
      check: () =>
        !state.complete && state.lastAction === "assemble-bad",
    },
    {
      id: "toggle-out",
      title: "Toggle out",
      prompt: "On starter, select docs then click again to remove it.",
      hint: "Click docs twice",
      setup: () => {
        loadStarter();
        state.selected = "docs";
        state.docs = false;
        state.lastAssembled = false;
        state.complete = false;
        state.lastAction = "toggle";
        pushTrace("toggle docs=0");
        renderAll();
      },
      check: () =>
        !state.docs && state.lastAction === "toggle",
    },
    {
      id: "toggle-in",
      title: "Toggle in",
      prompt: "From no_docs, toggle docs back in.",
      hint: "Load no_docs → click docs twice",
      setup: () => {
        selPreset.value = "no_docs";
        loadPreset();
        state.selected = "docs";
        state.docs = true;
        state.lastAssembled = false;
        state.complete = false;
        state.lastAction = "toggle";
        pushTrace("toggle docs=1");
        renderAll();
      },
      check: () => state.docs === true && state.lastAction === "toggle",
    },
    {
      id: "demo",
      title: "Demo incomplete",
      prompt: "Click Demo incomplete.",
      hint: "Demo incomplete",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.checker &&
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
      id: "select-cov",
      title: "Select coverage",
      prompt: "Click the coverage piece card (select, not toggle).",
      hint: "Click coverage once from another selection",
      setup: () => {
        loadStarter();
        state.selected = "agent";
        renderAll();
        selectPiece("coverage");
      },
      check: () =>
        state.selected === "coverage" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions handoff.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /handoff/i.test(sourceSketch()),
    },
    {
      id: "tree-complete",
      title: "Tree complete",
      prompt: "On starter, package tree shows COMPLETE.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /COMPLETE/.test(document.getElementById("tree-box").textContent),
    },
    {
      id: "missing-list",
      title: "Missing list",
      prompt: "On no_checker, missing includes checker.",
      hint: "missing checker → Load",
      setup: () => {
        selPreset.value = "no_checker";
        loadPreset();
      },
      check: () => missingList().includes("checker"),
    },
    {
      id: "all-four",
      title: "All four",
      prompt: "Starter has agent∧checker∧coverage∧docs.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => isComplete(),
    },
    {
      id: "empty-idle",
      title: "Empty idle",
      prompt: "Load empty — not yet assembled.",
      hint: "empty → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        !state.lastAssembled &&
        !state.agent &&
        state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From empty, Reset — COMPLETE again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" && state.complete,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="vip-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("vip-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-assemble").addEventListener("click", () => assemble(false));
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
      if (saved && typeof saved.agent === "boolean") {
        state.agent = saved.agent;
        state.checker = !!saved.checker;
        state.coverage = !!saved.coverage;
        state.docs = !!saved.docs;
        state.preset = saved.preset || "starter";
        state.lastAssembled = false;
        state.complete = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
