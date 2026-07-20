(() => {
  const HEAD = {
    "rtl/alu.v": "module alu;\n  // add/sub\nendmodule\n",
    "notes.txt": "todo: mul\n",
  };

  const DIRTY = {
    "rtl/alu.v": "module alu;\n  // add/sub + WIP mul\nendmodule\n",
    "notes.txt": "todo: mul\nscratch\n",
  };

  const OTHER = {
    "rtl/alu.v": "module alu;\n  // hotfix reset\nendmodule\n",
    "notes.txt": "todo: mul\n",
  };

  function makeStarter() {
    return {
      head: { ...HEAD },
      index: { ...HEAD },
      work: { ...DIRTY },
      untracked: { "scratch.tmp": "temp\n" },
      /** @type {{ msg: string, work: Record<string,string>, index: Record<string,string>, untracked: Record<string,string>, includeUntracked: boolean }[]} */
      stash: [],
      branch: "feature/wip-mul",
      stashMsg: "wip mul",
      lastAction: "",
      pushed: false,
      popped: false,
      applied: false,
      dropped: false,
      cleared: false,
      conflict: false,
      includeU: false,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-git-stash-lab-cleared-v1";
  const STORE_KEY = "ddv-git-stash-lab-session-v1";

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

  const root = document.getElementById("gs-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Dirty WIP on <code>feature/wip-mul</code>
        (<code>rtl/alu.v</code> + <code>notes.txt</code>) plus untracked <code>scratch.tmp</code>.
        Stash, clean up, then restore.</p>
      <button type="button" class="btn btn-secondary" id="gs-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Scenarios</h2></div>
      <div class="panel-body">
        <div class="scenario-row" id="scenario-row"></div>
        <div class="compare-grid">
          <div class="compare-card">
            <h3>pop</h3>
            <p>Apply stash<strong>0</strong>, then <em>drop</em> it if clean.</p>
          </div>
          <div class="compare-card">
            <h3>apply</h3>
            <p>Apply stash<strong>0</strong>, leave it on the stack.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Working tree</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <pre class="tree-box" id="tree-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Stash stack &amp; actions</h2></div>
        <div class="panel-body">
          <div class="msg-field">
            <label for="stash-msg">Message</label>
            <input id="stash-msg" type="text" />
          </div>
          <label style="display:flex;gap:0.4rem;align-items:center;font-size:0.85rem;margin-bottom:0.55rem;color:var(--muted)">
            <input type="checkbox" id="opt-u" /> include untracked (<code>-u</code>)
          </label>
          <div class="action-grid">
            <button type="button" id="btn-push">git stash push -m "…"</button>
            <button type="button" id="btn-pop">git stash pop</button>
            <button type="button" id="btn-apply">git stash apply</button>
            <button type="button" id="btn-drop">git stash drop</button>
            <button type="button" class="danger" id="btn-clear">git stash clear</button>
            <button type="button" id="btn-dirty">Make worktree dirty again</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">stash list</h3>
          <pre class="stash-list" id="stash-list"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td><code>stash push</code></td><td>Save tracked dirty files; reset work/index to HEAD</td></tr>
            <tr><td><code>stash push -u</code></td><td>Also stash untracked files</td></tr>
            <tr><td><code>stash pop</code></td><td>Apply stash@{0} then drop it</td></tr>
            <tr><td><code>stash apply</code></td><td>Apply stash@{0}; keep stack entry</td></tr>
            <tr><td><code>stash drop</code></td><td>Delete stash@{0} without applying</td></tr>
            <tr><td><code>stash clear</code></td><td>Delete entire stash stack</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Use stash when you must switch branches / pull but are mid-edit.</li>
          <li><code>apply</code> is safer while learning — you can <code>drop</code> after verifying.</li>
          <li>Pop onto overlapping dirty files → conflict (lab refuses / warns).</li>
        </ul>
      </div>
    </div>
  `;

  const treeBox = document.getElementById("tree-box");
  const stashList = document.getElementById("stash-list");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");
  const msgInput = document.getElementById("stash-msg");
  const optU = document.getElementById("opt-u");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function isClean() {
    const trackedClean =
      state.work["rtl/alu.v"] === state.head["rtl/alu.v"] &&
      state.work["notes.txt"] === state.head["notes.txt"] &&
      state.index["rtl/alu.v"] === state.head["rtl/alu.v"] &&
      state.index["notes.txt"] === state.head["notes.txt"];
    const noUntracked = Object.keys(state.untracked).length === 0;
    return trackedClean; // untracked alone doesn't block "clean enough for stash empty"
  }

  function hasTrackedDirty() {
    return (
      state.work["rtl/alu.v"] !== state.head["rtl/alu.v"] ||
      state.work["notes.txt"] !== state.head["notes.txt"] ||
      state.index["rtl/alu.v"] !== state.head["rtl/alu.v"] ||
      state.index["notes.txt"] !== state.head["notes.txt"]
    );
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 50) state.log = state.log.slice(-40);
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

  function renderTree() {
    const lines = [];
    lines.push(`branch ${state.branch}`);
    ["rtl/alu.v", "notes.txt"].forEach((p) => {
      const w = state.work[p];
      const h = state.head[p];
      const i = state.index[p];
      let tag = "clean";
      let cls = "clean";
      if (w !== i) {
        tag = "modified";
        cls = "dirty";
      } else if (i !== h) {
        tag = "staged";
        cls = "staged";
      }
      const preview = w.trim().split("\n").pop();
      lines.push(`<span class="${cls}">${escapeHtml(p)} [${tag}] … ${escapeHtml(preview)}</span>`);
    });
    Object.keys(state.untracked).forEach((p) => {
      lines.push(`<span class="untracked">${escapeHtml(p)} [untracked]</span>`);
    });
    treeBox.innerHTML = lines.join("\n");
    const dirty = hasTrackedDirty();
    const ut = Object.keys(state.untracked).length;
    statusRow.innerHTML = `<strong>Status</strong> — ${
      dirty ? "dirty tracked" : "tracked clean"
    } · ${ut} untracked · stash@{${state.stash.length ? "0.." + (state.stash.length - 1) : "∅"}} depth ${state.stash.length}`;
  }

  function renderStash() {
    if (!state.stash.length) {
      stashList.innerHTML = '<span class="empty">(empty — stash list)</span>';
      return;
    }
    stashList.innerHTML = state.stash
      .map((s, i) => {
        const cls = i === 0 ? "stash0" : "entry";
        const u = s.includeUntracked ? " (-u)" : "";
        return `<span class="${cls}">stash@{${i}}: On ${escapeHtml(state.branch)}: ${escapeHtml(s.msg)}${u}</span>`;
      })
      .join("\n");
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
    msgInput.value = state.stashMsg;
    optU.checked = !!state.includeU;
    renderTree();
    renderStash();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# loaded dirty WIP starter");
    renderAll();
  }

  function applyScenario(name) {
    if (name === "dirty") {
      state = makeStarter();
      pushLog("muted", "# scenario: dirty WIP");
    } else if (name === "clean") {
      state = makeStarter();
      state.work = { ...HEAD };
      state.index = { ...HEAD };
      state.untracked = {};
      pushLog("muted", "# scenario: clean tree");
    } else if (name === "hotfix") {
      // clean tracked, as if switched after stash
      state.work = { ...OTHER };
      state.index = { ...OTHER };
      state.head = { ...OTHER };
      state.untracked = {};
      state.branch = "hotfix/reset";
      pushLog("muted", "# scenario: on hotfix branch (clean vs its HEAD)");
    } else if (name === "stacked") {
      state = makeStarter();
      // pre-push two stashes conceptually
      doPush(true);
      state.work = { ...DIRTY };
      state.work["notes.txt"] = "todo: mul\nsecond wip\n";
      state.index = { ...HEAD };
      doPush(true);
      pushLog("muted", "# scenario: two stashes stacked");
    }
    state.lastAction = "scenario-" + name;
    renderAll();
  }

  const scenarioRow = document.getElementById("scenario-row");
  [
    ["Dirty WIP", "dirty"],
    ["Clean tree", "clean"],
    ["After stash → hotfix", "hotfix"],
    ["Two stashes", "stacked"],
  ].forEach(([label, key]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => applyScenario(key));
    scenarioRow.appendChild(b);
  });

  function doPush(silent) {
    state.includeU = optU.checked;
    state.stashMsg = msgInput.value.trim() || "WIP";
    if (!hasTrackedDirty() && !(state.includeU && Object.keys(state.untracked).length)) {
      if (!silent) {
        pushLog("warn", `# no local changes to save`);
        state.lastAction = "push-empty";
        renderAll();
      }
      return false;
    }
    const entry = {
      msg: state.stashMsg,
      work: { ...state.work },
      index: { ...state.index },
      untracked: state.includeU ? { ...state.untracked } : {},
      includeUntracked: !!state.includeU,
    };
    state.stash.unshift(entry);
    // reset tracked to HEAD
    state.work = { ...state.head };
    state.index = { ...state.head };
    if (state.includeU) state.untracked = {};
    state.pushed = true;
    state.lastAction = "push";
    if (!silent) {
      const u = entry.includeUntracked ? " -u" : "";
      pushLog("ok", `$ git stash push${u} -m "${entry.msg}"`);
      pushLog("muted", `# saved stash@{0}; working tree cleaned (tracked)`);
    }
    return true;
  }

  function overlaps(entry) {
    return (
      hasTrackedDirty() &&
      (entry.work["rtl/alu.v"] !== state.head["rtl/alu.v"] ||
        entry.work["notes.txt"] !== state.head["notes.txt"])
    );
  }

  function doApply(andDrop) {
    if (!state.stash.length) {
      pushLog("warn", `# no stash entries`);
      state.lastAction = andDrop ? "pop-empty" : "apply-empty";
      renderAll();
      return;
    }
    const entry = state.stash[0];
    if (overlaps(entry)) {
      state.conflict = true;
      state.lastAction = andDrop ? "pop-conflict" : "apply-conflict";
      pushLog("err", `$ git stash ${andDrop ? "pop" : "apply"}`);
      pushLog("err", `# conflict: dirty worktree overlaps stash — refused`);
      renderAll();
      return;
    }
    state.work = { ...entry.work };
    state.index = { ...entry.index };
    if (entry.includeUntracked) {
      state.untracked = { ...state.untracked, ...entry.untracked };
    }
    if (andDrop) {
      state.stash.shift();
      state.popped = true;
      state.lastAction = "pop";
      pushLog("ok", `$ git stash pop`);
      pushLog("muted", `# applied + dropped former stash@{0}`);
    } else {
      state.applied = true;
      state.lastAction = "apply";
      pushLog("ok", `$ git stash apply`);
      pushLog("muted", `# applied stash@{0}; stack unchanged (depth ${state.stash.length})`);
    }
    renderAll();
  }

  function doDrop() {
    if (!state.stash.length) {
      pushLog("warn", `# no stash entries`);
      state.lastAction = "drop-empty";
      renderAll();
      return;
    }
    const gone = state.stash.shift();
    state.dropped = true;
    state.lastAction = "drop";
    pushLog("ok", `$ git stash drop`);
    pushLog("muted", `# dropped "${gone.msg}"`);
    renderAll();
  }

  function doClear() {
    const n = state.stash.length;
    state.stash = [];
    state.cleared = true;
    state.lastAction = "clear";
    pushLog("warn", `$ git stash clear`);
    pushLog("muted", `# removed ${n} stash entr${n === 1 ? "y" : "ies"}`);
    renderAll();
  }

  function makeDirty() {
    state.work = { ...DIRTY };
    state.index = { ...HEAD };
    if (!state.untracked["scratch.tmp"]) state.untracked["scratch.tmp"] = "temp\n";
    state.lastAction = "make-dirty";
    pushLog("muted", `# re-dirtied working tree`);
    renderAll();
  }

  document.getElementById("btn-push").addEventListener("click", () => doPush(false));
  document.getElementById("btn-pop").addEventListener("click", () => doApply(true));
  document.getElementById("btn-apply").addEventListener("click", () => doApply(false));
  document.getElementById("btn-drop").addEventListener("click", doDrop);
  document.getElementById("btn-clear").addEventListener("click", doClear);
  document.getElementById("btn-dirty").addEventListener("click", makeDirty);
  document.getElementById("gs-starter").addEventListener("click", loadStarter);
  msgInput.addEventListener("input", () => {
    state.stashMsg = msgInput.value;
    saveSession();
  });
  optU.addEventListener("change", () => {
    state.includeU = optU.checked;
    saveSession();
  });

  const CHALLENGES = [
    {
      id: "quiz-why",
      title: "Quiz: why",
      prompt: "Stash is for saving? Answer: <code>dirty</code> work temporarily",
      hint: "uncommitted changes",
      type: "text",
      answer: "dirty",
      alt: ["wip", "uncommitted", "dirty work", "local changes"],
    },
    {
      id: "quiz-push",
      title: "Quiz: push",
      prompt: "Command to save and clean tracked files? Answer: <code>stash push</code>",
      hint: "modern form of git stash",
      type: "text",
      answer: "stash push",
      alt: ["git stash push", "git stash", "stash"],
    },
    {
      id: "do-push",
      title: "Stash push",
      prompt: "From starter, run <strong>stash push</strong> — tracked files clean; stack depth 1.",
      hint: "push button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.pushed &&
        state.stash.length === 1 &&
        !hasTrackedDirty() &&
        state.work["rtl/alu.v"] === state.head["rtl/alu.v"],
    },
    {
      id: "untracked-remains",
      title: "Untracked stays",
      prompt: "After plain stash push (no -u), <code>scratch.tmp</code> should still be untracked.",
      hint: "don't check -u",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.pushed &&
        !!state.untracked["scratch.tmp"] &&
        state.stash.length >= 1 &&
        !state.stash[0].includeUntracked,
    },
    {
      id: "quiz-u",
      title: "Quiz: -u",
      prompt: "Flag to include untracked in stash? Answer: <code>-u</code>",
      hint: "--include-untracked",
      type: "text",
      answer: "-u",
      alt: ["-u", "--include-untracked", "stash -u", "push -u"],
    },
    {
      id: "push-u",
      title: "Push -u",
      prompt: "Check include untracked, stash push — <code>scratch.tmp</code> gone from tree, inside stash.",
      hint: "checkbox -u then push",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.pushed &&
        !state.untracked["scratch.tmp"] &&
        state.stash[0] &&
        state.stash[0].includeUntracked &&
        !!state.stash[0].untracked["scratch.tmp"],
    },
    {
      id: "quiz-pop",
      title: "Quiz: pop",
      prompt: "<code>stash pop</code> means apply then? Answer: <code>drop</code>",
      hint: "remove from stack",
      type: "text",
      answer: "drop",
      alt: ["delete", "remove", "drop it"],
    },
    {
      id: "quiz-apply",
      title: "Quiz: apply",
      prompt: "<code>stash apply</code> keeps the stash entry? Answer: <code>yes</code>",
      hint: "safer while learning",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "do-pop",
      title: "Pop restore",
      prompt: "Stash push, then <strong>pop</strong> — WIP text back; stack empty.",
      hint: "push → pop",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.popped &&
        state.stash.length === 0 &&
        /WIP mul/.test(state.work["rtl/alu.v"]),
    },
    {
      id: "do-apply",
      title: "Apply keep",
      prompt: "Stash push, then <strong>apply</strong> — WIP restored but stash depth still 1.",
      hint: "push → apply",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.applied &&
        state.stash.length === 1 &&
        /WIP mul/.test(state.work["rtl/alu.v"]),
    },
    {
      id: "do-drop",
      title: "Drop only",
      prompt: "Stash push, then <strong>drop</strong> without applying — tree stays clean; stack empty.",
      hint: "push → drop",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.dropped &&
        state.stash.length === 0 &&
        !hasTrackedDirty() &&
        !/WIP mul/.test(state.work["rtl/alu.v"]),
    },
    {
      id: "pop-conflict",
      title: "Pop conflict",
      prompt: "Stash push, Make dirty again, then pop — should refuse with conflict.",
      hint: "push → dirty → pop",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "pop-conflict" && state.conflict,
    },
    {
      id: "quiz-stack0",
      title: "Quiz: stash@{0}",
      prompt: "Newest stash is always? Answer: <code>stash@{0}</code>",
      hint: "top of stack",
      type: "text",
      answer: "stash@{0}",
      alt: ["0", "stash@0", "@{0}"],
    },
    {
      id: "two-depth",
      title: "Depth 2",
      prompt: "Use scenario <strong>Two stashes</strong> or push twice — stack depth 2.",
      hint: "Two stashes scenario",
      type: "state",
      check: () => state.stash.length === 2,
    },
    {
      id: "clear-all",
      title: "Clear",
      prompt: "Get at least one stash, then <strong>stash clear</strong> — empty stack.",
      hint: "clear button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.cleared && state.stash.length === 0 && state.lastAction === "clear",
    },
    {
      id: "quiz-vs-commit",
      title: "Quiz: vs commit",
      prompt: "Stash is a substitute for commit on shared main? Answer: <code>no</code>",
      hint: "local scratchpad only",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "push-empty",
      title: "Nothing to stash",
      prompt: "Scenario Clean tree, then push — should warn no local changes.",
      hint: "Clean tree → push",
      type: "state",
      check: () => state.lastAction === "push-empty",
    },
    {
      id: "message-custom",
      title: "Custom message",
      prompt: "Set message to <code>wip mul</code> (starter default), push — stash list shows that message.",
      hint: "push with message field",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.pushed &&
        state.stash[0] &&
        state.stash[0].msg === "wip mul",
    },
    {
      id: "apply-then-drop",
      title: "Apply then drop",
      prompt: "Push, apply (depth 1), then drop — clean stack; WIP present.",
      hint: "push → apply → drop",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.applied &&
        state.dropped &&
        state.stash.length === 0 &&
        /WIP mul/.test(state.work["rtl/alu.v"]),
    },
    {
      id: "quiz-order",
      title: "Quiz: order",
      prompt: "Safer learning order letters: A=apply D=drop P=pop. Prefer? Answer: <code>AD</code>",
      hint: "verify before deleting",
      type: "text",
      answer: "ad",
      alt: ["a-d", "apply drop"],
    },
    {
      id: "hotfix-clean-pop",
      title: "Pop on clean",
      prompt: "Push on starter, scenario After stash→hotfix (or ensure clean), pop — WIP lands on hotfix tree.",
      hint: "push → hotfix scenario → pop",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.popped &&
        /WIP mul/.test(state.work["rtl/alu.v"]) &&
        state.stash.length === 0,
    },
    {
      id: "starter-dirty",
      title: "Starter dirty",
      prompt: "Load starter — tracked dirty with WIP mul. Confirm Check.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => hasTrackedDirty() && /WIP mul/.test(state.work["rtl/alu.v"]),
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use stash actions, then Check.</span>`;
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
