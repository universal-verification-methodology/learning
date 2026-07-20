(() => {
  /**
   * Async FIFO sketch — depth 8, 4-bit pointers (3 addr + wrap)
   *   Write domain: wbin/wgray, sync rgray via 2FF → full
   *   Read domain:  rbin/rgray, sync wgray via 2FF → empty
   *   Gray: g = b ^ (b >> 1)
   *   Full:  next_wgray == {~rsync[MSB:MSB-1], rsync[MSB-2:0]}  (classic style)
   *   Empty: rgray == wsync
   */

  const DEPTH = 8;
  const PTR_W = 4; // bits
  const PTR_MASK = (1 << PTR_W) - 1;

  function toGray(b) {
    return (b ^ (b >> 1)) & PTR_MASK;
  }

  function toBin(n, w = PTR_W) {
    return (n & ((1 << w) - 1)).toString(2).padStart(w, "0");
  }

  function addrOf(ptr) {
    return ptr & (DEPTH - 1);
  }

  /** Classic async FIFO full compare on Gray */
  function isFull(wgrayNext, rgraySync) {
    // invert top two bits of synced rptr for full
    const inverted =
      (((~rgraySync) & 0xc) | (rgraySync & 0x3)) & PTR_MASK;
    return wgrayNext === inverted;
  }

  function isEmpty(rgray, wgraySync) {
    return rgray === wgraySync;
  }

  function makeStarter() {
    return {
      mem: Array(DEPTH).fill(0),
      // write domain
      wbin: 0,
      wgray: 0,
      wdata: 0xa5,
      // 2FF sync of rgray into write clk
      rq1: 0,
      rq2: 0,
      // read domain
      rbin: 0,
      rgray: 0,
      rdata: 0,
      // 2FF sync of wgray into read clk
      wq1: 0,
      wq2: 0,
      full: 0,
      empty: 1,
      wcycles: 0,
      rcycles: 0,
      lastAction: "",
      explained: false,
      wrote: false,
      read: false,
      synced: false,
      log: [],
      trace: [],
    };
  }

  function sourceCode() {
    return `// Async FIFO (concept)
// gray = bin ^ (bin >> 1);
// write clk: sync rgray with 2FF → full
// read  clk: sync wgray with 2FF → empty
// full  when next_wgray == {~r_sync[3:2], r_sync[1:0]}
// empty when rgray == w_sync`;
  }

  const CLEARED_KEY = "ddv-async-fifo-cleared-v1";
  const STORE_KEY = "ddv-async-fifo-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("af-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> empty depth-8 FIFO —
        write on <code>wclk</code>, read on <code>rclk</code>; watch Gray sync and empty/full.</p>
      <button type="button" class="btn btn-secondary" id="af-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Core ideas</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Two clocks</h3>
            <p>Write and read domains free-run — no shared edge.</p>
          </div>
          <div class="idea-card">
            <h3>Gray sync</h3>
            <p>Only one bit changes per count — safer CDC of pointers.</p>
          </div>
          <div class="idea-card">
            <h3>Empty / full</h3>
            <p>Compare local Gray to 2-FF-synced remote Gray.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>FIFO sketch</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>wdata <input id="in-wdata" type="text" value="A5" maxlength="4"></label>
          </div>
          <p class="legend">Blue = write addr · violet = read addr. Step each clock independently.</p>
          <div class="mem-strip" id="mem-strip"></div>
          <div class="flag-row" id="flag-row"></div>
          <div class="domains">
            <div class="domain is-w" id="dom-w"></div>
            <div class="domain is-r" id="dom-r"></div>
          </div>
          <div class="sync-box" id="sync-box"></div>
          <pre class="code-box" id="code-box"></pre>
          <div class="warn-box" id="warn-box"></div>
          <div class="action-grid">
            <button type="button" id="btn-wclk">Step wclk (write if !full)</button>
            <button type="button" id="btn-rclk">Step rclk (read if !empty)</button>
            <button type="button" id="btn-fill">Fill until full</button>
            <button type="button" id="btn-drain">Drain until empty</button>
            <button type="button" id="btn-sync2">Nudge both clks ×2 (sync settle)</button>
            <button type="button" id="btn-gray">Show Gray(bin) table</button>
            <button type="button" id="btn-demo">Demo: write → sync → read</button>
            <button type="button" id="btn-explain">Explain async FIFO</button>
            <button type="button" id="btn-reset">Reset FIFO</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Status</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Occupancy</h3>
              <p class="val" id="val-occ">—</p>
              <p class="note" id="note-occ"></p>
            </div>
            <div class="status-card">
              <h3>w/r cycles</h3>
              <p class="val" id="val-cyc">—</p>
              <p class="note" id="note-cyc"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Item</th><th>Role</th></tr></thead>
          <tbody>
            <tr><td>Binary ptr</td><td>Addresses the memory</td></tr>
            <tr><td>Gray ptr</td><td>Crosses the CDC safely</td></tr>
            <tr><td>2-FF sync</td><td>Metastability harden remote Gray</td></tr>
            <tr><td>Extra ptr bit</td><td>Distinguish full vs empty</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Empty/full can lag a couple of clocks after the other side moves — intentional.</li>
          <li>Never use binary pointers directly across clock domains.</li>
        </ul>
      </div>
    </div>
  `;

  const inWdata = /** @type {HTMLInputElement} */ (document.getElementById("in-wdata"));
  const memStrip = document.getElementById("mem-strip");
  const flagRow = document.getElementById("flag-row");
  const domW = document.getElementById("dom-w");
  const domR = document.getElementById("dom-r");
  const syncBox = document.getElementById("sync-box");
  const codeBox = document.getElementById("code-box");
  const warnBox = document.getElementById("warn-box");
  const valOcc = document.getElementById("val-occ");
  const noteOcc = document.getElementById("note-occ");
  const valCyc = document.getElementById("val-cyc");
  const noteCyc = document.getElementById("note-cyc");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function pushLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function parseByte(s) {
    const t = String(s).trim().replace(/^0x/i, "");
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function occupancy() {
    return (state.wbin - state.rbin) & PTR_MASK;
  }

  function doWstep() {
    // 2FF sync rgray into write domain (use temps)
    const newRq1 = state.rgray;
    const newRq2 = state.rq1;
    state.rq1 = newRq1;
    state.rq2 = newRq2;
    state.synced = true;

    const wnext = (state.wbin + 1) & PTR_MASK;
    const wgrayNext = toGray(wnext);
    const fullNow = isFull(wgrayNext, state.rq2) ? 1 : 0;
    state.full = fullNow;

    state.wdata = parseByte(inWdata.value);
    if (!fullNow) {
      state.mem[addrOf(state.wbin)] = state.wdata;
      state.wbin = wnext;
      state.wgray = toGray(state.wbin);
      state.wrote = true;
      pushTrace(
        `wclk: write mem[${addrOf((state.wbin - 1) & PTR_MASK)}]=${state.wdata.toString(16)} wgray=${toBin(state.wgray)}`
      );
    } else {
      pushTrace(`wclk: FULL — no write (rq2=${toBin(state.rq2)})`);
    }
    // recompute full with updated w
    const wnext2 = (state.wbin + 1) & PTR_MASK;
    state.full = isFull(toGray(wnext2), state.rq2) ? 1 : 0;
    state.wcycles += 1;
    state.lastAction = "wclk";
    pushLog(`# wclk full=${state.full}`);
    renderAll();
  }

  function doRstep() {
    const newWq1 = state.wgray;
    const newWq2 = state.wq1;
    state.wq1 = newWq1;
    state.wq2 = newWq2;
    state.synced = true;

    state.empty = isEmpty(state.rgray, state.wq2) ? 1 : 0;

    if (!state.empty) {
      state.rdata = state.mem[addrOf(state.rbin)];
      state.rbin = (state.rbin + 1) & PTR_MASK;
      state.rgray = toGray(state.rbin);
      state.read = true;
      pushTrace(
        `rclk: read ${state.rdata.toString(16)} rgray=${toBin(state.rgray)}`
      );
    } else {
      pushTrace(`rclk: EMPTY — no read (wq2=${toBin(state.wq2)})`);
    }
    state.empty = isEmpty(state.rgray, state.wq2) ? 1 : 0;
    state.rcycles += 1;
    state.lastAction = "rclk";
    pushLog(`# rclk empty=${state.empty}`);
    renderAll();
  }

  function fillUntilFull() {
    let guard = 24;
    while (!state.full && guard--) {
      const newRq1 = state.rgray;
      const newRq2 = state.rq1;
      state.rq1 = newRq1;
      state.rq2 = newRq2;
      const wnext = (state.wbin + 1) & PTR_MASK;
      if (isFull(toGray(wnext), state.rq2)) {
        state.full = 1;
        break;
      }
      state.wdata = parseByte(inWdata.value);
      state.mem[addrOf(state.wbin)] = state.wdata;
      state.wbin = wnext;
      state.wgray = toGray(state.wbin);
      state.wcycles += 1;
      state.wrote = true;
      state.full = isFull(toGray((state.wbin + 1) & PTR_MASK), state.rq2) ? 1 : 0;
    }
    state.lastAction = "fill";
    pushTrace(`fill done full=${state.full} wbin=${state.wbin}`);
    pushLog("# fill until full");
    renderAll();
  }

  function drainUntilEmpty() {
    let guard = 24;
    // Settle write Gray into read domain (2FF), then read until empty
    for (let i = 0; i < 2 && guard; i++) {
      const newWq1 = state.wgray;
      const newWq2 = state.wq1;
      state.wq1 = newWq1;
      state.wq2 = newWq2;
      state.rcycles += 1;
      guard--;
      state.empty = isEmpty(state.rgray, state.wq2) ? 1 : 0;
    }
    while (guard--) {
      const newWq1 = state.wgray;
      const newWq2 = state.wq1;
      state.wq1 = newWq1;
      state.wq2 = newWq2;
      if (isEmpty(state.rgray, state.wq2)) {
        state.empty = 1;
        break;
      }
      state.rdata = state.mem[addrOf(state.rbin)];
      state.rbin = (state.rbin + 1) & PTR_MASK;
      state.rgray = toGray(state.rbin);
      state.read = true;
      state.rcycles += 1;
      state.empty = isEmpty(state.rgray, state.wq2) ? 1 : 0;
      if (state.empty) break;
    }
    state.lastAction = "drain";
    pushTrace(`drain done empty=${state.empty}`);
    pushLog("# drain until empty");
    renderAll();
  }

  function syncSettle() {
    doWstep();
    doWstep();
    doRstep();
    doRstep();
    state.lastAction = "sync2";
    state.synced = true;
    pushLog("# both domains stepped ×2");
    renderAll();
  }

  function showGrayTable() {
    const lines = [];
    for (let i = 0; i < 16; i++) {
      lines.push(`${toBin(i)} → ${toBin(toGray(i))}`);
    }
    pushTrace("Gray table:\n" + lines.join("\n"));
    state.lastAction = "gray";
    pushLog("# Gray(bin) table");
    renderAll();
  }

  function runDemo() {
    state = makeStarter();
    inWdata.value = "A5";
    doWstep(); // write + start sync
    doWstep(); // sync progresses
    doRstep(); // sync wgray
    doRstep(); // empty clears, read
    state.lastAction = "demo";
    pushTrace("demo: write A5 → settle sync → read");
    pushLog("# demo write→sync→read");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# Gray CDC · 2FF · full/empty from synced ptrs · not binary across domains");
    pushTrace("explain: one-bit Gray change reduces multi-bit CDC hazard");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    inWdata.value = "A5";
    state.lastAction = "starter";
    pushLog("# starter empty FIFO");
    renderAll();
  }

  function renderAll() {
    codeBox.textContent = sourceCode();
    const wa = addrOf(state.wbin);
    const ra = addrOf(state.rbin);

    memStrip.innerHTML = state.mem
      .map((v, i) => {
        const cls =
          i === wa && i === ra ? "is-both" : i === wa ? "is-w" : i === ra ? "is-r" : "";
        return `<div class="mem-cell ${cls}"><h3>${i}</h3><p class="v">${v.toString(16).padStart(2, "0")}</p></div>`;
      })
      .join("");

    flagRow.innerHTML = `
      <span class="flag ${state.full ? "is-on" : "is-ok"}">full=${state.full}</span>
      <span class="flag ${state.empty ? "is-on" : "is-ok"}">empty=${state.empty}</span>
      <span class="flag">occ≈${occupancy()}</span>
    `;

    domW.innerHTML = `
      <h3>Write domain (wclk)</h3>
      <p class="mono">wbin=${toBin(state.wbin)} (${state.wbin})</p>
      <p class="mono">wgray=${toBin(state.wgray)}</p>
      <p class="mono">r_sync rq2=${toBin(state.rq2)} (via rq1=${toBin(state.rq1)})</p>
      <p class="mono">wdata=${state.wdata.toString(16).padStart(2, "0")}</p>
    `;
    domR.innerHTML = `
      <h3>Read domain (rclk)</h3>
      <p class="mono">rbin=${toBin(state.rbin)} (${state.rbin})</p>
      <p class="mono">rgray=${toBin(state.rgray)}</p>
      <p class="mono">w_sync wq2=${toBin(state.wq2)} (via wq1=${toBin(state.wq1)})</p>
      <p class="mono">rdata=${state.rdata.toString(16).padStart(2, "0")}</p>
    `;

    syncBox.textContent = `CDC: rgray→rq1→rq2 (for full) · wgray→wq1→wq2 (for empty) · Gray(n)=n^(n>>1)`;

    if (state.full) {
      warnBox.className = "warn-box is-warn";
      warnBox.textContent = "FULL — writes blocked until reads free space and sync catches up.";
    } else if (state.empty) {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = "EMPTY — reads blocked until writes land and sync catches up.";
    } else {
      warnBox.className = "warn-box is-ok";
      warnBox.textContent = "FIFO has data — can write and/or read (flags use synced pointers).";
    }

    valOcc.textContent = String(occupancy());
    noteOcc.textContent = `(wbin−rbin) mod 16`;
    valCyc.textContent = `${state.wcycles}/${state.rcycles}`;
    noteCyc.textContent = "wclk / rclk steps";

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no clocks";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ wbin: state.wbin, rbin: state.rbin, full: state.full, empty: state.empty })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("af-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-wclk").addEventListener("click", doWstep);
  document.getElementById("btn-rclk").addEventListener("click", doRstep);
  document.getElementById("btn-fill").addEventListener("click", fillUntilFull);
  document.getElementById("btn-drain").addEventListener("click", drainUntilEmpty);
  document.getElementById("btn-sync2").addEventListener("click", syncSettle);
  document.getElementById("btn-gray").addEventListener("click", showGrayTable);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-async",
      title: "Quiz: async",
      prompt: "FIFO with different read/write clocks is? Answer: <code>async</code>",
      hint: "asynchronous FIFO",
      type: "text",
      answer: "async",
      alt: ["asynchronous", "async fifo", "asynchronous fifo"],
    },
    {
      id: "quiz-gray",
      title: "Quiz: Gray",
      prompt: "Pointer code used across CDC? Answer: <code>Gray</code>",
      hint: "one bit change",
      type: "text",
      answer: "gray",
      alt: ["grey", "gray code"],
    },
    {
      id: "quiz-2ff",
      title: "Quiz: 2FF",
      prompt: "Typical synchronizer depth for Gray ptr? Answer: <code>2</code>",
      hint: "two flip-flops",
      type: "text",
      answer: "2",
      alt: ["two", "2-ff", "2ff"],
    },
    {
      id: "quiz-empty",
      title: "Quiz: empty",
      prompt: "Flag when no data to read? Answer: <code>empty</code>",
      hint: "read side",
      type: "text",
      answer: "empty",
      alt: ["EMPTY"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — empty=1.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "starter" && state.empty === 1,
    },
    {
      id: "wclk",
      title: "Write clk",
      prompt: "Step wclk at least once (write).",
      hint: "Step wclk",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.wrote && state.wcycles >= 1,
    },
    {
      id: "rclk",
      title: "Read clk",
      prompt: "After a write + sync, Step rclk to read.",
      hint: "wclk → sync/rclk until data read",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.read && state.rcycles >= 1,
    },
    {
      id: "gray-fn",
      title: "Gray fn",
      prompt: "Gray(1) should be 1; Gray(2)=3. Show table or trust encode.",
      hint: "Show Gray table or check wgray after writes",
      type: "state",
      setup: () => loadStarter(),
      check: () => toGray(1) === 1 && toGray(2) === 3 && toGray(3) === 2,
    },
    {
      id: "gray-btn",
      title: "Gray table",
      prompt: "Show Gray(bin) table.",
      hint: "Show Gray(bin) table",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "gray",
    },
    {
      id: "not-empty",
      title: "Not empty",
      prompt: "Reach empty=0 after write(s) and sync on read side.",
      hint: "wclk a few times, then rclk ×2+",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.empty === 0,
    },
    {
      id: "full",
      title: "Full",
      prompt: "Fill until full=1.",
      hint: "Fill until full",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.full === 1 && (state.lastAction === "fill" || state.wcycles >= 8),
    },
    {
      id: "drain",
      title: "Drain",
      prompt: "After some data, Drain until empty.",
      hint: "Write some → Drain until empty",
      type: "state",
      setup: () => {
        loadStarter();
        doWstep();
        doWstep();
      },
      check: () => state.empty === 1 && state.lastAction === "drain",
    },
    {
      id: "sync2",
      title: "Sync settle",
      prompt: "Nudge both clks ×2.",
      hint: "Nudge both clks ×2",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.lastAction === "sync2" && state.synced,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: write → sync → read.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" && state.wrote && state.read,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain async FIFO.",
      hint: "Explain button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "code-gray",
      title: "Code Gray",
      prompt: "Code mentions <code>gray = bin ^ (bin >> 1)</code>.",
      hint: "Always in code box",
      type: "state",
      setup: () => loadStarter(),
      check: () => sourceCode().includes("bin ^ (bin >> 1)"),
    },
    {
      id: "wgray-track",
      title: "wgray track",
      prompt: "After one successful write from 0, wgray equals Gray(1)=1.",
      hint: "Starter → Step wclk",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.wbin === 1 && state.wgray === toGray(1),
    },
    {
      id: "rq-pipe",
      title: "rq pipe",
      prompt: "After ≥2 wclk, rq2 has sampled an rgray value (sync alive).",
      hint: "Step wclk twice",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.wcycles >= 2 && state.synced,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset FIFO to empty starter state.",
      hint: "Reset FIFO",
      type: "state",
      setup: () => {
        loadStarter();
        doWstep();
      },
      check: () =>
        (state.lastAction === "reset" || state.lastAction === "starter") &&
        state.empty === 1 &&
        state.wbin === 0,
    },
    {
      id: "occ",
      title: "Occupancy",
      prompt: "Write 3 times (from empty, may need no full) — wbin=3.",
      hint: "Step wclk ×3",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.wbin === 3,
    },
    {
      id: "rdata",
      title: "rdata",
      prompt: "Write 0x5A, sync/read — rdata becomes 0x5A.",
      hint: "Set wdata=5A → demo-like steps",
      type: "state",
      setup: () => {
        loadStarter();
        inWdata.value = "5A";
      },
      check: () => state.rdata === 0x5a && state.read,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.explained &&
        state.lastAction === "explain" &&
        state.wrote,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function setStatus(kind, text) {
    const el = document.getElementById("chal-status");
    el.className = `challenge-status ${kind}`;
    el.textContent = text;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (isCleared(ch.id) ? " · cleared" : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}.</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? `Hint: ${ch.hint}` : "";
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      ansRow.innerHTML = `<label class="sr-only" for="chal-answer">Answer</label>
        <input type="text" id="chal-answer" class="chal-input" autocomplete="off" placeholder="Type answer…">`;
      const inp = /** @type {HTMLInputElement} */ (document.getElementById("chal-answer"));
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
    } else {
      ansRow.innerHTML = "";
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = CHALLENGES.map((c, i) => {
      const cls = [
        "kbd",
        i === challengeIdx ? "is-active" : "",
        isCleared(c.id) ? "is-cleared" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-chal="${i}">${c.id}</button>`;
    }).join(" ");
    cat.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        challengeIdx = Number(btn.getAttribute("data-chal"));
        showHint = false;
        answerDraft = "";
        setStatus("idle", "Idle");
        const next = CHALLENGES[challengeIdx];
        if (next.setup) next.setup();
        renderChallenge();
      });
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });

  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setStatus("idle", "Idle");
    const next = CHALLENGES[challengeIdx];
    if (next.setup) next.setup();
    renderChallenge();
  });

  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const got = normalizeAns(answerDraft);
      const want = normalizeAns(ch.answer);
      const alts = (ch.alt || []).map(normalizeAns);
      ok = got === want || alts.includes(got);
    } else {
      ok = !!ch.check();
    }
    if (ok) {
      markCleared(ch.id);
      setStatus("ok", "Cleared");
    } else {
      setStatus("bad", "Not yet");
    }
    renderChallenge();
  });

  loadStarter();
  renderChallenge();
})();
