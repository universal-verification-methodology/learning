import { Value } from "./value.js";

const MAX_W = 64;

function digitValue(ch, base) {
  const c = ch.toLowerCase();
  if (c === "x" || c === "z" || c === "?") return c === "?" ? "x" : c;
  let v;
  if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
  else if (c >= "a" && c <= "f") v = c.charCodeAt(0) - 87;
  else throw new Error(`Invalid digit '${ch}'`);
  if (v >= base) throw new Error(`Digit '${ch}' out of range for base ${base}`);
  return v;
}

function bitsPerDigit(base) {
  if (base === 2) return 1;
  if (base === 8) return 3;
  if (base === 16) return 4;
  return 0;
}

/**
 * Parse a Verilog based or plain decimal literal.
 * @param {string} text
 * @returns {{ ok: true, value: Value, size: number, sized: boolean, signed: boolean, base: number, hasXZ: boolean, truncated: boolean, extended: boolean, unsized: boolean, note?: string } | { ok: false, error: string }}
 */
export function parseLiteral(text) {
  const raw = String(text).trim().replace(/\s+/g, "");
  if (!raw) return { ok: false, error: "Enter a literal" };

  if (/^[+-]?\d+$/.test(raw)) {
    const v = BigInt(raw);
    const abs = v < 0n ? -v : v;
    let width = abs.toString(2).length || 1;
    if (v < 0n) width += 1;
    if (width > MAX_W) return { ok: false, error: `Width > ${MAX_W} bits` };
    const u = BigInt.asUintN(width, v);
    const bits = u.toString(2).padStart(width, "0");
    return {
      ok: true,
      value: new Value(bits),
      size: width,
      sized: false,
      signed: v < 0n,
      base: 10,
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

  if (base === 10) {
    const value = decSign * BigInt(digits);
    if (!sized) {
      const need = Math.max(
        1,
        value === 0n ? 1 : value.toString(2).replace("-", "").length + (value < 0n ? 1 : 0)
      );
      size = Math.min(MAX_W, need);
    }
    const u = BigInt.asUintN(size, value);
    const bitStr = u.toString(2).padStart(size, "0").slice(-size);
    return {
      ok: true,
      value: new Value(bitStr),
      size,
      sized,
      signed,
      base,
      hasXZ: false,
      truncated: false,
      extended: false,
      unsized: !sized,
      note: !sized ? "Unsized decimal based literal." : "",
    };
  }

  const bpd = bitsPerDigit(base);
  let bitStr = "";
  let hasXZ = false;
  try {
    for (const ch of digits) {
      const dv = digitValue(ch, base);
      if (typeof dv === "string") {
        hasXZ = true;
        bitStr += dv.repeat(bpd);
      } else {
        bitStr += dv.toString(2).padStart(bpd, "0");
      }
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  if (!bitStr) return { ok: false, error: "Empty value" };

  if (!sized) size = Math.min(MAX_W, Math.max(bitStr.length, 1));

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

  return {
    ok: true,
    value: new Value(bitStr),
    size,
    sized,
    signed,
    base,
    hasXZ,
    truncated,
    extended,
    unsized: !sized,
    note: !sized ? "Unsized based literal — width taken from digits (capped)." : "",
  };
}

export { MAX_W };
