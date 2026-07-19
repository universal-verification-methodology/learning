import { parseLiteral } from "./literal.js";
import { Value } from "./value.js";
import { MAX_W } from "./literal.js";
import { NULL_HANDLE } from "./handle.js";
import { createStdPackageAst } from "./std-package.js";
import { isSvString, makeSvString } from "./sv-array.js";
import { timeLiteralToFs, normalizeTimeCtx } from "./time.js";
import {
  STRENGTH_LEVEL,
  DEFAULT_CHARGE,
  emptyRails,
} from "./value.js";
import { createGateAssignLowering, isNetDeclKind } from "./elab-gates.js";
import { createUdpLowering } from "./elab-udp.js";

/** Re-export runtime eval for callers that historically imported from elaborate. */
export { evalExpr, applyLValue, execBlocking } from "./eval-expr.js";

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
  /** @type {Map<string, object>} UDP name → compiled def */
  const udps = new Map();

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
      case "Disable":
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
    if (item.type === "CellInst") {
      elaborateCellInst(item, genPath, modPath, portMap, params, true);
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


  const {
    expandAndPushGate,
    pushContinuousAssign,
    addNetDeclAssigns,
  } = createGateAssignLowering({
    assigns,
    signals,
    fullName,
    rewriteExpr,
    rewriteLValue,
    evalConstInt,
    resolveWidth,
  });

  const { registerUdps, expandAndPushUdp } = createUdpLowering({
    assigns,
    udps,
    signals,
    fullName,
    rewriteExpr,
    rewriteLValue,
    evalConstInt,
  });

  function cellInstAsModuleInstances(item) {
    /** @type {object[]} */
    const out = [];
    for (const inst of item.instances) {
      if (!inst.name) {
        throw new Error(`Module instance '${item.cell}' requires an instance name`);
      }
      let params = item.params || [];
      // Gate-style `#10 name` stored delay+params; modules use params
      if (!params.length && item.delay != null && item.delay !== 0) {
        const d = item.delay;
        const n = typeof d === "number" ? d : d.typ ?? d.rise ?? 0;
        params = [{ type: "Positional", expr: { type: "Number", value: n } }];
      }
      out.push({
        type: "Instance",
        module: item.cell,
        name: inst.name,
        params,
        conns: inst.conns,
      });
    }
    return out;
  }

  function elaborateCellInst(item, declPath, refPath, portMap, params, genMode = false) {
    if (udps.has(item.cell)) {
      expandAndPushUdp(item, declPath, refPath, portMap, params);
      return;
    }
    if (byName.has(item.cell)) {
      for (const inst of cellInstAsModuleInstances(item)) {
        if (genMode) elaborateGenItem(inst, declPath, refPath, portMap, params);
        else elaborateItem(inst, declPath, portMap, params);
      }
      return;
    }
    throw new Error(`Unknown cell '${item.cell}' (not a module or UDP)`);
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
    } else if (item.type === "CellInst") {
      elaborateCellInst(item, path, path, portMap, params, false);
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
  registerUdps(design.udps || []);
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
    udps,
    timeCtx: normalizeTimeCtx(timeCtx),
    hierarchy: hierarchy.slice().sort(
      (a, b) => a.split(".").length - b.split(".").length || a.localeCompare(b)
    ),
  };
}
