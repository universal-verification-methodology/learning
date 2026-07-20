/**
 * Parse IEEE 1364 specify blocks (path delays + timing-check stubs).
 * Modularity V7 — see V7_SPECIFY.md.
 */

export function attachParseSpecify(ctx) {
  const { eat, match, at, peek, error } = ctx;

  function parseSpecparamDecls() {
    eat("specparam");
    const decls = [];
    do {
      const name = eat("id").value;
      eat("=");
      const expr = ctx.parseExpression();
      decls.push({ name, expr });
    } while (match(","));
    eat(";");
    return { type: "Specparam", decls };
  }

  function parseTerminalName() {
    const name = eat("id").value;
    if (match("[")) {
      ctx.parseExpression();
      if (match(":")) ctx.parseExpression();
      eat("]");
    }
    return name;
  }

  function parseTerminalList() {
    const names = [];
    do {
      names.push(parseTerminalName());
    } while (match(","));
    return names;
  }

  /** Path delay value (no leading #): N | (r,f) | min:typ:max | id */
  function parsePathDelayValue() {
    if (at("id")) {
      return { type: "Ident", name: eat("id").value };
    }
    if (match("(")) {
      const nums = [];
      do {
        if (at("id")) {
          nums.push({ type: "Ident", name: eat("id").value });
        } else {
          nums.push(ctx.parseDelayNumberOrMintypmax());
        }
      } while (match(","));
      eat(")");
      if (nums.length === 1) return nums[0];
      if (nums.length === 2) return { rise: nums[0], fall: nums[1] };
      return { rise: nums[0], fall: nums[1], toff: nums[2] };
    }
    return ctx.parseDelayNumberOrMintypmax();
  }

  function parsePathDeclaration() {
    eat("(");
    /** @type {string|null} */
    let edge = null;
    if (match("posedge")) edge = "posedge";
    else if (match("negedge")) edge = "negedge";

    const sources = parseTerminalList();

    let parallel = true;
    if (match("=>")) parallel = true;
    else if (match("*>")) parallel = false;
    else error("Expected => or *> in specify path");

    /** @type {{ name: string, polarity: string|null, data: string|null }[]} */
    const dests = [];
    if (at("(")) {
      eat("(");
      const name = eat("id").value;
      let polarity = null;
      /** @type {string|null} */
      let data = null;
      if (match("+:") || match("-:")) {
        polarity = tokensPolarity();
        if (at("id")) data = eat("id").value;
        else {
          const e = ctx.parseExpression();
          if (e.type === "Ident") data = e.name;
        }
      }
      eat(")");
      dests.push({ name, polarity, data });
    } else {
      for (const n of parseTerminalList()) {
        dests.push({ name: n, polarity: null, data: null });
      }
    }
    eat(")");
    eat("=");
    const delay = parsePathDelayValue();
    eat(";");
    return {
      type: "Path",
      parallel,
      edge,
      sources,
      dests,
      delay,
    };
  }

  function tokensPolarity() {
    // match() already consumed +: or -:
    return "last";
  }

  function parsePathDeclarationClean() {
    eat("(");
    /** @type {string|null} */
    let edge = null;
    if (match("posedge")) edge = "posedge";
    else if (match("negedge")) edge = "negedge";

    const sources = parseTerminalList();

    let parallel = true;
    if (match("=>")) parallel = true;
    else if (match("*>")) parallel = false;
    else error("Expected => or *> in specify path");

    /** @type {{ name: string, polarity: string|null, data: string|null }[]} */
    const dests = [];
    if (at("(")) {
      eat("(");
      const name = eat("id").value;
      let polarity = null;
      /** @type {string|null} */
      let data = null;
      if (at("+:") || at("-:")) {
        polarity = at("+:") ? "+" : "-";
        eat(polarity === "+" ? "+:" : "-:");
        if (at("id")) data = eat("id").value;
        else {
          const e = ctx.parseExpression();
          if (e.type === "Ident") data = e.name;
        }
      }
      eat(")");
      dests.push({ name, polarity, data });
    } else {
      for (const n of parseTerminalList()) {
        dests.push({ name: n, polarity: null, data: null });
      }
    }
    eat(")");
    eat("=");
    const delay = parsePathDelayValue();
    eat(";");
    return {
      type: "Path",
      parallel,
      edge,
      sources,
      dests,
      delay,
    };
  }

  function parseTimingCheck() {
    const kind = eat("systask").value;
    eat("(");
    const args = [];
    if (!at(")")) {
      do {
        if (at("posedge") || at("negedge")) {
          const edgeTok = peek().type;
          eat(edgeTok);
          const name = at("id") ? eat("id").value : null;
          args.push({ type: "EdgeEvent", edge: edgeTok, name });
        } else {
          args.push(ctx.parseExpression());
        }
      } while (match(","));
    }
    eat(")");
    eat(";");
    return { type: "TimingCheck", kind, args };
  }

  function parseSpecify() {
    eat("specify");
    const specparams = [];
    const paths = [];
    const checks = [];
    while (!at("endspecify") && !at("eof")) {
      if (at("specparam")) {
        const sp = parseSpecparamDecls();
        for (const d of sp.decls) specparams.push(d);
        continue;
      }
      if (at("(")) {
        paths.push(parsePathDeclarationClean());
        continue;
      }
      if (at("systask")) {
        const name = peek().value;
        if (
          name === "$setup" ||
          name === "$hold" ||
          name === "$setuphold" ||
          name === "$width" ||
          name === "$recovery" ||
          name === "$removal" ||
          name === "$recrem" ||
          name === "$skew" ||
          name === "$timeskew" ||
          name === "$fullskew" ||
          name === "$period" ||
          name === "$nochange"
        ) {
          checks.push(parseTimingCheck());
          continue;
        }
      }
      error("Expected path, specparam, or timing check in specify");
    }
    eat("endspecify");
    return { type: "Specify", specparams, paths, checks };
  }

  Object.assign(ctx, {
    parseSpecify,
    parseSpecparamDecls,
  });
}
