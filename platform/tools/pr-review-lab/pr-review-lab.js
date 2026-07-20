(() => {
  const CHECKS = [
    { id: "size", label: "Size is reviewable (focused, not a mega-diff)" },
    { id: "tests", label: "Tests / sim evidence for the change" },
    { id: "hygiene", label: "Diff hygiene (no build/logs/secrets; on-topic files)" },
    { id: "desc", label: "Description explains why + how to verify" },
  ];

  /**
   * expectedVerdict: approve | comment | changes
   * issues: which checks fail on this PR (reviewer should leave unchecked or note)
   */
  const PRS = [
    {
      id: "alu-mul-good",
      title: "feature: alu mul path",
      meta: "+42 −6 · 3 files · draft: false",
      desc: "Adds mul to alu. Verified: make sim TB=tb_alu. Wave: see CI artifact.",
      files: [
        { path: "rtl/alu.v", kind: "ok", lines: ["+  // mul path", "+  assign y = ..."] },
        { path: "tb/tb_alu.v", kind: "ok", lines: ["+  // mul vectors"] },
        { path: "docs/spec.md", kind: "ok", lines: ["+ mul opcode"] },
      ],
      flags: [{ t: "focused", k: "ok" }, { t: "has TB", k: "ok" }],
      issues: [],
      expected: "approve",
      why: "Small, tested, clean description — approve.",
    },
    {
      id: "mega-diff",
      title: "refactor everything + mul",
      meta: "+1800 −900 · 47 files · draft: false",
      desc: "misc cleanup and also mul",
      files: [
        { path: "rtl/alu.v", kind: "ok", lines: ["+ mul"] },
        { path: "rtl/top.v", kind: "noise", lines: ["~ reformat"] },
        { path: "… 45 more files …", kind: "noise", lines: ["~ churn"] },
      ],
      flags: [{ t: "too large", k: "bad" }, { t: "mixed concerns", k: "warn" }],
      issues: ["size", "desc"],
      expected: "changes",
      why: "Split the refactor from the feature; request changes.",
    },
    {
      id: "no-tests",
      title: "fix: reset polarity in rtl",
      meta: "+8 −3 · 1 file",
      desc: "Fixed reset. Trust me.",
      files: [
        { path: "rtl/top.v", kind: "ok", lines: ["- always @(posedge clk or negedge rst)", "+ always @(posedge clk or posedge rst_n)"] },
      ],
      flags: [{ t: "no TB/sim note", k: "bad" }, { t: "thin desc", k: "warn" }],
      issues: ["tests", "desc"],
      expected: "changes",
      why: "Reset bugs need sim proof — request changes.",
    },
    {
      id: "vcd-noise",
      title: "docs: clarify alu mul",
      meta: "+12 −2 · 4 files",
      desc: "Doc update for mul. Also checked in my wave.",
      files: [
        { path: "docs/spec.md", kind: "ok", lines: ["+ mul note"] },
        { path: "build/wave.vcd", kind: "noise", lines: ["+ binary dump"] },
        { path: "sim.log", kind: "noise", lines: ["+ log noise"] },
      ],
      flags: [{ t: "artifacts in diff", k: "bad" }],
      issues: ["hygiene"],
      expected: "changes",
      why: "Drop generated files; request changes for hygiene.",
    },
    {
      id: "nit-comment",
      title: "chore: pin iverilog in CI",
      meta: "+6 −2 · 1 file",
      desc: "Pin Icarus 12 in CI for reproducible sims. Verified workflow run #441 green.",
      files: [
        { path: ".github/workflows/sim.yml", kind: "ok", lines: ["+ iverilog=12.0"] },
      ],
      flags: [{ t: "small", k: "ok" }, { t: "CI green", k: "ok" }],
      issues: [],
      expected: "approve",
      why: "Clean chore with verification — approve (nits optional as comment).",
    },
    {
      id: "unclear-but-ok",
      title: "fix: tb timeout",
      meta: "+15 −4 · 2 files",
      desc: "timeout",
      files: [
        { path: "tb/tb_top.v", kind: "ok", lines: ["+ #10000 $finish;"] },
        { path: "tb/tb_alu.v", kind: "ok", lines: ["+ // longer soak"] },
      ],
      flags: [{ t: "weak description", k: "warn" }, { t: "has TB change", k: "ok" }],
      issues: ["desc"],
      expected: "comment",
      why: "Change looks fine; ask for a clearer why via comment (not blocking).",
    },
    {
      id: "secret-leak",
      title: "chore: local env helper",
      meta: "+20 −0 · 2 files",
      desc: "Helper script for board bring-up.",
      files: [
        { path: "scripts/flash.sh", kind: "ok", lines: ["+ # flash"] },
        { path: ".env", kind: "noise", lines: ["+ BOARD_TOKEN=sk-live-…"] },
      ],
      flags: [{ t: "secret risk", k: "bad" }],
      issues: ["hygiene", "desc"],
      expected: "changes",
      why: "Never merge secrets — request changes immediately.",
    },
    {
      id: "draft-wip",
      title: "WIP: explore fifo sizing",
      meta: "+60 −10 · 5 files · draft: true",
      desc: "Experiment — do not merge yet.",
      files: [
        { path: "rtl/fifo.v", kind: "ok", lines: ["+ // try depth 16"] },
      ],
      flags: [{ t: "draft", k: "warn" }, { t: "author says WIP", k: "ok" }],
      issues: ["size", "tests", "desc"],
      expected: "comment",
      why: "Draft/WIP — light feedback as comment; don’t approve or hard-block like a ready PR.",
    },
  ];

  function defaultState() {
    return {
      prIdx: 0,
      /** @type {Record<string, boolean>} */
      checks: Object.fromEntries(CHECKS.map((c) => [c.id, false])),
      /** @type {Record<string, string>} */
      verdicts: {},
      lastVerdict: "",
      lastOk: null,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-pr-review-lab-cleared-v1";
  const STORE_KEY = "ddv-pr-review-lab-session-v1";

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

  const root = document.getElementById("pr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Walk PRs 1–8. Tick checklist items that pass,
        then choose <strong>approve</strong>, <strong>comment</strong>, or <strong>request changes</strong>.</p>
      <button type="button" class="btn btn-secondary" id="pr-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Review pillars</h2></div>
      <div class="panel-body">
        <div class="rubric-grid">
          <div class="rubric-card"><h3>Size</h3><p>One concern; small enough to hold in your head.</p></div>
          <div class="rubric-card"><h3>Tests</h3><p>Sim/TB/CI evidence for RTL or TB changes.</p></div>
          <div class="rubric-card"><h3>Hygiene</h3><p>No <code>*.vcd</code>/<code>build/</code>/secrets; on-topic paths.</p></div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Pull request</h2></div>
        <div class="panel-body">
          <div class="nav-row" id="nav-row"></div>
          <p class="status-row" id="status-row"></p>
          <div class="pr-card" id="pr-card"></div>
          <h3 style="font-size:0.9rem;margin:0 0 0.35rem">Diff sketch</h3>
          <pre class="diff-box" id="diff-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Your review</h2></div>
        <div class="panel-body">
          <div class="check-list" id="check-list"></div>
          <p style="font-size:0.85rem;color:var(--muted);margin:0 0 0.45rem">Verdict</p>
          <div class="verdict-row">
            <button type="button" data-v="approve">approve</button>
            <button type="button" data-v="comment">comment</button>
            <button type="button" data-v="changes">request changes</button>
          </div>
          <div id="result-pill" class="result-pill idle">Pick a verdict</div>
          <p id="why-line" style="font-size:0.9rem;color:var(--muted);margin:0 0 0.75rem"></p>
          <h3 style="font-size:0.9rem;margin:0 0 0.35rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Verdict</th><th>When</th></tr></thead>
          <tbody>
            <tr><td><code>approve</code></td><td>Ready to merge; blockers cleared</td></tr>
            <tr><td><code>comment</code></td><td>Nits / questions; not blocking (or draft feedback)</td></tr>
            <tr><td><code>request changes</code></td><td>Must fix before merge (tests, hygiene, size, secrets)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Be kind and specific — point to files/lines, suggest a fix.</li>
          <li>Prefer small PRs; ask authors to split mega-diffs.</li>
          <li>Secrets and generated artifacts are instant “request changes”.</li>
        </ul>
      </div>
    </div>
  `;

  const navRow = document.getElementById("nav-row");
  const prCard = document.getElementById("pr-card");
  const diffBox = document.getElementById("diff-box");
  const checkList = document.getElementById("check-list");
  const resultPill = document.getElementById("result-pill");
  const whyLine = document.getElementById("why-line");
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
    return PRS[state.prIdx];
  }

  function resetChecksForPr() {
    // Pre-tick checks that are NOT in issues (they pass)
    const pr = current();
    state.checks = Object.fromEntries(
      CHECKS.map((c) => [c.id, !pr.issues.includes(c.id)])
    );
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
    PRS.forEach((pr, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const done = !!state.verdicts[pr.id];
      b.textContent = (done ? "✓ " : "") + (i + 1);
      if (i === state.prIdx) b.classList.add("is-active");
      if (done) b.classList.add("is-done");
      b.title = pr.title;
      b.addEventListener("click", () => {
        state.prIdx = i;
        state.lastVerdict = state.verdicts[pr.id] || "";
        state.lastOk = null;
        resetChecksForPr();
        renderAll();
      });
      navRow.appendChild(b);
    });
  }

  function renderPr() {
    const pr = current();
    const flags = pr.flags
      .map((f) => `<span class="flag ${f.k}">${escapeHtml(f.t)}</span>`)
      .join("");
    prCard.innerHTML = `
      <h3>${escapeHtml(pr.title)}</h3>
      <div class="meta">${escapeHtml(pr.meta)}</div>
      <p class="desc">${escapeHtml(pr.desc)}</p>
      <div class="flags">${flags}</div>
    `;
    diffBox.innerHTML = pr.files
      .map((f) => {
        const cls = f.kind === "noise" ? "noise" : "path";
        const body = f.lines
          .map((l) => {
            if (l.startsWith("+")) return `<span class="add">${escapeHtml(l)}</span>`;
            if (l.startsWith("-")) return `<span class="del">${escapeHtml(l)}</span>`;
            return escapeHtml(l);
          })
          .join("\n");
        return `<span class="${cls}">${escapeHtml(f.path)}</span>\n${body}`;
      })
      .join("\n\n");
  }

  function renderChecks() {
    checkList.innerHTML = "";
    CHECKS.forEach((c) => {
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="checkbox" data-check="${c.id}" ${
        state.checks[c.id] ? "checked" : ""
      }/> <span>${escapeHtml(c.label)}</span>`;
      lab.querySelector("input").addEventListener("change", (e) => {
        state.checks[c.id] = e.target.checked;
        saveSession();
      });
      checkList.appendChild(lab);
    });
  }

  function renderVerdictBtns() {
    const pr = current();
    document.querySelectorAll(".verdict-row button").forEach((btn) => {
      const v = btn.getAttribute("data-v");
      btn.classList.remove("is-picked", "is-correct", "is-wrong");
      if (state.lastVerdict === v) {
        btn.classList.add("is-picked");
        if (state.lastOk === true) btn.classList.add("is-correct");
        if (state.lastOk === false) btn.classList.add("is-wrong");
      }
      btn.onclick = () => chooseVerdict(v);
    });
    if (!state.lastVerdict) {
      resultPill.className = "result-pill idle";
      resultPill.textContent = "Pick a verdict";
      whyLine.textContent = "";
    } else if (state.lastOk) {
      resultPill.className = "result-pill pass";
      resultPill.textContent = "Matches lab expectation";
      whyLine.textContent = pr.why;
    } else {
      resultPill.className = "result-pill fail";
      resultPill.textContent = `Lab expected: ${pr.expected}`;
      whyLine.textContent = pr.why;
    }
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no reviews yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderStatus() {
    const done = Object.keys(state.verdicts).length;
    const correct = PRS.filter((p) => state.verdicts[p.id] === p.expected).length;
    statusRow.innerHTML = `<strong>PR ${state.prIdx + 1}/${PRS.length}</strong> · ${done} reviewed · ${correct} matching lab`;
  }

  function renderAll() {
    renderNav();
    renderPr();
    renderChecks();
    renderVerdictBtns();
    renderLog();
    renderStatus();
    saveSession();
  }

  function chooseVerdict(v) {
    const pr = current();
    state.lastVerdict = v;
    state.verdicts[pr.id] = v;
    state.lastOk = v === pr.expected;
    pushLog(state.lastOk ? "ok" : "warn", `${pr.id}: ${v} (expected ${pr.expected})`);
    renderAll();
  }

  function loadStarter() {
    state = defaultState();
    resetChecksForPr();
    pushLog("muted", "# starter: review PR 1 (alu mul) — expect approve");
    renderAll();
  }

  document.getElementById("pr-starter").addEventListener("click", loadStarter);

  function correctCount() {
    return PRS.filter((p) => state.verdicts[p.id] === p.expected).length;
  }

  const CHALLENGES = [
    {
      id: "quiz-pillars",
      title: "Quiz: pillars",
      prompt: "Three review pillars include size, tests, and? Answer: <code>hygiene</code>",
      hint: "diff cleanliness",
      type: "text",
      answer: "hygiene",
      alt: ["diff hygiene", "hygiene"],
    },
    {
      id: "quiz-approve",
      title: "Quiz: approve",
      prompt: "Approve means? Answer: <code>ready to merge</code>",
      hint: "blockers cleared",
      type: "text",
      answer: "ready to merge",
      alt: ["merge ok", "lgtm", "ship it"],
    },
    {
      id: "quiz-changes",
      title: "Quiz: changes",
      prompt: "Secrets in the diff →? Answer: <code>request changes</code>",
      hint: "blocking",
      type: "text",
      answer: "request changes",
      alt: ["changes", "request-changes"],
    },
    {
      id: "review-good",
      title: "Approve good PR",
      prompt: "PR 1 (alu mul) — choose <strong>approve</strong>.",
      hint: "nav 1",
      type: "state",
      setup: () => {
        state.prIdx = 0;
        resetChecksForPr();
        state.lastVerdict = "";
        state.lastOk = null;
        renderAll();
      },
      check: () => state.verdicts["alu-mul-good"] === "approve",
    },
    {
      id: "review-mega",
      title: "Block mega-diff",
      prompt: "PR 2 — <strong>request changes</strong> (too large / mixed).",
      hint: "nav 2",
      type: "state",
      setup: () => {
        state.prIdx = 1;
        resetChecksForPr();
        state.lastVerdict = "";
        state.lastOk = null;
        renderAll();
      },
      check: () => state.verdicts["mega-diff"] === "changes",
    },
    {
      id: "review-no-tests",
      title: "Block no tests",
      prompt: "PR 3 (reset fix, no sim) — request changes.",
      hint: "nav 3",
      type: "state",
      setup: () => {
        state.prIdx = 2;
        resetChecksForPr();
        renderAll();
      },
      check: () => state.verdicts["no-tests"] === "changes",
    },
    {
      id: "review-vcd",
      title: "Block artifacts",
      prompt: "PR 4 (vcd/log in diff) — request changes.",
      hint: "nav 4",
      type: "state",
      setup: () => {
        state.prIdx = 3;
        resetChecksForPr();
        renderAll();
      },
      check: () => state.verdicts["vcd-noise"] === "changes",
    },
    {
      id: "review-ci",
      title: "Approve CI pin",
      prompt: "PR 5 (chore CI) — approve.",
      hint: "nav 5",
      type: "state",
      setup: () => {
        state.prIdx = 4;
        resetChecksForPr();
        renderAll();
      },
      check: () => state.verdicts["nit-comment"] === "approve",
    },
    {
      id: "review-nit",
      title: "Comment weak desc",
      prompt: "PR 6 (ok change, weak desc) — <strong>comment</strong>.",
      hint: "nav 6",
      type: "state",
      setup: () => {
        state.prIdx = 5;
        resetChecksForPr();
        renderAll();
      },
      check: () => state.verdicts["unclear-but-ok"] === "comment",
    },
    {
      id: "review-secret",
      title: "Block secret",
      prompt: "PR 7 (.env token) — request changes.",
      hint: "nav 7",
      type: "state",
      setup: () => {
        state.prIdx = 6;
        resetChecksForPr();
        renderAll();
      },
      check: () => state.verdicts["secret-leak"] === "changes",
    },
    {
      id: "review-draft",
      title: "Draft comment",
      prompt: "PR 8 (WIP draft) — comment.",
      hint: "nav 8",
      type: "state",
      setup: () => {
        state.prIdx = 7;
        resetChecksForPr();
        renderAll();
      },
      check: () => state.verdicts["draft-wip"] === "comment",
    },
    {
      id: "quiz-size",
      title: "Quiz: size",
      prompt: "Prefer PRs that are? Answer: <code>small</code>",
      hint: "one concern",
      type: "text",
      answer: "small",
      alt: ["focused", "small and focused", "reviewable"],
    },
    {
      id: "quiz-vcd",
      title: "Quiz: vcd",
      prompt: "Should <code>*.vcd</code> be in a PR? Answer: <code>no</code>",
      hint: "generated",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "quiz-comment",
      title: "Quiz: comment",
      prompt: "Non-blocking nits use? Answer: <code>comment</code>",
      hint: "not request changes",
      type: "text",
      answer: "comment",
    },
    {
      id: "five-correct",
      title: "Five correct",
      prompt: "Match lab verdict on at least 5 PRs.",
      hint: "review several",
      type: "state",
      check: () => correctCount() >= 5,
    },
    {
      id: "all-eight",
      title: "All eight",
      prompt: "Correct verdict on all 8 PRs.",
      hint: "finish the set",
      type: "state",
      check: () => correctCount() >= 8,
    },
    {
      id: "quiz-split",
      title: "Quiz: split",
      prompt: "Mega-diff mixing refactor + feature — ask author to? Answer: <code>split</code>",
      hint: "separate PRs",
      type: "text",
      answer: "split",
      alt: ["split it", "split the pr", "separate prs"],
    },
    {
      id: "untick-hygiene",
      title: "Untick hygiene",
      prompt: "On PR 4, leave hygiene unchecked (or uncheck it) then request changes.",
      hint: "nav 4 → uncheck hygiene → changes",
      type: "state",
      setup: () => {
        state.prIdx = 3;
        resetChecksForPr();
        renderAll();
      },
      check: () =>
        state.verdicts["vcd-noise"] === "changes" && !state.checks.hygiene,
    },
    {
      id: "quiz-kind",
      title: "Quiz: tone",
      prompt: "Reviews should be specific and? Answer: <code>kind</code>",
      hint: "culture",
      type: "text",
      answer: "kind",
      alt: ["respectful", "constructive", "helpful"],
    },
    {
      id: "starter-pr1",
      title: "Starter PR1",
      prompt: "Load starter — on PR 1. Expected verdict? Answer: <code>approve</code>",
      hint: "Load starter",
      type: "text",
      answer: "approve",
      setup: () => loadStarter(),
    },
    {
      id: "quiz-ci-evidence",
      title: "Quiz: evidence",
      prompt: "Good PR descriptions include how to? Answer: <code>verify</code>",
      hint: "make sim / CI",
      type: "text",
      answer: "verify",
      alt: ["test", "reproduce", "validate"],
    },
    {
      id: "fix-secret-again",
      title: "Secret again",
      prompt: "If you wrongly approved PR 7, change verdict to request changes.",
      hint: "nav 7",
      type: "state",
      setup: () => {
        state.prIdx = 6;
        resetChecksForPr();
        renderAll();
      },
      check: () => state.verdicts["secret-leak"] === "changes",
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Review the PR, pick a verdict, then Check.</span>`;
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
  else {
    if (!Object.keys(state.checks).length) resetChecksForPr();
    renderAll();
  }
  renderChallenge();
})();
