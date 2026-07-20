(() => {
  /**
   * ANSI (Verilog-2001) vs non-ANSI (Verilog-1995) module ports.
   * Non-ANSI: module m(a,b,y); input a,b; output y; …
   * ANSI:     module m(input a, input b, output y);
   */

  const VARIANTS = {
    combo: {
      id: "combo",
      title: "Combo AND (wire out)",
      blurb: "Continuous assign — output is a net in both styles.",
      nonAnsi: `module and2(a, b, y);
  input  a, b;
  output y;
  assign y = a & b;
endmodule`,
      ansi: `module and2(
  input  wire a,
  input  wire b,
  output wire y
);
  assign y = a & b;
endmodule`,
      diffs: [
        "Non-ANSI port list is names only: (a, b, y)",
        "Directions live in the body: input / output",
        "ANSI puts direction (+ type) in the header",
      ],
    },
    regout: {
      id: "regout",
      title: "Clocked (output reg)",
      blurb: "Procedural output — reg in ANSI header; separate in 1995.",
      nonAnsi: `module dff(clk, d, q);
  input  clk, d;
  output q;
  reg    q;
  always @(posedge clk) q <= d;
endmodule`,
      ansi: `module dff(
  input  wire clk,
  input  wire d,
  output reg  q
);
  always @(posedge clk) q <= d;
endmodule`,
      diffs: [
        "Non-ANSI: output q; then reg q;",
        "ANSI: output reg q in one declaration",
        "Same hardware: edge-triggered store",
      ],
    },
    bus: {
      id: "bus",
      title: "Bus widths",
      blurb: "Vector ranges move with the direction decls.",
      nonAnsi: `module add8(a, b, sum);
  input  [7:0] a, b;
  output [7:0] sum;
  assign sum = a + b;
endmodule`,
      ansi: `module add8(
  input  wire [7:0] a,
  input  wire [7:0] b,
  output wire [7:0] sum
);
  assign sum = a + b;
endmodule`,
      diffs: [
        "Width [7:0] sits on the direction line in both",
        "ANSI repeats the range per port in the header",
        "Non-ANSI can share: input [7:0] a, b;",
      ],
    },
    param: {
      id: "param",
      title: "Parameter + ports",
      blurb: "ANSI can declare #() before the port list.",
      nonAnsi: `module scale(x, y);
  parameter W = 4;
  input  [W-1:0] x;
  output [W-1:0] y;
  assign y = x;
endmodule`,
      ansi: `module scale #(
  parameter W = 4
) (
  input  wire [W-1:0] x,
  output wire [W-1:0] y
);
  assign y = x;
endmodule`,
      diffs: [
        "Non-ANSI: parameter inside the module body",
        "ANSI: #(parameter …) before ports is common",
        "Both elaborate the same WIDTH math",
      ],
    },
    inout: {
      id: "inout",
      title: "inout port",
      blurb: "Bidirectional net — still a net in both styles.",
      nonAnsi: `module pad(oe, din, pad);
  input  oe, din;
  inout  pad;
  assign pad = oe ? din : 1'bz;
endmodule`,
      ansi: `module pad(
  input  wire oe,
  input  wire din,
  inout  wire pad
);
  assign pad = oe ? din : 1'bz;
endmodule`,
      diffs: [
        "inout must be a net (wire), never a reg",
        "Header vs body is the only style difference",
        "Tri-state drive is separate from port syntax",
      ],
    },
  };

  function makeStarter() {
    return {
      variant: "combo",
      highlight: true,
      lastAction: "",
      explained: false,
      setReg: false,
      setBus: false,
      setParam: false,
      setInout: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-ansi-ports-cleared-v1";
  const STORE_KEY = "ddv-ansi-ports-session-v1";

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

  const root = document.getElementById("ap-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> 2-input AND —
        non-ANSI lists <code>(a, b, y)</code> then <code>input</code>/<code>output</code> in the body;
        ANSI puts directions in the header.</p>
      <button type="button" class="btn btn-secondary" id="ap-starter">Load starter example</button>
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
            <h3>1995 non-ANSI</h3>
            <p>Port list = names. Directions declared in the body.</p>
          </div>
          <div class="idea-card">
            <h3>2001 ANSI</h3>
            <p>Direction, type, and width in the header.</p>
          </div>
          <div class="idea-card">
            <h3>Same RTL</h3>
            <p>Style only — functionality and hierarchy match.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Variants</h2></div>
        <div class="panel-body">
          <p class="legend">Pick an example — both columns stay in sync.</p>
          <div class="pill-row" id="pill-row"></div>
          <p class="meta-line" id="blurb" style="font-size:0.88rem;color:var(--muted)"></p>
          <ul class="diff-list" id="diff-list"></ul>
          <div class="action-grid">
            <button type="button" id="btn-combo">Preset combo AND</button>
            <button type="button" id="btn-reg">Preset output reg FF</button>
            <button type="button" id="btn-bus">Preset 8-bit buses</button>
            <button type="button" id="btn-param">Preset parameter</button>
            <button type="button" id="btn-inout">Preset inout</button>
            <button type="button" id="btn-explain">Explain difference</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Side by side</h2></div>
        <div class="panel-body">
          <div class="compare">
            <div class="code-card non">
              <h3><span class="year-badge">1995</span> non-ANSI</h3>
              <pre class="code-box" id="code-non"></pre>
            </div>
            <div class="code-card ansi">
              <h3><span class="year-badge">2001</span> ANSI</h3>
              <pre class="code-box" id="code-ansi"></pre>
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
          <thead><tr><th>Topic</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>non-ANSI list</td><td><code>module m(a, b, y);</code> — identifiers only</td></tr>
            <tr><td>ANSI list</td><td><code>input wire a,</code> … inside <code>()</code></td></tr>
            <tr><td>output reg</td><td>ANSI: one decl; 1995: <code>output</code> + <code>reg</code></td></tr>
            <tr><td>inout</td><td>Always a net — never <code>reg</code></td></tr>
            <tr><td>Modern SV</td><td>Prefer ANSI + <code>logic</code> (later labs)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter AND: body <code>input a, b; output y;</code> ↔ header directions.</li>
          <li>Order of names in the non-ANSI list must match connections / docs.</li>
        </ul>
      </div>
    </div>
  `;

  const pillRow = document.getElementById("pill-row");
  const blurb = document.getElementById("blurb");
  const diffList = document.getElementById("diff-list");
  const codeNon = document.getElementById("code-non");
  const codeAnsi = document.getElementById("code-ansi");
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

  function current() {
    return VARIANTS[state.variant] || VARIANTS.combo;
  }

  /** Light highlight of direction keywords */
  function colorize(src, style) {
    let s = escapeHtml(src);
    if (!state.highlight) return s;
    if (style === "non") {
      s = s.replace(
        /\b(input|output|inout|reg|parameter)\b/g,
        '<span class="hi">$1</span>'
      );
      s = s.replace(
        /module\s+\w+\(([^)]*)\)/,
        (m, ports) =>
          m.replace(ports, `<span class="ok">${escapeHtml(ports)}</span>`)
      );
    } else {
      s = s.replace(
        /\b(input|output|inout|wire|reg|parameter)\b/g,
        '<span class="hi">$1</span>'
      );
    }
    return s;
  }

  function renderPills() {
    pillRow.innerHTML = "";
    Object.values(VARIANTS).forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = v.id === state.variant ? "is-active" : "";
      b.textContent = v.title;
      b.addEventListener("click", () => {
        state.variant = v.id;
        if (v.id === "regout") state.setReg = true;
        if (v.id === "bus") state.setBus = true;
        if (v.id === "param") state.setParam = true;
        if (v.id === "inout") state.setInout = true;
        state.lastAction = "variant";
        pushLog("run", `# variant → ${v.id}`);
        renderAll();
      });
      pillRow.appendChild(b);
    });
  }

  function renderCodes() {
    const v = current();
    blurb.textContent = v.blurb;
    diffList.innerHTML = v.diffs.map((d) => `<li>${escapeHtml(d)}</li>`).join("");
    codeNon.innerHTML = colorize(v.nonAnsi, "non");
    codeAnsi.innerHTML = colorize(v.ansi, "ansi");
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(pick a variant or explain)</span>';
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
    renderPills();
    renderCodes();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter combo AND");
    state.trace = [];
    renderAll();
  }

  function explain() {
    const v = current();
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      { kind: "muted", text: v.title },
      { kind: "hi", text: "non-ANSI: names in (); directions in body" },
      { kind: "hi", text: "ANSI: directions (+ types) in ()" },
      { kind: "ok", text: v.diffs[0] },
      { kind: "ok", text: v.diffs[1] || "" },
    ].filter((l) => l.text);
    pushLog("ok", "# explained");
    renderAll();
  }

  function setVariant(id, action) {
    state.variant = id;
    if (id === "regout") state.setReg = true;
    if (id === "bus") state.setBus = true;
    if (id === "param") state.setParam = true;
    if (id === "inout") state.setInout = true;
    state.lastAction = action;
    pushLog("ok", `# ${action}`);
    renderAll();
  }

  document.getElementById("ap-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-combo").addEventListener("click", () =>
    setVariant("combo", "preset-combo")
  );
  document.getElementById("btn-reg").addEventListener("click", () =>
    setVariant("regout", "preset-reg")
  );
  document.getElementById("btn-bus").addEventListener("click", () =>
    setVariant("bus", "preset-bus")
  );
  document.getElementById("btn-param").addEventListener("click", () =>
    setVariant("param", "preset-param")
  );
  document.getElementById("btn-inout").addEventListener("click", () =>
    setVariant("inout", "preset-inout")
  );
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-1995",
      title: "Quiz: year",
      prompt: "Non-ANSI style is associated with Verilog? Answer: <code>1995</code>",
      hint: "IEEE 1364-1995",
      type: "text",
      answer: "1995",
      alt: ["95", "1364-1995"],
    },
    {
      id: "quiz-2001",
      title: "Quiz: ANSI year",
      prompt: "ANSI port headers arrived in? Answer: <code>2001</code>",
      hint: "Verilog-2001",
      type: "text",
      answer: "2001",
      alt: ["01", "Verilog-2001"],
    },
    {
      id: "quiz-names",
      title: "Quiz: non-ANSI list",
      prompt: "Non-ANSI () list contains mainly? Answer: <code>names</code>",
      hint: "identifiers only",
      type: "text",
      answer: "names",
      alt: ["identifiers", "port names", "signals"],
    },
    {
      id: "quiz-header",
      title: "Quiz: ANSI",
      prompt: "ANSI puts directions in the? Answer: <code>header</code>",
      hint: "module port list",
      type: "text",
      answer: "header",
      alt: ["port list", "ports", "module header"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — combo AND variant.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.variant === "combo",
    },
    {
      id: "non-has-body-input",
      title: "Body input",
      prompt: "Starter non-ANSI source includes <code>input  a, b;</code>",
      hint: "Look at left column",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.variant === "combo" &&
        current().nonAnsi.includes("input  a, b;"),
    },
    {
      id: "ansi-has-input-wire",
      title: "ANSI input wire",
      prompt: "Starter ANSI source includes <code>input  wire a</code>",
      hint: "Right column",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.variant === "combo" &&
        current().ansi.includes("input  wire a"),
    },
    {
      id: "preset-reg",
      title: "output reg",
      prompt: "Preset output reg FF variant.",
      hint: "Preset output reg FF",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setReg &&
        state.variant === "regout" &&
        current().ansi.includes("output reg  q"),
    },
    {
      id: "reg-split",
      title: "1995 reg split",
      prompt: "On FF variant, non-ANSI has separate <code>reg    q;</code>",
      hint: "Preset FF",
      type: "state",
      setup: () => setVariant("regout", "preset-reg"),
      check: () =>
        state.variant === "regout" &&
        current().nonAnsi.includes("output q;") &&
        current().nonAnsi.includes("reg    q;"),
    },
    {
      id: "preset-bus",
      title: "Buses",
      prompt: "Preset 8-bit buses — both use [7:0].",
      hint: "Preset 8-bit buses",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setBus &&
        state.variant === "bus" &&
        current().ansi.includes("[7:0]"),
    },
    {
      id: "preset-param",
      title: "Parameter",
      prompt: "Preset parameter — ANSI has #(",
      hint: "Preset parameter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setParam &&
        state.variant === "param" &&
        current().ansi.includes("#("),
    },
    {
      id: "preset-inout",
      title: "inout",
      prompt: "Preset inout pad example.",
      hint: "Preset inout",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setInout &&
        state.variant === "inout" &&
        current().ansi.includes("inout  wire pad"),
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain difference.",
      hint: "Explain difference",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "quiz-inout-net",
      title: "Quiz: inout",
      prompt: "inout ports must be a? Answer: <code>net</code>",
      hint: "never reg",
      type: "text",
      answer: "net",
      alt: ["wire", "wire/net"],
    },
    {
      id: "variant-click",
      title: "Pick bus",
      prompt: "Click the Bus widths pill/variant.",
      hint: "Bus widths button in pills",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.variant === "bus" && state.lastAction === "variant",
    },
    {
      id: "quiz-same",
      title: "Quiz: function",
      prompt: "ANSI vs non-ANSI change functionality? Answer: <code>no</code>",
      hint: "style only",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "non-module-list",
      title: "Name list",
      prompt: "Starter non-ANSI opens with <code>module and2(a, b, y);</code>",
      hint: "Left column first line",
      type: "state",
      setup: () => loadStarter(),
      check: () => current().nonAnsi.startsWith("module and2(a, b, y);"),
    },
    {
      id: "quiz-output-reg",
      title: "Quiz: FF out",
      prompt: "ANSI keyword combo for FF q? Answer: <code>output reg</code>",
      hint: "one declaration",
      type: "text",
      answer: "output reg",
      alt: ["output reg q", "reg"],
    },
    {
      id: "param-body",
      title: "Param body",
      prompt: "On param variant, non-ANSI has parameter inside the body.",
      hint: "Preset parameter",
      type: "state",
      setup: () => setVariant("param", "preset-param"),
      check: () =>
        state.variant === "param" &&
        current().nonAnsi.includes("parameter W = 4;"),
    },
    {
      id: "quiz-prefer",
      title: "Quiz: modern",
      prompt: "Modern code usually prefers? Answer: <code>ANSI</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "ansi",
      alt: ["ANSI", "ansi ports", "2001"],
    },
    {
      id: "inout-z",
      title: "Tri-state assign",
      prompt: "inout example assigns 1'bz when oe is low.",
      hint: "Preset inout — read assign",
      type: "state",
      setup: () => setVariant("inout", "preset-inout"),
      check: () =>
        state.variant === "inout" &&
        current().ansi.includes("1'bz"),
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → FF preset → explain.",
      hint: "Load → Preset output reg → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.variant === "regout" &&
        state.setReg &&
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
