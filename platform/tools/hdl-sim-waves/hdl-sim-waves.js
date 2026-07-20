(() => {
  /**
   * Full-sim waves (concept)
   *   Add signals · C1/C2 · radix in simulator Wave pane
   * Starter: clk + q on wave, C1@5 C2@10, q hex — WATCHING
   */

  const SIGNALS = [
    {
      id: "clk",
      label: "clk",
      width: 1,
      blurb: "Clock — add to wave to see toggling edges over time.",
    },
    {
      id: "rst_n",
      label: "rst_n",
      width: 1,
      blurb: "Reset — often high after release; watch on wave for bring-up.",
    },
    {
      id: "data",
      label: "data",
      width: 4,
      blurb: "4-bit data bus — try hex radix on the wave label.",
    },
    {
      id: "q",
      label: "q",
      width: 4,
      blurb: "4-bit counter output — compare at C1 vs C2 with delta.",
    },
  ];

  const RADIX_BLURB = {
    bin: "Binary — every bit visible (good for 1-bit, noisy for wide buses).",
    hex: "Hex — compact bus labels (common for counters and addresses).",
    dec: "Decimal — human-friendly for small numeric values.",
  };

  const MAX_T = 15;

  /** Mock counter values at each tick (concept aid). */
  const MOCK_Q = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];
  const MOCK_DATA = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8];

  function sigOf(id) {
    return SIGNALS.find((s) => s.id === id);
  }

  function defaultRadix() {
    return { clk: "bin", rst_n: "bin", data: "bin", q: "bin" };
  }

  function formatVal(id, t, radixMap) {
    const s = sigOf(id);
    if (!s) return "?";
    let v = 0;
    if (id === "clk") v = t % 2;
    else if (id === "rst_n") v = t < 2 ? 0 : 1;
    else if (id === "data") v = MOCK_DATA[t] ?? 0;
    else if (id === "q") v = MOCK_Q[t] ?? 0;

    const rad = radixMap[id] || "bin";
    if (s.width === 1) return String(v);
    if (rad === "hex") return "0x" + v.toString(16).toUpperCase();
    if (rad === "dec") return String(v);
    return v.toString(2).padStart(s.width, "0");
  }

  function evaluate(s) {
    const triad = s.didAdd && s.didCursor && s.didRadix;
    const hasClkQ =
      s.wave.includes("clk") && s.wave.includes("q") && s.wave.length >= 2;
    const cursorsOk =
      s.c1 !== null && s.c2 !== null && s.c1 !== s.c2;
    const busRadixOk =
      (s.radix.q && s.radix.q !== "bin") ||
      (s.radix.data && s.radix.data !== "bin");

    let status = "EMPTY";
    let ready = false;
    let reason = "add signals to the wave pane";

    if (triad && hasClkQ && cursorsOk && busRadixOk) {
      status = "WATCHING";
      ready = true;
      reason = `clk+q on wave · C1@${s.c1} C2@${s.c2} · bus radix set`;
    } else if (s.wave.length === 0) {
      status = "EMPTY";
      reason = "add signals from the pool to the wave pane";
    } else if (!cursorsOk) {
      status = "PARTIAL";
      reason = "signals on wave — set C1 and C2 at different times";
    } else if (!busRadixOk) {
      status = "PARTIAL";
      reason = "cursors set — change radix on a bus (data or q)";
    } else if (!hasClkQ) {
      status = "PARTIAL";
      reason = "need clk and q on wave for the starter pattern";
    } else if (triad) {
      status = "PARTIAL";
      reason = "finish clk+q · C1/C2 · hex radix triad";
    } else {
      status = "PARTIAL";
      reason = "practice add · cursors · radix, then Scan";
    }

    return { status, ready, reason, triad, hasClkQ, cursorsOk, busRadixOk };
  }

  const PRESETS = {
    starter: {
      label: "starter: watching",
      wave: ["clk", "q"],
      c1: 5,
      c2: 10,
      selTime: 5,
      radix: { clk: "bin", rst_n: "bin", data: "bin", q: "hex" },
      sel: "q",
      didAdd: true,
      didCursor: true,
      didRadix: true,
      note: "clk+q on wave · C1@5 C2@10 · q hex — WATCHING.",
      autoScan: true,
    },
    empty: {
      label: "empty wave",
      wave: [],
      c1: null,
      c2: null,
      selTime: 0,
      radix: defaultRadix(),
      sel: "clk",
      didAdd: false,
      didCursor: false,
      didRadix: false,
      note: "Empty wave — add signals from the pool.",
      autoScan: true,
    },
    clk_only: {
      label: "clk only",
      wave: ["clk"],
      c1: null,
      c2: null,
      selTime: 0,
      radix: defaultRadix(),
      sel: "clk",
      didAdd: true,
      didCursor: false,
      didRadix: false,
      note: "Only clk on wave — add q and set cursors.",
      autoScan: true,
    },
    signals_no_cursors: {
      label: "signals no cursors",
      wave: ["clk", "q", "data"],
      c1: null,
      c2: null,
      selTime: 3,
      radix: defaultRadix(),
      sel: "q",
      didAdd: true,
      didCursor: false,
      didRadix: false,
      note: "Signals added — set C1 and C2 on the timeline.",
      autoScan: true,
    },
    c1_only: {
      label: "C1 only",
      wave: ["clk", "q"],
      c1: 5,
      c2: null,
      selTime: 5,
      radix: defaultRadix(),
      sel: "q",
      didAdd: true,
      didCursor: true,
      didRadix: false,
      note: "C1@5 set — add C2 and hex radix for WATCHING.",
      autoScan: true,
    },
    unscanned: {
      label: "empty unscanned",
      wave: [],
      c1: null,
      c2: null,
      selTime: 0,
      radix: defaultRadix(),
      sel: "clk",
      didAdd: false,
      didCursor: false,
      didRadix: false,
      note: "Empty — add / cursor / radix, then Scan.",
      autoScan: false,
    },
  };

  function literacyText() {
    return [
      "// Full-sim waves literacy (document aid — not a full viewer)",
      "//",
      "//   add     → drag/pick signals from Hierarchy/Signals into Wave",
      "//   C1 / C2 → time cursors; delta = |C2 − C1| for interval checks",
      "//   radix   → bin / hex / dec labels on bus waves",
      "//",
      "// WATCHING = clk+q on wave, C1 and C2 set, bus radix changed.",
      "// Pair with waveform-lab (engine waves) and hdl-sim-tour (pane map).",
    ].join("\n");
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const ev = evaluate(p);
    return {
      preset: "starter",
      wave: [...p.wave],
      c1: p.c1,
      c2: p.c2,
      selTime: p.selTime,
      radix: { ...p.radix },
      sel: p.sel,
      didAdd: p.didAdd,
      didCursor: p.didCursor,
      didRadix: p.didRadix,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: ${ev.status}`],
    };
  }

  const CLEARED_KEY = "ddv-hdl-sim-waves-cleared-v1";
  const STORE_KEY = "ddv-hdl-sim-waves-session-v1";

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

  const root = document.getElementById("hsw-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        <code>clk</code> + <code>q</code> on wave · C1@5 C2@10 · <code>q</code> hex — WATCHING.</p>
      <button type="button" class="btn btn-secondary" id="hsw-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Add</h3><p>Signals from pool → wave pane.</p></div>
        <div class="idea-card"><h3>C1 / C2</h3><p>Time cursors · read values · delta.</p></div>
        <div class="idea-card"><h3>Radix</h3><p>bin / hex / dec bus labels.</p></div>
        <div class="idea-card"><h3>WATCHING</h3><p>Full wave literacy practiced.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="hsw-controls">
        <div class="hsw-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>watching starter</option>
            <option value="empty">empty wave</option>
            <option value="clk_only">clk only</option>
            <option value="signals_no_cursors">signals no cursors</option>
            <option value="c1_only">C1 only</option>
            <option value="unscanned">empty unscanned</option>
          </select>
        </div>
        <div class="hsw-field">
          <label for="sel-radix">Radix (sel)</label>
          <select id="sel-radix">
            <option value="bin">bin</option>
            <option value="hex">hex</option>
            <option value="dec">dec</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-add">Add to wave</button>
        <button type="button" class="btn btn-ghost" id="btn-remove">Remove</button>
        <button type="button" class="btn btn-secondary" id="btn-c1">Set C1</button>
        <button type="button" class="btn btn-secondary" id="btn-c2">Set C2</button>
        <button type="button" class="btn btn-ghost" id="btn-radix">Apply radix</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo partial</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="hsw-layout">
        <div class="panel-box">
          <h3>Signal pool</h3>
          <ul class="sig-list" id="pool-list"></ul>
          <h3>Wave pane</h3>
          <ul class="sig-list" id="wave-list"></ul>
          <h3>Timeline (0–${MAX_T})</h3>
          <div class="timeline" id="timeline"></div>
          <div class="delta-box" id="delta-box"></div>
          <div class="wave-rows" id="wave-rows"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Wave sketch</h3>
          <pre class="plan-box" id="plan-box"></pre>
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
  const selRadix = /** @type {HTMLSelectElement} */ (document.getElementById("sel-radix"));

  function flags() {
    return {
      didAdd: state.didAdd,
      didCursor: state.didCursor,
      didRadix: state.didRadix,
    };
  }

  function planSketch() {
    const waveLine =
      state.wave.length > 0
        ? state.wave
            .map((id) => {
              const s = sigOf(id);
              return `${s.label}(${state.radix[id]})`;
            })
            .join(" · ")
        : "(empty)";
    const c1s = state.c1 !== null ? `@${state.c1}` : "—";
    const c2s = state.c2 !== null ? `@${state.c2}` : "—";
    const delta =
      state.c1 !== null && state.c2 !== null
        ? Math.abs(state.c2 - state.c1)
        : "—";
    return `# wave pane session
wave: ${waveLine}
C1${c1s}  C2${c2s}  delta=${delta}
did: add=${state.didAdd ? 1 : 0} cursor=${state.didCursor ? 1 : 0} radix=${state.didRadix ? 1 : 0}
# status: ${state.lastScanned ? state.status : "— (Scan)"}
# reason: ${state.lastScanned ? state.reason : "—"}`;
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
    if (state.sel && state.radix[state.sel]) {
      selRadix.value = state.radix[state.sel];
    }
  }

  function runScan(silent) {
    const ev = evaluate(state);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status}`);
    if (!silent) {
      state.lastAction = ev.ready ? "scan-ok" : "scan-bad";
      pushLog(`# scan ${ev.status}`);
      renderAll();
    }
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter WATCHING");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.wave = [...p.wave];
    state.c1 = p.c1;
    state.c2 = p.c2;
    state.selTime = p.selTime;
    state.radix = { ...p.radix };
    state.sel = p.sel;
    state.didAdd = p.didAdd;
    state.didCursor = p.didCursor;
    state.didRadix = p.didRadix;
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.lastScanned = false;
    syncInputs();
    if (p.autoScan) {
      runScan(true);
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

  function addToWave() {
    if (!state.sel) {
      state.lastAction = "add-bad";
      pushLog("# add FAIL");
      renderAll();
      return;
    }
    if (state.wave.includes(state.sel)) {
      state.lastAction = "add-bad";
      pushLog(`# add FAIL (${state.sel} already on wave)`);
      renderAll();
      return;
    }
    state.wave.push(state.sel);
    state.didAdd = true;
    state.preset = "custom";
    pushTrace(`add: ${state.sel}`);
    pushLog(`# add ${state.sel}`);
    runScan(true);
    state.lastAction = "add";
    renderAll();
  }

  function removeFromWave() {
    if (!state.sel || !state.wave.includes(state.sel)) {
      state.lastAction = "remove-bad";
      pushLog("# remove FAIL");
      renderAll();
      return;
    }
    state.wave = state.wave.filter((id) => id !== state.sel);
    state.preset = "custom";
    pushTrace(`remove: ${state.sel}`);
    pushLog(`# remove ${state.sel}`);
    runScan(true);
    state.lastAction = "remove";
    renderAll();
  }

  function setCursor(which) {
    pushTrace(`${which}: t=${state.selTime}`);
    pushLog(`# ${which} @${state.selTime}`);
    if (which === "C1") state.c1 = state.selTime;
    else state.c2 = state.selTime;
    state.didCursor = true;
    state.preset = "custom";
    runScan(true);
    state.lastAction = which === "C1" ? "c1" : "c2";
    renderAll();
  }

  function applyRadix() {
    if (!state.sel) {
      state.lastAction = "radix-bad";
      pushLog("# radix FAIL");
      renderAll();
      return;
    }
    const r = selRadix.value;
    state.radix[state.sel] = r;
    if (r !== "bin" && sigOf(state.sel).width > 1) {
      state.didRadix = true;
    }
    state.preset = "custom";
    pushTrace(`radix: ${state.sel}=${r}`);
    pushLog(`# radix ${state.sel}=${r}`);
    runScan(true);
    state.lastAction = "radix";
    renderAll();
  }

  function selectTime(t) {
    state.selTime = t;
    state.lastAction = "time";
    renderAll();
  }

  function selectSig(id) {
    state.sel = id;
    if (state.radix[id]) selRadix.value = state.radix[id];
    state.lastAction = "select";
    renderAll();
  }

  function demo() {
    applyPreset("signals_no_cursors", "demo");
    state.demoed = true;
    pushLog("# demo signals without cursors PARTIAL");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain add / C1 C2 / radix");
    pushTrace("explain: add signals · C1/C2 delta · radix → WATCHING");
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const sig = sigOf(state.sel);
    const ev = evaluate(state);

    document.getElementById("pool-list").innerHTML = SIGNALS.map((s) => {
      const onWave = state.wave.includes(s.id);
      return `<li class="${state.sel === s.id ? "is-sel" : ""} ${onWave ? "is-on-wave" : ""}" data-pool="${s.id}">
        <span class="id">${s.label}</span>
        <span class="tag">${s.width}b</span>
        <span class="tag ${onWave ? "is-ok" : ""}">${onWave ? "on wave" : "pool"}</span>
      </li>`;
    }).join("");
    document.querySelectorAll("[data-pool]").forEach((el) => {
      el.addEventListener("click", () =>
        selectSig(/** @type {string} */ (el.getAttribute("data-pool")))
      );
    });

    document.getElementById("wave-list").innerHTML =
      state.wave.length > 0
        ? state.wave
            .map((id) => {
              const s = sigOf(id);
              return `<li class="${state.sel === id ? "is-sel" : ""}" data-wave="${id}">
          <span class="id">${s.label}</span>
          <span class="tag">${state.radix[id]}</span>
          <span class="tag is-ok">wave</span>
        </li>`;
            })
            .join("")
        : `<li><span class="id">(empty)</span></li>`;
    document.querySelectorAll("[data-wave]").forEach((el) => {
      el.addEventListener("click", () =>
        selectSig(/** @type {string} */ (el.getAttribute("data-wave")))
      );
    });

    document.getElementById("timeline").innerHTML = Array.from(
      { length: MAX_T + 1 },
      (_, t) => {
        const cls = [
          "tick",
          state.selTime === t ? "is-now" : "",
          state.c1 === t ? "is-c1" : "",
          state.c2 === t ? "is-c2" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button type="button" class="${cls}" data-t="${t}">${t}</button>`;
      }
    ).join("");
    document.querySelectorAll("[data-t]").forEach((el) => {
      el.addEventListener("click", () =>
        selectTime(Number(el.getAttribute("data-t")))
      );
    });

    const deltaEl = document.getElementById("delta-box");
    if (state.c1 !== null && state.c2 !== null) {
      const d = Math.abs(state.c2 - state.c1);
      deltaEl.textContent = `Δt = |C2 − C1| = |${state.c2} − ${state.c1}| = ${d}`;
    } else {
      deltaEl.textContent = "Δt — set both C1 and C2";
    }

    document.getElementById("wave-rows").innerHTML =
      state.wave.length > 0
        ? state.wave
            .map((id) => {
              const v1 =
                state.c1 !== null
                  ? formatVal(id, state.c1, state.radix)
                  : "—";
              const v2 =
                state.c2 !== null
                  ? formatVal(id, state.c2, state.radix)
                  : "—";
              const trace =
                id === "clk"
                  ? "‾|_|‾|_|‾"
                  : id === "rst_n"
                    ? "___/‾‾‾‾"
                    : "~~~~↗↘↗↘";
              return `<div class="wave-row">
          <span class="name">${id}</span>
          <span class="trace">${trace}</span>
          <span class="val">C1=${v1} C2=${v2}</span>
        </div>`;
            })
            .join("")
        : "<div class='wave-row'><span class='name'>—</span><span class='trace'>add signals</span></div>";

    document.getElementById("meta-note").textContent = state.note;
    let blurb =
      "Select a pool signal → Add to wave · pick time → Set C1/C2 · Apply radix.";
    if (state.lastAction === "radix" && sig && RADIX_BLURB[state.radix[sig.id]]) {
      blurb = RADIX_BLURB[state.radix[sig.id]];
    } else if (sig) blurb = sig.blurb;
    document.getElementById("role-blurb").textContent = blurb;

    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("code-box").textContent = literacyText();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastScanned) {
      v.className = "verdict idle";
      v.textContent = "Idle — Add / C1 / C2 / Radix / Scan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `WATCHING — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">watch=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${state.wave.length >= 2 ? "is-ok" : "is-bad"}">wave=${state.wave.length}</span>
      <span class="flag ${ev.cursorsOk ? "is-ok" : "is-bad"}">C1/C2=${ev.cursorsOk ? 1 : 0}</span>
      <span class="flag ${ev.busRadixOk ? "is-ok" : "is-bad"}">radix=${ev.busRadixOk ? 1 : 0}</span>
      <span class="flag ${ev.triad ? "is-ok" : "is-bad"}">triad=${ev.triad ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          wave: state.wave,
          c1: state.c1,
          c2: state.c2,
          selTime: state.selTime,
          radix: state.radix,
          sel: state.sel,
          didAdd: state.didAdd,
          didCursor: state.didCursor,
          didRadix: state.didRadix,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-add",
      title: "Quiz: add",
      type: "quiz",
      prompt: "Adding a signal to the Wave pane…",
      hint: "From pool.",
      choices: [
        "puts that net on the timeline so you can inspect value vs time",
        "deletes the testbench",
        "only changes synthesis constraints",
        "forces the clock permanently",
      ],
      answer:
        "puts that net on the timeline so you can inspect value vs time",
    },
    {
      id: "quiz-c1",
      title: "Quiz: C1",
      type: "quiz",
      prompt: "Cursor C1 marks…",
      hint: "First time mark.",
      choices: [
        "a reference simulation time for reading signal values",
        "the Git branch name",
        "only the LSB of a bus",
        "the end of compilation",
      ],
      answer: "a reference simulation time for reading signal values",
    },
    {
      id: "quiz-c2",
      title: "Quiz: C2 / delta",
      type: "quiz",
      prompt: "C2 with C1 lets you…",
      hint: "Interval.",
      choices: [
        "compare values at two times and measure Δt = |C2 − C1|",
        "skip elaboration",
        "disable all breakpoints",
        "change the DUT module name",
      ],
      answer: "compare values at two times and measure Δt = |C2 − C1|",
    },
    {
      id: "quiz-radix",
      title: "Quiz: radix",
      type: "quiz",
      prompt: "Hex radix on a bus wave…",
      hint: "Compact.",
      choices: [
        "shows compact labels like 0xA instead of 1010 for wide values",
        "hides the signal entirely",
        "only works on clocks",
        "replaces VCD with JSON",
      ],
      answer:
        "shows compact labels like 0xA instead of 1010 for wide values",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — WATCHING.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "WATCHING",
    },
    {
      id: "load-empty",
      title: "Load empty",
      prompt: "Load empty wave — EMPTY.",
      hint: "empty wave → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.status === "EMPTY" && state.wave.length === 0,
    },
    {
      id: "load-clk-only",
      title: "Load clk only",
      prompt: "Load clk only — PARTIAL.",
      hint: "clk only → Load",
      setup: () => {
        selPreset.value = "clk_only";
        loadPreset();
      },
      check: () =>
        state.wave.length === 1 &&
        state.wave[0] === "clk" &&
        !state.ready,
    },
    {
      id: "load-no-cursors",
      title: "Load no cursors",
      prompt: "Load signals no cursors — PARTIAL.",
      hint: "signals no cursors → Load",
      setup: () => {
        selPreset.value = "signals_no_cursors";
        loadPreset();
      },
      check: () =>
        state.wave.length === 3 &&
        state.c1 === null &&
        !state.ready,
    },
    {
      id: "add-q",
      title: "Add q",
      prompt: "From empty, Add q to wave.",
      hint: "Select q → Add",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.sel = "q";
        addToWave();
      },
      check: () =>
        state.wave.includes("q") &&
        state.didAdd &&
        state.lastAction === "add",
    },
    {
      id: "set-c1",
      title: "Set C1",
      prompt: "From clk only @t=5, Set C1.",
      hint: "Click 5 → Set C1",
      setup: () => {
        selPreset.value = "clk_only";
        loadPreset();
        state.selTime = 5;
        setCursor("C1");
      },
      check: () => state.c1 === 5 && state.lastAction === "c1",
    },
    {
      id: "set-c2",
      title: "Set C2",
      prompt: "From C1 only @t=10, Set C2.",
      hint: "Click 10 → Set C2",
      setup: () => {
        selPreset.value = "c1_only";
        loadPreset();
        state.selTime = 10;
        setCursor("C2");
      },
      check: () => state.c2 === 10 && state.lastAction === "c2",
    },
    {
      id: "triad",
      title: "Triad",
      prompt: "Starter has add + cursor + radix triad.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => {
        const ev = evaluate(state);
        return ev.triad && state.didAdd && state.didCursor && state.didRadix;
      },
    },
    {
      id: "radix-hex",
      title: "Radix hex",
      prompt: "From empty+clk+q, set q hex radix.",
      hint: "Select q → hex → Apply",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.sel = "clk";
        addToWave();
        state.sel = "q";
        addToWave();
        selRadix.value = "hex";
        applyRadix();
      },
      check: () =>
        state.radix.q === "hex" &&
        state.lastAction === "radix",
    },
    {
      id: "select",
      title: "Select data",
      prompt: "Select data in the pool.",
      hint: "Click data row",
      setup: () => {
        loadStarter();
        selectSig("data");
      },
      check: () => state.sel === "data" && state.lastAction === "select",
    },
    {
      id: "remove",
      title: "Remove data",
      prompt: "From starter, Remove data if on wave (add first).",
      hint: "Add data → Remove",
      setup: () => {
        loadStarter();
        state.sel = "data";
        addToWave();
        removeFromWave();
      },
      check: () =>
        !state.wave.includes("data") &&
        state.lastAction === "remove",
    },
    {
      id: "scan-ok",
      title: "Scan WATCHING",
      prompt: "On starter, Scan — WATCHING.",
      hint: "Scan",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () => state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan PARTIAL",
      prompt: "On empty, Scan — not WATCHING.",
      hint: "empty → Scan",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        runScan(false);
      },
      check: () => !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo partial",
      prompt: "Click Demo partial.",
      hint: "Demo partial",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "PARTIAL" &&
        state.lastAction === "demo",
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
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions C1 or radix.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /C1|radix/.test(literacyText()),
    },
    {
      id: "delta",
      title: "Delta",
      prompt: "Starter delta box shows Δt = 5.",
      hint: "Starter C1@5 C2@10",
      setup: () => loadStarter(),
      check: () =>
        state.c1 === 5 &&
        state.c2 === 10 &&
        /Δt.*= 5/.test(document.getElementById("delta-box").textContent),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From empty, Reset — WATCHING again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "WATCHING",
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) =>
      CHALLENGES.some((c) => c.id === id)
    ).length;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="hsw-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("hsw-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-add").addEventListener("click", () => addToWave());
  document.getElementById("btn-remove").addEventListener("click", () => removeFromWave());
  document.getElementById("btn-c1").addEventListener("click", () => setCursor("C1"));
  document.getElementById("btn-c2").addEventListener("click", () => setCursor("C2"));
  document.getElementById("btn-radix").addEventListener("click", () => applyRadix());
  document.getElementById("btn-scan").addEventListener("click", () => runScan(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
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
      if (saved) {
        state.wave = saved.wave || state.wave;
        state.c1 = saved.c1 ?? state.c1;
        state.c2 = saved.c2 ?? state.c2;
        state.selTime = saved.selTime ?? state.selTime;
        state.radix = saved.radix || state.radix;
        state.sel = saved.sel || state.sel;
        state.didAdd = saved.didAdd ?? state.didAdd;
        state.didCursor = saved.didCursor ?? state.didCursor;
        state.didRadix = saved.didRadix ?? state.didRadix;
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
        syncInputs();
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
