# Module 07 — Wave dump literacy

**Module id:** module07-wave-dump
**Lab:** wave-dump
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Pick the wave format

VCD is familiar and portable for quick debug. FST compresses better for long farm runs and large designs. The literacy lab names scenarios—quick debug, long regression farm, portable share—and asks which format fits. In every case, dumping must actually be on—not a pretend filename.

## Slide 2 — Scenario-first choice

For quick debug on a tiny block, VCD is often fine. For overnight farms with millions of cycles, prefer FST to keep disks sane. When you share a snippet with a colleague on another tool, think portable VCD—or confirm their viewer reads FST. Regardless of format, trace compile flags and dump calls must be active or you get empty pride.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the wave dump lab, load the starter and map scenarios to VCD or FST choices until status reads ready. Challenges include dump switched off—fix the flow so recording is truly on. Treat wrong format picks as teaching moments about disk size and viewer support.

## Slide 4 — Real Verilator practice

In Track A, produce one small VCD and, if your flow supports it, one small FST from the same tiny design. Compare file sizes and open both in your viewer. Note which Makefile variables or flags differ. Keep runs short—this is format literacy, not volume testing.

## Slide 5 — Pitfalls to watch

Do not pick FST then forget trace-fst at compile. Do not share a zero-byte file because dump never ran. Do not use farm-scale dumps for a five-signal typo debug. And do not assume every viewer supports every format—check before you send.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, pass scenario chooser challenges with dump truly enabled. In Track A, open one real trace you created. When you are ready, take the short quiz, then continue to Verilator public visibility.
