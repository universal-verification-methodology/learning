(() => {
  /**
   * Logic hazards — single-input transition glitches.
   *
   * Static-1: F should stay 1, briefly goes 0 (gap between SOP terms).
   * Static-0: F should stay 0, briefly goes 1 (gap in POS factors).
   * Dynamic:  more than one transition on F when ideal has one.
   *
   * Starter: F = AB + A'C, A:1→0, B=C=1 → static-1; cover with +BC.
   */

  const CIRCUITS = {
    static1: {
      id: "static1",
      name: "SOP gap (static-1)",
      expr: "AB + A'C",
      note: "Classic uncovered adjacent 1s when A flips, B=C=1.",
      kind: "sop",
      /** @param {{A:number,B:number,C:number}} v */
      eval: (v) => (v.A && v.B) || (!v.A && v.C),
      /** delayed gate network */
      simulate: (from, to, delays) => simSop(from, to, delays, [
        { name: "AB", fn: (v) => v.A && v.B, dKey: "t1" },
        { name: "A'C", fn: (v) => !v.A && v.C, dKey: "t2" },
      ], "or"),
    },
    covered: {
      id: "covered",
      name: "Consensus cover",
      expr: "AB + A'C + BC",
      note: "Consensus term BC bridges the A transition.",
      kind: "sop",
      eval: (v) => (v.A && v.B) || (!v.A && v.C) || (v.B && v.C),
      simulate: (from, to, delays) => simSop(from, to, delays, [
        { name: "AB", fn: (v) => v.A && v.B, dKey: "t1" },
        { name: "A'C", fn: (v) => !v.A && v.C, dKey: "t2" },
        { name: "BC", fn: (v) => v.B && v.C, dKey: "t3" },
      ], "or"),
    },
    static0: {
      id: "static0",
      name: "POS gap (static-0)",
      expr: "(A+B)(A'+C)",
      note: "Dual of static-1: A flips, B=C=0 → brief 1.",
      kind: "pos",
      eval: (v) => (v.A || v.B) && (!v.A || v.C),
      simulate: (from, to, delays) => simPos(from, to, delays, [
        { name: "A+B", fn: (v) => v.A || v.B, dKey: "t1" },
        { name: "A'+C", fn: (v) => !v.A || v.C, dKey: "t2" },
      ]),
    },
    dynamic: {
      id: "dynamic",
      name: "Multi-level (dynamic)",
      expr: "(AB' + BC)·B",
      note: "AB'+BC gaps while delayed B still 1 → F chatters on the way to 0.",
      kind: "multi",
      // (AB' + BC)·B = BC  (algebraic). With C=1, F follows B.
      eval: (v) => !!(v.B && v.C),
      simulate: (from, to, delays) => simMulti(from, to, delays),
    },
  };

  const T_MAX = 24;

  function copyV(v) {
    return { A: v.A, B: v.B, C: v.C };
  }

  /**
   * SOP: each product has delay; OR is instantaneous after products.
   * Input change at t=0; product i updates at delays[dKey].
   */
  function simSop(from, to, delays, terms, _join) {
    const waves = { A: [], B: [], C: [], F: [] };
    const termW = {};
    terms.forEach((t) => {
      termW[t.name] = [];
    });

    let cur = copyV(from);
    const termVal = {};
    terms.forEach((t) => {
      termVal[t.name] = t.fn(cur) ? 1 : 0;
    });
    const pending = [];
    // schedule input update at t=0 (already from), then apply `to` inputs at t=0
    // Products recompute when their delay expires after input change
    const next = copyV(to);
    terms.forEach((t) => {
      const nv = t.fn(next) ? 1 : 0;
      if (nv !== termVal[t.name]) {
        pending.push({ t: delays[t.dKey] | 0, name: t.name, val: nv });
      }
    });

    for (let t = 0; t <= T_MAX; t++) {
      pending
        .filter((p) => p.t === t)
        .forEach((p) => {
          termVal[p.name] = p.val;
        });
      // after input edge at t=0, vars follow `to`
      const show = t === 0 ? from : next;
      // actually show transition: at t>=0 inputs are `to` for display after edge
      const disp = t === 0 ? from : next;
      waves.A.push(disp.A);
      waves.B.push(disp.B);
      waves.C.push(disp.C);
      // fix: at t=0 show from, then immediately inputs become to for term scheduling
      // Better: inputs switch at t=0 for display as step — show from only before 0
      terms.forEach((tm) => termW[tm.name].push(termVal[tm.name]));
      const f = terms.some((tm) => termVal[tm.name]) ? 1 : 0;
      waves.F.push(f);
    }
    // Fix input display: step at t=0 from→to
    for (let t = 0; t <= T_MAX; t++) {
      const disp = t < 1 ? from : next;
      waves.A[t] = disp.A;
      waves.B[t] = disp.B;
      waves.C[t] = disp.C;
    }
    return { waves, termW, terms: terms.map((t) => t.name) };
  }

  function simPos(from, to, delays, factors) {
    const waves = { A: [], B: [], C: [], F: [] };
    const termW = {};
    factors.forEach((t) => {
      termW[t.name] = [];
    });
    const termVal = {};
    factors.forEach((t) => {
      termVal[t.name] = t.fn(from) ? 1 : 0;
    });
    const next = copyV(to);
    const pending = [];
    factors.forEach((t) => {
      const nv = t.fn(next) ? 1 : 0;
      if (nv !== termVal[t.name]) {
        pending.push({ t: delays[t.dKey] | 0, name: t.name, val: nv });
      }
    });
    for (let t = 0; t <= T_MAX; t++) {
      pending
        .filter((p) => p.t === t)
        .forEach((p) => {
          termVal[p.name] = p.val;
        });
      const disp = t < 1 ? from : next;
      waves.A.push(disp.A);
      waves.B.push(disp.B);
      waves.C.push(disp.C);
      factors.forEach((tm) => termW[tm.name].push(termVal[tm.name]));
      const f = factors.every((tm) => termVal[tm.name]) ? 1 : 0;
      waves.F.push(f);
    }
    return { waves, termW, terms: factors.map((t) => t.name) };
  }

  /**
   * Dynamic demo: X = AB' + BC (can gap), Y = delayed B, F = X ∧ Y.
   * A=C=1, B:1→0 → ideal F = BC follows B (1→0); X gap → 1→0→1→0.
   * Delays: t1=BC fall, t2=AB' rise, t3=Y (B) delay, t4=gate tick.
   */
  function simMulti(from, to, delays) {
    const waves = { A: [], B: [], C: [], F: [] };
    const termW = { "AB'": [], BC: [], X: [], Y: [] };

    const dBC = delays.t1 | 0;
    const dABp = delays.t2 | 0;
    const dY = delays.t3 | 0;

    let A = from.A;
    let B = from.B;
    let C = from.C;
    let tAB = A && !B ? 1 : 0;
    let tBC = B && C ? 1 : 0;
    let X = tAB || tBC ? 1 : 0;
    let Y = B;
    let F = X && Y ? 1 : 0;

    /** @type {{t:number, kind:string, val:number}[]} */
    const q = [];
    const schedule = (t, kind, val) => {
      q.push({ t, kind, val });
    };

    for (let t = 0; t <= T_MAX; t++) {
      if (t === 0) {
        A = to.A;
        B = to.B;
        C = to.C;
        const nAB = A && !B ? 1 : 0;
        const nBC = B && C ? 1 : 0;
        if (nBC !== tBC) schedule(dBC, "BC", nBC);
        if (nAB !== tAB) schedule(dABp, "AB'", nAB);
        if (B !== Y) schedule(dY, "Y", B);
      }

      q.filter((e) => e.t === t).forEach((e) => {
        if (e.kind === "BC") {
          tBC = e.val;
          X = tAB || tBC ? 1 : 0;
          F = X && Y ? 1 : 0;
        } else if (e.kind === "AB'") {
          tAB = e.val;
          X = tAB || tBC ? 1 : 0;
          F = X && Y ? 1 : 0;
        } else if (e.kind === "Y") {
          Y = e.val;
          F = X && Y ? 1 : 0;
        }
      });

      const disp = t < 1 ? from : to;
      waves.A.push(disp.A);
      waves.B.push(disp.B);
      waves.C.push(disp.C);
      termW["AB'"].push(tAB);
      termW.BC.push(tBC);
      termW.X.push(X);
      termW.Y.push(Y);
      waves.F.push(F);
    }
    return { waves, termW, terms: ["AB'", "BC", "X", "Y"] };
  }

  function classify(fromF, toF, series) {
    // count transitions in F after t=0
    let transitions = 0;
    for (let i = 1; i < series.length; i++) {
      if (series[i] !== series[i - 1]) transitions++;
    }
    const ideal = fromF === toF ? 0 : 1;
    if (fromF === 1 && toF === 1) {
      if (series.some((v) => v === 0)) {
        return {
          type: "static-1",
          label: "Static-1 hazard",
          detail: "F should stay 1 but dipped to 0",
        };
      }
      return {
        type: "safe",
        label: "No hazard (steady 1)",
        detail: "F stayed 1 for the whole window",
      };
    }
    if (fromF === 0 && toF === 0) {
      if (series.some((v) => v === 1)) {
        return {
          type: "static-0",
          label: "Static-0 hazard",
          detail: "F should stay 0 but spiked to 1",
        };
      }
      return {
        type: "safe",
        label: "No hazard (steady 0)",
        detail: "F stayed 0 for the whole window",
      };
    }
    // ideal single transition
    if (transitions > 1) {
      return {
        type: "dynamic",
        label: "Dynamic hazard",
        detail: `${transitions} edges on F (ideal ${ideal})`,
      };
    }
    if (transitions === 1) {
      return {
        type: "safe",
        label: "Clean transition",
        detail: "Single edge — no dynamic chatter",
      };
    }
    return {
      type: "safe",
      label: "No edge observed",
      detail: "Delays may still be settling — widen window or delays",
    };
  }

  function makeStarter() {
    return {
      circuit: "static1",
      flip: "A",
      edge: "10", // 1→0
      hold: { B: 1, C: 1 },
      delays: { t1: 2, t2: 6, t3: 2, t4: 1 },
      lastAction: "",
      ran: false,
      covered: false,
      setStatic0: false,
      setDynamic: false,
      log: [],
      trace: [],
      lastClass: null,
    };
  }

  const CLEARED_KEY = "ddv-logic-hazards-cleared-v1";
  const STORE_KEY = "ddv-logic-hazards-session-v1";

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

  const root = document.getElementById("hz-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>F = AB + A'C</code>, flip <code>A: 1→0</code>
        with <code>B=C=1</code>. Term AB falls before A'C rises → <strong>static-1</strong> glitch.
        Cover with consensus <code>+ BC</code>.</p>
      <button type="button" class="btn btn-secondary" id="hz-starter">Load starter example</button>
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
            <h3>Static-1</h3>
            <p>Output should stay <code>1</code>, briefly goes <code>0</code>.</p>
          </div>
          <div class="idea-card">
            <h3>Static-0</h3>
            <p>Output should stay <code>0</code>, briefly goes <code>1</code>.</p>
          </div>
          <div class="idea-card">
            <h3>Dynamic</h3>
            <p>More than one edge when the function has one.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Circuit &amp; stimulus</h2></div>
        <div class="panel-body">
          <div class="circuit-box">
            <div class="legend" id="ckt-name"></div>
            <p class="expr" id="ckt-expr"></p>
            <p class="meta-line" id="ckt-note"></p>
          </div>
          <div class="ctrl-row">
            <label>Circuit
              <select id="ckt-sel">
                <option value="static1">AB + A'C (static-1)</option>
                <option value="covered">AB + A'C + BC (covered)</option>
                <option value="static0">(A+B)(A'+C) (static-0)</option>
                <option value="dynamic">(AB'+BC)·B (dynamic)</option>
              </select>
            </label>
            <label>Flip
              <select id="flip-sel">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label>Edge
              <select id="edge-sel">
                <option value="10">1 → 0</option>
                <option value="01">0 → 1</option>
              </select>
            </label>
          </div>
          <p class="legend">Hold other inputs:</p>
          <div class="hold-row" id="hold-row"></div>
          <div class="ctrl-row">
            <label>d(term1) <input type="number" id="d1" min="0" max="12" value="2"></label>
            <label>d(term2) <input type="number" id="d2" min="0" max="12" value="6"></label>
            <label>d(term3) <input type="number" id="d3" min="0" max="12" value="2"></label>
            <label>d(F) <input type="number" id="d4" min="0" max="12" value="1"></label>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-run">Run transition</button>
            <button type="button" id="btn-starter-ckt">Preset starter (static-1)</button>
            <button type="button" id="btn-cover">Apply consensus cover</button>
            <button type="button" id="btn-static0">Preset static-0</button>
            <button type="button" id="btn-dynamic">Preset dynamic</button>
            <button type="button" id="btn-explain">Explain hazard</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Waveform &amp; verdict</h2></div>
        <div class="panel-body">
          <div class="verdict" id="verdict">Run a transition to classify the hazard.</div>
          <div class="wave-wrap">
            <svg class="wave" id="wave" viewBox="0 0 400 220" role="img" aria-label="Timing diagram"></svg>
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
          <thead><tr><th>Hazard</th><th>Signature</th><th>Fix intuition</th></tr></thead>
          <tbody>
            <tr><td>Static-1</td><td>Stay-1 dips to 0</td><td>Add consensus product (cover adjacent 1s)</td></tr>
            <tr><td>Static-0</td><td>Stay-0 spikes to 1</td><td>Dual: cover adjacent 0s in POS</td></tr>
            <tr><td>Dynamic</td><td>Extra edges on F</td><td>Remove static hazards in subnetworks / equalize paths</td></tr>
            <tr><td>Single-input</td><td>Only one var changes</td><td>Hazard analysis assumes this</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: delay AB faster than A'C so the OR sees a gap.</li>
          <li>Covered circuit with same stimulus should stay 1 via BC.</li>
        </ul>
      </div>
    </div>
  `;

  const cktSel = document.getElementById("ckt-sel");
  const flipSel = document.getElementById("flip-sel");
  const edgeSel = document.getElementById("edge-sel");
  const holdRow = document.getElementById("hold-row");
  const d1 = document.getElementById("d1");
  const d2 = document.getElementById("d2");
  const d3 = document.getElementById("d3");
  const d4 = document.getElementById("d4");
  const verdictEl = document.getElementById("verdict");
  const waveEl = document.getElementById("wave");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 40) state.log = state.log.slice(-30);
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function syncDelaysFromUi() {
    state.delays = {
      t1: Number(d1.value) || 0,
      t2: Number(d2.value) || 0,
      t3: Number(d3.value) || 0,
      t4: Number(d4.value) || 0,
    };
  }

  function syncUiFromState() {
    cktSel.value = state.circuit;
    flipSel.value = state.flip;
    edgeSel.value = state.edge;
    d1.value = String(state.delays.t1);
    d2.value = String(state.delays.t2);
    d3.value = String(state.delays.t3);
    d4.value = String(state.delays.t4);
  }

  function buildVectors() {
    const from = { A: 0, B: 0, C: 0 };
    const others = ["A", "B", "C"].filter((v) => v !== state.flip);
    others.forEach((v) => {
      from[v] = state.hold[v] | 0;
    });
    const start = state.edge === "10" ? 1 : 0;
    const end = state.edge === "10" ? 0 : 1;
    from[state.flip] = start;
    const to = copyV(from);
    to[state.flip] = end;
    return { from, to };
  }

  function runSim() {
    syncDelaysFromUi();
    const ckt = CIRCUITS[state.circuit];
    const { from, to } = buildVectors();
    const fromF = ckt.eval(from) ? 1 : 0;
    const toF = ckt.eval(to) ? 1 : 0;
    const sim = ckt.simulate(from, to, state.delays);
    const cls = classify(fromF, toF, sim.waves.F);
    state.lastClass = cls;
    state.ran = true;
    state.lastAction = "run";
    return { ckt, from, to, fromF, toF, sim, cls };
  }

  function drawWave(sim, from, to) {
    const rows = ["A", "B", "C", ...sim.terms, "F"];
    const rowH = 28;
    const top = 16;
    const left = 48;
    const width = 340;
    const height = top + rows.length * rowH + 8;
    waveEl.setAttribute("viewBox", `0 0 400 ${height}`);
    const n = sim.waves.F.length;
    const dx = width / (n - 1);

    function seriesFor(name) {
      if (name === "A" || name === "B" || name === "C" || name === "F") {
        return sim.waves[name];
      }
      return sim.termW[name];
    }

    let paths = "";
    rows.forEach((name, ri) => {
      const y0 = top + ri * rowH;
      const yHi = y0 + 4;
      const yLo = y0 + 18;
      const s = seriesFor(name);
      let d = "";
      for (let i = 0; i < s.length; i++) {
        const x = left + i * dx;
        const y = s[i] ? yHi : yLo;
        if (i === 0) d += `M ${x} ${y}`;
        else {
          const prev = s[i - 1] ? yHi : yLo;
          d += ` L ${x} ${prev} L ${x} ${y}`;
        }
      }
      const color =
        name === "F" ? "#f0c674" : name.length === 1 ? "#9ecbff" : "#8fd4a8";
      paths += `<text x="8" y="${y0 + 14}" fill="#7a8a9a" font-size="11" font-family="ui-monospace,monospace">${name}</text>`;
      paths += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
    });
    // marker at t=0 edge
    paths += `<line x1="${left}" y1="${top - 4}" x2="${left}" y2="${height - 4}" stroke="#7a8a9a" stroke-dasharray="3 3"/>`;
    waveEl.innerHTML = paths;
  }

  function renderVerdict(cls) {
    verdictEl.className = "verdict";
    if (!cls) {
      verdictEl.textContent = "Run a transition to classify the hazard.";
      return;
    }
    if (cls.type === "safe") verdictEl.classList.add("safe");
    else if (cls.type === "dynamic") verdictEl.classList.add("dynamic");
    else verdictEl.classList.add("hazard");
    verdictEl.textContent = `${cls.label} — ${cls.detail}`;
  }

  function renderCircuitMeta() {
    const ckt = CIRCUITS[state.circuit];
    document.getElementById("ckt-name").textContent = ckt.name;
    document.getElementById("ckt-expr").textContent = "F = " + ckt.expr;
    document.getElementById("ckt-note").textContent = ckt.note;
  }

  function renderHold() {
    holdRow.innerHTML = "";
    ["A", "B", "C"].forEach((v) => {
      if (v === state.flip) return;
      const b = document.createElement("button");
      b.type = "button";
      const val = state.hold[v] | 0;
      b.className = val ? "on" : "";
      b.textContent = `${v}=${val}`;
      b.addEventListener("click", () => {
        state.hold[v] = val ? 0 : 1;
        state.lastAction = "hold";
        pushLog("run", `# hold ${v}=${state.hold[v]}`);
        renderAll(false);
      });
      holdRow.appendChild(b);
    });
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(run or explain)</span>';
      return;
    }
    traceBox.innerHTML = state.trace
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no actions yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll(doRun) {
    syncUiFromState();
    renderCircuitMeta();
    renderHold();
    if (doRun || state.ran) {
      const r = runSim();
      drawWave(r.sim, r.from, r.to);
      renderVerdict(r.cls);
    } else {
      waveEl.innerHTML = "";
      renderVerdict(null);
    }
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter AB+A'C, A:1→0, B=C=1");
    state.trace = [];
    renderAll(true);
  }

  function explainHazard() {
    const r = runSim();
    state.lastAction = "explain";
    const lines = [
      { kind: "muted", text: `circuit ${r.ckt.expr}` },
      {
        kind: "hi",
        text: `stimulus ${state.flip}: ${state.edge[0]}→${state.edge[1]}, holds B=${state.hold.B} C=${state.hold.C}`.replace(
          `B=${state.hold.B} C=${state.hold.C}`,
          ["A", "B", "C"]
            .filter((v) => v !== state.flip)
            .map((v) => `${v}=${state.hold[v]}`)
            .join(" ")
        ),
      },
      {
        kind: "hi",
        text: `ideal F: ${r.fromF} → ${r.toF}`,
      },
    ];
    if (r.cls.type === "static-1") {
      lines.push({
        kind: "bad",
        text: "static-1: product terms leave a momentary gap",
      });
      lines.push({
        kind: "ok",
        text: "fix: add consensus (cover) term bridging the cubes",
      });
    } else if (r.cls.type === "static-0") {
      lines.push({
        kind: "bad",
        text: "static-0: POS factors leave a momentary spike",
      });
      lines.push({
        kind: "ok",
        text: "fix: dual cover for adjacent 0s",
      });
    } else if (r.cls.type === "dynamic") {
      lines.push({
        kind: "bad",
        text: "dynamic: multiple F edges from unequal path delays",
      });
      lines.push({
        kind: "ok",
        text: "fix: eliminate static hazards in each path / balance delays",
      });
    } else {
      lines.push({ kind: "ok", text: r.cls.detail });
    }
    state.trace = lines;
    pushLog("ok", "# explained");
    renderAll(true);
  }

  document.getElementById("hz-starter").addEventListener("click", loadStarter);
  cktSel.addEventListener("change", () => {
    state.circuit = cktSel.value;
    if (state.circuit === "covered") state.covered = true;
    if (state.circuit === "static0") state.setStatic0 = true;
    if (state.circuit === "dynamic") state.setDynamic = true;
    state.lastAction = "circuit";
    pushLog("run", `# circuit → ${state.circuit}`);
    renderAll(state.ran);
  });
  flipSel.addEventListener("change", () => {
    state.flip = flipSel.value;
    // ensure hold has the other vars
    ["A", "B", "C"].forEach((v) => {
      if (v !== state.flip && state.hold[v] === undefined) state.hold[v] = 1;
    });
    state.lastAction = "flip";
    renderAll(state.ran);
  });
  edgeSel.addEventListener("change", () => {
    state.edge = edgeSel.value;
    state.lastAction = "edge";
    renderAll(state.ran);
  });
  [d1, d2, d3, d4].forEach((inp) => {
    inp.addEventListener("change", () => {
      syncDelaysFromUi();
      state.lastAction = "delay";
      renderAll(state.ran);
    });
  });
  document.getElementById("btn-run").addEventListener("click", () => {
    state.trace = [
      { kind: "muted", text: "transition run" },
      {
        kind: "hi",
        text: `${state.flip} ${state.edge[0]}→${state.edge[1]} on ${CIRCUITS[state.circuit].expr}`,
      },
    ];
    const r = runSim();
    state.trace.push({
      kind: r.cls.type === "safe" ? "ok" : "warn",
      text: r.cls.label,
    });
    pushLog("ok", "# ran transition");
    renderAll(true);
  });
  document.getElementById("btn-starter-ckt").addEventListener("click", () => {
    state.circuit = "static1";
    state.flip = "A";
    state.edge = "10";
    state.hold = { B: 1, C: 1 };
    state.delays = { t1: 2, t2: 6, t3: 2, t4: 1 };
    state.lastAction = "preset-starter";
    pushLog("ok", "# preset starter static-1");
    renderAll(true);
  });
  document.getElementById("btn-cover").addEventListener("click", () => {
    state.circuit = "covered";
    state.covered = true;
    state.flip = "A";
    state.edge = "10";
    state.hold = { B: 1, C: 1 };
    state.lastAction = "cover";
    pushLog("ok", "# applied consensus BC");
    renderAll(true);
  });
  document.getElementById("btn-static0").addEventListener("click", () => {
    state.circuit = "static0";
    state.setStatic0 = true;
    state.flip = "A";
    state.edge = "10";
    state.hold = { B: 0, C: 0 };
    // A'+C must rise before A+B falls → brief both-1 spike
    state.delays = { t1: 6, t2: 2, t3: 2, t4: 1 };
    state.lastAction = "preset-static0";
    pushLog("ok", "# preset static-0");
    renderAll(true);
  });
  document.getElementById("btn-dynamic").addEventListener("click", () => {
    state.circuit = "dynamic";
    state.setDynamic = true;
    state.flip = "B";
    state.edge = "10";
    state.hold = { A: 1, C: 1 };
    // BC falls @2, AB' rises @6, delayed B @10 → F: 1→0→1→0
    state.delays = { t1: 2, t2: 6, t3: 10, t4: 0 };
    state.lastAction = "preset-dynamic";
    pushLog("ok", "# preset dynamic");
    renderAll(true);
  });
  document.getElementById("btn-explain").addEventListener("click", explainHazard);

  const CHALLENGES = [
    {
      id: "quiz-static1",
      title: "Quiz: static-1",
      prompt: "Stay-1 with a dip to 0 is a? Answer: <code>static-1</code>",
      hint: "hazard name",
      type: "text",
      answer: "static-1",
      alt: ["static 1", "static1", "s-1", "static-1 hazard"],
    },
    {
      id: "quiz-static0",
      title: "Quiz: static-0",
      prompt: "Stay-0 with a spike to 1 is a? Answer: <code>static-0</code>",
      hint: "dual of static-1",
      type: "text",
      answer: "static-0",
      alt: ["static 0", "static0", "s-0", "static-0 hazard"],
    },
    {
      id: "quiz-dynamic",
      title: "Quiz: dynamic",
      prompt: "Extra edges beyond the ideal one mean a? Answer: <code>dynamic</code>",
      hint: "chatter",
      type: "text",
      answer: "dynamic",
      alt: ["dynamic hazard", "dyn"],
    },
    {
      id: "quiz-consensus",
      title: "Quiz: cover",
      prompt: "Term that bridges adjacent cubes is the? Answer: <code>consensus</code>",
      hint: "AB + A'C + ?",
      type: "text",
      answer: "consensus",
      alt: ["consensus term", "cover", "bc", "redundant"],
    },
    {
      id: "starter-load",
      title: "Starter",
      prompt: "Load starter — circuit AB+A'C, A:1→0, B=C=1.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.circuit === "static1" &&
        state.flip === "A" &&
        state.edge === "10" &&
        state.hold.B === 1 &&
        state.hold.C === 1,
    },
    {
      id: "see-static1",
      title: "See static-1",
      prompt: "Run starter so verdict is Static-1 hazard.",
      hint: "Load starter (auto-runs) or Run transition",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.ran && state.lastClass && state.lastClass.type === "static-1",
    },
    {
      id: "cover-apply",
      title: "Apply cover",
      prompt: "Apply consensus cover (adds BC).",
      hint: "Apply consensus cover button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.covered && state.circuit === "covered",
    },
    {
      id: "cover-safe",
      title: "Cover safe",
      prompt: "With cover + same stimulus, verdict should be safe (steady 1).",
      hint: "Apply cover then check verdict",
      type: "state",
      setup: () => {
        loadStarter();
        state.circuit = "covered";
        state.covered = true;
        renderAll(true);
      },
      check: () =>
        state.circuit === "covered" &&
        state.lastClass &&
        state.lastClass.type === "safe",
    },
    {
      id: "quiz-term",
      title: "Quiz: BC",
      prompt: "Consensus for AB + A'C is which product? Answer: <code>BC</code>",
      hint: "shared literals",
      type: "text",
      answer: "bc",
      alt: ["BC", "B·C", "B C"],
    },
    {
      id: "static0-preset",
      title: "Static-0 preset",
      prompt: "Preset static-0 circuit with B=C=0.",
      hint: "Preset static-0",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setStatic0 &&
        state.circuit === "static0" &&
        state.hold.B === 0 &&
        state.hold.C === 0,
    },
    {
      id: "see-static0",
      title: "See static-0",
      prompt: "On static-0 preset, get Static-0 hazard verdict.",
      hint: "Preset static-0 (runs sim)",
      type: "state",
      setup: () => {
        document.getElementById("btn-static0").click();
      },
      check: () => state.lastClass && state.lastClass.type === "static-0",
    },
    {
      id: "dynamic-preset",
      title: "Dynamic preset",
      prompt: "Preset dynamic multi-level circuit.",
      hint: "Preset dynamic",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setDynamic && state.circuit === "dynamic",
    },
    {
      id: "see-dynamic",
      title: "See dynamic",
      prompt: "On dynamic preset, verdict should be Dynamic hazard.",
      hint: "Preset dynamic — check delays",
      type: "state",
      setup: () => {
        document.getElementById("btn-dynamic").click();
      },
      check: () => state.lastClass && state.lastClass.type === "dynamic",
    },
    {
      id: "quiz-single",
      title: "Quiz: assumption",
      prompt: "Hazard analysis usually assumes how many inputs change? Answer: <code>1</code>",
      hint: "single-input change",
      type: "text",
      answer: "1",
      alt: ["one", "single"],
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain hazard on the starter.",
      hint: "Explain hazard button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "explain",
    },
    {
      id: "delay-gap",
      title: "Delay gap",
      prompt: "On starter, keep d(term1) &lt; d(term2) so the OR sees a gap.",
      hint: "t1=2, t2=6",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.circuit === "static1" &&
        state.delays.t1 < state.delays.t2 &&
        state.lastClass &&
        state.lastClass.type === "static-1",
    },
    {
      id: "equal-delay",
      title: "Equal delays",
      prompt: "On starter, set both term delays equal (e.g. 4) — gap may vanish.",
      hint: "Set d1=d2=4 then Run",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (state.circuit !== "static1") return false;
        if (state.delays.t1 !== state.delays.t2) return false;
        const r = runSim();
        return r.cls.type === "safe";
      },
    },
    {
      id: "quiz-sop",
      title: "Quiz: SOP",
      prompt: "Static-1 is typical in which cover form? Answer: <code>SOP</code>",
      hint: "sum of products",
      type: "text",
      answer: "sop",
      alt: ["SOP", "sum of products"],
    },
    {
      id: "quiz-pos",
      title: "Quiz: POS",
      prompt: "Static-0 is typical in which cover form? Answer: <code>POS</code>",
      hint: "product of sums",
      type: "text",
      answer: "pos",
      alt: ["POS", "product of sums"],
    },
    {
      id: "flip-hold",
      title: "Hold toggle",
      prompt: "On starter, toggle a hold input (B or C) at least once.",
      hint: "Click B=1 or C=1",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "hold",
    },
    {
      id: "run-btn",
      title: "Run button",
      prompt: "Click Run transition (lastAction run).",
      hint: "Run transition",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "run" && state.ran,
    },
    {
      id: "full-fix",
      title: "Full fix",
      prompt: "Starter shows static-1; apply cover; verdict safe.",
      hint: "Starter → Apply consensus cover",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (!state.covered || state.circuit !== "covered") return false;
        const r = runSim();
        return r.cls.type === "safe" && state.flip === "A" && state.edge === "10";
      },
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

  function renderChallenge() {
    const c = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (clearedIds.length ? ` · ${clearedIds.length} cleared` : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${c.title}.</strong> ${c.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? "Hint: " + c.hint : "";
    const row = document.getElementById("chal-answer-row");
    row.innerHTML = "";
    if (c.type === "text") {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = "chal-input";
      inp.placeholder = "Your answer";
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
      row.appendChild(inp);
    }
    const st = document.getElementById("chal-status");
    st.textContent = isCleared(c.id) ? "Cleared" : "Idle";
    st.className =
      "challenge-status " + (isCleared(c.id) ? "pass" : "idle");

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kbd" + (i === challengeIdx ? " is-active" : "");
      b.textContent = (isCleared(ch.id) ? "✓ " : "") + ch.id;
      b.title = ch.title;
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
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
    const c = CHALLENGES[challengeIdx];
    if (typeof c.setup === "function") c.setup();
    renderChallenge();
    saveSession();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const c = CHALLENGES[challengeIdx];
    const st = document.getElementById("chal-status");
    let ok = false;
    if (c.type === "text") {
      const got = normalizeAns(answerDraft || "");
      const targets = [c.answer, ...(c.alt || [])].map(normalizeAns);
      ok = targets.includes(got);
    } else if (c.type === "state") {
      ok = !!c.check();
    }
    if (ok) {
      markCleared(c.id);
      st.textContent = "Pass";
      st.className = "challenge-status pass";
      pushLog("ok", `# challenge ${c.id} pass`);
    } else {
      st.textContent = "Fail";
      st.className = "challenge-status fail";
      pushLog("warn", `# challenge ${c.id} fail`);
    }
    renderChallenge();
    renderLog();
    saveSession();
  });

  // boot
  if (!loadSession()) loadStarter();
  else renderAll(true);
  renderChallenge();
})();
