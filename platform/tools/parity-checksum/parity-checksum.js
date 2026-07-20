(() => {
  /**
   * Even/odd parity + reduction XOR + multi-byte XOR checksum.
   *   ones = popcount(data)
   *   reduceXOR = XOR of all data bits  (== ones mod 2)
   *   even parity bit makes total ones even
   *   odd  parity bit makes total ones odd
   *   checksum = b0 ^ b1 ^ … ^ bn
   */

  function popcount(u, w) {
    let x = BigInt(u) & ((1n << BigInt(w)) - 1n);
    let n = 0;
    while (x) {
      n += Number(x & 1n);
      x >>= 1n;
    }
    return n;
  }

  function reduceXor(u, w) {
    let x = BigInt(u) & ((1n << BigInt(w)) - 1n);
    let r = 0n;
    for (let i = 0; i < w; i++) {
      r ^= (x >> BigInt(i)) & 1n;
    }
    return Number(r);
  }

  function parityBit(u, w, mode) {
    const r = reduceXor(u, w);
    // even: want data⊕p == 0 → p = r
    // odd:  want data⊕p == 1 → p = r ^ 1
    return mode === "even" ? r : r ^ 1;
  }

  function bitsOf(u, w) {
    return (BigInt(u) & ((1n << BigInt(w)) - 1n)).toString(2).padStart(w, "0");
  }

  function makeStarter() {
    return {
      width: 8,
      data: 0x2an, // 0010_1010 — 3 ones
      mode: "even",
      parity: null, // computed when attached
      attached: false,
      checkOk: null,
      bytes: [0x12, 0x34, 0x56],
      checksum: null,
      lastAction: "",
      computedParity: false,
      verified: false,
      flipped: false,
      sawFail: false,
      computedXor: false,
      computedCs: false,
      log: [],
      trace: [],
      flashBit: null,
    };
  }

  const CLEARED_KEY = "ddv-parity-checksum-cleared-v1";
  const STORE_KEY = "ddv-parity-checksum-session-v1";

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

  const root = document.getElementById("px-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Data <code>0x2A</code> (three 1s).
        Compute even parity, attach it, verify, then flip a data bit — check fails.</p>
      <button type="button" class="btn btn-secondary" id="px-starter">Load starter example</button>
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
            <h3>Reduction XOR</h3>
            <p><code>^</code> of all bits = ones mod 2 — the odd-parity of the word.</p>
          </div>
          <div class="idea-card">
            <h3>Even / odd</h3>
            <p>Parity bit chosen so total ones (data+parity) is even or odd.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Word parity</h2></div>
        <div class="panel-body">
          <div class="status-pill ok" id="status-pill">no check yet</div>
          <div class="ctrl-row">
            <label><input type="radio" name="mode" value="even" checked> Even parity</label>
            <label><input type="radio" name="mode" value="odd"> Odd parity</label>
          </div>
          <div class="bits-row" id="bits-row"></div>
          <div class="vals-grid">
            <div class="val-card"><span class="lbl">Data hex</span><span id="val-hex"></span></div>
            <div class="val-card"><span class="lbl">Ones count</span><span id="val-ones"></span></div>
            <div class="val-card"><span class="lbl">Reduce XOR</span><span id="val-rx"></span></div>
            <div class="val-card" id="card-p"><span class="lbl">Parity bit</span><span id="val-p"></span></div>
          </div>
          <div class="action-grid">
            <button type="button" id="btn-compute-p">Compute parity bit</button>
            <button type="button" id="btn-attach">Attach parity (show data+P)</button>
            <button type="button" id="btn-verify">Verify received word</button>
            <button type="button" id="btn-flip0">Flip data bit 0 (inject error)</button>
            <button type="button" id="btn-preset">Preset 0x2A</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Trace</h3>
          <pre class="trace-box" id="trace-box"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>XOR checksum (bytes)</h2></div>
        <div class="panel-body">
          <div class="bytes-list" id="bytes-list"></div>
          <div class="action-grid">
            <button type="button" id="btn-cs">Compute checksum = b0⊕b1⊕b2</button>
            <button type="button" id="btn-cs-verify">Verify: data ⊕ checksum == 0?</button>
            <button type="button" id="btn-cs-corrupt">Corrupt byte0 LSB</button>
          </div>
          <div class="val-card" style="margin-top:0.65rem" id="cs-card">
            <span class="lbl">Checksum</span>
            <span id="val-cs">—</span>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Idea</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>Reduce XOR</td><td>Fold bits with <code>^</code>; result is 1 iff odd number of 1s</td></tr>
            <tr><td>Even parity</td><td>Parity bit = reduce XOR (makes total even)</td></tr>
            <tr><td>Odd parity</td><td>Parity bit = NOT reduce XOR</td></tr>
            <tr><td>Check</td><td>Recompute; mismatch → error detected (not corrected)</td></tr>
            <tr><td>XOR checksum</td><td><code>cs = b0 ^ b1 ^ …</code>; verify all ⊕ cs == 0</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Parity detects single-bit errors; two flips can cancel.</li>
          <li>In HDL, reduction XOR is <code>^data</code> on a vector.</li>
          <li>Checksum is cheap integrity — not cryptography.</li>
        </ul>
      </div>
    </div>
  `;

  const bitsRow = document.getElementById("bits-row");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const statusPill = document.getElementById("status-pill");
  const bytesList = document.getElementById("bytes-list");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 40) state.log = state.log.slice(-30);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          state: { ...state, data: state.data.toString() },
          challengeIdx,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      state.data = BigInt(data.state.data);
      challengeIdx = Number(data.challengeIdx) || 0;
      document.querySelectorAll('input[name="mode"]').forEach((el) => {
        el.checked = el.value === state.mode;
      });
      return true;
    } catch {
      return false;
    }
  }

  function renderBits() {
    const w = state.width;
    const bin = bitsOf(state.data, w);
    bitsRow.innerHTML = "";
    for (let i = w - 1; i >= 0; i--) {
      const bit = bin[w - 1 - i];
      const cell = document.createElement("div");
      cell.className = "bit-cell";
      const idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = String(i);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = bit;
      if (bit === "1") btn.classList.add("is-one");
      if (state.flashBit === i) btn.classList.add("err-flash");
      btn.addEventListener("click", () => toggleBit(i));
      cell.appendChild(idx);
      cell.appendChild(btn);
      bitsRow.appendChild(cell);
    }
    if (state.attached && state.parity != null) {
      const cell = document.createElement("div");
      cell.className = "bit-cell";
      const idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = "P";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "is-parity" + (state.parity ? " is-one" : "");
      btn.textContent = String(state.parity);
      btn.title = "parity bit (read-only here)";
      cell.appendChild(idx);
      cell.appendChild(btn);
      bitsRow.appendChild(cell);
    }
  }

  function renderVals() {
    const w = state.width;
    const ones = popcount(state.data, w);
    const rx = reduceXor(state.data, w);
    document.getElementById("val-hex").textContent =
      "0x" + state.data.toString(16).toUpperCase().padStart(2, "0");
    document.getElementById("val-ones").textContent = String(ones);
    document.getElementById("val-rx").textContent = String(rx);
    document.getElementById("val-p").textContent =
      state.parity == null ? "—" : String(state.parity);
    const cardP = document.getElementById("card-p");
    cardP.classList.toggle("ok-border", state.checkOk === true);
    cardP.classList.toggle("bad", state.checkOk === false);

    if (state.checkOk === true) {
      statusPill.className = "status-pill ok";
      statusPill.textContent = "parity OK";
    } else if (state.checkOk === false) {
      statusPill.className = "status-pill bad";
      statusPill.textContent = "parity FAIL";
    } else {
      statusPill.className = "status-pill ok";
      statusPill.textContent = state.attached ? "parity attached" : "no check yet";
    }

    document.getElementById("val-cs").textContent =
      state.checksum == null
        ? "—"
        : "0x" + state.checksum.toString(16).toUpperCase().padStart(2, "0");
  }

  function renderBytes() {
    bytesList.innerHTML = "";
    state.bytes.forEach((b, i) => {
      const row = document.createElement("div");
      row.className = "byte-row";
      row.innerHTML = `<span>b${i}</span>`;
      const inp = document.createElement("input");
      inp.value = b.toString(16).toUpperCase().padStart(2, "0");
      inp.addEventListener("change", () => {
        const v = parseInt(inp.value, 16);
        if (Number.isFinite(v)) {
          state.bytes[i] = v & 0xff;
          state.checksum = null;
          state.lastAction = "edit-byte";
          renderAll();
        }
      });
      row.appendChild(inp);
      row.appendChild(
        Object.assign(document.createElement("span"), {
          textContent: bitsOf(BigInt(b), 8),
          style: "color:var(--muted)",
        })
      );
      bytesList.appendChild(row);
    });
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(compute parity for a trace)</span>';
      return;
    }
    traceBox.innerHTML = state.trace
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no actions yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll() {
    renderBits();
    renderVals();
    renderBytes();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    document.querySelectorAll('input[name="mode"]').forEach((el) => {
      el.checked = el.value === "even";
    });
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: 0x2A, even parity — compute, attach, verify, flip");
    renderAll();
  }

  function toggleBit(i) {
    state.data ^= 1n << BigInt(i);
    state.attached = false;
    state.parity = null;
    state.checkOk = null;
    state.lastAction = "toggle";
    state.flashBit = null;
    pushLog("run", `# toggle bit ${i}`);
    renderAll();
  }

  function computeParity() {
    const w = state.width;
    const p = parityBit(state.data, w, state.mode);
    state.parity = p;
    state.computedParity = true;
    state.computedXor = true;
    state.lastAction = "compute-p";
    const ones = popcount(state.data, w);
    const rx = reduceXor(state.data, w);
    state.trace = [
      { kind: "muted", text: `${state.mode} parity for ${bitsOf(state.data, w)}` },
      { kind: "hi", text: `ones=${ones}  reduceXOR=${rx}` },
      {
        kind: "ok",
        text:
          state.mode === "even"
            ? `P = reduceXOR = ${p}  (total ones become even)`
            : `P = NOT reduceXOR = ${p}  (total ones become odd)`,
      },
    ];
    pushLog("ok", `# parity bit = ${p}`);
    renderAll();
  }

  function attachParity() {
    if (state.parity == null) computeParity();
    state.attached = true;
    state.lastAction = "attach";
    state.checkOk = null;
    pushLog("ok", `# attached P=${state.parity}`);
    renderAll();
  }

  function verifyParity() {
    if (state.parity == null) computeParity();
    state.attached = true;
    const w = state.width;
    const rx = reduceXor(state.data, w);
    const total = rx ^ state.parity;
    const expect = state.mode === "even" ? 0 : 1;
    state.checkOk = total === expect;
    state.verified = true;
    state.lastAction = "verify";
    if (!state.checkOk) state.sawFail = true;
    state.trace = [
      { kind: "muted", text: `verify ${state.mode}: data⊕P should be ${expect}` },
      { kind: "hi", text: `reduce(data)=${rx}  P=${state.parity}  ⊕ → ${total}` },
      {
        kind: state.checkOk ? "ok" : "err",
        text: state.checkOk ? "PASS" : "FAIL — bit error detected",
      },
    ];
    pushLog(state.checkOk ? "ok" : "err", state.checkOk ? "# verify PASS" : "# verify FAIL");
    renderAll();
  }

  function flipBit0() {
    state.data ^= 1n;
    state.flipped = true;
    state.flashBit = 0;
    state.lastAction = "flip";
    // keep old parity → should fail on verify
    if (state.parity != null) {
      state.attached = true;
      state.checkOk = null;
    }
    pushLog("warn", "# flipped data bit 0 (parity bit unchanged)");
    renderAll();
  }

  function computeCs() {
    const cs = state.bytes.reduce((a, b) => a ^ b, 0) & 0xff;
    state.checksum = cs;
    state.computedCs = true;
    state.lastAction = "cs";
    pushLog(
      "ok",
      `# checksum 0x${cs.toString(16).toUpperCase()} = ${state.bytes
        .map((b) => "0x" + b.toString(16).toUpperCase())
        .join(" ⊕ ")}`
    );
    renderAll();
  }

  function verifyCs() {
    if (state.checksum == null) computeCs();
    const all = state.bytes.reduce((a, b) => a ^ b, state.checksum) & 0xff;
    const ok = all === 0;
    state.lastAction = "cs-verify";
    if (!ok) state.sawFail = true;
    pushLog(ok ? "ok" : "err", ok ? "# checksum verify PASS (⊕==0)" : "# checksum verify FAIL");
    const card = document.getElementById("cs-card");
    card.classList.toggle("ok-border", ok);
    card.classList.toggle("bad", !ok);
    renderAll();
  }

  function corruptByte() {
    state.bytes[0] ^= 1;
    state.flipped = true;
    state.lastAction = "cs-corrupt";
    pushLog("warn", "# corrupted b0 LSB");
    renderAll();
  }

  document.getElementById("px-starter").addEventListener("click", loadStarter);
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (el.checked) {
        state.mode = el.value;
        state.parity = null;
        state.attached = false;
        state.checkOk = null;
        state.lastAction = "mode";
        pushLog("run", `# mode → ${state.mode}`);
        renderAll();
      }
    });
  });
  document.getElementById("btn-compute-p").addEventListener("click", computeParity);
  document.getElementById("btn-attach").addEventListener("click", attachParity);
  document.getElementById("btn-verify").addEventListener("click", verifyParity);
  document.getElementById("btn-flip0").addEventListener("click", flipBit0);
  document.getElementById("btn-preset").addEventListener("click", () => {
    state.data = 0x2an;
    state.parity = null;
    state.attached = false;
    state.checkOk = null;
    state.flashBit = null;
    state.lastAction = "preset";
    pushLog("ok", "# preset 0x2A");
    renderAll();
  });
  document.getElementById("btn-cs").addEventListener("click", computeCs);
  document.getElementById("btn-cs-verify").addEventListener("click", verifyCs);
  document.getElementById("btn-cs-corrupt").addEventListener("click", corruptByte);

  const CHALLENGES = [
    {
      id: "quiz-reduce",
      title: "Quiz: reduce",
      prompt: "XOR of all bits equals ones mod ? Answer: <code>2</code>",
      hint: "parity of ones",
      type: "text",
      answer: "2",
      alt: ["mod 2", "%2"],
    },
    {
      id: "quiz-even",
      title: "Quiz: even P",
      prompt: "Even parity bit equals? Answer: <code>reduce xor</code>",
      hint: "P = ^data",
      type: "text",
      answer: "reduce xor",
      alt: ["reducexor", "reduction xor", "^data", "reduce xor of data"],
    },
    {
      id: "quiz-detect",
      title: "Quiz: detect",
      prompt: "Parity corrects bit errors? Answer: <code>no</code>",
      hint: "detect only",
      type: "text",
      answer: "no",
      alt: ["n", "false", "detect only"],
    },
    {
      id: "quiz-hdl",
      title: "Quiz: HDL",
      prompt: "SystemVerilog reduction XOR operator on a vector? Answer: <code>^</code>",
      hint: "unary ^",
      type: "text",
      answer: "^",
      alt: ["^data", "unary ^"],
    },
    {
      id: "starter-2a",
      title: "Starter 0x2A",
      prompt: "Load starter — data 0x2A, three ones, reduce XOR 1.",
      hint: "Load starter",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.data === 0x2an &&
        popcount(state.data, 8) === 3 &&
        reduceXor(state.data, 8) === 1,
    },
    {
      id: "even-p",
      title: "Even parity",
      prompt: "Even mode: compute parity for 0x2A — P should be 1.",
      hint: "Compute parity bit",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "even" &&
        state.computedParity &&
        state.parity === 1,
    },
    {
      id: "odd-p",
      title: "Odd parity",
      prompt: "Switch to odd, compute parity for 0x2A — P should be 0.",
      hint: "Odd → Compute",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "odd" &&
        state.computedParity &&
        state.parity === 0,
    },
    {
      id: "attach-verify",
      title: "Attach & verify",
      prompt: "Even mode: compute, attach, verify — PASS.",
      hint: "compute → attach → verify",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "even" &&
        state.attached &&
        state.verified &&
        state.checkOk === true,
    },
    {
      id: "flip-fail",
      title: "Flip fails",
      prompt: "After a good even verify, flip bit 0 and verify — FAIL.",
      hint: "verify OK → flip → verify",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.flipped &&
        state.sawFail &&
        state.checkOk === false &&
        state.verified,
    },
    {
      id: "xor-cs",
      title: "XOR checksum",
      prompt: "Compute checksum for starter bytes 12,34,56.",
      hint: "Compute checksum button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.computedCs &&
        state.checksum === (0x12 ^ 0x34 ^ 0x56),
    },
    {
      id: "cs-verify-ok",
      title: "Checksum OK",
      prompt: "Compute checksum then verify — PASS.",
      hint: "cs → verify",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (!state.computedCs || state.checksum == null) return false;
        const all =
          state.bytes.reduce((a, b) => a ^ b, state.checksum) & 0xff;
        return all === 0 && state.lastAction === "cs-verify";
      },
    },
    {
      id: "cs-corrupt",
      title: "Corrupt checksum",
      prompt: "Compute cs, corrupt b0, verify — FAIL.",
      hint: "cs → corrupt → verify",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        if (!state.computedCs || state.checksum == null) return false;
        const all =
          state.bytes.reduce((a, b) => a ^ b, state.checksum) & 0xff;
        return state.flipped && all !== 0 && state.lastAction === "cs-verify";
      },
    },
    {
      id: "quiz-0x00",
      title: "Quiz: all zero",
      prompt: "Even parity bit for 0x00? Answer: <code>0</code>",
      hint: "no ones",
      type: "text",
      answer: "0",
    },
    {
      id: "quiz-0xff",
      title: "Quiz: 0xFF even",
      prompt: "Even parity for 0xFF (8 ones)? Answer: <code>0</code>",
      hint: "even ones → P=0",
      type: "text",
      answer: "0",
    },
    {
      id: "toggle-ones",
      title: "Toggle ones",
      prompt: "From starter, toggle bits until ones count is even, then even P=0.",
      hint: "flip a 1-bit off or add a 1",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const ones = popcount(state.data, 8);
        return (
          ones % 2 === 0 &&
          state.mode === "even" &&
          state.parity === 0 &&
          state.computedParity
        );
      },
    },
    {
      id: "quiz-two-errors",
      title: "Quiz: two flips",
      prompt: "Two bit flips can hide from parity? Answer: <code>yes</code>",
      hint: "even→even",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "preset-again",
      title: "Preset 0x2A",
      prompt: "Use Preset 0x2A after changing bits.",
      hint: "Preset button",
      type: "state",
      setup: () => {
        loadStarter();
        state.data = 0xffn;
        renderAll();
      },
      check: () => state.data === 0x2an && state.lastAction === "preset",
    },
    {
      id: "quiz-cs-formula",
      title: "Quiz: cs",
      prompt: "Checksum of bytes is? Answer: <code>xor</code>",
      hint: "fold with ^",
      type: "text",
      answer: "xor",
      alt: ["^", "xor fold", "byte xor"],
    },
    {
      id: "compute-rx-flag",
      title: "Saw reduce",
      prompt: "Compute parity (sets computedXor) on any data.",
      hint: "Compute parity bit",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.computedXor && state.computedParity,
    },
    {
      id: "odd-verify",
      title: "Odd verify",
      prompt: "Odd mode on 0x2A: compute, verify — PASS.",
      hint: "odd → compute → verify",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "odd" &&
        state.checkOk === true &&
        state.parity === 0,
    },
    {
      id: "quiz-integrity",
      title: "Quiz: crypto?",
      prompt: "XOR checksum is cryptography? Answer: <code>no</code>",
      hint: "integrity only",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "full-flow",
      title: "Full flow",
      prompt: "Even verify PASS, then flip→FAIL, and compute XOR checksum once.",
      hint: "parity story + checksum",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.verified &&
        state.flipped &&
        state.sawFail &&
        state.computedCs &&
        state.checkOk === false,
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

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
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:14rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use parity / checksum actions, then Check.</span>`;
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
        answerDraft = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
    saveSession();
  }

  function checkChallenge() {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const ans = normalizeAns(document.getElementById("chal-ans")?.value || "");
      const want = [ch.answer, ...(ch.alt || [])].map(normalizeAns);
      ok = want.includes(ans);
    } else {
      try {
        ok = !!ch.check();
      } catch {
        ok = false;
      }
    }
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
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
