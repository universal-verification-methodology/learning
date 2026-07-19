import { lex } from "./lexer.js";

/**
 * Recursive-descent parser for Supported subset v0.
 * @param {string} source
 * @returns {{ type: 'Design', modules: object[] }}
 */
export function parse(source) {
  const tokens = lex(source);
  let pos = 0;

  const peek = () => tokens[pos];
  const at = (type) => peek().type === type;
  const loc = () => ({ line: peek().line, col: peek().col });

  function error(msg) {
    const t = peek();
    throw new Error(`${msg} at ${t.line}:${t.col} (got ${t.type}${t.value != null ? ` '${t.value}'` : ""})`);
  }

  function eat(type) {
    if (!at(type)) error(`Expected '${type}'`);
    return tokens[pos++];
  }

  function match(type) {
    if (at(type)) {
      pos++;
      return true;
    }
    return false;
  }

  function parseRange() {
    if (!match("[")) return null;
    const msb = parseExpression();
    eat(":");
    const lsb = parseExpression();
    eat("]");
    return { msb, lsb };
  }

  function parsePortDir() {
    if (match("input") || match("output") || match("inout")) {
      return tokens[pos - 1].type;
    }
    return null;
  }

  function parseWidthFromRange(range) {
    if (!range) return { width: 1, range: null };
    // Constant ranges resolved now; param-based ranges deferred to elaborate
    const msb = evalConst(range.msb);
    const lsb = evalConst(range.lsb);
    if (msb == null || lsb == null) return { width: null, range };
    return { width: Math.abs(msb - lsb) + 1, range };
  }

  function evalConst(node) {
    if (!node) return null;
    if (node.type === "Number") return node.value;
    if (node.type === "Unary" && node.op === "-" && node.expr.type === "Number") {
      return -node.expr.value;
    }
    if (node.type === "Binary") {
      const l = evalConst(node.left);
      const r = evalConst(node.right);
      if (l == null || r == null) return null;
      if (node.op === "+") return l + r;
      if (node.op === "-") return l - r;
      if (node.op === "*") return l * r;
    }
    return null;
  }

  function parseParamDecls() {
    /** @type {{ name: string, expr: object }[]} */
    const decls = [];
    do {
      // optional "parameter" / "localparam" inside #()
      match("parameter") || match("localparam");
      const name = eat("id").value;
      eat("=");
      const expr = parseExpression();
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
          const dir = parsePortDir();
          let kind = null;
          if (match("wire") || match("reg") || match("logic") || match("bit")) kind = tokens[pos - 1].type;
          const range = parseRange();
          const wr = parseWidthFromRange(range);
          const pname = eat("id").value;
          ports.push({
            name: pname,
            direction: dir || "inout",
            kind: kind || "wire",
            width: wr.width,
            range: wr.range || range,
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
    if (at("typedef")) return parseTypedef();
    if (at("class")) return parseClass();
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
    if (at("assign")) return parseAssign();
    if (atGate()) return parseGate();
    if (atAlways()) return parseAlways();
    if (at("initial")) return parseInitial();
    if (at("id")) {
      if (looksLikeTypedefVarDecl()) return parseTypedefVarDecl();
      return parseInstanceOrError();
    }
    error("Unexpected module item");
  }

  /** Parse 1ns / 10ps / 1 (dimensionless step) */
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

  function parseClass() {
    eat("class");
    const name = eat("id").value;
    let base = null;
    if (match("extends")) base = eat("id").value;
    eat(";");
    /** @type {object[]} */
    const props = [];
    /** @type {object[]} */
    const methods = [];
    while (!at("endclass") && !at("eof")) {
      let access = "public";
      if (match("local")) access = "local";
      else if (match("protected")) access = "protected";
      const isStatic = match("static");

      const virt = match("virtual");
      if (at("function")) {
        const fn = parseFunction();
        methods.push({ ...fn, virtual: virt, methodKind: "function", access, isStatic });
        continue;
      }
      if (at("task")) {
        if (virt) error("virtual tasks are not supported yet");
        if (isStatic) error("static tasks are not supported yet");
        const task = parseTask();
        methods.push({ ...task, virtual: false, methodKind: "task", access, isStatic: false });
        continue;
      }
      if (virt) error("Expected function after virtual");
      if (isStatic) error("static properties are not supported yet");
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
      ) {
        const pd = parseVarDecl();
        props.push({ ...pd, access });
        continue;
      }
      if (at("id") && looksLikeTypedefVarDecl()) {
        const pd = parseTypedefVarDecl();
        props.push({ ...pd, access });
        continue;
      }
      error("Unexpected class item (supported: properties, function, task)");
    }
    eat("endclass");
    return { type: "Class", name, base, props, methods };
  }

  /** TypeName name; / TypeName name = …; / TypeName [lo:hi] name; */
  function looksLikeTypedefVarDecl() {
    if (!at("id")) return false;
    const t1 = tokens[pos + 1];
    const t2 = tokens[pos + 2];
    if (!t1) return false;
    if (t1.type === "[") return true;
    if (t1.type !== "id") return false;
    if (!t2) return false;
    if (t2.type === "(" || t2.type === "#") return false;
    return t2.type === ";" || t2.type === "=" || t2.type === "[";
  }

  function parseTypedefVarDecl() {
    const typeName = eat("id").value;
    /** @type {{ msb: object, lsb: object }|null} */
    let sharedMem = null;
    if (at("[")) {
      const save = pos;
      const mr = parseRange();
      if (at("id")) sharedMem = mr;
      else pos = save;
    }
    const decls = [];
    do {
      const name = eat("id").value;
      let memRange = sharedMem;
      let init = null;
      let unpacked = null;
      if (!memRange && at("[")) {
        const u = parseUnpackedDim();
        memRange = u.memRange;
        unpacked = u.unpacked;
      }
      if (match("=")) init = parseExpression();
      decls.push({ name, init, memRange, unpacked });
      sharedMem = null;
    } while (match(","));
    eat(";");
    return { type: "VarDecl", kind: null, typeName, width: null, range: null, decls };
  }

  /** After `[`: `]` dynamic, `$]` queue, or `msb:lsb]` fixed memory. */
  function parseUnpackedDim() {
    eat("[");
    if (match("]")) return { memRange: null, unpacked: { kind: "dynamic" } };
    if (match("$")) {
      eat("]");
      return { memRange: null, unpacked: { kind: "queue" } };
    }
    const msb = parseExpression();
    eat(":");
    const lsb = parseExpression();
    eat("]");
    return { memRange: { msb, lsb }, unpacked: null };
  }

  function parseTypedef() {
    eat("typedef");
    if (at("enum")) return parseTypedefEnum();
    if (at("struct")) return parseTypedefStruct();
    const nt = matchNetType();
    if (!nt) error("Expected type after typedef (logic/bit/reg/…, enum, or struct)");
    const range = nt === "integer" ? null : parseRange();
    const wr = nt === "integer" ? { width: 32, range: null } : parseWidthFromRange(range);
    const name = eat("id").value;
    eat(";");
    return {
      type: "Typedef",
      name,
      alias: { kind: nt, width: wr.width, range: wr.range || range },
    };
  }

  function parseTypedefEnum() {
    eat("enum");
    let kind = "logic";
    let width = 32;
    let range = null;
    const nt = matchNetType();
    if (nt) {
      kind = nt === "integer" ? "integer" : nt;
      if (nt === "integer") {
        width = 32;
        range = null;
      } else {
        range = parseRange();
        const wr = parseWidthFromRange(range);
        width = wr.width;
        range = wr.range || range;
      }
    }
    eat("{");
    const members = [];
    do {
      if (at("}")) break;
      const mname = eat("id").value;
      let value = null;
      if (match("=")) value = parseExpression();
      members.push({ name: mname, value });
    } while (match(","));
    eat("}");
    const name = eat("id").value;
    eat(";");
    return {
      type: "Typedef",
      name,
      enum: { kind, width, range, members },
    };
  }

  function parseTypedefStruct() {
    eat("struct");
    if (!match("packed")) error("Only packed structs are supported (typedef struct packed {…})");
    eat("{");
    const fields = [];
    while (!at("}") && !at("eof")) {
      fields.push(parseStructField());
    }
    eat("}");
    const name = eat("id").value;
    eat(";");
    return { type: "Typedef", name, struct: { packed: true, fields } };
  }

  function parseStructField() {
    const nt = matchNetType();
    if (nt) {
      const range = nt === "integer" ? null : parseRange();
      const wr = nt === "integer" ? { width: 32, range: null } : parseWidthFromRange(range);
      const fname = eat("id").value;
      eat(";");
      return {
        name: fname,
        kind: nt,
        width: wr.width,
        range: wr.range || range,
        typeName: null,
      };
    }
    if (at("id")) {
      const typeName = eat("id").value;
      const fname = eat("id").value;
      eat(";");
      return { name: fname, kind: null, width: null, range: null, typeName };
    }
    error("Expected struct field declaration");
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
    const t = tokens[pos + 1];
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

  /**
   * Optional strength after assign/gate.
   * Pair: (strong1, weak0) either order.
   * Single (pullup/pulldown): (strong1) or (pull0).
   */
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
    if (match("#")) delay = parseDelayValue();

    /** @type {{ name: string|null, range: object|null, terminals: object[] }[]} */
    const instances = [];
    do {
      let name = null;
      /** @type {object|null} */
      let range = null;
      if (at("id")) {
        name = eat("id").value;
        if (at("[")) range = parseRange();
      }
      eat("(");
      const terminals = [];
      if (!at(")")) {
        do {
          terminals.push(parseExpression());
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
    if (match("#")) delay = parseDelayValue();
    /** @type {{ lhs: object, rhs: object }[]} */
    const assigns = [];
    do {
      const lhs = parseLValue();
      eat("=");
      const rhs = parseExpression();
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
        while (at(",") && tokens[pos + 1]?.type === "id" && tokens[pos + 2]?.type !== "::") {
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
      else if (at("typedef")) items.push(parseTypedef());
      else if (at("class")) items.push(parseClass());
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
      } else if (at("id") && looksLikeTypedefVarDecl()) {
        items.push(parseTypedefVarDecl());
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
      return tokens[pos - 1].type;
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
    if (atAlways()) return parseAlways();
    if (at("initial")) return parseInitial();
    if (at("id")) return parseInstanceOrError();
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
    const cond = parseExpression();
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
    const init = parseExpression();
    eat(";");
    const cond = parseExpression();
    eat(";");
    const stepLhs = eat("id").value;
    if (stepLhs !== gv) error("genvar for-step must assign the same genvar");
    eat("=");
    const step = parseExpression();
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
      } else if (at("id") && looksLikeTypedefVarDecl()) {
        decls.push(parseTypedefVarDecl());
      } else break;
    }
    const body = at("endtask")
      ? { type: "Block", stmts: [] }
      : parseStatement();
    eat("endtask");
    return { type: "Task", name, ports, decls, body };
  }

  function parseTfPortDecl() {
    const dir = parsePortDir();
    // Class / typedef handle port: input Foo h;
    if (at("id") && tokens[pos + 1]?.type === "id") {
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
    const range = kind === "integer" ? null : parseRange();
    const wr = kind === "integer" ? { width: 32, range: null } : parseWidthFromRange(range);
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
      range = parseRange();
      const wr = parseWidthFromRange(range);
      width = wr.width;
      range = wr.range || range;
    } else if (match("integer")) {
      width = 32;
    } else if (match("logic") || match("bit") || match("reg")) {
      range = parseRange();
      const wr = parseWidthFromRange(range);
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
      } else if (at("id") && looksLikeTypedefVarDecl()) {
        decls.push(parseTypedefVarDecl());
      } else break;
    }
    const body = at("endfunction")
      ? { type: "Block", stmts: [] }
      : parseStatement();
    eat("endfunction");
    return { type: "Function", name, width, range, ports, decls, body, isVoid };
  }

  function parseParameterItem() {
    eat(peek().type); // parameter|localparam
    const decls = [];
    do {
      const name = eat("id").value;
      eat("=");
      decls.push({ name, expr: parseExpression() });
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
    const range = kind === "integer" ? null : parseRange();
    const wr =
      kind === "integer" ? { width: 32, range: null } : parseWidthFromRange(range);
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
      if (match("#")) delay = parseDelayValue();
    }
    const range = isString || kind === "integer" ? null : parseRange();
    const wr = isString
      ? { width: 0, range: null }
      : kind === "integer"
        ? { width: 32, range: null }
        : parseWidthFromRange(range);
    const decls = [];
    do {
      const name = eat("id").value;
      let memRange = null;
      let unpacked = null;
      let init = null;
      if (at("[")) {
        const u = parseUnpackedDim();
        memRange = u.memRange;
        unpacked = u.unpacked;
      }
      if (match("=")) init = parseExpression();
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
    const t = tokens[pos + 1];
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
      decls.push({ path, expr: parseExpression() });
    } while (match(","));
    eat(";");
    return { type: "DefParam", decls };
  }

  function parseAlways() {
    let svKind = null;
    if (match("always_ff")) svKind = "ff";
    else if (match("always_comb")) svKind = "comb";
    else if (match("always_latch")) svKind = "latch";
    else eat("always");

    let sens = null;
    if (match("@")) {
      if (match("*")) {
        sens = { type: "Star" };
      } else {
        eat("(");
        if (match("*")) {
          eat(")");
          sens = { type: "Star" };
        } else {
          sens = parseSensList();
          eat(")");
        }
      }
    } else if (svKind === "comb" || svKind === "latch") {
      sens = { type: "Star" };
    } else if (svKind === "ff") {
      error("always_ff requires an @(...) sensitivity list");
    } else {
      // Timed always (e.g. always #5 clk = ~clk) — treated as forever loop
      sens = { type: "Timed" };
    }
    const body = parseStatement();
    return { type: "Always", sens, body, svKind };
  }

  function parseSensList() {
    const items = [];
    do {
      if (match("posedge") || match("negedge")) {
        const edge = tokens[pos - 1].type;
        const name = eat("id").value;
        items.push({ type: "Edge", edge, name });
      } else if (match("or")) {
        continue;
      } else {
        const name = eat("id").value;
        items.push({ type: "Level", name });
      }
    } while (match("or") || match(","));
    return { type: "SensList", items };
  }

  function parseInitial() {
    eat("initial");
    const body = parseStatement();
    return { type: "Initial", body };
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
            const expr = parseExpression();
            eat(")");
            params.push({ type: "Named", name: pname, expr });
          } while (match(","));
        } else {
          do {
            params.push({ type: "Positional", expr: parseExpression() });
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
          const port = eat("id").value;
          eat("(");
          const expr = at(")") ? null : parseExpression();
          eat(")");
          conns.push({ type: "Named", port, expr });
        } while (match(","));
      } else {
        do {
          conns.push({ type: "Positional", expr: parseExpression() });
        } while (match(","));
      }
    }
    eat(")");
    eat(";");
    return { type: "Instance", module: modname, name: inst, params, conns };
  }

  function parseStatement() {
    if (at("begin")) return parseBlock();
    if (at("fork")) return parseFork();
    if (at("if")) return parseIf();
    if (at("for")) return parseFor();
    if (at("while")) return parseWhile();
    if (at("repeat")) return parseRepeat();
    if (at("case") || at("casex") || at("casez")) return parseCase();
    if (at("forever")) {
      eat("forever");
      return { type: "Forever", body: parseStatement() };
    }
    if (at("wait")) {
      eat("wait");
      if (at("fork")) {
        eat("fork");
        match(";");
        return { type: "WaitFork" };
      }
      eat("(");
      const expr = parseExpression();
      eat(")");
      match(";");
      return { type: "Wait", expr };
    }
    if (at("disable")) {
      eat("disable");
      eat("fork");
      match(";");
      return { type: "DisableFork" };
    }
    if (at("force")) {
      eat("force");
      const lhs = parseLValue();
      eat("=");
      const rhs = parseExpression();
      eat(";");
      return { type: "Force", lhs, rhs };
    }
    if (at("release")) {
      eat("release");
      const lhs = parseLValue();
      eat(";");
      return { type: "Release", lhs };
    }
    if (at("assign")) {
      eat("assign");
      const lhs = parseLValue();
      eat("=");
      const rhs = parseExpression();
      eat(";");
      return { type: "ProcAssign", lhs, rhs };
    }
    if (at("deassign")) {
      eat("deassign");
      const lhs = parseLValue();
      eat(";");
      return { type: "Deassign", lhs };
    }
    if (at("->")) {
      eat("->");
      const name = eat("id").value;
      eat(";");
      return { type: "EventTrigger", name };
    }
    if (at("@")) {
      eat("@");
      let items;
      if (match("(")) {
        if (match("*")) {
          eat(")");
          items = [{ type: "Star" }];
        } else {
          items = parseSensList().items;
          eat(")");
        }
      } else if (match("*")) {
        items = [{ type: "Star" }];
      } else if (match("posedge") || match("negedge")) {
        const edge = tokens[pos - 1].type;
        const name = eat("id").value;
        items = [{ type: "Edge", edge, name }];
      } else {
        const name = eat("id").value;
        items = [{ type: "Level", name }];
      }
      match(";");
      return { type: "EventControl", items };
    }
    if (at("#")) {
      eat("#");
      const delay = parseDelayValue();
      if (at(";") || at("end") || at("else") || at("eof") || at("endcase") || at("join")) {
        match(";");
        return { type: "Delay", delay };
      }
      return { type: "DelayStmt", delay, stmt: parseStatement() };
    }
    if (at("systask")) {
      const name = eat("systask").value;
      const args = [];
      if (match("(")) {
        if (!at(")")) {
          do {
            if (at("string")) args.push({ type: "String", value: eat("string").value });
            else args.push(parseExpression());
          } while (match(","));
        }
        eat(")");
      }
      eat(";");
      return { type: "SysTask", name, args };
    }
    // super.new(...);  or  super.method(...);
    if (at("super")) {
      eat("super");
      eat(".");
      if (at("new")) {
        eat("new");
        const args = [];
        if (match("(")) {
          if (!at(")")) {
            do {
              args.push(parseExpression());
            } while (match(","));
          }
          eat(")");
        }
        eat(";");
        return { type: "SuperNewStmt", args };
      }
      const name = eat("id").value;
      eat("(");
      const args = [];
      if (!at(")")) {
        do {
          args.push(parseExpression());
        } while (match(","));
      }
      eat(")");
      eat(";");
      return {
        type: "MethodCallStmt",
        recv: { type: "Super" },
        name,
        args,
      };
    }
    // Method call statement: obj.m(...);  or  this.m(...);
    if (at("this") || at("id")) {
      const t1 = tokens[pos + 1];
      const t2 = tokens[pos + 2];
      const t3 = tokens[pos + 3];
      if (t1 && t1.type === "." && t2 && t2.type === "id" && t3 && t3.type === "(") {
        const expr = parsePostfix();
        eat(";");
        if (expr.type !== "MethodCall") error("Expected method call");
        return {
          type: "MethodCallStmt",
          recv: expr.recv,
          name: expr.name,
          args: expr.args,
        };
      }
    }
    // Task enable: name;  or  name(args);
    if (at("id")) {
      const next = tokens[pos + 1];
      if (next && (next.type === ";" || next.type === "(")) {
        const name = eat("id").value;
        const args = [];
        if (match("(")) {
          if (!at(")")) {
            do {
              args.push(parseExpression());
            } while (match(","));
          }
          eat(")");
        }
        eat(";");
        return { type: "TaskCall", name, args };
      }
    }
    const lhs = parseLValue();
    let op;
    if (match("<=")) op = "<=";
    else {
      eat("=");
      op = "=";
    }
    const rhs = parseExpression();
    eat(";");
    return { type: op === "<=" ? "NBA" : "Blocking", lhs, rhs };
  }

  function parseFork() {
    eat("fork");
    const branches = [];
    while (!at("join") && !at("join_any") && !at("join_none") && !at("eof")) {
      branches.push(parseStatement());
    }
    let join = "join";
    if (match("join_any")) join = "join_any";
    else if (match("join_none")) join = "join_none";
    else eat("join");
    return { type: "Fork", branches, join };
  }

  function parseDelayValue() {
    // #N  or  #10ns  or  #(n)  or  #(rise, fall)  or  #(rise, fall, toff)
    // Each slot may be mintypmax: min:typ:max (we take typ)
    if (match("(")) {
      const nums = [];
      do {
        nums.push(parseDelayNumberOrMintypmax());
      } while (match(","));
      eat(")");
      if (nums.length === 1) return nums[0];
      if (nums.length === 2) return { rise: nums[0], fall: nums[1] };
      return { rise: nums[0], fall: nums[1], toff: nums[2] };
    }
    return parseDelayNumberOrMintypmax();
  }

  /** Single delay: number, number+unit, or min:typ:max (returns typ). */
  function parseDelayNumberOrMintypmax() {
    const first = parseDelayAtom();
    if (match(":")) {
      const typ = parseDelayAtom();
      if (match(":")) {
        parseDelayAtom(); // max — ignored; sim uses typ
      }
      return typ;
    }
    return first;
  }

  function parseDelayAtom() {
    if (at("number")) {
      const value = eat("number").value;
      let unit = null;
      if (at("id")) {
        const u = peek().value;
        if (/^(s|ms|us|ns|ps|fs)$/.test(u)) {
          eat("id");
          unit = u;
        }
      }
      if (unit) return { value, unit };
      return value;
    }
    if (at("literal")) {
      const lit = eat("literal").value;
      error(`Delay literal '${lit}' not supported; use integer/real #N or #Nns`);
    }
    error("Expected delay number");
  }

  function parseBlock() {
    eat("begin");
    const stmts = [];
    while (!at("end") && !at("eof")) stmts.push(parseStatement());
    eat("end");
    return { type: "Block", stmts };
  }

  function parseIf() {
    eat("if");
    eat("(");
    const cond = parseExpression();
    eat(")");
    const then = parseStatement();
    let els = null;
    if (match("else")) els = parseStatement();
    return { type: "If", cond, then, else: els };
  }

  function parseFor() {
    eat("for");
    eat("(");
    const initLhs = parseLValue();
    eat("=");
    const initRhs = parseExpression();
    eat(";");
    const cond = parseExpression();
    eat(";");
    const stepLhs = parseLValue();
    eat("=");
    const stepRhs = parseExpression();
    eat(")");
    const body = parseStatement();
    return {
      type: "For",
      init: { type: "Blocking", lhs: initLhs, rhs: initRhs },
      cond,
      step: { type: "Blocking", lhs: stepLhs, rhs: stepRhs },
      body,
    };
  }

  function parseWhile() {
    eat("while");
    eat("(");
    const cond = parseExpression();
    eat(")");
    return { type: "While", cond, body: parseStatement() };
  }

  function parseRepeat() {
    eat("repeat");
    eat("(");
    const count = parseExpression();
    eat(")");
    return { type: "Repeat", count, body: parseStatement() };
  }

  function parseCase() {
    const kind = eat(peek().type).type; // case|casex|casez
    eat("(");
    const expr = parseExpression();
    eat(")");
    /** @type {{ items: object[]|null, body: object }[]} */
    const items = [];
    while (!at("endcase") && !at("eof")) {
      if (match("default")) {
        match(":");
        items.push({ items: null, body: parseStatement() });
      } else {
        const labels = [];
        do {
          labels.push(parseExpression());
        } while (match(","));
        eat(":");
        items.push({ items: labels, body: parseStatement() });
      }
    }
    eat("endcase");
    return { type: "Case", kind, expr, items };
  }

  function parseLValue() {
    if (at("this")) {
      eat("this");
      const members = [];
      while (match(".")) members.push(eat("id").value);
      if (!members.length) error("Expected property after this");
      let select = null;
      if (match("[")) {
        const a = parseExpression();
        if (match(":")) {
          const b = parseExpression();
          eat("]");
          select = { type: "Part", hi: a, lo: b };
        } else {
          eat("]");
          select = { type: "Bit", index: a };
        }
      }
      return { type: "LValue", name: "this", members, select, isThis: true };
    }
    const name = eat("id").value;
    /** @type {string[]} */
    const members = [];
    while (match(".")) members.push(eat("id").value);
    let select = null;
    if (match("[")) {
      const a = parseExpression();
      if (match(":")) {
        const b = parseExpression();
        eat("]");
        select = { type: "Part", hi: a, lo: b };
      } else {
        eat("]");
        select = { type: "Bit", index: a };
      }
    }
    return { type: "LValue", name, members, select };
  }

  // ---- expressions (Pratt / precedence climbing) ----
  function parseExpression() {
    return parseCond();
  }

  function parseCond() {
    let node = parseLogOr();
    if (match("?")) {
      const a = parseExpression();
      eat(":");
      const b = parseExpression();
      node = { type: "Cond", cond: node, a, b };
    }
    return node;
  }

  function parseLogOr() {
    let left = parseLogAnd();
    while (match("||")) {
      left = { type: "Binary", op: "||", left, right: parseLogAnd() };
    }
    return left;
  }

  function parseLogAnd() {
    let left = parseBitOr();
    while (match("&&")) {
      left = { type: "Binary", op: "&&", left, right: parseBitOr() };
    }
    return left;
  }

  function parseBitOr() {
    let left = parseBitXor();
    while (at("|") && !at("||")) {
      // single |
      eat("|");
      left = { type: "Binary", op: "|", left, right: parseBitXor() };
    }
    return left;
  }

  function parseBitXor() {
    let left = parseBitAnd();
    while (at("^") || at("~^") || at("^~")) {
      const op = eat(peek().type).type;
      left = { type: "Binary", op, left, right: parseBitAnd() };
    }
    return left;
  }

  function parseBitAnd() {
    let left = parseEq();
    while (at("&") && !at("&&")) {
      eat("&");
      left = { type: "Binary", op: "&", left, right: parseEq() };
    }
    return left;
  }

  function parseEq() {
    let left = parseRel();
    while (at("===") || at("!==") || at("==") || at("!=")) {
      const op = eat(peek().type).type;
      left = { type: "Binary", op, left, right: parseRel() };
    }
    return left;
  }

  function parseRel() {
    let left = parseShift();
    while (at("<") || at(">") || at("<=") || at(">=")) {
      // careful: <= is also NBA — but in expr context after left it's compare
      const op = eat(peek().type).type;
      left = { type: "Binary", op, left, right: parseShift() };
    }
    return left;
  }

  function parseShift() {
    let left = parseAdd();
    while (at("<<") || at(">>") || at("<<<") || at(">>>")) {
      const op = eat(peek().type).type;
      left = { type: "Binary", op, left, right: parseAdd() };
    }
    return left;
  }

  function parseAdd() {
    let left = parseMul();
    while (at("+") || at("-")) {
      const op = eat(peek().type).type;
      left = { type: "Binary", op, left, right: parseMul() };
    }
    return left;
  }

  function parseMul() {
    let left = parseUnary();
    while (at("*") || at("/") || at("%")) {
      const op = eat(peek().type).type;
      left = { type: "Binary", op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary() {
    if (at("!") || at("~") || at("-") || at("&") || at("|") || at("^") || at("~&") || at("~|") || at("~^") || at("^~")) {
      const op = eat(peek().type).type;
      return { type: "Unary", op, expr: parseUnary() };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let node = parsePrimary();
    for (;;) {
      if (match(".")) {
        if (node.type === "Super" && at("new")) {
          eat("new");
          const args = [];
          if (match("(")) {
            if (!at(")")) {
              do {
                args.push(parseExpression());
              } while (match(","));
            }
            eat(")");
          }
          node = { type: "SuperNew", args };
          continue;
        }
        const field = eat("id").value;
        if (match("(")) {
          const args = [];
          if (!at(")")) {
            do {
              args.push(parseExpression());
            } while (match(","));
          }
          eat(")");
          node = { type: "MethodCall", recv: node, name: field, args };
        } else {
          node = { type: "MemberAccess", expr: node, field };
        }
        continue;
      }
      if (match("[")) {
        const a = parseExpression();
        if (match(":")) {
          const b = parseExpression();
          eat("]");
          node = { type: "PartSelect", expr: node, hi: a, lo: b };
        } else {
          eat("]");
          node = { type: "BitSelect", expr: node, index: a };
        }
        continue;
      }
      break;
    }
    return node;
  }

  function parsePrimary() {
    if (at("null")) {
      eat("null");
      return { type: "Null" };
    }
    if (at("this")) {
      eat("this");
      return { type: "This" };
    }
    if (at("super")) {
      eat("super");
      return { type: "Super" };
    }
    if (at("new")) {
      eat("new");
      if (match("[")) {
        const size = parseExpression();
        eat("]");
        return { type: "NewArray", size };
      }
      const args = [];
      if (match("(")) {
        if (!at(")")) {
          do {
            args.push(parseExpression());
          } while (match(","));
        }
        eat(")");
      }
      return { type: "New", className: null, args };
    }
    if (at("number")) {
      const n = eat("number");
      return { type: "Number", value: n.value };
    }
    if (at("literal")) {
      return { type: "Literal", raw: eat("literal").value };
    }
    if (at("systask")) {
      const name = eat("systask").value;
      const args = [];
      if (match("(")) {
        if (!at(")")) {
          do {
            args.push(parseExpression());
          } while (match(","));
        }
        eat(")");
      }
      return { type: "SysFunc", name, args };
    }
    if (at("id")) {
      const name = eat("id").value;
      // package::name or package::name(...)
      if (match("::")) {
        const member = eat("id").value;
        const qname = `${name}::${member}`;
        if (match("(")) {
          const args = [];
          if (!at(")")) {
            do {
              args.push(parseExpression());
            } while (match(","));
          }
          eat(")");
          return { type: "Call", name: qname, args };
        }
        return { type: "Ident", name: qname };
      }
      if (match("(")) {
        const args = [];
        if (!at(")")) {
          do {
            args.push(parseExpression());
          } while (match(","));
        }
        eat(")");
        return { type: "Call", name, args };
      }
      return { type: "Ident", name };
    }
    if (match("(")) {
      const e = parseExpression();
      eat(")");
      return e;
    }
    if (match("{")) {
      // concat or replicate {N{expr}}
      const first = parseExpression();
      if (match("{")) {
        // replicate: first must be const, then expr
        const expr = parseExpression();
        eat("}");
        eat("}");
        return { type: "Replicate", count: first, expr };
      }
      const parts = [first];
      while (match(",")) parts.push(parseExpression());
      eat("}");
      return { type: "Concat", parts };
    }
    if (at("string")) {
      return { type: "String", value: eat("string").value };
    }
    error("Expected expression");
  }

  // ---- design ----
  const modules = [];
  const packages = [];
  while (!at("eof")) {
    if (at("package")) packages.push(parsePackage());
    else if (at("module")) modules.push(parseModule());
    else error("Expected package or module");
  }
  if (!modules.length) error("No modules found");
  return { type: "Design", modules, packages };
}

export function unsupported(feature) {
  throw new Error(`Unsupported in subset v0: ${feature}`);
}
