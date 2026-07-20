# Module 08 — Blocking vs non-blocking

**Module id:** module08-blocking-vs-nonblocking  
**Lab:** blocking-vs-nonblocking  
**Tracks:** A · B

## Slide 1 — Blocking vs non-blocking

In a clocked always block, equals is blocking assignment and less-than-or-equals is non-blocking. Blocking runs statements in order—each right-hand side can see updates from earlier lines in the same clock edge. Non-blocking samples every right-hand side first, using values from before the edge, then updates all left-hand sides together. This module is that timing difference: why flip-flops use non-blocking, and how a pipeline or swap can go wrong with blocking.

## Slide 2 — Same edge, different story

Picture a two-stage pipeline: q1 gets d, then q2 gets q1. With blocking, q2 equals q1 after q1 already took the new d—both stages collapse into one edge. With non-blocking, q2 still sees the old q1, so you get a real one-cycle delay per stage. The swap gotcha is the same idea: blocking a equals b then b equals a copies b twice; non-blocking samples both old values and actually trades them. Rule of thumb: combinational always at-star uses equals; clocked sequential uses less-than-or-equals.

## Slide 3 — Browser lab

![Blocking vs non-blocking lab starter](assets/lab-starter.png)

In the browser lab track, open the blocking-versus-nonblocking lab from the tools page. You get side-by-side panels—blocking on one side, non-blocking on the other—with the same clock and stimulus. Pick scenarios like register swap, two-stage pipeline, or copy chain. Step the clock and watch the watched signals. Load the starter example first, then work a few challenges and use Check when you can predict which side matches the prompt.

## Slide 4 — Real Verilog practice

![Real Verilog — flip-flop and pipeline with non-blocking](assets/real-shell.png)

In the real Verilog track, open this module’s examples folder. One sketch is a simple D flip-flop: on each rising clock edge, Q less-than-or-equals D. The other is a two-register pipeline—q1 less-than-or-equals D, then q2 less-than-or-equals q1—so q2 trails q1 by a full cycle. If Icarus is available, run a syntax-only compile; the point is the assignment operator choice, not a full testbench run.

```verilog
// blocking_nba.v — sequential style uses non-blocking
module ff_nba(
  input      clk,
  input      D,
  output reg Q
);
  always @(posedge clk)
    Q <= D;
endmodule

module pipe_nba(
  input      clk,
  input      D,
  output reg q1,
  output reg q2
);
  always @(posedge clk) begin
    q1 <= D;
    q2 <= q1;  // old q1 — true pipeline delay
  end
endmodule

// iverilog -t null blocking_nba.v — syntax check only
```

## Slide 5 — Pitfalls to watch

Do not use blocking equals inside clocked always blocks unless you mean that in-order behavior—and in coursework you usually do not. Do not mix blocking and non-blocking on the same register in one edge without a clear reason. Do not use non-blocking in combinational at-star blocks—it is for sequential logic. If your pipeline shows zero delay between stages, check for blocking assignments first.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, step through the swap scenario and explain why only the non-blocking side trades values. On real Verilog, write a clocked always block that uses non-blocking for every register update. When you are ready, take the short quiz, then continue to parameters and width in the next module.
