import { parseLiteral } from "./literal.js";
import { Value } from "./value.js";
import { isHandle, NULL_HANDLE, handleEq } from "./handle.js";
import {
  isSvString,
  makeSvString,
  isNewArray,
  makeNewArray,
  isCollectionSlot,
  evalCollectionMethod,
  execCollectionMethod,
  resizeDynArray,
  copyCollection,
  indexRead,
  indexWrite,
} from "./sv-array.js";
import {
  bitwiseAnd,
  bitwiseOr,
  bitwiseXor,
  bitwiseNot,
  reduceAnd,
  reduceOr,
  reduceXor,
  concatValues,
  logicalToBit,
  arithBin,
  shiftLeft,
  shiftRight,
  shiftRightArith,
  compare,
} from "./value.js";
import { evalUdp, valueFromUdpBit, udpNormBit } from "./udp.js";
import { isVifHandle, makeVifHandle } from "./interface.js";
import {
  lookupMethod,
  checkMemberAccess,
  slotGet,
  allocObject,
  runSuperNew,
  runClassFunction,
  resolveRecvHandle,
  resolveCollectionSlot,
} from "./class-runtime.js";

/**
 * Runtime expression / LValue evaluation (shared by elaborator helpers and sim).
 * See MODULARITY.md (M1 eval-expr, M6 class-runtime).
 */

function requireValue(v, what) {
  if (isHandle(v)) throw new Error(`${what}: expected bit value, got class handle`);
  if (isSvString(v)) throw new Error(`${what}: expected bit value, got string`);
  if (v && (v.isDynArray || v.isQueue)) {
    throw new Error(`${what}: expected bit value, got array/queue`);
  }
  return v;
}
function evalSysFunc(expr, signals, ctx) {
  const name = expr.name;
  if (name === "$time" || name === "$stime") {
    if (expr.args.length) throw new Error(`${name} takes no arguments`);
    const t = ctx.getTime ? ctx.getTime() : 0;
    return Value.fromUint(t >>> 0, 32);
  }
  if (name === "$signed" || name === "$unsigned") {
    if (expr.args.length !== 1) throw new Error(`${name} takes one argument`);
    const v = requireValue(evalExpr(expr.args[0], signals, ctx), name).clone();
    v.signed = name === "$signed";
    return v;
  }
  if (name !== "$random" && name !== "$urandom") {
    throw new Error(`Unsupported system function ${name}`);
  }
  const next =
    ctx.nextRandom ||
    (() => {
      // fallback deterministic LCG if sim did not inject RNG
      if (ctx._rng == null) ctx._rng = 0x9e3779b9;
      ctx._rng = (Math.imul(ctx._rng, 1103515245) + 12345) >>> 0;
      return ctx._rng;
    });

  let seedObj = null;
  if (expr.args.length > 1) throw new Error(`${name} takes at most one seed argument`);
  if (expr.args.length === 1) {
    const a = expr.args[0];
    if (a.type !== "Ident") throw new Error(`${name} seed must be a variable`);
    const locals = ctx.locals || null;
    seedObj = (locals && locals.has(a.name) ? locals.get(a.name) : null) || signals.get(a.name);
    if (!seedObj) throw new Error(`Unknown seed '${a.name}'`);
    const seedBits = seedObj.value;
    if (!seedBits.hasXZ) {
      // reseed from variable
      const s = Number(seedBits.resize(32).toUint()) >>> 0;
      if (ctx.reseed) ctx.reseed(s);
      else ctx._rng = s;
    }
  }

  const r = next() >>> 0;
  if (seedObj) {
    seedObj.value = Value.fromUint(r, seedObj.width || 32);
  }
  return Value.fromUint(r, 32);
}

/**
 * Evaluate expression against a signal map (optional locals / functions).
 * @param {object} expr
 * @param {Map<string, { value: Value, width: number }>} signals
 * @param {{ locals?: Map<string, any>, functions?: Map<string, any>, nextRandom?: () => number }} [ctx]
 * @returns {Value|{$h:true,oid:number|null}}
 */
export function evalExpr(expr, signals, ctx = {}) {
  const locals = ctx.locals || null;
  const lookup = (name) => {
    if (locals && locals.has(name)) return locals.get(name);
    const s = signals.get(name);
    if (s) return s;
    if (ctx.thisHandle && ctx.heap && ctx.thisHandle.oid != null) {
      const obj = ctx.heap.get(ctx.thisHandle.oid);
      if (obj && obj.props.has(name)) return obj.props.get(name);
    }
    return null;
  };

  switch (expr.type) {
    case "Number":
      return Value.fromUint(expr.value, Math.max(1, expr.value.toString(2).length));
    case "Literal": {
      const p = parseLiteral(expr.raw);
      if (!p.ok) throw new Error(p.error);
      const v = p.value;
      if (p.signed) v.signed = true;
      return v;
    }
    case "Null":
      return NULL_HANDLE;
    case "String":
      return makeSvString(expr.value);
    case "NewArray": {
      const n = Number(
        requireValue(evalExpr(expr.size, signals, ctx), "new[]").toUint() ?? 0n
      );
      return makeNewArray(n);
    }
    case "This":
      if (!ctx.thisHandle) throw new Error("'this' used outside method");
      return ctx.thisHandle;
    case "New": {
      const cn = expr.className;
      if (!cn) throw new Error("new: cannot resolve class type (assign to a typed handle)");
      return allocObject(cn, expr.args || [], signals, ctx);
    }
    case "SuperNew":
      return runSuperNew(expr.args || [], signals, ctx);
    case "Ident": {
      if (ctx.ifaceInstances?.has(expr.name)) {
        return makeVifHandle(expr.name);
      }
      const s = lookup(expr.name);
      if (!s) throw new Error(`Unknown signal '${expr.name}'`);
      if (s.access && s.access !== "public") checkMemberAccess(s, expr.name, ctx);
      return slotGet(s);
    }
    case "VifAccess": {
      const slot = lookup(expr.vif);
      if (!slot || !slot.isVif) throw new Error(`'${expr.vif}' is not a virtual interface`);
      const h = slot.value;
      if (!isVifHandle(h) || !h.path) throw new Error(`virtual interface '${expr.vif}' is null`);
      const hier = [h.path, ...(expr.fields || [])].join(".");
      return evalExpr({ type: "Ident", name: hier }, signals, ctx);
    }
    case "PropAccess": {
      const h = resolveRecvHandle(expr.recv, signals, ctx);
      const obj = ctx.heap.get(h.oid);
      if (!obj) throw new Error(`Bad object handle`);
      const slot = obj.props.get(expr.field);
      if (!slot) throw new Error(`Unknown property '${expr.field}'`);
      checkMemberAccess(slot, expr.field, ctx);
      return slotGet(slot);
    }
    case "MethodCall": {
      const coll = resolveCollectionSlot(expr.recv, signals, ctx);
      if (coll) {
        const argValues = (expr.args || []).map((a) => evalExpr(a, signals, ctx));
        const r = evalCollectionMethod(coll, expr.name, argValues);
        if (r != null) return r;
        // void methods used as expressions are illegal; try exec for size-like misses
        if (execCollectionMethod(coll, expr.name, argValues)) return makeSvString("");
        throw new Error(`Unknown method '${expr.name}' on ${coll.isString ? "string" : coll.isQueue ? "queue" : "dynamic array"}`);
      }
      const fromSuper = expr.recv.type === "Super";
      const h = resolveRecvHandle(expr.recv, signals, ctx);
      const obj = ctx.heap.get(h.oid);
      const method = lookupMethod(ctx.classes, obj.className, expr.name, { fromSuper });
      if (!method) throw new Error(`Unknown method '${expr.name}' on ${obj.className}`);
      checkMemberAccess(method, expr.name, ctx);
      if (method.methodKind === "task") {
        throw new Error(`Task method '${expr.name}' cannot be used as an expression`);
      }
      return runClassFunction(method, h, expr.args || [], signals, ctx);
    }
    case "Call": {
      const fn = ctx.functions?.get(expr.name);
      if (!fn) throw new Error(`Unknown function '${expr.name}'`);
      if (fn.isStatic || fn.methodKind === "function" && fn.returnsHandle) {
        return runClassFunction(fn, null, expr.args || [], signals, ctx);
      }
      const flocal = new Map();
      flocal.set(fn.name, {
        width: fn.width,
        kind: "reg",
        value: Value.xxxx(fn.width),
      });
      for (const p of fn.ports) {
        flocal.set(p.name, {
          width: p.width,
          kind: p.kind || "reg",
          value: Value.xxxx(p.width),
        });
      }
      for (const d of fn.decls) {
        flocal.set(d.name, {
          width: d.width,
          kind: d.kind || "reg",
          value: Value.xxxx(d.width),
        });
      }
      let ai = 0;
      for (const p of fn.ports) {
        if (p.direction === "input" || !p.direction) {
          if (ai >= expr.args.length) throw new Error(`Too few args to ${fn.name}`);
          const v = requireValue(evalExpr(expr.args[ai++], signals, ctx), fn.name);
          flocal.get(p.name).value = v.resize(p.width);
        }
      }
      execBlocking(fn.body, signals, { ...ctx, locals: flocal });
      return flocal.get(fn.name).value.clone();
    }
    case "SysFunc": {
      return evalSysFunc(expr, signals, ctx);
    }
    case "Unary": {
      const v = requireValue(evalExpr(expr.expr, signals, ctx), `unary ${expr.op}`);
      if (expr.op === "~") return bitwiseNot(v);
      if (expr.op === "!") return new Value(logicalToBit(v).bits === "1" ? "0" : v.hasXZ ? "x" : "1");
      if (expr.op === "-") return arithBin(Value.zeros(v.width), v, "sub");
      if (expr.op === "&") return reduceAnd(v);
      if (expr.op === "|") return reduceOr(v);
      if (expr.op === "^") return reduceXor(v);
      if (expr.op === "~&") return bitwiseNot(reduceAnd(v));
      if (expr.op === "~|") return bitwiseNot(reduceOr(v));
      if (expr.op === "~^" || expr.op === "^~") return bitwiseNot(reduceXor(v));
      throw new Error(`Unary ${expr.op}`);
    }
    case "TriBuf": {
      const ctrl = logicalToBit(requireValue(evalExpr(expr.ctrl ?? expr.en, signals, ctx), "tribuf"));
      let data = requireValue(evalExpr(expr.data, signals, ctx), "tribuf");
      if (expr.invertData) data = bitwiseNot(data);
      const on = expr.activeLow ? "0" : "1";
      const off = expr.activeLow ? "1" : "0";
      if (ctrl.bits === on) return data;
      if (ctrl.bits === off) return Value.zzzz(data.width);
      // Control X/Z → H/L (ambiguous 1-or-Z / 0-or-Z)
      let out = "";
      for (let i = 0; i < data.width; i++) {
        const b = data.bits[i];
        if (b === "1") out += "h";
        else if (b === "0") out += "l";
        else out += "x";
      }
      return new Value(out);
    }
    case "SwitchPass": {
      // Value path only (Z when off); strength/rails filled in sim for switchPass assigns
      const data = requireValue(evalExpr(expr.data, signals, ctx), "switch");
      if (expr.sense === "always" || !expr.en) return data;
      const en = logicalToBit(requireValue(evalExpr(expr.en, signals, ctx), "switch"));
      const on = expr.sense === "n" ? "1" : "0";
      const off = expr.sense === "n" ? "0" : "1";
      if (en.bits === on) return data;
      if (en.bits === off) return Value.zzzz(data.width);
      let out = "";
      for (let i = 0; i < data.width; i++) {
        const b = data.bits[i];
        if (b === "1") out += "h";
        else if (b === "0") out += "l";
        else out += "x";
      }
      return new Value(out);
    }
    case "UdpCall": {
      const def = ctx.udps?.get(expr.udp);
      if (!def) throw new Error(`Unknown UDP '${expr.udp}'`);
      const inputBits = (expr.inputs || []).map((inp) => {
        const v = logicalToBit(requireValue(evalExpr(inp, signals, ctx), "udp"));
        return udpNormBit(v.bits);
      });
      if (!ctx.udpInsts) {
        // Stateless fallback (no sim map)
        const result = evalUdp(def, inputBits, {
          prevInputs: inputBits.map(() => "x"),
          state: def.initial != null ? udpNormBit(String(def.initial)) : "x",
        });
        return valueFromUdpBit(result.bit);
      }
      const key = expr.instKey || expr.udp;
      if (!ctx.udpInsts.has(key)) {
        ctx.udpInsts.set(key, {
          lastInputs: null,
          lastOut: "x",
          state: def.initial != null ? udpNormBit(String(def.initial)) : "x",
        });
      }
      const inst = ctx.udpInsts.get(key);
      // Same inputs as last eval (settle re-entry): keep prior result so edges are not lost
      if (
        inst.lastInputs &&
        inst.lastInputs.length === inputBits.length &&
        inst.lastInputs.every((b, i) => b === inputBits[i])
      ) {
        return valueFromUdpBit(inst.lastOut);
      }
      const prev = inst.lastInputs || inputBits.map(() => "x");
      const result = evalUdp(def, inputBits, {
        prevInputs: prev,
        state: inst.state,
      });
      inst.lastInputs = inputBits.slice();
      inst.lastOut = result.bit;
      if (def.sequential) inst.state = result.nextState ?? result.bit;
      return valueFromUdpBit(result.bit);
    }
    case "Binary": {
      const l = evalExpr(expr.left, signals, ctx);
      const r = evalExpr(expr.right, signals, ctx);
      const op = expr.op;
      if ((op === "==" || op === "!=" || op === "===" || op === "!==") && (isHandle(l) || isHandle(r))) {
        const eq = handleEq(l, r);
        const bit = op === "!=" || op === "!==" ? !eq : eq;
        return new Value(bit ? "1" : "0");
      }
      if ((op === "==" || op === "!=" || op === "===" || op === "!==") && (isSvString(l) || isSvString(r))) {
        const ls = isSvString(l) ? l.str : String(l);
        const rs = isSvString(r) ? r.str : String(r);
        const eq = ls === rs;
        const bit = op === "!=" || op === "!==" ? !eq : eq;
        return new Value(bit ? "1" : "0");
      }
      const lv = requireValue(l, `binary ${op}`);
      const rv = requireValue(r, `binary ${op}`);
      if (op === "&") return bitwiseAnd(lv, rv);
      if (op === "|") return bitwiseOr(lv, rv);
      if (op === "^") return bitwiseXor(lv, rv);
      if (op === "~^" || op === "^~") return bitwiseNot(bitwiseXor(lv, rv));
      if (op === "+") return arithBin(lv, rv, "add");
      if (op === "-") return arithBin(lv, rv, "sub");
      if (op === "*") return arithBin(lv, rv, "mul");
      if (op === "/") return arithBin(lv, rv, "div");
      if (op === "%") return arithBin(lv, rv, "mod");
      if (op === "<<") return shiftLeft(lv, rv);
      if (op === ">>") return shiftRight(lv, rv);
      if (op === ">>>") return lv.signed ? shiftRightArith(lv, rv) : shiftRight(lv, rv);
      if (op === "<<<") return shiftLeft(lv, rv);
      if (op === "==") return compare(lv, rv, "eq");
      if (op === "!=") return compare(lv, rv, "ne");
      if (op === "===") return compare(lv, rv, "caseeq");
      if (op === "!==") return compare(lv, rv, "casene");
      if (op === "<") return compare(lv, rv, "lt");
      if (op === ">") return compare(lv, rv, "gt");
      if (op === "<=") return compare(lv, rv, "le");
      if (op === ">=") return compare(lv, rv, "ge");
      if (op === "&&") {
        const a = logicalToBit(lv);
        const b = logicalToBit(rv);
        if (a.hasXZ || b.hasXZ) return new Value("x");
        return new Value(a.bits === "1" && b.bits === "1" ? "1" : "0");
      }
      if (op === "||") {
        const a = logicalToBit(lv);
        const b = logicalToBit(rv);
        if (a.bits === "1" || b.bits === "1") return new Value("1");
        if (a.hasXZ || b.hasXZ) return new Value("x");
        return new Value("0");
      }
      throw new Error(`Binary ${op}`);
    }
    case "Cond": {
      const c = logicalToBit(requireValue(evalExpr(expr.cond, signals, ctx), "?:"));
      if (c.hasXZ) {
        const a = evalExpr(expr.a, signals, ctx);
        const b = evalExpr(expr.b, signals, ctx);
        if (isHandle(a) || isHandle(b)) return NULL_HANDLE;
        const w = Math.max(a.width, b.width);
        return Value.xxxx(w);
      }
      return c.bits === "1" ? evalExpr(expr.a, signals, ctx) : evalExpr(expr.b, signals, ctx);
    }
    case "Concat": {
      const parts = expr.parts.map((p) => evalExpr(p, signals, ctx));
      if (parts.some(isSvString)) {
        return makeSvString(
          parts
            .map((p) => {
              if (isSvString(p)) return p.str;
              throw new Error("string concat requires string operands");
            })
            .join("")
        );
      }
      return concatValues(parts.map((p) => requireValue(p, "concat")));
    }
    case "Replicate": {
      const n = Number(
        requireValue(evalExpr(expr.count, signals, ctx), "replicate").toUint() ?? 0n
      );
      const v = evalExpr(expr.expr, signals, ctx);
      if (isSvString(v)) return makeSvString(v.str.repeat(n));
      return concatValues(Array.from({ length: n }, () => requireValue(v, "replicate")));
    }
    case "BitSelect": {
      // Memory / dynamic array / queue / string index
      if (expr.expr.type === "Ident") {
        const ms = lookup(expr.expr.name);
        if (ms && ms.memory) {
          const idx = requireValue(evalExpr(expr.index, signals, ctx), "index");
          if (idx.hasXZ) return Value.xxxx(ms.width);
          const addr = Number(idx.toUint());
          return (ms.words.get(addr) || Value.xxxx(ms.width)).clone();
        }
        if (ms && isCollectionSlot(ms)) {
          const idx = requireValue(evalExpr(expr.index, signals, ctx), "index");
          if (idx.hasXZ) return Value.xxxx(ms.width || 8);
          return indexRead(ms, Number(idx.toUint()));
        }
      }
      if (expr.expr.type === "PropAccess") {
        const coll = resolveCollectionSlot(expr.expr, signals, ctx);
        if (coll) {
          const idx = requireValue(evalExpr(expr.index, signals, ctx), "index");
          if (idx.hasXZ) return Value.xxxx(coll.width || 8);
          return indexRead(coll, Number(idx.toUint()));
        }
      }
      const v = requireValue(evalExpr(expr.expr, signals, ctx), "bit select");
      const idx = requireValue(evalExpr(expr.index, signals, ctx), "index");
      if (idx.hasXZ) return new Value("x");
      const i = Number(idx.toUint());
      return new Value(v.bit(i));
    }
    case "PartSelect": {
      const v = requireValue(evalExpr(expr.expr, signals, ctx), "part select");
      const hi = requireValue(evalExpr(expr.hi, signals, ctx), "part select");
      const lo = requireValue(evalExpr(expr.lo, signals, ctx), "part select");
      if (hi.hasXZ || lo.hasXZ) return Value.xxxx(1);
      return v.slice(Number(hi.toUint()), Number(lo.toUint()));
    }
    default:
      throw new Error(`Cannot eval ${expr.type}`);
  }
}

/**
 * Run delay-free procedural statements (functions).
 */
export function execBlocking(stmt, signals, ctx = {}) {
  if (!stmt) return;
  switch (stmt.type) {
    case "Block":
      for (const s of stmt.stmts) execBlocking(s, signals, ctx);
      break;
    case "Blocking": {
      const v = evalExpr(stmt.rhs, signals, ctx);
      applyLValue(stmt.lhs, v, signals, ctx);
      break;
    }
    case "NBA": {
      // Treat as blocking inside functions
      const v = evalExpr(stmt.rhs, signals, ctx);
      applyLValue(stmt.lhs, v, signals, ctx);
      break;
    }
    case "MethodCallStmt": {
      const coll = resolveCollectionSlot(stmt.recv, signals, ctx);
      if (coll) {
        const argValues = (stmt.args || []).map((a) => evalExpr(a, signals, ctx));
        if (execCollectionMethod(coll, stmt.name, argValues)) break;
        // expression methods used as statements (e.g. pop discarding result)
        if (evalCollectionMethod(coll, stmt.name, argValues) != null) break;
        throw new Error(`Unknown method '${stmt.name}' on collection`);
      }
      const fromSuper = stmt.recv.type === "Super";
      const h = resolveRecvHandle(stmt.recv, signals, ctx);
      const obj = ctx.heap.get(h.oid);
      const method = lookupMethod(ctx.classes, obj.className, stmt.name, { fromSuper });
      if (!method) throw new Error(`Unknown method '${stmt.name}' on ${obj.className}`);
      checkMemberAccess(method, stmt.name, ctx);
      if (method.methodKind === "task") {
        throw new Error(`Task method '${stmt.name}' inside function not supported`);
      }
      runClassFunction(method, h, stmt.args || [], signals, ctx);
      break;
    }
    case "SuperNewStmt":
      runSuperNew(stmt.args || [], signals, ctx);
      break;
    case "If":
      if (logicalToBit(requireValue(evalExpr(stmt.cond, signals, ctx), "if")).bits === "1") {
        execBlocking(stmt.then, signals, ctx);
      } else if (stmt.else) {
        execBlocking(stmt.else, signals, ctx);
      }
      break;
    case "For": {
      execBlocking(stmt.init, signals, ctx);
      let guard = 0;
      while (
        logicalToBit(requireValue(evalExpr(stmt.cond, signals, ctx), "for")).bits === "1"
      ) {
        if (++guard > 100000) throw new Error("for in function exceeded cap");
        execBlocking(stmt.body, signals, ctx);
        execBlocking(stmt.step, signals, ctx);
      }
      break;
    }
    case "While": {
      let guard = 0;
      while (
        logicalToBit(requireValue(evalExpr(stmt.cond, signals, ctx), "while")).bits === "1"
      ) {
        if (++guard > 100000) throw new Error("while in function exceeded cap");
        execBlocking(stmt.body, signals, ctx);
      }
      break;
    }
    case "Repeat": {
      const n = Number(
        requireValue(evalExpr(stmt.count, signals, ctx), "repeat").toUint() ?? 0n
      );
      for (let i = 0; i < n; i++) execBlocking(stmt.body, signals, ctx);
      break;
    }
    case "Case": {
      const sel = requireValue(evalExpr(stmt.expr, signals, ctx), "case");
      let matched = false;
      let defaultBody = null;
      for (const it of stmt.items) {
        if (it.items == null) {
          defaultBody = it.body;
          continue;
        }
        for (const lab of it.items) {
          const lv = requireValue(evalExpr(lab, signals, ctx), "case");
          if (sel.bits === lv.resize(sel.width).bits) {
            execBlocking(it.body, signals, ctx);
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (!matched && defaultBody) execBlocking(defaultBody, signals, ctx);
      break;
    }
    default:
      throw new Error(`Unsupported in function: ${stmt.type}`);
  }
}

/**
 * Apply value to LValue (blocking).
 * @param {object} lv
 * @param {any} val
 * @param {Map} signals
 * @param {object|Map|null} [ctxOrLocals]
 */
export function applyLValue(lv, val, signals, ctxOrLocals = null) {
  const ctx =
    ctxOrLocals && typeof ctxOrLocals === "object" && !(ctxOrLocals instanceof Map) && "locals" in ctxOrLocals
      ? ctxOrLocals
      : ctxOrLocals && typeof ctxOrLocals === "object" && ctxOrLocals.heap
        ? ctxOrLocals
        : { locals: ctxOrLocals instanceof Map || ctxOrLocals == null ? ctxOrLocals : null };
  // Also accept full evCtx (has locals, heap, …) without requiring "locals" key presence
  const fullCtx =
    ctxOrLocals && typeof ctxOrLocals === "object" && !(ctxOrLocals instanceof Map)
      ? ctxOrLocals
      : ctx;
  const locals = fullCtx.locals || null;

  const lookupSlot = (name) => {
    if (locals && locals.has(name)) return locals.get(name);
    const s = signals.get(name);
    if (s) return s;
    if (fullCtx.thisHandle && fullCtx.heap && fullCtx.thisHandle.oid != null) {
      const obj = fullCtx.heap.get(fullCtx.thisHandle.oid);
      if (obj && obj.props.has(name)) return obj.props.get(name);
    }
    return null;
  };

  // J6: virtual interface field write — vif.req = …
  if (lv.vifFields && lv.vifFields.length) {
    const slot = lookupSlot(lv.name);
    if (!slot || !slot.isVif) throw new Error(`'${lv.name}' is not a virtual interface`);
    const h = slot.value;
    if (!isVifHandle(h) || !h.path) throw new Error(`virtual interface '${lv.name}' is null`);
    const hier = [h.path, ...lv.vifFields].join(".");
    applyLValue({ type: "LValue", name: hier, select: lv.select || null }, val, signals, fullCtx);
    return;
  }

  // Class property: this.prop or handle.prop
  if (lv.prop) {
    let h;
    if (lv.isThis || lv.name === "this") {
      if (!fullCtx.thisHandle) throw new Error("'this' used outside method");
      h = fullCtx.thisHandle;
    } else {
      const recv = lookupSlot(lv.name);
      if (!recv || !recv.isHandle) throw new Error(`'${lv.name}' is not a class handle`);
      h = recv.handle;
    }
    if (!h || h.oid == null) throw new Error("Null class handle dereference");
    const obj = fullCtx.heap.get(h.oid);
    const slot = obj.props.get(lv.prop);
    if (!slot) throw new Error(`Unknown property '${lv.prop}'`);
    checkMemberAccess(slot, lv.prop, fullCtx);
    if (slot.isHandle) {
      if (!isHandle(val)) throw new Error(`Property '${lv.prop}' expects a class handle`);
      slot.handle = val;
      return;
    }
    if (isCollectionSlot(slot)) {
      if (lv.select?.type === "Bit") {
        const idxV = evalExpr(lv.select.index, signals, fullCtx);
        if (idxV.hasXZ) return;
        indexWrite(slot, Number(idxV.toUint()), val);
        return;
      }
      if (isNewArray(val)) {
        resizeDynArray(slot, val.size);
        return;
      }
      if (isSvString(val) && slot.isString) {
        slot.str = val.str;
        return;
      }
      if (isCollectionSlot(val)) {
        copyCollection(slot, val);
        return;
      }
      throw new Error(`Incompatible assignment to property '${lv.prop}'`);
    }
    if (isHandle(val)) throw new Error(`Property '${lv.prop}' expects a bit value`);
    if (lv.select) {
      applyLValue({ type: "LValue", name: lv.prop, select: lv.select }, val, signals, {
        locals: new Map([[lv.prop, slot]]),
        heap: fullCtx.heap,
        thisHandle: fullCtx.thisHandle,
      });
      return;
    }
    slot.value = val.resize(slot.width);
    return;
  }

  const s = lookupSlot(lv.name);
  if (!s) throw new Error(`Unknown signal '${lv.name}'`);
  if (s.isVif) {
    if (lv.select) throw new Error(`Cannot bit-select virtual interface '${lv.name}'`);
    if (isVifHandle(val)) {
      s.value = val;
      return;
    }
    // `null` (class Null → NULL_HANDLE) clears the virtual interface
    if (val === null || (isHandle(val) && val.oid == null)) {
      s.value = makeVifHandle(null);
      return;
    }
    throw new Error(`'${lv.name}' expects a virtual interface`);
  }
  if (s.isHandle) {
    if (lv.select) throw new Error(`Cannot bit-select class handle '${lv.name}'`);
    if (!isHandle(val)) throw new Error(`'${lv.name}' expects a class handle`);
    s.handle = val;
    return;
  }
  if (isCollectionSlot(s)) {
    if (!lv.select) {
      if (isNewArray(val)) {
        resizeDynArray(s, val.size);
        return;
      }
      if (isSvString(val) && s.isString) {
        s.str = val.str;
        return;
      }
      if (isCollectionSlot(val)) {
        copyCollection(s, val);
        return;
      }
      throw new Error(`Cannot assign to collection '${lv.name}'`);
    }
    if (lv.select.type === "Bit") {
      const idxV = evalExpr(lv.select.index, signals, fullCtx);
      if (idxV.hasXZ) return;
      indexWrite(s, Number(idxV.toUint()), val);
      return;
    }
    throw new Error(`Part-select on collection '${lv.name}' not supported`);
  }
  if (!lv.select) {
    if (s.memory) throw new Error(`Cannot assign entire memory '${lv.name}'`);
    if (isHandle(val)) throw new Error(`Cannot assign class handle to '${lv.name}'`);
    if (isSvString(val)) throw new Error(`Cannot assign string to '${lv.name}'`);
    s.value = val.resize(s.width);
    return;
  }
  if (isHandle(val)) throw new Error(`Cannot assign class handle with select`);
  if (lv.select.type === "Bit") {
    const idxV = evalExpr(lv.select.index, signals, fullCtx);
    if (idxV.hasXZ) return;
    const i = Number(idxV.toUint());
    if (s.memory) {
      s.words.set(i, val.resize(s.width));
      return;
    }
    const bits = s.value.bits.split("");
    const pos = s.width - 1 - i;
    if (pos < 0 || pos >= s.width) return;
    bits[pos] = val.resize(1).bits[0];
    s.value = new Value(bits.join(""));
    return;
  }
  if (s.memory) throw new Error(`Part-select on memory word not supported for '${lv.name}'`);
  const hi = Number(evalExpr(lv.select.hi, signals, fullCtx).toUint());
  const lo = Number(evalExpr(lv.select.lo, signals, fullCtx).toUint());
  const w = hi - lo + 1;
  const piece = val.resize(w).bits;
  const bits = s.value.bits.split("");
  for (let i = 0; i < w; i++) {
    const bitIndex = hi - i;
    const pos = s.width - 1 - bitIndex;
    if (pos >= 0 && pos < s.width) bits[pos] = piece[i];
  }
  s.value = new Value(bits.join(""));
}
