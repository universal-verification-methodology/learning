(() => {
  const FLAGS = [
    { id: "clean", label: "Working tree clean (git status)", good: true },
    { id: "commits", label: "At least one local commit beyond template", good: true },
    { id: "noBuild", label: "No build/ or *.o staged", good: true },
    { id: "noLogs", label: "No logs/*.log committed", good: true },
    { id: "gitignore", label: ".gitignore covers build/ and logs/", good: true },
    { id: "scriptOk", label: "./scripts/run_demo.sh exits 0", good: true },
    { id: "readme", label: "README mentions how to run", good: true },
    { id: "branch", label: "On expected branch (lab1 / main)", good: true },
  ];

  const root = document.getElementById("wf-root");
  root.innerHTML = `
    <div class="challenge">
      <h2>Workspace knobs</h2>
      <p>Toggle the state of your simulated project, then Run checks — fix reds before “push”.</p>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Simulated project state</h2></div>
        <div class="panel-body">
          <div class="toggle-grid" id="toggles"></div>
          <div class="tool-actions">
            <button type="button" class="btn btn-primary" id="btn-check">Run checks</button>
            <button type="button" class="btn btn-ghost" id="btn-good">Set all good</button>
            <button type="button" class="btn btn-ghost" id="btn-messy">Set messy workspace</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>check_ready results</h2></div>
        <div class="panel-body">
          <ul class="check-list" id="results"></ul>
          <p class="score" id="score"></p>
          <p id="push-msg" style="margin:0.75rem 0 0;font-size:0.9rem;color:var(--muted)"></p>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Typical project loop</h2></div>
      <div class="panel-body">
        <ul class="hint-list">
          <li>Edit → <code>./scripts/run_demo.sh 2&gt;&amp;1 | tee logs/run.log</code> → inspect</li>
          <li><code>git add</code> only sources → <code>git commit</code> → re-check</li>
          <li><code>git push -u origin lab1</code> only when checks are green</li>
        </ul>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Make · env · dry-run clean</h2></div>
      <div class="panel-body">
        <div class="toggle-grid" style="margin-bottom:0.75rem">
          <label><input type="checkbox" id="env-ok" checked> <code>.env</code> / env file loaded (TOOLS path set)</label>
          <label><input type="checkbox" id="make-ok" checked> <code>make test</code> exits 0</label>
          <label><input type="checkbox" id="clean-dry"> Prefer dry-run before clean (<code>rm -n</code> / <code>make -n</code>)</label>
        </div>
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="btn-make">make test</button>
          <button type="button" class="btn btn-ghost" id="btn-env">show env</button>
          <button type="button" class="btn btn-ghost" id="btn-clean">clean build/</button>
        </div>
        <pre class="source-pre" id="make-out" style="margin-top:0.75rem;font-family:var(--mono);font-size:0.8rem;background:#eef2f5;padding:0.75rem;border-radius:8px;white-space:pre-wrap"></pre>
      </div>
    </div>
  `;

  // inject make panel styles rely on existing; source-pre may not exist on workflow - using inline style

  const state = {};
  const toggles = document.getElementById("toggles");
  FLAGS.forEach((f) => {
    state[f.id] = f.good;
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" data-id="${f.id}" ${f.good ? "checked" : ""}> ${f.label}`;
    toggles.appendChild(label);
  });

  toggles.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.id) state[t.dataset.id] = t.checked;
  });

  function syncToggles() {
    toggles.querySelectorAll("input").forEach((inp) => {
      inp.checked = !!state[inp.dataset.id];
    });
  }

  function run() {
    const results = FLAGS.map((f) => {
      const ok = !!state[f.id];
      return {
        ...f,
        ok,
        detail: ok
          ? "ok"
          : f.id === "noBuild"
            ? "Remove build artifacts from the index (git restore --staged / fix .gitignore)"
            : f.id === "scriptOk"
              ? "Fix the script or environment until exit code is 0"
              : "Fix before push",
      };
    });
    const el = document.getElementById("results");
    el.innerHTML = results
      .map(
        (r) =>
          `<li class="${r.ok ? "pass" : "fail"}"><span class="icon">${r.ok ? "OK" : "!!"}</span><span><strong>${r.label}</strong><br><span style="color:var(--muted);font-size:0.85rem">${r.detail}</span></span></li>`
      )
      .join("");
    const passed = results.filter((r) => r.ok).length;
    document.getElementById("score").textContent = `${passed} / ${results.length} checks passed`;
    const push = document.getElementById("push-msg");
    if (passed === results.length) {
      push.style.color = "var(--ok)";
      push.textContent = "Ready to push / open PR (lab).";
    } else {
      push.style.color = "var(--err)";
      push.textContent = "Not ready — resolve failing checks first.";
    }
  }

  document.getElementById("btn-check").addEventListener("click", run);
  document.getElementById("btn-good").addEventListener("click", () => {
    FLAGS.forEach((f) => {
      state[f.id] = true;
    });
    syncToggles();
    run();
  });
  document.getElementById("btn-messy").addEventListener("click", () => {
    state.clean = false;
    state.noBuild = false;
    state.noLogs = false;
    state.scriptOk = false;
    state.commits = true;
    state.gitignore = false;
    state.readme = true;
    state.branch = true;
    syncToggles();
    run();
  });

  document.getElementById("btn-make").addEventListener("click", () => {
    const ok = document.getElementById("make-ok").checked && document.getElementById("env-ok").checked;
    document.getElementById("make-out").textContent = ok
      ? "make test\ncc src/main.c -o build/main\n./build/main\nPASS\nmake: exit 0"
      : "make test\nmake: TOOLS not set (source .env)\nmake: *** [test] Error 2";
    if (ok) state.scriptOk = true;
    else state.scriptOk = false;
    syncToggles();
  });
  document.getElementById("btn-env").addEventListener("click", () => {
    document.getElementById("make-out").textContent = document.getElementById("env-ok").checked
      ? "TOOLS=/opt/eda\nPATH=/opt/eda/bin:$PATH\n# from .env / export"
      : "# .env missing — export TOOLS=/opt/eda";
  });
  document.getElementById("btn-clean").addEventListener("click", () => {
    const dry = document.getElementById("clean-dry").checked;
    document.getElementById("make-out").textContent = dry
      ? "rm -rf build/  (dry-run)\nwould remove: build/main.o build/main\n(no files deleted)"
      : "rm -rf build/\nremoved build/";
  });

  run();
})();
