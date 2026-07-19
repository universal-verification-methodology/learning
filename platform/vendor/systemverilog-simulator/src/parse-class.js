/**
 * Extracted from parser.js (modularity M5). See MODULARITY.md.
 */

export function attachParseClass(ctx) {
  const { eat, match, at, peek, error, tokens } = ctx;

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
      const fn = ctx.parseFunction();
      methods.push({ ...fn, virtual: virt, methodKind: "function", access, isStatic });
      continue;
    }
    if (at("task")) {
      if (virt) error("virtual tasks are not supported yet");
      if (isStatic) error("static tasks are not supported yet");
      const task = ctx.parseTask();
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
      const pd = ctx.parseVarDecl();
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

function looksLikeTypedefVarDecl() {
  if (!at("id")) return false;
  const t1 = tokens[ctx.pos + 1];
  const t2 = tokens[ctx.pos + 2];
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
    const save = ctx.pos;
    const mr = ctx.parseRange();
    if (at("id")) sharedMem = mr;
    else ctx.pos = save;
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
    if (match("=")) init = ctx.parseExpression();
    decls.push({ name, init, memRange, unpacked });
    sharedMem = null;
  } while (match(","));
  eat(";");
  return { type: "VarDecl", kind: null, typeName, width: null, range: null, decls };
}

function parseUnpackedDim() {
  eat("[");
  if (match("]")) return { memRange: null, unpacked: { kind: "dynamic" } };
  if (match("$")) {
    eat("]");
    return { memRange: null, unpacked: { kind: "queue" } };
  }
  const msb = ctx.parseExpression();
  eat(":");
  const lsb = ctx.parseExpression();
  eat("]");
  return { memRange: { msb, lsb }, unpacked: null };
}

function parseTypedef() {
  eat("typedef");
  if (at("enum")) return parseTypedefEnum();
  if (at("struct")) return parseTypedefStruct();
  const nt = ctx.matchNetType();
  if (!nt) error("Expected type after typedef (logic/bit/reg/…, enum, or struct)");
  const range = nt === "integer" ? null : ctx.parseRange();
  const wr = nt === "integer" ? { width: 32, range: null } : ctx.parseWidthFromRange(range);
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
  const nt = ctx.matchNetType();
  if (nt) {
    kind = nt === "integer" ? "integer" : nt;
    if (nt === "integer") {
      width = 32;
      range = null;
    } else {
      range = ctx.parseRange();
      const wr = ctx.parseWidthFromRange(range);
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
    if (match("=")) value = ctx.parseExpression();
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
  return {
    type: "Typedef",
    name,
    struct: { packed: true, fields },
  };
}

function parseStructField() {
  const nt = ctx.matchNetType();
  if (nt) {
    const range = nt === "integer" ? null : ctx.parseRange();
    const wr = nt === "integer" ? { width: 32, range: null } : ctx.parseWidthFromRange(range);
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

  Object.assign(ctx, {
    parseClass,
    looksLikeTypedefVarDecl,
    parseTypedefVarDecl,
    parseUnpackedDim,
    parseTypedef,
    parseTypedefEnum,
    parseTypedefStruct,
    parseStructField,
  });
}
