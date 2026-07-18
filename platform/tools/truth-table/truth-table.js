import { loadHdlEngine } from "../../assets/hdl-engine.js";

const DEFAULT_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const MIN_N = 2;
  const MAX_N = 10;

  /** Build a 0/1 target column from a predicate over variable bits (MSB = first name). */
  function targetFrom(n, pred) {
    const t = [];
    for (let i = 0; i < 1 << n; i++) {
      const bits = [];
      for (let b = 0; b < n; b++) bits.push((i >> (n - 1 - b)) & 1);
      t.push(pred(...bits) ? 1 : 0);
    }
    return t;
  }

  const CHALLENGES = [
    {
      id: "and2",
      title: "AND (2)",
      level: "Intro",
      n: 2,
      names: ["A", "B"],
      prompt: "Set F = 1 only when both A and B are 1.",
      hint: "Expression: A & B",
      target: targetFrom(2, (a, b) => a & b),
    },
    {
      id: "xor2",
      title: "XOR / difference (2)",
      level: "Intro",
      n: 2,
      names: ["A", "B"],
      prompt: "Set F = 1 when A and B differ (exclusive-OR).",
      hint: "Expression: A ^ B",
      target: targetFrom(2, (a, b) => a ^ b),
    },
    {
      id: "implies",
      title: "Implication A → B",
      level: "Intro",
      n: 2,
      names: ["A", "B"],
      prompt: "Set F = 1 when A implies B (false only when A=1 and B=0).",
      hint: "Expression: ~A | B",
      target: targetFrom(2, (a, b) => !a || b),
    },
    {
      id: "majority3",
      title: "Majority (3)",
      level: "Core",
      n: 3,
      names: ["A", "B", "C"],
      prompt: "Set F = 1 when at least two of A, B, C are 1 (3-input majority).",
      hint: "Expression: (A&B) | (A&C) | (B&C)",
      target: targetFrom(3, (a, b, c) => a + b + c >= 2),
    },
    {
      id: "parity3",
      title: "Odd parity (3)",
      level: "Core",
      n: 3,
      names: ["A", "B", "C"],
      prompt: "Set F = 1 when an odd number of inputs are 1 (3-bit XOR / odd parity).",
      hint: "Expression: A ^ B ^ C",
      target: targetFrom(3, (a, b, c) => a ^ b ^ c),
    },
    {
      id: "exactly1",
      title: "Exactly one (3)",
      level: "Core",
      n: 3,
      names: ["A", "B", "C"],
      prompt: "Set F = 1 when exactly one of A, B, C is 1 (one-hot detect).",
      hint: "Expression: (A&~B&~C) | (~A&B&~C) | (~A&~B&C)",
      target: targetFrom(3, (a, b, c) => a + b + c === 1),
    },
    {
      id: "mux21",
      title: "2:1 mux",
      level: "Core",
      n: 3,
      names: ["S", "D0", "D1"],
      prompt: "Treat S as select: F = D0 when S=0, F = D1 when S=1.",
      hint: "Expression: (~S & D0) | (S & D1)",
      target: targetFrom(3, (s, d0, d1) => (s ? d1 : d0)),
    },
    {
      id: "fa-sum",
      title: "Full-adder SUM",
      level: "HDL",
      n: 3,
      names: ["A", "B", "Cin"],
      prompt: "Full adder: set F to the SUM bit (A ⊕ B ⊕ Cin).",
      hint: "Expression: A ^ B ^ Cin",
      target: targetFrom(3, (a, b, cin) => a ^ b ^ cin),
    },
    {
      id: "fa-cout",
      title: "Full-adder Cout",
      level: "HDL",
      n: 3,
      names: ["A", "B", "Cin"],
      prompt: "Full adder: set F to the carry-out (majority of A, B, Cin).",
      hint: "Expression: (A&B) | (A&Cin) | (B&Cin)",
      target: targetFrom(3, (a, b, cin) => a + b + cin >= 2),
    },
    {
      id: "eq2",
      title: "2-bit equality",
      level: "Stretch",
      n: 4,
      names: ["A1", "A0", "B1", "B0"],
      prompt: "Set F = 1 when the 2-bit values A and B are equal (A1A0 == B1B0).",
      hint: "Expression: ~(A1^B1) & ~(A0^B0)",
      target: targetFrom(4, (a1, a0, b1, b0) => a1 === b1 && a0 === b0),
    },
  ];

  function challengeById(id) {
    return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
  }

  const state = {
    n: 2,
    names: ["A", "B"],
    outs: Array(4).fill(0),
    expr: "A & B",
    challengeOn: false,
    challengeId: "majority3",
    challengeHint: false,
    /** When true, typing the expression live-updates the table. */
    liveFill: true,
    /** When true, editing F updates the expression from SOP automatically. */
    syncExprFromTable: true,
    /** Last driver: "expr" | "table" — avoids fighting loops. */
    lastDriver: "expr",
    msg: "",
    msgOk: true,
  };

  let fillTimer = null;
  /** @type {null | { expr: string, namesKey: string, evalAll: () => Array<0|1|"X">, verilogExpr: string }} */
  let combCache = null;
  /** @type {null | Awaited<ReturnType<typeof loadHdlEngine>>} */
  let hdl = null;
  let engineLabel = "loading…";
  const root = document.getElementById("tt-root");
  const STORAGE_KEY = "ddv-truth-table-v1";

  function snapshot() {
    const forms = sopPos();
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      n: state.n,
      names: [...state.names],
      outs: [...state.outs],
      expr: state.expr,
      liveFill: state.liveFill,
      syncExprFromTable: state.syncExprFromTable,
      sop: forms.sop,
      pos: forms.pos,
      sopExpr: exprFromSop(),
      posExpr: exprFromPos(),
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    } catch {
      /* quota / private mode */
    }
  }

  function restoreFromObject(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid file");
    const n = Number(data.n);
    if (!Number.isFinite(n) || n < MIN_N || n > MAX_N) throw new Error("n must be 2–10");
    if (!Array.isArray(data.outs) || data.outs.length !== 1 << n) {
      throw new Error("outs length must be 2^n");
    }
    resize(n);
    if (Array.isArray(data.names) && data.names.length >= n) {
      state.names = data.names.slice(0, n).map((x, i) => String(x || DEFAULT_NAMES[i]));
    }
    state.outs = data.outs.map((v) => (v === "X" || v === "x" ? "X" : v ? 1 : 0));
    if (typeof data.expr === "string") state.expr = data.expr;
    if (typeof data.liveFill === "boolean") state.liveFill = data.liveFill;
    if (typeof data.syncExprFromTable === "boolean") state.syncExprFromTable = data.syncExprFromTable;
    state.lastDriver = "table";
  }

  function tryRestoreLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      restoreFromObject(JSON.parse(raw));
      state.msg = "Restored last session from this browser. Use Load starter example anytime.";
      state.msgOk = true;
      return true;
    } catch {
      return false;
    }
  }

  /** Worked first example — see tools.md “Starter example”. */
  function loadStarter() {
    state.challengeOn = false;
    state.challengeHint = false;
    resize(2);
    state.names = ["A", "B"];
    state.expr = "A & B";
    state.liveFill = true;
    state.syncExprFromTable = true;
    state.lastDriver = "expr";
    combCache = null;
    try {
      applyExprToOuts();
    } catch {
      state.outs = [0, 0, 0, 1];
    }
    state.msg = "Starter example: F = A & B (HDL engine). Edit F or the expression — both stay in sync.";
    state.msgOk = true;
  }

  function downloadBlob(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function exportJson() {
    downloadBlob(`truth-table-${stamp()}.json`, JSON.stringify(snapshot(), null, 2), "application/json");
    state.msg = "Downloaded JSON snapshot.";
    state.msgOk = true;
    persist();
    render();
  }

  function exportCsv() {
    const { n, names, outs } = state;
    const rows = 1 << n;
    const lines = [["#", ...names, "F"].join(",")];
    for (let i = 0; i < rows; i++) {
      const bits = [];
      for (let b = 0; b < n; b++) bits.push((i >> (n - 1 - b)) & 1);
      const f = outs[i] === "X" ? "X" : outs[i];
      lines.push([i, ...bits, f].join(","));
    }
    downloadBlob(`truth-table-${stamp()}.csv`, lines.join("\n") + "\n", "text/csv");
    state.msg = "Downloaded CSV table.";
    state.msgOk = true;
    render();
  }

  function exportMarkdown() {
    const forms = sopPos();
    const { n, names, outs } = state;
    const rows = 1 << n;
    let md = `# Truth table\n\n`;
    md += `- Variables (${n}): ${names.join(", ")}\n`;
    md += `- Expression: \`${state.expr || "(none)"}\`\n`;
    md += `- SOP: \`${forms.sop}\`\n`;
    md += `- POS: \`${forms.pos}\`\n`;
    md += `- Saved: ${new Date().toISOString()}\n\n`;
    md += `| # | ${names.join(" | ")} | F |\n`;
    md += `| --- | ${names.map(() => "---").join(" | ")} | --- |\n`;
    for (let i = 0; i < rows; i++) {
      const bits = [];
      for (let b = 0; b < n; b++) bits.push((i >> (n - 1 - b)) & 1);
      const f = outs[i] === "X" ? "X" : outs[i];
      md += `| ${i} | ${bits.join(" | ")} | ${f} |\n`;
    }
    downloadBlob(`truth-table-${stamp()}.md`, md, "text/markdown");
    state.msg = "Downloaded Markdown report.";
    state.msgOk = true;
    render();
  }

  async function copyText(label, text) {
    try {
      await navigator.clipboard.writeText(text);
      state.msg = `Copied ${label} to clipboard.`;
      state.msgOk = true;
    } catch {
      state.msg = `Could not copy ${label}.`;
      state.msgOk = false;
    }
    render();
  }

  function printSheet() {
    persist();
    window.print();
  }

  function onLoadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        restoreFromObject(JSON.parse(String(reader.result)));
        state.msg = `Loaded ${file.name}.`;
        state.msgOk = true;
        persist();
        render();
      } catch (e) {
        state.msg = e.message || "Load failed";
        state.msgOk = false;
        render();
      }
    };
    reader.readAsText(file);
  }

  function resize(n) {
    n = Math.max(MIN_N, Math.min(MAX_N, n | 0));
    state.n = n;
    state.names = DEFAULT_NAMES.slice(0, n).map((d, i) => state.names[i] || d);
    const rows = 1 << n;
    const next = Array(rows).fill(0);
    for (let i = 0; i < Math.min(rows, state.outs.length); i++) next[i] = state.outs[i];
    state.outs = next;
    combCache = null;
  }

  function formatForm(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + " …";
  }

  function sopPos() {
    const { n, names, outs } = state;
    const rows = 1 << n;
    const sopTerms = [];
    const posTerms = [];
    for (let i = 0; i < rows; i++) {
      const v = outs[i];
      if (v === "X") continue;
      if (v === 1) {
        const parts = [];
        for (let b = 0; b < n; b++) {
          const bit = (i >> (n - 1 - b)) & 1;
          parts.push(bit ? names[b] : `${names[b]}'`);
        }
        sopTerms.push(parts.join(""));
      } else {
        const ors = [];
        for (let b = 0; b < n; b++) {
          const bit = (i >> (n - 1 - b)) & 1;
          ors.push(bit ? `${names[b]}'` : names[b]);
        }
        posTerms.push(`(${ors.join(" + ")})`);
      }
    }
    return {
      sop: sopTerms.length ? sopTerms.join(" + ") : "0",
      pos: posTerms.length ? posTerms.join(" · ") : "1",
      ones: sopTerms.length,
      zeros: posTerms.length,
    };
  }

  /** Machine-friendly expression from current F column (for the expression box). */
  function exprFromSop() {
    const { n, names, outs } = state;
    const terms = [];
    for (let i = 0; i < 1 << n; i++) {
      if (outs[i] !== 1) continue;
      const parts = [];
      for (let b = 0; b < n; b++) {
        const bit = (i >> (n - 1 - b)) & 1;
        parts.push(bit ? names[b] : `~${names[b]}`);
      }
      terms.push(parts.length === 1 ? parts[0] : `(${parts.join(" & ")})`);
    }
    return terms.length ? terms.join(" | ") : "0";
  }

  function exprFromPos() {
    const { n, names, outs } = state;
    const terms = [];
    for (let i = 0; i < 1 << n; i++) {
      if (outs[i] !== 0) continue;
      const parts = [];
      for (let b = 0; b < n; b++) {
        const bit = (i >> (n - 1 - b)) & 1;
        parts.push(bit ? `~${names[b]}` : names[b]);
      }
      terms.push(`(${parts.join(" | ")})`);
    }
    return terms.length ? terms.join(" & ") : "1";
  }

  function namesKey() {
    return state.names.slice(0, state.n).join("\0");
  }

  function applyExprToOuts() {
    if (!hdl || typeof hdl.createCombEvaluator !== "function") {
      throw new Error("HDL engine not loaded");
    }
    const names = state.names.slice(0, state.n);
    const key = namesKey();
    if (!combCache || combCache.expr !== state.expr || combCache.namesKey !== key) {
      const ev = hdl.createCombEvaluator(state.expr, names);
      combCache = {
        expr: state.expr,
        namesKey: key,
        evalAll: () => ev.evalAll(),
        verilogExpr: ev.verilogExpr,
      };
    }
    state.outs = combCache.evalAll();
  }

  function fillFromExpr(opts = {}) {
    const { keepFocus = false, silent = false } = opts;
    const sel = keepFocus ? saveExprCaret() : null;
    try {
      if (!state.expr.trim()) {
        if (!silent) {
          state.msg = "Type an expression to fill the table.";
          state.msgOk = false;
          render({ restoreCaret: sel });
        }
        return;
      }
      applyExprToOuts();
      state.lastDriver = "expr";
      state.msg = silent
        ? "Live update from HDL engine."
        : "Table filled from expression (HDL engine).";
      state.msgOk = true;
      persist();
      render({ restoreCaret: sel });
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
      render({ restoreCaret: sel });
    }
  }

  function saveExprCaret() {
    const el = root.querySelector("#tt-expr");
    if (!el) return null;
    return { start: el.selectionStart, end: el.selectionEnd };
  }

  function scheduleLiveFill() {
    if (!state.liveFill) return;
    clearTimeout(fillTimer);
    fillTimer = setTimeout(() => fillFromExpr({ keepFocus: true, silent: true }), 280);
  }

  function afterTableEdit() {
    state.lastDriver = "table";
    if (state.syncExprFromTable) {
      state.expr = exprFromSop();
      state.msg = "Expression updated from table (SOP).";
      state.msgOk = true;
    }
    persist();
    render();
  }

  function cycleOut(i) {
    const cur = state.outs[i];
    state.outs[i] = cur === 0 ? 1 : cur === 1 ? "X" : 0;
    afterTableEdit();
  }

  function useCanonical(kind) {
    state.expr = kind === "pos" ? exprFromPos() : exprFromSop();
    state.lastDriver = "expr";
    state.msg =
      kind === "pos"
        ? "Loaded POS into expression (and refreshed table)."
        : "Loaded SOP into expression (and refreshed table).";
    state.msgOk = true;
    try {
      applyExprToOuts();
      persist();
    } catch (e) {
      state.msg = e.message || String(e);
      state.msgOk = false;
    }
    render();
  }

  function activeChallenge() {
    return challengeById(state.challengeId);
  }

  function challengePassed() {
    const ch = activeChallenge();
    if (!state.challengeOn || state.n !== ch.n) return false;
    if (state.outs.length !== ch.target.length) return false;
    return ch.target.every((t, i) => state.outs[i] === t);
  }

  function loadChallenge(id, { announce } = { announce: true }) {
    const ch = challengeById(id);
    state.challengeId = ch.id;
    state.challengeOn = true;
    state.challengeHint = false;
    resize(ch.n);
    state.names = [...ch.names];
    state.outs = Array(1 << ch.n).fill(0);
    state.expr = "";
    state.lastDriver = "table";
    if (announce) {
      state.msg = `Challenge “${ch.title}” loaded — fill F or type an expression.`;
      state.msgOk = true;
    }
  }

  function nextChallengeId() {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    return CHALLENGES[(i + 1) % CHALLENGES.length].id;
  }

  function checkChallenge() {
    const el = root.querySelector("#tt-challenge-status");
    if (!el) return;
    if (!state.challengeOn) {
      el.textContent = "Idle";
      el.className = "challenge-status idle";
      return;
    }
    const ch = activeChallenge();
    if (state.n !== ch.n) {
      el.textContent = `Set variables to ${ch.n}`;
      el.className = "challenge-status fail";
      return;
    }
    const ok = challengePassed();
    el.textContent = ok ? `Pass — ${ch.title}` : "Not yet";
    el.className = "challenge-status " + (ok ? "pass" : "fail");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function render(opts = {}) {
    const forms = sopPos();
    const rows = 1 << state.n;
    const formCap = state.n >= 7 ? 400 : 2000;
    const nOptions = Array.from({ length: MAX_N - MIN_N + 1 }, (_, i) => {
      const v = MIN_N + i;
      return `<option value="${v}" ${state.n === v ? "selected" : ""}>${v} (${1 << v} rows)</option>`;
    }).join("");

    const ch = activeChallenge();
    const chalOptions = CHALLENGES.map(
      (c) =>
        `<option value="${escapeAttr(c.id)}" ${c.id === state.challengeId ? "selected" : ""}>${escapeHtml(
          c.level
        )} — ${escapeHtml(c.title)}</option>`
    ).join("");
    const passed = challengePassed();

    root.innerHTML = `
      <div class="starter-note no-print-hide">
        <p><strong>Starter example:</strong> two inputs, expression <code>A &amp; B</code> fills the table via the <strong>HDL engine</strong> (<code>assign F = …</code>). Challenges reset to a blank table when you Start.</p>
        <p class="tt-hint">Engine: ${escapeHtml(engineLabel)}${
          combCache && combCache.verilogExpr
            ? ` · Verilog: <code>${escapeHtml(combCache.verilogExpr)}</code>`
            : ""
        }</p>
        <button type="button" class="btn btn-secondary" id="tt-starter">Load starter example</button>
      </div>

      <div class="challenge">
        <h2>Challenges</h2>
        <div class="tt-chal-pick">
          <label for="tt-chal-sel">Pick one</label>
          <select id="tt-chal-sel">${chalOptions}</select>
        </div>
        <p>${escapeHtml(ch.prompt)}</p>
        ${
        state.challengeHint
          ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
          : ""
      }
      <div class="tool-actions">
        <button type="button" class="btn btn-secondary" id="tt-chal-start">
          ${state.challengeOn ? "Restart" : "Start"}
        </button>
        <button type="button" class="btn btn-ghost" id="tt-chal-hint">
          ${state.challengeHint ? "Hide hint" : "Show hint"}
        </button>
          <button type="button" class="btn btn-ghost" id="tt-chal-next" ${passed ? "" : "disabled"}>
            Next challenge
          </button>
          <button type="button" class="btn btn-ghost" id="tt-chal-hide" ${state.challengeOn ? "" : "disabled"}>
            Stop checking
          </button>
          <span class="challenge-status idle" id="tt-challenge-status">Idle</span>
        </div>
      </div>

      <div class="tool-layout split-wide">
        <div class="panel">
          <div class="panel-head"><h2>Truth table</h2></div>
          <div class="panel-body">
            <div class="tt-controls">
              <div class="tt-field">
                <label for="tt-n">Variables</label>
                <select id="tt-n">${nOptions}</select>
              </div>
              <div class="tt-field">
                <label>Names</label>
                <div class="tt-var-row" id="tt-names"></div>
              </div>
              <div class="tool-actions">
                <button type="button" class="btn btn-ghost" id="tt-all0">All 0</button>
                <button type="button" class="btn btn-ghost" id="tt-all1">All 1</button>
                <button type="button" class="btn btn-ghost" id="tt-clearx">Clear X</button>
              </div>
            </div>
            ${
              state.n >= 7
                ? `<p class="tt-hint tt-warn">${rows} rows — scroll the table; prefer the expression box for large n.</p>`
                : ""
            }
            <div class="tt-table-wrap">
              <table class="tt-table">
                <thead>
                  <tr>
                    <th>#</th>
                    ${state.names.map((n) => `<th>${escapeHtml(n)}</th>`).join("")}
                    <th>F</th>
                  </tr>
                </thead>
                <tbody>
                  ${Array.from({ length: rows }, (_, i) => {
                    const cells = state.names
                      .map((_, b) => {
                        const bit = (i >> (state.n - 1 - b)) & 1;
                        return `<td>${bit}</td>`;
                      })
                      .join("");
                    const o = state.outs[i];
                    const cls = o === 1 ? "v1" : o === 0 ? "v0" : "vx";
                    const label = o === "X" ? "X" : String(o);
                    return `<tr>
                      <td class="row-idx">${i}</td>
                      ${cells}
                      <td><button type="button" class="out-btn ${cls}" data-row="${i}" aria-label="Toggle output row ${i}">${label}</button></td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
            <p class="tt-hint">Click <strong>F</strong> to cycle 0 → 1 → X.${
              state.syncExprFromTable ? " Expression auto-updates from SOP." : ""
            }</p>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Canonical forms</h2></div>
          <div class="panel-body tt-forms">
            <div class="tt-form-block">
              <label>SOP (sum of products)</label>
              <pre>${escapeHtml(formatForm(forms.sop, formCap))}</pre>
              <div class="tool-actions" style="margin-top:0.45rem">
                <button type="button" class="btn btn-secondary" id="tt-use-sop">Use SOP as expression</button>
              </div>
            </div>
            <div class="tt-form-block">
              <label>POS (product of sums)</label>
              <pre>${escapeHtml(formatForm(forms.pos, formCap))}</pre>
              <div class="tool-actions" style="margin-top:0.45rem">
                <button type="button" class="btn btn-secondary" id="tt-use-pos">Use POS as expression</button>
              </div>
            </div>
            <p class="tt-hint">${forms.ones} minterm(s), ${forms.zeros} maxterm(s). X rows ignored.${
              forms.sop.length > formCap || forms.pos.length > formCap
                ? " Display may be truncated; Use SOP/POS still loads the full form."
                : ""
            }</p>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:1rem">
        <div class="panel-head"><h2>Expression</h2></div>
        <div class="panel-body">
          <div class="tt-expr-row">
            <input id="tt-expr" type="text" spellcheck="false" value="${escapeAttr(state.expr)}"
              aria-label="Boolean expression" placeholder="e.g. A & B | ~C">
            <button type="button" class="btn btn-primary" id="tt-fill">Fill table</button>
          </div>
          <div class="tt-toggles">
            <label class="tt-check">
              <input type="checkbox" id="tt-live" ${state.liveFill ? "checked" : ""}>
              Live-fill table while typing
            </label>
            <label class="tt-check">
              <input type="checkbox" id="tt-sync" ${state.syncExprFromTable ? "checked" : ""}>
              Sync expression from table (SOP)
            </label>
          </div>
          <p class="tt-hint">
            Operators: <code>&amp;</code> <code>|</code> <code>^</code> <code>!</code>/<code>~</code>/<code>'</code>
            · also <code>+</code> <code>*</code>. Example: <code>(A|B) &amp; ~C</code>
          </p>
          <p class="tt-msg ${state.msgOk ? "ok" : "err"}" id="tt-msg">${escapeHtml(state.msg)}</p>
        </div>
      </div>

      <div class="panel tt-export no-print-hide" style="margin-top:1rem">
        <div class="panel-head"><h2>Save, load &amp; print</h2></div>
        <div class="panel-body">
          <div class="tool-actions">
            <button type="button" class="btn btn-secondary" id="tt-print">Print</button>
            <button type="button" class="btn btn-secondary" id="tt-json">Download JSON</button>
            <button type="button" class="btn btn-secondary" id="tt-csv">Download CSV</button>
            <button type="button" class="btn btn-secondary" id="tt-md">Download Markdown</button>
            <label class="btn btn-ghost tt-file-btn">
              Load JSON
              <input type="file" id="tt-load" accept="application/json,.json" hidden>
            </label>
          </div>
          <div class="tool-actions" style="margin-top:0.55rem">
            <button type="button" class="btn btn-ghost" id="tt-copy-expr">Copy expression</button>
            <button type="button" class="btn btn-ghost" id="tt-copy-sop">Copy SOP</button>
            <button type="button" class="btn btn-ghost" id="tt-copy-pos">Copy POS</button>
            <button type="button" class="btn btn-ghost" id="tt-clear-storage">Clear saved session</button>
            <button type="button" class="btn btn-ghost" id="tt-starter-2">Load starter example</button>
          </div>
          <p class="tt-hint">
            Session auto-saves in this browser. JSON restores the full lab; CSV/Markdown are for notes and hand-ins.
          </p>
        </div>
      </div>
    `;

    const namesEl = root.querySelector("#tt-names");
    state.names.forEach((name, idx) => {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "var-name";
      inp.maxLength = 4;
      inp.value = name;
      inp.setAttribute("aria-label", `Variable ${idx + 1} name`);
      inp.addEventListener("change", () => {
        state.names[idx] = inp.value.trim() || DEFAULT_NAMES[idx];
        combCache = null;
        if (state.lastDriver === "expr" && state.liveFill && state.expr.trim()) {
          fillFromExpr({ silent: true });
        } else if (state.syncExprFromTable) {
          afterTableEdit();
        } else {
          render();
        }
      });
      namesEl.appendChild(inp);
    });

    root.querySelector("#tt-n").addEventListener("change", (e) => {
      resize(Number(e.target.value));
      if (state.lastDriver === "expr" && state.expr.trim()) fillFromExpr({ silent: true });
      else if (state.syncExprFromTable) {
        state.expr = exprFromSop();
        render();
      } else render();
    });
    root.querySelector("#tt-all0").addEventListener("click", () => {
      state.outs = state.outs.map(() => 0);
      afterTableEdit();
    });
    root.querySelector("#tt-all1").addEventListener("click", () => {
      state.outs = state.outs.map(() => 1);
      afterTableEdit();
    });
    root.querySelector("#tt-clearx").addEventListener("click", () => {
      state.outs = state.outs.map((v) => (v === "X" ? 0 : v));
      afterTableEdit();
    });
    root.querySelectorAll(".out-btn").forEach((btn) => {
      btn.addEventListener("click", () => cycleOut(Number(btn.dataset.row)));
    });

    const exprEl = root.querySelector("#tt-expr");
    exprEl.addEventListener("input", (e) => {
      state.expr = e.target.value;
      state.lastDriver = "expr";
      scheduleLiveFill();
    });
    root.querySelector("#tt-fill").addEventListener("click", () => fillFromExpr());
    root.querySelector("#tt-live").addEventListener("change", (e) => {
      state.liveFill = e.target.checked;
      if (state.liveFill) scheduleLiveFill();
    });
    root.querySelector("#tt-sync").addEventListener("change", (e) => {
      state.syncExprFromTable = e.target.checked;
      if (state.syncExprFromTable && state.lastDriver === "table") {
        state.expr = exprFromSop();
        render();
      }
    });
    root.querySelector("#tt-use-sop").addEventListener("click", () => useCanonical("sop"));
    root.querySelector("#tt-use-pos").addEventListener("click", () => useCanonical("pos"));
    root.querySelector("#tt-print").addEventListener("click", printSheet);
    root.querySelector("#tt-json").addEventListener("click", exportJson);
    root.querySelector("#tt-csv").addEventListener("click", exportCsv);
    root.querySelector("#tt-md").addEventListener("click", exportMarkdown);
    root.querySelector("#tt-load").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) onLoadFile(file);
      e.target.value = "";
    });
    root.querySelector("#tt-copy-expr").addEventListener("click", () => copyText("expression", state.expr || ""));
    root.querySelector("#tt-copy-sop").addEventListener("click", () => copyText("SOP", sopPos().sop));
    root.querySelector("#tt-copy-pos").addEventListener("click", () => copyText("POS", sopPos().pos));
    root.querySelector("#tt-clear-storage").addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      state.msg = "Cleared saved session (current table kept).";
      state.msgOk = true;
      render();
    });
    const loadStarterBtn = () => {
      loadStarter();
      persist();
      render();
    };
    root.querySelector("#tt-starter").addEventListener("click", loadStarterBtn);
    root.querySelector("#tt-starter-2").addEventListener("click", loadStarterBtn);
    root.querySelector("#tt-chal-sel").addEventListener("change", (e) => {
      state.challengeId = e.target.value;
      state.challengeHint = false;
      if (state.challengeOn) loadChallenge(state.challengeId);
      render();
    });
    root.querySelector("#tt-chal-start").addEventListener("click", () => {
      loadChallenge(state.challengeId);
      render();
    });
    root.querySelector("#tt-chal-hint").addEventListener("click", () => {
      state.challengeHint = !state.challengeHint;
      render();
    });
    root.querySelector("#tt-chal-next").addEventListener("click", () => {
      if (!challengePassed()) return;
      loadChallenge(nextChallengeId());
      render();
    });
    root.querySelector("#tt-chal-hide").addEventListener("click", () => {
      state.challengeOn = false;
      state.challengeHint = false;
      state.msg = "Challenge checking stopped (table kept).";
      state.msgOk = true;
      render();
    });

    if (opts.restoreCaret && exprEl) {
      exprEl.focus();
      const { start, end } = opts.restoreCaret;
      try {
        exprEl.setSelectionRange(start, end);
      } catch {
        /* ignore */
      }
    }

    checkChallenge();
  }

  // Boot after HDL engine loads
  async function boot() {
    root.innerHTML = `<p class="tt-hint">Loading HDL engine…</p>`;
    try {
      hdl = await loadHdlEngine();
      engineLabel = "systemverilog-simulator (createCombEvaluator)";
    } catch (e) {
      engineLabel = "unavailable";
      root.innerHTML = `<p class="tt-hint tt-warn">Could not load HDL engine: ${escapeHtml(
        e.message || String(e)
      )}</p>`;
      return;
    }
    if (!tryRestoreLocal()) loadStarter();
    persist();
    render();
  }

  boot();
