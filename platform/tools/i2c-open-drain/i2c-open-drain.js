(() => {
  /**
   * I²C open-drain model (concept)
   *   Open-drain: 0 = pull low, 1 = release (Hi-Z); pull-up → wire high
   *   Wired-AND: wire = 0 if ANY device pulls low
   *   Push-pull (contrast): drives 0/1; mismatch → bus fight
   * Starter: ACK scene — slave pulls SDA low while master releases
   */

  /** @typedef {"open_drain"|"push_pull"} WireModel */
  /** @typedef {"ack"|"start"|"idle"|"fight"|"scl"} SceneId */

  /**
   * @param {WireModel} model
   * @param {number} m 0|1 driver intent
   * @param {number} s 0|1 driver intent
   */
  function combineWire(model, m, s) {
    if (model === "open_drain") {
      const wire = m === 0 || s === 0 ? 0 : 1;
      return { wire, conflict: false };
    }
    if (m !== s) return { wire: 0, conflict: true };
    return { wire: m, conflict: false };
  }

  function drvLabel(model, val) {
    if (model === "open_drain") return val === 0 ? "pull↓" : "release";
    return val === 0 ? "drive0" : "drive1";
  }

  function sourceCode(model) {
    if (model === "open_drain") {
      return `// I²C open-drain + pull-ups (concept)
// out=0 → transistor ON → pull line LOW
// out=1 → release (Hi-Z) → pull-up wins → HIGH
assign sda = (master_pull_low | slave_pull_low) ? 1'b0 : 1'b1;
// same wired-AND idea on SCL`;
    }
    return `// Push-pull (NOT I²C-safe on a shared bus)
// each side actively drives 0 or 1
// if master==1 && slave==0 → bus fight / contention`;
  }

  /**
   * Build teaching timeline for a scene.
   * mSDA/sSDA: 0 pull/drive0, 1 release/drive1
   */
  function buildScene(scene, model) {
    /** @type {object[]} */
    const raw = [];

    if (scene === "idle") {
      raw.push(
        { label: "idle", mSDA: 1, sSDA: 1, mSCL: 1, sSCL: 1, note: "both release — pull-ups hold HIGH" },
        { label: "hold", mSDA: 1, sSDA: 1, mSCL: 1, sSCL: 1, note: "bus free" }
      );
    } else if (scene === "start") {
      raw.push(
        { label: "idle", mSDA: 1, sSDA: 1, mSCL: 1, sSCL: 1, note: "idle HIGH" },
        { label: "START", mSDA: 0, sSDA: 1, mSCL: 1, sSCL: 1, note: "master pulls SDA↓ while SCL=1" },
        { label: "hold", mSDA: 0, sSDA: 1, mSCL: 1, sSCL: 1, note: "START held" }
      );
    } else if (scene === "ack") {
      raw.push(
        { label: "idle", mSDA: 1, sSDA: 1, mSCL: 1, sSCL: 1, note: "idle" },
        { label: "addr0", mSDA: 0, sSDA: 1, mSCL: 0, sSCL: 1, note: "master sends bit (pull low)" },
        { label: "ACK↓", mSDA: 1, sSDA: 1, mSCL: 0, sSCL: 1, note: "SCL low — setup" },
        {
          label: "ACK",
          mSDA: 1,
          sSDA: 0,
          mSCL: 1,
          sSCL: 1,
          note: "master releases SDA; slave pulls ACK low",
        },
        { label: "release", mSDA: 1, sSDA: 1, mSCL: 1, sSCL: 1, note: "slave releases — pull-up HIGH" }
      );
    } else if (scene === "fight") {
      raw.push(
        { label: "setup", mSDA: 1, sSDA: 1, mSCL: 1, sSCL: 1, note: "push-pull contrast" },
        {
          label: "fight",
          mSDA: 1,
          sSDA: 0,
          mSCL: 1,
          sSCL: 1,
          note: "master drives 1 vs slave drives 0 — contention",
        },
        { label: "both0", mSDA: 0, sSDA: 0, mSCL: 1, sSCL: 1, note: "both drive low — OK" }
      );
    } else if (scene === "scl") {
      raw.push(
        { label: "idle", mSDA: 1, sSDA: 1, mSCL: 1, sSCL: 1, note: "idle" },
        { label: "bit↓", mSDA: 0, sSDA: 1, mSCL: 0, sSCL: 1, note: "master pulls SCL low" },
        {
          label: "stretch",
          mSDA: 0,
          sSDA: 1,
          mSCL: 1,
          sSCL: 0,
          note: "master released SCL; slave still pulls low",
        },
        { label: "rise", mSDA: 0, sSDA: 1, mSCL: 1, sSCL: 1, note: "slave releases — SCL rises" }
      );
    }

    return raw.map((r, idx) => {
      const sda = combineWire(model, r.mSDA, r.sSDA);
      const scl = combineWire(model, r.mSCL, r.sSCL);
      return {
        idx,
        ...r,
        SDA: sda.wire,
        SCL: scl.wire,
        sdaConflict: sda.conflict,
        sclConflict: scl.conflict,
        conflict: sda.conflict || scl.conflict,
        done: idx === raw.length - 1,
      };
    });
  }

  function makeStarter() {
    return {
      model: "open_drain",
      scene: "ack",
      cursor: 0,
      lastAction: "starter",
      stepped: false,
      explained: false,
      demoed: false,
      rebuilt: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-i2c-open-drain-cleared-v1";
  const STORE_KEY = "ddv-i2c-open-drain-session-v1";

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

  const root = document.getElementById("iod-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>ACK</strong> scene, open-drain model —
        master <em>releases</em> SDA while the slave <em>pulls low</em>.
        Wire stays <code>0</code> (wired-AND). Toggle push-pull on the fight scene to contrast.</p>
      <button type="button" class="btn btn-secondary" id="iod-starter">Load starter example</button>
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
        <div class="idea-card"><h3>Pull low</h3><p>Only action on the bus — never push high.</p></div>
        <div class="idea-card"><h3>Release</h3><p>Hi-Z; external pull-up creates logic 1.</p></div>
        <div class="idea-card"><h3>Wired-AND</h3><p>Line low if anyone pulls low.</p></div>
        <div class="idea-card"><h3>Not push-pull</h3><p>Shared bus needs open-drain + pull-ups.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="iod-controls">
        <div class="iod-field">
          <label for="sel-model">Wire model</label>
          <select id="sel-model">
            <option value="open_drain" selected>Open-drain + pull-up</option>
            <option value="push_pull">Push-pull (contrast)</option>
          </select>
        </div>
        <div class="iod-field">
          <label for="sel-scene">Scene</label>
          <select id="sel-scene">
            <option value="ack" selected>ACK (slave pulls SDA)</option>
            <option value="start">START (master pulls SDA)</option>
            <option value="idle">Idle (both release)</option>
            <option value="fight">Bus fight (PP contrast)</option>
            <option value="scl">SCL wired-AND / stretch</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-rebuild">Rebuild</button>
        <button type="button" class="btn btn-ghost" id="btn-step">Step</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Play to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo ACK OD</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <p class="legend">Driver cells: <code>0</code> = pull/drive low · <code>1</code> = release (OD) or drive high (PP)</p>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="note-box" id="note-box"></div>
      <div class="wave" id="wave"></div>
      <div class="panel" style="margin:0.75rem 0;padding:0.65rem;border:1px solid var(--line);border-radius:8px">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Sequence</h3>
        <ol class="bit-list" id="bit-list"></ol>
      </div>
      <div class="panel" style="margin:0.75rem 0">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Sketch</h3>
        <pre class="code-box" id="code-box"></pre>
      </div>
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

  const selModel = /** @type {HTMLSelectElement} */ (document.getElementById("sel-model"));
  const selScene = /** @type {HTMLSelectElement} */ (document.getElementById("sel-scene"));

  function frame() {
    return buildScene(state.scene, state.model);
  }

  function syncInputs() {
    selModel.value = state.model;
    selScene.value = state.scene;
  }

  function readInputs() {
    state.model = selModel.value === "push_pull" ? "push_pull" : "open_drain";
    state.scene = selScene.value;
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

  function loadStarter() {
    state = makeStarter();
    syncInputs();
    pushLog("# starter ACK open-drain");
    pushTrace("wired-AND: SDA=0 when slave pulls low");
    renderAll();
  }

  function rebuild() {
    readInputs();
    state.cursor = 0;
    state.rebuilt = true;
    state.lastAction = "rebuild";
    pushLog(`# rebuild model=${state.model} scene=${state.scene}`);
    renderAll();
  }

  function stepOnce() {
    const f = frame();
    if (state.cursor < f.length - 1) state.cursor += 1;
    state.stepped = true;
    state.lastAction = "step";
    const s = f[state.cursor];
    pushTrace(`[${state.cursor}] ${s.label} SDA=${s.SDA} ${s.note}`);
    pushLog(`# step → ${s.label}`);
    renderAll();
  }

  function playToEnd() {
    const f = frame();
    state.cursor = f.length - 1;
    state.stepped = true;
    state.lastAction = "run";
    pushLog("# play to end");
    renderAll();
  }

  function demo() {
    state = makeStarter();
    syncInputs();
    playToEnd();
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo ACK open-drain");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Open-drain: drive low or release. Pull-ups make idle/release read as 1. " +
        "Wired-AND means any pull-low wins. I²C ACK: master releases SDA, slave pulls low. " +
        "Push-pull on a shared bus can fight when drivers disagree."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderWaveSvg(steps, cursor) {
    const n = steps.length;
    const w = Math.max(400, n * 24);
    const h = 108;
    const rows = [
      { key: "SDA", y: 22 },
      { key: "SCL", y: 54 },
      { key: "mSDA", y: 86 },
    ];
    const paths = rows
      .map(({ key, y }) => {
        const y1 = y - 8;
        const y0 = y + 8;
        let d = "";
        for (let i = 0; i < n; i++) {
          const x0 = (i / n) * w;
          const x1 = ((i + 1) / n) * w;
          const val = steps[i][key];
          const yy = val ? y1 : y0;
          if (i === 0) d += `M ${x0} ${yy}`;
          else {
            const prev = steps[i - 1][key] ? y1 : y0;
            if (prev !== yy) d += ` L ${x0} ${prev} L ${x0} ${yy}`;
          }
          d += ` L ${x1} ${yy}`;
        }
        return `<text x="2" y="${y + 4}" font-size="10" fill="currentColor">${key}</text>
          <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" transform="translate(44,0)"/>`;
      })
      .join("");
    const cx = 44 + ((cursor + 0.5) / n) * w;
    return `<svg class="wave-svg" viewBox="0 0 ${w + 48} ${h}" preserveAspectRatio="none" aria-hidden="true">
      ${paths}
      <line x1="${cx}" y1="4" x2="${cx}" y2="${h - 4}" stroke="#b45309" stroke-width="1.5" stroke-dasharray="3 2"/>
    </svg>`;
  }

  function cellClass(val, conflict, isWire) {
    let c = val ? " hi" : "";
    if (conflict && isWire) c += " conflict";
    else if (!isWire && val === 0) c += " pull";
    else if (!isWire && val === 1 && state.model === "open_drain") c += " release";
    return c;
  }

  function renderLab() {
    syncInputs();
    const steps = frame();
    const cur = steps[Math.min(state.cursor, steps.length - 1)];
    const done = !!cur.done;

    const v = document.getElementById("verdict");
    if (cur.conflict) {
      v.className = "verdict no";
      v.textContent = `Contention · ${cur.label} · ${cur.note}`;
    } else if (!done) {
      v.className = "verdict idle";
      v.textContent = `step ${state.cursor}/${steps.length - 1} · ${cur.label} · SDA=${cur.SDA} SCL=${cur.SCL}`;
    } else {
      v.className = "verdict yes";
      v.textContent = `Done · ${state.model} · ${state.scene} · SDA=${cur.SDA} (wired-AND OK)`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.model}</span>
      <span class="flag">${state.scene}</span>
      <span class="flag">m=${drvLabel(state.model, cur.mSDA)}</span>
      <span class="flag">s=${drvLabel(state.model, cur.sSDA)}</span>
      <span class="flag ${cur.SDA ? "is-ok" : "is-on"}">SDA=${cur.SDA}</span>
      <span class="flag ${cur.SCL ? "is-ok" : "is-on"}">SCL=${cur.SCL}</span>
      <span class="flag ${cur.conflict ? "is-bad" : "is-ok"}">conflict=${cur.conflict ? 1 : 0}</span>
    `;

    document.getElementById("note-box").textContent = cur.note;

    let head = "<tr><th></th>";
    steps.forEach((_, i) => {
      head += `<th>${i}</th>`;
    });
    head += "</tr>";

    const row = (lab, key, isWire) => {
      let cells = `<td class="lab">${lab}</td>`;
      steps.forEach((s, i) => {
        const curCls = i === state.cursor ? " cur" : "";
        const val = s[key];
        const conf = isWire && (key === "SDA" ? s.sdaConflict : s.sclConflict);
        cells += `<td class="${curCls}${cellClass(val, conf, isWire)}">${val}</td>`;
      });
      return `<tr>${cells}</tr>`;
    };

    let rowLab = `<tr><td class="lab">phase</td>`;
    steps.forEach((s, i) => {
      const curCls = i === state.cursor ? " cur" : "";
      rowLab += `<td class="${curCls}${s.conflict ? " conflict" : ""}">${s.label}</td>`;
    });
    rowLab += "</tr>";

    document.getElementById("wave").innerHTML = `
      <table class="wave-table"><thead>${head}</thead><tbody>
        ${row("mSDA", "mSDA", false)}
        ${row("sSDA", "sSDA", false)}
        ${row("SDA", "SDA", true)}
        ${row("mSCL", "mSCL", false)}
        ${row("sSCL", "sSCL", false)}
        ${row("SCL", "SCL", true)}
        ${rowLab}
      </tbody></table>
      ${renderWaveSvg(steps, state.cursor)}
    `;

    document.getElementById("bit-list").innerHTML = steps
      .map(
        (s, i) =>
          `<li class="${i === state.cursor ? "is-cur" : ""}">[${i}] ${s.label} SDA=${s.SDA} SCL=${s.SCL} <span style="color:var(--muted)">${s.note}</span></li>`
      )
      .join("");

    document.getElementById("code-box").textContent = sourceCode(state.model);
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ model: state.model, scene: state.scene, cursor: state.cursor })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-od",
      title: "Quiz: open-drain",
      type: "quiz",
      prompt: "On an open-drain line, a device can…",
      hint: "Pull vs push.",
      choices: [
        "pull low or release (Hi-Z) — not actively drive high",
        "only push high",
        "never pull low",
        "ignore pull-ups",
      ],
      answer: "pull low or release (Hi-Z) — not actively drive high",
    },
    {
      id: "quiz-idle",
      title: "Quiz: idle",
      type: "quiz",
      prompt: "I²C idle (both release) reads HIGH because…",
      hint: "External resistors.",
      choices: [
        "pull-up resistors on SDA/SCL",
        "master pushes both lines high",
        "slave always drives 1",
        "no voltage on the bus",
      ],
      answer: "pull-up resistors on SDA/SCL",
    },
    {
      id: "quiz-wired",
      title: "Quiz: wired-AND",
      type: "quiz",
      prompt: "Open-drain wired-AND means the wire is LOW when…",
      hint: "Anyone pulls.",
      choices: [
        "any device pulls low",
        "all devices release",
        "only the master drives",
        "CPHA=1",
      ],
      answer: "any device pulls low",
    },
    {
      id: "quiz-pp",
      title: "Quiz: push-pull",
      type: "quiz",
      prompt: "Push-pull on a shared I²C bus is problematic because…",
      hint: "Contention.",
      choices: [
        "two drivers can fight if they disagree",
        "it cannot drive low",
        "pull-ups are illegal",
        "ACK is impossible",
      ],
      answer: "two drivers can fight if they disagree",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — ACK scene, open-drain.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.model === "open_drain" &&
        state.scene === "ack",
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step once.",
      hint: "Step",
      setup: () => loadStarter(),
      check: () => state.stepped && state.cursor >= 1,
    },
    {
      id: "see-ack",
      title: "Land on ACK",
      prompt: "Land on ACK — slave pulls SDA low, master releases.",
      hint: "Step to ACK",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.label === "ACK" && s.sSDA === 0 && s.mSDA === 1 && s.SDA === 0;
      },
    },
    {
      id: "wired-and",
      title: "Wired-AND",
      prompt: "On ACK step, SDA wire must be 0.",
      hint: "Check SDA column",
      setup: () => loadStarter(),
      check: () => {
        const s = frame().find((x) => x.label === "ACK");
        return s && s.SDA === 0 && !s.conflict;
      },
    },
    {
      id: "see-release",
      title: "After ACK",
      prompt: "Step to release — both release, SDA=1.",
      hint: "Last step of ACK scene",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.label === "release" && s.mSDA === 1 && s.sSDA === 1 && s.SDA === 1;
      },
    },
    {
      id: "scene-start",
      title: "START scene",
      prompt: "Scene START, Rebuild — master pulls SDA low at START.",
      hint: "Scene → START",
      setup: () => loadStarter(),
      check: () => {
        const s = frame().find((x) => x.label === "START");
        return state.scene === "start" && state.rebuilt && s && s.mSDA === 0 && s.SDA === 0;
      },
    },
    {
      id: "scene-idle",
      title: "Idle scene",
      prompt: "Scene Idle, Rebuild — SDA=SCL=1, no conflict.",
      hint: "Scene → Idle",
      setup: () => loadStarter(),
      check: () =>
        state.scene === "idle" &&
        state.rebuilt &&
        frame()[0].SDA === 1 &&
        frame()[0].SCL === 1 &&
        !frame()[0].conflict,
    },
    {
      id: "pp-fight",
      title: "PP fight",
      prompt: "Push-pull + fight scene, Rebuild — conflict=1 on fight step.",
      hint: "Model PP, Scene fight",
      setup: () => {
        loadStarter();
        state.model = "push_pull";
        state.scene = "fight";
        syncInputs();
        rebuild();
      },
      check: () => {
        const s = frame().find((x) => x.label === "fight");
        return s && s.conflict && state.model === "push_pull";
      },
    },
    {
      id: "pp-both0",
      title: "PP both low",
      prompt: "Push-pull fight scene: both0 step has no conflict.",
      hint: "Step to both0 in fight",
      setup: () => {
        loadStarter();
        state.model = "push_pull";
        state.scene = "fight";
        syncInputs();
        rebuild();
      },
      check: () => {
        const s = frame().find((x) => x.label === "both0");
        return s && !s.conflict && s.SDA === 0;
      },
    },
    {
      id: "scl-scene",
      title: "SCL wired",
      prompt: "Scene SCL stretch — stretch step: m releases, s pulls, SCL=0.",
      hint: "Scene → SCL wired-AND",
      setup: () => {
        loadStarter();
        state.scene = "scl";
        syncInputs();
        rebuild();
      },
      check: () => {
        const s = frame().find((x) => x.label === "stretch");
        return s && s.mSCL === 1 && s.sSCL === 0 && s.SCL === 0;
      },
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo ACK OD.",
      hint: "Demo button",
      setup: () => loadStarter(),
      check: () => state.demoed && state.model === "open_drain",
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
      id: "play-ack",
      title: "Play ACK",
      prompt: "Play to end on starter — no conflict.",
      hint: "Play to end",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "run" &&
        frame()[state.cursor].done &&
        !frame().some((s) => s.conflict),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "After stepping, Reset to cursor 0.",
      hint: "Reset",
      setup: () => {
        loadStarter();
        stepOnce();
      },
      check: () => state.cursor === 0 && state.lastAction === "reset",
    },
    {
      id: "sketch",
      title: "Sketch OD",
      prompt: "Open-drain sketch mentions pull-up / wired-AND.",
      hint: "Read Sketch",
      setup: () => loadStarter(),
      check: () => /pull-up|wired-AND/i.test(sourceCode("open_drain")),
    },
    {
      id: "od-no-fight",
      title: "OD no fight",
      prompt: "Open-drain fight scene (master release, slave pull) — no conflict.",
      hint: "OD model on fight scene",
      setup: () => {
        loadStarter();
        state.model = "open_drain";
        state.scene = "fight";
        syncInputs();
        rebuild();
      },
      check: () => {
        const s = frame().find((x) => x.label === "fight");
        return state.model === "open_drain" && s && !s.conflict && s.SDA === 0;
      },
    },
    {
      id: "back-od",
      title: "Back to OD",
      prompt: "From push-pull, switch to open-drain ACK and Rebuild.",
      hint: "Model → open-drain",
      setup: () => {
        loadStarter();
        state.model = "push_pull";
        state.scene = "fight";
        syncInputs();
        rebuild();
      },
      check: () =>
        state.model === "open_drain" &&
        state.scene === "ack" &&
        state.rebuilt &&
        !frame().some((s) => s.conflict),
    },
    {
      id: "master-pull",
      title: "Master pull",
      prompt: "ACK scene addr0: master pulls SDA low (mSDA=0).",
      hint: "Step to addr0",
      setup: () => loadStarter(),
      check: () => {
        const s = frame()[state.cursor];
        return s.label === "addr0" && s.mSDA === 0 && s.SDA === 0;
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="iod-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("iod-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-rebuild").addEventListener("click", () => rebuild());
  document.getElementById("btn-step").addEventListener("click", () => stepOnce());
  document.getElementById("btn-run").addEventListener("click", () => playToEnd());
  document.getElementById("btn-demo").addEventListener("click", () => demo());
  document.getElementById("btn-explain").addEventListener("click", () => explain());
  document.getElementById("btn-reset").addEventListener("click", () => {
    state.cursor = 0;
    state.lastAction = "reset";
    pushLog("# reset cursor");
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

  loadStarter();
})();
