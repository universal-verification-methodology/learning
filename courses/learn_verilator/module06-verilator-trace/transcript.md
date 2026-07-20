# Module 06 — Verilator trace

**Module id:** module06-verilator-trace
**Lab:** verilator-trace
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Turning trace on

Waves require two cooperating pieces: a compile-time trace flag and host code that opens a trace file, dumps cycles, and closes cleanly. Verilator offers VCD and FST-style paths depending on flags. Trace without dump is OPEN— you paid for infrastructure but recorded nothing useful.

## Slide 2 — Flag plus dump calls

Enable trace at compile with the trace or trace-fst flags as your flow requires. In the host, create a trace pointer, open a file, call dump each eval step you care about, then close at shutdown. Dump without the compile flag is BLIND—you wrote files the model never instrumented. Both sides must agree.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the trace lab, load the starter and pair compile flags with open, dump, and close steps until status reads ready. Scenarios deliberately show OPEN—flag without dump—and BLIND—dump without flag—so you learn the pairing, not just one magic checkbox.

## Slide 4 — Real Verilator practice

In Track A, run a tiny design with trace enabled, produce a wave file, and open it in a viewer. Point to the host lines that open and dump. Delete dump temporarily and notice OPEN behavior; compare to a correct run. Keep the file small—this module is trace literacy, not a farm dump.

## Slide 5 — Pitfalls to watch

Do not enable trace and forget dump in the eval loop. Do not dump when compile never enabled trace—BLIND files mislead you. Do not leave trace files unclosed on long runs—flush and close matter. And do not open gigabyte waves when a short window suffices.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, fix OPEN and BLIND scenarios to ready. In Track A, generate one viewable trace from a short run. When you are ready, take the short quiz, then continue to wave dump literacy.
