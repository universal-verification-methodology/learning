---
marp: true
title: Generate and replication
paginate: true
---

# Generate and replication

Verilog gives you two related ideas that sound like loops but run at elaboration, not on every clock edge

---

## Elaboration, not runtime
- Replication is expression math: brace-N-brace expr widens a bus by repeating expr
- Bit cell open-bracket i close-bracket dot u, and so on
- Generate if tests a parameter or localparam at elaboration and discards the other branch
- That is different from a for loop inside always at-star, which runs during simulation
- Generate conditions must be constants known before simulation starts

---

## Browser lab
![Generate replication lab starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog - replication and generate for](assets/real-shell.png)

---

## Pitfalls to watch
- Do not confuse replication brace-N-brace with generate for, they solve different problems
- Do not put a runtime signal in a generate if condition, use parameters or localparams
- Do not expect generate for to behave like a procedural for loop inside always
- Do name generate blocks when you need hierarchical paths like bit_cell open-bracket i

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, expand brace-four-brace one-prime-b-one and state the resulting bit width
- On real Verilog, write a generate for that instantiates N copies of a leaf cell
- When you are ready

