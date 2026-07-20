(() => {
  /**
   * @typedef {{ path: string, dir: boolean, kind: 'keep'|'safe', present: boolean }} Entry
   */

  function makeStarter() {
    /** @type {Entry[]} */
    return [
      { path: "chip/", dir: true, kind: "keep", present: true },
      { path: "chip/Makefile", dir: false, kind: "keep", present: true },
      { path: "chip/README.md", dir: false, kind: "keep", present: true },
      { path: "chip/rtl/", dir: true, kind: "keep", present: true },
      { path: "chip/rtl/top.v", dir: false, kind: "keep", present: true },
      { path: "chip/rtl/alu.v", dir: false, kind: "keep", present: true },
      { path: "chip/tb/", dir: true, kind: "keep", present: true },
      { path: "chip/tb/tb_top.v", dir: false, kind: "keep", present: true },
      { path: "chip/docs/", dir: true, kind: "keep", present: true },
      { path: "chip/docs/spec.md", dir: false, kind: "keep", present: true },
      { path: "chip/build/", dir: true, kind: "safe", present: true },
      { path: "chip/build/out.vvp", dir: false, kind: "safe", present: true },
      { path: "chip/build/wave.vcd", dir: false, kind: "safe", present: true },
      { path: "chip/logs/", dir: true, kind: "safe", present: true },
      { path: "chip/logs/sim.log", dir: false, kind: "safe", present: true },
      { path: "chip/sim.vcd", dir: false, kind: "safe", present: true },
    ];
  }

  const CLEARED_KEY = "ddv-backup-clean-cleared-v1";
  const STORE_KEY = "ddv-backup-clean-session-v1";

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

  /** @type {Entry[]} */
  let entries = makeStarter();
  /** @type {string|null} */
  let backupName = null;
  /** @type {string[]} */
  let backupContents = [];
  let cleaned = false;
  let lastDryRun = false;
  let lastAction = "";
  /** @type {{kind:string,text:string}[]} */
  let log = [];

  const root = document.getElementById("bc-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Project has source plus generated
        <code>build/</code>, <code>logs/</code>, and a root <code>sim.vcd</code>.
        Backup first, dry-run clean, then clean for real.</p>
      <button type="button" class="btn btn-secondary" id="bc-starter">Load starter example</button>
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
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Safe workflow</h2></div>
      <div class="panel-body">
        <div class="flow" id="flow">
          <span data-step="backup">1. Backup</span>
          <span class="sep">→</span>
          <span data-step="dry">2. Dry-run clean</span>
          <span class="sep">→</span>
          <span data-step="clean">3. Clean</span>
          <span class="sep">→</span>
          <span data-step="verify">4. Verify source remains</span>
        </div>
        <div class="classify-grid">
          <div class="classify-card">
            <h3>Safe to delete</h3>
            <ul>
              <li><code>build/</code> sim binaries</li>
              <li><code>logs/</code> run logs</li>
              <li><code>*.vcd</code> waveforms</li>
            </ul>
          </div>
          <div class="classify-card">
            <h3>Keep (never wipe)</h3>
            <ul>
              <li><code>rtl/</code> · <code>tb/</code> · <code>docs/</code></li>
              <li><code>Makefile</code> · <code>README.md</code></li>
              <li>Anything you cannot regenerate</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Project tree</h2></div>
        <div class="panel-body">
          <div class="legend">
            <span><span class="keep">keep</span> = source</span>
            <span><span class="safe">safe</span> = generated</span>
          </div>
          <pre class="tree-view" id="tree-view"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Actions</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <div class="action-grid">
            <button type="button" id="btn-backup">Backup → timestamped tar.gz</button>
            <button type="button" id="btn-dry">Clean --dry-run (preview only)</button>
            <button type="button" class="danger" id="btn-clean">Clean for real (needs backup)</button>
            <button type="button" id="btn-restore">Restore tree from starter</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Backup artifact</h3>
          <pre class="backup-box" id="backup-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Step</th><th>Example</th></tr></thead>
          <tbody>
            <tr><td>Backup</td><td><code>tar czf backup_$(date +%Y%m%d).tar.gz chip/</code></td></tr>
            <tr><td>Dry-run</td><td><code>./clean.sh --dry-run</code> (list only)</td></tr>
            <tr><td>Clean</td><td><code>rm -rf build logs *.vcd</code> (after backup)</td></tr>
            <tr><td>Verify</td><td><code>ls rtl tb Makefile</code> still present</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Clean-build means remove <em>generated</em> artifacts so the next build is fresh — not delete the project.</li>
          <li>If unsure, dry-run first. If still unsure, backup first.</li>
        </ul>
      </div>
    </div>
  `;

  const treeEl = document.getElementById("tree-view");
  const backupBox = document.getElementById("backup-box");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");
  const flowEl = document.getElementById("flow");
  const btnClean = document.getElementById("btn-clean");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function stamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  function pushLog(kind, text) {
    log.push({ kind, text });
    if (log.length > 60) log = log.slice(-50);
  }

  function safeTargets() {
    return entries.filter((e) => e.kind === "safe" && e.present);
  }

  function keepPresent() {
    return entries.filter((e) => e.kind === "keep" && e.present);
  }

  function renderTree() {
    treeEl.innerHTML = entries
      .map((e) => {
        const cls = [
          e.dir ? "dir" : "",
          e.kind === "safe" ? "safe" : "keep",
          e.present ? "" : "gone",
        ]
          .filter(Boolean)
          .join(" ");
        const mark = e.present ? "" : " (removed)";
        return `<span class="${cls}">${escapeHtml(e.path)}${mark}</span>`;
      })
      .join("\n");
  }

  function renderBackup() {
    if (!backupName) {
      backupBox.innerHTML = `<span class="muted">(no backup yet)</span>`;
      return;
    }
    backupBox.textContent = `${backupName}\n${backupContents.length} paths saved\n` + backupContents.slice(0, 8).join("\n") + (backupContents.length > 8 ? "\n…" : "");
  }

  function renderLog() {
    logBox.innerHTML = log.length
      ? log
          .map((r) => `<div class="${r.kind}">${escapeHtml(r.text)}</div>`)
          .join("")
      : `<div class="muted">Actions appear here</div>`;
    logBox.scrollTop = logBox.scrollHeight;
  }

  function renderFlow() {
    const hasBackup = !!backupName;
    const hasDry = lastDryRun || log.some((l) => /dry-run/i.test(l.text));
    const steps = {
      backup: hasBackup,
      dry: hasDry,
      clean: cleaned,
      verify: cleaned && keepPresent().length > 0 && safeTargets().length === 0,
    };
    let current = "backup";
    if (hasBackup && !hasDry) current = "dry";
    else if (hasDry && !cleaned) current = "clean";
    else if (cleaned) current = "verify";

    flowEl.querySelectorAll("[data-step]").forEach((el) => {
      const key = el.getAttribute("data-step");
      el.classList.remove("done", "now");
      if (steps[key]) el.classList.add("done");
      if (key === current && !steps.verify) el.classList.add("now");
      if (steps.verify && key === "verify") el.classList.add("done", "now");
    });

    statusRow.innerHTML = `<strong>Backup:</strong> ${backupName ? escapeHtml(backupName) : "none"} ·
      <strong>Cleaned:</strong> ${cleaned ? "yes" : "no"} ·
      <strong>Safe left:</strong> ${safeTargets().length}`;
    btnClean.disabled = false;
    btnClean.title = backupName ? "Remove generated artifacts" : "Will refuse until you backup";
  }

  function renderAll() {
    renderTree();
    renderBackup();
    renderLog();
    renderFlow();
  }

  function doBackup() {
    backupName = `backup_${stamp()}.tar.gz`;
    backupContents = entries.filter((e) => e.present).map((e) => e.path);
    lastAction = "backup";
    pushLog("ok", `tar czf ${backupName} chip/  (${backupContents.length} paths)`);
    pushLog("muted", "Backup complete — safe to preview a clean next.");
    renderAll();
    saveSession();
  }

  function doDryRun() {
    lastDryRun = true;
    lastAction = "dry-run";
    const targets = safeTargets();
    pushLog("warn", `./clean.sh --dry-run`);
    if (!targets.length) {
      pushLog("muted", "[dry-run] nothing to remove (already clean)");
    } else {
      targets.forEach((t) => pushLog("warn", `[dry-run] would remove ${t.path}`));
      pushLog("muted", `[dry-run] ${targets.length} path(s) — run clean for real after backup`);
    }
    renderAll();
    saveSession();
  }

  function doClean() {
    if (!backupName) {
      pushLog("err", "Refused: make a backup first (lab safety lock)");
      lastAction = "clean-blocked";
      renderAll();
      saveSession();
      return;
    }
    lastAction = "clean";
    const targets = safeTargets();
    targets.forEach((t) => {
      t.present = false;
      pushLog("ok", `removed ${t.path}`);
    });
    cleaned = true;
    // ensure keep files still present
    entries.forEach((e) => {
      if (e.kind === "keep") e.present = true;
    });
    pushLog("ok", `Clean done — ${keepPresent().length} source paths remain`);
    renderAll();
    saveSession();
  }

  function loadStarter(asRestore) {
    entries = makeStarter();
    backupName = null;
    backupContents = [];
    cleaned = false;
    lastDryRun = false;
    lastAction = asRestore ? "restore" : "";
    log = [{ kind: "muted", text: "Starter loaded — backup → dry-run → clean" }];
    renderAll();
    saveSession();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          entries,
          backupName,
          backupContents,
          cleaned,
          lastDryRun,
          lastAction,
          log: log.slice(-40),
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
      if (!Array.isArray(data.entries) || !data.entries.length) return false;
      entries = data.entries;
      backupName = data.backupName || null;
      backupContents = Array.isArray(data.backupContents) ? data.backupContents : [];
      cleaned = !!data.cleaned;
      lastDryRun = !!data.lastDryRun;
      lastAction = data.lastAction || "";
      log = Array.isArray(data.log) ? data.log : [];
      return true;
    } catch {
      return false;
    }
  }

  document.getElementById("btn-backup").addEventListener("click", doBackup);
  document.getElementById("btn-dry").addEventListener("click", doDryRun);
  document.getElementById("btn-clean").addEventListener("click", doClean);
  document.getElementById("btn-restore").addEventListener("click", () => loadStarter(true));
  document.getElementById("bc-starter").addEventListener("click", () => loadStarter(false));

  const CHALLENGES = [
    {
      id: "quiz-order",
      title: "Quiz: order",
      prompt: "Before cleaning generated files, first make a? Answer: <code>backup</code>",
      hint: "timestamped archive",
      type: "text",
      answer: "backup",
      alt: ["archive", "tar", "backup first"],
    },
    {
      id: "do-backup",
      title: "Make backup",
      prompt: "Click <strong>Backup</strong> so a <code>backup_YYYYMMDD.tar.gz</code> appears.",
      hint: "Backup button",
      type: "state",
      check: () => !!backupName && /^backup_\d{8}\.tar\.gz$/.test(backupName),
    },
    {
      id: "quiz-safe",
      title: "Quiz: safe",
      prompt: "Which is safe to delete? Answer: <code>build/</code>",
      hint: "generated sim outputs",
      type: "text",
      answer: "build/",
      alt: ["build", "logs", "logs/", "*.vcd", "vcd"],
    },
    {
      id: "quiz-keep",
      title: "Quiz: keep",
      prompt: "Which must you keep? Answer: <code>rtl/</code> or <code>Makefile</code>",
      hint: "source / build recipe",
      type: "text",
      answer: "rtl/",
      alt: ["rtl", "makefile", "tb/", "tb", "readme"],
    },
    {
      id: "dry-run",
      title: "Dry-run",
      prompt: "Run <strong>Clean --dry-run</strong> — log should list would-remove paths.",
      hint: "Dry-run button",
      type: "state",
      check: () => lastDryRun && log.some((l) => /\[dry-run\] would remove/i.test(l.text)),
    },
    {
      id: "clean-blocked",
      title: "Clean blocked",
      prompt: "Without a backup, Clean for real should be refused (or button disabled). Reset, try clean.",
      hint: "Load starter, click Clean without Backup",
      type: "state",
      setup: () => {
        backupName = null;
        backupContents = [];
        cleaned = false;
        entries = makeStarter();
        renderAll();
      },
      check: () => lastAction === "clean-blocked",
    },
    {
      id: "full-clean",
      title: "Full clean",
      prompt: "Backup, then Clean for real — all <em>safe</em> paths removed, source kept.",
      hint: "Backup → Clean",
      type: "state",
      check: () =>
        cleaned &&
        !!backupName &&
        safeTargets().length === 0 &&
        entries.some((e) => e.path === "chip/rtl/top.v" && e.present) &&
        entries.some((e) => e.path === "chip/Makefile" && e.present),
    },
    {
      id: "vcd-safe",
      title: "VCD safe?",
      prompt: "Is <code>sim.vcd</code> safe to delete? Answer: <code>yes</code>",
      hint: "waveforms are generated",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "makefile-keep",
      title: "Makefile keep?",
      prompt: "Is <code>Makefile</code> safe to delete in a clean-build? Answer: <code>no</code>",
      hint: "You need it to rebuild",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "quiz-dry",
      title: "Quiz: dry-run",
      prompt: "Dry-run means? Answer: <code>preview</code> or <code>list only</code>",
      hint: "show what would be deleted",
      type: "text",
      answer: "preview",
      alt: ["list only", "list", "simulate", "print only"],
    },
    {
      id: "backup-has-rtl",
      title: "Backup has rtl",
      prompt: "After Backup, contents should include <code>chip/rtl/top.v</code>.",
      hint: "Make a backup",
      type: "state",
      check: () => backupContents.includes("chip/rtl/top.v"),
    },
    {
      id: "backup-has-build",
      title: "Backup has build",
      prompt: "A full-tree backup also saves build artifacts (for rollback). Does starter backup include <code>chip/build/out.vvp</code>?",
      hint: "Backup then Check — answer yes conceptually via state",
      type: "state",
      check: () => backupContents.includes("chip/build/out.vvp"),
    },
    {
      id: "after-clean-no-vvp",
      title: "No vvp after",
      prompt: "After a real clean, <code>chip/build/out.vvp</code> should be gone.",
      hint: "Backup → Clean",
      type: "state",
      check: () => {
        const e = entries.find((x) => x.path === "chip/build/out.vvp");
        return cleaned && e && !e.present;
      },
    },
    {
      id: "tb-remains",
      title: "tb remains",
      prompt: "After clean, <code>chip/tb/tb_top.v</code> must still be present.",
      hint: "Complete a clean",
      type: "state",
      check: () => {
        const e = entries.find((x) => x.path === "chip/tb/tb_top.v");
        return cleaned && e && e.present;
      },
    },
    {
      id: "quiz-clean-build",
      title: "Quiz: clean-build",
      prompt: "Clean-build removes? Answer: <code>generated</code> files",
      hint: "artifacts you can recreate",
      type: "text",
      answer: "generated",
      alt: ["artifacts", "build artifacts", "generated files", "outputs"],
    },
    {
      id: "stamp-format",
      title: "Stamp format",
      prompt: "Lab backup name uses date like? Answer: <code>YYYYMMDD</code>",
      hint: "backup_20260720.tar.gz",
      type: "text",
      answer: "yyyymmdd",
      alt: ["%y%m%d", "date +%y%m%d", "yyyy-mm-dd"],
    },
    {
      id: "count-safe",
      title: "Count safe",
      prompt: "Starter: how many <em>safe</em> paths (files+dirs)? (number)",
      hint: "build/ + 2 files + logs/ + sim.log + sim.vcd = 6",
      type: "text",
      answer: "6",
      setup: () => loadStarter(),
    },
    {
      id: "workflow-order",
      title: "Workflow",
      prompt: "Correct order letters: B=backup, D=dry-run, C=clean. Answer: <code>BDC</code>",
      hint: "Backup → Dry-run → Clean",
      type: "text",
      answer: "bdc",
      alt: ["b-d-c", "backup dry clean"],
    },
    {
      id: "restore",
      title: "Restore",
      prompt: "After cleaning, click Restore / Load starter so safe files return.",
      hint: "Restore tree from starter",
      type: "state",
      check: () =>
        lastAction === "restore" &&
        entries.some((e) => e.path === "chip/build/out.vvp" && e.present),
    },
    {
      id: "quiz-logs",
      title: "Quiz: logs",
      prompt: "Are <code>logs/</code> usually safe to delete? Answer: <code>yes</code>",
      hint: "regenerated on next run",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "refuse-without",
      title: "Safety lock",
      prompt: "Lab refuses clean without backup — good habit? Answer: <code>yes</code>",
      hint: "yes",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "verify-flow",
      title: "Verify flow",
      prompt: "Complete backup + dry-run + clean so the workflow shows verify done.",
      hint: "Do all three actions in order",
      type: "state",
      check: () =>
        !!backupName &&
        lastDryRun &&
        cleaned &&
        safeTargets().length === 0 &&
        keepPresent().length >= 8,
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the actions panel, then Check.</span>`;
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

  if (!loadSession()) loadStarter(false);
  else renderAll();
  renderChallenge();
})();
