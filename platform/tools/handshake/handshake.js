(() => {
  const STORAGE_KEY = "ddv-handshake-v1";
  const CLEARED_KEY = "ddv-handshake-cleared-v1";

  const CYCLES = 8;

  const PRESETS = {
    together: {
      label: "Both assert (transfer @0)",
      valid: [1, 0, 0, 0, 0, 0, 0, 0],
      ready: [1, 0, 0, 0, 0, 0, 0, 0],
      data: [0xa5, 0, 0, 0, 0, 0, 0, 0],
    },
    sourceStall: {
      label: "Source stall (valid late)",
      valid: [0, 0, 1, 1, 0, 0, 0, 0],
      ready: [1, 1, 1, 1, 0, 0, 0, 0],
      data: [0, 0, 0x11, 0x11, 0, 0, 0, 0],
    },
    sinkStall: {
      label: "Sink stall (ready late)",
      valid: [1, 1, 1, 0, 0, 0, 0, 0],
      ready: [0, 0, 1, 0, 0, 0, 0, 0],
      data: [0x22, 0x22, 0x22, 0, 0, 0, 0, 0],
    },
    burst: {
      label: "Back-to-back beats",
      valid: [1, 1, 1, 0, 0, 0, 0, 0],
      ready: [1, 1, 1, 0, 0, 0, 0, 0],
      data: [0x10, 0x20, 0x30, 0, 0, 0, 0, 0],
    },
    none: {
      label: "No transfer",
      valid: [1, 1, 0, 0, 0, 0, 0, 0],
      ready: [0, 0, 1, 1, 0, 0, 0, 0],
      data: [0x55, 0x55, 0, 0, 0, 0, 0, 0],
    },
  };

  function transfers(valid, ready) {
    const t = [];
    for (let i = 0; i < valid.length; i++) {
      if (valid[i] && ready[i]) t.push(i);
    }
    return t;
  }

  function hex(n) {
    return "0x" + ((n >>> 0) & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  const CHALLENGES = [
    {
      id: "quiz-fire",
      title: "Quiz: transfer",
      type: "quiz",
      prompt: "In valid/ready handshake, a beat transfers when…",
      hint: "AND.",
      choices: [
        "valid and ready are both 1 in the same cycle",
        "only valid is 1",
        "only ready is 1",
        "the clock stops",
      ],
      answer: "valid and ready are both 1 in the same cycle",
    },
    {
      id: "quiz-valid",
      title: "Quiz: valid",
      type: "quiz",
      prompt: "valid means…",
      hint: "Source.",
      choices: [
        "the source offers data (payload is meaningful this cycle)",
        "the sink must accept forever",
        "reset is asserted",
        "the bus is idle only",
      ],
      answer: "the source offers data (payload is meaningful this cycle)",
    },
    {
      id: "quiz-ready",
      title: "Quiz: ready",
      type: "quiz",
      prompt: "ready means…",
      hint: "Sink.",
      choices: [
        "the sink can accept a beat this cycle",
        "the source must drop valid",
        "data is always X",
        "a cache miss occurred",
      ],
      answer: "the sink can accept a beat this cycle",
    },
    {
      id: "quiz-stall-src",
      title: "Quiz: source stall",
      type: "quiz",
      prompt: "If ready=1 but valid=0…",
      hint: "No offer.",
      choices: [
        "no transfer — source is not offering",
        "a transfer still happens",
        "ready is illegal",
        "data must change",
      ],
      answer: "no transfer — source is not offering",
    },
    {
      id: "quiz-stall-sink",
      title: "Quiz: sink stall",
      type: "quiz",
      prompt: "If valid=1 but ready=0…",
      hint: "Backpressure.",
      choices: [
        "no transfer — sink backpressures; source typically holds data/valid",
        "the beat is lost forever",
        "ready becomes don’t-care",
        "valid must fall immediately always",
      ],
      answer: "no transfer — sink backpressures; source typically holds data/valid",
    },
    {
      id: "quiz-hold",
      title: "Quiz: hold",
      type: "quiz",
      prompt: "While waiting for ready, a well-behaved source usually…",
      hint: "Stability.",
      choices: [
        "holds valid and data stable until the handshake completes",
        "toggles data every half-cycle",
        "drives Z on the bus",
        "clears the sink FIFO",
      ],
      answer: "holds valid and data stable until the handshake completes",
    },
    {
      id: "quiz-axi",
      title: "Quiz: where used",
      type: "quiz",
      prompt: "valid/ready-style handshakes appear in…",
      hint: "AXI stream, etc.",
      choices: [
        "many on-chip streaming / AXI-Stream style interfaces (conceptual here)",
        "only TTL RS-232",
        "only SPICE netlists",
        "Gray code counters only",
      ],
      answer: "many on-chip streaming / AXI-Stream style interfaces (conceptual here)",
    },
    {
      id: "quiz-combo",
      title: "Quiz: combo ready",
      type: "quiz",
      prompt: "A common implementation rule is…",
      hint: "Avoid combo loops.",
      choices: [
        "avoid combinatorial paths that make ready depend on valid in a loop (teaching caution)",
        "ready must equal valid always",
        "valid must be async reset only",
        "no clocks are allowed",
      ],
      answer: "avoid combinatorial paths that make ready depend on valid in a loop (teaching caution)",
    },
    {
      id: "run-together",
      title: "Transfer @0",
      type: "run",
      prompt: "Load “Both assert” preset — cycle 0 must be a transfer (valid∧ready).",
      hint: "Starter.",
      check: (s) => s.valid[0] === 1 && s.ready[0] === 1 && transfers(s.valid, s.ready)[0] === 0,
    },
    {
      id: "run-count1",
      title: "One beat",
      type: "run",
      prompt: "Together preset: exactly one transfer in the window.",
      hint: "Only cycle 0.",
      check: (s) => transfers(s.valid, s.ready).length === 1,
    },
    {
      id: "run-source-stall",
      title: "Source stall xfer",
      type: "run",
      prompt: "Source-stall preset: first transfer at cycle 2.",
      hint: "Valid rises at 2.",
      check: (s) => {
        const t = transfers(s.valid, s.ready);
        return t.length >= 1 && t[0] === 2;
      },
    },
    {
      id: "run-sink-stall",
      title: "Sink stall xfer",
      type: "run",
      prompt: "Sink-stall preset: transfer when ready finally rises (cycle 2).",
      hint: "Valid held, ready late.",
      check: (s) => transfers(s.valid, s.ready).includes(2) && s.valid[0] === 1 && s.ready[0] === 0,
    },
    {
      id: "run-burst3",
      title: "Three beats",
      type: "run",
      prompt: "Back-to-back preset: exactly 3 transfers.",
      hint: "Burst.",
      check: (s) => transfers(s.valid, s.ready).length === 3,
    },
    {
      id: "run-none",
      title: "Zero transfers",
      type: "run",
      prompt: "“No transfer” preset: valid and ready never both 1.",
      hint: "Misaligned.",
      check: (s) => transfers(s.valid, s.ready).length === 0,
    },
    {
      id: "run-toggle-make",
      title: "Make a beat",
      type: "run",
      prompt: "From No-transfer preset, toggle signals so cycle 1 transfers (valid=ready=1).",
      hint: "Click cells.",
      check: (s) => s.valid[1] === 1 && s.ready[1] === 1,
    },
    {
      id: "run-step-xfer",
      title: "Step onto xfer",
      type: "run",
      prompt: "Together preset: Step until the current cycle is a transfer cycle.",
      hint: "Cycle 0.",
      check: (s) => s.cycle === 0 && s.valid[0] && s.ready[0],
    },
    {
      id: "run-data",
      title: "Data on beat",
      type: "run",
      prompt: "Together preset: transferred data on cycle 0 is 0xA5.",
      hint: "Starter data.",
      check: (s) => s.valid[0] && s.ready[0] && (s.data[0] & 0xff) === 0xa5,
    },
    {
      id: "run-edit-data",
      title: "Change data",
      type: "run",
      prompt: "Set data on a transfer cycle to 0x7E (any cycle where valid∧ready).",
      hint: "Data hex field + ensure handshake.",
      check: (s) => {
        const t = transfers(s.valid, s.ready);
        return t.some((i) => (s.data[i] & 0xff) === 0x7e);
      },
    },
    {
      id: "quiz-fire-eq",
      title: "Quiz: fire",
      type: "quiz",
      prompt: "Transfer / “fire” is often written…",
      hint: "Boolean.",
      choices: ["fire = valid && ready", "fire = valid ^ ready", "fire = !clk", "fire = tag == index"],
      answer: "fire = valid && ready",
    },
    {
      id: "run-two-beats",
      title: "Exactly two",
      type: "run",
      prompt: "Arrange the wave so exactly two cycles transfer (any pattern).",
      hint: "Toggle cells.",
      check: (s) => transfers(s.valid, s.ready).length === 2,
    },
    {
      id: "run-cycle3",
      title: "Cursor cycle 3",
      type: "run",
      prompt: "Step or set focus so current cycle index is 3.",
      hint: "Step button.",
      check: (s) => s.cycle === 3,
    },
    {
      id: "quiz-not-spi",
      title: "Quiz: scope",
      type: "quiz",
      prompt: "This lab is conceptual timing for…",
      hint: "Not full VIP.",
      choices: [
        "valid/ready beat handshakes — not a full AXI VIP or protocol checker",
        "complete PCIe enumeration",
        "analog IBIS models",
        "UVM RAL only",
      ],
      answer: "valid/ready beat handshakes — not a full AXI VIP or protocol checker",
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
    preset: "together",
    valid: PRESETS.together.valid.slice(),
    ready: PRESETS.together.ready.slice(),
    data: PRESETS.together.data.slice(),
    cycle: 0,
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadPreset(id) {
    const p = PRESETS[id] || PRESETS.together;
    state.preset = id;
    state.valid = p.valid.slice();
    state.ready = p.ready.slice();
    state.data = p.data.slice();
    state.cycle = 0;
  }

  function loadStarter() {
    loadPreset("together");
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          preset: state.preset,
          valid: state.valid,
          ready: state.ready,
          data: state.data,
          cycle: state.cycle,
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
      if (!Array.isArray(d.valid) || d.valid.length !== CYCLES) return false;
      state.preset = d.preset || "together";
      state.valid = d.valid.map((x) => (x ? 1 : 0));
      state.ready = d.ready.map((x) => (x ? 1 : 0));
      state.data = d.data.map((x) => Number(x) & 0xff);
      state.cycle = Math.min(CYCLES - 1, Math.max(0, Number(d.cycle) || 0));
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("hs-root");
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
        <h2>Valid / ready wave</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-back">◀</button>
          <button type="button" class="btn btn-secondary" id="btn-step">Step ▶</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="hs-controls">
          <div class="hs-field">
            <label for="preset">Preset</label>
            <select id="preset"></select>
          </div>
          <div class="hs-field">
            <label for="din">Data @ cycle (hex)</label>
            <input id="din" type="text" spellcheck="false">
          </div>
        </div>
        <div class="rule-box">fire = valid &amp;&amp; ready &nbsp;·&nbsp; data accepted only on fire</div>
        <div id="verdict"></div>
        <div class="wave" id="wave"></div>
        <p class="hs-meta" id="meta"></p>
        <p class="hs-meta" style="font-weight:600;color:var(--ink)">Transfers</p>
        <ul class="xfer-log" id="xfer-log"></ul>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    document.getElementById("starter-note").textContent =
      "Starter example: valid=ready=1 on cycle 0 with data 0xA5 — one beat transfers. Toggle cells or try stall presets.";

    const sel = document.getElementById("preset");
    sel.innerHTML = Object.keys(PRESETS)
      .map((k) => `<option value="${k}">${PRESETS[k].label}</option>`)
      .join("");
    sel.value = state.preset;

    document.getElementById("din").value = hex(state.data[state.cycle]);

    const fire = !!(state.valid[state.cycle] && state.ready[state.cycle]);
    document.getElementById("verdict").innerHTML = fire
      ? `<div class="verdict yes">Cycle ${state.cycle}: TRANSFER ${hex(state.data[state.cycle])}</div>`
      : `<div class="verdict no">Cycle ${state.cycle}: no transfer</div>`;

    const xfers = transfers(state.valid, state.ready);
    let head = "<tr><th></th>";
    for (let i = 0; i < CYCLES; i++) head += `<th>c${i}</th>`;
    head += "</tr>";

    const rowBits = (lab, arr, key) => {
      let cells = `<td class="lab">${lab}</td>`;
      for (let i = 0; i < CYCLES; i++) {
        const on = arr[i];
        const cur = i === state.cycle ? " cur" : "";
        const xfer = key !== "data" && state.valid[i] && state.ready[i] ? " xfer" : on ? " hi" : "";
        if (key === "data") {
          cells += `<td class="${cur}${state.valid[i] && state.ready[i] ? " xfer" : ""}">${hex(state.data[i]).slice(2)}</td>`;
        } else {
          cells += `<td class="btn-cell${cur}${xfer}"><button type="button" class="tog ${on ? "on" : ""}" data-k="${key}" data-i="${i}">${on}</button></td>`;
        }
      }
      return `<tr>${cells}</tr>`;
    };

    const fireRow = (() => {
      let cells = `<td class="lab">fire</td>`;
      for (let i = 0; i < CYCLES; i++) {
        const f = state.valid[i] && state.ready[i];
        cells += `<td class="${i === state.cycle ? "cur" : ""} ${f ? "xfer" : ""}">${f ? 1 : 0}</td>`;
      }
      return `<tr>${cells}</tr>`;
    })();

    document.getElementById("wave").innerHTML = `<table class="wave-table"><thead>${head}</thead><tbody>
      ${rowBits("valid", state.valid, "valid")}
      ${rowBits("ready", state.ready, "ready")}
      ${rowBits("data", state.data, "data")}
      ${fireRow}
    </tbody></table>`;

    document.querySelectorAll("button.tog").forEach((b) => {
      b.addEventListener("click", () => {
        const k = b.dataset.k;
        const i = Number(b.dataset.i);
        state[k][i] = state[k][i] ? 0 : 1;
        state.preset = "custom";
        saveSession();
        renderAll();
      });
    });

    document.getElementById("meta").textContent = `${xfers.length} transfer(s) in window · click valid/ready cells to toggle`;

    document.getElementById("xfer-log").innerHTML = xfers.length
      ? xfers.map((i) => `<li class="ok">c${i}: accepted ${hex(state.data[i])}</li>`).join("")
      : `<li style="color:var(--muted)">No transfers yet</li>`;
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
            `<label><input type="radio" name="hs-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    state.cycle = 0;
    if (ch.id === "run-source-stall") loadPreset("sourceStall");
    else if (ch.id === "run-sink-stall") loadPreset("sinkStall");
    else if (ch.id === "run-burst3") loadPreset("burst");
    else if (ch.id === "run-none" || ch.id === "run-toggle-make") loadPreset("none");
    else if (ch.id === "run-two-beats") {
      loadPreset("together");
      state.valid = [1, 1, 0, 0, 0, 0, 0, 0];
      state.ready = [1, 0, 0, 0, 0, 0, 0, 0];
      state.preset = "custom";
    } else if (ch.id === "run-cycle3") {
      loadPreset("together");
      state.cycle = 0;
    } else if (ch.id === "run-edit-data") {
      loadPreset("together");
    } else loadPreset("together");

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
  document.getElementById("din").addEventListener("change", (e) => {
    const v = parseInt(String(e.target.value).replace(/^0x/i, ""), 16);
    if (!Number.isNaN(v)) {
      state.data[state.cycle] = v & 0xff;
      state.preset = "custom";
      saveSession();
      renderAll();
    } else renderLab();
  });
  document.getElementById("btn-step").addEventListener("click", () => {
    state.cycle = (state.cycle + 1) % CYCLES;
    saveSession();
    renderAll();
  });
  document.getElementById("btn-back").addEventListener("click", () => {
    state.cycle = (state.cycle + CYCLES - 1) % CYCLES;
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
