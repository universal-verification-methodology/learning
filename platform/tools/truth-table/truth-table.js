(() => {
  const DEFAULT_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const MIN_N = 2;
  const MAX_N = 10;
  const CHALLENGE = {
    n: 3,
    names: ["A", "B", "C"],
    // majority: at least two 1s
    target: [0, 0, 0, 1, 0, 1, 1, 1],
    prompt: "Set F so it is 1 when at least two of A,B,C are 1 (3-input majority).",
  };

  const state = {
    n: 2,
    names: ["A", "B"],
    outs: Array(4).fill(0),
    expr: "A & B",
    challengeOn: false,
  };

  const root = document.getElementById("tt-root");

  function resize(n) {
    n = Math.max(MIN_N, Math.min(MAX_N, n | 0));
    state.n = n;
    state.names = DEFAULT_NAMES.slice(0, n).map((d, i) => state.names[i] || d);
    const rows = 1 << n;
    const next = Array(rows).fill(0);
    for (let i = 0; i < Math.min(rows, state.outs.length); i++) next[i] = state.outs[i];
    state.outs = next;
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

  function evalBool(s) {
    let i = 0;
    function peek() {
      while (s[i] === " ") i++;
      return s[i];
    }
    function orExpr() {
      let v = andExpr();
      while (peek() === "|") {
        i++;
        v = v | andExpr();
      }
      return v;
    }
    function andExpr() {
      let v = xorExpr();
      while (peek() === "&") {
        i++;
        v = v & xorExpr();
      }
      return v;
    }
    function xorExpr() {
      let v = unary();
      while (peek() === "^") {
        i++;
        v = v ^ unary();
      }
      return v;
    }
    function unary() {
      if (peek() === "!") {
        i++;
        return unary() ^ 1;
      }
      return primary();
    }
    function primary() {
      const c = peek();
      if (c === "(") {
        i++;
        const v = orExpr();
        if (peek() !== ")") throw new Error("Missing )");
        i++;
        return v;
      }
      if (c === "0" || c === "1") {
        i++;
        return c === "1" ? 1 : 0;
      }
      throw new Error(`Unexpected '${c || "EOF"}'`);
    }
    const v = orExpr();
    if (peek()) throw new Error("Trailing characters");
    return v;
  }

  function prepareExpr(expr, bits) {
    let s = expr.trim();
    if (!s) throw new Error("Empty expression");
    const sorted = state.names
      .map((name, idx) => ({ name, idx }))
      .sort((a, b) => b.name.length - a.name.length);
    for (const { name, idx } of sorted) {
      const bit = String(bits[idx]);
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      s = s.replace(re, bit);
    }
    s = s.replace(/~/g, "!");
    s = s.replace(/(\d)'/g, (_, d) => (d === "1" ? "0" : "1"));
    s = s.replace(/!(\d)/g, (_, d) => (d === "1" ? "0" : "1"));
    s = s.replace(/·/g, "&").replace(/\*/g, "&").replace(/\+/g, "|");
    s = s.replace(/(\d)\s*(\d)/g, "$1&$2");
    s = s.replace(/(\))\s*(\d)/g, "$1&$2");
    s = s.replace(/(\d)\s*(\()/g, "$1&$2");
    s = s.replace(/(\))\s*(\()/g, "$1&$2");
    return s;
  }

  function fillFromExpr() {
    const msg = root.querySelector("#tt-msg");
    try {
      const rows = 1 << state.n;
      for (let i = 0; i < rows; i++) {
        const bits = [];
        for (let b = 0; b < state.n; b++) bits.push((i >> (state.n - 1 - b)) & 1);
        state.outs[i] = evalBool(prepareExpr(state.expr, bits));
      }
      msg.textContent = "Table filled from expression.";
      msg.className = "tt-msg ok";
      render();
    } catch (e) {
      msg.textContent = e.message || String(e);
      msg.className = "tt-msg err";
    }
  }

  function cycleOut(i) {
    const cur = state.outs[i];
    state.outs[i] = cur === 0 ? 1 : cur === 1 ? "X" : 0;
    render();
  }

  function checkChallenge() {
    const el = root.querySelector("#tt-challenge-status");
    if (!state.challengeOn) {
      el.textContent = "Idle";
      el.className = "challenge-status idle";
      return;
    }
    if (state.n !== CHALLENGE.n) {
      el.textContent = "Set variables to 3";
      el.className = "challenge-status fail";
      return;
    }
    const ok = CHALLENGE.target.every((t, i) => state.outs[i] === t);
    el.textContent = ok ? "Pass — majority" : "Not yet";
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

  function render() {
    const forms = sopPos();
    const rows = 1 << state.n;
    const formCap = state.n >= 7 ? 400 : 2000;
    const nOptions = Array.from({ length: MAX_N - MIN_N + 1 }, (_, i) => {
      const v = MIN_N + i;
      return `<option value="${v}" ${state.n === v ? "selected" : ""}>${v} (${1 << v} rows)</option>`;
    }).join("");

    root.innerHTML = `
      <div class="challenge">
        <h2>Challenge</h2>
        <p>${CHALLENGE.prompt}</p>
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="tt-chal">${state.challengeOn ? "Hide challenge" : "Load challenge"}</button>
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
                ? `<p class="tt-hint tt-warn">${rows} rows — scroll the table; prefer “Fill from expression” for large n.</p>`
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
            <p class="tt-hint">Click <strong>F</strong> to cycle 0 → 1 → X.</p>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Canonical forms</h2></div>
          <div class="panel-body tt-forms">
            <div class="tt-form-block">
              <label>SOP (sum of products)</label>
              <pre>${escapeHtml(formatForm(forms.sop, formCap))}</pre>
            </div>
            <div class="tt-form-block">
              <label>POS (product of sums)</label>
              <pre>${escapeHtml(formatForm(forms.pos, formCap))}</pre>
            </div>
            <p class="tt-hint">${forms.ones} minterm(s), ${forms.zeros} maxterm(s). X rows ignored.${
              forms.sop.length > formCap || forms.pos.length > formCap
                ? " Long forms are truncated in the display."
                : ""
            }</p>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:1rem">
        <div class="panel-head"><h2>Fill from expression</h2></div>
        <div class="panel-body">
          <div class="tt-expr-row">
            <input id="tt-expr" type="text" spellcheck="false" value="${escapeAttr(state.expr)}"
              aria-label="Boolean expression" placeholder="e.g. A & B | ~C">
            <button type="button" class="btn btn-primary" id="tt-fill">Fill table</button>
          </div>
          <p class="tt-hint">
            Operators: <code>&amp;</code> <code>|</code> <code>^</code> <code>!</code>/<code>~</code>/<code>'</code>
            · also <code>+</code> <code>*</code>. Example: <code>(A|B) &amp; ~C</code>
          </p>
          <p class="tt-msg" id="tt-msg"></p>
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
        render();
      });
      namesEl.appendChild(inp);
    });

    root.querySelector("#tt-n").addEventListener("change", (e) => {
      resize(Number(e.target.value));
      render();
    });
    root.querySelector("#tt-all0").addEventListener("click", () => {
      state.outs = state.outs.map(() => 0);
      render();
    });
    root.querySelector("#tt-all1").addEventListener("click", () => {
      state.outs = state.outs.map(() => 1);
      render();
    });
    root.querySelector("#tt-clearx").addEventListener("click", () => {
      state.outs = state.outs.map((v) => (v === "X" ? 0 : v));
      render();
    });
    root.querySelectorAll(".out-btn").forEach((btn) => {
      btn.addEventListener("click", () => cycleOut(Number(btn.dataset.row)));
    });
    root.querySelector("#tt-expr").addEventListener("input", (e) => {
      state.expr = e.target.value;
    });
    root.querySelector("#tt-fill").addEventListener("click", fillFromExpr);
    root.querySelector("#tt-chal").addEventListener("click", () => {
      state.challengeOn = !state.challengeOn;
      if (state.challengeOn) {
        resize(CHALLENGE.n);
        state.names = [...CHALLENGE.names];
        state.outs = Array(1 << CHALLENGE.n).fill(0);
        state.expr = "";
      }
      render();
    });

    checkChallenge();
  }

  render();
})();
