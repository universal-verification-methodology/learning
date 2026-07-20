(() => {
  /**
   * cocotb DUT handle (concept)
   *   hierarchical dut.path · .value peek/poke
   * Starter: dut.uart.txd resolves — value 1
   */

  /** @type {Record<string, string>} */
  const HIER = {
    "dut.clk": "0",
    "dut.rst_n": "1",
    "dut.uart.txd": "1",
    "dut.uart.rxd": "1",
    "dut.uart.baud": "0",
    "dut.core.pc": "0x00",
    "dut.core.regs.r0": "0",
  };

  const IDEA = {
    root: "dut is the hierarchy root handle cocotb passes into the test.",
    path: "Attribute dots walk hierarchy: dut.uart.txd ≈ design path uart.txd.",
    value: ".value is the pin/register payload — assign to poke, read to peek.",
    miss: "A bad path raises AttributeError (sketch: resolve FAIL).",
  };

  const PRESETS = {
    starter: {
      label: "starter: dut.uart.txd",
      path: "dut.uart.txd",
      poke: "1",
      note: "Path resolves; peek shows 1 — starter OK.",
      autoResolve: true,
      autoPeek: true,
    },
    clk: {
      label: "dut.clk",
      path: "dut.clk",
      poke: "1",
      note: "Top-level clock handle under dut.",
      autoResolve: true,
      autoPeek: true,
    },
    nested: {
      label: "dut.core.regs.r0",
      path: "dut.core.regs.r0",
      poke: "0x5A",
      note: "Deep hierarchy — still attribute walking from dut.",
      autoResolve: true,
      autoPeek: true,
    },
    miss: {
      label: "bad path miss",
      path: "dut.uart.ghost",
      poke: "0",
      note: "No such signal — resolve FAIL (AttributeError in real cocotb).",
      autoResolve: true,
      autoPeek: false,
    },
    poke_txd: {
      label: "poke txd=0",
      path: "dut.uart.txd",
      poke: "0",
      note: "Resolve + poke writes .value on the handle.",
      autoResolve: true,
      autoPeek: false,
      autoPoke: true,
    },
    idle: {
      label: "idle",
      path: "dut.uart.rxd",
      poke: "1",
      note: "Idle — edit path / Load preset, then Resolve.",
      autoResolve: false,
    },
  };

  function sourceSketch() {
    return `# cocotb DUT handle literacy (not a live sim)
# @cocotb.test()
# async def test(dut):          # dut = hierarchy root
#     await RisingEdge(dut.clk)
#     dut.uart.txd.value = 0    # poke
#     bit = dut.uart.txd.value  # peek
#     # dut.uart.ghost  → AttributeError if path missing
#
# Hierarchy: dut.<inst>.<signal> mirrors the design tree.
# Same idea as vif / hierarchical paths in SV UVM —
# Python just uses attribute access.`;
  }

  function normalizePath(p) {
    return String(p || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\s+/g, "");
  }

  function resolvePath(path, values) {
    const p = normalizePath(path);
    if (!p.startsWith("dut")) {
      return { ok: false, path: p, value: null, reason: "path must start with dut" };
    }
    if (Object.prototype.hasOwnProperty.call(values, p)) {
      return { ok: true, path: p, value: values[p], reason: "found" };
    }
    return { ok: false, path: p, value: null, reason: "AttributeError (missing)" };
  }

  function makeStarter() {
    const values = { ...HIER };
    const path = PRESETS.starter.path;
    const r = resolvePath(path, values);
    return {
      preset: "starter",
      path,
      poke: PRESETS.starter.poke,
      values,
      note: PRESETS.starter.note,
      selected: "path",
      resolved: r,
      lastResolved: true,
      peeked: true,
      poked: false,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`resolve: ${path} ok=1 val=${r.value}`],
    };
  }

  const CLEARED_KEY = "ddv-cocotb-dut-handle-cleared-v1";
  const STORE_KEY = "ddv-cocotb-dut-handle-session-v1";

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

  const root = document.getElementById("cdut-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>dut.uart.txd</code> resolves —
        peek <code>.value</code> is <code>1</code>.</p>
      <button type="button" class="btn btn-secondary" id="cdut-starter">Load starter example</button>
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
        <div class="idea-card"><h3>dut</h3><p>Hierarchy root handle into the design.</p></div>
        <div class="idea-card"><h3>path</h3><p>Dots walk instances: dut.uart.txd.</p></div>
        <div class="idea-card"><h3>.value</h3><p>Peek / poke the signal payload.</p></div>
        <div class="idea-card"><h3>miss</h3><p>Bad path → AttributeError (resolve FAIL).</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="cdut-controls">
        <div class="cdut-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>dut.uart.txd</option>
            <option value="clk">dut.clk</option>
            <option value="nested">dut.core.regs.r0</option>
            <option value="miss">bad path</option>
            <option value="poke_txd">poke txd=0</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="cdut-field">
          <label for="inp-path">Handle path</label>
          <input id="inp-path" class="path" type="text" spellcheck="false" />
        </div>
        <div class="cdut-field">
          <label for="inp-poke">Poke value</label>
          <input id="inp-poke" type="text" spellcheck="false" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-resolve">Resolve</button>
        <button type="button" class="btn btn-ghost" id="btn-peek">Peek</button>
        <button type="button" class="btn btn-ghost" id="btn-poke">Poke</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo miss</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="cdut-layout">
        <div class="panel-box">
          <h3>Signals under dut</h3>
          <div class="sig-row" id="sig-row"></div>
          <h3>Hierarchy tree</h3>
          <pre class="tree-box" id="tree-box"></pre>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Handle sketch</h3>
          <pre class="handle-box" id="handle-box"></pre>
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
  const inpPath = /** @type {HTMLInputElement} */ (document.getElementById("inp-path"));
  const inpPoke = /** @type {HTMLInputElement} */ (document.getElementById("inp-poke"));

  function treeSketch() {
    const paths = Object.keys(state.values).sort();
    return paths
      .map((p) => {
        const hit =
          state.lastResolved && state.resolved.path === p && state.resolved.ok
            ? "  ←"
            : "";
        return `${p} = ${state.values[p]}${hit}`;
      })
      .join("\n");
  }

  function handleSketch() {
    const r = state.resolved;
    return `# path: ${state.path || "—"}
# resolve: ${state.lastResolved ? (r.ok ? "OK" : "FAIL") : "—"}
# reason:  ${state.lastResolved ? r.reason : "—"}
# value:   ${r.value == null ? "—" : r.value}
# peek:    ${state.peeked ? "yes" : "no"}
# poke:    ${state.poked ? `wrote ${state.poke}` : "no"}
#
# Python-ish:
#   h = ${state.path || "dut.…"}
#   ${state.poked ? `h.value = ${state.poke}` : "bit = h.value"}`;
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
    inpPath.value = state.path;
    inpPoke.value = state.poke;
  }

  function readInputs() {
    state.path = normalizePath(inpPath.value);
    state.poke = String(inpPoke.value || "").trim();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter dut.uart.txd");
    renderAll();
  }

  function runResolve(silent) {
    readInputs();
    state.resolved = resolvePath(state.path, state.values);
    state.lastResolved = true;
    state.peeked = false;
    state.poked = false;
    const r = state.resolved;
    pushTrace(
      `resolve: ${r.path} ok=${r.ok ? 1 : 0}${r.ok ? ` val=${r.value}` : ` (${r.reason})`}`
    );
    if (!silent) {
      state.lastAction = r.ok ? "resolve-ok" : "resolve-bad";
      pushLog(`# resolve ${r.ok ? "OK" : "FAIL"}`);
      renderAll();
    }
  }

  function runPeek() {
    readInputs();
    if (!state.lastResolved || state.resolved.path !== state.path) {
      runResolve(true);
    }
    if (!state.resolved.ok) {
      state.lastAction = "peek-bad";
      pushLog("# peek FAIL (unresolved)");
      renderAll();
      return;
    }
    state.peeked = true;
    state.lastAction = "peek";
    pushTrace(`peek: ${state.path}.value = ${state.resolved.value}`);
    pushLog(`# peek ${state.resolved.value}`);
    renderAll();
  }

  function runPoke() {
    readInputs();
    if (!state.lastResolved || state.resolved.path !== state.path) {
      runResolve(true);
    }
    if (!state.resolved.ok) {
      state.lastAction = "poke-bad";
      pushLog("# poke FAIL (unresolved)");
      renderAll();
      return;
    }
    const v = state.poke || "0";
    state.values[state.path] = v;
    state.resolved = resolvePath(state.path, state.values);
    state.poked = true;
    state.peeked = true;
    state.lastAction = "poke";
    pushTrace(`poke: ${state.path}.value = ${v}`);
    pushLog(`# poke ${v}`);
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.path = p.path;
    state.poke = p.poke;
    state.values = { ...HIER };
    state.note = p.note;
    state.resolved = resolvePath("", {});
    state.lastResolved = false;
    state.peeked = false;
    state.poked = false;
    syncInputs();
    if (p.autoResolve) {
      runResolve(true);
      if (p.autoPeek && state.resolved.ok) {
        state.peeked = true;
        pushTrace(`peek: ${state.path}.value = ${state.resolved.value}`);
      }
      if (p.autoPoke && state.resolved.ok) {
        const v = state.poke || "0";
        state.values[state.path] = v;
        state.resolved = resolvePath(state.path, state.values);
        state.poked = true;
        state.peeked = true;
        pushTrace(`poke: ${state.path}.value = ${v}`);
      }
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

  function demo() {
    applyPreset("miss", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo miss path");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: dut is the hierarchy root; dotted paths walk instances; " +
        ".value peeks/pokes; missing path → AttributeError."
    );
    renderAll();
  }

  function selectIdea(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function selectSignal(path) {
    state.path = path;
    inpPath.value = path;
    state.selected = "path";
    state.lastAction = "select-sig";
    runResolve(false);
  }

  function renderLab() {
    syncInputs();
    const paths = Object.keys(state.values).sort();
    document.getElementById("sig-row").innerHTML = paths
      .map((p) => {
        const short = p.replace(/^dut\./, "");
        const hit =
          state.lastResolved && state.resolved.ok && state.resolved.path === p;
        return `<button type="button" class="sig-card ${hit ? "is-hit" : ""} ${
          state.path === p ? "is-sel" : ""
        }" data-sig="${p}">
          <div class="k">${short}</div>
          <div class="v">${state.values[p]}</div>
        </button>`;
      })
      .join("");
    document.querySelectorAll("[data-sig]").forEach((el) => {
      el.addEventListener("click", () =>
        selectSignal(/** @type {string} */ (el.getAttribute("data-sig")))
      );
    });

    document.getElementById("tree-box").textContent = treeSketch();
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      IDEA[state.selected] || IDEA.path;
    document.getElementById("handle-box").textContent = handleSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    // idea select via clicking core idea cards is optional; keep selected blurb
    const v = document.getElementById("verdict");
    if (!state.lastResolved) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Resolve path";
    } else if (state.resolved.ok) {
      v.className = "verdict yes";
      v.textContent = `Resolved ${state.resolved.path} = ${state.resolved.value}`;
    } else {
      v.className = "verdict no";
      v.textContent = `Resolve FAIL — ${state.resolved.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.resolved.ok && state.lastResolved ? "is-ok" : state.lastResolved ? "is-bad" : ""}">ok=${state.lastResolved ? (state.resolved.ok ? 1 : 0) : "—"}</span>
      <span class="flag ${state.peeked ? "is-ok" : ""}">peek=${state.peeked ? 1 : 0}</span>
      <span class="flag ${state.poked ? "is-ok" : ""}">poke=${state.poked ? 1 : 0}</span>
      <span class="flag is-ok">path=${state.path || "—"}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    // selectable idea shortcuts on idea-grid
    document.querySelectorAll(".idea-card h3").forEach((h) => {
      const key = h.textContent.trim();
      const map = { dut: "root", path: "path", ".value": "value", miss: "miss" };
      const id = map[key];
      if (!id) return;
      h.parentElement.style.cursor = "pointer";
      h.parentElement.onclick = () => selectIdea(id);
    });

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ preset: state.preset, path: state.path, poke: state.poke })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-dut",
      title: "Quiz: dut",
      type: "quiz",
      prompt: "In a cocotb test, dut is…",
      hint: "Root handle.",
      choices: [
        "the hierarchy root handle into the simulated design",
        "only the Makefile MODULE name",
        "a replacement for RisingEdge",
        "the synthesis netlist file",
      ],
      answer: "the hierarchy root handle into the simulated design",
    },
    {
      id: "quiz-path",
      title: "Quiz: path",
      type: "quiz",
      prompt: "dut.uart.txd means…",
      hint: "Dots.",
      choices: [
        "walk hierarchy from dut → uart → txd via attributes",
        "a SystemVerilog package import",
        "a plusarg name",
        "a GTKWave save file",
      ],
      answer: "walk hierarchy from dut → uart → txd via attributes",
    },
    {
      id: "quiz-value",
      title: "Quiz: .value",
      type: "quiz",
      prompt: "dut.sig.value is used to…",
      hint: "Peek/poke.",
      choices: [
        "peek or poke the signal’s current payload",
        "compile the DUT",
        "set +UVM_TESTNAME",
        "delete the agent",
      ],
      answer: "peek or poke the signal’s current payload",
    },
    {
      id: "quiz-miss",
      title: "Quiz: miss",
      type: "quiz",
      prompt: "A missing hierarchical path typically…",
      hint: "Error.",
      choices: [
        "raises AttributeError (resolve fails)",
        "always returns 0 silently forever",
        "synthesizes a new net",
        "disables cocotb",
      ],
      answer: "raises AttributeError (resolve fails)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — dut.uart.txd resolves OK.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.resolved.ok &&
        state.path === "dut.uart.txd",
    },
    {
      id: "load-clk",
      title: "Load clk",
      prompt: "Load dut.clk preset.",
      hint: "dut.clk → Load",
      setup: () => {
        selPreset.value = "clk";
        loadPreset();
      },
      check: () =>
        state.path === "dut.clk" &&
        state.resolved.ok &&
        state.lastAction === "load",
    },
    {
      id: "load-nested",
      title: "Load nested",
      prompt: "Load dut.core.regs.r0.",
      hint: "nested → Load",
      setup: () => {
        selPreset.value = "nested";
        loadPreset();
      },
      check: () =>
        state.path === "dut.core.regs.r0" && state.resolved.ok,
    },
    {
      id: "load-miss",
      title: "Load miss",
      prompt: "Load bad path — resolve FAIL.",
      hint: "bad path → Load",
      setup: () => {
        selPreset.value = "miss";
        loadPreset();
      },
      check: () => !state.resolved.ok && state.lastResolved,
    },
    {
      id: "resolve-ok",
      title: "Resolve OK",
      prompt: "From idle, Resolve dut.uart.rxd — OK.",
      hint: "idle → path → Resolve",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        inpPath.value = "dut.uart.rxd";
        runResolve(false);
      },
      check: () =>
        state.resolved.ok &&
        state.path === "dut.uart.rxd" &&
        state.lastAction === "resolve-ok",
    },
    {
      id: "resolve-bad",
      title: "Resolve FAIL",
      prompt: "Resolve dut.nope — FAIL.",
      hint: "idle → dut.nope → Resolve",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        inpPath.value = "dut.nope";
        runResolve(false);
      },
      check: () =>
        !state.resolved.ok && state.lastAction === "resolve-bad",
    },
    {
      id: "peek",
      title: "Peek",
      prompt: "On starter, click Peek.",
      hint: "Starter → Peek",
      setup: () => {
        loadStarter();
        runPeek();
      },
      check: () => state.peeked && state.lastAction === "peek",
    },
    {
      id: "poke",
      title: "Poke",
      prompt: "On starter, Poke value 0.",
      hint: "poke=0 → Poke",
      setup: () => {
        loadStarter();
        inpPoke.value = "0";
        runPoke();
      },
      check: () =>
        state.poked &&
        state.values["dut.uart.txd"] === "0" &&
        state.lastAction === "poke",
    },
    {
      id: "load-poke",
      title: "Load poke preset",
      prompt: "Load poke txd=0 — value becomes 0.",
      hint: "poke txd=0 → Load",
      setup: () => {
        selPreset.value = "poke_txd";
        loadPreset();
      },
      check: () =>
        state.values["dut.uart.txd"] === "0" && state.poked,
    },
    {
      id: "demo",
      title: "Demo miss",
      prompt: "Click Demo miss.",
      hint: "Demo miss",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        !state.resolved.ok &&
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
      id: "select-sig",
      title: "Select signal",
      prompt: "Click the uart.baud signal card.",
      hint: "Click baud card",
      setup: () => {
        loadStarter();
        selectSignal("dut.uart.baud");
      },
      check: () =>
        state.path === "dut.uart.baud" &&
        state.resolved.ok &&
        state.lastAction === "resolve-ok",
    },
    {
      id: "select-idea",
      title: "Select idea",
      prompt: "Click the .value idea card.",
      hint: "Click .value under Core ideas",
      setup: () => {
        loadStarter();
        selectIdea("value");
      },
      check: () =>
        state.selected === "value" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions AttributeError or .value.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /AttributeError|\.value/.test(sourceSketch()),
    },
    {
      id: "handle-sketch",
      title: "Handle sketch",
      prompt: "On starter, handle sketch shows resolve OK.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /resolve: OK/.test(document.getElementById("handle-box").textContent),
    },
    {
      id: "tree-hit",
      title: "Tree hit",
      prompt: "On starter, tree marks uart.txd with ←.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /dut\.uart\.txd = 1\s*←/.test(treeSketch()),
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet resolved.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        !state.lastResolved && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From miss, Reset — txd OK again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "miss";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.resolved.ok &&
        state.path === "dut.uart.txd",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="cdut-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("cdut-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-resolve").addEventListener("click", () => runResolve(false));
  document.getElementById("btn-peek").addEventListener("click", () => runPeek());
  document.getElementById("btn-poke").addEventListener("click", () => runPoke());
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
      if (saved && saved.path) {
        state.path = saved.path;
        state.poke = saved.poke || state.poke;
        state.preset = saved.preset || "starter";
        state.lastResolved = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
