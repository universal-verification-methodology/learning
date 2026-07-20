(() => {
  /**
   * prefer: 'rebase' | 'merge' | 'either'
   * either = both acceptable; picking either passes choice challenges
   */
  const SCENARIOS = [
    {
      id: "private-update",
      title: "Private feature: update from main",
      blurb:
        "Your <code>feature/alu-mul</code> branch is only on your laptop. Main moved ahead with docs. You want a straight history before opening a PR.",
      tags: ["private", "not pushed", "linear preferred"],
      prefer: "rebase",
      whyRebase:
        "Nobody else has your commits — rewriting with rebase keeps a clean linear PR.",
      whyMerge:
        "Merge works but adds a merge commit noise you usually do not need on a private branch.",
      before: [
        "main:   A──B──C──D",
        "feat:   A──B──E──F",
        "              ↑ your WIP (local only)",
      ],
      afterRebase: [
        "main:   A──B──C──D",
        "feat:            D──E'──F'   (replayed)",
      ],
      afterMerge: [
        "main:   A──B──C──D",
        "feat:   A──B──E──F──M",
        "              └──C──D┘",
      ],
    },
    {
      id: "shared-feature",
      title: "Shared feature branch",
      blurb:
        "You and Bea both push to <code>feature/alu-mul</code>. Main moved. Updating via rewrite would force everyone to reset.",
      tags: ["shared", "pushed", "collaborators"],
      prefer: "merge",
      whyRebase:
        "Rebase rewrites shared commits — teammates must recover; avoid unless coordinated.",
      whyMerge:
        "Merge main into the feature branch preserves shared SHAs; safe default.",
      before: [
        "main:   A──B──C──D",
        "feat:   A──B──E──F   (on origin, Bea has F)",
      ],
      afterRebase: [
        "feat:            D──E'──F'  ← new SHAs; Bea's F is stale",
        "<span class=\"muted\">needs force-push + teammate reset</span>",
      ],
      afterMerge: [
        "feat:   A──B──E──F──M",
        "              └──C──D┘     shared history intact",
      ],
    },
    {
      id: "integrate-main",
      title: "Land feature onto main",
      blurb:
        "PR is approved. Team policy is merge commits on main for clear integration points (GitHub “Create a merge commit”).",
      tags: ["main", "integration", "policy: merge"],
      prefer: "merge",
      whyRebase:
        "Rebase-onto-main then fast-forward is fine if policy wants linear main — but this team asked for merge commits.",
      whyMerge:
        "Merge preserves the branch topology and records when the feature landed.",
      before: [
        "main:   A──B──C──D",
        "feat:            D──E──F",
      ],
      afterRebase: [
        "main:   A──B──C──D──E'──F'   (if ff after rebase)",
        "<span class=\"muted\">linear — other teams prefer this</span>",
      ],
      afterMerge: [
        "main:   A──B──C──D──────M",
        "               └──E──F┘",
      ],
    },
    {
      id: "already-pushed-solo",
      title: "Solo branch already on origin",
      blurb:
        "Only you use the remote branch. You want to rebase onto main before merge. You are willing to force-with-lease.",
      tags: ["solo", "pushed", "force-with-lease ok"],
      prefer: "rebase",
      whyRebase:
        "Solo remote branch + force-with-lease is a common tidy-up before PR.",
      whyMerge:
        "Merging main in is safer if you dislike force-push — also acceptable.",
      eitherNote: "Both ok; lab prefers rebase for linear PR when solo.",
      before: [
        "origin/feat and local feat: A──B──E──F",
        "main ahead:                 A──B──C──D",
      ],
      afterRebase: [
        "feat:  D──E'──F'  then push --force-with-lease",
      ],
      afterMerge: [
        "feat:  E──F──M (merged D)  plain push",
      ],
    },
    {
      id: "hotfix-from-main",
      title: "Hotfix branch from main",
      blurb:
        "Production bug. Short <code>hotfix/reset</code> off main. You will merge back to main and develop.",
      tags: ["hotfix", "short-lived", "merge back"],
      prefer: "merge",
      whyRebase:
        "Rebasing a hotfix onto develop can confuse which fix shipped where.",
      whyMerge:
        "Merge hotfix into main (and usually into develop) keeps the shipped commit identifiable.",
      before: [
        "main:    A──B──C",
        "hotfix:       C──H",
      ],
      afterRebase: [
        "rarely used for hotfixes that already identify a shipped SHA",
      ],
      afterMerge: [
        "main: A──B──C──M",
        "           └──H┘",
      ],
    },
    {
      id: "cleanup-before-review",
      title: "Clean local WIP before review",
      blurb:
        "Five messy local commits on an unpushed branch. You want one logical series on latest main for reviewers.",
      tags: ["private", "linear", "review"],
      prefer: "rebase",
      whyRebase:
        "Rebase (and optionally squash later) gives reviewers a readable straight line.",
      whyMerge:
        "Merging main first keeps mess + a merge commit — harder to review.",
      before: [
        "main: A──B──C──D",
        "feat: A──B──w──x──y──z  (messy local)",
      ],
      afterRebase: [
        "feat: D──w'──x'──y'──z'",
      ],
      afterMerge: [
        "feat: w──x──y──z──M",
        "           └──C──D┘",
      ],
    },
    {
      id: "long-lived-release",
      title: "Long-lived release branch",
      blurb:
        "<code>release/0.2</code> is shared. Periodically need fixes from main. Do not rewrite published release history.",
      tags: ["shared", "release", "published"],
      prefer: "merge",
      whyRebase:
        "Rebasing a published release branch rewrites history others depend on.",
      whyMerge:
        "Merge main (or cherry-pick) into release — stable SHAs.",
      before: [
        "main:    A──B──C──D──E",
        "release: A──B──C──R1──R2",
      ],
      afterRebase: [
        "release rewritten — dangerous if already tagged/shared",
      ],
      afterMerge: [
        "release: R1──R2──M",
        "              └──D──E┘",
      ],
    },
    {
      id: "sync-fork-pr",
      title: "Update your PR after main moves",
      blurb:
        "Open PR from your fork/branch. Branch is yours alone. Reviewers prefer a linear commit list.",
      tags: ["PR", "solo", "linear"],
      prefer: "rebase",
      whyRebase:
        "Classic “Update with rebase” on a personal PR branch.",
      whyMerge:
        "“Update with merge commit” is OK if the host defaults that way.",
      before: [
        "main:  A──B──C──D",
        "PR:    A──B──E──F",
      ],
      afterRebase: ["PR: D──E'──F'"],
      afterMerge: ["PR: E──F──M←D"],
    },
  ];

  function defaultState() {
    return {
      scenarioIdx: 0,
      lastChoice: "",
      lastCorrect: null,
      choices: {}, // scenarioId -> 'rebase'|'merge'
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-git-rebase-merge-cleared-v1";
  const STORE_KEY = "ddv-git-rebase-merge-session-v1";

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
  /** @type {ReturnType<typeof defaultState>} */
  let state = defaultState();

  const root = document.getElementById("rm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Private feature updating from main —
        prefer <code>rebase</code> for a linear PR. Shared branches prefer <code>merge</code>.</p>
      <button type="button" class="btn btn-secondary" id="rm-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Rule of thumb</h2></div>
      <div class="panel-body">
        <div class="rule-grid">
          <div class="rule-card rebase">
            <h3>Rebase when</h3>
            <p>Branch is yours alone (or team agrees). You want a linear story onto latest main.</p>
          </div>
          <div class="rule-card merge">
            <h3>Merge when</h3>
            <p>Commits are shared / published. You must not rewrite SHAs others already pulled.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Scenario</h2></div>
        <div class="panel-body">
          <div class="nav-row" id="nav-row"></div>
          <p class="status-row" id="status-row"></p>
          <div class="scenario-card" id="scenario-card"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>History shape</h2></div>
        <div class="panel-body">
          <h3 style="font-size:0.9rem;margin:0 0 0.35rem">Before</h3>
          <pre class="graph-box" id="graph-before"></pre>
          <h3 style="font-size:0.9rem;margin:0.75rem 0 0.35rem">After your choice</h3>
          <pre class="graph-box" id="graph-after"></pre>
          <h3 style="font-size:0.9rem;margin:0.75rem 0 0.35rem">Why</h3>
          <pre class="why-box" id="why-box"></pre>
          <h3 style="font-size:0.9rem;margin:0.75rem 0 0.35rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Question</th><th>Lean toward</th></tr></thead>
          <tbody>
            <tr><td>Have others pulled these commits?</td><td>Merge (or coordinate carefully)</td></tr>
            <tr><td>Only local / solo remote branch?</td><td>Rebase for linear PR</td></tr>
            <tr><td>Landing onto main with merge policy?</td><td>Merge commit</td></tr>
            <tr><td>Published release / tag branch?</td><td>Merge — never rewrite</td></tr>
            <tr><td>Need interactive squash?</td><td>Out of scope here — do later, still private</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Rebase replays commits → new SHAs. Merge adds a join commit → SHAs kept.</li>
          <li>If you rebase a published branch, use <code>--force-with-lease</code>, not blind <code>--force</code>.</li>
          <li>This lab skips interactive rebase (<code>-i</code>); the chooser still applies.</li>
        </ul>
      </div>
    </div>
  `;

  const navRow = document.getElementById("nav-row");
  const scenarioCard = document.getElementById("scenario-card");
  const graphBefore = document.getElementById("graph-before");
  const graphAfter = document.getElementById("graph-after");
  const whyBox = document.getElementById("why-box");
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
    if (state.log.length > 40) state.log = state.log.slice(-30);
  }

  function current() {
    return SCENARIOS[state.scenarioIdx];
  }

  function isChoiceOk(scenario, choice) {
    if (scenario.prefer === "either") return choice === "rebase" || choice === "merge";
    // already-pushed-solo: prefer rebase but accept merge as soft
    if (scenario.id === "already-pushed-solo") return choice === "rebase" || choice === "merge";
    return choice === scenario.prefer;
  }

  function preferredLabel(scenario) {
    if (scenario.id === "already-pushed-solo") return "rebase (merge also ok)";
    return scenario.prefer;
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
      state = { ...defaultState(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function renderNav() {
    navRow.innerHTML = "";
    SCENARIOS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const picked = state.choices[s.id];
      b.textContent = (picked ? "✓ " : "") + (i + 1);
      if (i === state.scenarioIdx) b.classList.add("is-active");
      b.title = s.title;
      b.addEventListener("click", () => {
        state.scenarioIdx = i;
        state.lastChoice = state.choices[s.id] || "";
        state.lastCorrect = null;
        renderAll();
      });
      navRow.appendChild(b);
    });
  }

  function renderScenario() {
    const s = current();
    const tags = s.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    scenarioCard.innerHTML = `
      <h3>${escapeHtml(s.title)}</h3>
      <p>${s.blurb}</p>
      <div class="tags">${tags}</div>
      <div class="choice-row">
        <button type="button" data-choice="rebase" id="btn-rebase">rebase</button>
        <button type="button" data-choice="merge" id="btn-merge">merge</button>
      </div>
    `;
    const prev = state.choices[s.id] || state.lastChoice;
    ["rebase", "merge"].forEach((c) => {
      const btn = scenarioCard.querySelector(`[data-choice="${c}"]`);
      if (prev === c) btn.classList.add("is-picked");
      if (state.lastCorrect !== null && prev === c) {
        btn.classList.add(state.lastCorrect ? "is-correct" : "is-wrong");
      }
      btn.addEventListener("click", () => choose(c));
    });
  }

  function colorizeGraph(lines) {
    return lines
      .map((line) => {
        let html = line;
        // already may contain spans
        if (!html.includes("<")) html = escapeHtml(html);
        html = html
          .replace(/\bmain:/g, '<span class="main">main:</span>')
          .replace(/\bfeat:/g, '<span class="feat">feat:</span>')
          .replace(/\bPR:/g, '<span class="feat">PR:</span>')
          .replace(/\bhotfix:/g, '<span class="feat">hotfix:</span>')
          .replace(/\brelease:/g, '<span class="feat">release:</span>')
          .replace(/\bM\b/g, '<span class="merge">M</span>');
        return html;
      })
      .join("\n");
  }

  function renderGraphs() {
    const s = current();
    graphBefore.innerHTML = colorizeGraph(s.before);
    const choice = state.choices[s.id] || state.lastChoice;
    if (!choice) {
      graphAfter.innerHTML = '<span class="muted">(pick rebase or merge)</span>';
      whyBox.innerHTML = '<span class="muted">Choose a strategy to see the resulting shape.</span>';
      return;
    }
    const after = choice === "rebase" ? s.afterRebase : s.afterMerge;
    graphAfter.innerHTML = colorizeGraph(after);
    const ok = isChoiceOk(s, choice);
    const why =
      choice === "rebase"
        ? s.whyRebase
        : s.whyMerge;
    whyBox.innerHTML = `<span class="${ok ? "ok" : "warn"}">${ok ? "Fits this scenario." : "Works technically, but not the best default here."}</span>\n${escapeHtml(why)}${
      s.eitherNote && choice ? "\n" + escapeHtml(s.eitherNote) : ""
    }\n<span class="muted">Lab preference: ${escapeHtml(preferredLabel(s))}</span>`;
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no choices yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderStatus() {
    const done = Object.keys(state.choices).length;
    statusRow.innerHTML = `<strong>Scenario ${state.scenarioIdx + 1}/${SCENARIOS.length}</strong> · ${done} decided`;
  }

  function renderAll() {
    renderNav();
    renderScenario();
    renderGraphs();
    renderLog();
    renderStatus();
    saveSession();
  }

  function choose(choice) {
    const s = current();
    state.lastChoice = choice;
    state.choices[s.id] = choice;
    state.lastCorrect = isChoiceOk(s, choice);
    const verb = choice === "rebase" ? "git rebase main" : "git merge main";
    pushLog(state.lastCorrect ? "ok" : "warn", `${s.id}: chose ${choice} · ${verb}`);
    renderAll();
  }

  function loadStarter() {
    state = defaultState();
    pushLog("muted", "# starter: private feature → prefer rebase");
    renderAll();
  }

  document.getElementById("rm-starter").addEventListener("click", loadStarter);

  function countCorrect() {
    return SCENARIOS.filter((s) => {
      const c = state.choices[s.id];
      return c && isChoiceOk(s, c);
    }).length;
  }

  const CHALLENGES = [
    {
      id: "quiz-rewrite",
      title: "Quiz: rewrite",
      prompt: "Which rewrites commit SHAs? Answer: <code>rebase</code>",
      hint: "replays commits",
      type: "text",
      answer: "rebase",
      alt: ["git rebase"],
    },
    {
      id: "quiz-keep",
      title: "Quiz: keep SHAs",
      prompt: "Which keeps existing commit IDs? Answer: <code>merge</code>",
      hint: "adds a join commit",
      type: "text",
      answer: "merge",
      alt: ["git merge"],
    },
    {
      id: "quiz-shared",
      title: "Quiz: shared",
      prompt: "Shared branch already pulled by teammates — prefer? Answer: <code>merge</code>",
      hint: "don't rewrite others' history",
      type: "text",
      answer: "merge",
    },
    {
      id: "quiz-private",
      title: "Quiz: private",
      prompt: "Private unpushed feature updating from main — prefer? Answer: <code>rebase</code>",
      hint: "linear PR",
      type: "text",
      answer: "rebase",
    },
    {
      id: "pick-private",
      title: "Pick: private",
      prompt: "Open scenario 1 (Private feature) and choose <strong>rebase</strong>.",
      hint: "nav button 1",
      type: "state",
      setup: () => {
        state.scenarioIdx = 0;
        renderAll();
      },
      check: () => state.choices["private-update"] === "rebase",
    },
    {
      id: "pick-shared",
      title: "Pick: shared",
      prompt: "Scenario 2 (Shared feature) — choose <strong>merge</strong>.",
      hint: "nav 2",
      type: "state",
      setup: () => {
        state.scenarioIdx = 1;
        renderAll();
      },
      check: () => state.choices["shared-feature"] === "merge",
    },
    {
      id: "pick-integrate",
      title: "Pick: land on main",
      prompt: "Scenario 3 (Land feature) with merge policy — choose <strong>merge</strong>.",
      hint: "nav 3",
      type: "state",
      setup: () => {
        state.scenarioIdx = 2;
        renderAll();
      },
      check: () => state.choices["integrate-main"] === "merge",
    },
    {
      id: "pick-solo-remote",
      title: "Pick: solo remote",
      prompt: "Scenario 4 — choose <strong>rebase</strong> (merge also accepted by lab scoring here).",
      hint: "nav 4",
      type: "state",
      setup: () => {
        state.scenarioIdx = 3;
        renderAll();
      },
      check: () => {
        const c = state.choices["already-pushed-solo"];
        return c === "rebase" || c === "merge";
      },
    },
    {
      id: "pick-hotfix",
      title: "Pick: hotfix",
      prompt: "Scenario 5 (Hotfix) — choose <strong>merge</strong>.",
      hint: "nav 5",
      type: "state",
      setup: () => {
        state.scenarioIdx = 4;
        renderAll();
      },
      check: () => state.choices["hotfix-from-main"] === "merge",
    },
    {
      id: "pick-cleanup",
      title: "Pick: cleanup",
      prompt: "Scenario 6 (Clean local WIP) — choose <strong>rebase</strong>.",
      hint: "nav 6",
      type: "state",
      setup: () => {
        state.scenarioIdx = 5;
        renderAll();
      },
      check: () => state.choices["cleanup-before-review"] === "rebase",
    },
    {
      id: "pick-release",
      title: "Pick: release",
      prompt: "Scenario 7 (Long-lived release) — choose <strong>merge</strong>.",
      hint: "nav 7",
      type: "state",
      setup: () => {
        state.scenarioIdx = 6;
        renderAll();
      },
      check: () => state.choices["long-lived-release"] === "merge",
    },
    {
      id: "pick-pr",
      title: "Pick: PR update",
      prompt: "Scenario 8 (Update PR) — choose <strong>rebase</strong>.",
      hint: "nav 8",
      type: "state",
      setup: () => {
        state.scenarioIdx = 7;
        renderAll();
      },
      check: () => state.choices["sync-fork-pr"] === "rebase",
    },
    {
      id: "quiz-force",
      title: "Quiz: force",
      prompt: "After rebasing a solo remote branch, push with? Answer: <code>--force-with-lease</code>",
      hint: "safer than --force",
      type: "text",
      answer: "--force-with-lease",
      alt: ["force-with-lease", "git push --force-with-lease"],
    },
    {
      id: "quiz-linear",
      title: "Quiz: linear",
      prompt: "Tool that tends to produce linear feature history? Answer: <code>rebase</code>",
      hint: "replay onto tip",
      type: "text",
      answer: "rebase",
    },
    {
      id: "see-after-graph",
      title: "See after graph",
      prompt: "On scenario 1, pick rebase — after graph should mention replayed commits.",
      hint: "choose rebase on private feature",
      type: "state",
      setup: () => {
        state.scenarioIdx = 0;
        renderAll();
      },
      check: () =>
        state.choices["private-update"] === "rebase" &&
        /E'/.test(SCENARIOS[0].afterRebase.join("\n")),
    },
    {
      id: "quiz-no-i",
      title: "Quiz: no -i",
      prompt: "This lab covers interactive rebase? Answer: <code>no</code>",
      hint: "chooser only",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "five-correct",
      title: "Five correct",
      prompt: "Make correct (or accepted) choices on at least 5 scenarios.",
      hint: "work through nav 1–5+",
      type: "state",
      check: () => countCorrect() >= 5,
    },
    {
      id: "all-eight",
      title: "All eight",
      prompt: "Decide all 8 scenarios with lab-accepted answers.",
      hint: "complete every nav item",
      type: "state",
      check: () => countCorrect() >= 8 && Object.keys(state.choices).length >= 8,
    },
    {
      id: "quiz-merge-commit",
      title: "Quiz: M",
      prompt: "In the diagrams, <code>M</code> stands for a? Answer: <code>merge commit</code>",
      hint: "join node",
      type: "text",
      answer: "merge commit",
      alt: ["merge", "merge node"],
    },
    {
      id: "quiz-published",
      title: "Quiz: published",
      prompt: "Published release branch — never? Answer: <code>rebase</code> (rewrite)",
      hint: "don't rewrite",
      type: "text",
      answer: "rebase",
      alt: ["rewrite", "rebase it", "force push"],
    },
    {
      id: "wrong-then-fix",
      title: "Fix shared pick",
      prompt: "On shared feature (scenario 2), if you picked rebase, switch to <strong>merge</strong>.",
      hint: "nav 2 → merge",
      type: "state",
      setup: () => {
        state.scenarioIdx = 1;
        renderAll();
      },
      check: () => state.choices["shared-feature"] === "merge",
    },
    {
      id: "starter-scenario",
      title: "Starter scenario",
      prompt: "Load starter — scenario 1 selected. Prefer rebase? Answer: <code>yes</code>",
      hint: "Load starter example",
      type: "text",
      answer: "yes",
      alt: ["y", "true", "rebase"],
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Pick rebase/merge on scenarios, then Check.</span>`;
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
