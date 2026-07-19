(() => {
  const STORAGE_KEY = "ddv-boolean-laws-v1";
  const CLEARED_KEY = "ddv-boolean-laws-cleared-v1";

  /** @typedef {{type:'const',v:0|1}|{type:'var',name:string}|{type:'not',arg:Expr}|{type:'and',args:Expr[]}|{type:'or',args:Expr[]}} Expr */

  function clone(e) {
    return JSON.parse(JSON.stringify(e));
  }

  function V(name) {
    return { type: "var", name };
  }
  function C(v) {
    return { type: "const", v: v ? 1 : 0 };
  }
  function Not(arg) {
    return { type: "not", arg };
  }
  function And(...args) {
    return { type: "and", args: args.flatMap((a) => (a.type === "and" ? a.args : [a])) };
  }
  function Or(...args) {
    return { type: "or", args: args.flatMap((a) => (a.type === "or" ? a.args : [a])) };
  }

  function eq(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === "const") return a.v === b.v;
    if (a.type === "var") return a.name === b.name;
    if (a.type === "not") return eq(a.arg, b.arg);
    if (a.args.length !== b.args.length) return false;
    return a.args.every((x, i) => eq(x, b.args[i]));
  }

  /** Structural normalize: sort and/or args by string for comparison only. */
  function canon(e) {
    if (e.type === "not") return Not(canon(e.arg));
    if (e.type === "and" || e.type === "or") {
      const args = e.args.map(canon).sort((x, y) => stringify(x).localeCompare(stringify(y)));
      return e.type === "and" ? And(...args) : Or(...args);
    }
    return e;
  }

  function equiv(a, b) {
    return eq(canon(a), canon(b));
  }

  function stringify(e, parentPrec = 0) {
    const prec = { const: 5, var: 5, not: 4, and: 3, or: 2 };
    if (e.type === "const") return e.v ? "1" : "0";
    if (e.type === "var") return e.name;
    if (e.type === "not") {
      const inner = e.arg;
      if (inner.type === "var" || inner.type === "const") return inner.type === "var" ? inner.name + "'" : (inner.v ? "0" : "1");
      return "~(" + stringify(inner, 0) + ")";
    }
    if (e.type === "and") {
      const s = e.args.map((a) => stringify(a, prec.and)).join("·");
      return parentPrec > prec.and ? "(" + s + ")" : s;
    }
    if (e.type === "or") {
      const s = e.args.map((a) => stringify(a, prec.or)).join(" + ");
      return parentPrec > prec.or ? "(" + s + ")" : s;
    }
    return "?";
  }

  function parse(input) {
    const s = String(input)
      .replace(/\s+/g, "")
      .replace(/∧/g, "·")
      .replace(/&/g, "·")
      .replace(/\*/g, "·")
      .replace(/∨/g, "+")
      .replace(/\|/g, "+")
      .replace(/¬/g, "~")
      .replace(/!/g, "~");
    let i = 0;
    function peek() {
      return s[i];
    }
    function eat(ch) {
      if (s[i] === ch) {
        i++;
        return true;
      }
      return false;
    }
    function parseOr() {
      let left = parseAnd();
      while (eat("+")) left = Or(left, parseAnd());
      return left;
    }
    function parseAnd() {
      let left = parseUnary();
      while (peek() && peek() !== "+" && peek() !== ")") {
        if (eat("·")) {
          left = And(left, parseUnary());
          continue;
        }
        // juxtaposition: AB or A(
        if (/[A-Da-d01~(]/.test(peek())) {
          left = And(left, parseUnary());
          continue;
        }
        break;
      }
      return left;
    }
    function parseUnary() {
      if (eat("~")) return Not(parseUnary());
      let primary = parsePrimary();
      while (eat("'")) primary = Not(primary);
      return primary;
    }
    function parsePrimary() {
      if (eat("(")) {
        const e = parseOr();
        if (!eat(")")) throw new Error("missing )");
        return e;
      }
      const ch = peek();
      if (ch === "0" || ch === "1") {
        i++;
        return C(ch === "1");
      }
      if (ch && /[A-Da-d]/.test(ch)) {
        i++;
        return V(ch.toUpperCase());
      }
      throw new Error("parse error at " + (ch || "EOF"));
    }
    const expr = parseOr();
    if (i !== s.length) throw new Error("trailing input");
    return expr;
  }

  function mapAt(e, path, fn) {
    if (!path.length) return fn(e);
    const [head, ...rest] = path;
    if (e.type === "not" && head === "arg") return Not(mapAt(e.arg, rest, fn));
    if ((e.type === "and" || e.type === "or") && typeof head === "number") {
      const args = e.args.slice();
      args[head] = mapAt(args[head], rest, fn);
      return e.type === "and" ? And(...args) : Or(...args);
    }
    return e;
  }

  function getAt(e, path) {
    let cur = e;
    for (const p of path) {
      if (p === "arg") cur = cur.arg;
      else cur = cur.args[p];
    }
    return cur;
  }

  function walk(e, path, visit) {
    visit(e, path);
    if (e.type === "not") walk(e.arg, path.concat("arg"), visit);
    if (e.type === "and" || e.type === "or") e.args.forEach((a, i) => walk(a, path.concat(i), visit));
  }

  /** Find applicable rewrites: { law, label, next } */
  function findRewrites(root) {
    const out = [];
    function add(law, label, path, nextNode) {
      const next = mapAt(root, path, () => nextNode);
      if (equiv(next, root)) return;
      out.push({ law, label, next, shown: stringify(next) });
    }

    walk(root, [], (node, path) => {
      // Double negation
      if (node.type === "not" && node.arg.type === "not") {
        add("double-neg", "Double negation ~~X → X", path, node.arg.arg);
      }
      // De Morgan
      if (node.type === "not" && node.arg.type === "and") {
        add("demorgan-and", "De Morgan ~(X·Y) → X'+Y'", path, Or(...node.arg.args.map(Not)));
      }
      if (node.type === "not" && node.arg.type === "or") {
        add("demorgan-or", "De Morgan ~(X+Y) → X'·Y'", path, And(...node.arg.args.map(Not)));
      }
      // Identity / null / idempotent / complement on and
      if (node.type === "and") {
        const args = node.args;
        if (args.some((a) => a.type === "const" && a.v === 0)) add("null-and", "Null X·0 → 0", path, C(0));
        if (args.some((a) => a.type === "const" && a.v === 1) && args.length > 1) {
          const rest = args.filter((a) => !(a.type === "const" && a.v === 1));
          add("id-and", "Identity X·1 → X", path, rest.length === 1 ? rest[0] : And(...rest));
        }
        for (let i = 0; i < args.length; i++) {
          for (let j = i + 1; j < args.length; j++) {
            if (eq(args[i], args[j])) {
              const rest = args.filter((_, k) => k !== j);
              add("idem-and", "Idempotent X·X → X", path, rest.length === 1 ? rest[0] : And(...rest));
            }
            if (args[j].type === "not" && eq(args[i], args[j].arg)) add("comp-and", "Complement X·X' → 0", path, C(0));
            if (args[i].type === "not" && eq(args[j], args[i].arg)) add("comp-and", "Complement X·X' → 0", path, C(0));
          }
        }
        // Absorption A·(A+B) → A
        for (let i = 0; i < args.length; i++) {
          for (let j = 0; j < args.length; j++) {
            if (i === j) continue;
            if (args[j].type === "or" && args[j].args.some((t) => eq(t, args[i]))) {
              const rest = args.filter((_, k) => k !== j);
              add("absorb-and", "Absorption X·(X+Y) → X", path, rest.length === 1 ? rest[0] : And(...rest));
            }
          }
        }
        // Distribute A·(B+C) → A·B+A·C (one or factor)
        for (let i = 0; i < args.length; i++) {
          if (args[i].type === "or" && args[i].args.length >= 2) {
            const others = args.filter((_, k) => k !== i);
            const factor = others.length === 1 ? others[0] : And(...others);
            const terms = args[i].args.map((t) => And(factor, t));
            add("dist-and", "Distribute X·(Y+Z) → X·Y+X·Z", path, Or(...terms));
          }
        }
      }
      if (node.type === "or") {
        const args = node.args;
        if (args.some((a) => a.type === "const" && a.v === 1)) add("null-or", "Null X+1 → 1", path, C(1));
        if (args.some((a) => a.type === "const" && a.v === 0) && args.length > 1) {
          const rest = args.filter((a) => !(a.type === "const" && a.v === 0));
          add("id-or", "Identity X+0 → X", path, rest.length === 1 ? rest[0] : Or(...rest));
        }
        for (let i = 0; i < args.length; i++) {
          for (let j = i + 1; j < args.length; j++) {
            if (eq(args[i], args[j])) {
              const rest = args.filter((_, k) => k !== j);
              add("idem-or", "Idempotent X+X → X", path, rest.length === 1 ? rest[0] : Or(...rest));
            }
            if (args[j].type === "not" && eq(args[i], args[j].arg)) add("comp-or", "Complement X+X' → 1", path, C(1));
            if (args[i].type === "not" && eq(args[j], args[i].arg)) add("comp-or", "Complement X+X' → 1", path, C(1));
          }
        }
        // Absorption A+A·B → A
        for (let i = 0; i < args.length; i++) {
          for (let j = 0; j < args.length; j++) {
            if (i === j) continue;
            if (args[j].type === "and" && args[j].args.some((t) => eq(t, args[i]))) {
              const rest = args.filter((_, k) => k !== j);
              add("absorb-or", "Absorption X+X·Y → X", path, rest.length === 1 ? rest[0] : Or(...rest));
            }
          }
        }
        // Factor A·B+A·C → A·(B+C)
        for (let i = 0; i < args.length; i++) {
          for (let j = i + 1; j < args.length; j++) {
            if (args[i].type !== "and" || args[j].type !== "and") continue;
            for (const f of args[i].args) {
              if (!args[j].args.some((t) => eq(t, f))) continue;
              const left = args[i].args.filter((t) => !eq(t, f));
              const right = args[j].args.filter((t) => !eq(t, f));
              const L = left.length === 0 ? C(1) : left.length === 1 ? left[0] : And(...left);
              const R = right.length === 0 ? C(1) : right.length === 1 ? right[0] : And(...right);
              const factored = And(f, Or(L, R));
              const rest = args.filter((_, k) => k !== i && k !== j);
              add("factor", "Factor X·Y+X·Z → X·(Y+Z)", path, rest.length ? Or(factored, ...rest) : factored);
            }
          }
        }
      }
    });

    // Dedupe by shown string + law
    const seen = new Set();
    return out.filter((r) => {
      const k = r.law + "|" + r.shown;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const LAW_REF = [
    { id: "demorgan-and", text: "De Morgan: ~(A·B) = A'+B'" },
    { id: "demorgan-or", text: "De Morgan: ~(A+B) = A'·B'" },
    { id: "double-neg", text: "Double negation: ~~A = A" },
    { id: "id-and", text: "Identity: A·1 = A" },
    { id: "id-or", text: "Identity: A+0 = A" },
    { id: "null-and", text: "Null: A·0 = 0" },
    { id: "null-or", text: "Null: A+1 = 1" },
    { id: "idem-and", text: "Idempotent: A·A = A" },
    { id: "idem-or", text: "Idempotent: A+A = A" },
    { id: "comp-and", text: "Complement: A·A' = 0" },
    { id: "comp-or", text: "Complement: A+A' = 1" },
    { id: "absorb-or", text: "Absorption: A+A·B = A" },
    { id: "absorb-and", text: "Absorption: A·(A+B) = A" },
    { id: "dist-and", text: "Distribute: A·(B+C) = A·B+A·C" },
    { id: "factor", text: "Factor: A·B+A·C = A·(B+C)" },
  ];

  const CHALLENGES = [
    {
      id: "quiz-dm-and",
      title: "Quiz: De Morgan AND",
      type: "quiz",
      prompt: "~(A·B) equals…",
      hint: "Break the bar, change the sign.",
      choices: ["A'+B'", "A'·B'", "A·B", "A+B"],
      answer: "A'+B'",
    },
    {
      id: "quiz-dm-or",
      title: "Quiz: De Morgan OR",
      type: "quiz",
      prompt: "~(A+B) equals…",
      hint: "Break the bar, change the sign.",
      choices: ["A'·B'", "A'+B'", "A·B", "~A+B"],
      answer: "A'·B'",
    },
    {
      id: "quiz-dn",
      title: "Quiz: double negation",
      type: "quiz",
      prompt: "~~A equals…",
      hint: "Two inversions cancel.",
      choices: ["A", "A'", "0", "1"],
      answer: "A",
    },
    {
      id: "quiz-comp",
      title: "Quiz: complement",
      type: "quiz",
      prompt: "A + A' equals…",
      hint: "Always true.",
      choices: ["1", "0", "A", "A'"],
      answer: "1",
    },
    {
      id: "quiz-null",
      title: "Quiz: null element",
      type: "quiz",
      prompt: "A · 0 equals…",
      hint: "AND with false.",
      choices: ["0", "1", "A", "A'"],
      answer: "0",
    },
    {
      id: "quiz-absorb",
      title: "Quiz: absorption",
      type: "quiz",
      prompt: "A + A·B equals…",
      hint: "A already covers the product.",
      choices: ["A", "B", "A·B", "A+B"],
      answer: "A",
    },
    {
      id: "quiz-idem",
      title: "Quiz: idempotent",
      type: "quiz",
      prompt: "A · A equals…",
      hint: "Same twice.",
      choices: ["A", "0", "1", "A'"],
      answer: "A",
    },
    {
      id: "quiz-dist",
      title: "Quiz: distribute",
      type: "quiz",
      prompt: "A·(B+C) equals…",
      hint: "Push AND over OR.",
      choices: ["A·B + A·C", "A+B·C", "(A·B)+C", "A·B·C"],
      answer: "A·B + A·C",
    },
    {
      id: "pick-dm",
      title: "Pick: De Morgan step",
      type: "pick",
      prompt: "From ~(A·B), which is the De Morgan rewrite?",
      hint: "A'+B'",
      start: "~(A·B)",
      choices: ["A'+B'", "A'·B'", "A·B", "~A·B"],
      answer: "A'+B'",
    },
    {
      id: "pick-absorb",
      title: "Pick: absorption",
      type: "pick",
      prompt: "Simplify A + A·B in one absorption step.",
      hint: "Result is A.",
      start: "A+A·B",
      choices: ["A", "B", "A·B", "A+B"],
      answer: "A",
    },
    {
      id: "pick-comp-and",
      title: "Pick: complement AND",
      type: "pick",
      prompt: "Simplify A·A'.",
      hint: "Contradiction.",
      start: "A·A'",
      choices: ["0", "1", "A", "A'"],
      answer: "0",
    },
    {
      id: "pick-factor",
      title: "Pick: factor",
      type: "pick",
      prompt: "Factor A·B + A·C.",
      hint: "Pull out A.",
      start: "A·B+A·C",
      choices: ["A·(B+C)", "A+B·C", "(A·B)·C", "A·B·C"],
      answer: "A·(B+C)",
    },
    {
      id: "pick-id",
      title: "Pick: identity",
      type: "pick",
      prompt: "Simplify A·1.",
      hint: "Identity for AND.",
      start: "A·1",
      choices: ["A", "1", "0", "A'"],
      answer: "A",
    },
    {
      id: "pick-dm-or",
      title: "Pick: De Morgan OR",
      type: "pick",
      prompt: "Rewrite ~(A+B).",
      hint: "Product of complements.",
      start: "~(A+B)",
      choices: ["A'·B'", "A'+B'", "A·B", "A'+B"],
      answer: "A'·B'",
    },
    {
      id: "reach-dm",
      title: "Reach: De Morgan",
      type: "reach",
      prompt: "Apply rewrites until you reach A'+B' from ~(A·B).",
      hint: "One De Morgan click.",
      start: "~(A·B)",
      target: "A'+B'",
    },
    {
      id: "reach-absorb",
      title: "Reach: absorb",
      type: "reach",
      prompt: "Reach A from A + A·B.",
      hint: "Absorption.",
      start: "A+A·B",
      target: "A",
    },
    {
      id: "reach-dn",
      title: "Reach: ~~A",
      type: "reach",
      prompt: "Simplify ~~A to A.",
      hint: "Double negation.",
      start: "~~A",
      target: "A",
    },
    {
      id: "reach-comp",
      title: "Reach: A+A'",
      type: "reach",
      prompt: "Simplify A+A' to 1.",
      hint: "Complement.",
      start: "A+A'",
      target: "1",
    },
    {
      id: "reach-factor",
      title: "Reach: factor form",
      type: "reach",
      prompt: "From A·B+A·C reach A·(B+C).",
      hint: "Factor rewrite.",
      start: "A·B+A·C",
      target: "A·(B+C)",
    },
    {
      id: "law-name-dm",
      title: "Name the law",
      type: "quiz",
      prompt: "The step ~(A·B) → A'+B' uses which law?",
      hint: "Named after Augustus…",
      choices: ["De Morgan", "Absorption", "Idempotent", "Null"],
      answer: "De Morgan",
    },
    {
      id: "law-name-abs",
      title: "Name: absorption",
      type: "quiz",
      prompt: "A + A·B → A is called…",
      hint: "Smaller term absorbed.",
      choices: ["Absorption", "De Morgan", "Distribute", "Complement"],
      answer: "Absorption",
    },
    {
      id: "law-name-comp",
      title: "Name: complement",
      type: "quiz",
      prompt: "A·A' → 0 is the…",
      hint: "Opposite of identity.",
      choices: ["Complement law", "Identity law", "De Morgan", "Distributive"],
      answer: "Complement law",
    },
  ];

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const state = {
    expr: null,
    history: [],
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
  };

  function loadStarter() {
    state.expr = parse("~(A·B)");
    state.history = [{ expr: clone(state.expr), note: "Start" }];
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ expr: stringify(state.expr), history: state.history.map((h) => ({ note: h.note, expr: stringify(h.expr) })) })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      state.expr = parse(d.expr);
      state.history = (d.history || []).map((h) => ({ note: h.note, expr: parse(h.expr) }));
      if (!state.history.length) state.history = [{ expr: clone(state.expr), note: "Start" }];
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("bl-root");
  root.innerHTML = `
    <p class="starter-note" id="starter-note"></p>
    <div class="challenge">
      <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div id="chal-quiz" class="quiz-choices" hidden></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <button type="button" class="btn btn-ghost" id="chal-load">Load into playground</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head">
          <h2>Playground</h2>
          <div class="tool-actions">
            <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
            <button type="button" class="btn btn-ghost" id="btn-undo">Undo</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="bl-controls">
            <input type="text" id="expr-in" placeholder="e.g. ~(A·B)+C" style="flex:1;min-width:12rem;font-family:var(--mono);padding:0.4rem 0.55rem;border:1px solid var(--line);border-radius:8px">
            <button type="button" class="btn btn-secondary" id="btn-set">Set expression</button>
          </div>
          <div class="expr-stage" id="expr-stage">…</div>
          <p class="bl-meta" id="meta"></p>
          <h3 style="font-size:0.9rem;margin:0.85rem 0 0.4rem">Apply a rewrite</h3>
          <div class="rewrite-list" id="rewrites"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>History &amp; laws</h2></div>
        <div class="panel-body">
          <ul class="step-list" id="history"></ul>
          <div class="law-ref" id="law-ref"></div>
        </div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderPlayground() {
    document.getElementById("starter-note").textContent =
      "Starter example: ~(A·B) — apply De Morgan to get A'+B'.";
    document.getElementById("expr-stage").textContent = stringify(state.expr);
    document.getElementById("expr-in").value = stringify(state.expr);
    const rewrites = findRewrites(state.expr);
    document.getElementById("meta").textContent = rewrites.length
      ? `${rewrites.length} applicable rewrite(s)`
      : "No further automatic rewrites — expression may be simplest under these laws";
    const box = document.getElementById("rewrites");
    box.innerHTML = "";
    if (!rewrites.length) {
      box.innerHTML = `<p class="bl-meta">Try a different expression, or Undo.</p>`;
    } else {
      rewrites.forEach((r) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rewrite-btn";
        b.innerHTML = `<span class="law">${r.label}</span>→ ${r.shown}`;
        b.addEventListener("click", () => {
          state.expr = r.next;
          state.history.push({ expr: clone(r.next), note: r.label });
          saveSession();
          renderAll();
        });
        box.appendChild(b);
      });
    }
    document.getElementById("history").innerHTML = state.history
      .map((h, i) => `<li><strong>${i}.</strong> ${stringify(h.expr)} <span style="opacity:.75">— ${h.note}</span></li>`)
      .join("");
    document.getElementById("law-ref").innerHTML = LAW_REF.map((l) => `<div class="law-chip"><strong>${l.id}</strong> · ${l.text}</div>`).join("");
  }

  function renderChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (state.showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = state.showHint ? "Hide hint" : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    if (ch.type === "quiz" || ch.type === "pick") {
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="bl-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === state.challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        state.challengeIdx = i;
        state.showHint = false;
        state.quizChoice = "";
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function loadChallengeExpr() {
    const ch = CHALLENGES[state.challengeIdx];
    const start = ch.start || (ch.type === "quiz" ? "~(A·B)" : null);
    if (!start && ch.type === "reach") return;
    if (ch.start) {
      state.expr = parse(ch.start);
      state.history = [{ expr: clone(state.expr), note: "Challenge start" }];
      saveSession();
      renderAll();
      setChalStatus("idle", "Loaded — rewrite toward the goal, then Check");
    } else setChalStatus("idle", "Quiz — pick an answer above");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz" || ch.type === "pick") {
      ok = state.quizChoice === ch.answer;
      if (ch.type === "pick" && !ok) {
        try {
          ok = equiv(parse(state.quizChoice), parse(ch.answer));
        } catch {
          ok = false;
        }
      }
    } else if (ch.type === "reach") {
      try {
        ok = equiv(state.expr, parse(ch.target));
      } catch {
        ok = false;
      }
    }
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds = [...clearedIds, ch.id];
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("pass", "Pass");
      renderChallenge();
    } else setChalStatus("fail", "Not yet");
  }

  function renderAll() {
    renderPlayground();
    renderChallenge();
  }

  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-undo").addEventListener("click", () => {
    if (state.history.length <= 1) return;
    state.history.pop();
    state.expr = clone(state.history[state.history.length - 1].expr);
    saveSession();
    renderAll();
  });
  document.getElementById("btn-set").addEventListener("click", () => {
    try {
      state.expr = parse(document.getElementById("expr-in").value);
      state.history = [{ expr: clone(state.expr), note: "Set" }];
      saveSession();
      renderAll();
    } catch (e) {
      setChalStatus("fail", e.message || "Parse error");
    }
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.quizChoice = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeExpr);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
