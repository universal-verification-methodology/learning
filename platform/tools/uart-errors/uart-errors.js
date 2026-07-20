(() => {
  /**
   * UART error cases (concept)
   *   Framing: stop bit ≠ 1
   *   Parity: received parity ≠ expected (even/odd)
   *   Overrun: new frame completes while RHR still unread
   * Starter: clean 0xA5 8E1 — no error flags
   */

  function popcount(n) {
    let x = n & 0xff;
    let c = 0;
    while (x) {
      c += x & 1;
      x >>= 1;
    }
    return c;
  }

  function evenParityBit(data) {
    return popcount(data) % 2 === 0 ? 0 : 1;
  }

  function oddParityBit(data) {
    return popcount(data) % 2 === 0 ? 1 : 0;
  }

  function hex(n) {
    return "0x" + (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  /** Build bit slots for one frame (idle margins included). */
  function buildSlots(byte, parityMode, stopBit, opts = {}) {
    const forceParity = opts.forceParity;
    const forceStop = opts.forceStop;
    const data = byte & 0xff;
    const slots = [];
    let i = 0;
    slots.push({ kind: "idle", label: "idle", bit: 1, idx: i++, bad: false });
    slots.push({ kind: "start", label: "start", bit: 0, idx: i++, bad: false });
    for (let d = 0; d < 8; d++) {
      slots.push({
        kind: "data",
        label: `D${d}`,
        bit: (data >> d) & 1,
        idx: i++,
        bad: false,
      });
    }
    if (parityMode !== "none") {
      const expect =
        parityMode === "even" ? evenParityBit(data) : oddParityBit(data);
      const bit = forceParity !== undefined ? forceParity : expect;
      slots.push({
        kind: "parity",
        label: parityMode === "even" ? "Pe" : "Po",
        bit,
        idx: i++,
        bad: bit !== expect,
        expect,
      });
    }
    const stop = forceStop !== undefined ? forceStop : stopBit;
    slots.push({
      kind: "stop",
      label: "stop",
      bit: stop,
      idx: i++,
      bad: stop !== 1,
      expect: 1,
    });
    slots.push({ kind: "idle", label: "idle", bit: 1, idx: i++, bad: false });
    return slots;
  }

  function analyze(slots, parityMode) {
    const framing = slots.some((s) => s.kind === "stop" && s.bad);
    const parity = slots.some((s) => s.kind === "parity" && s.bad);
    return { framing, parity, clean: !framing && !parity };
  }

  const PRESETS = {
    clean: {
      label: "Clean 0xA5 8E1",
      byte: 0xa5,
      parity: "even",
      stop: 1,
      forceParity: undefined,
      forceStop: undefined,
      overrun: false,
      secondByte: null,
    },
    framing: {
      label: "Framing: stop=0",
      byte: 0xa5,
      parity: "even",
      stop: 1,
      forceParity: undefined,
      forceStop: 0,
      overrun: false,
      secondByte: null,
    },
    parity: {
      label: "Parity: bad Pe",
      byte: 0xa5,
      parity: "even",
      stop: 1,
      forceParity: evenParityBit(0xa5) ^ 1,
      forceStop: undefined,
      overrun: false,
      secondByte: null,
    },
    overrun: {
      label: "Overrun: 2nd byte before read",
      byte: 0xa5,
      parity: "even",
      stop: 1,
      forceParity: undefined,
      forceStop: undefined,
      overrun: true,
      secondByte: 0x5a,
    },
    clean_odd: {
      label: "Clean 0x55 8O1",
      byte: 0x55,
      parity: "odd",
      stop: 1,
      forceParity: undefined,
      forceStop: undefined,
      overrun: false,
      secondByte: null,
    },
  };

  function sourceCode() {
    return `// UART RX status flags (concept)
// framing: stop_sampled != 1
// parity:  pe_sampled != expected(even/odd, data)
// overrun: new_frame_done && !rhr_empty  (SW never read)
wire framing_err, parity_err, overrun_err;`;
  }

  function makeFromPreset(key) {
    const p = PRESETS[key];
    const slots = buildSlots(p.byte, p.parity, p.stop, {
      forceParity: p.forceParity,
      forceStop: p.forceStop,
    });
    const flags = analyze(slots, p.parity);
    return {
      preset: key,
      byte: p.byte,
      parity: p.parity,
      slots,
      cursor: 0,
      framing: flags.framing,
      parityErr: flags.parity,
      overrun: false,
      rhr: null,
      rhrUnread: false,
      rxDone: false,
      secondPending: !!p.overrun,
      secondByte: p.secondByte,
      lastAction: key === "clean" ? "starter" : "preset",
      stepped: false,
      explained: false,
      demoed: false,
      readRhr: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uart-errors-cleared-v1";
  const STORE_KEY = "ddv-uart-errors-session-v1";

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
  let state = makeFromPreset("clean");

  const root = document.getElementById("ue-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> clean frame <code>0xA5</code> with
        <strong>even</strong> parity and stop=1 — framing/parity/overrun all clear.
        Switch presets to inject bad stop, bad parity, or a second byte before RHR read.</p>
      <button type="button" class="btn btn-secondary" id="ue-starter">Load starter example</button>
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
          <h3>Framing</h3>
          <p>Stop bit must be 1. A 0 here usually means noise, baud mismatch, or break.</p>
        </div>
        <div class="idea-card">
          <h3>Parity</h3>
          <p>Check bit must match even/odd over the data bits.</p>
        </div>
        <div class="idea-card">
          <h3>Overrun</h3>
          <p>Hardware finishes a new byte while software has not read the prior RHR.</p>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ue-controls">
        <div class="ue-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset"></select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-step">Step bit</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-read">Read RHR</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo clean</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset cursor</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="rx-box" id="rx-box"></div>
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

  const selPreset = /** @type {HTMLSelectElement} */ (document.getElementById("sel-preset"));
  selPreset.innerHTML = Object.keys(PRESETS)
    .map((k) => `<option value="${k}">${PRESETS[k].label}</option>`)
    .join("");

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

  function finishFrame() {
    // Latch data into RHR if not framing (teaching: still latch data on parity err)
    const data = state.byte;
    if (state.rhrUnread) {
      state.overrun = true;
      pushTrace(`OVERRUN: new ${hex(data)} while RHR still holds ${hex(state.rhr)}`);
    } else {
      state.rhr = data;
      state.rhrUnread = true;
      pushTrace(`RHR ← ${hex(data)} (unread)`);
    }
    state.rxDone = true;

    if (state.secondPending && state.secondByte != null) {
      // Immediately complete a second clean frame → forces overrun if unread
      const prev = state.rhr;
      state.rhr = state.secondByte;
      state.rhrUnread = true;
      state.overrun = true;
      state.secondPending = false;
      pushTrace(
        `2nd frame ${hex(state.secondByte)} completes — OVERWRITE; lost ${hex(prev)}; overrun=1`
      );
    }
  }

  function loadPreset(key, action) {
    state = makeFromPreset(key);
    state.lastAction = action || "preset";
    selPreset.value = key;
    pushLog(`# preset ${key}`);
    pushTrace(PRESETS[key].label);
    renderAll();
  }

  function loadStarter() {
    loadPreset("clean", "starter");
  }

  function stepBit() {
    if (state.cursor < state.slots.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = state.slots[state.cursor];
    const tag = s.bad ? " ← ERROR" : "";
    pushTrace(`[${state.cursor}] ${s.label}=${s.bit} (${s.kind})${tag}`);
    const stopIdx = state.slots.findIndex((x) => x.kind === "stop");
    if (!state.rxDone && state.cursor >= stopIdx) finishFrame();
    pushLog(`# step → ${s.label}`);
    renderAll();
  }

  function playToEnd() {
    while (state.cursor < state.slots.length - 1) {
      state.cursor += 1;
      const s = state.slots[state.cursor];
      if (s.bad) pushTrace(`[${state.cursor}] ${s.label}=${s.bit} ← ERROR`);
    }
    if (!state.rxDone) finishFrame();
    state.stepped = true;
    state.lastAction = "run";
    pushLog("# play to end");
    renderAll();
  }

  function readRhr() {
    if (state.rhr == null) {
      pushLog("# RHR empty");
      pushTrace("read: nothing in RHR yet");
      state.lastAction = "read";
      renderAll();
      return;
    }
    pushTrace(`SW read RHR → ${hex(state.rhr)}; clear unread`);
    state.rhrUnread = false;
    state.readRhr = true;
    state.lastAction = "read";
    // overrun sticky until cleared by scenario reset in this sketch
    pushLog(`# read ${hex(state.rhr)}`);
    renderAll();
  }

  function demo() {
    loadPreset("clean", "demo");
    playToEnd();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo clean complete");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Framing: stop≠1. Parity: Pe/Po ≠ expected from data. " +
        "Overrun: a new byte is received before software reads the holding register — prior data lost."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderWaveSvg(slots, cursor) {
    const n = slots.length;
    const w = Math.max(360, n * 26);
    const h = 64;
    const y1 = 14;
    const y0 = 50;
    let d = "";
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * w;
      const x1 = ((i + 1) / n) * w;
      const y = slots[i].bit ? y1 : y0;
      if (i === 0) d += `M ${x0} ${y}`;
      else {
        const prev = slots[i - 1].bit ? y1 : y0;
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

  function anyErr() {
    return state.framing || state.parityErr || state.overrun;
  }

  function renderLab() {
    selPreset.value = state.preset;
    const cur = state.slots[state.cursor];
    const atEnd = state.cursor >= state.slots.length - 1;

    const v = document.getElementById("verdict");
    if (!state.rxDone) {
      v.className = "verdict idle";
      v.textContent = `cursor ${state.cursor} · ${cur.label}=${cur.bit}${cur.bad ? " (bad)" : ""} · step through frame`;
    } else if (!anyErr()) {
      v.className = "verdict yes";
      v.textContent = `RX OK · data ${hex(state.byte)} · flags clear`;
    } else {
      v.className = "verdict no";
      const parts = [];
      if (state.framing) parts.push("FRAMING");
      if (state.parityErr) parts.push("PARITY");
      if (state.overrun) parts.push("OVERRUN");
      v.textContent = `Error(s): ${parts.join(" + ")} · data ${hex(state.byte)}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.framing ? "is-on" : "is-ok"}">framing=${state.framing ? 1 : 0}</span>
      <span class="flag ${state.parityErr ? "is-on" : "is-ok"}">parity=${state.parityErr ? 1 : 0}</span>
      <span class="flag ${state.overrun ? "is-on" : "is-ok"}">overrun=${state.overrun ? 1 : 0}</span>
      <span class="flag">cfg=8${state.parity === "even" ? "E" : state.parity === "odd" ? "O" : "N"}1</span>
      <span class="flag">${hex(state.byte)}</span>
    `;

    document.getElementById("rx-box").textContent =
      state.rhr == null
        ? "RHR: (empty)"
        : `RHR: ${hex(state.rhr)} · unread=${state.rhrUnread ? 1 : 0}`;

    let head = "<tr><th></th>";
    state.slots.forEach((_, i) => {
      head += `<th>${i}</th>`;
    });
    head += "</tr>";

    let rowKind = `<tr><td class="lab">kind</td>`;
    let rowLab = `<tr><td class="lab">name</td>`;
    let rowBit = `<tr><td class="lab">RX</td>`;
    state.slots.forEach((s, i) => {
      const cls = [
        `kind-${s.kind}`,
        i === state.cursor ? "cur" : "",
        s.bad ? "is-bad" : "",
      ]
        .filter(Boolean)
        .join(" ");
      rowKind += `<td class="${cls}">${s.kind[0]}</td>`;
      rowLab += `<td class="${cls}">${s.label}</td>`;
      rowBit += `<td class="${cls}">${s.bit}</td>`;
    });
    rowKind += "</tr>";
    rowLab += "</tr>";
    rowBit += "</tr>";

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>${rowKind}${rowLab}${rowBit}</tbody></table>
      ${renderWaveSvg(state.slots, state.cursor)}
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
          preset: state.preset,
          cursor: state.cursor,
          framing: state.framing,
          parityErr: state.parityErr,
          overrun: state.overrun,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-frame",
      title: "Quiz: framing",
      type: "quiz",
      prompt: "A framing error usually means…",
      hint: "Look at stop.",
      choices: [
        "the sampled stop bit was not 1",
        "the start bit was 1",
        "parity matched",
        "the FIFO was empty",
      ],
      answer: "the sampled stop bit was not 1",
    },
    {
      id: "quiz-parity",
      title: "Quiz: parity",
      type: "quiz",
      prompt: "A parity error means…",
      hint: "Check bit vs data.",
      choices: [
        "the parity bit does not match the even/odd rule for the data bits",
        "stop was 1",
        "baud is exactly correct always",
        "overrun cannot occur",
      ],
      answer: "the parity bit does not match the even/odd rule for the data bits",
    },
    {
      id: "quiz-overrun",
      title: "Quiz: overrun",
      type: "quiz",
      prompt: "Overrun happens when…",
      hint: "Software late.",
      choices: [
        "a new byte completes before software reads the previous holding register",
        "stop is always 0",
        "TX is idle",
        "parity is disabled",
      ],
      answer: "a new byte completes before software reads the previous holding register",
    },
    {
      id: "quiz-break",
      title: "Quiz: break vs frame",
      type: "quiz",
      prompt: "A line held low for longer than a frame often shows up as…",
      hint: "Related to framing.",
      choices: [
        "framing errors / break detection (stop never returns to 1)",
        "a perfect clean frame",
        "only overrun",
        "SPI mode fault",
      ],
      answer: "framing errors / break detection (stop never returns to 1)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — clean 0xA5 8E1.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.preset === "clean" &&
        !state.framing &&
        !state.parityErr,
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step bit once.",
      hint: "Step bit",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cursor >= 1,
    },
    {
      id: "run-clean",
      title: "Play clean",
      prompt: "Play to end on clean — all flags 0.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () =>
        state.preset === "clean" &&
        state.rxDone &&
        !state.framing &&
        !state.parityErr &&
        !state.overrun,
    },
    {
      id: "preset-frame",
      title: "Framing preset",
      prompt: "Select Framing: stop=0.",
      hint: "Scenario dropdown",
      setup: () => loadStarter(),
      check: () => state.preset === "framing",
    },
    {
      id: "see-frame",
      title: "See framing",
      prompt: "Framing preset → Play to end → framing=1.",
      hint: "Bad stop is highlighted",
      setup: () => loadPreset("framing", "setup"),
      check: () => state.preset === "framing" && state.rxDone && state.framing === true,
    },
    {
      id: "land-stop-bad",
      title: "Land on bad stop",
      prompt: "On framing preset, land cursor on stop with bit 0.",
      hint: "Step to stop",
      setup: () => loadPreset("framing", "setup"),
      check: () => {
        const s = state.slots[state.cursor];
        return !!(s && s.kind === "stop" && s.bit === 0 && s.bad);
      },
    },
    {
      id: "preset-parity",
      title: "Parity preset",
      prompt: "Select Parity: bad Pe.",
      hint: "Scenario dropdown",
      setup: () => loadStarter(),
      check: () => state.preset === "parity",
    },
    {
      id: "see-parity",
      title: "See parity err",
      prompt: "Parity preset → Play to end → parity=1, framing=0.",
      hint: "Play to end",
      setup: () => loadPreset("parity", "setup"),
      check: () =>
        state.preset === "parity" &&
        state.rxDone &&
        state.parityErr === true &&
        state.framing === false,
    },
    {
      id: "land-pe",
      title: "Land on Pe",
      prompt: "Parity preset: land on Pe with bad=1.",
      hint: "Step to Pe",
      setup: () => loadPreset("parity", "setup"),
      check: () => {
        const s = state.slots[state.cursor];
        return !!(s && s.kind === "parity" && s.bad);
      },
    },
    {
      id: "preset-overrun",
      title: "Overrun preset",
      prompt: "Select Overrun scenario.",
      hint: "Scenario dropdown",
      setup: () => loadStarter(),
      check: () => state.preset === "overrun",
    },
    {
      id: "see-overrun",
      title: "See overrun",
      prompt: "Overrun preset → Play to end → overrun=1.",
      hint: "Do not Read RHR before the 2nd byte",
      setup: () => loadPreset("overrun", "setup"),
      check: () => state.preset === "overrun" && state.rxDone && state.overrun === true,
    },
    {
      id: "read-rhr",
      title: "Read RHR",
      prompt: "On clean, Play to end then Read RHR (unread→0).",
      hint: "Read RHR button",
      setup: () => loadStarter(),
      check: () =>
        state.preset === "clean" &&
        state.rxDone &&
        state.readRhr &&
        state.rhrUnread === false,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo clean.",
      hint: "Demo clean",
      setup: () => loadStarter(),
      check: () => state.demoed && state.preset === "clean" && state.rxDone,
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
      id: "clean-odd",
      title: "Clean odd",
      prompt: "Select Clean 0x55 8O1 and Play to end — flags clear.",
      hint: "Odd-parity clean frame",
      setup: () => loadStarter(),
      check: () =>
        state.preset === "clean_odd" &&
        state.rxDone &&
        !state.framing &&
        !state.parityErr &&
        !state.overrun,
    },
    {
      id: "reset",
      title: "Reset cursor",
      prompt: "After stepping, Reset cursor to 0.",
      hint: "Reset cursor",
      setup: () => {
        loadStarter();
        stepBit();
      },
      check: () => state.cursor === 0 && state.lastAction === "reset",
    },
    {
      id: "a5-even-expect",
      title: "A5 even Pe",
      prompt: "Starter clean: expected even Pe for 0xA5 is 0 (four 1s).",
      hint: "Land on Pe on clean preset",
      setup: () => loadStarter(),
      check: () => {
        const s = state.slots[state.cursor];
        return !!(
          state.preset === "clean" &&
          s &&
          s.kind === "parity" &&
          s.bit === 0 &&
          !s.bad
        );
      },
    },
    {
      id: "sketch-flags",
      title: "Sketch flags",
      prompt: "Sketch mentions framing_err, parity_err, overrun_err.",
      hint: "Read Sketch panel",
      setup: () => loadStarter(),
      check: () =>
        /framing_err/.test(sourceCode()) &&
        /parity_err/.test(sourceCode()) &&
        /overrun_err/.test(sourceCode()),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ue-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ue-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-step").addEventListener("click", stepBit);
  document.getElementById("btn-run").addEventListener("click", playToEnd);
  document.getElementById("btn-read").addEventListener("click", readRhr);
  document.getElementById("btn-demo").addEventListener("click", demo);
  document.getElementById("btn-explain").addEventListener("click", explain);
  document.getElementById("btn-reset").addEventListener("click", () => {
    const key = state.preset;
    const unread = state.rhrUnread;
    const rhr = state.rhr;
    const overrun = state.overrun;
    const rxDone = state.rxDone;
    state = makeFromPreset(key);
    // keep RX status across cursor reset for teaching continuity? clearer to soft-reset wave only
    state.rhr = rhr;
    state.rhrUnread = unread;
    state.overrun = overrun;
    state.rxDone = rxDone;
    state.cursor = 0;
    state.lastAction = "reset";
    selPreset.value = key;
    pushLog("# reset cursor");
    renderAll();
  });

  selPreset.addEventListener("change", () => {
    loadPreset(selPreset.value, "preset");
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
