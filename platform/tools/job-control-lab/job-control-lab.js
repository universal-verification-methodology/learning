(() => {
  /**
   * @typedef {{
   *   id: number,
   *   pid: number,
   *   cmd: string,
   *   status: 'Running'|'Stopped'|'Done',
   *   where: 'fg'|'bg'|null,
   *   current: boolean
   * }} Job
   */

  let nextPid = 3100;

  function makeStarter() {
    nextPid = 3100;
    /** @type {Job[]} */
    return [
      {
        id: 1,
        pid: 3101,
        cmd: "make sim",
        status: "Running",
        where: "fg",
        current: true,
      },
      {
        id: 2,
        pid: 3102,
        cmd: "gtkwave wave.vcd",
        status: "Running",
        where: "bg",
        current: false,
      },
    ];
  }

  /** @type {Job[]} */
  let jobs = makeStarter();
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  /** @type {string[]} */
  let timeline = [];
  let lastCmd = "";
  let lastJobs = false;
  let lastFg = "";
  let lastBg = "";
  let tick = 0;

  const CLEARED_KEY = "ddv-job-control-lab-cleared-v1";
  const STORE_KEY = "ddv-job-control-lab-session-v1";

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

  const root = document.getElementById("jc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Job <code>[1]</code> <code>make sim</code> is in the
        <em>foreground</em>; <code>[2]</code> <code>gtkwave</code> runs in the <em>background</em>.
        Press Ctrl+Z to stop [1], then <code>bg %1</code> or <code>fg %1</code>. Try
        <code>sleep 60 &amp;</code> to add a job.</p>
      <button type="button" class="btn btn-secondary" id="jc-starter">Load starter example</button>
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
          <div class="jc-term">
            <div class="jc-scroll" id="term-scroll"></div>
            <div class="jc-prompt-row">
              <span class="jc-prompt">lab$</span>
              <input class="jc-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="jobs · fg %1 · bg %1 · sleep 60 &amp; · help"
                aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>jobs table</h2></div>
        <div class="panel-body">
          <div class="legend">
            <span>+ = current job</span>
            <span>- = previous</span>
            <span>fg / bg / Stopped</span>
          </div>
          <table class="jobs-table" id="jobs-table"></table>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>State flow</h2></div>
      <div class="panel-body">
        <div class="state-flow">
          <span>fg Running</span><span class="sep">Ctrl+Z</span>
          <span>Stopped</span><span class="sep">bg</span>
          <span>bg Running</span><span class="sep">fg</span>
          <span>fg Running</span>
        </div>
        <h3 style="font-size:0.95rem;margin:0 0 0.45rem">Timeline</h3>
        <ul class="timeline" id="timeline"></ul>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Action</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td><code>cmd &amp;</code></td><td>Start in background (Running, bg)</td></tr>
            <tr><td>Ctrl+Z</td><td>SIGTSTP — suspend foreground → Stopped</td></tr>
            <tr><td><code>jobs</code> / <code>jobs -l</code></td><td>List shell jobs (+ PID with -l)</td></tr>
            <tr><td><code>bg %N</code></td><td>Resume stopped job in background</td></tr>
            <tr><td><code>fg %N</code></td><td>Bring job to foreground</td></tr>
            <tr><td>Ctrl+C</td><td>SIGINT — kill foreground job</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Job numbers (<code>%1</code>) are per-shell; PIDs are from the OS.</li>
          <li>Ctrl+Z <em>stops</em>; it does not kill. Use Ctrl+C or <code>kill</code> to terminate.</li>
        </ul>
      </div>
    </div>
  `;

  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const tableEl = document.getElementById("jobs-table");
  const fgBanner = document.getElementById("fg-banner");
  const timelineEl = document.getElementById("timeline");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function activeJobs() {
    return jobs.filter((j) => j.status !== "Done");
  }

  function fgJob() {
    return jobs.find((j) => j.status === "Running" && j.where === "fg") || null;
  }

  function findJob(spec) {
    // %1, 1, %+ , %-
    if (spec === "%+" || spec === "+" || spec === "%") {
      return jobs.find((j) => j.current && j.status !== "Done") || activeJobs()[0] || null;
    }
    if (spec === "%-" || spec === "-") {
      const cur = jobs.find((j) => j.current);
      return (
        jobs.find((j) => j.status !== "Done" && (!cur || j.id !== cur.id)) || null
      );
    }
    const m = String(spec).match(/^%?(\d+)$/);
    if (!m) return null;
    return jobs.find((j) => j.id === Number(m[1])) || null;
  }

  function setCurrent(job) {
    jobs.forEach((j) => {
      j.current = false;
    });
    if (job && job.status !== "Done") job.current = true;
  }

  function markDone(job, reason) {
    job.status = "Done";
    job.where = null;
    job.current = false;
    pushScreen("job", `[${job.id}]+  Done  ${job.cmd}`);
    addTimeline(`job [${job.id}] → Done (${reason})`);
  }

  function addTimeline(msg) {
    tick += 1;
    timeline.unshift(`t${tick}: ${msg}`);
    if (timeline.length > 50) timeline = timeline.slice(0, 50);
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
                : row.kind === "ok"
                  ? "ok"
                  : row.kind === "job"
                    ? "job"
                    : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderTable() {
    const list = jobs.filter((j) => j.status !== "Done" || true).slice(-8);
    const rows = list
      .map((j) => {
        const mark = j.current ? "+" : j.status !== "Done" ? "-" : " ";
        const where =
          j.status === "Done" ? "" : j.where === "fg" ? " (fg)" : j.where === "bg" ? " &" : "";
        const cls = j.where === "fg" && j.status === "Running" ? "is-fg" : "";
        return `<tr class="${cls}">
          <td>[${j.id}]${mark}</td>
          <td>${j.pid}</td>
          <td class="st-${j.status}">${j.status}${where}</td>
          <td>${escapeHtml(j.cmd)}</td>
        </tr>`;
      })
      .join("");
    tableEl.innerHTML = `<thead><tr><th>JOB</th><th>PID</th><th>STATUS</th><th>COMMAND</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderFg() {
    const fg = fgJob();
    if (!fg) {
      fgBanner.innerHTML = `<strong>Foreground:</strong> (idle shell)
        <div class="meta">Ctrl+Z / Ctrl+C need a foreground job. Use <code>fg %N</code> or run a command.</div>`;
      return;
    }
    fgBanner.innerHTML = `<strong>Foreground:</strong> [${fg.id}] PID ${fg.pid} · ${escapeHtml(fg.cmd)}
      <div class="meta">Ctrl+Z suspends · Ctrl+C kills · shell waits until this job finishes or stops.</div>`;
  }

  function renderTimeline() {
    timelineEl.innerHTML = timeline.length
      ? timeline
          .map((e) => {
            const html = escapeHtml(e).replace("→", '<span class="arrow">→</span>');
            return `<li><span class="t">${html}</span></li>`;
          })
          .join("")
      : `<li>No transitions yet</li>`;
  }

  function renderAll() {
    renderScreen();
    renderTable();
    renderFg();
    renderTimeline();
  }

  function printJobs(withPid) {
    lastJobs = true;
    const list = activeJobs();
    if (!list.length) {
      pushScreen("muted", "(no jobs)");
      return;
    }
    for (const j of list) {
      const mark = j.current ? "+" : "-";
      const st =
        j.status === "Stopped"
          ? "Stopped"
          : j.where === "fg"
            ? "Running"
            : "Running";
      const amp = j.where === "bg" && j.status === "Running" ? " &" : "";
      const pidPart = withPid ? ` ${j.pid}` : "";
      pushScreen("out", `[${j.id}]${mark}${pidPart}  ${st}${amp}  ${j.cmd}`);
    }
  }

  function nextJobId() {
    const ids = jobs.map((j) => j.id);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  function startJob(cmd, background) {
    // If starting fg while something is fg, not allowed in real shell without waiting —
    // lab: demote current fg to bg if still running (simplified) OR refuse.
    const existingFg = fgJob();
    if (!background && existingFg) {
      pushScreen("err", "lab: foreground busy — Ctrl+Z or wait (try cmd &)");
      return null;
    }
    const job = {
      id: nextJobId(),
      pid: nextPid++,
      cmd,
      status: "Running",
      where: background ? "bg" : "fg",
      current: true,
    };
    setCurrent(job);
    jobs.push(job);
    if (background) {
      pushScreen("job", `[${job.id}] ${job.pid}`);
      addTimeline(`start [${job.id}] ${cmd} → bg Running`);
    } else {
      addTimeline(`start [${job.id}] ${cmd} → fg Running`);
    }
    return job;
  }

  function doFg(spec) {
    const job = findJob(spec || "%+");
    if (!job || job.status === "Done") {
      pushScreen("err", `fg: ${spec || "%"}: no such job`);
      return;
    }
    const busy = fgJob();
    if (busy && busy.id !== job.id) {
      pushScreen("err", `fg: foreground busy with [${busy.id}] — Ctrl+Z first`);
      return;
    }
    const from = `${job.status}/${job.where || "-"}`;
    job.status = "Running";
    job.where = "fg";
    setCurrent(job);
    lastFg = `%${job.id}`;
    pushScreen("ok", `${job.cmd}`);
    addTimeline(`fg %${job.id} : ${from} → fg Running`);
  }

  function doBg(spec) {
    const job = findJob(spec || "%+");
    if (!job || job.status === "Done") {
      pushScreen("err", `bg: ${spec || "%"}: no such job`);
      return;
    }
    if (job.status !== "Stopped" && !(job.status === "Running" && job.where === "bg")) {
      // classic: bg on already running bg is ok-ish; bg on fg running is unusual
      if (job.where === "fg" && job.status === "Running") {
        pushScreen("err", `bg: job [${job.id}] already in foreground — Ctrl+Z first`);
        return;
      }
    }
    if (job.status === "Running" && job.where === "bg") {
      pushScreen("muted", `bg: [${job.id}] already running in background`);
      return;
    }
    const from = `${job.status}/${job.where || "-"}`;
    job.status = "Running";
    job.where = "bg";
    setCurrent(job);
    lastBg = `%${job.id}`;
    pushScreen("job", `[${job.id}]+ ${job.cmd} &`);
    addTimeline(`bg %${job.id} : ${from} → bg Running`);
  }

  function ctrlZ() {
    lastCmd = "Ctrl+Z";
    pushScreen("cmd", "^Z");
    const fg = fgJob();
    if (!fg) {
      pushScreen("muted", "(no foreground job)");
      addTimeline("Ctrl+Z — no foreground target");
      return;
    }
    fg.status = "Stopped";
    fg.where = null;
    setCurrent(fg);
    pushScreen("job", `[${fg.id}]+  Stopped  ${fg.cmd}`);
    addTimeline(`Ctrl+Z [${fg.id}] → Stopped (SIGTSTP)`);
  }

  function ctrlC() {
    lastCmd = "Ctrl+C";
    pushScreen("cmd", "^C");
    const fg = fgJob();
    if (!fg) {
      pushScreen("muted", "(no foreground job)");
      addTimeline("Ctrl+C — no foreground target");
      return;
    }
    markDone(fg, "SIGINT");
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "jobs · jobs -l · fg %N · bg %N · sleep N & · make sim & · Ctrl+Z · Ctrl+C · help"
      );
      return;
    }
    if (t === "jobs") {
      printJobs(false);
      return;
    }
    if (t === "jobs -l") {
      printJobs(true);
      return;
    }

    let m;
    if ((m = t.match(/^fg(?:\s+(%?\d+|%\+|%-|%|\+|-))?$/))) {
      doFg(m[1] || "%+");
      return;
    }
    if ((m = t.match(/^bg(?:\s+(%?\d+|%\+|%-|%|\+|-))?$/))) {
      doBg(m[1] || "%+");
      return;
    }

    // background command: anything ending with &
    if (t.endsWith("&")) {
      const cmd = t.slice(0, -1).trim();
      if (!cmd) {
        pushScreen("err", "lab: empty command");
        return;
      }
      startJob(cmd, true);
      return;
    }

    // allow starting a few known cmds in foreground
    if (
      /^(make\s+sim|sleep\s+\d+|iverilog\b.*|gtkwave\b.*|yes|top)$/.test(t) ||
      t === "make sim"
    ) {
      startJob(t, false);
      return;
    }

    pushScreen("err", "lab: unknown (try help, or end with &)");
  }

  function submitLine() {
    fakeRun(inputEl.value);
    inputEl.value = "";
    renderAll();
    saveSession();
  }

  function loadStarter() {
    jobs = makeStarter();
    screen = [
      {
        kind: "muted",
        text: "Starter: [1] make sim (fg) · [2] gtkwave (bg) — try Ctrl+Z then bg %1",
      },
    ];
    timeline = [
      "t0: [1] make sim → fg Running",
      "t0: [2] gtkwave → bg Running",
    ];
    lastCmd = "";
    lastJobs = false;
    lastFg = "";
    lastBg = "";
    tick = 0;
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          jobs,
          nextPid,
          screen: screen.slice(-40),
          timeline: timeline.slice(0, 30),
          tick,
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
      if (!Array.isArray(data.jobs) || !data.jobs.length) return false;
      jobs = data.jobs;
      nextPid = data.nextPid || 3200;
      screen = Array.isArray(data.screen) ? data.screen : [];
      timeline = Array.isArray(data.timeline) ? data.timeline : [];
      tick = data.tick || 0;
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "jobs", cmd: "jobs" },
    { label: "jobs -l", cmd: "jobs -l" },
    { label: "Ctrl+Z", action: "z" },
    { label: "bg %1", cmd: "bg %1" },
    { label: "fg %1", cmd: "fg %1" },
    { label: "sleep 60 &", cmd: "sleep 60 &" },
    { label: "Ctrl+C", action: "c" },
    { label: "fg %2", cmd: "fg %2" },
  ];
  const quickRow = document.getElementById("quick-row");
  QUICK.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q.label;
    b.addEventListener("click", () => {
      if (q.action === "z") {
        ctrlZ();
        renderAll();
        saveSession();
      } else if (q.action === "c") {
        ctrlC();
        renderAll();
        saveSession();
      } else {
        fakeRun(q.cmd);
        renderAll();
        saveSession();
      }
    });
    quickRow.appendChild(b);
  });

  const CHALLENGES = [
    {
      id: "quiz-jobs",
      title: "Quiz: jobs",
      prompt: "<code>jobs</code> lists jobs for the? Answer: <code>shell</code>",
      hint: "current shell session",
      type: "text",
      answer: "shell",
      alt: ["current shell", "this shell", "session"],
    },
    {
      id: "run-jobs",
      title: "Run jobs",
      prompt: "Run <code>jobs</code> to list [1] and [2].",
      hint: "jobs",
      type: "state",
      check: () => lastJobs && lastCmd.startsWith("jobs"),
    },
    {
      id: "fg-job-id",
      title: "FG job id",
      prompt: "Starter foreground job number? (number)",
      hint: "[1] make sim",
      type: "text",
      answer: "1",
      setup: () => loadStarter(),
    },
    {
      id: "quiz-amp",
      title: "Quiz: &",
      prompt: "Trailing <code>&amp;</code> starts a job in the? Answer: <code>background</code>",
      hint: "background",
      type: "text",
      answer: "background",
      alt: ["bg", "back"],
    },
    {
      id: "quiz-ctrlz",
      title: "Quiz: Ctrl+Z",
      prompt: "Ctrl+Z sends? Answer: <code>SIGTSTP</code> or <code>stop</code>",
      hint: "SIGTSTP — suspend, not kill",
      type: "text",
      answer: "sigtstp",
      alt: ["stop", "suspend", "tstp"],
    },
    {
      id: "ctrlz-make",
      title: "Ctrl+Z make",
      prompt: "Suspend foreground <code>make sim</code> with Ctrl+Z — status Stopped.",
      hint: "Ctrl+Z button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const j = jobs.find((x) => x.id === 1);
        return j && j.status === "Stopped" && lastCmd === "Ctrl+Z";
      },
    },
    {
      id: "bg-resume",
      title: "bg resume",
      prompt: "After stopping [1], run <code>bg %1</code> so it runs in background.",
      hint: "Ctrl+Z then bg %1",
      type: "state",
      check: () => {
        const j = jobs.find((x) => x.id === 1);
        return j && j.status === "Running" && j.where === "bg" && lastBg === "%1";
      },
    },
    {
      id: "fg-bring",
      title: "fg bring",
      prompt: "Bring gtkwave to foreground: <code>fg %2</code> (shell must be idle).",
      hint: "Ctrl+Z [1] first if needed, then fg %2",
      type: "state",
      check: () => {
        const j = jobs.find((x) => x.id === 2);
        return j && j.status === "Running" && j.where === "fg" && lastFg === "%2";
      },
    },
    {
      id: "sleep-bg",
      title: "sleep &",
      prompt: "Start <code>sleep 60 &amp;</code> — a new background job appears.",
      hint: "sleep 60 &",
      type: "state",
      check: () =>
        jobs.some(
          (j) =>
            j.cmd === "sleep 60" &&
            j.status === "Running" &&
            j.where === "bg" &&
            lastCmd.includes("sleep 60")
        ),
    },
    {
      id: "jobs-l",
      title: "jobs -l",
      prompt: "Run <code>jobs -l</code> to include PIDs.",
      hint: "jobs -l",
      type: "state",
      check: () => lastCmd === "jobs -l" && lastJobs,
    },
    {
      id: "quiz-fg-vs-bg",
      title: "Quiz: fg vs bg",
      prompt: "Which resumes a stopped job <em>and</em> attaches the terminal? Answer: <code>fg</code>",
      hint: "fg",
      type: "text",
      answer: "fg",
      alt: ["foreground"],
    },
    {
      id: "quiz-not-kill",
      title: "Quiz: not kill",
      prompt: "Does Ctrl+Z kill the process? Answer: <code>no</code>",
      hint: "It only suspends (Stopped)",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "ctrlc-fg",
      title: "Ctrl+C fg",
      prompt: "With a foreground job, Ctrl+C should mark it Done.",
      hint: "Ensure something is fg (fg %1), then Ctrl+C",
      type: "state",
      check: () =>
        lastCmd === "Ctrl+C" &&
        jobs.some((j) => j.status === "Done") &&
        timeline.some((t) => /SIGINT/.test(t)),
    },
    {
      id: "quiz-percent",
      title: "Quiz: %1",
      prompt: "<code>%1</code> means job number? Answer: <code>1</code> or <code>job</code>",
      hint: "job specification",
      type: "text",
      answer: "1",
      alt: ["job", "job 1", "job number 1"],
    },
    {
      id: "gtkwave-bg",
      title: "gtkwave bg",
      prompt: "Starter: is gtkwave in the background? Answer: <code>yes</code>",
      hint: "[2] Running &",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
      setup: () => loadStarter(),
    },
    {
      id: "round-trip",
      title: "Round trip",
      prompt: "Path: Ctrl+Z on [1] → <code>bg %1</code> → <code>fg %1</code> so [1] is fg Running again.",
      hint: "Ctrl+Z, bg %1, fg %1",
      type: "state",
      check: () => {
        const j = jobs.find((x) => x.id === 1);
        return (
          j &&
          j.status === "Running" &&
          j.where === "fg" &&
          lastFg === "%1" &&
          timeline.some((t) => /Ctrl\+Z \[1\]/.test(t)) &&
          timeline.some((t) => /bg %1/.test(t))
        );
      },
    },
    {
      id: "quiz-sigtstp",
      title: "Quiz: SIGTSTP",
      prompt: "SIGTSTP leaves the process? Answer: <code>stopped</code> or <code>suspended</code>",
      hint: "Stopped / suspended in memory",
      type: "text",
      answer: "stopped",
      alt: ["suspended", "stop", "paused"],
    },
    {
      id: "pid-make",
      title: "make PID",
      prompt: "Starter PID of <code>make sim</code>? (number)",
      hint: "3101",
      type: "text",
      answer: "3101",
      setup: () => loadStarter(),
    },
    {
      id: "busy-fg",
      title: "Busy fg",
      prompt: "With [1] still fg, try <code>sleep 5</code> (no &amp;) — lab should refuse (busy).",
      hint: "Do not Ctrl+Z first",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        lastCmd === "sleep 5" &&
        screen.some((r) => r.kind === "err" && /foreground busy/i.test(r.text)),
    },
    {
      id: "quiz-current",
      title: "Quiz: +",
      prompt: "In <code>jobs</code> output, <code>+</code> marks the? Answer: <code>current</code>",
      hint: "current job",
      type: "text",
      answer: "current",
      alt: ["current job", "+"],
    },
    {
      id: "timeline-check",
      title: "Timeline",
      prompt: "Cause any Ctrl+Z / fg / bg so the timeline updates, then Check.",
      hint: "Ctrl+Z is enough",
      type: "state",
      check: () => timeline.some((t) => /Ctrl\+Z|fg %|bg %/.test(t)),
    },
    {
      id: "quiz-vs-ps",
      title: "Quiz: jobs vs ps",
      prompt: "<code>jobs</code> shows only this shell's jobs; <code>ps</code> shows? Answer: <code>processes</code> or <code>system</code>",
      hint: "broader process list",
      type: "text",
      answer: "processes",
      alt: ["system", "all processes", "os", "system processes"],
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use jobs / fg / bg / Ctrl+Z, then Check.</span>`;
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

  document.getElementById("jc-starter").addEventListener("click", loadStarter);
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
