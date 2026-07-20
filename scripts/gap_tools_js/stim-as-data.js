(function () {
  "use strict";

  var STARTER_JSON = JSON.stringify(
    [
      { a: 0, b: 0, y: 0 },
      { a: 0, b: 1, y: 0 },
      { a: 1, b: 0, y: 0 },
      { a: 1, b: 1, y: 1 },
    ],
    null,
    2
  );

  function parseVectors(text) {
    try {
      var arr = JSON.parse(text);
      if (!Array.isArray(arr)) return { ok: false, err: "Root must be a list" };
      return { ok: true, vectors: arr };
    } catch (e) {
      return { ok: false, err: String(e.message || e) };
    }
  }

  function applyAll(vectors) {
    var rows = [];
    var allPass = true;
    for (var i = 0; i < vectors.length; i++) {
      var v = vectors[i];
      var a = Number(v.a) & 1;
      var b = Number(v.b) & 1;
      var expect = a & b;
      var y = Number(v.y) & 1;
      var pass = y === expect;
      if (!pass) allPass = false;
      rows.push({ i: i, a: a, b: b, y: y, expect: expect, pass: pass });
    }
    return { rows: rows, verdict: allPass ? "PASS" : "FAIL", count: vectors.length };
  }

  function makeStarter() {
    var r = applyAll(JSON.parse(STARTER_JSON));
    return {
      preset: "starter",
      lastAction: "starter",
      jsonText: STARTER_JSON,
      rows: r.rows,
      verdict: r.verdict,
      count: r.count,
      error: "",
    };
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Stimulus table (AND gate)</h3>" +
      '<div class="lab-field" style="margin-bottom:.65rem"><label>vectors JSON</label>' +
      '<textarea id="sad-json" rows="8" style="width:100%;min-width:12rem"></textarea></div>' +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="sad-apply">Apply all</button>' +
      '<button type="button" class="btn btn-ghost" id="sad-bad">Insert bad row</button>' +
      "</div>" +
      '<div id="verdict" class="verdict idle">Idle</div>' +
      '<div class="table-box" id="sad-table">No rows yet.</div>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Python sketch</h3>" +
      '<pre class="code-box">vectors = [\n  {"a":0,"b":0,"y":0}, ...\n]\nfor v in vectors:\n    assert v["y"] == v["a"] & v["b"]</pre>' +
      "</div></div>";

    document.getElementById("sad-apply").addEventListener("click", function () {
      var text = document.getElementById("sad-json").value;
      var parsed = parseVectors(text);
      if (!parsed.ok) {
        api.patchState({
          jsonText: text,
          error: parsed.err,
          verdict: "ERROR",
          rows: [],
          lastAction: "apply",
        });
        return;
      }
      var r = applyAll(parsed.vectors);
      api.patchState({
        jsonText: text,
        rows: r.rows,
        verdict: r.verdict,
        count: r.count,
        error: "",
        lastAction: "apply",
      });
    });
    document.getElementById("sad-bad").addEventListener("click", function () {
      var parsed = parseVectors(document.getElementById("sad-json").value);
      var vecs = parsed.ok ? parsed.vectors.slice() : JSON.parse(STARTER_JSON);
      if (vecs.length) vecs[0] = { a: 1, b: 1, y: 0 };
      var text = JSON.stringify(vecs, null, 2);
      document.getElementById("sad-json").value = text;
      var r = applyAll(vecs);
      api.patchState({
        jsonText: text,
        rows: r.rows,
        verdict: r.verdict,
        count: r.count,
        error: "",
        lastAction: "bad",
      });
    });
  }

  function renderLab(state) {
    var ta = document.getElementById("sad-json");
    if (ta && document.activeElement !== ta) ta.value = state.jsonText || STARTER_JSON;

    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "PASS") cls += "yes";
      else if (state.verdict === "FAIL") cls += "no";
      else if (state.verdict === "ERROR") cls += "warn";
      else cls += "idle";
      v.className = cls;
      var msg = state.error || state.verdict + " — " + (state.count || 0) + " vector(s)";
      v.textContent = msg;
    }

    var tbl = document.getElementById("sad-table");
    if (!tbl) return;
    if (!state.rows || !state.rows.length) {
      tbl.textContent = state.error || "No rows yet.";
      return;
    }
    var html =
      '<table class="role-table"><thead><tr><th>#</th><th>a</th><th>b</th><th>y</th><th>a&amp;b</th><th>ok</th></tr></thead><tbody>';
    for (var i = 0; i < state.rows.length; i++) {
      var row = state.rows[i];
      html +=
        "<tr><td>" +
        row.i +
        "</td><td>" +
        row.a +
        "</td><td>" +
        row.b +
        "</td><td>" +
        row.y +
        "</td><td>" +
        row.expect +
        '</td><td class="' +
        (row.pass ? "yes" : "no") +
        '">' +
        (row.pass ? "PASS" : "FAIL") +
        "</td></tr>";
    }
    html += "</tbody></table>";
    tbl.innerHTML = html;
  }

  function literacy(state) {
    return (
      "vectors = " +
      (state.jsonText || STARTER_JSON).split("\n")[0] +
      "...\n# Apply all → " +
      (state.verdict || "idle")
    );
  }

  var baseChallenges = [
    {
      id: "starter-four",
      prompt: "Starter: four AND vectors — Apply all → PASS on every row.",
      hint: "Load starter; all y match a&b.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && s.count === 4;
      },
    },
    {
      id: "bad-row-fail",
      prompt: "Click Insert bad row — at least one row FAIL, verdict FAIL.",
      hint: "Bad row button forces 1&1→y=0.",
      check: function (api) {
        var s = api.getState();
        if (s.verdict !== "FAIL") return false;
        for (var i = 0; i < (s.rows || []).length; i++) {
          if (!s.rows[i].pass) return true;
        }
        return false;
      },
    },
    {
      id: "fix-and-pass",
      prompt: "Fix the bad row so y=1 for a=1,b=1, Apply all → PASS.",
      hint: "Edit JSON y field to 1.",
      setup: function (api) {
        var vecs = JSON.parse(STARTER_JSON);
        vecs[3].y = 1;
        var r = applyAll(vecs);
        api.patchState({
          jsonText: JSON.stringify(vecs, null, 2),
          rows: r.rows,
          verdict: r.verdict,
          count: r.count,
          lastAction: "fix",
        });
      },
      check: function (api) {
        return api.getState().verdict === "PASS";
      },
    },
    {
      id: "add-vector",
      prompt: "Add a fifth vector {a:1,b:0,y:0}, Apply all — still PASS.",
      hint: "Append to JSON list.",
      setup: function (api) {
        var vecs = JSON.parse(STARTER_JSON);
        vecs.push({ a: 1, b: 0, y: 0 });
        var r = applyAll(vecs);
        api.patchState({
          jsonText: JSON.stringify(vecs, null, 2),
          rows: r.rows,
          verdict: r.verdict,
          count: r.count,
          lastAction: "add",
        });
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && s.count === 5;
      },
    },
    {
      id: "invalid-json",
      prompt: "Enter invalid JSON, Apply all — verdict ERROR.",
      hint: "Break syntax e.g. trailing comma.",
      setup: function (api) {
        api.patchState({
          jsonText: "[{a:0",
          error: "parse error",
          verdict: "ERROR",
          rows: [],
          lastAction: "invalid",
        });
      },
      check: function (api) {
        return api.getState().verdict === "ERROR";
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-data",
      type: "quiz",
      prompt: "Stimulus-as-data means test inputs live in…",
      choices: ["tables/lists you can diff and reuse", "only GUI clicks", "synthesis constraints", "vacuity reports"],
      answer: "tables/lists you can diff and reuse",
      hint: "Structured vectors.",
    },
    {
      id: "quiz-and",
      type: "quiz",
      prompt: "For AND, expected y equals…",
      choices: ["a & b", "a | b", "a ^ b", "~a"],
      answer: "a & b",
      hint: "Bitwise AND.",
    },
    {
      id: "quiz-loop",
      type: "quiz",
      prompt: "A Python for-loop over vectors replaces…",
      choices: ["copy-pasting one test per row", "formal induction", "BMC bounds", "Git stash"],
      answer: "copy-pasting one test per row",
      hint: "DRY table tests.",
    },
    {
      id: "quiz-json",
      type: "quiz",
      prompt: "JSON lists in labs stand in for…",
      choices: ["Python list literals in real tests", "Verilog always blocks only", "FPGA bitstreams", "waveform VCD binary"],
      answer: "Python list literals in real tests",
      hint: "Same structure.",
    },
    {
      id: "quiz-csv",
      type: "quiz",
      prompt: "CSV or YAML stimulus files serve the same role as…",
      choices: ["in-code vector tables", "only comments", "only cover points", "only assume properties"],
      answer: "in-code vector tables",
      hint: "Externalized data.",
    },
    {
      id: "quiz-random",
      type: "quiz",
      prompt: "Constrained-random still compares results against…",
      choices: ["checkers / scoreboards", "nothing ever", "only CSS", "Git remotes"],
      answer: "checkers / scoreboards",
      hint: "Golden or SB.",
    },
    {
      id: "quiz-directed",
      type: "quiz",
      prompt: "Directed tables excel at…",
      choices: ["corner cases you must hit", "replacing all randomness always", "vacuity proofs", "clock generation"],
      answer: "corner cases you must hit",
      hint: "Known corners.",
    },
    {
      id: "quiz-assert-row",
      type: "quiz",
      prompt: "Per-row assert v['y'] == a&b is a…",
      choices: ["self-check on each stimulus row", "formal cover point", "assume on reset", "BMC bound"],
      answer: "self-check on each stimulus row",
      hint: "Row-level check.",
    },
    {
      id: "quiz-regress",
      type: "quiz",
      prompt: "Checking in stimulus tables helps…",
      choices: ["regressions stay reproducible", "hide bugs", "skip simulation", "vacuous passes"],
      answer: "regressions stay reproducible",
      hint: "Versioned vectors.",
    },
    {
      id: "quiz-cocotb",
      type: "quiz",
      prompt: "cocotb can drive the same vectors via…",
      choices: ["Python loops and await Timer/RisingEdge", "only formal BMC", "only synthesis", "only git grep"],
      answer: "Python loops and await Timer/RisingEdge",
      hint: "Python TB.",
    },
    {
      id: "quiz-width",
      type: "quiz",
      prompt: "Single-bit a,b,y in the lab maps to…",
      choices: ["width-1 logic in RTL", "64-bit floats only", "analog voltage", "Git SHA"],
      answer: "width-1 logic in RTL",
      hint: "Binary signals.",
    },
    {
      id: "quiz-fail-fast",
      type: "quiz",
      prompt: "Apply all failing on row 0 means…",
      choices: ["stop or flag before trusting later rows", "all rows are vacuous", "induction proved", "clock stopped"],
      answer: "stop or flag before trusting later rows",
      hint: "First failure matters.",
    },
    {
      id: "quiz-param",
      type: "quiz",
      prompt: "pytest parametrize is similar to…",
      choices: ["one test function, many vector rows", "only one vector ever", "formal vacuity", "scoreboard pop"],
      answer: "one test function, many vector rows",
      hint: "Table-driven.",
    },
    {
      id: "quiz-readme",
      type: "quiz",
      prompt: "Documenting vector meaning in README helps…",
      choices: ["teammates interpret a,b,y fields", "delete waves", "skip lint", "force vacuity"],
      answer: "teammates interpret a,b,y fields",
      hint: "Schema docs.",
    },
    {
      id: "quiz-hdl",
      type: "quiz",
      prompt: "Stimulus-as-data separates what to send from…",
      choices: ["how the testbench applies it", "the laws of physics", "Git history", "BMC k"],
      answer: "how the testbench applies it",
      hint: "Data vs driver code.",
    },
    {
      id: "quiz-offline",
      type: "quiz",
      prompt: "Full simulator runs with real vectors stay…",
      choices: ["local/offline in your flow", "only in browser forever", "vacuous only", "untested"],
      answer: "local/offline in your flow",
      hint: "Real TB.",
    },
    {
      id: "quiz-diff",
      type: "quiz",
      prompt: "Diffing stimulus JSON in Git catches…",
      choices: [" accidental vector edits", "only whitespace in CSS", "FPGA temperature", "induction base"],
      answer: " accidental vector edits",
      hint: "Track table changes.",
    },
  ];

  DDVConceptLab.mount({
    id: "stim-as-data",
    rootId: "stim-as-data-root",
    starterHtml:
      "<p><strong>Starter example:</strong> four AND-gate rows in JSON — <em>Apply all</em> compares each <code>y</code> to <code>a&amp;b</code> → all PASS.</p>",
    ideas: [
      { h3: "Data not code", p: "Keep stimulus in lists you can review, diff, and reuse." },
      { h3: "Self-check loop", p: "For each row: compute expected, assert y matches." },
      { h3: "AND truth", p: "y = a & b for every vector in this lab." },
      { h3: "Fail fast", p: "One bad row makes Apply all report FAIL." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
