# Module 00 — Welcome to Verilator

**Module id:** module00-intro
**Lab:** none (intro)
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Welcome to Verilator

Welcome to learn Verilator. This path treats Verilator as a tool you can rely on every day: lint your RTL, wrap it in a C++ or DPI testbench, capture traces, and read verification metrics. You are not here for a full UVM course—that lives elsewhere. You are here to get fast, cycle-accurate simulation working in a real flow.

## Slide 2 — What you will build toward

Across the modules you will choose when Verilator beats Icarus, walk the compile-to-run pipeline, clean up lint with intent, host a C++ testbench with an eval loop, generate clock and reset patterns that release cleanly, turn tracing on and dump waves you can actually open, expose only what the host needs, and glance at pass rate and coverage before sign-off. Module ten is an offline build-and-run capstone; module eleven closes the loop.

## Slide 3 — Two tracks, one idea

Track A is real Verilator on your machine: a C++ toolchain, Makefiles, and examples in the legacy Verilator course tree. Track B is the platform’s simulation literacy labs—browser challenges for chooser, pipeline, lint, trace, and metrics ideas. You may do either track, or both. A good rhythm is browser lab first for the vocabulary, then Track A for fidelity.

## Slide 4 — Set up Track A

Install Verilator and confirm the version command works in your shell. Open this course folder and skim module READMEs and EXAMPLES prompts as you go. When a module offers a self-check script, use it to grade checklist items. Keep the sibling Icarus course in mind—you will compare the two tools early on.

## Slide 5 — Set up Track B

![Tools index](assets/tools-index.png)

From the monorepo root, serve the platform folder with a simple local web server, then open the tools index and jump to the Simulation literacy section. All nine Verilator browser labs ship on the live site too. Confirm you can reach the index—the next module sends you into the Icarus versus Verilator chooser lab.

## Slide 6 — How to move through modules

For each module, read the README for the outcome, pick a track—or both—then work the checklist. Prefer Track B when you want graded challenges; prefer Track A when you want install fidelity and real VCD or FST files. When you finish this intro checklist, continue to Icarus versus Verilator.
