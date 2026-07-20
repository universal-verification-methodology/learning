---
marp: true
title: ANSI vs non-ANSI ports
paginate: true
---

# ANSI vs non-ANSI ports

You have seen module boundaries and port directions, now the question is where those directions are written

---

## Two header styles
- In non-ANSI style
- In ANSI style, the header carries the full picture
- For a clocked output you might write output reg q in ANSI
- Bus widths and parameters follow the same pattern

---

## Browser lab
![ANSI ports lab starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog — ANSI and non-ANSI AND](assets/real-shell.png)

---

## Pitfalls to watch
- Do not assume non-ANSI means wrong, it is still valid IEEE 1364, just older layout
- Do not forget that output reg in ANSI replaces the separate output and reg lines in the
- Mixing styles in one module is confusing, pick one convention per file
- And remember

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, load the starter and finish a few challenges
- On real Verilog
- When you are ready, take the short quiz, then continue to operators in the next module

