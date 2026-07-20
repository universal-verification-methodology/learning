(() => {
  const PROJECT = [
    { path: "chip/", dir: true },
    { path: "chip/README.md", dir: false },
    { path: "chip/Makefile", dir: false },
    { path: "chip/rtl/", dir: true },
    { path: "chip/rtl/top.v", dir: false },
    { path: "chip/rtl/alu.v", dir: false },
    { path: "chip/tb/", dir: true },
    { path: "chip/tb/tb_top.v", dir: false },
    { path: "chip/docs/", dir: true },
    { path: "chip/docs/spec.md", dir: false },
    { path: "chip/build/", dir: true },
    { path: "chip/build/out.vvp", dir: false },
    { path: "chip/build/wave.vcd", dir: false },
    { path: "chip/logs/", dir: true },
    { path: "chip/logs/sim.log", dir: false },
    { path: "chip/.git/", dir: true },
    { path: "chip/.git/HEAD", dir: false },
  ];

  const CLEARED_KEY = "ddv-zip-vs-tar-cleared-v1";
  const STORE_KEY = "ddv-zip-vs-tar-session-v1";

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
  /** @type {'tar'|'zip'} */
  let format = "tar";
  let archiveName = "chip.tar.gz";
  let excludeBuild = true;
  let excludeLogs = true;
  let excludeGit = true;
  /** @type {string[]} */
  let archived = [];
  let lastCmd = "";
  let lastListed = false;
  let lastChooser = "";
  /** @type {{kind:string,text:string}[]} */
  let screen = [];

  const root = document.getElementById("zt-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Archive <code>chip/</code> as <code>tar.gz</code>,
        excluding <code>build/</code>, <code>logs/</code>, and <code>.git/</code>.
        Compare with <code>zip</code> for sending to Windows teammates.</p>
      <button type="button" class="btn btn-secondary" id="zt-starter">Load starter example</button>
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
      <div class="panel-head"><h2>When to use which</h2></div>
      <div class="panel-body">
        <div class="compare-grid">
          <div class="format-card is-active" id="card-tar" data-fmt="tar">
            <h3>tar.gz</h3>
            <ul>
              <li>Default on Linux / servers / CI</li>
              <li>Preserves Unix modes well</li>
              <li>Common: <code>tar czf</code> / <code>tar xzf</code></li>
            </ul>
            <div class="cmd">tar czf chip.tar.gz --exclude=chip/build chip/</div>
          </div>
          <div class="format-card" id="card-zip" data-fmt="zip">
            <h3>zip</h3>
            <ul>
              <li>Best for cross-platform handoff</li>
              <li>Double-click friendly on Windows/macOS</li>
              <li>Common: <code>zip -r</code> / <code>unzip -l</code></li>
            </ul>
            <div class="cmd">zip -r chip.zip chip -x 'chip/build/*'</div>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Project tree</h2></div>
        <div class="panel-body">
          <div class="exclude-row">
            <label><input type="checkbox" id="ex-build" checked /> exclude build/</label>
            <label><input type="checkbox" id="ex-logs" checked /> exclude logs/</label>
            <label><input type="checkbox" id="ex-git" checked /> exclude .git/</label>
          </div>
          <pre class="tree-view" id="tree-view"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Create &amp; list</h2></div>
        <div class="panel-body">
          <div class="form-row">
            <label>Archive name
              <input type="text" id="arch-name" value="chip.tar.gz" spellcheck="false" />
            </label>
            <button type="button" class="btn btn-primary" id="btn-create">Create archive</button>
            <button type="button" class="btn btn-secondary" id="btn-list">List contents</button>
          </div>
          <pre class="archive-list" id="archive-list"><span class="muted">(no archive yet)</span></pre>
          <p class="meta" id="arch-meta"></p>
          <div class="zt-term">
            <div class="zt-scroll" id="term-scroll"></div>
            <div class="zt-prompt-row">
              <span class="zt-prompt">lab$</span>
              <input class="zt-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="tar czf · tar tzf · zip -r · unzip -l · help"
                aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Scenario chooser</h2></div>
      <div class="panel-body">
        <p style="margin:0 0 0.5rem;font-size:0.9rem;color:var(--muted)">Pick the better format for each situation:</p>
        <div class="chooser" id="chooser"></div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Goal</th><th>tar</th><th>zip</th></tr></thead>
          <tbody>
            <tr><td>Create</td><td><code>tar czf out.tar.gz dir/</code></td><td><code>zip -r out.zip dir</code></td></tr>
            <tr><td>List</td><td><code>tar tzf out.tar.gz</code></td><td><code>unzip -l out.zip</code></td></tr>
            <tr><td>Extract</td><td><code>tar xzf out.tar.gz</code></td><td><code>unzip out.zip</code></td></tr>
            <tr><td>Exclude build</td><td><code>--exclude=dir/build</code></td><td><code>-x 'dir/build/*'</code></td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li><code>c</code>reate · <code>x</code>tract · <code>t</code>list · <code>z</code> gzip · <code>f</code> file</li>
          <li>Never ship <code>build/</code>, huge <code>*.vcd</code>, or <code>.git/</code> unless you mean to.</li>
        </ul>
      </div>
    </div>
  `;

  const treeEl = document.getElementById("tree-view");
  const listEl = document.getElementById("archive-list");
  const metaEl = document.getElementById("arch-meta");
  const nameIn = document.getElementById("arch-name");
  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const cardTar = document.getElementById("card-tar");
  const cardZip = document.getElementById("card-zip");
  const exBuild = document.getElementById("ex-build");
  const exLogs = document.getElementById("ex-logs");
  const exGit = document.getElementById("ex-git");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function isExcluded(path) {
    if (excludeBuild && (path === "chip/build/" || path.startsWith("chip/build/"))) return true;
    if (excludeLogs && (path === "chip/logs/" || path.startsWith("chip/logs/"))) return true;
    if (excludeGit && (path === "chip/.git/" || path.startsWith("chip/.git/"))) return true;
    return false;
  }

  function includedPaths() {
    return PROJECT.map((p) => p.path).filter((p) => !isExcluded(p));
  }

  function syncNameDefault() {
    const want = format === "tar" ? "chip.tar.gz" : "chip.zip";
    if (archiveName === "chip.tar.gz" || archiveName === "chip.zip" || !archiveName) {
      archiveName = want;
      nameIn.value = want;
    }
  }

  function setFormat(fmt) {
    format = fmt;
    cardTar.classList.toggle("is-active", fmt === "tar");
    cardZip.classList.toggle("is-active", fmt === "zip");
    syncNameDefault();
    renderTree();
    saveSession();
  }

  function renderTree() {
    treeEl.innerHTML = PROJECT.map((p) => {
      const ex = isExcluded(p.path);
      const cls = [p.dir ? "dir" : "", ex ? "ex" : "in"].filter(Boolean).join(" ");
      const mark = ex ? " [excluded]" : "";
      return `<span class="${cls}">${escapeHtml(p.path)}${mark}</span>`;
    }).join("\n");
  }

  function renderArchive() {
    if (!archived.length) {
      listEl.innerHTML = `<span class="muted">(no archive yet)</span>`;
      metaEl.textContent = "";
      return;
    }
    listEl.textContent = archived.join("\n");
    metaEl.textContent = `${archiveName} · ${format} · ${archived.length} entries · excluded build=${excludeBuild} logs=${excludeLogs} git=${excludeGit}`;
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
                : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderAll() {
    renderTree();
    renderArchive();
    renderScreen();
  }

  function createArchive() {
    archiveName = nameIn.value.trim() || (format === "tar" ? "chip.tar.gz" : "chip.zip");
    archived = includedPaths();
    const cmd =
      format === "tar"
        ? `tar czf ${archiveName}${excludeBuild ? " --exclude=chip/build" : ""}${excludeLogs ? " --exclude=chip/logs" : ""}${excludeGit ? " --exclude=chip/.git" : ""} chip/`
        : `zip -r ${archiveName} chip${excludeBuild ? " -x 'chip/build/*'" : ""}${excludeLogs ? " -x 'chip/logs/*'" : ""}${excludeGit ? " -x 'chip/.git/*'" : ""}`;
    lastCmd = cmd;
    pushScreen("cmd", cmd);
    pushScreen("muted", `(created ${archiveName} with ${archived.length} paths)`);
    renderAll();
    saveSession();
  }

  function listArchive() {
    if (!archived.length) {
      pushScreen("cmd", format === "tar" ? `tar tzf ${archiveName}` : `unzip -l ${archiveName}`);
      pushScreen("err", "lab: no archive — create first");
      renderScreen();
      return;
    }
    const cmd = format === "tar" ? `tar tzf ${archiveName}` : `unzip -l ${archiveName}`;
    lastCmd = cmd;
    lastListed = true;
    pushScreen("cmd", cmd);
    archived.forEach((p) => pushScreen("out", p));
    renderAll();
    saveSession();
  }

  function fakeRun(raw) {
    const t = raw.trim();
    if (!t) return;
    lastCmd = t;
    pushScreen("cmd", t);

    if (t === "help") {
      pushScreen(
        "out",
        "tar czf NAME DIR · tar tzf NAME · zip -r NAME DIR · unzip -l NAME · help"
      );
      return;
    }

    let m;
    if ((m = t.match(/^tar\s+czf\s+(\S+)\s+(.+)$/))) {
      format = "tar";
      setFormat("tar");
      archiveName = m[1];
      nameIn.value = archiveName;
      // parse excludes
      excludeBuild = /--exclude=chip\/build/.test(t) || /--exclude=build/.test(t);
      excludeLogs = /--exclude=chip\/logs/.test(t);
      excludeGit = /--exclude=chip\/\.git/.test(t) || /--exclude=\.git/.test(t);
      exBuild.checked = excludeBuild;
      exLogs.checked = excludeLogs;
      exGit.checked = excludeGit;
      archived = includedPaths();
      pushScreen("muted", `(created ${archiveName})`);
      return;
    }
    if ((m = t.match(/^tar\s+tzf\s+(\S+)$/))) {
      format = "tar";
      archiveName = m[1];
      lastListed = true;
      if (!archived.length) pushScreen("err", "lab: archive empty — create first");
      else archived.forEach((p) => pushScreen("out", p));
      return;
    }
    if ((m = t.match(/^zip\s+-r\s+(\S+)\s+(\S+)(.*)$/))) {
      format = "zip";
      setFormat("zip");
      archiveName = m[1];
      nameIn.value = archiveName;
      excludeBuild = /-x\s+'chip\/build\/\*'/.test(t) || /build/.test(m[3]);
      excludeLogs = /logs/.test(m[3]);
      excludeGit = /\.git/.test(m[3]);
      // if -x present for build
      if (/-x/.test(t)) {
        excludeBuild = /build/.test(t);
        excludeLogs = /logs/.test(t);
        excludeGit = /\.git/.test(t);
      }
      exBuild.checked = excludeBuild;
      exLogs.checked = excludeLogs;
      exGit.checked = excludeGit;
      archived = includedPaths();
      pushScreen("muted", `(created ${archiveName})`);
      return;
    }
    if ((m = t.match(/^unzip\s+-l\s+(\S+)$/))) {
      format = "zip";
      archiveName = m[1];
      lastListed = true;
      if (!archived.length) pushScreen("err", "lab: archive empty — create first");
      else archived.forEach((p) => pushScreen("out", p));
      return;
    }
    pushScreen("err", "lab: unknown (try help)");
  }

  const SCENARIOS = [
    {
      id: "ci-linux",
      q: "CI artifact on a Linux runner for the next job",
      answer: "tar",
      why: "tar.gz is the Unix/CI default",
    },
    {
      id: "email-win",
      q: "Zip a small deliverable for a Windows teammate to open by double-click",
      answer: "zip",
      why: "zip is the cross-platform handoff format",
    },
    {
      id: "backup-server",
      q: "Nightly backup of a project tree on a Linux server",
      answer: "tar",
      why: "tar.gz + cron is the usual server pattern",
    },
    {
      id: "moodle-upload",
      q: "Course portal that only accepts .zip uploads",
      answer: "zip",
      why: "portal requirement",
    },
  ];

  const chooserEl = document.getElementById("chooser");
  function renderChooser() {
    chooserEl.innerHTML = "";
    SCENARIOS.forEach((s) => {
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "0.35rem";
      const label = document.createElement("div");
      label.style.fontSize = "0.88rem";
      label.style.marginBottom = "0.3rem";
      label.textContent = s.q;
      wrap.appendChild(label);
      ["tar", "zip"].forEach((opt) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = opt === "tar" ? "→ tar.gz" : "→ zip";
        b.style.marginRight = "0.35rem";
        if (lastChooser === `${s.id}:${opt}`) b.classList.add("is-pick");
        b.addEventListener("click", () => {
          lastChooser = `${s.id}:${opt}`;
          setFormat(opt);
          pushScreen("muted", `chooser: ${s.id} → ${opt} (${s.why})`);
          renderChooser();
          renderScreen();
          saveSession();
        });
        wrap.appendChild(b);
      });
      chooserEl.appendChild(wrap);
    });
  }

  function loadStarter() {
    format = "tar";
    archiveName = "chip.tar.gz";
    nameIn.value = archiveName;
    excludeBuild = true;
    excludeLogs = true;
    excludeGit = true;
    exBuild.checked = true;
    exLogs.checked = true;
    exGit.checked = true;
    setFormat("tar");
    screen = [{ kind: "muted", text: "Starter: exclude build/logs/.git, create tar.gz, then list" }];
    createArchive();
    lastChooser = "";
    lastListed = false;
    renderChooser();
    inputEl.focus();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          format,
          archiveName,
          excludeBuild,
          excludeLogs,
          excludeGit,
          archived,
          screen: screen.slice(-40),
          lastCmd,
          lastListed,
          lastChooser,
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
      format = data.format === "zip" ? "zip" : "tar";
      archiveName = data.archiveName || "chip.tar.gz";
      nameIn.value = archiveName;
      excludeBuild = data.excludeBuild !== false;
      excludeLogs = data.excludeLogs !== false;
      excludeGit = data.excludeGit !== false;
      exBuild.checked = excludeBuild;
      exLogs.checked = excludeLogs;
      exGit.checked = excludeGit;
      archived = Array.isArray(data.archived) ? data.archived : [];
      screen = Array.isArray(data.screen) ? data.screen : [];
      lastCmd = data.lastCmd || "";
      lastListed = !!data.lastListed;
      lastChooser = data.lastChooser || "";
      setFormat(format);
      return true;
    } catch {
      return false;
    }
  }

  cardTar.addEventListener("click", () => setFormat("tar"));
  cardZip.addEventListener("click", () => setFormat("zip"));
  [exBuild, exLogs, exGit].forEach((el) => {
    el.addEventListener("change", () => {
      excludeBuild = exBuild.checked;
      excludeLogs = exLogs.checked;
      excludeGit = exGit.checked;
      renderTree();
      saveSession();
    });
  });
  nameIn.addEventListener("input", () => {
    archiveName = nameIn.value;
  });
  document.getElementById("btn-create").addEventListener("click", createArchive);
  document.getElementById("btn-list").addEventListener("click", listArchive);

  const QUICK = [
    { label: "Create tar.gz", fn: () => { setFormat("tar"); createArchive(); } },
    { label: "Create zip", fn: () => { setFormat("zip"); createArchive(); } },
    { label: "List", fn: listArchive },
    { label: "Include build", fn: () => { exBuild.checked = false; excludeBuild = false; renderTree(); } },
  ];
  const quickRow = document.getElementById("quick-row");
  QUICK.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q.label;
    b.addEventListener("click", () => {
      q.fn();
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

  const CHALLENGES = [
    {
      id: "quiz-tar-flags",
      title: "Quiz: czf",
      prompt: "In <code>tar czf</code>, <code>z</code> means? Answer: <code>gzip</code>",
      hint: "compress with gzip",
      type: "text",
      answer: "gzip",
      alt: ["compress", "gzip compress"],
    },
    {
      id: "quiz-t",
      title: "Quiz: tzf",
      prompt: "<code>tar tzf</code> will? Answer: <code>list</code>",
      hint: "t = list / table of contents",
      type: "text",
      answer: "list",
      alt: ["list contents", "table of contents", "show"],
    },
    {
      id: "create-tar",
      title: "Create tar",
      prompt: "Create a <code>tar.gz</code> archive with build/logs/.git excluded.",
      hint: "Select tar.gz card + Create (excludes on)",
      type: "state",
      check: () =>
        format === "tar" &&
        archived.length > 0 &&
        !archived.some((p) => p.startsWith("chip/build/")) &&
        excludeBuild,
    },
    {
      id: "list-tar",
      title: "List archive",
      prompt: "List the archive contents (button or <code>tar tzf</code> / <code>unzip -l</code>).",
      hint: "List contents button",
      type: "state",
      check: () => lastListed && archived.length > 0,
    },
    {
      id: "no-build",
      title: "No build",
      prompt: "With excludes on, is <code>chip/build/out.vvp</code> in the archive? Answer: <code>no</code>",
      hint: "build/ should be excluded",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
      setup: () => {
        excludeBuild = true;
        excludeLogs = true;
        excludeGit = true;
        format = "tar";
        archived = includedPaths();
        renderAll();
      },
    },
    {
      id: "create-zip",
      title: "Create zip",
      prompt: "Switch to zip and create <code>chip.zip</code>.",
      hint: "zip card + Create",
      type: "state",
      check: () => format === "zip" && archiveName.endsWith(".zip") && archived.length > 0,
    },
    {
      id: "quiz-when-zip",
      title: "Quiz: zip when",
      prompt: "Prefer zip for? Answer: <code>cross-platform</code> or <code>windows</code>",
      hint: "Windows / cross-platform handoff",
      type: "text",
      answer: "cross-platform",
      alt: ["windows", "cross platform", "handoff", "mac/windows"],
    },
    {
      id: "quiz-when-tar",
      title: "Quiz: tar when",
      prompt: "Prefer tar.gz for? Answer: <code>linux</code> or <code>ci</code>",
      hint: "Linux / servers / CI",
      type: "text",
      answer: "linux",
      alt: ["ci", "unix", "server", "servers"],
    },
    {
      id: "chooser-ci",
      title: "Chooser CI",
      prompt: "Scenario: CI artifact on Linux — pick tar.gz.",
      hint: "First scenario chooser",
      type: "state",
      check: () => lastChooser === "ci-linux:tar",
    },
    {
      id: "chooser-win",
      title: "Chooser Windows",
      prompt: "Scenario: Windows double-click deliverable — pick zip.",
      hint: "Second scenario",
      type: "state",
      check: () => lastChooser === "email-win:zip",
    },
    {
      id: "include-build-bad",
      title: "Include build?",
      prompt: "Should student submissions usually include build/? Answer: <code>no</code>",
      hint: "Generated artifacts stay out",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "count-with-exclude",
      title: "Count excluded",
      prompt: "Starter excludes: how many paths archived? (number)",
      hint: "Create with all excludes — count list",
      type: "text",
      answer: String(
        PROJECT.filter((p) => {
          const path = p.path;
          if (path.startsWith("chip/build/") || path === "chip/build/") return false;
          if (path.startsWith("chip/logs/") || path === "chip/logs/") return false;
          if (path.startsWith("chip/.git/") || path === "chip/.git/") return false;
          return true;
        }).length
      ),
      setup: () => {
        excludeBuild = excludeLogs = excludeGit = true;
        archived = includedPaths();
        renderAll();
      },
    },
    {
      id: "rtl-included",
      title: "rtl included",
      prompt: "Is <code>chip/rtl/top.v</code> archived with default excludes? Answer: <code>yes</code>",
      hint: "Source stays in",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
      setup: () => {
        excludeBuild = true;
        archived = includedPaths();
      },
    },
    {
      id: "cmd-tar-create",
      title: "tar command",
      prompt: "Run a terminal <code>tar czf …</code> line (or Create on tar) so lastCmd contains <code>tar czf</code>.",
      hint: "Create tar.gz or type tar czf chip.tar.gz chip/",
      type: "state",
      check: () => /tar\s+czf/.test(lastCmd),
    },
    {
      id: "cmd-zip-create",
      title: "zip command",
      prompt: "Create via zip so lastCmd contains <code>zip -r</code>.",
      hint: "zip card + Create",
      type: "state",
      check: () => /zip\s+-r/.test(lastCmd),
    },
    {
      id: "quiz-x",
      title: "Quiz: xzf",
      prompt: "<code>tar xzf</code> will? Answer: <code>extract</code>",
      hint: "x = extract",
      type: "text",
      answer: "extract",
      alt: ["unpack", "unzip"],
    },
    {
      id: "quiz-exclude",
      title: "Quiz: exclude",
      prompt: "tar flag family to skip dirs? Answer: <code>--exclude</code>",
      hint: "--exclude=",
      type: "text",
      answer: "--exclude",
      alt: ["exclude", "--exclude="],
    },
    {
      id: "chooser-backup",
      title: "Chooser backup",
      prompt: "Nightly Linux server backup — pick tar.gz.",
      hint: "Third scenario",
      type: "state",
      check: () => lastChooser === "backup-server:tar",
    },
    {
      id: "chooser-portal",
      title: "Chooser portal",
      prompt: "Portal accepts only .zip — pick zip.",
      hint: "Fourth scenario",
      type: "state",
      check: () => lastChooser === "moodle-upload:zip",
    },
    {
      id: "git-out",
      title: ".git out",
      prompt: "With .git excluded, archive should not contain <code>chip/.git/HEAD</code>.",
      hint: "Keep exclude .git checked, Create",
      type: "state",
      check: () =>
        excludeGit &&
        archived.length > 0 &&
        !archived.includes("chip/.git/HEAD"),
    },
    {
      id: "quiz-f",
      title: "Quiz: f",
      prompt: "In <code>tar czf</code>, <code>f</code> means the next token is the? Answer: <code>file</code>",
      hint: "archive file name",
      type: "text",
      answer: "file",
      alt: ["filename", "archive file", "output file"],
    },
    {
      id: "extension",
      title: "Extension",
      prompt: "Gzip-compressed tar usually ends with? Answer: <code>.tar.gz</code> or <code>.tgz</code>",
      hint: ".tar.gz",
      type: "text",
      answer: ".tar.gz",
      alt: [".tgz", "tar.gz", "tgz"],
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the UI / terminal, then Check.</span>`;
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
        }
        if (typeof CHALLENGES[i].setup === "function" && CHALLENGES[i].type === "text") {
          /* text setup on check */
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

  document.getElementById("zt-starter").addEventListener("click", loadStarter);
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
    renderAll();
    renderChooser();
  }
  renderChallenge();
})();
