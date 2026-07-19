(() => {
  const STORAGE_KEY = "ddv-sensitivity-list-v1";
  const CLEARED_KEY = "ddv-sensitivity-list-cleared-v1";

  /**
   * Teaching model: sensitivity entries are { name, edge: "any"|"posedge"|"negedge" }.
   * On poke(name, next), if any entry matches the transition, the block runs and
   * recomputes Y from current signals; otherwise Y stays (possibly stale).
   */
  const SCENARIOS = [
    {
      id: "and2",
      title: "Combo AND",
      intent: "Y = A & B (combinational)",
      signals: ["A", "B"],
      outputs: ["Y"],
      eval(sig) {
        return { Y: sig.A & sig.B };
      },
      styles: [
        {
          id: "or-list",
          label: "@(A or B)",
          kind: "combo-ok",
          reason: "Both RHS reads are in the list — any change of A or B recomputes Y.",
          sens: [
            { name: "A", edge: "any" },
            { name: "B", edge: "any" },
          ],
          code: `always @(A or B) begin
  Y = A & B;
end`,
        },
        {
          id: "a-only",
          label: "@(A) incomplete",
          kind: "combo-bad",
          reason: "B is read but not listed — changing B alone leaves Y stale (sim bug).",
          sens: [{ name: "A", edge: "any" }],
          code: `always @(A) begin
  Y = A & B;  // B missing from sensitivity
end`,
        },
        {
          id: "star",
          label: "@(*)",
          kind: "combo-ok",
          reason: "@(*) / always_comb auto-includes every signal read on the RHS.",
          sens: [
            { name: "A", edge: "any" },
            { name: "B", edge: "any" },
          ],
          code: `always @(*) begin
  Y = A & B;
end`,
        },
        {
          id: "always-comb",
          label: "always_comb",
          kind: "combo-ok",
          reason: "SystemVerilog always_comb implies complete sensitivity (and checks).",
          sens: [
            { name: "A", edge: "any" },
            { name: "B", edge: "any" },
          ],
          code: `always_comb begin
  Y = A & B;
end`,
        },
      ],
    },
    {
      id: "mux21",
      title: "2:1 mux",
      intent: "Y = S ? D1 : D0",
      signals: ["S", "D0", "D1"],
      outputs: ["Y"],
      eval(sig) {
        return { Y: sig.S ? sig.D1 : sig.D0 };
      },
      styles: [
        {
          id: "full",
          label: "@(S or D0 or D1)",
          kind: "combo-ok",
          reason: "Select and both data inputs listed — complete combo.",
          sens: [
            { name: "S", edge: "any" },
            { name: "D0", edge: "any" },
            { name: "D1", edge: "any" },
          ],
          code: `always @(S or D0 or D1) begin
  Y = S ? D1 : D0;
end`,
        },
        {
          id: "s-only",
          label: "@(S) incomplete",
          kind: "combo-bad",
          reason: "Data changes when S is stable do not wake the block — Y can be wrong.",
          sens: [{ name: "S", edge: "any" }],
          code: `always @(S) begin
  Y = S ? D1 : D0;  // D0/D1 missing
end`,
        },
        {
          id: "star",
          label: "@(*)",
          kind: "combo-ok",
          reason: "Automatic list covers S, D0, and D1.",
          sens: [
            { name: "S", edge: "any" },
            { name: "D0", edge: "any" },
            { name: "D1", edge: "any" },
          ],
          code: `always @(*) begin
  Y = S ? D1 : D0;
end`,
        },
      ],
    },
    {
      id: "dff",
      title: "D flip-flop",
      intent: "Q samples D on rising clk",
      signals: ["clk", "D"],
      outputs: ["Q"],
      eval(sig, outs) {
        // eval only applied when sensitivity matches; for edge FF, caller sets Q=D on run
        return { Q: sig.D };
      },
      styles: [
        {
          id: "posedge",
          label: "@(posedge clk)",
          kind: "seq",
          reason: "Only clk 0→1 runs the block. D changes alone do not update Q.",
          sens: [{ name: "clk", edge: "posedge" }],
          code: `always @(posedge clk) begin
  Q <= D;
end`,
        },
        {
          id: "level-clk",
          label: "@(clk) level",
          kind: "combo-bad",
          reason: "Level-sensitive to clk (both edges) — not a standard FF; odd for synth.",
          sens: [{ name: "clk", edge: "any" }],
          code: `always @(clk) begin
  Q = D;  // both edges of clk — not a posedge FF
end`,
        },
        {
          id: "clk-or-d",
          label: "@(clk or D)",
          kind: "combo-bad",
          reason: "Including D makes Q track D asynchronously whenever D toggles — latch-like / wrong FF.",
          sens: [
            { name: "clk", edge: "any" },
            { name: "D", edge: "any" },
          ],
          code: `always @(clk or D) begin
  Q = D;  // D in list → not edge-only register
end`,
        },
      ],
    },
    {
      id: "async-rst",
      title: "FF + async reset",
      intent: "Q=0 when rst_n falls; else sample on posedge clk",
      signals: ["clk", "rst_n", "D"],
      outputs: ["Q"],
      eval(sig) {
        if (!sig.rst_n) return { Q: 0 };
        return { Q: sig.D };
      },
      styles: [
        {
          id: "async",
          label: "posedge clk or negedge rst_n",
          kind: "seq",
          reason: "Classic async-reset FF sensitivity: wake on rising clk or falling rst_n.",
          sens: [
            { name: "clk", edge: "posedge" },
            { name: "rst_n", edge: "negedge" },
          ],
          code: `always @(posedge clk or negedge rst_n) begin
  if (!rst_n) Q <= 1'b0;
  else        Q <= D;
end`,
          // Special: on posedge clk with rst_n=1 sample D; on negedge rst_n clear
          evalOnRun(sig, prev, name, from, to) {
            if (name === "rst_n" && from === 1 && to === 0) return { Q: 0 };
            if (name === "clk" && from === 0 && to === 1) {
              return { Q: sig.rst_n ? sig.D : 0 };
            }
            return null;
          },
        },
        {
          id: "clk-only",
          label: "@(posedge clk) only",
          kind: "seq",
          reason: "Sync-only reset: rst_n is sampled with D on the clock edge — no async clear.",
          sens: [{ name: "clk", edge: "posedge" }],
          code: `always @(posedge clk) begin
  if (!rst_n) Q <= 1'b0;
  else        Q <= D;
end`,
          evalOnRun(sig) {
            return { Q: sig.rst_n ? sig.D : 0 };
          },
        },
        {
          id: "missing-rst",
          label: "async intent, clk only",
          kind: "combo-bad",
          reason: "Code checks rst_n but list omits it — async reset never wakes the block.",
          sens: [{ name: "clk", edge: "posedge" }],
          code: `// intended async reset, but sensitivity forgot rst_n
always @(posedge clk) begin
  if (!rst_n) Q <= 1'b0;
  else        Q <= D;
end`,
          evalOnRun(sig) {
            return { Q: sig.rst_n ? sig.D : 0 };
          },
        },
      ],
    },
  ];

  function defaultSignals(sc) {
    const sig = {};
    sc.signals.forEach((n) => {
      if (n === "rst_n") sig[n] = 1;
      else if (n === "clk") sig[n] = 0;
      else sig[n] = 0;
    });
    return sig;
  }

  function matchesSens(entry, name, from, to) {
    if (entry.name !== name) return false;
    if (entry.edge === "any") return from !== to;
    if (entry.edge === "posedge") return from === 0 && to === 1;
    if (entry.edge === "negedge") return from === 1 && to === 0;
    return false;
  }

  function sensLabel(entry) {
    if (entry.edge === "posedge") return `posedge ${entry.name}`;
    if (entry.edge === "negedge") return `negedge ${entry.name}`;
    return entry.name;
  }

  function kindVerdict(kind) {
    if (kind === "combo-ok") return { cls: "ok", text: "Complete combo sensitivity" };
    if (kind === "combo-bad") return { cls: "warn", text: "Incomplete / misleading list" };
    return { cls: "seq", text: "Edge / sequential sensitivity" };
  }

  const CHALLENGES = [
    {
      id: "quiz-what-sens",
      title: "Quiz: sensitivity",
      type: "quiz",
      prompt: "The sensitivity list of an always block names…",
      hint: "What wakes the process.",
      choices: [
        "which signal events re-run the block",
        "only the outputs the block drives",
        "the module’s port list",
        "synthesis timing constraints",
      ],
      answer: "which signal events re-run the block",
    },
    {
      id: "quiz-star",
      title: "Quiz: @(*)",
      type: "quiz",
      prompt: "@(*) / always_comb is meant to…",
      hint: "Auto list.",
      choices: [
        "include every signal read in the block",
        "create a flip-flop",
        "ignore all inputs",
        "run only on posedge clk",
      ],
      answer: "include every signal read in the block",
    },
    {
      id: "quiz-incomplete",
      title: "Quiz: incomplete",
      type: "quiz",
      prompt: "always @(A) Y = A & B; when only B flips…",
      hint: "B not listed.",
      choices: [
        "the block usually does not run — Y can stay stale",
        "Y always updates correctly",
        "a posedge flop is inferred",
        "simulation stops",
      ],
      answer: "the block usually does not run — Y can stay stale",
    },
    {
      id: "quiz-posedge",
      title: "Quiz: posedge",
      type: "quiz",
      prompt: "always @(posedge clk) Q <= D; a change of D alone…",
      hint: "Edge only.",
      choices: [
        "does not update Q until the next rising clk",
        "updates Q immediately",
        "clears Q",
        "is illegal in Verilog",
      ],
      answer: "does not update Q until the next rising clk",
    },
    {
      id: "quiz-async",
      title: "Quiz: async reset",
      type: "quiz",
      prompt: "A typical async-reset FF sensitivity is…",
      hint: "clk rise or rst fall.",
      choices: [
        "posedge clk or negedge rst_n",
        "posedge clk only (never list rst)",
        "@(*) with clk inside",
        "negedge D or posedge Q",
      ],
      answer: "posedge clk or negedge rst_n",
    },
    {
      id: "quiz-level-clk",
      title: "Quiz: @(clk)",
      type: "quiz",
      prompt: "always @(clk) (level) vs @(posedge clk)…",
      hint: "Both edges vs rising.",
      choices: [
        "level wakes on both edges; posedge only on 0→1",
        "they are identical",
        "level ignores clk",
        "posedge runs every delta of D",
      ],
      answer: "level wakes on both edges; posedge only on 0→1",
    },
    {
      id: "quiz-always-comb",
      title: "Quiz: always_comb",
      type: "quiz",
      prompt: "Prefer always_comb over handwritten @(A or B) because…",
      hint: "Missed names.",
      choices: [
        "it auto-builds a complete list and tools can check it",
        "it forces a clock",
        "it bans blocking assigns",
        "it only works for flops",
      ],
      answer: "it auto-builds a complete list and tools can check it",
    },
    {
      id: "quiz-synth-sim",
      title: "Quiz: sim vs synth",
      type: "quiz",
      prompt: "Incomplete combo sensitivity is dangerous mainly because…",
      hint: "Gate-level vs RTL.",
      choices: [
        "RTL sim can disagree with what synth builds (gates always “sensitive”)",
        "it always fails elaboration",
        "it inserts PLLs",
        "it only affects $display",
      ],
      answer: "RTL sim can disagree with what synth builds (gates always “sensitive”)",
    },
    {
      id: "pick-and-bad",
      title: "Pick: AND incomplete",
      type: "pick-style",
      prompt: "Combo AND — which style is incomplete?",
      hint: "@(A) incomplete.",
      scenario: "and2",
      answerStyle: "a-only",
    },
    {
      id: "pick-and-star",
      title: "Pick: AND @(*)",
      type: "pick-style",
      prompt: "Combo AND — pick the @(*) style.",
      hint: "Automatic.",
      scenario: "and2",
      answerStyle: "star",
    },
    {
      id: "pick-mux-bad",
      title: "Pick: mux incomplete",
      type: "pick-style",
      prompt: "2:1 mux — which list is incomplete?",
      hint: "@(S) only.",
      scenario: "mux21",
      answerStyle: "s-only",
    },
    {
      id: "pick-ff",
      title: "Pick: true FF",
      type: "pick-style",
      prompt: "D flip-flop — which is the standard edge FF?",
      hint: "posedge clk.",
      scenario: "dff",
      answerStyle: "posedge",
    },
    {
      id: "pick-async",
      title: "Pick: async list",
      type: "pick-style",
      prompt: "FF + async reset — pick the classic async sensitivity.",
      hint: "posedge clk or negedge rst_n.",
      scenario: "async-rst",
      answerStyle: "async",
    },
    {
      id: "run-and-stale",
      title: "See: stale B",
      type: "run",
      prompt: "Combo AND · @(A) incomplete. Set A=1,B=0 so Y=0, then toggle B→1 without changing A — Y must stay 0 (stale).",
      hint: "Load setup, then poke B only.",
      scenario: "and2",
      style: "a-only",
      setup(state) {
        state.signals = { A: 1, B: 0 };
        state.outputs = { Y: 1 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "and2" &&
        s.styleId === "a-only" &&
        s.signals.A === 1 &&
        s.signals.B === 1 &&
        s.outputs.Y === 0,
    },
    {
      id: "run-and-fix",
      title: "See: @(*) tracks B",
      type: "run",
      prompt: "Same values on Combo AND · @(*) — after A=1 and B→1, Y must be 1.",
      hint: "Switch to @(*) then poke.",
      scenario: "and2",
      style: "star",
      setup(state) {
        state.signals = { A: 1, B: 0 };
        state.outputs = { Y: 0 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "and2" &&
        s.styleId === "star" &&
        s.signals.A === 1 &&
        s.signals.B === 1 &&
        s.outputs.Y === 1,
    },
    {
      id: "run-mux-data",
      title: "See: mux data miss",
      type: "run",
      prompt: "Mux · @(S) incomplete. S=0,D0=0,D1=1 → Y=0. Flip D0→1 (S stays 0) — Y must remain 0.",
      hint: "Only D0 changes.",
      scenario: "mux21",
      style: "s-only",
      setup(state) {
        state.signals = { S: 0, D0: 0, D1: 1 };
        state.outputs = { Y: 0 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "mux21" &&
        s.styleId === "s-only" &&
        s.signals.S === 0 &&
        s.signals.D0 === 1 &&
        s.outputs.Y === 0,
    },
    {
      id: "run-ff-d",
      title: "See: D ignored",
      type: "run",
      prompt: "D-FF · @(posedge clk). With clk=0, set D=1 — Q must stay 0 until a rising edge.",
      hint: "Do not pulse clk yet.",
      scenario: "dff",
      style: "posedge",
      setup(state) {
        state.signals = { clk: 0, D: 0 };
        state.outputs = { Q: 0 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "dff" &&
        s.styleId === "posedge" &&
        s.signals.clk === 0 &&
        s.signals.D === 1 &&
        s.outputs.Q === 0,
    },
    {
      id: "run-ff-edge",
      title: "See: sample on rise",
      type: "run",
      prompt: "D-FF · @(posedge clk). D=1, then pulse clk 0→1 so Q becomes 1.",
      hint: "Use the clk button twice or Toggle until rise samples.",
      scenario: "dff",
      style: "posedge",
      setup(state) {
        state.signals = { clk: 0, D: 1 };
        state.outputs = { Q: 0 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "dff" &&
        s.styleId === "posedge" &&
        s.signals.D === 1 &&
        s.outputs.Q === 1,
    },
    {
      id: "run-async-clear",
      title: "See: async clear",
      type: "run",
      prompt: "Async FF style. With Q=1, drive rst_n 1→0 — Q must clear to 0 without needing clk.",
      hint: "Load setup (Q already 1), then toggle rst_n off.",
      scenario: "async-rst",
      style: "async",
      setup(state) {
        state.signals = { clk: 0, rst_n: 1, D: 1 };
        state.outputs = { Q: 1 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "async-rst" &&
        s.styleId === "async" &&
        s.signals.rst_n === 0 &&
        s.outputs.Q === 0,
    },
    {
      id: "run-sync-rst-miss",
      title: "See: forgotten async",
      type: "run",
      prompt: "“async intent, clk only”: Q=1, drop rst_n→0 — Q must stay 1 (reset did not wake the block).",
      hint: "Missing rst_n in the list.",
      scenario: "async-rst",
      style: "missing-rst",
      setup(state) {
        state.signals = { clk: 0, rst_n: 1, D: 1 };
        state.outputs = { Q: 1 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "async-rst" &&
        s.styleId === "missing-rst" &&
        s.signals.rst_n === 0 &&
        s.outputs.Q === 1,
    },
    {
      id: "run-mux-full",
      title: "See: mux tracks D0",
      type: "run",
      prompt: "Mux · full @(S or D0 or D1). S=0, flip D0→1 — Y must become 1.",
      hint: "Complete list.",
      scenario: "mux21",
      style: "full",
      setup(state) {
        state.signals = { S: 0, D0: 0, D1: 1 };
        state.outputs = { Y: 0 };
        state.stale = false;
        state.log = [];
      },
      check: (s) =>
        s.scenarioId === "mux21" &&
        s.styleId === "full" &&
        s.signals.D0 === 1 &&
        s.outputs.Y === 1,
    },
    {
      id: "quiz-or-vs-comma",
      title: "Quiz: or vs ,",
      type: "quiz",
      prompt: "In Verilog-2001, @(A or B) and @(A, B)…",
      hint: "Same meaning.",
      choices: [
        "mean the same level-sensitive list",
        "one is edge-only",
        "comma is illegal",
        "or forces a latch",
      ],
      answer: "mean the same level-sensitive list",
    },
  ];

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const state = {
    scenarioId: "and2",
    styleId: "or-list",
    signals: { A: 1, B: 1 },
    outputs: { Y: 1 },
    stale: false,
    log: [],
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
    pickStyle: "",
  };

  function scenario() {
    return SCENARIOS.find((s) => s.id === state.scenarioId) || SCENARIOS[0];
  }

  function styleMeta() {
    const sc = scenario();
    return sc.styles.find((s) => s.id === state.styleId) || sc.styles[0];
  }

  function recomputeFresh() {
    const sc = scenario();
    const next = sc.eval(state.signals, state.outputs);
    Object.assign(state.outputs, next);
    state.stale = false;
  }

  function pushLog(cls, msg) {
    state.log.unshift({ cls, msg, t: Date.now() });
    if (state.log.length > 40) state.log.length = 40;
  }

  function poke(name) {
    const sc = scenario();
    const style = styleMeta();
    if (!sc.signals.includes(name)) return;
    const from = state.signals[name];
    const to = from ? 0 : 1;
    state.signals[name] = to;

    const hit = style.sens.some((e) => matchesSens(e, name, from, to));
    if (hit) {
      let next;
      if (style.evalOnRun) {
        next = style.evalOnRun(state.signals, state.outputs, name, from, to);
        if (next == null) next = sc.eval(state.signals, state.outputs);
      } else {
        next = sc.eval(state.signals, state.outputs);
      }
      Object.assign(state.outputs, next);
      state.stale = false;
      pushLog("run", `${name}: ${from}→${to} · block RAN · ${fmtOuts(next)}`);
    } else {
      const expected = sc.eval(state.signals, state.outputs);
      const outName = sc.outputs[0];
      const isStale = state.outputs[outName] !== expected[outName];
      state.stale = isStale;
      pushLog(
        "skip",
        `${name}: ${from}→${to} · block SKIPPED (not in list)${isStale ? " · Y/Q STALE" : ""}`
      );
    }
    saveSession();
    renderAll();
  }

  function fmtOuts(o) {
    return Object.keys(o)
      .map((k) => `${k}=${o[k]}`)
      .join(" ");
  }

  function pulseClk() {
    if (!scenario().signals.includes("clk")) return;
    if (state.signals.clk === 1) poke("clk");
    poke("clk");
  }

  function loadStarter() {
    state.scenarioId = "and2";
    state.styleId = "or-list";
    state.signals = { A: 1, B: 1 };
    state.outputs = { Y: 1 };
    state.stale = false;
    state.log = [
      { cls: "note", msg: "Starter: Y = A & B with always @(A or B). Toggle A or B — both wake the block." },
    ];
  }

  function applyStyleChange() {
    const sc = scenario();
    if (!sc.styles.some((s) => s.id === state.styleId)) state.styleId = sc.styles[0].id;
    // Keep signal names; fill missing defaults
    const next = defaultSignals(sc);
    sc.signals.forEach((n) => {
      if (state.signals[n] !== undefined) next[n] = state.signals[n];
    });
    state.signals = next;
    recomputeFresh();
    pushLog("note", `Style → ${styleMeta().label}`);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scenarioId: state.scenarioId,
          styleId: state.styleId,
          signals: state.signals,
          outputs: state.outputs,
          stale: state.stale,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!SCENARIOS.some((s) => s.id === d.scenarioId)) return false;
      state.scenarioId = d.scenarioId;
      state.styleId = d.styleId;
      const sc = scenario();
      if (!sc.styles.some((s) => s.id === state.styleId)) state.styleId = sc.styles[0].id;
      state.signals = { ...defaultSignals(sc), ...(d.signals || {}) };
      state.outputs = d.outputs || sc.eval(state.signals);
      state.stale = !!d.stale;
      state.log = [{ cls: "note", msg: "Session restored. Toggle signals to continue." }];
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("sl-root");
  root.innerHTML = `
    <p class="starter-note" id="starter-note"></p>
    <div class="challenge">
      <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div id="chal-quiz" class="quiz-choices" hidden></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <button type="button" class="btn btn-ghost" id="chal-load">Load challenge setup</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>Sensitivity explorer</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-clear-log">Clear log</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="sl-controls">
          <div class="sl-field">
            <label for="sc-sel">Function</label>
            <select id="sc-sel"></select>
          </div>
        </div>
        <p class="sl-meta" id="intent"></p>
        <div class="style-tabs" id="style-tabs"></div>
        <div id="verdict"></div>
        <div class="sens-chips" id="sens-chips"></div>
        <pre class="code-block" id="code"></pre>
        <p class="sl-meta" id="reason"></p>
        <p class="sl-meta" style="margin-top:0.85rem;font-weight:600;color:var(--ink)">Poke signals</p>
        <div class="signal-row" id="signals"></div>
        <div class="out-row" id="outputs"></div>
        <p class="sl-meta" style="font-weight:600;color:var(--ink)">Event log</p>
        <ul class="event-log" id="event-log" aria-live="polite"></ul>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const sc = scenario();
    const style = styleMeta();
    const v = kindVerdict(style.kind);

    document.getElementById("starter-note").textContent =
      "Starter example: Y = A & B with always @(A or B). Switch to “@(A) incomplete”, then flip only B to see a stale output.";
    document.getElementById("intent").textContent = `Intent: ${sc.intent}`;

    const sel = document.getElementById("sc-sel");
    sel.innerHTML = SCENARIOS.map((s) => `<option value="${s.id}">${s.title}</option>`).join("");
    sel.value = state.scenarioId;

    const tabs = document.getElementById("style-tabs");
    tabs.innerHTML = "";
    sc.styles.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      if (s.id === state.styleId) b.classList.add("active");
      b.addEventListener("click", () => {
        state.styleId = s.id;
        applyStyleChange();
        saveSession();
        renderAll();
      });
      tabs.appendChild(b);
    });

    document.getElementById("verdict").innerHTML = `<div class="verdict ${v.cls}">${v.text}</div>`;
    document.getElementById("sens-chips").innerHTML = style.sens
      .map((e) => `<span class="${e.edge !== "any" ? "edge" : ""}">${sensLabel(e)}</span>`)
      .join("");
    document.getElementById("code").textContent = style.code;
    document.getElementById("reason").textContent = style.reason;

    const sigRow = document.getElementById("signals");
    sigRow.innerHTML = "";
    sc.signals.forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      const val = state.signals[n];
      b.textContent = `${n}=${val}`;
      if (val) b.classList.add("on");
      b.addEventListener("click", () => poke(n));
      sigRow.appendChild(b);
    });
    if (sc.signals.includes("clk")) {
      const p = document.createElement("button");
      p.type = "button";
      p.className = "clk-pulse";
      p.textContent = "posedge clk";
      p.title = "Drive clk 0→1 (falls first if needed)";
      p.addEventListener("click", pulseClk);
      sigRow.appendChild(p);
    }

    const outEl = document.getElementById("outputs");
    outEl.innerHTML = sc.outputs
      .map((n) => {
        const val = state.outputs[n];
        return `<span><span class="y-val">${n}=${val}</span>${
          state.stale ? ' <span class="stale">stale vs RHS</span>' : ""
        }</span>`;
      })
      .join("");

    const log = document.getElementById("event-log");
    log.innerHTML = state.log.map((e) => `<li class="${e.cls}">${e.msg}</li>`).join("") ||
      `<li class="note">No events yet — poke a signal.</li>`;
  }

  function renderChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (state.showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = state.showHint ? "Hide hint" : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    if (ch.type === "quiz") {
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="sl-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.quizChoice = inp.value;
        });
      });
    } else if (ch.type === "pick-style") {
      const sc = SCENARIOS.find((s) => s.id === ch.scenario);
      quiz.hidden = false;
      quiz.innerHTML = sc.styles
        .map(
          (s) =>
            `<label><input type="radio" name="sl-pick" value="${s.id}" ${
              state.pickStyle === s.id ? "checked" : ""
            }> ${s.label}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.pickStyle = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === state.challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        state.challengeIdx = i;
        state.showHint = false;
        state.quizChoice = "";
        state.pickStyle = "";
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function loadChallengeSetup() {
    const ch = CHALLENGES[state.challengeIdx];
    if (ch.scenario) {
      state.scenarioId = ch.scenario;
      if (ch.style) state.styleId = ch.style;
      else state.styleId = scenario().styles[0].id;
      if (ch.setup) ch.setup(state);
      else {
        state.signals = defaultSignals(scenario());
        recomputeFresh();
        state.log = [];
      }
      saveSession();
      renderAll();
      setChalStatus("idle", "Setup loaded");
    } else setChalStatus("idle", "Quiz — pick an answer");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else if (ch.type === "pick-style") ok = state.pickStyle === ch.answerStyle;
    else ok = !!ch.check(state);
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

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("sc-sel").addEventListener("change", (e) => {
    state.scenarioId = e.target.value;
    state.styleId = scenario().styles[0].id;
    state.signals = defaultSignals(scenario());
    recomputeFresh();
    state.log = [{ cls: "note", msg: `Function → ${scenario().title}` }];
    saveSession();
    renderAll();
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-clear-log").addEventListener("click", () => {
    state.log = [];
    renderLab();
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.quizChoice = "";
    state.pickStyle = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeSetup);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
