/**
 * Teaching synthesizability linter (static heuristics on the subset AST).
 * Not a replacement for Yosys / Vivado / DC — structured warnings for labs.
 */

import { parse } from "./parser.js";
import { materializeSources } from "./preprocess.js";

/** @typedef {{ rule: string, severity: "error"|"warning"|"info", message: string, line: number|null, col: number|null, excerpt?: string }} SynthFinding */

export const SYNTH_LINT_RULES = [
  "no-delay",
  "no-initial",
  "no-systask",
  "no-fork",
  "no-force",
  "timed-always",
  "blocking-in-seq",
  "nba-in-comb",
  "latch-risk",
  "decl-init",
  "parse-error",
];

const DEFAULT_RULES = SYNTH_LINT_RULES.filter((r) => r !== "parse-error");

/**
 * @param {string|string[]|object} source
 * @param {{ rules?: string[], files?: Record<string,string>, entry?: string }} [opts]
 * @returns {{ ok: boolean, findings: SynthFinding[], rules: string[] }}
 */
export function lintSynthesizability(source, opts = {}) {
  const enabled = new Set(opts.rules?.length ? opts.rules : DEFAULT_RULES);
  /** @type {SynthFinding[]} */
  const findings = [];

  let text;
  try {
    text = materializeSources(source, opts);
  } catch (e) {
    findings.push({
      rule: "parse-error",
      severity: "error",
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
      message: msg,
      line: m ? Number(m[1]) : null,
      col: m ? Number(m[2]) : null,
      excerpt: lineExcerpt(text, m ? Number(m[1]) : null),
    });
    return { ok: false, findings, rules: [...enabled] };
  }

  const ctx = { enabled, findings, text };

  for (const mod of ast.modules || []) {
    walkModule(mod, ctx);
  }
  for (const pkg of ast.packages || []) {
    walkNode(pkg, ctx, { inSeq: false, inComb: false });
  }

  // Attach line numbers for delay findings when possible
  if (enabled.has("no-delay")) annotateDelayLines(text, findings);

  findings.sort((a, b) => (a.line ?? 1e9) - (b.line ?? 1e9) || a.rule.localeCompare(b.rule));

  const ok = !findings.some((f) => f.severity === "error");
  return { ok, findings, rules: [...enabled] };
}

function emit(ctx, finding) {
  if (finding.rule !== "parse-error" && !ctx.enabled.has(finding.rule)) return;
  ctx.findings.push(finding);
}

function walkModule(mod, ctx) {
  for (const item of mod.items || []) walkItem(item, ctx);
}

function walkItem(item, ctx) {
  if (!item) return;
  switch (item.type) {
    case "ContinuousAssign":
    case "ContinuousAssignList":
      checkAssignDelay(item, ctx);
      break;
    case "Gate":
    case "GateList":
      if (item.delay && nonzeroDelay(item.delay)) {
        emit(ctx, {
          rule: "no-delay",
          severity: "error",
          message: "Gate delay (#…) is not synthesizable in this teaching lint",
          line: null,
          col: null,
        });
      }
      break;
    case "VarDecl":
      checkVarDecl(item, ctx);
      break;
    case "Initial":
      if (ctx.enabled.has("no-initial")) {
        emit(ctx, {
          rule: "no-initial",
          severity: "error",
          message: "`initial` blocks are simulation-only (not synthesizable RTL)",
          line: null,
          col: null,
        });
      }
      walkNode(item.body, ctx, { inSeq: false, inComb: false });
      break;
    case "Always":
      checkAlways(item, ctx);
      break;
    default:
      walkNode(item, ctx, { inSeq: false, inComb: false });
  }
}

function checkAssignDelay(item, ctx) {
  if (!ctx.enabled.has("no-delay")) return;
  if (item.delay && nonzeroDelay(item.delay)) {
    emit(ctx, {
      rule: "no-delay",
      severity: "error",
      message: "`assign` with `#delay` is not synthesizable (use a clocked pipeline)",
      line: null,
      col: null,
    });
  }
}

function checkVarDecl(item, ctx) {
  if (item.delay && nonzeroDelay(item.delay) && ctx.enabled.has("no-delay")) {
    emit(ctx, {
      rule: "no-delay",
      severity: "error",
      message: "Net delay on declaration is not synthesizable in this teaching lint",
      line: null,
      col: null,
    });
  }
  if (!ctx.enabled.has("decl-init")) return;
  const kind = item.kind || "";
  if (kind === "reg" || kind === "logic" || kind === "bit" || kind === "integer") {
    for (const d of item.decls || []) {
      if (d.init) {
        emit(ctx, {
          rule: "decl-init",
          severity: "warning",
          message: `Declaration init on '${d.name}' may be non-portable for ASIC; prefer reset in always_ff`,
          line: null,
          col: null,
        });
      }
    }
  }
}

function checkAlways(item, ctx) {
  const sens = item.sens;
  const isComb =
    item.svKind === "comb" ||
    item.svKind === "latch" ||
    (sens && sens.type === "Star");
  const isSeq =
    item.svKind === "ff" ||
    (sens &&
      sens.type === "SensList" &&
      (sens.items || []).some((it) => it.type === "Edge"));

  if (sens && sens.type === "Timed" && ctx.enabled.has("timed-always")) {
    emit(ctx, {
      rule: "timed-always",
      severity: "error",
      message: "`always #delay …` is a testbench/clock-gen pattern, not synthesizable RTL",
      line: null,
      col: null,
    });
  }

  if (item.svKind === "latch" && ctx.enabled.has("latch-risk")) {
    emit(ctx, {
      rule: "latch-risk",
      severity: "warning",
      message: "`always_latch` explicitly requests a latch — confirm that is intended",
      line: null,
      col: null,
    });
  }

  if (isComb && ctx.enabled.has("latch-risk")) {
    analyzeLatchRisk(item.body, ctx);
  }

  walkNode(item.body, ctx, { inSeq: !!isSeq, inComb: !!isComb });
}

function analyzeLatchRisk(body, ctx) {
  // Heuristic: if/else or case that assigns in some arms only
  const roots = flattenStmts(body);
  for (const st of roots) {
    if (st.type === "If") {
      const thenNames = assignedNames(st.then);
      const elseNames = st.else ? assignedNames(st.else) : new Set();
      if (!st.else && thenNames.size) {
        emit(ctx, {
          rule: "latch-risk",
          severity: "warning",
          message: `Incomplete if (no else) assigning {${[...thenNames].join(", ")}} — may infer a latch`,
          line: null,
          col: null,
        });
      } else if (st.else) {
        for (const n of thenNames) {
          if (!elseNames.has(n)) {
            emit(ctx, {
              rule: "latch-risk",
              severity: "warning",
              message: `'${n}' not assigned on every if/else path — may infer a latch`,
              line: null,
              col: null,
            });
          }
        }
        for (const n of elseNames) {
          if (!thenNames.has(n)) {
            emit(ctx, {
              rule: "latch-risk",
              severity: "warning",
              message: `'${n}' not assigned on every if/else path — may infer a latch`,
              line: null,
              col: null,
            });
          }
        }
      }
    }
    if (st.type === "Case") {
      const hasDefault = (st.items || []).some((it) => it.items == null);
      const armSets = (st.items || []).map((it) => assignedNames(it.body));
      const union = new Set();
      armSets.forEach((s) => s.forEach((n) => union.add(n)));
      if (!hasDefault && union.size) {
        emit(ctx, {
          rule: "latch-risk",
          severity: "warning",
          message: `case without default assigning {${[...union].join(", ")}} — may infer a latch`,
          line: null,
          col: null,
        });
      } else if (hasDefault && armSets.length) {
        for (const n of union) {
          if (!armSets.every((s) => s.has(n))) {
            emit(ctx, {
              rule: "latch-risk",
              severity: "warning",
              message: `'${n}' not assigned in every case arm — may infer a latch`,
              line: null,
              col: null,
            });
          }
        }
      }
    }
  }
}

function walkNode(node, ctx, flags) {
  if (!node || typeof node !== "object") return;

  if (node.type === "Delay" || node.type === "DelayStmt") {
    if (ctx.enabled.has("no-delay")) {
      emit(ctx, {
        rule: "no-delay",
        severity: "error",
        message: "Procedural `#delay` is not synthesizable",
        line: null,
        col: null,
      });
    }
  }
  if (node.type === "SysTask" && ctx.enabled.has("no-systask")) {
    emit(ctx, {
      rule: "no-systask",
      severity: "error",
      message: `System task '${node.name}' is simulation-only (not synthesizable)`,
      line: null,
      col: null,
    });
  }
  if (node.type === "Fork" && ctx.enabled.has("no-fork")) {
    emit(ctx, {
      rule: "no-fork",
      severity: "error",
      message: "`fork`/`join` is not synthesizable RTL",
      line: null,
      col: null,
    });
  }
  if (node.type === "Force" && ctx.enabled.has("no-force")) {
    emit(ctx, {
      rule: "no-force",
      severity: "error",
      message: "`force`/`release` is not synthesizable RTL",
      line: null,
      col: null,
    });
  }
  if (node.type === "Blocking" && flags.inSeq && ctx.enabled.has("blocking-in-seq")) {
    emit(ctx, {
      rule: "blocking-in-seq",
      severity: "warning",
      message: "Blocking `=` inside an edge-triggered always — prefer non-blocking `<=` for flops",
      line: null,
      col: null,
    });
  }
  if (node.type === "NBA" && flags.inComb && ctx.enabled.has("nba-in-comb")) {
    emit(ctx, {
      rule: "nba-in-comb",
      severity: "warning",
      message: "Non-blocking `<=` inside combinational always — prefer blocking `=`",
      line: null,
      col: null,
    });
  }

  // Recurse common child fields
  const kids = [
    node.body,
    node.then,
    node.else,
    node.stmt,
    node.lhs,
    node.rhs,
    node.expr,
    node.cond,
    node.init,
    node.step,
    node.count,
  ];
  for (const k of kids) {
    if (Array.isArray(k)) k.forEach((x) => walkNode(x, ctx, flags));
    else walkNode(k, ctx, flags);
  }
  if (Array.isArray(node.stmts)) node.stmts.forEach((s) => walkNode(s, ctx, flags));
  if (Array.isArray(node.branches)) node.branches.forEach((s) => walkNode(s, ctx, flags));
  if (Array.isArray(node.items)) {
    for (const it of node.items) {
      if (it && it.body) walkNode(it.body, ctx, flags);
      else walkNode(it, ctx, flags);
    }
  }
  if (Array.isArray(node.assigns)) {
    for (const a of node.assigns) {
      walkNode(a.lhs, ctx, flags);
      walkNode(a.rhs, ctx, flags);
    }
  }
}

function flattenStmts(node) {
  if (!node) return [];
  if (node.type === "Block") return (node.stmts || []).flatMap(flattenStmts);
  return [node];
}

function assignedNames(node) {
  const set = new Set();
  collectAssigns(node, set);
  return set;
}

function collectAssigns(node, set) {
  if (!node || typeof node !== "object") return;
  if (node.type === "Blocking" || node.type === "NBA") {
    if (node.lhs && node.lhs.name) set.add(node.lhs.name);
  }
  if (node.type === "Block") (node.stmts || []).forEach((s) => collectAssigns(s, set));
  if (node.type === "If") {
    collectAssigns(node.then, set);
    collectAssigns(node.else, set);
  }
  if (node.type === "Case") (node.items || []).forEach((it) => collectAssigns(it.body, set));
  if (node.body) collectAssigns(node.body, set);
}

function nonzeroDelay(delay) {
  if (delay == null || delay === 0) return false;
  if (typeof delay === "number") return delay !== 0;
  if (typeof delay === "object") {
    if (delay.rise || delay.fall || delay.toff) return true;
    if (delay.value != null && delay.value !== 0) return true;
  }
  return true;
}

function annotateDelayLines(text, findings) {
  const lines = text.split(/\r?\n/);
  const delayFindings = findings.filter((f) => f.rule === "no-delay" && f.line == null);
  if (!delayFindings.length) return;
  let fi = 0;
  for (let i = 0; i < lines.length && fi < delayFindings.length; i++) {
    const line = lines[i];
    if (/^\s*\/\//.test(line) || /timescale/i.test(line)) continue;
    if (/#\s*\d|assign\s+#/.test(line)) {
      delayFindings[fi].line = i + 1;
      delayFindings[fi].excerpt = line.trim();
      fi++;
    }
  }
}

function lineExcerpt(text, line) {
  if (!line) return undefined;
  const lines = text.split(/\r?\n/);
  return lines[line - 1] ? lines[line - 1].trim() : undefined;
}
