---
marp: true
title: localparam
paginate: true
---

# localparam

A parameter is a compile-time constant the parent can override at instantiation with hash-dot syntax

---

## Public knob, private derivation
- Declare parameter WIDTH equals eight as the tunable bus width
- Then localparam DEPTH equals WIDTH times two
- Instantiate fifo hash-dot WIDTH open-paren four close-paren and WIDTH becomes four while
- Hash-dot DEPTH open-paren ninety-nine close-paren is illegal or ignored, DEPTH is local
- The pattern parameter W

---

## Browser lab
![localparam lab starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog — parameter and localparam in one module](assets/real-shell.png)

---

## Pitfalls to watch
- Do not put every constant in parameter form
- Do not use defparam for new code; prefer hash-dot at the instance
- Do not assume a localparam override fails loudly in every tool
- Do keep parameter for instance-visible knobs and localparam for math that must stay in

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, override WIDTH to four and state the new DEPTH
- On real Verilog, add a localparam derived from an existing parameter
- When you are ready

