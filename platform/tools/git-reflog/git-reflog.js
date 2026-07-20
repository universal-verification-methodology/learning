(() => {
  const C0 = { id: "f99aa01", msg: "init: skeleton" };
  const C1 = { id: "e0a11c3", msg: "rtl: wire alu" };
  const C2 = { id: "d71bb02", msg: "tb: cover add/sub" };
  const C3 = { id: "c4d10aa", msg: "alu: add mul path" };

  function makeStarter() {
    // HEAD at C3, history C3→C2→C1→C0
    const commits = {
      [C0.id]: { ...C0, parent: null },
      [C1.id]: { ...C1, parent: C0.id },
      [C2.id]: { ...C2, parent: C1.id },
      [C3.id]: { ...C3, parent: C2.id },
    };
    return {
      commits,
      head: C3.id,
      branch: "main",
      branches: { main: C3.id, recover: null },
      /** @type {{ at: string, action: string }[]} newest first = HEAD@{0} */
      reflog: [
        { at: C3.id, action: "commit: alu: add mul path" },
        { at: C2.id, action: "commit: tb: cover add/sub" },
        { at: C1.id, action: "commit: rtl: wire alu" },
        { at: C0.id, action: "commit: init: skeleton" },
      ],
      selectedRef: 0,
      lastAction: "",
      hardReset: false,
      recoveredReset: false,
      recoveredBranch: false,
      committedExtra: false,
      log: [],
      nextId: 1,
    };
  }

  const CLEARED_KEY = "ddv-git-reflog-cleared-v1";
  const STORE_KEY = "ddv-git-reflog-session-v1";

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

  const root = document.getElementById("rf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>main</code> tip is mul commit
        <code>c4d10aa</code>. Hard-reset to drop it, then recover via reflog
        (<code>HEAD@{1}</code>) or a recovery branch.</p>
      <button type="button" class="btn btn-secondary" id="rf-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Idea</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Reflog</h3>
            <p>Local diary of where <code>HEAD</code> pointed. Survives “lost” commits after reset/rebase.</p>
          </div>
          <div class="idea-card">
            <h3>Not on remote</h3>
            <p>Reflog is per-clone and expires. Push recovery branches if teammates need the commit.</p>
          </div>
        </div>
        <div class="scenario-row" id="scenario-row"></div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Branch tip</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <pre class="branch-box" id="branch-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Reflog &amp; recover</h2></div>
        <div class="panel-body">
          <div class="action-grid">
            <button type="button" class="danger" id="btn-hard">git reset --hard HEAD~1</button>
            <button type="button" id="btn-commit">git commit (dummy WIP)</button>
            <button type="button" id="btn-reset-ref">git reset --hard HEAD@{n}</button>
            <button type="button" id="btn-branch">git branch recover &lt;sha&gt;</button>
            <button type="button" id="btn-checkout-main">checkout main tip</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">git reflog</h3>
          <pre class="reflog-box" id="reflog-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Situation</th><th>Move</th></tr></thead>
          <tbody>
            <tr><td>See recent HEAD moves</td><td><code>git reflog</code></td></tr>
            <tr><td>Undo hard reset (move tip back)</td><td><code>git reset --hard HEAD@{1}</code></td></tr>
            <tr><td>Keep current tip + save lost commit</td><td><code>git branch recover &lt;sha&gt;</code></td></tr>
            <tr><td>After rebase “lost” commits</td><td>Same idea — find old tip in reflog</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li><code>HEAD@{0}</code> is where you are now; <code>HEAD@{1}</code> is the previous tip.</li>
          <li>A commit with no branch pointing at it looks gone from <code>git log</code> — reflog still knows.</li>
          <li>Recover soon; reflog entries expire (often ~90 days).</li>
        </ul>
      </div>
    </div>
  `;

  const branchBox = document.getElementById("branch-box");
  const reflogBox = document.getElementById("reflog-box");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 50) state.log = state.log.slice(-40);
  }

  function appendReflog(at, action) {
    state.reflog.unshift({ at, action });
  }

  function reachableFrom(tip) {
    const seen = new Set();
    let cur = tip;
    while (cur && state.commits[cur] && !seen.has(cur)) {
      seen.add(cur);
      cur = state.commits[cur].parent;
    }
    return seen;
  }

  function allBranchTips() {
    return Object.values(state.branches).filter(Boolean);
  }

  function isOrphan(id) {
    const reach = new Set();
    allBranchTips().forEach((tip) => {
      reachableFrom(tip).forEach((x) => reach.add(x));
    });
    // also HEAD
    reachableFrom(state.head).forEach((x) => reach.add(x));
    return !reach.has(id);
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function renderBranch() {
    const lines = [];
    lines.push(`<span class="head">HEAD → ${escapeHtml(state.branch)} @ ${escapeHtml(state.head)}</span>`);
    Object.entries(state.branches).forEach(([name, tip]) => {
      if (!tip) return;
      lines.push(`branch ${escapeHtml(name)} → <span class="hash">${escapeHtml(tip)}</span>`);
    });
    lines.push("");
    // show ancestry from HEAD
    let cur = state.head;
    const seen = new Set();
    while (cur && state.commits[cur] && !seen.has(cur)) {
      seen.add(cur);
      const c = state.commits[cur];
      const orphan = isOrphan(cur) ? " orphan" : "";
      lines.push(
        `<span class="commit${orphan}"><span class="hash">${c.id}</span> ${escapeHtml(c.msg)}${
          orphan ? " (unreachable from branches)" : ""
        }</span>`
      );
      cur = c.parent;
    }
    // mention known orphans from reflog
    const orphans = Object.keys(state.commits).filter((id) => isOrphan(id));
    if (orphans.length) {
      lines.push("");
      lines.push("dangling (not on any branch tip ancestry):");
      orphans.forEach((id) => {
        const c = state.commits[id];
        lines.push(
          `<span class="orphan"><span class="hash">${c.id}</span> ${escapeHtml(c.msg)}</span>`
        );
      });
    }
    branchBox.innerHTML = lines.join("\n");
    statusRow.innerHTML = `<strong>${escapeHtml(state.branch)}</strong> @ ${escapeHtml(
      state.head
    )} · reflog depth ${state.reflog.length}`;
  }

  function renderReflog() {
    if (!state.reflog.length) {
      reflogBox.innerHTML = '<span class="empty">(empty)</span>';
      return;
    }
    reflogBox.innerHTML = "";
    state.reflog.forEach((e, i) => {
      const b = document.createElement("button");
      b.type = "button";
      if (i === state.selectedRef) b.classList.add("is-selected");
      b.innerHTML = `<span class="idx">HEAD@{${i}}</span>: <span class="hash">${escapeHtml(
        e.at
      )}</span> ${escapeHtml(e.action)}`;
      b.addEventListener("click", () => {
        state.selectedRef = i;
        renderReflog();
        saveSession();
      });
      reflogBox.appendChild(b);
    });
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

  function renderAll() {
    renderBranch();
    renderReflog();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# loaded starter — tip is mul commit c4d10aa");
    renderAll();
  }

  function doHardReset() {
    const cur = state.commits[state.head];
    if (!cur || !cur.parent) {
      pushLog("warn", `# already at root`);
      state.lastAction = "hard-root";
      renderAll();
      return;
    }
    const prev = state.head;
    state.head = cur.parent;
    state.branches[state.branch] = state.head;
    appendReflog(state.head, `reset: moving to HEAD~1 (was ${prev})`);
    state.hardReset = true;
    state.lastAction = "hard";
    pushLog("err", `$ git reset --hard HEAD~1`);
    pushLog("warn", `# tip moved to ${state.head}; ${prev} looks lost from git log`);
    renderAll();
  }

  function doCommit() {
    const id = "x" + String(1000 + state.nextId).slice(1);
    state.nextId += 1;
    const msg = "wip: scratch " + id;
    state.commits[id] = { id, msg, parent: state.head };
    state.head = id;
    state.branches[state.branch] = id;
    appendReflog(id, "commit: " + msg);
    state.committedExtra = true;
    state.lastAction = "commit";
    pushLog("ok", `$ git commit -m "${msg}"`);
    renderAll();
  }

  function doResetToRef() {
    const i = state.selectedRef;
    const entry = state.reflog[i];
    if (!entry) {
      pushLog("warn", `# select a reflog entry`);
      state.lastAction = "reset-ref-empty";
      renderAll();
      return;
    }
    state.head = entry.at;
    state.branches[state.branch] = entry.at;
    appendReflog(entry.at, `reset: moving to HEAD@{${i}}`);
    state.recoveredReset = true;
    state.lastAction = "reset-ref";
    pushLog("ok", `$ git reset --hard HEAD@{${i}}`);
    pushLog("muted", `# HEAD now ${entry.at}`);
    renderAll();
  }

  function doRecoverBranch() {
    const i = state.selectedRef;
    const entry = state.reflog[i];
    if (!entry) {
      pushLog("warn", `# select a reflog entry`);
      state.lastAction = "branch-empty";
      renderAll();
      return;
    }
    state.branches.recover = entry.at;
    state.recoveredBranch = true;
    state.lastAction = "branch-recover";
    // reflog notes checkout/branch creation lightly
    appendReflog(state.head, `branch: created recover at ${entry.at}`);
    pushLog("ok", `$ git branch recover ${entry.at}`);
    pushLog("muted", `# commit reachable again via branch recover`);
    renderAll();
  }

  function checkoutMain() {
    if (!state.branches.main) return;
    state.branch = "main";
    state.head = state.branches.main;
    appendReflog(state.head, "checkout: moving from recover to main");
    state.lastAction = "checkout-main";
    pushLog("ok", `$ git checkout main`);
    renderAll();
  }

  function accidentScenario() {
    loadStarter();
    doHardReset();
    pushLog("muted", "# scenario: accidental hard reset (mul dangling)");
    state.lastAction = "scenario-accident";
    renderAll();
  }

  const scenarioRow = document.getElementById("scenario-row");
  [
    ["Starter tip", () => loadStarter()],
    ["Accident: hard reset", () => accidentScenario()],
  ].forEach(([label, fn]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", fn);
    scenarioRow.appendChild(b);
  });

  document.getElementById("btn-hard").addEventListener("click", doHardReset);
  document.getElementById("btn-commit").addEventListener("click", doCommit);
  document.getElementById("btn-reset-ref").addEventListener("click", doResetToRef);
  document.getElementById("btn-branch").addEventListener("click", doRecoverBranch);
  document.getElementById("btn-checkout-main").addEventListener("click", checkoutMain);
  document.getElementById("rf-starter").addEventListener("click", loadStarter);

  const CHALLENGES = [
    {
      id: "quiz-what",
      title: "Quiz: what",
      prompt: "Reflog records where? Answer: <code>HEAD</code> pointed",
      hint: "local HEAD history",
      type: "text",
      answer: "head",
      alt: ["HEAD", "where HEAD pointed", "head positions"],
    },
    {
      id: "quiz-local",
      title: "Quiz: local",
      prompt: "Is reflog shared via push? Answer: <code>no</code>",
      hint: "per-clone",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "quiz-zero",
      title: "Quiz: @{0}",
      prompt: "<code>HEAD@{0}</code> is? Answer: <code>current</code>",
      hint: "newest reflog entry",
      type: "text",
      answer: "current",
      alt: ["now", "current tip", "where you are"],
    },
    {
      id: "starter-tip",
      title: "Starter tip",
      prompt: "Load starter — HEAD should be <code>c4d10aa</code>.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.head === C3.id,
    },
    {
      id: "do-hard",
      title: "Hard reset",
      prompt: "Run <strong>reset --hard HEAD~1</strong> — tip becomes <code>d71bb02</code>; mul is dangling.",
      hint: "danger button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.hardReset &&
        state.head === C2.id &&
        isOrphan(C3.id),
    },
    {
      id: "reflog-has-mul",
      title: "Reflog remembers",
      prompt: "After hard reset, some reflog entry still points at <code>c4d10aa</code>.",
      hint: "hard reset then Check",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.hardReset && state.reflog.some((e) => e.at === C3.id),
    },
    {
      id: "select-old",
      title: "Select HEAD@{1}",
      prompt: "After accidental hard reset, select the reflog row that still has mul (<code>c4d10aa</code>).",
      hint: "Accident scenario → click that row",
      type: "state",
      setup: () => accidentScenario(),
      check: () => {
        const e = state.reflog[state.selectedRef];
        return e && e.at === C3.id;
      },
    },
    {
      id: "recover-reset",
      title: "Recover reset",
      prompt: "After hard reset, select mul’s reflog entry, then <strong>reset --hard HEAD@{n}</strong>.",
      hint: "select c4d10aa row → reset to ref",
      type: "state",
      setup: () => accidentScenario(),
      check: () =>
        state.recoveredReset &&
        state.head === C3.id &&
        !isOrphan(C3.id),
    },
    {
      id: "recover-branch",
      title: "Recover branch",
      prompt: "After hard reset, select mul, <strong>branch recover</strong> — mul reachable; tip may stay on parent.",
      hint: "Accident → select mul → branch recover",
      type: "state",
      setup: () => accidentScenario(),
      check: () =>
        state.recoveredBranch &&
        state.branches.recover === C3.id &&
        !isOrphan(C3.id),
    },
    {
      id: "quiz-cmd",
      title: "Quiz: list",
      prompt: "Command to list HEAD history? Answer: <code>git reflog</code>",
      hint: "reflog",
      type: "text",
      answer: "git reflog",
      alt: ["reflog", "git reflog show"],
    },
    {
      id: "quiz-recover-cmd",
      title: "Quiz: undo reset",
      prompt: "Common undo after hard reset? Answer: <code>git reset --hard HEAD@{1}</code>",
      hint: "previous tip",
      type: "text",
      answer: "git reset --hard HEAD@{1}",
      alt: ["reset --hard HEAD@{1}", "git reset --hard 'HEAD@{1}'"],
    },
    {
      id: "dangling-label",
      title: "Dangling shown",
      prompt: "After hard reset (before recover), branch panel lists mul as dangling/orphan.",
      hint: "Accident scenario",
      type: "state",
      setup: () => accidentScenario(),
      check: () => isOrphan(C3.id) && state.head === C2.id,
    },
    {
      id: "quiz-expire",
      title: "Quiz: expire",
      prompt: "Reflog entries last forever? Answer: <code>no</code>",
      hint: "they expire",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "commit-grows",
      title: "Commit grows",
      prompt: "From starter, make a dummy commit — HEAD changes; reflog gains an entry.",
      hint: "commit button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.committedExtra &&
        state.head !== C3.id &&
        state.reflog[0].at === state.head,
    },
    {
      id: "double-hard",
      title: "Double hard",
      prompt: "Hard-reset twice from starter — tip should be <code>e0a11c3</code>.",
      hint: "hard → hard",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.head === C1.id && state.hardReset,
    },
    {
      id: "quiz-vs-log",
      title: "Quiz: vs log",
      prompt: "After hard reset, <code>git log</code> hides the mul commit but reflog still has it? Answer: <code>yes</code>",
      hint: "yes",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "branch-keeps-tip",
      title: "Branch keeps tip",
      prompt: "Accident reset, recover via <strong>branch</strong> (not reset) — <code>main</code> tip stays <code>d71bb02</code>.",
      hint: "don't use reset-to-ref",
      type: "state",
      setup: () => accidentScenario(),
      check: () =>
        state.recoveredBranch &&
        state.branches.main === C2.id &&
        state.branches.recover === C3.id,
    },
    {
      id: "quiz-rebase",
      title: "Quiz: rebase",
      prompt: "Old tips after rebase are often still in? Answer: <code>reflog</code>",
      hint: "same safety net",
      type: "text",
      answer: "reflog",
      alt: ["git reflog", "the reflog"],
    },
    {
      id: "head1-after-accident",
      title: "HEAD@{1} after",
      prompt: "Right after Accident scenario, <code>HEAD@{1}</code> should be mul <code>c4d10aa</code>.",
      hint: "Accident scenario then Check",
      type: "state",
      setup: () => accidentScenario(),
      check: () => state.reflog[1] && state.reflog[1].at === C3.id,
    },
    {
      id: "full-roundtrip",
      title: "Roundtrip",
      prompt: "Hard reset, then reset --hard to mul via reflog — back on <code>c4d10aa</code>.",
      hint: "hard → select → reset to ref",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.hardReset &&
        state.recoveredReset &&
        state.head === C3.id &&
        state.branches.main === C3.id,
    },
    {
      id: "quiz-push-recover",
      title: "Quiz: share",
      prompt: "To share a recovered commit with others, you should? Answer: <code>push</code> a branch",
      hint: "reflog stays local",
      type: "text",
      answer: "push",
      alt: ["push branch", "push a branch", "git push"],
    },
    {
      id: "starter-depth",
      title: "Starter depth",
      prompt: "Starter reflog has how many entries? (number)",
      hint: "four commits recorded",
      type: "text",
      answer: "4",
      setup: () => loadStarter(),
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use reflog actions, then Check.</span>`;
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

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
