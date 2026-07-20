# Module 00 — Welcome to Verilog RTL

**Module id:** module00-intro  
**Lab:** none (intro)  
**Tracks:** A · B (course setup)

## Slide 1 — Welcome to Verilog RTL

In digital design you will write register-transfer level code—the logic that describes what your chip or block should do, cycle by cycle. This short clip welcomes you to learn Verilog, and shows how the course is meant to be used.

## Slide 2 — Why RTL matters

Coursework is not only drawing block diagrams. You need modules with ports, wires and registers, and always blocks that synthesize cleanly. Later labs—counters, shift registers, lint, and the bridge into finite-state machines—all assume you can read and write small Verilog sketches without guessing. Getting comfortable here pays off in every later design and verification course.

## Slide 3 — Two tracks, one idea

Every lab module offers two ways to practice. The real Verilog track uses your own editor and optional local simulator, so ports, assignments, and style rules feel like work you will keep. The browser lab track uses interactive tools on the learning platform, so you can build intuition without installing anything. You may do either track, or both. The usual rhythm is browser first for the idea, then a tiny dot-v sketch for muscle memory.

## Slide 4 — Set up the real Verilog track

Open a text editor for dot-v files—VS Code, Cursor, or vim all work. Clone or open this course repo and skim the examples folder when a module points you there. Optionally confirm a simulator is reachable: local Icarus with iverilog and vvp, or the browser HDL simulator linked from the course README. You do not need a full EDA install on day one—a short sketch you can compile or paste is enough to start.

## Slide 5 — Set up the browser lab track

![Tools index](assets/lab-tools-index.png)

From the monorepo, serve the platform folder with a simple local web server, then open the tools index in your browser. Serving the folder means your browser can load the interactive labs as ordinary web pages. If you prefer, use the published tools site instead. Scroll to the Verilog section when you are curious—you will meet the module and port diagram lab in the very next module.

## Slide 6 — How to move through modules

For each module, read the README for the outcome, pick a track—or both—then work the checklist. SystemVerilog design constructs and UVM are later courses; this path stays in the IEEE 1364 family. When you finish this intro checklist, continue to the first lab module: the module and port diagram.
