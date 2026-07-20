# Module 01 — iverilog vs Verilator

**Module id:** module01-iverilog-vs-verilator
**Lab:** iverilog-vs-verilator
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — iverilog vs Verilator

Before you compile anything, pick the right engine for the job. Icarus Verilog shines when you need event scheduling, delays, and teaching-friendly SystemVerilog testbenches. Verilator shines when you need long regressions, C++ cosimulation, and cycle-accurate speed. This module trains a job-first choice—not brand loyalty.

## Slide 2 — Match the scenario

Use Icarus when the lesson is hash delays, initial blocks, and classic event-driven testbenches. Use Verilator when the job is a Makefile regression farm, a C++ host driving Vtop, or millions of cycles overnight. The browser lab presents matched scenarios: same design idea, different tool fit. Read the scenario before you click a answer.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the browser chooser lab, load the starter example and work through matched scenarios until status reads ready. Each challenge names a job—teach delays, quick sanity sim, long farm run, C++ cosim—and asks which tool fits. Treat wrong picks as learning: restate why the other tool would hurt that job.

## Slide 4 — Real Verilator practice

In Track A, open this module’s EXAMPLES prompts and the legacy course tree. Run one tiny design with Icarus for event-style sanity, then sketch how the same block would enter a Verilator compile-to-binary flow. You do not need a perfect port—just articulate what changes when delays disappear and a C++ main appears.

## Slide 5 — Pitfalls to watch

Do not reach for Verilator when the lesson requires hash delays and timing checks Icarus models cleanly. Do not reach for Icarus when you need fast cycle regressions at scale. Do not assume “simulator is simulator”—paradigm mismatch wastes afternoons. And do not treat the browser lab as proof your install works; that is Track A’s job.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, finish matched scenarios with ready status. In Track A, name one job for each tool from your own work. When you are ready, take the short quiz, then continue to the simulation pipeline.
