(function () {
  "use strict";

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      antecedentAlways0: true,
      verdict: "VACUOUS_PASS",
      message: "a always 0 → a|->b never fires → vacuous pass",
      ran: true,
    };
  }

  function runCheck(api) {
    var s = api.getState();
    var vac = !!s.antecedentAlways0;
    api.patchState({
      verdict: vac ? "VACUOUS_PASS" : "MEANINGFUL",
      message: vac
        ? "a always 0 → a|->b never fires → vacuous pass"
        : "a can be 1 → a|->b is meaningful (must check consequent)",
      ran: true,
      lastAction: "check",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Vacuity sketch</h3>" +
      '<div class="lab-controls">' +
      '<label class="lab-field"><span style="font-size:.78rem;font-weight:600;color:var(--muted)">ANTECEDENT a ALWAYS 0</span>' +
      '<input id="fvac-ant" type="checkbox" checked></label>' +
      "</div>" +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="fvac-run">Run vacuity check</button>' +
      '<button type="button" class="btn btn-ghost" id="fvac-meaningful">a can be 1</button>' +
      "</div>" +
      '<div id="verdict" class="verdict warn">VACUOUS_PASS</div>' +
      '<pre class="code-box">property p; a |-> b; endproperty</pre>' +
      '<p class="meta-note">If antecedent <code>a</code> never true, implication passes <strong>vacuously</strong>.</p>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Why it matters</h3>" +
      '<p class="meta-note">Vacuous PASS looks green but checked nothing — review covers and antecedent reachability.</p>' +
      "</div></div>";

    document.getElementById("fvac-ant").addEventListener("change", function () {
      api.patchState({ antecedentAlways0: document.getElementById("fvac-ant").checked });
    });
    document.getElementById("fvac-run").addEventListener("click", function () {
      api.patchState({ antecedentAlways0: document.getElementById("fvac-ant").checked });
      runCheck(api);
    });
    document.getElementById("fvac-meaningful").addEventListener("click", function () {
      document.getElementById("fvac-ant").checked = false;
      api.patchState({ antecedentAlways0: false });
      runCheck(api);
    });
  }

  function renderLab(state) {
    var ant = document.getElementById("fvac-ant");
    if (ant) ant.checked = !!state.antecedentAlways0;

    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "VACUOUS_PASS") cls += "warn";
      else if (state.verdict === "MEANINGFUL") cls += "yes";
      else cls += "idle";
      v.className = cls;
      v.textContent = (state.verdict || "idle") + ": " + (state.message || "");
    }
  }

  function literacy(state) {
    return (
      "assert property (a |-> b);\n" +
      "antecedent_always_zero = " +
      state.antecedentAlways0 +
      "\n# " +
      (state.verdict || "")
    );
  }

  var baseChallenges = [
    {
      id: "starter-vacuous",
      prompt: "Starter: antecedentAlways0 true — VACUOUS_PASS.",
      hint: "Load starter.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "VACUOUS_PASS" && s.antecedentAlways0;
      },
    },
    {
      id: "meaningful",
      prompt: "Click a can be 1 — MEANINGFUL (not vacuous).",
      hint: "Meaningful button.",
      setup: function (api) {
        api.patchState({ antecedentAlways0: false });
        runCheck(api);
      },
      check: function (api) {
        return api.getState().verdict === "MEANINGFUL";
      },
    },
    {
      id: "back-vacuous",
      prompt: "Re-check antecedent always 0, Run — VACUOUS_PASS again.",
      hint: "Toggle checkbox on.",
      setup: function (api) {
        api.patchState({ antecedentAlways0: true });
        runCheck(api);
      },
      check: function (api) {
        return api.getState().verdict === "VACUOUS_PASS";
      },
    },
    {
      id: "toggle-off-run",
      prompt: "Uncheck antecedent always 0, Run vacuity check — MEANINGFUL.",
      hint: "Checkbox off then Run.",
      setup: function (api) {
        api.patchState({ antecedentAlways0: false });
        runCheck(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "MEANINGFUL" && !s.antecedentAlways0;
      },
    },
    {
      id: "ran-flag",
      prompt: "After any Run, ran is true and verdict is set.",
      hint: "Run vacuity check.",
      setup: function (api) {
        runCheck(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.ran && (s.verdict === "VACUOUS_PASS" || s.verdict === "MEANINGFUL");
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-vac",
      type: "quiz",
      prompt: "Vacuity means the property…",
      choices: ["never meaningfully triggered", "always fails", "proves liveness", "runs pytest"],
      answer: "never meaningfully triggered",
      hint: "Empty check.",
    },
    {
      id: "quiz-imp",
      type: "quiz",
      prompt: "a|->b is false only when…",
      choices: ["a true and b false", "a false", "b true", "Git dirty"],
      answer: "a true and b false",
      hint: "Implication truth table.",
    },
    {
      id: "quiz-ant",
      type: "quiz",
      prompt: "If a is always 0, a|->b is…",
      choices: ["vacuously true", "always false", "syntax error", "cover hit"],
      answer: "vacuously true",
      hint: "Antecedent never fires.",
    },
    {
      id: "quiz-cover",
      type: "quiz",
      prompt: "cover helps detect…",
      choices: ["unreachable antecedents/scenarios", "Git merges", "clock period", "pytest version"],
      answer: "unreachable antecedents/scenarios",
      hint: "Reachability.",
    },
    {
      id: "quiz-false-green",
      type: "quiz",
      prompt: "Vacuous PASS is dangerous because…",
      choices: ["sign-off looks green without checking b", "it fails synthesis", "it stops Git", "it deletes RTL"],
      answer: "sign-off looks green without checking b",
      hint: "False confidence.",
    },
    {
      id: "quiz-assume",
      type: "quiz",
      prompt: "Over-assume can make antecedent…",
      choices: ["unreachable in proof", "always true in sim", "Git clean", "pytest fast"],
      answer: "unreachable in proof",
      hint: "Env too tight.",
    },
    {
      id: "quiz-formal",
      type: "quiz",
      prompt: "Formal tools may report…",
      choices: ["vacuity warnings", "only Git status", "only font", "pytest plugins"],
      answer: "vacuity warnings",
      hint: "Tool feature.",
    },
    {
      id: "quiz-sva",
      type: "quiz",
      prompt: "|-> is…",
      choices: ["overlapping implication", "concatenation", "Git merge", "clock edge"],
      answer: "overlapping implication",
      hint: "SVA operator.",
    },
    {
      id: "quiz-meaning",
      type: "quiz",
      prompt: "MEANINGFUL here means…",
      choices: ["antecedent can occur", "proof finished", "Git pushed", "cover deleted"],
      answer: "antecedent can occur",
      hint: "a can be 1.",
    },
    {
      id: "quiz-debug",
      type: "quiz",
      prompt: "Fix vacuity by…",
      choices: ["relaxing assumes or fixing antecedent", "deleting consequent always", "ignoring cover", "Git reset --hard"],
      answer: "relaxing assumes or fixing antecedent",
      hint: "Reach antecedent.",
    },
    {
      id: "quiz-sim",
      type: "quiz",
      prompt: "Sim may hit antecedent while formal vacuous if…",
      choices: ["formal env over-constrained", "Git offline", "clock stopped", "pytest skipped"],
      answer: "formal env over-constrained",
      hint: "Assume mismatch.",
    },
    {
      id: "quiz-liveness",
      type: "quiz",
      prompt: "Vacuous liveness cover differs from…",
      choices: ["vacuous safety assert pass", "Git clone", "BMC k", "cocotb clock"],
      answer: "vacuous safety assert pass",
      hint: "Cover vs assert.",
    },
    {
      id: "quiz-review",
      type: "quiz",
      prompt: "Sign-off review should include…",
      choices: ["vacuity and cover reports", "only green asserts", "Git author", "CSS theme"],
      answer: "vacuity and cover reports",
      hint: "Quality gates.",
    },
    {
      id: "quiz-witness",
      type: "quiz",
      prompt: "Cover witness shows…",
      choices: ["scenario is reachable", "vacuity always", "Git conflict", "BMC bound only"],
      answer: "scenario is reachable",
      hint: "Hit trace.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Production vacuity checks run in…",
      choices: ["formal/sim tools locally", "browser sketch only", "Git hook only", "README only"],
      answer: "formal/sim tools locally",
      hint: "Offline.",
    },
    {
      id: "quiz-conc",
      type: "quiz",
      prompt: "Concurrent a|->b##1 c spans…",
      choices: ["time relationships", "Git branches", "pytest marks", "only vacuity"],
      answer: "time relationships",
      hint: "Temporal SVA.",
    },
    {
      id: "quiz-read",
      type: "quiz",
      prompt: "Reading vacuity report before tape-out prevents…",
      choices: ["shipping unverified properties", "all simulation", "Git init", "clock start"],
      answer: "shipping unverified properties",
      hint: "Quality risk.",
    },
  ];

  DDVConceptLab.mount({
    id: "formal-vacuity",
    rootId: "fvac-root",
    starterHtml:
      "<p><strong>Starter example:</strong> <code>a |-> b</code> with antecedent <code>a</code> always 0 → <strong>VACUOUS_PASS</strong>.</p>",
    ideas: [
      { h3: "Implication", p: "a|->b fails only when a is true and b is false." },
      { h3: "Vacuous", p: "If a never true, the property passes without testing b." },
      { h3: "False green", p: "VACUOUS_PASS can look like success but checks nothing." },
      { h3: "cover", p: "Use cover / reachability to prove antecedent can occur." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
