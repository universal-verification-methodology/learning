(() => {
  /**
   * Don’t-care minimization (SOP):
   *   ON  = rows F=1  (must cover)
   *   OFF = rows F=0  (must stay 0)
   *   DC  = rows F=X  (free — may treat as 1 when forming cubes)
   * Quine–McCluskey primes from ON∪DC; cover only ON.
   */

  const VARSETS = {
    2: ["A", "B"],
    3: ["A", "B", "C"],
  };

  /** @typedef {"0"|"1"|"x"} Cell */

  function rowsFor(n) {
    return 1 << n;
  }

  function bitsOf(i, n) {
    const out = [];
    for (let b = n - 1; b >= 0; b--) out.push((i >> b) & 1);
    return out;
  }

  function mintermLit(i, vars) {
    return bitsOf(i, vars.length)
      .map((bit, k) => (bit ? vars[k] : vars[k] + "'"))
      .join("");
  }

  /** Cube: dash mask + bit pattern for fixed bits (MSB = var 0). */
  function cubeKey(mask, bits, n) {
    let s = "";
    for (let b = n - 1; b >= 0; b--) {
      const m = 1 << b;
      s += mask & m ? "-" : bits & m ? "1" : "0";
    }
    return s;
  }

  function cubeLit(mask, bits, vars) {
    const parts = [];
    for (let k = 0; k < vars.length; k++) {
      const m = 1 << (vars.length - 1 - k);
      if (mask & m) continue;
      parts.push(bits & m ? vars[k] : vars[k] + "'");
    }
    return parts.length ? parts.join("") : "1";
  }

  function popcount(x) {
    let c = 0;
    while (x) {
      c += x & 1;
      x >>= 1;
    }
    return c;
  }

  function onesOfCube(mask, bits, n) {
    const free = [];
    for (let b = 0; b < n; b++) {
      if (mask & (1 << b)) free.push(b);
    }
    const out = [];
    const lim = 1 << free.length;
    for (let t = 0; t < lim; t++) {
      let v = bits;
      for (let i = 0; i < free.length; i++) {
        if (t & (1 << i)) v |= 1 << free[i];
        else v &= ~(1 << free[i]);
      }
      out.push(v);
    }
    return out;
  }

  /**
   * Minimal SOP covering ON, using DC as optional 1s.
   * @param {number[]} on
   * @param {number[]} dc
   * @param {number} n
   */
  function minimize(on, dc, n) {
    const vars = VARSETS[n];
    if (on.length === 0) {
      return {
        expr: "0",
        terms: [],
        termCount: 0,
        litCount: 0,
        primes: [],
        sigmaOn: "Σm(—)",
        sigmaDc: dc.length ? `d(${dc.join(",")})` : "d(—)",
      };
    }

    const usable = new Set([...on, ...dc]);
    /** @type {{mask:number,bits:number,minterms:number[],used:boolean}[]} */
    let stage = [...usable].map((m) => ({
      mask: 0,
      bits: m,
      minterms: [m],
      used: false,
    }));

    /** @type {Map<string,{mask:number,bits:number,minterms:number[]}>} */
    const primeMap = new Map();

    while (stage.length) {
      stage.forEach((c) => {
        c.used = false;
      });
      /** @type {Map<string,{mask:number,bits:number,minterms:number[],used:boolean}>} */
      const nextMap = new Map();
      for (let i = 0; i < stage.length; i++) {
        for (let j = i + 1; j < stage.length; j++) {
          const a = stage[i];
          const b = stage[j];
          if (a.mask !== b.mask) continue;
          const diff = a.bits ^ b.bits;
          if (popcount(diff) !== 1) continue;
          const mask = a.mask | diff;
          const bits = a.bits & b.bits;
          const key = cubeKey(mask, bits, n);
          const minterms = [
            ...new Set([...a.minterms, ...b.minterms]),
          ].sort((x, y) => x - y);
          a.used = true;
          b.used = true;
          if (!nextMap.has(key)) {
            nextMap.set(key, { mask, bits, minterms, used: false });
          }
        }
      }
      for (const c of stage) {
        if (!c.used) {
          const key = cubeKey(c.mask, c.bits, n);
          if (!primeMap.has(key)) {
            primeMap.set(key, {
              mask: c.mask,
              bits: c.bits,
              minterms: c.minterms.slice(),
            });
          }
        }
      }
      stage = [...nextMap.values()];
    }

    const primes = [...primeMap.values()].map((p) => ({
      ...p,
      lit: cubeLit(p.mask, p.bits, vars),
      covers: onesOfCube(p.mask, p.bits, n).filter((m) => on.includes(m)),
    }));

    // Cover ON with fewest primes (then fewest literals) — brute for n≤3
    const need = on.slice().sort((a, b) => a - b);
    let best = null;
    const P = primes.length;
    const lim = 1 << P;
    for (let mask = 1; mask < lim; mask++) {
      const chosen = [];
      const covered = new Set();
      for (let i = 0; i < P; i++) {
        if (!(mask & (1 << i))) continue;
        chosen.push(primes[i]);
        primes[i].covers.forEach((m) => covered.add(m));
      }
      if (![...need].every((m) => covered.has(m))) continue;
      const termCount = chosen.length;
      const litCount = chosen.reduce(
        (s, c) => s + (c.lit === "1" ? 0 : c.lit.replace(/'/g, "").length),
        0
      );
      const score = termCount * 100 + litCount;
      if (
        !best ||
        score < best.score ||
        (score === best.score &&
          chosen
            .map((c) => c.lit)
            .sort()
            .join("+") < best.exprKey)
      ) {
        best = {
          score,
          terms: chosen,
          termCount,
          litCount,
          exprKey: chosen
            .map((c) => c.lit)
            .sort()
            .join("+"),
        };
      }
    }

    if (!best) {
      // fallback: each ON minterm
      const terms = need.map((i) => ({
        lit: mintermLit(i, vars),
        mask: 0,
        bits: i,
        covers: [i],
      }));
      best = {
        terms,
        termCount: terms.length,
        litCount: terms.reduce((s, t) => s + n, 0),
        exprKey: terms.map((t) => t.lit).join("+"),
      };
    }

    const expr =
      best.terms.length === 0
        ? "0"
        : best.terms.every((t) => t.lit === "1")
          ? "1"
          : best.terms
              .map((t) => t.lit)
              .sort()
              .join(" + ");

    return {
      expr,
      terms: best.terms,
      termCount: best.termCount,
      litCount: best.litCount,
      primes: primes.map((p) => p.lit),
      sigmaOn: `Σm(${need.join(",")})`,
      sigmaDc: dc.length ? `d(${dc.join(",")})` : "d(—)",
    };
  }

  function partition(f) {
    const on = [];
    const off = [];
    const dc = [];
    f.forEach((v, i) => {
      if (v === "1") on.push(i);
      else if (v === "x") dc.push(i);
      else off.push(i);
    });
    return { on, off, dc };
  }

  function analyze(f, n) {
    const { on, off, dc } = partition(f);
    const withDc = minimize(on, dc, n);
    const without = minimize(on, [], n);
    const shrunk =
      withDc.termCount < without.termCount ||
      (withDc.termCount === without.termCount &&
        withDc.litCount < without.litCount);
    return { on, off, dc, withDc, without, shrunk };
  }

  function makeStarter() {
    // Σm(0,2,5,7)+d(1,3) → without A'C'+AC ; with A'+C
    return {
      n: 3,
      f: /** @type {Cell[]} */ (["1", "x", "1", "x", "0", "1", "0", "1"]),
      lastAction: "",
      toggled: false,
      minimized: false,
      compared: false,
      setStarter: false,
      setTwoVar: false,
      setNoDc: false,
      setAllDc: false,
      setAnd: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-dont-care-cleared-v1";
  const STORE_KEY = "ddv-dont-care-session-v1";

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

  const root = document.getElementById("dc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 3-var
        <code>Σm(0,2,5,7)+d(1,3)</code> —
        without X: <code>A'C' + AC</code>; with X: <code>A' + C</code>.</p>
      <button type="button" class="btn btn-secondary" id="dc-starter">Load starter example</button>
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
            <h3>ON-set</h3>
            <p>Rows <code>F=1</code> — every cover must hit these.</p>
          </div>
          <div class="idea-card">
            <h3>Don’t-care</h3>
            <p>Rows <code>F=X</code> — free; may join cubes as 1s.</p>
          </div>
          <div class="idea-card">
            <h3>OFF-set</h3>
            <p>Rows <code>F=0</code> — cubes must never include these.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Truth table</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Variables
              <select id="n-sel">
                <option value="2">2 (A,B)</option>
                <option value="3" selected>3 (A,B,C)</option>
              </select>
            </label>
          </div>
          <p class="legend">Click F to cycle 0 → 1 → X → 0. Blue = don’t-care.</p>
          <table class="tt">
            <thead id="tt-head"></thead>
            <tbody id="tt-body"></tbody>
          </table>
          <div class="action-grid">
            <button type="button" id="btn-minimize">Minimize with X</button>
            <button type="button" id="btn-compare">Compare with / without X</button>
            <button type="button" id="btn-starter-preset">Preset starter (3-var)</button>
            <button type="button" id="btn-two">Preset 2-var: m(1)+d(3)</button>
            <button type="button" id="btn-nodc">Clear all X → 0</button>
            <button type="button" id="btn-explain">Explain shrink</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Covers</h2></div>
        <div class="panel-body">
          <div class="compare-grid">
            <div class="form-card" id="card-without">
              <h3>Ignore X (treat as 0)</h3>
              <p class="expr" id="expr-without">—</p>
              <div class="meta" id="meta-without"></div>
            </div>
            <div class="form-card" id="card-with">
              <h3>Use X as optional 1s</h3>
              <p class="expr" id="expr-with">—</p>
              <div class="meta" id="meta-with"></div>
              <div id="shrink-note"></div>
            </div>
          </div>
          <pre class="trace-box" id="trace-box" style="margin-top:0.55rem"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Idea</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>X / don’t-care</td><td>Input never occurs, or either output is OK</td></tr>
            <tr><td>Must cover</td><td>Only ON-set minterms</td></tr>
            <tr><td>May use</td><td>DC minterms inside larger cubes</td></tr>
            <tr><td>Must avoid</td><td>OFF-set — never merge into a 0</td></tr>
            <tr><td>Win</td><td>Fewer product terms / literals than ignoring X</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter shrink: <code>A'C' + AC</code> → <code>A' + C</code>.</li>
          <li>2-var: <code>m(1)+d(3)</code> → ignore X: <code>A'B</code>; with X: <code>B</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const nSel = document.getElementById("n-sel");
  const ttHead = document.getElementById("tt-head");
  const ttBody = document.getElementById("tt-body");
  const exprWithout = document.getElementById("expr-without");
  const exprWith = document.getElementById("expr-with");
  const metaWithout = document.getElementById("meta-without");
  const metaWith = document.getElementById("meta-with");
  const cardWithout = document.getElementById("card-without");
  const cardWith = document.getElementById("card-with");
  const shrinkNote = document.getElementById("shrink-note");
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
      nSel.value = String(state.n);
      return true;
    } catch {
      return false;
    }
  }

  function ensureFLen() {
    const need = rowsFor(state.n);
    if (state.f.length < need) {
      while (state.f.length < need) state.f.push("0");
    } else if (state.f.length > need) {
      state.f = state.f.slice(0, need);
    }
  }

  function cycleCell(v) {
    if (v === "0") return "1";
    if (v === "1") return "x";
    return "0";
  }

  function renderTable() {
    ensureFLen();
    const vars = VARSETS[state.n];
    ttHead.innerHTML = `<tr><th>#</th>${vars
      .map((v) => `<th>${v}</th>`)
      .join("")}<th>F</th><th>role</th></tr>`;
    ttBody.innerHTML = "";
    for (let i = 0; i < rowsFor(state.n); i++) {
      const bits = bitsOf(i, state.n);
      const v = state.f[i];
      const tr = document.createElement("tr");
      tr.className =
        v === "1" ? "is-one" : v === "x" ? "is-dc" : "is-zero";
      const role =
        v === "1" ? `ON m${i}` : v === "x" ? `DC d${i}` : `OFF`;
      tr.innerHTML = `<td>${i}</td>${bits.map((b) => `<td>${b}</td>`).join("")}`;
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "fbtn " + (v === "1" ? "on" : v === "x" ? "dc" : "off");
      btn.textContent = v === "x" ? "X" : v;
      btn.addEventListener("click", () => {
        state.f[i] = cycleCell(v);
        state.toggled = true;
        state.minimized = false;
        state.compared = false;
        state.lastAction = "toggle";
        pushLog("run", `# F[${i}] → ${state.f[i]}`);
        renderAll();
      });
      td.appendChild(btn);
      tr.appendChild(td);
      const td2 = document.createElement("td");
      td2.style.fontSize = "0.75rem";
      td2.style.color = "var(--muted)";
      td2.textContent = role;
      tr.appendChild(td2);
      ttBody.appendChild(tr);
    }
  }

  function renderCovers() {
    const a = analyze(state.f, state.n);
    exprWithout.textContent = a.without.expr;
    exprWith.textContent = a.withDc.expr;
    metaWithout.textContent = `${a.without.sigmaOn} · ${a.without.termCount} term(s), ${a.without.litCount} lit`;
    metaWith.textContent = `${a.withDc.sigmaOn} ${a.withDc.sigmaDc} · ${a.withDc.termCount} term(s), ${a.withDc.litCount} lit`;
    cardWithout.classList.toggle("win", !a.shrunk && a.dc.length > 0);
    cardWith.classList.toggle("win", a.shrunk);
    if (a.dc.length === 0) {
      shrinkNote.innerHTML =
        '<span class="legend">No X rows — both covers match.</span>';
    } else if (a.shrunk) {
      shrinkNote.innerHTML =
        '<span class="shrink-badge">X helped — smaller cover</span>';
    } else {
      shrinkNote.innerHTML =
        '<span class="legend">X present but cover size unchanged.</span>';
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(minimize or compare)</span>';
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

  function renderAll() {
    nSel.value = String(state.n);
    renderTable();
    renderCovers();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.setStarter = true;
    state.lastAction = "load-starter";
    pushLog("muted", "# starter Σm(0,2,5,7)+d(1,3)");
    state.trace = [];
    renderAll();
  }

  function minimizeNow() {
    const a = analyze(state.f, state.n);
    state.minimized = true;
    state.lastAction = "minimize";
    state.trace = [
      { kind: "muted", text: "minimize using don’t-cares" },
      { kind: "hi", text: `ON  ${a.withDc.sigmaOn}` },
      { kind: "hi", text: `DC  ${a.withDc.sigmaDc}` },
      { kind: "ok", text: `SOP = ${a.withDc.expr}` },
      {
        kind: "muted",
        text: `${a.withDc.termCount} term(s), ${a.withDc.litCount} literal(s)`,
      },
    ];
    pushLog("ok", "# minimized with X");
    renderAll();
  }

  function compareNow() {
    const a = analyze(state.f, state.n);
    state.compared = true;
    state.minimized = true;
    state.lastAction = "compare";
    state.trace = [
      { kind: "muted", text: "same ON-set, different use of X" },
      { kind: "warn", text: `ignore X → ${a.without.expr}` },
      { kind: "ok", text: `use X    → ${a.withDc.expr}` },
      {
        kind: a.shrunk ? "ok" : "muted",
        text: a.shrunk
          ? "don’t-cares shrank the cover"
          : a.dc.length
            ? "cover size unchanged"
            : "no X to exploit",
      },
    ];
    pushLog("ok", "# compared covers");
    renderAll();
  }

  function explainShrink() {
    const a = analyze(state.f, state.n);
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "why X can shrink SOP" },
      {
        kind: "hi",
        text: "cubes grow by absorbing adjacent DC minterms",
      },
      {
        kind: "hi",
        text: "OFF rows still block illegal merges",
      },
      {
        kind: "ok",
        text: a.shrunk
          ? `here: ${a.without.expr} → ${a.withDc.expr}`
          : "load starter to see A'C'+AC → A'+C",
      },
    ];
    pushLog("ok", "# explained shrink");
    renderAll();
  }

  function setPreset(name, n, f) {
    state.n = n;
    state.f = f.slice();
    state.lastAction = "preset-" + name;
    if (name === "starter") state.setStarter = true;
    if (name === "two") state.setTwoVar = true;
    if (name === "nodc") state.setNoDc = true;
    if (name === "and") state.setAnd = true;
    state.minimized = false;
    state.compared = false;
    pushLog("ok", `# preset ${name}`);
    renderAll();
  }

  document.getElementById("dc-starter").addEventListener("click", loadStarter);
  nSel.addEventListener("change", () => {
    state.n = Number(nSel.value);
    ensureFLen();
    state.minimized = false;
    state.compared = false;
    state.lastAction = "vars";
    pushLog("run", `# vars → ${state.n}`);
    renderAll();
  });
  document.getElementById("btn-minimize").addEventListener("click", minimizeNow);
  document.getElementById("btn-compare").addEventListener("click", compareNow);
  document.getElementById("btn-explain").addEventListener("click", explainShrink);
  document.getElementById("btn-starter-preset").addEventListener("click", () =>
    setPreset("starter", 3, ["1", "x", "1", "x", "0", "1", "0", "1"])
  );
  document.getElementById("btn-two").addEventListener("click", () =>
    setPreset("two", 2, ["0", "1", "0", "x"])
  );
  document.getElementById("btn-nodc").addEventListener("click", () => {
    state.f = state.f.map((v) => (v === "x" ? "0" : v));
    state.setNoDc = true;
    state.lastAction = "preset-nodc";
    state.minimized = false;
    state.compared = false;
    pushLog("ok", "# cleared X → 0");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-x",
      title: "Quiz: X",
      prompt: "Don’t-care rows are written as? Answer: <code>X</code>",
      hint: "third value besides 0/1",
      type: "text",
      answer: "x",
      alt: ["X", "don't care", "dont care", "dc"],
    },
    {
      id: "quiz-must",
      title: "Quiz: must cover",
      prompt: "Which set must every SOP cover? Answer: <code>ON</code>",
      hint: "F=1 rows",
      type: "text",
      answer: "on",
      alt: ["on-set", "ones", "1", "onset"],
    },
    {
      id: "quiz-optional",
      title: "Quiz: optional",
      prompt: "DC minterms are? Answer: <code>optional</code>",
      hint: "may use, need not cover",
      type: "text",
      answer: "optional",
      alt: ["free", "optional cover", "may use"],
    },
    {
      id: "quiz-off",
      title: "Quiz: OFF",
      prompt: "Cubes must never include which set? Answer: <code>OFF</code>",
      hint: "F=0",
      type: "text",
      answer: "off",
      alt: ["off-set", "zeros", "0", "offset"],
    },
    {
      id: "starter-load",
      title: "Starter load",
      prompt: "Load starter — ON at 0,2,5,7 and X at 1,3.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const a = analyze(state.f, state.n);
        return (
          state.n === 3 &&
          a.on.join(",") === "0,2,5,7" &&
          a.dc.join(",") === "1,3"
        );
      },
    },
    {
      id: "starter-without",
      title: "Starter without X",
      prompt: "On starter, ignore-X cover should be <code>A'C' + AC</code> (order free).",
      hint: "Look at left card after load",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const e = analyze(state.f, state.n).without.expr.replace(/\s/g, "");
        return e === "A'C'+AC" || e === "AC+A'C'";
      },
    },
    {
      id: "starter-with",
      title: "Starter with X",
      prompt: "On starter, with-X cover should be <code>A' + C</code>.",
      hint: "Right card / Minimize",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const e = analyze(state.f, state.n).withDc.expr.replace(/\s/g, "");
        return e === "A'+C" || e === "C+A'";
      },
    },
    {
      id: "minimize-click",
      title: "Minimize",
      prompt: "Click Minimize with X on the starter.",
      hint: "Minimize with X button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.minimized && state.lastAction === "minimize",
    },
    {
      id: "compare-click",
      title: "Compare",
      prompt: "Run Compare with / without X.",
      hint: "Compare button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.compared && state.lastAction === "compare",
    },
    {
      id: "quiz-shrink",
      title: "Quiz: shrink",
      prompt: "Starter with X has how many product terms? Answer: <code>2</code>",
      hint: "A' + C",
      type: "text",
      answer: "2",
      alt: ["two"],
    },
    {
      id: "two-var",
      title: "2-var preset",
      prompt: "Preset 2-var m(1)+d(3) — with X should be <code>B</code>.",
      hint: "Preset 2-var button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const a = analyze(state.f, state.n);
        return (
          state.setTwoVar &&
          state.n === 2 &&
          a.withDc.expr === "B" &&
          a.without.expr === "A'B"
        );
      },
    },
    {
      id: "two-without",
      title: "2-var ignore",
      prompt: "On that 2-var table, ignore-X SOP is <code>A'B</code>.",
      hint: "Preset 2-var first",
      type: "state",
      setup: () => setPreset("two", 2, ["0", "1", "0", "x"]),
      check: () =>
        state.n === 2 &&
        analyze(state.f, state.n).without.expr === "A'B",
    },
    {
      id: "clear-x",
      title: "Clear X",
      prompt: "From starter, clear all X → 0 (covers should match).",
      hint: "Clear all X → 0",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const a = analyze(state.f, state.n);
        return (
          state.setNoDc &&
          a.dc.length === 0 &&
          a.withDc.expr === a.without.expr
        );
      },
    },
    {
      id: "toggle-dc",
      title: "Toggle X",
      prompt: "Cycle any F cell to X (blue).",
      hint: "Click F until X",
      type: "state",
      setup: () => {
        state = makeStarter();
        state.f = ["0", "0", "0", "0"];
        state.n = 2;
        state.trace = [];
        renderAll();
      },
      check: () => state.f.some((v) => v === "x") && state.toggled,
    },
    {
      id: "quiz-sigma",
      title: "Quiz: notation",
      prompt: "Don’t-cares in Σ notation use letter? Answer: <code>d</code>",
      hint: "Σm(...)+d(...)",
      type: "text",
      answer: "d",
      alt: ["D", "dc"],
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain shrink.",
      hint: "Explain shrink button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "explain",
    },
    {
      id: "quiz-win",
      title: "Quiz: win",
      prompt: "X helps when the cover becomes? Answer: <code>smaller</code>",
      hint: "fewer terms/literals",
      type: "text",
      answer: "smaller",
      alt: ["smaller cover", "fewer", "minimal", "shorter"],
    },
    {
      id: "and-no-help",
      title: "AND no X",
      prompt: "2-var AND (only m3=1, no X) — both covers <code>AB</code>.",
      hint: "Set table to 0,0,0,1",
      type: "state",
      setup: () => {
        setPreset("and", 2, ["0", "0", "0", "1"]);
      },
      check: () => {
        const a = analyze(state.f, state.n);
        return (
          state.n === 2 &&
          a.on.join(",") === "3" &&
          a.dc.length === 0 &&
          a.withDc.expr === "AB"
        );
      },
    },
    {
      id: "starter-shrunk-flag",
      title: "Shrink flag",
      prompt: "On starter, analysis should report X helped (shrunk).",
      hint: "Load starter — green badge",
      type: "state",
      setup: () => loadStarter(),
      check: () => analyze(state.f, state.n).shrunk === true,
    },
    {
      id: "three-off",
      title: "Keep OFF",
      prompt: "Starter OFF rows stay 4 and 6 (never covered).",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => analyze(state.f, state.n).off.join(",") === "4,6",
    },
    {
      id: "quiz-qm",
      title: "Quiz: method",
      prompt: "This lab builds primes via? Answer: <code>Quine-McCluskey</code>",
      hint: "tabular minimization",
      type: "text",
      answer: "quine-mccluskey",
      alt: [
        "quine mccluskey",
        "qm",
        "Quine-McCluskey",
        "quine–mccluskey",
      ],
    },
    {
      id: "full-compare",
      title: "Full compare",
      prompt: "Starter loaded, then Compare (see both expressions).",
      hint: "Load starter → Compare",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const a = analyze(state.f, state.n);
        return (
          a.on.join(",") === "0,2,5,7" &&
          a.dc.join(",") === "1,3" &&
          state.compared &&
          a.shrunk
        );
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

  if (!loadSession()) loadStarter();
  else renderAll();
  if (typeof CHALLENGES[challengeIdx].setup === "function") {
    /* keep restored table; don't reset on first paint */
  }
  renderChallenge();
})();
