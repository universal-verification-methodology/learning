(() => {
  /**
   * Checker / bind sketch:
   *   checker — reusable verification unit (assertions / properties); not synth RTL
   *   bind    — attach checker (or module) to a target instance without editing DUT
   * Contrast with synthesizable module that implements function.
   */

  function makeStarter() {
    return {
      view: "bind", // dut | checker | bind | inline | misuse
      bound: true,
      lastAction: "",
      explained: false,
      sketched: false,
      setDut: false,
      setChecker: false,
      setBind: false,
      setInline: false,
      setMisuse: false,
      log: [],
      trace: [],
    };
  }

  function dutCode() {
    return `module fifo (
  input  logic clk, rst_n,
  input  logic req,
  output logic ack
);
  // synthesizable RTL — no checker body required here
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) ack <= 0;
    else        ack <= req; // toy
endmodule`;
  }

  function checkerCode() {
    return `checker req_ack_chk (
  input logic clk, rst_n,
  input logic req, ack
);
  // verification intent — not a synth DUT replacement
  assert property (@(posedge clk) disable iff (!rst_n)
    req |-> ##[0:2] ack);
endchecker`;
  }

  function bindCode() {
    return `// attach without editing fifo.sv internals
bind fifo req_ack_chk chk_i (
  .clk(clk), .rst_n(rst_n),
  .req(req), .ack(ack)
);`;
  }

  function inlineCode() {
    return `module fifo (...);
  // assertions mixed into DUT source
  assert property (@(posedge clk) req |-> ##[0:2] ack);
  // ... RTL ...
endmodule`;
  }

  function misuseCode() {
    return `// WRONG mindset: treat checker as the design
module top;
  req_ack_chk u (.*); // checker is not the synthesizable DUT
endmodule
// Use a module for RTL; bind a checker for checks`;
  }

  function sourceCode(state) {
    if (state.view === "dut") return dutCode();
    if (state.view === "checker") return checkerCode();
    if (state.view === "inline") return inlineCode();
    if (state.view === "misuse") return misuseCode();
    // bind
    return `${dutCode()}

${checkerCode()}

${state.bound ? bindCode() : "// bind disabled — checker not attached"}`;
  }

  const CLEARED_KEY = "ddv-sv-checker-cleared-v1";
  const STORE_KEY = "ddv-sv-checker-session-v1";

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

  const root = document.getElementById("ck-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> synthesizable <code>fifo</code> plus
        <code>checker req_ack_chk</code>, attached with <code>bind fifo …</code>
        so the DUT source stays clean.</p>
      <button type="button" class="btn btn-secondary" id="ck-starter">Load starter example</button>
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
            <h3>module</h3>
            <p>Synthesizable structure / behavior for silicon.</p>
          </div>
          <div class="idea-card">
            <h3>checker</h3>
            <p>Reusable property / assert package for verification.</p>
          </div>
          <div class="idea-card">
            <h3>bind</h3>
            <p>Hook a checker onto an instance without DUT edits.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Sketch views</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>View
              <select id="view-sel">
                <option value="dut">DUT module only</option>
                <option value="checker">checker only</option>
                <option value="bind" selected>bind attach</option>
                <option value="inline">inline assert in DUT</option>
                <option value="misuse">misuse (checker as DUT)</option>
              </select>
            </label>
            <label id="bound-wrap">
              <input type="checkbox" id="bound-chk" checked> bind enabled
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="topo" id="topo"></div>
          <div class="compare">
            <div class="cmp-card is-mod">
              <h3>Synthesizable module</h3>
              <ul>
                <li>ports, always_ff / comb</li>
                <li>goes to gates / FPGA</li>
                <li>functional design</li>
              </ul>
            </div>
            <div class="cmp-card is-chk">
              <h3>checker</h3>
              <ul>
                <li>assert / assume / cover</li>
                <li>sim / formal intent</li>
                <li>not a drop-in DUT</li>
              </ul>
            </div>
          </div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-dut">Show DUT module</button>
            <button type="button" id="btn-checker">Show checker</button>
            <button type="button" id="btn-bind">Show bind attach</button>
            <button type="button" id="btn-inline">Show inline asserts</button>
            <button type="button" id="btn-misuse">Show misuse</button>
            <button type="button" id="btn-sketch">Sketch bind flow</button>
            <button type="button" id="btn-explain">Explain checker/bind</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Role summary</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card" id="card-role">
              <h3>Active view</h3>
              <p class="val" id="val-role">—</p>
              <p class="note" id="note-role"></p>
            </div>
            <div class="status-card" id="card-synth">
              <h3>Synth RTL?</h3>
              <p class="val" id="val-synth">—</p>
              <p class="note" id="note-synth"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Construct</th><th>Use for</th></tr></thead>
          <tbody>
            <tr><td><code>module</code></td><td>Design under test / synthesizable hierarchy</td></tr>
            <tr><td><code>checker</code></td><td>Reusable SVA / verification block</td></tr>
            <tr><td><code>bind</code></td><td>Attach checker/module to target instance</td></tr>
            <tr><td>Inline assert</td><td>OK for local checks; pollutes DUT source</td></tr>
            <tr><td>Formal / sim</td><td>Checkers participate in verification, not gate netlist</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: <code>bind fifo req_ack_chk chk_i (...);</code></li>
          <li>Do not confuse checker instances with the DUT you synthesize.</li>
        </ul>
      </div>
    </div>
  `;

  const viewSel = document.getElementById("view-sel");
  const boundWrap = document.getElementById("bound-wrap");
  const boundChk = document.getElementById("bound-chk");
  const modeLegend = document.getElementById("mode-legend");
  const topo = document.getElementById("topo");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardRole = document.getElementById("card-role");
  const cardSynth = document.getElementById("card-synth");
  const valRole = document.getElementById("val-role");
  const valSynth = document.getElementById("val-synth");
  const noteRole = document.getElementById("note-role");
  const noteSynth = document.getElementById("note-synth");
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

  function renderTopo() {
    if (state.view === "dut") {
      topo.innerHTML = `
        <div class="topo-box is-active"><h3>fifo (module)</h3>synthesizable DUT</div>
        <div class="topo-hub">RTL</div>
        <div class="topo-box"><h3>(no checker)</h3>not attached</div>`;
      return;
    }
    if (state.view === "checker") {
      topo.innerHTML = `
        <div class="topo-box"><h3>fifo</h3>target design</div>
        <div class="topo-hub">defs</div>
        <div class="topo-box is-check is-active"><h3>req_ack_chk</h3>checker</div>`;
      return;
    }
    if (state.view === "inline") {
      topo.innerHTML = `
        <div class="topo-box is-active"><h3>fifo + asserts</h3>mixed source</div>
        <div class="topo-hub">inline</div>
        <div class="topo-box"><h3>no bind</h3>checks live in DUT</div>`;
      return;
    }
    if (state.view === "misuse") {
      topo.innerHTML = `
        <div class="topo-box is-bad"><h3>checker as DUT?</h3>wrong role</div>
        <div class="topo-hub">✗</div>
        <div class="topo-box is-bad"><h3>synth flow</h3>expects module</div>`;
      return;
    }
    // bind
    topo.innerHTML = `
      <div class="topo-box is-active"><h3>fifo</h3>DUT instance</div>
      <div class="topo-hub ${state.bound ? "is-bind" : ""}">${state.bound ? "bind" : "—"}</div>
      <div class="topo-box ${state.bound ? "is-check is-active" : ""}"><h3>chk_i</h3>req_ack_chk</div>`;
  }

  function renderStatus() {
    const labels = {
      dut: "DUT module",
      checker: "checker",
      bind: "bind attach",
      inline: "inline assert",
      misuse: "misuse",
    };
    valRole.textContent = labels[state.view] || state.view;
    noteRole.textContent =
      state.view === "bind"
        ? state.bound
          ? "checker hooked to fifo"
          : "bind disabled"
        : "";

    cardRole.className =
      "status-card" +
      (state.view === "misuse" ? " is-warn" : " is-ok");

    if (state.view === "dut") {
      valSynth.textContent = "yes";
      noteSynth.textContent = "module → netlist candidate";
      cardSynth.className = "status-card is-ok";
    } else if (state.view === "checker") {
      valSynth.textContent = "no";
      noteSynth.textContent = "verification block";
      cardSynth.className = "status-card is-warn";
    } else if (state.view === "bind") {
      valSynth.textContent = "DUT yes";
      noteSynth.textContent = "checker rides along in sim/formal";
      cardSynth.className = "status-card is-ok";
    } else if (state.view === "inline") {
      valSynth.textContent = "mixed";
      noteSynth.textContent = "RTL + asserts in one file";
      cardSynth.className = "status-card";
    } else {
      valSynth.textContent = "no";
      noteSynth.textContent = "checker ≠ synthesizable DUT";
      cardSynth.className = "status-card is-warn";
    }
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (state.view === "misuse") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "A checker is not a synthesizable replacement for your DUT module.";
    } else if (state.view === "bind" && state.bound) {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent =
        "bind attaches verification without editing fifo internals.";
    } else if (state.view === "inline") {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Inline asserts work, but couple checks to DUT source ownership.";
    } else if (state.view === "bind" && !state.bound) {
      warnBox.classList.remove("hidden");
      warnBox.textContent = "Bind disabled — checker definition exists but is not attached.";
    } else {
      warnBox.classList.add("hidden");
      warnBox.textContent = "";
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(sketch or explain)</span>';
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

  function legendText() {
    if (state.view === "dut") return "Pure RTL module — what synthesis consumes.";
    if (state.view === "checker")
      return "Checker packages properties for reuse across DUTs.";
    if (state.view === "inline")
      return "Assertions written inside the module body.";
    if (state.view === "misuse")
      return "Don’t ship a checker where a module belongs.";
    return "bind target_module checker_type inst (ports);";
  }

  function renderAll() {
    viewSel.value = state.view;
    boundChk.checked = state.bound;
    boundWrap.hidden = state.view !== "bind";
    modeLegend.textContent = legendText();
    renderTopo();
    codeBox.textContent = sourceCode(state);
    renderStatus();
    renderWarn();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    state.setBind = true;
    pushLog("muted", "# starter bind fifo ↔ req_ack_chk");
    state.trace = [];
    renderAll();
  }

  function sketch() {
    state.sketched = true;
    state.view = "bind";
    state.bound = true;
    state.setBind = true;
    state.lastAction = "sketch";
    state.trace = [
      { kind: "muted", text: "bind flow" },
      { kind: "ok", text: "1. Write synthesizable module fifo" },
      { kind: "ok", text: "2. Write checker req_ack_chk with SVA" },
      {
        kind: "hi",
        text: "3. bind fifo req_ack_chk chk_i (...);",
      },
      {
        kind: "run",
        text: "Sim/formal sees chk_i; synth still sees fifo",
      },
    ];
    pushLog("ok", "# sketched bind flow");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "checker vs module vs bind" },
      { kind: "ok", text: "module = design (synth)" },
      { kind: "ok", text: "checker = reusable verification" },
      { kind: "hi", text: "bind = non-intrusive attach" },
      {
        kind: "warn",
        text: "Inline asserts couple ownership to DUT files",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("ck-starter").addEventListener("click", loadStarter);

  viewSel.addEventListener("change", () => {
    state.view = viewSel.value;
    if (state.view === "dut") state.setDut = true;
    if (state.view === "checker") state.setChecker = true;
    if (state.view === "bind") state.setBind = true;
    if (state.view === "inline") state.setInline = true;
    if (state.view === "misuse") state.setMisuse = true;
    state.lastAction = "view";
    pushLog("run", `# view → ${state.view}`);
    renderAll();
  });

  boundChk.addEventListener("change", () => {
    state.bound = boundChk.checked;
    state.lastAction = "bound";
    pushLog("run", `# bind ${state.bound ? "on" : "off"}`);
    renderAll();
  });

  document.getElementById("btn-dut").addEventListener("click", () => {
    state.view = "dut";
    state.setDut = true;
    state.lastAction = "preset-dut";
    pushLog("ok", "# show DUT");
    renderAll();
  });

  document.getElementById("btn-checker").addEventListener("click", () => {
    state.view = "checker";
    state.setChecker = true;
    state.lastAction = "preset-checker";
    pushLog("ok", "# show checker");
    renderAll();
  });

  document.getElementById("btn-bind").addEventListener("click", () => {
    state.view = "bind";
    state.bound = true;
    state.setBind = true;
    state.lastAction = "preset-bind";
    pushLog("ok", "# show bind");
    renderAll();
  });

  document.getElementById("btn-inline").addEventListener("click", () => {
    state.view = "inline";
    state.setInline = true;
    state.lastAction = "preset-inline";
    pushLog("ok", "# show inline");
    renderAll();
  });

  document.getElementById("btn-misuse").addEventListener("click", () => {
    state.view = "misuse";
    state.setMisuse = true;
    state.lastAction = "preset-misuse";
    pushLog("warn", "# misuse");
    renderAll();
  });

  document.getElementById("btn-sketch").addEventListener("click", sketch);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-checker",
      title: "Quiz: checker",
      prompt: "Reusable SVA block construct? Answer: <code>checker</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "checker",
      alt: ["checkers"],
    },
    {
      id: "quiz-bind",
      title: "Quiz: bind",
      prompt: "Attach without editing DUT using? Answer: <code>bind</code>",
      hint: "bind fifo …",
      type: "text",
      answer: "bind",
      alt: ["bind statement"],
    },
    {
      id: "quiz-module",
      title: "Quiz: module",
      prompt: "Synthesizable design unit is a? Answer: <code>module</code>",
      hint: "vs checker",
      type: "text",
      answer: "module",
      alt: ["modules"],
    },
    {
      id: "quiz-assert",
      title: "Quiz: assert",
      prompt: "Property check keyword often inside checkers? Answer: <code>assert</code>",
      hint: "assert property",
      type: "text",
      answer: "assert",
      alt: ["assert property", "assertion"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — bind view with bind enabled.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "bind" && state.bound === true,
    },
    {
      id: "preset-dut",
      title: "Show DUT",
      prompt: "Show DUT module.",
      hint: "Show DUT module",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setDut &&
        state.view === "dut" &&
        state.lastAction === "preset-dut",
    },
    {
      id: "preset-checker",
      title: "Show checker",
      prompt: "Show checker — source has checker req_ack_chk.",
      hint: "Show checker",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setChecker &&
        state.view === "checker" &&
        sourceCode(state).includes("checker req_ack_chk"),
    },
    {
      id: "preset-bind",
      title: "Show bind",
      prompt: "Show bind attach — contains bind fifo.",
      hint: "Show bind attach",
      type: "state",
      setup: () => {
        state.view = "dut";
        renderAll();
      },
      check: () =>
        state.setBind &&
        state.view === "bind" &&
        state.bound &&
        sourceCode(state).includes("bind fifo"),
    },
    {
      id: "preset-inline",
      title: "Inline",
      prompt: "Show inline asserts.",
      hint: "Show inline asserts",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setInline && state.view === "inline",
    },
    {
      id: "preset-misuse",
      title: "Misuse",
      prompt: "Show misuse (checker as DUT).",
      hint: "Show misuse",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setMisuse && state.view === "misuse",
    },
    {
      id: "sketch",
      title: "Sketch",
      prompt: "Sketch bind flow.",
      hint: "Sketch bind flow",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sketched && state.lastAction === "sketch",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain checker/bind.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "unbind",
      title: "Unbind",
      prompt: "On bind view, uncheck bind enabled.",
      hint: "Clear bind enabled checkbox",
      type: "state",
      setup: () => {
        state.view = "bind";
        state.bound = true;
        renderAll();
      },
      check: () =>
        state.view === "bind" &&
        state.bound === false &&
        state.lastAction === "bound",
    },
    {
      id: "view-checker",
      title: "Dropdown checker",
      prompt: "Switch View dropdown to checker only.",
      hint: "View select",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "checker" && state.lastAction === "view",
    },
    {
      id: "quiz-synth",
      title: "Quiz: synth",
      prompt: "What synthesis consumes? Answer: <code>module</code>",
      hint: "not checker",
      type: "text",
      answer: "module",
      alt: ["dut", "rtl module"],
    },
    {
      id: "code-bind",
      title: "Code bind",
      prompt: "Bind view with bind on includes <code>bind fifo</code>.",
      hint: "Show bind attach",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "bind" &&
        state.bound &&
        sourceCode(state).includes("bind fifo"),
    },
    {
      id: "code-assert",
      title: "Code assert",
      prompt: "Checker view includes <code>assert property</code>.",
      hint: "Show checker",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "checker" &&
        sourceCode(state).includes("assert property"),
    },
    {
      id: "warn-misuse",
      title: "Warn misuse",
      prompt: "Misuse view shows warning (not is-ok).",
      hint: "Show misuse",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "misuse" &&
        !warnBox.classList.contains("hidden") &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "synth-dut",
      title: "Synth yes",
      prompt: "DUT view — Synth RTL? reads yes.",
      hint: "Show DUT module",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "dut" && valSynth.textContent === "yes",
    },
    {
      id: "synth-checker",
      title: "Synth no",
      prompt: "Checker view — Synth RTL? reads no.",
      hint: "Show checker",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "checker" && valSynth.textContent === "no",
    },
    {
      id: "bound-ok-warn",
      title: "Bind OK",
      prompt: "Bind enabled shows ok warning box.",
      hint: "Show bind attach",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "bind" &&
        state.bound &&
        warnBox.classList.contains("is-ok"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → sketch → explain.",
      hint: "Load → Sketch bind flow → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.sketched &&
        state.explained &&
        state.view === "bind" &&
        state.bound &&
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
