# Module 03 — wire vs reg

**Module id:** module03-wire-vs-reg  
**Lab:** wire-vs-reg  
**Tracks:** A · B

## Slide 1 — wire vs reg

Classic Verilog splits names into two families: nets, declared with wire, and variables, declared with reg. The keyword is not about whether something is a flip-flop—it is about how you are allowed to drive the name. This module is that rule set: continuous assign versus procedural assign, and why the same AND gate might be legal on a wire and illegal on a reg.

## Slide 2 — Nets versus variables

A wire is a net. You drive it with continuous assign, primitive gates, or port connections—not with always blocks as the left-hand side. A reg is a variable. You drive it inside procedural blocks: always at star for combinational logic, or always on the clock edge for storage. Input ports are nets in IEEE 1364. Output can be a net if assign drives it, or a reg if always drives it. The driving style picks the type—not the other way around.

## Slide 3 — Browser lab

![Wire vs reg lab starter](assets/lab-starter.png)

In the browser lab track, open the classic wire versus reg lab from the tools page. You will see challenges at the top, a drive-style picker and type picker in the middle, a code snippet, and a legal-or-illegal verdict. Load the starter example—assign plus wire—and confirm it is legal. Flip the type to reg with assign still selected and watch the verdict turn illegal. Try combo always plus reg next: legal, but still not automatically a flip-flop. Work a few challenges, then use Check when the state matches the prompt.

## Slide 4 — Real Verilog practice

![Real Verilog — wire and reg drivers](assets/real-shell.png)

In the real Verilog track, open this module’s examples folder and read the wire versus reg demo. One output is a net driven by continuous assign; the other is a reg driven in always at star. Same Boolean function, two legal classic patterns. If Icarus is available, run a syntax-only compile. You will reuse this split everywhere: assign for nets, always for variables.

```verilog
// wire_vs_reg.v — same AND, two legal driving styles
module wire_reg_demo(
  input  a,
  input  b,
  output y_net,
  output reg y_var
);
  assign y_net = a & b;      // continuous assign → net
  always @(*) y_var = a & b; // procedural assign → variable
endmodule

// iverilog -t null wire_vs_reg.v — syntax check only
```

## Slide 5 — Pitfalls to watch

Do not read reg as “register hardware”—combo always blocks still need a reg on the left. Do not continuous-assign a reg or procedural-assign a wire; tools and the lab flag that as illegal in classic Verilog. SystemVerilog logic blurs the picture in later courses; this module stays in IEEE 1364 rules on purpose. And remember: the browser lab teaches legality literacy—you still owe correct declarations in RTL you commit.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, load the starter and finish a few challenges. On real Verilog, write or edit a sketch with one assign-driven net and one always-driven variable. When you are ready, take the short quiz, then continue to ANSI versus non-ANSI ports in the next module.
