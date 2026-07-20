(() => {
  /**
   * Lab model (later wins):
   *   defaults → .env → .env.local → shell exports
   * Shell wins over files (common: already-exported vars stick).
   * .env.example is documentation only (not loaded).
   * Commit .env.example; gitignore .env and .env.local.
   */

  const EXAMPLE_TEXT = `# Committed template — safe defaults, no secrets
TOOLS=/opt/eda
SIM=iverilog
WAVE=0
# Copy to .env and fill real values:
# cp .env.example .env
`;

  const ENV_TEXT = `# Local secrets — do NOT commit
TOOLS=/home/lab/eda
SIM=iverilog
WAVE=1
API_TOKEN=sk_lab_secret_do_not_commit
`;

  const LOCAL_TEXT = `# Machine-only overrides (also gitignored)
SIM=verilator
WAVE=0
`;

  const DEFAULTS = {
    TOOLS: "/usr/local",
    SIM: "iverilog",
    WAVE: "0",
  };

  function makeStarter() {
    return {
      files: {
        ".env.example": EXAMPLE_TEXT,
        ".env": ENV_TEXT,
        ".env.local": "",
      },
      localEnabled: false,
      shell: {}, // exported overrides already in process
      gitignoreHasEnv: true,
      envTracked: false,
      exampleTracked: true,
      activeFile: ".env",
      resolved: null,
      sources: null,
      loaded: false,
      lastAction: "",
      copiedExample: false,
      exportedShell: false,
      enabledLocal: false,
      toggledIgnore: false,
      stagedEnv: false,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-env-file-lab-cleared-v1";
  const STORE_KEY = "ddv-env-file-lab-session-v1";

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
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("ef-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Chip project with <code>.env.example</code> (safe),
        <code>.env</code> (secrets), and optional <code>.env.local</code>.
        Load env and watch which layer wins for each key.</p>
      <button type="button" class="btn btn-secondary" id="ef-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Core ideas</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Load order</h3>
            <p>Later wins: defaults → <code>.env</code> → <code>.env.local</code> → shell export.</p>
          </div>
          <div class="idea-card">
            <h3>Commit vs secret</h3>
            <p>Commit <code>.env.example</code>. Gitignore <code>.env</code> / <code>.env.local</code>.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Env files</h2></div>
        <div class="panel-body">
          <div class="file-tabs" id="file-tabs"></div>
          <textarea class="env-editor" id="env-editor" spellcheck="false" aria-label="Env file editor"></textarea>
          <div class="action-grid">
            <button type="button" id="btn-copy-example">cp .env.example .env</button>
            <button type="button" id="btn-toggle-local">Enable / write .env.local</button>
            <button type="button" id="btn-clear-local">Disable .env.local</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Process &amp; resolve</h2></div>
        <div class="panel-body">
          <p class="shell-row" id="shell-row"></p>
          <p class="status-row" id="status-row"></p>
          <div class="action-grid">
            <button type="button" id="btn-export">export TOOLS=/opt/farm</button>
            <button type="button" id="btn-clear-shell">unset shell exports</button>
            <button type="button" id="btn-load">Load / resolve env</button>
            <button type="button" id="btn-toggle-ignore">Toggle .gitignore for .env</button>
            <button type="button" id="btn-stage-env">Simulate git add .env</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Resolved environment</h3>
          <table class="resolved-table">
            <thead><tr><th>Key</th><th>Value</th><th>Source</th></tr></thead>
            <tbody id="resolved-body"></tbody>
          </table>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Git hygiene</h3>
          <pre class="git-box" id="git-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Piece</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>KEY=value</code></td><td>Assignment; no spaces around <code>=</code></td></tr>
            <tr><td><code># comment</code></td><td>Ignored line</td></tr>
            <tr><td><code>.env.example</code></td><td>Safe template — commit it; not auto-loaded</td></tr>
            <tr><td><code>.env</code></td><td>Local secrets — gitignore</td></tr>
            <tr><td><code>.env.local</code></td><td>Machine overrides — later than <code>.env</code></td></tr>
            <tr><td>Shell <code>export</code></td><td>Wins over file values in this lab</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Never put API tokens or passwords in committed files.</li>
          <li>If Make says TOOLS unset, you forgot to load <code>.env</code> (or export).</li>
          <li>Example files document keys; real values live only on the machine.</li>
        </ul>
      </div>
    </div>
  `;

  const editor = document.getElementById("env-editor");
  const resolvedBody = document.getElementById("resolved-body");
  const logBox = document.getElementById("log-box");
  const gitBox = document.getElementById("git-box");
  const shellRow = document.getElementById("shell-row");
  const statusRow = document.getElementById("status-row");
  const fileTabs = document.getElementById("file-tabs");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 50) state.log = state.log.slice(-40);
  }

  function saveSession() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ state, challengeIdx }));
    } catch {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function parseEnvText(text) {
    /** @type {Record<string,string>} */
    const out = {};
    String(text || "")
      .split(/\r?\n/)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) return;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) out[key] = val;
      });
    return out;
  }

  function syncEditorFromState() {
    const name = state.activeFile;
    editor.value = state.files[name] ?? "";
    const editable = name === ".env" || (name === ".env.local" && state.localEnabled);
    editor.disabled = name === ".env.example" || (name === ".env.local" && !state.localEnabled);
    if (!editable && name === ".env.local" && !state.localEnabled) {
      editor.value = "# .env.local disabled — click Enable / write .env.local";
    }
  }

  function flushEditor() {
    const name = state.activeFile;
    if (name === ".env" || (name === ".env.local" && state.localEnabled)) {
      state.files[name] = editor.value;
    }
  }

  function resolve() {
    flushEditor();
    /** @type {Record<string,string>} */
    const resolved = { ...DEFAULTS };
    /** @type {Record<string,string>} */
    const sources = {};
    Object.keys(DEFAULTS).forEach((k) => {
      sources[k] = "default";
    });

    const apply = (map, src) => {
      Object.entries(map).forEach(([k, v]) => {
        resolved[k] = v;
        sources[k] = src;
      });
    };

    apply(parseEnvText(state.files[".env"]), "env");
    if (state.localEnabled && state.files[".env.local"]) {
      apply(parseEnvText(state.files[".env.local"]), "local");
    }
    apply(state.shell, "shell");

    state.resolved = resolved;
    state.sources = sources;
    state.loaded = true;
    return { resolved, sources };
  }

  function hasSecretInResolved() {
    if (!state.resolved) return false;
    return Object.values(state.resolved).some((v) =>
      /secret|sk_|token|password/i.test(String(v))
    );
  }

  function renderTabs() {
    const tabs = [
      { id: ".env.example", label: ".env.example", pill: "commit" },
      { id: ".env", label: ".env", pill: "secret" },
      {
        id: ".env.local",
        label: ".env.local",
        pill: state.localEnabled ? "on" : "off",
      },
    ];
    fileTabs.innerHTML = "";
    tabs.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = t.id === state.activeFile ? "is-active" : "";
      b.innerHTML = `${escapeHtml(t.label)}<span class="pill">${escapeHtml(t.pill)}</span>`;
      b.addEventListener("click", () => {
        flushEditor();
        state.activeFile = t.id;
        syncEditorFromState();
        renderTabs();
        saveSession();
      });
      fileTabs.appendChild(b);
    });
  }

  function renderShell() {
    const keys = Object.keys(state.shell);
    shellRow.innerHTML = keys.length
      ? `<strong>shell exports:</strong> ${keys
          .map((k) => `${escapeHtml(k)}=${escapeHtml(state.shell[k])}`)
          .join(" · ")}`
      : `<strong>shell exports:</strong> <span style="color:var(--muted)">(none)</span>`;
  }

  function renderStatus() {
    statusRow.innerHTML = state.loaded
      ? `<strong>resolved</strong> · later wins: default → .env → .env.local → shell`
      : `<strong>not loaded</strong> — click Load / resolve env`;
  }

  function renderResolved() {
    if (!state.resolved) {
      resolvedBody.innerHTML =
        '<tr><td colspan="3" style="color:var(--muted)">(load to see values)</td></tr>';
      return;
    }
    const keys = Object.keys(state.resolved).sort();
    resolvedBody.innerHTML = keys
      .map((k) => {
        const src = state.sources[k] || "?";
        const val = state.resolved[k];
        const secret = /secret|sk_|token|password/i.test(val);
        return `<tr>
          <td>${escapeHtml(k)}</td>
          <td class="${secret ? "secret" : ""}">${escapeHtml(val)}</td>
          <td class="src-${escapeHtml(src)}">${escapeHtml(src)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderGit() {
    const lines = [];
    lines.push(
      state.exampleTracked
        ? '<span class="ok">.env.example  tracked (good)</span>'
        : '<span class="err">.env.example  not tracked</span>'
    );
    if (state.gitignoreHasEnv) {
      lines.push('<span class="ok">.gitignore     has .env / .env.local</span>');
    } else {
      lines.push('<span class="err">.gitignore     MISSING .env rules</span>');
    }
    if (state.envTracked || state.stagedEnv) {
      lines.push(
        '<span class="err">.env           WOULD BE COMMITTED — secret risk</span>'
      );
    } else if (state.gitignoreHasEnv) {
      lines.push('<span class="ok">.env           ignored (safe)</span>');
    } else {
      lines.push('<span class="err">.env           visible to git (unsafe)</span>');
    }
    if (state.localEnabled) {
      lines.push(
        state.gitignoreHasEnv
          ? '<span class="ok">.env.local     ignored when present</span>'
          : '<span class="err">.env.local     not ignored</span>'
      );
    } else {
      lines.push('<span class="muted">.env.local     (disabled)</span>');
    }
    gitBox.innerHTML = lines.join("\n");
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no actions yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll() {
    renderTabs();
    syncEditorFromState();
    renderShell();
    renderStatus();
    renderResolved();
    renderGit();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# starter: .env.example + .env with API_TOKEN; .env.local off");
    renderAll();
  }

  function doLoad() {
    flushEditor();
    pushLog("muted", "$ load_dotenv  # lab: defaults → .env → .env.local → shell");
    const { resolved, sources } = resolve();
    Object.keys(resolved)
      .sort()
      .forEach((k) => {
        pushLog("run", `${k}=${resolved[k]}  # from ${sources[k]}`);
      });
    if (hasSecretInResolved()) {
      pushLog("warn", "# secret-looking value present in process — keep .env out of git");
    }
    // Note: .env.example is never applied
    pushLog("ok", "# .env.example not loaded (template only)");
    state.lastAction = "load";
    renderAll();
  }

  function copyExample() {
    flushEditor();
    state.files[".env"] = state.files[".env.example"];
    state.copiedExample = true;
    state.activeFile = ".env";
    state.lastAction = "copy-example";
    pushLog("run", "cp .env.example .env");
    pushLog("warn", "# copied template — fill secrets locally; still do not commit .env");
    state.loaded = false;
    state.resolved = null;
    renderAll();
  }

  function enableLocal() {
    flushEditor();
    state.localEnabled = true;
    state.enabledLocal = true;
    if (!state.files[".env.local"] || !state.files[".env.local"].trim()) {
      state.files[".env.local"] = LOCAL_TEXT;
    }
    state.activeFile = ".env.local";
    state.lastAction = "enable-local";
    state.loaded = false;
    state.resolved = null;
    pushLog("ok", "# .env.local enabled (overrides .env)");
    renderAll();
  }

  function clearLocal() {
    flushEditor();
    state.localEnabled = false;
    state.lastAction = "clear-local";
    state.loaded = false;
    state.resolved = null;
    pushLog("muted", "# .env.local disabled");
    renderAll();
  }

  function exportShell() {
    state.shell = { ...state.shell, TOOLS: "/opt/farm" };
    state.exportedShell = true;
    state.lastAction = "export-shell";
    state.loaded = false;
    state.resolved = null;
    pushLog("run", "export TOOLS=/opt/farm");
    renderAll();
  }

  function clearShell() {
    state.shell = {};
    state.lastAction = "clear-shell";
    state.loaded = false;
    state.resolved = null;
    pushLog("muted", "# shell exports cleared");
    renderAll();
  }

  function toggleIgnore() {
    state.gitignoreHasEnv = !state.gitignoreHasEnv;
    state.toggledIgnore = true;
    state.lastAction = "toggle-ignore";
    if (!state.gitignoreHasEnv) {
      pushLog("err", "# .gitignore no longer covers .env — dangerous");
    } else {
      pushLog("ok", "# .gitignore covers .env and .env.local again");
      state.envTracked = false;
      state.stagedEnv = false;
    }
    renderAll();
  }

  function stageEnv() {
    state.stagedEnv = true;
    state.envTracked = true;
    state.lastAction = "stage-env";
    pushLog("err", "git add .env  # BAD — secrets would enter history");
    renderAll();
  }

  editor.addEventListener("input", () => {
    flushEditor();
    state.loaded = false;
    state.resolved = null;
    saveSession();
  });

  document.getElementById("ef-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-copy-example").addEventListener("click", copyExample);
  document.getElementById("btn-toggle-local").addEventListener("click", enableLocal);
  document.getElementById("btn-clear-local").addEventListener("click", clearLocal);
  document.getElementById("btn-export").addEventListener("click", exportShell);
  document.getElementById("btn-clear-shell").addEventListener("click", clearShell);
  document.getElementById("btn-load").addEventListener("click", doLoad);
  document.getElementById("btn-toggle-ignore").addEventListener("click", toggleIgnore);
  document.getElementById("btn-stage-env").addEventListener("click", stageEnv);

  const CHALLENGES = [
    {
      id: "quiz-example",
      title: "Quiz: template",
      prompt: "Which file is the safe committed template? Answer: <code>.env.example</code>",
      hint: "example suffix",
      type: "text",
      answer: ".env.example",
      alt: ["env.example", ".env.example file"],
    },
    {
      id: "quiz-secret-file",
      title: "Quiz: secrets file",
      prompt: "Where do real secrets live locally? Answer: <code>.env</code>",
      hint: "not the example",
      type: "text",
      answer: ".env",
      alt: ["env", "the .env file"],
    },
    {
      id: "quiz-gitignore",
      title: "Quiz: ignore",
      prompt: "Should <code>.env</code> be committed? Answer: <code>no</code>",
      hint: "secrets",
      type: "text",
      answer: "no",
      alt: ["never", "false", "n"],
    },
    {
      id: "quiz-order",
      title: "Quiz: order",
      prompt: "Among files, which wins over <code>.env</code>? Answer: <code>.env.local</code>",
      hint: "machine overrides",
      type: "text",
      answer: ".env.local",
      alt: ["env.local", "local"],
    },
    {
      id: "first-load",
      title: "First load",
      prompt: "Click <strong>Load / resolve env</strong> — see TOOLS from <code>.env</code>.",
      hint: "Load button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.loaded &&
        state.resolved?.TOOLS === "/home/lab/eda" &&
        state.sources?.TOOLS === "env",
    },
    {
      id: "see-secret",
      title: "Spot the secret",
      prompt: "After load, <code>API_TOKEN</code> should come from <code>env</code> (secret-looking).",
      hint: "load starter .env",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.loaded &&
        state.sources?.API_TOKEN === "env" &&
        /secret|sk_/i.test(state.resolved?.API_TOKEN || ""),
    },
    {
      id: "example-not-loaded",
      title: "Example not loaded",
      prompt: "Load env — TOOLS must be from <code>.env</code>, not the example path <code>/opt/eda</code>.",
      hint: "example is docs only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.loaded &&
        state.resolved?.TOOLS === "/home/lab/eda" &&
        state.resolved?.TOOLS !== "/opt/eda",
    },
    {
      id: "local-wins",
      title: "Local wins",
      prompt: "Enable <code>.env.local</code>, load — <code>SIM</code> becomes <code>verilator</code> from local.",
      hint: "Enable local → Load",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.localEnabled &&
        state.loaded &&
        state.resolved?.SIM === "verilator" &&
        state.sources?.SIM === "local",
    },
    {
      id: "shell-wins",
      title: "Shell wins",
      prompt: "Export TOOLS=/opt/farm, then load — TOOLS is <code>/opt/farm</code> from shell.",
      hint: "export → load",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.exportedShell &&
        state.loaded &&
        state.resolved?.TOOLS === "/opt/farm" &&
        state.sources?.TOOLS === "shell",
    },
    {
      id: "copy-example",
      title: "Copy example",
      prompt: "Run <code>cp .env.example .env</code> — <code>.env</code> matches the template (no API_TOKEN).",
      hint: "cp button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        flushEditor();
        return (
          state.copiedExample &&
          !/API_TOKEN/.test(state.files[".env"]) &&
          /TOOLS=\/opt\/eda/.test(state.files[".env"])
        );
      },
    },
    {
      id: "quiz-assign",
      title: "Quiz: syntax",
      prompt: "Correct form? Answer: <code>KEY=value</code>",
      hint: "no spaces",
      type: "text",
      answer: "key=value",
      alt: ["KEY=value", "NAME=value"],
    },
    {
      id: "quiz-comment",
      title: "Quiz: comment",
      prompt: "Comment lines start with? Answer: <code>#</code>",
      hint: "hash",
      type: "text",
      answer: "#",
      alt: ["hash", "# comment"],
    },
    {
      id: "git-safe",
      title: "Git safe",
      prompt: "Starter should show <code>.env</code> ignored and <code>.env.example</code> tracked.",
      hint: "Load starter, read Git hygiene",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.gitignoreHasEnv &&
        state.exampleTracked &&
        !state.envTracked &&
        !state.stagedEnv,
    },
    {
      id: "bad-add",
      title: "Bad git add",
      prompt: "Simulate <code>git add .env</code> — hygiene must show secret risk.",
      hint: "Simulate git add .env",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.stagedEnv && (state.envTracked || state.lastAction === "stage-env"),
    },
    {
      id: "fix-ignore",
      title: "Restore ignore",
      prompt: "Turn ignore off, then toggle back on so <code>.env</code> is ignored again.",
      hint: "Toggle twice ending with ignore on",
      type: "state",
      setup: () => {
        loadStarter();
        state.gitignoreHasEnv = false;
        state.toggledIgnore = false;
        renderAll();
      },
      check: () => state.toggledIgnore && state.gitignoreHasEnv && !state.stagedEnv,
    },
    {
      id: "wave-from-env",
      title: "WAVE from env",
      prompt: "Load starter — <code>WAVE</code> is <code>1</code> from env.",
      hint: "Load",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.loaded && state.resolved?.WAVE === "1" && state.sources?.WAVE === "env",
    },
    {
      id: "local-wave",
      title: "Local WAVE",
      prompt: "Enable local, load — <code>WAVE</code> is <code>0</code> from local.",
      hint: "local overrides WAVE",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.localEnabled &&
        state.loaded &&
        state.resolved?.WAVE === "0" &&
        state.sources?.WAVE === "local",
    },
    {
      id: "quiz-commit-example",
      title: "Quiz: commit example?",
      prompt: "Commit <code>.env.example</code>? Answer: <code>yes</code>",
      hint: "safe template",
      type: "text",
      answer: "yes",
      alt: ["y", "true"],
    },
    {
      id: "edit-sim",
      title: "Edit SIM",
      prompt: "In <code>.env</code>, set <code>SIM=vcs</code>, load — resolved SIM is vcs from env.",
      hint: "edit .env then Load",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        flushEditor();
        return (
          state.loaded &&
          state.resolved?.SIM === "vcs" &&
          state.sources?.SIM === "env"
        );
      },
    },
    {
      id: "clear-local-back",
      title: "Disable local",
      prompt: "Enable local &amp; load, then disable local &amp; load — SIM back to iverilog from env.",
      hint: "enable → load → disable → load",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.enabledLocal &&
        !state.localEnabled &&
        state.loaded &&
        state.resolved?.SIM === "iverilog" &&
        state.sources?.SIM === "env",
    },
    {
      id: "quiz-default",
      title: "Quiz: defaults",
      prompt: "Before files, lab default TOOLS is? Answer: <code>/usr/local</code>",
      hint: "cheat / core defaults",
      type: "text",
      answer: "/usr/local",
      alt: ["usr/local"],
    },
    {
      id: "full-hygiene",
      title: "Full hygiene",
      prompt: "Load env with secret present, keep ignore on, never stage <code>.env</code>.",
      hint: "load starter; don't git add .env",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.loaded &&
        hasSecretInResolved() &&
        state.gitignoreHasEnv &&
        !state.stagedEnv &&
        !state.envTracked,
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use env actions, then Check.</span>`;
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

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
