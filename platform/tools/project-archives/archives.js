(() => {
  const PROJECT = [
    { path: "README.md", size: 420, content: "# sample_project\nRTL + TB template\n" },
    { path: "src/main.v", size: 88, content: "module main;\nendmodule\n" },
    { path: "src/alu.v", size: 120, content: "module alu;\nendmodule\n" },
    { path: "tb/test_main.v", size: 200, content: "// testbench\n" },
    { path: "scripts/run_demo.sh", size: 160, content: "#!/usr/bin/env bash\necho run\n" },
    { path: "docs/notes.md", size: 90, content: "Lab notes\n" },
    { path: "build/main.o", size: 4096, content: "(binary)" },
    { path: "logs/sim.log", size: 2048, content: "INFO starting\nERROR fail\n" },
    { path: ".gitignore", size: 40, content: "build/\nlogs/\n*.log\n" },
  ];

  const IGNORE = ["build/", "logs/", "*.log", "*.o"];

  function ignored(path) {
    return IGNORE.some((pat) => {
      if (pat.endsWith("/")) return path.startsWith(pat) || path.includes("/" + pat.slice(0, -1) + "/");
      if (pat.startsWith("*.")) return path.endsWith(pat.slice(1));
      return path === pat || path.endsWith("/" + pat);
    });
  }

  function treeText() {
    const lines = ["sample_project/"];
    const dirs = new Set();
    PROJECT.forEach((f) => {
      const parts = f.path.split("/");
      let acc = "";
      parts.forEach((p, i) => {
        if (i < parts.length - 1) {
          acc = acc ? acc + "/" + p : p;
          if (!dirs.has(acc)) {
            dirs.add(acc);
            lines.push("  ".repeat(i) + "[dir]  " + p + "/");
          }
        } else {
          const flag = ignored(f.path) ? "  (ignored)" : "";
          lines.push("  ".repeat(i) + "[file] " + p + flag);
        }
      });
    });
    return lines.join("\n");
  }

  let lastFind = "";
  let lastGrep = "";
  let lastArchive = "";
  let lastSed = "";
  let challengeIdx = 0;
  let clearedIds = [];
  let showHint = false;
  const CLEARED_KEY = "ddv-archives-cleared-v1";
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const CHALLENGES = [
    { id: "find-v", title: "Find *.v", prompt: "find all Verilog files (*.v).", hint: "Pattern *.v, click find.", check: () => { doFind("*.v"); return lastFind.includes("src/main.v") && lastFind.includes("src/alu.v") && lastFind.includes("tb/test_main.v"); } },
    { id: "find-md", title: "Find *.md", prompt: "find markdown files.", hint: "*.md", check: () => { doFind("*.md"); return lastFind.includes("README.md") && lastFind.includes("docs/notes.md"); } },
    { id: "find-sh", title: "Find scripts", prompt: "find *.sh files.", hint: "*.sh", check: () => { doFind("*.sh"); return lastFind.includes("scripts/run_demo.sh"); } },
    { id: "find-logs", title: "Find logs/*", prompt: "find under logs/.", hint: "logs/*", check: () => { doFind("logs/*"); return lastFind.includes("logs/sim.log"); } },
    { id: "find-build", title: "Find build", prompt: "find paths containing build.", hint: "build", check: () => { doFind("build"); return lastFind.includes("build/main.o"); } },
    { id: "grep-module", title: "grep module", prompt: "grep -R for module.", hint: "pattern module", check: () => { doGrep("module"); return lastGrep.includes("src/main.v") && lastGrep.includes("src/alu.v"); } },
    { id: "grep-error", title: "grep ERROR", prompt: "Find ERROR in the tree.", hint: "grep ERROR", check: () => { doGrep("ERROR"); return lastGrep.includes("logs/sim.log"); } },
    { id: "grep-readme", title: "grep sample_project", prompt: "grep sample_project (README title).", hint: "sample_project", check: () => { doGrep("sample_project"); return lastGrep.includes("README.md"); } },
    { id: "grep-bash", title: "grep bash", prompt: "Find the shebang bash line.", hint: "bash", check: () => { doGrep("bash"); return lastGrep.includes("run_demo.sh"); } },
    { id: "tar-ignore", title: "tar respect ignore", prompt: "tar czf with ignore — must skip build/ and logs/.", hint: "Click tar czf (respect ignore).", check: () => { showArchive(true); return lastArchive.includes("skip   build/main.o") && lastArchive.includes("skip   logs/sim.log") && lastArchive.includes("keep   src/main.v"); } },
    { id: "tar-all", title: "tar everything", prompt: "tar everything — build/main.o should be kept.", hint: "tar czf (everything).", check: () => { showArchive(false); return lastArchive.includes("keep   build/main.o") && !lastArchive.includes("skipped"); } },
    { id: "tar-count-ignore", title: "Packed count (ignore)", prompt: "With ignore, archive should keep 7 files.", hint: "respect ignore, count keep lines.", check: () => { showArchive(true); const n = (lastArchive.match(/keep {3}/g) || []).length; return n === 7; } },
    { id: "sed-module", title: "sed module→MODULE", prompt: "On src/main.v run s/module/MODULE/.", hint: "Default sed cmd, file main.v, sed.", check: () => { document.getElementById("sed-cmd").value = "s/module/MODULE/"; document.getElementById("sed-file").value = "src/main.v"; document.getElementById("btn-sed").click(); return lastSed.includes("MODULE main"); } },
    { id: "sed-alu", title: "sed on alu", prompt: "Same sed on src/alu.v → MODULE alu.", hint: "Select src/alu.v.", check: () => { document.getElementById("sed-cmd").value = "s/module/MODULE/"; document.getElementById("sed-file").value = "src/alu.v"; document.getElementById("btn-sed").click(); return lastSed.includes("MODULE alu"); } },
    { id: "sed-notes", title: "sed Lab→LAB", prompt: "On docs/notes.md: s/Lab/LAB/.", hint: "s/Lab/LAB/ on notes.md", check: () => { document.getElementById("sed-cmd").value = "s/Lab/LAB/"; document.getElementById("sed-file").value = "docs/notes.md"; document.getElementById("btn-sed").click(); return lastSed.includes("LAB notes"); } },
    { id: "diff-main-alu", title: "diff main vs alu", prompt: "Run diff main.v vs alu.v — should show module name change.", hint: "Click diff.", check: () => { document.getElementById("btn-diff").click(); return lastSed.includes("-module main") || lastSed.includes("+module alu") || (lastSed.includes("main") && lastSed.includes("alu")); } },
    { id: "patch-preview", title: "patch preview", prompt: "After diff, apply patch preview — should mention would write.", hint: "diff then apply patch.", check: () => { document.getElementById("btn-diff").click(); document.getElementById("btn-patch").click(); return lastSed.includes("would write"); } },
    { id: "ignore-o", title: "Ignore *.o", prompt: "Confirm build/main.o is marked ignored in the tree.", hint: "Look at project tree (ignored).", check: () => document.getElementById("tree").textContent.includes("main.o") && document.getElementById("tree").textContent.includes("(ignored)") },
    { id: "ignore-log", title: "Ignore log", prompt: "sim.log should be ignored in the tree.", hint: "Tree shows (ignored) on sim.log.", check: () => /sim\.log.*ignored/.test(document.getElementById("tree").textContent.replace(/\n/g, " ")) || document.getElementById("tree").textContent.includes("sim.log") && ignored("logs/sim.log") },
    { id: "find-gitignore", title: "Find .gitignore", prompt: "find the .gitignore file.", hint: ".gitignore", check: () => { doFind(".gitignore"); return lastFind.includes(".gitignore"); } },
    { id: "grep-INFO", title: "grep INFO", prompt: "grep INFO in the project.", hint: "INFO", check: () => { doGrep("INFO"); return lastGrep.includes("sim.log"); } },
    { id: "find-readme", title: "Find README", prompt: "find README.md.", hint: "README", check: () => { doFind("README.md"); return lastFind.trim() === "README.md" || lastFind.includes("README.md"); } },
  ];

  const root = document.getElementById("arch-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> find <code>*.v</code>, then <code>tar czf</code> with ignore rules (skip <code>build/</code> &amp; <code>logs/</code>).</p>
      <button type="button" class="btn btn-secondary" id="arch-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
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
        <div class="panel-head"><h2>Project tree</h2></div>
        <div class="panel-body"><pre class="file-list" id="tree"></pre></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>find / grep</h2></div>
        <div class="panel-body">
          <div class="search-row">
            <input id="find-pat" value="*.v" placeholder="find pattern (e.g. *.v, logs/*)">
            <button type="button" class="btn btn-secondary" id="btn-find">find</button>
          </div>
          <div class="search-row">
            <input id="grep-pat" value="module" placeholder="grep pattern">
            <button type="button" class="btn btn-secondary" id="btn-grep">grep -R</button>
          </div>
          <pre class="file-list" id="search-out"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head">
        <h2>Archive preview</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-primary" id="btn-tar">tar czf (respect ignore)</button>
          <button type="button" class="btn btn-ghost" id="btn-tar-all">tar czf (everything)</button>
        </div>
      </div>
      <div class="panel-body"><pre class="archive-preview" id="archive-out"></pre></div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>sed &amp; diff / patch</h2></div>
      <div class="panel-body">
        <div class="search-row">
          <input id="sed-cmd" value="s/module/MODULE/" placeholder="sed expression">
          <select id="sed-file">
            <option value="src/main.v">src/main.v</option>
            <option value="src/alu.v">src/alu.v</option>
            <option value="docs/notes.md">docs/notes.md</option>
          </select>
          <button type="button" class="btn btn-secondary" id="btn-sed">sed</button>
        </div>
        <div class="search-row">
          <button type="button" class="btn btn-secondary" id="btn-diff">diff main.v vs alu.v</button>
          <button type="button" class="btn btn-ghost" id="btn-patch">apply patch (preview)</button>
        </div>
        <pre class="archive-preview" id="sed-out"></pre>
      </div>
    </div>
  `;

  document.getElementById("tree").textContent = treeText();

  function matchGlob(path, pat) {
    if (pat.includes("*")) {
      const re = new RegExp("^" + pat.split("*").map((s) => s.replace(/[.+^${}()|\\]/g, "\\$&")).join(".*") + "$");
      return re.test(path) || re.test(path.split("/").pop());
    }
    return path.includes(pat);
  }

  function doFind(pat) {
    document.getElementById("find-pat").value = pat;
    const hits = PROJECT.filter((f) => matchGlob(f.path, pat)).map((f) => f.path);
    lastFind = hits.length ? hits.join("\n") : `(no matches for ${pat})`;
    document.getElementById("search-out").textContent = lastFind;
  }

  function doGrep(pat) {
    document.getElementById("grep-pat").value = pat;
    let re;
    try {
      re = new RegExp(pat);
    } catch {
      lastGrep = "invalid regex";
      document.getElementById("search-out").textContent = lastGrep;
      return;
    }
    const hits = [];
    PROJECT.forEach((f) => {
      if (f.content === "(binary)") return;
      f.content.split("\n").forEach((line, n) => {
        if (re.test(line)) hits.push(`${f.path}:${n + 1}:${line}`);
      });
    });
    lastGrep = hits.length ? hits.join("\n") : `(no matches for ${pat})`;
    document.getElementById("search-out").textContent = lastGrep;
  }

  document.getElementById("btn-find").addEventListener("click", () => {
    doFind(document.getElementById("find-pat").value.trim());
  });

  document.getElementById("btn-grep").addEventListener("click", () => {
    doGrep(document.getElementById("grep-pat").value.trim());
  });

  function showArchive(respectIgnore) {
    const packed = PROJECT.filter((f) => (respectIgnore ? !ignored(f.path) : true));
    const skipped = PROJECT.filter((f) => respectIgnore && ignored(f.path));
    const lines = [
      `sample_project.tar.gz  (${packed.length} files)`,
      "",
      ...packed.map((f) => `  keep   ${f.path}  (${f.size} B)`),
    ];
    if (skipped.length) {
      lines.push("", "skipped (ignore rules):");
      skipped.forEach((f) => lines.push(`  skip   ${f.path}`));
    }
    lastArchive = lines.join("\n");
    document.getElementById("archive-out").textContent = lastArchive;
  }

  document.getElementById("btn-tar").addEventListener("click", () => showArchive(true));
  document.getElementById("btn-tar-all").addEventListener("click", () => showArchive(false));

  function fileByPath(p) {
    return PROJECT.find((f) => f.path === p);
  }

  document.getElementById("btn-sed").addEventListener("click", () => {
    const expr = document.getElementById("sed-cmd").value.trim();
    const path = document.getElementById("sed-file").value;
    const f = fileByPath(path);
    const m = expr.match(/^s\/([^/]+)\/([^/]*)\/?$/);
    if (!m || !f) {
      lastSed = "Lab sed supports: s/old/new/";
      document.getElementById("sed-out").textContent = lastSed;
      return;
    }
    const out = f.content.split(m[1]).join(m[2]);
    lastSed = `--- ${path} (sed)\n${out}`;
    document.getElementById("sed-out").textContent = lastSed;
  });

  let lastPatch = "";
  document.getElementById("btn-diff").addEventListener("click", () => {
    const a = fileByPath("src/main.v").content.split("\n");
    const b = fileByPath("src/alu.v").content.split("\n");
    const lines = ["--- src/main.v", "+++ src/alu.v"];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (a[i] === b[i]) continue;
      if (a[i] !== undefined) lines.push("-" + a[i]);
      if (b[i] !== undefined) lines.push("+" + b[i]);
    }
    lastPatch = lines.join("\n");
    lastSed = lastPatch || "(identical)";
    document.getElementById("sed-out").textContent = lastSed;
  });

  document.getElementById("btn-patch").addEventListener("click", () => {
    if (!lastPatch) {
      lastSed = "Run diff first to create a patch preview.";
      document.getElementById("sed-out").textContent = lastSed;
      return;
    }
    const plus = lastPatch
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .map((l) => l.slice(1));
    lastSed = "patch -p0 preview → would write:\n" + (plus.join("\n") || "(no + lines)");
    document.getElementById("sed-out").textContent = lastSed;
  });

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
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  document.getElementById("arch-starter").addEventListener("click", () => {
    doFind("*.v");
    showArchive(true);
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    try {
      ok = !!ch.check();
    } catch {
      ok = false;
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
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    setChalStatus("idle", "Idle");
    renderChallenge();
  });

  showArchive(true);
  doFind("*.v");
  renderChallenge();
})();
