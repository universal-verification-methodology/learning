(() => {
  /**
   * Golden compare (concept)
   *   Diff @ C1 · JSON/VCD export literacy
   * Starter: compare @ C1=5 — all match — MATCHED
   */

  const SIGNALS = ["clk", "q", "data"];
  const MAX_T = 15;

  /** Golden reference values by time (concept aid). */
  const GOLDEN = {
    5: { clk: "1", q: "0x3", data: "0x3" },
    8: { clk: "0", q: "0x4", data: "0x4" },
    10: { clk: "1", q: "0x5", data: "0x5" },
  };

  /** Actual (sim) values — preset overrides per scenario. */
  const ACTUAL_BY_PRESET = {
    starter: {
      5: { clk: "1", q: "0x3", data: "0x3" },
      8: { clk: "0", q: "0x4", data: "0x4" },
      10: { clk: "1", q: "0x5", data: "0x5" },
    },
    mismatch: {
      5: { clk: "1", q: "0x3", data: "0x3" },
      8: { clk: "0", q: "0x5", data: "0x4" },
      10: { clk: "1", q: "0x5", data: "0x6" },
    },
    clk_mismatch: {
      5: { clk: "0", q: "0x3", data: "0x3" },
      8: { clk: "0", q: "0x4", data: "0x4" },
      10: { clk: "1", q: "0x5", data: "0x5" },
    },
  };

  function valuesAt(actualMap, t) {
    return actualMap[t] || { clk: "0", q: "0x0", data: "0x0" };
  }

  function goldenAt(t) {
    return GOLDEN[t] || { clk: "0", q: "0x0", data: "0x0" };
  }

  function diffAt(c1, actualMap) {
    const g = goldenAt(c1);
    const a = valuesAt(actualMap, c1);
    const mismatches = SIGNALS.filter((s) => g[s] !== a[s]);
    return { golden: g, actual: a, mismatches, match: mismatches.length === 0 };
  }

  function evaluate(s) {
    const triad = s.didCompare && s.didExportJson && s.didExportVcd;
    const d = diffAt(s.c1, s.actualMap);
    const compared = s.compared;

    let status = "OPEN";
    let ready = false;
    let reason = "set C1, Compare @ C1, then export JSON and VCD";

    if (compared && d.match && triad) {
      status = "MATCHED";
      ready = true;
      reason = `C1@${s.c1} golden=actual · JSON + VCD exported`;
    } else if (compared && !d.match) {
      status = "DIFF";
      reason = `mismatch @ C1=${s.c1}: ${d.mismatches.join(", ")}`;
    } else if (compared && d.match && !triad) {
      status = "PARTIAL";
      reason = "compare ok — finish JSON + VCD export triad";
    } else {
      status = "OPEN";
      reason = "set C1 and Compare @ C1 against golden";
    }

    return { status, ready, reason, triad, d, compared };
  }

  const PRESETS = {
    starter: {
      label: "starter: matched",
      c1: 5,
      actualKey: "starter",
      compared: true,
      didCompare: true,
      didExportJson: true,
      didExportVcd: true,
      sel: "q",
      note: "Compare @5 — all match · JSON + VCD exported — MATCHED.",
      autoScan: true,
    },
    mismatch: {
      label: "q mismatch @8",
      c1: 8,
      actualKey: "mismatch",
      compared: true,
      didCompare: true,
      didExportJson: false,
      didExportVcd: false,
      sel: "q",
      note: "Compare @8 — q differs — DIFF.",
      autoScan: true,
    },
    clk_mismatch: {
      label: "clk mismatch @5",
      c1: 5,
      actualKey: "clk_mismatch",
      compared: true,
      didCompare: true,
      didExportJson: false,
      didExportVcd: false,
      sel: "clk",
      note: "Compare @5 — clk differs — DIFF.",
      autoScan: true,
    },
    uncompared: {
      label: "not compared",
      c1: 5,
      actualKey: "starter",
      compared: false,
      didCompare: false,
      didExportJson: false,
      didExportVcd: false,
      sel: "clk",
      note: "C1@5 set — click Compare @ C1.",
      autoScan: true,
    },
    unscanned: {
      label: "idle unscanned",
      c1: 5,
      actualKey: "starter",
      compared: false,
      didCompare: false,
      didExportJson: false,
      didExportVcd: false,
      sel: "q",
      note: "Idle — compare / export, then Scan.",
      autoScan: false,
    },
  };

  function literacyText() {
    return [
      "// Golden compare literacy (document aid — not a real regression)",
      "//",
      "//   C1       → cursor time for snapshot compare",
      "//   golden   → expected reference (from file or prior run)",
      "//   actual   → current sim values @ C1",
      "//   JSON     → structured signal dump for scripts / CI",
      "//   VCD/FST  → waveform artifact for GTKWave / sharing",
      "//",
      "// MATCHED = compare @ C1 with zero diffs + export triad practiced.",
      "// Pair with self-check-tb and hdl-sim-waves.",
    ].join("\n");
  }

  function jsonExport(c1, d) {
    return JSON.stringify(
      {
        time: c1,
        signals: SIGNALS.map((s) => ({
          name: s,
          golden: d.golden[s],
          actual: d.actual[s],
          match: d.golden[s] === d.actual[s],
        })),
      },
      null,
      2
    );
  }

  function vcdSnippet(c1, d) {
    const lines = [
      "$date",
      "  golden-compare concept export",
      "$end",
      "$timescale 1ns $end",
      "$scope module tb $end",
    ];
    SIGNALS.forEach((s) => {
      lines.push(`$var wire 4 ${s[0]} ${s} $end`);
    });
    lines.push(`#${c1 * 10}`);
    SIGNALS.forEach((s) => {
      lines.push(`b${d.actual[s].replace(/^0x/, "")} ${s[0]}`);
    });
    lines.push("$enddefinitions $end");
    return lines.join("\n");
  }

  function makeStarter() {
    const p = PRESETS.starter;
    const actualMap = ACTUAL_BY_PRESET[p.actualKey];
    const ev = evaluate({
      c1: p.c1,
      actualMap,
      compared: p.compared,
      didCompare: p.didCompare,
      didExportJson: p.didExportJson,
      didExportVcd: p.didExportVcd,
    });
    const d = diffAt(p.c1, actualMap);
    return {
      preset: "starter",
      c1: p.c1,
      actualMap,
      actualKey: p.actualKey,
      compared: p.compared,
      didCompare: p.didCompare,
      didExportJson: p.didExportJson,
      didExportVcd: p.didExportVcd,
      sel: p.sel,
      note: p.note,
      status: ev.status,
      ready: ev.ready,
      reason: ev.reason,
      lastDiff: d.mismatches,
      exportPreview: jsonExport(p.c1, d),
      lastScanned: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [`scan: ${ev.status}`],
    };
  }

  const CLEARED_KEY = "ddv-hdl-sim-compare-golden-cleared-v1";
  const STORE_KEY = "ddv-hdl-sim-compare-golden-session-v1";

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  let challengeIdx = 0;
  let showHint = false;
  let quizChoice = "";
  let state = makeStarter();

  const root = document.getElementById("hcg-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong>
        Compare @ C1=5 — golden matches actual — JSON + VCD exported — MATCHED.</p>
      <button type="button" class="btn btn-secondary" id="hcg-starter">Load starter example</button>
    </div>
    <div class="challenge">
      <h2>Challenges <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div class="tool-actions" id="chal-answer-row"></div>
      <div class="tool-actions" id="chal-quiz" hidden></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Core ideas</h2></div>
      <div class="idea-grid">
        <div class="idea-card"><h3>C1</h3><p>Cursor time for snapshot.</p></div>
        <div class="idea-card"><h3>Golden</h3><p>Expected reference values.</p></div>
        <div class="idea-card"><h3>Diff</h3><p>Actual vs golden @ C1.</p></div>
        <div class="idea-card"><h3>Export</h3><p>JSON scriptable · VCD waves.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="hcg-controls">
        <div class="hcg-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>matched starter</option>
            <option value="mismatch">q mismatch @8</option>
            <option value="clk_mismatch">clk mismatch @5</option>
            <option value="uncompared">not compared</option>
            <option value="unscanned">idle unscanned</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-compare">Compare @ C1</button>
        <button type="button" class="btn btn-ghost" id="btn-json">Export JSON</button>
        <button type="button" class="btn btn-ghost" id="btn-vcd">Export VCD</button>
        <button type="button" class="btn btn-ghost" id="btn-scan">Scan</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo mismatch</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="hcg-layout">
        <div class="panel-box">
          <h3>C1 timeline (0–${MAX_T})</h3>
          <div class="timeline" id="timeline"></div>
          <h3>Compare @ C1=${""}<span id="c1-label">5</span></h3>
          <table class="cmp-table" id="cmp-table">
            <thead><tr><th>signal</th><th>golden</th><th>actual</th><th>ok</th></tr></thead>
            <tbody id="cmp-body"></tbody>
          </table>
          <h3>Export preview</h3>
          <pre class="export-box" id="export-box"></pre>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Compare sketch</h3>
          <pre class="plan-box" id="plan-box"></pre>
        </div>
      </div>
      <h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Literacy sketch</h3>
      <pre class="code-box" id="code-box"></pre>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Trace</h3>
        <pre class="trace-box" id="trace-box"></pre>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Log</h3>
        <pre class="log-box" id="log-box"></pre>
      </div>
    </div>
  `;

  const selPreset = /** @type {HTMLSelectElement} */ (document.getElementById("sel-preset"));

  function planSketch() {
    const d = diffAt(state.c1, state.actualMap);
    return `# golden compare @ C1=${state.c1}
compared: ${state.compared ? 1 : 0}
mismatches: ${d.mismatches.length ? d.mismatches.join(", ") : "(none)"}
exports: json=${state.didExportJson ? 1 : 0} vcd=${state.didExportVcd ? 1 : 0}
# status: ${state.lastScanned ? state.status : "— (Scan)"}
# reason: ${state.lastScanned ? state.reason : "—"}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kindName, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kindName;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
  }

  function updateExportPreview(fmt) {
    const d = diffAt(state.c1, state.actualMap);
    if (fmt === "vcd") state.exportPreview = vcdSnippet(state.c1, d);
    else state.exportPreview = jsonExport(state.c1, d);
  }

  function runScan(silent) {
    const ev = evaluate(state);
    state.status = ev.status;
    state.ready = ev.ready;
    state.reason = ev.reason;
    state.lastDiff = ev.d.mismatches;
    state.lastScanned = true;
    pushTrace(`scan: ${ev.status}`);
    if (!silent) {
      state.lastAction = ev.ready ? "scan-ok" : "scan-bad";
      pushLog(`# scan ${ev.status}`);
      renderAll();
    }
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter MATCHED");
    renderAll();
  }

  function applyPreset(id, mark) {
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.c1 = p.c1;
    state.actualMap = ACTUAL_BY_PRESET[p.actualKey];
    state.actualKey = p.actualKey;
    state.compared = p.compared;
    state.didCompare = p.didCompare;
    state.didExportJson = p.didExportJson;
    state.didExportVcd = p.didExportVcd;
    state.sel = p.sel;
    state.note = p.note;
    state.status = "—";
    state.ready = false;
    state.reason = "—";
    state.lastScanned = false;
    updateExportPreview("json");
    syncInputs();
    if (p.autoScan) {
      runScan(true);
      if (mark) state.lastAction = mark;
    } else if (mark) {
      state.lastAction = mark;
    }
  }

  function loadPreset() {
    applyPreset(selPreset.value, "load");
    pushLog(`# load ${state.preset}`);
    renderAll();
  }

  function setC1(t) {
    state.c1 = t;
    state.compared = false;
    state.preset = "custom";
    pushTrace(`C1: ${t}`);
    pushLog(`# C1 ${t}`);
    updateExportPreview("json");
    state.lastAction = "c1";
    renderAll();
  }

  function doCompare() {
    const d = diffAt(state.c1, state.actualMap);
    state.compared = true;
    state.didCompare = true;
    state.lastDiff = d.mismatches;
    state.preset = "custom";
    pushTrace(`compare@${state.c1}: ${d.match ? "MATCH" : "DIFF " + d.mismatches.join(",")}`);
    pushLog(`# compare @${state.c1}`);
    updateExportPreview("json");
    runScan(true);
    state.lastAction = "compare";
    renderAll();
  }

  function exportJson() {
    updateExportPreview("json");
    state.didExportJson = true;
    state.preset = "custom";
    pushTrace("export: JSON");
    pushLog("# export JSON");
    runScan(true);
    state.lastAction = "json";
    renderAll();
  }

  function exportVcd() {
    updateExportPreview("vcd");
    state.didExportVcd = true;
    state.preset = "custom";
    pushTrace("export: VCD");
    pushLog("# export VCD");
    runScan(true);
    state.lastAction = "vcd";
    renderAll();
  }

  function selectSig(id) {
    state.sel = id;
    state.lastAction = "select";
    renderAll();
  }

  function demo() {
    applyPreset("mismatch", "demo");
    state.demoed = true;
    pushLog("# demo mismatch DIFF");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# explain golden compare / export");
    pushTrace("explain: golden vs actual @ C1 · JSON + VCD → MATCHED");
    renderAll();
  }

  function sigBlurb(id) {
    const map = {
      clk: "Clock — often the first sanity check in a golden diff.",
      q: "Counter output — compare bus value @ C1 against reference.",
      data: "Data input — mismatches here may mean stimulus drift.",
    };
    return map[id] || "Select a row to inspect golden vs actual.";
  }

  function renderLab() {
    syncInputs();
    const d = diffAt(state.c1, state.actualMap);
    const ev = evaluate(state);

    document.getElementById("c1-label").textContent = String(state.c1);
    document.getElementById("timeline").innerHTML = Array.from(
      { length: MAX_T + 1 },
      (_, t) => {
        const cls = ["tick", state.c1 === t ? "is-c1" : ""].filter(Boolean).join(" ");
        const hasGolden = t in GOLDEN;
        return `<button type="button" class="${cls}" data-t="${t}" title="${hasGolden ? "golden ref" : ""}">${t}</button>`;
      }
    ).join("");
    document.querySelectorAll("[data-t]").forEach((el) => {
      el.addEventListener("click", () => setC1(Number(el.getAttribute("data-t"))));
    });

    document.getElementById("cmp-body").innerHTML = SIGNALS.map((s) => {
      const ok = d.golden[s] === d.actual[s];
      return `<tr class="${state.sel === s ? "is-sel" : ""} ${!ok && state.compared ? "is-mismatch" : ""}" data-sig="${s}">
        <td>${s}</td>
        <td>${d.golden[s]}</td>
        <td>${d.actual[s]}</td>
        <td class="${ok ? "tag-ok" : "tag-bad"}">${state.compared ? (ok ? "ok" : "DIFF") : "—"}</td>
      </tr>`;
    }).join("");
    document.querySelectorAll("[data-sig]").forEach((el) => {
      el.addEventListener("click", () =>
        selectSig(/** @type {string} */ (el.getAttribute("data-sig")))
      );
    });

    document.getElementById("export-box").textContent =
      state.exportPreview || "(export JSON or VCD)";
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent = sigBlurb(state.sel);
    document.getElementById("plan-box").textContent = planSketch();
    document.getElementById("code-box").textContent = literacyText();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!state.lastScanned) {
      v.className = "verdict idle";
      v.textContent = "Idle — Compare @ C1 / Export / Scan";
    } else if (state.ready) {
      v.className = "verdict yes";
      v.textContent = `MATCHED — ${state.reason}`;
    } else {
      v.className = "verdict no";
      v.textContent = `${state.status} — ${state.reason}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.ready && state.lastScanned ? "is-ok" : state.lastScanned ? "is-bad" : ""}">match=${state.lastScanned ? (state.ready ? 1 : 0) : "—"}</span>
      <span class="flag ${state.compared && d.match ? "is-ok" : state.compared ? "is-bad" : ""}">diffs=${state.compared ? d.mismatches.length : "—"}</span>
      <span class="flag is-ok">C1=${state.c1}</span>
      <span class="flag ${ev.triad ? "is-ok" : "is-bad"}">triad=${ev.triad ? 1 : 0}</span>
      <span class="flag ${state.didExportJson ? "is-ok" : ""}">json=${state.didExportJson ? 1 : 0}</span>
      <span class="flag ${state.didExportVcd ? "is-ok" : ""}">vcd=${state.didExportVcd ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          c1: state.c1,
          actualKey: state.actualKey,
          compared: state.compared,
          didCompare: state.didCompare,
          didExportJson: state.didExportJson,
          didExportVcd: state.didExportVcd,
          sel: state.sel,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-golden",
      title: "Quiz: golden",
      type: "quiz",
      prompt: "A golden reference is…",
      hint: "Expected.",
      choices: [
        "the expected signal values you compare actual sim results against",
        "only the VCD file header",
        "the Git remote URL",
        "a synthesis constraint file",
      ],
      answer:
        "the expected signal values you compare actual sim results against",
    },
    {
      id: "quiz-c1",
      title: "Quiz: C1",
      type: "quiz",
      prompt: "Comparing @ C1 means…",
      hint: "Snapshot.",
      choices: [
        "reading golden vs actual at the cursor time, not the whole run",
        "deleting all breakpoints",
        "changing radix to hex only",
        "forcing the clock high forever",
      ],
      answer:
        "reading golden vs actual at the cursor time, not the whole run",
    },
    {
      id: "quiz-json",
      title: "Quiz: JSON",
      type: "quiz",
      prompt: "JSON export is useful because…",
      hint: "Scripts.",
      choices: [
        "scripts and CI can parse structured per-signal match results",
        "it replaces the need for any testbench",
        "it is only for analog SPICE",
        "it hides mismatches automatically",
      ],
      answer:
        "scripts and CI can parse structured per-signal match results",
    },
    {
      id: "quiz-vcd",
      title: "Quiz: VCD",
      type: "quiz",
      prompt: "VCD export is mainly for…",
      hint: "Waves.",
      choices: [
        "waveform viewers (GTKWave etc.) and sharing time-domain traces",
        "Git merge conflict resolution",
        "Makefile dependency graphs",
        "UVM factory overrides only",
      ],
      answer:
        "waveform viewers (GTKWave etc.) and sharing time-domain traces",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — MATCHED.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.ready &&
        state.status === "MATCHED",
    },
    {
      id: "load-mismatch",
      title: "Load mismatch",
      prompt: "Load q mismatch @8 — DIFF.",
      hint: "q mismatch @8 → Load",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () => state.status === "DIFF" && state.lastDiff.includes("q"),
    },
    {
      id: "load-clk",
      title: "Load clk mismatch",
      prompt: "Load clk mismatch @5 — DIFF on clk.",
      hint: "clk mismatch → Load",
      setup: () => {
        selPreset.value = "clk_mismatch";
        loadPreset();
      },
      check: () =>
        state.status === "DIFF" && state.lastDiff.includes("clk"),
    },
    {
      id: "load-uncompared",
      title: "Load uncompared",
      prompt: "Load not compared — OPEN.",
      hint: "not compared → Load",
      setup: () => {
        selPreset.value = "uncompared";
        loadPreset();
      },
      check: () => !state.compared && state.status === "OPEN",
    },
    {
      id: "set-c1",
      title: "Set C1",
      prompt: "From starter, move C1 to 8.",
      hint: "Click 8 on timeline",
      setup: () => {
        loadStarter();
        setC1(8);
      },
      check: () => state.c1 === 8 && state.lastAction === "c1",
    },
    {
      id: "compare",
      title: "Compare",
      prompt: "From uncompared, Compare @ C1.",
      hint: "Compare @ C1",
      setup: () => {
        selPreset.value = "uncompared";
        loadPreset();
        doCompare();
      },
      check: () => state.compared && state.lastAction === "compare",
    },
    {
      id: "export-json",
      title: "Export JSON",
      prompt: "From starter path, Export JSON.",
      hint: "Export JSON",
      setup: () => {
        selPreset.value = "uncompared";
        loadPreset();
        doCompare();
        exportJson();
      },
      check: () =>
        state.didExportJson &&
        state.lastAction === "json" &&
        /"time"/.test(state.exportPreview),
    },
    {
      id: "export-vcd",
      title: "Export VCD",
      prompt: "Export VCD snippet.",
      hint: "Export VCD",
      setup: () => {
        loadStarter();
        exportVcd();
      },
      check: () =>
        state.didExportVcd &&
        state.lastAction === "vcd" &&
        /\$timescale/.test(state.exportPreview),
    },
    {
      id: "triad",
      title: "Triad",
      prompt: "Starter has compare + JSON + VCD triad.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => {
        const ev = evaluate(state);
        return ev.triad;
      },
    },
    {
      id: "select",
      title: "Select q",
      prompt: "Select q row in compare table.",
      hint: "Click q row",
      setup: () => {
        loadStarter();
        selectSig("q");
      },
      check: () => state.sel === "q" && state.lastAction === "select",
    },
    {
      id: "scan-ok",
      title: "Scan MATCHED",
      prompt: "On starter, Scan — MATCHED.",
      hint: "Scan",
      setup: () => {
        loadStarter();
        runScan(false);
      },
      check: () => state.ready && state.lastAction === "scan-ok",
    },
    {
      id: "scan-bad",
      title: "Scan DIFF",
      prompt: "On mismatch, Scan — not MATCHED.",
      hint: "mismatch → Scan",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
        runScan(false);
      },
      check: () => !state.ready && state.lastAction === "scan-bad",
    },
    {
      id: "demo",
      title: "Demo mismatch",
      prompt: "Click Demo mismatch.",
      hint: "Demo mismatch",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.status === "DIFF" &&
        state.lastAction === "demo",
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Click Explain.",
      hint: "Explain",
      setup: () => loadStarter(),
      check: () => state.explained === true,
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions VCD or JSON.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /VCD|JSON/.test(literacyText()),
    },
    {
      id: "matched-values",
      title: "All ok @5",
      prompt: "Starter @ C1=5 — zero diffs after compare.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => {
        const d = diffAt(5, state.actualMap);
        return state.compared && d.mismatches.length === 0;
      },
    },
    {
      id: "mismatch-count",
      title: "Mismatch count",
      prompt: "Mismatch @8 — at least one DIFF row.",
      hint: "q mismatch @8",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () => state.lastDiff.length >= 1,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From mismatch, Reset — MATCHED again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "mismatch";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.status === "MATCHED",
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) =>
      CHALLENGES.some((c) => c.id === id)
    ).length;
    document.getElementById("chal-progress").textContent =
      `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint
      ? "Hide hint"
      : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "quiz") {
      ansRow.innerHTML = "";
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="hcg-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          quizChoice = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
      ansRow.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = clearedIds.includes(c.id) ? `✓ ${i + 1}` : String(i + 1);
      b.style.opacity = i === challengeIdx ? "1" : "0.7";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        else renderAll();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("hcg-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-compare").addEventListener("click", () => doCompare());
  document.getElementById("btn-json").addEventListener("click", () => exportJson());
  document.getElementById("btn-vcd").addEventListener("click", () => exportVcd());
  document.getElementById("btn-scan").addEventListener("click", () => runScan(false));
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    quizChoice = "";
    setChalStatus("idle", "Idle");
    const ch = CHALLENGES[challengeIdx];
    if (typeof ch.setup === "function") ch.setup();
    else renderAll();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else if (typeof ch.check === "function") ok = !!ch.check();
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds.push(ch.id);
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("ok", "Cleared");
    } else setChalStatus("bad", "Not yet");
    renderChallenge();
  });

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved) {
        state.c1 = saved.c1 ?? state.c1;
        state.actualKey = saved.actualKey || state.actualKey;
        state.actualMap = ACTUAL_BY_PRESET[state.actualKey] || state.actualMap;
        state.compared = saved.compared ?? state.compared;
        state.didCompare = saved.didCompare ?? state.didCompare;
        state.didExportJson = saved.didExportJson ?? state.didExportJson;
        state.didExportVcd = saved.didExportVcd ?? state.didExportVcd;
        state.sel = saved.sel || state.sel;
        state.preset = saved.preset || "starter";
        state.lastScanned = false;
        state.lastAction = "restore";
        updateExportPreview("json");
        syncInputs();
      }
    }
  } catch {
    /* ignore */
  }

  renderAll();
})();
