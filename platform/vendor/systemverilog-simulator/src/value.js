/** @typedef {'0'|'1'|'x'|'z'} Bit */

/**
 * Four-state bit vector (MSB-first). Teaching model, max width 64.
 */
export class Value {
  /**
   * @param {string} bits MSB-first string of 0/1/x/z
   */
  constructor(bits) {
    this.bits = String(bits).toLowerCase().replace(/[^01xzhl]/g, (c) =>
      c === "?" ? "x" : "x"
    );
    if (!this.bits.length) this.bits = "0";
  }

  get width() {
    return this.bits.length;
  }

  get hasXZ() {
    return /[xzhl]/.test(this.bits);
  }

  static zeros(w) {
    return new Value("0".repeat(Math.max(1, w)));
  }

  static ones(w) {
    return new Value("1".repeat(Math.max(1, w)));
  }

  static xxxx(w) {
    return new Value("x".repeat(Math.max(1, w)));
  }

  static zzzz(w) {
    return new Value("z".repeat(Math.max(1, w)));
  }

  static fromUint(n, w) {
    const width = Math.max(1, w | 0);
    let v = BigInt(n);
    if (v < 0n) v = BigInt.asUintN(width, v);
    let s = v.toString(2);
    if (s.length > width) s = s.slice(-width);
    else s = s.padStart(width, "0");
    return new Value(s);
  }

  static fromBits(bits, width) {
    let s = String(bits).toLowerCase().replace(/\?/g, "x");
    if (width != null) {
      if (s.length > width) s = s.slice(-width);
      else if (s.length < width) {
        const pad = s[0] === "x" || s[0] === "z" ? s[0] : "0";
        s = pad.repeat(width - s.length) + s;
      }
    }
    return new Value(s || "0");
  }

  resize(width) {
    return Value.fromBits(this.bits, width);
  }

  bit(i) {
    // i = 0 is LSB
    const idx = this.width - 1 - i;
    if (idx < 0 || idx >= this.width) return "x";
    return /** @type {Bit} */ (this.bits[idx]);
  }

  slice(hi, lo) {
    if (hi < lo) throw new Error(`Invalid part select [${hi}:${lo}]`);
    const w = hi - lo + 1;
    let out = "";
    for (let i = hi; i >= lo; i--) out += this.bit(i);
    return new Value(out.padStart(w, "x").slice(0, w));
  }

  toUint() {
    if (this.hasXZ) return null;
    return BigInt("0b" + this.bits);
  }

  toSigned() {
    const u = this.toUint();
    if (u == null) return null;
    const w = this.width;
    const msb = 1n << BigInt(w - 1);
    return u & msb ? u - (1n << BigInt(w)) : u;
  }

  equals(other) {
    return this.bits === other.bits;
  }

  toString(base = 2) {
    // Map ambiguous H/L to x for numeric displays
    const logicBits = this.bits.replace(/[hl]/g, "x");
    if (base === 2) return logicBits;
    if (/[xz]/.test(logicBits)) {
      if (base === 16) return this._groupXZ(4, logicBits);
      if (base === 8) return this._groupXZ(3, logicBits);
      return logicBits;
    }
    const u = BigInt("0b" + logicBits);
    if (base === 16) return u.toString(16).toUpperCase().padStart(Math.ceil(this.width / 4), "0");
    if (base === 8) return u.toString(8).padStart(Math.ceil(this.width / 3), "0");
    if (base === 10) return u.toString(10);
    return logicBits;
  }

  _groupXZ(bpd, bitsIn = null) {
    const bits = bitsIn || this.bits;
    const pad = (bpd - (bits.length % bpd)) % bpd;
    const padded = "0".repeat(pad) + bits;
    let out = "";
    for (let i = 0; i < padded.length; i += bpd) {
      const chunk = padded.slice(i, i + bpd);
      if (/x/.test(chunk)) out += "x";
      else if (/z/.test(chunk)) out += "z";
      else out += parseInt(chunk, 2).toString(bpd === 4 ? 16 : 8).toUpperCase();
    }
    return out;
  }

  clone() {
    const v = new Value(this.bits);
    if (this.signed) v.signed = true;
    return v;
  }
}

/** @param {Bit} a @param {Bit} b @param {(x:number,y:number)=>number} fn */
function bitBin(a, b, fn) {
  // Legacy path for non-IEEE ops; prefer gateBit*
  if (a === "x" || a === "z" || b === "x" || b === "z") return "x";
  return fn(a === "1" ? 1 : 0, b === "1" ? 1 : 0) ? "1" : "0";
}

/** IEEE 1364 bitwise/gate AND (0 dominates). */
export function gateBitAnd(a, b) {
  const x = (a || "x").toLowerCase();
  const y = (b || "x").toLowerCase();
  if (x === "0" || y === "0") return "0";
  if (x === "1" && y === "1") return "1";
  return "x";
}

/** IEEE 1364 bitwise/gate OR (1 dominates). */
export function gateBitOr(a, b) {
  const x = (a || "x").toLowerCase();
  const y = (b || "x").toLowerCase();
  if (x === "1" || y === "1") return "1";
  if (x === "0" && y === "0") return "0";
  return "x";
}

/** IEEE 1364 bitwise/gate XOR. */
export function gateBitXor(a, b) {
  const x = (a || "x").toLowerCase();
  const y = (b || "x").toLowerCase();
  if (x === "0" && y === "0") return "0";
  if (x === "1" && y === "1") return "0";
  if (x === "0" && y === "1") return "1";
  if (x === "1" && y === "0") return "1";
  return "x";
}

/** @param {Value} a @param {Value} b @param {(x:number,y:number)=>number} fn */
export function bitwiseBin(a, b, fn) {
  const w = Math.max(a.width, b.width);
  const A = a.resize(w);
  const B = b.resize(w);
  let out = "";
  // Detect IEEE & | ^ via fn identity by probing — callers should use bitwiseAnd/Or/Xor
  for (let i = 0; i < w; i++) out += bitBin(/** @type {Bit} */ (A.bits[i]), /** @type {Bit} */ (B.bits[i]), fn);
  return new Value(out);
}

export function bitwiseAnd(a, b) {
  const w = Math.max(a.width, b.width);
  const A = a.resize(w);
  const B = b.resize(w);
  let out = "";
  for (let i = 0; i < w; i++) out += gateBitAnd(A.bits[i], B.bits[i]);
  return new Value(out);
}

export function bitwiseOr(a, b) {
  const w = Math.max(a.width, b.width);
  const A = a.resize(w);
  const B = b.resize(w);
  let out = "";
  for (let i = 0; i < w; i++) out += gateBitOr(A.bits[i], B.bits[i]);
  return new Value(out);
}

export function bitwiseXor(a, b) {
  const w = Math.max(a.width, b.width);
  const A = a.resize(w);
  const B = b.resize(w);
  let out = "";
  for (let i = 0; i < w; i++) out += gateBitXor(A.bits[i], B.bits[i]);
  return new Value(out);
}

export function bitwiseNot(a) {
  let out = "";
  for (const c of a.bits) {
    if (c === "0") out += "1";
    else if (c === "1") out += "0";
    else out += "x";
  }
  return new Value(out);
}

export function reduceAnd(a) {
  if (a.bits.includes("0")) return new Value("0");
  if (/x|z/i.test(a.bits)) return new Value("x");
  return new Value("1");
}

export function reduceOr(a) {
  if (/x|z/.test(a.bits) && !a.bits.includes("1")) return new Value("x");
  return new Value(a.bits.includes("1") ? "1" : "0");
}

export function reduceXor(a) {
  if (a.hasXZ) return new Value("x");
  let x = 0;
  for (const c of a.bits) x ^= c === "1" ? 1 : 0;
  return new Value(String(x));
}

export function concatValues(vals) {
  return new Value(vals.map((v) => v.bits).join("") || "0");
}

export function logicalToBit(v) {
  if (v.hasXZ) return new Value("x");
  return new Value(v.bits.includes("1") ? "1" : "0");
}

export function arithBin(a, b, op) {
  if (a.hasXZ || b.hasXZ) {
    const w = Math.max(a.width, b.width);
    return Value.xxxx(op === "mul" ? Math.min(64, a.width + b.width) : w);
  }
  const wa = a.width;
  const wb = b.width;
  const ua = a.toUint();
  const ub = b.toUint();
  let r;
  let w = Math.max(wa, wb);
  if (op === "add") {
    r = ua + ub;
  } else if (op === "sub") {
    r = ua - ub;
  } else if (op === "mul") {
    w = Math.min(64, wa + wb);
    r = ua * ub;
  } else if (op === "div") {
    if (ub === 0n) return Value.xxxx(w);
    r = ua / ub; // trunc toward zero (BigInt)
  } else if (op === "mod") {
    if (ub === 0n) return Value.xxxx(w);
    r = ua % ub;
  } else throw new Error(`Unknown arith op ${op}`);
  return Value.fromUint(r, w);
}

export function shiftLeft(a, sh) {
  if (sh.hasXZ) return Value.xxxx(a.width);
  const n = Number(sh.toUint() ?? 0n);
  if (n >= a.width) return Value.zeros(a.width);
  return new Value(a.bits.slice(n) + "0".repeat(n));
}

export function shiftRight(a, sh) {
  if (sh.hasXZ) return Value.xxxx(a.width);
  const n = Number(sh.toUint() ?? 0n);
  if (n >= a.width) return Value.zeros(a.width);
  return new Value("0".repeat(n) + a.bits.slice(0, a.width - n));
}

/** Arithmetic (sign-extending) right shift. */
export function shiftRightArith(a, sh) {
  if (sh.hasXZ) return Value.xxxx(a.width);
  const n = Number(sh.toUint() ?? 0n);
  const fill = a.bits[0] || "0";
  if (n >= a.width) return new Value(fill.repeat(a.width));
  return new Value(fill.repeat(n) + a.bits.slice(0, a.width - n));
}

export function compare(a, b, op) {
  if (op === "caseeq" || op === "casene") {
    const wa = Math.max(a.width, b.width);
    const eq = a.resize(wa).bits === b.resize(wa).bits;
    const ok = op === "caseeq" ? eq : !eq;
    return new Value(ok ? "1" : "0");
  }
  if (a.hasXZ || b.hasXZ) return new Value("x");
  const wa = Math.max(a.width, b.width);
  const signed = !!(a.signed || b.signed);
  const A = signed ? a.resize(wa).toSigned() : a.resize(wa).toUint();
  const B = signed ? b.resize(wa).toSigned() : b.resize(wa).toUint();
  let ok = false;
  if (op === "eq") ok = A === B;
  else if (op === "ne") ok = A !== B;
  else if (op === "lt") ok = A < B;
  else if (op === "gt") ok = A > B;
  else if (op === "le") ok = A <= B;
  else if (op === "ge") ok = A >= B;
  return new Value(ok ? "1" : "0");
}

/**
 * Normalize net kind for resolution.
 * supply* / pull* / tri0/1 keep distinct labels for post-resolve pull.
 * tri≈wire, triand≈wand, trior≈wor.
 */
export function netResolveKind(kind) {
  if (kind === "wand" || kind === "triand") return "wand";
  if (kind === "wor" || kind === "trior") return "wor";
  if (kind === "supply0" || kind === "supply1") return kind;
  if (kind === "tri0" || kind === "pull0") return "pull0";
  if (kind === "tri1" || kind === "pull1") return "pull1";
  if (kind === "trireg") return "trireg";
  return "wire"; // wire, tri, inout nets, etc.
}

/**
 * IEEE 1364 strength levels (drive + charge).
 * supply=7 … highz=0; large=4, medium=2, small=1 (charge / trireg).
 */
export const STRENGTH_LEVEL = {
  supply: 7,
  strong: 6,
  pull: 5,
  large: 4,
  weak: 3,
  medium: 2,
  small: 1,
  highz: 0,
};

const LEVEL_NAME = ["HiZ", "Sm", "Me", "We", "La", "Pu", "St", "Su"];

/** Default continuous-assign / gate drive: (strong1, strong0). */
export const DEFAULT_STRENGTH = { one: STRENGTH_LEVEL.strong, zero: STRENGTH_LEVEL.strong };

/** Default trireg charge strength. */
export const DEFAULT_CHARGE = STRENGTH_LEVEL.medium;

/**
 * Map a strength keyword to { level, sense }.
 * Drive: supply0/1 … highz0/1. Charge with sense: large0/1 … (rare).
 * Bare charge: large|medium|small → sense null.
 * @param {string} name
 * @returns {{ level: number, sense: 0|1|null }}
 */
export function strengthKeywordInfo(name) {
  const n = String(name).toLowerCase();
  if (n === "large" || n === "medium" || n === "small") {
    return { level: STRENGTH_LEVEL[n], sense: null };
  }
  const sense = n.endsWith("1") ? 1 : n.endsWith("0") ? 0 : null;
  let level = STRENGTH_LEVEL.strong;
  if (n.startsWith("supply")) level = STRENGTH_LEVEL.supply;
  else if (n.startsWith("strong")) level = STRENGTH_LEVEL.strong;
  else if (n.startsWith("pull")) level = STRENGTH_LEVEL.pull;
  else if (n.startsWith("large")) level = STRENGTH_LEVEL.large;
  else if (n.startsWith("weak")) level = STRENGTH_LEVEL.weak;
  else if (n.startsWith("medium")) level = STRENGTH_LEVEL.medium;
  else if (n.startsWith("small")) level = STRENGTH_LEVEL.small;
  else if (n.startsWith("highz")) level = STRENGTH_LEVEL.highz;
  else throw new Error(`Unknown drive strength '${name}'`);
  if (sense == null) throw new Error(`Unknown drive strength '${name}'`);
  return { level, sense: /** @type {0|1} */ (sense) };
}

/**
 * Build { one, zero } from a strength pair (either order: *1/*0 or *0/*1),
 * or a single strength keyword (pullup/pulldown).
 * @param {string} a
 * @param {string} [b]
 * @param {{ single?: boolean }} [opts]
 */
export function strengthPairFromKeywords(a, b, opts = {}) {
  if (opts.single || b == null || a === b) {
    const A = strengthKeywordInfo(a);
    if (A.sense === 1) return { one: A.level, zero: STRENGTH_LEVEL.highz };
    if (A.sense === 0) return { one: STRENGTH_LEVEL.highz, zero: A.level };
    throw new Error(`Expected *0 or *1 strength, got '${a}'`);
  }
  const A = strengthKeywordInfo(a);
  const B = strengthKeywordInfo(b);
  if (A.sense === 1 && B.sense === 0) return { one: A.level, zero: B.level };
  if (A.sense === 0 && B.sense === 1) return { one: B.level, zero: A.level };
  throw new Error(`Expected one *1 and one *0 strength, got '${a}', '${b}'`);
}

/** @returns {{ s0: number, s1: number, forceX?: boolean }} */
export function emptyRails() {
  return { s0: 0, s1: 0 };
}

/**
 * Two-rail combine (IEEE 7.10): max of each rail independently.
 * @param {{ s0: number, s1: number, forceX?: boolean }} a
 * @param {{ s0: number, s1: number, forceX?: boolean }} b
 */
export function combineRails(a, b) {
  return {
    s0: Math.max(a.s0 | 0, b.s0 | 0),
    s1: Math.max(a.s1 | 0, b.s1 | 0),
    forceX: !!(a.forceX || b.forceX),
  };
}

/**
 * Logic value from strength rails (StX algebra).
 * Known drives: only one rail → that value; both rails → stronger wins, equal → x.
 * Ambiguous (forceX) sources: always x while both rails may differ (65x, …).
 * @param {{ s0: number, s1: number, forceX?: boolean }} rails
 * @returns {'0'|'1'|'x'|'z'}
 */
export function logicFromRails(rails) {
  const s0 = rails.s0 | 0;
  const s1 = rails.s1 | 0;
  if (s0 === 0 && s1 === 0) return "z";
  if (rails.forceX) return "x";
  if (s0 === 0) return "1";
  if (s1 === 0) return "0";
  if (s0 === s1) return "x";
  return s0 > s1 ? "0" : "1";
}

/**
 * Format one bit's strength for %v (Su0, St1, StX, 65x, HiZ, …).
 * @param {{ s0: number, s1: number, forceX?: boolean }} rails
 */
export function formatStrengthRails(rails) {
  const s0 = rails.s0 | 0;
  const s1 = rails.s1 | 0;
  const bit = logicFromRails(rails);
  if (bit === "z") return "HiZ";
  if (bit === "0") return `${LEVEL_NAME[s0] || s0}0`;
  if (bit === "1") return `${LEVEL_NAME[s1] || s1}1`;
  if (s0 === s1) return `${LEVEL_NAME[s0] || s0}X`;
  return `${s0}${s1}x`;
}

/**
 * Driver bit + (one,zero) strengths → rails (or null if fully off).
 * Bits `h`/`l` are IEEE ambiguous H/L (1-or-Z / 0-or-Z).
 * @param {string} bit
 * @param {{ one: number, zero: number }} pair
 * @returns {{ s0: number, s1: number, forceX?: boolean }|null}
 */
export function railsFromDriveBit(bit, pair) {
  const b = (bit || "z").toLowerCase();
  if (b === "z") return null;
  if (b === "0") {
    if ((pair.zero | 0) === STRENGTH_LEVEL.highz) return null;
    return { s0: pair.zero | 0, s1: 0 };
  }
  if (b === "1") {
    if ((pair.one | 0) === STRENGTH_LEVEL.highz) return null;
    return { s0: 0, s1: pair.one | 0 };
  }
  if (b === "l") {
    // L = 0 or Z → forceX on 0-rail only
    if ((pair.zero | 0) === STRENGTH_LEVEL.highz) return null;
    return { s0: pair.zero | 0, s1: 0, forceX: true };
  }
  if (b === "h") {
    if ((pair.one | 0) === STRENGTH_LEVEL.highz) return null;
    return { s0: 0, s1: pair.one | 0, forceX: true };
  }
  // x → ambiguous StX / 65x source
  const s0 = pair.zero | 0;
  const s1 = pair.one | 0;
  if (s0 === STRENGTH_LEVEL.highz && s1 === STRENGTH_LEVEL.highz) return null;
  return {
    s0: s0 === STRENGTH_LEVEL.highz ? 0 : s0,
    s1: s1 === STRENGTH_LEVEL.highz ? 0 : s1,
    forceX: true,
  };
}

/** Non-resistive switch: supply → strong; else pass through. */
export function reduceStrengthNonResistive(level) {
  if ((level | 0) === STRENGTH_LEVEL.supply) return STRENGTH_LEVEL.strong;
  return level | 0;
}

/** Resistive switch strength cut (IEEE). */
export function reduceStrengthResistive(level) {
  const L = level | 0;
  if (L === STRENGTH_LEVEL.supply || L === STRENGTH_LEVEL.strong) return STRENGTH_LEVEL.pull;
  if (L === STRENGTH_LEVEL.pull) return STRENGTH_LEVEL.weak;
  if (L === STRENGTH_LEVEL.weak || L === STRENGTH_LEVEL.large) return STRENGTH_LEVEL.medium;
  if (L === STRENGTH_LEVEL.medium) return STRENGTH_LEVEL.small;
  return L; // small, highz
}

/**
 * @param {{ s0: number, s1: number, forceX?: boolean }} rails
 * @param {boolean} resistive
 */
export function reduceRails(rails, resistive) {
  const red = resistive ? reduceStrengthResistive : reduceStrengthNonResistive;
  return {
    s0: red(rails.s0 | 0),
    s1: red(rails.s1 | 0),
    forceX: !!rails.forceX,
  };
}

/**
 * Resolve many drive contributions on one bit via StX rail algebra.
 * @param {{ s0: number, s1: number }[]} railList
 * @returns {{ bit: string, rails: { s0: number, s1: number } }}
 */
export function resolveStrengthRails(railList) {
  let acc = emptyRails();
  for (const r of railList) {
    if (!r) continue;
    acc = combineRails(acc, r);
  }
  return { bit: logicFromRails(acc), rails: acc };
}

/**
 * Strength-aware resolve of one bit from many {v,s} drives (compat wrapper).
 * Prefer resolveStrengthRails for full StX.
 * @param {{ v: string, s: number }[]} drives
 */
export function resolveStrengthDrives(drives) {
  /** @type {{ s0: number, s1: number, forceX?: boolean }[]} */
  const rails = [];
  for (const d of drives) {
    if (!d) continue;
    if (d.v === "0") rails.push({ s0: d.s, s1: 0 });
    else if (d.v === "1") rails.push({ s0: 0, s1: d.s });
    else if (d.v === "x") rails.push({ s0: d.s, s1: d.s, forceX: true });
  }
  return resolveStrengthRails(rails).bit;
}

/**
 * Resolve two drive bits (IEEE-style; used for wand/wor).
 * @param {string} a
 * @param {string} b
 * @param {'wire'|'wand'|'wor'} [kind]
 */
export function resolveBit(a, b, kind = "wire") {
  const x = (a || "z").toLowerCase();
  const y = (b || "z").toLowerCase();
  if (kind === "wand") {
    if (x === "z") return y;
    if (y === "z") return x;
    if (x === "0" || y === "0") return "0";
    if (x === "1" && y === "1") return "1";
    return "x";
  }
  if (kind === "wor") {
    if (x === "z") return y;
    if (y === "z") return x;
    if (x === "1" || y === "1") return "1";
    if (x === "0" && y === "0") return "0";
    return "x";
  }
  if (x === "z") return y;
  if (y === "z") return x;
  if (x === "x" || y === "x") return "x";
  if (x === y) return x;
  return "x";
}

/** Replace Z bits with a pull level (tri0/pull0 → 0, tri1/pull1 → 1). */
function applyPullBits(bits, pull) {
  let out = "";
  for (let i = 0; i < bits.length; i++) {
    const b = bits[i];
    out += b === "z" ? pull : b;
  }
  return out;
}

/**
 * Normalize a contribution to { value, strength }.
 * @param {Value|{ value: Value, strength?: { one: number, zero: number } }} c
 */
function normContrib(c) {
  if (c && typeof c === "object" && "value" in c && c.value) {
    return {
      value: c.value,
      strength: c.strength || DEFAULT_STRENGTH,
    };
  }
  return { value: /** @type {Value} */ (c), strength: DEFAULT_STRENGTH };
}

/**
 * Full resolve with per-bit rails (StX algebra).
 * @param {(Value|{ value: Value, strength?: { one: number, zero: number } })[]} values
 * @param {number} width
 * @param {string} [netKind]
 * @param {{ chargeLevel?: number, prevBits?: string, prevRails?: { s0: number, s1: number }[] }} [triregOpts]
 * @returns {{ value: Value, rails: { s0: number, s1: number }[] }}
 */
export function resolveValuesWithStrength(values, width, netKind = "wire", triregOpts = {}) {
  const kind = netResolveKind(netKind);
  if (kind === "supply0") {
    const rails = Array.from({ length: width }, () => ({
      s0: STRENGTH_LEVEL.supply,
      s1: 0,
    }));
    return { value: Value.zeros(width), rails };
  }
  if (kind === "supply1") {
    const rails = Array.from({ length: width }, () => ({
      s0: 0,
      s1: STRENGTH_LEVEL.supply,
    }));
    return { value: Value.ones(width), rails };
  }

  if (kind === "wand" || kind === "wor") {
    // Strength-aware wired logic (IEEE 7.10.4 subset):
    // wand: any 0 wins (AND); wor: any 1 wins (OR); strengths from winning polarity.
    const bits = [];
    /** @type {{ s0: number, s1: number, forceX?: boolean }[]} */
    const railsOut = [];
    for (let i = 0; i < width; i++) {
      /** @type {{ s0: number, s1: number, forceX?: boolean }[]} */
      const list = [];
      for (const raw of values) {
        if (raw && typeof raw === "object" && raw.railsPerBit && raw.railsPerBit[i]) {
          list.push(raw.railsPerBit[i]);
          continue;
        }
        const { value, strength } = normContrib(raw);
        const r = railsFromDriveBit(value.resize(width).bits[i], strength);
        if (r) list.push(r);
      }
      if (!list.length) {
        bits.push("z");
        railsOut.push(emptyRails());
        continue;
      }
      let max0 = 0;
      let max1 = 0;
      let any0 = false;
      let any1 = false;
      let forceX = false;
      for (const r of list) {
        if (r.s0 > 0) {
          any0 = true;
          if (r.s0 > max0) max0 = r.s0;
        }
        if (r.s1 > 0) {
          any1 = true;
          if (r.s1 > max1) max1 = r.s1;
        }
        if (r.forceX) forceX = true;
      }
      if (kind === "wand") {
        if (any0) {
          bits.push(forceX && !any1 ? "x" : "0");
          railsOut.push({ s0: max0, s1: 0, forceX: forceX && !any1 });
        } else if (any1) {
          bits.push(forceX ? "x" : "1");
          railsOut.push({ s0: 0, s1: max1, forceX });
        } else {
          bits.push("z");
          railsOut.push(emptyRails());
        }
      } else {
        // wor
        if (any1) {
          bits.push(forceX && !any0 ? "x" : "1");
          railsOut.push({ s0: 0, s1: max1, forceX: forceX && !any0 });
        } else if (any0) {
          bits.push(forceX ? "x" : "0");
          railsOut.push({ s0: max0, s1: 0, forceX });
        } else {
          bits.push("z");
          railsOut.push(emptyRails());
        }
      }
    }
    return { value: new Value(bits.join("")), rails: railsOut };
  }

  const bits = [];
  /** @type {{ s0: number, s1: number }[]} */
  const rails = [];
  for (let i = 0; i < width; i++) {
    /** @type {{ s0: number, s1: number, forceX?: boolean }[]} */
    const list = [];
    for (const raw of values) {
      if (raw && typeof raw === "object" && raw.railsPerBit && raw.railsPerBit[i]) {
        list.push(raw.railsPerBit[i]);
        continue;
      }
      const { value, strength } = normContrib(raw);
      const r = railsFromDriveBit(value.resize(width).bits[i], strength);
      if (r) list.push(r);
    }
    let { bit, rails: rr } = resolveStrengthRails(list);

    // trireg capacitive hold when undriven
    if (kind === "trireg" && bit === "z") {
      const prevBits = triregOpts.prevBits || "";
      const prevRails = triregOpts.prevRails;
      const pb = prevBits[i];
      if (pb === "0" || pb === "1" || pb === "x") {
        const ch = triregOpts.chargeLevel ?? DEFAULT_CHARGE;
        if (prevRails && prevRails[i] && (prevRails[i].s0 || prevRails[i].s1)) {
          // Keep previous logic; force charge-level rails
          bit = pb;
          if (pb === "0") rr = { s0: ch, s1: 0 };
          else if (pb === "1") rr = { s0: 0, s1: ch };
          else rr = { s0: ch, s1: ch };
        } else {
          bit = pb;
          if (pb === "0") rr = { s0: ch, s1: 0 };
          else if (pb === "1") rr = { s0: 0, s1: ch };
          else rr = { s0: ch, s1: ch };
        }
      }
    }

    bits.push(bit);
    rails.push(rr);
  }

  let acc = new Value(bits.join(""));
  if (kind === "pull0") {
    const nb = applyPullBits(acc.bits, "0");
    acc = new Value(nb);
    for (let i = 0; i < width; i++) {
      if (bits[i] === "z") {
        rails[i] = { s0: STRENGTH_LEVEL.pull, s1: 0 };
      }
    }
  } else if (kind === "pull1") {
    const nb = applyPullBits(acc.bits, "1");
    acc = new Value(nb);
    for (let i = 0; i < width; i++) {
      if (bits[i] === "z") {
        rails[i] = { s0: 0, s1: STRENGTH_LEVEL.pull };
      }
    }
  }
  return { value: acc, rails };
}

/**
 * Resolve multiple driver Values onto one net (logic bits only).
 * @param {(Value|{ value: Value, strength?: { one: number, zero: number } })[]} values
 * @param {number} width
 * @param {string} [netKind]
 */
export function resolveValues(values, width, netKind = "wire") {
  return resolveValuesWithStrength(values, width, netKind).value;
}

/**
 * Pick rise/fall/toff delay from a delay spec given previous and next bit strings.
 * @param {number|{rise:number,fall:number,toff?:number}} spec
 * @param {string} prevBits
 * @param {string} nextBits
 */
export function pickTransportDelay(spec, prevBits, nextBits) {
  if (typeof spec === "number") return Math.max(0, spec | 0);
  const rise = spec.rise ?? 0;
  const fall = spec.fall ?? rise;
  const toff = spec.toff ?? fall;
  const prev = String(prevBits);
  const next = String(nextBits);
  const w = Math.max(prev.length, next.length);
  const p = prev.padStart(w, "0");
  const n = next.padStart(w, "0");
  for (let i = 0; i < w; i++) {
    if (p[i] === n[i]) continue;
    if (n[i] === "z") return Math.max(0, toff | 0);
    if (p[i] === "1" && n[i] === "0") return Math.max(0, fall | 0);
    if (p[i] === "0" && n[i] === "1") return Math.max(0, rise | 0);
    if (n[i] === "1") return Math.max(0, rise | 0);
    if (n[i] === "0") return Math.max(0, fall | 0);
    return Math.max(0, rise | 0);
  }
  return Math.max(0, rise | 0);
}

/** Scalar delay for procedural # — use max of rise/fall if multi-delay. */
export function delayToNumber(spec) {
  if (typeof spec === "number") return Math.max(0, spec | 0);
  if (!spec || typeof spec !== "object") return 0;
  return Math.max(spec.rise ?? 0, spec.fall ?? 0, spec.toff ?? 0) | 0;
}
