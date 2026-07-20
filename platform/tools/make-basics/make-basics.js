(() => {
  /**
   * Simulated chip Makefile:
   *   SIM ?= iverilog
   *   TB  ?= tb_alu
   *   RTL = rtl/alu.v
   *   build/$(TB).vvp: $(RTL) tb/$(TB).v | build
   *   build:
   *   .PHONY: sim clean
   *   sim: build/$(TB).vvp
   *   clean: rm -rf build
   */

  function makeStarter() {
    let t = 10;
    const files = {
      "rtl/alu.v": { present: true, mtime: t++ },
      "tb/tb_alu.v": { present: true, mtime: t++ },
      "tb/tb_top.v": { present: true, mtime: t++ },
      build: { present: false, mtime: 0, dir: true },
      "build/tb_alu.vvp": { present: false, mtime: 0 },
      "build/tb_top.vvp": { present: false, mtime: 0 },
    };
    return {
      files,
      clock: t,
      SIM: "iverilog",
      TB: "tb_alu",
      lastAction: "",
      lastRan: [],
      lastUpToDate: false,
      ranSim: false,
      ranClean: false,
      touchedRtl: false,
      changedTb: false,
      builtOnce: false,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-make-basics-cleared-v1";
  const STORE_KEY = "ddv-make-basics-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("mb-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Chip Makefile with <code>sim</code>,
        <code>build/$(TB).vvp</code> deps, and <code>.PHONY: sim clean</code>.
        Run <code>make sim</code>, touch RTL, run again — see the rebuild.</p>
      <button type="button" class="btn btn-secondary" id="mb-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
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
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>target: deps</h3>
            <p>Recipe runs if target is missing or older than any dependency.</p>
          </div>
          <div class="idea-card">
            <h3>.PHONY</h3>
            <p>Marks names that are not real files — always run if requested.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Makefile</h2></div>
        <div class="panel-body">
          <div class="var-row" id="var-row"></div>
          <pre class="makefile-view" id="makefile-view"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Filesystem &amp; Make</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <pre class="files-box" id="files-box"></pre>
          <p style="font-size:0.85rem;color:var(--muted);margin:0.65rem 0 0.35rem">Touch (bump mtime)</p>
          <div class="touch-row">
            <button type="button" data-f="rtl/alu.v">rtl/alu.v</button>
            <button type="button" data-f="tb/tb_alu.v">tb/tb_alu.v</button>
            <button type="button" data-f="tb/tb_top.v">tb/tb_top.v</button>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-sim">make sim</button>
            <button type="button" id="btn-sim-top">make sim TB=tb_top</button>
            <button type="button" id="btn-clean">make clean</button>
            <button type="button" id="btn-noop">make sim (again / up-to-date?)</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Make output</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Piece</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>target: dep1 dep2</code></td><td>Build target from deps</td></tr>
            <tr><td>Tab-indented lines</td><td>Recipe shell commands</td></tr>
            <tr><td><code>VAR ?= value</code></td><td>Default assign (override from CLI)</td></tr>
            <tr><td><code>$(VAR)</code></td><td>Expand variable</td></tr>
            <tr><td><code>.PHONY: sim clean</code></td><td>Not real files — always eligible</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>If Make prints nothing useful and says up to date, nothing was older.</li>
          <li>Order-only deps (after <code>|</code>) must exist but don’t force rebuild on timestamp — lab uses <code>build/</code> as a dir gate.</li>
          <li>Always declare phony targets like <code>sim</code>/<code>clean</code> so a file named <code>clean</code> cannot block them.</li>
        </ul>
      </div>
    </div>
  `;

  const makefileView = document.getElementById("makefile-view");
  const filesBox = document.getElementById("files-box");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");
  const varRow = document.getElementById("var-row");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 60) state.log = state.log.slice(-45);
  }

  function vvpPath(tb) {
    return `build/${tb}.vvp`;
  }

  function tbPath(tb) {
    return `tb/${tb}.v`;
  }

  function tick() {
    state.clock += 1;
    return state.clock;
  }

  function ensure(path, opts = {}) {
    if (!state.files[path]) state.files[path] = { present: false, mtime: 0 };
    Object.assign(state.files[path], opts);
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function renderMakefile() {
    makefileView.innerHTML = `<span class="cmt"># chip project Makefile (lab model)</span>
<span class="key">SIM</span> ?= iverilog
<span class="key">TB</span>  ?= tb_alu
<span class="key">RTL</span> = rtl/alu.v

<span class="phony">.PHONY</span>: sim clean

<span class="target">build</span>:
\tmkdir -p build

<span class="target">build/$(TB).vvp</span>: $(RTL) tb/$(TB).v | build
\t$(SIM) -g2012 -o $@ $(RTL) tb/$(TB).v

<span class="target">sim</span>: build/$(TB).vvp
\tvvp build/$(TB).vvp

<span class="target">clean</span>:
\trm -rf build`;
  }

  function renderVars() {
    varRow.innerHTML = `SIM=<strong>${escapeHtml(state.SIM)}</strong> · TB=<strong>${escapeHtml(
      state.TB
    )}</strong> · clock=${state.clock}`;
  }

  function renderFiles() {
    const order = [
      "rtl/alu.v",
      "tb/tb_alu.v",
      "tb/tb_top.v",
      "build",
      "build/tb_alu.vvp",
      "build/tb_top.vvp",
    ];
    filesBox.innerHTML = order
      .map((p) => {
        const f = state.files[p] || { present: false, mtime: 0 };
        const cls = !f.present ? "gone" : p.startsWith("build") ? "out" : "src";
        const meta = f.present ? `mtime=${f.mtime}` : "missing";
        return `<span class="${cls}">${escapeHtml(p)}  ${meta}</span>`;
      })
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no make runs yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderStatus() {
    const v = state.files[vvpPath(state.TB)];
    statusRow.innerHTML = `<strong>default goal idea:</strong> <code>sim</code> · current TB product ${
      v && v.present ? "present" : "missing"
    }`;
  }

  function renderAll() {
    renderMakefile();
    renderVars();
    renderFiles();
    renderLog();
    renderStatus();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter tree: sources present, build/ empty");
    renderAll();
  }

  function needsBuild(target, deps) {
    const t = state.files[target];
    if (!t || !t.present) return true;
    return deps.some((d) => {
      const f = state.files[d];
      return f && f.present && f.mtime > t.mtime;
    });
  }

  function runRecipe(lines) {
    lines.forEach((line) => pushLog("run", line));
  }

  function makeBuildDir() {
    ensure("build", { present: true, dir: true, mtime: tick() });
    pushLog("run", "mkdir -p build");
    state.lastRan.push("build");
  }

  function makeVvp(tb) {
    const out = vvpPath(tb);
    const deps = ["rtl/alu.v", tbPath(tb)];
    deps.forEach((d) => {
      if (!state.files[d] || !state.files[d].present) {
        pushLog("err", `*** No rule / missing dep: ${d}`);
        throw new Error("missing dep");
      }
    });
    if (!state.files.build || !state.files.build.present) makeBuildDir();
    if (!needsBuild(out, deps)) {
      return false;
    }
    runRecipe([
      `${state.SIM} -g2012 -o ${out} rtl/alu.v ${tbPath(tb)}`,
    ]);
    ensure(out, { present: true, mtime: tick() });
    state.lastRan.push(out);
    state.builtOnce = true;
    return true;
  }

  function makeSim(tb) {
    state.TB = tb;
    state.lastRan = [];
    state.lastUpToDate = false;
    pushLog("muted", `$ make sim${tb !== "tb_alu" ? ` TB=${tb}` : ""}`);
    try {
      const rebuilt = makeVvp(tb);
      if (!rebuilt && state.files[vvpPath(tb)].present) {
        // still run vvp for phony sim — phony always runs recipe
        pushLog("run", `vvp ${vvpPath(tb)}`);
        pushLog("ok", `# sim ok (used existing ${vvpPath(tb)})`);
        state.lastRan.push("sim");
        state.lastUpToDate = true;
      } else {
        pushLog("run", `vvp ${vvpPath(tb)}`);
        pushLog("ok", `# sim ok`);
        state.lastRan.push("sim");
      }
      state.ranSim = true;
      state.lastAction = "sim";
    } catch {
      state.lastAction = "sim-fail";
    }
    renderAll();
  }

  function makeClean() {
    pushLog("muted", `$ make clean`);
    pushLog("run", "rm -rf build");
    ["build", "build/tb_alu.vvp", "build/tb_top.vvp"].forEach((p) => {
      ensure(p, { present: false, mtime: 0 });
    });
    state.ranClean = true;
    state.lastAction = "clean";
    state.lastRan = ["clean"];
    state.lastUpToDate = false;
    pushLog("ok", `# build/ removed`);
    renderAll();
  }

  function touch(path) {
    ensure(path, { present: true, mtime: tick() });
    state.lastAction = "touch";
    if (path === "rtl/alu.v") state.touchedRtl = true;
    if (path.startsWith("tb/")) state.changedTb = true;
    pushLog("warn", `# touch ${path} → mtime=${state.files[path].mtime}`);
    renderAll();
  }

  document.getElementById("btn-sim").addEventListener("click", () => makeSim("tb_alu"));
  document.getElementById("btn-sim-top").addEventListener("click", () => makeSim("tb_top"));
  document.getElementById("btn-clean").addEventListener("click", makeClean);
  document.getElementById("btn-noop").addEventListener("click", () => {
    // second sim without changes — vvp recipe of phony still runs but compile skipped
    makeSim(state.TB);
    if (state.lastUpToDate) state.lastAction = "sim-uptodate";
  });
  document.getElementById("mb-starter").addEventListener("click", loadStarter);
  document.querySelectorAll(".touch-row button").forEach((b) => {
    b.addEventListener("click", () => touch(b.getAttribute("data-f")));
  });

  const CHALLENGES = [
    {
      id: "quiz-target",
      title: "Quiz: target",
      prompt: "Left of the colon is the? Answer: <code>target</code>",
      hint: "what Make builds",
      type: "text",
      answer: "target",
      alt: ["the target"],
    },
    {
      id: "quiz-deps",
      title: "Quiz: deps",
      prompt: "Right of the colon are? Answer: <code>dependencies</code> or <code>prerequisites</code>",
      hint: "inputs",
      type: "text",
      answer: "dependencies",
      alt: ["deps", "prerequisites", "prereqs"],
    },
    {
      id: "quiz-phony",
      title: "Quiz: phony",
      prompt: "Declare non-file goals with? Answer: <code>.PHONY</code>",
      hint: "special target",
      type: "text",
      answer: ".phony",
      alt: [".PHONY", "phony"],
    },
    {
      id: "quiz-var",
      title: "Quiz: expand",
      prompt: "Expand a variable with? Answer: <code>$(NAME)</code>",
      hint: "dollar parens",
      type: "text",
      answer: "$(name)",
      alt: ["$(VAR)", "$(TB)", "$()", "$(...)"],
    },
    {
      id: "first-sim",
      title: "First sim",
      prompt: "Run <strong>make sim</strong> — creates <code>build/tb_alu.vvp</code> and runs vvp.",
      hint: "make sim button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranSim &&
        state.files["build/tb_alu.vvp"] &&
        state.files["build/tb_alu.vvp"].present,
    },
    {
      id: "uptodate",
      title: "Up to date compile",
      prompt: "After a successful sim, run sim again without touching sources — compile skipped (uptodate).",
      hint: "sim → sim again",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastUpToDate && state.ranSim && state.files["build/tb_alu.vvp"]?.present,
    },
    {
      id: "touch-rebuild",
      title: "Touch rebuilds",
      prompt: "Build once, touch <code>rtl/alu.v</code>, make sim — iverilog runs again.",
      hint: "sim → touch rtl → sim",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.touchedRtl &&
        state.ranSim &&
        state.lastRan.includes("build/tb_alu.vvp") &&
        state.log.some((l) => /iverilog.*tb_alu/.test(l.text)),
    },
    {
      id: "clean",
      title: "Clean",
      prompt: "After building, <strong>make clean</strong> — build artifacts gone.",
      hint: "sim → clean",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranClean &&
        (!state.files["build/tb_alu.vvp"] || !state.files["build/tb_alu.vvp"].present) &&
        (!state.files.build || !state.files.build.present),
    },
    {
      id: "tb-override",
      title: "TB override",
      prompt: "Run <strong>make sim TB=tb_top</strong> — builds <code>build/tb_top.vvp</code>.",
      hint: "TB=tb_top button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.files["build/tb_top.vvp"] &&
        state.files["build/tb_top.vvp"].present &&
        state.TB === "tb_top",
    },
    {
      id: "quiz-recipe",
      title: "Quiz: recipe",
      prompt: "Recipe lines must start with a? Answer: <code>tab</code>",
      hint: "not spaces",
      type: "text",
      answer: "tab",
      alt: ["a tab", "tab character"],
    },
    {
      id: "quiz-qmark",
      title: "Quiz: ?=",
      prompt: "<code>TB ?= tb_alu</code> means? Answer: <code>default</code>",
      hint: "overridable",
      type: "text",
      answer: "default",
      alt: ["default assign", "default value", "optional default"],
    },
    {
      id: "quiz-why-phony",
      title: "Quiz: why phony",
      prompt: "Without .PHONY, a file named <code>clean</code> could? Answer: <code>block</code> the clean target",
      hint: "Make thinks it's up to date",
      type: "text",
      answer: "block",
      alt: ["block clean", "prevent", "skip", "stop"],
    },
    {
      id: "rebuild-after-clean",
      title: "Rebuild after clean",
      prompt: "sim → clean → sim — vvp created again.",
      hint: "full cycle",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranClean &&
        state.ranSim &&
        state.files["build/tb_alu.vvp"] &&
        state.files["build/tb_alu.vvp"].present &&
        state.lastAction === "sim",
    },
    {
      id: "quiz-order",
      title: "Quiz: order",
      prompt: "In <code>sim: build/$(TB).vvp</code>, Make builds the? Answer: <code>dep</code> first",
      hint: "prerequisite",
      type: "text",
      answer: "dep",
      alt: ["dependency", "prerequisite", "vvp", "deps"],
    },
    {
      id: "both-vvps",
      title: "Both vvps",
      prompt: "Build both <code>tb_alu</code> and <code>tb_top</code> products (two make sim variants).",
      hint: "sim then TB=tb_top",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.files["build/tb_alu.vvp"]?.present &&
        state.files["build/tb_top.vvp"]?.present,
    },
    {
      id: "quiz-mkdir",
      title: "Quiz: build dir",
      prompt: "Lab creates output dir with? Answer: <code>mkdir -p build</code>",
      hint: "build target",
      type: "text",
      answer: "mkdir -p build",
      alt: ["mkdir build", "mkdir -p"],
    },
    {
      id: "touch-tb",
      title: "Touch TB",
      prompt: "Build alu sim, touch <code>tb/tb_alu.v</code>, sim again — iverilog reruns.",
      hint: "sim → touch tb → sim",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.changedTb &&
        state.lastRan.includes("build/tb_alu.vvp") &&
        state.log.filter((l) => /iverilog.*tb_alu/.test(l.text)).length >= 2,
    },
    {
      id: "starter-missing-vvp",
      title: "Starter missing out",
      prompt: "Load starter — <code>build/tb_alu.vvp</code> missing.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => !state.files["build/tb_alu.vvp"]?.present,
    },
    {
      id: "quiz-sim-tool",
      title: "Quiz: SIM",
      prompt: "Default SIM in the lab Makefile? Answer: <code>iverilog</code>",
      hint: "SIM ?=",
      type: "text",
      answer: "iverilog",
    },
    {
      id: "clean-then-uptodate-false",
      title: "Not uptodate after clean",
      prompt: "After clean, next sim must compile (not uptodate skip).",
      hint: "clean → sim",
      type: "state",
      setup: () => {
        loadStarter();
        makeSim("tb_alu");
        makeClean();
      },
      check: () => {
        // user runs sim after setup
        return (
          state.ranClean &&
          state.lastAction === "sim" &&
          state.lastRan.includes("build/tb_alu.vvp") &&
          !state.lastUpToDate
        );
      },
    },
    {
      id: "quiz-default-tb",
      title: "Quiz: default TB",
      prompt: "Default TB variable? Answer: <code>tb_alu</code>",
      hint: "TB ?=",
      type: "text",
      answer: "tb_alu",
    },
    {
      id: "full-flow",
      title: "Full flow",
      prompt: "sim → touch rtl → sim → clean — end with no build artifacts.",
      hint: "complete the sequence",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranSim &&
        state.touchedRtl &&
        state.ranClean &&
        !state.files.build?.present,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

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
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:14rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use Make actions, then Check.</span>`;
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
    saveSession();
  }

  function checkChallenge() {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      if (typeof ch.setup === "function") ch.setup();
      const ans = normalizeAns(document.getElementById("chal-ans")?.value || "");
      const want = [ch.answer, ...(ch.alt || [])].map(normalizeAns);
      ok = want.includes(ans);
    } else {
      try {
        ok = !!ch.check();
      } catch {
        ok = false;
      }
    }
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

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });

  // Fix uptodate challenge: btn-noop sets lastAction
  // When makeSim runs and compile skipped, lastUpToDate true but lastAction is "sim"
  // Update makeSim path for second button - already sets sim-uptodate on btn-noop

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
