(() => {
  const STORAGE_KEY = "ddv-setup-hold-v1";
  const CLEARED_KEY = "ddv-setup-hold-cleared-v1";

  const PRESETS = {
    clean: {
      id: "clean",
      title: "Clean pass (starter)",
      blurb: "Data settles early; stays through hold — both windows green.",
      tsu: 2,
      th: 1,
      tcq: 1.5,
      edge: 20,
      dataChange: 14,
      period: 40,
    },
    setup_fail: {
      id: "setup_fail",
      title: "Setup violation",
      blurb: "Data flips too close to the edge — inside the setup window.",
      tsu: 3,
      th: 1,
      tcq: 1.5,
      edge: 20,
      dataChange: 18.5,
      period: 40,
    },
    hold_fail: {
      id: "hold_fail",
      title: "Hold violation",
      blurb: "Data flips again too soon after the edge — inside the hold window.",
      tsu: 2,
      th: 2,
      tcq: 1,
      edge: 20,
      dataChange: 21,
      period: 40,
    },
    tight: {
      id: "tight",
      title: "Tight but legal",
      blurb: "Margins are small but still pass.",
      tsu: 2,
      th: 1,
      tcq: 1,
      edge: 20,
      dataChange: 18,
      period: 40,
    },
  };

  const CHALLENGES = [
    {
      id: "quiz-setup",
      title: "Quiz: setup",
      type: "quiz",
      prompt: "Setup time is the requirement that data be stable…",
      hint: "Before the edge.",
      choices: [
        "for at least tsu before the capturing clock edge",
        "only after the clock edge",
        "only during reset",
        "never — clocks are async",
      ],
      answer: "for at least tsu before the capturing clock edge",
    },
    {
      id: "quiz-hold",
      title: "Quiz: hold",
      type: "quiz",
      prompt: "Hold time is the requirement that data stay stable…",
      hint: "After the edge.",
      choices: [
        "for at least th after the capturing clock edge",
        "only before power-up",
        "only on negedge forever",
        "for the whole clock period always",
      ],
      answer: "for at least th after the capturing clock edge",
    },
    {
      id: "quiz-tcq",
      title: "Quiz: clock-to-Q",
      type: "quiz",
      prompt: "Clock-to-Q (tcq) is…",
      hint: "FF output delay.",
      choices: [
        "the delay from the capturing edge until Q updates",
        "the same as setup time",
        "a synthesis area report",
        "the UART baud period",
      ],
      answer: "the delay from the capturing edge until Q updates",
    },
    {
      id: "quiz-setup-fail",
      title: "Quiz: setup fail",
      type: "quiz",
      prompt: "A setup violation means…",
      hint: "Too late.",
      choices: [
        "data changed too late — inside the setup window before the edge",
        "the clock stopped",
        "hold is automatically satisfied",
        "Q cannot exist",
      ],
      answer: "data changed too late — inside the setup window before the edge",
    },
    {
      id: "quiz-hold-fail",
      title: "Quiz: hold fail",
      type: "quiz",
      prompt: "A hold violation means…",
      hint: "Too soon after.",
      choices: [
        "data changed too soon after the edge — inside the hold window",
        "setup is always longer than the period",
        "rst_n is high",
        "only SPICE can see it",
      ],
      answer: "data changed too soon after the edge — inside the hold window",
    },
    {
      id: "quiz-not-spice",
      title: "Quiz: scope",
      type: "quiz",
      prompt: "This lab is…",
      hint: "Conceptual.",
      choices: [
        "a conceptual annotated timing diagram — not a SPICE / STA tool",
        "a full PrimeTime replacement",
        "an IBIS model viewer",
        "a UVM scoreboard",
      ],
      answer: "a conceptual annotated timing diagram — not a SPICE / STA tool",
    },
    {
      id: "quiz-window-setup",
      title: "Quiz: setup window",
      type: "quiz",
      prompt: "The setup window drawn here is…",
      hint: "edge − tsu → edge.",
      choices: [
        "the interval [edge − tsu, edge] where data must already be stable",
        "the entire clock low time only",
        "Q’s unknown region forever",
        "the UART start bit",
      ],
      answer: "the interval [edge − tsu, edge] where data must already be stable",
    },
    {
      id: "quiz-window-hold",
      title: "Quiz: hold window",
      type: "quiz",
      prompt: "The hold window drawn here is…",
      hint: "edge → edge + th.",
      choices: [
        "the interval [edge, edge + th] where data must not change yet",
        "only before time 0",
        "the same as tcq",
        "a cache miss window",
      ],
      answer: "the interval [edge, edge + th] where data must not change yet",
    },
    {
      id: "quiz-path",
      title: "Quiz: path delay",
      type: "quiz",
      prompt: "In a two-FF path, combo delay after the launching FF…",
      hint: "Adds to setup budget.",
      choices: [
        "eats into the time available to meet setup at the capturing FF",
        "removes the need for a clock",
        "is identical to hold time",
        "only affects $display",
      ],
      answer: "eats into the time available to meet setup at the capturing FF",
    },
    {
      id: "quiz-period",
      title: "Quiz: period",
      type: "quiz",
      prompt: "A rough setup-friendly period inequality is often written…",
      hint: "T ≥ …",
      choices: [
        "Tclk ≳ tcq + tpd + tsu (launch delay + path + setup)",
        "Tclk ≤ th only",
        "Tclk = 0",
        "Tclk = $finish",
      ],
      answer: "Tclk ≳ tcq + tpd + tsu (launch delay + path + setup)",
    },
    {
      id: "run-starter",
      title: "Load clean pass",
      type: "run",
      prompt: "Load the Clean pass starter — both setup and hold should pass.",
      hint: "Starter / preset.",
      check: (s) => s.presetId === "clean" && analyze(s).setupOk && analyze(s).holdOk,
    },
    {
      id: "run-setup-fail",
      title: "See setup fail",
      type: "run",
      prompt: "Load Setup violation preset — setup fails, hold passes.",
      hint: "Preset.",
      check: (s) => s.presetId === "setup_fail" && !analyze(s).setupOk && analyze(s).holdOk,
    },
    {
      id: "run-hold-fail",
      title: "See hold fail",
      type: "run",
      prompt: "Load Hold violation preset — hold fails.",
      hint: "Preset.",
      check: (s) => s.presetId === "hold_fail" && !analyze(s).holdOk,
    },
    {
      id: "run-raise-tsu",
      title: "Raise tsu → fail",
      type: "run",
      prompt: "From clean starter, increase tsu until setup fails (keep dataChange fixed).",
      hint: "tsu slider.",
      check: (s) => s.presetId === "clean" && s.tsu >= 6 && !analyze(s).setupOk,
    },
    {
      id: "run-raise-th",
      title: "Raise th → fail",
      type: "run",
      prompt: "From hold_fail (or any post-edge change), make hold fail.",
      hint: "th slider / hold preset.",
      check: (s) => !analyze(s).holdOk && s.dataChange > s.edge,
    },
    {
      id: "run-early-data",
      title: "Move data earlier",
      type: "run",
      prompt: "From setup_fail, drag/move dataChange earlier so setup passes.",
      hint: "Drag the D transition (or lower dataChange).",
      check: (s) => analyze(s).setupOk && s.dataChange <= s.edge - s.tsu,
    },
    {
      id: "run-late-hold",
      title: "Move change later",
      type: "run",
      prompt: "From hold_fail, move dataChange later so hold passes.",
      hint: "Drag D transition right.",
      check: (s) => s.dataChange >= s.edge + s.th && analyze(s).holdOk,
    },
    {
      id: "run-both-pass",
      title: "Both green",
      type: "run",
      prompt: "Any settings: setup and hold both pass.",
      hint: "Clean preset or adjust.",
      check: (s) => analyze(s).setupOk && analyze(s).holdOk,
    },
    {
      id: "run-q-delay",
      title: "Q after edge",
      type: "run",
      prompt: "With tcq ≥ 2, confirm Q updates at edge+tcq (metric shown).",
      hint: "tcq slider.",
      check: (s) => s.tcq >= 2 && Math.abs(analyze(s).qUpdate - (s.edge + s.tcq)) < 1e-6,
    },
    {
      id: "run-margin-setup",
      title: "Setup margin ≥ 2",
      type: "run",
      prompt: "Achieve setup margin of at least 2 time units (and setup pass).",
      hint: "Earlier data or smaller tsu.",
      check: (s) => analyze(s).setupOk && analyze(s).setupMargin >= 2,
    },
    {
      id: "run-margin-hold",
      title: "Hold margin ≥ 1",
      type: "run",
      prompt: "With a post-edge data change, achieve hold margin ≥ 1.",
      hint: "dataChange after edge+th.",
      check: (s) => s.dataChange > s.edge && analyze(s).holdOk && analyze(s).holdMargin >= 1,
    },
    {
      id: "run-tight",
      title: "Tight legal",
      type: "run",
      prompt: "Load Tight but legal — both pass with small margins.",
      hint: "Preset.",
      check: (s) => s.presetId === "tight" && analyze(s).setupOk && analyze(s).holdOk,
    },
  ];

  function analyze(s) {
    const setupDeadline = s.edge - s.tsu;
    const holdRelease = s.edge + s.th;
    const qUpdate = s.edge + s.tcq;
    const setupOk = s.dataChange <= setupDeadline + 1e-9;
    const setupMargin = setupDeadline - s.dataChange;
    let holdOk;
    let holdMargin;
    if (s.dataChange + 1e-9 >= s.edge) {
      holdOk = s.dataChange >= holdRelease - 1e-9;
      holdMargin = s.dataChange - holdRelease;
    } else {
      holdOk = true;
      holdMargin = s.th;
    }
    return { setupOk, holdOk, setupMargin, holdMargin, setupDeadline, holdRelease, qUpdate };
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  const state = {
    presetId: "clean",
    tsu: 2,
    th: 1,
    tcq: 1.5,
    edge: 20,
    dataChange: 14,
    period: 40,
    msg: "",
    msgOk: true,
    challengeId: "quiz-setup",
    challengeOn: false,
    challengeHint: false,
    quizChoice: "",
    clearedIds: [],
    dragging: false,
  };

  function loadPreset(id, opts = {}) {
    const p = PRESETS[id];
    if (!p) return;
    state.presetId = id;
    state.tsu = p.tsu;
    state.th = p.th;
    state.tcq = p.tcq;
    state.edge = p.edge;
    state.dataChange = p.dataChange;
    state.period = p.period;
    if (opts.announce !== false) {
      state.msg = `Loaded ${p.title}.`;
      state.msgOk = true;
    }
  }

  function loadStarter() {
    state.challengeOn = false;
    state.challengeHint = false;
    loadPreset("clean");
    state.msg =
      "Starter: clean pass — green setup & hold windows. Drag D or raise tsu to break it.";
    state.msgOk = true;
  }

  function challengeById(id) {
    return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
  }

  function challengePassed() {
    if (!state.challengeOn) return false;
    const ch = challengeById(state.challengeId);
    if (ch.type === "quiz") return state.quizChoice === ch.answer;
    try {
      return !!ch.check(state);
    } catch {
      return false;
    }
  }

  function noteCleared() {
    if (!state.challengeOn || !challengePassed()) return;
    if (!state.clearedIds.includes(state.challengeId)) {
      state.clearedIds = [...state.clearedIds, state.challengeId];
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(state.clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          presetId: state.presetId,
          tsu: state.tsu,
          th: state.th,
          tcq: state.tcq,
          edge: state.edge,
          dataChange: state.dataChange,
          challengeId: state.challengeId,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function tryRestore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.presetId && PRESETS[d.presetId]) state.presetId = d.presetId;
      ["tsu", "th", "tcq", "edge", "dataChange"].forEach((k) => {
        if (typeof d[k] === "number") state[k] = d[k];
      });
      if (d.challengeId && challengeById(d.challengeId)) state.challengeId = d.challengeId;
      return true;
    } catch {
      return false;
    }
  }

  function renderSvg() {
    const a = analyze(state);
    const tMax = state.period;
    const W = 640;
    const H = 280;
    const left = 56;
    const plotW = W - left - 16;
    const xOf = (t) => left + (t / tMax) * plotW;

    const yClk = 50;
    const yD = 120;
    const yQ = 190;
    const rail = (y) => ({ hi: y - 14, lo: y + 14 });

    function digitalPath(times, values, y) {
      const { hi, lo } = rail(y);
      const yFor = (v) => (v ? hi : lo);
      let d = `M ${xOf(0)} ${yFor(values[0])}`;
      let yy = yFor(values[0]);
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        const ny = yFor(values[i]);
        const x = xOf(t);
        if (ny !== yy) {
          d += ` L ${x} ${yy} L ${x} ${ny}`;
          yy = ny;
        }
        const tNext = i + 1 < times.length ? times[i + 1] : tMax;
        d += ` L ${xOf(tNext)} ${yy}`;
      }
      return d;
    }

    const half = state.period / 2;
    const clkT = [0, state.edge, state.edge, state.edge + half, state.edge + half, tMax];
    const clkV = [0, 0, 1, 1, 0, 0];
    const dT = [0, state.dataChange, state.dataChange, tMax];
    const dV = [0, 0, 1, 1];
    const qNew = a.setupOk ? 1 : 0;
    const qT = [0, a.qUpdate, a.qUpdate, tMax];
    const qV = [0, 0, qNew, qNew];

    const setupX1 = xOf(a.setupDeadline);
    const setupX2 = xOf(state.edge);
    const holdX1 = xOf(state.edge);
    const holdX2 = xOf(a.holdRelease);
    const edgeX = xOf(state.edge);
    const dataX = xOf(state.dataChange);

    let ticks = "";
    for (let t = 0; t <= tMax; t += 5) {
      const x = xOf(t);
      ticks += `<line x1="${x}" y1="18" x2="${x}" y2="${H - 24}" stroke="var(--line)" stroke-width="1"/>`;
      ticks += `<text class="axis" x="${x}" y="14" text-anchor="middle">${t}</text>`;
    }

    return `<svg class="timing-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Setup and hold timing diagram">
      ${ticks}
      <line class="edge" x1="${edgeX}" y1="22" x2="${edgeX}" y2="${H - 28}"/>
      <text class="anno" x="${edgeX + 4}" y="36">edge</text>

      <rect class="win-setup ${a.setupOk ? "" : "bad"}" x="${Math.min(setupX1, setupX2)}" y="${yD - 22}" width="${Math.max(2, Math.abs(setupX2 - setupX1))}" height="44" rx="4"/>
      <rect class="win-hold ${a.holdOk ? "" : "bad"}" x="${Math.min(holdX1, holdX2)}" y="${yD - 22}" width="${Math.max(2, Math.abs(holdX2 - holdX1))}" height="44" rx="4"/>

      <text class="label" x="8" y="${yClk + 4}">clk</text>
      <path class="rail clk" d="${digitalPath(clkT, clkV, yClk)}"/>

      <text class="label" x="8" y="${yD + 4}">D</text>
      <path class="rail data" d="${digitalPath(dT, dV, yD)}"/>

      <text class="label" x="8" y="${yQ + 4}">Q</text>
      <path class="rail q" d="${digitalPath(qT, qV, yQ)}"/>

      <text class="anno ${a.setupOk ? "ok" : "bad"}" x="${(setupX1 + setupX2) / 2}" y="${yD - 28}" text-anchor="middle">tsu</text>
      <text class="anno ${a.holdOk ? "ok" : "bad"}" x="${(holdX1 + holdX2) / 2}" y="${yD - 28}" text-anchor="middle">th</text>
      <text class="anno" x="${xOf(a.qUpdate) + 4}" y="${yQ - 20}">tcq</text>
      <line class="edge" x1="${xOf(a.qUpdate)}" y1="${yQ - 16}" x2="${xOf(a.qUpdate)}" y2="${yQ + 16}"/>

      <circle cx="${dataX}" cy="${yD}" r="6" fill="var(--accent)" stroke="#fff" stroke-width="2"/>
      <rect class="hit" id="drag-hit" x="${dataX - 14}" y="${yD - 28}" width="28" height="56"/>
      <text class="anno" x="${dataX}" y="${yD + 36}" text-anchor="middle">DΔ @ ${round1(state.dataChange)}</text>
    </svg>`;
  }

  function updateDiagramOnly() {
    const a = analyze(state);
    const wrap = root.querySelector(".diagram-wrap");
    const verdicts = root.querySelector(".verdicts");
    const metrics = root.querySelector(".metrics");
    const slider = root.querySelector("#sh-data");
    const dataLab = root.querySelector("[data-lab=data]");
    if (wrap) wrap.innerHTML = renderSvg();
    if (verdicts) {
      verdicts.innerHTML = `
        <span class="verdict ${a.setupOk ? "ok" : "fail"}">Setup ${a.setupOk ? "PASS" : "FAIL"} (margin ${round1(a.setupMargin)})</span>
        <span class="verdict ${a.holdOk ? "ok" : "fail"}">Hold ${a.holdOk ? "PASS" : "FAIL"} (margin ${round1(a.holdMargin)})</span>`;
    }
    if (metrics) {
      metrics.innerHTML = `
        <div><span>Capturing edge</span><strong>t=${round1(state.edge)}</strong></div>
        <div><span>Setup deadline (edge − tsu)</span><strong>t=${round1(a.setupDeadline)}</strong></div>
        <div><span>Hold release (edge + th)</span><strong>t=${round1(a.holdRelease)}</strong></div>
        <div><span>Q update (edge + tcq)</span><strong>t=${round1(a.qUpdate)}</strong></div>`;
    }
    if (slider) slider.value = String(state.dataChange);
    if (dataLab) dataLab.textContent = String(round1(state.dataChange));
    const msg = root.querySelector(".sh-msg");
    if (msg) {
      msg.textContent = state.msg;
      msg.className = `sh-msg ${state.msgOk ? "ok" : "err"}`;
    }
    bindDrag();
  }

  function clientXToTime(svg, clientX) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * svg.viewBox.baseVal.width;
    const left = 56;
    const plotW = 640 - left - 16;
    return ((x - left) / plotW) * state.period;
  }

  function bindDrag() {
    const svg = root.querySelector(".timing-svg");
    const hit = root.querySelector("#drag-hit");
    if (!svg || !hit) return;
    hit.onpointerdown = (ev) => {
      state.dragging = true;
      hit.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    };
    hit.onpointermove = (ev) => {
      if (!state.dragging) return;
      state.dataChange = Math.max(1, Math.min(state.period - 2, round1(clientXToTime(svg, ev.clientX))));
      state.msg = `DΔ → t=${state.dataChange}`;
      state.msgOk = true;
      updateDiagramOnly();
    };
    hit.onpointerup = () => {
      state.dragging = false;
      persist();
      noteCleared();
      render();
    };
    hit.onpointercancel = () => {
      state.dragging = false;
    };
  }

  const root = document.getElementById("sh-root");

  function render() {
    noteCleared();
    const a = analyze(state);
    const ch = challengeById(state.challengeId);
    const passed = challengePassed();
    const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;

    const presetBtns = Object.values(PRESETS)
      .map(
        (p) => `
        <button type="button" class="${p.id === state.presetId ? "is-active" : ""}" data-preset="${p.id}">
          <span class="title">${escapeHtml(p.title)}</span>
          <span class="meta">${escapeHtml(p.blurb)}</span>
        </button>`
      )
      .join("");

    const chalOpts = CHALLENGES.map(
      (c) =>
        `<option value="${c.id}" ${c.id === state.challengeId ? "selected" : ""}>${escapeHtml(c.title)}</option>`
    ).join("");

    let quizHtml = "";
    if (ch.type === "quiz") {
      quizHtml = `<div class="quiz-choices" style="margin:0.5rem 0">${ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="sh-quiz" value="${escapeHtml(c)}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${escapeHtml(c)}</label>`
        )
        .join("")}</div>`;
    }

    root.innerHTML = `
      <div class="starter-note no-print">
        <p><strong>Starter example:</strong> clean setup/hold — data settles before the green
        <code>tsu</code> window and stays through <code>th</code>. Drag the D transition or raise
        <code>tsu</code> to create a violation.</p>
        <button type="button" class="btn btn-secondary" id="sh-starter">Load starter example</button>
      </div>

      <div class="challenge">
        <h2>Challenges <span class="sh-hint">${clearedCount}/${CHALLENGES.length}</span></h2>
        <div class="sh-field" style="margin-bottom:0.5rem">
          <label for="sh-chal">Pick one</label>
          <select id="sh-chal">${chalOpts}</select>
        </div>
        <p>${escapeHtml(ch.prompt)}</p>
        ${
          state.challengeHint
            ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
            : ""
        }
        ${quizHtml}
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="sh-chal-start">${
            state.challengeOn ? "Restart" : "Start"
          }</button>
          <button type="button" class="btn btn-ghost" id="sh-chal-hint">${
            state.challengeHint ? "Hide hint" : "Show hint"
          }</button>
          <button type="button" class="btn btn-ghost" id="sh-chal-check">Check</button>
          <button type="button" class="btn btn-ghost" id="sh-chal-next" ${passed ? "" : "disabled"}>Next</button>
          <button type="button" class="btn btn-ghost" id="sh-chal-stop" ${
            state.challengeOn ? "" : "disabled"
          }>Stop</button>
          <span class="challenge-status ${passed ? "pass" : "idle"}">${
            passed ? "Matched" : state.challengeOn ? "In progress" : "Idle"
          }</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Timing parameters</h2></div>
        <div class="panel-body">
          <div class="sh-preset-grid">${presetBtns}</div>
          <div class="rule-box">
            setup pass: DΔ ≤ edge − tsu &nbsp;·&nbsp;
            hold pass: if DΔ ≥ edge then DΔ ≥ edge + th &nbsp;·&nbsp;
            Q updates @ edge + tcq
          </div>
          <div class="verdicts">
            <span class="verdict ${a.setupOk ? "ok" : "fail"}">Setup ${a.setupOk ? "PASS" : "FAIL"} (margin ${round1(a.setupMargin)})</span>
            <span class="verdict ${a.holdOk ? "ok" : "fail"}">Hold ${a.holdOk ? "PASS" : "FAIL"} (margin ${round1(a.holdMargin)})</span>
          </div>
          <div class="sh-sliders">
            <div class="sh-field">
              <label>tsu <span id="lab-tsu">${round1(state.tsu)}</span></label>
              <input type="range" id="sh-tsu" min="0.5" max="8" step="0.5" value="${state.tsu}">
            </div>
            <div class="sh-field">
              <label>th <span id="lab-th">${round1(state.th)}</span></label>
              <input type="range" id="sh-th" min="0.5" max="6" step="0.5" value="${state.th}">
            </div>
            <div class="sh-field">
              <label>tcq <span id="lab-tcq">${round1(state.tcq)}</span></label>
              <input type="range" id="sh-tcq" min="0.5" max="6" step="0.5" value="${state.tcq}">
            </div>
            <div class="sh-field">
              <label>D transition time <span data-lab="data">${round1(state.dataChange)}</span></label>
              <input type="range" id="sh-data" min="1" max="35" step="0.5" value="${state.dataChange}">
            </div>
          </div>
          <p class="sh-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
          <p class="sh-hint">Conceptual FF model — not SPICE, not full STA. Drag the dot on D to move the transition.</p>
        </div>
      </div>

      <div class="panel" style="margin-top:1rem">
        <div class="panel-head"><h2>Annotated diagram</h2></div>
        <div class="panel-body">
          <div class="diagram-wrap">${renderSvg()}</div>
          <div class="metrics">
            <div><span>Capturing edge</span><strong>t=${round1(state.edge)}</strong></div>
            <div><span>Setup deadline (edge − tsu)</span><strong>t=${round1(a.setupDeadline)}</strong></div>
            <div><span>Hold release (edge + th)</span><strong>t=${round1(a.holdRelease)}</strong></div>
            <div><span>Q update (edge + tcq)</span><strong>t=${round1(a.qUpdate)}</strong></div>
          </div>
        </div>
      </div>
    `;

    bind();
    persist();
  }

  function bind() {
    root.querySelector("#sh-starter")?.addEventListener("click", () => {
      loadStarter();
      render();
    });
    root.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        loadPreset(btn.getAttribute("data-preset"));
        render();
      });
    });

    const bindRange = (sel, key, labId) => {
      const el = root.querySelector(sel);
      el?.addEventListener("input", () => {
        state[key] = Number(el.value);
        if (labId) {
          const lab = root.querySelector(labId);
          if (lab) lab.textContent = String(round1(state[key]));
        }
        state.msg = `${key} → ${round1(state[key])}`;
        state.msgOk = true;
        updateDiagramOnly();
        noteCleared();
        const status = root.querySelector(".challenge-status");
        if (status && state.challengeOn) {
          const ok = challengePassed();
          status.className = `challenge-status ${ok ? "pass" : "idle"}`;
          status.textContent = ok ? "Matched" : "In progress";
        }
        persist();
      });
    };
    bindRange("#sh-tsu", "tsu", "#lab-tsu");
    bindRange("#sh-th", "th", "#lab-th");
    bindRange("#sh-tcq", "tcq", "#lab-tcq");
    bindRange("#sh-data", "dataChange", "[data-lab=data]");

    bindDrag();

    root.querySelector("#sh-chal")?.addEventListener("change", (e) => {
      state.challengeId = e.target.value;
      state.challengeOn = false;
      state.challengeHint = false;
      state.quizChoice = "";
      render();
    });
    root.querySelector("#sh-chal-start")?.addEventListener("click", () => {
      const ch = challengeById(state.challengeId);
      state.challengeOn = true;
      state.challengeHint = false;
      state.quizChoice = "";
      if (ch.type === "run") {
        if (ch.id === "run-setup-fail" || ch.id === "run-early-data")
          loadPreset("setup_fail", { announce: false });
        else if (ch.id === "run-hold-fail" || ch.id === "run-late-hold" || ch.id === "run-raise-th")
          loadPreset("hold_fail", { announce: false });
        else if (ch.id === "run-tight") loadPreset("tight", { announce: false });
        else loadPreset("clean", { announce: false });
      }
      state.msg = `Challenge “${ch.title}” — ${ch.prompt}`;
      state.msgOk = true;
      render();
    });
    root.querySelector("#sh-chal-hint")?.addEventListener("click", () => {
      state.challengeHint = !state.challengeHint;
      render();
    });
    root.querySelector("#sh-chal-check")?.addEventListener("click", () => {
      state.challengeOn = true;
      noteCleared();
      const ok = challengePassed();
      state.msg = ok ? "Challenge matched." : "Not yet — keep going.";
      state.msgOk = ok;
      render();
    });
    root.querySelector("#sh-chal-next")?.addEventListener("click", () => {
      const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
      state.challengeId = CHALLENGES[(i + 1) % CHALLENGES.length].id;
      state.challengeOn = false;
      state.challengeHint = false;
      state.quizChoice = "";
      render();
    });
    root.querySelector("#sh-chal-stop")?.addEventListener("click", () => {
      state.challengeOn = false;
      render();
    });
    root.querySelectorAll('input[name="sh-quiz"]').forEach((inp) => {
      inp.addEventListener("change", () => {
        state.quizChoice = inp.value;
        if (state.challengeOn) noteCleared();
        render();
      });
    });
  }

  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) state.clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  if (!tryRestore()) loadStarter();
  else {
    state.msg = "Session restored — adjust sliders or load a preset.";
    state.msgOk = true;
  }
  render();
})();
