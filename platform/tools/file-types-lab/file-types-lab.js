(() => {
  /** @typedef {{ kind: 'file'|'dir'|'symlink', mode: string, size: number, inode: number, target?: string, nlink: number }} Entry */

  let nextInode = 100;

  function makeStarter() {
    nextInode = 100;
    /** @type {Map<string, Entry>} */
    const m = new Map();
    const add = (name, e) => m.set(name, e);
    add(".", { kind: "dir", mode: "drwxr-xr-x", size: 4096, inode: nextInode++, nlink: 3 });
    add("..", { kind: "dir", mode: "drwxr-xr-x", size: 4096, inode: 1, nlink: 5 });
    add("readme.md", { kind: "file", mode: "-rw-r--r--", size: 220, inode: nextInode++, nlink: 1 });
    add("design.v", { kind: "file", mode: "-rw-r--r--", size: 1024, inode: nextInode++, nlink: 1 });
    add("script.sh", { kind: "file", mode: "-rwxr-xr-x", size: 80, inode: nextInode++, nlink: 1 });
    add("src", { kind: "dir", mode: "drwxr-xr-x", size: 4096, inode: nextInode++, nlink: 2 });
    add("build", { kind: "dir", mode: "drwxr-xr-x", size: 4096, inode: nextInode++, nlink: 2 });
    // soft link to existing file (relative)
    add("design_link.v", {
      kind: "symlink",
      mode: "lrwxrwxrwx",
      size: 8,
      inode: nextInode++,
      nlink: 1,
      target: "design.v",
    });
    // soft link to toolchain-style absolute path (exists in lab as virtual target name only for display)
    add("iverilog", {
      kind: "symlink",
      mode: "lrwxrwxrwx",
      size: 28,
      inode: nextInode++,
      nlink: 1,
      target: "/opt/toolchain/bin/iverilog",
    });
    // broken symlink
    add("gone.txt", {
      kind: "symlink",
      mode: "lrwxrwxrwx",
      size: 12,
      inode: nextInode++,
      nlink: 1,
      target: "missing.txt",
    });
    return m;
  }

  /** @type {Map<string, Entry>} */
  let entries = makeStarter();
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  let lastCmd = "";
  let lastReadlink = "";
  let lastLn = "";

  const CLEARED_KEY = "ddv-file-types-lab-cleared-v1";
  const STORE_KEY = "ddv-file-types-lab-session-v1";

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

  const root = document.getElementById("ft-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Study <code>ls -l</code> — note
        <code>d</code> dirs, <code>-</code> files, <code>l</code> symlinks.
        <code>design_link.v -> design.v</code> is good; <code>gone.txt -> missing.txt</code> is broken.
        Try <code>ln -s design.v alias.v</code> and <code>ln design.v hard.v</code>.</p>
      <button type="button" class="btn btn-secondary" id="ft-starter">Load starter example</button>
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
        <div class="panel-head"><h2>ls -l (lab directory)</h2>
          <button type="button" class="btn btn-ghost" id="btn-refresh">Refresh</button>
        </div>
        <div class="panel-body">
          <div class="legend">
            <span><b class="type-f">-</b> regular file</span>
            <span><b class="type-d">d</b> directory</span>
            <span><b class="type-l">l</b> symbolic link</span>
            <span><b class="broken">broken</b> target missing</span>
          </div>
          <div style="overflow:auto">
            <table class="ls-table" id="ls-table"></table>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Lab terminal</h2></div>
        <div class="panel-body" style="padding:0">
          <div class="ft-term">
            <div class="ft-scroll" id="term-scroll"></div>
            <div class="ft-prompt-row">
              <span class="ft-prompt">lab$</span>
              <input class="ft-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="ls -l · ln -s · ln · readlink · rm · help" aria-label="Command line" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Inodes (hard vs soft)</h2></div>
      <div class="panel-body">
        <div id="inode-panel"></div>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li><strong>Soft link (<code>ln -s</code>)</strong> — new inode; stores a path string; can dangle if target is removed.</li>
          <li><strong>Hard link (<code>ln</code>)</strong> — same inode as target; only for regular files; deleting one name leaves data if nlink &gt; 0.</li>
        </ul>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>ls -l</code></td><td>Long listing; first char is type</td></tr>
            <tr><td><code>ln -s TARGET LINK</code></td><td>Create symbolic (soft) link</td></tr>
            <tr><td><code>ln TARGET LINK</code></td><td>Create hard link (same inode)</td></tr>
            <tr><td><code>readlink LINK</code></td><td>Print symlink target path</td></tr>
            <tr><td><code>rm NAME</code></td><td>Remove a name (file or link)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const lsTable = document.getElementById("ls-table");
  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const inodePanel = document.getElementById("inode-panel");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function typeChar(e) {
    if (e.kind === "dir") return "d";
    if (e.kind === "symlink") return "l";
    return "-";
  }

  function isBroken(e) {
    if (e.kind !== "symlink") return false;
    const t = e.target || "";
    if (t.startsWith("/")) {
      // lab: only treat absolute toolchain path as "ok" if name is iverilog demo
      return t !== "/opt/toolchain/bin/iverilog";
    }
    return !entries.has(t);
  }

  function bumpNlink(inode) {
    let n = 0;
    for (const e of entries.values()) {
      if (e.inode === inode && e.kind === "file") n++;
    }
    for (const e of entries.values()) {
      if (e.inode === inode && e.kind === "file") e.nlink = n;
    }
  }

  function listNames() {
    return [...entries.keys()]
      .filter((n) => n !== "." && n !== "..")
      .sort((a, b) => a.localeCompare(b));
  }

  function renderLs() {
    const rows = listNames().map((name) => {
      const e = entries.get(name);
      const tc = typeChar(e);
      const typeCls = tc === "d" ? "type-d" : tc === "l" ? "type-l" : "type-f";
      const broken = isBroken(e);
      let nameCell = escapeHtml(name);
      if (e.kind === "symlink") {
        nameCell += ` <span class="arrow">-></span> <span class="${broken ? "broken" : ""}">${escapeHtml(e.target || "")}</span>`;
        if (broken) nameCell += ` <span class="broken">(broken)</span>`;
      }
      return `<tr>
        <td class="${typeCls}">${tc}${e.mode.slice(1)}</td>
        <td>${e.nlink}</td>
        <td>${e.inode}</td>
        <td>${e.size}</td>
        <td>${nameCell}</td>
      </tr>`;
    });
    lsTable.innerHTML = `<thead><tr><th>mode</th><th>nlink</th><th>inode</th><th>size</th><th>name</th></tr></thead><tbody>${rows.join("")}</tbody>`;
  }

  function renderInodes() {
    /** @type {Map<number, {kind:string, names:string[]}>} */
    const by = new Map();
    for (const [name, e] of entries) {
      if (name === "." || name === "..") continue;
      if (!by.has(e.inode)) by.set(e.inode, { kind: e.kind, names: [] });
      by.get(e.inode).names.push(name);
    }
    const cards = [...by.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, v]) => v.kind === "file" || v.names.length > 1 || v.kind === "symlink")
      .slice(0, 12)
      .map(([ino, v]) => {
        const hard = v.kind === "file" && v.names.length > 1;
        return `<div class="inode-card"><strong>inode ${ino}</strong> · ${v.kind}${hard ? " · hard-linked" : ""}
          <div class="names">${v.names.map(escapeHtml).join(", ")}</div></div>`;
      });
    inodePanel.innerHTML = cards.join("") || `<p style="color:var(--muted);font-size:0.9rem">No multi-name inodes yet — try <code>ln design.v hard.v</code>.</p>`;
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 80) screen = screen.slice(-60);
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

  function renderAll() {
    renderLs();
    renderInodes();
    renderScreen();
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "ls -l · ln -s TARGET LINK · ln TARGET LINK · readlink LINK · rm NAME · help"
      );
      return;
    }
    if (t === "ls" || t === "ls -l" || t === "ls -la") {
      for (const name of listNames()) {
        const e = entries.get(name);
        const tc = typeChar(e);
        let line = `${tc}${e.mode.slice(1)} ${e.nlink} ${e.inode} ${String(e.size).padStart(5)} ${name}`;
        if (e.kind === "symlink") {
          line += ` -> ${e.target}`;
          if (isBroken(e)) line += " (broken)";
        }
        pushScreen("out", line);
      }
      return;
    }

    let m;
    if ((m = t.match(/^ln\s+-s\s+(\S+)\s+(\S+)$/))) {
      const target = m[1];
      const link = m[2];
      if (entries.has(link)) {
        pushScreen("err", `ln: failed to create symbolic link '${link}': File exists`);
        return;
      }
      entries.set(link, {
        kind: "symlink",
        mode: "lrwxrwxrwx",
        size: target.length,
        inode: nextInode++,
        nlink: 1,
        target,
      });
      lastLn = `soft:${link}->${target}`;
      pushScreen("muted", `(created symlink ${link} -> ${target})`);
      return;
    }
    if ((m = t.match(/^ln\s+(\S+)\s+(\S+)$/))) {
      const target = m[1];
      const link = m[2];
      const src = entries.get(target);
      if (!src || src.kind !== "file") {
        pushScreen("err", `ln: ${target}: hard links only for regular files in this lab`);
        return;
      }
      if (entries.has(link)) {
        pushScreen("err", `ln: failed to create hard link '${link}': File exists`);
        return;
      }
      entries.set(link, {
        kind: "file",
        mode: src.mode,
        size: src.size,
        inode: src.inode,
        nlink: 1,
      });
      bumpNlink(src.inode);
      lastLn = `hard:${link}=${target}:inode${src.inode}`;
      pushScreen("muted", `(hard link ${link} → same inode ${src.inode})`);
      return;
    }
    if ((m = t.match(/^readlink\s+(\S+)$/))) {
      const name = m[1];
      const e = entries.get(name);
      if (!e || e.kind !== "symlink") {
        pushScreen("err", `readlink: ${name}: Not a symbolic link`);
        lastReadlink = "";
        return;
      }
      lastReadlink = e.target || "";
      pushScreen("out", e.target || "");
      return;
    }
    if ((m = t.match(/^rm\s+(\S+)$/))) {
      const name = m[1];
      if (name === "." || name === ".." || !entries.has(name)) {
        pushScreen("err", `rm: cannot remove '${name}': No such file`);
        return;
      }
      const e = entries.get(name);
      if (e.kind === "dir") {
        pushScreen("err", `rm: cannot remove '${name}': Is a directory`);
        return;
      }
      const ino = e.inode;
      entries.delete(name);
      if (e.kind === "file") bumpNlink(ino);
      pushScreen("muted", `(removed ${name})`);
      return;
    }
    pushScreen("err", "lab: unknown (try help)");
  }

  function submitLine() {
    const raw = inputEl.value;
    inputEl.value = "";
    fakeRun(raw);
    renderAll();
    saveSession();
  }

  function loadStarter() {
    entries = makeStarter();
    screen = [{ kind: "muted", text: "Starter tree loaded — inspect ls -l, then ln / readlink" }];
    lastCmd = "";
    lastReadlink = "";
    lastLn = "";
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      const obj = {
        entries: [...entries.entries()],
        nextInode,
        screen: screen.slice(-40),
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.entries) || !data.entries.length) return false;
      entries = new Map(data.entries);
      nextInode = data.nextInode || 200;
      screen = Array.isArray(data.screen) ? data.screen : [];
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "ls -l", cmd: "ls -l" },
    { label: "ln -s design.v alias.v", cmd: "ln -s design.v alias.v" },
    { label: "ln design.v hard.v", cmd: "ln design.v hard.v" },
    { label: "readlink design_link.v", cmd: "readlink design_link.v" },
    { label: "readlink gone.txt", cmd: "readlink gone.txt" },
    { label: "rm gone.txt", cmd: "rm gone.txt" },
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
      id: "quiz-dash",
      title: "Quiz: type -",
      prompt: "In <code>ls -l</code>, first character <code>-</code> means? Answer: <code>file</code> or <code>regular</code>",
      hint: "regular file",
      type: "text",
      answer: "file",
      alt: ["regular", "regular file", "-"],
    },
    {
      id: "quiz-d",
      title: "Quiz: type d",
      prompt: "First character <code>d</code> means? Answer: <code>directory</code>",
      hint: "directory",
      type: "text",
      answer: "directory",
      alt: ["dir", "d"],
    },
    {
      id: "quiz-l",
      title: "Quiz: type l",
      prompt: "First character <code>l</code> means? Answer: <code>symlink</code> or <code>link</code>",
      hint: "symbolic link",
      type: "text",
      answer: "symlink",
      alt: ["link", "symbolic link", "soft link", "l"],
    },
    {
      id: "count-dirs",
      title: "Count dirs",
      prompt: "In the starter listing (excluding . and ..), how many directories? (number)",
      hint: "src and build → 2",
      type: "text",
      answer: "2",
      setup: () => loadStarter(),
    },
    {
      id: "count-symlinks",
      title: "Count symlinks",
      prompt: "Starter: how many symbolic links? (number)",
      hint: "design_link.v, iverilog, gone.txt → 3",
      type: "text",
      answer: "3",
      setup: () => loadStarter(),
    },
    {
      id: "broken-name",
      title: "Broken link name",
      prompt: "Which starter symlink is broken? (exact name)",
      hint: "gone.txt",
      type: "text",
      answer: "gone.txt",
      setup: () => loadStarter(),
    },
    {
      id: "readlink-good",
      title: "readlink good",
      prompt: "Run <code>readlink design_link.v</code> — target should be <code>design.v</code>.",
      hint: "Quick button or type it.",
      type: "state",
      check: () => lastReadlink === "design.v",
    },
    {
      id: "readlink-broken",
      title: "readlink broken",
      prompt: "Run <code>readlink gone.txt</code> — still prints <code>missing.txt</code> (path text).",
      hint: "readlink gone.txt",
      type: "state",
      check: () => lastReadlink === "missing.txt",
    },
    {
      id: "soft-create",
      title: "Create soft link",
      prompt: "Create <code>ln -s design.v alias.v</code> so <code>alias.v</code> appears as type <code>l</code>.",
      hint: "ln -s design.v alias.v",
      type: "state",
      check: () => {
        const e = entries.get("alias.v");
        return e && e.kind === "symlink" && e.target === "design.v";
      },
    },
    {
      id: "hard-create",
      title: "Create hard link",
      prompt: "Run <code>ln design.v hard.v</code> — same inode as <code>design.v</code>.",
      hint: "ln design.v hard.v",
      type: "state",
      check: () => {
        const a = entries.get("design.v");
        const b = entries.get("hard.v");
        return a && b && a.kind === "file" && b.kind === "file" && a.inode === b.inode && a.nlink >= 2;
      },
    },
    {
      id: "hard-nlink",
      title: "Hard nlink",
      prompt: "After hard-linking <code>design.v</code> to <code>hard.v</code>, what is nlink on design.v? (number)",
      hint: "2",
      type: "text",
      answer: "2",
      setup: () => {
        loadStarter();
        fakeRun("ln design.v hard.v");
        renderAll();
      },
    },
    {
      id: "quiz-soft-vs-hard",
      title: "Quiz: soft vs hard",
      prompt: "Which link type gets its <em>own</em> inode? Answer: <code>soft</code> or <code>symlink</code>",
      hint: "symbolic / soft link",
      type: "text",
      answer: "soft",
      alt: ["symlink", "symbolic", "soft link", "ln -s"],
    },
    {
      id: "quiz-hard-same",
      title: "Quiz: hard inode",
      prompt: "Hard links share the same? Answer: <code>inode</code>",
      hint: "inode",
      type: "text",
      answer: "inode",
    },
    {
      id: "rm-soft",
      title: "rm soft link",
      prompt: "Remove the broken link with <code>rm gone.txt</code> (does not need the target).",
      hint: "rm gone.txt",
      type: "state",
      check: () => !entries.has("gone.txt"),
    },
    {
      id: "soft-break",
      title: "Make a break",
      prompt: "Create <code>ln -s nope.bin bad.bin</code> — listing should mark it broken.",
      hint: "ln -s nope.bin bad.bin",
      type: "state",
      check: () => {
        const e = entries.get("bad.bin");
        return e && e.kind === "symlink" && isBroken(e);
      },
    },
    {
      id: "no-hard-dir",
      title: "No hard dir",
      prompt: "Try <code>ln src src2</code> — lab should reject hard-linking a directory.",
      hint: "ln src src2",
      type: "state",
      check: () =>
        lastCmd === "ln src src2" &&
        screen.some((r) => r.kind === "err" && /hard links only/i.test(r.text)),
    },
    {
      id: "ls-cmd",
      title: "Run ls -l",
      prompt: "Type <code>ls -l</code> in the terminal so the listing prints there too.",
      hint: "ls -l",
      type: "state",
      check: () => lastCmd === "ls -l" || lastCmd === "ls -la",
    },
    {
      id: "iverilog-target",
      title: "Toolchain symlink",
      prompt: "What is the target of starter <code>iverilog</code>? (exact path)",
      hint: "/opt/toolchain/bin/iverilog",
      type: "text",
      answer: "/opt/toolchain/bin/iverilog",
      setup: () => loadStarter(),
    },
    {
      id: "relative-soft",
      title: "Relative soft target",
      prompt: "Starter <code>design_link.v</code> uses a relative target. What string?",
      hint: "design.v",
      type: "text",
      answer: "design.v",
    },
    {
      id: "quiz-arrow",
      title: "Quiz: ls arrow",
      prompt: "In <code>ls -l</code>, <code>name -> target</code> appears for? Answer: <code>symlink</code>",
      hint: "symbolic links",
      type: "text",
      answer: "symlink",
      alt: ["link", "soft link", "symbolic link", "l"],
    },
    {
      id: "hard-survives",
      title: "Hard survives rm",
      prompt: "Create hard link <code>hard.v</code>, then <code>rm design.v</code> — <code>hard.v</code> should still exist.",
      hint: "ln design.v hard.v && rm design.v",
      type: "state",
      check: () => entries.has("hard.v") && !entries.has("design.v") && entries.get("hard.v").kind === "file",
    },
    {
      id: "mode-l-quiz",
      title: "Quiz: symlink mode",
      prompt: "Symlink mode string usually starts with? Answer: <code>l</code>",
      hint: "lrwxrwxrwx",
      type: "text",
      answer: "l",
      alt: ["lrwxrwxrwx"],
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the listing / terminal, then Check.</span>`;
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

  document.getElementById("ft-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-refresh").addEventListener("click", () => {
    renderLs();
    renderInodes();
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

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
