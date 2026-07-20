---
marp: true
title: FSM and datapath in RTL
paginate: true
---

# FSM and datapath in RTL

You have already met finite-state machines, ALU datapaths, and memory maps as digital concepts

---

## Control plus datapath
- In RTL, the FSM usually lives in a clocked always block with a case on the current state
- Next-state logic and Moore outputs can share that block or split for clarity
- The datapath is mostly combinational
- A memory map in hardware is a register file or RAM block addressed by an index
- You do not need a perfect one-to-one copy of every lab UI

---

## Revisit the concept labs
![FSM lab — Moore toggle starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog - FSM and ALU sketches](assets/real-shell.png)

---

## Pitfalls to watch
- Keep clocked and combo roles clear
- Do not forget a default state after reset or synthesis may latch undefined behavior
- Do not assume the browser lab is the only spec
- And do not skip the memory-map lab entirely

---

## Your turn
- Complete the checklist
- Pick one concept lab, load the starter, and outline a Verilog module with matching ports
- Write at least a module shell and one always or assign block
- Optionally run iverilog or the browser HDL simulator on your sketch
- When you finish, take the short quiz, then continue to the course wrap in the next module

