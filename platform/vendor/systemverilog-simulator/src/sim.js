import { Value } from "./value.js";
import { evalExpr, applyLValue, execBlocking } from "./eval-expr.js";
import { logicalToBit, formatStrengthRails } from "./value.js";
import { isHandle, formatHandle } from "./handle.js";
import { delaySpecToTicks } from "./time.js";
import {
  isStdNativeClass,
  isStdBlockingTask,
  tryStdFunction,
  stdTaskRunner,
} from "./std-runtime.js";
import {
  isSvString,
  isCollectionSlot,
  evalCollectionMethod,
  execCollectionMethod,
} from "./sv-array.js";
import { createForceOverlay } from "./sim-force.js";
import { createForkControl } from "./sim-fork.js";
import { createAssignEngine } from "./sim-assigns.js";

/**
 * Event-driven teaching simulator (subset v0).
 * @param {ReturnType<import('./elaborate.js').elaborate>} netlist
 * @param {{ memFiles?: Record<string, string> }} [opts]
 */
export function createSim(netlist, opts = {}) {
  const signals = netlist.signals;
  const functions = netlist.functions || new Map();
  const tasks = netlist.tasks || new Map();
  const classes = netlist.classes || new Map();
  const udps = netlist.udps || new Map();
  /** @type {Map<string, { prevInputs: string[], state: string }>} */
  const udpInsts = new Map();
  const timeCtx = netlist.timeCtx || null;
  const delayNum = (spec) => delaySpecToTicks(spec, timeCtx);
  /** @type {Map<number, { className: string, props: Map<string, any> }>} */
  const heap = new Map();
  let nextOid = 1;
  /** @type {Record<string, string>} */
  const memFiles = opts.memFiles || {};
  /** @type {Map<string, any>[]} */
  const localStack = [];
  /** @type {({ $h: true, oid: number|null }|null)[]} */
  const thisStack = [];
  /** LCG state for $random / $urandom (deterministic across runs) */
  let rngState = 0x12345678;
  function nextRandom() {
    rngState = (Math.imul(rngState, 1103515245) + 12345) >>> 0;
    return rngState;
  }
  function reseed(s) {
    rngState = s >>> 0 || 1;
  }
  const evCtx = () => ({
    locals: localStack.length ? localStack[localStack.length - 1] : null,
    thisHandle: thisStack.length ? thisStack[thisStack.length - 1] : null,
    functions,
    classes,
    udps,
    udpInsts,
    heap,
    nextOid: () => nextOid++,
    nextRandom,
    reseed,
    getTime: () => time,
  });
  const ev = (expr) => evalExpr(expr, signals, evCtx());
  const {
    forceBits,
    isFullyForced,
    mergeForce,
    setForceOverlay,
    clearForceOverlay,
  } = createForceOverlay({ signals, ev });
  /** @type {Map<string, { lhs: object, rhs: object }>} procedural continuous assigns */
  const procAssigns = new Map();
  /** @type {Set<string>} named events triggered this settle */
  const triggeredEvents = new Set();
  /** @type {object|null} process currently inside stmtRunner */
  let activeProc = null;

  function ap(lv, v, flags = {}) {
    if (!flags.force && !lv.prop && !lv.select && isFullyForced(lv.name)) return;
    applyLValue(lv, v, signals, evCtx());
    if (!flags.force && !lv.prop && forceBits.has(lv.name)) {
      const s = signals.get(lv.name);
      if (s && !s.isHandle) s.value = mergeForce(lv.name, s.value);
    }
  }
  let time = 0;
  let finished = false;
  /** @type {string[]} */
  const consoleOut = [];
  /** @type {{ time: number, name: string, value: string }[]} */
  const waves = [];
  /** @type {Map<string, string>} */
  const lastLogged = new Map();
  /** @type {{ time: number, fn: Function, id: number }[]} */
  const queue = [];
  let nextId = 1;
  /** @type {{ lhs: object, value: Value }[]} */
  let nbaBucket = [];
  /** @type {Map<string, string>} LSB previous for edge detect */
  const prevBits = new Map();
  let pendingEdges = false;
  /** @type {{ args: object[], last: string|null }|null} */
  let monitor = null;
  /** Wave dump gate ($dumpon / $dumpoff). Default on so UI waves work without $dumpvars. */
  let dumping = true;
  let dumpfile = null;

  const procState = netlist.processes.map((p) => ({
    ...p,
    stack: null,
    suspended: false,
    dead: false,
    running: false,
  }));

  function logSignal(name) {
    if (!dumping) return;
    const s = signals.get(name);
    if (!s || s.isHandle) return;
    const bits = s.value.bits;
    if (lastLogged.get(name) === bits) return;
    lastLogged.set(name, bits);
    waves.push({ time, name, value: bits });
  }

  function schedule(delay, fn) {
    queue.push({ time: time + Math.max(0, delay), fn, id: nextId++ });
  }

  const {
    hasLiveForkChildren,
    noteForkBranchDone,
    disableForkSiblings,
    requestDisable,
    spawnForkJoin,
  } = createForkControl({
    procState,
    schedule,
    settle: () => settle(),
    runProc: (p) => runProc(p),
  });

  const { updateAssigns, applyNBAs } = createAssignEngine({
    netlist,
    signals,
    procAssigns,
    ev,
    delayNum,
    schedule,
    settle: () => settle(),
    logSignal,
    forceBits,
    isFullyForced,
    mergeForce,
    markPendingEdges: () => {
      pendingEdges = true;
    },
    drainNba: () => {
      const bucket = nbaBucket;
      nbaBucket = [];
      return bucket;
    },
    prevBits,
  });

  function setSignalBits(name, value) {
    const s = signals.get(name);
    if (!s) throw new Error(`Unknown signal '${name}'`);
    if (s.isHandle) throw new Error(`Cannot poke class handle '${name}' as bits`);
    const next = value.resize(s.width);
    if (s.value.equals(next)) return false;
    s.value = next;
    logSignal(name);
    pendingEdges = true;
    return true;
  }

  function formatDisplay(args) {
    if (!args.length) return "";
    if (args[0].type === "String") {
      let fmt = args[0].value;
      let ai = 1;
      return fmt.replace(/%(0?\d*)([bhdHDxXpPsSvV])/g, (_m, _w, spec) => {
        if (ai >= args.length) return "";
        const v = ev(args[ai++]);
        if (isHandle(v)) return formatHandle(v);
        if (isSvString(v)) return v.str;
        const s = spec.toLowerCase();
        if (s === "s") return isSvString(v) ? v.str : String(v);
        if (s === "b") return v.toString(2);
        if (s === "h" || s === "x") return v.toString(16);
        if (s === "d") return v.hasXZ ? "x" : String(v.toUint());
        if (s === "p") return formatHandle(v);
        if (s === "v") {
          // Strength of the corresponding signal (scalar) or MSB of vector
          const arg = args[ai - 1];
          const sigName =
            arg && arg.type === "Ident"
              ? arg.name
              : arg && arg.type === "LValue"
                ? arg.name
                : null;
          const sig = sigName ? signals.get(sigName) : null;
          if (sig && sig.rails && sig.rails.length) {
            return sig.rails.map((r) => formatStrengthRails(r)).join("");
          }
          if (v && v.bits) {
            return [...v.bits]
              .map((b) => {
                if (b === "0") return "St0";
                if (b === "1") return "St1";
                if (b === "x") return "StX";
                return "HiZ";
              })
              .join("");
          }
          return "StX";
        }
        return v.bits;
      });
    }
    return args
      .map((a) => {
        if (a.type === "String") return a.value;
        const v = ev(a);
        if (isHandle(v)) return formatHandle(v);
        if (isSvString(v)) return v.str;
        return v.bits;
      })
      .join(" ");
  }

  function checkMonitor() {
    if (!monitor) return;
    const line = formatDisplay(monitor.args);
    if (line === monitor.last) return;
    monitor.last = line;
    consoleOut.push(line);
  }

  function isTruthy(v) {
    return logicalToBit(v).bits === "1";
  }

  function capturePrev() {
    for (const [name, s] of signals) {
      if (s.isHandle) continue;
      prevBits.set(name, s.value.bit(0));
    }
  }

  function edgeFired(item) {
    const s = signals.get(item.name);
    if (!s || s.isHandle) return false;
    const cur = s.value.bit(0);
    const p = prevBits.has(item.name) ? prevBits.get(item.name) : "x";
    if (item.edge === "posedge") return p !== "1" && cur === "1";
    if (item.edge === "negedge") return p !== "0" && cur === "0";
    return false;
  }

  function disabled() {
    return !!(activeProc && activeProc.disableTarget);
  }

  function* stmtRunner(stmt) {
    if (!stmt || finished || disabled()) return;
    switch (stmt.type) {
      case "Block": {
        const bname = stmt.name || null;
        if (bname && activeProc) {
          if (!activeProc.blockStack) activeProc.blockStack = [];
          activeProc.blockStack.push(bname);
        }
        try {
          for (const s of stmt.stmts) {
            if (disabled()) break;
            yield* stmtRunner(s);
          }
        } finally {
          if (bname && activeProc?.blockStack?.length) {
            const top = activeProc.blockStack.pop();
            if (top !== bname) {
              // stack mismatch — leave as-is
              activeProc.blockStack.push(top);
            }
          }
        }
        if (activeProc && activeProc.disableTarget === bname) {
          activeProc.disableTarget = null;
        }
        break;
      }
      case "Delay":
        yield { type: "delay", delay: delayNum(stmt.delay) };
        break;
      case "DelayStmt":
        yield { type: "delay", delay: delayNum(stmt.delay) };
        yield* stmtRunner(stmt.stmt);
        break;
      case "Blocking": {
        const v = ev(stmt.rhs);
        const slot = evCtx().locals?.get(stmt.lhs.name) || signals.get(stmt.lhs.name);
        const before =
          slot && !slot.isHandle && !stmt.lhs.prop ? slot.value.bit(0) : undefined;
        ap(stmt.lhs, v);
        if (!evCtx().locals?.has(stmt.lhs.name) && !stmt.lhs.prop && slot && !slot.isHandle) {
          logSignal(stmt.lhs.name);
          const after = signals.get(stmt.lhs.name)?.value.bit(0);
          if (before !== after) {
            prevBits.set(stmt.lhs.name, before ?? "x");
            pendingEdges = true;
          }
        }
        break;
      }
      case "NBA": {
        const v = ev(stmt.rhs);
        if (isHandle(v)) {
          ap(stmt.lhs, v);
        } else {
          nbaBucket.push({ lhs: stmt.lhs, value: v.clone() });
        }
        break;
      }
      case "If":
        if (isTruthy(ev(stmt.cond))) yield* stmtRunner(stmt.then);
        else if (stmt.else) yield* stmtRunner(stmt.else);
        break;
      case "For": {
        yield* stmtRunner(stmt.init);
        let guard = 0;
        while (!disabled() && isTruthy(ev(stmt.cond))) {
          if (++guard > 100000) throw new Error("for loop exceeded 100000 iterations");
          yield* stmtRunner(stmt.body);
          if (disabled()) break;
          yield* stmtRunner(stmt.step);
        }
        break;
      }
      case "While": {
        let guard = 0;
        while (!disabled() && isTruthy(ev(stmt.cond))) {
          if (++guard > 100000) throw new Error("while loop exceeded 100000 iterations");
          yield* stmtRunner(stmt.body);
        }
        break;
      }
      case "Repeat": {
        const nVal = ev(stmt.count);
        if (nVal.hasXZ) break;
        const n = Number(nVal.toUint() ?? 0n);
        if (n > 100000) throw new Error("repeat count too large");
        for (let i = 0; i < n; i++) {
          if (disabled()) break;
          yield* stmtRunner(stmt.body);
        }
        break;
      }
      case "Case": {
        const sel = ev(stmt.expr);
        let matched = false;
        let defaultBody = null;
        for (const it of stmt.items) {
          if (it.items == null) {
            defaultBody = it.body;
            continue;
          }
          for (const lab of it.items) {
            const lv = ev(lab);
            if (caseMatch(sel, lv, stmt.kind || "case")) {
              yield* stmtRunner(it.body);
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
        if (!matched && defaultBody) yield* stmtRunner(defaultBody);
        break;
      }
      case "Forever":
        for (let guard = 0; ; guard++) {
          if (disabled()) return;
          if (guard > 1000000) throw new Error("forever exceeded iteration cap");
          yield* stmtRunner(stmt.body);
        }
        break;
      case "Fork": {
        yield {
          type: "fork_join",
          branches: stmt.branches,
          join: stmt.join || "join",
        };
        break;
      }
      case "WaitFork":
        yield { type: "wait_fork" };
        break;
      case "DisableFork":
        yield { type: "disable_fork" };
        break;
      case "Disable":
        yield { type: "disable", name: stmt.name };
        break;
      case "Wait":
        while (!isTruthy(ev(stmt.expr))) {
          yield { type: "wait_expr", expr: stmt.expr };
        }
        break;
      case "EventControl":
        yield { type: "wait_sens", items: stmt.items };
        break;
      case "EventTrigger": {
        const s = signals.get(stmt.name);
        if (!s) throw new Error(`Unknown event '${stmt.name}'`);
        prevBits.set(stmt.name, s.value.bit(0));
        s.value = new Value("1");
        logSignal(stmt.name);
        triggeredEvents.add(stmt.name);
        pendingEdges = true;
        break;
      }
      case "Force": {
        const v = ev(stmt.rhs);
        setForceOverlay(stmt.lhs, v);
        ap(stmt.lhs, v, { force: true });
        logSignal(stmt.lhs.name);
        pendingEdges = true;
        break;
      }
      case "Release": {
        clearForceOverlay(stmt.lhs);
        pendingEdges = true;
        break;
      }
      case "ProcAssign":
        procAssigns.set(stmt.lhs.name, { lhs: stmt.lhs, rhs: stmt.rhs });
        break;
      case "Deassign":
        procAssigns.delete(stmt.lhs.name);
        break;
      case "TaskCall": {
        const task = tasks.get(stmt.name);
        if (!task) throw new Error(`Unknown task '${stmt.name}'`);
        if (stmt.args.length !== task.ports.length) {
          throw new Error(
            `Task ${task.name} expects ${task.ports.length} args, got ${stmt.args.length}`
          );
        }
        const locals = new Map();
        const ctx = evCtx();
        for (let i = 0; i < task.ports.length; i++) {
          const p = task.ports[i];
          const arg = stmt.args[i];
          if (p.direction === "output" || p.direction === "inout") {
            if (!arg || arg.type !== "Ident" || arg.select) {
              throw new Error(
                `Task ${task.name} ${p.direction} arg must be a plain identifier`
              );
            }
            const s =
              (ctx.locals && ctx.locals.has(arg.name) ? ctx.locals.get(arg.name) : null) ||
              signals.get(arg.name);
            if (!s) throw new Error(`Unknown signal '${arg.name}' for task ${task.name}`);
            // Live alias so delayed assignments inside the task update the caller
            locals.set(p.name, s);
          } else {
            const v = ev(arg);
            if (isHandle(v)) {
              throw new Error(`Class handle args not supported on task '${task.name}' yet`);
            }
            locals.set(p.name, {
              width: p.width,
              kind: p.kind || "reg",
              value: v.resize(p.width),
            });
          }
        }
        for (const d of task.decls) {
          locals.set(d.name, {
            width: d.width,
            kind: d.kind || "reg",
            value: Value.xxxx(d.width),
          });
        }
        localStack.push(locals);
        try {
          yield* stmtRunner(task.body);
        } finally {
          localStack.pop();
        }
        break;
      }
      case "MethodCallStmt": {
        const fromSuper = stmt.recv.type === "Super";
        // Collection methods (string / queue / dynamic array)
        if (!fromSuper) {
          let coll = null;
          if (stmt.recv.type === "Ident") {
            const ctx = evCtx();
            coll =
              (ctx.locals && ctx.locals.has(stmt.recv.name)
                ? ctx.locals.get(stmt.recv.name)
                : null) || signals.get(stmt.recv.name);
            if (!isCollectionSlot(coll)) coll = null;
          } else if (stmt.recv.type === "PropAccess") {
            const h = ev(stmt.recv.recv);
            if (isHandle(h) && h.oid != null) {
              const obj = heap.get(h.oid);
              const slot = obj?.props.get(stmt.recv.field);
              if (isCollectionSlot(slot)) coll = slot;
            }
          }
          if (coll) {
            const argValues = (stmt.args || []).map((a) => ev(a));
            if (execCollectionMethod(coll, stmt.name, argValues)) break;
            if (evalCollectionMethod(coll, stmt.name, argValues) != null) break;
            throw new Error(`Unknown method '${stmt.name}' on collection`);
          }
        }
        const handle = fromSuper
          ? (() => {
              const th = thisStack.length ? thisStack[thisStack.length - 1] : null;
              if (!th || th.oid == null) throw new Error("'super' used outside method");
              return th;
            })()
          : ev(stmt.recv);
        if (!isHandle(handle) || handle.oid == null) {
          throw new Error(`Null or invalid handle for method '${stmt.name}'`);
        }
        const obj = heap.get(handle.oid);
        let method = null;
        let cur = classes.get(obj.className);
        if (fromSuper) cur = cur?.base ? classes.get(cur.base) : null;
        while (cur) {
          if (cur.methods.has(stmt.name)) {
            method = cur.methods.get(stmt.name);
            break;
          }
          cur = cur.base ? classes.get(cur.base) : null;
        }
        if (!method) throw new Error(`Unknown method '${stmt.name}' on ${obj.className}`);

        // Native std mailbox / semaphore / process
        if (isStdNativeClass(obj.className)) {
          const argValues = [];
          const outputSlots = [];
          let ai = 0;
          for (const p of method.ports) {
            if (ai >= (stmt.args || []).length) {
              argValues.push(undefined);
              continue;
            }
            const arg = stmt.args[ai++];
            if (p.direction === "output" || p.direction === "inout") {
              if (!arg || arg.type !== "Ident") {
                throw new Error(`Method ${method.name} ${p.direction} arg must be identifier`);
              }
              const ctx = evCtx();
              const s =
                (ctx.locals && ctx.locals.has(arg.name) ? ctx.locals.get(arg.name) : null) ||
                signals.get(arg.name);
              if (!s) throw new Error(`Unknown signal '${arg.name}'`);
              outputSlots.push(s);
              argValues.push(null);
            } else {
              argValues.push(ev(arg));
            }
          }
          if (isStdBlockingTask(obj.className, stmt.name)) {
            yield* stdTaskRunner(obj, stmt.name, argValues, outputSlots);
            break;
          }
          const r = tryStdFunction(obj, stmt.name, argValues, handle, evCtx());
          if (r.handled) {
            if (r.out != null && outputSlots[0]) {
              const slot = outputSlots[0];
              if (slot.isHandle) slot.handle = r.out;
              else slot.value = (r.out.clone?.() ?? r.out).resize(slot.width);
            }
            break;
          }
        }

        const locals = new Map();
        if (method.methodKind === "function" && !method.isVoid && method.width > 0) {
          locals.set(method.name, {
            width: method.width,
            kind: "reg",
            value: Value.xxxx(method.width),
          });
        }
        for (let i = 0; i < method.ports.length; i++) {
          const p = method.ports[i];
          const arg = stmt.args[i];
          if (p.direction === "output" || p.direction === "inout") {
            if (!arg || arg.type !== "Ident") {
              throw new Error(`Method ${method.name} ${p.direction} arg must be identifier`);
            }
            const ctx = evCtx();
            const s =
              (ctx.locals && ctx.locals.has(arg.name) ? ctx.locals.get(arg.name) : null) ||
              signals.get(arg.name);
            if (!s) throw new Error(`Unknown signal '${arg.name}'`);
            locals.set(p.name, s);
          } else if (p.isHandle) {
            const v = ev(arg);
            if (!isHandle(v)) throw new Error(`Method '${method.name}' expects class handle`);
            locals.set(p.name, {
              isHandle: true,
              classType: p.classType,
              handle: v,
              width: 0,
              kind: "class",
            });
          } else {
            const v = ev(arg);
            if (isHandle(v)) throw new Error("Unexpected class handle arg");
            locals.set(p.name, {
              width: p.width,
              kind: p.kind || "reg",
              value: v.resize(p.width),
            });
          }
        }
        for (const d of method.decls) {
          if (d.isHandle) {
            locals.set(d.name, {
              isHandle: true,
              classType: d.classType,
              handle: { $h: true, oid: null },
              width: 0,
              kind: "class",
            });
          } else {
            locals.set(d.name, {
              width: d.width,
              kind: d.kind || "reg",
              value: Value.xxxx(d.width),
            });
          }
        }

        localStack.push(locals);
        thisStack.push(handle);
        try {
          if (method.methodKind === "function") {
            execBlocking(method.body, signals, evCtx());
          } else {
            yield* stmtRunner(method.body);
          }
        } finally {
          thisStack.pop();
          localStack.pop();
        }
        break;
      }
      case "SuperNewStmt": {
        const th = thisStack.length ? thisStack[thisStack.length - 1] : null;
        if (!th || th.oid == null) throw new Error("super.new used outside constructor");
        const obj = heap.get(th.oid);
        const cls = classes.get(obj.className);
        if (!cls?.base) throw new Error(`Class '${obj.className}' has no base for super.new`);
        const base = classes.get(cls.base);
        if (base?.ctor) {
          // Run base ctor with this bound
          const method = base.ctor;
          const locals = new Map();
          for (let i = 0; i < method.ports.length; i++) {
            const p = method.ports[i];
            const arg = stmt.args[i];
            if (p.isHandle) {
              const v = ev(arg);
              locals.set(p.name, {
                isHandle: true,
                classType: p.classType,
                handle: v,
                width: 0,
                kind: "class",
              });
            } else {
              const v = ev(arg);
              locals.set(p.name, {
                width: p.width,
                kind: p.kind || "reg",
                value: v.resize(p.width),
              });
            }
          }
          for (const d of method.decls) {
            locals.set(d.name, {
              width: d.width,
              kind: d.kind || "reg",
              value: Value.xxxx(d.width),
            });
          }
          localStack.push(locals);
          thisStack.push(th);
          try {
            execBlocking(method.body, signals, evCtx());
          } finally {
            thisStack.pop();
            localStack.pop();
          }
        }
        break;
      }
      case "SysTask": {
        if (stmt.name === "$finish" || stmt.name === "$stop") {
          finished = true;
          consoleOut.push(`[${time}] ${stmt.name}`);
        } else if (stmt.name === "$display" || stmt.name === "$write") {
          consoleOut.push(formatDisplay(stmt.args));
        } else if (stmt.name === "$error" || stmt.name === "$fatal") {
          const msg = formatDisplay(stmt.args);
          consoleOut.push(`[${time}] ${stmt.name}: ${msg}`);
          if (stmt.name === "$fatal") {
            finished = true;
            consoleOut.push(`[${time}] $finish`);
          }
        } else if (stmt.name === "$warning" || stmt.name === "$info") {
          consoleOut.push(`[${time}] ${stmt.name}: ${formatDisplay(stmt.args)}`);
        } else if (stmt.name === "$monitor") {
          if (!stmt.args.length) monitor = null;
          else {
            monitor = { args: stmt.args, last: null };
            checkMonitor();
          }
        } else if (stmt.name === "$monitoroff") {
          monitor = null;
        } else if (stmt.name === "$dumpfile") {
          if (stmt.args[0]?.type === "String") dumpfile = stmt.args[0].value;
          else dumpfile = "dump.vcd";
        } else if (stmt.name === "$dumpvars") {
          dumping = true;
          // Subset: dump all signals (wave API). Args accepted and ignored.
        } else if (stmt.name === "$dumpon") {
          dumping = true;
        } else if (stmt.name === "$dumpoff") {
          dumping = false;
        } else if (stmt.name === "$readmemh" || stmt.name === "$readmemb") {
          doReadMem(stmt.name === "$readmemh" ? 16 : 2, stmt.args);
        } else {
          throw new Error(`Unsupported system task ${stmt.name}`);
        }
        break;
      }
      default:
        throw new Error(`Unsupported statement ${stmt.type}`);
    }
  }

  function doReadMem(radix, args) {
    if (args.length < 2) throw new Error("$readmem requires filename and memory");
    const fileArg = args[0];
    const memArg = args[1];
    if (fileArg.type !== "String") throw new Error("$readmem filename must be a string");
    if (memArg.type !== "Ident") throw new Error("$readmem memory must be an identifier");
    const mem = signals.get(memArg.name);
    if (!mem || !mem.memory) throw new Error(`$readmem: '${memArg.name}' is not a memory`);
    const content = memFiles[fileArg.value];
    if (content == null) {
      throw new Error(
        `$readmem: file '${fileArg.value}' not found (pass memFiles in simulate/createSim opts)`
      );
    }
    let start = Math.min(mem.addrLeft, mem.addrRight);
    let end = Math.max(mem.addrLeft, mem.addrRight);
    if (args[2]) start = Number(ev(args[2]).toUint());
    if (args[3]) end = Number(ev(args[3]).toUint());
    let addr = start;
    const tokens = String(content)
      .split(/[\s,]+/)
      .filter(Boolean);
    for (const tok of tokens) {
      if (tok.startsWith("@")) {
        addr = parseInt(tok.slice(1), 16);
        continue;
      }
      if (addr < Math.min(start, end) || addr > Math.max(start, end)) {
        addr++;
        continue;
      }
      const bits = digitsToBits(tok, radix, mem.width);
      mem.words.set(addr, new Value(bits));
      addr++;
      if ((start <= end && addr > end) || (start > end && addr < end)) break;
    }
  }

  function digitsToBits(tok, radix, width) {
    const clean = tok.replace(/_/g, "").toLowerCase();
    let bits = "";
    if (radix === 16) {
      for (const ch of clean) {
        const n = parseInt(ch, 16);
        if (Number.isNaN(n)) throw new Error(`$readmemh bad digit '${ch}'`);
        bits += n.toString(2).padStart(4, "0");
      }
    } else {
      for (const ch of clean) {
        if (ch === "0" || ch === "1" || ch === "x" || ch === "z") bits += ch;
        else throw new Error(`$readmemb bad digit '${ch}'`);
      }
    }
    if (bits.length > width) bits = bits.slice(bits.length - width);
    if (bits.length < width) bits = bits.padStart(width, "0");
    return bits;
  }

  function caseMatch(sel, lab, kind) {
    const a = sel.bits;
    const b = lab.resize(sel.width).bits;
    if (a.length !== b.length) {
      const w = Math.max(a.length, b.length);
      return caseMatch(sel.resize(w), lab.resize(w), kind);
    }
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];
      if (kind === "case") {
        if (x !== y) return false;
      } else if (kind === "casex") {
        if (x === "x" || x === "z" || y === "x" || y === "z") continue;
        if (x !== y) return false;
      } else {
        // casez: z and ? (parsed as x) in the label are don't-cares; z in select also
        if (y === "z" || y === "x" || x === "z") continue;
        if (x !== y) return false;
      }
    }
    return true;
  }

  function runProc(proc) {
    if (finished || proc.dead || proc.running) return;
    proc.running = true;
    const prevActive = activeProc;
    activeProc = proc;
    try {
      if (!proc.stack) proc.stack = [stmtRunner(proc.body)];

      while (proc.stack.length && !finished) {
        const frame = proc.stack[proc.stack.length - 1];
        const r = frame.next();
        if (r.done) {
          proc.stack.pop();
          continue;
        }
        if (r.value?.type === "delay") {
          proc.suspended = true;
          const wake = r.value.delay;
          schedule(wake, () => {
            proc.suspended = false;
            runProc(proc);
            settle();
          });
          return;
        }
        if (r.value?.type === "fork_join") {
          const branches = r.value.branches || [];
          const join = r.value.join || "join";
          const fr = spawnForkJoin(proc, branches, join);
          if (fr.suspend) {
            proc.suspended = true;
            proc.forkWait = fr.forkWait;
            return;
          }
          continue;
        }
        if (r.value?.type === "wait_fork") {
          if (hasLiveForkChildren(proc)) {
            proc.suspended = true;
            proc.waitFork = true;
            return;
          }
          continue;
        }
        if (r.value?.type === "disable_fork") {
          disableForkSiblings(proc);
          continue;
        }
        if (r.value?.type === "disable") {
          requestDisable(r.value.name);
          continue;
        }
        if (r.value?.type === "wait_pred") {
          if (!r.value.pred()) {
            proc.suspended = true;
            proc.waitPred = r.value.pred;
            return;
          }
          continue;
        }
        if (r.value?.type === "wait_expr") {
          proc.suspended = true;
          proc.waitExpr = r.value.expr;
          return;
        }
        if (r.value?.type === "wait_sens") {
          proc.suspended = true;
          proc.waitSens = r.value.items;
          proc.waitSensSnap = snapshotSens(r.value.items);
          return;
        }
      }

      proc.stack = null;
      if (proc.kind === "Initial" || proc.kind === "ForkBranch") {
        proc.dead = true;
        if (proc.kind === "ForkBranch") noteForkBranchDone(proc);
      } else if (proc.kind === "Always" && proc.sens.type === "Timed" && !finished) {
        // Restart timed always
        proc.running = false;
        activeProc = prevActive;
        runProc(proc);
        return;
      }
    } finally {
      proc.running = false;
      activeProc = prevActive;
    }
  }

  function snapshotSens(items) {
    /** @type {Map<string, string>} */
    const bits = new Map();
    for (const it of items) {
      if (it.type === "Star") continue;
      const s = signals.get(it.name);
      if (s) bits.set(it.name, s.value.bits);
    }
    return bits;
  }

  function sensMatched(items, snap) {
    for (const it of items) {
      if (it.type === "Star") {
        for (const [name, s] of signals) {
          if (snap.get(name) !== s.value.bits) return true;
        }
        return false;
      }
      if (it.type === "Edge") {
        if (edgeFired(it)) return true;
      } else if (it.type === "Level") {
        if (triggeredEvents.has(it.name)) return true;
        const s = signals.get(it.name);
        if (s && snap.get(it.name) !== s.value.bits) return true;
      }
    }
    return false;
  }

  function wakeWaiters() {
    for (const proc of procState) {
      if (!proc.suspended || proc.dead) continue;
      if (proc.waitPred) {
        if (proc.waitPred()) {
          proc.waitPred = null;
          proc.suspended = false;
          runProc(proc);
        }
      } else if (proc.waitFork) {
        if (!hasLiveForkChildren(proc)) {
          proc.waitFork = false;
          proc.suspended = false;
          runProc(proc);
        }
      } else if (proc.waitExpr) {
        if (isTruthy(ev(proc.waitExpr))) {
          proc.waitExpr = null;
          proc.suspended = false;
          runProc(proc);
        }
      } else if (proc.waitSens) {
        if (sensMatched(proc.waitSens, proc.waitSensSnap || new Map())) {
          proc.waitSens = null;
          proc.waitSensSnap = null;
          proc.suspended = false;
          runProc(proc);
        }
      }
    }
    // Clear one-shot event triggers after waiters observed them
    for (const name of triggeredEvents) {
      const s = signals.get(name);
      if (s && s.kind === "event") s.value = Value.zeros(1);
    }
    triggeredEvents.clear();
  }

  function runComboAlways() {
    for (const proc of procState) {
      if (proc.kind !== "Always" || proc.dead || proc.suspended) continue;
      const combo =
        proc.sens.type === "Star" ||
        (proc.sens.type === "SensList" && !proc.sens.items.some((i) => i.type === "Edge"));
      if (!combo) continue;
      const before = freeze();
      proc.stack = null;
      runProc(proc);
      if (!same(before)) pendingEdges = true;
    }
  }

  function fireEdgeAlways() {
    if (!pendingEdges) return;
    pendingEdges = false;
    for (const proc of procState) {
      if (proc.kind !== "Always" || proc.dead || proc.suspended) continue;
      if (proc.sens.type !== "SensList") continue;
      const edges = proc.sens.items.filter((i) => i.type === "Edge");
      if (!edges.length) continue;
      if (edges.some((e) => edgeFired(e))) {
        proc.stack = null;
        runProc(proc);
      }
    }
    // Note: do not capturePrev here — wakeWaiters must see the edge first
  }

  function freeze() {
    const m = new Map();
    for (const [k, s] of signals) m.set(k, s.value.bits);
    return m;
  }
  function same(m) {
    for (const [k, s] of signals) if (m.get(k) !== s.value.bits) return false;
    return true;
  }

  function settle() {
    let guard = 0;
    for (;;) {
      if (++guard > 500) throw new Error("Settle did not converge");
      updateAssigns();
      runComboAlways();
      updateAssigns();
      const hadNba = applyNBAs();
      fireEdgeAlways();
      updateAssigns();
      // Procedural @(posedge)/wait before capturing prev, or edge waiters miss it
      wakeWaiters();
      capturePrev();
      if (!hadNba && !pendingEdges) break;
      if (!hadNba && pendingEdges) {
        fireEdgeAlways();
        wakeWaiters();
        capturePrev();
        if (!pendingEdges) break;
      }
      if (!hadNba) break;
    }
    checkMonitor();
  }

  let started = false;

  /** Kick initials / timed always; do not drain the event queue. */
  function start() {
    if (started) return getResult();
    started = true;
    finished = false;
    capturePrev();
    settle();
    for (const proc of procState) {
      if (proc.kind === "Initial" || (proc.kind === "Always" && proc.sens.type === "Timed")) {
        runProc(proc);
      }
    }
    settle();
    return getResult();
  }

  /**
   * Advance to the next scheduled time slot (all events at that time).
   * @param {{ maxTime?: number }} [opts]
   */
  function step(opts = {}) {
    if (!started) start();
    if (finished) return getResult();
    if (!queue.length) return getResult();

    const maxTime = opts.maxTime ?? Number.POSITIVE_INFINITY;
    queue.sort((a, b) => a.time - b.time || a.id - b.id);
    const nextT = queue[0].time;
    if (nextT > maxTime) return getResult();

    time = nextT;
    const batch = [];
    while (queue.length && queue[0].time === nextT) batch.push(queue.shift());
    for (const ev of batch) ev.fn();
    settle();
    return getResult();
  }

  /**
   * Drain the queue until $finish, empty queue, or maxTime.
   * @param {{ maxTime?: number, maxEvents?: number }} [opts]
   */
  function run(opts = {}) {
    const maxTime = opts.maxTime ?? 1000;
    const maxEvents = opts.maxEvents ?? 500000;
    let events = 0;
    if (!started) start();
    while (!finished && queue.length) {
      queue.sort((a, b) => a.time - b.time || a.id - b.id);
      const nextT = queue[0].time;
      if (nextT > maxTime) break;

      time = nextT;
      const batch = [];
      while (queue.length && queue[0].time === nextT) batch.push(queue.shift());
      for (const ev of batch) {
        if (++events > maxEvents) {
          throw new Error(
            `Simulation exceeded ${maxEvents} events (possible infinite loop; raise maxEvents or fix forever/#0)`
          );
        }
        ev.fn();
      }
      settle();
    }
    return getResult();
  }

  /** Run until sim time >= t (or finish / empty queue). */
  function runTo(t, opts = {}) {
    const cap = opts.maxTime ?? Number.POSITIVE_INFINITY;
    const target = Math.min(t, cap);
    if (!started) start();
    while (!finished && queue.length) {
      queue.sort((a, b) => a.time - b.time || a.id - b.id);
      const nextT = queue[0].time;
      if (nextT > target) break;
      if (nextT > cap) break;
      time = nextT;
      const batch = [];
      while (queue.length && queue[0].time === nextT) batch.push(queue.shift());
      for (const ev of batch) ev.fn();
      settle();
    }
    return getResult();
  }

  /**
   * Step until named signal has a posedge/negedge, or maxSteps.
   * @param {string} name
   * @param {'posedge'|'negedge'} edge
   * @param {{ maxTime?: number, maxSteps?: number }} [opts]
   */
  function runToEdge(name, edge, opts = {}) {
    const maxTime = opts.maxTime ?? Number.POSITIVE_INFINITY;
    const maxSteps = opts.maxSteps ?? 10000;
    if (!started) start();
    let steps = 0;
    while (!finished && queue.length && steps < maxSteps) {
      const before = signals.get(name)?.value.bit(0) ?? "x";
      step({ maxTime });
      steps++;
      const after = signals.get(name)?.value.bit(0) ?? "x";
      if (edge === "posedge" && before !== "1" && after === "1") break;
      if (edge === "negedge" && before !== "0" && after === "0") break;
      if (time >= maxTime) break;
    }
    return getResult();
  }

  function stop() {
    finished = true;
    return getResult();
  }

  function poke(name, bitsOrValue) {
    const v = typeof bitsOrValue === "string" ? new Value(bitsOrValue) : bitsOrValue;
    const before = signals.get(name)?.value.bit(0);
    prevBits.set(name, before ?? "x");
    setSignalBits(name, v);
    settle();
  }

  function peek(name) {
    const s = signals.get(name);
    if (!s) return null;
    if (s.isHandle) return s.handle;
    return s.value.clone();
  }

  function getResult() {
    const sigs = {};
    for (const [k, s] of signals) {
      if (s.isHandle) {
        sigs[k] = {
          width: 0,
          kind: "class",
          classType: s.classType,
          handle: formatHandle(s.handle),
          bits: formatHandle(s.handle),
        };
      } else {
        sigs[k] = { width: s.width, kind: s.kind, bits: s.value.bits };
      }
    }
    return {
      time,
      finished,
      console: consoleOut.slice(),
      waves: waves.slice(),
      signals: sigs,
      hierarchy: netlist.hierarchy ? netlist.hierarchy.slice() : undefined,
      pending: queue.length,
      started,
    };
  }

  return {
    start,
    step,
    run,
    runTo,
    runToEdge,
    stop,
    poke,
    peek,
    getConsole: () => consoleOut.slice(),
    getWaves: () => waves.slice(),
    getTime: () => time,
    getSignals: () => signals,
    getResult,
    settle,
    isFinished: () => finished,
    hasPending: () => queue.length > 0,
    isStarted: () => started,
  };
}
