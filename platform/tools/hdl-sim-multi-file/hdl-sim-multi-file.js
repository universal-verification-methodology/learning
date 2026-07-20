(() => {
  /**
   * Multi-file project (concept)
   *   Top · defines · +incdir · profiles in simulator UI
   * Starter: tb/tb_top.v top · WIDTH=8 · incdir include — LINKED
   */

  const FILES = [
    {
      path: "rtl/counter.v",
      role: "dut",
      blurb: "DUT module — listed on the compile line with the TB.",
    },
    {
      path: "include/counter_pkg.vh",
      role: "header",
      blurb: "`include header — simulator needs +incdir+include.",
    },
    {
      path: "tb/tb_top.v",
      role: "tb",
      blurb: "Testbench top — pick as simulation top / entry file.",
    },
  ];

  const REQUIRED = FILES.map((f) => f.path);

  const PROFILES = {
    sim: {
      label: "sim profile",
      top: "tb/tb_top.v",
      inProject: REQUIRED,
      defines: { WIDTH: "8" },
      incdirs: ["include"],
    },
    synth: {
      label: "synth profile (no TB)",
      top: "rtl/counter.v",
      inProject: ["rtl/counter.v", "include/counter_pkg.vh"],
      defines: { WIDTH: "16" },
      incdirs: ["include"],
    },
  };

  function fileOf(path) {
    return FILES.find((f) => f.path === path);
  }

  function compileLine(s) {
    const parts = [];
    s.incdirs.forEach((d) => parts.push(`+incdir+${d}`));
    Object.entries(s.defines).forEach(([k, v]) =>
      parts.push(`+define+${k}=${v}`)
    );
    if (s.top) parts.push(s.top);
    s.inProject
      .filter((p) => p !== s.top && p.endsWith(".v"))
      .forEach((p) => parts.push(p));
    return parts.join(" ");
  }

  function evaluate(s) {
    const triad = s.didTop && s.didDefine && s.didIncdir;
    const allFiles = REQUIRED.every((p) => s.inProject.includes(p));
    const topOk = s.top === "tb/tb_top.v";
    const incdirOk = s.incdirs.includes("include");
    const defineOk = s.defines.WIDTH === "8";
    const profileOk = s.profile === "sim";

    let status = "OPEN";
    let ready = false;
    let reason = "pick top, +define, and +incdir for the TB project";

    if (allFiles && topOk && incdirOk && defineOk && triad) {
      status = "LINKED";
      ready = true;
      reason = `top=${s.top} · WIDTH=8 · +incdir+include · profile=${s.profile}`;
    } else if (!allFiles) {
      status = "PARTIAL";
      reason = "enable all project files (rtl, include header, tb)";
    } else if (!topOk) {
      status = "BROKEN";
      reason = "sim top should be tb/tb_top.v (not rtl/counter.v alone)";
    } else if (!incdirOk) {
      status = "BROKEN";
      reason = "missing +incdir+include — tb cannot find counter_pkg.vh";
    } else if (!defineOk) {
      status = "BROKEN";
      reason = "missing +define+WIDTH=8 — counter width macro unset";
    } else {
      status = "PARTIAL";
      reason = "practice top / define / incdir, then Scan";
    }

    return {
      status,
      ready,
      reason,
      triad,
      allFiles,
      topOk,
      incdirOk,
      defineOk,
      profileOk,
    };
  }

  const PRESETS = {
    starter: {
      label: "starter: linked",
      top: "tb/tb_top.v",
      inProject: [...REQUIRED],
      defines: { WIDTH: "8" },
      incdirs: ["include"],
      profile: "sim",
      sel: "tb/tb_top.v",
      didTop: true,
      didDefine: true,
      didIncdir: true,
      didProfile: true,
      note: "All files · tb top · WIDTH=8 · incdir include — LINKED.",
      autoScan: true,
    },
    single: {
      label: "single file only",
      top: "",
      inProject: ["rtl/counter.v"],
      defines: {},
      incdirs: [],
      profile: "custom",
      sel: "rtl/counter.v",
      didTop: false,
      didDefine: false,
      didIncdir: false,
      didProfile: false,
      note: "Only DUT — no TB top or include path.",
      autoScan: true,
    },
    no_incdir: {
      label: "no incdir",
      top: "tb/tb_top.v",
      inProject: [...REQUIRED],
      defines: { WIDTH: "8" },
      incdirs: [],
      profile: "custom",
      sel: "tb/tb_top.v",
      didTop: true,
      didDefine: true,
      didIncdir: false,
      didProfile: false,
      note: "TB top set but +incdir missing — BROKEN.",
      autoScan: true,
    },
    no_define: {
      label: "no WIDTH define",
      top: "tb/tb_top.v",
      inProject: [...REQUIRED],
      defines: {},
      incdirs: ["include"],
      profile: "custom",
      sel: "tb/tb_top.v",
      didTop: true,
      didDefine: false,
      didIncdir: true,
      didProfile: false,
      note: "Include path ok but WIDTH macro missing — BROKEN.",
      autoScan: true,
    },
    partial: {
      label: "files only",
      top: "",
      inProject: [...REQUIRED],
      defines: {},
      incdirs: [],
      profile: "custom",
      sel: "rtl/counter.v",
      didTop: false,
      didDefine: false,
      didIncdir: false,
      didProfile: false,
      note: "All files enabled — still need top / define / incdir.",
      autoScan: true,
    },
    unscanned: {
      label: "idle unscanned",
      top: "",
      inProject: [],
      defines: {},
      incdirs: [],
      profile: "custom",
      sel: "tb/tb_top.v",
      didTop: false,
      didDefine: false,
      didIncdir: false,
      didProfile: false,
      note: "Empty project — configure, then Scan.",
      autoScan: false,
    },
  };

  function literacyText() {
    return [
      "// Multi-file simulator project literacy (document aid)",
      "//",
      "//   top       → simulation entry (usually tb/*.v)",
      "//   +define+  → preprocessor macros (e.g. WIDTH=8)",
      "//   +incdir+  → search path for `include headers",
      "//   profile   → saved top + defines + incdir combo",
      "//",
      "// LINKED = tb top + WIDTH=8 + incdir include + all files.",
      "// Pair with iverilog-flags (+incdir on CLI) and hdl-sim-tour.",
    ].join("\n");
  }

  function tbSketch() {
    return `// tb/tb_top.v (sketch)
\`include "counter_pkg.vh"
module tb_top;
  counter #(.W(\`WIDTH)) uut (.clk(clk), .q(q));
  // ...
endmodule`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p);
    return {
      preset: "starter",
      top: p.top,
      inProject: [...p.inProject],
      defines: { ...p.defines },
      incdirs: [...p.incdirs],
      profile: p.profile,
      sel: p.sel,
      didTop: p.didTop,
      didDefine: p.didDefine,
      didIncdir: p.didIncdir,
      didProfile: p.didProfile,
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

  const CLEARED_KEY = "ddv-hdl-sim-multi-file-cleared-v1";
  const STORE_KEY = "ddv-hdl-sim-multi-file-session-v1";

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

  const root = document.getElementById("hmf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        top <code>tb/tb_top.v</code> · <code>+define+WIDTH=8</code> · <code>+incdir+include</code>
        — LINKED.</p>
      <button type="button" class="btn btn-secondary" id="hmf-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Top</h3><p>Simulation entry file (TB).</p></div>
        <div class="idea-card"><h3>+define+</h3><p>Preprocessor macros.</p></div>
        <div class="idea-card"><h3>+incdir+</h3><p>include search paths for headers.</p></div>
        <div class="idea-card"><h3>Profile</h3><p>Saved project combo.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="hmf-controls">
        <div class="hmf-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>linked starter</option>
            <option value="single">single file only</option>
            <option value="no_incdir">no incdir</option>
            <option value="no_define">no WIDTH define</option>
            <option value="partial">files only</option>
            <option value="unscanned">idle unscanned</option>
          </select>
        </div>
        <div class="hmf-field">
          <label for="sel-profile">Profile</label>
          <select id="sel-profile">
            <option value="sim">sim</option>
            <option value="synth">synth</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-top">Set top</button>
        <button type="button" class="btn btn-secondary" id="btn-toggle">Toggle file</button>
        <button type="button" class="btn btn-ghost" id="btn-define">Add WIDTH=8</button>
        <button type="button" class="btn btn-ghost" id="btn-incdir">Add incdir include</button>
        <button type="button" class="btn btn-ghost" id="btn-profile">Load profile</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo no incdir</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="hmf-layout">
        <div class="panel-box">
          <h3>Project files</h3>
          <ul class="file-list" id="file-list"></ul>
          <h3>Defines</h3>
          <ul class="kv-list" id="define-list"></ul>
          <h3>Include dirs</h3>
          <ul class="kv-list" id="incdir-list"></ul>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Compile sketch</h3>
          <pre class="plan-box" id="plan-box"></pre>
          <h3 style="margin-top:0.85rem">TB sketch</h3>
          <pre class="code-box" id="tb-box"></pre>
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
  const selProfile = /** @type {HTMLSelectElement} */ (document.getElementById("sel-profile"));

  function planSketch() {
    return `# multi-file project
top: ${state.top || "—"}
profile: ${state.profile}
compile: ${compileLine(state) || "—"}
files: ${state.inProject.length}/${REQUIRED.length}
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
    selProfile.value =
      state.profile in PROFILES || state.profile === "custom"
        ? state.profile
        : "custom";
  }

  function runScan(silent) {
    const ev = evaluate(state);
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
    pushLog("# starter LINKED");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.top = p.top;
    state.inProject = [...p.inProject];
    state.defines = { ...p.defines };
    state.incdirs = [...p.incdirs];
    state.profile = p.profile;
    state.sel = p.sel;
    state.didTop = p.didTop;
    state.didDefine = p.didDefine;
    state.didIncdir = p.didIncdir;
    state.didProfile = p.didProfile ?? false;
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

  function setTop() {
    if (!state.sel || !state.inProject.includes(state.sel)) {
      state.lastAction = "top-bad";
      pushLog("# set top FAIL");
      renderAll();
      return;
    }
    state.top = state.sel;
    state.didTop = true;
    state.preset = "custom";
    state.profile = "custom";
    pushTrace(`top: ${state.top}`);
    pushLog(`# top ${state.top}`);
    runScan(true);
    state.lastAction = "top";
    renderAll();
  }

  function toggleFile() {
    if (!state.sel) {
      state.lastAction = "toggle-bad";
      renderAll();
      return;
    }
    if (state.inProject.includes(state.sel)) {
      state.inProject = state.inProject.filter((p) => p !== state.sel);
      if (state.top === state.sel) state.top = "";
    } else {
      state.inProject.push(state.sel);
      state.didAdd = true;
    }
    state.preset = "custom";
    state.profile = "custom";
    pushTrace(`toggle: ${state.sel}`);
    pushLog(`# toggle ${state.sel}`);
    runScan(true);
    state.lastAction = "toggle";
    renderAll();
  }

  function addDefine() {
    state.defines.WIDTH = "8";
    state.didDefine = true;
    state.preset = "custom";
    state.profile = "custom";
    pushTrace("define: WIDTH=8");
    pushLog("# define WIDTH=8");
    runScan(true);
    state.lastAction = "define";
    renderAll();
  }

  function addIncdir() {
    if (!state.incdirs.includes("include")) {
      state.incdirs.push("include");
    }
    state.didIncdir = true;
    state.preset = "custom";
    state.profile = "custom";
    pushTrace("incdir: include");
    pushLog("# incdir include");
    runScan(true);
    state.lastAction = "incdir";
    renderAll();
  }

  function loadProfile() {
    const id = selProfile.value;
    if (!(id in PROFILES)) {
      state.lastAction = "profile-bad";
      renderAll();
      return;
    }
    const pr = PROFILES[id];
    state.top = pr.top;
    state.inProject = [...pr.inProject];
    state.defines = { ...pr.defines };
    state.incdirs = [...pr.incdirs];
    state.profile = id;
    state.didTop = true;
    state.didDefine = Object.keys(pr.defines).length > 0;
    state.didIncdir = pr.incdirs.length > 0;
    state.didProfile = true;
    state.preset = "custom";
    pushTrace(`profile: ${id}`);
    pushLog(`# profile ${id}`);
    runScan(true);
    state.lastAction = "profile";
    renderAll();
  }

  function selectFile(path) {
    state.sel = path;
    state.lastAction = "select";
    renderAll();
  }

  function demo() {
    applyPreset("no_incdir", "demo");
    state.demoed = true;
    pushLog("# demo no incdir BROKEN");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain top / define / incdir / profile");
    pushTrace("explain: top + define + incdir + profile → LINKED");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const f = fileOf(state.sel);
    const ev = evaluate(state);

    document.getElementById("file-list").innerHTML = FILES.map((file) => {
      const on = state.inProject.includes(file.path);
      const isTop = state.top === file.path;
      return `<li class="${state.sel === file.path ? "is-sel" : ""} ${isTop ? "is-top" : ""}" data-file="${file.path}">
        <span class="path">${file.path}</span>
        <span class="tag">${file.role}</span>
        <span class="tag ${on ? "is-ok" : "is-bad"}">${on ? "in" : "out"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-file]").forEach((el) => {
      el.addEventListener("click", () =>
        selectFile(/** @type {string} */ (el.getAttribute("data-file")))
      );
    });

    document.getElementById("define-list").innerHTML =
      Object.keys(state.defines).length > 0
        ? Object.entries(state.defines)
            .map(([k, v]) => `<li>+define+${k}=${v}</li>`)
            .join("")
        : "<li>(none)</li>";

    document.getElementById("incdir-list").innerHTML =
      state.incdirs.length > 0
        ? state.incdirs.map((d) => `<li>+incdir+${d}</li>`).join("")
        : "<li>(none)</li>";

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent = f
      ? f.blurb
      : "Select a file, toggle in project, Set top, or Load profile.";

    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("tb-box").textContent = tbSketch();
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
      v.textContent = "Idle — Set top / define / incdir / Scan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `LINKED — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">linked=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${ev.allFiles ? "is-ok" : "is-bad"}">files=${state.inProject.length}/${REQUIRED.length}</span>
      <span class="flag ${ev.topOk ? "is-ok" : "is-bad"}">top=${state.top ? "set" : "—"}</span>
      <span class="flag ${ev.incdirOk ? "is-ok" : "is-bad"}">incdir=${ev.incdirOk ? 1 : 0}</span>
      <span class="flag ${ev.defineOk ? "is-ok" : "is-bad"}">WIDTH=${state.defines.WIDTH || "—"}</span>
      <span class="flag ${ev.triad ? "is-ok" : "is-bad"}">triad=${ev.triad ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          top: state.top,
          inProject: state.inProject,
          defines: state.defines,
          incdirs: state.incdirs,
          profile: state.profile,
          sel: state.sel,
          didTop: state.didTop,
          didDefine: state.didDefine,
          didIncdir: state.didIncdir,
          didProfile: state.didProfile,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-top",
      title: "Quiz: top",
      type: "quiz",
      prompt: "The simulation top file is…",
      hint: "TB entry.",
      choices: [
        "the entry point the simulator elaborates first (usually tb/*.v)",
        "always the smallest .v file",
        "only used for synthesis",
        "the GTKWave config",
      ],
      answer:
        "the entry point the simulator elaborates first (usually tb/*.v)",
    },
    {
      id: "quiz-define",
      title: "Quiz: +define+",
      type: "quiz",
      prompt: "+define+WIDTH=8…",
      hint: "Macro.",
      choices: [
        "sets a preprocessor macro the RTL/TB can use (e.g. parameter width)",
        "renames the output VVP file",
        "disables all warnings",
        "replaces +incdir",
      ],
      answer:
        "sets a preprocessor macro the RTL/TB can use (e.g. parameter width)",
    },
    {
      id: "quiz-incdir",
      title: "Quiz: +incdir+",
      type: "quiz",
      prompt: "+incdir+include lets the compiler…",
      hint: "Headers.",
      choices: [
        "find `include files like counter_pkg.vh in that directory",
        "skip the testbench",
        "force little-endian buses",
        "open the wave pane",
      ],
      answer:
        "find `include files like counter_pkg.vh in that directory",
    },
    {
      id: "quiz-profile",
      title: "Quiz: profile",
      type: "quiz",
      prompt: "A simulator profile saves…",
      hint: "Combo.",
      choices: [
        "a reusable combo of top, defines, incdirs, and file set",
        "only font size preferences",
        "the VCD binary verbatim",
        "Git commit messages",
      ],
      answer:
        "a reusable combo of top, defines, incdirs, and file set",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — LINKED.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "LINKED",
    },
    {
      id: "load-single",
      title: "Load single",
      prompt: "Load single file only — not LINKED.",
      hint: "single file only → Load",
      setup: () => {
        selPreset.value = "single";
        loadPreset();
      },
      check: () => state.status !== "LINKED" && state.inProject.length === 1,
    },
    {
      id: "load-no-incdir",
      title: "Load no incdir",
      prompt: "Load no incdir — BROKEN.",
      hint: "no incdir → Load",
      setup: () => {
        selPreset.value = "no_incdir";
        loadPreset();
      },
      check: () => state.status === "BROKEN" && state.incdirs.length === 0,
    },
    {
      id: "load-no-define",
      title: "Load no define",
      prompt: "Load no WIDTH define — BROKEN.",
      hint: "no WIDTH define → Load",
      setup: () => {
        selPreset.value = "no_define";
        loadPreset();
      },
      check: () => state.status === "BROKEN" && !state.defines.WIDTH,
    },
    {
      id: "set-top",
      title: "Set top",
      prompt: "From partial, Set top on tb/tb_top.v.",
      hint: "Select tb → Set top",
      setup: () => {
        selPreset.value = "partial";
        loadPreset();
        state.sel = "tb/tb_top.v";
        setTop();
      },
      check: () => state.top === "tb/tb_top.v" && state.lastAction === "top",
    },
    {
      id: "add-define",
      title: "Add define",
      prompt: "From no_define, Add WIDTH=8.",
      hint: "Add WIDTH=8",
      setup: () => {
        selPreset.value = "no_define";
        loadPreset();
        addDefine();
      },
      check: () =>
        state.defines.WIDTH === "8" && state.lastAction === "define",
    },
    {
      id: "add-incdir",
      title: "Add incdir",
      prompt: "From no_incdir, Add incdir include.",
      hint: "Add incdir include",
      setup: () => {
        selPreset.value = "no_incdir";
        loadPreset();
        addIncdir();
      },
      check: () =>
        state.incdirs.includes("include") &&
        state.lastAction === "incdir",
    },
    {
      id: "triad",
      title: "Triad",
      prompt: "Starter has top + define + incdir triad.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => {
        const ev = evaluate(state);
        return ev.triad && state.didTop && state.didDefine && state.didIncdir;
      },
    },
    {
      id: "toggle-file",
      title: "Toggle file",
      prompt: "From starter, Toggle rtl/counter.v off then on.",
      hint: "Toggle file twice",
      setup: () => {
        loadStarter();
        state.sel = "rtl/counter.v";
        toggleFile();
        toggleFile();
      },
      check: () =>
        state.inProject.includes("rtl/counter.v") &&
        state.lastAction === "toggle",
    },
    {
      id: "select",
      title: "Select header",
      prompt: "Select include/counter_pkg.vh.",
      hint: "Click header row",
      setup: () => {
        loadStarter();
        selectFile("include/counter_pkg.vh");
      },
      check: () =>
        state.sel === "include/counter_pkg.vh" &&
        state.lastAction === "select",
    },
    {
      id: "load-profile",
      title: "Load profile",
      prompt: "From empty, Load sim profile — top set.",
      hint: "sim profile → Load profile",
      setup: () => {
        selPreset.value = "unscanned";
        loadPreset();
        selProfile.value = "sim";
        loadProfile();
      },
      check: () =>
        state.profile === "sim" &&
        state.top === "tb/tb_top.v" &&
        state.lastAction === "profile",
    },
    {
      id: "scan-ok",
      title: "Scan LINKED",
      prompt: "On starter, Scan — LINKED.",
      hint: "Scan",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () => state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan BROKEN",
      prompt: "On no_incdir, Scan — BROKEN.",
      hint: "no incdir → Scan",
      setup: () => {
        selPreset.value = "no_incdir";
        loadPreset();
        runScan(false);
      },
      check: () => !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo no incdir",
      prompt: "Click Demo no incdir.",
      hint: "Demo no incdir",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "BROKEN" &&
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
      prompt: "Literacy sketch mentions profile or +incdir.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /profile|incdir/i.test(literacyText()),
    },
    {
      id: "compile-sketch",
      title: "Compile sketch",
      prompt: "Starter compile sketch includes +incdir+include.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        /\+incdir\+include/.test(document.getElementById("plan-box").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From single, Reset — LINKED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "single";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "LINKED",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="hmf-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("hmf-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-top").addEventListener("click", () => setTop());
  document.getElementById("btn-toggle").addEventListener("click", () => toggleFile());
  document.getElementById("btn-define").addEventListener("click", () => addDefine());
  document.getElementById("btn-incdir").addEventListener("click", () => addIncdir());
  document.getElementById("btn-profile").addEventListener("click", () => loadProfile());
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
        state.top = saved.top ?? state.top;
        state.inProject = saved.inProject || state.inProject;
        state.defines = saved.defines || state.defines;
        state.incdirs = saved.incdirs || state.incdirs;
        state.profile = saved.profile || state.profile;
        state.sel = saved.sel || state.sel;
        state.didTop = saved.didTop ?? state.didTop;
        state.didDefine = saved.didDefine ?? state.didDefine;
        state.didIncdir = saved.didIncdir ?? state.didIncdir;
        state.didProfile = saved.didProfile ?? state.didProfile;
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
