(() => {
  /**
   * Counter lab — 4-bit
   *   up      — count = (count+1) mod 16
   *   down    — count = (count-1) mod 16
   *   modulo  — count = (count+1) mod MOD (MOD 2..16)
   *   enable  — up only when ce=1 (else hold)
   *   gray    — phase n++; q = gray(n)  (one-bit transitions)
   */

  const WIDTH = 4;
  const MAX = 1 << WIDTH; // 16

  function toGray(n) {
    return (n ^ (n >> 1)) & (MAX - 1);
  }

  function toBin(n, w = WIDTH) {
    return (n >>> 0).toString(2).padStart(w, "0");
  }

  function bitsOf(n) {
    const out = [];
    for (let i = WIDTH - 1; i >= 0; i--) out.push((n >> i) & 1);
    return out; // [q3..q0] MSB first for display
  }

  function makeStarter() {
    return {
      mode: "up", // up | down | modulo | enable | gray
      count: 0, // binary value / Gray phase index
      q: 0, // displayed register (binary or gray)
      ce: 1,
      mod: 10,
      prevQ: 0,
      flipped: [], // bit indices that changed last step (MSB=0 display index)
      cycle: 0,
      lastAction: "",
      explained: false,
      stepped: false,
      setUp: false,
      setDown: false,
      setModulo: false,
      setEnable: false,
      setGray: false,
      toggledCe: false,
      resetDone: false,
      log: [],
      trace: [],
    };
  }

  function syncQ(state) {
    if (state.mode === "gray") state.q = toGray(state.count & (MAX - 1));
    else state.q = state.count & (MAX - 1);
  }

  function sourceCode(state) {
    if (state.mode === "up") {
      return `// Up counter (wrap 2^N)
always_ff @(posedge clk)
  count <= count + 1;  // mod 16 for 4-bit`;
    }
    if (state.mode === "down") {
      return `// Down counter
always_ff @(posedge clk)
  count <= count - 1;`;
    }
    if (state.mode === "modulo") {
      return `// Modulo-${state.mod} counter
always_ff @(posedge clk) begin
  if (count == ${state.mod - 1}) count <= 0;
  else count <= count + 1;
end`;
    }
    if (state.mode === "enable") {
      return `// Count enable (preferred CE style)
always_ff @(posedge clk) begin
  if (ce) count <= count + 1;  // else hold
end`;
    }
    return `// Gray counter — encode binary phase
// gray = count ^ (count >> 1); adjacent codes differ by 1 bit
always_ff @(posedge clk)
  count <= count + 1;
assign q = count ^ (count >> 1);`;
  }

  function modeLegend(mode, mod) {
    if (mode === "up") return "Binary up, wrap at 16 (0…15).";
    if (mode === "down") return "Binary down, wrap under 0 → 15.";
    if (mode === "modulo") return `Counts 0…${mod - 1}, then back to 0.`;
    if (mode === "enable") return "Like up, but only advances when ce=1.";
    return "Phase increments in binary; q shows Gray(phase) — one bit flips each step.";
  }

  const CLEARED_KEY = "ddv-counter-lab-cleared-v1";
  const STORE_KEY = "ddv-counter-lab-session-v1";

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

  const root = document.getElementById("ctr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> up counter at 0 —
        step the clock to increment; try enable hold and Gray one-bit flips.</p>
      <button type="button" class="btn btn-secondary" id="ctr-starter">Load starter example</button>
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
          <div class="idea-card"><h3>Up</h3><p>Add 1 each edge; wrap at 2ᴺ.</p></div>
          <div class="idea-card"><h3>Down</h3><p>Subtract 1; wrap under zero.</p></div>
          <div class="idea-card"><h3>Modulo</h3><p>Period ≠ power of two (e.g. 10).</p></div>
          <div class="idea-card"><h3>Enable</h3><p><code>if (ce)</code> count — hold otherwise.</p></div>
          <div class="idea-card"><h3>Gray</h3><p>Adjacent codes differ by one bit.</p></div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Counter</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="up" selected>up</option>
                <option value="down">down</option>
                <option value="modulo">modulo</option>
                <option value="enable">enable</option>
                <option value="gray">Gray</option>
              </select>
            </label>
            <label>MOD
              <select id="mod-sel">
                <option value="6">6</option>
                <option value="10" selected>10</option>
                <option value="12">12</option>
                <option value="16">16</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="count-display">
            <p class="big" id="val-dec">0</p>
            <div>
              <p class="meta" id="val-bin">q = 0000b</p>
              <p class="meta" id="val-extra"></p>
              <div class="bit-row" id="bit-row" style="margin-top:0.45rem"></div>
            </div>
          </div>
          <div class="seq-strip" id="seq-strip" title="Recent q values"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-step">Step clk ↑</button>
            <button type="button" id="btn-toggle-ce">Toggle ce</button>
            <button type="button" id="btn-reset">Reset count</button>
            <button type="button" id="btn-up">Preset up</button>
            <button type="button" id="btn-down">Preset down</button>
            <button type="button" id="btn-modulo">Preset modulo</button>
            <button type="button" id="btn-enable">Preset enable</button>
            <button type="button" id="btn-gray">Preset Gray</button>
            <button type="button" id="btn-demo">Demo: wrap + hold</button>
            <button type="button" id="btn-explain">Explain modes</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>ce / cycle</h3>
              <p class="val" id="val-ce">—</p>
              <p class="note" id="note-ce"></p>
            </div>
            <div class="status-card">
              <h3>Last Δ bits</h3>
              <p class="val" id="val-flip">—</p>
              <p class="note" id="note-flip"></p>
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
          <thead><tr><th>Mode</th><th>Next value</th></tr></thead>
          <tbody>
            <tr><td>Up</td><td>(c+1) mod 16</td></tr>
            <tr><td>Down</td><td>(c−1) mod 16</td></tr>
            <tr><td>Modulo-M</td><td>(c+1) mod M</td></tr>
            <tr><td>Enable</td><td>ce ? c+1 : c</td></tr>
            <tr><td>Gray</td><td>q = gray(phase++)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Gray: <code>n ^ (n&gt;&gt;1)</code> — useful for async pointers / low glitch.</li>
          <li>Demo: count to wrap on up, then enable mode holds when ce=0.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = /** @type {HTMLSelectElement} */ (document.getElementById("mode-sel"));
  const modSel = /** @type {HTMLSelectElement} */ (document.getElementById("mod-sel"));
  const modeLegendEl = document.getElementById("mode-legend");
  const valDec = document.getElementById("val-dec");
  const valBin = document.getElementById("val-bin");
  const valExtra = document.getElementById("val-extra");
  const bitRow = document.getElementById("bit-row");
  const seqStrip = document.getElementById("seq-strip");
  const codeBox = document.getElementById("code-box");
  const valCe = document.getElementById("val-ce");
  const noteCe = document.getElementById("note-ce");
  const valFlip = document.getElementById("val-flip");
  const noteFlip = document.getElementById("note-flip");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  /** @type {number[]} */
  let recentQ = [];

  function pushLog(kind, msg) {
    state.log.unshift({ kind, msg });
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function noteFlips(prev, next) {
    const flips = [];
    for (let i = 0; i < WIDTH; i++) {
      const mask = 1 << (WIDTH - 1 - i);
      if ((prev & mask) !== (next & mask)) flips.push(WIDTH - 1 - i);
    }
    state.flipped = flips;
    state.prevQ = prev;
  }

  function applyModeFlags() {
    if (state.mode === "up") state.setUp = true;
    if (state.mode === "down") state.setDown = true;
    if (state.mode === "modulo") state.setModulo = true;
    if (state.mode === "enable") state.setEnable = true;
    if (state.mode === "gray") state.setGray = true;
  }

  function stepPosedge() {
    const prevQ = state.q;
    const prevC = state.count;
    let held = false;

    if (state.mode === "up") {
      state.count = (state.count + 1) % MAX;
    } else if (state.mode === "down") {
      state.count = (state.count - 1 + MAX) % MAX;
    } else if (state.mode === "modulo") {
      const m = state.mod;
      state.count = (state.count + 1) % m;
    } else if (state.mode === "enable") {
      if (state.ce) state.count = (state.count + 1) % MAX;
      else held = true;
    } else {
      // gray
      state.count = (state.count + 1) % MAX;
    }

    syncQ(state);
    noteFlips(prevQ, state.q);
    state.cycle += 1;
    state.stepped = true;
    state.lastAction = "step";
    recentQ.push(state.q);
    if (recentQ.length > 12) recentQ.shift();

    pushTrace(
      `t${state.cycle}: ${state.mode} c=${prevC}→${state.count} q=${toBin(prevQ)}→${toBin(state.q)}${held ? " HOLD" : ""} flips=[${state.flipped.join(",")}]`
    );
    pushLog("ok", `# step → q=${state.q} (${toBin(state.q)}b)${held ? " hold" : ""}`);
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.setUp = true;
    syncQ(state);
    recentQ = [0];
    state.lastAction = "starter";
    pushLog("ok", "# starter up counter");
    renderAll();
  }

  function runDemo() {
    // Up from 14 → wrap 15→0, then enable hold
    state.mode = "up";
    state.setUp = true;
    state.count = 14;
    state.ce = 1;
    syncQ(state);
    recentQ = [];
    state.cycle = 0;
    state.trace = [];
    for (let i = 0; i < 3; i++) {
      const prevQ = state.q;
      const prevC = state.count;
      state.count = (state.count + 1) % MAX;
      syncQ(state);
      noteFlips(prevQ, state.q);
      state.cycle += 1;
      recentQ.push(state.q);
      pushTrace(`t${state.cycle}: demo up ${prevC}→${state.count}`);
    }
    state.mode = "enable";
    state.setEnable = true;
    state.ce = 0;
    const holdQ = state.q;
    const holdC = state.count;
    // one hold step
    state.cycle += 1;
    state.stepped = true;
    noteFlips(holdQ, state.q);
    recentQ.push(state.q);
    pushTrace(`t${state.cycle}: demo enable HOLD q=${holdQ}`);
    state.lastAction = "demo";
    pushLog("ok", `# demo wrap then hold @ ${holdC}`);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("ok", "# up/down/mod/enable/Gray — CE hold vs Gray one-bit");
    pushTrace("explain: prefer CE over gated clk; Gray for pointers");
    renderAll();
  }

  function renderBits() {
    const bits = bitsOf(state.q);
    const flipSet = new Set(
      state.flipped.map((b) => WIDTH - 1 - b) // display index
    );
    bitRow.innerHTML = bits
      .map((b, i) => {
        const name = `q${WIDTH - 1 - i}`;
        const flip = flipSet.has(i) ? "is-flip" : "";
        const hi = b ? "is-hi" : "";
        return `<div class="bit-cell ${hi} ${flip}"><h3>${name}</h3><p class="bit">${b}</p></div>`;
      })
      .join("");
  }

  function renderSeq() {
    seqStrip.innerHTML = recentQ
      .map((v, i) => {
        const cur = i === recentQ.length - 1 ? "is-cur" : "";
        return `<span class="${cur}">${toBin(v)}</span>`;
      })
      .join("");
  }

  function renderAll() {
    modeSel.value = state.mode;
    modSel.value = String(state.mod);
    modeLegendEl.textContent = modeLegend(state.mode, state.mod);
    codeBox.textContent = sourceCode(state);

    valDec.textContent = String(state.q);
    valBin.textContent = `q = ${toBin(state.q)}b  (${state.q})`;
    if (state.mode === "gray") {
      valExtra.textContent = `phase=${state.count}  gray(phase)=${toBin(state.q)}`;
    } else if (state.mode === "modulo") {
      valExtra.textContent = `count=${state.count}  MOD=${state.mod}`;
    } else {
      valExtra.textContent = `count=${state.count}`;
    }
    renderBits();
    renderSeq();

    valCe.textContent = `${state.ce} / ${state.cycle}`;
    noteCe.textContent =
      state.mode === "enable"
        ? state.ce
          ? "counting"
          : "holding"
        : "ce used in enable mode";
    valFlip.textContent = state.flipped.length
      ? state.flipped.map((b) => `b${b}`).join(",")
      : "—";
    noteFlip.textContent =
      state.mode === "gray" && state.flipped.length === 1
        ? "one-bit Gray step ✓"
        : state.flipped.length
          ? `${state.flipped.length} bit(s) changed`
          : "no change / first";

    traceBox.textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps yet";
    logBox.textContent = state.log.length
      ? state.log.map((e) => e.msg).join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ mode: state.mode, count: state.count, q: state.q })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("ctr-starter").addEventListener("click", loadStarter);

  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    applyModeFlags();
    // keep count; for modulo clamp
    if (state.mode === "modulo" && state.count >= state.mod) {
      state.count = state.count % state.mod;
    }
    syncQ(state);
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });

  modSel.addEventListener("change", () => {
    state.mod = Number(modSel.value);
    if (state.mode === "modulo" && state.count >= state.mod) {
      state.count = state.count % state.mod;
      syncQ(state);
    }
    state.lastAction = "mod";
    pushLog("run", `# MOD → ${state.mod}`);
    renderAll();
  });

  document.getElementById("btn-step").addEventListener("click", stepPosedge);

  document.getElementById("btn-toggle-ce").addEventListener("click", () => {
    state.ce = state.ce ? 0 : 1;
    state.toggledCe = true;
    state.lastAction = "toggle-ce";
    pushLog("run", `# ce → ${state.ce}`);
    renderAll();
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    state.count = 0;
    syncQ(state);
    state.resetDone = true;
    state.lastAction = "reset";
    recentQ = [0];
    pushLog("ok", "# reset → 0");
    renderAll();
  });

  function preset(mode, flag) {
    state.mode = mode;
    state[flag] = true;
    applyModeFlags();
    if (mode === "modulo" && state.count >= state.mod) {
      state.count = state.count % state.mod;
    }
    syncQ(state);
    state.lastAction = `preset-${mode}`;
    pushLog("ok", `# preset ${mode}`);
    renderAll();
  }

  document.getElementById("btn-up").addEventListener("click", () => preset("up", "setUp"));
  document.getElementById("btn-down").addEventListener("click", () => preset("down", "setDown"));
  document.getElementById("btn-modulo").addEventListener("click", () => preset("modulo", "setModulo"));
  document.getElementById("btn-enable").addEventListener("click", () => preset("enable", "setEnable"));
  document.getElementById("btn-gray").addEventListener("click", () => preset("gray", "setGray"));
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-up",
      title: "Quiz: up",
      prompt: "Counter that adds 1 each clock is an? Answer: <code>up</code>",
      hint: "increment",
      type: "text",
      answer: "up",
      alt: ["up counter", "increment"],
    },
    {
      id: "quiz-down",
      title: "Quiz: down",
      prompt: "Counter that subtracts 1 is a? Answer: <code>down</code>",
      hint: "decrement",
      type: "text",
      answer: "down",
      alt: ["down counter", "decrement"],
    },
    {
      id: "quiz-modulo",
      title: "Quiz: modulo",
      prompt: "Period not a power of two uses a? Answer: <code>modulo</code>",
      hint: "mod-M",
      type: "text",
      answer: "modulo",
      alt: ["mod", "modulus", "mod-n"],
    },
    {
      id: "quiz-gray",
      title: "Quiz: Gray",
      prompt: "Codes that flip one bit at a time are? Answer: <code>Gray</code>",
      hint: "Gray code",
      type: "text",
      answer: "gray",
      alt: ["grey", "gray code", "grey code"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — up mode at 0.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "up" && state.setUp && state.count === 0,
    },
    {
      id: "preset-up",
      title: "Preset up",
      prompt: "Preset up.",
      hint: "Preset up",
      type: "state",
      setup: () => {
        state.mode = "down";
        renderAll();
      },
      check: () => state.setUp && state.mode === "up" && state.lastAction === "preset-up",
    },
    {
      id: "preset-down",
      title: "Preset down",
      prompt: "Preset down.",
      hint: "Preset down",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setDown && state.mode === "down",
    },
    {
      id: "preset-modulo",
      title: "Preset modulo",
      prompt: "Preset modulo.",
      hint: "Preset modulo",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setModulo && state.mode === "modulo",
    },
    {
      id: "preset-enable",
      title: "Preset enable",
      prompt: "Preset enable.",
      hint: "Preset enable",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setEnable && state.mode === "enable",
    },
    {
      id: "preset-gray",
      title: "Preset Gray",
      prompt: "Preset Gray.",
      hint: "Preset Gray",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.setGray && state.mode === "gray",
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
      id: "inc",
      title: "Increment",
      prompt: "Up mode: from 0, step once → q=1.",
      hint: "Reset if needed → Preset up → Step",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "up" && state.q === 1 && state.cycle >= 1,
    },
    {
      id: "wrap",
      title: "Wrap",
      prompt: "Up mode: reach q=0 after leaving 15 (wrap).",
      hint: "Set near top or use Demo",
      type: "state",
      setup: () => {
        loadStarter();
        state.count = 15;
        syncQ(state);
        renderAll();
      },
      check: () => state.mode === "up" && state.q === 0 && state.cycle >= 1,
    },
    {
      id: "hold",
      title: "Hold",
      prompt: "Enable mode: ce=0, step — q unchanged (hold).",
      hint: "Preset enable → ce=0 → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "enable";
        state.setEnable = true;
        state.count = 5;
        state.ce = 1;
        syncQ(state);
        renderAll();
      },
      check: () => {
        // After hold step: ce=0 and last step held — q still 5, cycle>=1, mode enable
        return (
          state.mode === "enable" &&
          state.ce === 0 &&
          state.q === 5 &&
          state.cycle >= 1 &&
          state.flipped.length === 0
        );
      },
    },
    {
      id: "toggle-ce",
      title: "Toggle ce",
      prompt: "Toggle ce.",
      hint: "Toggle ce",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledCe && state.lastAction === "toggle-ce",
    },
    {
      id: "mod-wrap",
      title: "Mod wrap",
      prompt: "Modulo-10: from 9, step → q=0.",
      hint: "Preset modulo, MOD=10, count at 9, Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "modulo";
        state.setModulo = true;
        state.mod = 10;
        state.count = 9;
        syncQ(state);
        renderAll();
      },
      check: () =>
        state.mode === "modulo" &&
        state.mod === 10 &&
        state.q === 0 &&
        state.cycle >= 1,
    },
    {
      id: "gray-one",
      title: "Gray one-bit",
      prompt: "Gray mode: step once from phase 0 — exactly one bit flips.",
      hint: "Preset Gray → Reset → Step",
      type: "state",
      setup: () => {
        loadStarter();
        state.mode = "gray";
        state.setGray = true;
        state.count = 0;
        syncQ(state);
        state.flipped = [];
        renderAll();
      },
      check: () =>
        state.mode === "gray" &&
        state.cycle >= 1 &&
        state.flipped.length === 1,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset count to 0 via Reset button.",
      hint: "Reset count",
      type: "state",
      setup: () => {
        loadStarter();
        state.count = 7;
        syncQ(state);
        renderAll();
      },
      check: () =>
        state.resetDone && state.count === 0 && state.lastAction === "reset",
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: wrap + hold.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" &&
        state.mode === "enable" &&
        state.ce === 0,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain modes.",
      hint: "Explain modes",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "code-enable",
      title: "Code enable",
      prompt: "Enable mode source has <code>if (ce)</code>.",
      hint: "Preset enable",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enable" && sourceCode(state).includes("if (ce)"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "enable" &&
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
