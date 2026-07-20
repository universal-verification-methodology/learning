(() => {
  /**
   * 8-bit barrel shifter: log₂N mux stages for amt bits [2:0]
   *   stage0: shift/rotate by 1 if amt[0]
   *   stage1: by 2 if amt[1]
   *   stage2: by 4 if amt[2]
   * Modes: sll, srl, sra, rol, ror
   */

  const W = 8;

  function bitsOf(u) {
    const out = [];
    for (let i = W - 1; i >= 0; i--) out.push((u >> i) & 1);
    return out;
  }

  function fromBits(bits) {
    return bits.reduce((a, b) => (a << 1) | (b & 1), 0) & 0xff;
  }

  function applyUnit(bits, mode, k) {
    if (k === 0) return bits.slice();
    const n = bits.length;
    const out = Array(n).fill(0);
    const sign = bits[0];
    for (let i = 0; i < n; i++) {
      if (mode === "sll") {
        out[i] = i + k < n ? bits[i + k] : 0;
      } else if (mode === "srl") {
        out[i] = i - k >= 0 ? bits[i - k] : 0;
      } else if (mode === "sra") {
        out[i] = i - k >= 0 ? bits[i - k] : sign;
      } else if (mode === "rol") {
        out[i] = bits[(i + k) % n];
      } else if (mode === "ror") {
        out[i] = bits[(i - k + n * 4) % n];
      }
    }
    return out;
  }

  /** Run barrel stages; return { stages: bits[][], amtBits } */
  function barrel(bits, mode, amt) {
    const a = amt & 7;
    const amtBits = [a & 1, (a >> 1) & 1, (a >> 2) & 1];
    const stages = [bits.slice()];
    let cur = bits.slice();
    const ks = [1, 2, 4];
    for (let s = 0; s < 3; s++) {
      if (amtBits[s]) cur = applyUnit(cur, mode, ks[s]);
      stages.push(cur.slice());
    }
    return { stages, amtBits, amt: a, out: cur };
  }

  function opLabel(mode) {
    return (
      {
        sll: "<< logical left",
        srl: ">> logical right",
        sra: ">>> arithmetic right",
        rol: "rotate left",
        ror: "rotate right",
      }[mode] || mode
    );
  }

  function makeStarter() {
    // 0b11010010 = 0xD2; sll by 3 → stages 1+2
    return {
      data: 0xd2,
      amt: 3,
      mode: "sll",
      lastAction: "",
      toggledBit: false,
      setMode: false,
      setAmt: false,
      explained: false,
      stepped: false,
      revealStage: 3, // 0..3 how many stage results shown
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-barrel-shifter-cleared-v1";
  const STORE_KEY = "ddv-barrel-shifter-session-v1";

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

  const root = document.getElementById("bs-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>0xD2</code> (<code>11010010</code>)
        logical left by <code>3</code> — stages use amt bits <code>1+2</code> (not three serial ×1).</p>
      <button type="button" class="btn btn-secondary" id="bs-starter">Load starter example</button>
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
            <h3>Barrel</h3>
            <p>Any shift 0…N−1 in ⌈log₂N⌉ mux layers.</p>
          </div>
          <div class="idea-card">
            <h3>Amt bits</h3>
            <p>Each bit enables a power-of-two stage (1, 2, 4…).</p>
          </div>
          <div class="idea-card">
            <h3>Modes</h3>
            <p>Logical / arithmetic shift vs rotate (wrap).</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Controls</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="sll">Logical left (<<)</option>
                <option value="srl">Logical right (>>)</option>
                <option value="sra">Arithmetic right (>>>)</option>
                <option value="rol">Rotate left</option>
                <option value="ror">Rotate right</option>
              </select>
            </label>
            <label>Amount
              <input type="number" id="amt-in" min="0" max="7" value="3">
            </label>
            <label>Hex
              <input type="text" id="hex-in" size="6" value="0xD2">
            </label>
            <button type="button" class="btn btn-ghost" id="btn-hex">Load</button>
          </div>
          <p class="legend">Click data bits (MSB left). Amount 0–7 selects which stages fire.</p>
          <div class="bit-row" id="in-bits"></div>
          <div class="amt-bits" id="amt-bits"></div>
          <div class="bit-row" id="out-bits"></div>
          <svg class="stage-svg" id="stage-svg" viewBox="0 0 420 170" role="img" aria-label="Barrel stages"></svg>
          <div class="action-grid">
            <button type="button" id="btn-step">Step next stage</button>
            <button type="button" id="btn-full">Show all stages</button>
            <button type="button" id="btn-reset-step">Reset stage view</button>
            <button type="button" id="btn-sra">Preset SRA 0x82 >>> 2</button>
            <button type="button" id="btn-rol">Preset ROL 0x01 <<rot 1</button>
            <button type="button" id="btn-explain">Explain stages</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Result &amp; stages</h2></div>
        <div class="panel-body">
          <div class="out-grid">
            <div class="out-card">
              <h3>Input</h3>
              <p class="val" id="in-hex">—</p>
            </div>
            <div class="out-card">
              <h3>Output</h3>
              <p class="val" id="out-hex">—</p>
            </div>
          </div>
          <ol class="stage-list" id="stage-list"></ol>
          <pre class="trace-box" id="trace-box" style="margin-top:0.65rem"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Mode</th><th>Fill / wrap</th></tr></thead>
          <tbody>
            <tr><td>SLL</td><td>Shift left; zeros enter from right</td></tr>
            <tr><td>SRL</td><td>Shift right; zeros enter from left</td></tr>
            <tr><td>SRA</td><td>Shift right; sign bit replicates</td></tr>
            <tr><td>ROL / ROR</td><td>Bits wrap; no information lost</td></tr>
            <tr><td>Stages</td><td>amt=5 → stages 1 and 4 (bits 0 and 2)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: 0xD2 << 3 = 0x90 (11010010 → 10010000).</li>
          <li>Critical path ≈ 3 mux delays, independent of shift amount.</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const amtIn = document.getElementById("amt-in");
  const hexIn = document.getElementById("hex-in");
  const inBits = document.getElementById("in-bits");
  const outBits = document.getElementById("out-bits");
  const amtBitsEl = document.getElementById("amt-bits");
  const stageSvg = document.getElementById("stage-svg");
  const stageList = document.getElementById("stage-list");
  const inHex = document.getElementById("in-hex");
  const outHex = document.getElementById("out-hex");
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

  function result() {
    return barrel(bitsOf(state.data), state.mode, state.amt);
  }

  function renderInBits() {
    const bits = bitsOf(state.data);
    inBits.innerHTML = '<span class="lbl">in</span>';
    bits.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = b ? "on" : "";
      btn.textContent = String(b);
      btn.title = `bit ${W - 1 - i}`;
      btn.addEventListener("click", () => {
        const mask = 1 << (W - 1 - i);
        state.data = (state.data ^ mask) & 0xff;
        state.toggledBit = true;
        state.lastAction = "toggle";
        state.revealStage = 0;
        pushLog("run", `# toggle bit ${W - 1 - i}`);
        renderAll();
      });
      inBits.appendChild(btn);
    });
  }

  function renderOutBits() {
    const r = result();
    const show = r.stages[Math.min(state.revealStage, 3)];
    outBits.innerHTML = '<span class="lbl">out</span>';
    show.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "out" + (b ? " on" : "");
      btn.textContent = String(b);
      btn.disabled = true;
      outBits.appendChild(btn);
    });
  }

  function renderAmtBits() {
    const r = result();
    const labels = ["amt[0]→×1", "amt[1]→×2", "amt[2]→×4"];
    amtBitsEl.innerHTML = "";
    r.amtBits.forEach((b, i) => {
      const s = document.createElement("span");
      s.className = b ? "on" : "";
      s.textContent = `${labels[i]}=${b}`;
      amtBitsEl.appendChild(s);
    });
  }

  function renderStageList() {
    const r = result();
    const names = ["in (stage −)", "after ×1", "after ×2", "after ×4 (=out)"];
    stageList.innerHTML = "";
    r.stages.forEach((st, i) => {
      const li = document.createElement("li");
      const active = i === Math.min(state.revealStage, 3);
      const shown = i <= state.revealStage;
      const fired =
        i === 0 ? true : r.amtBits[i - 1] === 1;
      li.className = shown ? (active ? "active" : "") : "skip";
      if (shown) {
        li.textContent = `${names[i]}: ${st.join("")}${
          i > 0 ? (fired ? " (mux shift)" : " (bypass)") : ""
        }`;
      } else {
        li.textContent = `${names[i]}: (step to reveal)`;
      }
      stageList.appendChild(li);
    });
  }

  function renderSvg() {
    const r = result();
    const reveal = Math.min(state.revealStage, 3);
    let html = "";
    const rowH = 36;
    r.stages.forEach((st, si) => {
      if (si > reveal) return;
      const y = 24 + si * rowH;
      const label =
        si === 0 ? "in" : si === 3 ? "out" : `s${si}`;
      html += `<text x="8" y="${y + 4}" fill="#7a8a9a" font-size="11" font-family="ui-monospace,monospace">${label}</text>`;
      st.forEach((b, j) => {
        const x = 48 + j * 44;
        const fill = b ? "#1f3d2a" : "#243040";
        const stroke = b ? "#8fd4a8" : "#3a4654";
        html += `<rect x="${x}" y="${y - 12}" width="36" height="24" rx="4" fill="${fill}" stroke="${stroke}"/>`;
        html += `<text x="${x + 18}" y="${y + 4}" text-anchor="middle" fill="#e8eef4" font-size="12" font-family="ui-monospace,monospace">${b}</text>`;
      });
      if (si > 0 && si <= reveal) {
        const on = r.amtBits[si - 1];
        html += `<text x="400" y="${y - 18}" text-anchor="end" fill="${on ? "#f0c674" : "#5a6a7a"}" font-size="10" font-family="ui-monospace,monospace">${on ? "SHIFT" : "BYPASS"}</text>`;
      }
    });
    stageSvg.innerHTML = html;
  }

  function renderOutCards() {
    const r = result();
    const shown = r.stages[Math.min(state.revealStage, 3)];
    inHex.textContent =
      "0x" +
      state.data.toString(16).toUpperCase().padStart(2, "0") +
      "  " +
      bitsOf(state.data).join("");
    outHex.textContent =
      "0x" +
      fromBits(shown).toString(16).toUpperCase().padStart(2, "0") +
      "  " +
      shown.join("") +
      (state.revealStage < 3 ? " (partial)" : "");
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(step or explain)</span>';
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
    modeSel.value = state.mode;
    amtIn.value = String(state.amt);
    hexIn.value =
      "0x" + state.data.toString(16).toUpperCase().padStart(2, "0");
    renderInBits();
    renderAmtBits();
    renderOutBits();
    renderStageList();
    renderSvg();
    renderOutCards();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter 0xD2 << 3");
    state.trace = [];
    renderAll();
  }

  function explain() {
    const r = result();
    state.explained = true;
    state.lastAction = "explain";
    state.revealStage = 3;
    state.trace = [
      { kind: "muted", text: `${opLabel(state.mode)} by ${r.amt}` },
      {
        kind: "hi",
        text: `amt bits [2:0] = ${r.amtBits[2]}${r.amtBits[1]}${r.amtBits[0]} → stages ${[1, 2, 4]
          .filter((_, i) => r.amtBits[i])
          .join("+") || "none"}`,
      },
      {
        kind: "ok",
        text: `${bitsOf(state.data).join("")} → ${r.out.join("")}`,
      },
      {
        kind: "muted",
        text: "3 mux layers ≈ constant latency vs amount",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("bs-starter").addEventListener("click", loadStarter);
  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    state.setMode = true;
    state.lastAction = "mode";
    state.revealStage = 0;
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });
  amtIn.addEventListener("change", () => {
    state.amt = Math.max(0, Math.min(7, Number(amtIn.value) || 0));
    state.setAmt = true;
    state.lastAction = "amt";
    state.revealStage = 0;
    pushLog("run", `# amt → ${state.amt}`);
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
    state.data = v & 0xff;
    state.lastAction = "hex";
    state.revealStage = 0;
    pushLog("ok", `# data 0x${state.data.toString(16)}`);
    renderAll();
  });
  document.getElementById("btn-step").addEventListener("click", () => {
    if (state.revealStage < 3) state.revealStage += 1;
    state.stepped = true;
    state.lastAction = "step";
    const r = result();
    const st = r.stages[state.revealStage];
    state.trace = [
      { kind: "muted", text: `reveal stage ${state.revealStage}/3` },
      { kind: "hi", text: st.join("") },
    ];
    pushLog("ok", `# step ${state.revealStage}`);
    renderAll();
  });
  document.getElementById("btn-full").addEventListener("click", () => {
    state.revealStage = 3;
    state.stepped = true;
    state.lastAction = "full";
    pushLog("ok", "# all stages");
    renderAll();
  });
  document.getElementById("btn-reset-step").addEventListener("click", () => {
    state.revealStage = 0;
    state.lastAction = "reset-step";
    pushLog("muted", "# reset view");
    renderAll();
  });
  document.getElementById("btn-sra").addEventListener("click", () => {
    state.mode = "sra";
    state.data = 0x82;
    state.amt = 2;
    state.setMode = true;
    state.setAmt = true;
    state.revealStage = 3;
    state.lastAction = "preset-sra";
    pushLog("ok", "# SRA 0x82 >>> 2");
    renderAll();
  });
  document.getElementById("btn-rol").addEventListener("click", () => {
    state.mode = "rol";
    state.data = 0x01;
    state.amt = 1;
    state.setMode = true;
    state.setAmt = true;
    state.revealStage = 3;
    state.lastAction = "preset-rol";
    pushLog("ok", "# ROL 0x01 by 1");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-log",
      title: "Quiz: layers",
      prompt: "8-bit barrel needs how many mux stages? Answer: <code>3</code>",
      hint: "log₂ 8",
      type: "text",
      answer: "3",
      alt: ["three"],
    },
    {
      id: "quiz-powers",
      title: "Quiz: powers",
      prompt: "Stage sizes are powers of? Answer: <code>2</code>",
      hint: "1, 2, 4",
      type: "text",
      answer: "2",
      alt: ["two"],
    },
    {
      id: "quiz-sra",
      title: "Quiz: SRA",
      prompt: "Arithmetic right fill uses the? Answer: <code>sign</code>",
      hint: "MSB replicates",
      type: "text",
      answer: "sign",
      alt: ["sign bit", "msb", "MSB"],
    },
    {
      id: "quiz-rot",
      title: "Quiz: rotate",
      prompt: "Rotate preserves all bits (no fill zeros)? Answer: <code>yes</code>",
      hint: "wrap",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 0xD2 SLL by 3.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.data === 0xd2 && state.mode === "sll" && state.amt === 3,
    },
    {
      id: "starter-out",
      title: "Starter out",
      prompt: "Starter full result should be 0x90.",
      hint: "Show all stages",
      type: "state",
      setup: () => {
        loadStarter();
        state.revealStage = 3;
        renderAll();
      },
      check: () => fromBits(result().out) === 0x90,
    },
    {
      id: "amt-bits-3",
      title: "Amt bits",
      prompt: "Amount 3 enables stages ×1 and ×2 (not ×4).",
      hint: "amt bits 011",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = result();
        return (
          state.amt === 3 &&
          r.amtBits[0] === 1 &&
          r.amtBits[1] === 1 &&
          r.amtBits[2] === 0
        );
      },
    },
    {
      id: "step",
      title: "Step",
      prompt: "Step next stage at least once.",
      hint: "Step next stage",
      type: "state",
      setup: () => {
        loadStarter();
        state.revealStage = 0;
        renderAll();
      },
      check: () => state.stepped && state.revealStage >= 1,
    },
    {
      id: "after-x1",
      title: "After ×1",
      prompt: "On starter, after ×1 stage bits should be 10100100.",
      hint: "Reset view → step once",
      type: "state",
      setup: () => {
        loadStarter();
        state.revealStage = 0;
        renderAll();
      },
      check: () => {
        const r = result();
        return (
          state.data === 0xd2 &&
          state.revealStage >= 1 &&
          r.stages[1].join("") === "10100100"
        );
      },
    },
    {
      id: "sra-preset",
      title: "SRA preset",
      prompt: "Preset SRA 0x82 >>> 2 → 0xE0.",
      hint: "Preset SRA button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "sra" &&
        state.data === 0x82 &&
        state.amt === 2 &&
        fromBits(result().out) === 0xe0,
    },
    {
      id: "rol-preset",
      title: "ROL preset",
      prompt: "Preset ROL 0x01 by 1 → 0x02.",
      hint: "Preset ROL button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "rol" &&
        state.data === 0x01 &&
        fromBits(result().out) === 0x02,
    },
    {
      id: "srl-zero",
      title: "SRL fill",
      prompt: "Mode SRL, data 0x80, amt 1 → 0x40 (zero fill).",
      hint: "Set mode/data/amt",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "srl" &&
        state.data === 0x80 &&
        state.amt === 1 &&
        fromBits(result().out) === 0x40,
    },
    {
      id: "amt5",
      title: "Amt 5",
      prompt: "Amount 5 uses stages ×1 and ×4.",
      hint: "Set amount to 5",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = result();
        return (
          state.amt === 5 &&
          r.amtBits.join("") === "101"
        );
      },
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain stages.",
      hint: "Explain stages",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "toggle",
      title: "Toggle bit",
      prompt: "Toggle any input bit.",
      hint: "Click an in bit",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledBit && state.lastAction === "toggle",
    },
    {
      id: "mode-ror",
      title: "Mode ROR",
      prompt: "Switch mode to rotate right.",
      hint: "Mode dropdown",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "ror" && state.setMode,
    },
    {
      id: "quiz-bypass",
      title: "Quiz: bypass",
      prompt: "When amt bit is 0 the stage? Answer: <code>bypass</code>",
      hint: "pass-through mux",
      type: "text",
      answer: "bypass",
      alt: ["bypasses", "pass", "passthrough", "pass-through"],
    },
    {
      id: "identity",
      title: "Amt 0",
      prompt: "Any mode with amt 0 leaves data unchanged.",
      hint: "Set amount 0",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.amt === 0 && fromBits(result().out) === state.data,
    },
    {
      id: "ror-wrap",
      title: "ROR wrap",
      prompt: "0x01 ROR 1 → 0x80 (bit wraps).",
      hint: "mode ror, data 1, amt 1",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "ror" &&
        state.data === 0x01 &&
        state.amt === 1 &&
        fromBits(result().out) === 0x80,
    },
    {
      id: "quiz-latency",
      title: "Quiz: latency",
      prompt: "Barrel critical path depends mainly on? Answer: <code>stages</code>",
      hint: "not on shift amount value",
      type: "text",
      answer: "stages",
      alt: ["mux stages", "log stages", "layer count", "3"],
    },
    {
      id: "hex-load",
      title: "Hex load",
      prompt: "Load hex 0xFF via the hex field.",
      hint: "Hex → Load",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "hex" && state.data === 0xff,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → show all stages → explain.",
      hint: "Load → Show all → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.data === 0xd2 &&
        state.amt === 3 &&
        state.revealStage === 3 &&
        state.explained &&
        fromBits(result().out) === 0x90,
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

  // Verify starter math quickly in console if needed
  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
