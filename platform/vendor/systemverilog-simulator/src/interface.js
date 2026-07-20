/**
 * Interface helpers (pure) — J6 / J6b.
 * See J6_INTERFACES.md.
 */

/**
 * Collect signal members from an interface AST.
 * @param {object} ifaceAst
 * @returns {{ name: string, width: number|null, range: object|null, kind: string }[]}
 */
export function ifaceSignalMembers(ifaceAst) {
  /** @type {{ name: string, width: number|null, range: object|null, kind: string }[]} */
  const out = [];
  for (const it of ifaceAst.items || []) {
    if (it.type === "VarDecl" || it.type === "PortDecl") {
      const kind = it.kind || "logic";
      const width = it.width;
      const range = it.range;
      const names =
        it.type === "PortDecl"
          ? it.names
          : (it.decls || []).map((d) => d.name);
      for (const n of names) {
        out.push({ name: n, width, range, kind });
      }
    }
  }
  return out;
}

/**
 * @param {object} ifaceAst
 * @param {string} modportName
 */
export function getModport(ifaceAst, modportName) {
  if (!modportName) return null;
  const mp = (ifaceAst.items || []).find(
    (it) => it.type === "Modport" && it.name === modportName
  );
  if (!mp) throw new Error(`Unknown modport '${modportName}' on interface '${ifaceAst.name}'`);
  return mp;
}

/**
 * Members visible through a modport (or all signals if no modport).
 * @param {object} ifaceAst
 * @param {string|null} modportName
 */
export function ifacePortMembers(ifaceAst, modportName) {
  const all = ifaceSignalMembers(ifaceAst);
  if (!modportName) return all.map((m) => ({ ...m, direction: "inout" }));
  const mp = getModport(ifaceAst, modportName);
  const byName = new Map(all.map((m) => [m.name, m]));
  return mp.members.map((mem) => {
    const base = byName.get(mem.name);
    if (!base) {
      throw new Error(
        `Modport '${modportName}' member '${mem.name}' not in interface '${ifaceAst.name}'`
      );
    }
    return { ...base, direction: mem.direction };
  });
}

/** @param {any} v */
export function isVifHandle(v) {
  return Boolean(v && typeof v === "object" && v.$vif === true);
}

export function makeVifHandle(path = null) {
  return { $vif: true, path: path || null };
}

export const NULL_VIF = makeVifHandle(null);
