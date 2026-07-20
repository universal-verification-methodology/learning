#!/usr/bin/env python3
"""Generate pass-1 transcript.md + quiz.json for learn_verilator modules."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(module: str, transcript: str, quiz: dict) -> None:
    d = ROOT / module
    d.mkdir(parents=True, exist_ok=True)
    (d / "transcript.md").write_text(transcript.strip() + "\n", encoding="utf-8")
    (d / "quiz.json").write_text(
        json.dumps(quiz, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print("wrote", module)


def q(module: str, title: str, items: list) -> dict:
    return {
        "module": module,
        "title": title,
        "passing_score": 0.67,
        "items": items,
    }


def mc(qid: str, prompt: str, choices: list[str], answer: int, explain: str) -> dict:
    return {
        "id": qid,
        "type": "multiple_choice",
        "prompt": prompt,
        "choices": choices,
        "answer": answer,
        "explain": explain,
    }


def tf(qid: str, prompt: str, answer: bool, explain: str) -> dict:
    return {
        "id": qid,
        "type": "true_false",
        "prompt": prompt,
        "answer": answer,
        "explain": explain,
    }


MODULES: list[tuple[str, str, dict]] = []

# --- 00 intro ---
MODULES.append(
    (
        "module00-intro",
        """
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
""",
        q(
            "module00-intro",
            "Welcome to Verilator",
            [
                mc(
                    "q1",
                    "This course primarily teaches Verilator as…",
                    [
                        "A daily tool flow: lint, C++/DPI TB, trace, metrics",
                        "A full UVM methodology replacement",
                        "Place-and-route for ASIC tapeout only",
                        "Git branching and code review only",
                    ],
                    0,
                    "The arc is tool literacy, not UVM depth.",
                ),
                mc(
                    "q2",
                    "Track A means practice with…",
                    [
                        "Local Verilator, C++, and Makefile examples",
                        "Only paper worksheets with no simulator",
                        "Only browser games unrelated to HDL",
                        "Only synthesis timing reports",
                    ],
                    0,
                    "Track A is the real toolchain.",
                ),
                mc(
                    "q3",
                    "Track B browser labs are best for…",
                    [
                        "Conceptual literacy before or alongside real runs",
                        "Replacing every offline compile forever",
                        "Teaching PCB layout",
                        "Skipping lint entirely",
                    ],
                    0,
                    "Labs teach ideas; Track A proves fidelity.",
                ),
                tf(
                    "q4",
                    "Deep UVM and VIP construction belong in sibling courses, not this Verilator tool path.",
                    True,
                    "This path stays focused on Verilator as a simulator tool.",
                ),
            ],
        ),
    )
)

# --- 01 iverilog-vs-verilator ---
MODULES.append(
    (
        "module01-iverilog-vs-verilator",
        """
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
""",
        q(
            "module01-iverilog-vs-verilator",
            "iverilog vs Verilator",
            [
                mc(
                    "q1",
                    "Icarus Verilog is often the better fit when…",
                    [
                        "You need event scheduling, delays, and classic SV TB teaching",
                        "You need only C++ cosim at farm scale with no TB",
                        "You never elaborate anything",
                        "You only lint without compiling",
                    ],
                    0,
                    "Icarus fits event/delay-centric teaching.",
                ),
                mc(
                    "q2",
                    "Verilator is often the better fit when…",
                    [
                        "Long regressions, speed, and C++ host cosim matter",
                        "The lesson requires hash delays in every block",
                        "You refuse to use a Makefile",
                        "You only need a one-line hello world in bash",
                    ],
                    0,
                    "Verilator targets fast cycle-accurate runs.",
                ),
                mc(
                    "q3",
                    "The browser chooser lab uses…",
                    [
                        "Matched scenarios so you pick the tool for the job",
                        "Only random tool names with no context",
                        "Only synthesis reports",
                        "Only UVM factory overrides",
                    ],
                    0,
                    "Matched scenarios train job-first thinking.",
                ),
                tf(
                    "q4",
                    "Choosing Verilator for a delay-teaching lab can waste time because Verilator is not an event-delay teaching simulator.",
                    True,
                    "Tool fit beats habit.",
                ),
            ],
        ),
    )
)

# --- 02 sim-pipeline ---
MODULES.append(
    (
        "module02-sim-pipeline",
        """
# Module 02 — Compile → elaborate → run

**Module id:** module02-sim-pipeline
**Lab:** sim-pipeline
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — The simulation pipeline

Every simulator run is a pipeline: compile sources, elaborate the design hierarchy, then execute time. Icarus and Verilator share that story even when the commands differ. If you cannot name the stage that failed, you will debug the wrong log file.

## Slide 2 — Verilator’s compile-to-binary path

Verilator’s common flow is compile with the C++ emit flag, build the generated model plus your host, then run the binary. Elaboration happens inside Verilator’s front end; the artifact you run is often an executable, not a standalone vvp-style interpreter. Status READY in the literacy lab means every stage completed—not merely “no red text somewhere.”

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the pipeline lab, load the starter and walk compile, elaborate, and run stages for both tool shapes. Drag or click until the pipeline reads ready. Challenges call out missing stages—compile without run, run without elaborate—and ask you to repair the order.

## Slide 4 — Real Verilator practice

In Track A, open EXAMPLES and run one minimal Verilator compile that emits C++, then make and execute the binary. Say out loud which log lines belong to compile versus link versus run. If the binary exits immediately, check whether the testbench host actually stepped time.

## Slide 5 — Pitfalls to watch

Do not treat “verilator ran” as “simulation succeeded”—did you build and run the host? Do not debug waves when compile never finished. Do not compare Icarus and Verilator commands flag-for-flag; compare stages. And remember READY is a whole pipeline, not one green checkbox.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, reach ready on the pipeline diagram. In Track A, run compile, build, and execute once on a tiny design. When you are ready, take the short quiz, then continue to Verilator lint.
""",
        q(
            "module02-sim-pipeline",
            "Compile → elaborate → run",
            [
                mc(
                    "q1",
                    "A complete sim pipeline includes…",
                    [
                        "Compile, elaborate, and run stages",
                        "Only waveform viewing with no compile",
                        "Only git push",
                        "Only lint with no execution",
                    ],
                    0,
                    "All three stages must succeed for READY.",
                ),
                mc(
                    "q2",
                    "Verilator’s typical Track A artifact after --cc is…",
                    [
                        "Generated C++ model plus a host binary you execute",
                        "Only a PDF report",
                        "Only a synthesized netlist for tapeout",
                        "An Icarus vvp file with no host",
                    ],
                    0,
                    "Verilator commonly emits C++ you compile and run.",
                ),
                mc(
                    "q3",
                    "If compile failed, the first debug surface is…",
                    [
                        "Compile/elaboration logs—not the wave viewer",
                        "The wave viewer only",
                        "Git blame only",
                        "Coverage database only",
                    ],
                    0,
                    "Fix the stage that failed first.",
                ),
                tf(
                    "q4",
                    "READY in the pipeline lab means every stage completed, not just that one command ran.",
                    True,
                    "Partial pipelines are not READY.",
                ),
            ],
        ),
    )
)

# --- 03 verilator-lint-lab ---
MODULES.append(
    (
        "module03-verilator-lint-lab",
        """
# Module 03 — Verilator lint

**Module id:** module03-verilator-lint-lab
**Lab:** verilator-lint-lab
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Verilator lint

Lint is cheap insurance. Verilator’s linter catches width mismatches, unused signals, inferred latches, and incomplete case statements before you spend an hour in waves. Turn warnings on with wall-class strictness and treat CLEAN, BLIND, and warnings-as-errors as deliberate policy choices—not accidents.

## Slide 2 — Common warning families

Watch for UNUSED—something you declared but never read. WIDTH—expressions that do not line up. LATCH—inferred storage you did not mean. CASEINCOMPLETE—case statements without a default or full coverage. The literacy lab tags these families so you learn the fix, not only the flag name.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the lint lab, load the starter design and practice CLEAN versus BLIND versus warnings-as-error modes. A BLIND run hides problems; CLEAN surfaces them; treating warnings as errors forces zero tolerance. Challenges ask you to fix RTL—not merely silence with blanket no-warning flags.

## Slide 4 — Real Verilator practice

In Track A, lint a tiny module with wall-level warnings enabled. Introduce one intentional WIDTH or UNUSED issue, see the message, then fix the RTL properly. Avoid the reflex to blanket-disable warnings unless you have documented why. Self-check scripts can confirm you reached a clean lint pass.

## Slide 5 — Pitfalls to watch

Do not blanket-disable warnings to greenwash a broken design. Do not confuse BLIND with CLEAN—no output is not the same as no problems. Do not ship with warnings-as-errors until your tree is actually clean. And remember: lint passes do not replace simulation—they narrow the search space.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, reach CLEAN on at least one challenge without only silencing flags. In Track A, run lint with strict warnings once. When you are ready, take the short quiz, then continue to C++ testbench and DPI.
""",
        q(
            "module03-verilator-lint-lab",
            "Verilator lint",
            [
                mc(
                    "q1",
                    "CASEINCOMPLETE usually means…",
                    [
                        "A case statement does not cover all inputs or lacks a default",
                        "The Makefile is missing",
                        "The wave file is too large",
                        "DPI is enabled twice",
                    ],
                    0,
                    "Incomplete case coverage is a common lint family.",
                ),
                mc(
                    "q2",
                    "BLIND lint mode means…",
                    [
                        "Problems may be hidden—you are not seeing warnings",
                        "Every warning is fixed automatically",
                        "Only synthesis runs",
                        "Tracing is enabled",
                    ],
                    0,
                    "BLIND hides issues; CLEAN surfaces them.",
                ),
                mc(
                    "q3",
                    "The preferred response to a WIDTH warning is…",
                    [
                        "Fix the RTL width or casting—not only blanket -Wno",
                        "Delete the module",
                        "Disable all lint forever",
                        "Force signals in the wave viewer",
                    ],
                    0,
                    "Fix root cause before silencing.",
                ),
                tf(
                    "q4",
                    "Warnings-as-errors is a policy choice that only works if the tree is actually clean.",
                    True,
                    "Werror forces zero tolerance once you can sustain it.",
                ),
            ],
        ),
    )
)

# --- 04 dpi-cpp-tb ---
MODULES.append(
    (
        "module04-dpi-cpp-tb",
        """
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
""",
        q(
            "module04-dpi-cpp-tb",
            "C++ TB / DPI sketch",
            [
                mc(
                    "q1",
                    "Verilator’s native testbench paradigm is…",
                    [
                        "A C++ host with a model pointer and an eval loop",
                        "Only a SystemVerilog initial block with no host",
                        "Only a spreadsheet",
                        "Only a synthesis constraint file",
                    ],
                    0,
                    "C++ host + eval loop is the core pattern.",
                ),
                mc(
                    "q2",
                    "DPI in this context is…",
                    [
                        "Optional glue to C functions—not the whole TB story",
                        "Required for every Verilator design",
                        "A replacement for compile",
                        "A wave format",
                    ],
                    0,
                    "DPI is optional bridging.",
                ),
                mc(
                    "q3",
                    "Mixing paradigms without intent means…",
                    [
                        "Pasting classic SV TB styles into a C++ main and hoping",
                        "Always faster simulation",
                        "Automatic UVM scoreboards",
                        "Lint becomes unnecessary",
                    ],
                    0,
                    "Keep SV TB and C++ host roles clear.",
                ),
                tf(
                    "q4",
                    "Calling eval once does not substitute for a loop that steps time across many cycles.",
                    True,
                    "The host must drive cycles deliberately.",
                ),
            ],
        ),
    )
)

# --- 05 tb-clock-reset ---
MODULES.append(
    (
        "module05-tb-clock-reset",
        """
# Module 05 — TB clock + reset patterns

**Module id:** module05-tb-clock-reset
**Lab:** tb-clock-reset
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Clock and reset in the host

Every Verilator run needs a disciplined clock and reset story. A common pattern is a forever loop with half-period delays for the clock. Reset should assert for a known number of posedges, then release synchronously—not held forever, not dropped at random time zero without thought.

## Slide 2 — Assert, wait, release

Assert reset low or high consistently with your active level. Count posedges while reset is held—often two or three is enough for literacy. Release reset synchronously relative to the clock edge you care about. After release, let the DUT run; do not leave reset glued active while wondering why nothing moves.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the browser clock-and-reset lab, load the starter testbench sketch and adjust assert duration and release point until status reads ready. Challenges flag reset held forever, release combinatorially, or clock with no half-period discipline. Fix the pattern, not only the displayed waveform paint.

## Slide 4 — Real Verilator practice

In Track A, open EXAMPLES and implement or inspect a host loop that toggles clock with half-period sleeps or timed steps, asserts reset for N cycles, then releases. Run once and confirm outputs change only after reset deasserts. Say how many posedges you waited—make the number intentional.

## Slide 5 — Pitfalls to watch

Do not hold reset forever and call it a passing test. Do not release reset asynchronously if your DUT expects synchronous deassert. Do not forget the clock entirely in a C++ host—eval needs input changes. And do not copy a browser sketch verbatim without matching your DUT’s reset polarity.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, reach ready with a synchronous release pattern. In Track A, run one reset sequence you can explain out loud. When you are ready, take the short quiz, then continue to Verilator trace.
""",
        q(
            "module05-tb-clock-reset",
            "TB clock + reset patterns",
            [
                mc(
                    "q1",
                    "A common clock generator pattern uses…",
                    [
                        "Forever loop with half-period delays between toggles",
                        "No clock at all in the host",
                        "Only a one-shot eval with no timing",
                        "Only asynchronous random delays with no structure",
                    ],
                    0,
                    "Half-period forever loops are the literacy pattern.",
                ),
                mc(
                    "q2",
                    "Reset should typically…",
                    [
                        "Assert for N posedges then release synchronously",
                        "Stay asserted forever for every test",
                        "Release before the first clock edge always with no plan",
                        "Only exist in the wave viewer, not the host",
                    ],
                    0,
                    "Counted assert plus synchronous release.",
                ),
                mc(
                    "q3",
                    "If reset is held forever, the DUT often…",
                    [
                        "Never reaches normal operation—you are testing stuck reset",
                        "Runs at double speed",
                        "Automatically passes lint",
                        "Exports FST files without flags",
                    ],
                    0,
                    "Forever reset masks functional behavior.",
                ),
                tf(
                    "q4",
                    "After reset deasserts, the host should continue stepping clock and eval—not stop immediately unless the test ends.",
                    True,
                    "Release is the start of real exercising, not the end.",
                ),
            ],
        ),
    )
)

# --- 06 verilator-trace ---
MODULES.append(
    (
        "module06-verilator-trace",
        """
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
""",
        q(
            "module06-verilator-trace",
            "Verilator trace",
            [
                mc(
                    "q1",
                    "OPEN trace status means…",
                    [
                        "Trace was enabled but dump calls never recorded cycles",
                        "The compile failed entirely",
                        "Reset was held forever",
                        "DPI imported twice",
                    ],
                    0,
                    "Flag without dump = OPEN.",
                ),
                mc(
                    "q2",
                    "BLIND trace status means…",
                    [
                        "Dump ran but compile never enabled trace instrumentation",
                        "Everything is perfect",
                        "Only lint ran",
                        "Coverage hit one hundred percent automatically",
                    ],
                    0,
                    "Dump without flag = BLIND.",
                ),
                mc(
                    "q3",
                    "A complete trace flow includes…",
                    [
                        "Compile flag plus open, dump in the loop, and close",
                        "Only opening a viewer with no sim",
                        "Only git commit",
                        "Only a C++ main with no eval",
                    ],
                    0,
                    "Both compile and host cooperation are required.",
                ),
                tf(
                    "q4",
                    "You should call dump in the eval loop for cycles you want visible in the wave file.",
                    True,
                    "Dump per stepped cycle is the usual pattern.",
                ),
            ],
        ),
    )
)

# --- 07 wave-dump ---
MODULES.append(
    (
        "module07-wave-dump",
        """
# Module 07 — Wave dump literacy

**Module id:** module07-wave-dump
**Lab:** wave-dump
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Pick the wave format

VCD is familiar and portable for quick debug. FST compresses better for long farm runs and large designs. The literacy lab names scenarios—quick debug, long regression farm, portable share—and asks which format fits. In every case, dumping must actually be on—not a pretend filename.

## Slide 2 — Scenario-first choice

For quick debug on a tiny block, VCD is often fine. For overnight farms with millions of cycles, prefer FST to keep disks sane. When you share a snippet with a colleague on another tool, think portable VCD—or confirm their viewer reads FST. Regardless of format, trace compile flags and dump calls must be active or you get empty pride.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the wave dump lab, load the starter and map scenarios to VCD or FST choices until status reads ready. Challenges include dump switched off—fix the flow so recording is truly on. Treat wrong format picks as teaching moments about disk size and viewer support.

## Slide 4 — Real Verilator practice

In Track A, produce one small VCD and, if your flow supports it, one small FST from the same tiny design. Compare file sizes and open both in your viewer. Note which Makefile variables or flags differ. Keep runs short—this is format literacy, not volume testing.

## Slide 5 — Pitfalls to watch

Do not pick FST then forget trace-fst at compile. Do not share a zero-byte file because dump never ran. Do not use farm-scale dumps for a five-signal typo debug. And do not assume every viewer supports every format—check before you send.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, pass scenario chooser challenges with dump truly enabled. In Track A, open one real trace you created. When you are ready, take the short quiz, then continue to Verilator public visibility.
""",
        q(
            "module07-wave-dump",
            "Wave dump literacy",
            [
                mc(
                    "q1",
                    "For long farm runs, the better default is often…",
                    [
                        "FST for smaller files at scale",
                        "No dump at all",
                        "Only printf in C++ with no waves",
                        "A schematic PDF",
                    ],
                    0,
                    "FST scales better for long runs.",
                ),
                mc(
                    "q2",
                    "For quick debug on a tiny design, VCD is…",
                    [
                        "Often fine and widely portable",
                        "Never usable in any viewer",
                        "Forbidden by Verilator",
                        "Only for synthesis",
                    ],
                    0,
                    "VCD remains a quick-debug workhorse.",
                ),
                mc(
                    "q3",
                    "Dump must be on means…",
                    [
                        "Compile flags and host dump calls actually record cycles",
                        "You only type a filename in a comment",
                        "Lint passes",
                        "Reset is deasserted",
                    ],
                    0,
                    "Recording requires active dump, not just naming.",
                ),
                tf(
                    "q4",
                    "Choosing FST without enabling the matching trace-fst compile path can yield broken or empty results.",
                    True,
                    "Format choice and compile flags must align.",
                ),
            ],
        ),
    )
)

# --- 08 verilator-public ---
MODULES.append(
    (
        "module08-verilator-public",
        """
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
""",
        q(
            "module08-verilator-public",
            "Verilator public",
            [
                mc(
                    "q1",
                    "The public comment pragma is for…",
                    [
                        "Exposing selected internal signals to the C++ host",
                        "Replacing all ports",
                        "Disabling lint",
                        "Generating FST automatically",
                    ],
                    0,
                    "Public marks intentional internal visibility.",
                ),
                mc(
                    "q2",
                    "Top-level ports are…",
                    [
                        "Already part of the boundary—no public pragma needed for normal access",
                        "Always invisible to any host",
                        "Only visible in the browser lab",
                        "Only accessible via DPI",
                    ],
                    0,
                    "Ports are the natural contract.",
                ),
                mc(
                    "q3",
                    "Unmarked internal signals are…",
                    [
                        "Hidden from the host unless you over-expose with pragmas",
                        "Always visible to any C++ code automatically",
                        "Only visible in synthesis",
                        "Illegal in Verilator",
                    ],
                    0,
                    "Internals default to hidden.",
                ),
                tf(
                    "q4",
                    "Marking every internal net public is discouraged—it couples testbench to implementation and can slow builds.",
                    True,
                    "Minimal exposure is the engineering habit.",
                ),
            ],
        ),
    )
)

# --- 09 verif-metrics ---
MODULES.append(
    (
        "module09-verif-metrics",
        """
# Module 09 — Verification metrics

**Module id:** module09-verif-metrics
**Lab:** verif-metrics
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Metrics that matter

Simulation without metrics is hope. Track pass rate, functional coverage percentage, and bug escapes—the defects that slipped out despite your tests. The literacy lab uses HEALTHY, OPEN, and BLOCKED statuses so you decide whether the project can move forward or must stop and fix.

## Slide 2 — Pass rate, coverage, escapes

Pass rate tells you how many tests succeed right now—one flaky fail blocks confidence. Coverage percent tells you how much of the intended space you exercised—not merely that lines toggled. Bug escapes are the painful teacher: if production or late review found defects your regressions missed, metrics go BLOCKED until you address the hole.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the metrics lab, load the starter dashboard and adjust pass rate, coverage, and escape counts until the program status matches the scenario. Some cards start OPEN—metrics incomplete. Escapes can flip the program to BLOCKED even when pass rate looks fine. Finish with a HEALTHY scenario you can explain.

## Slide 4 — Real Verilator practice

In Track A, run a small regression— even two tests—and record pass/fail in notes. If you have a coverage switch or simple checklist from EXAMPLES, note one bin or feature you have not hit yet. Name one hypothetical escape and what test would catch it. This is literacy, not a full coverage closure project.

## Slide 5 — Pitfalls to watch

Do not celebrate hundred percent pass rate with zero coverage depth. Do not ignore escapes because “we sim a lot.” Do not treat browser metrics as real project data—they teach the vocabulary. And do not sign off when status is BLOCKED; fix the escape class or add tests first.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, reach HEALTHY on at least one scenario and explain BLOCKED on another. In Track A, write three numbers or notes: passes, one coverage gap, one escape risk. When you are ready, take the short quiz, then continue to the offline example.
""",
        q(
            "module09-verif-metrics",
            "Verification metrics",
            [
                mc(
                    "q1",
                    "Bug escapes refer to…",
                    [
                        "Defects that slipped past your verification and were found later",
                        "Only syntax errors caught by lint",
                        "Only Makefile typos",
                        "Wave files that are too large",
                    ],
                    0,
                    "Escapes are missed defects despite testing.",
                ),
                mc(
                    "q2",
                    "BLOCKED program status often means…",
                    [
                        "Escapes or critical gaps prevent moving forward",
                        "Every metric is perfect",
                        "Lint is disabled",
                        "Tracing is off",
                    ],
                    0,
                    "Escapes can block even with green pass rate.",
                ),
                mc(
                    "q3",
                    "HEALTHY in the literacy lab implies…",
                    [
                        "Pass rate and coverage are acceptable and escapes are controlled",
                        "No tests were run",
                        "Only browser UI was opened",
                        "Reset is asserted forever",
                    ],
                    0,
                    "HEALTHY is a balanced green picture.",
                ),
                tf(
                    "q4",
                    "High pass rate alone does not guarantee adequate coverage or zero escape risk.",
                    True,
                    "Pass rate is necessary but not sufficient.",
                ),
            ],
        ),
    )
)

# --- 10 offline ---
MODULES.append(
    (
        "module10-offline-verilator-example",
        """
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
""",
        q(
            "module10-offline-verilator-example",
            "Build & run a Verilator example",
            [
                mc(
                    "q1",
                    "Module ten’s required practice surface is…",
                    [
                        "Track A offline build and run in the legacy Verilator tree",
                        "Only a browser chooser lab",
                        "Only reading slides with no commands",
                        "Only UVM sequences",
                    ],
                    0,
                    "Offline capstone is Track A only.",
                ),
                mc(
                    "q2",
                    "You should capture in notes…",
                    [
                        "Commands used and pass/fail result",
                        "Only the wallpaper color",
                        "Only git remote names",
                        "Nothing—memory is enough",
                    ],
                    0,
                    "Replayable commands and outcomes matter.",
                ),
                mc(
                    "q3",
                    "If compile failed, first check…",
                    [
                        "Compile or elaboration logs before re-running waves",
                        "Only the wave viewer palette",
                        "Only coverage color",
                        "Only browser cookies",
                    ],
                    0,
                    "Fix the failing stage first.",
                ),
                tf(
                    "q4",
                    "Browser literacy labs do not replace the offline Verilator run required in this module.",
                    True,
                    "Fidelity proof is offline.",
                ),
            ],
        ),
    )
)

# --- 11 wrap ---
MODULES.append(
    (
        "module11-wrap",
        """
# Module 11 — Verilator track complete

**Module id:** module11-wrap
**Lab:** none (wrap)
**Tracks:** A · B recap

## Slide 1 — Verilator track complete

You now have a working map of Verilator as a tool. You can choose versus Icarus for the job, walk compile-elaborate-run, lint with intent, host a C++ testbench with an eval loop, discipline clock and reset, pair trace flags with dump calls, pick VCD or FST wisely, expose only needed internals, read metrics seriously, and run an offline example for real.

## Slide 2 — Skills you can reuse

Job-first simulator choice transfers to every new block. Lint-before-waves saves hours. The eval-loop mental model survives across designs. Trace flag plus dump is the wave mantra. Minimal public markers keep hosts clean. Metrics vocabulary—pass rate, coverage, escapes—bridges to planning courses without becoming UVM.

## Slide 3 — Dual-track recap

![Tools index](assets/tools-index.png)

If you mainly used browser labs, pick one Track A example and reproduce compile, run, and a short trace. If you mainly used Track A, revisit any browser lab you skipped for graded challenges. Confirm you can open the tools index and name where Simulation literacy lives.

## Slide 4 — Where to go next

For event-delay teaching depth, spend time in learn Icarus—the sibling path. For protocol bring-up, UART, SPI, and I²C courses reuse the same trace and testbench habits. For SystemVerilog language depth, continue learn Verilog modules. For UVM, climb that ladder when you need constrained-random environments—not before you can run a clean Verilator regression.

## Slide 5 — Mindset to keep

Fix RTL before blanket-disabling warnings. Keep C++ host and SV testbench paradigms straight. Turn dump on when you need waves. Mark public only what you must read. Treat escapes as BLOCKED until addressed. And remember: browser labs teach moves; confidence comes from offline runs that pass twice in a row.

## Slide 6 — Closing

Check off the wrap checklist. You finished the learn Verilator path. Run one small regression or lint-clean example if you want a victory lap, then pick the next course that matches your goal—language depth, Icarus literacy, protocols, or planning metrics.
""",
        q(
            "module11-wrap",
            "Verilator track complete",
            [
                mc(
                    "q1",
                    "After this course you should be able to…",
                    [
                        "Run lint, C++ host sim, trace, and read basic metrics",
                        "Skip compile and only view blank waves",
                        "Replace all protocol verification",
                        "Ignore escapes if pass rate is fifty percent",
                    ],
                    0,
                    "Core Verilator tool outcomes.",
                ),
                mc(
                    "q2",
                    "A sensible sibling course for event-delay teaching is…",
                    [
                        "learn_iverilog",
                        "Only PCB layout",
                        "Only Git hooks",
                        "Only place-and-route",
                    ],
                    0,
                    "Icarus path complements Verilator.",
                ),
                mc(
                    "q3",
                    "If you mostly did browser labs, a good wrap action is…",
                    [
                        "Reproduce one compile-run-trace cycle in Track A",
                        "Delete the legacy examples tree",
                        "Disable all warnings forever",
                        "Never run Verilator offline",
                    ],
                    0,
                    "Transfer literacy into real runs.",
                ),
                tf(
                    "q4",
                    "Minimal public markers and active dump calls are lasting Verilator engineering habits.",
                    True,
                    "Exposure discipline and trace pairing stick.",
                ),
            ],
        ),
    )
)


def main() -> None:
    for module, transcript, quiz in MODULES:
        write(module, transcript, quiz)
    print("done", len(MODULES), "modules")


if __name__ == "__main__":
    main()
