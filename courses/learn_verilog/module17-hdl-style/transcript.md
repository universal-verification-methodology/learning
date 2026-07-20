# Module 17 — HDL style

**Module id:** module17-hdl-style
**Lab:** hdl-style
**Tracks:** A · B

## Slide 1 — HDL style

Synthesizability lint asks whether your code can become gates. HDL style asks whether your code is easy for humans and tools to read. Consistent naming, the right always-block keyword for sequential versus combinational logic, and modern types like logic instead of legacy reg all help teammates review your RTL faster and catch mistakes earlier. This module is that style layer — teaching hints, not a corporate style guide.

## Slide 2 — Naming and block keywords

Clock nets should be named clk or end with underscore clk so every reader spots the timing reference instantly. Active-low reset should use rst_n or reset_n — the underscore n suffix signals low-active without reading the sensitivity list. For edge-triggered registers, SystemVerilog prefers always_ff over plain always at posedge. For combinational procedural logic, prefer always_comb over always at-star. For new RTL, prefer logic over reg when your toolchain supports it. These are info-level hints in the teaching linter — they do not block simulation, but they train good habits.

## Slide 3 — Browser lab

![HDL style lab starter](assets/lab-starter.png)

In the browser lab track, open the naming and style checker from the tools page. The starter loads a clean flip-flop with clk and rst_n — lint reports ok with zero findings. Use the snippet buttons to see what breaks style: clock instead of clk, reset instead of rst_n, always at posedge instead of always_ff, always at-star instead of always_comb, and output reg instead of logic. Hit Lint after each snippet, read the rule name, and try the fix challenges that rename ports until the warnings disappear. The same lintStyle API powers live hints in the simulator IDE.

## Slide 4 — Real Verilog practice

![Real Verilog - styled flip-flop and combo](assets/real-shell.png)

In the real Verilog track, open this module's examples folder. One sketch is a flip-flop with conventional clk and rst_n naming and non-blocking updates. The second is a simple AND gate using continuous assign — the cleanest combinational style. A commented bad example shows clock and reset naming that would trigger style warnings in the lab. If Icarus is available, run a syntax-only compile on the good modules.

```verilog
// style_demo.v - conventional naming and block style
module ff_styled(
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

module and2_styled(
  input  a,
  input  b,
  output y
);
  assign y = a & b;
endmodule

// clock_bad - style warnings (commented)
// module clock_bad(input clock, d, output reg q);
//   always @(posedge clock) q <= d;
// endmodule

// iverilog -t null style_demo.v - syntax check only
```

## Slide 5 — Pitfalls to watch

Do not confuse style hints with synthesizability errors — a module can simulate and synthesize fine while still triggering name-clk or prefer-always-ff warnings. Do not rename signals randomly; pick one convention per project and stick to it. Do not use always at-star for clocked logic or always at posedge for pure combinational blocks — the keyword choice documents intent. And do not assume this teaching pack replaces Verible or your company's signed-off style guide — it teaches the categories you will see in real review tools.

## Slide 6 — Your turn

Complete the checklist for at least one track, ideally both. In the browser lab, load the clock-not-clk snippet and fix it until name-clk disappears. In real Verilog, rename any reset signal in an old sketch to rst_n and verify the sensitivity list still matches. When you finish, take the short quiz, then continue to FSM and datapath in RTL in the next module.
