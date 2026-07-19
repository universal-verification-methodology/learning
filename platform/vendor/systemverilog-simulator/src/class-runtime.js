/**
 * Class / object runtime helpers.
 * Extracted from eval-expr.js (modularity M6). See MODULARITY.md.
 *
 * Circular with eval-expr: only call evalExpr/execBlocking from inside functions
 * (after both modules finish initializing).
 */

import { Value } from "./value.js";
import { isHandle, makeHandle, NULL_HANDLE } from "./handle.js";
import { applyStdCtor, isStdNativeClass, tryStdFunction } from "./std-runtime.js";
import { makeSvString, isCollectionSlot } from "./sv-array.js";
import { evalExpr, execBlocking } from "./eval-expr.js";
export function lookupMethod(classes, className, methodName, opts = {}) {
  let cur = classes?.get(className);
  if (opts.fromSuper) {
    cur = cur?.base ? classes.get(cur.base) : null;
  }
  while (cur) {
    if (methodName === "new" && cur.ctor) return cur.ctor;
    if (cur.methods.has(methodName)) return cur.methods.get(methodName);
    // virtual: keep searching up only if not found; non-virtual same
    cur = cur.base ? classes.get(cur.base) : null;
  }
  return null;
}

function isClassOrDerived(classes, className, ancestorName) {
  let cur = className;
  while (cur) {
    if (cur === ancestorName) return true;
    cur = classes.get(cur)?.base || null;
  }
  return false;
}

export function checkMemberAccess(member, memberName, ctx) {
  const access = member.access || "public";
  if (access === "public") return;
  const caller = ctx.thisHandle && ctx.heap && ctx.thisHandle.oid != null
    ? ctx.heap.get(ctx.thisHandle.oid)?.className
    : null;
  if (!caller) {
    throw new Error(`Cannot access ${access} member '${memberName}' outside class`);
  }
  const def = member.definedIn;
  if (!def) return;
  if (access === "local" && caller !== def) {
    throw new Error(`Cannot access local member '${memberName}' from '${caller}'`);
  }
  if (access === "protected" && !isClassOrDerived(ctx.classes, caller, def)) {
    throw new Error(`Cannot access protected member '${memberName}' from '${caller}'`);
  }
}

export function slotGet(slot) {
  if (!slot) return null;
  if (slot.isHandle) return slot.handle;
  if (slot.isString) return makeSvString(slot.str);
  if (slot.isDynArray || slot.isQueue) return slot; // whole collection (for assignment copy)
  return slot.value;
}

export function allocObject(className, args, signals, ctx) {
  const classes = ctx.classes;
  const heap = ctx.heap;
  if (!classes || !heap) throw new Error("Class runtime not initialized");
  const cls = classes.get(className);
  if (!cls) throw new Error(`Unknown class '${className}'`);
  const oid = ctx.nextOid();
  const props = new Map();
  for (const p of cls.props) {
    if (p.isHandle) {
      props.set(p.name, {
        name: p.name,
        isHandle: true,
        classType: p.classType,
        handle: NULL_HANDLE,
        width: 0,
        kind: "class",
        access: p.access || "public",
        definedIn: p.definedIn,
      });
    } else {
      const slot = {
        name: p.name,
        isHandle: false,
        width: p.width,
        kind: p.kind || "logic",
        value: p.isString ? Value.zeros(1) : Value.xxxx(p.width),
        access: p.access || "public",
        definedIn: p.definedIn,
      };
      if (p.isString) {
        slot.isString = true;
        slot.str = "";
        slot.width = 0;
      }
      if (p.isDynArray) {
        slot.isDynArray = true;
        slot.elems = [];
      }
      if (p.isQueue) {
        slot.isQueue = true;
        slot.elems = [];
      }
      props.set(p.name, slot);
    }
  }
  const obj = { className, props };
  heap.set(oid, obj);
  const handle = makeHandle(oid);
  if (isStdNativeClass(className)) {
    const argValues = (args || []).map((a) => evalExpr(a, signals, { ...ctx, thisHandle: handle }));
    applyStdCtor(obj, className, argValues);
    return handle;
  }
  const ctor = cls.ctor;
  if (ctor) {
    runClassFunction(ctor, handle, args, signals, ctx);
  }
  return handle;
}

export function runSuperNew(args, signals, ctx) {
  if (!ctx.thisHandle || ctx.thisHandle.oid == null) {
    throw new Error("super.new used outside constructor");
  }
  const obj = ctx.heap.get(ctx.thisHandle.oid);
  const cls = ctx.classes.get(obj.className);
  if (!cls?.base) throw new Error(`Class '${obj.className}' has no base for super.new`);
  const base = ctx.classes.get(cls.base);
  if (!base?.ctor) return NULL_HANDLE;
  return runClassFunction(base.ctor, ctx.thisHandle, args || [], signals, ctx);
}

function resolveArgSlot(arg, signals, ctx) {
  if (!arg || arg.type !== "Ident") {
    throw new Error("Method output/ref argument must be an identifier");
  }
  if (ctx.locals?.has(arg.name)) return ctx.locals.get(arg.name);
  if (signals.has(arg.name)) return signals.get(arg.name);
  throw new Error(`Unknown signal '${arg.name}'`);
}

function writeStdOut(slot, msg) {
  if (!slot || msg == null) return;
  if (slot.isHandle) {
    slot.handle = msg;
    return;
  }
  if (isHandle(msg)) throw new Error("Cannot assign class handle to bit slot");
  slot.value = (msg.clone?.() ?? msg).resize(slot.width);
}

export function runClassFunction(method, thisHandle, args, signals, ctx) {
  if (method.isStatic && method.returnsHandle === "process" && method.name === "self") {
    if (!ctx._processSelf) {
      ctx._processSelf = allocObject("process", [], signals, ctx);
    }
    return ctx._processSelf;
  }
  if (method.isStatic && !thisHandle) {
    // static method: no this
  } else if (method.isStatic) {
    thisHandle = null;
  }

  // Native std::mailbox / semaphore / process methods
  if (thisHandle?.oid != null && ctx.heap) {
    const obj = ctx.heap.get(thisHandle.oid);
    if (obj && isStdNativeClass(obj.className)) {
      const argValues = [];
      const outputSlots = [];
      let ai = 0;
      for (const p of method.ports) {
        if (ai >= (args || []).length) {
          if (p.direction === "output" || p.direction === "inout") {
            // missing output — leave unbound
            continue;
          }
          argValues.push(undefined);
          continue;
        }
        const arg = args[ai++];
        if (p.direction === "output" || p.direction === "inout") {
          const slot = resolveArgSlot(arg, signals, ctx);
          outputSlots.push(slot);
          argValues.push(null);
        } else {
          argValues.push(evalExpr(arg, signals, ctx));
        }
      }
      const r = tryStdFunction(obj, method.name, argValues, thisHandle, ctx);
      if (r.handled) {
        if (r.out != null && outputSlots[0]) writeStdOut(outputSlots[0], r.out);
        if (method.isVoid || method.width === 0) return NULL_HANDLE;
        return r.value ?? NULL_HANDLE;
      }
    }
  }

  const flocal = new Map();
  if (!method.isVoid && method.width > 0) {
    flocal.set(method.name, {
      width: method.width,
      kind: "reg",
      value: Value.xxxx(method.width),
    });
  }
  for (const p of method.ports) {
    if (p.isHandle) {
      flocal.set(p.name, {
        isHandle: true,
        classType: p.classType,
        handle: NULL_HANDLE,
        width: 0,
        kind: "class",
      });
    } else {
      flocal.set(p.name, {
        width: p.width,
        kind: p.kind || "reg",
        value: Value.xxxx(p.width),
      });
    }
  }
  for (const d of method.decls) {
    if (d.isHandle) {
      flocal.set(d.name, {
        isHandle: true,
        classType: d.classType,
        handle: NULL_HANDLE,
        width: 0,
        kind: "class",
      });
    } else {
      flocal.set(d.name, {
        width: d.width,
        kind: d.kind || "reg",
        value: Value.xxxx(d.width),
      });
    }
  }
  let ai = 0;
  for (const p of method.ports) {
    if (p.direction === "input" || !p.direction) {
      if (ai >= args.length) throw new Error(`Too few args to ${method.name}`);
      const v = evalExpr(args[ai++], signals, ctx);
      if (p.isHandle) {
        if (!isHandle(v)) throw new Error(`Method '${method.name}' expects class handle for '${p.name}'`);
        flocal.get(p.name).handle = v;
      } else {
        if (isHandle(v)) throw new Error(`Method '${method.name}' expects bit value for '${p.name}'`);
        flocal.get(p.name).value = v.resize(p.width);
      }
    } else {
      // output/inout: alias caller's slot into locals
      if (ai >= args.length) throw new Error(`Too few args to ${method.name}`);
      const slot = resolveArgSlot(args[ai++], signals, ctx);
      flocal.set(p.name, slot);
    }
  }
  const callCtx = {
    ...ctx,
    locals: flocal,
    thisHandle: method.isStatic ? null : thisHandle,
  };
  execBlocking(method.body, signals, callCtx);
  if (method.isVoid || method.width === 0) return NULL_HANDLE;
  return flocal.get(method.name).value.clone();
}

export function resolveRecvHandle(recv, signals, ctx) {
  if (recv.type === "This") {
    if (!ctx.thisHandle) throw new Error("'this' used outside method");
    return ctx.thisHandle;
  }
  if (recv.type === "Super") {
    if (!ctx.thisHandle) throw new Error("'super' used outside method");
    return ctx.thisHandle;
  }
  const h = evalExpr(recv, signals, ctx);
  if (!isHandle(h)) throw new Error("Method/property receiver must be a class handle");
  if (h.oid == null) throw new Error("Null class handle dereference");
  return h;
}

export function resolveCollectionSlot(recv, signals, ctx) {
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
  if (recv.type === "Ident") {
    const s = lookup(recv.name);
    return isCollectionSlot(s) ? s : null;
  }
  if (recv.type === "PropAccess") {
    try {
      const h = resolveRecvHandle(recv.recv, signals, ctx);
      const obj = ctx.heap.get(h.oid);
      const slot = obj?.props.get(recv.field);
      return isCollectionSlot(slot) ? slot : null;
    } catch {
      return null;
    }
  }
  if (recv.type === "This" || recv.type === "Super") {
    return null;
  }
  return null;
}
