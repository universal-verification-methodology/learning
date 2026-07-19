(() => {
  const CLEARED_KEY = "ddv-git-conflicts-cleared-v1";

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

  function conflictBlock(oursBody, theirsBody, label = "feature") {
    return `<<<<<<< HEAD
${oursBody}=======
${theirsBody}>>>>>>> ${label}
`;
  }

  const SCENARIOS = [
    {
      id: "counter-width",
      title: "Counter WIDTH + enable",
      prompt: "Merge: keep WIDTH=16 and logic enable; remove all markers.",
      hint: "Take theirs extras but keep a clean module — or Show suggested merge.",
      ours: `module counter;
  // main branch
  parameter WIDTH = 8;
  logic [WIDTH-1:0] q;
endmodule
`,
      theirs: `module counter;
  // feature branch
  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
endmodule
`,
      conflicted: `module counter;
${conflictBlock(
  `  // main branch
  parameter WIDTH = 8;
  logic [WIDTH-1:0] q;
`,
  `  // feature branch
  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
`
)}endmodule
`,
      suggested: `module counter;
  // merged: keep enable, choose WIDTH intentionally
  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
endmodule
`,
      check: (t) => /WIDTH\s*=\s*16/.test(t) && /logic\s+enable/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "take-ours",
      title: "Take ours only",
      prompt: "Resolve by keeping HEAD only (WIDTH=8, no enable). No markers.",
      hint: "Click Take ours (HEAD).",
      ours: `module counter;
  parameter WIDTH = 8;
  logic [WIDTH-1:0] q;
endmodule
`,
      theirs: `module counter;
  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
endmodule
`,
      conflicted: `module counter;
${conflictBlock(
  `  parameter WIDTH = 8;
  logic [WIDTH-1:0] q;
`,
  `  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
`
)}endmodule
`,
      suggested: `module counter;
  parameter WIDTH = 8;
  logic [WIDTH-1:0] q;
endmodule
`,
      check: (t) =>
        /WIDTH\s*=\s*8/.test(t) && !/enable/.test(t) && !/<<<<<<</.test(t) && /module counter/.test(t),
    },
    {
      id: "take-theirs",
      title: "Take theirs only",
      prompt: "Resolve by taking the feature side completely. No markers.",
      hint: "Click Take theirs.",
      ours: `module alu;
  // HEAD
  logic [7:0] y;
endmodule
`,
      theirs: `module alu;
  // feature
  logic [15:0] y;
  logic carry;
endmodule
`,
      conflicted: `module alu;
${conflictBlock(
  `  // HEAD
  logic [7:0] y;
`,
  `  // feature
  logic [15:0] y;
  logic carry;
`
)}endmodule
`,
      suggested: `module alu;
  // feature
  logic [15:0] y;
  logic carry;
endmodule
`,
      check: (t) => /\[15:0\]/.test(t) && /carry/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "comment-only",
      title: "Comment conflict",
      prompt: "Keep either comment; remove markers. File must still be valid Verilog.",
      hint: "Delete markers and pick one comment line.",
      ours: `module top;
  // owned by main
  logic clk;
endmodule
`,
      theirs: `module top;
  // owned by feature
  logic clk;
endmodule
`,
      conflicted: `module top;
${conflictBlock(`  // owned by main\n`, `  // owned by feature\n`)}  logic clk;
endmodule
`,
      suggested: `module top;
  // owned by feature
  logic clk;
endmodule
`,
      check: (t) => /logic\s+clk/.test(t) && !/<<<<<<</.test(t) && /module top/.test(t),
    },
    {
      id: "rst-polarity",
      title: "Reset polarity",
      prompt: "Keep active-low reset (rst_n) from feature. No markers.",
      hint: "Prefer theirs naming rst_n.",
      ours: `module ff;
  input rst;
  always @(posedge clk or posedge rst) if (rst) q <= 0;
endmodule
`,
      theirs: `module ff;
  input rst_n;
  always @(posedge clk or negedge rst_n) if (!rst_n) q <= 0;
endmodule
`,
      conflicted: `module ff;
${conflictBlock(
  `  input rst;
  always @(posedge clk or posedge rst) if (rst) q <= 0;
`,
  `  input rst_n;
  always @(posedge clk or negedge rst_n) if (!rst_n) q <= 0;
`
)}endmodule
`,
      suggested: `module ff;
  input rst_n;
  always @(posedge clk or negedge rst_n) if (!rst_n) q <= 0;
endmodule
`,
      check: (t) => /rst_n/.test(t) && /negedge\s+rst_n/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "param-both",
      title: "Keep both params",
      prompt: "Keep DEPTH from HEAD and WIDTH from feature.",
      hint: "Manual merge both parameter lines.",
      ours: `module fifo;
  parameter DEPTH = 8;
  logic [7:0] mem;
endmodule
`,
      theirs: `module fifo;
  parameter WIDTH = 16;
  logic [15:0] mem;
endmodule
`,
      conflicted: `module fifo;
${conflictBlock(
  `  parameter DEPTH = 8;
  logic [7:0] mem;
`,
  `  parameter WIDTH = 16;
  logic [15:0] mem;
`
)}endmodule
`,
      suggested: `module fifo;
  parameter DEPTH = 8;
  parameter WIDTH = 16;
  logic [15:0] mem;
endmodule
`,
      check: (t) =>
        /DEPTH\s*=\s*8/.test(t) && /WIDTH\s*=\s*16/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "ifdef-guard",
      title: "Include guard text",
      prompt: "Pick one guard comment; remove markers; keep module.",
      hint: "Any clean resolution without markers passes if module remains.",
      ours: `// guard: MAIN
module bus;
endmodule
`,
      theirs: `// guard: FEATURE
module bus;
endmodule
`,
      conflicted: `${conflictBlock(`// guard: MAIN\n`, `// guard: FEATURE\n`)}module bus;
endmodule
`,
      suggested: `// guard: FEATURE
module bus;
endmodule
`,
      check: (t) => /module bus/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "assign-vs-always",
      title: "assign vs always",
      prompt: "Keep continuous assign from HEAD. No markers.",
      hint: "Take ours.",
      ours: `module mux;
  assign y = s ? a : b;
endmodule
`,
      theirs: `module mux;
  always @* y = s ? a : b;
endmodule
`,
      conflicted: `module mux;
${conflictBlock(`  assign y = s ? a : b;\n`, `  always @* y = s ? a : b;\n`)}endmodule
`,
      suggested: `module mux;
  assign y = s ? a : b;
endmodule
`,
      check: (t) => /assign\s+y/.test(t) && !/always\s+@\*/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "pkg-import",
      title: "Package import",
      prompt: "Keep import my_pkg::* from feature.",
      hint: "Take theirs import line.",
      ours: `module tb;
  initial $display("hi");
endmodule
`,
      theirs: `module tb;
  import my_pkg::*;
  initial $display("hi");
endmodule
`,
      conflicted: `module tb;
${conflictBlock(``, `  import my_pkg::*;\n`)}  initial $display("hi");
endmodule
`,
      suggested: `module tb;
  import my_pkg::*;
  initial $display("hi");
endmodule
`,
      check: (t) => /import\s+my_pkg::\*/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "timescale",
      title: "Timescale",
      prompt: "Keep `timescale 1ns/1ps from feature. No markers.",
      hint: "Take the feature timescale line.",
      ours: "`timescale 1ns/1ns\nmodule delay;\nendmodule\n",
      theirs: "`timescale 1ns/1ps\nmodule delay;\nendmodule\n",
      conflicted: `${conflictBlock("`timescale 1ns/1ns\n", "`timescale 1ns/1ps\n")}module delay;
endmodule
`,
      suggested: "`timescale 1ns/1ps\nmodule delay;\nendmodule\n",
      check: (t) => /1ns\/1ps/.test(t) && !/<<<<<<</.test(t),
    },
  ];

  const MORE = [
    {
      id: "wire-reg",
      title: "wire vs reg",
      prompt: "Keep logic (SV) from feature; drop old reg.",
      hint: "Theirs uses logic.",
      ours: "module m;\n  reg q;\nendmodule\n",
      theirs: "module m;\n  logic q;\nendmodule\n",
      conflicted: `module m;
${conflictBlock("  reg q;\n", "  logic q;\n")}endmodule
`,
      suggested: "module m;\n  logic q;\nendmodule\n",
      check: (t) => /logic\s+q/.test(t) && !/\breg\s+q/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "clk-name",
      title: "Clock name",
      prompt: "Standardize on clk (HEAD). No markers.",
      hint: "Take ours clock name.",
      ours: "module m;\n  input clk;\nendmodule\n",
      theirs: "module m;\n  input clock;\nendmodule\n",
      conflicted: `module m;
${conflictBlock("  input clk;\n", "  input clock;\n")}endmodule
`,
      suggested: "module m;\n  input clk;\nendmodule\n",
      check: (t) => /input\s+clk/.test(t) && !/input\s+clock/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "two-hunks",
      title: "Two hunks",
      prompt: "Clear BOTH conflict regions; keep ENABLE=1 and WIDTH=4.",
      hint: "Resolve both marker blocks.",
      ours: "",
      theirs: "",
      conflicted: `module cfg;
${conflictBlock("  parameter ENABLE = 0;\n", "  parameter ENABLE = 1;\n")}${conflictBlock("  parameter WIDTH = 2;\n", "  parameter WIDTH = 4;\n")}endmodule
`,
      suggested: `module cfg;
  parameter ENABLE = 1;
  parameter WIDTH = 4;
endmodule
`,
      check: (t) =>
        /ENABLE\s*=\s*1/.test(t) && /WIDTH\s*=\s*4/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "empty-ours",
      title: "Added on feature",
      prompt: "Feature added a signal — keep valid_i. No markers.",
      hint: "Take theirs addition.",
      ours: "module iface;\n  logic ready;\nendmodule\n",
      theirs: "module iface;\n  logic ready;\n  logic valid_i;\nendmodule\n",
      conflicted: `module iface;
  logic ready;
${conflictBlock("", "  logic valid_i;\n")}endmodule
`,
      suggested: "module iface;\n  logic ready;\n  logic valid_i;\nendmodule\n",
      check: (t) => /valid_i/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "deleted-theirs",
      title: "Deleted on feature",
      prompt: "Feature deleted debug; remove debug line and markers.",
      hint: "Empty theirs side — drop the debug line.",
      ours: "module m;\n  logic debug;\n  logic q;\nendmodule\n",
      theirs: "module m;\n  logic q;\nendmodule\n",
      conflicted: `module m;
${conflictBlock("  logic debug;\n", "")}  logic q;
endmodule
`,
      suggested: "module m;\n  logic q;\nendmodule\n",
      check: (t) => /logic\s+q/.test(t) && !/debug/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "license-header",
      title: "License header",
      prompt: "Keep one SPDX line; remove markers.",
      hint: "Either SPDX is fine.",
      ours: "// SPDX-License-Identifier: MIT\nmodule m;\nendmodule\n",
      theirs: "// SPDX-License-Identifier: Apache-2.0\nmodule m;\nendmodule\n",
      conflicted: `${conflictBlock(
        "// SPDX-License-Identifier: MIT\n",
        "// SPDX-License-Identifier: Apache-2.0\n"
      )}module m;
endmodule
`,
      suggested: "// SPDX-License-Identifier: MIT\nmodule m;\nendmodule\n",
      check: (t) => /SPDX-License-Identifier/.test(t) && /module m/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "tb-clk-period",
      title: "TB clock period",
      prompt: "Use #5 period from feature.",
      hint: "forever #5",
      ours: "module tb;\n  initial forever #10 clk = ~clk;\nendmodule\n",
      theirs: "module tb;\n  initial forever #5 clk = ~clk;\nendmodule\n",
      conflicted: `module tb;
${conflictBlock(
  "  initial forever #10 clk = ~clk;\n",
  "  initial forever #5 clk = ~clk;\n"
)}endmodule
`,
      suggested: "module tb;\n  initial forever #5 clk = ~clk;\nendmodule\n",
      check: (t) => /#5/.test(t) && !/#10/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "case-default",
      title: "case default",
      prompt: "Keep default: from feature.",
      hint: "Include default branch.",
      ours: "module m;\n  always @* case (s)\n    0: y = a;\n  endcase\nendmodule\n",
      theirs: "module m;\n  always @* case (s)\n    0: y = a;\n    default: y = 0;\n  endcase\nendmodule\n",
      conflicted: `module m;
  always @* case (s)
    0: y = a;
${conflictBlock("", "    default: y = 0;\n")}  endcase
endmodule
`,
      suggested: `module m;
  always @* case (s)
    0: y = a;
    default: y = 0;
  endcase
endmodule
`,
      check: (t) => /default\s*:/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "generate-if",
      title: "generate if",
      prompt: "Keep generate if (USE_PIPE) from feature.",
      hint: "Theirs has generate.",
      ours: "module m;\n  assign y = a;\nendmodule\n",
      theirs: "module m;\n  generate if (USE_PIPE) begin\n    assign y = a;\n  end endgenerate\nendmodule\n",
      conflicted: `module m;
${conflictBlock(
  "  assign y = a;\n",
  "  generate if (USE_PIPE) begin\n    assign y = a;\n  end endgenerate\n"
)}endmodule
`,
      suggested: `module m;
  generate if (USE_PIPE) begin
    assign y = a;
  end endgenerate
endmodule
`,
      check: (t) => /generate/.test(t) && /USE_PIPE/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "markers-gone",
      title: "Markers only",
      prompt: "Any valid clear of markers for this tiny file (keep module x).",
      hint: "Delete <<<<<<< / ======= / >>>>>>> lines.",
      ours: "module x;\nendmodule\n",
      theirs: "module x;\n  // note\nendmodule\n",
      conflicted: `module x;
${conflictBlock("", "  // note\n")}endmodule
`,
      suggested: "module x;\n  // note\nendmodule\n",
      check: (t) => /module x/.test(t) && !/<<<<<<</.test(t) && !/=======/.test(t) && !/>>>>>>>/.test(t),
    },
    {
      id: "sv-always-ff",
      title: "always_ff",
      prompt: "Prefer always_ff from feature over always.",
      hint: "Take theirs.",
      ours: "module m;\n  always @(posedge clk) q <= d;\nendmodule\n",
      theirs: "module m;\n  always_ff @(posedge clk) q <= d;\nendmodule\n",
      conflicted: `module m;
${conflictBlock(
  "  always @(posedge clk) q <= d;\n",
  "  always_ff @(posedge clk) q <= d;\n"
)}endmodule
`,
      suggested: "module m;\n  always_ff @(posedge clk) q <= d;\nendmodule\n",
      check: (t) => /always_ff/.test(t) && !/<<<<<<</.test(t),
    },
    {
      id: "port-list",
      title: "ANSI ports",
      prompt: "Keep ANSI port list with input clk from feature.",
      hint: "module m(input clk);",
      ours: "module m;\n  input clk;\nendmodule\n",
      theirs: "module m(input clk);\nendmodule\n",
      conflicted: `${conflictBlock("module m;\n  input clk;\n", "module m(input clk);\n")}endmodule
`,
      suggested: "module m(input clk);\nendmodule\n",
      check: (t) => /module m\s*\(\s*input\s+clk\s*\)/.test(t) && !/<<<<<<</.test(t),
    },
  ];

  SCENARIOS.push(...MORE);

  let scenarioIdx = 0;
  let clearedIds = loadCleared();
  let showHint = false;

  const root = document.getElementById("conflict-root");

  function current() {
    return SCENARIOS[scenarioIdx];
  }

  function renderShell() {
    const sc = current();
    const cleared = clearedIds.filter((id) => SCENARIOS.some((s) => s.id === id)).length;
    root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> counter WIDTH conflict — keep enable and WIDTH=16.</p>
      <button type="button" class="btn btn-secondary" id="btn-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span style="font-weight:500;color:var(--muted);font-size:0.9rem">${cleared} / ${SCENARIOS.length} cleared</span></h2>
      <p><strong>${sc.title}:</strong> ${sc.prompt}</p>
      ${showHint ? `<p class="chal-hint"><strong>Hint:</strong> ${sc.hint}</p>` : ""}
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="btn-hint">${showHint ? "Hide hint" : "Show hint"}</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset conflict</button>
        <button type="button" class="btn btn-secondary" id="btn-ours">Take ours (HEAD)</button>
        <button type="button" class="btn btn-secondary" id="btn-theirs">Take theirs</button>
        <button type="button" class="btn btn-ghost" id="btn-suggest">Show suggested merge</button>
        <button type="button" class="btn btn-primary" id="btn-check">Check resolution</button>
        <button type="button" class="btn btn-ghost" id="btn-next">Next</button>
        <span class="challenge-status idle" id="status">Not checked</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="sides">
      <div class="side-box"><h3>ours (HEAD)</h3><pre style="margin:0;white-space:pre-wrap;font-size:0.8rem">${sc.ours.replace(/</g, "&lt;") || "(empty)"}</pre></div>
      <div class="side-box"><h3>theirs (feature)</h3><pre style="margin:0;white-space:pre-wrap;font-size:0.8rem">${sc.theirs.replace(/</g, "&lt;") || "(empty)"}</pre></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>working tree</h2></div>
      <div class="panel-body">
        <textarea class="conflict-editor" id="editor" spellcheck="false"></textarea>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>After resolving</h2></div>
      <div class="panel-body">
        <ul class="hint-list">
          <li>Remove all <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code>=======</code>, <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> markers</li>
          <li>Then: <code>git add</code> · <code>git commit</code> (merge commit)</li>
          <li>Good merges often keep intent from both sides — not blind “theirs”</li>
        </ul>
      </div>
    </div>
  `;

    const editor = document.getElementById("editor");
    editor.value = sc.conflicted;

    const cat = document.getElementById("chal-catalog");
    SCENARIOS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(s.id) ? "✓ " : "") + s.title;
      if (i === scenarioIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        scenarioIdx = i;
        showHint = false;
        renderShell();
      });
      cat.appendChild(b);
    });

    function setStatus(ok, msg) {
      const status = document.getElementById("status");
      status.className = "challenge-status " + (ok ? "pass" : "fail");
      status.textContent = msg;
    }

    document.getElementById("btn-starter").addEventListener("click", () => {
      scenarioIdx = 0;
      showHint = false;
      renderShell();
    });
    document.getElementById("btn-hint").addEventListener("click", () => {
      showHint = !showHint;
      renderShell();
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      editor.value = current().conflicted;
      document.getElementById("status").className = "challenge-status idle";
      document.getElementById("status").textContent = "Not checked";
    });
    document.getElementById("btn-ours").addEventListener("click", () => {
      editor.value = current().ours || editor.value.replace(/^<<<<<<<[\s\S]*?>>>>>>>[^\n]*\n?/gm, "");
      // Prefer explicit ours when non-empty
      if (current().ours) editor.value = current().ours;
    });
    document.getElementById("btn-theirs").addEventListener("click", () => {
      if (current().theirs) editor.value = current().theirs;
    });
    document.getElementById("btn-suggest").addEventListener("click", () => {
      editor.value = current().suggested;
    });
    document.getElementById("btn-next").addEventListener("click", () => {
      scenarioIdx = (scenarioIdx + 1) % SCENARIOS.length;
      showHint = false;
      renderShell();
    });
    document.getElementById("btn-check").addEventListener("click", () => {
      const text = editor.value;
      if (/<<<<<<<|=======|>>>>>>>/.test(text)) {
        setStatus(false, "Conflict markers still present");
        return;
      }
      if (!text.trim()) {
        setStatus(false, "File is empty");
        return;
      }
      const sc = current();
      if (sc.check(text)) {
        if (!clearedIds.includes(sc.id)) {
          clearedIds = [...clearedIds, sc.id];
          saveCleared(clearedIds);
        }
        setStatus(true, "Passed");
        // refresh catalog checks without wiping editor
        const cat2 = document.getElementById("chal-catalog");
        if (cat2) {
          [...cat2.children].forEach((btn, i) => {
            const s = SCENARIOS[i];
            btn.textContent = (clearedIds.includes(s.id) ? "✓ " : "") + s.title;
          });
        }
        const prog = root.querySelector(".challenge h2 span");
        if (prog) {
          const n = clearedIds.filter((id) => SCENARIOS.some((s) => s.id === id)).length;
          prog.textContent = `${n} / ${SCENARIOS.length} cleared`;
        }
        return;
      }
      setStatus(false, "Markers cleared but content does not match this challenge");
    });
  }

  renderShell();
})();
