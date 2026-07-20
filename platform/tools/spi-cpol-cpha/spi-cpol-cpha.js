(() => {
  /**
   * SPI CPOL/CPHA modes (concept)
   *   mode = (CPOL<<1)|CPHA
   *   idle SCLK = CPOL
   *   CPHA=0: sample on leading edge, change on trailing
   *   CPHA=1: change on leading edge, sample on trailing
   *   leading = first edge away from idle; trailing = return
   * Starter: Mode 0, TX nibble demo with MOSI pattern from 0xA5
   */

  function hex(n) {
    return "0x" + (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function parseByte(raw) {
    const t = String(raw).trim().replace(/^0x/i, "");
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function modeParts(mode) {
    const m = mode & 3;
    const cpol = (m >> 1) & 1;
    const cpha = m & 1;
    const idle = cpol;
    const sampleRising = cpha === cpol; // modes 0 & 3
    return {
      mode: m,
      cpol,
      cpha,
      idle,
      sampleRising,
      sampleEdge: sampleRising ? "rising" : "falling",
      changeEdge: sampleRising ? "falling" : "rising",
      leading: idle === 0 ? "rising" : "falling",
      trailing: idle === 0 ? "falling" : "rising",
    };
  }

  function bitOf(byte, idx) {
    return (byte >> idx) & 1;
  }

  /**
   * Compact 4-bit transfer for readable waves (MSB first of high nibble or full byte bits 7..4).
   */
  function buildTimeline(mode, txByte, bitCount) {
    const info = modeParts(mode);
    const steps = [];
    let shift = txByte & 0xff;
    let rx = 0;
    const startBit = 7;
    const endBit = 7 - (bitCount - 1);

    steps.push({
      label: "idle",
      cs: 1,
      sclk: info.idle,
      mosi: 0,
      event: "idle",
      edge: "—",
      rx,
      note: `idle SCLK=${info.idle}`,
    });

    // Present first bit while still at idle level (setup before first edge for CPHA=0)
    steps.push({
      label: "CS↓",
      cs: 0,
      sclk: info.idle,
      mosi: bitOf(shift, startBit),
      event: "cs_assert",
      edge: "—",
      bit: startBit,
      rx,
      note: "assert CS; data setup",
    });

    for (let bit = startBit; bit >= endBit; bit--) {
      const mosiBit = bitOf(shift, startBit);

      // Leading edge: leave idle
      const leadLevel = info.idle ^ 1;
      const leadIsSample = info.cpha === 0;
      if (leadIsSample) {
        rx = ((rx << 1) | mosiBit) & 0xff;
      }
      steps.push({
        label: `${leadIsSample ? "S" : "C"}${info.leading === "rising" ? "↑" : "↓"}b${bit}`,
        cs: 0,
        sclk: leadLevel,
        mosi: mosiBit,
        event: leadIsSample ? "sample" : "change",
        edge: info.leading,
        bit,
        rx,
        note: leadIsSample
          ? `leading ${info.leading}: SAMPLE`
          : `leading ${info.leading}: CHANGE`,
      });

      // Trailing edge: return to idle
      const trailIsSample = info.cpha === 1;
      if (trailIsSample) {
        rx = ((rx << 1) | mosiBit) & 0xff;
      }
      // After the sample/change pair for this bit, shift for the next bit
      shift = ((shift << 1) | 0) & 0xff;
      const nextMosi = bit > endBit ? bitOf(shift, startBit) : mosiBit;
      steps.push({
        label: `${trailIsSample ? "S" : "C"}${info.trailing === "rising" ? "↑" : "↓"}b${bit}`,
        cs: 0,
        sclk: info.idle,
        mosi: trailIsSample ? mosiBit : nextMosi,
        event: trailIsSample ? "sample" : "change",
        edge: info.trailing,
        bit,
        rx,
        note: trailIsSample
          ? `trailing ${info.trailing}: SAMPLE`
          : `trailing ${info.trailing}: CHANGE`,
      });
    }

    steps.push({
      label: "CS↑",
      cs: 1,
      sclk: info.idle,
      mosi: 0,
      event: "cs_deassert",
      edge: "—",
      rx,
      note: "deassert CS",
      done: true,
    });

    return { steps, info };
  }

  function sourceCode(info) {
    return `// SPI Mode ${info.mode} (CPOL=${info.cpol}, CPHA=${info.cpha})
// idle SCLK = ${info.idle}
// sample on ${info.sampleEdge}; change on ${info.changeEdge}
// leading edge (${info.leading}): ${info.cpha === 0 ? "SAMPLE" : "CHANGE"}
// trailing edge (${info.trailing}): ${info.cpha === 0 ? "CHANGE" : "SAMPLE"}
// mode = (CPOL<<1) | CPHA`;
  }

  function makeStarter() {
    return {
      mode: 0,
      tx: 0xa5,
      bits: 4,
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

  const CLEARED_KEY = "ddv-spi-cpol-cpha-cleared-v1";
  const STORE_KEY = "ddv-spi-cpol-cpha-session-v1";

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

  const root = document.getElementById("scc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>Mode 0</strong> (CPOL=0, CPHA=0) —
        idle SCLK low; <em>sample on rising</em>, <em>change on falling</em>.
        Switch modes 1–3 and watch which edge is SAMPLE vs CHANGE.</p>
      <button type="button" class="btn btn-secondary" id="scc-starter">Load starter example</button>
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
        <div class="idea-card"><h3>CPOL</h3><p>Idle SCLK level (0 low, 1 high).</p></div>
        <div class="idea-card"><h3>CPHA</h3><p>0 = sample leading; 1 = sample trailing.</p></div>
        <div class="idea-card"><h3>Mode</h3><p>(CPOL≪1) | CPHA → modes 0–3.</p></div>
        <div class="idea-card"><h3>Edges</h3><p>Leading leaves idle; trailing returns.</p></div>
      </div>
      <div class="matrix" id="mode-matrix"></div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="scc-controls">
        <div class="scc-field">
          <label for="sel-mode">Mode</label>
          <select id="sel-mode">
            <option value="0" selected>0 — CPOL0 CPHA0</option>
            <option value="1">1 — CPOL0 CPHA1</option>
            <option value="2">2 — CPOL1 CPHA0</option>
            <option value="3">3 — CPOL1 CPHA1</option>
          </select>
        </div>
        <div class="scc-field">
          <label for="in-tx">MOSI byte</label>
          <input id="in-tx" type="text" value="A5" maxlength="2">
        </div>
        <div class="scc-field">
          <label for="sel-bits">Bits shown</label>
          <select id="sel-bits">
            <option value="4" selected>4 (MSB)</option>
            <option value="8">8</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Rebuild</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo Mode 0</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="wave" id="wave"></div>
      <div class="panel" style="margin:0.75rem 0;padding:0.65rem;border:1px solid var(--line);border-radius:8px">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Sequence</h3>
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

  const selMode = /** @type {HTMLSelectElement} */ (document.getElementById("sel-mode"));
  const inTx = /** @type {HTMLInputElement} */ (document.getElementById("in-tx"));
  const selBits = /** @type {HTMLSelectElement} */ (document.getElementById("sel-bits"));

  function packed() {
    return buildTimeline(state.mode, state.tx, state.bits);
  }

  function frame() {
    return packed().steps;
  }

  function info() {
    return packed().info;
  }

  function syncInputs() {
    selMode.value = String(state.mode);
    inTx.value = state.tx.toString(16).toUpperCase().padStart(2, "0");
    selBits.value = String(state.bits);
  }

  function readInputs() {
    state.mode = Number(selMode.value) & 3;
    state.tx = parseByte(inTx.value);
    state.bits = selBits.value === "8" ? 8 : 4;
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
    syncInputs();
    const i = info();
    pushLog("# starter Mode 0 · sample rising · change falling");
    pushTrace(`CPOL=${i.cpol} CPHA=${i.cpha} idle=${i.idle}`);
    renderAll();
  }

  function rebuild() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "rebuild";
    const i = info();
    pushLog(`# rebuild mode=${i.mode} CPOL=${i.cpol} CPHA=${i.cpha}`);
    pushTrace(`sample=${i.sampleEdge} change=${i.changeEdge}`);
    renderAll();
  }

  function stepOnce() {
    const f = frame();
    if (state.cursor < f.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = f[state.cursor];
    pushTrace(`[${state.cursor}] ${s.label} SCLK=${s.sclk} ${s.event} ${s.note}`);
    pushLog(`# step → ${s.label}`);
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

  function demo() {
    state = makeStarter();
    syncInputs();
    playToEnd();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo Mode 0 complete");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "CPOL sets idle SCLK. CPHA picks sample edge: 0 = leading (first leave idle), 1 = trailing (return). " +
        "Mode = (CPOL<<1)|CPHA. Modes 0 and 3 sample on rising; 1 and 2 sample on falling."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderMatrix(curMode) {
    const rows = [0, 1, 2, 3].map((m) => {
      const i = modeParts(m);
      return `<tr class="${m === curMode ? "is-cur" : ""}">
        <td>${m}</td><td>${i.cpol}</td><td>${i.cpha}</td><td>${i.idle}</td>
        <td>${i.sampleEdge}</td><td>${i.changeEdge}</td></tr>`;
    });
    document.getElementById("mode-matrix").innerHTML = `
      <table>
        <thead><tr><th>Mode</th><th>CPOL</th><th>CPHA</th><th>Idle</th><th>Sample</th><th>Change</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>`;
  }

  function renderWaveSvg(steps, cursor) {
    const n = steps.length;
    const w = Math.max(400, n * 20);
    const h = 118;
    const paths = [
      { key: "cs", y: 18 },
      { key: "sclk", y: 50 },
      { key: "mosi", y: 82 },
    ]
      .map(({ key, y }) => {
        const y1 = y - 8;
        const y0 = y + 8;
        let d = "";
        for (let i = 0; i < n; i++) {
          const x0 = (i / n) * w;
          const x1 = ((i + 1) / n) * w;
          const val = steps[i][key];
          const yy = val ? y1 : y0;
          if (i === 0) d += `M ${x0} ${yy}`;
          else {
            const prev = steps[i - 1][key] ? y1 : y0;
            if (prev !== yy) d += ` L ${x0} ${prev} L ${x0} ${yy}`;
          }
          d += ` L ${x1} ${yy}`;
        }
        return `<text x="2" y="${y + 4}" font-size="10" fill="currentColor">${key.toUpperCase()}</text>
          <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" transform="translate(44,0)"/>`;
      })
      .join("");
    const cx = 44 + ((cursor + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w + 48} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${paths}
      <line x1="${cx}" y1="4" x2="${cx}" y2="${h - 4}" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  }

  function renderLab() {
    syncInputs();
    const { steps, info: i } = packed();
    const cur = steps[Math.min(state.cursor, steps.length - 1)];
    const done = !!cur.done;

    renderMatrix(i.mode);

    const v = document.getElementById("verdict");
    if (!done) {
      v.className = "verdict idle";
      v.textContent = `step ${state.cursor}/${steps.length - 1} · ${cur.label} · ${cur.note}`;
    } else {
      v.className = "verdict yes";
      v.textContent = `Done · Mode ${i.mode} · sample ${i.sampleEdge} · change ${i.changeEdge}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">mode=${i.mode}</span>
      <span class="flag">CPOL=${i.cpol}</span>
      <span class="flag">CPHA=${i.cpha}</span>
      <span class="flag">idle=${i.idle}</span>
      <span class="flag is-on">sample=${i.sampleEdge}</span>
      <span class="flag">change=${i.changeEdge}</span>
      <span class="flag ${cur.event === "sample" ? "is-ok" : cur.event === "change" ? "is-on" : ""}">${cur.event}</span>
    `;

    let head = "<tr><th></th>";
    steps.forEach((_, idx) => {
      head += `<th>${idx}</th>`;
    });
    head += "</tr>";

    const rowBits = (lab, key) => {
      let cells = `<td class="lab">${lab}</td>`;
      steps.forEach((s, idx) => {
        const curCls = idx === state.cursor ? " cur" : "";
        const hi = s[key] ? " hi" : "";
        const ev =
          key === "sclk" && s.event === "sample"
            ? " ev-sample"
            : key === "sclk" && s.event === "change"
              ? " ev-change"
              : "";
        cells += `<td class="${curCls}${hi}${ev}">${s[key]}</td>`;
      });
      return `<tr>${cells}</tr>`;
    };

    let rowEv = `<tr><td class="lab">event</td>`;
    steps.forEach((s, idx) => {
      const curCls = idx === state.cursor ? " cur" : "";
      const ev =
        s.event === "sample" ? " ev-sample" : s.event === "change" ? " ev-change" : "";
      rowEv += `<td class="${curCls}${ev}">${s.label}</td>`;
    });
    rowEv += "</tr>";

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>
        ${rowBits("CS", "cs")}
        ${rowBits("SCLK", "sclk")}
        ${rowBits("MOSI", "mosi")}
        ${rowEv}
      </tbody></table>
      ${renderWaveSvg(steps, state.cursor)}
    `;

    document.getElementById("bit-list").innerHTML = steps
      .map(
        (s, idx) =>
          `<li class="${idx === state.cursor ? "is-cur" : ""}">[${idx}] ${s.label} SCLK=${s.sclk} <span style="color:var(--muted)">${s.note}</span></li>`
      )
      .join("");

    document.getElementById("code-box").textContent = sourceCode(i);
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ mode: state.mode, tx: state.tx, cursor: state.cursor })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-cpol",
      title: "Quiz: CPOL",
      type: "quiz",
      prompt: "CPOL primarily sets…",
      hint: "Idle level.",
      choices: [
        "the idle level of SCLK",
        "which chip-select polarity",
        "UART baud only",
        "MOSI bit order only",
      ],
      answer: "the idle level of SCLK",
    },
    {
      id: "quiz-cpha",
      title: "Quiz: CPHA",
      type: "quiz",
      prompt: "CPHA=0 means sample on the…",
      hint: "Leading vs trailing.",
      choices: [
        "leading edge (first edge leaving idle)",
        "trailing edge only",
        "CS rising edge",
        "ninth clock always",
      ],
      answer: "leading edge (first edge leaving idle)",
    },
    {
      id: "quiz-mode",
      title: "Quiz: Mode number",
      type: "quiz",
      prompt: "SPI mode number equals…",
      hint: "Packing.",
      choices: [
        "(CPOL≪1) | CPHA",
        "CPOL + CPHA + 1",
        "always 0",
        "baud ÷ 4",
      ],
      answer: "(CPOL≪1) | CPHA",
    },
    {
      id: "quiz-m0",
      title: "Quiz: Mode 0",
      type: "quiz",
      prompt: "Mode 0 samples on which SCLK edge?",
      hint: "Idle low.",
      choices: [
        "rising",
        "falling",
        "both edges",
        "neither — level only",
      ],
      answer: "rising",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — Mode 0.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () => state.lastAction === "starter" && state.mode === 0,
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step once.",
      hint: "Step",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cursor >= 1,
    },
    {
      id: "see-sample",
      title: "Land on sample",
      prompt: "Mode 0: land on a SAMPLE event (rising).",
      hint: "Step to first S↑",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.event === "sample" && s.edge === "rising";
      },
    },
    {
      id: "see-change",
      title: "Land on change",
      prompt: "Mode 0: land on a CHANGE event (falling).",
      hint: "Step to C↓",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.event === "change" && s.edge === "falling";
      },
    },
    {
      id: "idle0",
      title: "Idle low",
      prompt: "Mode 0 idle/CS↑ steps show SCLK=0.",
      hint: "Play to end; check idle",
      setup: () => loadStarter(),
      check: () => {
        const f = frame();
        return (
          state.mode === 0 &&
          f[0].sclk === 0 &&
          f[f.length - 1].sclk === 0 &&
          f[state.cursor].done
        );
      },
    },
    {
      id: "mode1",
      title: "Mode 1",
      prompt: "Set Mode 1, Rebuild — sample=falling, change=rising.",
      hint: "Mode → 1",
      setup: () => loadStarter(),
      check: () => {
        const i = info();
        return (
          state.mode === 1 &&
          state.rebuilt &&
          i.sampleEdge === "falling" &&
          i.changeEdge === "rising"
        );
      },
    },
    {
      id: "mode1-sample",
      title: "Mode 1 sample",
      prompt: "Mode 1: land on SAMPLE on falling edge.",
      hint: "Mode 1, step to sample",
      setup: () => {
        loadStarter();
        state.mode = 1;
        syncInputs();
        rebuild();
      },
      check: () => {
        const s = frame()[state.cursor];
        return state.mode === 1 && s.event === "sample" && s.edge === "falling";
      },
    },
    {
      id: "mode2",
      title: "Mode 2 idle",
      prompt: "Mode 2 Rebuild — idle SCLK=1 (CPOL=1).",
      hint: "Mode → 2",
      setup: () => loadStarter(),
      check: () => state.mode === 2 && state.rebuilt && info().idle === 1,
    },
    {
      id: "mode2-sample",
      title: "Mode 2 sample",
      prompt: "Mode 2: sample edge is falling.",
      hint: "Check flags after Rebuild",
      setup: () => {
        loadStarter();
        state.mode = 2;
        syncInputs();
        rebuild();
      },
      check: () => state.mode === 2 && info().sampleEdge === "falling",
    },
    {
      id: "mode3",
      title: "Mode 3",
      prompt: "Mode 3 Rebuild — sample rising, idle=1.",
      hint: "Mode → 3",
      setup: () => loadStarter(),
      check: () => {
        const i = info();
        return (
          state.mode === 3 &&
          state.rebuilt &&
          i.idle === 1 &&
          i.sampleEdge === "rising"
        );
      },
    },
    {
      id: "play-m0",
      title: "Play Mode 0",
      prompt: "Play to end on Mode 0 starter.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "run" && state.mode === 0 && frame()[state.cursor].done,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo Mode 0.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.mode === 0,
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
      id: "bits8",
      title: "8 bits",
      prompt: "Set Bits shown to 8, Rebuild — more sample events.",
      hint: "Bits → 8",
      setup: () => loadStarter(),
      check: () =>
        state.bits === 8 &&
        state.rebuilt &&
        frame().filter((s) => s.event === "sample").length === 8,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "After stepping, Reset to cursor 0.",
      hint: "Reset",
      setup: () => {
        loadStarter();
        stepOnce();
      },
      check: () => state.cursor === 0 && state.lastAction === "reset",
    },
    {
      id: "sketch-m0",
      title: "Sketch Mode 0",
      prompt: "Sketch mentions Mode 0 and sample on rising.",
      hint: "Read Sketch on Mode 0",
      setup: () => loadStarter(),
      check: () => /Mode 0/i.test(sourceCode(info())) && /rising/i.test(sourceCode(info())),
    },
    {
      id: "cpha-flip",
      title: "CPHA flip",
      prompt: "From Mode 0 → Mode 1: sample edge flips rising→falling.",
      hint: "Mode 1 Rebuild",
      setup: () => loadStarter(),
      check: () =>
        state.mode === 1 &&
        state.rebuilt &&
        info().sampleEdge === "falling" &&
        modeParts(0).sampleEdge === "rising",
    },
    {
      id: "back-m0",
      title: "Back to Mode 0",
      prompt: "From Mode 3, switch to Mode 0 and Rebuild.",
      hint: "Mode → 0",
      setup: () => {
        loadStarter();
        state.mode = 3;
        syncInputs();
        rebuild();
      },
      check: () => state.mode === 0 && state.rebuilt && info().cpol === 0 && info().cpha === 0,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="scc-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
      b.textContent = clearedIds.includes(c.id) ? `✓ ${i + 1}` : String(i + 1);
      b.style.opacity = i === challengeIdx ? "1" : "0.7";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        else renderAll();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("scc-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-rebuild").addEventListener("click", () => rebuild());
  document.getElementById("btn-step").addEventListener("click", () => stepOnce());
  document.getElementById("btn-run").addEventListener("click", () => playToEnd());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.cursor = 0;
    state.lastAction = "reset";
    pushLog("# reset cursor");
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
    else renderAll();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else if (typeof ch.check === "function") ok = !!ch.check();
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds.push(ch.id);
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("ok", "Cleared");
    } else setChalStatus("bad", "Not yet");
    renderChallenge();
  });

  loadStarter();
})();
