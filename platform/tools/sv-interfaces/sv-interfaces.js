(() => {
  /**
   * Interface + modport sketch (no VIP runtime):
   *   interface  — named signal bundle
   *   modport    — role view with per-signal directions
   * Demo bus: clk, rst_n, valid, ready, data[7:0]
   *   src (producer): valid/data out, ready in
   *   dst (consumer): valid/data in, ready out
   */

  const SIGNALS = [
    { name: "clk", width: "1", note: "clock" },
    { name: "rst_n", width: "1", note: "active-low reset" },
    { name: "valid", width: "1", note: "payload valid" },
    { name: "ready", width: "1", note: "backpressure" },
    { name: "data", width: "8", note: "payload" },
  ];

  const MODPORTS = {
    src: {
      label: "src (producer)",
      dirs: {
        clk: "input",
        rst_n: "input",
        valid: "output",
        ready: "input",
        data: "output",
      },
    },
    dst: {
      label: "dst (consumer)",
      dirs: {
        clk: "input",
        rst_n: "input",
        valid: "input",
        ready: "output",
        data: "input",
      },
    },
  };

  function makeStarter() {
    return {
      view: "bundle", // bundle | src | dst | connect | misuse
      prodPort: "src", // which modport producer module uses
      consPort: "dst",
      lastAction: "",
      explained: false,
      sketched: false,
      setSrc: false,
      setDst: false,
      setConnect: false,
      setMisuse: false,
      setBundle: false,
      log: [],
      trace: [],
    };
  }

  function connectionOk(state) {
    return state.prodPort === "src" && state.consPort === "dst";
  }

  function flippedPair(sig) {
    // signals whose directions should be opposite between src and dst
    return sig === "valid" || sig === "ready" || sig === "data";
  }

  function directionsOk() {
    return SIGNALS.every((s) => {
      if (!flippedPair(s.name)) {
        return (
          MODPORTS.src.dirs[s.name] === "input" &&
          MODPORTS.dst.dirs[s.name] === "input"
        );
      }
      const a = MODPORTS.src.dirs[s.name];
      const b = MODPORTS.dst.dirs[s.name];
      return (
        (a === "output" && b === "input") ||
        (a === "input" && b === "output")
      );
    });
  }

  function ifaceDecl() {
    return `interface stream_if;
  logic        clk;
  logic        rst_n;
  logic        valid;
  logic        ready;
  logic [7:0]  data;

  modport src (
    input  clk, rst_n, ready,
    output valid, data
  );
  modport dst (
    input  clk, rst_n, valid, data,
    output ready
  );
endinterface`;
  }

  function sourceCode(state) {
    if (state.view === "bundle") {
      return ifaceDecl() + "\n// bundle only — pick a modport view";
    }
    if (state.view === "src" || state.view === "dst") {
      const mp = MODPORTS[state.view];
      const lines = SIGNALS.map(
        (s) => `  // ${s.name}: ${mp.dirs[s.name]}`
      ).join("\n");
      return `// viewing modport ${state.view}\n${ifaceDecl()}\n/*\n${lines}\n*/`;
    }
    if (state.view === "misuse") {
      return `stream_if bus();
// WRONG: both ends use .src — ready/valid directions clash
producer u_p (.bus(bus.src));
consumer u_c (.bus(bus.src));  // should be bus.dst`;
    }
    // connect
    return `stream_if bus();
producer u_p (.bus(bus.${state.prodPort}));
consumer u_c (.bus(bus.${state.consPort}));
${
  connectionOk(state)
    ? "// OK: src ↔ dst complementary directions"
    : "// BAD: modports not complementary"
}`;
  }

  const CLEARED_KEY = "ddv-sv-interfaces-cleared-v1";
  const STORE_KEY = "ddv-sv-interfaces-session-v1";

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

  const root = document.getElementById("if-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>stream_if</code> with
        <code>modport src</code> / <code>dst</code> for a valid/ready byte stream.
        Open each role, then sketch the producer↔consumer connection.</p>
      <button type="button" class="btn btn-secondary" id="if-starter">Load starter example</button>
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
            <h3>interface</h3>
            <p>One bundle for related signals — declare once.</p>
          </div>
          <div class="idea-card">
            <h3>modport</h3>
            <p>Role-specific directions (input/output per signal).</p>
          </div>
          <div class="idea-card">
            <h3>connect</h3>
            <p>Pass <code>bus.src</code> / <code>bus.dst</code> into modules.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Bundle &amp; roles</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>View
              <select id="view-sel">
                <option value="bundle" selected>interface bundle</option>
                <option value="src">modport src</option>
                <option value="dst">modport dst</option>
                <option value="connect">connection sketch</option>
                <option value="misuse">misuse (both .src)</option>
              </select>
            </label>
          </div>
          <div class="role-pills" id="role-pills"></div>
          <p class="legend" id="mode-legend"></p>
          <div class="topo" id="topo"></div>
          <table class="sig-table" id="sig-table">
            <thead><tr><th>Signal</th><th>Width</th><th>Direction (view)</th></tr></thead>
            <tbody></tbody>
          </table>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box hidden" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-bundle">Show interface bundle</button>
            <button type="button" id="btn-src">View modport src</button>
            <button type="button" id="btn-dst">View modport dst</button>
            <button type="button" id="btn-connect">Sketch good connection</button>
            <button type="button" id="btn-misuse">Show both-.src misuse</button>
            <button type="button" id="btn-sketch">Highlight handshake dirs</button>
            <button type="button" id="btn-explain">Explain interface/modport</button>
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
            <div class="status-card" id="card-conn">
              <h3>Connection</h3>
              <p class="val" id="val-conn">—</p>
              <p class="note" id="note-conn"></p>
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
          <thead><tr><th>Construct</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>interface</code></td><td>Named group of nets/vars</td></tr>
            <tr><td><code>modport</code></td><td>Directions for one role</td></tr>
            <tr><td><code>bus.src</code></td><td>Instance sliced as producer view</td></tr>
            <tr><td>Complementary</td><td>valid/data out on src ↔ in on dst; ready flips</td></tr>
            <tr><td>Not covered here</td><td>clocking blocks, VIP, virtual interfaces</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter: bundle → src → dst → good connection.</li>
          <li>Both ends on <code>.src</code> is a classic direction clash.</li>
        </ul>
      </div>
    </div>
  `;

  const viewSel = document.getElementById("view-sel");
  const rolePills = document.getElementById("role-pills");
  const modeLegend = document.getElementById("mode-legend");
  const topo = document.getElementById("topo");
  const sigTableBody = document.querySelector("#sig-table tbody");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const cardRole = document.getElementById("card-role");
  const cardConn = document.getElementById("card-conn");
  const valRole = document.getElementById("val-role");
  const valConn = document.getElementById("val-conn");
  const noteRole = document.getElementById("note-role");
  const noteConn = document.getElementById("note-conn");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  ["bundle", "src", "dst", "connect"].forEach((v) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "role-pill";
    b.dataset.v = v;
    b.textContent =
      v === "bundle" ? "bundle" : v === "connect" ? "connect" : "modport " + v;
    b.addEventListener("click", () => {
      state.view = v;
      if (v === "src") state.setSrc = true;
      if (v === "dst") state.setDst = true;
      if (v === "connect") {
        state.setConnect = true;
        state.prodPort = "src";
        state.consPort = "dst";
      }
      if (v === "bundle") state.setBundle = true;
      state.lastAction = "pill";
      pushLog("run", `# view → ${v}`);
      renderAll();
    });
    rolePills.appendChild(b);
  });

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

  function dirClass(d) {
    if (d === "input") return "dir-in";
    if (d === "output") return "dir-out";
    return "dir-inout";
  }

  function activeModport() {
    if (state.view === "src") return "src";
    if (state.view === "dst") return "dst";
    return null;
  }

  function renderPills() {
    rolePills.querySelectorAll(".role-pill").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.v === state.view);
    });
  }

  function renderTopo() {
    const ok = connectionOk(state);
    const misuse = state.view === "misuse";
    topo.innerHTML = `
      <div class="topo-box ${state.view === "src" || state.view === "connect" ? "is-active" : ""}">
        <h3>producer</h3>
        .bus(bus.${misuse ? "src" : state.prodPort})
      </div>
      <div class="topo-hub">stream_if<br>bus</div>
      <div class="topo-box ${state.view === "dst" || state.view === "connect" ? "is-active" : ""}">
        <h3>consumer</h3>
        .bus(bus.${misuse ? "src" : state.consPort})
      </div>`;
    void ok;
  }

  function renderTable() {
    const mp = activeModport();
    sigTableBody.innerHTML = "";
    SIGNALS.forEach((s) => {
      const tr = document.createElement("tr");
      let dir = "—";
      let cls = "";
      if (mp) {
        dir = MODPORTS[mp].dirs[s.name];
        cls = dirClass(dir);
      } else if (state.view === "connect" || state.view === "misuse") {
        dir = `src:${MODPORTS.src.dirs[s.name]} / dst:${MODPORTS.dst.dirs[s.name]}`;
      } else {
        dir = "bundled";
      }
      tr.innerHTML = `<td>${s.name}</td><td>${s.width}</td><td class="${cls}">${dir}</td>`;
      sigTableBody.appendChild(tr);
    });
  }

  function renderStatus() {
    if (state.view === "bundle") {
      valRole.textContent = "stream_if";
      noteRole.textContent = "5 signals in the bundle";
      cardRole.className = "status-card is-ok";
    } else if (state.view === "src" || state.view === "dst") {
      valRole.textContent = "modport " + state.view;
      noteRole.textContent = MODPORTS[state.view].label;
      cardRole.className = "status-card is-ok";
    } else if (state.view === "misuse") {
      valRole.textContent = "misuse";
      noteRole.textContent = "both ends .src";
      cardRole.className = "status-card is-warn";
    } else {
      valRole.textContent = "connect";
      noteRole.textContent = "producer ↔ consumer";
      cardRole.className = "status-card is-ok";
    }

    if (state.view === "misuse" || !connectionOk(state)) {
      valConn.textContent = "BAD";
      noteConn.textContent = "modports not complementary";
      cardConn.className = "status-card is-warn";
    } else if (state.view === "connect") {
      valConn.textContent = "OK";
      noteConn.textContent = "bus.src ↔ bus.dst";
      cardConn.className = "status-card is-ok";
    } else {
      valConn.textContent = connectionOk(state) ? "ready" : "—";
      noteConn.textContent = "sketch connection to verify";
      cardConn.className = "status-card";
    }
  }

  function renderWarn() {
    warnBox.classList.remove("is-ok");
    if (state.view === "misuse" || (state.view === "connect" && !connectionOk(state))) {
      warnBox.classList.remove("hidden");
      warnBox.textContent =
        "Direction clash: both sides driving/receiving the same handshake signals.";
    } else if (state.view === "connect" && connectionOk(state)) {
      warnBox.classList.remove("hidden");
      warnBox.classList.add("is-ok");
      warnBox.textContent = "Complementary modports — valid/data vs ready directions match.";
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
    if (state.view === "bundle")
      return "Interface lists members; modports add directions per role.";
    if (state.view === "src")
      return "Producer drives valid/data; samples ready.";
    if (state.view === "dst")
      return "Consumer samples valid/data; drives ready.";
    if (state.view === "misuse")
      return "Same modport on both ends — directions collide.";
    return "Pass complementary modports into each module port.";
  }

  function renderAll() {
    viewSel.value = state.view;
    renderPills();
    modeLegend.textContent = legendText();
    renderTopo();
    renderTable();
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
    state.setBundle = true;
    pushLog("muted", "# starter stream_if bundle");
    state.trace = [];
    renderAll();
  }

  function sketchHandshake() {
    state.sketched = true;
    state.lastAction = "sketch";
    state.trace = [
      { kind: "muted", text: "handshake directions" },
      { kind: "ok", text: "src: output valid, data · input ready" },
      { kind: "ok", text: "dst: input valid, data · output ready" },
      {
        kind: directionsOk() ? "ok" : "bad",
        text: directionsOk()
          ? "src/dst are complementary on handshake signals"
          : "direction table broken",
      },
      { kind: "hi", text: "clk/rst_n are input on both modports" },
    ];
    pushLog("ok", "# sketched handshake");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: "interface + modport" },
      { kind: "hi", text: "interface = reusable signal bundle" },
      { kind: "ok", text: "modport = directions for one role" },
      {
        kind: "run",
        text: "connect with bus.src / bus.dst (not raw loose ports)",
      },
      {
        kind: "warn",
        text: "This lab is a sketch — not UVM VIP / virtual interface",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("if-starter").addEventListener("click", loadStarter);

  viewSel.addEventListener("change", () => {
    state.view = viewSel.value;
    if (state.view === "src") state.setSrc = true;
    if (state.view === "dst") state.setDst = true;
    if (state.view === "connect") {
      state.setConnect = true;
      state.prodPort = "src";
      state.consPort = "dst";
    }
    if (state.view === "misuse") {
      state.setMisuse = true;
      state.prodPort = "src";
      state.consPort = "src";
    }
    if (state.view === "bundle") state.setBundle = true;
    state.lastAction = "view";
    pushLog("run", `# view → ${state.view}`);
    renderAll();
  });

  document.getElementById("btn-bundle").addEventListener("click", () => {
    state.view = "bundle";
    state.prodPort = "src";
    state.consPort = "dst";
    state.setBundle = true;
    state.lastAction = "preset-bundle";
    pushLog("ok", "# show bundle");
    renderAll();
  });

  document.getElementById("btn-src").addEventListener("click", () => {
    state.view = "src";
    state.setSrc = true;
    state.lastAction = "preset-src";
    pushLog("ok", "# view src");
    renderAll();
  });

  document.getElementById("btn-dst").addEventListener("click", () => {
    state.view = "dst";
    state.setDst = true;
    state.lastAction = "preset-dst";
    pushLog("ok", "# view dst");
    renderAll();
  });

  document.getElementById("btn-connect").addEventListener("click", () => {
    state.view = "connect";
    state.prodPort = "src";
    state.consPort = "dst";
    state.setConnect = true;
    state.lastAction = "preset-connect";
    pushLog("ok", "# good connection");
    renderAll();
  });

  document.getElementById("btn-misuse").addEventListener("click", () => {
    state.view = "misuse";
    state.prodPort = "src";
    state.consPort = "src";
    state.setMisuse = true;
    state.lastAction = "preset-misuse";
    pushLog("warn", "# both .src misuse");
    renderAll();
  });

  document.getElementById("btn-sketch").addEventListener("click", sketchHandshake);
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-iface",
      title: "Quiz: interface",
      prompt: "SV construct for a signal bundle? Answer: <code>interface</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "interface",
      alt: ["iface", "interfaces"],
    },
    {
      id: "quiz-modport",
      title: "Quiz: modport",
      prompt: "Role view with directions is a? Answer: <code>modport</code>",
      hint: "mod port",
      type: "text",
      answer: "modport",
      alt: ["mod port", "modports"],
    },
    {
      id: "quiz-src",
      title: "Quiz: src",
      prompt: "Producer modport name in this lab? Answer: <code>src</code>",
      hint: "modport src",
      type: "text",
      answer: "src",
      alt: ["source", "producer"],
    },
    {
      id: "quiz-dst",
      title: "Quiz: dst",
      prompt: "Consumer modport name in this lab? Answer: <code>dst</code>",
      hint: "modport dst",
      type: "text",
      answer: "dst",
      alt: ["dest", "destination", "consumer"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — bundle view of stream_if.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.view === "bundle" && state.setBundle,
    },
    {
      id: "preset-src",
      title: "View src",
      prompt: "View modport src — valid is output.",
      hint: "View modport src",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setSrc &&
        state.view === "src" &&
        MODPORTS.src.dirs.valid === "output",
    },
    {
      id: "preset-dst",
      title: "View dst",
      prompt: "View modport dst — ready is output.",
      hint: "View modport dst",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setDst &&
        state.view === "dst" &&
        MODPORTS.dst.dirs.ready === "output",
    },
    {
      id: "preset-connect",
      title: "Connect OK",
      prompt: "Sketch good connection — connection OK.",
      hint: "Sketch good connection",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setConnect &&
        state.view === "connect" &&
        connectionOk(state),
    },
    {
      id: "preset-misuse",
      title: "Misuse",
      prompt: "Show both-.src misuse — connection BAD.",
      hint: "Show both-.src misuse",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setMisuse &&
        state.view === "misuse" &&
        !connectionOk(state),
    },
    {
      id: "sketch",
      title: "Handshake",
      prompt: "Highlight handshake dirs.",
      hint: "Highlight handshake dirs",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.sketched && state.lastAction === "sketch",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain interface/modport.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "view-dst",
      title: "Dropdown dst",
      prompt: "Switch View dropdown to modport dst.",
      hint: "View select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.view === "dst" && state.lastAction === "view",
    },
    {
      id: "quiz-valid-src",
      title: "Quiz: valid src",
      prompt: "On modport src, valid direction? Answer: <code>output</code>",
      hint: "producer drives valid",
      type: "text",
      answer: "output",
      alt: ["out"],
    },
    {
      id: "quiz-ready-src",
      title: "Quiz: ready src",
      prompt: "On modport src, ready direction? Answer: <code>input</code>",
      hint: "producer samples ready",
      type: "text",
      answer: "input",
      alt: ["in"],
    },
    {
      id: "quiz-bus-src",
      title: "Quiz: bus.src",
      prompt: "Producer connection uses? Answer: <code>bus.src</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "bus.src",
      alt: [".src", "bus.src()", "src"],
    },
    {
      id: "code-iface",
      title: "Code interface",
      prompt: "Bundle source contains <code>interface stream_if</code>.",
      hint: "Show interface bundle",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "bundle" &&
        sourceCode(state).includes("interface stream_if"),
    },
    {
      id: "code-modport",
      title: "Code modport",
      prompt: "Source includes <code>modport src</code>.",
      hint: "Any view shows decl",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode(state).includes("modport src"),
    },
    {
      id: "warn-misuse",
      title: "Warn misuse",
      prompt: "Misuse view shows warning (not is-ok).",
      hint: "Show both-.src misuse",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "misuse" &&
        !warnBox.classList.contains("hidden") &&
        !warnBox.classList.contains("is-ok"),
    },
    {
      id: "dirs-complement",
      title: "Complementary",
      prompt: "src/dst directions are complementary (lab invariant).",
      hint: "Always true — Check",
      type: "state",
      setup: () => loadStarter(),
      check: () => directionsOk(),
    },
    {
      id: "pill-src",
      title: "Pill src",
      prompt: "Click the modport src role pill.",
      hint: "role pill",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "src" && state.lastAction === "pill",
    },
    {
      id: "connect-ok-card",
      title: "OK card",
      prompt: "On good connection, Connection card reads OK.",
      hint: "Sketch good connection",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.view === "connect" &&
        connectionOk(state) &&
        valConn.textContent === "OK",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → src → dst → connect → explain.",
      hint: "bundle→src→dst→connect→Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setSrc &&
        state.setDst &&
        state.setConnect &&
        state.view === "connect" &&
        connectionOk(state) &&
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
