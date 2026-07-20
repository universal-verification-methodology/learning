(() => {
  /**
   * XOR parity reduction tree:
   *   parity = b0 ⊕ b1 ⊕ … ⊕ b_{n-1}   (odd-ones / reduce-XOR)
   * Balanced tree: pair adjacent, recurse — depth ⌈log₂ n⌉
   * Linear chain:  (((b0⊕b1)⊕b2)…)     — depth n−1
   * Even parity bit P_even = reduce XOR; odd P = NOT reduce.
   */

  function bitsOf(u, w) {
    const out = [];
    for (let i = w - 1; i >= 0; i--) out.push((u >> i) & 1);
    return out;
  }

  function fromBits(bits) {
    return bits.reduce((a, b) => (a << 1) | (b & 1), 0);
  }

  function reduceXor(bits) {
    return bits.reduce((a, b) => a ^ (b & 1), 0);
  }

  /** Balanced pairwise reduction; leftover promoted when odd length. */
  function buildTree(bits) {
    /** @type {number[][]} */
    const levels = [bits.map((b) => b & 1)];
    while (levels[levels.length - 1].length > 1) {
      const cur = levels[levels.length - 1];
      const next = [];
      for (let i = 0; i < cur.length; i += 2) {
        if (i + 1 < cur.length) next.push(cur[i] ^ cur[i + 1]);
        else next.push(cur[i]); // promote odd leaf
      }
      levels.push(next);
    }
    return levels;
  }

  function treeDepth(n) {
    if (n <= 1) return 0;
    return Math.ceil(Math.log2(n));
  }

  function chainDepth(n) {
    return Math.max(0, n - 1);
  }

  function makeStarter() {
    // 0b1010 = 0xA — 2 ones → reduce XOR = 0; tree depth 2 for n=4
    return {
      w: 4,
      bits: [1, 0, 1, 0],
      step: 0, // how many tree levels revealed (0 = leaves only)
      lastAction: "",
      toggled: false,
      stepped: false,
      compared: false,
      setEight: false,
      setAllOne: false,
      explained: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-xor-parity-tree-cleared-v1";
  const STORE_KEY = "ddv-xor-parity-tree-session-v1";

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

  const root = document.getElementById("xp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 4-bit <code>1010</code> —
        reduce XOR = <code>0</code> (even ones). Balanced tree depth 2 vs chain depth 3.</p>
      <button type="button" class="btn btn-secondary" id="xp-starter">Load starter example</button>
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
            <h3>Reduce XOR</h3>
            <p>Parity of ones = <code>b₀⊕b₁⊕…</code> (odd → 1).</p>
          </div>
          <div class="idea-card">
            <h3>Tree</h3>
            <p>Pairwise XOR; odd leftover promotes — depth ⌈log₂N⌉.</p>
          </div>
          <div class="idea-card">
            <h3>Chain</h3>
            <p>Serial fold needs N−1 XOR delays on the critical path.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Inputs &amp; tree</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Width
              <select id="w-sel">
                <option value="4" selected>4</option>
                <option value="8">8</option>
              </select>
            </label>
            <label>Hex
              <input type="text" id="hex-in" size="6" placeholder="0xA">
            </label>
            <button type="button" class="btn btn-ghost" id="btn-hex">Load hex</button>
          </div>
          <p class="legend">MSB left. Click a bit to toggle. Step reveals tree levels.</p>
          <div class="bit-row" id="bit-row"></div>
          <div class="depth-bar" id="depth-bar"></div>
          <svg class="tree-svg" id="tree-svg" viewBox="0 0 420 220" role="img" aria-label="XOR reduction tree"></svg>
          <div class="action-grid">
            <button type="button" id="btn-step">Step tree level</button>
            <button type="button" id="btn-full">Reveal full tree</button>
            <button type="button" id="btn-reset-step">Reset steps</button>
            <button type="button" id="btn-compare">Compare tree vs chain depth</button>
            <button type="button" id="btn-eight">Preset 8-bit 0xA5</button>
            <button type="button" id="btn-all1">All ones</button>
            <button type="button" id="btn-explain">Explain parity</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Parity &amp; levels</h2></div>
        <div class="panel-body">
          <div class="out-grid">
            <div class="out-card">
              <h3>Reduce XOR</h3>
              <p class="val" id="rx-val">—</p>
              <p class="eq">odd ones → 1</p>
            </div>
            <div class="out-card">
              <h3>Even P / Odd P</h3>
              <p class="val" id="p-val">—</p>
              <p class="eq">P<sub>even</sub> = ⊕ &nbsp; P<sub>odd</sub> = ¬⊕</p>
            </div>
          </div>
          <ol class="level-list" id="level-list"></ol>
          <pre class="trace-box" id="trace-box" style="margin-top:0.65rem"></pre>
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
            <tr><td>Reduce XOR</td><td>Associative/commutative — tree = chain result</td></tr>
            <tr><td>Tree depth</td><td>⌈log₂ N⌉ XOR stages (balanced)</td></tr>
            <tr><td>Chain depth</td><td>N − 1 serial XORs</td></tr>
            <tr><td>Even parity bit</td><td>Equals reduce XOR (total ones even)</td></tr>
            <tr><td>Odd leftover</td><td>Promotes unchanged to next level</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter <code>1010</code>: level1 <code>1⊕0=1</code>, <code>1⊕0=1</code> → level2 <code>1⊕1=0</code>.</li>
          <li>Hardware parity generators use trees for timing, not linear folds.</li>
        </ul>
      </div>
    </div>
  `;

  const wSel = document.getElementById("w-sel");
  const hexIn = document.getElementById("hex-in");
  const bitRow = document.getElementById("bit-row");
  const depthBar = document.getElementById("depth-bar");
  const treeSvg = document.getElementById("tree-svg");
  const rxVal = document.getElementById("rx-val");
  const pVal = document.getElementById("p-val");
  const levelList = document.getElementById("level-list");
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

  function ensureWidth() {
    const w = state.w;
    if (state.bits.length < w) {
      while (state.bits.length < w) state.bits.unshift(0);
    } else if (state.bits.length > w) {
      state.bits = state.bits.slice(-w);
    }
  }

  function maxStep() {
    return Math.max(0, buildTree(state.bits).length - 1);
  }

  function renderBits() {
    ensureWidth();
    bitRow.innerHTML = "";
    state.bits.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = b ? "on" : "";
      const idx = state.w - 1 - i;
      btn.textContent = `b${idx}=${b}`;
      btn.addEventListener("click", () => {
        state.bits[i] = b ? 0 : 1;
        state.toggled = true;
        state.lastAction = "toggle";
        state.step = 0;
        pushLog("run", `# b${idx} → ${state.bits[i]}`);
        renderAll();
      });
      bitRow.appendChild(btn);
    });
  }

  function renderDepth() {
    const n = state.bits.length;
    const td = treeDepth(n);
    const cd = chainDepth(n);
    depthBar.innerHTML = `
      <span class="depth-pill win">tree depth ${td}</span>
      <span class="depth-pill">chain depth ${cd}</span>
      <span class="depth-pill">N=${n}</span>`;
  }

  function renderOutputs() {
    const rx = reduceXor(state.bits);
    rxVal.textContent = String(rx);
    pVal.textContent = `${rx} / ${rx ^ 1}`;
  }

  function renderLevels() {
    const levels = buildTree(state.bits);
    const reveal = Math.min(state.step, levels.length - 1);
    levelList.innerHTML = "";
    levels.forEach((lev, li) => {
      const item = document.createElement("li");
      const shown = li <= reveal;
      item.className = shown ? (li === reveal ? "hi" : "") : "dim";
      const label = li === 0 ? "leaves" : `level ${li}`;
      item.textContent = shown
        ? `${label}: [${lev.join(" ")}]`
        : `${label}: (step to reveal)`;
      levelList.appendChild(item);
    });
  }

  function renderTree() {
    const levels = buildTree(state.bits);
    const reveal = Math.min(state.step, levels.length - 1);
    const n0 = levels[0].length;
    const rowH = 48;
    const height = 36 + levels.length * rowH;
    const width = 420;
    treeSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    let html = "";
    const positions = [];

    levels.forEach((lev, li) => {
      const y = 28 + li * rowH;
      const gap = width / (lev.length + 1);
      positions[li] = lev.map((_, j) => ({ x: gap * (j + 1), y }));
      if (li > reveal) return;
      lev.forEach((v, j) => {
        const { x } = positions[li][j];
        const fill = v ? "#1f3d2a" : "#243040";
        const stroke = v ? "#8fd4a8" : "#3a4654";
        html += `<circle cx="${x}" cy="${y}" r="14" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
        html += `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#e8eef4" font-size="12" font-family="ui-monospace,monospace">${v}</text>`;
        if (li === 0) {
          const idx = n0 - 1 - j;
          html += `<text x="${x}" y="${y - 20}" text-anchor="middle" fill="#7a8a9a" font-size="10" font-family="ui-monospace,monospace">b${idx}</text>`;
        }
      });
    });

    // edges from parent level to children
    for (let li = 1; li <= reveal; li++) {
      const prev = levels[li - 1];
      const cur = levels[li];
      let src = 0;
      for (let j = 0; j < cur.length; j++) {
        const parent = positions[li][j];
        if (src + 1 < prev.length) {
          const a = positions[li - 1][src];
          const b = positions[li - 1][src + 1];
          html += `<line x1="${a.x}" y1="${a.y + 14}" x2="${parent.x}" y2="${parent.y - 14}" stroke="#5a6a7a"/>`;
          html += `<line x1="${b.x}" y1="${b.y + 14}" x2="${parent.x}" y2="${parent.y - 14}" stroke="#5a6a7a"/>`;
          html += `<text x="${parent.x}" y="${parent.y - 22}" text-anchor="middle" fill="#f0c674" font-size="9" font-family="ui-monospace,monospace">⊕</text>`;
          src += 2;
        } else {
          const a = positions[li - 1][src];
          html += `<line x1="${a.x}" y1="${a.y + 14}" x2="${parent.x}" y2="${parent.y - 14}" stroke="#5a6a7a" stroke-dasharray="3 3"/>`;
          html += `<text x="${parent.x}" y="${parent.y - 22}" text-anchor="middle" fill="#7a8a9a" font-size="9" font-family="ui-monospace,monospace">↑</text>`;
          src += 1;
        }
      }
    }

    treeSvg.innerHTML = html;
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(step, compare, or explain)</span>';
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
    ensureWidth();
    wSel.value = String(state.w);
    hexIn.value =
      "0x" + fromBits(state.bits).toString(16).toUpperCase();
    renderBits();
    renderDepth();
    renderOutputs();
    renderLevels();
    renderTree();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter 1010 reduceXOR=0 depth tree=2 chain=3");
    state.trace = [];
    renderAll();
  }

  function stepTree() {
    const m = maxStep();
    if (state.step < m) state.step += 1;
    state.stepped = true;
    state.lastAction = "step";
    const levels = buildTree(state.bits);
    const lev = levels[state.step];
    state.trace = [
      { kind: "muted", text: `step → level ${state.step}/${m}` },
      { kind: "hi", text: `[${lev.join(" ")}]` },
      {
        kind: "ok",
        text:
          state.step === m
            ? `root = reduce XOR = ${lev[0]}`
            : "continue stepping",
      },
    ];
    pushLog("ok", `# step level ${state.step}`);
    renderAll();
  }

  function revealFull() {
    state.step = maxStep();
    state.stepped = true;
    state.lastAction = "full";
    pushLog("ok", "# full tree");
    renderAll();
  }

  function compareDepth() {
    const n = state.bits.length;
    state.compared = true;
    state.lastAction = "compare";
    state.trace = [
      { kind: "muted", text: `depth comparison N=${n}` },
      { kind: "ok", text: `balanced tree ⌈log₂ ${n}⌉ = ${treeDepth(n)}` },
      { kind: "warn", text: `linear chain N−1 = ${chainDepth(n)}` },
      {
        kind: "hi",
        text: `same result ${reduceXor(state.bits)}; tree wins on timing`,
      },
    ];
    pushLog("ok", "# compared depths");
    renderAll();
  }

  function explain() {
    const rx = reduceXor(state.bits);
    const ones = state.bits.filter((b) => b).length;
    state.explained = true;
    state.lastAction = "explain";
    state.step = maxStep();
    state.trace = [
      { kind: "muted", text: `bits ${state.bits.join("")}` },
      { kind: "hi", text: `${ones} ones → reduce XOR = ${rx}` },
      { kind: "ok", text: `even parity bit P = ${rx}` },
      { kind: "ok", text: `odd parity bit P = ${rx ^ 1}` },
      {
        kind: "muted",
        text: "tree associates XORs; value identical to a chain",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("xp-starter").addEventListener("click", loadStarter);
  wSel.addEventListener("change", () => {
    state.w = Number(wSel.value);
    ensureWidth();
    state.step = 0;
    if (state.w === 8) state.setEight = true;
    state.lastAction = "width";
    pushLog("run", `# width → ${state.w}`);
    renderAll();
  });
  document.getElementById("btn-hex").addEventListener("click", () => {
    let s = hexIn.value.trim().toLowerCase().replace(/^0x/, "");
    const v = parseInt(s, 16);
    if (Number.isNaN(v)) {
      pushLog("warn", "# bad hex");
      renderLog();
      return;
    }
    state.bits = bitsOf(v & ((1 << state.w) - 1), state.w);
    state.step = 0;
    state.lastAction = "hex";
    pushLog("ok", `# load 0x${v.toString(16)}`);
    renderAll();
  });
  document.getElementById("btn-step").addEventListener("click", stepTree);
  document.getElementById("btn-full").addEventListener("click", revealFull);
  document.getElementById("btn-reset-step").addEventListener("click", () => {
    state.step = 0;
    state.lastAction = "reset-step";
    pushLog("muted", "# reset steps");
    renderAll();
  });
  document.getElementById("btn-compare").addEventListener("click", compareDepth);
  document.getElementById("btn-eight").addEventListener("click", () => {
    state.w = 8;
    state.setEight = true;
    state.bits = bitsOf(0xa5, 8);
    state.step = 0;
    state.lastAction = "preset-8";
    pushLog("ok", "# preset 0xA5");
    renderAll();
  });
  document.getElementById("btn-all1").addEventListener("click", () => {
    state.bits = Array(state.w).fill(1);
    state.setAllOne = true;
    state.step = 0;
    state.lastAction = "all1";
    pushLog("ok", "# all ones");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-reduce",
      title: "Quiz: reduce",
      prompt: "Parity of ones equals which reduction? Answer: <code>XOR</code>",
      hint: "⊕ of all bits",
      type: "text",
      answer: "xor",
      alt: ["XOR", "reduction xor", "reduce xor", "^"],
    },
    {
      id: "quiz-assoc",
      title: "Quiz: assoc",
      prompt: "Tree and chain give the same bit because XOR is? Answer: <code>associative</code>",
      hint: "also commutative",
      type: "text",
      answer: "associative",
      alt: ["associative/commutative", "commutative"],
    },
    {
      id: "quiz-log",
      title: "Quiz: depth",
      prompt: "Balanced tree depth grows like? Answer: <code>log</code>",
      hint: "⌈log₂ N⌉",
      type: "text",
      answer: "log",
      alt: ["log2", "log₂", "lg", "ceil log"],
    },
    {
      id: "quiz-chain",
      title: "Quiz: chain",
      prompt: "Linear chain XOR depth is? Answer: <code>N-1</code>",
      hint: "serial fold",
      type: "text",
      answer: "n-1",
      alt: ["N-1", "n−1", "N−1"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — bits 1010, reduce XOR = 0.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.bits.join("") === "1010" && reduceXor(state.bits) === 0,
    },
    {
      id: "depth-4",
      title: "Depth 4",
      prompt: "On 4-bit starter, tree depth should be 2.",
      hint: "⌈log₂ 4⌉",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.w === 4 && treeDepth(4) === 2 && chainDepth(4) === 3,
    },
    {
      id: "step-once",
      title: "Step once",
      prompt: "Step tree level at least once from starter.",
      hint: "Step tree level",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.stepped && state.step >= 1,
    },
    {
      id: "level1-starter",
      title: "Level 1",
      prompt: "After one step on 1010, level1 should be [1 1].",
      hint: "Step once",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const levels = buildTree(state.bits);
        return (
          state.bits.join("") === "1010" &&
          state.step >= 1 &&
          levels[1].join("") === "11"
        );
      },
    },
    {
      id: "full-root",
      title: "Full root",
      prompt: "Reveal full tree on starter — root bit 0.",
      hint: "Reveal full tree",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const levels = buildTree(state.bits);
        return (
          state.step === maxStep() &&
          levels[levels.length - 1][0] === 0 &&
          state.bits.join("") === "1010"
        );
      },
    },
    {
      id: "compare",
      title: "Compare",
      prompt: "Run Compare tree vs chain depth.",
      hint: "Compare button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.compared && state.lastAction === "compare",
    },
    {
      id: "even-p",
      title: "Even P",
      prompt: "On starter, even parity bit equals reduce XOR? Answer: <code>0</code>",
      hint: "P_even = ⊕",
      type: "text",
      answer: "0",
      alt: ["zero"],
    },
    {
      id: "odd-p",
      title: "Odd P",
      prompt: "On starter, odd parity bit? Answer: <code>1</code>",
      hint: "¬⊕",
      type: "text",
      answer: "1",
      alt: ["one"],
    },
    {
      id: "preset-8",
      title: "8-bit 0xA5",
      prompt: "Preset 8-bit 0xA5 — reduce XOR should be 0 (4 ones).",
      hint: "Preset 8-bit 0xA5",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setEight &&
        state.w === 8 &&
        fromBits(state.bits) === 0xa5 &&
        reduceXor(state.bits) === 0,
    },
    {
      id: "depth-8",
      title: "Depth 8",
      prompt: "On 8-bit, tree depth 3 vs chain 7.",
      hint: "Preset 8-bit then compare",
      type: "state",
      setup: () => {
        state.w = 8;
        state.bits = bitsOf(0xa5, 8);
        state.setEight = true;
        renderAll();
      },
      check: () =>
        state.w === 8 && treeDepth(8) === 3 && chainDepth(8) === 7,
    },
    {
      id: "all1-4",
      title: "All ones",
      prompt: "4-bit all ones — reduce XOR = 0 (even count).",
      hint: "Width 4 → All ones",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setAllOne &&
        state.w === 4 &&
        state.bits.every((b) => b === 1) &&
        reduceXor(state.bits) === 0,
    },
    {
      id: "toggle",
      title: "Toggle",
      prompt: "Toggle any leaf bit.",
      hint: "Click a bit",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggled && state.lastAction === "toggle",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain parity.",
      hint: "Explain parity",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "quiz-promote",
      title: "Quiz: odd N",
      prompt: "Odd leftover node is? Answer: <code>promoted</code>",
      hint: "passes up unchanged",
      type: "text",
      answer: "promoted",
      alt: ["promote", "promoted unchanged", "passed up"],
    },
    {
      id: "hex-load",
      title: "Hex load",
      prompt: "Load hex 0xF on 4-bit (all ones) via hex field.",
      hint: "Hex 0xF → Load hex",
      type: "state",
      setup: () => {
        state.w = 4;
        state.bits = [1, 0, 1, 0];
        renderAll();
      },
      check: () =>
        state.lastAction === "hex" &&
        state.w === 4 &&
        fromBits(state.bits) === 0xf,
    },
    {
      id: "flip-parity",
      title: "Flip parity",
      prompt: "From starter, flip one bit so reduce XOR becomes 1.",
      hint: "Toggle any 1→0 or 0→1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.toggled &&
        state.bits.join("") !== "1010" &&
        reduceXor(state.bits) === 1,
    },
    {
      id: "quiz-same",
      title: "Quiz: value",
      prompt: "Tree root equals chain fold always? Answer: <code>yes</code>",
      hint: "associativity",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → full reveal → compare depths.",
      hint: "Load → Reveal full → Compare",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.bits.join("") === "1010" &&
        state.step === maxStep() &&
        state.compared,
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
