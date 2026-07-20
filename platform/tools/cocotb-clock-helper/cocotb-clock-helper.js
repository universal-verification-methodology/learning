(function () {
  "use strict";

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      periodNs: 10,
      edges: [10, 20, 30],
      started: true,
      verdict: "EDGES",
    };
  }

  function startClock(api) {
    var s = api.getState();
    var p = Number(s.periodNs) || 10;
    if (p <= 0) p = 10;
    var edges = [p, p * 2, p * 3];
    api.patchState({
      periodNs: p,
      edges: edges,
      started: true,
      verdict: "EDGES",
      lastAction: "start",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>Clock helper sketch</h3>" +
      '<div class="lab-controls">' +
      '<div class="lab-field"><label>periodNs</label><input id="cclk-period" type="number" min="1" value="10"></div>' +
      "</div>" +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="cclk-start">Start clock</button>' +
      "</div>" +
      '<div id="verdict" class="verdict idle">Idle</div>' +
      '<pre class="log-box" id="cclk-edges">Edges: —</pre>' +
      '<p class="meta-note">Models <code>Clock(dut.clk, period, units=&quot;ns&quot;).start()</code> — first three posedges.</p>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Timeline</h3>" +
      '<div class="wave-row" id="cclk-wave"></div>' +
      "</div></div>";

    document.getElementById("cclk-start").addEventListener("click", function () {
      api.patchState({ periodNs: Number(document.getElementById("cclk-period").value) || 10 });
      startClock(api);
    });
    document.getElementById("cclk-period").addEventListener("change", function () {
      api.patchState({ periodNs: Number(document.getElementById("cclk-period").value) || 10 });
    });
  }

  function renderLab(state) {
    var inp = document.getElementById("cclk-period");
    if (inp && document.activeElement !== inp) inp.value = state.periodNs || 10;

    var v = document.getElementById("verdict");
    if (v) {
      v.className = "verdict " + (state.started ? "yes" : "idle");
      v.textContent = state.started
        ? "Clock started — period " + state.periodNs + " ns"
        : "Idle — press Start clock";
    }

    var log = document.getElementById("cclk-edges");
    if (log) {
      log.textContent =
        "Edges (ns): " + (state.edges && state.edges.length ? state.edges.join(", ") : "—");
    }

    var wave = document.getElementById("cclk-wave");
    if (wave) {
      wave.innerHTML = "";
      var edges = state.edges || [];
      for (var i = 0; i < edges.length; i++) {
        var cell = document.createElement("div");
        cell.className = "wave-cell";
        cell.textContent = edges[i] + "ns";
        wave.appendChild(cell);
      }
    }
  }

  function literacy(state) {
    return (
      "from cocotb.clock import Clock\n" +
      "Clock(dut.clk, " +
      (state.periodNs || 10) +
      ", units='ns').start()\n" +
      "# edges: " +
      (state.edges || []).join(", ")
    );
  }

  var baseChallenges = [
    {
      id: "starter-edges",
      prompt: "Starter: period 10 — edges list shows 10, 20, 30.",
      hint: "Load starter example.",
      check: function (api) {
        var s = api.getState();
        return s.edges && s.edges.join(",") === "10,20,30";
      },
    },
    {
      id: "start-again",
      prompt: "Press Start clock — started flag and three edges appear.",
      hint: "Start clock button.",
      setup: function (api) {
        api.patchState({ periodNs: 10, edges: [], started: false });
        startClock(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.started && s.edges && s.edges.length === 3;
      },
    },
    {
      id: "period-5",
      prompt: "Set periodNs to 5, Start clock — edges 5, 10, 15.",
      hint: "Change period then start.",
      setup: function (api) {
        api.patchState({ periodNs: 5 });
        startClock(api);
      },
      check: function (api) {
        return api.getState().edges && api.getState().edges.join(",") === "5,10,15";
      },
    },
    {
      id: "period-20",
      prompt: "Set periodNs to 20, Start clock — first edge at 20 ns.",
      hint: "period * 1, * 2, * 3.",
      setup: function (api) {
        api.patchState({ periodNs: 20 });
        startClock(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.edges && s.edges[0] === 20 && s.edges[2] === 60;
      },
    },
    {
      id: "reperiod",
      prompt: "After period 20, change to 10 and Start — edges back to 10,20,30.",
      hint: "Restart updates edge list.",
      setup: function (api) {
        api.patchState({ periodNs: 10 });
        startClock(api);
      },
      check: function (api) {
        return api.getState().edges && api.getState().edges.join(",") === "10,20,30";
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-cocotb",
      type: "quiz",
      prompt: "cocotb Clock.start() typically runs the clock…",
      choices: ["as a background coroutine", "only once at time 0", "in synthesis", "in formal BMC only"],
      answer: "as a background coroutine",
      hint: "Concurrent with tests.",
    },
    {
      id: "quiz-period",
      type: "quiz",
      prompt: "Period 10 ns means one full cycle lasts…",
      choices: ["10 ns (high+low in this sketch)", "1 ns always", "10 ps", "undefined"],
      answer: "10 ns (high+low in this sketch)",
      hint: "Edge spacing.",
    },
    {
      id: "quiz-units",
      type: "quiz",
      prompt: "units='ns' tells cocotb the period is in…",
      choices: ["nanoseconds", "nats", "nodes", "nybbles"],
      answer: "nanoseconds",
      hint: "Time scale.",
    },
    {
      id: "quiz-await",
      type: "quiz",
      prompt: "Tests usually await RisingEdge(dut.clk) to…",
      choices: ["sync to posedge sampling", "run synthesis", "prove vacuity", "pop scoreboard"],
      answer: "sync to posedge sampling",
      hint: "Cycle advance.",
    },
    {
      id: "quiz-timer",
      type: "quiz",
      prompt: "Timer(period/2) often models…",
      choices: ["half-period delay for toggle", "BMC depth", "assume role", "cover hit"],
      answer: "half-period delay for toggle",
      hint: "50% duty sketch.",
    },
    {
      id: "quiz-sim",
      type: "quiz",
      prompt: "Simulation time advances when…",
      choices: ["events/schedulers run (clocks, timers)", "you save HTML", "Git pushes", "lint passes"],
      answer: "events/schedulers run (clocks, timers)",
      hint: "Event-driven sim.",
    },
    {
      id: "quiz-start",
      type: "quiz",
      prompt: "Forgetting Clock.start() often leaves clk…",
      choices: ["stuck at X or constant", "always vacuous", "formally proved", "synthesized"],
      answer: "stuck at X or constant",
      hint: "No toggling.",
    },
    {
      id: "quiz-edge-list",
      type: "quiz",
      prompt: "Listing edges at 10,20,30 helps literacy for…",
      choices: ["when to await posedge", "FPGA placement", "Git merge", "pytest asserts only"],
      answer: "when to await posedge",
      hint: "Sample times.",
    },
    {
      id: "quiz-fallback",
      type: "quiz",
      prompt: "Manual clk <= ~clk in a loop is…",
      choices: ["an alternative to Clock helper", "required for cocotb", "formal only", "illegal in Verilog"],
      answer: "an alternative to Clock helper",
      hint: "DIY toggle.",
    },
    {
      id: "quiz-phase",
      type: "quiz",
      prompt: "Starting low then toggling gives predictable…",
      choices: ["posedge times", "vacuity", "scoreboard depth", "BMC bugAt"],
      answer: "posedge times",
      hint: "Phase alignment.",
    },
    {
      id: "quiz-multiple",
      type: "quiz",
      prompt: "Multiple clocks need…",
      choices: ["separate Clock instances per signal", "one global period always", "no timers", "vacuity checks"],
      answer: "separate Clock instances per signal",
      hint: "Per-signal generators.",
    },
    {
      id: "quiz-reset",
      type: "quiz",
      prompt: "Reset should usually be stable before…",
      choices: ["releasing clock or sampling", "formal vacuity", "deleting vectors", "Git commit"],
      answer: "releasing clock or sampling",
      hint: "Reset sequencing.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Browser lab edges are a sketch; real timing is in…",
      choices: ["local simulator + cocotb", "only PDF slides", "CSS variables", "Git hooks"],
      answer: "local simulator + cocotb",
      hint: "Offline fidelity.",
    },
    {
      id: "quiz-freq",
      type: "quiz",
      prompt: "Halving period doubles…",
      choices: ["clock frequency", "BMC bound k", "vacuity", "queue depth"],
      answer: "clock frequency",
      hint: "Shorter period.",
    },
    {
      id: "quiz-dut",
      type: "quiz",
      prompt: "Clock(dut.clk, ...) drives…",
      choices: ["the DUT clock port handle", "only Python print", "formal antecedent", "pytest fixture name"],
      answer: "the DUT clock port handle",
      hint: "HDL signal.",
    },
    {
      id: "quiz-skew",
      type: "quiz",
      prompt: "Real flows may add clock skew via…",
      choices: ["delays / clocking blocks", "JSON typos", "vacuity", "scoreboard pop"],
      answer: "delays / clocking blocks",
      hint: "Timing detail.",
    },
    {
      id: "quiz-first",
      type: "quiz",
      prompt: "First posedge at period (not 0) models…",
      choices: ["time after start before first rise", "vacuous pass", "failed assert", "empty queue"],
      answer: "time after start before first rise",
      hint: "Non-zero edge times.",
    },
  ];

  DDVConceptLab.mount({
    id: "cocotb-clock-helper",
    rootId: "cocotb-clock-root",
    starterHtml:
      "<p><strong>Starter example:</strong> <code>periodNs=10</code>, Start clock → edges at <strong>10, 20, 30</strong> ns.</p>",
    ideas: [
      { h3: "Clock helper", p: "cocotb Clock.start() toggles dut.clk in the background." },
      { h3: "Period", p: "periodNs sets spacing; edges appear at 1×, 2×, 3× period." },
      { h3: "await sync", p: "Tests await RisingEdge(dut.clk) at those times." },
      { h3: "Sketch vs sim", p: "Lab lists edges; real runs need local simulator + cocotb." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
