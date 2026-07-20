# Module 16 — Synthesizability lint

**Module id:** module16-synth-lint
**Lab:** synth-lint
**Tracks:** A · B

## Slide 1 — Synthesizability lint

Not every Verilog fragment that simulates cleanly will synthesize to real gates. Synthesizability lint is a static check that flags constructs a synthesis tool cannot map to hardware: delays, initial blocks, system tasks, latch-risk incomplete branches, blocking assignment inside flip-flops, and non-blocking assignment in combinational logic. This module teaches you to read those warnings before they become late surprises in your flow.

## Slide 2 — What the linter catches

The teaching rule pack covers the most common classroom mistakes. Hash-delay on assigns or gates is simulation timing, not hardware. Initial blocks and dollar-display tasks belong in testbenches, not RTL modules. An always-at-star if without else can infer a latch. Inside an always-ff clocked block, use non-blocking assignment for register outputs. Inside always-comb, use blocking assignment instead. Timed always loops with hash-five are clock generators for simulation only. Clean RTL like a simple assign of Y equals A and B passes with zero findings.

## Slide 3 — Browser lab

![Synth lint lab starter](assets/lab-starter.png)

In the browser lab track, open the synthesizability linter from the tools page. The starter loads a clean two-input AND with assign — lint reports ok with no findings. Use the snippet buttons to load bad examples: assign with hash-delay, initial blocks, incomplete if for latch risk, blocking equals in a flip-flop, and non-blocking in combinational logic. Hit Lint after each snippet and read the rule name and severity. Work the challenges until you can predict which rule fires, then use Check.

## Slide 4 — Real Verilog practice

![Real Verilog - clean vs lint violations](assets/real-shell.png)

In the real Verilog track, open this module's examples folder. One sketch is a clean AND gate that passes synthesizability lint. The second is a proper flip-flop using always-ff with non-blocking assignment and async reset. A commented delay example shows what not to ship — it parses in simulation but would fail lint. If Icarus is available, run a syntax-only compile on the clean modules.

```verilog
// synth_demo.v - clean RTL vs common lint violations
module and2_clean(
  input  a,
  input  b,
  output y
);
  assign y = a & b;
endmodule

module ff_good(
  input        clk,
  input        rst_n,
  input        d,
  output reg   q
);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) q <= 1'b0;
    else        q <= d;
  end
endmodule

// delay_bad - NOT synthesizable (commented)
// module delay_bad(input a, output y);
//   assign #5 y = a;
// endmodule

// iverilog -t null synth_demo.v - syntax check only
```

## Slide 5 — Pitfalls to watch

Do not treat a green simulation as proof of synthesizability — delays and initial blocks simulate fine but do not map to gates. Do not copy testbench patterns like dollar-display into RTL modules. Do not mix blocking and non-blocking styles inside the same clocked always block. Do not assume this teaching linter replaces industrial tools like Yosys or Vivado — it teaches the rule categories, not every vendor quirk. Run lint early and fix findings before you commit.

## Slide 6 — Your turn

Complete the checklist for at least one track, ideally both. In the browser lab, load the latch snippet and name the rule that fires. In real Verilog, take a sketch from an earlier module and run it through the linter mentally: any delays, initial blocks, or incomplete branches? When you finish, take the short quiz, then continue to HDL style in the next module.
