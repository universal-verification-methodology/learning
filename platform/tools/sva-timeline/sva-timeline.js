(() => {
  /**
   * SVA implication timeline (concept)
   *   Short wave of a,b · |-> vs |=> · pass / fail / vacuous
   * Starter: |-> overlapping pass at cycle 2 (a=1,b=1)
   */

  const N = 8;

  /** @typedef {"overlap"|"nonoverlap"} ImpKind */

  const PRESETS = {
    overlap_pass: {
      label: "|-> pass (same cycle)",
      kind: "overlap",
      a: [0, 0, 1, 0, 0, 0, 0, 0],
      b: [0, 0, 1, 0, 0, 0, 0, 0],
      cursor: 2,
    },
    overlap_fail: {
      label: "|-> fail (b low)",
      kind: "overlap",
      a: [0, 0, 1, 0, 0, 0, 0, 0],
      b: [0, 0, 0, 1, 0, 0, 0, 0],
      cursor: 2,
    },
    nonoverlap_pass: {
      label: "|=> pass (next cycle)",
      kind: "nonoverlap",
      a: [0, 0, 1, 0, 0, 0, 0, 0],
      b: [0, 0, 0, 1, 0, 0, 0, 0],
      cursor: 2,
    },
    nonoverlap_fail: {
      label: "|=> fail (next low)",
      kind: "nonoverlap",
      a: [0, 0, 1, 0, 0, 0, 0, 0],
      b: [0, 0, 1, 0, 0, 0, 0, 0],
      cursor: 2,
    },
    vacuous: {
      label: "vacuous (a never 1)",
      kind: "overlap",
      a: [0, 0, 0, 0, 0, 0, 0, 0],
      b: [0, 1, 1, 0, 1, 0, 0, 0],
      cursor: 0,
    },
  };

  function sourceSketch() {
    return `// SVA implication lite (not a full assertion engine)
// a |-> b  overlapping: when a, check b same cycle
// a |=> b  non-overlapping: when a, check b next cycle
// if a never true → vacuous success (no attempt fails)
// property p; @(posedge clk) a |-> b; endproperty
// assert property (p);`;
  }

  function cloneWave(arr) {
    return arr.slice();
  }

  function makeStarter() {
    const p = PRESETS.overlap_pass;
    return {
      preset: "overlap_pass",
      kind: p.kind,
      a: cloneWave(p.a),
      b: cloneWave(p.b),
      cursor: p.cursor,
      evaluated: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-sva-timeline-cleared-v1";
  const STORE_KEY = "ddv-sva-timeline-session-v1";

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

  const root = document.getElementById("sva-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>a |-&gt; b</code> overlapping pass —
        at cycle 2 both <code>a</code> and <code>b</code> are high.</p>
      <button type="button" class="btn btn-secondary" id="sva-starter">Load starter example</button>
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
        <div class="idea-card"><h3>|-&gt;</h3><p>Overlapping: check b in the same cycle as a.</p></div>
        <div class="idea-card"><h3>|=&gt;</h3><p>Non-overlap: check b in the next cycle.</p></div>
        <div class="idea-card"><h3>Attempt</h3><p>Each cycle where a is true starts a check.</p></div>
        <div class="idea-card"><h3>Vacuous</h3><p>If a never rises, success is vacuous.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="sva-controls">
        <div class="sva-field">
          <label for="sel-preset">Wave preset</label>
          <select id="sel-preset">
            <option value="overlap_pass" selected>|-&gt; pass</option>
            <option value="overlap_fail">|-&gt; fail</option>
            <option value="nonoverlap_pass">|=&gt; pass</option>
            <option value="nonoverlap_fail">|=&gt; fail</option>
            <option value="vacuous">vacuous</option>
          </select>
        </div>
        <div class="sva-field">
          <label for="sel-kind">Implication</label>
          <select id="sel-kind">
            <option value="overlap">a |-&gt; b (overlap)</option>
            <option value="nonoverlap">a |=&gt; b (next)</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-eval">Evaluate</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-toggle-a">Toggle a@cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-toggle-b">Toggle b@cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo fail</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="sva-layout">
        <div class="panel-box">
          <h3>Property</h3>
          <pre class="prop-code" id="prop-code"></pre>
          <p id="prop-hint" style="font-size:0.88rem;margin:0;color:var(--muted)"></p>
          <div id="eval-box" class="eval-box">Click Evaluate</div>
        </div>
        <div class="panel-box">
          <h3>Timeline</h3>
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
  const selKind = /** @type {HTMLSelectElement} */ (document.getElementById("sel-kind"));

  function propText() {
    return state.kind === "overlap"
      ? "a |-> b   // overlapping implication"
      : "a |=> b   // non-overlapping (##1)";
  }

  function evaluate() {
    /** @type {{t:number, cons:number|null, ok:boolean}[]} */
    const attempts = [];
    for (let t = 0; t < N; t++) {
      if (!state.a[t]) continue;
      if (state.kind === "overlap") {
        const ok = !!state.b[t];
        attempts.push({ t, cons: t, ok });
      } else {
        const cons = t + 1;
        if (cons >= N) {
          attempts.push({ t, cons: null, ok: false });
        } else {
          attempts.push({ t, cons, ok: !!state.b[cons] });
        }
      }
    }
    if (!attempts.length) {
      return { status: "vacuous", attempts, summary: "vacuous success — a never true" };
    }
    const fails = attempts.filter((x) => !x.ok);
    if (fails.length) {
      return {
        status: "fail",
        attempts,
        summary: `FAIL — ${fails.length} attempt(s); first at t=${fails[0].t}`,
      };
    }
    return {
      status: "pass",
      attempts,
      summary: `PASS — ${attempts.length} attempt(s) succeeded`,
    };
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "overlap_pass";
    selKind.value = state.kind;
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

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter |-> pass @2");
    pushTrace("eval PASS attempt t=2");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value in PRESETS ? selPreset.value : "overlap_pass";
    const p = PRESETS[id];
    state.preset = id;
    state.kind = p.kind;
    selKind.value = p.kind;
    state.a = cloneWave(p.a);
    state.b = cloneWave(p.b);
    state.cursor = p.cursor;
    state.evaluated = false;
    state.lastAction = "load";
    pushLog(`# load ${id}`);
    renderAll();
  }

  function doEval() {
    state.kind = selKind.value === "nonoverlap" ? "nonoverlap" : "overlap";
    state.evaluated = true;
    state.lastAction = "eval";
    const r = evaluate();
    pushTrace(r.summary);
    pushLog(`# evaluate → ${r.status}`);
    renderAll();
  }

  function stepCursor() {
    state.cursor = (state.cursor + 1) % N;
    state.lastAction = "step";
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

  function setCursor(t) {
    state.cursor = t;
    state.lastAction = "cursor";
    renderAll();
  }

  function demo() {
    const p = PRESETS.overlap_fail;
    state.preset = "overlap_fail";
    state.kind = "overlap";
    state.a = cloneWave(p.a);
    state.b = cloneWave(p.b);
    state.cursor = 2;
    state.evaluated = true;
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo |-> fail");
    pushTrace("FAIL attempt t=2 b=0");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "|-> checks b in the same cycle as a; |=> checks the next cycle. " +
        "No a means vacuous success. This sketch is literacy only."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const result = state.evaluated ? evaluate() : null;

    document.getElementById("prop-code").textContent = propText();
    document.getElementById("prop-hint").textContent =
      state.kind === "overlap"
        ? "When a is sampled true, b must be true in that same cycle."
        : "When a is sampled true, b must be true in the following cycle.";

    const evalBox = document.getElementById("eval-box");
    if (!result) {
      evalBox.className = "eval-box";
      evalBox.textContent = "Click Evaluate to score attempts on this wave.";
    } else {
      evalBox.className = "eval-box " + result.status;
      const lines = [result.summary];
      result.attempts.forEach((at) => {
        lines.push(
          `  t=${at.t}: a→ check b@${at.cons == null ? "?" : at.cons} → ${at.ok ? "ok" : "FAIL"}`
        );
      });
      evalBox.textContent = lines.join("\n");
    }

    const antSet = new Set();
    const consSet = new Set();
    const failSet = new Set();
    if (result) {
      result.attempts.forEach((at) => {
        antSet.add(at.t);
        if (at.cons != null) {
          if (at.ok) consSet.add(at.cons);
          else failSet.add(at.cons);
        }
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
          sig === "b" && consSet.has(t) ? "is-cons" : "",
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

    const v = document.getElementById("verdict");
    if (!result) {
      v.className = "verdict idle";
      v.textContent = `${propText().split(" ")[0]} ${propText().split(" ")[1]} · cursor=${state.cursor} · not evaluated`;
    } else if (result.status === "pass") {
      v.className = "verdict yes";
      v.textContent = result.summary;
    } else if (result.status === "fail") {
      v.className = "verdict no";
      v.textContent = result.summary;
    } else {
      v.className = "verdict warn";
      v.textContent = result.summary;
    }

    const st = result ? result.status : "—";
    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.kind === "overlap" ? "|->" : "|=>"}</span>
      <span class="flag is-on">cursor=${state.cursor}</span>
      <span class="flag ${st === "pass" ? "is-ok" : st === "fail" ? "is-bad" : st === "vacuous" ? "is-warn" : ""}">status=${st}</span>
      <span class="flag">a@c=${state.a[state.cursor]}</span>
      <span class="flag">b@c=${state.b[state.cursor]}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          kind: state.kind,
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
      id: "quiz-overlap",
      title: "Quiz: |->",
      type: "quiz",
      prompt: "a |-> b means…",
      hint: "Same cycle.",
      choices: [
        "when a is true, b must be true in the same cycle",
        "b is checked two cycles later always",
        "a and b are wires in the DUT netlist only",
        "the assertion is disabled",
      ],
      answer: "when a is true, b must be true in the same cycle",
    },
    {
      id: "quiz-non",
      title: "Quiz: |=>",
      type: "quiz",
      prompt: "a |=> b means…",
      hint: "Next cycle.",
      choices: [
        "when a is true, b must be true in the next cycle",
        "b must be true in the same cycle as a",
        "only vacuous success is allowed",
        "randomize() must return 1",
      ],
      answer: "when a is true, b must be true in the next cycle",
    },
    {
      id: "quiz-vacuous",
      title: "Quiz: vacuous",
      type: "quiz",
      prompt: "If a never goes high, a |-> b typically…",
      hint: "No attempts.",
      choices: [
        "passes vacuously (no failing attempt)",
        "always fails hard",
        "hangs the simulator",
        "deletes the covergroup",
      ],
      answer: "passes vacuously (no failing attempt)",
    },
    {
      id: "quiz-attempt",
      title: "Quiz: attempt",
      type: "quiz",
      prompt: "An implication attempt starts when…",
      hint: "Antecedent.",
      choices: [
        "the antecedent a is true in a cycle",
        "the clock stops",
        "$finish is called",
        "coverage hits 100%",
      ],
      answer: "the antecedent a is true in a cycle",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — |-> pass, a@2=1, b@2=1.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.kind === "overlap" &&
        state.a[2] === 1 &&
        state.b[2] === 1 &&
        evaluate().status === "pass",
    },
    {
      id: "eval-pass",
      title: "Evaluate pass",
      prompt: "On starter, Evaluate — status=pass.",
      hint: "Evaluate",
      setup: () => {
        loadStarter();
        doEval();
      },
      check: () => state.evaluated && evaluate().status === "pass" && state.lastAction === "eval",
    },
    {
      id: "load-fail",
      title: "Load |-> fail",
      prompt: "Load |-> fail preset and Evaluate.",
      hint: "Preset |-> fail → Load → Evaluate",
      setup: () => {
        selPreset.value = "overlap_fail";
        loadPreset();
        doEval();
      },
      check: () => state.preset === "overlap_fail" && evaluate().status === "fail",
    },
    {
      id: "load-non-pass",
      title: "Load |=> pass",
      prompt: "Load |=> pass — kind nonoverlap, Evaluate → pass.",
      hint: "|=>> pass → Load → Evaluate",
      setup: () => {
        selPreset.value = "nonoverlap_pass";
        loadPreset();
        doEval();
      },
      check: () =>
        state.kind === "nonoverlap" &&
        state.a[2] === 1 &&
        state.b[3] === 1 &&
        evaluate().status === "pass",
    },
    {
      id: "load-non-fail",
      title: "Load |=> fail",
      prompt: "Load |=> fail and Evaluate → fail.",
      hint: "|=>> fail → Load → Evaluate",
      setup: () => {
        selPreset.value = "nonoverlap_fail";
        loadPreset();
        doEval();
      },
      check: () => state.kind === "nonoverlap" && evaluate().status === "fail",
    },
    {
      id: "vacuous",
      title: "Vacuous",
      prompt: "Load vacuous preset, Evaluate → vacuous.",
      hint: "vacuous → Load → Evaluate",
      setup: () => {
        selPreset.value = "vacuous";
        loadPreset();
        doEval();
      },
      check: () => evaluate().status === "vacuous",
    },
    {
      id: "step",
      title: "Step cursor",
      prompt: "From starter, Step cursor once.",
      hint: "Step cursor",
      setup: () => {
        loadStarter();
        stepCursor();
      },
      check: () => state.cursor === 3 && state.lastAction === "step",
    },
    {
      id: "toggle-a",
      title: "Toggle a",
      prompt: "At cursor, Toggle a — value flips.",
      hint: "Toggle a@cursor",
      setup: () => {
        loadStarter();
        const before = state.a[state.cursor];
        toggleSig("a");
        state._beforeA = before;
      },
      check: () => state.lastAction === "toggle-a",
    },
    {
      id: "toggle-b",
      title: "Toggle b",
      prompt: "Toggle b@cursor.",
      hint: "Toggle b@cursor",
      setup: () => {
        loadStarter();
        toggleSig("b");
      },
      check: () => state.lastAction === "toggle-b",
    },
    {
      id: "demo",
      title: "Demo fail",
      prompt: "Click Demo fail — status fail.",
      hint: "Demo fail",
      setup: () => loadStarter(),
      check: () => state.demoed && evaluate().status === "fail" && state.lastAction === "demo",
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
      id: "prop-overlap",
      title: "Property text",
      prompt: "Starter property line shows |->.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /\|->/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "prop-non",
      title: "Nonoverlap text",
      prompt: "After |=> pass load, property shows |=>.",
      hint: "Load |=> pass",
      setup: () => {
        selPreset.value = "nonoverlap_pass";
        loadPreset();
      },
      check: () => /\|=>/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions vacuous.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /vacuous/i.test(sourceSketch()),
    },
    {
      id: "attempt-count",
      title: "Attempts",
      prompt: "Starter Evaluate has exactly 1 attempt.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => evaluate().attempts.length === 1,
    },
    {
      id: "kind-switch",
      title: "Switch kind",
      prompt: "On overlap_pass wave, set Implication to |=> and Evaluate → fail.",
      hint: "Load |-> pass, switch to |=>, Evaluate",
      setup: () => {
        selPreset.value = "overlap_pass";
        loadPreset();
        selKind.value = "nonoverlap";
        doEval();
      },
      check: () => state.kind === "nonoverlap" && evaluate().status === "fail",
    },
    {
      id: "cursor-btn",
      title: "Cursor t0",
      prompt: "Click timeline button t0.",
      hint: "t0 under wave",
      setup: () => {
        loadStarter();
        setCursor(0);
      },
      check: () => state.cursor === 0 && state.lastAction === "cursor",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to |-> pass @2.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.kind === "overlap" && state.a[2] === 1 && state.b[2] === 1;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="sva-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("sva-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-eval").addEventListener("click", () => doEval());
  document.getElementById("btn-step").addEventListener("click", () => stepCursor());
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
