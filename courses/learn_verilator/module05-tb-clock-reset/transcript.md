# Module 05 — TB clock + reset patterns

**Module id:** module05-tb-clock-reset
**Lab:** tb-clock-reset
**Tracks:** A (real Verilator + C++/Makefile) · B (browser lab)

## Slide 1 — Clock and reset in the host

Every Verilator run needs a disciplined clock and reset story. A common pattern is a forever loop with half-period delays for the clock. Reset should assert for a known number of posedges, then release synchronously—not held forever, not dropped at random time zero without thought.

## Slide 2 — Assert, wait, release

Assert reset low or high consistently with your active level. Count posedges while reset is held—often two or three is enough for literacy. Release reset synchronously relative to the clock edge you care about. After release, let the DUT run; do not leave reset glued active while wondering why nothing moves.

## Slide 3 — Browser lab

![Lab starter](assets/lab-starter.png)

In the browser clock-and-reset lab, load the starter testbench sketch and adjust assert duration and release point until status reads ready. Challenges flag reset held forever, release combinatorially, or clock with no half-period discipline. Fix the pattern, not only the displayed waveform paint.

## Slide 4 — Real Verilator practice

In Track A, open EXAMPLES and implement or inspect a host loop that toggles clock with half-period sleeps or timed steps, asserts reset for N cycles, then releases. Run once and confirm outputs change only after reset deasserts. Say how many posedges you waited—make the number intentional.

## Slide 5 — Pitfalls to watch

Do not hold reset forever and call it a passing test. Do not release reset asynchronously if your DUT expects synchronous deassert. Do not forget the clock entirely in a C++ host—eval needs input changes. And do not copy a browser sketch verbatim without matching your DUT’s reset polarity.

## Slide 6 — Your turn

Complete the checklist for at least one track—preferably both. In the browser, reach ready with a synchronous release pattern. In Track A, run one reset sequence you can explain out loud. When you are ready, take the short quiz, then continue to Verilator trace.
