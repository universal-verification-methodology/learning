/**
 * Teaching helpers for concept labs (truth tables, gate labs, …).
 * Builds a tiny continuous-assign module and evaluates via the real sim core.
 */

import { parse } from "./parser.js";
import { elaborate } from "./elaborate.js";
import { createSim } from "./sim.js";

function compile(source, opts = {}) {
  const ast = parse(source);
  const net = elaborate(ast, { top: opts.top });
  const sim = createSim(net);
  return { ast, net, sim };
}

/**
 * Map teaching-boolean sugar to Verilog-ish operators the subset parser accepts.
 * Keeps identifier names (does not substitute 0/1).
 *
 * @param {string} expr
 * @param {string[]} names
 * @returns {string}
 */
export function normalizeTeachingBoolExpr(expr, names) {
  let s = String(expr).trim();
  if (!s) throw new Error("Empty expression");

  s = s.replace(/·/g, "&").replace(/\*/g, "&").replace(/\+/g, "|");
  // Teaching "not" often written !; Verilog also accepts ~ for bitwise.
  s = s.replace(/!/g, "~");

  const sorted = [...names]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return s;

  const escapeRe = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameAlt = sorted.map(escapeRe).join("|");
  const atom = `(?:\\)|\\d+|~?(?:${nameAlt}))`;
  const left = `(?:\\)|\\d+|(?:${nameAlt}))`;
  const right = `(?:\\(|\\d+|~(?:${nameAlt})|(?:${nameAlt}))`;

  // Implicit AND: A B, )(, 1(, A(, )A, etc.
  let prev;
  do {
    prev = s;
    s = s.replace(new RegExp(`(${left})\\s+(${right})`, "g"), "$1 & $2");
    s = s.replace(new RegExp(`(${left})(${right})`, "g"), "$1 & $2");
  } while (s !== prev);

  void atom;
  return s;
}

/**
 * @typedef {{
 *   source: string,
 *   verilogExpr: string,
 *   evalRow: (bits: number[]) => 0|1|"X",
 *   evalAll: () => Array<0|1|"X">,
 * }} CombEvaluator
 */

/**
 * Compile `assign F = <expr>` once; poke inputs per row.
 *
 * @param {string} expr teaching or Verilog boolean expression
 * @param {string[]} names input identifiers (MSB-first order for evalAll)
 * @returns {CombEvaluator}
 */
export function createCombEvaluator(expr, names) {
  if (!Array.isArray(names) || names.length < 1) {
    throw new Error("Need at least one variable name");
  }
  for (const n of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) {
      throw new Error(`Invalid signal name '${n}'`);
    }
  }

  const verilogExpr = normalizeTeachingBoolExpr(expr, names);
  const ports = names.map((n) => `input ${n}`).join(", ");
  const source =
    `module __tt(${ports}, output F);\n` +
    `  assign F = ${verilogExpr};\n` +
    `endmodule\n`;

  let sim;
  try {
    ({ sim } = compile(source, { top: "__tt" }));
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    throw new Error(`HDL engine: ${msg}`);
  }

  /**
   * @param {number[]} bits
   * @returns {0|1|"X"}
   */
  function evalRow(bits) {
    if (!bits || bits.length !== names.length) {
      throw new Error(`Expected ${names.length} bits`);
    }
    for (let i = 0; i < names.length; i++) {
      sim.poke(names[i], bits[i] ? "1" : "0");
    }
    const v = sim.peek("F");
    const bitsStr = v.bits || "";
    if (/[xzXZ]/i.test(bitsStr)) return "X";
    // 1-bit or multi-bit: treat nonzero as 1 (logical).
    return /1/.test(bitsStr) ? 1 : 0;
  }

  function evalAll() {
    const n = names.length;
    const rows = 1 << n;
    const outs = new Array(rows);
    for (let i = 0; i < rows; i++) {
      const rowBits = [];
      for (let b = 0; b < n; b++) rowBits.push((i >> (n - 1 - b)) & 1);
      outs[i] = evalRow(rowBits);
    }
    return outs;
  }

  return { source, verilogExpr, evalRow, evalAll };
}

/**
 * One-shot fill of a truth table column.
 * @param {string} expr
 * @param {string[]} names
 * @returns {Array<0|1|"X">}
 */
export function evalCombTruthTable(expr, names) {
  return createCombEvaluator(expr, names).evalAll();
}

const GATE_ARITY = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
  NAND: 2,
  NOR: 2,
  XNOR: 2,
};

function gateAssignRhs(type, args) {
  const [a, b] = args;
  switch (type) {
    case "NOT":
      return `~(${a})`;
    case "AND":
      return `(${a}) & (${b})`;
    case "OR":
      return `(${a}) | (${b})`;
    case "XOR":
      return `(${a}) ^ (${b})`;
    case "NAND":
      return `~((${a}) & (${b}))`;
    case "NOR":
      return `~((${a}) | (${b}))`;
    case "XNOR":
      return `~((${a}) ^ (${b}))`;
    default:
      throw new Error(`Unknown gate type '${type}'`);
  }
}

function bit01(v) {
  const bitsStr = (v && v.bits) || "";
  if (/[xzXZ]/i.test(bitsStr)) return "X";
  return /1/.test(bitsStr) ? 1 : 0;
}

/**
 * Topo-sort gate ids; edges from gate outputs used as inputs.
 * @param {{ id: string, type: string, ins: string[] }[]} gates
 * @param {string[]} names primary inputs
 */
function topoGateIds(gates, names) {
  const prim = new Set(names);
  const ids = new Set(gates.map((g) => g.id));
  const indeg = new Map();
  const adj = new Map();
  for (const g of gates) {
    indeg.set(g.id, 0);
    adj.set(g.id, []);
  }
  for (const g of gates) {
    const arity = GATE_ARITY[g.type];
    if (!arity) throw new Error(`Unknown gate type '${g.type}'`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(g.id)) {
      throw new Error(`Invalid gate id '${g.id}'`);
    }
    for (const src of g.ins.slice(0, arity)) {
      if (prim.has(src)) continue;
      if (!ids.has(src)) throw new Error(`Gate ${g.id} references unknown ${src}`);
      adj.get(src).push(g.id);
      indeg.set(g.id, indeg.get(g.id) + 1);
    }
  }
  const q = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order = [];
  while (q.length) {
    const id = q.shift();
    order.push(id);
    for (const nxt of adj.get(id)) {
      indeg.set(nxt, indeg.get(nxt) - 1);
      if (indeg.get(nxt) === 0) q.push(nxt);
    }
  }
  if (order.length !== gates.length) throw new Error("Cycle detected in gate wiring");
  return order;
}

/**
 * Compile a gate netlist to continuous assigns; poke primaries; peek all nodes + F.
 *
 * @param {{
 *   names: string[],
 *   gates: { id: string, type: string, ins: string[] }[],
 *   output: string,
 * }} spec
 */
export function createGateNetEvaluator(spec) {
  const names = spec.names || [];
  const gates = spec.gates || [];
  const output = spec.output;
  if (!Array.isArray(names) || names.length < 1) {
    throw new Error("Need at least one primary input name");
  }
  for (const n of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) {
      throw new Error(`Invalid signal name '${n}'`);
    }
  }
  if (!output || typeof output !== "string") {
    throw new Error("Need output signal id");
  }
  const prim = new Set(names);
  const ids = new Set(gates.map((g) => g.id));
  if (!prim.has(output) && !ids.has(output)) {
    throw new Error(`Output '${output}' not found`);
  }

  const order = topoGateIds(gates, names);
  const byId = Object.fromEntries(gates.map((g) => [g.id, g]));
  const ports = names.map((n) => `input ${n}`).join(", ");
  const body = [];
  for (const id of order) {
    const g = byId[id];
    const arity = GATE_ARITY[g.type];
    const args = g.ins.slice(0, arity);
    body.push(`  wire ${id};`);
    body.push(`  assign ${id} = ${gateAssignRhs(g.type, args)};`);
  }
  body.push(`  assign F = ${output};`);
  const source =
    `module __gc(${ports}, output F);\n` + body.join("\n") + `\nendmodule\n`;

  let sim;
  try {
    ({ sim } = compile(source, { top: "__gc" }));
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    throw new Error(`HDL engine: ${msg}`);
  }

  /**
   * @param {Record<string, number>} bitMap primary name → 0|1
   * @returns {{ ok: true, values: Record<string, number|"X">, f: number|"X" } | { ok: false, error: string, values: Record<string, number> }}
   */
  function evalBitMap(bitMap) {
    try {
      for (const n of names) {
        if (!(n in bitMap)) throw new Error(`Missing primary ${n}`);
        sim.poke(n, bitMap[n] ? "1" : "0");
      }
      /** @type {Record<string, number|"X">} */
      const values = { ...bitMap };
      for (const id of order) {
        values[id] = bit01(sim.peek(id));
      }
      const f = bit01(sim.peek("F"));
      return { ok: true, values, f };
    } catch (e) {
      return {
        ok: false,
        error: e && e.message ? e.message : String(e),
        values: { ...bitMap },
      };
    }
  }

  function evalAll() {
    const n = names.length;
    const rows = 1 << n;
    const col = new Array(rows);
    for (let i = 0; i < rows; i++) {
      /** @type {Record<string, number>} */
      const bitMap = {};
      for (let b = 0; b < n; b++) bitMap[names[b]] = (i >> (n - 1 - b)) & 1;
      const r = evalBitMap(bitMap);
      col[i] = r.ok ? r.f : null;
    }
    return col;
  }

  return { source, order, evalBitMap, evalAll };
}
