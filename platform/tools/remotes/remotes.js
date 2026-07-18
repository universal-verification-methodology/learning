(() => {
  const cfg = window.UNIX_GIT_SANDBOX || {
    practiceRepo: "https://github.com/YOUR_ORG/unix-git-practice",
    sharedIpRepo: "https://github.com/YOUR_ORG/unix-git-shared-ip",
    practiceRepoSsh: "git@github.com:YOUR_ORG/unix-git-practice.git",
    sharedIpRepoSsh: "git@github.com:YOUR_ORG/unix-git-shared-ip.git",
    defaultBranch: "main",
  };

  const unpublished =
    /YOUR_ORG/.test(cfg.practiceRepo) ||
    cfg.practiceRepo.includes("YOUR_ORG");

  const STEPS = [
    {
      id: "clone",
      title: "Clone the practice repo (with submodule)",
      body: "Prefer “Use this template” for a writable copy, or clone the org template. Always init submodules.",
      cmd: `# option A — your own copy from the template (GitHub UI: Use this template)\n# option B — clone\ngit clone --recurse-submodules ${cfg.practiceRepo}.git unix-git-practice\ncd unix-git-practice\ngit status\nls external/shared-ip`,
    },
    {
      id: "make",
      title: "Run Make / demo script",
      body: "No EDA tools required — Makefile targets are stubs. Scripts run via bash (no chmod needed).",
      cmd: `cp .env.example .env   # optional\nmake help\nmake test\nbash scripts/run_demo.sh`,
    },
    {
      id: "edit",
      title: "Edit sources in a real editor",
      body: "Use vim, nano, or VS Code on your machine — this closes the “interactive editor” gap.",
      cmd: `# examples\nnano src/main.v\n# or\nvim src/main.v\n# or\ncode .`,
    },
    {
      id: "branch",
      title: "Create a lab branch and commit",
      body: "Keep main clean; work on lab1 (or as assigned).",
      cmd: `git checkout -b lab1\n# edit src/ …\ngit add src/\ngit commit -m "lab1: update main"\ngit log --oneline -3`,
    },
    {
      id: "check",
      title: "Pre-push check",
      body: "Same idea as the browser checklist tool — now against a real tree.",
      cmd: `bash scripts/check_ready.sh`,
    },
    {
      id: "push",
      title: "Push to origin",
      body: "Sets upstream so later git push works (needs your fork/template repo).",
      cmd: `git push -u origin lab1`,
    },
    {
      id: "pr",
      title: "Open a Pull Request",
      body: "On GitHub: compare lab1 → main. Add a short description (lab number + what changed).",
      cmd: `# browser (adjust owner if you used a template/fork)\n${cfg.practiceRepo}/compare/main...lab1?expand=1\n\n# or GitHub CLI\ngh pr create --base main --head lab1 --title "lab1" --body "Practice PR"`,
    },
    {
      id: "submodule",
      title: "Verify shared-ip submodule",
      body: "The template already includes external/shared-ip. If the folder is empty, init it.",
      cmd: `git submodule update --init --recursive\nls external/shared-ip\ncat external/shared-ip/VERSION\nbash scripts/run_demo.sh`,
    },
  ];

  const storageKey = "unix-git-remotes-steps";

  function loadDone() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  function saveDone(map) {
    localStorage.setItem(storageKey, JSON.stringify(map));
  }

  const root = document.getElementById("remotes-root");
  const done = loadDone();

  root.innerHTML = `
    ${
      unpublished
        ? `<div class="warn-banner">
        Sandbox URLs still say <code>YOUR_ORG</code>. Publish
        <code>platform/sandbox/</code> (see <code>PUBLISH.md</code>), then edit
        <code>tools/remotes/config.js</code>.
      </div>`
        : ""
    }
    <div class="repo-banner">
      <div>Practice: <a href="${cfg.practiceRepo}" target="_blank" rel="noopener">${cfg.practiceRepo}</a></div>
      <div style="margin-top:0.35rem">Shared IP: <a href="${cfg.sharedIpRepo}" target="_blank" rel="noopener">${cfg.sharedIpRepo}</a></div>
      <div style="margin-top:0.35rem;color:var(--muted)">SSH: ${cfg.practiceRepoSsh}</div>
    </div>
    <p class="progress" id="progress"></p>
    <ul class="step-list" id="steps"></ul>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Why a real repo?</h2></div>
      <div class="panel-body">
        <ul class="hint-list">
          <li><strong>Remotes / PR</strong> need GitHub (or GitLab) — cannot be faked well in-browser</li>
          <li><strong>Submodules</strong> need two real repositories and a gitlink commit</li>
          <li><strong>Make + .env</strong> run here as stubs; swap in real tools later</li>
          <li><strong>vim/nano</strong> — use your local terminal after clone (step 3)</li>
        </ul>
      </div>
    </div>
  `;

  const list = document.getElementById("steps");
  STEPS.forEach((s, idx) => {
    const li = document.createElement("li");
    if (done[s.id]) li.classList.add("done");
    li.innerHTML = `
      <h3><span>${idx + 1}.</span> ${s.title}</h3>
      <p style="margin:0;color:var(--muted);font-size:0.9rem">${s.body}</p>
      <pre class="cmd-block">${s.cmd.replace(/</g, "&lt;")}</pre>
      <div class="tool-actions" style="margin-top:0.45rem">
        <button type="button" class="btn btn-ghost btn-copy" data-cmd="${encodeURIComponent(s.cmd)}">Copy commands</button>
      </div>
      <label class="check"><input type="checkbox" data-id="${s.id}" ${done[s.id] ? "checked" : ""}> I completed this step</label>
    `;
    list.appendChild(li);
  });

  function refreshProgress() {
    const n = STEPS.filter((s) => done[s.id]).length;
    document.getElementById("progress").textContent = `${n} / ${STEPS.length} steps checked`;
  }

  list.addEventListener("change", (e) => {
    const t = e.target;
    if (!t.dataset.id) return;
    done[t.dataset.id] = t.checked;
    saveDone(done);
    t.closest("li").classList.toggle("done", t.checked);
    refreshProgress();
  });

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-copy");
    if (!btn) return;
    const text = decodeURIComponent(btn.dataset.cmd || "");
    try {
      await navigator.clipboard.writeText(text);
      const prev = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1000);
    } catch {
      btn.textContent = "Copy failed";
    }
  });

  refreshProgress();
})();
