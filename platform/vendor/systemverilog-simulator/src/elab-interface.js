/**
 * Interface elaboration — instances, modport ports, .* / ref (J6 / J6b).
 * See J6_INTERFACES.md / MODULARITY.md.
 */

import {
  ifaceSignalMembers,
  ifacePortMembers,
  getModport,
} from "./interface.js";

/**
 * @param {{
 *   signals: Map<string, object>,
 *   fullName: Function,
 *   addSignal: Function,
 *   resolveWidth: Function,
 *   evalConstInt: Function,
 *   ifaceTypes: Map<string, object>,
 *   ifaceInstances: Map<string, { type: string, modport?: string|null }>,
 *   vifVars: Map<string, string>,
 * }} ctx
 */
export function createInterfaceLowering(ctx) {
  const {
    signals,
    fullName,
    addSignal,
    resolveWidth,
    evalConstInt,
    ifaceTypes,
    ifaceInstances,
    vifVars,
  } = ctx;

  function registerInterfaces(list) {
    for (const iface of list || []) {
      if (ifaceTypes.has(iface.name)) {
        throw new Error(`Duplicate interface '${iface.name}'`);
      }
      ifaceTypes.set(iface.name, iface);
      // Validate modport members early
      for (const it of iface.items || []) {
        if (it.type === "Modport") ifacePortMembers(iface, it.name);
      }
    }
  }

  function expandIfaceInstance(ifaceName, instName, path, params) {
    const ast = ifaceTypes.get(ifaceName);
    if (!ast) throw new Error(`Unknown interface '${ifaceName}'`);
    const ifacePath = fullName(path, instName);
    if (ifaceInstances.has(ifacePath)) {
      throw new Error(`Duplicate interface instance '${ifacePath}'`);
    }
    ifaceInstances.set(ifacePath, { type: ifaceName, modport: null });
    const members = ifaceSignalMembers(ast);
    for (const m of members) {
      const w = resolveWidth(m.width, m.range, params || new Map());
      addSignal(ifacePath, m.name, w, m.kind || "logic");
    }
    return ifacePath;
  }

  /**
   * Alias module interface port `portName` to parent iface instance path.
   * @returns {Map<string,string>} entries to merge into childPorts
   */
  function connectIfacePort(port, parentIfacePath, childPath) {
    /** @type {Map<string, string>} */
    const aliases = new Map();
    const ast = ifaceTypes.get(port.interface);
    if (!ast) throw new Error(`Unknown interface type '${port.interface}'`);
    if (port.modport) getModport(ast, port.modport); // validate
    // Port name aliases to the interface instance root
    aliases.set(port.name, parentIfacePath);
    // Also alias each member for flat Ident rewrite of rare `port.member` via MemberAccess
    const members = ifacePortMembers(ast, port.modport || null);
    for (const m of members) {
      const childMem = `${port.name}.${m.name}`;
      const parentMem = `${parentIfacePath}.${m.name}`;
      aliases.set(childMem, parentMem);
    }
    ifaceInstances.set(fullName(childPath, port.name), {
      type: port.interface,
      modport: port.modport || null,
      aliasOf: parentIfacePath,
    });
    return aliases;
  }

  /**
   * J6b: fill remaining ports by name from parent scope.
   */
  function applyDotStar(child, childPath, childPorts, parentPath, parentPortMap, connected) {
    for (const p of child.ports) {
      if (connected.has(p.name)) continue;
      const localName = p.name;
      let parentName =
        parentPortMap && parentPortMap.has(localName)
          ? parentPortMap.get(localName)
          : fullName(parentPath, localName);

      if (p.interface || p.kind === "interface" || p.direction === "interface") {
        if (!ifaceInstances.has(parentName)) {
          throw new Error(
            `.* cannot connect interface port '${p.name}': no interface instance '${parentName}' in parent`
          );
        }
        const extra = connectIfacePort(p, parentName, childPath);
        for (const [k, v] of extra) childPorts.set(k, v);
        connected.add(p.name);
        continue;
      }

      // Net / ref port — require a parent signal
      if (!signals.has(parentName)) {
        // Try bare name in parent (top)
        const bare = localName;
        if (signals.has(bare) && !parentPath) parentName = bare;
        else {
          throw new Error(
            `.* cannot connect port '${p.name}': no signal '${parentName}' in parent`
          );
        }
      }
      const childSig = fullName(childPath, p.name);
      signals.delete(childSig);
      childPorts.set(p.name, parentName);
      connected.add(p.name);
    }
  }

  function isIfaceType(name) {
    return ifaceTypes.has(name);
  }

  return {
    registerInterfaces,
    expandIfaceInstance,
    connectIfacePort,
    applyDotStar,
    isIfaceType,
    ifaceSignalMembers: (name) => ifaceSignalMembers(ifaceTypes.get(name)),
  };
}
