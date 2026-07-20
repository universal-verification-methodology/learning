(() => {
  const PAGES = [
    {
      name: "ls",
      section: 1,
      whatis: "list directory contents",
      keywords: ["list", "directory", "file", "contents"],
      help: `Usage: ls [OPTION]... [FILE]...
List information about FILEs (the current directory by default).

  -a, --all          do not ignore entries starting with .
  -l                 use a long listing format
  -h, --human-readable  with -l, print sizes like 1K 234M
  -R, --recursive    list subdirectories recursively
      --help         display this help and exit`,
      man: `LS(1)                        User Commands                       LS(1)

NAME
       ls - list directory contents

SYNOPSIS
       ls [OPTION]... [FILE]...

DESCRIPTION
       List information about the FILEs (the current directory by
       default). Sort entries alphabetically unless options intervene.

OPTIONS
       -a, --all
              do not ignore entries starting with .

       -l     use a long listing format (permissions, size, time).

       -h, --human-readable
              with -l, print human readable sizes.

       -R, --recursive
              list subdirectories recursively.

EXAMPLES
       ls -la
       ls -lh src/

SEE ALSO
       dir(1), find(1)

LS(1)`,
    },
    {
      name: "cp",
      section: 1,
      whatis: "copy files and directories",
      keywords: ["copy", "file", "directory", "duplicate"],
      help: `Usage: cp [OPTION]... SOURCE DEST
  or:  cp [OPTION]... SOURCE... DIRECTORY

Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.

  -r, -R, --recursive  copy directories recursively
  -i, --interactive    prompt before overwrite
  -v, --verbose        explain what is being done
      --help           display this help and exit`,
      man: `CP(1)                        User Commands                       CP(1)

NAME
       cp - copy files and directories

SYNOPSIS
       cp [OPTION]... SOURCE DEST
       cp [OPTION]... SOURCE... DIRECTORY

DESCRIPTION
       Copy SOURCE to DEST, or multiple sources into DIRECTORY.

OPTIONS
       -r, -R, --recursive
              copy directories recursively.

       -i, --interactive
              prompt before overwrite.

EXAMPLES
       cp file.txt backup/
       cp -r src/ src.bak/

SEE ALSO
       mv(1), install(1)

CP(1)`,
    },
    {
      name: "mv",
      section: 1,
      whatis: "move (rename) files",
      keywords: ["move", "rename", "file"],
      help: `Usage: mv [OPTION]... SOURCE DEST
  or:  mv [OPTION]... SOURCE... DIRECTORY

Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.

  -i, --interactive  prompt before overwrite
  -v, --verbose      explain what is being done
      --help         display this help and exit`,
      man: `MV(1)                        User Commands                       MV(1)

NAME
       mv - move (rename) files

SYNOPSIS
       mv [OPTION]... SOURCE DEST

DESCRIPTION
       Rename SOURCE to DEST, or move sources into a directory.

OPTIONS
       -i     prompt before overwrite.

SEE ALSO
       cp(1), rename(1)

MV(1)`,
    },
    {
      name: "grep",
      section: 1,
      whatis: "print lines that match patterns",
      keywords: ["search", "pattern", "match", "text", "find"],
      help: `Usage: grep [OPTION]... PATTERN [FILE]...
Search for PATTERN in each FILE.

  -i, --ignore-case  ignore case distinctions
  -n, --line-number  print line number with output
  -r, --recursive    read all files under each directory
  -E, --extended-regexp  PATTERN is an extended regex
      --help         display this help and exit`,
      man: `GREP(1)                      User Commands                     GREP(1)

NAME
       grep - print lines that match patterns

SYNOPSIS
       grep [OPTION]... PATTERN [FILE]...

DESCRIPTION
       grep searches for PATTERN in each FILE and prints matching lines.

OPTIONS
       -i     ignore case.
       -n     print line numbers.
       -r     recurse into directories.

EXAMPLES
       grep ERROR logs/*.log
       grep -n TODO src/*.v

SEE ALSO
       find(1), sed(1)

GREP(1)`,
    },
    {
      name: "find",
      section: 1,
      whatis: "search for files in a directory hierarchy",
      keywords: ["search", "file", "directory", "hierarchy", "name"],
      help: `Usage: find [PATH]... [EXPRESSION]
Search for files in a directory hierarchy.

  -name PATTERN   base of file name matches shell pattern
  -type f|d       file is of type f (regular) or d (directory)
  -maxdepth N     descend at most N levels
      --help      display this help and exit`,
      man: `FIND(1)                      User Commands                     FIND(1)

NAME
       find - search for files in a directory hierarchy

SYNOPSIS
       find [PATH]... [EXPRESSION]

DESCRIPTION
       Search the directory tree rooted at PATH for files matching
       EXPRESSION.

EXAMPLES
       find . -name '*.v'
       find src -type f -name 'tb_*.sv'

SEE ALSO
       locate(1), grep(1)

FIND(1)`,
    },
    {
      name: "pwd",
      section: 1,
      whatis: "print name of current/working directory",
      keywords: ["print", "working", "directory", "path"],
      help: `Usage: pwd [OPTION]...
Print the full filename of the current working directory.

      --help  display this help and exit`,
      man: `PWD(1)                       User Commands                      PWD(1)

NAME
       pwd - print name of current/working directory

SYNOPSIS
       pwd [OPTION]...

DESCRIPTION
       Print the absolute path of the current working directory.

PWD(1)`,
    },
    {
      name: "mkdir",
      section: 1,
      whatis: "make directories",
      keywords: ["make", "directory", "create"],
      help: `Usage: mkdir [OPTION]... DIRECTORY...
Create the DIRECTORY(ies), if they do not already exist.

  -p, --parents  no error if existing, make parent directories as needed
  -v, --verbose  print a message for each created directory
      --help     display this help and exit`,
      man: `MKDIR(1)                     User Commands                    MKDIR(1)

NAME
       mkdir - make directories

SYNOPSIS
       mkdir [OPTION]... DIRECTORY...

DESCRIPTION
       Create the DIRECTORY(ies), if they do not already exist.

OPTIONS
       -p     create parent directories as needed.

MKDIR(1)`,
    },
    {
      name: "make",
      section: 1,
      whatis: "GNU make utility to maintain groups of programs",
      keywords: ["build", "compile", "makefile", "target"],
      help: `Usage: make [OPTION]... [TARGET]...
Update files based on rules in a Makefile.

  -n, --dry-run   print commands without executing
  -j N            run up to N jobs in parallel
  -C DIR          change to DIR before reading Makefiles
      --help      display this help and exit`,
      man: `MAKE(1)                      User Commands                     MAKE(1)

NAME
       make - GNU make utility to maintain groups of programs

SYNOPSIS
       make [OPTION]... [TARGET]...

DESCRIPTION
       The make utility determines which pieces of a program need to be
       recompiled and issues commands to recompile them.

EXAMPLES
       make test
       make -n clean

SEE ALSO
       Makefile conventions in Info docs.

MAKE(1)`,
    },
    {
      name: "git",
      section: 1,
      whatis: "the stupid content tracker",
      keywords: ["version", "control", "commit", "repository"],
      help: `usage: git [--version] [--help] <command> [<args>]

Common commands:
   clone     Clone a repository into a new directory
   add       Add file contents to the index
   commit    Record changes to the repository
   status    Show the working tree status
   push      Update remote refs along with associated objects

'git help <command>' or 'git <command> --help' for more.`,
      man: `GIT(1)                       Git Manual                        GIT(1)

NAME
       git - the stupid content tracker

SYNOPSIS
       git [--version] [--help] <command> [<args>]

DESCRIPTION
       Git is a fast, scalable, distributed revision control system.

COMMON COMMANDS
       clone, add, commit, status, push, pull, branch, checkout

SEE ALSO
       git-help(1)

GIT(1)`,
    },
    {
      name: "chmod",
      section: 1,
      whatis: "change file mode bits",
      keywords: ["permission", "mode", "access", "bits"],
      help: `Usage: chmod [OPTION]... MODE[,MODE]... FILE...
  or:  chmod [OPTION]... OCTAL-MODE FILE...

Change the file mode bits of each FILE.

  -R, --recursive  change files and directories recursively
      --help       display this help and exit`,
      man: `CHMOD(1)                     User Commands                    CHMOD(1)

NAME
       chmod - change file mode bits

SYNOPSIS
       chmod [OPTION]... MODE FILE...

DESCRIPTION
       Change the file mode bits of each given FILE according to MODE,
       which can be symbolic (u+x) or octal (755).

EXAMPLES
       chmod u+x script.sh
       chmod 644 README.md

SEE ALSO
       chown(1), umask(2)

CHMOD(1)`,
    },
  ];

  const BY_NAME = Object.fromEntries(PAGES.map((p) => [p.name, p]));
  const LINES_PER_PAGE = 10;

  const CLEARED_KEY = "ddv-man-help-lab-cleared-v1";
  const STORE_KEY = "ddv-man-help-lab-session-v1";

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
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  let mode = "shell"; // shell | pager | search
  let pagerTopic = null;
  let pagerLines = [];
  let pagerOffset = 0;
  let searchQuery = "";
  let searchHits = [];
  let searchHitIdx = 0;
  let lastCmd = "";
  let lastWhatis = "";
  let lastApropos = [];
  let lastHelpCmd = "";
  let lastManTopic = "";
  let lastManSearch = "";

  const root = document.getElementById("help-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Run <code>man ls</code>, press <kbd>Space</kbd> to page,
        <code>/</code> then <code>recursive</code> to search, <code>q</code> to quit.
        Compare with <code>ls --help</code>, then try <code>whatis cp</code> and <code>apropos copy</code>.</p>
      <button type="button" class="btn btn-secondary" id="help-starter">Load starter example</button>
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
        <div class="panel-body" style="padding:0">
          <div class="help-term" id="term" tabindex="0">
            <div class="help-scroll" id="term-scroll"></div>
            <div class="pager-bar" id="pager-bar" hidden>
              <span id="pager-status"></span>
              <button type="button" id="btn-space">Space ↓</button>
              <button type="button" id="btn-b">b ↑</button>
              <button type="button" id="btn-slash">/ search</button>
              <button type="button" id="btn-n">n next</button>
              <button type="button" id="btn-q">q quit</button>
            </div>
            <div class="help-prompt-row">
              <span class="help-prompt" id="prompt">lab$</span>
              <input class="help-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                aria-label="Command line" />
            </div>
          </div>
          <p class="status-line" id="status-line"></p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Catalog topics</h2></div>
        <div class="panel-body">
          <div class="cmd-chips" id="cmd-chips"></div>
          <ul class="hint-list" style="margin-top:0.85rem">
            <li><code>man TOPIC</code> — full page (Space / b / / / q)</li>
            <li><code>TOPIC --help</code> — short usage</li>
            <li><code>whatis TOPIC</code> — one-line NAME</li>
            <li><code>apropos KEYWORD</code> or <code>man -k KEYWORD</code></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>When to use what</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Goal</th><th>Command</th></tr></thead>
          <tbody>
            <tr><td>Full manual + examples</td><td><code>man command</code></td></tr>
            <tr><td>Quick flag reminder</td><td><code>command --help</code></td></tr>
            <tr><td>What does this name do?</td><td><code>whatis command</code></td></tr>
            <tr><td>Which command for “copy”?</td><td><code>apropos copy</code></td></tr>
            <tr><td>Section 1 = user commands</td><td><code>man 1 ls</code> (same as <code>man ls</code> here)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const promptEl = document.getElementById("prompt");
  const pagerBar = document.getElementById("pager-bar");
  const pagerStatus = document.getElementById("pager-status");
  const statusEl = document.getElementById("status-line");
  const termEl = document.getElementById("term");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 100) screen = screen.slice(-70);
  }

  function renderShellScreen() {
    scrollEl.innerHTML = screen
      .map((row) => {
        const cls = row.kind === "cmd" ? "" : row.kind === "err" ? "err" : row.kind === "muted" ? "muted" : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function highlightLine(line, q) {
    if (!q) return escapeHtml(line);
    const idx = line.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return escapeHtml(line);
    return (
      escapeHtml(line.slice(0, idx)) +
      `<span class="hl">${escapeHtml(line.slice(idx, idx + q.length))}</span>` +
      escapeHtml(line.slice(idx + q.length))
    );
  }

  function renderPager() {
    const slice = pagerLines.slice(pagerOffset, pagerOffset + LINES_PER_PAGE);
    scrollEl.innerHTML = slice
      .map((line) => `<div class="out">${highlightLine(line, searchQuery)}</div>`)
      .join("");
    const end = Math.min(pagerOffset + LINES_PER_PAGE, pagerLines.length);
    pagerStatus.textContent = `${pagerTopic} · lines ${pagerOffset + 1}–${end} / ${pagerLines.length}` +
      (searchQuery ? ` · /${searchQuery} (${searchHits.length} hits)` : "");
    statusEl.textContent = mode === "search" ? `search: /${searchQuery}_` : "pager: Space next · b prev · / find · n next hit · q quit";
  }

  function openMan(topic) {
    const page = BY_NAME[topic];
    if (!page) return false;
    pagerTopic = topic;
    pagerLines = page.man.split("\n");
    pagerOffset = 0;
    searchQuery = "";
    searchHits = [];
    searchHitIdx = 0;
    mode = "pager";
    lastManTopic = topic;
    pagerBar.hidden = false;
    promptEl.textContent = ":";
    promptEl.classList.add("pager");
    inputEl.value = "";
    inputEl.placeholder = "pager keys or q";
    renderPager();
    return true;
  }

  function closePager() {
    mode = "shell";
    pagerBar.hidden = true;
    promptEl.textContent = "lab$";
    promptEl.classList.remove("pager");
    inputEl.placeholder = "man · --help · whatis · apropos";
    renderShellScreen();
    statusEl.textContent = `last: ${lastCmd || "(none)"}`;
    inputEl.focus();
  }

  function buildSearchHits(q) {
    const qq = q.toLowerCase();
    searchHits = [];
    if (!qq) return;
    pagerLines.forEach((line, i) => {
      if (line.toLowerCase().includes(qq)) searchHits.push(i);
    });
  }

  function jumpToHit(dir) {
    if (!searchHits.length) return;
    searchHitIdx = (searchHitIdx + dir + searchHits.length) % searchHits.length;
    const line = searchHits[searchHitIdx];
    pagerOffset = Math.max(0, line - Math.floor(LINES_PER_PAGE / 3));
    lastManSearch = searchQuery;
    renderPager();
  }

  function runWhatis(names) {
    const lines = [];
    for (const n of names) {
      const p = BY_NAME[n];
      if (p) lines.push(`${p.name} (${p.section}) - ${p.whatis}`);
      else lines.push(`${n}: nothing appropriate`);
    }
    lastWhatis = names.join(" ");
    return lines;
  }

  function runApropos(keyword) {
    const k = keyword.toLowerCase().replace(/^"|"$/g, "");
    const hits = PAGES.filter(
      (p) =>
        p.whatis.toLowerCase().includes(k) ||
        p.keywords.some((w) => w.includes(k) || k.includes(w))
    );
    lastApropos = hits.map((p) => p.name);
    if (!hits.length) return [`${keyword}: nothing appropriate`];
    return hits.map((p) => `${p.name} (${p.section}) - ${p.whatis}`);
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "man TOPIC · man -k KEY · apropos KEY · whatis TOPIC…\n" +
          "TOPIC --help · catalog: " +
          PAGES.map((p) => p.name).join(" ")
      );
      return;
    }

    let m;
    if ((m = t.match(/^man\s+-k\s+(.+)$/i)) || (m = t.match(/^apropos\s+(.+)$/i))) {
      runApropos(m[1].trim()).forEach((line) => pushScreen("out", line));
      return;
    }
    if ((m = t.match(/^man\s+(?:\d+\s+)?([A-Za-z0-9_-]+)$/i))) {
      const topic = m[1].toLowerCase();
      if (!openMan(topic)) pushScreen("err", `No manual entry for ${topic}`);
      return;
    }
    if ((m = t.match(/^whatis\s+(.+)$/i))) {
      const names = m[1].trim().split(/\s+/).map((x) => x.toLowerCase());
      runWhatis(names).forEach((line) => pushScreen("out", line));
      return;
    }
    if ((m = t.match(/^([A-Za-z0-9_-]+)\s+(--help|-h)$/i))) {
      const topic = m[1].toLowerCase();
      const page = BY_NAME[topic];
      lastHelpCmd = topic;
      if (!page) {
        pushScreen("err", `${topic}: command not found in lab catalog`);
        return;
      }
      pushScreen("out", page.help);
      return;
    }
    pushScreen("err", `lab: unknown (try help). Examples: man ls · ls --help · whatis cp · apropos copy`);
  }

  function submitLine() {
    const raw = inputEl.value;
    inputEl.value = "";
    if (mode === "search") {
      searchQuery = raw;
      lastManSearch = searchQuery;
      buildSearchHits(searchQuery);
      searchHitIdx = 0;
      mode = "pager";
      promptEl.textContent = ":";
      if (searchHits.length) {
        jumpToHit(0);
      } else {
        renderPager();
        statusEl.textContent = `Pattern not found: ${searchQuery}`;
      }
      return;
    }
    if (mode === "pager") {
      // treat typed commands lightly
      if (raw === "q") {
        closePager();
        pushScreen("muted", `(left man ${pagerTopic})`);
        renderShellScreen();
        return;
      }
      if (raw.startsWith("/")) {
        searchQuery = raw.slice(1);
        buildSearchHits(searchQuery);
        searchHitIdx = 0;
        if (searchHits.length) jumpToHit(0);
        else renderPager();
        return;
      }
      return;
    }
    fakeRun(raw);
    if (mode === "shell") {
      renderShellScreen();
      statusEl.textContent = `last: ${lastCmd}`;
      saveSession();
    }
  }

  function loadStarter() {
    mode = "shell";
    screen = [{ kind: "muted", text: "Starter: try man ls · then ls --help · whatis cp · apropos copy" }];
    lastCmd = "";
    lastWhatis = "";
    lastApropos = [];
    lastHelpCmd = "";
    lastManTopic = "";
    lastManSearch = "";
    closePager();
    renderShellScreen();
    statusEl.textContent = "ready";
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ screen: screen.slice(-40), lastCmd })
      );
    } catch {
      /* ignore */
    }
  }

  // chips
  const chips = document.getElementById("cmd-chips");
  PAGES.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.name;
    b.title = p.whatis;
    b.addEventListener("click", () => {
      if (mode !== "shell") closePager();
      inputEl.value = `man ${p.name}`;
      inputEl.focus();
    });
    chips.appendChild(b);
  });

  const CHALLENGES = [
    {
      id: "quiz-man",
      title: "Quiz: man",
      prompt: "Full manuals are opened with? Answer: <code>man</code>",
      hint: "man command",
      type: "text",
      answer: "man",
    },
    {
      id: "quiz-help",
      title: "Quiz: --help",
      prompt: "Short built-in usage is usually? Answer: <code>--help</code>",
      hint: "double-dash help",
      type: "text",
      answer: "--help",
      alt: ["-h", "help"],
    },
    {
      id: "quiz-whatis",
      title: "Quiz: whatis",
      prompt: "One-line NAME summary command? Answer: <code>whatis</code>",
      hint: "whatis",
      type: "text",
      answer: "whatis",
    },
    {
      id: "quiz-apropos",
      title: "Quiz: apropos",
      prompt: "Search descriptions by keyword? Answer: <code>apropos</code> or <code>man -k</code>",
      hint: "apropos copy",
      type: "text",
      answer: "apropos",
      alt: ["man -k", "man -k keyword"],
    },
    {
      id: "man-ls",
      title: "man ls",
      prompt: "Open <code>man ls</code> (pager should show LS(1)).",
      hint: "Type man ls and Enter.",
      type: "state",
      check: () => mode === "pager" && lastManTopic === "ls",
    },
    {
      id: "page-space",
      title: "Space page",
      prompt: "In <code>man ls</code>, press Space (or Space ↓) so the offset advances past line 1.",
      hint: "Open man ls first, then Space.",
      type: "state",
      check: () => mode === "pager" && lastManTopic === "ls" && pagerOffset > 0,
    },
    {
      id: "search-recursive",
      title: "Search recursive",
      prompt: "In <code>man ls</code> or <code>man cp</code>, search <code>/recursive</code> (use / button or type /recursive).",
      hint: "man ls → / → recursive → Enter, or /recursive",
      type: "state",
      check: () => lastManSearch.toLowerCase().includes("recursive") && searchHits.length > 0,
    },
    {
      id: "quit-pager",
      title: "q quit",
      prompt: "Open any man page, then <code>q</code> back to the shell prompt.",
      hint: "q button or type q in pager.",
      type: "state",
      check: () => mode === "shell" && lastManTopic !== "" && screen.some((r) => r.kind === "muted" && /left man/.test(r.text)),
    },
    {
      id: "ls-help",
      title: "ls --help",
      prompt: "Run <code>ls --help</code> so the short usage prints.",
      hint: "ls --help",
      type: "state",
      check: () => lastHelpCmd === "ls" && lastCmd.includes("--help"),
    },
    {
      id: "cp-help",
      title: "cp --help",
      prompt: "Run <code>cp --help</code>.",
      hint: "cp --help",
      type: "state",
      check: () => lastHelpCmd === "cp",
    },
    {
      id: "whatis-cp",
      title: "whatis cp",
      prompt: "Run <code>whatis cp</code>. What is the one-line description? (exact words after - )",
      hint: "copy files and directories",
      type: "text",
      answer: "copy files and directories",
      setup: () => {
        if (mode !== "shell") closePager();
        fakeRun("whatis cp");
        renderShellScreen();
      },
    },
    {
      id: "whatis-ls",
      title: "whatis ls",
      prompt: "Run <code>whatis ls</code>. Description after - ?",
      hint: "list directory contents",
      type: "text",
      answer: "list directory contents",
    },
    {
      id: "apropos-copy",
      title: "apropos copy",
      prompt: "Run <code>apropos copy</code> — <code>cp</code> should appear in results.",
      hint: "apropos copy",
      type: "state",
      check: () => lastApropos.includes("cp"),
    },
    {
      id: "apropos-permission",
      title: "apropos permission",
      prompt: "Run <code>apropos permission</code> — expect <code>chmod</code>.",
      hint: "apropos permission",
      type: "state",
      check: () => lastApropos.includes("chmod"),
    },
    {
      id: "man-k-alias",
      title: "man -k",
      prompt: "Run <code>man -k build</code> (alias of apropos) — expect <code>make</code>.",
      hint: "man -k build",
      type: "state",
      check: () => lastApropos.includes("make") && /man\s+-k/i.test(lastCmd),
    },
    {
      id: "section-quiz",
      title: "Quiz: section 1",
      prompt: "User commands are man section? Answer: <code>1</code>",
      hint: "ls (1)",
      type: "text",
      answer: "1",
    },
    {
      id: "compare-quiz",
      title: "Quiz: man vs help",
      prompt: "Which is usually longer / more detailed? Answer: <code>man</code>",
      hint: "man pages are full manuals",
      type: "text",
      answer: "man",
    },
    {
      id: "man-grep",
      title: "man grep",
      prompt: "Open <code>man grep</code>.",
      hint: "man grep",
      type: "state",
      check: () => mode === "pager" && lastManTopic === "grep",
    },
    {
      id: "whatis-multi",
      title: "whatis multi",
      prompt: "Run <code>whatis ls cp</code> (two names).",
      hint: "whatis ls cp",
      type: "state",
      check: () => lastWhatis.includes("ls") && lastWhatis.includes("cp"),
    },
    {
      id: "help-make",
      title: "make --help",
      prompt: "Run <code>make --help</code> and note dry-run flag exists.",
      hint: "make --help",
      type: "state",
      check: () => lastHelpCmd === "make",
    },
    {
      id: "pager-keys-quiz",
      title: "Quiz: quit key",
      prompt: "Key to leave the man pager? Answer: <code>q</code>",
      hint: "q",
      type: "text",
      answer: "q",
    },
    {
      id: "discover-find",
      title: "Discover find",
      prompt: "Use <code>apropos hierarchy</code> or <code>apropos search</code> so <code>find</code> is listed, then Check.",
      hint: "apropos hierarchy",
      type: "state",
      check: () => lastApropos.includes("find"),
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the terminal / pager, then Check.</span>`;
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

  function pagerKey(e) {
    if (mode === "shell") return false;
    if (mode === "search") return false;
    if (e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      pagerOffset = Math.min(pagerOffset + LINES_PER_PAGE, Math.max(0, pagerLines.length - 1));
      renderPager();
      return true;
    }
    if (e.key === "b" || e.key === "PageUp") {
      e.preventDefault();
      pagerOffset = Math.max(0, pagerOffset - LINES_PER_PAGE);
      renderPager();
      return true;
    }
    if (e.key === "q") {
      e.preventDefault();
      closePager();
      pushScreen("muted", `(left man ${pagerTopic})`);
      renderShellScreen();
      return true;
    }
    if (e.key === "/") {
      e.preventDefault();
      mode = "search";
      promptEl.textContent = "/";
      inputEl.value = "";
      inputEl.focus();
      statusEl.textContent = "type search text, Enter";
      return true;
    }
    if (e.key === "n") {
      e.preventDefault();
      jumpToHit(1);
      return true;
    }
    if (e.key === "N") {
      e.preventDefault();
      jumpToHit(-1);
      return true;
    }
    return false;
  }

  document.getElementById("help-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-space").addEventListener("click", () => {
    pagerOffset = Math.min(pagerOffset + LINES_PER_PAGE, Math.max(0, pagerLines.length - 1));
    renderPager();
  });
  document.getElementById("btn-b").addEventListener("click", () => {
    pagerOffset = Math.max(0, pagerOffset - LINES_PER_PAGE);
    renderPager();
  });
  document.getElementById("btn-slash").addEventListener("click", () => {
    mode = "search";
    promptEl.textContent = "/";
    inputEl.value = "";
    inputEl.focus();
  });
  document.getElementById("btn-n").addEventListener("click", () => jumpToHit(1));
  document.getElementById("btn-q").addEventListener("click", () => {
    const topic = pagerTopic;
    closePager();
    pushScreen("muted", `(left man ${topic})`);
    renderShellScreen();
  });

  inputEl.addEventListener("keydown", (e) => {
    if (mode === "pager" && e.target === inputEl && e.key.length === 1 && !e.ctrlKey) {
      // allow typing q, /, etc. via submit; also handle single keys when empty
      if (!inputEl.value && pagerKey(e)) return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submitLine();
    }
  });

  termEl.addEventListener("keydown", (e) => {
    if (document.activeElement === inputEl && inputEl.value) return;
    pagerKey(e);
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

  loadStarter();
  renderChallenge();
})();
