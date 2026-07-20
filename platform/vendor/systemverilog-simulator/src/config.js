/**
 * Library table + config binding resolution (pure).
 * Modularity V8 — see V8_CONFIG.md.
 */

/**
 * @param {object} design
 * @returns {Map<string, Map<string, { kind: 'module'|'udp', ast: object }>>}
 */
export function buildLibraryTable(design) {
  /** @type {Map<string, Map<string, { kind: string, ast: object }>>} */
  const libs = new Map();

  function ensure(lib) {
    if (!libs.has(lib)) libs.set(lib, new Map());
    return libs.get(lib);
  }

  ensure("work");
  for (const lib of design.libraries || []) {
    ensure(lib.name);
  }

  for (const m of design.modules || []) {
    const lib = m.library || "work";
    const bucket = ensure(lib);
    if (bucket.has(m.name)) {
      throw new Error(`Duplicate cell '${m.name}' in library '${lib}'`);
    }
    bucket.set(m.name, { kind: "module", ast: m });
  }
  for (const u of design.udps || []) {
    const lib = u.library || "work";
    const bucket = ensure(lib);
    if (bucket.has(u.name)) {
      throw new Error(`Duplicate cell '${u.name}' in library '${lib}'`);
    }
    bucket.set(u.name, { kind: "udp", ast: u });
  }
  return libs;
}

/**
 * @param {object} design
 * @param {string|null|undefined} configName
 */
export function selectConfig(design, configName) {
  const configs = design.configs || [];
  if (configName) {
    const c = configs.find((x) => x.name === configName);
    if (!c) throw new Error(`Config '${configName}' not found`);
    return c;
  }
  if (configs.length) return configs[configs.length - 1];
  return null;
}

/**
 * @param {Map<string, Map<string, object>>} libs
 * @param {{ lib: string|null, cell: string }} use
 */
export function lookupUse(libs, use) {
  const cell = use.cell;
  if (use.lib) {
    const bucket = libs.get(use.lib);
    if (!bucket || !bucket.has(cell)) {
      throw new Error(`Unknown cell '${use.lib}.${cell}'`);
    }
    const hit = bucket.get(cell);
    return { ...hit, lib: use.lib, key: `${use.lib}.${cell}` };
  }
  // bare cell — search work only for explicit use without lib
  const work = libs.get("work");
  if (work && work.has(cell)) {
    return { ...work.get(cell), lib: "work", key: `work.${cell}` };
  }
  throw new Error(`Unknown cell '${cell}'`);
}

/**
 * @param {string} hier instance hierarchical path (e.g. "u1" or "top.u1.g0")
 * @param {string[]} rulePath
 */
export function pathMatches(hier, rulePath) {
  const r = rulePath.join(".");
  if (!r) return false;
  if (hier === r) return true;
  if (hier.endsWith(`.${r}`)) return true;
  return false;
}

/**
 * Resolve which design unit an instance of cellName should bind to.
 * @param {Map<string, Map<string, object>>} libs
 * @param {object|null} config
 * @param {string} hierPath
 * @param {string} cellName
 */
export function resolveBinding(libs, config, hierPath, cellName) {
  const rules = config?.rules || [];

  for (const rule of rules) {
    if (rule.type === "Instance" && pathMatches(hierPath, rule.path)) {
      const use = {
        lib: rule.use.lib,
        cell: rule.use.cell || cellName,
      };
      if (!use.cell) use.cell = cellName;
      // instance … use lib.cell — cell name in use may rename
      return lookupUse(libs, {
        lib: use.lib,
        cell: rule.use.cell,
      });
    }
  }

  for (const rule of rules) {
    if (rule.type === "Cell" && rule.cell === cellName) {
      return lookupUse(libs, {
        lib: rule.use.lib,
        cell: rule.use.cell || cellName,
      });
    }
  }

  /** @type {string[]} */
  let liblist = ["work"];
  for (const rule of rules) {
    if (rule.type === "Default" && rule.liblist?.length) {
      liblist = rule.liblist.slice();
      break;
    }
  }

  for (const lib of liblist) {
    const bucket = libs.get(lib);
    if (bucket && bucket.has(cellName)) {
      const hit = bucket.get(cellName);
      return { ...hit, lib, key: `${lib}.${cellName}` };
    }
  }

  // Compat: if no config, also scan all libs (last resort) when only work was searched
  // and cell missing — still error. If config null, liblist is work only which matches
  // pre-V8 flat map for units in work.
  throw new Error(`Unknown cell '${cellName}'` + (hierPath ? ` (instance '${hierPath}')` : ""));
}

/**
 * Pick top module name from opts / config / design.
 * @param {object} design
 * @param {{ top?: string, config?: string }} opts
 * @param {object|null} config
 */
export function resolveTopName(design, opts, config) {
  if (opts.top) return opts.top;
  if (config?.design?.cell) return config.design.cell;
  const mods = design.modules || [];
  if (!mods.length) throw new Error("No modules found");
  return mods[mods.length - 1].name;
}
