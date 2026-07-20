/**
 * Specify elaboration — register path delays and merge onto assigns.
 * Modularity V7 — see V7_SPECIFY.md.
 */

import {
  compileSpecifyPaths,
  applyPathDelaysToAssigns,
  resolvePathDelay,
} from "./specify.js";

/**
 * @param {{
 *   assigns: object[],
 *   pathDelays: object[],
 *   fullName: (path: string, name: string) => string,
 *   evalConstInt: Function,
 * }} ctx
 */
export function createSpecifyLowering(ctx) {
  const { assigns, pathDelays, fullName, evalConstInt } = ctx;

  /**
   * @param {object} item Specify AST
   * @param {string} path hierarchy path
   * @param {Map<string, string>|null} portMap
   * @param {Map<string, number>} params
   */
  function pushSpecify(item, path, portMap, params) {
    /** @type {Map<string, number>} */
    const env = new Map(params);
    for (const d of item.specparams || []) {
      env.set(d.name, evalConstInt(d.expr, env));
    }

    const compiled = compileSpecifyPaths(item, env);
    for (const pd of compiled) {
      const src = mapNet(pd.src, path, portMap);
      const dst = mapNet(pd.dst, path, portMap);
      pathDelays.push({
        ...pd,
        src,
        dst,
        delay: resolvePathDelay(pd.delay, env),
        modulePath: path,
      });
    }
    // Timing checks: parsed, intentionally no-op this drop
    void item.checks;
  }

  /**
   * Module-level specparam (outside specify) — fold into params map.
   * @param {object} item Specparam AST
   * @param {Map<string, number>} params
   */
  function pushSpecparam(item, params) {
    for (const d of item.decls) {
      params.set(d.name, evalConstInt(d.expr, params));
    }
  }

  function mapNet(localName, path, portMap) {
    if (portMap && portMap.has(localName)) return portMap.get(localName);
    return fullName(path, localName);
  }

  function applyAllPathDelays() {
    applyPathDelaysToAssigns(pathDelays, assigns);
  }

  return { pushSpecify, pushSpecparam, applyAllPathDelays };
}
