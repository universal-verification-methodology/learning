/**
 * Parse token cursor / helpers. Extracted from parser.js (modularity M5).
 */

import { lex } from "./lexer.js";

/**
 * @param {string} source
 */
export function createParseContext(source) {
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

  return {
    tokens,
    peek,
    at,
    eat,
    match,
    error,
    loc,
    get pos() {
      return pos;
    },
    set pos(v) {
      pos = v;
    },
  };
}
