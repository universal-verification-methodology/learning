(() => {
  const HOME = "/home/lab";
  const USER = "lab";
  const VARS = { HOME, USER, PWD: `${HOME}/chip` };

  const CLEARED_KEY = "ddv-here-doc-lab-cleared-v1";
  const STORE_KEY = "ddv-here-doc-lab-session-v1";

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

  /** @type {'heredoc'|'herestring'} */
  let mode = "heredoc";
  let command = "cat";
  let grepPattern = "two";
  let delimiter = "EOF";
  let quotedDelim = false;
  let body = "line one\nline two\nline three";
  let hereString = "alice";
  let lastStdout = "";
  let lastStdin = "";
  let lastScript = "";
  let lastExpanded = false;
  let lastMode = "heredoc";
  let lastOk = true;
  let lastErr = "";

  const root = document.getElementById("hd-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>cat &lt;&lt;EOF</code> with three lines —
        the body is stdin, not a file. Toggle <code>&lt;&lt;'EOF'</code> to freeze
        <code>$HOME</code>, or switch to <code>read name &lt;&lt;&lt; "alice"</code>.</p>
      <button type="button" class="btn btn-secondary" id="hd-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Build input</h2></div>
        <div class="panel-body">
          <div class="mode-tabs" id="mode-tabs"></div>
          <p class="var-strip">Lab env: <code>HOME=${HOME}</code> · <code>USER=${USER}</code> · <code>PWD=${VARS.PWD}</code></p>
          <div class="form-grid" id="form-grid"></div>
          <div class="tool-actions" style="margin-top:0.75rem">
            <button type="button" class="btn btn-primary" id="btn-run">Run</button>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Script · stdin · stdout</h2></div>
        <div class="panel-body">
          <p class="pane-label">What the shell sees</p>
          <pre class="script-view" id="script-view"></pre>
          <div class="compare-grid">
            <div>
              <p class="pane-label">stdin (after expansion rules)</p>
              <pre class="stdin-view" id="stdin-view"></pre>
            </div>
            <div>
              <p class="pane-label">stdout</p>
              <pre class="stdout-view" id="stdout-view"></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Expansion contrast</h2></div>
      <div class="panel-body">
        <div class="compare-grid">
          <div class="expand-card">
            <h3>&lt;&lt;EOF</h3>
            <p><code>$HOME</code>, <code>$USER</code> expand before the command reads stdin.</p>
          </div>
          <div class="expand-card">
            <h3>&lt;&lt;'EOF'</h3>
            <p>Quoted delimiter — body is literal; <code>$HOME</code> stays as text.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Form</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>cmd &lt;&lt;EOF</code> … <code>EOF</code></td><td>Here-doc: multi-line stdin</td></tr>
            <tr><td><code>cmd &lt;&lt;'EOF'</code></td><td>No parameter expansion in body</td></tr>
            <tr><td><code>cmd &lt;&lt;&lt; "text"</code></td><td>Here-string: one string as stdin</td></tr>
            <tr><td><code>read name &lt;&lt;&lt; "alice"</code></td><td>Assign without a pipe subshell pitfall</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Closing delimiter must match and usually sit alone on its line.</li>
          <li>Prefer here-string (or <code>read &lt; file</code>) over <code>echo | read</code> when you need the variable in the current shell.</li>
        </ul>
      </div>
    </div>
  `;

  const formGrid = document.getElementById("form-grid");
  const scriptView = document.getElementById("script-view");
  const stdinView = document.getElementById("stdin-view");
  const stdoutView = document.getElementById("stdout-view");
  const modeTabs = document.getElementById("mode-tabs");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function expandVars(text) {
    return text.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(VARS, name) ? VARS[name] : "$" + name
    );
  }

  function delimToken() {
    return quotedDelim ? `'${delimiter}'` : delimiter;
  }

  function buildScript() {
    if (mode === "herestring") {
      if (command === "read") {
        return `read name <<< "${hereString.replace(/"/g, '\\"')}"\necho "$name"`;
      }
      return `${command} <<< "${hereString.replace(/"/g, '\\"')}"`;
    }
    const cmdLine =
      command === "grep"
        ? `grep "${grepPattern.replace(/"/g, '\\"')}" <<${delimToken()}`
        : command === "wc"
          ? `wc -l <<${delimToken()}`
          : `${command} <<${delimToken()}`;
    return `${cmdLine}\n${body}\n${delimiter}`;
  }

  function buildStdin() {
    if (mode === "herestring") {
      return hereString + (hereString.endsWith("\n") ? "" : "\n");
    }
    const raw = body.endsWith("\n") ? body : body + "\n";
    lastExpanded = !quotedDelim;
    return quotedDelim ? raw : expandVars(raw);
  }

  function runCommand(stdinText) {
    const lines = stdinText.replace(/\r\n/g, "\n").split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();

    if (mode === "herestring" && command === "read") {
      const name = (hereString.split(/\s/)[0] || "").trim();
      return { ok: true, out: name + "\n", err: "" };
    }

    if (command === "cat") {
      return { ok: true, out: lines.join("\n") + (lines.length ? "\n" : ""), err: "" };
    }
    if (command === "grep") {
      const hits = lines.filter((l) => l.includes(grepPattern));
      return { ok: true, out: hits.length ? hits.join("\n") + "\n" : "", err: "" };
    }
    if (command === "wc") {
      return { ok: true, out: String(lines.length) + "\n", err: "" };
    }
    if (command === "read") {
      // heredoc read first word of first line
      const name = (lines[0] || "").split(/\s/)[0] || "";
      return { ok: true, out: name + "\n", err: "" };
    }
    return { ok: false, out: "", err: "lab: unsupported command" };
  }

  function renderForm() {
    if (mode === "heredoc") {
      formGrid.innerHTML = `
        <label>Command
          <select id="f-cmd">
            <option value="cat">cat</option>
            <option value="grep">grep</option>
            <option value="wc">wc -l</option>
            <option value="read">read name</option>
          </select>
        </label>
        <label id="grep-row">grep pattern
          <input id="f-grep" value="${escapeHtml(grepPattern)}" spellcheck="false" />
        </label>
        <label>Delimiter word
          <input id="f-delim" value="${escapeHtml(delimiter)}" spellcheck="false" />
        </label>
        <label style="flex-direction:row;align-items:center;gap:0.5rem">
          <input type="checkbox" id="f-quoted" ${quotedDelim ? "checked" : ""} />
          Quote delimiter (<code>&lt;&lt;'${escapeHtml(delimiter)}'</code> — no expansion)
        </label>
        <label>Body (between delimiters)
          <textarea id="f-body" spellcheck="false">${escapeHtml(body)}</textarea>
        </label>
      `;
      document.getElementById("f-cmd").value = command === "wc" ? "wc" : command;
      const grepRow = document.getElementById("grep-row");
      grepRow.style.display = command === "grep" ? "" : "none";
      document.getElementById("f-cmd").addEventListener("change", (e) => {
        command = e.target.value;
        renderForm();
        preview();
      });
      document.getElementById("f-grep").addEventListener("input", (e) => {
        grepPattern = e.target.value;
        preview();
      });
      document.getElementById("f-delim").addEventListener("input", (e) => {
        delimiter = e.target.value.trim() || "EOF";
        preview();
      });
      document.getElementById("f-quoted").addEventListener("change", (e) => {
        quotedDelim = e.target.checked;
        preview();
      });
      document.getElementById("f-body").addEventListener("input", (e) => {
        body = e.target.value;
        preview();
      });
    } else {
      formGrid.innerHTML = `
        <label>Command
          <select id="f-cmd">
            <option value="cat">cat</option>
            <option value="wc">wc -l</option>
            <option value="read">read name</option>
            <option value="grep">grep (pattern below)</option>
          </select>
        </label>
        <label id="grep-row">grep pattern
          <input id="f-grep" value="${escapeHtml(grepPattern)}" spellcheck="false" />
        </label>
        <label>Here-string text
          <input id="f-hs" value="${escapeHtml(hereString)}" spellcheck="false" />
        </label>
      `;
      document.getElementById("f-cmd").value = command;
      document.getElementById("grep-row").style.display = command === "grep" ? "" : "none";
      document.getElementById("f-cmd").addEventListener("change", (e) => {
        command = e.target.value;
        renderForm();
        preview();
      });
      document.getElementById("f-grep").addEventListener("input", (e) => {
        grepPattern = e.target.value;
        preview();
      });
      document.getElementById("f-hs").addEventListener("input", (e) => {
        hereString = e.target.value;
        preview();
      });
    }
  }

  function renderModes() {
    modeTabs.innerHTML = "";
    [
      { id: "heredoc", label: "<< here-doc" },
      { id: "herestring", label: "<<< here-string" },
    ].forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = m.label;
      if (mode === m.id) b.classList.add("is-active");
      b.addEventListener("click", () => {
        mode = m.id;
        if (mode === "herestring" && command === "grep") command = "cat";
        renderModes();
        renderForm();
        preview();
      });
      modeTabs.appendChild(b);
    });
  }

  function preview() {
    const script = buildScript();
    const stdin = buildStdin();
    scriptView.textContent = script;
    stdinView.textContent = stdin || "(empty)";
  }

  function runNow() {
    const script = buildScript();
    const stdin = buildStdin();
    const result = runCommand(stdin);
    lastScript = script;
    lastStdin = stdin;
    lastMode = mode;
    lastOk = result.ok;
    lastErr = result.err || "";
    lastStdout = result.ok ? result.out : result.err;
    lastExpanded = mode === "heredoc" && !quotedDelim;

    scriptView.textContent = script;
    stdinView.textContent = stdin || "(empty)";
    stdoutView.textContent = lastStdout || "(no output)";
    stdoutView.classList.toggle("is-err", !result.ok);
    saveSession();
  }

  function loadStarter() {
    mode = "heredoc";
    command = "cat";
    grepPattern = "two";
    delimiter = "EOF";
    quotedDelim = false;
    body = "line one\nline two\nline three";
    hereString = "alice";
    renderModes();
    renderForm();
    runNow();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          mode,
          command,
          grepPattern,
          delimiter,
          quotedDelim,
          body,
          hereString,
          lastStdout,
          lastStdin,
          lastScript,
          lastMode,
          lastExpanded,
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
      mode = data.mode === "herestring" ? "herestring" : "heredoc";
      command = data.command || "cat";
      grepPattern = data.grepPattern || "two";
      delimiter = data.delimiter || "EOF";
      quotedDelim = !!data.quotedDelim;
      body = data.body || "";
      hereString = data.hereString || "";
      lastStdout = data.lastStdout || "";
      lastStdin = data.lastStdin || "";
      lastScript = data.lastScript || "";
      lastMode = data.lastMode || mode;
      lastExpanded = !!data.lastExpanded;
      return true;
    } catch {
      return false;
    }
  }

  const PRESETS = [
    {
      label: "cat <<EOF",
      apply: () => {
        mode = "heredoc";
        command = "cat";
        quotedDelim = false;
        delimiter = "EOF";
        body = "line one\nline two\nline three";
      },
    },
    {
      label: "grep two",
      apply: () => {
        mode = "heredoc";
        command = "grep";
        grepPattern = "two";
        quotedDelim = false;
        body = "one\ntwo\nthree";
      },
    },
    {
      label: "expand $HOME",
      apply: () => {
        mode = "heredoc";
        command = "cat";
        quotedDelim = false;
        body = "home=$HOME\nuser=$USER";
      },
    },
    {
      label: "quoted 'EOF'",
      apply: () => {
        mode = "heredoc";
        command = "cat";
        quotedDelim = true;
        body = "home=$HOME\nuser=$USER";
      },
    },
    {
      label: "wc -l <<EOF",
      apply: () => {
        mode = "heredoc";
        command = "wc";
        body = "a\nb\nc\nd";
      },
    },
    {
      label: '<<< "alice"',
      apply: () => {
        mode = "herestring";
        command = "read";
        hereString = "alice";
      },
    },
    {
      label: "cat <<< hi",
      apply: () => {
        mode = "herestring";
        command = "cat";
        hereString = "hello chip";
      },
    },
    {
      label: "END delim",
      apply: () => {
        mode = "heredoc";
        command = "cat";
        delimiter = "END";
        quotedDelim = false;
        body = "custom delimiter works too";
      },
    },
  ];
  const quickRow = document.getElementById("quick-row");
  PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label;
    b.addEventListener("click", () => {
      p.apply();
      renderModes();
      renderForm();
      runNow();
    });
    quickRow.appendChild(b);
  });

  const CHALLENGES = [
    {
      id: "quiz-heredoc",
      title: "Quiz: here-doc",
      prompt: "<code>&lt;&lt;EOF</code> feeds data to the command’s? Answer: <code>stdin</code>",
      hint: "standard input",
      type: "text",
      answer: "stdin",
      alt: ["standard input", "std in"],
    },
    {
      id: "run-cat",
      title: "Run cat",
      prompt: "Run starter <code>cat &lt;&lt;EOF</code> with three lines — stdout should include <code>line two</code>.",
      hint: "Load starter / Run",
      type: "state",
      setup: () => loadStarter(),
      check: () => lastMode === "heredoc" && command === "cat" && lastStdout.includes("line two"),
    },
    {
      id: "quiz-delim",
      title: "Quiz: delimiter",
      prompt: "The closing word must match the? Answer: <code>opener</code> or <code>delimiter</code>",
      hint: "same delimiter word",
      type: "text",
      answer: "delimiter",
      alt: ["opener", "opening delimiter", "eof word"],
    },
    {
      id: "grep-two",
      title: "grep two",
      prompt: "Use grep pattern <code>two</code> on a here-doc body containing one/two/three — stdout is <code>two</code>.",
      hint: "Preset: grep two",
      type: "state",
      check: () =>
        lastMode === "heredoc" &&
        command === "grep" &&
        grepPattern === "two" &&
        lastStdout.trim() === "two",
    },
    {
      id: "wc-lines",
      title: "wc lines",
      prompt: "Here-doc with 4 lines into <code>wc -l</code> — stdout number?",
      hint: "Preset wc -l or body with 4 lines",
      type: "state",
      check: () => lastMode === "heredoc" && command === "wc" && lastStdout.trim() === "4",
    },
    {
      id: "quiz-expand",
      title: "Quiz: expand",
      prompt: "Unquoted <code>&lt;&lt;EOF</code> will? Answer: <code>expand</code> variables",
      hint: "$HOME becomes a path",
      type: "text",
      answer: "expand",
      alt: ["expand variables", "expansion", "substitute"],
    },
    {
      id: "expand-home",
      title: "Expand HOME",
      prompt: "Unquoted here-doc body <code>home=$HOME</code> — stdin/stdout should contain <code>/home/lab</code>.",
      hint: "Preset: expand $HOME",
      type: "state",
      check: () =>
        lastMode === "heredoc" &&
        !quotedDelim &&
        lastStdout.includes(HOME) &&
        lastExpanded,
    },
    {
      id: "quoted-literal",
      title: "Quoted literal",
      prompt: "With <code>&lt;&lt;'EOF'</code>, body <code>home=$HOME</code> should stay literal (<code>$HOME</code> visible).",
      hint: "Preset: quoted 'EOF'",
      type: "state",
      check: () =>
        lastMode === "heredoc" &&
        quotedDelim &&
        lastStdout.includes("$HOME") &&
        !lastStdout.includes(HOME),
    },
    {
      id: "quiz-quoted",
      title: "Quiz: 'EOF'",
      prompt: "Quoted delimiter means? Answer: <code>literal</code> or <code>no expand</code>",
      hint: "no parameter expansion",
      type: "text",
      answer: "literal",
      alt: ["no expand", "no expansion", "literal text", "freeze"],
    },
    {
      id: "custom-delim",
      title: "Custom END",
      prompt: "Use delimiter <code>END</code> (not EOF) and run cat.",
      hint: "Preset: END delim",
      type: "state",
      check: () =>
        lastMode === "heredoc" &&
        delimiter === "END" &&
        lastScript.includes("<<END") &&
        lastOk,
    },
    {
      id: "quiz-herestring",
      title: "Quiz: <<<",
      prompt: "<code>&lt;&lt;&lt;</code> is a? Answer: <code>here-string</code>",
      hint: "here-string — one string as stdin",
      type: "text",
      answer: "here-string",
      alt: ["herestring", "here string"],
    },
    {
      id: "read-alice",
      title: "read <<<",
      prompt: "Run <code>read name &lt;&lt;&lt; \"alice\"</code> — stdout should be <code>alice</code>.",
      hint: "Preset: <<< alice",
      type: "state",
      check: () =>
        lastMode === "herestring" &&
        command === "read" &&
        lastStdout.trim() === "alice",
    },
    {
      id: "cat-hs",
      title: "cat <<<",
      prompt: "Here-string <code>hello chip</code> into cat.",
      hint: "Preset: cat <<< hi",
      type: "state",
      check: () =>
        lastMode === "herestring" &&
        command === "cat" &&
        lastStdout.includes("hello chip"),
    },
    {
      id: "quiz-vs-file",
      title: "Quiz: why",
      prompt: "Here-docs avoid creating a temporary? Answer: <code>file</code>",
      hint: "no temp file needed",
      type: "text",
      answer: "file",
      alt: ["temp file", "temporary file"],
    },
    {
      id: "quiz-pipe-read",
      title: "Quiz: pipe read",
      prompt: "<code>echo x | read n</code> often fails to keep <code>n</code> because of a? Answer: <code>subshell</code>",
      hint: "pipeline subshell",
      type: "text",
      answer: "subshell",
      alt: ["sub shell", "pipeline subshell"],
    },
    {
      id: "stdin-three",
      title: "Three lines",
      prompt: "Starter body has how many lines? (number)",
      hint: "3",
      type: "text",
      answer: "3",
      setup: () => loadStarter(),
    },
    {
      id: "script-has-eof",
      title: "Script shape",
      prompt: "Run a here-doc so the script view contains both opening <code>&lt;&lt;</code> and a closing delimiter line.",
      hint: "Any cat <<EOF run",
      type: "state",
      check: () =>
        lastMode === "heredoc" &&
        lastScript.includes("<<") &&
        lastScript.trim().split("\n").pop() === delimiter,
    },
    {
      id: "home-value",
      title: "HOME value",
      prompt: "Lab <code>$HOME</code> expands to? (exact path)",
      hint: "/home/lab",
      type: "text",
      answer: "/home/lab",
    },
    {
      id: "wc-hs",
      title: "wc here-string",
      prompt: "Here-string mode + <code>wc -l</code> on text without newlines → count <code>1</code>.",
      hint: "Switch to <<<, command wc, any non-empty string, Run",
      type: "state",
      check: () =>
        lastMode === "herestring" &&
        command === "wc" &&
        lastStdout.trim() === "1",
    },
    {
      id: "quiz-closing",
      title: "Quiz: closing",
      prompt: "Closing <code>EOF</code> should usually be alone on its? Answer: <code>line</code>",
      hint: "own line",
      type: "text",
      answer: "line",
      alt: ["own line", "a line"],
    },
    {
      id: "grep-error",
      title: "grep ERROR",
      prompt: "Here-doc body with an ERROR line; grep pattern <code>ERROR</code>; stdout contains ERROR.",
      hint: "Set grep + body including ERROR",
      type: "state",
      check: () =>
        lastMode === "heredoc" &&
        command === "grep" &&
        grepPattern === "ERROR" &&
        /ERROR/.test(lastStdout),
    },
    {
      id: "quiz-both",
      title: "Quiz: both",
      prompt: "Multi-line stdin → here-doc; single string →? Answer: <code>here-string</code>",
      hint: "<<<",
      type: "text",
      answer: "here-string",
      alt: ["herestring", "<<<", "here string"],
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Configure and Run, then Check.</span>`;
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

  document.getElementById("hd-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-run").addEventListener("click", runNow);
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
    if (typeof ch.setup === "function" && ch.type === "state") ch.setup();
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else {
    renderModes();
    renderForm();
    scriptView.textContent = lastScript || buildScript();
    stdinView.textContent = lastStdin || buildStdin() || "(empty)";
    stdoutView.textContent = lastStdout || "(run to see output)";
  }
  renderChallenge();
})();
