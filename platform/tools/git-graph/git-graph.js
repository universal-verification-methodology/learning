(() => {
  function uid() {
    return Math.random().toString(16).slice(2, 8);
  }

  function freshRepo() {
    const id = uid();
    const files = { "README.md": "# demo\n", "src/main.v": "module main;\nendmodule\n" };
    return {
      commits: {
        [id]: { id, parents: [], message: "init", ts: Date.now(), tree: { ...files } },
      },
      branches: { main: id },
      HEAD: "main",
      detached: null,
      worktree: { ...files },
      staged: {},
      ignore: ["*.log", "build/"],
      stash: [],
      tags: {},
      reflog: [{ id, action: "commit: init" }],
    };
  }

  let repo = freshRepo();

  function headCommit() {
    if (repo.detached) return repo.detached;
    return repo.branches[repo.HEAD];
  }

  function headTree() {
    return { ...(repo.commits[headCommit()]?.tree || {}) };
  }

  function resolveRef(name) {
    if (repo.tags[name]) return repo.tags[name];
    if (repo.branches[name]) return repo.branches[name];
    if (repo.commits[name]) return name;
    return Object.keys(repo.commits).find((id) => id.startsWith(name)) || null;
  }

  function isIgnored(path) {
    return repo.ignore.some((pat) => {
      if (pat.endsWith("/")) return path.startsWith(pat) || path.includes("/" + pat);
      if (pat.startsWith("*.")) return path.endsWith(pat.slice(1));
      return path === pat;
    });
  }

  function status() {
    const head = headTree();
    const staged = [];
    const modified = [];
    const untracked = [];
    const all = new Set([...Object.keys(head), ...Object.keys(repo.worktree), ...Object.keys(repo.staged)]);
    for (const f of [...all].sort()) {
      if (isIgnored(f) && !(f in repo.staged) && !(f in head)) continue;
      const inHead = f in head;
      const inWork = f in repo.worktree;
      const inStage = f in repo.staged;
      if (inStage) {
        if (!inHead || repo.staged[f] !== head[f]) staged.push(f);
        else if (inWork && repo.worktree[f] !== repo.staged[f]) modified.push(f);
      } else if (inWork && inHead && repo.worktree[f] !== head[f]) modified.push(f);
      else if (inWork && !inHead) untracked.push(f);
      else if (!inWork && inHead) modified.push(f + " (deleted)");
    }
    return { staged, modified, untracked };
  }

  function add(path) {
    if (path === "." || path === "-A") {
      Object.keys(repo.worktree).forEach((f) => {
        if (!isIgnored(f)) repo.staged[f] = repo.worktree[f];
      });
      return "staged all";
    }
    if (!(path in repo.worktree) && !(path in headTree())) throw new Error(`pathspec '${path}' did not match`);
    if (path in repo.worktree) repo.staged[path] = repo.worktree[path];
    else delete repo.staged[path];
    return `staged ${path}`;
  }

  function commit(message) {
    const st = status();
    if (!st.staged.length && !Object.keys(repo.staged).length) {
      // allow commit if staged has content vs head
      const head = headTree();
      const changed = Object.keys(repo.staged).some((f) => repo.staged[f] !== head[f]) ||
        Object.keys(head).some((f) => !(f in repo.staged) && Object.keys(repo.staged).length);
      if (!Object.keys(repo.staged).length) throw new Error("nothing to commit (stage with add first)");
      void changed;
    }
    const parent = headCommit();
    const tree = { ...headTree(), ...repo.staged };
    // removals: if staged explicitly? keep simple — staged overlay
    const id = uid();
    repo.commits[id] = {
      id,
      parents: parent ? [parent] : [],
      message: message || "commit",
      ts: Date.now(),
      tree,
    };
    if (repo.detached) repo.detached = id;
    else repo.branches[repo.HEAD] = id;
    repo.staged = {};
    repo.reflog.unshift({ id, action: `commit: ${message || "commit"}` });
    return id;
  }

  function branch(name) {
    if (!name) throw new Error("branch name required");
    if (repo.branches[name]) throw new Error(`branch '${name}' already exists`);
    repo.branches[name] = headCommit();
  }

  function checkout(name) {
    if (repo.branches[name]) {
      repo.HEAD = name;
      repo.detached = null;
      repo.worktree = { ...repo.commits[repo.branches[name]].tree };
      repo.staged = {};
      return;
    }
    const id = resolveRef(name);
    if (!id) throw new Error(`pathspec '${name}' did not match`);
    repo.detached = id;
    repo.HEAD = null;
    repo.worktree = { ...repo.commits[id].tree };
    repo.staged = {};
  }

  function merge(name) {
    const theirs = resolveRef(name);
    if (!theirs) throw new Error(`'${name}' does not resolve to a commit`);
    if (repo.detached) throw new Error("cannot merge in detached HEAD (lab)");
    const ours = repo.branches[repo.HEAD];
    if (ours === theirs) throw new Error("Already up to date.");
    if (isAncestor(ours, theirs)) {
      repo.branches[repo.HEAD] = theirs;
      repo.worktree = { ...repo.commits[theirs].tree };
      return { ff: true, id: theirs };
    }
    if (isAncestor(theirs, ours)) return { ff: true, id: ours, noop: true };
    const id = uid();
    const tree = { ...repo.commits[ours].tree, ...repo.commits[theirs].tree };
    repo.commits[id] = {
      id,
      parents: [ours, theirs],
      message: `Merge branch '${name}' into ${repo.HEAD}`,
      ts: Date.now(),
      tree,
    };
    repo.branches[repo.HEAD] = id;
    repo.worktree = { ...tree };
    repo.staged = {};
    return { ff: false, id };
  }

  function rebase(ontoName) {
    const onto = resolveRef(ontoName);
    if (!onto) throw new Error(`'${ontoName}' does not resolve`);
    if (repo.detached) throw new Error("rebase in detached HEAD not supported in lab");
    const tip = repo.branches[repo.HEAD];
    if (isAncestor(tip, onto) || tip === onto) return { noop: true, id: tip };
    // Lab rebase: replay unique commits from tip onto onto (linearize)
    const oursUnique = [];
    let cur = tip;
    while (cur && cur !== onto && !isAncestor(cur, onto)) {
      const c = repo.commits[cur];
      if (!c || c.parents.length !== 1) break;
      if (isAncestor(c.parents[0], onto) || c.parents[0] === onto) {
        oursUnique.unshift(c);
        break;
      }
      oursUnique.unshift(c);
      cur = c.parents[0];
      if (oursUnique.length > 20) break;
    }
    if (!oursUnique.length) {
      // simple: single new commit on top of onto copying tip tree
      const id = uid();
      repo.commits[id] = {
        id,
        parents: [onto],
        message: repo.commits[tip].message + " (rebased)",
        ts: Date.now(),
        tree: { ...repo.commits[tip].tree },
      };
      repo.branches[repo.HEAD] = id;
      repo.worktree = { ...repo.commits[id].tree };
      return { id, count: 1 };
    }
    let parent = onto;
    let last = onto;
    for (const c of oursUnique) {
      const id = uid();
      repo.commits[id] = {
        id,
        parents: [parent],
        message: c.message,
        ts: Date.now(),
        tree: { ...c.tree },
      };
      parent = id;
      last = id;
    }
    repo.branches[repo.HEAD] = last;
    repo.worktree = { ...repo.commits[last].tree };
    return { id: last, count: oursUnique.length };
  }

  function isAncestor(a, b) {
    const seen = new Set();
    const stack = [b];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === a) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const c = repo.commits[cur];
      if (c) stack.push(...c.parents);
    }
    return false;
  }

  function logList() {
    const start = headCommit();
    const out = [];
    const seen = new Set();
    const stack = [start];
    while (stack.length) {
      const id = stack.shift();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(repo.commits[id]);
      stack.push(...repo.commits[id].parents);
    }
    return out;
  }

  function layout() {
    const depth = {};
    Object.values(repo.commits).forEach((c) => {
      if (!c.parents.length) depth[c.id] = 0;
    });
    let changed = true;
    while (changed) {
      changed = false;
      Object.values(repo.commits).forEach((c) => {
        if (!c.parents.length) return;
        const d = Math.max(...c.parents.map((p) => (depth[p] ?? -1) + 1));
        if (d >= 0 && depth[c.id] !== d) {
          depth[c.id] = d;
          changed = true;
        }
      });
    }
    const byDepth = {};
    Object.keys(repo.commits).forEach((id) => {
      const d = depth[id] ?? 0;
      (byDepth[d] ||= []).push(id);
    });
    const positions = {};
    const maxD = Math.max(0, ...Object.keys(byDepth).map(Number));
    for (let d = 0; d <= maxD; d++) {
      (byDepth[d] || []).forEach((id, i) => {
        positions[id] = { x: 70 + d * 110, y: 60 + i * 70 + (d % 2) * 20 };
      });
    }
    return positions;
  }

  const CLEARED_KEY = "ddv-git-graph-cleared-v1";
  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }
  let challengeIdx = 0;
  let showHint = false;

  function wt(path, content) {
    repo.worktree[path] = content.endsWith("\n") ? content : content + "\n";
  }

  const CHALLENGES = [
    {
      id: "clean-main",
      title: "Clean on main",
      prompt: "Be on <code>main</code> with a clean working tree (use Reset repo if needed).",
      hint: "Reset repo → Check.",
      setup() {
        repo = freshRepo();
      },
      check() {
        const st = status();
        return !repo.detached && repo.HEAD === "main" && !st.staged.length && !st.modified.length && !st.untracked.length;
      },
    },
    {
      id: "modify",
      title: "Modify a file",
      prompt: "Edit <code>src/main.v</code> so it shows as modified (not staged).",
      hint: "Set path to src/main.v, change contents, click edit file.",
      setup() {
        repo = freshRepo();
      },
      check() {
        const st = status();
        return st.modified.includes("src/main.v") && !st.staged.includes("src/main.v");
      },
    },
    {
      id: "stage",
      title: "Stage a change",
      prompt: "Stage the dirty <code>src/main.v</code> (Changes to be committed).",
      hint: "add with path src/main.v",
      setup() {
        repo = freshRepo();
        wt("src/main.v", "module main;\n// dirty\nendmodule\n");
      },
      check() {
        return status().staged.includes("src/main.v");
      },
    },
    {
      id: "commit",
      title: "Commit",
      prompt: "Commit the staged change. Working tree should be clean afterward.",
      hint: "commit with any message.",
      setup() {
        repo = freshRepo();
        wt("src/main.v", "module main;\n// v2\nendmodule\n");
        add("src/main.v");
      },
      check() {
        const st = status();
        return Object.keys(repo.commits).length >= 2 && !st.staged.length && !st.modified.length;
      },
    },
    {
      id: "branch-feature",
      title: "Create feature",
      prompt: "Create a branch named <code>feature</code> (stay on main).",
      hint: "branch-in = feature → branch",
      setup() {
        repo = freshRepo();
      },
      check() {
        return !!repo.branches.feature && repo.HEAD === "main" && !repo.detached;
      },
    },
    {
      id: "checkout-feature",
      title: "Checkout feature",
      prompt: "Switch to the existing <code>feature</code> branch.",
      hint: "checkout feature",
      setup() {
        repo = freshRepo();
        branch("feature");
      },
      check() {
        return repo.HEAD === "feature" && !repo.detached;
      },
    },
    {
      id: "commit-on-feature",
      title: "Commit on feature",
      prompt: "On <code>feature</code>, commit so <code>feature</code> and <code>main</code> point at different commits.",
      hint: "edit → add → commit while on feature.",
      setup() {
        repo = freshRepo();
        branch("feature");
        checkout("feature");
        wt("src/main.v", "module main;\n// feature\nendmodule\n");
        add("src/main.v");
      },
      check() {
        return repo.HEAD === "feature" && repo.branches.feature !== repo.branches.main;
      },
    },
    {
      id: "back-to-main",
      title: "Back to main",
      prompt: "Checkout <code>main</code> from the feature tip.",
      hint: "checkout main",
      setup() {
        repo = freshRepo();
        branch("feature");
        checkout("feature");
        wt("src/main.v", "module main;\n// feat\nendmodule\n");
        add("src/main.v");
        commit("feat work");
      },
      check() {
        return repo.HEAD === "main" && !repo.detached;
      },
    },
    {
      id: "ff-merge",
      title: "Fast-forward merge",
      prompt: "On <code>main</code>, merge <code>feature</code> (should fast-forward).",
      hint: "merge feature while on main.",
      setup() {
        repo = freshRepo();
        branch("feature");
        checkout("feature");
        wt("src/main.v", "module main;\n// ahead\nendmodule\n");
        add("src/main.v");
        commit("ahead on feature");
        checkout("main");
      },
      check() {
        return repo.HEAD === "main" && repo.branches.main === repo.branches.feature;
      },
    },
    {
      id: "untracked",
      title: "Untracked file",
      prompt: "Create an untracked file <code>notes.txt</code> (edit, do not add).",
      hint: "path notes.txt → edit file; leave unstaged.",
      setup() {
        repo = freshRepo();
      },
      check() {
        return status().untracked.includes("notes.txt");
      },
    },
    {
      id: "stage-dot",
      title: "Stage all",
      prompt: "Stage every change with path <code>.</code> (or <code>-A</code>).",
      hint: "file path = . then add",
      setup() {
        repo = freshRepo();
        wt("src/main.v", "module main;\n// a\nendmodule\n");
        wt("notes.txt", "todo\n");
      },
      check() {
        const st = status();
        return st.staged.includes("src/main.v") && st.staged.includes("notes.txt") && !st.untracked.length;
      },
    },
    {
      id: "two-commits",
      title: "Two commits",
      prompt: "Make two new commits on <code>main</code> (repo should have ≥3 commits total).",
      hint: "edit/add/commit twice.",
      setup() {
        repo = freshRepo();
      },
      check() {
        return repo.HEAD === "main" && Object.keys(repo.commits).length >= 3;
      },
    },
    {
      id: "stash",
      title: "Stash WIP",
      prompt: "Stash the dirty working tree so status is clean and stash has an entry.",
      hint: "stash button",
      setup() {
        repo = freshRepo();
        wt("src/main.v", "module main;\n// wip\nendmodule\n");
      },
      check() {
        const st = status();
        return repo.stash.length >= 1 && !st.modified.length && !st.staged.length;
      },
    },
    {
      id: "stash-pop",
      title: "Stash pop",
      prompt: "Pop the stash so <code>src/main.v</code> is modified again and stash is empty.",
      hint: "stash pop",
      setup() {
        repo = freshRepo();
        wt("src/main.v", "module main;\n// wip\nendmodule\n");
        repo.stash.unshift({
          worktree: { ...repo.worktree },
          staged: {},
          msg: "WIP on main",
        });
        repo.worktree = { ...headTree() };
        repo.staged = {};
      },
      check() {
        return !repo.stash.length && status().modified.includes("src/main.v");
      },
    },
    {
      id: "tag",
      title: "Create tag",
      prompt: "Create tag <code>v0.1</code> on HEAD.",
      hint: "tag-in = v0.1 → tag",
      setup() {
        repo = freshRepo();
      },
      check() {
        return repo.tags["v0.1"] === headCommit();
      },
    },
    {
      id: "ignore-pat",
      title: "Ignore pattern",
      prompt: "Add ignore pattern <code>*.vcd</code>.",
      hint: "ignore-in = *.vcd → add ignore",
      setup() {
        repo = freshRepo();
      },
      check() {
        return repo.ignore.includes("*.vcd");
      },
    },
    {
      id: "ignore-hides",
      title: "Ignored untracked",
      prompt: "With <code>*.vcd</code> ignored, create <code>wave.vcd</code> — it must not appear as untracked.",
      hint: "add ignore *.vcd, then edit wave.vcd",
      setup() {
        repo = freshRepo();
      },
      check() {
        return repo.ignore.includes("*.vcd") && "wave.vcd" in repo.worktree && !status().untracked.includes("wave.vcd");
      },
    },
    {
      id: "merge-commit",
      title: "Merge commit",
      prompt: "On <code>main</code>, merge divergent <code>feature</code> so HEAD has two parents.",
      hint: "merge feature (histories already diverge).",
      setup() {
        repo = freshRepo();
        branch("feature");
        checkout("feature");
        wt("src/main.v", "module main;\n// feature side\nendmodule\n");
        add("src/main.v");
        commit("feature change");
        checkout("main");
        wt("README.md", "# demo\nmain line\n");
        add("README.md");
        commit("main change");
      },
      check() {
        const c = repo.commits[headCommit()];
        return repo.HEAD === "main" && c && c.parents.length === 2;
      },
    },
    {
      id: "cherry-pick",
      title: "Cherry-pick",
      prompt: "On <code>main</code>, cherry-pick the tip of <code>feature</code>.",
      hint: "branch-in = feature → cherry-pick",
      setup() {
        repo = freshRepo();
        branch("feature");
        checkout("feature");
        wt("src/main.v", "module main;\n// cherry\nendmodule\n");
        add("src/main.v");
        commit("cherry me");
        checkout("main");
      },
      check() {
        const msgs = logList().map((c) => c.message);
        return repo.HEAD === "main" && msgs.includes("cherry me") && repo.branches.main !== repo.branches.feature;
      },
    },
    {
      id: "rebase-onto",
      title: "Rebase onto main",
      prompt: "On <code>feature</code>, rebase onto <code>main</code> so feature’s tip is a descendant of main.",
      hint: "branch-in = main → rebase onto (while on feature).",
      setup() {
        repo = freshRepo();
        const init = headCommit();
        wt("README.md", "# demo\nmain line\n");
        add("README.md");
        commit("main ahead");
        repo.branches.feature = init;
        checkout("feature");
        wt("src/main.v", "module main;\n// only feature\nendmodule\n");
        add("src/main.v");
        commit("feature tip");
      },
      check() {
        return repo.HEAD === "feature" && isAncestor(repo.branches.main, repo.branches.feature);
      },
    },
    {
      id: "detached",
      title: "Detached HEAD",
      prompt: "Checkout a commit id (not a branch) so HEAD is detached.",
      hint: "Put a commit hash from the graph into branch-in → checkout",
      setup() {
        repo = freshRepo();
        wt("src/main.v", "module main;\n// c2\nendmodule\n");
        add("src/main.v");
        commit("second");
      },
      check() {
        return !!repo.detached;
      },
    },
    {
      id: "reflog",
      title: "Reflog grows",
      prompt: "After at least one new commit, confirm reflog has 2+ entries.",
      hint: "commit once; reflog is listed under status.",
      setup() {
        repo = freshRepo();
      },
      check() {
        return repo.reflog.length >= 2 && Object.keys(repo.commits).length >= 2;
      },
    },
  ];

  const root = document.getElementById("git-root");
  root.innerHTML = `
    <div class="challenge">
      <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <button type="button" class="btn btn-ghost" id="git-reset">Reset challenge</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="tool-layout split-wide">
      <div>
        <div class="git-controls">
          <input id="file-in" placeholder="path" value="src/main.v" style="min-width:110px">
          <input id="content-in" placeholder="new file contents" value="// edited" style="min-width:120px">
          <button type="button" class="btn btn-ghost" id="btn-edit">edit file</button>
          <button type="button" class="btn btn-secondary" id="btn-add">add</button>
          <input id="msg-in" placeholder="commit message" value="work in progress">
          <button type="button" class="btn btn-primary" id="btn-commit">commit</button>
        </div>
        <div class="git-controls">
          <input id="branch-in" placeholder="branch / ref / tag" value="feature">
          <button type="button" class="btn btn-secondary" id="btn-branch">branch</button>
          <button type="button" class="btn btn-secondary" id="btn-checkout">checkout</button>
          <button type="button" class="btn btn-secondary" id="btn-merge">merge</button>
          <button type="button" class="btn btn-secondary" id="btn-rebase">rebase onto</button>
          <button type="button" class="btn btn-ghost" id="btn-cherry">cherry-pick</button>
        </div>
        <div class="git-controls">
          <button type="button" class="btn btn-ghost" id="btn-stash">stash</button>
          <button type="button" class="btn btn-ghost" id="btn-stash-pop">stash pop</button>
          <input id="tag-in" placeholder="tag name" value="v0.1" style="min-width:90px">
          <button type="button" class="btn btn-ghost" id="btn-tag">tag</button>
          <input id="ignore-in" placeholder=".gitignore pattern" value="*.vcd" style="min-width:100px">
          <button type="button" class="btn btn-ghost" id="btn-ignore">add ignore</button>
        </div>
        <p class="msg-box" id="msg-box"></p>
        <div class="git-status" id="git-status"></div>
        <svg id="git-svg" viewBox="0 0 640 340" role="img" aria-label="Commit graph"></svg>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>git log</h2></div>
        <div class="panel-body"><ul class="log-list" id="log-list"></ul></div>
      </div>
    </div>
  `;

  const svg = document.getElementById("git-svg");
  const msgBox = document.getElementById("msg-box");

  function setMsg(text, ok) {
    msgBox.textContent = text || "";
    msgBox.className = "msg-box" + (text ? (ok ? " ok" : " err") : "");
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function statusText() {
    const lines = [];
    if (repo.detached) lines.push(`HEAD detached at ${repo.detached}`);
    else lines.push(`On branch ${repo.HEAD}`);
    const st = status();
    lines.push("", "Changes to be committed:");
    lines.push(st.staged.length ? st.staged.map((f) => "  " + f).join("\n") : "  (none)");
    lines.push("", "Changes not staged:");
    lines.push(st.modified.length ? st.modified.map((f) => "  " + f).join("\n") : "  (none)");
    lines.push("", "Untracked:");
    lines.push(st.untracked.length ? st.untracked.map((f) => "  " + f).join("\n") : "  (none)");
    lines.push("", "Branches:");
    Object.entries(repo.branches).forEach(([name, id]) => {
      const mark = !repo.detached && name === repo.HEAD ? "* " : "  ";
      lines.push(`${mark}${name} → ${id}`);
    });
    lines.push("", `.gitignore: ${repo.ignore.join(", ")}`);
    if (repo.stash.length) lines.push(`stash@{0}: ${repo.stash.length} entr(y/ies)`);
    const tagList = Object.entries(repo.tags);
    if (tagList.length) lines.push("tags: " + tagList.map(([n, id]) => `${n}→${id}`).join(", "));
    lines.push("", "reflog (recent):");
    repo.reflog.slice(0, 5).forEach((e, i) => lines.push(`  HEAD@{${i}} ${e.id} ${e.action}`));
    return lines.join("\n");
  }

  function render() {
    document.getElementById("git-status").textContent = statusText();
    const pos = layout();
    const head = headCommit();
    const edges = [];
    Object.values(repo.commits).forEach((c) => {
      c.parents.forEach((p) => {
        if (pos[p] && pos[c.id]) {
          edges.push(
            `<path class="edge" d="M${pos[p].x + 14},${pos[p].y} C${pos[p].x + 50},${pos[p].y} ${pos[c.id].x - 50},${pos[c.id].y} ${pos[c.id].x - 14},${pos[c.id].y}" />`
          );
        }
      });
    });
    const nodes = Object.values(repo.commits)
      .map((c) => {
        const p = pos[c.id];
        if (!p) return "";
        return `<g class="commit-node${c.id === head ? " head" : ""}" transform="translate(${p.x},${p.y})">
          <circle r="14"></circle>
          <text text-anchor="middle" dy="4">${c.id.slice(0, 4)}</text>
        </g>`;
      })
      .join("");
    const labels = Object.entries(repo.branches)
      .map(([name, id]) => {
        const p = pos[id];
        if (!p) return "";
        const headMark = !repo.detached && name === repo.HEAD ? " (HEAD)" : "";
        return `<text class="branch-label" x="${p.x}" y="${p.y - 24}" text-anchor="middle">${name}${headMark}</text>`;
      })
      .join("");
    svg.innerHTML = edges.join("") + nodes + labels;

    document.getElementById("log-list").innerHTML = logList()
      .map((c) => {
        const tips = Object.entries(repo.branches).filter(([, id]) => id === c.id).map(([n]) => n);
        if (c.id === head) tips.push("HEAD");
        return `<li>
          <div><span class="hash">${c.id}</span> <span class="msg">${escapeHtml(c.message)}</span></div>
          <div class="meta">${tips.length ? tips.join(", ") : "·"} · parents: ${c.parents.join(", ") || "(none)"}</div>
        </li>`;
      })
      .join("");
  }

  function act(fn) {
    try {
      const result = fn();
      setMsg(typeof result === "string" ? result : "ok", true);
      render();
    } catch (e) {
      setMsg(e.message || String(e), false);
    }
  }

  document.getElementById("btn-edit").addEventListener("click", () => {
    act(() => {
      const path = document.getElementById("file-in").value.trim();
      const content = document.getElementById("content-in").value;
      if (!path) throw new Error("path required");
      repo.worktree[path] = content.endsWith("\n") ? content : content + "\n";
      return `edited ${path}`;
    });
  });
  document.getElementById("btn-add").addEventListener("click", () => {
    act(() => add(document.getElementById("file-in").value.trim() || "."));
  });
  document.getElementById("btn-commit").addEventListener("click", () => {
    act(() => {
      const id = commit(document.getElementById("msg-in").value.trim() || "commit");
      return `created ${id}`;
    });
  });
  document.getElementById("btn-branch").addEventListener("click", () => {
    act(() => {
      const name = document.getElementById("branch-in").value.trim();
      branch(name);
      return `branch ${name}`;
    });
  });
  document.getElementById("btn-checkout").addEventListener("click", () => {
    act(() => {
      const name = document.getElementById("branch-in").value.trim();
      checkout(name);
      return `checked out ${name}`;
    });
  });
  document.getElementById("btn-merge").addEventListener("click", () => {
    act(() => {
      const name = document.getElementById("branch-in").value.trim();
      const r = merge(name);
      if (r.noop) return "Already up to date.";
      if (r.ff) return `Fast-forward to ${r.id}`;
      return `Merge commit ${r.id}`;
    });
  });
  document.getElementById("btn-rebase").addEventListener("click", () => {
    act(() => {
      const name = document.getElementById("branch-in").value.trim();
      const r = rebase(name);
      if (r.noop) return "Already up to date.";
      repo.reflog.unshift({ id: r.id, action: `rebase onto ${name}` });
      return `rebased (${r.count || 1} commit(s)) → ${r.id}`;
    });
  });
  document.getElementById("btn-cherry").addEventListener("click", () => {
    act(() => {
      const name = document.getElementById("branch-in").value.trim();
      const src = resolveRef(name);
      if (!src) throw new Error(`'${name}' does not resolve`);
      const c = repo.commits[src];
      const id = uid();
      repo.commits[id] = {
        id,
        parents: [headCommit()],
        message: c.message,
        ts: Date.now(),
        tree: { ...c.tree },
      };
      if (repo.detached) repo.detached = id;
      else repo.branches[repo.HEAD] = id;
      repo.worktree = { ...c.tree };
      repo.reflog.unshift({ id, action: `cherry-pick ${src}` });
      return `cherry-picked ${src} → ${id}`;
    });
  });
  document.getElementById("btn-stash").addEventListener("click", () => {
    act(() => {
      const st = status();
      if (!st.modified.length && !st.untracked.length && !st.staged.length) {
        throw new Error("No local changes to save");
      }
      repo.stash.unshift({
        worktree: { ...repo.worktree },
        staged: { ...repo.staged },
        msg: "WIP on " + (repo.HEAD || "detached"),
      });
      repo.worktree = { ...headTree() };
      repo.staged = {};
      return `Saved working directory (stash@{0})`;
    });
  });
  document.getElementById("btn-stash-pop").addEventListener("click", () => {
    act(() => {
      if (!repo.stash.length) throw new Error("No stash entries");
      const top = repo.stash.shift();
      repo.worktree = { ...top.worktree };
      repo.staged = { ...top.staged };
      return "Dropped stash@{0}";
    });
  });
  document.getElementById("btn-tag").addEventListener("click", () => {
    act(() => {
      const name = document.getElementById("tag-in").value.trim();
      if (!name) throw new Error("tag name required");
      if (repo.tags[name]) throw new Error(`tag '${name}' already exists`);
      repo.tags[name] = headCommit();
      return `tagged ${name} → ${repo.tags[name]}`;
    });
  });
  document.getElementById("btn-ignore").addEventListener("click", () => {
    act(() => {
      const pat = document.getElementById("ignore-in").value.trim();
      if (!pat) throw new Error("pattern required");
      if (!repo.ignore.includes(pat)) repo.ignore.push(pat);
      return `ignore += ${pat}`;
    });
  });
  document.getElementById("git-reset").addEventListener("click", () => {
    applyChallengeSetup();
    setMsg("Challenge reset", true);
    setChalStatus("idle", "Idle");
  });

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function applyChallengeSetup() {
    const ch = CHALLENGES[challengeIdx];
    ch.setup();
    render();
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
        applyChallengeSetup();
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

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
    applyChallengeSetup();
    renderChallenge();
  });

  applyChallengeSetup();
  renderChallenge();
})();
