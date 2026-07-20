(() => {
  /**
   * Tri-state bus resolution (teaching model):
   *   enable=0 → driver contributes Z (disconnected)
   *   enable=1 → drives data 0/1 onto the net
   *   0 drivers  → Z  (or pull-up → 1 / pull-down → 0 if enabled)
   *   1 driver   → that value
   *   2+ same    → that value (still risky in real silicon)
   *   2+ differ  → X contention
   */

  function resolve(drivers, pull) {
    const active = drivers.filter((d) => d.en);
    if (active.length === 0) {
      if (pull === "up") return { bus: "1", kind: "pull", detail: "float → pull-up" };
      if (pull === "down") return { bus: "0", kind: "pull", detail: "float → pull-down" };
      return { bus: "Z", kind: "z", detail: "no driver (high-Z)" };
    }
    const vals = active.map((d) => d.data | 0);
    const allSame = vals.every((v) => v === vals[0]);
    if (!allSame) {
      return {
        bus: "X",
        kind: "x",
        detail: `contention: ${active.map((d) => d.name + "=" + d.data).join(" vs ")}`,
        fighters: active.map((d) => d.name),
      };
    }
    if (active.length > 1) {
      return {
        bus: String(vals[0]),
        kind: vals[0] ? "one" : "zero",
        detail: `multi-drive same value (${active.map((d) => d.name).join(",")}) — still unsafe`,
        multiSame: true,
      };
    }
    return {
      bus: String(vals[0]),
      kind: vals[0] ? "one" : "zero",
      detail: `driven by ${active[0].name}`,
    };
  }

  function makeStarter() {
    return {
      drivers: [
        { name: "A", en: 1, data: 1 },
        { name: "B", en: 0, data: 0 },
        { name: "C", en: 0, data: 1 },
      ],
      pull: "none", // none | up | down
      lastAction: "",
      toggledEn: false,
      toggledData: false,
      sawZ: false,
      sawX: false,
      sawPull: false,
      explained: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-tri-state-bus-cleared-v1";
  const STORE_KEY = "ddv-tri-state-bus-session-v1";

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

  const root = document.getElementById("ts-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> driver <code>A</code> enabled with data <code>1</code>;
        B and C off → bus = <code>1</code>. Enable B with <code>0</code> → contention <code>X</code>.</p>
      <button type="button" class="btn btn-secondary" id="ts-starter">Load starter example</button>
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
            <h3>High-Z</h3>
            <p>Enable off — driver disconnected; bus floats.</p>
          </div>
          <div class="idea-card">
            <h3>One driver</h3>
            <p>Exactly one enable high → clean 0/1.</p>
          </div>
          <div class="idea-card">
            <h3>Contention</h3>
            <p>Two enables with different data → <code>X</code> (fight).</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Drivers</h2></div>
        <div class="panel-body">
          <p class="legend">Toggle EN and DATA per driver. Only enabled drivers attach to the bus.</p>
          <div class="pull-row">
            <span>Idle pull:</span>
            <label><input type="radio" name="pull" value="none" checked> none</label>
            <label><input type="radio" name="pull" value="up"> pull-up</label>
            <label><input type="radio" name="pull" value="down"> pull-down</label>
          </div>
          <div class="drivers" id="drivers"></div>
          <div class="action-grid">
            <button type="button" id="btn-float">All off → Z</button>
            <button type="button" id="btn-fight">Force contention A=1 vs B=0</button>
            <button type="button" id="btn-agree">Multi-drive same (A=B=1)</button>
            <button type="button" id="btn-safe">Safe: only A drives 0</button>
            <button type="button" id="btn-explain">Explain resolution</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Bus</h2></div>
        <div class="panel-body">
          <div class="bus-panel" id="bus-panel">
            <div class="label">Shared net</div>
            <div class="bus-val" id="bus-val">—</div>
            <div class="verdict" id="bus-verdict"></div>
          </div>
          <svg class="schem-svg" id="schem" viewBox="0 0 420 150" role="img" aria-label="Bus schematic"></svg>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Case</th><th>Bus</th></tr></thead>
          <tbody>
            <tr><td>All EN=0</td><td>Z (or pull value)</td></tr>
            <tr><td>One EN=1</td><td>that driver’s data</td></tr>
            <tr><td>EN clash, data differ</td><td>X contention</td></tr>
            <tr><td>EN clash, data same</td><td>value — still bad practice</td></tr>
            <tr><td>Mux / one-hot OE</td><td>Preferred over bare tri-state in FPGA</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>FPGA fabrics often discourage internal tri-state — use muxes.</li>
          <li>External buses still use OE#; never overlap enables.</li>
        </ul>
      </div>
    </div>
  `;

  const driversEl = document.getElementById("drivers");
  const busPanel = document.getElementById("bus-panel");
  const busVal = document.getElementById("bus-val");
  const busVerdict = document.getElementById("bus-verdict");
  const schem = document.getElementById("schem");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

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
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
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
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function current() {
    return resolve(state.drivers, state.pull);
  }

  function markFlags(r) {
    if (r.kind === "z") state.sawZ = true;
    if (r.kind === "x") state.sawX = true;
    if (r.kind === "pull") state.sawPull = true;
  }

  function renderDrivers() {
    const r = current();
    driversEl.innerHTML = "";
    state.drivers.forEach((d, i) => {
      const div = document.createElement("div");
      div.className = "driver";
      if (d.en) div.classList.add("driving");
      if (r.fighters && r.fighters.includes(d.name)) div.classList.add("fighting");
      div.innerHTML = `<h3>Driver ${d.name}</h3>`;
      const row = document.createElement("div");
      row.className = "drv-row";

      const en = document.createElement("button");
      en.type = "button";
      en.className = d.en ? "on" : "off";
      en.textContent = `EN=${d.en}`;
      en.addEventListener("click", () => {
        d.en = d.en ? 0 : 1;
        state.toggledEn = true;
        state.lastAction = "en";
        pushLog("run", `# ${d.name}.EN → ${d.en}`);
        renderAll();
      });

      const data = document.createElement("button");
      data.type = "button";
      data.className = d.data ? "on" : "";
      data.textContent = `DATA=${d.data}`;
      data.addEventListener("click", () => {
        d.data = d.data ? 0 : 1;
        state.toggledData = true;
        state.lastAction = "data";
        pushLog("run", `# ${d.name}.DATA → ${d.data}`);
        renderAll();
      });

      const out = document.createElement("span");
      out.style.fontFamily = "var(--mono)";
      out.style.fontSize = "0.82rem";
      out.style.color = "var(--muted)";
      out.textContent = d.en ? `→ drives ${d.data}` : "→ Z";

      row.appendChild(en);
      row.appendChild(data);
      row.appendChild(out);
      div.appendChild(row);
      driversEl.appendChild(div);
      void i;
    });
  }

  function renderBus() {
    const r = current();
    markFlags(r);
    busVal.textContent = r.bus;
    busVerdict.textContent = r.detail;
    busPanel.className = "bus-panel " + r.kind;
  }

  function renderSchem() {
    const r = current();
    const yBus = 75;
    let html = `<line x1="40" y1="${yBus}" x2="380" y2="${yBus}" stroke="#5a6a7a" stroke-width="3"/>`;
    html += `<text x="200" y="30" text-anchor="middle" fill="#7a8a9a" font-size="11" font-family="ui-monospace,monospace">BUS = ${r.bus}</text>`;
    state.drivers.forEach((d, i) => {
      const x = 80 + i * 120;
      const color = d.en
        ? r.fighters && r.fighters.includes(d.name)
          ? "#f0a0a0"
          : "#8fd4a8"
        : "#5a6a7a";
      html += `<rect x="${x - 35}" y="100" width="70" height="36" rx="6" fill="#243040" stroke="${color}"/>`;
      html += `<text x="${x}" y="122" text-anchor="middle" fill="#e8eef4" font-size="11" font-family="ui-monospace,monospace">${d.name} ${d.en ? d.data : "Z"}</text>`;
      if (d.en) {
        html += `<line x1="${x}" y1="100" x2="${x}" y2="${yBus}" stroke="${color}" stroke-width="2"/>`;
      } else {
        html += `<line x1="${x}" y1="100" x2="${x}" y2="${yBus + 12}" stroke="#5a6a7a" stroke-dasharray="3 3"/>`;
      }
    });
    schem.innerHTML = html;
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(change drivers or explain)</span>';
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

  function syncPullUi() {
    document.querySelectorAll('input[name="pull"]').forEach((el) => {
      el.checked = el.value === state.pull;
    });
  }

  function renderAll() {
    syncPullUi();
    renderDrivers();
    renderBus();
    renderSchem();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter A drives 1");
    state.trace = [];
    renderAll();
  }

  function explain() {
    const r = current();
    state.explained = true;
    state.lastAction = "explain";
    const active = state.drivers.filter((d) => d.en);
    state.trace = [
      { kind: "muted", text: "resolution rules" },
      {
        kind: "hi",
        text: `active: ${active.length ? active.map((d) => d.name + "=" + d.data).join(", ") : "none"}`,
      },
      {
        kind: r.kind === "x" ? "bad" : "ok",
        text: `bus = ${r.bus} — ${r.detail}`,
      },
      {
        kind: "muted",
        text: "protocol: one-hot OE / never overlap enables",
      },
    ];
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("ts-starter").addEventListener("click", loadStarter);
  document.querySelectorAll('input[name="pull"]').forEach((el) => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      state.pull = el.value;
      state.lastAction = "pull";
      pushLog("run", `# pull → ${state.pull}`);
      renderAll();
    });
  });
  document.getElementById("btn-float").addEventListener("click", () => {
    state.drivers.forEach((d) => {
      d.en = 0;
    });
    state.lastAction = "float";
    pushLog("ok", "# all off");
    renderAll();
  });
  document.getElementById("btn-fight").addEventListener("click", () => {
    state.drivers[0].en = 1;
    state.drivers[0].data = 1;
    state.drivers[1].en = 1;
    state.drivers[1].data = 0;
    state.drivers[2].en = 0;
    state.lastAction = "fight";
    pushLog("warn", "# contention A=1 vs B=0");
    renderAll();
  });
  document.getElementById("btn-agree").addEventListener("click", () => {
    state.drivers[0].en = 1;
    state.drivers[0].data = 1;
    state.drivers[1].en = 1;
    state.drivers[1].data = 1;
    state.drivers[2].en = 0;
    state.lastAction = "agree";
    pushLog("warn", "# multi-drive same");
    renderAll();
  });
  document.getElementById("btn-safe").addEventListener("click", () => {
    state.drivers[0].en = 1;
    state.drivers[0].data = 0;
    state.drivers[1].en = 0;
    state.drivers[2].en = 0;
    state.lastAction = "safe";
    pushLog("ok", "# only A drives 0");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-z",
      title: "Quiz: Z",
      prompt: "Disconnected / floating level is written? Answer: <code>Z</code>",
      hint: "high impedance",
      type: "text",
      answer: "z",
      alt: ["Z", "high-z", "high z", "hi-z"],
    },
    {
      id: "quiz-x",
      title: "Quiz: X",
      prompt: "Two drivers fighting usually resolve to? Answer: <code>X</code>",
      hint: "contention / unknown",
      type: "text",
      answer: "x",
      alt: ["X", "contention", "unknown"],
    },
    {
      id: "quiz-oe",
      title: "Quiz: OE",
      prompt: "Signal that attaches a driver is often called? Answer: <code>enable</code>",
      hint: "EN / OE",
      type: "text",
      answer: "enable",
      alt: ["en", "oe", "output enable", "oe#"],
    },
    {
      id: "quiz-onehot",
      title: "Quiz: safe",
      prompt: "Safe bus protocol enables how many drivers? Answer: <code>1</code>",
      hint: "one-hot OE",
      type: "text",
      answer: "1",
      alt: ["one", "exactly one"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — only A drives 1 → bus 1.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = current();
        return (
          state.drivers[0].en === 1 &&
          state.drivers[0].data === 1 &&
          state.drivers[1].en === 0 &&
          r.bus === "1"
        );
      },
    },
    {
      id: "see-z",
      title: "See Z",
      prompt: "All drivers off (pull none) → bus Z.",
      hint: "All off → Z",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        state.pull = "none";
        const r = current();
        return (
          state.drivers.every((d) => !d.en) &&
          r.bus === "Z" &&
          (state.lastAction === "float" || state.sawZ)
        );
      },
    },
    {
      id: "fight",
      title: "Contention",
      prompt: "Force contention A=1 vs B=0 → bus X.",
      hint: "Force contention button",
      type: "state",
      setup: () => loadStarter(),
      check: () => current().bus === "X" && state.lastAction === "fight",
    },
    {
      id: "agree",
      title: "Agree multi",
      prompt: "Multi-drive same A=B=1 — bus 1 but flagged unsafe.",
      hint: "Multi-drive same button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = current();
        return (
          state.lastAction === "agree" &&
          r.bus === "1" &&
          r.multiSame === true
        );
      },
    },
    {
      id: "safe",
      title: "Safe drive",
      prompt: "Safe: only A drives 0.",
      hint: "Safe: only A drives 0",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = current();
        return (
          state.lastAction === "safe" &&
          r.bus === "0" &&
          state.drivers.filter((d) => d.en).length === 1
        );
      },
    },
    {
      id: "toggle-en",
      title: "Toggle EN",
      prompt: "Toggle any driver’s EN once.",
      hint: "Click EN=…",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledEn && state.lastAction === "en",
    },
    {
      id: "toggle-data",
      title: "Toggle DATA",
      prompt: "Toggle any driver’s DATA once.",
      hint: "Click DATA=…",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggledData && state.lastAction === "data",
    },
    {
      id: "pull-up-z",
      title: "Pull-up",
      prompt: "All off + pull-up → bus 1.",
      hint: "All off, select pull-up",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = current();
        return (
          state.pull === "up" &&
          state.drivers.every((d) => !d.en) &&
          r.bus === "1" &&
          r.kind === "pull"
        );
      },
    },
    {
      id: "pull-down-z",
      title: "Pull-down",
      prompt: "All off + pull-down → bus 0.",
      hint: "All off, select pull-down",
      type: "state",
      setup: () => {
        state.drivers.forEach((d) => {
          d.en = 0;
        });
        state.pull = "none";
        renderAll();
      },
      check: () => {
        const r = current();
        return (
          state.pull === "down" &&
          state.drivers.every((d) => !d.en) &&
          r.bus === "0"
        );
      },
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain resolution.",
      hint: "Explain resolution",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "quiz-pull",
      title: "Quiz: pull",
      prompt: "Weak resistor that defines a float is a? Answer: <code>pull-up</code>",
      hint: "or pull-down",
      type: "text",
      answer: "pull-up",
      alt: ["pullup", "pull up", "pull-down", "pulldown", "pull"],
    },
    {
      id: "c-drive",
      title: "Driver C",
      prompt: "Only C drives 1 (A,B off) → bus 1.",
      hint: "EN only on C, DATA=1",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = current();
        return (
          state.drivers[0].en === 0 &&
          state.drivers[1].en === 0 &&
          state.drivers[2].en === 1 &&
          state.drivers[2].data === 1 &&
          r.bus === "1"
        );
      },
    },
    {
      id: "quiz-fpga",
      title: "Quiz: FPGA",
      prompt: "Internal FPGA often prefers muxes over? Answer: <code>tri-state</code>",
      hint: "fabric note in cheat sheet",
      type: "text",
      answer: "tri-state",
      alt: ["tristate", "tri state", "tri-state buses", "internal tri-state"],
    },
    {
      id: "three-fight",
      title: "Three-way",
      prompt: "Enable A=1, B=0, C=1 — still X.",
      hint: "Turn on all three with mixed data",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const d = state.drivers;
        return (
          d[0].en &&
          d[1].en &&
          d[2].en &&
          d[0].data === 1 &&
          d[1].data === 0 &&
          d[2].data === 1 &&
          current().bus === "X"
        );
      },
    },
    {
      id: "quiz-impedance",
      title: "Quiz: name",
      prompt: "Z stands for high? Answer: <code>impedance</code>",
      hint: "high-Z",
      type: "text",
      answer: "impedance",
      alt: ["high impedance"],
    },
    {
      id: "recover",
      title: "Recover",
      prompt: "From a fight, go back to safe single driver.",
      hint: "Fight then Safe",
      type: "state",
      setup: () => {
        document.getElementById("btn-fight").click();
      },
      check: () => {
        const r = current();
        return (
          state.lastAction === "safe" &&
          r.kind !== "x" &&
          state.drivers.filter((d) => d.en).length === 1
        );
      },
    },
    {
      id: "data-ignored",
      title: "DATA ignored",
      prompt: "With EN=0, DATA can be anything — bus still Z if all off.",
      hint: "All off; flip a DATA",
      type: "state",
      setup: () => {
        state.drivers.forEach((d) => {
          d.en = 0;
        });
        state.pull = "none";
        state.toggledData = false;
        renderAll();
      },
      check: () =>
        state.toggledData &&
        state.drivers.every((d) => !d.en) &&
        current().bus === "Z",
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → fight (X) → explain.",
      hint: "Load → Force contention → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        current().bus === "X" &&
        state.explained &&
        state.lastAction === "explain",
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

  function renderChallenge() {
    const c = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (clearedIds.length ? ` · ${clearedIds.length} cleared` : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${c.title}.</strong> ${c.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? "Hint: " + c.hint : "";
    const row = document.getElementById("chal-answer-row");
    row.innerHTML = "";
    if (c.type === "text") {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = "chal-input";
      inp.placeholder = "Your answer";
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
      row.appendChild(inp);
    }
    const st = document.getElementById("chal-status");
    st.textContent = isCleared(c.id) ? "Cleared" : "Idle";
    st.className =
      "challenge-status " + (isCleared(c.id) ? "pass" : "idle");

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kbd" + (i === challengeIdx ? " is-active" : "");
      b.textContent = (isCleared(ch.id) ? "✓ " : "") + ch.id;
      b.title = ch.title;
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
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
    const c = CHALLENGES[challengeIdx];
    if (typeof c.setup === "function") c.setup();
    renderChallenge();
    saveSession();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const c = CHALLENGES[challengeIdx];
    const st = document.getElementById("chal-status");
    let ok = false;
    if (c.type === "text") {
      const got = normalizeAns(answerDraft || "");
      const targets = [c.answer, ...(c.alt || [])].map(normalizeAns);
      ok = targets.includes(got);
    } else if (c.type === "state") {
      ok = !!c.check();
    }
    if (ok) {
      markCleared(c.id);
      st.textContent = "Pass";
      st.className = "challenge-status pass";
      pushLog("ok", `# challenge ${c.id} pass`);
    } else {
      st.textContent = "Fail";
      st.className = "challenge-status fail";
      pushLog("warn", `# challenge ${c.id} fail`);
    }
    renderChallenge();
    renderLog();
    saveSession();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
