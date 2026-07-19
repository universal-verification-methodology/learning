(() => {
  const STORAGE_KEY = "ddv-cache-walk-v1";
  const CLEARED_KEY = "ddv-cache-walk-cleared-v1";

  const ADDR_BITS = 8;

  function mask(n) {
    return (1 << n) - 1;
  }

  function toBits(n, w) {
    return (n & mask(w)).toString(2).padStart(w, "0");
  }

  function hex(n, digits) {
    return "0x" + (n >>> 0).toString(16).toUpperCase().padStart(digits, "0");
  }

  function splitAddr(addr, indexBits, offsetBits) {
    const tagBits = ADDR_BITS - indexBits - offsetBits;
    const a = addr & mask(ADDR_BITS);
    const offset = a & mask(offsetBits);
    const index = (a >> offsetBits) & mask(indexBits);
    const tag = (a >> (offsetBits + indexBits)) & mask(tagBits);
    return { addr: a, tag, index, offset, tagBits, indexBits, offsetBits };
  }

  function emptySets(nSets, lineBytes) {
    return Array.from({ length: nSets }, () => ({
      valid: false,
      tag: 0,
      data: Array(lineBytes).fill(0),
    }));
  }

  /** Fake memory: byte at address a is (a * 3 + 0x11) & 0xff for teaching. */
  function memByte(a) {
    return ((a * 3 + 0x11) & 0xff) >>> 0;
  }

  function lineFromMem(base, lineBytes) {
    const data = [];
    for (let i = 0; i < lineBytes; i++) data.push(memByte((base + i) & mask(ADDR_BITS)));
    return data;
  }

  function accessCache(sets, parts, lineBytes, installOnMiss) {
    const set = sets[parts.index];
    const steps = [
      `Decode addr ${hex(parts.addr, 2)} → tag=${toBits(parts.tag, parts.tagBits)} index=${parts.index} offset=${parts.offset}`,
      `Probe set[${parts.index}]: valid=${set.valid ? 1 : 0} tag=${set.valid ? toBits(set.tag, parts.tagBits) : "—"}`,
    ];
    let hit = set.valid && set.tag === parts.tag;
    if (hit) {
      steps.push(`Tag match → HIT; return data[offset]=${hex(set.data[parts.offset], 2)}`);
      return { hit: true, steps, byte: set.data[parts.offset], installed: false };
    }
    steps.push("Tag miss or invalid → MISS");
    let installed = false;
    if (installOnMiss) {
      const base = parts.addr & ~mask(parts.offsetBits);
      set.valid = true;
      set.tag = parts.tag;
      set.data = lineFromMem(base, lineBytes);
      installed = true;
      steps.push(
        `Install line @ ${hex(base, 2)} into set[${parts.index}] (tag=${toBits(parts.tag, parts.tagBits)})`
      );
      steps.push(`Now HIT path would read data[offset]=${hex(set.data[parts.offset], 2)}`);
    }
    return {
      hit: false,
      steps,
      byte: installed ? sets[parts.index].data[parts.offset] : null,
      installed,
    };
  }

  const CHALLENGES = [
    {
      id: "quiz-fields",
      title: "Quiz: three fields",
      type: "quiz",
      prompt: "A cache address is commonly split into…",
      hint: "tag | index | offset.",
      choices: [
        "tag, index (set), and offset (within line)",
        "only a byte enable",
        "opcode and funct",
        "row and column of a DRAM only",
      ],
      answer: "tag, index (set), and offset (within line)",
    },
    {
      id: "quiz-index",
      title: "Quiz: index",
      type: "quiz",
      prompt: "The index field selects…",
      hint: "Which set.",
      choices: ["which set (row) to probe", "the DRAM bank only", "the CPU register", "the offset inside the tag"],
      answer: "which set (row) to probe",
    },
    {
      id: "quiz-tag",
      title: "Quiz: tag",
      type: "quiz",
      prompt: "The tag is compared to…",
      hint: "Stored with the line.",
      choices: [
        "the tag stored in the selected set (if valid)",
        "the program counter only",
        "the offset field",
        "always zero",
      ],
      answer: "the tag stored in the selected set (if valid)",
    },
    {
      id: "quiz-offset",
      title: "Quiz: offset",
      type: "quiz",
      prompt: "The offset picks…",
      hint: "Byte in the line.",
      choices: [
        "which byte/word inside the cache line",
        "which set to use",
        "the main-memory size",
        "the associativity",
      ],
      answer: "which byte/word inside the cache line",
    },
    {
      id: "quiz-direct",
      title: "Quiz: direct-mapped",
      type: "quiz",
      prompt: "In a direct-mapped cache, each set holds…",
      hint: "One way.",
      choices: ["exactly one line (one way)", "as many lines as the tag width", "zero lines", "only dirty bits"],
      answer: "exactly one line (one way)",
    },
    {
      id: "quiz-hit",
      title: "Quiz: hit",
      type: "quiz",
      prompt: "A hit requires…",
      hint: "Valid + tag.",
      choices: [
        "valid bit set and stored tag equals address tag",
        "only the offset to be zero",
        "the cache to be empty",
        "a write-back always",
      ],
      answer: "valid bit set and stored tag equals address tag",
    },
    {
      id: "quiz-conflict",
      title: "Quiz: conflict",
      type: "quiz",
      prompt: "Two addresses with the same index but different tags…",
      hint: "Same set.",
      choices: [
        "map to the same set and can thrash each other (conflict)",
        "always hit together",
        "cannot exist",
        "share one tag",
      ],
      answer: "map to the same set and can thrash each other (conflict)",
    },
    {
      id: "quiz-line",
      title: "Quiz: line size",
      type: "quiz",
      prompt: "With offset width O bits, the line size is…",
      hint: "2^O bytes.",
      choices: ["2^O bytes", "O bytes", "2O sets", "tag width bits"],
      answer: "2^O bytes",
    },
    {
      id: "run-decode-14",
      title: "Decode 0x14",
      type: "run",
      prompt: "Config 2 index / 2 offset bits. Set address to 0x14 (20). Tag must be 1, index 1, offset 0.",
      hint: "Starter decode.",
      check: (s, p) =>
        s.indexBits === 2 &&
        s.offsetBits === 2 &&
        p.addr === 0x14 &&
        p.tag === 1 &&
        p.index === 1 &&
        p.offset === 0,
    },
    {
      id: "run-first-miss",
      title: "First access miss",
      type: "run",
      prompt: "Cold cache: Access 0x14 once — must be a MISS (and install if enabled).",
      hint: "Reset cache, then Access.",
      check: (s) =>
        s.lastAddr === 0x14 && s.lastHit === false && s.sets[1] && s.sets[1].valid,
    },
    {
      id: "run-second-hit",
      title: "Repeat hit",
      type: "run",
      prompt: "After installing 0x14, Access 0x14 again — HIT.",
      hint: "Two accesses to same line.",
      check: (s) => s.lastAddr === 0x14 && s.lastHit === true,
    },
    {
      id: "run-same-line",
      title: "Same line 0x15",
      type: "run",
      prompt: "With 0x14 installed, Access 0x15 (same tag/index, offset 1) — HIT.",
      hint: "Spatial locality in the line.",
      check: (s, p) =>
        s.lastAddr === 0x15 &&
        s.lastHit === true &&
        p.tag === 1 &&
        p.index === 1 &&
        p.offset === 1,
    },
    {
      id: "run-conflict",
      title: "Conflict miss",
      type: "run",
      prompt: "Install 0x14, then Access 0x24 (same index 1, different tag) — MISS.",
      hint: "0x24 → tag 2, index 1.",
      check: (s, p) => s.lastAddr === 0x24 && s.lastHit === false && p.index === 1 && p.tag === 2,
    },
    {
      id: "run-0x00",
      title: "Decode 0x00",
      type: "run",
      prompt: "Address 0: tag=0, index=0, offset=0 (2/2 config).",
      hint: "All zero.",
      check: (s, p) =>
        s.indexBits === 2 && s.offsetBits === 2 && p.addr === 0 && p.tag === 0 && p.index === 0 && p.offset === 0,
    },
    {
      id: "run-0xff",
      title: "Decode 0xFF",
      type: "run",
      prompt: "Address 0xFF with 2/2: tag=15, index=3, offset=3.",
      hint: "All ones.",
      check: (s, p) =>
        s.indexBits === 2 &&
        s.offsetBits === 2 &&
        p.addr === 0xff &&
        p.tag === 15 &&
        p.index === 3 &&
        p.offset === 3,
    },
    {
      id: "run-3index",
      title: "3 index bits",
      type: "run",
      prompt: "Set index bits to 3 (8 sets), offset 2. Address 0x14 → index = (0x14>>2)&7 = 5.",
      hint: "Change Index bits.",
      check: (s, p) => s.indexBits === 3 && s.offsetBits === 2 && p.addr === 0x14 && p.index === 5,
    },
    {
      id: "run-cold-hit-fail",
      title: "Cold never hits",
      type: "run",
      prompt: "Reset cache, Access any address once — last result must be MISS.",
      hint: "Reset then Access.",
      check: (s) => s.lastHit === false && s.accessCount >= 1,
    },
    {
      id: "quiz-capacity",
      title: "Quiz: capacity",
      type: "quiz",
      prompt: "Direct-mapped capacity (bytes) is roughly…",
      hint: "sets × line size.",
      choices: [
        "number of sets × bytes per line",
        "tag width only",
        "always 1 byte",
        "equal to main memory size",
      ],
      answer: "number of sets × bytes per line",
    },
    {
      id: "quiz-valid",
      title: "Quiz: valid",
      type: "quiz",
      prompt: "If valid=0, the access is…",
      hint: "Cold / empty.",
      choices: ["a miss (nothing to compare)", "always a hit", "a soft error only", "ignored by the CPU"],
      answer: "a miss (nothing to compare)",
    },
    {
      id: "run-set0",
      title: "Fill set 0",
      type: "run",
      prompt: "Access 0x00 so set[0] becomes valid with tag 0.",
      hint: "Address 0.",
      check: (s) => s.sets[0] && s.sets[0].valid && s.sets[0].tag === 0,
    },
    {
      id: "run-stats",
      title: "Two hits logged",
      type: "run",
      prompt: "Produce at least 2 HITs in the access log (any addresses).",
      hint: "Repeat accesses after install.",
      check: (s) => s.log.filter((e) => e.hit).length >= 2,
    },
    {
      id: "quiz-assoc",
      title: "Quiz: vs set-assoc",
      type: "quiz",
      prompt: "Compared with set-associative caches, direct-mapped…",
      hint: "One comparator.",
      choices: [
        "is simpler (one tag compare per set) but more conflict misses",
        "never has conflict misses",
        "needs no index field",
        "stores infinite lines per set",
      ],
      answer: "is simpler (one tag compare per set) but more conflict misses",
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
    indexBits: 2,
    offsetBits: 2,
    addr: 0x14,
    installOnMiss: true,
    sets: emptySets(4, 4),
    lastHit: null,
    lastAddr: null,
    lastSteps: [],
    log: [],
    accessCount: 0,
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function lineBytes() {
    return 1 << state.offsetBits;
  }

  function nSets() {
    return 1 << state.indexBits;
  }

  function parts() {
    return splitAddr(state.addr, state.indexBits, state.offsetBits);
  }

  function rebuildSetsKeep() {
    const n = nSets();
    const lb = lineBytes();
    const next = emptySets(n, lb);
    // drop state on geometry change
    state.sets = next;
    state.lastHit = null;
    state.lastAddr = null;
    state.lastSteps = [];
  }

  function loadStarter() {
    state.indexBits = 2;
    state.offsetBits = 2;
    state.addr = 0x14;
    state.installOnMiss = true;
    state.sets = emptySets(4, 4);
    state.lastHit = null;
    state.lastAddr = null;
    state.lastSteps = [
      "Starter: cold cache, addr 0x14 → tag=0001 index=1 offset=0. Press Access for a miss + install.",
    ];
    state.log = [];
    state.accessCount = 0;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          indexBits: state.indexBits,
          offsetBits: state.offsetBits,
          addr: state.addr,
          installOnMiss: state.installOnMiss,
          sets: state.sets,
          log: state.log.slice(0, 30),
          accessCount: state.accessCount,
          lastHit: state.lastHit,
          lastAddr: state.lastAddr,
          lastSteps: state.lastSteps,
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
      if (![2, 3].includes(d.indexBits) || ![1, 2].includes(d.offsetBits)) return false;
      state.indexBits = d.indexBits;
      state.offsetBits = d.offsetBits;
      state.addr = Number(d.addr) & mask(ADDR_BITS);
      state.installOnMiss = d.installOnMiss !== false;
      if (Array.isArray(d.sets) && d.sets.length === nSets()) state.sets = d.sets;
      else state.sets = emptySets(nSets(), lineBytes());
      state.log = Array.isArray(d.log) ? d.log : [];
      state.accessCount = Number(d.accessCount) || 0;
      state.lastHit = d.lastHit === true ? true : d.lastHit === false ? false : null;
      state.lastAddr = d.lastAddr != null ? Number(d.lastAddr) : null;
      state.lastSteps = Array.isArray(d.lastSteps) ? d.lastSteps : [];
      return true;
    } catch {
      return false;
    }
  }

  function doAccess() {
    const p = parts();
    const r = accessCache(state.sets, p, lineBytes(), state.installOnMiss);
    state.lastHit = r.hit;
    state.lastAddr = p.addr;
    state.lastSteps = r.steps;
    state.accessCount++;
    state.log.unshift({
      addr: p.addr,
      hit: r.hit,
      index: p.index,
      tag: p.tag,
      offset: p.offset,
    });
    if (state.log.length > 40) state.log.length = 40;
    saveSession();
    renderAll();
  }

  const root = document.getElementById("cw-root");
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
        <h2>Direct-mapped walk</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-reset">Reset cache</button>
          <button type="button" class="btn btn-secondary" id="btn-access">Access</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="cw-controls">
          <div class="cw-field">
            <label for="idx-bits">Index bits</label>
            <select id="idx-bits">
              <option value="2">2 (4 sets)</option>
              <option value="3">3 (8 sets)</option>
            </select>
          </div>
          <div class="cw-field">
            <label for="off-bits">Offset bits</label>
            <select id="off-bits">
              <option value="1">1 (2 B/line)</option>
              <option value="2">2 (4 B/line)</option>
            </select>
          </div>
          <div class="cw-field">
            <label for="addr-hex">Address (hex)</label>
            <input id="addr-hex" type="text" spellcheck="false">
          </div>
          <div class="cw-field">
            <label for="addr-dec">Address (dec)</label>
            <input id="addr-dec" type="number" min="0" max="255" step="1">
          </div>
          <div class="cw-field">
            <label for="install">On miss</label>
            <select id="install">
              <option value="1">Install line</option>
              <option value="0">Probe only</option>
            </select>
          </div>
        </div>
        <p class="cw-meta" id="geom"></p>
        <div class="addr-bits" id="addr-bits"></div>
        <div class="field-legend" id="field-legend"></div>
        <div id="verdict"></div>
        <ul class="step-list" id="steps"></ul>
        <table class="cache-table" id="cache-table"></table>
        <p class="cw-meta" style="font-weight:600;color:var(--ink)">Access log</p>
        <ul class="access-log" id="access-log"></ul>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const p = parts();
    const lb = lineBytes();
    document.getElementById("starter-note").textContent =
      "Starter example: cold direct-mapped cache, addr 0x14 (tag=1, index=1, offset=0). Access → miss + install; Access again → hit.";

    document.getElementById("idx-bits").value = String(state.indexBits);
    document.getElementById("off-bits").value = String(state.offsetBits);
    document.getElementById("addr-hex").value = hex(state.addr, 2);
    document.getElementById("addr-dec").value = String(state.addr);
    document.getElementById("install").value = state.installOnMiss ? "1" : "0";

    document.getElementById("geom").textContent =
      `${ADDR_BITS}-bit addr · ${p.tagBits}-bit tag · ${state.indexBits}-bit index (${nSets()} sets) · ${state.offsetBits}-bit offset (${lb} B/line) · capacity ${nSets() * lb} B`;

    const bits = toBits(state.addr, ADDR_BITS).split("");
    const tagBits = p.tagBits;
    const elBits = document.getElementById("addr-bits");
    elBits.innerHTML = "";
    bits.forEach((b, i) => {
      const fromMsb = i;
      let cls = "bit ";
      if (fromMsb < tagBits) cls += "tag";
      else if (fromMsb < tagBits + state.indexBits) cls += "idx";
      else cls += "off";
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = b;
      elBits.appendChild(span);
      if (fromMsb === tagBits - 1 || fromMsb === tagBits + state.indexBits - 1) {
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "|";
        elBits.appendChild(sep);
      }
    });

    document.getElementById("field-legend").innerHTML = `
      <span>tag <strong>${toBits(p.tag, p.tagBits)}</strong> (${p.tag})</span>
      <span>index <strong>${p.index}</strong></span>
      <span>offset <strong>${p.offset}</strong></span>
    `;

    const verd = document.getElementById("verdict");
    if (state.lastHit === true) verd.innerHTML = `<div class="verdict hit">HIT @ ${hex(state.lastAddr, 2)}</div>`;
    else if (state.lastHit === false)
      verd.innerHTML = `<div class="verdict miss">MISS @ ${hex(state.lastAddr, 2)}</div>`;
    else verd.innerHTML = `<div class="verdict idle">No access yet</div>`;

    document.getElementById("steps").innerHTML = (state.lastSteps.length ? state.lastSteps : ["Press Access to walk the probe."])
      .map((s, i, arr) => `<li class="${i === arr.length - 1 ? "active" : ""}">${s}</li>`)
      .join("");

    const table = document.getElementById("cache-table");
    table.innerHTML = `
      <thead><tr><th>Set</th><th>V</th><th>Tag</th><th>Data (bytes)</th></tr></thead>
      <tbody>
        ${state.sets
          .map((set, i) => {
            let rowCls = "";
            if (i === p.index) rowCls = state.lastHit ? "hit-row" : "probe";
            const data = set.valid
              ? set.data.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")
              : "—";
            return `<tr class="${rowCls}"><td>${i}</td><td>${set.valid ? 1 : 0}</td><td>${
              set.valid ? toBits(set.tag, p.tagBits) : "—"
            }</td><td class="data">${data}</td></tr>`;
          })
          .join("")}
      </tbody>
    `;

    document.getElementById("access-log").innerHTML = state.log.length
      ? state.log
          .map(
            (e) =>
              `<li><span class="${e.hit ? "hit" : "miss"}">${e.hit ? "HIT" : "MISS"}</span> ${hex(
                e.addr,
                2
              )} · set ${e.index} tag ${e.tag} off ${e.offset}</li>`
          )
          .join("")
      : `<li style="color:var(--muted)">Empty</li>`;
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
            `<label><input type="radio" name="cw-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
    state.indexBits = 2;
    state.offsetBits = 2;
    state.installOnMiss = true;
    state.sets = emptySets(4, 4);
    state.log = [];
    state.accessCount = 0;
    state.lastHit = null;
    state.lastAddr = null;
    state.lastSteps = [];
    state.addr = 0x14;

    if (ch.id === "run-decode-14" || ch.id === "run-first-miss") state.addr = 0x14;
    else if (ch.id === "run-second-hit") {
      state.addr = 0x14;
      doAccess();
      return;
    } else if (ch.id === "run-same-line") {
      state.addr = 0x14;
      accessCache(state.sets, parts(), 4, true);
      state.addr = 0x15;
    } else if (ch.id === "run-conflict") {
      state.addr = 0x14;
      accessCache(state.sets, parts(), 4, true);
      state.addr = 0x24;
    } else if (ch.id === "run-0x00" || ch.id === "run-set0") state.addr = 0;
    else if (ch.id === "run-0xff") state.addr = 0xff;
    else if (ch.id === "run-3index") {
      state.indexBits = 3;
      state.sets = emptySets(8, 4);
      state.addr = 0x14;
    } else if (ch.id === "run-cold-hit-fail") state.addr = 0x14;
    else if (ch.id === "run-stats") {
      state.addr = 0x14;
      doAccess();
      doAccess();
      return;
    }
    saveSession();
    renderAll();
    setChalStatus("idle", "Setup loaded — finish, then Check");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else ok = !!ch.check(state, parts());
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

  function setAddr(n) {
    state.addr = n & mask(ADDR_BITS);
    saveSession();
    renderAll();
  }

  document.getElementById("idx-bits").addEventListener("change", (e) => {
    state.indexBits = Number(e.target.value);
    rebuildSetsKeep();
    saveSession();
    renderAll();
  });
  document.getElementById("off-bits").addEventListener("change", (e) => {
    state.offsetBits = Number(e.target.value);
    rebuildSetsKeep();
    saveSession();
    renderAll();
  });
  document.getElementById("addr-hex").addEventListener("change", (e) => {
    const v = parseInt(String(e.target.value).replace(/^0x/i, ""), 16);
    if (!Number.isNaN(v)) setAddr(v);
    else renderLab();
  });
  document.getElementById("addr-dec").addEventListener("change", (e) => {
    setAddr(Number(e.target.value) || 0);
  });
  document.getElementById("install").addEventListener("change", (e) => {
    state.installOnMiss = e.target.value === "1";
    saveSession();
  });
  document.getElementById("btn-access").addEventListener("click", doAccess);
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.sets = emptySets(nSets(), lineBytes());
    state.lastHit = null;
    state.lastAddr = null;
    state.lastSteps = ["Cache cleared (all valid=0)."];
    state.log = [];
    state.accessCount = 0;
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
