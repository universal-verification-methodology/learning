---
marp: true
title: Counter patterns
paginate: true
---

# Counter patterns

Counters are small sequential machines that change state on each clock edge

---

## Count, wrap, or hold
- A four-bit up counter naturally wraps from fifteen back to zero because the register width
- A down counter subtracts one and wraps under zero back to fifteen
- A modulo-ten counter checks for nine, then reloads zero on the next edge
- Count enable is the preferred hold pattern
- Gray counting is different from plain binary because adjacent codes flip one bit

---

## Browser lab
![Counter lab starter](assets/lab-starter.png)

---

## Real Verilog practice
![Real Verilog - up and modulo counters](assets/real-shell.png)

---

## Pitfalls to watch
- Do not use blocking assignment in clocked counter RTL
- Do not forget the explicit wrap condition for modulo counters that are not powers of two
- Do not implement hold by assigning from multiple drivers
- Do not confuse Gray count outputs with ordinary binary values

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, step the modulo mode until it wraps and explain why it returns to zero
- On real Verilog, write an enabled counter that holds when CE is low
- When you are ready

