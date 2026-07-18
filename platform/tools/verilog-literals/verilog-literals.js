(() => {
  const STORAGE_KEY = "ddv-verilog-literals-v1";
  const CLEARED_KEY = "ddv-verilog-literals-cleared-v1";
  const MAX_W = 64;
  const STARTER = "8'h2A";

  const PRESETS = [
    "4'b1010",
    "8'hFF",
    "8'h2A",
    "8'H2a",
    "16'd42",
    "8'sd-1",
    "8'sb1111_1111",
    "4'shF",
    "6'o17",
    "12'hABC",
    "'b1010",
    "'o17",
    "'d255",
    "'hF",
    "42",
    "5'b10x0z",
    "4'b10??",
    "32'hDEAD_BEEF",
  ];

  function loadCleared() {
    try {
      const raw = localStorage.getItem(CLEARED_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }

  function saveCleared() {
    try {
      localStorage.setItem(CLEARED_KEY, JSON.stringify(state.clearedIds));
    } catch {
      /* ignore */
    }
  }

  function groupBits(bin) {
    return bin.replace(/(.{4})(?=.)/g, "$1_");
  }

  function digitValue(ch, base) {
    const c = ch.toLowerCase();
    if (c === "x" || c === "z" || c === "?") return c === "?" ? "x" : c;
    let v;
    if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
    else if (c >= "a" && c <= "f") v = c.charCodeAt(0) - 87;
    else throw new Error(`Invalid digit '${ch}' for base`);
    if (v >= base) throw new Error(`Digit '${ch}' out of range for base ${base}`);
    return v;
  }

  function bitsPerDigit(base) {
    if (base === 2) return 1;
    if (base === 8) return 3;
    if (base === 16) return 4;
    return 0; // decimal handled separately
  }

  function toSigned(u, w) {
    if (w <= 0) return 0n;
    const msb = 1n << BigInt(w - 1);
    return u & msb ? u - (1n << BigInt(w)) : u;
  }

  /**
   * Parse a Verilog/SV based or simple decimal literal.
   * Returns { ok, error, size, sized, signed, base, baseChar, digits, bits, value, truncated, extended, unsized }
   * bits: string MSB-first of 0/1/x/z length = size (or inferred)
   */
  function parseLiteral(text) {
    const raw = String(text).trim().replace(/\s+/g, "");
    if (!raw) return { ok: false, error: "Enter a literal" };

    // Plain decimal (no ')
    if (/^[+-]?\d+$/.test(raw)) {
      const v = BigInt(raw);
      const abs = v < 0n ? -v : v;
      let width = abs.toString(2).length || 1;
      if (v < 0n) width += 1; // sign bit at least
      if (width > MAX_W) return { ok: false, error: `Width > ${MAX_W} bits` };
      const u = BigInt.asUintN(width, v);
      const bits = u.toString(2).padStart(width, "0");
      return {
        ok: true,
        size: width,
        sized: false,
        signed: v < 0n,
        base: 10,
        baseChar: "d",
        digits: raw,
        bits,
        value: u,
        hasXZ: false,
        truncated: false,
        extended: false,
        unsized: true,
        note: "Unsized plain decimal — width inferred from magnitude (teaching model).",
      };
    }

    const m = raw.match(/^(\d*)'([sS]?)([bBoOdDhH])([0-9a-fA-FxXzZ_?+-]+)$/);
    if (!m) {
      return {
        ok: false,
        error: "Expected forms like 8'hFF, 4'b1010, 8'sd-1, or plain 42",
      };
    }

    const sizeStr = m[1];
    const signed = m[2].toLowerCase() === "s";
    const baseChar = m[3].toLowerCase();
    let digits = m[4].replace(/_/g, "");

    const baseMap = { b: 2, o: 8, d: 10, h: 16 };
    const base = baseMap[baseChar];
    const sized = sizeStr.length > 0;
    let size = sized ? Number(sizeStr) : 0;
    if (sized && (!Number.isFinite(size) || size < 1 || size > MAX_W)) {
      return { ok: false, error: `Size must be 1–${MAX_W}` };
    }

    // Decimal body may start with + / -
    let decSign = 1n;
    if (base === 10) {
      if (digits.startsWith("-")) {
        decSign = -1n;
        digits = digits.slice(1);
      } else if (digits.startsWith("+")) {
        digits = digits.slice(1);
      }
      if (!digits || /[xXzZ?]/.test(digits)) {
        return { ok: false, error: "Decimal body must be digits (optional leading +/-)" };
      }
      if (!/^\d+$/.test(digits)) return { ok: false, error: "Invalid decimal digits" };
    } else if (/[+-]/.test(digits)) {
      return { ok: false, error: "+/- only allowed in decimal ('d) bodies" };
    }

    let bitStr = "";
    let value = 0n;
    let hasXZ = false;

    if (base === 10) {
      value = decSign * BigInt(digits);
      const need = sized ? size : Math.max(1, value === 0n ? 1 : value.toString(2).replace("-", "").length + (value < 0n ? 1 : 0));
      if (!sized) size = Math.min(MAX_W, Math.max(need, signed ? need : need));
      // Fit into size bits as Verilog would for sized decimal
      const u = BigInt.asUintN(size, value);
      bitStr = u.toString(2).padStart(size, "0");
      if (bitStr.length > size) bitStr = bitStr.slice(-size);
      value = u;
    } else {
      const bpd = bitsPerDigit(base);
      for (const ch of digits) {
        const dv = digitValue(ch, base);
        if (typeof dv === "string") {
          hasXZ = true;
          bitStr += dv.repeat(bpd);
        } else {
          bitStr += dv.toString(2).padStart(bpd, "0");
        }
      }
      if (!bitStr) return { ok: false, error: "Empty value" };

      if (!sized) {
        size = Math.min(MAX_W, Math.max(bitStr.length, 1));
      }

      let truncated = false;
      let extended = false;
      if (bitStr.length > size) {
        truncated = true;
        bitStr = bitStr.slice(bitStr.length - size);
      } else if (bitStr.length < size) {
        extended = true;
        const pad = bitStr[0] === "x" || bitStr[0] === "z" ? bitStr[0] : "0";
        bitStr = pad.repeat(size - bitStr.length) + bitStr;
      }

      if (!hasXZ) {
        value = BigInt("0b" + bitStr);
      }

      return {
        ok: true,
        size,
        sized,
        signed,
        base,
        baseChar,
        digits: m[4],
        bits: bitStr,
        value: hasXZ ? null : value,
        hasXZ,
        truncated,
        extended,
        unsized: !sized,
        note: !sized ? "Unsized based literal — width taken from digits (capped)." : "",
      };
    }

    return {
      ok: true,
      size,
      sized,
      signed,
      base,
      baseChar,
      digits: m[4],
      bits: bitStr,
      value,
      hasXZ: false,
      truncated: false,
      extended: false,
      unsized: !sized,
      note: !sized ? "Unsized decimal based literal." : "",
    };
  }

  const CHALLENGES = [
    {
      id: "bin4",
      title: "4-bit binary",
      level: "Intro",
      prompt: "Enter a literal whose bits are exactly 1010 (width 4).",
      hint: "4'b1010",
      check: (p) => p.ok && p.size === 4 && p.bits === "1010",
    },
    {
      id: "hex-ff",
      title: "Hex FF",
      level: "Intro",
      prompt: "Decode 8'hFF — unsigned should be 255.",
      hint: "Type 8'hFF (or 8'HFF).",
      check: (p) => p.ok && !p.hasXZ && p.size === 8 && p.value === 255n,
    },
    {
      id: "sized-dec",
      title: "Sized decimal 'd",
      level: "Intro",
      prompt: "Enter 16'd42 — unsigned should be 42, width 16.",
      hint: "16'd42",
      check: (p) => p.ok && p.base === 10 && p.size === 16 && p.value === 42n && p.sized,
    },
    {
      id: "plain-dec",
      title: "Plain decimal 42",
      level: "Intro",
      prompt: "Enter plain unsized decimal 42 (no quote).",
      hint: "Just type 42",
      check: (p, text) =>
        p.ok && p.unsized && p.base === 10 && /^\s*42\s*$/.test(text) && p.value === 42n,
    },
    {
      id: "signed-neg1",
      title: "Signed −1",
      level: "Intro",
      prompt: "Enter 8'sb1111_1111 or 8'sd-1. Signed value should be −1.",
      hint: "8'sd-1 or 8'shFF with 's.",
      check: (p) =>
        p.ok && !p.hasXZ && p.size === 8 && p.signed && toSigned(p.value, 8) === -1n,
    },
    {
      id: "uppercase-base",
      title: "Uppercase base",
      level: "Core",
      prompt: "Enter 8'H2A (capital H). Same bits as 8'h2A.",
      hint: "8'H2A",
      check: (p, text) =>
        p.ok && p.size === 8 && p.value === 0x2an && /'H2[Aa]/.test(text.replace(/\s/g, "")),
    },
    {
      id: "underscore",
      title: "Underscore nibble",
      level: "Core",
      prompt: "Enter 32'hDEAD_BEEF (underscores allowed).",
      hint: "32'hDEAD_BEEF",
      check: (p) => p.ok && p.size === 32 && !p.hasXZ && p.value === 0xdeadbeefn,
    },
    {
      id: "truncate",
      title: "Truncation warn",
      level: "Core",
      prompt: "Enter 4'hFF so the tool truncates to 4 bits and warns.",
      hint: "4'hFF → bits 1111, truncated.",
      check: (p) => p.ok && p.size === 4 && p.truncated && p.bits === "1111",
    },
    {
      id: "extend",
      title: "Zero extend",
      level: "Core",
      prompt: "Enter 8'b1010 — should zero-extend to 0000_1010.",
      hint: "8'b1010",
      check: (p) => p.ok && p.size === 8 && p.extended && p.bits === "00001010",
    },
    {
      id: "octal",
      title: "Octal",
      level: "Core",
      prompt: "Enter 6'o17 (octal). Bits should be 001_111.",
      hint: "6'o17 → 001111",
      check: (p) => p.ok && p.base === 8 && p.size === 6 && p.bits === "001111",
    },
    {
      id: "unsized-bin",
      title: "Unsized binary",
      level: "Core",
      prompt: "Enter 'b1010 (unsized). Bits should be 1010.",
      hint: "'b1010",
      check: (p, text) =>
        p.ok && p.unsized && p.base === 2 && p.bits === "1010" && /'b1010/i.test(text.replace(/\s/g, "")),
    },
    {
      id: "unsized-oct",
      title: "Unsized octal",
      level: "Core",
      prompt: "Enter 'o17 (unsized). Bits should be 001_111.",
      hint: "'o17",
      check: (p, text) =>
        p.ok && p.unsized && p.base === 8 && p.bits === "001111" && /'o17/i.test(text.replace(/\s/g, "")),
    },
    {
      id: "unsized-dec",
      title: "Unsized 'd",
      level: "HDL",
      prompt: "Enter 'd255 — unsized decimal based literal.",
      hint: "'d255",
      check: (p, text) =>
        p.ok && p.unsized && p.base === 10 && p.value === 255n && /'d255/i.test(text.replace(/\s/g, "")),
    },
    {
      id: "unsized-hex",
      title: "Unsized hex",
      level: "HDL",
      prompt: "Enter 'hF (unsized). Tool should still show a bit vector.",
      hint: "'hF",
      check: (p, text) => p.ok && p.unsized && /'hF/i.test(text.replace(/\s/g, "")),
    },
    {
      id: "xz",
      title: "X / Z digits",
      level: "HDL",
      prompt: "Enter 4'b10xz and confirm X/Z appear in the bit strip.",
      hint: "4'b10xz",
      check: (p) => p.ok && p.hasXZ && p.bits.toLowerCase() === "10xz",
    },
    {
      id: "question",
      title: "? as unknown",
      level: "HDL",
      prompt: "Enter 4'b10?? — '?' should show as X in the bit strip.",
      hint: "4'b10?? → 10xx",
      check: (p) => p.ok && p.hasXZ && p.bits.toLowerCase() === "10xx",
    },
    {
      id: "signed-trunc",
      title: "Signed + truncate",
      level: "Stretch",
      prompt: "Enter 4'shF — signed nibble, truncated from hex F, signed value −1.",
      hint: "4'shF → bits 1111, signed −1.",
      check: (p) =>
        p.ok &&
        p.size === 4 &&
        p.signed &&
        p.bits === "1111" &&
        toSigned(p.value, 4) === -1n,
    },
    {
      id: "starter-match",
      title: "Same as starter",
      level: "Stretch",
      prompt: "Reproduce the starter: 8'h2A → unsigned 42.",
      hint: "8'h2A",
      check: (p) => p.ok && p.size === 8 && p.value === 0x2an,
    },
  ];

  const state = {
    text: STARTER,
    challengeOn: false,
    challengeId: "bin4",
    challengeHint: false,
    clearedIds: loadCleared(),
    msg: "",
  };

  const root = document.getElementById("vl-root");

  function challengeById(id) {
    return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
  }

  function nextChallengeId() {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    return CHALLENGES[(i + 1) % CHALLENGES.length].id;
  }

  function currentParse() {
    return parseLiteral(state.text);
  }

  function challengePassed() {
    if (!state.challengeOn) return false;
    const ch = challengeById(state.challengeId);
    const p = currentParse();
    try {
      return !!ch.check(p, state.text);
    } catch {
      return false;
    }
  }

  function noteCleared() {
    if (!challengePassed()) return;
    if (!state.clearedIds.includes(state.challengeId)) {
      state.clearedIds = [...state.clearedIds, state.challengeId];
      saveCleared();
    }
  }

  function loadStarter() {
    state.challengeOn = false;
    state.challengeHint = false;
    state.text = STARTER;
    state.msg = "Starter example loaded.";
  }

  function startChallenge(id) {
    const ch = challengeById(id);
    state.challengeId = ch.id;
    state.challengeOn = true;
    state.challengeHint = false;
    state.text = "";
    state.msg = `Challenge “${ch.title}” — type a matching literal.`;
  }

  function snapshot() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      text: state.text,
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    } catch {
      /* ignore */
    }
  }

  function tryRestore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.text !== "string") return false;
      state.text = data.text;
      state.msg = "Restored last literal. Use Load starter example anytime.";
      return true;
    } catch {
      return false;
    }
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

  function statusFor(p) {
    if (!p.ok) return { kind: "err", text: p.error };
    const parts = [];
    if (p.truncated) parts.push("Value truncated to sized width (left bits dropped).");
    if (p.extended) parts.push("Value zero-/X-extended to sized width.");
    if (p.unsized) parts.push(p.note || "Unsized literal.");
    if (p.hasXZ) parts.push("Contains X/Z — no numeric decimal.");
    if (!parts.length) parts.push("Literal OK — bit pattern shown below.");
    return { kind: p.truncated || p.unsized ? "warn" : "ok", text: parts.join(" ") };
  }

  function render(opts = {}) {
    noteCleared();
    const p = currentParse();
    const st = statusFor(p);
    const ch = challengeById(state.challengeId);
    const passed = challengePassed();
    const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;

    const chalList = CHALLENGES.map((c) => {
      const active = state.challengeOn && c.id === state.challengeId;
      const cleared = state.clearedIds.includes(c.id);
      return `
        <button type="button" class="vl-chal-item${active ? " is-active" : ""}${
          cleared ? " is-cleared" : ""
        }" data-chal="${escapeAttr(c.id)}">
          <span class="vl-chal-mark">${cleared ? "✓" : "○"}</span>
          <span>
            <span class="vl-chal-title">${escapeHtml(c.title)}</span>
            <span class="vl-chal-meta">${escapeHtml(c.level)} · ${escapeHtml(c.prompt)}</span>
          </span>
        </button>`;
    }).join("");

    const presets = PRESETS.map(
      (t) => `<button type="button" data-preset="${escapeAttr(t)}">${escapeHtml(t)}</button>`
    ).join("");

    let bitsHtml = "";
    if (p.ok && p.bits) {
      bitsHtml = Array.from(p.bits).map((b, i) => {
        const idx = p.size - 1 - i;
        const xz = b === "x" || b === "z" || b === "X" || b === "Z";
        return `<div class="vl-bit${b === "1" ? " is-1" : ""}${xz ? " is-xz" : ""}${
          i === 0 ? " is-sign" : ""
        }" title="bit ${idx}">${escapeHtml(b)}<span>${idx}</span></div>`;
      }).join("");
    }

    let outLines = "—";
    if (p.ok) {
      const lines = [
        `bits   ${groupBits(p.bits)}`,
        `width  ${p.size}`,
        `base   '${p.signed ? "s" : ""}${p.baseChar}`,
      ];
      if (!p.hasXZ && p.value !== null) {
        lines.push(`unsigned ${p.value.toString(10)}`);
        lines.push(`signed   ${toSigned(p.value, p.size).toString(10)}`);
        const hexW = Math.ceil(p.size / 4);
        lines.push(`hex      ${p.value.toString(16).toUpperCase().padStart(hexW, "0")}`);
      }
      outLines = lines.join("\n");
    }

    root.innerHTML = `
      <div class="starter-note no-print">
        <p><strong>Starter example:</strong> <code>8'h2A</code> → bits <code>0010_1010</code>, unsigned 42. Try presets or edit the literal.</p>
        <button type="button" class="btn btn-secondary" id="vl-starter">Load starter example</button>
      </div>

      <div class="challenge">
        <div class="vl-chal-head">
          <h2>Challenges</h2>
          <span class="vl-chal-progress">${clearedCount} / ${CHALLENGES.length} cleared</span>
        </div>
        <div class="vl-chal-catalog">${chalList}</div>
        <p class="vl-chal-prompt"><strong>${escapeHtml(ch.title)}:</strong> ${escapeHtml(ch.prompt)}</p>
        ${
          state.challengeOn && state.challengeHint
            ? `<p class="vl-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
            : ""
        }
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="vl-chal-start">${
            state.challengeOn ? "Restart blank" : "Start selected"
          }</button>
          <button type="button" class="btn btn-ghost" id="vl-chal-hint" ${
            state.challengeOn ? "" : "disabled"
          }>${state.challengeHint ? "Hide hint" : "Show hint"}</button>
          <button type="button" class="btn btn-ghost" id="vl-chal-next" ${passed ? "" : "disabled"}>Next</button>
          <button type="button" class="btn btn-ghost" id="vl-chal-stop" ${
            state.challengeOn ? "" : "disabled"
          }>Stop</button>
          <button type="button" class="btn btn-ghost" id="vl-chal-reset">Reset progress</button>
          <span class="challenge-status ${
            state.challengeOn ? (passed ? "pass" : "fail") : "idle"
          }">${state.challengeOn ? (passed ? "Pass" : "Not yet") : "Idle"}</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Literal</h2></div>
        <div class="panel-body">
          <div class="vl-input-row">
            <div class="vl-field">
              <label for="vl-text">Verilog / SystemVerilog number</label>
              <input id="vl-text" class="${p.ok ? "" : "is-bad"}" spellcheck="false"
                value="${escapeAttr(state.text)}" placeholder="e.g. 8'h2A" aria-label="Verilog literal">
            </div>
            <button type="button" class="btn btn-primary no-print" id="vl-parse">Decode</button>
          </div>
          <div class="vl-presets no-print">${presets}</div>
          <p class="vl-status ${st.kind}">${escapeHtml(st.text)}</p>
          ${state.msg ? `<p class="vl-hint">${escapeHtml(state.msg)}</p>` : ""}
        </div>
      </div>

      <div class="tool-layout split-wide" style="margin-top:1rem">
        <div class="panel">
          <div class="panel-head"><h2>Anatomy</h2></div>
          <div class="panel-body">
            ${
              p.ok
                ? `<div class="vl-anatomy">
              <div><span class="k">Size</span><span class="v">${p.sized ? p.size : `(unsized → ${p.size})`}</span></div>
              <div><span class="k">Signed</span><span class="v">${p.signed ? "yes ('s)" : "no"}</span></div>
              <div><span class="k">Base</span><span class="v">'${p.baseChar} (${p.base})</span></div>
              <div><span class="k">Digits</span><span class="v">${escapeHtml(p.digits)}</span></div>
            </div>
            <div class="vl-bits">${bitsHtml}</div>
            <p class="vl-hint">MSB (left) outlined — sign bit when interpreting as signed.</p>`
                : `<p class="vl-hint">Fix the literal to see size / base / bits.</p>`
            }
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Decoded values</h2></div>
          <div class="panel-body">
            <pre class="vl-out">${escapeHtml(outLines)}</pre>
            <div class="tool-actions no-print" style="margin-top:0.65rem">
              <button type="button" class="btn btn-secondary" id="vl-copy-bits" ${
                p.ok ? "" : "disabled"
              }>Copy bits</button>
              <button type="button" class="btn btn-ghost" id="vl-print">Print</button>
              <button type="button" class="btn btn-ghost" id="vl-clear-store">Clear saved</button>
              <button type="button" class="btn btn-ghost" id="vl-starter-2">Load starter example</button>
              <a class="btn btn-ghost" href="../radix-converter/index.html">Open radix converter</a>
            </div>
          </div>
        </div>
      </div>
    `;

    bind();
    if (opts.restoreCaret) {
      const el = root.querySelector("#vl-text");
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(opts.restoreCaret.start, opts.restoreCaret.end);
        } catch {
          /* ignore */
        }
      }
    }
    persist();
  }

  function bind() {
    const input = root.querySelector("#vl-text");
    input.addEventListener("input", () => {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      state.text = input.value;
      state.msg = "";
      render({ restoreCaret: { start, end } });
    });
    root.querySelector("#vl-parse").addEventListener("click", () => {
      state.msg = currentParse().ok ? "Decoded." : "Still invalid.";
      render();
    });

    root.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.text = btn.getAttribute("data-preset");
        state.msg = `Loaded preset ${state.text}.`;
        render();
      });
    });

    root.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        startChallenge(btn.getAttribute("data-chal"));
        render();
      });
    });
    root.querySelector("#vl-chal-start").addEventListener("click", () => {
      startChallenge(state.challengeId);
      render();
    });
    root.querySelector("#vl-chal-hint").addEventListener("click", () => {
      if (!state.challengeOn) return;
      state.challengeHint = !state.challengeHint;
      render();
    });
    root.querySelector("#vl-chal-next").addEventListener("click", () => {
      if (!challengePassed()) return;
      startChallenge(nextChallengeId());
      render();
    });
    root.querySelector("#vl-chal-stop").addEventListener("click", () => {
      state.challengeOn = false;
      state.challengeHint = false;
      state.msg = "Challenge checking stopped.";
      render();
    });
    root.querySelector("#vl-chal-reset").addEventListener("click", () => {
      state.clearedIds = [];
      saveCleared();
      state.msg = "Cleared challenge progress.";
      render();
    });

    const onStarter = () => {
      loadStarter();
      persist();
      render();
    };
    root.querySelector("#vl-starter").addEventListener("click", onStarter);
    root.querySelector("#vl-starter-2").addEventListener("click", onStarter);

    root.querySelector("#vl-copy-bits").addEventListener("click", () => {
      const p = currentParse();
      if (!p.ok) return;
      navigator.clipboard.writeText(p.bits).then(
        () => {
          state.msg = "Copied bit string.";
          render();
        },
        () => {
          state.msg = "Clipboard unavailable.";
          render();
        }
      );
    });
    root.querySelector("#vl-print").addEventListener("click", () => window.print());
    root.querySelector("#vl-clear-store").addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      state.msg = "Cleared saved session.";
      render();
    });
  }

  // Quick self-check in console-less env
  function assertParse() {
    const samples = [
      ["8'h2A", "00101010", 0x2an],
      ["4'b1010", "1010", 0xan],
      ["4'hFF", "1111", 0xfn],
      ["8'b1010", "00001010", 0xan],
      ["8'sd-1", "11111111", 0xffn],
    ];
    for (const [t, bits, val] of samples) {
      const p = parseLiteral(t);
      if (!p.ok || p.bits !== bits || (val !== null && p.value !== val)) {
        console.warn("parse check failed", t, p);
      }
    }
  }
  assertParse();

  if (!tryRestore()) loadStarter();
  render();
})();
