# Module 02 — Verilog literals

**Module id:** module02-verilog-literals  
**Lab:** verilog-literals  
**Tracks:** A · B

## Slide 1 — Verilog literals

Constants show up everywhere in RTL—reset values, parameter defaults, and compare masks. This module is how Verilog writes those constants: sized and unsized literals in binary, octal, decimal, and hex, plus signed forms and the special X and Z digits for simulation. We will decode them in the browser lab, then write the same patterns in a real dot-v file.

## Slide 2 — How literals are built

A sized literal has three parts: a width in bits, an apostrophe and base letter—b for binary, o for octal, d for decimal, or h for hex—and the digits themselves. Eight apostrophe h F F is eight bits of all ones. An unsized literal like apostrophe b one zero one zero still has a base but lets the tool infer width from context. Add s after the apostrophe for signed interpretation—eight apostrophe s d minus one is negative one in eight bits. Underscores between nibbles are cosmetic; they do not change the value.

## Slide 3 — Browser lab

![Verilog literals lab starter](assets/lab-starter.png)

In the browser lab track, open the Verilog literal decoder from the tools page. You will see the challenge list, a text field for the literal, and a decode panel showing width, base, the bit vector, and unsigned or signed values. The starter is eight apostrophe h two A—load it and watch how the bits and decimal value appear. Work a few challenges—binary width, hex F F, signed minus one—and use Check when the decode matches the prompt. The lab covers truncation and X slash Z too; explore at your own pace.

## Slide 4 — Real Verilog practice

![Real Verilog — literal localparams](assets/real-shell.png)

In the real Verilog track, open this module’s examples folder and read the literal demo sketch. Local parameters are a safe place to practice constants: a four-bit binary pattern, an eight-bit hex mask, a decimal width, and a signed negative one. If Icarus is available, run a syntax-only compile; otherwise, keeping these forms in your editor is enough. You will paste the same literal shapes into assigns and case items later in the course.

```verilog
// literals.v — sized bases you will see in every RTL file
module literal_demo;
  localparam [7:0]  MASK_FF = 8'hFF;   // 8-bit hex — all ones
  localparam [3:0]  PATTERN = 4'b1010; // 4-bit binary
  localparam [15:0] COUNT   = 16'd42;  // 16-bit decimal
  localparam [7:0]  NEG1    = 8'shFF;  // signed −1 when read as 8-bit signed
endmodule

// iverilog -t null literals.v — syntax check only
```

## Slide 5 — Pitfalls to watch

Do not ignore width—four apostrophe h F F truncates to four bits, and the tool should warn you. Do not treat signed and unsigned as interchangeable; eight apostrophe h F F as unsigned is two fifty-five, but eight apostrophe s h F F is negative one. X and Z are for simulation and unknown states—avoid them in synthesizable constants you intend to ship. And remember: the decoder lab teaches literacy; you still owe correct literals in RTL you commit.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, load the starter and finish a few challenges. On real Verilog, write or edit a minimal sketch with at least two different bases. When you are ready, take the short quiz, then continue to wire versus reg in the next module.
