import { createParseContext } from "./parse-ctx.js";
import { attachParseExpr } from "./parse-expr.js";
import { attachParseStmt } from "./parse-stmt.js";
import { attachParseClass } from "./parse-class.js";
import { attachParseModule } from "./parse-module.js";
import { attachParseUdp } from "./parse-udp.js";

/**
 * Recursive-descent parser for Supported subset v0.
 * @param {string} source
 * @returns {{ type: 'Design', modules: object[], packages: object[], udps: object[] }}
 */
export function parse(source) {
  const ctx = createParseContext(source);
  attachParseExpr(ctx);
  attachParseStmt(ctx);
  attachParseClass(ctx);
  attachParseUdp(ctx);
  attachParseModule(ctx);

  const modules = [];
  const packages = [];
  const udps = [];
  while (!ctx.at("eof")) {
    if (ctx.at("package")) packages.push(ctx.parsePackage());
    else if (ctx.at("module")) modules.push(ctx.parseModule());
    else if (ctx.at("primitive")) udps.push(ctx.parsePrimitive());
    else ctx.error("Expected package, module, or primitive");
  }
  if (!modules.length) ctx.error("No modules found");
  return { type: "Design", modules, packages, udps };
}

export function unsupported(feature) {
  throw new Error(`Unsupported in subset v0: ${feature}`);
}
