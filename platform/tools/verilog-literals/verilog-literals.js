import { loadHdlEngine } from "../../assets/hdl-engine.js";

const STORAGE_KEY = "ddv-verilog-literals-v1";
const CLEARED_KEY = "ddv-verilog-literals-cleared-v1";
const STARTER = "8'h2A";
const BASE_CHAR = { 2: "b", 8: "o", 10: "d", 16: "h" };

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

/** @type {null | Awaited<ReturnType<typeof loadHdlEngine>>} */
let hdl = null;
let engineLabel = "loading…";

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

  function toSigned(u, w) {
    if (w <= 0) return 0n;
    const msb = 1n << BigInt(w - 1);
    return u & msb ? u - (1n << BigInt(w)) : u;
  }

  /**
   * Map engine parseLiteral result → UI shape (bits string + BigInt value).
   * @param {ReturnType<NonNullable<typeof hdl>["parseLiteral"]>} raw
   */
  function adaptParse(raw) {
    if (!raw || !raw.ok) {
      return { ok: false, error: (raw && raw.error) || "Parse failed" };
    }
    const bits = String(raw.value.bits || "").toLowerCase();
    const hasXZ = !!raw.hasXZ || /[xz]/.test(bits);
    let value = null;
    if (!hasXZ && bits) {
      value = BigInt("0b" + bits);
    }
    return {
      ok: true,
      size: raw.size,
      sized: raw.sized,
      signed: raw.signed,
      base: raw.base,
      baseChar: BASE_CHAR[raw.base] || "d",
      bits,
      value,
      hasXZ,
      truncated: !!raw.truncated,
      extended: !!raw.extended,
      unsized: !!raw.unsized,
      note: raw.note || "",
    };
  }

  function parseLiteral(text) {
    if (!hdl || typeof hdl.parseLiteral !== "function") {
      return { ok: false, error: "HDL engine not loaded" };
    }
    return adaptParse(hdl.parseLiteral(text));
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
    state.msg = "Starter example loaded (HDL parseLiteral).";
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
        <p><strong>Starter example:</strong> <code>8'h2A</code> → bits <code>0010_1010</code>, unsigned 42 — decoded by the <strong>HDL engine</strong> (<code>parseLiteral</code>).</p>
        <p class="vl-hint">Engine: ${escapeHtml(engineLabel)}</p>
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
          state.challengeHint
            ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
            : ""
        }
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="vl-chal-start">${
            state.challengeOn ? "Restart blank" : "Start selected"
          }</button>
          <button type="button" class="btn btn-ghost" id="vl-chal-hint">${
            state.challengeHint ? "Hide hint" : "Show hint"
          }</button>
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

  // Quick self-check once engine is ready
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

  async function boot() {
    root.innerHTML = `<p class="vl-hint">Loading HDL engine…</p>`;
    try {
      hdl = await loadHdlEngine();
      engineLabel = "systemverilog-simulator (parseLiteral)";
      assertParse();
    } catch (e) {
      engineLabel = "unavailable";
      root.innerHTML = `<p class="vl-hint" style="color:#b00">Could not load HDL engine: ${escapeHtml(
        e.message || String(e)
      )}</p>`;
      return;
    }
    if (!tryRestore()) loadStarter();
    render();
  }

  boot();
