(() => {
  /**
   * iverilog flags lab (concept)
   *   -g2005/-g2012, -Wall, -o, +incdir
   * Starter: full compile line — READY
   */

  const FLAG_BLURB = {
    gen: "-g2005 / -g2012 picks the Verilog / SystemVerilog generation iverilog accepts.",
    wall: "-Wall turns on useful warning categories during compile (not a silence switch).",
    out: "-o <file> names the compiled VVP (or executable) output — without it, default is a.out.",
    incdir: "+incdir+path adds a search directory for `include files.",
    src: "One or more .v / .sv source files must appear on the compile line.",
  };

  const CHIPS = [
    { id: "g2012", label: "-g2012", token: "-g2012", group: "gen" },
    { id: "g2005", label: "-g2005", token: "-g2005", group: "gen" },
    { id: "wall", label: "-Wall", token: "-Wall", group: "wall" },
    { id: "out", label: "-o sim.vvp", token: "-o sim.vvp", group: "out" },
    { id: "incdir", label: "+incdir+include", token: "+incdir+include", group: "incdir" },
    { id: "src", label: "tb.v dut.v", token: "tb.v dut.v", group: "src" },
  ];

  const PRESETS = {
    starter: {
      label: "starter: full line",
      cli: "iverilog -g2012 -Wall -o sim.vvp +incdir+include tb.v dut.v",
      note: "Generation, -Wall, -o, +incdir, and sources — READY.",
      autoAssemble: true,
    },
    g2005: {
      label: "IEEE 2005 + Wall",
      cli: "iverilog -g2005 -Wall -o sim.vvp tb.v",
      note: "Older generation; still a complete line — READY.",
      autoAssemble: true,
    },
    no_out: {
      label: "missing -o",
      cli: "iverilog -g2012 -Wall tb.v dut.v",
      note: "No -o outfile — OPEN (default a.out is easy to lose).",
      autoAssemble: true,
    },
    no_src: {
      label: "no sources",
      cli: "iverilog -g2012 -Wall -o sim.vvp +incdir+include",
      note: "Flags only — OPEN (need .v / .sv inputs).",
      autoAssemble: true,
    },
    no_gen: {
      label: "no -g*",
      cli: "iverilog -Wall -o sim.vvp tb.v",
      note: "No generation flag — OPEN for this lab bar.",
      autoAssemble: true,
    },
    no_wall: {
      label: "no -Wall",
      cli: "iverilog -g2012 -o sim.vvp tb.v dut.v",
      note: "Complete enough for READY; -Wall recommended.",
      autoAssemble: true,
    },
    idle: {
      label: "idle",
      cli: "iverilog",
      note: "Idle — edit the line, toggle chips, or Load a preset, then Assemble.",
      autoAssemble: false,
    },
  };

  function sourceSketch() {
    return `// iverilog flags literacy (document aid — not a real compile)
//
//   iverilog [flags] -o <out.vvp> [+incdir+dir…] file.v …
//
//   -g2005 / -g2012   language generation (what constructs are legal)
//   -Wall             enable useful warning categories
//   -o <file>         name the compiled output (else a.out)
//   +incdir+path      search path for \`include
//
// This lab's READY bar: generation + -o + ≥1 source.
// -Wall and +incdir are strongly recommended, not required for READY.
// Next: vvp sim.vvp  (runtime — see vvp-plusargs).`;
  }

  function parseCli(cli) {
    const raw = String(cli || "").trim();
    const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];
    let gen = "";
    let wall = false;
    let out = "";
    const incdirs = [];
    const sources = [];
    let dualGen = false;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "iverilog") continue;
      if (t === "-g2012" || t === "-g2005" || t === "-g2k" || t === "-g2001") {
        if (gen && gen !== t) dualGen = true;
        gen = t;
        continue;
      }
      if (t === "-Wall") {
        wall = true;
        continue;
      }
      if (t === "-o") {
        out = tokens[i + 1] || "";
        if (tokens[i + 1]) i++;
        continue;
      }
      if (t.startsWith("-o") && t.length > 2) {
        out = t.slice(2);
        continue;
      }
      if (t.startsWith("+incdir+")) {
        incdirs.push(t.slice("+incdir+".length) || "(empty)");
        continue;
      }
      if (t.startsWith("-")) continue;
      if (/\.(v|sv|vh|svh)$/i.test(t)) sources.push(t);
    }

    const hasGen = !!gen;
    const hasOut = !!out;
    const hasSrc = sources.length > 0;
    const ready = hasGen && hasOut && hasSrc && !dualGen;
    let status = "OPEN";
    let reason = "missing generation, -o, and/or sources";
    if (dualGen) {
      status = "OPEN";
      reason = "conflicting -g* flags";
    } else if (ready) {
      status = "READY";
      reason = wall
        ? "generation + -o + sources (Wall on)"
        : "generation + -o + sources (−Wall optional)";
    } else {
      const miss = [];
      if (!hasGen) miss.push("-g*");
      if (!hasOut) miss.push("-o");
      if (!hasSrc) miss.push("sources");
      reason = `missing ${miss.join(", ")}`;
    }

    return {
      tokens,
      gen,
      wall,
      out,
      incdirs,
      sources,
      dualGen,
      hasGen,
      hasOut,
      hasSrc,
      ready,
      status,
      reason,
    };
  }

  function chipsFromParsed(p) {
    return {
      g2012: p.gen === "-g2012",
      g2005: p.gen === "-g2005",
      wall: p.wall,
      out: !!p.out,
      incdir: p.incdirs.length > 0,
      src: p.sources.length > 0,
    };
  }

  function buildCliFromChips(on) {
    const parts = ["iverilog"];
    if (on.g2012) parts.push("-g2012");
    else if (on.g2005) parts.push("-g2005");
    if (on.wall) parts.push("-Wall");
    if (on.out) parts.push("-o", "sim.vvp");
    if (on.incdir) parts.push("+incdir+include");
    if (on.src) parts.push("tb.v", "dut.v");
    return parts.join(" ");
  }

  function makeStarter() {
    const p = parseCli(PRESETS.starter.cli);
    return {
      preset: "starter",
      cli: PRESETS.starter.cli,
      note: PRESETS.starter.note,
      chips: chipsFromParsed(p),
      selChip: "g2012",
      parsed: p,
      lastAssembled: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`assemble: ${p.status}`],
    };
  }

  const CLEARED_KEY = "ddv-iverilog-flags-cleared-v1";
  const STORE_KEY = "ddv-iverilog-flags-session-v1";

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

  const root = document.getElementById("ivf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>iverilog -g2012 -Wall -o sim.vvp +incdir+include tb.v dut.v</code>
        — line READY.</p>
      <button type="button" class="btn btn-secondary" id="ivf-starter">Load starter example</button>
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
        <div class="idea-card"><h3>-g2005 / -g2012</h3><p>Language generation for the compile.</p></div>
        <div class="idea-card"><h3>-Wall</h3><p>Useful warning categories on.</p></div>
        <div class="idea-card"><h3>-o</h3><p>Name the compiled VVP output.</p></div>
        <div class="idea-card"><h3>+incdir</h3><p>Search path for \`include files.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ivf-controls">
        <div class="ivf-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>full starter</option>
            <option value="g2005">-g2005 line</option>
            <option value="no_out">missing -o</option>
            <option value="no_src">no sources</option>
            <option value="no_gen">no -g*</option>
            <option value="no_wall">no -Wall</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="ivf-field" style="flex:1;min-width:12rem">
          <label for="inp-cli">Compile command</label>
          <input id="inp-cli" class="cli" type="text" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-assemble">Assemble</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo missing -o</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ivf-layout">
        <div class="panel-box">
          <h3>Flag chips</h3>
          <div class="chip-row" id="chip-row"></div>
          <h3>Parsed flags</h3>
          <ul class="flag-list" id="flag-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Command sketch</h3>
          <pre class="cmd-box" id="cmd-box"></pre>
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
  const inpCli = /** @type {HTMLInputElement} */ (document.getElementById("inp-cli"));

  function cmdSketch() {
    const p = state.parsed;
    return `# iverilog compile line
cmd: ${state.cli || "(empty)"}
gen: ${p.gen || "—"}
Wall: ${p.wall ? "on" : "off"}
-o: ${p.out || "—"}
incdir: ${p.incdirs.length ? p.incdirs.join(", ") : "—"}
src: ${p.sources.length ? p.sources.join(" ") : "—"}
# status: ${state.lastAssembled ? p.status : "— (Assemble)"}
# reason: ${state.lastAssembled ? p.reason : "—"}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kindName, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kindName;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    inpCli.value = state.cli;
  }

  function runAssemble(silent) {
    state.cli = inpCli.value;
    const p = parseCli(state.cli);
    state.parsed = p;
    state.chips = chipsFromParsed(p);
    state.lastAssembled = true;
    pushTrace(`assemble: ${p.status}`);
    if (!silent) {
      state.lastAction = p.ready ? "assemble-ok" : "assemble-bad";
      pushLog(`# assemble ${p.status}`);
      renderAll();
    }
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter READY");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.cli = p.cli;
    state.note = p.note;
    state.parsed = parseCli("");
    state.lastAssembled = false;
    syncInputs();
    if (p.autoAssemble) {
      runAssemble(true);
      if (mark) state.lastAction = mark;
    } else if (mark) {
      state.lastAction = mark;
    }
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function toggleChip(id) {
    const chip = CHIPS.find((c) => c.id === id);
    if (!chip) return;
    const on = { ...state.chips };
    if (chip.group === "gen") {
      on.g2012 = false;
      on.g2005 = false;
      on[id] = !state.chips[id];
    } else {
      on[id] = !state.chips[id];
    }
    state.chips = on;
    state.cli = buildCliFromChips(on);
    state.selChip = id;
    state.preset = "custom";
    syncInputs();
    runAssemble(true);
    state.lastAction = "toggle";
    pushLog(`# toggle ${chip.label}`);
    renderAll();
  }

  function selectChip(id) {
    state.selChip = id;
    state.lastAction = "select-chip";
    renderAll();
  }

  function demo() {
    applyPreset("no_out", "demo");
    state.demoed = true;
    pushLog("# demo missing -o OPEN");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain flags");
    pushTrace("explain: -g* · -Wall · -o · +incdir · sources → READY");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const p = state.parsed;
    const chip = CHIPS.find((c) => c.id === state.selChip);

    document.getElementById("chip-row").innerHTML = CHIPS.map((c) => {
      const on = !!state.chips[c.id];
      const sel = state.selChip === c.id;
      return `<button type="button" class="chip ${on ? "is-on" : ""} ${sel ? "is-sel" : ""}" data-chip="${c.id}" data-toggle="${c.id}">
        <span class="k">${c.group}</span>${c.label}
      </button>`;
    }).join("");
    document.querySelectorAll("[data-toggle]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        if (ev.detail === 2) return;
        const id = /** @type {string} */ (el.getAttribute("data-toggle"));
        // single click: select; use Assemble after toggle via second path
        if (state.selChip === id) toggleChip(id);
        else selectChip(id);
      });
      el.addEventListener("dblclick", () => {
        toggleChip(/** @type {string} */ (el.getAttribute("data-toggle")));
      });
    });

    const rows = [
      {
        id: "gen",
        label: "generation",
        val: p.gen || "—",
        ok: p.hasGen && !p.dualGen,
        req: true,
      },
      {
        id: "wall",
        label: "-Wall",
        val: p.wall ? "on" : "off",
        ok: p.wall,
        req: false,
      },
      {
        id: "out",
        label: "-o",
        val: p.out || "—",
        ok: p.hasOut,
        req: true,
      },
      {
        id: "incdir",
        label: "+incdir",
        val: p.incdirs.length ? p.incdirs.join(",") : "—",
        ok: p.incdirs.length > 0,
        req: false,
      },
      {
        id: "src",
        label: "sources",
        val: p.sources.length ? String(p.sources.length) : "0",
        ok: p.hasSrc,
        req: true,
      },
    ];

    document.getElementById("flag-list").innerHTML = rows
      .map(
        (r) => `<li>
        <span class="id">${r.label}</span>
        <span class="tag">${r.val}</span>
        <span class="tag ${r.ok ? "is-ok" : r.req ? "is-bad" : "is-opt"}">${
          r.ok ? "OK" : r.req ? "NEED" : "opt"
        }</span>
      </li>`
      )
      .join("");

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Click a chip to select; click again (or double-click) to toggle it into the line.";
    if (chip) {
      const groupKey =
        chip.group === "gen"
          ? "gen"
          : chip.group === "wall"
            ? "wall"
            : chip.group === "out"
              ? "out"
              : chip.group === "incdir"
                ? "incdir"
                : "src";
      blurb = FLAG_BLURB[groupKey];
    }
    document.getElementById("role-blurb").textContent = blurb;

    document.getElementById("cmd-box").textContent = cmdSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastAssembled) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset, edit CLI, or Assemble";
    } else if (p.ready) {
      v.className = "verdict yes";
      v.textContent = `Line READY — ${p.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${p.status} — ${p.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${p.ready && state.lastAssembled ? "is-ok" : state.lastAssembled ? "is-bad" : ""}">ready=${state.lastAssembled ? (p.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${p.hasGen ? "is-ok" : "is-bad"}">gen=${p.gen || "—"}</span>
      <span class="flag ${p.wall ? "is-ok" : ""}">Wall=${p.wall ? 1 : 0}</span>
      <span class="flag ${p.hasOut ? "is-ok" : "is-bad"}">-o=${p.out || "—"}</span>
      <span class="flag ${p.incdirs.length ? "is-ok" : ""}">incdir=${p.incdirs.length}</span>
      <span class="flag ${p.hasSrc ? "is-ok" : "is-bad"}">src=${p.sources.length}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          cli: state.cli,
          selChip: state.selChip,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-gen",
      title: "Quiz: -g*",
      type: "quiz",
      prompt: "-g2012 / -g2005 selects…",
      hint: "Language year.",
      choices: [
        "the Verilog / SystemVerilog generation iverilog accepts",
        "the GTKWave color theme",
        "the random seed for vvp",
        "only the Makefile PHONY list",
      ],
      answer: "the Verilog / SystemVerilog generation iverilog accepts",
    },
    {
      id: "quiz-wall",
      title: "Quiz: -Wall",
      type: "quiz",
      prompt: "-Wall means…",
      hint: "Warnings.",
      choices: [
        "enable useful warning categories during compile",
        "wipe all warnings forever",
        "write the VCD dump",
        "force -o a.out",
      ],
      answer: "enable useful warning categories during compile",
    },
    {
      id: "quiz-out",
      title: "Quiz: -o",
      type: "quiz",
      prompt: "-o names…",
      hint: "Output file.",
      choices: [
        "the compiled VVP (or executable) output file",
        "only the include directory",
        "the simulator GUI theme",
        "a plusarg for UVM_TESTNAME",
      ],
      answer: "the compiled VVP (or executable) output file",
    },
    {
      id: "quiz-incdir",
      title: "Quiz: +incdir",
      type: "quiz",
      prompt: "+incdir+path adds…",
      hint: "`include.",
      choices: [
        "a search directory for `include files",
        "a runtime plusarg for vvp",
        "a Verilator --trace dump",
        "a coverage hole",
      ],
      answer: "a search directory for `include files",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — READY.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.parsed.ready &&
        state.parsed.status === "READY",
    },
    {
      id: "load-g2005",
      title: "Load -g2005",
      prompt: "Load -g2005 line — READY.",
      hint: "-g2005 → Load",
      setup: () => {
        selPreset.value = "g2005";
        loadPreset();
      },
      check: () =>
        state.parsed.gen === "-g2005" &&
        state.parsed.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-no-out",
      title: "Load missing -o",
      prompt: "Load missing -o — OPEN.",
      hint: "missing -o → Load",
      setup: () => {
        selPreset.value = "no_out";
        loadPreset();
      },
      check: () =>
        !state.parsed.hasOut &&
        !state.parsed.ready &&
        state.lastAction === "load",
    },
    {
      id: "load-no-src",
      title: "Load no sources",
      prompt: "Load no sources — OPEN.",
      hint: "no sources → Load",
      setup: () => {
        selPreset.value = "no_src";
        loadPreset();
      },
      check: () =>
        !state.parsed.hasSrc && !state.parsed.ready,
    },
    {
      id: "load-no-gen",
      title: "Load no -g*",
      prompt: "Load no -g* — OPEN.",
      hint: "no -g* → Load",
      setup: () => {
        selPreset.value = "no_gen";
        loadPreset();
      },
      check: () =>
        !state.parsed.hasGen && !state.parsed.ready,
    },
    {
      id: "load-no-wall",
      title: "Load no -Wall",
      prompt: "Load no -Wall — still READY.",
      hint: "no -Wall → Load",
      setup: () => {
        selPreset.value = "no_wall";
        loadPreset();
      },
      check: () =>
        !state.parsed.wall &&
        state.parsed.ready &&
        state.lastAction === "load",
    },
    {
      id: "assemble-ok",
      title: "Assemble READY",
      prompt: "On starter, Assemble — READY.",
      hint: "Assemble",
      setup: () => {
        loadStarter();
        runAssemble(false);
      },
      check: () =>
        state.parsed.ready && state.lastAction === "assemble-ok",
    },
    {
      id: "assemble-bad",
      title: "Assemble OPEN",
      prompt: "On missing -o, Assemble — OPEN.",
      hint: "missing -o → Assemble",
      setup: () => {
        selPreset.value = "no_out";
        loadPreset();
        runAssemble(false);
      },
      check: () =>
        !state.parsed.ready && state.lastAction === "assemble-bad",
    },
    {
      id: "select-chip",
      title: "Select chip",
      prompt: "Select the -Wall chip.",
      hint: "Click -Wall",
      setup: () => {
        loadStarter();
        selectChip("wall");
      },
      check: () =>
        state.selChip === "wall" &&
        state.lastAction === "select-chip",
    },
    {
      id: "toggle-wall",
      title: "Toggle -Wall",
      prompt: "From no -Wall, toggle -Wall on — Wall=1.",
      hint: "Click -Wall twice or dblclick",
      setup: () => {
        selPreset.value = "no_wall";
        loadPreset();
        state.selChip = "wall";
        toggleChip("wall");
      },
      check: () =>
        state.parsed.wall &&
        state.lastAction === "toggle",
    },
    {
      id: "demo",
      title: "Demo missing -o",
      prompt: "Click Demo missing -o.",
      hint: "Demo missing -o",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.parsed.hasOut &&
        state.lastAction === "demo",
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
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions -g2012 or +incdir.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /-g2012|\+incdir/i.test(sourceSketch()),
    },
    {
      id: "cmd-sketch",
      title: "Command sketch",
      prompt: "On starter, command sketch shows READY.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /READY/.test(document.getElementById("cmd-box").textContent),
    },
    {
      id: "incdir-present",
      title: "Incdir on starter",
      prompt: "Starter has +incdir+include.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.parsed.incdirs.includes("include"),
    },
    {
      id: "ready-bar",
      title: "READY bar",
      prompt: "READY needs gen + -o + sources.",
      hint: "Starter meets bar",
      setup: () => loadStarter(),
      check: () =>
        state.parsed.hasGen &&
        state.parsed.hasOut &&
        state.parsed.hasSrc &&
        state.parsed.ready,
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet assembled.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastAssembled && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From missing -o, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "no_out";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.parsed.ready,
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) =>
      CHALLENGES.some((c) => c.id === id)
    ).length;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ivf-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ivf-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-assemble").addEventListener("click", () => runAssemble(false));
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

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved) {
        state.cli = saved.cli || state.cli;
        state.selChip = saved.selChip || state.selChip;
        state.preset = saved.preset || "starter";
        state.lastAssembled = false;
        state.lastAction = "restore";
        syncInputs();
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
