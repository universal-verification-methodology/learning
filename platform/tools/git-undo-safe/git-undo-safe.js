(() => {
  const FILES = ["rtl/top.v", "notes.txt"];

  const C1 = {
    id: "a1b2c3d",
    msg: "init rtl skeleton",
    files: {
      "rtl/top.v": "module top;\n  // stub\nendmodule\n",
      "notes.txt": "todo: wire alu\n",
    },
  };

  const C2 = {
    id: "e4f5a6b",
    msg: "wire alu into top",
    files: {
      "rtl/top.v": "module top;\n  alu u0();\nendmodule\n",
      "notes.txt": "todo: add tb\n",
    },
  };

  function makeStarter() {
    return {
      commits: [C2, C1], // [0] = HEAD tip
      index: {
        "rtl/top.v": "module top;\n  alu u0(); // BROKEN staged\nendmodule\n",
        "notes.txt": C2.files["notes.txt"],
      },
      work: {
        "rtl/top.v":
          "module top;\n  alu u0(); // BROKEN staged\n  // extra local edit\nendmodule\n",
        "notes.txt": "todo: add tb\nscratch pad\n",
      },
      published: false,
      selected: "rtl/top.v",
      lastAction: "",
      hardUsed: false,
      softUsed: false,
      mixedUsed: false,
      unstagedTop: false,
      restoredTop: false,
      forceAttempted: false,
      confirmDanger: false,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-git-undo-safe-cleared-v1";
  const STORE_KEY = "ddv-git-undo-safe-session-v1";

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
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("gu-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>rtl/top.v</code> is staged broken <em>and</em>
        has extra worktree edits; <code>notes.txt</code> has only unstaged edits.
        Unstage / restore safely — avoid hard reset unless you mean it.</p>
      <button type="button" class="btn btn-secondary" id="gu-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Three layers</h2></div>
        <div class="panel-body">
          <p class="commit-row" id="commit-row"></p>
          <div class="file-tabs" id="file-tabs"></div>
          <div class="legend-row">
            <span>green border = matches neighbor</span>
            <span>amber = differs from HEAD</span>
          </div>
          <div class="layers" id="layers"></div>
          <p class="status-row" id="status-row"></p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Undo actions</h2></div>
        <div class="panel-body">
          <div class="zone-grid">
            <div class="zone safe">
              <h3>Safe zone</h3>
              <p class="zone-lead">Keeps or moves changes without deleting history.</p>
              <div class="action-grid">
                <button type="button" id="btn-unstage" title="index ← HEAD">git restore --staged &lt;file&gt;</button>
                <button type="button" id="btn-restore" title="worktree ← index">git restore &lt;file&gt;</button>
                <button type="button" id="btn-soft" title="HEAD←prev; keep index+work">git reset --soft HEAD~1</button>
                <button type="button" id="btn-mixed" title="HEAD←prev; unstage; keep work">git reset HEAD~1</button>
              </div>
            </div>
            <div class="zone danger">
              <h3>Danger zone</h3>
              <p class="zone-lead">Can discard work or rewrite published history.</p>
              <label class="confirm-row">
                <input type="checkbox" id="confirm-danger" />
                I understand this can discard work
              </label>
              <div class="action-grid">
                <button type="button" class="danger" id="btn-hard" disabled>git reset --hard HEAD~1</button>
                <button type="button" class="danger" id="btn-force" disabled>git push --force</button>
              </div>
            </div>
          </div>
          <div class="risk-meter" id="risk-meter"></div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Command log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Goal</th><th>Safe command</th></tr></thead>
          <tbody>
            <tr><td>Unstage (keep edits)</td><td><code>git restore --staged path</code></td></tr>
            <tr><td>Discard worktree edits</td><td><code>git restore path</code> (matches index)</td></tr>
            <tr><td>Undo commit, keep staged</td><td><code>git reset --soft HEAD~1</code></td></tr>
            <tr><td>Undo commit, unstage, keep files</td><td><code>git reset</code> / <code>--mixed</code></td></tr>
            <tr><td>Throw away everything to prev</td><td><code>git reset --hard</code> — last resort</td></tr>
            <tr><td>Rewrite remote history</td><td><code>push --force</code> — avoid on shared branches</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Unstage ≠ discard: <code>restore --staged</code> only moves the index pointer.</li>
          <li>Prefer soft/mixed reset over hard when you still want the file contents.</li>
          <li>Never force-push <code>main</code> shared with teammates without agreement.</li>
        </ul>
      </div>
    </div>
  `;

  const layersEl = document.getElementById("layers");
  const fileTabs = document.getElementById("file-tabs");
  const commitRow = document.getElementById("commit-row");
  const statusRow = document.getElementById("status-row");
  const logBox = document.getElementById("log-box");
  const riskMeter = document.getElementById("risk-meter");
  const confirmDanger = document.getElementById("confirm-danger");
  const btnHard = document.getElementById("btn-hard");
  const btnForce = document.getElementById("btn-force");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function headFiles() {
    return state.commits[0].files;
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 50) state.log = state.log.slice(-40);
  }

  function fileFlags(path) {
    const h = headFiles()[path];
    const i = state.index[path];
    const w = state.work[path];
    return {
      staged: i !== h,
      dirty: w !== i,
      clean: i === h && w === i,
    };
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state,
          challengeIdx,
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
      if (!data || !data.state || !Array.isArray(data.state.commits)) return false;
      state = { ...makeStarter(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function renderTabs() {
    fileTabs.innerHTML = "";
    FILES.forEach((path) => {
      const f = fileFlags(path);
      const b = document.createElement("button");
      b.type = "button";
      b.className = path === state.selected ? "is-active" : "";
      let badge = "";
      if (f.staged && f.dirty) badge = '<span class="badge">staged+dirty</span>';
      else if (f.staged) badge = '<span class="badge">staged</span>';
      else if (f.dirty) badge = '<span class="badge">dirty</span>';
      b.innerHTML = escapeHtml(path) + badge;
      b.addEventListener("click", () => {
        state.selected = path;
        renderAll();
      });
      fileTabs.appendChild(b);
    });
  }

  function layerClass(content, compare) {
    if (content === compare) return "is-same";
    return "is-diff";
  }

  function renderLayers() {
    const path = state.selected;
    const h = headFiles()[path];
    const i = state.index[path];
    const w = state.work[path];
    layersEl.innerHTML = `
      <div class="layer ${layerClass(h, i)}">
        <h3>HEAD (commit)</h3>
        <div class="tag">${escapeHtml(state.commits[0].id.slice(0, 7))} · ${escapeHtml(state.commits[0].msg)}</div>
        <pre>${escapeHtml(h)}</pre>
      </div>
      <div class="layer ${layerClass(i, h)}">
        <h3>Index (staged)</h3>
        <div class="tag">${i === h ? "matches HEAD" : "differs from HEAD"}</div>
        <pre>${escapeHtml(i)}</pre>
      </div>
      <div class="layer ${layerClass(w, i)} ${state.hardUsed ? "is-danger" : ""}">
        <h3>Working tree</h3>
        <div class="tag">${w === i ? "matches index" : "uncommitted edits"}</div>
        <pre>${escapeHtml(w)}</pre>
      </div>
    `;
  }

  function renderStatus() {
    const tip = state.commits[0];
    const prev = state.commits[1];
    commitRow.innerHTML = `<strong>HEAD</strong> ${escapeHtml(tip.id.slice(0, 7))} “${escapeHtml(tip.msg)}”
      ${prev ? ` · parent ${escapeHtml(prev.id.slice(0, 7))}` : " · (root)"}
      ${state.published ? " · <strong>published</strong>" : " · not pushed"}`;

    const bits = FILES.map((p) => {
      const f = fileFlags(p);
      if (f.clean) return `${p}: clean`;
      const parts = [];
      if (f.staged) parts.push("staged");
      if (f.dirty) parts.push("dirty");
      return `${p}: ${parts.join("+")}`;
    });
    statusRow.innerHTML = `<strong>Status</strong> — ${escapeHtml(bits.join(" · "))}`;
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no commands yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderRisk() {
    const parts = [];
    if (state.unstagedTop || state.restoredTop || state.softUsed || state.mixedUsed) {
      parts.push('<span class="ok">safe undo used</span>');
    }
    if (state.hardUsed) parts.push('<span class="bad">hard reset used</span>');
    if (state.forceAttempted) parts.push('<span class="bad">force-push attempted</span>');
    if (state.published) parts.push('<span class="warn">tip marked published</span>');
    if (!parts.length) parts.push('<span>risk: idle</span>');
    riskMeter.innerHTML = parts.join("");
  }

  function syncDangerButtons() {
    const on = !!confirmDanger.checked;
    state.confirmDanger = on;
    btnHard.disabled = !on;
    btnForce.disabled = !on;
  }

  function renderAll() {
    renderTabs();
    renderLayers();
    renderStatus();
    renderLog();
    renderRisk();
    confirmDanger.checked = !!state.confirmDanger;
    syncDangerButtons();
    saveSession();
  }

  function loadStarter(fromRestore) {
    state = makeStarter();
    state.lastAction = fromRestore ? "restore-starter" : "load-starter";
    pushLog("muted", fromRestore ? "# restored starter tree" : "# loaded starter example");
    renderAll();
  }

  function doUnstage() {
    const path = state.selected;
    const h = headFiles()[path];
    state.index[path] = h;
    state.lastAction = "unstage";
    if (path === "rtl/top.v") state.unstagedTop = true;
    pushLog("ok", `$ git restore --staged ${path}`);
    pushLog("muted", `# index ← HEAD for ${path}`);
    renderAll();
  }

  function doRestore() {
    const path = state.selected;
    state.work[path] = state.index[path];
    state.lastAction = "restore";
    if (path === "rtl/top.v") state.restoredTop = true;
    pushLog("ok", `$ git restore ${path}`);
    pushLog("muted", `# working tree ← index for ${path}`);
    renderAll();
  }

  function doSoft() {
    if (state.commits.length < 2) {
      pushLog("warn", `# cannot reset: already at root`);
      state.lastAction = "soft-blocked";
      renderAll();
      return;
    }
    const dropped = state.commits[0];
    state.commits = state.commits.slice(1);
    // soft: keep index + work as they are (still contain dropped commit's tree + edits)
    state.lastAction = "soft";
    state.softUsed = true;
    pushLog("ok", `$ git reset --soft HEAD~1`);
    pushLog("muted", `# moved HEAD off ${dropped.id.slice(0, 7)}; index+work kept`);
    renderAll();
  }

  function doMixed() {
    if (state.commits.length < 2) {
      pushLog("warn", `# cannot reset: already at root`);
      state.lastAction = "mixed-blocked";
      renderAll();
      return;
    }
    const dropped = state.commits[0];
    state.commits = state.commits.slice(1);
    // mixed: index ← new HEAD; work kept
    const h = headFiles();
    FILES.forEach((p) => {
      state.index[p] = h[p];
    });
    state.lastAction = "mixed";
    state.mixedUsed = true;
    pushLog("ok", `$ git reset HEAD~1`);
    pushLog("muted", `# moved HEAD off ${dropped.id.slice(0, 7)}; unstaged; work kept`);
    renderAll();
  }

  function doHard() {
    if (!confirmDanger.checked) return;
    if (state.commits.length < 2) {
      pushLog("err", `# cannot hard-reset: already at root`);
      state.lastAction = "hard-blocked";
      renderAll();
      return;
    }
    const dropped = state.commits[0];
    state.commits = state.commits.slice(1);
    const h = headFiles();
    FILES.forEach((p) => {
      state.index[p] = h[p];
      state.work[p] = h[p];
    });
    state.lastAction = "hard";
    state.hardUsed = true;
    pushLog("err", `$ git reset --hard HEAD~1`);
    pushLog("warn", `# discarded staged+work; now at ${state.commits[0].id.slice(0, 7)}`);
    pushLog("muted", `# lost commit ${dropped.id.slice(0, 7)} from tip (reflog would still see it)`);
    renderAll();
  }

  function doForce() {
    if (!confirmDanger.checked) return;
    state.forceAttempted = true;
    state.lastAction = "force";
    if (state.published) {
      pushLog("err", `$ git push --force`);
      pushLog("err", `# refused in lab: tip is published — rewrites shared history`);
    } else {
      pushLog("warn", `$ git push --force`);
      pushLog("warn", `# tip not published yet — still risky habit; prefer --force-with-lease`);
      state.published = true;
    }
    renderAll();
  }

  document.getElementById("btn-unstage").addEventListener("click", doUnstage);
  document.getElementById("btn-restore").addEventListener("click", doRestore);
  document.getElementById("btn-soft").addEventListener("click", doSoft);
  document.getElementById("btn-mixed").addEventListener("click", doMixed);
  document.getElementById("btn-hard").addEventListener("click", doHard);
  document.getElementById("btn-force").addEventListener("click", doForce);
  confirmDanger.addEventListener("change", () => {
    syncDangerButtons();
    saveSession();
  });
  document.getElementById("gu-starter").addEventListener("click", () => loadStarter(false));

  // Mark published helper for challenges (via re-render path)
  function markPublished() {
    state.published = true;
    pushLog("muted", `# marked tip as published (as if pushed)`);
    renderAll();
  }

  const CHALLENGES = [
    {
      id: "quiz-unstage",
      title: "Quiz: unstage",
      prompt: "To unstage without losing edits, use? Answer: <code>restore --staged</code>",
      hint: "index ← HEAD",
      type: "text",
      answer: "restore --staged",
      alt: ["git restore --staged", "restore --staged path", "git restore --staged <file>"],
    },
    {
      id: "quiz-layers",
      title: "Quiz: layers",
      prompt: "Which layer is the staging area? Answer: <code>index</code>",
      hint: "between worktree and commit",
      type: "text",
      answer: "index",
      alt: ["staging", "staging area", "the index"],
    },
    {
      id: "do-unstage-top",
      title: "Unstage top",
      prompt: "Select <code>rtl/top.v</code> and run <strong>git restore --staged</strong> so index matches HEAD.",
      hint: "Safe zone → restore --staged",
      type: "state",
      setup: () => loadStarter(false),
      check: () => {
        const h = headFiles()["rtl/top.v"];
        return state.index["rtl/top.v"] === h && state.unstagedTop;
      },
    },
    {
      id: "quiz-restore",
      title: "Quiz: restore",
      prompt: "<code>git restore path</code> copies which → working tree? Answer: <code>index</code>",
      hint: "not HEAD unless index already matches HEAD",
      type: "text",
      answer: "index",
      alt: ["staging", "staged", "the index"],
    },
    {
      id: "restore-notes",
      title: "Restore notes",
      prompt: "Select <code>notes.txt</code> and <strong>git restore</strong> so worktree matches index (drop scratch).",
      hint: "File tab → restore",
      type: "state",
      setup: () => {
        loadStarter(false);
        state.selected = "notes.txt";
        renderAll();
      },
      check: () =>
        state.work["notes.txt"] === state.index["notes.txt"] &&
        state.lastAction === "restore",
    },
    {
      id: "quiz-soft",
      title: "Quiz: soft",
      prompt: "<code>reset --soft HEAD~1</code> moves HEAD but keeps? Answer: <code>index and work</code>",
      hint: "everything still staged as before tip",
      type: "text",
      answer: "index and work",
      alt: ["index+work", "staged and worktree", "index + worktree", "both"],
    },
    {
      id: "do-soft",
      title: "Soft reset",
      prompt: "From starter, run <strong>git reset --soft HEAD~1</strong> — HEAD becomes parent; files stay dirty/staged.",
      hint: "Safe zone soft button",
      type: "state",
      setup: () => loadStarter(false),
      check: () =>
        state.softUsed &&
        state.commits[0].id === C1.id &&
        state.index["rtl/top.v"] !== C1.files["rtl/top.v"],
    },
    {
      id: "quiz-mixed",
      title: "Quiz: mixed",
      prompt: "Default <code>git reset HEAD~1</code> is? Answer: <code>mixed</code>",
      hint: "unstage, keep worktree",
      type: "text",
      answer: "mixed",
      alt: ["--mixed", "reset --mixed"],
    },
    {
      id: "do-mixed",
      title: "Mixed reset",
      prompt: "Load starter, run <strong>git reset HEAD~1</strong> — index matches new HEAD; worktree edits remain.",
      hint: "mixed button",
      type: "state",
      setup: () => loadStarter(false),
      check: () => {
        if (!state.mixedUsed || state.commits[0].id !== C1.id) return false;
        const h = headFiles();
        return (
          state.index["rtl/top.v"] === h["rtl/top.v"] &&
          state.work["rtl/top.v"] !== h["rtl/top.v"]
        );
      },
    },
    {
      id: "quiz-hard",
      title: "Quiz: hard",
      prompt: "<code>reset --hard</code> discards? Answer: <code>index and work</code>",
      hint: "everything back to target commit",
      type: "text",
      answer: "index and work",
      alt: ["staged and unstaged", "everything", "all changes", "index + worktree"],
    },
    {
      id: "hard-needs-confirm",
      title: "Hard gated",
      prompt: "Hard reset stays disabled until you check the danger checkbox. Confirm understanding: answer <code>yes</code>",
      hint: "lab safety lock",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "do-hard",
      title: "Hard reset",
      prompt: "Check the danger box, then <strong>reset --hard HEAD~1</strong> — working tree clean at parent.",
      hint: "Confirm → hard",
      type: "state",
      setup: () => loadStarter(false),
      check: () => {
        if (!state.hardUsed || state.commits[0].id !== C1.id) return false;
        const h = headFiles();
        return (
          state.index["rtl/top.v"] === h["rtl/top.v"] &&
          state.work["rtl/top.v"] === h["rtl/top.v"] &&
          state.work["notes.txt"] === h["notes.txt"]
        );
      },
    },
    {
      id: "quiz-force",
      title: "Quiz: force",
      prompt: "Force-pushing shared <code>main</code> is usually? Answer: <code>bad</code>",
      hint: "rewrites others' history",
      type: "text",
      answer: "bad",
      alt: ["dangerous", "avoid", "no", "unsafe"],
    },
    {
      id: "force-published",
      title: "Force blocked",
      prompt: "Mark tip published (use force once on unpublished, or Check after published refuse). Prefer: load starter, soft-reset? Simpler: check danger, push --force twice — second attempt on published tip.",
      hint: "force once publishes; force again → refused",
      type: "state",
      setup: () => {
        loadStarter(false);
        state.published = true;
        state.confirmDanger = true;
        pushLog("muted", "# tip pre-marked published for this challenge");
        renderAll();
      },
      check: () =>
        state.forceAttempted &&
        state.published &&
        state.log.some((l) => /refused in lab: tip is published/i.test(l.text)),
    },
    {
      id: "prefer-soft",
      title: "Prefer soft",
      prompt: "You committed too early but want to keep changes staged. Prefer? Answer: <code>soft</code>",
      hint: "not hard",
      type: "text",
      answer: "soft",
      alt: ["--soft", "reset --soft", "git reset --soft"],
    },
    {
      id: "unstage-keeps-work",
      title: "Unstage keeps work",
      prompt: "After unstaging <code>rtl/top.v</code> from starter, worktree should still contain “extra local edit”.",
      hint: "Unstage only — don't restore yet",
      type: "state",
      setup: () => loadStarter(false),
      check: () => {
        const h = headFiles()["rtl/top.v"];
        return (
          state.index["rtl/top.v"] === h &&
          /extra local edit/.test(state.work["rtl/top.v"])
        );
      },
    },
    {
      id: "full-clean-top",
      title: "Clean top safely",
      prompt: "On starter <code>rtl/top.v</code>: unstage, then restore — file clean vs HEAD.",
      hint: "restore --staged, then restore",
      type: "state",
      setup: () => {
        loadStarter(false);
        state.selected = "rtl/top.v";
        renderAll();
      },
      check: () => {
        const h = headFiles()["rtl/top.v"];
        return (
          state.index["rtl/top.v"] === h &&
          state.work["rtl/top.v"] === h &&
          state.unstagedTop &&
          state.restoredTop
        );
      },
    },
    {
      id: "quiz-checkout-old",
      title: "Quiz: old habit",
      prompt: "Old <code>git checkout -- file</code> is now? Answer: <code>git restore</code>",
      hint: "modern porcelain",
      type: "text",
      answer: "git restore",
      alt: ["restore", "git restore file", "git restore <file>"],
    },
    {
      id: "quiz-reset-path",
      title: "Quiz: path unstage",
      prompt: "Modern unstage for one path? Answer: <code>git restore --staged</code>",
      hint: "not git reset HEAD file (still works, older style)",
      type: "text",
      answer: "git restore --staged",
      alt: ["restore --staged", "git restore --staged path"],
    },
    {
      id: "soft-then-unstage",
      title: "Soft then fix",
      prompt: "Soft-reset once, then unstage <code>rtl/top.v</code> so index matches new HEAD.",
      hint: "soft → select top → restore --staged",
      type: "state",
      setup: () => loadStarter(false),
      check: () => {
        if (!state.softUsed || state.commits[0].id !== C1.id) return false;
        return state.index["rtl/top.v"] === headFiles()["rtl/top.v"];
      },
    },
    {
      id: "count-commits-start",
      title: "Starter depth",
      prompt: "Starter history has how many commits? (number)",
      hint: "tip + parent",
      type: "text",
      answer: "2",
      setup: () => loadStarter(false),
    },
    {
      id: "never-hard-first",
      title: "Habit check",
      prompt: "First instinct for “undo last commit but keep work”? Answer: <code>soft</code> or <code>mixed</code>",
      hint: "not hard",
      type: "text",
      answer: "soft",
      alt: ["mixed", "--soft", "--mixed", "reset --soft", "reset --mixed"],
    },
  ];

  // expose markPublished for potential future; silence unused
  void markPublished;

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[“”]/g, '"');
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent =
      `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint
      ? "Hide hint"
      : "Show hint";
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
        saveSession();
      });
      cat.appendChild(b);
    });
    saveSession();
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
