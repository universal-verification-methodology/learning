/**
 * UDP table matching / evaluation (IEEE 1364).
 * Pure helpers — no parser/sim imports. See V6_UDP.md.
 */

import { Value } from "./value.js";

/** Normalize a scalar bit for matching (z → x per IEEE UDP). */
export function udpNormBit(b) {
  const c = String(b || "x").toLowerCase();
  if (c === "0" || c === "1") return c;
  return "x"; // z and others
}

/**
 * Expand a table field token into a matcher.
 * Level: "0"|"1"|"x"|"?"|"b"
 * Edge: { edge: true, from, to } where from/to are 0|1|x|?
 * Special: { anyEdge: true } for *, { hold: true } for - (next-state only)
 */
export function parseUdpField(tok) {
  const t = String(tok).trim();
  if (!t) throw new Error("Empty UDP table field");
  if (t === "-") return { hold: true };
  if (t === "*") return { anyEdge: true };
  if (t === "r") return { edge: true, from: "0", to: "1" };
  if (t === "f") return { edge: true, from: "1", to: "0" };
  if (t === "p") {
    // 01, 0x, x1
    return {
      edgeAny: [
        { from: "0", to: "1" },
        { from: "0", to: "x" },
        { from: "x", to: "1" },
      ],
    };
  }
  if (t === "n") {
    return {
      edgeAny: [
        { from: "1", to: "0" },
        { from: "1", to: "x" },
        { from: "x", to: "0" },
      ],
    };
  }
  const m = /^\(([01xX?])([01xX?])\)$/.exec(t);
  if (m) {
    return {
      edge: true,
      from: m[1].toLowerCase() === "?" ? "?" : m[1].toLowerCase(),
      to: m[2].toLowerCase() === "?" ? "?" : m[2].toLowerCase(),
    };
  }
  const ch = t.toLowerCase();
  if (ch === "0" || ch === "1" || ch === "x" || ch === "?" || ch === "b") {
    return { level: ch === "b" ? "b" : ch };
  }
  throw new Error(`Invalid UDP table symbol '${tok}'`);
}

function levelMatches(spec, bit) {
  const b = udpNormBit(bit);
  if (spec === "?") return true;
  if (spec === "b") return b === "0" || b === "1";
  if (spec === "x") return b === "x";
  return spec === b;
}

function edgeFromToMatches(fromSpec, toSpec, prev, cur) {
  const p = udpNormBit(prev);
  const c = udpNormBit(cur);
  const fromOk = fromSpec === "?" ? true : fromSpec === p;
  const toOk = toSpec === "?" ? true : toSpec === c;
  return fromOk && toOk && p !== c;
}

function fieldMatches(field, prev, cur) {
  if (field.level != null) {
    // Level field: current value only (edges ignored)
    return levelMatches(field.level, cur);
  }
  if (field.anyEdge) {
    return udpNormBit(prev) !== udpNormBit(cur);
  }
  if (field.edgeAny) {
    return field.edgeAny.some((e) => edgeFromToMatches(e.from, e.to, prev, cur));
  }
  if (field.edge) {
    return edgeFromToMatches(field.from, field.to, prev, cur);
  }
  if (field.hold) return false; // hold only valid as next-state
  return false;
}

function stateMatches(field, state) {
  if (field.level != null) return levelMatches(field.level, state);
  return false;
}

/**
 * @param {object} def compiled UDP { sequential, inputs: string[], output, rows, initial? }
 * @param {string[]} inputBits current input bits (length = inputs)
 * @param {{ prevInputs?: string[], state?: string }|null} inst
 * @returns {{ bit: string, nextState?: string }}
 */
export function evalUdp(def, inputBits, inst = null) {
  const n = def.inputs.length;
  if (inputBits.length !== n) {
    throw new Error(`UDP '${def.name}' expects ${n} inputs, got ${inputBits.length}`);
  }
  const prev = inst?.prevInputs || inputBits.map(() => "x");
  const curState = udpNormBit(inst?.state ?? def.initial ?? "x");

  for (const row of def.rows) {
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (!fieldMatches(row.inputs[i], prev[i] ?? "x", inputBits[i])) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (def.sequential) {
      if (!stateMatches(row.curr, curState)) continue;
      if (row.next.hold) {
        return { bit: curState, nextState: curState };
      }
      if (row.next.level != null) {
        const out = row.next.level === "?" || row.next.level === "b" ? "x" : row.next.level;
        return { bit: out, nextState: out };
      }
      return { bit: "x", nextState: "x" };
    }
    // combinational
    if (row.out.level != null) {
      const out = row.out.level === "?" || row.out.level === "b" ? "x" : row.out.level;
      return { bit: out };
    }
    return { bit: "x" };
  }
  return { bit: "x", nextState: def.sequential ? "x" : undefined };
}

export function valueFromUdpBit(bit) {
  return new Value(udpNormBit(bit));
}

/**
 * Compile parsed table rows into matcher rows.
 * @param {object} udpAst
 */
export function compileUdp(udpAst) {
  const sequential = !!udpAst.sequential;
  const rows = [];
  for (const raw of udpAst.rows) {
    if (sequential) {
      if (!raw.curr || !raw.next) {
        throw new Error(`UDP '${udpAst.name}': sequential row needs current and next state`);
      }
      rows.push({
        inputs: raw.inputs.map(parseUdpField),
        curr: parseUdpField(raw.curr),
        next: parseUdpField(raw.next),
      });
    } else {
      rows.push({
        inputs: raw.inputs.map(parseUdpField),
        out: parseUdpField(raw.out),
      });
    }
  }
  let initial = null;
  if (udpAst.initial != null) {
    const v = String(udpAst.initial).toLowerCase();
    initial = v === "0" || v === "1" ? v : "x";
  }
  return {
    name: udpAst.name,
    sequential,
    inputs: udpAst.inputs.slice(),
    output: udpAst.output,
    initial,
    rows,
  };
}
