(function () {
  "use strict";

  function parseHex(s) {
    var t = String(s).trim();
    if (!t) return null;
    if (t.toLowerCase().indexOf("0x") === 0) t = t.slice(2);
    var n = parseInt(t, 16);
    return isNaN(n) ? null : n;
  }

  function hexStr(n) {
    return "0x" + n.toString(16).toUpperCase();
  }

  function normHex(s) {
    return String(s).trim().toLowerCase().replace(/^0x/, "");
  }

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      expect: "0xA5",
      actual: "0xA5",
      verdict: "PASS",
      message: "expect 0xA5 == actual 0xA5",
      ran: true,
    };
  }

  function runAssert(api) {
    var s = api.getState();
    var e = parseHex(s.expect);
    var a = parseHex(s.actual);
    if (e === null || a === null) {
      api.patchState({
        verdict: "ERROR",
        message: "Invalid hex in expect or actual",
        ran: true,
        lastAction: "run",
      });
      return;
    }
    var match = normHex(s.expect) === normHex(s.actual) || e === a;
    api.patchState({
      verdict: match ? "PASS" : "FAIL",
      message: match
        ? "expect " + s.expect + " == actual " + s.actual
        : "AssertionError: expected " + s.expect + ", got " + s.actual,
      ran: true,
      lastAction: "run",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      '<h3>pytest-style assert</h3>' +
      '<div class="lab-controls">' +
      '<div class="lab-field"><label>expect</label><input id="pa-expect" type="text" value="0xA5"></div>' +
      '<div class="lab-field"><label>actual</label><input id="pa-actual" type="text" value="0xA5"></div>' +
      '</div>' +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="pa-run">Run assert</button>' +
      '<button type="button" class="btn btn-ghost" id="pa-mismatch">Mismatch: 0xA5 vs 0x5A</button>' +
      '</div>' +
      '<div id="verdict" class="verdict idle">Idle</div>' +
      '<pre class="log-box" id="pa-log">Ready.</pre>' +
      '</div>' +
      '<div class="panel-box">' +
      '<h3>Literacy note</h3>' +
      '<p class="meta-note">Compare is case-insensitive on hex strings (<code>0xa5</code> matches <code>0xA5</code>).</p>' +
      '</div></div>';

    document.getElementById("pa-run").addEventListener("click", function () {
      api.patchState({
        expect: document.getElementById("pa-expect").value,
        actual: document.getElementById("pa-actual").value,
      });
      runAssert(api);
    });
    document.getElementById("pa-mismatch").addEventListener("click", function () {
      api.patchState({
        expect: "0xA5",
        actual: "0x5A",
        lastAction: "mismatch",
      });
      runAssert(api);
    });
    document.getElementById("pa-expect").addEventListener("change", function () {
      api.patchState({ expect: document.getElementById("pa-expect").value });
    });
    document.getElementById("pa-actual").addEventListener("change", function () {
      api.patchState({ actual: document.getElementById("pa-actual").value });
    });
  }

  function renderLab(state) {
    var exp = document.getElementById("pa-expect");
    var act = document.getElementById("pa-actual");
    if (exp && document.activeElement !== exp) exp.value = state.expect || "";
    if (act && document.activeElement !== act) act.value = state.actual || "";

    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "PASS") cls += "yes";
      else if (state.verdict === "FAIL") cls += "no";
      else if (state.verdict === "ERROR") cls += "warn";
      else cls += "idle";
      v.className = cls;
      v.textContent = state.verdict ? state.verdict + ": " + (state.message || "") : "Idle";
    }
    var log = document.getElementById("pa-log");
    if (log) log.textContent = state.ran ? state.message || "" : "Ready.";
  }

  function literacy(state) {
    return (
      "def test_byte():\n" +
      "    actual = dut.read()\n" +
      "    assert actual == " +
      (state.expect || "0xA5") +
      "  # " +
      (state.verdict || "idle")
    );
  }

  var baseChallenges = [
    {
      id: "starter-pass",
      prompt: "Starter: both expect and actual are 0xA5 — verdict should be PASS.",
      hint: "Load starter example.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && normHex(s.expect) === "a5" && normHex(s.actual) === "a5";
      },
    },
    {
      id: "run-mismatch",
      prompt: "Click Mismatch (0xA5 vs 0x5A) — verdict should be FAIL.",
      hint: "Use the Mismatch button.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "FAIL" && normHex(s.expect) === "a5" && normHex(s.actual) === "5a";
      },
    },
    {
      id: "case-insensitive",
      prompt: "Set expect to 0xa5 and actual to 0xA5, Run assert — PASS (case-insensitive).",
      hint: "Lowercase vs uppercase hex.",
      setup: function (api) {
        api.patchState({ expect: "0xa5", actual: "0xA5" });
        runAssert(api);
      },
      check: function (api) {
        return api.getState().verdict === "PASS";
      },
    },
    {
      id: "custom-fail",
      prompt: "Set expect 0xFF, actual 0x00, Run assert — FAIL.",
      hint: "Different values.",
      setup: function (api) {
        api.patchState({ expect: "0xFF", actual: "0x00" });
        runAssert(api);
      },
      check: function (api) {
        return api.getState().verdict === "FAIL";
      },
    },
    {
      id: "recover-pass",
      prompt: "After a fail, set both to 0x5A and Run assert — PASS.",
      hint: "Fix actual to match expect.",
      setup: function (api) {
        api.patchState({ expect: "0x5A", actual: "0x5A" });
        runAssert(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && normHex(s.expect) === "5a";
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-assert",
      type: "quiz",
      prompt: "pytest assert compares expected vs actual and raises…",
      choices: ["AssertionError on mismatch", "SyntaxError always", "ImportError", "KeyboardInterrupt"],
      answer: "AssertionError on mismatch",
      hint: "Failed assert stops the test.",
    },
    {
      id: "quiz-golden",
      type: "quiz",
      prompt: "A golden / reference value in HW tests is usually…",
      choices: ["known-good expected output", "random seed only", "synthesis constraint", "Git branch name"],
      answer: "known-good expected output",
      hint: "Compare DUT output to reference.",
    },
    {
      id: "quiz-hex",
      type: "quiz",
      prompt: "0xA5 and 0xa5 represent the same byte because hex is…",
      choices: ["case-insensitive for digits A–F", "always signed", "BCD encoded", "vacuous"],
      answer: "case-insensitive for digits A–F",
      hint: "Literals differ only by case.",
    },
    {
      id: "quiz-pytest-run",
      type: "quiz",
      prompt: "Running pytest on a failing assert typically marks the test…",
      choices: ["FAILED", "PASSED", "SKIPPED forever", "compiled to bitstream"],
      answer: "FAILED",
      hint: "Non-zero exit / failed status.",
    },
    {
      id: "quiz-actual",
      type: "quiz",
      prompt: "In assert expected == actual, actual is usually…",
      choices: ["what the DUT or function returned", "the clock period", "the Makefile target", "the UVM factory"],
      answer: "what the DUT or function returned",
      hint: "Observed result.",
    },
    {
      id: "quiz-self-check",
      type: "quiz",
      prompt: "Self-checking tests compare outputs automatically instead of…",
      choices: ["manual waveform eyeballing only", "deleting the repo", "disabling clocks", "vacuity proofs"],
      answer: "manual waveform eyeballing only",
      hint: "Automation vs human scan.",
    },
    {
      id: "quiz-regression",
      type: "quiz",
      prompt: "Regression runs re-execute tests to catch…",
      choices: ["new bugs from recent changes", "only syntax highlighting", "FPGA placement only", "Git merge conflicts in CSS"],
      answer: "new bugs from recent changes",
      hint: "Repeat suite after edits.",
    },
    {
      id: "quiz-parametrize",
      type: "quiz",
      prompt: "pytest parametrize runs the same test over…",
      choices: ["multiple input tuples", "only one fixed vector", "synthesis reports", "formal vacuity"],
      answer: "multiple input tuples",
      hint: "Table-driven tests.",
    },
    {
      id: "quiz-exit",
      type: "quiz",
      prompt: "CI often fails the job when any pytest test…",
      choices: ["fails", "prints hello", "uses a comment", "reads README"],
      answer: "fails",
      hint: "Red build on failure.",
    },
    {
      id: "quiz-message",
      type: "quiz",
      prompt: "A good assert failure message shows…",
      choices: ["expected vs got values", "only pass/fail bit", "random UUID", "toolchain license"],
      answer: "expected vs got values",
      hint: "Debuggable diff.",
    },
    {
      id: "quiz-fixture",
      type: "quiz",
      prompt: "pytest fixtures often supply…",
      choices: ["shared setup like DUT handles", "only CSS themes", "vacuous antecedents", "BMC depth k"],
      answer: "shared setup like DUT handles",
      hint: "Reusable test context.",
    },
    {
      id: "quiz-xfail",
      type: "quiz",
      prompt: "@pytest.mark.xfail marks a test expected to…",
      choices: ["fail for a known reason", "run formal induction", "synthesize always", "skip pytest entirely"],
      answer: "fail for a known reason",
      hint: "Known broken behavior.",
    },
    {
      id: "quiz-cap",
      type: "quiz",
      prompt: "capfd in pytest can capture…",
      choices: ["stdout/stderr from the test", "only waveforms", "only Git tags", "only cocotb edges"],
      answer: "stdout/stderr from the test",
      hint: "Console output.",
    },
    {
      id: "quiz-approx",
      type: "quiz",
      prompt: "For floats, pytest.approx helps compare with…",
      choices: ["tolerance instead of exact bits", "vacuity", "induction base", "scoreboard queue"],
      answer: "tolerance instead of exact bits",
      hint: "Almost equal.",
    },
    {
      id: "quiz-order",
      type: "quiz",
      prompt: "Typical self-check flow: stimulate → capture actual → …",
      choices: ["compare to expected", "delete cocotb", "run place-route", "ignore mismatch"],
      answer: "compare to expected",
      hint: "Golden check last.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Browser concept labs teach literacy; full fidelity stays…",
      choices: ["local pytest + simulator", "only in the PDF", "on the moon", "inside vacuity"],
      answer: "local pytest + simulator",
      hint: "Real runs offline.",
    },
    {
      id: "quiz-bitrev",
      type: "quiz",
      prompt: "0xA5 vs 0x5A often indicates…",
      choices: ["byte/bit order mix-up", "successful induction", "vacuous cover", "clock period 0"],
      answer: "byte/bit order mix-up",
      hint: "Reversed nybbles/bytes.",
    },
  ];

  DDVConceptLab.mount({
    id: "pytest-assert-lab",
    rootId: "pytest-assert-root",
    starterHtml:
      "<p><strong>Starter example:</strong> expect and actual both <code>0xA5</code> — Run assert → <strong>PASS</strong>. Try Mismatch for <code>0xA5</code> vs <code>0x5A</code>.</p>",
    ideas: [
      { h3: "Golden check", p: "Compare DUT output to a known-good expected value." },
      { h3: "assert", p: "pytest stops the test on mismatch with AssertionError." },
      { h3: "Hex literals", p: "0xA5 and 0xa5 are the same byte — compare is case-insensitive." },
      { h3: "Debug hint", p: "Mismatch 0xA5 vs 0x5A often means endian or bit-order confusion." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
