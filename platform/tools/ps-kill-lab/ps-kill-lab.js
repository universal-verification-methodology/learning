(() => {
  /**
   * @typedef {{
   *   pid: number,
   *   ppid: number,
   *   user: string,
   *   cmd: string,
   *   state: 'R'|'S'|'T'|'Z',
   *   alive: boolean,
   *   catchInt: boolean,
   *   catchTerm: boolean,
   *   fg: boolean,
   *   note?: string
   * }} Proc
   */

  function makeStarter() {
    /** @type {Proc[]} */
    return [
      {
        pid: 1,
        ppid: 0,
        user: "root",
        cmd: "init",
        state: "S",
        alive: true,
        catchInt: true,
        catchTerm: true,
        fg: false,
        note: "system",
      },
      {
        pid: 1000,
        ppid: 1,
        user: "lab",
        cmd: "bash",
        state: "S",
        alive: true,
        catchInt: true,
        catchTerm: true,
        fg: false,
        note: "your shell",
      },
      {
        pid: 2201,
        ppid: 1000,
        user: "lab",
        cmd: "iverilog -o build/out.vvp rtl/top.v",
        state: "R",
        alive: true,
        catchInt: false,
        catchTerm: false,
        fg: true,
        note: "foreground sim compile",
      },
      {
        pid: 2205,
        ppid: 1000,
        user: "lab",
        cmd: "gtkwave wave.vcd",
        state: "S",
        alive: true,
        catchInt: false,
        catchTerm: false,
        fg: false,
        note: "GUI viewer",
      },
      {
        pid: 2210,
        ppid: 1000,
        user: "lab",
        cmd: "hung_sim --ignore-int",
        state: "R",
        alive: true,
        catchInt: true,
        catchTerm: true,
        fg: false,
        note: "catches SIGINT/SIGTERM — needs SIGKILL",
      },
      {
        pid: 2215,
        ppid: 1000,
        user: "lab",
        cmd: "sleep 3600",
        state: "S",
        alive: true,
        catchInt: false,
        catchTerm: false,
        fg: false,
      },
      {
        pid: 2220,
        ppid: 1000,
        user: "lab",
        cmd: "make sim",
        state: "S",
        alive: true,
        catchInt: false,
        catchTerm: false,
        fg: false,
      },
    ];
  }

  /** @type {Proc[]} */
  let procs = makeStarter();
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  /** @type {string[]} */
  let events = [];
  let lastCmd = "";
  let lastKill = "";
  let lastSignal = "";
  let lastPs = false;
  let tick = 0;

  const CLEARED_KEY = "ddv-ps-kill-lab-cleared-v1";
  const STORE_KEY = "ddv-ps-kill-lab-session-v1";

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

  const root = document.getElementById("ps-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Foreground job is <code>iverilog</code> (PID 2201).
        Try <code>ps</code>, then Ctrl+C (SIGINT) to stop it. For <code>hung_sim</code> (2210),
        SIGINT is ignored — use <code>kill -9 2210</code>.</p>
      <button type="button" class="btn btn-secondary" id="ps-starter">Load starter example</button>
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
          <div class="fg-banner" id="fg-banner"></div>
          <div class="ps-term">
            <div class="ps-scroll" id="term-scroll"></div>
            <div class="ps-prompt-row">
              <span class="ps-prompt">lab$</span>
              <input class="ps-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="ps · kill PID · kill -9 PID · help" aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Process table</h2>
          <button type="button" class="btn btn-ghost" id="btn-refresh">Refresh</button>
        </div>
        <div class="panel-body" style="overflow:auto">
          <table class="ps-table" id="ps-table"></table>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Signals cheat cards</h2></div>
      <div class="panel-body">
        <div class="signal-grid">
          <div class="sig-card">
            <h3>SIGINT <span class="num">2</span></h3>
            <p>Ctrl+C — interrupt foreground. Catchable; polite stop.</p>
          </div>
          <div class="sig-card">
            <h3>SIGTERM <span class="num">15</span></h3>
            <p>Default <code>kill PID</code> — ask process to exit. Catchable.</p>
          </div>
          <div class="sig-card">
            <h3>SIGKILL <span class="num">9</span></h3>
            <p><code>kill -9</code> — cannot be caught. Last resort.</p>
          </div>
        </div>
        <h3 style="font-size:0.95rem;margin:1rem 0 0.45rem">Event log</h3>
        <ul class="event-log" id="event-log"></ul>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>ps</code> / <code>ps aux</code></td><td>List processes (lab table)</td></tr>
            <tr><td><code>kill PID</code></td><td>Send SIGTERM (15)</td></tr>
            <tr><td><code>kill -INT PID</code> / <code>kill -2</code></td><td>Send SIGINT</td></tr>
            <tr><td><code>kill -9 PID</code> / <code>kill -KILL</code></td><td>Send SIGKILL</td></tr>
            <tr><td>Ctrl+C</td><td>SIGINT to the foreground process</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Prefer SIGINT/SIGTERM first; use SIGKILL only if the process ignores them.</li>
          <li>Ctrl+C does not kill background jobs — use <code>kill</code> with the PID from <code>ps</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const tableEl = document.getElementById("ps-table");
  const fgBanner = document.getElementById("fg-banner");
  const eventLog = document.getElementById("event-log");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function aliveProcs() {
    return procs.filter((p) => p.alive);
  }

  function findPid(pid) {
    return procs.find((p) => p.pid === pid);
  }

  function fgProc() {
    return procs.find((p) => p.alive && p.fg) || null;
  }

  function logEvent(msg) {
    tick += 1;
    events.unshift(`t${tick}: ${msg}`);
    if (events.length > 40) events = events.slice(0, 40);
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 90) screen = screen.slice(-70);
  }

  function deliverSignal(proc, sigName, via) {
    lastKill = String(proc.pid);
    lastSignal = sigName;
    const tag = via || "kill";

    if (!proc.alive) {
      pushScreen("err", `kill: (${proc.pid}): No such process`);
      return false;
    }

    if (sigName === "SIGKILL") {
      proc.alive = false;
      proc.state = "Z";
      proc.fg = false;
      pushScreen("sig", `[${tag}] sent SIGKILL to ${proc.pid} (${proc.cmd}) — process dead`);
      logEvent(`SIGKILL → ${proc.pid} ${proc.cmd.split(" ")[0]} (dead)`);
      return true;
    }

    if (sigName === "SIGINT") {
      if (proc.catchInt) {
        pushScreen("sig", `[${tag}] SIGINT delivered to ${proc.pid} — process caught & ignored`);
        logEvent(`SIGINT → ${proc.pid} (caught, still alive)`);
        return false;
      }
      proc.alive = false;
      proc.state = "Z";
      proc.fg = false;
      pushScreen("ok", `[${tag}] SIGINT → ${proc.pid} exited`);
      logEvent(`SIGINT → ${proc.pid} ${proc.cmd.split(" ")[0]} (exited)`);
      return true;
    }

    if (sigName === "SIGTERM") {
      if (proc.catchTerm) {
        pushScreen("sig", `[${tag}] SIGTERM delivered to ${proc.pid} — process caught & ignored`);
        logEvent(`SIGTERM → ${proc.pid} (caught, still alive)`);
        return false;
      }
      proc.alive = false;
      proc.state = "Z";
      proc.fg = false;
      pushScreen("ok", `[${tag}] SIGTERM → ${proc.pid} exited`);
      logEvent(`SIGTERM → ${proc.pid} ${proc.cmd.split(" ")[0]} (exited)`);
      return true;
    }

    pushScreen("err", `lab: unsupported signal ${sigName}`);
    return false;
  }

  function parseSignal(tok) {
    const t = String(tok).toUpperCase().replace(/^-/, "");
    if (t === "9" || t === "KILL" || t === "SIGKILL") return "SIGKILL";
    if (t === "2" || t === "INT" || t === "SIGINT") return "SIGINT";
    if (t === "15" || t === "TERM" || t === "SIGTERM") return "SIGTERM";
    return null;
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
                : row.kind === "ok"
                  ? "ok"
                  : row.kind === "sig"
                    ? "sig"
                    : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderTable() {
    const rows = [...procs]
      .sort((a, b) => a.pid - b.pid)
      .map((p) => {
        const cls = [
          p.alive && p.fg ? "is-fg" : "",
          !p.alive ? "is-dead" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<tr class="${cls}">
          <td>${p.pid}</td>
          <td>${p.ppid}</td>
          <td>${escapeHtml(p.user)}</td>
          <td class="state-${p.state}">${p.state}${p.alive ? "" : " (dead)"}</td>
          <td>${escapeHtml(p.cmd)}${p.fg && p.alive ? " <b>[fg]</b>" : ""}</td>
        </tr>`;
      })
      .join("");
    tableEl.innerHTML = `<thead><tr><th>PID</th><th>PPID</th><th>USER</th><th>STAT</th><th>COMMAND</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderFg() {
    const fg = fgProc();
    if (!fg) {
      fgBanner.innerHTML = `<strong>Foreground:</strong> (none) — shell is idle
        <div class="meta">Ctrl+C has no process target until something is in the foreground.</div>`;
      return;
    }
    fgBanner.innerHTML = `<strong>Foreground:</strong> PID ${fg.pid} · ${escapeHtml(fg.cmd)}
      <div class="meta">Ctrl+C sends SIGINT to this process only.</div>`;
  }

  function renderEvents() {
    eventLog.innerHTML = events.length
      ? events.map((e) => `<li><span class="t">${escapeHtml(e)}</span></li>`).join("")
      : `<li>No signals yet</li>`;
  }

  function renderAll() {
    renderScreen();
    renderTable();
    renderFg();
    renderEvents();
  }

  function printPs(full) {
    lastPs = true;
    const list = full ? procs : aliveProcs().filter((p) => p.user === "lab" || p.pid === 1);
    pushScreen("out", "  PID  PPID USER  STAT COMMAND");
    for (const p of list.filter((x) => x.alive || full)) {
      if (!p.alive && !full) continue;
      const line = `${String(p.pid).padStart(5)} ${String(p.ppid).padStart(5)} ${p.user.padEnd(5)} ${p.state.padEnd(4)} ${p.cmd}`;
      pushScreen("out", line);
    }
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "ps · ps aux · kill PID · kill -SIGNAL PID · kill -9 PID · help · (use Ctrl+C button)"
      );
      return;
    }
    if (t === "ps" || t === "ps aux" || t === "ps -ef") {
      printPs(t !== "ps");
      return;
    }

    let m;
    // kill -9 2210 | kill -KILL 2210 | kill -INT 2201 | kill -2 2201 | kill 2201
    if ((m = t.match(/^kill\s+(-[A-Za-z0-9]+)\s+(\d+)$/))) {
      const sig = parseSignal(m[1]);
      const pid = Number(m[2]);
      const proc = findPid(pid);
      if (!sig) {
        pushScreen("err", `kill: invalid signal specification: ${m[1]}`);
        return;
      }
      if (!proc) {
        pushScreen("err", `kill: (${pid}): No such process`);
        return;
      }
      deliverSignal(proc, sig, `kill ${m[1]}`);
      return;
    }
    if ((m = t.match(/^kill\s+(\d+)$/))) {
      const pid = Number(m[1]);
      const proc = findPid(pid);
      if (!proc) {
        pushScreen("err", `kill: (${pid}): No such process`);
        return;
      }
      deliverSignal(proc, "SIGTERM", "kill");
      return;
    }
    pushScreen("err", "lab: unknown (try help)");
  }

  function sendCtrlC() {
    lastCmd = "Ctrl+C";
    pushScreen("cmd", "^C");
    const fg = fgProc();
    if (!fg) {
      pushScreen("muted", "(no foreground process)");
      logEvent("Ctrl+C — no foreground target");
      renderAll();
      saveSession();
      return;
    }
    deliverSignal(fg, "SIGINT", "Ctrl+C");
    renderAll();
    saveSession();
  }

  function submitLine() {
    fakeRun(inputEl.value);
    inputEl.value = "";
    renderAll();
    saveSession();
  }

  function loadStarter() {
    procs = makeStarter();
    screen = [
      {
        kind: "muted",
        text: "Starter: ps · Ctrl+C on iverilog · kill -9 2210 for hung_sim",
      },
    ];
    events = [];
    lastCmd = "";
    lastKill = "";
    lastSignal = "";
    lastPs = false;
    tick = 0;
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ procs, screen: screen.slice(-40), events: events.slice(0, 20), tick })
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
      if (!Array.isArray(data.procs) || !data.procs.length) return false;
      procs = data.procs;
      screen = Array.isArray(data.screen) ? data.screen : [];
      events = Array.isArray(data.events) ? data.events : [];
      tick = data.tick || 0;
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "ps", cmd: "ps" },
    { label: "ps aux", cmd: "ps aux" },
    { label: "Ctrl+C", action: "ctrlc", danger: true },
    { label: "kill 2201", cmd: "kill 2201" },
    { label: "kill -INT 2210", cmd: "kill -INT 2210" },
    { label: "kill -9 2210", cmd: "kill -9 2210", danger: true },
    { label: "kill 2215", cmd: "kill 2215" },
  ];
  const quickRow = document.getElementById("quick-row");
  QUICK.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q.label;
    if (q.danger) b.classList.add("danger");
    b.addEventListener("click", () => {
      if (q.action === "ctrlc") sendCtrlC();
      else {
        fakeRun(q.cmd);
        renderAll();
        saveSession();
      }
    });
    quickRow.appendChild(b);
  });

  const CHALLENGES = [
    {
      id: "quiz-ps",
      title: "Quiz: ps",
      prompt: "<code>ps</code> stands for? Answer: <code>process status</code> or <code>processes</code>",
      hint: "process status / list processes",
      type: "text",
      answer: "process status",
      alt: ["processes", "process", "process list", "list processes"],
    },
    {
      id: "run-ps",
      title: "Run ps",
      prompt: "Run <code>ps</code> so the lab table prints in the terminal.",
      hint: "ps",
      type: "state",
      check: () => lastPs && (lastCmd === "ps" || lastCmd === "ps aux" || lastCmd === "ps -ef"),
    },
    {
      id: "fg-pid",
      title: "Foreground PID",
      prompt: "Starter foreground compile PID? (number)",
      hint: "iverilog is 2201",
      type: "text",
      answer: "2201",
      setup: () => loadStarter(),
    },
    {
      id: "quiz-ctrlc",
      title: "Quiz: Ctrl+C",
      prompt: "Ctrl+C sends which signal? Answer: <code>SIGINT</code> or <code>2</code>",
      hint: "SIGINT = 2",
      type: "text",
      answer: "sigint",
      alt: ["2", "int", "signal 2"],
    },
    {
      id: "ctrlc-iverilog",
      title: "Ctrl+C iverilog",
      prompt: "Press Ctrl+C (button) to stop foreground <code>iverilog</code> (2201).",
      hint: "Ctrl+C quick button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const p = findPid(2201);
        return p && !p.alive && lastSignal === "SIGINT";
      },
    },
    {
      id: "quiz-term",
      title: "Quiz: default kill",
      prompt: "Bare <code>kill PID</code> sends? Answer: <code>SIGTERM</code> or <code>15</code>",
      hint: "SIGTERM = 15",
      type: "text",
      answer: "sigterm",
      alt: ["15", "term", "signal 15"],
    },
    {
      id: "kill-sleep",
      title: "kill sleep",
      prompt: "Stop <code>sleep 3600</code> with <code>kill 2215</code> (SIGTERM).",
      hint: "kill 2215",
      type: "state",
      setup: () => {
        const p = findPid(2215);
        if (p) {
          p.alive = true;
          p.state = "S";
        }
      },
      check: () => {
        const p = findPid(2215);
        return p && !p.alive && lastKill === "2215" && lastSignal === "SIGTERM";
      },
    },
    {
      id: "hung-ignores",
      title: "hung ignores INT",
      prompt: "Send <code>kill -INT 2210</code> — hung_sim should still be alive.",
      hint: "kill -INT 2210",
      type: "state",
      setup: () => {
        const p = findPid(2210);
        if (p) {
          p.alive = true;
          p.state = "R";
          p.catchInt = true;
          p.catchTerm = true;
        }
      },
      check: () => {
        const p = findPid(2210);
        return p && p.alive && lastKill === "2210" && lastSignal === "SIGINT";
      },
    },
    {
      id: "hung-kill9",
      title: "kill -9 hung",
      prompt: "Force-stop hung_sim: <code>kill -9 2210</code>.",
      hint: "kill -9 2210",
      type: "state",
      setup: () => {
        const p = findPid(2210);
        if (p) {
          p.alive = true;
          p.state = "R";
          p.catchInt = true;
          p.catchTerm = true;
        }
      },
      check: () => {
        const p = findPid(2210);
        return p && !p.alive && lastSignal === "SIGKILL" && lastKill === "2210";
      },
    },
    {
      id: "quiz-kill9",
      title: "Quiz: -9",
      prompt: "<code>kill -9</code> is which signal? Answer: <code>SIGKILL</code>",
      hint: "SIGKILL",
      type: "text",
      answer: "sigkill",
      alt: ["9", "kill", "signal 9"],
    },
    {
      id: "quiz-catchable",
      title: "Quiz: catchable",
      prompt: "Which cannot be caught by a process? Answer: <code>SIGKILL</code>",
      hint: "SIGKILL / 9",
      type: "text",
      answer: "sigkill",
      alt: ["9", "kill -9", "signal 9"],
    },
    {
      id: "quiz-prefer",
      title: "Quiz: prefer",
      prompt: "Prefer first (polite): <code>SIGINT</code>/<code>SIGTERM</code> or <code>SIGKILL</code>? Answer: <code>SIGTERM</code> or <code>polite</code>",
      hint: "Ask nicely before -9",
      type: "text",
      answer: "sigterm",
      alt: ["sigint", "polite", "term", "int", "sigint/sigterm"],
    },
    {
      id: "gtkwave-pid",
      title: "gtkwave PID",
      prompt: "Starter PID of <code>gtkwave</code>? (number)",
      hint: "2205",
      type: "text",
      answer: "2205",
      setup: () => loadStarter(),
    },
    {
      id: "kill-gtkwave",
      title: "kill gtkwave",
      prompt: "Terminate gtkwave with <code>kill 2205</code>.",
      hint: "kill 2205",
      type: "state",
      setup: () => {
        const p = findPid(2205);
        if (p) {
          p.alive = true;
          p.state = "S";
        }
      },
      check: () => {
        const p = findPid(2205);
        return p && !p.alive && lastKill === "2205";
      },
    },
    {
      id: "quiz-fg-only",
      title: "Quiz: Ctrl+C scope",
      prompt: "Ctrl+C targets the? Answer: <code>foreground</code>",
      hint: "foreground process / process group",
      type: "text",
      answer: "foreground",
      alt: ["fg", "foreground process", "foreground job"],
    },
    {
      id: "no-fg-ctrlc",
      title: "No fg Ctrl+C",
      prompt: "After stopping iverilog, press Ctrl+C — should report no foreground process.",
      hint: "Kill/Ctrl+C 2201 first, then Ctrl+C again",
      type: "state",
      check: () =>
        !fgProc() &&
        lastCmd === "Ctrl+C" &&
        screen.some((r) => /no foreground/i.test(r.text)),
    },
    {
      id: "sig-number-int",
      title: "SIGINT number",
      prompt: "Numeric value of SIGINT? (number)",
      hint: "2",
      type: "text",
      answer: "2",
    },
    {
      id: "sig-number-kill",
      title: "SIGKILL number",
      prompt: "Numeric value of SIGKILL? (number)",
      hint: "9",
      type: "text",
      answer: "9",
    },
    {
      id: "kill-dash2",
      title: "kill -2",
      prompt: "Use <code>kill -2 2220</code> to SIGINT <code>make sim</code>.",
      hint: "kill -2 2220",
      type: "state",
      setup: () => {
        const p = findPid(2220);
        if (p) {
          p.alive = true;
          p.state = "S";
          p.catchInt = false;
        }
      },
      check: () => {
        const p = findPid(2220);
        return p && !p.alive && lastSignal === "SIGINT" && lastKill === "2220";
      },
    },
    {
      id: "alive-count",
      title: "Count lab procs",
      prompt: "Starter: how many <em>alive</em> processes owned by user <code>lab</code>? (number)",
      hint: "bash + iverilog + gtkwave + hung_sim + sleep + make = 6",
      type: "text",
      answer: "6",
      setup: () => loadStarter(),
    },
    {
      id: "quiz-stat-r",
      title: "Quiz: STAT R",
      prompt: "STAT <code>R</code> usually means? Answer: <code>running</code>",
      hint: "Runnable / running",
      type: "text",
      answer: "running",
      alt: ["runnable", "r"],
    },
    {
      id: "event-log-check",
      title: "Event log",
      prompt: "Send any kill/Ctrl+C so the event log gains an entry, then Check.",
      hint: "Ctrl+C or kill 2215",
      type: "state",
      check: () => events.length > 0,
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the terminal / Ctrl+C, then Check.</span>`;
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

  document.getElementById("ps-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-refresh").addEventListener("click", () => {
    renderTable();
    renderFg();
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
