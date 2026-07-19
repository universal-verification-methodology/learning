/**
 * Extracted from parser.js (modularity M5). See MODULARITY.md.
 */

export function attachParseExpr(ctx) {
  const { eat, match, at, peek, error, tokens } = ctx;

function parseRange() {
  if (!match("[")) return null;
  const msb = parseExpression();
  eat(":");
  const lsb = parseExpression();
  eat("]");
  return { msb, lsb };
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
  if (at("string")) {
    return { type: "String", value: eat("string").value };
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
  error("Expected expression");
}

  Object.assign(ctx, {
    parseRange,
    parseWidthFromRange,
    evalConst,
    parseDelayValue,
    parseDelayNumberOrMintypmax,
    parseDelayAtom,
    parseLValue,
    parseExpression,
    parseCond,
    parseLogOr,
    parseLogAnd,
    parseBitOr,
    parseBitXor,
    parseBitAnd,
    parseEq,
    parseRel,
    parseShift,
    parseAdd,
    parseMul,
    parseUnary,
    parsePostfix,
    parsePrimary,
  });
}
