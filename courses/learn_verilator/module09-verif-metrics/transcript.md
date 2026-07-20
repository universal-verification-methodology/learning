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
