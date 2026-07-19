(() => {
  const STORAGE_KEY = "ddv-fsm-lab-v1";
  const CLEARED_KEY = "ddv-fsm-lab-cleared-v1";

  /** @typedef {{ id: number, name: string, out: number }} FsmState */
  /** @typedef {{ next: number, out: number }} Trans */
  /** @typedef {{ id: string, title: string, style: "moore"|"mealy", states: FsmState[], delta: Trans[][], stream: string, note: string }} Preset */

  function emptyDelta(n) {
    return Array.from({ length: n }, () => [
      { next: 0, out: 0 },
      { next: 0, out: 0 },
    ]);
  }

  /** Moore toggle: Z flips when x=1 */
  function presetToggle() {
    return {
      id: "toggle",
      title: "Moore toggle (x=1 flips Z)",
      style: "moore",
      states: [
        { id: 0, name: "S0", out: 0 },
        { id: 1, name: "S1", out: 1 },
      ],
      delta: [
        [
          { next: 0, out: 0 },
          { next: 1, out: 0 },
        ],
        [
          { next: 1, out: 0 },
          { next: 0, out: 0 },
        ],
      ],
      stream: "1011",
      note: "Moore: output = state. x=1 toggles; x=0 holds.",
    };
  }

  /** Mealy pulse: Z=1 only on transition S0--1-->S1 */
  function presetMealyPulse() {
    return {
      id: "mealy-pulse",
      title: "Mealy edge pulse",
      style: "mealy",
      states: [
        { id: 0, name: "IDLE", out: 0 },
        { id: 1, name: "ARM", out: 0 },
      ],
      delta: [
        [
          { next: 0, out: 0 },
          { next: 1, out: 1 },
        ],
        [
          { next: 0, out: 0 },
          { next: 1, out: 0 },
        ],
      ],
      stream: "01011",
      note: "Mealy: Z=1 on IDLE→ARM when x=1 (rising-ish edge in stream).",
    };
  }

  /** 3-state Moore counter-ish: 00,01,10 cycle on x=1 */
  function presetCount3() {
    const d = emptyDelta(3);
    // x=0 stay; x=1 advance
    for (let s = 0; s < 3; s++) {
      d[s][0] = { next: s, out: 0 };
      d[s][1] = { next: (s + 1) % 3, out: 0 };
    }
    return {
      id: "count3",
      title: "Moore 3-state ring (x=1)",
      style: "moore",
      states: [
        { id: 0, name: "A", out: 0 },
        { id: 1, name: "B", out: 0 },
        { id: 2, name: "C", out: 1 },
      ],
      delta: d,
      stream: "1110",
      note: "Three states; Z=1 only in C. Advance on x=1.",
    };
  }

  function presetBlank3() {
    const d = emptyDelta(3);
    return {
      id: "blank3",
      title: "Blank 3-state (edit me)",
      style: "moore",
      states: [
        { id: 0, name: "S0", out: 0 },
        { id: 1, name: "S1", out: 0 },
        { id: 2, name: "S2", out: 0 },
      ],
      delta: d,
      stream: "0101",
      note: "Edit the table, then step.",
    };
  }

  const PRESETS = [presetToggle(), presetMealyPulse(), presetCount3(), presetBlank3()];

  function cloneMachine(p) {
    return {
      style: p.style,
      states: p.states.map((s) => ({ ...s })),
      delta: p.delta.map((row) => row.map((t) => ({ ...t }))),
    };
  }

  function outputAt(m, stateId, x, nextId) {
    if (m.style === "moore") return m.states[nextId].out;
    return m.delta[stateId][x].out;
  }

  function step(m, stateId, x) {
    const t = m.delta[stateId][x];
    const next = t.next;
    const z = m.style === "moore" ? m.states[next].out : t.out;
    return { next, z };
  }

  function runStream(m, bits, start = 0) {
    let s = start;
    const zs = [];
    const path = [s];
    for (const b of bits) {
      const r = step(m, s, b);
      s = r.next;
      zs.push(r.z);
      path.push(s);
    }
    return { zs, path };
  }

  const CHALLENGES = [
    {
      id: "quiz-fsm",
      title: "Quiz: FSM",
      type: "quiz",
      prompt: "A finite-state machine is defined by…",
      hint: "States + transitions.",
      choices: [
        "a finite set of states, inputs, outputs, and next-state / output rules",
        "only a continuous assign",
        "an infinite tape",
        "a cache tag array",
      ],
      answer: "a finite set of states, inputs, outputs, and next-state / output rules",
    },
    {
      id: "quiz-moore",
      title: "Quiz: Moore",
      type: "quiz",
      prompt: "Moore outputs depend on…",
      hint: "State only.",
      choices: ["current state only", "state and input", "only the next state name", "FIFO depth"],
      answer: "current state only",
    },
    {
      id: "quiz-mealy",
      title: "Quiz: Mealy",
      type: "quiz",
      prompt: "Mealy outputs depend on…",
      hint: "Transition.",
      choices: [
        "current state and current input (the transition)",
        "state only",
        "the bitstream length only",
        "reset only",
      ],
      answer: "current state and current input (the transition)",
    },
    {
      id: "quiz-table",
      title: "Quiz: state table",
      type: "quiz",
      prompt: "The state / transition table lists…",
      hint: "For each state+input.",
      choices: [
        "next state (and output) for each present state and input",
        "only encoding Hamming distances",
        "CLA generate terms",
        "UART stop bits",
      ],
      answer: "next state (and output) for each present state and input",
    },
    {
      id: "quiz-step",
      title: "Quiz: stepping",
      type: "quiz",
      prompt: "Stepping the input stream…",
      hint: "Clock-like.",
      choices: [
        "applies one input bit per step and updates state / Z",
        "synthesizes the design",
        "clears all states",
        "changes DEPTH of a FIFO",
      ],
      answer: "applies one input bit per step and updates state / Z",
    },
    {
      id: "quiz-reset",
      title: "Quiz: reset run",
      type: "quiz",
      prompt: "Reset run typically returns to…",
      hint: "Initial state.",
      choices: [
        "the initial / reset state (here S0 / first state) and clears the step pointer",
        "DETECT forever",
        "a random state",
        "Moore only",
      ],
      answer: "the initial / reset state (here S0 / first state) and clears the step pointer",
    },
    {
      id: "quiz-vs-seq",
      title: "Quiz: vs seq-detector",
      type: "quiz",
      prompt: "Compared with the sequence-detector lab, this tool…",
      hint: "Editable machine.",
      choices: [
        "lets you edit a general small FSM (presets + table), not only a fixed pattern builder",
        "only detects 1011",
        "has no outputs",
        "is async CDC only",
      ],
      answer: "lets you edit a general small FSM (presets + table), not only a fixed pattern builder",
    },
    {
      id: "quiz-encoding",
      title: "Quiz: encoding",
      type: "quiz",
      prompt: "State names here are separate from…",
      hint: "state-encoding lab.",
      choices: [
        "binary / one-hot / Gray encoding of those states in hardware",
        "the next-state function",
        "Mealy vs Moore",
        "the input alphabet {0,1}",
      ],
      answer: "binary / one-hot / Gray encoding of those states in hardware",
    },
    {
      id: "run-toggle-start",
      title: "Toggle starter",
      type: "run",
      prompt: "Load Moore toggle preset. After Reset, state is S0 and Moore Z (state out) is 0.",
      hint: "Starter.",
      check: (s) =>
        s.presetId === "toggle" &&
        s.machine.style === "moore" &&
        s.cur === 0 &&
        s.pos === 0 &&
        s.machine.states[0].out === 0,
    },
    {
      id: "run-toggle-flip",
      title: "Toggle on 1",
      type: "run",
      prompt: "Moore toggle, stream starting with 1: Step once — go to S1 with Z=1.",
      hint: "Step x=1.",
      check: (s) =>
        s.presetId === "toggle" && s.pos === 1 && s.cur === 1 && s.zHist[0] === 1 && s.stream[0] === "1",
    },
    {
      id: "run-toggle-hold",
      title: "Hold on 0",
      type: "run",
      prompt: "From S1 on toggle machine, feed x=0 — stay S1, Z=1.",
      hint: "Stream 10… Step twice from reset.",
      check: (s) => {
        if (s.presetId !== "toggle" || s.stream[0] !== "1" || s.stream[1] !== "0") return false;
        return s.pos >= 2 && s.cur === 1 && s.zHist[1] === 1;
      },
    },
    {
      id: "run-mealy-pulse",
      title: "Mealy pulse",
      type: "run",
      prompt: "Mealy edge-pulse preset, stream 01…: after two steps, Z history includes a 1 on the 0→1 edge.",
      hint: "Load Mealy preset.",
      check: (s) => {
        if (s.presetId !== "mealy-pulse") return false;
        const bits = s.stream.map(Number);
        const { zs } = runStream(s.machine, bits);
        return s.pos >= 2 && zs.slice(0, 2).includes(1);
      },
    },
    {
      id: "run-count3",
      title: "Ring C",
      type: "run",
      prompt: "Moore 3-state ring: stream 111 from reset — end in C with Z=1.",
      hint: "Three advances.",
      check: (s) => {
        if (s.presetId !== "count3" || s.stream.join("").slice(0, 3) !== "111") return false;
        return s.pos >= 3 && s.cur === 2 && s.machine.states[2].out === 1;
      },
    },
    {
      id: "run-edit-next",
      title: "Edit next-state",
      type: "run",
      prompt: "Blank 3-state: set S0,x=1 → next S2 in the table, Reset, stream 1…, Step — land in S2.",
      hint: "Edit table then step.",
      check: (s) =>
        s.presetId === "blank3" &&
        s.machine.delta[0][1].next === 2 &&
        s.pos >= 1 &&
        s.stream[0] === "1" &&
        s.cur === 2,
    },
    {
      id: "run-moore-z",
      title: "Moore Z from state",
      type: "run",
      prompt: "On toggle preset after reaching S1, state output out=1 (Z follows state).",
      hint: "Be in S1.",
      check: (s) =>
        s.presetId === "toggle" &&
        s.machine.style === "moore" &&
        s.cur === 1 &&
        s.machine.states[1].out === 1,
    },
    {
      id: "run-complete",
      title: "Finish stream",
      type: "run",
      prompt: "Any preset: Step until pos equals stream length.",
      hint: "Step all bits.",
      check: (s) => s.stream.length > 0 && s.pos >= s.stream.length,
    },
    {
      id: "run-reset",
      title: "Reset run",
      type: "run",
      prompt: "After stepping, Reset run — cur=0 and pos=0.",
      hint: "Reset run.",
      check: (s) => s.cur === 0 && s.pos === 0,
    },
    {
      id: "run-z-hist",
      title: "Z history length",
      type: "run",
      prompt: "Toggle + stream 1011: after full run, Z history length is 4.",
      hint: "Step all.",
      check: (s) =>
        s.presetId === "toggle" &&
        s.stream.join("") === "1011" &&
        s.pos >= 4 &&
        s.zHist.length === 4,
    },
    {
      id: "quiz-init",
      title: "Quiz: initial",
      type: "quiz",
      prompt: "Hardware FSMs usually need…",
      hint: "Reset.",
      choices: [
        "a defined reset / initial state",
        "no next-state logic",
        "infinite states",
        "only Mealy outputs",
      ],
      answer: "a defined reset / initial state",
    },
    {
      id: "run-style-moore",
      title: "Style Moore",
      type: "run",
      prompt: "Machine style must be Moore (toggle or count3 or blank).",
      hint: "Preset.",
      check: (s) => s.machine.style === "moore",
    },
    {
      id: "run-style-mealy",
      title: "Style Mealy",
      type: "run",
      prompt: "Load Mealy edge-pulse — style is mealy.",
      hint: "Preset Mealy.",
      check: (s) => s.presetId === "mealy-pulse" && s.machine.style === "mealy",
    },
    {
      id: "quiz-alphabet",
      title: "Quiz: alphabet",
      type: "quiz",
      prompt: "This lab’s input alphabet is…",
      hint: "Binary stream.",
      choices: ["{0,1} one bit per step", "{0…255} bytes only", "analog voltages", "tag/index/offset"],
      answer: "{0,1} one bit per step",
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
    presetId: "toggle",
    machine: cloneMachine(presetToggle()),
    stream: ["1", "0", "1", "1"],
    pos: 0,
    cur: 0,
    zHist: [],
    lastX: null,
    log: [],
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadPreset(id) {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
    state.presetId = p.id;
    state.machine = cloneMachine(p);
    state.stream = p.stream.split("");
    resetRun();
    state.log = [p.note];
  }

  function loadStarter() {
    loadPreset("toggle");
    state.log = [
      "Starter: Moore toggle. Step stream 1011 — Z follows state; flips on each 1.",
    ];
  }

  function resetRun() {
    state.pos = 0;
    state.cur = 0;
    state.zHist = [];
    state.lastX = null;
  }

  function doStep() {
    if (state.pos >= state.stream.length) return;
    const x = Number(state.stream[state.pos]);
    const r = step(state.machine, state.cur, x);
    const from = state.machine.states[state.cur].name;
    const to = state.machine.states[r.next].name;
    state.log.unshift(`x=${x}: ${from} → ${to}, Z=${r.z}`);
    if (state.log.length > 40) state.log.length = 40;
    state.lastX = x;
    state.cur = r.next;
    state.zHist.push(r.z);
    state.pos++;
    saveSession();
    renderAll();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          presetId: state.presetId,
          machine: state.machine,
          stream: state.stream,
          pos: state.pos,
          cur: state.cur,
          zHist: state.zHist,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d.machine || !Array.isArray(d.machine.states)) return false;
      state.presetId = d.presetId || "toggle";
      state.machine = d.machine;
      state.stream = Array.isArray(d.stream) ? d.stream.map(String) : ["1", "0"];
      state.pos = Number(d.pos) || 0;
      state.cur = Number(d.cur) || 0;
      state.zHist = Array.isArray(d.zHist) ? d.zHist : [];
      state.log = ["Session restored."];
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("fsm-root");
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
        <button type="button" class="btn btn-ghost" id="chal-load">Load challenge setup</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>FSM studio</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-reset">Reset run</button>
          <button type="button" class="btn btn-secondary" id="btn-step">Step</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="fsm-controls">
          <div class="fsm-field">
            <label for="preset">Preset</label>
            <select id="preset"></select>
          </div>
          <div class="fsm-field">
            <label for="style">Style</label>
            <select id="style">
              <option value="moore">Moore</option>
              <option value="mealy">Mealy</option>
            </select>
          </div>
          <div class="fsm-field">
            <label for="stream">Bit stream</label>
            <input id="stream" type="text" spellcheck="false">
          </div>
        </div>
        <p class="fsm-meta" id="note"></p>
        <div class="state-graph" id="graph"></div>
        <p class="fsm-meta" style="font-weight:600;color:var(--ink)">Transition table (editable)</p>
        <table class="ttable" id="ttable"></table>
        <div class="stream-row" id="stream-view"></div>
        <div class="status-strip" id="status"></div>
        <p class="fsm-meta">Arcs</p>
        <ul class="arc-list" id="arcs"></ul>
        <p class="fsm-meta">Z history</p>
        <div class="wave-z" id="wave-z"></div>
        <ul class="log-list" id="log"></ul>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const m = state.machine;
    document.getElementById("starter-note").textContent =
      "Starter example: Moore toggle — S0 (Z=0) / S1 (Z=1); x=1 flips state. Step 1011 and watch Z.";

    const pre = document.getElementById("preset");
    pre.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${p.title}</option>`).join("");
    pre.value = state.presetId;
    document.getElementById("style").value = m.style;
    document.getElementById("stream").value = state.stream.join("");

    const preset = PRESETS.find((p) => p.id === state.presetId);
    document.getElementById("note").textContent = preset ? preset.note : "";

    document.getElementById("graph").innerHTML = m.states
      .map((st) => {
        const z = m.style === "moore" ? st.out : "—";
        return `<div class="state-node ${st.id === state.cur ? "active" : ""}">
          ${st.name}
          <span class="out ${m.style === "moore" && st.out ? "on" : ""}">${
            m.style === "moore" ? `Z=${z}` : "Mealy Z on arc"
          }</span>
        </div>`;
      })
      .join("");

    // Editable table
    let head = `<tr><th>State</th>${
      m.style === "moore" ? "<th>Moore Z</th>" : ""
    }<th>x=0 next</th>${m.style === "mealy" ? "<th>x=0 Z</th>" : ""}<th>x=1 next</th>${
      m.style === "mealy" ? "<th>x=1 Z</th>" : ""
    }</tr>`;
    let body = "";
    m.states.forEach((st) => {
      const opts = (sel) =>
        m.states
          .map((s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${s.name}</option>`)
          .join("");
      body += `<tr class="${st.id === state.cur ? "cur" : ""}" data-sid="${st.id}">
        <td><input data-k="name" value="${st.name}" style="max-width:4.5rem"></td>
        ${
          m.style === "moore"
            ? `<td><select data-k="mout">${[0, 1]
                .map((v) => `<option value="${v}" ${st.out === v ? "selected" : ""}>${v}</option>`)
                .join("")}</select></td>`
            : ""
        }
        <td><select data-k="n0">${opts(m.delta[st.id][0].next)}</select></td>
        ${
          m.style === "mealy"
            ? `<td><select data-k="z0">${[0, 1]
                .map(
                  (v) =>
                    `<option value="${v}" ${m.delta[st.id][0].out === v ? "selected" : ""}>${v}</option>`
                )
                .join("")}</select></td>`
            : ""
        }
        <td><select data-k="n1">${opts(m.delta[st.id][1].next)}</select></td>
        ${
          m.style === "mealy"
            ? `<td><select data-k="z1">${[0, 1]
                .map(
                  (v) =>
                    `<option value="${v}" ${m.delta[st.id][1].out === v ? "selected" : ""}>${v}</option>`
                )
                .join("")}</select></td>`
            : ""
        }
      </tr>`;
    });
    const table = document.getElementById("ttable");
    table.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
    table.querySelectorAll("select, input").forEach((el) => {
      el.addEventListener("change", onTableEdit);
    });

    const sv = document.getElementById("stream-view");
    sv.innerHTML = state.stream
      .map((b, i) => {
        let cls = "bit";
        if (i < state.pos) cls += " done";
        if (i === state.pos) cls += " cur";
        return `<span class="${cls}">${b}</span>`;
      })
      .join("");

    document.getElementById("status").innerHTML = `
      <span>state <strong>${m.states[state.cur]?.name}</strong></span>
      <span>pos ${state.pos}/${state.stream.length}</span>
      <span>last Z=${state.zHist.length ? state.zHist[state.zHist.length - 1] : "—"}</span>
    `;

    document.getElementById("arcs").innerHTML = m.states
      .flatMap((st) =>
        [0, 1].map((x) => {
          const t = m.delta[st.id][x];
          const fire = state.cur === st.id && state.lastX === x && state.pos > 0;
          const zpart =
            m.style === "mealy" ? ` / Z=${t.out}` : ` → Z=${m.states[t.next].out} (Moore)`;
          return `<li class="${fire ? "fire" : ""}">${st.name} —${x}→ ${m.states[t.next].name}${zpart}</li>`;
        })
      )
      .join("");

    document.getElementById("wave-z").textContent = state.zHist.length
      ? "Z: " + state.zHist.join(" ")
      : "Z: (none yet)";
    document.getElementById("log").innerHTML =
      state.log.map((l) => `<li>${l}</li>`).join("") ||
      `<li style="color:var(--muted)">Step to advance</li>`;
  }

  function onTableEdit(e) {
    const tr = e.target.closest("tr");
    const sid = Number(tr.dataset.sid);
    const k = e.target.dataset.k;
    const m = state.machine;
    if (k === "name") m.states[sid].name = e.target.value || m.states[sid].name;
    if (k === "mout") m.states[sid].out = Number(e.target.value) ? 1 : 0;
    if (k === "n0") m.delta[sid][0].next = Number(e.target.value);
    if (k === "n1") m.delta[sid][1].next = Number(e.target.value);
    if (k === "z0") m.delta[sid][0].out = Number(e.target.value) ? 1 : 0;
    if (k === "z1") m.delta[sid][1].out = Number(e.target.value) ? 1 : 0;
    state.presetId = state.presetId === "blank3" ? "blank3" : state.presetId;
    saveSession();
    renderAll();
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
            `<label><input type="radio" name="fsm-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  function loadChallengeSetup() {
    const ch = CHALLENGES[state.challengeIdx];
    if (ch.type === "quiz") {
      setChalStatus("idle", "Quiz — pick an answer");
      return;
    }
    if (ch.id === "run-mealy-pulse" || ch.id === "run-style-mealy") loadPreset("mealy-pulse");
    else if (ch.id === "run-count3") loadPreset("count3");
    else if (ch.id === "run-edit-next") {
      loadPreset("blank3");
      state.machine.delta[0][1].next = 0; // user must set to 2
      state.stream = ["1", "0", "1", "0"];
    } else if (ch.id === "run-toggle-hold") {
      loadPreset("toggle");
      state.stream = ["1", "0", "1", "1"];
    } else if (ch.id === "run-reset") {
      loadPreset("toggle");
      doStep();
      return;
    } else loadPreset("toggle");

    saveSession();
    renderAll();
    setChalStatus("idle", "Setup loaded — finish, then Check");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else ok = !!ch.check(state);
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
    renderLab();
    renderChallenge();
  }

  document.getElementById("preset").addEventListener("change", (e) => {
    loadPreset(e.target.value);
    saveSession();
    renderAll();
  });
  document.getElementById("style").addEventListener("change", (e) => {
    state.machine.style = e.target.value === "mealy" ? "mealy" : "moore";
    resetRun();
    saveSession();
    renderAll();
  });
  document.getElementById("stream").addEventListener("change", (e) => {
    const bits = String(e.target.value).replace(/[^01]/g, "").split("");
    if (bits.length) state.stream = bits;
    resetRun();
    saveSession();
    renderAll();
  });
  document.getElementById("btn-step").addEventListener("click", doStep);
  document.getElementById("btn-reset").addEventListener("click", () => {
    resetRun();
    state.log = ["Run reset → initial state."];
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
  document.getElementById("chal-load").addEventListener("click", loadChallengeSetup);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
