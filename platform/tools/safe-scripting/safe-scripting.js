(() => {
  const CLEARED_KEY = "ddv-safe-scripting-cleared-v1";
  const STORE_KEY = "ddv-safe-scripting-session-v1";

  const CHECK_ITEMS = [
    { id: "shebang", label: "Shebang present (#!/usr/bin/env bash)" },
    { id: "set-e", label: "set -e (abort on failing command)" },
    { id: "set-u", label: "set -u (abort on unbound variable)" },
    { id: "pipefail", label: "set -o pipefail (fail if any pipe stage fails)" },
    { id: "quote", label: "Quote expansions: \"$var\" not $var" },
    { id: "dry-run", label: "Support --dry-run for destructive actions" },
  ];

  const SCENARIOS = {
    starter: {
      title: "Safe clean script",
      script: `#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
if [[ "\${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

TARGET="\${OUT_DIR:-build}"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] would rm -rf $TARGET"
else
  echo "removing $TARGET"
fi
`,
    },
    no_set_e: {
      title: "Missing set -e",
      script: `#!/usr/bin/env bash
false
echo "still running after failure"
`,
    },
    unbound: {
      title: "Unbound variable",
      script: `#!/usr/bin/env bash
set -u
echo "outdir=$OUTDIR"
`,
    },
    pipefail: {
      title: "Pipe without pipefail",
      script: `#!/usr/bin/env bash
set -e
false | echo "pipe continued"
echo "reached end"
`,
    },
    pipefail_on: {
      title: "Pipe with pipefail",
      script: `#!/usr/bin/env bash
set -euo pipefail
false | echo "pipe continued"
echo "reached end"
`,
    },
    unquoted: {
      title: "Unquoted path",
      script: `#!/usr/bin/env bash
set -euo pipefail
FILE="my design.v"
ls $FILE
`,
    },
    quoted: {
      title: "Quoted path",
      script: `#!/usr/bin/env bash
set -euo pipefail
FILE="my design.v"
ls "$FILE"
`,
    },
    dry_run: {
      title: "Dry-run clean",
      script: `#!/usr/bin/env bash
set -euo pipefail
DRY_RUN=0
[[ "\${1:-}" == "--dry-run" ]] && DRY_RUN=1
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] would delete logs/*.log"
else
  echo "deleted logs/*.log"
fi
`,
    },
  };

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
  let scenarioId = "starter";
  let scriptText = SCENARIOS.starter.script;
  let flags = { e: true, u: true, pipefail: true };
  /** @type {string[]} */
  let checkedIds = ["shebang", "set-e", "set-u", "pipefail", "quote", "dry-run"];
  /** @type {{text:string, kind:string}[]} */
  let trace = [];
  let lastExit = 0;
  let lastScenario = "starter";
  let lastHadDryRun = true;
  let lastQuoted = true;
  let argv = ["--dry-run"];

  const root = document.getElementById("ss-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> A clean script with
        <code>set -euo pipefail</code>, quoted vars, and <code>--dry-run</code>.
        Toggle flags / scenarios to see what breaks without each habit.</p>
      <button type="button" class="btn btn-secondary" id="ss-starter">Load starter example</button>
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
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Script + flags</h2></div>
        <div class="panel-body">
          <div class="scenario-tabs" id="scenario-tabs"></div>
          <div class="flags-row">
            <label><input type="checkbox" id="flag-e" checked /> set -e</label>
            <label><input type="checkbox" id="flag-u" checked /> set -u</label>
            <label><input type="checkbox" id="flag-pf" checked /> set -o pipefail</label>
          </div>
          <label style="font-size:0.85rem;display:block;margin-bottom:0.35rem">
            Args (space-separated)
            <input id="argv-in" value="--dry-run" spellcheck="false"
              style="display:block;width:100%;margin-top:0.25rem;font-family:var(--mono);padding:0.35rem 0.5rem;border:1px solid var(--line);border-radius:6px;background:var(--surface)" />
          </label>
          <textarea class="script-box" id="script-box" spellcheck="false"></textarea>
          <div class="tool-actions" style="margin-top:0.65rem">
            <button type="button" class="btn btn-primary" id="btn-run">Run script</button>
            <button type="button" class="btn btn-ghost" id="btn-scan">Scan checklist</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Checklist</h2>
          <span class="score-pill" id="score-pill">0/6</span>
        </div>
        <div class="panel-body">
          <ul class="checklist" id="checklist"></ul>
          <h3 style="font-size:0.95rem;margin:1rem 0 0.4rem">Trace</h3>
          <ul class="trace" id="trace"></ul>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Habits</h2></div>
      <div class="panel-body">
        <div class="habit-cards">
          <div class="habit-card">
            <h3>set -euo pipefail</h3>
            <p>Fail fast on errors, unbound vars, and failed pipe stages.</p>
          </div>
          <div class="habit-card">
            <h3>Quote expansions</h3>
            <p>Use <code>"$file"</code> so spaces don’t split into many words.</p>
          </div>
          <div class="habit-card">
            <h3>--dry-run</h3>
            <p>Print what would happen before deleting or overwriting.</p>
          </div>
        </div>
        <div class="quote-demo">
          <div class="box bad"><strong>Bad:</strong> <code>ls $FILE</code> with spaces → two arguments</div>
          <div class="box good"><strong>Good:</strong> <code>ls "$FILE"</code> → one path</div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Flag / habit</th><th>What it prevents</th></tr></thead>
          <tbody>
            <tr><td><code>set -e</code></td><td>Continuing after a failed command</td></tr>
            <tr><td><code>set -u</code></td><td>Silent empty expansion of typos / unset vars</td></tr>
            <tr><td><code>set -o pipefail</code></td><td>Ignoring a failing left side of a pipe</td></tr>
            <tr><td><code>"$var"</code></td><td>Word-splitting and globbing surprises</td></tr>
            <tr><td><code>--dry-run</code></td><td>Accidental destructive actions</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Prefer <code>\${1:-}</code> when reading optional args under <code>set -u</code>.</li>
          <li>Scan → fix → run with <code>--dry-run</code> before a real clean.</li>
        </ul>
      </div>
    </div>
  `;

  const scriptBox = document.getElementById("script-box");
  const checklistEl = document.getElementById("checklist");
  const scorePill = document.getElementById("score-pill");
  const traceEl = document.getElementById("trace");
  const tabsEl = document.getElementById("scenario-tabs");
  const argvIn = document.getElementById("argv-in");
  const flagE = document.getElementById("flag-e");
  const flagU = document.getElementById("flag-u");
  const flagPf = document.getElementById("flag-pf");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function scanScript(text) {
    const found = new Set();
    if (/^#!/.test(text.trim()) || /#!\/usr\/bin\/env bash/.test(text)) found.add("shebang");
    if (/\bset\s+-e\b/.test(text) || /\bset\s+-euo\b/.test(text) || /\bset\s+-eu\b/.test(text)) found.add("set-e");
    if (/\bset\s+-u\b/.test(text) || /\bset\s+-euo\b/.test(text) || /\bset\s+-eu\b/.test(text)) found.add("set-u");
    if (/pipefail/.test(text) || /\bset\s+-euo\b/.test(text)) found.add("pipefail");
    // quote: look for "$ or '${ patterns as positive signal; also count unquoted risk
    if (/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?"/.test(text) || /"\$\{?[A-Za-z_]/.test(text)) found.add("quote");
    if (/dry-run|DRY_RUN/.test(text)) found.add("dry-run");
    return found;
  }

  function renderChecklist() {
    const scanned = scanScript(scriptText);
    // merge: user toggles override display as "checked" for score; scan highlights
    checklistEl.innerHTML = "";
    CHECK_ITEMS.forEach((item) => {
      const on = checkedIds.includes(item.id);
      const scannedOn = scanned.has(item.id);
      const li = document.createElement("li");
      li.innerHTML = `<input type="checkbox" data-id="${item.id}" ${on ? "checked" : ""} />
        <span class="${on ? "done" : "todo"}">${escapeHtml(item.label)}${scannedOn ? " · <em>detected</em>" : ""}</span>`;
      li.querySelector("input").addEventListener("change", (e) => {
        const id = item.id;
        if (e.target.checked) {
          if (!checkedIds.includes(id)) checkedIds = [...checkedIds, id];
        } else {
          checkedIds = checkedIds.filter((x) => x !== id);
        }
        renderChecklist();
        saveSession();
      });
      checklistEl.appendChild(li);
    });
    scorePill.textContent = `${checkedIds.length}/${CHECK_ITEMS.length}`;
  }

  function renderTrace() {
    traceEl.innerHTML = trace.length
      ? trace
          .map((t) => `<li class="${t.kind}">${escapeHtml(t.text)}</li>`)
          .join("")
      : `<li>Run a script to see the trace</li>`;
  }

  function renderTabs() {
    tabsEl.innerHTML = "";
    Object.keys(SCENARIOS).forEach((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = SCENARIOS[id].title;
      if (id === scenarioId) b.classList.add("is-active");
      b.addEventListener("click", () => {
        scenarioId = id;
        scriptText = SCENARIOS[id].script;
        scriptBox.value = scriptText;
        // sync flag checkboxes from script content heuristically
        const s = scanScript(scriptText);
        flags.e = s.has("set-e");
        flags.u = s.has("set-u");
        flags.pipefail = s.has("pipefail");
        flagE.checked = flags.e;
        flagU.checked = flags.u;
        flagPf.checked = flags.pipefail;
        if (id === "dry_run" || id === "starter") argvIn.value = "--dry-run";
        else argvIn.value = "";
        renderTabs();
        renderChecklist();
        saveSession();
      });
      tabsEl.appendChild(b);
    });
  }

  function applyFlagsToEnv() {
    flags.e = flagE.checked;
    flags.u = flagU.checked;
    flags.pipefail = flagPf.checked;
  }

  /**
   * Simplified interpreter for teaching scenarios.
   */
  function runScript() {
    applyFlagsToEnv();
    scriptText = scriptBox.value;
    argv = argvIn.value.trim() ? argvIn.value.trim().split(/\s+/) : [];
    trace = [];
    lastExit = 0;
    lastScenario = scenarioId;
    lastHadDryRun = /dry-run|DRY_RUN/.test(scriptText);
    lastQuoted = /"\$|\$\{[^}]+\}"/.test(scriptText) || /"\$FILE"/.test(scriptText);

    let e = flags.e;
    let u = flags.u;
    let pf = flags.pipefail;
    /** @type {Record<string,string>} */
    const env = { OUT_DIR: "build" };
    let dryRun = argv.includes("--dry-run") ? "1" : "0";

    const lines = scriptText.replace(/\r\n/g, "\n").split("\n");
    let i = 0;

    function expand(s) {
      if (u && /\$\{?OUTDIR\}?/.test(s) && env.OUTDIR == null) {
        throw { code: 1, msg: "OUTDIR: unbound variable" };
      }
      return s
        .replace(/\$\{1:-\}/g, argv[0] || "")
        .replace(/\$\{OUT_DIR:-([^}]+)\}/g, (_, d) => env.OUT_DIR || d)
        .replace(/\$\{OUTDIR\}/g, env.OUTDIR || "")
        .replace(/\$OUTDIR\b/g, env.OUTDIR || "")
        .replace(/\$DRY_RUN\b/g, dryRun)
        .replace(/\$TARGET\b/g, env.TARGET || "")
        .replace(/\$FILE\b/g, env.FILE || "")
        .replace(/\$1\b/g, argv[0] || "");
    }

    try {
      let m;
      while (i < lines.length) {
        let line = lines[i].trim();
        i++;
        if (!line || line.startsWith("#") || line.startsWith("#!")) {
          if (line.startsWith("#!")) trace.push({ text: line, kind: "ok" });
          continue;
        }

        // set flags in script override toggles when present
        if (/^set\s+-euo\s+pipefail$/.test(line) || /^set\s+-euo\s+pipefail\b/.test(line)) {
          e = u = pf = true;
          trace.push({ text: line, kind: "ok" });
          continue;
        }
        if (/^set\s+-e$/.test(line)) {
          e = true;
          trace.push({ text: line, kind: "ok" });
          continue;
        }
        if (/^set\s+-u$/.test(line)) {
          u = true;
          trace.push({ text: line, kind: "ok" });
          continue;
        }
        if (/^set\s+-o\s+pipefail$/.test(line)) {
          pf = true;
          trace.push({ text: line, kind: "ok" });
          continue;
        }

        if (/^DRY_RUN=0$/.test(line)) {
          dryRun = "0";
          trace.push({ text: line, kind: "ok" });
          continue;
        }
        if (line.includes('== "--dry-run"') || line.includes("== '--dry-run'")) {
          if (argv[0] === "--dry-run") dryRun = "1";
          trace.push({ text: `parse args → DRY_RUN=${dryRun}`, kind: "ok" });
          // skip until rough end of if for simple demos — handle single-line [[ ]] && 
          if (line.includes("&&")) {
            /* already applied */
          }
          continue;
        }

        if ((m = line.match(/^FILE="([^"]*)"$/))) {
          env.FILE = m[1];
          trace.push({ text: `FILE=${env.FILE}`, kind: "ok" });
          continue;
        }
        if ((m = line.match(/^TARGET="(.*)"$/))) {
          env.TARGET = expand(m[1]).replace(/^"|"$/g, "");
          // handle ${OUT_DIR:-build}
          const tm = m[1].match(/\$\{OUT_DIR:-([^}]+)\}/);
          if (tm) env.TARGET = env.OUT_DIR || tm[1];
          trace.push({ text: `TARGET=${env.TARGET}`, kind: "ok" });
          continue;
        }

        // if dry-run branch
        if (/\[\[\s*"\$DRY_RUN"\s+-eq\s+1\s*\]\]/.test(line) || /\[\[\s+"\$DRY_RUN"\s+-eq\s+1/.test(line)) {
          // consume until else/fi roughly
          const block = [];
          while (i < lines.length) {
            const l = lines[i].trim();
            i++;
            if (l === "else") break;
            if (l === "fi") break;
            if (l) block.push(l);
          }
          const elseBlock = [];
          if (lines[i - 1] && lines[i - 1].trim() === "else") {
            while (i < lines.length) {
              const l = lines[i].trim();
              i++;
              if (l === "fi") break;
              if (l) elseBlock.push(l);
            }
          }
          const chosen = dryRun === "1" ? block : elseBlock;
          for (const stmt of chosen) {
            runStmt(stmt);
          }
          continue;
        }

        runStmt(line);
      }
    } catch (err) {
      if (err && err.msg) {
        trace.push({ text: `ABORT: ${err.msg}`, kind: "fail" });
        lastExit = err.code || 1;
      } else {
        trace.push({ text: `ABORT: ${String(err)}`, kind: "fail" });
        lastExit = 1;
      }
      renderTrace();
      saveSession();
      return;
    }

    function runStmt(line) {
      let m;
      if (line === "false") {
        trace.push({ text: "false → status 1", kind: "fail" });
        if (e) throw { code: 1, msg: "command failed: false (set -e)" };
        lastExit = 1;
        return;
      }
      if (line.startsWith("echo ")) {
        const msg = expand(line.slice(5).replace(/^"|"$/g, "").replace(/^'/g, "").replace(/'$/g, ""));
        // crude: strip quotes around whole
        let out = line.slice(5);
        if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
          out = out.slice(1, -1);
        }
        out = expand(out);
        trace.push({ text: `echo → ${out}`, kind: "ok" });
        lastExit = 0;
        return;
      }
      if (line.includes("|")) {
        const stages = line.split("|").map((s) => s.trim());
        let status = 0;
        for (const st of stages) {
          if (st === "false") {
            status = 1;
            trace.push({ text: `pipe stage: false → 1`, kind: "warn" });
          } else if (st.startsWith("echo ")) {
            let out = st.slice(5);
            if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
              out = out.slice(1, -1);
            }
            out = expand(out);
            trace.push({ text: `pipe stage: echo → ${out}`, kind: "ok" });
            if (status === 0) status = 0;
          }
        }
        const final = pf ? status : 0; // without pipefail, echo success masks false
        if (!pf && status !== 0) {
          trace.push({ text: "pipefail off → overall status 0 (failure masked)", kind: "warn" });
        }
        lastExit = final;
        if (e && final !== 0) throw { code: final, msg: "pipeline failed (pipefail + set -e)" };
        return;
      }
      if ((m = line.match(/^ls\s+(\S.*)$/))) {
        let arg = m[1].trim();
        const quoted = (arg.startsWith('"') && arg.endsWith('"')) || arg === '"$FILE"';
        arg = expand(arg.replace(/^"|"$/g, ""));
        if (!quoted && env.FILE && env.FILE.includes(" ")) {
          trace.push({
            text: `ls unquoted → split into: ${env.FILE.split(/\s+/).join(" , ")}`,
            kind: "fail",
          });
          lastExit = 2;
          if (e) throw { code: 2, msg: "ls failed (path split by spaces)" };
          return;
        }
        trace.push({ text: `ls "${arg}" → ok (lab)`, kind: "ok" });
        lastExit = 0;
        return;
      }
      if (line.startsWith("[[") || line.startsWith("if ")) {
        trace.push({ text: line, kind: "ok" });
        return;
      }
      // ignore fi/else leftovers
      if (line === "fi" || line === "else" || line === "then") return;
      trace.push({ text: `(skip/unsupported in lab) ${line}`, kind: "skip" });
    }

    if (lastExit === 0) trace.push({ text: `exit ${lastExit}`, kind: "ok" });
    else trace.push({ text: `exit ${lastExit}`, kind: "fail" });
    renderTrace();
    renderChecklist();
    saveSession();
  }

  function loadStarter() {
    scenarioId = "starter";
    scriptText = SCENARIOS.starter.script;
    scriptBox.value = scriptText;
    flags = { e: true, u: true, pipefail: true };
    flagE.checked = true;
    flagU.checked = true;
    flagPf.checked = true;
    argvIn.value = "--dry-run";
    checkedIds = CHECK_ITEMS.map((c) => c.id);
    trace = [];
    lastExit = 0;
    renderTabs();
    renderChecklist();
    renderTrace();
    runScript();
    saveSession();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          scenarioId,
          scriptText: scriptBox.value,
          flags: { e: flagE.checked, u: flagU.checked, pipefail: flagPf.checked },
          checkedIds,
          argv: argvIn.value,
          trace,
          lastExit,
        })
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
      scenarioId = data.scenarioId || "starter";
      scriptText = data.scriptText || SCENARIOS.starter.script;
      scriptBox.value = scriptText;
      flagE.checked = data.flags ? !!data.flags.e : true;
      flagU.checked = data.flags ? !!data.flags.u : true;
      flagPf.checked = data.flags ? !!data.flags.pipefail : true;
      checkedIds = Array.isArray(data.checkedIds) ? data.checkedIds : [];
      argvIn.value = data.argv || "--dry-run";
      trace = Array.isArray(data.trace) ? data.trace : [];
      lastExit = data.lastExit || 0;
      return true;
    } catch {
      return false;
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-e",
      title: "Quiz: -e",
      prompt: "<code>set -e</code> aborts when a command? Answer: <code>fails</code>",
      hint: "fails / non-zero",
      type: "text",
      answer: "fails",
      alt: ["fail", "errors", "non-zero", "returns non-zero"],
    },
    {
      id: "quiz-u",
      title: "Quiz: -u",
      prompt: "<code>set -u</code> catches? Answer: <code>unbound</code> variables",
      hint: "unbound / unset",
      type: "text",
      answer: "unbound",
      alt: ["unset", "undefined", "unbound variables"],
    },
    {
      id: "quiz-pipefail",
      title: "Quiz: pipefail",
      prompt: "<code>pipefail</code> makes a pipeline fail if? Answer: <code>any</code> stage fails",
      hint: "any stage / any command in the pipe",
      type: "text",
      answer: "any",
      alt: ["any stage", "any command", "left side", "a stage"],
    },
    {
      id: "run-starter",
      title: "Run starter",
      prompt: "Load/run the safe starter with <code>--dry-run</code> — trace should mention dry-run.",
      hint: "Load starter example",
      type: "state",
      check: () => trace.some((t) => /dry-run/i.test(t.text)) && lastExit === 0,
    },
    {
      id: "scenario-no-e",
      title: "Missing -e",
      prompt: "Open scenario “Missing set -e”, enable set -e toggle, Run — should ABORT before “still running”.",
      hint: "Scenario tab + check set -e + Run",
      type: "state",
      check: () =>
        scenarioId === "no_set_e" &&
        flagE.checked &&
        trace.some((t) => /ABORT|still running/i.test(t.text)) &&
        !trace.some((t) => /echo → still running/.test(t.text) && t.kind === "ok"),
    },
    {
      id: "unbound-abort",
      title: "Unbound abort",
      prompt: "Run “Unbound variable” scenario with set -u on — ABORT on OUTDIR.",
      hint: "Unbound variable tab, set -u checked, Run",
      type: "state",
      check: () =>
        scenarioId === "unbound" &&
        flagU.checked &&
        trace.some((t) => /unbound variable/i.test(t.text)),
    },
    {
      id: "pipe-mask",
      title: "Pipe masked",
      prompt: "“Pipe without pipefail”: leave pipefail off, Run — warning about masked failure.",
      hint: "Pipe without pipefail scenario",
      type: "state",
      check: () =>
        scenarioId === "pipefail" &&
        !flagPf.checked &&
        trace.some((t) => /masked|pipefail off/i.test(t.text)),
    },
    {
      id: "pipe-catch",
      title: "Pipefail catches",
      prompt: "Run “Pipe with pipefail” — should ABORT (pipeline failed).",
      hint: "Pipe with pipefail scenario",
      type: "state",
      check: () =>
        scenarioId === "pipefail_on" &&
        trace.some((t) => /ABORT|pipeline failed/i.test(t.text)),
    },
    {
      id: "unquoted-split",
      title: "Unquoted split",
      prompt: "Run “Unquoted path” — trace shows path split by spaces.",
      hint: "Unquoted path scenario",
      type: "state",
      check: () =>
        scenarioId === "unquoted" &&
        trace.some((t) => /split/i.test(t.text)),
    },
    {
      id: "quoted-ok",
      title: "Quoted ok",
      prompt: "Run “Quoted path” — ls succeeds.",
      hint: "Quoted path scenario",
      type: "state",
      check: () =>
        scenarioId === "quoted" &&
        trace.some((t) => /ls .*→ ok/i.test(t.text)) &&
        lastExit === 0,
    },
    {
      id: "dry-run-msg",
      title: "Dry-run msg",
      prompt: "Dry-run clean with args <code>--dry-run</code> — echo would delete…",
      hint: "Dry-run clean tab",
      type: "state",
      check: () =>
        scenarioId === "dry_run" &&
        argvIn.value.includes("--dry-run") &&
        trace.some((t) => /\[dry-run\]/i.test(t.text)),
    },
    {
      id: "quiz-quote",
      title: "Quiz: quote",
      prompt: "Always prefer? Answer: <code>\"$var\"</code>",
      hint: "double-quoted expansion",
      type: "text",
      answer: '"$var"',
      alt: ["\"$var\"", "$var quoted", "quoted", '"$FILE"'],
    },
    {
      id: "quiz-dry",
      title: "Quiz: dry-run",
      prompt: "<code>--dry-run</code> should? Answer: <code>print</code> or <code>preview</code>",
      hint: "show what would happen",
      type: "text",
      answer: "print",
      alt: ["preview", "show", "list", "simulate"],
    },
    {
      id: "scan-full",
      title: "Scan full",
      prompt: "On starter script, click Scan checklist — all 6 items should be checked.",
      hint: "Load starter, Scan checklist",
      type: "state",
      check: () => checkedIds.length === 6 && scanScript(scriptBox.value).size >= 5,
    },
    {
      id: "shebang-quiz",
      title: "Quiz: shebang",
      prompt: "Recommended shebang uses? Answer: <code>env bash</code> or <code>#!/usr/bin/env bash</code>",
      hint: "#!/usr/bin/env bash",
      type: "text",
      answer: "#!/usr/bin/env bash",
      alt: ["env bash", "/usr/bin/env bash", "bash"],
    },
    {
      id: "combo-line",
      title: "Combo line",
      prompt: "What one-liner enables e, u, and pipefail? Answer: <code>set -euo pipefail</code>",
      hint: "set -euo pipefail",
      type: "text",
      answer: "set -euo pipefail",
      alt: ["set -euo pipefail"],
    },
    {
      id: "optional-arg",
      title: "Quiz: ${1:-}",
      prompt: "Under <code>set -u</code>, optional arg pattern is? Answer: <code>${1:-}</code>",
      hint: "${1:-} or ${1:-default}",
      type: "text",
      answer: "${1:-}",
      alt: ["${1:-}", "${1:-default}", "\${1:-}"],
    },
    {
      id: "real-delete",
      title: "Real delete",
      prompt: "Dry-run clean with <em>empty</em> args — should print deleted (not dry-run).",
      hint: "Clear args, Run dry-run scenario",
      type: "state",
      check: () =>
        scenarioId === "dry_run" &&
        !argvIn.value.trim() &&
        trace.some((t) => /deleted/i.test(t.text) && !/\[dry-run\]/.test(t.text)),
    },
    {
      id: "score-habit",
      title: "Score 6/6",
      prompt: "Manually ensure checklist score shows 6/6.",
      hint: "Tick all boxes or Scan on starter",
      type: "state",
      check: () => checkedIds.length === 6,
    },
    {
      id: "quiz-order",
      title: "Quiz: order",
      prompt: "Before deleting files, run with? Answer: <code>--dry-run</code>",
      hint: "--dry-run first",
      type: "text",
      answer: "--dry-run",
      alt: ["dry-run", "dry run"],
    },
    {
      id: "toggle-off-e",
      title: "Toggle off -e",
      prompt: "Missing set -e scenario, uncheck set -e, Run — “still running” appears.",
      hint: "Uncheck set -e",
      type: "state",
      check: () =>
        scenarioId === "no_set_e" &&
        !flagE.checked &&
        trace.some((t) => /still running/i.test(t.text)),
    },
    {
      id: "quiz-why",
      title: "Quiz: why",
      prompt: "Safe scripting’s goal is to avoid? Answer: <code>accidents</code> or <code>silent failure</code>",
      hint: "accidents / silent failures",
      type: "text",
      answer: "silent failure",
      alt: ["accidents", "accident", "silent failures", "data loss", "surprise"],
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[“”]/g, '"');
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
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint ? "Hide hint" : "Show hint";
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:18rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use scenarios / Run / Scan, then Check.</span>`;
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
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function checkChallenge() {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
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

  document.getElementById("ss-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-run").addEventListener("click", runScript);
  document.getElementById("btn-scan").addEventListener("click", () => {
    scriptText = scriptBox.value;
    const found = scanScript(scriptText);
    checkedIds = CHECK_ITEMS.map((c) => c.id).filter((id) => found.has(id));
    // if euo detected via set -euo, mark all three
    if (/set\s+-euo/.test(scriptText)) {
      ["set-e", "set-u", "pipefail"].forEach((id) => {
        if (!checkedIds.includes(id)) checkedIds.push(id);
      });
    }
    renderChecklist();
    saveSession();
  });
  scriptBox.addEventListener("input", () => {
    scriptText = scriptBox.value;
    saveSession();
  });
  [flagE, flagU, flagPf].forEach((el) =>
    el.addEventListener("change", () => {
      applyFlagsToEnv();
      saveSession();
    })
  );
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
    renderChallenge();
  });

  if (!loadSession()) loadStarter();
  else {
    renderTabs();
    renderChecklist();
    renderTrace();
  }
  renderChallenge();
})();
