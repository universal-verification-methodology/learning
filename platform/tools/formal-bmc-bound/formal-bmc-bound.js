(() => {
  /**
   * Formal BMC bound (concept)
   *   bugAt step + bound k · CEX if k>=bugAt else PASS_BOUND
   * Starter: bug@3 k=5 → CEX
   */

  const MAX_K = 12;

  const PRESETS = {
    starter: {
      label: "starter: bug@3 k=5 CEX",
      bugAt: 3,
      k: 5,
      note: "Bound k=5 reaches injected bug at step 3 → counterexample.",
      autoRun: true,
    },
    pass_bound: {
      label: "PASS_BOUND k=2",
      bugAt: 3,
      k: 2,
      note: "k < bugAt — bug not reached within bound.",
      autoRun: true,
    },
    edge_equal: {
      label: "edge k=bugAt",
      bugAt: 3,
      k: 3,
      note: "k equals bugAt — just reaches bug → CEX.",
      autoRun: true,
    },
    deep_bug: {
      label: "deep bug@10",
      bugAt: 10,
      k: 5,
      note: "Bug beyond bound — PASS_BOUND.",
      autoRun: true,
    },
    shallow_cex: {
      label: "shallow bug@1",
      bugAt: 1,
      k: 1,
      note: "Immediate bug at step 1 with k=1 → CEX.",
      autoRun: true,
    },
    tight: {
      label: "tight k=4 bug@5",
      bugAt: 5,
      k: 4,
      note: "One step short — PASS_BOUND.",
      autoRun: true,
    },
    wide: {
      label: "wide k=20 bug@4",
      bugAt: 4,
      k: 8,
      note: "Wide bound easily reaches bug@4.",
      autoRun: true,
    },
    idle: {
      label: "idle (edit then Run)",
      bugAt: 3,
      k: 5,
      note: "Edit bugAt/k then Run BMC.",
      autoRun: false,
    },
  };

  function sourceSketch() {
    return `# Bounded model check literacy (not SymbiYosys)
# sby -mode bmc -depth k
# assert property (p);  assume env;
#
# bug_at = cycle where injected failure becomes visible
# if k >= bug_at → CEX (counterexample within bound)
# else           → PASS_BOUND (bug not reached in k steps)
#
# PASS_BOUND is NOT unbounded proof — need induction / prove mode.`;
  }

  function runBmc(bugAt, k) {
    const b = Math.max(0, Math.min(MAX_K, Number(bugAt) || 0));
    const depth = Math.max(0, Math.min(MAX_K, Number(k) || 0));
    const hit = depth >= b;
    return {
      bugAt: b,
      k: depth,
      verdict: hit ? "CEX" : "PASS_BOUND",
      message: hit
        ? `BMC depth k=${depth} reaches bug at step ${b} → counterexample`
        : `BMC depth k=${depth} < bug at step ${b} → PASS_BOUND (bug not reached)`,
      hit,
    };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const r = runBmc(p.bugAt, p.k);
    return {
      preset: "starter",
      bugAt: r.bugAt,
      k: r.k,
      verdict: r.verdict,
      message: r.message,
      hit: r.hit,
      note: p.note,
      ran: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`bmc ${r.verdict} bug@${r.bugAt} k=${r.k}`],
    };
  }

  const CLEARED_KEY = "ddv-formal-bmc-bound-cleared-v1";
  const STORE_KEY = "ddv-formal-bmc-bound-session-v1";

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

  const root = document.getElementById("bmc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> bug at step <code>3</code>, bound <code>k=5</code> —
        Run BMC → <strong>CEX</strong> (k &ge; bugAt).</p>
      <button type="button" class="btn btn-secondary" id="bmc-starter">Load starter example</button>
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
        <div class="idea-card"><h3>BMC</h3><p>Explore design states up to depth k.</p></div>
        <div class="idea-card"><h3>bugAt</h3><p>Cycle where injected bug becomes visible.</p></div>
        <div class="idea-card"><h3>CEX</h3><p>When k ≥ bugAt, counterexample within bound.</p></div>
        <div class="idea-card"><h3>PASS_BOUND</h3><p>Bug beyond k — not reached in bounded search.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="bmc-controls">
        <div class="bmc-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>starter CEX</option>
            <option value="pass_bound">PASS_BOUND k=2</option>
            <option value="edge_equal">edge k=bugAt</option>
            <option value="deep_bug">deep bug@10</option>
            <option value="shallow_cex">shallow bug@1</option>
            <option value="tight">tight k=4</option>
            <option value="wide">wide k=8</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="bmc-field">
          <label for="inp-bug">bugAt step</label>
          <input id="inp-bug" type="number" min="0" max="${MAX_K}" value="3" />
        </div>
        <div class="bmc-field">
          <label for="inp-k">bound k</label>
          <input id="inp-k" type="number" min="0" max="${MAX_K}" value="5" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-run">Run BMC</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo PASS_BOUND</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict no">CEX</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="bmc-layout">
        <div class="panel-box">
          <h3>Depth visual</h3>
          <div class="depth-track" id="depth-track"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>BMC sketch</h3>
          <pre class="bmc-code" id="bmc-code"></pre>
          <div id="result-box" class="result-box"></div>
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
  const inpBug = /** @type {HTMLInputElement} */ (document.getElementById("inp-bug"));
  const inpK = /** @type {HTMLInputElement} */ (document.getElementById("inp-k"));

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
    if (document.activeElement !== inpBug) inpBug.value = String(state.bugAt);
    if (document.activeElement !== inpK) inpK.value = String(state.k);
  }

  function readInputs() {
    state.bugAt = Math.max(0, Math.min(MAX_K, Number(inpBug.value) || 0));
    state.k = Math.max(0, Math.min(MAX_K, Number(inpK.value) || 0));
  }

  function applyResult(r) {
    state.bugAt = r.bugAt;
    state.k = r.k;
    state.verdict = r.verdict;
    state.message = r.message;
    state.hit = r.hit;
    state.ran = true;
  }

  function doRun() {
    readInputs();
    const r = runBmc(state.bugAt, state.k);
    applyResult(r);
    state.lastAction = "bmc";
    pushTrace(`bmc ${r.verdict} bug@${r.bugAt} k=${r.k}`);
    pushLog(`# run → ${r.verdict}`);
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter CEX bug@3 k=5");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value in PRESETS ? selPreset.value : "starter";
    const p = PRESETS[id];
    state.preset = id;
    state.bugAt = p.bugAt;
    state.k = p.k;
    state.note = p.note;
    syncInputs();
    state.lastAction = "load";
    if (p.autoRun) doRun();
    else {
      state.ran = false;
      pushLog(`# load ${id}`);
      renderAll();
    }
  }

  function demo() {
    selPreset.value = "pass_bound";
    const p = PRESETS.pass_bound;
    state.preset = "pass_bound";
    state.bugAt = p.bugAt;
    state.k = p.k;
    state.note = p.note;
    state.demoed = true;
    syncInputs();
    doRun();
    state.lastAction = "demo";
    pushLog("# demo PASS_BOUND");
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "BMC explores up to k cycles. CEX when bugAt ≤ k. PASS_BOUND only means bug not seen in k steps."
    );
    pushLog("# explain");
    renderAll();
  }

  function bmcCodeText() {
    return `bmc -depth ${state.k}
bug_at = ${state.bugAt}
# explore steps 0..${state.k}
# fail visible at step ${state.bugAt}`;
  }

  function renderDepthVisual() {
    const span = Math.max(state.k, state.bugAt, 1);
    let html = `<div class="depth-labels"><span>0</span><span>k=${state.k}</span></div><div class="depth-bar">`;
    for (let t = 0; t <= span; t++) {
      const inBound = t <= state.k;
      const isBug = t === state.bugAt;
      const reached = inBound && isBug && state.hit;
      const cls = [
        inBound ? "in-bound" : "out-bound",
        isBug ? "is-bug" : "",
        reached ? "is-hit" : "",
        t === 0 ? "is-start" : "",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<div class="depth-step ${cls}" title="t=${t}"><span>${t}</span></div>`;
    }
    html += `</div><div class="depth-legend">
      <span class="leg in-bound">within k</span>
      <span class="leg is-bug">bugAt</span>
      <span class="leg is-hit">CEX reach</span></div>`;
    document.getElementById("depth-track").innerHTML = html;
  }

  function renderLab() {
    syncInputs();
    renderDepthVisual();

    const v = document.getElementById("verdict");
    if (!state.ran) {
      v.className = "verdict idle";
      v.textContent = "Idle — Run BMC";
    } else if (state.verdict === "CEX") {
      v.className = "verdict no";
      v.textContent = `CEX: ${state.message}`;
    } else {
      v.className = "verdict yes";
      v.textContent = `PASS_BOUND: ${state.message}`;
    }

    document.getElementById("bmc-code").textContent = bmcCodeText();
    const rb = document.getElementById("result-box");
    if (state.ran) {
      rb.className = "result-box " + (state.hit ? "cex" : "pass");
      rb.textContent =
        `k=${state.k} bugAt=${state.bugAt}\n` +
        `compare: k >= bugAt → ${state.k >= state.bugAt ? "true" : "false"}\n` +
        `verdict: ${state.verdict}`;
    } else {
      rb.className = "result-box";
      rb.textContent = "Run BMC to compare k vs bugAt.";
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
      <span class="flag is-on">bugAt=${state.bugAt}</span>
      <span class="flag is-on">k=${state.k}</span>
      <span class="flag ${state.verdict === "CEX" ? "is-bad" : state.verdict === "PASS_BOUND" ? "is-ok" : ""}">${state.verdict || "—"}</span>
      <span class="flag">${state.hit ? "k>=bugAt" : "k<bugAt"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ preset: state.preset, bugAt: state.bugAt, k: state.k, ran: state.ran })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-bmc",
      title: "Quiz: BMC",
      type: "quiz",
      prompt: "BMC explores states up to…",
      hint: "Finite horizon.",
      choices: ["bound k", "infinite depth always", "Git history", "pytest fixtures"],
      answer: "bound k",
    },
    {
      id: "quiz-cex",
      title: "Quiz: CEX",
      type: "quiz",
      prompt: "CEX means…",
      hint: "Witness trace.",
      choices: [
        "counterexample trace found",
        "coverage hit",
        "vacuous pass",
        "synthesis ok",
      ],
      answer: "counterexample trace found",
    },
    {
      id: "quiz-pass",
      title: "Quiz: PASS_BOUND",
      type: "quiz",
      prompt: "PASS_BOUND here means…",
      hint: "Bounded pass.",
      choices: [
        "bug not reached within k",
        "full unbounded proof",
        "Git clean",
        "sim passed",
      ],
      answer: "bug not reached within k",
    },
    {
      id: "quiz-not-full",
      title: "Quiz: not full proof",
      type: "quiz",
      prompt: "BMC pass does not prove…",
      hint: "Need induction.",
      choices: [
        "unbounded correctness",
        "bounded behavior",
        "trace exists",
        "k steps safe",
      ],
      answer: "unbounded correctness",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — bugAt=3 k=5 CEX.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.verdict === "CEX" && state.bugAt === 3 && state.k === 5 && state.lastAction === "starter",
    },
    {
      id: "run-starter",
      title: "Run starter",
      prompt: "Run BMC on starter — CEX with k>=bugAt.",
      hint: "Run BMC",
      setup: () => {
        loadStarter();
        doRun();
      },
      check: () => state.ran && state.verdict === "CEX" && state.k >= state.bugAt,
    },
    {
      id: "pass-bound",
      title: "PASS_BOUND",
      prompt: "Load PASS_BOUND k=2 — verdict PASS_BOUND.",
      hint: "pass_bound preset",
      setup: () => {
        selPreset.value = "pass_bound";
        loadPreset();
      },
      check: () => state.verdict === "PASS_BOUND" && state.k === 2,
    },
    {
      id: "edge-equal",
      title: "Edge equal",
      prompt: "Load edge k=bugAt — CEX at k=3.",
      hint: "edge_equal preset",
      setup: () => {
        selPreset.value = "edge_equal";
        loadPreset();
      },
      check: () => state.verdict === "CEX" && state.k === 3 && state.bugAt === 3,
    },
    {
      id: "deep-bug",
      title: "Deep bug",
      prompt: "Load deep bug@10 k=5 — PASS_BOUND.",
      hint: "deep_bug preset",
      setup: () => {
        selPreset.value = "deep_bug";
        loadPreset();
      },
      check: () => state.verdict === "PASS_BOUND" && state.bugAt === 10,
    },
    {
      id: "shallow-cex",
      title: "Shallow CEX",
      prompt: "Load shallow bug@1 — CEX.",
      hint: "shallow_cex preset",
      setup: () => {
        selPreset.value = "shallow_cex";
        loadPreset();
      },
      check: () => state.verdict === "CEX" && state.bugAt === 1,
    },
    {
      id: "tight",
      title: "Tight bound",
      prompt: "Load tight k=4 bug@5 — PASS_BOUND.",
      hint: "tight preset",
      setup: () => {
        selPreset.value = "tight";
        loadPreset();
      },
      check: () => state.verdict === "PASS_BOUND" && state.k === 4,
    },
    {
      id: "wide",
      title: "Wide bound",
      prompt: "Load wide — CEX (k=8 >= bug@4).",
      hint: "wide preset",
      setup: () => {
        selPreset.value = "wide";
        loadPreset();
      },
      check: () => state.verdict === "CEX" && state.bugAt === 4,
    },
    {
      id: "edit-k",
      title: "Edit k",
      prompt: "Set k=1 bugAt=3, Run — PASS_BOUND.",
      hint: "k=1 Run BMC",
      setup: () => {
        loadStarter();
        inpK.value = "1";
        doRun();
      },
      check: () => state.k === 1 && state.verdict === "PASS_BOUND",
    },
    {
      id: "edit-bug",
      title: "Edit bugAt",
      prompt: "Set bugAt=0 k=5, Run — CEX (bug at start).",
      hint: "bugAt=0",
      setup: () => {
        loadStarter();
        inpBug.value = "0";
        doRun();
      },
      check: () => state.bugAt === 0 && state.verdict === "CEX",
    },
    {
      id: "demo",
      title: "Demo PASS",
      prompt: "Demo PASS_BOUND — demo=1 and PASS_BOUND.",
      hint: "Demo PASS_BOUND",
      setup: () => loadStarter(),
      check: () => state.demoed && state.verdict === "PASS_BOUND" && state.lastAction === "demo",
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
      id: "depth-visual",
      title: "Depth visual",
      prompt: "Starter depth visual marks bugAt step.",
      hint: "Load starter",
      setup: () => loadStarter(),
      check: () => document.querySelector(".depth-step.is-bug") != null,
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions PASS_BOUND.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /PASS_BOUND/i.test(sourceSketch()),
    },
    {
      id: "idle-run",
      title: "Idle run",
      prompt: "Load idle, Run BMC — CEX.",
      hint: "idle → Run",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        doRun();
      },
      check: () => state.preset === "idle" && state.verdict === "CEX",
    },
    {
      id: "quiz-depth",
      title: "Quiz: depth",
      type: "quiz",
      prompt: "Increasing k may…",
      hint: "More steps.",
      choices: [
        "reach deeper bugs",
        "guarantee vacuity",
        "stop clock",
        "delete asserts",
      ],
      answer: "reach deeper bugs",
    },
    {
      id: "quiz-local",
      title: "Quiz: local",
      type: "quiz",
      prompt: "Real BMC runs in…",
      hint: "Offline formal.",
      choices: [
        "formal tools (SymbiYosys, VC Formal, …)",
        "browser only",
        "Git only",
        "pytest only",
      ],
      answer: "formal tools (SymbiYosys, VC Formal, …)",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — starter CEX bug@3 k=5.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => state.verdict === "CEX" && state.bugAt === 3 && state.k === 5,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="bmc-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("bmc-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-run").addEventListener("click", () => doRun());
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
