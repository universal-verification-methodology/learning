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

  const root = document.getElementById("arch-root");
  root.innerHTML = `
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

  document.getElementById("btn-find").addEventListener("click", () => {
    const pat = document.getElementById("find-pat").value.trim();
    const hits = PROJECT.filter((f) => matchGlob(f.path, pat)).map((f) => f.path);
    document.getElementById("search-out").textContent =
      hits.length ? hits.join("\n") : `(no matches for ${pat})`;
  });

  document.getElementById("btn-grep").addEventListener("click", () => {
    const pat = document.getElementById("grep-pat").value.trim();
    let re;
    try {
      re = new RegExp(pat);
    } catch {
      document.getElementById("search-out").textContent = "invalid regex";
      return;
    }
    const hits = [];
    PROJECT.forEach((f) => {
      if (f.content === "(binary)") return;
      f.content.split("\n").forEach((line, n) => {
        if (re.test(line)) hits.push(`${f.path}:${n + 1}:${line}`);
      });
    });
    document.getElementById("search-out").textContent =
      hits.length ? hits.join("\n") : `(no matches for ${pat})`;
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
    document.getElementById("archive-out").textContent = lines.join("\n");
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
      document.getElementById("sed-out").textContent = "Lab sed supports: s/old/new/";
      return;
    }
    const out = f.content.split(m[1]).join(m[2]);
    document.getElementById("sed-out").textContent = `--- ${path} (sed)\n${out}`;
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
    document.getElementById("sed-out").textContent = lastPatch || "(identical)";
  });

  document.getElementById("btn-patch").addEventListener("click", () => {
    if (!lastPatch) {
      document.getElementById("sed-out").textContent = "Run diff first to create a patch preview.";
      return;
    }
    const plus = lastPatch
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .map((l) => l.slice(1));
    document.getElementById("sed-out").textContent =
      "patch -p0 preview → would write:\n" + (plus.join("\n") || "(no + lines)");
  });

  showArchive(true);
  document.getElementById("btn-find").click();
})();
