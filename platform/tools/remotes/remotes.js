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

  const CLEARED_KEY = "ddv-remotes-quiz-cleared-v1";
  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }
  let quizIdx = 0;
  let showHint = false;
  let answerDraft = "";

  /** Concept quiz — live GitHub steps stay manual checklist below. */
  const QUIZ = [
    { id: "remote-is", title: "What is origin?", prompt: "A remote named origin is usually…", hint: "Your GitHub/GitLab copy.", answer: "the default remote pointing at the hosted repo", type: "choice", choices: ["a local branch only", "the default remote pointing at the hosted repo", "a commit hash", "a submodule path"] },
    { id: "clone-recurse", title: "Clone + submodule", prompt: "Best clone flag to fetch submodules too?", hint: "--recurse-submodules", answer: "--recurse-submodules", type: "choice", choices: ["--bare", "--recurse-submodules", "--depth=0", "--orphan"] },
    { id: "upstream-u", title: "First push", prompt: "First push of lab1 that also sets upstream?", hint: "git push -u origin lab1", answer: "git push -u origin lab1", type: "choice", choices: ["git push lab1", "git push -u origin lab1", "git pull origin", "git remote add lab1"] },
    { id: "pr-base", title: "PR base", prompt: "Typical PR for lab1 compares…", hint: "lab1 → main", answer: "lab1 into main", type: "choice", choices: ["main into lab1", "lab1 into main", "origin into HEAD", "tag into stash"] },
    { id: "submodule-empty", title: "Empty submodule", prompt: "external/shared-ip empty after clone — fix with?", hint: "git submodule update --init", answer: "git submodule update --init --recursive", type: "choice", choices: ["git clean -fdx", "git submodule update --init --recursive", "rm -rf .git", "git rebase -i"] },
    { id: "template", title: "Writable copy", prompt: "To get your own writable practice repo from a template…", hint: "Use this template on GitHub", answer: "Use this template / generate your own repo", type: "choice", choices: ["force-push to the org template", "Use this template / generate your own repo", "only shallow clone forever", "delete the remote"] },
    { id: "check-ready", title: "Pre-push", prompt: "scripts/check_ready.sh is meant to run…", hint: "Before push", answer: "before you push / open a PR", type: "choice", choices: ["only on the teacher machine", "before you push / open a PR", "instead of git commit", "after deleting .git"] },
    { id: "ssh-vs-https", title: "SSH URL shape", prompt: "An SSH GitHub URL looks like…", hint: "git@github.com:…", answer: "git@github.com:org/repo.git", type: "choice", choices: ["https:// only forever", "git@github.com:org/repo.git", "ftp://github.com/…", "file:///github"] },
    { id: "branch-lab1", title: "lab1 branch", prompt: "Create and switch to lab1 with…", hint: "checkout -b", answer: "git checkout -b lab1", type: "choice", choices: ["git branch -D lab1", "git checkout -b lab1", "git push lab1", "git stash lab1"] },
    { id: "add-src", title: "Stage sources", prompt: "Stage only sources under src/ …", hint: "git add src/", answer: "git add src/", type: "choice", choices: ["git add build/", "git add src/", "git add -f logs/", "git reset --hard"] },
    { id: "submodule-is", title: "Submodule is", prompt: "A git submodule stores…", hint: "gitlink to another repo", answer: "a pointer (gitlink) to another repository’s commit", type: "choice", choices: ["a full copy of GitHub itself", "a pointer (gitlink) to another repository’s commit", "only .gitignore rules", "a binary blob of Make"] },
    { id: "env-example", title: ".env", prompt: "Usually commit…", hint: ".env.example not secrets", answer: ".env.example (not real secrets in .env)", type: "choice", choices: ["your password in .env", ".env.example (not real secrets in .env)", "only /etc/passwd", "nothing ever"] },
    { id: "make-stub", title: "Make in sandbox", prompt: "In this sandbox, Make targets are…", hint: "stubs / no EDA required", answer: "stubs that don’t need full EDA installs", type: "choice", choices: ["full Synopsys flows only", "stubs that don’t need full EDA installs", "deleted on clone", "replaced by FTP"] },
    { id: "gh-pr", title: "gh pr", prompt: "GitHub CLI create PR roughly…", hint: "gh pr create", answer: "gh pr create --base main --head lab1 …", type: "choice", choices: ["git pr invent", "gh pr create --base main --head lab1 …", "svn commit", "make pr"] },
    { id: "fetch-vs-pull", title: "fetch vs pull", prompt: "git fetch updates…", hint: "remote-tracking refs", answer: "remote-tracking branches without merging", type: "choice", choices: ["only your working tree files", "remote-tracking branches without merging", "deletes all remotes", "creates a PR"] },
    { id: "tracking", title: "Upstream", prompt: "After git push -u, later git push can…", hint: "omit remote/branch", answer: "omit remote/branch names (uses upstream)", type: "choice", choices: ["never work again", "omit remote/branch names (uses upstream)", "only work offline", "require --force always"] },
    { id: "compare-url", title: "Compare URL", prompt: "GitHub compare URL pattern for lab1 PR…", hint: "…/compare/main...lab1", answer: "…/compare/main...lab1", type: "choice", choices: ["…/compare/lab1...lab1", "…/compare/main...lab1", "…/settings only", "…/wiki"] },
    { id: "status-after-clone", title: "After clone", prompt: "Right after a good clone you should see…", hint: "clean status", answer: "a clean working tree on the default branch", type: "choice", choices: ["merge conflicts always", "a clean working tree on the default branch", "no .git directory", "detached forever"] },
    { id: "shared-ip", title: "shared-ip role", prompt: "unix-git-shared-ip in this course is…", hint: "shared submodule content", answer: "shared IP content pulled in as a submodule", type: "choice", choices: ["your private password store", "shared IP content pulled in as a submodule", "a waveform viewer", "a Python venv"] },
    { id: "why-browser-limits", title: "Why real GitHub?", prompt: "This remotes lab uses a real repo because…", hint: "PRs/remotes hard to fake", answer: "remotes, PRs, and submodules need a real host", type: "choice", choices: ["browsers cannot show text", "remotes, PRs, and submodules need a real host", "Make is illegal in browsers", "git cannot run on Linux"] },
    { id: "commit-msg", title: "Commit message", prompt: "A good lab commit message…", hint: "describes the change", answer: "describes what changed (e.g. lab1: update main)", type: "choice", choices: ["is always empty", "describes what changed (e.g. lab1: update main)", "must be a UUID", "must be force"] },
    { id: "dont-force-main", title: "Force push", prompt: "Students should avoid…", hint: "force-push main", answer: "force-pushing to main/shared default branches", type: "choice", choices: ["reading README", "force-pushing to main/shared default branches", "using branches", "running make help"] },
  ];

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
    <div class="challenge">
      <h2>Concept quiz <span id="quiz-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="quiz-prompt"></p>
      <p class="chal-hint" id="quiz-hint" hidden></p>
      <div id="quiz-choices" class="kbd-row" style="margin:0.5rem 0"></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="quiz-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="quiz-check">Check</button>
        <button type="button" class="btn btn-ghost" id="quiz-next">Next</button>
        <span class="challenge-status idle" id="quiz-status">Idle</span>
      </div>
      <div class="kbd-row" id="quiz-catalog" style="margin-top:0.75rem"></div>
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

  function setQuizStatus(kind, msg) {
    const el = document.getElementById("quiz-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderQuiz() {
    const q = QUIZ[quizIdx];
    const cleared = clearedIds.filter((id) => QUIZ.some((c) => c.id === id)).length;
    document.getElementById("quiz-progress").textContent = `${cleared} / ${QUIZ.length} cleared`;
    document.getElementById("quiz-prompt").innerHTML = `<strong>${q.title}:</strong> ${q.prompt}`;
    const hintEl = document.getElementById("quiz-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${q.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("quiz-hint-btn").textContent = showHint ? "Hide hint" : "Show hint";
    const box = document.getElementById("quiz-choices");
    box.innerHTML = "";
    q.choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      if (answerDraft === c) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        answerDraft = c;
        renderQuiz();
      });
      box.appendChild(b);
    });
    const cat = document.getElementById("quiz-catalog");
    cat.innerHTML = "";
    QUIZ.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === quizIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        quizIdx = i;
        showHint = false;
        answerDraft = "";
        setQuizStatus("idle", "Idle");
        renderQuiz();
      });
      cat.appendChild(b);
    });
  }

  document.getElementById("quiz-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderQuiz();
  });
  document.getElementById("quiz-check").addEventListener("click", () => {
    const q = QUIZ[quizIdx];
    if (answerDraft === q.answer) {
      if (!clearedIds.includes(q.id)) {
        clearedIds = [...clearedIds, q.id];
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setQuizStatus("pass", "Pass");
      renderQuiz();
    } else setQuizStatus("fail", "Not yet — pick an answer");
  });
  document.getElementById("quiz-next").addEventListener("click", () => {
    quizIdx = (quizIdx + 1) % QUIZ.length;
    showHint = false;
    answerDraft = "";
    setQuizStatus("idle", "Idle");
    renderQuiz();
  });

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
    document.getElementById("progress").textContent = `${n} / ${STEPS.length} live steps checked · quiz separate above`;
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
  renderQuiz();
})();
