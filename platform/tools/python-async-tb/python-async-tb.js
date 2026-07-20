(() => {
  /**
   * Python async TB sketch (concept)
   *   async def test + await timeline
   * Starter: async test + await Timer(10) → DONE
   */

  const IDEAS = {
    async: "async def marks a coroutine — it can suspend at await.",
    await: "await yields to the event loop until a trigger resumes the coro.",
    decorator: "@cocotb.test() registers the coroutine as a runnable TB entry.",
    sync: "A plain def cannot await — cocotb needs async def for time-advancing tests.",
  };

  const PRESETS = {
    starter: {
      label: "starter: async + Timer(10)",
      isAsync: true,
      decorated: true,
      awaits: ["Timer(10)"],
      note: "Decorated async test with one await — Run → DONE.",
      autoRun: true,
    },
    rising: {
      label: "async + RisingEdge",
      isAsync: true,
      decorated: true,
      awaits: ["RisingEdge(clk)"],
      note: "Same shape — await an edge instead of a timer.",
      autoRun: true,
    },
    two: {
      label: "two awaits",
      isAsync: true,
      decorated: true,
      awaits: ["Timer(5)", "RisingEdge(clk)"],
      note: "Coroutine suspends twice, then finishes.",
      autoRun: true,
    },
    sync_fail: {
      label: "plain def (no async)",
      isAsync: false,
      decorated: true,
      awaits: ["Timer(10)"],
      note: "def test cannot await — Run FAIL (not a coroutine).",
      autoRun: true,
    },
    no_deco: {
      label: "async but no @cocotb.test",
      isAsync: true,
      decorated: false,
      awaits: ["Timer(10)"],
      note: "Valid coroutine, but not registered as a cocotb test entry.",
      autoRun: true,
    },
    no_await: {
      label: "async with no await",
      isAsync: true,
      decorated: true,
      awaits: [],
      note: "Runs immediately to DONE — no suspension (still legal, just no time wait).",
      autoRun: true,
    },
    idle: {
      label: "idle",
      isAsync: true,
      decorated: true,
      awaits: ["Timer(10)"],
      note: "Idle — Load a preset or Run the coroutine.",
      autoRun: false,
    },
  };

  function sourceSketch() {
    return `# Python async TB literacy (not a live cocotb run)
# import cocotb
# from cocotb.triggers import Timer, RisingEdge
#
# @cocotb.test()
# async def test(dut):
#     await Timer(10, units="ns")   # suspend → resume
#     # … poke / peek dut …
#
# async def  → coroutine (can await)
# await      → yield until trigger fires (sim time can advance)
# @cocotb.test() → register entry for the runner
#
# Plain def + await  → SyntaxError / not a cocotb test coroutine.`;
  }

  function buildSteps(isAsync, decorated, awaits) {
    const steps = [];
    steps.push({
      id: "enter",
      label: decorated
        ? "@cocotb.test → enter test(dut)"
        : "enter test(dut) (no decorator)",
    });
    if (!isAsync) {
      steps.push({ id: "fail", label: "FAIL: not async — cannot await" });
      return steps;
    }
    if (!decorated) {
      steps.push({
        id: "warn",
        label: "WARN: coroutine not registered as @cocotb.test",
      });
    }
    awaits.forEach((a, i) => {
      steps.push({ id: `await-${i}`, label: `await ${a}  (suspend)` });
      steps.push({ id: `resume-${i}`, label: `resume after ${a}` });
    });
    steps.push({ id: "done", label: "DONE" });
    return steps;
  }

  function evaluate(isAsync, decorated, awaits) {
    const steps = buildSteps(isAsync, decorated, awaits);
    const ok = isAsync && decorated;
    const status = !isAsync
      ? "FAIL"
      : !decorated
        ? "WARN"
        : "DONE";
    return { steps, ok, status };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.isAsync, p.decorated, p.awaits);
    return {
      preset: "starter",
      isAsync: p.isAsync,
      decorated: p.decorated,
      awaits: [...p.awaits],
      note: p.note,
      selected: "async",
      steps: ev.steps,
      status: ev.status,
      ok: ev.ok,
      cursor: ev.steps.length - 1,
      lastRun: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`run: status=${ev.status} steps=${ev.steps.length}`],
    };
  }

  const CLEARED_KEY = "ddv-python-async-tb-cleared-v1";
  const STORE_KEY = "ddv-python-async-tb-session-v1";

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

  const root = document.getElementById("patb-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>@cocotb.test()</code> + <code>async def test</code> +
        <code>await Timer(10)</code> — Run reaches DONE.</p>
      <button type="button" class="btn btn-secondary" id="patb-starter">Load starter example</button>
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
        <div class="idea-card"><h3>async def</h3><p>Coroutine that can suspend at await.</p></div>
        <div class="idea-card"><h3>await</h3><p>Yield until a trigger resumes you.</p></div>
        <div class="idea-card"><h3>@cocotb.test</h3><p>Registers the TB entry for the runner.</p></div>
        <div class="idea-card"><h3>timeline</h3><p>enter → suspend → resume → DONE.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="patb-controls">
        <div class="patb-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>async + Timer(10)</option>
            <option value="rising">async + RisingEdge</option>
            <option value="two">two awaits</option>
            <option value="sync_fail">plain def</option>
            <option value="no_deco">no decorator</option>
            <option value="no_await">no await</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-run">Run</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo plain def</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="patb-layout">
        <div class="panel-box">
          <h3>Coroutine timeline</h3>
          <ul class="step-list" id="step-list"></ul>
          <h3>Ideas</h3>
          <div class="idea-row" id="idea-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Run sketch</h3>
          <pre class="run-box" id="run-box"></pre>
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

  function codeForState() {
    const awaits = state.awaits.length
      ? state.awaits.map((a) => `    await ${a}`).join("\n")
      : "    # (no await)";
    const deco = state.decorated ? "@cocotb.test()\n" : "";
    const kw = state.isAsync ? "async def" : "def";
    return `${deco}${kw} test(dut):\n${awaits}`;
  }

  function runSketch() {
    return `# ${codeForState().split("\n").join("\n# ")}
#
# status: ${state.lastRun ? state.status : "— (Run)"}
# ok:     ${state.lastRun ? (state.ok ? "yes" : "no") : "—"}
# cursor: ${state.lastRun ? state.cursor : "—"} / ${Math.max(0, state.steps.length - 1)}`;
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

  function applyEval(toEnd) {
    const ev = evaluate(state.isAsync, state.decorated, state.awaits);
    state.steps = ev.steps;
    state.status = ev.status;
    state.ok = ev.ok;
    state.cursor = toEnd ? ev.steps.length - 1 : 0;
    state.lastRun = true;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter async + Timer(10)");
    renderAll();
  }

  function runAll(silent) {
    applyEval(true);
    pushTrace(`run: status=${state.status} steps=${state.steps.length}`);
    if (!silent) {
      state.lastAction = state.ok ? "run-ok" : "run-bad";
      pushLog(`# run ${state.status}`);
      renderAll();
    }
  }

  function stepOnce() {
    if (!state.lastRun) {
      applyEval(false);
      state.lastAction = "step";
      pushTrace(`step: cursor=0 ${state.steps[0]?.label || ""}`);
      pushLog("# step start");
      renderAll();
      return;
    }
    if (state.cursor >= state.steps.length - 1) {
      state.lastAction = "step-end";
      pushLog("# step at end");
      renderAll();
      return;
    }
    state.cursor += 1;
    state.lastAction = "step";
    pushTrace(`step: cursor=${state.cursor} ${state.steps[state.cursor]?.label || ""}`);
    pushLog(`# step ${state.cursor}`);
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.isAsync = p.isAsync;
    state.decorated = p.decorated;
    state.awaits = [...p.awaits];
    state.note = p.note;
    state.steps = [];
    state.status = "—";
    state.ok = false;
    state.cursor = 0;
    state.lastRun = false;
    syncInputs();
    if (p.autoRun) {
      runAll(true);
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
    applyPreset("sync_fail", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo plain def FAIL");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: async def + await form the TB timeline; " +
        "@cocotb.test registers the entry; plain def cannot await."
    );
    renderAll();
  }

  function selectIdea(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    document.getElementById("step-list").innerHTML = state.steps.length
      ? state.steps
          .map((s, i) => {
            const done = state.lastRun && i <= state.cursor;
            const cur = state.lastRun && i === state.cursor;
            return `<li class="${cur ? "is-cur" : ""} ${done ? "is-done" : ""}">
              <span class="id">${i}. ${s.label}</span>
              <span class="tag">${cur ? "◀" : done ? "✓" : "·"}</span>
            </li>`;
          })
          .join("")
      : `<li><span class="id">(Run to build timeline)</span><span class="tag">—</span></li>`;

    document.getElementById("idea-row").innerHTML = Object.entries(IDEAS)
      .map(
        ([id]) => `
      <button type="button" class="idea-btn ${state.selected === id ? "is-sel" : ""}" data-idea="${id}">
        <div class="k">${id}</div>
        <div class="v">${id === "async" ? "async def" : id === "decorator" ? "@test" : id}</div>
      </button>`
      )
      .join("");
    document.querySelectorAll("[data-idea]").forEach((el) => {
      el.addEventListener("click", () =>
        selectIdea(/** @type {string} */ (el.getAttribute("data-idea")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      IDEAS[state.selected] || IDEAS.async;
    document.getElementById("run-box").textContent = runSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastRun) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Run";
    } else if (state.ok) {
      v.className = "verdict yes";
      v.textContent = `Run ${state.status} — async test registered`;
    } else if (state.status === "WARN") {
      v.className = "verdict no";
      v.textContent = "WARN — coroutine not registered (@cocotb.test missing)";
    } else {
      v.className = "verdict no";
      v.textContent = "FAIL — need async def for awaitable TB";
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.isAsync ? "is-ok" : "is-bad"}">async=${state.isAsync ? 1 : 0}</span>
      <span class="flag ${state.decorated ? "is-ok" : "is-bad"}">deco=${state.decorated ? 1 : 0}</span>
      <span class="flag is-ok">awaits=${state.awaits.length}</span>
      <span class="flag ${state.ok && state.lastRun ? "is-ok" : state.lastRun ? "is-bad" : ""}">ok=${state.lastRun ? (state.ok ? 1 : 0) : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          isAsync: state.isAsync,
          decorated: state.decorated,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-async",
      title: "Quiz: async def",
      type: "quiz",
      prompt: "async def in a cocotb test means…",
      hint: "Coroutine.",
      choices: [
        "the function is a coroutine that can suspend at await",
        "the DUT is synthesized automatically",
        "plusargs are disabled",
        "only Makefile PHONY targets run",
      ],
      answer: "the function is a coroutine that can suspend at await",
    },
    {
      id: "quiz-await",
      title: "Quiz: await",
      type: "quiz",
      prompt: "await in a TB coroutine…",
      hint: "Suspend.",
      choices: [
        "suspends until a trigger resumes the coroutine (sim time may advance)",
        "compiles SystemVerilog",
        "deletes the scoreboard",
        "sets UVM_TESTNAME",
      ],
      answer:
        "suspends until a trigger resumes the coroutine (sim time may advance)",
    },
    {
      id: "quiz-deco",
      title: "Quiz: decorator",
      type: "quiz",
      prompt: "@cocotb.test() primarily…",
      hint: "Register.",
      choices: [
        "registers the coroutine as a runnable test entry",
        "replaces RisingEdge forever",
        "writes the VCD dump",
        "turns off async",
      ],
      answer: "registers the coroutine as a runnable test entry",
    },
    {
      id: "quiz-sync",
      title: "Quiz: plain def",
      type: "quiz",
      prompt: "A plain def test that tries to await…",
      hint: "Not a coro.",
      choices: [
        "is not a valid awaitable cocotb test coroutine",
        "always runs faster than async def",
        "is required by pyuvm",
        "disables the event loop on purpose",
      ],
      answer: "is not a valid awaitable cocotb test coroutine",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — Run DONE / ok.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ok &&
        state.status === "DONE",
    },
    {
      id: "load-rising",
      title: "Load RisingEdge",
      prompt: "Load async + RisingEdge.",
      hint: "RisingEdge → Load",
      setup: () => {
        selPreset.value = "rising";
        loadPreset();
      },
      check: () =>
        state.awaits[0] === "RisingEdge(clk)" &&
        state.ok &&
        state.lastAction === "load",
    },
    {
      id: "load-two",
      title: "Load two awaits",
      prompt: "Load two awaits — awaits.length=2.",
      hint: "two awaits → Load",
      setup: () => {
        selPreset.value = "two";
        loadPreset();
      },
      check: () => state.awaits.length === 2 && state.ok,
    },
    {
      id: "load-sync",
      title: "Load plain def",
      prompt: "Load plain def — FAIL / not ok.",
      hint: "plain def → Load",
      setup: () => {
        selPreset.value = "sync_fail";
        loadPreset();
      },
      check: () => !state.ok && state.status === "FAIL",
    },
    {
      id: "load-nodeco",
      title: "Load no decorator",
      prompt: "Load no decorator — WARN.",
      hint: "no decorator → Load",
      setup: () => {
        selPreset.value = "no_deco";
        loadPreset();
      },
      check: () => state.status === "WARN" && !state.ok,
    },
    {
      id: "load-noawait",
      title: "Load no await",
      prompt: "Load no await — still DONE/ok.",
      hint: "no await → Load",
      setup: () => {
        selPreset.value = "no_await";
        loadPreset();
      },
      check: () =>
        state.awaits.length === 0 && state.ok && state.status === "DONE",
    },
    {
      id: "run-ok",
      title: "Run OK",
      prompt: "From idle, Run — DONE.",
      hint: "idle → Run",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        runAll(false);
      },
      check: () =>
        state.ok &&
        state.lastAction === "run-ok" &&
        state.status === "DONE",
    },
    {
      id: "run-bad",
      title: "Run FAIL",
      prompt: "On plain def, Run — FAIL.",
      hint: "plain def → Run",
      setup: () => {
        selPreset.value = "sync_fail";
        applyPreset("sync_fail", null);
        state.lastRun = false;
        runAll(false);
      },
      check: () =>
        !state.ok && state.lastAction === "run-bad",
    },
    {
      id: "step",
      title: "Step",
      prompt: "From idle, Step at least once.",
      hint: "idle → Step",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        stepOnce();
      },
      check: () =>
        state.lastAction === "step" && state.lastRun,
    },
    {
      id: "demo",
      title: "Demo plain def",
      prompt: "Click Demo plain def.",
      hint: "Demo plain def",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.ok &&
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
      id: "select-await",
      title: "Select await",
      prompt: "Click the await idea card.",
      hint: "Click await",
      setup: () => {
        loadStarter();
        selectIdea("await");
      },
      check: () =>
        state.selected === "await" && state.lastAction === "select",
    },
    {
      id: "select-deco",
      title: "Select decorator",
      prompt: "Click the decorator idea card.",
      hint: "Click decorator",
      setup: () => {
        loadStarter();
        selectIdea("decorator");
      },
      check: () =>
        state.selected === "decorator" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions @cocotb.test or await.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /@cocotb\.test|await/.test(sourceSketch()),
    },
    {
      id: "run-sketch",
      title: "Run sketch",
      prompt: "On starter, run sketch shows async def.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /async def/.test(document.getElementById("run-box").textContent),
    },
    {
      id: "timeline-done",
      title: "Timeline DONE",
      prompt: "Starter last step label is DONE.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.steps[state.steps.length - 1]?.id === "done",
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet run.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastRun && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From sync_fail, Reset — DONE again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "sync_fail";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.ok &&
        state.status === "DONE",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="patb-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("patb-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-run").addEventListener("click", () => runAll(false));
  document.getElementById("btn-step").addEventListener("click", () => stepOnce());
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
      if (saved && typeof saved.isAsync === "boolean") {
        state.isAsync = saved.isAsync;
        state.decorated = !!saved.decorated;
        state.preset = saved.preset || "starter";
        state.lastRun = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
