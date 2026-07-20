# Module 10 — Build & run a Verilator example

**Module id:** module10-offline-verilator-example
**Lab:** course-makefile (offline)
**Tracks:** A (real Verilator + C++/Makefile) only

## Slide 1 — Offline capstone

This module has no graded browser lab. Your job is to build and run a real Verilator example offline using the legacy Verilator course tree bundled beside this path. You will prove the toolchain end to end—not merely click through a diagram.

## Slide 2 — Where to work

Open the sibling learn Verilator Icarus legacy repository from the monorepo courses folder. Follow its README and module scripts for a small Verilator plus C++ or Verilog testbench example. The exact target names vary by legacy module—that is normal. Capture the commands you used and whether the run passed.

## Slide 3 — A typical command shape

Change into the legacy course root, pick a minimal example target, run make or the documented script, then execute the produced binary or test runner. You should see compile, build, and run stages complete with a pass or an explainable fail. Write the command sequence in your notes as if a teammate must replay it tomorrow.

## Slide 4 — What to record

Note Verilator version, the example name, pass or fail, and one artifact—log snippet, wave file, or stdout line—that proves the run happened. If something failed, record the stage—compile, link, or run—and the first error line. Fixes belong in your notes too; this is practice, not a hidden autograder.

## Slide 5 — Pitfalls to watch

Do not substitute a browser lab for this offline requirement. Do not assume one Makefile from a blog matches the legacy tree—read the local README. Do not skip capturing results; module eleven assumes you attempted a real run. And if install is broken, fix install before blaming RTL.

## Slide 6 — Your turn

Complete the offline checklist: one real build and run from the legacy tree, commands and outcome recorded. Optional stretch: produce a short trace from the same example. When you are ready, take the short quiz, then continue to the wrap module.
