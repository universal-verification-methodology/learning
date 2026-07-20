/**
 * Config / library elaboration — resolveCell for Instance and CellInst.
 * Modularity V8 — see V8_CONFIG.md.
 */

import {
  buildLibraryTable,
  selectConfig,
  resolveBinding,
  resolveTopName,
} from "./config.js";
import { compileUdp } from "./udp.js";

/**
 * @param {{
 *   design: object,
 *   opts: { top?: string, config?: string },
 *   udps: Map<string, object>,
 * }} ctx
 */
export function createConfigResolver(ctx) {
  const { design, opts, udps } = ctx;
  const libs = buildLibraryTable(design);
  const config = selectConfig(design, opts.config);
  const topName = resolveTopName(design, opts, config);

  // Seed compiled UDP map with unique lib.cell keys (+ bare name for work)
  for (const [lib, bucket] of libs) {
    for (const [cell, hit] of bucket) {
      if (hit.kind !== "udp") continue;
      const compiled = compileUdp(hit.ast);
      const key = `${lib}.${cell}`;
      udps.set(key, compiled);
      if (lib === "work") udps.set(cell, compiled);
    }
  }

  /**
   * @param {string} parentPath hierarchy path of parent module
   * @param {string|null} instName instance name (null for anonymous)
   * @param {string} cellName
   */
  function resolveCell(parentPath, instName, cellName) {
    const hier =
      instName != null && instName !== ""
        ? parentPath
          ? `${parentPath}.${instName}`
          : instName
        : parentPath || "";
    return resolveBinding(libs, config, hier, cellName);
  }

  function resolveModule(parentPath, instName, cellName) {
    const hit = resolveCell(parentPath, instName, cellName);
    if (hit.kind !== "module") {
      throw new Error(`Cell '${cellName}' is a UDP, not a module`);
    }
    return hit.ast;
  }

  function resolveUdpKey(parentPath, instName, cellName) {
    const hit = resolveCell(parentPath, instName, cellName);
    if (hit.kind !== "udp") {
      throw new Error(`Cell '${cellName}' is a module, not a UDP`);
    }
    return hit.key;
  }

  /** Flat name map for work library (compat helpers / packages). */
  function workModulesByName() {
    const m = new Map();
    const work = libs.get("work");
    if (work) {
      for (const [n, hit] of work) {
        if (hit.kind === "module") m.set(n, hit.ast);
      }
    }
    for (const [, bucket] of libs) {
      for (const [n, hit] of bucket) {
        if (hit.kind === "module" && !m.has(n)) m.set(n, hit.ast);
      }
    }
    return m;
  }

  function getTopModule() {
    if (config?.design) {
      const lib = config.design.lib || "work";
      const cell = config.design.cell;
      const bucket = libs.get(lib);
      if (!bucket || !bucket.has(cell)) {
        throw new Error(`Config design '${lib}.${cell}' not found`);
      }
      const hit = bucket.get(cell);
      if (hit.kind !== "module") throw new Error(`Config design '${cell}' is not a module`);
      return hit.ast;
    }
    const byName = workModulesByName();
    const top = byName.get(topName);
    if (!top) throw new Error(`Top module '${topName}' not found`);
    return top;
  }

  return {
    libs,
    config,
    topName,
    resolveCell,
    resolveModule,
    resolveUdpKey,
    workModulesByName,
    getTopModule,
  };
}
