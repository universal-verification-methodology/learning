import { loadHdlEngine } from "../../assets/hdl-engine.js";

const MIN_W = 1;
const MAX_W = 32;
const STORAGE_KEY = "ddv-radix-converter-v1";
const CLEARED_KEY = "ddv-radix-converter-cleared-v1";

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

  /** @param {bigint|number} n @param {number} w */
  function valueOf(n, w) {
    return hdl.Value.fromUint(n, w);
  }

  function mask(w) {
    return valueOf((1n << BigInt(w)) - 1n, w).toUint();
  }

  function toSigned(u, w) {
    return valueOf(u, w).toSigned();
  }

  function clampUnsigned(v, w) {
    return valueOf(v, w).toUint();
  }

  function padBin(u, w) {
    return valueOf(u, w).bits;
  }

  function padHex(u, w) {
    return valueOf(u, w).toString(16);
  }

  function groupBits(bin) {
    return bin.replace(/(.{4})(?=.)/g, "$1_");
  }

  function stripSep(s) {
    return String(s).replace(/[_\s]/g, "");
  }

  const CHALLENGES = [
    {
      id: "bin-to-dec",
      title: "Binary → unsigned",
      level: "Intro",
      width: 8,
      prompt: "Enter binary 0000_1101. What is the unsigned decimal?",
      check: (s) => s.width === 8 && s.bits === 0x0dn,
      hint: "1+4+8 = 13.",
    },
    {
      id: "hex-ff",
      title: "Hex FF unsigned",
      level: "Intro",
      width: 8,
      prompt: "Set width 8 and hex FF. Read the unsigned decimal.",
      check: (s) => s.width === 8 && s.bits === 0xffn,
      hint: "0xFF = 255 unsigned.",
    },
    {
      id: "signed-ff",
      title: "Hex FF signed",
      level: "Intro",
      width: 8,
      prompt: "With width 8 and pattern 0xFF, what is two’s-complement signed?",
      check: (s) => s.width === 8 && s.bits === 0xffn && toSigned(s.bits, 8) === -1n,
      hint: "All ones is −1 in two’s complement.",
    },
    {
      id: "neg5",
      title: "Encode −5",
      level: "Core",
      width: 8,
      prompt: "Using signed decimal, enter −5 at width 8. Confirm binary ends with …1011.",
      check: (s) => s.width === 8 && s.bits === 0xfbn,
      hint: "Invert 0000_0101 → 1111_1010, add 1 → 1111_1011 (0xFB).",
    },
    {
      id: "overflow-u",
      title: "Unsigned overflow",
      level: "Core",
      width: 4,
      prompt: "Width 4: try unsigned decimal 20. Truncation should show pattern 0100 (=4).",
      check: (s) => s.width === 4 && s.bits === 0x4n && s.lastOverflow,
      hint: "20 mod 16 = 4; tool wraps and flags overflow.",
    },
    {
      id: "nibble-a",
      title: "Nibble 0xA",
      level: "Core",
      width: 4,
      prompt: "Width 4, set hex A. Signed value should be −6.",
      check: (s) => s.width === 4 && s.bits === 0xan && toSigned(s.bits, 4) === -6n,
      hint: "1010₂: MSB=1 → negative; 1010 − 16 = −6.",
    },
    {
      id: "16bit-neg1",
      title: "16-bit −1",
      level: "Core",
      width: 16,
      prompt: "Width 16: enter signed −1. Hex should be FFFF.",
      check: (s) => s.width === 16 && s.bits === 0xffffn,
      hint: "All ones in any width is −1 signed.",
    },
    {
      id: "msb-sign",
      title: "MSB is sign",
      level: "HDL",
      width: 8,
      prompt: "Width 8: set only the MSB (bit 7) to 1. Signed should be −128.",
      check: (s) => s.width === 8 && s.bits === 0x80n,
      hint: "1000_0000₂ = −128 in 8-bit two’s complement.",
    },
    {
      id: "wrap-signed",
      title: "Signed wrap",
      level: "Stretch",
      width: 8,
      prompt: "Width 8: enter signed 200 (out of range). Pattern should wrap; note the warning.",
      check: (s) => s.width === 8 && s.bits === 0xc8n && s.lastOverflow,
      hint: "BigInt.asUintN(8, 200n) → 0xC8 (200).",
    },
  ];

  const state = {
    width: 8,
    bits: 0x2an, // demo 42
    draft: { bin: "", hex: "", udec: "", sdec: "" },
    fieldError: { bin: "", hex: "", udec: "", sdec: "" },
    status: "",
    statusKind: "ok",
    lastOverflow: false,
    lastDriver: "udec",
    challengeOn: false,
    challengeId: "bin-to-dec",
    challengeHint: false,
    clearedIds: loadCleared(),
    msg: "",
  };

  const root = document.getElementById("rc-root");

  function syncDraftsFromBits() {
    const { width, bits } = state;
    state.draft.bin = groupBits(padBin(bits, width));
    state.draft.hex = padHex(bits, width);
    state.draft.udec = bits.toString(10);
    state.draft.sdec = toSigned(bits, width).toString(10);
    state.fieldError = { bin: "", hex: "", udec: "", sdec: "" };
  }

  function setBits(next, { overflow = false, driver = state.lastDriver } = {}) {
    state.bits = clampUnsigned(next, state.width);
    state.lastOverflow = overflow;
    state.lastDriver = driver;
    if (overflow) {
      state.status = `Value wrapped to ${state.width}-bit pattern (modulo 2^${state.width}).`;
      state.statusKind = "warn";
    } else {
      state.status = "In range for this width.";
      state.statusKind = "ok";
    }
    syncDraftsFromBits();
  }

  function setWidth(w) {
    const width = Math.max(MIN_W, Math.min(MAX_W, w | 0));
    const prev = state.bits;
    state.width = width;
    const next = clampUnsigned(prev, width);
    state.bits = next;
    state.lastOverflow = next !== prev;
    if (state.lastOverflow) {
      state.status = `Width ${width}: previous pattern truncated to ${width} bits.`;
      state.statusKind = "warn";
    } else {
      state.status = `Width ${width} bits.`;
      state.statusKind = "ok";
    }
    syncDraftsFromBits();
  }

  function parseBin(raw) {
    const s = stripSep(raw);
    if (!s) throw new Error("Empty binary");
    if (!/^[01]+$/.test(s)) throw new Error("Binary allows only 0/1");
    const lit = `${state.width}'b${s}`;
    const p = hdl.parseLiteral(lit);
    if (!p.ok) throw new Error(p.error);
    const v = p.value.toUint();
    if (v == null) throw new Error("Binary contains X/Z");
    return { v, truncated: !!p.truncated || s.length > state.width };
  }

  function parseHex(raw) {
    let s = stripSep(raw);
    if (!s) throw new Error("Empty hex");
    if (s.startsWith("0x") || s.startsWith("0X")) s = s.slice(2);
    if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error("Invalid hex digits");
    const lit = `${state.width}'h${s}`;
    const p = hdl.parseLiteral(lit);
    if (!p.ok) throw new Error(p.error);
    const v = p.value.toUint();
    if (v == null) throw new Error("Hex contains X/Z");
    return { v, truncated: !!p.truncated };
  }

  function parseDec(raw, signed) {
    const s = String(raw).trim().replace(/_/g, "");
    if (!s || s === "-" || s === "+") throw new Error("Empty decimal");
    if (!/^[+-]?\d+$/.test(s)) throw new Error("Invalid decimal");
    const w = state.width;
    if (!signed && s.startsWith("-")) throw new Error("Unsigned cannot be negative");
    const lit = signed ? `${w}'sd${s}` : `${w}'d${s.replace(/^\+/, "")}`;
    const p = hdl.parseLiteral(lit);
    if (!p.ok) throw new Error(p.error);
    const v = p.value.toUint();
    if (v == null) throw new Error("Decimal parse failed");
    const asSigned = p.value.toSigned();
    return { v, asSigned, raw: BigInt(s) };
  }

  function applyFrom(field) {
    const w = state.width;
    const maxU = mask(w);
    try {
      let v;
      let overflow = false;
      if (field === "bin") {
        const r = parseBin(state.draft.bin);
        v = r.v;
        overflow = r.truncated || v > maxU;
      } else if (field === "hex") {
        const r = parseHex(state.draft.hex);
        v = r.v;
        // Also flag if unsized magnitude would exceed before size clamp
        const full = stripSep(state.draft.hex).replace(/^0[xX]/, "");
        if (/^[0-9a-fA-F]+$/.test(full)) {
          const wide = BigInt("0x" + full);
          if (wide > maxU) overflow = true;
        }
        overflow = overflow || r.truncated;
      } else if (field === "udec") {
        const r = parseDec(state.draft.udec, false);
        v = r.v;
        if (r.raw > maxU) overflow = true;
      } else if (field === "sdec") {
        const r = parseDec(state.draft.sdec, true);
        const minS = -(1n << BigInt(w - 1));
        const maxS = (1n << BigInt(w - 1)) - 1n;
        if (r.raw < minS || r.raw > maxS) overflow = true;
        v = r.v;
      } else return;
      state.fieldError[field] = "";
      setBits(v, { overflow, driver: field });
    } catch (e) {
      state.fieldError[field] = e.message || String(e);
      state.status = e.message || String(e);
      state.statusKind = "err";
    }
  }

  function toggleBit(i) {
    // i = 0 is MSB
    const shift = BigInt(state.width - 1 - i);
    setBits(state.bits ^ (1n << shift), { overflow: false, driver: "bits" });
  }

  function ranges() {
    const w = state.width;
    const maxU = mask(w);
    const minS = -(1n << BigInt(w - 1));
    const maxS = (1n << BigInt(w - 1)) - 1n;
    return { maxU, minS, maxS };
  }

  function verilogSnippets() {
    const w = state.width;
    const u = state.bits;
    const s = toSigned(u, w);
    const hex = padHex(u, w);
    const bin = padBin(u, w);
    return [
      `${w}'h${hex}`,
      `${w}'b${bin}`,
      `${w}'d${u.toString(10)}`,
      s < 0n ? `${w}'sd${s.toString(10)}` : `${w}'sd${s.toString(10)}`,
    ].join("\n");
  }

  function challengeById(id) {
    return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
  }

  function nextChallengeId() {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    return CHALLENGES[(i + 1) % CHALLENGES.length].id;
  }

  function challengePassed() {
    if (!state.challengeOn) return false;
    const ch = challengeById(state.challengeId);
    try {
      return !!ch.check(state);
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

  function startChallenge(id) {
    const ch = challengeById(id);
    state.challengeId = ch.id;
    state.challengeOn = true;
    state.challengeHint = false;
    setWidth(ch.width);
    setBits(0n, { overflow: false, driver: "challenge" });
    state.status = `Challenge “${ch.title}” — follow the prompt.`;
    state.statusKind = "ok";
  }

  function snapshot() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      width: state.width,
      bits: state.bits.toString(10),
      bin: state.draft.bin,
      hex: state.draft.hex,
      udec: state.draft.udec,
      sdec: state.draft.sdec,
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
      const w = Number(data.width);
      if (!Number.isFinite(w) || w < MIN_W || w > MAX_W) return false;
      state.width = w;
      state.bits = clampUnsigned(BigInt(data.bits || "0"), w);
      syncDraftsFromBits();
      state.status = "Restored last value from this browser. Use Load starter example anytime.";
      state.statusKind = "ok";
      return true;
    } catch {
      return false;
    }
  }

  /** Worked first example — see tools.md “Starter example”. */
  function loadStarter() {
    state.challengeOn = false;
    state.challengeHint = false;
    state.width = 8;
    state.bits = 0x2an;
    state.lastOverflow = false;
    state.lastDriver = "starter";
    syncDraftsFromBits();
    state.status =
      "Starter example: 8-bit 42 = 0x2A = 0010_1010 (HDL Value / parseLiteral). Edit any radix or click bits.";
    state.statusKind = "ok";
    state.msg = "";
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

  function copyText(label, text) {
    navigator.clipboard.writeText(text).then(
      () => {
        state.msg = `Copied ${label}.`;
        render();
      },
      () => {
        state.msg = "Clipboard unavailable.";
        render();
      }
    );
  }

  function render(opts = {}) {
    noteCleared();
    const ch = challengeById(state.challengeId);
    const passed = challengePassed();
    const { maxU, minS, maxS } = ranges();
    const signed = toSigned(state.bits, state.width);
    const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;

    const widthOpts = [4, 8, 16, 32]
      .concat(state.width && ![4, 8, 16, 32].includes(state.width) ? [state.width] : [])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b)
      .map((v) => `<option value="${v}" ${state.width === v ? "selected" : ""}>${v}</option>`)
      .join("");

    const binStr = padBin(state.bits, state.width);
    const bitsHtml = Array.from({ length: state.width }, (_, i) => {
      const bit = binStr[i];
      const idx = state.width - 1 - i;
      return `<button type="button" class="rc-bit${bit === "1" ? " is-1" : ""}${
        i === 0 ? " is-sign" : ""
      }" data-bit="${i}" title="bit ${idx}" aria-label="Toggle bit ${idx}">
        ${bit}<span class="rc-bit-idx">${idx}</span>
      </button>`;
    }).join("");

    const chalList = CHALLENGES.map((c) => {
      const active = state.challengeOn && c.id === state.challengeId;
      const cleared = state.clearedIds.includes(c.id);
      return `
        <button type="button" class="rc-chal-item${active ? " is-active" : ""}${
          cleared ? " is-cleared" : ""
        }" data-chal="${escapeAttr(c.id)}">
          <span class="rc-chal-mark">${cleared ? "✓" : "○"}</span>
          <span>
            <span class="rc-chal-title">${escapeHtml(c.title)}</span>
            <span class="rc-chal-meta">${escapeHtml(c.level)} · ${c.width}-bit · ${escapeHtml(c.prompt)}</span>
          </span>
        </button>`;
    }).join("");

    root.innerHTML = `
      <div class="starter-note no-print">
        <p><strong>Starter example:</strong> 8-bit value <code>42</code> / <code>0x2A</code> via the <strong>HDL engine</strong> (<code>Value</code> + <code>parseLiteral</code>). Change width, type hex or signed decimal, or click bits.</p>
        <p class="rc-hint">Engine: ${escapeHtml(engineLabel)}</p>
        <button type="button" class="btn btn-secondary" id="rc-starter">Load starter example</button>
      </div>

      <div class="challenge">
        <div class="rc-chal-head">
          <h2>Challenges</h2>
          <span class="rc-chal-progress">${clearedCount} / ${CHALLENGES.length} cleared</span>
        </div>
        <div class="rc-chal-catalog">${chalList}</div>
        <p class="rc-chal-prompt"><strong>${escapeHtml(ch.title)}:</strong> ${escapeHtml(ch.prompt)}</p>
        ${
          state.challengeHint
            ? `<p class="chal-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
            : ""
        }
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="rc-chal-start">
            ${state.challengeOn ? "Restart" : "Start selected"}
          </button>
          <button type="button" class="btn btn-ghost" id="rc-chal-hint">${
            state.challengeHint ? "Hide hint" : "Show hint"
          }</button>
          <button type="button" class="btn btn-ghost" id="rc-chal-next" ${passed ? "" : "disabled"}>Next</button>
          <button type="button" class="btn btn-ghost" id="rc-chal-stop" ${
            state.challengeOn ? "" : "disabled"
          }>Stop</button>
          <button type="button" class="btn btn-ghost" id="rc-chal-reset">Reset progress</button>
          <span class="challenge-status ${
            state.challengeOn ? (passed ? "pass" : "fail") : "idle"
          }" id="rc-chal-status">
            ${state.challengeOn ? (passed ? "Pass" : "Not yet") : "Idle"}
          </span>
        </div>
      </div>

      <div class="rc-width-row no-print">
        <div class="rc-field">
          <label for="rc-width">Bit width</label>
          <select id="rc-width">${widthOpts}</select>
        </div>
        <div class="rc-field">
          <label for="rc-width-custom">Custom (1–32)</label>
          <input id="rc-width-custom" type="number" min="${MIN_W}" max="${MAX_W}" value="${state.width}">
        </div>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="rc-zero">All 0</button>
          <button type="button" class="btn btn-ghost" id="rc-ones">All 1</button>
          <button type="button" class="btn btn-ghost" id="rc-rand">Random</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Bit pattern</h2><span class="rc-hint" style="margin:0">MSB (sign) outlined</span></div>
        <div class="panel-body">
          <div class="rc-bits">${bitsHtml}</div>
          <p class="rc-status ${state.statusKind}">${escapeHtml(state.status)}</p>
        </div>
      </div>

      <div class="tool-layout split-wide" style="margin-top:1rem">
        <div class="panel">
          <div class="panel-head"><h2>Radix views</h2></div>
          <div class="panel-body">
            <div class="rc-grid cols-2">
              <div class="rc-field">
                <label for="rc-bin">Binary</label>
                <input id="rc-bin" class="rc-wide${state.fieldError.bin ? " is-bad" : ""}" spellcheck="false"
                  value="${escapeAttr(state.draft.bin)}" aria-label="Binary value">
              </div>
              <div class="rc-field">
                <label for="rc-hex">Hexadecimal</label>
                <input id="rc-hex" class="rc-wide${state.fieldError.hex ? " is-bad" : ""}" spellcheck="false"
                  value="${escapeAttr(state.draft.hex)}" aria-label="Hex value">
              </div>
              <div class="rc-field">
                <label for="rc-udec">Unsigned decimal</label>
                <input id="rc-udec" class="rc-wide${state.fieldError.udec ? " is-bad" : ""}" spellcheck="false"
                  value="${escapeAttr(state.draft.udec)}" aria-label="Unsigned decimal">
              </div>
              <div class="rc-field">
                <label for="rc-sdec">Signed decimal (two’s complement)</label>
                <input id="rc-sdec" class="rc-wide${state.fieldError.sdec ? " is-bad" : ""}" spellcheck="false"
                  value="${escapeAttr(state.draft.sdec)}" aria-label="Signed decimal">
              </div>
            </div>
            <p class="rc-hint">Separators <code>_</code> allowed. Edit any field — others update. Out-of-range values wrap and warn.</p>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Ranges &amp; HDL peek</h2></div>
          <div class="panel-body">
            <div class="rc-range">
              <div><span class="k">Unsigned</span><span class="v">0 … ${maxU.toString(10)}</span></div>
              <div><span class="k">Signed</span><span class="v">${minS.toString(10)} … ${maxS.toString(10)}</span></div>
              <div><span class="k">Current signed</span><span class="v">${signed.toString(10)}</span></div>
              <div><span class="k">Current unsigned</span><span class="v">${state.bits.toString(10)}</span></div>
            </div>
            <pre class="rc-lit" style="margin-top:0.75rem">${escapeHtml(verilogSnippets())}</pre>
            <div class="tool-actions no-print" style="margin-top:0.65rem">
              <button type="button" class="btn btn-secondary" id="rc-copy-bin">Copy binary</button>
              <button type="button" class="btn btn-secondary" id="rc-copy-hex">Copy hex</button>
              <button type="button" class="btn btn-ghost" id="rc-copy-lit">Copy HDL lines</button>
              <button type="button" class="btn btn-ghost" id="rc-print">Print</button>
              <button type="button" class="btn btn-ghost" id="rc-clear-store">Clear saved</button>
              <button type="button" class="btn btn-ghost" id="rc-starter-2">Load starter example</button>
            </div>
            ${state.msg ? `<p class="rc-hint">${escapeHtml(state.msg)}</p>` : ""}
          </div>
        </div>
      </div>
    `;

    bind();
    if (opts.restoreCaret) {
      const el = root.querySelector(opts.restoreCaret.sel);
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

  function bindField(id, key) {
    const el = root.querySelector(id);
    el.addEventListener("input", () => {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      state.draft[key] = el.value;
      applyFrom(key);
      render({ restoreCaret: { sel: id, start, end } });
    });
  }

  function bind() {
    root.querySelector("#rc-width").addEventListener("change", (e) => {
      setWidth(Number(e.target.value));
      render();
    });
    root.querySelector("#rc-width-custom").addEventListener("change", (e) => {
      setWidth(Number(e.target.value));
      render();
    });
    root.querySelector("#rc-zero").addEventListener("click", () => {
      setBits(0n, { overflow: false, driver: "btn" });
      render();
    });
    root.querySelector("#rc-ones").addEventListener("click", () => {
      setBits(mask(state.width), { overflow: false, driver: "btn" });
      render();
    });
    root.querySelector("#rc-rand").addEventListener("click", () => {
      let v = 0n;
      for (let i = 0; i < state.width; i++) {
        if (Math.random() < 0.5) v |= 1n << BigInt(i);
      }
      setBits(v, { overflow: false, driver: "btn" });
      render();
    });

    root.querySelectorAll("[data-bit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleBit(Number(btn.getAttribute("data-bit")));
        render();
      });
    });

    bindField("#rc-bin", "bin");
    bindField("#rc-hex", "hex");
    bindField("#rc-udec", "udec");
    bindField("#rc-sdec", "sdec");

    root.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        startChallenge(btn.getAttribute("data-chal"));
        render();
      });
    });
    root.querySelector("#rc-chal-start").addEventListener("click", () => {
      startChallenge(state.challengeId);
      render();
    });
    root.querySelector("#rc-chal-hint").addEventListener("click", () => {
      state.challengeHint = !state.challengeHint;
      render();
    });
    root.querySelector("#rc-chal-next").addEventListener("click", () => {
      if (!challengePassed()) return;
      startChallenge(nextChallengeId());
      render();
    });
    root.querySelector("#rc-chal-stop").addEventListener("click", () => {
      state.challengeOn = false;
      state.challengeHint = false;
      state.status = "Challenge checking stopped.";
      state.statusKind = "ok";
      render();
    });
    root.querySelector("#rc-chal-reset").addEventListener("click", () => {
      state.clearedIds = [];
      saveCleared();
      state.msg = "Cleared challenge progress.";
      render();
    });

    root.querySelector("#rc-copy-bin").addEventListener("click", () =>
      copyText("binary", padBin(state.bits, state.width))
    );
    root.querySelector("#rc-copy-hex").addEventListener("click", () =>
      copyText("hex", padHex(state.bits, state.width))
    );
    root.querySelector("#rc-copy-lit").addEventListener("click", () => copyText("HDL lines", verilogSnippets()));
    root.querySelector("#rc-print").addEventListener("click", () => window.print());
    root.querySelector("#rc-clear-store").addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      state.msg = "Cleared saved session.";
      render();
    });
    const onStarter = () => {
      loadStarter();
      persist();
      render();
    };
    root.querySelector("#rc-starter").addEventListener("click", onStarter);
    root.querySelector("#rc-starter-2").addEventListener("click", onStarter);
  }

  async function boot() {
    root.innerHTML = `<p class="rc-hint">Loading HDL engine…</p>`;
    try {
      hdl = await loadHdlEngine();
      engineLabel = "systemverilog-simulator (Value / parseLiteral)";
    } catch (e) {
      engineLabel = "unavailable";
      root.innerHTML = `<p class="rc-hint" style="color:#b00">Could not load HDL engine: ${escapeHtml(
        e.message || String(e)
      )}</p>`;
      return;
    }
    if (!tryRestore()) loadStarter();
    else syncDraftsFromBits();
    render();
  }

  boot();
