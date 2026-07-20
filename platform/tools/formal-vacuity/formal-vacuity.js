(() => {
  /**
   * Formal vacuity (concept)
   *   a |-> b · vacuous when a never 1 · meaningful pass vs fail
   * Starter: a always 0 → VACUOUS_PASS
   */

  const N = 8;

  const PRESETS = {
    starter: {
      label: "starter: VACUOUS_PASS",
      a: [0, 0, 0, 0, 0, 0, 0, 0],
      b: [0, 1, 0, 1, 0, 0, 0, 0],
      cursor: 0,
      note: "a never rises → a|->b never fires → vacuous pass (checks nothing about b).",
      autoEval: true,
    },
    meaningful_pass: {
      label: "meaningful PASS",
      a: [0, 0, 1, 0, 1, 0, 0, 0],
      b: [0, 0, 1, 0, 1, 0, 0, 0],
      cursor: 2,
      note: "a fires at t=2,4 and b holds → real meaningful PASS.",
      autoEval: true,
    },
    real_fail: {
      label: "real FAIL",
      a: [0, 0, 1, 0, 0, 0, 0, 0],
      b: [0, 0, 0, 1, 0, 0, 0, 0],
      cursor: 2,
      note: "a true at t=2 but b low → implication FAIL (not vacuous).",
      autoEval: true,
    },
    vacuous_b_bad: {
      label: "vacuous b wrong",
      a: [0, 0, 0, 0, 0, 0, 0, 0],
      b: [0, 0, 0, 0, 0, 0, 0, 0],
      cursor: 3,
      note: "b could be wrong but a never true — still VACUOUS_PASS.",
      autoEval: true,
    },
    multi_pass: {
      label: "multi attempt pass",
      a: [0, 1, 0, 1, 0, 1, 0, 0],
      b: [0, 1, 0, 1, 0, 1, 0, 0],
      cursor: 1,
      note: "Three a fires, all b ok → MEANINGFUL_PASS with 3 attempts.",
      autoEval: true,
    },
    late_fail: {
      label: "late FAIL",
      a: [0, 1, 1, 0, 0, 0, 0, 0],
      b: [0, 1, 0, 0, 0, 0, 0, 0],
      cursor: 2,
      note: "First attempt ok, second fails at t=2.",
      autoEval: true,
    },
    single_fire: {
      label: "single fire pass",
      a: [0, 0, 0, 1, 0, 0, 0, 0],
      b: [0, 0, 0, 1, 0, 0, 0, 0],
      cursor: 3,
      note: "One antecedent at t=3 — minimal meaningful check.",
      autoEval: true,
    },
    idle: {
      label: "idle (edit then Evaluate)",
      a: [0, 0, 0, 0, 0, 0, 0, 0],
      b: [0, 1, 0, 1, 0, 0, 0, 0],
      cursor: 0,
      note: "Toggle a@cursor or load preset, then Evaluate.",
      autoEval: false,
    },
  };

  function sourceSketch() {
    return `# Vacuity literacy (overlapping a |-> b)
# assert property (@(posedge clk) a |-> b);
#
# VACUOUS_PASS: a never true → no failing attempt → green but meaningless
# MEANINGFUL_PASS: a fires and every attempt has b true
# FAIL: a true and b false same cycle
#
# Formal tools may warn on vacuity — review cover / assume reachability`;
  }

  function cloneWave(arr) {
    return arr.slice();
  }

  function evaluateWave(a, b) {
    /** @type {{t:number, ok:boolean}[]} */
    const attempts = [];
    for (let t = 0; t < N; t++) {
      if (!a[t]) continue;
      attempts.push({ t, ok: !!b[t] });
    }
    if (!attempts.length) {
      return {
        status: "VACUOUS_PASS",
        attempts,
        antecedentFires: 0,
        message: "a never true → a|->b vacuously passes (b never checked)",
      };
    }
    const fails = attempts.filter((x) => !x.ok);
    if (fails.length) {
      return {
        status: "FAIL",
        attempts,
        antecedentFires: attempts.length,
        message: `FAIL at t=${fails[0].t} — a true but b false`,
      };
    }
    return {
      status: "MEANINGFUL_PASS",
      attempts,
      antecedentFires: attempts.length,
      message: `MEANINGFUL_PASS — ${attempts.length} attempt(s), all b held`,
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const a = cloneWave(p.a);
    const b = cloneWave(p.b);
    const r = evaluateWave(a, b);
    return {
      preset: "starter",
      a,
      b,
      cursor: p.cursor,
      status: r.status,
      message: r.message,
      attempts: r.attempts,
      antecedentFires: r.antecedentFires,
      note: p.note,
      evaluated: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`eval ${r.status} fires=${r.antecedentFires}`],
    };
  }

  const CLEARED_KEY = "ddv-formal-vacuity-cleared-v1";
  const STORE_KEY = "ddv-formal-vacuity-session-v1";

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

  const root = document.getElementById("fvac-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>a |-> b</code> with antecedent <code>a</code>
        always 0 → <strong>VACUOUS_PASS</strong> (property never meaningfully triggered).</p>
      <button type="button" class="btn btn-secondary" id="fvac-starter">Load starter example</button>
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
        <div class="idea-card"><h3>a |-> b</h3><p>Overlapping implication — when a, check b same cycle.</p></div>
        <div class="idea-card"><h3>Vacuous</h3><p>If a never true, pass is vacuous — b never tested.</p></div>
        <div class="idea-card"><h3>Meaningful</h3><p>Real pass requires a to fire and b to hold.</p></div>
        <div class="idea-card"><h3>False green</h3><p>VACUOUS_PASS looks green but may hide missing checks.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="fvac-controls">
        <div class="fvac-field">
          <label for="sel-preset">Wave preset</label>
          <select id="sel-preset">
            <option value="starter" selected>starter VACUOUS</option>
            <option value="meaningful_pass">meaningful PASS</option>
            <option value="real_fail">real FAIL</option>
            <option value="vacuous_b_bad">vacuous b wrong</option>
            <option value="multi_pass">multi attempt pass</option>
            <option value="late_fail">late FAIL</option>
            <option value="single_fire">single fire pass</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-eval">Evaluate</button>
        <button type="button" class="btn btn-ghost" id="btn-prev">◀ Prev</button>
        <button type="button" class="btn btn-ghost" id="btn-next">Next ▶</button>
        <button type="button" class="btn btn-ghost" id="btn-toggle-a">Toggle a@cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-toggle-b">Toggle b@cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo meaningful</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict warn">VACUOUS_PASS</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="fvac-layout">
        <div class="panel-box">
          <h3>Property &amp; result</h3>
          <pre class="prop-code" id="prop-code"></pre>
          <div id="eval-box" class="eval-box vacuous"></div>
          <div class="compare-row" id="compare-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Signal timeline</h3>
          <div class="wave" id="wave-box"></div>
          <div class="cell-btns" id="cursor-btns"></div>
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

  function currentEval() {
    return evaluateWave(state.a, state.b);
  }

  function applyEval() {
    const r = currentEval();
    state.status = r.status;
    state.message = r.message;
    state.attempts = r.attempts;
    state.antecedentFires = r.antecedentFires;
    state.evaluated = true;
    return r;
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

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter VACUOUS_PASS");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value in PRESETS ? selPreset.value : "starter";
    const p = PRESETS[id];
    state.preset = id;
    state.a = cloneWave(p.a);
    state.b = cloneWave(p.b);
    state.cursor = p.cursor;
    state.note = p.note;
    state.lastAction = "load";
    syncInputs();
    if (p.autoEval) {
      applyEval();
      pushTrace(`load ${id} → ${state.status}`);
      pushLog(`# load ${id}`);
    } else {
      state.evaluated = false;
      pushLog(`# load ${id}`);
    }
    renderAll();
  }

  function doEval() {
    const r = applyEval();
    state.lastAction = "eval";
    pushTrace(`eval ${r.status} fires=${r.antecedentFires}`);
    pushLog(`# evaluate → ${r.status}`);
    renderAll();
  }

  function stepCursor(delta) {
    state.cursor = (state.cursor + delta + N) % N;
    state.lastAction = delta < 0 ? "prev" : "next";
    pushTrace(`${state.lastAction} cursor=${state.cursor}`);
    renderAll();
  }

  function setCursor(t) {
    state.cursor = Math.max(0, Math.min(N - 1, t));
    state.lastAction = "cursor";
    pushTrace(`cursor=${state.cursor}`);
    renderAll();
  }

  function toggleSig(which) {
    const t = state.cursor;
    if (which === "a") state.a[t] = state.a[t] ? 0 : 1;
    else state.b[t] = state.b[t] ? 0 : 1;
    state.evaluated = false;
    state.lastAction = which === "a" ? "toggle-a" : "toggle-b";
    pushTrace(`toggle ${which}@${t}=${which === "a" ? state.a[t] : state.b[t]}`);
    renderAll();
  }

  function demo() {
    selPreset.value = "meaningful_pass";
    const p = PRESETS.meaningful_pass;
    state.preset = "meaningful_pass";
    state.a = cloneWave(p.a);
    state.b = cloneWave(p.b);
    state.cursor = p.cursor;
    state.note = p.note;
    state.demoed = true;
    syncInputs();
    applyEval();
    state.lastAction = "demo";
    pushLog("# demo meaningful PASS");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Vacuous PASS: a never true so b unchecked. Meaningful PASS: a fires and b holds. Use cover to prove a reachable."
    );
    pushLog("# explain");
    renderAll();
  }

  function propText() {
    return "property p;\n  @(posedge clk) a |-> b;\nendproperty\nassert property (p);";
  }

  function renderCompareRow() {
    const el = document.getElementById("compare-row");
    const vac = {
      title: "Vacuous sketch",
      sub: "a always 0",
      cls: state.status === "VACUOUS_PASS" ? "is-active" : "",
    };
    const real = {
      title: "Meaningful sketch",
      sub: "a fires, b ok",
      cls: state.status === "MEANINGFUL_PASS" ? "is-active" : "",
    };
    const fail = {
      title: "Real failure",
      sub: "a true, b false",
      cls: state.status === "FAIL" ? "is-active" : "",
    };
    el.innerHTML = [vac, real, fail]
      .map(
        (c) =>
          `<div class="compare-card ${c.cls}"><strong>${c.title}</strong><span>${c.sub}</span></div>`
      )
      .join("");
  }

  function renderWave() {
    const result = state.evaluated ? currentEval() : null;
    const antSet = new Set();
    const okSet = new Set();
    const failSet = new Set();
    if (result) {
      result.attempts.forEach((at) => {
        antSet.add(at.t);
        if (at.ok) okSet.add(at.t);
        else failSet.add(at.t);
      });
    }

    let html = `<table class="wave-table"><thead><tr><th></th>`;
    for (let t = 0; t < N; t++) html += `<th>${t}</th>`;
    html += `</tr></thead><tbody>`;

    ["a", "b"].forEach((sig) => {
      html += `<tr><td class="sig">${sig}</td>`;
      for (let t = 0; t < N; t++) {
        const val = state[sig][t];
        const cls = [
          val ? "is-hi" : "",
          t === state.cursor ? "is-cursor" : "",
          sig === "a" && antSet.has(t) ? "is-ant" : "",
          sig === "b" && okSet.has(t) ? "is-cons" : "",
          sig === "b" && failSet.has(t) ? "is-fail-mark" : "",
        ]
          .filter(Boolean)
          .join(" ");
        html += `<td class="${cls}">${val}</td>`;
      }
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById("wave-box").innerHTML = html;

    const btns = document.getElementById("cursor-btns");
    btns.innerHTML = "";
    for (let t = 0; t < N; t++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `t${t}`;
      if (t === state.cursor) b.className = "is-on";
      b.addEventListener("click", () => setCursor(t));
      btns.appendChild(b);
    }
  }

  function renderLab() {
    syncInputs();
    renderWave();
    renderCompareRow();

    document.getElementById("prop-code").textContent = propText();

    const result = state.evaluated ? currentEval() : null;
    const evalBox = document.getElementById("eval-box");
    if (!result) {
      evalBox.className = "eval-box idle";
      evalBox.textContent = "Load a preset or edit wave, then Evaluate.";
    } else {
      const cls =
        result.status === "VACUOUS_PASS"
          ? "vacuous"
          : result.status === "MEANINGFUL_PASS"
            ? "meaningful"
            : "fail";
      evalBox.className = "eval-box " + cls;
      const lines = [result.message, `antecedent fires: ${result.antecedentFires}`];
      result.attempts.forEach((at) => {
        lines.push(`  t=${at.t}: a→ check b → ${at.ok ? "ok" : "FAIL"}`);
      });
      if (!result.attempts.length) lines.push("  (no attempts — vacuous)");
      evalBox.textContent = lines.join("\n");
    }

    const v = document.getElementById("verdict");
    if (!state.evaluated || !result) {
      v.className = "verdict idle";
      v.textContent = "Idle — Evaluate property on wave";
    } else if (result.status === "VACUOUS_PASS") {
      v.className = "verdict warn";
      v.textContent = `${result.status}: ${result.message}`;
    } else if (result.status === "MEANINGFUL_PASS") {
      v.className = "verdict yes";
      v.textContent = `${result.status}: ${result.message}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${result.status}: ${result.message}`;
    }

    document.getElementById("meta-note").textContent = state.note || "";
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const st = result ? result.status : "—";
    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">cursor=${state.cursor}</span>
      <span class="flag ${st === "VACUOUS_PASS" ? "is-warn" : st === "MEANINGFUL_PASS" ? "is-ok" : st === "FAIL" ? "is-bad" : ""}">${st}</span>
      <span class="flag">fires=${state.antecedentFires ?? "—"}</span>
      <span class="flag">a@c=${state.a[state.cursor]}</span>
      <span class="flag">b@c=${state.b[state.cursor]}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          a: state.a,
          b: state.b,
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
      id: "quiz-vac",
      title: "Quiz: vacuity",
      type: "quiz",
      prompt: "Vacuity means the property…",
      hint: "Never triggered.",
      choices: [
        "never meaningfully triggered",
        "always fails hard",
        "proves liveness",
        "runs pytest",
      ],
      answer: "never meaningfully triggered",
    },
    {
      id: "quiz-imp",
      title: "Quiz: |->",
      type: "quiz",
      prompt: "a|->b fails only when…",
      hint: "Implication table.",
      choices: ["a true and b false", "a false", "b true alone", "Git dirty"],
      answer: "a true and b false",
    },
    {
      id: "quiz-ant",
      title: "Quiz: a always 0",
      type: "quiz",
      prompt: "If a is always 0, a|->b is…",
      hint: "No attempts.",
      choices: ["vacuously true", "always false", "syntax error", "cover hit"],
      answer: "vacuously true",
    },
    {
      id: "quiz-false-green",
      title: "Quiz: false green",
      type: "quiz",
      prompt: "VACUOUS_PASS is dangerous because…",
      hint: "Unchecked b.",
      choices: [
        "sign-off looks green without checking b",
        "it fails synthesis",
        "it stops Git",
        "it deletes RTL",
      ],
      answer: "sign-off looks green without checking b",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — VACUOUS_PASS, a never fires.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.status === "VACUOUS_PASS" &&
        state.antecedentFires === 0 &&
        state.lastAction === "starter",
    },
    {
      id: "eval-starter",
      title: "Eval starter",
      prompt: "Evaluate starter — status VACUOUS_PASS.",
      hint: "Evaluate",
      setup: () => {
        loadStarter();
        doEval();
      },
      check: () => state.evaluated && state.status === "VACUOUS_PASS",
    },
    {
      id: "meaningful",
      title: "Meaningful pass",
      prompt: "Load meaningful PASS — MEANINGFUL_PASS with fires>0.",
      hint: "meaningful_pass preset",
      setup: () => {
        selPreset.value = "meaningful_pass";
        loadPreset();
      },
      check: () => state.status === "MEANINGFUL_PASS" && state.antecedentFires >= 2,
    },
    {
      id: "real-fail",
      title: "Real fail",
      prompt: "Load real FAIL — status FAIL at t=2.",
      hint: "real_fail preset",
      setup: () => {
        selPreset.value = "real_fail";
        loadPreset();
      },
      check: () => state.status === "FAIL" && state.a[2] === 1 && state.b[2] === 0,
    },
    {
      id: "vacuous-b-bad",
      title: "Vacuous b wrong",
      prompt: "Load vacuous b wrong — still VACUOUS_PASS.",
      hint: "vacuous_b_bad preset",
      setup: () => {
        selPreset.value = "vacuous_b_bad";
        loadPreset();
      },
      check: () => state.status === "VACUOUS_PASS" && state.preset === "vacuous_b_bad",
    },
    {
      id: "multi-pass",
      title: "Multi pass",
      prompt: "Load multi attempt — MEANINGFUL_PASS, 3 fires.",
      hint: "multi_pass preset",
      setup: () => {
        selPreset.value = "multi_pass";
        loadPreset();
      },
      check: () => state.status === "MEANINGFUL_PASS" && state.antecedentFires === 3,
    },
    {
      id: "late-fail",
      title: "Late fail",
      prompt: "Load late FAIL — status FAIL.",
      hint: "late_fail preset",
      setup: () => {
        selPreset.value = "late_fail";
        loadPreset();
      },
      check: () => state.status === "FAIL" && state.preset === "late_fail",
    },
    {
      id: "toggle-a",
      title: "Toggle a",
      prompt: "From starter, Toggle a@cursor, Evaluate — MEANINGFUL or FAIL.",
      hint: "Toggle a then Evaluate",
      setup: () => {
        loadStarter();
        toggleSig("a");
        doEval();
      },
      check: () => state.status === "MEANINGFUL_PASS" || state.status === "FAIL",
    },
    {
      id: "demo",
      title: "Demo meaningful",
      prompt: "Demo meaningful — MEANINGFUL_PASS and demo=1.",
      hint: "Demo meaningful",
      setup: () => loadStarter(),
      check: () => state.demoed && state.status === "MEANINGFUL_PASS" && state.lastAction === "demo",
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
      id: "compare-row",
      title: "Compare cards",
      prompt: "Starter highlights Vacuous sketch compare card.",
      hint: "Load starter",
      setup: () => loadStarter(),
      check: () => document.querySelector(".compare-card.is-active") != null,
    },
    {
      id: "single-fire",
      title: "Single fire",
      prompt: "Load single fire pass — MEANINGFUL_PASS, 1 fire.",
      hint: "single_fire preset",
      setup: () => {
        selPreset.value = "single_fire";
        loadPreset();
      },
      check: () => state.status === "MEANINGFUL_PASS" && state.antecedentFires === 1,
    },
    {
      id: "step-cursor",
      title: "Step cursor",
      prompt: "From starter, Next ▶ once — cursor=1.",
      hint: "Next ▶",
      setup: () => {
        loadStarter();
        stepCursor(1);
      },
      check: () => state.cursor === 1 && state.lastAction === "next",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions VACUOUS_PASS.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /VACUOUS_PASS/i.test(sourceSketch()),
    },
    {
      id: "quiz-cover",
      title: "Quiz: cover",
      type: "quiz",
      prompt: "cover helps detect…",
      hint: "Reachability.",
      choices: [
        "unreachable antecedents/scenarios",
        "Git merges",
        "clock period",
        "pytest version",
      ],
      answer: "unreachable antecedents/scenarios",
    },
    {
      id: "quiz-meaningful",
      title: "Quiz: meaningful",
      type: "quiz",
      prompt: "MEANINGFUL_PASS here means…",
      hint: "a fired.",
      choices: [
        "a fired and all attempts passed",
        "a never true",
        "Git pushed",
        "cover deleted",
      ],
      answer: "a fired and all attempts passed",
    },
    {
      id: "idle-eval",
      title: "Idle eval",
      prompt: "Load idle, Evaluate — VACUOUS_PASS.",
      hint: "idle → Evaluate",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doEval();
      },
      check: () => state.preset === "idle" && state.status === "VACUOUS_PASS",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — starter VACUOUS_PASS again.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => state.status === "VACUOUS_PASS" && state.antecedentFires === 0,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="fvac-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("fvac-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-eval").addEventListener("click", () => doEval());
  document.getElementById("btn-prev").addEventListener("click", () => stepCursor(-1));
  document.getElementById("btn-next").addEventListener("click", () => stepCursor(1));
  document.getElementById("btn-toggle-a").addEventListener("click", () => toggleSig("a"));
  document.getElementById("btn-toggle-b").addEventListener("click", () => toggleSig("b"));
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
