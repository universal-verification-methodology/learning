/**
 * Parse IEEE 1800 interface / modport (J6).
 * See J6_INTERFACES.md.
 */

export function attachParseInterface(ctx) {
  const { eat, match, at, peek, error } = ctx;

  function parseModport() {
    eat("modport");
    const name = eat("id").value;
    eat("(");
    const members = [];
    /** @type {string} */
    let direction = "inout";
    while (!at(")") && !at("eof")) {
      if (at("input") || at("output") || at("inout") || at("ref")) {
        direction = eat(peek().type).type;
      }
      members.push({ name: eat("id").value, direction });
      if (at(")")) break;
      if (match(",")) continue;
      if (at("input") || at("output") || at("inout") || at("ref")) continue;
      error("Expected ',' or ')' in modport");
    }
    eat(")");
    eat(";");
    return { type: "Modport", name, members };
  }

  function parseInterfaceItem() {
    if (at("modport")) return parseModport();
    if (at("parameter") || at("localparam")) return ctx.parseParameterItem();
    if (at("input") || at("output") || at("inout")) return ctx.parsePortDecl();
    if (
      at("wire") ||
      at("reg") ||
      at("logic") ||
      at("bit") ||
      at("integer") ||
      at("tri") ||
      at("string")
    ) {
      return ctx.parseVarDecl();
    }
    if (at("id") && ctx.looksLikeTypedefVarDecl()) return ctx.parseTypedefVarDecl();
    error("Unexpected interface item");
  }

  function parseInterface() {
    eat("interface");
    const name = eat("id").value;
    /** @type {{ name: string, expr: object }[]} */
    let parameters = [];
    if (match("#")) {
      eat("(");
      if (!at(")")) parameters = ctx.parseParamDecls();
      eat(")");
    }
    if (match("(")) {
      if (!at(")")) {
        error("ANSI ports on interface not supported yet — declare signals in body");
      }
      eat(")");
    }
    eat(";");
    const items = [];
    while (!at("endinterface") && !at("eof")) {
      items.push(parseInterfaceItem());
    }
    eat("endinterface");
    const bodyParams = [];
    const other = [];
    for (const it of items) {
      if (it.type === "Parameter") {
        for (const d of it.decls) bodyParams.push(d);
      } else other.push(it);
    }
    return {
      type: "Interface",
      name,
      parameters: parameters.concat(bodyParams),
      items: other,
    };
  }

  /**
   * Interface-typed port: [virtual] iface[.modport] name
   * Caller must ensure this isn't a plain net port.
   * @returns {object|null}
   */
  function tryParseInterfacePort(dirHint = null) {
    const saved = ctx.pos;
    let isVirtual = false;
    if (match("virtual")) isVirtual = true;
    if (!at("id")) {
      ctx.pos = saved;
      return null;
    }
    const iface = eat("id").value;
    let modport = null;
    if (match(".")) {
      if (!at("id")) {
        ctx.pos = saved;
        return null;
      }
      modport = eat("id").value;
    }
    if (!at("id")) {
      ctx.pos = saved;
      return null;
    }
    const pname = eat("id").value;
    return {
      name: pname,
      direction: "interface",
      kind: "interface",
      interface: iface,
      modport,
      virtual: isVirtual,
      width: 0,
      range: null,
      ref: dirHint === "ref",
    };
  }

  Object.assign(ctx, {
    parseInterface,
    parseModport,
    tryParseInterfacePort,
  });
}
