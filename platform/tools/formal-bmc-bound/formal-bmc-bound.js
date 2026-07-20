(function () {
  "use strict";

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      bugAt: 3,
      k: 5,
      verdict: "CEX",
      message: "BMC depth k=5 reaches bug at step 3 → counterexample",
      ran: true,
    };
  }

  function runBmc(api) {
    var s = api.getState();
    var bugAt = Number(s.bugAt) || 3;
    var k = Number(s.k) || 5;
    var hit = k >= bugAt;
    api.patchState({
      bugAt: bugAt,
      k: k,
      verdict: hit ? "CEX" : "PASS_BOUND",
      message: hit
        ? "BMC depth k=" + k + " reaches bug at step " + bugAt + " → counterexample"
        : "BMC depth k=" + k + " < bug at step " + bugAt + " → PASS_BOUND (bug not reached)",
      ran: true,
      lastAction: "bmc",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Bounded model check</h3>" +
      '<div class="lab-controls">' +
      '<div class="lab-field"><label>bugAt step</label><input id="bmc-bug" type="number" min="0" value="3"></div>' +
      '<div class="lab-field"><label>bound k</label><input id="bmc-k" type="number" min="0" value="5"></div>' +
      "</div>" +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="bmc-run">Run BMC</button>' +
      '<button type="button" class="btn btn-ghost" id="bmc-safe">Safe: k=2</button>' +
      "</div>" +
      '<div id="verdict" class="verdict no">CEX</div>' +
      '<p class="meta-note">If k &ge; bugAt the bug is reachable within bound → <strong>CEX</strong>; else <strong>PASS_BOUND</strong>.</p>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Literacy</h3>" +
      '<pre class="code-box">bmc -depth k\n# bug injected at cycle bugAt</pre>' +
      "</div></div>";

    document.getElementById("bmc-run").addEventListener("click", function () {
      api.patchState({
        bugAt: Number(document.getElementById("bmc-bug").value),
        k: Number(document.getElementById("bmc-k").value),
      });
      runBmc(api);
    });
    document.getElementById("bmc-safe").addEventListener("click", function () {
      api.patchState({ k: 2 });
      document.getElementById("bmc-k").value = "2";
      runBmc(api);
    });
    document.getElementById("bmc-bug").addEventListener("change", function () {
      api.patchState({ bugAt: Number(document.getElementById("bmc-bug").value) });
    });
    document.getElementById("bmc-k").addEventListener("change", function () {
      api.patchState({ k: Number(document.getElementById("bmc-k").value) });
    });
  }

  function renderLab(state) {
    var bug = document.getElementById("bmc-bug");
    var kEl = document.getElementById("bmc-k");
    if (bug && document.activeElement !== bug) bug.value = state.bugAt != null ? state.bugAt : 3;
    if (kEl && document.activeElement !== kEl) kEl.value = state.k != null ? state.k : 5;

    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "PASS_BOUND") cls += "yes";
      else if (state.verdict === "CEX") cls += "no";
      else cls += "idle";
      v.className = cls;
      v.textContent = (state.verdict || "idle") + ": " + (state.message || "");
    }
  }

  function literacy(state) {
    return (
      "bug_at = " +
      (state.bugAt || 3) +
      "\nbmc_depth k = " +
      (state.k || 5) +
      "\nresult = " +
      (state.verdict || "idle")
    );
  }

  var baseChallenges = [
    {
      id: "starter-cex",
      prompt: "Starter: bugAt=3, k=5 — Run BMC → CEX.",
      hint: "k >= bugAt.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "CEX" && s.k === 5 && s.bugAt === 3;
      },
    },
    {
      id: "pass-bound",
      prompt: "Click Safe: k=2 — PASS_BOUND (k < bugAt).",
      hint: "Safe button sets k=2.",
      setup: function (api) {
        api.patchState({ bugAt: 3, k: 2 });
        runBmc(api);
      },
      check: function (api) {
        return api.getState().verdict === "PASS_BOUND";
      },
    },
    {
      id: "edge-equal",
      prompt: "Set k=3 equal to bugAt, Run BMC — CEX.",
      hint: "k >= bugAt triggers CEX.",
      setup: function (api) {
        api.patchState({ bugAt: 3, k: 3 });
        runBmc(api);
      },
      check: function (api) {
        return api.getState().verdict === "CEX";
      },
    },
    {
      id: "deep-bug",
      prompt: "Set bugAt=10, k=5, Run BMC — PASS_BOUND.",
      hint: "Bug beyond bound.",
      setup: function (api) {
        api.patchState({ bugAt: 10, k: 5 });
        runBmc(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS_BOUND" && s.bugAt === 10;
      },
    },
    {
      id: "shallow-cex",
      prompt: "Set bugAt=1, k=1, Run BMC — CEX.",
      hint: "Immediate reachability.",
      setup: function (api) {
        api.patchState({ bugAt: 1, k: 1 });
        runBmc(api);
      },
      check: function (api) {
        return api.getState().verdict === "CEX";
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-bmc",
      type: "quiz",
      prompt: "BMC explores states up to…",
      choices: ["bound k", "infinite depth always", "Git history", "pytest fixtures"],
      answer: "bound k",
      hint: "Finite horizon.",
    },
    {
      id: "quiz-cex",
      type: "quiz",
      prompt: "CEX means…",
      choices: ["counterexample trace found", "coverage hit", "vacuous pass", "synthesis ok"],
      answer: "counterexample trace found",
      hint: "Witness trace.",
    },
    {
      id: "quiz-pass",
      type: "quiz",
      prompt: "PASS_BOUND here means…",
      choices: ["bug not reached within k", "full unbounded proof", "Git clean", "sim passed"],
      answer: "bug not reached within k",
      hint: "Bounded pass.",
    },
    {
      id: "quiz-not-full",
      type: "quiz",
      prompt: "BMC pass does not prove…",
      choices: ["unbounded correctness", "bounded behavior", "trace exists", "k steps safe"],
      answer: "unbounded correctness",
      hint: "Need induction/full proof.",
    },
    {
      id: "quiz-depth",
      type: "quiz",
      prompt: "Increasing k may…",
      choices: ["reach deeper bugs", "guarantee vacuity", "stop clock", "delete asserts"],
      answer: "reach deeper bugs",
      hint: "More steps.",
    },
    {
      id: "quiz-assume",
      type: "quiz",
      prompt: "BMC respects…",
      choices: ["assume constraints", "only cover", "Git tags", "CSS theme"],
      answer: "assume constraints",
      hint: "Env model.",
    },
    {
      id: "quiz-witness",
      type: "quiz",
      prompt: "CEX trace is a…",
      choices: ["witness for assert failure", "proof of vacuity", "synthesis netlist", "Git patch"],
      answer: "witness for assert failure",
      hint: "Debug wave.",
    },
    {
      id: "quiz-tool",
      type: "quiz",
      prompt: "Real BMC runs in…",
      choices: ["formal tools (SymbiYosys, VC Formal, …)", "browser only", "Git only", "pytest only"],
      answer: "formal tools (SymbiYosys, VC Formal, …)",
      hint: "Offline formal.",
    },
    {
      id: "quiz-reset",
      type: "quiz",
      prompt: "bugAt step counts from…",
      choices: ["start of bounded exploration sketch", "Git commit", "cover hit", "vacuity"],
      answer: "start of bounded exploration sketch",
      hint: "Cycle index.",
    },
    {
      id: "quiz-abstraction",
      type: "quiz",
      prompt: "Abstraction in formal may…",
      choices: ["reduce state space", "delete all asserts", "run cocotb", "push Git"],
      answer: "reduce state space",
      hint: "Scale trick.",
    },
    {
      id: "quiz-k-ind",
      type: "quiz",
      prompt: "k-induction generalizes BMC with…",
      choices: ["inductive step", "only cover", "Git stash", "clock period"],
      answer: "inductive step",
      hint: "Proof pattern.",
    },
    {
      id: "quiz-over",
      type: "quiz",
      prompt: "Over-large k without convergence can…",
      choices: ["cost runtime/memory", "guarantee proof", "fix RTL", "run pytest"],
      answer: "cost runtime/memory",
      hint: "Expensive search.",
    },
    {
      id: "quiz-fail",
      type: "quiz",
      prompt: "CEX at step 3 means failure visible by…",
      choices: ["cycle 3 in sketch", "Git tag", "cover only", "never"],
      answer: "cycle 3 in sketch",
      hint: "Time index.",
    },
    {
      id: "quiz-safety",
      type: "quiz",
      prompt: "Safety properties ask…",
      choices: ["bad thing never happens", "cover always hits", "Git always pushes", "clock never toggles"],
      answer: "bad thing never happens",
      hint: "Nothing bad.",
    },
    {
      id: "quiz-liveness",
      type: "quiz",
      prompt: "Liveness needs…",
      choices: ["eventually / fairness", "only BMC k=1", "vacuity", "pytest assert"],
      answer: "eventually / fairness",
      hint: "Progress.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Browser BMC lab is literacy; real runs are…",
      choices: ["local formal flow", "PDF only", "Git only", "CSS only"],
      answer: "local formal flow",
      hint: "Offline.",
    },
    {
      id: "quiz-compare",
      type: "quiz",
      prompt: "Sim regression vs BMC: BMC can find…",
      choices: ["bugs missed by limited sim seeds", "only typos", "Git merges", "font issues"],
      answer: "bugs missed by limited sim seeds",
      hint: "Exhaustive bounded.",
    },
  ];

  DDVConceptLab.mount({
    id: "formal-bmc-bound",
    rootId: "bmc-root",
    starterHtml:
      "<p><strong>Starter example:</strong> bug at step <code>3</code>, bound <code>k=5</code> — Run BMC → <strong>CEX</strong> (k &ge; bugAt).</p>",
    ideas: [
      { h3: "BMC", p: "Explore design states up to depth k." },
      { h3: "bugAt", p: "Cycle where injected bug becomes visible." },
      { h3: "CEX", p: "When k ≥ bugAt, counterexample within bound." },
      { h3: "PASS_BOUND", p: "Bug beyond k — not reached in bounded search." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
