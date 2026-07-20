(function () {
  "use strict";

  function hex(n) {
    return "0x" + (Number(n) & 0xff).toString(16).toUpperCase();
  }

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      expectQueue: [0xa5],
      lastActual: null,
      verdict: "PASS",
      message: "observe 0xA5 matched expect 0xA5 — queue empty",
      log: ["expect pushed 0xA5", "observe 0xA5 → PASS (pop)"],
    };
  }

  function pushExpect(api) {
    var s = api.getState();
    var text = document.getElementById("csb-push-val");
    var v = parseInt(String(text ? text.value : "0xA5").replace(/^0x/i, ""), 16);
    if (isNaN(v)) v = 0;
    var q = (s.expectQueue || []).slice();
    q.push(v);
    var log = (s.log || []).concat(["expect pushed " + hex(v)]);
    api.patchState({ expectQueue: q, log: log, lastAction: "push" });
  }

  function observe(api, actualText) {
    var s = api.getState();
    var v = parseInt(String(actualText).replace(/^0x/i, ""), 16);
    if (isNaN(v)) v = 0;
    var q = (s.expectQueue || []).slice();
    var log = (s.log || []).slice();
    var verdict = "FAIL";
    var message = "";
    if (!q.length) {
      verdict = "FAIL";
      message = "observe " + hex(v) + " but expect queue empty";
      log.push("observe " + hex(v) + " → FAIL (empty queue)");
    } else {
      var exp = q[0];
      if (exp === v) {
        q.shift();
        verdict = q.length ? "PASS" : "PASS";
        message =
          "observe " +
          hex(v) +
          " matched expect " +
          hex(exp) +
          (q.length ? " — " + q.length + " left" : " — queue empty");
        log.push("observe " + hex(v) + " → PASS (pop)");
      } else {
        verdict = "FAIL";
        message = "observe " + hex(v) + " != expect " + hex(exp);
        log.push("observe " + hex(v) + " → FAIL (mismatch)");
      }
    }
    api.patchState({
      expectQueue: q,
      lastActual: v,
      verdict: verdict,
      message: message,
      log: log,
      lastAction: "observe",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Scoreboard sketch</h3>" +
      '<div class="lab-controls">' +
      '<div class="lab-field"><label>push expect</label><input id="csb-push-val" type="text" value="0xA5"></div>' +
      '<div class="lab-field"><label>observe actual</label><input id="csb-obs-val" type="text" value="0xA5"></div>' +
      "</div>" +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="csb-push">Push expect</button>' +
      '<button type="button" class="btn btn-secondary" id="csb-obs">Observe actual</button>' +
      '<button type="button" class="btn btn-ghost" id="csb-mismatch">Mismatch observe 0x5A</button>' +
      "</div>" +
      '<div id="verdict" class="verdict yes">PASS</div>' +
      '<div class="flag-row" id="csb-queue"></div>' +
      '<pre class="log-box" id="csb-log"></pre>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Queue rule</h3>" +
      '<p class="meta-note">Match pops front of expect queue; mismatch or empty queue → FAIL.</p>' +
      "</div></div>";

    document.getElementById("csb-push").addEventListener("click", function () {
      pushExpect(api);
    });
    document.getElementById("csb-obs").addEventListener("click", function () {
      observe(api, document.getElementById("csb-obs-val").value);
    });
    document.getElementById("csb-mismatch").addEventListener("click", function () {
      observe(api, "0x5A");
    });
  }

  function renderLab(state) {
    var v = document.getElementById("verdict");
    if (v) {
      var cls = "verdict ";
      if (state.verdict === "PASS") cls += "yes";
      else if (state.verdict === "FAIL") cls += "no";
      else cls += "idle";
      v.className = cls;
      v.textContent = (state.verdict || "idle") + ": " + (state.message || "");
    }

    var qrow = document.getElementById("csb-queue");
    if (qrow) {
      qrow.innerHTML = "";
      var q = state.expectQueue || [];
      if (!q.length) {
        var empty = document.createElement("span");
        empty.className = "flag";
        empty.textContent = "queue: (empty)";
        qrow.appendChild(empty);
      } else {
        for (var i = 0; i < q.length; i++) {
          var f = document.createElement("span");
          f.className = "flag is-on";
          f.textContent = "expect[" + i + "]=" + hex(q[i]);
          qrow.appendChild(f);
        }
      }
    }

    var log = document.getElementById("csb-log");
    if (log) log.textContent = (state.log || []).join("\n");
  }

  function literacy(state) {
    var q = state.expectQueue || [];
    return (
      "scoreboard.expect(" +
      (q.length ? hex(q[0]) : "—") +
      ")\nactual = " +
      (state.lastActual != null ? hex(state.lastActual) : "—") +
      "\n# " +
      (state.verdict || "")
    );
  }

  var baseChallenges = [
    {
      id: "starter-match",
      prompt: "Starter: expect [0xA5], observe 0xA5 — PASS, queue empty.",
      hint: "Load starter.",
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && (!s.expectQueue || !s.expectQueue.length);
      },
    },
    {
      id: "push-then-match",
      prompt: "Push expect 0x10, observe 0x10 — PASS.",
      hint: "Push then observe same value.",
      setup: function (api) {
        api.patchState({ expectQueue: [], log: [] });
        document.getElementById("csb-push-val").value = "0x10";
        pushExpect(api);
        observe(api, "0x10");
      },
      check: function (api) {
        return api.getState().verdict === "PASS";
      },
    },
    {
      id: "mismatch-fail",
      prompt: "Push 0xA5, observe 0x5A (Mismatch) — FAIL.",
      hint: "Mismatch button.",
      setup: function (api) {
        api.patchState({ expectQueue: [0xa5], log: [] });
        observe(api, "0x5A");
      },
      check: function (api) {
        return api.getState().verdict === "FAIL";
      },
    },
    {
      id: "empty-fail",
      prompt: "With empty queue, observe 0x01 — FAIL.",
      hint: "No expect to match.",
      setup: function (api) {
        api.patchState({ expectQueue: [], log: [] });
        observe(api, "0x01");
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "FAIL" && (!s.expectQueue || !s.expectQueue.length);
      },
    },
    {
      id: "fifo-order",
      prompt: "Push 0x01 then 0x02; observe 0x01 then 0x02 — both PASS, queue empty.",
      hint: "FIFO order matters.",
      setup: function (api) {
        api.patchState({ expectQueue: [], log: [] });
        document.getElementById("csb-push-val").value = "0x01";
        pushExpect(api);
        document.getElementById("csb-push-val").value = "0x02";
        pushExpect(api);
        observe(api, "0x01");
        observe(api, "0x02");
      },
      check: function (api) {
        var s = api.getState();
        return s.verdict === "PASS" && (!s.expectQueue || !s.expectQueue.length);
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-sb",
      type: "quiz",
      prompt: "A scoreboard compares…",
      choices: ["expected vs observed transactions", "only Git branches", "only CSS", "BMC k only"],
      answer: "expected transactions vs observed transactions",
      hint: "Reference model path.",
    },
    {
      id: "quiz-queue",
      type: "quiz",
      prompt: "Expect queue FIFO means first pushed is…",
      choices: ["first matched on observe", "never used", "vacuous", "cover only"],
      answer: "first matched on observe",
      hint: "Queue order.",
    },
    {
      id: "quiz-pop",
      type: "quiz",
      prompt: "Match on observe typically…",
      choices: ["pops the matched expect entry", "clears the DUT", "runs synthesis", "proves induction"],
      answer: "pops the matched expect entry",
      hint: "Consume expect.",
    },
    {
      id: "quiz-ref",
      type: "quiz",
      prompt: "Reference model generates…",
      choices: ["expected outputs for compare", "only random clocks", "vacuity", "Git tags"],
      answer: "expected outputs for compare",
      hint: "Golden stream.",
    },
    {
      id: "quiz-uvm",
      type: "quiz",
      prompt: "UVM scoreboards are the same idea at…",
      choices: ["higher methodology layer", "only analog SPICE", "only lint", "only formal vacuity"],
      answer: "higher methodology layer",
      hint: "Class-based SB.",
    },
    {
      id: "quiz-out-of-order",
      type: "quiz",
      prompt: "Out-of-order DUT may need…",
      choices: ["reorder buffer or flexible compare", "empty queue always", "vacuity", "no expects"],
      answer: "reorder buffer or flexible compare",
      hint: "Ordering policy.",
    },
    {
      id: "quiz-mismatch",
      type: "quiz",
      prompt: "0xA5 vs 0x5A mismatch often triggers…",
      choices: ["test fail / error report", "vacuous pass", "induction proof", "free pass"],
      answer: "test fail / error report",
      hint: "SB error.",
    },
    {
      id: "quiz-cocotb",
      type: "quiz",
      prompt: "cocotb checkers can implement scoreboard…",
      choices: ["in Python with queues/lists", "only in Verilog always", "only formal", "only CSS"],
      answer: "in Python with queues/lists",
      hint: "Python TB.",
    },
    {
      id: "quiz-sticky",
      type: "quiz",
      prompt: "Sticky FAIL means later passes do not…",
      choices: ["hide earlier mismatch", "clear Git", "stop clock", "prove cover"],
      answer: "hide earlier mismatch",
      hint: "Error latching.",
    },
    {
      id: "quiz-exp-empty",
      type: "quiz",
      prompt: "Observe with empty expect queue is usually…",
      choices: ["protocol error / FAIL", "PASS vacuous", "induction", "cover hit"],
      answer: "protocol error / FAIL",
      hint: "Unexpected actual.",
    },
    {
      id: "quiz-model",
      type: "quiz",
      prompt: "Scoreboard separates DUT from…",
      choices: ["reference prediction", "only waveform colors", "Git remotes", "BMC bounds"],
      answer: "reference prediction",
      hint: "Two streams.",
    },
    {
      id: "quiz-delay",
      type: "quiz",
      prompt: "Pipeline latency may require…",
      choices: ["delay expects before compare", "delete observe", "vacuity only", "width 0"],
      answer: "delay expects before compare",
      hint: "Align cycles.",
    },
    {
      id: "quiz-log",
      type: "quiz",
      prompt: "SB logs help debug…",
      choices: ["which expect failed first", "only font size", "FPGA temp", "Git author"],
      answer: "which expect failed first",
      hint: "Trace compare.",
    },
    {
      id: "quiz-multi",
      type: "quiz",
      prompt: "Multiple ports may use…",
      choices: ["separate queues per stream", "one vacuity check", "no compare", "only cover"],
      answer: "separate queues per stream",
      hint: "Per-interface SB.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Production scoreboards run in…",
      choices: ["sim with real transactions", "browser only forever", "vacuity tool only", "Git hook only"],
      answer: "sim with real transactions",
      hint: "Offline sim.",
    },
    {
      id: "quiz-pass",
      type: "quiz",
      prompt: "All expects matched and queue empty → overall…",
      choices: ["PASS", "vacuous", "CEX", "unknown X"],
      answer: "PASS",
      hint: "Clean completion.",
    },
    {
      id: "quiz-byte",
      type: "quiz",
      prompt: "Comparing bytes as hex is like…",
      choices: ["pytest assert on integer values", "formal cover only", "assume reset", "clock period"],
      answer: "pytest assert on integer values",
      hint: "Scalar compare.",
    },
  ];

  // Fix quiz-sb answer to match choices exactly
  quizList[0].answer = "expected vs observed transactions";

  DDVConceptLab.mount({
    id: "cocotb-scoreboard",
    rootId: "cocotb-sb-root",
    starterHtml:
      "<p><strong>Starter example:</strong> expect queue <code>[0xA5]</code>, observe <code>0xA5</code> → <strong>PASS</strong> (pop).</p>",
    ideas: [
      { h3: "Expect queue", p: "Push expected transactions before or as DUT runs." },
      { h3: "Observe", p: "Compare actual sample to front of queue; match pops." },
      { h3: "FIFO", p: "Order matters when multiple expects are pending." },
      { h3: "Mismatch", p: "Wrong actual or empty queue → FAIL." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
