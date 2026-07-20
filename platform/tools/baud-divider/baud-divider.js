(() => {
  /**
   * Baud / clock divider (concept)
   *   cnt = 0..DIV-1 each sysclk
   *   baud_tick: 1-cycle pulse when cnt == DIV-1 (then wrap)
   *   clk_div:   toggle out when cnt == DIV-1 → period = 2*DIV sysclks
   *   Formula: DIV ≈ f_sys / baud   (or f_sys / (baud * OS) for sample clock)
   * Starter: DIV=4, pulse mode, 16 cycles
   */

  function clampDiv(n) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v) || v < 2) return 2;
    if (v > 64) return 64;
    return v;
  }

  function computeDiv(fsysHz, baud, os) {
    const b = Math.max(1, baud);
    const o = Math.max(1, os);
    return Math.max(1, Math.round(fsysHz / (b * o)));
  }

  /**
   * Simulate n cycles. Returns steps[{cycle,cnt,tick,clk,note}]
   */
  function buildTrace(div, mode, nCycles) {
    const steps = [];
    let cnt = 0;
    let clk = 0;
    for (let c = 0; c < nCycles; c++) {
      const atMax = cnt === div - 1;
      const tick = mode === "pulse" && atMax ? 1 : 0;
      let nextClk = clk;
      if (mode === "toggle" && atMax) nextClk = clk ^ 1;
      steps.push({
        cycle: c,
        cnt,
        tick: mode === "pulse" ? tick : 0,
        clk: mode === "toggle" ? clk : 0,
        out: mode === "pulse" ? tick : clk,
        kind: atMax ? "wrap" : "count",
        note: atMax
          ? mode === "pulse"
            ? "baud_tick=1 · wrap"
            : "toggle clk_div · wrap"
          : `cnt=${cnt}`,
      });
      if (atMax) {
        cnt = 0;
        clk = nextClk;
      } else {
        cnt += 1;
      }
    }
    return steps;
  }

  function tickCount(steps) {
    return steps.filter((s) => s.tick === 1).length;
  }

  function sourceCode(div, mode) {
    if (mode === "pulse") {
      return `// UART baud_tick (concept)
// DIV = round(f_sys / baud)   // or f_sys/(baud*OS)
// counter 0 .. DIV-1; pulse when cnt==DIV-1
reg [${Math.max(0, Math.ceil(Math.log2(div)) - 1)}:0] cnt;
always @(posedge clk) begin
  if (cnt == ${div - 1}) begin
    cnt <= 0;
    baud_tick <= 1'b1;
  end else begin
    cnt <= cnt + 1;
    baud_tick <= 1'b0;
  end
end`;
    }
    return `// SPI-style clk_div (concept)
// toggle out every DIV sysclks → f_out ≈ f_sys/(2*DIV)
reg [${Math.max(0, Math.ceil(Math.log2(div)) - 1)}:0] cnt;
reg clk_div;
always @(posedge clk) begin
  if (cnt == ${div - 1}) begin
    cnt <= 0;
    clk_div <= ~clk_div;
  end else cnt <= cnt + 1;
end`;
  }

  function makeStarter() {
    return {
      div: 4,
      mode: "pulse", // pulse | toggle
      cycles: 16,
      fsysMhz: 50,
      baud: 115200,
      os: 1,
      cursor: 0,
      lastAction: "starter",
      stepped: false,
      explained: false,
      demoed: false,
      rebuilt: false,
      applied: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-baud-divider-cleared-v1";
  const STORE_KEY = "ddv-baud-divider-session-v1";

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

  const root = document.getElementById("bd-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>DIV=4</code>, <strong>baud_tick</strong> pulse mode,
        16 sysclk cycles. Tick when <code>cnt==3</code>, then wrap to 0. Compare with toggle
        mode (SPI-style). Use the calculator for real <code>f_sys / baud</code> values.</p>
      <button type="button" class="btn btn-secondary" id="bd-starter">Load starter example</button>
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
        <div class="idea-card"><h3>DIV</h3><p>≈ f_sys / baud (integer divide).</p></div>
        <div class="idea-card"><h3>baud_tick</h3><p>1-cycle enable every DIV clocks.</p></div>
        <div class="idea-card"><h3>clk_div</h3><p>Toggle every DIV → period 2·DIV.</p></div>
        <div class="idea-card"><h3>OS</h3><p>Sample clock: DIV ≈ f_sys/(baud·OS).</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="bd-controls">
        <div class="bd-field">
          <label for="sel-mode">Mode</label>
          <select id="sel-mode">
            <option value="pulse" selected>baud_tick pulse</option>
            <option value="toggle">clk_div toggle</option>
          </select>
        </div>
        <div class="bd-field">
          <label for="sel-div">DIV</label>
          <select id="sel-div">
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4" selected>4</option>
            <option value="5">5</option>
            <option value="8">8</option>
            <option value="16">16</option>
          </select>
        </div>
        <div class="bd-field">
          <label for="sel-cycles">Cycles shown</label>
          <select id="sel-cycles">
            <option value="12">12</option>
            <option value="16" selected>16</option>
            <option value="24">24</option>
            <option value="32">32</option>
          </select>
        </div>
        <div class="bd-field">
          <label for="in-fsys">f_sys (MHz)</label>
          <input id="in-fsys" type="text" value="50" maxlength="6">
        </div>
        <div class="bd-field">
          <label for="in-baud">Baud</label>
          <input id="in-baud" type="text" value="115200" maxlength="8">
        </div>
        <div class="bd-field">
          <label for="sel-os">OS</label>
          <select id="sel-os">
            <option value="1" selected>1× (bit)</option>
            <option value="8">8×</option>
            <option value="16">16×</option>
          </select>
        </div>
        <button type="button" class="btn btn-ghost" id="btn-calc">Calc DIV</button>
        <button type="button" class="btn btn-ghost" id="btn-apply">Apply DIV</button>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Rebuild</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo DIV=4</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div class="calc-box" id="calc-box"></div>
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
  const selDiv = /** @type {HTMLSelectElement} */ (document.getElementById("sel-div"));
  const selCycles = /** @type {HTMLSelectElement} */ (document.getElementById("sel-cycles"));
  const inFsys = /** @type {HTMLInputElement} */ (document.getElementById("in-fsys"));
  const inBaud = /** @type {HTMLInputElement} */ (document.getElementById("in-baud"));
  const selOs = /** @type {HTMLSelectElement} */ (document.getElementById("sel-os"));

  function frame() {
    return buildTrace(state.div, state.mode, state.cycles);
  }

  function calcDivNow() {
    const fsys = Math.max(0.001, parseFloat(String(state.fsysMhz)) || 50) * 1e6;
    const baud = Math.max(1, parseInt(String(state.baud), 10) || 115200);
    const os = Math.max(1, Number(state.os) || 1);
    return computeDiv(fsys, baud, os);
  }

  function syncInputs() {
    selMode.value = state.mode;
    const dv = String(state.div);
    if (![...selDiv.options].some((o) => o.value === dv)) {
      const opt = document.createElement("option");
      opt.value = dv;
      opt.textContent = dv + " (calc)";
      selDiv.appendChild(opt);
    }
    selDiv.value = dv;
    selCycles.value = String(state.cycles);
    inFsys.value = String(state.fsysMhz);
    inBaud.value = String(state.baud);
    selOs.value = String(state.os);
  }

  function readInputs() {
    state.mode = selMode.value === "toggle" ? "toggle" : "pulse";
    state.div = clampDiv(selDiv.value);
    state.cycles = Math.min(64, Math.max(8, parseInt(selCycles.value, 10) || 16));
    state.fsysMhz = parseFloat(inFsys.value) || 50;
    state.baud = parseInt(inBaud.value, 10) || 115200;
    state.os = Number(selOs.value) || 1;
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
    pushLog("# starter DIV=4 pulse · 16 cycles");
    pushTrace("ticks every 4 clocks when cnt==DIV-1");
    renderAll();
  }

  function rebuild() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "rebuild";
    pushLog(`# rebuild mode=${state.mode} DIV=${state.div} N=${state.cycles}`);
    pushTrace(`ticks_in_window=${tickCount(frame())}`);
    renderAll();
  }

  function doCalc() {
    readInputs();
    const d = calcDivNow();
    state.lastAction = "calc";
    pushLog(`# calc DIV=${d} from ${state.fsysMhz}MHz / (${state.baud}*${state.os})`);
    pushTrace(`formula DIV=round(f_sys/(baud*OS)) → ${d}`);
    renderAll();
    return d;
  }

  function applyDiv() {
    readInputs();
    const d = calcDivNow();
    const sim = clampDiv(Math.min(d, 64));
    state.div = sim;
    state.applied = true;
    state.lastAction = "apply";
    state.cursor = 0;
    state.rebuilt = true;
    pushLog(`# apply DIV=${d}${d > 64 ? ` (sim clamp ${sim})` : ""}`);
    syncInputs();
    renderAll();
  }

  function stepOnce() {
    const f = frame();
    if (state.cursor < f.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = f[state.cursor];
    pushTrace(`[${s.cycle}] cnt=${s.cnt} out=${s.out} ${s.note}`);
    pushLog(`# step → cycle ${s.cycle}`);
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
    pushLog("# demo DIV=4 complete");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "DIV ≈ f_sys/baud for a bit-rate enable. Pulse mode: one-cycle baud_tick every DIV clocks. " +
        "Toggle mode: flip clk_div every DIV clocks so the output period is 2·DIV sysclks (≈ SPI SCLK). " +
        "With oversampling, use DIV ≈ f_sys/(baud·OS) for the sample clock."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderWaveSvg(steps, cursor) {
    const n = steps.length;
    const w = Math.max(400, n * 18);
    const h = 108;
    const paths = [
      { y: 22, label: "out", get: (s) => s.out },
      { y: 58, label: "wrap", get: (s) => (s.kind === "wrap" ? 1 : 0) },
      { y: 94, label: "clk", get: () => 1 },
    ]
      .map(({ y, label, get }) => {
        const y1 = y - 8;
        const y0 = y + 8;
        let d = "";
        for (let i = 0; i < n; i++) {
          const x0 = (i / n) * w;
          const x1 = ((i + 1) / n) * w;
          const val = get(steps[i]);
          const yy = val ? y1 : y0;
          if (i === 0) d += `M ${x0} ${yy}`;
          else {
            const prev = get(steps[i - 1]) ? y1 : y0;
            if (prev !== yy) d += ` L ${x0} ${prev} L ${x0} ${yy}`;
          }
          d += ` L ${x1} ${yy}`;
        }
        return `<text x="2" y="${y + 4}" font-size="10" fill="currentColor">${label}</text>
          <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" transform="translate(40,0)"/>`;
      })
      .join("");
    const cx = 40 + ((cursor + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w + 44} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${paths}
      <line x1="${cx}" y1="4" x2="${cx}" y2="${h - 4}" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  }

  function renderLab() {
    syncInputs();
    const steps = frame();
    const cur = steps[Math.min(state.cursor, steps.length - 1)];
    const done = state.cursor >= steps.length - 1;
    const ticks = tickCount(steps);
    const formulaDiv = calcDivNow();

    document.getElementById("calc-box").textContent =
      `DIV ≈ round(${state.fsysMhz}e6 / (${state.baud} × ${state.os})) = ${formulaDiv}` +
      (formulaDiv > 64 ? `  · wave uses clamp≤64 (sim DIV=${state.div})` : `  · sim DIV=${state.div}`);

    const v = document.getElementById("verdict");
    if (!done) {
      v.className = "verdict idle";
      v.textContent = `cycle ${cur.cycle}/${steps.length - 1} · cnt=${cur.cnt} · ${cur.note}`;
    } else {
      v.className = "verdict yes";
      v.textContent =
        state.mode === "pulse"
          ? `Done · ${ticks} baud_tick(s) in ${state.cycles} cycles · DIV=${state.div}`
          : `Done · toggle every ${state.div} clocks · out period ≈ ${2 * state.div} sysclks`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">DIV=${state.div}</span>
      <span class="flag ${state.mode === "pulse" ? "is-on" : ""}">${state.mode}</span>
      <span class="flag">formula=${formulaDiv}</span>
      <span class="flag ${ticks > 0 ? "is-ok" : ""}">ticks=${ticks}</span>
      <span class="flag">cnt=${cur.cnt}</span>
      <span class="flag ${cur.out ? "is-on" : ""}">out=${cur.out}</span>
    `;

    let head = "<tr><th></th>";
    steps.forEach((s) => {
      head += `<th>${s.cycle}</th>`;
    });
    head += "</tr>";

    const row = (lab, fn, tickCls) => {
      let cells = `<td class="lab">${lab}</td>`;
      steps.forEach((s, i) => {
        const curCls = i === state.cursor ? " cur" : "";
        const val = fn(s);
        const hi = val ? " hi" : "";
        const tk = tickCls && val ? " tick" : "";
        cells += `<td class="${curCls}${hi}${tk}">${val}</td>`;
      });
      return `<tr>${cells}</tr>`;
    };

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>
        ${row("cnt", (s) => s.cnt, false)}
        ${
          state.mode === "pulse"
            ? row("baud_tick", (s) => s.tick, true)
            : row("clk_div", (s) => s.clk, false)
        }
      </tbody></table>
      ${renderWaveSvg(steps, state.cursor)}
    `;

    document.getElementById("bit-list").innerHTML = steps
      .map(
        (s, i) =>
          `<li class="${i === state.cursor ? "is-cur" : ""}">[${s.cycle}] cnt=${s.cnt} out=${s.out} <span style="color:var(--muted)">${s.note}</span></li>`
      )
      .join("");

    document.getElementById("code-box").textContent = sourceCode(state.div, state.mode);
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ div: state.div, mode: state.mode, cursor: state.cursor })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-div",
      title: "Quiz: DIV",
      type: "quiz",
      prompt: "A common integer baud divider is…",
      hint: "f_sys and baud.",
      choices: [
        "DIV ≈ round(f_sys / baud)",
        "DIV = baud / f_sys always",
        "DIV must be a power of two only",
        "DIV is the UART stop-bit count",
      ],
      answer: "DIV ≈ round(f_sys / baud)",
    },
    {
      id: "quiz-tick",
      title: "Quiz: baud_tick",
      type: "quiz",
      prompt: "In pulse mode, baud_tick is typically…",
      hint: "Width.",
      choices: [
        "a 1-cycle enable every DIV sysclks",
        "a 50% duty clock at baud rate",
        "CS for SPI",
        "always high",
      ],
      answer: "a 1-cycle enable every DIV sysclks",
    },
    {
      id: "quiz-toggle",
      title: "Quiz: toggle",
      type: "quiz",
      prompt: "Toggling clk_div every DIV sysclks gives output period…",
      hint: "Two half-periods.",
      choices: [
        "about 2·DIV sysclk periods",
        "exactly DIV/2",
        "one sysclk only",
        "baud×DIV",
      ],
      answer: "about 2·DIV sysclk periods",
    },
    {
      id: "quiz-os",
      title: "Quiz: OS",
      type: "quiz",
      prompt: "For 16× oversampling, the sample-clock DIV is roughly…",
      hint: "Extra factor.",
      choices: [
        "f_sys / (baud × 16)",
        "f_sys / baud only (ignore OS)",
        "baud × 16 / f_sys",
        "always 16",
      ],
      answer: "f_sys / (baud × 16)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — DIV=4 pulse.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" && state.div === 4 && state.mode === "pulse",
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
      id: "see-tick",
      title: "Land on tick",
      prompt: "Land on a cycle where baud_tick=1 (cnt==3).",
      hint: "Step to cycle 3",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.tick === 1 && s.cnt === 3;
      },
    },
    {
      id: "play-4",
      title: "Play DIV=4",
      prompt: "Play to end — expect 4 ticks in 16 cycles.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "run" &&
        state.cursor === state.cycles - 1 &&
        tickCount(frame()) === 4,
    },
    {
      id: "div-8",
      title: "DIV=8",
      prompt: "Set DIV=8, Rebuild — 16 cycles → 2 ticks.",
      hint: "DIV → 8, Rebuild, Play",
      setup: () => loadStarter(),
      check: () =>
        state.div === 8 &&
        state.rebuilt &&
        state.mode === "pulse" &&
        tickCount(frame()) === 2 &&
        state.cursor === state.cycles - 1,
    },
    {
      id: "div-2",
      title: "DIV=2",
      prompt: "DIV=2 pulse, Rebuild+Play — 8 ticks in 16 cycles.",
      hint: "DIV=2",
      setup: () => loadStarter(),
      check: () =>
        state.div === 2 &&
        state.mode === "pulse" &&
        tickCount(frame()) === 8 &&
        state.cursor === state.cycles - 1,
    },
    {
      id: "toggle-mode",
      title: "Toggle mode",
      prompt: "Switch Mode to clk_div toggle and Rebuild.",
      hint: "Mode → toggle",
      setup: () => loadStarter(),
      check: () => state.mode === "toggle" && state.rebuilt,
    },
    {
      id: "toggle-period",
      title: "Toggle wrap",
      prompt: "Toggle DIV=4: land on a wrap cycle (cnt==3).",
      hint: "Toggle + step to wrap",
      setup: () => {
        loadStarter();
        state.mode = "toggle";
        syncInputs();
        rebuild();
      },
      check: () => state.mode === "toggle" && frame()[state.cursor].kind === "wrap",
    },
    {
      id: "calc-115k",
      title: "Calc 115200",
      prompt: "50 MHz, baud 115200, OS 1× — Calc DIV (expect 434).",
      hint: "Calc DIV button",
      setup: () => {
        loadStarter();
        state.fsysMhz = 50;
        state.baud = 115200;
        state.os = 1;
        syncInputs();
      },
      check: () => state.lastAction === "calc" && calcDivNow() === 434,
    },
    {
      id: "calc-16x",
      title: "Calc 16×",
      prompt: "Same 50 MHz / 115200 but OS 16× — Calc (expect 27).",
      hint: "OS → 16×, Calc",
      setup: () => {
        loadStarter();
        state.fsysMhz = 50;
        state.baud = 115200;
        state.os = 16;
        syncInputs();
      },
      check: () => state.lastAction === "calc" && state.os === 16 && calcDivNow() === 27,
    },
    {
      id: "apply-small",
      title: "Apply small",
      prompt: "Set f_sys=16 MHz, baud=1000000, OS 1 — Apply DIV (sim DIV=16).",
      hint: "16e6/1e6=16",
      setup: () => {
        loadStarter();
        state.fsysMhz = 16;
        state.baud = 1000000;
        state.os = 1;
        syncInputs();
      },
      check: () =>
        state.applied && state.div === 16 && calcDivNow() === 16 && state.lastAction === "apply",
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo DIV=4.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.div === 4,
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
      id: "cnt0",
      title: "After wrap",
      prompt: "After a tick, next cycle should show cnt=0.",
      hint: "Step to cycle 4 after first tick",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.cycle === 4 && s.cnt === 0 && state.div === 4;
      },
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
      id: "sketch-pulse",
      title: "Sketch pulse",
      prompt: "Pulse sketch mentions baud_tick and DIV-1.",
      hint: "Read Sketch (pulse mode)",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "pulse" && /baud_tick/i.test(sourceCode(state.div, state.mode)),
    },
    {
      id: "cycles-24",
      title: "24 cycles",
      prompt: "DIV=4 pulse, 24 cycles shown, Rebuild+Play — 6 ticks.",
      hint: "Cycles → 24",
      setup: () => loadStarter(),
      check: () =>
        state.div === 4 &&
        state.cycles === 24 &&
        state.mode === "pulse" &&
        tickCount(frame()) === 6 &&
        state.cursor === 23,
    },
    {
      id: "back-pulse",
      title: "Back to pulse",
      prompt: "From toggle, switch to pulse DIV=4 and Rebuild.",
      hint: "Mode → pulse",
      setup: () => {
        loadStarter();
        state.mode = "toggle";
        syncInputs();
        rebuild();
      },
      check: () => state.mode === "pulse" && state.div === 4 && state.rebuilt,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="bd-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("bd-starter").addEventListener("click", () => {
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
  document.getElementById("btn-calc").addEventListener("click", () => doCalc());
  document.getElementById("btn-apply").addEventListener("click", () => applyDiv());
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

  // Fix createElement for option - smoke uses stub; real DOM is fine
  loadStarter();
})();
