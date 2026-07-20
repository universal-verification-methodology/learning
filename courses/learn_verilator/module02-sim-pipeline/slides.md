---
marp: true
title: The simulation pipeline
paginate: true
---

# The simulation pipeline

Every simulator run is a pipeline: compile sources, elaborate the design hierarchy, then execute time

---

## Verilator’s compile-to-binary path
- Verilator’s common flow is compile with the C++ emit flag
- Elaboration happens inside Verilator’s front end
- Status READY in the literacy lab means every stage completed

---

## Browser lab
![Lab starter](assets/lab-starter.png)

---

## Real Verilator practice
- In Track A, open EXAMPLES and run one minimal Verilator compile that emits C++, then make
- Say out loud which log lines belong to compile versus link versus run
- If the binary exits immediately, check whether the testbench host actually stepped time

---

## Pitfalls to watch
- Do not treat “verilator ran” as “simulation succeeded”, did you build and run the host?
- Do not debug waves when compile never finished
- Do not compare Icarus and Verilator commands flag-for-flag; compare stages
- And remember READY is a whole pipeline, not one green checkbox

---

## Your turn
- Complete the checklist for at least one track, preferably both
- In the browser, reach ready on the pipeline diagram
- In Track A, run compile, build, and execute once on a tiny design
- When you are ready, take the short quiz, then continue to Verilator lint

