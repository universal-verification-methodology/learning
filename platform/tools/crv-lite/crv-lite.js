(() => {
  /**
   * Constraint / random lite (concept)
   *   Pick a constraint preset → legal set → randomize() with seed
   *   Histogram of rolls; conflict preset shows fail
   * Starter: data inside {[0:15]}, seed 42, one legal sample
   */

  /** @typedef {"range"|"aligned"|"pair"|"conflict"} PresetId */

  const PRESETS = {
    range: {
      title: "Range — inside {[0:15]}",
      code: `class Pkt;
  rand bit [7:0] data;
  constraint c_range { data inside {[0:15]}; }
endclass`,
      domainMax: 255,
      legal: () => {
        const a = [];
        for (let i = 0; i <= 15; i++) a.push(i);
        return a;
      },
      solvable: true,
      hint: "Only 16 of 256 values are legal.",
    },
    aligned: {
      title: "Aligned — addr % 4 == 0",
      code: `class BusTxn;
  rand bit [7:0] addr;
  constraint c_align { addr % 4 == 0; }
endclass`,
      domainMax: 255,
      legal: () => {
        const a = [];
        for (let i = 0; i <= 255; i += 4) a.push(i);
        return a;
      },
      solvable: true,
      hint: "Word-aligned addresses only.",
    },
    pair: {
      title: "Pair — len inside {[1:4]}; data < len",
      code: `class Pair;
  rand bit [2:0] len;
  rand bit [2:0] data;
  constraint c_pair {
    len inside {[1:4]};
    data < len;
  }
endclass`,
      domainMax: 7,
      // encode as (len<<3)|data for dice display; legal pairs listed
      legalPairs: [
        [1, 0],
        [2, 0],
        [2, 1],
        [3, 0],
        [3, 1],
        [3, 2],
        [4, 0],
        [4, 1],
        [4, 2],
        [4, 3],
      ],
      legal: () => PRESETS.pair.legalPairs.map(([l, d]) => (l << 3) | d),
      decode: (v) => ({ len: (v >> 3) & 7, data: v & 7 }),
      format: (v) => {
        const { len, data } = PRESETS.pair.decode(v);
        return `len=${len},data=${data}`;
      },
      solvable: true,
      hint: "Two rand fields with a relation — still a tiny discrete set.",
    },
    conflict: {
      title: "Conflict — impossible",
      code: `class Bad;
  rand bit [3:0] x;
  constraint c_a { x inside {[0:3]}; }
  constraint c_b { x inside {[12:15]}; }
endclass`,
      domainMax: 15,
      legal: () => [],
      solvable: false,
      hint: "Overlapping hard constraints with empty intersection → randomize fails.",
    },
  };

  function sourceSketch() {
    return `// CRV lite (not a full solver)
// 1) declare rand fields
// 2) write constraint { ... }
// 3) randomize() → 1 = success, 0 = fail
// 4) fix seed for reproducible dice
// Legal set is discrete here — real CRV uses a constraint solver.`;
  }

  /** Mulberry32 */
  function makeRng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeStarter() {
    const legal = PRESETS.range.legal();
    const rng = makeRng(42);
    const sample = legal[Math.floor(rng() * legal.length)];
    return {
      preset: "range",
      seed: 42,
      sample,
      ok: true,
      hist: { [sample]: 1 },
      rolls: 1,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-crv-lite-cleared-v1";
  const STORE_KEY = "ddv-crv-lite-session-v1";

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
  let rng = makeRng(state.seed);

  const root = document.getElementById("crv-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>data inside {[0:15]}</code>,
        seed <code>42</code>, one legal roll already in the histogram.</p>
      <button type="button" class="btn btn-secondary" id="crv-starter">Load starter example</button>
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
        <div class="idea-card"><h3>rand</h3><p>Fields the solver may assign.</p></div>
        <div class="idea-card"><h3>constraint</h3><p>Legal region over those fields.</p></div>
        <div class="idea-card"><h3>randomize()</h3><p>1 = ok sample; 0 = unsat / fail.</p></div>
        <div class="idea-card"><h3>seed</h3><p>Same seed → same dice stream.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="crv-controls">
        <div class="crv-field">
          <label for="sel-preset">Constraint preset</label>
          <select id="sel-preset">
            <option value="range" selected>Range {[0:15]}</option>
            <option value="aligned">Aligned addr%4==0</option>
            <option value="pair">Pair len/data</option>
            <option value="conflict">Conflict (fail)</option>
          </select>
        </div>
        <div class="crv-field">
          <label for="inp-seed">Seed</label>
          <input id="inp-seed" type="number" min="0" step="1" value="42">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-rand">randomize()</button>
        <button type="button" class="btn btn-ghost" id="btn-roll10">Roll ×10</button>
        <button type="button" class="btn btn-ghost" id="btn-reseed">Apply seed</button>
        <button type="button" class="btn btn-ghost" id="btn-clear-hist">Clear hist</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo fail</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="crv-layout">
        <div class="panel-box">
          <h3>Constraint</h3>
          <pre class="constraint-code" id="constraint-code"></pre>
          <p id="preset-hint" style="font-size:0.88rem;margin:0 0 0.4rem;color:var(--muted)"></p>
          <h3 style="margin:0.5rem 0 0.35rem;font-size:0.9rem">Legal set</h3>
          <div class="legal-chips" id="legal-chips"></div>
        </div>
        <div class="panel-box">
          <h3>Dice / sample</h3>
          <div class="dice">
            <div class="dice-face" id="dice-face">—</div>
            <div class="dice-meta" id="dice-meta"></div>
          </div>
          <h3 style="margin:0.75rem 0 0.35rem;font-size:0.9rem">Histogram</h3>
          <div class="hist" id="hist-box"></div>
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
  const inpSeed = /** @type {HTMLInputElement} */ (document.getElementById("inp-seed"));

  function preset() {
    return PRESETS[state.preset] || PRESETS.range;
  }

  function legalList() {
    return preset().legal();
  }

  function formatSample(v) {
    const p = preset();
    if (typeof p.format === "function") return p.format(v);
    return String(v);
  }

  function syncInputs() {
    selPreset.value = state.preset;
    inpSeed.value = String(state.seed);
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

  function bumpHist(v) {
    state.hist[v] = (state.hist[v] || 0) + 1;
  }

  function loadStarter() {
    state = makeStarter();
    rng = makeRng(state.seed);
    // consume the same first draw used in makeStarter so next rolls continue stream
    rng();
    syncInputs();
    pushLog("# starter range seed=42");
    pushTrace(`sample=${state.sample} ok=1`);
    renderAll();
  }

  function loadPreset() {
    state.preset = selPreset.value in PRESETS ? selPreset.value : "range";
    state.seed = Number(inpSeed.value) || 0;
    rng = makeRng(state.seed);
    state.hist = {};
    state.rolls = 0;
    state.sample = null;
    state.ok = null;
    state.lastAction = "load";
    pushLog(`# load ${state.preset} seed=${state.seed}`);
    renderAll();
  }

  function applySeed() {
    state.seed = Number(inpSeed.value) || 0;
    rng = makeRng(state.seed);
    state.lastAction = "reseed";
    pushTrace(`seed=${state.seed}`);
    pushLog(`# apply seed ${state.seed}`);
    renderAll();
  }

  function doRandomize() {
    const p = preset();
    const legal = legalList();
    state.rolls += 1;
    if (!p.solvable || !legal.length) {
      state.ok = false;
      state.sample = null;
      state.lastAction = "rand-fail";
      pushTrace("randomize() → 0");
      pushLog("# randomize fail");
      renderAll();
      return;
    }
    const idx = Math.floor(rng() * legal.length);
    state.sample = legal[idx];
    state.ok = true;
    bumpHist(state.sample);
    state.lastAction = "rand";
    pushTrace(`randomize() → 1  sample=${formatSample(state.sample)}`);
    pushLog(`# sample ${formatSample(state.sample)}`);
    renderAll();
  }

  function roll10() {
    for (let i = 0; i < 10; i++) doRandomize();
    state.lastAction = "roll10";
    renderAll();
  }

  function clearHist() {
    state.hist = {};
    if (state.ok && state.sample != null) bumpHist(state.sample);
    state.lastAction = "clear-hist";
    pushLog("# clear hist");
    renderAll();
  }

  function demo() {
    state.preset = "conflict";
    state.seed = 7;
    rng = makeRng(7);
    state.hist = {};
    state.rolls = 1;
    state.sample = null;
    state.ok = false;
    state.demoed = true;
    state.lastAction = "demo";
    syncInputs();
    pushLog("# demo conflict fail");
    pushTrace("randomize() → 0 (empty legal set)");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "rand marks variables; constraint { } carves a legal set; randomize() picks " +
        "a legal sample (1) or fails (0). Seeds make the dice reproducible. This lab " +
        "enumerates tiny sets — real CRV uses a solver."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const p = preset();
    const legal = legalList();

    document.getElementById("constraint-code").textContent = p.code;
    document.getElementById("preset-hint").textContent = p.hint;

    const chips = document.getElementById("legal-chips");
    chips.innerHTML = "";
    if (!legal.length) {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = "(empty)";
      chips.appendChild(span);
    } else {
      const show = legal.length > 32 ? legal.slice(0, 32) : legal;
      show.forEach((v) => {
        const span = document.createElement("span");
        span.className = "chip" + (state.sample === v ? " is-hit" : "");
        span.textContent = formatSample(v);
        chips.appendChild(span);
      });
      if (legal.length > 32) {
        const more = document.createElement("span");
        more.className = "chip";
        more.textContent = `+${legal.length - 32} more`;
        chips.appendChild(more);
      }
    }

    const face = document.getElementById("dice-face");
    const meta = document.getElementById("dice-meta");
    if (state.ok === false) {
      face.className = "dice-face is-fail";
      face.textContent = "∅";
      meta.textContent = "randomize() → 0 (no legal sample)";
    } else if (state.sample == null) {
      face.className = "dice-face";
      face.textContent = "—";
      meta.textContent = "Click randomize() to roll";
    } else {
      face.className = "dice-face";
      face.textContent =
        state.preset === "pair" ? formatSample(state.sample) : String(state.sample);
      if (state.preset === "pair") face.style.fontSize = "0.75rem";
      else face.style.fontSize = "1.6rem";
      meta.textContent = `randomize() → 1 · ${formatSample(state.sample)} · rolls=${state.rolls}`;
    }

    const histEl = document.getElementById("hist-box");
    histEl.innerHTML = "";
    const keys = Object.keys(state.hist)
      .map(Number)
      .sort((a, b) => a - b);
    const max = keys.reduce((m, k) => Math.max(m, state.hist[k]), 0) || 1;
    if (!keys.length) {
      histEl.textContent = "// empty";
    } else {
      keys.slice(0, 48).forEach((k) => {
        const wrap = document.createElement("div");
        wrap.className = "hist-bar";
        const h = Math.max(4, Math.round((state.hist[k] / max) * 64));
        wrap.innerHTML = `<div class="bar" style="height:${h}px"></div><span class="lbl">${
          state.preset === "pair" ? k : k
        }</span>`;
        histEl.appendChild(wrap);
      });
    }

    const v = document.getElementById("verdict");
    if (state.ok === false) {
      v.className = "verdict no";
      v.textContent = `${p.title} · unsat · legal=0 · rolls=${state.rolls}`;
    } else if (state.ok === true) {
      v.className = "verdict yes";
      v.textContent = `${p.title} · ok · legal=${legal.length} · last=${formatSample(state.sample)}`;
    } else {
      v.className = "verdict idle";
      v.textContent = `${p.title} · legal=${legal.length} · awaiting randomize()`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.preset}</span>
      <span class="flag is-on">seed=${state.seed}</span>
      <span class="flag">legal=${legal.length}</span>
      <span class="flag ${state.ok === true ? "is-ok" : state.ok === false ? "is-bad" : ""}">ok=${
        state.ok === null ? "—" : state.ok ? 1 : 0
      }</span>
      <span class="flag">rolls=${state.rolls}</span>
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
          seed: state.seed,
          sample: state.sample,
          ok: state.ok,
          hist: state.hist,
          rolls: state.rolls,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-rand",
      title: "Quiz: rand",
      type: "quiz",
      prompt: "A rand field is…",
      hint: "Solver input.",
      choices: [
        "a variable the randomize() solver may assign",
        "always a wire in the DUT",
        "only legal in always_comb",
        "a synthesis keep attribute",
      ],
      answer: "a variable the randomize() solver may assign",
    },
    {
      id: "quiz-ok",
      title: "Quiz: return",
      type: "quiz",
      prompt: "randomize() returning 1 means…",
      hint: "Success.",
      choices: [
        "a legal sample was found",
        "the DUT passed timing",
        "coverage hit 100%",
        "the seed was invalid",
      ],
      answer: "a legal sample was found",
    },
    {
      id: "quiz-fail",
      title: "Quiz: fail",
      type: "quiz",
      prompt: "randomize() returning 0 usually means…",
      hint: "Unsat.",
      choices: [
        "no value satisfies the constraints (or solver failed)",
        "the clock stopped",
        "VCD dump overflow",
        "the factory override worked",
      ],
      answer: "no value satisfies the constraints (or solver failed)",
    },
    {
      id: "quiz-seed",
      title: "Quiz: seed",
      type: "quiz",
      prompt: "Fixing the RNG seed helps…",
      hint: "Reproduce.",
      choices: [
        "reproduce the same random stream for debug",
        "increase FPGA LUTs",
        "bypass reset",
        "disable assertions",
      ],
      answer: "reproduce the same random stream for debug",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — range, seed 42, ok=1.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.preset === "range" &&
        state.seed === 42 &&
        state.ok === true &&
        state.sample != null &&
        state.sample <= 15,
    },
    {
      id: "rand-once",
      title: "randomize()",
      prompt: "Click randomize() — lastAction rand and ok=1.",
      hint: "randomize() button",
      setup: () => {
        loadStarter();
        doRandomize();
      },
      check: () => state.lastAction === "rand" && state.ok === true,
    },
    {
      id: "in-range",
      title: "In range",
      prompt: "After a roll on range preset, sample is 0..15.",
      hint: "Starter or randomize",
      setup: () => loadStarter(),
      check: () =>
        state.preset === "range" &&
        state.sample != null &&
        state.sample >= 0 &&
        state.sample <= 15,
    },
    {
      id: "load-aligned",
      title: "Load aligned",
      prompt: "Load aligned preset.",
      hint: "Preset → Aligned → Load",
      setup: () => {
        loadStarter();
        selPreset.value = "aligned";
        loadPreset();
      },
      check: () => state.preset === "aligned" && state.lastAction === "load",
    },
    {
      id: "aligned-legal",
      title: "Aligned legal",
      prompt: "On aligned, randomize — sample % 4 == 0.",
      hint: "Load aligned, randomize",
      setup: () => {
        selPreset.value = "aligned";
        loadPreset();
        doRandomize();
      },
      check: () =>
        state.preset === "aligned" && state.ok && state.sample != null && state.sample % 4 === 0,
    },
    {
      id: "load-pair",
      title: "Load pair",
      prompt: "Load pair preset.",
      hint: "Pair → Load",
      setup: () => {
        selPreset.value = "pair";
        loadPreset();
      },
      check: () => state.preset === "pair" && state.lastAction === "load",
    },
    {
      id: "pair-ok",
      title: "Pair relation",
      prompt: "On pair, randomize — data < len.",
      hint: "Load pair, randomize",
      setup: () => {
        selPreset.value = "pair";
        loadPreset();
        doRandomize();
      },
      check: () => {
        if (!(state.preset === "pair" && state.ok && state.sample != null)) return false;
        const { len, data } = PRESETS.pair.decode(state.sample);
        return data < len && len >= 1 && len <= 4;
      },
    },
    {
      id: "demo-fail",
      title: "Demo fail",
      prompt: "Click Demo fail — conflict, ok=0.",
      hint: "Demo fail",
      setup: () => loadStarter(),
      check: () =>
        state.demoed && state.preset === "conflict" && state.ok === false && state.lastAction === "demo",
    },
    {
      id: "conflict-load",
      title: "Conflict load",
      prompt: "Load conflict preset — legal=0.",
      hint: "Conflict → Load",
      setup: () => {
        selPreset.value = "conflict";
        loadPreset();
      },
      check: () => state.preset === "conflict" && legalList().length === 0,
    },
    {
      id: "conflict-rand",
      title: "Conflict rand",
      prompt: "On conflict, randomize() → fail.",
      hint: "Load conflict, randomize",
      setup: () => {
        selPreset.value = "conflict";
        loadPreset();
        doRandomize();
      },
      check: () => state.preset === "conflict" && state.ok === false && state.lastAction === "rand-fail",
    },
    {
      id: "roll10",
      title: "Roll ×10",
      prompt: "Roll ×10 on range — rolls increase by 10 from a fresh load.",
      hint: "Load range, Roll ×10",
      setup: () => {
        selPreset.value = "range";
        loadPreset();
        const before = state.rolls;
        for (let i = 0; i < 10; i++) doRandomize();
        state.lastAction = "roll10";
        state._before = before;
      },
      check: () => state.lastAction === "roll10" && state.rolls >= 10 && state.ok === true,
    },
    {
      id: "reseed",
      title: "Apply seed",
      prompt: "Set seed to 99 and Apply seed.",
      hint: "Seed 99 → Apply seed",
      setup: () => {
        loadStarter();
        inpSeed.value = "99";
        applySeed();
      },
      check: () => state.seed === 99 && state.lastAction === "reseed",
    },
    {
      id: "clear-hist",
      title: "Clear hist",
      prompt: "Clear hist (keeps last sample bucket if ok).",
      hint: "Clear hist",
      setup: () => {
        loadStarter();
        clearHist();
      },
      check: () => state.lastAction === "clear-hist",
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
      id: "legal-count",
      title: "Legal count",
      prompt: "Range preset has exactly 16 legal values.",
      hint: "Starter range",
      setup: () => loadStarter(),
      check: () => state.preset === "range" && legalList().length === 16,
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions randomize().",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /randomize\(\)/.test(sourceSketch()),
    },
    {
      id: "code-inside",
      title: "Constraint code",
      prompt: "Range constraint code shows inside {[0:15]}.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /inside\s*\{\s*\[0:15\]\s*\}/.test(
          document.getElementById("constraint-code").textContent
        ),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to range / seed 42 / ok.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.preset === "range" && state.seed === 42 && state.ok === true;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="crv-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("crv-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-rand").addEventListener("click", () => doRandomize());
  document.getElementById("btn-roll10").addEventListener("click", () => {
    for (let i = 0; i < 10; i++) doRandomize();
    state.lastAction = "roll10";
    renderAll();
  });
  document.getElementById("btn-reseed").addEventListener("click", () => applySeed());
  document.getElementById("btn-clear-hist").addEventListener("click", () => clearHist());
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
