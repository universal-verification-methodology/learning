(() => {
  /**
   * Classic Verilog (IEEE 1364) wire vs reg:
   *   wire / net  → driven by continuous assign, gates, port connections
   *   reg / var   → left-hand side of procedural = / <= in always/initial
   * reg ≠ flip-flop — combo always @(*) still needs a variable LHS.
   */

  const DRIVES = {
    assign: {
      id: "assign",
      label: "continuous assign",
      snippet: (t) => `${t} y;\nassign y = a & b;`,
    },
    always_combo: {
      id: "always_combo",
      label: "always @(*) combo",
      snippet: (t) => `${t} y;\nalways @(*) y = a & b;`,
    },
    always_ff: {
      id: "always_ff",
      label: "always @(posedge clk)",
      snippet: (t) => `${t} y;\nalways @(posedge clk) y <= d;`,
    },
    input_port: {
      id: "input_port",
      label: "module input port",
      snippet: (t) => `module m(${t === "reg" ? "input reg" : "input"} a);\n// classic: input is a net`,
    },
    output_assign: {
      id: "output_assign",
      label: "output + assign",
      snippet: (t) => `module m(output ${t} y, input a, b);\n  assign y = a & b;\nendmodule`,
    },
    output_always: {
      id: "output_always",
      label: "output + always",
      snippet: (t) => `module m(output ${t} y, input a, b);\n  always @(*) y = a & b;\nendmodule`,
    },
  };

  /** @returns {{legal:boolean, reason:string}} */
  function judge(drive, type) {
    // type: wire | reg
    switch (drive) {
      case "assign":
        return type === "wire"
          ? { legal: true, reason: "continuous assign drives a net" }
          : {
              legal: false,
              reason: "cannot continuous-assign a reg (classic Verilog)",
            };
      case "always_combo":
      case "always_ff":
        return type === "reg"
          ? {
              legal: true,
              reason:
                drive === "always_ff"
                  ? "procedural NBA targets a variable (may infer FF)"
                  : "procedural assign targets a variable (may still be combo)",
            }
          : {
              legal: false,
              reason: "cannot procedural-assign a wire",
            };
      case "input_port":
        return type === "wire"
          ? { legal: true, reason: "input ports are nets in IEEE 1364" }
          : {
              legal: false,
              reason: "classic Verilog: input cannot be declared reg",
            };
      case "output_assign":
        return type === "wire"
          ? { legal: true, reason: "output driven by assign → net/wire" }
          : {
              legal: false,
              reason: "output reg cannot be driven by assign",
            };
      case "output_always":
        return type === "reg"
          ? { legal: true, reason: "output driven in always → reg/variable" }
          : {
              legal: false,
              reason: "output wire cannot be procedural LHS",
            };
      default:
        return { legal: false, reason: "unknown" };
    }
  }

  const SCENARIOS = [
    {
      id: "combo-assign",
      title: "Combo via assign",
      drive: "assign",
      type: "wire",
      blurb: "Continuous AND — y is a net.",
    },
    {
      id: "combo-always",
      title: "Combo via always",
      drive: "always_combo",
      type: "reg",
      blurb: "Same AND in always @(*) — y is still a reg.",
    },
    {
      id: "ff",
      title: "Clocked FF",
      drive: "always_ff",
      type: "reg",
      blurb: "posedge procedural store — reg (and a real FF).",
    },
    {
      id: "bad-assign-reg",
      title: "Illegal: assign to reg",
      drive: "assign",
      type: "reg",
      blurb: "Shows the classic error.",
    },
    {
      id: "bad-always-wire",
      title: "Illegal: always to wire",
      drive: "always_combo",
      type: "wire",
      blurb: "Procedural LHS must be a variable.",
    },
    {
      id: "out-wire",
      title: "output + assign",
      drive: "output_assign",
      type: "wire",
      blurb: "Port kind follows the driver.",
    },
    {
      id: "out-reg",
      title: "output + always",
      drive: "output_always",
      type: "reg",
      blurb: "Procedural output → reg.",
    },
  ];

  function makeStarter() {
    return {
      drive: "assign",
      type: "wire",
      scenario: "combo-assign",
      lastAction: "",
      judged: false,
      explained: false,
      sawIllegal: false,
      sawFf: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-wire-vs-reg-cleared-v1";
  const STORE_KEY = "ddv-wire-vs-reg-session-v1";

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

  const root = document.getElementById("wr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>wire y; assign y = a &amp; b;</code> — legal.
        Flip type to <code>reg</code> → illegal. Same function in <code>always @(*)</code> needs <code>reg</code>.</p>
      <button type="button" class="btn btn-secondary" id="wr-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Core ideas</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>wire (net)</h3>
            <p>Driven by <code>assign</code>, gates, or port links.</p>
          </div>
          <div class="idea-card">
            <h3>reg (variable)</h3>
            <p>LHS of procedural <code>=</code> / <code>&lt;=</code> in <code>always</code>.</p>
          </div>
          <div class="idea-card">
            <h3>Myth</h3>
            <p><code>reg</code> ≠ flip-flop. Combo <code>always</code> still uses <code>reg</code>.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Legality playground</h2></div>
        <div class="panel-body">
          <p class="legend">Pick a drive style and declaration type — verdict updates live.</p>
          <div class="ctrl-row">
            <label>Drive
              <select id="drive-sel">
                <option value="assign">assign</option>
                <option value="always_combo">always @(*)</option>
                <option value="always_ff">always @(posedge)</option>
                <option value="input_port">input port</option>
                <option value="output_assign">output + assign</option>
                <option value="output_always">output + always</option>
              </select>
            </label>
            <label>Type
              <select id="type-sel">
                <option value="wire">wire</option>
                <option value="reg">reg</option>
              </select>
            </label>
          </div>
          <pre class="code-box" id="code-box"></pre>
          <div class="verdict" id="verdict">—</div>
          <p class="legend">Scenarios:</p>
          <div class="scenario-list" id="scenario-list"></div>
          <div class="action-grid">
            <button type="button" id="btn-legal-assign">Preset legal assign+wire</button>
            <button type="button" id="btn-illegal">Preset illegal assign+reg</button>
            <button type="button" id="btn-combo-reg">Preset combo always+reg</button>
            <button type="button" id="btn-ff">Preset posedge+reg</button>
            <button type="button" id="btn-explain">Explain verdict</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Drive × type matrix</h2></div>
        <div class="panel-body">
          <table class="matrix" id="matrix"></table>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Driver</th><th>Needs</th></tr></thead>
          <tbody>
            <tr><td><code>assign</code> / gates</td><td><code>wire</code> (net)</td></tr>
            <tr><td><code>always</code> / <code>initial</code></td><td><code>reg</code> (variable)</td></tr>
            <tr><td><code>input</code> port</td><td>net (not <code>reg</code> in classic)</td></tr>
            <tr><td><code>output</code> port</td><td>wire if assign; reg if always</td></tr>
            <tr><td>SystemVerilog <code>logic</code></td><td>Often replaces both (later course)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Synthesis cares about edge vs level sensitivity — not the keyword <code>reg</code>.</li>
          <li>Starter: legal wire+assign; illegal reg+assign.</li>
        </ul>
      </div>
    </div>
  `;

  const driveSel = document.getElementById("drive-sel");
  const typeSel = document.getElementById("type-sel");
  const codeBox = document.getElementById("code-box");
  const verdictEl = document.getElementById("verdict");
  const scenarioList = document.getElementById("scenario-list");
  const matrixEl = document.getElementById("matrix");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

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

  function currentJudge() {
    return judge(state.drive, state.type);
  }

  function renderCode() {
    const d = DRIVES[state.drive];
    codeBox.textContent = d.snippet(state.type);
  }

  function renderVerdict() {
    const j = currentJudge();
    state.judged = true;
    if (!j.legal) state.sawIllegal = true;
    if (state.drive === "always_ff" && state.type === "reg" && j.legal)
      state.sawFf = true;
    verdictEl.className = "verdict " + (j.legal ? "ok" : "bad");
    verdictEl.textContent = (j.legal ? "LEGAL — " : "ILLEGAL — ") + j.reason;
  }

  function renderScenarios() {
    scenarioList.innerHTML = "";
    SCENARIOS.forEach((sc) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = sc.id === state.scenario ? "is-active" : "";
      b.textContent = `${sc.title} — ${sc.blurb}`;
      b.addEventListener("click", () => {
        state.scenario = sc.id;
        state.drive = sc.drive;
        state.type = sc.type;
        state.lastAction = "scenario";
        pushLog("ok", `# scenario ${sc.id}`);
        renderAll();
      });
      scenarioList.appendChild(b);
    });
  }

  function renderMatrix() {
    const drives = [
      "assign",
      "always_combo",
      "always_ff",
      "input_port",
      "output_assign",
      "output_always",
    ];
    let html =
      "<tr><th>drive \\ type</th><th>wire</th><th>reg</th></tr>";
    drives.forEach((d) => {
      const jw = judge(d, "wire");
      const jr = judge(d, "reg");
      const hiW = state.drive === d && state.type === "wire" ? " hi" : "";
      const hiR = state.drive === d && state.type === "reg" ? " hi" : "";
      html += `<tr><th>${escapeHtml(DRIVES[d].label)}</th>`;
      html += `<td class="${jw.legal ? "ok" : "bad"}${hiW}">${jw.legal ? "OK" : "NO"}</td>`;
      html += `<td class="${jr.legal ? "ok" : "bad"}${hiR}">${jr.legal ? "OK" : "NO"}</td></tr>`;
    });
    matrixEl.innerHTML = html;
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(explain or change combo)</span>';
      return;
    }
    traceBox.innerHTML = state.trace
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no actions yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll() {
    driveSel.value = state.drive;
    typeSel.value = state.type;
    renderCode();
    renderVerdict();
    renderScenarios();
    renderMatrix();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter assign + wire");
    state.trace = [];
    renderAll();
  }

  function explain() {
    const j = currentJudge();
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: `${DRIVES[state.drive].label} + ${state.type}` },
      {
        kind: j.legal ? "ok" : "bad",
        text: j.reason,
      },
      {
        kind: "hi",
        text:
          state.type === "reg"
            ? "reg = variable storage in the language model"
            : "wire = net resolved from drivers",
      },
      {
        kind: "muted",
        text: "SV logic softens this split — master classic rules first",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("wr-starter").addEventListener("click", loadStarter);
  driveSel.addEventListener("change", () => {
    state.drive = driveSel.value;
    state.lastAction = "drive";
    pushLog("run", `# drive → ${state.drive}`);
    renderAll();
  });
  typeSel.addEventListener("change", () => {
    state.type = typeSel.value;
    state.lastAction = "type";
    pushLog("run", `# type → ${state.type}`);
    renderAll();
  });
  document.getElementById("btn-legal-assign").addEventListener("click", () => {
    state.drive = "assign";
    state.type = "wire";
    state.scenario = "combo-assign";
    state.lastAction = "preset-legal";
    pushLog("ok", "# legal assign+wire");
    renderAll();
  });
  document.getElementById("btn-illegal").addEventListener("click", () => {
    state.drive = "assign";
    state.type = "reg";
    state.scenario = "bad-assign-reg";
    state.lastAction = "preset-illegal";
    pushLog("warn", "# illegal assign+reg");
    renderAll();
  });
  document.getElementById("btn-combo-reg").addEventListener("click", () => {
    state.drive = "always_combo";
    state.type = "reg";
    state.scenario = "combo-always";
    state.lastAction = "preset-combo";
    pushLog("ok", "# combo always+reg");
    renderAll();
  });
  document.getElementById("btn-ff").addEventListener("click", () => {
    state.drive = "always_ff";
    state.type = "reg";
    state.scenario = "ff";
    state.lastAction = "preset-ff";
    pushLog("ok", "# posedge+reg");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-net",
      title: "Quiz: net",
      prompt: "Classic continuous-assign LHS is a? Answer: <code>wire</code>",
      hint: "net type",
      type: "text",
      answer: "wire",
      alt: ["net", "wire/net"],
    },
    {
      id: "quiz-var",
      title: "Quiz: variable",
      prompt: "Procedural always LHS needs a? Answer: <code>reg</code>",
      hint: "variable",
      type: "text",
      answer: "reg",
      alt: ["variable", "reg/variable"],
    },
    {
      id: "quiz-myth",
      title: "Quiz: myth",
      prompt: "Does reg always mean flip-flop? Answer: <code>no</code>",
      hint: "combo always uses reg too",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "quiz-input",
      title: "Quiz: input",
      prompt: "Classic module input is a? Answer: <code>net</code>",
      hint: "not reg",
      type: "text",
      answer: "net",
      alt: ["wire", "wire/net"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — assign + wire is legal.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "assign" &&
        state.type === "wire" &&
        currentJudge().legal,
    },
    {
      id: "illegal-assign-reg",
      title: "Illegal assign+reg",
      prompt: "Preset illegal assign+reg — verdict ILLEGAL.",
      hint: "Preset illegal button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "assign" &&
        state.type === "reg" &&
        !currentJudge().legal &&
        state.lastAction === "preset-illegal",
    },
    {
      id: "combo-reg",
      title: "Combo reg",
      prompt: "Preset combo always+reg — LEGAL (still not an FF).",
      hint: "Preset combo always+reg",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "always_combo" &&
        state.type === "reg" &&
        currentJudge().legal,
    },
    {
      id: "ff-preset",
      title: "FF preset",
      prompt: "Preset posedge+reg — LEGAL.",
      hint: "Preset posedge+reg",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "always_ff" &&
        state.type === "reg" &&
        currentJudge().legal &&
        state.sawFf,
    },
    {
      id: "bad-wire-always",
      title: "Bad wire always",
      prompt: "Set always @(*) + wire — ILLEGAL.",
      hint: "Drive always @(*), type wire",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "always_combo" &&
        state.type === "wire" &&
        !currentJudge().legal,
    },
    {
      id: "out-assign",
      title: "output assign",
      prompt: "Scenario output+assign with wire — LEGAL.",
      hint: "Click scenario output + assign",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "output_assign" &&
        state.type === "wire" &&
        currentJudge().legal,
    },
    {
      id: "out-always",
      title: "output always",
      prompt: "Scenario output+always with reg — LEGAL.",
      hint: "Click scenario output + always",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "output_always" &&
        state.type === "reg" &&
        currentJudge().legal,
    },
    {
      id: "input-wire",
      title: "input wire",
      prompt: "Drive = input port, type wire — LEGAL.",
      hint: "Select input port + wire",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "input_port" &&
        state.type === "wire" &&
        currentJudge().legal,
    },
    {
      id: "input-reg-bad",
      title: "input reg bad",
      prompt: "input port + reg — ILLEGAL in classic.",
      hint: "input port, type reg",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "input_port" &&
        state.type === "reg" &&
        !currentJudge().legal,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain verdict.",
      hint: "Explain verdict",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "toggle-type",
      title: "Toggle type",
      prompt: "Change the Type dropdown (lastAction type).",
      hint: "Pick wire or reg",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "type",
    },
    {
      id: "quiz-output",
      title: "Quiz: output",
      prompt: "output driven by always should be declared? Answer: <code>reg</code>",
      hint: "procedural port",
      type: "text",
      answer: "reg",
      alt: ["output reg", "variable"],
    },
    {
      id: "quiz-sv",
      title: "Quiz: SV",
      prompt: "SystemVerilog type that often replaces wire/reg? Answer: <code>logic</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "logic",
      alt: ["Logic"],
    },
    {
      id: "scenario-bad",
      title: "Scenario illegal",
      prompt: "Open scenario Illegal: assign to reg.",
      hint: "Scenarios list",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.scenario === "bad-assign-reg" &&
        !currentJudge().legal,
    },
    {
      id: "matrix-spot",
      title: "Matrix",
      prompt: "With assign+wire selected, matrix cell should be OK.",
      hint: "Preset legal assign+wire",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "assign" &&
        state.type === "wire" &&
        judge("assign", "wire").legal,
    },
    {
      id: "out-assign-reg-bad",
      title: "Bad out reg assign",
      prompt: "output+assign with reg — ILLEGAL.",
      hint: "Drive output+assign, type reg",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "output_assign" &&
        state.type === "reg" &&
        !currentJudge().legal,
    },
    {
      id: "quiz-1364",
      title: "Quiz: standard",
      prompt: "Classic Verilog IEEE number in this lab? Answer: <code>1364</code>",
      hint: "hero / cheat sheet era",
      type: "text",
      answer: "1364",
      alt: ["IEEE 1364", "ieee1364"],
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter legal → flip to reg (illegal) → explain.",
      hint: "Load → type reg → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.drive === "assign" &&
        state.type === "reg" &&
        !currentJudge().legal &&
        state.explained &&
        state.lastAction === "explain",
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function renderChallenge() {
    const c = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (clearedIds.length ? ` · ${clearedIds.length} cleared` : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${c.title}.</strong> ${c.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? "Hint: " + c.hint : "";
    const row = document.getElementById("chal-answer-row");
    row.innerHTML = "";
    if (c.type === "text") {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = "chal-input";
      inp.placeholder = "Your answer";
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
      row.appendChild(inp);
    }
    const st = document.getElementById("chal-status");
    st.textContent = isCleared(c.id) ? "Cleared" : "Idle";
    st.className =
      "challenge-status " + (isCleared(c.id) ? "pass" : "idle");

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kbd" + (i === challengeIdx ? " is-active" : "");
      b.textContent = (isCleared(ch.id) ? "✓ " : "") + ch.id;
      b.title = ch.title;
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    const c = CHALLENGES[challengeIdx];
    if (typeof c.setup === "function") c.setup();
    renderChallenge();
    saveSession();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const c = CHALLENGES[challengeIdx];
    const st = document.getElementById("chal-status");
    let ok = false;
    if (c.type === "text") {
      const got = normalizeAns(answerDraft || "");
      const targets = [c.answer, ...(c.alt || [])].map(normalizeAns);
      ok = targets.includes(got);
    } else if (c.type === "state") {
      ok = !!c.check();
    }
    if (ok) {
      markCleared(c.id);
      st.textContent = "Pass";
      st.className = "challenge-status pass";
      pushLog("ok", `# challenge ${c.id} pass`);
    } else {
      st.textContent = "Fail";
      st.className = "challenge-status fail";
      pushLog("warn", `# challenge ${c.id} fail`);
    }
    renderChallenge();
    renderLog();
    saveSession();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
