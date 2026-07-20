(() => {
  /**
   * Bootstrap a chip template:
   *   git clone …/chip-template.git chip-lab
   *   cd chip-lab → tree / cat README / git status / remote -v
   */

  const TEMPLATE_URL = "https://github.com/example/chip-template.git";
  const HOME = "/home/lab";
  const REPO = "chip-lab";
  const REPO_PATH = `${HOME}/${REPO}`;

  const LAYOUT = [
    { path: ".", kind: "dir" },
    { path: "README.md", kind: "file", dot: false },
    { path: "Makefile", kind: "file" },
    { path: ".gitignore", kind: "dot" },
    { path: ".env.example", kind: "dot" },
    { path: "rtl/", kind: "dir" },
    { path: "rtl/alu.v", kind: "file" },
    { path: "tb/", kind: "dir" },
    { path: "tb/tb_alu.v", kind: "file" },
    { path: "scripts/", kind: "dir" },
    { path: "scripts/check_ready.sh", kind: "file" },
    { path: ".git/", kind: "dot" },
  ];

  const FILE_CONTENTS = {
    "README.md": `# chip-lab (from chip-template)

Starter RTL project.

## Quick start
1. cp .env.example .env
2. make help
3. make sim

Do not commit .env.
`,
    Makefile: `.PHONY: help sim clean
help:
\t@echo "sim clean help"
SIM ?= iverilog
TB  ?= tb_alu
sim:
\t$(SIM) -o build/$(TB).vvp rtl/alu.v tb/$(TB).v
\tvvp build/$(TB).vvp
clean:
\trm -rf build
`,
    ".gitignore": `build/
*.vcd
*.log
.env
.env.local
`,
    ".env.example": `TOOLS=/opt/eda
SIM=iverilog
`,
    "rtl/alu.v": "module alu;\nendmodule\n",
    "tb/tb_alu.v": "module tb_alu;\nendmodule\n",
    "scripts/check_ready.sh": "#!/usr/bin/env bash\necho ready-check ok\n",
  };

  function makeStarter() {
    return {
      cloned: false,
      cwd: HOME,
      branch: "main",
      remoteUrl: TEMPLATE_URL,
      dirty: false,
      lastAction: "",
      lastCmd: "",
      viewedFile: "",
      ranStatus: false,
      ranRemote: false,
      ranBranch: false,
      ranTree: false,
      ranLs: false,
      readReadme: false,
      readMakefile: false,
      readGitignore: false,
      cdInto: false,
      usedTemplateBtn: false,
      usedCloneBtn: false,
      screen: [],
    };
  }

  const CLEARED_KEY = "ddv-template-clone-cleared-v1";
  const STORE_KEY = "ddv-template-clone-session-v1";

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

  const root = document.getElementById("tc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Empty home. Clone <code>chip-template</code> into
        <code>chip-lab</code> (or use-template), <code>cd</code> in, inspect layout, then
        <code>git status</code>.</p>
      <button type="button" class="btn btn-secondary" id="tc-starter">Load starter example</button>
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
            <h3>Template → your copy</h3>
            <p><strong>Use this template</strong> (writable) or <code>git clone</code> the template URL.</p>
          </div>
          <div class="idea-card">
            <h3>First status</h3>
            <p>After clone: clean tree on <code>main</code>, <code>origin</code> points at the remote.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Lab terminal</h2></div>
        <div class="panel-body">
          <p class="cwd-banner"><span>pwd</span><code id="cwd-display"></code></p>
          <div class="status-pill empty" id="status-pill">no repo</div>
          <pre class="term-box" id="term-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-template">Use this template → chip-lab</button>
            <button type="button" id="btn-clone">git clone …/chip-template.git chip-lab</button>
            <button type="button" id="btn-cd">cd chip-lab</button>
            <button type="button" id="btn-cd-home">cd ~</button>
          </div>
          <p class="meta-row" style="margin-top:0.75rem"><strong>Inspect</strong></p>
          <div class="quick-row" id="inspect-row"></div>
          <p class="meta-row" style="margin-top:0.75rem"><strong>Git</strong></p>
          <div class="quick-row">
            <button type="button" data-git="status">git status</button>
            <button type="button" data-git="remote">git remote -v</button>
            <button type="button" data-git="branch">git branch</button>
            <button type="button" data-git="log">git log -1 --oneline</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Layout &amp; file</h2></div>
        <div class="panel-body">
          <p class="meta-row" id="layout-meta"></p>
          <pre class="tree-box" id="tree-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">File preview</h3>
          <pre class="file-view" id="file-view"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Step</th><th>Why</th></tr></thead>
          <tbody>
            <tr><td>Use template / clone</td><td>Get a full starter tree with history</td></tr>
            <tr><td><code>cd</code> into repo</td><td>Git commands need the project root</td></tr>
            <tr><td>Inspect layout</td><td>Find <code>rtl/</code>, <code>tb/</code>, <code>Makefile</code>, scripts</td></tr>
            <tr><td><code>git status</code></td><td>Confirm clean tree before you edit</td></tr>
            <tr><td><code>git remote -v</code></td><td>See where <code>origin</code> points</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Prefer “Use this template” when you need push access to <em>your</em> copy.</li>
          <li>A bare clone of someone else’s template may be read-only for push.</li>
          <li>Expected first status: on <code>main</code>, nothing to commit, working tree clean.</li>
        </ul>
      </div>
    </div>
  `;

  const termBox = document.getElementById("term-box");
  const treeBox = document.getElementById("tree-box");
  const fileView = document.getElementById("file-view");
  const cwdDisplay = document.getElementById("cwd-display");
  const statusPill = document.getElementById("status-pill");
  const layoutMeta = document.getElementById("layout-meta");
  const inspectRow = document.getElementById("inspect-row");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function push(kind, text) {
    state.screen.push({ kind, text });
    if (state.screen.length > 40) state.screen = state.screen.slice(-30);
  }

  function inRepo() {
    return state.cloned && state.cwd === REPO_PATH;
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

  function renderTerm() {
    if (!state.screen.length) {
      termBox.innerHTML = '<span class="muted">(empty home — clone or use template)</span>';
      return;
    }
    termBox.innerHTML = state.screen
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
    termBox.scrollTop = termBox.scrollHeight;
  }

  function renderCwd() {
    cwdDisplay.textContent = state.cwd;
  }

  function renderPill() {
    if (!state.cloned) {
      statusPill.className = "status-pill empty";
      statusPill.textContent = "no repo";
    } else if (!inRepo()) {
      statusPill.className = "status-pill empty";
      statusPill.textContent = "repo exists · not inside";
    } else if (state.dirty) {
      statusPill.className = "status-pill dirty";
      statusPill.textContent = "dirty";
    } else {
      statusPill.className = "status-pill clean";
      statusPill.textContent = "clean · main";
    }
  }

  function renderTree() {
    if (!state.cloned) {
      treeBox.innerHTML = '<span class="gone">(no chip-lab yet)</span>';
      layoutMeta.innerHTML = "<strong>layout:</strong> waiting for clone";
      return;
    }
    if (!inRepo()) {
      treeBox.innerHTML = `<span class="dir">${escapeHtml(HOME)}/</span>
<span class="dir">  ${REPO}/</span>  <span class="muted"># cd chip-lab to inspect</span>`;
      layoutMeta.innerHTML = "<strong>layout:</strong> repo on disk — enter it";
      return;
    }
    layoutMeta.innerHTML =
      "<strong>layout:</strong> chip template skeleton (rtl · tb · scripts)";
    treeBox.innerHTML = LAYOUT.map((e) => {
      if (e.path === ".") return `<span class="dir">${escapeHtml(REPO_PATH)}/</span>`;
      const cls = e.kind === "dir" ? "dir" : e.dot || e.kind === "dot" ? "dot" : "file";
      const indent = e.path.includes("/") && !e.path.endsWith("/") ? "  " : "  ";
      const name = e.path;
      return `<span class="${cls}">${indent}${escapeHtml(name)}</span>`;
    }).join("\n");
  }

  function renderFile() {
    if (!state.viewedFile || !FILE_CONTENTS[state.viewedFile]) {
      fileView.innerHTML = '<span class="cmt">(cat a file to preview)</span>';
      return;
    }
    const body = FILE_CONTENTS[state.viewedFile];
    fileView.innerHTML = `<span class="key"># ${escapeHtml(state.viewedFile)}</span>\n${escapeHtml(body)}`;
  }

  function renderInspectButtons() {
    const files = [
      "tree",
      "README.md",
      "Makefile",
      ".gitignore",
      ".env.example",
      "rtl/alu.v",
    ];
    inspectRow.innerHTML = "";
    files.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = f === "tree" ? "tree ." : `cat ${f}`;
      b.addEventListener("click", () => {
        if (f === "tree") doTree();
        else doCat(f);
      });
      inspectRow.appendChild(b);
    });
  }

  function renderAll() {
    renderCwd();
    renderPill();
    renderTerm();
    renderTree();
    renderFile();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    push("muted", "# starter: empty /home/lab — clone the chip template");
    renderAll();
  }

  function doClone(via) {
    if (state.cloned) {
      push("warn", "# already have chip-lab — reset starter to clone again");
      renderAll();
      return;
    }
    if (via === "template") {
      state.usedTemplateBtn = true;
      push("cmd", "$ # GitHub: Use this template → chip-lab");
      push("ok", "# created writable copy at " + REPO_PATH);
    } else {
      state.usedCloneBtn = true;
      push("cmd", `$ git clone ${TEMPLATE_URL} ${REPO}`);
      push("ok", `Cloning into '${REPO}'...`);
      push("ok", "done.");
    }
    state.cloned = true;
    state.lastAction = via === "template" ? "use-template" : "clone";
    state.lastCmd = via === "template" ? "use-template" : "clone";
    renderAll();
  }

  function doCd(target) {
    if (target === "home") {
      state.cwd = HOME;
      state.lastAction = "cd-home";
      push("cmd", "$ cd ~");
      renderAll();
      return;
    }
    if (!state.cloned) {
      push("err", "cd: chip-lab: No such file or directory");
      state.lastAction = "cd-fail";
      renderAll();
      return;
    }
    state.cwd = REPO_PATH;
    state.cdInto = true;
    state.lastAction = "cd";
    push("cmd", `$ cd ${REPO}`);
    renderAll();
  }

  function requireRepo() {
    if (!state.cloned) {
      push("err", "fatal: not a git repository (or any parent)");
      return false;
    }
    if (!inRepo()) {
      push("err", "fatal: not a git repository (cd chip-lab first)");
      return false;
    }
    return true;
  }

  function doTree() {
    if (!requireRepo()) {
      state.lastAction = "tree-fail";
      renderAll();
      return;
    }
    state.ranTree = true;
    state.lastAction = "tree";
    push("cmd", "$ tree .");
    LAYOUT.filter((e) => e.path !== ".").forEach((e) => {
      push("ok", e.path);
    });
    renderAll();
  }

  function doCat(path) {
    if (!requireRepo()) {
      state.lastAction = "cat-fail";
      renderAll();
      return;
    }
    if (!FILE_CONTENTS[path]) {
      push("err", `cat: ${path}: No such file`);
      renderAll();
      return;
    }
    state.viewedFile = path;
    state.lastAction = "cat";
    state.lastCmd = `cat ${path}`;
    push("cmd", `$ cat ${path}`);
    if (path === "README.md") state.readReadme = true;
    if (path === "Makefile") state.readMakefile = true;
    if (path === ".gitignore") state.readGitignore = true;
    if (path === "tree") state.ranTree = true;
    renderAll();
  }

  function doLs() {
    if (!requireRepo()) {
      state.lastAction = "ls-fail";
      renderAll();
      return;
    }
    state.ranLs = true;
    state.lastAction = "ls";
    push("cmd", "$ ls");
    push("ok", "Makefile  README.md  rtl  scripts  tb");
    renderAll();
  }

  function doGit(kind) {
    if (!requireRepo()) {
      state.lastAction = `git-${kind}-fail`;
      renderAll();
      return;
    }
    if (kind === "status") {
      state.ranStatus = true;
      state.lastAction = "status";
      push("cmd", "$ git status");
      push("ok", "On branch main");
      push("ok", "Your branch is up to date with 'origin/main'.");
      if (state.dirty) {
        push("warn", "Changes not staged for commit:");
        push("warn", "  modified:   rtl/alu.v");
      } else {
        push("ok", "nothing to commit, working tree clean");
      }
    } else if (kind === "remote") {
      state.ranRemote = true;
      state.lastAction = "remote";
      push("cmd", "$ git remote -v");
      push("ok", `origin\t${state.remoteUrl} (fetch)`);
      push("ok", `origin\t${state.remoteUrl} (push)`);
    } else if (kind === "branch") {
      state.ranBranch = true;
      state.lastAction = "branch";
      push("cmd", "$ git branch");
      push("ok", "* main");
    } else if (kind === "log") {
      state.lastAction = "log";
      push("cmd", "$ git log -1 --oneline");
      push("ok", "a1b2c3d  chore: chip-template skeleton");
    }
    renderAll();
  }

  document.getElementById("tc-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-template").addEventListener("click", () => doClone("template"));
  document.getElementById("btn-clone").addEventListener("click", () => doClone("clone"));
  document.getElementById("btn-cd").addEventListener("click", () => doCd("repo"));
  document.getElementById("btn-cd-home").addEventListener("click", () => doCd("home"));
  document.querySelectorAll("[data-git]").forEach((b) => {
    b.addEventListener("click", () => doGit(b.getAttribute("data-git")));
  });

  // Extra ls via inspect — add button
  const lsBtn = document.createElement("button");
  lsBtn.type = "button";
  lsBtn.textContent = "ls";
  lsBtn.addEventListener("click", doLs);
  // Will append after renderInspectButtons

  const CHALLENGES = [
    {
      id: "quiz-template",
      title: "Quiz: writable copy",
      prompt: "GitHub button for your own writable copy? Answer: <code>use this template</code>",
      hint: "not fork-only wording",
      type: "text",
      answer: "use this template",
      alt: ["use template", "template", "use this template button"],
    },
    {
      id: "quiz-clone",
      title: "Quiz: clone",
      prompt: "Command to copy a remote repo locally? Answer: <code>git clone</code>",
      hint: "two words",
      type: "text",
      answer: "git clone",
      alt: ["clone"],
    },
    {
      id: "quiz-status",
      title: "Quiz: first check",
      prompt: "First Git check after clone? Answer: <code>git status</code>",
      hint: "clean tree?",
      type: "text",
      answer: "git status",
      alt: ["status"],
    },
    {
      id: "quiz-origin",
      title: "Quiz: remote name",
      prompt: "Default remote name after clone? Answer: <code>origin</code>",
      hint: "remote -v",
      type: "text",
      answer: "origin",
    },
    {
      id: "clone-it",
      title: "Clone or template",
      prompt: "Create <code>chip-lab</code> via clone <em>or</em> Use this template.",
      hint: "top action buttons",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.cloned,
    },
    {
      id: "cd-in",
      title: "Enter repo",
      prompt: "After clone, <code>cd chip-lab</code> so pwd is the project root.",
      hint: "cd chip-lab",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.cloned && inRepo() && state.cdInto,
    },
    {
      id: "first-status",
      title: "First status",
      prompt: "Inside the repo, run <code>git status</code> — clean on main.",
      hint: "cd → git status",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.ranStatus && !state.dirty,
    },
    {
      id: "see-remote",
      title: "See origin",
      prompt: "Run <code>git remote -v</code> inside the repo.",
      hint: "remote -v button",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.ranRemote,
    },
    {
      id: "see-branch",
      title: "See branch",
      prompt: "Run <code>git branch</code> — on <code>main</code>.",
      hint: "git branch",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.ranBranch,
    },
    {
      id: "tree-layout",
      title: "Tree layout",
      prompt: "Inside repo, run <code>tree .</code> to list rtl/tb/scripts.",
      hint: "tree . button",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.ranTree,
    },
    {
      id: "read-readme",
      title: "Read README",
      prompt: "<code>cat README.md</code> inside the repo.",
      hint: "cat README.md",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.readReadme,
    },
    {
      id: "read-make",
      title: "Read Makefile",
      prompt: "<code>cat Makefile</code> — see sim target.",
      hint: "cat Makefile",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.readMakefile,
    },
    {
      id: "quiz-rtl",
      title: "Quiz: RTL dir",
      prompt: "Where does design source live in the template? Answer: <code>rtl/</code>",
      hint: "layout",
      type: "text",
      answer: "rtl/",
      alt: ["rtl", "rtl/alu.v"],
    },
    {
      id: "quiz-tb",
      title: "Quiz: TB dir",
      prompt: "Testbench folder? Answer: <code>tb/</code>",
      hint: "layout",
      type: "text",
      answer: "tb/",
      alt: ["tb", "tb/tb_alu.v"],
    },
    {
      id: "use-template-path",
      title: "Use template path",
      prompt: "Bootstrap with <strong>Use this template</strong> (not clone).",
      hint: "Use this template button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.cloned && state.usedTemplateBtn,
    },
    {
      id: "clone-path",
      title: "Clone path",
      prompt: "Bootstrap with <code>git clone</code> (not the template button).",
      hint: "git clone button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.cloned && state.usedCloneBtn,
    },
    {
      id: "ls-top",
      title: "ls top",
      prompt: "Inside repo, run <code>ls</code> — see Makefile README rtl…",
      hint: "ls button",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.ranLs,
    },
    {
      id: "read-ignore",
      title: "Read gitignore",
      prompt: "<code>cat .gitignore</code> — confirm <code>.env</code> is ignored.",
      hint: "cat .gitignore",
      type: "state",
      setup: () => loadStarter(),
      check: () => inRepo() && state.readGitignore,
    },
    {
      id: "quiz-clean",
      title: "Quiz: clean phrase",
      prompt: "Status phrase for no changes? Answer: <code>working tree clean</code>",
      hint: "git status output",
      type: "text",
      answer: "working tree clean",
      alt: ["nothing to commit, working tree clean", "clean"],
    },
    {
      id: "cd-before-status",
      title: "Must cd first",
      prompt: "From home without cd, status fails; then cd and status succeeds.",
      hint: "try status at ~, then cd, then status",
      type: "state",
      setup: () => {
        loadStarter();
        doClone("clone");
        // leave cwd at HOME
        state.cwd = HOME;
        state.cdInto = false;
        state.ranStatus = false;
        renderAll();
      },
      check: () =>
        state.cloned &&
        inRepo() &&
        state.cdInto &&
        state.ranStatus &&
        state.screen.some((l) => /not a git repository/i.test(l.text)),
    },
    {
      id: "quiz-main",
      title: "Quiz: default branch",
      prompt: "Default branch after clone in this lab? Answer: <code>main</code>",
      hint: "git branch",
      type: "text",
      answer: "main",
    },
    {
      id: "full-bootstrap",
      title: "Full bootstrap",
      prompt: "Clone/template → cd → tree → status → remote — all done inside repo.",
      hint: "complete the path",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.cloned &&
        inRepo() &&
        state.ranTree &&
        state.ranStatus &&
        state.ranRemote,
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use bootstrap actions, then Check.</span>`;
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

  renderInspectButtons();
  inspectRow.appendChild(lsBtn);

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
