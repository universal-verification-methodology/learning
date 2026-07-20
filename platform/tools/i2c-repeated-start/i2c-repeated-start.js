(() => {
  /**
   * I²C repeated start (concept)
   *   EEPROM-style: START → addr W → ACK → pointer → ACK
   *     then either Sr (no bus free) or STOP → idle → START
   *     then addr R → ACK → optional read → STOP
   * Starter: Sr path, addr 0x50, pointer 0x00
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

  function pushAddr(steps, iRef, addr7, rw, ack) {
    let i = iRef.v;
    for (let b = 6; b >= 0; b--) {
      const bit = (addr7 >> b) & 1;
      steps.push({
        idx: i++,
        label: `A${b}`,
        kind: "addr",
        phase: rw ? "read" : "write",
        scl: 1,
        sda: bit,
        driver: "master",
        bit,
        note: `addr bit ${b}`,
      });
    }
    steps.push({
      idx: i++,
      label: rw ? "R" : "W",
      kind: "rw",
      phase: rw ? "read" : "write",
      scl: 1,
      sda: rw ? 1 : 0,
      driver: "master",
      bit: rw ? 1 : 0,
      note: rw ? "read" : "write",
    });
    steps.push({
      idx: i++,
      label: ack ? "ACK" : "NACK",
      kind: ack ? "ack" : "nack",
      phase: rw ? "read" : "write",
      scl: 1,
      sda: ack ? 0 : 1,
      driver: "slave",
      note: ack ? "addr ACK" : "addr NACK",
    });
    iRef.v = i;
  }

  function pushData(steps, iRef, byte, kindLabel, phase, ack, driverBits) {
    let i = iRef.v;
    for (let b = 7; b >= 0; b--) {
      const bit = (byte >> b) & 1;
      steps.push({
        idx: i++,
        label: `${kindLabel}${b}`,
        kind: kindLabel === "P" ? "ptr" : "data",
        phase,
        scl: 1,
        sda: bit,
        driver: driverBits,
        bit,
        note: `${kindLabel} bit ${b}`,
      });
    }
    steps.push({
      idx: i++,
      label: ack ? "ACK" : "NACK",
      kind: ack ? "ack" : "nack",
      phase,
      scl: 1,
      sda: ack ? 0 : 1,
      driver: driverBits === "master" ? "slave" : "master",
      note: ack ? "byte ACK" : "byte NACK",
    });
    iRef.v = i;
  }

  /**
   * @param {"sr"|"stop_start"} bridge
   */
  function buildFrame(addr7, pointer, bridge, sendRead, readByte, ackWrite, ackRead) {
    const steps = [];
    const iRef = { v: 0 };

    steps.push({
      idx: iRef.v++,
      label: "idle",
      kind: "idle",
      phase: "free",
      scl: 1,
      sda: 1,
      driver: "pullup",
      note: "bus free",
      busFree: true,
    });

    steps.push({
      idx: iRef.v++,
      label: "START",
      kind: "start",
      phase: "write",
      scl: 1,
      sda: 0,
      driver: "master",
      note: "SDA↓ while SCL=1",
    });

    pushAddr(steps, iRef, addr7, 0, ackWrite);
    if (!ackWrite) {
      steps.push({
        idx: iRef.v++,
        label: "STOP",
        kind: "stop",
        phase: "abort",
        scl: 1,
        sda: 1,
        driver: "master",
        note: "abort after NACK",
      });
      steps.push({
        idx: iRef.v++,
        label: "idle",
        kind: "idle",
        phase: "free",
        scl: 1,
        sda: 1,
        driver: "pullup",
        note: "bus free",
        busFree: true,
        done: true,
      });
      return steps;
    }

    pushData(steps, iRef, pointer, "P", "write", true, "master");

    if (bridge === "sr") {
      steps.push({
        idx: iRef.v++,
        label: "Sr",
        kind: "sr",
        phase: "bridge",
        scl: 1,
        sda: 0,
        driver: "master",
        note: "repeated START — bus still owned",
      });
    } else {
      steps.push({
        idx: iRef.v++,
        label: "STOP",
        kind: "stop",
        phase: "bridge",
        scl: 1,
        sda: 1,
        driver: "master",
        note: "release bus",
      });
      steps.push({
        idx: iRef.v++,
        label: "idle",
        kind: "idle",
        phase: "free",
        scl: 1,
        sda: 1,
        driver: "pullup",
        note: "bus free between frames",
        busFree: true,
      });
      steps.push({
        idx: iRef.v++,
        label: "START",
        kind: "start",
        phase: "read",
        scl: 1,
        sda: 0,
        driver: "master",
        note: "new START after idle",
      });
    }

    pushAddr(steps, iRef, addr7, 1, ackRead);
    if (!ackRead) {
      steps.push({
        idx: iRef.v++,
        label: "STOP",
        kind: "stop",
        phase: "abort",
        scl: 1,
        sda: 1,
        driver: "master",
        note: "abort after read NACK",
      });
      steps.push({
        idx: iRef.v++,
        label: "idle",
        kind: "idle",
        phase: "free",
        scl: 1,
        sda: 1,
        driver: "pullup",
        note: "bus free",
        busFree: true,
        done: true,
      });
      return steps;
    }

    if (sendRead) {
      // Slave drives data; master NACKs last byte (common single-byte read)
      pushData(steps, iRef, readByte, "D", "read", false, "slave");
    }

    steps.push({
      idx: iRef.v++,
      label: "STOP",
      kind: "stop",
      phase: "end",
      scl: 1,
      sda: 1,
      driver: "master",
      note: "SDA↑ while SCL=1",
    });

    steps.push({
      idx: iRef.v++,
      label: "idle",
      kind: "idle",
      phase: "free",
      scl: 1,
      sda: 1,
      driver: "pullup",
      note: "bus free",
      busFree: true,
      done: true,
    });

    return steps;
  }

  function sourceCode() {
    return `// Repeated start vs Stop+Start (concept)
// Write pointer: START → addr+W → ACK → ptr → ACK
// Sr path:       Sr (SDA↓ while SCL=1, no STOP) → addr+R → …
// Stop+Start:    STOP → idle (bus free) → START → addr+R → …
// Sr keeps ownership; Stop+Start releases the bus between phases`;
  }

  function makeStarter() {
    return {
      addr: 0x50,
      pointer: 0x00,
      bridge: "sr", // "sr" | "stop_start"
      sendRead: true,
      readByte: 0xa5,
      ackWrite: true,
      ackRead: true,
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

  const CLEARED_KEY = "ddv-i2c-repeated-start-cleared-v1";
  const STORE_KEY = "ddv-i2c-repeated-start-session-v1";

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

  const root = document.getElementById("irs-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> START → <code>0x50</code> <strong>W</strong> → ACK →
        pointer <code>0x00</code> → ACK → <strong>Sr</strong> → <code>0x50</code> <strong>R</strong> → ACK →
        data <code>0xA5</code> → master NACK → STOP. Toggle <em>Stop+Start</em> to see the bus go idle.</p>
      <button type="button" class="btn btn-secondary" id="irs-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Sr</h3><p>START while busy — no STOP, bus stays owned.</p></div>
        <div class="idea-card"><h3>Stop+Start</h3><p>STOP then idle then START — bus free in between.</p></div>
        <div class="idea-card"><h3>Write→Read</h3><p>Set pointer (W), then read (R) at same device.</p></div>
        <div class="idea-card"><h3>Why Sr</h3><p>Avoids another master grabbing the bus mid-sequence.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="irs-controls">
        <div class="irs-field">
          <label for="in-addr">Addr (7-bit hex)</label>
          <input id="in-addr" type="text" value="50" maxlength="2">
        </div>
        <div class="irs-field">
          <label for="in-ptr">Pointer (hex)</label>
          <input id="in-ptr" type="text" value="00" maxlength="2">
        </div>
        <div class="irs-field">
          <label for="sel-bridge">Bridge</label>
          <select id="sel-bridge">
            <option value="sr" selected>Sr (repeated)</option>
            <option value="stop_start">Stop+Start</option>
          </select>
        </div>
        <div class="irs-field">
          <label for="sel-read">Read byte</label>
          <select id="sel-read">
            <option value="1" selected>Include</option>
            <option value="0">Skip</option>
          </select>
        </div>
        <div class="irs-field">
          <label for="in-rdata">Data (hex)</label>
          <input id="in-rdata" type="text" value="A5" maxlength="2">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Rebuild</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo Sr 0x50</button>
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
  const inPtr = /** @type {HTMLInputElement} */ (document.getElementById("in-ptr"));
  const selBridge = /** @type {HTMLSelectElement} */ (document.getElementById("sel-bridge"));
  const selRead = /** @type {HTMLSelectElement} */ (document.getElementById("sel-read"));
  const inRdata = /** @type {HTMLInputElement} */ (document.getElementById("in-rdata"));

  function frame() {
    return buildFrame(
      state.addr,
      state.pointer,
      state.bridge,
      state.sendRead,
      state.readByte,
      state.ackWrite,
      state.ackRead
    );
  }

  function writeByte() {
    return ((state.addr & 0x7f) << 1) | 0;
  }

  function readByteWire() {
    return ((state.addr & 0x7f) << 1) | 1;
  }

  function midIdleCount() {
    const f = frame();
    let sawWritePtr = false;
    let midIdle = 0;
    for (const s of f) {
      if (s.kind === "ptr" || (s.kind === "ack" && s.phase === "write" && sawWritePtr)) {
        /* after ptr starts counting */
      }
      if (s.label === "P7") sawWritePtr = true;
      if (sawWritePtr && s.busFree && !s.done) midIdle += 1;
    }
    // Simpler: count idle with phase free that is not first/last
    const idles = f.filter((s, i) => s.busFree && i > 0 && !s.done);
    return idles.length;
  }

  function hasSr() {
    return frame().some((s) => s.kind === "sr");
  }

  function syncInputs() {
    inAddr.value = state.addr.toString(16).toUpperCase().padStart(2, "0");
    inPtr.value = state.pointer.toString(16).toUpperCase().padStart(2, "0");
    selBridge.value = state.bridge;
    selRead.value = state.sendRead ? "1" : "0";
    inRdata.value = state.readByte.toString(16).toUpperCase().padStart(2, "0");
  }

  function readInputs() {
    state.addr = parseAddr(inAddr.value);
    state.pointer = parseByte(inPtr.value);
    state.bridge = selBridge.value === "stop_start" ? "stop_start" : "sr";
    state.sendRead = selRead.value === "1";
    state.readByte = parseByte(inRdata.value);
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
    pushLog("# starter Sr: 0x50 W + ptr 0x00 + Sr + R + data");
    pushTrace(`W byte=${hex(writeByte())} · R byte=${hex(readByteWire())}`);
    renderAll();
  }

  function rebuild() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "rebuild";
    pushLog(`# rebuild bridge=${state.bridge} addr=${hex(state.addr)} ptr=${hex(state.pointer)}`);
    pushTrace(`mid_idle=${midIdleCount()} sr=${hasSr() ? 1 : 0}`);
    renderAll();
  }

  function stepOnce() {
    const f = frame();
    if (state.cursor < f.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = f[state.cursor];
    pushTrace(`[${state.cursor}] ${s.label} SDA=${s.sda} (${s.kind}) ${s.note || ""}`);
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
    pushLog("# demo Sr complete");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Sr is a START condition without a preceding STOP — the bus never goes free. " +
        "Stop+Start inserts STOP then idle (both high) then START; another master could claim the bus. " +
        "EEPROM register read often uses write-pointer + Sr + read."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderWaveSvg(steps, cursor) {
    const n = steps.length;
    const w = Math.max(400, n * 18);
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
    const mid = midIdleCount();

    const v = document.getElementById("verdict");
    if (!done) {
      v.className = "verdict idle";
      v.textContent = `step ${state.cursor}/${steps.length - 1} · ${cur.label} · ${cur.note || cur.kind}`;
    } else if (state.bridge === "sr") {
      v.className = "verdict yes";
      v.textContent = `Done · Sr path · mid_idle=${mid} · W=${hex(writeByte())} R=${hex(readByteWire())}`;
    } else {
      v.className = "verdict yes";
      v.textContent = `Done · Stop+Start · mid_idle=${mid} (bus free between)`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">addr=${hex(state.addr)}</span>
      <span class="flag">ptr=${hex(state.pointer)}</span>
      <span class="flag ${state.bridge === "sr" ? "is-on" : ""}">bridge=${state.bridge === "sr" ? "Sr" : "Stop+Start"}</span>
      <span class="flag">W=${hex(writeByte())}</span>
      <span class="flag">R=${hex(readByteWire())}</span>
      <span class="flag ${mid === 0 ? "is-ok" : "is-bad"}">mid_idle=${mid}</span>
      <span class="flag ${cur.kind === "sr" || cur.kind === "start" || cur.kind === "stop" ? "is-on" : ""}">${cur.kind}</span>
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
        cells += `<td class="kind-${s.kind}${curCls}${hi}">${s[key]}</td>`;
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
          `<li class="${i === state.cursor ? "is-cur" : ""}">[${i}] ${s.label} SDA=${s.sda} <span style="color:var(--muted)">(${s.kind}/${s.phase})</span></li>`
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
          pointer: state.pointer,
          bridge: state.bridge,
          cursor: state.cursor,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-sr",
      title: "Quiz: Sr",
      type: "quiz",
      prompt: "A repeated start (Sr) is…",
      hint: "STOP or not?",
      choices: [
        "a START without an intervening STOP — bus never goes free",
        "the same as STOP then idle",
        "SCL held low by the slave",
        "a UART break",
      ],
      answer: "a START without an intervening STOP — bus never goes free",
    },
    {
      id: "quiz-idle",
      title: "Quiz: Stop+Start",
      type: "quiz",
      prompt: "Stop then Start (vs Sr) means…",
      hint: "Bus ownership.",
      choices: [
        "the bus goes idle (free) between the write and read phases",
        "SCL stays low forever",
        "address bits reverse",
        "ACK is skipped",
      ],
      answer: "the bus goes idle (free) between the write and read phases",
    },
    {
      id: "quiz-why",
      title: "Quiz: Why Sr",
      type: "quiz",
      prompt: "Masters often use Sr for write-pointer then read because…",
      hint: "Arbitration.",
      choices: [
        "another master cannot claim the bus mid-sequence",
        "pull-ups are disabled",
        "STOP is illegal on I²C",
        "R/W must stay 0",
      ],
      answer: "another master cannot claim the bus mid-sequence",
    },
    {
      id: "quiz-edge",
      title: "Quiz: Edge",
      type: "quiz",
      prompt: "Both START and Sr use which edge idea?",
      hint: "SDA vs SCL.",
      choices: [
        "SDA falling while SCL is high",
        "SDA rising while SCL is low",
        "CS falling",
        "nine NACKs",
      ],
      answer: "SDA falling while SCL is high",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — Sr write-pointer then read.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.bridge === "sr" &&
        state.addr === 0x50 &&
        state.pointer === 0x00,
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
      id: "see-sr",
      title: "Land on Sr",
      prompt: "Land on Sr (label Sr, kind sr).",
      hint: "Step until Sr",
      setup: () => loadStarter(),
      check: () => frame()[state.cursor].kind === "sr",
    },
    {
      id: "see-read-r",
      title: "Read R bit",
      prompt: "After Sr, land on R (read direction bit).",
      hint: "Step past Sr to R",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.label === "R" && s.phase === "read" && s.sda === 1;
      },
    },
    {
      id: "play-sr",
      title: "Play Sr",
      prompt: "Play to end on starter — mid_idle must be 0.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "run" &&
        frame()[state.cursor].done &&
        midIdleCount() === 0 &&
        hasSr(),
    },
    {
      id: "wire-bytes",
      title: "W/R bytes",
      prompt: "Starter: W byte 0xA0, R byte 0xA1.",
      hint: "Flags W= / R=",
      setup: () => loadStarter(),
      check: () => writeByte() === 0xa0 && readByteWire() === 0xa1,
    },
    {
      id: "switch-ss",
      title: "Stop+Start",
      prompt: "Set Bridge to Stop+Start and Rebuild.",
      hint: "Bridge → Stop+Start",
      setup: () => loadStarter(),
      check: () => state.bridge === "stop_start" && state.rebuilt,
    },
    {
      id: "see-mid-idle",
      title: "See mid idle",
      prompt: "Stop+Start: Play to end — mid_idle ≥ 1.",
      hint: "Stop+Start + Play",
      setup: () => {
        loadStarter();
        state.bridge = "stop_start";
        syncInputs();
        rebuild();
      },
      check: () =>
        state.bridge === "stop_start" &&
        frame()[state.cursor].done &&
        midIdleCount() >= 1,
    },
    {
      id: "no-sr-ss",
      title: "No Sr on SS",
      prompt: "Stop+Start rebuild: sequence has no Sr step.",
      hint: "Bridge Stop+Start, Rebuild",
      setup: () => {
        loadStarter();
        state.bridge = "stop_start";
        syncInputs();
        rebuild();
      },
      check: () => state.bridge === "stop_start" && state.rebuilt && !hasSr(),
    },
    {
      id: "ptr-10",
      title: "Pointer 0x10",
      prompt: "Set pointer to 10, Sr, Rebuild — sequence includes P7.",
      hint: "Pointer 10 + Rebuild",
      setup: () => loadStarter(),
      check: () =>
        state.pointer === 0x10 &&
        state.bridge === "sr" &&
        state.rebuilt &&
        frame().some((s) => s.label === "P7"),
    },
    {
      id: "skip-read",
      title: "Skip data",
      prompt: "Set Read byte to Skip, Rebuild — no D7 in sequence.",
      hint: "Read byte → Skip",
      setup: () => loadStarter(),
      check: () => !state.sendRead && state.rebuilt && !frame().some((s) => s.label === "D7"),
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo Sr 0x50.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.bridge === "sr" && hasSr(),
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
      id: "land-stop-ss",
      title: "Bridge STOP",
      prompt: "Stop+Start: land on the bridge STOP (phase bridge).",
      hint: "Step to first STOP after pointer",
      setup: () => {
        loadStarter();
        state.bridge = "stop_start";
        syncInputs();
        rebuild();
      },
      check: () => {
        const s = frame()[state.cursor];
        return s.kind === "stop" && s.phase === "bridge";
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
      prompt: "Addr 68, Sr, Rebuild — W=0xD0 R=0xD1.",
      hint: "0x68<<1",
      setup: () => loadStarter(),
      check: () =>
        state.addr === 0x68 &&
        state.bridge === "sr" &&
        state.rebuilt &&
        writeByte() === 0xd0 &&
        readByteWire() === 0xd1,
    },
    {
      id: "sketch",
      title: "Sketch Sr",
      prompt: "Sketch mentions Sr keeps ownership.",
      hint: "Read Sketch panel",
      setup: () => loadStarter(),
      check: () => /Sr keeps ownership/i.test(sourceCode()),
    },
    {
      id: "back-to-sr",
      title: "Back to Sr",
      prompt: "From Stop+Start, switch Bridge to Sr and Rebuild — mid_idle=0.",
      hint: "Bridge → Sr",
      setup: () => {
        loadStarter();
        state.bridge = "stop_start";
        syncInputs();
        rebuild();
      },
      check: () =>
        state.bridge === "sr" && state.rebuilt && midIdleCount() === 0 && hasSr(),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="irs-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
      b.textContent = clearedIds.includes(c.id) ? `✓ ${i + 1}` : String(i + 1);
      b.style.opacity = i === challengeIdx ? "1" : "0.7";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        else renderAll();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("irs-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-rebuild").addEventListener("click", () => rebuild());
  document.getElementById("btn-step").addEventListener("click", () => stepOnce());
  document.getElementById("btn-run").addEventListener("click", () => playToEnd());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.cursor = 0;
    state.lastAction = "reset";
    pushLog("# reset cursor");
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
    else renderAll();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else if (typeof ch.check === "function") ok = !!ch.check();
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds.push(ch.id);
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("ok", "Cleared");
    } else setChalStatus("bad", "Not yet");
    renderChallenge();
  });

  loadStarter();
})();
