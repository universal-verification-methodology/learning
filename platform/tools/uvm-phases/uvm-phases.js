(() => {
  /**
   * UVM phase timeline (concept)
   *   build → connect → run → check → report (+ neighbors)
   * Starter: cursor on run with objection raised
   */

  /** @typedef {"build"|"connect"|"end_elab"|"start_sim"|"run"|"extract"|"check"|"report"|"final"} PhaseId */

  const PHASES = [
    {
      id: "build",
      title: "build",
      kind: "buildtime",
      dir: "top-down",
      core: true,
      blurb: "Construct components (factory create). Parent before child.",
    },
    {
      id: "connect",
      title: "connect",
      kind: "buildtime",
      dir: "bottom-up",
      core: true,
      blurb: "Wire TLM ports / assign virtual interfaces. Usually bottom-up.",
    },
    {
      id: "end_elab",
      title: "end_of_elaboration",
      kind: "buildtime",
      dir: "bottom-up",
      core: false,
      blurb: "Last build-time chance to adjust topology before run.",
    },
    {
      id: "start_sim",
      title: "start_of_simulation",
      kind: "runtime",
      dir: "bottom-up",
      core: false,
      blurb: "Just before time advances — configs settled.",
    },
    {
      id: "run",
      title: "run",
      kind: "runtime",
      dir: "bottom-up",
      core: true,
      blurb: "Time-consuming phase. Objections keep simulation alive.",
    },
    {
      id: "extract",
      title: "extract",
      kind: "cleanup",
      dir: "bottom-up",
      core: false,
      blurb: "Gather results from components after run ends.",
    },
    {
      id: "check",
      title: "check",
      kind: "cleanup",
      dir: "bottom-up",
      core: true,
      blurb: "Scoreboard / self-check decide pass vs fail.",
    },
    {
      id: "report",
      title: "report",
      kind: "cleanup",
      dir: "bottom-up",
      core: true,
      blurb: "Print summaries; UVM reporting tallies errors.",
    },
    {
      id: "final",
      title: "final",
      kind: "cleanup",
      dir: "bottom-up",
      core: false,
      blurb: "Last cleanup before the test ends.",
    },
  ];

  const BY_ID = Object.fromEntries(PHASES.map((p) => [p.id, p]));
  const CORE_ORDER = ["build", "connect", "run", "check", "report"];

  const PRESETS = {
    starter: {
      label: "starter: run + objection",
      cursor: "run",
      objection: true,
      note: "Core path paused in run while an objection holds time open.",
    },
    at_build: {
      label: "at build (top-down)",
      cursor: "build",
      objection: false,
      note: "Construction phase — parent builds children.",
    },
    at_connect: {
      label: "at connect",
      cursor: "connect",
      objection: false,
      note: "Ports and vifs get wired after build.",
    },
    at_check: {
      label: "at check (post-run)",
      cursor: "check",
      objection: false,
      note: "Run finished; check decides pass/fail.",
    },
    at_report: {
      label: "at report",
      cursor: "report",
      objection: false,
      note: "Summarize results after check.",
    },
  };

  function sourceSketch() {
    return `// UVM phase literacy (not a full phasing engine)
// Common teaching order:
//   build → connect → run → check → report
//
// Build-time: construct & connect (topology)
//   build is typically top-down (parent → child)
// Run-time:   run_phase does work; objections gate $finish
// Cleanup:    extract → check → report → final
//
// virtual function void build_phase(uvm_phase phase);
// virtual task run_phase(uvm_phase phase);
//   phase.raise_objection(this);
//   ... stimulus ...
//   phase.drop_objection(this);
// Always call super.*_phase(phase) when you override.`;
  }

  function idxOf(id) {
    return PHASES.findIndex((p) => p.id === id);
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      cursor: p.cursor,
      objection: p.objection,
      note: p.note,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-phases-cleared-v1";
  const STORE_KEY = "ddv-uvm-phases-session-v1";

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

  const root = document.getElementById("uph-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> timeline on the core path
        build → connect → <code>run</code> → check → report, with an objection
        raised so run stays open.</p>
      <button type="button" class="btn btn-secondary" id="uph-starter">Load starter example</button>
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
        <div class="idea-card"><h3>build → connect</h3><p>Topology first: create components, then wire them.</p></div>
        <div class="idea-card"><h3>run</h3><p>Where time advances; objections keep the phase alive.</p></div>
        <div class="idea-card"><h3>check → report</h3><p>After run: decide pass/fail, then summarize.</p></div>
        <div class="idea-card"><h3>Direction</h3><p>Build often top-down; many later phases bottom-up.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="uph-controls">
        <div class="uph-field">
          <label for="sel-preset">Cursor preset</label>
          <select id="sel-preset">
            <option value="starter" selected>run + objection</option>
            <option value="at_build">at build</option>
            <option value="at_connect">at connect</option>
            <option value="at_check">at check</option>
            <option value="at_report">at report</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-step">Step phase</button>
        <button type="button" class="btn btn-ghost" id="btn-raise">Raise objection</button>
        <button type="button" class="btn btn-ghost" id="btn-drop">Drop objection</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo stuck run</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="uph-layout">
        <div class="panel-box">
          <h3>Phase timeline</h3>
          <p class="arrow-row">build → connect → … → run → … → check → report</p>
          <div class="phase-rail" id="phase-rail"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Current phase</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Order sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:16rem"></pre>
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

  function canLeaveRun() {
    return !(state.cursor === "run" && state.objection);
  }

  function orderSketch() {
    const cur = idxOf(state.cursor);
    return PHASES.map((p, i) => {
      const mark = i < cur ? "[done]" : i === cur ? "[HERE]" : "[    ]";
      const core = p.core ? "*" : " ";
      return `${mark}${core} ${p.title}  (${p.dir}, ${p.kind})`;
    }).join("\n") + `\n// * = core teaching path\n// objection=${state.objection ? 1 : 0}`;
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
  }

  function setCursor(id) {
    if (!(id in BY_ID)) return;
    if (state.cursor === "run" && state.objection && id !== "run") {
      pushLog("# blocked: drop objection before leaving run");
      state.lastAction = "blocked";
      renderAll();
      return;
    }
    state.cursor = id;
    state.lastAction = "cursor";
    pushLog(`# cursor ${id}`);
    pushTrace(`enter ${id}`);
    renderAll();
  }

  function stepPhase() {
    const i = idxOf(state.cursor);
    if (!canLeaveRun()) {
      pushLog("# stuck in run — drop objection first");
      state.lastAction = "blocked";
      renderAll();
      return;
    }
    const next = PHASES[Math.min(i + 1, PHASES.length - 1)];
    state.cursor = next.id;
    if (next.id !== "run") state.objection = false;
    state.lastAction = "step";
    pushLog(`# step → ${next.id}`);
    pushTrace(`step ${next.id}`);
    renderAll();
  }

  function raiseObj() {
    state.objection = true;
    if (state.cursor !== "run") state.cursor = "run";
    state.lastAction = "raise";
    pushLog("# raise_objection");
    pushTrace("objection=1 @run");
    renderAll();
  }

  function dropObj() {
    state.objection = false;
    state.lastAction = "drop";
    pushLog("# drop_objection");
    pushTrace("objection=0");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter run + objection");
    pushTrace("cursor=run objection=1");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.cursor = p.cursor;
    state.objection = p.objection;
    state.note = p.note;
    state.lastAction = "load";
    pushLog(`# load ${id}`);
    pushTrace(p.note);
    renderAll();
  }

  function demo() {
    state.preset = "starter";
    state.cursor = "run";
    state.objection = true;
    state.note = "Demo: stuck in run until objection drops.";
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo stuck run");
    pushTrace("try Step — blocked until Drop");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: build→connect (topology), run (time + objections), " +
        "check→report (cleanup). Core teaching path matches the catalog."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const cur = idxOf(state.cursor);
    const phase = BY_ID[state.cursor];
    const rail = document.getElementById("phase-rail");
    rail.innerHTML = "";
    PHASES.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = [
        "phase-chip",
        i === cur ? "is-cursor" : "",
        i < cur ? "is-done" : "",
        p.id === "run" ? "is-run" : "",
        p.core ? "is-core" : "",
      ]
        .filter(Boolean)
        .join(" ");
      b.innerHTML = `<span class="phase-name">${p.title}</span><span class="phase-meta">${p.dir}</span>`;
      b.addEventListener("click", () => setCursor(p.id));
      rail.appendChild(b);
    });

    document.getElementById("role-blurb").textContent = phase
      ? `${phase.title}: ${phase.blurb}`
      : "";
    document.getElementById("prop-code").textContent = orderSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const stuck = state.cursor === "run" && state.objection;
    const v = document.getElementById("verdict");
    if (stuck) {
      v.className = "verdict warn";
      v.textContent = `In run with objection raised — Drop objection (or finish work) before check/report.`;
    } else {
      v.className = "verdict yes";
      v.textContent = `${phase.title} (${phase.kind}, ${phase.dir}) · core=${phase.core ? "yes" : "no"}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">cursor=${state.cursor}</span>
      <span class="flag ${state.objection ? "is-on" : "is-ok"}">objection=${state.objection ? 1 : 0}</span>
      <span class="flag ${stuck ? "is-bad" : "is-ok"}">stuck=${stuck ? 1 : 0}</span>
      <span class="flag is-on">kind=${phase.kind}</span>
      <span class="flag is-on">dir=${phase.dir}</span>
      <span class="flag ${CORE_ORDER.includes(state.cursor) ? "is-ok" : ""}">core_path=${CORE_ORDER.includes(state.cursor) ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          cursor: state.cursor,
          objection: state.objection,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-order",
      title: "Quiz: order",
      type: "quiz",
      prompt: "The core teaching order is…",
      hint: "Catalog path.",
      choices: [
        "build → connect → run → check → report",
        "report → run → build → connect → check",
        "check → build → connect → run → report",
        "run → build → report only",
      ],
      answer: "build → connect → run → check → report",
    },
    {
      id: "quiz-build",
      title: "Quiz: build",
      type: "quiz",
      prompt: "build_phase is mainly for…",
      hint: "Construct.",
      choices: [
        "constructing components (often top-down)",
        "printing the final scoreboard only",
        "dropping all objections forever",
        "synthesizing the DUT netlist",
      ],
      answer: "constructing components (often top-down)",
    },
    {
      id: "quiz-run",
      title: "Quiz: run",
      type: "quiz",
      prompt: "Objections in run_phase…",
      hint: "Keep sim alive.",
      choices: [
        "keep the run phase (and sim time) open until dropped",
        "delete the env hierarchy",
        "skip connect_phase always",
        "force $finish immediately",
      ],
      answer: "keep the run phase (and sim time) open until dropped",
    },
    {
      id: "quiz-check",
      title: "Quiz: check",
      type: "quiz",
      prompt: "check_phase typically…",
      hint: "After run.",
      choices: [
        "decides pass/fail after run completes",
        "creates the test class",
        "is the only place to raise objections",
        "replaces the virtual interface",
      ],
      answer: "decides pass/fail after run completes",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — cursor=run, objection=1.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.cursor === "run" &&
        state.objection === true,
    },
    {
      id: "step-blocked",
      title: "Step blocked",
      prompt: "On starter, Step phase — stays stuck (blocked).",
      hint: "Step while objection up",
      setup: () => {
        loadStarter();
        stepPhase();
      },
      check: () =>
        state.cursor === "run" &&
        state.objection &&
        state.lastAction === "blocked",
    },
    {
      id: "drop",
      title: "Drop objection",
      prompt: "Drop objection on starter.",
      hint: "Drop objection",
      setup: () => {
        loadStarter();
        dropObj();
      },
      check: () => !state.objection && state.lastAction === "drop",
    },
    {
      id: "step-after",
      title: "Step after drop",
      prompt: "Drop, then Step once — leave run toward extract.",
      hint: "Drop → Step",
      setup: () => {
        loadStarter();
        dropObj();
        stepPhase();
      },
      check: () => state.cursor === "extract" && state.lastAction === "step",
    },
    {
      id: "raise",
      title: "Raise objection",
      prompt: "From build preset, Raise objection → jump to run.",
      hint: "Load at build → Raise",
      setup: () => {
        selPreset.value = "at_build";
        loadPreset();
        raiseObj();
      },
      check: () =>
        state.cursor === "run" &&
        state.objection &&
        state.lastAction === "raise",
    },
    {
      id: "load-build",
      title: "Load build",
      prompt: "Load at build preset.",
      hint: "at build → Load",
      setup: () => {
        selPreset.value = "at_build";
        loadPreset();
      },
      check: () => state.cursor === "build" && !state.objection,
    },
    {
      id: "load-connect",
      title: "Load connect",
      prompt: "Load at connect preset.",
      hint: "at connect → Load",
      setup: () => {
        selPreset.value = "at_connect";
        loadPreset();
      },
      check: () => state.cursor === "connect",
    },
    {
      id: "load-check",
      title: "Load check",
      prompt: "Load at check preset.",
      hint: "at check → Load",
      setup: () => {
        selPreset.value = "at_check";
        loadPreset();
      },
      check: () => state.cursor === "check",
    },
    {
      id: "load-report",
      title: "Load report",
      prompt: "Load at report preset.",
      hint: "at report → Load",
      setup: () => {
        selPreset.value = "at_report";
        loadPreset();
      },
      check: () => state.cursor === "report",
    },
    {
      id: "click-report",
      title: "Click report",
      prompt: "From check (no objection), click report chip.",
      hint: "Load check → click report",
      setup: () => {
        selPreset.value = "at_check";
        loadPreset();
        setCursor("report");
      },
      check: () => state.cursor === "report" && state.lastAction === "cursor",
    },
    {
      id: "demo",
      title: "Demo stuck",
      prompt: "Click Demo stuck run.",
      hint: "Demo stuck run",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.cursor === "run" &&
        state.objection &&
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
      id: "dir-build",
      title: "Build direction",
      prompt: "At build, direction flag is top-down.",
      hint: "Load at build",
      setup: () => {
        selPreset.value = "at_build";
        loadPreset();
      },
      check: () => BY_ID[state.cursor].dir === "top-down",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions raise_objection.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /raise_objection/.test(sourceSketch()),
    },
    {
      id: "core-path",
      title: "Core chips",
      prompt: "Starter cursor is on the core path.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => CORE_ORDER.includes(state.cursor),
    },
    {
      id: "order-sketch",
      title: "Order sketch",
      prompt: "Order sketch marks [HERE] on run for starter.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /\[HERE\].*run/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "kind-run",
      title: "Run kind",
      prompt: "run phase kind is runtime.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => BY_ID.run.kind === "runtime" && state.cursor === "run",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to run + objection.",
      hint: "Reset",
      setup: () => {
        dropObj();
        selPreset.value = "at_report";
        loadPreset();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.cursor === "run" && state.objection;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="uph-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("uph-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-step").addEventListener("click", () => stepPhase());
  document.getElementById("btn-raise").addEventListener("click", () => raiseObj());
  document.getElementById("btn-drop").addEventListener("click", () => dropObj());
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
      if (saved && saved.cursor) {
        state.cursor = saved.cursor;
        state.objection = !!saved.objection;
        state.preset = saved.preset || "starter";
        const p = PRESETS[state.preset];
        if (p) state.note = p.note;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
