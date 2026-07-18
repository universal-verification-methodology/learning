(() => {
  const PRESETS = {
    "safe-args": `#!/usr/bin/env bash
set -e
name="$1"
if [ -z "$name" ]; then
  echo "usage: $0 <name>"
  exit 2
fi
echo "hello, $name"
exit 0
`,
    "set-e-trap": `#!/usr/bin/env bash
set -e
echo "step 1"
false
echo "step 2 — never runs with set -e"
`,
    "loop-files": `#!/usr/bin/env bash
set -e
for f in src tb docs; do
  echo "check $f"
done
echo "done"
`,
    "case-mode": `#!/usr/bin/env bash
mode="$1"
case "$mode" in
  build) echo "building" ;;
  sim) echo "simulating" ;;
  *) echo "usage: build|sim"; exit 2 ;;
esac
`,
    "alias-fn": `#!/usr/bin/env bash
alias ll="echo LIST"
greet() {
  echo "hi $1"
}
ll
greet lab
`,
    "read-input": `#!/usr/bin/env bash
echo "enter name:"
read name
echo "got $name"
`,
    "exit-codes": `#!/usr/bin/env bash
echo "running"
exit 1
`,
  };

  const root = document.getElementById("script-root");
  root.innerHTML = `
    <div class="challenge">
      <h2>Presets</h2>
      <p>Load a script, set args, Run. Watch the step trace and final exit code.</p>
      <div class="kbd-row" id="presets"></div>
    </div>
    <div class="script-grid">
      <div class="panel">
        <div class="panel-head">
          <h2>script.sh</h2>
          <label style="font-size:0.85rem;display:flex;gap:0.35rem;align-items:center">
            <input type="checkbox" id="set-e" checked> honor set -e
          </label>
        </div>
        <div class="panel-body">
          <textarea class="script-area" id="script" spellcheck="false"></textarea>
          <div class="args-row">
            <label for="args"><code>$1 $2 …</code></label>
            <input id="args" value="alice" placeholder="arguments">
            <label for="stdin-in"><code>stdin</code> (for read)</label>
            <input id="stdin-in" value="bob" placeholder="lines for read">
            <button type="button" class="btn btn-primary" id="run">Run</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Trace</h2></div>
        <div class="panel-body">
          <div id="trace"></div>
          <div class="exit-badge zero" id="exit">exit ?</div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Lab semantics</h2></div>
      <div class="panel-body">
        <ul class="hint-list">
          <li>Supported: <code>echo</code>, <code>exit</code>, <code>set -e</code>, <code>if [ -z "$1" ]</code>, <code>for</code>, <code>case</code>, <code>alias</code>, <code>fn()</code>, <code>read</code>, <code>true</code>/<code>false</code></li>
          <li>With <code>set -e</code>, a failing command stops the script immediately</li>
          <li>Exit <code>0</code> = success; non-zero = failure (scripts and Make care about this)</li>
        </ul>
      </div>
    </div>
  `;

  const presetsEl = document.getElementById("presets");
  Object.keys(PRESETS).forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = k;
    b.addEventListener("click", () => {
      document.getElementById("script").value = PRESETS[k];
      document.getElementById("set-e").checked = PRESETS[k].includes("set -e");
    });
    presetsEl.appendChild(b);
  });
  document.getElementById("script").value = PRESETS["safe-args"];

  function tokenizeLine(line) {
    return (line.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map((t) => t.replace(/^"|"$/g, ""));
  }

  function runScript() {
    const honorSetE = document.getElementById("set-e").checked;
    const rawArgs = document.getElementById("args").value.trim();
    const argv = rawArgs ? rawArgs.split(/\s+/) : [];
    const stdinLines = document.getElementById("stdin-in").value.split("\n");
    let stdinIdx = 0;
    const lines = document.getElementById("script").value.split("\n");
    const trace = [];
    let exitCode = 0;
    let setE = false;
    let i = 0;
    const aliases = {};
    const funcs = {};

    function expand(s) {
      return s
        .replace(/\$0/g, "script.sh")
        .replace(/\$1/g, argv[0] || "")
        .replace(/\$2/g, argv[1] || "")
        .replace(/\$#/g, String(argv.length))
        .replace(/\$name\b/g, aliases.__name || argv[0] || "");
    }

    function fail(msg, code) {
      exitCode = code ?? 1;
      trace.push({ text: msg, fail: true });
      return "stop";
    }

    while (i < lines.length) {
      let line = lines[i].trim();
      i++;
      if (!line || line.startsWith("#")) continue;

      if (line === "set -e") {
        setE = true;
        trace.push({ text: "→ set -e (errexit on)", ok: true });
        continue;
      }
      if (line.startsWith("echo ")) {
        const msg = expand(line.slice(5).replace(/^"|"$/g, ""));
        trace.push({ text: `stdout: ${msg}`, ok: true });
        exitCode = 0;
        continue;
      }
      if (line === "true") {
        exitCode = 0;
        trace.push({ text: "→ true (0)", ok: true });
        continue;
      }
      if (line === "false") {
        exitCode = 1;
        trace.push({ text: "→ false (1)", fail: true });
        if (setE && honorSetE) {
          trace.push({ text: "set -e: aborting", fail: true });
          break;
        }
        continue;
      }
      if (line.startsWith("exit")) {
        const n = Number(line.split(/\s+/)[1] || 0);
        exitCode = n;
        trace.push({ text: `→ exit ${n}`, fail: n !== 0, ok: n === 0 });
        break;
      }
      if (line.startsWith("if ")) {
        // if [ -z "$1" ]; then
        const cond = line;
        let body = [];
        while (i < lines.length && lines[i].trim() !== "fi") {
          const l = lines[i].trim();
          i++;
          if (l === "then" || !l) continue;
          if (l === "else") {
            body.push("__ELSE__");
            continue;
          }
          body.push(l);
        }
        i++; // skip fi
        const m = cond.match(/\[\s*-z\s+"?\$(\d+)"?\s*\]/);
        let takeThen = true;
        if (m) {
          const idx = Number(m[1]) - 1;
          takeThen = !argv[idx];
          trace.push({ text: `if [ -z "$${m[1]}" ] → ${takeThen}`, ok: true });
        } else {
          trace.push({ text: `if (unsupported cond, treating as false): ${cond}`, fail: true });
          takeThen = false;
        }
        const elseIdx = body.indexOf("__ELSE__");
        const block = takeThen
          ? elseIdx >= 0 ? body.slice(0, elseIdx) : body
          : elseIdx >= 0 ? body.slice(elseIdx + 1) : [];
        // splice block as upcoming lines
        lines.splice(i, 0, ...block);
        continue;
      }
      if (line.startsWith("alias ")) {
        const m = line.match(/^alias\s+(\w+)=["'](.*)["']\s*$/);
        if (!m) {
          trace.push({ text: `bad alias: ${line}`, fail: true });
          exitCode = 1;
          if (setE && honorSetE) break;
          continue;
        }
        aliases[m[1]] = m[2];
        trace.push({ text: `alias ${m[1]}='${m[2]}'`, ok: true });
        continue;
      }
      if (/^\w+\(\)\s*\{$/.test(line)) {
        const name = line.match(/^(\w+)/)[1];
        const body = [];
        while (i < lines.length && lines[i].trim() !== "}") {
          body.push(lines[i]);
          i++;
        }
        i++; // }
        funcs[name] = body;
        trace.push({ text: `function ${name}()`, ok: true });
        continue;
      }
      if (line.startsWith("case ")) {
        const m = line.match(/^case\s+"?\$?(\w+|"?\$\d+"?)"?\s+in$/);
        // simpler: case "$mode" in
        const cm = line.match(/^case\s+"([^"]+)"\s+in$/) || line.match(/^case\s+(\S+)\s+in$/);
        let val = "";
        if (cm) val = expand(cm[1]).replace(/^"|"$/g, "");
        const arms = [];
        while (i < lines.length && lines[i].trim() !== "esac") {
          arms.push(lines[i]);
          i++;
        }
        i++; // esac
        let chosen = null;
        let buf = [];
        let pat = null;
        for (const raw of arms) {
          const l = raw.trim();
          if (!l) continue;
          const arm = l.match(/^(.+)\)\s*(.*)$/);
          if (arm) {
            if (pat !== null && chosen === null && (pat === "*" || pat === val || pat.split("|").includes(val))) {
              chosen = buf;
            }
            pat = arm[1].trim();
            buf = arm[2] && arm[2] !== ";;" ? [arm[2].replace(/\s*;;\s*$/, "")] : [];
            if (arm[2].includes(";;")) {
              if (chosen === null && (pat === "*" || pat === val || pat.split("|").includes(val))) chosen = buf;
              pat = null;
              buf = [];
            }
          } else if (l === ";;") {
            if (pat !== null && chosen === null && (pat === "*" || pat === val || pat.split("|").includes(val))) {
              chosen = buf;
            }
            pat = null;
            buf = [];
          } else {
            buf.push(l.replace(/\s*;;\s*$/, ""));
          }
        }
        if (pat !== null && chosen === null && (pat === "*" || pat === val || pat.split("|").includes(val))) {
          chosen = buf;
        }
        trace.push({ text: `case "${val}" → ${(chosen && chosen[0]) || "(no match)"}`, ok: true });
        if (chosen && chosen.length) lines.splice(i, 0, ...chosen.filter(Boolean));
        continue;
      }
      if (line === "read name" || line.startsWith("read ")) {
        const varName = line.split(/\s+/)[1] || "REPLY";
        const got = stdinLines[stdinIdx++] ?? "";
        // store via expand hack
        aliases["__" + varName] = got;
        trace.push({ text: `read ${varName} ← "${got}"`, ok: true });
        // rewrite later echoes of $name
        for (let j = i; j < lines.length; j++) {
          lines[j] = lines[j].replace(new RegExp("\\$" + varName + "\\b", "g"), got);
        }
        continue;
      }
      // alias / function call
      {
        const call = line.match(/^(\w+)(?:\s+(.*))?$/);
        if (call && aliases[call[1]] && !line.startsWith("alias ")) {
          lines.splice(i, 0, aliases[call[1]] + (call[2] ? " " + call[2] : ""));
          continue;
        }
        if (call && funcs[call[1]]) {
          const arg1 = (call[2] || "").trim().split(/\s+/)[0] || "";
          const body = funcs[call[1]].map((b) => b.replace(/\$1\b/g, arg1));
          lines.splice(i, 0, ...body);
          continue;
        }
      }
      if (line.startsWith("for ") && line.includes(" in ")) {
        const m = line.match(/^for\s+(\w+)\s+in\s+(.+);\s*do$/);
        if (!m) {
          if (fail(`unsupported for: ${line}`, 2) === "stop") break;
          continue;
        }
        const items = m[2].trim().split(/\s+/);
        const loopBody = [];
        while (i < lines.length && lines[i].trim() !== "done") {
          loopBody.push(lines[i]);
          i++;
        }
        i++; // done
        const expanded = [];
        for (const item of items) {
          for (const bl of loopBody) {
            expanded.push(bl.replace(new RegExp("\\$" + m[1] + "\\b", "g"), item).replace(m[1], item));
          }
        }
        // simpler: replace $var in echo lines
        const inject = [];
        for (const item of items) {
          for (const bl of loopBody) {
            inject.push(bl.replace(new RegExp("\\$" + m[1] + "\\b", "g"), item));
          }
        }
        lines.splice(i, 0, ...inject);
        trace.push({ text: `for ${m[1]} in ${items.join(" ")}`, ok: true });
        continue;
      }
      const toks = tokenizeLine(expand(line));
      trace.push({ text: `? unknown: ${toks.join(" ")}`, fail: true });
      exitCode = 127;
      if (setE && honorSetE) break;
    }

    const traceEl = document.getElementById("trace");
    traceEl.innerHTML = trace
      .map((t) => `<div class="trace-line ${t.fail ? "fail" : t.ok ? "ok" : ""}">${t.text.replace(/</g, "&lt;")}</div>`)
      .join("") || `<div class="trace-line">No steps.</div>`;
    const badge = document.getElementById("exit");
    badge.textContent = `exit ${exitCode}`;
    badge.className = "exit-badge " + (exitCode === 0 ? "zero" : "nonzero");
  }

  document.getElementById("run").addEventListener("click", runScript);
  runScript();
})();
