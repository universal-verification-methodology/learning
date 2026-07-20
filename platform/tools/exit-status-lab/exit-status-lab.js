(() => {
  const FILES = new Set(["Makefile", "rtl/top.v", "notes.txt"]);

  const CLEARED_KEY = "ddv-exit-status-lab-cleared-v1";
  const STORE_KEY = "ddv-exit-status-lab-session-v1";

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
  let lastStatus = 0;
  let lastCmd = "";
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  /** @type {{text:string, ran:boolean, status:number|null}[]} */
  let chainSteps = [];
  let setE = false;

  const root = document.getElementById("ex-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Run <code>true; echo $?</code> (0) then
        <code>false; echo $?</code> (1). Compare <code>true &amp;&amp; echo ok</code> with
        <code>false &amp;&amp; echo ok</code>, and try <code>false || echo fallback</code>.</p>
      <button type="button" class="btn btn-secondary" id="ex-starter">Load starter example</button>
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
          <div class="status-banner">
            <div class="status-pill ok" id="status-pill">$? = 0</div>
            <div class="meta" id="set-e-meta">set -e: off</div>
          </div>
          <div class="ex-term">
            <div class="ex-scroll" id="term-scroll"></div>
            <div class="ex-prompt-row">
              <span class="ex-prompt">lab$</span>
              <input class="ex-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="true · false · echo $? · cmd && cmd · cmd || cmd · help"
                aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Chain evaluation</h2></div>
        <div class="panel-body">
          <p style="margin:0 0 0.55rem;font-size:0.9rem;color:var(--muted)">
            Which segments ran on the last <code>&amp;&amp;</code> / <code>||</code> line:
          </p>
          <ul class="chain-steps" id="chain-steps"></ul>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Short-circuit rules</h2></div>
      <div class="panel-body">
        <div class="truth-cards">
          <div class="truth-card">
            <h3>A &amp;&amp; B</h3>
            <p>Run B only if A succeeds (status 0). If A fails, B is skipped.</p>
          </div>
          <div class="truth-card">
            <h3>A || B</h3>
            <p>Run B only if A fails (non-zero). If A succeeds, B is skipped.</p>
          </div>
        </div>
        <div class="pitfall">
          <strong>Pitfall:</strong> <code>A &amp;&amp; B || C</code> is <em>not</em> a clean if/else.
          If A succeeds and B fails, C still runs. Prefer <code>if</code>/<code>else</code> for real branches.
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Item</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>$?</code></td><td>Exit status of the previous command (0 = success)</td></tr>
            <tr><td><code>true</code> / <code>false</code></td><td>Status 0 / 1</td></tr>
            <tr><td><code>exit N</code></td><td>Set status to N (lab: for the next $?)</td></tr>
            <tr><td><code>test</code> / <code>[</code></td><td>File/string tests → 0 or 1</td></tr>
            <tr><td><code>set -e</code></td><td>Abort the line after a failing simple command (lab demo)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Success is <code>0</code>; any non-zero is failure for <code>&amp;&amp;</code>/<code>||</code>.</li>
          <li>Lab files: <code>Makefile</code>, <code>rtl/top.v</code>, <code>notes.txt</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const statusPill = document.getElementById("status-pill");
  const setEMeta = document.getElementById("set-e-meta");
  const chainEl = document.getElementById("chain-steps");

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

  function renderStatus() {
    statusPill.textContent = `$? = ${lastStatus}`;
    statusPill.className = "status-pill " + (lastStatus === 0 ? "ok" : "fail");
    setEMeta.textContent = `set -e: ${setE ? "on" : "off"}`;
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
                : row.kind === "status"
                  ? "status"
                  : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderChain() {
    if (!chainSteps.length) {
      chainEl.innerHTML = `<li style="color:var(--muted)">Run a line with && or || to see steps.</li>`;
      return;
    }
    chainEl.innerHTML = chainSteps
      .map((s) => {
        const cls = s.ran ? "ran" : "skip";
        const label = s.ran ? "ran" : "skipped";
        const rc = s.status != null ? ` · status ${s.status}` : "";
        return `<li><span class="${cls}">${label}</span><span class="code">${escapeHtml(s.text)}</span><span class="rc">${rc}</span></li>`;
      })
      .join("");
  }

  function renderAll() {
    renderStatus();
    renderScreen();
    renderChain();
  }

  /** Run a simple command (no && || ;). Returns {status, out lines} */
  function runSimple(raw) {
    const t = raw.trim();
    if (!t) return { status: 0, outs: [] };

    if (t === "true") return { status: 0, outs: [] };
    if (t === "false") return { status: 1, outs: [] };

    if (t === "help") {
      return {
        status: 0,
        outs: [
          "true · false · echo … · echo $? · exit N · test / [ · ls FILE · set -e · set +e · cmd && cmd · cmd || cmd",
        ],
      };
    }

    if (t === "set -e") {
      setE = true;
      return { status: 0, outs: ["(set -e on)"] };
    }
    if (t === "set +e") {
      setE = false;
      return { status: 0, outs: ["(set -e off)"] };
    }

    let m;
    if ((m = t.match(/^exit\s+(\d+)$/))) {
      return { status: Number(m[1]) & 255, outs: [] };
    }

    if (t === "echo $?" || t === 'echo "$?"') {
      return { status: 0, outs: [String(lastStatus)] };
    }

    if ((m = t.match(/^echo\s+(.+)$/))) {
      let msg = m[1];
      if (
        (msg.startsWith('"') && msg.endsWith('"')) ||
        (msg.startsWith("'") && msg.endsWith("'"))
      ) {
        msg = msg.slice(1, -1);
      }
      msg = msg.replace(/\$\?/g, String(lastStatus));
      return { status: 0, outs: [msg] };
    }

    // test / [
    if (t.startsWith("test ") || t.startsWith("[ ")) {
      return runTest(t);
    }

    if ((m = t.match(/^ls\s+(\S+)$/))) {
      const f = m[1];
      if (FILES.has(f)) return { status: 0, outs: [f] };
      return { status: 2, outs: [], err: `ls: cannot access '${f}': No such file` };
    }

    if (t === "ls") {
      return { status: 0, outs: [...FILES].sort() };
    }

    return { status: 127, outs: [], err: `lab: ${t.split(/\s+/)[0]}: command not found` };
  }

  function runTest(t) {
    // normalize [ expr ] → test expr
    let expr = t;
    if (expr.startsWith("[ ")) {
      if (!expr.endsWith(" ]") && !expr.endsWith("]")) {
        return { status: 2, outs: [], err: "[: missing `]'" };
      }
      expr = "test " + expr.slice(2).replace(/\s*\]\s*$/, "");
    }
    const body = expr.slice(5).trim();

    let m;
    if ((m = body.match(/^-f\s+(\S+)$/))) {
      return { status: FILES.has(m[1]) ? 0 : 1, outs: [] };
    }
    if ((m = body.match(/^-d\s+(\S+)$/))) {
      // only rtl as dir-ish path prefix — treat rtl as dir via rtl/top.v parent
      return { status: m[1] === "rtl" ? 0 : 1, outs: [] };
    }
    if ((m = body.match(/^(\S+)\s+=\s+(\S+)$/))) {
      const a = stripQ(m[1]);
      const b = stripQ(m[2]);
      return { status: a === b ? 0 : 1, outs: [] };
    }
    if ((m = body.match(/^(\S+)\s+!=\s+(\S+)$/))) {
      const a = stripQ(m[1]);
      const b = stripQ(m[2]);
      return { status: a !== b ? 0 : 1, outs: [] };
    }
    if ((m = body.match(/^-z\s+(\S+)$/))) {
      return { status: stripQ(m[1]) === "" ? 0 : 1, outs: [] };
    }
    if ((m = body.match(/^-n\s+(\S+)$/))) {
      return { status: stripQ(m[1]) !== "" ? 0 : 1, outs: [] };
    }
    return { status: 2, outs: [], err: "test: unsupported expression in lab" };
  }

  function stripQ(s) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }

  /**
   * Split by && and || keeping operators left-associative.
   * "a && b || c" → [a, &&, b, ||, c]
   */
  function tokenizeChain(line) {
    const parts = [];
    let buf = "";
    let i = 0;
    while (i < line.length) {
      if (line.startsWith("&&", i)) {
        parts.push(buf.trim());
        parts.push("&&");
        buf = "";
        i += 2;
        continue;
      }
      if (line.startsWith("||", i)) {
        parts.push(buf.trim());
        parts.push("||");
        buf = "";
        i += 2;
        continue;
      }
      buf += line[i];
      i++;
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts.filter(Boolean);
  }

  function runChain(line) {
    const tokens = tokenizeChain(line);
    if (tokens.length === 1) {
      chainSteps = [];
      return runAndPrint(tokens[0], false);
    }

    /** @type {{text:string, ran:boolean, status:number|null}[]} */
    const steps = [];
    let status = 0;
    let runNext = true;
    let aborted = false;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === "&&" || tok === "||") {
        // decide whether following command runs
        if (tok === "&&") runNext = status === 0;
        else runNext = status !== 0;
        continue;
      }

      if (!runNext || aborted) {
        steps.push({ text: tok, ran: false, status: null });
        // after skip, still need to update runNext for following ops —
        // actually if we skip, status stays from last ran command
        continue;
      }

      const result = runSimple(tok);
      status = result.status;
      steps.push({ text: tok, ran: true, status });
      result.outs.forEach((o) => pushScreen("out", o));
      if (result.err) pushScreen("err", result.err);

      if (setE && status !== 0) {
        aborted = true;
        pushScreen("muted", `(set -e: abort after status ${status})`);
      }
    }

    chainSteps = steps;
    lastStatus = status;
    return status;
  }

  function runAndPrint(cmd, clearChain) {
    if (clearChain) chainSteps = [];
    const result = runSimple(cmd);
    result.outs.forEach((o) => pushScreen("out", o));
    if (result.err) pushScreen("err", result.err);
    lastStatus = result.status;
    if (setE && result.status !== 0 && cmd !== "false" && !cmd.startsWith("exit ")) {
      // still set status; message for demos
    }
    return result.status;
  }

  /** Support ; sequences: true; echo $? */
  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      const r = runSimple("help");
      r.outs.forEach((o) => pushScreen("out", o));
      lastStatus = 0;
      chainSteps = [];
      return;
    }

    // split on ; but not inside quotes (simple)
    const stmts = [];
    let buf = "";
    let q = null;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if ((c === '"' || c === "'") && !q) q = c;
      else if (q && c === q) q = null;
      else if (c === ";" && !q) {
        if (buf.trim()) stmts.push(buf.trim());
        buf = "";
        continue;
      }
      buf += c;
    }
    if (buf.trim()) stmts.push(buf.trim());

    chainSteps = [];
    for (let si = 0; si < stmts.length; si++) {
      const stmt = stmts[si];
      if (stmt.includes("&&") || stmt.includes("||")) {
        runChain(stmt);
      } else {
        runAndPrint(stmt, si === 0);
      }
      if (setE && lastStatus !== 0 && si < stmts.length - 1) {
        pushScreen("muted", `(set -e: stop remaining ; list)`);
        break;
      }
    }
  }

  function submitLine() {
    fakeRun(inputEl.value);
    inputEl.value = "";
    renderAll();
    saveSession();
  }

  function loadStarter() {
    setE = false;
    lastStatus = 0;
    lastCmd = "";
    chainSteps = [];
    screen = [
      {
        kind: "muted",
        text: "Starter: try true; echo $?  ·  false && echo no  ·  false || echo yes",
      },
    ];
    fakeRun("true; echo $?");
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          lastStatus,
          setE,
          screen: screen.slice(-40),
          chainSteps,
          lastCmd,
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
      lastStatus = typeof data.lastStatus === "number" ? data.lastStatus : 0;
      setE = !!data.setE;
      screen = Array.isArray(data.screen) ? data.screen : [];
      chainSteps = Array.isArray(data.chainSteps) ? data.chainSteps : [];
      lastCmd = data.lastCmd || "";
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "true; echo $?", cmd: "true; echo $?" },
    { label: "false; echo $?", cmd: "false; echo $?" },
    { label: "true && echo ok", cmd: "true && echo ok" },
    { label: "false && echo ok", cmd: "false && echo ok" },
    { label: "false || echo fb", cmd: "false || echo fallback" },
    { label: "true || echo fb", cmd: "true || echo fallback" },
    { label: "A && B || C", cmd: "true && false || echo trap" },
    { label: "test -f Makefile", cmd: "test -f Makefile; echo $?" },
    { label: "set -e demo", cmd: "set -e; false; echo never" },
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

  function screenHas(re) {
    return screen.some((r) => re.test(r.text));
  }

  const CHALLENGES = [
    {
      id: "quiz-zero",
      title: "Quiz: success",
      prompt: "Exit status for success is? Answer: <code>0</code>",
      hint: "zero",
      type: "text",
      answer: "0",
    },
    {
      id: "true-status",
      title: "true status",
      prompt: "Run <code>true; echo $?</code> — status pill should be 0 and stdout <code>0</code>.",
      hint: "true; echo $?",
      type: "state",
      check: () => lastStatus === 0 && lastCmd.includes("true") && screenHas(/^0$/),
    },
    {
      id: "false-status",
      title: "false status",
      prompt: "Run <code>false; echo $?</code> — printed status is <code>1</code>.",
      hint: "false; echo $?",
      type: "state",
      check: () => lastCmd.includes("false") && screenHas(/^1$/),
    },
    {
      id: "quiz-qmark",
      title: "Quiz: $?",
      prompt: "<code>$?</code> holds the previous command’s? Answer: <code>exit status</code>",
      hint: "exit status / return code",
      type: "text",
      answer: "exit status",
      alt: ["status", "return code", "exit code"],
    },
    {
      id: "and-true",
      title: "&& runs",
      prompt: "Run <code>true && echo ok</code> — <code>ok</code> should print.",
      hint: "true && echo ok",
      type: "state",
      check: () =>
        lastCmd.includes("&&") &&
        screenHas(/^ok$/) &&
        chainSteps.some((s) => s.text.includes("echo") && s.ran),
    },
    {
      id: "and-false",
      title: "&& skips",
      prompt: "Run <code>false && echo ok</code> — echo should be skipped.",
      hint: "false && echo ok",
      type: "state",
      check: () =>
        lastCmd.includes("false &&") &&
        chainSteps.some((s) => s.text.includes("echo") && !s.ran),
    },
    {
      id: "or-false",
      title: "|| runs",
      prompt: "Run <code>false || echo fallback</code> — fallback prints.",
      hint: "false || echo fallback",
      type: "state",
      check: () =>
        lastCmd.includes("||") &&
        screenHas(/^fallback$/) &&
        chainSteps.some((s) => s.ran && s.text.includes("echo")),
    },
    {
      id: "or-true",
      title: "|| skips",
      prompt: "Run <code>true || echo fallback</code> — echo skipped.",
      hint: "true || echo fallback",
      type: "state",
      check: () =>
        lastCmd.includes("true ||") &&
        chainSteps.some((s) => s.text.includes("echo") && !s.ran),
    },
    {
      id: "quiz-and",
      title: "Quiz: &&",
      prompt: "<code>A &amp;&amp; B</code> runs B only if A? Answer: <code>succeeds</code>",
      hint: "succeeds / status 0",
      type: "text",
      answer: "succeeds",
      alt: ["success", "succeed", "passes", "status 0", "0"],
    },
    {
      id: "quiz-or",
      title: "Quiz: ||",
      prompt: "<code>A || B</code> runs B only if A? Answer: <code>fails</code>",
      hint: "fails / non-zero",
      type: "text",
      answer: "fails",
      alt: ["fail", "failure", "non-zero", "errors"],
    },
    {
      id: "exit-7",
      title: "exit 7",
      prompt: "Run <code>exit 7; echo $?</code> — prints <code>7</code>.",
      hint: "exit 7; echo $?",
      type: "state",
      check: () => lastCmd.includes("exit 7") && screenHas(/^7$/),
    },
    {
      id: "test-file",
      title: "test -f",
      prompt: "Run <code>test -f Makefile; echo $?</code> — should print <code>0</code>.",
      hint: "Makefile exists in the lab",
      type: "state",
      check: () => lastCmd.includes("test -f Makefile") && screenHas(/^0$/),
    },
    {
      id: "test-missing",
      title: "test missing",
      prompt: "<code>test -f missing.v; echo $?</code> — print <code>1</code>.",
      hint: "test -f missing.v; echo $?",
      type: "state",
      check: () => lastCmd.includes("missing.v") && screenHas(/^1$/),
    },
    {
      id: "bracket-eq",
      title: "[ = ]",
      prompt: "Run <code>[ hello = hello ]; echo $?</code> → <code>0</code>.",
      hint: "[ hello = hello ]; echo $?",
      type: "state",
      check: () => lastCmd.includes("[ hello = hello ]") && screenHas(/^0$/),
    },
    {
      id: "pitfall-trap",
      title: "Chain pitfall",
      prompt: "Run <code>true && false || echo trap</code> — <code>trap</code> still prints (B failed).",
      hint: "Quick button: A && B || C",
      type: "state",
      check: () =>
        lastCmd.includes("true && false ||") &&
        screenHas(/^trap$/) &&
        chainSteps.filter((s) => s.ran).length >= 2,
    },
    {
      id: "quiz-pitfall",
      title: "Quiz: pitfall",
      prompt: "Prefer <code>if/else</code> over <code>A &amp;&amp; B || C</code> because the chain is not clean? Answer: <code>if</code>",
      hint: "if/else",
      type: "text",
      answer: "if",
      alt: ["if/else", "if else", "else"],
    },
    {
      id: "ls-fail",
      title: "ls fail",
      prompt: "<code>ls nope.txt; echo $?</code> — non-zero status printed.",
      hint: "ls nope.txt; echo $?",
      type: "state",
      check: () => lastCmd.includes("ls nope") && screenHas(/^[1-9]\d*$/),
    },
    {
      id: "set-e-demo",
      title: "set -e",
      prompt: "Run <code>set -e; false; echo never</code> — <code>never</code> should not appear after abort.",
      hint: "set -e demo quick button",
      type: "state",
      check: () =>
        lastCmd.includes("set -e") &&
        lastCmd.includes("false") &&
        screenHas(/set -e: stop|set -e: abort/) &&
        !screen.slice(-6).some((r) => r.text === "never"),
    },
    {
      id: "quiz-set-e",
      title: "Quiz: set -e",
      prompt: "<code>set -e</code> aborts when a command’s status is? Answer: <code>non-zero</code>",
      hint: "non-zero / failure",
      type: "text",
      answer: "non-zero",
      alt: ["nonzero", "not zero", "failure", "fail", "non zero"],
    },
    {
      id: "and-ls",
      title: "&& with test",
      prompt: "<code>test -f Makefile && echo build</code> — prints <code>build</code>.",
      hint: "test -f Makefile && echo build",
      type: "state",
      check: () => lastCmd.includes("test -f Makefile &&") && screenHas(/^build$/),
    },
    {
      id: "final-status",
      title: "Final status",
      prompt: "After <code>false || true</code>, what is <code>$?</code>? (number)",
      hint: "last command was true → 0",
      type: "text",
      answer: "0",
      setup: () => {
        fakeRun("false || true");
        renderAll();
      },
    },
    {
      id: "quiz-meaning",
      title: "Quiz: meaning",
      prompt: "In shell, status <code>0</code> means? Answer: <code>success</code>",
      hint: "success / true",
      type: "text",
      answer: "success",
      alt: ["ok", "true", "pass"],
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

  document.getElementById("ex-starter").addEventListener("click", loadStarter);
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
