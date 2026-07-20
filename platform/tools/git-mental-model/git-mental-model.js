(() => {
  const FILE = "rtl/alu.v";

  const CLEAN = "module alu;\n  // add/sub\nendmodule\n";
  const EDIT_A = "module alu;\n  // add/sub + mul\nendmodule\n";
  const EDIT_B = "module alu;\n  // add/sub + mul + div\nendmodule\n";

  function makeStarter() {
    return {
      head: CLEAN,
      index: CLEAN,
      work: CLEAN,
      headId: "c0ffee1",
      headMsg: "alu skeleton",
      commits: 1,
      draft: CLEAN,
      lastAction: "",
      lastFlow: "", // edit | add | commit | restore | unstage
      edited: false,
      added: false,
      committed: false,
      restored: false,
      unstaged: false,
      log: [],
      flash: "", // work | index | head
    };
  }

  const CLEARED_KEY = "ddv-git-mental-model-cleared-v1";
  const STORE_KEY = "ddv-git-mental-model-session-v1";

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
  let flashTimer = 0;

  const root = document.getElementById("mm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Clean tree — <code>${FILE}</code> matches in all three layers.
        Edit the draft, then <code>add</code> and <code>commit</code> to push content toward HEAD.</p>
      <button type="button" class="btn btn-secondary" id="mm-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Three trees</h2></div>
      <div class="panel-body">
        <p class="commit-meta" id="commit-meta"></p>
        <div id="status-pill" class="status-pill clean">clean</div>
        <div class="diagram" id="diagram">
          <div class="box" id="box-work" data-layer="work">
            <h3>Working tree</h3>
            <div class="sub">files on disk · ${FILE}</div>
            <pre id="pre-work"></pre>
          </div>
          <div class="arrow-col">
            <div class="arrow" id="arr-add"><span>→</span><span class="cmd">git add</span></div>
            <div class="arrow" id="arr-restore"><span>←</span><span class="cmd">git restore</span></div>
          </div>
          <div class="box" id="box-index" data-layer="index">
            <h3>Index</h3>
            <div class="sub">staging area · next commit</div>
            <pre id="pre-index"></pre>
          </div>
          <div class="arrow-col">
            <div class="arrow" id="arr-commit"><span>→</span><span class="cmd">git commit</span></div>
            <div class="arrow" id="arr-unstage"><span>←</span><span class="cmd">restore --staged</span></div>
          </div>
          <div class="box" id="box-head" data-layer="head">
            <h3>HEAD</h3>
            <div class="sub">last commit snapshot</div>
            <pre id="pre-head"></pre>
          </div>
        </div>
        <div class="flow-legend">
          <div class="flow-card">
            <h3>Forward (record)</h3>
            <p>Edit disk → <code>add</code> → <code>commit</code></p>
          </div>
          <div class="flow-card">
            <h3>Backward (undo local)</h3>
            <p><code>restore</code> ← index · <code>restore --staged</code> ← HEAD</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Edit working tree</h2></div>
        <div class="panel-body">
          <div class="editor-row">
            <textarea id="draft" spellcheck="false"></textarea>
            <div class="action-grid">
              <button type="button" id="btn-apply-edit">Apply edit → working tree</button>
              <button type="button" id="btn-preset-a">Preset: add mul comment</button>
              <button type="button" id="btn-preset-b">Preset: add mul+div comment</button>
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Move content</h2></div>
        <div class="panel-body">
          <div class="action-grid">
            <button type="button" id="btn-add">git add ${FILE}</button>
            <button type="button" id="btn-commit">git commit -m "…"</button>
            <button type="button" id="btn-restore">git restore ${FILE}</button>
            <button type="button" id="btn-unstage">git restore --staged ${FILE}</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Moves</th></tr></thead>
          <tbody>
            <tr><td>edit file</td><td>changes <strong>working tree</strong> only</td></tr>
            <tr><td><code>git add</code></td><td>working tree → <strong>index</strong></td></tr>
            <tr><td><code>git commit</code></td><td>index → new <strong>HEAD</strong></td></tr>
            <tr><td><code>git restore</code></td><td>index → working tree</td></tr>
            <tr><td><code>git restore --staged</code></td><td>HEAD → index (unstage)</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Commit never reads the working tree directly — only what's in the index.</li>
          <li>“Staged” means index ≠ HEAD. “Modified” means work ≠ index.</li>
          <li>You can be both: staged a chunk, then edited further on disk.</li>
        </ul>
      </div>
    </div>
  `;

  const draftEl = document.getElementById("draft");
  const logBox = document.getElementById("log-box");
  const statusPill = document.getElementById("status-pill");
  const commitMeta = document.getElementById("commit-meta");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function statusKind() {
    const staged = state.index !== state.head;
    const dirty = state.work !== state.index;
    if (!staged && !dirty) return "clean";
    if (staged && dirty) return "both";
    if (staged) return "staged";
    return "modified";
  }

  function statusLabel(kind) {
    if (kind === "clean") return "clean — all three match";
    if (kind === "modified") return "modified — work ≠ index";
    if (kind === "staged") return "staged — index ≠ HEAD";
    return "staged + modified — both diffs";
  }

  function pushLog(kind, text) {
    state.log.push({ kind, text });
    if (state.log.length > 50) state.log = state.log.slice(-40);
  }

  function flashLayer(name) {
    state.flash = name;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      state.flash = "";
      renderDiagram();
    }, 700);
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ state: { ...state, flash: "" }, challengeIdx })
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
      if (!data || !data.state) return false;
      state = { ...makeStarter(), ...data.state, flash: "" };
      challengeIdx = Number(data.challengeIdx) || 0;
      return true;
    } catch {
      return false;
    }
  }

  function setArrowActive(flow) {
    ["arr-add", "arr-restore", "arr-commit", "arr-unstage"].forEach((id) => {
      document.getElementById(id).classList.remove("is-active");
    });
    const map = {
      add: "arr-add",
      restore: "arr-restore",
      commit: "arr-commit",
      unstage: "arr-unstage",
      edit: null,
    };
    const id = map[flow];
    if (id) document.getElementById(id).classList.add("is-active");
  }

  function renderDiagram() {
    document.getElementById("pre-work").textContent = state.work;
    document.getElementById("pre-index").textContent = state.index;
    document.getElementById("pre-head").textContent = state.head;

    const boxWork = document.getElementById("box-work");
    const boxIndex = document.getElementById("box-index");
    const boxHead = document.getElementById("box-head");

    [boxWork, boxIndex, boxHead].forEach((el) => {
      el.classList.remove("is-flash", "is-match", "is-diff");
    });

    boxWork.classList.add(state.work === state.index ? "is-match" : "is-diff");
    boxIndex.classList.add(state.index === state.head ? "is-match" : "is-diff");
    boxHead.classList.add("is-match");

    if (state.flash === "work") boxWork.classList.add("is-flash");
    if (state.flash === "index") boxIndex.classList.add("is-flash");
    if (state.flash === "head") boxHead.classList.add("is-flash");

    setArrowActive(state.lastFlow);
  }

  function renderMeta() {
    commitMeta.innerHTML = `<strong>HEAD</strong> ${escapeHtml(state.headId)} “${escapeHtml(state.headMsg)}”
      · ${state.commits} commit${state.commits === 1 ? "" : "s"} · file <code>${FILE}</code>`;
    const kind = statusKind();
    statusPill.className = "status-pill " + kind;
    statusPill.textContent = statusLabel(kind);
  }

  function renderLog() {
    if (!state.log.length) {
      logBox.innerHTML = '<span class="muted">(no commands yet)</span>';
      return;
    }
    logBox.innerHTML = state.log
      .map((l) => `<span class="${l.kind}">${escapeHtml(l.text)}</span>`)
      .join("\n");
  }

  function renderAll() {
    draftEl.value = state.draft;
    renderDiagram();
    renderMeta();
    renderLog();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# loaded clean starter — three layers identical");
    renderAll();
  }

  function doApplyEdit() {
    state.draft = draftEl.value;
    state.work = state.draft;
    state.edited = true;
    state.lastAction = "edit";
    state.lastFlow = "edit";
    pushLog("ok", `# edited ${FILE} on disk (working tree only)`);
    flashLayer("work");
    renderAll();
  }

  function doAdd() {
    state.index = state.work;
    state.added = true;
    state.lastAction = "add";
    state.lastFlow = "add";
    pushLog("flow", `$ git add ${FILE}`);
    pushLog("muted", `# working tree → index`);
    flashLayer("index");
    renderAll();
  }

  function doCommit() {
    if (state.index === state.head) {
      pushLog("warn", `# nothing to commit — index already matches HEAD`);
      state.lastAction = "commit-noop";
      renderAll();
      return;
    }
    state.head = state.index;
    state.commits += 1;
    state.headId = "c" + (1000 + state.commits).toString(16);
    state.headMsg = state.commits === 2 ? "extend alu" : `update alu #${state.commits}`;
    state.committed = true;
    state.lastAction = "commit";
    state.lastFlow = "commit";
    pushLog("flow", `$ git commit -m "${state.headMsg}"`);
    pushLog("muted", `# index → new HEAD ${state.headId}`);
    flashLayer("head");
    renderAll();
  }

  function doRestore() {
    state.work = state.index;
    state.draft = state.work;
    state.restored = true;
    state.lastAction = "restore";
    state.lastFlow = "restore";
    pushLog("flow", `$ git restore ${FILE}`);
    pushLog("muted", `# index → working tree`);
    flashLayer("work");
    renderAll();
  }

  function doUnstage() {
    state.index = state.head;
    state.unstaged = true;
    state.lastAction = "unstage";
    state.lastFlow = "unstage";
    pushLog("flow", `$ git restore --staged ${FILE}`);
    pushLog("muted", `# HEAD → index (unstage)`);
    flashLayer("index");
    renderAll();
  }

  document.getElementById("btn-apply-edit").addEventListener("click", doApplyEdit);
  document.getElementById("btn-add").addEventListener("click", doAdd);
  document.getElementById("btn-commit").addEventListener("click", doCommit);
  document.getElementById("btn-restore").addEventListener("click", doRestore);
  document.getElementById("btn-unstage").addEventListener("click", doUnstage);
  document.getElementById("btn-preset-a").addEventListener("click", () => {
    draftEl.value = EDIT_A;
    state.draft = EDIT_A;
    saveSession();
  });
  document.getElementById("btn-preset-b").addEventListener("click", () => {
    draftEl.value = EDIT_B;
    state.draft = EDIT_B;
    saveSession();
  });
  draftEl.addEventListener("input", () => {
    state.draft = draftEl.value;
    saveSession();
  });
  document.getElementById("mm-starter").addEventListener("click", loadStarter);

  const CHALLENGES = [
    {
      id: "quiz-three",
      title: "Quiz: three",
      prompt: "Git’s local model has how many “trees”? (number)",
      hint: "working tree, index, HEAD",
      type: "text",
      answer: "3",
      alt: ["three"],
    },
    {
      id: "quiz-index",
      title: "Quiz: index",
      prompt: "The staging area is also called the? Answer: <code>index</code>",
      hint: ".git/index",
      type: "text",
      answer: "index",
      alt: ["the index", "staging area", "stage"],
    },
    {
      id: "quiz-add-dir",
      title: "Quiz: add",
      prompt: "<code>git add</code> copies which way? Answer: <code>work to index</code>",
      hint: "toward the commit",
      type: "text",
      answer: "work to index",
      alt: ["working tree to index", "disk to index", "wt → index", "work → index"],
    },
    {
      id: "quiz-commit-src",
      title: "Quiz: commit",
      prompt: "<code>git commit</code> snapshots which layer? Answer: <code>index</code>",
      hint: "not the working tree directly",
      type: "text",
      answer: "index",
      alt: ["the index", "staging area", "stage"],
    },
    {
      id: "do-edit",
      title: "Edit disk",
      prompt: "Load starter, preset “mul”, Apply edit — working tree ≠ index.",
      hint: "Preset A → Apply edit",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.edited &&
        state.work === EDIT_A &&
        state.work !== state.index &&
        state.index === state.head,
    },
    {
      id: "do-add",
      title: "Stage it",
      prompt: "After editing to mul preset, run <strong>git add</strong> so index matches work.",
      hint: "Apply edit first if needed",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = EDIT_A;
        state.work = EDIT_A;
        state.edited = true;
        renderAll();
      },
      check: () =>
        state.added && state.index === state.work && state.index === EDIT_A && state.index !== state.head,
    },
    {
      id: "do-commit",
      title: "Commit",
      prompt: "Stage mul edit, then <strong>git commit</strong> — all three layers match EDIT_A.",
      hint: "add → commit",
      type: "state",
      setup: () => {
        loadStarter();
        state.draft = EDIT_A;
        state.work = EDIT_A;
        state.index = EDIT_A;
        state.edited = true;
        state.added = true;
        renderAll();
      },
      check: () =>
        state.committed &&
        state.head === EDIT_A &&
        state.index === EDIT_A &&
        state.work === EDIT_A &&
        statusKind() === "clean",
    },
    {
      id: "quiz-modified",
      title: "Quiz: modified",
      prompt: "Modified means? Answer: <code>work != index</code>",
      hint: "unstaged changes",
      type: "text",
      answer: "work != index",
      alt: ["work ≠ index", "working tree != index", "wt != index", "disk != index"],
    },
    {
      id: "quiz-staged",
      title: "Quiz: staged",
      prompt: "Staged means? Answer: <code>index != HEAD</code>",
      hint: "ready for commit",
      type: "text",
      answer: "index != head",
      alt: ["index ≠ head", "index != HEAD", "index ≠ HEAD", "staging != commit"],
    },
    {
      id: "both-diffs",
      title: "Both diffs",
      prompt: "Get status <strong>staged + modified</strong>: stage mul, then apply mul+div edit without re-adding.",
      hint: "add EDIT_A, then apply EDIT_B",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        statusKind() === "both" &&
        state.index === EDIT_A &&
        state.work === EDIT_B &&
        state.head === CLEAN,
    },
    {
      id: "quiz-restore",
      title: "Quiz: restore",
      prompt: "<code>git restore file</code> copies? Answer: <code>index to work</code>",
      hint: "discard unstaged edits",
      type: "text",
      answer: "index to work",
      alt: ["index → work", "index to working tree", "stage to disk"],
    },
    {
      id: "do-restore",
      title: "Restore work",
      prompt: "From starter: edit mul, then <strong>git restore</strong> — work matches clean index again.",
      hint: "Apply edit → restore",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.restored &&
        state.work === state.index &&
        state.work === CLEAN &&
        state.edited,
    },
    {
      id: "quiz-unstage",
      title: "Quiz: unstage",
      prompt: "<code>restore --staged</code> copies? Answer: <code>HEAD to index</code>",
      hint: "unstage without touching worktree (usually)",
      type: "text",
      answer: "head to index",
      alt: ["HEAD to index", "head → index", "commit to index"],
    },
    {
      id: "do-unstage",
      title: "Unstage",
      prompt: "Edit+add mul (leave work=index=EDIT_A), then <strong>restore --staged</strong> — index back to CLEAN, work still EDIT_A.",
      hint: "add then unstage",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.unstaged &&
        state.index === CLEAN &&
        state.head === CLEAN &&
        state.work === EDIT_A,
    },
    {
      id: "commit-ignores-work",
      title: "Commit ignores work",
      prompt: "Stage mul, edit draft to mul+div on disk (don’t add), commit — HEAD should be EDIT_A not EDIT_B.",
      hint: "commit reads index only",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.committed &&
        state.head === EDIT_A &&
        state.work === EDIT_B &&
        state.index === EDIT_A,
    },
    {
      id: "quiz-forward",
      title: "Quiz: forward",
      prompt: "Forward record flow letters E=edit A=add C=commit. Answer: <code>EAC</code>",
      hint: "disk → index → HEAD",
      type: "text",
      answer: "eac",
      alt: ["e-a-c", "edit add commit"],
    },
    {
      id: "noop-commit",
      title: "Noop commit",
      prompt: "On clean starter, click commit — should log “nothing to commit”.",
      hint: "Commit with no staged diff",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "commit-noop" &&
        state.log.some((l) => /nothing to commit/i.test(l.text)),
    },
    {
      id: "full-cycle",
      title: "Full cycle",
      prompt: "Clean → edit mul → add → commit → status clean with HEAD = EDIT_A.",
      hint: "Apply → add → commit",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.edited &&
        state.added &&
        state.committed &&
        statusKind() === "clean" &&
        state.head === EDIT_A,
    },
    {
      id: "quiz-disk",
      title: "Quiz: disk",
      prompt: "Which layer is the files you open in an editor? Answer: <code>working tree</code>",
      hint: "on disk",
      type: "text",
      answer: "working tree",
      alt: ["worktree", "working directory", "work tree", "disk"],
    },
    {
      id: "re-add-after-edit",
      title: "Re-add",
      prompt: "Create staged+modified (mul staged, div on disk), then <strong>git add</strong> so both become EDIT_B staged.",
      hint: "add again after second edit",
      type: "state",
      setup: () => {
        loadStarter();
        state.work = EDIT_B;
        state.index = EDIT_A;
        state.draft = EDIT_B;
        state.edited = true;
        state.added = true;
        renderAll();
      },
      check: () =>
        state.index === EDIT_B &&
        state.work === EDIT_B &&
        state.head === CLEAN &&
        statusKind() === "staged",
    },
    {
      id: "quiz-why-index",
      title: "Quiz: why index",
      prompt: "The index lets you commit? Answer: <code>partial</code> or <code>selected</code> changes",
      hint: "not always the whole file dump from disk",
      type: "text",
      answer: "partial",
      alt: ["selected", "chosen", "partial changes", "selected changes", "hunks"],
    },
    {
      id: "starter-clean",
      title: "Starter clean",
      prompt: "Load starter — all three layers equal CLEAN. Confirm with Check.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.work === CLEAN &&
        state.index === CLEAN &&
        state.head === CLEAN &&
        statusKind() === "clean",
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/≠/g, "!=")
      .replace(/→/g, " to ")
      .replace(/←/g, " to ");
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the diagram actions, then Check.</span>`;
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
    if (typeof ch.setup === "function" && ch.type === "state") ch.setup();
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else renderAll();
  renderChallenge();
})();
