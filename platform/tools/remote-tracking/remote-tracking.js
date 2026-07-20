(() => {
  /**
   * Three tips as commit id chains (newest last in array for easy append).
   * local = local main
   * tracking = origin/main (remote-tracking ref in local repo)
   * remote = actual origin server
   */
  function makeStarter() {
    const base = ["a100", "b200", "c300"];
    return {
      local: base.slice(),
      tracking: base.slice(),
      remote: base.slice(),
      upstream: "origin/main",
      lastAction: "",
      fetched: false,
      pulled: false,
      pushed: false,
      committed: false,
      remoteMoved: false,
      divergedOnce: false,
      log: [],
      flash: "",
      lastCmd: "git status",
    };
  }

  const CLEARED_KEY = "ddv-remote-tracking-cleared-v1";
  const STORE_KEY = "ddv-remote-tracking-session-v1";

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
  let flashTimer = 0;
  let seq = 1;

  const root = document.getElementById("rt-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Local <code>main</code>, tracking
        <code>origin/main</code>, and the real remote all match at <code>c300</code>.
        Commit locally (ahead), or simulate a teammate push (behind), then fetch/pull/push.</p>
      <button type="button" class="btn btn-secondary" id="rt-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Three places</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>fetch</h3>
            <p>Updates <code>origin/*</code> only — does not move your local branch.</p>
          </div>
          <div class="idea-card">
            <h3>pull</h3>
            <p>Fetch + integrate into current branch (merge by default in this lab).</p>
          </div>
        </div>
        <div class="scenario-row" id="scenario-row"></div>
        <div id="ab-pill" class="ab-pill synced">synced</div>
        <p class="status-row" id="status-row"></p>
        <div class="lane-grid">
          <div class="lane local" id="lane-local">
            <h3>main (local)</h3>
            <div class="sub">your branch tip</div>
            <pre id="pre-local"></pre>
          </div>
          <div class="lane tracking" id="lane-tracking">
            <h3>origin/main</h3>
            <div class="sub">remote-tracking ref (local cache)</div>
            <pre id="pre-tracking"></pre>
          </div>
          <div class="lane remote" id="lane-remote">
            <h3>origin (server)</h3>
            <div class="sub">true remote — others push here</div>
            <pre id="pre-remote"></pre>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Actions</h2></div>
        <div class="panel-body">
          <pre class="cmd-box" id="cmd-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-commit">git commit (local ahead +1)</button>
            <button type="button" id="btn-fetch">git fetch origin</button>
            <button type="button" id="btn-pull">git pull (fetch + merge)</button>
            <button type="button" id="btn-push">git push origin main</button>
            <button type="button" id="btn-teammate">Teammate pushes to origin</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Log</h2></div>
        <div class="panel-body">
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Ref</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>main</code></td><td>Your local branch</td></tr>
            <tr><td><code>origin/main</code></td><td>Last-seen tip of remote main (after fetch/push)</td></tr>
            <tr><td><code>git fetch</code></td><td>Refresh <code>origin/*</code> from server</td></tr>
            <tr><td><code>git pull</code></td><td>Fetch + merge/rebase into current branch</td></tr>
            <tr><td><code>git push</code></td><td>Publish local commits; updates remote (+ tracking)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Ahead = local commits not on <code>origin/main</code>. Behind = remote commits you have not merged.</li>
          <li>Fetch never changes your working tree or local branch tip.</li>
          <li>Set upstream once: <code>git push -u origin main</code> (lab assumes it is set).</li>
        </ul>
      </div>
    </div>
  `;

  const preLocal = document.getElementById("pre-local");
  const preTracking = document.getElementById("pre-tracking");
  const preRemote = document.getElementById("pre-remote");
  const laneLocal = document.getElementById("lane-local");
  const laneTracking = document.getElementById("lane-tracking");
  const laneRemote = document.getElementById("lane-remote");
  const abPill = document.getElementById("ab-pill");
  const statusRow = document.getElementById("status-row");
  const logBox = document.getElementById("log-box");
  const cmdBox = document.getElementById("cmd-box");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function tip(arr) {
    return arr[arr.length - 1];
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 50) state.log = state.log.slice(-40);
  }

  function newId(prefix) {
    const id = prefix + String(100 + seq++);
    return id;
  }

  /** commits in a not in b (by id), counting from divergence — simple: length diff if prefix shared */
  function aheadBehind(a, b) {
    // find common prefix length
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const ahead = a.length - i;
    const behind = b.length - i;
    return { ahead, behind };
  }

  function relation() {
    // compare local vs tracking (what status usually shows vs upstream)
    return aheadBehind(state.local, state.tracking);
  }

  function flash(which) {
    state.flash = which;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      state.flash = "";
      renderLanes();
    }, 650);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ state: { ...state, flash: "" }, challengeIdx, seq })
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
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state, flash: "" };
      challengeIdx = Number(data.challengeIdx) || 0;
      seq = Number(data.seq) || 1;
      return true;
    } catch {
      return false;
    }
  }

  function formatChain(arr) {
    return arr.map((id, i) => (i === arr.length - 1 ? `* ${id} (tip)` : `  ${id}`)).join("\n");
  }

  function renderLanes() {
    preLocal.textContent = formatChain(state.local);
    preTracking.textContent = formatChain(state.tracking);
    preRemote.textContent = formatChain(state.remote);
    [laneLocal, laneTracking, laneRemote].forEach((el) => el.classList.remove("is-flash"));
    if (state.flash === "local") laneLocal.classList.add("is-flash");
    if (state.flash === "tracking") laneTracking.classList.add("is-flash");
    if (state.flash === "remote") laneRemote.classList.add("is-flash");
  }

  function renderAb() {
    const { ahead, behind } = relation();
    let kind = "synced";
    let text = "synced with origin/main";
    if (ahead && behind) {
      kind = "diverged";
      text = `diverged: ahead ${ahead}, behind ${behind}`;
    } else if (ahead) {
      kind = "ahead";
      text = `ahead ${ahead} of origin/main`;
    } else if (behind) {
      kind = "behind";
      text = `behind ${behind} of origin/main`;
    }
    abPill.className = "ab-pill " + kind;
    abPill.textContent = text;
    statusRow.innerHTML = `<strong>upstream</strong> ${escapeHtml(state.upstream)} · local <code>${escapeHtml(
      tip(state.local)
    )}</code> · origin/main <code>${escapeHtml(tip(state.tracking))}</code> · server <code>${escapeHtml(
      tip(state.remote)
    )}</code>`;
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
    cmdBox.textContent = state.lastCmd;
    renderLanes();
    renderAb();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    seq = 1;
    state.lastAction = "load-starter";
    state.lastCmd = "git status";
    pushLog("muted", "# all three tips match at c300");
    renderAll();
  }

  function doCommit() {
    const id = newId("l");
    state.local.push(id);
    state.committed = true;
    state.lastAction = "commit";
    state.lastCmd = `git commit -m "wip ${id}"`;
    pushLog("ok", `$ ${state.lastCmd}`);
    pushLog("muted", `# local main ahead — origin/main unchanged`);
    flash("local");
    renderAll();
  }

  function doFetch() {
    // tracking ← remote
    const before = tip(state.tracking);
    state.tracking = state.remote.slice();
    state.fetched = true;
    state.lastAction = "fetch";
    state.lastCmd = "git fetch origin";
    pushLog("flow", `$ git fetch origin`);
    if (tip(state.tracking) === before) {
      pushLog("muted", `# origin/main already up to date`);
    } else {
      pushLog("ok", `# origin/main ${before} → ${tip(state.tracking)} (local main untouched)`);
    }
    flash("tracking");
    renderAll();
  }

  function doPull() {
    // fetch then merge remote into local (fast-forward if possible)
    state.tracking = state.remote.slice();
    const { ahead, behind } = aheadBehind(state.local, state.tracking);
    state.lastCmd = "git pull origin main";
    pushLog("flow", `$ git pull origin main`);
    if (ahead && behind) {
      state.divergedOnce = true;
      // create merge commit
      const id = newId("m");
      state.local.push(id);
      // after merge, local contains tracking history — simplify: set local to tracking + merge
      state.local = state.tracking.slice();
      state.local.push(id);
      state.lastAction = "pull-merge";
      pushLog("warn", `# diverged — merge commit ${id}`);
    } else if (behind) {
      state.local = state.tracking.slice();
      state.lastAction = "pull-ff";
      pushLog("ok", `# fast-forward to ${tip(state.local)}`);
    } else if (ahead) {
      state.lastAction = "pull-noop-ahead";
      pushLog("muted", `# already up to date with origin/main (still ahead to push)`);
    } else {
      state.lastAction = "pull-noop";
      pushLog("muted", `# already up to date`);
    }
    state.pulled = true;
    state.fetched = true;
    flash("local");
    renderAll();
  }

  function doPush() {
    const { ahead, behind } = aheadBehind(state.local, state.remote);
    state.lastCmd = "git push origin main";
    if (behind) {
      state.lastAction = "push-rejected";
      pushLog("err", `$ git push origin main`);
      pushLog("err", `# rejected — remote has commits you lack (fetch/pull first)`);
      renderAll();
      return;
    }
    if (!ahead) {
      state.lastAction = "push-noop";
      pushLog("muted", `$ git push origin main`);
      pushLog("muted", `# everything up-to-date`);
      renderAll();
      return;
    }
    state.remote = state.local.slice();
    state.tracking = state.local.slice();
    state.pushed = true;
    state.lastAction = "push";
    pushLog("ok", `$ git push origin main`);
    pushLog("muted", `# server + origin/main now ${tip(state.remote)}`);
    flash("remote");
    renderAll();
  }

  function doTeammate() {
    const id = newId("r");
    state.remote.push(id);
    state.remoteMoved = true;
    state.lastAction = "teammate";
    state.lastCmd = "# teammate: git push origin main";
    pushLog("warn", `# teammate pushed ${id} to origin (your origin/main stale until fetch)`);
    flash("remote");
    renderAll();
  }

  document.getElementById("btn-commit").addEventListener("click", doCommit);
  document.getElementById("btn-fetch").addEventListener("click", doFetch);
  document.getElementById("btn-pull").addEventListener("click", doPull);
  document.getElementById("btn-push").addEventListener("click", doPush);
  document.getElementById("btn-teammate").addEventListener("click", doTeammate);
  document.getElementById("rt-starter").addEventListener("click", loadStarter);

  const scenarioRow = document.getElementById("scenario-row");
  [
    ["Synced starter", () => loadStarter()],
    [
      "Local ahead",
      () => {
        loadStarter();
        doCommit();
      },
    ],
    [
      "Behind (teammate)",
      () => {
        loadStarter();
        doTeammate();
      },
    ],
    [
      "Diverged",
      () => {
        loadStarter();
        doCommit();
        doTeammate();
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
      id: "quiz-origin-main",
      title: "Quiz: origin/main",
      prompt: "<code>origin/main</code> is a? Answer: <code>remote-tracking</code> branch",
      hint: "local cache of remote",
      type: "text",
      answer: "remote-tracking",
      alt: ["remote tracking", "tracking", "remote-tracking branch"],
    },
    {
      id: "quiz-fetch",
      title: "Quiz: fetch",
      prompt: "<code>git fetch</code> updates which ref? Answer: <code>origin/main</code>",
      hint: "not local main",
      type: "text",
      answer: "origin/main",
      alt: ["origin/*", "remote-tracking", "tracking branches"],
    },
    {
      id: "quiz-pull",
      title: "Quiz: pull",
      prompt: "Pull is roughly fetch plus? Answer: <code>merge</code>",
      hint: "or rebase if configured",
      type: "text",
      answer: "merge",
      alt: ["integrate", "merge or rebase", "rebase"],
    },
    {
      id: "starter-synced",
      title: "Starter synced",
      prompt: "Load starter — local, tracking, and server tips all equal.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        tip(state.local) === tip(state.tracking) &&
        tip(state.tracking) === tip(state.remote) &&
        relation().ahead === 0 &&
        relation().behind === 0,
    },
    {
      id: "commit-ahead",
      title: "Go ahead",
      prompt: "Commit once — status should show ahead 1.",
      hint: "commit button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.committed && relation().ahead === 1 && relation().behind === 0,
    },
    {
      id: "fetch-no-move-local",
      title: "Fetch keeps local",
      prompt: "Commit, teammate push, then fetch — local tip unchanged; origin/main catches server.",
      hint: "commit → teammate → fetch",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const { ahead, behind } = relation();
        return (
          state.fetched &&
          state.committed &&
          state.remoteMoved &&
          tip(state.tracking) === tip(state.remote) &&
          tip(state.local) !== tip(state.tracking) &&
          ahead >= 1 &&
          behind >= 1
        );
      },
    },
    {
      id: "teammate-behind",
      title: "Behind after teammate",
      prompt: "From starter, teammate push then fetch — behind ≥ 1.",
      hint: "teammate → fetch",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.remoteMoved &&
        state.fetched &&
        relation().behind >= 1 &&
        relation().ahead === 0,
    },
    {
      id: "push-publishes",
      title: "Push publishes",
      prompt: "Commit then push — server and origin/main match local.",
      hint: "commit → push",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.pushed &&
        tip(state.local) === tip(state.remote) &&
        tip(state.tracking) === tip(state.local),
    },
    {
      id: "push-rejected",
      title: "Push rejected",
      prompt: "Teammate push (don't fetch), commit, then push — should reject.",
      hint: "teammate → commit → push",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "push-rejected",
    },
    {
      id: "pull-ff",
      title: "Pull FF",
      prompt: "Teammate push, then pull — fast-forward local to server tip.",
      hint: "teammate → pull",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.pulled &&
        state.lastAction === "pull-ff" &&
        tip(state.local) === tip(state.remote),
    },
    {
      id: "pull-diverged",
      title: "Pull merge",
      prompt: "Diverged scenario, then pull — merge commit path.",
      hint: "Diverged preset → pull",
      type: "state",
      setup: () => {
        loadStarter();
        doCommit();
        doTeammate();
      },
      check: () => state.pulled && (state.lastAction === "pull-merge" || state.divergedOnce),
    },
    {
      id: "quiz-ahead",
      title: "Quiz: ahead",
      prompt: "Local commits not on origin/main means you are? Answer: <code>ahead</code>",
      hint: "need to push",
      type: "text",
      answer: "ahead",
      alt: ["ahead of origin", "ahead of origin/main"],
    },
    {
      id: "quiz-behind",
      title: "Quiz: behind",
      prompt: "Remote has commits you lack — you are? Answer: <code>behind</code>",
      hint: "need to pull",
      type: "text",
      answer: "behind",
      alt: ["behind origin", "behind origin/main"],
    },
    {
      id: "quiz-upstream",
      title: "Quiz: upstream",
      prompt: "Lab upstream for main is? Answer: <code>origin/main</code>",
      hint: "tracking branch",
      type: "text",
      answer: "origin/main",
    },
    {
      id: "fetch-only-tracking",
      title: "Fetch ≠ pull",
      prompt: "Teammate push + fetch only — local still at <code>c300</code>, tracking moved.",
      hint: "don't pull",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        tip(state.local) === "c300" &&
        tip(state.tracking) !== "c300" &&
        tip(state.tracking) === tip(state.remote) &&
        state.fetched,
    },
    {
      id: "quiz-not-local",
      title: "Quiz: not local",
      prompt: "Does fetch move <code>main</code>? Answer: <code>no</code>",
      hint: "only origin/*",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "synced-after-push",
      title: "Synced after push",
      prompt: "From ahead state, push until relation shows synced (ahead 0 behind 0).",
      hint: "commit → push",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.pushed && relation().ahead === 0 && relation().behind === 0,
    },
    {
      id: "quiz-pull-eq",
      title: "Quiz: pull parts",
      prompt: "Pull ≈ ? Answer: <code>fetch + merge</code>",
      hint: "two steps",
      type: "text",
      answer: "fetch + merge",
      alt: ["fetch and merge", "fetch+merge", "git fetch && git merge"],
    },
    {
      id: "stale-tracking",
      title: "Stale tracking",
      prompt: "After teammate push (no fetch), tracking tip ≠ server tip.",
      hint: "teammate only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.remoteMoved &&
        tip(state.tracking) !== tip(state.remote) &&
        tip(state.tracking) === "c300",
    },
    {
      id: "quiz-push-u",
      title: "Quiz: -u",
      prompt: "Flag to set upstream on first push? Answer: <code>-u</code>",
      hint: "--set-upstream",
      type: "text",
      answer: "-u",
      alt: ["-u", "--set-upstream", "push -u"],
    },
    {
      id: "three-equal-start",
      title: "Three equal",
      prompt: "Starter: how many commits in each chain? (number)",
      hint: "a100 b200 c300",
      type: "text",
      answer: "3",
      setup: () => loadStarter(),
    },
    {
      id: "roundtrip",
      title: "Roundtrip",
      prompt: "Commit, push, teammate, pull — end synced with server.",
      hint: "full loop",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.committed &&
        state.pushed &&
        state.remoteMoved &&
        state.pulled &&
        tip(state.local) === tip(state.remote) &&
        tip(state.tracking) === tip(state.remote),
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use fetch/pull/push actions, then Check.</span>`;
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
