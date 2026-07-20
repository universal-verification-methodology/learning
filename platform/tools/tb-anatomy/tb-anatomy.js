(() => {
  const STORAGE_KEY = "ddv-tb-anatomy-v1";
  const CLEARED_KEY = "ddv-tb-anatomy-cleared-v1";

  /**
   * Teaching model: a tiny TB wraps a DUT.
   * Parts are clickable regions; signals have reg/wire/logic roles.
   * Timeline steps show $display / $finish conceptually (not a full simulator).
   */
  const PRESETS = {
    classic: {
      label: "Classic AND TB (starter)",
      verdict: "ok",
      verdictText: "Stimulus as reg · observe as wire · $display then $finish",
      dutTitle: "and2 (DUT)",
      dutMeta: "Synthesizable design under test — not the testbench",
      parts: {
        tb: {
          title: "module tb",
          meta: "Simulation-only wrapper: stimulus, instance, checks, finish",
          codeKey: "tb",
        },
        stimulus: {
          title: "Stimulus (reg a, b)",
          meta: "TB drives DUT inputs — classic Verilog uses reg in initial/always",
          codeKey: "stimulus",
        },
        observe: {
          title: "Observe (wire y)",
          meta: "DUT output is a net the TB reads — typically wire (or logic)",
          codeKey: "observe",
        },
        dut: {
          title: "DUT instance",
          meta: "and2 dut(.a(a), .b(b), .y(y)) — ports connect TB ↔ design",
          codeKey: "dut",
          isDut: true,
        },
        procedural: {
          title: "initial + $display / $finish",
          meta: "Time advances with #delays; print results; end the run",
          codeKey: "procedural",
        },
      },
      signals: [
        {
          id: "a",
          name: "a",
          role: "reg",
          where: "tb",
          blurb: "TB stimulus. Driven in initial; connects to DUT input a.",
        },
        {
          id: "b",
          name: "b",
          role: "reg",
          where: "tb",
          blurb: "TB stimulus. Same pattern as a.",
        },
        {
          id: "y",
          name: "y",
          role: "wire",
          where: "tb",
          blurb: "TB observation net. Driven by the DUT output — do not drive from initial.",
        },
        {
          id: "dut-y",
          name: "dut.y",
          role: "wire",
          where: "dut",
          blurb: "Inside the DUT, y is an output (continuous assign). The TB sees it as wire y.",
        },
      ],
      code: `module and2(input a, b, output y);
  assign y = a & b;          // DUT — design under test
endmodule

module tb;
  /*stimulus*/reg a, b;/* /stimulus */
  /*observe*/wire y;/* /observe */
  /*dut*/and2 dut(.a(a), .b(b), .y(y));/* /dut */

  /*procedural*/initial begin
    a = 0; b = 0;
    #10 a = 1;
    #10 b = 1;
    #10 $display("y=%b (expect 1)", y);
    #10 $finish;
  end/* /procedural */
endmodule`,
      steps: [
        { t: 0, a: 0, b: 0, y: 0, log: "t=0: a=0 b=0 → y=0", kind: "muted" },
        { t: 10, a: 1, b: 0, y: 0, log: "t=10: a=1 b=0 → y=0", kind: "muted" },
        { t: 20, a: 1, b: 1, y: 1, log: "t=20: a=1 b=1 → y=1", kind: "ok" },
        {
          t: 30,
          a: 1,
          b: 1,
          y: 1,
          log: 't=30: $display → "y=1 (expect 1)"',
          kind: "ok",
          display: true,
        },
        {
          t: 40,
          a: 1,
          b: 1,
          y: 1,
          log: "t=40: $finish — simulation ends",
          kind: "warn",
          finish: true,
        },
      ],
    },
    wireDrive: {
      label: "Mistake: wire stimulus",
      verdict: "risk",
      verdictText: "Cannot procedural-assign a wire in initial — use reg/logic (or assign)",
      dutTitle: "and2 (DUT)",
      dutMeta: "Same DUT — the bug is in the TB declarations",
      parts: {
        tb: {
          title: "module tb (broken)",
          meta: "Looks like a TB, but stimulus types are wrong for procedural drive",
          codeKey: "tb",
          risk: true,
        },
        stimulus: {
          title: "Bad: wire a, b",
          meta: "a = 1 in initial does not compile / is illegal for a net",
          codeKey: "stimulus",
          risk: true,
        },
        observe: {
          title: "Observe (wire y)",
          meta: "y as wire is fine — the problem is driving a and b procedurally",
          codeKey: "observe",
        },
        dut: {
          title: "DUT instance",
          meta: "Instance is fine; TB declarations are not",
          codeKey: "dut",
          isDut: true,
        },
        procedural: {
          title: "initial tries a = …",
          meta: "Procedural assignment needs a variable (reg/logic), not a bare wire",
          codeKey: "procedural",
          risk: true,
        },
      },
      signals: [
        {
          id: "a",
          name: "a",
          role: "bad",
          where: "tb",
          blurb: "Declared wire but driven in initial — classic beginner error. Use reg or logic.",
        },
        {
          id: "b",
          name: "b",
          role: "bad",
          where: "tb",
          blurb: "Same issue as a.",
        },
        {
          id: "y",
          name: "y",
          role: "wire",
          where: "tb",
          blurb: "Observation wire is correct; leave DUT to drive it.",
        },
      ],
      code: `module and2(input a, b, output y);
  assign y = a & b;
endmodule

module tb;
  /*stimulus*/wire a, b;   // BAD for a=1 in initial/* /stimulus */
  /*observe*/wire y;/* /observe */
  /*dut*/and2 dut(.a(a), .b(b), .y(y));/* /dut */

  /*procedural*/initial begin
    a = 0; b = 0;   // illegal: procedural drive of wire
    #10 a = 1;
    #10 $finish;
  end/* /procedural */
endmodule`,
      steps: [
        {
          t: 0,
          a: "?",
          b: "?",
          y: "?",
          log: "t=0: compile / elaboration error — cannot assign wire in initial",
          kind: "err",
        },
      ],
    },
    svLogic: {
      label: "SystemVerilog logic TB",
      verdict: "ok",
      verdictText: "logic covers TB vars and most nets — still separate DUT vs TB modules",
      dutTitle: "and2 (DUT)",
      dutMeta: "DUT can stay Verilog-2001; TB may use SV types",
      parts: {
        tb: {
          title: "module tb (SV)",
          meta: "Same anatomy: stimulus, instance, print, finish",
          codeKey: "tb",
        },
        stimulus: {
          title: "Stimulus (logic a, b)",
          meta: "logic is a variable — legal to drive in initial",
          codeKey: "stimulus",
        },
        observe: {
          title: "Observe (logic y)",
          meta: "logic can also sit on the DUT output side in a TB (single driver)",
          codeKey: "observe",
        },
        dut: {
          title: "DUT instance",
          meta: "Port connections unchanged",
          codeKey: "dut",
          isDut: true,
        },
        procedural: {
          title: "initial + $display / $finish",
          meta: "Same system tasks as classic Verilog",
          codeKey: "procedural",
        },
      },
      signals: [
        {
          id: "a",
          name: "a",
          role: "logic",
          where: "tb",
          blurb: "SV logic in TB for stimulus — replaces classic reg for this use.",
        },
        {
          id: "b",
          name: "b",
          role: "logic",
          where: "tb",
          blurb: "Same as a.",
        },
        {
          id: "y",
          name: "y",
          role: "logic",
          where: "tb",
          blurb: "Single-driver observation — logic is fine; still not “inside” the DUT.",
        },
      ],
      code: `module and2(input a, b, output y);
  assign y = a & b;
endmodule

module tb;
  /*stimulus*/logic a, b;/* /stimulus */
  /*observe*/logic y;/* /observe */
  /*dut*/and2 dut(.a(a), .b(b), .y(y));/* /dut */

  /*procedural*/initial begin
    a = 0; b = 0;
    #10 a = 1; b = 1;
    #10 $display("y=%0b", y);
    #10 $finish;
  end/* /procedural */
endmodule`,
      steps: [
        { t: 0, a: 0, b: 0, y: 0, log: "t=0: a=0 b=0 → y=0", kind: "muted" },
        { t: 10, a: 1, b: 1, y: 1, log: "t=10: a=1 b=1 → y=1", kind: "ok" },
        {
          t: 20,
          a: 1,
          b: 1,
          y: 1,
          log: 't=20: $display → "y=1"',
          kind: "ok",
          display: true,
        },
        {
          t: 30,
          a: 1,
          b: 1,
          y: 1,
          log: "t=30: $finish",
          kind: "warn",
          finish: true,
        },
      ],
    },
    clocked: {
      label: "Clocked FF TB",
      verdict: "ok",
      verdictText: "TB makes clk (always toggle) · drives d · watches q · $finish after N edges",
      dutTitle: "dff (DUT)",
      dutMeta: "Edge-triggered design — TB must generate a clock",
      parts: {
        tb: {
          title: "module tb_ff",
          meta: "Clock gen + stimulus + monitor — still not synthesizable as a whole",
          codeKey: "tb",
        },
        stimulus: {
          title: "regs: clk, d, rst_n",
          meta: "TB owns the clock and reset — DUT never “makes” clk for itself here",
          codeKey: "stimulus",
        },
        observe: {
          title: "Observe (wire q)",
          meta: "DUT register output observed on a wire",
          codeKey: "observe",
        },
        dut: {
          title: "DUT: dff",
          meta: "always @(posedge clk) with async reset — the thing we verify",
          codeKey: "dut",
          isDut: true,
        },
        procedural: {
          title: "Clock always + initial $finish",
          meta: "forever #5 clk=~clk is TB-only; $finish stops the infinite clock",
          codeKey: "procedural",
        },
      },
      signals: [
        {
          id: "clk",
          name: "clk",
          role: "reg",
          where: "tb",
          blurb: "Generated in the TB (toggle forever). Not a DUT output.",
        },
        {
          id: "d",
          name: "d",
          role: "reg",
          where: "tb",
          blurb: "Stimulus to the FF data pin.",
        },
        {
          id: "q",
          name: "q",
          role: "wire",
          where: "tb",
          blurb: "Observed FF output.",
        },
        {
          id: "rst_n",
          name: "rst_n",
          role: "reg",
          where: "tb",
          blurb: "TB-controlled reset. Assert early, then release before checking q.",
        },
      ],
      code: `module dff(input clk, rst_n, d, output reg q);
  always @(posedge clk or negedge rst_n)
    if (!rst_n) q <= 1'b0;
    else        q <= d;
endmodule

module tb_ff;
  /*stimulus*/reg clk, rst_n, d;/* /stimulus */
  /*observe*/wire q;/* /observe */
  /*dut*/dff dut(.clk(clk), .rst_n(rst_n), .d(d), .q(q));/* /dut */

  /*procedural*/initial clk = 0;
  always #5 clk = ~clk;   // TB clock gen

  initial begin
    rst_n = 0; d = 0;
    #12 rst_n = 1;
    #10 d = 1;
    @(posedge clk);
    #1 $display("q=%b (expect 1)", q);
    #20 $finish;
  end/* /procedural */
endmodule`,
      steps: [
        { t: 0, a: "clk=0", b: "rst=0", y: "q=0", log: "t=0: reset asserted, clk low", kind: "muted" },
        { t: 12, a: "clk…", b: "rst=1", y: "q=0", log: "t=12: release reset", kind: "ok" },
        { t: 22, a: "clk…", b: "d=1", y: "q=0", log: "t=22: d=1 before next edge", kind: "muted" },
        {
          t: 25,
          a: "posedge",
          b: "d=1",
          y: "q=1",
          log: "t≈25: posedge samples d → q=1",
          kind: "ok",
        },
        {
          t: 26,
          a: "…",
          b: "…",
          y: "q=1",
          log: 't≈26: $display → "q=1 (expect 1)"',
          kind: "ok",
          display: true,
        },
        {
          t: 46,
          a: "…",
          b: "…",
          y: "q=1",
          log: "t≈46: $finish (stops forever clock)",
          kind: "warn",
          finish: true,
        },
      ],
    },
    selfCheck: {
      label: "Self-checking $display",
      verdict: "ok",
      verdictText: "Compare DUT output to expected · print PASS/FAIL · then $finish",
      dutTitle: "and2 (DUT)",
      dutMeta: "Same gate — TB adds an expected-value check",
      parts: {
        tb: {
          title: "module tb_check",
          meta: "Minimal self-check: if mismatch, shout FAIL",
          codeKey: "tb",
        },
        stimulus: {
          title: "Stimulus regs",
          meta: "Apply a known vector",
          codeKey: "stimulus",
        },
        observe: {
          title: "Observe + expected",
          meta: "Read y; compare to a TB-local expected",
          codeKey: "observe",
        },
        dut: {
          title: "DUT instance",
          meta: "Still just and2",
          codeKey: "dut",
          isDut: true,
        },
        procedural: {
          title: "$display PASS/FAIL + $finish",
          meta: "$display is a message; $finish ends — neither synthesizes",
          codeKey: "procedural",
        },
      },
      signals: [
        {
          id: "a",
          name: "a",
          role: "reg",
          where: "tb",
          blurb: "Stimulus.",
        },
        {
          id: "y",
          name: "y",
          role: "wire",
          where: "tb",
          blurb: "DUT result to check.",
        },
        {
          id: "exp",
          name: "exp",
          role: "reg",
          where: "tb",
          blurb: "TB-only expected value — not a DUT port.",
        },
      ],
      code: `module and2(input a, b, output y);
  assign y = a & b;
endmodule

module tb_check;
  /*stimulus*/reg a, b;/* /stimulus */
  /*observe*/wire y;
  reg exp;/* /observe */
  /*dut*/and2 dut(.a(a), .b(b), .y(y));/* /dut */

  /*procedural*/initial begin
    a = 1; b = 1; exp = 1;
    #1;
    if (y !== exp)
      $display("FAIL y=%b exp=%b", y, exp);
    else
      $display("PASS");
    $finish;
  end/* /procedural */
endmodule`,
      steps: [
        { t: 0, a: 1, b: 1, y: 1, log: "t=0: apply a=1 b=1, exp=1", kind: "muted" },
        {
          t: 1,
          a: 1,
          b: 1,
          y: 1,
          log: 't=1: $display → "PASS"',
          kind: "ok",
          display: true,
        },
        {
          t: 2,
          a: 1,
          b: 1,
          y: 1,
          log: "t=2: $finish",
          kind: "warn",
          finish: true,
        },
      ],
    },
    noFinish: {
      label: "Missing $finish",
      verdict: "warn",
      verdictText: "Without $finish (or $stop), a forever clock / open-ended TB may never exit",
      dutTitle: "and2 (DUT)",
      dutMeta: "DUT is fine — the TB never ends the run",
      parts: {
        tb: {
          title: "module tb_hang",
          meta: "Prints once but leaves the simulator running",
          codeKey: "tb",
          risk: true,
        },
        stimulus: {
          title: "Stimulus regs",
          meta: "Ordinary drives",
          codeKey: "stimulus",
        },
        observe: {
          title: "Observe wire",
          meta: "Ordinary observe",
          codeKey: "observe",
        },
        dut: {
          title: "DUT instance",
          meta: "Ordinary instance",
          codeKey: "dut",
          isDut: true,
        },
        procedural: {
          title: "$display only — no $finish",
          meta: "Message appears; process may idle forever depending on the TB",
          codeKey: "procedural",
          risk: true,
        },
      },
      signals: [
        {
          id: "a",
          name: "a",
          role: "reg",
          where: "tb",
          blurb: "Stimulus — OK.",
        },
        {
          id: "y",
          name: "y",
          role: "wire",
          where: "tb",
          blurb: "Observe — OK.",
        },
      ],
      code: `module and2(input a, b, output y);
  assign y = a & b;
endmodule

module tb_hang;
  /*stimulus*/reg a, b;/* /stimulus */
  /*observe*/wire y;/* /observe */
  /*dut*/and2 dut(.a(a), .b(b), .y(y));/* /dut */

  /*procedural*/initial begin
    a = 1; b = 1;
    #10 $display("y=%b", y);
    // missing $finish — sim may not exit
  end/* /procedural */
endmodule`,
      steps: [
        { t: 0, a: 1, b: 1, y: 1, log: "t=0: a=1 b=1 → y=1", kind: "muted" },
        {
          t: 10,
          a: 1,
          b: 1,
          y: 1,
          log: 't=10: $display → "y=1"',
          kind: "ok",
          display: true,
        },
        {
          t: 11,
          a: 1,
          b: 1,
          y: 1,
          log: "t=11+: no $finish — waiting / idle (hang risk)",
          kind: "err",
        },
      ],
    },
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlightCode(code, partKey, parts) {
    const risk = parts[partKey] && parts[partKey].risk;
    const cls = risk ? "hl-risk" : "hl-part";
    let out = escapeHtml(code);
    // Restore markers after escape, then wrap active part
    out = out
      .replace(/\/\*stimulus\*\//g, "<!--S-->")
      .replace(/\/\* \/stimulus \*\//g, "<!--/S-->")
      .replace(/\/\*observe\*\//g, "<!--O-->")
      .replace(/\/\* \/observe \*\//g, "<!--/O-->")
      .replace(/\/\*dut\*\//g, "<!--D-->")
      .replace(/\/\* \/dut \*\//g, "<!--/D-->")
      .replace(/\/\*procedural\*\//g, "<!--P-->")
      .replace(/\/\* \/procedural \*\//g, "<!--/P-->");

    const map = {
      stimulus: ["<!--S-->", "<!--/S-->"],
      observe: ["<!--O-->", "<!--/O-->"],
      dut: ["<!--D-->", "<!--/D-->"],
      procedural: ["<!--P-->", "<!--/P-->"],
    };

    Object.keys(map).forEach((k) => {
      const [a, b] = map[k];
      if (k === partKey) {
        out = out.replace(a, `<span class="${cls}">`).replace(b, "</span>");
      } else {
        out = out.replace(a, "").replace(b, "");
      }
    });

    // Strip leftover comment markers if tb selected (no region)
    out = out.replace(/<!--\/?[SODP]-->/g, "");
    return out;
  }

  const CHALLENGES = [
    {
      id: "quiz-dut",
      title: "Quiz: DUT",
      type: "quiz",
      prompt: "DUT means…",
      hint: "Design.",
      choices: [
        "Design Under Test — the synthesizable (or RTL) module being verified",
        "Device Upload Tool",
        "only the $finish statement",
        "the forever clock generator alone",
      ],
      answer: "Design Under Test — the synthesizable (or RTL) module being verified",
    },
    {
      id: "quiz-tb",
      title: "Quiz: testbench",
      type: "quiz",
      prompt: "A Verilog testbench typically…",
      hint: "Wrap.",
      choices: [
        "instantiates the DUT, applies stimulus, observes outputs, and ends the run",
        "replaces synthesis of the DUT",
        "must be place-and-routed with the chip",
        "is always empty",
      ],
      answer: "instantiates the DUT, applies stimulus, observes outputs, and ends the run",
    },
    {
      id: "quiz-reg",
      title: "Quiz: reg in TB",
      type: "quiz",
      prompt: "In a classic Verilog TB, inputs to the DUT are often declared reg because…",
      hint: "Procedural.",
      choices: [
        "initial/always procedural assignments need a variable (reg), not a bare wire",
        "reg means the signal is inside the DUT always",
        "wires cannot connect to ports",
        "$display only works on regs",
      ],
      answer: "initial/always procedural assignments need a variable (reg), not a bare wire",
    },
    {
      id: "quiz-wire",
      title: "Quiz: wire observe",
      type: "quiz",
      prompt: "DUT outputs are usually connected to wire (or logic) in the TB because…",
      hint: "Driven by DUT.",
      choices: [
        "the DUT drives that net; the TB reads it rather than procedural-assigning it",
        "wires are faster in silicon",
        "$finish requires wires",
        "regs cannot be ports",
      ],
      answer: "the DUT drives that net; the TB reads it rather than procedural-assigning it",
    },
    {
      id: "quiz-display",
      title: "Quiz: $display",
      type: "quiz",
      prompt: "$display …",
      hint: "Print.",
      choices: [
        "prints a formatted message to the simulator log (simulation-only)",
        "synthesizes into an LCD controller",
        "resets the DUT",
        "compiles the DUT to gates",
      ],
      answer: "prints a formatted message to the simulator log (simulation-only)",
    },
    {
      id: "quiz-finish",
      title: "Quiz: $finish",
      type: "quiz",
      prompt: "$finish …",
      hint: "End.",
      choices: [
        "ends the simulation run",
        "finishes place-and-route",
        "clears all wires to Z",
        "is required inside every DUT always block",
      ],
      answer: "ends the simulation run",
    },
    {
      id: "quiz-not-synth",
      title: "Quiz: synth",
      type: "quiz",
      prompt: "Which belongs in the TB, not the synthesizable DUT?",
      hint: "System tasks.",
      choices: [
        "$display / $finish and forever clock toggles",
        "assign y = a & b",
        "module port lists",
        "parameter WIDTH = 8",
      ],
      answer: "$display / $finish and forever clock toggles",
    },
    {
      id: "quiz-logic",
      title: "Quiz: logic",
      type: "quiz",
      prompt: "SystemVerilog logic in a TB…",
      hint: "Variable.",
      choices: [
        "can replace many classic reg uses for stimulus (and often observe with one driver)",
        "means the signal is analog",
        "forbids $display",
        "is only legal inside the DUT",
      ],
      answer: "can replace many classic reg uses for stimulus (and often observe with one driver)",
    },
    {
      id: "quiz-clk-owner",
      title: "Quiz: who makes clk",
      type: "quiz",
      prompt: "In the clocked FF preset, clk is…",
      hint: "TB.",
      choices: [
        "generated in the testbench (e.g. always #5 clk = ~clk)",
        "an output of the DUT that the TB must not touch",
        "created by $finish",
        "always a wire driven by $display",
      ],
      answer: "generated in the testbench (e.g. always #5 clk = ~clk)",
    },
    {
      id: "quiz-hang",
      title: "Quiz: no $finish",
      type: "quiz",
      prompt: "A TB with a forever clock and no $finish may…",
      hint: "Hang.",
      choices: [
        "never exit — the simulator keeps running",
        "automatically synthesize better gates",
        "delete the DUT",
        "convert regs to wires",
      ],
      answer: "never exit — the simulator keeps running",
    },
    {
      id: "run-starter",
      title: "Load starter",
      type: "run",
      prompt: "Load the Classic AND TB starter preset.",
      hint: "Load starter example / preset.",
      check: (s) => s.preset === "classic",
    },
    {
      id: "run-select-dut",
      title: "Select DUT",
      type: "run",
      prompt: "On the classic starter, click the DUT instance part in the anatomy diagram.",
      hint: "Gold/orange DUT box.",
      check: (s) => s.preset === "classic" && s.part === "dut",
    },
    {
      id: "run-select-stim",
      title: "Select stimulus",
      type: "run",
      prompt: "Classic preset: select the Stimulus (reg a, b) part.",
      hint: "Top anatomy card.",
      check: (s) => s.preset === "classic" && s.part === "stimulus",
    },
    {
      id: "run-signal-a",
      title: "Inspect a",
      type: "run",
      prompt: "Classic preset: click signal chip a — role should be reg.",
      hint: "Chips under the diagram.",
      check: (s) => {
        if (s.preset !== "classic" || s.signal !== "a") return false;
        const sig = PRESETS.classic.signals.find((x) => x.id === "a");
        return sig && sig.role === "reg";
      },
    },
    {
      id: "run-signal-y",
      title: "Inspect y",
      type: "run",
      prompt: "Classic preset: select signal y (wire observation).",
      hint: "Observe net.",
      check: (s) => s.preset === "classic" && s.signal === "y",
    },
    {
      id: "run-step-display",
      title: "Step to $display",
      type: "run",
      prompt: "Classic preset: Step until the current event is the $display line.",
      hint: "Step ▶ through the timeline.",
      check: (s) => {
        if (s.preset !== "classic") return false;
        const step = PRESETS.classic.steps[s.stepIdx];
        return step && step.display;
      },
    },
    {
      id: "run-step-finish",
      title: "Step to $finish",
      type: "run",
      prompt: "Classic preset: Step until $finish.",
      hint: "Last timeline event.",
      check: (s) => {
        if (s.preset !== "classic") return false;
        const step = PRESETS.classic.steps[s.stepIdx];
        return step && step.finish;
      },
    },
    {
      id: "run-wire-mistake",
      title: "See wire mistake",
      type: "run",
      prompt: "Load the “Mistake: wire stimulus” preset and select the bad stimulus part.",
      hint: "Preset dropdown.",
      check: (s) => s.preset === "wireDrive" && s.part === "stimulus",
    },
    {
      id: "run-sv-logic",
      title: "SV logic preset",
      type: "run",
      prompt: "Load the SystemVerilog logic TB preset.",
      hint: "Preset list.",
      check: (s) => s.preset === "svLogic",
    },
    {
      id: "run-clocked",
      title: "Clocked TB",
      type: "run",
      prompt: "Load Clocked FF TB and select the procedural (clock + $finish) part.",
      hint: "Clock gen lives in TB.",
      check: (s) => s.preset === "clocked" && s.part === "procedural",
    },
    {
      id: "run-self-check",
      title: "Self-check PASS",
      type: "run",
      prompt: "Self-checking preset: step until the console shows PASS ($display).",
      hint: "Load preset, then Step.",
      check: (s) => {
        if (s.preset !== "selfCheck") return false;
        const step = PRESETS.selfCheck.steps[s.stepIdx];
        return step && step.display;
      },
    },
    {
      id: "run-no-finish",
      title: "Hang risk",
      type: "run",
      prompt: "Missing $finish preset: step to the hang-risk console line.",
      hint: "Last step is the warning.",
      check: (s) => {
        if (s.preset !== "noFinish") return false;
        const step = PRESETS.noFinish.steps[s.stepIdx];
        return step && step.kind === "err";
      },
    },
  ];

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const state = {
    preset: "classic",
    part: "procedural",
    signal: "a",
    stepIdx: 0,
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function currentPreset() {
    return PRESETS[state.preset] || PRESETS.classic;
  }

  function loadPreset(id) {
    const p = PRESETS[id] || PRESETS.classic;
    state.preset = id in PRESETS ? id : "classic";
    state.part = "procedural";
    state.signal = p.signals[0] ? p.signals[0].id : "";
    state.stepIdx = 0;
  }

  function loadStarter() {
    loadPreset("classic");
    state.part = "procedural";
    state.signal = "a";
    state.stepIdx = 0;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          preset: state.preset,
          part: state.part,
          signal: state.signal,
          stepIdx: state.stepIdx,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!PRESETS[d.preset]) return false;
      state.preset = d.preset;
      const p = PRESETS[d.preset];
      state.part = p.parts[d.part] ? d.part : "procedural";
      state.signal = p.signals.some((s) => s.id === d.signal) ? d.signal : p.signals[0].id;
      state.stepIdx = Math.min(p.steps.length - 1, Math.max(0, Number(d.stepIdx) || 0));
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("tb-root");
  root.innerHTML = `
    <p class="starter-note" id="starter-note"></p>
    <div class="challenge">
      <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div id="chal-quiz" class="quiz-choices" hidden></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <button type="button" class="btn btn-ghost" id="chal-load">Load challenge setup</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>TB ↔ DUT anatomy</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
          <button type="button" class="btn btn-ghost" id="btn-back">◀</button>
          <button type="button" class="btn btn-secondary" id="btn-step">Step ▶</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="tba-controls">
          <div class="tba-field">
            <label for="preset">Example</label>
            <select id="preset"></select>
          </div>
        </div>
        <div class="rule-box">DUT = design under test &nbsp;·&nbsp; TB drives with reg/logic &nbsp;·&nbsp; observe with wire/logic &nbsp;·&nbsp; $display prints &nbsp;·&nbsp; $finish ends</div>
        <div id="verdict"></div>
        <div class="tba-layout">
          <div>
            <div class="anatomy" id="anatomy"></div>
            <div class="signal-chips" id="signals"></div>
            <div class="role-card" id="role-card"></div>
          </div>
          <div>
            <pre class="code-block" id="code"></pre>
            <div class="sim-panel">
              <div class="sim-head">
                <h3>Conceptual sim log</h3>
                <span class="sim-time" id="sim-time"></span>
              </div>
              <div class="timeline" id="timeline"></div>
              <pre class="console" id="console"></pre>
            </div>
            <p class="tba-meta" id="meta"></p>
          </div>
        </div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const p = currentPreset();
    document.getElementById("starter-note").textContent =
      "Starter example: and2 DUT with reg a,b / wire y, $display of y, then $finish. Click anatomy parts and Step the timeline.";

    const sel = document.getElementById("preset");
    sel.innerHTML = Object.keys(PRESETS)
      .map((k) => `<option value="${k}">${PRESETS[k].label}</option>`)
      .join("");
    sel.value = state.preset;

    document.getElementById("verdict").innerHTML =
      `<div class="verdict ${p.verdict}">${escapeHtml(p.verdictText)}</div>`;

    const order = ["stimulus", "observe", "dut", "procedural"];
    const partsHtml = order
      .map((key) => {
        const part = p.parts[key];
        if (!part) return "";
        const active = state.part === key ? " active" : "";
        const risk = part.risk ? " risk" : "";
        const dut = part.isDut ? " dut-box" : "";
        return `<button type="button" class="part${active}${risk}${dut}" data-part="${key}">
          <span class="part-kicker">${part.isDut ? "DUT" : "TB"}</span>
          <span class="part-title">${escapeHtml(part.title)}</span>
          <span class="part-meta">${escapeHtml(part.meta)}</span>
        </button>`;
      })
      .join("");

    document.getElementById("anatomy").innerHTML = `
      <div class="tb-shell">
        <p class="tb-shell-label">${escapeHtml(p.parts.tb.title)}</p>
        <div class="anatomy-grid">${partsHtml}</div>
      </div>`;

    document.querySelectorAll("button.part").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.part = btn.dataset.part;
        saveSession();
        renderAll();
      });
    });

    document.getElementById("signals").innerHTML = p.signals
      .map((sig) => {
        const active = state.signal === sig.id ? " active" : "";
        return `<button type="button" class="role-${sig.role}${active}" data-sig="${sig.id}">${escapeHtml(
          sig.name
        )} · ${sig.role}</button>`;
      })
      .join("");

    document.querySelectorAll("#signals button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.signal = btn.dataset.sig;
        saveSession();
        renderAll();
      });
    });

    const sig = p.signals.find((s) => s.id === state.signal) || p.signals[0];
    const badgeCls = sig.role === "wire" ? "wire" : sig.role === "logic" ? "logic" : sig.role === "bad" ? "bad" : "";
    document.getElementById("role-card").innerHTML = `
      <span class="role-badge ${badgeCls}">${escapeHtml(sig.role)} · ${escapeHtml(sig.where)}</span>
      <h3>${escapeHtml(sig.name)}</h3>
      <p>${escapeHtml(sig.blurb)}</p>`;

    const highlightKey = state.part === "tb" ? "" : state.part;
    document.getElementById("code").innerHTML = highlightCode(p.code, highlightKey, p.parts);

    const step = p.steps[state.stepIdx] || p.steps[0];
    document.getElementById("sim-time").textContent = `t=${step.t}`;

    document.getElementById("timeline").innerHTML = p.steps
      .map((st, i) => {
        const active = i === state.stepIdx ? " active" : "";
        const done = i < state.stepIdx ? " done" : "";
        return `<button type="button" class="${active}${done}" data-i="${i}">t=${st.t}</button>`;
      })
      .join("");

    document.querySelectorAll("#timeline button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.stepIdx = Number(btn.dataset.i);
        saveSession();
        renderAll();
      });
    });

    const lines = p.steps.slice(0, state.stepIdx + 1).map((st) => {
      return `<span class="${st.kind}">${escapeHtml(st.log)}</span>`;
    });
    document.getElementById("console").innerHTML =
      lines.join("\n") || `<span class="muted">(no events)</span>`;

    document.getElementById("meta").textContent =
      `Values @ t=${step.t}: a/d-side=${step.a}  b/other=${step.b}  y/q=${step.y} · click parts & chips to explore roles`;
  }

  function renderChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (state.showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = state.showHint ? "Hide hint" : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    if (ch.type === "quiz") {
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="tba-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === state.challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        state.challengeIdx = i;
        state.showHint = false;
        state.quizChoice = "";
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function loadChallengeSetup() {
    const ch = CHALLENGES[state.challengeIdx];
    if (ch.type === "quiz") {
      setChalStatus("idle", "Quiz — pick an answer");
      return;
    }
    if (ch.id === "run-wire-mistake") loadPreset("wireDrive");
    else if (ch.id === "run-sv-logic") loadPreset("svLogic");
    else if (ch.id === "run-clocked") {
      loadPreset("clocked");
      state.part = "stimulus";
    } else if (ch.id === "run-self-check") loadPreset("selfCheck");
    else if (ch.id === "run-no-finish") loadPreset("noFinish");
    else {
      loadPreset("classic");
      if (ch.id === "run-select-dut") state.part = "stimulus";
      if (ch.id === "run-select-stim") state.part = "dut";
      if (ch.id === "run-signal-a" || ch.id === "run-signal-y") state.signal = "b";
      if (ch.id === "run-step-display" || ch.id === "run-step-finish") state.stepIdx = 0;
    }
    saveSession();
    renderAll();
    setChalStatus("idle", "Setup loaded — finish, then Check");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else ok = !!ch.check(state);
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds = [...clearedIds, ch.id];
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("pass", "Pass");
      renderChallenge();
    } else setChalStatus("fail", "Not yet");
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("preset").addEventListener("change", (e) => {
    loadPreset(e.target.value);
    saveSession();
    renderAll();
  });
  document.getElementById("btn-step").addEventListener("click", () => {
    const p = currentPreset();
    state.stepIdx = Math.min(p.steps.length - 1, state.stepIdx + 1);
    saveSession();
    renderAll();
  });
  document.getElementById("btn-back").addEventListener("click", () => {
    state.stepIdx = Math.max(0, state.stepIdx - 1);
    saveSession();
    renderAll();
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.quizChoice = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeSetup);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
