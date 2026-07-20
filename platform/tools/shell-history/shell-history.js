(() => {
  const STARTER_HISTORY = [
    "pwd",
    "ls -la",
    "cd ~/projects/uart_tx",
    "make clean",
    "make test",
    "git status",
    "git add src/uart_tx.v",
    "git commit -m \"fix baud tick\"",
    "iverilog -o sim.vvp tb/tb_uart.v src/uart_tx.v",
    "vvp sim.vvp",
  ];

  const CLEARED_KEY = "ddv-shell-history-cleared-v1";
  const STORE_KEY = "ddv-shell-history-session-v1";

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

  /** @type {string[]} */
  let history = [];
  /** Screen log lines: {kind, text} */
  let screen = [];
  let line = "";
  let cursor = 0;
  /** null = not browsing; number = index into history */
  let histBrowse = null;
  let mode = "normal"; // normal | isearch
  let isearchQuery = "";
  /** index into history of current isearch match, or -1 */
  let isearchIdx = -1;
  let lastExpanded = "";
  let lastRaw = "";
  let lastExit = 0;

  const root = document.getElementById("sh-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> History already has a UART project session.
        Press <kbd class="kbd-chip">Ctrl+R</kbd>, type <code>make</code>, then Enter to recall
        <code>make test</code>. Try <code>history</code>, ↑/↓, and <code>!!</code>.</p>
      <button type="button" class="btn btn-secondary" id="sh-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Lab terminal</h2>
          <div class="tool-actions">
            <button type="button" class="btn btn-ghost" id="btn-isearch" title="Browser may steal Ctrl+R — use this">Reverse-search</button>
            <button type="button" class="btn btn-ghost" id="btn-clear-screen">Clear screen</button>
          </div>
        </div>
        <div class="panel-body" style="padding:0">
          <div class="sh-term" id="term">
            <div class="sh-term-scroll" id="term-scroll" aria-live="polite"></div>
            <div class="sh-prompt-row">
              <span class="sh-isearch-label" id="isearch-label" hidden>(reverse-i-search)</span>
              <span class="sh-prompt" id="prompt">lab$</span>
              <input class="sh-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                aria-label="Command line" />
            </div>
          </div>
          <p class="sh-status" id="status-line"></p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>History list</h2>
          <button type="button" class="btn btn-ghost" id="btn-hist-refresh">Refresh</button>
        </div>
        <div class="panel-body">
          <ol class="hist-list" id="hist-panel"></ol>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Shortcuts &amp; expansions</h2></div>
      <div class="panel-body">
        <table class="shortcut-table">
          <thead><tr><th>Key / token</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><kbd>↑</kbd> / <kbd>↓</kbd></td><td>Step backward / forward through history</td></tr>
            <tr><td><kbd>Ctrl+R</kbd></td><td>Reverse incremental search — type a substring; <kbd>Ctrl+R</kbd> again = older match</td></tr>
            <tr><td><kbd>Esc</kbd> / <kbd>Ctrl+G</kbd></td><td>Cancel reverse-search</td></tr>
            <tr><td><kbd>Ctrl+A</kbd> / <kbd>Ctrl+E</kbd></td><td>Cursor to start / end of line</td></tr>
            <tr><td><kbd>Ctrl+U</kbd> / <kbd>Ctrl+K</kbd></td><td>Kill to start / kill to end</td></tr>
            <tr><td><kbd>Ctrl+W</kbd></td><td>Kill word before cursor</td></tr>
            <tr><td><code>history</code> · <code>history N</code></td><td>List all or last N entries</td></tr>
            <tr><td><code>!!</code></td><td>Previous command</td></tr>
            <tr><td><code>!n</code></td><td>Command number <em>n</em> from <code>history</code></td></tr>
            <tr><td><code>!$</code></td><td>Last argument of previous command</td></tr>
            <tr><td><code>!prefix</code></td><td>Most recent command starting with <em>prefix</em></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.85rem">
          <li>Focus the prompt and type normally — shortcuts are captured on the input.</li>
          <li>Lab builtins: <code>help</code>, <code>history</code>, <code>history -c</code>, <code>clear</code>, <code>echo …</code>.</li>
          <li>Other commands print a short fake reply and still join history.</li>
        </ul>
      </div>
    </div>
  `;

  const inputEl = document.getElementById("line-input");
  const scrollEl = document.getElementById("term-scroll");
  const histPanel = document.getElementById("hist-panel");
  const statusEl = document.getElementById("status-line");
  const isearchLabel = document.getElementById("isearch-label");
  const promptEl = document.getElementById("prompt");

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ history, screen: screen.slice(-80) })
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
      if (Array.isArray(data.history) && data.history.length) {
        history = data.history.map(String);
        screen = Array.isArray(data.screen) ? data.screen : [];
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function lastArg(cmd) {
    const parts = String(cmd).trim().split(/\s+/);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function expandHistory(raw) {
    let s = raw;
    // !$ first (may appear alone or in a line)
    if (history.length) {
      const la = lastArg(history[history.length - 1]);
      s = s.replace(/(^|[\s])!\$(\s|$)/g, (_, a, b) => `${a}${la}${b}`);
    }
    // !! 
    if (s.includes("!!") && history.length) {
      s = s.replace(/!!/g, history[history.length - 1]);
    }
    // !n  (1-based)
    s = s.replace(/!(\d+)/g, (_, n) => {
      const i = Number(n) - 1;
      return i >= 0 && i < history.length ? history[i] : `!${n}`;
    });
    // !prefix — whole token at start or after space
    s = s.replace(/(^|[\s])!([A-Za-z_][\w./-]*)/g, (m, sp, pref) => {
      if (pref === "$") return m;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].startsWith(pref)) return sp + history[i];
      }
      return m;
    });
    return s;
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 200) screen = screen.slice(-160);
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

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderHistPanel() {
    const match = mode === "isearch" && isearchIdx >= 0 ? isearchIdx : -1;
    histPanel.innerHTML = history
      .map(
        (cmd, i) =>
          `<li class="${i === match ? "is-match" : ""}"><span class="n">${i + 1}</span><span>${escapeHtml(cmd)}</span></li>`
      )
      .join("");
  }

  function updateStatus() {
    if (mode === "isearch") {
      const hit = isearchIdx >= 0 ? history[isearchIdx] : "(failed)";
      statusEl.textContent = `reverse-i-search \`${isearchQuery}\`: ${hit}`;
      isearchLabel.hidden = false;
      promptEl.hidden = true;
    } else {
      statusEl.textContent = `history: ${history.length} · last exit ${lastExit}` +
        (lastExpanded && lastExpanded !== line ? ` · expanded “${lastExpanded}”` : "");
      isearchLabel.hidden = true;
      promptEl.hidden = false;
    }
  }

  function syncInputFromState() {
    if (mode === "isearch") {
      inputEl.value = isearchIdx >= 0 ? history[isearchIdx] : "";
    } else {
      inputEl.value = line;
      try {
        inputEl.setSelectionRange(cursor, cursor);
      } catch {
        /* ignore */
      }
    }
    updateStatus();
    renderHistPanel();
  }

  function findIsearch(fromIdx, query) {
    if (!query) return -1;
    const q = query.toLowerCase();
    const start = fromIdx < 0 ? history.length - 1 : fromIdx;
    for (let i = start; i >= 0; i--) {
      if (history[i].toLowerCase().includes(q)) return i;
    }
    return -1;
  }

  function enterIsearch() {
    mode = "isearch";
    isearchQuery = "";
    isearchIdx = history.length ? history.length - 1 : -1;
    histBrowse = null;
    syncInputFromState();
  }

  function leaveIsearch(accept) {
    if (accept && isearchIdx >= 0) {
      line = history[isearchIdx];
      cursor = line.length;
    }
    mode = "normal";
    isearchQuery = "";
    isearchIdx = -1;
    syncInputFromState();
  }

  function fakeRun(cmd) {
    const t = cmd.trim();
    if (!t) {
      lastExit = 0;
      return;
    }
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "Lab commands: history [N] | history -c | clear | echo … | help\n" +
          "Keys: ↑↓ Ctrl+R Ctrl+A/E/U/K/W  Expansions: !! !n !$ !prefix"
      );
      lastExit = 0;
      return;
    }
    if (t === "clear") {
      screen = [];
      lastExit = 0;
      return;
    }
    if (t === "history -c") {
      history = [];
      pushScreen("muted", "(history cleared)");
      lastExit = 0;
      return;
    }
    if (t === "history" || /^history\s+\d+$/.test(t)) {
      const n = t === "history" ? history.length : Number(t.split(/\s+/)[1]);
      const start = Math.max(0, history.length - n);
      for (let i = start; i < history.length; i++) {
        pushScreen("out", `  ${String(i + 1).padStart(4)}  ${history[i]}`);
      }
      lastExit = 0;
      return;
    }
    if (t.startsWith("echo ")) {
      pushScreen("out", t.slice(5));
      lastExit = 0;
      return;
    }
    if (t === "echo") {
      pushScreen("out", "");
      lastExit = 0;
      return;
    }
    if (t === "pwd") {
      pushScreen("out", "/home/lab/projects/uart_tx");
      lastExit = 0;
      return;
    }
    if (t.startsWith("ls")) {
      pushScreen("out", "Makefile  src/  tb/  logs/");
      lastExit = 0;
      return;
    }
    if (t.startsWith("make")) {
      pushScreen("out", t.includes("clean") ? "rm -f sim.vvp *.o" : "PASS  smoke tests (lab)");
      lastExit = 0;
      return;
    }
    if (t.startsWith("git ")) {
      pushScreen("out", "(lab) git: ok");
      lastExit = 0;
      return;
    }
    pushScreen("out", `(lab) ran: ${t}`);
    lastExit = 0;
  }

  function submitLine() {
    let raw = mode === "isearch" ? (isearchIdx >= 0 ? history[isearchIdx] : "") : line;
    if (mode === "isearch") leaveIsearch(true);
    raw = raw.trimEnd();
    const trimmed = raw.trim();
    const expanded = expandHistory(trimmed);
    lastRaw = trimmed;
    lastExpanded = expanded !== trimmed ? expanded : "";
    if (expanded.trim()) {
      history.push(expanded.trim());
    }
    fakeRun(expanded);
    line = "";
    cursor = 0;
    histBrowse = null;
    renderScreen();
    syncInputFromState();
    saveSession();
  }

  function loadStarter() {
    history = STARTER_HISTORY.slice();
    screen = [
      { kind: "muted", text: "Starter session loaded — try Ctrl+R then type make" },
    ];
    line = "";
    cursor = 0;
    histBrowse = null;
    mode = "normal";
    isearchQuery = "";
    isearchIdx = -1;
    lastExpanded = "";
    lastExit = 0;
    renderScreen();
    syncInputFromState();
    saveSession();
    inputEl.focus();
  }

  // ——— Challenges ———
  const CHALLENGES = [
    {
      id: "hist-count",
      title: "History count",
      prompt: "After Load starter, how many history entries? (number)",
      hint: "10 starter commands.",
      type: "text",
      answer: "10",
    },
    {
      id: "hist-last",
      title: "Last entry",
      prompt: "What is the last starter history command? (exact)",
      hint: "vvp sim.vvp",
      type: "text",
      answer: "vvp sim.vvp",
    },
    {
      id: "hist-cmd5",
      title: "Entry #5",
      prompt: "What is history line 5? (exact)",
      hint: "make test",
      type: "text",
      answer: "make test",
    },
    {
      id: "run-history",
      title: "Run history",
      prompt: "Type <code>history</code> and Enter so the terminal lists numbered commands.",
      hint: "Focus the prompt, type history, Enter.",
      type: "state",
      check: () =>
        screen.some((r) => r.kind === "cmd" && r.text === "history") &&
        screen.some((r) => r.kind === "out" && /\bpwd\b/.test(r.text)),
    },
    {
      id: "hist-n",
      title: "history 3",
      prompt: "Run <code>history 3</code> (lists only the last three).",
      hint: "Type history 3 then Enter.",
      type: "state",
      check: () => screen.some((r) => r.kind === "cmd" && r.text === "history 3"),
    },
    {
      id: "arrow-up",
      title: "Arrow recall",
      prompt: "Use ↑ so the prompt shows the previous command, then Check (do not Enter yet).",
      hint: "Press ↑ once from an empty line after starter.",
      type: "state",
      check: () => mode === "normal" && line === history[history.length - 1],
    },
    {
      id: "ctrl-r-make",
      title: "Ctrl+R make",
      prompt: "Enter reverse-search (<kbd>Ctrl+R</kbd>), query <code>make</code>, match <code>make test</code>, then Check (before Enter is fine).",
      hint: "Ctrl+R, type make; if you land on make clean, Ctrl+R again for make test.",
      type: "state",
      check: () =>
        (mode === "isearch" && isearchIdx >= 0 && history[isearchIdx] === "make test") ||
        (mode === "normal" && line === "make test" && history.includes("make test")),
    },
    {
      id: "ctrl-r-git",
      title: "Ctrl+R git",
      prompt: "Reverse-search for <code>git commit</code> (match that full command).",
      hint: "Ctrl+R, type commit (or git commit).",
      type: "state",
      check: () =>
        isearchIdx >= 0 && history[isearchIdx].includes("git commit") ||
        line.includes("git commit"),
    },
    {
      id: "ctrl-a",
      title: "Ctrl+A",
      prompt: "Put <code>make test</code> on the line (↑ or Ctrl+R), move cursor to start with <kbd>Ctrl+A</kbd>, Check.",
      hint: "Recall make test, then Ctrl+A — cursor at 0.",
      type: "state",
      check: () => line.includes("make") && cursor === 0 && mode === "normal",
    },
    {
      id: "ctrl-e",
      title: "Ctrl+E",
      prompt: "With text on the line, press <kbd>Ctrl+E</kbd> so the cursor is at the end.",
      hint: "Ctrl+E sets cursor = line.length.",
      type: "state",
      check: () => mode === "normal" && line.length > 0 && cursor === line.length,
    },
    {
      id: "ctrl-u",
      title: "Ctrl+U",
      prompt: "Type some text, move cursor mid-line, press <kbd>Ctrl+U</kbd> to clear left of cursor.",
      hint: "Ctrl+U kills from cursor back to start.",
      type: "state",
      check: () => mode === "normal" && cursor === 0,
    },
    {
      id: "bang-bang",
      title: "!! expansion",
      prompt: "Run any command, then run <code>!!</code> so it re-runs the previous one.",
      hint: "e.g. echo hi then !!",
      type: "state",
      check: () => lastRaw === "!!" && !!lastExpanded,
    },
    {
      id: "bang-n",
      title: "!n expansion",
      prompt: "Re-run starter entry #1 with <code>!1</code> (should expand to <code>pwd</code>).",
      hint: "Load starter if needed, then !1",
      type: "state",
      check: () => lastRaw === "!1" && lastExpanded === "pwd",
    },
    {
      id: "bang-dollar",
      title: "!$ expansion",
      prompt: "After <code>echo uart_tx.v</code>, run <code>echo !$</code>.",
      hint: "echo uart_tx.v then echo !$",
      type: "state",
      check: () => lastRaw === "echo !$" && lastExpanded === "echo uart_tx.v",
    },
    {
      id: "bang-prefix",
      title: "!prefix",
      prompt: "Use <code>!make</code> to re-run the most recent command starting with make.",
      hint: "Starter has make clean then make test — !make → make test.",
      type: "state",
      check: () => lastRaw === "!make" && lastExpanded.startsWith("make"),
    },
    {
      id: "hist-clear",
      title: "history -c",
      prompt: "Clear session history with <code>history -c</code> (panel should show 0).",
      hint: "Type history -c and Enter.",
      type: "state",
      check: () => history.length === 0,
    },
    {
      id: "quiz-ctrl-r",
      title: "Quiz: Ctrl+R",
      prompt: "What does Ctrl+R start? Answer: <code>reverse-search</code> or <code>isearch</code>",
      hint: "reverse incremental search through history",
      type: "text",
      answer: "reverse-search",
      alt: ["isearch", "reverse search", "reverse-i-search", "reverse isearch"],
    },
    {
      id: "quiz-ctrl-a",
      title: "Quiz: Ctrl+A",
      prompt: "Ctrl+A moves the cursor where? Answer: <code>start</code> or <code>beginning</code>",
      hint: "beginning of the line",
      type: "text",
      answer: "start",
      alt: ["beginning", "begin", "home", "start of line", "beginning of line"],
    },
    {
      id: "quiz-ctrl-e",
      title: "Quiz: Ctrl+E",
      prompt: "Ctrl+E moves the cursor where? Answer: <code>end</code>",
      hint: "end of the line",
      type: "text",
      answer: "end",
      alt: ["end of line", "eol"],
    },
    {
      id: "quiz-bang-bang",
      title: "Quiz: !!",
      prompt: "What does <code>!!</code> mean? Answer: <code>previous</code> or <code>last command</code>",
      hint: "re-run the previous command",
      type: "text",
      answer: "previous",
      alt: ["last", "last command", "previous command", "prev"],
    },
    {
      id: "quiz-bang-dollar",
      title: "Quiz: !$",
      prompt: "What does <code>!$</code> expand to? Answer: <code>last arg</code> or <code>last argument</code>",
      hint: "last argument of the previous command",
      type: "text",
      answer: "last arg",
      alt: ["last argument", "last-arg", "previous last arg", "$"],
    },
    {
      id: "echo-hi",
      title: "echo + history",
      prompt: "Run <code>echo hello-history</code> so it appears in the history list.",
      hint: "Type echo hello-history and Enter.",
      type: "state",
      check: () => history.includes("echo hello-history"),
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the terminal, then Check.</span>`;
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

  // ——— Input handling ———
  inputEl.addEventListener("keydown", (e) => {
    if (mode === "isearch") {
      if (e.key === "Escape" || (e.ctrlKey && e.key.toLowerCase() === "g")) {
        e.preventDefault();
        leaveIsearch(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submitLine();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        isearchIdx = findIsearch(isearchIdx - 1, isearchQuery);
        syncInputFromState();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        isearchQuery = isearchQuery.slice(0, -1);
        isearchIdx = findIsearch(history.length - 1, isearchQuery);
        syncInputFromState();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        isearchQuery += e.key;
        isearchIdx = findIsearch(history.length - 1, isearchQuery);
        syncInputFromState();
        return;
      }
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      enterIsearch();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      line = inputEl.value;
      cursor = line.length;
      submitLine();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      if (histBrowse === null) histBrowse = history.length;
      histBrowse = Math.max(0, histBrowse - 1);
      line = history[histBrowse];
      cursor = line.length;
      syncInputFromState();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histBrowse === null) return;
      histBrowse += 1;
      if (histBrowse >= history.length) {
        histBrowse = null;
        line = "";
        cursor = 0;
      } else {
        line = history[histBrowse];
        cursor = line.length;
      }
      syncInputFromState();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      cursor = 0;
      line = inputEl.value;
      syncInputFromState();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      line = inputEl.value;
      cursor = line.length;
      syncInputFromState();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "u") {
      e.preventDefault();
      line = inputEl.value;
      cursor = inputEl.selectionStart ?? cursor;
      line = line.slice(cursor);
      cursor = 0;
      syncInputFromState();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      line = inputEl.value;
      cursor = inputEl.selectionStart ?? cursor;
      line = line.slice(0, cursor);
      syncInputFromState();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      line = inputEl.value;
      cursor = inputEl.selectionStart ?? cursor;
      const left = line.slice(0, cursor).replace(/\s+$/, "").replace(/\S+$/, "");
      line = left + line.slice(cursor);
      cursor = left.length;
      syncInputFromState();
      return;
    }
  });

  inputEl.addEventListener("input", () => {
    if (mode === "isearch") return;
    line = inputEl.value;
    cursor = inputEl.selectionStart ?? line.length;
    histBrowse = null;
    updateStatus();
  });

  inputEl.addEventListener("click", () => {
    if (mode === "normal") cursor = inputEl.selectionStart ?? cursor;
  });

  // Prefer capturing Ctrl+R on the terminal so the browser does not reload the page
  document.getElementById("term").addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        e.stopPropagation();
        if (mode === "isearch") {
          isearchIdx = findIsearch(isearchIdx - 1, isearchQuery);
          syncInputFromState();
        } else {
          enterIsearch();
        }
        inputEl.focus();
      }
    },
    true
  );

  document.getElementById("sh-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-isearch").addEventListener("click", () => {
    enterIsearch();
    inputEl.focus();
  });
  document.getElementById("btn-clear-screen").addEventListener("click", () => {
    screen = [];
    renderScreen();
    saveSession();
  });
  document.getElementById("btn-hist-refresh").addEventListener("click", renderHistPanel);
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
  else {
    renderScreen();
    syncInputFromState();
  }
  renderChallenge();
  inputEl.focus();
})();
