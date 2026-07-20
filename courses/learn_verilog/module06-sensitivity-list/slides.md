---
marp: true
title: Sensitivity lists
paginate: true
---

# Sensitivity lists

An always block does not run on every tick of simulation time

---

## What wakes an always block
- For combinational logic
- Classic Verilog wrote at open-paren A or B close-paren
- If you list only A but also read B
- For sequential logic, posedge clk means the block runs only on a rising clock edge

---

## Browser lab
![Sensitivity list lab starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog — combo and clocked sensitivity](assets/real-shell.png)

---

## Pitfalls to watch
- Do not hand-write or lists and forget a signal you read
- Do not use level-sensitive at open-paren clk close-paren when you mean a flip-flop
- At-star fixes combo lists in modern Verilog
- And remember

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, load the starter, try the incomplete list, and poke the flip-flop scenario
- On real Verilog
- When you are ready, take the short quiz, then continue to latch risk in the next module

