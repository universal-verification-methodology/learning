(() => {
  /**
   * Submission reproducibility:
   *   clean tree → run from repo root → capture log → ready to zip/push
   */

  const ROOT = "/home/lab/chip-lab";
  const HOME = "/home/lab";

  function makeStarter() {
    return {
      cwd: ROOT,
      files: {
        "rtl/alu.v": { present: true, tracked: true, kind: "src" },
        "tb/tb_alu.v": { present: true, tracked: true, kind: "src" },
        Makefile: { present: true, tracked: true, kind: "src" },
        "scripts/run_demo.sh": { present: true, tracked: true, kind: "src" },
        "scripts/check_ready.sh": { present: true, tracked: true, kind: "src" },
        ".env.example": { present: true, tracked: true, kind: "src" },
        ".env": { present: true, tracked: false, kind: "secret" },
        "build/out.vvp": { present: true, tracked: false, kind: "junk" },
        "logs/old.log": { present: true, tracked: false, kind: "junk" },
        "notes.tmp": { present: true, tracked: false, kind: "junk" },
        "run.log": { present: false, tracked: false, kind: "log" },
      },
      lastAction: "",
      lastRunOk: false,
      ranFromRoot: false,
      ranFromWrong: false,
      capturedLog: false,
      cleanedJunk: false,
      removedSecret: false,
      ranStatus: false,
      ranCheck: false,
      treeClean: false,
      log: [],
      runOut: [],
    };
  }

  const CLEARED_KEY = "ddv-submission-repro-cleared-v1";
  const STORE_KEY = "ddv-submission-repro-session-v1";

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

  const root = document.getElementById("sr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Lab repo with source plus junk (<code>build/</code>,
        <code>notes.tmp</code>), a local <code>.env</code>, and no <code>run.log</code> yet.
        Clean, run from root, capture the log.</p>
      <button type="button" class="btn btn-secondary" id="sr-starter">Load starter example</button>
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
        <div class="flow-row" id="flow-row">
          <span data-f="clean">1. Clean tree</span>
          <span class="sep">→</span>
          <span data-f="root">2. Scripts from root</span>
          <span class="sep">→</span>
          <span data-f="log">3. Capture log</span>
          <span class="sep">→</span>
          <span data-f="ready">4. Ready</span>
        </div>
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Clean tree</h3>
            <p>No junk, no secrets — graders unzip what you meant to send.</p>
          </div>
          <div class="idea-card">
            <h3>Root + logs</h3>
            <p>Run <code>scripts/…</code> from repo root; save stdout to <code>run.log</code>.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Submit checklist</h2></div>
        <div class="panel-body">
          <div class="score-pill bad" id="score-pill">not ready</div>
          <ul class="check-list" id="check-list"></ul>
          <p class="status-row" id="status-row"></p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Tree &amp; run</h2></div>
        <div class="panel-body">
          <p class="cwd-banner"><span>pwd</span> <code id="cwd-display"></code></p>
          <pre class="files-box" id="files-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-cd-root">cd chip-lab (repo root)</button>
            <button type="button" id="btn-cd-rtl">cd rtl (wrong for scripts)</button>
            <button type="button" id="btn-clean">Clean junk (rm build logs notes.tmp)</button>
            <button type="button" id="btn-rm-env">Remove .env from tree (keep .env.example)</button>
            <button type="button" id="btn-status">git status</button>
            <button type="button" id="btn-run">bash scripts/run_demo.sh</button>
            <button type="button" id="btn-tee">bash scripts/run_demo.sh 2&gt;&amp;1 | tee run.log</button>
            <button type="button" id="btn-check">bash scripts/check_ready.sh</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Last run</h3>
          <pre class="run-box" id="run-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Habit</th><th>Why</th></tr></thead>
          <tbody>
            <tr><td>Clean junk before zip</td><td>Smaller archive; no accidental secrets</td></tr>
            <tr><td>Never ship <code>.env</code></td><td>Secrets; ship <code>.env.example</code> only</td></tr>
            <tr><td>Run from repo root</td><td>Relative paths in scripts match the README</td></tr>
            <tr><td><code>tee run.log</code></td><td>Stdout+stderr saved for the grader</td></tr>
            <tr><td><code>git status</code> clean-ish</td><td>Know what you are sending</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>If a script fails with “No such file”, check <code>pwd</code> first.</li>
          <li>Reproducible means someone else can follow your README from a clean clone.</li>
          <li>Capture the log from a successful root run, not from a broken cwd.</li>
        </ul>
      </div>
    </div>
  `;

  const filesBox = document.getElementById("files-box");
  const logBox = document.getElementById("log-box");
  const runBox = document.getElementById("run-box");
  const cwdDisplay = document.getElementById("cwd-display");
  const statusRow = document.getElementById("status-row");
  const scorePill = document.getElementById("score-pill");
  const checkList = document.getElementById("check-list");
  const flowRow = document.getElementById("flow-row");

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

  function setRun(lines) {
    state.runOut = lines;
  }

  function atRoot() {
    return state.cwd === ROOT;
  }

  function present(p) {
    return !!state.files[p]?.present;
  }

  function junkGone() {
    return (
      !present("build/out.vvp") &&
      !present("logs/old.log") &&
      !present("notes.tmp")
    );
  }

  function secretGone() {
    return !present(".env");
  }

  function computeReady() {
    return (
      atRoot() &&
      junkGone() &&
      secretGone() &&
      state.capturedLog &&
      present("run.log") &&
      state.ranFromRoot &&
      state.lastRunOk
    );
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

  function checklistItems() {
    return [
      {
        id: "at-root",
        ok: atRoot(),
        label: "cwd is repo root",
      },
      {
        id: "no-junk",
        ok: junkGone(),
        label: "junk removed (build / logs / notes.tmp)",
      },
      {
        id: "no-secret",
        ok: secretGone(),
        label: ".env not in submission tree",
      },
      {
        id: "ran-root",
        ok: state.ranFromRoot && state.lastRunOk,
        label: "demo script succeeded from root",
      },
      {
        id: "has-log",
        ok: state.capturedLog && present("run.log"),
        label: "run.log captured",
      },
    ];
  }

  function renderChecklist() {
    const items = checklistItems();
    checkList.innerHTML = items
      .map(
        (it) => `<li>
          <input type="checkbox" disabled ${it.ok ? "checked" : ""} aria-label="${escapeHtml(it.label)}">
          <span>${it.ok ? "✓" : "○"} ${escapeHtml(it.label)}</span>
        </li>`
      )
      .join("");
    const ready = computeReady();
    scorePill.className = "score-pill " + (ready ? "ok" : "bad");
    scorePill.textContent = ready ? "submission ready" : "not ready";
  }

  function renderFiles() {
    const order = Object.keys(state.files);
    filesBox.innerHTML = order
      .map((p) => {
        const f = state.files[p];
        let cls = "ok";
        if (!f.present) cls = "gone";
        else if (f.kind === "secret") cls = "err";
        else if (f.kind === "junk") cls = "warn";
        else if (f.kind === "log") cls = "ok";
        const meta = !f.present
          ? "missing"
          : f.tracked
            ? "tracked"
            : f.kind === "secret"
              ? "SECRET local"
              : f.kind === "log"
                ? "artifact"
                : "untracked junk";
        return `<span class="${cls}">${escapeHtml(p)}  # ${meta}</span>`;
      })
      .join("\n");
  }

  function renderCwd() {
    cwdDisplay.textContent = state.cwd;
  }

  function renderRun() {
    if (!state.runOut.length) {
      runBox.innerHTML = '<span class="muted">(no script run yet)</span>';
      return;
    }
    runBox.innerHTML = state.runOut
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(actions appear here)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderStatus() {
    statusRow.innerHTML = `<strong>ready:</strong> ${
      computeReady() ? "yes" : "no"
    } · junk gone: ${junkGone()} · secret gone: ${secretGone()} · log: ${
      present("run.log") ? "yes" : "no"
    }`;
  }

  function renderFlow() {
    const map = {
      clean: junkGone() && secretGone(),
      root: state.ranFromRoot && state.lastRunOk,
      log: state.capturedLog,
      ready: computeReady(),
    };
    flowRow.querySelectorAll("[data-f]").forEach((el) => {
      el.classList.toggle("on", !!map[el.getAttribute("data-f")]);
    });
  }

  function renderAll() {
    state.treeClean = junkGone() && secretGone();
    renderCwd();
    renderFiles();
    renderChecklist();
    renderRun();
    renderLog();
    renderStatus();
    renderFlow();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: dirty tree + .env present — clean before submit");
    setRun([]);
    renderAll();
  }

  function doCd(where) {
    if (where === "root") {
      state.cwd = ROOT;
      state.lastAction = "cd-root";
      pushLog("run", "$ cd ~/chip-lab");
    } else {
      state.cwd = `${ROOT}/rtl`;
      state.lastAction = "cd-rtl";
      pushLog("run", "$ cd rtl");
    }
    renderAll();
  }

  function doClean() {
    ["build/out.vvp", "logs/old.log", "notes.tmp"].forEach((p) => {
      if (state.files[p]) state.files[p].present = false;
    });
    state.cleanedJunk = true;
    state.lastAction = "clean";
    pushLog("run", "$ rm -rf build logs/old.log notes.tmp");
    pushLog("ok", "# junk removed");
    renderAll();
  }

  function doRmEnv() {
    if (state.files[".env"]) state.files[".env"].present = false;
    state.removedSecret = true;
    state.lastAction = "rm-env";
    pushLog("run", "$ rm -f .env   # keep .env.example");
    pushLog("ok", "# .env out of tree");
    renderAll();
  }

  function doStatus() {
    state.ranStatus = true;
    state.lastAction = "status";
    pushLog("run", "$ git status");
    const untracked = Object.entries(state.files)
      .filter(([, f]) => f.present && !f.tracked)
      .map(([p]) => p);
    if (!untracked.length) {
      pushLog("ok", "nothing to commit, working tree clean");
      state.treeClean = true;
    } else {
      pushLog("warn", "Untracked files:");
      untracked.forEach((p) => pushLog("warn", `  ${p}`));
      state.treeClean = false;
    }
    renderAll();
  }

  function doRun(withTee) {
    pushLog("run", withTee
      ? "$ bash scripts/run_demo.sh 2>&1 | tee run.log"
      : "$ bash scripts/run_demo.sh");
    if (!atRoot()) {
      state.ranFromWrong = true;
      state.lastRunOk = false;
      state.lastAction = withTee ? "tee-fail" : "run-fail";
      setRun([
        { kind: "err", text: "bash: scripts/run_demo.sh: No such file or directory" },
        { kind: "muted", text: `# cwd=${state.cwd} — cd to repo root` },
      ]);
      pushLog("err", "# failed — wrong directory");
      if (withTee && state.files["run.log"]) {
        // failed tee may still create empty — lab: do not mark captured
        state.files["run.log"].present = false;
      }
      state.capturedLog = false;
      renderAll();
      return;
    }
    state.ranFromRoot = true;
    state.lastRunOk = true;
    state.lastAction = withTee ? "tee" : "run";
    const lines = [
      { kind: "run", text: "demo: compile rtl/alu.v + tb/tb_alu.v" },
      { kind: "ok", text: "PASS 4/4" },
      { kind: "ok", text: "demo done" },
    ];
    setRun(lines);
    pushLog("ok", "# demo ok from root");
    if (withTee) {
      state.capturedLog = true;
      state.files["run.log"] = {
        present: true,
        tracked: false,
        kind: "log",
      };
      pushLog("ok", "# wrote run.log");
    }
    renderAll();
  }

  function doCheckReady() {
    state.ranCheck = true;
    state.lastAction = "check";
    pushLog("run", "$ bash scripts/check_ready.sh");
    if (!atRoot()) {
      setRun([
        { kind: "err", text: "bash: scripts/check_ready.sh: No such file or directory" },
      ]);
      pushLog("err", "# check failed — wrong cwd");
      renderAll();
      return;
    }
    const ready = computeReady();
    setRun([
      {
        kind: ready ? "ok" : "err",
        text: ready ? "check_ready: OK — submit" : "check_ready: NOT READY",
      },
      {
        kind: "muted",
        text: `# junk=${junkGone()} secret=${secretGone()} log=${state.capturedLog}`,
      },
    ]);
    pushLog(ready ? "ok" : "warn", ready ? "# ready" : "# fix checklist");
    renderAll();
  }

  document.getElementById("sr-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-cd-root").addEventListener("click", () => doCd("root"));
  document.getElementById("btn-cd-rtl").addEventListener("click", () => doCd("rtl"));
  document.getElementById("btn-clean").addEventListener("click", doClean);
  document.getElementById("btn-rm-env").addEventListener("click", doRmEnv);
  document.getElementById("btn-status").addEventListener("click", doStatus);
  document.getElementById("btn-run").addEventListener("click", () => doRun(false));
  document.getElementById("btn-tee").addEventListener("click", () => doRun(true));
  document.getElementById("btn-check").addEventListener("click", doCheckReady);

  const CHALLENGES = [
    {
      id: "quiz-root",
      title: "Quiz: where",
      prompt: "Run project scripts from? Answer: <code>repo root</code>",
      hint: "not rtl/",
      type: "text",
      answer: "repo root",
      alt: ["root", "project root", "repository root", "chip-lab"],
    },
    {
      id: "quiz-env",
      title: "Quiz: secrets",
      prompt: "Ship <code>.env</code> in the zip? Answer: <code>no</code>",
      hint: "secrets",
      type: "text",
      answer: "no",
      alt: ["n", "never", "false"],
    },
    {
      id: "quiz-tee",
      title: "Quiz: capture",
      prompt: "Save stdout while viewing it with? Answer: <code>tee</code>",
      hint: "pipe to tee",
      type: "text",
      answer: "tee",
      alt: ["| tee", "tee run.log"],
    },
    {
      id: "quiz-clean",
      title: "Quiz: junk",
      prompt: "Remove build artifacts before submit? Answer: <code>yes</code>",
      hint: "clean tree",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "see-dirty",
      title: "See dirty",
      prompt: "Load starter — junk and <code>.env</code> present; not ready.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        present("notes.tmp") && present(".env") && !computeReady(),
    },
    {
      id: "cd-root",
      title: "At root",
      prompt: "Ensure cwd is repo root (<code>cd chip-lab</code>).",
      hint: "cd chip-lab button",
      type: "state",
      setup: () => {
        loadStarter();
        state.cwd = `${ROOT}/rtl`;
        renderAll();
      },
      check: () => atRoot(),
    },
    {
      id: "wrong-cwd",
      title: "Wrong cwd fails",
      prompt: "From <code>rtl/</code>, run the demo — must fail (No such file).",
      hint: "cd rtl → run demo",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.ranFromWrong && !state.lastRunOk,
    },
    {
      id: "clean-junk",
      title: "Clean junk",
      prompt: "Remove build / logs / notes.tmp.",
      hint: "Clean junk button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.cleanedJunk && junkGone(),
    },
    {
      id: "rm-secret",
      title: "Drop .env",
      prompt: "Remove <code>.env</code>; keep <code>.env.example</code>.",
      hint: "Remove .env button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.removedSecret && secretGone() && present(".env.example"),
    },
    {
      id: "run-root",
      title: "Run from root",
      prompt: "From root, run <code>bash scripts/run_demo.sh</code> successfully.",
      hint: "cd root → run",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.ranFromRoot && state.lastRunOk && atRoot(),
    },
    {
      id: "capture-log",
      title: "Capture log",
      prompt: "From root, tee into <code>run.log</code>.",
      hint: "tee button at root",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.capturedLog && present("run.log") && state.ranFromRoot,
    },
    {
      id: "status-after-clean",
      title: "Status after clean",
      prompt: "Clean junk + remove .env, then <code>git status</code>.",
      hint: "clean → rm .env → status",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        junkGone() &&
        secretGone() &&
        state.ranStatus &&
        !Object.entries(state.files).some(
          ([p, f]) => f.present && !f.tracked && p !== "run.log"
        ),
    },
    {
      id: "quiz-relative",
      title: "Quiz: paths",
      prompt: "Scripts use paths relative to? Answer: <code>repo root</code>",
      hint: "README assumption",
      type: "text",
      answer: "repo root",
      alt: ["root", "project root", "cwd root"],
    },
    {
      id: "tee-not-from-rtl",
      title: "Tee needs root",
      prompt: "From rtl, tee fails and does not count as captured log.",
      hint: "cd rtl → tee",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranFromWrong &&
        state.lastAction === "tee-fail" &&
        !state.capturedLog,
    },
    {
      id: "example-stays",
      title: "Example stays",
      prompt: "After removing .env, <code>.env.example</code> still present.",
      hint: "Remove .env only",
      type: "state",
      setup: () => loadStarter(),
      check: () => secretGone() && present(".env.example"),
    },
    {
      id: "check-ready-fail",
      title: "Check not ready",
      prompt: "At root on dirty starter, run check_ready — NOT READY.",
      hint: "check_ready without cleaning",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranCheck &&
        !computeReady() &&
        state.runOut.some((l) => /NOT READY/i.test(l.text)),
    },
    {
      id: "full-ready",
      title: "Full ready",
      prompt: "Clean junk, drop .env, tee from root — submission ready.",
      hint: "complete the flow",
      type: "state",
      setup: () => loadStarter(),
      check: () => computeReady(),
    },
    {
      id: "quiz-log-name",
      title: "Quiz: log file",
      prompt: "Lab capture filename? Answer: <code>run.log</code>",
      hint: "tee target",
      type: "text",
      answer: "run.log",
      alt: ["run.log file"],
    },
    {
      id: "check-ready-ok",
      title: "Check ready OK",
      prompt: "Make submission ready, then check_ready shows OK.",
      hint: "full ready → check_ready",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        computeReady() &&
        state.ranCheck &&
        state.runOut.some((l) => /OK — submit/i.test(l.text)),
    },
    {
      id: "quiz-repro",
      title: "Quiz: repro",
      prompt: "Others replay from a clean clone + your README? Answer: <code>yes</code>",
      hint: "definition",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "src-kept",
      title: "Sources kept",
      prompt: "After clean, rtl/tb/Makefile still present.",
      hint: "Clean junk only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.cleanedJunk &&
        present("rtl/alu.v") &&
        present("tb/tb_alu.v") &&
        present("Makefile"),
    },
    {
      id: "end-to-end",
      title: "End to end",
      prompt: "Wrong-cwd fail once, then clean + rm .env + root tee + ready.",
      hint: "fail then fix fully",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.ranFromWrong &&
        computeReady() &&
        state.cleanedJunk &&
        state.removedSecret,
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use submit actions, then Check.</span>`;
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
