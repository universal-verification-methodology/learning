(() => {
  /**
   * File / vector I/O (concept)
   *   $readmemh stim/exp hex → apply loop → pass/fail
   * Starter: and2 four vectors from stim.hex / exp.hex
   */

  const DEPTH = 8;

  /** @typedef {"and2"|"or2"|"add4"} DutId */

  const DUTS = {
    and2: {
      title: "and2",
      decode: (w) => ({ a: w & 1, b: (w >> 1) & 1 }),
      model: (d) => (d.a & d.b) & 1,
      fmt: (d, got, exp) => `a=${d.a} b=${d.b} y=${got} exp=${exp}`,
      hint: "stim byte: bit0=a, bit1=b; expect is y.",
    },
    or2: {
      title: "or2",
      decode: (w) => ({ a: w & 1, b: (w >> 1) & 1 }),
      model: (d) => (d.a | d.b) & 1,
      fmt: (d, got, exp) => `a=${d.a} b=${d.b} y=${got} exp=${exp}`,
      hint: "Same packing as and2; golden is OR.",
    },
    add4: {
      title: "add4",
      decode: (w) => ({ x: w & 0xf, y: (w >> 4) & 0xf }),
      model: (d) => (d.x + d.y) & 0xf,
      fmt: (d, got, exp) => `x=${d.x} y=${d.y} sum=${got} exp=${exp}`,
      hint: "stim: low nibble x, high nibble y; expect is sum[3:0].",
    },
  };

  const PRESETS = {
    starter: {
      label: "starter and2 (4 vectors)",
      dut: "and2",
      stim: `// stim.hex — bit0=a bit1=b
01
02
03
00`,
      exp: `// exp.hex — expected y
00
00
01
00`,
      cursor: 0,
    },
    and2_fail: {
      label: "and2 wrong expect",
      dut: "and2",
      stim: `03
01`,
      exp: `00
00`,
      cursor: 0,
    },
    with_at: {
      label: "@addr skip then load",
      dut: "and2",
      stim: `@02
03
00`,
      exp: `@02
01
00`,
      cursor: 2,
    },
    or2_ok: {
      label: "or2 vectors",
      dut: "or2",
      stim: `01
02
03
00`,
      exp: `01
01
01
00`,
      cursor: 0,
    },
    add4_ok: {
      label: "add4 pack",
      dut: "add4",
      stim: `12
FF
00`,
      exp: `03
0E
00`,
      cursor: 0,
    },
  };

  function sourceSketch() {
    return `// File / vector I/O literacy (not a full filesystem)
// reg [7:0] stim [0:DEPTH-1];
// reg [7:0] exp  [0:DEPTH-1];
// initial begin
//   $readmemh("stim.hex", stim);
//   $readmemh("exp.hex",  exp);
//   for (i = 0; i < N; i++) begin
//     apply(stim[i]);           // drive DUT inputs
//     #1;
//     if (dut_out !== exp[i]) $error("FAIL @%0d", i);
//   end
// end
// $readmemb loads binary digits; @addr sets next write index.
// Separating vectors from TB code scales regression stimulus.`;
  }

  /** Minimal $readmemh subset: optional @addr, hex words, // comments. */
  function readmemh(text, depth) {
    const out = Array(depth).fill(0);
    let addr = 0;
    let count = 0;
    const lines = String(text).split(/\r?\n/);
    for (let line of lines) {
      line = line.replace(/\/\/.*$/, "").trim();
      if (!line) continue;
      const parts = line.split(/[\s,]+/).filter(Boolean);
      for (const p of parts) {
        if (p.startsWith("@")) {
          const a = parseInt(p.slice(1), 16);
          if (!Number.isFinite(a)) throw new Error("Bad @addr: " + p);
          addr = a & (depth - 1);
          continue;
        }
        const t = p.replace(/^0x/i, "").replace(/_/g, "");
        if (!/^[0-9a-fA-F]+$/.test(t)) throw new Error("Bad hex: " + p);
        if (addr >= depth) throw new Error("Address out of range");
        out[addr] = parseInt(t, 16) & 0xff;
        addr++;
        count++;
      }
    }
    return { mem: out, count };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      dut: p.dut,
      stimText: p.stim,
      expText: p.exp,
      stim: Array(DEPTH).fill(0),
      exp: Array(DEPTH).fill(0),
      loaded: false,
      applied: [],
      cursor: p.cursor,
      lastAction: "starter",
      explained: false,
      demoed: false,
      loadError: null,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-file-vector-io-cleared-v1";
  const STORE_KEY = "ddv-file-vector-io-session-v1";

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

  const root = document.getElementById("fvio-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> four <code>and2</code> vectors from
        <code>stim.hex</code> / <code>exp.hex</code> — only <code>03</code> expects <code>y=1</code>.</p>
      <button type="button" class="btn btn-secondary" id="fvio-starter">Load starter example</button>
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
        <div class="idea-card"><h3>$readmemh</h3><p>Load hex words from a file into a memory / vector array.</p></div>
        <div class="idea-card"><h3>@addr</h3><p>Optional address marker — next word starts at that index.</p></div>
        <div class="idea-card"><h3>Apply loop</h3><p>Drive DUT from <code>stim[i]</code>, compare to <code>exp[i]</code>.</p></div>
        <div class="idea-card"><h3>Separate data</h3><p>Vectors live in files so TB code stays small and reusable.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="fvio-controls">
        <div class="fvio-field">
          <label for="sel-preset">File preset</label>
          <select id="sel-preset">
            <option value="starter" selected>starter and2</option>
            <option value="and2_fail">and2 wrong expect</option>
            <option value="with_at">@addr skip</option>
            <option value="or2_ok">or2 vectors</option>
            <option value="add4_ok">add4 pack</option>
          </select>
        </div>
        <div class="fvio-field">
          <label for="sel-dut">DUT model</label>
          <select id="sel-dut">
            <option value="and2">and2</option>
            <option value="or2">or2</option>
            <option value="add4">add4</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load-preset">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-readmem">$readmemh</button>
        <button type="button" class="btn btn-secondary" id="btn-apply-one">Apply one</button>
        <button type="button" class="btn btn-secondary" id="btn-apply-all">Apply all</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step cursor</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo FAIL</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="fvio-layout">
        <div class="panel-box">
          <h3>stim.hex</h3>
          <textarea class="file-ta" id="ta-stim" spellcheck="false"></textarea>
          <h3 style="margin-top:0.65rem">exp.hex</h3>
          <textarea class="file-ta" id="ta-exp" spellcheck="false"></textarea>
        </div>
        <div class="panel-box">
          <h3>After $readmemh</h3>
          <div id="mem-box"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>TB sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:18rem"></pre>
          <p id="dut-hint" style="font-size:0.88rem;margin:0.45rem 0 0;color:var(--muted)"></p>
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
  const selDut = /** @type {HTMLSelectElement} */ (document.getElementById("sel-dut"));
  const taStim = /** @type {HTMLTextAreaElement} */ (document.getElementById("ta-stim"));
  const taExp = /** @type {HTMLTextAreaElement} */ (document.getElementById("ta-exp"));

  function dut() {
    return DUTS[state.dut] || DUTS.and2;
  }

  function tbSketch() {
    return `reg [7:0] stim [0:${DEPTH - 1}];
reg [7:0] exp  [0:${DEPTH - 1}];
integer i;
initial begin
  $readmemh("stim.hex", stim);
  $readmemh("exp.hex",  exp);
  for (i = 0; i < N; i = i + 1) begin
    // decode stim[i] → ${dut().title} inputs
    #1;
    if (out !== exp[i]) $error("FAIL i=%0d", i);
  end
end
// cursor=${state.cursor} loaded=${state.loaded ? 1 : 0}`;
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

  function syncTextAreas() {
    taStim.value = state.stimText;
    taExp.value = state.expText;
    selDut.value = state.dut;
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
  }

  function pullTextAreas() {
    state.stimText = taStim.value;
    state.expText = taExp.value;
    state.dut = selDut.value in DUTS ? selDut.value : "and2";
  }

  function doReadmem() {
    pullTextAreas();
    try {
      const s = readmemh(state.stimText, DEPTH);
      const e = readmemh(state.expText, DEPTH);
      state.stim = s.mem;
      state.exp = e.mem;
      state.stimCount = s.count;
      state.expCount = e.count;
      state.loaded = true;
      state.loadError = null;
      state.applied = [];
      state.lastAction = "readmem";
      pushLog(`# $readmemh stim=${s.count} exp=${e.count}`);
      pushTrace(`loaded stim words=${s.count} exp words=${e.count}`);
    } catch (err) {
      state.loaded = false;
      state.loadError = String(err.message || err);
      state.lastAction = "readmem-err";
      pushLog(`# ERROR ${state.loadError}`);
    }
    renderAll();
  }

  function applyAt(idx) {
    if (!state.loaded) return null;
    const d = dut().decode(state.stim[idx]);
    const got = dut().model(d);
    const exp = state.exp[idx] & 0xff;
    const ok = got === exp;
    const row = { idx, got, exp, ok, label: dut().fmt(d, got, exp) };
    const others = state.applied.filter((r) => r.idx !== idx);
    state.applied = [...others, row].sort((a, b) => a.idx - b.idx);
    return row;
  }

  function applyOne() {
    if (!state.loaded) {
      doReadmem();
      if (!state.loaded) return;
    }
    const row = applyAt(state.cursor);
    state.lastAction = "apply-one";
    if (row) {
      pushTrace(`${row.ok ? "PASS" : "FAIL"} @${row.idx} ${row.label}`);
      pushLog(`# apply one @${row.idx}`);
    }
    renderAll();
  }

  function applyAll() {
    if (!state.loaded) {
      doReadmem();
      if (!state.loaded) return;
    }
    const n = Math.max(state.stimCount || 0, state.expCount || 0, 1);
    state.applied = [];
    for (let i = 0; i < n && i < DEPTH; i++) applyAt(i);
    state.lastAction = "apply-all";
    const fails = state.applied.filter((r) => !r.ok).length;
    pushTrace(`apply all N=${n} fails=${fails}`);
    pushLog(`# apply all fails=${fails}`);
    renderAll();
  }

  function summary() {
    if (state.loadError) return { status: "error", text: state.loadError };
    if (!state.loaded) return { status: "idle", text: "edit files → $readmemh → apply" };
    if (!state.applied.length) return { status: "idle", text: "loaded — Apply one/all" };
    const fails = state.applied.filter((r) => !r.ok);
    if (fails.length)
      return { status: "fail", text: `FAIL — ${fails.length} mismatch(es); first @${fails[0].idx}` };
    return { status: "pass", text: `PASS — ${state.applied.length} vector(s) matched` };
  }

  function loadStarter() {
    state = makeStarter();
    syncTextAreas();
    doReadmem();
    state.lastAction = "starter";
    applyAll();
    state.lastAction = "starter";
    pushLog("# starter and2 4 vectors");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.dut = p.dut;
    state.stimText = p.stim;
    state.expText = p.exp;
    state.cursor = p.cursor;
    state.applied = [];
    state.loaded = false;
    state.loadError = null;
    state.lastAction = "load";
    syncTextAreas();
    pushLog(`# load preset ${id}`);
    renderAll();
  }

  function stepCursor() {
    state.cursor = (state.cursor + 1) % DEPTH;
    state.lastAction = "step";
    pushLog(`# step → ${state.cursor}`);
    renderAll();
  }

  function demo() {
    const p = PRESETS.and2_fail;
    state.preset = "and2_fail";
    state.dut = p.dut;
    state.stimText = p.stim;
    state.expText = p.exp;
    state.cursor = 0;
    state.demoed = true;
    syncTextAreas();
    doReadmem();
    applyAll();
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo FAIL vectors");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: $readmemh loads hex files into arrays; " +
        "TB loops stim[i] → DUT → compare exp[i]; keep vectors out of RTL."
    );
    renderAll();
  }

  function renderLab() {
    syncTextAreas();
    const sum = summary();
    const v = document.getElementById("verdict");
    if (sum.status === "pass") {
      v.className = "verdict yes";
      v.textContent = sum.text;
    } else if (sum.status === "fail" || sum.status === "error") {
      v.className = "verdict no";
      v.textContent = sum.text;
    } else {
      v.className = "verdict idle";
      v.textContent = sum.text;
    }

    const byIdx = Object.fromEntries(state.applied.map((r) => [r.idx, r]));
    let html =
      `<table class="mem-table"><thead><tr><th>i</th><th>stim</th><th>exp</th><th>got</th><th></th></tr></thead><tbody>`;
    for (let i = 0; i < DEPTH; i++) {
      const row = byIdx[i];
      const cls = i === state.cursor ? "is-cursor" : "";
      const got = row ? row.got.toString(16).toUpperCase().padStart(2, "0") : "—";
      const mark = row ? (row.ok ? "PASS" : "FAIL") : "";
      const cellCls = row ? (row.ok ? "is-pass" : "is-fail") : "";
      html += `<tr class="${cls}"><td>${i}</td><td>${state.stim[i]
        .toString(16)
        .toUpperCase()
        .padStart(2, "0")}</td><td>${state.exp[i]
        .toString(16)
        .toUpperCase()
        .padStart(2, "0")}</td><td class="${cellCls}">${got}</td><td class="${cellCls}">${mark}</td></tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById("mem-box").innerHTML = html;
    document.getElementById("meta-note").textContent = state.loaded
      ? `stim words=${state.stimCount || 0} · exp words=${state.expCount || 0} · ${dut().hint}`
      : "Not loaded yet.";

    document.getElementById("prop-code").textContent = tbSketch();
    document.getElementById("dut-hint").textContent = dut().hint;
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const fails = state.applied.filter((r) => !r.ok).length;
    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">dut=${state.dut}</span>
      <span class="flag ${state.loaded ? "is-ok" : ""}">loaded=${state.loaded ? 1 : 0}</span>
      <span class="flag is-on">cursor=${state.cursor}</span>
      <span class="flag ${sum.status === "pass" ? "is-ok" : sum.status === "fail" ? "is-bad" : ""}">status=${sum.status}</span>
      <span class="flag ${fails ? "is-bad" : state.applied.length ? "is-ok" : ""}">fails=${fails}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          dut: state.dut,
          stimText: state.stimText,
          expText: state.expText,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-readmemh",
      title: "Quiz: $readmemh",
      type: "quiz",
      prompt: "$readmemh is typically used to…",
      hint: "Hex file → array.",
      choices: [
        "load hex words from a file into a memory/array",
        "compile SystemC only",
        "replace $finish",
        "draw GTKWave cursors",
      ],
      answer: "load hex words from a file into a memory/array",
    },
    {
      id: "quiz-readmemb",
      title: "Quiz: $readmemb",
      type: "quiz",
      prompt: "$readmemb differs from $readmemh mainly by…",
      hint: "Digit radix.",
      choices: [
        "expecting binary digit characters instead of hex",
        "only writing VCD dumps",
        "requiring UVM phases",
        "disabling the clock",
      ],
      answer: "expecting binary digit characters instead of hex",
    },
    {
      id: "quiz-at",
      title: "Quiz: @addr",
      type: "quiz",
      prompt: "In a hex dump, @02 means…",
      hint: "Next word address.",
      choices: [
        "the next data word is written starting at address 0x02",
        "delete vector 2",
        "assert reset for 2 cycles",
        "set timescale to 2ns",
      ],
      answer: "the next data word is written starting at address 0x02",
    },
    {
      id: "quiz-separate",
      title: "Quiz: why files",
      type: "quiz",
      prompt: "Keeping vectors in files (not hard-coded) helps…",
      hint: "Scale stimulus.",
      choices: [
        "reuse and grow stimulus without rewriting TB logic",
        "remove the need for a clock",
        "make synthesis ignore clocks",
        "force $fatal always",
      ],
      answer: "reuse and grow stimulus without rewriting TB logic",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — and2, 4 vectors, Apply all → PASS.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.dut === "and2" &&
        state.loaded &&
        summary().status === "pass" &&
        (state.stimCount === 4 || state.applied.length === 4),
    },
    {
      id: "readmem",
      title: "$readmemh",
      prompt: "On starter text, run $readmemh — loaded=1.",
      hint: "$readmemh button",
      setup: () => {
        state = makeStarter();
        syncTextAreas();
        doReadmem();
      },
      check: () => state.loaded && state.lastAction === "readmem" && state.stimCount === 4,
    },
    {
      id: "apply-one",
      title: "Apply one",
      prompt: "After load, Apply one at cursor 0.",
      hint: "Apply one",
      setup: () => {
        loadStarter();
        state.cursor = 0;
        state.applied = [];
        applyOne();
      },
      check: () =>
        state.lastAction === "apply-one" &&
        state.applied.some((r) => r.idx === 0 && r.ok),
    },
    {
      id: "apply-all",
      title: "Apply all",
      prompt: "Apply all on starter → PASS.",
      hint: "Apply all",
      setup: () => {
        state = makeStarter();
        syncTextAreas();
        doReadmem();
        applyAll();
      },
      check: () => state.lastAction === "apply-all" && summary().status === "pass",
    },
    {
      id: "load-fail",
      title: "Load FAIL preset",
      prompt: "Load and2 wrong expect, $readmemh, Apply all → FAIL.",
      hint: "Preset → Load → $readmemh → Apply all",
      setup: () => {
        selPreset.value = "and2_fail";
        loadPreset();
        doReadmem();
        applyAll();
      },
      check: () => state.preset === "and2_fail" && summary().status === "fail",
    },
    {
      id: "load-at",
      title: "Load @addr",
      prompt: "Load @addr skip preset, $readmemh — stim[2]=0x03.",
      hint: "@addr skip → Load → $readmemh",
      setup: () => {
        selPreset.value = "with_at";
        loadPreset();
        doReadmem();
      },
      check: () => state.preset === "with_at" && state.loaded && state.stim[2] === 0x03,
    },
    {
      id: "load-or2",
      title: "Load or2",
      prompt: "Load or2 vectors, apply all → PASS.",
      hint: "or2 → Load → $readmemh → Apply all",
      setup: () => {
        selPreset.value = "or2_ok";
        loadPreset();
        doReadmem();
        applyAll();
      },
      check: () => state.dut === "or2" && summary().status === "pass",
    },
    {
      id: "load-add4",
      title: "Load add4",
      prompt: "Load add4 pack, apply all → PASS.",
      hint: "add4 → Load → apply",
      setup: () => {
        selPreset.value = "add4_ok";
        loadPreset();
        doReadmem();
        applyAll();
      },
      check: () => state.dut === "add4" && summary().status === "pass",
    },
    {
      id: "step",
      title: "Step cursor",
      prompt: "From starter (cursor 0), Step once → 1.",
      hint: "Step cursor",
      setup: () => {
        loadStarter();
        state.cursor = 0;
        stepCursor();
      },
      check: () => state.cursor === 1 && state.lastAction === "step",
    },
    {
      id: "demo",
      title: "Demo FAIL",
      prompt: "Click Demo FAIL — status fail.",
      hint: "Demo FAIL",
      setup: () => loadStarter(),
      check: () => state.demoed && summary().status === "fail" && state.lastAction === "demo",
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
      id: "sketch-readmem",
      title: "Sketch $readmemh",
      prompt: "TB sketch mentions $readmemh.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /\$readmemh/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions $readmemb.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /\$readmemb/.test(sourceSketch()),
    },
    {
      id: "pack-and2",
      title: "Pack 03",
      prompt: "Starter stim[2]=0x03 (a=1,b=1).",
      hint: "Starter $readmemh",
      setup: () => loadStarter(),
      check: () => state.stim[2] === 0x03,
    },
    {
      id: "expect-y",
      title: "Expect y",
      prompt: "Starter exp[2]=0x01 for the and2 hit.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.exp[2] === 0x01,
    },
    {
      id: "add-decode",
      title: "add4 decode",
      prompt: "On add4 preset after load, stim[0]=0x12 → x=2,y=1.",
      hint: "add4 → Load → $readmemh",
      setup: () => {
        selPreset.value = "add4_ok";
        loadPreset();
        doReadmem();
      },
      check: () => {
        const d = DUTS.add4.decode(state.stim[0]);
        return state.dut === "add4" && d.x === 2 && d.y === 1;
      },
    },
    {
      id: "fail-count",
      title: "Fail count",
      prompt: "Demo FAIL has fails≥1.",
      hint: "Demo FAIL",
      setup: () => demo(),
      check: () => state.applied.filter((r) => !r.ok).length >= 1,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to starter and2 PASS.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.dut === "and2" && summary().status === "pass";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="fvio-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("fvio-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load-preset").addEventListener("click", () => loadPreset());
  document.getElementById("btn-readmem").addEventListener("click", () => doReadmem());
  document.getElementById("btn-apply-one").addEventListener("click", () => applyOne());
  document.getElementById("btn-apply-all").addEventListener("click", () => applyAll());
  document.getElementById("btn-step").addEventListener("click", () => stepCursor());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selDut.addEventListener("change", () => {
    pullTextAreas();
    state.lastAction = "dut";
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

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved.stimText === "string") {
        state.stimText = saved.stimText;
        state.expText = saved.expText;
        state.dut = saved.dut in DUTS ? saved.dut : "and2";
        state.preset = saved.preset || "starter";
        state.cursor = saved.cursor | 0;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  // Boot into starter analyzed state
  syncTextAreas();
  doReadmem();
  applyAll();
  state.lastAction = "starter";
  renderAll();
})();
