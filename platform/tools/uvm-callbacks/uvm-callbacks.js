(() => {
  /**
   * Callbacks sketch (concept)
   *   pre/post hooks without subclassing the host
   * Starter: err_inj on pre_drive registered + enabled
   */

  const CBS = {
    err_inj: {
      id: "err_inj",
      hook: "pre",
      title: "error inject",
      blurb: "Flips a bit on the item before drive (fault injection).",
      effect: "item.data ^= 0x01",
    },
    logger: {
      id: "logger",
      hook: "post",
      title: "post logger",
      blurb: "Logs after the host body runs (observe without fork).",
      effect: 'log("drove " + item.data)',
    },
    cover: {
      id: "cover",
      hook: "post",
      title: "coverage sample",
      blurb: "Samples a coverpoint after drive — still no subclass.",
      effect: "cg.sample(item)",
    },
  };

  const PRESETS = {
    starter: {
      label: "starter: err_inj armed",
      registered: ["err_inj"],
      enabled: { err_inj: true },
      selected: "err_inj",
      note: "err_inj registered on pre_drive — Drive will run pre → body → (no post).",
    },
    both: {
      label: "pre + post registered",
      registered: ["err_inj", "logger"],
      enabled: { err_inj: true, logger: true },
      selected: "err_inj",
      note: "Both pre and post callbacks enabled.",
    },
    disabled: {
      label: "registered but disabled",
      registered: ["err_inj"],
      enabled: { err_inj: false },
      selected: "err_inj",
      note: "Callback is registered but disabled — Drive skips it.",
    },
    empty: {
      label: "no callbacks",
      registered: [],
      enabled: {},
      selected: "err_inj",
      note: "Bare driver — Register a callback to extend it.",
    },
  };

  function sourceSketch() {
    return `// Callback literacy (not a full uvm_callback API)
// Host (e.g. driver) calls hook points:
//   pre_drive(item)  →  drive body  →  post_drive(item)
//
// Register a callback object on the host — no driver subclass needed
// Enable / disable individually; order is registration order
//
// Typical uses: error inject, logging, coverage, protocol quirks
//
// uvm_callbacks#(driver_t, cb_t)::add(drv, cb);
// \`uvm_do_callbacks(driver_t, cb_t, pre_drive(this, item))`;
  }

  function makeStarter() {
    const p = PRESETS.starter;
    return {
      preset: "starter",
      registered: [...p.registered],
      enabled: { ...p.enabled },
      selected: p.selected,
      note: p.note,
      itemData: "0xA5",
      lastPhase: null,
      lastFired: [],
      lastAction: "starter",
      explained: false,
      demoed: false,
      drives: 0,
      log: [],
      trace: ["registered err_inj @ pre (enabled)"],
    };
  }

  const CLEARED_KEY = "ddv-uvm-callbacks-cleared-v1";
  const STORE_KEY = "ddv-uvm-callbacks-session-v1";

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

  const root = document.getElementById("ucb-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> callback <code>err_inj</code> is registered
        on the driver’s <code>pre_drive</code> hook and enabled — no driver subclass.</p>
      <button type="button" class="btn btn-secondary" id="ucb-starter">Load starter example</button>
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
        <div class="idea-card"><h3>host hooks</h3><p>pre → body → post call sites in the component.</p></div>
        <div class="idea-card"><h3>register</h3><p>Attach a callback object — no subclass required.</p></div>
        <div class="idea-card"><h3>enable</h3><p>Turn a registered callback on or off.</p></div>
        <div class="idea-card"><h3>reuse</h3><p>Inject faults, log, or sample without forking the VIP.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ucb-controls">
        <div class="ucb-field">
          <label for="sel-preset">Scenario</label>
          <select id="sel-preset">
            <option value="starter" selected>err_inj armed</option>
            <option value="both">pre + post</option>
            <option value="disabled">registered disabled</option>
            <option value="empty">no callbacks</option>
          </select>
        </div>
        <div class="ucb-field">
          <label for="sel-cb">Callback</label>
          <select id="sel-cb">
            <option value="err_inj">err_inj (pre)</option>
            <option value="logger">logger (post)</option>
            <option value="cover">cover (post)</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load">Load preset</button>
        <button type="button" class="btn btn-secondary" id="btn-reg">Register</button>
        <button type="button" class="btn btn-ghost" id="btn-unreg">Unregister</button>
        <button type="button" class="btn btn-secondary" id="btn-enable">Enable</button>
        <button type="button" class="btn btn-ghost" id="btn-disable">Disable</button>
        <button type="button" class="btn btn-secondary" id="btn-drive">Drive</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo both</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="ucb-layout">
        <div class="panel-box">
          <h3>Drive flow</h3>
          <div class="flow-row" id="flow-row"></div>
          <h3>Registered callbacks</h3>
          <div class="cb-list" id="cb-list"></div>
          <p class="meta-note" id="meta-note"></p>
        </div>
        <div class="panel-box">
          <h3>Selected callback</h3>
          <p class="role-blurb" id="role-blurb"></p>
          <h3 style="margin-top:0.85rem">Hook sketch</h3>
          <pre class="code-box" id="prop-code" style="max-height:16rem"></pre>
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
  const selCb = /** @type {HTMLSelectElement} */ (document.getElementById("sel-cb"));

  function cb() {
    return CBS[state.selected] || CBS.err_inj;
  }

  function isReg(id) {
    return state.registered.includes(id);
  }

  function isEn(id) {
    return !!state.enabled[id];
  }

  function activeFor(hook) {
    return state.registered.filter((id) => CBS[id].hook === hook && isEn(id));
  }

  function codeSketch() {
    const c = cb();
    const regs = state.registered.length
      ? state.registered
          .map((id) => `${id}@${CBS[id].hook}${isEn(id) ? "" : " (off)"}`)
          .join(", ")
      : "(none)";
    return `// host: uart_driver
// hooks: pre_drive → drive_item → post_drive
// registered: ${regs}
//
// selected: ${c.id} (${c.hook}) ${isReg(c.id) ? "registered" : "not registered"}
//           ${isEn(c.id) ? "enabled" : "disabled"}
// effect: ${c.effect}
// last phase: ${state.lastPhase ?? "—"}
// last fired: [${state.lastFired.join(", ")}]`;
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
    selCb.value = state.selected;
  }

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter err_inj armed");
    renderAll();
  }

  function loadPreset() {
    const id = selPreset.value;
    const p = PRESETS[id];
    if (!p) return;
    state.preset = id;
    state.registered = [...p.registered];
    state.enabled = { ...p.enabled };
    state.selected = p.selected;
    state.note = p.note;
    state.lastPhase = null;
    state.lastFired = [];
    state.itemData = "0xA5";
    state.lastAction = "load";
    syncInputs();
    pushLog(`# load ${id}`);
    renderAll();
  }

  function selectCb(id) {
    state.selected = id;
    state.lastAction = "select";
    syncInputs();
    renderAll();
  }

  function registerCb() {
    const id = state.selected;
    if (!isReg(id)) state.registered = [...state.registered, id];
    if (!(id in state.enabled)) state.enabled = { ...state.enabled, [id]: true };
    state.lastAction = "reg";
    pushLog(`# register ${id}`);
    pushTrace(`register ${id} @ ${CBS[id].hook}`);
    renderAll();
  }

  function unregisterCb() {
    const id = state.selected;
    state.registered = state.registered.filter((x) => x !== id);
    const en = { ...state.enabled };
    delete en[id];
    state.enabled = en;
    state.lastAction = "unreg";
    pushLog(`# unregister ${id}`);
    renderAll();
  }

  function setEnabled(on) {
    const id = state.selected;
    if (!isReg(id)) {
      state.lastAction = on ? "enable-miss" : "disable-miss";
      pushLog(`# ${on ? "enable" : "disable"} failed — not registered`);
      renderAll();
      return;
    }
    state.enabled = { ...state.enabled, [id]: on };
    state.lastAction = on ? "enable" : "disable";
    pushLog(`# ${on ? "enable" : "disable"} ${id}`);
    renderAll();
  }

  function drive() {
    const fired = [];
    let data = 0xa5;
    state.lastPhase = "pre";
    activeFor("pre").forEach((id) => {
      fired.push(id);
      if (id === "err_inj") data ^= 0x01;
      pushTrace(`pre: ${id} → ${CBS[id].effect}`);
    });
    state.lastPhase = "body";
    pushTrace(`body: drive_item data=${"0x" + data.toString(16).toUpperCase()}`);
    state.lastPhase = "post";
    activeFor("post").forEach((id) => {
      fired.push(id);
      pushTrace(`post: ${id} → ${CBS[id].effect}`);
    });
    state.itemData = "0x" + data.toString(16).toUpperCase();
    state.lastFired = fired;
    state.drives += 1;
    state.lastAction = "drive";
    pushLog(`# drive fired=[${fired.join(",") || "—"}] data=${state.itemData}`);
    renderAll();
  }

  function demo() {
    state.preset = "both";
    state.registered = ["err_inj", "logger"];
    state.enabled = { err_inj: true, logger: true };
    state.selected = "err_inj";
    state.note = PRESETS.both.note;
    state.demoed = true;
    syncInputs();
    drive();
    state.lastAction = "demo";
    state.demoed = true;
    pushLog("# demo pre+post");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog(
      "# explain: register callbacks on host hooks; enable/disable; " +
        "pre → body → post — extend VIP behavior without subclassing."
    );
    renderAll();
  }

  function renderLab() {
    syncInputs();
    const preN = activeFor("pre").length;
    const postN = activeFor("post").length;
    const phase = state.lastPhase;
    document.getElementById("flow-row").innerHTML = `
      <div class="flow-box ${phase === "pre" ? "is-hot" : ""}">
        <div class="k">pre_drive</div>
        <div>${preN} cb active</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-box ${phase === "body" ? "is-hot" : ""}">
        <div class="k">drive body</div>
        <div>data=${state.itemData}</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-box ${phase === "post" ? "is-hot" : ""}">
        <div class="k">post_drive</div>
        <div>${postN} cb active</div>
      </div>
    `;

    const list = document.getElementById("cb-list");
    if (!state.registered.length) {
      list.innerHTML = `<div class="cb-card is-off"><div class="k">empty</div><div class="v">(no callbacks registered)</div></div>`;
    } else {
      list.innerHTML = "";
      state.registered.forEach((id) => {
        const c = CBS[id];
        const b = document.createElement("button");
        b.type = "button";
        b.className = `cb-card ${state.selected === id ? "is-sel" : ""} ${isEn(id) ? "is-on" : "is-off"}`;
        b.innerHTML = `<div class="k">${c.hook}_drive · ${isEn(id) ? "enabled" : "disabled"}</div>
          <div class="v">${c.id} — ${c.title}</div>`;
        b.addEventListener("click", () => selectCb(id));
        list.appendChild(b);
      });
    }

    const c = cb();
    document.getElementById("meta-note").textContent = state.note;
    document.getElementById("role-blurb").textContent =
      `${c.title} (${c.hook}): ${c.blurb} ` +
      (isReg(c.id)
        ? isEn(c.id)
          ? "Registered and enabled."
          : "Registered but disabled."
        : "Not registered on the host yet.");
    document.getElementById("prop-code").textContent = codeSketch();
    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    const v = document.getElementById("verdict");
    if (state.lastAction === "drive" || state.lastAction === "demo") {
      v.className = "verdict yes";
      v.textContent = `Drove — fired [${state.lastFired.join(", ") || "none"}] data=${state.itemData}`;
    } else if (!state.registered.length) {
      v.className = "verdict warn";
      v.textContent = "No callbacks — Register to extend the driver";
    } else {
      v.className = "verdict idle";
      v.textContent = `${state.registered.length} registered — Drive to fire hooks`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-on">sel=${state.selected}</span>
      <span class="flag ${isReg(state.selected) ? "is-ok" : ""}">reg=${isReg(state.selected) ? 1 : 0}</span>
      <span class="flag ${isEn(state.selected) ? "is-ok" : ""}">en=${isEn(state.selected) ? 1 : 0}</span>
      <span class="flag is-on">n=${state.registered.length}</span>
      <span class="flag ${state.lastFired.length ? "is-ok" : ""}">fired=${state.lastFired.length}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          preset: state.preset,
          registered: state.registered,
          enabled: state.enabled,
          selected: state.selected,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-why",
      title: "Quiz: why",
      type: "quiz",
      prompt: "UVM callbacks let you…",
      hint: "No subclass.",
      choices: [
        "hook pre/post behavior without subclassing the host component",
        "replace connect_phase entirely",
        "synthesize the DUT",
        "set the simulator timescale",
      ],
      answer: "hook pre/post behavior without subclassing the host component",
    },
    {
      id: "quiz-order",
      title: "Quiz: order",
      type: "quiz",
      prompt: "A typical drive hook order is…",
      hint: "Sandwich.",
      choices: [
        "pre → body → post",
        "post → body → pre only",
        "report_phase only",
        "build → $finish",
      ],
      answer: "pre → body → post",
    },
    {
      id: "quiz-enable",
      title: "Quiz: enable",
      type: "quiz",
      prompt: "A registered but disabled callback…",
      hint: "Skip.",
      choices: [
        "does not run when the host fires the hook",
        "always deletes the sequencer",
        "forces FATAL reports",
        "changes +UVM_TESTNAME",
      ],
      answer: "does not run when the host fires the hook",
    },
    {
      id: "quiz-use",
      title: "Quiz: use",
      type: "quiz",
      prompt: "A common callback use is…",
      hint: "Inject / observe.",
      choices: [
        "error injection, logging, or coverage without forking the VIP",
        "only writing Makefiles",
        "replacing ConfigDB keys exclusively",
        "compiling Verilator DPI only",
      ],
      answer: "error injection, logging, or coverage without forking the VIP",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — err_inj registered and enabled.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        isReg("err_inj") &&
        isEn("err_inj"),
    },
    {
      id: "drive-inj",
      title: "Drive inject",
      prompt: "On starter, Drive — err_inj fires, data becomes 0xA4.",
      hint: "Drive",
      setup: () => {
        loadStarter();
        drive();
      },
      check: () =>
        state.lastFired.includes("err_inj") &&
        state.itemData === "0xA4" &&
        state.lastAction === "drive",
    },
    {
      id: "load-empty",
      title: "Load empty",
      prompt: "Load no callbacks — n=0.",
      hint: "no callbacks → Load",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () => state.registered.length === 0 && state.lastAction === "load",
    },
    {
      id: "register",
      title: "Register",
      prompt: "From empty, Register err_inj.",
      hint: "empty → Load → Register",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.selected = "err_inj";
        syncInputs();
        registerCb();
      },
      check: () => isReg("err_inj") && state.lastAction === "reg",
    },
    {
      id: "unregister",
      title: "Unregister",
      prompt: "On starter, Unregister err_inj.",
      hint: "Unregister",
      setup: () => {
        loadStarter();
        unregisterCb();
      },
      check: () => !isReg("err_inj") && state.lastAction === "unreg",
    },
    {
      id: "disable",
      title: "Disable",
      prompt: "On starter, Disable err_inj.",
      hint: "Disable",
      setup: () => {
        loadStarter();
        setEnabled(false);
      },
      check: () => isReg("err_inj") && !isEn("err_inj") && state.lastAction === "disable",
    },
    {
      id: "drive-skip",
      title: "Drive skip",
      prompt: "Disabled err_inj, Drive — fired empty, data 0xA5.",
      hint: "Disable → Drive",
      setup: () => {
        loadStarter();
        setEnabled(false);
        drive();
      },
      check: () =>
        !state.lastFired.length &&
        state.itemData === "0xA5" &&
        state.lastAction === "drive",
    },
    {
      id: "enable",
      title: "Enable",
      prompt: "From disabled preset, Enable.",
      hint: "registered disabled → Load → Enable",
      setup: () => {
        selPreset.value = "disabled";
        loadPreset();
        setEnabled(true);
      },
      check: () => isEn("err_inj") && state.lastAction === "enable",
    },
    {
      id: "select-logger",
      title: "Select logger",
      prompt: "Select callback logger.",
      hint: "Callback → logger",
      setup: () => {
        loadStarter();
        selectCb("logger");
      },
      check: () => state.selected === "logger" && state.lastAction === "select",
    },
    {
      id: "reg-logger",
      title: "Register logger",
      prompt: "Register logger (post).",
      hint: "logger → Register",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.selected = "logger";
        syncInputs();
        registerCb();
      },
      check: () => isReg("logger") && CBS.logger.hook === "post",
    },
    {
      id: "load-both",
      title: "Load both",
      prompt: "Load pre + post — n=2.",
      hint: "pre + post → Load",
      setup: () => {
        selPreset.value = "both";
        loadPreset();
      },
      check: () =>
        state.registered.length === 2 &&
        isReg("err_inj") &&
        isReg("logger"),
    },
    {
      id: "demo",
      title: "Demo both",
      prompt: "Click Demo both — both fire.",
      hint: "Demo both",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.lastFired.includes("err_inj") &&
        state.lastFired.includes("logger") &&
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
      prompt: "Literacy sketch mentions uvm_callbacks.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /uvm_callbacks/i.test(sourceSketch()),
    },
    {
      id: "sketch-hooks",
      title: "Sketch hooks",
      prompt: "Hook sketch mentions pre_drive.",
      hint: "Starter",
      setup: () => loadStarter(),
      check: () => /pre_drive/.test(document.getElementById("prop-code").textContent),
    },
    {
      id: "phase-post",
      title: "Phase post",
      prompt: "After Drive on both, lastPhase is post.",
      hint: "both → Drive",
      setup: () => {
        selPreset.value = "both";
        loadPreset();
        drive();
      },
      check: () => state.lastPhase === "post",
    },
    {
      id: "cover-reg",
      title: "Register cover",
      prompt: "Register cover callback.",
      hint: "cover → Register",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
        state.selected = "cover";
        syncInputs();
        registerCb();
      },
      check: () => isReg("cover") && state.lastAction === "reg",
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "From empty, Reset — err_inj armed again.",
      hint: "Reset",
      setup: () => {
        selPreset.value = "empty";
        loadPreset();
      },
      check: () =>
        state.lastAction === "reset" &&
        isReg("err_inj") &&
        isEn("err_inj"),
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ucb-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("ucb-starter").addEventListener("click", () => {
    loadStarter();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-load").addEventListener("click", () => loadPreset());
  document.getElementById("btn-reg").addEventListener("click", () => registerCb());
  document.getElementById("btn-unreg").addEventListener("click", () => unregisterCb());
  document.getElementById("btn-enable").addEventListener("click", () => setEnabled(true));
  document.getElementById("btn-disable").addEventListener("click", () => setEnabled(false));
  document.getElementById("btn-drive").addEventListener("click", () => drive());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "reset";
    pushLog("# reset");
    renderAll();
  });
  selCb.addEventListener("change", () => selectCb(selCb.value));

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
      if (saved && Array.isArray(saved.registered)) {
        state.registered = saved.registered;
        state.enabled = saved.enabled || {};
        state.selected = saved.selected || "err_inj";
        state.preset = saved.preset || "starter";
        state.lastAction = "restore";
      }
    }
  } catch {
    /* ignore */
  }

  syncInputs();
  renderAll();
})();
