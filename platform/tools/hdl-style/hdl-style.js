import { loadHdlEngine } from "../../assets/hdl-engine.js";
import { attachAssist, fixForRule } from "../../assets/hdl-assist.js";

const STORAGE_KEY = "ddv-hdl-style-v1";
const CLEARED_KEY = "ddv-hdl-style-cleared-v1";

/** @type {null | Awaited<ReturnType<typeof loadHdlEngine>>} */
let hdl = null;

const STARTER = `module ff_ok(
  input  logic clk,
  input  logic rst_n,
  input  logic d,
  output logic q
);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) q <= 1'b0;
    else        q <= d;
  end
endmodule
`;

const SNIPPETS = {
  starter: { label: "Clean FF", code: STARTER },
  clock: {
    label: "clock not clk",
    code: `module m(input clock, input d, output reg q);
  always @(posedge clock) q <= d;
endmodule
`,
  },
  reset: {
    label: "reset not rst_n",
    code: `module m(input clk, input reset, input d, output logic q);
  always_ff @(posedge clk or negedge reset) begin
    if (!reset) q <= 1'b0;
    else        q <= d;
  end
endmodule
`,
  },
  always_edge: {
    label: "always @(posedge)",
    code: `module m(input clk, input d, output logic q);
  always @(posedge clk) q <= d;
endmodule
`,
  },
  always_star: {
    label: "always @(*)",
    code: `module m(input a, b, output logic y);
  always @(*) y = a & b;
endmodule
`,
  },
  prefer_reg: {
    label: "output reg",
    code: `module m(input a, output reg y);
  assign y = a;
endmodule
`,
  },
  good_comb: {
    label: "Good always_comb",
    code: `module m(input logic a, b, output logic y);
  always_comb y = a & b;
endmodule
`,
  },
};

const CHALLENGES = [
  {
    id: "quiz-what",
    title: "Quiz: what is this",
    type: "quiz",
    prompt: "This lab’s lintStyle API is…",
    hint: "Teaching heuristics shared with the IDE.",
    choices: [
      "a teaching / assist style pack — not Verible or a company style guide",
      "identical to Vivado lint",
      "only a formatter",
      "a synthesis tool",
    ],
    answer: "a teaching / assist style pack — not Verible or a company style guide",
  },
  {
    id: "quiz-clk",
    title: "Quiz: clock name",
    type: "quiz",
    prompt: "Teaching style prefers clock nets named…",
    hint: "clk / *_clk.",
    choices: ["`clk` / `*_clk`", "always `clock`", "only `c`", "`sys`"],
    answer: "`clk` / `*_clk`",
  },
  {
    id: "quiz-rst",
    title: "Quiz: reset name",
    type: "quiz",
    prompt: "Active-low reset naming often uses…",
    hint: "_n suffix.",
    choices: ["`rst_n` / `reset_n`", "only `reset`", "`r`", "`nrst` without convention"],
    answer: "`rst_n` / `reset_n`",
  },
  {
    id: "quiz-ff",
    title: "Quiz: always_ff",
    type: "quiz",
    prompt: "For edge-triggered flops, prefer…",
    hint: "SV keyword.",
    choices: ["`always_ff @(posedge …)`", "`always @(*)`", "`initial`", "`forever`"],
    answer: "`always_ff @(posedge …)`",
  },
  {
    id: "quiz-comb",
    title: "Quiz: always_comb",
    type: "quiz",
    prompt: "For combo procedural blocks, prefer…",
    hint: "SV keyword.",
    choices: ["`always_comb`", "`always @(posedge clk)`", "`#delay`", "`fork`"],
    answer: "`always_comb`",
  },
  {
    id: "quiz-logic",
    title: "Quiz: logic vs reg",
    type: "quiz",
    prompt: "For new SystemVerilog RTL, prefer…",
    hint: "SV type.",
    choices: ["`logic` over legacy `reg`", "only `wire`", "only `integer`", "`real`"],
    answer: "`logic` over legacy `reg`",
  },
  {
    id: "quiz-ide",
    title: "Quiz: IDE assist",
    type: "quiz",
    prompt: "Live style hints in the simulator IDE use…",
    hint: "Same engine API.",
    choices: [
      "the same `lintStyle` API as this teaching lab",
      "a separate Python server",
      "only CSS underlines",
      "GTKWave only",
    ],
    answer: "the same `lintStyle` API as this teaching lab",
  },
  {
    id: "run-clean",
    title: "Lint: clean FF",
    type: "run",
    prompt: "Load the clean FF starter and Lint — ok with zero findings.",
    hint: "Load starter example.",
    needOk: true,
    needEmpty: true,
  },
  {
    id: "run-clk",
    title: "Lint: name-clk",
    type: "run",
    prompt: "Load “clock not clk” and Lint — must report name-clk.",
    hint: "Snippet.",
    needRule: "name-clk",
  },
  {
    id: "run-rst",
    title: "Lint: name-rst",
    type: "run",
    prompt: "Load “reset not rst_n” — must report name-rst.",
    hint: "Snippet.",
    needRule: "name-rst",
  },
  {
    id: "run-ff",
    title: "Lint: prefer-always-ff",
    type: "run",
    prompt: "Load “always @(posedge)” — must report prefer-always-ff.",
    hint: "Snippet.",
    needRule: "prefer-always-ff",
  },
  {
    id: "run-comb",
    title: "Lint: prefer-always-comb",
    type: "run",
    prompt: "Load “always @(*)” — must report prefer-always-comb.",
    hint: "Snippet.",
    needRule: "prefer-always-comb",
  },
  {
    id: "run-logic",
    title: "Lint: prefer-logic",
    type: "run",
    prompt: "Load “output reg” — must report prefer-logic.",
    hint: "Snippet.",
    needRule: "prefer-logic",
  },
  {
    id: "run-good-comb",
    title: "Lint: good always_comb",
    type: "run",
    prompt: "Load “Good always_comb” — zero findings.",
    hint: "Snippet.",
    needOk: true,
    needEmpty: true,
  },
  {
    id: "run-fix-clk",
    title: "Fix: rename clock→clk",
    type: "run",
    prompt: "Start from “clock not clk”; rename to `clk` and use `always_ff` so name-clk and prefer-always-ff are gone.",
    hint: "Rename port + always_ff.",
    checkSource: (src, res) => {
      if (!res || !res.ok) return false;
      if (/\bclock\b/i.test(src) && !/\bclk\b/i.test(src)) return false;
      return (
        !res.findings.some((f) => f.rule === "name-clk" || f.rule === "prefer-always-ff") &&
        /always_ff/.test(src) &&
        /\bclk\b/.test(src)
      );
    },
  },
  {
    id: "run-fix-rst",
    title: "Fix: reset→rst_n",
    type: "run",
    prompt: "Start from “reset not rst_n”; rename to `rst_n` so name-rst disappears.",
    hint: "Rename reset → rst_n everywhere.",
    checkSource: (src, res) => {
      if (!res) return false;
      return (
        /\brst_n\b/.test(src) &&
        !/\breset\b/i.test(src) &&
        !res.findings.some((f) => f.rule === "name-rst")
      );
    },
  },
  {
    id: "run-parse-err",
    title: "Lint: parse-error",
    type: "run",
    prompt: "Paste broken syntax (`module oops`) and Lint — must report parse-error.",
    hint: "Incomplete module.",
    needRule: "parse-error",
  },
  {
    id: "quiz-severity",
    title: "Quiz: severity",
    type: "quiz",
    prompt: "Style findings in this pack are usually…",
    hint: "Don’t block Run.",
    choices: [
      "info/warning hints — they should not block simulation alone",
      "always fatal errors",
      "only for synthesis tools",
      "ignored by the IDE",
    ],
    answer: "info/warning hints — they should not block simulation alone",
  },
  {
    id: "run-filter",
    title: "Filter: only name-clk",
    type: "run",
    prompt: "Load “clock not clk”; enable only the name-clk rule chip; Lint — findings must be only name-clk.",
    hint: "Toggle chips.",
    checkSource: (_src, res, st) => {
      if (!res || !st.enabledRules.includes("name-clk")) return false;
      if (st.enabledRules.length !== 1) return false;
      return res.findings.length > 0 && res.findings.every((f) => f.rule === "name-clk");
    },
  },
  {
    id: "quiz-vs-synth",
    title: "Quiz: vs synth-lint",
    type: "quiz",
    prompt: "`lintStyle` vs `lintSynthesizability`…",
    hint: "Different rule packs.",
    choices: [
      "style = naming/SV form; synth = delays/latches/blocking — both share the engine",
      "they are the same function",
      "style replaces synthesis",
      "only style can find #delay",
    ],
    answer: "style = naming/SV form; synth = delays/latches/blocking — both share the engine",
  },
  {
    id: "run-empty-rules",
    title: "Lint: all rules default",
    type: "run",
    prompt: "With all rule chips on (default), load Clean FF — still zero findings.",
    hint: "Starter + all rules.",
    needOk: true,
    needEmpty: true,
  },
  {
    id: "quiz-assist",
    title: "Quiz: beyond teaching",
    type: "quiz",
    prompt: "Beyond this teaching lab, style lint is meant to…",
    hint: "IDE Problems tab.",
    choices: [
      "auto-assist coders with live hints while editing",
      "replace all verification",
      "upload RTL to a cloud linter",
      "only grade homework offline",
    ],
    answer: "auto-assist coders with live hints while editing",
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

const root = document.getElementById("hs-root");
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
      <h2>Style lint</h2>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        <button type="button" class="btn btn-secondary" id="btn-lint">Lint</button>
      </div>
    </div>
    <div class="panel-body">
      <p class="engine-status" id="engine-status">Loading HDL engine…</p>
      <p class="hs-meta">Snippets</p>
      <div class="snippet-row" id="snippets"></div>
      <label class="hs-meta" for="src">Source <span class="assist-status" id="assist-status" hidden></span></label>
      <div class="hs-editor-wrap">
        <textarea class="hs-editor" id="src" spellcheck="false"></textarea>
      </div>
      <p class="hs-meta" style="margin-top:0.75rem">Rules (uncheck to disable) · live hints while typing · Tab to complete</p>
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
  if (!hdl || typeof hdl.lintStyle !== "function") {
    setEngineStatus("err", "HDL engine missing lintStyle — refresh vendor pin");
    return null;
  }
  const opts = {};
  if (state.enabledRules.length) opts.rules = state.enabledRules.slice();
  const res = hdl.lintStyle(state.source, opts);
  state.lastResult = res;
  saveSession();
  renderFindings();
  return res;
}

let liveLintTimer = 0;
function scheduleLiveLint() {
  clearTimeout(liveLintTimer);
  liveLintTimer = setTimeout(() => {
    if (hdl?.lintStyle) runLint();
  }, 400);
}

function renderFindings() {
  const res = state.lastResult;
  const verd = document.getElementById("verdict");
  const list = document.getElementById("findings");
  if (!res) {
    verd.innerHTML = "";
    list.innerHTML = `<li class="hs-meta" style="border:none">Click Lint to analyze.</li>`;
    return;
  }
  const errs = res.findings.filter((f) => f.severity === "error").length;
  const hints = res.findings.length;
  if (!res.ok) {
    verd.innerHTML = `<div class="verdict bad">Issues — ${errs} error(s)</div>`;
  } else if (hints) {
    verd.innerHTML = `<div class="verdict hints">OK — ${hints} style hint(s)</div>`;
  } else {
    verd.innerHTML = `<div class="verdict ok">OK — no findings</div>`;
  }
  if (!res.findings.length) {
    list.innerHTML = `<li>No findings.</li>`;
    return;
  }
  list.innerHTML = res.findings
    .map((f, i) => {
      const loc = f.line != null ? `:${f.line}` : "";
      const fix = fixForRule(f);
      return `<li>
        <span class="sev ${f.severity}">${f.severity}</span>
        <span class="rule">${f.rule}${loc}</span>
        ${f.message}
        ${f.excerpt ? `<span class="excerpt">${escapeHtml(f.excerpt)}</span>` : ""}
        ${
          fix
            ? `<button type="button" class="fix-btn" data-fix="${i}">${escapeHtml(fix.title)}</button>`
            : ""
        }
      </li>`;
    })
    .join("");
  list.querySelectorAll("[data-fix]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = res.findings[Number(btn.getAttribute("data-fix"))];
      const fix = fixForRule(f);
      if (!fix) return;
      const next = fix.apply(state.source);
      if (next == null) return;
      state.source = next;
      document.getElementById("src").value = next;
      saveSession();
      runLint();
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderLab() {
  document.getElementById("starter-note").textContent =
    "Starter example: clean always_ff with clk + rst_n. Try snippets that emit style hints, then fix them.";
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
  const allRules = ((hdl && hdl.STYLE_LINT_RULES) || [
    "name-clk",
    "name-rst",
    "prefer-always-ff",
    "prefer-always-comb",
    "prefer-logic",
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
          `<label><input type="radio" name="hs-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
  if (ch.id === "run-clean" || ch.id === "run-empty-rules") state.source = STARTER;
  else if (ch.id === "run-clk" || ch.id === "run-fix-clk") state.source = SNIPPETS.clock.code;
  else if (ch.id === "run-rst" || ch.id === "run-fix-rst") state.source = SNIPPETS.reset.code;
  else if (ch.id === "run-ff") state.source = SNIPPETS.always_edge.code;
  else if (ch.id === "run-comb") state.source = SNIPPETS.always_star.code;
  else if (ch.id === "run-logic") state.source = SNIPPETS.prefer_reg.code;
  else if (ch.id === "run-good-comb") state.source = SNIPPETS.good_comb.code;
  else if (ch.id === "run-parse-err") state.source = "module oops";
  else if (ch.id === "run-filter") {
    state.source = SNIPPETS.clock.code;
    state.enabledRules = ["name-clk"];
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
  scheduleLiveLint();
});
document.getElementById("btn-starter").addEventListener("click", () => {
  loadStarter();
  saveSession();
  renderAll();
  setChalStatus("idle", "Idle");
  scheduleLiveLint();
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

attachAssist(document.getElementById("src"), {
  statusEl: document.getElementById("assist-status"),
  onChange: () => {
    state.source = document.getElementById("src").value;
    saveSession();
    scheduleLiveLint();
  },
});

async function boot() {
  if (!restoreSession()) loadStarter();
  renderAll();
  try {
    hdl = await loadHdlEngine();
    if (!hdl.lintStyle) {
      setEngineStatus("err", "Engine loaded but lintStyle missing — update vendor");
    } else {
      setEngineStatus("ready", `HDL engine ready · ${hdl.STYLE_LINT_RULES?.length || "?"} style rules · live assist on`);
      renderLab();
      scheduleLiveLint();
    }
  } catch (e) {
    setEngineStatus("err", "Failed to load HDL engine: " + (e && e.message ? e.message : e));
  }
}

boot();
