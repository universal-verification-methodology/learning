(() => {
  /**
   * Coverpoint / bins sketch (concept)
   *   Coverpoint → named bins → sample hits → holes remain
   * Starter: nibble cp with bins low/mid/high/top; mid already hit (sample 5)
   */

  /** @typedef {"nibble"|"opcode"|"fifo"} PresetId */

  const PRESETS = {
    nibble: {
      title: "cp_data — nibble bins",
      field: "data[3:0]",
      domain: [0, 15],
      code: `covergroup cg_nibble;
  cp_data: coverpoint data[3:0] {
    bins low  = {[0:3]};
    bins mid  = {[4:7]};
    bins high = {[8:11]};
    bins top  = {[12:15]};
  }
endgroup`,
      bins: [
        { id: "low", label: "low", values: [0, 1, 2, 3] },
        { id: "mid", label: "mid", values: [4, 5, 6, 7] },
        { id: "high", label: "high", values: [8, 9, 10, 11] },
        { id: "top", label: "top", values: [12, 13, 14, 15] },
      ],
      hint: "Four equal bins over a 4-bit field — classic document sketch.",
    },
    opcode: {
      title: "cp_op — named opcodes",
      field: "op",
      domain: [0, 3],
      code: `covergroup cg_op;
  cp_op: coverpoint op {
    bins idle  = {0};
    bins read  = {1};
    bins write = {2};
    bins err   = {3};
  }
endgroup`,
      bins: [
        { id: "idle", label: "idle", values: [0] },
        { id: "read", label: "read", values: [1] },
        { id: "write", label: "write", values: [2] },
        { id: "err", label: "err", values: [3] },
      ],
      hint: "One value per named bin — holes mean that opcode never sampled.",
    },
    fifo: {
      title: "cp_level — FIFO fill",
      field: "level",
      domain: [0, 7],
      code: `covergroup cg_fifo;
  cp_level: coverpoint level {
    bins empty = {0};
    bins low   = {[1:2]};
    bins mid   = {[3:5]};
    bins full  = {7};
    // note: 6 intentionally omitted → ignorable / hole discussion
  }
endgroup`,
      bins: [
        { id: "empty", label: "empty", values: [0] },
        { id: "low", label: "low", values: [1, 2] },
        { id: "mid", label: "mid", values: [3, 4, 5] },
        { id: "full", label: "full", values: [7] },
      ],
      // value 6 is uncovered by any bin
      ignoreValues: [6],
      hint: "level=6 is outside named bins — shows a modeling gap vs a hit hole.",
    },
  };

  function sourceSketch() {
    return `// Coverpoint / bins (document aid — not a coverage DB)
// coverpoint field { bins name = {values}/ {[lo:hi]}; }
// sample(value) → hit matching bin(s)
// hole = defined bin with hit count 0
// % ≈ (# bins with ≥1 hit) / (# bins)
// Cross coverage is out of scope here.`;
  }

  function binForValue(presetId, value) {
    const p = PRESETS[presetId];
    return p.bins.find((b) => b.values.includes(value)) || null;
  }

  function makeStarter() {
    const hits = { low: 0, mid: 1, high: 0, top: 0 };
    return {
      preset: "nibble",
      lastSample: 5,
      lastBin: "mid",
      hits,
      samples: 1,
      ignored: false,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-cover-bins-cleared-v1";
  const STORE_KEY = "ddv-cover-bins-session-v1";

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

  const root = document.getElementById("cb-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> nibble coverpoint with bins
        <code>low/mid/high/top</code>; sample <code>5</code> already hit <code>mid</code>.
        Sample more values to close holes.</p>
      <button type="button" class="btn btn-secondary" id="cb-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Coverpoint</h3><p>A field (or expression) you care about.</p></div>
        <div class="idea-card"><h3>Bins</h3><p>Named buckets over that field’s values.</p></div>
        <div class="idea-card"><h3>Sample</h3><p>A observed value hits one bin.</p></div>
        <div class="idea-card"><h3>Hole</h3><p>A defined bin never hit yet.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="cb-controls">
        <div class="cb-field">
          <label for="sel-preset">Coverpoint preset</label>
          <select id="sel-preset">
            <option value="nibble" selected>Nibble bins</option>
            <option value="opcode">Named opcodes</option>
            <option value="fifo">FIFO level</option>
          </select>
        </div>
        <div class="cb-field">
          <label for="inp-val">Sample value</label>
          <input id="inp-val" type="number" min="0" max="15" value="5">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-sample">Sample</button>
        <button type="button" class="btn btn-ghost" id="btn-hit-low">Hit low hole</button>
        <button type="button" class="btn btn-ghost" id="btn-close-all">Close all bins</button>
        <button type="button" class="btn btn-ghost" id="btn-clear">Clear hits</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo holes</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="cb-layout">
        <div class="panel-box">
          <h3>Covergroup sketch</h3>
          <pre class="cg-code" id="cg-code"></pre>
          <p id="preset-hint" style="font-size:0.88rem;margin:0;color:var(--muted)"></p>
        </div>
        <div class="panel-box">
          <h3>Bins</h3>
          <p class="sample-flash" id="sample-flash">last: —</p>
          <div class="bin-grid" id="bin-grid"></div>
          <p class="hole-list" id="hole-list"></p>
        </div>
      </div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Literacy sketch</h3>
      <pre class="code-box" id="code-box"></pre>
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
  const inpVal = /** @type {HTMLInputElement} */ (document.getElementById("inp-val"));

  function preset() {
    return PRESETS[state.preset] || PRESETS.nibble;
  }

  function emptyHits() {
    const h = {};
    preset().bins.forEach((b) => {
      h[b.id] = 0;
    });
    return h;
  }

  function hitCount() {
    return preset().bins.filter((b) => (state.hits[b.id] || 0) > 0).length;
  }

  function holeIds() {
    return preset()
      .bins.filter((b) => !(state.hits[b.id] > 0))
      .map((b) => b.id);
  }

  function coveragePct() {
    const n = preset().bins.length;
    return n ? Math.round((100 * hitCount()) / n) : 0;
  }

  function syncInputs() {
    selPreset.value = state.preset;
    if (state.lastSample != null) inpVal.value = String(state.lastSample);
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
    pushLog("# starter nibble mid hit");
    pushTrace("sample=5 → mid");
    renderAll();
  }

  function loadPreset() {
    state.preset = selPreset.value in PRESETS ? selPreset.value : "nibble";
    state.hits = emptyHits();
    state.lastSample = null;
    state.lastBin = null;
    state.samples = 0;
    state.ignored = false;
    state.lastAction = "load";
    const [lo] = preset().domain;
    inpVal.value = String(lo);
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function doSample(raw) {
    const p = preset();
    const [lo, hi] = p.domain;
    let v = Number(raw);
    if (Number.isNaN(v)) v = lo;
    v = Math.max(lo, Math.min(hi, Math.floor(v)));
    state.samples += 1;
    state.lastSample = v;
    inpVal.value = String(v);

    if (p.ignoreValues && p.ignoreValues.includes(v)) {
      state.lastBin = null;
      state.ignored = true;
      state.lastAction = "sample-ignore";
      pushTrace(`sample=${v} → (no bin)`);
      pushLog(`# ${v} outside named bins`);
      renderAll();
      return;
    }

    const bin = binForValue(state.preset, v);
    if (!bin) {
      state.lastBin = null;
      state.ignored = true;
      state.lastAction = "sample-miss";
      pushTrace(`sample=${v} → miss`);
      renderAll();
      return;
    }

    state.ignored = false;
    state.lastBin = bin.id;
    state.hits[bin.id] = (state.hits[bin.id] || 0) + 1;
    state.lastAction = "sample";
    pushTrace(`sample=${v} → ${bin.id}`);
    pushLog(`# hit ${bin.id}`);
    renderAll();
  }

  function hitLowHole() {
    if (state.preset !== "nibble" && state.preset !== "fifo" && state.preset !== "opcode") {
      loadStarter();
    }
    const holes = holeIds();
    if (!holes.length) {
      state.lastAction = "no-hole";
      pushTrace("no holes");
      renderAll();
      return;
    }
    const id = holes[0];
    const bin = preset().bins.find((b) => b.id === id);
    doSample(bin.values[0]);
    state.lastAction = "hit-low";
    renderAll();
  }

  function closeAll() {
    preset().bins.forEach((b) => {
      if (!(state.hits[b.id] > 0)) {
        state.hits[b.id] = 1;
        state.samples += 1;
      }
    });
    state.lastAction = "close-all";
    state.lastBin = preset().bins[preset().bins.length - 1].id;
    pushLog("# close all bins");
    pushTrace("all bins ≥1 hit");
    renderAll();
  }

  function clearHits() {
    state.hits = emptyHits();
    state.samples = 0;
    state.lastSample = null;
    state.lastBin = null;
    state.ignored = false;
    state.lastAction = "clear";
    pushLog("# clear hits");
    renderAll();
  }

  function demo() {
    state.preset = "nibble";
    state.hits = { low: 0, mid: 2, high: 0, top: 0 };
    state.lastSample = 6;
    state.lastBin = "mid";
    state.samples = 2;
    state.ignored = false;
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo holes low/high/top");
    pushTrace("holes=[low,high,top]");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "A coverpoint names a field; bins partition interesting values; each sample " +
        "increments a bin. Holes are bins still at zero — targets for new stimulus."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const p = preset();
    const holes = holeIds();
    const pct = coveragePct();
    const maxHit = Math.max(1, ...p.bins.map((b) => state.hits[b.id] || 0));

    document.getElementById("cg-code").textContent = p.code;
    document.getElementById("preset-hint").textContent = p.hint;

    const flash = document.getElementById("sample-flash");
    if (state.lastSample == null) flash.textContent = "last: —";
    else if (state.ignored)
      flash.textContent = `last: ${state.lastSample} → (no named bin)`;
    else flash.textContent = `last: ${state.lastSample} → ${state.lastBin}`;

    const grid = document.getElementById("bin-grid");
    grid.innerHTML = "";
    p.bins.forEach((b) => {
      const hits = state.hits[b.id] || 0;
      const row = document.createElement("div");
      row.className = "bin-row" + (hits ? " is-hit" : " is-hole");
      const w = Math.round((hits / maxHit) * 100);
      row.innerHTML = `
        <span class="name">${b.label}</span>
        <div class="track"><div class="fill" style="width:${hits ? w : 0}%"></div></div>
        <span class="count">${hits}</span>
        <span class="range">${b.values.join(", ")}</span>`;
      grid.appendChild(row);
    });

    document.getElementById("hole-list").textContent = holes.length
      ? `Holes: ${holes.join(", ")}`
      : "Holes: (none — all bins hit)";

    const v = document.getElementById("verdict");
    if (!holes.length && state.samples > 0) {
      v.className = "verdict yes";
      v.textContent = `${p.title} · ${pct}% · ${hitCount()}/${p.bins.length} bins · closed`;
    } else if (holes.length) {
      v.className = "verdict warn";
      v.textContent = `${p.title} · ${pct}% · holes=${holes.length} · samples=${state.samples}`;
    } else {
      v.className = "verdict idle";
      v.textContent = `${p.title} · awaiting samples`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.preset}</span>
      <span class="flag is-on">cov=${pct}%</span>
      <span class="flag">hit=${hitCount()}/${p.bins.length}</span>
      <span class="flag ${holes.length ? "is-bad" : "is-ok"}">holes=${holes.length}</span>
      <span class="flag">samples=${state.samples}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    document.getElementById("code-box").textContent = sourceSketch();
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
          hits: state.hits,
          lastSample: state.lastSample,
          lastBin: state.lastBin,
          samples: state.samples,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-cp",
      title: "Quiz: coverpoint",
      type: "quiz",
      prompt: "A coverpoint usually measures…",
      hint: "Field of interest.",
      choices: [
        "how a field/expression’s values were observed (via bins)",
        "FPGA place-and-route congestion",
        "SDF interconnect delay only",
        "the Makefile target name",
      ],
      answer: "how a field/expression’s values were observed (via bins)",
    },
    {
      id: "quiz-bin",
      title: "Quiz: bin",
      type: "quiz",
      prompt: "A coverage bin is…",
      hint: "Bucket.",
      choices: [
        "a named bucket of values under a coverpoint",
        "a synthesis keep attribute",
        "a clock-domain crossing FIFO",
        "a UVM objection count",
      ],
      answer: "a named bucket of values under a coverpoint",
    },
    {
      id: "quiz-hole",
      title: "Quiz: hole",
      type: "quiz",
      prompt: "A coverage hole means…",
      hint: "Zero hits.",
      choices: [
        "a defined bin that has never been hit",
        "the DUT has no ports",
        "randomize() always fails",
        "the VCD is empty",
      ],
      answer: "a defined bin that has never been hit",
    },
    {
      id: "quiz-sample",
      title: "Quiz: sample",
      type: "quiz",
      prompt: "Sampling a value that matches a bin…",
      hint: "Increment.",
      choices: [
        "increments that bin’s hit count",
        "deletes the covergroup",
        "forces a $finish",
        "clears all other bins",
      ],
      answer: "increments that bin’s hit count",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — nibble, mid hit, holes=3.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.preset === "nibble" &&
        state.hits.mid >= 1 &&
        holeIds().length === 3,
    },
    {
      id: "sample-mid",
      title: "Sample mid",
      prompt: "Sample value 5 — hits mid.",
      hint: "Value 5 → Sample",
      setup: () => {
        loadStarter();
        clearHits();
        doSample(5);
      },
      check: () => state.lastBin === "mid" && state.hits.mid >= 1,
    },
    {
      id: "sample-low",
      title: "Sample low",
      prompt: "Sample 1 — hits low.",
      hint: "Sample 1",
      setup: () => {
        loadStarter();
        doSample(1);
      },
      check: () => state.lastBin === "low",
    },
    {
      id: "sample-top",
      title: "Sample top",
      prompt: "Sample 15 — hits top.",
      hint: "Sample 15",
      setup: () => {
        loadStarter();
        doSample(15);
      },
      check: () => state.lastBin === "top",
    },
    {
      id: "hit-low-btn",
      title: "Hit low hole",
      prompt: "From starter, Hit low hole — low gets a hit.",
      hint: "Hit low hole",
      setup: () => {
        loadStarter();
        hitLowHole();
      },
      check: () => state.hits.low >= 1 && state.lastAction === "hit-low",
    },
    {
      id: "close-all",
      title: "Close all",
      prompt: "Close all bins — holes=0, cov=100%.",
      hint: "Close all bins",
      setup: () => {
        loadStarter();
        closeAll();
      },
      check: () => holeIds().length === 0 && coveragePct() === 100 && state.lastAction === "close-all",
    },
    {
      id: "load-opcode",
      title: "Load opcode",
      prompt: "Load named opcodes preset.",
      hint: "Opcode → Load",
      setup: () => {
        selPreset.value = "opcode";
        loadPreset();
      },
      check: () => state.preset === "opcode" && state.lastAction === "load",
    },
    {
      id: "opcode-read",
      title: "Opcode read",
      prompt: "On opcode, sample 1 — hits read.",
      hint: "Load opcode, sample 1",
      setup: () => {
        selPreset.value = "opcode";
        loadPreset();
        doSample(1);
      },
      check: () => state.preset === "opcode" && state.lastBin === "read",
    },
    {
      id: "load-fifo",
      title: "Load FIFO",
      prompt: "Load FIFO level preset.",
      hint: "FIFO → Load",
      setup: () => {
        selPreset.value = "fifo";
        loadPreset();
      },
      check: () => state.preset === "fifo" && state.lastAction === "load",
    },
    {
      id: "fifo-ignore",
      title: "FIFO gap",
      prompt: "On FIFO, sample 6 — no named bin.",
      hint: "Load fifo, sample 6",
      setup: () => {
        selPreset.value = "fifo";
        loadPreset();
        doSample(6);
      },
      check: () =>
        state.preset === "fifo" && state.ignored && state.lastAction === "sample-ignore",
    },
    {
      id: "fifo-full",
      title: "FIFO full",
      prompt: "On FIFO, sample 7 — hits full.",
      hint: "Sample 7",
      setup: () => {
        selPreset.value = "fifo";
        loadPreset();
        doSample(7);
      },
      check: () => state.lastBin === "full",
    },
    {
      id: "demo",
      title: "Demo holes",
      prompt: "Click Demo holes — mid hit, holes=3.",
      hint: "Demo holes",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.preset === "nibble" &&
        state.hits.mid >= 1 &&
        holeIds().length === 3,
    },
    {
      id: "clear",
      title: "Clear hits",
      prompt: "Clear hits — samples=0, all holes.",
      hint: "Clear hits",
      setup: () => {
        loadStarter();
        clearHits();
      },
      check: () =>
        state.lastAction === "clear" &&
        state.samples === 0 &&
        holeIds().length === preset().bins.length,
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
      id: "cov-starter",
      title: "Coverage %",
      prompt: "Starter coverage is 25% (1 of 4 bins).",
      hint: "Load starter",
      setup: () => loadStarter(),
      check: () => state.preset === "nibble" && coveragePct() === 25,
    },
    {
      id: "code-bins",
      title: "Sketch code",
      prompt: "Nibble covergroup sketch mentions bins mid.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /bins mid/.test(document.getElementById("cg-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions hole.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /hole/i.test(sourceSketch()),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to nibble mid hit.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.preset === "nibble" && state.hits.mid >= 1 && holeIds().length === 3;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="cb-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("cb-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-sample").addEventListener("click", () => doSample(inpVal.value));
  document.getElementById("btn-hit-low").addEventListener("click", () => hitLowHole());
  document.getElementById("btn-close-all").addEventListener("click", () => closeAll());
  document.getElementById("btn-clear").addEventListener("click", () => clearHits());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
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

  loadStarter();
})();
