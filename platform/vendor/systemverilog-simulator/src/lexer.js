const KEYWORDS = new Set([
  "module",
  "endmodule",
  "input",
  "output",
  "inout",
  "wire",
  "reg",
  "logic",
  "bit",
  "assign",
  "always",
  "always_ff",
  "always_comb",
  "always_latch",
  "initial",
  "begin",
  "end",
  "if",
  "else",
  "for",
  "while",
  "repeat",
  "case",
  "casex",
  "casez",
  "endcase",
  "default",
  "parameter",
  "localparam",
  "posedge",
  "negedge",
  "or",
  "forever",
  "integer",
  "generate",
  "endgenerate",
  "genvar",
  "task",
  "endtask",
  "function",
  "endfunction",
  "automatic",
  "package",
  "endpackage",
  "import",
  "export",
  "and",
  "or",
  "nand",
  "nor",
  "xor",
  "xnor",
  "buf",
  "not",
  "bufif0",
  "bufif1",
  "notif0",
  "notif1",
  "nmos",
  "pmos",
  "cmos",
  "rnmos",
  "rpmos",
  "rcmos",
  "tran",
  "tranif0",
  "tranif1",
  "rtran",
  "rtranif0",
  "rtranif1",
  "tri",
  "wand",
  "wor",
  "triand",
  "trior",
  "tri0",
  "tri1",
  "trireg",
  "supply0",
  "supply1",
  "pull0",
  "pull1",
  "strong0",
  "strong1",
  "weak0",
  "weak1",
  "highz0",
  "highz1",
  "large",
  "medium",
  "small",
  "large0",
  "large1",
  "medium0",
  "medium1",
  "small0",
  "small1",
  "pullup",
  "pulldown",
  "fork",
  "join",
  "join_any",
  "join_none",
  "wait",
  "disable",
  "event",
  "force",
  "release",
  "deassign",
  "defparam",
  "typedef",
  "enum",
  "struct",
  "packed",
  "class",
  "endclass",
  "extends",
  "virtual",
  "new",
  "this",
  "null",
  "void",
  "super",
  "protected",
  "local",
  "static",
  "timeunit",
  "timeprecision",
  "string",
  "primitive",
  "endprimitive",
  "table",
  "endtable",
]);

/**
 * @typedef {{ type: string, value?: string|number, line: number, col: number }} Token
 */

/**
 * @param {string} source
 * @returns {Token[]}
 */
export function lex(source) {
  const text = String(source);
  /** @type {Token[]} */
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const peek = (n = 0) => text[i + n] || "";
  const advance = () => {
    const c = text[i++];
    if (c === "\n") {
      line++;
      col = 1;
    } else col++;
    return c;
  };

  while (i < text.length) {
    const c = peek();
    const startLine = line;
    const startCol = col;

    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      advance();
      continue;
    }

    // line comment
    if (c === "/" && peek(1) === "/") {
      while (i < text.length && peek() !== "\n") advance();
      continue;
    }
    // block comment
    if (c === "/" && peek(1) === "*") {
      advance();
      advance();
      while (i < text.length && !(peek() === "*" && peek(1) === "/")) advance();
      if (i < text.length) {
        advance();
        advance();
      }
      continue;
    }

    // string
    if (c === '"') {
      advance();
      let s = "";
      while (i < text.length && peek() !== '"') {
        if (peek() === "\\" && peek(1)) {
          advance();
          const esc = advance();
          if (esc === "n") s += "\n";
          else if (esc === "t") s += "\t";
          else s += esc;
        } else s += advance();
      }
      if (peek() === '"') advance();
      tokens.push({ type: "string", value: s, line: startLine, col: startCol });
      continue;
    }

    // based literal or number: 8'hFF, 'b1010, 42, #10 handled as # + number
    if (/[0-9]/.test(c) || (c === "'" && /[sSbBoOdDhH]/.test(peek(1)))) {
      let raw = "";
      if (c === "'") {
        raw += advance();
        if (/[sS]/.test(peek())) raw += advance();
        if (/[bBoOdDhH]/.test(peek())) {
          raw += advance();
          while (/[0-9a-fA-FxXzZ_?]/.test(peek())) raw += advance();
        }
        tokens.push({ type: "literal", value: raw, line: startLine, col: startCol });
        continue;
      }
      while (/[0-9_]/.test(peek())) raw += advance();
      // Real: 1.5 / 1.5e2 (delay forms); not based literals
      if (peek() === "." && /[0-9]/.test(peek(1))) {
        raw += advance();
        while (/[0-9_]/.test(peek())) raw += advance();
        if (/[eE]/.test(peek()) && /[0-9+-]/.test(peek(1))) {
          raw += advance();
          if (/[+-]/.test(peek())) raw += advance();
          while (/[0-9_]/.test(peek())) raw += advance();
        }
        tokens.push({
          type: "number",
          value: Number(raw.replace(/_/g, "")),
          raw,
          line: startLine,
          col: startCol,
        });
        continue;
      }
      if (peek() === "'") {
        raw += advance();
        if (/[sS]/.test(peek())) raw += advance();
        if (/[bBoOdDhH]/.test(peek())) {
          raw += advance();
          while (/[0-9a-fA-FxXzZ_?+-]/.test(peek())) raw += advance();
        }
        tokens.push({ type: "literal", value: raw.replace(/_/g, (m, off, str) => {
          // keep underscores only inside body for parseLiteral; strip size underscores
          return m;
        }), line: startLine, col: startCol });
        continue;
      }
      tokens.push({
        type: "number",
        value: Number(raw.replace(/_/g, "")),
        raw,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // identifier / keyword / system task
    if (/[a-zA-Z_$]/.test(c)) {
      let id = "";
      while (/[a-zA-Z0-9_$]/.test(peek())) id += advance();
      if (id === "$") {
        tokens.push({ type: "$", line: startLine, col: startCol });
      } else if (id.startsWith("$")) {
        tokens.push({ type: "systask", value: id, line: startLine, col: startCol });
      } else if (KEYWORDS.has(id)) {
        tokens.push({ type: id, line: startLine, col: startCol });
      } else {
        tokens.push({ type: "id", value: id, line: startLine, col: startCol });
      }
      continue;
    }

    // multi-char operators
    const two = c + peek(1);
    const three = two + peek(2);
    const multi = [
      "<<<",
      ">>>",
      "===",
      "!==",
      "::",
      "<=",
      ">=",
      "==",
      "!=",
      "&&",
      "||",
      "<<",
      ">>",
      "~&",
      "~|",
      "~^",
      "^~",
      "->",
    ];
    if (multi.includes(three)) {
      advance();
      advance();
      advance();
      tokens.push({ type: three, line: startLine, col: startCol });
      continue;
    }
    if (multi.includes(two)) {
      advance();
      advance();
      tokens.push({ type: two, line: startLine, col: startCol });
      continue;
    }

    // single-char
    if ("()[]{},.;:=#+-*/%!~^&|?@<>".includes(c)) {
      tokens.push({ type: advance(), line: startLine, col: startCol });
      continue;
    }

    throw new Error(`Unexpected character '${c}' at ${startLine}:${startCol}`);
  }

  tokens.push({ type: "eof", line, col });
  return tokens;
}
