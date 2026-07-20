(() => {
  /**
   * Ring / Johnson counter — 4-bit
   *   ring:     q <= {q[2:0], q[3]}     // circulate; one-hot walks
   *   johnson:  q <= {q[2:0], ~q[3]}    // twisted ring; 2N states
   * Bits shown q3 q2 q1 q0 (MSB left) — shift toward MSB, feedback into q0.
   */

  const W = 4;

  function bitsToStr(bits) {
    // bits[0]=q0 … bits[3]=q3 → display q3..q0
    return [...bits].reverse().map(String).join("");
  }

  function onesCount(bits) {
    return bits.reduce((a, b) => a + b, 0);
  }

  function isOneHot(bits) {
    return onesCount(bits) === 1;
  }

  function makeStarter() {
    return {
      mode: "ring", // ring | johnson
      q: [1, 0, 0, 0], // q0..q3 — ring starts one-hot at q0
      cycle: 0,
      hist: [],
      lastAction: "",
      explained: false,
      stepped: false,
      setRing: false,
      setJohnson: false,
      loaded: false,
      wrapped: false,
      log: [],
      trace: [],
    };
  }

  function nextState(mode, q) {
    const q0 = q[0];
    const q1 = q[1];
    const q2 = q[2];
    const q3 = q[3];
    if (mode === "ring") {
      // shift toward q3: new = {q2,q1,q0,q3} in q3..q0 terms
      // q0' = q3; q1' = q0; q2' = q1; q3' = q2
      return [q3, q0, q1, q2];
    }
    // johnson: q0' = ~q3
    return [q3 ? 0 : 1, q0, q1, q2];
  }

  function sourceCode(mode) {
    if (mode === "ring") {
      return `// Ring — circulate (one-hot walks)
// q <= {q[2:0], q[3]};
always_ff @(posedge clk) begin
  q <= {q[2:0], q[3]};
end
// init e.g. 4'b0001 → 0010 → 0100 → 1000 → 0001`;
    }
    return `// Johnson (twisted ring) — invert feedback
// q <= {q[2:0], ~q[3]};
always_ff @(posedge clk) begin
  q <= {q[2:0], ~q[3]};
end
// 4-bit → 8 distinct states (2N)`;
  }

  function modeLegend(mode) {
    if (mode === "ring")
      return "Feedback = q[MSB]. Period N for one-hot init (here 4).";
    return "Feedback = ~q[MSB]. Period 2N (here 8) from 0000.";
  }

  const CLEARED_KEY = "ddv-ring-johnson-cleared-v1";
  const STORE_KEY = "ddv-ring-johnson-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("rj-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> ring counter with one-hot <code>0001</code> —
        step to walk the 1; switch to Johnson for the twisted sequence.</p>
      <button type="button" class="btn btn-secondary" id="rj-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
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
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Ring</h3>
            <p>Shift + feed MSB back — circulating one-hot (N states).</p>
          </div>
          <div class="idea-card">
            <h3>Johnson</h3>
            <p>Shift + feed <em>inverted</em> MSB — twisted ring (2N states).</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>4-bit counter</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="ring" selected>ring</option>
                <option value="johnson">Johnson</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="chain" id="chain"></div>
          <div class="seq-strip" id="seq-strip"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-step">Step clk ↑</button>
            <button type="button" id="btn-load-ring">Load one-hot 0001</button>
            <button type="button" id="btn-load-zero">Load 0000</button>
            <button type="button" id="btn-ring">Preset ring</button>
            <button type="button" id="btn-johnson">Preset Johnson</button>
            <button type="button" id="btn-full-ring">Run full ring period</button>
            <button type="button" id="btn-full-j">Run Johnson 8 states</button>
            <button type="button" id="btn-demo">Demo: ring vs Johnson</button>
            <button type="button" id="btn-explain">Explain feedback</button>
            <button type="button" id="btn-reset">Reset hist</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>q[3:0]</h3>
              <p class="val" id="val-q">—</p>
              <p class="note" id="note-q"></p>
            </div>
            <div class="status-card">
              <h3>Cycle / ones</h3>
              <p class="val" id="val-c">—</p>
              <p class="note" id="note-c"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th></th><th>Ring</th><th>Johnson</th></tr></thead>
          <tbody>
            <tr><td>Feedback</td><td>q[MSB]</td><td>~q[MSB]</td></tr>
            <tr><td>Useful states</td><td>N (one-hot)</td><td>2N</td></tr>
            <tr><td>Init</td><td>one-hot</td><td>often all-0</td></tr>
            <tr><td>Lock risk</td><td>all-0 stuck</td><td>illegal pairs</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Display is q3…q0 left→right; shift feeds into q0.</li>
          <li>Ring all-0: feedback 0 forever — need valid init / self-correct.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = /** @type {HTMLSelectElement} */ (document.getElementById("mode-sel"));
  const modeLegendEl = document.getElementById("mode-legend");
  const chain = document.getElementById("chain");
  const seqStrip = document.getElementById("seq-strip");
  const codeBox = document.getElementById("code-box");
  const valQ = document.getElementById("val-q");
  const noteQ = document.getElementById("note-q");
  const valC = document.getElementById("val-c");
  const noteC = document.getElementById("note-c");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function pushLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function applyModeFlags() {
    if (state.mode === "ring") state.setRing = true;
    if (state.mode === "johnson") state.setJohnson = true;
  }

  function stepOnce() {
    const prev = state.q.slice();
    const next = nextState(state.mode, state.q);
    state.q = next;
    state.cycle += 1;
    state.stepped = true;
    state.hist.push(bitsToStr(next));
    if (state.hist.length > 16) state.hist.shift();
    if (state.mode === "ring" && bitsToStr(next) === "0001" && state.cycle >= 4) {
      state.wrapped = true;
    }
    if (state.mode === "johnson" && bitsToStr(next) === "0000" && state.cycle >= 8) {
      state.wrapped = true;
    }
    state.lastAction = "step";
    pushTrace(
      `t${state.cycle}: ${bitsToStr(prev)} → ${bitsToStr(next)} (${state.mode})`
    );
    pushLog(`# step → ${bitsToStr(state.q)}`);
  }

  function stepPosedge() {
    stepOnce();
    renderAll();
  }

  function loadPattern(bits, label) {
    state.q = bits.slice();
    state.loaded = true;
    state.cycle = 0;
    state.hist = [bitsToStr(state.q)];
    state.lastAction = "load";
    pushLog(`# load ${label} → ${bitsToStr(state.q)}`);
    renderAll();
  }

  function runFullRing() {
    state.mode = "ring";
    state.setRing = true;
    state.q = [1, 0, 0, 0];
    state.cycle = 0;
    state.hist = [bitsToStr(state.q)];
    state.trace = [];
    for (let i = 0; i < 4; i++) stepOnce();
    state.wrapped = true;
    state.lastAction = "full-ring";
    pushLog("# full ring period (4)");
    renderAll();
  }

  function runFullJohnson() {
    state.mode = "johnson";
    state.setJohnson = true;
    state.q = [0, 0, 0, 0];
    state.cycle = 0;
    state.hist = [bitsToStr(state.q)];
    state.trace = [];
    for (let i = 0; i < 8; i++) stepOnce();
    state.wrapped = true;
    state.lastAction = "full-johnson";
    pushLog("# Johnson 8-state tour");
    renderAll();
  }

  function runDemo() {
    state.mode = "ring";
    state.setRing = true;
    state.setJohnson = true;
    state.q = [1, 0, 0, 0];
    state.cycle = 0;
    state.hist = [];
    state.trace = [];
    const ringSeq = [];
    for (let i = 0; i < 4; i++) {
      stepOnce();
      ringSeq.push(bitsToStr(state.q));
    }
    state.mode = "johnson";
    state.q = [0, 0, 0, 0];
    state.cycle = 0;
    const jSeq = ["0000"];
    for (let i = 0; i < 8; i++) {
      stepOnce();
      jSeq.push(bitsToStr(state.q));
    }
    state.lastAction = "demo";
    pushTrace(`demo ring: ${ringSeq.join(" → ")}`);
    pushTrace(`demo johnson: ${jSeq.join(" → ")}`);
    pushLog("# demo ring vs Johnson sequences");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# ring=q[MSB] · johnson=~q[MSB] · periods N vs 2N");
    pushTrace("explain: same shift register, different feedback tap");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setRing = true;
    state.hist = [bitsToStr(state.q)];
    state.lastAction = "starter";
    pushLog("# starter ring 0001");
    renderAll();
  }

  function renderChain() {
    const fb =
      state.mode === "ring"
        ? `fb=q3=${state.q[3]}`
        : `fb=~q3=${state.q[3] ? 0 : 1}`;
    const fbCls = state.mode === "johnson" ? "is-not" : "";
    let html = `<div class="fb-box ${fbCls}">${fb}<br>→ q0</div><span class="chain-arrow">→</span>`;
    for (let i = 0; i < W; i++) {
      if (i > 0) html += `<span class="chain-arrow">→</span>`;
      const b = state.q[i];
      html += `<div class="ff-cell ${b ? "is-hi" : ""}"><h3>q${i}</h3><p class="bit">${b}</p></div>`;
    }
    html += `<span class="chain-arrow">↻</span>`;
    chain.innerHTML = html;
  }

  function renderSeq() {
    const list = state.hist.length ? state.hist : [bitsToStr(state.q)];
    seqStrip.innerHTML = list
      .map((s, i) => {
        const cur = i === list.length - 1 ? "is-cur" : "";
        return `<span class="${cur}">${s}</span>`;
      })
      .join("");
  }

  function renderAll() {
    modeSel.value = state.mode;
    modeLegendEl.textContent = modeLegend(state.mode);
    codeBox.textContent = sourceCode(state.mode);
    renderChain();
    renderSeq();

    valQ.textContent = bitsToStr(state.q);
    noteQ.textContent = isOneHot(state.q)
      ? "one-hot ✓"
      : onesCount(state.q) === 0
        ? "all-zero"
        : `${onesCount(state.q)} ones`;
    valC.textContent = `${state.cycle} / ${onesCount(state.q)}`;
    noteC.textContent =
      state.mode === "ring" ? "period aim 4 (one-hot)" : "period aim 8";

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no steps";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ mode: state.mode, q: state.q })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("rj-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    applyModeFlags();
    state.lastAction = "mode";
    pushLog(`# mode → ${state.mode}`);
    renderAll();
  });

  document.getElementById("btn-step").addEventListener("click", stepPosedge);

  document.getElementById("btn-load-ring").addEventListener("click", () => {
    loadPattern([1, 0, 0, 0], "one-hot");
  });

  document.getElementById("btn-load-zero").addEventListener("click", () => {
    loadPattern([0, 0, 0, 0], "0000");
  });

  function preset(mode, flag) {
    state.mode = mode;
    state[flag] = true;
    applyModeFlags();
    if (mode === "ring") state.q = [1, 0, 0, 0];
    else state.q = [0, 0, 0, 0];
    state.cycle = 0;
    state.hist = [bitsToStr(state.q)];
    state.lastAction = `preset-${mode}`;
    pushLog(`# preset ${mode}`);
    renderAll();
  }

  document.getElementById("btn-ring").addEventListener("click", () => preset("ring", "setRing"));
  document
    .getElementById("btn-johnson")
    .addEventListener("click", () => preset("johnson", "setJohnson"));
  document.getElementById("btn-full-ring").addEventListener("click", runFullRing);
  document.getElementById("btn-full-j").addEventListener("click", runFullJohnson);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-reset").addEventListener("click", () => {
    state.hist = [bitsToStr(state.q)];
    state.cycle = 0;
    state.lastAction = "reset-hist";
    pushLog("# hist reset");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-ring",
      title: "Quiz: ring",
      prompt: "Circulating one-hot counter is a? Answer: <code>ring</code>",
      hint: "feedback = MSB",
      type: "text",
      answer: "ring",
      alt: ["ring counter"],
    },
    {
      id: "quiz-johnson",
      title: "Quiz: Johnson",
      prompt: "Twisted-ring counter is a? Answer: <code>Johnson</code>",
      hint: "inverted feedback",
      type: "text",
      answer: "johnson",
      alt: ["johnson counter", "twisted ring", "twisted-ring"],
    },
    {
      id: "quiz-period-ring",
      title: "Quiz: period N",
      prompt: "N-bit one-hot ring useful period? Answer: <code>N</code>",
      hint: "4-bit → 4",
      type: "text",
      answer: "n",
      alt: ["N", "4", "length"],
    },
    {
      id: "quiz-period-j",
      title: "Quiz: period 2N",
      prompt: "N-bit Johnson useful period? Answer: <code>2N</code>",
      hint: "4-bit → 8",
      type: "text",
      answer: "2n",
      alt: ["2N", "8", "2*n"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — ring, pattern 0001.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "ring" &&
        state.setRing &&
        bitsToStr(state.q) === "0001",
    },
    {
      id: "preset-ring",
      title: "Preset ring",
      prompt: "Preset ring.",
      hint: "Preset ring",
      type: "state",
      setup: () => {
        state.mode = "johnson";
        renderAll();
      },
      check: () =>
        state.setRing &&
        state.mode === "ring" &&
        state.lastAction === "preset-ring",
    },
    {
      id: "preset-johnson",
      title: "Preset Johnson",
      prompt: "Preset Johnson.",
      hint: "Preset Johnson",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setJohnson && state.mode === "johnson",
    },
    {
      id: "step",
      title: "Step",
      prompt: "Step clk ↑ at least once.",
      hint: "Step clk ↑",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cycle >= 1,
    },
    {
      id: "ring-walk",
      title: "Ring walk",
      prompt: "Ring from 0001: step once → 0010.",
      hint: "Load one-hot → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "ring";
        state.q = [1, 0, 0, 0];
        state.cycle = 0;
        renderAll();
      },
      check: () =>
        state.mode === "ring" && bitsToStr(state.q) === "0010" && state.cycle >= 1,
    },
    {
      id: "full-ring",
      title: "Full ring",
      prompt: "Run full ring period — back to one-hot cycle done.",
      hint: "Run full ring period",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "full-ring" &&
        state.mode === "ring" &&
        bitsToStr(state.q) === "0001" &&
        state.wrapped,
    },
    {
      id: "johnson-step",
      title: "Johnson step",
      prompt: "Johnson from 0000: step once → 0001.",
      hint: "Preset Johnson → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "johnson";
        state.setJohnson = true;
        state.q = [0, 0, 0, 0];
        state.cycle = 0;
        renderAll();
      },
      check: () =>
        state.mode === "johnson" &&
        bitsToStr(state.q) === "0001" &&
        state.cycle >= 1,
    },
    {
      id: "full-johnson",
      title: "Full Johnson",
      prompt: "Run Johnson 8 states — ends at 0000.",
      hint: "Run Johnson 8 states",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "full-johnson" &&
        state.mode === "johnson" &&
        bitsToStr(state.q) === "0000" &&
        state.cycle === 8,
    },
    {
      id: "load-onehot",
      title: "Load one-hot",
      prompt: "Load one-hot 0001.",
      hint: "Load one-hot 0001",
      type: "state",
      setup: () => {
        loadStarter();
        state.q = [0, 0, 0, 0];
        renderAll();
      },
      check: () =>
        state.loaded &&
        bitsToStr(state.q) === "0001" &&
        state.lastAction === "load",
    },
    {
      id: "stuck-zero",
      title: "Stuck zero",
      prompt: "Ring mode, load 0000, step — still 0000 (stuck).",
      hint: "Preset ring → Load 0000 → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "ring";
        state.setRing = true;
        renderAll();
      },
      check: () =>
        state.mode === "ring" &&
        bitsToStr(state.q) === "0000" &&
        state.cycle >= 1,
    },
    {
      id: "one-hot-check",
      title: "One-hot",
      prompt: "Have a one-hot pattern on screen (exactly one 1).",
      hint: "Load one-hot or step ring",
      type: "state",
      setup: () => {
        loadStarter();
        state.q = [0, 0, 0, 0];
        renderAll();
      },
      check: () => isOneHot(state.q),
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: ring vs Johnson.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" &&
        state.setRing &&
        state.setJohnson,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain feedback.",
      hint: "Explain feedback",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "mode-johnson",
      title: "Mode Johnson",
      prompt: "Switch Mode dropdown to Johnson.",
      hint: "Mode select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "johnson" && state.lastAction === "mode",
    },
    {
      id: "code-ring",
      title: "Code ring",
      prompt: "Ring source has <code>q[3]</code> feedback (no ~).",
      hint: "Preset ring",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "ring" &&
        sourceCode(state.mode).includes("{q[2:0], q[3]}") &&
        !sourceCode(state.mode).includes("~q[3]"),
    },
    {
      id: "code-johnson",
      title: "Code Johnson",
      prompt: "Johnson source has <code>~q[3]</code>.",
      hint: "Preset Johnson",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "johnson" &&
        sourceCode(state.mode).includes("~q[3]"),
    },
    {
      id: "fb-invert",
      title: "FB invert",
      prompt: "Johnson mode showing fb=~q3 in the diagram.",
      hint: "Preset Johnson",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "johnson" &&
        chain.textContent.includes("~q3"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.explained &&
        state.lastAction === "explain" &&
        state.setJohnson,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function setStatus(kind, text) {
    const el = document.getElementById("chal-status");
    el.className = `challenge-status ${kind}`;
    el.textContent = text;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (isCleared(ch.id) ? " · cleared" : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}.</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? `Hint: ${ch.hint}` : "";
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      ansRow.innerHTML = `<label class="sr-only" for="chal-answer">Answer</label>
        <input type="text" id="chal-answer" class="chal-input" autocomplete="off" placeholder="Type answer…">`;
      const inp = /** @type {HTMLInputElement} */ (document.getElementById("chal-answer"));
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
    } else {
      ansRow.innerHTML = "";
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = CHALLENGES.map((c, i) => {
      const cls = [
        "kbd",
        i === challengeIdx ? "is-active" : "",
        isCleared(c.id) ? "is-cleared" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-chal="${i}">${c.id}</button>`;
    }).join(" ");
    cat.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        challengeIdx = Number(btn.getAttribute("data-chal"));
        showHint = false;
        answerDraft = "";
        setStatus("idle", "Idle");
        const next = CHALLENGES[challengeIdx];
        if (next.setup) next.setup();
        renderChallenge();
      });
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });

  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setStatus("idle", "Idle");
    const next = CHALLENGES[challengeIdx];
    if (next.setup) next.setup();
    renderChallenge();
  });

  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const got = normalizeAns(answerDraft);
      const want = normalizeAns(ch.answer);
      const alts = (ch.alt || []).map(normalizeAns);
      ok = got === want || alts.includes(got);
    } else {
      ok = !!ch.check();
    }
    if (ok) {
      markCleared(ch.id);
      setStatus("ok", "Cleared");
    } else {
      setStatus("bad", "Not yet");
    }
    renderChallenge();
  });

  loadStarter();
  renderChallenge();
})();
