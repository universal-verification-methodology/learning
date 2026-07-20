# Module 09 — Parameter and width

**Module id:** module09-param-width  
**Lab:** param-width  
**Tracks:** A · B

## Slide 1 — Parameter and width

Reusable RTL names its bus widths once and threads them through ports, locals, and instances. A parameter is a compile-time constant you can override per instance with hash-dot syntax. Width minus one down to zero is how you declare an N-bit vector—WIDTH eight becomes bracket seven colon zero. This module is that pattern: parameterized buses, depth driving address width with clog-two, and when sums need one extra bit for carry.

## Slide 2 — One knob, many places

Declare parameter WIDTH equals eight, then use WIDTH minus one colon zero on every data port. Instantiate with bus slice hash-dot WIDTH open-paren sixteen close-paren and both ports widen together—no hand-editing every bracket. For memory, DEPTH sets how many words you have; address width tracks clog-two of depth. For an adder, operands stay WIDTH wide but the sum is often WIDTH plus one to hold carry. Localparam is the same idea but fixed inside the module—you derive ADDR_W from DEPTH instead of exposing every helper constant at the boundary.

## Slide 3 — Browser lab

![Parameter width lab starter](assets/lab-starter.png)

In the browser lab track, open the param-width lab from the tools page. Pick a template—parameterized bus, memory with depth, wide adder, or FIFO pointers. Drag the WIDTH or DEPTH sliders and watch the derived chips update: MSB index, bracket notation, clog-two, pointer width. Load the starter example, try a few parameter values, then work the quiz-style challenges and use Check when your bracket range matches the prompt.

## Slide 4 — Real Verilog practice

![Real Verilog — parameterized bus and adder](assets/real-shell.png)

In the real Verilog track, open this module’s examples folder. One sketch is a parameterized bus slice—data in and data out share the same WIDTH. The other is a wide adder: operands are WIDTH bits, sum is WIDTH plus one for carry. If Icarus is available, run a syntax-only compile; the lesson is declaring and overriding parameters, not simulating full memory behavior.

```verilog
// param_width.v — parameter drives port ranges
module bus_slice #(
  parameter WIDTH = 8
)(
  input  [WIDTH-1:0] data_in,
  output [WIDTH-1:0] data_out
);
  assign data_out = data_in;
endmodule

module add_wide #(
  parameter WIDTH = 4
)(
  input  [WIDTH-1:0] a,
  input  [WIDTH-1:0] b,
  output [WIDTH:0]   sum
);
  assign sum = {1'b0, a} + {1'b0, b};
endmodule

// iverilog -t null param_width.v — syntax check only
```

## Slide 5 — Pitfalls to watch

Do not hard-code bracket seven colon zero everywhere when WIDTH might change—use WIDTH minus one colon zero. Do not forget sum needs WIDTH plus one when adding two WIDTH-bit values. Do not assume clog-two of depth is always at least one—depth one is a special case in real designs. Do not confuse parameter overrides at instantiation with port wiring—they are different hash-dot lists.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, set WIDTH to sixteen and state the MSB index and bracket range. On real Verilog, add a parameter to a module and override it in one instance. When you are ready, take the short quiz, then continue to named versus positional port connections in the next module.
