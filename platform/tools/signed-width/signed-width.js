(() => {
  /**
   * Signed / unsigned width literacy:
   *   Same bit pattern → unsigned magnitude vs 2's-complement signed
   *   Zero-extend vs sign-extend when widening
   *   $signed / $unsigned casts
   *   Relational ops: signed vs unsigned compare can disagree
   */

  function mask(width) {
    return (1 << width) - 1;
  }

  function toBin(val, width) {
    let s = (val & mask(width)).toString(2);
    return s.padStart(width, "0");
  }

  function parseBin(str, width) {
    const cleaned = String(str).replace(/[^01]/g, "");
    if (!cleaned) return 0;
    const slice = cleaned.slice(-width).padStart(width, "0");
    return parseInt(slice, 2) & mask(width);
  }

  function unsignedVal(bits, width) {
    return bits & mask(width);
  }

  function signedVal(bits, width) {
    const u = bits & mask(width);
    const sign = 1 << (width - 1);
    if (u & sign) return u - (1 << width);
    return u;
  }

  function zeroExtend(bits, fromW, toW) {
    return bits & mask(fromW);
  }

  function signExtend(bits, fromW, toW) {
    const u = bits & mask(fromW);
    const sign = u & (1 << (fromW - 1));
    if (!sign) return u;
    const ext = mask(toW) ^ mask(fromW);
    return u | ext;
  }

  function makeStarter() {
    return {
      width: 4,
      bits: 0b1111, // starter classic: -1 signed / 15 unsigned
      other: 0b0001, // compare operand
      cast: "none", // none | signed | unsigned
      lastAction: "",
      explained: false,
      showedExtend: false,
      showedCompare: false,
      flippedBit: false,
      setNeg1: false,
      setPos: false,
      log: [],
      trace: [],
    };
  }

  function sourceCode(state) {
    const w = state.width;
    const bin = toBin(state.bits, w);
    const oBin = toBin(state.other, w);
    const castLine =
      state.cast === "signed"
        ? `$signed(a)  // treat as signed for ops`
        : state.cast === "unsigned"
          ? `$unsigned(a)  // treat as unsigned for ops`
          : `// cast: none — depends on declared type`;
    const s = signedVal(state.bits, w);
    const u = unsignedVal(state.bits, w);
    const zx = zeroExtend(state.bits, w, w + 4);
    const sx = signExtend(state.bits, w, w + 4);
    return `logic [${w - 1}:0] a = ${w}'b${bin};  // unsigned ${u}, signed ${s}
logic [${w - 1}:0] b = ${w}'b${oBin};
${castLine}
// zero-extend to ${w + 4}: ${w + 4}'b${toBin(zx, w + 4)}
// sign-extend to ${w + 4}: ${w + 4}'b${toBin(sx, w + 4)}`;
  }

  const CLEARED_KEY = "ddv-signed-width-cleared-v1";
  const STORE_KEY = "ddv-signed-width-session-v1";

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

  const root = document.getElementById("sw-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>4'b1111</code> —
        unsigned <strong>15</strong>, signed <strong>−1</strong>.
        Sign-extend vs zero-extend to 8 bits, then compare with <code>4'b0001</code>.</p>
      <button type="button" class="btn btn-secondary" id="sw-starter">Load starter example</button>
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
            <h3>Same bits</h3>
            <p>Pattern ≠ value — signed vs unsigned readings differ.</p>
          </div>
          <div class="idea-card">
            <h3>Extend</h3>
            <p>Widen with 0s (unsigned) or copy sign bit (signed).</p>
          </div>
          <div class="idea-card">
            <h3>Compare</h3>
            <p><code>$signed</code>/<code>$unsigned</code> change relational results.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Pattern &amp; casts</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Width
              <select id="width-sel">
                <option value="4" selected>4</option>
                <option value="8">8</option>
              </select>
            </label>
            <label>Bits (MSB left)
              <input type="text" class="bin" id="bin-in" maxlength="8" value="1111">
            </label>
            <label>Cast
              <select id="cast-sel">
                <option value="none" selected>none</option>
                <option value="signed">$signed(a)</option>
                <option value="unsigned">$unsigned(a)</option>
              </select>
            </label>
            <label>Compare b
              <input type="text" class="bin" id="other-in" maxlength="8" value="0001">
            </label>
          </div>
          <p class="legend">Click bits to toggle. Orange = sign bit (MSB).</p>
          <div class="bit-row" id="bit-row"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-neg1">Preset 4'b1111 (−1 / 15)</button>
            <button type="button" id="btn-pos">Preset 4'b0111 (+7 / 7)</button>
            <button type="button" id="btn-extend">Show extend to width+4</button>
            <button type="button" id="btn-compare">Compare a ? b (signed vs unsigned)</button>
            <button type="button" id="btn-signed-cast">Apply $signed(a)</button>
            <button type="button" id="btn-unsigned-cast">Apply $unsigned(a)</button>
            <button type="button" id="btn-explain">Explain rules</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Readings &amp; widen</h2></div>
        <div class="panel-body">
          <div class="values">
            <div class="val-card" id="card-u">
              <h3>Unsigned reading</h3>
              <p class="val" id="val-u">—</p>
              <p class="note" id="note-u"></p>
            </div>
            <div class="val-card" id="card-s">
              <h3>Signed reading</h3>
              <p class="val" id="val-s">—</p>
              <p class="note" id="note-s"></p>
            </div>
          </div>
          <div class="extend-grid">
            <div class="extend-card">
              <div class="lbl">Zero-extend → ${'{'}width+4{'}'}</div>
              <div class="bits" id="ext-z">—</div>
            </div>
            <div class="extend-card">
              <div class="lbl">Sign-extend → ${'{'}width+4{'}'}</div>
              <div class="bits" id="ext-s">—</div>
            </div>
          </div>
          <div class="compare-box" id="compare-box">(run Compare)</div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Topic</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>2's complement</td><td>MSB=1 → negative; value = bits − 2^W</td></tr>
            <tr><td>Zero-extend</td><td>Pad MSB side with 0 — keeps unsigned magnitude</td></tr>
            <tr><td>Sign-extend</td><td>Copy sign bit into new MSBs</td></tr>
            <tr><td><code>$signed</code></td><td>Force signed interpretation for expression</td></tr>
            <tr><td><code>$unsigned</code></td><td>Force unsigned interpretation</td></tr>
            <tr><td>Compare trap</td><td><code>4'b1111 &lt; 4'b0001</code> is false unsigned, true signed</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: 1111 → u=15, s=−1; sign-extend 8 → 11111111.</li>
          <li>Mixing signed/unsigned in one expression is a common bug source.</li>
        </ul>
      </div>
    </div>
  `;

  // Fix the template literal pollution in extend labels - I accidentally used ${'{'} which was wrong
  // Let me fix via DOM after - actually looking at the HTML I wrote:
  // `<div class="lbl">Zero-extend → ${'{'}width+4{'}'}</div>`
  // In a template literal that becomes: Zero-extend → ${width+4}
  // Wait, ${'{'} is expression that evaluates to '{', so ${'{'}width+4{'}'} becomes ${width+4} as literal text.
  // Good - shows "${width+4}" as text which is a bit ugly. Better to set via JS.

  const widthSel = document.getElementById("width-sel");
  const binIn = document.getElementById("bin-in");
  const otherIn = document.getElementById("other-in");
  const castSel = document.getElementById("cast-sel");
  const bitRow = document.getElementById("bit-row");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardU = document.getElementById("card-u");
  const cardS = document.getElementById("card-s");
  const valU = document.getElementById("val-u");
  const valS = document.getElementById("val-s");
  const noteU = document.getElementById("note-u");
  const noteS = document.getElementById("note-s");
  const extZ = document.getElementById("ext-z");
  const extS = document.getElementById("ext-s");
  const compareBox = document.getElementById("compare-box");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  // Fix extend labels
  document.querySelectorAll(".extend-card .lbl").forEach((el, i) => {
    el.textContent = i === 0 ? "Zero-extend → width+4" : "Sign-extend → width+4";
  });

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
      state.width = state.width === 8 ? 8 : 4;
      state.bits &= mask(state.width);
      state.other &= mask(state.width);
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function renderBits() {
    bitRow.innerHTML = "";
    const bin = toBin(state.bits, state.width);
    for (let i = 0; i < state.width; i++) {
      const bitIndex = state.width - 1 - i; // MSB first
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bit-cell";
      if (i === 0) btn.classList.add("is-sign");
      if (bin[i] === "1") btn.classList.add("is-one");
      btn.textContent = bin[i];
      btn.title = `bit [${bitIndex}]`;
      btn.addEventListener("click", () => {
        state.bits ^= 1 << bitIndex;
        state.flippedBit = true;
        state.lastAction = "flip";
        pushLog("run", `# toggle [${bitIndex}] → ${toBin(state.bits, state.width)}`);
        renderAll();
      });
      bitRow.appendChild(btn);
    }
  }

  function cmpResult(aBits, bBits, width, signedMode) {
    if (signedMode) {
      const a = signedVal(aBits, width);
      const b = signedVal(bBits, width);
      if (a < b) return "<";
      if (a > b) return ">";
      return "==";
    }
    const a = unsignedVal(aBits, width);
    const b = unsignedVal(bBits, width);
    if (a < b) return "<";
    if (a > b) return ">";
    return "==";
  }

  function renderValues() {
    const u = unsignedVal(state.bits, state.width);
    const s = signedVal(state.bits, state.width);
    valU.textContent = String(u);
    valS.textContent = String(s);
    noteU.textContent = `${state.width}'b${toBin(state.bits, state.width)} as unsigned`;
    noteS.textContent =
      s < 0
        ? `2's complement (MSB=1)`
        : `non-negative (MSB=0)`;
    cardS.className = "val-card" + (s < 0 ? " is-neg" : " is-ok");
    cardU.className = "val-card is-ok";

    const toW = state.width + 4;
    const zx = zeroExtend(state.bits, state.width, toW);
    const sx = signExtend(state.bits, state.width, toW);
    extZ.textContent = `${toW}'b${toBin(zx, toW)}  (u=${unsignedVal(zx, toW)})`;
    extS.textContent = `${toW}'b${toBin(sx, toW)}  (s=${signedVal(sx, toW)})`;
  }

  function renderCompare() {
    if (!state.showedCompare) {
      compareBox.innerHTML = "(run Compare)";
      return;
    }
    const uCmp = cmpResult(state.bits, state.other, state.width, false);
    const sCmp = cmpResult(state.bits, state.other, state.width, true);
    const disagree = uCmp !== sCmp;
    compareBox.innerHTML =
      `unsigned: a ${escapeHtml(uCmp)} b &nbsp;|&nbsp; ` +
      `signed: a ${escapeHtml(sCmp)} b` +
      (disagree
        ? ` <span class="diff">— disagree!</span>`
        : " <span>(agree)</span>");
  }

  function renderWarn() {
    const s = signedVal(state.bits, state.width);
    const uCmp = cmpResult(state.bits, state.other, state.width, false);
    const sCmp = cmpResult(state.bits, state.other, state.width, true);
    if (state.showedCompare && uCmp !== sCmp) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Signed vs unsigned compare disagree on this pair — cast intentionally.";
    } else if (s < 0 && state.cast === "unsigned") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "$unsigned on a negative pattern still uses the same bits as a large positive.";
    } else if (state.showedExtend && s < 0) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Sign-extend fills 1s; zero-extend fills 0s — different wider patterns.";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(extend, compare, or explain)</span>';
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

  function syncInputs() {
    widthSel.value = String(state.width);
    binIn.value = toBin(state.bits, state.width);
    otherIn.value = toBin(state.other, state.width);
    castSel.value = state.cast;
  }

  function renderAll() {
    state.bits &= mask(state.width);
    state.other &= mask(state.width);
    syncInputs();
    renderBits();
    codeBox.textContent = sourceCode(state);
    renderValues();
    renderCompare();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setNeg1 = true;
    pushLog("muted", "# starter 4'b1111 → u=15 s=-1");
    state.trace = [];
    renderAll();
  }

  function showExtend() {
    state.showedExtend = true;
    state.lastAction = "extend";
    const toW = state.width + 4;
    const zx = zeroExtend(state.bits, state.width, toW);
    const sx = signExtend(state.bits, state.width, toW);
    const s = signedVal(state.bits, state.width);
    state.trace = [
      { kind: "muted", text: `extend ${state.width} → ${toW}` },
      {
        kind: "hi",
        text: `zero: ${toW}'b${toBin(zx, toW)}`,
      },
      {
        kind: s < 0 ? "warn" : "ok",
        text: `sign: ${toW}'b${toBin(sx, toW)}`,
      },
      {
        kind: zx === sx ? "ok" : "warn",
        text: zx === sx ? "same (MSB was 0)" : "differ (MSB was 1)",
      },
    ];
    pushLog("ok", "# showed extend");
    renderAll();
  }

  function showCompare() {
    state.showedCompare = true;
    state.lastAction = "compare";
    const uCmp = cmpResult(state.bits, state.other, state.width, false);
    const sCmp = cmpResult(state.bits, state.other, state.width, true);
    state.trace = [
      { kind: "muted", text: "relational" },
      {
        kind: "run",
        text: `unsigned: ${unsignedVal(state.bits, state.width)} ${uCmp} ${unsignedVal(state.other, state.width)}`,
      },
      {
        kind: "run",
        text: `signed:   ${signedVal(state.bits, state.width)} ${sCmp} ${signedVal(state.other, state.width)}`,
      },
      {
        kind: uCmp !== sCmp ? "warn" : "ok",
        text: uCmp !== sCmp ? "results disagree" : "results agree",
      },
    ];
    pushLog(uCmp !== sCmp ? "warn" : "ok", "# compared");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    const s = signedVal(state.bits, state.width);
    const u = unsignedVal(state.bits, state.width);
    state.trace = [
      { kind: "muted", text: "signed / unsigned rules" },
      { kind: "hi", text: `bits ${state.width}'b${toBin(state.bits, state.width)}` },
      { kind: "ok", text: `unsigned → ${u}` },
      { kind: s < 0 ? "warn" : "ok", text: `signed   → ${s}` },
      {
        kind: "run",
        text: "$signed / $unsigned change expression context, not the stored bits",
      },
      {
        kind: "warn",
        text: "Always match extend style to signedness when widening",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("sw-starter").addEventListener("click", loadStarter);

  widthSel.addEventListener("change", () => {
    const nw = Number(widthSel.value) === 8 ? 8 : 4;
    if (nw > state.width) {
      // zero-extend visually when growing
      state.bits = zeroExtend(state.bits, state.width, nw);
      state.other = zeroExtend(state.other, state.width, nw);
    } else {
      state.bits &= mask(nw);
      state.other &= mask(nw);
    }
    state.width = nw;
    state.lastAction = "width";
    pushLog("run", `# width → ${nw}`);
    renderAll();
  });

  binIn.addEventListener("change", () => {
    state.bits = parseBin(binIn.value, state.width);
    state.lastAction = "bin";
    pushLog("run", `# bits → ${toBin(state.bits, state.width)}`);
    renderAll();
  });

  otherIn.addEventListener("change", () => {
    state.other = parseBin(otherIn.value, state.width);
    state.lastAction = "other";
    pushLog("run", `# b → ${toBin(state.other, state.width)}`);
    renderAll();
  });

  castSel.addEventListener("change", () => {
    state.cast = castSel.value;
    state.lastAction = "cast";
    pushLog("run", `# cast → ${state.cast}`);
    renderAll();
  });

  document.getElementById("btn-neg1").addEventListener("click", () => {
    state.width = 4;
    state.bits = 0b1111;
    state.other = 0b0001;
    state.cast = "none";
    state.setNeg1 = true;
    state.lastAction = "preset-neg1";
    pushLog("ok", "# preset 4'b1111");
    renderAll();
  });

  document.getElementById("btn-pos").addEventListener("click", () => {
    state.width = 4;
    state.bits = 0b0111;
    state.other = 0b0001;
    state.cast = "none";
    state.setPos = true;
    state.lastAction = "preset-pos";
    pushLog("ok", "# preset 4'b0111");
    renderAll();
  });

  document.getElementById("btn-extend").addEventListener("click", showExtend);
  document.getElementById("btn-compare").addEventListener("click", showCompare);

  document.getElementById("btn-signed-cast").addEventListener("click", () => {
    state.cast = "signed";
    state.lastAction = "cast-signed";
    pushLog("ok", "# $signed(a)");
    renderAll();
  });

  document.getElementById("btn-unsigned-cast").addEventListener("click", () => {
    state.cast = "unsigned";
    state.lastAction = "cast-unsigned";
    pushLog("ok", "# $unsigned(a)");
    renderAll();
  });

  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-signed-sys",
      title: "Quiz: $signed",
      prompt: "System function to force signed context? Answer: <code>$signed</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "$signed",
      alt: ["signed", "$signed()"],
    },
    {
      id: "quiz-unsigned-sys",
      title: "Quiz: $unsigned",
      prompt: "System function to force unsigned context? Answer: <code>$unsigned</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "$unsigned",
      alt: ["unsigned", "$unsigned()"],
    },
    {
      id: "quiz-signbit",
      title: "Quiz: sign bit",
      prompt: "In 2's complement, the sign bit is the? Answer: <code>MSB</code>",
      hint: "orange bit",
      type: "text",
      answer: "msb",
      alt: ["MSB", "most significant", "left"],
    },
    {
      id: "quiz-sext",
      title: "Quiz: sign-extend",
      prompt: "Copying the sign into new MSBs is? Answer: <code>sign-extend</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "sign-extend",
      alt: ["sign extend", "sext", "sign_extend"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 4'b1111, unsigned 15, signed −1.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.width === 4 &&
        state.bits === 0b1111 &&
        unsignedVal(state.bits, 4) === 15 &&
        signedVal(state.bits, 4) === -1,
    },
    {
      id: "preset-neg1",
      title: "Preset −1",
      prompt: "Preset 4'b1111 (−1 / 15).",
      hint: "Preset 4'b1111 button",
      type: "state",
      setup: () => {
        state.bits = 0;
        renderAll();
      },
      check: () =>
        state.setNeg1 &&
        state.bits === 0b1111 &&
        state.lastAction === "preset-neg1",
    },
    {
      id: "preset-pos",
      title: "Preset +7",
      prompt: "Preset 4'b0111 — signed and unsigned both 7.",
      hint: "Preset 4'b0111",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setPos &&
        state.bits === 0b0111 &&
        signedVal(state.bits, 4) === 7 &&
        unsignedVal(state.bits, 4) === 7,
    },
    {
      id: "extend",
      title: "Extend",
      prompt: "Show extend to width+4 on starter pattern.",
      hint: "Show extend button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.showedExtend &&
        state.lastAction === "extend" &&
        state.bits === 0b1111,
    },
    {
      id: "sext-ff",
      title: "Sign-extend FF",
      prompt: "On 4'b1111, sign-extend to 8 bits is 11111111.",
      hint: "Starter + Show extend",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const sx = signExtend(state.bits, 4, 8);
        return (
          state.width === 4 &&
          state.bits === 0b1111 &&
          toBin(sx, 8) === "11111111"
        );
      },
    },
    {
      id: "zext-0f",
      title: "Zero-extend 0F",
      prompt: "On 4'b1111, zero-extend to 8 bits is 00001111.",
      hint: "Starter pattern",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const zx = zeroExtend(state.bits, 4, 8);
        return state.bits === 0b1111 && toBin(zx, 8) === "00001111";
      },
    },
    {
      id: "compare",
      title: "Compare",
      prompt: "Compare a ? b on starter (1111 vs 0001) — they disagree.",
      hint: "Compare button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const uCmp = cmpResult(state.bits, state.other, state.width, false);
        const sCmp = cmpResult(state.bits, state.other, state.width, true);
        return (
          state.showedCompare &&
          state.lastAction === "compare" &&
          uCmp !== sCmp
        );
      },
    },
    {
      id: "cast-signed",
      title: "$signed",
      prompt: "Apply $signed(a).",
      hint: "Apply $signed(a)",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.cast === "signed" && state.lastAction === "cast-signed",
    },
    {
      id: "cast-unsigned",
      title: "$unsigned",
      prompt: "Apply $unsigned(a).",
      hint: "Apply $unsigned(a)",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.cast === "unsigned" && state.lastAction === "cast-unsigned",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain rules.",
      hint: "Explain rules",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "flip",
      title: "Toggle bit",
      prompt: "Click any bit cell to toggle.",
      hint: "Click orange or other bit",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.flippedBit && state.lastAction === "flip",
    },
    {
      id: "width-8",
      title: "Width 8",
      prompt: "Switch Width dropdown to 8.",
      hint: "Width select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.width === 8 && state.lastAction === "width",
    },
    {
      id: "quiz-neg1",
      title: "Quiz: −1",
      prompt: "Signed value of 4'b1111? Answer: <code>-1</code>",
      hint: "starter",
      type: "text",
      answer: "-1",
      alt: ["−1", "minus 1", "minus1"],
    },
    {
      id: "quiz-u15",
      title: "Quiz: 15",
      prompt: "Unsigned value of 4'b1111? Answer: <code>15</code>",
      hint: "starter",
      type: "text",
      answer: "15",
      alt: ["fifteen"],
    },
    {
      id: "quiz-zext",
      title: "Quiz: zero-extend",
      prompt: "Padding new MSBs with 0 is? Answer: <code>zero-extend</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "zero-extend",
      alt: ["zero extend", "zext", "zero_extend"],
    },
    {
      id: "warn-disagree",
      title: "Warn disagree",
      prompt: "After Compare on starter, warning about disagree is visible.",
      hint: "Compare a ? b",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.showedCompare && !warnBox.classList.contains("hidden"),
    },
    {
      id: "code-neg",
      title: "Code comment",
      prompt: "Starter source mentions signed -1 (or −1).",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const src = sourceCode(state);
        return src.includes("signed -1") || src.includes("signed −1");
      },
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → extend → compare → explain.",
      hint: "Load → Show extend → Compare → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.bits === 0b1111 &&
        state.showedExtend &&
        state.showedCompare &&
        state.explained &&
        state.lastAction === "explain",
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
  renderChallenge();
})();
