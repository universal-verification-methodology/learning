# Module 08 — Verilator public

**Module id:** module08-verilator-public
**Lab:** verilator-public
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Exposing signals to C++

Not every internal net is visible to your C++ testbench by default. Module ports are already visible at the boundary. Internal signals stay hidden unless you mark them with the Verilator public comment pragma. The design goal is minimal exposure—only what the host truly needs to check or drive.

## Slide 2 — Public, hidden, and ports

Ports are your contract—no pragma required for normal top-level access patterns. Unmarked internals are HIDDEN from the host’s perspective unless you peek via hierarchy tricks you should not rely on in production. Mark selectively with the public comment when a scoreboard or checker in C++ must read an internal register. More exposure slows compile and couples TB to implementation details.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the public visibility lab, load the starter RTL and decide which signals need the public marker for a C++ check. Challenges show over-marked designs—everything public—and under-marked designs where the host cannot see the net under test. Reach ready with minimal marking.

## Slide 4 — Real Verilator practice

In Track A, take a tiny module with one internal counter. Run once without public markers and note what the host cannot see. Add a public marker on the one net you must observe, recompile, and confirm access. Remove gratuitous markers before you commit—minimal is the rule.

## Slide 5 — Pitfalls to watch

Do not mark every signal public to avoid thinking about interfaces. Do not assume ports need the pragma—they already belong to the boundary. Do not hide required check signals and then debug blind in C++. And remember recompile is required after marker changes—this is not a runtime poke.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, pass minimal-marking challenges. In Track A, expose one internal net intentionally and read it from the host. When you are ready, take the short quiz, then continue to verification metrics.
