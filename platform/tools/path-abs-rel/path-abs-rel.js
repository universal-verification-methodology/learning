(() => {
  const HOME = "/home/lab";
  const STARTER_CWD = `${HOME}/projects/uart_tx`;

  /** Flat set of directory absolute paths + files as leaf markers */
  const DIRS = new Set([
    "/",
    "/home",
    HOME,
    `${HOME}/projects`,
    `${HOME}/projects/uart_tx`,
    `${HOME}/projects/uart_tx/src`,
    `${HOME}/projects/uart_tx/tb`,
    `${HOME}/projects/uart_tx/logs`,
    `${HOME}/projects/spi_master`,
    `${HOME}/projects/spi_master/src`,
    `${HOME}/docs`,
  ]);

  const FILES = new Set([
    `${HOME}/projects/uart_tx/Makefile`,
    `${HOME}/projects/uart_tx/src/uart_tx.v`,
    `${HOME}/projects/uart_tx/tb/tb_uart.v`,
    `${HOME}/projects/spi_master/src/spi.v`,
    `${HOME}/docs/notes.md`,
  ]);

  const CLEARED_KEY = "ddv-path-abs-rel-cleared-v1";
  const STORE_KEY = "ddv-path-abs-rel-session-v1";

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
  let cwd = STARTER_CWD;
  let prevCwd = HOME;
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  let lastResolved = "";
  let lastResolveOk = false;
  let lastKind = "";

  const root = document.getElementById("path-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> You are in <code>${STARTER_CWD}</code>.
        Resolve <code>../spi_master/src</code> (relative) vs <code>~/projects/uart_tx/tb</code> (home)
        vs <code>/home/lab/docs</code> (absolute). Try <code>cd ..</code> then resolve <code>src</code> — it breaks.</p>
      <button type="button" class="btn btn-secondary" id="path-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Current directory</h2></div>
        <div class="panel-body">
          <p class="cwd-banner"><span>pwd</span><code id="cwd-display"></code></p>
          <div class="quick-cds" id="quick-cds"></div>
          <div class="path-term" style="margin-top:0.85rem" id="term">
            <div class="path-term-scroll" id="term-scroll"></div>
            <div class="path-prompt-row">
              <span class="path-prompt">lab$</span>
              <input class="path-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="pwd · cd · ls · help" aria-label="Command line" />
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Resolve a path</h2></div>
        <div class="panel-body">
          <div class="resolve-grid">
            <label>Path to resolve
              <input id="resolve-in" value="../spi_master/src" spellcheck="false" />
            </label>
            <div class="tool-actions">
              <button type="button" class="btn btn-primary" id="btn-resolve">Resolve against cwd</button>
            </div>
            <div class="resolve-out" id="resolve-out"></div>
          </div>
          <ul class="hint-list" style="margin-top:0.85rem">
            <li><strong>Absolute</strong> — starts with <code>/</code> (from filesystem root).</li>
            <li><strong>Home</strong> — starts with <code>~</code> (expands to <code>${HOME}</code>).</li>
            <li><strong>Relative</strong> — everything else; joined to <code>pwd</code>, then <code>.</code>/<code>..</code> cleaned.</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Lab tree</h2>
        <span style="font-size:0.8rem;color:var(--muted)">● = cwd</span>
      </div>
      <div class="panel-body">
        <pre class="tree-view" id="tree-view"></pre>
      </div>
    </div>
  `;

  const cwdEl = document.getElementById("cwd-display");
  const treeEl = document.getElementById("tree-view");
  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const resolveIn = document.getElementById("resolve-in");
  const resolveOut = document.getElementById("resolve-out");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function classify(path) {
    const t = String(path).trim();
    if (!t) return "rel";
    if (t === "~" || t.startsWith("~/") || t.startsWith("~")) return "home";
    if (t.startsWith("/")) return "abs";
    return "rel";
  }

  /** Normalize absolute path: collapse . and .. */
  function normalizeAbs(abs) {
    const parts = abs.split("/").filter((p) => p && p !== ".");
    const stack = [];
    for (const p of parts) {
      if (p === "..") {
        if (stack.length) stack.pop();
      } else stack.push(p);
    }
    return "/" + stack.join("/");
  }

  /**
   * Resolve user path against cwd.
   * @returns {{ ok: boolean, abs: string, kind: string, error?: string }}
   */
  function resolvePath(raw, baseCwd = cwd) {
    const kind = classify(raw);
    let t = String(raw).trim();
    if (!t) {
      return { ok: true, abs: baseCwd, kind: "rel" };
    }
    let joined;
    if (kind === "abs") {
      joined = t;
    } else if (kind === "home") {
      if (t === "~") joined = HOME;
      else if (t.startsWith("~/")) joined = HOME + t.slice(1);
      else return { ok: false, abs: "", kind, error: "unsupported ~user form in this lab" };
    } else {
      joined = baseCwd.replace(/\/$/, "") + "/" + t;
    }
    const abs = normalizeAbs(joined);
    const exists = DIRS.has(abs) || FILES.has(abs);
    if (!exists) {
      return { ok: false, abs, kind, error: `no such file or directory: ${abs}` };
    }
    return { ok: true, abs, kind };
  }

  function isDir(abs) {
    return DIRS.has(abs);
  }

  function listDir(abs) {
    const prefix = abs === "/" ? "/" : abs + "/";
    const names = new Set();
    for (const d of DIRS) {
      if (d === abs) continue;
      if (!d.startsWith(prefix)) continue;
      const rest = d.slice(prefix.length);
      if (!rest || rest.includes("/")) continue;
      names.add(rest + "/");
    }
    for (const f of FILES) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      if (!rest || rest.includes("/")) continue;
      names.add(rest);
    }
    return [...names].sort();
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 120) screen = screen.slice(-80);
  }

  function renderScreen() {
    scrollEl.innerHTML = screen
      .map((row) => {
        const cls = row.kind === "cmd" ? "" : row.kind === "err" ? "err" : row.kind === "muted" ? "muted" : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderCwd() {
    cwdEl.textContent = cwd;
  }

  function renderTree() {
    treeEl.innerHTML = [
      `/`,
      `└── home/`,
      `    └── lab/${cwd === HOME ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `        ├── docs/${cwd === `${HOME}/docs` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `        │   └── notes.md`,
      `        └── projects/${cwd === `${HOME}/projects` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `            ├── spi_master/${cwd === `${HOME}/projects/spi_master` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `            │   └── src/${cwd === `${HOME}/projects/spi_master/src` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `            │       └── spi.v`,
      `            └── uart_tx/${cwd === `${HOME}/projects/uart_tx` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `                ├── Makefile`,
      `                ├── logs/${cwd === `${HOME}/projects/uart_tx/logs` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `                ├── src/${cwd === `${HOME}/projects/uart_tx/src` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `                │   └── uart_tx.v`,
      `                └── tb/${cwd === `${HOME}/projects/uart_tx/tb` ? "  <span class=\"here\">● cwd</span>" : ""}`,
      `                    └── tb_uart.v`,
    ].join("\n");
  }

  function renderResolve(result, typed) {
    lastResolved = result.abs;
    lastResolveOk = result.ok;
    lastKind = result.kind;
    const pill =
      result.kind === "abs"
        ? `<span class="kind-pill abs">absolute</span>`
        : result.kind === "home"
          ? `<span class="kind-pill home">home (~)</span>`
          : `<span class="kind-pill rel">relative</span>`;
    if (!result.ok) {
      resolveOut.className = "resolve-out bad";
      resolveOut.innerHTML = `${pill}<strong>fails</strong> from cwd <code>${escapeHtml(cwd)}</code><br>${escapeHtml(result.error || result.abs)}`;
      return;
    }
    resolveOut.className = "resolve-out ok";
    const isd = isDir(result.abs);
    resolveOut.innerHTML = `${pill}<code>${escapeHtml(typed)}</code> → <code>${escapeHtml(result.abs)}</code>${isd ? "  (dir)" : "  (file)"}`;
  }

  function doResolve() {
    const typed = resolveIn.value;
    const result = resolvePath(typed);
    renderResolve(result, typed.trim() || ".");
    saveSession();
  }

  function doCd(target) {
    const r = resolvePath(target);
    if (!r.ok) {
      pushScreen("err", `cd: ${r.error}`);
      return false;
    }
    if (!isDir(r.abs)) {
      pushScreen("err", `cd: not a directory: ${r.abs}`);
      return false;
    }
    prevCwd = cwd;
    cwd = r.abs;
    return true;
  }

  function fakeRun(cmd) {
    const t = cmd.trim();
    if (!t) return;
    pushScreen("cmd", t);
    if (t === "help") {
      pushScreen(
        "out",
        "pwd · cd PATH · cd - · cd · ls [PATH] · help\n" +
          "Special: / absolute · ~ home · . current · .. parent"
      );
      return;
    }
    if (t === "pwd") {
      pushScreen("out", cwd);
      return;
    }
    if (t === "cd" || t === "cd ~") {
      doCd("~");
      pushScreen("out", cwd);
      renderAll();
      return;
    }
    if (t === "cd -") {
      const swap = prevCwd;
      prevCwd = cwd;
      cwd = swap;
      pushScreen("out", cwd);
      renderAll();
      return;
    }
    if (t.startsWith("cd ")) {
      const arg = t.slice(3).trim();
      if (!doCd(arg)) {
        renderScreen();
        return;
      }
      pushScreen("muted", `(now ${cwd})`);
      renderAll();
      return;
    }
    if (t === "ls" || t.startsWith("ls ")) {
      const arg = t === "ls" ? "." : t.slice(3).trim() || ".";
      const r = resolvePath(arg);
      if (!r.ok) {
        pushScreen("err", `ls: ${r.error}`);
        return;
      }
      if (!isDir(r.abs)) {
        pushScreen("out", r.abs.split("/").pop());
        return;
      }
      pushScreen("out", listDir(r.abs).join("  ") || "(empty)");
      return;
    }
    pushScreen("err", `lab: unknown command (try help)`);
  }

  function submitLine() {
    const raw = inputEl.value;
    inputEl.value = "";
    fakeRun(raw);
    renderScreen();
    saveSession();
  }

  function renderQuick() {
    const jumps = [
      { label: "cd ~", path: "~" },
      { label: "cd ~/projects", path: "~/projects" },
      { label: "cd uart_tx", path: `${HOME}/projects/uart_tx` },
      { label: "cd src", path: "src" },
      { label: "cd ..", path: ".." },
      { label: "cd ../tb", path: "../tb" },
    ];
    const el = document.getElementById("quick-cds");
    el.innerHTML = "";
    jumps.forEach((j) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = j.label;
      b.addEventListener("click", () => {
        pushScreen("cmd", `cd ${j.path}`);
        if (doCd(j.path)) pushScreen("muted", `(now ${cwd})`);
        else pushScreen("err", `cd failed`);
        renderScreen();
        renderAll();
        saveSession();
      });
      el.appendChild(b);
    });
  }

  function renderAll() {
    renderCwd();
    renderTree();
    doResolve();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ cwd, prevCwd, screen: screen.slice(-60), resolveIn: resolveIn.value })
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
      if (data.cwd && DIRS.has(data.cwd)) {
        cwd = data.cwd;
        prevCwd = data.prevCwd && DIRS.has(data.prevCwd) ? data.prevCwd : HOME;
        screen = Array.isArray(data.screen) ? data.screen : [];
        if (data.resolveIn) resolveIn.value = data.resolveIn;
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function loadStarter() {
    cwd = STARTER_CWD;
    prevCwd = HOME;
    screen = [{ kind: "muted", text: "Starter: cwd is uart_tx — resolve ../spi_master/src" }];
    resolveIn.value = "../spi_master/src";
    renderScreen();
    renderAll();
    saveSession();
    inputEl.focus();
  }

  // ——— Challenges ———
  const CHALLENGES = [
    {
      id: "starter-pwd",
      title: "Starter pwd",
      prompt: "After Load starter, what does <code>pwd</code> print? (exact path)",
      hint: STARTER_CWD,
      type: "text",
      answer: STARTER_CWD,
    },
    {
      id: "kind-abs",
      title: "Quiz: absolute",
      prompt: "A path starting with <code>/</code> is called? Answer: <code>absolute</code>",
      hint: "absolute",
      type: "text",
      answer: "absolute",
      alt: ["abs"],
    },
    {
      id: "kind-rel",
      title: "Quiz: relative",
      prompt: "A path like <code>src/uart_tx.v</code> (no leading /) is? Answer: <code>relative</code>",
      hint: "relative to cwd",
      type: "text",
      answer: "relative",
      alt: ["rel"],
    },
    {
      id: "tilde-home",
      title: "Quiz: ~",
      prompt: "What does <code>~</code> expand to in this lab? (exact path)",
      hint: HOME,
      type: "text",
      answer: HOME,
    },
    {
      id: "dot-cwd",
      title: "Quiz: .",
      prompt: "What does <code>.</code> mean? Answer: <code>current</code> or <code>cwd</code>",
      hint: "current directory",
      type: "text",
      answer: "current",
      alt: ["cwd", "current directory", "current dir", "."],
    },
    {
      id: "dotdot-parent",
      title: "Quiz: ..",
      prompt: "What does <code>..</code> mean? Answer: <code>parent</code>",
      hint: "parent directory",
      type: "text",
      answer: "parent",
      alt: ["parent directory", "parent dir", ".."],
    },
    {
      id: "resolve-rel-spi",
      title: "Resolve ../spi",
      prompt: "From starter cwd, resolve <code>../spi_master/src</code> — absolute result must match, then Check.",
      hint: "Use Resolve button; expect …/projects/spi_master/src",
      type: "state",
      check: () =>
        lastResolveOk && lastResolved === `${HOME}/projects/spi_master/src` && lastKind === "rel",
    },
    {
      id: "resolve-home-tb",
      title: "Resolve ~/…/tb",
      prompt: "Resolve <code>~/projects/uart_tx/tb</code> (home form).",
      hint: "Paste into Resolve field and click Resolve.",
      type: "state",
      check: () =>
        lastResolveOk && lastResolved === `${HOME}/projects/uart_tx/tb` && lastKind === "home",
    },
    {
      id: "resolve-abs-docs",
      title: "Resolve absolute docs",
      prompt: "Resolve <code>/home/lab/docs</code>.",
      hint: "Absolute path from root.",
      type: "state",
      check: () => lastResolveOk && lastResolved === `${HOME}/docs` && lastKind === "abs",
    },
    {
      id: "cd-src",
      title: "cd src",
      prompt: "From starter uart_tx, run <code>cd src</code> so pwd ends with <code>/src</code>.",
      hint: "Load starter, then cd src (or quick button).",
      type: "state",
      check: () => cwd === `${HOME}/projects/uart_tx/src`,
    },
    {
      id: "cd-dotdot",
      title: "cd ..",
      prompt: "From <code>…/uart_tx/src</code>, <code>cd ..</code> back to uart_tx.",
      hint: "cd src first if needed, then cd ..",
      type: "state",
      check: () => cwd === `${HOME}/projects/uart_tx`,
    },
    {
      id: "cd-sibling-tb",
      title: "cd ../tb",
      prompt: "From <code>…/uart_tx/src</code>, go to sibling tb with <code>cd ../tb</code>.",
      hint: "Must be in src first.",
      type: "state",
      check: () => cwd === `${HOME}/projects/uart_tx/tb`,
    },
    {
      id: "rel-breaks",
      title: "Relative breaks",
      prompt: "From starter uart_tx, <code>cd ..</code> to projects, then resolve <code>src</code> — it must <strong>fail</strong> (no projects/src).",
      hint: "cd .. then Resolve src — should show fails.",
      type: "state",
      check: () =>
        cwd === `${HOME}/projects` &&
        !lastResolveOk &&
        resolveIn.value.trim() === "src",
    },
    {
      id: "abs-survives",
      title: "Absolute survives",
      prompt: "From <code>~/projects</code>, resolve absolute <code>/home/lab/projects/uart_tx/src</code> — must succeed.",
      hint: "cd ~/projects, then resolve the full absolute path.",
      type: "state",
      check: () =>
        cwd === `${HOME}/projects` &&
        lastResolveOk &&
        lastResolved === `${HOME}/projects/uart_tx/src` &&
        lastKind === "abs",
    },
    {
      id: "cd-home",
      title: "cd ~",
      prompt: "Go home with <code>cd ~</code> or <code>cd</code>.",
      hint: "Quick button or type cd ~",
      type: "state",
      check: () => cwd === HOME,
    },
    {
      id: "cd-dash",
      title: "cd -",
      prompt: "From home, <code>cd -</code> returns to the previous directory (not home).",
      hint: "cd somewhere, cd ~, then cd -",
      type: "state",
      check: () => cwd !== HOME && prevCwd === HOME,
    },
    {
      id: "ls-uart",
      title: "ls uart_tx",
      prompt: "From starter cwd, run <code>ls</code> so output includes <code>src/</code> and <code>tb/</code>.",
      hint: "Load starter, type ls",
      type: "state",
      check: () =>
        cwd === STARTER_CWD &&
        screen.some((r) => r.kind === "cmd" && r.text === "ls") &&
        screen.some((r) => r.kind === "out" && r.text.includes("src/") && r.text.includes("tb/")),
    },
    {
      id: "pwd-cmd",
      title: "Run pwd",
      prompt: "Type <code>pwd</code> in the terminal so it prints your cwd.",
      hint: "Focus prompt, pwd, Enter.",
      type: "state",
      check: () => screen.some((r) => r.kind === "cmd" && r.text === "pwd"),
    },
    {
      id: "resolve-dot",
      title: "Resolve .",
      prompt: "Resolve <code>.</code> — result must equal current pwd.",
      hint: "Type . in Resolve field.",
      type: "state",
      check: () => lastResolveOk && lastResolved === cwd && resolveIn.value.trim() === ".",
    },
    {
      id: "resolve-dotdot",
      title: "Resolve ..",
      prompt: "From starter uart_tx, resolve <code>..</code> → projects.",
      hint: "Load starter, resolve ..",
      type: "state",
      check: () =>
        cwd === STARTER_CWD &&
        lastResolveOk &&
        lastResolved === `${HOME}/projects`,
    },
    {
      id: "quiz-when-rel-breaks",
      title: "Quiz: when relative breaks",
      prompt: "Relative paths break when you change ___? Answer: <code>cwd</code> or <code>directory</code>",
      hint: "current working directory",
      type: "text",
      answer: "cwd",
      alt: ["directory", "pwd", "current directory", "working directory"],
    },
    {
      id: "file-resolve",
      title: "Resolve a file",
      prompt: "From uart_tx, resolve <code>src/uart_tx.v</code> to the full file path.",
      hint: "Load starter if needed.",
      type: "state",
      check: () =>
        lastResolveOk && lastResolved === `${HOME}/projects/uart_tx/src/uart_tx.v`,
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
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:16rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use Resolve / cd / terminal, then Check.</span>`;
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
        renderChallenge();
      });
      cat.appendChild(b);
    });
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

  document.getElementById("path-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-resolve").addEventListener("click", doResolve);
  resolveIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doResolve();
    }
  });
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
    renderChallenge();
  });

  renderQuick();
  if (!loadSession()) loadStarter();
  else {
    renderScreen();
    renderAll();
  }
  renderChallenge();
  inputEl.focus();
})();
