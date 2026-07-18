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

  const root = document.getElementById("perm-root");
  root.innerHTML = `
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

  const FAKE_BINS = {
    "/usr/bin/ls": true,
    "/usr/bin/git": true,
    "/bin/bash": true,
    "/home/student/bin/simv": true,
    "/usr/local/bin/vcs": true,
  };

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
})();
