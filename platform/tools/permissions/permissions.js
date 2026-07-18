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
})();
