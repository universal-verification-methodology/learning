(() => {
  /**
   * UART oversampling (concept)
   *   Oversample factor OS (8 or 16): baud tick = OS sample clocks
   *   Mid-bit sample at tick OS/2 (away from edges)
   *   Optional 3-sample majority around mid
   *   Start: detect idle→0, wait OS/2 to center of start bit
   * Starter: 16×, clean 0-bit cell, mid tick = 8
   */

  function midTick(os) {
    return os >> 1; // 8 for 16×, 4 for 8×
  }

  /** Build one bit-cell sample vector */
  function buildSamples(os, level, skew) {
    // skew>0: first `skew` ticks still show previous level (late transition into cell)
    // skew<0: last |skew| ticks already show next (early exit) — teach edge risk
    const prev = level ^ 1;
    const next = level ^ 1;
    const samples = [];
    for (let t = 0; t < os; t++) {
      let v = level;
      if (skew > 0 && t < skew) v = prev;
      if (skew < 0 && t >= os + skew) v = next;
      samples.push(v);
    }
    return samples;
  }

  function majority3(samples, mid) {
    const a = samples[Math.max(0, mid - 1)];
    const b = samples[mid];
    const c = samples[Math.min(samples.length - 1, mid + 1)];
    return a + b + c >= 2 ? 1 : 0;
  }

  function sourceCode(os) {
    const mid = midTick(os);
    return `// UART RX oversample (${os}×)
// baud_tick every ${os} sample clocks
// after start edge: wait ${mid} clocks → mid of start bit
// then every ${os} clocks: sample RX (or majority of mid±1)
localparam OS = ${os};
localparam MID = ${mid};`;
  }

  function makeStarter() {
    return {
      os: 16,
      level: 0,
      skew: 0,
      mode: "mid", // mid | majority
      cursor: 0,
      phase: "cell", // cell | start_hunt
      huntTick: 0,
      startFound: false,
      startCentered: false,
      lastAction: "starter",
      stepped: false,
      explained: false,
      demoed: false,
      rebuilt: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uart-oversample-cleared-v1";
  const STORE_KEY = "ddv-uart-oversample-session-v1";

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

  const root = document.getElementById("uo-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>16×</strong> oversampling of a clean
        <code>0</code> bit cell. Mid sample at tick <code>8</code> — away from the edges.
        Try skew and majority vote; run a start-bit center hunt.</p>
      <button type="button" class="btn btn-secondary" id="uo-starter">Load starter example</button>
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
        <div class="idea-card">
          <h3>N× baud</h3>
          <p>Sample clock runs faster than the bit rate so one bit spans many ticks.</p>
        </div>
        <div class="idea-card">
          <h3>Mid-bit</h3>
          <p>Sample near the center (OS/2) to tolerate edge jitter and rise/fall time.</p>
        </div>
        <div class="idea-card">
          <h3>Start center</h3>
          <p>On idle→0, wait ~OS/2 sample clocks, then confirm start still low.</p>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="uo-controls">
        <div class="uo-field">
          <label for="sel-os">Oversample</label>
          <select id="sel-os">
            <option value="8">8×</option>
            <option value="16" selected>16×</option>
          </select>
        </div>
        <div class="uo-field">
          <label for="sel-level">Bit level</label>
          <select id="sel-level">
            <option value="0" selected>0</option>
            <option value="1">1</option>
          </select>
        </div>
        <div class="uo-field">
          <label for="sel-skew">Edge skew</label>
          <select id="sel-skew">
            <option value="-3">early −3</option>
            <option value="-2">early −2</option>
            <option value="-1">early −1</option>
            <option value="0" selected>ideal 0</option>
            <option value="1">late +1</option>
            <option value="2">late +2</option>
            <option value="3">late +3</option>
            <option value="4">late +4</option>
          </select>
        </div>
        <div class="uo-field">
          <label for="sel-mode">Decide</label>
          <select id="sel-mode">
            <option value="mid" selected>Mid only</option>
            <option value="majority">Majority mid±1</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Apply</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step tick</button>
        <button type="button" class="btn btn-ghost" id="btn-mid">Jump to mid</button>
        <button type="button" class="btn btn-ghost" id="btn-hunt">Start-bit hunt</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo 16× mid</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="wave" id="wave"></div>
      <div class="panel" style="margin:0.75rem 0;padding:0.65rem;border:1px solid var(--line);border-radius:8px">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Sample ticks</h3>
        <ol class="tick-list" id="tick-list" start="0"></ol>
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

  const selOs = /** @type {HTMLSelectElement} */ (document.getElementById("sel-os"));
  const selLevel = /** @type {HTMLSelectElement} */ (document.getElementById("sel-level"));
  const selSkew = /** @type {HTMLSelectElement} */ (document.getElementById("sel-skew"));
  const selMode = /** @type {HTMLSelectElement} */ (document.getElementById("sel-mode"));

  function samples() {
    return buildSamples(state.os, state.level, state.skew);
  }

  function mid() {
    return midTick(state.os);
  }

  function decided(samps) {
    const m = mid();
    if (state.mode === "majority") return majority3(samps, m);
    return samps[m];
  }

  function syncInputs() {
    selOs.value = String(state.os);
    selLevel.value = String(state.level);
    selSkew.value = String(state.skew);
    selMode.value = state.mode;
  }

  function readInputs() {
    state.os = Number(selOs.value) || 16;
    state.level = Number(selLevel.value) ? 1 : 0;
    state.skew = Number(selSkew.value) || 0;
    state.mode = selMode.value === "majority" ? "majority" : "mid";
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
    pushLog("# starter 16× clean 0, mid=8");
    pushTrace("ticks 0..15; sample at 8");
    renderAll();
  }

  function applyCfg() {
    readInputs();
    state.cursor = 0;
    state.phase = "cell";
    state.huntTick = 0;
    state.startFound = false;
    state.startCentered = false;
    state.rebuilt = true;
    state.lastAction = "apply";
    const s = samples();
    const m = mid();
    pushLog(`# apply OS=${state.os} level=${state.level} skew=${state.skew} mode=${state.mode}`);
    pushTrace(
      `samples=[${s.join("")}] mid@${m}=${s[m]} decide=${decided(s)}`
    );
    renderAll();
  }

  function stepTick() {
    if (state.phase === "start_hunt") {
      state.huntTick += 1;
      state.stepped = true;
      state.lastAction = "step";
      const target = mid();
      if (state.huntTick === 1) {
        state.startFound = true;
        pushTrace("start edge seen (idle→0); begin center count");
      }
      if (state.huntTick >= target) {
        state.startCentered = true;
        state.cursor = mid();
        state.phase = "cell";
        state.level = 0;
        state.skew = 0;
        pushTrace(`centered after ${target} ticks — sample start bit @ mid`);
        pushLog("# start centered");
      } else {
        pushTrace(`hunt tick ${state.huntTick}/${target}`);
      }
      renderAll();
      return;
    }
    const s = samples();
    if (state.cursor < s.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const m = mid();
    const tag = state.cursor === m ? " ← MID" : "";
    pushTrace(`t${state.cursor}=${s[state.cursor]}${tag}`);
    pushLog(`# step → t${state.cursor}`);
    renderAll();
  }

  function jumpMid() {
    state.phase = "cell";
    state.cursor = mid();
    state.lastAction = "mid";
    state.stepped = true;
    pushLog(`# jump mid=${state.cursor}`);
    pushTrace(`at mid sample=${samples()[state.cursor]}`);
    renderAll();
  }

  function startHunt() {
    state.phase = "start_hunt";
    state.huntTick = 0;
    state.startFound = false;
    state.startCentered = false;
    state.level = 0;
    state.skew = 0;
    state.cursor = 0;
    state.lastAction = "hunt";
    syncInputs();
    pushLog("# start-bit hunt armed — Step tick to count to mid");
    pushTrace("waiting: detect falling edge, then count OS/2");
    // first step will mark found — auto first edge
    stepTick();
  }

  function demo() {
    state = makeStarter();
    syncInputs();
    state.cursor = mid();
    state.demoed = true;
    state.stepped = true;
    state.lastAction = "demo";
    pushLog("# demo at mid tick 8");
    pushTrace(`decide=${decided(samples())} (expect 0)`);
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      `Oversampling ${state.os}×: one bit = ${state.os} sample clocks. ` +
        `Edges are risky; mid@${mid()} is the teaching sample point. ` +
        `Start hunt waits ${mid()} ticks after the falling edge to sit in the start-bit center.`
    );
    pushLog("# explain");
    renderAll();
  }

  function renderWaveSvg(samps, cursor, m) {
    const n = samps.length;
    const w = Math.max(360, n * 22);
    const h = 72;
    const y1 = 16;
    const y0 = 56;
    let d = "";
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * w;
      const x1 = ((i + 1) / n) * w;
      const y = samps[i] ? y1 : y0;
      if (i === 0) d += `M ${x0} ${y}`;
      else {
        const prev = samps[i - 1] ? y1 : y0;
        if (prev !== y) d += ` L ${x0} ${prev} L ${x0} ${y}`;
      }
      d += ` L ${x1} ${y}`;
    }
    const cx = ((cursor + 0.5) / n) * w;
    const mx = ((m + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${mx}" y1="4" x2="${mx}" y2="${h - 4}" stroke="#0369a1" stroke-width="1.5" stroke-dasharray="4 3"/>
      <path d="${d}" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="${cx}" y1="4" x2="${cx}" y2="${h - 4}" stroke="#b45309" stroke-width="1.5"/>
    </svg>`;
  }

  function renderLab() {
    syncInputs();
    const samps = samples();
    const m = mid();
    const dec = decided(samps);
    const ok = dec === state.level;
    const atMid = state.cursor === m && state.phase === "cell";

    const v = document.getElementById("verdict");
    if (state.phase === "start_hunt") {
      v.className = "verdict idle";
      v.textContent = `Start hunt: ${state.huntTick}/${m} toward mid — Step tick`;
    } else if (atMid) {
      v.className = ok ? "verdict yes" : "verdict no";
      v.textContent = ok
        ? `MID sample=${samps[m]} matches level ${state.level} · decide=${dec} (${state.mode})`
        : `MID sample=${samps[m]} ≠ level ${state.level} (skew pushed mid?) decide=${dec}`;
    } else {
      v.className = "verdict idle";
      v.textContent = `t${state.cursor}=${samps[state.cursor]} · mid@${m} · decide@mid=${dec}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.os}×</span>
      <span class="flag">mid=${m}</span>
      <span class="flag">level=${state.level}</span>
      <span class="flag ${state.skew ? "is-on" : ""}">skew=${state.skew}</span>
      <span class="flag">mode=${state.mode}</span>
      <span class="flag ${ok ? "is-ok" : "is-on"}">decide=${dec}</span>
      <span class="flag ${state.startCentered ? "is-ok" : ""}">start_centered=${state.startCentered ? 1 : 0}</span>
    `;

    let head = "<tr><th></th>";
    for (let i = 0; i < samps.length; i++) head += `<th>${i}</th>`;
    head += "</tr>";

    let rowRx = `<tr><td class="lab">RX</td>`;
    let rowMark = `<tr><td class="lab">mark</td>`;
    for (let i = 0; i < samps.length; i++) {
      const classes = [];
      if (i === state.cursor) classes.push("cur");
      if (i === m) classes.push("is-mid");
      if (state.mode === "majority" && (i === m - 1 || i === m + 1)) classes.push("is-vote");
      if ((state.skew > 0 && i < state.skew) || (state.skew < 0 && i >= samps.length + state.skew)) {
        classes.push("is-edge");
      }
      const cls = classes.length ? ` class="${classes.join(" ")}"` : "";
      rowRx += `<td${cls}>${samps[i]}</td>`;
      let mark = "";
      if (i === m) mark = "M";
      else if (state.mode === "majority" && (i === m - 1 || i === m + 1)) mark = "v";
      else if (i === 0 || i === samps.length - 1) mark = "e";
      rowMark += `<td${cls}>${mark}</td>`;
    }
    rowRx += "</tr>";
    rowMark += "</tr>";

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>${rowRx}${rowMark}</tbody></table>
      ${renderWaveSvg(samps, state.cursor, m)}
    `;

    document.getElementById("tick-list").innerHTML = samps
      .map((bit, i) => {
        const cls = [
          i === state.cursor ? "is-cur" : "",
          i === m ? "is-mid" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<li class="${cls}">t${i} = ${bit}${i === m ? " (mid)" : ""}</li>`;
      })
      .join("");

    document.getElementById("code-box").textContent = sourceCode(state.os);
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
          os: state.os,
          level: state.level,
          skew: state.skew,
          mode: state.mode,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-os",
      title: "Quiz: oversample",
      type: "quiz",
      prompt: "16× oversampling means…",
      hint: "Clocks per bit.",
      choices: [
        "the sample clock runs 16 times the baud rate (16 ticks per bit)",
        "there are 16 stop bits",
        "TX toggles 16 times per start bit only",
        "the FIFO depth is 16",
      ],
      answer: "the sample clock runs 16 times the baud rate (16 ticks per bit)",
    },
    {
      id: "quiz-mid",
      title: "Quiz: mid-bit",
      type: "quiz",
      prompt: "We sample near mid-bit mainly to…",
      hint: "Avoid edges.",
      choices: [
        "avoid settling / jitter near the bit edges",
        "maximize EMI",
        "skip the start bit forever",
        "force MSB-first order",
      ],
      answer: "avoid settling / jitter near the bit edges",
    },
    {
      id: "quiz-start",
      title: "Quiz: start center",
      type: "quiz",
      prompt: "After detecting a falling start edge at 16×, a common next step is…",
      hint: "Count to center.",
      choices: [
        "wait about OS/2 sample clocks, then confirm RX is still 0",
        "immediately sample all 8 data bits on that same edge",
        "drive TX low for one baud",
        "clear the baud divider",
      ],
      answer: "wait about OS/2 sample clocks, then confirm RX is still 0",
    },
    {
      id: "quiz-maj",
      title: "Quiz: majority",
      type: "quiz",
      prompt: "Majority of mid±1 means…",
      hint: "Three samples.",
      choices: [
        "take three samples around mid and pick the value that appears ≥2 times",
        "always invert the mid sample",
        "ignore the mid sample",
        "sample only at tick 0",
      ],
      answer: "take three samples around mid and pick the value that appears ≥2 times",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 16×, level 0, skew 0.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.os === 16 &&
        state.level === 0 &&
        state.skew === 0,
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step tick at least once.",
      hint: "Step tick",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cursor >= 1,
    },
    {
      id: "jump-mid",
      title: "Jump to mid",
      prompt: "Jump to mid (tick 8 on 16×).",
      hint: "Jump to mid",
      setup: () => loadStarter(),
      check: () => state.cursor === 8 && state.os === 16 && state.lastAction === "mid",
    },
    {
      id: "mid-value",
      title: "Mid is 0",
      prompt: "On starter, be at mid with sample 0.",
      hint: "Jump to mid",
      setup: () => loadStarter(),
      check: () => state.cursor === mid() && samples()[state.cursor] === 0,
    },
    {
      id: "set-16",
      title: "Select 16×",
      prompt: "Set oversample to 16× and Apply.",
      hint: "Oversample dropdown + Apply",
      setup: () => {
        loadStarter();
        state.os = 8;
        syncInputs();
        applyCfg();
      },
      check: () => state.os === 16 && state.rebuilt,
    },
    {
      id: "set-8",
      title: "Select 8×",
      prompt: "Set oversample to 8× and Apply (mid becomes 4).",
      hint: "Oversample → 8",
      setup: () => loadStarter(),
      check: () => state.os === 8 && mid() === 4 && state.rebuilt,
    },
    {
      id: "level-1",
      title: "Bit level 1",
      prompt: "Set bit level to 1 and Apply; jump to mid — sample should be 1.",
      hint: "Level 1 + Apply + Jump to mid",
      setup: () => loadStarter(),
      check: () =>
        state.level === 1 &&
        state.cursor === mid() &&
        samples()[mid()] === 1,
    },
    {
      id: "skew-late",
      title: "Late skew",
      prompt: "Set edge skew to late +3 and Apply.",
      hint: "Edge skew → late +3",
      setup: () => loadStarter(),
      check: () => state.skew === 3 && state.rebuilt,
    },
    {
      id: "skew-mid-ok",
      title: "Mid survives skew",
      prompt: "Level 0, skew +3, 16×: mid sample still 0 (Apply + Jump to mid).",
      hint: "Late edge only affects early ticks",
      setup: () => {
        loadStarter();
        state.skew = 3;
        syncInputs();
        applyCfg();
      },
      check: () =>
        state.os === 16 &&
        state.level === 0 &&
        state.skew === 3 &&
        state.cursor === 8 &&
        samples()[8] === 0,
    },
    {
      id: "mode-maj",
      title: "Majority mode",
      prompt: "Select Majority mid±1 and Apply.",
      hint: "Decide dropdown",
      setup: () => loadStarter(),
      check: () => state.mode === "majority" && state.rebuilt,
    },
    {
      id: "start-hunt",
      title: "Start hunt",
      prompt: "Run Start-bit hunt and step until start_centered=1.",
      hint: "Start-bit hunt, keep Stepping",
      setup: () => loadStarter(),
      check: () => state.startCentered === true && state.startFound === true,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo 16× mid.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.os === 16 && state.cursor === 8,
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
      id: "sketch-mid",
      title: "Sketch MID",
      prompt: "With 16×, sketch must show MID = 8.",
      hint: "Starter / Apply 16×",
      setup: () => loadStarter(),
      check: () => state.os === 16 && /MID = 8/.test(sourceCode(state.os)),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset back to starter-like cursor 0 on cell phase.",
      hint: "Reset",
      setup: () => {
        loadStarter();
        jumpMid();
      },
      check: () =>
        state.cursor === 0 &&
        state.phase === "cell" &&
        state.lastAction === "reset",
    },
    {
      id: "edge-mark",
      title: "Edge vs mid marks",
      prompt: "On 16× starter at mid: decide equals level (0).",
      hint: "Jump to mid on clean cell",
      setup: () => {
        loadStarter();
        jumpMid();
      },
      check: () => decided(samples()) === state.level && state.cursor === mid(),
    },
    {
      id: "early-skew",
      title: "Early skew",
      prompt: "Set skew early −2 and Apply.",
      hint: "Edge skew → early −2",
      setup: () => loadStarter(),
      check: () => state.skew === -2 && state.rebuilt,
    },
    {
      id: "8x-mid",
      title: "8× mid tick",
      prompt: "8× oversample: Jump to mid — cursor must be 4.",
      hint: "Select 8×, Apply, Jump to mid",
      setup: () => {
        loadStarter();
        state.os = 8;
        syncInputs();
        applyCfg();
      },
      check: () => state.os === 8 && state.cursor === 4,
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="uo-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("uo-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-rebuild").addEventListener("click", applyCfg);
  document.getElementById("btn-step").addEventListener("click", stepTick);
  document.getElementById("btn-mid").addEventListener("click", jumpMid);
  document.getElementById("btn-hunt").addEventListener("click", startHunt);
  document.getElementById("btn-demo").addEventListener("click", demo);
  document.getElementById("btn-explain").addEventListener("click", explain);
  document.getElementById("btn-reset").addEventListener("click", () => {
    readInputs();
    state.cursor = 0;
    state.phase = "cell";
    state.huntTick = 0;
    state.startFound = false;
    state.startCentered = false;
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
