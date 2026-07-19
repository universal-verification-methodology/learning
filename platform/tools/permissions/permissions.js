(() => {
  const CLASSES = [
    { key: "owner", label: "Owner (u)", shift: 6 },
    { key: "group", label: "Group (g)", shift: 3 },
    { key: "other", label: "Other (o)", shift: 0 },
  ];
  const BITS = [
    { name: "r", bit: 4 },
    { name: "w", bit: 2 },
    { name: "x", bit: 1 },
  ];

  let mode = 0o644;
  let isDir = false;
  let challengeIdx = 0;
  let clearedIds = [];
  let showHint = false;
  const CLEARED_KEY = "ddv-permissions-cleared-v1";
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const CHALLENGES = [
    { id: "mode-644", title: "Mode 644", prompt: "Set file mode to 644 (rw-r--r--).", hint: "Use preset 644 or clear write for group/other.", check: () => (mode & 0o777) === 0o644 && !isDir },
    { id: "mode-755", title: "Mode 755", prompt: "Set executable script/dir style 755.", hint: "Preset 755.", check: () => (mode & 0o777) === 0o755 },
    { id: "mode-600", title: "Private 600", prompt: "Owner read/write only (600).", hint: "Preset 600.", check: () => (mode & 0o777) === 0o600 },
    { id: "mode-700", title: "Private dir 700", prompt: "Owner-only rwx (700).", hint: "Preset 700.", check: () => (mode & 0o777) === 0o700 },
    { id: "as-dir", title: "Directory bit", prompt: "Mark as Directory so the symbol starts with d.", hint: "Check Directory.", check: () => isDir },
    { id: "dir-755", title: "d755", prompt: "Directory with mode 755.", hint: "Directory + 755.", check: () => isDir && (mode & 0o777) === 0o755 },
    { id: "umask-022-file", title: "umask 022 file", prompt: "File create with umask 022 → result mode 644.", hint: "create=file, umask=022.", check: () => {
      const um = parseOctal(document.getElementById("umask-in").value);
      const createType = document.getElementById("create-type").value;
      return createType === "file" && um === 0o022 && ((0o666 & ~um) & 0o777) === 0o644;
    }},
    { id: "umask-022-dir", title: "umask 022 dir", prompt: "Directory create with umask 022 → 755.", hint: "create=directory, umask=022.", check: () => {
      const um = parseOctal(document.getElementById("umask-in").value);
      const createType = document.getElementById("create-type").value;
      return createType === "dir" && um === 0o022 && ((0o777 & ~um) & 0o777) === 0o755;
    }},
    { id: "umask-077", title: "umask 077", prompt: "File with umask 077 → 600.", hint: "umask 077, file.", check: () => {
      const um = parseOctal(document.getElementById("umask-in").value);
      return document.getElementById("create-type").value === "file" && um === 0o077 && ((0o666 & ~um) & 0o777) === 0o600;
    }},
    { id: "which-simv", title: "which simv", prompt: "PATH finds /home/student/bin/simv for command simv.", hint: "Keep student/bin in PATH; lookup simv.", check: () => whichCmd() === "/home/student/bin/simv" },
    { id: "which-ls", title: "which ls", prompt: "Lookup ls → /usr/bin/ls.", hint: "which-in = ls", check: () => {
      document.getElementById("which-in").value = "ls";
      return whichCmd() === "/usr/bin/ls";
    }},
    { id: "which-git", title: "which git", prompt: "Lookup git → /usr/bin/git.", hint: "which-in = git", check: () => {
      document.getElementById("which-in").value = "git";
      return whichCmd() === "/usr/bin/git";
    }},
    { id: "which-vcs", title: "which vcs", prompt: "Lookup vcs → /usr/local/bin/vcs.", hint: "Keep /usr/local/bin first.", check: () => {
      document.getElementById("which-in").value = "vcs";
      return whichCmd() === "/usr/local/bin/vcs";
    }},
    { id: "which-missing", title: "not found", prompt: "Lookup nosuch → not found (empty PATH or unknown cmd).", hint: "Set which-in to nosuch.", check: () => {
      document.getElementById("which-in").value = "nosuch";
      return whichCmd() === null;
    }},
    { id: "owner-student", title: "Owner class", prompt: "You are student owning the file → match owner class.", hint: "owner=student, you=student.", check: () => {
      return document.getElementById("owner-in").value === "student" &&
        document.getElementById("you-user").value === "student" &&
        classForYou().which === "owner";
    }},
    { id: "group-match", title: "Group class", prompt: "You are ta, file group staff, your groups include staff → group class.", hint: "you=ta, group=staff, your groups=staff.", check: () => {
      document.getElementById("you-user").value = "ta";
      document.getElementById("owner-in").value = "student";
      document.getElementById("group-in").value = "staff";
      document.getElementById("you-groups").value = "staff";
      return classForYou().which === "group";
    }},
    { id: "other-class", title: "Other class", prompt: "You don't own and aren't in group → other.", hint: "you=ta, owner=student, group=students, your groups empty or students≠staff.", check: () => {
      document.getElementById("you-user").value = "ta";
      document.getElementById("owner-in").value = "student";
      document.getElementById("group-in").value = "students";
      document.getElementById("you-groups").value = "staff";
      return classForYou().which === "other";
    }},
    { id: "export-tools", title: "export TOOLS", prompt: "Apply export TOOLS=/opt/eda so env shows TOOLS=/opt/eda.", hint: "Click Apply on the export line.", check: () => env.TOOLS === "/opt/eda" },
    { id: "export-custom", title: "export LAB", prompt: "export LAB=1 and Apply.", hint: "Change export line to export LAB=1, Apply.", check: () => env.LAB === "1" },
    { id: "no-other-write", title: "No other write", prompt: "Mode where other cannot write (other write bit clear).", hint: "644 or 755 works.", check: () => ((mode >> 0) & 2) === 0 },
    { id: "owner-exec", title: "Owner execute", prompt: "Owner has execute bit set.", hint: "755 or 700.", check: () => ((mode >> 6) & 1) === 1 },
    { id: "world-read", title: "World readable", prompt: "Other has read (e.g. 644).", hint: "644.", check: () => ((mode >> 0) & 4) === 4 },
  ];

  const FAKE_BINS = {
    "/usr/bin/ls": true,
    "/usr/bin/git": true,
    "/bin/bash": true,
    "/home/student/bin/simv": true,
    "/usr/local/bin/vcs": true,
  };

  function whichCmd() {
    const pathVal = document.getElementById("path-in").value;
    const cmd = document.getElementById("which-in").value.trim() || "simv";
    const dirs = pathVal.split(":").filter(Boolean);
    for (const d of dirs) {
      const candidate = (d.replace(/\/$/, "") + "/" + cmd).replace(/\/+/g, "/");
      if (FAKE_BINS[candidate]) return candidate;
    }
    return null;
  }

  const root = document.getElementById("perm-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> mode <code>644</code> (−rw-r--r--), umask <code>022</code> → new files <code>644</code>.</p>
      <button type="button" class="btn btn-secondary" id="perm-starter">Load starter example</button>
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
    <div class="perm-grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Mode bits</h2>
          <label style="font-size:0.85rem;display:flex;align-items:center;gap:0.35rem">
            <input type="checkbox" id="as-dir"> Directory
          </label>
        </div>
        <div class="panel-body">
          <div class="mode-display" id="mode-sym">-rw-r--r--</div>
          <div class="mode-meta">
            <span>octal <strong id="mode-oct">0644</strong></span>
            <span>chmod <strong id="mode-chmod">644</strong></span>
          </div>
          <table class="bit-table" id="bit-table">
            <thead>
              <tr><th></th><th>r</th><th>w</th><th>x</th></tr>
            </thead>
            <tbody></tbody>
          </table>
          <div class="kbd-row" style="margin-top:0.85rem" id="presets"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Effective access</h2></div>
        <div class="panel-body">
          <p style="margin:0 0 0.75rem;color:var(--muted);font-size:0.9rem">
            For a process matching each class, what can it do?
          </p>
          <ul class="access-list" id="access-list"></ul>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Umask calculator</h2></div>
      <div class="panel-body">
        <div class="umask-row">
          <label>Create as
            <select id="create-type">
              <option value="file">file (base 666)</option>
              <option value="dir">directory (base 777)</option>
            </select>
          </label>
          <label>umask (octal)
            <input id="umask-in" value="022" maxlength="4">
          </label>
        </div>
        <div class="result-box" id="umask-out"></div>
      </div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>PATH &amp; environment</h2></div>
      <div class="panel-body">
        <p style="margin:0 0 0.75rem;color:var(--muted);font-size:0.9rem">
          Edit PATH entries. Which looks up first wins — missing dirs explain “command not found”.
        </p>
        <div class="umask-row">
          <label style="flex:1">PATH (colon-separated)
            <input id="path-in" value="/usr/local/bin:/usr/bin:/bin:/home/student/bin" style="min-width:100%">
          </label>
          <label>lookup command
            <input id="which-in" value="simv">
          </label>
        </div>
        <div class="result-box" id="path-out"></div>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Lab fake binaries: <code>/usr/bin/ls</code>, <code>/usr/bin/git</code>, <code>/home/student/bin/simv</code></li>
          <li><code>export PATH="$HOME/bin:$PATH"</code> puts your tools first</li>
        </ul>
      </div>
    </div>

    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Ownership, groups &amp; export</h2></div>
      <div class="panel-body">
        <div class="umask-row">
          <label>File owner
            <select id="owner-in">
              <option value="student">student</option>
              <option value="root">root</option>
              <option value="ta">ta</option>
            </select>
          </label>
          <label>File group
            <select id="group-in">
              <option value="students">students</option>
              <option value="staff">staff</option>
              <option value="root">root</option>
            </select>
          </label>
          <label>You are
            <select id="you-user">
              <option value="student">student</option>
              <option value="ta">ta</option>
              <option value="root">root</option>
            </select>
          </label>
          <label>Your groups (comma)
            <input id="you-groups" value="students">
          </label>
        </div>
        <div class="result-box" id="owner-out"></div>
        <div class="umask-row" style="margin-top:0.85rem">
          <label style="flex:1">export NAME=value (dotfile / shell)
            <input id="export-in" value="export TOOLS=/opt/eda" style="min-width:100%">
          </label>
          <button type="button" class="btn btn-secondary" id="btn-export">Apply</button>
        </div>
        <div class="result-box" id="env-out"></div>
      </div>
    </div>
  `;

  const tbody = root.querySelector("#bit-table tbody");
  CLASSES.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.label}</td>`;
    BITS.forEach((b) => {
      const td = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.shift = String(c.shift);
      cb.dataset.bit = String(b.bit);
      cb.addEventListener("change", () => {
        const shift = Number(cb.dataset.shift);
        const bit = Number(cb.dataset.bit);
        if (cb.checked) mode |= bit << shift;
        else mode &= ~(bit << shift);
        render();
      });
      td.appendChild(cb);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  function sym(modeVal, dir) {
    const map = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    return (dir ? "d" : "-") + map[(modeVal >> 6) & 7] + map[(modeVal >> 3) & 7] + map[modeVal & 7];
  }

  function can(classShift, need) {
    const bits = (mode >> classShift) & 7;
    return (bits & need) === need;
  }

  function render() {
    root.querySelectorAll("#bit-table input").forEach((cb) => {
      const shift = Number(cb.dataset.shift);
      const bit = Number(cb.dataset.bit);
      cb.checked = Boolean((mode >> shift) & bit);
    });
    document.getElementById("mode-sym").textContent = sym(mode, isDir);
    document.getElementById("mode-oct").textContent = mode.toString(8).padStart(4, "0");
    document.getElementById("mode-chmod").textContent = (mode & 0o777).toString(8);

    const actions = [
      { label: "Owner read", ok: can(6, 4) },
      { label: "Owner write", ok: can(6, 2) },
      { label: "Owner execute" + (isDir ? " (enter dir)" : ""), ok: can(6, 1) },
      { label: "Group read", ok: can(3, 4) },
      { label: "Group write", ok: can(3, 2) },
      { label: "Other read", ok: can(0, 4) },
      { label: "Other write", ok: can(0, 2) },
    ];
    const ul = document.getElementById("access-list");
    ul.innerHTML = actions
      .map(
        (a) =>
          `<li><span>${a.label}</span><span class="${a.ok ? "yes" : "no"}">${a.ok ? "yes" : "no"}</span></li>`
      )
      .join("");

    renderUmask();
    if (document.getElementById("owner-out")) renderOwner();
  }

  function parseOctal(s) {
    const t = String(s).trim().replace(/^0+/, "") || "0";
    if (!/^[0-7]{1,4}$/.test(String(s).trim())) return null;
    return parseInt(String(s).trim(), 8);
  }

  function renderUmask() {
    const createType = document.getElementById("create-type").value;
    const base = createType === "dir" ? 0o777 : 0o666;
    const um = parseOctal(document.getElementById("umask-in").value);
    const out = document.getElementById("umask-out");
    if (um === null) {
      out.textContent = "Enter a valid octal umask (e.g. 022, 002, 077).";
      return;
    }
    const result = base & ~um;
    out.innerHTML = `base ${base.toString(8)} &amp; ~${um.toString(8).padStart(3, "0")} → <strong>${sym(result, createType === "dir")} (${result.toString(8).padStart(3, "0")})</strong>`;
  }

  document.getElementById("as-dir").addEventListener("change", (e) => {
    isDir = e.target.checked;
    render();
  });
  document.getElementById("create-type").addEventListener("change", renderUmask);
  document.getElementById("umask-in").addEventListener("input", renderUmask);

  function renderPath() {
    const pathVal = document.getElementById("path-in").value;
    const cmd = document.getElementById("which-in").value.trim() || "simv";
    const dirs = pathVal.split(":").filter(Boolean);
    const lines = dirs.map((d, i) => `${i + 1}. ${d}`);
    let found = null;
    for (const d of dirs) {
      const candidate = (d.replace(/\/$/, "") + "/" + cmd).replace(/\/+/g, "/");
      if (FAKE_BINS[candidate]) {
        found = candidate;
        break;
      }
    }
    const out = document.getElementById("path-out");
    out.innerHTML =
      `<div>PATH search order:</div><pre style="margin:0.4rem 0 0;white-space:pre-wrap">${lines.join("\n") || "(empty PATH)"}</pre>` +
      (found
        ? `<div style="margin-top:0.55rem">which ${cmd} → <strong>${found}</strong></div>`
        : `<div style="margin-top:0.55rem;color:var(--err)">which ${cmd} → not found (add a dir that contains it, or use full path)</div>`);
  }

  document.getElementById("path-in").addEventListener("input", renderPath);
  document.getElementById("which-in").addEventListener("input", renderPath);

  const env = { HOME: "/home/student", USER: "student", PATH: "/usr/local/bin:/usr/bin:/bin" };

  function classForYou() {
    const owner = document.getElementById("owner-in").value;
    const group = document.getElementById("group-in").value;
    const you = document.getElementById("you-user").value;
    const groups = document.getElementById("you-groups").value.split(",").map((s) => s.trim()).filter(Boolean);
    if (you === "root" || you === owner) return { which: "owner", shift: 6 };
    if (groups.includes(group)) return { which: "group", shift: 3 };
    return { which: "other", shift: 0 };
  }

  function renderOwner() {
    const cls = classForYou();
    const bits = (mode >> cls.shift) & 7;
    const canR = Boolean(bits & 4);
    const canW = Boolean(bits & 2);
    const canX = Boolean(bits & 1);
    document.getElementById("owner-out").innerHTML =
      `You match <strong>${cls.which}</strong> class → bits ${bits.toString(8)} · ` +
      `read ${canR ? "yes" : "no"} · write ${canW ? "yes" : "no"} · exec ${canX ? "yes" : "no"}` +
      `<div style="margin-top:0.35rem;color:var(--muted)">ls -l style: ${document.getElementById("owner-in").value} ${document.getElementById("group-in").value}  file.txt</div>`;
  }

  function renderEnv() {
    document.getElementById("env-out").textContent = Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
  }

  ["owner-in", "group-in", "you-user", "you-groups"].forEach((id) => {
    document.getElementById(id).addEventListener("change", renderOwner);
    document.getElementById(id).addEventListener("input", renderOwner);
  });
  document.getElementById("btn-export").addEventListener("click", () => {
    const line = document.getElementById("export-in").value.trim();
    const m = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) {
      document.getElementById("env-out").textContent = "Expected: export NAME=value";
      return;
    }
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    renderEnv();
  });

  const presets = [
    ["644", 0o644],
    ["755", 0o755],
    ["600", 0o600],
    ["777", 0o777],
    ["700", 0o700],
  ];
  const presetEl = document.getElementById("presets");
  presets.forEach(([label, val]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => {
      mode = val;
      render();
    });
    presetEl.appendChild(b);
  });

  render();
  renderPath();
  renderEnv();
  renderOwner();

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
    } else {
      hintEl.hidden = true;
    }
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

  document.getElementById("perm-starter").addEventListener("click", () => {
    mode = 0o644;
    isDir = false;
    document.getElementById("as-dir").checked = false;
    document.getElementById("create-type").value = "file";
    document.getElementById("umask-in").value = "022";
    document.getElementById("path-in").value = "/usr/local/bin:/usr/bin:/bin:/home/student/bin";
    document.getElementById("which-in").value = "simv";
    render();
    renderPath();
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    render();
    renderPath();
    renderOwner();
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
    } else {
      setChalStatus("fail", "Not yet");
    }
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  renderChallenge();
})();
