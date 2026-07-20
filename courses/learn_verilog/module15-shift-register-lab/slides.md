---
marp: true
title: Shift-register patterns
paginate: true
---

# Shift-register patterns

A shift register is a chain of flip-flops where each stage passes its value to the next one on every clock edge

---

## How shifting works
- On each rising edge, each flip-flop captures the output of the flip-flop to its left
- The leftmost stage captures the serial input
- After N clock cycles an N-bit shift register has moved each bit N positions to the right
- For parallel output, you read all stages at once
- For parallel load
- The ring version connects the last stage back to the first

---

## Browser lab
![Shift-register lab starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog - shift register demo](assets/real-shell.png)

---

## Pitfalls to watch
- Do not use blocking assignment inside a clocked shift register
- Do not forget to account for the latency
- When connecting stages manually instead of using a concatenation
- And when using a ring, verify the feedback path or you may lose bits silently

---

## Your turn
- Complete the checklist for at least one track, ideally both
- In the browser lab
- In real Verilog
- When you finish, take the short quiz

