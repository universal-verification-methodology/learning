(() => {
  const CLEARED_KEY = "ddv-alias-lab-cleared-v1";
  const STORE_KEY = "ddv-alias-lab-session-v1";

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

  /** @type {Record<string, string>} */
  let aliases = {};
  /** @type {Record<string, string[]>} */
  let functions = {};
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  let lastCmd = "";
  let lastOut = "";
  let sessionNote = "session"; // session | pretend-bashrc
  let savedToRc = false;

  const root = document.getElementById("al-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>alias ll='ls -la'</code> and
        <code>greet() { echo hello $1; }</code> are defined.
        Run <code>ll</code> vs <code>greet lab</code> — aliases don’t take real args the same way.</p>
      <button type="button" class="btn btn-secondary" id="al-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Lab shell</h2></div>
        <div class="panel-body">
          <div class="persist-banner" id="persist-banner"></div>
          <div class="al-term">
            <div class="al-scroll" id="term-scroll"></div>
            <div class="al-prompt-row">
              <span class="al-prompt">lab$</span>
              <input class="al-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="alias · unalias · name() { … } · type · help"
                aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Defined names</h2></div>
        <div class="panel-body">
          <table class="def-table" id="def-table"></table>
          <p class="pane-label" style="margin:0.85rem 0 0.35rem;font-size:0.8rem;color:var(--muted);font-family:var(--mono)">Would go in ~/.bashrc</p>
          <pre class="rc-box" id="rc-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Alias vs function</h2></div>
      <div class="panel-body">
        <div class="compare-grid">
          <div class="compare-card">
            <h3>alias</h3>
            <ul>
              <li>Text substitution of the command word</li>
              <li>Awkward with arguments / logic</li>
              <li>Session-only unless saved in <code>.bashrc</code></li>
            </ul>
          </div>
          <div class="compare-card">
            <h3>function</h3>
            <ul>
              <li>Real body; <code>$1</code>, <code>$2</code>, …</li>
              <li>Better for multi-step / conditionals</li>
              <li>Also session-only until sourced from a file</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>alias name='cmd'</code></td><td>Define alias</td></tr>
            <tr><td><code>alias</code></td><td>List aliases</td></tr>
            <tr><td><code>unalias name</code></td><td>Remove alias</td></tr>
            <tr><td><code>name() { …; }</code></td><td>Define function (lab one-liner)</td></tr>
            <tr><td><code>type name</code></td><td>Show alias / function / command</td></tr>
            <tr><td><code>save-rc</code></td><td>Lab: pretend write defs to ~/.bashrc</td></tr>
            <tr><td><code>new-shell</code></td><td>Lab: new session (keeps only “saved” defs)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Typing <code>alias ll</code> after defining it shows the expansion.</li>
          <li>Prefer functions when you need arguments or more than a short shortcut.</li>
        </ul>
      </div>
    </div>
  `;

  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const defTable = document.getElementById("def-table");
  const rcBox = document.getElementById("rc-box");
  const persistBanner = document.getElementById("persist-banner");

  /** @type {{aliases:Record<string,string>, functions:Record<string,string[]>}|null} */
  let rcSnapshot = null;

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 100) screen = screen.slice(-80);
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
                : row.kind === "def"
                  ? "def"
                  : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderDefs() {
    const rows = [];
    Object.keys(aliases)
      .sort()
      .forEach((name) => {
        rows.push(
          `<tr><td class="kind-alias">alias</td><td>${escapeHtml(name)}</td><td>${escapeHtml(aliases[name])}</td></tr>`
        );
      });
    Object.keys(functions)
      .sort()
      .forEach((name) => {
        rows.push(
          `<tr><td class="kind-fn">function</td><td>${escapeHtml(name)}</td><td>${escapeHtml(functions[name].join("; "))}</td></tr>`
        );
      });
    defTable.innerHTML = rows.length
      ? `<thead><tr><th>kind</th><th>name</th><th>body</th></tr></thead><tbody>${rows.join("")}</tbody>`
      : `<tbody><tr><td colspan="3" style="color:var(--muted)">No aliases or functions yet</td></tr></tbody>`;

    if (rcSnapshot) {
      const lines = [];
      Object.keys(rcSnapshot.aliases).forEach((n) => {
        lines.push(`alias ${n}='${rcSnapshot.aliases[n]}'`);
      });
      Object.keys(rcSnapshot.functions).forEach((n) => {
        lines.push(`${n}() { ${rcSnapshot.functions[n].join("; ")}; }`);
      });
      rcBox.textContent = lines.join("\n") || "# (empty)";
    } else {
      rcBox.textContent = "# not saved yet — run save-rc";
    }

    persistBanner.innerHTML = savedToRc
      ? `<strong>Persisted:</strong> defs saved to pretend <code>~/.bashrc</code>. <code>new-shell</code> will reload them.`
      : `<strong>Session only:</strong> aliases/functions vanish on <code>new-shell</code> unless you <code>save-rc</code> first.`;
  }

  function renderAll() {
    renderScreen();
    renderDefs();
  }

  function expandAliasWord(word) {
    if (aliases[word]) return aliases[word];
    return word;
  }

  function runEcho(args) {
    // very small echo
    const parts = [];
    for (const a of args) {
      if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
        parts.push(a.slice(1, -1));
      } else parts.push(a);
    }
    const line = parts.join(" ");
    pushScreen("out", line);
    lastOut = line;
  }

  function runLs(args) {
    const long = args.includes("-l") || args.includes("-la") || args.includes("-al");
    if (long) {
      pushScreen("out", "drwxr-xr-x  chip/");
      pushScreen("out", "-rw-r--r--  Makefile");
      pushScreen("out", "-rw-r--r--  notes.txt");
      lastOut = "ls -la";
    } else {
      pushScreen("out", "chip/  Makefile  notes.txt");
      lastOut = "ls";
    }
  }

  function runFunction(name, argWords) {
    const body = functions[name];
    if (!body) return false;
    for (const stmt of body) {
      let s = stmt;
      s = s.replace(/\$1/g, argWords[0] || "");
      s = s.replace(/\$2/g, argWords[1] || "");
      s = s.replace(/\$@/g, argWords.join(" "));
      s = s.replace(/\$#/g, String(argWords.length));
      execExpanded(s);
    }
    return true;
  }

  function tokenize(line) {
    const re = /'[^']*'|"[^"]*"|\S+/g;
    const out = [];
    let m;
    while ((m = re.exec(line))) out.push(m[0]);
    return out;
  }

  function execExpanded(line) {
    const t = line.trim();
    if (!t) return;
    const tokens = tokenize(t);
    let cmd = tokens[0];
    let rest = tokens.slice(1);

    // alias expands only the command word
    const expanded = expandAliasWord(cmd);
    if (expanded !== cmd) {
      const more = tokenize(expanded);
      cmd = more[0];
      rest = more.slice(1).concat(rest);
      pushScreen("muted", `(alias → ${expanded}${rest.length && more.length === 1 ? " …" : ""})`);
    }

    if (functions[cmd]) {
      runFunction(cmd, rest.map(stripQ));
      return;
    }

    if (cmd === "echo") {
      runEcho(rest);
      return;
    }
    if (cmd === "ls") {
      runLs(rest);
      return;
    }
    if (cmd === "pwd") {
      pushScreen("out", "/home/lab/chip");
      lastOut = "/home/lab/chip";
      return;
    }
    if (cmd === "true") return;
    if (cmd === "false") return;

    pushScreen("err", `lab: ${cmd}: command not found`);
  }

  function stripQ(s) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    lastOut = "";
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "alias · unalias · name() { cmds; } · type · save-rc · new-shell · echo · ls · help"
      );
      return;
    }

    if (t === "alias") {
      const names = Object.keys(aliases).sort();
      if (!names.length) pushScreen("muted", "(no aliases)");
      names.forEach((n) => pushScreen("def", `alias ${n}='${aliases[n]}'`));
      return;
    }

    let m;
    if ((m = t.match(/^alias\s+(\w+)$/))) {
      const n = m[1];
      if (aliases[n]) pushScreen("def", `alias ${n}='${aliases[n]}'`);
      else pushScreen("err", `bash: alias: ${n}: not found`);
      return;
    }

    if ((m = t.match(/^alias\s+(\w+)=(['"])(.*?)\2\s*$/))) {
      aliases[m[1]] = m[3];
      pushScreen("muted", `(alias ${m[1]} defined)`);
      savedToRc = false;
      return;
    }
    if ((m = t.match(/^alias\s+(\w+)=(\S+)\s*$/))) {
      aliases[m[1]] = m[2];
      pushScreen("muted", `(alias ${m[1]} defined)`);
      savedToRc = false;
      return;
    }

    if ((m = t.match(/^unalias\s+(\w+)$/))) {
      if (aliases[m[1]]) {
        delete aliases[m[1]];
        pushScreen("muted", `(unalias ${m[1]})`);
        savedToRc = false;
      } else pushScreen("err", `bash: unalias: ${m[1]}: not found`);
      return;
    }

    // function: name() { echo hello $1; }
    if ((m = t.match(/^(\w+)\s*\(\)\s*\{\s*(.+)\s*\}\s*$/))) {
      const name = m[1];
      const bodyRaw = m[2].replace(/;\s*$/, "");
      const stmts = bodyRaw
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      functions[name] = stmts;
      pushScreen("muted", `(function ${name} defined)`);
      savedToRc = false;
      return;
    }

    if ((m = t.match(/^type\s+(\w+)$/))) {
      const n = m[1];
      if (aliases[n]) {
        pushScreen("out", `${n} is aliased to \`${aliases[n]}\``);
        lastOut = "alias";
      } else if (functions[n]) {
        pushScreen("out", `${n} is a function`);
        lastOut = "function";
      } else if (["echo", "ls", "pwd", "true", "false", "alias", "type"].includes(n)) {
        pushScreen("out", `${n} is a shell builtin / lab command`);
        lastOut = "builtin";
      } else {
        pushScreen("err", `type: ${n}: not found`);
        lastOut = "";
      }
      return;
    }

    if (t === "save-rc") {
      rcSnapshot = {
        aliases: { ...aliases },
        functions: Object.fromEntries(Object.entries(functions).map(([k, v]) => [k, [...v]])),
      };
      savedToRc = true;
      sessionNote = "saved";
      pushScreen("def", "Wrote pretend ~/.bashrc");
      return;
    }

    if (t === "new-shell") {
      if (rcSnapshot) {
        aliases = { ...rcSnapshot.aliases };
        functions = Object.fromEntries(
          Object.entries(rcSnapshot.functions).map(([k, v]) => [k, [...v]])
        );
        savedToRc = true;
        pushScreen("muted", "(new shell — sourced pretend ~/.bashrc)");
      } else {
        aliases = {};
        functions = {};
        savedToRc = false;
        pushScreen("muted", "(new shell — empty; nothing was save-rc'd)");
      }
      sessionNote = "new";
      return;
    }

    if (t === "unset-all") {
      aliases = {};
      functions = {};
      savedToRc = false;
      pushScreen("muted", "(cleared session defs)");
      return;
    }

    execExpanded(t);
  }

  function submitLine() {
    fakeRun(inputEl.value);
    inputEl.value = "";
    renderAll();
    saveSession();
  }

  function loadStarter() {
    aliases = { ll: "ls -la", sim: "echo run_sim" };
    functions = {
      greet: ["echo hello $1"],
      addpath: ["echo PATH+=$1"],
    };
    rcSnapshot = null;
    savedToRc = false;
    sessionNote = "session";
    screen = [
      {
        kind: "muted",
        text: "Starter: alias ll / sim · function greet · try: ll · greet lab · type ll · save-rc · new-shell",
      },
    ];
    lastCmd = "";
    lastOut = "";
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          aliases,
          functions,
          rcSnapshot,
          savedToRc,
          screen: screen.slice(-40),
          lastCmd,
          lastOut,
        })
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
      aliases = data.aliases || {};
      functions = data.functions || {};
      rcSnapshot = data.rcSnapshot || null;
      savedToRc = !!data.savedToRc;
      screen = Array.isArray(data.screen) ? data.screen : [];
      lastCmd = data.lastCmd || "";
      lastOut = data.lastOut || "";
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "alias", cmd: "alias" },
    { label: "ll", cmd: "ll" },
    { label: "greet lab", cmd: "greet lab" },
    { label: "type ll", cmd: "type ll" },
    { label: "type greet", cmd: "type greet" },
    { label: "alias g=…", cmd: "alias g='echo go'" },
    { label: "unalias sim", cmd: "unalias sim" },
    { label: "save-rc", cmd: "save-rc" },
    { label: "new-shell", cmd: "new-shell" },
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
      id: "quiz-alias",
      title: "Quiz: alias",
      prompt: "An alias is mainly a? Answer: <code>shortcut</code> or <code>substitution</code>",
      hint: "text substitution / shortcut",
      type: "text",
      answer: "shortcut",
      alt: ["substitution", "text substitution", "abbrev", "abbreviation"],
    },
    {
      id: "run-ll",
      title: "Run ll",
      prompt: "Run starter alias <code>ll</code> (expands to <code>ls -la</code>).",
      hint: "ll",
      type: "state",
      setup: () => loadStarter(),
      check: () => lastCmd === "ll" && lastOut === "ls -la",
    },
    {
      id: "list-alias",
      title: "List aliases",
      prompt: "Run bare <code>alias</code> to list defined aliases.",
      hint: "alias",
      type: "state",
      check: () => lastCmd === "alias" && screen.some((r) => /alias ll=/.test(r.text)),
    },
    {
      id: "quiz-fn-args",
      title: "Quiz: $1",
      prompt: "Functions receive arguments as? Answer: <code>$1</code>",
      hint: "$1 $2 …",
      type: "text",
      answer: "$1",
      alt: ["$1 $2", "positional", "positional params"],
    },
    {
      id: "greet-lab",
      title: "greet lab",
      prompt: "Run <code>greet lab</code> — stdout <code>hello lab</code>.",
      hint: "greet lab",
      type: "state",
      setup: () => {
        if (!functions.greet) loadStarter();
      },
      check: () => lastCmd === "greet lab" && lastOut === "hello lab",
    },
    {
      id: "type-ll",
      title: "type ll",
      prompt: "Run <code>type ll</code> — should report an alias.",
      hint: "type ll",
      type: "state",
      check: () => lastCmd === "type ll" && lastOut === "alias",
    },
    {
      id: "type-greet",
      title: "type greet",
      prompt: "Run <code>type greet</code> — should report a function.",
      hint: "type greet",
      type: "state",
      check: () => lastCmd === "type greet" && lastOut === "function",
    },
    {
      id: "define-alias",
      title: "Define alias",
      prompt: "Create <code>alias g='echo go'</code> then run <code>g</code>.",
      hint: "alias g='echo go' then g",
      type: "state",
      check: () => aliases.g === "echo go" && lastCmd === "g" && lastOut === "go",
    },
    {
      id: "unalias-sim",
      title: "unalias",
      prompt: "Remove starter <code>sim</code> with <code>unalias sim</code>.",
      hint: "unalias sim",
      type: "state",
      setup: () => {
        aliases.sim = "echo run_sim";
      },
      check: () => lastCmd === "unalias sim" && !aliases.sim,
    },
    {
      id: "quiz-session",
      title: "Quiz: session",
      prompt: "Without saving, aliases live only in the? Answer: <code>session</code>",
      hint: "current shell session",
      type: "text",
      answer: "session",
      alt: ["shell session", "current session"],
    },
    {
      id: "save-rc",
      title: "save-rc",
      prompt: "Run <code>save-rc</code> so defs appear in the pretend bashrc box.",
      hint: "save-rc",
      type: "state",
      check: () => lastCmd === "save-rc" && savedToRc && rcSnapshot != null,
    },
    {
      id: "new-shell-keep",
      title: "new-shell keeps",
      prompt: "After <code>save-rc</code>, run <code>new-shell</code> — <code>ll</code> should still exist.",
      hint: "save-rc then new-shell",
      type: "state",
      check: () =>
        lastCmd === "new-shell" &&
        aliases.ll === "ls -la" &&
        rcSnapshot != null,
    },
    {
      id: "new-shell-lose",
      title: "new-shell loses",
      prompt: "With nothing saved, after <code>new-shell</code> the throwaway <code>tmp</code> alias should be gone.",
      hint: "Challenge prepares tmp without save-rc — just run new-shell",
      type: "state",
      setup: () => {
        rcSnapshot = null;
        aliases = { tmp: "echo x" };
        functions = {};
        savedToRc = false;
        renderAll();
      },
      check: () => lastCmd === "new-shell" && !aliases.tmp,
    },
    {
      id: "define-fn",
      title: "Define function",
      prompt: "Define <code>hi() { echo hi $1; }</code> and run <code>hi chip</code>.",
      hint: "hi() { echo hi $1; }",
      type: "state",
      check: () =>
        functions.hi &&
        functions.hi.some((s) => s.includes("$1")) &&
        lastCmd === "hi chip" &&
        lastOut === "hi chip",
    },
    {
      id: "quiz-prefer-fn",
      title: "Quiz: prefer fn",
      prompt: "Need arguments and logic? Prefer? Answer: <code>function</code>",
      hint: "function",
      type: "text",
      answer: "function",
      alt: ["fn", "functions"],
    },
    {
      id: "quiz-bashrc",
      title: "Quiz: bashrc",
      prompt: "To keep aliases across logins, put them in? Answer: <code>.bashrc</code>",
      hint: "~/.bashrc",
      type: "text",
      answer: ".bashrc",
      alt: ["bashrc", "~/.bashrc"],
    },
    {
      id: "sim-alias",
      title: "sim alias",
      prompt: "Run starter <code>sim</code> — prints <code>run_sim</code>.",
      hint: "sim",
      type: "state",
      setup: () => {
        aliases.sim = "echo run_sim";
      },
      check: () => lastCmd === "sim" && lastOut === "run_sim",
    },
    {
      id: "quiz-expand",
      title: "Quiz: expand",
      prompt: "Aliases expand the? Answer: <code>command</code> word",
      hint: "first word / command word",
      type: "text",
      answer: "command",
      alt: ["command word", "first word", "cmd"],
    },
    {
      id: "alias-show",
      title: "Show one",
      prompt: "Run <code>alias ll</code> to print just that alias.",
      hint: "alias ll",
      type: "state",
      setup: () => {
        aliases.ll = "ls -la";
      },
      check: () => lastCmd === "alias ll" && screen.some((r) => r.text === "alias ll='ls -la'"),
    },
    {
      id: "addpath-fn",
      title: "addpath",
      prompt: "Run <code>addpath /opt/tools</code> — uses <code>$1</code>.",
      hint: "addpath /opt/tools",
      type: "state",
      setup: () => {
        functions.addpath = ["echo PATH+=$1"];
      },
      check: () => lastCmd === "addpath /opt/tools" && lastOut === "PATH+=/opt/tools",
    },
    {
      id: "quiz-both-session",
      title: "Quiz: both",
      prompt: "Are functions also session-only until sourced? Answer: <code>yes</code>",
      hint: "yes — same persistence story",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "rc-contains-ll",
      title: "bashrc content",
      prompt: "save-rc with starter defs — pretend bashrc should mention <code>ll</code>.",
      hint: "Load starter, save-rc",
      type: "state",
      check: () =>
        rcSnapshot &&
        rcSnapshot.aliases &&
        rcSnapshot.aliases.ll === "ls -la",
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the shell, then Check.</span>`;
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

  document.getElementById("al-starter").addEventListener("click", loadStarter);
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
