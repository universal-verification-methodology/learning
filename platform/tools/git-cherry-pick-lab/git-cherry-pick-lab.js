(() => {
  /** File contents keyed by path at a commit */
  function makeStarter() {
    const commits = {
      a100: {
        id: "a100",
        msg: "init rtl",
        parent: null,
        files: {
          "rtl/alu.v": "module alu;\n  // add\nendmodule\n",
          "docs/spec.md": "# ALU\nadd only\n",
        },
      },
      b200: {
        id: "b200",
        msg: "docs: note reset",
        parent: "a100",
        files: {
          "rtl/alu.v": "module alu;\n  // add\nendmodule\n",
          "docs/spec.md": "# ALU\nadd only\nreset: sync\n",
        },
      },
      c300: {
        id: "c300",
        msg: "alu: add mul path",
        parent: "b200",
        files: {
          "rtl/alu.v": "module alu;\n  // add + mul\nendmodule\n",
          "docs/spec.md": "# ALU\nadd only\nreset: sync\n",
        },
      },
      // release branch tip diverged on alu.v — conflicts with mul cherry-pick
      d400: {
        id: "d400",
        msg: "release: freeze alu add-only",
        parent: "b200",
        files: {
          "rtl/alu.v": "module alu;\n  // add (release freeze)\nendmodule\n",
          "docs/spec.md": "# ALU\nadd only\nreset: sync\n",
        },
      },
      // clean cherry-pick target: docs-only change from main onto release is fine
      e500: {
        id: "e500",
        msg: "docs: clarify reset polarity",
        parent: "c300",
        files: {
          "rtl/alu.v": "module alu;\n  // add + mul\nendmodule\n",
          "docs/spec.md": "# ALU\nadd + mul\nreset: active-low sync\n",
        },
      },
    };

    return {
      commits,
      branches: {
        main: "e500",
        "release/0.1": "d400",
      },
      branch: "release/0.1",
      head: "d400",
      selected: "e500", // docs commit — clean pick onto release
      /** @type {null | { sourceId: string, resolved: boolean }} */
      picking: null,
      conflictPaths: [],
      lastAction: "",
      pickedClean: false,
      pickedConflict: false,
      continued: false,
      aborted: false,
      nextSeq: 1,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-git-cherry-pick-lab-cleared-v1";
  const STORE_KEY = "ddv-git-cherry-pick-lab-session-v1";

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

  const root = document.getElementById("cp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> On <code>release/0.1</code> (frozen alu).
        Cherry-pick the docs commit from <code>main</code> cleanly, or try the mul commit to hit a conflict.</p>
      <button type="button" class="btn btn-secondary" id="cp-starter">Load starter example</button>
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
            <h3>Cherry-pick</h3>
            <p>Apply one commit’s patch onto <code>HEAD</code> as a <em>new</em> commit (new SHA).</p>
          </div>
          <div class="idea-card">
            <h3>Conflicts</h3>
            <p>If the same lines diverged, resolve, then <code>--continue</code> or <code>--abort</code>.</p>
          </div>
        </div>
        <div class="scenario-row" id="scenario-row"></div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Branches &amp; commits</h2></div>
        <div class="panel-body">
          <div class="branch-tabs" id="branch-tabs"></div>
          <p class="status-row" id="status-row"></p>
          <div id="status-pill" class="status-pill idle">idle</div>
          <pre class="commit-list" id="commit-list"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Actions</h2></div>
        <div class="panel-body">
          <div class="action-grid">
            <button type="button" id="btn-pick">git cherry-pick &lt;selected&gt;</button>
            <button type="button" id="btn-resolve" disabled>Resolve conflict (take incoming patch)</button>
            <button type="button" id="btn-continue" disabled>git cherry-pick --continue</button>
            <button type="button" id="btn-abort" disabled>git cherry-pick --abort</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">HEAD files</h3>
          <pre class="file-box" id="file-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Use</th></tr></thead>
          <tbody>
            <tr><td><code>git cherry-pick &lt;sha&gt;</code></td><td>Apply that commit onto current branch</td></tr>
            <tr><td><code>git cherry-pick --continue</code></td><td>After resolving conflicts</td></tr>
            <tr><td><code>git cherry-pick --abort</code></td><td>Cancel and restore pre-pick state</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Good for porting a hotfix commit onto a release branch without merging all of main.</li>
          <li>Cherry-pick creates a <strong>new</strong> commit — same change idea, different SHA.</li>
          <li>Avoid cherry-picking merge commits unless you know <code>-m</code> parent selection.</li>
        </ul>
      </div>
    </div>
  `;

  const branchTabs = document.getElementById("branch-tabs");
  const commitList = document.getElementById("commit-list");
  const fileBox = document.getElementById("file-box");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");
  const statusPill = document.getElementById("status-pill");
  const btnResolve = document.getElementById("btn-resolve");
  const btnContinue = document.getElementById("btn-continue");
  const btnAbort = document.getElementById("btn-abort");

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

  function headCommit() {
    return state.commits[state.head];
  }

  function ancestry(tip) {
    const ids = [];
    let cur = tip;
    const seen = new Set();
    while (cur && state.commits[cur] && !seen.has(cur)) {
      seen.add(cur);
      ids.push(cur);
      cur = state.commits[cur].parent;
    }
    return ids;
  }

  function patchFrom(parentFiles, childFiles) {
    /** @type {Record<string, string>} */
    const patch = {};
    const paths = new Set([...Object.keys(parentFiles), ...Object.keys(childFiles)]);
    paths.forEach((p) => {
      const a = parentFiles[p] || "";
      const b = childFiles[p] || "";
      if (a !== b) patch[p] = b;
    });
    return patch;
  }

  function commitPatch(id) {
    const c = state.commits[id];
    const parent = c.parent ? state.commits[c.parent] : { files: {} };
    return patchFrom(parent.files || {}, c.files);
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

  function renderTabs() {
    branchTabs.innerHTML = "";
    Object.keys(state.branches).forEach((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name + (name === state.branch ? " (HEAD)" : "");
      if (name === state.branch) b.classList.add("is-active");
      b.disabled = !!state.picking;
      b.addEventListener("click", () => {
        if (state.picking) return;
        state.branch = name;
        state.head = state.branches[name];
        renderAll();
      });
      branchTabs.appendChild(b);
    });
  }

  function renderCommits() {
    // Show commits from both branches for picking
    const mainIds = ancestry(state.branches.main);
    const relIds = ancestry(state.branches["release/0.1"]);
    const ordered = [];
    const seen = new Set();
    [...mainIds, ...relIds].forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    });

    commitList.innerHTML = "";
    ordered.forEach((id) => {
      const c = state.commits[id];
      const onMain = mainIds.includes(id);
      const onRel = relIds.includes(id);
      const where = [onMain ? "main" : null, onRel ? "release" : null].filter(Boolean).join("+");
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<span class="hash">${c.id}</span> ${escapeHtml(c.msg)} <span class="on-other">[${where}]</span>`;
      if (id === state.selected) b.classList.add("is-selected");
      b.disabled = !!state.picking;
      b.addEventListener("click", () => {
        if (state.picking) return;
        state.selected = id;
        renderAll();
      });
      commitList.appendChild(b);
    });
  }

  function renderFiles() {
    const h = headCommit();
    if (!h) {
      fileBox.textContent = "";
      return;
    }
    const lines = [];
    if (state.picking && state.conflictPaths.length && !state.picking.resolved) {
      lines.push('<span class="conflict">CONFLICT in progress</span>');
      state.conflictPaths.forEach((p) => {
        lines.push(`<span class="conflict">UU ${escapeHtml(p)}</span>`);
      });
      lines.push("");
    }
    Object.keys(h.files).forEach((p) => {
      const cls = state.conflictPaths.includes(p) && state.picking && !state.picking.resolved
        ? "conflict"
        : "ok";
      const preview = h.files[p].trim().split("\n").slice(0, 2).join(" / ");
      lines.push(`<span class="path">${escapeHtml(p)}</span>`);
      lines.push(`<span class="${cls}">  ${escapeHtml(preview)}</span>`);
    });
    fileBox.innerHTML = lines.join("\n");
  }

  function renderStatus() {
    statusRow.innerHTML = `<strong>${escapeHtml(state.branch)}</strong> @ ${escapeHtml(
      state.head
    )} · selected <code>${escapeHtml(state.selected || "—")}</code>`;
    if (state.picking && !state.picking.resolved) {
      statusPill.className = "status-pill conflict";
      statusPill.textContent = "cherry-pick conflict";
    } else if (state.picking && state.picking.resolved) {
      statusPill.className = "status-pill conflict";
      statusPill.textContent = "resolved — continue";
    } else {
      statusPill.className = "status-pill idle";
      statusPill.textContent = "idle";
    }
    const busy = !!state.picking;
    btnResolve.disabled = !(busy && state.conflictPaths.length && !state.picking.resolved);
    btnContinue.disabled = !(busy && (state.picking.resolved || state.conflictPaths.length === 0));
    btnAbort.disabled = !busy;
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
    renderTabs();
    renderCommits();
    renderFiles();
    renderStatus();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    abortSnapshot = null;
    state.lastAction = "load-starter";
    pushLog("muted", "# on release/0.1 — select docs e500 for a clean pick, or c300 for conflict");
    renderAll();
  }

  function snapshotHead() {
    return {
      head: state.head,
      branchTip: state.branches[state.branch],
      files: { ...headCommit().files },
    };
  }

  /** @type {null | ReturnType<typeof snapshotHead>} */
  let abortSnapshot = null;

  function doCherryPick() {
    if (state.picking) {
      pushLog("warn", `# cherry-pick already in progress`);
      return;
    }
    const srcId = state.selected;
    const src = state.commits[srcId];
    if (!src) return;
    if (srcId === state.head) {
      pushLog("warn", `# commit already at HEAD`);
      state.lastAction = "pick-noop";
      renderAll();
      return;
    }
    // already contained?
    if (ancestry(state.head).includes(srcId)) {
      pushLog("warn", `# commit already in ancestry (empty pick)`);
      state.lastAction = "pick-empty";
      renderAll();
      return;
    }

    abortSnapshot = snapshotHead();
    const patch = commitPatch(srcId);
    const headFiles = { ...headCommit().files };
    const conflicts = [];

    Object.keys(patch).forEach((p) => {
      const parentOfSrc = src.parent ? state.commits[src.parent].files[p] : "";
      const headVal = headFiles[p] || "";
      // conflict if head diverged from the patch base on this path
      if (headVal !== parentOfSrc && headVal !== patch[p]) {
        conflicts.push(p);
      }
    });

    if (conflicts.length) {
      state.picking = { sourceId: srcId, resolved: false };
      state.conflictPaths = conflicts;
      state.pickedConflict = true;
      state.lastAction = "pick-conflict";
      pushLog("err", `$ git cherry-pick ${srcId}`);
      pushLog("err", `# conflict: ${conflicts.join(", ")}`);
      renderAll();
      return;
    }

    // clean apply
    const newFiles = { ...headFiles, ...patch };
    const newId = "p" + String(100 + state.nextSeq++);
    state.commits[newId] = {
      id: newId,
      msg: src.msg,
      parent: state.head,
      files: newFiles,
      cherryOf: srcId,
    };
    state.head = newId;
    state.branches[state.branch] = newId;
    state.pickedClean = true;
    state.lastAction = "pick-clean";
    state.picking = null;
    state.conflictPaths = [];
    pushLog("ok", `$ git cherry-pick ${srcId}`);
    pushLog("muted", `# created ${newId} (new SHA; same message as ${srcId})`);
    abortSnapshot = null;
    renderAll();
  }

  function doResolve() {
    if (!state.picking || state.picking.resolved) return;
    const src = state.commits[state.picking.sourceId];
    const patch = commitPatch(src.id);
    // apply incoming for conflict paths into a working buffer on HEAD commit object temporarily
    const files = { ...headCommit().files };
    state.conflictPaths.forEach((p) => {
      files[p] = patch[p];
    });
    // mutate a detached working tree: store on picking
    state.picking.workFiles = files;
    state.picking.resolved = true;
    state.lastAction = "resolve";
    pushLog("ok", `# resolved conflicts favoring cherry-picked patch`);
    renderAll();
  }

  function doContinue() {
    if (!state.picking) return;
    if (state.conflictPaths.length && !state.picking.resolved) {
      pushLog("warn", `# resolve conflicts first`);
      state.lastAction = "continue-blocked";
      renderAll();
      return;
    }
    const src = state.commits[state.picking.sourceId];
    const files =
      state.picking.workFiles ||
      { ...headCommit().files, ...commitPatch(src.id) };
    const newId = "p" + String(100 + state.nextSeq++);
    state.commits[newId] = {
      id: newId,
      msg: src.msg,
      parent: state.head,
      files,
      cherryOf: src.id,
    };
    state.head = newId;
    state.branches[state.branch] = newId;
    state.continued = true;
    state.lastAction = "continue";
    state.picking = null;
    state.conflictPaths = [];
    abortSnapshot = null;
    pushLog("ok", `$ git cherry-pick --continue`);
    pushLog("muted", `# recorded ${newId}`);
    renderAll();
  }

  function doAbort() {
    if (!state.picking) return;
    if (abortSnapshot) {
      state.head = abortSnapshot.head;
      state.branches[state.branch] = abortSnapshot.branchTip;
    }
    state.picking = null;
    state.conflictPaths = [];
    state.aborted = true;
    state.lastAction = "abort";
    abortSnapshot = null;
    pushLog("warn", `$ git cherry-pick --abort`);
    pushLog("muted", `# restored pre-pick HEAD`);
    renderAll();
  }

  document.getElementById("btn-pick").addEventListener("click", doCherryPick);
  btnResolve.addEventListener("click", doResolve);
  btnContinue.addEventListener("click", doContinue);
  btnAbort.addEventListener("click", doAbort);
  document.getElementById("cp-starter").addEventListener("click", loadStarter);

  const scenarioRow = document.getElementById("scenario-row");
  [
    ["Starter on release", () => loadStarter()],
    [
      "Select mul (conflict)",
      () => {
        loadStarter();
        state.selected = "c300";
        renderAll();
      },
    ],
    [
      "Select docs (clean)",
      () => {
        loadStarter();
        state.selected = "e500";
        renderAll();
      },
    ],
  ].forEach(([label, fn]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", fn);
    scenarioRow.appendChild(b);
  });

  const CHALLENGES = [
    {
      id: "quiz-what",
      title: "Quiz: what",
      prompt: "Cherry-pick applies how many commits by default? Answer: <code>1</code>",
      hint: "one SHA",
      type: "text",
      answer: "1",
      alt: ["one"],
    },
    {
      id: "quiz-new-sha",
      title: "Quiz: SHA",
      prompt: "Cherry-pick reuses the same commit SHA? Answer: <code>no</code>",
      hint: "new commit object",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "quiz-use",
      title: "Quiz: use",
      prompt: "Port a single hotfix onto a release branch with? Answer: <code>cherry-pick</code>",
      hint: "not full merge",
      type: "text",
      answer: "cherry-pick",
      alt: ["git cherry-pick", "cherry pick"],
    },
    {
      id: "starter-branch",
      title: "On release",
      prompt: "Load starter — HEAD branch is <code>release/0.1</code>.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.branch === "release/0.1" && state.head === "d400",
    },
    {
      id: "select-docs",
      title: "Select docs",
      prompt: "Select commit <code>e500</code> (docs: clarify reset polarity).",
      hint: "click e500 in list",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.selected === "e500",
    },
    {
      id: "clean-pick",
      title: "Clean pick",
      prompt: "On release, cherry-pick <code>e500</code> — succeeds with new tip.",
      hint: "Select docs → cherry-pick",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "e500";
        renderAll();
      },
      check: () =>
        state.pickedClean &&
        state.lastAction === "pick-clean" &&
        headCommit().cherryOf === "e500" &&
        /active-low/.test(headCommit().files["docs/spec.md"]),
    },
    {
      id: "conflict-pick",
      title: "Conflict pick",
      prompt: "Cherry-pick <code>c300</code> (mul) onto release — should conflict on <code>rtl/alu.v</code>.",
      hint: "Select mul → cherry-pick",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "c300";
        renderAll();
      },
      check: () =>
        state.pickedConflict &&
        state.picking &&
        state.conflictPaths.includes("rtl/alu.v"),
    },
    {
      id: "resolve-continue",
      title: "Resolve + continue",
      prompt: "Conflict on mul pick → Resolve → --continue — tip has mul text.",
      hint: "c300 pick → resolve → continue",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "c300";
        renderAll();
      },
      check: () =>
        state.continued &&
        /mul/.test(headCommit().files["rtl/alu.v"]) &&
        !state.picking,
    },
    {
      id: "abort-restore",
      title: "Abort",
      prompt: "Start conflicting pick, then <strong>--abort</strong> — HEAD back to <code>d400</code>.",
      hint: "c300 pick → abort",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "c300";
        renderAll();
      },
      check: () =>
        state.aborted &&
        state.head === "d400" &&
        !state.picking &&
        state.lastAction === "abort",
    },
    {
      id: "quiz-continue",
      title: "Quiz: continue",
      prompt: "After fixing conflicts, run? Answer: <code>cherry-pick --continue</code>",
      hint: "finish the pick",
      type: "text",
      answer: "cherry-pick --continue",
      alt: ["git cherry-pick --continue", "--continue"],
    },
    {
      id: "quiz-abort",
      title: "Quiz: abort",
      prompt: "Cancel an in-progress cherry-pick with? Answer: <code>cherry-pick --abort</code>",
      hint: "restore pre-pick",
      type: "text",
      answer: "cherry-pick --abort",
      alt: ["git cherry-pick --abort", "--abort"],
    },
    {
      id: "switch-main",
      title: "Checkout main",
      prompt: "With no pick in progress, switch to <code>main</code> branch tab.",
      hint: "main tab",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.branch === "main" && state.head === "e500",
    },
    {
      id: "quiz-vs-merge",
      title: "Quiz: vs merge",
      prompt: "Cherry-pick brings whole branch history? Answer: <code>no</code>",
      hint: "one commit (or listed SHAs)",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "empty-ancestry",
      title: "Already ancestor",
      prompt: "On main, select <code>b200</code> and cherry-pick — should warn already in ancestry.",
      hint: "switch main → select b200 → pick",
      type: "state",
      setup: () => {
        loadStarter();
        state.branch = "main";
        state.head = state.branches.main;
        state.selected = "b200";
        renderAll();
      },
      check: () => state.lastAction === "pick-empty",
    },
    {
      id: "new-sha-differs",
      title: "New SHA differs",
      prompt: "Clean-pick e500 — new tip id should not equal <code>e500</code>.",
      hint: "complete clean pick",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "e500";
        renderAll();
      },
      check: () =>
        state.pickedClean &&
        state.head !== "e500" &&
        headCommit().cherryOf === "e500",
    },
    {
      id: "quiz-merge-commit",
      title: "Quiz: merges",
      prompt: "Cherry-picking merge commits needs special care (<code>-m</code>)? Answer: <code>yes</code>",
      hint: "parent selection",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "continue-blocked",
      title: "Continue blocked",
      prompt: "Conflict without resolve — --continue should stay blocked (or warn).",
      hint: "pick c300, try continue without resolve",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "c300";
        doCherryPick();
      },
      check: () => {
        if (!state.picking || state.picking.resolved) return false;
        doContinue();
        return state.lastAction === "continue-blocked" && !!state.picking;
      },
    },
    {
      id: "docs-on-release",
      title: "Docs text",
      prompt: "After clean-picking e500 onto release, spec mentions <code>active-low</code>.",
      hint: "clean pick docs",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "e500";
        renderAll();
      },
      check: () =>
        state.pickedClean && /active-low/.test(headCommit().files["docs/spec.md"]),
    },
    {
      id: "quiz-message",
      title: "Quiz: message",
      prompt: "Default cherry-pick commit message usually matches the? Answer: <code>original</code>",
      hint: "same subject",
      type: "text",
      answer: "original",
      alt: ["source", "original commit", "picked commit"],
    },
    {
      id: "release-tip-after-abort",
      title: "Freeze remains",
      prompt: "Abort a mul conflict pick — <code>rtl/alu.v</code> still has release freeze text.",
      hint: "conflict → abort",
      type: "state",
      setup: () => {
        loadStarter();
        state.selected = "c300";
        renderAll();
      },
      check: () =>
        state.aborted &&
        /release freeze/.test(headCommit().files["rtl/alu.v"]),
    },
    {
      id: "both-outcomes",
      title: "Both outcomes",
      prompt: "In one session: succeed a clean pick AND have triggered a conflict at some point.",
      hint: "e500 clean; c300 conflict (order flexible via reload)",
      type: "state",
      check: () => state.pickedClean && state.pickedConflict,
    },
    {
      id: "quiz-hotfix",
      title: "Quiz: hotfix flow",
      prompt: "Typical flow: fix on main, then ___ onto release. Answer: <code>cherry-pick</code>",
      hint: "port the one commit",
      type: "text",
      answer: "cherry-pick",
      alt: ["git cherry-pick", "cherry pick"],
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use cherry-pick actions, then Check.</span>`;
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

  // Persist abortSnapshot across session poorly — reset on load
  abortSnapshot = null;

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
