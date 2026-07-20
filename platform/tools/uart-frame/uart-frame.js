(() => {
  /**
   * UART frame animator (concept)
   *   Idle = 1
   *   Start = 0
   *   Data = LSB first (configurable width 5–9)
   *   Parity = none | even | odd
   *   Stop = 1 (1 or 2 bits)
   * Starter: 0xA5, 8N1
   */

  function popcount8(n) {
    let x = n & 0xff;
    let c = 0;
    while (x) {
      c += x & 1;
      x >>= 1;
    }
    return c;
  }

  function parityBit(data, width, mode) {
    const mask = (1 << width) - 1;
    const ones = popcount8(data & mask);
    if (mode === "even") return ones % 2 === 0 ? 0 : 1;
    if (mode === "odd") return ones % 2 === 0 ? 1 : 0;
    return null;
  }

  /** @returns {{kind:string,label:string,bit:number,idx:number}[]} */
  function buildFrame(byte, dataBits, parity, stopBits) {
    const mask = (1 << dataBits) - 1;
    const data = byte & mask;
    /** @type {{kind:string,label:string,bit:number,idx:number}[]} */
    const bits = [];
    let i = 0;
    bits.push({ kind: "idle", label: "idle", bit: 1, idx: i++ });
    bits.push({ kind: "start", label: "start", bit: 0, idx: i++ });
    for (let d = 0; d < dataBits; d++) {
      bits.push({
        kind: "data",
        label: `D${d}`,
        bit: (data >> d) & 1,
        idx: i++,
      });
    }
    if (parity !== "none") {
      const p = parityBit(data, dataBits, parity);
      bits.push({
        kind: "parity",
        label: parity === "even" ? "Pe" : "Po",
        bit: p,
        idx: i++,
      });
    }
    for (let s = 0; s < stopBits; s++) {
      bits.push({
        kind: "stop",
        label: stopBits > 1 ? `stop${s + 1}` : "stop",
        bit: 1,
        idx: i++,
      });
    }
    bits.push({ kind: "idle", label: "idle", bit: 1, idx: i++ });
    return bits;
  }

  function formatCfg(dataBits, parity, stopBits) {
    const p = parity === "none" ? "N" : parity === "even" ? "E" : "O";
    return `${dataBits}${p}${stopBits}`;
  }

  function hex(n) {
    return "0x" + (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function parseByte(raw) {
    const t = String(raw).trim().replace(/^0x/i, "");
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function sourceCode(cfgStr) {
    return `// UART TX frame (${cfgStr})
// idle=1 → start=0 → data[LSB..MSB] → [parity] → stop=1…
// Sample: one bit time = 1/baud
assign tx = frame[bit_idx];`;
  }

  function makeStarter() {
    return {
      byte: 0xa5,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
      cursor: 0,
      lastAction: "starter",
      stepped: false,
      explained: false,
      demoed: false,
      rebuilt: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uart-frame-cleared-v1";
  const STORE_KEY = "ddv-uart-frame-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let quizChoice = "";
  let state = makeStarter();

  const root = document.getElementById("uf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> byte <code>0xA5</code> as <strong>8N1</strong>
        (8 data, no parity, 1 stop). Idle-high → start 0 → LSB-first data → stop 1.</p>
      <button type="button" class="btn btn-secondary" id="uf-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions" id="chal-quiz" hidden></div>
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
      <div class="idea-grid">
        <div class="idea-card"><h3>Idle</h3><p>Line rests at logic 1 between frames.</p></div>
        <div class="idea-card"><h3>Start</h3><p>One bit time of 0 marks the frame edge.</p></div>
        <div class="idea-card"><h3>Data</h3><p>LSB first; width often 5–9 bits.</p></div>
        <div class="idea-card"><h3>Stop</h3><p>One (or two) bit time(s) of 1; optional parity before stop.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="uf-controls">
        <div class="uf-field">
          <label for="in-byte">Byte (hex)</label>
          <input id="in-byte" type="text" value="A5" maxlength="4">
        </div>
        <div class="uf-field">
          <label for="sel-width">Data bits</label>
          <select id="sel-width">
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8" selected>8</option>
            <option value="9">9</option>
          </select>
        </div>
        <div class="uf-field">
          <label for="sel-parity">Parity</label>
          <select id="sel-parity">
            <option value="none" selected>None</option>
            <option value="even">Even</option>
            <option value="odd">Odd</option>
          </select>
        </div>
        <div class="uf-field">
          <label for="sel-stop">Stop bits</label>
          <select id="sel-stop">
            <option value="1" selected>1</option>
            <option value="2">2</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Rebuild frame</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step bit</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo 0xA5 8N1</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset cursor</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="wave" id="wave"></div>
      <div class="panel" style="margin:0.75rem 0;padding:0.65rem;border:1px solid var(--line);border-radius:8px">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Bit order</h3>
        <ol class="bit-list" id="bit-list"></ol>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Sketch</h3>
        <pre class="code-box" id="code-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Trace</h3>
        <pre class="trace-box" id="trace-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Log</h3>
        <pre class="log-box" id="log-box"></pre>
      </div>
    </div>
  `;

  const inByte = /** @type {HTMLInputElement} */ (document.getElementById("in-byte"));
  const selWidth = /** @type {HTMLSelectElement} */ (document.getElementById("sel-width"));
  const selParity = /** @type {HTMLSelectElement} */ (document.getElementById("sel-parity"));
  const selStop = /** @type {HTMLSelectElement} */ (document.getElementById("sel-stop"));

  function frame() {
    return buildFrame(state.byte, state.dataBits, state.parity, state.stopBits);
  }

  function cfg() {
    return formatCfg(state.dataBits, state.parity, state.stopBits);
  }

  function syncInputsFromState() {
    inByte.value = state.byte.toString(16).toUpperCase().padStart(2, "0");
    selWidth.value = String(state.dataBits);
    selParity.value = state.parity;
    selStop.value = String(state.stopBits);
  }

  function readInputsToState() {
    state.byte = parseByte(inByte.value);
    state.dataBits = Number(selWidth.value) || 8;
    state.parity = selParity.value;
    state.stopBits = Number(selStop.value) || 1;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputsFromState();
    pushLog("# starter 0xA5 8N1");
    pushTrace("idle→start→D0..D7→stop→idle");
    renderAll();
  }

  function rebuild() {
    readInputsToState();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "rebuild";
    const f = frame();
    pushLog(`# rebuild ${hex(state.byte)} ${cfg()} (${f.length} slots)`);
    pushTrace(`frame: ${f.map((b) => `${b.label}=${b.bit}`).join(" ")}`);
    renderAll();
  }

  function stepBit() {
    const f = frame();
    if (state.cursor < f.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const b = f[state.cursor];
    pushTrace(`bit[${state.cursor}] ${b.label}=${b.bit} (${b.kind})`);
    pushLog(`# step → ${b.label}`);
    renderAll();
  }

  function playToEnd() {
    const f = frame();
    state.cursor = f.length - 1;
    state.stepped = true;
    state.lastAction = "run";
    pushLog("# play to end");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    const f = frame();
    const data = f.filter((b) => b.kind === "data").map((b) => b.bit).join("");
    pushTrace(
      `UART ${cfg()}: idle=1, start=0, data LSB-first [${data}],` +
        (state.parity !== "none" ? ` parity=${state.parity},` : "") +
        ` stop=${state.stopBits}×1. Baud sets bit time; async — no shared clock wire.`
    );
    pushLog("# explain");
    renderAll();
  }

  function demo() {
    state = makeStarter();
    syncInputsFromState();
    const f = frame();
    state.cursor = f.length - 1;
    state.demoed = true;
    state.stepped = true;
    state.lastAction = "demo";
    pushLog("# demo 0xA5 8N1 complete");
    pushTrace(f.map((b) => `${b.label}=${b.bit}`).join(" "));
    renderAll();
  }

  function renderWaveSvg(bits, cursor) {
    const n = bits.length;
    const w = Math.max(320, n * 28);
    const h = 64;
    const y1 = 14;
    const y0 = 50;
    let d = "";
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * w;
      const x1 = ((i + 1) / n) * w;
      const y = bits[i].bit ? y1 : y0;
      if (i === 0) d += `M ${x0} ${y}`;
      else {
        const prev = bits[i - 1].bit ? y1 : y0;
        if (prev !== y) d += ` L ${x0} ${prev} L ${x0} ${y}`;
      }
      d += ` L ${x1} ${y}`;
    }
    const cx = ((cursor + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="${cx}" y1="4" x2="${cx}" y2="${h - 4}" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  }

  function renderLab() {
    syncInputsFromState();
    const bits = frame();
    const cur = bits[Math.min(state.cursor, bits.length - 1)];
    const atEnd = state.cursor >= bits.length - 1;

    const v = document.getElementById("verdict");
    v.className = atEnd ? "verdict yes" : "verdict idle";
    v.textContent = atEnd
      ? `Frame complete · ${hex(state.byte)} ${cfg()} · ${bits.length} bit-slots`
      : `cursor ${state.cursor}/${bits.length - 1} · ${cur.label}=${cur.bit} (${cur.kind})`;

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${cfg()}</span>
      <span class="flag">${hex(state.byte)}</span>
      <span class="flag ${cur.kind === "start" ? "is-on" : ""}">start=0</span>
      <span class="flag">LSB-first</span>
      <span class="flag ${state.parity !== "none" ? "is-on" : ""}">parity=${state.parity}</span>
      <span class="flag">stop×${state.stopBits}</span>
    `;

    let head = "<tr><th></th>";
    bits.forEach((_, i) => {
      head += `<th>${i}</th>`;
    });
    head += "</tr>";

    let rowKind = `<tr><td class="lab">kind</td>`;
    let rowLab = `<tr><td class="lab">name</td>`;
    let rowBit = `<tr><td class="lab">TX</td>`;
    bits.forEach((b, i) => {
      const curCls = i === state.cursor ? " cur" : "";
      rowKind += `<td class="kind-${b.kind}${curCls}">${b.kind[0]}</td>`;
      rowLab += `<td class="kind-${b.kind}${curCls}">${b.label}</td>`;
      rowBit += `<td class="kind-${b.kind}${curCls}">${b.bit}</td>`;
    });
    rowKind += "</tr>";
    rowLab += "</tr>";
    rowBit += "</tr>";

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>${rowKind}${rowLab}${rowBit}</tbody></table>
      ${renderWaveSvg(bits, state.cursor)}
    `;

    document.getElementById("bit-list").innerHTML = bits
      .map(
        (b, i) =>
          `<li class="${i === state.cursor ? "is-cur" : ""}">[${i}] ${b.label} = ${b.bit} <span style="color:var(--muted)">(${b.kind})</span></li>`
      )
      .join("");

    document.getElementById("code-box").textContent = sourceCode(cfg());
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          byte: state.byte,
          dataBits: state.dataBits,
          parity: state.parity,
          stopBits: state.stopBits,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-idle",
      title: "Quiz: idle",
      type: "quiz",
      prompt: "Between UART frames the TX line typically sits at…",
      hint: "Mark space vs idle.",
      choices: ["logic 1 (idle / mark)", "logic 0 always", "high-Z", "toggling every baud"],
      answer: "logic 1 (idle / mark)",
    },
    {
      id: "quiz-start",
      title: "Quiz: start",
      type: "quiz",
      prompt: "The UART start bit is…",
      hint: "Falling edge from idle.",
      choices: [
        "one bit-time of 0 that begins the frame",
        "always equal to the MSB of data",
        "optional when using parity",
        "two bit-times of 1",
      ],
      answer: "one bit-time of 0 that begins the frame",
    },
    {
      id: "quiz-lsb",
      title: "Quiz: bit order",
      type: "quiz",
      prompt: "Classic UART data order on the wire is…",
      hint: "Least significant first.",
      choices: ["LSB first", "MSB first always", "random per baud", "nibble-swapped only"],
      answer: "LSB first",
    },
    {
      id: "quiz-8n1",
      title: "Quiz: 8N1",
      type: "quiz",
      prompt: "“8N1” means…",
      hint: "data / parity / stop.",
      choices: [
        "8 data bits, no parity, 1 stop bit",
        "8 stop bits, no data, 1 parity",
        "8N baud, 1 wire",
        "8 start bits, NACK, 1 idle",
      ],
      answer: "8 data bits, no parity, 1 stop bit",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 0xA5 8N1.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" && state.byte === 0xa5 && cfg() === "8N1",
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step bit at least once.",
      hint: "Step bit",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cursor >= 1,
    },
    {
      id: "see-start",
      title: "Land on start",
      prompt: "Move the cursor onto the start bit (value 0).",
      hint: "Step until kind=start",
      setup: () => loadStarter(),
      check: () => {
        const b = frame()[state.cursor];
        return !!(b && b.kind === "start" && b.bit === 0);
      },
    },
    {
      id: "see-d0",
      title: "Data D0",
      prompt: "For 0xA5, land on D0 — should be 1 (LSB of A5).",
      hint: "A5 = 1010_0101 → D0=1",
      setup: () => loadStarter(),
      check: () => {
        const b = frame()[state.cursor];
        return !!(b && b.label === "D0" && b.bit === 1);
      },
    },
    {
      id: "see-stop",
      title: "Stop bit",
      prompt: "Land on the stop bit (value 1).",
      hint: "Step to stop",
      setup: () => loadStarter(),
      check: () => {
        const b = frame()[state.cursor];
        return !!(b && b.kind === "stop" && b.bit === 1);
      },
    },
    {
      id: "play-end",
      title: "Play to end",
      prompt: "Play to end on the starter frame.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () => state.lastAction === "run" && state.cursor === frame().length - 1,
    },
    {
      id: "set-55",
      title: "Byte 0x55",
      prompt: "Set byte to 55 and Rebuild frame.",
      hint: "Hex field + Rebuild",
      setup: () => loadStarter(),
      check: () => state.byte === 0x55 && state.rebuilt && state.lastAction === "rebuild",
    },
    {
      id: "set-even",
      title: "Even parity",
      prompt: "Select Even parity and Rebuild (keep 8 data).",
      hint: "Parity → Even, Rebuild",
      setup: () => loadStarter(),
      check: () => state.parity === "even" && state.dataBits === 8 && state.rebuilt,
    },
    {
      id: "parity-a5-even",
      title: "Parity of A5 even",
      prompt: "0xA5 + even parity: Rebuild, land on Pe — four 1s already even → Pe=0.",
      hint: "A5=10100101; even parity bit is 0",
      setup: () => {
        loadStarter();
        state.parity = "even";
        syncInputsFromState();
        rebuild();
      },
      check: () => {
        const b = frame()[state.cursor];
        return !!(
          state.byte === 0xa5 &&
          state.parity === "even" &&
          b &&
          b.kind === "parity" &&
          b.bit === 0
        );
      },
    },
    {
      id: "set-odd",
      title: "Odd parity",
      prompt: "Select Odd parity and Rebuild.",
      hint: "Parity → Odd",
      setup: () => loadStarter(),
      check: () => state.parity === "odd" && state.rebuilt,
    },
    {
      id: "two-stop",
      title: "Two stop bits",
      prompt: "Set stop bits = 2 and Rebuild (8N2).",
      hint: "Stop bits → 2",
      setup: () => loadStarter(),
      check: () => state.stopBits === 2 && cfg() === "8N2" && state.rebuilt,
    },
    {
      id: "width-7",
      title: "7 data bits",
      prompt: "Set data bits = 7 and Rebuild.",
      hint: "Data bits → 7",
      setup: () => loadStarter(),
      check: () => state.dataBits === 7 && state.rebuilt,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo 0xA5 8N1.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.byte === 0xa5 && cfg() === "8N1",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Click Explain.",
      hint: "Explain",
      setup: () => loadStarter(),
      check: () => state.explained === true,
    },
    {
      id: "frame-len-8n1",
      title: "8N1 length",
      prompt: "Starter 8N1 has 12 slots (idle+start+8data+stop+idle). Play to end.",
      hint: "idle,start,8×data,stop,idle",
      setup: () => loadStarter(),
      check: () => cfg() === "8N1" && frame().length === 12 && state.cursor === 11,
    },
    {
      id: "reset-cursor",
      title: "Reset cursor",
      prompt: "After stepping, Reset cursor to 0.",
      hint: "Reset cursor",
      setup: () => {
        loadStarter();
        stepBit();
        stepBit();
      },
      check: () => state.cursor === 0 && state.lastAction === "reset",
    },
    {
      id: "d7-a5",
      title: "MSB on wire",
      prompt: "For 0xA5 8N1, land on D7 — bit 1 (MSB of A5).",
      hint: "A5 → D7=1",
      setup: () => loadStarter(),
      check: () => {
        const b = frame()[state.cursor];
        return !!(b && b.label === "D7" && b.bit === 1);
      },
    },
    {
      id: "sketch-cfg",
      title: "Sketch config",
      prompt: "Rebuild any frame; sketch header must show current cfg (e.g. 8N1).",
      hint: "Look at Sketch panel",
      setup: () => loadStarter(),
      check: () => sourceCode(cfg()).includes(`(${cfg()})`),
    },
  ];

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

    const quiz = document.getElementById("chal-quiz");
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "quiz") {
      ansRow.innerHTML = "";
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="uf-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
      ansRow.innerHTML = "";
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
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("uf-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-rebuild").addEventListener("click", rebuild);
  document.getElementById("btn-step").addEventListener("click", stepBit);
  document.getElementById("btn-run").addEventListener("click", playToEnd);
  document.getElementById("btn-demo").addEventListener("click", demo);
  document.getElementById("btn-explain").addEventListener("click", explain);
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.cursor = 0;
    state.lastAction = "reset";
    pushLog("# reset cursor");
    renderAll();
  });

  selWidth.addEventListener("change", () => {
    readInputsToState();
    state.cursor = 0;
    state.lastAction = "cfg";
    renderAll();
  });
  selParity.addEventListener("change", () => {
    readInputsToState();
    state.cursor = 0;
    state.lastAction = "cfg";
    renderAll();
  });
  selStop.addEventListener("change", () => {
    readInputsToState();
    state.cursor = 0;
    state.lastAction = "cfg";
    renderAll();
  });
  inByte.addEventListener("change", () => {
    readInputsToState();
    state.cursor = 0;
    state.lastAction = "cfg";
    renderAll();
  });

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    quizChoice = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else ok = !!ch.check();
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
  });

  loadStarter();
})();
