(() => {
  /**
   * I²C clock stretch (concept)
   *   Open-drain SCL: wire = 0 if master OR slave pulls low
   *   Stretch: after master releases SCL (wants 1), slave keeps pulling 0
   *   Master waits until SCL_wire == 1, then continues
   * Starter: stretch 3 ticks right after address ACK low period
   */

  function sourceCode() {
    return `// Clock stretching (open-drain SCL)
// master releases SCL (stop driving low)
// if (SCL_wire == 0) slave is stretching — WAIT
// when SCL_wire rises, master may drive next low / sample
assign scl_wire = master_oe_low | slave_oe_low ? 1'b0 : 1'b1;`;
  }

  /**
   * Build a short addr+ACK timeline with optional stretch window.
   * stretchLen: extra ticks slave holds SCL low after master wants high (post-ACK).
   * where: 'ack' | 'none' | 'mid'
   */
  function buildTimeline(stretchLen, where) {
    const steps = [];
    let i = 0;

    const push = (o) => {
      steps.push({ idx: i++, ...o });
    };

    // Idle
    push({
      label: "idle",
      phase: "idle",
      mScl: 1,
      sHold: 0,
      scl: 1,
      sda: 1,
      waiting: false,
      stretching: false,
    });

    // START
    push({
      label: "START",
      phase: "start",
      mScl: 1,
      sHold: 0,
      scl: 1,
      sda: 0,
      waiting: false,
      stretching: false,
    });

    // A few address bit clocks (simplified: show 2 bits then jump idea)
    for (const lab of ["A6", "A5", "…", "W"]) {
      // SCL low
      push({
        label: `${lab}↓`,
        phase: "bit_low",
        mScl: 0,
        sHold: 0,
        scl: 0,
        sda: lab === "W" ? 0 : 1,
        waiting: false,
        stretching: false,
      });
      // SCL high (master released)
      push({
        label: `${lab}↑`,
        phase: "bit_high",
        mScl: 1,
        sHold: 0,
        scl: 1,
        sda: lab === "W" ? 0 : 1,
        waiting: false,
        stretching: false,
      });
    }

    // ACK: slave drives SDA=0; SCL low then master wants high
    push({
      label: "ACK↓",
      phase: "ack_low",
      mScl: 0,
      sHold: 0,
      scl: 0,
      sda: 0,
      waiting: false,
      stretching: false,
      note: "ACK bit, SCL low",
    });

    if (where === "ack" && stretchLen > 0) {
      // Master releases SCL but slave holds
      for (let t = 0; t < stretchLen; t++) {
        push({
          label: `stretch${t + 1}`,
          phase: "stretch",
          mScl: 1, // master wants high / released
          sHold: 1, // slave holds low
          scl: 0, // wire stays low
          sda: 0,
          waiting: true,
          stretching: true,
          note: "master waiting — SCL still low",
        });
      }
      // Slave releases
      push({
        label: "release",
        phase: "release",
        mScl: 1,
        sHold: 0,
        scl: 1,
        sda: 0,
        waiting: false,
        stretching: false,
        note: "SCL rises — stretch done",
      });
    } else {
      // No stretch after ACK
      push({
        label: "ACK↑",
        phase: "ack_high",
        mScl: 1,
        sHold: 0,
        scl: 1,
        sda: 0,
        waiting: false,
        stretching: false,
      });
    }

    if (where === "mid" && stretchLen > 0) {
      // One more data bit with mid stretch
      push({
        label: "D7↓",
        phase: "bit_low",
        mScl: 0,
        sHold: 0,
        scl: 0,
        sda: 1,
        waiting: false,
        stretching: false,
      });
      for (let t = 0; t < stretchLen; t++) {
        push({
          label: `mid${t + 1}`,
          phase: "stretch",
          mScl: 1,
          sHold: 1,
          scl: 0,
          sda: 1,
          waiting: true,
          stretching: true,
          note: "stretch before D7 high sample",
        });
      }
      push({
        label: "D7↑",
        phase: "bit_high",
        mScl: 1,
        sHold: 0,
        scl: 1,
        sda: 1,
        waiting: false,
        stretching: false,
      });
    } else if (where !== "ack" || stretchLen === 0) {
      // optional short continue
      push({
        label: "next↓",
        phase: "bit_low",
        mScl: 0,
        sHold: 0,
        scl: 0,
        sda: 1,
        waiting: false,
        stretching: false,
      });
      push({
        label: "next↑",
        phase: "bit_high",
        mScl: 1,
        sHold: 0,
        scl: 1,
        sda: 1,
        waiting: false,
        stretching: false,
      });
    }

    // STOP
    push({
      label: "STOP",
      phase: "stop",
      mScl: 1,
      sHold: 0,
      scl: 1,
      sda: 1,
      waiting: false,
      stretching: false,
      done: true,
    });

    return steps;
  }

  function makeStarter() {
    return {
      where: "ack", // none | ack | mid
      stretchLen: 3,
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

  const CLEARED_KEY = "ddv-i2c-clock-stretch-cleared-v1";
  const STORE_KEY = "ddv-i2c-clock-stretch-session-v1";

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

  const root = document.getElementById("ics-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> after address <strong>ACK</strong>, the slave
        holds SCL low for <strong>3</strong> ticks while the master has already released
        it — watch <code>mSCL=1</code> but <code>SCL=0</code> until release.</p>
      <button type="button" class="btn btn-secondary" id="ics-starter">Load starter example</button>
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
          <h3>Open-drain SCL</h3>
          <p>Anyone may pull low; high only when all release (pull-up).</p>
        </div>
        <div class="idea-card">
          <h3>Stretch</h3>
          <p>Slave keeps SCL low to buy time (e.g. after ACK).</p>
        </div>
        <div class="idea-card">
          <h3>Master wait</h3>
          <p>Master must observe the wire — do not assume SCL rose yet.</p>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ics-controls">
        <div class="ics-field">
          <label for="sel-where">Stretch where</label>
          <select id="sel-where">
            <option value="none">None</option>
            <option value="ack" selected>After ACK</option>
            <option value="mid">Before data bit high</option>
          </select>
        </div>
        <div class="ics-field">
          <label for="sel-len">Stretch length</label>
          <select id="sel-len">
            <option value="1">1 tick</option>
            <option value="2">2 ticks</option>
            <option value="3" selected>3 ticks</option>
            <option value="5">5 ticks</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Apply</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo ACK stretch×3</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="note-box" id="note-box"></div>
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

  const selWhere = /** @type {HTMLSelectElement} */ (document.getElementById("sel-where"));
  const selLen = /** @type {HTMLSelectElement} */ (document.getElementById("sel-len"));

  function timeline() {
    const where = state.where === "none" ? "none" : state.where;
    const len = where === "none" ? 0 : state.stretchLen;
    return buildTimeline(len, where === "none" ? "none" : where);
  }

  function syncInputs() {
    selWhere.value = state.where;
    selLen.value = String(state.stretchLen);
    selLen.disabled = state.where === "none";
  }

  function readInputs() {
    state.where = selWhere.value;
    state.stretchLen = Number(selLen.value) || 3;
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

  function stretchCount(tl) {
    return tl.filter((s) => s.stretching).length;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter ACK stretch ×3");
    pushTrace("mSCL released high, slave holds SCL wire low");
    renderAll();
  }

  function applyCfg() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "apply";
    pushLog(`# apply where=${state.where} len=${state.stretchLen}`);
    renderAll();
  }

  function stepOnce() {
    const tl = timeline();
    if (state.cursor < tl.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = tl[state.cursor];
    pushTrace(
      `[${state.cursor}] ${s.label} mSCL=${s.mScl} sHold=${s.sHold} SCL=${s.scl}` +
        (s.waiting ? " WAIT" : "")
    );
    pushLog(`# step → ${s.label}`);
    renderAll();
  }

  function playToEnd() {
    const tl = timeline();
    state.cursor = tl.length - 1;
    state.stepped = true;
    state.lastAction = "run";
    pushLog(`# done stretch_ticks=${stretchCount(tl)}`);
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
      "Clock stretching uses open-drain SCL. After the master releases SCL, " +
        "a slow slave may keep pulling it low. The master must sample the wire and wait " +
        "until SCL is truly high before continuing — otherwise bit timing is wrong."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderWaveSvg(steps, cursor) {
    const n = steps.length;
    const w = Math.max(420, n * 20);
    const rows = [
      { key: "mScl", y: 18, name: "mSCL" },
      { key: "sHold", y: 42, name: "sHold" },
      { key: "scl", y: 66, name: "SCL" },
      { key: "sda", y: 90, name: "SDA" },
    ];
    const h = 104;
    const paths = rows
      .map(({ key, y, name }) => {
        const y1 = y - 7;
        const y0 = y + 7;
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
        return `<text x="2" y="${y + 3}" font-size="9" fill="currentColor">${name}</text>
          <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" transform="translate(40,0)"/>`;
      })
      .join("");
    const cx = 40 + ((cursor + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w + 44} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${paths}
      <line x1="${cx}" y1="2" x2="${cx}" y2="${h - 2}" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  }

  function renderLab() {
    syncInputs();
    const tl = timeline();
    const cur = tl[Math.min(state.cursor, tl.length - 1)];
    const done = !!cur.done;
    const nStretch = stretchCount(tl);

    const v = document.getElementById("verdict");
    if (cur.stretching) {
      v.className = "verdict idle";
      v.textContent = `STRETCH · master released (mSCL=1) but wire SCL=0 — waiting`;
    } else if (done) {
      v.className = "verdict yes";
      v.textContent = `Done · stretch ticks in frame = ${nStretch}`;
    } else {
      v.className = "verdict idle";
      v.textContent = `step ${state.cursor}/${tl.length - 1} · ${cur.label} · phase=${cur.phase}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag">where=${state.where}</span>
      <span class="flag">len=${state.stretchLen}</span>
      <span class="flag ${cur.stretching ? "is-on" : ""}">stretching=${cur.stretching ? 1 : 0}</span>
      <span class="flag ${cur.waiting ? "is-on" : ""}">master_wait=${cur.waiting ? 1 : 0}</span>
      <span class="flag is-ok">stretch_ticks=${nStretch}</span>
    `;

    document.getElementById("note-box").textContent = cur.note
      ? cur.note
      : "mSCL = master intent (1=released). sHold = slave pulling SCL. SCL = wire (AND of open-drain).";

    let head = "<tr><th></th>";
    tl.forEach((_, i) => {
      head += `<th>${i}</th>`;
    });
    head += "</tr>";

    const row = (lab, key, clsFn) => {
      let cells = `<td class="lab">${lab}</td>`;
      tl.forEach((s, i) => {
        const extra = clsFn ? clsFn(s) : "";
        const curCls = i === state.cursor ? " cur" : "";
        const hi = s[key] ? " hi" : "";
        cells += `<td class="${extra}${curCls}${hi}">${s[key]}</td>`;
      });
      return `<tr>${cells}</tr>`;
    };

    let rowLab = `<tr><td class="lab">phase</td>`;
    tl.forEach((s, i) => {
      const curCls = i === state.cursor ? " cur" : "";
      const st = s.stretching ? " stretch" : s.waiting ? " wait" : "";
      rowLab += `<td class="${st}${curCls}">${s.label}</td>`;
    });
    rowLab += "</tr>";

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>
        ${row("mSCL", "mScl")}
        ${row("sHold", "sHold", (s) => (s.sHold ? "stretch" : ""))}
        ${row("SCL", "scl", (s) => (s.stretching ? "stretch" : ""))}
        ${row("SDA", "sda")}
        ${rowLab}
      </tbody></table>
      ${renderWaveSvg(tl, state.cursor)}
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
          where: state.where,
          stretchLen: state.stretchLen,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-od",
      title: "Quiz: open-drain",
      type: "quiz",
      prompt: "SCL can be stretched because it is typically…",
      hint: "Wire-AND.",
      choices: [
        "open-drain / open-collector with a pull-up",
        "push-pull driven only by the slave always",
        "a UART TX pin",
        "differential like USB",
      ],
      answer: "open-drain / open-collector with a pull-up",
    },
    {
      id: "quiz-stretch",
      title: "Quiz: stretch",
      type: "quiz",
      prompt: "During clock stretch the slave…",
      hint: "Hold low.",
      choices: [
        "keeps SCL low even though the master has released it",
        "forces SDA high forever",
        "removes the pull-up resistor",
        "issues STOP immediately",
      ],
      answer: "keeps SCL low even though the master has released it",
    },
    {
      id: "quiz-wait",
      title: "Quiz: master",
      type: "quiz",
      prompt: "A correct master, when it wants SCL high, must…",
      hint: "Look at the wire.",
      choices: [
        "wait until the SCL wire actually rises before continuing",
        "always toggle SDA instead",
        "ignore SCL and use a fixed baud timer only",
        "drive MOSI",
      ],
      answer: "wait until the SCL wire actually rises before continuing",
    },
    {
      id: "quiz-why",
      title: "Quiz: why",
      type: "quiz",
      prompt: "Slaves stretch the clock mainly to…",
      hint: "Need time.",
      choices: [
        "gain time (e.g. prepare ACK/data) without losing the transfer",
        "increase SPI throughput",
        "disable pull-ups permanently",
        "encode Gray pointers",
      ],
      answer: "gain time (e.g. prepare ACK/data) without losing the transfer",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — after ACK, stretch ×3.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.where === "ack" &&
        state.stretchLen === 3,
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
      id: "see-stretch",
      title: "Land on stretch",
      prompt: "Land on a stretch tick (mSCL=1, SCL=0, sHold=1).",
      hint: "Step into stretch1…",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.stretching && s.mScl === 1 && s.scl === 0 && s.sHold === 1;
      },
    },
    {
      id: "see-release",
      title: "See release",
      prompt: "Land on release — SCL rises to 1.",
      hint: "Step past stretch",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.label === "release" && s.scl === 1 && !s.stretching;
      },
    },
    {
      id: "play-3",
      title: "Play stretch×3",
      prompt: "Play to end on starter — stretch_ticks must be 3.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () =>
        state.where === "ack" &&
        state.lastAction === "run" &&
        stretchCount(timeline()) === 3,
    },
    {
      id: "len-5",
      title: "Stretch ×5",
      prompt: "Set stretch length to 5, Apply, Play — stretch_ticks=5.",
      hint: "Length → 5",
      setup: () => loadStarter(),
      check: () =>
        state.stretchLen === 5 &&
        state.rebuilt &&
        stretchCount(timeline()) === 5 &&
        timeline()[state.cursor].done,
    },
    {
      id: "no-stretch",
      title: "No stretch",
      prompt: "Set Stretch where to None and Apply — stretch_ticks=0.",
      hint: "Where → None",
      setup: () => loadStarter(),
      check: () => state.where === "none" && state.rebuilt && stretchCount(timeline()) === 0,
    },
    {
      id: "mid-stretch",
      title: "Mid-bit stretch",
      prompt: "Set where to Before data bit high, len=2, Apply.",
      hint: "Where → mid",
      setup: () => loadStarter(),
      check: () => state.where === "mid" && state.stretchLen === 2 && state.rebuilt,
    },
    {
      id: "mid-run",
      title: "Mid run",
      prompt: "Mid stretch ×2 — Play; stretch_ticks=2 and a mid1 label exists.",
      hint: "Apply mid len2, Play",
      setup: () => {
        loadStarter();
        state.where = "mid";
        state.stretchLen = 2;
        syncInputs();
        applyCfg();
      },
      check: () =>
        state.where === "mid" &&
        stretchCount(timeline()) === 2 &&
        timeline().some((s) => s.label === "mid1") &&
        timeline()[state.cursor].done,
    },
    {
      id: "wait-flag",
      title: "master_wait",
      prompt: "On a stretch tick, master_wait flag is 1.",
      hint: "Land on stretch",
      setup: () => loadStarter(),
      check: () => timeline()[state.cursor].waiting === true,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo ACK stretch×3.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && stretchCount(timeline()) === 3,
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
      id: "mscl-vs-scl",
      title: "mSCL vs SCL",
      prompt: "During stretch1: mSCL=1 and SCL=0 at the same time.",
      hint: "That mismatch is the stretch",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.label === "stretch1" && s.mScl === 1 && s.scl === 0;
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
      id: "sketch",
      title: "Sketch wait",
      prompt: "Sketch mentions WAIT when SCL_wire is 0.",
      hint: "Read Sketch",
      setup: () => loadStarter(),
      check: () => /WAIT/i.test(sourceCode()) && /SCL_wire/i.test(sourceCode()),
    },
    {
      id: "ack-low-first",
      title: "ACK low first",
      prompt: "Land on ACK↓ — SCL=0 before any stretch.",
      hint: "Step to ACK↓",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.label === "ACK↓" && s.scl === 0 && !s.stretching;
      },
    },
    {
      id: "len-1",
      title: "Minimal stretch",
      prompt: "ACK stretch length 1 — Apply; exactly one stretch tick.",
      hint: "Length → 1",
      setup: () => loadStarter(),
      check: () =>
        state.where === "ack" &&
        state.stretchLen === 1 &&
        state.rebuilt &&
        stretchCount(timeline()) === 1,
    },
    {
      id: "done-stop",
      title: "Ends at STOP",
      prompt: "Play to end — final phase is stop with SCL=1 SDA=1.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.done && s.phase === "stop" && s.scl === 1 && s.sda === 1;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ics-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ics-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-rebuild").addEventListener("click", applyCfg);
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
