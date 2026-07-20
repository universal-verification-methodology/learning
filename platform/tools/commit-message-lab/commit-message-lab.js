(() => {
  const SCENARIOS = [
    {
      id: "alu-mul",
      title: "Add ALU mul",
      blurb: "You added a mul path to rtl/alu.v and extended tb_alu.",
      diff: [
        { path: "rtl/alu.v", lines: ["+ // mul path", "+ assign y = a * b;"] },
        { path: "tb/tb_alu.v", lines: ["+ // mul vectors"] },
      ],
      goodSubject: "Add mul path to ALU",
      hints: ["imperative", "why: need mul for MAC unit"],
    },
    {
      id: "reset-fix",
      title: "Fix reset polarity",
      blurb: "TB was asserting the wrong reset level — chips failed soak.",
      diff: [
        { path: "tb/tb_top.v", lines: ["- rst = 1;", "+ rst_n = 0;"] },
      ],
      goodSubject: "Fix TB reset polarity",
      hints: ["fix the failure mode, not 'update tb'"],
    },
    {
      id: "docs-spec",
      title: "Docs only",
      blurb: "Clarified active-low reset in the spec after review confusion.",
      diff: [
        { path: "docs/spec.md", lines: ["+ Reset is active-low synchronous."] },
      ],
      goodSubject: "Clarify active-low reset in spec",
      hints: ["docs: ok as prefix"],
    },
    {
      id: "ci-pin",
      title: "CI pin",
      blurb: "Sims flaked across runners — pin Icarus 12.",
      diff: [
        { path: ".github/workflows/sim.yml", lines: ["+ iverilog: '12.0'"] },
      ],
      goodSubject: "Pin Icarus 12 in CI",
      hints: ["why: reproducibility"],
    },
    {
      id: "fifo-depth",
      title: "FIFO depth",
      blurb: "Underflow at 8 entries under burst traffic; bump depth to 16.",
      diff: [
        { path: "rtl/fifo.v", lines: ["- parameter DEPTH = 8;", "+ parameter DEPTH = 16;"] },
      ],
      goodSubject: "Increase FIFO depth for burst traffic",
      hints: ["state the why in subject or body"],
    },
    {
      id: "gitignore",
      title: "Ignore waves",
      blurb: "People keep committing *.vcd — ignore build artifacts.",
      diff: [
        { path: ".gitignore", lines: ["+ *.vcd", "+ build/"] },
      ],
      goodSubject: "Ignore VCD and build outputs",
      hints: ["chore/ ok"],
    },
  ];

  const BAD_EXAMPLES = [
    { label: "fixed stuff", subject: "fixed stuff", body: "" },
    { label: "Update alu.v", subject: "Update alu.v", body: "" },
    {
      label: "period subject",
      subject: "Add mul path to ALU.",
      body: "",
    },
    {
      label: "past tense",
      subject: "Added mul path to ALU",
      body: "",
    },
    {
      label: "what-only body",
      subject: "Fix TB reset polarity",
      body: "Changed rst to rst_n in tb_top.v.",
    },
  ];

  const GOOD_EXAMPLE = {
    subject: "Fix TB reset polarity",
    body: "Active-high drive caused soak failures on boards with\nactive-low reset. Match the DUT polarity and re-run make sim.",
  };

  function makeStarter() {
    return {
      scenarioIdx: 0,
      subject: "Add mul path to ALU",
      body: "MAC unit needs mul; keep add/sub paths unchanged.\nVerified with make sim TB=tb_alu.",
      lastScore: null,
      lastPassed: null,
      lastAction: "",
      validated: false,
      passedOnce: false,
      rejectedBad: false,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-commit-message-lab-cleared-v1";
  const STORE_KEY = "ddv-commit-message-lab-session-v1";

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

  const root = document.getElementById("cm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> A solid message for the ALU mul change —
        imperative subject, body explains <em>why</em> and how to verify.</p>
      <button type="button" class="btn btn-secondary" id="cm-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Style rules</h2></div>
      <div class="panel-body">
        <div class="rule-grid">
          <div class="rule-card">
            <h3>Subject</h3>
            <p>Imperative, ~50 chars, Capitalized, no trailing period. Optional <code>fix:</code>/<code>docs:</code> prefix.</p>
          </div>
          <div class="rule-card">
            <h3>Body</h3>
            <p>Explain <strong>why</strong> and how to verify. Wrap near 72 cols. Blank line after subject.</p>
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
          <h3 style="font-size:0.9rem;margin:0 0 0.35rem">Diff sketch</h3>
          <pre class="diff-box" id="diff-box"></pre>
          <h3 style="font-size:0.9rem;margin:0.75rem 0 0.35rem">Load example</h3>
          <div class="example-row" id="example-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Compose</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <label for="subject">Subject <span class="char-meta" id="subj-len"></span></label>
            <input id="subject" type="text" spellcheck="true" />
            <label for="body">Body</label>
            <textarea id="body" spellcheck="true"></textarea>
          </div>
          <h3 style="font-size:0.9rem;margin:0 0 0.35rem">git log preview</h3>
          <pre class="preview-box" id="preview-box"></pre>
          <div id="score-pill" class="score-pill idle">Validate to score</div>
          <pre class="verdict-box" id="verdict-box"></pre>
          <div class="action-grid">
            <button type="button" id="btn-validate">Validate message</button>
            <button type="button" id="btn-suggest">Load suggested subject</button>
            <button type="button" id="btn-good">Load good full example</button>
          </div>
          <h3 style="font-size:0.9rem;margin:1rem 0 0.35rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Prefer</th><th>Avoid</th></tr></thead>
          <tbody>
            <tr><td><code>Fix TB reset polarity</code></td><td><code>fixed stuff</code> / <code>Update file</code></td></tr>
            <tr><td>Imperative: Add / Fix / Clarify</td><td>Past tense: Added / Fixed</td></tr>
            <tr><td>Body: why + verify steps</td><td>Body that only restates the diff</td></tr>
            <tr><td>~50 char subject</td><td>Trailing period on subject</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Subject completes “If applied, this commit will …”.</li>
          <li>Reviewers read subjects in <code>git log --oneline</code> — make them searchable.</li>
          <li>What is in the diff; why belongs in the message.</li>
        </ul>
      </div>
    </div>
  `;

  const navRow = document.getElementById("nav-row");
  const scenarioCard = document.getElementById("scenario-card");
  const diffBox = document.getElementById("diff-box");
  const subjectEl = document.getElementById("subject");
  const bodyEl = document.getElementById("body");
  const subjLen = document.getElementById("subj-len");
  const previewBox = document.getElementById("preview-box");
  const verdictBox = document.getElementById("verdict-box");
  const scorePill = document.getElementById("score-pill");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");
  const exampleRow = document.getElementById("example-row");

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

  /**
   * @returns {{ ok: boolean, score: number, notes: {kind:string,text:string}[] }}
   */
  function scoreMessage(subject, body) {
    const notes = [];
    let score = 0;
    const sub = String(subject || "").trim();
    const bod = String(body || "").trim();

    if (!sub) {
      notes.push({ kind: "err", text: "subject is empty" });
      return { ok: false, score: 0, notes };
    }

    // strip optional type prefix for mood checks
    const prefixMatch = sub.match(/^(feat|fix|docs|chore|test|ci):\s*(.+)$/i);
    const core = (prefixMatch ? prefixMatch[2] : sub).trim();

    if (sub.length <= 50) {
      score += 2;
      notes.push({ kind: "ok", text: `subject length ${sub.length} ≤ 50` });
    } else if (sub.length <= 72) {
      score += 1;
      notes.push({ kind: "warn", text: `subject length ${sub.length} (prefer ≤ 50)` });
    } else {
      notes.push({ kind: "err", text: `subject too long (${sub.length})` });
    }

    if (/\.$/.test(sub)) {
      notes.push({ kind: "err", text: "no trailing period on subject" });
    } else {
      score += 1;
      notes.push({ kind: "ok", text: "no trailing period" });
    }

    if (/^[A-Z]/.test(core)) {
      score += 1;
      notes.push({ kind: "ok", text: "subject starts with capital" });
    } else {
      notes.push({ kind: "err", text: "capitalize subject (after optional prefix)" });
    }

    const first = core.split(/\s+/)[0] || "";
    const past = /^(added|fixed|updated|changed|removed|implemented)$/i.test(first);
    const vague = /^(update|updates|fix|fixes|wip|misc|stuff|changes)$/i.test(first);
    const imperative =
      /^(add|fix|clarify|pin|increase|ignore|remove|refactor|document|support|enable|disable)$/i.test(
        first
      );

    if (past) {
      notes.push({ kind: "err", text: "use imperative mood (Add/Fix), not past tense" });
    } else if (vague && !prefixMatch) {
      notes.push({ kind: "err", text: "subject too vague — say what capability changed" });
    } else if (imperative || prefixMatch) {
      score += 2;
      notes.push({ kind: "ok", text: "imperative / typed subject" });
    } else {
      score += 1;
      notes.push({ kind: "warn", text: "prefer clear imperative verb (Add/Fix/Clarify…)" });
    }

    if (/update\s+\S+\.(v|sv|md|yml)/i.test(sub) || /^update\s/i.test(core)) {
      notes.push({ kind: "err", text: "avoid 'Update filename' — say the intent" });
      score = Math.max(0, score - 1);
    }

    if (!bod) {
      notes.push({ kind: "warn", text: "body empty — ok for tiny chores, better with why" });
    } else {
      score += 1;
      const whyish =
        /(why|because|need|fail|reproduc|verif|make sim|so that|prevent|cause)/i.test(bod);
      if (whyish) {
        score += 2;
        notes.push({ kind: "ok", text: "body hints at why / verification" });
      } else {
        notes.push({
          kind: "warn",
          text: "body should explain why / how to verify, not only restate the diff",
        });
      }
      const longLine = bod.split("\n").some((l) => l.length > 78);
      if (longLine) {
        notes.push({ kind: "warn", text: "wrap body lines near ~72 characters" });
      } else {
        score += 1;
        notes.push({ kind: "ok", text: "body line lengths ok" });
      }
    }

    const ok = score >= 7 && !notes.some((n) => n.kind === "err");
    return { ok, score, notes };
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

  function renderNav() {
    navRow.innerHTML = "";
    SCENARIOS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(i + 1);
      if (i === state.scenarioIdx) b.classList.add("is-active");
      b.title = s.title;
      b.addEventListener("click", () => {
        state.scenarioIdx = i;
        state.lastScore = null;
        state.lastPassed = null;
        renderAll();
      });
      navRow.appendChild(b);
    });
  }

  function renderScenario() {
    const s = current();
    scenarioCard.innerHTML = `
      <h3>${escapeHtml(s.title)}</h3>
      <p>${escapeHtml(s.blurb)}</p>
    `;
    diffBox.innerHTML = s.diff
      .map((f) => {
        const lines = f.lines
          .map((l) =>
            l.startsWith("+")
              ? `<span class="add">${escapeHtml(l)}</span>`
              : escapeHtml(l)
          )
          .join("\n");
        return `<span class="path">${escapeHtml(f.path)}</span>\n${lines}`;
      })
      .join("\n\n");
  }

  function renderForm() {
    subjectEl.value = state.subject;
    bodyEl.value = state.body;
    const n = state.subject.trim().length;
    subjLen.textContent = `(${n}/50)`;
    subjLen.className = "char-meta" + (n > 50 ? " over" : "");
    const preview = state.body.trim()
      ? `${state.subject.trim()}\n\n${state.body.trim()}`
      : state.subject.trim();
    previewBox.textContent = preview || "(empty)";
  }

  function renderVerdict() {
    if (!state.lastScore) {
      scorePill.className = "score-pill idle";
      scorePill.textContent = "Validate to score";
      verdictBox.innerHTML = '<span class="muted">No score yet.</span>';
      return;
    }
    const { ok, score, notes } = state.lastScore;
    scorePill.className = "score-pill " + (ok ? "pass" : "fail");
    scorePill.textContent = ok ? `Pass · score ${score}` : `Needs work · score ${score}`;
    verdictBox.innerHTML = notes
      .map((n) => `<span class="${n.kind}">${escapeHtml(n.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no validations yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderExamples() {
    exampleRow.innerHTML = "";
    BAD_EXAMPLES.forEach((ex) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bad";
      b.textContent = ex.label;
      b.addEventListener("click", () => {
        state.subject = ex.subject;
        state.body = ex.body;
        state.lastScore = null;
        state.lastPassed = null;
        renderAll();
        doValidate();
      });
      exampleRow.appendChild(b);
    });
    const g = document.createElement("button");
    g.type = "button";
    g.className = "good";
    g.textContent = "good example";
    g.addEventListener("click", () => {
      state.subject = GOOD_EXAMPLE.subject;
      state.body = GOOD_EXAMPLE.body;
      state.lastScore = null;
      renderAll();
      doValidate();
    });
    exampleRow.appendChild(g);
  }

  function renderStatus() {
    statusRow.innerHTML = `<strong>Scenario ${state.scenarioIdx + 1}/${SCENARIOS.length}</strong> · ${
      state.passedOnce ? "passed ≥1 validation" : "no pass yet"
    }`;
  }

  function renderAll() {
    renderNav();
    renderScenario();
    renderForm();
    renderVerdict();
    renderLog();
    renderExamples();
    renderStatus();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter message for ALU mul loaded");
    renderAll();
  }

  function doValidate() {
    state.subject = subjectEl.value;
    state.body = bodyEl.value;
    const result = scoreMessage(state.subject, state.body);
    state.lastScore = result;
    state.lastPassed = result.ok;
    state.validated = true;
    state.lastAction = result.ok ? "validate-pass" : "validate-fail";
    if (result.ok) state.passedOnce = true;
    if (!result.ok && BAD_EXAMPLES.some((b) => b.subject === state.subject.trim())) {
      state.rejectedBad = true;
    }
    pushLog(result.ok ? "ok" : "warn", `# validate → score ${result.score}${result.ok ? " PASS" : ""}`);
    renderAll();
  }

  document.getElementById("btn-validate").addEventListener("click", doValidate);
  document.getElementById("btn-suggest").addEventListener("click", () => {
    state.subject = current().goodSubject;
    state.lastScore = null;
    state.lastAction = "suggest";
    pushLog("muted", `# suggested subject: ${state.subject}`);
    renderAll();
  });
  document.getElementById("btn-good").addEventListener("click", () => {
    state.subject = GOOD_EXAMPLE.subject;
    state.body = GOOD_EXAMPLE.body;
    state.lastAction = "load-good";
    renderAll();
    doValidate();
  });
  document.getElementById("cm-starter").addEventListener("click", loadStarter);
  subjectEl.addEventListener("input", () => {
    state.subject = subjectEl.value;
    const n = state.subject.trim().length;
    subjLen.textContent = `(${n}/50)`;
    subjLen.className = "char-meta" + (n > 50 ? " over" : "");
    previewBox.textContent = state.body.trim()
      ? `${state.subject.trim()}\n\n${state.body.trim()}`
      : state.subject.trim();
    saveSession();
  });
  bodyEl.addEventListener("input", () => {
    state.body = bodyEl.value;
    previewBox.textContent = state.body.trim()
      ? `${state.subject.trim()}\n\n${state.body.trim()}`
      : state.subject.trim();
    saveSession();
  });

  const CHALLENGES = [
    {
      id: "quiz-why",
      title: "Quiz: why",
      prompt: "Prefer explaining? Answer: <code>why</code>",
      hint: "not only what",
      type: "text",
      answer: "why",
      alt: ["the why", "why over what"],
    },
    {
      id: "quiz-imperative",
      title: "Quiz: mood",
      prompt: "Subject mood should be? Answer: <code>imperative</code>",
      hint: "Add/Fix not Added/Fixed",
      type: "text",
      answer: "imperative",
    },
    {
      id: "quiz-length",
      title: "Quiz: length",
      prompt: "Aim for subject length about? Answer: <code>50</code>",
      hint: "characters",
      type: "text",
      answer: "50",
      alt: ["~50", "50 characters"],
    },
    {
      id: "starter-pass",
      title: "Starter passes",
      prompt: "Load starter and Validate — should Pass.",
      hint: "Load starter → Validate",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "validate-pass" && state.lastPassed,
    },
    {
      id: "reject-fixed-stuff",
      title: "Reject vague",
      prompt: "Load bad example “fixed stuff” and Validate — must fail.",
      hint: "red example buttons",
      type: "state",
      check: () =>
        state.lastAction === "validate-fail" &&
        /fixed stuff/i.test(state.subject) &&
        state.rejectedBad,
    },
    {
      id: "reject-update-file",
      title: "Reject Update file",
      prompt: "Validate “Update alu.v” — fail.",
      hint: "bad example Update alu.v",
      type: "state",
      check: () =>
        state.lastAction === "validate-fail" && /update alu\.v/i.test(state.subject),
    },
    {
      id: "reject-period",
      title: "Reject period",
      prompt: "Validate subject ending with a period — fail.",
      hint: "period subject example",
      type: "state",
      check: () =>
        state.lastAction === "validate-fail" && /\.$/.test(state.subject.trim()),
    },
    {
      id: "reject-past",
      title: "Reject past tense",
      prompt: "Validate “Added mul…” — fail imperative check.",
      hint: "past tense example",
      type: "state",
      check: () =>
        state.lastAction === "validate-fail" && /^Added\b/i.test(state.subject.trim()),
    },
    {
      id: "good-example-pass",
      title: "Good example",
      prompt: "Load good full example (or button) and pass validation.",
      hint: "Load good full example",
      type: "state",
      check: () =>
        state.lastPassed &&
        /reset polarity/i.test(state.subject) &&
        /soak|active-low|make sim/i.test(state.body),
    },
    {
      id: "suggest-subject",
      title: "Suggested subject",
      prompt: "On scenario 1, Load suggested subject — matches lab suggestion.",
      hint: "nav 1 → suggested subject",
      type: "state",
      setup: () => {
        state.scenarioIdx = 0;
        renderAll();
      },
      check: () => state.subject.trim() === SCENARIOS[0].goodSubject,
    },
    {
      id: "scenario-reset",
      title: "Reset scenario msg",
      prompt: "Scenario 2: set subject to suggested, add a why body, Validate pass.",
      hint: "nav 2 → suggest → write why → validate",
      type: "state",
      setup: () => {
        state.scenarioIdx = 1;
        renderAll();
      },
      check: () =>
        state.scenarioIdx === 1 &&
        state.lastPassed &&
        /reset/i.test(state.subject) &&
        state.body.trim().length > 20,
    },
    {
      id: "quiz-blank-line",
      title: "Quiz: blank line",
      prompt: "Between subject and body there is a? Answer: <code>blank line</code>",
      hint: "git convention",
      type: "text",
      answer: "blank line",
      alt: ["empty line", "newline", "blank"],
    },
    {
      id: "quiz-oneline",
      title: "Quiz: oneline",
      prompt: "Subjects show up in? Answer: <code>git log --oneline</code>",
      hint: "short log",
      type: "text",
      answer: "git log --oneline",
      alt: ["log --oneline", "--oneline"],
    },
    {
      id: "quiz-complete",
      title: "Quiz: complete",
      prompt: "Subject completes: If applied, this commit will … Answer: <code>yes</code>",
      hint: "imperative test",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "body-why",
      title: "Body has why",
      prompt: "Write any subject ≤50 + body containing “because” or “verified”, Validate pass.",
      hint: "include why/verify words",
      type: "state",
      check: () =>
        state.lastPassed &&
        /(because|verified|verify|make sim|need|fail)/i.test(state.body),
    },
    {
      id: "docs-scenario",
      title: "Docs subject",
      prompt: "Scenario 3: suggested subject + short why body, Validate pass.",
      hint: "nav 3 → suggest → add why → validate",
      type: "state",
      setup: () => {
        state.scenarioIdx = 2;
        renderAll();
      },
      check: () =>
        state.scenarioIdx === 2 &&
        state.subject.trim() === SCENARIOS[2].goodSubject &&
        state.lastPassed &&
        state.body.trim().length > 10,
    },
    {
      id: "quiz-what-vs-why",
      title: "Quiz: diff",
      prompt: "The diff already shows the? Answer: <code>what</code>",
      hint: "message adds why",
      type: "text",
      answer: "what",
      alt: ["the what", "what changed"],
    },
    {
      id: "pass-twice",
      title: "Pass once",
      prompt: "Achieve at least one passing validation this session.",
      hint: "starter validate",
      type: "state",
      check: () => state.passedOnce,
    },
    {
      id: "ci-pin-msg",
      title: "CI pin message",
      prompt: "Scenario 4: suggested subject + body mentioning reproduc/flake, pass.",
      hint: "nav 4",
      type: "state",
      setup: () => {
        state.scenarioIdx = 3;
        renderAll();
      },
      check: () =>
        state.scenarioIdx === 3 &&
        state.lastPassed &&
        /icarus|ci|pin/i.test(state.subject) &&
        /(reproduc|flake|runner|verif)/i.test(state.body),
    },
    {
      id: "quiz-prefix",
      title: "Quiz: prefix",
      prompt: "Optional conventional prefix example? Answer: <code>fix:</code>",
      hint: "fix: / feat: / docs:",
      type: "text",
      answer: "fix:",
      alt: ["feat:", "docs:", "chore:", "fix"],
    },
    {
      id: "fifo-why",
      title: "FIFO why",
      prompt: "Scenario 5: suggested subject; body mentions burst or underflow; pass.",
      hint: "nav 5",
      type: "state",
      setup: () => {
        state.scenarioIdx = 4;
        renderAll();
      },
      check: () =>
        state.scenarioIdx === 4 &&
        state.lastPassed &&
        /fifo|depth|burst/i.test(state.subject + state.body),
    },
    {
      id: "ignore-vcd",
      title: "Ignore artifacts",
      prompt: "Scenario 6: suggested subject + body mentioning vcd/commit, Validate pass.",
      hint: "nav 6 → suggest → why body → validate",
      type: "state",
      setup: () => {
        state.scenarioIdx = 5;
        renderAll();
      },
      check: () =>
        state.scenarioIdx === 5 &&
        state.subject.trim() === SCENARIOS[5].goodSubject &&
        state.lastPassed &&
        /(vcd|artifact|commit)/i.test(state.body),
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Compose/validate a message, then Check.</span>`;
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
