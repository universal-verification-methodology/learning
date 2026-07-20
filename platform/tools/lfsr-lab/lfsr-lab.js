(() => {
  /**
   * LFSR / PRBS stepper — Fibonacci form
   *   q is q[n-1:0] with q[0] = LSB (rightmost in display q[n-1]…q[0])
   *   feedback = XOR of tap bits (1-indexed from MSB in poly notation)
   *   shift: q <= {feedback, q[n-1:1]}  — new bit enters MSB… wait
   *
   * Teaching convention (common):
   *   Display left = q[n-1] (MSB), right = q[0] (LSB / often PRBS out)
   *   feedback = XOR taps; shift toward LSB: q <= {feedback, q[n-1:1]}
   *   so new bit enters at MSB, LSB falls out as PRBS.
   *
   * Polys (maximal unless noted):
   *   n4_max:  x^4 + x + 1     taps MSB-relative 4,1 → indices n-1 and 0
   *   n4_short: x^4 + x^2 + 1  shorter period (6) for contrast
   *   n5_max:  x^5 + x^2 + 1
   */

  const POLYS = {
    n4_max: {
      id: "n4_max",
      label: "4-bit maximal x⁴+x+1",
      n: 4,
      // tap positions 1-indexed from MSB (bit n..1): [4,1]
      tapsFromMsb: [4, 1],
      maximal: true,
      maxPeriod: 15,
    },
    n4_short: {
      id: "n4_short",
      label: "4-bit short x⁴+x²+1",
      n: 4,
      tapsFromMsb: [4, 2],
      maximal: false,
      maxPeriod: 15,
    },
    n5_max: {
      id: "n5_max",
      label: "5-bit maximal x⁵+x²+1",
      n: 5,
      tapsFromMsb: [5, 2],
      maximal: true,
      maxPeriod: 31,
    },
  };

  function tapsToIndices(poly) {
    // Convert 1-indexed-from-MSB to 0-indexed in q[n-1:0]
    // MSB index = n-1; tap k from MSB → index (n - k)
    return poly.tapsFromMsb.map((k) => poly.n - k);
  }

  function bitsToStr(q) {
    // q[0]=LSB … display MSB…LSB
    return [...q].reverse().map(String).join("");
  }

  function strToBits(s, n) {
    const cleaned = s.replace(/[^01]/g, "").padStart(n, "0").slice(-n);
    const msbFirst = cleaned.split("").map(Number);
    return msbFirst.reverse(); // to q[0]=LSB
  }

  function feedbackOf(q, poly) {
    const idxs = tapsToIndices(poly);
    return idxs.reduce((acc, i) => acc ^ q[i], 0);
  }

  function stepLfsr(q, poly) {
    const fb = feedbackOf(q, poly);
    const n = poly.n;
    // q' = {fb, q[n-1:1]} with q[0]=LSB: new MSB = fb, shift toward LSB
    const next = new Array(n);
    next[n - 1] = fb;
    for (let i = n - 2; i >= 0; i--) next[i] = q[i + 1];
    const prbs = q[0]; // bit shifted out
    return { next, fb, prbs };
  }

  function sourceCode(poly) {
    const idxs = tapsToIndices(poly);
    const xorExpr = idxs.map((i) => `q[${i}]`).join(" ^ ");
    return `// Fibonacci LFSR — ${poly.label}
// taps (MSB-relative): [${poly.tapsFromMsb.join(", ")}]
logic fb;
assign fb = ${xorExpr};
always_ff @(posedge clk)
  q <= {fb, q[${poly.n - 1}:1]};  // PRBS often = q[0] before shift
// avoid all-zero lock; max period = 2^${poly.n}-1 = ${poly.maxPeriod}`;
  }

  function makeStarter() {
    const poly = POLYS.n4_max;
    return {
      polyId: "n4_max",
      q: strToBits("0001", poly.n),
      seed: "0001",
      fb: 0,
      lastPrbs: 0,
      cycle: 0,
      hist: [],
      prbsStream: "",
      periodFound: null,
      lastAction: "",
      explained: false,
      stepped: false,
      setMax4: false,
      setShort4: false,
      setMax5: false,
      seeded: false,
      measured: false,
      log: [],
      trace: [],
    };
  }

  function currentPoly(state) {
    return POLYS[state.polyId];
  }

  const CLEARED_KEY = "ddv-lfsr-lab-cleared-v1";
  const STORE_KEY = "ddv-lfsr-lab-session-v1";

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

  const root = document.getElementById("lfsr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 4-bit maximal <code>x⁴+x+1</code>, seed <code>0001</code> —
        step and watch the PRBS stream; measure period vs <code>2ⁿ−1</code>.</p>
      <button type="button" class="btn btn-secondary" id="lfsr-starter">Load starter example</button>
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
            <h3>LFSR</h3>
            <p>Shift register + XOR taps = next state.</p>
          </div>
          <div class="idea-card">
            <h3>PRBS</h3>
            <p>Pseudo-random bit stream from a tap / LSB.</p>
          </div>
          <div class="idea-card">
            <h3>Period</h3>
            <p>Maximal poly → all nonzero states: 2ⁿ−1.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>LFSR</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Polynomial
              <select id="poly-sel">
                <option value="n4_max" selected>4-bit maximal x⁴+x+1</option>
                <option value="n4_short">4-bit short x⁴+x²+1</option>
                <option value="n5_max">5-bit maximal x⁵+x²+1</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="chain" id="chain"></div>
          <div class="seq-strip" id="seq-strip"></div>
          <div class="prbs-bits" id="prbs-bits">PRBS: —</div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-step">Step clk ↑</button>
            <button type="button" id="btn-seed">Load seed 0001</button>
            <button type="button" id="btn-seed-alt">Load seed 1010</button>
            <button type="button" id="btn-zero">Load all-zero (lock)</button>
            <button type="button" id="btn-max4">Preset maximal-4</button>
            <button type="button" id="btn-short4">Preset short-4</button>
            <button type="button" id="btn-max5">Preset maximal-5</button>
            <button type="button" id="btn-measure">Measure period</button>
            <button type="button" id="btn-demo">Demo: maximal vs short</button>
            <button type="button" id="btn-explain">Explain LFSR / PRBS</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>State / fb</h3>
              <p class="val" id="val-q">—</p>
              <p class="note" id="note-q"></p>
            </div>
            <div class="status-card">
              <h3>Period / cycle</h3>
              <p class="val" id="val-p">—</p>
              <p class="note" id="note-p"></p>
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
          <thead><tr><th>Idea</th><th>Note</th></tr></thead>
          <tbody>
            <tr><td>Maximal period</td><td>2ⁿ − 1 (never visits 0)</td></tr>
            <tr><td>All-zero</td><td>Locks — fb stays 0</td></tr>
            <tr><td>PRBS</td><td>Bit stream for BER / scramble tests</td></tr>
            <tr><td>Taps</td><td>Polynomial chooses which bits XOR</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Blue outline = tap bits; green box = PRBS out (old LSB).</li>
          <li>Measure period: step until seed repeats (cap 2ⁿ).</li>
        </ul>
      </div>
    </div>
  `;

  const polySel = /** @type {HTMLSelectElement} */ (document.getElementById("poly-sel"));
  const modeLegend = document.getElementById("mode-legend");
  const chain = document.getElementById("chain");
  const seqStrip = document.getElementById("seq-strip");
  const prbsBits = document.getElementById("prbs-bits");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const valQ = document.getElementById("val-q");
  const noteQ = document.getElementById("note-q");
  const valP = document.getElementById("val-p");
  const noteP = document.getElementById("note-p");
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

  function applyPolyFlags() {
    if (state.polyId === "n4_max") state.setMax4 = true;
    if (state.polyId === "n4_short") state.setShort4 = true;
    if (state.polyId === "n5_max") state.setMax5 = true;
  }

  function syncFb() {
    const poly = currentPoly(state);
    state.fb = feedbackOf(state.q, poly);
  }

  function applyPoly(id, seedStr) {
    state.polyId = id;
    applyPolyFlags();
    const poly = currentPoly(state);
    const seed = seedStr || (poly.n === 5 ? "00001" : "0001");
    state.seed = seed;
    state.q = strToBits(seed, poly.n);
    state.cycle = 0;
    state.hist = [bitsToStr(state.q)];
    state.prbsStream = "";
    state.periodFound = null;
    syncFb();
  }

  function stepOnce() {
    const poly = currentPoly(state);
    const prev = bitsToStr(state.q);
    const { next, fb, prbs } = stepLfsr(state.q, poly);
    state.q = next;
    state.fb = fb;
    state.lastPrbs = prbs;
    state.cycle += 1;
    state.stepped = true;
    state.prbsStream += String(prbs);
    if (state.prbsStream.length > 64) state.prbsStream = state.prbsStream.slice(-64);
    state.hist.push(bitsToStr(state.q));
    if (state.hist.length > 20) state.hist.shift();
    state.lastAction = "step";
    pushTrace(`t${state.cycle}: ${prev} → ${bitsToStr(state.q)} fb=${fb} out=${prbs}`);
    pushLog(`# step → ${bitsToStr(state.q)} PRBS+=${prbs}`);
  }

  function stepPosedge() {
    stepOnce();
    renderAll();
  }

  function measurePeriod() {
    const poly = currentPoly(state);
    const seedBits = strToBits(state.seed, poly.n);
    state.q = seedBits.slice();
    state.cycle = 0;
    state.hist = [bitsToStr(state.q)];
    state.prbsStream = "";
    state.trace = [];
    const start = bitsToStr(state.q);
    const limit = 1 << poly.n;
    let found = null;
    for (let i = 0; i < limit; i++) {
      stepOnce();
      if (bitsToStr(state.q) === start) {
        found = state.cycle;
        break;
      }
      if (bitsToStr(state.q) === "0".repeat(poly.n)) {
        found = state.cycle; // locked path
        break;
      }
    }
    state.periodFound = found;
    state.measured = true;
    state.lastAction = "measure";
    pushLog(`# period measured = ${found}`);
    pushTrace(`period=${found} (max ${poly.maxPeriod})`);
    renderAll();
  }

  function runDemo() {
    // maximal period 15 then short poly period
    applyPoly("n4_max", "0001");
    state.setMax4 = true;
    state.setShort4 = true;
    state.trace = [];
    const start = bitsToStr(state.q);
    let pMax = null;
    for (let i = 0; i < 16; i++) {
      stepOnce();
      if (bitsToStr(state.q) === start) {
        pMax = state.cycle;
        break;
      }
    }
    applyPoly("n4_short", "0001");
    state.setShort4 = true;
    const start2 = bitsToStr(state.q);
    let pShort = null;
    for (let i = 0; i < 16; i++) {
      stepOnce();
      if (bitsToStr(state.q) === start2) {
        pShort = state.cycle;
        break;
      }
    }
    state.periodFound = pShort;
    state.measured = true;
    state.lastAction = "demo";
    pushTrace(`demo maximal period=${pMax}; short period=${pShort}`);
    pushLog(`# demo max=${pMax} short=${pShort}`);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# taps→poly · PRBS=stream · max period 2^n-1 · avoid 0");
    pushTrace("explain: LFSR for scramble / BER / built-in self-test");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setMax4 = true;
    syncFb();
    state.hist = [bitsToStr(state.q)];
    state.lastAction = "starter";
    pushLog("# starter 4-bit maximal seed 0001");
    renderAll();
  }

  function renderChain() {
    const poly = currentPoly(state);
    const tapSet = new Set(tapsToIndices(poly));
    let html = `<div class="xor-box">XOR<br>fb=${state.fb}</div><span class="chain-arrow">→</span>`;
    for (let i = poly.n - 1; i >= 0; i--) {
      const b = state.q[i];
      const tap = tapSet.has(i) ? "is-tap" : "";
      html += `<div class="ff-cell ${b ? "is-hi" : ""} ${tap}"><h3>q${i}</h3><p class="bit">${b}</p></div>`;
      if (i > 0) html += `<span class="chain-arrow">→</span>`;
    }
    html += `<span class="chain-arrow">⇒</span><div class="prbs-box">PRBS<br>${state.cycle ? state.lastPrbs : "—"}</div>`;
    chain.innerHTML = html;
  }

  function renderAll() {
    const poly = currentPoly(state);
    polySel.value = state.polyId;
    modeLegend.textContent = `${poly.label} · taps [${poly.tapsFromMsb.join(",")}] · max period ${poly.maxPeriod}`;
    codeBox.textContent = sourceCode(poly);
    syncFb();
    renderChain();

    const hist = state.hist.length ? state.hist : [bitsToStr(state.q)];
    seqStrip.innerHTML = hist
      .map((s, i) => {
        const cur = i === hist.length - 1 ? "is-cur" : "";
        const seed = s === state.seed.padStart(poly.n, "0") ? "is-seed" : "";
        return `<span class="${cur} ${seed}">${s}</span>`;
      })
      .join("");

    prbsBits.textContent = `PRBS stream: ${state.prbsStream || "—"}`;

    const allZero = bitsToStr(state.q) === "0".repeat(poly.n);
    if (allZero) {
      warnBox.className = "warn-box is-warn";
      warnBox.textContent = "All-zero lock — feedback stays 0; seed must be nonzero.";
    } else if (state.periodFound !== null) {
      const maxOk = state.periodFound === poly.maxPeriod;
      warnBox.className = maxOk ? "warn-box is-ok" : "warn-box is-warn";
      warnBox.textContent = maxOk
        ? `Period ${state.periodFound} = 2^${poly.n}−1 — maximal ✓`
        : `Period ${state.periodFound} < ${poly.maxPeriod} — not maximal for this seed/poly.`;
    } else {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = poly.maximal
        ? "Maximal poly selected — expect period 2ⁿ−1 from nonzero seed."
        : "Short poly — period will be less than 2ⁿ−1 for this seed.";
    }

    valQ.textContent = `${bitsToStr(state.q)} / ${state.fb}`;
    noteQ.textContent = `seed=${state.seed}`;
    valP.textContent =
      state.periodFound !== null ? String(state.periodFound) : `— / ${state.cycle}`;
    noteP.textContent = `aim ≤ ${poly.maxPeriod}`;

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no steps";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ polyId: state.polyId, q: bitsToStr(state.q) })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("lfsr-starter").addEventListener("click", loadStarter);

  polySel.addEventListener("change", () => {
    applyPoly(polySel.value);
    state.lastAction = "poly";
    pushLog(`# poly → ${state.polyId}`);
    renderAll();
  });

  document.getElementById("btn-step").addEventListener("click", stepPosedge);

  document.getElementById("btn-seed").addEventListener("click", () => {
    const poly = currentPoly(state);
    const seed = poly.n === 5 ? "00001" : "0001";
    applyPoly(state.polyId, seed);
    state.seeded = true;
    state.lastAction = "seed";
    pushLog(`# seed ${seed}`);
    renderAll();
  });

  document.getElementById("btn-seed-alt").addEventListener("click", () => {
    const poly = currentPoly(state);
    const seed = poly.n === 5 ? "10101" : "1010";
    applyPoly(state.polyId, seed);
    state.seeded = true;
    state.lastAction = "seed-alt";
    pushLog(`# seed ${seed}`);
    renderAll();
  });

  document.getElementById("btn-zero").addEventListener("click", () => {
    const poly = currentPoly(state);
    applyPoly(state.polyId, "0".repeat(poly.n));
    state.lastAction = "zero";
    pushLog("# all-zero loaded");
    renderAll();
  });

  function preset(id, flag) {
    applyPoly(id);
    state[flag] = true;
    applyPolyFlags();
    state.lastAction = `preset-${id}`;
    pushLog(`# preset ${id}`);
    renderAll();
  }

  document.getElementById("btn-max4").addEventListener("click", () => preset("n4_max", "setMax4"));
  document.getElementById("btn-short4").addEventListener("click", () => preset("n4_short", "setShort4"));
  document.getElementById("btn-max5").addEventListener("click", () => preset("n5_max", "setMax5"));
  document.getElementById("btn-measure").addEventListener("click", measurePeriod);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-lfsr",
      title: "Quiz: LFSR",
      prompt: "Linear feedback shift register acronym? Answer: <code>LFSR</code>",
      hint: "shift + XOR",
      type: "text",
      answer: "lfsr",
      alt: ["LFSR"],
    },
    {
      id: "quiz-prbs",
      title: "Quiz: PRBS",
      prompt: "Pseudo-random binary sequence acronym? Answer: <code>PRBS</code>",
      hint: "bit stream from LFSR",
      type: "text",
      answer: "prbs",
      alt: ["PRBS"],
    },
    {
      id: "quiz-period",
      title: "Quiz: period",
      prompt: "Maximal n-bit LFSR period formula? Answer: <code>2^n-1</code>",
      hint: "all nonzero states",
      type: "text",
      answer: "2^n-1",
      alt: ["2n-1", "2**n-1", "2^n - 1", "15"],
    },
    {
      id: "quiz-zero",
      title: "Quiz: zero",
      prompt: "Forbidden lock state? Answer: <code>all-zero</code>",
      hint: "fb stays 0",
      type: "text",
      answer: "all-zero",
      alt: ["zero", "all zero", "0", "all-zeros"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — maximal-4, seed 0001.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.polyId === "n4_max" &&
        state.setMax4 &&
        bitsToStr(state.q) === "0001",
    },
    {
      id: "preset-max4",
      title: "Preset max4",
      prompt: "Preset maximal-4.",
      hint: "Preset maximal-4",
      type: "state",
      setup: () => {
        applyPoly("n4_short");
        renderAll();
      },
      check: () =>
        state.setMax4 &&
        state.polyId === "n4_max" &&
        state.lastAction === "preset-n4_max",
    },
    {
      id: "preset-short",
      title: "Preset short",
      prompt: "Preset short-4.",
      hint: "Preset short-4",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setShort4 && state.polyId === "n4_short",
    },
    {
      id: "preset-max5",
      title: "Preset max5",
      prompt: "Preset maximal-5.",
      hint: "Preset maximal-5",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setMax5 && state.polyId === "n5_max",
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
      id: "seed",
      title: "Seed",
      prompt: "Load seed 0001.",
      hint: "Load seed 0001",
      type: "state",
      setup: () => {
        loadStarter();
        applyPoly("n4_max", "1010");
        renderAll();
      },
      check: () =>
        state.seeded &&
        bitsToStr(state.q) === "0001" &&
        state.lastAction === "seed",
    },
    {
      id: "measure-max",
      title: "Measure max",
      prompt: "On maximal-4, Measure period → 15.",
      hint: "Preset maximal-4 → Measure period",
      type: "state",
      setup: () => {
        loadStarter();
        applyPoly("n4_max", "0001");
        renderAll();
      },
      check: () =>
        state.polyId === "n4_max" &&
        state.measured &&
        state.periodFound === 15,
    },
    {
      id: "measure-short",
      title: "Measure short",
      prompt: "On short-4, Measure period — less than 15.",
      hint: "Preset short-4 → Measure period",
      type: "state",
      setup: () => {
        loadStarter();
        applyPoly("n4_short", "0001");
        renderAll();
      },
      check: () =>
        state.polyId === "n4_short" &&
        state.measured &&
        state.periodFound !== null &&
        state.periodFound < 15,
    },
    {
      id: "zero-lock",
      title: "Zero lock",
      prompt: "Load all-zero, step — state stays 0000.",
      hint: "Load all-zero → Step",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        bitsToStr(state.q) === "0000" &&
        state.cycle >= 1 &&
        state.fb === 0,
    },
    {
      id: "prbs-len",
      title: "PRBS length",
      prompt: "Step until PRBS stream length ≥ 8.",
      hint: "Step repeatedly from seed",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.prbsStream.length >= 8,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: maximal vs short.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" &&
        state.setMax4 &&
        state.setShort4,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain LFSR / PRBS.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "poly-short",
      title: "Poly short",
      prompt: "Switch Polynomial dropdown to short-4.",
      hint: "Polynomial select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.polyId === "n4_short" && state.lastAction === "poly",
    },
    {
      id: "code-fb",
      title: "Code fb",
      prompt: "Source shows <code>assign fb</code>.",
      hint: "Any preset — read code box",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode(currentPoly(state)).includes("assign fb"),
    },
    {
      id: "tap-highlight",
      title: "Tap highlight",
      prompt: "Maximal-4: tap cells q3 and q0 outlined (mode on).",
      hint: "Preset maximal-4",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (state.polyId !== "n4_max") return false;
        const taps = tapsToIndices(POLYS.n4_max);
        return taps.includes(3) && taps.includes(0);
      },
    },
    {
      id: "seed-alt",
      title: "Seed alt",
      prompt: "Load seed 1010 (on 4-bit poly).",
      hint: "Load seed 1010",
      type: "state",
      setup: () => {
        loadStarter();
        applyPoly("n4_max", "0001");
        renderAll();
      },
      check: () =>
        bitsToStr(state.q) === "1010" && state.lastAction === "seed-alt",
    },
    {
      id: "max5-period",
      title: "Max5 period",
      prompt: "Maximal-5: Measure period → 31.",
      hint: "Preset maximal-5 → Measure period",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.polyId === "n5_max" &&
        state.measured &&
        state.periodFound === 31,
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
        state.setShort4,
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
