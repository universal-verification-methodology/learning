(() => {
  const PIN_OLD = "s1a2b3c";
  const PIN_NEW = "s4d5e6f";

  function makeStarter() {
    return {
      /** cloned parent but submodule not populated */
      cloned: true,
      initialized: false,
      /** recorded pin in parent gitlink */
      parentPin: PIN_OLD,
      /** actual checkout inside vendor/dv-lib */
      checkout: null,
      detached: false,
      onBranch: false,
      parentDirtyPin: false,
      parentCommitted: true,
      submodulePushed: true,
      lastAction: "",
      didInit: false,
      didUpdate: false,
      didBump: false,
      didCommitParent: false,
      didCheckoutBranch: false,
      forgotPush: false,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-submodule-pitfalls-cleared-v1";
  const STORE_KEY = "ddv-submodule-pitfalls-session-v1";

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

  const root = document.getElementById("sm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> You cloned the chip repo — <code>vendor/dv-lib</code>
        is an empty submodule folder until <code>submodule update --init</code>.
        Then watch detached HEAD and pin-update pitfalls.</p>
      <button type="button" class="btn btn-secondary" id="sm-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Classic pitfalls</h2></div>
      <div class="panel-body">
        <div class="pitfall-grid">
          <div class="pitfall-card" id="card-init">
            <h3>Forgotten init</h3>
            <p>Clone leaves submodule empty until update --init.</p>
          </div>
          <div class="pitfall-card" id="card-detach">
            <h3>Detached HEAD</h3>
            <p>Submodule checks out a pinned SHA, not a branch.</p>
          </div>
          <div class="pitfall-card" id="card-pin">
            <h3>Pin updates</h3>
            <p>Bump inside submodule, then commit the parent gitlink.</p>
          </div>
        </div>
        <div class="scenario-row" id="scenario-row"></div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Repo view</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <h3 style="font-size:0.9rem;margin:0 0 0.35rem">Tree</h3>
          <pre class="tree-box" id="tree-box"></pre>
          <h3 style="font-size:0.9rem;margin:0.75rem 0 0.35rem">Status</h3>
          <pre class="status-box" id="status-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Actions</h2></div>
        <div class="panel-body">
          <div class="action-grid">
            <button type="button" id="btn-init">git submodule update --init --recursive</button>
            <button type="button" id="btn-detach-info">Inspect HEAD (inside submodule)</button>
            <button type="button" id="btn-branch">git switch main (inside submodule)</button>
            <button type="button" id="btn-bump">Advance submodule to newer SHA</button>
            <button type="button" id="btn-commit-parent">git commit (parent: bump pin)</button>
            <button type="button" id="btn-push-sub">git push (inside submodule)</button>
            <button type="button" id="btn-push-parent">git push (parent)</button>
            <button type="button" id="btn-forget">Simulate: commit parent, forget submodule push</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Step</th><th>Command / note</th></tr></thead>
          <tbody>
            <tr><td>After clone</td><td><code>git submodule update --init --recursive</code></td></tr>
            <tr><td>Detached by design</td><td>Parent pins a SHA; checkout is detached until you <code>switch</code> a branch</td></tr>
            <tr><td>Bump dependency</td><td>Update submodule → commit parent gitlink → push <em>both</em></td></tr>
            <tr><td>Clone for CI</td><td><code>git clone --recurse-submodules</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Empty <code>vendor/</code> after clone almost always means forgotten init.</li>
          <li>Parent commit that only changes the gitlink is how you “move the pin.”</li>
          <li>Push submodule first (or ensure remote has the SHA) before teammates pull the parent.</li>
        </ul>
      </div>
    </div>
  `;

  const treeBox = document.getElementById("tree-box");
  const statusBox = document.getElementById("status-box");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");
  const cardInit = document.getElementById("card-init");
  const cardDetach = document.getElementById("card-detach");
  const cardPin = document.getElementById("card-pin");

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
    lines.push('<span class="dir">chip/</span>');
    lines.push("  rtl/ …");
    lines.push("  .gitmodules  → vendor/dv-lib");
    if (!state.initialized) {
      lines.push('<span class="empty">  vendor/dv-lib/  (empty — not initialized)</span>');
    } else {
      const headCls = state.detached ? "detach" : "pin";
      const headNote = state.detached
        ? `DETACHED at ${state.checkout}`
        : `branch main @ ${state.checkout}`;
      lines.push(`<span class="dir">  vendor/dv-lib/</span>`);
      lines.push(`<span class="${headCls}">    HEAD: ${headNote}</span>`);
      lines.push(`<span class="pin">    parent pin: ${state.parentPin}</span>`);
    }
    treeBox.innerHTML = lines.join("\n");
  }

  function renderStatus() {
    const lines = [];
    if (!state.initialized) {
      lines.push('<span class="warn">submodule vendor/dv-lib not initialized</span>');
      lines.push('<span class="muted">hint: git submodule update --init</span>');
    } else {
      if (state.detached) {
        lines.push(`<span class="warn">HEAD detached at ${escapeHtml(state.checkout)}</span>`);
      } else {
        lines.push(`<span class="ok">on branch main @ ${escapeHtml(state.checkout)}</span>`);
      }
      if (state.checkout !== state.parentPin) {
        lines.push(
          `<span class="warn">gitlink dirty: checkout ${escapeHtml(
            state.checkout
          )} ≠ pin ${escapeHtml(state.parentPin)}</span>`
        );
      } else {
        lines.push('<span class="ok">checkout matches parent pin</span>');
      }
      if (state.parentDirtyPin) {
        lines.push('<span class="warn">parent: modified gitlink (need commit)</span>');
      } else if (state.parentCommitted) {
        lines.push('<span class="ok">parent: clean</span>');
      }
      if (state.forgotPush) {
        lines.push('<span class="err">trap: parent pin points at SHA not on submodule remote</span>');
      }
    }
    statusBox.innerHTML = lines.join("\n");
  }

  function renderCards() {
    cardInit.classList.toggle("is-hot", !state.initialized);
    cardDetach.classList.toggle("is-hot", state.initialized && state.detached);
    cardPin.classList.toggle(
      "is-hot",
      state.initialized && (state.parentDirtyPin || state.forgotPush)
    );
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

  function renderStatusRow() {
    statusRow.innerHTML = state.initialized
      ? `<strong>ready</strong> · pin <code>${escapeHtml(state.parentPin)}</code> · checkout <code>${escapeHtml(
          state.checkout || "—"
        )}</code>`
      : `<strong>needs init</strong> · vendor/dv-lib empty`;
  }

  function renderAll() {
    renderTree();
    renderStatus();
    renderCards();
    renderLog();
    renderStatusRow();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# cloned chip repo — submodule folder empty");
    renderAll();
  }

  function doInit() {
    state.initialized = true;
    state.checkout = state.parentPin;
    state.detached = true;
    state.onBranch = false;
    state.didInit = true;
    state.didUpdate = true;
    state.lastAction = "init";
    pushLog("ok", `$ git submodule update --init --recursive`);
    pushLog("warn", `# vendor/dv-lib checked out ${state.checkout} (detached HEAD)`);
    renderAll();
  }

  function doDetachInfo() {
    if (!state.initialized) {
      pushLog("err", `# no checkout — init first`);
      state.lastAction = "inspect-empty";
      renderAll();
      return;
    }
    state.lastAction = "inspect";
    if (state.detached) {
      pushLog("warn", `$ git status  # inside vendor/dv-lib`);
      pushLog("warn", `# HEAD detached at ${state.checkout}`);
    } else {
      pushLog("ok", `$ git status  # inside vendor/dv-lib`);
      pushLog("ok", `# On branch main`);
    }
    renderAll();
  }

  function doBranch() {
    if (!state.initialized) {
      pushLog("err", `# init first`);
      state.lastAction = "branch-blocked";
      renderAll();
      return;
    }
    state.detached = false;
    state.onBranch = true;
    state.didCheckoutBranch = true;
    state.lastAction = "branch";
    pushLog("ok", `$ git switch main  # inside vendor/dv-lib`);
    pushLog("muted", `# no longer detached — still at ${state.checkout}`);
    renderAll();
  }

  function doBump() {
    if (!state.initialized) {
      pushLog("err", `# init first`);
      state.lastAction = "bump-blocked";
      renderAll();
      return;
    }
    state.checkout = PIN_NEW;
    state.parentDirtyPin = true;
    state.parentCommitted = false;
    state.submodulePushed = false;
    state.didBump = true;
    state.lastAction = "bump";
    // bumping often leaves you detached at new SHA if you checked out the SHA
    state.detached = true;
    state.onBranch = false;
    pushLog("ok", `# advanced submodule checkout to ${PIN_NEW}`);
    pushLog("warn", `# parent now sees modified gitlink (pin still ${state.parentPin})`);
    renderAll();
  }

  function doCommitParent() {
    if (!state.initialized) {
      pushLog("err", `# init first`);
      state.lastAction = "commit-blocked";
      renderAll();
      return;
    }
    if (!state.parentDirtyPin && state.checkout === state.parentPin) {
      pushLog("muted", `# nothing to commit in parent`);
      state.lastAction = "commit-noop";
      renderAll();
      return;
    }
    state.parentPin = state.checkout;
    state.parentDirtyPin = false;
    state.parentCommitted = true;
    state.didCommitParent = true;
    state.lastAction = "commit-parent";
    pushLog("ok", `$ git commit -am "chore: bump vendor/dv-lib"`);
    pushLog("muted", `# parent pin now ${state.parentPin}`);
    renderAll();
  }

  function doPushSub() {
    if (!state.initialized) return;
    state.submodulePushed = true;
    state.forgotPush = false;
    state.lastAction = "push-sub";
    pushLog("ok", `$ git push  # inside vendor/dv-lib`);
    pushLog("muted", `# remote has ${state.checkout}`);
    renderAll();
  }

  function doPushParent() {
    if (!state.parentCommitted || state.parentDirtyPin) {
      pushLog("warn", `# commit parent pin first`);
      state.lastAction = "push-parent-blocked";
      renderAll();
      return;
    }
    if (!state.submodulePushed && state.parentPin === PIN_NEW) {
      state.forgotPush = true;
      state.lastAction = "push-parent-orphan";
      pushLog("err", `$ git push  # parent`);
      pushLog("err", `# teammates will fail — pin ${PIN_NEW} missing on dv-lib remote`);
      renderAll();
      return;
    }
    state.forgotPush = false;
    state.lastAction = "push-parent";
    pushLog("ok", `$ git push  # parent`);
    pushLog("ok", `# others can clone --recurse-submodules successfully`);
    renderAll();
  }

  function doForget() {
    if (!state.initialized) {
      doInit();
    }
    state.checkout = PIN_NEW;
    state.parentPin = PIN_NEW;
    state.parentDirtyPin = false;
    state.parentCommitted = true;
    state.submodulePushed = false;
    state.forgotPush = true;
    state.detached = true;
    state.didBump = true;
    state.didCommitParent = true;
    state.lastAction = "forget-sim";
    pushLog("warn", `# simulated: parent committed pin ${PIN_NEW} without pushing submodule`);
    pushLog("err", `# classic footgun — remote lacks the SHA`);
    renderAll();
  }

  document.getElementById("btn-init").addEventListener("click", doInit);
  document.getElementById("btn-detach-info").addEventListener("click", doDetachInfo);
  document.getElementById("btn-branch").addEventListener("click", doBranch);
  document.getElementById("btn-bump").addEventListener("click", doBump);
  document.getElementById("btn-commit-parent").addEventListener("click", doCommitParent);
  document.getElementById("btn-push-sub").addEventListener("click", doPushSub);
  document.getElementById("btn-push-parent").addEventListener("click", doPushParent);
  document.getElementById("btn-forget").addEventListener("click", doForget);
  document.getElementById("sm-starter").addEventListener("click", loadStarter);

  const scenarioRow = document.getElementById("scenario-row");
  [
    ["Fresh clone (empty)", () => loadStarter()],
    [
      "Initialized",
      () => {
        loadStarter();
        doInit();
      },
    ],
    [
      "Pin bump pending",
      () => {
        loadStarter();
        doInit();
        doBump();
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
      id: "quiz-empty",
      title: "Quiz: empty",
      prompt: "After plain clone, submodule dirs are often? Answer: <code>empty</code>",
      hint: "forgotten init",
      type: "text",
      answer: "empty",
      alt: ["uninitialized", "not initialized"],
    },
    {
      id: "quiz-init",
      title: "Quiz: init",
      prompt: "Command family to populate? Answer: <code>submodule update --init</code>",
      hint: "git submodule …",
      type: "text",
      answer: "submodule update --init",
      alt: [
        "git submodule update --init",
        "git submodule update --init --recursive",
        "submodule update --init --recursive",
      ],
    },
    {
      id: "starter-empty",
      title: "Starter empty",
      prompt: "Load starter — vendor/dv-lib not initialized.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () => !state.initialized && state.cloned,
    },
    {
      id: "do-init",
      title: "Init update",
      prompt: "Run <strong>submodule update --init</strong> — checkout appears.",
      hint: "init button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.didInit &&
        state.initialized &&
        state.checkout === PIN_OLD &&
        state.detached,
    },
    {
      id: "quiz-detached",
      title: "Quiz: detached",
      prompt: "After update, submodule HEAD is usually? Answer: <code>detached</code>",
      hint: "pinned SHA",
      type: "text",
      answer: "detached",
      alt: ["detached head", "detached HEAD"],
    },
    {
      id: "inspect-detach",
      title: "See detached",
      prompt: "Init, then Inspect HEAD — log should mention detached.",
      hint: "init → inspect",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.initialized &&
        state.detached &&
        state.lastAction === "inspect" &&
        state.log.some((l) => /detached/i.test(l.text)),
    },
    {
      id: "switch-branch",
      title: "Switch branch",
      prompt: "Init, then <strong>git switch main</strong> inside submodule — not detached.",
      hint: "switch main button",
      type: "state",
      setup: () => {
        loadStarter();
        doInit();
      },
      check: () => state.didCheckoutBranch && !state.detached && state.onBranch,
    },
    {
      id: "quiz-pin",
      title: "Quiz: pin",
      prompt: "Parent records the submodule? Answer: <code>SHA</code> or <code>gitlink</code>",
      hint: "commit pointer",
      type: "text",
      answer: "sha",
      alt: ["gitlink", "commit sha", "commit", "pin"],
    },
    {
      id: "bump-dirty",
      title: "Bump dirty",
      prompt: "Init, advance submodule — parent gitlink dirty.",
      hint: "Advance submodule button",
      type: "state",
      setup: () => {
        loadStarter();
        doInit();
      },
      check: () =>
        state.didBump &&
        state.parentDirtyPin &&
        state.checkout === PIN_NEW &&
        state.parentPin === PIN_OLD,
    },
    {
      id: "commit-pin",
      title: "Commit pin",
      prompt: "After bump, commit parent — pin equals new checkout.",
      hint: "commit parent button",
      type: "state",
      setup: () => {
        loadStarter();
        doInit();
        doBump();
      },
      check: () =>
        state.didCommitParent &&
        !state.parentDirtyPin &&
        state.parentPin === PIN_NEW,
    },
    {
      id: "quiz-push-order",
      title: "Quiz: push order",
      prompt: "Push which first when bumping? Answer: <code>submodule</code>",
      hint: "remote must have the SHA",
      type: "text",
      answer: "submodule",
      alt: ["the submodule", "dv-lib", "vendor", "inner"],
    },
    {
      id: "forget-trap",
      title: "Forget push trap",
      prompt: "Run the simulate forget-push scenario — trap flag set.",
      hint: "Simulate forget button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.forgotPush && state.parentPin === PIN_NEW,
    },
    {
      id: "fix-forget",
      title: "Fix forget",
      prompt: "From forget trap, push submodule then parent — trap cleared.",
      hint: "push sub → push parent",
      type: "state",
      setup: () => {
        loadStarter();
        doForget();
      },
      check: () =>
        !state.forgotPush &&
        state.submodulePushed &&
        state.lastAction === "push-parent",
    },
    {
      id: "quiz-recurse",
      title: "Quiz: clone",
      prompt: "Clone flag to get submodules? Answer: <code>--recurse-submodules</code>",
      hint: "git clone …",
      type: "text",
      answer: "--recurse-submodules",
      alt: ["recurse-submodules", "--recursive"],
    },
    {
      id: "quiz-why-detach",
      title: "Quiz: why detach",
      prompt: "Detached checkout matches the? Answer: <code>pin</code>",
      hint: "recorded SHA",
      type: "text",
      answer: "pin",
      alt: ["parent pin", "gitlink", "recorded sha", "sha"],
    },
    {
      id: "full-bump-flow",
      title: "Full bump flow",
      prompt: "Init → bump → commit parent → push sub → push parent.",
      hint: "happy path",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.didInit &&
        state.didBump &&
        state.didCommitParent &&
        state.submodulePushed &&
        state.lastAction === "push-parent" &&
        !state.forgotPush &&
        state.parentPin === PIN_NEW,
    },
    {
      id: "push-parent-blocked",
      title: "Commit before push",
      prompt: "Init, bump, try push parent before commit — should block.",
      hint: "bump → push parent",
      type: "state",
      setup: () => {
        loadStarter();
        doInit();
        doBump();
      },
      check: () => state.lastAction === "push-parent-blocked",
    },
    {
      id: "quiz-gitmodules",
      title: "Quiz: gitmodules",
      prompt: "Submodule URL/path live in? Answer: <code>.gitmodules</code>",
      hint: "config file",
      type: "text",
      answer: ".gitmodules",
      alt: ["gitmodules"],
    },
    {
      id: "match-after-init",
      title: "Match after init",
      prompt: "After init, checkout equals parent pin.",
      hint: "init only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.initialized &&
        state.checkout === state.parentPin &&
        state.checkout === PIN_OLD,
    },
    {
      id: "quiz-ci",
      title: "Quiz: CI",
      prompt: "CI clones without recurse often fail building because vendor is? Answer: <code>empty</code>",
      hint: "same as local",
      type: "text",
      answer: "empty",
      alt: ["missing", "uninitialized"],
    },
    {
      id: "bump-redetach",
      title: "Bump re-detaches",
      prompt: "Init, switch branch, then bump — detached again at new SHA.",
      hint: "switch then advance",
      type: "state",
      setup: () => {
        loadStarter();
        doInit();
        doBranch();
      },
      check: () => state.didBump && state.detached && state.checkout === PIN_NEW,
    },
    {
      id: "starter-pin",
      title: "Starter pin",
      prompt: "Starter parent pin is? Answer: <code>s1a2b3c</code>",
      hint: "Load starter / tree",
      type: "text",
      answer: "s1a2b3c",
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use submodule actions, then Check.</span>`;
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
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
