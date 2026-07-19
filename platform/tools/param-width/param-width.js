(() => {
  const STORAGE_KEY = "ddv-param-width-v1";
  const CLEARED_KEY = "ddv-param-width-cleared-v1";

  /** IEEE-style $clog2 for positive integers (SV: $clog2(1)=0, $clog2(2)=1, …). */
  function clog2(n) {
    const v = Math.max(0, n | 0);
    if (v <= 1) return 0;
    return Math.ceil(Math.log2(v));
  }

  function range(msb, lsb) {
    return `[${msb}:${lsb}]`;
  }

  function widthRange(w) {
    const width = Math.max(1, w | 0);
    return { width, msb: width - 1, lsb: 0, decl: range(width - 1, 0) };
  }

  const TEMPLATES = {
    regfile: {
      id: "regfile",
      label: "Parameterized bus",
      params: [
        { key: "WIDTH", label: "WIDTH", min: 1, max: 64, def: 8 },
      ],
      derive(p) {
        const data = widthRange(p.WIDTH);
        return {
          chips: [
            { name: "data_in/out", text: `logic ${data.decl} data` },
            { name: "WIDTH", text: `WIDTH = ${p.WIDTH}` },
            { name: "MSB", text: `MSB index = ${data.msb}` },
          ],
          module: `module bus_slice #(
  parameter int WIDTH = ${p.WIDTH}
) (
  input  logic ${data.decl} data_in,
  output logic ${data.decl} data_out
);
  assign data_out = data_in;
endmodule`,
          inst: `bus_slice #(.WIDTH(${p.WIDTH})) u_bus (
  .data_in (data_in),
  .data_out(data_out)
);`,
          notes: `Port width is WIDTH bits → ${data.decl}. Changing #(.WIDTH(N)) resizes both ports together.`,
        };
      },
    },
    mem: {
      id: "mem",
      label: "Memory (DEPTH → ADDR_W)",
      params: [
        { key: "DATA_W", label: "DATA_W", min: 1, max: 64, def: 8 },
        { key: "DEPTH", label: "DEPTH", min: 1, max: 1024, def: 16 },
      ],
      derive(p) {
        const data = widthRange(p.DATA_W);
        const addrW = Math.max(1, clog2(p.DEPTH)); // teaching: at least 1 bit if depth≥2; depth 1 → clog2=0 use [0:0]? 
        // SV: if ADDR_W = $clog2(DEPTH) and DEPTH=1, ADDR_W=0 which is awkward; show raw clog2 and a practical addr width.
        const clog = clog2(p.DEPTH);
        const addrBits = Math.max(1, clog);
        const addr = widthRange(addrBits);
        return {
          chips: [
            { name: "data", text: `logic ${data.decl} data` },
            { name: "$clog2", text: `$clog2(${p.DEPTH}) = ${clog}` },
            { name: "addr", text: `addr ${addr.decl} (${addrBits} bits)` },
            { name: "words", text: `${p.DEPTH} words` },
          ],
          module: `module simple_mem #(
  parameter int DATA_W = ${p.DATA_W},
  parameter int DEPTH  = ${p.DEPTH},
  parameter int ADDR_W = ${clog === 0 ? 1 : clog}  // max($clog2(DEPTH),1) here
) (
  input  logic ${addr.decl} addr,
  input  logic ${data.decl} wdata,
  output logic ${data.decl} rdata
);
  logic ${data.decl} mem [0:DEPTH-1];
  assign rdata = mem[addr];
endmodule`,
          inst: `simple_mem #(
  .DATA_W(${p.DATA_W}),
  .DEPTH (${p.DEPTH})
) u_mem (
  .addr (addr),
  .wdata(wdata),
  .rdata(rdata)
);`,
          notes: `ADDR_W tracks $clog2(DEPTH)=${clog}. Lab uses ${addrBits} address bit(s) so ports stay legal when DEPTH=1.`,
        };
      },
    },
    adder: {
      id: "adder",
      label: "Adder (sum WIDTH+1)",
      params: [
        { key: "WIDTH", label: "WIDTH", min: 1, max: 32, def: 4 },
      ],
      derive(p) {
        const a = widthRange(p.WIDTH);
        const sum = widthRange(p.WIDTH + 1);
        return {
          chips: [
            { name: "a/b", text: `logic ${a.decl} a, b` },
            { name: "sum", text: `logic ${sum.decl} sum` },
            { name: "grow", text: `sum width = WIDTH+1 = ${p.WIDTH + 1}` },
          ],
          module: `module add_wide #(
  parameter int WIDTH = ${p.WIDTH}
) (
  input  logic ${a.decl} a,
  input  logic ${a.decl} b,
  output logic ${sum.decl} sum
);
  assign sum = {1'b0, a} + {1'b0, b};
endmodule`,
          inst: `add_wide #(.WIDTH(${p.WIDTH})) u_add (
  .a  (a),
  .b  (b),
  .sum(sum)
);`,
          notes: `Operands are WIDTH bits; sum keeps a carry → WIDTH+1 bits (${sum.decl}).`,
        };
      },
    },
    fifo: {
      id: "fifo",
      label: "FIFO pointers",
      params: [
        { key: "DATA_W", label: "DATA_W", min: 1, max: 64, def: 8 },
        { key: "DEPTH", label: "DEPTH", min: 2, max: 256, def: 8 },
      ],
      derive(p) {
        const data = widthRange(p.DATA_W);
        const ptrW = clog2(p.DEPTH) + 1; // extra bit for full/empty
        const ptr = widthRange(ptrW);
        const addrW = Math.max(1, clog2(p.DEPTH));
        const addr = widthRange(addrW);
        return {
          chips: [
            { name: "data", text: `logic ${data.decl} data` },
            { name: "ptr", text: `wr/rd ptr ${ptr.decl}` },
            { name: "index", text: `mem index ${addr.decl}` },
            { name: "clog2", text: `$clog2(DEPTH)=${clog2(p.DEPTH)}` },
          ],
          module: `module fifo_ptrs #(
  parameter int DATA_W = ${p.DATA_W},
  parameter int DEPTH  = ${p.DEPTH},
  parameter int ADDR_W = ${addrW},
  parameter int PTR_W  = ${ptrW}
) (
  input  logic ${data.decl} wdata,
  output logic ${data.decl} rdata,
  output logic ${ptr.decl}  wr_ptr,
  output logic ${ptr.decl}  rd_ptr
);
  // mem[ADDR_W] indexed by ptr[ADDR_W-1:0]
endmodule`,
          inst: `fifo_ptrs #(
  .DATA_W(${p.DATA_W}),
  .DEPTH (${p.DEPTH})
) u_fifo ( /* ports */ );`,
          notes: `Pointer width often $clog2(DEPTH)+1 (=${ptrW}) to encode full/empty; memory index uses ${addrW} bits.`,
        };
      },
    },
  };

  const CHALLENGES = [
    {
      id: "quiz-hash",
      title: "Quiz: #(.WIDTH)",
      type: "quiz",
      prompt: "In bus_slice #(.WIDTH(16)), the override…",
      hint: "Parameter port.",
      choices: [
        "sets the module’s WIDTH parameter to 16 for that instance",
        "only renames the module",
        "forces DEPTH=16",
        "is ignored unless localparam",
      ],
      answer: "sets the module’s WIDTH parameter to 16 for that instance",
    },
    {
      id: "quiz-range",
      title: "Quiz: [WIDTH-1:0]",
      type: "quiz",
      prompt: "For WIDTH=8, logic [WIDTH-1:0] is…",
      hint: "7 down to 0.",
      choices: ["[7:0]", "[8:0]", "[8:1]", "[0:7] only"],
      answer: "[7:0]",
    },
    {
      id: "quiz-clog2-16",
      title: "Quiz: $clog2(16)",
      type: "quiz",
      prompt: "$clog2(16) equals…",
      hint: "2^4=16.",
      choices: ["4", "5", "16", "3"],
      answer: "4",
    },
    {
      id: "quiz-clog2-3",
      title: "Quiz: $clog2(3)",
      type: "quiz",
      prompt: "$clog2(3) equals…",
      hint: "ceil(log2(3)).",
      choices: ["2", "1", "3", "0"],
      answer: "2",
    },
    {
      id: "quiz-clog2-1",
      title: "Quiz: $clog2(1)",
      type: "quiz",
      prompt: "$clog2(1) equals…",
      hint: "Special case in SV.",
      choices: ["0", "1", "2", "undefined as 8"],
      answer: "0",
    },
    {
      id: "quiz-sum",
      title: "Quiz: sum width",
      type: "quiz",
      prompt: "Adding two WIDTH-bit numbers with carry kept needs about…",
      hint: "WIDTH+1.",
      choices: ["WIDTH+1 bits", "WIDTH bits", "2×WIDTH bits", "1 bit"],
      answer: "WIDTH+1 bits",
    },
    {
      id: "quiz-localparam",
      title: "Quiz: localparam",
      type: "quiz",
      prompt: "A localparam ADDR_W = $clog2(DEPTH) is usually…",
      hint: "Derived, not overridden.",
      choices: [
        "derived inside the module (not meant for #() override)",
        "required on every port",
        "the same as a wire",
        "only legal in testbenches",
      ],
      answer: "derived inside the module (not meant for #() override)",
    },
    {
      id: "quiz-override",
      title: "Quiz: default vs override",
      type: "quiz",
      prompt: "parameter int WIDTH = 8 is the…",
      hint: "Default value.",
      choices: ["default if the instance omits #(.WIDTH(...))", "hard-coded forever", "runtime variable", "timescale"],
      answer: "default if the instance omits #(.WIDTH(...))",
    },
    {
      id: "run-width8",
      title: "Set WIDTH=8",
      type: "run",
      prompt: "Parameterized bus: set WIDTH=8 so data is [7:0].",
      hint: "Template Parameterized bus.",
      template: "regfile",
      check: (p, d) => state.templateId === "regfile" && p.WIDTH === 8 && d.chips.some((c) => /\[7:0\]/.test(c.text)),
    },
    {
      id: "run-width16",
      title: "Set WIDTH=16",
      type: "run",
      prompt: "Parameterized bus: WIDTH=16 → [15:0].",
      hint: "Slide WIDTH to 16.",
      template: "regfile",
      check: (p) => state.templateId === "regfile" && p.WIDTH === 16,
    },
    {
      id: "run-width4",
      title: "Set WIDTH=4",
      type: "run",
      prompt: "Parameterized bus: WIDTH=4 → [3:0].",
      hint: "WIDTH=4.",
      template: "regfile",
      check: (p) => state.templateId === "regfile" && p.WIDTH === 4,
    },
    {
      id: "run-mem16",
      title: "Mem DEPTH=16",
      type: "run",
      prompt: "Memory template: DEPTH=16 so $clog2(DEPTH)=4.",
      hint: "Memory (DEPTH → ADDR_W).",
      template: "mem",
      check: (p) => state.templateId === "mem" && p.DEPTH === 16 && clog2(p.DEPTH) === 4,
    },
    {
      id: "run-mem32",
      title: "Mem DEPTH=32",
      type: "run",
      prompt: "DEPTH=32 → $clog2=5.",
      hint: "DEPTH=32.",
      template: "mem",
      check: (p) => state.templateId === "mem" && p.DEPTH === 32 && clog2(32) === 5,
    },
    {
      id: "run-data32",
      title: "DATA_W=32",
      type: "run",
      prompt: "Memory: DATA_W=32 (data [31:0]).",
      hint: "DATA_W control.",
      template: "mem",
      check: (p) => state.templateId === "mem" && p.DATA_W === 32,
    },
    {
      id: "run-adder8",
      title: "Adder WIDTH=8",
      type: "run",
      prompt: "Adder template: WIDTH=8 → sum is 9 bits.",
      hint: "sum width WIDTH+1.",
      template: "adder",
      check: (p, d) => state.templateId === "adder" && p.WIDTH === 8 && d.chips.some((c) => /9/.test(c.text)),
    },
    {
      id: "run-adder4",
      title: "Adder WIDTH=4",
      type: "run",
      prompt: "Adder WIDTH=4 → sum [4:0].",
      hint: "Starter-like width.",
      template: "adder",
      check: (p) => state.templateId === "adder" && p.WIDTH === 4,
    },
    {
      id: "run-fifo8",
      title: "FIFO DEPTH=8",
      type: "run",
      prompt: "FIFO pointers: DEPTH=8 → $clog2=3, PTR_W=4.",
      hint: "PTR_W = clog2+1.",
      template: "fifo",
      check: (p) => state.templateId === "fifo" && p.DEPTH === 8 && clog2(8) + 1 === 4,
    },
    {
      id: "run-fifo16",
      title: "FIFO DEPTH=16",
      type: "run",
      prompt: "FIFO DEPTH=16 → ptr width 5.",
      hint: "clog2(16)+1=5.",
      template: "fifo",
      check: (p) => state.templateId === "fifo" && p.DEPTH === 16 && clog2(16) + 1 === 5,
    },
    {
      id: "quiz-inst",
      title: "Quiz: named override",
      type: "quiz",
      prompt: "#(.WIDTH(4), .DEPTH(16)) uses…",
      hint: "By name.",
      choices: ["named parameter association", "positional only forever", "force define", "DPI"],
      answer: "named parameter association",
    },
    {
      id: "quiz-both-ports",
      title: "Quiz: shared WIDTH",
      type: "quiz",
      prompt: "Parameterizing both data_in and data_out with WIDTH keeps them…",
      hint: "Matched.",
      choices: ["the same width by construction", "independent forever", "1-bit only", "packed structs only"],
      answer: "the same width by construction",
    },
    {
      id: "quiz-depth-addr",
      title: "Quiz: DEPTH vs addr",
      type: "quiz",
      prompt: "Deeper memory (larger DEPTH) generally needs…",
      hint: "More address bits.",
      choices: ["a wider address (larger $clog2(DEPTH))", "narrower data always", "no parameters", "only localparam strings"],
      answer: "a wider address (larger $clog2(DEPTH))",
    },
    {
      id: "run-width1",
      title: "WIDTH=1 edge",
      type: "run",
      prompt: "Parameterized bus: WIDTH=1 → [0:0].",
      hint: "Smallest bus.",
      template: "regfile",
      check: (p, d) => state.templateId === "regfile" && p.WIDTH === 1 && d.chips.some((c) => /\[0:0\]/.test(c.text)),
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
    templateId: "regfile",
    params: { WIDTH: 8, DATA_W: 8, DEPTH: 16 },
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.templateId = "regfile";
    state.params = { WIDTH: 8, DATA_W: 8, DEPTH: 16 };
  }

  function currentTemplate() {
    return TEMPLATES[state.templateId] || TEMPLATES.regfile;
  }

  function paramBag() {
    const t = currentTemplate();
    const p = {};
    t.params.forEach((def) => {
      let v = state.params[def.key];
      if (v == null) v = def.def;
      v = Math.min(def.max, Math.max(def.min, Number(v) || def.def));
      p[def.key] = v;
    });
    return p;
  }

  function derived() {
    return currentTemplate().derive(paramBag());
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ templateId: state.templateId, params: state.params })
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
      if (!TEMPLATES[d.templateId]) return false;
      state.templateId = d.templateId;
      state.params = { ...state.params, ...(d.params || {}) };
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("pw-root");
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
        <h2>Explorer</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="pw-controls">
          <div class="pw-field">
            <label for="tpl-sel">Template</label>
            <select id="tpl-sel"></select>
          </div>
          <div id="param-fields" class="pw-controls" style="margin:0"></div>
        </div>
        <div class="param-stage">
          <div class="bus-strip" id="chips"></div>
          <p class="pw-meta" id="notes"></p>
        </div>
        <div class="split-code">
          <div>
            <h3>Module</h3>
            <pre class="code-block" id="mod-code"></pre>
          </div>
          <div>
            <h3>Instance</h3>
            <pre class="code-block" id="inst-code"></pre>
          </div>
        </div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const t = currentTemplate();
    const p = paramBag();
    const d = t.derive(p);

    document.getElementById("starter-note").textContent =
      "Starter example: parameterized bus with WIDTH=8 → logic [7:0] data_in/out and #(.WIDTH(8)).";

    const sel = document.getElementById("tpl-sel");
    sel.innerHTML = Object.values(TEMPLATES)
      .map((x) => `<option value="${x.id}">${x.label}</option>`)
      .join("");
    sel.value = state.templateId;

    const fields = document.getElementById("param-fields");
    fields.innerHTML = "";
    t.params.forEach((def) => {
      const wrap = document.createElement("div");
      wrap.className = "pw-field";
      wrap.innerHTML = `<label for="p-${def.key}">${def.label}</label>
        <input id="p-${def.key}" type="number" min="${def.min}" max="${def.max}" value="${p[def.key]}">`;
      fields.appendChild(wrap);
      wrap.querySelector("input").addEventListener("change", (e) => {
        state.params[def.key] = Number(e.target.value);
        saveSession();
        renderLab();
      });
    });

    document.getElementById("chips").innerHTML = d.chips
      .map((c) => `<div class="bus-chip"><strong>${c.name}</strong> · ${c.text}</div>`)
      .join("");
    document.getElementById("notes").textContent = d.notes;
    document.getElementById("mod-code").textContent = d.module;
    document.getElementById("inst-code").textContent = d.inst;
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
            `<label><input type="radio" name="pw-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.quizChoice = inp.value;
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
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function loadChallengeSetup() {
    const ch = CHALLENGES[state.challengeIdx];
    if (ch.template) {
      state.templateId = ch.template;
      const t = currentTemplate();
      t.params.forEach((def) => {
        if (state.params[def.key] == null) state.params[def.key] = def.def;
      });
      saveSession();
      renderAll();
      setChalStatus("idle", "Template loaded — set parameters, then Check");
    } else setChalStatus("idle", "Quiz — pick an answer");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else {
      const p = paramBag();
      const d = derived();
      ok = !!ch.check(p, d);
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

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("tpl-sel").addEventListener("change", (e) => {
    state.templateId = e.target.value;
    const t = currentTemplate();
    t.params.forEach((def) => {
      if (state.params[def.key] == null) state.params[def.key] = def.def;
    });
    saveSession();
    renderAll();
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
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
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeSetup);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
