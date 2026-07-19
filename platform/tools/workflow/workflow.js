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
    { id: "testsPass", label: "Unit / smoke tests pass", good: true },
    { id: "noSecrets", label: "No secrets or .env committed", good: true },
    { id: "fmtOk", label: "Formatter / style check clean", good: true },
    { id: "licenseOk", label: "LICENSE present if required", good: true },
    { id: "submoduleOk", label: "Submodules initialized", good: true },
    { id: "noLarge", label: "No large binaries staged", good: true },
    { id: "msgOk", label: "Commit message is descriptive", good: true },
    { id: "remoteSet", label: "origin remote configured", good: true },
    { id: "aheadOk", label: "Not accidentally force-pushing main", good: true },
    { id: "ciLocal", label: "Local CI script (check_ready) green", good: true },
    { id: "docsOk", label: "Docs updated if API changed", good: true },
    { id: "reviewReady", label: "Self-reviewed diff before push", good: true },
    { id: "envFile", label: ".env.example committed (not .env)", good: true },
    { id: "makeHelp", label: "make help documents targets", good: true },
  ];

  const CLEARED_KEY = "ddv-workflow-cleared-v1";
  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }
  let challengeIdx = 0;
  let showHint = false;

  const CHALLENGES = [
    { id: "all-green", title: "All green", prompt: "Make every flag good, then Run checks — score must be full.", hint: "Set all good.", check: () => FLAGS.every((f) => state[f.id]) },
    { id: "messy-then-fix", title: "Fix messy", prompt: "Click Set messy workspace, then repair until all checks pass.", hint: "Messy then Set all good (or toggle).", check: () => FLAGS.every((f) => state[f.id]) },
    { id: "clean-only", title: "Need clean tree", prompt: "Ensure “Working tree clean” is checked (true).", hint: "Toggle clean on.", check: () => !!state.clean },
    { id: "no-build", title: "No build staged", prompt: "noBuild must be true.", hint: "Toggle noBuild on.", check: () => !!state.noBuild },
    { id: "no-logs", title: "No logs committed", prompt: "noLogs true.", hint: "Toggle noLogs.", check: () => !!state.noLogs },
    { id: "gitignore", title: "gitignore ok", prompt: "gitignore flag true.", hint: "Toggle gitignore.", check: () => !!state.gitignore },
    { id: "script", title: "Script ok", prompt: "scriptOk true (or make test with env).", hint: "Toggle scriptOk or pass make test.", check: () => !!state.scriptOk },
    { id: "branch-lab", title: "On branch", prompt: "branch flag true.", hint: "Toggle branch.", check: () => !!state.branch },
    { id: "secrets", title: "No secrets", prompt: "noSecrets true.", hint: "Toggle noSecrets.", check: () => !!state.noSecrets },
    { id: "submodule", title: "Submodules", prompt: "submoduleOk true.", hint: "Toggle submoduleOk.", check: () => !!state.submoduleOk },
    { id: "remote", title: "Remote set", prompt: "remoteSet true.", hint: "Toggle remoteSet.", check: () => !!state.remoteSet },
    { id: "ci", title: "CI local", prompt: "ciLocal true.", hint: "Toggle ciLocal.", check: () => !!state.ciLocal },
    { id: "review", title: "Self-reviewed", prompt: "reviewReady true.", hint: "Toggle reviewReady.", check: () => !!state.reviewReady },
    { id: "env-example", title: ".env.example", prompt: "envFile true.", hint: "Toggle envFile.", check: () => !!state.envFile },
    { id: "make-help", title: "make help", prompt: "makeHelp true.", hint: "Toggle makeHelp.", check: () => !!state.makeHelp },
    { id: "make-pass", title: "make test pass", prompt: "With env-ok and make-ok checked, run make test so scriptOk becomes true.", hint: "Check both boxes, click make test.", check: () => {
      document.getElementById("env-ok").checked = true;
      document.getElementById("make-ok").checked = true;
      document.getElementById("btn-make").click();
      return !!state.scriptOk;
    }},
    { id: "make-fail", title: "make fails without env", prompt: "Uncheck env-ok, run make test — scriptOk should become false.", hint: "Uncheck env, make test.", check: () => {
      document.getElementById("env-ok").checked = false;
      document.getElementById("make-ok").checked = true;
      document.getElementById("btn-make").click();
      return !state.scriptOk;
    }},
    { id: "dry-clean", title: "Dry-run clean", prompt: "Prefer dry-run, click clean build/ — output mentions dry-run.", hint: "Check Prefer dry-run, then clean.", check: () => {
      document.getElementById("clean-dry").checked = true;
      document.getElementById("btn-clean").click();
      return document.getElementById("make-out").textContent.includes("dry-run");
    }},
    { id: "show-env", title: "Show env", prompt: "With env-ok checked, show env — should mention TOOLS=.", hint: "env-ok on, show env.", check: () => {
      document.getElementById("env-ok").checked = true;
      document.getElementById("btn-env").click();
      return document.getElementById("make-out").textContent.includes("TOOLS=");
    }},
    { id: "score-half", title: "At least half", prompt: "At least half the FLAGS true, then Run checks.", hint: "Set all good is easiest.", check: () => {
      const n = FLAGS.filter((f) => state[f.id]).length;
      return n >= Math.ceil(FLAGS.length / 2);
    }},
    { id: "commits-on", title: "Have commits", prompt: "commits flag true.", hint: "Toggle commits.", check: () => !!state.commits },
    { id: "fmt", title: "Formatter clean", prompt: "fmtOk true.", hint: "Toggle fmtOk.", check: () => !!state.fmtOk },
  ];

  const root = document.getElementById("wf-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Set all good → Run checks → ready to push.</p>
      <button type="button" class="btn btn-secondary" id="wf-starter">Load starter example</button>
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
    state.testsPass = false;
    state.noSecrets = false;
    state.fmtOk = false;
    state.ciLocal = false;
    syncToggles();
    run();
  });

  document.getElementById("btn-make").addEventListener("click", () => {
    const ok = document.getElementById("make-ok").checked && document.getElementById("env-ok").checked;
    document.getElementById("make-out").textContent = ok
      ? "make test\ncc src/main.c -o build/main\n./build/main\nPASS\nmake: exit 0"
      : "make test\nmake: TOOLS not set (source .env)\nmake: *** [test] Error 2";
    state.scriptOk = ok;
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

  document.getElementById("wf-starter").addEventListener("click", () => {
    FLAGS.forEach((f) => {
      state[f.id] = true;
    });
    syncToggles();
    run();
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

  run();
  renderChallenge();
})();
