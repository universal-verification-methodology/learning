(() => {
  /**
   * ConfigDB key path (concept)
   *   set(path, field, value) · get from component path (walk up)
   * Starter: set vif @ env.agent → get from env.agent.drv
   */

  const PRESETS = {
    starter: {
      label: "starter: vif @ env.agent",
      entries: [{ path: "env.agent", field: "vif", value: "uart_vif" }],
      getPath: "env.agent.drv",
      getField: "vif",
      note: "Driver gets vif set on its parent agent path.",
    },
    miss: {
      label: "wrong field → miss",
      entries: [{ path: "env.agent", field: "vif", value: "uart_vif" }],
      getPath: "env.agent.drv",
      getField: "is_active",
      note: "Field name must match — vif entry does not satisfy is_active get.",
    },
    specific: {
      label: "more-specific wins",
      entries: [
        { path: "env", field: "is_active", value: "UVM_PASSIVE" },
        { path: "env.agent", field: "is_active", value: "UVM_ACTIVE" },
      ],
      getPath: "env.agent",
      getField: "is_active",
      note: "Longer matching path wins over a parent set.",
    },
    top: {
      label: "set at top (uvm_root)",
      entries: [{ path: "", field: "timeout", value: "1ms" }],
      getPath: "env.agent.drv",
      getField: "timeout",
      note: "Empty path ≈ top/null context — visible after walking up.",
    },
    sibling_miss: {
      label: "sibling cannot see",
      entries: [{ path: "env.agent0", field: "vif", value: "a0_vif" }],
      getPath: "env.agent1.drv",
      getField: "vif",
      note: "agent1 does not walk into agent0 — get misses.",
    },
  };

  function sourceSketch() {
    return `// ConfigDB literacy (not a full UVM resource DB)
// set: uvm_config_db#(T)::set(cntxt, inst_name, field, value)
// get: uvm_config_db#(T)::get(cntxt, inst_name, field, value)
//
// Teaching model here:
//   entries are (path, field, value)
//   get from component C walks C, parent(C), … looking for field
//   among matches, the longest (most specific) path wins
//
// Typical: set vif on "env.agent"; driver under that agent can get it.
// Wrong field name or sibling path → miss (check return bit).`;
  }

  function ancestors(path) {
    const p = String(path || "").replace(/^\.+|\.+$/g, "");
    if (!p) return [""];
    const parts = p.split(".");
    const out = [];
    for (let i = parts.length; i >= 0; i--) {
      out.push(i === 0 ? "" : parts.slice(0, i).join("."));
    }
    return out;
  }

  function lookup(entries, getPath, getField) {
    const walk = ancestors(getPath);
    const ancSet = new Set(walk);
    const matching = entries
      .map((e, idx) => ({ ...e, idx }))
      .filter((e) => e.field === getField && ancSet.has(e.path));
    if (!matching.length) {
      return { ok: false, value: null, entry: null, walk };
    }
    matching.sort((a, b) => {
      const dl = String(b.path).length - String(a.path).length;
      return dl !== 0 ? dl : b.idx - a.idx;
    });
    const entry = matching[0];
    return { ok: true, value: entry.value, entry, walk };
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      entries: p.entries.map((e) => ({ ...e })),
      getPath: p.getPath,
      getField: p.getField,
      setPath: "env.agent",
      setField: "vif",
      setValue: "uart_vif",
      note: p.note,
      lastGet: null,
      lastAction: "starter",
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-uvm-configdb-cleared-v1";
  const STORE_KEY = "ddv-uvm-configdb-session-v1";

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

  const root = document.getElementById("ucfg-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <code>set("env.agent","vif",uart_vif)</code>
        then <code>get</code> from <code>env.agent.drv</code> — hit by walking up.</p>
      <button type="button" class="btn btn-secondary" id="ucfg-starter">Load starter example</button>
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
        <div class="idea-card"><h3>set</h3><p>Publish a value under a hierarchical path + field name.</p></div>
        <div class="idea-card"><h3>get</h3><p>Ask from a component path; walk parents for the field.</p></div>
        <div class="idea-card"><h3>Specificity</h3><p>Longer matching path beats a parent set.</p></div>
        <div class="idea-card"><h3>Miss</h3><p>Wrong field or sibling branch → get fails.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ucfg-controls">
        <div class="ucfg-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>vif @ env.agent</option>
            <option value="miss">wrong field miss</option>
            <option value="specific">more-specific wins</option>
            <option value="top">set at top</option>
            <option value="sibling_miss">sibling miss</option>
          </select>
        </div>
        <div class="ucfg-field">
          <label for="inp-set-path">set path</label>
          <input id="inp-set-path" type="text" spellcheck="false">
        </div>
        <div class="ucfg-field">
          <label for="inp-set-field">set field</label>
          <input id="inp-set-field" type="text" spellcheck="false">
        </div>
        <div class="ucfg-field">
          <label for="inp-set-value">set value</label>
          <input id="inp-set-value" type="text" spellcheck="false">
        </div>
        <div class="ucfg-field">
          <label for="inp-get-path">get path</label>
          <input id="inp-get-path" type="text" spellcheck="false">
        </div>
        <div class="ucfg-field">
          <label for="inp-get-field">get field</label>
          <input id="inp-get-field" type="text" spellcheck="false">
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-set">set</button>
        <button type="button" class="btn btn-secondary" id="btn-get">get</button>
        <button type="button" class="btn btn-ghost" id="btn-clear">Clear DB</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo specific</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ucfg-layout">
        <div class="panel-box">
          <h3>ConfigDB entries</h3>
          <div id="db-box"></div>
          <p class="meta-note" id="meta-note"></p>
          <h3 style="margin-top:0.75rem">Last get</h3>
          <div class="get-box" id="get-box">Click get</div>
        </div>
        <div class="panel-box">
          <h3>Code sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:18rem"></pre>
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
  const inpSetPath = /** @type {HTMLInputElement} */ (document.getElementById("inp-set-path"));
  const inpSetField = /** @type {HTMLInputElement} */ (document.getElementById("inp-set-field"));
  const inpSetValue = /** @type {HTMLInputElement} */ (document.getElementById("inp-set-value"));
  const inpGetPath = /** @type {HTMLInputElement} */ (document.getElementById("inp-get-path"));
  const inpGetField = /** @type {HTMLInputElement} */ (document.getElementById("inp-get-field"));

  function codeSketch() {
    const g = state.lastGet || lookup(state.entries, state.getPath, state.getField);
    return `// set (e.g. in test / env build):
uvm_config_db#(virtual uart_if)::set(
  null, "${state.setPath}", "${state.setField}", ${state.setValue});

// get (e.g. in driver build):
virtual uart_if vif;
if (!uvm_config_db#(virtual uart_if)::get(
      this, "", "${state.getField}", vif))
  \`uvm_fatal("CFG", "missing ${state.getField}")
// get path ≈ ${state.getPath}
// last get: ${g.ok ? "HIT " + g.value + " @ " + (g.entry && g.entry.path) : "MISS"}`;
  }

  function pushTrace(line) {
    state.trace = [...state.trace.slice(-48), line];
  }

  function pushLog(line) {
    state.log = [...state.log.slice(-40), line];
  }

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function syncInputs() {
    selPreset.value = state.preset in PRESETS ? state.preset : "starter";
    inpSetPath.value = state.setPath;
    inpSetField.value = state.setField;
    inpSetValue.value = state.setValue;
    inpGetPath.value = state.getPath;
    inpGetField.value = state.getField;
  }

  function pullInputs() {
    state.setPath = inpSetPath.value.trim();
    state.setField = inpSetField.value.trim() || "field";
    state.setValue = inpSetValue.value.trim() || "value";
    state.getPath = inpGetPath.value.trim();
    state.getField = inpGetField.value.trim() || "field";
  }

  function doGet() {
    pullInputs();
    const g = lookup(state.entries, state.getPath, state.getField);
    state.lastGet = g;
    state.lastAction = "get";
    if (g.ok) {
      pushTrace(`get HIT ${state.getField}=${g.value} from path="${g.entry.path}"`);
      pushLog(`# get HIT`);
    } else {
      pushTrace(`get MISS field=${state.getField} path=${state.getPath}`);
      pushLog(`# get MISS`);
    }
    renderAll();
  }

  function doSet() {
    pullInputs();
    state.entries = [
      ...state.entries,
      { path: state.setPath, field: state.setField, value: state.setValue },
    ];
    state.lastAction = "set";
    pushLog(`# set ${state.setPath}.${state.setField}=${state.setValue}`);
    pushTrace(`set (${state.setPath}, ${state.setField})`);
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    doGet();
    state.lastAction = "starter";
    pushLog("# starter vif get");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.entries = p.entries.map((e) => ({ ...e }));
    state.getPath = p.getPath;
    state.getField = p.getField;
    state.note = p.note;
    if (p.entries[0]) {
      state.setPath = p.entries[0].path;
      state.setField = p.entries[0].field;
      state.setValue = p.entries[0].value;
    }
    state.lastGet = null;
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function clearDb() {
    state.entries = [];
    state.lastGet = null;
    state.note = "DB cleared.";
    state.lastAction = "clear";
    pushLog("# clear");
    renderAll();
  }

  function demo() {
    const p = PRESETS.specific;
    state.preset = "specific";
    state.entries = p.entries.map((e) => ({ ...e }));
    state.getPath = p.getPath;
    state.getField = p.getField;
    state.setPath = "env.agent";
    state.setField = "is_active";
    state.setValue = "UVM_ACTIVE";
    state.note = p.note;
    state.demoed = true;
    syncInputs();
    doGet();
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo specific wins");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: ConfigDB keys are path + field; get walks parents; " +
        "more-specific path wins; check the get return bit."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const g = state.lastGet;
    const hitIdx = g && g.ok && g.entry ? g.entry.idx : -1;

    let html =
      `<table class="db-table"><thead><tr><th>#</th><th>path</th><th>field</th><th>value</th></tr></thead><tbody>`;
    if (!state.entries.length) {
      html += `<tr><td colspan="4">(empty)</td></tr>`;
    } else {
      state.entries.forEach((e, i) => {
        const cls = i === hitIdx ? "is-hit" : "";
        html += `<tr class="${cls}"><td>${i}</td><td>${e.path === "" ? '(top)""' : e.path}</td><td>${e.field}</td><td>${e.value}</td></tr>`;
      });
    }
    html += `</tbody></table>`;
    document.getElementById("db-box").innerHTML = html;

    const box = document.getElementById("get-box");
    if (!g) {
      box.className = "get-box";
      box.textContent = "Click get";
    } else if (g.ok) {
      box.className = "get-box is-ok";
      box.textContent = `HIT  ${state.getField} = ${g.value}\nmatched path "${g.entry.path}"\nwalk: ${g.walk.map((w) => (w === "" ? '""' : w)).join(" → ")}`;
    } else {
      box.className = "get-box is-miss";
      box.textContent = `MISS  field=${state.getField}\nwalk: ${g.walk.map((w) => (w === "" ? '""' : w)).join(" → ")}`;
    }

    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (!g) {
      v.className = "verdict idle";
      v.textContent = `${state.entries.length} entr(y/ies) · set / get when ready`;
    } else if (g.ok) {
      v.className = "verdict yes";
      v.textContent = `get HIT — ${g.value}`;
    } else {
      v.className = "verdict no";
      v.textContent = "get MISS — no matching path+field";
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">entries=${state.entries.length}</span>
      <span class="flag is-on">get=${state.getPath}.${state.getField}</span>
      <span class="flag ${g && g.ok ? "is-ok" : g ? "is-bad" : ""}">hit=${g && g.ok ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          getPath: state.getPath,
          getField: state.getField,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-key",
      title: "Quiz: key",
      type: "quiz",
      prompt: "A ConfigDB lookup is keyed mainly by…",
      hint: "Path + field.",
      choices: [
        "hierarchical path plus field name",
        "only the simulator seed",
        "VCD dump file name",
        "Makefile target order",
      ],
      answer: "hierarchical path plus field name",
    },
    {
      id: "quiz-walk",
      title: "Quiz: walk",
      type: "quiz",
      prompt: "If get does not find a field on this, it typically…",
      hint: "Parents.",
      choices: [
        "walks up parent paths looking for the same field",
        "deletes the env",
        "raises an objection forever",
        "rewrites the DUT RTL",
      ],
      answer: "walks up parent paths looking for the same field",
    },
    {
      id: "quiz-specific",
      title: "Quiz: specific",
      type: "quiz",
      prompt: "When parent and child both set the same field…",
      hint: "Longer path.",
      choices: [
        "the more-specific (longer) matching path wins",
        "the parent always wins",
        "both values are ORed",
        "get always misses",
      ],
      answer: "the more-specific (longer) matching path wins",
    },
    {
      id: "quiz-miss",
      title: "Quiz: miss",
      type: "quiz",
      prompt: "get returning 0 / false means…",
      hint: "Check the bit.",
      choices: [
        "no matching path+field was found",
        "the factory is disabled",
        "phases are complete",
        "the scoreboard passed",
      ],
      answer: "no matching path+field was found",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — get HIT uart_vif.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.lastGet &&
        state.lastGet.ok &&
        state.lastGet.value === "uart_vif",
    },
    {
      id: "get",
      title: "Get",
      prompt: "On starter DB, click get — HIT.",
      hint: "get",
      setup: () => {
        state = makeStarter();
        syncInputs();
        doGet();
      },
      check: () => state.lastAction === "get" && state.lastGet && state.lastGet.ok,
    },
    {
      id: "load-miss",
      title: "Load miss",
      prompt: "Load wrong field miss, get → MISS.",
      hint: "wrong field → Load → get",
      setup: () => {
        selPreset.value = "miss";
        loadPreset();
        doGet();
      },
      check: () => state.preset === "miss" && state.lastGet && !state.lastGet.ok,
    },
    {
      id: "load-specific",
      title: "Load specific",
      prompt: "Load more-specific wins — value UVM_ACTIVE.",
      hint: "more-specific → Load → get",
      setup: () => {
        selPreset.value = "specific";
        loadPreset();
        doGet();
      },
      check: () =>
        state.lastGet &&
        state.lastGet.ok &&
        state.lastGet.value === "UVM_ACTIVE",
    },
    {
      id: "load-top",
      title: "Load top",
      prompt: "Load set at top — get HIT 1ms.",
      hint: "set at top → Load → get",
      setup: () => {
        selPreset.value = "top";
        loadPreset();
        doGet();
      },
      check: () => state.lastGet && state.lastGet.ok && state.lastGet.value === "1ms",
    },
    {
      id: "load-sib",
      title: "Load sibling",
      prompt: "Load sibling miss — get MISS.",
      hint: "sibling → Load → get",
      setup: () => {
        selPreset.value = "sibling_miss";
        loadPreset();
        doGet();
      },
      check: () => state.preset === "sibling_miss" && state.lastGet && !state.lastGet.ok,
    },
    {
      id: "set",
      title: "Set",
      prompt: "Clear DB, set path=env field=x value=1, then get from env.",
      hint: "Clear → set → get",
      setup: () => {
        clearDb();
        state.setPath = "env";
        state.setField = "x";
        state.setValue = "1";
        state.getPath = "env";
        state.getField = "x";
        syncInputs();
        doSet();
        doGet();
      },
      check: () =>
        state.entries.some((e) => e.field === "x" && e.value === "1") &&
        state.lastGet &&
        state.lastGet.ok,
    },
    {
      id: "clear",
      title: "Clear",
      prompt: "Clear DB — entries=0.",
      hint: "Clear DB",
      setup: () => {
        loadStarter();
        clearDb();
      },
      check: () => state.entries.length === 0 && state.lastAction === "clear",
    },
    {
      id: "demo",
      title: "Demo specific",
      prompt: "Click Demo specific — HIT UVM_ACTIVE.",
      hint: "Demo specific",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.lastGet &&
        state.lastGet.value === "UVM_ACTIVE" &&
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
      id: "sketch-set",
      title: "Sketch set",
      prompt: "Code sketch mentions uvm_config_db.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /uvm_config_db/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "literacy",
      title: "Literacy",
      prompt: "Literacy sketch mentions more-specific path.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /more-specific/i.test(sourceSketch()),
    },
    {
      id: "matched-path",
      title: "Matched path",
      prompt: "Starter get matches path env.agent.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () =>
        state.lastGet &&
        state.lastGet.ok &&
        state.lastGet.entry.path === "env.agent",
    },
    {
      id: "walk",
      title: "Walk",
      prompt: "Starter walk includes env.agent.drv and env.agent.",
      hint: "Starter get",
      setup: () => loadStarter(),
      check: () => {
        const w = state.lastGet && state.lastGet.walk;
        return w && w.includes("env.agent.drv") && w.includes("env.agent");
      },
    },
    {
      id: "entries",
      title: "Entries",
      prompt: "Starter has exactly 1 DB entry.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.entries.length === 1,
    },
    {
      id: "field-vif",
      title: "Field vif",
      prompt: "Starter get field is vif.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => state.getField === "vif",
    },
    {
      id: "specific-path",
      title: "Specific entry",
      prompt: "On specific preset, matched path is env.agent not env.",
      hint: "Load specific → get",
      setup: () => {
        selPreset.value = "specific";
        loadPreset();
        doGet();
      },
      check: () =>
        state.lastGet &&
        state.lastGet.ok &&
        state.lastGet.entry.path === "env.agent",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to starter HIT uart_vif.",
      hint: "Reset",
      setup: () => {
        clearDb();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.lastGet && state.lastGet.value === "uart_vif";
      },
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ucfg-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ucfg-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-set").addEventListener("click", () => doSet());
  document.getElementById("btn-get").addEventListener("click", () => doGet());
  document.getElementById("btn-clear").addEventListener("click", () => clearDb());
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
      if (saved && saved.getPath) {
        state.getPath = saved.getPath;
        state.getField = saved.getField || state.getField;
        state.preset = saved.preset || "starter";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  doGet();
  state.lastAction = "starter";
  renderAll();
})();
