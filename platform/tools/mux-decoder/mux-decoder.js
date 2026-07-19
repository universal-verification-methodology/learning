(() => {
  const STORAGE_KEY = "ddv-mux-decoder-v1";
  const CLEARED_KEY = "ddv-mux-decoder-cleared-v1";

  const MODES = {
    mux21: {
      id: "mux21",
      label: "2:1 mux",
      kind: "mux",
      selBits: 1,
      dataN: 2,
      formula: "Y = S'·D0 + S·D1",
    },
    mux41: {
      id: "mux41",
      label: "4:1 mux",
      kind: "mux",
      selBits: 2,
      dataN: 4,
      formula: "Y = Σ Si·Di (one-hot decoded select)",
    },
    mux81: {
      id: "mux81",
      label: "8:1 mux",
      kind: "mux",
      selBits: 3,
      dataN: 8,
      formula: "Y = D[S] with 3-bit select",
    },
    mux161: {
      id: "mux161",
      label: "16:1 mux",
      kind: "mux",
      selBits: 4,
      dataN: 16,
      formula: "Y = D[S] with 4-bit select",
    },
    dec24: {
      id: "dec24",
      label: "2→4 decoder",
      kind: "decoder",
      addrBits: 2,
      outN: 4,
      formula: "Yi = 1 iff addr = i (one-hot)",
    },
    dec38: {
      id: "dec38",
      label: "3→8 decoder",
      kind: "decoder",
      addrBits: 3,
      outN: 8,
      formula: "Yi = 1 iff addr = i",
    },
    dec416: {
      id: "dec416",
      label: "4→16 decoder",
      kind: "decoder",
      addrBits: 4,
      outN: 16,
      formula: "Yi = 1 iff addr = i (16 one-hot lines)",
    },
    enc42: {
      id: "enc42",
      label: "4→2 priority encoder",
      kind: "encoder",
      inN: 4,
      outBits: 2,
      formula: "Highest index among 1s wins; V = any input 1",
    },
    enc83: {
      id: "enc83",
      label: "8→3 priority encoder",
      kind: "encoder",
      inN: 8,
      outBits: 3,
      formula: "Highest index among I7…I0 wins; V = any input 1",
    },
  };

  function bitsToInt(bits) {
    return bits.reduce((acc, b) => (acc << 1) | (b ? 1 : 0), 0);
  }

  function intToBits(n, w) {
    const out = [];
    for (let i = w - 1; i >= 0; i--) out.push((n >> i) & 1);
    return out;
  }

  function evalCircuit(modeId, inputs) {
    const mode = MODES[modeId];
    if (mode.kind === "mux") {
      const sel = bitsToInt(inputs.sel);
      const y = inputs.data[sel] ? 1 : 0;
      return { y, sel, activeData: sel, outs: [y] };
    }
    if (mode.kind === "decoder") {
      const addr = bitsToInt(inputs.addr);
      const outs = Array(mode.outN)
        .fill(0)
        .map((_, i) => (i === addr ? 1 : 0));
      return { addr, outs, y: outs };
    }
    // priority encoder: I3 highest priority … I0
    const ins = inputs.ins;
    let y = 0;
    let v = 0;
    for (let i = mode.inN - 1; i >= 0; i--) {
      if (ins[i]) {
        y = i;
        v = 1;
        break;
      }
    }
    return { y, v, yBits: intToBits(y, mode.outBits), activeIn: v ? y : -1, outs: intToBits(y, mode.outBits) };
  }

  function defaultInputs(modeId) {
    const mode = MODES[modeId];
    if (mode.kind === "mux") {
      return {
        sel: Array(mode.selBits).fill(0),
        data: Array(mode.dataN)
          .fill(0)
          .map((_, i) => (i === 0 ? 1 : 0)),
      };
    }
    if (mode.kind === "decoder") {
      return { addr: Array(mode.addrBits).fill(0) };
    }
    return {
      ins: Array(mode.inN)
        .fill(0)
        .map((_, i) => (i === 0 ? 1 : 0)),
    };
  }

  function cloneInputs(inp) {
    return JSON.parse(JSON.stringify(inp));
  }

  /** Challenges: set | predict | quiz */
  const CHALLENGES = [
    {
      id: "mux21-pick0",
      title: "2:1 pick D0",
      mode: "mux21",
      type: "set",
      prompt: "Set S=0 with D0=1, D1=0 so Y=1 (select D0).",
      hint: "Toggle S off; D0 on; D1 off.",
      check: (inp, out) => bitsToInt(inp.sel) === 0 && inp.data[0] === 1 && inp.data[1] === 0 && out.y === 1,
    },
    {
      id: "mux21-pick1",
      title: "2:1 pick D1",
      mode: "mux21",
      type: "set",
      prompt: "Set S=1 with D0=0, D1=1 so Y=1 (select D1).",
      hint: "S on; only D1 high.",
      check: (inp, out) => bitsToInt(inp.sel) === 1 && inp.data[1] === 1 && out.y === 1,
    },
    {
      id: "mux21-y0",
      title: "2:1 force Y=0",
      mode: "mux21",
      type: "set",
      prompt: "Make Y=0 while S=1 (so D1 must be 0).",
      hint: "S=1 and D1=0.",
      check: (inp, out) => bitsToInt(inp.sel) === 1 && inp.data[1] === 0 && out.y === 0,
    },
    {
      id: "mux21-quiz",
      title: "Quiz: 2:1 formula",
      mode: "mux21",
      type: "quiz",
      prompt: "For a 2:1 mux, Y equals…",
      hint: "AND-OR with S and S'.",
      choices: ["S'·D0 + S·D1", "S·D0 + S'·D1", "D0 ⊕ D1", "S AND D0 AND D1"],
      answer: "S'·D0 + S·D1",
    },
    {
      id: "mux41-d2",
      title: "4:1 select D2",
      mode: "mux41",
      type: "set",
      prompt: "Select D2 (S=10 binary) with only D2=1; Y should be 1.",
      hint: "S1=1, S0=0 → index 2.",
      check: (inp, out) => bitsToInt(inp.sel) === 2 && inp.data[2] === 1 && out.y === 1,
    },
    {
      id: "mux41-d3",
      title: "4:1 select D3",
      mode: "mux41",
      type: "set",
      prompt: "Select D3 (S=11) with D3=1; Y=1.",
      hint: "Both select bits on.",
      check: (inp, out) => bitsToInt(inp.sel) === 3 && inp.data[3] === 1 && out.y === 1,
    },
    {
      id: "mux41-quiet",
      title: "4:1 Y=0",
      mode: "mux41",
      type: "set",
      prompt: "With S pointing at D1, make Y=0.",
      hint: "S=01, D1=0.",
      check: (inp, out) => bitsToInt(inp.sel) === 1 && inp.data[1] === 0 && out.y === 0,
    },
    {
      id: "mux41-quiz",
      title: "Quiz: 4:1 width",
      mode: "mux41",
      type: "quiz",
      prompt: "A 4:1 mux needs how many select bits?",
      hint: "2ⁿ data lines → n selects.",
      choices: ["1", "2", "3", "4"],
      answer: "2",
    },
    {
      id: "dec24-y0",
      title: "2→4: Y0",
      mode: "dec24",
      type: "set",
      prompt: "Set addr=00 so only Y0 is high.",
      hint: "Both address bits off.",
      check: (inp, out) => bitsToInt(inp.addr) === 0 && out.outs[0] === 1 && out.outs.filter((x) => x).length === 1,
    },
    {
      id: "dec24-y3",
      title: "2→4: Y3",
      mode: "dec24",
      type: "set",
      prompt: "Set addr=11 so only Y3 is high.",
      hint: "Both address bits on.",
      check: (inp, out) => bitsToInt(inp.addr) === 3 && out.outs[3] === 1,
    },
    {
      id: "dec24-y2",
      title: "2→4: Y2",
      mode: "dec24",
      type: "set",
      prompt: "Light only Y2 (addr=10).",
      hint: "A1=1, A0=0.",
      check: (inp, out) => bitsToInt(inp.addr) === 2 && out.outs[2] === 1,
    },
    {
      id: "dec24-quiz",
      title: "Quiz: one-hot",
      mode: "dec24",
      type: "quiz",
      prompt: "A binary decoder’s outputs are typically…",
      hint: "Exactly one line high.",
      choices: ["one-hot", "all high", "thermometer", "random"],
      answer: "one-hot",
    },
    {
      id: "dec38-y5",
      title: "3→8: Y5",
      mode: "dec38",
      type: "set",
      prompt: "Set addr=101 so only Y5 is high.",
      hint: "5 = 101₂.",
      check: (inp, out) => bitsToInt(inp.addr) === 5 && out.outs[5] === 1,
    },
    {
      id: "dec38-y7",
      title: "3→8: Y7",
      mode: "dec38",
      type: "set",
      prompt: "Set addr=111 so only Y7 is high.",
      hint: "All address bits on.",
      check: (inp, out) => bitsToInt(inp.addr) === 7 && out.outs[7] === 1,
    },
    {
      id: "dec38-y1",
      title: "3→8: Y1",
      mode: "dec38",
      type: "set",
      prompt: "Light only Y1 (addr=001).",
      hint: "Only LSB on.",
      check: (inp, out) => bitsToInt(inp.addr) === 1 && out.outs[1] === 1,
    },
    {
      id: "dec38-quiz",
      title: "Quiz: 3→8 lines",
      mode: "dec38",
      type: "quiz",
      prompt: "A 3→8 decoder has how many output lines?",
      hint: "2³.",
      choices: ["3", "6", "8", "16"],
      answer: "8",
    },
    {
      id: "enc-i0",
      title: "Encode I0",
      mode: "enc42",
      type: "set",
      prompt: "Only I0=1. Expect Y=00 and V=1.",
      hint: "Clear I1–I3; set I0.",
      check: (inp, out) => inp.ins[0] === 1 && inp.ins.slice(1).every((x) => !x) && out.y === 0 && out.v === 1,
    },
    {
      id: "enc-i3",
      title: "Encode I3",
      mode: "enc42",
      type: "set",
      prompt: "Only I3=1. Expect Y=11 (3) and V=1.",
      hint: "Highest index alone.",
      check: (inp, out) => inp.ins[3] === 1 && inp.ins.slice(0, 3).every((x) => !x) && out.y === 3 && out.v === 1,
    },
    {
      id: "enc-priority",
      title: "Priority wins",
      mode: "enc42",
      type: "set",
      prompt: "Set I1=1 and I3=1 (others 0). Priority → Y=3.",
      hint: "Highest index among 1s wins.",
      check: (inp, out) => inp.ins[1] === 1 && inp.ins[3] === 1 && inp.ins[0] === 0 && inp.ins[2] === 0 && out.y === 3,
    },
    {
      id: "enc-idle",
      title: "No request",
      mode: "enc42",
      type: "set",
      prompt: "All inputs 0 → V must be 0.",
      hint: "Clear every I.",
      check: (inp, out) => inp.ins.every((x) => !x) && out.v === 0,
    },
    {
      id: "enc-quiz",
      title: "Quiz: priority",
      mode: "enc42",
      type: "quiz",
      prompt: "If I1 and I2 are both 1, a high-index-first priority encoder outputs…",
      hint: "I2 > I1.",
      choices: ["1", "2", "3", "0"],
      answer: "2",
    },
    {
      id: "mux-vs-dec",
      title: "Quiz: mux vs decoder",
      mode: "mux21",
      type: "quiz",
      prompt: "A mux selects among data inputs; a decoder…",
      hint: "Address → one-hot.",
      choices: [
        "activates one of many outputs from an address",
        "always outputs XOR of selects",
        "stores a bit in a latch",
        "needs no select/address",
      ],
      answer: "activates one of many outputs from an address",
    },
    {
      id: "mux81-d5",
      title: "8:1 pick D5",
      mode: "mux81",
      type: "set",
      prompt: "Select D5 (S=101) with only D5=1; Y=1.",
      hint: "S2=1, S1=0, S0=1.",
      check: (inp, out) => bitsToInt(inp.sel) === 5 && inp.data[5] === 1 && out.y === 1,
    },
    {
      id: "mux161-d12",
      title: "16:1 pick D12",
      mode: "mux161",
      type: "set",
      prompt: "Select D12 (S=1100) with D12=1; Y=1.",
      hint: "12 = 1100₂.",
      check: (inp, out) => bitsToInt(inp.sel) === 12 && inp.data[12] === 1 && out.y === 1,
    },
    {
      id: "dec416-y10",
      title: "4→16: Y10",
      mode: "dec416",
      type: "set",
      prompt: "Set addr=1010 so only Y10 is high.",
      hint: "10 = 1010₂.",
      check: (inp, out) => bitsToInt(inp.addr) === 10 && out.outs[10] === 1,
    },
    {
      id: "dec416-quiz",
      title: "Quiz: 4→16 lines",
      mode: "dec416",
      type: "quiz",
      prompt: "A 4→16 decoder has how many outputs?",
      hint: "2⁴.",
      choices: ["4", "8", "16", "32"],
      answer: "16",
    },
    {
      id: "enc83-i7",
      title: "8→3 encode I7",
      mode: "enc83",
      type: "set",
      prompt: "Only I7=1 → Y=111 (7), V=1.",
      hint: "Clear I0–I6; set I7.",
      check: (inp, out) =>
        inp.ins[7] === 1 && inp.ins.slice(0, 7).every((x) => !x) && out.y === 7 && out.v === 1,
    },
    {
      id: "enc83-priority",
      title: "8→3 priority",
      mode: "enc83",
      type: "set",
      prompt: "I2=1 and I6=1 (others 0) → Y=6.",
      hint: "Highest index wins.",
      check: (inp, out) =>
        inp.ins[2] === 1 &&
        inp.ins[6] === 1 &&
        inp.ins.every((v, i) => (i === 2 || i === 6 ? v === 1 : v === 0)) &&
        out.y === 6,
    },
  ];

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const state = {
    modeId: "mux21",
    inputs: defaultInputs("mux21"),
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.modeId = "mux21";
    state.inputs = { sel: [0], data: [1, 0] };
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ modeId: state.modeId, inputs: state.inputs })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!MODES[data.modeId]) return false;
      state.modeId = data.modeId;
      state.inputs = data.inputs || defaultInputs(data.modeId);
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("md-root");
  root.innerHTML = `
    <p class="starter-note" id="starter-note"></p>
    <div class="challenge">
      <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div id="chal-quiz" class="quiz-choices" hidden></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <button type="button" class="btn btn-ghost" id="chal-load">Load challenge mode</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>Explorer</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="md-controls">
          <div class="md-field">
            <label for="mode-sel">Block</label>
            <select id="mode-sel">
              ${Object.values(MODES)
                .map((m) => `<option value="${m.id}">${m.label}</option>`)
                .join("")}
            </select>
          </div>
        </div>
        <div id="bit-controls" class="bit-row"></div>
        <div class="block-stage">
          <div class="block-card" id="viz"></div>
          <div>
            <pre class="formula" id="formula"></pre>
            <p class="md-meta" id="meta"></p>
          </div>
        </div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function ensureInputs() {
    const mode = MODES[state.modeId];
    const def = defaultInputs(state.modeId);
    if (mode.kind === "mux") {
      if (!state.inputs.sel || state.inputs.sel.length !== mode.selBits) state.inputs.sel = def.sel;
      if (!state.inputs.data || state.inputs.data.length !== mode.dataN) state.inputs.data = def.data;
    } else if (mode.kind === "decoder") {
      if (!state.inputs.addr || state.inputs.addr.length !== mode.addrBits) state.inputs.addr = def.addr;
    } else if (!state.inputs.ins || state.inputs.ins.length !== mode.inN) {
      state.inputs.ins = def.ins;
    }
  }

  function renderBits() {
    ensureInputs();
    const mode = MODES[state.modeId];
    const box = document.getElementById("bit-controls");
    box.innerHTML = "";

    function addToggle(label, get, set) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bit-btn" + (get() ? " on" : "");
      b.textContent = `${label}=${get() ? 1 : 0}`;
      b.addEventListener("click", () => {
        set(get() ? 0 : 1);
        saveSession();
        renderCircuit();
      });
      box.appendChild(b);
    }

    if (mode.kind === "mux") {
      mode.selBits === 1
        ? addToggle("S", () => state.inputs.sel[0], (v) => (state.inputs.sel[0] = v))
        : state.inputs.sel.forEach((_, i) =>
            addToggle(`S${mode.selBits - 1 - i}`, () => state.inputs.sel[i], (v) => (state.inputs.sel[i] = v))
          );
      state.inputs.data.forEach((_, i) =>
        addToggle(`D${i}`, () => state.inputs.data[i], (v) => (state.inputs.data[i] = v))
      );
    } else if (mode.kind === "decoder") {
      state.inputs.addr.forEach((_, i) =>
        addToggle(`A${mode.addrBits - 1 - i}`, () => state.inputs.addr[i], (v) => (state.inputs.addr[i] = v))
      );
    } else {
      state.inputs.ins.forEach((_, i) =>
        addToggle(`I${i}`, () => state.inputs.ins[i], (v) => (state.inputs.ins[i] = v))
      );
    }
  }

  function renderViz(out) {
    const mode = MODES[state.modeId];
    const viz = document.getElementById("viz");
    const useChip = (n) => n > 4;

    if (mode.kind === "mux") {
      const sel = out.sel;
      const selLabel =
        mode.selBits === 1
          ? `S=${state.inputs.sel[0]}`
          : `S=${state.inputs.sel.join("")}₂ (${sel})`;
      let dataHtml;
      if (useChip(mode.dataN)) {
        dataHtml = `<div class="chip-grid">${state.inputs.data
          .map(
            (d, i) =>
              `<div class="chip${i === sel ? " active" : ""}">D${i}<strong>${d}</strong></div>`
          )
          .join("")}</div>`;
      } else {
        dataHtml = `<div class="io-col">${state.inputs.data
          .map(
            (d, i) =>
              `<div class="io-line${i === sel ? " active" : ""}"><span>D${i}</span><span class="wire"></span><span class="val">${d}</span></div>`
          )
          .join("")}</div>`;
      }
      viz.innerHTML = `
        <h3 class="block-title">${mode.label}</h3>
        <div class="mux-layout${useChip(mode.dataN) ? " mux-wide" : ""}">
          ${dataHtml}
          <div class="mux-body">
            <div>${selLabel}</div>
            <div class="y">Y=${out.y}</div>
          </div>
          <div class="io-col">
            <div class="io-line active"><span>Y</span><span class="wire"></span><span class="val">${out.y}</span></div>
          </div>
        </div>`;
      return;
    }

    if (mode.kind === "decoder") {
      const addrStr = state.inputs.addr.join("");
      const outsHtml = useChip(mode.outN)
        ? `<div class="chip-grid">${out.outs
            .map((v, i) => `<div class="chip${v ? " active" : ""}">Y${i}<strong>${v}</strong></div>`)
            .join("")}</div>`
        : `<div class="out-bus">${out.outs
            .map(
              (v, i) =>
                `<div class="io-line${v ? " active" : ""}"><span>Y${i}</span><span class="wire"></span><span class="val">${v}</span></div>`
            )
            .join("")}</div>`;
      viz.innerHTML = `
        <h3 class="block-title">${mode.label}</h3>
        <div class="dec-grid">
          <div class="io-col">
            ${state.inputs.addr
              .map(
                (v, i) =>
                  `<div class="io-line"><span>A${mode.addrBits - 1 - i}</span><span class="wire"></span><span class="val">${v}</span></div>`
              )
              .join("")}
            <p class="md-meta">addr=${addrStr}₂ (${out.addr})</p>
          </div>
          ${outsHtml}
        </div>`;
      return;
    }

    // encoder
    const insHtml = useChip(mode.inN)
      ? `<div class="chip-grid">${state.inputs.ins
          .map(
            (v, i) =>
              `<div class="chip${out.activeIn === i ? " active" : ""}">I${i}<strong>${v}</strong></div>`
          )
          .join("")}</div>`
      : `<div class="io-col">${state.inputs.ins
          .map(
            (v, i) =>
              `<div class="io-line${out.activeIn === i ? " active" : ""}"><span>I${i}</span><span class="wire"></span><span class="val">${v}</span></div>`
          )
          .join("")}</div>`;
    const yLines = out.yBits
      .map(
        (v, i) =>
          `<div class="io-line active"><span>Y${mode.outBits - 1 - i}</span><span class="wire"></span><span class="val">${v}</span></div>`
      )
      .join("");
    viz.innerHTML = `
      <h3 class="block-title">${mode.label}</h3>
      <div class="dec-grid">
        ${insHtml}
        <div class="io-col">
          ${yLines}
          <div class="io-line${out.v ? " active" : ""}"><span>V</span><span class="wire"></span><span class="val">${out.v}</span></div>
          <p class="md-meta">Y=${out.yBits.join("")}₂ (${out.y}) · valid=${out.v}</p>
        </div>
      </div>`;
  }

  function renderCircuit() {
    ensureInputs();
    const mode = MODES[state.modeId];
    const out = evalCircuit(state.modeId, state.inputs);
    document.getElementById("mode-sel").value = state.modeId;
    document.getElementById("formula").textContent = mode.formula;
    document.getElementById("starter-note").textContent =
      "Starter example: 2:1 mux with S=0, D0=1, D1=0 → Y=1 (passes D0).";
    if (mode.kind === "mux") {
      document.getElementById("meta").textContent = `Select index ${out.sel} → Y = D${out.sel} = ${out.y}`;
    } else if (mode.kind === "decoder") {
      document.getElementById("meta").textContent = `One-hot: Y${out.addr}=1`;
    } else {
      document.getElementById("meta").textContent = out.v
        ? `Priority input I${out.activeIn} → code ${out.y}`
        : "No request (V=0); Y bits are don't-care in many specs — shown as 00 here";
    }
    renderBits();
    renderViz(out);
  }

  function renderChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (state.showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = state.showHint ? "Hide hint" : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    if (ch.type === "quiz") {
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="md-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === state.challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        state.challengeIdx = i;
        state.showHint = false;
        state.quizChoice = "";
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function loadChallengeMode() {
    const ch = CHALLENGES[state.challengeIdx];
    state.modeId = ch.mode;
    state.inputs = defaultInputs(ch.mode);
    if (ch.type === "quiz") {
      /* leave defaults */
    }
    saveSession();
    renderAll();
    setChalStatus("idle", "Mode loaded");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") {
      ok = state.quizChoice === ch.answer;
    } else {
      if (state.modeId !== ch.mode) {
        setChalStatus("fail", "Load challenge mode first");
        return;
      }
      const out = evalCircuit(state.modeId, state.inputs);
      try {
        ok = !!ch.check(state.inputs, out);
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

  function renderAll() {
    renderCircuit();
    renderChallenge();
  }

  document.getElementById("mode-sel").addEventListener("change", (e) => {
    state.modeId = e.target.value;
    state.inputs = defaultInputs(state.modeId);
    saveSession();
    renderAll();
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.quizChoice = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeMode);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
