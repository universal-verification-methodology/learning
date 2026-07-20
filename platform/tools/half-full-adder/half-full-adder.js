(() => {
  /**
   * Half adder:  S = A⊕B, C = A·B
   * Full adder:  S = A⊕B⊕Cin, Cout = majority(A,B,Cin)
   *            = HA(A,B) → HA(S1,Cin) → Cout = C1∨C2
   * Ripple: chain of FAs, Cin0=0
   */

  function ha(a, b) {
    const A = a | 0;
    const B = b | 0;
    return { s: A ^ B, c: A & B };
  }

  function fa(a, b, cin) {
    const A = a | 0;
    const B = b | 0;
    const Cin = cin | 0;
    const h1 = ha(A, B);
    const h2 = ha(h1.s, Cin);
    return {
      s: h2.s,
      cout: h1.c | h2.c,
      h1,
      h2,
    };
  }

  function ripple2(a1, a0, b1, b0) {
    const lo = fa(a0, b0, 0);
    const hi = fa(a1, b1, lo.cout);
    return {
      s0: lo.s,
      s1: hi.s,
      cout: hi.cout,
      lo,
      hi,
      sum: (hi.s << 1) | lo.s,
      a: (a1 << 1) | a0,
      b: (b1 << 1) | b0,
    };
  }

  function makeStarter() {
    return {
      mode: "ha", // ha | fa | compose | ripple
      a: 1,
      b: 1,
      cin: 0,
      a1: 0,
      a0: 1,
      b1: 1,
      b0: 1,
      lastAction: "",
      toggled: false,
      composed: false,
      rippled: false,
      explained: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-half-full-adder-cleared-v1";
  const STORE_KEY = "ddv-half-full-adder-session-v1";

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

  const root = document.getElementById("ha-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> half adder with <code>A=1, B=1</code> →
        <code>S=0, C=1</code> (binary 1+1). Then promote to a full adder / two-HA build.</p>
      <button type="button" class="btn btn-secondary" id="ha-starter">Load starter example</button>
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
            <h3>Half adder</h3>
            <p><code>S = A⊕B</code>, <code>C = A·B</code> — no Cin.</p>
          </div>
          <div class="idea-card">
            <h3>Full adder</h3>
            <p><code>S = A⊕B⊕Cin</code>, Cout = majority.</p>
          </div>
          <div class="idea-card">
            <h3>Build</h3>
            <p>FA = HA(A,B) + HA(S₁,Cin) + OR carries.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Builder</h2></div>
        <div class="panel-body">
          <div class="ctrl-row">
            <label>Mode
              <select id="mode-sel">
                <option value="ha">Half adder</option>
                <option value="fa">Full adder</option>
                <option value="compose">FA from 2×HA + OR</option>
                <option value="ripple">2-bit ripple</option>
              </select>
            </label>
          </div>
          <p class="legend" id="mode-legend"></p>
          <div class="bit-row" id="bit-row"></div>
          <div class="out-grid" id="out-grid"></div>
          <svg class="block-svg" id="block-svg" viewBox="0 0 420 180" role="img" aria-label="Block diagram"></svg>
          <div id="compose-steps"></div>
          <div id="ripple-view"></div>
          <div class="action-grid">
            <button type="button" id="btn-ha">Preset HA 1+1</button>
            <button type="button" id="btn-fa">Preset FA A=B=Cin=1</button>
            <button type="button" id="btn-compose">Show 2×HA compose</button>
            <button type="button" id="btn-ripple">Preset ripple 1+3</button>
            <button type="button" id="btn-explain">Explain equations</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Truth table</h2></div>
        <div class="panel-body">
          <table class="tt">
            <thead id="tt-head"></thead>
            <tbody id="tt-body"></tbody>
          </table>
          <pre class="trace-box" id="trace-box" style="margin-top:0.65rem"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Block</th><th>Equations</th></tr></thead>
          <tbody>
            <tr><td>HA</td><td>S = A⊕B &nbsp; C = AB</td></tr>
            <tr><td>FA</td><td>S = A⊕B⊕Cin &nbsp; Cout = AB ∨ (A⊕B)Cin</td></tr>
            <tr><td>Compose</td><td>HA₁(A,B) → S₁,C₁; HA₂(S₁,Cin) → S,C₂; Cout = C₁∨C₂</td></tr>
            <tr><td>Ripple</td><td>Cin₀=0; Coutᵢ → Cinᵢ₊₁</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>HA cannot take a carry-in — that is why FA exists.</li>
          <li>Ripple width cost ≈ N FA carry delays (see RCA animator).</li>
        </ul>
      </div>
    </div>
  `;

  const modeSel = document.getElementById("mode-sel");
  const bitRow = document.getElementById("bit-row");
  const outGrid = document.getElementById("out-grid");
  const blockSvg = document.getElementById("block-svg");
  const composeSteps = document.getElementById("compose-steps");
  const rippleView = document.getElementById("ripple-view");
  const ttHead = document.getElementById("tt-head");
  const ttBody = document.getElementById("tt-body");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");
  const modeLegend = document.getElementById("mode-legend");

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

  function bitBtn(label, key, onChange) {
    const b = document.createElement("button");
    b.type = "button";
    const v = state[key] | 0;
    b.className = v ? "on" : "";
    b.textContent = `${label}=${v}`;
    b.addEventListener("click", () => {
      state[key] = v ? 0 : 1;
      state.toggled = true;
      state.lastAction = "toggle";
      pushLog("run", `# ${label} → ${state[key]}`);
      if (onChange) onChange();
      renderAll();
    });
    return b;
  }

  function renderBits() {
    bitRow.innerHTML = "";
    if (state.mode === "ripple") {
      bitRow.appendChild(bitBtn("A1", "a1"));
      bitRow.appendChild(bitBtn("A0", "a0"));
      bitRow.appendChild(bitBtn("B1", "b1"));
      bitRow.appendChild(bitBtn("B0", "b0"));
      modeLegend.textContent = "2-bit unsigned: S = A + B (Cin₀ = 0).";
    } else if (state.mode === "ha") {
      bitRow.appendChild(bitBtn("A", "a"));
      bitRow.appendChild(bitBtn("B", "b"));
      modeLegend.textContent = "Half adder — two inputs, Sum and Carry.";
    } else {
      bitRow.appendChild(bitBtn("A", "a"));
      bitRow.appendChild(bitBtn("B", "b"));
      bitRow.appendChild(bitBtn("Cin", "cin"));
      modeLegend.textContent =
        state.mode === "compose"
          ? "Same FA ports; internals shown as two HAs + OR."
          : "Full adder — three inputs.";
    }
  }

  function renderOutputs() {
    outGrid.innerHTML = "";
    if (state.mode === "ripple") {
      const r = ripple2(state.a1, state.a0, state.b1, state.b0);
      outGrid.innerHTML = `
        <div class="out-card"><h3>Sum S1 S0</h3><p class="val">${r.s1}${r.s0}</p>
          <p class="eq">decimal ${r.a}+${r.b}=${r.sum}${r.cout ? " (+cout)" : ""}</p></div>
        <div class="out-card"><h3>Cout</h3><p class="val">${r.cout}</p>
          <p class="eq">overflow if 1</p></div>`;
      return;
    }
    if (state.mode === "ha") {
      const r = ha(state.a, state.b);
      outGrid.innerHTML = `
        <div class="out-card"><h3>Sum S</h3><p class="val">${r.s}</p>
          <p class="eq">A ⊕ B</p></div>
        <div class="out-card"><h3>Carry C</h3><p class="val">${r.c}</p>
          <p class="eq">A · B</p></div>`;
      return;
    }
    const r = fa(state.a, state.b, state.cin);
    outGrid.innerHTML = `
      <div class="out-card"><h3>Sum S</h3><p class="val">${r.s}</p>
        <p class="eq">A ⊕ B ⊕ Cin</p></div>
      <div class="out-card"><h3>Cout</h3><p class="val">${r.cout}</p>
        <p class="eq">AB ∨ (A⊕B)Cin</p></div>`;
  }

  function box(x, y, w, h, title, lines, fill) {
    const t = escapeHtml(title);
    let body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="#3a4654"/>`;
    body += `<text x="${x + 8}" y="${y + 16}" fill="#9ecbff" font-size="11" font-family="ui-monospace,monospace">${t}</text>`;
    lines.forEach((ln, i) => {
      body += `<text x="${x + 8}" y="${y + 34 + i * 14}" fill="#e8eef4" font-size="11" font-family="ui-monospace,monospace">${escapeHtml(ln)}</text>`;
    });
    return body;
  }

  function renderSvg() {
    let html = "";
    if (state.mode === "ha") {
      const r = ha(state.a, state.b);
      html += box(140, 40, 140, 80, "HA", [`S=${r.s}`, `C=${r.c}`], "#243040");
      html += `<text x="40" y="70" fill="#7a8a9a" font-size="12" font-family="ui-monospace,monospace">A=${state.a}</text>`;
      html += `<text x="40" y="95" fill="#7a8a9a" font-size="12" font-family="ui-monospace,monospace">B=${state.b}</text>`;
      html += `<line x1="70" y1="66" x2="140" y2="66" stroke="#7a8a9a"/><line x1="70" y1="90" x2="140" y2="90" stroke="#7a8a9a"/>`;
      html += `<text x="300" y="70" fill="#8fd4a8" font-size="12" font-family="ui-monospace,monospace">S</text>`;
      html += `<text x="300" y="100" fill="#f0c674" font-size="12" font-family="ui-monospace,monospace">C</text>`;
    } else if (state.mode === "fa") {
      const r = fa(state.a, state.b, state.cin);
      html += box(140, 30, 150, 100, "FA", [`S=${r.s}`, `Cout=${r.cout}`], "#243040");
      html += `<text x="30" y="55" fill="#7a8a9a" font-size="12" font-family="ui-monospace,monospace">A=${state.a}</text>`;
      html += `<text x="30" y="78" fill="#7a8a9a" font-size="12" font-family="ui-monospace,monospace">B=${state.b}</text>`;
      html += `<text x="30" y="101" fill="#7a8a9a" font-size="12" font-family="ui-monospace,monospace">Cin=${state.cin}</text>`;
      html += `<line x1="70" y1="50" x2="140" y2="50" stroke="#7a8a9a"/>`;
      html += `<line x1="70" y1="74" x2="140" y2="74" stroke="#7a8a9a"/>`;
      html += `<line x1="70" y1="98" x2="140" y2="98" stroke="#7a8a9a"/>`;
    } else if (state.mode === "compose") {
      const r = fa(state.a, state.b, state.cin);
      html += box(20, 40, 110, 70, "HA₁", [`S₁=${r.h1.s}`, `C₁=${r.h1.c}`], "#243040");
      html += box(160, 40, 110, 70, "HA₂", [`S=${r.h2.s}`, `C₂=${r.h2.c}`], "#243040");
      html += box(300, 50, 100, 50, "OR", [`Cout=${r.cout}`], "#2a3a2a");
      html += `<text x="40" y="28" fill="#7a8a9a" font-size="11" font-family="ui-monospace,monospace">A B</text>`;
      html += `<text x="175" y="28" fill="#7a8a9a" font-size="11" font-family="ui-monospace,monospace">S₁ Cin=${state.cin}</text>`;
      html += `<line x1="130" y1="65" x2="160" y2="65" stroke="#9ecbff"/>`;
      html += `<line x1="75" y1="110" x2="75" y2="140" stroke="#f0c674"/><line x1="75" y1="140" x2="300" y2="140" stroke="#f0c674"/><line x1="300" y1="140" x2="300" y2="100" stroke="#f0c674"/>`;
      html += `<line x1="215" y1="110" x2="215" y2="125" stroke="#f0c674"/><line x1="215" y1="125" x2="300" y2="125" stroke="#f0c674"/><line x1="300" y1="125" x2="300" y2="100" stroke="#f0c674"/>`;
    } else {
      const r = ripple2(state.a1, state.a0, state.b1, state.b0);
      html += box(40, 50, 120, 80, "FA₀ (LSB)", [`S0=${r.s0}`, `C1=${r.lo.cout}`], "#243040");
      html += box(220, 50, 120, 80, "FA₁ (MSB)", [`S1=${r.s1}`, `Cout=${r.cout}`], "#243040");
      html += `<text x="160" y="40" fill="#f0c674" font-size="12" font-family="ui-monospace,monospace">Cin₀=0 → C1 →</text>`;
      html += `<line x1="160" y1="90" x2="220" y2="90" stroke="#f0c674" stroke-width="2"/>`;
    }
    blockSvg.innerHTML = html;
  }

  function renderComposeSteps() {
    if (state.mode !== "compose") {
      composeSteps.innerHTML = "";
      return;
    }
    const r = fa(state.a, state.b, state.cin);
    composeSteps.innerHTML = `
      <ol class="build-steps">
        <li class="done">HA₁(A,B) → S₁=${r.h1.s}, C₁=${r.h1.c}</li>
        <li class="done">HA₂(S₁,Cin) → S=${r.h2.s}, C₂=${r.h2.c}</li>
        <li class="done">Cout = C₁ ∨ C₂ = ${r.cout}</li>
      </ol>`;
  }

  function renderRippleView() {
    if (state.mode !== "ripple") {
      rippleView.innerHTML = "";
      return;
    }
    const r = ripple2(state.a1, state.a0, state.b1, state.b0);
    rippleView.innerHTML = `
      <div class="ripple-row">
        <div class="fa-chip"><h4>FA₀</h4>A0=${state.a0} B0=${state.b0}<br>Cin=0<br>→ S0=${r.s0} C1=${r.lo.cout}</div>
        <div class="carry-arrow">C1→</div>
        <div class="fa-chip"><h4>FA₁</h4>A1=${state.a1} B1=${state.b1}<br>Cin=${r.lo.cout}<br>→ S1=${r.s1} Cout=${r.cout}</div>
      </div>`;
  }

  function renderTable() {
    ttBody.innerHTML = "";
    if (state.mode === "ha") {
      ttHead.innerHTML = "<tr><th>A</th><th>B</th><th>S</th><th>C</th></tr>";
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          const r = ha(a, b);
          const tr = document.createElement("tr");
          if (a === state.a && b === state.b) tr.className = "is-active";
          tr.innerHTML = `<td>${a}</td><td>${b}</td><td>${r.s}</td><td>${r.c}</td>`;
          ttBody.appendChild(tr);
        }
      }
    } else if (state.mode === "ripple") {
      ttHead.innerHTML =
        "<tr><th>A</th><th>B</th><th>S</th><th>Cout</th></tr>";
      const r = ripple2(state.a1, state.a0, state.b1, state.b0);
      const tr = document.createElement("tr");
      tr.className = "is-active";
      tr.innerHTML = `<td>${r.a}</td><td>${r.b}</td><td>${r.sum}</td><td>${r.cout}</td>`;
      ttBody.appendChild(tr);
      const note = document.createElement("tr");
      note.innerHTML =
        '<td colspan="4" style="font-size:0.75rem;color:var(--muted);text-align:left">Active row only — toggle bits to explore.</td>';
      ttBody.appendChild(note);
    } else {
      ttHead.innerHTML =
        "<tr><th>A</th><th>B</th><th>Cin</th><th>S</th><th>Cout</th></tr>";
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          for (let c = 0; c <= 1; c++) {
            const r = fa(a, b, c);
            const tr = document.createElement("tr");
            if (a === state.a && b === state.b && c === state.cin)
              tr.className = "is-active";
            tr.innerHTML = `<td>${a}</td><td>${b}</td><td>${c}</td><td>${r.s}</td><td>${r.cout}</td>`;
            ttBody.appendChild(tr);
          }
        }
      }
    }
  }

  function renderTrace() {
    if (!state.trace.length) {
      traceBox.innerHTML = '<span class="muted">(explain or change mode)</span>';
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
    modeSel.value = state.mode;
    renderBits();
    renderOutputs();
    renderSvg();
    renderComposeSteps();
    renderRippleView();
    renderTable();
    renderTrace();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter HA A=1 B=1 → S=0 C=1");
    state.trace = [];
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    if (state.mode === "ha") {
      const r = ha(state.a, state.b);
      state.trace = [
        { kind: "muted", text: "half adder" },
        { kind: "hi", text: `S = A⊕B = ${state.a}⊕${state.b} = ${r.s}` },
        { kind: "hi", text: `C = A·B = ${state.a}·${state.b} = ${r.c}` },
        { kind: "ok", text: "no Cin — cannot add into a multi-bit column alone" },
      ];
    } else if (state.mode === "ripple") {
      const r = ripple2(state.a1, state.a0, state.b1, state.b0);
      state.trace = [
        { kind: "muted", text: "2-bit ripple" },
        {
          kind: "hi",
          text: `FA₀: ${state.a0}+${state.b0}+0 → S0=${r.s0} C1=${r.lo.cout}`,
        },
        {
          kind: "hi",
          text: `FA₁: ${state.a1}+${state.b1}+${r.lo.cout} → S1=${r.s1} Cout=${r.cout}`,
        },
        { kind: "ok", text: `result ${r.a}+${r.b} = ${r.sum} (Cout ${r.cout})` },
      ];
    } else {
      const r = fa(state.a, state.b, state.cin);
      state.trace = [
        { kind: "muted", text: "full adder = 2×HA + OR" },
        {
          kind: "hi",
          text: `HA₁(${state.a},${state.b}) → S₁=${r.h1.s} C₁=${r.h1.c}`,
        },
        {
          kind: "hi",
          text: `HA₂(${r.h1.s},${state.cin}) → S=${r.h2.s} C₂=${r.h2.c}`,
        },
        { kind: "ok", text: `Cout = C₁∨C₂ = ${r.cout}` },
      ];
    }
    pushLog("ok", "# explained");
    renderAll();
  }

  document.getElementById("ha-starter").addEventListener("click", loadStarter);
  modeSel.addEventListener("change", () => {
    state.mode = modeSel.value;
    if (state.mode === "compose") state.composed = true;
    if (state.mode === "ripple") state.rippled = true;
    state.lastAction = "mode";
    pushLog("run", `# mode → ${state.mode}`);
    renderAll();
  });
  document.getElementById("btn-ha").addEventListener("click", () => {
    state.mode = "ha";
    state.a = 1;
    state.b = 1;
    state.lastAction = "preset-ha";
    pushLog("ok", "# preset HA 1+1");
    renderAll();
  });
  document.getElementById("btn-fa").addEventListener("click", () => {
    state.mode = "fa";
    state.a = 1;
    state.b = 1;
    state.cin = 1;
    state.lastAction = "preset-fa";
    pushLog("ok", "# preset FA all-1");
    renderAll();
  });
  document.getElementById("btn-compose").addEventListener("click", () => {
    state.mode = "compose";
    state.composed = true;
    state.a = 1;
    state.b = 1;
    state.cin = 1;
    state.lastAction = "compose";
    pushLog("ok", "# compose 2×HA");
    renderAll();
  });
  document.getElementById("btn-ripple").addEventListener("click", () => {
    state.mode = "ripple";
    state.rippled = true;
    // 01 + 11 = 1 + 3 = 4 → S=00 Cout=1
    state.a1 = 0;
    state.a0 = 1;
    state.b1 = 1;
    state.b0 = 1;
    state.lastAction = "preset-ripple";
    pushLog("ok", "# preset ripple 1+3");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", explain);

  const CHALLENGES = [
    {
      id: "quiz-ha-s",
      title: "Quiz: HA sum",
      prompt: "Half-adder sum is which gate of A,B? Answer: <code>XOR</code>",
      hint: "A⊕B",
      type: "text",
      answer: "xor",
      alt: ["XOR", "exclusive or", "⊕"],
    },
    {
      id: "quiz-ha-c",
      title: "Quiz: HA carry",
      prompt: "Half-adder carry is which gate? Answer: <code>AND</code>",
      hint: "A·B",
      type: "text",
      answer: "and",
      alt: ["AND", "·"],
    },
    {
      id: "quiz-fa-in",
      title: "Quiz: FA inputs",
      prompt: "A full adder has how many inputs? Answer: <code>3</code>",
      hint: "A, B, Cin",
      type: "text",
      answer: "3",
      alt: ["three"],
    },
    {
      id: "quiz-ha-limit",
      title: "Quiz: HA limit",
      prompt: "HA is missing which input vs FA? Answer: <code>Cin</code>",
      hint: "carry in",
      type: "text",
      answer: "cin",
      alt: ["Cin", "carry in", "carry-in", "c_in"],
    },
    {
      id: "starter-ha",
      title: "Starter HA",
      prompt: "Load starter — HA with A=B=1 → S=0 C=1.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.mode === "ha" &&
        state.a === 1 &&
        state.b === 1 &&
        ha(state.a, state.b).s === 0 &&
        ha(state.a, state.b).c === 1,
    },
    {
      id: "ha-01",
      title: "HA 0+1",
      prompt: "Set HA A=0 B=1 — expect S=1 C=0.",
      hint: "Toggle bits in half-adder mode",
      type: "state",
      setup: () => {
        state.mode = "ha";
        state.a = 1;
        state.b = 1;
        renderAll();
      },
      check: () =>
        state.mode === "ha" &&
        state.a === 0 &&
        state.b === 1 &&
        ha(0, 1).s === 1,
    },
    {
      id: "preset-fa",
      title: "Preset FA",
      prompt: "Preset FA with A=B=Cin=1 → S=1 Cout=1.",
      hint: "Preset FA A=B=Cin=1",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = fa(state.a, state.b, state.cin);
        return (
          state.mode === "fa" &&
          state.a === 1 &&
          state.b === 1 &&
          state.cin === 1 &&
          r.s === 1 &&
          r.cout === 1
        );
      },
    },
    {
      id: "fa-majority",
      title: "FA majority",
      prompt: "On FA all-1, Cout equals majority — value? Answer: <code>1</code>",
      hint: "two or more 1s",
      type: "text",
      answer: "1",
      alt: ["one"],
    },
    {
      id: "compose-mode",
      title: "Compose mode",
      prompt: "Open FA from 2×HA + OR compose view.",
      hint: "Show 2×HA compose",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.composed && state.mode === "compose",
    },
    {
      id: "compose-or",
      title: "Compose OR",
      prompt: "In compose with A=B=Cin=1, Cout = C₁∨C₂ should be 1.",
      hint: "Compose preset",
      type: "state",
      setup: () => {
        document.getElementById("btn-compose").click();
      },
      check: () => {
        const r = fa(state.a, state.b, state.cin);
        return (
          state.mode === "compose" &&
          r.h1.c === 1 &&
          r.h2.c === 1 &&
          r.cout === 1
        );
      },
    },
    {
      id: "quiz-compose",
      title: "Quiz: build",
      prompt: "FA carry merge gate is? Answer: <code>OR</code>",
      hint: "C₁ ∨ C₂",
      type: "text",
      answer: "or",
      alt: ["OR", "∨"],
    },
    {
      id: "ripple-preset",
      title: "Ripple 1+3",
      prompt: "Preset ripple 1+3 — expect Cout=1 (sum 4).",
      hint: "Preset ripple 1+3",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const r = ripple2(state.a1, state.a0, state.b1, state.b0);
        return (
          state.rippled &&
          state.mode === "ripple" &&
          r.a === 1 &&
          r.b === 3 &&
          r.cout === 1 &&
          r.sum === 0
        );
      },
    },
    {
      id: "ripple-2+1",
      title: "Ripple 2+1",
      prompt: "In ripple mode set A=10 B=01 → sum 11 Cout=0.",
      hint: "A1=1 A0=0 B1=0 B0=1",
      type: "state",
      setup: () => {
        state.mode = "ripple";
        state.rippled = true;
        state.a1 = 0;
        state.a0 = 1;
        state.b1 = 1;
        state.b0 = 1;
        renderAll();
      },
      check: () => {
        const r = ripple2(state.a1, state.a0, state.b1, state.b0);
        return (
          state.mode === "ripple" &&
          r.a === 2 &&
          r.b === 1 &&
          r.s1 === 1 &&
          r.s0 === 1 &&
          r.cout === 0
        );
      },
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain equations.",
      hint: "Explain equations button",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "quiz-xor3",
      title: "Quiz: FA sum",
      prompt: "FA sum is XOR of how many bits? Answer: <code>3</code>",
      hint: "A⊕B⊕Cin",
      type: "text",
      answer: "3",
      alt: ["three"],
    },
    {
      id: "toggle",
      title: "Toggle",
      prompt: "Toggle any input bit once.",
      hint: "Click A/B/…",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.toggled && state.lastAction === "toggle",
    },
    {
      id: "mode-fa",
      title: "Mode FA",
      prompt: "Switch mode dropdown to Full adder.",
      hint: "Mode select",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.mode === "fa" && state.lastAction === "mode",
    },
    {
      id: "quiz-cin0",
      title: "Quiz: LSB Cin",
      prompt: "Ripple LSB Cin is usually? Answer: <code>0</code>",
      hint: "no incoming carry",
      type: "text",
      answer: "0",
      alt: ["zero"],
    },
    {
      id: "ha-eq-fa",
      title: "HA vs FA Cin0",
      prompt: "FA with Cin=0 matches HA for same A,B (check S and Cout=C).",
      hint: "Set FA Cin=0 A=1 B=0",
      type: "state",
      setup: () => {
        state.mode = "fa";
        state.a = 1;
        state.b = 0;
        state.cin = 1;
        renderAll();
      },
      check: () => {
        if (state.mode !== "fa" || state.cin !== 0) return false;
        const f = fa(state.a, state.b, 0);
        const h = ha(state.a, state.b);
        return f.s === h.s && f.cout === h.c;
      },
    },
    {
      id: "quiz-ripple",
      title: "Quiz: chain",
      prompt: "Cout of FAᵢ feeds? Answer: <code>Cin</code> of next",
      hint: "ripple carry",
      type: "text",
      answer: "cin",
      alt: ["Cin", "cin next", "next cin", "carry in"],
    },
    {
      id: "compose-s1",
      title: "Compose S₁",
      prompt: "Compose A=1 B=0 Cin=1 — HA₁ S₁ should be 1.",
      hint: "compose mode, set bits",
      type: "state",
      setup: () => {
        state.mode = "compose";
        state.composed = true;
        state.a = 1;
        state.b = 1;
        state.cin = 1;
        renderAll();
      },
      check: () =>
        state.mode === "compose" &&
        state.a === 1 &&
        state.b === 0 &&
        state.cin === 1 &&
        fa(1, 0, 1).h1.s === 1,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "HA starter → compose mode → explain.",
      hint: "Load starter → Show 2×HA compose → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.composed &&
        state.mode === "compose" &&
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
