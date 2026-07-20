(() => {
  /**
   * Canonical SOP / POS from a truth table:
   *   SOP = Σ minterms where F=1  (product terms OR’d)
   *   POS = Π maxterms where F=0  (sum terms AND’d)
   * Vars: 2 → A,B ; 3 → A,B,C  (A = MSB)
   */

  const VARSETS = {
    2: ["A", "B"],
    3: ["A", "B", "C"],
  };

  function rowsFor(n) {
    return 1 << n;
  }

  function bitsOf(i, n) {
    const out = [];
    for (let b = n - 1; b >= 0; b--) out.push((i >> b) & 1);
    return out;
  }

  function mintermLit(i, vars) {
    const bits = bitsOf(i, vars.length);
    return bits
      .map((bit, k) => (bit ? vars[k] : vars[k] + "'"))
      .join("");
  }

  function maxtermLit(i, vars) {
    const bits = bitsOf(i, vars.length);
    // maxterm: for each var, 0 → var, 1 → var'
    return (
      "(" +
      bits
        .map((bit, k) => (bit ? vars[k] + "'" : vars[k]))
        .join("+") +
      ")"
    );
  }

  function derive(f, n) {
    const vars = VARSETS[n];
    const ones = [];
    const zeros = [];
    for (let i = 0; i < rowsFor(n); i++) {
      if (f[i]) ones.push(i);
      else zeros.push(i);
    }
    let sop;
    if (ones.length === 0) sop = "0";
    else if (ones.length === rowsFor(n)) sop = "1";
    else sop = ones.map((i) => mintermLit(i, vars)).join(" + ");

    let pos;
    if (zeros.length === 0) pos = "1";
    else if (zeros.length === rowsFor(n)) pos = "0";
    else pos = zeros.map((i) => maxtermLit(i, vars)).join("");

    return {
      sop,
      pos,
      ones,
      zeros,
      sigma: ones.length ? `Σm(${ones.join(",")})` : "Σm(—)",
      pi: zeros.length ? `ΠM(${zeros.join(",")})` : "ΠM(—)",
    };
  }

  function makeStarter() {
    // 2-var XOR: F = A'B + AB'  → ones at 1,2
    return {
      n: 2,
      f: [0, 1, 1, 0],
      lastAction: "",
      toggled: false,
      derived: false,
      setXor: false,
      setAnd: false,
      setOr: false,
      setConst: false,
      setThree: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-sop-pos-cleared-v1";
  const STORE_KEY = "ddv-sop-pos-session-v1";

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

  const root = document.getElementById("sp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 2-variable <code>XOR</code> —
        F=1 on rows 1 and 2. SOP is <code>A'B + AB'</code>; POS uses the zero rows’ maxterms.</p>
      <button type="button" class="btn btn-secondary" id="sp-starter">Load starter example</button>
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
            <h3>SOP</h3>
            <p>Sum of products = OR of minterms where <code>F=1</code>.</p>
          </div>
          <div class="idea-card">
            <h3>POS</h3>
            <p>Product of sums = AND of maxterms where <code>F=0</code>.</p>
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
                <option value="2" selected>2 (A,B)</option>
                <option value="3">3 (A,B,C)</option>
              </select>
            </label>
          </div>
          <p class="legend">Click F to toggle 0/1. Green = 1 (minterm), amber = 0 (maxterm).</p>
          <table class="tt">
            <thead id="tt-head"></thead>
            <tbody id="tt-body"></tbody>
          </table>
          <div class="action-grid">
            <button type="button" id="btn-derive">Derive SOP &amp; POS</button>
            <button type="button" id="btn-xor">Preset XOR (2-var)</button>
            <button type="button" id="btn-and">Preset AND (2-var)</button>
            <button type="button" id="btn-or">Preset OR (2-var)</button>
            <button type="button" id="btn-zero">All zeros</button>
            <button type="button" id="btn-one">All ones</button>
            <button type="button" id="btn-explain">Explain dual</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Canonical forms</h2></div>
        <div class="panel-body">
          <div class="form-card">
            <h3>SOP</h3>
            <p class="expr" id="sop-expr">—</p>
            <div class="meta" id="sop-meta"></div>
          </div>
          <div class="form-card">
            <h3>POS</h3>
            <p class="expr" id="pos-expr">—</p>
            <div class="meta" id="pos-meta"></div>
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
          <thead><tr><th>Idea</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>Minterm m<sub>i</sub></td><td>Product that is 1 only on row i</td></tr>
            <tr><td>Maxterm M<sub>i</sub></td><td>Sum that is 0 only on row i</td></tr>
            <tr><td>SOP</td><td>Σ m<sub>i</sub> for F(i)=1</td></tr>
            <tr><td>POS</td><td>Π M<sub>i</sub> for F(i)=0</td></tr>
            <tr><td>Dual</td><td>Same F; ones ↔ SOP, zeros ↔ POS</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Canonical SOP/POS are not always minimal — K-maps shrink them.</li>
          <li>All-1 table → SOP <code>1</code>, POS empty product = <code>1</code>.</li>
          <li>All-0 table → SOP <code>0</code>, POS <code>0</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const nSel = document.getElementById("n-sel");
  const ttHead = document.getElementById("tt-head");
  const ttBody = document.getElementById("tt-body");
  const sopExpr = document.getElementById("sop-expr");
  const posExpr = document.getElementById("pos-expr");
  const sopMeta = document.getElementById("sop-meta");
  const posMeta = document.getElementById("pos-meta");
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

  function forms() {
    return derive(state.f, state.n);
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
      while (state.f.length < need) state.f.push(0);
    } else if (state.f.length > need) {
      state.f = state.f.slice(0, need);
    }
  }

  function renderTable() {
    ensureFLen();
    const vars = VARSETS[state.n];
    ttHead.innerHTML = `<tr><th>#</th>${vars
      .map((v) => `<th>${v}</th>`)
      .join("")}<th>F</th><th>term</th></tr>`;
    ttBody.innerHTML = "";
    for (let i = 0; i < rowsFor(state.n); i++) {
      const bits = bitsOf(i, state.n);
      const one = !!state.f[i];
      const tr = document.createElement("tr");
      tr.className = one ? "is-one" : "is-zero";
      const term = one
        ? mintermLit(i, vars)
        : maxtermLit(i, vars);
      tr.innerHTML = `<td>${i}</td>${bits.map((b) => `<td>${b}</td>`).join("")}`;
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fbtn " + (one ? "on" : "off");
      btn.textContent = one ? "1" : "0";
      btn.addEventListener("click", () => {
        state.f[i] = one ? 0 : 1;
        state.toggled = true;
        state.derived = false;
        state.lastAction = "toggle";
        pushLog("run", `# F[${i}] → ${state.f[i]}`);
        renderAll();
      });
      td.appendChild(btn);
      tr.appendChild(td);
      const td2 = document.createElement("td");
      td2.style.fontSize = "0.75rem";
      td2.style.color = "var(--muted)";
      td2.textContent = one ? `m${i}=${term}` : `M${i}=${term}`;
      tr.appendChild(td2);
      ttBody.appendChild(tr);
    }
  }

  function renderForms() {
    const d = forms();
    sopExpr.textContent = d.sop;
    posExpr.textContent = d.pos;
    sopMeta.textContent = `${d.sigma} · ${d.ones.length} minterm(s)`;
    posMeta.textContent = `${d.pi} · ${d.zeros.length} maxterm(s)`;
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(derive or explain)</span>';
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
    renderForms();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter XOR: F=[0,1,1,0]");
    state.trace = [];
    renderAll();
  }

  function deriveNow() {
    const d = forms();
    state.derived = true;
    state.lastAction = "derive";
    state.trace = [
      { kind: "muted", text: `canonical forms (${state.n} vars)` },
      { kind: "hi", text: `ones → ${d.sigma}` },
      { kind: "ok", text: `SOP = ${d.sop}` },
      { kind: "hi", text: `zeros → ${d.pi}` },
      { kind: "ok", text: `POS = ${d.pos}` },
    ];
    pushLog("ok", "# derived SOP & POS");
    renderAll();
  }

  function explainDual() {
    const d = forms();
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "same truth table → two writings" },
      {
        kind: "hi",
        text: `cover the 1s with minterms (${d.ones.join(",") || "none"})`,
      },
      {
        kind: "hi",
        text: `kill the 0s with maxterms (${d.zeros.join(",") || "none"})`,
      },
      { kind: "ok", text: "SOP and POS compute identical F" },
    ];
    pushLog("ok", "# explained dual");
    renderAll();
  }

  function setPreset(name, n, f) {
    state.n = n;
    state.f = f.slice();
    state.lastAction = "preset-" + name;
    if (name === "xor") state.setXor = true;
    if (name === "and") state.setAnd = true;
    if (name === "or") state.setOr = true;
    if (name === "zero" || name === "one") state.setConst = true;
    state.derived = false;
    pushLog("ok", `# preset ${name}`);
    renderAll();
  }

  document.getElementById("sp-starter").addEventListener("click", loadStarter);
  nSel.addEventListener("change", () => {
    state.n = Number(nSel.value);
    ensureFLen();
    if (state.n === 3) state.setThree = true;
    state.derived = false;
    state.lastAction = "vars";
    pushLog("run", `# vars → ${state.n}`);
    renderAll();
  });
  document.getElementById("btn-derive").addEventListener("click", deriveNow);
  document.getElementById("btn-explain").addEventListener("click", explainDual);
  document.getElementById("btn-xor").addEventListener("click", () =>
    setPreset("xor", 2, [0, 1, 1, 0])
  );
  document.getElementById("btn-and").addEventListener("click", () =>
    setPreset("and", 2, [0, 0, 0, 1])
  );
  document.getElementById("btn-or").addEventListener("click", () =>
    setPreset("or", 2, [0, 1, 1, 1])
  );
  document.getElementById("btn-zero").addEventListener("click", () =>
    setPreset(
      "zero",
      state.n,
      Array(rowsFor(state.n)).fill(0)
    )
  );
  document.getElementById("btn-one").addEventListener("click", () =>
    setPreset(
      "one",
      state.n,
      Array(rowsFor(state.n)).fill(1)
    )
  );

  const CHALLENGES = [
    {
      id: "quiz-sop",
      title: "Quiz: SOP",
      prompt: "SOP uses rows where F equals? Answer: <code>1</code>",
      hint: "minterms",
      type: "text",
      answer: "1",
      alt: ["one", "true"],
    },
    {
      id: "quiz-pos",
      title: "Quiz: POS",
      prompt: "POS uses rows where F equals? Answer: <code>0</code>",
      hint: "maxterms",
      type: "text",
      answer: "0",
      alt: ["zero", "false"],
    },
    {
      id: "quiz-minterm",
      title: "Quiz: minterm",
      prompt: "A product true on only one row is a? Answer: <code>minterm</code>",
      hint: "m_i",
      type: "text",
      answer: "minterm",
      alt: ["minterms", "m"],
    },
    {
      id: "quiz-maxterm",
      title: "Quiz: maxterm",
      prompt: "A sum false on only one row is a? Answer: <code>maxterm</code>",
      hint: "M_i",
      type: "text",
      answer: "maxterm",
      alt: ["maxterms", "M"],
    },
    {
      id: "starter-xor",
      title: "Starter XOR",
      prompt: "Load starter — F ones at rows 1 and 2.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.n === 2 &&
        state.f.join("") === "0110",
    },
    {
      id: "derive-xor",
      title: "Derive XOR",
      prompt: "Derive SOP & POS for starter XOR.",
      hint: "Derive button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return (
          state.derived &&
          d.sop.replace(/\s+/g, "") === "A'B+AB'" &&
          d.ones.join(",") === "1,2"
        );
      },
    },
    {
      id: "xor-pos",
      title: "XOR POS",
      prompt: "Starter XOR POS should include M0 and M3.",
      hint: "Derive — check POS",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return (
          d.zeros.join(",") === "0,3" &&
          d.pos.includes("A+B") &&
          d.pos.includes("A'+B'")
        );
      },
    },
    {
      id: "preset-and",
      title: "Preset AND",
      prompt: "Preset AND — only m3; SOP = AB.",
      hint: "Preset AND",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return state.setAnd && d.sop === "AB" && d.ones.join(",") === "3";
      },
    },
    {
      id: "preset-or",
      title: "Preset OR",
      prompt: "Preset OR — zeros only row 0; POS = (A+B).",
      hint: "Preset OR",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return state.setOr && d.pos === "(A+B)" && d.zeros.join(",") === "0";
      },
    },
    {
      id: "all-zero",
      title: "All zero",
      prompt: "All zeros — SOP is 0.",
      hint: "All zeros",
      type: "state",
      setup: () => loadStarter(),
      check: () => forms().sop === "0" && state.setConst,
    },
    {
      id: "all-one",
      title: "All ones",
      prompt: "All ones — SOP is 1 and POS is 1.",
      hint: "All ones",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return d.sop === "1" && d.pos === "1" && state.setConst;
      },
    },
    {
      id: "toggle-row",
      title: "Toggle F",
      prompt: "Toggle any F cell.",
      hint: "click F",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggled,
    },
    {
      id: "quiz-sigma",
      title: "Quiz: sigma",
      prompt: "Σm notation lists? Answer: <code>minterms</code>",
      hint: "ones",
      type: "text",
      answer: "minterms",
      alt: ["minterm", "ones", "1-rows"],
    },
    {
      id: "three-vars",
      title: "3 variables",
      prompt: "Switch to 3 variables (A,B,C).",
      hint: "Variables → 3",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.n === 3 && state.setThree,
    },
    {
      id: "explain-dual",
      title: "Explain dual",
      prompt: "Click Explain dual.",
      hint: "Explain dual",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "explain",
    },
    {
      id: "quiz-canonical",
      title: "Quiz: minimal?",
      prompt: "Canonical SOP is always minimal? Answer: <code>no</code>",
      hint: "K-map",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "and-pos",
      title: "AND POS",
      prompt: "AND function POS has three maxterms (rows 0,1,2).",
      hint: "Preset AND → check zeros",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return state.setAnd && d.zeros.join(",") === "0,1,2" && d.ones.join(",") === "3";
      },
    },
    {
      id: "quiz-m0",
      title: "Quiz: m0",
      prompt: "2-var minterm m0 literal? Answer: <code>A'B'</code>",
      hint: "row 00",
      type: "text",
      answer: "a'b'",
      alt: ["A'B'", "a'b'", "~a~b"],
    },
    {
      id: "quiz-M0",
      title: "Quiz: M0",
      prompt: "2-var maxterm M0? Answer: <code>(A+B)</code>",
      hint: "row 00",
      type: "text",
      answer: "(a+b)",
      alt: ["(A+B)", "a+b"],
    },
    {
      id: "build-nand",
      title: "Build NAND",
      prompt: "2-var: F=1 on rows 0,1,2 (NAND) — SOP has three products.",
      hint: "toggle to 1,1,1,0",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return (
          state.n === 2 &&
          state.f.join("") === "1110" &&
          d.ones.length === 3 &&
          d.zeros.join(",") === "3"
        );
      },
    },
    {
      id: "nand-pos",
      title: "NAND POS",
      prompt: "NAND table POS is just M3 = (A'+B').",
      hint: "F=1110",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = forms();
        return state.f.join("") === "1110" && d.pos === "(A'+B')";
      },
    },
    {
      id: "full-dual",
      title: "Full dual",
      prompt: "XOR table, derive, then explain dual.",
      hint: "starter/XOR → Derive → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.f.join("") === "0110" &&
        state.derived &&
        state.lastAction === "explain",
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

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
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:14rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the table / derive, then Check.</span>`;
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
    saveSession();
  }

  function checkChallenge() {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const ans = normalizeAns(document.getElementById("chal-ans")?.value || "");
      const want = [ch.answer, ...(ch.alt || [])].map(normalizeAns);
      ok = want.includes(ans);
    } else {
      try {
        ok = !!ch.check();
      } catch {
        ok = false;
      }
    }
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds = [...clearedIds, ch.id];
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("pass", "Pass");
      renderChallenge();
    } else setChalStatus("fail", "Not yet");
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
