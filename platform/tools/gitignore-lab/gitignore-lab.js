(() => {
  const FILES = [
    "Makefile",
    "README.md",
    ".gitignore",
    "rtl/top.v",
    "rtl/alu.v",
    "tb/tb_top.v",
    "docs/spec.md",
    "build/out.vvp",
    "build/wave.vcd",
    "out/synth.json",
    "obj/main.o",
    "logs/sim.log",
    "run.log",
    "wave.vcd",
    "debug.swp",
    ".DS_Store",
    "notes~",
    "scripts/run_sim.sh",
    "src/util.c",
    "src/util.o",
  ];

  const STARTER_GI = `# Chip project ignore rules
build/
out/
obj/

# Logs and waveforms
*.log
*.vcd

# Object / editor junk
*.o
*.a
.DS_Store
*.swp
*~
`;

  const CLEARED_KEY = "ddv-gitignore-lab-cleared-v1";
  const STORE_KEY = "ddv-gitignore-lab-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let answerDraft = "";
  let giText = STARTER_GI;
  let filter = "all"; // all | ignored | tracked
  let lastApplied = STARTER_GI;

  const root = document.getElementById("gi-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Ignore <code>build/</code>, <code>*.log</code>, <code>*.vcd</code>,
        and object/editor junk — source under <code>rtl/</code> and <code>tb/</code> stays tracked.</p>
      <button type="button" class="btn btn-secondary" id="gi-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>.gitignore</h2></div>
        <div class="panel-body">
          <div class="preset-row" id="preset-row"></div>
          <textarea class="gi-editor" id="gi-editor" spellcheck="false"></textarea>
          <div class="tool-actions" style="margin-top:0.55rem">
            <button type="button" class="btn btn-primary" id="btn-apply">Apply rules</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Path status</h2></div>
        <div class="panel-body">
          <p class="stats" id="stats"></p>
          <div class="filter-row">
            <label><input type="radio" name="filt" value="all" checked /> all</label>
            <label><input type="radio" name="filt" value="ignored" /> ignored</label>
            <label><input type="radio" name="filt" value="tracked" /> tracked-ok</label>
          </div>
          <table class="status-table" id="status-table"></table>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Pattern cheats</h2></div>
      <div class="panel-body">
        <div class="rule-cards">
          <div class="rule-card">
            <h3>build/</h3>
            <p>Ignore a directory (and everything under it).</p>
          </div>
          <div class="rule-card">
            <h3>*.vcd</h3>
            <p>Ignore by extension anywhere in the tree.</p>
          </div>
          <div class="rule-card">
            <h3>!important.log</h3>
            <p>Negation — re-include after a broader ignore (lab supports simple <code>!</code>).</p>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Pattern</th><th>Matches</th></tr></thead>
          <tbody>
            <tr><td><code>*.log</code></td><td>Any <code>.log</code> file</td></tr>
            <tr><td><code>build/</code></td><td>Directory <code>build</code> and its contents</td></tr>
            <tr><td><code>/wave.vcd</code></td><td>Only at repo root (lab: leading <code>/</code>)</td></tr>
            <tr><td><code>**</code> / <code>*</code></td><td>Wildcards (lab: <code>*</code> within a segment)</td></tr>
            <tr><td><code>!file</code></td><td>Exception (un-ignore)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Ignore generated sim/build outputs; never ignore the RTL you still need to commit.</li>
          <li>Already-tracked files stay tracked until removed from the index — this lab only models path matching.</li>
        </ul>
      </div>
    </div>
  `;

  const editor = document.getElementById("gi-editor");
  const table = document.getElementById("status-table");
  const stats = document.getElementById("stats");
  const presetRow = document.getElementById("preset-row");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function parseRules(text) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const neg = l.startsWith("!");
        const pat = neg ? l.slice(1) : l;
        return { neg, pat };
      });
  }

  function globToRegExp(pat) {
    // Support *, ?, trailing /, leading /
    let p = pat;
    let onlyRoot = false;
    if (p.startsWith("/")) {
      onlyRoot = true;
      p = p.slice(1);
    }
    const dirOnly = p.endsWith("/");
    if (dirOnly) p = p.slice(0, -1);

    let re = "";
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === "*") re += "[^/]*";
      else if (c === "?") re += "[^/]";
      else if (".+^$()[]{}|\\".includes(c)) re += "\\" + c;
      else re += c;
    }

    if (dirOnly) {
      // match dir or anything under it
      const body = onlyRoot ? `^${re}(\\/.*)?$` : `(^|/)${re}(\\/.*)?$`;
      return { re: new RegExp(body), dirOnly: true };
    }
    if (onlyRoot) {
      return { re: new RegExp(`^${re}$`), dirOnly: false };
    }
    // match basename or full path ending
    return { re: new RegExp(`(^|/)${re}$`), dirOnly: false };
  }

  function isIgnored(path, rules) {
    let ignored = false;
    let matchedBy = "";
    for (const rule of rules) {
      const { re } = globToRegExp(rule.pat);
      if (re.test(path)) {
        if (rule.neg) {
          ignored = false;
          matchedBy = "!" + rule.pat;
        } else {
          ignored = true;
          matchedBy = rule.pat;
        }
      }
      // also: if rule is dir/ and path is under it
      if (rule.pat.endsWith("/")) {
        const dir = rule.pat.replace(/^\//, "").slice(0, -1);
        const rootOnly = rule.pat.startsWith("/");
        const under = rootOnly
          ? path === dir || path.startsWith(dir + "/")
          : path === dir || path.startsWith(dir + "/") || path.includes("/" + dir + "/");
        // simpler under check
        const under2 =
          path === dir ||
          path.startsWith(dir + "/") ||
          path.includes("/" + dir + "/");
        if (under2 && (!rootOnly || path.startsWith(dir))) {
          if (rule.neg) {
            ignored = false;
            matchedBy = "!" + rule.pat;
          } else {
            ignored = true;
            matchedBy = rule.pat;
          }
        }
      }
    }
    return { ignored, matchedBy };
  }

  function evaluate() {
    const rules = parseRules(giText);
    return FILES.map((path) => {
      const { ignored, matchedBy } = isIgnored(path, rules);
      return { path, ignored, matchedBy };
    });
  }

  function renderTable() {
    const rows = evaluate().filter((r) => {
      if (filter === "ignored") return r.ignored;
      if (filter === "tracked") return !r.ignored;
      return true;
    });
    const all = evaluate();
    const ign = all.filter((r) => r.ignored).length;
    stats.innerHTML = `<strong>${ign}</strong> ignored · <strong>${all.length - ign}</strong> tracked-ok · ${all.length} paths`;

    table.innerHTML = `<thead><tr><th>path</th><th>status</th><th>rule</th></tr></thead><tbody>${rows
      .map((r) => {
        const st = r.ignored ? "ignored" : "tracked";
        const label = r.ignored ? "ignored" : "tracked-ok";
        return `<tr class="${r.ignored ? "is-ignored" : ""}">
          <td>${escapeHtml(r.path)}</td>
          <td class="${st}">${label}</td>
          <td>${escapeHtml(r.matchedBy || "—")}</td>
        </tr>`;
      })
      .join("")}</tbody>`;
  }

  function applyRules() {
    giText = editor.value;
    lastApplied = giText;
    renderTable();
    saveSession();
  }

  function loadStarter() {
    giText = STARTER_GI;
    editor.value = giText;
    lastApplied = giText;
    filter = "all";
    document.querySelector('input[name="filt"][value="all"]').checked = true;
    renderTable();
    saveSession();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ giText: editor.value, filter, lastApplied })
      );
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      giText = data.giText || STARTER_GI;
      editor.value = giText;
      lastApplied = data.lastApplied || giText;
      filter = data.filter || "all";
      const radio = document.querySelector(`input[name="filt"][value="${filter}"]`);
      if (radio) radio.checked = true;
      return true;
    } catch {
      return false;
    }
  }

  const PRESETS = [
    { label: "Starter HDL", text: STARTER_GI },
    {
      label: "Only *.vcd",
      text: "*.vcd\n",
    },
    {
      label: "build/ only",
      text: "build/\n",
    },
    {
      label: "Empty",
      text: "# nothing ignored\n",
    },
    {
      label: "Negation demo",
      text: "*.log\n!important.log\n",
    },
    {
      label: "Root-only wave",
      text: "/wave.vcd\n",
    },
  ];
  PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label;
    b.addEventListener("click", () => {
      editor.value = p.text;
      applyRules();
    });
    presetRow.appendChild(b);
  });

  document.querySelectorAll('input[name="filt"]').forEach((el) => {
    el.addEventListener("change", () => {
      filter = el.value;
      renderTable();
      saveSession();
    });
  });

  function ignoredSet() {
    return new Set(evaluate().filter((r) => r.ignored).map((r) => r.path));
  }

  function trackedSet() {
    return new Set(evaluate().filter((r) => !r.ignored).map((r) => r.path));
  }

  const CHALLENGES = [
    {
      id: "quiz-star",
      title: "Quiz: *.log",
      prompt: "<code>*.log</code> ignores files by? Answer: <code>extension</code>",
      hint: "file extension / suffix",
      type: "text",
      answer: "extension",
      alt: ["suffix", "ext", "ending"],
    },
    {
      id: "quiz-dir",
      title: "Quiz: build/",
      prompt: "Trailing <code>/</code> on <code>build/</code> means a? Answer: <code>directory</code>",
      hint: "directory",
      type: "text",
      answer: "directory",
      alt: ["dir", "folder"],
    },
    {
      id: "starter-build",
      title: "Ignore build",
      prompt: "With starter rules, is <code>build/out.vvp</code> ignored? Answer: <code>yes</code>",
      hint: "Load starter / Apply",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
      setup: () => loadStarter(),
    },
    {
      id: "starter-rtl",
      title: "Keep rtl",
      prompt: "Starter: is <code>rtl/top.v</code> ignored? Answer: <code>no</code>",
      hint: "Source stays tracked",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
      setup: () => loadStarter(),
    },
    {
      id: "apply-starter",
      title: "Apply starter",
      prompt: "Load/Apply starter so at least 8 paths are ignored.",
      hint: "Load starter example",
      type: "state",
      check: () => ignoredSet().size >= 8,
    },
    {
      id: "vcd-count",
      title: "Count vcd",
      prompt: "Starter: how many <code>*.vcd</code> paths are ignored? (number)",
      hint: "build/wave.vcd and wave.vcd → 2",
      type: "text",
      answer: "2",
      setup: () => loadStarter(),
    },
    {
      id: "only-vcd",
      title: "Only *.vcd",
      prompt: "Use preset “Only *.vcd” — <code>run.log</code> should be tracked-ok.",
      hint: "Only *.vcd preset",
      type: "state",
      check: () =>
        trackedSet().has("run.log") &&
        ignoredSet().has("wave.vcd") &&
        ignoredSet().has("build/wave.vcd"),
    },
    {
      id: "build-only",
      title: "build/ only",
      prompt: "Preset “build/ only” — <code>obj/main.o</code> tracked, <code>build/out.vvp</code> ignored.",
      hint: "build/ only preset",
      type: "state",
      check: () => ignoredSet().has("build/out.vvp") && trackedSet().has("obj/main.o"),
    },
    {
      id: "empty-none",
      title: "Empty rules",
      prompt: "Preset Empty — ignored count should be 0.",
      hint: "Empty preset",
      type: "state",
      check: () => ignoredSet().size === 0,
    },
    {
      id: "negation",
      title: "Negation",
      prompt: "Negation demo: <code>*.log</code> then <code>!important.log</code>. Add file check — write rules so <code>run.log</code> ignored.",
      hint: "Negation demo preset (run.log still ignored; important.log would be excepted if present)",
      type: "state",
      check: () => {
        const text = editor.value;
        return /\*\.log/.test(text) && /!important\.log/.test(text) && ignoredSet().has("run.log");
      },
    },
    {
      id: "quiz-bang",
      title: "Quiz: !",
      prompt: "A leading <code>!</code> means? Answer: <code>exception</code> or <code>negate</code>",
      hint: "un-ignore / exception",
      type: "text",
      answer: "exception",
      alt: ["negate", "negation", "un-ignore", "unignore", "re-include"],
    },
    {
      id: "root-wave",
      title: "Root-only",
      prompt: "Preset “Root-only wave” — root <code>wave.vcd</code> ignored, <code>build/wave.vcd</code> tracked.",
      hint: "/wave.vcd anchors at root",
      type: "state",
      check: () => ignoredSet().has("wave.vcd") && trackedSet().has("build/wave.vcd"),
    },
    {
      id: "quiz-slash",
      title: "Quiz: leading /",
      prompt: "Leading <code>/</code> anchors the pattern at the? Answer: <code>root</code>",
      hint: "repo root",
      type: "text",
      answer: "root",
      alt: ["repo root", "repository root"],
    },
    {
      id: "obj-o",
      title: "Object files",
      prompt: "Starter ignores <code>src/util.o</code>? Answer: <code>yes</code>",
      hint: "*.o",
      type: "text",
      answer: "yes",
      alt: ["y"],
      setup: () => loadStarter(),
    },
    {
      id: "makefile-ok",
      title: "Makefile ok",
      prompt: "Starter: <code>Makefile</code> tracked? Answer: <code>yes</code>",
      hint: "not matched by ignore rules",
      type: "text",
      answer: "yes",
      alt: ["y"],
      setup: () => loadStarter(),
    },
    {
      id: "write-logs",
      title: "Write logs/",
      prompt: "Clear to empty, then add only <code>logs/</code> and Apply — <code>logs/sim.log</code> ignored, <code>run.log</code> not.",
      hint: "Pattern logs/",
      type: "state",
      check: () =>
        ignoredSet().has("logs/sim.log") &&
        trackedSet().has("run.log") &&
        /logs\//.test(editor.value),
    },
    {
      id: "filter-ignored",
      title: "Filter ignored",
      prompt: "Select the “ignored” filter radio (with starter applied).",
      hint: "Filter row",
      type: "state",
      check: () => filter === "ignored" && ignoredSet().size > 0,
    },
    {
      id: "quiz-purpose",
      title: "Quiz: purpose",
      prompt: ".gitignore keeps out of Git? Answer: <code>artifacts</code> or <code>generated</code>",
      hint: "build artifacts / generated files",
      type: "text",
      answer: "artifacts",
      alt: ["generated", "build artifacts", "junk", "generated files"],
    },
    {
      id: "swp-ignore",
      title: "Ignore swp",
      prompt: "Starter ignores <code>debug.swp</code>? Answer: <code>yes</code>",
      hint: "*.swp",
      type: "text",
      answer: "yes",
      setup: () => loadStarter(),
    },
    {
      id: "custom-out",
      title: "Ignore out/",
      prompt: "Ensure <code>out/synth.json</code> is ignored (starter already has <code>out/</code>).",
      hint: "Load starter",
      type: "state",
      check: () => ignoredSet().has("out/synth.json"),
    },
    {
      id: "scripts-ok",
      title: "Keep scripts",
      prompt: "Starter: is <code>scripts/run_sim.sh</code> ignored? Answer: <code>no</code>",
      hint: "scripts are source",
      type: "text",
      answer: "no",
      setup: () => loadStarter(),
    },
    {
      id: "quiz-tracked",
      title: "Quiz: already tracked",
      prompt: "Ignoring a path does not untrack files already in the? Answer: <code>index</code>",
      hint: "Git index / staging",
      type: "text",
      answer: "index",
      alt: ["staging", "cache", "repo"],
    },
  ];

  function normalizeAns(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint ? "Hide hint" : "Show hint";
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:14rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Edit rules / presets, then Check.</span>`;
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        answerDraft = "";
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function checkChallenge() {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      if (typeof ch.setup === "function") ch.setup();
      const ans = normalizeAns(document.getElementById("chal-ans")?.value || "");
      const want = [ch.answer, ...(ch.alt || [])].map(normalizeAns);
      ok = want.includes(ans);
    } else {
      try {
        ok = !!ch.check();
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

  document.getElementById("gi-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-apply").addEventListener("click", applyRules);
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      applyRules();
    }
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else {
    giText = editor.value;
    renderTable();
  }
  renderChallenge();
})();
