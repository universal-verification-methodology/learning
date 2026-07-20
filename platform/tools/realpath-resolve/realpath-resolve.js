(() => {
  const HOME = "/home/lab";
  const ROOT_LAB = `${HOME}/chip`;

  /**
   * VFS: path -> { kind: 'dir'|'file'|'symlink', target?: string }
   * Symlink targets are stored as written (relative or absolute).
   */
  function makeStarter() {
    /** @type {Map<string, {kind:string, target?: string}>} */
    const m = new Map();
    const dir = (p) => m.set(p, { kind: "dir" });
    const file = (p) => m.set(p, { kind: "file" });
    const link = (p, target) => m.set(p, { kind: "symlink", target });

    dir("/");
    dir("/home");
    dir(HOME);
    dir(ROOT_LAB);
    dir(`${ROOT_LAB}/rtl`);
    dir(`${ROOT_LAB}/tb`);
    dir(`${ROOT_LAB}/links`);
    dir(`${ROOT_LAB}/links/deep`);
    dir(`${HOME}/tools`);
    dir(`${HOME}/tools/bin`);

    file(`${ROOT_LAB}/rtl/top.v`);
    file(`${ROOT_LAB}/rtl/alu.v`);
    file(`${ROOT_LAB}/tb/tb_top.v`);
    file(`${ROOT_LAB}/Makefile`);
    file(`${HOME}/tools/bin/iverilog`);

    // relative soft links (target relative to link's parent dir)
    link(`${ROOT_LAB}/links/to_top`, "../rtl/top.v");
    link(`${ROOT_LAB}/links/to_rtl`, "../rtl");
    link(`${ROOT_LAB}/links/chain_a`, "chain_b");
    link(`${ROOT_LAB}/links/chain_b`, "../rtl/alu.v");
    link(`${ROOT_LAB}/links/deep/up`, "../../rtl/top.v");
    // absolute soft link
    link(`${ROOT_LAB}/links/abs_tb`, `${ROOT_LAB}/tb/tb_top.v`);
    // toolchain-style absolute
    link(`${ROOT_LAB}/links/vlog`, `${HOME}/tools/bin/iverilog`);
    // broken
    link(`${ROOT_LAB}/links/gone`, "missing.v");
    // cwd-relative trap: same string resolves differently depending on link location
    link(`${ROOT_LAB}/rtl/sibling`, "alu.v");

    return m;
  }

  /** @type {Map<string, {kind:string, target?: string}>} */
  let entries = makeStarter();
  let cwd = `${ROOT_LAB}/links`;
  /** @type {{kind:string,text:string}[]} */
  let screen = [];
  let lastReadlink = "";
  let lastRealpath = "";
  let lastRealpathOk = false;
  let lastCmd = "";
  /** @type {string[]} */
  let lastSteps = [];

  const CLEARED_KEY = "ddv-realpath-resolve-cleared-v1";
  const STORE_KEY = "ddv-realpath-resolve-session-v1";

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

  const root = document.getElementById("rp-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> cwd is <code>${ROOT_LAB}/links</code>.
        Compare <code>readlink to_top</code> (prints <code>../rtl/top.v</code>) with
        <code>realpath to_top</code> (canonical <code>${ROOT_LAB}/rtl/top.v</code>).
        Then try <code>chain_a</code> and the broken <code>gone</code>.</p>
      <button type="button" class="btn btn-secondary" id="rp-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Lab terminal</h2></div>
        <div class="panel-body">
          <p class="cwd-banner"><span>pwd</span><code id="cwd-display"></code></p>
          <div class="rp-term">
            <div class="rp-scroll" id="term-scroll"></div>
            <div class="rp-prompt-row">
              <span class="rp-prompt">lab$</span>
              <input class="rp-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="readlink · realpath · readlink -f · cd · ls · pwd · help"
                aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Side-by-side resolve</h2></div>
        <div class="panel-body">
          <div class="resolve-row">
            <label>Path
              <input id="probe-in" value="to_top" spellcheck="false" />
            </label>
            <button type="button" class="btn btn-primary" id="btn-probe">Compare</button>
          </div>
          <div class="compare-grid">
            <div class="compare-card">
              <h3>readlink</h3>
              <div class="cmd">stored target string</div>
              <div class="result" id="out-readlink">—</div>
            </div>
            <div class="compare-card">
              <h3>realpath</h3>
              <div class="cmd">canonical after following links</div>
              <div class="result" id="out-realpath">—</div>
            </div>
          </div>
          <ol class="steps" id="step-list" style="margin-top:0.85rem"></ol>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Lab tree</h2>
        <span style="font-size:0.8rem;color:var(--muted)">● = cwd · green = symlink</span>
      </div>
      <div class="panel-body">
        <pre class="tree-view" id="tree-view"></pre>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>readlink LINK</code></td><td>Print the stored target string (no resolve)</td></tr>
            <tr><td><code>realpath PATH</code></td><td>Absolute path with <code>.</code>/<code>..</code> cleaned and symlinks followed</td></tr>
            <tr><td><code>readlink -f PATH</code></td><td>Same idea as <code>realpath</code> in this lab</td></tr>
            <tr><td><code>cd</code> / <code>pwd</code> / <code>ls</code></td><td>Navigate and inspect</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Relative symlink targets resolve against the <strong>link's directory</strong>, not your cwd.</li>
          <li>Broken links: <code>readlink</code> still prints the string; <code>realpath</code> fails.</li>
        </ul>
      </div>
    </div>
  `;

  const cwdEl = document.getElementById("cwd-display");
  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const treeEl = document.getElementById("tree-view");
  const outRead = document.getElementById("out-readlink");
  const outReal = document.getElementById("out-realpath");
  const stepList = document.getElementById("step-list");
  const probeIn = document.getElementById("probe-in");

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
    if (p === "/") return "/";
    const i = p.lastIndexOf("/");
    return p.slice(i + 1);
  }

  function joinPath(base, rel) {
    if (!rel || rel === ".") return base;
    if (rel.startsWith("/")) return rel;
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

  function cleanDots(abs) {
    const body = String(abs).replace(/^\//, "");
    return joinPath("/", body || ".");
  }

  function exists(path) {
    return entries.has(path);
  }

  function kindOf(path) {
    return entries.get(path)?.kind || null;
  }

  /**
   * Resolve path against cwd without following final symlink (like openat O_NOFOLLOW for last).
   * Intermediate dirs that are symlinks are followed when walking? For simplicity:
   * we lexically join then look up. For cd into symlink dirs we follow.
   */
  function expandUser(p) {
    if (p === "~") return HOME;
    if (p.startsWith("~/")) return HOME + p.slice(1);
    return p;
  }

  function toAbs(userPath) {
    const p = expandUser(userPath);
    if (p.startsWith("/")) return cleanDots(p);
    return joinPath(cwd, p);
  }

  /**
   * Follow symlink chain; return { ok, path, steps, readTarget? }
   * For realpath of a symlink: resolve to final file/dir.
   * For realpath of missing: fail (lab uses GNU-like strict mode).
   */
  function realpathOf(userPath) {
    const steps = [];
    let cur = toAbs(userPath);
    steps.push(`start: ${cur}`);
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      if (!exists(cur)) {
        steps.push(`missing: ${cur}`);
        return { ok: false, path: "", steps, err: `No such file: ${cur}` };
      }
      const e = entries.get(cur);
      if (e.kind !== "symlink") {
        steps.push(`done: ${cur} (${e.kind})`);
        return { ok: true, path: cur, steps };
      }
      if (seen.has(cur)) {
        steps.push(`loop at ${cur}`);
        return { ok: false, path: "", steps, err: "Too many levels of symbolic links" };
      }
      seen.add(cur);
      const raw = e.target || "";
      const next = raw.startsWith("/") ? cleanDots(raw) : joinPath(dirname(cur), raw);
      steps.push(`${cur} -> ${raw}  =>  ${next}`);
      cur = next;
    }
    return { ok: false, path: "", steps, err: "Too many levels of symbolic links" };
  }

  function readlinkOf(userPath) {
    const abs = toAbs(userPath);
    const e = entries.get(abs);
    if (!e) return { ok: false, target: "", err: `No such file: ${abs}` };
    if (e.kind !== "symlink") return { ok: false, target: "", err: `Not a symbolic link: ${abs}` };
    return { ok: true, target: e.target || "", abs };
  }

  function listDir(abs) {
    const prefix = abs === "/" ? "/" : abs + "/";
    const names = new Set();
    for (const p of entries.keys()) {
      if (p === abs) continue;
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (!rest || rest.includes("/")) continue;
      names.add(rest);
    }
    return [...names].sort();
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 90) screen = screen.slice(-70);
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

  function renderTree() {
    const lines = [];
    const walk = (dir, indent) => {
      const kids = listDir(dir);
      for (const name of kids) {
        const p = joinPath(dir, name);
        const e = entries.get(p);
        const here = p === cwd ? " ●" : "";
        const clsHere = p === cwd ? "cwd" : "";
        if (e.kind === "dir") {
          lines.push(`${indent}<span class="${clsHere}">${escapeHtml(name)}/${here}</span>`);
          walk(p, indent + "  ");
        } else if (e.kind === "symlink") {
          const rp = realpathOf(p);
          const br = !rp.ok;
          const cls = br ? "broken" : "link";
          lines.push(
            `${indent}<span class="${cls}">${escapeHtml(name)} -> ${escapeHtml(e.target || "")}${br ? " (broken)" : ""}${here}</span>`
          );
        } else {
          lines.push(`${indent}<span class="${clsHere}">${escapeHtml(name)}${here}</span>`);
        }
      }
    };
    lines.push(`<span class="${ROOT_LAB === cwd ? "cwd" : ""}">${escapeHtml(ROOT_LAB)}/</span>`);
    // show under chip and also tools briefly
    walk(ROOT_LAB, "  ");
    lines.push(`${escapeHtml(HOME)}/tools/bin/iverilog`);
    treeEl.innerHTML = lines.join("\n");
  }

  function updateProbeUI(path) {
    const rl = readlinkOf(path);
    const rp = realpathOf(path);
    lastSteps = rp.steps || [];
    if (rl.ok) {
      outRead.textContent = rl.target;
      outRead.className = "result pass";
      lastReadlink = rl.target;
    } else {
      outRead.textContent = rl.err || "error";
      outRead.className = "result fail";
      // if not a symlink, still show that for teaching
      if (exists(toAbs(path)) && kindOf(toAbs(path)) !== "symlink") {
        outRead.textContent = "(not a symlink)";
      }
      lastReadlink = "";
    }
    if (rp.ok) {
      outReal.textContent = rp.path;
      outReal.className = "result pass";
      lastRealpath = rp.path;
      lastRealpathOk = true;
    } else {
      outReal.textContent = rp.err || "error";
      outReal.className = "result fail";
      lastRealpath = "";
      lastRealpathOk = false;
    }
    stepList.innerHTML = lastSteps.map((s, i) => {
      const last = i === lastSteps.length - 1 ? ' class="here"' : "";
      return `<li${last}>${escapeHtml(s)}</li>`;
    }).join("");
  }

  function renderAll() {
    cwdEl.textContent = cwd;
    renderScreen();
    renderTree();
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "pwd · cd DIR · ls [DIR] · readlink LINK · realpath PATH · readlink -f PATH · help"
      );
      return;
    }
    if (t === "pwd") {
      pushScreen("out", cwd);
      return;
    }

    let m;
    if ((m = t.match(/^cd\s+(\S+)$/))) {
      const dest = m[1];
      const rp = realpathOf(dest);
      if (!rp.ok) {
        pushScreen("err", `cd: ${dest}: ${rp.err}`);
        return;
      }
      if (kindOf(rp.path) !== "dir") {
        pushScreen("err", `cd: ${dest}: Not a directory`);
        return;
      }
      cwd = rp.path;
      pushScreen("muted", `(cwd ${cwd})`);
      return;
    }
    if (t === "ls" || t === "ls -l" || (m = t.match(/^ls(?:\s+-l)?\s+(\S+)$/))) {
      const target = m && m[1] ? m[1] : ".";
      const rp = realpathOf(target);
      if (!rp.ok) {
        pushScreen("err", `ls: ${target}: ${rp.err}`);
        return;
      }
      const dir = kindOf(rp.path) === "dir" ? rp.path : dirname(rp.path);
      for (const name of listDir(dir)) {
        const p = joinPath(dir, name);
        const e = entries.get(p);
        if (e.kind === "symlink") pushScreen("out", `${name} -> ${e.target}`);
        else if (e.kind === "dir") pushScreen("out", name + "/");
        else pushScreen("out", name);
      }
      return;
    }
    if ((m = t.match(/^readlink\s+-f\s+(\S+)$/)) || (m = t.match(/^realpath\s+(\S+)$/))) {
      const path = m[1];
      const rp = realpathOf(path);
      lastSteps = rp.steps;
      if (!rp.ok) {
        pushScreen("err", `realpath: ${path}: ${rp.err}`);
        lastRealpath = "";
        lastRealpathOk = false;
        updateProbeUI(path);
        return;
      }
      lastRealpath = rp.path;
      lastRealpathOk = true;
      pushScreen("ok", rp.path);
      updateProbeUI(path);
      return;
    }
    if ((m = t.match(/^readlink\s+(\S+)$/))) {
      const path = m[1];
      const rl = readlinkOf(path);
      if (!rl.ok) {
        pushScreen("err", `readlink: ${path}: ${rl.err}`);
        lastReadlink = "";
        updateProbeUI(path);
        return;
      }
      lastReadlink = rl.target;
      pushScreen("out", rl.target);
      updateProbeUI(path);
      return;
    }
    pushScreen("err", "lab: unknown (try help)");
  }

  function submitLine() {
    const raw = inputEl.value;
    inputEl.value = "";
    fakeRun(raw);
    renderAll();
    saveSession();
  }

  function loadStarter() {
    entries = makeStarter();
    cwd = `${ROOT_LAB}/links`;
    screen = [
      {
        kind: "muted",
        text: "Starter loaded — try: readlink to_top · realpath to_top · realpath chain_a",
      },
    ];
    lastReadlink = "";
    lastRealpath = "";
    lastRealpathOk = false;
    lastCmd = "";
    lastSteps = [];
    probeIn.value = "to_top";
    updateProbeUI("to_top");
    renderAll();
    saveSession();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          entries: [...entries.entries()],
          cwd,
          screen: screen.slice(-40),
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
      cwd = data.cwd || `${ROOT_LAB}/links`;
      screen = Array.isArray(data.screen) ? data.screen : [];
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "readlink to_top", cmd: "readlink to_top" },
    { label: "realpath to_top", cmd: "realpath to_top" },
    { label: "realpath chain_a", cmd: "realpath chain_a" },
    { label: "readlink gone", cmd: "readlink gone" },
    { label: "realpath gone", cmd: "realpath gone" },
    { label: "cd ../rtl", cmd: "cd ../rtl" },
    { label: "pwd", cmd: "pwd" },
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

  document.getElementById("btn-probe").addEventListener("click", () => {
    updateProbeUI(probeIn.value.trim() || ".");
    renderTree();
    saveSession();
  });
  probeIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      updateProbeUI(probeIn.value.trim() || ".");
      renderTree();
    }
  });

  const CHALLENGES = [
    {
      id: "quiz-readlink",
      title: "Quiz: readlink",
      prompt: "<code>readlink</code> prints the? Answer: <code>target</code> or <code>string</code>",
      hint: "stored target string — not the resolved path",
      type: "text",
      answer: "target",
      alt: ["string", "target string", "stored target", "path string"],
    },
    {
      id: "quiz-realpath",
      title: "Quiz: realpath",
      prompt: "<code>realpath</code> follows symlinks to a? Answer: <code>canonical</code> path",
      hint: "canonical / absolute resolved path",
      type: "text",
      answer: "canonical",
      alt: ["absolute", "resolved", "canonical path", "real path"],
    },
    {
      id: "readlink-to-top",
      title: "readlink to_top",
      prompt: "Run <code>readlink to_top</code> — expect <code>../rtl/top.v</code>.",
      hint: "Quick button or type it (cwd should be …/links).",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => lastReadlink === "../rtl/top.v",
    },
    {
      id: "realpath-to-top",
      title: "realpath to_top",
      prompt: `Run <code>realpath to_top</code> — expect <code>${ROOT_LAB}/rtl/top.v</code>.`,
      hint: "realpath to_top",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => lastRealpathOk && lastRealpath === `${ROOT_LAB}/rtl/top.v`,
    },
    {
      id: "type-contrast",
      title: "Contrast answer",
      prompt: "Starter <code>to_top</code>: what does <code>readlink</code> print? (exact)",
      hint: "../rtl/top.v",
      type: "text",
      answer: "../rtl/top.v",
      setup: () => loadStarter(),
    },
    {
      id: "canonical-answer",
      title: "Canonical answer",
      prompt: `Starter <code>to_top</code>: what does <code>realpath</code> print? (exact)`,
      hint: `${ROOT_LAB}/rtl/top.v`,
      type: "text",
      answer: `${ROOT_LAB}/rtl/top.v`,
      setup: () => loadStarter(),
    },
    {
      id: "chain-realpath",
      title: "Chain realpath",
      prompt: `Run <code>realpath chain_a</code> — expect <code>${ROOT_LAB}/rtl/alu.v</code>.`,
      hint: "chain_a → chain_b → ../rtl/alu.v",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => lastRealpathOk && lastRealpath === `${ROOT_LAB}/rtl/alu.v`,
    },
    {
      id: "chain-readlink",
      title: "Chain readlink",
      prompt: "Run <code>readlink chain_a</code> — only one hop. Exact string?",
      hint: "chain_b",
      type: "state",
      check: () => lastReadlink === "chain_b",
    },
    {
      id: "broken-readlink",
      title: "Broken readlink",
      prompt: "Run <code>readlink gone</code> — still prints <code>missing.v</code>.",
      hint: "readlink gone",
      type: "state",
      check: () => lastReadlink === "missing.v",
    },
    {
      id: "broken-realpath",
      title: "Broken realpath",
      prompt: "Run <code>realpath gone</code> — should fail (no such file).",
      hint: "realpath gone",
      type: "state",
      check: () => lastCmd.startsWith("realpath gone") && !lastRealpathOk,
    },
    {
      id: "abs-link",
      title: "Absolute link",
      prompt: `Run <code>realpath abs_tb</code> — expect <code>${ROOT_LAB}/tb/tb_top.v</code>.`,
      hint: "abs_tb stores an absolute target",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => lastRealpathOk && lastRealpath === `${ROOT_LAB}/tb/tb_top.v`,
    },
    {
      id: "deep-up",
      title: "Deep relative",
      prompt: `From <code>links</code>, <code>realpath deep/up</code> → <code>${ROOT_LAB}/rtl/top.v</code>.`,
      hint: "deep/up → ../../rtl/top.v relative to links/deep",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => lastRealpathOk && lastRealpath === `${ROOT_LAB}/rtl/top.v`,
    },
    {
      id: "quiz-rel-base",
      title: "Quiz: relative base",
      prompt: "Relative symlink targets resolve against the? Answer: <code>link dir</code> or <code>parent</code>",
      hint: "the directory containing the symlink — not cwd",
      type: "text",
      answer: "link dir",
      alt: ["parent", "link directory", "symlink dir", "link's directory", "directory of the link"],
    },
    {
      id: "cd-through-link",
      title: "cd through link",
      prompt: "From links: <code>cd to_rtl</code> then <code>pwd</code> should be the real rtl dir.",
      hint: "cd to_rtl",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => cwd === `${ROOT_LAB}/rtl`,
    },
    {
      id: "sibling-trap",
      title: "Sibling from rtl",
      prompt: `cd to rtl, then <code>realpath sibling</code> → <code>${ROOT_LAB}/rtl/alu.v</code>.`,
      hint: "cd ../rtl (or cd to_rtl) then realpath sibling",
      type: "state",
      check: () =>
        cwd === `${ROOT_LAB}/rtl` && lastRealpathOk && lastRealpath === `${ROOT_LAB}/rtl/alu.v`,
    },
    {
      id: "readlink-f",
      title: "readlink -f",
      prompt: `Run <code>readlink -f to_top</code> — same as realpath in this lab.`,
      hint: "readlink -f to_top",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () =>
        lastCmd === "readlink -f to_top" && lastRealpathOk && lastRealpath === `${ROOT_LAB}/rtl/top.v`,
    },
    {
      id: "vlog-tool",
      title: "Toolchain link",
      prompt: `What does <code>realpath vlog</code> print? (exact path)`,
      hint: `${HOME}/tools/bin/iverilog`,
      type: "text",
      answer: `${HOME}/tools/bin/iverilog`,
      setup: () => {
        loadStarter();
        fakeRun("realpath vlog");
        renderAll();
      },
    },
    {
      id: "quiz-not-same",
      title: "Quiz: not the same",
      prompt: "Do <code>readlink</code> and <code>realpath</code> always print the same string? Answer: <code>no</code>",
      hint: "only when the stored target is already the final absolute path",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "to-rtl-realpath",
      title: "Dir symlink",
      prompt: `Run <code>realpath to_rtl</code> → <code>${ROOT_LAB}/rtl</code>.`,
      hint: "to_rtl → ../rtl",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => lastRealpathOk && lastRealpath === `${ROOT_LAB}/rtl`,
    },
    {
      id: "probe-ui",
      title: "Compare panel",
      prompt: "In the Compare panel, probe <code>chain_b</code> so realpath shows alu.v.",
      hint: "Type chain_b and click Compare (or run realpath chain_b).",
      type: "state",
      setup: () => {
        cwd = `${ROOT_LAB}/links`;
      },
      check: () => lastRealpathOk && lastRealpath === `${ROOT_LAB}/rtl/alu.v` && (probeIn.value.trim() === "chain_b" || lastCmd.includes("chain_b")),
    },
    {
      id: "makefile-plain",
      title: "Plain file",
      prompt: `From chip root: <code>realpath Makefile</code> → <code>${ROOT_LAB}/Makefile</code>.`,
      hint: "cd .. then realpath Makefile",
      type: "state",
      check: () => lastRealpathOk && lastRealpath === `${ROOT_LAB}/Makefile`,
    },
    {
      id: "quiz-broken",
      title: "Quiz: broken",
      prompt: "On a broken symlink, which still prints a string? Answer: <code>readlink</code>",
      hint: "readlink does not need the target to exist",
      type: "text",
      answer: "readlink",
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the terminal / Compare panel, then Check.</span>`;
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

  document.getElementById("rp-starter").addEventListener("click", loadStarter);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitLine();
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
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function" && ch.type === "state") {
      ch.setup();
      renderAll();
    }
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else {
    renderAll();
    updateProbeUI(probeIn.value.trim() || "to_top");
  }
  renderChallenge();
})();
