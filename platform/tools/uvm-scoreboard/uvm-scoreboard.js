(() => {
  /**
   * Scoreboard expect/actual (concept)
   *   predict → expectQ · observe → actualQ · compare
   * Starter: expect=[0xA5], actual=[0xA5] → PASS
   */

  const PRESETS = {
    starter: {
      label: "starter: match 0xA5",
      expect: ["0xA5"],
      actual: ["0xA5"],
      note: "One predicted and one observed beat — ready to Compare → PASS.",
    },
    mismatch: {
      label: "mismatch",
      expect: ["0xA5"],
      actual: ["0x5A"],
      note: "Expect and actual differ — Compare → FAIL.",
    },
    orphan_exp: {
      label: "orphan expect",
      expect: ["0xA5"],
      actual: [],
      note: "Predicted but never observed — leftover expect after compare.",
    },
    orphan_act: {
      label: "orphan actual",
      expect: [],
      actual: ["0xA5"],
      note: "Observed with no prediction — leftover actual.",
    },
    empty: {
      label: "empty queues",
      expect: [],
      actual: [],
      note: "Nothing to compare yet.",
    },
  };

  function sourceSketch() {
    return `// Scoreboard literacy (not a full UVM scoreboard class)
// expect  = predicted txn (from model / stimulus mirror)
// actual  = observed txn (from monitor analysis_port.write)
// compare = pop front of both queues; match or report error
//
// Common shape:
//   write_exp(t)  → expect_q.push(t)
//   write_act(t)  → actual_q.push(t); try_compare()
//   check_phase   → fail if queues non-empty (orphans)
//
// This lab: Push expect / Push actual / Compare / Clear.`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      expect: [...p.expect],
      actual: [...p.actual],
      note: p.note,
      dataIn: "0xA5",
      selected: "expect",
      lastVerdict: null,
      lastDetail: "",
      matches: 0,
      mismatches: 0,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-scoreboard-cleared-v1";
  const STORE_KEY = "ddv-uvm-scoreboard-session-v1";

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

  const root = document.getElementById("usb-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> expect and actual both hold
        <code>0xA5</code> — Compare should PASS.</p>
      <button type="button" class="btn btn-secondary" id="usb-starter">Load starter example</button>
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
        <div class="idea-card"><h3>expect</h3><p>Predicted transaction from a model or stimulus mirror.</p></div>
        <div class="idea-card"><h3>actual</h3><p>Observed transaction from the monitor.</p></div>
        <div class="idea-card"><h3>compare</h3><p>Pop fronts; match or report mismatch.</p></div>
        <div class="idea-card"><h3>orphans</h3><p>Leftover expect or actual at end of test is a bug.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="usb-controls">
        <div class="usb-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>match 0xA5</option>
            <option value="mismatch">mismatch</option>
            <option value="orphan_exp">orphan expect</option>
            <option value="orphan_act">orphan actual</option>
            <option value="empty">empty</option>
          </select>
        </div>
        <div class="usb-field">
          <label for="inp-data">Txn data</label>
          <input id="inp-data" type="text" value="0xA5" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-push-exp">Push expect</button>
        <button type="button" class="btn btn-secondary" id="btn-push-act">Push actual</button>
        <button type="button" class="btn btn-secondary" id="btn-compare">Compare</button>
        <button type="button" class="btn btn-ghost" id="btn-clear">Clear queues</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="usb-layout">
        <div class="panel-box">
          <h3>Pipeline</h3>
          <div class="pipe-row" id="pipe-row"></div>
          <h3 style="margin-top:0.5rem">Expect queue</h3>
          <div class="queue-list" id="q-expect"></div>
          <h3>Actual queue</h3>
          <div class="queue-list" id="q-actual"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected stage</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Compare sketch</h3>
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
  const inpData = /** @type {HTMLInputElement} */ (document.getElementById("inp-data"));

  function fmtQ(q) {
    return q.length ? q.map((d, i) => `[${i}] ${d}`).join("\n") : "(empty)";
  }

  function codeSketch() {
    return `// queues
expect = [${state.expect.join(", ")}]
actual = [${state.actual.join(", ")}]
// last compare: ${state.lastVerdict ?? "—"} ${state.lastDetail}
// tallies: match=${state.matches} mismatch=${state.mismatches}
//
// try_compare():
//   if both empty → idle
//   if one empty → orphan (leave leftover)
//   else pop both; equal → PASS else FAIL`;
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
    inpData.value = state.dataIn;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter match 0xA5");
    pushTrace("expect=[0xA5] actual=[0xA5]");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.expect = [...p.expect];
    state.actual = [...p.actual];
    state.note = p.note;
    state.lastVerdict = null;
    state.lastDetail = "";
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function pushExpect() {
    const d = (inpData.value || "").trim() || "0x00";
    state.dataIn = d;
    state.expect = [...state.expect, d];
    state.lastVerdict = null;
    state.lastAction = "push-exp";
    pushLog(`# push expect ${d}`);
    pushTrace(`expect ← ${d}`);
    renderAll();
  }

  function pushActual() {
    const d = (inpData.value || "").trim() || "0x00";
    state.dataIn = d;
    state.actual = [...state.actual, d];
    state.lastVerdict = null;
    state.lastAction = "push-act";
    pushLog(`# push actual ${d}`);
    pushTrace(`actual ← ${d}`);
    renderAll();
  }

  function compare() {
    if (!state.expect.length && !state.actual.length) {
      state.lastVerdict = "empty";
      state.lastDetail = "both queues empty";
      state.lastAction = "compare-empty";
      pushLog("# compare empty");
      pushTrace("compare: nothing");
      renderAll();
      return;
    }
    if (!state.expect.length) {
      state.lastVerdict = "orphan_act";
      state.lastDetail = `actual leftover ${state.actual[0]}`;
      state.lastAction = "compare-orphan";
      pushLog("# compare orphan actual");
      pushTrace(`orphan actual ${state.actual[0]}`);
      renderAll();
      return;
    }
    if (!state.actual.length) {
      state.lastVerdict = "orphan_exp";
      state.lastDetail = `expect leftover ${state.expect[0]}`;
      state.lastAction = "compare-orphan";
      pushLog("# compare orphan expect");
      pushTrace(`orphan expect ${state.expect[0]}`);
      renderAll();
      return;
    }
    const e = state.expect[0];
    const a = state.actual[0];
    state.expect = state.expect.slice(1);
    state.actual = state.actual.slice(1);
    if (e === a) {
      state.matches += 1;
      state.lastVerdict = "pass";
      state.lastDetail = `${e} == ${a}`;
      state.lastAction = "compare-pass";
      pushLog(`# compare PASS ${e}`);
      pushTrace(`PASS ${e}`);
    } else {
      state.mismatches += 1;
      state.lastVerdict = "fail";
      state.lastDetail = `${e} != ${a}`;
      state.lastAction = "compare-fail";
      pushLog(`# compare FAIL ${e} vs ${a}`);
      pushTrace(`FAIL expect=${e} actual=${a}`);
    }
    renderAll();
  }

  function clearQueues() {
    state.expect = [];
    state.actual = [];
    state.lastVerdict = null;
    state.lastDetail = "";
    state.lastAction = "clear";
    pushLog("# clear queues");
    renderAll();
  }

  function demo() {
    state.preset = "mismatch";
    state.expect = ["0xA5"];
    state.actual = ["0x5A"];
    state.note = PRESETS.mismatch.note;
    state.demoed = true;
    syncInputs();
    compare();
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo mismatch");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: predict into expect; monitor into actual; " +
        "compare fronts; leftover queues at end = orphans."
    );
    renderAll();
  }

  function selectStage(which) {
    state.selected = which;
    state.lastAction = "select";
    renderAll();
  }

  const STAGE_BLURB = {
    expect: "Expect queue holds predicted transactions waiting for an observation.",
    actual: "Actual queue holds monitored transactions waiting to be checked.",
    compare: "Compare pops one from each queue and checks equality (concept model).",
  };

  function renderLab() {
    syncInputs();
    const row = document.getElementById("pipe-row");
    row.innerHTML = `
      <button type="button" class="pipe-box ${state.selected === "expect" ? "is-sel" : ""}" data-stage="expect">
        <div class="k">predict</div><div class="v">expect[${state.expect.length}]</div>
      </button>
      <div class="pipe-arrow">→</div>
      <button type="button" class="pipe-box ${state.selected === "actual" ? "is-sel" : ""}" data-stage="actual">
        <div class="k">observe</div><div class="v">actual[${state.actual.length}]</div>
      </button>
      <div class="pipe-arrow">→</div>
      <button type="button" class="pipe-box ${state.selected === "compare" ? "is-sel" : ""}" data-stage="compare">
        <div class="k">check</div><div class="v">${state.lastVerdict ?? "—"}</div>
      </button>
    `;
    row.querySelectorAll("[data-stage]").forEach((el) => {
      el.addEventListener("click", () =>
        selectStage(/** @type {string} */ (el.getAttribute("data-stage")))
      );
    });

    document.getElementById("q-expect").textContent = fmtQ(state.expect);
    document.getElementById("q-actual").textContent = fmtQ(state.actual);
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      STAGE_BLURB[state.selected] || STAGE_BLURB.expect;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    const lv = state.lastVerdict;
    if (lv === "pass") {
      v.className = "verdict yes";
      v.textContent = `PASS — ${state.lastDetail}`;
    } else if (lv === "fail") {
      v.className = "verdict no";
      v.textContent = `FAIL — ${state.lastDetail}`;
    } else if (lv === "orphan_exp" || lv === "orphan_act") {
      v.className = "verdict warn";
      v.textContent = `Orphan — ${state.lastDetail}`;
    } else if (lv === "empty") {
      v.className = "verdict warn";
      v.textContent = "Both queues empty — nothing to compare";
    } else {
      v.className = "verdict idle";
      v.textContent =
        state.expect.length || state.actual.length
          ? `Ready — expect=${state.expect.length} actual=${state.actual.length}`
          : "Idle — load starter or push transactions";
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">exp=${state.expect.length}</span>
      <span class="flag is-on">act=${state.actual.length}</span>
      <span class="flag ${state.matches ? "is-ok" : ""}">match=${state.matches}</span>
      <span class="flag ${state.mismatches ? "is-bad" : ""}">mismatch=${state.mismatches}</span>
      <span class="flag ${lv === "pass" ? "is-ok" : lv === "fail" ? "is-bad" : ""}">last=${lv ?? "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          expect: state.expect,
          actual: state.actual,
          matches: state.matches,
          mismatches: state.mismatches,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-role",
      title: "Quiz: role",
      type: "quiz",
      prompt: "A scoreboard’s main job is to…",
      hint: "Predict vs observe.",
      choices: [
        "compare predicted (expect) vs observed (actual) transactions",
        "synthesize the DUT netlist",
        "replace the sequencer entirely",
        "set the simulator timescale",
      ],
      answer: "compare predicted (expect) vs observed (actual) transactions",
    },
    {
      id: "quiz-expect",
      title: "Quiz: expect",
      type: "quiz",
      prompt: "The expect side usually comes from…",
      hint: "Model / stimulus.",
      choices: [
        "a predictor / model or stimulus mirror",
        "only $dumpvars",
        "factory type overrides only",
        "VCD cursor literacy",
      ],
      answer: "a predictor / model or stimulus mirror",
    },
    {
      id: "quiz-actual",
      title: "Quiz: actual",
      type: "quiz",
      prompt: "Actual transactions typically arrive via…",
      hint: "Monitor.",
      choices: [
        "monitor analysis (observed bus activity)",
        "connect_phase port.create only",
        "plusargs exclusively",
        "Makefile PHONY targets",
      ],
      answer: "monitor analysis (observed bus activity)",
    },
    {
      id: "quiz-orphan",
      title: "Quiz: orphan",
      type: "quiz",
      prompt: "Leftover items in expect or actual at end of test usually mean…",
      hint: "Bug.",
      choices: [
        "a check failure (missing observe or missing predict)",
        "a successful PASS always",
        "that phases were skipped legally",
        "that ConfigDB was unused",
      ],
      answer: "a check failure (missing observe or missing predict)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — both queues hold 0xA5.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.expect.length === 1 &&
        state.expect[0] === "0xA5" &&
        state.actual[0] === "0xA5",
    },
    {
      id: "compare-pass",
      title: "Compare PASS",
      prompt: "On starter, Compare — last=pass.",
      hint: "Compare",
      setup: () => {
        loadStarter();
        compare();
      },
      check: () => state.lastVerdict === "pass" && state.lastAction === "compare-pass",
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load mismatch preset — expect 0xA5, actual 0x5A.",
      hint: "mismatch → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.expect[0] === "0xA5" &&
        state.actual[0] === "0x5A" &&
        state.lastAction === "load",
    },
    {
      id: "compare-fail",
      title: "Compare FAIL",
      prompt: "From mismatch, Compare — last=fail.",
      hint: "Load mismatch → Compare",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
        compare();
      },
      check: () => state.lastVerdict === "fail" && state.lastAction === "compare-fail",
    },
    {
      id: "orphan-exp",
      title: "Orphan expect",
      prompt: "Load orphan expect, Compare — orphan_exp.",
      hint: "orphan expect → Load → Compare",
      setup: () => {
        selPreset.value = "orphan_exp";
        loadPreset();
        compare();
      },
      check: () =>
        state.lastVerdict === "orphan_exp" && state.lastAction === "compare-orphan",
    },
    {
      id: "orphan-act",
      title: "Orphan actual",
      prompt: "Load orphan actual, Compare — orphan_act.",
      hint: "orphan actual → Load → Compare",
      setup: () => {
        selPreset.value = "orphan_act";
        loadPreset();
        compare();
      },
      check: () =>
        state.lastVerdict === "orphan_act" && state.lastAction === "compare-orphan",
    },
    {
      id: "push-exp",
      title: "Push expect",
      prompt: "From empty, Push expect with 0xA5.",
      hint: "empty → Load → Push expect",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        inpData.value = "0xA5";
        pushExpect();
      },
      check: () =>
        state.expect.length === 1 &&
        state.expect[0] === "0xA5" &&
        state.lastAction === "push-exp",
    },
    {
      id: "push-act",
      title: "Push actual",
      prompt: "From empty, Push actual with 0xA5.",
      hint: "empty → Load → Push actual",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        inpData.value = "0xA5";
        pushActual();
      },
      check: () =>
        state.actual.length === 1 &&
        state.actual[0] === "0xA5" &&
        state.lastAction === "push-act",
    },
    {
      id: "clear",
      title: "Clear",
      prompt: "From starter, Clear queues — both empty.",
      hint: "Clear queues",
      setup: () => {
        loadStarter();
        clearQueues();
      },
      check: () =>
        !state.expect.length &&
        !state.actual.length &&
        state.lastAction === "clear",
    },
    {
      id: "compare-empty",
      title: "Compare empty",
      prompt: "Clear then Compare — last=empty.",
      hint: "Clear → Compare",
      setup: () => {
        clearQueues();
        compare();
      },
      check: () =>
        state.lastVerdict === "empty" && state.lastAction === "compare-empty",
    },
    {
      id: "demo",
      title: "Demo mismatch",
      prompt: "Click Demo mismatch — fail after compare.",
      hint: "Demo mismatch",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.lastVerdict === "fail" &&
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
      id: "select-compare",
      title: "Select compare",
      prompt: "Click the check / compare stage.",
      hint: "Click right pipe box",
      setup: () => {
        loadStarter();
        selectStage("compare");
      },
      check: () => state.selected === "compare" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions orphan.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /orphan/i.test(sourceSketch()),
    },
    {
      id: "sketch-queues",
      title: "Sketch queues",
      prompt: "Compare sketch lists expect = [.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /expect = \[/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "tally-match",
      title: "Tally match",
      prompt: "After a PASS compare from starter, match≥1.",
      hint: "Starter → Compare",
      setup: () => {
        loadStarter();
        state.matches = 0;
        compare();
      },
      check: () => state.matches >= 1 && state.lastVerdict === "pass",
    },
    {
      id: "queues-pop",
      title: "Queues pop",
      prompt: "After PASS compare on starter, both queues empty.",
      hint: "Compare consumes fronts",
      setup: () => {
        loadStarter();
        compare();
      },
      check: () =>
        !state.expect.length &&
        !state.actual.length &&
        state.lastVerdict === "pass",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From empty, Reset — both hold 0xA5 again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.expect[0] === "0xA5" &&
        state.actual[0] === "0xA5",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="usb-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("usb-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-push-exp").addEventListener("click", () => pushExpect());
  document.getElementById("btn-push-act").addEventListener("click", () => pushActual());
  document.getElementById("btn-compare").addEventListener("click", () => compare());
  document.getElementById("btn-clear").addEventListener("click", () => clearQueues());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  inpData.addEventListener("change", () => {
    state.dataIn = inpData.value;
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
      if (saved && Array.isArray(saved.expect)) {
        state.expect = saved.expect;
        state.actual = saved.actual || [];
        state.matches = saved.matches || 0;
        state.mismatches = saved.mismatches || 0;
        state.preset = saved.preset || "starter";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
