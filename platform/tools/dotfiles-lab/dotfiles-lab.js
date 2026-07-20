(() => {
  const HOME = "/home/lab";
  const PROJECT = `${HOME}/chip`;

  const CONTENTS = {
    [`${HOME}/.bashrc`]: `# ~/.bashrc — interactive shell
export PATH="$HOME/tools/bin:$PATH"
alias ll='ls -la'
# HDL tip: keep simulators on PATH
`,
    [`${HOME}/.profile`]: `# ~/.profile — login shell
# Often sources .bashrc for interactive login shells
`,
    [`${HOME}/.gitconfig`]: `[user]
\tname = Lab Student
\temail = lab@example.com
[core]
\teditor = nano
`,
    [`${HOME}/.config/git/config`]: `# XDG-style Git config (~/.config/git/config)
[color]
\tui = auto
`,
    [`${HOME}/notes.txt`]: "Visible home note — shows with plain ls.\n",
    [`${PROJECT}/.gitignore`]: `# Project ignore rules
build/
logs/
*.log
*.vcd
*.o
.DS_Store
`,
    [`${PROJECT}/.editorconfig`]: `root = true

[*.{v,sv}]
indent_style = space
indent_size = 2
`,
    [`${PROJECT}/Makefile`]: "sim:\n\tiverilog -o build/out.vvp rtl/top.v\n",
    [`${PROJECT}/README.md`]: "# chip\nRTL project with ignored build/ and logs/.\n",
    [`${PROJECT}/rtl/top.v`]: "module top; endmodule\n",
    [`${PROJECT}/build/out.vvp`]: "# generated sim binary (should be ignored)\n",
    [`${PROJECT}/logs/sim.log`]: "INFO: sim done\n",
    [`${PROJECT}/wave.vcd`]: "$timescale 1ns\n",
  };

  function makeStarter() {
    /** @type {Map<string, {kind:string}>} */
    const m = new Map();
    const dir = (p) => m.set(p, { kind: "dir" });
    const file = (p) => m.set(p, { kind: "file" });

    dir("/");
    dir("/home");
    dir(HOME);
    dir(`${HOME}/.config`);
    dir(`${HOME}/.config/git`);
    dir(PROJECT);
    dir(`${PROJECT}/rtl`);
    dir(`${PROJECT}/build`);
    dir(`${PROJECT}/logs`);
    dir(`${PROJECT}/.git`);

    file(`${HOME}/.bashrc`);
    file(`${HOME}/.profile`);
    file(`${HOME}/.gitconfig`);
    file(`${HOME}/.config/git/config`);
    file(`${HOME}/notes.txt`);

    file(`${PROJECT}/.gitignore`);
    file(`${PROJECT}/.editorconfig`);
    file(`${PROJECT}/Makefile`);
    file(`${PROJECT}/README.md`);
    file(`${PROJECT}/rtl/top.v`);
    file(`${PROJECT}/build/out.vvp`);
    file(`${PROJECT}/logs/sim.log`);
    file(`${PROJECT}/wave.vcd`);
    file(`${PROJECT}/.git/HEAD`);

    return m;
  }

  /** @type {Map<string, {kind:string}>} */
  let entries = makeStarter();
  let cwd = HOME;
  let selected = `${HOME}/.bashrc`;
  let lastLsMode = "plain"; // plain | all
  /** @type {string[]} */
  let lastLsNames = [];
  let lastCmd = "";
  let lastCat = "";
  /** @type {{kind:string,text:string}[]} */
  let screen = [];

  const CLEARED_KEY = "ddv-dotfiles-lab-cleared-v1";
  const STORE_KEY = "ddv-dotfiles-lab-session-v1";

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

  const root = document.getElementById("df-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> You are in <code>${HOME}</code>.
        Run <code>ls</code> (few names) then <code>ls -a</code> (dotfiles appear).
        Open <code>.bashrc</code>, then <code>cd chip</code> and inspect <code>.gitignore</code>.</p>
      <button type="button" class="btn btn-secondary" id="df-starter">Load starter example</button>
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
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Lab terminal</h2></div>
        <div class="panel-body">
          <p class="cwd-banner"><span>pwd</span><code id="cwd-display"></code></p>
          <div class="df-term">
            <div class="df-scroll" id="term-scroll"></div>
            <div class="df-prompt-row">
              <span class="df-prompt">lab$</span>
              <input class="df-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="ls · ls -a · cd · cat · pwd · help" aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Directory listing</h2>
          <span style="font-size:0.8rem;color:var(--muted)" id="ls-caption">ls</span>
        </div>
        <div class="panel-body">
          <div class="legend">
            <span><span class="dot-swatch">.</span>name = hidden from plain <code>ls</code></span>
          </div>
          <ul class="listing" id="listing"></ul>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.45rem">File contents</h3>
          <pre class="file-view" id="file-view"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Config homes</h2></div>
      <div class="panel-body">
        <div class="homes-grid">
          <div class="home-card">
            <h3>Home (<code>~</code>)</h3>
            <ul>
              <li><code>.bashrc</code> — interactive Bash</li>
              <li><code>.profile</code> — login shell</li>
              <li><code>.gitconfig</code> — Git identity</li>
              <li><code>.config/</code> — XDG-style configs</li>
            </ul>
          </div>
          <div class="home-card">
            <h3>Project (<code>~/chip</code>)</h3>
            <ul>
              <li><code>.gitignore</code> — exclude build/logs</li>
              <li><code>.editorconfig</code> — editor style</li>
              <li><code>.git/</code> — repository metadata</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>.gitignore preview</h2>
        <span style="font-size:0.8rem;color:var(--muted)">chip project</span>
      </div>
      <div class="panel-body">
        <p style="font-size:0.9rem;color:var(--muted);margin:0 0 0.65rem">
          Rules from <code>chip/.gitignore</code> applied to sample paths (lab matcher).
        </p>
        <table class="ignore-table" id="ignore-table"></table>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Idea</th><th>Command / fact</th></tr></thead>
          <tbody>
            <tr><td>Hidden names</td><td>Start with <code>.</code>; plain <code>ls</code> skips them</td></tr>
            <tr><td>Show all</td><td><code>ls -a</code> or <code>ls -la</code></td></tr>
            <tr><td>Home shortcut</td><td><code>~</code> → <code>${HOME}</code></td></tr>
            <tr><td>Read safely</td><td><code>cat .bashrc</code> (inspect before editing)</td></tr>
            <tr><td>Glob pitfall</td><td><code>*</code> does not match leading-dot names</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Dotfiles are normal files — the leading <code>.</code> only changes default listing.</li>
          <li>Put generated <code>build/</code>, logs, and waveforms in <code>.gitignore</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const cwdEl = document.getElementById("cwd-display");
  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const listingEl = document.getElementById("listing");
  const fileView = document.getElementById("file-view");
  const lsCaption = document.getElementById("ls-caption");
  const ignoreTable = document.getElementById("ignore-table");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function dirname(p) {
    if (p === "/") return "/";
    const i = p.lastIndexOf("/");
    if (i <= 0) return "/";
    return p.slice(0, i);
  }

  function basename(p) {
    if (p === "/") return "/";
    return p.slice(p.lastIndexOf("/") + 1);
  }

  function joinPath(base, rel) {
    if (!rel || rel === ".") return base;
    if (rel === "~") return HOME;
    if (rel.startsWith("~/")) return HOME + rel.slice(1);
    if (rel.startsWith("/")) {
      const parts = rel.split("/").filter((x) => x && x !== ".");
      const stack = [];
      for (const part of parts) {
        if (part === "..") {
          if (stack.length) stack.pop();
        } else stack.push(part);
      }
      return "/" + stack.join("/");
    }
    const parts = (base === "/" ? [] : base.split("/").filter(Boolean)).concat(
      rel.split("/").filter((x) => x && x !== ".")
    );
    const stack = [];
    for (const part of parts) {
      if (part === "..") {
        if (stack.length) stack.pop();
      } else stack.push(part);
    }
    return "/" + stack.join("/");
  }

  function toAbs(userPath) {
    return joinPath(cwd, userPath);
  }

  function listNames(dir, showHidden) {
    const prefix = dir === "/" ? "/" : dir + "/";
    const names = [];
    for (const p of entries.keys()) {
      if (p === dir) continue;
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (!rest || rest.includes("/")) continue;
      if (!showHidden && rest.startsWith(".")) continue;
      names.push(rest);
    }
    return names.sort((a, b) => a.localeCompare(b));
  }

  function isDotName(name) {
    return name.startsWith(".") && name !== "." && name !== "..";
  }

  /** Simple gitignore matcher for lab paths relative to project root */
  function ignoredByGitignore(relPath, rulesText) {
    const rules = rulesText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    const path = relPath.replace(/^\.\//, "");
    for (const rule of rules) {
      if (rule.endsWith("/")) {
        const dir = rule.slice(0, -1);
        if (path === dir || path.startsWith(dir + "/")) return true;
      } else if (rule.startsWith("*.")) {
        const ext = rule.slice(1); // .log
        if (path.endsWith(ext) || basename(path).endsWith(ext)) return true;
      } else if (rule.includes("*")) {
        // minimal: *.x already handled; treat as suffix/prefix lightly
        const re = new RegExp(
          "^" + rule.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
        );
        if (re.test(path) || re.test(basename(path))) return true;
      } else if (path === rule || basename(path) === rule) {
        return true;
      }
    }
    return false;
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 90) screen = screen.slice(-70);
  }

  function renderScreen() {
    scrollEl.innerHTML = screen
      .map((row) => {
        const cls =
          row.kind === "cmd"
            ? ""
            : row.kind === "err"
              ? "err"
              : row.kind === "muted"
                ? "muted"
                : row.kind === "dot"
                  ? "dot"
                  : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderListing() {
    const showHidden = lastLsMode === "all";
    const names = listNames(cwd, true);
    lastLsNames = listNames(cwd, showHidden);
    lsCaption.textContent = showHidden ? "ls -a" : "ls (dotfiles hidden)";
    listingEl.innerHTML = "";
    for (const name of names) {
      const p = joinPath(cwd, name);
      const e = entries.get(p);
      const hidden = isDotName(name);
      const li = document.createElement("li");
      li.textContent = e.kind === "dir" ? name + "/" : name;
      if (hidden) li.classList.add("is-dot");
      if (e.kind === "dir") li.classList.add("is-dir");
      if (!showHidden && hidden) li.classList.add("is-hidden-note");
      if (p === selected) li.classList.add("is-selected");
      li.title = hidden && !showHidden ? "Hidden from plain ls — use ls -a" : p;
      li.addEventListener("click", () => {
        selected = p;
        renderListing();
        renderFile();
      });
      listingEl.appendChild(li);
    }
  }

  function renderFile() {
    const e = entries.get(selected);
    if (!e) {
      fileView.innerHTML = `<span class="empty">Nothing selected</span>`;
      return;
    }
    if (e.kind === "dir") {
      fileView.innerHTML = `<span class="empty">${escapeHtml(selected)}/ — directory (cd or ls -a)</span>`;
      return;
    }
    const body = CONTENTS[selected];
    if (body == null) {
      fileView.innerHTML = `<span class="empty">${escapeHtml(basename(selected))} (binary / empty in lab)</span>`;
      return;
    }
    fileView.textContent = body;
  }

  function renderIgnore() {
    const rules = CONTENTS[`${PROJECT}/.gitignore`] || "";
    const samples = [
      "rtl/top.v",
      "Makefile",
      "README.md",
      "build/out.vvp",
      "logs/sim.log",
      "wave.vcd",
      "run.log",
      ".editorconfig",
    ];
    const rows = samples
      .map((rel) => {
        const ign = ignoredByGitignore(rel, rules);
        return `<tr><td>${escapeHtml(rel)}</td><td class="${ign ? "yes" : "no"}">${ign ? "ignored" : "tracked-ok"}</td></tr>`;
      })
      .join("");
    ignoreTable.innerHTML = `<thead><tr><th>path</th><th>status</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderAll() {
    cwdEl.textContent = cwd;
    renderScreen();
    renderListing();
    renderFile();
    renderIgnore();
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen("out", "pwd · cd DIR · ls · ls -a · ls -la · cat FILE · help");
      return;
    }
    if (t === "pwd") {
      pushScreen("out", cwd);
      return;
    }

    let m;
    if ((m = t.match(/^cd\s+(\S+)$/))) {
      const dest = toAbs(m[1]);
      const e = entries.get(dest);
      if (!e || e.kind !== "dir") {
        pushScreen("err", `cd: ${m[1]}: No such directory`);
        return;
      }
      cwd = dest;
      lastLsMode = "plain";
      pushScreen("muted", `(cwd ${cwd})`);
      return;
    }
    if (t === "ls" || t === "ls -1") {
      lastLsMode = "plain";
      const names = listNames(cwd, false);
      lastLsNames = names;
      if (!names.length) pushScreen("muted", "(no non-hidden names)");
      names.forEach((n) => {
        const p = joinPath(cwd, n);
        pushScreen("out", entries.get(p).kind === "dir" ? n + "/" : n);
      });
      return;
    }
    if (t === "ls -a" || t === "ls -la" || t === "ls -al") {
      lastLsMode = "all";
      const names = listNames(cwd, true);
      lastLsNames = names;
      names.forEach((n) => {
        const p = joinPath(cwd, n);
        const line = entries.get(p).kind === "dir" ? n + "/" : n;
        pushScreen(isDotName(n) ? "dot" : "out", line);
      });
      return;
    }
    if ((m = t.match(/^cat\s+(\S+)$/))) {
      const abs = toAbs(m[1]);
      const e = entries.get(abs);
      if (!e || e.kind !== "file") {
        pushScreen("err", `cat: ${m[1]}: No such file`);
        lastCat = "";
        return;
      }
      selected = abs;
      const body = CONTENTS[abs];
      lastCat = abs;
      if (body == null) {
        pushScreen("muted", `(empty)`);
      } else {
        body.split("\n").forEach((line) => pushScreen("out", line));
      }
      return;
    }
    pushScreen("err", "lab: unknown (try help)");
  }

  function submitLine() {
    fakeRun(inputEl.value);
    inputEl.value = "";
    renderAll();
    saveSession();
  }

  function loadStarter() {
    entries = makeStarter();
    cwd = HOME;
    selected = `${HOME}/.bashrc`;
    lastLsMode = "plain";
    lastLsNames = [];
    lastCmd = "";
    lastCat = "";
    screen = [
      {
        kind: "muted",
        text: "Starter: try ls then ls -a — then cat .bashrc and cd chip",
      },
    ];
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ cwd, selected, lastLsMode, screen: screen.slice(-40) })
      );
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      cwd = data.cwd || HOME;
      selected = data.selected || `${HOME}/.bashrc`;
      lastLsMode = data.lastLsMode === "all" ? "all" : "plain";
      screen = Array.isArray(data.screen) ? data.screen : [];
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "ls", cmd: "ls" },
    { label: "ls -a", cmd: "ls -a" },
    { label: "cat .bashrc", cmd: "cat .bashrc" },
    { label: "cd chip", cmd: "cd chip" },
    { label: "cd ~", cmd: "cd ~" },
    { label: "cat .gitignore", cmd: "cat .gitignore" },
    { label: "pwd", cmd: "pwd" },
  ];
  const quickRow = document.getElementById("quick-row");
  QUICK.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q.label;
    b.addEventListener("click", () => {
      fakeRun(q.cmd);
      renderAll();
      saveSession();
    });
    quickRow.appendChild(b);
  });

  const CHALLENGES = [
    {
      id: "quiz-dot",
      title: "Quiz: hidden",
      prompt: "Names hidden from plain <code>ls</code> start with? Answer: <code>.</code>",
      hint: "a leading period",
      type: "text",
      answer: ".",
      alt: ["dot", "period", "a dot"],
    },
    {
      id: "quiz-lsa",
      title: "Quiz: show all",
      prompt: "Which flag shows dotfiles? Answer: <code>-a</code>",
      hint: "ls -a",
      type: "text",
      answer: "-a",
      alt: ["a", "ls -a", "-la", "la"],
    },
    {
      id: "run-ls",
      title: "Run ls",
      prompt: "In <code>~</code>, run <code>ls</code> — you should see <code>notes.txt</code> and <code>chip/</code>, not <code>.bashrc</code>.",
      hint: "cd ~ then ls",
      type: "state",
      setup: () => {
        cwd = HOME;
      },
      check: () =>
        cwd === HOME &&
        lastCmd === "ls" &&
        lastLsNames.includes("notes.txt") &&
        !lastLsNames.includes(".bashrc"),
    },
    {
      id: "run-lsa",
      title: "Run ls -a",
      prompt: "Run <code>ls -a</code> in home so <code>.bashrc</code> appears.",
      hint: "ls -a",
      type: "state",
      setup: () => {
        cwd = HOME;
      },
      check: () => lastLsMode === "all" && lastLsNames.includes(".bashrc"),
    },
    {
      id: "count-home-dots",
      title: "Count home dots",
      prompt: "In starter home (not counting .config children), how many <em>dot</em> entries at top level? (number)",
      hint: ".bashrc .profile .gitconfig .config → 4",
      type: "text",
      answer: "4",
      setup: () => loadStarter(),
    },
    {
      id: "cat-bashrc",
      title: "cat .bashrc",
      prompt: "Run <code>cat .bashrc</code> from home.",
      hint: "cat .bashrc",
      type: "state",
      setup: () => {
        cwd = HOME;
      },
      check: () => lastCat === `${HOME}/.bashrc`,
    },
    {
      id: "bashrc-alias",
      title: "bashrc alias",
      prompt: "What alias does starter <code>.bashrc</code> define? Answer: <code>ll</code>",
      hint: "alias ll=...",
      type: "text",
      answer: "ll",
      setup: () => loadStarter(),
    },
    {
      id: "quiz-tilde",
      title: "Quiz: tilde",
      prompt: "<code>~</code> expands to your? Answer: <code>home</code>",
      hint: "home directory",
      type: "text",
      answer: "home",
      alt: ["home directory", "homedir", "$HOME"],
    },
    {
      id: "cd-chip",
      title: "cd chip",
      prompt: "From home, <code>cd chip</code> so pwd is the project.",
      hint: "cd chip",
      type: "state",
      setup: () => {
        cwd = HOME;
      },
      check: () => cwd === PROJECT,
    },
    {
      id: "project-lsa",
      title: "Project ls -a",
      prompt: "In <code>chip</code>, run <code>ls -a</code> and confirm <code>.gitignore</code> is listed.",
      hint: "cd chip && ls -a",
      type: "state",
      check: () => cwd === PROJECT && lastLsMode === "all" && lastLsNames.includes(".gitignore"),
    },
    {
      id: "cat-gitignore",
      title: "cat .gitignore",
      prompt: "In chip, <code>cat .gitignore</code>.",
      hint: "cd chip then cat .gitignore",
      type: "state",
      check: () => lastCat === `${PROJECT}/.gitignore`,
    },
    {
      id: "ignore-build",
      title: "Ignore build",
      prompt: "Does <code>.gitignore</code> ignore <code>build/out.vvp</code>? Answer: <code>yes</code>",
      hint: "See the preview table — build/",
      type: "text",
      answer: "yes",
      alt: ["y", "true", "ignored"],
    },
    {
      id: "ignore-rtl",
      title: "Keep rtl",
      prompt: "Is <code>rtl/top.v</code> ignored? Answer: <code>no</code>",
      hint: "Source should be tracked",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "ignore-vcd",
      title: "Ignore vcd",
      prompt: "Which rule ignores waveforms like <code>wave.vcd</code>? Answer: <code>*.vcd</code>",
      hint: "Look in .gitignore",
      type: "text",
      answer: "*.vcd",
    },
    {
      id: "quiz-git-dir",
      title: "Quiz: .git",
      prompt: "The <code>.git/</code> directory holds? Answer: <code>repo</code> or <code>metadata</code>",
      hint: "Git repository metadata",
      type: "text",
      answer: "repo",
      alt: ["metadata", "repository", "git data", "repository metadata"],
    },
    {
      id: "xdg-config",
      title: "XDG config",
      prompt: "Starter also has Git settings under which directory? Answer: <code>.config</code>",
      hint: "~/.config/git/config",
      type: "text",
      answer: ".config",
      alt: ["~/.config", ".config/", "config"],
    },
    {
      id: "select-gitconfig",
      title: "Open .gitconfig",
      prompt: "Select or <code>cat .gitconfig</code> in home so the viewer shows the user email.",
      hint: "cat .gitconfig",
      type: "state",
      setup: () => {
        cwd = HOME;
      },
      check: () => selected === `${HOME}/.gitconfig` || lastCat === `${HOME}/.gitconfig`,
    },
    {
      id: "quiz-glob",
      title: "Quiz: glob",
      prompt: "Does glob <code>*</code> match <code>.gitignore</code>? Answer: <code>no</code>",
      hint: "Leading-dot pitfall",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "editorconfig",
      title: "editorconfig",
      prompt: "In chip, what file sets indent for <code>*.v</code>? Answer: <code>.editorconfig</code>",
      hint: "ls -a in chip",
      type: "text",
      answer: ".editorconfig",
      alt: ["editorconfig"],
    },
    {
      id: "cd-home-tilde",
      title: "cd ~",
      prompt: "From anywhere, <code>cd ~</code> returns you home.",
      hint: "cd ~",
      type: "state",
      check: () => lastCmd === "cd ~" && cwd === HOME,
    },
    {
      id: "plain-hides",
      title: "Plain hides",
      prompt: "After <code>ls</code> (not -a) in home, is <code>.profile</code> in the listing names? Answer: <code>no</code>",
      hint: "Run ls and Check — or answer from knowledge",
      type: "text",
      answer: "no",
      alt: ["n"],
      setup: () => {
        loadStarter();
        fakeRun("ls");
        renderAll();
      },
    },
    {
      id: "quiz-purpose",
      title: "Quiz: purpose",
      prompt: "Dotfiles usually store? Answer: <code>config</code>",
      hint: "configuration for shell, git, editors",
      type: "text",
      answer: "config",
      alt: ["configuration", "settings", "prefs"],
    },
  ];

  function normalizeAns(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint ? "Hide hint" : "Show hint";
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:14rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the terminal / listing, then Check.</span>`;
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
        if (typeof CHALLENGES[i].setup === "function" && CHALLENGES[i].type === "state") {
          CHALLENGES[i].setup();
          renderAll();
        }
        renderChallenge();
      });
      cat.appendChild(b);
    });
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

  document.getElementById("df-starter").addEventListener("click", loadStarter);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitLine();
    }
  });
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
    if (typeof ch.setup === "function" && ch.type === "state") {
      ch.setup();
      renderAll();
    }
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
