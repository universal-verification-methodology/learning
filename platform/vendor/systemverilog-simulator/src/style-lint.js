/**
 * HDL naming / style linter (teaching + IDE assist).
 * Heuristics — not Verible / company style guides.
 */

import { parse } from "./parser.js";
import { materializeSources } from "./preprocess.js";

/** @typedef {{ rule: string, severity: "error"|"warning"|"info", message: string, line: number|null, col: number|null, excerpt?: string, category?: "style"|"synth"|"parse" }} StyleFinding */

export const STYLE_LINT_RULES = [
  "name-clk",
  "name-rst",
  "prefer-always-ff",
  "prefer-always-comb",
  "prefer-logic",
  "parse-error",
];

const DEFAULT_RULES = STYLE_LINT_RULES.filter((r) => r !== "parse-error");

/**
 * @param {string|string[]|object} source
 * @param {{ rules?: string[], files?: Record<string,string>, entry?: string }} [opts]
 * @returns {{ ok: boolean, findings: StyleFinding[], rules: string[] }}
 */
export function lintStyle(source, opts = {}) {
  const enabled = new Set(opts.rules?.length ? opts.rules : DEFAULT_RULES);
  /** @type {StyleFinding[]} */
  const findings = [];

  let text;
  try {
    text = materializeSources(source, opts);
  } catch (e) {
    findings.push({
      rule: "parse-error",
      severity: "error",
      category: "parse",
      message: e && e.message ? e.message : String(e),
      line: null,
      col: null,
    });
    return { ok: false, findings, rules: [...enabled] };
  }

  let ast;
  try {
    ast = parse(text);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const m = /at (\d+):(\d+)/.exec(msg);
    findings.push({
      rule: "parse-error",
      severity: "error",
      category: "parse",
      message: msg,
      line: m ? Number(m[1]) : null,
      col: m ? Number(m[2]) : null,
      excerpt: lineExcerpt(text, m ? Number(m[1]) : null),
    });
    return { ok: false, findings, rules: [...enabled] };
  }

  const ctx = { enabled, findings, text };

  for (const mod of ast.modules || []) {
    lintModule(mod, ctx);
  }

  // Line-oriented supplements (always keywords, legacy reg)
  scanSourceLines(text, ctx);

  // Dedupe identical rule+line
  const seen = new Set();
  const deduped = [];
  for (const f of findings) {
    const key = `${f.rule}|${f.line ?? ""}|${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(f);
  }
  findings.length = 0;
  findings.push(...deduped);

  findings.sort((a, b) => (a.line ?? 1e9) - (b.line ?? 1e9) || a.rule.localeCompare(b.rule));
  const ok = !findings.some((f) => f.severity === "error");
  return { ok, findings, rules: [...enabled] };
}

function emit(ctx, finding) {
  if (finding.rule !== "parse-error" && !ctx.enabled.has(finding.rule)) return;
  finding.category = finding.category || "style";
  ctx.findings.push(finding);
}

function lintModule(mod, ctx) {
  for (const p of mod.ports || []) {
    checkSignalName(p.name, p.direction, ctx);
    if (ctx.enabled.has("prefer-logic") && p.kind === "reg") {
      const line = findIdentLine(ctx.text, p.name);
      emit(ctx, {
        rule: "prefer-logic",
        severity: "info",
        message: "Prefer SystemVerilog `logic` over `reg` for new RTL (teaching style)",
        line,
        col: null,
        excerpt: lineExcerpt(ctx.text, line),
      });
    }
  }

  for (const item of mod.items || []) {
    if (item.type === "PortDecl") {
      for (const name of item.names || []) checkSignalName(name, item.direction, ctx);
    }
    if (item.type === "VarDecl") {
      for (const d of item.decls || []) checkSignalName(d.name, null, ctx);
      if (ctx.enabled.has("prefer-logic") && item.kind === "reg") {
        const name = item.decls?.[0]?.name;
        const line = name ? findIdentLine(ctx.text, name) : null;
        emit(ctx, {
          rule: "prefer-logic",
          severity: "info",
          message: "Prefer SystemVerilog `logic` over `reg` for new RTL (teaching style)",
          line,
          col: null,
          excerpt: lineExcerpt(ctx.text, line),
        });
      }
    }
    if (item.type === "Always") checkAlwaysStyle(item, ctx);
  }
}

function checkSignalName(name, direction, ctx) {
  if (!name) return;
  const line = findIdentLine(ctx.text, name);
  const lower = name.toLowerCase();

  if (ctx.enabled.has("name-clk")) {
    if (lower === "clock" || lower === "clk_in") {
      emit(ctx, {
        rule: "name-clk",
        severity: "info",
        message: `Clock-like port/signal '${name}' — prefer \`clk\` / \`clk_i\` (teaching style)`,
        line,
        col: null,
        excerpt: lineExcerpt(ctx.text, line),
      });
    }
  }

  if (ctx.enabled.has("name-rst")) {
    if (lower === "reset" || lower === "rst" || lower === "reset_n" || lower === "rstn") {
      if (!/_n$/i.test(name) && lower !== "rst_n") {
        emit(ctx, {
          rule: "name-rst",
          severity: "info",
          message: `Reset '${name}' — active-low style often uses \`rst_n\` / \`reset_n\` (teaching style)`,
          line,
          col: null,
          excerpt: lineExcerpt(ctx.text, line),
        });
      }
    }
  }

  // Soft prefix hint for ports only when clearly missing convention noise would be high —
  // skip generic port prefixes to avoid spam; clk/rst covered above.
  void direction;
}

function checkAlwaysStyle(item, ctx) {
  const sens = item.sens;
  const isEdge =
    sens &&
    sens.type === "SensList" &&
    (sens.items || []).some((it) => it.type === "Edge");
  const isStar = sens && sens.type === "Star";

  if (isEdge && !item.svKind && ctx.enabled.has("prefer-always-ff")) {
    emit(ctx, {
      rule: "prefer-always-ff",
      severity: "info",
      message: "Edge-triggered `always` — prefer `always_ff @(posedge …)` for flops (teaching style)",
      line: findAlwaysLine(ctx.text, "edge"),
      col: null,
    });
  }
  if (isStar && item.svKind !== "comb" && item.svKind !== "latch" && ctx.enabled.has("prefer-always-comb")) {
    if (!item.svKind) {
      emit(ctx, {
        rule: "prefer-always-comb",
        severity: "info",
        message: "Combinational `always @(*)` — prefer `always_comb` (teaching style)",
        line: findAlwaysLine(ctx.text, "star"),
        col: null,
      });
    }
  }

  // Clock name in sensitivity
  if (isEdge && ctx.enabled.has("name-clk")) {
    for (const it of sens.items || []) {
      if (it.type === "Edge" && it.edge === "posedge") {
        const n = it.name || "";
        // Flag non-clk names, and legacy `clock` (prefer clk)
        if (n && (!/clk/i.test(n) || /^clock$/i.test(n))) {
          if (!/^clk(_|$)/i.test(n) && !/_clk$/i.test(n)) {
            emit(ctx, {
              rule: "name-clk",
              severity: "info",
              message: `posedge '${n}' — prefer a \`clk\` / \`*_clk\` name (teaching style)`,
              line: findIdentLine(ctx.text, n),
              col: null,
              excerpt: lineExcerpt(ctx.text, findIdentLine(ctx.text, n)),
            });
          }
        }
      }
      if (it.type === "Edge" && it.edge === "negedge" && ctx.enabled.has("name-rst")) {
        const n = it.name || "";
        if (n && !/rst|reset/i.test(n)) {
          emit(ctx, {
            rule: "name-rst",
            severity: "info",
            message: `negedge '${n}' — async resets are usually \`rst_n\` / \`reset_n\` (teaching style)`,
            line: findIdentLine(ctx.text, n),
            col: null,
          });
        }
      }
    }
  }
}

function scanSourceLines(text, ctx) {
  const lines = text.split(/\r?\n/);
  let edgeHinted = false;
  let starHinted = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\/\//.test(line)) continue;
    if (
      ctx.enabled.has("prefer-always-ff") &&
      !edgeHinted &&
      /\balways\s+@\s*\(\s*posedge\b/i.test(line) &&
      !/\balways_ff\b/i.test(line)
    ) {
      // AST may have emitted already; avoid dup if same line
      if (!ctx.findings.some((f) => f.rule === "prefer-always-ff" && f.line === i + 1)) {
        emit(ctx, {
          rule: "prefer-always-ff",
          severity: "info",
          message: "Prefer `always_ff @(posedge …)` for sequential logic (teaching style)",
          line: i + 1,
          col: null,
          excerpt: line.trim(),
        });
      }
      edgeHinted = true;
    }
    if (
      ctx.enabled.has("prefer-always-comb") &&
      !starHinted &&
      /\balways\s+@\s*\(\s*\*/i.test(line) &&
      !/\balways_comb\b/i.test(line)
    ) {
      if (!ctx.findings.some((f) => f.rule === "prefer-always-comb" && f.line === i + 1)) {
        emit(ctx, {
          rule: "prefer-always-comb",
          severity: "info",
          message: "Prefer `always_comb` over `always @(*)` (teaching style)",
          line: i + 1,
          col: null,
          excerpt: line.trim(),
        });
      }
      starHinted = true;
    }
  }
}

function findIdentLine(text, name) {
  const re = new RegExp(`\\b${escapeRe(name)}\\b`);
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\/\//.test(lines[i])) continue;
    if (re.test(lines[i])) return i + 1;
  }
  return null;
}

function findAlwaysLine(text, kind) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (kind === "edge" && /\balways\s+@\s*\(\s*posedge\b/i.test(line) && !/\balways_ff\b/.test(line))
      return i + 1;
    if (kind === "star" && /\balways\s+@\s*\(\s*\*/i.test(line) && !/\balways_comb\b/.test(line))
      return i + 1;
  }
  return null;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineExcerpt(text, line) {
  if (!line) return undefined;
  const lines = text.split(/\r?\n/);
  return lines[line - 1] ? lines[line - 1].trim() : undefined;
}
