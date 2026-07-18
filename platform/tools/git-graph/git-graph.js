(() => {
  function uid() {
    return Math.random().toString(16).slice(2, 8);
  }

  function freshRepo() {
    const id = uid();
    return {
      commits: {
        [id]: { id, parents: [], message: "init", ts: Date.now() },
      },
      branches: { main: id },
      HEAD: "main",
      detached: null,
    };
  }

  let repo = freshRepo();

  function headCommit() {
    if (repo.detached) return repo.detached;
    return repo.branches[repo.HEAD];
  }

  function resolveRef(name) {
    if (repo.branches[name]) return repo.branches[name];
    if (repo.commits[name]) return name;
    const hit = Object.keys(repo.commits).find((id) => id.startsWith(name));
    return hit || null;
  }

  function commit(message) {
    const parent = headCommit();
    const id = uid();
    repo.commits[id] = {
      id,
      parents: parent ? [parent] : [],
      message: message || "commit",
      ts: Date.now(),
    };
    if (repo.detached) repo.detached = id;
    else repo.branches[repo.HEAD] = id;
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
      return;
    }
    const id = resolveRef(name);
    if (!id) throw new Error(`pathspec '${name}' did not match`);
    repo.detached = id;
    repo.HEAD = null;
  }

  function merge(name) {
    const theirs = resolveRef(name);
    if (!theirs) throw new Error(`'${name}' does not resolve to a commit`);
    if (repo.detached) throw new Error("cannot merge in detached HEAD (lab)");
    const ours = repo.branches[repo.HEAD];
    if (ours === theirs) throw new Error("Already up to date.");
    // Fast-forward if ours is ancestor of theirs
    if (isAncestor(ours, theirs)) {
      repo.branches[repo.HEAD] = theirs;
      return { ff: true, id: theirs };
    }
    // Already contains
    if (isAncestor(theirs, ours)) {
      return { ff: true, id: ours, noop: true };
    }
    const id = uid();
    repo.commits[id] = {
      id,
      parents: [ours, theirs],
      message: `Merge branch '${name}' into ${repo.HEAD}`,
      ts: Date.now(),
    };
    repo.branches[repo.HEAD] = id;
    return { ff: false, id };
  }

  function isAncestor(a, b) {
    // is a an ancestor of b?
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
      const c = repo.commits[id];
      out.push(c);
      stack.push(...c.parents);
    }
    return out;
  }

  /** Simple layered layout by distance from roots */
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
      const row = byDepth[d] || [];
      row.forEach((id, i) => {
        positions[id] = {
          x: 70 + d * 110,
          y: 60 + i * 70 + ((d % 2) * 20),
        };
      });
    }
    return positions;
  }

  const root = document.getElementById("git-root");
  root.innerHTML = `
    <div class="challenge">
      <h2>Lab scenario</h2>
      <p>Create a <code>feature</code> branch, add a commit, checkout <code>main</code>, then merge <code>feature</code>.</p>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="git-reset">Reset repo</button>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div>
        <div class="git-controls">
          <input id="msg-in" placeholder="commit message" value="work in progress">
          <button type="button" class="btn btn-primary" id="btn-commit">commit</button>
          <input id="branch-in" placeholder="branch name" value="feature">
          <button type="button" class="btn btn-secondary" id="btn-branch">branch</button>
          <button type="button" class="btn btn-secondary" id="btn-checkout">checkout</button>
          <button type="button" class="btn btn-secondary" id="btn-merge">merge</button>
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

  function statusText() {
    const lines = [];
    if (repo.detached) {
      lines.push(`HEAD detached at ${repo.detached}`);
    } else {
      lines.push(`On branch ${repo.HEAD}`);
    }
    lines.push("Branches:");
    Object.entries(repo.branches).forEach(([name, id]) => {
      const mark = !repo.detached && name === repo.HEAD ? "* " : "  ";
      lines.push(`${mark}${name} → ${id}`);
    });
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
        const isHead = c.id === head;
        return `<g class="commit-node${isHead ? " head" : ""}" data-id="${c.id}" transform="translate(${p.x},${p.y})">
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

    let detachedLabel = "";
    if (repo.detached && pos[repo.detached]) {
      const p = pos[repo.detached];
      detachedLabel = `<text class="branch-label" x="${p.x}" y="${p.y - 24}" text-anchor="middle">HEAD</text>`;
    }

    svg.innerHTML = edges.join("") + nodes + labels + detachedLabel;

    const log = document.getElementById("log-list");
    log.innerHTML = logList()
      .map((c) => {
        const tips = Object.entries(repo.branches)
          .filter(([, id]) => id === c.id)
          .map(([n]) => n);
        if (c.id === head) tips.push("HEAD");
        return `<li>
          <div><span class="hash">${c.id}</span> <span class="msg">${escapeHtml(c.message)}</span></div>
          <div class="meta">${tips.length ? tips.join(", ") : "·"} · parents: ${c.parents.join(", ") || "(none)"}</div>
        </li>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
      return `branch ${name} at ${repo.branches[name]}`;
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
  document.getElementById("git-reset").addEventListener("click", () => {
    repo = freshRepo();
    setMsg("Repository reset", true);
    render();
  });

  render();
})();
