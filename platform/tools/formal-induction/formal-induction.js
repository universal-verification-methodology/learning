(() => {
  /**
   * Formal induction (concept)
   *   baseOk + stepOk · PROVED only when both true
   *   Verdicts: PROVED | BASE_FAIL | STEP_FAIL | BOTH_FAIL
   * Starter: base holds, step holds → PROVED
   */

  const LADDER_DEPTH = 4;

  const PRESETS = {
    starter: {
      label: "starter: PROVED",
      baseOk: true,
      stepOk: true,
      note: "P(0) holds and P(k)→P(k+1) holds → sketch PROVED.",
      autoEval: true,
    },
    break_step: {
      label: "break step",
      baseOk: true,
      stepOk: false,
      note: "Base ok but inductive step fails → STEP_FAIL.",
      autoEval: true,
    },
    break_base: {
      label: "break base",
      baseOk: false,
      stepOk: true,
      note: "Step ok but base missing → BASE_FAIL.",
      autoEval: true,
    },
    both_off: {
      label: "both off",
      baseOk: false,
      stepOk: false,
      note: "Neither base nor step — BOTH_FAIL.",
      autoEval: true,
    },
    step_only: {
      label: "step only (invalid)",
      baseOk: false,
      stepOk: true,
      note: "Induction needs base — step alone → BASE_FAIL.",
      autoEval: true,
    },
    base_only: {
      label: "base only (invalid)",
      baseOk: true,
      stepOk: false,
      note: "Base without step cannot prove unbounded P(n) → STEP_FAIL.",
      autoEval: true,
    },
    restored: {
      label: "restored PROVED",
      baseOk: true,
      stepOk: true,
      note: "Both toggles on again — full induction sketch.",
      autoEval: true,
    },
    idle: {
      label: "idle (toggle then Evaluate)",
      baseOk: true,
      stepOk: true,
      note: "Toggle base/step checkboxes, then Evaluate.",
      autoEval: false,
    },
  };

  function sourceSketch() {
    return `# Induction literacy (not full k-induction engine)
# Prove property P for all time:
#   BASE:  P(0) holds at reset/start
#   STEP:  forall k, P(k) -> P(k+1)
# Both required → PROVED sketch
#
# Verdict table (this lab):
#   base=1 step=1 → PROVED
#   base=0 step=0 → BOTH_FAIL
#   base=0 step=1 → BASE_FAIL
#   base=1 step=0 → STEP_FAIL
#
# sby -mode prove uses invariants + induction internally
# Failed step often needs stronger auxiliary invariant`;
  }

  /**
   * @param {boolean} baseOk
   * @param {boolean} stepOk
   */
  function evaluate(baseOk, stepOk) {
    const b = !!baseOk;
    const s = !!stepOk;
    if (b && s) {
      return {
        baseOk: b,
        stepOk: s,
        verdict: "PROVED",
        message: "Base holds and inductive step holds → PROVED (sketch)",
      };
    }
    if (!b && !s) {
      return {
        baseOk: b,
        stepOk: s,
        verdict: "BOTH_FAIL",
        message: "Neither base nor inductive step holds → BOTH_FAIL",
      };
    }
    if (!b && s) {
      return {
        baseOk: b,
        stepOk: s,
        verdict: "BASE_FAIL",
        message: "Base missing but step ok → BASE_FAIL (cannot anchor induction)",
      };
    }
    return {
      baseOk: b,
      stepOk: s,
      verdict: "STEP_FAIL",
      message: "Base ok but inductive step fails → STEP_FAIL",
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const r = evaluate(p.baseOk, p.stepOk);
    return {
      preset: "starter",
      baseOk: r.baseOk,
      stepOk: r.stepOk,
      verdict: r.verdict,
      message: r.message,
      note: p.note,
      evaluated: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`eval ${r.verdict} base=1 step=1`],
    };
  }

  const CLEARED_KEY = "ddv-formal-induction-cleared-v1";
  const STORE_KEY = "ddv-formal-induction-session-v1";

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

  const root = document.getElementById("finduct-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>base</strong> holds and <strong>step</strong> holds
        → sketch verdict <strong>PROVED</strong>.</p>
      <button type="button" class="btn btn-secondary" id="find-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Base</h3><p>Show the property holds at the start (P(0)).</p></div>
        <div class="idea-card"><h3>Step</h3><p>Show P(k) implies P(k+1) for all k.</p></div>
        <div class="idea-card"><h3>Both required</h3><p>Induction needs base and step — not just BMC depth.</p></div>
        <div class="idea-card"><h3>Verdicts</h3><p>PROVED, BASE_FAIL, STEP_FAIL, or BOTH_FAIL.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="find-controls">
        <div class="find-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>starter PROVED</option>
            <option value="break_step">break step</option>
            <option value="break_base">break base</option>
            <option value="both_off">both off</option>
            <option value="step_only">step only</option>
            <option value="base_only">base only</option>
            <option value="restored">restored PROVED</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <label class="find-check"><input id="chk-base" type="checkbox" checked> BASE P(0)</label>
        <label class="find-check"><input id="chk-step" type="checkbox" checked> STEP P(k)→P(k+1)</label>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-eval">Evaluate</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo STEP_FAIL</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict yes">PROVED</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="find-visual">
        <div class="panel-box">
          <h3>Proof cards</h3>
          <div class="card-grid" id="proof-cards"></div>
        </div>
        <div class="panel-box">
          <h3>Induction ladder</h3>
          <div class="ladder" id="ladder"></div>
        </div>
      </div>
      <div class="find-layout">
        <div class="panel-box">
          <h3>Proof sketch</h3>
          <pre class="proof-box" id="proof-box"></pre>
        </div>
        <div class="panel-box">
          <h3>Evaluate detail</h3>
          <div id="result-box" class="result-box"></div>
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
  const chkBase = /** @type {HTMLInputElement} */ (document.getElementById("chk-base"));
  const chkStep = /** @type {HTMLInputElement} */ (document.getElementById("chk-step"));

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
    if (document.activeElement !== chkBase) chkBase.checked = !!state.baseOk;
    if (document.activeElement !== chkStep) chkStep.checked = !!state.stepOk;
  }

  function readInputs() {
    state.baseOk = chkBase.checked;
    state.stepOk = chkStep.checked;
  }

  function applyResult(r) {
    state.baseOk = r.baseOk;
    state.stepOk = r.stepOk;
    state.verdict = r.verdict;
    state.message = r.message;
    state.evaluated = true;
  }

  function doEval() {
    readInputs();
    const r = evaluate(state.baseOk, state.stepOk);
    applyResult(r);
    state.lastAction = "eval";
    pushTrace(`eval ${r.verdict} base=${r.baseOk ? 1 : 0} step=${r.stepOk ? 1 : 0}`);
    pushLog(`# evaluate → ${r.verdict}`);
    renderAll();
  }

  function tryRestoreSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      const id = saved.preset in PRESETS ? saved.preset : "starter";
      const p = PRESETS[id];
      state.preset = id;
      state.baseOk = typeof saved.baseOk === "boolean" ? saved.baseOk : p.baseOk;
      state.stepOk = typeof saved.stepOk === "boolean" ? saved.stepOk : p.stepOk;
      state.note = p.note;
      const r = evaluate(state.baseOk, state.stepOk);
      state.verdict = r.verdict;
      state.message = r.message;
      state.evaluated = !!saved.evaluated;
      state.lastAction = "restore";
      pushLog(`# restore ${id}`);
      pushTrace(`restore ${r.verdict}`);
      return true;
    } catch {
      return false;
    }
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter PROVED");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value in PRESETS ? selPreset.value : "starter";
    const p = PRESETS[id];
    state.preset = id;
    state.baseOk = p.baseOk;
    state.stepOk = p.stepOk;
    state.note = p.note;
    syncInputs();
    state.lastAction = "load";
    if (p.autoEval) doEval();
    else {
      state.evaluated = false;
      pushLog(`# load ${id}`);
      renderAll();
    }
  }

  function demo() {
    selPreset.value = "break_step";
    const p = PRESETS.break_step;
    state.preset = "break_step";
    state.baseOk = p.baseOk;
    state.stepOk = p.stepOk;
    state.note = p.note;
    state.demoed = true;
    syncInputs();
    doEval();
    state.lastAction = "demo";
    pushLog("# demo STEP_FAIL");
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Induction = base P(0) + step P(k)→P(k+1). PROVED only when both hold. BMC alone is bounded."
    );
    pushLog("# explain");
    renderAll();
  }

  function verdictClass(verdict) {
    if (verdict === "PROVED") return "yes";
    if (verdict === "STEP_FAIL" || verdict === "BASE_FAIL" || verdict === "BOTH_FAIL") return "no";
    return "idle";
  }

  function proofText() {
    return `BASE CASE:  P(0) = ${state.baseOk ? "holds ✓" : "FAIL ✗"}
IND STEP:   P(k)→P(k+1) = ${state.stepOk ? "holds ✓" : "FAIL ✗"}
────────────────────────────
VERDICT:    ${state.evaluated ? state.verdict : "—"}
${state.evaluated ? state.message : "Evaluate to run induction sketch."}`;
  }

  function resultDetailText() {
    if (!state.evaluated) return "Toggle base/step, then Evaluate.";
    const rows = [
      `baseOk=${state.baseOk ? 1 : 0}  stepOk=${state.stepOk ? 1 : 0}`,
      `both true  → PROVED`,
      `both false → BOTH_FAIL`,
      `base false step true → BASE_FAIL`,
      `base true step false → STEP_FAIL`,
      `────────────────────`,
      `verdict: ${state.verdict}`,
    ];
    return rows.join("\n");
  }

  function renderProofCards() {
    const baseOk = !!state.baseOk;
    const stepOk = !!state.stepOk;
    const evaluated = !!state.evaluated;

    const baseBadge = !evaluated ? "pending" : baseOk ? "holds" : "FAIL";
    const stepBadge = !evaluated ? "pending" : stepOk ? "holds" : "FAIL";
    const baseCls = !evaluated ? "" : baseOk ? "is-ok" : "is-bad";
    const stepCls = !evaluated ? "" : stepOk ? "is-ok" : "is-bad";

    document.getElementById("proof-cards").innerHTML = `
      <div class="proof-card ${baseCls}">
        <div class="pc-head">
          <span class="pc-title">Base card</span>
          <span class="pc-badge">${baseBadge}</span>
        </div>
        <div class="pc-formula">P(0)</div>
        <div class="pc-detail">
          Anchor at reset / time zero. Without base, induction has no starting rung.
        </div>
      </div>
      <div class="proof-card ${stepCls}">
        <div class="pc-head">
          <span class="pc-title">Step card</span>
          <span class="pc-badge">${stepBadge}</span>
        </div>
        <div class="pc-formula">P(k) → P(k+1)</div>
        <div class="pc-detail">
          Inductive step lifts truth from k to k+1. Without step, P(0) alone proves nothing unbounded.
        </div>
      </div>
    `;
  }

  function ladderRungOk(k) {
    if (k === 0) return !!state.baseOk;
    return !!state.baseOk && !!state.stepOk;
  }

  function ladderLabel(k) {
    if (k === 0) return "P(0) base";
    return `P(${k - 1})→P(${k})`;
  }

  function renderLadder() {
    /** @type {string[]} */
    const html = [];
    for (let k = 0; k < LADDER_DEPTH; k++) {
      const ok = state.evaluated && ladderRungOk(k);
      const cls = !state.evaluated ? "" : ok ? "is-ok" : "is-bad";
      const st = !state.evaluated ? "—" : ok ? "ok" : "gap";
      html.push(
        `<div class="ladder-rung ${cls}">
          <span class="k">k=${k}</span>
          <span class="lbl">${ladderLabel(k)}</span>
          <span class="st">${st}</span>
        </div>`
      );
    }
    document.getElementById("ladder").innerHTML = html.join("");
  }

  function renderLab() {
    syncInputs();
    renderProofCards();
    renderLadder();

    const v = document.getElementById("verdict");
    if (!state.evaluated) {
      v.className = "verdict idle";
      v.textContent = "Idle — Evaluate";
    } else {
      v.className = "verdict " + verdictClass(state.verdict);
      v.textContent = `${state.verdict}: ${state.message}`;
    }

    document.getElementById("proof-box").textContent = proofText();

    const rb = document.getElementById("result-box");
    if (state.evaluated) {
      rb.className = "result-box " + (state.verdict === "PROVED" ? "proved" : "fail");
      rb.textContent = resultDetailText();
    } else {
      rb.className = "result-box";
      rb.textContent = resultDetailText();
    }

    document.getElementById("meta-note").textContent = state.note || "";
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.baseOk ? "is-ok" : "is-bad"}">base=${state.baseOk ? 1 : 0}</span>
      <span class="flag ${state.stepOk ? "is-ok" : "is-bad"}">step=${state.stepOk ? 1 : 0}</span>
      <span class="flag ${
        state.verdict === "PROVED"
          ? "is-ok"
          : state.evaluated
            ? "is-bad"
            : ""
      }">${state.evaluated ? state.verdict : "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
      <span class="flag ${state.explained ? "is-ok" : ""}">explain=${state.explained ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          baseOk: state.baseOk,
          stepOk: state.stepOk,
          evaluated: state.evaluated,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-ind",
      title: "Quiz: induction",
      type: "quiz",
      prompt: "Mathematical induction needs…",
      hint: "Two parts.",
      choices: [
        "base case + inductive step",
        "only BMC k=1",
        "only cover",
        "Git merge",
      ],
      answer: "base case + inductive step",
    },
    {
      id: "quiz-base",
      title: "Quiz: base",
      type: "quiz",
      prompt: "Base case shows property for…",
      hint: "P(0).",
      choices: [
        "starting state / time 0",
        "all infinite time",
        "Git only",
        "vacuity only",
      ],
      answer: "starting state / time 0",
    },
    {
      id: "quiz-step",
      title: "Quiz: step",
      type: "quiz",
      prompt: "Inductive step shows…",
      hint: "Progress.",
      choices: [
        "P(k) implies P(k+1)",
        "cover hits",
        "assume false",
        "clock stops",
      ],
      answer: "P(k) implies P(k+1)",
    },
    {
      id: "quiz-verdict",
      title: "Quiz: verdict",
      type: "quiz",
      prompt: "Only base true, step false → verdict…",
      hint: "Step missing.",
      choices: ["STEP_FAIL", "PROVED", "BASE_FAIL", "BOTH_FAIL"],
      answer: "STEP_FAIL",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — PROVED with base and step true.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.verdict === "PROVED" && state.baseOk && state.stepOk && state.lastAction === "starter",
    },
    {
      id: "eval-proved",
      title: "Evaluate PROVED",
      prompt: "On starter, Evaluate — PROVED.",
      hint: "Evaluate",
      setup: () => {
        loadStarter();
        doEval();
      },
      check: () => state.evaluated && state.verdict === "PROVED",
    },
    {
      id: "break-step",
      title: "Break step",
      prompt: "Load break step — STEP_FAIL.",
      hint: "break_step preset",
      setup: () => {
        selPreset.value = "break_step";
        loadPreset();
      },
      check: () => state.verdict === "STEP_FAIL" && state.baseOk && !state.stepOk,
    },
    {
      id: "break-base",
      title: "Break base",
      prompt: "Load break base — BASE_FAIL.",
      hint: "break_base preset",
      setup: () => {
        selPreset.value = "break_base";
        loadPreset();
      },
      check: () => state.verdict === "BASE_FAIL" && !state.baseOk && state.stepOk,
    },
    {
      id: "both-off",
      title: "Both off",
      prompt: "Load both off — BOTH_FAIL.",
      hint: "both_off preset",
      setup: () => {
        selPreset.value = "both_off";
        loadPreset();
      },
      check: () => !state.baseOk && !state.stepOk && state.verdict === "BOTH_FAIL",
    },
    {
      id: "toggle-step",
      title: "Toggle step",
      prompt: "Uncheck STEP, Evaluate — STEP_FAIL.",
      hint: "STEP checkbox off",
      setup: () => {
        loadStarter();
        chkStep.checked = false;
        doEval();
      },
      check: () => !state.stepOk && state.verdict === "STEP_FAIL",
    },
    {
      id: "toggle-base",
      title: "Toggle base",
      prompt: "Uncheck BASE, Evaluate — BASE_FAIL.",
      hint: "BASE checkbox off",
      setup: () => {
        loadStarter();
        chkBase.checked = false;
        doEval();
      },
      check: () => !state.baseOk && state.verdict === "BASE_FAIL",
    },
    {
      id: "restore",
      title: "Restore",
      prompt: "Load restored PROVED — both on.",
      hint: "restored preset",
      setup: () => {
        selPreset.value = "restored";
        loadPreset();
      },
      check: () => state.verdict === "PROVED" && state.preset === "restored",
    },
    {
      id: "demo",
      title: "Demo STEP_FAIL",
      prompt: "Demo STEP_FAIL — demo=1 and STEP_FAIL.",
      hint: "Demo STEP_FAIL",
      setup: () => loadStarter(),
      check: () => state.demoed && state.verdict === "STEP_FAIL" && state.lastAction === "demo",
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
      id: "proof-cards",
      title: "Proof cards",
      prompt: "Starter proof cards show base and step both holds.",
      hint: "Proof cards panel",
      setup: () => loadStarter(),
      check: () => document.querySelectorAll(".proof-card.is-ok").length === 2,
    },
    {
      id: "ladder",
      title: "Ladder",
      prompt: "Starter ladder shows ok rungs when PROVED.",
      hint: "Induction ladder panel",
      setup: () => loadStarter(),
      check: () => document.querySelectorAll(".ladder-rung.is-ok").length >= 3,
    },
    {
      id: "proof-box",
      title: "Proof box",
      prompt: "Proof sketch shows VERDICT PROVED on starter.",
      hint: "Proof sketch panel",
      setup: () => loadStarter(),
      check: () => /VERDICT:\s+PROVED/.test(document.getElementById("proof-box").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions BASE and STEP.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /BASE/i.test(sourceSketch()) && /STEP/i.test(sourceSketch()),
    },
    {
      id: "step-only",
      title: "Step only",
      prompt: "Load step only — BASE_FAIL (no base).",
      hint: "step_only preset",
      setup: () => {
        selPreset.value = "step_only";
        loadPreset();
      },
      check: () => state.preset === "step_only" && state.verdict === "BASE_FAIL",
    },
    {
      id: "base-only",
      title: "Base only",
      prompt: "Load base only — STEP_FAIL (no step).",
      hint: "base_only preset",
      setup: () => {
        selPreset.value = "base_only";
        loadPreset();
      },
      check: () => state.preset === "base_only" && state.verdict === "STEP_FAIL",
    },
    {
      id: "idle-eval",
      title: "Idle eval",
      prompt: "Load idle, Evaluate — PROVED.",
      hint: "idle → Evaluate",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doEval();
      },
      check: () => state.preset === "idle" && state.verdict === "PROVED",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — starter PROVED again.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => state.verdict === "PROVED" && state.baseOk && state.stepOk,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="find-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("find-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-eval").addEventListener("click", () => doEval());
  chkBase.addEventListener("change", () => {
    readInputs();
    state.evaluated = false;
    state.lastAction = "edit";
    renderAll();
  });
  chkStep.addEventListener("change", () => {
    readInputs();
    state.evaluated = false;
    state.lastAction = "edit";
    renderAll();
  });
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

  if (!tryRestoreSession()) loadStarter();
  else {
    syncInputs();
    renderAll();
  }
})();
