(() => {
  /**
   * cocotb scoreboard sketch (concept)
   *   expect queue vs observe actual
   * Starter: expect 0xA5, observe 0xA5 → PASS, queue empty
   */

  const IDEAS = {
    expect: "Push expected values onto a FIFO queue before the DUT responds.",
    observe: "When a transaction completes, compare actual to queue front.",
    match: "Match → PASS and pop the front expect.",
    mismatch: "Mismatch or empty queue → FAIL (do not pop on mismatch).",
  };

  const PRESETS = {
    starter: {
      label: "starter: match 0xA5",
      expectQueue: [0xa5],
      observeVal: "0xA5",
      note: "One expect pushed; observe 0xA5 → PASS, queue empty.",
      autoRun: true,
    },
    two_match: {
      label: "two expects both match",
      expectQueue: [0x01, 0x02],
      observeSeq: ["0x01", "0x02"],
      note: "Push two expects; two observes in order → both PASS.",
      autoRun: true,
    },
    mismatch: {
      label: "mismatch 0x5A",
      expectQueue: [0xa5],
      observeVal: "0x5A",
      note: "Expect 0xA5 but observe 0x5A → FAIL, queue unchanged.",
      autoRun: true,
    },
    empty_observe: {
      label: "observe on empty queue",
      expectQueue: [],
      observeVal: "0xA5",
      note: "No expect pushed — observe anything → FAIL (empty queue).",
      autoRun: true,
    },
    triple: {
      label: "triple queue one observe",
      expectQueue: [0x10, 0x20, 0x30],
      observeVal: "0x10",
      note: "Three expects; one matching observe pops front, two remain.",
      autoRun: true,
    },
    multi_fail: {
      label: "second observe fails",
      expectQueue: [0xaa],
      observeSeq: ["0xAA", "0xBB"],
      note: "First observe PASS; second on empty queue → FAIL.",
      autoRun: true,
    },
    idle: {
      label: "idle (push/observe manually)",
      expectQueue: [0xa5],
      observeVal: null,
      note: "Idle — Load a preset or push/observe manually.",
      autoRun: false,
    },
  };

  function sourceSketch() {
    return `# cocotb scoreboard literacy (concept sketch)
# scoreboard = Scoreboard("sb", dut)
#
# scoreboard.expect(0xA5)     # push expected onto queue
# actual = int(dut.data.value)
# scoreboard.compare(actual)  # match front → PASS + pop
#
# expect queue  → FIFO of golden values (order matters)
# observe       → DUT/monitor actual when transaction completes
# match         → PASS, pop front
# mismatch      → FAIL, keep queue for debug
#
# Real cocotb scoreboards add hooks, logging, and reporting.`;
  }

  function hex(n) {
    return "0x" + (Number(n) & 0xff).toString(16).toUpperCase();
  }

  function parseHex(text) {
    const v = parseInt(String(text).replace(/^0x/i, ""), 16);
    return isNaN(v) ? 0 : v & 0xff;
  }

  function pushExpect(queue, val) {
    const q = [...queue, val & 0xff];
    return { queue: q, log: `expect pushed ${hex(val)}` };
  }

  function observeQueue(queue, actual) {
    const q = [...queue];
    const a = actual & 0xff;
    if (!q.length) {
      return {
        queue: q,
        verdict: "FAIL",
        message: `observe ${hex(a)} but expect queue empty`,
        log: `observe ${hex(a)} → FAIL (empty queue)`,
        matched: false,
      };
    }
    const exp = q[0];
    if (exp === a) {
      q.shift();
      return {
        queue: q,
        verdict: "PASS",
        message: `observe ${hex(a)} matched expect ${hex(exp)}${q.length ? ` — ${q.length} left` : " — queue empty"}`,
        log: `observe ${hex(a)} → PASS (pop)`,
        matched: true,
        expected: exp,
      };
    }
    return {
      queue: q,
      verdict: "FAIL",
      message: `observe ${hex(a)} != expect ${hex(exp)}`,
      log: `observe ${hex(a)} → FAIL (mismatch)`,
      matched: false,
      expected: exp,
    };
  }

  function runPresetScenario(p) {
    let queue = [...(p.expectQueue || [])];
    const logs = queue.map((v) => `expect pushed ${hex(v)}`);
    let lastActual = null;
    let verdict = "—";
    let message = "";
    let lastMatched = false;

    if (p.observeSeq) {
      for (const obs of p.observeSeq) {
        const a = parseHex(obs);
        lastActual = a;
        const r = observeQueue(queue, a);
        queue = r.queue;
        verdict = r.verdict;
        message = r.message;
        logs.push(r.log);
        lastMatched = r.matched;
      }
    } else if (p.observeVal != null) {
      const a = parseHex(p.observeVal);
      lastActual = a;
      const r = observeQueue(queue, a);
      queue = r.queue;
      verdict = r.verdict;
      message = r.message;
      logs.push(r.log);
      lastMatched = r.matched;
    } else {
      verdict = queue.length ? "READY" : "EMPTY";
      message = queue.length ? `${queue.length} expect(s) queued` : "Queue empty — push or observe";
    }

    return { queue, logs, lastActual, verdict, message, lastMatched };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const r = runPresetScenario(p);
    return {
      preset: "starter",
      expectQueue: r.queue,
      lastActual: r.lastActual,
      verdict: r.verdict,
      message: r.message,
      note: p.note,
      selected: "expect",
      pushText: "0xA5",
      observeText: "0xA5",
      lastObserved: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: r.logs,
      trace: [`observe: verdict=${r.verdict} queue=${r.queue.length}`],
    };
  }

  const CLEARED_KEY = "ddv-cocotb-scoreboard-cleared-v1";
  const STORE_KEY = "ddv-cocotb-scoreboard-session-v1";

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

  const root = document.getElementById("csb-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        expect <code>0xA5</code>, observe <code>0xA5</code> →
        <strong>PASS</strong>, queue empty.</p>
      <button type="button" class="btn btn-secondary" id="csb-starter">Load starter example</button>
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
        <div class="idea-card"><h3>expect</h3><p>Push golden values onto FIFO queue.</p></div>
        <div class="idea-card"><h3>observe</h3><p>Compare actual when transaction done.</p></div>
        <div class="idea-card"><h3>match</h3><p>PASS and pop front on match.</p></div>
        <div class="idea-card"><h3>mismatch</h3><p>FAIL — queue kept for debug.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="csb-controls">
        <div class="csb-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>match 0xA5</option>
            <option value="two_match">two expects match</option>
            <option value="mismatch">mismatch 0x5A</option>
            <option value="empty_observe">empty queue observe</option>
            <option value="triple">triple queue</option>
            <option value="multi_fail">second observe fails</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="csb-field">
          <label for="inp-push">Push expect</label>
          <input id="inp-push" type="text" value="0xA5" />
        </div>
        <div class="csb-field">
          <label for="inp-observe">Observe actual</label>
          <input id="inp-observe" type="text" value="0xA5" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-push">Push expect</button>
        <button type="button" class="btn btn-secondary" id="btn-observe">Observe actual</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="csb-layout">
        <div class="panel-box">
          <h3>Expect queue</h3>
          <div class="queue-viz" id="queue-viz"></div>
          <h3>Last compare</h3>
          <div class="match-row" id="match-row"></div>
          <h3>Ideas</h3>
          <div class="idea-row" id="idea-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Scoreboard sketch</h3>
          <pre class="sb-box" id="sb-box"></pre>
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
  const inpPush = /** @type {HTMLInputElement} */ (document.getElementById("inp-push"));
  const inpObserve = /** @type {HTMLInputElement} */ (document.getElementById("inp-observe"));

  function sbSketch() {
    const q = state.expectQueue.map(hex).join(", ") || "—";
    return `# scoreboard.expect(${state.pushText})
# actual = ${state.lastObserved && state.lastActual != null ? hex(state.lastActual) : "—"}
# compare → ${state.lastObserved ? state.verdict : "— (Observe)"}
#
# queue: [${q}]
# msg:   ${state.message || "—"}`;
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
    if (document.activeElement !== inpPush) inpPush.value = state.pushText;
    if (document.activeElement !== inpObserve) inpObserve.value = state.observeText;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter match 0xA5 PASS");
    renderAll();
  }

  function doPush(silent) {
    state.pushText = inpPush.value;
    const val = parseHex(state.pushText);
    const r = pushExpect(state.expectQueue, val);
    state.expectQueue = r.queue;
    pushLog(r.log);
    pushTrace(`push: ${hex(val)} queue=${r.queue.length}`);
    if (!silent) {
      state.lastAction = "push";
      state.verdict = "READY";
      state.message = `${r.queue.length} expect(s) queued`;
      renderAll();
    }
  }

  function doObserve(silent) {
    state.observeText = inpObserve.value;
    const a = parseHex(state.observeText);
    const r = observeQueue(state.expectQueue, a);
    state.expectQueue = r.queue;
    state.lastActual = a;
    state.verdict = r.verdict;
    state.message = r.message;
    state.lastObserved = true;
    pushLog(r.log);
    pushTrace(`observe: verdict=${r.verdict} queue=${r.queue.length}`);
    if (!silent) {
      state.lastAction = r.verdict === "PASS" ? "observe-ok" : "observe-bad";
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.note = p.note;
    state.pushText = "0xA5";
    state.observeText = p.observeVal || "0xA5";
    state.lastObserved = false;
    state.lastActual = null;
    state.verdict = "—";
    state.message = "";
    state.log = [];
    syncInputs();
    if (p.autoRun) {
      const r = runPresetScenario(p);
      state.expectQueue = r.queue;
      state.lastActual = r.lastActual;
      state.verdict = r.verdict;
      state.message = r.message;
      state.log = r.logs;
      state.lastObserved = p.observeVal != null || !!p.observeSeq;
      pushTrace(`preset: ${id} verdict=${r.verdict}`);
      if (mark) state.lastAction = mark;
    } else {
      state.expectQueue = [...(p.expectQueue || [])];
      state.log = state.expectQueue.map((v) => `expect pushed ${hex(v)}`);
      if (mark) state.lastAction = mark;
    }
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function demo() {
    applyPreset("mismatch", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo mismatch 0x5A");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: FIFO expect queue; observe compares front; match pops, mismatch fails."
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

    const qviz = document.getElementById("queue-viz");
    if (!state.expectQueue.length) {
      qviz.innerHTML = `<span class="queue-empty">(queue empty)</span>`;
    } else {
      qviz.innerHTML = state.expectQueue
        .map(
          (v, i) =>
            `<span class="queue-chip ${i === 0 ? "is-front" : ""}">${hex(v)}${i === 0 ? " ◀" : ""}</span>`
        )
        .join("");
    }

    const mrow = document.getElementById("match-row");
    if (!state.lastObserved) {
      mrow.innerHTML = `<span class="queue-empty">(Observe to compare)</span>`;
    } else {
      const cls = state.verdict === "PASS" ? "is-pass" : "is-fail";
      mrow.innerHTML = `
        <span class="match-val">expect front</span>
        <span class="match-arrow">vs</span>
        <span class="match-val ${cls}">${state.lastActual != null ? hex(state.lastActual) : "—"}</span>
        <span class="match-arrow">→</span>
        <span class="match-val ${cls}">${state.verdict}</span>`;
    }

    document.getElementById("idea-row").innerHTML = Object.entries(IDEAS)
      .map(
        ([id]) => `
      <button type="button" class="idea-btn ${state.selected === id ? "is-sel" : ""}" data-idea="${id}">
        <div class="k">${id}</div>
        <div class="v">${id === "expect" ? "push" : id === "observe" ? "compare" : id}</div>
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
      IDEAS[state.selected] || IDEAS.expect;
    document.getElementById("sb-box").textContent = sbSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastObserved && state.verdict === "—") {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset, Push, or Observe";
    } else if (state.verdict === "PASS") {
      v.className = "verdict yes";
      v.textContent = state.message || "PASS";
    } else if (state.verdict === "FAIL") {
      v.className = "verdict no";
      v.textContent = state.message || "FAIL";
    } else {
      v.className = "verdict idle";
      v.textContent = state.message || "Ready";
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">queue=${state.expectQueue.length}</span>
      <span class="flag ${state.verdict === "PASS" ? "is-ok" : state.verdict === "FAIL" ? "is-bad" : ""}">verdict=${state.lastObserved ? state.verdict : "—"}</span>
      <span class="flag ${state.lastActual != null ? "is-ok" : ""}">actual=${state.lastActual != null ? hex(state.lastActual) : "—"}</span>
      <span class="flag ${state.expectQueue.length === 0 && state.verdict === "PASS" ? "is-ok" : ""}">empty=${state.expectQueue.length === 0 ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          pushText: state.pushText,
          observeText: state.observeText,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-expect",
      title: "Quiz: expect",
      type: "quiz",
      prompt: "scoreboard.expect(value)…",
      hint: "Push FIFO.",
      choices: [
        "pushes an expected value onto the compare queue",
        "immediately fails the test",
        "starts the clock generator",
        "clears the VCD dump",
      ],
      answer: "pushes an expected value onto the compare queue",
    },
    {
      id: "quiz-match",
      title: "Quiz: match",
      type: "quiz",
      prompt: "When observe matches queue front…",
      hint: "Pop.",
      choices: [
        "PASS and pop the front expect from the queue",
        "FAIL and clear the entire queue",
        "ignore the observe silently",
        "restart the simulator",
      ],
      answer: "PASS and pop the front expect from the queue",
    },
    {
      id: "quiz-mismatch",
      title: "Quiz: mismatch",
      type: "quiz",
      prompt: "When observe != queue front…",
      hint: "FAIL.",
      choices: [
        "FAIL — queue is kept for debug (no pop)",
        "PASS anyway",
        "pop and continue silently",
        "disable cocotb logging",
      ],
      answer: "FAIL — queue is kept for debug (no pop)",
    },
    {
      id: "quiz-empty",
      title: "Quiz: empty queue",
      type: "quiz",
      prompt: "Observing when the expect queue is empty…",
      hint: "FAIL.",
      choices: [
        "FAIL — nothing expected to compare against",
        "PASS by default",
        "push a zero automatically",
        "skip the check",
      ],
      answer: "FAIL — nothing expected to compare against",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — PASS, queue empty.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.verdict === "PASS" &&
        state.expectQueue.length === 0,
    },
    {
      id: "load-two",
      title: "Load two match",
      prompt: "Load two expects — both PASS, queue empty.",
      hint: "two expects match → Load",
      setup: () => {
        selPreset.value = "two_match";
        loadPreset();
      },
      check: () =>
        state.verdict === "PASS" &&
        state.expectQueue.length === 0 &&
        state.lastObserved,
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load mismatch — FAIL, expect still queued.",
      hint: "mismatch → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.verdict === "FAIL" &&
        state.expectQueue.length === 1,
    },
    {
      id: "load-empty",
      title: "Load empty observe",
      prompt: "Load empty queue observe — FAIL.",
      hint: "empty queue → Load",
      setup: () => {
        selPreset.value = "empty_observe";
        loadPreset();
      },
      check: () => state.verdict === "FAIL" && state.expectQueue.length === 0,
    },
    {
      id: "load-triple",
      title: "Load triple",
      prompt: "Load triple — one observe, two remain.",
      hint: "triple queue → Load",
      setup: () => {
        selPreset.value = "triple";
        loadPreset();
      },
      check: () =>
        state.verdict === "PASS" &&
        state.expectQueue.length === 2,
    },
    {
      id: "load-multi-fail",
      title: "Load multi fail",
      prompt: "Load multi fail — second observe FAIL.",
      hint: "second observe fails → Load",
      setup: () => {
        selPreset.value = "multi_fail";
        loadPreset();
      },
      check: () => state.verdict === "FAIL" && state.lastObserved,
    },
    {
      id: "push-manual",
      title: "Push expect",
      prompt: "From idle, Push 0xBB — queue length 1.",
      hint: "idle → Push",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        inpPush.value = "0xBB";
        doPush(false);
      },
      check: () =>
        state.lastAction === "push" &&
        state.expectQueue.length === 1 &&
        state.expectQueue[0] === 0xbb,
    },
    {
      id: "observe-ok",
      title: "Observe OK",
      prompt: "Push 0xCC then Observe 0xCC — PASS.",
      hint: "Push then Observe",
      setup: () => {
        loadStarter();
        state.expectQueue = [];
        state.log = [];
        inpPush.value = "0xCC";
        doPush(true);
        inpObserve.value = "0xCC";
        doObserve(false);
      },
      check: () =>
        state.lastAction === "observe-ok" &&
        state.verdict === "PASS",
    },
    {
      id: "demo",
      title: "Demo mismatch",
      prompt: "Click Demo mismatch.",
      hint: "Demo mismatch",
      setup: () => loadStarter(),
      check: () => state.demoed && state.verdict === "FAIL",
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
      id: "select-observe",
      title: "Select observe",
      prompt: "Click the observe idea card.",
      hint: "Click observe",
      setup: () => {
        loadStarter();
        selectIdea("observe");
      },
      check: () =>
        state.selected === "observe" && state.lastAction === "select",
    },
    {
      id: "select-mismatch",
      title: "Select mismatch",
      prompt: "Click the mismatch idea card.",
      hint: "Click mismatch",
      setup: () => {
        loadStarter();
        selectIdea("mismatch");
      },
      check: () =>
        state.selected === "mismatch" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions expect and compare.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /expect/.test(sourceSketch()) && /compare/.test(sourceSketch()),
    },
    {
      id: "sb-sketch",
      title: "SB sketch",
      prompt: "On starter, scoreboard sketch shows PASS.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /PASS/.test(document.getElementById("sb-box").textContent),
    },
    {
      id: "starter-actual",
      title: "Starter actual",
      prompt: "Starter lastActual is 0xA5.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.lastActual === 0xa5,
    },
    {
      id: "queue-front",
      title: "Queue front",
      prompt: "On triple preset after observe, front is 0x20.",
      hint: "triple queue → Load",
      setup: () => {
        selPreset.value = "triple";
        loadPreset();
      },
      check: () =>
        state.expectQueue.length === 2 &&
        state.expectQueue[0] === 0x20,
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet observed.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () => !state.lastObserved && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From mismatch, Reset — PASS again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.verdict === "PASS" &&
        state.expectQueue.length === 0,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="csb-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("csb-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-push").addEventListener("click", () => doPush(false));
  document.getElementById("btn-observe").addEventListener("click", () => doObserve(false));
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
        state.pushText = saved.pushText || "0xA5";
        state.observeText = saved.observeText || "0xA5";
        state.preset = saved.preset || "starter";
        state.lastObserved = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
