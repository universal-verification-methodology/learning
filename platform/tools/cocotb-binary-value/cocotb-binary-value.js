(() => {
  /**
   * cocotb BinaryValue (concept)
   *   width + value → MSB-left bit string
   * Starter: 8-bit 0xA5 → 10100101
   */

  const IDEAS = {
    width: "n_bits sets how many bits are kept (mask applied).",
    value: "Integer or hex literal — truncated to width.",
    msb: "Bit string is MSB on the left (index width-1 … 0).",
    poke: "dut.signal.value = BinaryValue(v, n_bits=w) for drive.",
  };

  const PRESETS = {
    starter: {
      label: "starter: 8-bit 0xA5",
      width: 8,
      valueText: "0xA5",
      note: "8-bit 0xA5 → binary 10100101 (MSB left).",
      autoSet: true,
    },
    zero: {
      label: "all zeros (width 8)",
      width: 8,
      valueText: "0",
      note: "Zero value — all bits 0.",
      autoSet: true,
    },
    ones: {
      label: "all ones (width 4)",
      width: 4,
      valueText: "0xF",
      note: "4-bit 0xF → 1111.",
      autoSet: true,
    },
    truncate: {
      label: "truncate 0x1FF to 8 bits",
      width: 8,
      valueText: "0x1FF",
      note: "Value wider than width — keeps low 8 bits → 11111111.",
      autoSet: true,
    },
    wide16: {
      label: "16-bit 0x00FF",
      width: 16,
      valueText: "0x00FF",
      note: "16-bit width — low byte set, high byte zero.",
      autoSet: true,
    },
    dec255: {
      label: "decimal 255 (width 8)",
      width: 8,
      valueText: "255",
      note: "Decimal input — same as 0xFF → 11111111.",
      autoSet: true,
    },
    idle: {
      label: "idle (edit then Set)",
      width: 8,
      valueText: "0xA5",
      note: "Idle — Load a preset or edit width/value, then Set value.",
      autoSet: false,
    },
  };

  function sourceSketch() {
    return `# cocotb BinaryValue literacy (not a live simulator)
# from cocotb.binary import BinaryValue
#
# dut.data.value = BinaryValue(0xA5, n_bits=8)
# # bit string (MSB left): 10100101
#
# width   → mask to n_bits low bits
# value   → int or hex literal
# .value  → drive/read sim signal as BinaryValue
# MSB left → bit index (width-1) is leftmost char
#
# Peek: int(dut.data.value)  — integer from signal`;
  }

  function parseVal(text) {
    const t = String(text).trim();
    if (/^0x/i.test(t)) return parseInt(t, 16);
    return parseInt(t, 10);
  }

  function toBits(val, width) {
    const w = Math.max(1, Math.min(32, Number(width) || 8));
    const mask = (1 << w) - 1;
    const n = Number(val) & mask;
    let s = "";
    for (let i = w - 1; i >= 0; i--) s += (n >> i) & 1 ? "1" : "0";
    return { bits: s, value: n, width: w };
  }

  function evaluate(width, valueText) {
    let v = parseVal(valueText);
    if (isNaN(v)) return { ok: false, error: "Invalid value", bits: "", value: 0, width };
    const r = toBits(v, width);
    return { ok: true, error: "", ...r };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p.width, p.valueText);
    return {
      preset: "starter",
      width: ev.width,
      valueText: p.valueText,
      value: ev.value,
      bits: ev.bits,
      note: p.note,
      selected: "width",
      lastSet: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`set: width=${ev.width} value=0x${ev.value.toString(16).toUpperCase()} bits=${ev.bits}`],
    };
  }

  const CLEARED_KEY = "ddv-cocotb-binary-value-cleared-v1";
  const STORE_KEY = "ddv-cocotb-binary-value-session-v1";

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

  const root = document.getElementById("cbv-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        width <code>8</code>, value <code>0xA5</code> →
        bits <code>10100101</code> (MSB left).</p>
      <button type="button" class="btn btn-secondary" id="cbv-starter">Load starter example</button>
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
        <div class="idea-card"><h3>width</h3><p>n_bits masks to that many bits.</p></div>
        <div class="idea-card"><h3>value</h3><p>Int or hex — truncated to width.</p></div>
        <div class="idea-card"><h3>MSB</h3><p>Leftmost char is bit (width−1).</p></div>
        <div class="idea-card"><h3>poke</h3><p>Assign .value to drive the signal.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="cbv-controls">
        <div class="cbv-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>8-bit 0xA5</option>
            <option value="zero">all zeros</option>
            <option value="ones">4-bit 0xF</option>
            <option value="truncate">truncate 0x1FF</option>
            <option value="wide16">16-bit 0x00FF</option>
            <option value="dec255">decimal 255</option>
            <option value="idle">idle</option>
          </select>
        </div>
        <div class="cbv-field">
          <label for="inp-width">Width</label>
          <input id="inp-width" type="number" min="1" max="32" value="8" />
        </div>
        <div class="cbv-field">
          <label for="inp-value">Value</label>
          <input id="inp-value" type="text" value="0xA5" />
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-set">Set value</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo truncate</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="value-summary-row" id="value-summary-row"></div>
      <div class="cbv-layout">
        <div class="panel-box">
          <h3>Bit strip (MSB → LSB)</h3>
          <div class="bit-strip" id="bit-strip"></div>
          <h3>Ideas</h3>
          <div class="idea-row" id="idea-row"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Poke sketch</h3>
          <pre class="poke-box" id="poke-box"></pre>
        </div>
      </div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Literacy sketch</h3>
      <pre class="code-box" id="code-box"></pre>
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

  const selPreset = /** @type {HTMLSelectElement} */ (document.getElementById("sel-preset"));
  const inpWidth = /** @type {HTMLInputElement} */ (document.getElementById("inp-width"));
  const inpValue = /** @type {HTMLInputElement} */ (document.getElementById("inp-value"));

  function pokeSketch() {
    const hex = "0x" + state.value.toString(16).toUpperCase();
    return `# dut.data.value = BinaryValue(${state.valueText}, n_bits=${state.width})
# truncated int: ${state.lastSet ? hex : "—"}
# bits (MSB left): ${state.lastSet ? state.bits : "— (Set value)"}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kindName, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kindName;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    if (document.activeElement !== inpWidth) inpWidth.value = String(state.width);
    if (document.activeElement !== inpValue) inpValue.value = state.valueText;
  }

  function readInputs() {
    state.width = Math.max(1, Math.min(32, Number(inpWidth.value) || 8));
    state.valueText = inpValue.value;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter 8-bit 0xA5 → 10100101");
    renderAll();
  }

  function runSet(silent) {
    readInputs();
    const ev = evaluate(state.width, state.valueText);
    if (!ev.ok) {
      state.lastSet = true;
      state.bits = "";
      state.error = ev.error;
      pushTrace(`set: ERROR ${ev.error}`);
      if (!silent) {
        state.lastAction = "set-error";
        pushLog(`# set ERROR`);
        renderAll();
      }
      return;
    }
    state.value = ev.value;
    state.bits = ev.bits;
    state.width = ev.width;
    state.error = "";
    state.lastSet = true;
    pushTrace(
      `set: width=${ev.width} value=0x${ev.value.toString(16).toUpperCase()} bits=${ev.bits}`
    );
    if (!silent) {
      state.lastAction = "set-ok";
      pushLog(`# set bits=${ev.bits}`);
      renderAll();
    }
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.width = p.width;
    state.valueText = p.valueText;
    state.note = p.note;
    state.lastSet = false;
    state.bits = "";
    syncInputs();
    if (p.autoSet) {
      runSet(true);
      if (mark) state.lastAction = mark;
    } else if (mark) {
      state.lastAction = mark;
    }
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function demo() {
    applyPreset("truncate", null);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo truncate 0x1FF to 8 bits");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: BinaryValue masks to n_bits; bit string MSB left; use .value to poke."
    );
    renderAll();
  }

  function selectIdea(id) {
    state.selected = id;
    state.lastAction = "select";
    renderAll();
  }

  function renderValueSummary() {
    const row = document.getElementById("value-summary-row");
    if (!state.lastSet || !state.bits) {
      row.innerHTML = `
        <div class="summary-card"><h4>hex</h4><p class="val">—</p></div>
        <div class="summary-card"><h4>decimal</h4><p class="val">—</p></div>
        <div class="summary-card wide"><h4>binary (MSB left)</h4><p class="val mono">(Set value)</p></div>`;
      return;
    }
    const hexStr = "0x" + state.value.toString(16).toUpperCase().padStart(Math.ceil(state.width / 4), "0");
    const grouped =
      state.width > 4
        ? state.bits.match(/.{1,4}/g)?.join(" ") || state.bits
        : state.bits;
    row.innerHTML = `
      <div class="summary-card is-active"><h4>hex</h4><p class="val">${hexStr}</p></div>
      <div class="summary-card is-active"><h4>decimal</h4><p class="val">${state.value}</p></div>
      <div class="summary-card wide is-active"><h4>binary (MSB left)</h4><p class="val mono">${grouped}</p></div>`;
  }

  function renderBitStrip() {
    const strip = document.getElementById("bit-strip");
    if (!state.lastSet || !state.bits) {
      strip.innerHTML = `<span class="queue-empty">(Set value to render bits)</span>`;
      return;
    }
    strip.innerHTML = state.bits
      .split("")
      .map((b, i) => {
        const idx = state.width - 1 - i;
        const nibbleBreak = idx === 3 || idx === 7 || idx === 11 ? " nibble-break" : "";
        return `<div class="bit-cell ${b === "1" ? "is-one" : ""}${nibbleBreak}">${b}<span class="idx">${idx}</span></div>`;
      })
      .join("");
  }

  function renderLab() {
    syncInputs();
    renderBitStrip();
    renderValueSummary();

    document.getElementById("idea-row").innerHTML = Object.entries(IDEAS)
      .map(
        ([id]) => `
      <button type="button" class="idea-btn ${state.selected === id ? "is-sel" : ""}" data-idea="${id}">
        <div class="k">${id}</div>
        <div class="v">${id === "poke" ? ".value=" : id}</div>
      </button>`
      )
      .join("");
    document.querySelectorAll("[data-idea]").forEach((el) => {
      el.addEventListener("click", () =>
        selectIdea(/** @type {string} */ (el.getAttribute("data-idea")))
      );
    });

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      IDEAS[state.selected] || IDEAS.width;
    document.getElementById("poke-box").textContent = pokeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastSet) {
      v.className = "verdict idle";
      v.textContent = "Idle — Load preset or Set value";
    } else if (state.error) {
      v.className = "verdict no";
      v.textContent = `ERROR — ${state.error}`;
    } else {
      v.className = "verdict yes";
      v.textContent = `width=${state.width} value=0x${state.value.toString(16).toUpperCase()} → ${state.bits}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">width=${state.width}</span>
      <span class="flag ${state.lastSet ? "is-ok" : ""}">bits=${state.lastSet ? state.bits.length : "—"}</span>
      <span class="flag ${state.bits === "10100101" ? "is-ok" : state.lastSet ? "" : ""}">starter=${state.bits === "10100101" ? 1 : 0}</span>
      <span class="flag ${state.lastSet ? "is-ok" : ""}">set=${state.lastSet ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          width: state.width,
          valueText: state.valueText,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-width",
      title: "Quiz: width",
      type: "quiz",
      prompt: "n_bits on BinaryValue…",
      hint: "Mask.",
      choices: [
        "limits the value to that many low bits",
        "sets cocotb log level",
        "replaces the clock period",
        "disables assertions",
      ],
      answer: "limits the value to that many low bits",
    },
    {
      id: "quiz-msb",
      title: "Quiz: MSB",
      type: "quiz",
      prompt: "The bit string from BinaryValue is…",
      hint: "Left = high.",
      choices: [
        "MSB on the left (bit index width−1 first)",
        "LSB on the left always",
        "random order",
        "only hex digits",
      ],
      answer: "MSB on the left (bit index width−1 first)",
    },
    {
      id: "quiz-poke",
      title: "Quiz: poke",
      type: "quiz",
      prompt: "dut.data.value = BinaryValue(…)…",
      hint: "Drive.",
      choices: [
        "drives the sim signal with the encoded bit pattern",
        "reads the VCD file",
        "starts the clock",
        "clears the scoreboard",
      ],
      answer: "drives the sim signal with the encoded bit pattern",
    },
    {
      id: "quiz-a5",
      title: "Quiz: 0xA5",
      type: "quiz",
      prompt: "8-bit 0xA5 in binary (MSB left) is…",
      hint: "10100101.",
      choices: ["10100101", "10101010", "01010101", "11111111"],
      answer: "10100101",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — bits 10100101.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.bits === "10100101" &&
        state.width === 8,
    },
    {
      id: "load-zero",
      title: "Load zero",
      prompt: "Load all zeros — 00000000.",
      hint: "all zeros → Load",
      setup: () => {
        selPreset.value = "zero";
        loadPreset();
      },
      check: () => state.bits === "00000000",
    },
    {
      id: "load-ones",
      title: "Load 4-bit F",
      prompt: "Load 4-bit 0xF — bits 1111.",
      hint: "4-bit 0xF → Load",
      setup: () => {
        selPreset.value = "ones";
        loadPreset();
      },
      check: () => state.width === 4 && state.bits === "1111",
    },
    {
      id: "load-truncate",
      title: "Load truncate",
      prompt: "Load truncate 0x1FF — 8-bit FF.",
      hint: "truncate → Load",
      setup: () => {
        selPreset.value = "truncate";
        loadPreset();
      },
      check: () => state.bits === "11111111" && state.value === 0xff,
    },
    {
      id: "load-wide16",
      title: "Load 16-bit",
      prompt: "Load 16-bit 0x00FF — 16 chars ending 11111111.",
      hint: "16-bit 0x00FF → Load",
      setup: () => {
        selPreset.value = "wide16";
        loadPreset();
      },
      check: () => state.width === 16 && state.bits.endsWith("11111111"),
    },
    {
      id: "load-dec",
      title: "Load decimal 255",
      prompt: "Load decimal 255 — same as 0xFF.",
      hint: "decimal 255 → Load",
      setup: () => {
        selPreset.value = "dec255";
        loadPreset();
      },
      check: () => state.bits === "11111111" && state.valueText === "255",
    },
    {
      id: "set-ok",
      title: "Set OK",
      prompt: "From idle, Set 0x0F width 8 — 00001111.",
      hint: "idle → Set value",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
        inpValue.value = "0x0F";
        inpWidth.value = "8";
        runSet(false);
      },
      check: () => state.lastAction === "set-ok" && state.bits === "00001111",
    },
    {
      id: "demo",
      title: "Demo truncate",
      prompt: "Click Demo truncate.",
      hint: "Demo truncate",
      setup: () => loadStarter(),
      check: () => state.demoed && state.bits === "11111111",
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
      id: "select-msb",
      title: "Select MSB",
      prompt: "Click the msb idea card.",
      hint: "Click msb",
      setup: () => {
        loadStarter();
        selectIdea("msb");
      },
      check: () => state.selected === "msb" && state.lastAction === "select",
    },
    {
      id: "select-poke",
      title: "Select poke",
      prompt: "Click the poke idea card.",
      hint: "Click poke",
      setup: () => {
        loadStarter();
        selectIdea("poke");
      },
      check: () => state.selected === "poke" && state.lastAction === "select",
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions BinaryValue and n_bits.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /BinaryValue/.test(sourceSketch()) && /n_bits/.test(sourceSketch()),
    },
    {
      id: "poke-sketch",
      title: "Poke sketch",
      prompt: "On starter, poke sketch shows 0xA5.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /0xA5/.test(document.getElementById("poke-box").textContent),
    },
    {
      id: "msb-bit",
      title: "MSB bit",
      prompt: "Starter MSB (leftmost) is 1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.bits[0] === "1",
    },
    {
      id: "lsb-bit",
      title: "LSB bit",
      prompt: "Starter LSB (rightmost) is 1.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.bits[state.bits.length - 1] === "1",
    },
    {
      id: "summary-cards",
      title: "Summary cards",
      prompt: "After starter, summary shows hex 0xA5 and decimal 165.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        document.querySelector(".summary-card.is-active .val") !== null &&
        state.value === 0xa5,
    },
    {
      id: "idle-load",
      title: "Load idle",
      prompt: "Load idle — not yet set.",
      hint: "idle → Load",
      setup: () => {
        selPreset.value = "idle";
        loadPreset();
      },
      check: () => !state.lastSet && state.lastAction === "load",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From truncate, Reset — 10100101 again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "truncate";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.bits === "10100101",
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="cbv-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("cbv-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-set").addEventListener("click", () => runSet(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  inpWidth.addEventListener("input", () => {
    state.lastSet = false;
    state.lastAction = "edit";
  });
  inpValue.addEventListener("input", () => {
    state.lastSet = false;
    state.lastAction = "edit";
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

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.width) {
        state.width = saved.width;
        state.valueText = saved.valueText || "0xA5";
        state.preset = saved.preset || "starter";
        state.lastSet = false;
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
