/**
 * Specify path-delay helpers (pure).
 * Modularity V7 — see V7_SPECIFY.md.
 */

/**
 * Merge two delay specs with max policy (conservative).
 * @param {any} a
 * @param {any} b
 */
export function mergeDelaySpecs(a, b) {
  if (a == null || a === 0) return b ?? 0;
  if (b == null || b === 0) return a ?? 0;

  const toObj = (d) => {
    if (typeof d === "number") return { rise: d, fall: d };
    if (d && typeof d === "object" && ("rise" in d || "fall" in d)) return d;
    if (d && typeof d === "object" && "value" in d) {
      const n = d.value | 0;
      return { rise: n, fall: n };
    }
    return { rise: 0, fall: 0 };
  };

  if (typeof a === "number" && typeof b === "number") {
    return Math.max(a | 0, b | 0);
  }

  const oa = toObj(a);
  const ob = toObj(b);
  const out = {
    rise: Math.max(oa.rise ?? 0, ob.rise ?? 0) | 0,
    fall: Math.max(oa.fall ?? 0, ob.fall ?? 0) | 0,
  };
  if (oa.toff != null || ob.toff != null) {
    out.toff = Math.max(oa.toff ?? oa.fall ?? 0, ob.toff ?? ob.fall ?? 0) | 0;
  }
  // Collapse uniform rise/fall back to scalar
  if (out.toff == null && out.rise === out.fall) return out.rise;
  return out;
}

/**
 * Resolve a path delay AST/value using specparam/param maps.
 * @param {any} delay
 * @param {Map<string, number>} env
 */
export function resolvePathDelay(delay, env = new Map()) {
  if (delay == null) return 0;
  if (typeof delay === "number") return delay;
  if (delay && typeof delay === "object" && delay.type === "Ident") {
    if (!env.has(delay.name)) {
      throw new Error(`Unknown specparam/parameter '${delay.name}' in path delay`);
    }
    return env.get(delay.name);
  }
  if (delay && typeof delay === "object" && ("rise" in delay || "fall" in delay)) {
    return {
      rise: resolvePathDelay(delay.rise ?? 0, env),
      fall: resolvePathDelay(delay.fall ?? delay.rise ?? 0, env),
      ...(delay.toff != null ? { toff: resolvePathDelay(delay.toff, env) } : {}),
    };
  }
  if (delay && typeof delay === "object" && "value" in delay) return delay;
  return 0;
}

/**
 * Compile Specify AST paths into flat descriptors (local names).
 * @param {object} specifyAst
 * @param {Map<string, number>} env
 */
export function compileSpecifyPaths(specifyAst, env) {
  /** @type {object[]} */
  const out = [];
  for (const p of specifyAst.paths || []) {
    const delay = resolvePathDelay(p.delay, env);
    for (const src of p.sources) {
      for (const dst of p.dests) {
        out.push({
          src,
          dst: dst.name,
          polarity: dst.polarity,
          data: dst.data,
          parallel: p.parallel !== false,
          edge: p.edge || null,
          delay,
        });
      }
    }
  }
  return out;
}

/** @param {object|null} expr @param {string} name */
export function exprMentionsName(expr, name) {
  if (!expr || typeof expr !== "object") return false;
  if (expr.type === "Ident") return expr.name === name;
  if (expr.type === "UdpCall") {
    return (expr.inputs || []).some((i) => exprMentionsName(i, name));
  }
  for (const k of Object.keys(expr)) {
    if (k === "type") continue;
    const v = expr[k];
    if (Array.isArray(v)) {
      if (v.some((x) => exprMentionsName(x, name))) return true;
    } else if (v && typeof v === "object" && v.type) {
      if (exprMentionsName(v, name)) return true;
    }
  }
  return false;
}

/**
 * Apply compiled path delays onto continuous assigns (mutate delay field).
 * @param {object[]} pathDelays hierarchical { src, dst, parallel, delay }
 * @param {object[]} assigns
 */
export function applyPathDelaysToAssigns(pathDelays, assigns) {
  for (const pd of pathDelays) {
    for (const a of assigns) {
      if (!a.lhs || a.lhs.select) continue;
      if (a.lhs.name !== pd.dst) continue;
      // Parallel => requires src in RHS; edge paths and *> annotate the destination
      if (pd.parallel && !pd.edge && !exprMentionsName(a.rhs, pd.src)) continue;
      a.delay = mergeDelaySpecs(a.delay || 0, pd.delay);
      a._pathDelay = true;
    }
  }
}
