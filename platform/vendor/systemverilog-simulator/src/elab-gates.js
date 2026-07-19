/**
 * Gate / continuous-assign / net-decl-assign lowering.
 * Extracted from elaborate.js (modularity M2). See MODULARITY.md.
 *
 * Call createGateAssignLowering(ctx) inside elaborate() with the closed-over
 * netlist builders; returns the push helpers used by elaborateItem / generate.
 */

import {
  strengthPairFromKeywords,
  STRENGTH_LEVEL,
  DEFAULT_STRENGTH,
} from "./value.js";

/** @param {string} kind */
export function isNetDeclKind(kind) {
  return (
    kind === "wire" ||
    kind === "tri" ||
    kind === "wand" ||
    kind === "wor" ||
    kind === "triand" ||
    kind === "trior" ||
    kind === "tri0" ||
    kind === "tri1" ||
    kind === "supply0" ||
    kind === "supply1" ||
    kind === "pull0" ||
    kind === "pull1" ||
    kind === "trireg"
  );
}

/**
 * @param {{
 *   assigns: object[],
 *   signals: Map<string, object>,
 *   fullName: (path: string, name: string) => string,
 *   rewriteExpr: Function,
 *   rewriteLValue: Function,
 *   evalConstInt: Function,
 *   resolveWidth: Function,
 * }} ctx
 */
export function createGateAssignLowering(ctx) {
  const {
    assigns,
    signals,
    fullName,
    rewriteExpr,
    rewriteLValue,
    evalConstInt,
    resolveWidth,
  } = ctx;

  function resolveItemStrength(item) {
    if (!item.strength) return DEFAULT_STRENGTH;
    if (item.strength.single) {
      return strengthPairFromKeywords(item.strength.s1, null, { single: true });
    }
    return strengthPairFromKeywords(item.strength.s1, item.strength.s0);
  }

  /** Convert a gate output expression to an LValue. */
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
    throw new Error("Gate/switch output must be a net identifier (optional bit select)");
  }

  function bitSelectTerm(expr, bitIndex, arraySize, path) {
    if (expr.type === "Ident" && !expr.select) {
      const key = fullName(path, expr.name);
      const s = signals.get(key) || signals.get(expr.name);
      const w = s?.width ?? 1;
      // Vector matching array size → per-instance bit; scalar/shared otherwise
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

  function expandAndPushGate(item, declPath, refPath, portMap, params) {
    if (item.type === "GateList") {
      for (const inst of item.instances) {
        if (inst.range) {
          const msb = evalConstInt(inst.range.msb, params);
          const lsb = evalConstInt(inst.range.lsb, params);
          const arraySize = Math.abs(msb - lsb) + 1;
          const step = msb >= lsb ? -1 : 1;
          for (let i = msb; ; i += step) {
            const terminals = inst.terminals.map((t) =>
              bitSelectTerm(t, i, arraySize, refPath)
            );
            pushGateAssign(
              {
                type: "Gate",
                gate: item.gate,
                delay: item.delay,
                strength: item.strength,
                name: inst.name ? `${inst.name}[${i}]` : null,
                terminals,
              },
              declPath,
              refPath,
              portMap,
              params
            );
            if (i === lsb) break;
          }
        } else {
          pushGateAssign(
            {
              type: "Gate",
              gate: item.gate,
              delay: item.delay,
              strength: item.strength,
              name: inst.name,
              terminals: inst.terminals,
            },
            declPath,
            refPath,
            portMap,
            params
          );
        }
      }
      return;
    }
    pushGateAssign(item, declPath, refPath, portMap, params);
  }

  function pushContinuousAssign(item, path, portMap, params) {
    if (item.type === "ContinuousAssignList") {
      for (const a of item.assigns) {
        assigns.push({
          lhs: rewriteLValue(a.lhs, path, portMap, params),
          rhs: rewriteExpr(a.rhs, path, portMap, params),
          delay: item.delay || 0,
          strength: resolveItemStrength(item),
        });
      }
      return;
    }
    assigns.push({
      lhs: rewriteLValue(item.lhs, path, portMap, params),
      rhs: rewriteExpr(item.rhs, path, portMap, params),
      delay: item.delay || 0,
      strength: resolveItemStrength(item),
    });
  }

  function pushGateAssign(item, declPath, refPath, portMap, params) {
    const terms = item.terminals.map((t) => rewriteExpr(t, refPath, portMap, params));
    const g = item.gate;
    let strength = resolveItemStrength(item);

    // Bidirectional tran*: two SwitchPass assigns
    if (
      g === "tran" ||
      g === "rtran" ||
      g === "tranif0" ||
      g === "tranif1" ||
      g === "rtranif0" ||
      g === "rtranif1"
    ) {
      const a = terms[0];
      const b = terms[1];
      if (a.type !== "Ident" || b.type !== "Ident") {
        throw new Error(`${g} terminals must be net identifiers`);
      }
      const resistive = g.startsWith("r");
      let en = null;
      let sense = "always";
      if (g === "tranif1" || g === "rtranif1") {
        en = terms[2];
        sense = "n";
      } else if (g === "tranif0" || g === "rtranif0") {
        en = terms[2];
        sense = "p";
      }
      const mk = (lhsName, dataExpr) => ({
        lhs: { type: "LValue", name: lhsName, select: null },
        rhs: {
          type: "SwitchPass",
          data: dataExpr,
          en,
          sense,
          resistive,
        },
        delay: item.delay || 0,
        strength: DEFAULT_STRENGTH,
        switchPass: true,
      });
      assigns.push(mk(a.name, b));
      assigns.push(mk(b.name, a));
      return;
    }

    // buf / not: one or more outputs, last terminal is input
    if (g === "buf" || g === "not") {
      if (terms.length < 2) throw new Error(`${g} requires output(s) and one input`);
      const inputs = terms.slice(0, -1);
      const dataIn = terms[terms.length - 1];
      const rhs =
        g === "not" ? { type: "Unary", op: "~", expr: dataIn } : dataIn;
      for (const outTerm of inputs) {
        const lhs = termToLValue(outTerm);
        assigns.push({ lhs, rhs, delay: item.delay || 0, strength });
      }
      return;
    }

    const out = terms[0];
    const inputs = terms.slice(1);
    const lhs = termToLValue(out);
    let rhs;
    if (g === "pullup") {
      if (inputs.length) throw new Error("pullup takes a single net");
      rhs = { type: "Literal", raw: "1'b1" };
      if (!item.strength) strength = { one: STRENGTH_LEVEL.pull, zero: STRENGTH_LEVEL.highz };
      else if (item.strength.single) {
        strength = strengthPairFromKeywords(item.strength.s1, null, { single: true });
      }
    } else if (g === "pulldown") {
      if (inputs.length) throw new Error("pulldown takes a single net");
      rhs = { type: "Literal", raw: "1'b0" };
      if (!item.strength) strength = { one: STRENGTH_LEVEL.highz, zero: STRENGTH_LEVEL.pull };
      else if (item.strength.single) {
        strength = strengthPairFromKeywords(item.strength.s1, null, { single: true });
      }
    } else if (g === "bufif0" || g === "bufif1" || g === "notif0" || g === "notif1") {
      if (inputs.length !== 2) throw new Error(`${g} requires data and control`);
      const data = inputs[0];
      const ctrl = inputs[1];
      rhs = {
        type: "TriBuf",
        data,
        ctrl,
        invertData: g === "notif0" || g === "notif1",
        activeLow: g === "bufif0" || g === "notif0",
      };
    } else if (g === "nmos" || g === "pmos" || g === "rnmos" || g === "rpmos") {
      if (inputs.length !== 2) throw new Error(`${g} requires data and control`);
      rhs = {
        type: "SwitchPass",
        data: inputs[0],
        en: inputs[1],
        sense: g.includes("pmos") ? "p" : "n",
        resistive: g.startsWith("r"),
      };
    } else if (g === "cmos" || g === "rcmos") {
      if (inputs.length !== 3) throw new Error(`${g} requires data, n-control, p-control`);
      const resistive = g === "rcmos";
      assigns.push({
        lhs,
        rhs: {
          type: "SwitchPass",
          data: inputs[0],
          en: inputs[1],
          sense: "n",
          resistive,
        },
        delay: item.delay || 0,
        strength: DEFAULT_STRENGTH,
        switchPass: true,
      });
      assigns.push({
        lhs,
        rhs: {
          type: "SwitchPass",
          data: inputs[0],
          en: inputs[2],
          sense: "p",
          resistive,
        },
        delay: item.delay || 0,
        strength: DEFAULT_STRENGTH,
        switchPass: true,
      });
      return;
    } else {
      if (!inputs.length) throw new Error(`${g} requires inputs`);
      const op =
        g === "and" || g === "nand"
          ? "&"
          : g === "or" || g === "nor"
            ? "|"
            : g === "xor" || g === "xnor"
              ? "^"
              : null;
      if (!op) throw new Error(`Unsupported gate ${g}`);
      rhs = inputs[0];
      for (let i = 1; i < inputs.length; i++) {
        rhs = { type: "Binary", op, left: rhs, right: inputs[i] };
      }
      if (g === "nand" || g === "nor" || g === "xnor") {
        rhs = { type: "Unary", op: "~", expr: rhs };
      }
    }
    assigns.push({
      lhs,
      rhs,
      delay: item.delay || 0,
      strength,
      switchPass: rhs.type === "SwitchPass",
    });
  }

  function addNetDeclAssigns(item, path, portMap, params) {
    if (!isNetDeclKind(item.kind)) return;
    const w = resolveWidth(item.width, item.range, params);
    for (const d of item.decls) {
      if (!d.init) continue;
      const key = fullName(path, d.name);
      assigns.push({
        lhs: { type: "LValue", name: key, select: null },
        rhs: rewriteExpr(d.init, path, portMap, params),
        delay: item.delay || 0,
        strength: DEFAULT_STRENGTH,
      });
      void w;
    }
  }

  return {
    expandAndPushGate,
    pushContinuousAssign,
    addNetDeclAssigns,
  };
}
