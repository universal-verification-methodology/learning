(() => {
  const STORAGE_KEY = "ddv-fifo-lab-v1";
  const CLEARED_KEY = "ddv-fifo-lab-cleared-v1";

  function hex(n) {
    return "0x" + ((n >>> 0) & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function makeFifo(depth) {
    return {
      depth,
      mem: Array(depth).fill(null),
      wr: 0,
      rd: 0,
      count: 0,
    };
  }

  function flags(f) {
    return {
      empty: f.count === 0,
      full: f.count === f.depth,
      almostFull: f.count === f.depth - 1,
      almostEmpty: f.count === 1,
    };
  }

  function push(f, data) {
    const fl = flags(f);
    if (fl.full) return { ok: false, msg: `PUSH ${hex(data)} blocked — FULL` };
    f.mem[f.wr] = data & 0xff;
    f.wr = (f.wr + 1) % f.depth;
    f.count++;
    return { ok: true, msg: `PUSH ${hex(data)} → wr=${f.wr} count=${f.count}` };
  }

  function pop(f) {
    const fl = flags(f);
    if (fl.empty) return { ok: false, msg: "POP blocked — EMPTY", data: null };
    const data = f.mem[f.rd];
    f.mem[f.rd] = null;
    f.rd = (f.rd + 1) % f.depth;
    f.count--;
    return { ok: true, msg: `POP ${hex(data)} → rd=${f.rd} count=${f.count}`, data };
  }

  const CHALLENGES = [
    {
      id: "quiz-fifo",
      title: "Quiz: FIFO",
      type: "quiz",
      prompt: "FIFO means…",
      hint: "Order.",
      choices: [
        "First-In First-Out — oldest entry is read next",
        "First-In Last-Out (a stack)",
        "random access like RAM",
        "only a clock generator",
      ],
      answer: "First-In First-Out — oldest entry is read next",
    },
    {
      id: "quiz-empty",
      title: "Quiz: empty",
      type: "quiz",
      prompt: "In this count-based model, empty is true when…",
      hint: "count.",
      choices: ["count == 0", "wr == 0 always", "full is also true", "rd == depth"],
      answer: "count == 0",
    },
    {
      id: "quiz-full",
      title: "Quiz: full",
      type: "quiz",
      prompt: "Full is true when…",
      hint: "Occupancy.",
      choices: ["count == DEPTH", "count == 0", "wr == rd only", "mem is all zeros"],
      answer: "count == DEPTH",
    },
    {
      id: "quiz-wr",
      title: "Quiz: write ptr",
      type: "quiz",
      prompt: "On a successful push, the write pointer…",
      hint: "Next slot.",
      choices: [
        "advances to the next slot (mod DEPTH)",
        "always resets to 0",
        "moves backward",
        "clears the read pointer",
      ],
      answer: "advances to the next slot (mod DEPTH)",
    },
    {
      id: "quiz-rd",
      title: "Quiz: read ptr",
      type: "quiz",
      prompt: "On a successful pop, the read pointer…",
      hint: "Consume oldest.",
      choices: [
        "advances (mod DEPTH) after reading the oldest entry",
        "writes a new value",
        "sets full",
        "must equal wr forever",
      ],
      answer: "advances (mod DEPTH) after reading the oldest entry",
    },
    {
      id: "quiz-push-full",
      title: "Quiz: push when full",
      type: "quiz",
      prompt: "Pushing while full should…",
      hint: "Backpressure.",
      choices: [
        "be blocked / ignored (or raise an overflow error in a real design)",
        "silently overwrite random slots",
        "clear empty",
        "halt the clock",
      ],
      answer: "be blocked / ignored (or raise an overflow error in a real design)",
    },
    {
      id: "quiz-pop-empty",
      title: "Quiz: pop when empty",
      type: "quiz",
      prompt: "Popping while empty should…",
      hint: "Underflow.",
      choices: [
        "be blocked / ignored (or raise underflow)",
        "return the write pointer as data",
        "fill the FIFO",
        "always succeed",
      ],
      answer: "be blocked / ignored (or raise underflow)",
    },
    {
      id: "quiz-sync",
      title: "Quiz: sync FIFO",
      type: "quiz",
      prompt: "A synchronous FIFO in this lab means…",
      hint: "One clock domain.",
      choices: [
        "push and pop share one clock domain (behavioral model)",
        "it needs two unrelated clocks always",
        "no pointers are used",
        "it is only asynchronous Gray CDC",
      ],
      answer: "push and pop share one clock domain (behavioral model)",
    },
    {
      id: "run-push-a5",
      title: "Push 0xA5",
      type: "run",
      prompt: "Depth 4, empty: push 0xA5 — count=1, not empty, wr=1, rd=0.",
      hint: "Starter push.",
      check: (s) =>
        s.fifo.depth === 4 &&
        s.fifo.count === 1 &&
        s.fifo.wr === 1 &&
        s.fifo.rd === 0 &&
        s.fifo.mem[0] === 0xa5 &&
        !flags(s.fifo).empty &&
        !flags(s.fifo).full,
    },
    {
      id: "run-fill",
      title: "Fill to full",
      type: "run",
      prompt: "Depth 4: push until full (count=4, full=1).",
      hint: "Four pushes.",
      check: (s) => s.fifo.depth === 4 && s.fifo.count === 4 && flags(s.fifo).full,
    },
    {
      id: "run-push-blocked",
      title: "Push blocked",
      type: "run",
      prompt: "With a full depth-4 FIFO, attempt Push — last log must show blocked FULL.",
      hint: "Fill first, push again.",
      check: (s) =>
        flags(s.fifo).full && s.log[0] && /blocked — FULL/i.test(s.log[0].msg),
    },
    {
      id: "run-pop-a5",
      title: "Pop recovers A5",
      type: "run",
      prompt: "After starter push of 0xA5, Pop once — data 0xA5, empty again, rd=1.",
      hint: "Push then Pop.",
      check: (s) =>
        s.fifo.count === 0 &&
        s.fifo.rd === 1 &&
        flags(s.fifo).empty &&
        s.lastPop === 0xa5,
    },
    {
      id: "run-pop-empty",
      title: "Pop blocked",
      type: "run",
      prompt: "Empty FIFO: Pop — blocked EMPTY in the log.",
      hint: "Reset, then Pop.",
      check: (s) =>
        flags(s.fifo).empty && s.log[0] && /blocked — EMPTY/i.test(s.log[0].msg),
    },
    {
      id: "run-wrap-wr",
      title: "Write wrap",
      type: "run",
      prompt: "Depth 4: push 4 times so wr wraps to 0 and full is set.",
      hint: "wr returns to 0 when full.",
      check: (s) => s.fifo.depth === 4 && s.fifo.wr === 0 && s.fifo.count === 4 && flags(s.fifo).full,
    },
    {
      id: "run-order",
      title: "FIFO order",
      type: "run",
      prompt: "Push 0x11 then 0x22; Pop once — must get 0x11 (oldest first).",
      hint: "Order matters.",
      check: (s) => s.lastPop === 0x11 && s.fifo.count === 1 && s.fifo.mem[s.fifo.rd] === 0x22,
    },
    {
      id: "run-depth8",
      title: "Depth 8",
      type: "run",
      prompt: "Switch to depth 8 and push one byte — count=1, depth=8.",
      hint: "Depth select.",
      check: (s) => s.fifo.depth === 8 && s.fifo.count === 1,
    },
    {
      id: "run-almost-full",
      title: "Almost full",
      type: "run",
      prompt: "Depth 4 with count=3 (one free) — almost-full condition in the UI sense: count === depth-1.",
      hint: "Three pushes.",
      check: (s) => s.fifo.depth === 4 && s.fifo.count === 3 && flags(s.fifo).almostFull,
    },
    {
      id: "run-drain",
      title: "Drain",
      type: "run",
      prompt: "Fill depth 4, then pop 4 times until empty.",
      hint: "Full then drain.",
      check: (s) => s.fifo.depth === 4 && s.fifo.count === 0 && flags(s.fifo).empty,
    },
    {
      id: "quiz-gray",
      title: "Quiz: async note",
      type: "quiz",
      prompt: "Crossing clock domains with a FIFO usually needs…",
      hint: "CDC.",
      choices: [
        "Gray-coded pointers + sync flops (async FIFO) — beyond this sync lab",
        "only a larger DEPTH",
        "blocking assigns",
        "no empty/full flags",
      ],
      answer: "Gray-coded pointers + sync flops (async FIFO) — beyond this sync lab",
    },
    {
      id: "quiz-spare",
      title: "Quiz: spare slot",
      type: "quiz",
      prompt: "Some designs leave one slot unused so full can be detected when…",
      hint: "Without a count.",
      choices: [
        "next write pointer would equal the read pointer",
        "count is never used in any FIFO",
        "wr is always 0",
        "DEPTH is 1 only",
      ],
      answer: "next write pointer would equal the read pointer",
    },
    {
      id: "run-reset",
      title: "Reset empty",
      type: "run",
      prompt: "After any activity, Reset — empty, wr=rd=0, count=0.",
      hint: "Reset button.",
      check: (s) =>
        s.fifo.count === 0 && s.fifo.wr === 0 && s.fifo.rd === 0 && flags(s.fifo).empty,
    },
    {
      id: "run-count-eq",
      title: "Occupancy",
      type: "run",
      prompt: "Have exactly 2 entries in a depth-4 FIFO (count=2).",
      hint: "Two pushes from empty.",
      check: (s) => s.fifo.depth === 4 && s.fifo.count === 2,
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
    din: 0xa5,
    fifo: makeFifo(4),
    log: [],
    lastPop: null,
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.din = 0xa5;
    state.fifo = makeFifo(4);
    state.log = [{ ok: true, msg: "Starter: depth-4 empty. Push 0xA5 to see wr advance and empty clear." }];
    state.lastPop = null;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          din: state.din,
          fifo: state.fifo,
          log: state.log.slice(0, 40),
          lastPop: state.lastPop,
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
      if (!d.fifo || ![4, 8].includes(d.fifo.depth)) return false;
      state.din = Number(d.din) & 0xff;
      state.fifo = d.fifo;
      state.log = Array.isArray(d.log) ? d.log : [];
      state.lastPop = d.lastPop != null ? Number(d.lastPop) : null;
      return true;
    } catch {
      return false;
    }
  }

  function doPush() {
    const r = push(state.fifo, state.din);
    state.log.unshift(r);
    if (state.log.length > 40) state.log.length = 40;
    saveSession();
    renderAll();
  }

  function doPop() {
    const r = pop(state.fifo);
    if (r.ok) state.lastPop = r.data;
    state.log.unshift(r);
    if (state.log.length > 40) state.log.length = 40;
    saveSession();
    renderAll();
  }

  const root = document.getElementById("fifo-root");
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
        <h2>Sync FIFO model</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="fifo-controls">
          <div class="fifo-field">
            <label for="depth">Depth</label>
            <select id="depth">
              <option value="4">4</option>
              <option value="8">8</option>
            </select>
          </div>
          <div class="fifo-field">
            <label for="din-hex">Din (hex)</label>
            <input id="din-hex" type="text" spellcheck="false">
          </div>
          <div class="fifo-field">
            <label>&nbsp;</label>
            <div class="tool-actions">
              <button type="button" class="btn btn-secondary" id="btn-push">Push</button>
              <button type="button" class="btn btn-ghost" id="btn-pop">Pop</button>
            </div>
          </div>
        </div>
        <div class="flag-row" id="flags"></div>
        <div class="ptr-legend" id="ptrs"></div>
        <div class="slot-row" id="slots"></div>
        <p class="fifo-meta" id="meta"></p>
        <p class="fifo-meta" style="font-weight:600;color:var(--ink)">Event log</p>
        <ul class="event-log" id="event-log"></ul>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const f = state.fifo;
    const fl = flags(f);
    document.getElementById("starter-note").textContent =
      "Starter example: depth-4 empty FIFO. Push 0xA5 — count becomes 1, empty clears, wr advances.";

    document.getElementById("depth").value = String(f.depth);
    document.getElementById("din-hex").value = hex(state.din);

    document.getElementById("flags").innerHTML = `
      <span class="flag ${fl.empty ? "on empty" : ""}">empty=${fl.empty ? 1 : 0}</span>
      <span class="flag ${fl.full ? "on full" : ""}">full=${fl.full ? 1 : 0}</span>
      <span class="flag ${!fl.empty && !fl.full ? "ok" : ""}">count=${f.count}/${f.depth}</span>
      <span class="flag">almost_full=${fl.almostFull ? 1 : 0}</span>
      <span class="flag">almost_empty=${fl.almostEmpty ? 1 : 0}</span>
    `;

    document.getElementById("ptrs").innerHTML = `
      <span>wr_ptr=<strong>${f.wr}</strong></span>
      <span>rd_ptr=<strong>${f.rd}</strong></span>
      <span>last pop=${state.lastPop == null ? "—" : hex(state.lastPop)}</span>
    `;

    const slots = document.getElementById("slots");
    slots.innerHTML = "";
    for (let i = 0; i < f.depth; i++) {
      const div = document.createElement("div");
      const occ = f.mem[i] != null;
      div.className = "slot" + (occ ? " occupied" : "");
      const both = f.wr === i && f.rd === i;
      let ptrHtml = "";
      if (both) ptrHtml = `<span class="ptr both">WR+RD</span>`;
      else {
        if (f.wr === i) ptrHtml += `<span class="ptr wr">WR</span>`;
        if (f.rd === i) ptrHtml += `<span class="ptr rd">RD</span>`;
      }
      div.innerHTML = `
        ${ptrHtml}
        <span class="idx">[${i}]</span>
        <span class="val">${occ ? hex(f.mem[i]) : "—"}</span>
      `;
      slots.appendChild(div);
    }

    document.getElementById("meta").textContent =
      "Count-based sync model: empty⇔count==0, full⇔count==DEPTH. Pointers wrap mod DEPTH.";

    document.getElementById("event-log").innerHTML = state.log.length
      ? state.log
          .map((e) => `<li class="${e.ok ? "ok" : "bad"}">${e.msg}</li>`)
          .join("")
      : `<li style="color:var(--muted)">No events</li>`;
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
            `<label><input type="radio" name="fifo-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    state.fifo = makeFifo(4);
    state.din = 0xa5;
    state.lastPop = null;
    state.log = [];

    if (ch.id === "run-push-a5") {
      /* empty ready for push */
    } else if (ch.id === "run-fill" || ch.id === "run-push-blocked" || ch.id === "run-wrap-wr") {
      /* user fills */
    } else if (ch.id === "run-pop-a5") {
      push(state.fifo, 0xa5);
      state.log = [{ ok: true, msg: "Setup: pushed 0xA5 — now Pop" }];
    } else if (ch.id === "run-pop-empty" || ch.id === "run-reset") {
      state.log = [{ ok: true, msg: "Setup: empty FIFO" }];
    } else if (ch.id === "run-order") {
      state.din = 0x11;
    } else if (ch.id === "run-depth8") {
      state.fifo = makeFifo(8);
    } else if (ch.id === "run-almost-full") {
      /* three pushes needed */
    } else if (ch.id === "run-drain") {
      for (let i = 0; i < 4; i++) push(state.fifo, 0x10 + i);
      state.log = [{ ok: true, msg: "Setup: filled — now Pop ×4" }];
    } else if (ch.id === "run-count-eq") {
      /* two pushes */
    }
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

  document.getElementById("depth").addEventListener("change", (e) => {
    state.fifo = makeFifo(Number(e.target.value));
    state.lastPop = null;
    state.log = [{ ok: true, msg: `Depth → ${state.fifo.depth} (reset)` }];
    saveSession();
    renderAll();
  });
  document.getElementById("din-hex").addEventListener("change", (e) => {
    const v = parseInt(String(e.target.value).replace(/^0x/i, ""), 16);
    if (!Number.isNaN(v)) {
      state.din = v & 0xff;
      saveSession();
    }
    renderLab();
  });
  document.getElementById("btn-push").addEventListener("click", doPush);
  document.getElementById("btn-pop").addEventListener("click", doPop);
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.fifo = makeFifo(state.fifo.depth);
    state.lastPop = null;
    state.log = [{ ok: true, msg: "Reset — empty" }];
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
