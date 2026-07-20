(function () {
  "use strict";

  var STARTER_WAVE = [
    { t: 0, a: 0, b: 0, ok: true },
    { t: 1, a: 1, b: 0, ok: true },
    { t: 2, a: 1, b: 1, ok: true },
    { t: 3, a: 0, b: 1, ok: false },
    { t: 4, a: 1, b: 1, ok: true },
  ];

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      wave: STARTER_WAVE.slice(),
      cursor: 3,
      verdict: "FAIL",
      message: "CEX fails at t=3 (ok=false)",
    };
  }

  function stepCursor(api, delta) {
    var s = api.getState();
    var w = s.wave || [];
    var c = (s.cursor || 0) + delta;
    if (c < 0) c = 0;
    if (c >= w.length) c = w.length - 1;
    var row = w[c];
    var fail = row && !row.ok;
    api.patchState({
      cursor: c,
      verdict: fail ? "FAIL" : "OK",
      message: fail ? "CEX fails at t=" + c + " (ok=false)" : "Step t=" + c + " ok=true",
      lastAction: "step",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Counterexample wave</h3>" +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-ghost" id="fcex-prev">◀ Prev</button>' +
      '<button type="button" class="btn btn-ghost" id="fcex-next">Next ▶</button>' +
      '<button type="button" class="btn btn-secondary" id="fcex-fail">Jump to fail</button>' +
      "</div>" +
      '<div id="verdict" class="verdict no">FAIL</div>' +
      '<div class="wave-row" id="fcex-wave"></div>' +
      '<pre class="log-box" id="fcex-detail">t=3 a=0 b=1 ok=false</pre>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Reading CEX</h3>" +
      '<p class="meta-note">Step the cursor; failing cycle has <code>ok=false</code> — starter cursor at <strong>t=3</strong>.</p>' +
      "</div></div>";

    document.getElementById("fcex-prev").addEventListener("click", function () {
      stepCursor(api, -1);
    });
    document.getElementById("fcex-next").addEventListener("click", function () {
      stepCursor(api, 1);
    });
    document.getElementById("fcex-fail").addEventListener("click", function () {
      var s = api.getState();
      var w = s.wave || [];
      var idx = 0;
      for (var i = 0; i < w.length; i++) {
        if (!w[i].ok) {
          idx = i;
          break;
        }
      }
      api.patchState({
        cursor: idx,
        verdict: "FAIL",
        message: "CEX fails at t=" + idx + " (ok=false)",
        lastAction: "jump",
      });
    });
  }

  function renderLab(state) {
    var w = state.wave || [];
    var c = state.cursor || 0;

    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "FAIL") cls += "no";
      else if (state.verdict === "OK") cls += "yes";
      else cls += "idle";
      v.className = cls;
      v.textContent = (state.verdict || "") + ": " + (state.message || "");
    }

    var wave = document.getElementById("fcex-wave");
    if (wave) {
      wave.innerHTML = "";
      for (var i = 0; i < w.length; i++) {
        var cell = document.createElement("div");
        cell.className = "wave-cell";
        if (i === c) cell.className += " is-cur";
        if (!w[i].ok) cell.className += " is-bad";
        cell.textContent = "t" + w[i].t;
        wave.appendChild(cell);
      }
    }

    var det = document.getElementById("fcex-detail");
    if (det && w[c]) {
      var row = w[c];
      det.textContent = "t=" + row.t + " a=" + row.a + " b=" + row.b + " ok=" + row.ok;
    }
  }

  function literacy(state) {
    var row = (state.wave || [])[state.cursor || 0];
    return (
      "cex_wave[t=" +
      (row ? row.t : "?") +
      "] = {a:" +
      (row ? row.a : "?") +
      ", b:" +
      (row ? row.b : "?") +
      ", ok:" +
      (row ? row.ok : "?") +
      "}"
    );
  }

  var baseChallenges = [
    {
      id: "starter-fail",
      prompt: "Starter: cursor at t=3 — verdict FAIL (ok=false).",
      hint: "Load starter.",
      check: function (api) {
        var s = api.getState();
        return s.cursor === 3 && s.verdict === "FAIL";
      },
    },
    {
      id: "step-prev-ok",
      prompt: "Press Prev to t=2 — verdict OK.",
      hint: "Step before failure.",
      setup: function (api) {
        api.patchState({ cursor: 3 });
        stepCursor(api, -1);
      },
      check: function (api) {
        var s = api.getState();
        return s.cursor === 2 && s.verdict === "OK";
      },
    },
    {
      id: "jump-fail",
      prompt: "From t=0, Jump to fail — cursor lands on t=3.",
      hint: "Jump to fail button.",
      setup: function (api) {
        api.patchState({ cursor: 0, verdict: "OK" });
        document.getElementById("fcex-fail").click();
      },
      check: function (api) {
        return api.getState().cursor === 3 && api.getState().verdict === "FAIL";
      },
    },
    {
      id: "next-after-fail",
      prompt: "At t=3, Next to t=4 — verdict OK again.",
      hint: "Failure is one cycle.",
      setup: function (api) {
        api.patchState({ cursor: 3, verdict: "FAIL" });
        stepCursor(api, 1);
      },
      check: function (api) {
        var s = api.getState();
        return s.cursor === 4 && s.verdict === "OK";
      },
    },
    {
      id: "walk-full",
      prompt: "Step Prev from t=4 back to t=0 — all OK until t=3.",
      hint: "Navigate wave.",
      setup: function (api) {
        api.patchState({ cursor: 4 });
        stepCursor(api, -1);
        stepCursor(api, -1);
      },
      check: function (api) {
        var s = api.getState();
        return s.cursor === 2 && s.verdict === "OK";
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-cex",
      type: "quiz",
      prompt: "A formal counterexample is…",
      choices: ["a time trace showing assert failure", "a coverage hit only", "vacuous pass", "Git diff"],
      answer: "a time trace showing assert failure",
      hint: "Witness wave.",
    },
    {
      id: "quiz-wave",
      type: "quiz",
      prompt: "Stepping a CEX wave helps you…",
      choices: ["see signals cycle-by-cycle", "synthesize design", "run Git", "skip debug"],
      answer: "see signals cycle-by-cycle",
      hint: "Temporal debug.",
    },
    {
      id: "quiz-fail-cycle",
      type: "quiz",
      prompt: "First ok=false cycle is where…",
      choices: ["property first violated", "proof completes", "cover always hits", "clock stops forever"],
      answer: "property first violated",
      hint: "Violation start.",
    },
    {
      id: "quiz-assume",
      type: "quiz",
      prompt: "CEX must respect…",
      choices: ["assumed environment", "only cover", "Git hooks", "pytest marks"],
      answer: "assumed environment",
      hint: "Legal trace.",
    },
    {
      id: "quiz-min",
      type: "quiz",
      prompt: "Tools may minimize CEX to…",
      choices: ["shorter witness trace", "longer random sim", "Git history", "CSS file"],
      answer: "shorter witness trace",
      hint: "Shrink trace.",
    },
    {
      id: "quiz-sim",
      type: "quiz",
      prompt: "Replay CEX in sim can…",
      choices: ["confirm waveform matches formal", "prove vacuity", "replace Git", "delete RTL"],
      answer: "confirm waveform matches formal",
      hint: "Cross-check.",
    },
    {
      id: "quiz-x",
      type: "quiz",
      prompt: "X in a CEX may mean…",
      choices: ["uninitialized or unconstrained state", "proof success", "cover hit", "Git clean"],
      answer: "uninitialized or unconstrained state",
      hint: "Unknown value.",
    },
    {
      id: "quiz-inputs",
      type: "quiz",
      prompt: "Inputs in CEX show…",
      choices: ["stimulus that drove violation", "only outputs", "Git author", "BMC k only"],
      answer: "stimulus that drove violation",
      hint: "Driving side.",
    },
    {
      id: "quiz-multiple",
      type: "quiz",
      prompt: "Multiple CEXes may exist because…",
      choices: ["many paths can violate property", "formal is random only", "Git branches", "vacuity always"],
      answer: "many paths can violate property",
      hint: "Non-unique.",
    },
    {
      id: "quiz-fix",
      type: "quiz",
      prompt: "After CEX debug, RTL or spec fix then…",
      choices: ["re-run formal", "only edit CSS", "delete asserts", "skip review"],
      answer: "re-run formal",
      hint: "Close loop.",
    },
    {
      id: "quiz-bmc-link",
      type: "quiz",
      prompt: "BMC CEX depth relates to…",
      choices: ["bound k when bug found", "Git stars", "cover name", "pytest version"],
      answer: "bound k when bug found",
      hint: "Bounded witness.",
    },
    {
      id: "quiz-cursor",
      type: "quiz",
      prompt: "Wave cursor marks…",
      choices: ["current time step under inspection", "Git HEAD", "vacuity flag", "scoreboard queue"],
      answer: "current time step under inspection",
      hint: "Time index.",
    },
    {
      id: "quiz-ok-col",
      type: "quiz",
      prompt: "ok=false on a row means…",
      choices: ["check failed that cycle", "assume failed syntax", "cover missed", "clock started"],
      answer: "check failed that cycle",
      hint: "Property check.",
    },
    {
      id: "quiz-vcd",
      type: "quiz",
      prompt: "VCD/FST dumps are similar to…",
      choices: ["CEX wave viewers", "Git logs", "pytest config", "Makefile only"],
      answer: "CEX wave viewers",
      hint: "Signal vs time.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Real CEX files come from…",
      choices: ["formal tool export", "browser sketch only", "Git tag", "README typo"],
      answer: "formal tool export",
      hint: "Tool output.",
    },
    {
      id: "quiz-read",
      type: "quiz",
      prompt: "Reading CEX before editing RTL prevents…",
      choices: ["guessing wrong root cause", "all formal runs", "Git clone", "clock generation"],
      answer: "guessing wrong root cause",
      hint: "Evidence first.",
    },
    {
      id: "quiz-fail-after",
      type: "quiz",
      prompt: "ok=true after fail cycle can mean…",
      choices: ["property checked different condition later", "proof of full chip", "vacuity", "no bug ever"],
      answer: "property checked different condition later",
      hint: "Temporal props.",
    },
  ];

  DDVConceptLab.mount({
    id: "formal-counterexample",
    rootId: "fcex-root",
    starterHtml:
      "<p><strong>Starter example:</strong> counterexample wave — cursor on <strong>t=3</strong> where <code>ok=false</code>.</p>",
    ideas: [
      { h3: "CEX trace", p: "Formal tools emit a time-indexed witness when assert fails." },
      { h3: "Step cursor", p: "Walk cycles to see when inputs and ok flip." },
      { h3: "First fail", p: "Starter failure is at t=3 with ok=false." },
      { h3: "Debug loop", p: "Use CEX to fix RTL or constraints, then re-run formal." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
