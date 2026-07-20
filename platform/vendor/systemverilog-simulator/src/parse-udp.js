/**
 * Parse IEEE 1364 UDP (primitive / table) and gate-like cell instances.
 * Modularity V6 — see V6_UDP.md.
 */

export function attachParseUdp(ctx) {
  const { eat, match, at, peek, error, tokens } = ctx;

  function parsePrimitive() {
    eat("primitive");
    const name = eat("id").value;
    eat("(");
    const ports = [];
    do {
      ports.push(eat("id").value);
    } while (match(","));
    eat(")");
    eat(";");

    /** @type {string|null} */
    let output = null;
    /** @type {string[]} */
    const inputs = [];
    let sequential = false;
    /** @type {string|number|null} */
    let initial = null;

    while (!at("table") && !at("endprimitive") && !at("eof")) {
      if (at("output")) {
        eat("output");
        const isReg = match("reg");
        if (isReg) sequential = true;
        const pname = eat("id").value;
        output = pname;
        eat(";");
        continue;
      }
      if (at("input")) {
        eat("input");
        do {
          inputs.push(eat("id").value);
        } while (match(","));
        eat(";");
        continue;
      }
      if (at("reg")) {
        eat("reg");
        const pname = eat("id").value;
        sequential = true;
        if (!output) output = pname;
        eat(";");
        continue;
      }
      if (at("initial")) {
        eat("initial");
        eat("id"); // destination (must be output)
        eat("=");
        if (at("number")) {
          const n = eat("number").value;
          initial = n === 0 || n === 1 ? n : "x";
        } else if (at("literal")) {
          const raw = String(eat("literal").value);
          const body = raw.includes("'") ? raw.split("'").pop() : raw;
          const bits = body.replace(/[_sSbBoOdDhH]/g, "").toLowerCase();
          if (bits === "0") initial = 0;
          else if (bits === "1") initial = 1;
          else initial = "x";
        } else error("UDP initial must be a scalar constant");
        eat(";");
        continue;
      }
      error("Expected UDP declaration or table");
    }

    if (!output) output = ports[0];
    if (!inputs.length) inputs.push(...ports.slice(1));
    if (inputs.length > 10) error(`UDP '${name}' has more than 10 inputs`);
    if (ports[0] !== output) {
      error(`UDP '${name}': output '${output}' must be the first port`);
    }

    eat("table");
    const rows = [];
    while (!at("endtable") && !at("eof")) {
      rows.push(parseTableRow(inputs.length, sequential));
    }
    eat("endtable");
    eat("endprimitive");

    return {
      type: "Udp",
      name,
      ports,
      output,
      inputs,
      sequential,
      initial,
      rows,
    };
  }

  function parseTableRow(nInputs, sequential) {
    const fields = [];
    while (!at(";") && !at("endtable") && !at("eof")) {
      if (match(":")) {
        fields.push(":");
        continue;
      }
      fields.push(parseTableSymbol());
    }
    eat(";");

    const parts = [];
    let cur = [];
    for (const f of fields) {
      if (f === ":") {
        parts.push(cur);
        cur = [];
      } else cur.push(f);
    }
    parts.push(cur);

    if (sequential) {
      if (parts.length !== 3) {
        error("Sequential UDP table row must be: inputs : current : next ;");
      }
      const [ins, curr, next] = parts;
      if (ins.length !== nInputs) {
        error(`UDP row expects ${nInputs} input fields, got ${ins.length}`);
      }
      if (curr.length !== 1 || next.length !== 1) {
        error("Sequential UDP current/next must be a single symbol");
      }
      return { inputs: ins, curr: curr[0], next: next[0] };
    }
    if (parts.length !== 2) {
      error("Combinational UDP table row must be: inputs : output ;");
    }
    const [ins, out] = parts;
    if (ins.length !== nInputs) {
      error(`UDP row expects ${nInputs} input fields, got ${ins.length}`);
    }
    if (out.length !== 1) error("UDP output must be a single symbol");
    return { inputs: ins, out: out[0] };
  }

  function parseTableSymbol() {
    if (match("(")) {
      // `(01)` often lexes as one number token with raw "01"
      if (at("number")) {
        const tok = peek();
        const raw = String(tok.raw != null ? tok.raw : tok.value).replace(/_/g, "");
        if (/^[01xX]{2}$/.test(raw)) {
          eat("number");
          eat(")");
          return `(${raw[0].toLowerCase()}${raw[1].toLowerCase()})`;
        }
      }
      const a = eatTableChar();
      const b = eatTableChar();
      eat(")");
      return `(${a}${b})`;
    }
    if (at("number")) {
      const n = eat("number").value;
      if (n !== 0 && n !== 1) error("UDP table number must be 0 or 1");
      return String(n);
    }
    if (at("literal")) {
      const raw = String(eat("literal").value).toLowerCase();
      if (/x/.test(raw)) return "x";
      if (raw.includes("1") && !raw.includes("0")) return "1";
      if (raw.includes("0") && !raw.includes("1")) return "0";
      error(`Bad UDP literal '${raw}'`);
    }
    if (at("id")) {
      const v = eat("id").value;
      if (/^[01xXbBrRfFpPnN]$/.test(v) || v === "?" || v.length === 1) return v;
      error(`Invalid UDP table symbol '${v}'`);
    }
    if (match("?")) return "?";
    if (match("*")) return "*";
    if (match("-")) return "-";
    error(`Expected UDP table symbol (got ${peek().type})`);
  }

  function eatTableChar() {
    if (at("number")) {
      const tok = peek();
      const raw = String(tok.raw != null ? tok.raw : tok.value).replace(/_/g, "");
      // Single digit only here; two-digit handled in parseTableSymbol
      if (/^[01]$/.test(raw)) {
        eat("number");
        return raw;
      }
      if (raw === "0" || raw === "1" || tok.value === 0 || tok.value === 1) {
        eat("number");
        return String(tok.value === 0 ? 0 : tok.value === 1 ? 1 : raw[0]);
      }
      error("Edge (ab) needs single chars");
    }
    if (at("id")) {
      const v = eat("id").value;
      if (v.length !== 1) error("Edge (ab) needs single chars");
      return v.toLowerCase();
    }
    if (at("literal")) {
      const raw = eat("literal").value;
      const m = /[01xX]/.exec(String(raw));
      if (!m) error("Bad edge literal");
      return m[0].toLowerCase();
    }
    error("Expected edge endpoint");
  }

  /**
   * Module or UDP/gate-like cell.
   * Gate/UDP:  name [#delay] [inst] (terms) ;
   * Module:    name [#(params)] inst (ports) ;
   * Resolved at elaborate (udps vs modules).
   */
  function parseCellOrInstance() {
    const cell = eat("id").value;
    /** @type {object[]} */
    let params = [];
    /** @type {number|object} */
    let delay = 0;

    if (match("#")) {
      if (match("(")) {
        if (at(".")) {
          do {
            eat(".");
            const pname = eat("id").value;
            eat("(");
            const expr = ctx.parseExpression();
            eat(")");
            params.push({ type: "Named", name: pname, expr });
          } while (match(","));
          eat(")");
        } else {
          const args = [];
          if (!at(")")) {
            do {
              // Module positional params need full expressions; delay nums are Numbers.
              args.push(ctx.parseExpression());
            } while (match(","));
          }
          eat(")");
          if (at("(")) {
            delay = exprsToDelay(args);
          } else {
            params = args.map((e) => ({ type: "Positional", expr: e }));
            delay = exprsToDelay(args);
          }
        }
      } else {
        const n = ctx.parseDelayNumberOrMintypmax();
        if (at("(")) {
          delay = n;
        } else {
          // `#10 name (...)` — module param form; also delay candidate for UDP
          params = [{ type: "Positional", expr: delayNumToExpr(n) }];
          delay = n;
        }
      }
    }

    /** @type {{ name: string|null, range: object|null, terminals: object[], conns: object[], named: boolean }[]} */
    const instances = [];
    do {
      let name = null;
      let range = null;
      if (at("id")) {
        name = eat("id").value;
        if (at("[")) range = ctx.parseRange();
      }
      eat("(");
      /** @type {object[]} */
      const terminals = [];
      /** @type {object[]} */
      const conns = [];
      let named = false;
      if (!at(")")) {
        if (at(".")) {
          named = true;
          do {
            eat(".");
            if (match("*")) {
              // J6b: .* implicit port connections
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
            const expr = ctx.parseExpression();
            terminals.push(expr);
            conns.push({ type: "Positional", expr });
          } while (match(","));
        }
      }
      eat(")");
      instances.push({ name, range, terminals, conns, named });
    } while (match(","));
    eat(";");

    // Named ports or named parameter overrides → classic Instance AST
    if (
      instances.length === 1 &&
      instances[0].name &&
      !instances[0].range &&
      (instances[0].named || params.some((p) => p.type === "Named"))
    ) {
      return {
        type: "Instance",
        module: cell,
        name: instances[0].name,
        params,
        conns: instances[0].conns,
      };
    }

    return {
      type: "CellInst",
      cell,
      delay,
      params,
      instances,
    };
  }

  function delayFromNums(nums) {
    if (nums.length === 1) return nums[0];
    if (nums.length === 2) return { rise: nums[0], fall: nums[1] };
    return { rise: nums[0], fall: nums[1], toff: nums[2] };
  }

  function exprsToDelay(args) {
    const nums = args.map((e) => {
      if (e.type === "Number") return e.value;
      if (e.type === "Literal") {
        // rare in delay slot
        return 0;
      }
      return 0;
    });
    if (!args.length) return 0;
    if (args.every((e) => e.type === "Number")) return delayFromNums(nums);
    // Non-numeric params (module); delay unused for modules
    return 0;
  }

  function delayNumToExpr(n) {
    if (typeof n === "number") return { type: "Number", value: n };
    if (n && typeof n === "object" && "typ" in n) {
      return { type: "Number", value: n.typ };
    }
    return { type: "Number", value: 0 };
  }

  Object.assign(ctx, {
    parsePrimitive,
    parseCellOrInstance,
  });
}
