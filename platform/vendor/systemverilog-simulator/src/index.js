/**
 * browser-hdl-sim — in-browser SystemVerilog subset simulator.
 *
 * Library API: parse → elaborate → createSim → run / poke / peek
 * UVM roadmap (inside this JS engine): see UVM.md
 */

export { Value } from "./value.js";
export { parseLiteral, MAX_W } from "./literal.js";
export { lex } from "./lexer.js";
export { parse } from "./parser.js";
export { elaborate, evalExpr, applyLValue } from "./elaborate.js";
export { createSim } from "./sim.js";
export { preprocess, materializeSources } from "./preprocess.js";
export {
  normalizeTeachingBoolExpr,
  createCombEvaluator,
  evalCombTruthTable,
  createGateNetEvaluator,
} from "./comb-eval.js";
export { createSession } from "./session.js";
export { lintSynthesizability, SYNTH_LINT_RULES } from "./synth-lint.js";

import { parse } from "./parser.js";
import { elaborate } from "./elaborate.js";
import { createSim } from "./sim.js";
import { materializeSources } from "./preprocess.js";

/**
 * @param {string|string[]|object} input
 * @param {{ top?: string, maxTime?: number, files?: Record<string, string>, entry?: string }} [opts]
 */
function toAst(input, opts = {}) {
  const text = materializeSources(input, opts);
  return parse(text);
}

/**
 * One-shot: parse, elaborate, and run until $finish or maxTime.
 * @param {string|string[]|object} source
 * @param {{ top?: string, maxTime?: number, files?: Record<string, string>, entry?: string }} [opts]
 */
export function simulate(source, opts = {}) {
  const ast = toAst(source, opts);
  const net = elaborate(ast, { top: opts.top });
  const sim = createSim(net, { memFiles: opts.memFiles });
  return sim.run({ maxTime: opts.maxTime ?? 1000 });
}

/**
 * Parse + elaborate without running (for UIs that step / poke).
 * @param {string|string[]|object} source
 * @param {{ top?: string, files?: Record<string, string>, entry?: string, memFiles?: Record<string, string> }} [opts]
 */
export function compile(source, opts = {}) {
  const ast = toAst(source, opts);
  const net = elaborate(ast, { top: opts.top });
  const sim = createSim(net, { memFiles: opts.memFiles });
  return { ast, net, sim };
}

/** @param {string|string[]|object} source @param {{ files?: Record<string, string>, entry?: string }} [opts] @returns {string[]} */
export function listModules(source, opts = {}) {
  return toAst(source, opts).modules.map((m) => m.name);
}

