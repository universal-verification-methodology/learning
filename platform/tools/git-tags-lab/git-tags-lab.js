(() => {
  const COMMITS = [
    { id: "a8f3c21", msg: "Merge branch 'feature/alu-mul'", date: "2026-07-18" },
    { id: "c4d10aa", msg: "alu: add mul path", date: "2026-07-17" },
    { id: "b2e91d0", msg: "docs: clarify reset polarity", date: "2026-07-16" },
    { id: "d71bb02", msg: "tb: cover alu add/sub", date: "2026-07-15" },
    { id: "e0a11c3", msg: "rtl: wire alu into top", date: "2026-07-14" },
    { id: "f99aa01", msg: "init: skeleton Makefile and rtl", date: "2026-07-10" },
  ];

  function makeStarter() {
    return {
      /** @type {{ name: string, kind: 'lightweight'|'annotated', commit: string, message: string, tagger: string, taggedAt: string }[]} */
      tags: [
        {
          name: "v0.1.0",
          kind: "annotated",
          commit: "e0a11c3",
          message: "First wired ALU release",
          tagger: "Ada <ada@chip.dev>",
          taggedAt: "2026-07-14",
        },
      ],
      selectedCommit: "a8f3c21",
      selectedTag: "v0.1.0",
      nameDraft: "v0.2.0",
      msgDraft: "Mul path release",
      tagger: "Ada <ada@chip.dev>",
      lastAction: "",
      createdLight: false,
      createdAnno: false,
      deleted: false,
      lastDeleted: "",
      pushedTags: false,
      showed: false,
      log: [],
    };
  }

  const CLEARED_KEY = "ddv-git-tags-lab-cleared-v1";
  const STORE_KEY = "ddv-git-tags-lab-session-v1";

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

  const root = document.getElementById("gt-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Annotated release <code>v0.1.0</code> on the wire-alu commit.
        Tip of <code>main</code> is the merge — tag <code>v0.2.0</code> as annotated when you ship mul.</p>
      <button type="button" class="btn btn-secondary" id="gt-starter">Load starter example</button>
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
      <div class="panel-head"><h2>Two kinds of tags</h2></div>
      <div class="panel-body">
        <div class="compare-grid">
          <div class="compare-card light">
            <h3>Lightweight</h3>
            <p><code>git tag name</code> — a name that points at a commit. No message, no tagger object.</p>
          </div>
          <div class="compare-card anno">
            <h3>Annotated</h3>
            <p><code>git tag -a name -m "…"</code> — a real object: tagger, date, message. Prefer for releases.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Commits</h2></div>
        <div class="panel-body">
          <p class="status-row" id="status-row"></p>
          <pre class="commit-list" id="commit-list"></pre>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Create / inspect</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <label for="tag-name">Tag name</label>
            <input id="tag-name" type="text" />
            <label for="tag-msg">Annotation message (<code>-m</code>)</label>
            <input id="tag-msg" type="text" />
          </div>
          <div class="action-grid">
            <button type="button" id="btn-light">git tag &lt;name&gt;  (lightweight)</button>
            <button type="button" id="btn-anno">git tag -a &lt;name&gt; -m "…"  (annotated)</button>
            <button type="button" id="btn-show">git show &lt;tag&gt;</button>
            <button type="button" class="danger" id="btn-delete">git tag -d &lt;tag&gt;</button>
            <button type="button" id="btn-push">git push origin --tags</button>
          </div>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Tags</h3>
          <pre class="tag-list" id="tag-list"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Show</h3>
          <pre class="detail-box" id="detail-box"></pre>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Log</h3>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td><code>git tag v1.0.0</code></td><td>Lightweight on HEAD</td></tr>
            <tr><td><code>git tag -a v1.0.0 -m "…"</code></td><td>Annotated release tag</td></tr>
            <tr><td><code>git tag</code> / <code>git show v1.0.0</code></td><td>List / inspect</td></tr>
            <tr><td><code>git tag -d v1.0.0</code></td><td>Delete local tag</td></tr>
            <tr><td><code>git push origin --tags</code></td><td>Tags are not pushed by default</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Use annotated tags for anything you publish (semver releases).</li>
          <li>Lightweight tags are fine as private bookmarks.</li>
          <li>Moving a published tag is like rewriting history — avoid it.</li>
        </ul>
      </div>
    </div>
  `;

  const commitList = document.getElementById("commit-list");
  const tagList = document.getElementById("tag-list");
  const detailBox = document.getElementById("detail-box");
  const logBox = document.getElementById("log-box");
  const statusRow = document.getElementById("status-row");
  const nameInput = document.getElementById("tag-name");
  const msgInput = document.getElementById("tag-msg");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function findTag(name) {
    return state.tags.find((t) => t.name === name);
  }

  function findCommit(id) {
    return COMMITS.find((c) => c.id === id);
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

  function tagsOn(commitId) {
    return state.tags.filter((t) => t.commit === commitId).map((t) => t.name);
  }

  function renderCommits() {
    commitList.innerHTML = "";
    COMMITS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      const marks = tagsOn(c.id);
      const deco = marks.length
        ? ` <span class="hash">(${marks.join(", ")})</span>`
        : "";
      b.innerHTML = `<span class="hash">${c.id}</span> ${escapeHtml(c.msg)}${deco}`;
      if (c.id === state.selectedCommit) b.classList.add("is-selected");
      b.addEventListener("click", () => {
        state.selectedCommit = c.id;
        renderAll();
      });
      commitList.appendChild(b);
    });
  }

  function renderTags() {
    if (!state.tags.length) {
      tagList.innerHTML = '<span class="empty">(no tags)</span>';
      return;
    }
    const sorted = [...state.tags].sort((a, b) => a.name.localeCompare(b.name));
    tagList.innerHTML = "";
    sorted.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = t.kind === "annotated" ? "anno" : "light";
      if (t.name === state.selectedTag) b.classList.add("is-selected");
      const kind = t.kind === "annotated" ? "annotated" : "lightweight";
      b.textContent = `${t.name}  [${kind} → ${t.commit}]`;
      b.addEventListener("click", () => {
        state.selectedTag = t.name;
        renderDetail();
        saveSession();
        // refresh selection styles
        renderTags();
      });
      tagList.appendChild(b);
    });
  }

  function renderDetail() {
    const t = findTag(state.selectedTag);
    if (!t) {
      detailBox.innerHTML = '<span class="k">(select a tag)</span>';
      return;
    }
    const c = findCommit(t.commit);
    if (t.kind === "lightweight") {
      detailBox.innerHTML = `<span class="light">tag ${escapeHtml(t.name)} (lightweight)</span>
<span class="k">Taggers:</span> (none — name → commit only)
<span class="k">Object:</span> commit ${escapeHtml(t.commit)}
<span class="k">Commit:</span> ${escapeHtml(c ? c.msg : "")}`;
    } else {
      detailBox.innerHTML = `<span class="anno">tag ${escapeHtml(t.name)}</span>
<span class="k">Tagger:</span> ${escapeHtml(t.tagger)}
<span class="k">Date:</span>   ${escapeHtml(t.taggedAt)}

${escapeHtml(t.message)}

<span class="k">commit ${escapeHtml(t.commit)}</span>
${escapeHtml(c ? c.msg : "")}`;
    }
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

  function renderStatus() {
    const light = state.tags.filter((t) => t.kind === "lightweight").length;
    const anno = state.tags.filter((t) => t.kind === "annotated").length;
    statusRow.innerHTML = `<strong>Selected commit</strong> ${escapeHtml(state.selectedCommit)} · tags: ${anno} annotated, ${light} lightweight${
      state.pushedTags ? " · <strong>pushed</strong>" : ""
    }`;
  }

  function renderAll() {
    nameInput.value = state.nameDraft;
    msgInput.value = state.msgDraft;
    renderCommits();
    renderTags();
    renderDetail();
    renderLog();
    renderStatus();
    saveSession();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "load-starter";
    pushLog("muted", "# loaded starter with annotated v0.1.0");
    renderAll();
  }

  function readForm() {
    state.nameDraft = nameInput.value.trim();
    state.msgDraft = msgInput.value.trim();
  }

  function createTag(kind) {
    readForm();
    const name = state.nameDraft;
    if (!name) {
      pushLog("warn", `# need a tag name`);
      state.lastAction = "need-name";
      renderAll();
      return;
    }
    if (findTag(name)) {
      pushLog("err", `# fatal: tag '${name}' already exists`);
      state.lastAction = "dup";
      renderAll();
      return;
    }
    if (kind === "annotated" && !state.msgDraft) {
      pushLog("warn", `# annotated tag needs -m message`);
      state.lastAction = "need-msg";
      renderAll();
      return;
    }
    const tag = {
      name,
      kind,
      commit: state.selectedCommit,
      message: kind === "annotated" ? state.msgDraft : "",
      tagger: kind === "annotated" ? state.tagger : "",
      taggedAt: kind === "annotated" ? "2026-07-20" : "",
    };
    state.tags.push(tag);
    state.selectedTag = name;
    state.lastAction = kind === "annotated" ? "create-anno" : "create-light";
    if (kind === "annotated") state.createdAnno = true;
    else state.createdLight = true;
    if (kind === "lightweight") {
      pushLog("ok", `$ git tag ${name} ${state.selectedCommit}`);
      pushLog("muted", `# lightweight: name → commit only`);
    } else {
      pushLog("ok", `$ git tag -a ${name} -m "${tag.message}" ${state.selectedCommit}`);
      pushLog("muted", `# annotated: tag object with tagger + message`);
    }
    renderAll();
  }

  function doShow() {
    if (!findTag(state.selectedTag)) {
      pushLog("warn", `# no tag selected`);
      state.lastAction = "show-empty";
      renderAll();
      return;
    }
    state.showed = true;
    state.lastAction = "show";
    pushLog("ok", `$ git show ${state.selectedTag}`);
    renderAll();
  }

  function doDelete() {
    const name = state.selectedTag;
    const t = findTag(name);
    if (!t) {
      pushLog("warn", `# nothing to delete`);
      state.lastAction = "delete-empty";
      renderAll();
      return;
    }
    state.tags = state.tags.filter((x) => x.name !== name);
    state.deleted = true;
    state.lastDeleted = name;
    state.lastAction = "delete";
    state.selectedTag = state.tags[0] ? state.tags[0].name : "";
    pushLog("ok", `$ git tag -d ${name}`);
    pushLog("muted", `# deleted local tag (remote unchanged until push delete)`);
    renderAll();
  }

  function doPush() {
    if (!state.tags.length) {
      pushLog("warn", `# no tags to push`);
      state.lastAction = "push-empty";
      renderAll();
      return;
    }
    state.pushedTags = true;
    state.lastAction = "push";
    pushLog("ok", `$ git push origin --tags`);
    pushLog("muted", `# published ${state.tags.length} tag(s) — ordinary git push skips tags`);
    renderAll();
  }

  document.getElementById("btn-light").addEventListener("click", () => createTag("lightweight"));
  document.getElementById("btn-anno").addEventListener("click", () => createTag("annotated"));
  document.getElementById("btn-show").addEventListener("click", doShow);
  document.getElementById("btn-delete").addEventListener("click", doDelete);
  document.getElementById("btn-push").addEventListener("click", doPush);
  document.getElementById("gt-starter").addEventListener("click", loadStarter);
  nameInput.addEventListener("input", () => {
    state.nameDraft = nameInput.value;
    saveSession();
  });
  msgInput.addEventListener("input", () => {
    state.msgDraft = msgInput.value;
    saveSession();
  });

  const CHALLENGES = [
    {
      id: "quiz-light",
      title: "Quiz: light",
      prompt: "A lightweight tag is mainly a? Answer: <code>pointer</code> or <code>name</code>",
      hint: "no tag object",
      type: "text",
      answer: "pointer",
      alt: ["name", "ref", "bookmark", "name pointer"],
    },
    {
      id: "quiz-anno",
      title: "Quiz: annotated",
      prompt: "Annotated tags store tagger + message. Prefer them for? Answer: <code>releases</code>",
      hint: "semver publish",
      type: "text",
      answer: "releases",
      alt: ["release", "semver", "published releases"],
    },
    {
      id: "quiz-flag",
      title: "Quiz: -a",
      prompt: "Flag to create an annotated tag? Answer: <code>-a</code>",
      hint: "git tag -a",
      type: "text",
      answer: "-a",
      alt: ["-a", "--annotate", "tag -a"],
    },
    {
      id: "starter-v01",
      title: "Starter v0.1",
      prompt: "Load starter — <code>v0.1.0</code> is annotated on <code>e0a11c3</code>.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const t = findTag("v0.1.0");
        return t && t.kind === "annotated" && t.commit === "e0a11c3";
      },
    },
    {
      id: "create-v02-anno",
      title: "Annotate v0.2",
      prompt: "Select merge tip <code>a8f3c21</code>, create annotated <code>v0.2.0</code> with the default message.",
      hint: "Select tip → tag -a",
      type: "state",
      setup: () => {
        loadStarter();
        state.selectedCommit = "a8f3c21";
        state.nameDraft = "v0.2.0";
        state.msgDraft = "Mul path release";
        renderAll();
      },
      check: () => {
        const t = findTag("v0.2.0");
        return (
          state.createdAnno &&
          t &&
          t.kind === "annotated" &&
          t.commit === "a8f3c21" &&
          /mul/i.test(t.message)
        );
      },
    },
    {
      id: "create-light",
      title: "Lightweight tip",
      prompt: "Create lightweight tag <code>wip</code> on selected commit (any).",
      hint: "name wip → lightweight button",
      type: "state",
      setup: () => {
        loadStarter();
        state.nameDraft = "wip";
        renderAll();
      },
      check: () => {
        const t = findTag("wip");
        return state.createdLight && t && t.kind === "lightweight";
      },
    },
    {
      id: "need-message",
      title: "Need -m",
      prompt: "Clear message, try annotated tag — lab should require <code>-m</code>.",
      hint: "Empty message → annotated",
      type: "state",
      setup: () => {
        loadStarter();
        state.nameDraft = "v9.9.9";
        state.msgDraft = "";
        renderAll();
      },
      check: () => state.lastAction === "need-msg",
    },
    {
      id: "dup-refuse",
      title: "Dup refused",
      prompt: "Try creating <code>v0.1.0</code> again — should fail already exists.",
      hint: "same name as starter",
      type: "state",
      setup: () => {
        loadStarter();
        state.nameDraft = "v0.1.0";
        state.msgDraft = "dup";
        renderAll();
      },
      check: () => state.lastAction === "dup",
    },
    {
      id: "show-anno",
      title: "Show annotated",
      prompt: "Select <code>v0.1.0</code> and run <strong>git show</strong> — detail lists Tagger.",
      hint: "show button",
      type: "state",
      setup: () => loadStarter(),
      check: () => {
        const t = findTag(state.selectedTag);
        return state.showed && t && t.kind === "annotated" && state.lastAction === "show";
      },
    },
    {
      id: "quiz-push",
      title: "Quiz: push",
      prompt: "Ordinary <code>git push</code> uploads tags? Answer: <code>no</code>",
      hint: "need --tags or explicit ref",
      type: "text",
      answer: "no",
      alt: ["n", "false"],
    },
    {
      id: "do-push",
      title: "Push tags",
      prompt: "Run <strong>git push origin --tags</strong>.",
      hint: "push button",
      type: "state",
      check: () => state.pushedTags && state.lastAction === "push",
    },
    {
      id: "delete-local",
      title: "Delete tag",
      prompt: "Create lightweight <code>tmp</code>, select it, <strong>tag -d</strong>.",
      hint: "create light tmp → delete",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.deleted &&
        state.lastDeleted === "tmp" &&
        !findTag("tmp") &&
        state.lastAction === "delete",
    },
    {
      id: "quiz-show-light",
      title: "Quiz: show light",
      prompt: "Showing a lightweight tag mostly shows the? Answer: <code>commit</code>",
      hint: "no tagger block",
      type: "text",
      answer: "commit",
      alt: ["the commit", "commit object"],
    },
    {
      id: "count-starter",
      title: "Starter count",
      prompt: "Starter has how many tags? (number)",
      hint: "only v0.1.0",
      type: "text",
      answer: "1",
      setup: () => loadStarter(),
    },
    {
      id: "both-kinds",
      title: "Both kinds",
      prompt: "Have at least one lightweight and one annotated tag at once.",
      hint: "starter anno + create wip light",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.tags.some((t) => t.kind === "lightweight") &&
        state.tags.some((t) => t.kind === "annotated"),
    },
    {
      id: "quiz-semver",
      title: "Quiz: semver",
      prompt: "Release tags often look like? Answer: <code>v1.0.0</code>",
      hint: "vMAJOR.MINOR.PATCH",
      type: "text",
      answer: "v1.0.0",
      alt: ["v0.1.0", "semver", "vMAJOR.MINOR.PATCH"],
    },
    {
      id: "tag-old-commit",
      title: "Tag old commit",
      prompt: "Select <code>f99aa01</code> (init), create annotated <code>v0.0.1</code> with any message.",
      hint: "click init commit first",
      type: "state",
      setup: () => {
        loadStarter();
        state.nameDraft = "v0.0.1";
        state.msgDraft = "skeleton snapshot";
        renderAll();
      },
      check: () => {
        const t = findTag("v0.0.1");
        return t && t.kind === "annotated" && t.commit === "f99aa01";
      },
    },
    {
      id: "quiz-move",
      title: "Quiz: move",
      prompt: "Moving a published release tag is usually? Answer: <code>bad</code>",
      hint: "people already fetched it",
      type: "text",
      answer: "bad",
      alt: ["dangerous", "avoid", "no", "unsafe"],
    },
    {
      id: "prefer-anno",
      title: "Prefer annotated",
      prompt: "For a public chip release tag, prefer? Answer: <code>annotated</code>",
      hint: "-a -m",
      type: "text",
      answer: "annotated",
      alt: ["-a", "anno", "annotated tag"],
    },
    {
      id: "light-no-tagger",
      title: "Light no tagger",
      prompt: "Create lightweight <code>bookmark</code>, show it — detail should say no tagger.",
      hint: "light + show",
      type: "state",
      setup: () => {
        loadStarter();
        state.nameDraft = "bookmark";
        renderAll();
      },
      check: () => {
        const t = findTag("bookmark");
        return (
          t &&
          t.kind === "lightweight" &&
          state.showed &&
          state.selectedTag === "bookmark"
        );
      },
    },
    {
      id: "quiz-m",
      title: "Quiz: -m",
      prompt: "Message flag for annotated tags? Answer: <code>-m</code>",
      hint: "git tag -a -m",
      type: "text",
      answer: "-m",
      alt: ["-m", "--message"],
    },
    {
      id: "v02-and-push",
      title: "Ship v0.2",
      prompt: "Create annotated <code>v0.2.0</code> on tip, then push tags.",
      hint: "anno v0.2.0 → push --tags",
      type: "state",
      setup: () => {
        loadStarter();
        state.selectedCommit = "a8f3c21";
        state.nameDraft = "v0.2.0";
        state.msgDraft = "Mul path release";
        renderAll();
      },
      check: () => {
        const t = findTag("v0.2.0");
        return t && t.kind === "annotated" && t.commit === "a8f3c21" && state.pushedTags;
      },
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
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use tag actions, then Check.</span>`;
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
