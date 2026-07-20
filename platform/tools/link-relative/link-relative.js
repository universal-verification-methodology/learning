(() => {
  /**
   * Flat map path -> { kind: 'dir'|'file'|'symlink', target?: string }
   * Symlink targets stored as written (relative or absolute).
   */

  const STARTER_ROOT = "/home/lab/chip";

  function makeStarter(root) {
    /** @type {Map<string, {kind:string, target?: string}>} */
    const m = new Map();
    const dir = (p) => m.set(p, { kind: "dir" });
    const file = (p) => m.set(p, { kind: "file" });
    const link = (p, target) => m.set(p, { kind: "symlink", target });

    const parts = root.split("/").filter(Boolean);
    let acc = "";
    dir("/");
    for (const part of parts) {
      acc += "/" + part;
      dir(acc);
    }
    dir(`${root}/rtl`);
    dir(`${root}/tb`);
    dir(`${root}/links`);
    file(`${root}/rtl/top.v`);
    file(`${root}/rtl/alu.v`);
    file(`${root}/tb/tb_top.v`);
    file(`${root}/Makefile`);

    // relative: from links/ to rtl/top.v
    link(`${root}/links/to_top_rel`, "../rtl/top.v");
    // absolute to same file
    link(`${root}/links/to_top_abs`, `${root}/rtl/top.v`);
    // relative sibling-style inside rtl
    link(`${root}/rtl/alu_link`, "alu.v");

    return m;
  }

  const CLEARED_KEY = "ddv-link-relative-cleared-v1";
  const STORE_KEY = "ddv-link-relative-session-v1";

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
  let projectRoot = STARTER_ROOT;
  /** @type {Map<string, {kind:string, target?: string}>} */
  let entries = makeStarter(projectRoot);
  let lastScenario = "starter";
  let lastCmd = "";
  /** @type {{kind:string,text:string}[]} */
  let screen = [];

  const root = document.getElementById("lr-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Under <code>${STARTER_ROOT}/links/</code>,
        <code>to_top_rel -> ../rtl/top.v</code> (relative) and
        <code>to_top_abs</code> (absolute). Relocate the whole tree — relative stays good;
        move only the link — relative breaks.</p>
      <button type="button" class="btn btn-secondary" id="lr-starter">Load starter example</button>
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
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Relative vs absolute</h2></div>
      <div class="panel-body">
        <div class="compare-grid">
          <div class="compare-card">
            <h3>Relative target</h3>
            <p>Resolved from the <strong>link’s directory</strong>. Survives moving the whole tree together; breaks if the link moves alone.</p>
          </div>
          <div class="compare-card">
            <h3>Absolute target</h3>
            <p>Hard-coded path. Survives moving the link alone; breaks when the tree’s prefix changes.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Move scenarios</h2></div>
        <div class="panel-body">
          <p class="root-banner">Project root: <code id="root-display"></code></p>
          <div class="scenario-grid" id="scenario-grid"></div>
          <div class="lr-term" style="margin-top:0.75rem">
            <div class="lr-scroll" id="term-scroll"></div>
            <div class="lr-prompt-row">
              <span class="lr-prompt">lab$</span>
              <input class="lr-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="readlink · realpath · ls · help" aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Links status</h2></div>
        <div class="panel-body">
          <table class="link-table" id="link-table"></table>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Tree</h3>
          <pre class="tree-view" id="tree-view"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Situation</th><th>Relative</th><th>Absolute</th></tr></thead>
          <tbody>
            <tr><td>Move whole tree to new prefix</td><td>OK</td><td>Often broken</td></tr>
            <tr><td>Move only the symlink</td><td>Often broken</td><td>OK if target stays</td></tr>
            <tr><td>Move only the target file</td><td>Broken</td><td>Broken</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Relative target <code>../rtl/top.v</code> is joined to the link’s parent dir — not your cwd.</li>
          <li>Prefer relative links inside a repo you will relocate; prefer absolute for fixed system tools.</li>
        </ul>
      </div>
    </div>
  `;

  const rootDisplay = document.getElementById("root-display");
  const linkTable = document.getElementById("link-table");
  const treeEl = document.getElementById("tree-view");
  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const scenarioGrid = document.getElementById("scenario-grid");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function dirname(p) {
    if (p === "/") return "/";
    const i = p.lastIndexOf("/");
    if (i <= 0) return "/";
    return p.slice(0, i);
  }

  function basename(p) {
    return p.slice(p.lastIndexOf("/") + 1);
  }

  function joinPath(base, rel) {
    if (rel.startsWith("/")) {
      const parts = rel.split("/").filter((x) => x && x !== ".");
      const stack = [];
      for (const part of parts) {
        if (part === "..") {
          if (stack.length) stack.pop();
        } else stack.push(part);
      }
      return "/" + stack.join("/");
    }
    const parts = (base === "/" ? [] : base.split("/").filter(Boolean)).concat(
      rel.split("/").filter((x) => x && x !== ".")
    );
    const stack = [];
    for (const part of parts) {
      if (part === "..") {
        if (stack.length) stack.pop();
      } else stack.push(part);
    }
    return "/" + stack.join("/");
  }

  function resolveLink(linkPath) {
    const e = entries.get(linkPath);
    if (!e || e.kind !== "symlink") return { ok: false, resolved: "", target: "" };
    const raw = e.target || "";
    const resolved = raw.startsWith("/") ? joinPath("/", raw.slice(1) || ".") : joinPath(dirname(linkPath), raw);
    const ok = entries.has(resolved) && entries.get(resolved).kind !== "symlink"
      ? true
      : entries.has(resolved);
    // follow one more if symlink? keep simple: target must exist
    const exists = entries.has(resolved);
    return { ok: exists, resolved, target: raw, absolute: raw.startsWith("/") };
  }

  function listLinks() {
    return [...entries.entries()]
      .filter(([, e]) => e.kind === "symlink")
      .map(([p]) => p)
      .sort();
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 80) screen = screen.slice(-60);
  }

  function renderScreen() {
    scrollEl.innerHTML = screen
      .map((row) => {
        const cls =
          row.kind === "cmd"
            ? ""
            : row.kind === "err"
              ? "err"
              : row.kind === "muted"
                ? "muted"
                : row.kind === "ok"
                  ? "ok"
                  : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderLinks() {
    const rows = listLinks()
      .map((p) => {
        const r = resolveLink(p);
        const style = r.absolute ? "abs" : "rel";
        const st = r.ok ? "ok" : "broken";
        return `<tr>
          <td>${escapeHtml(p.replace(projectRoot, "."))}</td>
          <td class="${style}">${escapeHtml(r.target)}</td>
          <td class="${st}">${r.ok ? "OK → " + escapeHtml(r.resolved) : "BROKEN → " + escapeHtml(r.resolved)}</td>
        </tr>`;
      })
      .join("");
    linkTable.innerHTML = `<thead><tr><th>link</th><th>stored target</th><th>status</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderTree() {
    const paths = [...entries.keys()].filter((p) => p.startsWith(projectRoot)).sort();
    const lines = paths.map((p) => {
      const e = entries.get(p);
      const rel = p === projectRoot ? projectRoot + "/" : "  " + p.slice(projectRoot.length + 1) + (e.kind === "dir" ? "/" : "");
      if (e.kind === "symlink") {
        const r = resolveLink(p);
        const cls = r.ok ? "ok" : "broken";
        const kind = r.absolute ? "abs" : "rel";
        return `<span class="${cls} ${kind}">${escapeHtml(basename(p))} -> ${escapeHtml(e.target || "")}${r.ok ? "" : " (broken)"}</span>`;
      }
      return escapeHtml(rel || p);
    });
    // simpler indented listing
    const out = [];
    out.push(escapeHtml(projectRoot) + "/");
    for (const p of paths) {
      if (p === projectRoot) continue;
      const e = entries.get(p);
      const depth = p.slice(projectRoot.length).split("/").filter(Boolean).length;
      const pad = "  ".repeat(depth);
      const name = basename(p) + (e.kind === "dir" ? "/" : "");
      if (e.kind === "symlink") {
        const r = resolveLink(p);
        const cls = r.ok ? "ok" : "broken";
        out.push(`${pad}<span class="${cls}">${escapeHtml(name)} -> ${escapeHtml(e.target || "")}${r.ok ? "" : " (broken)"}</span>`);
      } else {
        out.push(`${pad}${escapeHtml(name)}`);
      }
    }
    treeEl.innerHTML = out.join("\n");
  }

  function renderAll() {
    rootDisplay.textContent = projectRoot;
    renderLinks();
    renderTree();
    renderScreen();
    renderScenarios();
  }

  /** Remap paths from old root to new root; keep symlink target strings unchanged. */
  function relocateTree(newRoot) {
    const old = projectRoot;
    /** @type {Map<string, {kind:string, target?: string}>} */
    const next = new Map();
    next.set("/", { kind: "dir" });
    for (const [p, e] of entries) {
      if (!p.startsWith(old)) continue;
      const np = newRoot + p.slice(old.length);
      next.set(np, { kind: e.kind, target: e.target });
    }
    const parts = newRoot.split("/").filter(Boolean);
    let acc = "";
    for (const part of parts) {
      acc += "/" + part;
      if (!next.has(acc)) next.set(acc, { kind: "dir" });
    }
    entries = next;
    projectRoot = newRoot;
  }

  function moveEntry(from, to) {
    const e = entries.get(from);
    if (!e) return false;
    if (entries.has(to)) return false;
    entries.set(to, e);
    entries.delete(from);
    return true;
  }

  const SCENARIOS = [
    {
      id: "starter",
      label: "Reset starter tree",
      run: () => {
        projectRoot = STARTER_ROOT;
        entries = makeStarter(projectRoot);
        lastScenario = "starter";
        pushScreen("muted", "Starter at " + projectRoot);
      },
    },
    {
      id: "move-tree",
      label: "Move whole tree → /opt/chip",
      run: () => {
        entries = makeStarter(STARTER_ROOT);
        projectRoot = STARTER_ROOT;
        relocateTree("/opt/chip");
        lastScenario = "move-tree";
        pushScreen("muted", "Whole tree moved to /opt/chip");
        pushScreen("muted", "Relative links OK; absolute still points at /home/lab/chip/... → broken");
      },
    },
    {
      id: "move-link",
      label: "Move only to_top_rel → project root",
      run: () => {
        entries = makeStarter(projectRoot === "/opt/chip" ? STARTER_ROOT : projectRoot);
        if (projectRoot === "/opt/chip") projectRoot = STARTER_ROOT;
        entries = makeStarter(STARTER_ROOT);
        projectRoot = STARTER_ROOT;
        const from = `${projectRoot}/links/to_top_rel`;
        const to = `${projectRoot}/to_top_rel`;
        moveEntry(from, to);
        lastScenario = "move-link";
        pushScreen("muted", `mv links/to_top_rel → ./to_top_rel`);
        pushScreen("muted", "Relative ../rtl/top.v now resolves from project root — broken");
      },
    },
    {
      id: "move-target",
      label: "Move only rtl/top.v → rtl/old/top.v",
      run: () => {
        entries = makeStarter(STARTER_ROOT);
        projectRoot = STARTER_ROOT;
        const from = `${projectRoot}/rtl/top.v`;
        const to = `${projectRoot}/rtl/old/top.v`;
        entries.set(`${projectRoot}/rtl/old`, { kind: "dir" });
        moveEntry(from, to);
        lastScenario = "move-target";
        pushScreen("muted", `mv rtl/top.v → rtl/old/top.v — both links break`);
      },
    },
    {
      id: "move-abs-ok",
      label: "Move only to_top_abs → project root",
      run: () => {
        entries = makeStarter(STARTER_ROOT);
        projectRoot = STARTER_ROOT;
        const from = `${projectRoot}/links/to_top_abs`;
        const to = `${projectRoot}/to_top_abs`;
        moveEntry(from, to);
        lastScenario = "move-abs-ok";
        pushScreen("muted", "Absolute link still points at rtl/top.v — OK");
      },
    },
  ];

  function renderScenarios() {
    scenarioGrid.innerHTML = "";
    SCENARIOS.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      if (lastScenario === s.id) b.classList.add("is-active");
      b.addEventListener("click", () => {
        s.run();
        renderAll();
        saveSession();
      });
      scenarioGrid.appendChild(b);
    });
  }

  function linkStatus(name) {
    const full = listLinks().find((p) => p.endsWith("/" + name) || basename(p) === name);
    if (!full) return null;
    return resolveLink(full);
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);
    if (t === "help") {
      pushScreen("out", "readlink PATH · realpath PATH · ls · help · (use scenario buttons to move)");
      return;
    }
    let m;
    if ((m = t.match(/^readlink\s+(\S+)$/))) {
      let p = m[1];
      if (!p.startsWith("/")) p = joinPath(projectRoot + "/links", p);
      if (!entries.has(p)) {
        // try under projectRoot
        const alt = joinPath(projectRoot, m[1]);
        if (entries.has(alt)) p = alt;
      }
      const e = entries.get(p);
      if (!e || e.kind !== "symlink") {
        pushScreen("err", `readlink: ${m[1]}: Not a symlink`);
        return;
      }
      pushScreen("out", e.target || "");
      return;
    }
    if ((m = t.match(/^realpath\s+(\S+)$/))) {
      let p = m[1];
      if (!p.startsWith("/")) p = joinPath(projectRoot + "/links", p);
      if (!entries.has(p)) {
        const alt = joinPath(projectRoot, m[1]);
        if (entries.has(alt)) p = alt;
      }
      const r = resolveLink(p);
      if (!r.target && entries.get(p)?.kind !== "symlink") {
        if (entries.has(p)) {
          pushScreen("ok", p);
          return;
        }
        pushScreen("err", `realpath: ${m[1]}: No such file`);
        return;
      }
      if (!r.ok) {
        pushScreen("err", `realpath: ${m[1]}: No such file (${r.resolved})`);
        return;
      }
      pushScreen("ok", r.resolved);
      return;
    }
    if (t === "ls" || t.startsWith("ls ")) {
      listLinks().forEach((p) => {
        const r = resolveLink(p);
        pushScreen("out", `${basename(p)} -> ${r.target}${r.ok ? "" : " (broken)"}`);
      });
      return;
    }
    pushScreen("err", "lab: unknown (try help)");
  }

  function loadStarter() {
    projectRoot = STARTER_ROOT;
    entries = makeStarter(projectRoot);
    lastScenario = "starter";
    lastCmd = "";
    screen = [
      {
        kind: "muted",
        text: "Starter: compare to_top_rel vs to_top_abs, then try move scenarios",
      },
    ];
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          projectRoot,
          entries: [...entries.entries()],
          lastScenario,
          screen: screen.slice(-40),
          lastCmd,
        })
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
      if (!Array.isArray(data.entries) || !data.entries.length) return false;
      entries = new Map(data.entries);
      projectRoot = data.projectRoot || STARTER_ROOT;
      lastScenario = data.lastScenario || "starter";
      screen = Array.isArray(data.screen) ? data.screen : [];
      lastCmd = data.lastCmd || "";
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "readlink to_top_rel", cmd: "readlink to_top_rel" },
    { label: "readlink to_top_abs", cmd: "readlink to_top_abs" },
    { label: "realpath to_top_rel", cmd: "realpath to_top_rel" },
    { label: "ls links", cmd: "ls" },
  ];
  const quickRow = document.getElementById("quick-row");
  QUICK.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q.label;
    b.addEventListener("click", () => {
      fakeRun(q.cmd);
      renderAll();
      saveSession();
    });
    quickRow.appendChild(b);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fakeRun(inputEl.value);
      inputEl.value = "";
      renderAll();
      saveSession();
    }
  });

  function relOk() {
    const r = linkStatus("to_top_rel");
    return r && r.ok;
  }
  function absOk() {
    const r = linkStatus("to_top_abs");
    return r && r.ok;
  }

  const CHALLENGES = [
    {
      id: "quiz-base",
      title: "Quiz: base",
      prompt: "Relative symlink targets resolve against the? Answer: <code>link dir</code>",
      hint: "directory containing the symlink",
      type: "text",
      answer: "link dir",
      alt: ["parent", "link directory", "symlink directory", "link's directory"],
    },
    {
      id: "starter-both-ok",
      title: "Starter both OK",
      prompt: "Load starter — both <code>to_top_rel</code> and <code>to_top_abs</code> should be OK.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => lastScenario === "starter" && relOk() && absOk(),
    },
    {
      id: "readlink-rel",
      title: "readlink rel",
      prompt: "Run <code>readlink to_top_rel</code> — expect <code>../rtl/top.v</code>.",
      hint: "Quick button",
      type: "state",
      setup: () => {
        if (lastScenario !== "starter") loadStarter();
      },
      check: () => lastCmd.includes("readlink") && lastCmd.includes("to_top_rel") &&
        screen.some((r) => r.text === "../rtl/top.v"),
    },
    {
      id: "move-tree-rel-ok",
      title: "Tree move: rel OK",
      prompt: "Run “Move whole tree → /opt/chip” — relative link still OK.",
      hint: "First move scenario",
      type: "state",
      check: () => lastScenario === "move-tree" && projectRoot === "/opt/chip" && relOk(),
    },
    {
      id: "move-tree-abs-break",
      title: "Tree move: abs break",
      prompt: "After whole-tree move, absolute link should be BROKEN.",
      hint: "Same scenario — abs still points at /home/lab/chip",
      type: "state",
      check: () => lastScenario === "move-tree" && !absOk(),
    },
    {
      id: "quiz-tree-move",
      title: "Quiz: tree move",
      prompt: "Whole-tree relocate: which style usually survives? Answer: <code>relative</code>",
      hint: "relative",
      type: "text",
      answer: "relative",
      alt: ["rel", "relative link"],
    },
    {
      id: "move-link-break",
      title: "Move link breaks rel",
      prompt: "Run “Move only to_top_rel → project root” — relative becomes BROKEN.",
      hint: "Move-link scenario",
      type: "state",
      check: () => lastScenario === "move-link" && !relOk(),
    },
    {
      id: "move-abs-survives",
      title: "Move abs OK",
      prompt: "Run “Move only to_top_abs → project root” — absolute still OK.",
      hint: "Last scenario button",
      type: "state",
      check: () => lastScenario === "move-abs-ok" && absOk(),
    },
    {
      id: "quiz-link-move",
      title: "Quiz: link move",
      prompt: "Moving only the symlink often breaks? Answer: <code>relative</code>",
      hint: "relative",
      type: "text",
      answer: "relative",
      alt: ["rel"],
    },
    {
      id: "move-target",
      title: "Move target",
      prompt: "Move only <code>rtl/top.v</code> — both links break.",
      hint: "Move target scenario",
      type: "state",
      check: () => lastScenario === "move-target" && !relOk() && !absOk(),
    },
    {
      id: "quiz-abs-use",
      title: "Quiz: abs use",
      prompt: "Absolute links are better for? Answer: <code>system</code> tools or <code>fixed</code> paths",
      hint: "fixed toolchain paths",
      type: "text",
      answer: "fixed",
      alt: ["system", "toolchain", "absolute path", "fixed paths"],
    },
    {
      id: "quiz-rel-use",
      title: "Quiz: rel use",
      prompt: "Relative links are better inside a? Answer: <code>repo</code> or <code>project</code>",
      hint: "relocatable project tree",
      type: "text",
      answer: "repo",
      alt: ["project", "repository", "tree"],
    },
    {
      id: "rel-target-string",
      title: "Rel string",
      prompt: "Starter relative target string for to_top_rel? (exact)",
      hint: "../rtl/top.v",
      type: "text",
      answer: "../rtl/top.v",
      setup: () => loadStarter(),
    },
    {
      id: "abs-prefix",
      title: "Abs prefix",
      prompt: "Starter absolute link begins with? Answer: <code>/home/lab/chip</code>",
      hint: "full path under home",
      type: "text",
      answer: "/home/lab/chip",
      alt: ["/home/lab/chip/rtl/top.v"],
      setup: () => loadStarter(),
    },
    {
      id: "alu-link",
      title: "Sibling rel",
      prompt: "Starter <code>rtl/alu_link</code> target is? Answer: <code>alu.v</code>",
      hint: "same-directory relative",
      type: "text",
      answer: "alu.v",
      setup: () => loadStarter(),
    },
    {
      id: "opt-root",
      title: "opt root",
      prompt: "After whole-tree move, project root is? (exact)",
      hint: "/opt/chip",
      type: "text",
      answer: "/opt/chip",
      setup: () => {
        SCENARIOS.find((s) => s.id === "move-tree").run();
        renderAll();
      },
    },
    {
      id: "realpath-starter",
      title: "realpath starter",
      prompt: "On starter, <code>realpath to_top_rel</code> → <code>/home/lab/chip/rtl/top.v</code>.",
      hint: "Reset starter, realpath button",
      type: "state",
      check: () =>
        projectRoot === STARTER_ROOT &&
        lastCmd.includes("realpath") &&
        screen.some((r) => r.text === `${STARTER_ROOT}/rtl/top.v`),
    },
    {
      id: "quiz-cwd",
      title: "Quiz: not cwd",
      prompt: "Relative link resolution ignores your? Answer: <code>cwd</code>",
      hint: "current working directory",
      type: "text",
      answer: "cwd",
      alt: ["pwd", "current directory", "working directory"],
    },
    {
      id: "count-broken-tree",
      title: "Count broken",
      prompt: "After whole-tree move to /opt/chip, how many of the two top links are broken? (number)",
      hint: "only the absolute one → 1",
      type: "text",
      answer: "1",
      setup: () => {
        SCENARIOS.find((s) => s.id === "move-tree").run();
        renderAll();
      },
    },
    {
      id: "quiz-both-break",
      title: "Quiz: target move",
      prompt: "If the target file moves away, relative and absolute both? Answer: <code>break</code>",
      hint: "both break",
      type: "text",
      answer: "break",
      alt: ["broken", "fail", "break both"],
    },
    {
      id: "reset-ok",
      title: "Reset",
      prompt: "Click Reset starter tree — both main links OK again.",
      hint: "First scenario button",
      type: "state",
      check: () => lastScenario === "starter" && relOk() && absOk(),
    },
    {
      id: "quiz-rule",
      title: "Quiz: rule",
      prompt: "Rule of thumb: relocatable trees use? Answer: <code>relative</code> symlinks",
      hint: "relative",
      type: "text",
      answer: "relative",
      alt: ["rel"],
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
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:16rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use scenarios / terminal, then Check.</span>`;
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
        if (typeof CHALLENGES[i].setup === "function" && CHALLENGES[i].type === "state") {
          CHALLENGES[i].setup();
          renderAll();
        }
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

  document.getElementById("lr-starter").addEventListener("click", loadStarter);
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
    if (typeof ch.setup === "function" && ch.type === "state") {
      ch.setup();
      renderAll();
    }
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
