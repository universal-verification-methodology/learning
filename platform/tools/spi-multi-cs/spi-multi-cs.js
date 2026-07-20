(() => {
  /**
   * SPI multi-CS / daisy (concept)
   *   multi: independent CS[n], shared SCLK/MOSI/MISO — only selected slave drives MISO
   *   daisy: one CS, MOSI → D0 → D1 → … → MISO (shift through all)
   * Starter: multi, 2 devices, select slave 0, master TX 0xA5
   */

  function hex(n) {
    return "0x" + (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  }

  function parseByte(raw) {
    const t = String(raw).trim().replace(/^0x/i, "");
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  function bitMsb(byte) {
    return (byte >> 7) & 1;
  }

  /** Default slave preload contents */
  function defaultSlaves(n) {
    const seed = [0x5a, 0x3c, 0x96];
    return Array.from({ length: n }, (_, i) => seed[i % seed.length]);
  }

  /**
   * Independent CS transfer: one selected slave exchanges one byte (Mode 0 style).
   */
  function buildMultiTimeline(nDev, sel, masterTx, slaves) {
    const steps = [];
    let mShift = masterTx & 0xff;
    let sShift = slaves[sel] & 0xff;
    let mRx = 0;
    const cs = () => Array.from({ length: nDev }, (_, i) => (i === sel ? 0 : 1));

    steps.push({
      label: "idle",
      cs: Array(nDev).fill(1),
      sclk: 0,
      mosi: 0,
      miso: 0,
      event: "idle",
      masterRx: 0,
      slaves: slaves.slice(),
      active: -1,
    });

    steps.push({
      label: `CS${sel}↓`,
      cs: cs(),
      sclk: 0,
      mosi: bitMsb(mShift),
      miso: bitMsb(sShift),
      event: "cs_assert",
      masterRx: 0,
      slaves: slaves.slice(),
      active: sel,
    });

    for (let bit = 7; bit >= 0; bit--) {
      const mosi = bitMsb(mShift);
      const miso = bitMsb(sShift);
      mRx = ((mRx << 1) | miso) & 0xff;
      sShift = ((sShift << 1) | mosi) & 0xff;
      mShift = ((mShift << 1) | 0) & 0xff;

      steps.push({
        label: `↑b${bit}`,
        cs: cs(),
        sclk: 1,
        mosi,
        miso,
        event: "sample",
        bit,
        masterRx: mRx,
        slaves: slaves.map((v, i) => (i === sel ? sShift : v)),
        active: sel,
      });

      // falling: next MSB already after shift above for next loop
      const nextMosi = bit > 0 ? bitMsb(mShift) : mosi;
      const nextMiso = bit > 0 ? bitMsb(sShift) : miso;
      steps.push({
        label: bit > 0 ? `↓b${bit}` : "↓done",
        cs: cs(),
        sclk: 0,
        mosi: nextMosi,
        miso: nextMiso,
        event: bit > 0 ? "change" : "last_fall",
        masterRx: mRx,
        slaves: slaves.map((v, i) => (i === sel ? sShift : v)),
        active: sel,
      });
    }

    const finalSlaves = slaves.map((v, i) => (i === sel ? sShift : v));
    steps.push({
      label: "CS↑",
      cs: Array(nDev).fill(1),
      sclk: 0,
      mosi: 0,
      miso: 0,
      event: "cs_deassert",
      masterRx: mRx,
      slaves: finalSlaves,
      active: -1,
      done: true,
    });
    return steps;
  }

  /**
   * Daisy: one CS, N bytes shifted through the chain (master sends N bytes of same pattern for demo,
   * or one stream of nDev*8 bits). Teaching model: shift nDev bytes — master pushes B0..Bn-1,
   * chain holds one byte each; after nDev*8 clocks, MISO returns the oldest slave preload.
   *
   * Simpler demo: one CS frame of (nDev * 8) bits. Master streams masterTx repeated conceptually
   * as first byte then 0x00 pad — actually: push one byte into head; after 8 clocks that byte
   * is in D0; after nDev*8 clocks first byte exits to MISO.
   *
   * For challenges: daisy transfer of length nDev bytes where master sends [tx, 0, 0, ...]
   * and each device starts with slaves[i]. After full frame, masterRx = slaves[nDev-1] (last in chain
   * shifts out first toward MISO... wait.
   *
   * Chain: MOSI → D0 → D1 → D2 → MISO
   * On each bit clock: D2 out → MISO, D1→D2, D0→D1, MOSI→D0
   * After 8 clocks: D0 has master's first byte; MISO streamed D2's old byte.
   * After nDev*8 clocks with continuous MOSI zeros after first byte: master has received
   * all original slave bytes (D2, D1, D0 in that order for 3 devices).
   */
  function buildDaisyTimeline(nDev, masterTx, slaves) {
    const steps = [];
    let chain = slaves.map((b) => b & 0xff);
    // Stream: first byte = masterTx, then zeros for remaining (nDev-1) bytes
    const stream = [masterTx & 0xff, ...Array(nDev - 1).fill(0)];
    let streamBits = [];
    for (const byte of stream) {
      for (let b = 7; b >= 0; b--) streamBits.push((byte >> b) & 1);
    }
    let mRx = 0;
    let bitIdx = 0;
    const totalBits = nDev * 8;

    steps.push({
      label: "idle",
      cs: [1],
      sclk: 0,
      mosi: 0,
      miso: 0,
      event: "idle",
      masterRx: 0,
      slaves: chain.slice(),
      active: -1,
      chainBits: totalBits,
    });

    steps.push({
      label: "CS↓",
      cs: [0],
      sclk: 0,
      mosi: streamBits[0],
      miso: bitMsb(chain[nDev - 1]),
      event: "cs_assert",
      masterRx: 0,
      slaves: chain.slice(),
      active: 0,
    });

    for (let k = 0; k < totalBits; k++) {
      const mosi = streamBits[k];
      const miso = bitMsb(chain[nDev - 1]);
      mRx = ((mRx << 1) | miso) & 0xff;
      // shift chain toward MISO
      for (let i = nDev - 1; i > 0; i--) {
        const inBit = bitMsb(chain[i - 1]);
        chain[i] = ((chain[i] << 1) | inBit) & 0xff;
      }
      chain[0] = ((chain[0] << 1) | mosi) & 0xff;

      const bytePhase = Math.floor(k / 8);
      const bit = 7 - (k % 8);
      steps.push({
        label: `↑d${bytePhase}b${bit}`,
        cs: [0],
        sclk: 1,
        mosi,
        miso,
        event: "sample",
        bit,
        bytePhase,
        masterRx: mRx,
        slaves: chain.slice(),
        active: 0,
      });

      const nextMosi = k + 1 < totalBits ? streamBits[k + 1] : mosi;
      const nextMiso = bitMsb(chain[nDev - 1]);
      steps.push({
        label: k + 1 < totalBits ? `↓d${bytePhase}b${bit}` : "↓done",
        cs: [0],
        sclk: 0,
        mosi: nextMosi,
        miso: nextMiso,
        event: k + 1 < totalBits ? "change" : "last_fall",
        masterRx: mRx,
        slaves: chain.slice(),
        active: 0,
      });
      bitIdx++;
    }

    // After full chain, masterRx holds only last 8 bits sampled — for teaching,
    // also expose full received stream in masterRxAll
    // Recompute full MISO stream for expect: original slaves from end to start
    let expect = 0;
    // last 8 bits of what master saw = first byte that exited = original last device
    // Actually after nDev*8 samples, mRx is only 8 bits (we kept shifting into 8-bit reg).
    // Fix: keep a wider accumulator for challenges.
    void bitIdx;

    steps.push({
      label: "CS↑",
      cs: [1],
      sclk: 0,
      mosi: 0,
      miso: 0,
      event: "cs_deassert",
      masterRx: mRx,
      slaves: chain.slice(),
      active: -1,
      done: true,
      // After N bytes out, last 8 MISO bits = original D0 content (shifted all the way)
      // Order out: first 8 bits = original Dn-1, next = Dn-2, ... last = D0
      // Our 8-bit mRx after N*8 clocks = original D0
      daisyOutLast: mRx,
      daisyFirstOut: slaves[nDev - 1],
    });

    // Annotate first-out expectation on done step
    steps[steps.length - 1].daisyFirstOut = slaves[nDev - 1] & 0xff;
    expect = slaves[0] & 0xff; // last byte into masterRx register
    steps[steps.length - 1].expectLastRx = expect;

    return steps;
  }

  function sourceCode(topo) {
    if (topo === "daisy") {
      return `// Daisy-chain SPI (one CS)
// MOSI → device0 → device1 → … → MISO
// Same SCLK/CS; longer shift (N devices × 8 bits)
// Do not tri-state fight — only end of chain drives MISO`;
    }
    return `// Independent multi-CS SPI
// Shared SCLK / MOSI / MISO
// CS[i] selects slave i (active-low)
// Only the selected slave drives MISO`;
  }

  function makeStarter() {
    return {
      topo: "multi", // multi | daisy
      nDev: 2,
      sel: 0,
      masterTx: 0xa5,
      slaves: defaultSlaves(2),
      cursor: 0,
      lastAction: "starter",
      stepped: false,
      explained: false,
      demoed: false,
      rebuilt: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-spi-multi-cs-cleared-v1";
  const STORE_KEY = "ddv-spi-multi-cs-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let quizChoice = "";
  let state = makeStarter();

  const root = document.getElementById("sm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>multi-CS</strong> with 2 slaves —
        assert <code>CS0</code>, exchange master <code>0xA5</code> with slave0 preload
        <code>0x5A</code>. Switch topology to <strong>daisy</strong> to see one CS shift through both devices.</p>
      <button type="button" class="btn btn-secondary" id="sm-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions" id="chal-quiz" hidden></div>
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
      <div class="idea-grid">
        <div class="idea-card">
          <h3>Independent CS</h3>
          <p>One CS wire per slave. Shared SCLK/MOSI/MISO. Only the selected slave is active.</p>
        </div>
        <div class="idea-card">
          <h3>Daisy chain</h3>
          <p>One CS for all. MOSI shifts through every device; frame is longer (N×8 bits).</p>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="sm-controls">
        <div class="sm-field">
          <label for="sel-topo">Topology</label>
          <select id="sel-topo">
            <option value="multi">Independent multi-CS</option>
            <option value="daisy">Daisy chain</option>
          </select>
        </div>
        <div class="sm-field">
          <label for="sel-ndev">Devices</label>
          <select id="sel-ndev">
            <option value="2" selected>2</option>
            <option value="3">3</option>
          </select>
        </div>
        <div class="sm-field">
          <label for="sel-cs">Active CS</label>
          <select id="sel-cs">
            <option value="0" selected>CS0</option>
            <option value="1">CS1</option>
            <option value="2">CS2</option>
          </select>
        </div>
        <div class="sm-field">
          <label for="in-mtx">Master TX</label>
          <input id="in-mtx" type="text" value="A5" maxlength="4">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Apply</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo multi CS0</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="topo" id="topo"></div>
      <div class="chain" id="chain"></div>
      <div class="wave" id="wave"></div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Sketch</h3>
        <pre class="code-box" id="code-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Trace</h3>
        <pre class="trace-box" id="trace-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Log</h3>
        <pre class="log-box" id="log-box"></pre>
      </div>
    </div>
  `;

  const selTopo = /** @type {HTMLSelectElement} */ (document.getElementById("sel-topo"));
  const selNdev = /** @type {HTMLSelectElement} */ (document.getElementById("sel-ndev"));
  const selCs = /** @type {HTMLSelectElement} */ (document.getElementById("sel-cs"));
  const inMtx = /** @type {HTMLInputElement} */ (document.getElementById("in-mtx"));

  function timeline() {
    if (state.topo === "daisy") {
      return buildDaisyTimeline(state.nDev, state.masterTx, state.slaves);
    }
    return buildMultiTimeline(state.nDev, state.sel, state.masterTx, state.slaves);
  }

  function syncInputs() {
    selTopo.value = state.topo;
    selNdev.value = String(state.nDev);
    selCs.value = String(Math.min(state.sel, state.nDev - 1));
    inMtx.value = state.masterTx.toString(16).toUpperCase().padStart(2, "0");
    // disable CS select in daisy
    selCs.disabled = state.topo === "daisy";
  }

  function readInputs() {
    state.topo = selTopo.value === "daisy" ? "daisy" : "multi";
    state.nDev = Number(selNdev.value) === 3 ? 3 : 2;
    state.sel = Math.min(Number(selCs.value) || 0, state.nDev - 1);
    state.masterTx = parseByte(inMtx.value);
    if (state.slaves.length !== state.nDev) {
      state.slaves = defaultSlaves(state.nDev);
    }
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter multi-CS CS0 A5↔5A");
    pushTrace("independent CS: only slave 0 selected");
    renderAll();
  }

  function applyCfg() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "apply";
    pushLog(
      `# apply topo=${state.topo} n=${state.nDev} sel=${state.sel} tx=${hex(state.masterTx)}`
    );
    renderAll();
  }

  function stepOnce() {
    const tl = timeline();
    if (state.cursor < tl.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = tl[state.cursor];
    pushTrace(
      `[${state.cursor}] ${s.label} active=${s.active} mRx=${hex(s.masterRx)}`
    );
    pushLog(`# step → ${s.label}`);
    renderAll();
  }

  function playToEnd() {
    const tl = timeline();
    state.cursor = tl.length - 1;
    state.stepped = true;
    state.lastAction = "run";
    const s = tl[state.cursor];
    pushLog(`# done mRx=${hex(s.masterRx)}`);
    pushTrace(`complete topo=${state.topo}`);
    renderAll();
  }

  function demo() {
    state = makeStarter();
    syncInputs();
    playToEnd();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo multi CS0 done");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      state.topo === "daisy"
        ? "Daisy: one CS; data ripples MOSI→D0→D1→…→MISO. Frame length grows with device count."
        : "Multi-CS: pick one CS low. Other slaves stay deselected and must not drive MISO."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const tl = timeline();
    const cur = tl[Math.min(state.cursor, tl.length - 1)];
    const done = !!cur.done;

    const v = document.getElementById("verdict");
    if (done) {
      v.className = "verdict yes";
      v.textContent =
        state.topo === "multi"
          ? `Done · spoke to slave ${state.sel} · master RX ${hex(cur.masterRx)} · slave now ${hex(cur.slaves[state.sel])}`
          : `Done daisy · last 8 MISO bits in master RX ${hex(cur.masterRx)} (expect original D0=${hex(state.slaves[0])})`;
    } else {
      v.className = "verdict idle";
      v.textContent = `step ${state.cursor}/${tl.length - 1} · ${cur.label} · ${state.topo}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.topo}</span>
      <span class="flag">n=${state.nDev}</span>
      <span class="flag ${state.topo === "multi" ? "is-on" : ""}">sel=CS${state.sel}</span>
      <span class="flag">tx=${hex(state.masterTx)}</span>
      <span class="flag">mRx=${hex(cur.masterRx)}</span>
    `;

    document.getElementById("topo").innerHTML = cur.slaves
      .map((b, i) => {
        const active =
          state.topo === "multi" ? cur.active === i : cur.active >= 0;
        const csVal =
          state.topo === "daisy"
            ? cur.cs[0]
            : cur.cs[i];
        return `<div class="dev ${active ? "is-active" : ""}">
          <h3>Slave ${i}</h3>
          <div>CS=${csVal}</div>
          <div>reg=${hex(b)}</div>
          <div>preload was ${hex(state.slaves[i])}</div>
        </div>`;
      })
      .join("");

    if (state.topo === "daisy") {
      document.getElementById("chain").textContent =
        `MOSI → ${cur.slaves.map((b, i) => `D${i}:${hex(b)}`).join(" → ")} → MISO`;
    } else {
      document.getElementById("chain").textContent =
        `Bus: SCLK/MOSI/MISO shared · CS lines independent · active=${cur.active < 0 ? "none" : "S" + cur.active}`;
    }

    const nCs = state.topo === "daisy" ? 1 : state.nDev;
    let head = "<tr><th></th>";
    tl.forEach((_, i) => {
      head += `<th>${i}</th>`;
    });
    head += "</tr>";

    const rows = [];
    for (let c = 0; c < nCs; c++) {
      let cells = `<td class="lab">${state.topo === "daisy" ? "CS" : "CS" + c}</td>`;
      tl.forEach((s, i) => {
        const val = state.topo === "daisy" ? s.cs[0] : s.cs[c];
        const curCls = i === state.cursor ? " cur" : "";
        const hi = val === 0 ? " hi" : "";
        cells += `<td class="${curCls}${hi}">${val}</td>`;
      });
      rows.push(`<tr>${cells}</tr>`);
    }
    ["sclk", "mosi", "miso"].forEach((key) => {
      let cells = `<td class="lab">${key.toUpperCase()}</td>`;
      tl.forEach((s, i) => {
        const curCls = i === state.cursor ? " cur" : "";
        const sample = key === "sclk" && s.event === "sample" ? " sample" : "";
        const hi = s[key] ? " hi" : "";
        cells += `<td class="${curCls}${sample}${hi}">${s[key]}</td>`;
      });
      rows.push(`<tr>${cells}</tr>`);
    });

    document.getElementById("wave").innerHTML =
      `<table class="wave-table"><thead>${head}</thead><tbody>${rows.join("")}</tbody></table>`;

    document.getElementById("code-box").textContent = sourceCode(state.topo);
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          topo: state.topo,
          nDev: state.nDev,
          sel: state.sel,
          masterTx: state.masterTx,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-multi",
      title: "Quiz: multi-CS",
      type: "quiz",
      prompt: "Independent multi-CS SPI usually means…",
      hint: "One select per slave.",
      choices: [
        "each slave has its own CS; SCLK/MOSI/MISO are shared",
        "each slave has its own SCLK only",
        "devices are always in a shift chain",
        "CS is ignored",
      ],
      answer: "each slave has its own CS; SCLK/MOSI/MISO are shared",
    },
    {
      id: "quiz-daisy",
      title: "Quiz: daisy",
      type: "quiz",
      prompt: "In a daisy-chain SPI hookup…",
      hint: "One CS, serial through.",
      choices: [
        "one CS selects the whole chain; MOSI shifts through each device to MISO",
        "every device needs a unique SCLK",
        "MISO is unused",
        "CS must toggle every bit",
      ],
      answer: "one CS selects the whole chain; MOSI shifts through each device to MISO",
    },
    {
      id: "quiz-miso",
      title: "Quiz: MISO fight",
      type: "quiz",
      prompt: "If two multi-CS slaves both drive MISO while selected…",
      hint: "Bus contention.",
      choices: [
        "you get contention — only one selected slave should drive MISO",
        "SPI automatically averages the bits",
        "CS polarity flips",
        "nothing happens",
      ],
      answer: "you get contention — only one selected slave should drive MISO",
    },
    {
      id: "quiz-length",
      title: "Quiz: frame length",
      type: "quiz",
      prompt: "Compared with talking to one device, a daisy chain of N byte-wide devices typically needs…",
      hint: "Bits add up.",
      choices: [
        "about N× more shift clocks in one CS frame",
        "fewer clocks always",
        "no clocks",
        "exactly one clock total",
      ],
      answer: "about N× more shift clocks in one CS frame",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — multi-CS, 2 devices, CS0.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.topo === "multi" &&
        state.nDev === 2 &&
        state.sel === 0,
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step once.",
      hint: "Step",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cursor >= 1,
    },
    {
      id: "see-cs0",
      title: "CS0 low",
      prompt: "On multi starter, land where CS0=0 and CS1=1.",
      hint: "Step past idle",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return state.topo === "multi" && s.cs[0] === 0 && s.cs[1] === 1;
      },
    },
    {
      id: "play-multi",
      title: "Play multi",
      prompt: "Play to end on starter — master RX = 0x5A.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return (
          state.topo === "multi" &&
          s.done &&
          s.masterRx === 0x5a &&
          s.slaves[0] === 0xa5
        );
      },
    },
    {
      id: "sel-cs1",
      title: "Select CS1",
      prompt: "Set Active CS to CS1 and Apply (keep multi, 2 devices).",
      hint: "Active CS → CS1, Apply",
      setup: () => loadStarter(),
      check: () => state.topo === "multi" && state.sel === 1 && state.rebuilt,
    },
    {
      id: "play-cs1",
      title: "Talk to S1",
      prompt: "Multi, CS1, Play to end — master RX = slave1 preload 0x3C.",
      hint: "CS1 + Apply + Play",
      setup: () => {
        loadStarter();
        state.sel = 1;
        syncInputs();
        applyCfg();
      },
      check: () => {
        const s = timeline()[state.cursor];
        return state.sel === 1 && s.done && s.masterRx === 0x3c;
      },
    },
    {
      id: "topo-daisy",
      title: "Daisy topology",
      prompt: "Switch topology to Daisy chain and Apply.",
      hint: "Topology dropdown",
      setup: () => loadStarter(),
      check: () => state.topo === "daisy" && state.rebuilt,
    },
    {
      id: "daisy-one-cs",
      title: "Daisy one CS",
      prompt: "On daisy, land on a step with a single CS line low.",
      hint: "Apply daisy, step",
      setup: () => {
        loadStarter();
        state.topo = "daisy";
        syncInputs();
        applyCfg();
      },
      check: () => {
        const s = timeline()[state.cursor];
        return state.topo === "daisy" && s.cs.length === 1 && s.cs[0] === 0;
      },
    },
    {
      id: "daisy-run",
      title: "Daisy run",
      prompt: "Daisy 2 devices, Play to end — master RX equals original D0 (0x5A).",
      hint: "Last 8 bits out of the chain",
      setup: () => {
        loadStarter();
        state.topo = "daisy";
        syncInputs();
        applyCfg();
      },
      check: () => {
        const s = timeline()[state.cursor];
        return state.topo === "daisy" && s.done && s.masterRx === 0x5a;
      },
    },
    {
      id: "ndev-3",
      title: "Three devices",
      prompt: "Set Devices=3 and Apply.",
      hint: "Devices dropdown",
      setup: () => loadStarter(),
      check: () => state.nDev === 3 && state.rebuilt,
    },
    {
      id: "daisy-3-len",
      title: "Daisy 3 length",
      prompt: "Daisy + 3 devices: timeline has 24 sample events (3×8).",
      hint: "Apply daisy n=3",
      setup: () => {
        loadStarter();
        state.topo = "daisy";
        state.nDev = 3;
        state.slaves = defaultSlaves(3);
        syncInputs();
        applyCfg();
      },
      check: () =>
        state.topo === "daisy" &&
        state.nDev === 3 &&
        timeline().filter((s) => s.event === "sample").length === 24,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo multi CS0.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.topo === "multi",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Click Explain.",
      hint: "Explain",
      setup: () => loadStarter(),
      check: () => state.explained === true,
    },
    {
      id: "untouched",
      title: "Other slave idle",
      prompt: "Multi CS0 Play to end — slave1 reg stays 0x3C (untouched).",
      hint: "Only selected slave updates",
      setup: () => loadStarter(),
      check: () => {
        const s = timeline()[state.cursor];
        return s.done && s.slaves[1] === 0x3c && s.slaves[0] === 0xa5;
      },
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "After stepping, Reset to cursor 0.",
      hint: "Reset",
      setup: () => {
        loadStarter();
        stepOnce();
      },
      check: () => state.cursor === 0 && state.lastAction === "reset",
    },
    {
      id: "sketch-multi",
      title: "Sketch multi",
      prompt: "On multi topology, sketch mentions independent CS.",
      hint: "Apply multi — read Sketch",
      setup: () => loadStarter(),
      check: () => state.topo === "multi" && /Independent multi-CS/i.test(sourceCode("multi")),
    },
    {
      id: "sketch-daisy",
      title: "Sketch daisy",
      prompt: "On daisy topology, sketch mentions Daisy-chain.",
      hint: "Switch to daisy",
      setup: () => {
        loadStarter();
        state.topo = "daisy";
        syncInputs();
        applyCfg();
      },
      check: () => state.topo === "daisy" && /Daisy-chain/i.test(sourceCode("daisy")),
    },
    {
      id: "first-out",
      title: "Daisy first out",
      prompt: "Daisy 2-dev: first sample MISO equals MSB of last device (S1 preload 0x3C → MSB=0).",
      hint: "Step to first ↑ sample",
      setup: () => {
        loadStarter();
        state.topo = "daisy";
        syncInputs();
        applyCfg();
      },
      check: () => {
        const s = timeline()[state.cursor];
        return (
          state.topo === "daisy" &&
          s.event === "sample" &&
          s.bytePhase === 0 &&
          s.bit === 7 &&
          s.miso === 0
        );
      },
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent =
      `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint
      ? "Hide hint"
      : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "quiz") {
      ansRow.innerHTML = "";
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="sm-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
      ansRow.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("sm-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-rebuild").addEventListener("click", applyCfg);
  document.getElementById("btn-step").addEventListener("click", stepOnce);
  document.getElementById("btn-run").addEventListener("click", playToEnd);
  document.getElementById("btn-demo").addEventListener("click", demo);
  document.getElementById("btn-explain").addEventListener("click", explain);
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.cursor = 0;
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    quizChoice = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else ok = !!ch.check();
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds = [...clearedIds, ch.id];
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("pass", "Pass");
      renderChallenge();
    } else setChalStatus("fail", "Not yet");
  });

  loadStarter();
})();
