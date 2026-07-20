/**
 * Verilog preprocessor (subset):
 * `include, `define/`undef, `ifdef/`ifndef/`else/`elsif/`endif, `timescale (ignored).
 * Runs before lex/parse so backtick directives never hit the lexer.
 */

/**
 * @param {string} text
 * @param {{
 *   files?: Record<string, string>,
 *   name?: string,
 *   stack?: string[],
 *   defines?: Record<string, string>,
 *   incdirs?: string[],
 * }} [opts]
 * @returns {string}
 */
export function preprocess(text, opts = {}) {
  const files = opts.files || {};
  const name = opts.name || "<source>";
  const stack = opts.stack || [];
  const incdirs = opts.incdirs || [];
  /** Shared across includes so defines persist */
  const defines = opts.defines || {};
  if (stack.includes(name)) {
    throw new Error(`Circular \`include involving '${name}' at ${name}:1:1`);
  }
  const nextStack = stack.concat(name);
  const lines = String(text).split(/\r?\n/);
  /** @type {string[]} */
  const out = [];

  /**
   * Conditional stack frame:
   * - parentActive: outer region was emitting
   * - taking: this branch currently emits
   * - eaten: a branch of this if already emitted (else/elsif won't)
   */
  /** @type {{ parentActive: boolean, taking: boolean, eaten: boolean }[]} */
  const cond = [];

  function regionActive() {
    return cond.every((f) => f.taking);
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    const loc = `${name}:${li + 1}:1`;

    if (trimmed.startsWith("`")) {
      const ifdef = trimmed.match(/^`ifdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
      if (ifdef) {
        const parentActive = regionActive();
        const taking = parentActive && Object.prototype.hasOwnProperty.call(defines, ifdef[1]);
        cond.push({ parentActive, taking, eaten: taking });
        continue;
      }

      const ifndef = trimmed.match(/^`ifndef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
      if (ifndef) {
        const parentActive = regionActive();
        const taking =
          parentActive && !Object.prototype.hasOwnProperty.call(defines, ifndef[1]);
        cond.push({ parentActive, taking, eaten: taking });
        continue;
      }

      const elsif = trimmed.match(/^`elsif\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
      if (elsif) {
        if (!cond.length) throw new Error(`\`elsif without \`ifdef at ${loc}`);
        const f = cond[cond.length - 1];
        if (f.eaten || !f.parentActive) f.taking = false;
        else if (Object.prototype.hasOwnProperty.call(defines, elsif[1])) {
          f.taking = true;
          f.eaten = true;
        } else f.taking = false;
        continue;
      }

      if (/^`else\s*$/.test(trimmed)) {
        if (!cond.length) throw new Error(`\`else without \`ifdef at ${loc}`);
        const f = cond[cond.length - 1];
        if (f.eaten || !f.parentActive) f.taking = false;
        else {
          f.taking = true;
          f.eaten = true;
        }
        continue;
      }

      if (/^`endif\s*$/.test(trimmed)) {
        if (!cond.length) throw new Error(`\`endif without \`ifdef at ${loc}`);
        cond.pop();
        continue;
      }

      // Remaining directives only apply in active regions
      if (!regionActive()) continue;

      const inc = trimmed.match(/^`include\s+(?:"([^"]+)"|<([^>]+)>)\s*$/);
      if (inc) {
        const path = inc[1] || inc[2];
        const body = resolveInclude(path, files, incdirs);
        if (body == null) {
          throw new Error(`\`include "${path}" not found at ${loc}`);
        }
        const expanded = preprocess(body, {
          files,
          name: path,
          stack: nextStack,
          defines,
          incdirs,
        });
        out.push(expanded);
        continue;
      }

      if (/^`timescale\b/.test(trimmed)) {
        continue;
      }

      // `celldefine / `endcelldefine → design-level keywords for the parser
      if (/^`celldefine\s*$/.test(trimmed)) {
        out.push("celldefine");
        continue;
      }
      if (/^`endcelldefine\s*$/.test(trimmed)) {
        out.push("endcelldefine");
        continue;
      }

      const def = trimmed.match(/^`define\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(.*))?$/);
      if (def) {
        defines[def[1]] = def[2] != null ? def[2].trimEnd() : "";
        continue;
      }

      const und = trimmed.match(/^`undef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
      if (und) {
        delete defines[und[1]];
        continue;
      }

      // Mid-line macros or unknown — expand if active
      out.push(expandMacros(line, defines, name, li + 1));
      continue;
    }

    if (!regionActive()) continue;
    out.push(expandMacros(line, defines, name, li + 1));
  }

  if (cond.length) {
    throw new Error(`Unclosed \`ifdef/\`ifndef at ${name}:1:1`);
  }

  return out.join("\n");
}

/**
 * @param {string} line
 * @param {Record<string, string>} defines
 * @param {string} file
 * @param {number} lineNo
 * @param {number} [depth]
 */
function expandMacros(line, defines, file, lineNo, depth = 0) {
  if (depth > 32) throw new Error(`Macro expansion too deep at ${file}:${lineNo}:1`);
  let out = "";
  let i = 0;
  let inStr = false;
  while (i < line.length) {
    const c = line[i];
    if (inStr) {
      out += c;
      if (c === "\\" && i + 1 < line.length) {
        out += line[++i];
      } else if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      i++;
      continue;
    }
    if (c === "`" && /[a-zA-Z_]/.test(line[i + 1] || "")) {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const mac = line.slice(i + 1, j);
      if (!Object.prototype.hasOwnProperty.call(defines, mac)) {
        throw new Error(`Undefined macro \`${mac} at ${file}:${lineNo}:1`);
      }
      out += expandMacros(defines[mac], defines, file, lineNo, depth + 1);
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * @param {string} path
 * @param {Record<string, string>} files
 */
/**
 * @param {string} path
 * @param {Record<string, string>} files
 * @param {string[]} [incdirs]
 */
function resolveInclude(path, files, incdirs = []) {
  const candidates = [path];
  for (const dir of incdirs) {
    const d = String(dir || "").replace(/[/\\]+$/, "");
    if (d) candidates.push(`${d}/${path}`, `${d}\\${path}`);
  }
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(files, c)) return files[c];
  }
  const base = path.replace(/^.*[\\/]/, "");
  if (base !== path && Object.prototype.hasOwnProperty.call(files, base)) return files[base];
  for (const k of Object.keys(files)) {
    if (
      k === path ||
      k.endsWith("/" + path) ||
      k.endsWith("\\" + path) ||
      k.split(/[\\/]/).pop() === base
    ) {
      return files[k];
    }
    for (const dir of incdirs) {
      const d = String(dir || "").replace(/[/\\]+$/, "");
      if (d && (k === `${d}/${path}` || k === `${d}\\${path}` || k.endsWith(`/${base}`) || k.endsWith(`\\${base}`))) {
        return files[k];
      }
    }
  }
  return null;
}

/**
 * Normalize engine/UI input into a single preprocessed source string.
 *
 * @param {string|string[]|object} input
 * @param {{ files?: Record<string, string>, entry?: string, defines?: Record<string, string>, incdirs?: string[] }} [opts]
 * @returns {string}
 */
export function materializeSources(input, opts = {}) {
  /** @type {Record<string, string>} */
  const fileMap = { ...(opts.files || {}) };
  /** @type {string[]} */
  let order = [];
  const seedDefines = { ...(opts.defines || {}) };
  const incdirs = [...(opts.incdirs || [])];

  if (typeof input === "string") {
    fileMap["<source>"] = fileMap["<source>"] ?? input;
    return preprocess(input, {
      files: fileMap,
      name: opts.entry || "<source>",
      defines: { ...seedDefines },
      incdirs,
    });
  }

  if (Array.isArray(input)) {
    input.forEach((item, i) => {
      if (typeof item === "string") {
        const n = `file${i}.v`;
        fileMap[n] = item;
        order.push(n);
      } else if (item && typeof item === "object") {
        const n = item.name || `file${i}.v`;
        fileMap[n] = item.source ?? item.text ?? "";
        order.push(n);
      }
    });
  } else if (input && typeof input === "object") {
    const files = input.files;
    if (Array.isArray(files)) {
      files.forEach((item, i) => {
        if (typeof item === "string") {
          const n = `file${i}.v`;
          fileMap[n] = item;
          order.push(n);
        } else {
          const n = item.name || `file${i}.v`;
          fileMap[n] = item.source ?? item.text ?? "";
          order.push(n);
        }
      });
    } else if (files && typeof files === "object") {
      for (const [k, v] of Object.entries(files)) {
        fileMap[k] = String(v);
        order.push(k);
      }
    } else {
      throw new Error("materializeSources: expected string, array, or { files }");
    }
    if (input.entry) opts = { ...opts, entry: input.entry };
    if (input.defines && typeof input.defines === "object") {
      Object.assign(seedDefines, input.defines);
    }
    if (Array.isArray(input.incdirs)) incdirs.push(...input.incdirs);
  } else {
    throw new Error("materializeSources: invalid input");
  }

  const entry = opts.entry;
  const defines = { ...seedDefines };
  if (entry) {
    if (!Object.prototype.hasOwnProperty.call(fileMap, entry)) {
      throw new Error(`Entry file '${entry}' not found at ${entry}:1:1`);
    }
    return preprocess(fileMap[entry], { files: fileMap, name: entry, defines, incdirs });
  }

  const joined = order.map((n) => fileMap[n]).join("\n");
  return preprocess(joined, {
    files: fileMap,
    name: order[0] || "<source>",
    defines,
    incdirs,
  });
}
