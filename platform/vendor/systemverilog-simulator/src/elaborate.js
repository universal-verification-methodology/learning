import { parseLiteral } from "./literal.js";
import { Value } from "./value.js";
import { MAX_W } from "./literal.js";
import { isHandle, makeHandle, NULL_HANDLE, handleEq } from "./handle.js";
import { createStdPackageAst } from "./std-package.js";
import { applyStdCtor, isStdNativeClass, tryStdFunction } from "./std-runtime.js";
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
import { timeLiteralToFs, normalizeTimeCtx } from "./time.js";
import {
  bitwiseBin,
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
  strengthPairFromKeywords,
  STRENGTH_LEVEL,
  DEFAULT_STRENGTH,
  DEFAULT_CHARGE,
  emptyRails,
} from "./value.js";

/**
 * Elaborate a parsed design into a flat runnable netlist.
 * @param {{ type: 'Design', modules: object[] }} design
 * @param {{ top?: string }} [opts]
 */
export function elaborate(design, opts = {}) {
  const byName = new Map(design.modules.map((m) => [m.name, m]));
  const topName = opts.top || design.modules[design.modules.length - 1].name;
  const top = byName.get(topName);
  if (!top) throw new Error(`Top module '${topName}' not found`);

  /** @type {Map<string, { width: number, kind: string, value: Value }>} */
  const signals = new Map();
  /** @type {object[]} */
  const assigns = [];
  /** @type {object[]} */
  const processes = [];
  /** @type {string[]} */
  const ports = [];
  /** @type {Map<string, object>} */
  const tasks = new Map();
  /** @type {Map<string, object>} */
  const functions = new Map();
  /**
   * Compiled packages: name → { params, functions, tasks, types }
   * @type {Map<string, { params: Map<string, number>, functions: Map<string, object>, tasks: Map<string, object>, types: Map<string, object> }>}
   */
  const packageTable = new Map();
  /** @type {Map<string, number>} hierarchical defparam: "inst.PARAM" → value */
  const defparamTable = new Map();
  /** path → Map<typeName, TypeDesc> */
  const typeScopes = new Map();
  /** full signal name → packed field layout [{name,hi,lo,width}] */
  const signalFields = new Map();
  /** @type {Map<string, object>} class name → compiled class */
  const classTable = new Map();
  /** full signal name → class type name */
  const handleVars = new Map();

  function typesFor(path) {
    const key = path || "";
    if (!typeScopes.has(key)) typeScopes.set(key, new Map());
    return typeScopes.get(key);
  }

  /**
   * Resolve a typedef to { kind, width, fields? }.
   * @param {string} typeName
   * @param {Map<string, object>} typeMap
   * @param {Map<string, number>} params
   */
  function resolveType(typeName, typeMap, params) {
    const t = typeMap.get(typeName);
    if (!t) throw new Error(`Unknown type '${typeName}'`);
    if (t.form === "alias") {
      const w = resolveWidth(t.width, t.range, params);
      return { kind: t.kind || "logic", width: w, fields: null };
    }
    if (t.form === "enum") {
      const w =
        t.width != null && t.width > 0
          ? resolveWidth(t.width, t.range, params)
          : 32;
      return { kind: t.kind || "logic", width: w, fields: null };
    }
    if (t.form === "struct") {
      return { kind: "logic", width: t.width, fields: t.fields };
    }
    if (t.form === "class") {
      return {
        kind: "class",
        width: 0,
        fields: null,
        isHandle: true,
        classType: t.className || typeName,
      };
    }
    throw new Error(`Unsupported type form for '${typeName}'`);
  }

  function addHandle(path, name, classType) {
    const key = fullName(path, name);
    if (signals.has(key)) {
      const s = signals.get(key);
      s.kind = "class";
      s.isHandle = true;
      s.classType = classType;
      s.handle = s.handle ?? NULL_HANDLE;
      handleVars.set(key, classType);
      return s;
    }
    const s = {
      width: 0,
      kind: "class",
      classType,
      handle: NULL_HANDLE,
      name: key,
      isHandle: true,
    };
    signals.set(key, s);
    handleVars.set(key, classType);
    return s;
  }

  function compileMethod(m, params, typeMap, className = null) {
    const isFn = m.methodKind === "function" || m.type === "Function";
    const access = m.access || "public";
    const isStatic = !!m.isStatic;
    if (isFn) {
      const width = m.isVoid ? 0 : resolveWidth(m.width, m.range, params);
      const cm = {
        methodKind: "function",
        name: m.name,
        virtual: !!m.virtual,
        access,
        isStatic,
        width,
        isVoid: !!m.isVoid,
        returnsHandle: m.returnsHandle || null,
        className: className || null,
        ports: flattenTfPorts(m.ports, params, typeMap),
        decls: flattenTfDecls(m.decls, params, typeMap),
        body: rewriteStmt(m.body, "", null, params),
      };
      if (isStatic && className) {
        const qkey = `${className}::${m.name}`;
        functions.set(qkey, { ...cm, key: qkey });
      }
      return cm;
    }
    return {
      methodKind: "task",
      name: m.name,
      virtual: false,
      access,
      isStatic: false,
      ports: flattenTfPorts(m.ports, params, typeMap),
      decls: flattenTfDecls(m.decls, params, typeMap),
      body: rewriteStmt(m.body, "", null, params),
    };
  }

  /**
   * @param {object} cls
   * @param {Map<string, object>} typeMap
   * @param {Map<string, number>} params
   */
  function compileClass(cls, typeMap, params) {
    if (classTable.has(cls.name)) {
      throw new Error(`Duplicate class '${cls.name}'`);
    }
    /** @type {object[]} */
    let props = [];
    /** @type {Map<string, object>} */
    const methods = new Map();
    let ctor = null;
    const baseName = cls.base || null;
    if (baseName) {
      const base = classTable.get(baseName);
      if (!base) {
        throw new Error(
          `Unknown base class '${baseName}' for '${cls.name}' (define base first)`
        );
      }
      props = base.props.map((p) => ({ ...p }));
      for (const [k, v] of base.methods) methods.set(k, v);
      ctor = base.ctor;
    }
    const propByName = new Map(props.map((p) => [p.name, p]));
    for (const pd of cls.props || []) {
      const access = pd.access || "public";
      if (pd.typeName) {
        const rt = resolveType(pd.typeName, typeMap, params);
        for (const d of pd.decls) {
          const p = rt.isHandle
            ? {
                name: d.name,
                isHandle: true,
                classType: rt.classType,
                width: 0,
                kind: "class",
                access,
                definedIn: cls.name,
              }
            : {
                name: d.name,
                isHandle: false,
                width: rt.width,
                kind: rt.kind,
                fields: rt.fields || null,
                access,
                definedIn: cls.name,
                isDynArray: d.unpacked?.kind === "dynamic",
                isQueue: d.unpacked?.kind === "queue",
              };
          propByName.set(d.name, p);
        }
      } else {
        const w = resolveWidth(pd.width, pd.range, params);
        for (const d of pd.decls) {
          propByName.set(d.name, {
            name: d.name,
            isHandle: false,
            width: w,
            kind: pd.kind || "logic",
            access,
            definedIn: cls.name,
            isDynArray: d.unpacked?.kind === "dynamic",
            isQueue: d.unpacked?.kind === "queue",
            isString: pd.kind === "string",
          });
        }
      }
    }
    props = [...propByName.values()];
    for (const m of cls.methods || []) {
      const cm = compileMethod(m, params, typeMap, cls.name);
      cm.definedIn = cls.name;
      if (cm.name === "new") ctor = cm;
      else methods.set(cm.name, cm);
    }
    typeMap.set(cls.name, { form: "class", className: cls.name });
    classTable.set(cls.name, {
      name: cls.name,
      base: baseName,
      props,
      methods,
      ctor,
    });
  }

  function resolveMethod(className, methodName) {
    let cur = classTable.get(className);
    while (cur) {
      if (cur.methods.has(methodName)) return { method: cur.methods.get(methodName), className: cur.name };
      if (cur.ctor && methodName === "new") return { method: cur.ctor, className: cur.name };
      cur = cur.base ? classTable.get(cur.base) : null;
    }
    return null;
  }

  /**
   * Register typedef AST into typeMap; enum labels into params.
   * @param {object} item
   * @param {Map<string, object>} typeMap
   * @param {Map<string, number>} params
   */
  function registerTypedef(item, typeMap, params) {
    if (typeMap.has(item.name)) {
      throw new Error(`Duplicate typedef '${item.name}'`);
    }
    if (item.alias) {
      typeMap.set(item.name, {
        form: "alias",
        kind: item.alias.kind,
        width: item.alias.width,
        range: item.alias.range,
      });
      return;
    }
    if (item.enum) {
      const members = item.enum.members || [];
      let next = 0;
      let max = 0;
      for (const m of members) {
        if (m.value != null) next = evalConstInt(m.value, params);
        params.set(m.name, next);
        if (next > max) max = next;
        next++;
      }
      let width = item.enum.width;
      let range = item.enum.range;
      if (width == null && !range) {
        // untyped enum → int (32), matching SV default
        width = 32;
      }
      typeMap.set(item.name, {
        form: "enum",
        kind: item.enum.kind || "logic",
        width,
        range,
      });
      return;
    }
    if (item.struct) {
      if (!item.struct.packed) {
        throw new Error(`Unpacked struct '${item.name}' is not supported`);
      }
      const fields = [];
      let total = 0;
      /** @type {{ name: string, width: number, kind: string, sub: object[]|null }[]} */
      const widths = [];
      for (const f of item.struct.fields) {
        let fw;
        let fk = f.kind || "logic";
        /** @type {object[]|null} */
        let sub = null;
        if (f.typeName) {
          const rt = resolveType(f.typeName, typeMap, params);
          fw = rt.width;
          fk = rt.kind;
          if (rt.fields) {
            // Nested packed struct: keep relative field layout, rebase later
            sub = rt.fields.map((sf) => ({ ...sf, sub: sf.sub || null }));
          }
          if (rt.isHandle) {
            throw new Error(`Class handle field '${f.name}' in packed struct is not supported`);
          }
        } else {
          fw = resolveWidth(f.width, f.range, params);
        }
        widths.push({ name: f.name, width: fw, kind: fk, sub });
        total += fw;
      }
      if (total > MAX_W) {
        throw new Error(`Packed struct '${item.name}' width ${total} exceeds max ${MAX_W}`);
      }
      if (total < 1) throw new Error(`Packed struct '${item.name}' has no fields`);
      let bit = total - 1;
      for (const w of widths) {
        const hi = bit;
        const lo = bit - w.width + 1;
        let subAbs = null;
        if (w.sub) {
          // Rebase nested absolute indices into parent bit space:
          // nested bit i maps to parentLo + i
          subAbs = w.sub.map((sf) => ({
            name: sf.name,
            hi: lo + sf.hi,
            lo: lo + sf.lo,
            width: sf.width,
            sub: sf.sub
              ? sf.sub.map((ss) => ({
                  name: ss.name,
                  hi: lo + ss.hi,
                  lo: lo + ss.lo,
                  width: ss.width,
                  sub: null,
                }))
              : null,
          }));
        }
        fields.push({ name: w.name, hi, lo, width: w.width, sub: subAbs });
        bit = lo - 1;
      }
      typeMap.set(item.name, { form: "struct", width: total, fields });
      return;
    }
    throw new Error(`Malformed typedef '${item.name}'`);
  }

  function fieldPart(fields, memberPath) {
    if (!fields) throw new Error("Packed struct field access requires a struct variable");
    if (!memberPath.length) throw new Error("Empty field path");
    let cur = fields;
    let f = null;
    for (const name of memberPath) {
      if (!cur) throw new Error(`Cannot select field '${name}' (not a nested struct)`);
      f = cur.find((x) => x.name === name);
      if (!f) throw new Error(`Unknown field '${name}'`);
      cur = f.sub || null;
    }
    return f;
  }

  function collectMemberPath(expr) {
    /** @type {string[]} */
    const path = [];
    let node = expr;
    while (node && node.type === "MemberAccess") {
      path.unshift(node.field);
      node = node.expr;
    }
    return { base: node, path };
  }

  function fullName(path, name) {
    if (name && String(name).includes("::")) return name;
    return path ? `${path}.${name}` : name;
  }

  /**
   * Lower gate primitive to continuous assign(s).
   * @param {object} item
   * @param {string} declPath path for instance naming (unused for nets)
   * @param {string} refPath path for signal refs
   */
  function resolveItemStrength(item) {
    if (!item.strength) return DEFAULT_STRENGTH;
    if (item.strength.single) {
      return strengthPairFromKeywords(item.strength.s1, null, { single: true });
    }
    return strengthPairFromKeywords(item.strength.s1, item.strength.s0);
  }

  function isNetDeclKind(kind) {
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

  function bitSelectTerm(expr, bitIndex) {
    if (expr.type === "Ident" && !expr.select) {
      return {
        type: "BitSelect",
        expr,
        index: { type: "Number", value: bitIndex },
      };
    }
    // Scalars / complex exprs are shared across array instances
    return expr;
  }

  function expandAndPushGate(item, declPath, refPath, portMap, params) {
    if (item.type === "GateList") {
      for (const inst of item.instances) {
        if (inst.range) {
          const msb = evalConstInt(inst.range.msb, params);
          const lsb = evalConstInt(inst.range.lsb, params);
          const step = msb >= lsb ? -1 : 1;
          for (let i = msb; ; i += step) {
            const terminals = inst.terminals.map((t) => bitSelectTerm(t, i));
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

  function addSignal(path, name, width, kind, init = null, memInfo = null, unpacked = null, netExtras = null) {
    const key = fullName(path, name);
    if (signals.has(key)) {
      // allow redeclaration of ports as wire/reg — merge
      const s = signals.get(key);
      s.width = Math.max(s.width, width);
      if (kind === "reg" || kind === "integer" || kind === "logic" || kind === "bit") s.kind = kind;
      else if (
        kind === "tri" ||
        kind === "wand" ||
        kind === "wor" ||
        kind === "triand" ||
        kind === "trior" ||
        kind === "tri0" ||
        kind === "tri1" ||
        kind === "trireg" ||
        kind === "supply0" ||
        kind === "supply1" ||
        kind === "pull0" ||
        kind === "pull1"
      )
        s.kind = kind;
      else if (kind === "string") s.kind = kind;
      if (memInfo && !s.memory) {
        s.memory = true;
        s.addrLeft = memInfo.left;
        s.addrRight = memInfo.right;
        s.words = new Map();
        const lo = Math.min(memInfo.left, memInfo.right);
        const hi = Math.max(memInfo.left, memInfo.right);
        for (let a = lo; a <= hi; a++) s.words.set(a, Value.xxxx(s.width));
      }
      applyUnpackedFlags(s, unpacked);
      applyNetExtras(s, netExtras);
      return s;
    }
    if (kind === "string") {
      const s = {
        width: 0,
        kind: "string",
        value: Value.zeros(1),
        name: key,
        isString: true,
        str: isSvString(init) ? init.str : "",
      };
      signals.set(key, s);
      return s;
    }
    const value = init && !isSvString(init)
      ? init.resize(width)
      : kind === "reg" || kind === "integer" || kind === "logic" || kind === "bit" || kind === "event"
        ? Value.xxxx(width)
        : kind === "trireg"
          ? Value.xxxx(width)
          : kind === "supply0" || kind === "tri0" || kind === "pull0"
            ? Value.zeros(width)
            : kind === "supply1" || kind === "tri1" || kind === "pull1"
              ? Value.ones(width)
              : Value.zzzz(width);
    const s = {
      width,
      kind,
      value,
      name: key,
      rails: Array.from({ length: Math.max(1, width) }, () => emptyRails()),
    };
    if (memInfo) {
      s.memory = true;
      s.addrLeft = memInfo.left;
      s.addrRight = memInfo.right;
      s.words = new Map();
      const lo = Math.min(memInfo.left, memInfo.right);
      const hi = Math.max(memInfo.left, memInfo.right);
      for (let a = lo; a <= hi; a++) s.words.set(a, Value.xxxx(width));
    }
    if (kind === "event") {
      s.value = Value.zeros(1);
    }
    applyUnpackedFlags(s, unpacked);
    applyNetExtras(s, netExtras);
    signals.set(key, s);
    return s;
  }

  function applyNetExtras(s, netExtras) {
    if (!netExtras) return;
    if (netExtras.chargeLevel != null) s.chargeLevel = netExtras.chargeLevel;
    if (netExtras.decay != null) s.decay = netExtras.decay;
  }

  function chargeLevelFromKeyword(name) {
    if (!name) return DEFAULT_CHARGE;
    if (name === "large") return STRENGTH_LEVEL.large;
    if (name === "small") return STRENGTH_LEVEL.small;
    return STRENGTH_LEVEL.medium;
  }

  function decayFromDelay(delay) {
    if (!delay || typeof delay === "number") return 0;
    return Math.max(0, delay.toff ?? 0) | 0;
  }

  function varDeclNetExtras(item) {
    if (item.kind !== "trireg") return null;
    return {
      chargeLevel: chargeLevelFromKeyword(item.charge),
      decay: decayFromDelay(item.delay),
    };
  }

  function applyUnpackedFlags(s, unpacked) {
    if (!unpacked) return;
    if (unpacked.kind === "dynamic") {
      s.isDynArray = true;
      if (!s.elems) s.elems = [];
    } else if (unpacked.kind === "queue") {
      s.isQueue = true;
      if (!s.elems) s.elems = [];
    }
  }

  function evalConstInt(expr, params) {
    if (!expr) throw new Error("Expected constant expression");
    if (expr.type === "Number") return expr.value | 0;
    if (expr.type === "Literal") {
      const p = parseLiteral(expr.raw);
      if (!p.ok || p.hasXZ) throw new Error(`Expected constant: ${expr.raw}`);
      return Number(p.value.toUint());
    }
    if (expr.type === "Ident") {
      if (params && params.has(expr.name)) return params.get(expr.name) | 0;
      throw new Error(`Unknown parameter '${expr.name}' in constant expression`);
    }
    if (expr.type === "Unary" && expr.op === "-") return -evalConstInt(expr.expr, params);
    if (expr.type === "Binary") {
      const l = evalConstInt(expr.left, params);
      const r = evalConstInt(expr.right, params);
      if (expr.op === "+") return (l + r) | 0;
      if (expr.op === "-") return (l - r) | 0;
      if (expr.op === "*") return (l * r) | 0;
      if (expr.op === "/") return (Math.trunc(l / r) || 0) | 0;
    }
    throw new Error(`Expected constant integer expression (got ${expr.type})`);
  }

  function resolveWidth(width, range, params) {
    let w;
    if (typeof width === "number" && width > 0) w = width;
    else if (!range) w = 1;
    else {
      const msb = evalConstInt(range.msb, params);
      const lsb = evalConstInt(range.lsb, params);
      w = Math.abs(msb - lsb) + 1;
    }
    if (w > MAX_W) {
      throw new Error(`Signal width ${w} exceeds max ${MAX_W} bits at 1:1`);
    }
    if (w < 1) throw new Error(`Invalid signal width ${w} at 1:1`);
    return w;
  }

  /**
   * @param {object} mod
   * @param {object[]|null|undefined} overrides
   * @param {Map<string, number>|null} parentParams
   */
  function buildParams(mod, overrides, parentParams, childPath = "") {
    /** @type {Map<string, number>} */
    const params = new Map();
    for (const p of mod.parameters || []) {
      params.set(p.name, evalConstInt(p.expr, params));
    }
    const plist = mod.parameters || [];
    (overrides || []).forEach((o, idx) => {
      const env = parentParams || params;
      if (o.type === "Named") {
        params.set(o.name, evalConstInt(o.expr, env));
      } else {
        const name = plist[idx]?.name;
        if (!name) throw new Error(`Too many parameter overrides for ${mod.name}`);
        params.set(name, evalConstInt(o.expr, env));
      }
    });
    // Apply defparam overrides targeting this instance path
    if (childPath) {
      const prefix = childPath + ".";
      for (const [k, v] of defparamTable) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (!rest.includes(".")) params.set(rest, v);
      }
    }
    return params;
  }

  function rewriteExpr(expr, path, portMap, params) {
    if (!expr) return expr;
    const mapName = (n) => {
      if (portMap && portMap.has(n)) return portMap.get(n);
      return fullName(path, n);
    };
    switch (expr.type) {
      case "Ident":
        if (expr.name.includes("::")) {
          const [pn, mem] = expr.name.split("::");
          const pkg = packageTable.get(pn);
          if (pkg) {
            const vis = pkgVisible(pkg);
            if (vis.params.has(mem)) {
              return { type: "Number", value: vis.params.get(mem) };
            }
          }
        }
        if (params && params.has(expr.name)) {
          return { type: "Number", value: params.get(expr.name) };
        }
        return { ...expr, name: mapName(expr.name) };
      case "Call": {
        // package::fn stays global; local fn gets hierarchy prefix
        const callName = expr.name.includes("::")
          ? expr.name
          : path
            ? `${path}.${expr.name}`
            : expr.name;
        return {
          type: "Call",
          name: callName,
          args: expr.args.map((a) => rewriteExpr(a, path, portMap, params)),
        };
      }
      case "SysFunc":
        return {
          type: "SysFunc",
          name: expr.name,
          args: expr.args.map((a) => rewriteExpr(a, path, portMap, params)),
        };
      case "Number":
      case "Literal":
      case "String":
        return expr;
      case "NewArray":
        return {
          type: "NewArray",
          size: rewriteExpr(expr.size, path, portMap, params),
        };
      case "Unary":
        return { ...expr, expr: rewriteExpr(expr.expr, path, portMap, params) };
      case "TriBuf":
        return {
          type: "TriBuf",
          data: rewriteExpr(expr.data, path, portMap, params),
          ctrl: rewriteExpr(expr.ctrl ?? expr.en, path, portMap, params),
          invertData: !!expr.invertData,
          activeLow: !!expr.activeLow,
        };
      case "SwitchPass":
        return {
          type: "SwitchPass",
          data: rewriteExpr(expr.data, path, portMap, params),
          en: expr.en ? rewriteExpr(expr.en, path, portMap, params) : null,
          sense: expr.sense,
          resistive: !!expr.resistive,
        };
      case "Binary":
        return {
          ...expr,
          left: rewriteExpr(expr.left, path, portMap, params),
          right: rewriteExpr(expr.right, path, portMap, params),
        };
      case "Cond":
        return {
          ...expr,
          cond: rewriteExpr(expr.cond, path, portMap, params),
          a: rewriteExpr(expr.a, path, portMap, params),
          b: rewriteExpr(expr.b, path, portMap, params),
        };
      case "Concat":
        return {
          ...expr,
          parts: expr.parts.map((p) => rewriteExpr(p, path, portMap, params)),
        };
      case "Replicate":
        return {
          ...expr,
          count: rewriteExpr(expr.count, path, portMap, params),
          expr: rewriteExpr(expr.expr, path, portMap, params),
        };
      case "BitSelect":
        return {
          ...expr,
          expr: rewriteExpr(expr.expr, path, portMap, params),
          index: rewriteExpr(expr.index, path, portMap, params),
        };
      case "PartSelect":
        return {
          ...expr,
          expr: rewriteExpr(expr.expr, path, portMap, params),
          hi: rewriteExpr(expr.hi, path, portMap, params),
          lo: rewriteExpr(expr.lo, path, portMap, params),
        };
      case "MemberAccess": {
        const { base: rawBase, path: memberPath } = collectMemberPath(expr);
        const base = rewriteExpr(rawBase, path, portMap, params);
        if (base.type === "This" || base.type === "Super") {
          if (memberPath.length !== 1) {
            throw new Error("Nested property path on this/super not supported");
          }
          return { type: "PropAccess", recv: base, field: memberPath[0] };
        }
        if (base.type !== "Ident") {
          throw new Error("Member access only supported on identifiers or this");
        }
        if (signalFields.has(base.name)) {
          const layout = signalFields.get(base.name);
          const f = fieldPart(layout, memberPath);
          return {
            type: "PartSelect",
            expr: base,
            hi: { type: "Number", value: f.hi },
            lo: { type: "Number", value: f.lo },
          };
        }
        if (memberPath.length !== 1) {
          throw new Error(`Nested class field path not supported: ${memberPath.join(".")}`);
        }
        return { type: "PropAccess", recv: base, field: memberPath[0] };
      }
      case "MethodCall":
        return {
          type: "MethodCall",
          recv: rewriteExpr(expr.recv, path, portMap, params),
          name: expr.name,
          args: (expr.args || []).map((a) => rewriteExpr(a, path, portMap, params)),
        };
      case "SuperNew":
        return {
          type: "SuperNew",
          args: (expr.args || []).map((a) => rewriteExpr(a, path, portMap, params)),
        };
      case "New":
        return {
          type: "New",
          className: expr.className,
          args: (expr.args || []).map((a) => rewriteExpr(a, path, portMap, params)),
        };
      case "Null":
      case "This":
      case "Super":
        return expr;
      default:
        throw new Error(`Unknown expr ${expr.type}`);
    }
  }

  function rewriteLValue(lv, path, portMap, params) {
    if (lv.isThis || lv.name === "this") {
      const members = lv.members || [];
      if (!members.length) throw new Error("Invalid this lvalue");
      let select = lv.select;
      if (select) {
        if (select.type === "Bit") {
          select = { ...select, index: rewriteExpr(select.index, path, portMap, params) };
        } else {
          select = {
            ...select,
            hi: rewriteExpr(select.hi, path, portMap, params),
            lo: rewriteExpr(select.lo, path, portMap, params),
          };
        }
      }
      return {
        type: "LValue",
        name: "this",
        prop: members[0],
        select,
        isThis: true,
      };
    }
    const mapName = (n) => {
      if (portMap && portMap.has(n)) return portMap.get(n);
      return fullName(path, n);
    };
    const name = mapName(lv.name);
    let select = lv.select;
    const members = lv.members || [];
    if (members.length) {
      if (signalFields.has(name)) {
        const layout = signalFields.get(name);
        const f = fieldPart(layout, members);
        if (select) {
          throw new Error(`Bit/part select after struct field not supported on '${lv.name}'`);
        }
        select = {
          type: "Part",
          hi: { type: "Number", value: f.hi },
          lo: { type: "Number", value: f.lo },
        };
        select = {
          ...select,
          hi: rewriteExpr(select.hi, path, portMap, params),
          lo: rewriteExpr(select.lo, path, portMap, params),
        };
        return { type: "LValue", name, select };
      }
      if (members.length !== 1) {
        throw new Error(`Nested class field path not supported: ${members.join(".")}`);
      }
      if (select) {
        throw new Error(`Bit/part select after class field not supported on '${lv.name}'`);
      }
      return { type: "LValue", name, prop: members[0], select: null };
    }
    if (select) {
      if (select.type === "Bit") {
        select = { ...select, index: rewriteExpr(select.index, path, portMap, params) };
      } else {
        select = {
          ...select,
          hi: rewriteExpr(select.hi, path, portMap, params),
          lo: rewriteExpr(select.lo, path, portMap, params),
        };
      }
    }
    return { type: "LValue", name, select };
  }

  function rewriteStmt(stmt, path, portMap, params) {
    if (!stmt) return stmt;
    switch (stmt.type) {
      case "Block":
        return {
          ...stmt,
          stmts: stmt.stmts.map((s) => rewriteStmt(s, path, portMap, params)),
        };
      case "Blocking":
      case "NBA": {
        const lhs = rewriteLValue(stmt.lhs, path, portMap, params);
        let rhs = rewriteExpr(stmt.rhs, path, portMap, params);
        if (rhs.type === "New" && !rhs.className && !lhs.prop && !lhs.isThis) {
          const cn = handleVars.get(lhs.name);
          if (cn) rhs = { ...rhs, className: cn };
        }
        return { ...stmt, lhs, rhs };
      }
      case "MethodCallStmt":
        return {
          type: "MethodCallStmt",
          recv: rewriteExpr(stmt.recv, path, portMap, params),
          name: stmt.name,
          args: (stmt.args || []).map((a) => rewriteExpr(a, path, portMap, params)),
        };
      case "SuperNewStmt":
        return {
          type: "SuperNewStmt",
          args: (stmt.args || []).map((a) => rewriteExpr(a, path, portMap, params)),
        };
      case "If":
        return {
          ...stmt,
          cond: rewriteExpr(stmt.cond, path, portMap, params),
          then: rewriteStmt(stmt.then, path, portMap, params),
          else: rewriteStmt(stmt.else, path, portMap, params),
        };
      case "For":
        return {
          ...stmt,
          init: rewriteStmt(stmt.init, path, portMap, params),
          cond: rewriteExpr(stmt.cond, path, portMap, params),
          step: rewriteStmt(stmt.step, path, portMap, params),
          body: rewriteStmt(stmt.body, path, portMap, params),
        };
      case "While":
        return {
          ...stmt,
          cond: rewriteExpr(stmt.cond, path, portMap, params),
          body: rewriteStmt(stmt.body, path, portMap, params),
        };
      case "Repeat":
        return {
          ...stmt,
          count: rewriteExpr(stmt.count, path, portMap, params),
          body: rewriteStmt(stmt.body, path, portMap, params),
        };
      case "Case":
        return {
          ...stmt,
          expr: rewriteExpr(stmt.expr, path, portMap, params),
          items: stmt.items.map((it) => ({
            items: it.items
              ? it.items.map((lab) => rewriteExpr(lab, path, portMap, params))
              : null,
            body: rewriteStmt(it.body, path, portMap, params),
          })),
        };
      case "Forever":
        return { ...stmt, body: rewriteStmt(stmt.body, path, portMap, params) };
      case "Fork":
        return {
          ...stmt,
          join: stmt.join || "join",
          branches: stmt.branches.map((b) => rewriteStmt(b, path, portMap, params)),
        };
      case "WaitFork":
      case "DisableFork":
        return stmt;
      case "Wait":
        return { ...stmt, expr: rewriteExpr(stmt.expr, path, portMap, params) };
      case "Force":
      case "ProcAssign":
        return {
          ...stmt,
          lhs: rewriteLValue(stmt.lhs, path, portMap, params),
          rhs: rewriteExpr(stmt.rhs, path, portMap, params),
        };
      case "Release":
      case "Deassign":
        return { ...stmt, lhs: rewriteLValue(stmt.lhs, path, portMap, params) };
      case "EventTrigger":
        return {
          ...stmt,
          name:
            portMap && portMap.has(stmt.name)
              ? portMap.get(stmt.name)
              : fullName(path, stmt.name),
        };
      case "EventControl":
        return {
          ...stmt,
          items: stmt.items.map((it) => {
            if (it.type === "Star") return it;
            return {
              ...it,
              name:
                portMap && portMap.has(it.name)
                  ? portMap.get(it.name)
                  : fullName(path, it.name),
            };
          }),
        };
      case "Delay":
        return stmt;
      case "DelayStmt":
        return { ...stmt, stmt: rewriteStmt(stmt.stmt, path, portMap, params) };
      case "SysTask":
        return {
          ...stmt,
          args: stmt.args.map((a) =>
            a.type === "String" ? a : rewriteExpr(a, path, portMap, params)
          ),
        };
      case "TaskCall":
        return {
          type: "TaskCall",
          name: path ? `${path}.${stmt.name}` : stmt.name,
          args: stmt.args.map((a) => rewriteExpr(a, path, portMap, params)),
        };
      default:
        throw new Error(`Unknown stmt ${stmt.type}`);
    }
  }

  function tfKey(path, name) {
    return path ? `${path}.${name}` : name;
  }

  function flattenTfPorts(ports, params, typeMap) {
    const out = [];
    const tm = typeMap || new Map();
    for (const p of ports || []) {
      if (p.typeName) {
        const rt = resolveType(p.typeName, tm, params);
        if (!rt.isHandle) {
          throw new Error(`TF port type '${p.typeName}' must be a class handle`);
        }
        for (const n of p.names) {
          out.push({
            name: n,
            width: 0,
            kind: "class",
            isHandle: true,
            classType: rt.classType,
            direction: p.direction || "input",
          });
        }
        continue;
      }
      const w = resolveWidth(p.width, p.range, params);
      for (const n of p.names) {
        out.push({ name: n, width: w, kind: p.kind || "reg", direction: p.direction || "input" });
      }
    }
    return out;
  }

  function flattenTfDecls(decls, params, typeMap) {
    const out = [];
    const tm = typeMap || new Map();
    for (const d of decls || []) {
      if (d.typeName) {
        const rt = resolveType(d.typeName, tm, params);
        for (const x of d.decls) {
          if (rt.isHandle) {
            out.push({
              name: x.name,
              width: 0,
              kind: "class",
              isHandle: true,
              classType: rt.classType,
            });
          } else {
            out.push({ name: x.name, width: rt.width, kind: rt.kind || "reg" });
          }
        }
        continue;
      }
      const w = resolveWidth(d.width, d.range, params);
      for (const x of d.decls) {
        out.push({ name: x.name, width: w, kind: d.kind || "reg" });
      }
    }
    return out;
  }

  function evalConstBool(expr, params) {
    if (expr.type === "Binary") {
      const l = evalConstInt(expr.left, params);
      const r = evalConstInt(expr.right, params);
      if (expr.op === "<") return l < r;
      if (expr.op === ">") return l > r;
      if (expr.op === "<=") return l <= r;
      if (expr.op === ">=") return l >= r;
      if (expr.op === "==") return l === r;
      if (expr.op === "!=") return l !== r;
    }
    return evalConstInt(expr, params) !== 0;
  }

  function elaborateGenItem(item, genPath, modPath, portMap, params) {
    if (item.type === "GenvarDecl") return;
    if (item.type === "GenBlock") {
      const bp = genPath ? `${genPath}.${item.name}` : item.name;
      for (const b of item.items) elaborateGenItem(b, bp, modPath, portMap, params);
      return;
    }
    if (item.type === "GenFor") {
      let i = evalConstInt(item.init, params);
      let guard = 0;
      for (;;) {
        const env = new Map(params);
        env.set(item.genvar, i);
        if (!evalConstBool(item.cond, env)) break;
        const iterPath = genPath
          ? `${genPath}.${item.blockName}[${i}]`
          : `${item.blockName}[${i}]`;
        for (const b of item.body) elaborateGenItem(b, iterPath, modPath, portMap, env);
        i = evalConstInt(item.step, env);
        if (++guard > 10000) throw new Error("generate for exceeded iteration cap");
      }
      return;
    }
    if (item.type === "GenIf") {
      const takeThen = evalConstBool(item.cond, params);
      const branch = takeThen ? item.then : item.else;
      if (!branch) return;
      const label = branch.name || (takeThen ? "genblk" : "genblk_else");
      const bp = genPath ? `${genPath}.${label}` : label;
      for (const b of branch.items) elaborateGenItem(b, bp, modPath, portMap, params);
      return;
    }
    // Declares/instances live under genPath; references use modPath (upward)
    if (item.type === "ContinuousAssign" || item.type === "ContinuousAssignList") {
      pushContinuousAssign(item, modPath, portMap, params);
      return;
    }
    if (item.type === "Gate" || item.type === "GateList") {
      expandAndPushGate(item, genPath, modPath, portMap, params);
      return;
    }
    if (item.type === "VarDecl") {
      const w = resolveWidth(item.width, item.range, params);
      for (const d of item.decls) {
        let init = null;
        // Net declaration assignment is a continuous assign (IEEE), not a static init
        if (d.init && !isNetDeclKind(item.kind)) {
          init = evalExprStatic(rewriteExpr(d.init, modPath, portMap, params));
        }
        let memInfo = null;
        if (d.memRange) {
          memInfo = {
            left: evalConstInt(d.memRange.msb, params),
            right: evalConstInt(d.memRange.lsb, params),
          };
        }
        addSignal(genPath, d.name, w, item.kind, init, memInfo, d.unpacked, varDeclNetExtras(item));
      }
      addNetDeclAssigns(item, genPath, portMap, params);
      return;
    }
    if (item.type === "Always" || item.type === "Initial") {
      const sens =
        item.type === "Always"
          ? rewriteSens(item.sens, modPath, portMap)
          : { type: "Initial" };
      processes.push({
        kind: item.type,
        sens,
        body: rewriteStmt(item.body, modPath, portMap, params),
        path: genPath,
        svKind: item.svKind || null,
      });
      return;
    }
    if (item.type === "Instance") {
      const child = byName.get(item.module);
      if (!child) throw new Error(`Unknown module '${item.module}'`);
      const childPath = fullName(genPath, item.name);
      /** @type {Map<string, string>} */
      const childPorts = new Map();
      const childParams = buildParams(child, item.params || [], params, childPath);
      for (const p of child.ports) {
        const w = resolveWidth(p.width, p.range, childParams);
        addSignal(childPath, p.name, w, p.kind || "wire");
      }
      item.conns.forEach((c, idx) => {
        let portName;
        let expr;
        if (c.type === "Named") {
          portName = c.port;
          expr = c.expr;
        } else {
          portName = child.ports[idx]?.name;
          if (!portName) throw new Error(`Too many ports on ${item.name}`);
          expr = c.expr;
        }
        if (!expr) return;
        const childSig = fullName(childPath, portName);
        const port = child.ports.find((p) => p.name === portName);
        if (!port) throw new Error(`No port '${portName}' on ${item.module}`);
        if (expr.type === "Ident" && !expr.select) {
          const parentName = rewriteExpr(expr, modPath, portMap, params).name;
          signals.delete(childSig);
          childPorts.set(portName, parentName);
        } else if (port.direction === "input") {
          assigns.push({
            lhs: { type: "LValue", name: childSig, select: null },
            rhs: rewriteExpr(expr, modPath, portMap, params),
          });
        } else {
          if (expr.type !== "Ident") {
            throw new Error("Output port connection must be an identifier in v0");
          }
          const parentName = rewriteExpr(expr, modPath, portMap, params).name;
          assigns.push({
            lhs: { type: "LValue", name: parentName, select: null },
            rhs: { type: "Ident", name: childSig },
          });
        }
      });
      elaborateModule(child, childPath, childPorts, item.params || [], params);
      return;
    }
    if (item.type === "Generate") {
      for (const gi of item.items) elaborateGenItem(gi, genPath, modPath, portMap, params);
      return;
    }
    throw new Error(`Unsupported generate item ${item.type}`);
  }

  function elaborateItem(item, path, portMap, params) {
    if (item.type === "Typedef") {
      registerTypedef(item, typesFor(path), params);
      return;
    }
    if (item.type === "PortDecl") {
      const w = resolveWidth(item.width, item.range, params);
      for (const n of item.names) {
        if (portMap && portMap.has(n)) continue;
        addSignal(path, n, w, item.kind || "wire");
        if (!path) ports.push(fullName(path, n));
      }
    } else if (item.type === "VarDecl") {
      let w;
      let kind;
      let fields = null;
      let classType = null;
      if (item.typeName) {
        const rt = resolveType(item.typeName, typesFor(path), params);
        if (rt.isHandle) {
          classType = rt.classType;
        } else {
          w = rt.width;
          kind = rt.kind;
          fields = rt.fields;
        }
      } else {
        w = resolveWidth(item.width, item.range, params);
        kind = item.kind;
      }
      for (const d of item.decls) {
        if (classType) {
          addHandle(path, d.name, classType);
          continue;
        }
        let init = null;
        if (d.init && !isNetDeclKind(kind)) {
          init = evalExprStatic(rewriteExpr(d.init, path, portMap, params));
        }
        let memInfo = null;
        if (d.memRange) {
          memInfo = {
            left: evalConstInt(d.memRange.msb, params),
            right: evalConstInt(d.memRange.lsb, params),
          };
        }
        const s = addSignal(path, d.name, w, kind, init, memInfo, d.unpacked, varDeclNetExtras(item));
        if (fields) signalFields.set(s.name, fields);
      }
      if (!item.typeName) addNetDeclAssigns(item, path, portMap, params);
    } else if (item.type === "Class") {
      compileClass(item, typesFor(path), params);
    } else if (item.type === "EventDecl") {
      for (const n of item.names) addSignal(path, n, 1, "event");
    } else if (item.type === "ContinuousAssign" || item.type === "ContinuousAssignList") {
      pushContinuousAssign(item, path, portMap, params);
    } else if (item.type === "Gate" || item.type === "GateList") {
      expandAndPushGate(item, path, path, portMap, params);
    } else if (item.type === "Always" || item.type === "Initial") {
      const sens =
        item.type === "Always"
          ? rewriteSens(item.sens, path, portMap)
          : { type: "Initial" };
      processes.push({
        kind: item.type,
        sens,
        body: rewriteStmt(item.body, path, portMap, params),
        path,
        svKind: item.svKind || null,
      });
    } else if (item.type === "Instance") {
      const child = byName.get(item.module);
      if (!child) throw new Error(`Unknown module '${item.module}'`);
      const childPath = fullName(path, item.name);
      /** @type {Map<string, string>} */
      const childPorts = new Map();
      const childParams = buildParams(child, item.params || [], params, childPath);

      for (const p of child.ports) {
        const w = resolveWidth(p.width, p.range, childParams);
        addSignal(childPath, p.name, w, p.kind || "wire");
      }

      item.conns.forEach((c, idx) => {
        let portName;
        let expr;
        if (c.type === "Named") {
          portName = c.port;
          expr = c.expr;
        } else {
          portName = child.ports[idx]?.name;
          if (!portName) throw new Error(`Too many ports on ${item.name}`);
          expr = c.expr;
        }
        if (!expr) return;
        const childSig = fullName(childPath, portName);
        const port = child.ports.find((p) => p.name === portName);
        if (!port) throw new Error(`No port '${portName}' on ${item.module}`);

        if (expr.type === "Ident" && !expr.select) {
          const parentName = rewriteExpr(expr, path, portMap, params).name;
          signals.delete(childSig);
          childPorts.set(portName, parentName);
        } else if (port.direction === "input") {
          assigns.push({
            lhs: { type: "LValue", name: childSig, select: null },
            rhs: rewriteExpr(expr, path, portMap, params),
          });
        } else {
          if (expr.type !== "Ident") {
            throw new Error("Output port connection must be an identifier in v0");
          }
          const parentName = rewriteExpr(expr, path, portMap, params).name;
          assigns.push({
            lhs: { type: "LValue", name: parentName, select: null },
            rhs: { type: "Ident", name: childSig },
          });
        }
      });

      elaborateModule(child, childPath, childPorts, item.params || [], params);
    } else if (item.type === "Generate") {
      for (const gi of item.items) elaborateGenItem(gi, path, path, portMap, params);
    } else if (item.type === "GenvarDecl") {
      /* ignore */
    } else if (item.type === "Task") {
      const key = tfKey(path, item.name);
      const tports = flattenTfPorts(item.ports, params, typesFor(path));
      const tdecls = flattenTfDecls(item.decls, params, typesFor(path));
      const body = rewriteStmt(item.body, "", null, params);
      tasks.set(key, { name: item.name, key, ports: tports, decls: tdecls, body });
    } else if (item.type === "Function") {
      const key = tfKey(path, item.name);
      const width = resolveWidth(item.width, item.range, params);
      const fports = flattenTfPorts(item.ports, params, typesFor(path));
      const fdecls = flattenTfDecls(item.decls, params, typesFor(path));
      const body = rewriteStmt(item.body, "", null, params);
      functions.set(key, {
        name: item.name,
        key,
        width,
        ports: fports,
        decls: fdecls,
        body,
      });
    } else if (item.type === "Import" || item.type === "ImportList") {
      applyImport(item, path, params);
    } else {
      throw new Error(`Unsupported item ${item.type}`);
    }
  }

  /**
   * Visible symbols when importing a package (own + exported imports).
   * @param {object} pkg
   */
  function pkgVisible(pkg) {
    return {
      params: new Map([...(pkg.params || []), ...(pkg.exported?.params || [])]),
      functions: new Map([
        ...(pkg.functions || []),
        ...(pkg.exported?.functions || []),
      ]),
      tasks: new Map([...(pkg.tasks || []), ...(pkg.exported?.tasks || [])]),
      types: new Map([...(pkg.types || []), ...(pkg.exported?.types || [])]),
      vars: new Map([...(pkg.vars || []), ...(pkg.exported?.vars || [])]),
    };
  }

  function expandImportItems(item) {
    if (item.type === "ImportList") return item.items;
    if (item.type === "Import") return [{ package: item.package, names: item.names }];
    return [];
  }

  /**
   * @param {object} item Import or ImportList AST
   * @param {string} path module hierarchy path
   * @param {Map<string, number>} params
   */
  function applyImport(item, path, params) {
    for (const part of expandImportItems(item)) {
      applyImportPart(part, path, params);
    }
  }

  function applyImportPart(part, path, params) {
    const pkg = packageTable.get(part.package);
    if (!pkg) throw new Error(`Unknown package '${part.package}'`);
    const vis = pkgVisible(pkg);
    const star = part.names === "*";
    const want = star ? null : new Set(part.names);
    const localTypes = typesFor(path);
    for (const [n, v] of vis.params) {
      if (want && !want.has(n)) continue;
      params.set(n, v);
    }
    for (const [n, fn] of vis.functions) {
      if (want && !want.has(n)) continue;
      const key = tfKey(path, n);
      functions.set(key, { ...fn, name: n, key });
    }
    for (const [n, task] of vis.tasks) {
      if (want && !want.has(n)) continue;
      const key = tfKey(path, n);
      tasks.set(key, { ...task, name: n, key });
    }
    for (const [n, t] of vis.types) {
      if (want && !want.has(n)) continue;
      localTypes.set(n, t);
    }
    for (const [n, sig] of vis.vars) {
      if (want && !want.has(n)) continue;
      const key = fullName(path, n);
      signals.set(key, sig);
      if (sig.isHandle) handleVars.set(key, sig.classType);
    }
  }

  /**
   * @param {object} pkg Package AST
   */
  function compilePackage(pkg) {
    if (packageTable.has(pkg.name)) {
      throw new Error(`Duplicate package '${pkg.name}'`);
    }
    /** Own declarations only (visible to importers by default) */
    /** @type {Map<string, number>} */
    const ownParams = new Map();
    /** @type {Map<string, object>} */
    const ownFns = new Map();
    /** @type {Map<string, object>} */
    const ownTasks = new Map();
    /** @type {Map<string, object>} */
    const ownTypes = new Map();
    /** @type {Map<string, object>} package variable signals */
    const ownVars = new Map();

    /** Imported into this package (usable inside; not re-exported unless export) */
    /** @type {Map<string, number>} */
    const impParams = new Map();
    /** @type {Map<string, object>} */
    const impFns = new Map();
    /** @type {Map<string, object>} */
    const impTasks = new Map();
    /** @type {Map<string, object>} */
    const impTypes = new Map();
    /** @type {Map<string, object>} */
    const impVars = new Map();
    /** @type {Map<string, string>} name → source package */
    const impFrom = new Map();

    /** Working scope = own ∪ imported (for evaluating package body) */
    const params = new Map();
    const pfns = new Map();
    const ptasks = new Map();
    const ptypes = new Map();

    let pkgTimeunitFs = null;
    let pkgTimeprecisionFs = null;

    function mergeWorking() {
      for (const [n, v] of impParams) params.set(n, v);
      for (const [n, v] of ownParams) params.set(n, v);
      for (const [n, v] of impFns) pfns.set(n, v);
      for (const [n, v] of ownFns) pfns.set(n, v);
      for (const [n, v] of impTasks) ptasks.set(n, v);
      for (const [n, v] of ownTasks) ptasks.set(n, v);
      for (const [n, v] of impTypes) ptypes.set(n, v);
      for (const [n, v] of ownTypes) ptypes.set(n, v);
    }

    function importFromPackage(part) {
      const other = packageTable.get(part.package);
      if (!other) {
        throw new Error(
          `Package '${pkg.name}' imports '${part.package}' before it is defined`
        );
      }
      const vis = pkgVisible(other);
      const star = part.names === "*";
      const want = star ? null : new Set(part.names);
      for (const [n, v] of vis.params) {
        if (want && !want.has(n)) continue;
        impParams.set(n, v);
        impFrom.set(n, part.package);
        params.set(n, v);
      }
      for (const [n, fn] of vis.functions) {
        if (want && !want.has(n)) continue;
        impFns.set(n, fn);
        impFrom.set(n, part.package);
        pfns.set(n, fn);
        functions.set(`${pkg.name}::${n}`, { ...fn, key: `${pkg.name}::${n}` });
      }
      for (const [n, task] of vis.tasks) {
        if (want && !want.has(n)) continue;
        impTasks.set(n, task);
        impFrom.set(n, part.package);
        ptasks.set(n, task);
        tasks.set(`${pkg.name}::${n}`, { ...task, key: `${pkg.name}::${n}` });
      }
      for (const [n, t] of vis.types) {
        if (want && !want.has(n)) continue;
        impTypes.set(n, t);
        impFrom.set(n, part.package);
        ptypes.set(n, t);
      }
      for (const [n, sig] of vis.vars) {
        if (want && !want.has(n)) continue;
        impVars.set(n, sig);
        impFrom.set(n, part.package);
        signals.set(`${pkg.name}::${n}`, sig);
      }
    }

    // Imports first
    for (const item of pkg.items) {
      if (item.type === "Import" || item.type === "ImportList") {
        for (const part of expandImportItems(item)) importFromPackage(part);
      }
    }

    mergeWorking();

    // Own items (and exports collected)
    /** @type {Set<string>} */
    const exportNames = new Set();
    /** @type {object[]} */
    const exportItems = [];

    for (const item of pkg.items) {
      if (item.type === "Import" || item.type === "ImportList") continue;
      if (item.type === "Export") {
        exportItems.push(item);
        continue;
      }
      if (item.type === "Parameter") {
        for (const d of item.decls) {
          const v = evalConstInt(d.expr, params);
          ownParams.set(d.name, v);
          params.set(d.name, v);
        }
      } else if (item.type === "Typedef") {
        registerTypedef(item, ptypes, params);
        ownTypes.set(item.name, ptypes.get(item.name));
        if (item.enum) {
          for (const m of item.enum.members || []) {
            if (params.has(m.name)) ownParams.set(m.name, params.get(m.name));
          }
        }
      } else if (item.type === "Class") {
        compileClass(item, ptypes, params);
        ownTypes.set(item.name, ptypes.get(item.name));
      } else if (item.type === "Function") {
        const width = resolveWidth(item.width, item.range, params);
        const fports = flattenTfPorts(item.ports, params, ptypes);
        const fdecls = flattenTfDecls(item.decls, params, ptypes);
        const body = rewriteStmt(item.body, "", null, params);
        const qkey = `${pkg.name}::${item.name}`;
        const fn = {
          name: item.name,
          key: qkey,
          width,
          ports: fports,
          decls: fdecls,
          body,
        };
        ownFns.set(item.name, fn);
        pfns.set(item.name, fn);
        functions.set(qkey, fn);
      } else if (item.type === "Task") {
        const tports = flattenTfPorts(item.ports, params, ptypes);
        const tdecls = flattenTfDecls(item.decls, params, ptypes);
        const body = rewriteStmt(item.body, "", null, params);
        const qkey = `${pkg.name}::${item.name}`;
        const task = {
          name: item.name,
          key: qkey,
          ports: tports,
          decls: tdecls,
          body,
        };
        ownTasks.set(item.name, task);
        ptasks.set(item.name, task);
        tasks.set(qkey, task);
      } else if (item.type === "TimeUnit") {
        pkgTimeunitFs = timeLiteralToFs(item.unit);
        if (item.precision) pkgTimeprecisionFs = timeLiteralToFs(item.precision);
      } else if (item.type === "TimePrecision") {
        pkgTimeprecisionFs = timeLiteralToFs(item.precision);
      } else if (item.type === "VarDecl") {
        let w;
        let kind;
        let fields = null;
        let classType = null;
        if (item.typeName) {
          const rt = resolveType(item.typeName, ptypes, params);
          if (rt.isHandle) classType = rt.classType;
          else {
            w = rt.width;
            kind = rt.kind;
            fields = rt.fields;
          }
        } else {
          w = resolveWidth(item.width, item.range, params);
          kind = item.kind;
        }
        for (const d of item.decls) {
          const qname = `${pkg.name}::${d.name}`;
          if (classType) {
            const s = addHandle("", qname, classType);
            ownVars.set(d.name, s);
          } else {
            let init = null;
            if (d.init) init = evalExprStatic(rewriteExpr(d.init, "", null, params));
            let memInfo = null;
            if (d.memRange) {
              memInfo = {
                left: evalConstInt(d.memRange.msb, params),
                right: evalConstInt(d.memRange.lsb, params),
              };
            }
            const s = addSignal("", qname, w, kind, init, memInfo, d.unpacked, varDeclNetExtras(item));
            if (fields) signalFields.set(s.name, fields);
            ownVars.set(d.name, s);
          }
        }
      } else {
        throw new Error(`Unsupported package item ${item.type}`);
      }
    }

    // Apply exports (after body so export *::* sees all imports)
    function forceImportName(fromPkg, name) {
      if (impFrom.has(name) && impFrom.get(name) === fromPkg) return;
      const other = packageTable.get(fromPkg);
      if (!other) throw new Error(`export: unknown package '${fromPkg}'`);
      const vis = pkgVisible(other);
      if (vis.params.has(name)) {
        impParams.set(name, vis.params.get(name));
        params.set(name, vis.params.get(name));
        impFrom.set(name, fromPkg);
      } else if (vis.functions.has(name)) {
        const fn = vis.functions.get(name);
        impFns.set(name, fn);
        pfns.set(name, fn);
        functions.set(`${pkg.name}::${name}`, { ...fn, key: `${pkg.name}::${name}` });
        impFrom.set(name, fromPkg);
      } else if (vis.tasks.has(name)) {
        const task = vis.tasks.get(name);
        impTasks.set(name, task);
        ptasks.set(name, task);
        tasks.set(`${pkg.name}::${name}`, { ...task, key: `${pkg.name}::${name}` });
        impFrom.set(name, fromPkg);
      } else if (vis.types.has(name)) {
        impTypes.set(name, vis.types.get(name));
        ptypes.set(name, vis.types.get(name));
        impFrom.set(name, fromPkg);
      } else if (vis.vars.has(name)) {
        impVars.set(name, vis.vars.get(name));
        impFrom.set(name, fromPkg);
      } else {
        throw new Error(
          `Package '${pkg.name}' export '${fromPkg}::${name}' is not available for import`
        );
      }
    }

    for (const ex of exportItems) {
      if (ex.all) {
        for (const n of impFrom.keys()) exportNames.add(n);
        continue;
      }
      for (const part of ex.items) {
        if (part.names === "*") {
          for (const [n, from] of impFrom) {
            if (from === part.package) exportNames.add(n);
          }
        } else {
          for (const n of part.names) {
            forceImportName(part.package, n);
            if (!impFrom.has(n)) {
              throw new Error(`export ${part.package}::${n}: not imported`);
            }
            exportNames.add(n);
          }
        }
      }
    }

    /** @type {Map<string, number>} */
    const expParams = new Map();
    /** @type {Map<string, object>} */
    const expFns = new Map();
    /** @type {Map<string, object>} */
    const expTasks = new Map();
    /** @type {Map<string, object>} */
    const expTypes = new Map();
    /** @type {Map<string, object>} */
    const expVars = new Map();
    for (const n of exportNames) {
      if (impParams.has(n)) expParams.set(n, impParams.get(n));
      if (impFns.has(n)) expFns.set(n, impFns.get(n));
      if (impTasks.has(n)) expTasks.set(n, impTasks.get(n));
      if (impTypes.has(n)) expTypes.set(n, impTypes.get(n));
      if (impVars.has(n)) expVars.set(n, impVars.get(n));
    }

    packageTable.set(pkg.name, {
      params: ownParams,
      functions: ownFns,
      tasks: ownTasks,
      types: ownTypes,
      vars: ownVars,
      timeunitFs: pkgTimeunitFs,
      timeprecisionFs: pkgTimeprecisionFs,
      exported: {
        params: expParams,
        functions: expFns,
        tasks: expTasks,
        types: expTypes,
        vars: expVars,
      },
    });
  }

  /** @type {string[]} */
  const hierarchy = [];
  /** @type {{ timeunitFs?: number, timeprecisionFs?: number }|null} */
  let timeCtx = null;

  function applyTimeDecl(item) {
    if (!timeCtx) timeCtx = {};
    if (item.type === "TimeUnit") {
      timeCtx.timeunitFs = timeLiteralToFs(item.unit);
      if (item.precision) timeCtx.timeprecisionFs = timeLiteralToFs(item.precision);
    } else if (item.type === "TimePrecision") {
      timeCtx.timeprecisionFs = timeLiteralToFs(item.precision);
    }
  }

  function elaborateModule(mod, path, portMap, paramOverrides, parentParams) {
    const params = buildParams(mod, paramOverrides, parentParams, path);
    const hierPath = path || mod.name;
    if (!hierarchy.includes(hierPath)) hierarchy.push(hierPath);

    for (const p of mod.ports) {
      const key = fullName(path, p.name);
      if (portMap && portMap.has(p.name)) continue;
      const w = resolveWidth(p.width, p.range, params);
      addSignal(path, p.name, w, p.kind || "wire");
      if (!path) ports.push(key);
    }

    // Imports first so parameters/functions/types are visible to later items
    for (const item of mod.items) {
      if (item.type === "Import" || item.type === "ImportList") applyImport(item, path, params);
    }
    // Typedefs + classes before var decls / processes that use them
    for (const item of mod.items) {
      if (item.type === "Typedef") registerTypedef(item, typesFor(path), params);
    }
    for (const item of mod.items) {
      if (item.type === "Class") compileClass(item, typesFor(path), params);
    }
    for (const item of mod.items) {
      if (item.type === "TimeUnit" || item.type === "TimePrecision") applyTimeDecl(item);
    }
    // Defparams before instances so overrides apply during child elaborate
    for (const item of mod.items) {
      if (item.type !== "DefParam") continue;
      for (const d of item.decls) {
        const rel = d.path.join(".");
        const key = path ? `${path}.${rel}` : rel;
        defparamTable.set(key, evalConstInt(d.expr, params));
      }
    }
    for (const item of mod.items) {
      if (
        item.type === "Import" ||
        item.type === "ImportList" ||
        item.type === "DefParam" ||
        item.type === "Typedef" ||
        item.type === "Class" ||
        item.type === "TimeUnit" ||
        item.type === "TimePrecision"
      )
        continue;
      elaborateItem(item, path, portMap, params);
    }
  }

  function rewriteSens(sens, path, portMap) {
    if (sens.type === "Star" || sens.type === "Timed") return sens;
    return {
      type: "SensList",
      items: sens.items.map((it) => ({
        ...it,
        name:
          portMap && portMap.has(it.name)
            ? portMap.get(it.name)
            : fullName(path, it.name),
      })),
    };
  }

  function evalExprStatic(expr) {
    if (expr.type === "Number") return Value.fromUint(expr.value, 32);
    if (expr.type === "Literal") {
      const p = parseLiteral(expr.raw);
      if (!p.ok) throw new Error(p.error);
      return p.value;
    }
    if (expr.type === "String") return makeSvString(expr.value);
    return null;
  }

  // Built-in std package first (unless user redefined)
  const userPkgs = design.packages || [];
  if (!userPkgs.some((p) => p.name === "std")) {
    compilePackage(createStdPackageAst());
  }
  for (const pkg of userPkgs) compilePackage(pkg);
  elaborateModule(top, "", null, null, null);

  return {
    top: topName,
    signals,
    assigns,
    processes,
    ports,
    tasks,
    functions,
    classes: classTable,
    timeCtx: normalizeTimeCtx(timeCtx),
    hierarchy: hierarchy.slice().sort(
      (a, b) => a.split(".").length - b.split(".").length || a.localeCompare(b)
    ),
  };
}

/**
 * @param {Map<string, object>|undefined} classes
 * @param {string} className
 * @param {string} methodName
 * @param {{ fromSuper?: boolean }} [opts]
 */
function lookupMethod(classes, className, methodName, opts = {}) {
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

function checkMemberAccess(member, memberName, ctx) {
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

function slotGet(slot) {
  if (!slot) return null;
  if (slot.isHandle) return slot.handle;
  if (slot.isString) return makeSvString(slot.str);
  if (slot.isDynArray || slot.isQueue) return slot; // whole collection (for assignment copy)
  return slot.value;
}

function requireValue(v, what) {
  if (isHandle(v)) throw new Error(`${what}: expected bit value, got class handle`);
  if (isSvString(v)) throw new Error(`${what}: expected bit value, got string`);
  if (v && (v.isDynArray || v.isQueue)) {
    throw new Error(`${what}: expected bit value, got array/queue`);
  }
  return v;
}

/**
 * Allocate object and run constructor.
 * @returns {{ $h: true, oid: number|null }}
 */
function allocObject(className, args, signals, ctx) {
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

function runSuperNew(args, signals, ctx) {
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

function runClassFunction(method, thisHandle, args, signals, ctx) {
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

function resolveRecvHandle(recv, signals, ctx) {
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

function resolveCollectionSlot(recv, signals, ctx) {
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

/**
 * Evaluate system functions (`$random`, `$urandom`).
 * @param {object} expr
 * @param {Map<string, any>} signals
 * @param {{ locals?: Map<string, any>, nextRandom?: () => number }} ctx
 */
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
      const s = lookup(expr.name);
      if (!s) throw new Error(`Unknown signal '${expr.name}'`);
      if (s.access && s.access !== "public") checkMemberAccess(s, expr.name, ctx);
      return slotGet(s);
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
      if (op === "&") return bitwiseBin(lv, rv, (a, b) => a & b);
      if (op === "|") return bitwiseBin(lv, rv, (a, b) => a | b);
      if (op === "^") return bitwiseBin(lv, rv, (a, b) => a ^ b);
      if (op === "~^" || op === "^~") return bitwiseBin(lv, rv, (a, b) => ~(a ^ b) & 1);
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
