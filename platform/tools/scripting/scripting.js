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
    "exit-zero": `#!/usr/bin/env bash
echo "ok"
exit 0
`,
    "for-count": `#!/usr/bin/env bash
for i in 1 2 3 4; do
  echo "n=$i"
done
`,
    "nargs": `#!/usr/bin/env bash
echo "argc=$#"
echo "arg1=$1"
echo "arg2=$2"
`,
    "true-ok": `#!/usr/bin/env bash
true
echo "still running"
exit 0
`,
    "false-continue": `#!/usr/bin/env bash
false
echo "after false (no set -e)"
exit 0
`,
    "require-arg": `#!/usr/bin/env bash
set -e
if [ -z "$1" ]; then
  echo "need an argument"
  exit 2
else
  echo "got $1"
fi
`,
    "require-two": `#!/usr/bin/env bash
if [ -z "$2" ]; then
  echo "need \$1 and \$2"
  exit 2
else
  echo "pair $1 $2"
fi
`,
    "case-tool": `#!/usr/bin/env bash
tool="$1"
case "$tool" in
  iverilog) echo "sim" ;;
  verilator) echo "lint" ;;
  *) echo "unknown"; exit 2 ;;
esac
`,
    "case-phase": `#!/usr/bin/env bash
phase="$1"
case "$phase" in
  elab) echo "elaborate" ;;
  run) echo "run" ;;
  wave) echo "waves" ;;
  *) echo "usage: elab|run|wave"; exit 2 ;;
esac
`,
    "alias-sim": `#!/usr/bin/env bash
alias sim="echo run_sim"
sim
`,
    "fn-greet2": `#!/usr/bin/env bash
hi() {
  echo "welcome $1"
}
hi class
`,
    "read-echo": `#!/usr/bin/env bash
read who
echo "hello $who"
`,
    "loop-dirs": `#!/usr/bin/env bash
for d in rtl tb sim docs; do
  echo "scan $d"
done
`,
    "early-exit": `#!/usr/bin/env bash
echo "start"
exit 2
echo "never"
`,
    "set-e-true": `#!/usr/bin/env bash
set -e
true
echo "passed true"
exit 0
`,
    "for-bits": `#!/usr/bin/env bash
for b in 0 1; do
  echo "bit $b"
done
`,
    "case-empty": `#!/usr/bin/env bash
mode="$1"
case "$mode" in
  "") echo "empty mode"; exit 2 ;;
  ok) echo "ready" ;;
  *) echo "bad"; exit 1 ;;
esac
`,
    "fn-twice": `#!/usr/bin/env bash
say() {
  echo "$1"
}
say one
say two
`,
    "alias-chain": `#!/usr/bin/env bash
alias a="echo alpha"
alias b="echo beta"
a
b
`,
    "exit-three": `#!/usr/bin/env bash
echo "failing intentionally"
exit 3
`,
  };

  const CLEARED_KEY = "ddv-scripting-cleared-v1";

  function loadCleared() {
    try {
      const raw = localStorage.getItem(CLEARED_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }

  function saveCleared(ids) {
    try {
      localStorage.setItem(CLEARED_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    { id: "hello-alice", title: "Hello alice", prompt: "With safe-args and arg alice, exit 0 and greet alice.", hint: "Load safe-args, args=alice, Run.", preset: "safe-args", args: "alice", stdin: "", expectExit: 0, expectStdoutIncludes: "hello, alice" },
    { id: "missing-arg", title: "Missing arg → 2", prompt: "Run safe-args with no args; expect exit 2.", hint: "Clear the args field.", preset: "safe-args", args: "", stdin: "", expectExit: 2 },
    { id: "set-e-stops", title: "set -e stops", prompt: "Load set-e-trap, honor set -e, Run — must abort before step 2.", hint: "Keep honor set -e checked.", preset: "set-e-trap", args: "", stdin: "", expectExit: 1, expectStdoutIncludes: "step 1", expectTraceIncludes: "set -e: aborting" },
    { id: "loop-done", title: "Loop done", prompt: "loop-files should print done and exit 0.", hint: "Load loop-files, Run.", preset: "loop-files", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "done" },
    { id: "case-build", title: "case build", prompt: "case-mode with arg build → building, exit 0.", hint: "args=build", preset: "case-mode", args: "build", stdin: "", expectExit: 0, expectStdoutIncludes: "building" },
    { id: "case-bad", title: "case usage", prompt: "case-mode with arg foo → exit 2.", hint: "args=foo", preset: "case-mode", args: "foo", stdin: "", expectExit: 2 },
    { id: "alias-list", title: "alias ll", prompt: "alias-fn should print LIST and hi lab.", hint: "Load alias-fn, Run.", preset: "alias-fn", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "LIST" },
    { id: "read-bob", title: "read bob", prompt: "read-input with stdin bob → got bob.", hint: "stdin=bob", preset: "read-input", args: "", stdin: "bob", expectExit: 0, expectStdoutIncludes: "got bob" },
    { id: "exit-one", title: "exit 1", prompt: "exit-codes preset should exit 1.", hint: "Load exit-codes.", preset: "exit-codes", args: "", stdin: "", expectExit: 1 },
    { id: "exit-ok", title: "exit 0", prompt: "exit-zero → exit 0 and stdout ok.", hint: "Load exit-zero.", preset: "exit-zero", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "ok" },
    { id: "for-count", title: "for 1..4", prompt: "for-count should print n=4.", hint: "Load for-count.", preset: "for-count", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "n=4" },
    { id: "nargs-2", title: "argc=2", prompt: "nargs with a b → argc=2.", hint: "args=a b", preset: "nargs", args: "a b", stdin: "", expectExit: 0, expectStdoutIncludes: "argc=2" },
    { id: "true-ok", title: "true then echo", prompt: "true-ok exits 0 with still running.", hint: "Load true-ok.", preset: "true-ok", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "still running" },
    { id: "false-ok", title: "false without -e", prompt: "false-continue still prints after false and exits 0.", hint: "Honor set -e can be off; preset has no set -e.", preset: "false-continue", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "after false" },
    { id: "require-arg-ok", title: "require arg ok", prompt: "require-arg with x → got x, exit 0.", hint: "args=x", preset: "require-arg", args: "x", stdin: "", expectExit: 0, expectStdoutIncludes: "got x" },
    { id: "require-two", title: "need two args", prompt: "require-two with only one arg → exit 2.", hint: "args=only", preset: "require-two", args: "only", stdin: "", expectExit: 2 },
    { id: "iverilog", title: "case iverilog", prompt: "case-tool iverilog → sim.", hint: "args=iverilog", preset: "case-tool", args: "iverilog", stdin: "", expectExit: 0, expectStdoutIncludes: "sim" },
    { id: "phase-wave", title: "phase wave", prompt: "case-phase wave → waves.", hint: "args=wave", preset: "case-phase", args: "wave", stdin: "", expectExit: 0, expectStdoutIncludes: "waves" },
    { id: "alias-sim", title: "alias sim", prompt: "alias-sim prints run_sim.", hint: "Load alias-sim.", preset: "alias-sim", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "run_sim" },
    { id: "fn-class", title: "fn greet", prompt: "fn-greet2 → welcome class.", hint: "Load fn-greet2.", preset: "fn-greet2", args: "", stdin: "", expectExit: 0, expectStdoutIncludes: "welcome class" },
    { id: "read-echo", title: "read who", prompt: "read-echo stdin Ada → hello Ada.", hint: "stdin=Ada", preset: "read-echo", args: "", stdin: "Ada", expectExit: 0, expectStdoutIncludes: "hello Ada" },
    { id: "early-exit", title: "early exit 2", prompt: "early-exit stops with exit 2 (never runs).", hint: "Load early-exit.", preset: "early-exit", args: "", stdin: "", expectExit: 2, expectStdoutIncludes: "start" },
    { id: "exit-three", title: "exit 3", prompt: "exit-three → exit 3.", hint: "Load exit-three.", preset: "exit-three", args: "", stdin: "", expectExit: 3 },
  ];

  let lastRun = { exitCode: 0, stdout: [], traceText: "" };
  let challengeIdx = 0;
  let clearedIds = loadCleared();
  let showHint = false;

  const root = document.getElementById("script-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>safe-args</code> with <code>$1=alice</code> → <code>hello, alice</code>, exit 0.</p>
      <button type="button" class="btn btn-secondary" id="script-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-secondary" id="chal-load">Load challenge setup</button>
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-primary" id="chal-check">Run &amp; Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
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
    const stdout = [];
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
        stdout.push(msg);
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
        i++;
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
        i++;
        funcs[name] = body;
        trace.push({ text: `function ${name}()`, ok: true });
        continue;
      }
      if (line.startsWith("case ")) {
        const cm = line.match(/^case\s+"([^"]+)"\s+in$/) || line.match(/^case\s+(\S+)\s+in$/);
        let val = "";
        if (cm) val = expand(cm[1]).replace(/^"|"$/g, "");
        const arms = [];
        while (i < lines.length && lines[i].trim() !== "esac") {
          arms.push(lines[i]);
          i++;
        }
        i++;
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
        aliases["__" + varName] = got;
        trace.push({ text: `read ${varName} ← "${got}"`, ok: true });
        for (let j = i; j < lines.length; j++) {
          lines[j] = lines[j].replace(new RegExp("\\$" + varName + "\\b", "g"), got);
        }
        continue;
      }
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
        i++;
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
    lastRun = {
      exitCode,
      stdout,
      traceText: trace.map((t) => t.text).join("\n"),
    };
    return lastRun;
  }

  function loadChallengeSetup() {
    const ch = CHALLENGES[challengeIdx];
    document.getElementById("script").value = PRESETS[ch.preset];
    document.getElementById("set-e").checked = PRESETS[ch.preset].includes("set -e");
    document.getElementById("args").value = ch.args ?? "";
    document.getElementById("stdin-in").value = ch.stdin ?? "";
  }

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

  function checkChallenge() {
    loadChallengeSetup();
    const ch = CHALLENGES[challengeIdx];
    const r = runScript();
    if (r.exitCode !== ch.expectExit) {
      setChalStatus("fail", `Expected exit ${ch.expectExit}, got ${r.exitCode}`);
      return;
    }
    const joined = r.stdout.join("\n");
    if (ch.expectStdoutIncludes && !joined.includes(ch.expectStdoutIncludes)) {
      setChalStatus("fail", `Missing stdout: ${ch.expectStdoutIncludes}`);
      return;
    }
    if (ch.expectTraceIncludes && !r.traceText.includes(ch.expectTraceIncludes)) {
      setChalStatus("fail", `Missing trace: ${ch.expectTraceIncludes}`);
      return;
    }
    if (!clearedIds.includes(ch.id)) {
      clearedIds = [...clearedIds, ch.id];
      saveCleared(clearedIds);
    }
    setChalStatus("pass", "Pass");
    renderChallenge();
  }

  document.getElementById("run").addEventListener("click", runScript);
  document.getElementById("script-starter").addEventListener("click", () => {
    document.getElementById("script").value = PRESETS["safe-args"];
    document.getElementById("args").value = "alice";
    document.getElementById("stdin-in").value = "bob";
    document.getElementById("set-e").checked = true;
    runScript();
  });
  document.getElementById("chal-load").addEventListener("click", () => {
    loadChallengeSetup();
    setChalStatus("idle", "Loaded — Run & Check");
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    setChalStatus("idle", "Idle");
    renderChallenge();
  });

  runScript();
  renderChallenge();
})();
