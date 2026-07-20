# Module 04 — C++ TB / DPI sketch

**Module id:** module04-dpi-cpp-tb
**Lab:** dpi-cpp-tb
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — C++ host testbench

Verilator’s native cosim shape is a C++ host driving a generated model pointer—traditionally Vtop—inside an eval loop. That is a different paradigm from a classic SystemVerilog testbench with initial blocks and forever clocks. This module keeps the paradigms separate so you do not mix them by accident.

## Slide 2 — Eval loop vs SV TB

The host allocates the model, toggles inputs, calls eval for each time step, and checks outputs in C++. DPI can bridge to C functions when you need it, but DPI is optional glue—not a replacement for knowing where the eval loop lives. A classic SV testbench compiled elsewhere follows different rules; do not paste UVM-style TB into a Verilator C++ main and hope.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the browser lab, load the starter and identify host, model, and eval loop regions on the diagram. Challenges ask which code belongs in C++ main versus RTL versus optional DPI imports. Finish with status ready when you can sketch the loop in plain language.

## Slide 4 — Real Verilator practice

In Track A, open a minimal C++ host example from EXAMPLES or the legacy tree. Point to where the model is constructed, where eval is called in a loop, and where the run ends. If DPI appears, name one function it exports or imports—optional detail, not the whole story.

## Slide 5 — Pitfalls to watch

Do not mix a full SV event testbench paradigm with a Verilator C++ main in the same flow without knowing exactly what you are doing. Do not call eval once and assume time advanced forever. Do not treat DPI as mandatory—many flows are pure C++. And do not debug RTL in waves before confirming the host actually stepped cycles.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, label host, model, and eval loop correctly. In Track A, run one tiny C++ host binary once. When you are ready, take the short quiz, then continue to clock and reset patterns.
