/** Simulation time-unit helpers (femtoseconds). */

export const UNIT_FS = {
  s: 1e15,
  ms: 1e12,
  us: 1e9,
  ns: 1e6,
  ps: 1e3,
  fs: 1,
};

/**
 * @param {{ value: number, unit?: string|null }} lit
 * @returns {number} femtoseconds
 */
export function timeLiteralToFs(lit) {
  if (!lit || lit.value == null) return 0;
  if (!lit.unit) return lit.value; // dimensionless steps
  const m = UNIT_FS[lit.unit];
  if (!m) throw new Error(`Unknown time unit '${lit.unit}'`);
  return lit.value * m;
}

/**
 * @param {object|null} timeCtx
 * @returns {{ timeunitFs: number, timeprecisionFs: number }}
 */
export function normalizeTimeCtx(timeCtx) {
  let timeunitFs = timeCtx?.timeunitFs ?? null;
  let timeprecisionFs = timeCtx?.timeprecisionFs ?? null;
  if (timeunitFs == null && timeprecisionFs == null) {
    return { timeunitFs: 1, timeprecisionFs: 1, dimensionless: true };
  }
  if (timeunitFs == null) timeunitFs = timeprecisionFs;
  if (timeprecisionFs == null) timeprecisionFs = timeunitFs;
  return { timeunitFs, timeprecisionFs, dimensionless: false };
}

/**
 * Convert a delay spec to integer simulation ticks.
 * @param {number|{value:number,unit:string}|{rise:number,fall:number,toff?:number}} spec
 * @param {object|null} timeCtx
 */
export function delaySpecToTicks(spec, timeCtx = null) {
  const ctx = normalizeTimeCtx(timeCtx);
  if (typeof spec === "number") {
    if (ctx.dimensionless) return Math.max(0, Math.round(spec));
    return Math.max(0, Math.round((spec * ctx.timeunitFs) / ctx.timeprecisionFs));
  }
  if (spec && typeof spec === "object" && "value" in spec) {
    if (!spec.unit) {
      if (ctx.dimensionless) return Math.max(0, spec.value | 0);
      return Math.max(0, Math.round((spec.value * ctx.timeunitFs) / ctx.timeprecisionFs));
    }
    const fs = timeLiteralToFs(spec);
    return Math.max(0, Math.round(fs / ctx.timeprecisionFs));
  }
  if (spec && typeof spec === "object" && ("rise" in spec || "fall" in spec)) {
    const rise = spec.rise ?? 0;
    const fall = spec.fall ?? rise;
    const toff = spec.toff ?? fall;
    return Math.max(0, rise | 0, fall | 0, toff | 0);
  }
  return 0;
}
