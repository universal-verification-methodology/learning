---
marp: true
title: Verilator lint
paginate: true
---

# Verilator lint

Lint is cheap insurance

---

## Common warning families
- Watch for UNUSED, something you declared but never read
- WIDTH, expressions that do not line up
- LATCH, inferred storage you did not mean
- CASEINCOMPLETE, case statements without a default or full coverage
- The literacy lab tags these families so you learn the fix, not only the flag name

---

## Browser lab
![Lab starter](assets/lab-starter.png)

---

## Real Verilator practice
- In Track A, lint a tiny module with wall-level warnings enabled
- Introduce one intentional WIDTH or UNUSED issue
- Avoid the reflex to blanket-disable warnings unless you have documented why
- Self-check scripts can confirm you reached a clean lint pass

---

## Pitfalls to watch
- Do not blanket-disable warnings to greenwash a broken design
- Do not confuse BLIND with CLEAN, no output is not the same as no problems
- Do not ship with warnings-as-errors until your tree is actually clean
- And remember: lint passes do not replace simulation, they narrow the search space

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, reach CLEAN on at least one challenge without only silencing flags
- In Track A, run lint with strict warnings once
- When you are ready, take the short quiz, then continue to C++ testbench and DPI

