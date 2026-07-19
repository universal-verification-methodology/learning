import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-synth-lint-v1";
const CLEARED_KEY = "ddv-synth-lint-cleared-v1";

/** @type {null | Awaited<ReturnType<typeof loadHdlEngine>>} */
let hdl = null;

const STARTER = `module and2(
  input  logic a,
  input  logic b,
  output logic y
);
  assign y = a & b;
endmodule
`;

const SNIPPETS = {
  starter: { label: "Clean assign", code: STARTER },
  delay: {
    label: "assign #delay",
    code: `module bad_delay(input a, output y);
  assign #5 y = a;
endmodule
`,
  },
  initial: {
    label: "initial",
    code: `module bad_init(output reg y);
  initial y = 0;
endmodule
`,
  },
  latch: {
    label: "Incomplete if",
    code: `module latch_en(input en, d, output reg y);
  always @(*) begin
    if (en) y = d;
  end
endmodule
`,
  },
  ff_blocking: {
    label: "FF with =",
    code: `module ff_bad(input clk, d, output reg q);
  always_ff @(posedge clk) q = d;
endmodule
`,
  },
  comb_nba: {
    label: "Comb with <=",
    code: `module comb_nba(input a, b, output logic y);
  always_comb y <= a & b;
endmodule
`,
  },
  timed: {
    label: "always #5",
    code: `module clkgen(output reg clk);
  initial clk = 0;
  always #5 clk = ~clk;
endmodule
`,
  },
  good_ff: {
    label: "Good FF",
    code: `module ff_ok(input clk, rst_n, d, output logic q);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) q <= 1'b0;
    else        q <= d;
  end
endmodule
`,
  },
};

const CHALLENGES = [
  {
    id: "quiz-what",
    title: "Quiz: what is this",
    type: "quiz",
    prompt: "This lab’s lintSynthesizability API is…",
    hint: "Teaching heuristics.",
    choices: [
      "a teaching rule pack on the HDL AST — not full industrial synthesis",
      "identical to Vivado synth",
      "only a formatter",
      "a SPICE netlist checker",
    ],
    answer: "a teaching rule pack on the HDL AST — not full industrial synthesis",
  },
  {
    id: "quiz-delay",
    title: "Quiz: #delay",
    type: "quiz",
    prompt: "`assign #5 y = a;` is flagged mainly because…",
    hint: "Synth ignores / rejects delays.",
    choices: [
      "procedural/continuous delays are not synthesizable RTL",
      "5 is an illegal number",
      "assign is illegal",
      "it creates a PLL",
    ],
    answer: "procedural/continuous delays are not synthesizable RTL",
  },
  {
    id: "quiz-initial",
    title: "Quiz: initial",
    type: "quiz",
    prompt: "`initial` in RTL modules is typically…",
    hint: "Sim-only.",
    choices: [
      "simulation-only (prefer reset in always_ff)",
      "required for every flop",
      "the only way to write combo logic",
      "ignored by all simulators",
    ],
    answer: "simulation-only (prefer reset in always_ff)",
  },
  {
    id: "quiz-latch",
    title: "Quiz: latch",
    type: "quiz",
    prompt: "`always @(*) if (en) y = d;` with no else often…",
    hint: "Incomplete assignment.",
    choices: [
      "infers a latch (incomplete combo assignment)",
      "infers a posedge flop",
      "is always illegal syntax",
      "forces y = X forever",
    ],
    answer: "infers a latch (incomplete combo assignment)",
  },
  {
    id: "quiz-blocking-ff",
    title: "Quiz: = in FF",
    type: "quiz",
    prompt: "Inside `always_ff @(posedge clk)`, prefer…",
    hint: "NBA.",
    choices: ["non-blocking `<=` for flop outputs", "only blocking `=`", "`#delay` before each assign", "`fork`/`join`"],
    answer: "non-blocking `<=` for flop outputs",
  },
  {
    id: "quiz-nba-comb",
    title: "Quiz: <= in comb",
    type: "quiz",
    prompt: "In `always_comb`, prefer…",
    hint: "Blocking.",
    choices: ["blocking `=`", "only `<=`", "`initial`", "gate delays"],
    answer: "blocking `=`",
  },
  {
    id: "quiz-systask",
    title: "Quiz: $display",
    type: "quiz",
    prompt: "`$display` / `$finish` in synthesizable RTL…",
    hint: "TB.",
    choices: [
      "are simulation/testbench constructs",
      "synthesize to LEDs",
      "are required by always_ff",
      "clear latches",
    ],
    answer: "are simulation/testbench constructs",
  },
  {
    id: "quiz-engine",
    title: "Quiz: where lint lives",
    type: "quiz",
    prompt: "The lint engine for this tool is provided by…",
    hint: "Same as other HDL labs.",
    choices: [
      "the vendored HDL simulator (`lintSynthesizability`)",
      "a separate Python server",
      "the browser’s CSS parser",
      "GTKWave only",
    ],
    answer: "the vendored HDL simulator (`lintSynthesizability`)",
  },
  {
    id: "run-clean",
    title: "Lint: clean assign",
    type: "run",
    prompt: "Load the clean assign starter (or snippet) and Lint — ok must be true with zero findings.",
    hint: "Load starter example.",
    needOk: true,
    needEmpty: true,
  },
  {
    id: "run-delay",
    title: "Lint: catch #delay",
    type: "run",
    prompt: "Load “assign #delay” snippet and Lint — must report rule no-delay.",
    hint: "Snippet button.",
    needRule: "no-delay",
  },
  {
    id: "run-initial",
    title: "Lint: catch initial",
    type: "run",
    prompt: "Load “initial” snippet and Lint — must report no-initial.",
    hint: "Snippet.",
    needRule: "no-initial",
  },
  {
    id: "run-latch",
    title: "Lint: latch-risk",
    type: "run",
    prompt: "Load “Incomplete if” and Lint — must report latch-risk.",
    hint: "Snippet.",
    needRule: "latch-risk",
  },
  {
    id: "run-ff-block",
    title: "Lint: blocking-in-seq",
    type: "run",
    prompt: "Load “FF with =” — must report blocking-in-seq.",
    hint: "Snippet.",
    needRule: "blocking-in-seq",
  },
  {
    id: "run-comb-nba",
    title: "Lint: nba-in-comb",
    type: "run",
    prompt: "Load “Comb with <=” — must report nba-in-comb.",
    hint: "Snippet.",
    needRule: "nba-in-comb",
  },
  {
    id: "run-timed",
    title: "Lint: timed-always",
    type: "run",
    prompt: "Load “always #5” — must report timed-always (and likely no-initial).",
    hint: "Snippet.",
    needRule: "timed-always",
  },
  {
    id: "run-good-ff",
    title: "Lint: good FF clean",
    type: "run",
    prompt: "Load “Good FF” and Lint — no error-severity findings (warnings about decl-init may appear; errors must be none).",
    hint: "Good FF snippet.",
    needNoErrors: true,
  },
  {
    id: "run-fix-latch",
    title: "Fix: complete else",
    type: "run",
    prompt: "Start from Incomplete if; add `else y = 1'b0;` so latch-risk disappears, then Lint.",
    hint: "Complete both paths.",
    checkSource: (src, res) =>
      /else/.test(src) && res && res.ok && !res.findings.some((f) => f.rule === "latch-risk"),
  },
  {
    id: "run-fix-delay",
    title: "Fix: remove delay",
    type: "run",
    prompt: "Start from assign #delay; remove `#5` so no-delay is gone.",
    hint: "`assign y = a;`",
    checkSource: (src, res) =>
      !/#\s*\d/.test(src) && res && !res.findings.some((f) => f.rule === "no-delay"),
  },
  {
    id: "quiz-not-yosys",
    title: "Quiz: honesty",
    type: "quiz",
    prompt: "Passing this linter means…",
    hint: "Lab tool.",
    choices: [
      "the code avoided common teaching red flags — still verify with real synth in courses",
      "the design is tape-out ready",
      "timing is closed at 1 GHz",
      "UVM is complete",
    ],
    answer: "the code avoided common teaching red flags — still verify with real synth in courses",
  },
  {
    id: "run-parse-err",
    title: "Lint: parse-error",
    type: "run",
    prompt: "Paste broken RTL (e.g. `module oops`) and Lint — must report parse-error.",
    hint: "Incomplete module.",
    needRule: "parse-error",
  },
  {
    id: "quiz-rules",
    title: "Quiz: rule filter",
    type: "quiz",
    prompt: "Disabling rules in the chip row…",
    hint: "opts.rules.",
    choices: [
      "narrows which findings are reported",
      "changes the SystemVerilog grammar",
      "turns on UVM",
      "deletes the editor",
    ],
    answer: "narrows which findings are reported",
  },
  {
    id: "run-filter",
    title: "Filter: only latch-risk",
    type: "run",
    prompt: "Load Incomplete if; enable only the latch-risk rule chip; Lint — findings must be only latch-risk (no other rules).",
    hint: "Toggle chips.",
    checkSource: (_src, res, state) => {
      if (!res || !state.enabledRules.includes("latch-risk")) return false;
      if (state.enabledRules.length !== 1) return false;
      return res.findings.length > 0 && res.findings.every((f) => f.rule === "latch-risk");
    },
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
  source: STARTER,
  enabledRules: [],
  lastResult: null,
  challengeIdx: 0,
  showHint: false,
  quizChoice: "",
};

function loadStarter() {
  state.source = STARTER;
  state.lastResult = null;
}

function saveSession() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ source: state.source, enabledRules: state.enabledRules })
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
    if (typeof d.source !== "string") return false;
    state.source = d.source;
    if (Array.isArray(d.enabledRules)) state.enabledRules = d.enabledRules;
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
      <h2>RTL lint</h2>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        <button type="button" class="btn btn-secondary" id="btn-lint">Lint</button>
      </div>
    </div>
    <div class="panel-body">
      <p class="engine-status" id="engine-status">Loading HDL engine…</p>
      <p class="sl-meta">Snippets</p>
      <div class="snippet-row" id="snippets"></div>
      <label class="sl-meta" for="src">Source</label>
      <textarea class="sl-editor" id="src" spellcheck="false"></textarea>
      <p class="sl-meta" style="margin-top:0.75rem">Rules (uncheck to disable)</p>
      <div class="rule-chips" id="rule-chips"></div>
      <div id="verdict"></div>
      <ul class="findings" id="findings" aria-live="polite"></ul>
    </div>
  </div>
`;

function setChalStatus(kind, msg) {
  const el = document.getElementById("chal-status");
  el.className = "challenge-status " + kind;
  el.textContent = msg;
}

function setEngineStatus(kind, msg) {
  const el = document.getElementById("engine-status");
  el.className = "engine-status " + kind;
  el.textContent = msg;
}

function runLint() {
  if (!hdl || typeof hdl.lintSynthesizability !== "function") {
    setEngineStatus("err", "HDL engine missing lintSynthesizability — refresh vendor pin");
    return null;
  }
  const opts = {};
  if (state.enabledRules.length) opts.rules = state.enabledRules.slice();
  const res = hdl.lintSynthesizability(state.source, opts);
  state.lastResult = res;
  saveSession();
  renderFindings();
  return res;
}

function renderFindings() {
  const res = state.lastResult;
  const verd = document.getElementById("verdict");
  const list = document.getElementById("findings");
  if (!res) {
    verd.innerHTML = "";
    list.innerHTML = `<li class="sl-meta" style="border:none">Click Lint to analyze.</li>`;
    return;
  }
  verd.innerHTML = res.ok
    ? `<div class="verdict ok">OK — no errors</div>`
    : `<div class="verdict bad">Issues — ${res.findings.filter((f) => f.severity === "error").length} error(s)</div>`;
  if (!res.findings.length) {
    list.innerHTML = `<li>No findings.</li>`;
    return;
  }
  list.innerHTML = res.findings
    .map((f) => {
      const loc = f.line != null ? `:${f.line}` : "";
      return `<li>
        <span class="sev ${f.severity}">${f.severity}</span>
        <span class="rule">${f.rule}${loc}</span>
        ${f.message}
        ${f.excerpt ? `<span class="excerpt">${escapeHtml(f.excerpt)}</span>` : ""}
      </li>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderLab() {
  document.getElementById("starter-note").textContent =
    "Starter example: clean continuous assign. Try snippets that fail lint, then fix them.";
  document.getElementById("src").value = state.source;

  const snip = document.getElementById("snippets");
  snip.innerHTML = "";
  Object.keys(SNIPPETS).forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = SNIPPETS[k].label;
    b.addEventListener("click", () => {
      state.source = SNIPPETS[k].code;
      state.lastResult = null;
      saveSession();
      renderAll();
    });
    snip.appendChild(b);
  });

  const chips = document.getElementById("rule-chips");
  const allRules = ((hdl && hdl.SYNTH_LINT_RULES) || [
    "no-delay",
    "no-initial",
    "no-systask",
    "no-fork",
    "no-force",
    "timed-always",
    "blocking-in-seq",
    "nba-in-comb",
    "latch-risk",
    "decl-init",
  ]).filter((r) => r !== "parse-error");
  const active =
    state.enabledRules.length === 0 ? new Set(allRules) : new Set(state.enabledRules);
  chips.innerHTML = "";
  allRules.forEach((rule) => {
    const lab = document.createElement("label");
    lab.dataset.rule = rule;
    lab.className = active.has(rule) ? "on" : "";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = active.has(rule);
    cb.addEventListener("change", () => {
      const on = [];
      chips.querySelectorAll("label").forEach((el) => {
        const name = el.dataset.rule;
        const checked = el.querySelector("input").checked;
        el.classList.toggle("on", checked);
        if (checked) on.push(name);
      });
      state.enabledRules = on.length === allRules.length ? [] : on;
      saveSession();
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(" " + rule));
    chips.appendChild(lab);
  });

  renderFindings();
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
          `<label><input type="radio" name="syn-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
  if (ch.type === "quiz") {
    setChalStatus("idle", "Quiz — pick an answer");
    return;
  }
  state.enabledRules = [];
  if (ch.id === "run-clean") state.source = STARTER;
  else if (ch.id === "run-delay" || ch.id === "run-fix-delay") state.source = SNIPPETS.delay.code;
  else if (ch.id === "run-initial") state.source = SNIPPETS.initial.code;
  else if (ch.id === "run-latch" || ch.id === "run-fix-latch") state.source = SNIPPETS.latch.code;
  else if (ch.id === "run-ff-block") state.source = SNIPPETS.ff_blocking.code;
  else if (ch.id === "run-comb-nba") state.source = SNIPPETS.comb_nba.code;
  else if (ch.id === "run-timed") state.source = SNIPPETS.timed.code;
  else if (ch.id === "run-good-ff") state.source = SNIPPETS.good_ff.code;
  else if (ch.id === "run-parse-err") state.source = "module oops";
  else if (ch.id === "run-filter") {
    state.source = SNIPPETS.latch.code;
    state.enabledRules = ["latch-risk"];
  }
  state.lastResult = null;
  saveSession();
  renderAll();
  setChalStatus("idle", "Setup loaded — Lint, then Check");
}

function checkChallenge() {
  const ch = CHALLENGES[state.challengeIdx];
  let ok = false;
  if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
  else {
    const res = state.lastResult || runLint();
    if (!res) {
      setChalStatus("fail", "Engine not ready");
      return;
    }
    if (ch.needOk) ok = !!res.ok;
    if (ch.needEmpty) ok = ok && res.findings.length === 0;
    if (ch.needRule) ok = res.findings.some((f) => f.rule === ch.needRule);
    if (ch.needNoErrors) ok = !res.findings.some((f) => f.severity === "error");
    if (ch.checkSource) ok = !!ch.checkSource(state.source, res, state);
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

document.getElementById("src").addEventListener("input", (e) => {
  state.source = e.target.value;
  saveSession();
});
document.getElementById("btn-starter").addEventListener("click", () => {
  loadStarter();
  saveSession();
  renderAll();
  setChalStatus("idle", "Idle");
});
document.getElementById("btn-lint").addEventListener("click", () => {
  runLint();
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

async function boot() {
  if (!restoreSession()) loadStarter();
  renderAll();
  try {
    hdl = await loadHdlEngine();
    if (!hdl.lintSynthesizability) {
      setEngineStatus("err", "Engine loaded but lintSynthesizability missing — update vendor");
    } else {
      setEngineStatus("ready", `HDL engine ready · ${hdl.SYNTH_LINT_RULES?.length || "?"} lint rules`);
      renderLab();
    }
  } catch (e) {
    setEngineStatus("err", "Failed to load HDL engine: " + (e && e.message ? e.message : e));
  }
}

boot();
