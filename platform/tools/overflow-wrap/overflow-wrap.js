(() => {
  /**
   * Fixed-width add/sub:
   *   wrapped = (a ± b) mod 2^w   (always — hardware wrap)
   *   unsigned wrap flag: true math outside [0, 2^w−1]
   *   signed overflow: two’s result not in [−2^(w−1), 2^(w−1)−1]
   *     (classic: same-sign operands, result sign differs)
   */

  function mod(w) {
    return 1n << BigInt(w);
  }

  function mask(w) {
    return mod(w) - 1n;
  }

  function toSigned(u, w) {
    const v = BigInt(u) & mask(w);
    const half = 1n << BigInt(w - 1);
    return v >= half ? v - mod(w) : v;
  }

  function toUnsigned(n, w) {
    return BigInt.asUintN(w, BigInt(n));
  }

  function uRange(w) {
    return { min: 0n, max: mask(w) };
  }

  function sRange(w) {
    const half = 1n << BigInt(w - 1);
    return { min: -half, max: half - 1n };
  }

  function compute(a, b, op, w, mode) {
    const A = BigInt(a);
    const B = BigInt(b);
    const trueMath = op === "add" ? A + B : A - B;
    const wrappedU = toUnsigned(trueMath, w);
    const wrappedS = toSigned(wrappedU, w);

    let wrapU = false;
    let overflowS = false;

    if (mode === "unsigned") {
      const { min, max } = uRange(w);
      wrapU = trueMath < min || trueMath > max;
    } else {
      const { min, max } = sRange(w);
      overflowS = trueMath < min || trueMath > max;
      // also note modular wrap always happens in bits
      wrapU = toUnsigned(trueMath, w) !== trueMath && trueMath >= 0n
        ? true
        : toSigned(toUnsigned(trueMath, w), w) !== trueMath;
      // clearer: signed overflow is the teaching flag
    }

    return {
      trueMath,
      wrappedU,
      wrappedS,
      wrapU: mode === "unsigned" ? wrapU : trueMath !== wrappedS && (trueMath < sRange(w).min || trueMath > sRange(w).max) ? true : wrapU,
      overflowS: mode === "signed" ? overflowS : false,
      display: mode === "unsigned" ? wrappedU : wrappedS,
    };
  }

  function makeStarter() {
    return {
      width: 4,
      mode: "unsigned",
      a: 14n,
      b: 3n,
      op: "add",
      last: null,
      lastAction: "",
      didAdd: false,
      didSub: false,
      sawWrap: false,
      sawOverflow: false,
      setWidth: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-overflow-wrap-cleared-v1";
  const STORE_KEY = "ddv-overflow-wrap-session-v1";

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

  const root = document.getElementById("ow-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Width 4, unsigned <code>14 + 3</code>.
        True sum 17 wraps to <code>1</code> (mod 16). Switch to signed and try
        <code>7 + 1</code> for overflow.</p>
      <button type="button" class="btn btn-secondary" id="ow-starter">Load starter example</button>
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
            <h3>Wrap</h3>
            <p>Bits always compute <code>mod 2^w</code>. Unsigned “overflow” is modular wrap.</p>
          </div>
          <div class="idea-card">
            <h3>Signed overflow</h3>
            <p>Result bits exist, but the signed meaning left the representable range.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Add / sub</h2></div>
        <div class="panel-body">
          <div class="status-pill idle" id="status-pill">idle</div>
          <div class="mode-row">
            <label><input type="radio" name="mode" value="unsigned" checked> Unsigned</label>
            <label><input type="radio" name="mode" value="signed"> Signed</label>
          </div>
          <div class="ctrl-row">
            <label>Width
              <select id="w-sel">
                <option value="3">3</option>
                <option value="4" selected>4</option>
                <option value="8">8</option>
              </select>
            </label>
            <label>A <input id="a-in" type="text" style="width:5rem" value="14"></label>
            <label>B <input id="b-in" type="text" style="width:5rem" value="3"></label>
          </div>
          <div class="range-bar" id="range-bar"></div>
          <div class="ring" id="ring" title="position of wrapped result on 0…2^w-1"><div class="fill" id="ring-fill"></div><div class="mark" id="ring-mark"></div></div>
          <div class="vals-grid">
            <div class="val-card"><span class="lbl">True math</span><span id="val-true"></span></div>
            <div class="val-card" id="card-wrap"><span class="lbl">Stored bits (wrapped)</span><span id="val-wrap"></span></div>
            <div class="val-card"><span class="lbl">As unsigned</span><span id="val-u"></span></div>
            <div class="val-card"><span class="lbl">As signed</span><span id="val-s"></span></div>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-add">Add A + B</button>
            <button type="button" id="btn-sub">Sub A − B</button>
            <button type="button" id="btn-demo-u">Demo: unsigned 14+3 (w=4)</button>
            <button type="button" id="btn-demo-s">Demo: signed 7+1 (w=4)</button>
            <button type="button" id="btn-max">Set A = max for mode</button>
            <button type="button" id="btn-inc">A = A+1 (wrapped)</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Trace &amp; log</h2></div>
        <div class="panel-body">
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
            <tr><td>Hardware</td><td>Adder output is always truncated to <code>w</code> bits</td></tr>
            <tr><td>Unsigned</td><td>Wrap = result ≢ true sum in <code>[0, 2^w−1]</code></td></tr>
            <tr><td>Signed</td><td>Overflow = true sum outside <code>[−2^(w−1), 2^(w−1)−1]</code></td></tr>
            <tr><td>Flags</td><td>Carry ≠ signed overflow — different detectors</td></tr>
            <tr><td>Counters</td><td>Free-running counters rely on wrap</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Same bit pattern can be fine unsigned and overflowing signed (or vice versa).</li>
          <li>In HDL, <code>+</code> on <code>logic [w-1:0]</code> wraps; check overflow explicitly if needed.</li>
          <li>Saturation is a different policy — clamp instead of wrap.</li>
        </ul>
      </div>
    </div>
  `;

  const wSel = document.getElementById("w-sel");
  const aIn = document.getElementById("a-in");
  const bIn = document.getElementById("b-in");
  const statusPill = document.getElementById("status-pill");
  const rangeBar = document.getElementById("range-bar");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const ringFill = document.getElementById("ring-fill");
  const ringMark = document.getElementById("ring-mark");

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

  function parseOperand(raw, w, mode) {
    const s = String(raw).trim();
    let n;
    if (/^0x/i.test(s)) n = BigInt(s);
    else n = BigInt(s);
    if (mode === "unsigned") {
      if (n < 0n) n = toUnsigned(n, w);
      return toUnsigned(n, w);
    }
    // signed: allow out-of-range input then truncate for storage
    return toSigned(toUnsigned(n, w), w);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state: {
            ...state,
            a: state.a.toString(),
            b: state.b.toString(),
            last: state.last
              ? {
                  ...state.last,
                  trueMath: state.last.trueMath.toString(),
                  wrappedU: state.last.wrappedU.toString(),
                  wrappedS: state.last.wrappedS.toString(),
                  display: state.last.display.toString(),
                }
              : null,
          },
          challengeIdx,
        })
      );
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
      state.a = BigInt(data.state.a);
      state.b = BigInt(data.state.b);
      if (data.state.last) {
        state.last = {
          ...data.state.last,
          trueMath: BigInt(data.state.last.trueMath),
          wrappedU: BigInt(data.state.last.wrappedU),
          wrappedS: BigInt(data.state.last.wrappedS),
          display: BigInt(data.state.last.display),
        };
      }
      challengeIdx = Number(data.challengeIdx) || 0;
      wSel.value = String(state.width);
      document.querySelectorAll('input[name="mode"]').forEach((el) => {
        el.checked = el.value === state.mode;
      });
      return true;
    } catch {
      return false;
    }
  }

  function syncInputsFromState() {
    aIn.value = String(state.a);
    bIn.value = String(state.b);
  }

  function readOperands() {
    try {
      state.a = parseOperand(aIn.value, state.width, state.mode);
      state.b = parseOperand(bIn.value, state.width, state.mode);
      syncInputsFromState();
      return true;
    } catch {
      pushLog("warn", "# invalid operand");
      return false;
    }
  }

  function renderRange() {
    const w = state.width;
    if (state.mode === "unsigned") {
      const r = uRange(w);
      rangeBar.textContent = `unsigned w=${w}: [${r.min} … ${r.max}]  mod ${mod(w)}`;
    } else {
      const r = sRange(w);
      rangeBar.textContent = `signed w=${w}: [${r.min} … ${r.max}]  (bits still mod ${mod(w)})`;
    }
  }

  function renderRing() {
    const w = state.width;
    const u = state.last ? state.last.wrappedU : toUnsigned(state.a, w);
    const pct = (Number(u) / Number(mask(w) || 1n)) * 100;
    ringFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    ringMark.style.left = `calc(${Math.min(100, Math.max(0, pct))}% - 1px)`;
  }

  function renderVals() {
    const w = state.width;
    if (!state.last) {
      document.getElementById("val-true").textContent = "—";
      document.getElementById("val-wrap").textContent = "—";
      document.getElementById("val-u").textContent = String(toUnsigned(state.a, w));
      document.getElementById("val-s").textContent = String(toSigned(toUnsigned(state.a, w), w));
      document.getElementById("card-wrap").className = "val-card";
      statusPill.className = "status-pill idle";
      statusPill.textContent = "idle";
      return;
    }
    const L = state.last;
    document.getElementById("val-true").textContent = String(L.trueMath);
    document.getElementById("val-wrap").textContent =
      state.mode === "unsigned"
        ? String(L.wrappedU)
        : `${L.wrappedS} (bits 0x${L.wrappedU.toString(16).toUpperCase()})`;
    document.getElementById("val-u").textContent = String(L.wrappedU);
    document.getElementById("val-s").textContent = String(L.wrappedS);

    const card = document.getElementById("card-wrap");
    if (state.mode === "unsigned" && L.wrapU) {
      card.className = "val-card wrap";
      statusPill.className = "status-pill wrap";
      statusPill.textContent = "WRAP";
    } else if (state.mode === "signed" && L.overflowS) {
      card.className = "val-card ov";
      statusPill.className = "status-pill ov";
      statusPill.textContent = "OVERFLOW";
    } else {
      card.className = "val-card ok";
      statusPill.className = "status-pill ok";
      statusPill.textContent = "OK (in range)";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(add / sub for a trace)</span>';
      return;
    }
    traceBox.innerHTML = state.trace
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no ops yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll() {
    wSel.value = String(state.width);
    syncInputsFromState();
    renderRange();
    renderVals();
    renderRing();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    document.querySelectorAll('input[name="mode"]').forEach((el) => {
      el.checked = el.value === "unsigned";
    });
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: w=4 unsigned — try 14+3");
    state.trace = [];
    state.last = null;
    renderAll();
  }

  function runOp(op) {
    if (!readOperands()) {
      renderAll();
      return;
    }
    const L = compute(state.a, state.b, op, state.width, state.mode);
    // fix wrapU for unsigned clearly
    if (state.mode === "unsigned") {
      const r = uRange(state.width);
      L.wrapU = L.trueMath < r.min || L.trueMath > r.max;
      L.overflowS = false;
    } else {
      const r = sRange(state.width);
      L.overflowS = L.trueMath < r.min || L.trueMath > r.max;
      L.wrapU = L.overflowS; // bits wrapped away from true signed meaning
    }
    state.last = L;
    state.op = op;
    if (op === "add") state.didAdd = true;
    else state.didSub = true;
    if (L.wrapU && state.mode === "unsigned") state.sawWrap = true;
    if (L.overflowS) state.sawOverflow = true;
    state.lastAction = op;

    const sym = op === "add" ? "+" : "−";
    state.trace = [
      {
        kind: "muted",
        text: `${state.mode} w=${state.width}: ${state.a} ${sym} ${state.b}`,
      },
      { kind: "hi", text: `true math = ${L.trueMath}` },
      {
        kind: "hi",
        text: `bits = 0x${L.wrappedU.toString(16).toUpperCase()} → u=${L.wrappedU} s=${L.wrappedS}`,
      },
      state.mode === "unsigned"
        ? {
            kind: L.wrapU ? "warn" : "ok",
            text: L.wrapU ? "WRAP (mod 2^w)" : "OK in unsigned range",
          }
        : {
            kind: L.overflowS ? "err" : "ok",
            text: L.overflowS
              ? "SIGNED OVERFLOW (bits wrapped)"
              : "OK in signed range",
          },
    ];
    pushLog(
      L.overflowS || (state.mode === "unsigned" && L.wrapU) ? "warn" : "ok",
      `# ${op} → ${L.display}`
    );
    renderAll();
  }

  document.getElementById("ow-starter").addEventListener("click", loadStarter);
  wSel.addEventListener("change", () => {
    state.width = Number(wSel.value);
    state.setWidth = true;
    state.last = null;
    readOperands();
    state.lastAction = "width";
    pushLog("run", `# width → ${state.width}`);
    renderAll();
  });
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      state.mode = el.value;
      state.last = null;
      readOperands();
      state.lastAction = "mode";
      pushLog("run", `# mode → ${state.mode}`);
      renderAll();
    });
  });
  document.getElementById("btn-add").addEventListener("click", () => runOp("add"));
  document.getElementById("btn-sub").addEventListener("click", () => runOp("sub"));
  document.getElementById("btn-demo-u").addEventListener("click", () => {
    state.width = 4;
    state.mode = "unsigned";
    document.querySelectorAll('input[name="mode"]').forEach((el) => {
      el.checked = el.value === "unsigned";
    });
    wSel.value = "4";
    state.a = 14n;
    state.b = 3n;
    syncInputsFromState();
    runOp("add");
    state.lastAction = "demo-u";
  });
  document.getElementById("btn-demo-s").addEventListener("click", () => {
    state.width = 4;
    state.mode = "signed";
    document.querySelectorAll('input[name="mode"]').forEach((el) => {
      el.checked = el.value === "signed";
    });
    wSel.value = "4";
    state.a = 7n;
    state.b = 1n;
    syncInputsFromState();
    runOp("add");
    state.lastAction = "demo-s";
  });
  document.getElementById("btn-max").addEventListener("click", () => {
    const w = state.width;
    state.a = state.mode === "unsigned" ? uRange(w).max : sRange(w).max;
    syncInputsFromState();
    state.lastAction = "max";
    pushLog("ok", `# A = max ${state.a}`);
    renderAll();
  });
  document.getElementById("btn-inc").addEventListener("click", () => {
    if (!readOperands()) {
      renderAll();
      return;
    }
    const u = toUnsigned(state.a, state.width);
    const next = toUnsigned(u + 1n, state.width);
    if (next === 0n) state.sawWrap = true;
    state.a = state.mode === "unsigned" ? next : toSigned(next, state.width);
    syncInputsFromState();
    state.lastAction = "inc";
    pushLog("run", `# A → ${state.a}`);
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-mod",
      title: "Quiz: mod",
      prompt: "Wrapped result uses modulus? Answer: <code>2^w</code>",
      hint: "power of two",
      type: "text",
      answer: "2^w",
      alt: ["2**w", "pow(2,w)"],
    },
    {
      id: "quiz-carry",
      title: "Quiz: flags",
      prompt: "Carry flag equals signed overflow? Answer: <code>no</code>",
      hint: "different",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "quiz-sat",
      title: "Quiz: sat",
      prompt: "Saturation is the same as wrap? Answer: <code>no</code>",
      hint: "clamp vs mod",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "quiz-counter",
      title: "Quiz: counter",
      prompt: "Free-running counters often rely on? Answer: <code>wrap</code>",
      hint: "mod 2^w",
      type: "text",
      answer: "wrap",
      alt: ["wrap-around", "wrapping"],
    },
    {
      id: "demo-unsigned",
      title: "Demo unsigned",
      prompt: "Run Demo: unsigned 14+3 — wrap to 1.",
      hint: "Demo unsigned button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sawWrap &&
        state.last &&
        state.last.wrappedU === 1n &&
        state.last.trueMath === 17n,
    },
    {
      id: "demo-signed",
      title: "Demo signed",
      prompt: "Run Demo: signed 7+1 — overflow (bits → −8).",
      hint: "Demo signed button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sawOverflow &&
        state.last &&
        state.last.overflowS &&
        state.last.wrappedS === -8n,
    },
    {
      id: "add-ok",
      title: "Add in range",
      prompt: "Unsigned w=4: 2+3 — OK, result 5, no wrap.",
      hint: "set A=2 B=3 → Add",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "unsigned" &&
        state.didAdd &&
        state.last &&
        !state.last.wrapU &&
        state.last.wrappedU === 5n,
    },
    {
      id: "sub-wrap",
      title: "Sub wrap",
      prompt: "Unsigned w=4: 1−2 wraps to 15.",
      hint: "A=1 B=2 → Sub",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "unsigned" &&
        state.didSub &&
        state.last &&
        state.last.wrapU &&
        state.last.wrappedU === 15n,
    },
    {
      id: "signed-ok",
      title: "Signed OK",
      prompt: "Signed w=4: (−3)+(−2) = −5, no overflow.",
      hint: "signed mode, A=-3 B=-2 → Add",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "signed" &&
        state.didAdd &&
        state.last &&
        !state.last.overflowS &&
        state.last.wrappedS === -5n,
    },
    {
      id: "width8",
      title: "Width 8",
      prompt: "Set width 8 (setWidth).",
      hint: "Width selector",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.width === 8 && state.setWidth,
    },
    {
      id: "quiz-14p3",
      title: "Quiz: 14+3",
      prompt: "4-bit unsigned 14+3 stores? Answer: <code>1</code>",
      hint: "17 mod 16",
      type: "text",
      answer: "1",
    },
    {
      id: "quiz-7p1",
      title: "Quiz: 7+1 signed",
      prompt: "4-bit signed 7+1 bit pattern as signed? Answer: <code>-8</code>",
      hint: "overflow to min",
      type: "text",
      answer: "-8",
      alt: ["−8"],
    },
    {
      id: "max-then-add",
      title: "Max + 1",
      prompt: "Unsigned: set A=max, B=1, Add — wrap.",
      hint: "Set A=max → B=1 → Add",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "unsigned" &&
        state.didAdd &&
        state.last &&
        state.last.wrapU &&
        state.last.wrappedU === 0n,
    },
    {
      id: "inc-wrap",
      title: "Inc wrap",
      prompt: "Unsigned: A=15, click A=A+1 — wraps to 0.",
      hint: "A=15 → A=A+1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "unsigned" &&
        state.width === 4 &&
        state.a === 0n &&
        state.lastAction === "inc" &&
        state.sawWrap,
    },
    {
      id: "mode-signed",
      title: "Mode signed",
      prompt: "Switch to signed mode.",
      hint: "Signed radio",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "signed" && state.lastAction === "mode",
    },
    {
      id: "quiz-range-u",
      title: "Quiz: u max",
      prompt: "4-bit unsigned max? Answer: <code>15</code>",
      hint: "2^4−1",
      type: "text",
      answer: "15",
    },
    {
      id: "quiz-range-s",
      title: "Quiz: s max",
      prompt: "4-bit signed max? Answer: <code>7</code>",
      hint: "2^3−1",
      type: "text",
      answer: "7",
    },
    {
      id: "both-ops",
      title: "Both ops",
      prompt: "Perform at least one Add and one Sub.",
      hint: "Add then Sub",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.didAdd && state.didSub,
    },
    {
      id: "same-bits",
      title: "Same bits different story",
      prompt: "After signed 7+1 overflow, unsigned view of bits is 8.",
      hint: "Demo signed — check As unsigned",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.last &&
        state.last.overflowS &&
        state.last.wrappedU === 8n &&
        state.last.wrappedS === -8n,
    },
    {
      id: "quiz-hdl",
      title: "Quiz: HDL",
      prompt: "logic [3:0] add wraps by default? Answer: <code>yes</code>",
      hint: "truncate",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "sub-signed-ov",
      title: "Signed sub ov",
      prompt: "Signed w=4: (−8)−1 overflows.",
      hint: "A=-8 B=1 → Sub",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "signed" &&
        state.didSub &&
        state.last &&
        state.last.overflowS,
    },
    {
      id: "full-hazard",
      title: "Full hazard",
      prompt: "See unsigned wrap and signed overflow at least once each.",
      hint: "both demos",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.sawWrap && state.sawOverflow,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/−/g, "-");
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use add/sub demos, then Check.</span>`;
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
