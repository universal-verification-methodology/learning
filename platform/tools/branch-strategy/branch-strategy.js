(() => {
  const PREFIXES = [
    { id: "feature", label: "feature/", use: "New capability / RTL feature" },
    { id: "fix", label: "fix/", use: "Bug fix (non-urgent)" },
    { id: "hotfix", label: "hotfix/", use: "Urgent production fix" },
    { id: "docs", label: "docs/", use: "Docs / comments only" },
    { id: "chore", label: "chore/", use: "Build, CI, tooling" },
    { id: "test", label: "test/", use: "TB / coverage only" },
  ];

  const SCENARIOS = [
    {
      id: "alu-mul",
      title: "Add mul to ALU",
      blurb: "New datapath capability in rtl/alu.v — not a bugfix.",
      prefer: "feature",
    },
    {
      id: "reset-bug",
      title: "Reset polarity wrong in TB",
      blurb: "Testbench asserts the wrong reset level. Not in production yet.",
      prefer: "fix",
    },
    {
      id: "prod-x",
      title: "X on tapeout build",
      blurb: "Customer build shows X on reset — need a patch on the release tag ASAP.",
      prefer: "hotfix",
    },
    {
      id: "spec-typo",
      title: "Typo in docs/spec.md",
      blurb: "Only markdown changes; no RTL.",
      prefer: "docs",
    },
    {
      id: "ci-iverilog",
      title: "CI: pin Icarus version",
      blurb: "Makefile/CI only — pin simulator package.",
      prefer: "chore",
    },
    {
      id: "cover-mul",
      title: "Add coverage for mul",
      blurb: "Only tb/ and coverpoints; RTL already merged.",
      prefer: "test",
    },
  ];

  const BAD_EXAMPLES = [
    "MyFix",
    "feature/Add Mul Path",
    "fix_reset",
    "feature/",
    "john/stuff",
    "FEATURE/alu-mul",
  ];

  function makeStarter() {
    return {
      mainTip: "e0a11c3",
      mainFresh: true,
      draft: "feature/alu-mul",
      branches: [{ name: "main", base: null, tip: "e0a11c3", ok: true }],
      lastVerdict: null, // { ok, reasons }
      lastCreated: "",
      lastAction: "",
      fetched: false,
      scenarioIdx: 0,
      scenarioPicks: {},
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-branch-strategy-cleared-v1";
  const STORE_KEY = "ddv-branch-strategy-session-v1";

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

  const root = document.getElementById("bs-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Name branches like
        <code>feature/alu-mul</code> — lowercase, kebab-case, typed prefix —
        and create them from an updated <code>main</code>.</p>
      <button type="button" class="btn btn-secondary" id="bs-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Prefixes</h2></div>
      <div class="panel-body">
        <div class="prefix-grid" id="prefix-grid"></div>
        <ul class="rules-list">
          <li>Pattern: <code>prefix/short-kebab-description</code></li>
          <li>Lowercase only; use <code>-</code> not spaces or <code>_</code></li>
          <li>Always: <code>git fetch</code> then branch from updated <code>main</code></li>
        </ul>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Name &amp; create</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <pre class="base-box" id="base-box"></pre>
          <div class="form-grid">
            <label for="draft">Branch name</label>
            <input id="draft" type="text" spellcheck="false" />
          </div>
          <div id="verdict" class="verdict idle">Validate a name to see the verdict.</div>
          <div class="action-grid">
            <button type="button" id="btn-validate">Validate name</button>
            <button type="button" id="btn-fetch">git fetch (update main tip)</button>
            <button type="button" id="btn-stale">Mark main stale</button>
            <button type="button" id="btn-create">git switch -c &lt;name&gt; main</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Local branches</h3>
          <pre class="branch-list" id="branch-list"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Pick a prefix</h2></div>
        <div class="panel-body">
          <div class="nav-row" id="nav-row"></div>
          <div class="scenario-card" id="scenario-card"></div>
          <h3 style="font-size:0.95rem;margin:0 0 0.4rem">Bad names to reject</h3>
          <div class="choice-row" id="bad-row"></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Do</th><th>Avoid</th></tr></thead>
          <tbody>
            <tr><td><code>feature/alu-mul</code></td><td><code>MyFeature</code>, spaces</td></tr>
            <tr><td><code>fix/tb-reset-polarity</code></td><td><code>fix_reset</code> (underscore / no slash)</td></tr>
            <tr><td><code>hotfix/x-on-reset</code></td><td>Branching from stale main</td></tr>
            <tr><td>Fetch, then <code>switch -c … main</code></td><td>Branching from random WIP tip</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>One concern per branch — keep the slug short and searchable.</li>
          <li>Ticket IDs are optional: <code>fix/1234-tb-reset</code> if your team uses them.</li>
          <li>Delete merged branches so the list stays readable.</li>
        </ul>
      </div>
    </div>
  `;

  const prefixGrid = document.getElementById("prefix-grid");
  PREFIXES.forEach((p) => {
    const d = document.createElement("div");
    d.className = "prefix-card";
    d.innerHTML = `<code>${p.label}</code><p>${p.use}</p>`;
    prefixGrid.appendChild(d);
  });

  const draftEl = document.getElementById("draft");
  const verdictEl = document.getElementById("verdict");
  const branchList = document.getElementById("branch-list");
  const logBox = document.getElementById("log-box");
  const baseBox = document.getElementById("base-box");
  const statusRow = document.getElementById("status-row");
  const navRow = document.getElementById("nav-row");
  const scenarioCard = document.getElementById("scenario-card");
  const badRow = document.getElementById("bad-row");

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

  /**
   * @returns {{ ok: boolean, reasons: string[], prefix: string|null, slug: string|null }}
   */
  function validateName(name) {
    const reasons = [];
    const n = String(name || "").trim();
    if (!n) {
      reasons.push("empty name");
      return { ok: false, reasons, prefix: null, slug: null };
    }
    if (/\s/.test(n)) reasons.push("no spaces");
    if (/[A-Z]/.test(n)) reasons.push("use lowercase only");
    if (!n.includes("/")) reasons.push("need prefix/ (e.g. feature/…)");
    const parts = n.split("/");
    if (parts.length !== 2) reasons.push("exactly one slash: prefix/slug");
    const prefix = parts[0] || "";
    const slug = parts[1] || "";
    const allowed = PREFIXES.map((p) => p.id);
    if (prefix && !allowed.includes(prefix)) {
      reasons.push(`unknown prefix '${prefix}' (use ${allowed.join("|")})`);
    }
    if (!slug) reasons.push("slug after / cannot be empty");
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      reasons.push("slug must be kebab-case [a-z0-9-]");
    }
    if (slug && slug.length > 40) reasons.push("slug too long (>40)");
    // dedupe reasons
    const uniq = [...new Set(reasons)];
    return { ok: uniq.length === 0, reasons: uniq, prefix: prefix || null, slug: slug || null };
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

  function renderVerdict() {
    const v = state.lastVerdict;
    if (!v) {
      verdictEl.className = "verdict idle";
      verdictEl.textContent = "Validate a name to see the verdict.";
      return;
    }
    if (v.ok) {
      verdictEl.className = "verdict ok";
      verdictEl.textContent = `OK — ${state.draft}`;
    } else {
      verdictEl.className = "verdict bad";
      verdictEl.textContent = "Reject: " + v.reasons.join("; ");
    }
  }

  function renderBranches() {
    if (!state.branches.length) {
      branchList.innerHTML = '<span class="empty">(none)</span>';
      return;
    }
    branchList.innerHTML = state.branches
      .map((b) => {
        if (b.name === "main") {
          return `<span class="main">main @ ${escapeHtml(b.tip)}${
            state.mainFresh ? " (fresh)" : " (STALE)"
          }</span>`;
        }
        const cls = b.ok ? "ok" : "bad";
        return `<span class="${cls}">${escapeHtml(b.name)} ← main@${escapeHtml(
          b.base || "?"
        )}</span>`;
      })
      .join("\n");
  }

  function renderBase() {
    baseBox.textContent = state.mainFresh
      ? `base: main @ ${state.mainTip} (up to date with origin)`
      : `base: main @ ${state.mainTip} — STALE (fetch before branching)`;
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

  function renderStatus() {
    const okCount = state.branches.filter((b) => b.name !== "main" && b.ok).length;
    statusRow.innerHTML = `<strong>${okCount}</strong> well-named topic branch${
      okCount === 1 ? "" : "es"
    } · main ${state.mainFresh ? "fresh" : "stale"}`;
  }

  function renderScenario() {
    navRow.innerHTML = "";
    SCENARIOS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const picked = state.scenarioPicks[s.id];
      b.textContent = (picked ? "✓ " : "") + (i + 1);
      if (i === state.scenarioIdx) b.classList.add("is-active");
      b.title = s.title;
      b.addEventListener("click", () => {
        state.scenarioIdx = i;
        renderAll();
      });
      navRow.appendChild(b);
    });

    const s = SCENARIOS[state.scenarioIdx];
    const picked = state.scenarioPicks[s.id];
    scenarioCard.innerHTML = `
      <h3>${escapeHtml(s.title)}</h3>
      <p>${escapeHtml(s.blurb)}</p>
      <div class="choice-row" id="prefix-choices"></div>
    `;
    const row = scenarioCard.querySelector("#prefix-choices");
    PREFIXES.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = p.label;
      if (picked === p.id) {
        btn.classList.add("is-picked");
        btn.classList.add(picked === s.prefer ? "is-correct" : "is-wrong");
      }
      btn.addEventListener("click", () => {
        state.scenarioPicks[s.id] = p.id;
        state.lastAction = "scenario-pick";
        pushLog(
          p.id === s.prefer ? "ok" : "warn",
          `scenario ${s.id}: chose ${p.label} (prefer ${s.prefer}/)`
        );
        renderAll();
      });
      row.appendChild(btn);
    });
  }

  function renderBadRow() {
    badRow.innerHTML = "";
    BAD_EXAMPLES.forEach((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.title = "Load into draft and validate";
      b.addEventListener("click", () => {
        state.draft = name;
        draftEl.value = name;
        doValidate();
      });
      badRow.appendChild(b);
    });
  }

  function renderAll() {
    draftEl.value = state.draft;
    renderVerdict();
    renderBranches();
    renderBase();
    renderLog();
    renderStatus();
    renderScenario();
    renderBadRow();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: try feature/alu-mul from fresh main");
    renderAll();
  }

  function doValidate() {
    state.draft = draftEl.value.trim();
    state.lastVerdict = validateName(state.draft);
    state.lastAction = state.lastVerdict.ok ? "validate-ok" : "validate-bad";
    pushLog(
      state.lastVerdict.ok ? "ok" : "err",
      `# validate ${state.draft || "(empty)"} → ${
        state.lastVerdict.ok ? "OK" : state.lastVerdict.reasons.join("; ")
      }`
    );
    renderAll();
  }

  function doFetch() {
    state.mainFresh = true;
    state.mainTip = "a8f3c21";
    state.branches = state.branches.map((b) =>
      b.name === "main" ? { ...b, tip: state.mainTip } : b
    );
    state.fetched = true;
    state.lastAction = "fetch";
    pushLog("ok", `$ git fetch origin`);
    pushLog("muted", `# main now @ ${state.mainTip}`);
    renderAll();
  }

  function doStale() {
    state.mainFresh = false;
    state.lastAction = "stale";
    pushLog("warn", `# main marked stale — fetch before branching`);
    renderAll();
  }

  function doCreate() {
    state.draft = draftEl.value.trim();
    const v = validateName(state.draft);
    state.lastVerdict = v;
    if (!v.ok) {
      state.lastAction = "create-rejected-name";
      pushLog("err", `# refuse create: bad name`);
      renderAll();
      return;
    }
    if (!state.mainFresh) {
      state.lastAction = "create-rejected-stale";
      pushLog("err", `# refuse create: main is stale — fetch first`);
      renderAll();
      return;
    }
    if (state.branches.some((b) => b.name === state.draft)) {
      state.lastAction = "create-dup";
      pushLog("err", `# branch already exists`);
      renderAll();
      return;
    }
    state.branches.push({
      name: state.draft,
      base: state.mainTip,
      tip: state.mainTip,
      ok: true,
    });
    state.lastCreated = state.draft;
    state.lastAction = "create";
    pushLog("ok", `$ git switch -c ${state.draft} main`);
    pushLog("muted", `# branched from main@${state.mainTip}`);
    renderAll();
  }

  document.getElementById("btn-validate").addEventListener("click", doValidate);
  document.getElementById("btn-fetch").addEventListener("click", doFetch);
  document.getElementById("btn-stale").addEventListener("click", doStale);
  document.getElementById("btn-create").addEventListener("click", doCreate);
  document.getElementById("bs-starter").addEventListener("click", loadStarter);
  draftEl.addEventListener("input", () => {
    state.draft = draftEl.value;
    saveSession();
  });

  const CHALLENGES = [
    {
      id: "quiz-pattern",
      title: "Quiz: pattern",
      prompt: "Branch names look like? Answer: <code>prefix/slug</code>",
      hint: "feature/alu-mul",
      type: "text",
      answer: "prefix/slug",
      alt: ["prefix/name", "type/description", "feature/slug"],
    },
    {
      id: "quiz-case",
      title: "Quiz: case",
      prompt: "Branch names should be? Answer: <code>lowercase</code>",
      hint: "no MyFix",
      type: "text",
      answer: "lowercase",
      alt: ["lower case", "lower-case"],
    },
    {
      id: "quiz-base",
      title: "Quiz: base",
      prompt: "New topic branches should start from? Answer: <code>main</code>",
      hint: "updated main",
      type: "text",
      answer: "main",
      alt: ["origin/main", "updated main"],
    },
    {
      id: "validate-good",
      title: "Validate good",
      prompt: "Draft <code>feature/alu-mul</code> and Validate — must be OK.",
      hint: "starter draft → Validate",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "feature/alu-mul";
        renderAll();
      },
      check: () => state.lastAction === "validate-ok" && state.lastVerdict && state.lastVerdict.ok,
    },
    {
      id: "validate-space",
      title: "Reject spaces",
      prompt: "Validate <code>feature/Add Mul Path</code> — should fail (spaces / case).",
      hint: "bad-names buttons or type it",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "feature/Add Mul Path";
        renderAll();
      },
      check: () =>
        state.lastAction === "validate-bad" &&
        state.lastVerdict &&
        !state.lastVerdict.ok,
    },
    {
      id: "validate-underscore",
      title: "Reject underscore form",
      prompt: "Validate <code>fix_reset</code> — fail (needs prefix/).",
      hint: "load bad example",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "fix_reset";
        renderAll();
      },
      check: () =>
        state.lastAction === "validate-bad" &&
        state.draft === "fix_reset" &&
        state.lastVerdict &&
        !state.lastVerdict.ok,
    },
    {
      id: "create-feature",
      title: "Create feature",
      prompt: "With fresh main, create <code>feature/alu-mul</code>.",
      hint: "Validate optional → Create",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "feature/alu-mul";
        state.mainFresh = true;
        renderAll();
      },
      check: () =>
        state.lastCreated === "feature/alu-mul" &&
        state.branches.some((b) => b.name === "feature/alu-mul"),
    },
    {
      id: "stale-blocked",
      title: "Stale blocked",
      prompt: "Mark main stale, try create — should refuse.",
      hint: "Mark main stale → Create",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "feature/alu-mul";
        renderAll();
      },
      check: () => state.lastAction === "create-rejected-stale",
    },
    {
      id: "fetch-then-create",
      title: "Fetch then create",
      prompt: "Mark stale → fetch → create <code>fix/tb-reset</code>.",
      hint: "stale → fetch → set name → create",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "fix/tb-reset";
        state.mainFresh = false;
        renderAll();
      },
      check: () =>
        state.fetched &&
        state.lastCreated === "fix/tb-reset" &&
        state.mainFresh,
    },
    {
      id: "pick-feature",
      title: "Pick: feature",
      prompt: "Scenario 1 (Add mul) — choose <code>feature/</code>.",
      hint: "nav 1",
      type: "state",
      setup: () => {
        state.scenarioIdx = 0;
        renderAll();
      },
      check: () => state.scenarioPicks["alu-mul"] === "feature",
    },
    {
      id: "pick-fix",
      title: "Pick: fix",
      prompt: "Scenario 2 — choose <code>fix/</code>.",
      hint: "nav 2",
      type: "state",
      setup: () => {
        state.scenarioIdx = 1;
        renderAll();
      },
      check: () => state.scenarioPicks["reset-bug"] === "fix",
    },
    {
      id: "pick-hotfix",
      title: "Pick: hotfix",
      prompt: "Scenario 3 — choose <code>hotfix/</code>.",
      hint: "nav 3",
      type: "state",
      setup: () => {
        state.scenarioIdx = 2;
        renderAll();
      },
      check: () => state.scenarioPicks["prod-x"] === "hotfix",
    },
    {
      id: "pick-docs",
      title: "Pick: docs",
      prompt: "Scenario 4 — choose <code>docs/</code>.",
      hint: "nav 4",
      type: "state",
      setup: () => {
        state.scenarioIdx = 3;
        renderAll();
      },
      check: () => state.scenarioPicks["spec-typo"] === "docs",
    },
    {
      id: "pick-chore",
      title: "Pick: chore",
      prompt: "Scenario 5 — choose <code>chore/</code>.",
      hint: "nav 5",
      type: "state",
      setup: () => {
        state.scenarioIdx = 4;
        renderAll();
      },
      check: () => state.scenarioPicks["ci-iverilog"] === "chore",
    },
    {
      id: "pick-test",
      title: "Pick: test",
      prompt: "Scenario 6 — choose <code>test/</code>.",
      hint: "nav 6",
      type: "state",
      setup: () => {
        state.scenarioIdx = 5;
        renderAll();
      },
      check: () => state.scenarioPicks["cover-mul"] === "test",
    },
    {
      id: "quiz-kebab",
      title: "Quiz: kebab",
      prompt: "Slug word separator should be? Answer: <code>-</code>",
      hint: "alu-mul not alu_mul",
      type: "text",
      answer: "-",
      alt: ["hyphen", "dash", "kebab"],
    },
    {
      id: "empty-prefix",
      title: "Empty slug",
      prompt: "Validate <code>feature/</code> — reject empty slug.",
      hint: "bad example feature/",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "feature/";
        renderAll();
      },
      check: () =>
        state.lastAction === "validate-bad" &&
        state.lastVerdict &&
        state.lastVerdict.reasons.some((r) => /empty/i.test(r) || /slug/i.test(r)),
    },
    {
      id: "quiz-fetch",
      title: "Quiz: fetch",
      prompt: "Before branching from main, first? Answer: <code>fetch</code>",
      hint: "update remote tips",
      type: "text",
      answer: "fetch",
      alt: ["git fetch", "fetch origin"],
    },
    {
      id: "all-scenarios",
      title: "All scenarios",
      prompt: "Correct prefix on all 6 scenarios.",
      hint: "nav 1–6",
      type: "state",
      check: () =>
        SCENARIOS.every((s) => state.scenarioPicks[s.id] === s.prefer),
    },
    {
      id: "dup-branch",
      title: "Dup refused",
      prompt: "Create <code>feature/alu-mul</code> twice — second should fail exists.",
      hint: "create, create again",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "feature/alu-mul";
        state.mainFresh = true;
        renderAll();
      },
      check: () => state.lastAction === "create-dup",
    },
    {
      id: "quiz-hotfix-vs-fix",
      title: "Quiz: hotfix vs fix",
      prompt: "Urgent production patch prefix? Answer: <code>hotfix</code>",
      hint: "not plain fix/",
      type: "text",
      answer: "hotfix",
      alt: ["hotfix/", "hotfix/"],
    },
    {
      id: "create-from-fresh-tip",
      title: "Base tip recorded",
      prompt: "Fetch (new tip), create <code>docs/spec-typo</code> — branch base equals new main tip.",
      hint: "fetch → docs/spec-typo → create",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = "docs/spec-typo";
        renderAll();
      },
      check: () => {
        const b = state.branches.find((x) => x.name === "docs/spec-typo");
        return b && b.base === state.mainTip && state.fetched && b.base === "a8f3c21";
      },
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use naming tools, then Check.</span>`;
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
