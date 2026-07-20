---
marp: true
title: Latch risk
paginate: true
---

# Latch risk

Combinational logic should depend only on current inputs, not on what the output was last cycle

---

## Complete versus incomplete paths
- A continuous assign is purely combinational, there is no path where Y fails to update
- In always at-star
- If you write only if open-paren S close-paren Y equals D1 with no else
- A full if-else or a case with all labels covered, or a default, gives every path a value
- At-star fixes sensitivity; it does not fix missing branches

---

## Browser lab
![Latch risk lab starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog — mux with and without latch risk](assets/real-shell.png)

---

## Pitfalls to watch
- Do not assume at-star means latch-free, it only builds the sensitivity list
- In coursework you usually do not
- Partial case without default is the same class of bug for wider selects
- Prefer assign or always_comb with every path assigning outputs when you mean pure

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, load the starter and identify which mux style infers a latch
- On real Verilog, write or fix an always block so every branch assigns the output
- When you are ready

