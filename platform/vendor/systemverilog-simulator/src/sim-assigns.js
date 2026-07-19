/**
 * Continuous assign update, multi-driver resolve, switch contrib, NBA apply.
 * Extracted from sim.js (modularity M4). See MODULARITY.md.
 */

import { Value } from "./value.js";
import { applyLValue } from "./eval-expr.js";
import {
  logicalToBit,
  resolveValuesWithStrength,
  pickTransportDelay,
  DEFAULT_STRENGTH,
  reduceRails,
  emptyRails,
  STRENGTH_LEVEL,
} from "./value.js";

/**
 * @param {{
 *   netlist: { assigns: object[] },
 *   signals: Map<string, object>,
 *   procAssigns: Map<string, object>,
 *   ev: (expr: object) => any,
 *   delayNum: (spec: any) => number,
 *   schedule: (delay: number, fn: Function) => void,
 *   settle: () => void,
 *   logSignal: (name: string) => void,
 *   forceBits: Map<string, (string|null)[]>,
 *   isFullyForced: (name: string) => boolean,
 *   mergeForce: (name: string, value: Value) => Value,
 *   markPendingEdges: () => void,
 *   drainNba: () => { lhs: object, value: Value }[],
 *   prevBits: Map<string, string>,
 * }} ctx
 */
export function createAssignEngine(ctx) {
  const {
    netlist,
    signals,
    procAssigns,
    ev,
    delayNum,
    schedule,
    settle,
    logSignal,
    forceBits,
    isFullyForced,
    mergeForce,
    markPendingEdges,
    drainNba,
    prevBits,
  } = ctx;

  function evalSwitchContrib(expr) {
    const dataVal = ev(expr.data);
    const width = dataVal.width;
    const zval = Value.zzzz(width);

    function dataRails() {
      // Prefer live net rails when the data net is actually driven
      if (expr.data.type === "Ident" && !expr.data.select) {
        const s = signals.get(expr.data.name);
        if (
          s &&
          s.rails &&
          s.rails.some((r) => (r.s0 | 0) > 0 || (r.s1 | 0) > 0)
        ) {
          return s.rails.map((r) => reduceRails(r, !!expr.resistive));
        }
      }
      // Fallback: strong drive from evaluated bit values (regs / literals)
      return [...dataVal.bits].map((b) => {
        let r;
        if (b === "0") r = { s0: STRENGTH_LEVEL.strong, s1: 0 };
        else if (b === "1") r = { s0: 0, s1: STRENGTH_LEVEL.strong };
        else if (b === "l") r = { s0: STRENGTH_LEVEL.strong, s1: 0, forceX: true };
        else if (b === "h") r = { s0: 0, s1: STRENGTH_LEVEL.strong, forceX: true };
        else if (b === "x")
          r = { s0: STRENGTH_LEVEL.strong, s1: STRENGTH_LEVEL.strong, forceX: true };
        else r = emptyRails();
        return reduceRails(r, !!expr.resistive);
      });
    }

    if (expr.sense === "always" || !expr.en) {
      return { value: dataVal.clone(), railsPerBit: dataRails() };
    }
    const en = logicalToBit(ev(expr.en));
    const on = expr.sense === "n" ? "1" : "0";
    const off = expr.sense === "n" ? "0" : "1";
    if (en.bits === off) {
      return {
        value: zval,
        railsPerBit: Array.from({ length: width }, () => emptyRails()),
      };
    }
    if (en.bits === on) {
      return { value: dataVal.clone(), railsPerBit: dataRails() };
    }
    // Control X → H/L passthrough
    let out = "";
    for (let i = 0; i < width; i++) {
      const b = dataVal.bits[i];
      if (b === "1") out += "h";
      else if (b === "0") out += "l";
      else out += "x";
    }
    const rails = dataRails().map((r) => ({ ...r, forceX: true }));
    return { value: new Value(out), railsPerBit: rails };
  }

  function applyResolvedNet(name) {
    const s = signals.get(name);
    if (!s) return false;
    /** @type {object[]} */
    const contribs = [];
    let anyActive = false;
    for (const a of netlist.assigns) {
      if (a.lhs.select || a.lhs.name !== name) continue;
      const val = a._contrib || Value.zzzz(s.width);
      if (a._railsPerBit) {
        contribs.push({ value: val, railsPerBit: a._railsPerBit });
      } else {
        contribs.push({
          value: val,
          strength: a.strength || DEFAULT_STRENGTH,
        });
      }
      if (val.bits && /[01xhl]/i.test(val.bits)) anyActive = true;
    }
    for (const [, pa] of procAssigns) {
      if (pa.lhs.select || pa.lhs.name !== name) continue;
      const val = pa._contrib || Value.zzzz(s.width);
      contribs.push({
        value: val,
        strength: pa.strength || DEFAULT_STRENGTH,
      });
      if (val.bits && /[01xhl]/i.test(val.bits)) anyActive = true;
    }
    if (!contribs.length && s.kind !== "trireg") return false;

    const { value: resolved, rails } = resolveValuesWithStrength(
      contribs,
      s.width,
      s.kind,
      s.kind === "trireg"
        ? {
            chargeLevel: s.chargeLevel,
            prevBits: s.value.bits,
            prevRails: s.rails,
          }
        : {}
    );

    if (s.kind === "trireg") {
      const capacitive = !anyActive;
      if (capacitive && !s._capacitive && (s.decay | 0) > 0) {
        const gen = (s._decayGen = (s._decayGen || 0) + 1);
        const capturedGen = gen;
        schedule(s.decay | 0, () => {
          if (s._decayGen !== capturedGen) return;
          if (!s._capacitive) return;
          s.value = Value.xxxx(s.width);
          const ch = s.chargeLevel || 2;
          s.rails = Array.from({ length: s.width }, () => ({
            s0: ch,
            s1: ch,
            forceX: true,
          }));
          logSignal(name);
          markPendingEdges();
          settle();
        });
      }
      if (!capacitive) s._decayGen = (s._decayGen || 0) + 1;
      s._capacitive = capacitive;
    }

    if (s.value.bits === resolved.bits) {
      // still overlay force in case only force changed
      const merged = mergeForce(name, resolved);
      if (s.value.bits !== merged.bits) {
        s.value = merged;
        s.rails = rails;
        logSignal(name);
        return true;
      }
      s.rails = rails;
      return false;
    }
    s.value = mergeForce(name, resolved);
    s.rails = rails;
    logSignal(name);
    return true;
  }

  function updateAssigns() {
    let changed = true;
    let guard = 0;
    while (changed) {
      if (++guard > 1000) throw new Error("Continuous assign oscillation");
      changed = false;

      /** @type {Map<string, object[]>} */
      const netDrivers = new Map();
      /** @type {object[]} */
      const selectAssigns = [];

      for (const a of netlist.assigns) {
        if (a.lhs.select) {
          selectAssigns.push(a);
          continue;
        }
        if (!netDrivers.has(a.lhs.name)) netDrivers.set(a.lhs.name, []);
        netDrivers.get(a.lhs.name).push(a);
      }
      for (const [, pa] of procAssigns) {
        if (pa.lhs.select) {
          selectAssigns.push(pa);
          continue;
        }
        if (!netDrivers.has(pa.lhs.name)) netDrivers.set(pa.lhs.name, []);
        netDrivers.get(pa.lhs.name).push(pa);
      }

      // Update driver contributions (with optional transport delay)
      for (const [, drivers] of netDrivers) {
        for (const a of drivers) {
          if (!a.lhs.select && isFullyForced(a.lhs.name)) continue;
          let val;
          let railsPerBit = null;
          if (a.switchPass && a.rhs && a.rhs.type === "SwitchPass") {
            const sw = evalSwitchContrib(a.rhs);
            val = sw.value;
            railsPerBit = sw.railsPerBit;
          } else {
            val = ev(a.rhs);
          }
          const bits = val.bits;
          const delaySpec = a.delay || 0;
          const hasDelay =
            (typeof delaySpec === "number" && delaySpec > 0) ||
            (delaySpec && typeof delaySpec === "object");

          if (hasDelay && delayNum(delaySpec) > 0) {
            if (a._lastRhs === bits) continue;
            a._lastRhs = bits;
            const captured = val.clone();
            const capturedRails = railsPerBit;
            const prevContrib = a._contrib ? a._contrib.bits : Value.zzzz(captured.width).bits;
            const dly = pickTransportDelay(delaySpec, prevContrib, bits);
            // Inertial delay: cancel any previously scheduled update for this driver
            const gen = (a._delayGen = (a._delayGen || 0) + 1);
            const capturedGen = gen;
            schedule(dly, () => {
              if (a._delayGen !== capturedGen) return;
              if (!a.lhs.select && isFullyForced(a.lhs.name)) return;
              a._contrib = captured;
              a._railsPerBit = capturedRails;
              if (applyResolvedNet(a.lhs.name)) markPendingEdges();
              settle();
            });
            continue;
          }
          a._contrib = val.clone();
          a._railsPerBit = railsPerBit;
        }
      }

      // Resolve all multi-driver nets
      for (const name of netDrivers.keys()) {
        if (isFullyForced(name)) continue;
        if (applyResolvedNet(name)) {
          changed = true;
          markPendingEdges();
        }
      }

      // Bit/part-select continuous assigns (single-driver path)
      for (const a of selectAssigns) {
        if (!a.rhs) continue;
        if (!a.lhs.select && isFullyForced(a.lhs.name)) continue;
        const v = ev(a.rhs);
        const delaySpec = a.delay || 0;
        if (delayNum(delaySpec) > 0) {
          const bits = v.bits;
          if (a._lastRhs === bits) continue;
          a._lastRhs = bits;
          const captured = v.clone();
          const lhs = a.lhs;
          const prev = signals.get(lhs.name)?.value.bits || "";
          const dly = pickTransportDelay(delaySpec, prev, bits);
          const gen = (a._delayGen = (a._delayGen || 0) + 1);
          const capturedGen = gen;
          schedule(dly, () => {
            if (a._delayGen !== capturedGen) return;
            if (!lhs.select && isFullyForced(lhs.name)) return;
            const before = signals.get(lhs.name)?.value.bits;
            applyLValue(lhs, captured, signals);
            if (forceBits.has(lhs.name)) {
              const s = signals.get(lhs.name);
              if (s) s.value = mergeForce(lhs.name, s.value);
            }
            logSignal(lhs.name);
            if (signals.get(lhs.name)?.value.bits !== before) markPendingEdges();
            settle();
          });
          continue;
        }
        const before = signals.get(a.lhs.name)?.value.bits;
        applyLValue(a.lhs, v, signals);
        if (forceBits.has(a.lhs.name)) {
          const s = signals.get(a.lhs.name);
          if (s) s.value = mergeForce(a.lhs.name, s.value);
        }
        logSignal(a.lhs.name);
        if (signals.get(a.lhs.name)?.value.bits !== before) {
          changed = true;
          markPendingEdges();
        }
      }
    }
  }

  function applyNBAs() {
    const bucket = drainNba();
    if (!bucket.length) return false;
    for (const n of bucket) {
      if (!n.lhs.select && isFullyForced(n.lhs.name)) continue;
      const before = signals.get(n.lhs.name)?.value.bit(0);
      applyLValue(n.lhs, n.value, signals);
      if (forceBits.has(n.lhs.name)) {
        const s = signals.get(n.lhs.name);
        if (s && !s.isHandle) s.value = mergeForce(n.lhs.name, s.value);
      }
      logSignal(n.lhs.name);
      const after = signals.get(n.lhs.name)?.value.bit(0);
      if (before !== after) {
        prevBits.set(n.lhs.name, before ?? "x");
        markPendingEdges();
      }
    }
    return true;
  }

  return {
    updateAssigns,
    applyResolvedNet,
    applyNBAs,
    evalSwitchContrib,
  };
}
