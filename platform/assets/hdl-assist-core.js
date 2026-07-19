/**
 * Commercial-grade HDL code assist: completions + style auto-fixes.
 * Shared rules with lintStyle teaching pack — UI-agnostic core.
 */

/** @typedef {{ label: string, insert: string, detail?: string, kind?: string }} Completion */
/** @typedef {{ rule: string, title: string, apply: (src: string) => string|null }} StyleFix */

const SV_KEYWORDS = [
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
  "posedge",
  "negedge",
  "case",
  "casex",
  "casez",
  "endcase",
  "default",
  "generate",
  "endgenerate",
  "parameter",
  "localparam",
  "typedef",
  "enum",
  "struct",
  "package",
  "endpackage",
  "import",
  "function",
  "endfunction",
  "task",
  "endtask",
  "fork",
  "join",
  "interface",
  "endinterface",
];

/** Snippet templates — Tab accepts the insert body (prefix already typed is replaced). */
const SNIPPETS = [
  {
    trigger: "always_ff",
    label: "always_ff @(posedge clk)",
    insert:
      "always_ff @(posedge clk or negedge rst_n) begin\n  if (!rst_n) q <= '0;\n  else        q <= d;\nend",
    detail: "FF with async reset",
    kind: "snippet",
  },
  {
    trigger: "always_comb",
    label: "always_comb",
    insert: "always_comb begin\n  y = a & b;\nend",
    detail: "Combinational block",
    kind: "snippet",
  },
  {
    trigger: "always",
    label: "always_ff @(posedge …)",
    insert:
      "always_ff @(posedge clk) begin\n  q <= d;\nend",
    detail: "Prefer always_ff for edges",
    kind: "snippet",
  },
  {
    trigger: "module",
    label: "module … endmodule",
    insert: "module name(\n  input  logic clk,\n  input  logic rst_n,\n  output logic q\n);\n  \nendmodule",
    detail: "Module skeleton",
    kind: "snippet",
  },
  {
    trigger: "case",
    label: "case (…) … endcase",
    insert: "case (sel)\n  2'b00: y = a;\n  2'b01: y = b;\n  default: y = '0;\nendcase",
    detail: "Case with default",
    kind: "snippet",
  },
  {
    trigger: "if",
    label: "if / else",
    insert: "if (cond) begin\n  \nend else begin\n  \nend",
    detail: "If-else",
    kind: "snippet",
  },
  {
    trigger: "initial",
    label: "initial begin",
    insert: 'initial begin\n  $display("start");\n  #10 $finish;\nend',
    detail: "TB initial",
    kind: "snippet",
  },
  {
    trigger: "assign",
    label: "assign",
    insert: "assign y = a & b;",
    detail: "Continuous assign",
    kind: "snippet",
  },
];

const SYSTEM_TASKS = [
  "$display",
  "$write",
  "$monitor",
  "$strobe",
  "$finish",
  "$stop",
  "$fatal",
  "$error",
  "$warning",
  "$info",
  "$time",
  "$realtime",
  "$random",
  "$urandom",
  "$urandom_range",
  "$signed",
  "$unsigned",
  "$clog2",
  "$bits",
  "$size",
  "$left",
  "$right",
  "$dumpfile",
  "$dumpvars",
  "$readmemh",
  "$readmemb",
  "$writememh",
  "$sformatf",
];

/**
 * @typedef {{ name: string, kind: string, detail?: string, insert?: string }} DesignSymbol
 * @typedef {{
 *   locals?: DesignSymbol[],
 *   modules?: string[],
 *   instances?: DesignSymbol[],
 *   signals?: string[],
 *   signalMeta?: Record<string, { width?: number, kind?: string, bits?: string }>,
 * }} AssistContext
 */

/**
 * Walk parsed AST for ports, vars, params, instances, module names.
 * @param {object|null|undefined} ast
 * @returns {{ locals: DesignSymbol[], modules: string[], instances: DesignSymbol[] }}
 */
export function collectAssistSymbols(ast) {
  /** @type {DesignSymbol[]} */
  const locals = [];
  /** @type {string[]} */
  const modules = [];
  /** @type {DesignSymbol[]} */
  const instances = [];
  const seenLocal = new Set();

  const addLocal = (name, kind, detail) => {
    if (!name || seenLocal.has(name)) return;
    seenLocal.add(name);
    locals.push({ name, kind, detail, insert: name });
  };

  for (const mod of ast?.modules || []) {
    if (mod.name) modules.push(mod.name);
    for (const p of mod.ports || []) {
      addLocal(p.name, "port", `${p.direction || "port"}${p.width > 1 ? `[${p.width}]` : ""}`);
    }
    for (const item of mod.items || []) {
      if (item.type === "PortDecl") {
        for (const name of item.names || []) {
          addLocal(name, "port", item.direction || "port");
        }
      } else if (item.type === "VarDecl") {
        for (const d of item.decls || []) {
          addLocal(d.name, item.kind || "var", item.kind || "signal");
        }
      } else if (item.type === "Parameter") {
        for (const d of item.decls || []) {
          addLocal(d.name, "param", "parameter");
        }
      } else if (item.type === "Instance") {
        if (item.name) {
          instances.push({
            name: item.name,
            kind: "instance",
            detail: item.module ? `${item.module} instance` : "instance",
            insert: item.name,
          });
          addLocal(item.name, "instance", item.module ? `${item.module}` : "instance");
        }
      }
    }
  }

  return { locals, modules, instances };
}

/**
 * Merge AST symbols + last-run hierarchical signals.
 * @param {{ ast?: object|null, signals?: string[], signalMeta?: Record<string, object> }} opts
 * @returns {AssistContext}
 */
export function buildAssistContext(opts = {}) {
  const fromAst = collectAssistSymbols(opts.ast);
  return {
    locals: fromAst.locals,
    modules: fromAst.modules,
    instances: fromAst.instances,
    signals: opts.signals || [],
    signalMeta: opts.signalMeta || {},
  };
}

/**
 * Completions at cursor — keywords, snippets, design signals, hierarchy, system tasks.
 * @param {string} source
 * @param {number} cursor
 * @param {AssistContext} [ctx]
 * @returns {{ items: Completion[], replaceFrom: number, replaceTo: number, prefix: string }}
 */
export function getCompletions(source, cursor, ctx = {}) {
  const text = String(source ?? "");
  const pos = Math.max(0, Math.min(cursor ?? 0, text.length));
  const tok = hierTokenAt(text, pos);
  const { prefix, from, pathPrefix, fullFrom } = tok;
  /** @type {Completion[]} */
  const items = [];
  const pl = prefix.toLowerCase();

  // Hierarchy: typing `uut.` or `uut.cl`
  if (pathPrefix) {
    const scope = pathPrefix + ".";
    for (const h of matchHierSignals(ctx, scope, prefix, fullFrom ?? from, from, pos)) {
      items.push(h);
    }
  } else if (prefix.length >= 1 || text[pos - 1] === ".") {
    // Flat / partial hierarchical names from last run
    for (const h of matchHierSignals(ctx, "", prefix, fullFrom ?? from, from, pos)) {
      items.push(h);
      if (items.filter((x) => x.kind === "signal").length >= 8) break;
    }
    // Locals from AST (ports / vars / instances)
    for (const sym of ctx.locals || []) {
      if (pl && !sym.name.toLowerCase().startsWith(pl)) continue;
      if (!pl && prefix.length === 0) continue;
      items.push({
        label: sym.name,
        insert: sym.insert || sym.name,
        detail: sym.detail || sym.kind,
        kind: sym.kind === "port" ? "port" : sym.kind === "instance" ? "instance" : "signal",
      });
    }
    // Module names (for instantiation)
    for (const m of ctx.modules || []) {
      if (!pl || !m.toLowerCase().startsWith(pl)) continue;
      items.push({
        label: m,
        insert: m,
        detail: "module",
        kind: "module",
      });
    }
  }

  // System tasks: `$` or `$dis…`
  if (prefix.startsWith("$") || prefix === "") {
    const sp = prefix.startsWith("$") ? prefix.toLowerCase() : "";
    if (prefix.startsWith("$") || text[pos - 1] === "$") {
      for (const t of SYSTEM_TASKS) {
        if (sp && !t.toLowerCase().startsWith(sp)) continue;
        items.push({
          label: t,
          insert: t,
          detail: "system task",
          kind: "system",
        });
      }
    }
  }

  if (prefix.length >= 1 && !prefix.startsWith("$") && !pathPrefix) {
    for (const sn of SNIPPETS) {
      if (sn.trigger.startsWith(pl) || fuzzyStarts(sn.trigger, prefix)) {
        items.push({
          label: sn.label,
          insert: sn.insert,
          detail: sn.detail,
          kind: sn.kind || "snippet",
        });
      }
    }
    for (const kw of SV_KEYWORDS) {
      if (kw.startsWith(pl) && kw !== pl) {
        items.push({
          label: kw,
          insert: kw,
          detail: "keyword",
          kind: "keyword",
        });
      }
    }
  }

  // Style nudge when typing legacy always @(posedge
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  const lineBefore = text.slice(lineStart, pos);
  if (/\balways\s+@\s*\(\s*posedge\b/i.test(lineBefore) && !/\balways_ff\b/i.test(lineBefore)) {
    items.unshift({
      label: "→ always_ff @(posedge …)",
      insert: lineBefore.replace(/\balways\b/, "always_ff"),
      detail: "style: prefer-always-ff",
      kind: "fix",
      replaceFrom: lineStart,
      replaceTo: pos,
    });
  }

  // Instantiation snippet when completing a module name alone on a line-ish
  if (!pathPrefix && pl.length >= 2) {
    for (const m of ctx.modules || []) {
      if (m.toLowerCase() !== pl) continue;
      items.unshift({
        label: `${m} u_${m} (…);`,
        insert: `${m} u_${m} (\n  .clk(clk),\n  .rst_n(rst_n)\n);`,
        detail: "instantiate module",
        kind: "snippet",
      });
    }
  }

  // Rank: fix > signal/port > instance > system > snippet > keyword
  const rank = {
    fix: 0,
    signal: 1,
    port: 1,
    instance: 2,
    module: 2,
    system: 3,
    snippet: 4,
    keyword: 5,
  };
  items.sort(
    (a, b) =>
      (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9) || a.label.localeCompare(b.label)
  );

  const seen = new Set();
  /** @type {Completion[]} */
  const out = [];
  for (const it of items) {
    const key = it.kind + ":" + it.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= 14) break;
  }

  // When pathPrefix set, replace from leaf start; hier insert is full path
  return { items: out, replaceFrom: from, replaceTo: pos, prefix };
}

/**
 * @param {AssistContext} ctx
 * @param {string} scope  e.g. "uut." or ""
 * @param {string} leafPrefix
 * @returns {Completion[]}
 */
function matchHierSignals(ctx, scope, leafPrefix, fullFrom, leafFrom, cursor) {
  /** @type {Completion[]} */
  const out = [];
  const lp = (leafPrefix || "").toLowerCase();
  const names = ctx.signals || [];
  const meta = ctx.signalMeta || {};

  for (const full of names) {
    if (scope) {
      if (!full.startsWith(scope)) continue;
      const rest = full.slice(scope.length);
      if (rest.includes(".")) {
        const seg = rest.split(".")[0];
        if (lp && !seg.toLowerCase().startsWith(lp)) continue;
        const path = scope + seg;
        if (!out.some((x) => x.insert === seg)) {
          out.push({
            label: path,
            insert: seg,
            detail: "hierarchy",
            kind: "instance",
            replaceFrom: leafFrom,
            replaceTo: cursor,
          });
        }
        continue;
      }
      if (lp && !rest.toLowerCase().startsWith(lp)) continue;
      const m = meta[full];
      out.push({
        label: full,
        insert: rest,
        detail: m ? `${m.kind || "signal"}[${m.width ?? "?"}]` : "signal",
        kind: "signal",
        replaceFrom: leafFrom,
        replaceTo: cursor,
      });
    } else {
      if (!lp) continue;
      const leaf = full.includes(".") ? full.slice(full.lastIndexOf(".") + 1) : full;
      if (!leaf.toLowerCase().startsWith(lp) && !full.toLowerCase().startsWith(lp)) continue;
      const m = meta[full];
      // Prefer inserting the full hierarchical name (replace entire token)
      out.push({
        label: full,
        insert: full,
        detail: m ? `${m.kind || "signal"}[${m.width ?? "?"}] · hier` : "hier signal",
        kind: "signal",
        replaceFrom: fullFrom,
        replaceTo: cursor,
      });
    }
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Token under cursor with hierarchical path support (`uut.clk`, `$display`).
 * @param {string} text
 * @param {number} pos
 */
function hierTokenAt(text, pos) {
  let i = pos;
  while (i > 0 && /[a-zA-Z0-9_$.]/.test(text[i - 1])) i--;
  const full = text.slice(i, pos);
  if (!full.includes(".")) {
    return { prefix: full, from: i, pathPrefix: "", full, fullFrom: i };
  }
  const parts = full.split(".");
  const leaf = parts[parts.length - 1];
  const pathPrefix = parts.slice(0, -1).join(".");
  const from = i + pathPrefix.length + (pathPrefix ? 1 : 0);
  return { prefix: leaf, from, pathPrefix, full, fullFrom: i };
}

/**
 * Ghost remainder for the top suggestion (what Tab inserts beyond the typed prefix).
 * @param {Completion} item
 * @param {string} prefix
 */
export function ghostSuffix(item, prefix) {
  if (!item) return "";
  const ins = item.insert || "";
  const first = ins.split("\n")[0];
  const p = prefix || "";
  if (
    item.kind === "keyword" ||
    item.kind === "signal" ||
    item.kind === "port" ||
    item.kind === "instance" ||
    item.kind === "module" ||
    item.kind === "system" ||
    (item.kind === "snippet" && !ins.includes("\n"))
  ) {
    // For hier inserts, ghost the remainder of the full insert vs leaf prefix
    if (first.toLowerCase().endsWith(p.toLowerCase()) === false && first.toLowerCase().includes(".")) {
      const leaf = first.slice(first.lastIndexOf(".") + 1);
      if (leaf.toLowerCase().startsWith(p.toLowerCase())) return leaf.slice(p.length);
    }
    if (first.toLowerCase().startsWith(p.toLowerCase())) {
      return first.slice(p.length);
    }
    return first;
  }
  if (first.toLowerCase().startsWith(p.toLowerCase())) {
    return first.slice(p.length) + (ins.includes("\n") ? "…" : "");
  }
  return " " + (item.label || first);
}

/**
 * Apply a completion into source.
 * @param {string} source
 * @param {Completion & { replaceFrom?: number, replaceTo?: number }} item
 * @param {number} replaceFrom
 * @param {number} replaceTo
 */
export function applyCompletion(source, item, replaceFrom, replaceTo) {
  const from = item.replaceFrom ?? replaceFrom;
  const to = item.replaceTo ?? replaceTo;
  const insert = item.insert ?? "";
  return {
    text: source.slice(0, from) + insert + source.slice(to),
    cursor: from + insert.length,
  };
}

/**
 * Auto-fixes derived from lintStyle / lintSynthesizability findings.
 * @param {{ rule?: string, message?: string, line?: number|null }[]} findings
 * @returns {(StyleFix & { finding: object })[]}
 */
export function fixesForFindings(findings) {
  /** @type {(StyleFix & { finding: object })[]} */
  const fixes = [];
  for (const f of findings || []) {
    const fix = fixForRule(f);
    if (fix) fixes.push({ ...fix, finding: f });
  }
  return fixes;
}

/**
 * @param {{ rule?: string, line?: number|null, message?: string }} f
 * @returns {StyleFix | null}
 */
export function fixForRule(f) {
  const rule = f?.rule;
  if (!rule) return null;

  if (rule === "prefer-always-ff") {
    return {
      rule,
      title: "Rewrite to always_ff",
      apply: (src) => replaceFirst(src, /\balways\s+@\s*\(\s*posedge/i, "always_ff @(posedge", f.line),
    };
  }
  if (rule === "prefer-always-comb") {
    return {
      rule,
      title: "Rewrite to always_comb",
      apply: (src) => {
        let out = replaceFirst(src, /\balways\s+@\s*\(\s*\*\s*\)/i, "always_comb", f.line);
        if (out == null) out = replaceFirst(src, /\balways\s+@\s*\*/i, "always_comb", f.line);
        return out;
      },
    };
  }
  if (rule === "prefer-logic") {
    return {
      rule,
      title: "reg → logic",
      apply: (src) => replaceFirst(src, /\breg\b/, "logic", f.line),
    };
  }
  if (rule === "name-clk") {
    return {
      rule,
      title: "Rename clock → clk",
      apply: (src) => {
        if (!/\bclock\b/i.test(src)) return null;
        return src.replace(/\bclock\b/gi, "clk");
      },
    };
  }
  if (rule === "name-rst") {
    return {
      rule,
      title: "Rename reset → rst_n",
      apply: (src) => {
        let s = src;
        if (/\breset_n\b/i.test(s)) return null;
        if (/\breset\b/i.test(s)) s = s.replace(/\breset\b/gi, "rst_n");
        else if (/\brst\b/i.test(s) && !/\brst_n\b/i.test(s)) s = s.replace(/\brst\b/g, "rst_n");
        else return null;
        return s;
      },
    };
  }
  if (rule === "blocking-in-seq") {
    return {
      rule,
      title: "Blocking = → <= (heuristic)",
      apply: (src) => replaceInAlwaysFfAssigns(src),
    };
  }
  return null;
}

function replaceInAlwaysFfAssigns(src) {
  // Conservative: only lines with `always_ff` blocks — simple whole-file heuristic for `q = d` → `q <= d` inside ff
  if (!/always_ff|always\s+@\s*\(\s*posedge/i.test(src)) return null;
  const next = src.replace(
    /(always_ff\b[\s\S]*?end\b|always\s+@\s*\(\s*posedge[\s\S]*?end\b)/gi,
    (block) => block.replace(/(\w(?:\.\w|\[[^\]]*\])*)\s*=\s*(?![=<>])/g, "$1 <= ")
  );
  return next === src ? null : next;
}

/**
 * @param {string} src
 * @param {RegExp} re
 * @param {string} replacement
 * @param {number|null|undefined} preferLine
 */
function replaceFirst(src, re, replacement, preferLine) {
  const lines = src.split(/\r?\n/);
  if (preferLine != null && preferLine >= 1 && preferLine <= lines.length) {
    const i = preferLine - 1;
    if (re.test(lines[i])) {
      lines[i] = lines[i].replace(re, replacement);
      return lines.join("\n");
    }
  }
  if (!re.test(src)) return null;
  re.lastIndex = 0;
  return src.replace(re, replacement);
}

function fuzzyStarts(full, prefix) {
  const f = full.toLowerCase();
  const p = prefix.toLowerCase();
  if (f.startsWith(p)) return true;
  let fi = 0;
  for (let pi = 0; pi < p.length; pi++) {
    fi = f.indexOf(p[pi], fi);
    if (fi < 0) return false;
    fi++;
  }
  return true;
}

/** Keyword list for labs / docs */
export const ASSIST_KEYWORDS = SV_KEYWORDS;
export const ASSIST_SNIPPETS = SNIPPETS;
