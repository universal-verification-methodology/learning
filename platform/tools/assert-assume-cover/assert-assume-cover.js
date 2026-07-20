(function () {
  "use strict";

  var ROWS = [
    { id: 0, text: "out == f(in)", role: "assert" },
    { id: 1, text: "reset deasserted", role: "assume" },
    { id: 2, text: "saw opcode 3", role: "cover" },
  ];

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      roles: { 0: "assert", 1: "assume", 2: "cover" },
      scored: true,
      verdict: "PASS",
      score: 3,
      total: 3,
    };
  }

  function scoreRoles(roles) {
    var ok = 0;
    for (var i = 0; i < ROWS.length; i++) {
      if (roles[ROWS[i].id] === ROWS[i].role) ok++;
    }
    return {
      score: ok,
      total: ROWS.length,
      verdict: ok === ROWS.length ? "PASS" : "PARTIAL",
    };
  }

  function checkScore(api) {
    var s = api.getState();
    var r = scoreRoles(s.roles || {});
    api.patchState({
      scored: true,
      score: r.score,
      total: r.total,
      verdict: r.verdict,
      lastAction: "check",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Assert / assume / cover</h3>" +
      '<table class="role-table" id="aac-table">' +
      "<thead><tr><th>Statement</th><th>Role</th></tr></thead>" +
      "<tbody></tbody></table>" +
      '<div class="tool-actions" style="margin-top:.65rem">' +
      '<button type="button" class="btn btn-secondary" id="aac-check">Check roles</button>' +
      "</div>" +
      '<div id="verdict" class="verdict yes">PASS 3/3</div>' +
      '<div class="flag-row" id="aac-flags"></div>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Roles</h3>" +
      "<ul class=\"meta-note\" style=\"margin:0;padding-left:1.1rem\">" +
      "<li><strong>assert</strong> — must hold; failure is a bug.</li>" +
      "<li><strong>assume</strong> — constrain inputs / environment.</li>" +
      "<li><strong>cover</strong> — observe whether a scenario occurred.</li>" +
      "</ul></div></div>";

    var tbody = document.querySelector("#aac-table tbody");
    for (var i = 0; i < ROWS.length; i++) {
      var row = ROWS[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        row.text +
        '</td><td><select data-row="' +
        row.id +
        '">' +
        '<option value="assert">assert</option>' +
        '<option value="assume">assume</option>' +
        '<option value="cover">cover</option>' +
        "</select></td>";
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("select").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var s = api.getState();
        var roles = Object.assign({}, s.roles || {});
        roles[Number(sel.getAttribute("data-row"))] = sel.value;
        api.patchState({ roles: roles, scored: false });
      });
    });

    document.getElementById("aac-check").addEventListener("click", function () {
      checkScore(api);
    });
  }

  function renderLab(state) {
    var roles = state.roles || {};
    document.querySelectorAll("#aac-table select").forEach(function (sel) {
      var id = Number(sel.getAttribute("data-row"));
      if (roles[id]) sel.value = roles[id];
    });

    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "PASS") cls += "yes";
      else if (state.verdict === "PARTIAL") cls += "warn";
      else cls += "idle";
      v.className = cls;
      if (state.scored) {
        v.textContent = state.verdict + " " + state.score + "/" + state.total;
      } else {
        v.textContent = "Not scored — press Check roles";
      }
    }

    var flags = document.getElementById("aac-flags");
    if (flags) {
      flags.innerHTML = "";
      for (var i = 0; i < ROWS.length; i++) {
        var r = ROWS[i];
        var chosen = roles[r.id];
        var f = document.createElement("span");
        f.className = "flag " + (chosen === r.role ? "is-ok" : chosen ? "is-bad" : "");
        f.textContent = r.text + " → " + (chosen || "?");
        flags.appendChild(f);
      }
    }
  }

  function literacy(state) {
    return (
      "assert property (out == f(in));\n" +
      "assume property (reset_deasserted);\n" +
      "cover property (saw_opcode_3);\n" +
      "# score " +
      (state.score != null ? state.score : "—") +
      "/" +
      (state.total || 3)
    );
  }

  var baseChallenges = [
    {
      id: "starter-correct",
      prompt: "Starter: three statements correctly tagged — Check roles → PASS 3/3.",
      hint: "Load starter; run Check.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && s.score === 3;
      },
    },
    {
      id: "swap-fail",
      prompt: "Swap assert and assume on row 0/1, Check — not PASS 3/3.",
      hint: "Change selects then Check.",
      setup: function (api) {
        api.patchState({
          roles: { 0: "assume", 1: "assert", 2: "cover" },
          scored: false,
        });
        checkScore(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.scored && s.score < 3;
      },
    },
    {
      id: "fix-pass",
      prompt: "Restore correct roles, Check — PASS 3/3 again.",
      hint: "out==f(in) assert; reset assume; opcode cover.",
      setup: function (api) {
        api.patchState({
          roles: { 0: "assert", 1: "assume", 2: "cover" },
        });
        checkScore(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && s.score === 3;
      },
    },
    {
      id: "cover-wrong",
      prompt: "Set opcode row to assert, Check — score drops.",
      hint: "cover is not assert.",
      setup: function (api) {
        api.patchState({
          roles: { 0: "assert", 1: "assume", 2: "assert" },
        });
        checkScore(api);
      },
      check: function (api) {
        return api.getState().score === 2;
      },
    },
    {
      id: "all-assume",
      prompt: "Set all three to assume, Check — score 1/3 (only reset line).",
      hint: "Only middle statement is assume in key.",
      setup: function (api) {
        api.patchState({
          roles: { 0: "assume", 1: "assume", 2: "assume" },
        });
        checkScore(api);
      },
      check: function (api) {
        return api.getState().score === 1;
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-assert",
      type: "quiz",
      prompt: "assert property failure means…",
      choices: ["design or bug vs spec", "input constraint only", "scenario was seen", "vacuous pass"],
      answer: "design or bug vs spec",
      hint: "Must hold.",
    },
    {
      id: "quiz-assume",
      type: "quiz",
      prompt: "assume restricts…",
      choices: ["legal input/environment scenarios", "only cover points", "only Git", "BMC k"],
      answer: "legal input/environment scenarios",
      hint: "Constrain world.",
    },
    {
      id: "quiz-cover",
      type: "quiz",
      prompt: "cover asks whether…",
      choices: ["a scenario occurred during sim/formal", "DUT is syntactically valid", "Git is clean", "clock period is 0"],
      answer: "a scenario occurred during sim/formal",
      hint: "Observability.",
    },
    {
      id: "quiz-sva",
      type: "quiz",
      prompt: "SystemVerilog assert/assume/cover live in…",
      choices: ["properties and verification layers", "only synthesis", "only Git", "only pytest"],
      answer: "properties and verification layers",
      hint: "SVA.",
    },
    {
      id: "quiz-formal-a",
      type: "quiz",
      prompt: "In formal, assert is proof…",
      choices: ["obligation", "environment only", "coverage hit", "vacuity"],
      answer: "obligation",
      hint: "Must prove.",
    },
    {
      id: "quiz-formal-u",
      type: "quiz",
      prompt: "In formal, assume becomes…",
      choices: ["environment constraint", "coverage", "Git hook", "clock generator"],
      answer: "environment constraint",
      hint: "Legal inputs.",
    },
    {
      id: "quiz-sim",
      type: "quiz",
      prompt: "In simulation, cover may increment…",
      choices: ["coverage counters", "BMC depth", "Git stars", "queue depth only"],
      answer: "coverage counters",
      hint: "Hit bin.",
    },
    {
      id: "quiz-reset",
      type: "quiz",
      prompt: "reset deasserted is usually an…",
      choices: ["assume on environment", "assert on output opcode", "cover on bug", "vacuity"],
      answer: "assume on environment",
      hint: "Env constraint.",
    },
    {
      id: "quiz-func",
      type: "quiz",
      prompt: "out == f(in) checks…",
      choices: ["functional correctness", "only reset phase", "only Git merge", "only vacuity"],
      answer: "functional correctness",
      hint: "Data transform.",
    },
    {
      id: "quiz-opcode",
      type: "quiz",
      prompt: "saw opcode 3 is classic…",
      choices: ["cover / coverage", "assume on reset", "assert on clk", "BMC bound"],
      answer: "cover / coverage",
      hint: "Did we see it?",
    },
    {
      id: "quiz-overassume",
      type: "quiz",
      prompt: "Over-constraining with assume can…",
      choices: ["hide real bugs (false proof)", "guarantee FPGA works", "fix synthesis", "run pytest"],
      answer: "hide real bugs (false proof)",
      hint: "Too narrow env.",
    },
    {
      id: "quiz-undercover",
      type: "quiz",
      prompt: "Missing cover points mean…",
      choices: ["gaps in observability", "formal vacuity always", "Git failure", "clock stop"],
      answer: "gaps in observability",
      hint: "Uncovered scenarios.",
    },
    {
      id: "quiz-imm",
      type: "quiz",
      prompt: "immediate assert in RTL fires on…",
      choices: ["sim violation that cycle", "only after synthesis", "Git push", "BMC only"],
      answer: "sim violation that cycle",
      hint: "Sim check.",
    },
    {
      id: "quiz-conc",
      type: "quiz",
      prompt: "concurrent assert spans…",
      choices: ["time / cycles", "only one line of Python", "Git diff", "CSS only"],
      answer: "time / cycles",
      hint: "Temporal.",
    },
    {
      id: "quiz-bind",
      type: "quiz",
      prompt: "bind SVA module attaches props…",
      choices: ["into DUT hierarchy", "only to Git", "only to cocotb", "only to vacuity"],
      answer: "into DUT hierarchy",
      hint: "Hierarchy hook.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Full SVA runs in…",
      choices: ["simulator / formal tools locally", "browser only forever", "README only", "Git hook only"],
      answer: "simulator / formal tools locally",
      hint: "Offline tools.",
    },
    {
      id: "quiz-role",
      type: "quiz",
      prompt: "Mis-tagging cover as assert would…",
      choices: ["treat observability as mandatory proof", "relax proof", "run Git", "start clock"],
      answer: "treat observability as mandatory proof",
      hint: "Wrong severity.",
    },
  ];

  DDVConceptLab.mount({
    id: "assert-assume-cover",
    rootId: "aac-root",
    starterHtml:
      "<p><strong>Starter example:</strong> <code>out==f(in)</code> → assert, <code>reset deasserted</code> → assume, <code>saw opcode 3</code> → cover. Check roles → <strong>PASS 3/3</strong>.</p>",
    ideas: [
      { h3: "assert", p: "Must hold — failure indicates a bug or spec violation." },
      { h3: "assume", p: "Constrains inputs or environment for legal scenarios." },
      { h3: "cover", p: "Tracks whether interesting scenarios occurred." },
      { h3: "Tag correctly", p: "Wrong role changes proof vs coverage meaning." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
