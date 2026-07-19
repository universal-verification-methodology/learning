(() => {
  const STORAGE_KEY = "ddv-mem-map-v1";
  const CLEARED_KEY = "ddv-mem-map-cleared-v1";
  const DEPTH = 16;
  const WIDTH = 8;
  const MASK = (1 << WIDTH) - 1;

  const STARTER_HEX = `// $readmemh-style image (addr @ optional)
@00
DE
AD
BE
EF
01
02
03
04`;

  function padHex(n, digits) {
    return (n & MASK).toString(16).toUpperCase().padStart(digits, "0");
  }

  function parseHexByte(tok) {
    const t = String(tok).replace(/^0x/i, "").replace(/_/g, "");
    if (!/^[0-9a-fA-F]+$/.test(t)) return null;
    return parseInt(t, 16) & MASK;
  }

  /** Minimal $readmemh subset: optional @addr, then hex words. */
  function readmemh(text, mem) {
    const out = mem.slice();
    let addr = 0;
    const lines = String(text).split(/\r?\n/);
    for (let line of lines) {
      line = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (!line) continue;
      const parts = line.split(/[\s,]+/).filter(Boolean);
      for (const p of parts) {
        if (p.startsWith("@")) {
          const a = parseInt(p.slice(1), 16);
          if (!Number.isFinite(a)) throw new Error("Bad @addr: " + p);
          addr = a & (DEPTH - 1);
          continue;
        }
        const v = parseHexByte(p);
        if (v == null) throw new Error("Bad hex: " + p);
        if (addr >= DEPTH) throw new Error("Address out of range");
        out[addr] = v;
        addr++;
      }
    }
    return out;
  }

  function freshMem(fill = 0) {
    return Array(DEPTH).fill(fill & MASK);
  }

  const CHALLENGES = [
    {
      id: "quiz-ram-vs-rom",
      title: "Quiz: RAM vs ROM",
      type: "quiz",
      prompt: "In this lab, ROM mode means…",
      hint: "Writes blocked.",
      choices: [
        "runtime writes are rejected; init via $readmemh-style load",
        "reads are illegal",
        "addresses are decimal only",
        "DEPTH must be 1",
      ],
      answer: "runtime writes are rejected; init via $readmemh-style load",
    },
    {
      id: "quiz-readmemh",
      title: "Quiz: $readmemh",
      type: "quiz",
      prompt: "$readmemh typically loads…",
      hint: "Hex file into an array.",
      choices: [
        "hexadecimal words into a memory array",
        "only ASCII strings into $display",
        "VCD waveforms",
        "SDF timing",
      ],
      answer: "hexadecimal words into a memory array",
    },
    {
      id: "quiz-at",
      title: "Quiz: @addr",
      type: "quiz",
      prompt: "In a readmemh dump, @0A means…",
      hint: "Set load address.",
      choices: [
        "next data word goes to address 0x0A",
        "delete address 10",
        "stop the simulation",
        "set timescale",
      ],
      answer: "next data word goes to address 0x0A",
    },
    {
      id: "quiz-addr-width",
      title: "Quiz: address bits",
      type: "quiz",
      prompt: "A 16-word memory needs how many address bits?",
      hint: "$clog2(16).",
      choices: ["4", "8", "16", "2"],
      answer: "4",
    },
    {
      id: "quiz-word",
      title: "Quiz: word vs byte",
      type: "quiz",
      prompt: "Here each address selects one…",
      hint: "WIDTH=8.",
      choices: ["8-bit word", "32-bit instruction only", "page table", "flop"],
      answer: "8-bit word",
    },
    {
      id: "run-read0",
      title: "Read addr 0",
      type: "run",
      prompt: "After starter load, read address 0 — data should be 0xDE.",
      hint: "Load starter, set addr=0, Read.",
      check: (s) => s.lastOp === "read" && s.addr === 0 && s.data === 0xde,
    },
    {
      id: "run-read3",
      title: "Read addr 3",
      type: "run",
      prompt: "Read address 3 → 0xEF (starter image).",
      hint: "addr=3.",
      check: (s) => s.lastOp === "read" && s.addr === 3 && s.data === 0xef,
    },
    {
      id: "run-write-ram",
      title: "Write RAM",
      type: "run",
      prompt: "RAM mode: write 0x55 to address 5, then confirm mem[5]=0x55.",
      hint: "Mode RAM · addr 5 · data 55 · Write.",
      check: (s) => s.kind === "ram" && s.mem[5] === 0x55 && s.lastOp === "write" && s.addr === 5,
    },
    {
      id: "run-rom-block",
      title: "ROM blocks write",
      type: "run",
      prompt: "Switch to ROM and attempt a write — status should report blocked.",
      hint: "Mode ROM · Write.",
      check: (s) => s.kind === "rom" && s.lastMsg.includes("blocked"),
    },
    {
      id: "run-load-aa",
      title: "Load @08 AA",
      type: "run",
      prompt: "In hex dump put `@08` then `AA`, Load $readmemh — mem[8]=0xAA.",
      hint: "Edit dump, Load.",
      check: (s) => s.mem[8] === 0xaa,
    },
    {
      id: "run-clear",
      title: "Clear memory",
      type: "run",
      prompt: "Clear all cells to 00.",
      hint: "Clear button.",
      check: (s) => s.mem.every((v) => v === 0) && s.lastOp === "clear",
    },
    {
      id: "run-click-cell",
      title: "Select by cell",
      type: "run",
      prompt: "Click cell address 0x0C (12) so the address field is 12.",
      hint: "Click the grid cell.",
      check: (s) => s.addr === 12,
    },
    {
      id: "run-write-ff",
      title: "Write 0xFF",
      type: "run",
      prompt: "RAM: write FF to addr 0.",
      hint: "data=FF, Write.",
      check: (s) => s.kind === "ram" && s.mem[0] === 0xff && s.lastOp === "write",
    },
    {
      id: "run-read-after-write",
      title: "Read after write",
      type: "run",
      prompt: "Write 0x42 to addr 7, then Read addr 7.",
      hint: "Write then Read same addr.",
      check: (s) => s.mem[7] === 0x42 && s.lastOp === "read" && s.addr === 7 && s.data === 0x42,
    },
    {
      id: "quiz-init",
      title: "Quiz: power-up",
      type: "quiz",
      prompt: "ROM contents in silicon are typically…",
      hint: "Manufactured / imaged.",
      choices: [
        "fixed at manufacture or programmed as non-volatile image",
        "rewritten every clock by default",
        "the same as a latch enable",
        "only in $finish",
      ],
      answer: "fixed at manufacture or programmed as non-volatile image",
    },
    {
      id: "quiz-ram-rw",
      title: "Quiz: RAM",
      type: "quiz",
      prompt: "RAM allows…",
      hint: "Both directions.",
      choices: ["read and write at runtime", "read only forever", "write only", "no addressing"],
      answer: "read and write at runtime",
    },
    {
      id: "run-starter",
      title: "Reload starter",
      type: "run",
      prompt: "Load starter example so addr0..3 are DE AD BE EF.",
      hint: "Load starter example button.",
      check: (s) => s.mem[0] === 0xde && s.mem[1] === 0xad && s.mem[2] === 0xbe && s.mem[3] === 0xef,
    },
    {
      id: "run-seq-write",
      title: "Fill 0..3",
      type: "run",
      prompt: "RAM: set mem[0]=01, [1]=02, [2]=03, [3]=04.",
      hint: "Four writes (or edit dump + load).",
      check: (s) => s.mem[0] === 1 && s.mem[1] === 2 && s.mem[2] === 3 && s.mem[3] === 4,
    },
    {
      id: "quiz-endian",
      title: "Quiz: address order",
      type: "quiz",
      prompt: "After @00 then bytes A B C, address 1 contains…",
      hint: "Sequential fill.",
      choices: ["B", "A", "C", "@"],
      answer: "B",
    },
    {
      id: "quiz-depth",
      title: "Quiz: DEPTH",
      type: "quiz",
      prompt: "This explorer’s DEPTH is…",
      hint: "Count cells.",
      choices: ["16 words", "256 words", "8 words", "1 word"],
      answer: "16 words",
    },
    {
      id: "run-rom-load",
      title: "ROM init load",
      type: "run",
      prompt: "ROM mode: Load a dump with `@0F` `A5` — mem[15]=0xA5.",
      hint: "ROM still allows readmemh init.",
      check: (s) => s.kind === "rom" && s.mem[15] === 0xa5,
    },
    {
      id: "run-bus-data",
      title: "Data bus shows",
      type: "run",
      prompt: "Read any cell so the data field matches that cell’s value.",
      hint: "Click cell or Read.",
      check: (s) => s.lastOp === "read" && s.data === s.mem[s.addr],
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
    kind: "ram", // ram | rom
    mem: freshMem(),
    addr: 0,
    data: 0,
    hexDump: STARTER_HEX,
    lastOp: "",
    lastMsg: "",
    flash: { addr: -1, kind: "" },
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.kind = "ram";
    state.hexDump = STARTER_HEX;
    state.mem = readmemh(STARTER_HEX, freshMem());
    state.addr = 0;
    state.data = state.mem[0];
    state.lastOp = "load";
    state.lastMsg = "Starter $readmemh image loaded";
    flash(0, "wr");
  }

  function flash(addr, kind) {
    state.flash = { addr, kind };
    setTimeout(() => {
      if (state.flash.addr === addr) {
        state.flash = { addr: -1, kind: "" };
        renderGrid();
      }
    }, 450);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          kind: state.kind,
          mem: state.mem,
          addr: state.addr,
          data: state.data,
          hexDump: state.hexDump,
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
      if (!Array.isArray(d.mem) || d.mem.length !== DEPTH) return false;
      state.kind = d.kind === "rom" ? "rom" : "ram";
      state.mem = d.mem.map((v) => v & MASK);
      state.addr = (d.addr | 0) & (DEPTH - 1);
      state.data = (d.data | 0) & MASK;
      state.hexDump = d.hexDump || STARTER_HEX;
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("mm-root");
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
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>Memory</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-clear">Clear</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="mm-controls">
          <div class="mm-field">
            <label for="kind-sel">Type</label>
            <select id="kind-sel">
              <option value="ram">RAM (R/W)</option>
              <option value="rom">ROM (read + $readmemh)</option>
            </select>
          </div>
          <div class="mm-field">
            <label for="addr-in">Address (0–15)</label>
            <input id="addr-in" type="number" min="0" max="15" value="0">
          </div>
          <div class="mm-field">
            <label for="data-in">Data (hex)</label>
            <input id="data-in" type="text" value="00">
          </div>
          <div class="tool-actions" style="align-self:end">
            <button type="button" class="btn btn-secondary" id="btn-read">Read</button>
            <button type="button" class="btn btn-primary" id="btn-write">Write</button>
          </div>
        </div>
        <div class="bus-bar" id="bus-bar"></div>
        <div class="mem-grid" id="grid"></div>
        <div class="mm-field">
          <label for="hex-dump">$readmemh dump</label>
          <textarea id="hex-dump"></textarea>
        </div>
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="btn-load">Load $readmemh</button>
        </div>
        <pre class="log-box" id="log"></pre>
        <p class="mm-meta">DEPTH=${DEPTH} · WIDTH=${WIDTH} · addr width 4 bits · click a cell to select address</p>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function log(msg) {
    state.lastMsg = msg;
    const el = document.getElementById("log");
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
    el.scrollTop = el.scrollHeight;
  }

  function renderGrid() {
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    for (let i = 0; i < DEPTH; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "mem-cell";
      if (state.kind === "rom") cell.classList.add("rom-locked");
      if (i === state.addr) cell.classList.add("active");
      if (state.flash.addr === i) cell.classList.add(state.flash.kind === "wr" ? "flash-wr" : "flash-rd");
      cell.innerHTML = `<span class="addr">@${padHex(i, 2)}</span><span class="val">${padHex(state.mem[i], 2)}</span>`;
      cell.addEventListener("click", () => {
        state.addr = i;
        state.data = state.mem[i];
        saveSession();
        renderLab();
      });
      grid.appendChild(cell);
    }
  }

  function renderLab() {
    document.getElementById("starter-note").textContent =
      "Starter example: 16×8 RAM loaded with DE AD BE EF at @00 via a $readmemh-style dump.";
    document.getElementById("kind-sel").value = state.kind;
    document.getElementById("addr-in").value = String(state.addr);
    document.getElementById("data-in").value = padHex(state.data, 2);
    document.getElementById("hex-dump").value = state.hexDump;
    document.getElementById("bus-bar").textContent =
      `${state.kind.toUpperCase()} · addr=${padHex(state.addr, 2)} (${state.addr}) · data=${padHex(state.data, 2)} · mem[addr]=${padHex(state.mem[state.addr], 2)}`;
    document.getElementById("btn-write").disabled = state.kind === "rom";
    renderGrid();
  }

  function doRead() {
    state.addr = Math.min(DEPTH - 1, Math.max(0, Number(document.getElementById("addr-in").value) | 0));
    state.data = state.mem[state.addr];
    state.lastOp = "read";
    flash(state.addr, "rd");
    log(`read  mem[${padHex(state.addr, 2)}] -> ${padHex(state.data, 2)}`);
    saveSession();
    renderLab();
  }

  function doWrite() {
    state.addr = Math.min(DEPTH - 1, Math.max(0, Number(document.getElementById("addr-in").value) | 0));
    const raw = document.getElementById("data-in").value.trim();
    const v = parseHexByte(raw);
    if (v == null) {
      state.lastOp = "error";
      log("write blocked: bad data hex");
      renderLab();
      return;
    }
    if (state.kind === "rom") {
      state.lastOp = "write";
      state.data = v;
      log(`write blocked (ROM) @${padHex(state.addr, 2)} <- ${padHex(v, 2)}`);
      renderLab();
      return;
    }
    state.data = v;
    state.mem[state.addr] = v;
    state.lastOp = "write";
    flash(state.addr, "wr");
    log(`write mem[${padHex(state.addr, 2)}] <- ${padHex(v, 2)}`);
    saveSession();
    renderLab();
  }

  function doLoad() {
    try {
      state.hexDump = document.getElementById("hex-dump").value;
      state.mem = readmemh(state.hexDump, freshMem(0));
      state.lastOp = "load";
      log("$readmemh load ok");
      flash(0, "wr");
      saveSession();
      renderLab();
    } catch (e) {
      state.lastOp = "error";
      log("load error: " + (e.message || e));
    }
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
            `<label><input type="radio" name="mm-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("kind-sel").addEventListener("change", (e) => {
    state.kind = e.target.value;
    saveSession();
    renderLab();
  });
  document.getElementById("addr-in").addEventListener("change", (e) => {
    state.addr = Math.min(DEPTH - 1, Math.max(0, Number(e.target.value) | 0));
    saveSession();
    renderLab();
  });
  document.getElementById("data-in").addEventListener("change", (e) => {
    const v = parseHexByte(e.target.value);
    if (v != null) state.data = v;
    saveSession();
    renderLab();
  });
  document.getElementById("hex-dump").addEventListener("change", (e) => {
    state.hexDump = e.target.value;
    saveSession();
  });
  document.getElementById("btn-read").addEventListener("click", doRead);
  document.getElementById("btn-write").addEventListener("click", doWrite);
  document.getElementById("btn-load").addEventListener("click", doLoad);
  document.getElementById("btn-clear").addEventListener("click", () => {
    state.mem = freshMem(0);
    state.lastOp = "clear";
    log("clear -> all 00");
    saveSession();
    renderLab();
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    document.getElementById("log").textContent = "";
    log(state.lastMsg);
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

  if (!restoreSession()) loadStarter();
  else state.lastMsg = "Session restored";
  document.getElementById("log").textContent = state.lastMsg || "";
  renderAll();
})();
