(() => {
  const STARTER = () => ({
    type: "dir",
    mode: 0o755,
    children: {
      home: {
        type: "dir",
        mode: 0o755,
        children: {
          student: {
            type: "dir",
            mode: 0o755,
            children: {
              "notes.txt": { type: "file", mode: 0o644, content: "Welcome to the Unix lab.\nTry: ls, cd, mkdir, touch\n" },
              project: {
                type: "dir",
                mode: 0o755,
                children: {
                  src: {
                    type: "dir",
                    mode: 0o755,
                    children: {
                      "main.v": { type: "file", mode: 0o644, content: "module main;\nendmodule\n" },
                    },
                  },
                  tb: {
                    type: "dir",
                    mode: 0o755,
                    children: {
                      "test_main.v": { type: "file", mode: 0o644, content: "// testbench stub\n" },
                    },
                  },
                  "README.md": {
                    type: "file",
                    mode: 0o644,
                    content: "# Sample project\nRTL under src/, tests under tb/.\n",
                  },
                },
              },
            },
          },
        },
      },
      tmp: { type: "dir", mode: 0o1777, children: {} },
    },
  });

  const CHALLENGES = [
    {
      id: 1,
      title: "Find the RTL",
      prompt: "Navigate into the project src directory and list its files.",
      check: (s) =>
        s.cwd === "/home/student/project/src" && s._lastLs
          ? true
          : "cd into /home/student/project/src and run ls",
    },
    {
      id: 2,
      title: "Make a docs folder",
      prompt: "From your home (~), create a docs directory and a file docs/todo.txt.",
      check: (s) => {
        const docs = resolveNode(s.root, "/home/student/docs");
        const todo = resolveNode(s.root, "/home/student/docs/todo.txt");
        if (docs && docs.type === "dir" && todo && todo.type === "file") return true;
        return "Need /home/student/docs/ and docs/todo.txt";
      },
    },
    {
      id: 3,
      title: "Copy a testbench",
      prompt: "Copy project/tb/test_main.v to /tmp/test_main.v",
      check: (s) => {
        const f = resolveNode(s.root, "/tmp/test_main.v");
        if (f && f.type === "file") return true;
        return "Missing /tmp/test_main.v";
      },
    },
  ];

  const state = {
    root: STARTER(),
    cwd: "/home/student",
    history: [],
    histIdx: -1,
    challengeIdx: 0,
    _lastLs: false,
  };

  function normalize(path) {
    const parts = [];
    for (const p of path.split("/")) {
      if (!p || p === ".") continue;
      if (p === "..") parts.pop();
      else parts.push(p);
    }
    return "/" + parts.join("/");
  }

  function expand(path) {
    if (!path || path === "~") return "/home/student";
    if (path.startsWith("~/")) return "/home/student/" + path.slice(2);
    if (path.startsWith("/")) return normalize(path);
    return normalize(state.cwd + "/" + path);
  }

  function resolveNode(root, absPath) {
    const path = normalize(absPath);
    if (path === "/") return root;
    let node = root;
    for (const part of path.split("/").filter(Boolean)) {
      if (!node || node.type !== "dir" || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  function parentPath(absPath) {
    const n = normalize(absPath);
    if (n === "/") return null;
    const i = n.lastIndexOf("/");
    return i === 0 ? "/" : n.slice(0, i);
  }

  function baseName(absPath) {
    const n = normalize(absPath);
    if (n === "/") return "";
    return n.slice(n.lastIndexOf("/") + 1);
  }

  function modeStr(mode, type) {
    const perms = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    const u = perms[(mode >> 6) & 7];
    const g = perms[(mode >> 3) & 7];
    const o = perms[mode & 7];
    return (type === "dir" ? "d" : "-") + u + g + o;
  }

  function listNames(dir, long) {
    const names = Object.keys(dir.children).sort();
    if (!long) return names.join("  ") || "";
    return names
      .map((n) => {
        const c = dir.children[n];
        return `${modeStr(c.mode, c.type)}  ${n}${c.type === "dir" ? "/" : ""}`;
      })
      .join("\n");
  }

  function renderTree() {
    const lines = ["/"];
    function walk(node, path, depth) {
      if (node.type !== "dir") return;
      Object.keys(node.children)
        .sort()
        .forEach((name) => {
          const child = node.children[name];
          const full = path === "/" ? "/" + name : path + "/" + name;
          const mark = full === state.cwd ? "  <- cwd" : "";
          const prefix = child.type === "dir" ? "[dir]  " : "[file] ";
          lines.push("  ".repeat(depth) + prefix + name + mark);
          if (child.type === "dir") walk(child, full, depth + 1);
        });
    }
    walk(state.root, "/", 1);
    return lines.join("\n");
  }

  function ensureDir(absPath) {
    const path = normalize(absPath);
    if (path === "/") return state.root;
    const parts = path.split("/").filter(Boolean);
    let node = state.root;
    for (const part of parts) {
      if (!node.children[part]) {
        node.children[part] = { type: "dir", mode: 0o755, children: {} };
      }
      node = node.children[part];
      if (node.type !== "dir") throw new Error(`Not a directory: ${part}`);
    }
    return node;
  }

  function run(line) {
    state._lastLs = false;
    const trimmed = line.trim();
    if (!trimmed) return { out: "" };
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const tokens = parts.map((t) => t.replace(/^"|"$/g, ""));
    const cmd = tokens[0];
    const args = tokens.slice(1);

    try {
      switch (cmd) {
        case "help":
          return {
            out: [
              "Lab commands:",
              "  pwd · ls [-l] [path] · cd [path] · mkdir [-p] path",
              "  touch path · cat path · cp src dst · mv src dst · rm [-r] path",
              "  tree · clear · help · challenge",
            ].join("\n"),
          };
        case "pwd":
          return { out: state.cwd };
        case "clear":
          return { clear: true, out: "" };
        case "cd": {
          const target = expand(args[0] || "~");
          const node = resolveNode(state.root, target);
          if (!node) return { out: `cd: no such file or directory: ${args[0] || "~"}`, err: true };
          if (node.type !== "dir") return { out: `cd: not a directory: ${args[0]}`, err: true };
          state.cwd = normalize(target);
          return { out: "" };
        }
        case "ls": {
          let long = false;
          const paths = [];
          for (const a of args) {
            if (a === "-l" || a === "-la" || a === "-al") long = true;
            else if (!a.startsWith("-")) paths.push(a);
          }
          const target = expand(paths[0] || ".");
          const node = resolveNode(state.root, target);
          if (!node) return { out: `ls: cannot access '${paths[0] || "."}': No such file`, err: true };
          state._lastLs = true;
          if (node.type === "file") return { out: baseName(target) };
          return { out: listNames(node, long) };
        }
        case "mkdir": {
          let parents = false;
          const paths = [];
          for (const a of args) {
            if (a === "-p") parents = true;
            else paths.push(a);
          }
          if (!paths.length) return { out: "mkdir: missing operand", err: true };
          for (const p of paths) {
            const abs = expand(p);
            const parent = parentPath(abs);
            const name = baseName(abs);
            if (resolveNode(state.root, abs)) return { out: `mkdir: cannot create directory '${p}': File exists`, err: true };
            const parentNode = resolveNode(state.root, parent);
            if (!parentNode || parentNode.type !== "dir") {
              if (parents) ensureDir(abs);
              else return { out: `mkdir: cannot create directory '${p}': No such file or directory`, err: true };
            } else {
              parentNode.children[name] = { type: "dir", mode: 0o755, children: {} };
            }
          }
          return { out: "" };
        }
        case "touch": {
          if (!args[0]) return { out: "touch: missing file operand", err: true };
          const abs = expand(args[0]);
          const existing = resolveNode(state.root, abs);
          if (existing) {
            if (existing.type === "file") return { out: "" };
            return { out: `touch: cannot touch '${args[0]}': Is a directory`, err: true };
          }
          const parent = resolveNode(state.root, parentPath(abs));
          if (!parent || parent.type !== "dir") return { out: `touch: cannot touch '${args[0]}': No such file or directory`, err: true };
          parent.children[baseName(abs)] = { type: "file", mode: 0o644, content: "" };
          return { out: "" };
        }
        case "cat": {
          if (!args[0]) return { out: "cat: missing file operand", err: true };
          const node = resolveNode(state.root, expand(args[0]));
          if (!node) return { out: `cat: ${args[0]}: No such file or directory`, err: true };
          if (node.type !== "file") return { out: `cat: ${args[0]}: Is a directory`, err: true };
          return { out: node.content.replace(/\n$/, "") };
        }
        case "cp": {
          if (args.length < 2) return { out: "cp: missing file operand", err: true };
          const src = resolveNode(state.root, expand(args[0]));
          if (!src || src.type !== "file") return { out: `cp: cannot stat '${args[0]}': No such file`, err: true };
          const destAbs = expand(args[1]);
          let destParent = resolveNode(state.root, destAbs);
          let destName;
          if (destParent && destParent.type === "dir") {
            destName = baseName(expand(args[0]));
          } else {
            destParent = resolveNode(state.root, parentPath(destAbs));
            destName = baseName(destAbs);
          }
          if (!destParent || destParent.type !== "dir") return { out: `cp: cannot create '${args[1]}'`, err: true };
          destParent.children[destName] = { type: "file", mode: src.mode, content: src.content };
          return { out: "" };
        }
        case "mv": {
          if (args.length < 2) return { out: "mv: missing file operand", err: true };
          const srcAbs = expand(args[0]);
          const srcParent = resolveNode(state.root, parentPath(srcAbs));
          const srcName = baseName(srcAbs);
          if (!srcParent || !srcParent.children[srcName]) return { out: `mv: cannot stat '${args[0]}': No such file`, err: true };
          const node = srcParent.children[srcName];
          const destAbs = expand(args[1]);
          let destParent = resolveNode(state.root, destAbs);
          let destName;
          if (destParent && destParent.type === "dir") {
            destName = srcName;
          } else {
            destParent = resolveNode(state.root, parentPath(destAbs));
            destName = baseName(destAbs);
          }
          if (!destParent || destParent.type !== "dir") return { out: `mv: cannot move to '${args[1]}'`, err: true };
          delete srcParent.children[srcName];
          destParent.children[destName] = node;
          return { out: "" };
        }
        case "rm": {
          let recursive = false;
          const paths = [];
          for (const a of args) {
            if (a === "-r" || a === "-rf" || a === "-fr") recursive = true;
            else paths.push(a);
          }
          if (!paths.length) return { out: "rm: missing operand", err: true };
          for (const p of paths) {
            const abs = expand(p);
            if (abs === "/") return { out: "rm: refusing to remove /", err: true };
            const parent = resolveNode(state.root, parentPath(abs));
            const name = baseName(abs);
            const node = parent && parent.children[name];
            if (!node) return { out: `rm: cannot remove '${p}': No such file`, err: true };
            if (node.type === "dir" && !recursive) return { out: `rm: cannot remove '${p}': Is a directory`, err: true };
            delete parent.children[name];
          }
          return { out: "" };
        }
        case "tree":
          return { out: renderTree() };
        case "challenge":
          return { out: `Challenge ${state.challengeIdx + 1}: ${CHALLENGES[state.challengeIdx].prompt}` };
        default:
          return { out: `${cmd}: command not found (try help)`, err: true };
      }
    } catch (e) {
      return { out: String(e.message || e), err: true };
    }
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const result = ch.check(state);
    return result === true ? { ok: true } : { ok: false, msg: result };
  }

  const root = document.getElementById("vfs-root");

  root.innerHTML = `
    <div class="challenge" id="challenge-box">
      <h2></h2>
      <p></p>
      <div class="tool-actions">
        <span class="challenge-status idle" id="ch-status">Not checked</span>
        <button type="button" class="btn btn-secondary" id="ch-check">Check</button>
        <button type="button" class="btn btn-ghost" id="ch-next">Next challenge</button>
        <button type="button" class="btn btn-ghost" id="ch-reset">Reset filesystem</button>
      </div>
    </div>
    <div class="tool-layout split">
      <div>
        <div class="term" id="term">
          <div class="term-bar">
            <span class="term-dot r"></span>
            <span class="term-dot y"></span>
            <span class="term-dot g"></span>
            <span>lab-shell — /home/student</span>
          </div>
          <pre class="term-out" id="term-out" aria-live="polite"></pre>
          <form class="term-form" id="term-form" autocomplete="off">
            <span class="prompt" id="term-prompt">student:~$</span>
            <input id="term-input" type="text" spellcheck="false" aria-label="Shell command" placeholder="try: ls · cd project · help">
          </form>
        </div>
        <div class="kbd-row" id="quick-cmds"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Tree</h2></div>
        <div class="panel-body"><pre class="tree-view" id="tree-view"></pre></div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Hints</h2></div>
      <div class="panel-body">
        <ul class="hint-list">
          <li><code>cd project/src</code> then <code>ls -l</code></li>
          <li><code>~</code> is <code>/home/student</code>; <code>..</code> goes up one level</li>
          <li><code>mkdir -p docs</code> · <code>touch docs/todo.txt</code> · <code>cp project/tb/test_main.v /tmp/</code></li>
        </ul>
      </div>
    </div>
  `;

  const termOut = document.getElementById("term-out");
  const termInput = document.getElementById("term-input");
  const termPrompt = document.getElementById("term-prompt");
  const treeView = document.getElementById("tree-view");
  const termBar = document.querySelector(".term-bar span:last-child");

  function shortCwd() {
    if (state.cwd === "/home/student") return "~";
    if (state.cwd.startsWith("/home/student/")) return "~/" + state.cwd.slice("/home/student/".length);
    return state.cwd;
  }

  function appendLine(html) {
    const div = document.createElement("div");
    div.className = "term-line";
    div.innerHTML = html;
    termOut.appendChild(div);
    termOut.scrollTop = termOut.scrollHeight;
  }

  function refreshSide() {
    treeView.textContent = renderTree();
    termPrompt.textContent = `student:${shortCwd()}$`;
    termBar.textContent = `lab-shell — ${state.cwd}`;
  }

  function showChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const box = document.getElementById("challenge-box");
    box.querySelector("h2").textContent = `Challenge ${ch.id}: ${ch.title}`;
    box.querySelector("p").textContent = ch.prompt;
    const st = document.getElementById("ch-status");
    st.className = "challenge-status idle";
    st.textContent = "Not checked";
  }

  function submit(line) {
    appendLine(`<span class="prompt">${termPrompt.textContent}</span> <span class="cmd"></span>`);
    termOut.lastChild.querySelector(".cmd").textContent = line;
    const result = run(line);
    if (result.clear) termOut.innerHTML = "";
    else if (result.out) {
      appendLine(result.err ? `<span class="err"></span>` : `<span></span>`);
      termOut.lastChild.firstChild.textContent = result.out;
    }
    state.history.push(line);
    state.histIdx = state.history.length;
    refreshSide();
  }

  document.getElementById("term-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const line = termInput.value;
    termInput.value = "";
    submit(line);
  });

  termInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (state.histIdx > 0) {
        state.histIdx--;
        termInput.value = state.history[state.histIdx] || "";
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (state.histIdx < state.history.length - 1) {
        state.histIdx++;
        termInput.value = state.history[state.histIdx] || "";
      } else {
        state.histIdx = state.history.length;
        termInput.value = "";
      }
    }
  });

  document.getElementById("ch-check").addEventListener("click", () => {
    const r = checkChallenge();
    const st = document.getElementById("ch-status");
    if (r.ok) {
      st.className = "challenge-status pass";
      st.textContent = "Passed";
    } else {
      st.className = "challenge-status fail";
      st.textContent = r.msg;
    }
  });

  document.getElementById("ch-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    showChallenge();
  });

  document.getElementById("ch-reset").addEventListener("click", () => {
    state.root = STARTER();
    state.cwd = "/home/student";
    state._lastLs = false;
    termOut.innerHTML = "";
    appendLine(`<span class="dim">Filesystem reset. Type help to begin.</span>`);
    refreshSide();
    showChallenge();
  });

  const quick = ["help", "pwd", "ls -l", "cd project", "cd ..", "tree"];
  const quickEl = document.getElementById("quick-cmds");
  quick.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q;
    b.addEventListener("click", () => {
      termInput.value = q;
      termInput.focus();
    });
    quickEl.appendChild(b);
  });

  appendLine(`<span class="dim">Unix lab shell. Type help · Arrow keys for history.</span>`);
  refreshSide();
  showChallenge();
  termInput.focus();
})();
