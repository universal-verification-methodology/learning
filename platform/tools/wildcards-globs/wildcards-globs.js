(() => {
  /** Flat directory — same spirit as learn_unix_git module1/examples/wildcards */
  const FILES = [
    "a.txt",
    "b.txt",
    "c.txt",
    "report_2023.txt",
    "report_2024.txt",
    "data_1.log",
    "data_2.log",
    "data_10.log",
    "design.v",
    "uart_tx.sv",
    "tb_top.sv",
    "Makefile",
    ".gitignore",
  ];

  const STARTER_PATTERN = "*.txt";
  const CLEARED_KEY = "ddv-wildcards-globs-cleared-v1";
  const STORE_KEY = "ddv-wildcards-globs-session-v1";

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
  let lastMatches = [];
  let lastPattern = STARTER_PATTERN;
  let lastLiteralFallback = false;

  const root = document.getElementById("glob-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Pattern <code>*.txt</code> expands to all
        <code>.txt</code> names. Try <code>data_?.log</code> (two files) vs <code>data_*.log</code>
        (three), and notice <code>.gitignore</code> is <em>not</em> matched by <code>*</code>.</p>
      <button type="button" class="btn btn-secondary" id="glob-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Pattern → expansion</h2></div>
        <div class="panel-body">
          <div class="pattern-row">
            <label>Glob pattern
              <input id="pattern-in" value="${STARTER_PATTERN}" spellcheck="false" autocomplete="off" />
            </label>
            <button type="button" class="btn btn-primary" id="btn-expand">Expand</button>
          </div>
          <div class="expand-box" id="expand-box" aria-live="polite"></div>
          <p class="match-meta" id="match-meta"></p>
          <div class="preset-row" id="presets"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Directory listing</h2>
          <span style="font-size:0.8rem;color:var(--muted)">highlight = match</span>
        </div>
        <div class="panel-body">
          <ul class="file-grid" id="file-grid"></ul>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Token</th><th>Matches</th></tr></thead>
          <tbody>
            <tr><td><code>*</code></td><td>Any sequence (including empty). Does <strong>not</strong> match a leading <code>.</code> in this lab (bash-like).</td></tr>
            <tr><td><code>?</code></td><td>Exactly <strong>one</strong> character.</td></tr>
            <tr><td><code>[abc]</code></td><td>One character from the set.</td></tr>
            <tr><td><code>[a-c]</code></td><td>One character in the inclusive range.</td></tr>
            <tr><td><code>[!0-9]</code> / <code>[^0-9]</code></td><td>One character <em>not</em> in the set/range (lab supports both).</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.85rem">
          <li>The shell expands globs <strong>before</strong> the command runs — <code>rm *.log</code> becomes a list of names.</li>
          <li>If nothing matches, bash often leaves the pattern <strong>literal</strong> (this lab shows that warning).</li>
          <li>Always <code>ls</code> a destructive pattern first.</li>
        </ul>
      </div>
    </div>
  `;

  const patternIn = document.getElementById("pattern-in");
  const expandBox = document.getElementById("expand-box");
  const matchMeta = document.getElementById("match-meta");
  const fileGrid = document.getElementById("file-grid");

  /**
   * Convert a single glob pattern to a RegExp (bash-like, basename only).
   * @param {string} pattern
   * @param {{dotglob?: boolean}} opts
   */
  function globToRegExp(pattern, opts = {}) {
    let i = 0;
    let out = "^";
    const dotglob = !!opts.dotglob;
    while (i < pattern.length) {
      const c = pattern[i];
      if (c === "*") {
        out += ".*";
        i++;
      } else if (c === "?") {
        out += ".";
        i++;
      } else if (c === "[") {
        const close = pattern.indexOf("]", i + 1);
        if (close < 0) {
          out += "\\[";
          i++;
          continue;
        }
        let inner = pattern.slice(i + 1, close);
        let neg = false;
        if (inner.startsWith("!") || inner.startsWith("^")) {
          neg = true;
          inner = inner.slice(1);
        }
        // Escape regex specials inside class except hyphen for ranges
        let body = "";
        for (let k = 0; k < inner.length; k++) {
          const ch = inner[k];
          if (ch === "\\" || ch === "]" || ch === "^") body += "\\" + ch;
          else body += ch;
        }
        out += "[" + (neg ? "^" : "") + body + "]";
        i = close + 1;
      } else {
        out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        i++;
      }
    }
    out += "$";
    const re = new RegExp(out);
    return {
      test(name) {
        if (!dotglob && name.startsWith(".") && !pattern.startsWith(".")) {
          // bash: * and ? do not match leading dot unless pattern starts with .
          if (/[*?]/.test(pattern) || /\[[^\]]*\]/.test(pattern)) {
            // still allow explicit .gitignore patterns
            if (!pattern.startsWith(".")) return false;
          }
        }
        return re.test(name);
      },
    };
  }

  function expandGlob(pattern) {
    const p = String(pattern).trim();
    if (!p) return { matches: [], literal: false, pattern: p };
    // No metacharacters → exact name if present, else literal
    if (!/[*?\[]/.test(p)) {
      const hit = FILES.includes(p);
      return { matches: hit ? [p] : [], literal: !hit, pattern: p, exact: true };
    }
    let matcher;
    try {
      matcher = globToRegExp(p);
    } catch {
      return { matches: [], literal: true, pattern: p, error: true };
    }
    const matches = FILES.filter((f) => matcher.test(f)).sort();
    return { matches, literal: matches.length === 0, pattern: p };
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((x, i) => x === sb[i]);
  }

  function renderFiles(matches) {
    const set = new Set(matches);
    fileGrid.innerHTML = FILES.map((f) => {
      const cls = [
        set.has(f) ? "is-match" : "",
        f.startsWith(".") ? "is-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<li class="${cls}">${escapeHtml(f)}</li>`;
    }).join("");
  }

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function doExpand() {
    const pattern = patternIn.value;
    const result = expandGlob(pattern);
    lastPattern = result.pattern;
    lastMatches = result.matches;
    lastLiteralFallback = !!result.literal && /[*?\[]/.test(result.pattern);

    let html = "";
    if (result.error) {
      html = `<span class="warn">Invalid pattern</span>`;
    } else if (!result.pattern) {
      html = `<span class="muted">(empty pattern)</span>`;
    } else if (result.exact && result.matches.length === 1) {
      html = `<span class="muted">ls</span> <span class="ok">${escapeHtml(result.matches[0])}</span>\n<span class="muted"># exact name (no glob metacharacters)</span>`;
    } else if (result.matches.length) {
      html =
        `<span class="muted">ls</span> ` +
        result.matches.map((m) => `<span class="ok">${escapeHtml(m)}</span>`).join(" ") +
        `\n<span class="muted"># shell expands before ls runs (${result.matches.length} name${result.matches.length === 1 ? "" : "s"})</span>`;
    } else if (lastLiteralFallback) {
      html =
        `<span class="muted">ls</span> <span class="warn">${escapeHtml(result.pattern)}</span>\n` +
        `<span class="warn"># no match — bash often leaves the pattern literal (dangerous for rm!)</span>`;
    } else {
      html = `<span class="muted"># no file named ${escapeHtml(result.pattern)}</span>`;
    }
    expandBox.innerHTML = html;
    matchMeta.textContent = result.matches.length
      ? `${result.matches.length} match${result.matches.length === 1 ? "" : "es"}`
      : lastLiteralFallback
        ? "0 matches → literal fallback"
        : "0 matches";
    renderFiles(result.matches);
    saveSession();
  }

  function loadStarter() {
    patternIn.value = STARTER_PATTERN;
    doExpand();
    patternIn.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ pattern: patternIn.value }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.pattern != null) {
        patternIn.value = String(data.pattern);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  const PRESETS = [
    "*.txt",
    "report_*.txt",
    "data_?.log",
    "data_*.log",
    "[abc].txt",
    "[a-c].txt",
    "*.[sv]*",
    "*.v",
    "*.sv",
    ".*",
    "nomatch*",
    "Makefile",
  ];

  const presetsEl = document.getElementById("presets");
  PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p;
    b.addEventListener("click", () => {
      patternIn.value = p;
      doExpand();
    });
    presetsEl.appendChild(b);
  });

  const CHALLENGES = [
    {
      id: "star-txt",
      title: "*.txt count",
      prompt: "Expand <code>*.txt</code>. How many matches? (number)",
      hint: "a/b/c.txt + two report_*.txt → 5",
      type: "text",
      answer: "5",
      setup: () => {
        patternIn.value = "*.txt";
        doExpand();
      },
    },
    {
      id: "star-txt-state",
      title: "Expand *.txt",
      prompt: "Set pattern to <code>*.txt</code> and Expand so five .txt files highlight.",
      hint: "Starter or preset *.txt",
      type: "state",
      check: () => lastPattern === "*.txt" && lastMatches.length === 5,
    },
    {
      id: "report-star",
      title: "report_*.txt",
      prompt: "Expand <code>report_*.txt</code>. List matches sorted, comma-separated.",
      hint: "report_2023.txt, report_2024.txt",
      type: "text",
      answer: "report_2023.txt, report_2024.txt",
      alt: ["report_2023.txt,report_2024.txt"],
      setup: () => {
        patternIn.value = "report_*.txt";
        doExpand();
      },
    },
    {
      id: "q-data",
      title: "data_?.log",
      prompt: "Expand <code>data_?.log</code>. How many matches?",
      hint: "? is one character — data_1 and data_2, not data_10",
      type: "text",
      answer: "2",
      setup: () => {
        patternIn.value = "data_?.log";
        doExpand();
      },
    },
    {
      id: "star-data",
      title: "data_*.log",
      prompt: "Expand <code>data_*.log</code>. How many matches?",
      hint: "Includes data_10.log → 3",
      type: "text",
      answer: "3",
    },
    {
      id: "q-vs-star",
      title: "Quiz: ? vs *",
      prompt: "Which token matches exactly one character? Answer: <code>?</code>",
      hint: "question mark",
      type: "text",
      answer: "?",
      alt: ["question mark", "question"],
    },
    {
      id: "bracket-set",
      title: "[abc].txt",
      prompt: "Expand <code>[abc].txt</code>. How many matches?",
      hint: "a.txt b.txt c.txt → 3",
      type: "text",
      answer: "3",
      setup: () => {
        patternIn.value = "[abc].txt";
        doExpand();
      },
    },
    {
      id: "bracket-range",
      title: "[a-c].txt",
      prompt: "Expand <code>[a-c].txt</code> — matches should equal <code>[abc].txt</code>.",
      hint: "Same three files.",
      type: "state",
      check: () => {
        const a = expandGlob("[a-c].txt").matches;
        const b = expandGlob("[abc].txt").matches;
        patternIn.value = "[a-c].txt";
        doExpand();
        return sameSet(a, b) && sameSet(lastMatches, a);
      },
    },
    {
      id: "sv-files",
      title: "*.sv",
      prompt: "Expand <code>*.sv</code>. Comma-separated sorted names.",
      hint: "tb_top.sv, uart_tx.sv",
      type: "text",
      answer: "tb_top.sv, uart_tx.sv",
      alt: ["uart_tx.sv, tb_top.sv", "tb_top.sv,uart_tx.sv"],
    },
    {
      id: "v-only",
      title: "*.v",
      prompt: "Expand <code>*.v</code>. What is the only match? (exact)",
      hint: "design.v — not .sv",
      type: "text",
      answer: "design.v",
    },
    {
      id: "hidden-star",
      title: "* skips dotfiles",
      prompt: "Expand <code>*</code>. Does it include <code>.gitignore</code>? Answer: <code>no</code>",
      hint: "bash-like: * does not match leading .",
      type: "text",
      answer: "no",
      alt: ["n", "false", "0"],
      setup: () => {
        patternIn.value = "*";
        doExpand();
      },
    },
    {
      id: "dot-star",
      title: ".* for hidden",
      prompt: "Expand <code>.*</code> so <code>.gitignore</code> matches, then Check.",
      hint: "Preset .*",
      type: "state",
      check: () => lastPattern === ".*" && lastMatches.includes(".gitignore"),
    },
    {
      id: "no-match-literal",
      title: "No match → literal",
      prompt: "Expand <code>nomatch*</code>. Lab should show literal fallback warning.",
      hint: "Preset nomatch*",
      type: "state",
      check: () => lastPattern === "nomatch*" && lastLiteralFallback && lastMatches.length === 0,
    },
    {
      id: "quiz-when-expand",
      title: "Quiz: when expand",
      prompt: "Globs expand ___ the command runs. Answer: <code>before</code>",
      hint: "before",
      type: "text",
      answer: "before",
      alt: ["prior", "ahead of"],
    },
    {
      id: "quiz-star",
      title: "Quiz: *",
      prompt: "What does <code>*</code> match? Answer: <code>any</code> or <code>any sequence</code>",
      hint: "any sequence of characters",
      type: "text",
      answer: "any",
      alt: ["any sequence", "everything", "any characters", "anything"],
    },
    {
      id: "single-q-txt",
      title: "?.txt",
      prompt: "Expand <code>?.txt</code>. How many matches?",
      hint: "a.txt b.txt c.txt → 3",
      type: "text",
      answer: "3",
    },
    {
      id: "makefile-exact",
      title: "Exact Makefile",
      prompt: "Expand pattern <code>Makefile</code> (no wildcards) — one exact hit.",
      hint: "Type Makefile",
      type: "state",
      check: () => lastPattern === "Makefile" && sameSet(lastMatches, ["Makefile"]),
    },
    {
      id: "ext-tv",
      title: "*.[sv]* style",
      prompt: "Expand <code>*.[sv]*</code> (course-style). How many matches? (design.v + two .sv)",
      hint: "Try preset *.[sv]* — matches names with .s or .v in extension area",
      type: "state",
      check: () => {
        patternIn.value = "*.[sv]*";
        doExpand();
        // design.v, uart_tx.sv, tb_top.sv — and maybe others? *.[sv]* means * . [sv] *
        // design.v → . v  with * empty after → match
        // uart_tx.sv → . s v → [sv] matches s, * matches v
        // tb_top.sv same
        // .gitignore no
        return lastMatches.length === 3 && lastMatches.includes("design.v");
      },
    },
    {
      id: "state-q-log",
      title: "Show data_?.log",
      prompt: "Expand <code>data_?.log</code> so only data_1.log and data_2.log highlight.",
      hint: "Preset data_?.log",
      type: "state",
      check: () =>
        lastPattern === "data_?.log" &&
        sameSet(lastMatches, ["data_1.log", "data_2.log"]),
    },
    {
      id: "not-digit",
      title: "[!0-9] demo",
      prompt: "Expand <code>[!0-9].txt</code> — should match a/b/c.txt (not starting with digit).",
      hint: "Type [!0-9].txt",
      type: "state",
      check: () =>
        lastPattern === "[!0-9].txt" &&
        sameSet(lastMatches, ["a.txt", "b.txt", "c.txt"]),
    },
    {
      id: "count-all-visible",
      title: "Count non-hidden",
      prompt: "How many files are listed that do <em>not</em> start with <code>.</code>? (number)",
      hint: "13 total − 1 .gitignore = 12",
      type: "text",
      answer: "12",
    },
    {
      id: "safe-rm",
      title: "Quiz: safe rm",
      prompt: "Before <code>rm *.log</code>, you should first? Answer: <code>ls</code>",
      hint: "ls *.log",
      type: "text",
      answer: "ls",
      alt: ["ls *.log", "list", "expand"],
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+,/g, ",")
      .replace(/,\s+/g, ", ")
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Set the pattern, Expand, then Check.</span>`;
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

  document.getElementById("glob-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-expand").addEventListener("click", doExpand);
  patternIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doExpand();
    }
  });
  patternIn.addEventListener("input", () => {
    // live expand for snappier UX
    doExpand();
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
  else doExpand();
  renderChallenge();
})();
