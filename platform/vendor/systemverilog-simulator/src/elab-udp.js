/**
 * UDP elaboration — register primitives and lower instances to UdpCall assigns.
 * Modularity V6 — see V6_UDP.md / MODULARITY.md.
 */

import { compileUdp } from "./udp.js";
import { DEFAULT_STRENGTH } from "./value.js";

/**
 * @param {{
 *   assigns: object[],
 *   udps: Map<string, object>,
 *   signals: Map<string, object>,
 *   fullName: (path: string, name: string) => string,
 *   rewriteExpr: Function,
 *   rewriteLValue: Function,
 *   evalConstInt: Function,
 * }} ctx
 */
export function createUdpLowering(ctx) {
  const {
    assigns,
    udps,
    signals,
    fullName,
    rewriteExpr,
    rewriteLValue,
    evalConstInt,
  } = ctx;

  let anonSeq = 0;

  function registerUdp(ast) {
    if (udps.has(ast.name)) {
      throw new Error(`Duplicate UDP '${ast.name}'`);
    }
    udps.set(ast.name, compileUdp(ast));
  }

  function registerUdps(list) {
    for (const u of list || []) registerUdp(u);
  }

  function termToLValue(term) {
    if (term.type === "Ident") {
      return { type: "LValue", name: term.name, select: term.select || null };
    }
    if (term.type === "BitSelect" && term.expr.type === "Ident") {
      return {
        type: "LValue",
        name: term.expr.name,
        select: { type: "Bit", index: term.index },
      };
    }
    if (term.type === "PartSelect" && term.expr.type === "Ident") {
      return {
        type: "LValue",
        name: term.expr.name,
        select: { type: "Part", hi: term.hi, lo: term.lo },
      };
    }
    throw new Error("UDP output must be a net identifier (optional bit select)");
  }

  function bitSelectTerm(expr, bitIndex, arraySize, path) {
    if (expr.type === "Ident" && !expr.select) {
      const key = fullName(path, expr.name);
      const s = signals.get(key) || signals.get(expr.name);
      const w = s?.width ?? 1;
      if (w === arraySize && arraySize > 1) {
        return {
          type: "BitSelect",
          expr,
          index: { type: "Number", value: bitIndex },
        };
      }
      return expr;
    }
    return expr;
  }

  function pushOneUdp(def, cell, delay, name, terminals, declPath, refPath, portMap, params) {
    if (terminals.length !== def.inputs.length + 1) {
      throw new Error(
        `UDP '${cell}' expects ${def.inputs.length + 1} terminals, got ${terminals.length}`
      );
    }
    const terms = terminals.map((t) => rewriteExpr(t, refPath, portMap, params));
    const lhs = termToLValue(terms[0]);
    const inputs = terms.slice(1);
    const instKey = fullName(declPath, name || `__udp${anonSeq++}`);
    assigns.push({
      lhs,
      rhs: {
        type: "UdpCall",
        udp: cell,
        inputs,
        instKey,
        sequential: def.sequential,
      },
      delay: delay || 0,
      strength: DEFAULT_STRENGTH,
    });
  }

  function expandAndPushUdp(item, declPath, refPath, portMap, params) {
    const def = udps.get(item.cell);
    if (!def) throw new Error(`Unknown UDP '${item.cell}'`);

    for (const inst of item.instances) {
      if (inst.named) {
        throw new Error(`UDP '${item.cell}' does not support named port connections yet`);
      }
      if (inst.range) {
        const msb = evalConstInt(inst.range.msb, params);
        const lsb = evalConstInt(inst.range.lsb, params);
        const arraySize = Math.abs(msb - lsb) + 1;
        const step = msb >= lsb ? -1 : 1;
        for (let i = msb; ; i += step) {
          const terminals = inst.terminals.map((t) =>
            bitSelectTerm(t, i, arraySize, refPath)
          );
          const iname = inst.name != null ? `${inst.name}[${i}]` : null;
          pushOneUdp(
            def,
            item.cell,
            item.delay,
            iname,
            terminals,
            declPath,
            refPath,
            portMap,
            params
          );
          if (i === lsb) break;
        }
      } else {
        pushOneUdp(
          def,
          item.cell,
          item.delay,
          inst.name,
          inst.terminals,
          declPath,
          refPath,
          portMap,
          params
        );
      }
    }
  }

  return { registerUdp, registerUdps, expandAndPushUdp };
}
