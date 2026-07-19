(() => {
  const LOG = `INFO  sim: starting test_main
WARN  clk: jitter 0.2ns
ERROR drv: timeout waiting for ready
INFO  scoreboard: pkt 1 ok
ERROR mon: unexpected X on data
INFO  scoreboard: pkt 2 ok
WARN  cov: bin uncovered [idle]
INFO  sim: finishing
ERROR drv: retry limit exceeded
INFO  scoreboard: pkt 3 fail
`;

  const files = { "sim.log": LOG };

  function tokenize(cmd) {
    return (cmd.match(/(?:[^\s']+|'[^']*')+/g) || []).map((t) => t.replace(/^'|'$/g, ""));
  }

  function runFilter(name, args, stdin) {
    const lines = stdin === "" ? [] : stdin.replace(/\n$/, "").split("\n");
    switch (name) {
      case "cat": {
        if (!args[0] || args[0] === "-") return stdin || files["sim.log"].replace(/\n$/, "");
        if (!files[args[0]]) throw new Error(`cat: ${args[0]}: No such file (lab files: ${Object.keys(files).join(", ")})`);
        return files[args[0]].replace(/\n$/, "");
      }
      case "grep": {
        let invert = false;
        let pattern = null;
        for (const a of args) {
          if (a === "-v") invert = true;
          else if (!pattern) pattern = a;
        }
        if (!pattern) throw new Error("grep: missing pattern");
        const re = new RegExp(pattern);
        return lines.filter((l) => (invert ? !re.test(l) : re.test(l))).join("\n");
      }
      case "cut": {
        let delim = "\t";
        let fields = null;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-d") delim = args[++i] ?? "\t";
          else if (args[i].startsWith("-d") && args[i].length > 2) delim = args[i].slice(2);
          else if (args[i] === "-f") fields = args[++i];
          else if (args[i].startsWith("-f") && args[i].length > 2) fields = args[i].slice(2);
        }
        if (!fields) throw new Error("cut: need -f");
        const idxs = fields.split(",").map((n) => Number(n) - 1);
        const splitLine = (l) => (delim === " " ? l.trim().split(/\s+/) : l.split(delim));
        return lines
          .map((l) => idxs.map((i) => splitLine(l)[i] ?? "").join(delim === " " ? " " : delim))
          .join("\n");
      }
      case "sort": {
        const uniq = args.includes("-u");
        const sorted = [...lines].sort();
        return (uniq ? [...new Set(sorted)] : sorted).join("\n");
      }
      case "uniq": {
        const counts = args.includes("-c");
        const out = [];
        let prev = null;
        let n = 0;
        const flush = () => {
          if (prev === null) return;
          out.push(counts ? `${String(n).padStart(4)} ${prev}` : prev);
        };
        for (const l of lines) {
          if (l === prev) n++;
          else {
            flush();
            prev = l;
            n = 1;
          }
        }
        flush();
        return out.join("\n");
      }
      case "wc": {
        const text = lines.join("\n");
        const lc = lines.length;
        const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
        const cc = text.length;
        if (args.includes("-l")) return String(lc);
        if (args.includes("-w")) return String(wc);
        if (args.includes("-c")) return String(cc);
        return `${lc} ${wc} ${cc}`;
      }
      case "head": {
        let n = 10;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-n") n = Number(args[++i]) || 10;
          else if (/^-\d+$/.test(args[i])) n = Math.abs(Number(args[i]));
        }
        return lines.slice(0, n).join("\n");
      }
      case "tail": {
        let n = 10;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-n") n = Number(args[++i]) || 10;
          else if (/^-\d+$/.test(args[i])) n = Math.abs(Number(args[i]));
        }
        return lines.slice(-n).join("\n");
      }
      case "tee": {
        const append = args.includes("-a");
        const path = args.find((a) => !a.startsWith("-"));
        if (!path) throw new Error("tee: missing file");
        const body = lines.join("\n") + (lines.length ? "\n" : "");
        files[path] = append && files[path] ? files[path] + body : body;
        return lines.join("\n");
      }
      case "xargs": {
        // lab: echo a b c | xargs -n 1 echo → run echo per arg
        const nIdx = args.indexOf("-n");
        const n = nIdx >= 0 ? Number(args[nIdx + 1]) || 1 : 0;
        const cmdStart = args.findIndex((a, i) => !a.startsWith("-") && !(nIdx >= 0 && i === nIdx + 1));
        const cmd = cmdStart >= 0 ? args.slice(cmdStart) : ["echo"];
        const tokens = stdin.trim() ? stdin.trim().split(/\s+/) : [];
        if (!tokens.length) return "";
        const chunks = [];
        if (n > 0) {
          for (let i = 0; i < tokens.length; i += n) chunks.push(tokens.slice(i, i + n));
        } else chunks.push(tokens);
        return chunks
          .map((ch) => {
            if (cmd[0] === "echo") return [...cmd.slice(1), ...ch].join(" ");
            return `# ${cmd.join(" ")} ${ch.join(" ")}`;
          })
          .join("\n");
      }
      case "echo":
        return args.join(" ");
      default:
        throw new Error(`${name}: not in lab filter set`);
    }
  }

  /** Split redirection tokens from a stage; returns { tokens, redirs } */
  function stripRedirs(tokens) {
    const out = [];
    const redirs = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === ">" || t === ">>" || t === "2>" || t === "2>>" || t === "&>" || t === "2>&1") {
        if (t === "2>&1") {
          redirs.push({ op: "2>&1" });
          continue;
        }
        const target = tokens[++i];
        if (!target) throw new Error(`redirection ${t} needs a filename`);
        redirs.push({ op: t, target });
      } else if (/^(>>?|2>>?)/.test(t) && t.length > 2 && !t.includes("&")) {
        const m = t.match(/^(>>?|2>>?)(.+)$/);
        redirs.push({ op: m[1], target: m[2] });
      } else out.push(t);
    }
    return { tokens: out, redirs };
  }

  function applyRedirs(stdout, stderr, redirs) {
    let out = stdout;
    let err = stderr;
    const writes = [];
    for (const r of redirs) {
      if (r.op === "2>&1") {
        out = [out, err].filter(Boolean).join("\n");
        err = "";
        writes.push({ note: "stderr merged into stdout (2>&1)" });
        continue;
      }
      const append = r.op === ">>" || r.op === "2>>";
      const isErr = r.op.startsWith("2");
      const data = (isErr ? err : out) + ((isErr ? err : out) ? "\n" : "");
      files[r.target] = append && files[r.target] ? files[r.target] + data : data;
      writes.push({ file: r.target, op: r.op, preview: files[r.target].slice(0, 200) });
      if (!isErr && r.op !== "&>") out = "";
      if (isErr) err = "";
    }
    return { out, err, writes };
  }

  function runPipeline(text) {
    const stages = text.split("|").map((s) => s.trim()).filter(Boolean);
    const results = [];
    let stdin = "";
    for (const stage of stages) {
      try {
        const raw = tokenize(stage);
        const { tokens, redirs } = stripRedirs(raw);
        const name = tokens[0];
        const args = tokens.slice(1);
        if (!name) throw new Error("empty stage");
        let stdout = runFilter(name, args, stdin);
        let stderr = "";
        // demo: pretend grep ERROR also notes count on stderr when -n used — skip
        const applied = applyRedirs(stdout, stderr, redirs);
        results.push({
          cmd: stage,
          out: applied.out,
          err: false,
          writes: applied.writes,
        });
        stdin = applied.out;
      } catch (e) {
        results.push({ cmd: stage, out: e.message, err: true, writes: [] });
        break;
      }
    }
    return results;
  }

  const CLEARED_KEY = "ddv-pipes-cleared-v1";

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

  /** Graded challenges — Run the pipeline, then Check. */
  const CHALLENGES = [
    {
      id: "grep-error",
      title: "Grep ERROR",
      prompt: "Show only ERROR lines from sim.log.",
      hint: "cat sim.log | grep ERROR",
      expectOut:
        "ERROR drv: timeout waiting for ready\nERROR mon: unexpected X on data\nERROR drv: retry limit exceeded",
    },
    {
      id: "count-errors",
      title: "Count ERROR lines",
      prompt: "How many ERROR lines are in sim.log? (stdout should be 3)",
      hint: "cat sim.log | grep ERROR | wc -l",
      expectOut: "3",
    },
    {
      id: "redirect-errors",
      title: "Redirect to file",
      prompt: "Write ERROR lines into errors.txt (stdout may be empty).",
      hint: "cat sim.log | grep ERROR > errors.txt",
      expectFile: {
        name: "errors.txt",
        includes: "ERROR drv: timeout waiting for ready",
      },
      expectOut: "",
    },
    {
      id: "tee-count",
      title: "tee + count",
      prompt: "Save ERROR lines with tee to errors.txt and print the line count (3).",
      hint: "cat sim.log | grep ERROR | tee errors.txt | wc -l",
      expectOut: "3",
      expectFile: { name: "errors.txt", includes: "ERROR mon:" },
    },
    {
      id: "grep-warn",
      title: "Grep WARN",
      prompt: "Show only WARN lines.",
      hint: "cat sim.log | grep WARN",
      expectOut: "WARN  clk: jitter 0.2ns\nWARN  cov: bin uncovered [idle]",
    },
    {
      id: "info-only",
      title: "INFO only",
      prompt: "Drop ERROR and WARN lines — keep INFO.",
      hint: "cat sim.log | grep -v ERROR | grep -v WARN",
      expectOut:
        "INFO  sim: starting test_main\nINFO  scoreboard: pkt 1 ok\nINFO  scoreboard: pkt 2 ok\nINFO  sim: finishing\nINFO  scoreboard: pkt 3 fail",
    },
    {
      id: "wc-lines",
      title: "Line count",
      prompt: "Count all lines in sim.log (should be 10).",
      hint: "cat sim.log | wc -l",
      expectOut: "10",
    },
    {
      id: "head3",
      title: "First 3 lines",
      prompt: "Print the first 3 lines of sim.log.",
      hint: "cat sim.log | head -n 3",
      expectOut:
        "INFO  sim: starting test_main\nWARN  clk: jitter 0.2ns\nERROR drv: timeout waiting for ready",
    },
    {
      id: "tail3",
      title: "Last 3 lines",
      prompt: "Print the last 3 lines of sim.log.",
      hint: "cat sim.log | tail -n 3",
      expectOut:
        "INFO  sim: finishing\nERROR drv: retry limit exceeded\nINFO  scoreboard: pkt 3 fail",
    },
    {
      id: "scoreboard",
      title: "Scoreboard lines",
      prompt: "Show lines mentioning scoreboard.",
      hint: "cat sim.log | grep scoreboard",
      expectOut:
        "INFO  scoreboard: pkt 1 ok\nINFO  scoreboard: pkt 2 ok\nINFO  scoreboard: pkt 3 fail",
    },
    {
      id: "drv-errors",
      title: "Driver errors",
      prompt: "Show lines containing drv.",
      hint: "cat sim.log | grep drv",
      expectOut:
        "ERROR drv: timeout waiting for ready\nERROR drv: retry limit exceeded",
    },
    {
      id: "timeout",
      title: "Find timeout",
      prompt: "Find the line about timeout.",
      hint: "cat sim.log | grep timeout",
      expectOut: "ERROR drv: timeout waiting for ready",
    },
    {
      id: "finishing",
      title: "Find finishing",
      prompt: "Find the sim finishing line.",
      hint: "cat sim.log | grep finishing",
      expectOut: "INFO  sim: finishing",
    },
    {
      id: "non-info-head",
      title: "Non-INFO head",
      prompt: "Drop INFO, then take the first 5 remaining lines.",
      hint: "cat sim.log | grep -v INFO | head -n 5",
      expectOut:
        "WARN  clk: jitter 0.2ns\nERROR drv: timeout waiting for ready\nERROR mon: unexpected X on data\nWARN  cov: bin uncovered [idle]\nERROR drv: retry limit exceeded",
    },
    {
      id: "error-head2",
      title: "First two ERRORs",
      prompt: "Show only the first two ERROR lines.",
      hint: "cat sim.log | grep ERROR | head -n 2",
      expectOut:
        "ERROR drv: timeout waiting for ready\nERROR mon: unexpected X on data",
    },
    {
      id: "tee-filtered",
      title: "tee filtered log",
      prompt: "Drop INFO and tee the rest to filtered.txt (stdout = same content).",
      hint: "cat sim.log | grep -v INFO | tee filtered.txt",
      expectOut:
        "WARN  clk: jitter 0.2ns\nERROR drv: timeout waiting for ready\nERROR mon: unexpected X on data\nWARN  cov: bin uncovered [idle]\nERROR drv: retry limit exceeded",
      expectFile: { name: "filtered.txt", includes: "WARN  clk:" },
    },
    {
      id: "xargs-check",
      title: "xargs check files",
      prompt: "Echo two paths into xargs -n 1 echo check.",
      hint: "echo src/main.v src/alu.v | xargs -n 1 echo check",
      expectOut: "check src/main.v\ncheck src/alu.v",
    },
    {
      id: "xargs-item",
      title: "xargs item",
      prompt: "Turn a b c into three “item …” lines.",
      hint: "echo a b c | xargs -n 1 echo item",
      expectOut: "item a\nitem b\nitem c",
    },
    {
      id: "sort-uniq",
      title: "Sorted unique",
      prompt: "Sort sim.log and uniq (alphabetically unique lines).",
      hint: "cat sim.log | sort | uniq",
      expectOut:
        "ERROR drv: retry limit exceeded\nERROR drv: timeout waiting for ready\nERROR mon: unexpected X on data\nINFO  scoreboard: pkt 1 ok\nINFO  scoreboard: pkt 2 ok\nINFO  scoreboard: pkt 3 fail\nINFO  sim: finishing\nINFO  sim: starting test_main\nWARN  clk: jitter 0.2ns\nWARN  cov: bin uncovered [idle]",
    },
    {
      id: "job-bg",
      title: "Background job",
      prompt: "Use start sim & so at least one job is Running.",
      hint: "Click “start sim &” in Jobs.",
      checkJobs: (j) => j.some((x) => x.state === "Running"),
    },
    {
      id: "job-kill",
      title: "Kill a job",
      prompt: "Have a job in Done (killed) state.",
      hint: "start sim &, then kill %1.",
      checkJobs: (j) => j.some((x) => x.state === "Done (killed)"),
    },
    {
      id: "mon-x",
      title: "Unexpected X",
      prompt: "Show the monitor unexpected-X ERROR line only.",
      hint: "cat sim.log | grep unexpected",
      expectOut: "ERROR mon: unexpected X on data",
    },
  ];

  let lastResults = [];
  let jobs = [];
  let nextPid = 2000;
  let challengeIdx = 0;
  let clearedIds = loadCleared();
  let showHint = false;

  const root = document.getElementById("pipes-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>cat sim.log | grep ERROR | tee errors.txt | wc -l</code> — count ERROR lines while saving a copy.</p>
      <button type="button" class="btn btn-secondary" id="pipe-starter">Load starter example</button>
    </div>
    <div class="challenge" id="chal-box">
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
    <div class="challenge">
      <h2>Recipe shortcuts</h2>
      <p>Click to fill the pipeline box (still Run + Check for challenges).</p>
      <div class="kbd-row" id="recipes"></div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Pipeline</h2></div>
        <div class="panel-body">
          <form class="pipe-form" id="pipe-form">
            <label for="pipe-input">$</label>
            <input id="pipe-input" value="cat sim.log | grep ERROR | tee errors.txt | wc -l" spellcheck="false">
            <button type="submit" class="btn btn-primary">Run</button>
          </form>
          <div class="stages" id="stages"></div>
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="panel-head"><h2>sim.log</h2></div>
          <div class="panel-body"><pre class="source-pre">${LOG.replace(/</g, "&lt;")}</pre></div>
        </div>
        <div class="panel" style="margin-top:0.85rem">
          <div class="panel-head"><h2>Lab files (after redirects)</h2></div>
          <div class="panel-body"><pre class="source-pre" id="files-view"></pre></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Jobs &amp; processes (lab)</h2></div>
      <div class="panel-body">
        <p style="margin:0 0 0.65rem;color:var(--muted);font-size:0.9rem">
          Simulated long-running sims. Start / stop / background — mirrors <code>ps</code>, <code>&amp;</code>, <code>kill</code>.
        </p>
        <div class="tool-actions" style="margin-bottom:0.65rem">
          <button type="button" class="btn btn-secondary" id="job-start">start sim &amp;</button>
          <button type="button" class="btn btn-ghost" id="job-fg">start sim (fg)</button>
          <button type="button" class="btn btn-ghost" id="job-kill">kill %1</button>
        </div>
        <pre class="source-pre" id="jobs-view"></pre>
      </div>
    </div>
  `;

  function renderJobs() {
    if (!jobs.length) {
      document.getElementById("jobs-view").textContent = "No jobs. Try: start sim &";
      return;
    }
    document.getElementById("jobs-view").textContent = jobs
      .map((j) => `[${j.id}]  ${j.state}  pid ${j.pid}  ${j.cmd}`)
      .join("\n");
  }

  document.getElementById("job-start").addEventListener("click", () => {
    jobs.push({ id: jobs.length + 1, pid: nextPid++, cmd: "simv test_main &", state: "Running" });
    renderJobs();
  });
  document.getElementById("job-fg").addEventListener("click", () => {
    jobs.push({ id: jobs.length + 1, pid: nextPid++, cmd: "simv test_main", state: "Foreground" });
    renderJobs();
  });
  document.getElementById("job-kill").addEventListener("click", () => {
    const j = jobs.find((x) => x.state !== "Done" && x.state !== "Done (killed)");
    if (!j) {
      document.getElementById("jobs-view").textContent = "No running job to kill";
      return;
    }
    j.state = "Done (killed)";
    renderJobs();
  });
  renderJobs();

  const recipes = [
    "cat sim.log | grep ERROR",
    "cat sim.log | grep ERROR > errors.txt",
    "cat sim.log | grep ERROR | tee errors.txt | wc -l",
    "echo src/main.v src/alu.v | xargs -n 1 echo check",
    "cat sim.log | grep -v INFO | head -n 5",
    "cat sim.log | grep WARN",
    "cat sim.log | grep -v ERROR | grep -v WARN",
    "cat sim.log | wc -l",
    "cat sim.log | head -n 3",
    "cat sim.log | tail -n 3",
    "cat sim.log | grep scoreboard",
    "cat sim.log | grep ERROR | wc -l",
    "cat sim.log | sort | uniq",
    "cat sim.log | grep drv",
    "cat sim.log | grep -v INFO | tee filtered.txt",
    "cat sim.log | grep ERROR | head -n 2",
    "echo a b c | xargs -n 1 echo item",
    "cat sim.log | grep finishing",
    "cat sim.log | grep timeout",
    "cat sim.log | grep unexpected",
  ];
  const recipesEl = document.getElementById("recipes");
  recipes.forEach((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = r;
    b.addEventListener("click", () => {
      document.getElementById("pipe-input").value = r;
      render();
    });
    recipesEl.appendChild(b);
  });

  function renderFiles() {
    const keys = Object.keys(files).sort();
    document.getElementById("files-view").textContent = keys
      .map((k) => `=== ${k} ===\n${files[k].slice(0, 400)}${files[k].length > 400 ? "\n…" : ""}`)
      .join("\n\n");
  }

  function render() {
    Object.keys(files).forEach((k) => {
      if (k !== "sim.log") delete files[k];
    });
    const text = document.getElementById("pipe-input").value;
    lastResults = runPipeline(text);
    const el = document.getElementById("stages");
    el.innerHTML = lastResults
      .map((r, i) => {
        const writeNote = (r.writes || [])
          .map((w) => (w.file ? `wrote ${w.op} ${w.file}` : w.note))
          .join("; ");
        return `
      <div class="stage ${r.err ? "err" : ""}">
        <div class="stage-head"><span>${i + 1}. ${r.cmd.replace(/</g, "&lt;")}</span><span>${r.err ? "error" : writeNote || "stdout"}</span></div>
        <pre class="stage-body">${(r.out || "(empty)").replace(/</g, "&lt;")}</pre>
      </div>`;
      })
      .join("");
    renderFiles();
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
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else {
      hintEl.hidden = true;
      hintEl.textContent = "";
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
    const ch = CHALLENGES[challengeIdx];
    if (ch.checkJobs) {
      if (ch.checkJobs(jobs)) {
        if (!clearedIds.includes(ch.id)) {
          clearedIds = [...clearedIds, ch.id];
          saveCleared(clearedIds);
        }
        setChalStatus("pass", "Pass");
        renderChallenge();
        return;
      }
      setChalStatus("fail", "Not yet — use the Jobs buttons");
      return;
    }
    render();
    const last = lastResults[lastResults.length - 1];
    if (!last || last.err) {
      setChalStatus("fail", "Pipeline error — fix the command and Run");
      return;
    }
    if (ch.expectOut != null && last.out !== ch.expectOut) {
      setChalStatus("fail", "Stdout does not match yet — Run after editing");
      return;
    }
    if (ch.expectFile) {
      const body = files[ch.expectFile.name] || "";
      if (!body.includes(ch.expectFile.includes)) {
        setChalStatus("fail", `Missing expected content in ${ch.expectFile.name}`);
        return;
      }
    }
    if (!clearedIds.includes(ch.id)) {
      clearedIds = [...clearedIds, ch.id];
      saveCleared(clearedIds);
    }
    setChalStatus("pass", "Pass");
    renderChallenge();
  }

  document.getElementById("pipe-form").addEventListener("submit", (e) => {
    e.preventDefault();
    render();
  });
  document.getElementById("pipe-starter").addEventListener("click", () => {
    document.getElementById("pipe-input").value =
      "cat sim.log | grep ERROR | tee errors.txt | wc -l";
    render();
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

  render();
  renderChallenge();
})();
