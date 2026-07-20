import { createParseContext } from "./parse-ctx.js";
import { attachParseExpr } from "./parse-expr.js";
import { attachParseStmt } from "./parse-stmt.js";
import { attachParseClass } from "./parse-class.js";
import { attachParseUdp } from "./parse-udp.js";
import { attachParseSpecify } from "./parse-specify.js";
import { attachParseConfig } from "./parse-config.js";
import { attachParseInterface } from "./parse-interface.js";
import { attachParseModule } from "./parse-module.js";

/**
 * Recursive-descent parser for Supported subset v0.
 */
export function parse(source) {
  const ctx = createParseContext(source);
  attachParseExpr(ctx);
  attachParseStmt(ctx);
  attachParseClass(ctx);
  attachParseUdp(ctx);
  attachParseSpecify(ctx);
  attachParseConfig(ctx);
  // Module parsers first — interface body reuses parseVarDecl / parseParamDecls
  attachParseModule(ctx);
  attachParseInterface(ctx);

  const modules = [];
  const packages = [];
  const udps = [];
  const libraries = [];
  const configs = [];
  const interfaces = [];
  /** @type {string} */
  let currentLib = "work";
  let celldefine = false;

  while (!ctx.at("eof")) {
    if (ctx.at("celldefine")) {
      ctx.eat("celldefine");
      celldefine = true;
      continue;
    }
    if (ctx.at("endcelldefine")) {
      ctx.eat("endcelldefine");
      celldefine = false;
      continue;
    }
    if (ctx.at("library")) {
      const lib = ctx.parseLibrary();
      libraries.push(lib);
      currentLib = lib.name;
      continue;
    }
    if (ctx.at("config")) {
      configs.push(ctx.parseConfig());
      continue;
    }
    if (ctx.at("package")) {
      packages.push(ctx.parsePackage());
      continue;
    }
    if (ctx.at("interface")) {
      const iface = ctx.parseInterface();
      iface.library = currentLib;
      iface.celldefine = celldefine;
      interfaces.push(iface);
      continue;
    }
    if (ctx.at("module")) {
      const m = ctx.parseModule();
      m.library = currentLib;
      m.celldefine = celldefine;
      modules.push(m);
      continue;
    }
    if (ctx.at("primitive")) {
      const u = ctx.parsePrimitive();
      u.library = currentLib;
      u.celldefine = celldefine;
      udps.push(u);
      continue;
    }
    ctx.error("Expected package, module, interface, primitive, library, or config");
  }
  if (!modules.length) ctx.error("No modules found");
  return {
    type: "Design",
    modules,
    packages,
    udps,
    libraries,
    configs,
    interfaces,
  };
}

export function unsupported(feature) {
  throw new Error(`Unsupported in subset v0: ${feature}`);
}
