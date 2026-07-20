(() => {
  const FILES = {
    "names.txt": "alice\nbob\nalice\ncharlie\nbob\nalice\ndiana\n",
    "numbers.txt": "10\n2\n100\n1\n20\n5\n",
    "sample.log":
      "[ERROR] timeout\n[INFO] start\n[WARNING] retry\n[ERROR] timeout\n[INFO] end\n[ERROR] timeout\n",
    "csv_like.txt":
      "name,count,date\nalice,10,2024-01-01\nbob,20,2024-01-02\ncharlie,15,2024-01-03\n",
    "log_like.txt":
      "[INFO] start simulation\n[WARNING] timeout near\n[ERROR] assertion failed\n[INFO] end\n",
    "fixed.txt": "ABCDEFGHIJ\n0123456789\nrtl_top_v1\n",
  };

  const STARTER_PIPE = "sort names.txt | uniq -c";
  const CLEARED_KEY = "ddv-sort-uniq-cut-cleared-v1";
  const STORE_KEY = "ddv-sort-uniq-cut-session-v1";

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
  let activeFile = "names.txt";
  let lastPipe = STARTER_PIPE;
  /** @type {string[]} */
  let lastOut = [];
  /** @type {string[]} */
  let lastStages = [];
  let lastOk = false;
  /** @type {{kind:string,text:string}[]} */
  let screen = [];

  const root = document.getElementById("su-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>${STARTER_PIPE}</code> —
        sort first so duplicates become adjacent, then count each name.
        Try <code>sort -n numbers.txt</code> and
        <code>cut -d',' -f1 csv_like.txt</code>.</p>
      <button type="button" class="btn btn-secondary" id="su-starter">Load starter example</button>
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
        <div class="panel-head"><h2>Pipeline</h2></div>
        <div class="panel-body">
          <div class="pipe-row">
            <label>Command
              <input id="pipe-in" value="${STARTER_PIPE}" spellcheck="false" autocomplete="off" />
            </label>
            <button type="button" class="btn btn-primary" id="btn-run">Run</button>
          </div>
          <div class="stages" id="stages"></div>
          <div class="su-term">
            <div class="su-scroll" id="term-scroll"></div>
            <div class="su-prompt-row">
              <span class="su-prompt">lab$</span>
              <input class="su-line" id="line-input" type="text" autocomplete="off" spellcheck="false"
                placeholder="sort · uniq · cut · cat · help" aria-label="Command line" />
            </div>
          </div>
          <div class="quick-row" id="quick-row"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Input / output</h2></div>
        <div class="panel-body">
          <div class="data-tabs" id="data-tabs"></div>
          <div class="io-grid">
            <div class="io-pane">
              <h3>File</h3>
              <pre class="io-box" id="in-box"></pre>
            </div>
            <div class="io-pane">
              <h3>Last stdout</h3>
              <pre class="io-box" id="out-box"></pre>
              <p class="meta" id="out-meta"></p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>Command</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>sort file</code></td><td>Alphabetical line sort</td></tr>
            <tr><td><code>sort -n</code> / <code>-r</code> / <code>-u</code></td><td>Numeric / reverse / unique</td></tr>
            <tr><td><code>uniq</code></td><td>Drop <em>adjacent</em> duplicates (sort first!)</td></tr>
            <tr><td><code>uniq -c</code></td><td>Count adjacent duplicates</td></tr>
            <tr><td><code>cut -d',' -f1,3</code></td><td>Fields by delimiter</td></tr>
            <tr><td><code>cut -c1-5</code></td><td>Character columns</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li><code>uniq</code> alone on unsorted input misses non-adjacent duplicates.</li>
          <li>Classic log pattern: <code>grep … | sort | uniq -c</code>.</li>
        </ul>
      </div>
    </div>
  `;

  const pipeIn = document.getElementById("pipe-in");
  const stagesEl = document.getElementById("stages");
  const scrollEl = document.getElementById("term-scroll");
  const inputEl = document.getElementById("line-input");
  const inBox = document.getElementById("in-box");
  const outBox = document.getElementById("out-box");
  const outMeta = document.getElementById("out-meta");
  const tabsEl = document.getElementById("data-tabs");

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function linesOf(text) {
    const s = String(text).replace(/\r\n/g, "\n");
    if (s === "") return [];
    const parts = s.split("\n");
    if (parts.length && parts[parts.length - 1] === "") parts.pop();
    return parts;
  }

  function textOf(lines) {
    return lines.length ? lines.join("\n") + "\n" : "";
  }

  function pushScreen(kind, text) {
    screen.push({ kind, text });
    if (screen.length > 80) screen = screen.slice(-60);
  }

  function renderScreen() {
    scrollEl.innerHTML = screen
      .map((row) => {
        const cls =
          row.kind === "cmd"
            ? ""
            : row.kind === "err"
              ? "err"
              : row.kind === "muted"
                ? "muted"
                : "out";
        const prefix = row.kind === "cmd" ? `<span class="muted">lab$ </span>` : "";
        return `<div class="${cls}">${prefix}${escapeHtml(row.text)}</div>`;
      })
      .join("");
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderTabs() {
    tabsEl.innerHTML = "";
    Object.keys(FILES).forEach((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      if (name === activeFile) b.classList.add("is-active");
      b.addEventListener("click", () => {
        activeFile = name;
        renderTabs();
        inBox.textContent = FILES[activeFile];
      });
      tabsEl.appendChild(b);
    });
    inBox.textContent = FILES[activeFile];
  }

  function renderOut() {
    outBox.textContent = lastOut.length ? textOf(lastOut) : "(empty)";
    outMeta.textContent = lastOk
      ? `${lastOut.length} line(s) · ${lastStages.join(" → ") || "—"}`
      : "—";
    stagesEl.innerHTML = lastStages.length
      ? lastStages
          .map((s, i) => `${i ? '<span class="arrow">→</span>' : ""}<span>${escapeHtml(s)}</span>`)
          .join("")
      : "";
  }

  function renderAll() {
    renderScreen();
    renderTabs();
    renderOut();
  }

  function cmdSort(lines, args) {
    let numeric = false;
    let reverse = false;
    let unique = false;
    const flags = [];
    for (const a of args) {
      if (a.startsWith("-") && !a.startsWith("--")) {
        if (a.includes("n")) numeric = true;
        if (a.includes("r")) reverse = true;
        if (a.includes("u")) unique = true;
        flags.push(a);
      }
    }
    const sorted = [...lines].sort((a, b) => {
      if (numeric) {
        const na = parseFloat(a);
        const nb = parseFloat(b);
        const ca = Number.isFinite(na) ? na : 0;
        const cb = Number.isFinite(nb) ? nb : 0;
        return ca - cb;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    });
    if (reverse) sorted.reverse();
    if (unique) {
      const out = [];
      for (const line of sorted) {
        if (!out.length || out[out.length - 1] !== line) out.push(line);
      }
      return { lines: out, label: `sort ${flags.join(" ") || ""}`.trim() };
    }
    return { lines: sorted, label: `sort ${flags.join(" ") || ""}`.trim() || "sort" };
  }

  function cmdUniq(lines, args) {
    let count = false;
    for (const a of args) {
      if (a === "-c" || (a.startsWith("-") && a.includes("c"))) count = true;
    }
    const out = [];
    let i = 0;
    while (i < lines.length) {
      let j = i + 1;
      while (j < lines.length && lines[j] === lines[i]) j++;
      const n = j - i;
      if (count) out.push(String(n).padStart(7) + " " + lines[i]);
      else out.push(lines[i]);
      i = j;
    }
    return { lines: out, label: count ? "uniq -c" : "uniq" };
  }

  function parseFieldList(spec) {
    /** @type {number[]} */
    const fields = [];
    for (const part of spec.split(",")) {
      if (part.includes("-")) {
        const [a, b] = part.split("-").map(Number);
        for (let i = a; i <= b; i++) fields.push(i);
      } else fields.push(Number(part));
    }
    return fields.filter((n) => n > 0);
  }

  function cmdCut(lines, args) {
    let delim = "\t";
    let fieldSpec = "";
    let charSpec = "";
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-d" && args[i + 1] != null) {
        delim = args[++i];
        if (delim === "','" || delim === "','") delim = ",";
        if ((delim.startsWith("'") && delim.endsWith("'")) || (delim.startsWith('"') && delim.endsWith('"'))) {
          delim = delim.slice(1, -1);
        }
        if (delim === "\\t") delim = "\t";
      } else if (a.startsWith("-d") && a.length > 2) {
        delim = a.slice(2);
        if ((delim.startsWith("'") && delim.endsWith("'")) || (delim.startsWith('"') && delim.endsWith('"'))) {
          delim = delim.slice(1, -1);
        }
      } else if (a === "-f" && args[i + 1] != null) {
        fieldSpec = args[++i];
      } else if (a.startsWith("-f") && a.length > 2) {
        fieldSpec = a.slice(2);
      } else if (a === "-c" && args[i + 1] != null) {
        charSpec = args[++i];
      } else if (a.startsWith("-c") && a.length > 2) {
        charSpec = a.slice(2);
      }
    }

    if (charSpec) {
      const ranges = charSpec.split(",").map((r) => {
        if (r.includes("-")) {
          const [a, b] = r.split("-").map(Number);
          return [a, b];
        }
        const n = Number(r);
        return [n, n];
      });
      const out = lines.map((line) => {
        let s = "";
        for (const [a, b] of ranges) {
          s += line.slice(Math.max(0, a - 1), b);
        }
        return s;
      });
      return { lines: out, label: `cut -c${charSpec}` };
    }

    if (!fieldSpec) {
      return { error: "cut: you must specify a list of bytes, characters, or fields" };
    }
    const fields = parseFieldList(fieldSpec);
    const out = lines.map((line) => {
      const cols = line.split(delim);
      return fields.map((f) => (cols[f - 1] != null ? cols[f - 1] : "")).join(delim);
    });
    const dLabel = delim === "\t" ? "\\t" : delim === " " ? "' '" : `'${delim}'`;
    return { lines: out, label: `cut -d${dLabel} -f${fieldSpec}` };
  }

  function tokenize(stage) {
    // keep quoted -d',' as one token roughly
    const tokens = [];
    const re = /'[^']*'|"[^"]*"|\S+/g;
    let m;
    while ((m = re.exec(stage))) tokens.push(m[0]);
    return tokens;
  }

  function runPipeline(raw) {
    const t = raw.trim();
    if (!t) return { ok: false, out: [], stages: [], err: "empty" };
    const stages = t.split("|").map((s) => s.trim()).filter(Boolean);
    /** @type {string[]} */
    let cur = [];
    /** @type {string[]} */
    const labels = [];
    let started = false;

    for (let si = 0; si < stages.length; si++) {
      const tokens = tokenize(stages[si]);
      if (!tokens.length) continue;
      const cmd = tokens[0];
      const rest = tokens.slice(1);

      if (cmd === "cat") {
        const file = rest[0];
        if (!file || !FILES[file]) return { ok: false, out: [], stages: labels, err: `cat: ${file || "?"}: no such file` };
        cur = linesOf(FILES[file]);
        activeFile = file;
        labels.push(`cat ${file}`);
        started = true;
        continue;
      }

      // First stage may be: sort file, cut ... file, uniq file
      let args = rest;
      let fileArg = null;
      if (!started) {
        // find trailing filename among known files
        for (let i = rest.length - 1; i >= 0; i--) {
          if (FILES[rest[i]]) {
            fileArg = rest[i];
            args = rest.slice(0, i).concat(rest.slice(i + 1));
            // actually rest without file: all except that index
            args = rest.filter((_, idx) => idx !== i);
            break;
          }
        }
        if (fileArg) {
          cur = linesOf(FILES[fileArg]);
          activeFile = fileArg;
          started = true;
        } else if (cmd === "sort" || cmd === "uniq" || cmd === "cut") {
          return { ok: false, out: [], stages: labels, err: `${cmd}: missing input file (or pipe)` };
        }
      }

      if (cmd === "sort") {
        const r = cmdSort(cur, args);
        cur = r.lines;
        labels.push(fileArg ? `${r.label} ${fileArg}`.trim() : r.label);
        started = true;
      } else if (cmd === "uniq") {
        const r = cmdUniq(cur, args);
        cur = r.lines;
        labels.push(fileArg ? `${r.label} ${fileArg}`.trim() : r.label);
        started = true;
      } else if (cmd === "cut") {
        const r = cmdCut(cur, args);
        if (r.error) return { ok: false, out: [], stages: labels, err: r.error };
        cur = r.lines;
        labels.push(fileArg ? `${r.label} ${fileArg}`.trim() : r.label);
        started = true;
      } else if (cmd === "grep") {
        // minimal: grep PATTERN [file] or grep from pipe
        let pattern = args[0] || "";
        if ((pattern.startsWith("'") && pattern.endsWith("'")) || (pattern.startsWith('"') && pattern.endsWith('"'))) {
          pattern = pattern.slice(1, -1);
        }
        if (fileArg && !started) {
          /* already loaded */
        }
        cur = cur.filter((line) => line.includes(pattern));
        labels.push(`grep ${pattern}`);
        started = true;
      } else if (cmd === "wc") {
        if (args.includes("-l") || args[0] === "-l") {
          cur = [String(cur.length)];
          labels.push("wc -l");
        } else {
          cur = [`${cur.length} lines`];
          labels.push("wc");
        }
      } else {
        return { ok: false, out: [], stages: labels, err: `lab: unsupported command: ${cmd}` };
      }
    }

    return { ok: true, out: cur, stages: labels, err: "" };
  }

  function applyResult(raw, result) {
    lastPipe = raw.trim();
    lastStages = result.stages;
    lastOk = result.ok;
    lastOut = result.ok ? result.out : [];
    pushScreen("cmd", raw.trim());
    if (!result.ok) {
      pushScreen("err", result.err || "error");
    } else if (!result.out.length) {
      pushScreen("muted", "(no output)");
    } else {
      result.out.forEach((line) => pushScreen("out", line));
    }
    pipeIn.value = raw.trim();
    renderAll();
    saveSession();
  }

  function runRaw(raw) {
    const t = raw.trim();
    if (!t) return;
    if (t === "help") {
      pushScreen("cmd", t);
      pushScreen(
        "out",
        "sort [-nru] FILE · uniq [-c] · cut -dX -fN · cut -cN-M · cat FILE · pipes with |"
      );
      renderScreen();
      return;
    }
    const result = runPipeline(t);
    applyResult(t, result);
  }

  function loadStarter() {
    activeFile = "names.txt";
    screen = [{ kind: "muted", text: "Starter pipeline ready — Run or edit the command" }];
    const result = runPipeline(STARTER_PIPE);
    lastPipe = STARTER_PIPE;
    lastStages = result.stages;
    lastOk = result.ok;
    lastOut = result.out;
    pipeIn.value = STARTER_PIPE;
    pushScreen("cmd", STARTER_PIPE);
    result.out.forEach((line) => pushScreen("out", line));
    renderAll();
    saveSession();
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          activeFile,
          lastPipe,
          lastOut,
          lastStages,
          lastOk,
          screen: screen.slice(-40),
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
      activeFile = data.activeFile || "names.txt";
      lastPipe = data.lastPipe || STARTER_PIPE;
      lastOut = Array.isArray(data.lastOut) ? data.lastOut : [];
      lastStages = Array.isArray(data.lastStages) ? data.lastStages : [];
      lastOk = !!data.lastOk;
      screen = Array.isArray(data.screen) ? data.screen : [];
      pipeIn.value = lastPipe;
      return true;
    } catch {
      return false;
    }
  }

  const QUICK = [
    { label: "sort | uniq -c", cmd: "sort names.txt | uniq -c" },
    { label: "sort -n", cmd: "sort -n numbers.txt" },
    { label: "sort -u", cmd: "sort -u names.txt" },
    { label: "uniq alone", cmd: "uniq names.txt" },
    { label: "cut names", cmd: "cut -d',' -f1 csv_like.txt" },
    { label: "cut -f1,3", cmd: "cut -d',' -f1,3 csv_like.txt" },
    { label: "errors | uniq -c", cmd: "grep ERROR sample.log | sort | uniq -c" },
    { label: "cut -c1-5", cmd: "cut -c1-5 fixed.txt" },
  ];
  const quickRow = document.getElementById("quick-row");
  QUICK.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q.label;
    b.addEventListener("click", () => runRaw(q.cmd));
    quickRow.appendChild(b);
  });

  function outEquals(expected) {
    const exp = Array.isArray(expected) ? expected : linesOf(expected);
    if (lastOut.length !== exp.length) return false;
    return lastOut.every((l, i) => l === exp[i]);
  }

  function pipeNorm(s) {
    return String(s).trim().replace(/\s+/g, " ");
  }

  const CHALLENGES = [
    {
      id: "quiz-sort",
      title: "Quiz: sort",
      prompt: "<code>sort</code> orders? Answer: <code>lines</code>",
      hint: "lines of text",
      type: "text",
      answer: "lines",
      alt: ["line", "rows"],
    },
    {
      id: "run-starter",
      title: "Run starter",
      prompt: "Run <code>sort names.txt | uniq -c</code> (button or Run).",
      hint: "Load starter / quick button",
      type: "state",
      check: () =>
        pipeNorm(lastPipe) === "sort names.txt | uniq -c" &&
        lastOut.some((l) => l.includes("alice")),
    },
    {
      id: "alice-count",
      title: "alice count",
      prompt: "After <code>sort names.txt | uniq -c</code>, how many times is alice counted? (number)",
      hint: "3",
      type: "text",
      answer: "3",
      setup: () => runRaw("sort names.txt | uniq -c"),
    },
    {
      id: "quiz-uniq-adj",
      title: "Quiz: uniq",
      prompt: "<code>uniq</code> removes only? Answer: <code>adjacent</code> duplicates",
      hint: "adjacent / consecutive",
      type: "text",
      answer: "adjacent",
      alt: ["consecutive", "adjacent duplicates", "neighboring"],
    },
    {
      id: "uniq-alone",
      title: "uniq alone",
      prompt: "Run <code>uniq names.txt</code> (unsorted) — alice still appears more than once.",
      hint: "uniq names.txt",
      type: "state",
      check: () => {
        if (pipeNorm(lastPipe) !== "uniq names.txt") return false;
        const alices = lastOut.filter((l) => l === "alice");
        return alices.length >= 2;
      },
    },
    {
      id: "sort-u",
      title: "sort -u",
      prompt: "Run <code>sort -u names.txt</code> — unique sorted names.",
      hint: "sort -u names.txt",
      type: "state",
      check: () =>
        pipeNorm(lastPipe) === "sort -u names.txt" &&
        outEquals(["alice", "bob", "charlie", "diana"]),
    },
    {
      id: "sort-n",
      title: "sort -n",
      prompt: "Run <code>sort -n numbers.txt</code> — first line should be <code>1</code>.",
      hint: "Without -n, 10 comes before 2",
      type: "state",
      check: () =>
        pipeNorm(lastPipe) === "sort -n numbers.txt" && lastOut[0] === "1" && lastOut[lastOut.length - 1] === "100",
    },
    {
      id: "quiz-numeric",
      title: "Quiz: -n",
      prompt: "Why <code>sort -n</code> for numbers? Answer: <code>numeric</code> or <code>value</code>",
      hint: "numeric order, not lexicographic",
      type: "text",
      answer: "numeric",
      alt: ["value", "numerical", "number order", "lexicographic fails"],
    },
    {
      id: "sort-r",
      title: "sort -r",
      prompt: "Run <code>sort -nr numbers.txt</code> — first line <code>100</code>.",
      hint: "sort -nr numbers.txt",
      type: "state",
      check: () => pipeNorm(lastPipe) === "sort -nr numbers.txt" && lastOut[0] === "100",
    },
    {
      id: "cut-f1",
      title: "cut field 1",
      prompt: "Run <code>cut -d',' -f1 csv_like.txt</code>.",
      hint: "cut -d',' -f1 csv_like.txt",
      type: "state",
      check: () =>
        /cut\s+-d','\s+-f1\s+csv_like\.txt/.test(pipeNorm(lastPipe).replace(/"/g, "'")) &&
        lastOut[0] === "name" &&
        lastOut.includes("alice"),
    },
    {
      id: "cut-f2",
      title: "cut counts",
      prompt: "Extract counts: <code>cut -d',' -f2 csv_like.txt</code> — second data line is <code>20</code>?",
      hint: "bob's count",
      type: "state",
      check: () =>
        lastPipe.includes("cut") &&
        lastPipe.includes("-f2") &&
        lastOut[2] === "20",
    },
    {
      id: "cut-f13",
      title: "cut f1,3",
      prompt: "Run <code>cut -d',' -f1,3 csv_like.txt</code>.",
      hint: "name and date columns",
      type: "state",
      check: () =>
        lastPipe.includes("-f1,3") &&
        lastOut.some((l) => l.includes("alice") && l.includes("2024-01-01")),
    },
    {
      id: "cut-c",
      title: "cut -c",
      prompt: "Run <code>cut -c1-5 fixed.txt</code> — first line <code>ABCDE</code>.",
      hint: "cut -c1-5 fixed.txt",
      type: "state",
      check: () => lastPipe.includes("cut -c1-5") && lastOut[0] === "ABCDE",
    },
    {
      id: "error-count",
      title: "ERROR count",
      prompt: "Run <code>grep ERROR sample.log | sort | uniq -c</code>. How many ERROR timeout lines? (number)",
      hint: "3",
      type: "text",
      answer: "3",
      setup: () => runRaw("grep ERROR sample.log | sort | uniq -c"),
    },
    {
      id: "run-error-pipe",
      title: "Error pipe",
      prompt: "Execute <code>grep ERROR sample.log | sort | uniq -c</code> yourself.",
      hint: "quick button",
      type: "state",
      check: () =>
        lastPipe.includes("grep ERROR") &&
        lastPipe.includes("uniq -c") &&
        lastOut.some((l) => /3\s+\[ERROR\] timeout/.test(l) || l.includes("[ERROR] timeout")),
    },
    {
      id: "quiz-pipe-order",
      title: "Quiz: order",
      prompt: "To count unique lines, order is usually? Answer: <code>sort | uniq</code>",
      hint: "sort then uniq",
      type: "text",
      answer: "sort | uniq",
      alt: ["sort|uniq", "sort then uniq", "sort uniq"],
    },
    {
      id: "unique-names",
      title: "Unique names",
      prompt: "How many unique names in names.txt? (number)",
      hint: "alice bob charlie diana → 4",
      type: "text",
      answer: "4",
      setup: () => runRaw("sort -u names.txt"),
    },
    {
      id: "quiz-cut-d",
      title: "Quiz: -d",
      prompt: "<code>cut -d</code> sets the? Answer: <code>delimiter</code>",
      hint: "field delimiter",
      type: "text",
      answer: "delimiter",
      alt: ["delim", "separator", "field separator"],
    },
    {
      id: "lex-vs-num",
      title: "Lex vs num",
      prompt: "Run plain <code>sort numbers.txt</code> — first line? (exact)",
      hint: "Lexicographic: 1, 10, 100, 2…",
      type: "state",
      check: () => pipeNorm(lastPipe) === "sort numbers.txt" && lastOut[0] === "1",
    },
    {
      id: "quiz-log",
      title: "Quiz: logs",
      prompt: "Common pattern to tally error lines: grep | ? Answer: <code>sort | uniq -c</code>",
      hint: "sort | uniq -c",
      type: "text",
      answer: "sort | uniq -c",
      alt: ["sort|uniq -c", "sort | uniq -c"],
    },
    {
      id: "space-cut",
      title: "Space cut",
      prompt: "From log_like: <code>cut -d' ' -f1 log_like.txt</code> — first token of line 3?",
      hint: "[ERROR]",
      type: "text",
      answer: "[error]",
      alt: ["[ERROR]"],
      setup: () => runRaw("cut -d' ' -f1 log_like.txt"),
    },
    {
      id: "wc-unique",
      title: "wc unique",
      prompt: "Run <code>sort -u names.txt | wc -l</code> — output should be <code>4</code>.",
      hint: "sort -u names.txt | wc -l",
      type: "state",
      check: () => lastPipe.includes("wc -l") && lastOut[0] === "4",
    },
  ];

  function normalizeAns(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, " ");
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
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:16rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Run a pipeline, then Check.</span>`;
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

  document.getElementById("su-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-run").addEventListener("click", () => runRaw(pipeIn.value));
  pipeIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runRaw(pipeIn.value);
    }
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = inputEl.value;
      inputEl.value = "";
      runRaw(v);
    }
  });
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
  else renderAll();
  renderChallenge();
})();
