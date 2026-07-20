(() => {
  /**
   * Named vs positional instance connections.
   * Module port order is fixed. Positional maps by index.
   * Named maps by .port(sig) — order-independent.
   */

  const MODULES = {
    dff: {
      id: "dff",
      name: "dff",
      ports: ["clk", "d", "q"],
      dirs: ["input", "input", "output"],
      intent: { clk: "clk", d: "din", q: "qout" },
      nets: ["clk", "din", "qout", "bogus"],
    },
    and2: {
      id: "and2",
      name: "and2",
      ports: ["a", "b", "y"],
      dirs: ["input", "input", "output"],
      intent: { a: "in0", b: "in1", y: "out" },
      nets: ["in0", "in1", "out", "spare"],
    },
  };

  function makeStarter() {
    // Positional miswire: dff u(clk, qout, din) — d/q swapped
    return {
      mod: "dff",
      style: "positional", // positional | named
      // positional: array of net names in port-order positions
      pos: ["clk", "qout", "din"],
      // named: map port -> net
      named: { clk: "clk", d: "din", q: "qout" },
      lastAction: "",
      explained: false,
      setNamed: false,
      setAnd: false,
      fixed: false,
      log: [],
      trace: [],
    };
  }

  function binding(state) {
    const m = MODULES[state.mod];
    /** @type {Record<string,string>} */
    const map = {};
    if (state.style === "positional") {
      m.ports.forEach((p, i) => {
        map[p] = state.pos[i] || "";
      });
    } else {
      m.ports.forEach((p) => {
        map[p] = state.named[p] || "";
      });
    }
    return map;
  }

  function analyze(state) {
    const m = MODULES[state.mod];
    const map = binding(state);
    const mismatches = [];
    m.ports.forEach((p) => {
      if (map[p] !== m.intent[p]) {
        mismatches.push({
          port: p,
          got: map[p],
          want: m.intent[p],
        });
      }
    });
    return {
      map,
      mismatches,
      ok: mismatches.length === 0,
    };
  }

  function instanceCode(state) {
    const m = MODULES[state.mod];
    if (state.style === "positional") {
      return `${m.name} u(${state.pos.join(", ")});`;
    }
    const parts = m.ports.map((p) => `.${p}(${state.named[p] || "?"})`);
    return `${m.name} u(\n  ${parts.join(",\n  ")}\n);`;
  }

  const CLEARED_KEY = "ddv-named-vs-positional-cleared-v1";
  const STORE_KEY = "ddv-named-vs-positional-session-v1";

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

  const root = document.getElementById("np-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>dff</code> ports <code>(clk, d, q)</code> but
        positional instance is <code>dff u(clk, qout, din)</code> — <strong>d/q swapped</strong>.
        Fix with named <code>.d(din), .q(qout)</code>.</p>
      <button type="button" class="btn btn-secondary" id="np-starter">Load starter example</button>
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
            <h3>Positional</h3>
            <p>Nth actual maps to Nth formal — order is load-bearing.</p>
          </div>
          <div class="idea-card">
            <h3>Named</h3>
            <p><code>.port(sig)</code> — order free; intent readable.</p>
          </div>
          <div class="idea-card">
            <h3>Hazard</h3>
            <p>Swapped positionals still compile; wrong wires.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Instance wiring</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Module
              <select id="mod-sel">
                <option value="dff">dff (clk, d, q)</option>
                <option value="and2">and2 (a, b, y)</option>
              </select>
            </label>
            <label>Style
              <select id="style-sel">
                <option value="positional">positional</option>
                <option value="named">named</option>
              </select>
            </label>
          </div>
          <div class="port-order" id="port-order"></div>
          <pre class="code-box" id="code-box"></pre>
          <p class="legend">Map each formal port to a net (intent shown in the table):</p>
          <table class="map-table">
            <thead><tr><th>Port</th><th>Dir</th><th>Connected net</th><th>Intent</th></tr></thead>
            <tbody id="map-body"></tbody>
          </table>
          <div class="verdict" id="verdict">—</div>
          <div class="action-grid">
            <button type="button" id="btn-miswire">Preset positional miswire</button>
            <button type="button" id="btn-fix-pos">Fix positional (correct order)</button>
            <button type="button" id="btn-named">Switch to named (correct)</button>
            <button type="button" id="btn-and-swap">and2 positional a/b swap</button>
            <button type="button" id="btn-explain">Explain mapping</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Connection sketch</h2></div>
        <div class="panel-body">
          <svg class="schem-svg" id="schem" viewBox="0 0 420 160" role="img" aria-label="Connection diagram"></svg>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Style</th><th>Rule</th></tr></thead>
          <tbody>
            <tr><td>Positional</td><td><code>mod u(s0, s1, s2);</code> ↔ port order</td></tr>
            <tr><td>Named</td><td><code>mod u(.p0(s0), .p1(s1));</code></td></tr>
            <tr><td>Mix</td><td>Allowed in SV with rules — prefer all-named</td></tr>
            <tr><td>Hazard</td><td>Wrong order still elaborates</td></tr>
            <tr><td>Review</td><td>Named diffs survive port reordering</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Starter bug: position 1 should be <code>din</code> (port d), not <code>qout</code>.</li>
          <li>Prefer named for anything beyond trivial 1–2 port cells.</li>
        </ul>
      </div>
    </div>
  `;

  const modSel = document.getElementById("mod-sel");
  const styleSel = document.getElementById("style-sel");
  const portOrder = document.getElementById("port-order");
  const codeBox = document.getElementById("code-box");
  const mapBody = document.getElementById("map-body");
  const verdictEl = document.getElementById("verdict");
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

  function ensureMaps() {
    const m = MODULES[state.mod];
    if (state.pos.length !== m.ports.length) {
      state.pos = m.ports.map((p) => m.intent[p]);
    }
    m.ports.forEach((p) => {
      if (state.named[p] === undefined) state.named[p] = m.intent[p];
    });
  }

  function renderMap() {
    ensureMaps();
    const m = MODULES[state.mod];
    const a = analyze(state);
    mapBody.innerHTML = "";
    m.ports.forEach((p, i) => {
      const tr = document.createElement("tr");
      const got = a.map[p];
      const want = m.intent[p];
      tr.className = got === want ? "ok" : "bad";
      const tdNet = document.createElement("td");
      const sel = document.createElement("select");
      m.nets.forEach((n) => {
        const opt = document.createElement("option");
        opt.value = n;
        opt.textContent = n;
        if (n === got) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => {
        if (state.style === "positional") {
          state.pos[i] = sel.value;
        } else {
          state.named[p] = sel.value;
        }
        state.lastAction = "map";
        pushLog("run", `# ${p} → ${sel.value}`);
        renderAll();
      });
      tdNet.appendChild(sel);
      tr.innerHTML = `<td>.${p}</td><td>${m.dirs[i]}</td>`;
      tr.appendChild(tdNet);
      const tdWant = document.createElement("td");
      tdWant.textContent = want;
      tr.appendChild(tdWant);
      mapBody.appendChild(tr);
    });
  }

  function renderVerdict() {
    const a = analyze(state);
    if (a.ok) {
      state.fixed = true;
      verdictEl.className = "verdict ok";
      verdictEl.textContent = "OK — matches intended connections";
    } else {
      verdictEl.className = "verdict bad";
      verdictEl.textContent =
        "MISWIRED — " +
        a.mismatches
          .map((x) => `${x.port}: got ${x.got}, want ${x.want}`)
          .join("; ");
    }
  }

  function renderSchem() {
    const m = MODULES[state.mod];
    const a = analyze(state);
    let html = `<rect x="150" y="30" width="120" height="100" rx="8" fill="#243040" stroke="#5a6a7a"/>`;
    html += `<text x="210" y="55" text-anchor="middle" fill="#9ecbff" font-size="13" font-family="ui-monospace,monospace">${m.name}</text>`;
    m.ports.forEach((p, i) => {
      const y = 75 + i * 18;
      const net = a.map[p];
      const ok = net === m.intent[p];
      const color = ok ? "#8fd4a8" : "#f0a0a0";
      html += `<text x="140" y="${y}" text-anchor="end" fill="#7a8a9a" font-size="11" font-family="ui-monospace,monospace">${p}</text>`;
      html += `<line x1="145" y1="${y - 3}" x2="150" y2="${y - 3}" stroke="#5a6a7a"/>`;
      html += `<text x="280" y="${y}" fill="${color}" font-size="11" font-family="ui-monospace,monospace">${net}</text>`;
      html += `<line x1="270" y1="${y - 3}" x2="275" y2="${y - 3}" stroke="${color}"/>`;
    });
    schem.innerHTML = html;
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(change wiring or explain)</span>';
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
    ensureMaps();
    modSel.value = state.mod;
    styleSel.value = state.style;
    const m = MODULES[state.mod];
    portOrder.textContent = `Formal order: ${m.name}(${m.ports.join(", ")})`;
    codeBox.textContent = instanceCode(state);
    renderMap();
    renderVerdict();
    renderSchem();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter positional d/q swap");
    state.trace = [];
    renderAll();
  }

  function explain() {
    const a = analyze(state);
    state.explained = true;
    state.lastAction = "explain";
    state.trace = [
      {
        kind: "muted",
        text: `${state.style} connection on ${MODULES[state.mod].name}`,
      },
      {
        kind: "hi",
        text: instanceCode(state).replace(/\n/g, " "),
      },
    ];
    if (a.ok) {
      state.trace.push({ kind: "ok", text: "every formal matches intent" });
    } else {
      a.mismatches.forEach((x) => {
        state.trace.push({
          kind: "bad",
          text: `port ${x.port} ← ${x.got} (want ${x.want})`,
        });
      });
      state.trace.push({
        kind: "warn",
        text: "positional errors are silent at compile time",
      });
    }
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("np-starter").addEventListener("click", loadStarter);
  modSel.addEventListener("change", () => {
    state.mod = modSel.value;
    if (state.mod === "and2") state.setAnd = true;
    const m = MODULES[state.mod];
    state.pos = m.ports.map((p) => m.intent[p]);
    state.named = { ...m.intent };
    state.lastAction = "mod";
    pushLog("run", `# module → ${state.mod}`);
    renderAll();
  });
  styleSel.addEventListener("change", () => {
    state.style = styleSel.value;
    if (state.style === "named") state.setNamed = true;
    state.lastAction = "style";
    pushLog("run", `# style → ${state.style}`);
    renderAll();
  });
  document.getElementById("btn-miswire").addEventListener("click", () => {
    state.mod = "dff";
    state.style = "positional";
    state.pos = ["clk", "qout", "din"];
    state.lastAction = "preset-miswire";
    pushLog("warn", "# positional miswire");
    renderAll();
  });
  document.getElementById("btn-fix-pos").addEventListener("click", () => {
    const m = MODULES[state.mod];
    state.style = "positional";
    state.pos = m.ports.map((p) => m.intent[p]);
    state.lastAction = "fix-pos";
    pushLog("ok", "# fixed positional");
    renderAll();
  });
  document.getElementById("btn-named").addEventListener("click", () => {
    const m = MODULES[state.mod];
    state.style = "named";
    state.setNamed = true;
    state.named = { ...m.intent };
    state.lastAction = "named-ok";
    pushLog("ok", "# named correct");
    renderAll();
  });
  document.getElementById("btn-and-swap").addEventListener("click", () => {
    state.mod = "and2";
    state.setAnd = true;
    state.style = "positional";
    state.pos = ["in1", "in0", "out"]; // a/b swapped
    state.named = { ...MODULES.and2.intent };
    state.lastAction = "and-swap";
    pushLog("warn", "# and2 a/b swap");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-pos",
      title: "Quiz: positional",
      prompt: "Positional maps by? Answer: <code>order</code>",
      hint: "Nth to Nth",
      type: "text",
      answer: "order",
      alt: ["position", "index", "port order"],
    },
    {
      id: "quiz-named",
      title: "Quiz: named",
      prompt: "Named connection syntax uses a? Answer: <code>dot</code>",
      hint: ".port(sig)",
      type: "text",
      answer: "dot",
      alt: [".", "dot port", ".port", "named association"],
    },
    {
      id: "quiz-silent",
      title: "Quiz: hazard",
      prompt: "Wrong positional order usually still? Answer: <code>compiles</code>",
      hint: "silent miswire",
      type: "text",
      answer: "compiles",
      alt: ["compile", "elaborate", "build"],
    },
    {
      id: "quiz-prefer",
      title: "Quiz: prefer",
      prompt: "Safer default style? Answer: <code>named</code>",
      hint: "cheat sheet",
      type: "text",
      answer: "named",
      alt: ["named connections", "dot"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — positional dff with d/q swap (MISWIRED).",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mod === "dff" &&
        state.style === "positional" &&
        !analyze(state).ok &&
        state.pos[1] === "qout",
    },
    {
      id: "see-miswire",
      title: "See miswire",
      prompt: "Starter: port d should want din but got qout.",
      hint: "Check table row .d",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const a = analyze(state);
        return a.mismatches.some(
          (x) => x.port === "d" && x.got === "qout" && x.want === "din"
        );
      },
    },
    {
      id: "fix-pos",
      title: "Fix positional",
      prompt: "Fix positional to correct order — verdict OK.",
      hint: "Fix positional button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.style === "positional" &&
        analyze(state).ok &&
        state.lastAction === "fix-pos",
    },
    {
      id: "named-ok",
      title: "Named OK",
      prompt: "Switch to named (correct) — OK.",
      hint: "Switch to named button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setNamed &&
        state.style === "named" &&
        analyze(state).ok,
    },
    {
      id: "named-code",
      title: "Named syntax",
      prompt: "With named correct, code includes <code>.d(din)</code>.",
      hint: "Named correct preset",
      type: "state",
      setup: () => {
        document.getElementById("btn-named").click();
      },
      check: () =>
        state.style === "named" && instanceCode(state).includes(".d(din)"),
    },
    {
      id: "and-swap",
      title: "and2 swap",
      prompt: "and2 positional a/b swap — MISWIRED.",
      hint: "and2 positional a/b swap",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mod === "and2" &&
        state.style === "positional" &&
        !analyze(state).ok &&
        state.pos[0] === "in1",
    },
    {
      id: "and-fix",
      title: "and2 fix",
      prompt: "From and2 swap, fix positional — OK.",
      hint: "and-swap then Fix positional",
      type: "state",
      setup: () => {
        document.getElementById("btn-and-swap").click();
      },
      check: () =>
        state.mod === "and2" &&
        state.style === "positional" &&
        analyze(state).ok &&
        state.lastAction === "fix-pos",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain mapping on the starter miswire.",
      hint: "Explain mapping",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "style-named",
      title: "Style named",
      prompt: "Switch Style dropdown to named.",
      hint: "Style select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.style === "named" && state.lastAction === "style",
    },
    {
      id: "manual-fix",
      title: "Manual fix",
      prompt: "On starter, manually set port d’s net to din (map change).",
      hint: "Dropdown on .d row → din",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.style === "positional" &&
        state.pos[1] === "din" &&
        state.lastAction === "map",
    },
    {
      id: "quiz-formal",
      title: "Quiz: formal",
      prompt: "Module port name is the? Answer: <code>formal</code>",
      hint: "formal vs actual",
      type: "text",
      answer: "formal",
      alt: ["formal port", "formals"],
    },
    {
      id: "quiz-actual",
      title: "Quiz: actual",
      prompt: "Signal you pass in is the? Answer: <code>actual</code>",
      hint: "actual expression",
      type: "text",
      answer: "actual",
      alt: ["actuals", "actual net"],
    },
    {
      id: "mod-and",
      title: "Module and2",
      prompt: "Select module and2 (clean intent maps).",
      hint: "Module dropdown",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mod === "and2" && state.setAnd,
    },
    {
      id: "preset-miswire-btn",
      title: "Miswire preset",
      prompt: "Use Preset positional miswire.",
      hint: "Preset positional miswire",
      type: "state",
      setup: () => {
        state = makeStarter();
        state.style = "named";
        state.named = { ...MODULES.dff.intent };
        renderAll();
      },
      check: () =>
        state.lastAction === "preset-miswire" && !analyze(state).ok,
    },
    {
      id: "clk-ok",
      title: "clk OK",
      prompt: "On starter, clk mapping is already correct.",
      hint: "clk → clk",
      type: "state",
      setup: () => loadStarter(),
      check: () => analyze(state).map.clk === "clk",
    },
    {
      id: "quiz-reorder",
      title: "Quiz: reorder",
      prompt: "Named connections survive port list? Answer: <code>reordering</code>",
      hint: "cheat sheet review",
      type: "text",
      answer: "reordering",
      alt: ["reorder", "re-order", "order change"],
    },
    {
      id: "both-ok",
      title: "Both OK",
      prompt: "Named correct on dff — all three ports match intent.",
      hint: "Switch to named",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const a = analyze(state);
        return (
          state.style === "named" &&
          a.ok &&
          a.map.d === "din" &&
          a.map.q === "qout"
        );
      },
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter miswire → named correct → explain.",
      hint: "Load → Switch to named → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.style === "named" &&
        analyze(state).ok &&
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
