(() => {
  /**
   * Coverage closure planner (concept)
   *   hole → next test idea
   * Starter: hole mid + idea "directed mid samples" — READY
   */

  const HOLES = [
    { id: "mid", label: "cp_data.mid", blurb: "Nibble mid bin still open." },
    { id: "err", label: "cp_op.err", blurb: "Error opcode bin never hit." },
    { id: "full", label: "cp_fifo.full", blurb: "FIFO full corner uncovered." },
  ];

  const IDEAS = [
    {
      id: "dir_mid",
      label: "directed mid samples",
      hole: "mid",
      blurb: "Force data into mid range with a short directed test.",
    },
    {
      id: "inj_err",
      label: "inject err opcode",
      hole: "err",
      blurb: "Drive illegal/err op once and sample coverage.",
    },
    {
      id: "fill_fifo",
      label: "fill FIFO to full",
      hole: "full",
      blurb: "Push until full flag asserts; sample the corner.",
    },
    {
      id: "more_rand",
      label: "longer random seed",
      hole: null,
      blurb: "Generic more-random — weak if hole needs a directed hit.",
    },
  ];

  const PRESETS = {
    starter: {
      label: "starter: mid → directed",
      holeId: "mid",
      ideaId: "dir_mid",
      closed: {},
      note: "Hole mid paired with a matching next-test idea — READY.",
      autoPlan: true,
    },
    err: {
      label: "err → inject",
      holeId: "err",
      ideaId: "inj_err",
      closed: { mid: true },
      note: "err hole with matching inject idea — READY.",
      autoPlan: true,
    },
    mismatch: {
      label: "mid hole + wrong idea",
      holeId: "mid",
      ideaId: "inj_err",
      closed: {},
      note: "Idea targets err, not mid — plan mismatch (not READY).",
      autoPlan: true,
    },
    orphan: {
      label: "hole without idea",
      holeId: "full",
      ideaId: null,
      closed: {},
      note: "Hole selected but no next-test idea — not READY.",
      autoPlan: true,
    },
    closed: {
      label: "all holes closed",
      holeId: null,
      ideaId: null,
      closed: { mid: true, err: true, full: true },
      note: "No open holes — closure sketch DONE.",
      autoPlan: true,
    },
    idle: {
      label: "idle",
      holeId: null,
      ideaId: null,
      closed: {},
      note: "Idle — pick a hole and idea, then Plan next test.",
      autoPlan: false,
    },
  };

  function sourceSketch() {
    return `// Coverage closure planner literacy (document aid)
//
// 1. List holes (unhit bins / missing scenarios)
// 2. Pick one hole
// 3. Attach a next-test idea that targets that hole
// 4. Run / triage → mark hole closed when evidence exists
//
// READY  = open hole + matching idea
// DONE   = no open holes
// Weak:  "more random" without targeting the hole
//
// Pair with cover-bins (holes) and feature-matrix (gaps).`;
  }

  function openHoles(closed) {
    return HOLES.filter((h) => !closed[h.id]);
  }

  function evaluate(holeId, ideaId, closed) {
    const open = openHoles(closed);
    if (open.length === 0) {
      return { status: "DONE", ready: true, reason: "no open holes" };
    }
    if (!holeId) {
      return { status: "IDLE", ready: false, reason: "pick a hole" };
    }
    if (closed[holeId]) {
      return { status: "IDLE", ready: false, reason: "hole already closed" };
    }
    if (!ideaId) {
      return { status: "NEED_IDEA", ready: false, reason: "attach a next-test idea" };
    }
    const idea = IDEAS.find((i) => i.id === ideaId);
    if (!idea) {
      return { status: "NEED_IDEA", ready: false, reason: "unknown idea" };
    }
    if (idea.hole && idea.hole !== holeId) {
      return {
        status: "MISMATCH",
        ready: false,
        reason: `idea targets ${idea.hole}, not ${holeId}`,
      };
    }
    if (!idea.hole) {
      return {
        status: "WEAK",
        ready: false,
        reason: "generic idea — prefer a hole-targeted test",
      };
    }
    return { status: "READY", ready: true, reason: "hole + matching idea" };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.holeId, p.ideaId, p.closed);
    return {
      preset: "starter",
      holeId: p.holeId,
      ideaId: p.ideaId,
      closed: { ...p.closed },
      note: p.note,
      selected: "hole",
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastPlanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`plan: READY mid ← directed mid samples`],
    };
  }

  const CLEARED_KEY = "ddv-coverage-closure-cleared-v1";
  const STORE_KEY = "ddv-coverage-closure-session-v1";

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

  const root = document.getElementById("ccl-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        hole <code>mid</code> → idea <code>directed mid samples</code> —
        next-test plan READY.</p>
      <button type="button" class="btn btn-secondary" id="ccl-starter">Load starter example</button>
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
        <div class="idea-card"><h3>hole</h3><p>Unhit bin / missing scenario to close.</p></div>
        <div class="idea-card"><h3>next idea</h3><p>Concrete test that targets the hole.</p></div>
        <div class="idea-card"><h3>READY</h3><p>Hole + matching idea — actionable plan.</p></div>
        <div class="idea-card"><h3>closed</h3><p>Evidence landed — mark the hole done.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ccl-controls">
        <div class="ccl-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>mid → directed</option>
            <option value="err">err → inject</option>
            <option value="mismatch">mismatch</option>
            <option value="orphan">hole only</option>
            <option value="closed">all closed</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-plan">Plan next test</button>
        <button type="button" class="btn btn-ghost" id="btn-close">Mark hole closed</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ccl-layout">
        <div class="panel-box">
          <h3>Closure chain</h3>
          <div class="chain" id="chain-box"></div>
          <h3>Holes</h3>
          <ul class="hole-list" id="hole-list"></ul>
          <h3>Next-test ideas</h3>
          <div class="pick-row" id="idea-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Plan sketch</h3>
          <pre class="plan-box" id="plan-box"></pre>
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

  function planSketch() {
    const hole = HOLES.find((h) => h.id === state.holeId);
    const idea = IDEAS.find((i) => i.id === state.ideaId);
    return `# hole:  ${hole ? hole.label : "—"}
# idea:  ${idea ? idea.label : "—"}
# open:  ${openHoles(state.closed)
      .map((h) => h.id)
      .join(", ") || "(none)"}
#
# status: ${state.lastPlanned ? state.status : "— (Plan next test)"}
# reason: ${state.lastPlanned ? state.reason : "—"}`;
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
    pushLog("# starter mid → directed READY");
    renderAll();
  }

  function runPlan(silent) {
    const ev = evaluate(state.holeId, state.ideaId, state.closed);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastPlanned = true;
    const hole = HOLES.find((h) => h.id === state.holeId);
    const idea = IDEAS.find((i) => i.id === state.ideaId);
    pushTrace(
      `plan: ${ev.status} ${hole ? hole.id : "—"} ← ${idea ? idea.id : "—"}`
    );
    if (!silent) {
      state.lastAction = ev.ready ? "plan-ok" : "plan-bad";
      pushLog(`# plan ${ev.status}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.holeId = p.holeId;
    state.ideaId = p.ideaId;
    state.closed = { ...p.closed };
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.lastPlanned = false;
    syncInputs();
    if (p.autoPlan) {
      runPlan(true);
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

  function markClosed() {
    if (!state.holeId || state.closed[state.holeId]) {
      state.lastAction = "close-bad";
      pushLog("# close FAIL");
      renderAll();
      return;
    }
    state.closed[state.holeId] = true;
    state.lastAction = "close";
    pushTrace(`close: ${state.holeId}`);
    pushLog(`# closed ${state.holeId}`);
    runPlan(true);
    state.lastAction = "close";
    renderAll();
  }

  function demo() {
    applyPreset("mismatch", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo mismatch");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: pick a hole, attach a matching next-test idea, " +
        "then mark closed when evidence lands."
    );
    renderAll();
  }

  function selectHole(id) {
    state.holeId = id;
    state.selected = "hole";
    state.lastPlanned = false;
    state.lastAction = "select-hole";
    renderAll();
  }

  function selectIdea(id) {
    if (state.ideaId === id && state.selected === "idea") {
      state.ideaId = null;
      state.lastAction = "clear-idea";
    } else {
      state.ideaId = id;
      state.selected = "idea";
      state.lastAction = "select-idea";
    }
    state.lastPlanned = false;
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const hole = HOLES.find((h) => h.id === state.holeId);
    const idea = IDEAS.find((i) => i.id === state.ideaId);
    document.getElementById("chain-box").innerHTML = `${
      hole ? hole.label : '<span class="gap">?hole</span>'
    } → ${idea ? idea.label : '<span class="gap">?idea</span>'}`;

    document.getElementById("hole-list").innerHTML = HOLES.map((h) => {
      const closed = !!state.closed[h.id];
      const sel = state.holeId === h.id;
      return `<li class="${sel ? "is-sel" : ""}" data-hole="${h.id}">
        <span class="id">${h.label}</span>
        <span class="tag ${closed ? "closed" : "open"}">${closed ? "CLOSED" : "OPEN"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-hole]").forEach((el) => {
      el.addEventListener("click", () =>
        selectHole(/** @type {string} */ (el.getAttribute("data-hole")))
      );
    });

    document.getElementById("idea-row").innerHTML = IDEAS.map((i) => {
      const on = state.ideaId === i.id;
      return `<button type="button" class="pick-card ${on ? "is-on is-sel" : "is-off"}" data-idea="${i.id}">
        <div class="k">${i.hole ? `→ ${i.hole}` : "generic"}</div>
        <div class="v">${i.label}</div>
      </button>`;
    }).join("");
    document.querySelectorAll("[data-idea]").forEach((el) => {
      el.addEventListener("click", () =>
        selectIdea(/** @type {string} */ (el.getAttribute("data-idea")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Pick a hole, then a next-test idea.";
    if (state.selected === "hole" && hole) blurb = hole.blurb;
    else if (state.selected === "idea" && idea) blurb = idea.blurb;
    document.getElementById("role-blurb").textContent = blurb;
    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastPlanned) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Plan next test";
    } else if (state.status === "DONE") {
      v.className = "verdict yes";
      v.textContent = "Closure DONE — no open holes";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `Plan READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    const openN = openHoles(state.closed).length;
    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastPlanned ? "is-ok" : state.lastPlanned ? "is-bad" : ""}">ready=${state.lastPlanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${openN ? "is-bad" : "is-ok"}">open=${openN}</span>
      <span class="flag is-ok">hole=${state.holeId || "—"}</span>
      <span class="flag is-ok">idea=${state.ideaId || "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          holeId: state.holeId,
          ideaId: state.ideaId,
          closed: state.closed,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-hole",
      title: "Quiz: hole",
      type: "quiz",
      prompt: "A coverage hole is…",
      hint: "Unhit.",
      choices: [
        "an unhit bin / missing scenario still open to close",
        "a Makefile PHONY target",
        "a always-pass assertion",
        "the DUT top module name",
      ],
      answer: "an unhit bin / missing scenario still open to close",
    },
    {
      id: "quiz-idea",
      title: "Quiz: idea",
      type: "quiz",
      prompt: "A next-test idea should…",
      hint: "Target.",
      choices: [
        "target the selected hole with a concrete stimulus plan",
        "delete the covergroup",
        "replace synthesis",
        "always be more random only",
      ],
      answer: "target the selected hole with a concrete stimulus plan",
    },
    {
      id: "quiz-ready",
      title: "Quiz: READY",
      type: "quiz",
      prompt: "Plan READY means…",
      hint: "Match.",
      choices: [
        "an open hole is paired with a matching next-test idea",
        "all plusargs are set",
        "the VCD is open",
        "coverage is ignored",
      ],
      answer: "an open hole is paired with a matching next-test idea",
    },
    {
      id: "quiz-mismatch",
      title: "Quiz: mismatch",
      type: "quiz",
      prompt: "An idea that targets a different hole is…",
      hint: "Wrong pair.",
      choices: [
        "a mismatch — not an actionable plan for the selected hole",
        "always READY",
        "a closed hole",
        "a sign-off stamp",
      ],
      answer: "a mismatch — not an actionable plan for the selected hole",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — READY.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "READY",
    },
    {
      id: "load-err",
      title: "Load err",
      prompt: "Load err → inject — READY.",
      hint: "err → inject → Load",
      setup: () => {
        selPreset.value = "err";
        loadPreset();
      },
      check: () =>
        state.holeId === "err" &&
        state.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load mismatch — MISMATCH / not ready.",
      hint: "mismatch → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.status === "MISMATCH" && !state.ready,
    },
    {
      id: "load-orphan",
      title: "Load orphan",
      prompt: "Load hole only — NEED_IDEA.",
      hint: "hole only → Load",
      setup: () => {
        selPreset.value = "orphan";
        loadPreset();
      },
      check: () =>
        state.status === "NEED_IDEA" && !state.ideaId,
    },
    {
      id: "load-closed",
      title: "Load all closed",
      prompt: "Load all closed — DONE.",
      hint: "all closed → Load",
      setup: () => {
        selPreset.value = "closed";
        loadPreset();
      },
      check: () => state.status === "DONE" && state.ready,
    },
    {
      id: "plan-ok",
      title: "Plan READY",
      prompt: "From idle, pick mid + dir_mid, Plan — READY.",
      hint: "idle → mid → directed → Plan",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        state.holeId = "mid";
        state.ideaId = "dir_mid";
        runPlan(false);
      },
      check: () =>
        state.ready &&
        state.lastAction === "plan-ok" &&
        state.status === "READY",
    },
    {
      id: "plan-bad",
      title: "Plan weak",
      prompt: "From idle, mid + more_rand, Plan — WEAK.",
      hint: "idle → mid → longer random → Plan",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        state.holeId = "mid";
        state.ideaId = "more_rand";
        runPlan(false);
      },
      check: () =>
        state.status === "WEAK" && state.lastAction === "plan-bad",
    },
    {
      id: "close",
      title: "Mark closed",
      prompt: "On starter, Mark hole closed.",
      hint: "Mark hole closed",
      setup: () => {
        loadStarter();
        markClosed();
      },
      check: () =>
        state.closed.mid === true && state.lastAction === "close",
    },
    {
      id: "select-hole",
      title: "Select hole",
      prompt: "Click the err hole row.",
      hint: "Click cp_op.err",
      setup: () => {
        loadStarter();
        selectHole("err");
      },
      check: () =>
        state.holeId === "err" && state.lastAction === "select-hole",
    },
    {
      id: "select-idea",
      title: "Select idea",
      prompt: "Click fill FIFO idea.",
      hint: "Click fill FIFO to full",
      setup: () => {
        loadStarter();
        selectIdea("fill_fifo");
      },
      check: () =>
        state.ideaId === "fill_fifo" &&
        state.lastAction === "select-idea",
    },
    {
      id: "demo",
      title: "Demo mismatch",
      prompt: "Click Demo mismatch.",
      hint: "Demo mismatch",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "MISMATCH" &&
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
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions READY or hole.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /READY|hole/i.test(sourceSketch()),
    },
    {
      id: "plan-sketch",
      title: "Plan sketch",
      prompt: "On starter, plan sketch shows READY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /READY/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "open-count",
      title: "Open count",
      prompt: "Starter has 3 open holes before close.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => openHoles(state.closed).length === 3,
    },
    {
      id: "match-mid",
      title: "Match mid",
      prompt: "Starter idea.hole is mid.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        IDEAS.find((i) => i.id === state.ideaId)?.hole === "mid",
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet planned.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastPlanned && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From closed, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "closed";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "READY",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ccl-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ccl-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-plan").addEventListener("click", () => runPlan(false));
  document.getElementById("btn-close").addEventListener("click", () => markClosed());
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
      if (saved) {
        state.holeId = saved.holeId || null;
        state.ideaId = saved.ideaId || null;
        state.closed = saved.closed || {};
        state.preset = saved.preset || "starter";
        state.lastPlanned = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
