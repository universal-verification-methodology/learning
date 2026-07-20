(() => {
  /**
   * Poke / force / release (concept)
   *   Live drive vs force hazards
   * Starter: poke + force then release on data — READY
   */

  const SIGNALS = [
    {
      id: "clk",
      label: "clk",
      kind: "clock",
      blurb: "Clock — forcing it is a hazard; prefer poke for a single edge at most.",
      safeForce: false,
    },
    {
      id: "rst_n",
      label: "rst_n",
      kind: "reset",
      blurb: "Reset — poke/force can hold reset for debug; always release afterward.",
      safeForce: true,
    },
    {
      id: "data",
      label: "data",
      kind: "data",
      blurb: "Data net — poke for a soft deposit; force sticks until release.",
      safeForce: true,
    },
  ];

  const ACT_BLURB = {
    poke: "Poke deposits a live value for the next eval — soft drive, does not stick like force.",
    force: "Force hard-overrides the net until Release — easy to forget (hazard).",
    release: "Release clears a force so normal drivers resume.",
  };

  function sigOf(id) {
    return SIGNALS.find((s) => s.id === id);
  }

  function activeForces(drive) {
    return SIGNALS.filter((s) => drive[s.id] === "forced").map((s) => s.id);
  }

  function evaluate(drive, flags) {
    const forces = activeForces(drive);
    const clkForced = drive.clk === "forced";
    const triad = flags.didPoke && flags.didForce && flags.didRelease;
    let status = "IDLE";
    let ready = false;
    let reason = "practice poke, force, and release — leave no force active";

    if (clkForced) {
      status = "HAZARD";
      reason = "clk is forced — release it (forcing clocks is unsafe)";
    } else if (forces.length > 0) {
      status = "FORCED";
      reason = `force active on ${forces.join(", ")} — release when done`;
      if (triad && forces.length === 0) {
        /* unreachable */
      }
    } else if (triad) {
      status = "READY";
      ready = true;
      reason = "poke + force + release practiced; no forces left";
    } else if (flags.didPoke || flags.didForce || flags.didRelease) {
      status = "OPEN";
      reason = "partial practice — finish poke / force / release triad";
    } else {
      status = "IDLE";
      reason = "select a signal, then Poke / Force / Release";
    }

    return { status, ready, reason, forces, clkForced, triad };
  }

  const PRESETS = {
    starter: {
      label: "starter: ready",
      drive: { clk: "normal", rst_n: "normal", data: "normal" },
      values: { clk: 0, rst_n: 1, data: 0 },
      sel: "data",
      didPoke: true,
      didForce: true,
      didRelease: true,
      note: "Poked and force→release on data — READY.",
      autoScan: true,
    },
    idle: {
      label: "idle",
      drive: { clk: "normal", rst_n: "normal", data: "normal" },
      values: { clk: 0, rst_n: 1, data: 0 },
      sel: "data",
      didPoke: false,
      didForce: false,
      didRelease: false,
      note: "Idle — pick a signal and act.",
      autoScan: true,
    },
    forced_data: {
      label: "data forced",
      drive: { clk: "normal", rst_n: "normal", data: "forced" },
      values: { clk: 0, rst_n: 1, data: 1 },
      sel: "data",
      didPoke: false,
      didForce: true,
      didRelease: false,
      note: "data forced — FORCED until Release.",
      autoScan: true,
    },
    clk_hazard: {
      label: "clk forced",
      drive: { clk: "forced", rst_n: "normal", data: "normal" },
      values: { clk: 1, rst_n: 1, data: 0 },
      sel: "clk",
      didPoke: false,
      didForce: true,
      didRelease: false,
      note: "clk forced — HAZARD.",
      autoScan: true,
    },
    poked: {
      label: "data poked",
      drive: { clk: "normal", rst_n: "normal", data: "poked" },
      values: { clk: 0, rst_n: 1, data: 1 },
      sel: "data",
      didPoke: true,
      didForce: false,
      didRelease: false,
      note: "Soft poke on data — still need force/release for READY.",
      autoScan: true,
    },
    unscanned: {
      label: "idle unscanned",
      drive: { clk: "normal", rst_n: "normal", data: "normal" },
      values: { clk: 0, rst_n: 1, data: 0 },
      sel: "data",
      didPoke: false,
      didForce: false,
      didRelease: false,
      note: "Idle — act, then Scan.",
      autoScan: false,
    },
  };

  function literacyText() {
    return [
      "// Poke / force / release literacy (document aid — not a full simulator)",
      "//",
      "//   poke    → soft live deposit for the next eval (does not stick)",
      "//   force   → hard override until release (easy to forget)",
      "//   release → clear force; normal drivers resume",
      "//",
      "// Hazards: leaving force on; forcing clocks; fighting RTL drivers.",
      "// READY = poke + force + release practiced, and no force left active.",
      "// Pair with hdl-sim-hello-dut and hdl-sim-step-continue.",
    ].join("\n");
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.drive, p);
    return {
      preset: "starter",
      drive: { ...p.drive },
      values: { ...p.values },
      sel: p.sel,
      didPoke: p.didPoke,
      didForce: p.didForce,
      didRelease: p.didRelease,
      selAct: "poke",
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: ${ev.status}`],
    };
  }

  const CLEARED_KEY = "ddv-hdl-sim-poke-force-cleared-v1";
  const STORE_KEY = "ddv-hdl-sim-poke-force-session-v1";

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

  const root = document.getElementById("hpf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        poke + force→release on <code>data</code> — no forces left — READY.</p>
      <button type="button" class="btn btn-secondary" id="hpf-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Poke</h3><p>Soft live deposit for the next eval.</p></div>
        <div class="idea-card"><h3>Force</h3><p>Hard override until release.</p></div>
        <div class="idea-card"><h3>Release</h3><p>Clear force; drivers resume.</p></div>
        <div class="idea-card"><h3>Hazard</h3><p>Stuck force · forcing clocks.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="hpf-controls">
        <div class="hpf-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>ready starter</option>
            <option value="idle">idle</option>
            <option value="forced_data">data forced</option>
            <option value="clk_hazard">clk forced</option>
            <option value="poked">data poked</option>
            <option value="unscanned">idle unscanned</option>
          </select>
        </div>
        <div class="hpf-field">
          <label for="sel-val">Deposit value</label>
          <select id="sel-val">
            <option value="0">0</option>
            <option value="1" selected>1</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-poke">Poke</button>
        <button type="button" class="btn btn-secondary" id="btn-force">Force</button>
        <button type="button" class="btn btn-ghost" id="btn-release">Release</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo force hazard</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="hpf-layout">
        <div class="panel-box">
          <h3>Actions</h3>
          <div class="chip-row" id="act-row"></div>
          <h3>Signals</h3>
          <ul class="sig-list" id="sig-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Drive sketch</h3>
          <pre class="plan-box" id="plan-box"></pre>
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
  const selVal = /** @type {HTMLSelectElement} */ (document.getElementById("sel-val"));

  function planSketch() {
    const lines = SIGNALS.map((s) => {
      const d = state.drive[s.id];
      const v = state.values[s.id];
      return `${s.label.padEnd(6)} drive=${d.padEnd(8)} val=${v}`;
    });
    return `# poke / force session
${lines.join("\n")}
did: poke=${state.didPoke ? 1 : 0} force=${state.didForce ? 1 : 0} release=${state.didRelease ? 1 : 0}
# status: ${state.lastScanned ? state.status : "— (Scan)"}
# reason: ${state.lastScanned ? state.reason : "—"}`;
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
  }

  function flags() {
    return {
      didPoke: state.didPoke,
      didForce: state.didForce,
      didRelease: state.didRelease,
    };
  }

  function runScan(silent) {
    const ev = evaluate(state.drive, flags());
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status}`);
    if (!silent) {
      state.lastAction = ev.ready ? "scan-ok" : "scan-bad";
      pushLog(`# scan ${ev.status}`);
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
    state.drive = { ...p.drive };
    state.values = { ...p.values };
    state.sel = p.sel;
    state.didPoke = p.didPoke;
    state.didForce = p.didForce;
    state.didRelease = p.didRelease;
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.lastScanned = false;
    syncInputs();
    if (p.autoScan) {
      runScan(true);
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

  function doPoke() {
    if (!state.sel) {
      state.lastAction = "poke-bad";
      pushLog("# poke FAIL");
      renderAll();
      return;
    }
    const v = Number(selVal.value);
    state.values[state.sel] = v;
    if (state.drive[state.sel] !== "forced") {
      state.drive[state.sel] = "poked";
    }
    state.didPoke = true;
    state.selAct = "poke";
    state.preset = "custom";
    pushTrace(`poke: ${state.sel}=${v}`);
    pushLog(`# poke ${state.sel}=${v}`);
    runScan(true);
    state.lastAction = "poke";
    renderAll();
  }

  function doForce() {
    if (!state.sel) {
      state.lastAction = "force-bad";
      pushLog("# force FAIL");
      renderAll();
      return;
    }
    const v = Number(selVal.value);
    state.values[state.sel] = v;
    state.drive[state.sel] = "forced";
    state.didForce = true;
    state.selAct = "force";
    state.preset = "custom";
    pushTrace(`force: ${state.sel}=${v}`);
    pushLog(`# force ${state.sel}=${v}`);
    runScan(true);
    state.lastAction = "force";
    renderAll();
  }

  function doRelease() {
    if (!state.sel) {
      state.lastAction = "release-bad";
      pushLog("# release FAIL");
      renderAll();
      return;
    }
    state.drive[state.sel] = "normal";
    state.didRelease = true;
    state.selAct = "release";
    state.preset = "custom";
    pushTrace(`release: ${state.sel}`);
    pushLog(`# release ${state.sel}`);
    runScan(true);
    state.lastAction = "release";
    renderAll();
  }

  function demo() {
    applyPreset("clk_hazard", "demo");
    state.demoed = true;
    pushLog("# demo clk force HAZARD");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain poke/force/release");
    pushTrace("explain: poke soft · force sticky · release clears → READY");
    renderAll();
  }

  function selectSig(id) {
    state.sel = id;
    state.lastAction = "select";
    renderAll();
  }

  function selectAct(id) {
    state.selAct = id;
    state.lastAction = "select-act";
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const sig = sigOf(state.sel);
    const ev = evaluate(state.drive, flags());

    document.getElementById("act-row").innerHTML = ["poke", "force", "release"]
      .map((id) => {
        const on = state.selAct === id;
        return `<button type="button" class="chip ${on ? "is-on" : ""}" data-act="${id}">
          <span class="k">act</span>${id}
        </button>`;
      })
      .join("");
    document.querySelectorAll("[data-act]").forEach((el) => {
      el.addEventListener("click", () =>
        selectAct(/** @type {string} */ (el.getAttribute("data-act")))
      );
    });

    document.getElementById("sig-list").innerHTML = SIGNALS.map((s) => {
      const d = state.drive[s.id];
      const tagCls =
        d === "forced" ? (s.id === "clk" ? "is-bad" : "is-warn") : d === "poked" ? "is-ok" : "is-ok";
      return `<li class="${state.sel === s.id ? "is-sel" : ""}" data-sig="${s.id}">
        <span class="id">${s.label}</span>
        <span class="tag">${state.values[s.id]}</span>
        <span class="tag ${tagCls}">${d}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-sig]").forEach((el) => {
      el.addEventListener("click", () =>
        selectSig(/** @type {string} */ (el.getAttribute("data-sig")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    let blurb = "Select a signal, choose deposit value, then Poke / Force / Release.";
    if (state.lastAction === "select-act" && ACT_BLURB[state.selAct]) {
      blurb = ACT_BLURB[state.selAct];
    } else if (sig) blurb = sig.blurb;
    document.getElementById("role-blurb").textContent = blurb;

    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("code-box").textContent = literacyText();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastScanned) {
      v.className = "verdict idle";
      v.textContent = "Idle — Poke / Force / Release / Scan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `READY — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">ready=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${ev.forces.length ? "is-bad" : "is-ok"}">forces=${ev.forces.length}</span>
      <span class="flag ${ev.clkForced ? "is-bad" : "is-ok"}">clk_force=${ev.clkForced ? 1 : 0}</span>
      <span class="flag ${ev.triad ? "is-ok" : "is-bad"}">triad=${ev.triad ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          drive: state.drive,
          values: state.values,
          sel: state.sel,
          didPoke: state.didPoke,
          didForce: state.didForce,
          didRelease: state.didRelease,
          selAct: state.selAct,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-poke",
      title: "Quiz: poke",
      type: "quiz",
      prompt: "Poke means…",
      hint: "Soft deposit.",
      choices: [
        "a soft live deposit for the next eval (does not stick like force)",
        "a permanent override until reboot",
        "only VCD export",
        "enabling -Wall",
      ],
      answer:
        "a soft live deposit for the next eval (does not stick like force)",
    },
    {
      id: "quiz-force",
      title: "Quiz: force",
      type: "quiz",
      prompt: "Force…",
      hint: "Sticky.",
      choices: [
        "hard-overrides a net until release — easy to forget",
        "is identical to poke",
        "only works on Files pane",
        "clears breakpoints",
      ],
      answer: "hard-overrides a net until release — easy to forget",
    },
    {
      id: "quiz-release",
      title: "Quiz: release",
      type: "quiz",
      prompt: "Release…",
      hint: "Clear force.",
      choices: [
        "clears a force so normal drivers resume",
        "deletes the DUT",
        "starts Continue",
        "sets UVM_TESTNAME",
      ],
      answer: "clears a force so normal drivers resume",
    },
    {
      id: "quiz-hazard",
      title: "Quiz: hazard",
      type: "quiz",
      prompt: "A common force hazard is…",
      hint: "Clock / stuck.",
      choices: [
        "leaving force on, or forcing clocks",
        "using Step once",
        "opening Hierarchy",
        "loading a counter DUT",
      ],
      answer: "leaving force on, or forcing clocks",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — READY.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "READY",
    },
    {
      id: "load-idle",
      title: "Load idle",
      prompt: "Load idle — IDLE.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () =>
        state.status === "IDLE" && state.lastAction === "load",
    },
    {
      id: "load-forced",
      title: "Load forced",
      prompt: "Load data forced — FORCED.",
      hint: "data forced → Load",
      setup: () => {
        selPreset.value = "forced_data";
        loadPreset();
      },
      check: () =>
        state.status === "FORCED" &&
        state.drive.data === "forced",
    },
    {
      id: "load-hazard",
      title: "Load clk hazard",
      prompt: "Load clk forced — HAZARD.",
      hint: "clk forced → Load",
      setup: () => {
        selPreset.value = "clk_hazard";
        loadPreset();
      },
      check: () =>
        state.status === "HAZARD" &&
        state.drive.clk === "forced",
    },
    {
      id: "poke",
      title: "Poke data",
      prompt: "From idle, Poke data=1.",
      hint: "Select data → Poke",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        state.sel = "data";
        selVal.value = "1";
        doPoke();
      },
      check: () =>
        state.didPoke &&
        state.drive.data === "poked" &&
        state.lastAction === "poke",
    },
    {
      id: "force",
      title: "Force data",
      prompt: "From idle, Force data=1.",
      hint: "Force",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        state.sel = "data";
        selVal.value = "1";
        doForce();
      },
      check: () =>
        state.drive.data === "forced" &&
        state.lastAction === "force",
    },
    {
      id: "release",
      title: "Release data",
      prompt: "From data forced, Release — cleared.",
      hint: "Release",
      setup: () => {
        selPreset.value = "forced_data";
        loadPreset();
        state.sel = "data";
        doRelease();
      },
      check: () =>
        state.drive.data === "normal" &&
        state.didRelease &&
        state.lastAction === "release",
    },
    {
      id: "triad",
      title: "Full triad",
      prompt: "From idle: Poke, Force, Release on data — READY.",
      hint: "Poke → Force → Release",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        state.sel = "data";
        selVal.value = "1";
        doPoke();
        doForce();
        doRelease();
      },
      check: () =>
        state.ready &&
        state.didPoke &&
        state.didForce &&
        state.didRelease &&
        state.drive.data === "normal",
    },
    {
      id: "release-clk",
      title: "Release clk",
      prompt: "From clk hazard, Release clk.",
      hint: "Release",
      setup: () => {
        selPreset.value = "clk_hazard";
        loadPreset();
        state.sel = "clk";
        doRelease();
      },
      check: () =>
        state.drive.clk === "normal" &&
        state.lastAction === "release",
    },
    {
      id: "select",
      title: "Select rst_n",
      prompt: "Click the rst_n signal row.",
      hint: "Click rst_n",
      setup: () => {
        loadStarter();
        selectSig("rst_n");
      },
      check: () =>
        state.sel === "rst_n" && state.lastAction === "select",
    },
    {
      id: "select-act",
      title: "Select force tip",
      prompt: "Click the force action chip.",
      hint: "Click force",
      setup: () => {
        loadStarter();
        selectAct("force");
      },
      check: () =>
        state.selAct === "force" &&
        state.lastAction === "select-act",
    },
    {
      id: "scan-ok",
      title: "Scan READY",
      prompt: "On starter, Scan — READY.",
      hint: "Scan",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () =>
        state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan FORCED",
      prompt: "On data forced, Scan — FORCED.",
      hint: "data forced → Scan",
      setup: () => {
        selPreset.value = "forced_data";
        loadPreset();
        runScan(false);
      },
      check: () =>
        !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo hazard",
      prompt: "Click Demo force hazard.",
      hint: "Demo force hazard",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "HAZARD" &&
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
      prompt: "Literacy sketch mentions force or release.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /force|release/i.test(literacyText()),
    },
    {
      id: "idle-scan",
      title: "Load unscanned",
      prompt: "Load idle unscanned — not yet scanned.",
      hint: "idle unscanned → Load",
      setup: () => {
        selPreset.value = "unscanned";
        loadPreset();
      },
      check: () =>
        !state.lastScanned && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From clk hazard, Reset — READY again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "clk_hazard";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "READY",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="hpf-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("hpf-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-poke").addEventListener("click", () => doPoke());
  document.getElementById("btn-force").addEventListener("click", () => doForce());
  document.getElementById("btn-release").addEventListener("click", () => doRelease());
  document.getElementById("btn-scan").addEventListener("click", () => runScan(false));
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
        state.drive = saved.drive || state.drive;
        state.values = saved.values || state.values;
        state.sel = saved.sel || "data";
        state.didPoke = !!saved.didPoke;
        state.didForce = !!saved.didForce;
        state.didRelease = !!saved.didRelease;
        state.selAct = saved.selAct || "poke";
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
        syncInputs();
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
