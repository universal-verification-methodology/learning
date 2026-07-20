(function () {
  "use strict";

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      baseOk: true,
      stepOk: true,
      verdict: "PROVED",
      message: "Base holds and inductive step holds → PROVED (sketch)",
    };
  }

  function updateVerdict(api) {
    var s = api.getState();
    var proved = s.baseOk && s.stepOk;
    api.patchState({
      verdict: proved ? "PROVED" : "NOT_PROVED",
      message: proved
        ? "Base holds and inductive step holds → PROVED (sketch)"
        : "Need both base and step for induction sketch",
      lastAction: "toggle",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Induction sketch</h3>" +
      '<div class="lab-controls">' +
      '<label class="lab-field"><span style="font-size:.78rem;font-weight:600;color:var(--muted)">BASE CASE</span>' +
      '<input id="find-base" type="checkbox" checked></label>' +
      '<label class="lab-field"><span style="font-size:.78rem;font-weight:600;color:var(--muted)">INDUCTIVE STEP</span>' +
      '<input id="find-step" type="checkbox" checked></label>' +
      "</div>" +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="find-eval">Evaluate</button>' +
      '<button type="button" class="btn btn-ghost" id="find-break-step">Break step</button>' +
      "</div>" +
      '<div id="verdict" class="verdict yes">PROVED</div>' +
      '<div class="flag-row">' +
      '<span class="flag is-ok" id="find-flag-base">base</span>' +
      '<span class="flag is-ok" id="find-flag-step">step</span>' +
      "</div>" +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Picture</h3>" +
      '<p class="meta-note">Prove P(0) <strong>base</strong> and &forall;k P(k)&rarr;P(k+1) <strong>step</strong> — both needed for this literacy sketch.</p>' +
      "</div></div>";

    document.getElementById("find-base").addEventListener("change", function () {
      api.patchState({ baseOk: document.getElementById("find-base").checked });
      updateVerdict(api);
    });
    document.getElementById("find-step").addEventListener("change", function () {
      api.patchState({ stepOk: document.getElementById("find-step").checked });
      updateVerdict(api);
    });
    document.getElementById("find-eval").addEventListener("click", function () {
      api.patchState({
        baseOk: document.getElementById("find-base").checked,
        stepOk: document.getElementById("find-step").checked,
      });
      updateVerdict(api);
    });
    document.getElementById("find-break-step").addEventListener("click", function () {
      document.getElementById("find-step").checked = false;
      api.patchState({ stepOk: false });
      updateVerdict(api);
    });
  }

  function renderLab(state) {
    var base = document.getElementById("find-base");
    var step = document.getElementById("find-step");
    if (base) base.checked = !!state.baseOk;
    if (step) step.checked = !!state.stepOk;

    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "PROVED") cls += "yes";
      else cls += "warn";
      v.className = cls;
      v.textContent = (state.verdict || "") + ": " + (state.message || "");
    }

    var fb = document.getElementById("find-flag-base");
    var fs = document.getElementById("find-flag-step");
    if (fb) fb.className = "flag " + (state.baseOk ? "is-ok" : "is-bad");
    if (fs) fs.className = "flag " + (state.stepOk ? "is-ok" : "is-bad");
  }

  function literacy(state) {
    return (
      "base: P(0) = " +
      (state.baseOk ? "holds" : "fail") +
      "\nstep: P(k)->P(k+1) = " +
      (state.stepOk ? "holds" : "fail") +
      "\nverdict: " +
      (state.verdict || "")
    );
  }

  var baseChallenges = [
    {
      id: "starter-proved",
      prompt: "Starter: baseOk and stepOk both true — verdict PROVED.",
      hint: "Load starter.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PROVED" && s.baseOk && s.stepOk;
      },
    },
    {
      id: "break-step",
      prompt: "Click Break step — NOT_PROVED.",
      hint: "Break step button.",
      setup: function (api) {
        api.patchState({ baseOk: true, stepOk: false });
        updateVerdict(api);
      },
      check: function (api) {
        return api.getState().verdict === "NOT_PROVED";
      },
    },
    {
      id: "break-base",
      prompt: "Uncheck base only — NOT_PROVED.",
      hint: "Base checkbox.",
      setup: function (api) {
        api.patchState({ baseOk: false, stepOk: true });
        updateVerdict(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "NOT_PROVED" && !s.baseOk;
      },
    },
    {
      id: "both-off",
      prompt: "Uncheck both — NOT_PROVED.",
      hint: "Both toggles off.",
      setup: function (api) {
        api.patchState({ baseOk: false, stepOk: false });
        updateVerdict(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "NOT_PROVED" && !s.baseOk && !s.stepOk;
      },
    },
    {
      id: "restore-proved",
      prompt: "Re-check both, Evaluate — PROVED again.",
      hint: "Turn both on.",
      setup: function (api) {
        api.patchState({ baseOk: true, stepOk: true });
        updateVerdict(api);
      },
      check: function (api) {
        return api.getState().verdict === "PROVED";
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-ind",
      type: "quiz",
      prompt: "Mathematical induction needs…",
      choices: ["base case + inductive step", "only BMC k=1", "only cover", "Git merge"],
      answer: "base case + inductive step",
      hint: "Two parts.",
    },
    {
      id: "quiz-base",
      type: "quiz",
      prompt: "Base case shows property for…",
      choices: ["starting state / time 0", "all infinite time", "Git only", "vacuity only"],
      answer: "starting state / time 0",
      hint: "P(0).",
    },
    {
      id: "quiz-step",
      type: "quiz",
      prompt: "Inductive step shows…",
      choices: ["P(k) implies P(k+1)", "cover hits", "assume false", "clock stops"],
      answer: "P(k) implies P(k+1)",
      hint: "Progress.",
    },
    {
      id: "quiz-k",
      type: "quiz",
      prompt: "k-induction in formal tools relates to…",
      choices: ["unbounded proof via fixed depth step", "only simulation", "Git tags", "pytest"],
      answer: "unbounded proof via fixed depth step",
      hint: "Formal induction.",
    },
    {
      id: "quiz-bmc-gap",
      type: "quiz",
      prompt: "BMC alone may miss bugs beyond…",
      choices: ["bound k", "Git remote", "cover name", "font size"],
      answer: "bound k",
      hint: "Depth limit.",
    },
    {
      id: "quiz-strengthen",
      type: "quiz",
      prompt: "Failed inductive step often needs…",
      choices: ["stronger invariant", "delete asserts", "vacuity", "Git push"],
      answer: "stronger invariant",
      hint: "Auxiliary prop.",
    },
    {
      id: "quiz-assume",
      type: "quiz",
      prompt: "Induction assumes…",
      choices: ["property holds at k to prove k+1", "cover always", "Git clean", "no clock"],
      answer: "property holds at k to prove k+1",
      hint: "IH.",
    },
    {
      id: "quiz-fsm",
      type: "quiz",
      prompt: "FSM proofs often use…",
      choices: ["inductive invariant on states", "only random sim", "Git diff", "CSS"],
      answer: "inductive invariant on states",
      hint: "State inv.",
    },
    {
      id: "quiz-fair",
      type: "quiz",
      prompt: "Liveness proofs may need…",
      choices: ["fairness assumptions", "only base case", "vacuity", "pytest skip"],
      answer: "fairness assumptions",
      hint: "Progress assump.",
    },
    {
      id: "quiz-over",
      type: "quiz",
      prompt: "Over-strong step can…",
      choices: ["be unprovable though design correct", "always vacuous", "run Git", "stop cocotb"],
      answer: "be unprovable though design correct",
      hint: "Too strong.",
    },
    {
      id: "quiz-under",
      type: "quiz",
      prompt: "Under-strong invariant may…",
      choices: ["allow false proof of step", "guarantee synthesis", "fix typos", "run pytest"],
      answer: "allow false proof of step",
      hint: "Too weak.",
    },
    {
      id: "quiz-sby",
      type: "quiz",
      prompt: "SymbiYosys modes include…",
      choices: ["bmc, prove, cover", "only Git", "only lint", "only PDF"],
      answer: "bmc, prove, cover",
      hint: "SBY tasks.",
    },
    {
      id: "quiz-prove",
      type: "quiz",
      prompt: "prove mode targets…",
      choices: ["unbounded or inductive proof", "only one cycle", "Git hook", "wave color"],
      answer: "unbounded or inductive proof",
      hint: "Full proof.",
    },
    {
      id: "quiz-sketch",
      type: "quiz",
      prompt: "This lab is a…",
      choices: ["literacy sketch of induction parts", "replacement for all formal", "Git tutorial", "clock generator"],
      answer: "literacy sketch of induction parts",
      hint: "Concept only.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Real induction runs…",
      choices: ["local formal tools", "browser only forever", "Git only", "CSS only"],
      answer: "local formal tools",
      hint: "Offline.",
    },
    {
      id: "quiz-cex",
      type: "quiz",
      prompt: "Failed step may produce…",
      choices: ["CEX for inductive failure", "vacuous pass always", "Git merge", "cover only"],
      answer: "CEX for inductive failure",
      hint: "Witness.",
    },
    {
      id: "quiz-both",
      type: "quiz",
      prompt: "Only base true, step false → overall…",
      choices: ["NOT proved", "fully proved", "vacuous", "Git ok"],
      answer: "NOT proved",
      hint: "Need both.",
    },
  ];

  DDVConceptLab.mount({
    id: "formal-induction",
    rootId: "finduct-root",
    starterHtml:
      "<p><strong>Starter example:</strong> <strong>base</strong> holds and <strong>step</strong> holds → sketch verdict <strong>PROVED</strong>.</p>",
    ideas: [
      { h3: "Base", p: "Show the property holds at the start (P(0))." },
      { h3: "Step", p: "Show P(k) implies P(k+1) for all k." },
      { h3: "Both required", p: "Induction needs base and step — not just BMC depth." },
      { h3: "Sketch", p: "Real proofs run in local formal tools with invariants." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
