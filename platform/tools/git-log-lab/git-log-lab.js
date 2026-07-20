(() => {
  /**
   * Fixed chip-repo history (newest first in walk order from HEAD main).
   * graph glyphs are precomputed for --graph when walking main+feature merge.
   */
  const COMMITS = [
    {
      id: "a8f3c21",
      parents: ["b2e91d0", "c4d10aa"],
      msg: "Merge branch 'feature/alu-mul'",
      author: "Ada",
      date: "2026-07-18",
      refs: ["HEAD", "main"],
      files: ["rtl/top.v", "rtl/alu.v"],
      graph: "*   ",
    },
    {
      id: "c4d10aa",
      parents: ["d71bb02"],
      msg: "alu: add mul path",
      author: "Bea",
      date: "2026-07-17",
      refs: ["feature/alu-mul"],
      files: ["rtl/alu.v", "tb/tb_alu.v"],
      graph: "|\\  ",
      graphAlt: "* ",
    },
    {
      id: "b2e91d0",
      parents: ["d71bb02"],
      msg: "docs: clarify reset polarity",
      author: "Ada",
      date: "2026-07-16",
      refs: [],
      files: ["docs/spec.md"],
      graph: "| * ",
    },
    {
      id: "d71bb02",
      parents: ["e0a11c3"],
      msg: "tb: cover alu add/sub",
      author: "Bea",
      date: "2026-07-15",
      refs: [],
      files: ["tb/tb_alu.v"],
      graph: "|/  ",
    },
    {
      id: "e0a11c3",
      parents: ["f99aa01"],
      msg: "rtl: wire alu into top",
      author: "Ada",
      date: "2026-07-14",
      refs: ["tag: v0.1"],
      files: ["rtl/top.v", "rtl/alu.v"],
      graph: "*   ",
    },
    {
      id: "f99aa01",
      parents: [],
      msg: "init: skeleton Makefile and rtl",
      author: "Ada",
      date: "2026-07-10",
      refs: [],
      files: ["Makefile", "rtl/top.v", "README.md"],
      graph: "*   ",
    },
  ];

  const PATHS = [
    "",
    "rtl/alu.v",
    "rtl/top.v",
    "tb/tb_alu.v",
    "docs/spec.md",
    "Makefile",
  ];

  function defaultOpts() {
    return {
      oneline: false,
      graph: false,
      decorate: true,
      all: false,
      stat: false,
      maxCount: 0, // 0 = unlimited
      path: "",
      author: "",
      grep: "",
      lastCmd: "",
      lastCount: 0,
    };
  }

  const CLEARED_KEY = "ddv-git-log-lab-cleared-v1";
  const STORE_KEY = "ddv-git-log-lab-session-v1";

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
  /** @type {ReturnType<typeof defaultOpts>} */
  let opts = defaultOpts();

  const root = document.getElementById("gl-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Default <code>git log --decorate</code> on
        <code>main</code> after merging <code>feature/alu-mul</code>. Try
        <code>--oneline --graph</code> and path <code>rtl/alu.v</code>.</p>
      <button type="button" class="btn btn-secondary" id="gl-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Options</h2></div>
        <div class="panel-body">
          <p class="dag-note">History: init → wire alu → tb → docs∥mul branch → merge on main.</p>
          <div class="preset-row" id="preset-row"></div>
          <div class="opt-grid">
            <label><input type="checkbox" id="opt-oneline" /> <span><code>--oneline</code><span class="hint">short hash + subject</span></span></label>
            <label><input type="checkbox" id="opt-graph" /> <span><code>--graph</code><span class="hint">ASCII commit graph</span></span></label>
            <label><input type="checkbox" id="opt-decorate" /> <span><code>--decorate</code><span class="hint">show refs / tags</span></span></label>
            <label><input type="checkbox" id="opt-all" /> <span><code>--all</code><span class="hint">all refs (lab: same walk)</span></span></label>
            <label><input type="checkbox" id="opt-stat" /> <span><code>--stat</code><span class="hint">paths touched</span></span></label>
          </div>
          <div class="field-row">
            <label for="opt-n">Max commits (<code>-n</code> / <code>--max-count</code>)</label>
            <input type="number" id="opt-n" min="0" max="20" value="0" />
          </div>
          <div class="field-row">
            <label for="opt-path">Path filter (after <code>--</code>)</label>
            <select id="opt-path"></select>
          </div>
          <div class="field-row">
            <label for="opt-author">Author contains (<code>--author</code>)</label>
            <input type="text" id="opt-author" placeholder="Ada or Bea" />
          </div>
          <div class="field-row">
            <label for="opt-grep">Message contains (<code>--grep</code>)</label>
            <input type="text" id="opt-grep" placeholder="alu" />
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Output</h2></div>
        <div class="panel-body">
          <pre class="cmdline" id="cmdline"></pre>
          <p class="stats-row" id="stats-row"></p>
          <pre class="log-out" id="log-out"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Flag</th><th>Use when</th></tr></thead>
          <tbody>
            <tr><td><code>--oneline</code></td><td>Scan history quickly</td></tr>
            <tr><td><code>--graph</code></td><td>See merges / branch topology</td></tr>
            <tr><td><code>--decorate</code></td><td>Spot HEAD, branches, tags</td></tr>
            <tr><td><code>-- path</code></td><td>Only commits that touched a file</td></tr>
            <tr><td><code>-n N</code></td><td>Limit how far back you look</td></tr>
            <tr><td><code>--author</code> / <code>--grep</code></td><td>Filter by person or subject text</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Put path filters after <code>--</code> so Git does not treat them as revisions.</li>
          <li><code>--oneline --graph --decorate</code> is a common everyday combo.</li>
          <li>Path filters hide commits that never touched that path (merges may still appear if they did).</li>
        </ul>
      </div>
    </div>
  `;

  const pathSel = document.getElementById("opt-path");
  PATHS.forEach((p) => {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p || "(none)";
    pathSel.appendChild(o);
  });

  const presetRow = document.getElementById("preset-row");
  const PRESETS = [
    { label: "default", apply: () => Object.assign(opts, defaultOpts()) },
    {
      label: "oneline+graph",
      apply: () => {
        Object.assign(opts, defaultOpts(), { oneline: true, graph: true, decorate: true });
      },
    },
    {
      label: "alu.v only",
      apply: () => {
        Object.assign(opts, defaultOpts(), { oneline: true, path: "rtl/alu.v" });
      },
    },
    {
      label: "author Ada -n3",
      apply: () => {
        Object.assign(opts, defaultOpts(), { oneline: true, author: "Ada", maxCount: 3 });
      },
    },
    {
      label: "grep alu + stat",
      apply: () => {
        Object.assign(opts, defaultOpts(), { grep: "alu", stat: true });
      },
    },
  ];
  PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label;
    b.addEventListener("click", () => {
      p.apply();
      syncForm();
      renderAll();
    });
    presetRow.appendChild(b);
  });

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildCmd() {
    const parts = ["git", "log"];
    if (opts.oneline) parts.push("--oneline");
    if (opts.graph) parts.push("--graph");
    if (opts.decorate) parts.push("--decorate");
    if (opts.all) parts.push("--all");
    if (opts.stat) parts.push("--stat");
    if (opts.maxCount > 0) parts.push(`-n ${opts.maxCount}`);
    if (opts.author.trim()) parts.push(`--author=${JSON.stringify(opts.author.trim())}`);
    if (opts.grep.trim()) parts.push(`--grep=${JSON.stringify(opts.grep.trim())}`);
    if (opts.path) {
      parts.push("--");
      parts.push(opts.path);
    }
    return parts.join(" ");
  }

  function filterCommits() {
    let list = COMMITS.slice();
    if (opts.path) {
      list = list.filter((c) => c.files.includes(opts.path));
    }
    if (opts.author.trim()) {
      const a = opts.author.trim().toLowerCase();
      list = list.filter((c) => c.author.toLowerCase().includes(a));
    }
    if (opts.grep.trim()) {
      const g = opts.grep.trim().toLowerCase();
      list = list.filter((c) => c.msg.toLowerCase().includes(g));
    }
    // --all in this lab does not add extra commits (feature tip already in walk via merge)
    if (opts.maxCount > 0) list = list.slice(0, opts.maxCount);
    return list;
  }

  function decorateStr(c) {
    if (!opts.decorate || !c.refs.length) return "";
    return ` (${c.refs.join(", ")})`;
  }

  function formatCommit(c) {
    const deco = decorateStr(c);
    const g = opts.graph ? escapeHtml(c.graph) : "";
    if (opts.oneline) {
      return `${opts.graph ? `<span class="graph">${g}</span>` : ""}<span class="hash">${c.id}</span>${
        deco ? `<span class="deco">${escapeHtml(deco)}</span>` : ""
      } ${escapeHtml(c.msg)}`;
    }
    const lines = [];
    const prefix = opts.graph ? `<span class="graph">${g}</span>` : "";
    lines.push(
      `${prefix}<span class="hash">commit ${c.id}</span>${
        deco ? `<span class="deco">${escapeHtml(deco)}</span>` : ""
      }`
    );
    if (c.parents.length > 1) {
      lines.push(
        `${opts.graph ? `<span class="graph">${escapeHtml("| ")}   </span>` : ""}Merge: ${c.parents.map((p) => p.slice(0, 7)).join(" ")}`
      );
    }
    lines.push(
      `${opts.graph ? `<span class="graph">${escapeHtml("|")}   </span>` : ""}<span class="meta">Author: ${escapeHtml(c.author)}</span>`
    );
    lines.push(
      `${opts.graph ? `<span class="graph">${escapeHtml("|")}   </span>` : ""}<span class="meta">Date:   ${escapeHtml(c.date)}</span>`
    );
    lines.push("");
    lines.push(
      `${opts.graph ? `<span class="graph">${escapeHtml("|")}   </span>` : ""}    ${escapeHtml(c.msg)}`
    );
    if (opts.stat) {
      lines.push("");
      c.files.forEach((f) => {
        lines.push(
          `${opts.graph ? `<span class="graph">${escapeHtml("|")}   </span>` : ""}<span class="stat"> ${escapeHtml(f)} | 1 +</span>`
        );
      });
      lines.push(
        `${opts.graph ? `<span class="graph">${escapeHtml("|")}   </span>` : ""}<span class="stat"> ${c.files.length} file${c.files.length === 1 ? "" : "s"} changed</span>`
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  function renderAll() {
    const list = filterCommits();
    opts.lastCmd = buildCmd();
    opts.lastCount = list.length;
    document.getElementById("cmdline").innerHTML = escapeHtml(opts.lastCmd).replace(
      /(--\S+|-n \d+)/g,
      '<span class="flag">$1</span>'
    );
    document.getElementById("stats-row").innerHTML =
      `<strong>${list.length}</strong> commit${list.length === 1 ? "" : "s"} shown` +
      (opts.path ? ` · path <code>${escapeHtml(opts.path)}</code>` : "");
    const out = document.getElementById("log-out");
    if (!list.length) {
      out.innerHTML = '<span class="empty">(no commits match filters)</span>';
    } else {
      out.innerHTML = list.map(formatCommit).join(opts.oneline ? "\n" : "");
    }
    saveSession();
  }

  function syncForm() {
    document.getElementById("opt-oneline").checked = !!opts.oneline;
    document.getElementById("opt-graph").checked = !!opts.graph;
    document.getElementById("opt-decorate").checked = !!opts.decorate;
    document.getElementById("opt-all").checked = !!opts.all;
    document.getElementById("opt-stat").checked = !!opts.stat;
    document.getElementById("opt-n").value = String(opts.maxCount || 0);
    document.getElementById("opt-path").value = opts.path || "";
    document.getElementById("opt-author").value = opts.author || "";
    document.getElementById("opt-grep").value = opts.grep || "";
  }

  function readForm() {
    opts.oneline = document.getElementById("opt-oneline").checked;
    opts.graph = document.getElementById("opt-graph").checked;
    opts.decorate = document.getElementById("opt-decorate").checked;
    opts.all = document.getElementById("opt-all").checked;
    opts.stat = document.getElementById("opt-stat").checked;
    opts.maxCount = Math.max(0, Number(document.getElementById("opt-n").value) || 0);
    opts.path = document.getElementById("opt-path").value || "";
    opts.author = document.getElementById("opt-author").value || "";
    opts.grep = document.getElementById("opt-grep").value || "";
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ opts, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.opts) return false;
      opts = { ...defaultOpts(), ...data.opts };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function loadStarter() {
    opts = defaultOpts();
    syncForm();
    renderAll();
  }

  [
    "opt-oneline",
    "opt-graph",
    "opt-decorate",
    "opt-all",
    "opt-stat",
    "opt-n",
    "opt-path",
    "opt-author",
    "opt-grep",
  ].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      readForm();
      renderAll();
    });
    document.getElementById(id).addEventListener("change", () => {
      readForm();
      renderAll();
    });
  });

  document.getElementById("gl-starter").addEventListener("click", loadStarter);

  function shownIds() {
    return filterCommits().map((c) => c.id);
  }

  function cmdHas(flag) {
    return opts.lastCmd.includes(flag);
  }

  const CHALLENGES = [
    {
      id: "quiz-oneline",
      title: "Quiz: oneline",
      prompt: "Flag for short hash + subject per line? Answer: <code>--oneline</code>",
      hint: "one line per commit",
      type: "text",
      answer: "--oneline",
      alt: ["oneline", "git log --oneline"],
    },
    {
      id: "quiz-graph",
      title: "Quiz: graph",
      prompt: "Flag that draws merge topology? Answer: <code>--graph</code>",
      hint: "ASCII art left column",
      type: "text",
      answer: "--graph",
      alt: ["graph", "git log --graph"],
    },
    {
      id: "quiz-decorate",
      title: "Quiz: decorate",
      prompt: "Flag that shows branch/tag names beside commits? Answer: <code>--decorate</code>",
      hint: "(HEAD -> main)",
      type: "text",
      answer: "--decorate",
      alt: ["decorate", "--decorate=short"],
    },
    {
      id: "do-oneline",
      title: "Enable oneline",
      prompt: "Turn on <code>--oneline</code> so the command line includes it.",
      hint: "checkbox --oneline",
      type: "state",
      check: () => opts.oneline && cmdHas("--oneline"),
    },
    {
      id: "do-graph-oneline",
      title: "Oneline+graph",
      prompt: "Enable both <code>--oneline</code> and <code>--graph</code> (preset works).",
      hint: "preset oneline+graph",
      type: "state",
      check: () => opts.oneline && opts.graph,
    },
    {
      id: "starter-count",
      title: "Starter count",
      prompt: "Load starter (no filters). How many commits? (number)",
      hint: "full main history in this lab",
      type: "text",
      answer: "6",
      setup: () => loadStarter(),
    },
    {
      id: "path-alu",
      title: "Path alu.v",
      prompt: "Set path filter to <code>rtl/alu.v</code> — command should include <code>-- rtl/alu.v</code>.",
      hint: "path dropdown",
      type: "state",
      check: () => opts.path === "rtl/alu.v" && /--\s+rtl\/alu\.v/.test(opts.lastCmd),
    },
    {
      id: "path-alu-count",
      title: "alu.v count",
      prompt: "With only path <code>rtl/alu.v</code> (clear other filters), how many commits? (number)",
      hint: "init? no — alu touched in wire, mul, merge",
      type: "text",
      answer: "3",
      setup: () => {
        opts = defaultOpts();
        opts.path = "rtl/alu.v";
        syncForm();
        renderAll();
      },
    },
    {
      id: "quiz-path-dash",
      title: "Quiz: --",
      prompt: "Path filters go after which token? Answer: <code>--</code>",
      hint: "separates revisions from paths",
      type: "text",
      answer: "--",
      alt: ["double dash", "dash dash"],
    },
    {
      id: "author-ada",
      title: "Author Ada",
      prompt: "Set author filter to <code>Ada</code> (oneline optional).",
      hint: "Author contains field",
      type: "state",
      check: () => /ada/i.test(opts.author) && shownIds().every((id) => {
        const c = COMMITS.find((x) => x.id === id);
        return c && c.author === "Ada";
      }) && shownIds().length > 0,
    },
    {
      id: "author-count",
      title: "Ada count",
      prompt: "Author=Ada, no other filters. How many commits? (number)",
      hint: "Ada authored most except Bea’s two",
      type: "text",
      answer: "4",
      setup: () => {
        opts = defaultOpts();
        opts.author = "Ada";
        syncForm();
        renderAll();
      },
    },
    {
      id: "grep-alu",
      title: "Grep alu",
      prompt: "Set message grep to <code>alu</code> — output should only include alu-related subjects.",
      hint: "--grep field",
      type: "state",
      check: () =>
        /alu/i.test(opts.grep) &&
        shownIds().length > 0 &&
        shownIds().every((id) => {
          const c = COMMITS.find((x) => x.id === id);
          return c && /alu/i.test(c.msg);
        }),
    },
    {
      id: "max-n2",
      title: "Limit -n 2",
      prompt: "Set max commits to <code>2</code> on starter filters — exactly 2 shown.",
      hint: "Max commits field",
      type: "state",
      setup: () => {
        opts = defaultOpts();
        syncForm();
        renderAll();
      },
      check: () => opts.maxCount === 2 && opts.lastCount === 2,
    },
    {
      id: "quiz-n",
      title: "Quiz: -n",
      prompt: "<code>-n 5</code> is the same idea as? Answer: <code>--max-count=5</code>",
      hint: "limit",
      type: "text",
      answer: "--max-count=5",
      alt: ["--max-count 5", "max-count", "--max-count"],
    },
    {
      id: "decorate-head",
      title: "See HEAD",
      prompt: "With decorate on and no filters, first shown commit refs should include HEAD.",
      hint: "decorate checked (starter)",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const list = filterCommits();
        return opts.decorate && list[0] && list[0].refs.includes("HEAD");
      },
    },
    {
      id: "stat-on",
      title: "Enable stat",
      prompt: "Turn on <code>--stat</code> so file paths appear under commits.",
      hint: "checkbox --stat",
      type: "state",
      check: () => opts.stat && cmdHas("--stat"),
    },
    {
      id: "docs-only",
      title: "docs path",
      prompt: "Path <code>docs/spec.md</code> — only the docs commit remains.",
      hint: "one commit",
      type: "state",
      check: () =>
        opts.path === "docs/spec.md" &&
        shownIds().length === 1 &&
        shownIds()[0] === "b2e91d0",
    },
    {
      id: "quiz-combo",
      title: "Quiz: combo",
      prompt: "Common scan combo? Answer: <code>--oneline --graph --decorate</code>",
      hint: "three flags",
      type: "text",
      answer: "--oneline --graph --decorate",
      alt: ["oneline graph decorate", "--graph --oneline --decorate"],
    },
    {
      id: "bea-tb",
      title: "Bea + tb",
      prompt: "Author Bea and path <code>tb/tb_alu.v</code> — how many commits? (number)",
      hint: "mul + cover commits",
      type: "text",
      answer: "2",
      setup: () => {
        opts = defaultOpts();
        opts.author = "Bea";
        opts.path = "tb/tb_alu.v";
        syncForm();
        renderAll();
      },
    },
    {
      id: "empty-filter",
      title: "Empty result",
      prompt: "Grep <code>xyzzy</code> — zero commits shown.",
      hint: "impossible message",
      type: "state",
      check: () => /xyzzy/i.test(opts.grep) && opts.lastCount === 0,
    },
    {
      id: "tag-visible",
      title: "Tag decorate",
      prompt: "Find the commit with <code>tag: v0.1</code> in decorate output (starter decorate on).",
      hint: "wire alu commit",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const c = filterCommits().find((x) => x.refs.includes("tag: v0.1"));
        return opts.decorate && !!c && c.id === "e0a11c3";
      },
    },
    {
      id: "merge-first",
      title: "Merge tip",
      prompt: "Starter log: first commit message starts with Merge? Answer: <code>yes</code>",
      hint: "HEAD is merge commit",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
      setup: () => loadStarter(),
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent =
      `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint
      ? "Hide hint"
      : "Show hint";
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:14rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Toggle options, then Check.</span>`;
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
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
        saveSession();
      });
      cat.appendChild(b);
    });
    saveSession();
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
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    renderChallenge();
  });

  // Verify alu path count for challenge accuracy
  // alu files: a8f3c21 (merge), c4d10aa (mul), e0a11c3 (wire) = 3 ✓
  // Ada: a8f3c21, b2e91d0, e0a11c3, f99aa01 = 4 ✓
  // Bea + tb: c4d10aa, d71bb02 = 2 ✓

  if (!loadSession()) loadStarter();
  else {
    syncForm();
    renderAll();
  }
  renderChallenge();
})();
