(() => {
  /**
   * Dry-run mindset:
   *   preview ( -n / --dry-run / echo ) → confirm targets → live run
   * Commands: make -n clean, rm -rf build/, git clean -nd, echo-first rm
   */

  function makeFiles() {
    return {
      "rtl/alu.v": { present: true, kind: "keep" },
      "tb/tb_alu.v": { present: true, kind: "keep" },
      Makefile: { present: true, kind: "keep" },
      "README.md": { present: true, kind: "keep" },
      "build/tb_alu.vvp": { present: true, kind: "junk" },
      "build/wave.vcd": { present: true, kind: "junk" },
      "logs/sim.log": { present: true, kind: "junk" },
      "tmp/scratch.txt": { present: true, kind: "junk" },
      "untracked.o": { present: true, kind: "junk" },
    };
  }

  function makeStarter() {
    return {
      files: makeFiles(),
      preferDry: true,
      lastAction: "",
      lastMode: "", // dry | live | echo
      lastCmd: "",
      lastTargets: [],
      deletedLive: false,
      ranMakeDry: false,
      ranMakeLive: false,
      ranRmDry: false,
      ranRmLive: false,
      ranGitDry: false,
      ranGitLive: false,
      ranEcho: false,
      keptSource: true,
      log: [],
      preview: [],
    };
  }

  const CLEARED_KEY = "ddv-dry-run-lab-cleared-v1";
  const STORE_KEY = "ddv-dry-run-lab-session-v1";

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

  const root = document.getElementById("dr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Chip tree with junk in <code>build/</code>,
        <code>logs/</code>, and an untracked <code>untracked.o</code>.
        Prefer dry-run, preview cleans, then run live only when the list looks right.</p>
      <button type="button" class="btn btn-secondary" id="dr-starter">Load starter example</button>
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
        <div class="habit-flow" id="habit-flow">
          <span data-h="preview">1. Preview</span>
          <span class="sep">→</span>
          <span data-h="read">2. Read the list</span>
          <span class="sep">→</span>
          <span data-h="live">3. Live only if OK</span>
        </div>
        <div class="idea-grid">
          <div class="idea-card">
            <h3>-n / --dry-run</h3>
            <p>Show what would run or delete — no real change.</p>
          </div>
          <div class="idea-card">
            <h3>Echo-first</h3>
            <p>Print the command (<code>echo rm …</code>) before pasting the real one.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Workspace</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <pre class="files-box" id="files-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Commands</h2></div>
        <div class="panel-body">
          <div class="mode-bar">
            <label><input type="checkbox" id="prefer-dry" checked> Prefer dry-run / -n</label>
          </div>
          <pre class="preview-box" id="preview-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-make">make clean  (or make -n clean)</button>
            <button type="button" id="btn-rm">rm -rf build/ logs/  (or dry)</button>
            <button type="button" id="btn-git">git clean -fd  (or -nd)</button>
            <button type="button" id="btn-echo">echo-first: echo rm -rf build/</button>
            <button type="button" class="danger" id="btn-live-force">Force live (ignore prefer)</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Output</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Tool</th><th>Preview flag</th></tr></thead>
          <tbody>
            <tr><td>Make</td><td><code>make -n clean</code> — print recipes, do not run</td></tr>
            <tr><td>rm (GNU)</td><td><code>rm -n</code> / prefer listing paths first</td></tr>
            <tr><td>git clean</td><td><code>git clean -nd</code> — show, do not delete</td></tr>
            <tr><td>rsync</td><td><code>rsync --dry-run …</code></td></tr>
            <tr><td>Any shell</td><td><code>echo</code> the command before running it</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Dry-run never replaces reading the path list — globs expand wider than you think.</li>
          <li>Keep prefer-dry on until the preview matches only junk.</li>
          <li>Source under <code>rtl/</code> and <code>tb/</code> should survive every clean here.</li>
        </ul>
      </div>
    </div>
  `;

  const filesBox = document.getElementById("files-box");
  const logBox = document.getElementById("log-box");
  const previewBox = document.getElementById("preview-box");
  const statusRow = document.getElementById("status-row");
  const preferDryEl = document.getElementById("prefer-dry");
  const habitFlow = document.getElementById("habit-flow");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 50) state.log = state.log.slice(-40);
  }

  function setPreview(lines) {
    state.preview = lines;
  }

  function present(path) {
    return state.files[path]?.present;
  }

  function sourcesOk() {
    return (
      present("rtl/alu.v") &&
      present("tb/tb_alu.v") &&
      present("Makefile") &&
      present("README.md")
    );
  }

  function junkTargets(kind) {
    if (kind === "make" || kind === "rm") {
      return ["build/tb_alu.vvp", "build/wave.vcd", "logs/sim.log"].filter(present);
    }
    if (kind === "git") {
      // git clean: untracked only in this lab model
      return ["tmp/scratch.txt", "untracked.o"].filter(present);
    }
    return [];
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
      preferDryEl.checked = !!state.preferDry;
      return true;
    } catch {
      return false;
    }
  }

  function renderFiles() {
    const order = Object.keys(state.files);
    filesBox.innerHTML = order
      .map((p) => {
        const f = state.files[p];
        const cls = !f.present ? "gone" : f.kind === "keep" ? "keep" : "junk";
        const hit = state.lastTargets.includes(p) ? " hit" : "";
        const meta = f.present ? f.kind : "missing";
        return `<span class="${cls}${hit}">${escapeHtml(p)}  # ${meta}</span>`;
      })
      .join("\n");
  }

  function renderPreview() {
    if (!state.preview.length) {
      previewBox.innerHTML = '<span class="muted">(preview appears when you run a command)</span>';
      return;
    }
    previewBox.innerHTML = state.preview
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no commands yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderStatus() {
    const junkLeft = Object.values(state.files).filter(
      (f) => f.kind === "junk" && f.present
    ).length;
    statusRow.innerHTML = `<strong>prefer dry:</strong> ${
      state.preferDry ? "on" : "off"
    } · junk left: ${junkLeft} · sources: ${sourcesOk() ? "ok" : "MISSING"}`;
  }

  function renderHabit() {
    const previewed = ["dry", "echo"].includes(state.lastMode);
    const lived = state.lastMode === "live";
    habitFlow.querySelectorAll("[data-h]").forEach((el) => {
      const h = el.getAttribute("data-h");
      let on = false;
      if (h === "preview") on = previewed || lived;
      if (h === "read") on = state.lastTargets.length > 0;
      if (h === "live") on = lived;
      el.classList.toggle("on", on);
    });
  }

  function renderAll() {
    state.keptSource = sourcesOk();
    renderFiles();
    renderPreview();
    renderLog();
    renderStatus();
    renderHabit();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    preferDryEl.checked = true;
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: junk in build/ logs/ tmp/ + untracked.o — prefer dry-run");
    setPreview([]);
    renderAll();
  }

  function deletePaths(paths) {
    paths.forEach((p) => {
      if (state.files[p]) state.files[p].present = false;
    });
    state.deletedLive = true;
  }

  function runMake(forceLive) {
    const dry = forceLive ? false : state.preferDry;
    const targets = junkTargets("make");
    state.lastTargets = targets;
    state.lastCmd = dry ? "make -n clean" : "make clean";
    state.lastMode = dry ? "dry" : "live";
    state.lastAction = dry ? "make-dry" : "make-live";
    pushLog("run", `$ ${state.lastCmd}`);
    if (dry) {
      state.ranMakeDry = true;
      setPreview([
        { kind: "muted", text: "# make -n clean — would run:" },
        { kind: "would", text: "rm -rf build logs" },
        ...targets.map((t) => ({ kind: "would", text: `would remove ${t}` })),
      ]);
      pushLog("warn", "# dry-run: nothing deleted");
    } else {
      state.ranMakeLive = true;
      setPreview([
        { kind: "err", text: "# LIVE make clean" },
        ...targets.map((t) => ({ kind: "would", text: `remove ${t}` })),
      ]);
      deletePaths(targets);
      // also remove empty-ish build/logs conceptually
      pushLog("ok", "# cleaned build/ logs artifacts");
    }
    renderAll();
  }

  function runRm(forceLive) {
    const dry = forceLive ? false : state.preferDry;
    const targets = junkTargets("rm");
    state.lastTargets = targets;
    state.lastCmd = dry ? "rm -n -rf build/ logs/" : "rm -rf build/ logs/";
    state.lastMode = dry ? "dry" : "live";
    state.lastAction = dry ? "rm-dry" : "rm-live";
    pushLog("run", `$ ${state.lastCmd}`);
    if (dry) {
      state.ranRmDry = true;
      setPreview([
        { kind: "muted", text: "# rm dry / list first:" },
        ...targets.map((t) => ({ kind: "would", text: `would remove ${t}` })),
        { kind: "safe", text: "# rtl/ tb/ untouched" },
      ]);
      pushLog("warn", "# dry-run: nothing deleted");
    } else {
      state.ranRmLive = true;
      setPreview([
        { kind: "err", text: "# LIVE rm -rf build/ logs/" },
        ...targets.map((t) => ({ kind: "would", text: `removed ${t}` })),
      ]);
      deletePaths(targets);
      pushLog("ok", "# removed build/ logs junk");
    }
    renderAll();
  }

  function runGit(forceLive) {
    const dry = forceLive ? false : state.preferDry;
    const targets = junkTargets("git");
    state.lastTargets = targets;
    state.lastCmd = dry ? "git clean -nd" : "git clean -fd";
    state.lastMode = dry ? "dry" : "live";
    state.lastAction = dry ? "git-dry" : "git-live";
    pushLog("run", `$ ${state.lastCmd}`);
    if (dry) {
      state.ranGitDry = true;
      setPreview([
        { kind: "muted", text: "# git clean -nd — would remove untracked:" },
        ...targets.map((t) => ({ kind: "would", text: `Would remove ${t}` })),
      ]);
      pushLog("warn", "# dry-run: nothing deleted");
    } else {
      state.ranGitLive = true;
      setPreview([
        { kind: "err", text: "# LIVE git clean -fd" },
        ...targets.map((t) => ({ kind: "would", text: `Removing ${t}` })),
      ]);
      deletePaths(targets);
      pushLog("ok", "# untracked junk removed");
    }
    renderAll();
  }

  function runEcho() {
    state.ranEcho = true;
    state.lastMode = "echo";
    state.lastAction = "echo";
    state.lastCmd = "echo rm -rf build/";
    state.lastTargets = junkTargets("rm").filter((t) => t.startsWith("build/"));
    pushLog("run", "$ echo rm -rf build/");
    pushLog("ok", "rm -rf build/");
    setPreview([
      { kind: "safe", text: "# echo-first: printed only — disk unchanged" },
      { kind: "would", text: "rm -rf build/" },
      { kind: "muted", text: "# if the line looks right, run it without echo" },
    ]);
    renderAll();
  }

  preferDryEl.addEventListener("change", () => {
    state.preferDry = preferDryEl.checked;
    renderAll();
  });

  document.getElementById("dr-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-make").addEventListener("click", () => runMake(false));
  document.getElementById("btn-rm").addEventListener("click", () => runRm(false));
  document.getElementById("btn-git").addEventListener("click", () => runGit(false));
  document.getElementById("btn-echo").addEventListener("click", runEcho);
  document.getElementById("btn-live-force").addEventListener("click", () => {
    // force live on whichever was last family, default make
    const a = state.lastAction;
    if (a.startsWith("rm") || a === "echo") runRm(true);
    else if (a.startsWith("git")) runGit(true);
    else runMake(true);
  });

  const CHALLENGES = [
    {
      id: "quiz-flag",
      title: "Quiz: Make preview",
      prompt: "Make flag to print recipes without running? Answer: <code>-n</code>",
      hint: "make -n",
      type: "text",
      answer: "-n",
      alt: ["n", "make -n", "--just-print", "--dry-run"],
    },
    {
      id: "quiz-git",
      title: "Quiz: git clean preview",
      prompt: "Preview untracked deletes with? Answer: <code>git clean -nd</code>",
      hint: "n = dry, d = dirs",
      type: "text",
      answer: "git clean -nd",
      alt: ["git clean -n", "clean -nd", "-nd"],
    },
    {
      id: "quiz-echo",
      title: "Quiz: echo-first",
      prompt: "Safer first step before a scary rm? Answer: <code>echo</code>",
      hint: "print the command",
      type: "text",
      answer: "echo",
      alt: ["echo-first", "echo the command"],
    },
    {
      id: "quiz-order",
      title: "Quiz: order",
      prompt: "Do dry-run before live delete? Answer: <code>yes</code>",
      hint: "mindset",
      type: "text",
      answer: "yes",
      alt: ["y", "true", "always"],
    },
    {
      id: "prefer-on",
      title: "Prefer dry on",
      prompt: "Load starter — Prefer dry-run / -n is checked.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.preferDry,
    },
    {
      id: "make-dry",
      title: "make -n clean",
      prompt: "With prefer dry on, run make clean — must be dry (nothing deleted).",
      hint: "prefer on → make button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranMakeDry &&
        state.lastMode === "dry" &&
        present("build/tb_alu.vvp"),
    },
    {
      id: "rm-dry",
      title: "rm dry",
      prompt: "Prefer dry on → rm button — preview would-remove, files still present.",
      hint: "rm button with prefer on",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranRmDry &&
        state.lastMode === "dry" &&
        present("logs/sim.log"),
    },
    {
      id: "git-dry",
      title: "git clean -nd",
      prompt: "Prefer dry → git clean — would remove untracked.o, still present.",
      hint: "git button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranGitDry &&
        state.lastMode === "dry" &&
        present("untracked.o"),
    },
    {
      id: "echo-first",
      title: "Echo-first",
      prompt: "Run echo-first — prints rm line, does not delete build junk.",
      hint: "echo-first button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranEcho &&
        state.lastMode === "echo" &&
        present("build/tb_alu.vvp"),
    },
    {
      id: "make-live-after",
      title: "Live after dry",
      prompt: "Dry make, then turn prefer off and make again — build junk gone, rtl kept.",
      hint: "dry → uncheck prefer → make",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranMakeDry &&
        state.ranMakeLive &&
        !present("build/tb_alu.vvp") &&
        sourcesOk(),
    },
    {
      id: "force-live",
      title: "Force live",
      prompt: "With prefer still on, use Force live after a dry make — deletes for real.",
      hint: "make dry → Force live",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.preferDry &&
        state.ranMakeDry &&
        state.deletedLive &&
        !present("build/wave.vcd") &&
        sourcesOk(),
    },
    {
      id: "git-live",
      title: "git clean live",
      prompt: "Dry git clean, then prefer off and git clean — untracked.o gone.",
      hint: "git dry → prefer off → git",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranGitDry &&
        state.ranGitLive &&
        !present("untracked.o") &&
        sourcesOk(),
    },
    {
      id: "quiz-rsync",
      title: "Quiz: rsync",
      prompt: "rsync preview flag? Answer: <code>--dry-run</code>",
      hint: "long flag",
      type: "text",
      answer: "--dry-run",
      alt: ["-n", "dry-run"],
    },
    {
      id: "sources-survive",
      title: "Sources survive",
      prompt: "Any live clean — <code>rtl/alu.v</code> and <code>tb/tb_alu.v</code> still present.",
      hint: "run a live clean of junk only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.deletedLive &&
        present("rtl/alu.v") &&
        present("tb/tb_alu.v"),
    },
    {
      id: "quiz-mindset",
      title: "Quiz: mindset",
      prompt: "Dry-run replaces reading the path list? Answer: <code>no</code>",
      hint: "still read",
      type: "text",
      answer: "no",
      alt: ["n", "false", "never"],
    },
    {
      id: "preview-lists",
      title: "Preview lists paths",
      prompt: "After a dry rm, lastTargets include a build path.",
      hint: "prefer on → rm",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastMode === "dry" &&
        state.lastTargets.some((t) => t.startsWith("build/")),
    },
    {
      id: "prefer-off-danger",
      title: "Prefer off is live",
      prompt: "Uncheck prefer, run rm once — deletes without prior dry in this run.",
      hint: "uncheck → rm (starter reset)",
      type: "state",
      setup: () => {
        loadStarter();
        state.preferDry = false;
        preferDryEl.checked = false;
        renderAll();
      },
      check: () =>
        !state.preferDry &&
        state.ranRmLive &&
        state.lastMode === "live" &&
        !present("logs/sim.log"),
    },
    {
      id: "quiz-clean-fd",
      title: "Quiz: live git clean",
      prompt: "Live untracked wipe (lab)? Answer: <code>git clean -fd</code>",
      hint: "force + dirs",
      type: "text",
      answer: "git clean -fd",
      alt: ["git clean -df", "clean -fd"],
    },
    {
      id: "echo-then-rm",
      title: "Echo then rm",
      prompt: "Echo-first, then prefer off and rm live — build junk gone.",
      hint: "echo → prefer off → rm",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranEcho &&
        state.ranRmLive &&
        !present("build/tb_alu.vvp") &&
        sourcesOk(),
    },
    {
      id: "make-targets-only-junk",
      title: "Make targets junk",
      prompt: "Dry make — lastTargets must not include rtl files.",
      hint: "make with prefer on",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranMakeDry &&
        state.lastTargets.length > 0 &&
        !state.lastTargets.some((t) => t.startsWith("rtl/")),
    },
    {
      id: "quiz-habit",
      title: "Quiz: habit",
      prompt: "Three steps: preview → read list → ? Answer: <code>live</code>",
      hint: "core ideas flow",
      type: "text",
      answer: "live",
      alt: ["live run", "run live", "live only if ok"],
    },
    {
      id: "full-habit",
      title: "Full habit",
      prompt: "Dry make + dry git + echo, then one live make — sources ok, some junk gone.",
      hint: "preview tools then live make",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranMakeDry &&
        state.ranGitDry &&
        state.ranEcho &&
        state.ranMakeLive &&
        sourcesOk() &&
        !present("build/tb_alu.vvp"),
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use dry-run actions, then Check.</span>`;
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

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
