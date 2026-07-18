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

  function tokenize(cmd) {
    return (cmd.match(/(?:[^\s']+|'[^']*')+/g) || []).map((t) => t.replace(/^'|'$/g, ""));
  }

  function runFilter(name, args, stdin) {
    const lines = stdin === "" ? [] : stdin.replace(/\n$/, "").split("\n");
    switch (name) {
      case "cat": {
        if (args[0] === "sim.log" || args[0] === "-" || !args[0]) return LOG.replace(/\n$/, "");
        throw new Error(`cat: ${args[0]}: only sim.log is available in this lab`);
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
        // lab log uses spaces — treat runs of whitespace as delim if -d' '
        const splitLine = (l) => (delim === " " ? l.trim().split(/\s+/) : l.split(delim));
        return lines
          .map((l) => {
            const parts = splitLine(l);
            return idxs.map((i) => parts[i] ?? "").join(delim === " " ? " " : delim);
          })
          .join("\n");
      }
      case "sort": {
        const uniq = args.includes("-u");
        const sorted = [...lines].sort();
        if (!uniq) return sorted.join("\n");
        return [...new Set(sorted)].join("\n");
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
        const onlyLines = args.includes("-l");
        const onlyWords = args.includes("-w");
        const onlyChars = args.includes("-c");
        const text = lines.join("\n");
        const lc = lines.length;
        const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
        const cc = text.length;
        if (onlyLines) return String(lc);
        if (onlyWords) return String(wc);
        if (onlyChars) return String(cc);
        return `${lc} ${wc} ${cc}`;
      }
      case "head": {
        let n = 10;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-n") n = Number(args[++i]) || 10;
          else if (args[i].startsWith("-") && /^-?\d+$/.test(args[i])) n = Math.abs(Number(args[i]));
        }
        return lines.slice(0, n).join("\n");
      }
      case "tail": {
        let n = 10;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-n") n = Number(args[++i]) || 10;
          else if (args[i].startsWith("-") && /^-?\d+$/.test(args[i])) n = Math.abs(Number(args[i]));
        }
        return lines.slice(-n).join("\n");
      }
      default:
        throw new Error(`${name}: not in lab filter set (cat grep cut sort uniq wc head tail)`);
    }
  }

  function runPipeline(text) {
    const stages = text.split("|").map((s) => s.trim()).filter(Boolean);
    const results = [];
    let stdin = "";
    for (const stage of stages) {
      const tokens = tokenize(stage);
      const name = tokens[0];
      const args = tokens.slice(1);
      try {
        const out = runFilter(name, args, stdin);
        results.push({ cmd: stage, out, err: false });
        stdin = out;
      } catch (e) {
        results.push({ cmd: stage, out: e.message, err: true });
        break;
      }
    }
    return results;
  }

  const root = document.getElementById("pipes-root");
  root.innerHTML = `
    <div class="challenge">
      <h2>Try these</h2>
      <p>Click a recipe, then Run — watch each stage fill in.</p>
      <div class="kbd-row" id="recipes"></div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Pipeline</h2></div>
        <div class="panel-body">
          <form class="pipe-form" id="pipe-form">
            <label for="pipe-input">$</label>
            <input id="pipe-input" value="cat sim.log | grep ERROR | wc -l" spellcheck="false">
            <button type="submit" class="btn btn-primary">Run</button>
          </form>
          <div class="stages" id="stages"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>sim.log</h2></div>
        <div class="panel-body"><pre class="source-pre">${LOG.replace(/</g, "&lt;")}</pre></div>
      </div>
    </div>
  `;

  const recipes = [
    "cat sim.log | grep ERROR",
    "cat sim.log | grep ERROR | wc -l",
    "cat sim.log | cut -d' ' -f1 | sort | uniq -c",
    "cat sim.log | grep -v INFO | head -n 5",
    "cat sim.log | grep scoreboard | wc -l",
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

  function render() {
    const text = document.getElementById("pipe-input").value;
    const results = runPipeline(text);
    const el = document.getElementById("stages");
    el.innerHTML = results
      .map(
        (r, i) => `
      <div class="stage ${r.err ? "err" : ""}">
        <div class="stage-head"><span>${i + 1}. ${r.cmd.replace(/</g, "&lt;")}</span><span>${r.err ? "error" : "stdout"}</span></div>
        <pre class="stage-body">${(r.out || "(empty)").replace(/</g, "&lt;")}</pre>
      </div>`
      )
      .join("");
  }

  document.getElementById("pipe-form").addEventListener("submit", (e) => {
    e.preventDefault();
    render();
  });

  render();
})();
