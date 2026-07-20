# Module 05 — Operators

**Module id:** module05-sv-operators  
**Lab:** sv-operators  
**Tracks:** A · B

## Slide 1 — Operators

RTL is mostly expressions: AND gates, compares, shifts, and bus packing. This module is the operator toolbox—bitwise versus logical, reductions, concatenation, replication, and shifts. We will try them in the browser playground, then write the same patterns in a real dot-v sketch.

## Slide 2 — Bitwise, logical, and reductions

Bitwise operators—ampersand, pipe, caret, tilde—work per bit on vectors of any width. Logical operators—double ampersand, double pipe, bang—ask whether a value is nonzero and always produce a single bit. Reduction operators—ampersand or pipe or caret in front of parentheses—fold an entire vector to one bit: all bits ANDed, any bit ORed, or parity XOR. Concatenation braces glue vectors left to right; replication repeats a pattern. Shifts move bits with zero fill or, for arithmetic right shift, sign-bit fill.

## Slide 3 — Browser lab

![SV operators lab starter](assets/lab-starter.png)

In the browser lab track, open the operator playground from the tools page. You will see challenges at the top, operand fields A and B, a row of operator buttons, and a result card with the bit pattern. Load the starter example—four apostrophe b one zero one zero bitwise AND four apostrophe b one one zero zero—and compare that to logical AND on the same values. Try a reduction, a concat, and a left shift. Work a few challenges, then use Check when the result matches the prompt.

## Slide 4 — Real Verilog practice

![Real Verilog — operator demo](assets/real-shell.png)

In the real Verilog track, open this module’s examples folder and read the operator demo module. One assign uses bitwise AND on four-bit buses; another uses logical AND to get a single flag. Concatenation packs two nibbles into a byte; reduction AND tests whether every bit of a is one. If Icarus is available, run a syntax-only compile. These expression shapes appear in every counter, mux, and compare you write later.

```verilog
// operators.v — bitwise vs logical, concat, reduction
module operator_demo(
  input  wire [3:0] a,
  input  wire [3:0] b,
  output wire [3:0] bw_and,
  output wire       log_and,
  output wire [7:0] cat_ab,
  output wire       all_ones
);
  assign bw_and   = a & b;   // per-bit AND
  assign log_and  = a && b;  // logical AND → 1 bit
  assign cat_ab   = {a, b};  // concat left then right
  assign all_ones = &a;      // reduction AND
endmodule

// iverilog -t null operators.v — syntax check only
```

## Slide 5 — Pitfalls to watch

Do not swap bitwise and logical AND—four apostrophe b one zero one zero AND four apostrophe b one one zero zero is four bits wide, but the same values with double ampersand collapse to one bit. Do not confuse concat order: left operand becomes the upper bits. Arithmetic right shift fills with the sign bit; logical right shift fills with zero. And remember: the playground teaches expression literacy—you still owe correct operators in synthesizable RTL.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, load the starter and finish a few challenges. On real Verilog, write or edit a sketch that uses at least one bitwise and one logical operator. When you are ready, take the short quiz, then continue to sensitivity lists in the next module.
