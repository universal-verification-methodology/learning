/**
 * Extracted from parser.js (modularity M5). See MODULARITY.md.
 */

export function attachParseModule(ctx) {
  const { eat, match, at, peek, error, tokens } = ctx;

function parsePortDir() {
  if (match("input") || match("output") || match("inout") || match("ref")) {
    return tokens[ctx.pos - 1].type;
  }
  return null;
}

/** virtual [interface] bus_if vif; */
function tryParseVifDecl() {
  if (!at("virtual")) return null;
  const saved = ctx.pos;
  eat("virtual");
  match("interface");
  if (!at("id")) {
    ctx.pos = saved;
    return null;
  }
  const iface = eat("id").value;
  if (!at("id")) {
    ctx.pos = saved;
    return null;
  }
  const decls = [];
  do {
    decls.push({ name: eat("id").value });
  } while (match(","));
  eat(";");
  return { type: "VifDecl", interface: iface, decls };
}

function parseParamDecls() {
  /** @type {{ name: string, expr: object }[]} */
  const decls = [];
  do {
    // optional "parameter" / "localparam" inside #()
    match("parameter") || match("localparam");
    const name = eat("id").value;
    eat("=");
    const expr = ctx.parseExpression();
    decls.push({ name, expr });
  } while (match(","));
  return decls;
}

function parseModule() {
  eat("module");
  const name = eat("id").value;
  /** @type {{ name: string, expr: object }[]} */
  let parameters = [];
  const ports = [];
  const items = [];

  if (match("#")) {
    eat("(");
    if (!at(")")) parameters = parseParamDecls();
    eat(")");
  }

  if (match("(")) {
    if (!at(")")) {
      do {
        let dir = null;
        if (match("ref")) dir = "ref";
        else dir = parsePortDir();

        // J6: interface port — [virtual] iface[.modport] name
        {
          const ip = ctx.tryParseInterfacePort?.(dir);
          if (ip) {
            if (dir === "ref") ip.ref = true;
            ports.push(ip);
            continue;
          }
        }

        let kind = null;
        if (match("wire") || match("reg") || match("logic") || match("bit")) {
          kind = tokens[ctx.pos - 1].type;
        }
        const range = ctx.parseRange();
        const wr = ctx.parseWidthFromRange(range);
        const pname = eat("id").value;
        ports.push({
          name: pname,
          direction: dir || "inout",
          kind: kind || "wire",
          width: wr.width,
          range: wr.range || range,
          ref: dir === "ref",
        });
      } while (match(","));
    }
    eat(")");
  }
  eat(";");

  while (!at("endmodule") && !at("eof")) {
    items.push(parseItem());
  }
  eat("endmodule");
  // Hoist parameter items into module.parameters
  const bodyParams = [];
  const otherItems = [];
  for (const it of items) {
    if (it.type === "Parameter") {
      for (const d of it.decls) bodyParams.push(d);
    } else otherItems.push(it);
  }
  parameters = parameters.concat(bodyParams);
  return { type: "Module", name, parameters, ports, items: otherItems };
}

function parseItem() {
  if (at("import")) return parseImport();
  if (at("typedef")) return ctx.parseTypedef();
  if (at("class")) return ctx.parseClass();
  if (at("virtual")) {
    const vif = tryParseVifDecl();
    if (vif) return vif;
  }
  if (at("timeunit") || at("timeprecision")) return parseTimeUnitsDecl();
  if (at("parameter") || at("localparam")) return parseParameterItem();
  if (at("genvar")) return parseGenvar();
  if (at("generate")) return parseGenerate();
  if (at("task")) return parseTask();
  if (at("function")) return parseFunction();
  if (at("input") || at("output") || at("inout")) return parsePortDecl();
  if (
    at("wire") ||
    at("reg") ||
    at("integer") ||
    at("logic") ||
    at("bit") ||
    at("tri") ||
    at("wand") ||
    at("wor") ||
    at("triand") ||
    at("trior") ||
    at("tri0") ||
    at("tri1") ||
    at("trireg") ||
    at("supply0") ||
    at("supply1") ||
    at("pull0") ||
    at("pull1") ||
    at("string")
  )
    return parseVarDecl();
  if (at("event")) return parseEventDecl();
  if (at("defparam")) return parseDefParam();
  if (at("specparam")) return ctx.parseSpecparamDecls();
  if (at("specify")) return ctx.parseSpecify();
  if (at("assign")) return parseAssign();
  if (atGate()) return parseGate();
  if (atAlways()) return ctx.parseAlways();
  if (at("initial")) return ctx.parseInitial();
  if (at("id")) {
    if (ctx.looksLikeTypedefVarDecl()) return ctx.parseTypedefVarDecl();
    return ctx.parseCellOrInstance();
  }
  error("Unexpected module item");
}

function parseTimeLiteral() {
  if (!at("number") && !at("literal")) error("Expected time value");
  let value;
  if (at("number")) value = eat("number").value;
  else {
    // reject based literals as time
    error("Expected decimal time value");
  }
  let unit = null;
  if (at("id")) {
    const u = peek().value;
    if (/^(s|ms|us|ns|ps|fs)$/.test(u)) {
      eat("id");
      unit = u;
    }
  }
  return { value, unit };
}

function parseTimeUnitsDecl() {
  if (match("timeunit")) {
    const unit = parseTimeLiteral();
    let precision = null;
    if (match("/")) precision = parseTimeLiteral();
    eat(";");
    return { type: "TimeUnit", unit, precision };
  }
  eat("timeprecision");
  const precision = parseTimeLiteral();
  eat(";");
  return { type: "TimePrecision", precision };
}

function atGate() {
  return (
    at("and") ||
    at("or") ||
    at("nand") ||
    at("nor") ||
    at("xor") ||
    at("xnor") ||
    at("buf") ||
    at("not") ||
    at("bufif0") ||
    at("bufif1") ||
    at("notif0") ||
    at("notif1") ||
    at("pullup") ||
    at("pulldown") ||
    at("nmos") ||
    at("pmos") ||
    at("cmos") ||
    at("rnmos") ||
    at("rpmos") ||
    at("rcmos") ||
    at("tran") ||
    at("tranif0") ||
    at("tranif1") ||
    at("rtran") ||
    at("rtranif0") ||
    at("rtranif1")
  );
}

function atStrengthKeyword() {
  return (
    at("supply0") ||
    at("supply1") ||
    at("strong0") ||
    at("strong1") ||
    at("pull0") ||
    at("pull1") ||
    at("weak0") ||
    at("weak1") ||
    at("highz0") ||
    at("highz1") ||
    at("large0") ||
    at("large1") ||
    at("medium0") ||
    at("medium1") ||
    at("small0") ||
    at("small1")
  );
}

function atStrengthKeywordAhead() {
  const t = tokens[ctx.pos + 1];
  if (!t) return false;
  const n = t.type;
  return (
    n === "supply0" ||
    n === "supply1" ||
    n === "strong0" ||
    n === "strong1" ||
    n === "pull0" ||
    n === "pull1" ||
    n === "weak0" ||
    n === "weak1" ||
    n === "highz0" ||
    n === "highz1" ||
    n === "large0" ||
    n === "large1" ||
    n === "medium0" ||
    n === "medium1" ||
    n === "small0" ||
    n === "small1"
  );
}

function parseDriveStrength(allowSingle = false) {
  if (!at("(") || !atStrengthKeywordAhead()) return null;
  eat("(");
  const first = eat(peek().type).type;
  if (match(",")) {
    if (!atStrengthKeyword()) error("Expected drive strength (e.g. strong0)");
    const second = eat(peek().type).type;
    eat(")");
    return { s1: first, s0: second, single: false };
  }
  if (!allowSingle) error("Expected strength pair (strength1, strength0)");
  eat(")");
  return { s1: first, s0: first, single: true };
}

function parseGate() {
  const gate = eat(peek().type).type;
  const isPull = gate === "pullup" || gate === "pulldown";
  const isSwitch =
    gate === "nmos" ||
    gate === "pmos" ||
    gate === "cmos" ||
    gate === "rnmos" ||
    gate === "rpmos" ||
    gate === "rcmos" ||
    gate === "tran" ||
    gate === "tranif0" ||
    gate === "tranif1" ||
    gate === "rtran" ||
    gate === "rtranif0" ||
    gate === "rtranif1";
  let strength = null;
  if (!isSwitch) strength = parseDriveStrength(isPull);
  let delay = 0;
  if (match("#")) delay = ctx.parseDelayValue();

  /** @type {{ name: string|null, range: object|null, terminals: object[] }[]} */
  const instances = [];
  do {
    let name = null;
    /** @type {object|null} */
    let range = null;
    if (at("id")) {
      name = eat("id").value;
      if (at("[")) range = ctx.parseRange();
    }
    eat("(");
    const terminals = [];
    if (!at(")")) {
      do {
        terminals.push(ctx.parseExpression());
      } while (match(","));
    }
    eat(")");
    instances.push({ name, range, terminals });
  } while (match(","));
  eat(";");

  let minTerms = 2;
  if (isPull) minTerms = 1;
  else if (gate === "tran" || gate === "rtran") minTerms = 2;
  else if (
    gate === "tranif0" ||
    gate === "tranif1" ||
    gate === "rtranif0" ||
    gate === "rtranif1" ||
    gate === "nmos" ||
    gate === "pmos" ||
    gate === "rnmos" ||
    gate === "rpmos"
  )
    minTerms = 3;
  else if (gate === "cmos" || gate === "rcmos") minTerms = 4;
  else if (gate === "buf" || gate === "not") minTerms = 2; // ≥1 out + 1 in

  for (const inst of instances) {
    if (inst.terminals.length < minTerms) {
      error(`${gate} requires at least ${minTerms} terminal(s)`);
    }
  }

  if (instances.length === 1 && !instances[0].range) {
    return {
      type: "Gate",
      gate,
      delay,
      name: instances[0].name,
      terminals: instances[0].terminals,
      strength,
      range: null,
    };
  }
  return { type: "GateList", gate, delay, strength, instances };
}

function parseAssign() {
  eat("assign");
  const strength = parseDriveStrength();
  let delay = 0;
  if (match("#")) delay = ctx.parseDelayValue();
  /** @type {{ lhs: object, rhs: object }[]} */
  const assigns = [];
  do {
    const lhs = ctx.parseLValue();
    eat("=");
    const rhs = ctx.parseExpression();
    assigns.push({ lhs, rhs });
  } while (match(","));
  eat(";");
  if (assigns.length === 1) {
    return {
      type: "ContinuousAssign",
      lhs: assigns[0].lhs,
      rhs: assigns[0].rhs,
      delay,
      strength,
    };
  }
  return { type: "ContinuousAssignList", assigns, delay, strength };
}

function parseImport() {
  eat("import");
  /** @type {{ package: string, names: string[]|"*" }[]} */
  const items = [];
  do {
    const pkg = eat("id").value;
    eat("::");
    if (match("*")) {
      items.push({ package: pkg, names: "*" });
    } else {
      // p::A or p::A, B, C (same package) or stop before next p2::
      const names = [eat("id").value];
      while (at(",") && tokens[ctx.pos + 1]?.type === "id" && tokens[ctx.pos + 2]?.type !== "::") {
        eat(",");
        names.push(eat("id").value);
      }
      items.push({ package: pkg, names });
    }
  } while (match(","));
  eat(";");
  if (items.length === 1) {
    return { type: "Import", package: items[0].package, names: items[0].names };
  }
  return { type: "ImportList", items };
}

function parseExport() {
  eat("export");
  if (at("*")) {
    eat("*");
    eat("::");
    eat("*");
    eat(";");
    return { type: "Export", all: true, items: [] };
  }
  /** @type {{ package: string, names: string[]|"*" }[]} */
  const items = [];
  do {
    const pkg = eat("id").value;
    eat("::");
    if (match("*")) items.push({ package: pkg, names: "*" });
    else items.push({ package: pkg, names: [eat("id").value] });
  } while (match(","));
  eat(";");
  return { type: "Export", all: false, items };
}

function parsePackage() {
  eat("package");
  const name = eat("id").value;
  eat(";");
  const items = [];
  while (!at("endpackage") && !at("eof")) {
    if (at("parameter") || at("localparam")) items.push(parseParameterItem());
    else if (at("timeunit") || at("timeprecision")) items.push(parseTimeUnitsDecl());
    else if (at("typedef")) items.push(ctx.parseTypedef());
    else if (at("class")) items.push(ctx.parseClass());
    else if (at("function")) items.push(parseFunction());
    else if (at("task")) items.push(parseTask());
    else if (at("import")) items.push(parseImport());
    else if (at("export")) items.push(parseExport());
    else if (
      at("wire") ||
      at("reg") ||
      at("integer") ||
      at("logic") ||
      at("bit") ||
      at("string")
    ) {
      items.push(parseVarDecl());
    } else if (at("id") && ctx.looksLikeTypedefVarDecl()) {
      items.push(ctx.parseTypedefVarDecl());
    } else
      error(
        "Unexpected package item (supported: parameter, typedef, class, function, task, import, export, variables, timeunit)"
      );
  }
  eat("endpackage");
  return { type: "Package", name, items };
}

function atAlways() {
  return at("always") || at("always_ff") || at("always_comb") || at("always_latch");
}

function matchNetType() {
  if (
    match("wire") ||
    match("reg") ||
    match("logic") ||
    match("bit") ||
    match("integer") ||
    match("tri") ||
    match("wand") ||
    match("wor") ||
    match("triand") ||
    match("trior") ||
    match("tri0") ||
    match("tri1") ||
    match("trireg") ||
    match("supply0") ||
    match("supply1") ||
    match("pull0") ||
    match("pull1")
  ) {
    return tokens[ctx.pos - 1].type;
  }
  return null;
}

function parseGenvar() {
  eat("genvar");
  const names = [];
  do {
    names.push(eat("id").value);
  } while (match(","));
  eat(";");
  return { type: "GenvarDecl", names };
}

function parseGenerate() {
  eat("generate");
  const items = [];
  while (!at("endgenerate") && !at("eof")) {
    items.push(parseGenerateItem());
  }
  eat("endgenerate");
  return { type: "Generate", items };
}

function parseGenerateItem() {
  if (at("for")) return parseGenFor();
  if (at("if")) return parseGenIf();
  if (at("begin")) return parseGenBlock();
  if (at("genvar")) return parseGenvar();
  // Plain module items allowed inside generate
  if (
    at("wire") ||
    at("reg") ||
    at("integer") ||
    at("logic") ||
    at("bit") ||
    at("tri") ||
    at("wand") ||
    at("wor") ||
    at("triand") ||
    at("trior") ||
    at("tri0") ||
    at("tri1") ||
    at("trireg") ||
    at("supply0") ||
    at("supply1") ||
    at("pull0") ||
    at("pull1")
  )
    return parseVarDecl();
  if (at("assign")) return parseAssign();
  if (atGate()) return parseGate();
  if (atAlways()) return ctx.parseAlways();
  if (at("initial")) return ctx.parseInitial();
  if (at("id")) return ctx.parseCellOrInstance();
  error("Unexpected generate item");
}

function parseGenIfBody() {
  if (match("begin")) {
    let name = null;
    if (match(":")) name = eat("id").value;
    const items = [];
    while (!at("end") && !at("eof")) items.push(parseGenerateItem());
    eat("end");
    return { name, items };
  }
  return { name: null, items: [parseGenerateItem()] };
}

function parseGenIf() {
  eat("if");
  eat("(");
  const cond = ctx.parseExpression();
  eat(")");
  const then = parseGenIfBody();
  let els = null;
  if (match("else")) {
    if (at("if")) els = { name: null, items: [parseGenIf()] };
    else els = parseGenIfBody();
  }
  return { type: "GenIf", cond, then, else: els };
}

function parseGenFor() {
  eat("for");
  eat("(");
  const gv = eat("id").value;
  eat("=");
  const init = ctx.parseExpression();
  eat(";");
  const cond = ctx.parseExpression();
  eat(";");
  const stepLhs = eat("id").value;
  if (stepLhs !== gv) error("genvar for-step must assign the same genvar");
  eat("=");
  const step = ctx.parseExpression();
  eat(")");
  let blockName = null;
  const body = [];
  if (match("begin")) {
    if (match(":")) blockName = eat("id").value;
    while (!at("end") && !at("eof")) body.push(parseGenerateItem());
    eat("end");
  } else {
    body.push(parseGenerateItem());
  }
  return {
    type: "GenFor",
    genvar: gv,
    init,
    cond,
    step,
    blockName: blockName || "genblk",
    body,
  };
}

function parseGenBlock() {
  eat("begin");
  let name = null;
  if (match(":")) name = eat("id").value;
  const items = [];
  while (!at("end") && !at("eof")) items.push(parseGenerateItem());
  eat("end");
  return { type: "GenBlock", name: name || "genblk", items };
}

function parseTask() {
  eat("task");
  match("automatic");
  const name = eat("id").value;
  eat(";");
  const ports = [];
  const decls = [];
  while (!at("begin") && !at("endtask") && !at("eof")) {
    if (at("input") || at("output") || at("inout")) {
      ports.push(parseTfPortDecl());
    } else if (at("reg") || at("integer") || at("wire") || at("logic") || at("bit")) {
      decls.push(parseVarDecl());
    } else if (at("id") && ctx.looksLikeTypedefVarDecl()) {
      decls.push(ctx.parseTypedefVarDecl());
    } else break;
  }
  const body = at("endtask")
    ? { type: "Block", stmts: [] }
    : ctx.parseStatement();
  eat("endtask");
  return { type: "Task", name, ports, decls, body };
}

function parseTfPortDecl() {
  const dir = parsePortDir();
  // Class / typedef handle port: input Foo h;
  if (at("id") && tokens[ctx.pos + 1]?.type === "id") {
    const typeName = eat("id").value;
    const names = [];
    do {
      names.push(eat("id").value);
    } while (match(","));
    eat(";");
    return {
      type: "TfPortDecl",
      direction: dir,
      kind: "class",
      typeName,
      width: 0,
      range: null,
      names,
    };
  }
  let kind = "reg";
  const nt = matchNetType();
  if (nt) kind = nt;
  const range = kind === "integer" ? null : ctx.parseRange();
  const wr = kind === "integer" ? { width: 32, range: null } : ctx.parseWidthFromRange(range);
  const names = [];
  do {
    names.push(eat("id").value);
  } while (match(","));
  eat(";");
  return {
    type: "TfPortDecl",
    direction: dir,
    kind,
    width: wr.width,
    range: wr.range || range,
    names,
  };
}

function parseFunction() {
  eat("function");
  match("automatic");
  let range = null;
  let width = 1;
  let isVoid = false;
  if (match("void")) {
    isVoid = true;
    width = 0;
  } else if (at("[")) {
    range = ctx.parseRange();
    const wr = ctx.parseWidthFromRange(range);
    width = wr.width;
    range = wr.range || range;
  } else if (match("integer")) {
    width = 32;
  } else if (match("logic") || match("bit") || match("reg")) {
    range = ctx.parseRange();
    const wr = ctx.parseWidthFromRange(range);
    width = wr.width ?? 1;
    range = wr.range || range;
  }
  let name;
  if (at("new")) {
    name = "new";
    eat("new");
  } else {
    name = eat("id").value;
  }
  const ports = [];
  const decls = [];
  eat(";");
  while (!at("begin") && !at("endfunction") && !at("eof")) {
    if (at("input") || at("output") || at("inout")) {
      ports.push(parseTfPortDecl());
    } else if (at("reg") || at("integer") || at("wire") || at("logic") || at("bit")) {
      decls.push(parseVarDecl());
    } else if (at("id") && ctx.looksLikeTypedefVarDecl()) {
      decls.push(ctx.parseTypedefVarDecl());
    } else break;
  }
  const body = at("endfunction")
    ? { type: "Block", stmts: [] }
    : ctx.parseStatement();
  eat("endfunction");
  return { type: "Function", name, width, range, ports, decls, body, isVoid };
}

function parseParameterItem() {
  eat(peek().type); // parameter|localparam
  const decls = [];
  do {
    const name = eat("id").value;
    eat("=");
    decls.push({ name, expr: ctx.parseExpression() });
  } while (match(","));
  eat(";");
  return { type: "Parameter", decls };
}

function parsePortDecl() {
  const dir = parsePortDir();
  let kind = "wire";
  const nt = matchNetType();
  if (nt && nt !== "integer") kind = nt;
  else if (nt === "integer") kind = "integer";
  const range = kind === "integer" ? null : ctx.parseRange();
  const wr =
    kind === "integer" ? { width: 32, range: null } : ctx.parseWidthFromRange(range);
  const names = [];
  do {
    names.push(eat("id").value);
  } while (match(","));
  eat(";");
  return {
    type: "PortDecl",
    direction: dir,
    kind,
    width: wr.width,
    range: wr.range || range,
    names,
  };
}

function parseVarDecl() {
  const kind = eat(peek().type).type; // wire|reg|logic|bit|integer|string|tri|…
  const isString = kind === "string";
  /** @type {string|null} */
  let charge = null;
  /** @type {number|{rise:number,fall:number,toff?:number}} */
  let delay = 0;
  if (kind === "trireg") {
    if (at("(") && atChargeAhead()) {
      eat("(");
      charge = eat(peek().type).type;
      eat(")");
    }
    if (match("#")) delay = ctx.parseDelayValue();
  }
  const range = isString || kind === "integer" ? null : ctx.parseRange();
  const wr = isString
    ? { width: 0, range: null }
    : kind === "integer"
      ? { width: 32, range: null }
      : ctx.parseWidthFromRange(range);
  const decls = [];
  do {
    const name = eat("id").value;
    let memRange = null;
    let unpacked = null;
    let init = null;
    if (at("[")) {
      const u = ctx.parseUnpackedDim();
      memRange = u.memRange;
      unpacked = u.unpacked;
    }
    if (match("=")) init = ctx.parseExpression();
    decls.push({ name, init, memRange, unpacked });
  } while (match(","));
  eat(";");
  return {
    type: "VarDecl",
    kind,
    width: wr.width,
    range: wr.range || range,
    decls,
    charge,
    delay,
  };
}

function atChargeAhead() {
  const t = tokens[ctx.pos + 1];
  return t && (t.type === "large" || t.type === "medium" || t.type === "small");
}

function parseEventDecl() {
  eat("event");
  const names = [];
  do {
    names.push(eat("id").value);
  } while (match(","));
  eat(";");
  return { type: "EventDecl", names };
}

function parseDefParam() {
  eat("defparam");
  const decls = [];
  do {
    const path = [eat("id").value];
    while (match(".")) path.push(eat("id").value);
    eat("=");
    decls.push({ path, expr: ctx.parseExpression() });
  } while (match(","));
  eat(";");
  return { type: "DefParam", decls };
}

function parseInstanceOrError() {
  const modname = eat("id").value;
  /** @type {object[]} */
  let params = [];
  if (match("#")) {
    eat("(");
    if (!at(")")) {
      if (at(".")) {
        do {
          eat(".");
          const pname = eat("id").value;
          eat("(");
          const expr = ctx.parseExpression();
          eat(")");
          params.push({ type: "Named", name: pname, expr });
        } while (match(","));
      } else {
        do {
          params.push({ type: "Positional", expr: ctx.parseExpression() });
        } while (match(","));
      }
    }
    eat(")");
  }
  if (!at("id")) error(`Expected instance name after '${modname}'`);
  const inst = eat("id").value;
  eat("(");
  const conns = [];
  if (!at(")")) {
    if (at(".")) {
      do {
        eat(".");
        if (match("*")) {
          conns.push({ type: "DotStar" });
        } else {
          const port = eat("id").value;
          eat("(");
          const expr = at(")") ? null : ctx.parseExpression();
          eat(")");
          conns.push({ type: "Named", port, expr });
        }
      } while (match(","));
    } else {
      do {
        conns.push({ type: "Positional", expr: ctx.parseExpression() });
      } while (match(","));
    }
  }
  eat(")");
  eat(";");
  return { type: "Instance", module: modname, name: inst, params, conns };
}

  Object.assign(ctx, {
    parsePortDir,
    parseParamDecls,
    parseModule,
    parseItem,
    parseTimeLiteral,
    parseTimeUnitsDecl,
    atGate,
    atStrengthKeyword,
    atStrengthKeywordAhead,
    parseDriveStrength,
    parseGate,
    parseAssign,
    parseImport,
    parseExport,
    parsePackage,
    atAlways,
    matchNetType,
    parseGenvar,
    parseGenerate,
    parseGenerateItem,
    parseGenIfBody,
    parseGenIf,
    parseGenFor,
    parseGenBlock,
    parseTask,
    parseTfPortDecl,
    parseFunction,
    parseParameterItem,
    parsePortDecl,
    parseVarDecl,
    atChargeAhead,
    parseEventDecl,
    parseDefParam,
    parseInstanceOrError,
  });
}
