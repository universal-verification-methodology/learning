(function () {
  "use strict";

  function toBits(val, width) {
    var w = width || 8;
    var mask = (1 << w) - 1;
    var n = Number(val) & mask;
    var s = "";
    for (var i = w - 1; i >= 0; i--) {
      s += (n >> i) & 1 ? "1" : "0";
    }
    return s;
  }

  function parseVal(text) {
    var t = String(text).trim();
    if (t.toLowerCase().indexOf("0x") === 0) return parseInt(t, 16);
    return parseInt(t, 10);
  }

  function makeStarter() {
    return {
      preset: "starter",
      lastAction: "starter",
      width: 8,
      valueText: "0xA5",
      value: 0xa5,
      bits: "10100101",
    };
  }

  function setValue(api) {
    var s = api.getState();
    var w = Number(s.width) || 8;
    var v = parseVal(s.valueText);
    if (isNaN(v)) v = 0;
    api.patchState({
      width: w,
      value: v,
      bits: toBits(v, w),
      lastAction: "set",
    });
  }

  function buildLab(labEl, api) {
    labEl.innerHTML =
      '<div class="lab-layout">' +
      '<div class="panel-box">' +
      "<h3>BinaryValue sketch</h3>" +
      '<div class="lab-controls">' +
      '<div class="lab-field"><label>width</label><input id="cbv-width" type="number" min="1" max="32" value="8"></div>' +
      '<div class="lab-field"><label>value</label><input id="cbv-value" type="text" value="0xA5"></div>' +
      "</div>" +
      '<div class="tool-actions">' +
      '<button type="button" class="btn btn-secondary" id="cbv-set">Set value</button>' +
      "</div>" +
      '<div id="verdict" class="verdict yes">bits: 10100101</div>' +
      '<pre class="code-box" id="cbv-bits">10100101</pre>' +
      "</div>" +
      '<div class="panel-box">' +
      "<h3>Poke literacy</h3>" +
      '<p class="meta-note"><code>dut.data.value = BinaryValue(0xA5, n_bits=8)</code> — MSB left in bit string.</p>' +
      "</div></div>";

    document.getElementById("cbv-set").addEventListener("click", function () {
      api.patchState({
        width: Number(document.getElementById("cbv-width").value) || 8,
        valueText: document.getElementById("cbv-value").value,
      });
      setValue(api);
    });
    document.getElementById("cbv-width").addEventListener("change", function () {
      api.patchState({ width: Number(document.getElementById("cbv-width").value) || 8 });
    });
    document.getElementById("cbv-value").addEventListener("change", function () {
      api.patchState({ valueText: document.getElementById("cbv-value").value });
    });
  }

  function renderLab(state) {
    var wEl = document.getElementById("cbv-width");
    var vEl = document.getElementById("cbv-value");
    if (wEl && document.activeElement !== wEl) wEl.value = state.width || 8;
    if (vEl && document.activeElement !== vEl) vEl.value = state.valueText || "0xA5";

    var bits = state.bits || toBits(state.value, state.width);
    var v = document.getElementById("verdict");
    if (v) {
      v.className = "verdict yes";
      v.textContent = "width=" + (state.width || 8) + " value=0x" + (Number(state.value) & 0xff).toString(16).toUpperCase() + " → bits: " + bits;
    }
    var pre = document.getElementById("cbv-bits");
    if (pre) pre.textContent = bits;
  }

  function literacy(state) {
    return (
      "dut.data.value = BinaryValue(" +
      (state.valueText || "0xA5") +
      ", n_bits=" +
      (state.width || 8) +
      ")\n# " +
      (state.bits || "")
    );
  }

  var baseChallenges = [
    {
      id: "starter-bits",
      prompt: "Starter: width 8, value 0xA5 — bits string 10100101.",
      hint: "Load starter.",
      check: function (api) {
        var s = api.getState();
        return s.bits === "10100101" && s.width === 8;
      },
    },
    {
      id: "set-ff",
      prompt: "Set value 0xFF, press Set value — all eight bits are 1.",
      hint: "0xFF = 11111111.",
      setup: function (api) {
        api.patchState({ valueText: "0xFF", width: 8 });
        setValue(api);
      },
      check: function (api) {
        return api.getState().bits === "11111111";
      },
    },
    {
      id: "set-zero",
      prompt: "Set value 0, width 8 — bits 00000000.",
      hint: "Zero clears bus.",
      setup: function (api) {
        api.patchState({ valueText: "0", width: 8 });
        setValue(api);
      },
      check: function (api) {
        return api.getState().bits === "00000000";
      },
    },
    {
      id: "width-4",
      prompt: "Set width 4, value 0xF — bits 1111 (truncated to width).",
      hint: "Lower width masks value.",
      setup: function (api) {
        api.patchState({ valueText: "0xF", width: 4 });
        setValue(api);
      },
      check: function (api) {
        var s = api.getState();
        return s.width === 4 && s.bits === "1111";
      },
    },
    {
      id: "back-a5",
      prompt: "Return to width 8, value 0xA5 — bits 10100101 again.",
      hint: "Starter values.",
      setup: function (api) {
        api.patchState({ valueText: "0xA5", width: 8 });
        setValue(api);
      },
      check: function (api) {
        return api.getState().bits === "10100101";
      },
    },
  ];

  var quizList = [
    {
      id: "quiz-bv",
      type: "quiz",
      prompt: "cocotb BinaryValue wraps…",
      choices: ["integer + bit width for HDL signals", "only floats", "only strings", "Git commits"],
      answer: "integer + bit width for HDL signals",
      hint: "Sized logic value.",
    },
    {
      id: "quiz-msb",
      type: "quiz",
      prompt: "Bit string MSB-left means leftmost bit is…",
      choices: ["highest index (n-1)", "always 0", "vacuous", "cover only"],
      answer: "highest index (n-1)",
      hint: "Standard display.",
    },
    {
      id: "quiz-poke",
      type: "quiz",
      prompt: "Assigning dut.sig.value = BinaryValue(...) is a…",
      choices: ["poke / drive on the signal", "formal assume", "pytest skip", "Git stash"],
      answer: "poke / drive on the signal",
      hint: "Drive DUT input.",
    },
    {
      id: "quiz-mask",
      type: "quiz",
      prompt: "Width 4 truncates value to…",
      choices: ["lower 4 bits", "upper 28 bits only", "analog voltage", "vacuity"],
      answer: "lower 4 bits",
      hint: "Mask by width.",
    },
    {
      id: "quiz-read",
      type: "quiz",
      prompt: "Reading dut.sig.value often returns…",
      choices: ["BinaryValue or int-like object", "only CSS", "BMC trace", "Git remote"],
      answer: "BinaryValue or int-like object",
      hint: "Sample output.",
    },
    {
      id: "quiz-hex",
      type: "quiz",
      prompt: "0xA5 as 8-bit is decimal…",
      choices: ["165", "5", "255", "0"],
      answer: "165",
      hint: "16*10+5.",
    },
    {
      id: "quiz-signed",
      type: "quiz",
      prompt: "Signed interpretation needs…",
      choices: ["explicit signed BinaryValue or cast", "only cover", "vacuity", "scoreboard"],
      answer: "explicit signed BinaryValue or cast",
      hint: "Two's complement.",
    },
    {
      id: "quiz-z",
      type: "quiz",
      prompt: "X/Z on a bus in sim means…",
      choices: ["unknown/high-Z states", "always 0", "proved", "vacuous"],
      answer: "unknown/high-Z states",
      hint: "Not binary 0/1.",
    },
    {
      id: "quiz-endian",
      type: "quiz",
      prompt: "Byte order on a wide bus requires…",
      choices: ["consistent map to signal indices", "ignoring width", "vacuity only", "no documentation"],
      answer: "consistent map to signal indices",
      hint: "Layout discipline.",
    },
    {
      id: "quiz-nbits",
      type: "quiz",
      prompt: "n_bits must match RTL port width or you risk…",
      choices: ["truncation / width mismatch", "Git merge", "vacuity pass", "free proof"],
      answer: "truncation / width mismatch",
      hint: "Width agreement.",
    },
    {
      id: "quiz-await",
      type: "quiz",
      prompt: "After poking, tests often await…",
      choices: ["clock edge before checking", "Git push", "BMC only", "never"],
      answer: "clock edge before checking",
      hint: "Settle time.",
    },
    {
      id: "quiz-int",
      type: "quiz",
      prompt: "int(binary_value) may be used when you need…",
      choices: ["plain Python integer compare", "synthesis", "vacuity", "cover role"],
      answer: "plain Python integer compare",
      hint: "Scalar compare.",
    },
    {
      id: "quiz-lsb",
      type: "quiz",
      prompt: "LSB of 0xA5 (10100101) is…",
      choices: ["1 (rightmost)", "0", "A", "vacuous"],
      answer: "1 (rightmost)",
      hint: "Bit 0.",
    },
    {
      id: "quiz-pack",
      type: "quiz",
      prompt: "Packing fields into one BinaryValue is like…",
      choices: ["concatenating bit slices", "formal induction", "pytest xfail", "clock.start only"],
      answer: "concatenating bit slices",
      hint: "Bus packing.",
    },
    {
      id: "quiz-local",
      type: "quiz",
      prompt: "Real BinaryValue behavior is validated…",
      choices: ["in local cocotb + simulator runs", "only in browser", "by vacuity", "by Git tags"],
      answer: "in local cocotb + simulator runs",
      hint: "Offline TB.",
    },
    {
      id: "quiz-5a",
      type: "quiz",
      prompt: "0x5A bits (8) differ from 0xA5 — reminds you to check…",
      choices: ["bit/byte order when comparing", "only cover", "assume on reset", "BMC k"],
      answer: "bit/byte order when comparing",
      hint: "Reversed pattern.",
    },
    {
      id: "quiz-drive",
      type: "quiz",
      prompt: "Driving 0 then 1 on a bit exercises…",
      choices: ["0→1 transition", "vacuity", "induction step only", "empty queue"],
      answer: "0→1 transition",
      hint: "Toggle edge.",
    },
  ];

  DDVConceptLab.mount({
    id: "cocotb-binary-value",
    rootId: "cocotb-bv-root",
    starterHtml:
      "<p><strong>Starter example:</strong> width <code>8</code>, value <code>0xA5</code> → bit string <strong>10100101</strong>.</p>",
    ideas: [
      { h3: "BinaryValue", p: "Wraps integer + n_bits for cocotb HDL handles." },
      { h3: "Poke", p: "dut.data.value = BinaryValue(v, n_bits=w) drives the bus." },
      { h3: "MSB left", p: "Display shows bit n-1 on the left, bit 0 on the right." },
      { h3: "Width mask", p: "Value is truncated to the declared width." },
    ],
    makeStarter: makeStarter,
    literacy: literacy,
    buildLab: buildLab,
    renderLab: renderLab,
    challenges: DDVConceptLab.withQuizPad(baseChallenges, quizList),
  });
})();
