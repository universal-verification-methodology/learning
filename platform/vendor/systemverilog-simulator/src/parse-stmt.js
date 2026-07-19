/**
 * Extracted from parser.js (modularity M5). See MODULARITY.md.
 */

export function attachParseStmt(ctx) {
  const { eat, match, at, peek, error, tokens } = ctx;

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
    const expr = ctx.parseExpression();
    eat(")");
    match(";");
    return { type: "Wait", expr };
  }
  if (at("disable")) {
    eat("disable");
    if (at("fork")) {
      eat("fork");
      match(";");
      return { type: "DisableFork" };
    }
    const name = eat("id").value;
    match(";");
    return { type: "Disable", name };
  }
  if (at("force")) {
    eat("force");
    const lhs = ctx.parseLValue();
    eat("=");
    const rhs = ctx.parseExpression();
    eat(";");
    return { type: "Force", lhs, rhs };
  }
  if (at("release")) {
    eat("release");
    const lhs = ctx.parseLValue();
    eat(";");
    return { type: "Release", lhs };
  }
  if (at("assign")) {
    eat("assign");
    const lhs = ctx.parseLValue();
    eat("=");
    const rhs = ctx.parseExpression();
    eat(";");
    return { type: "ProcAssign", lhs, rhs };
  }
  if (at("deassign")) {
    eat("deassign");
    const lhs = ctx.parseLValue();
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
      const edge = tokens[ctx.pos - 1].type;
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
    const delay = ctx.parseDelayValue();
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
          else args.push(ctx.parseExpression());
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
            args.push(ctx.parseExpression());
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
        args.push(ctx.parseExpression());
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
    const t1 = tokens[ctx.pos + 1];
    const t2 = tokens[ctx.pos + 2];
    const t3 = tokens[ctx.pos + 3];
    if (t1 && t1.type === "." && t2 && t2.type === "id" && t3 && t3.type === "(") {
      const expr = ctx.parsePostfix();
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
    const next = tokens[ctx.pos + 1];
    if (next && (next.type === ";" || next.type === "(")) {
      const name = eat("id").value;
      const args = [];
      if (match("(")) {
        if (!at(")")) {
          do {
            args.push(ctx.parseExpression());
          } while (match(","));
        }
        eat(")");
      }
      eat(";");
      return { type: "TaskCall", name, args };
    }
  }
  const lhs = ctx.parseLValue();
  let op;
  if (match("<=")) op = "<=";
  else {
    eat("=");
    op = "=";
  }
  const rhs = ctx.parseExpression();
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

function parseBlock() {
  eat("begin");
  let name = null;
  if (match(":")) name = eat("id").value;
  const stmts = [];
  while (!at("end") && !at("eof")) stmts.push(parseStatement());
  eat("end");
  if (match(":")) eat("id"); // optional end : name
  return { type: "Block", name, stmts };
}

function parseIf() {
  eat("if");
  eat("(");
  const cond = ctx.parseExpression();
  eat(")");
  const then = parseStatement();
  let els = null;
  if (match("else")) els = parseStatement();
  return { type: "If", cond, then, else: els };
}

function parseFor() {
  eat("for");
  eat("(");
  const initLhs = ctx.parseLValue();
  eat("=");
  const initRhs = ctx.parseExpression();
  eat(";");
  const cond = ctx.parseExpression();
  eat(";");
  const stepLhs = ctx.parseLValue();
  eat("=");
  const stepRhs = ctx.parseExpression();
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
  const cond = ctx.parseExpression();
  eat(")");
  return { type: "While", cond, body: parseStatement() };
}

function parseRepeat() {
  eat("repeat");
  eat("(");
  const count = ctx.parseExpression();
  eat(")");
  return { type: "Repeat", count, body: parseStatement() };
}

function parseCase() {
  const kind = eat(peek().type).type; // case|casex|casez
  eat("(");
  const expr = ctx.parseExpression();
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
        labels.push(ctx.parseExpression());
      } while (match(","));
      eat(":");
      items.push({ items: labels, body: parseStatement() });
    }
  }
  eat("endcase");
  return { type: "Case", kind, expr, items };
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
      const edge = tokens[ctx.pos - 1].type;
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

  Object.assign(ctx, {
    parseStatement,
    parseFork,
    parseBlock,
    parseIf,
    parseFor,
    parseWhile,
    parseRepeat,
    parseCase,
    parseAlways,
    parseSensList,
    parseInitial,
  });
}
