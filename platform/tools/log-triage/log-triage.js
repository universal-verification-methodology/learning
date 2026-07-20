(() => {
  /**
   * kind: fail | env | flake
   * lines: {t, c?} c = err|warn|ok|hl
   */
  const CASES = [
    {
      id: "mismatch",
      title: "TB expect mismatch",
      source: "make sim · tb_alu",
      kind: "fail",
      why: "Deterministic check failed — DUT/test bug until proven otherwise.",
      lines: [
        { t: "$ make sim TB=tb_alu", c: "ok" },
        { t: "vvp build/tb_alu.vvp" },
        { t: "[tb] time=120 ns expect y=8'h2a got 8'h00", c: "err" },
        { t: "ERROR: mismatch at vector 4", c: "err" },
        { t: "make: *** [sim] Error 1", c: "err" },
      ],
      cues: ["ERROR: mismatch", "expect/got"],
    },
    {
      id: "missing-tool",
      title: "iverilog not found",
      source: "make compile",
      kind: "env",
      why: "Tool missing on PATH — fix the environment, not the RTL.",
      lines: [
        { t: "$ make compile" },
        { t: "iverilog -g2012 -o build/out.vvp rtl/top.v tb/tb_top.v", c: "hl" },
        { t: "/bin/sh: iverilog: command not found", c: "err" },
        { t: "make: *** [compile] Error 127", c: "err" },
      ],
      cues: ["command not found", "Error 127"],
    },
    {
      id: "timeout-race",
      title: "Intermittent timeout",
      source: "CI · same seed sometimes green",
      kind: "flake",
      why: "Passes on re-run with same seed elsewhere — classic race/timeout flake.",
      lines: [
        { t: "seed=0xA11CE · run 3/10" },
        { t: "[tb] waiting for done…", c: "warn" },
        { t: "TIMEOUT at 1_000_000 ns", c: "err" },
        { t: "note: previous CI job with seed=0xA11CE PASSED", c: "warn" },
        { t: "make: *** [sim] Error 1", c: "err" },
      ],
      cues: ["TIMEOUT", "previous … PASSED", "same seed"],
    },
    {
      id: "syntax",
      title: "Compile syntax error",
      source: "make compile",
      kind: "fail",
      why: "RTL/TB syntax — real code failure before sim.",
      lines: [
        { t: "iverilog -g2012 -o build/out.vvp rtl/alu.v" },
        { t: "rtl/alu.v:44: syntax error", c: "err" },
        { t: "rtl/alu.v:44: error: Invalid module instantiation", c: "err" },
        { t: "make: *** [compile] Error 1", c: "err" },
      ],
      cues: ["syntax error", "line number in RTL"],
    },
    {
      id: "license",
      title: "License checkout fail",
      source: "vendor sim (CI)",
      kind: "env",
      why: "License server / seat — infrastructure, not design.",
      lines: [
        { t: "Starting commercial_sim …" },
        { t: "ERROR: Unable to checkout license FEATURE_SIM", c: "err" },
        { t: "License server timeout (lmgrd)", c: "err" },
        { t: "Job failed before elaboration", c: "warn" },
      ],
      cues: ["license", "lmgrd", "before elaboration"],
    },
    {
      id: "x-propagation",
      title: "X on checked output",
      source: "make sim",
      kind: "fail",
      why: "X reaching a scoreboard is a real design/init/reset issue.",
      lines: [
        { t: "[sb] time=80 ns out has X", c: "err" },
        { t: "FATAL: X-prop on data_o", c: "err" },
        { t: "Wave: reset deasserted late vs first transaction", c: "hl" },
      ],
      cues: ["X-prop", "FATAL"],
    },
    {
      id: "disk-full",
      title: "No space for VCD",
      source: "make wave",
      kind: "env",
      why: "Filesystem / quota — free space or dump less.",
      lines: [
        { t: "Dumping build/wave.vcd …" },
        { t: "fwrite: No space left on device", c: "err" },
        { t: "vvp: abort dump", c: "err" },
      ],
      cues: ["No space left", "device"],
    },
    {
      id: "order-dep",
      title: "Pass alone, fail in parallel",
      source: "make -j8 regression",
      kind: "flake",
      why: "Order/parallel shared-resource flake — isolate or serialize.",
      lines: [
        { t: "make -j8 regress" },
        { t: "tb_a … PASS" },
        { t: "tb_b … PASS" },
        { t: "tb_c … FAIL (port 48000 in use)", c: "err" },
        { t: "re-run tb_c alone → PASS", c: "warn" },
      ],
      cues: ["-j", "in use", "alone → PASS"],
    },
    {
      id: "missing-file",
      title: "Include not found",
      source: "make compile",
      kind: "env",
      why: "Wrong +incdir / missing checkout path — env/setup.",
      lines: [
        { t: "iverilog … +incdir+rtl tb/tb_top.v" },
        { t: "tb/tb_top.v:10: Include file pkg.vh not found", c: "err" },
        { t: "Did you forget submodule update --init?", c: "warn" },
      ],
      cues: ["not found", "Include file", "submodule"],
    },
    {
      id: "assert-fail",
      title: "SVA assertion fire",
      source: "make sim ASSERT=1",
      kind: "fail",
      why: "Protocol assertion failed — treat as real fail.",
      lines: [
        { t: "Error: \"no_two_reqs\" (rtl/if_req.sv:88)", c: "err" },
        { t: "Offending 'req && req_q' at time 240ns", c: "err" },
        { t: "Simulation aborted by $fatal", c: "err" },
      ],
      cues: ["assertion", "$fatal", "Offending"],
    },
    {
      id: "npm-wrong",
      title: "Wrong Python / venv",
      source: "make cocotb",
      kind: "env",
      why: "Interpreter/module path — environment.",
      lines: [
        { t: "python3 run_tb.py" },
        { t: "ModuleNotFoundError: No module named 'cocotb'", c: "err" },
        { t: "hint: activate .venv or pip install -r requirements.txt", c: "warn" },
      ],
      cues: ["ModuleNotFoundError", "venv"],
    },
    {
      id: "timing-slack",
      title: "Rare CDC sample miss",
      source: "nightly · 1/50 fails",
      kind: "flake",
      why: "Rare async sample miss — flake until hardened; still file a bug.",
      lines: [
        { t: "run 47/50 seed=0x99" },
        { t: "WARN: metastable window hit (model)", c: "warn" },
        { t: "ERROR: gray ptr decode mismatch (once)", c: "err" },
        { t: "runs 1–46,48–50 PASS same binary", c: "warn" },
      ],
      cues: ["1/50", "same binary", "once"],
    },
  ];

  function defaultState() {
    return {
      caseIdx: 0,
      /** @type {Record<string, string>} */
      picks: {},
      lastPick: "",
      lastOk: null,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-log-triage-cleared-v1";
  const STORE_KEY = "ddv-log-triage-session-v1";

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

  const root = document.getElementById("lt-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Open case 1 (TB mismatch) — that is a real
        <code>fail</code>. Scan for <code>command not found</code> (env) vs intermittent timeout (flake).</p>
      <button type="button" class="btn btn-secondary" id="lt-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Buckets</h2></div>
      <div class="panel-body">
        <div class="bucket-grid">
          <div class="bucket-card fail">
            <h3>fail</h3>
            <p>Deterministic DUT/TB/assert/compile error in your sources.</p>
          </div>
          <div class="bucket-card env">
            <h3>env</h3>
            <p>Tools, PATH, license, disk, missing files/submodules.</p>
          </div>
          <div class="bucket-card flake">
            <h3>flake</h3>
            <p>Intermittent: races, timeouts, parallel collisions — re-run differs.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Log case</h2></div>
        <div class="panel-body">
          <div class="nav-row" id="nav-row"></div>
          <p class="status-row" id="status-row"></p>
          <div class="case-card" id="case-card"></div>
          <pre class="log-box" id="log-box"></pre>
          <ul class="cue-list" id="cue-list"></ul>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Classify</h2></div>
        <div class="panel-body">
          <div class="choice-row">
            <button type="button" data-c="fail">fail</button>
            <button type="button" data-c="env">env</button>
            <button type="button" data-c="flake">flake</button>
          </div>
          <div id="result-pill" class="result-pill idle">Pick a bucket</div>
          <pre class="why-box" id="why-box"></pre>
          <h3 style="font-size:0.9rem;margin:0.75rem 0 0.35rem">History</h3>
          <pre class="hist-box" id="hist-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Signal</th><th>Lean toward</th></tr></thead>
          <tbody>
            <tr><td><code>expect/got</code>, assert, syntax error</td><td>fail</td></tr>
            <tr><td><code>command not found</code>, license, disk, ModuleNotFound</td><td>env</td></tr>
            <tr><td>timeout + prior pass, -j collision, 1/N rare</td><td>flake</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Read the <em>first</em> actionable error, not only the final Make status.</li>
          <li>Flakes still get tickets — triage ≠ ignore.</li>
          <li>Env fixes are often one-line PATH / init / quota.</li>
        </ul>
      </div>
    </div>
  `;

  const navRow = document.getElementById("nav-row");
  const caseCard = document.getElementById("case-card");
  const logBox = document.getElementById("log-box");
  const cueList = document.getElementById("cue-list");
  const whyBox = document.getElementById("why-box");
  const histBox = document.getElementById("hist-box");
  const resultPill = document.getElementById("result-pill");
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
    return CASES[state.caseIdx];
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
    CASES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const done = !!state.picks[c.id];
      b.textContent = (done ? "✓ " : "") + (i + 1);
      if (i === state.caseIdx) b.classList.add("is-active");
      if (done) b.classList.add("is-done");
      b.title = c.title;
      b.addEventListener("click", () => {
        state.caseIdx = i;
        state.lastPick = state.picks[c.id] || "";
        state.lastOk = null;
        renderAll();
      });
      navRow.appendChild(b);
    });
  }

  function renderCase() {
    const c = current();
    caseCard.innerHTML = `
      <h3>${escapeHtml(c.title)}</h3>
      <div class="meta">${escapeHtml(c.source)}</div>
    `;
    logBox.innerHTML = c.lines
      .map((l) => {
        const cls = l.c || "";
        return `<span class="${cls}">${escapeHtml(l.t)}</span>`;
      })
      .join("\n");
    cueList.innerHTML = c.cues.map((x) => `<li>Look for <code>${escapeHtml(x)}</code></li>`).join("");
  }

  function renderChoices() {
    const c = current();
    document.querySelectorAll(".choice-row button").forEach((btn) => {
      const v = btn.getAttribute("data-c");
      btn.classList.remove("is-picked", "is-correct", "is-wrong");
      if (state.lastPick === v) {
        btn.classList.add("is-picked");
        if (state.lastOk === true) btn.classList.add("is-correct");
        if (state.lastOk === false) btn.classList.add("is-wrong");
      }
      btn.onclick = () => choose(v);
    });
    if (!state.lastPick) {
      resultPill.className = "result-pill idle";
      resultPill.textContent = "Pick a bucket";
      whyBox.innerHTML = '<span class="muted">Classify the log, then see why.</span>';
    } else if (state.lastOk) {
      resultPill.className = "result-pill pass";
      resultPill.textContent = `Correct · ${c.kind}`;
      whyBox.textContent = c.why;
    } else {
      resultPill.className = "result-pill fail";
      resultPill.textContent = `Lab expected: ${c.kind}`;
      whyBox.textContent = c.why;
    }
  }

  function renderHist() {
    if (!state.log.length) {
      histBox.innerHTML = '<span class="muted">(no classifications yet)</span>';
      return;
    }
    histBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderStatus() {
    const done = Object.keys(state.picks).length;
    const correct = CASES.filter((c) => state.picks[c.id] === c.kind).length;
    statusRow.innerHTML = `<strong>Case ${state.caseIdx + 1}/${CASES.length}</strong> · ${done} classified · ${correct} correct`;
  }

  function renderAll() {
    renderNav();
    renderCase();
    renderChoices();
    renderHist();
    renderStatus();
    saveSession();
  }

  function choose(v) {
    const c = current();
    state.lastPick = v;
    state.picks[c.id] = v;
    state.lastOk = v === c.kind;
    pushLog(state.lastOk ? "ok" : "warn", `${c.id}: ${v} (expected ${c.kind})`);
    renderAll();
  }

  function loadStarter() {
    state = defaultState();
    pushLog("muted", "# starter: case 1 is a deterministic TB fail");
    renderAll();
  }

  document.getElementById("lt-starter").addEventListener("click", loadStarter);

  function correctCount() {
    return CASES.filter((c) => state.picks[c.id] === c.kind).length;
  }

  const CHALLENGES = [
    {
      id: "quiz-buckets",
      title: "Quiz: buckets",
      prompt: "Three triage buckets: fail, env, and? Answer: <code>flake</code>",
      hint: "intermittent",
      type: "text",
      answer: "flake",
      alt: ["flaky", "flake"],
    },
    {
      id: "quiz-env",
      title: "Quiz: env",
      prompt: "<code>command not found</code> is usually? Answer: <code>env</code>",
      hint: "PATH/tooling",
      type: "text",
      answer: "env",
      alt: ["environment"],
    },
    {
      id: "quiz-fail",
      title: "Quiz: fail",
      prompt: "Deterministic expect/got mismatch is? Answer: <code>fail</code>",
      hint: "real bug until proven else",
      type: "text",
      answer: "fail",
    },
    {
      id: "case-mismatch",
      title: "Case: mismatch",
      prompt: "Case 1 — classify <strong>fail</strong>.",
      hint: "nav 1",
      type: "state",
      setup: () => {
        state.caseIdx = 0;
        state.lastPick = "";
        state.lastOk = null;
        renderAll();
      },
      check: () => state.picks.mismatch === "fail",
    },
    {
      id: "case-tool",
      title: "Case: missing tool",
      prompt: "Case 2 — <strong>env</strong>.",
      hint: "nav 2",
      type: "state",
      setup: () => {
        state.caseIdx = 1;
        renderAll();
      },
      check: () => state.picks["missing-tool"] === "env",
    },
    {
      id: "case-timeout",
      title: "Case: timeout",
      prompt: "Case 3 — <strong>flake</strong>.",
      hint: "nav 3",
      type: "state",
      setup: () => {
        state.caseIdx = 2;
        renderAll();
      },
      check: () => state.picks["timeout-race"] === "flake",
    },
    {
      id: "case-syntax",
      title: "Case: syntax",
      prompt: "Case 4 — <strong>fail</strong>.",
      hint: "nav 4",
      type: "state",
      setup: () => {
        state.caseIdx = 3;
        renderAll();
      },
      check: () => state.picks.syntax === "fail",
    },
    {
      id: "case-license",
      title: "Case: license",
      prompt: "Case 5 — <strong>env</strong>.",
      hint: "nav 5",
      type: "state",
      setup: () => {
        state.caseIdx = 4;
        renderAll();
      },
      check: () => state.picks.license === "env",
    },
    {
      id: "case-x",
      title: "Case: X-prop",
      prompt: "Case 6 — <strong>fail</strong>.",
      hint: "nav 6",
      type: "state",
      setup: () => {
        state.caseIdx = 5;
        renderAll();
      },
      check: () => state.picks["x-propagation"] === "fail",
    },
    {
      id: "case-disk",
      title: "Case: disk",
      prompt: "Case 7 — <strong>env</strong>.",
      hint: "nav 7",
      type: "state",
      setup: () => {
        state.caseIdx = 6;
        renderAll();
      },
      check: () => state.picks["disk-full"] === "env",
    },
    {
      id: "case-parallel",
      title: "Case: parallel",
      prompt: "Case 8 — <strong>flake</strong>.",
      hint: "nav 8",
      type: "state",
      setup: () => {
        state.caseIdx = 7;
        renderAll();
      },
      check: () => state.picks["order-dep"] === "flake",
    },
    {
      id: "case-include",
      title: "Case: include",
      prompt: "Case 9 — <strong>env</strong>.",
      hint: "nav 9",
      type: "state",
      setup: () => {
        state.caseIdx = 8;
        renderAll();
      },
      check: () => state.picks["missing-file"] === "env",
    },
    {
      id: "case-assert",
      title: "Case: assert",
      prompt: "Case 10 — <strong>fail</strong>.",
      hint: "nav 10",
      type: "state",
      setup: () => {
        state.caseIdx = 9;
        renderAll();
      },
      check: () => state.picks["assert-fail"] === "fail",
    },
    {
      id: "case-python",
      title: "Case: cocotb",
      prompt: "Case 11 — <strong>env</strong>.",
      hint: "nav 11",
      type: "state",
      setup: () => {
        state.caseIdx = 10;
        renderAll();
      },
      check: () => state.picks["npm-wrong"] === "env",
    },
    {
      id: "case-cdc",
      title: "Case: rare CDC",
      prompt: "Case 12 — <strong>flake</strong>.",
      hint: "nav 12",
      type: "state",
      setup: () => {
        state.caseIdx = 11;
        renderAll();
      },
      check: () => state.picks["timing-slack"] === "flake",
    },
    {
      id: "quiz-first-error",
      title: "Quiz: first error",
      prompt: "Prefer reading the? Answer: <code>first</code> actionable error",
      hint: "not only Make footer",
      type: "text",
      answer: "first",
      alt: ["first error", "first actionable", "root cause"],
    },
    {
      id: "quiz-flake-ticket",
      title: "Quiz: flake ticket",
      prompt: "Flakes should still get a? Answer: <code>ticket</code> or <code>bug</code>",
      hint: "don't ignore",
      type: "text",
      answer: "ticket",
      alt: ["bug", "issue", "bug ticket"],
    },
    {
      id: "six-correct",
      title: "Six correct",
      prompt: "Classify at least 6 cases correctly.",
      hint: "work through nav",
      type: "state",
      check: () => correctCount() >= 6,
    },
    {
      id: "all-twelve",
      title: "All twelve",
      prompt: "Correct bucket on all 12 cases.",
      hint: "finish the set",
      type: "state",
      check: () => correctCount() >= 12,
    },
    {
      id: "quiz-127",
      title: "Quiz: 127",
      prompt: "Make Error 127 often means? Answer: <code>command not found</code>",
      hint: "shell exit",
      type: "text",
      answer: "command not found",
      alt: ["not found", "missing command"],
    },
    {
      id: "quiz-make-error",
      title: "Quiz: make",
      prompt: "Final <code>make: *** Error</code> alone tells the root cause? Answer: <code>no</code>",
      hint: "scroll up",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "starter-case1",
      title: "Starter case",
      prompt: "Load starter — case 1 expected bucket? Answer: <code>fail</code>",
      hint: "Load starter",
      type: "text",
      answer: "fail",
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Classify the log, then Check.</span>`;
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
