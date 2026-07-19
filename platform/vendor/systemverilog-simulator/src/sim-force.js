/**
 * Force / release bit overlay.
 * Extracted from sim.js (modularity M3). See MODULARITY.md.
 */

import { Value } from "./value.js";

/**
 * @param {{
 *   signals: Map<string, object>,
 *   ev: (expr: object) => any,
 * }} ctx
 */
export function createForceOverlay(ctx) {
  const { signals, ev } = ctx;

  /** @type {Map<string, (string|null)[]>} per-bit force overlay (MSB-first, null = not forced) */
  const forceBits = new Map();

  function forceMask(name) {
    return forceBits.get(name) || null;
  }

  function isFullyForced(name) {
    const s = signals.get(name);
    const m = forceMask(name);
    return !!(s && m && m.length === s.width && m.every((b) => b != null));
  }

  function mergeForce(name, value) {
    const m = forceMask(name);
    if (!m) return value;
    const bits = value.bits.split("");
    for (let i = 0; i < m.length && i < bits.length; i++) {
      if (m[i] != null) bits[i] = m[i];
    }
    return new Value(bits.join(""));
  }

  function ensureForceMask(name, width) {
    let m = forceBits.get(name);
    if (!m || m.length !== width) {
      m = Array.from({ length: width }, () => null);
      forceBits.set(name, m);
    }
    return m;
  }

  function setForceOverlay(lhs, v) {
    const s = signals.get(lhs.name);
    if (!s || s.isHandle) throw new Error(`Cannot force '${lhs.name}'`);
    const mask = ensureForceMask(lhs.name, s.width);
    if (!lhs.select) {
      const bits = v.resize(s.width).bits;
      for (let i = 0; i < s.width; i++) mask[i] = bits[i];
      return;
    }
    if (lhs.select.type === "Bit") {
      const i = Number(ev(lhs.select.index).toUint());
      const pos = s.width - 1 - i;
      if (pos >= 0 && pos < s.width) mask[pos] = v.resize(1).bits[0];
      return;
    }
    const hi = Number(ev(lhs.select.hi).toUint());
    const lo = Number(ev(lhs.select.lo).toUint());
    const w = hi - lo + 1;
    const piece = v.resize(w).bits;
    for (let i = 0; i < w; i++) {
      const bitIndex = hi - i;
      const pos = s.width - 1 - bitIndex;
      if (pos >= 0 && pos < s.width) mask[pos] = piece[i];
    }
  }

  function clearForceOverlay(lhs) {
    const s = signals.get(lhs.name);
    if (!s) return;
    const mask = forceMask(lhs.name);
    if (!mask) return;
    if (!lhs.select) {
      forceBits.delete(lhs.name);
      return;
    }
    if (lhs.select.type === "Bit") {
      const i = Number(ev(lhs.select.index).toUint());
      const pos = s.width - 1 - i;
      if (pos >= 0 && pos < s.width) mask[pos] = null;
    } else {
      const hi = Number(ev(lhs.select.hi).toUint());
      const lo = Number(ev(lhs.select.lo).toUint());
      for (let bitIndex = lo; bitIndex <= hi; bitIndex++) {
        const pos = s.width - 1 - bitIndex;
        if (pos >= 0 && pos < s.width) mask[pos] = null;
      }
    }
    if (mask.every((b) => b == null)) forceBits.delete(lhs.name);
  }

  return {
    forceBits,
    isFullyForced,
    mergeForce,
    setForceOverlay,
    clearForceOverlay,
  };
}
