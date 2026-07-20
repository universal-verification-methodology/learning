(() => {
  /**
   * SPI transaction stepper (concept)
   *   Mode 0 (CPOL=0, CPHA=0): idle SCLK=0; sample on rising; change on falling
   *   CS active-low; MSB first; full duplex
   * Starter: master TX 0xA5, slave TX 0x5A
   */

  function hex(n) {
    return "0x" + (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function parseByte(raw) {
    const t = String(raw).trim().replace(/^0x/i, "");
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function bitOf(byte, idx) {
    // idx 7 = MSB
    return (byte >> idx) & 1;
  }

  /**
   * Build Mode-0 timeline.
   * @returns {{label:string,cs:number,sclk:number,mosi:number,miso:number,event:string,bit?:number,masterRx?:number,slaveRx?:number}[]}
   */
  function buildTimeline(masterTx, slaveTx) {
    const steps = [];
    let masterShift = masterTx & 0xff;
    let slaveShift = slaveTx & 0xff;
    let masterRx = 0;
    let slaveRx = 0;

    steps.push({
      label: "idle",
      cs: 1,
      sclk: 0,
      mosi: 0,
      miso: 0,
      event: "idle",
      masterRx: 0,
      slaveRx: 0,
      masterShift,
      slaveShift,
    });

    // Assert CS; present MSB (bit 7) while SCLK low
    steps.push({
      label: "CS↓",
      cs: 0,
      sclk: 0,
      mosi: bitOf(masterShift, 7),
      miso: bitOf(slaveShift, 7),
      event: "cs_assert",
      bit: 7,
      masterRx,
      slaveRx,
      masterShift,
      slaveShift,
    });

    for (let bit = 7; bit >= 0; bit--) {
      const mosi = bitOf(masterShift, 7);
      const miso = bitOf(slaveShift, 7);

      // Rising edge: sample
      masterRx = ((masterRx << 1) | miso) & 0xff;
      slaveRx = ((slaveRx << 1) | mosi) & 0xff;
      steps.push({
        label: `↑b${bit}`,
        cs: 0,
        sclk: 1,
        mosi,
        miso,
        event: "sample",
        bit,
        masterRx,
        slaveRx,
        masterShift,
        slaveShift,
      });

      // Falling edge: shift left (next bit to MSB), except conceptual hold after last
      masterShift = ((masterShift << 1) | 0) & 0xff;
      slaveShift = ((slaveShift << 1) | 0) & 0xff;
      const nextMosi = bit > 0 ? bitOf(masterShift, 7) : mosi;
      const nextMiso = bit > 0 ? bitOf(slaveShift, 7) : miso;
      steps.push({
        label: bit > 0 ? `↓b${bit}` : "↓done",
        cs: 0,
        sclk: 0,
        mosi: nextMosi,
        miso: nextMiso,
        event: bit > 0 ? "change" : "last_fall",
        bit,
        masterRx,
        slaveRx,
        masterShift,
        slaveShift,
      });
    }

    steps.push({
      label: "CS↑",
      cs: 1,
      sclk: 0,
      mosi: 0,
      miso: 0,
      event: "cs_deassert",
      masterRx,
      slaveRx,
      masterShift,
      slaveShift,
      done: true,
    });

    return steps;
  }

  function sourceCode() {
    return `// SPI Mode 0 (CPOL=0, CPHA=0)
// CS active-low; SCLK idle=0
// sample on rising edge; change on falling
// MSB first; MOSI & MISO full duplex
always_ff @(posedge sclk or negedge cs_n) ...`;
  }

  function makeStarter() {
    return {
      masterTx: 0xa5,
      slaveTx: 0x5a,
      mode: 0,
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

  const CLEARED_KEY = "ddv-spi-step-cleared-v1";
  const STORE_KEY = "ddv-spi-step-session-v1";

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

  const root = document.getElementById("sp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Mode 0 byte exchange —
        master drives <code>0xA5</code> on MOSI, slave drives <code>0x5A</code> on MISO.
        CS goes low, eight rising-edge samples, CS high.</p>
      <button type="button" class="btn btn-secondary" id="sp-starter">Load starter example</button>
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
        <div class="idea-card"><h3>CS</h3><p>Chip-select (active-low) frames the transfer.</p></div>
        <div class="idea-card"><h3>SCLK</h3><p>Master clock; Mode 0 idles low and samples on rise.</p></div>
        <div class="idea-card"><h3>MOSI</h3><p>Master-out / slave-in data (MSB first here).</p></div>
        <div class="idea-card"><h3>MISO</h3><p>Master-in / slave-out — full duplex with MOSI.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="sp-controls">
        <div class="sp-field">
          <label for="in-mtx">Master TX</label>
          <input id="in-mtx" type="text" value="A5" maxlength="4">
        </div>
        <div class="sp-field">
          <label for="in-stx">Slave TX</label>
          <input id="in-stx" type="text" value="5A" maxlength="4">
        </div>
        <div class="sp-field">
          <label for="sel-mode">Mode</label>
          <select id="sel-mode">
            <option value="0" selected>0 (CPOL0 CPHA0)</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Rebuild</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo A5↔5A</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="regs" id="regs"></div>
      <div class="wave" id="wave"></div>
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

  const inMtx = /** @type {HTMLInputElement} */ (document.getElementById("in-mtx"));
  const inStx = /** @type {HTMLInputElement} */ (document.getElementById("in-stx"));

  function timeline() {
    return buildTimeline(state.masterTx, state.slaveTx);
  }

  function syncInputs() {
    inMtx.value = state.masterTx.toString(16).toUpperCase().padStart(2, "0");
    inStx.value = state.slaveTx.toString(16).toUpperCase().padStart(2, "0");
  }

  function readInputs() {
    state.masterTx = parseByte(inMtx.value);
    state.slaveTx = parseByte(inStx.value);
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
    pushLog("# starter Mode0 A5↔5A");
    pushTrace("idle → CS↓ → 8× sample/change → CS↑");
    renderAll();
  }

  function rebuild() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "rebuild";
    const tl = timeline();
    pushLog(`# rebuild master=${hex(state.masterTx)} slave=${hex(state.slaveTx)}`);
    pushTrace(`timeline ${tl.length} steps`);
    renderAll();
  }

  function stepOnce() {
    const tl = timeline();
    if (state.cursor < tl.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = tl[state.cursor];
    pushTrace(
      `[${state.cursor}] ${s.label} CS=${s.cs} SCLK=${s.sclk} MOSI=${s.mosi} MISO=${s.miso}` +
        (s.event === "sample" ? ` sample → mRx=${hex(s.masterRx)} sRx=${hex(s.slaveRx)}` : "")
    );
    pushLog(`# step → ${s.label}`);
    renderAll();
  }

  function playToEnd() {
    const tl = timeline();
    state.cursor = tl.length - 1;
    state.stepped = true;
    state.lastAction = "run";
    const s = tl[state.cursor];
    pushLog(`# done mRx=${hex(s.masterRx)} sRx=${hex(s.slaveRx)}`);
    pushTrace(`complete: master got ${hex(s.masterRx)}, slave got ${hex(s.slaveRx)}`);
    renderAll();
  }

  function demo() {
    state = makeStarter();
    syncInputs();
    playToEnd();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo complete");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "SPI Mode 0: CS low frames the byte. SCLK idles 0. " +
        "Each rising edge samples MOSI into the slave and MISO into the master (full duplex). " +
        "Falling edges shift the next MSB onto the wires. MSB first."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderMultiSvg(tl, cursor) {
    const n = tl.length;
    const w = Math.max(400, n * 20);
    const rowH = 22;
    const signals = [
      { key: "cs", y: 14 },
      { key: "sclk", y: 14 + rowH },
      { key: "mosi", y: 14 + 2 * rowH },
      { key: "miso", y: 14 + 3 * rowH },
    ];
    const h = 14 + 4 * rowH;
    const paths = signals
      .map(({ key, y }) => {
        const y1 = y - 6;
        const y0 = y + 6;
        let d = "";
        for (let i = 0; i < n; i++) {
          const x0 = (i / n) * w;
          const x1 = ((i + 1) / n) * w;
          const val = tl[i][key];
          const yy = val ? y1 : y0;
          if (i === 0) d += `M ${x0} ${yy}`;
          else {
            const prev = tl[i - 1][key] ? y1 : y0;
            if (prev !== yy) d += ` L ${x0} ${prev} L ${x0} ${yy}`;
          }
          d += ` L ${x1} ${yy}`;
        }
        return `<text x="2" y="${y + 3}" font-size="9" fill="currentColor">${key.toUpperCase()}</text>
          <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" transform="translate(36,0)"/>`;
      })
      .join("");
    const cx = 36 + ((cursor + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w + 40} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${paths}
      <line x1="${cx}" y1="2" x2="${cx}" y2="${h - 2}" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  }

  function renderLab() {
    syncInputs();
    const tl = timeline();
    const cur = tl[Math.min(state.cursor, tl.length - 1)];
    const done = !!cur.done || state.cursor >= tl.length - 1;

    const v = document.getElementById("verdict");
    if (done) {
      v.className = "verdict yes";
      v.textContent = `Done · master RX ${hex(cur.masterRx)} · slave RX ${hex(cur.slaveRx)}`;
    } else {
      v.className = "verdict idle";
      v.textContent = `step ${state.cursor}/${tl.length - 1} · ${cur.label} · ${cur.event}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">Mode 0</span>
      <span class="flag ${cur.cs === 0 ? "is-on" : ""}">CS=${cur.cs ? 1 : 0}</span>
      <span class="flag">SCLK=${cur.sclk}</span>
      <span class="flag">MSB-first</span>
      <span class="flag ${cur.event === "sample" ? "is-ok" : ""}">event=${cur.event}</span>
    `;

    document.getElementById("regs").innerHTML = `
      <span class="reg">master TX ${hex(state.masterTx)}</span>
      <span class="reg">slave TX ${hex(state.slaveTx)}</span>
      <span class="reg">master RX ${hex(cur.masterRx)}</span>
      <span class="reg">slave RX ${hex(cur.slaveRx)}</span>
    `;

    let head = "<tr><th></th>";
    tl.forEach((_, i) => {
      head += `<th>${i}</th>`;
    });
    head += "</tr>";

    const row = (lab, key, clsFn) => {
      let cells = `<td class="lab">${lab}</td>`;
      tl.forEach((s, i) => {
        const extra = clsFn ? clsFn(s, i) : "";
        const curCls = i === state.cursor ? " cur" : "";
        const hi = s[key] ? " hi" : "";
        cells += `<td class="${extra}${curCls}${hi}">${s[key]}</td>`;
      });
      return `<tr>${cells}</tr>`;
    };

    const eventRow = (() => {
      let cells = `<td class="lab">evt</td>`;
      tl.forEach((s, i) => {
        const curCls = i === state.cursor ? " cur" : "";
        const mark =
          s.event === "sample" ? "sample" : s.event === "change" ? "change" : "";
        cells += `<td class="${mark}${curCls}">${s.label}</td>`;
      });
      return `<tr>${cells}</tr>`;
    })();

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>
        ${row("CS", "cs")}
        ${row("SCLK", "sclk", (s) => (s.event === "sample" ? "sample" : ""))}
        ${row("MOSI", "mosi")}
        ${row("MISO", "miso")}
        ${eventRow}
      </tbody></table>
      ${renderMultiSvg(tl, state.cursor)}
    `;

    document.getElementById("code-box").textContent = sourceCode();
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
          masterTx: state.masterTx,
          slaveTx: state.slaveTx,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-cs",
      title: "Quiz: CS",
      type: "quiz",
      prompt: "During an active SPI frame, CS (active-low) is typically…",
      hint: "Select the slave.",
      choices: ["driven low", "always high", "toggling with SCLK only", "open-drain only"],
      answer: "driven low",
    },
    {
      id: "quiz-mode0",
      title: "Quiz: Mode 0",
      type: "quiz",
      prompt: "SPI Mode 0 (CPOL=0, CPHA=0) samples data on…",
      hint: "Leading edge with idle-low clock.",
      choices: [
        "the rising edge of SCLK",
        "the falling edge only",
        "CS rising only",
        "baud tick mid-bit like UART",
      ],
      answer: "the rising edge of SCLK",
    },
    {
      id: "quiz-duplex",
      title: "Quiz: duplex",
      type: "quiz",
      prompt: "SPI is full duplex because…",
      hint: "Two data wires.",
      choices: [
        "MOSI and MISO shift on the same clocks",
        "only MOSI exists",
        "CS carries data",
        "there is no clock",
      ],
      answer: "MOSI and MISO shift on the same clocks",
    },
    {
      id: "quiz-msb",
      title: "Quiz: bit order",
      type: "quiz",
      prompt: "This lab shifts bits…",
      hint: "Most significant first.",
      choices: ["MSB first", "LSB first only", "nibble-swapped", "random"],
      answer: "MSB first",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — Mode 0, A5↔5A.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.masterTx === 0xa5 &&
        state.slaveTx === 0x5a,
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step at least once.",
      hint: "Step",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cursor >= 1,
    },
    {
      id: "see-cs",
      title: "See CS low",
      prompt: "Land on a step where CS=0.",
      hint: "Step past idle",
      setup: () => loadStarter(),
      check: () => timeline()[state.cursor].cs === 0,
    },
    {
      id: "see-sample",
      title: "See sample",
      prompt: "Land on a rising-edge sample event (evt ↑b*).",
      hint: "Step until event=sample",
      setup: () => loadStarter(),
      check: () => timeline()[state.cursor].event === "sample",
    },
    {
      id: "first-sample",
      title: "First sample bit7",
      prompt: "Land on ↑b7 — first sample of MSB.",
      hint: "Early in the transfer",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.event === "sample" && s.bit === 7;
      },
    },
    {
      id: "play-end",
      title: "Play to end",
      prompt: "Play to end on starter — master RX must be 0x5A.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return (
          state.lastAction === "run" &&
          s.done &&
          s.masterRx === 0x5a &&
          s.slaveRx === 0xa5
        );
      },
    },
    {
      id: "swap-bytes",
      title: "Swap bytes",
      prompt: "Set master TX=5A, slave TX=A5, Rebuild, Play to end — master RX=A5.",
      hint: "Edit hex fields + Rebuild + Play",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return (
          state.masterTx === 0x5a &&
          state.slaveTx === 0xa5 &&
          state.rebuilt &&
          s.done &&
          s.masterRx === 0xa5
        );
      },
    },
    {
      id: "ff-00",
      title: "FF / 00",
      prompt: "Master TX=FF, slave TX=00, Rebuild, Play — master RX=00, slave RX=FF.",
      hint: "Rebuild then Play",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return (
          state.masterTx === 0xff &&
          state.slaveTx === 0x00 &&
          s.done &&
          s.masterRx === 0x00 &&
          s.slaveRx === 0xff
        );
      },
    },
    {
      id: "mosi-msb",
      title: "MOSI on CS↓",
      prompt: "On starter, land on CS↓ — MOSI should be 1 (MSB of A5).",
      hint: "A5 = 1010_0101 → MSB=1",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.event === "cs_assert" && s.mosi === 1;
      },
    },
    {
      id: "miso-msb",
      title: "MISO on CS↓",
      prompt: "On starter CS↓ — MISO should be 0 (MSB of 5A).",
      hint: "5A = 0101_1010 → MSB=0",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.event === "cs_assert" && s.miso === 0;
      },
    },
    {
      id: "cs-end",
      title: "CS release",
      prompt: "Play to end — final step has CS=1.",
      hint: "CS↑",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.event === "cs_deassert" && s.cs === 1;
      },
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo A5↔5A.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && timeline()[state.cursor].masterRx === 0x5a,
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
      id: "sample-count",
      title: "Eight samples",
      prompt: "Starter timeline has exactly 8 sample events.",
      hint: "Count ↑b* labels after Rebuild",
      setup: () => loadStarter(),
      check: () => timeline().filter((s) => s.event === "sample").length === 8,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "After stepping, Reset cursor to 0.",
      hint: "Reset",
      setup: () => {
        loadStarter();
        stepOnce();
      },
      check: () => state.cursor === 0 && state.lastAction === "reset",
    },
    {
      id: "idle-sclk",
      title: "Idle SCLK",
      prompt: "On starter idle step, SCLK=0 and CS=1.",
      hint: "Stay at step 0 or Reset",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return state.cursor === 0 && s.cs === 1 && s.sclk === 0;
      },
    },
    {
      id: "sketch-mode0",
      title: "Sketch Mode 0",
      prompt: "Sketch mentions Mode 0 and sample on rising.",
      hint: "Read Sketch panel",
      setup: () => loadStarter(),
      check: () =>
        /Mode 0/.test(sourceCode()) && /rising/.test(sourceCode()),
    },
    {
      id: "partial-rx",
      title: "After first sample",
      prompt: "Land on ↑b7 — master RX should be 0x00 or 0x01 from first MISO bit.",
      hint: "First MISO MSB of 5A is 0 → masterRx=0",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.event === "sample" && s.bit === 7 && s.masterRx === 0x00;
      },
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="sp-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("sp-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-rebuild").addEventListener("click", rebuild);
  document.getElementById("btn-step").addEventListener("click", stepOnce);
  document.getElementById("btn-run").addEventListener("click", playToEnd);
  document.getElementById("btn-demo").addEventListener("click", demo);
  document.getElementById("btn-explain").addEventListener("click", explain);
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.cursor = 0;
    state.lastAction = "reset";
    pushLog("# reset");
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
