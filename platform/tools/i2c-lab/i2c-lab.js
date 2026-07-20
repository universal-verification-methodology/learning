(() => {
  /**
   * I²C start/addr/ack explorer (concept)
   *   Idle: SDA=1, SCL=1
   *   START: SDA↓ while SCL=1
   *   Addr[6:0] MSB first, then R/W (0=W, 1=R)
   *   ACK: slave pulls SDA=0; NACK: SDA=1
   *   Optional data byte + ACK
   *   STOP: SDA↑ while SCL=1
   * Starter: addr 0x50 write, ACK, stop (no data)
   */

  function hex(n, w = 2) {
    return "0x" + (n & ((1 << (w * 4)) - 1)).toString(16).toUpperCase().padStart(w, "0");
  }

  function parseAddr(raw) {
    const t = String(raw).trim().replace(/^0x/i, "");
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0x7f;
  }

  function parseByte(raw) {
    const t = String(raw).trim().replace(/^0x/i, "");
    const n = parseInt(t, 16);
    return Number.isNaN(n) ? 0 : n & 0xff;
  }

  /**
   * Each step is one SCL high sample window (or special START/STOP edge).
   * @returns {{label:string,kind:string,scl:number,sda:number,driver:string,note?:string}[]}
   */
  function buildFrame(addr7, rw, ackAddr, dataByte, sendData, ackData) {
    const steps = [];
    let i = 0;

    steps.push({
      idx: i++,
      label: "idle",
      kind: "idle",
      scl: 1,
      sda: 1,
      driver: "pullup",
      note: "bus free",
    });

    // START: SDA falls while SCL high
    steps.push({
      idx: i++,
      label: "START",
      kind: "start",
      scl: 1,
      sda: 0,
      driver: "master",
      note: "SDA↓ while SCL=1",
    });

    // Address bits A6..A0
    for (let b = 6; b >= 0; b--) {
      const bit = (addr7 >> b) & 1;
      steps.push({
        idx: i++,
        label: `A${b}`,
        kind: "addr",
        scl: 1,
        sda: bit,
        driver: "master",
        bit,
        note: `addr bit ${b}`,
      });
    }

    // R/W
    steps.push({
      idx: i++,
      label: rw ? "R" : "W",
      kind: "rw",
      scl: 1,
      sda: rw ? 1 : 0,
      driver: "master",
      bit: rw ? 1 : 0,
      note: rw ? "read" : "write",
    });

    // ACK/NACK after address
    steps.push({
      idx: i++,
      label: ackAddr ? "ACK" : "NACK",
      kind: ackAddr ? "ack" : "nack",
      scl: 1,
      sda: ackAddr ? 0 : 1,
      driver: "slave",
      note: ackAddr ? "slave ACK" : "slave NACK",
    });

    if (sendData && ackAddr) {
      for (let b = 7; b >= 0; b--) {
        const bit = (dataByte >> b) & 1;
        steps.push({
          idx: i++,
          label: `D${b}`,
          kind: "data",
          scl: 1,
          sda: bit,
          driver: "master",
          bit,
          note: `data bit ${b}`,
        });
      }
      steps.push({
        idx: i++,
        label: ackData ? "ACK" : "NACK",
        kind: ackData ? "ack" : "nack",
        scl: 1,
        sda: ackData ? 0 : 1,
        driver: "slave",
        note: ackData ? "data ACK" : "data NACK",
      });
    }

    // STOP: SDA rises while SCL high (from SDA low after prep)
    steps.push({
      idx: i++,
      label: "STOP",
      kind: "stop",
      scl: 1,
      sda: 1,
      driver: "master",
      note: "SDA↑ while SCL=1",
    });

    steps.push({
      idx: i++,
      label: "idle",
      kind: "idle",
      scl: 1,
      sda: 1,
      driver: "pullup",
      note: "bus free",
      done: true,
    });

    return steps;
  }

  function sourceCode() {
    return `// I²C frame (concept)
// START: SDA falls while SCL high
// then: addr[6:0], R/W, ACK/NACK
// optional: data[7:0], ACK/NACK
// STOP:  SDA rises while SCL high
// Open-drain + pull-ups; MSB first`;
  }

  function makeStarter() {
    return {
      addr: 0x50,
      rw: 0, // 0=write 1=read
      ackAddr: true,
      sendData: false,
      data: 0xa5,
      ackData: true,
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

  const CLEARED_KEY = "ddv-i2c-lab-cleared-v1";
  const STORE_KEY = "ddv-i2c-lab-session-v1";

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

  const root = document.getElementById("i2c-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> START → address <code>0x50</code> +
        <strong>W</strong> → slave <strong>ACK</strong> → STOP.
        Toggle NACK or add a data byte to explore other outcomes.</p>
      <button type="button" class="btn btn-secondary" id="i2c-starter">Load starter example</button>
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
        <div class="idea-card"><h3>START</h3><p>SDA falls while SCL is high.</p></div>
        <div class="idea-card"><h3>Address</h3><p>7-bit addr MSB first, then R/W.</p></div>
        <div class="idea-card"><h3>ACK</h3><p>Slave pulls SDA low on 9th clock.</p></div>
        <div class="idea-card"><h3>STOP</h3><p>SDA rises while SCL is high.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="i2c-controls">
        <div class="i2c-field">
          <label for="in-addr">Addr (7-bit hex)</label>
          <input id="in-addr" type="text" value="50" maxlength="2">
        </div>
        <div class="i2c-field">
          <label for="sel-rw">R/W</label>
          <select id="sel-rw">
            <option value="0" selected>Write (0)</option>
            <option value="1">Read (1)</option>
          </select>
        </div>
        <div class="i2c-field">
          <label for="sel-ack">Addr response</label>
          <select id="sel-ack">
            <option value="ack" selected>ACK</option>
            <option value="nack">NACK</option>
          </select>
        </div>
        <div class="i2c-field">
          <label for="sel-data">Data byte</label>
          <select id="sel-data">
            <option value="0" selected>None</option>
            <option value="1">Send data</option>
          </select>
        </div>
        <div class="i2c-field">
          <label for="in-data">Data (hex)</label>
          <input id="in-data" type="text" value="A5" maxlength="2">
        </div>
        <div class="i2c-field">
          <label for="sel-dack">Data response</label>
          <select id="sel-dack">
            <option value="ack" selected>ACK</option>
            <option value="nack">NACK</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Rebuild</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo 0x50 W+ACK</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="wave" id="wave"></div>
      <div class="panel" style="margin:0.75rem 0;padding:0.65rem;border:1px solid var(--line);border-radius:8px">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Sequence</h3>
        <ol class="bit-list" id="bit-list"></ol>
      </div>
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

  const inAddr = /** @type {HTMLInputElement} */ (document.getElementById("in-addr"));
  const selRw = /** @type {HTMLSelectElement} */ (document.getElementById("sel-rw"));
  const selAck = /** @type {HTMLSelectElement} */ (document.getElementById("sel-ack"));
  const selData = /** @type {HTMLSelectElement} */ (document.getElementById("sel-data"));
  const inData = /** @type {HTMLInputElement} */ (document.getElementById("in-data"));
  const selDack = /** @type {HTMLSelectElement} */ (document.getElementById("sel-dack"));

  function frame() {
    return buildFrame(
      state.addr,
      state.rw,
      state.ackAddr,
      state.data,
      state.sendData,
      state.ackData
    );
  }

  function firstByte() {
    return ((state.addr & 0x7f) << 1) | (state.rw & 1);
  }

  function syncInputs() {
    inAddr.value = state.addr.toString(16).toUpperCase().padStart(2, "0");
    selRw.value = String(state.rw);
    selAck.value = state.ackAddr ? "ack" : "nack";
    selData.value = state.sendData ? "1" : "0";
    inData.value = state.data.toString(16).toUpperCase().padStart(2, "0");
    selDack.value = state.ackData ? "ack" : "nack";
  }

  function readInputs() {
    state.addr = parseAddr(inAddr.value);
    state.rw = Number(selRw.value) ? 1 : 0;
    state.ackAddr = selAck.value === "ack";
    state.sendData = selData.value === "1";
    state.data = parseByte(inData.value);
    state.ackData = selDack.value === "ack";
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
    pushLog("# starter 0x50 W + ACK + STOP");
    pushTrace(`first byte on wire = ${hex(firstByte())} (addr<<1 | W)`);
    renderAll();
  }

  function rebuild() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "rebuild";
    pushLog(
      `# rebuild addr=${hex(state.addr)} ${state.rw ? "R" : "W"} ack=${state.ackAddr ? 1 : 0}`
    );
    pushTrace(`first byte=${hex(firstByte())}`);
    renderAll();
  }

  function stepOnce() {
    const f = frame();
    if (state.cursor < f.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = f[state.cursor];
    pushTrace(`[${state.cursor}] ${s.label} SDA=${s.sda} (${s.kind}) ${s.driver}`);
    pushLog(`# step → ${s.label}`);
    renderAll();
  }

  function playToEnd() {
    const f = frame();
    state.cursor = f.length - 1;
    state.stepped = true;
    state.lastAction = "run";
    pushLog("# play to end");
    renderAll();
  }

  function demo() {
    state = makeStarter();
    syncInputs();
    playToEnd();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo complete");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "START/STOP are levels on SDA while SCL is high. " +
        "Address is 7 bits + R/W; the 9th bit is ACK (SDA=0) or NACK (SDA=1) from the slave. " +
        "Open-drain wires need pull-ups — idle is high."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderWaveSvg(steps, cursor) {
    const n = steps.length;
    const w = Math.max(400, n * 22);
    const h = 80;
    const paths = [
      { key: "scl", y: 22 },
      { key: "sda", y: 58 },
    ]
      .map(({ key, y }) => {
        const y1 = y - 10;
        const y0 = y + 10;
        let d = "";
        for (let i = 0; i < n; i++) {
          const x0 = (i / n) * w;
          const x1 = ((i + 1) / n) * w;
          const val = steps[i][key];
          const yy = val ? y1 : y0;
          if (i === 0) d += `M ${x0} ${yy}`;
          else {
            const prev = steps[i - 1][key] ? y1 : y0;
            if (prev !== yy) d += ` L ${x0} ${prev} L ${x0} ${yy}`;
          }
          d += ` L ${x1} ${yy}`;
        }
        return `<text x="2" y="${y + 4}" font-size="10" fill="currentColor">${key.toUpperCase()}</text>
          <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" transform="translate(36,0)"/>`;
      })
      .join("");
    const cx = 36 + ((cursor + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w + 40} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${paths}
      <line x1="${cx}" y1="4" x2="${cx}" y2="${h - 4}" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  }

  function renderLab() {
    syncInputs();
    const steps = frame();
    const cur = steps[Math.min(state.cursor, steps.length - 1)];
    const done = !!cur.done;
    const nacked = steps.some((s) => s.kind === "nack");

    const v = document.getElementById("verdict");
    if (!done) {
      v.className = "verdict idle";
      v.textContent = `step ${state.cursor}/${steps.length - 1} · ${cur.label} · SDA=${cur.sda} (${cur.driver})`;
    } else if (nacked) {
      v.className = "verdict no";
      v.textContent = `Frame ended with NACK · addr ${hex(state.addr)} ${state.rw ? "R" : "W"}`;
    } else {
      v.className = "verdict yes";
      v.textContent = `Frame OK · ${hex(state.addr)} ${state.rw ? "R" : "W"} · first byte ${hex(firstByte())}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">addr=${hex(state.addr)}</span>
      <span class="flag">${state.rw ? "READ" : "WRITE"}</span>
      <span class="flag">wire0=${hex(firstByte())}</span>
      <span class="flag ${state.ackAddr ? "is-ok" : "is-bad"}">addr_${state.ackAddr ? "ACK" : "NACK"}</span>
      <span class="flag ${cur.kind === "start" || cur.kind === "stop" ? "is-on" : ""}">${cur.kind}</span>
    `;

    let head = "<tr><th></th>";
    steps.forEach((_, i) => {
      head += `<th>${i}</th>`;
    });
    head += "</tr>";

    const rowBits = (lab, key) => {
      let cells = `<td class="lab">${lab}</td>`;
      steps.forEach((s, i) => {
        const curCls = i === state.cursor ? " cur" : "";
        const hi = s[key] ? " hi" : "";
        const kind = ` kind-${s.kind}`;
        cells += `<td class="${kind}${curCls}${hi}">${s[key]}</td>`;
      });
      return `<tr>${cells}</tr>`;
    };

    let rowLab = `<tr><td class="lab">phase</td>`;
    steps.forEach((s, i) => {
      const curCls = i === state.cursor ? " cur" : "";
      rowLab += `<td class="kind-${s.kind}${curCls}">${s.label}</td>`;
    });
    rowLab += "</tr>";

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>
        ${rowBits("SCL", "scl")}
        ${rowBits("SDA", "sda")}
        ${rowLab}
      </tbody></table>
      ${renderWaveSvg(steps, state.cursor)}
    `;

    document.getElementById("bit-list").innerHTML = steps
      .map(
        (s, i) =>
          `<li class="${i === state.cursor ? "is-cur" : ""}">[${i}] ${s.label} SDA=${s.sda} <span style="color:var(--muted)">(${s.kind}/${s.driver})</span></li>`
      )
      .join("");

    document.getElementById("code-box").textContent = sourceCode();
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
          addr: state.addr,
          rw: state.rw,
          ackAddr: state.ackAddr,
          sendData: state.sendData,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-start",
      title: "Quiz: START",
      type: "quiz",
      prompt: "An I²C START condition is…",
      hint: "SDA vs SCL.",
      choices: [
        "SDA falling while SCL is high",
        "SCL falling while SDA is low only",
        "both lines rising together",
        "a UART start bit of 0",
      ],
      answer: "SDA falling while SCL is high",
    },
    {
      id: "quiz-stop",
      title: "Quiz: STOP",
      type: "quiz",
      prompt: "An I²C STOP condition is…",
      hint: "Opposite of START.",
      choices: [
        "SDA rising while SCL is high",
        "SDA falling while SCL is high",
        "CS going low",
        "nine NACKs",
      ],
      answer: "SDA rising while SCL is high",
    },
    {
      id: "quiz-ack",
      title: "Quiz: ACK",
      type: "quiz",
      prompt: "A slave ACK after the address byte means…",
      hint: "SDA during 9th clock.",
      choices: [
        "the slave pulls SDA low on the 9th bit",
        "the master forces SDA high",
        "STOP already happened",
        "R/W must be 1",
      ],
      answer: "the slave pulls SDA low on the 9th bit",
    },
    {
      id: "quiz-rw",
      title: "Quiz: R/W",
      type: "quiz",
      prompt: "In the address byte, R/W=0 typically means…",
      hint: "Direction.",
      choices: [
        "master write (toward the slave)",
        "master read only",
        "broadcast always",
        "NACK required",
      ],
      answer: "master write (toward the slave)",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — 0x50 write + ACK.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.addr === 0x50 &&
        state.rw === 0 &&
        state.ackAddr,
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
      id: "see-start",
      title: "Land on START",
      prompt: "Land on START (SDA=0, SCL=1).",
      hint: "Step to START",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.kind === "start" && s.sda === 0 && s.scl === 1;
      },
    },
    {
      id: "see-ack",
      title: "Land on ACK",
      prompt: "Land on address ACK (SDA=0, slave).",
      hint: "Step to ACK",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.kind === "ack" && s.sda === 0 && s.driver === "slave";
      },
    },
    {
      id: "see-stop",
      title: "Land on STOP",
      prompt: "Land on STOP.",
      hint: "Step or Play",
      setup: () => loadStarter(),
      check: () => frame()[state.cursor].kind === "stop",
    },
    {
      id: "play-ok",
      title: "Play clean",
      prompt: "Play to end on starter — no NACK.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "run" &&
        frame()[state.cursor].done &&
        !frame().some((s) => s.kind === "nack"),
    },
    {
      id: "first-byte",
      title: "First byte value",
      prompt: "Starter first byte on wire is 0xA0 (0x50<<1 | W).",
      hint: "Check flag wire0= or Rebuild",
      setup: () => loadStarter(),
      check: () => firstByte() === 0xa0,
    },
    {
      id: "set-read",
      title: "Read direction",
      prompt: "Set R/W to Read and Rebuild — first byte becomes 0xA1.",
      hint: "R/W → Read, Rebuild",
      setup: () => loadStarter(),
      check: () => state.rw === 1 && state.rebuilt && firstByte() === 0xa1,
    },
    {
      id: "set-nack",
      title: "Addr NACK",
      prompt: "Set Addr response to NACK and Rebuild.",
      hint: "Addr response → NACK",
      setup: () => loadStarter(),
      check: () => !state.ackAddr && state.rebuilt,
    },
    {
      id: "see-nack",
      title: "See NACK",
      prompt: "NACK preset: land on NACK with SDA=1.",
      hint: "Rebuild NACK, step to NACK",
      setup: () => {
        loadStarter();
        state.ackAddr = false;
        syncInputs();
        rebuild();
      },
      check: () => {
        const s = frame()[state.cursor];
        return s.kind === "nack" && s.sda === 1;
      },
    },
    {
      id: "send-data",
      title: "Add data",
      prompt: "Enable Send data, keep ACK, Rebuild.",
      hint: "Data byte → Send data",
      setup: () => loadStarter(),
      check: () => state.sendData && state.ackAddr && state.rebuilt,
    },
    {
      id: "data-a5",
      title: "Data A5",
      prompt: "Send data=A5 with ACKs — Play to end; sequence includes D7..D0.",
      hint: "Send data + Play",
      setup: () => {
        loadStarter();
        state.sendData = true;
        state.data = 0xa5;
        syncInputs();
        rebuild();
      },
      check: () =>
        state.sendData &&
        frame().some((s) => s.label === "D7") &&
        frame()[state.cursor].done &&
        !frame().some((s) => s.kind === "nack"),
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo 0x50 W+ACK.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.addr === 0x50,
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
      id: "a6-bit",
      title: "MSB of addr",
      prompt: "For 0x50, land on A6 — bit should be 1 (0x50=1010000).",
      hint: "Step to A6",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.label === "A6" && s.sda === 1;
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
      id: "addr-68",
      title: "Addr 0x68",
      prompt: "Set addr to 68, Write, ACK, Rebuild — first byte 0xD0.",
      hint: "0x68<<1 = 0xD0",
      setup: () => loadStarter(),
      check: () =>
        state.addr === 0x68 &&
        state.rw === 0 &&
        state.rebuilt &&
        firstByte() === 0xd0,
    },
    {
      id: "sketch",
      title: "Sketch START",
      prompt: "Sketch mentions START with SDA falling.",
      hint: "Read Sketch panel",
      setup: () => loadStarter(),
      check: () => /START: SDA falls/i.test(sourceCode()),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="i2c-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("i2c-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-rebuild").addEventListener("click", rebuild);
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
