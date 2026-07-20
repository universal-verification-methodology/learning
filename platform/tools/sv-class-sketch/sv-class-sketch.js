(() => {
  /**
   * Class / inheritance sketch (concept)
   *   Object tree (transactions) vs component tree (TB hierarchy)
   *   Click a class → fields/methods + extends chain + sketch code
   * Starter: Object tree — UartPacket extends Packet selected
   */

  /** @typedef {"object"|"component"} TreeId */

  const TREES = {
    object: {
      title: "Object / transaction tree",
      role:
        "Objects hold data. Construct with new(); pass by handle. No UVM phases.",
      root: "txn_base",
      classes: {
        txn_base: {
          name: "TxnBase",
          parent: null,
          kind: "object",
          fields: ["string name"],
          methods: ["function new(string n)", "function string get_name()"],
          note: "Lightweight base — like a tiny uvm_object stand-in (diagram only).",
        },
        packet: {
          name: "Packet",
          parent: "txn_base",
          kind: "object",
          fields: ["bit [7:0] data", "bit [1:0] kind"],
          methods: ["function void set_data(bit [7:0] d)"],
          note: "Shared transaction fields for any protocol packet.",
        },
        uart_packet: {
          name: "UartPacket",
          parent: "packet",
          kind: "object",
          fields: ["bit parity"],
          methods: ["function bit calc_parity()"],
          note: "Protocol specialization via extends — adds UART-only members.",
        },
        spi_packet: {
          name: "SpiPacket",
          parent: "packet",
          kind: "object",
          fields: ["bit [1:0] mode", "int cs_id"],
          methods: ["function void set_mode(bit [1:0] m)"],
          note: "Sibling of UartPacket — same Packet parent, different extras.",
        },
      },
      children: {
        txn_base: ["packet"],
        packet: ["uart_packet", "spi_packet"],
        uart_packet: [],
        spi_packet: [],
      },
    },
    component: {
      title: "Component / hierarchy tree",
      role:
        "Components live in a hierarchy, built in build_phase-style construction (sketch).",
      root: "comp_base",
      classes: {
        comp_base: {
          name: "CompBase",
          parent: null,
          kind: "component",
          fields: ["string name", "CompBase parent"],
          methods: ["function new(string n, CompBase p)", "virtual task run()"],
          note: "Hierarchy-aware base — like a tiny uvm_component stand-in.",
        },
        agent: {
          name: "Agent",
          parent: "comp_base",
          kind: "component",
          fields: ["bit is_active"],
          methods: ["virtual function void build()"],
          note: "Owns driver/monitor (children created in build).",
        },
        driver: {
          name: "Driver",
          parent: "comp_base",
          kind: "component",
          fields: ["/* vif handle */"],
          methods: ["virtual task run()", "task drive_item()"],
          note: "Sibling under CompBase — drives pins from sequence items.",
        },
        monitor: {
          name: "Monitor",
          parent: "comp_base",
          kind: "component",
          fields: ["/* analysis port */"],
          methods: ["virtual task run()", "task sample_bus()"],
          note: "Passive peer of Driver — observes, does not drive.",
        },
        uart_driver: {
          name: "UartDriver",
          parent: "driver",
          kind: "component",
          fields: ["int baud_div"],
          methods: ["virtual task run()  // override"],
          note: "extends Driver — override run() for UART baud timing.",
        },
      },
      children: {
        comp_base: ["agent", "driver", "monitor"],
        agent: [],
        driver: ["uart_driver"],
        monitor: [],
        uart_driver: [],
      },
    },
  };

  function sourceSketch() {
    return `// SV class literacy (diagram only — not a class runtime)
// object:     TxnBase → Packet → UartPacket / SpiPacket
// component:  CompBase → Agent | Driver → UartDriver | Monitor
// extends shares members; override virtual methods in children
// objects = data/handles; components = hierarchy + phases (concept)`;
  }

  function makeStarter() {
    return {
      tree: "object",
      selected: "uart_packet",
      showInherited: true,
      lastAction: "starter",
      explained: false,
      demoed: false,
      sketched: false,
      log: [],
      trace: [],
    };
  }

  const CLEARED_KEY = "ddv-sv-class-sketch-cleared-v1";
  const STORE_KEY = "ddv-sv-class-sketch-session-v1";

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

  const root = document.getElementById("cls-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> <strong>object</strong> tree with
        <code>UartPacket</code> selected (extends <code>Packet</code>).
        Toggle inherited members, or switch to the component tree.</p>
      <button type="button" class="btn btn-secondary" id="cls-starter">Load starter example</button>
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
        <div class="idea-card"><h3>extends</h3><p>Child gets parent fields/methods.</p></div>
        <div class="idea-card"><h3>Object</h3><p>Transaction / data — new() handle.</p></div>
        <div class="idea-card"><h3>Component</h3><p>Hierarchy member — build/run roles.</p></div>
        <div class="idea-card"><h3>Override</h3><p>Child virtual method replaces parent.</p></div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="cls-controls">
        <div class="cls-field">
          <label for="sel-tree">Tree</label>
          <select id="sel-tree">
            <option value="object" selected>Object / transaction</option>
            <option value="component">Component / hierarchy</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-load-tree">Load tree</button>
        <button type="button" class="btn btn-ghost" id="btn-toggle-inh">Toggle inherited</button>
        <button type="button" class="btn btn-ghost" id="btn-select-parent">Select parent</button>
        <button type="button" class="btn btn-secondary" id="btn-sketch">Show class sketch</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo override</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="cls-layout">
        <div class="tree-panel">
          <h3 id="tree-title">Tree</h3>
          <div id="tree-box"></div>
          <p class="role-note" id="role-note"></p>
        </div>
        <div class="detail-panel">
          <h3>Selected class</h3>
          <p class="extends-line" id="extends-line"></p>
          <h3 style="margin:0.5rem 0 0.35rem;font-size:0.9rem">Members</h3>
          <ul class="member-list" id="member-list"></ul>
          <p class="role-note" id="class-note"></p>
          <h3 style="margin:0.75rem 0 0.35rem;font-size:0.9rem">Class sketch</h3>
          <pre class="code-box" id="sketch-box">// click Show class sketch</pre>
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

  const selTree = /** @type {HTMLSelectElement} */ (document.getElementById("sel-tree"));

  function tree() {
    return TREES[state.tree] || TREES.object;
  }

  function cls(id) {
    return tree().classes[id];
  }

  function chainIds(id) {
    const out = [];
    let cur = id;
    while (cur) {
      out.push(cur);
      const c = cls(cur);
      cur = c && c.parent ? c.parent : null;
    }
    return out;
  }

  function collectedMembers(id) {
    const chain = chainIds(id).reverse();
    /** @type {{text:string, own:boolean, src:string}[]} */
    const members = [];
    chain.forEach((cid) => {
      const c = cls(cid);
      const own = cid === id;
      (c.fields || []).forEach((f) =>
        members.push({ text: f, own, src: c.name, kind: "field" })
      );
      (c.methods || []).forEach((m) =>
        members.push({ text: m, own, src: c.name, kind: "method" })
      );
    });
    return members;
  }

  function buildClassCode(id) {
    const c = cls(id);
    if (!c) return "// select a class";
    const ext = c.parent ? ` extends ${cls(c.parent).name}` : "";
    const lines = [`class ${c.name}${ext};`];
    (c.fields || []).forEach((f) => lines.push(`  ${f};`));
    (c.methods || []).forEach((m) => {
      if (m.includes("new(")) lines.push(`  ${m};`);
      else if (m.startsWith("virtual")) lines.push(`  ${m};`);
      else if (m.startsWith("function") || m.startsWith("task")) lines.push(`  ${m};`);
      else lines.push(`  ${m};`);
    });
    lines.push("endclass");
    return lines.join("\n");
  }

  function syncInputs() {
    selTree.value = state.tree;
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
    pushLog("# starter object / UartPacket");
    pushTrace("tree=object sel=uart_packet");
    renderAll();
  }

  function loadTree() {
    state.tree = selTree.value in TREES ? selTree.value : "object";
    const t = tree();
    state.selected = state.tree === "object" ? "uart_packet" : "uart_driver";
    if (!t.classes[state.selected]) state.selected = t.root;
    state.lastAction = "load-tree";
    state.sketched = false;
    pushLog(`# load tree ${state.tree}`);
    renderAll();
  }

  function selectClass(id) {
    if (!cls(id)) return;
    state.selected = id;
    state.lastAction = "select";
    pushTrace(`select ${id}`);
    renderAll();
  }

  function toggleInherited() {
    state.showInherited = !state.showInherited;
    state.lastAction = "toggle-inh";
    pushTrace(`showInherited=${state.showInherited ? 1 : 0}`);
    renderAll();
  }

  function selectParent() {
    const c = cls(state.selected);
    if (c && c.parent) {
      state.selected = c.parent;
      state.lastAction = "parent";
      pushTrace(`parent → ${state.selected}`);
    } else {
      state.lastAction = "parent-none";
      pushTrace("no parent");
    }
    renderAll();
  }

  function showSketch() {
    state.sketched = true;
    state.lastAction = "sketch";
    pushLog(`# sketch ${cls(state.selected).name}`);
    renderAll();
  }

  function demo() {
    state.tree = "component";
    syncInputs();
    state.selected = "uart_driver";
    state.showInherited = true;
    state.sketched = true;
    state.demoed = true;
    state.lastAction = "demo";
    pushLog("# demo UartDriver override run()");
    pushTrace("tree=component sel=uart_driver override");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(
      "Objects carry transaction data (new/handles). Components form a hierarchy " +
        "(build/run). extends reuses members; children can override virtual methods."
    );
    pushLog("# explain");
    renderAll();
  }

  function renderTreeNodes(id, chainSet) {
    const c = cls(id);
    const kids = tree().children[id] || [];
    const sel = id === state.selected;
    const inChain = chainSet.has(id);
    let html = `<button type="button" class="tree-node${sel ? " is-sel" : ""}${
      inChain && !sel ? " is-chain" : ""
    }" data-id="${id}"><strong>${c.name}</strong><span class="kind">${c.kind}</span></button>`;
    if (kids.length) {
      html += `<ul>${kids.map((k) => `<li>${renderTreeNodes(k, chainSet)}</li>`).join("")}</ul>`;
    }
    return html;
  }

  function renderLab() {
    syncInputs();
    const t = tree();
    const c = cls(state.selected);
    const chain = chainIds(state.selected);
    const chainSet = new Set(chain);

    document.getElementById("tree-title").textContent = t.title;
    document.getElementById("role-note").textContent = t.role;

    const box = document.getElementById("tree-box");
    box.innerHTML = `<ul class="tree"><li>${renderTreeNodes(t.root, chainSet)}</li></ul>`;
    box.querySelectorAll("button.tree-node").forEach((btn) => {
      btn.addEventListener("click", () => selectClass(btn.getAttribute("data-id")));
    });

    const parentName = c.parent ? cls(c.parent).name : "(none)";
    document.getElementById("extends-line").textContent = c.parent
      ? `${c.name} extends ${parentName}`
      : `${c.name}  // root`;

    const members = collectedMembers(state.selected);
    const list = document.getElementById("member-list");
    list.innerHTML = "";
    members.forEach((m) => {
      if (!state.showInherited && !m.own) return;
      const li = document.createElement("li");
      li.className = m.own ? "is-own" : "is-inherited";
      li.innerHTML = `${m.text}<span class="src">← ${m.src}</span>`;
      list.appendChild(li);
    });
    if (!list.children.length) {
      const li = document.createElement("li");
      li.textContent = "// no members visible";
      list.appendChild(li);
    }

    document.getElementById("class-note").textContent = c.note;
    document.getElementById("sketch-box").textContent = state.sketched
      ? buildClassCode(state.selected)
      : "// click Show class sketch";

    const depth = chain.length;
    const v = document.getElementById("verdict");
    if (state.sketched && c.parent) {
      v.className = "verdict yes";
      v.textContent = `${c.name} · depth ${depth} · extends ${parentName} · sketch on`;
    } else {
      v.className = "verdict idle";
      v.textContent = `${t.title.split(" ")[0]} · ${c.name} · depth ${depth} · inherited=${
        state.showInherited ? 1 : 0
      }`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag is-ok">${state.tree}</span>
      <span class="flag is-on">sel=${state.selected}</span>
      <span class="flag">${c.kind}</span>
      <span class="flag ${c.parent ? "is-ok" : ""}">extends=${c.parent ? 1 : 0}</span>
      <span class="flag ${state.showInherited ? "is-ok" : ""}">inh=${state.showInherited ? 1 : 0}</span>
      <span class="flag ${state.sketched ? "is-ok" : ""}">sketch=${state.sketched ? 1 : 0}</span>
      <span class="flag ${state.demoed ? "is-ok" : ""}">demo=${state.demoed ? 1 : 0}</span>
    `;

    document.getElementById("code-box").textContent = sourceSketch();
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no steps";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          tree: state.tree,
          selected: state.selected,
          showInherited: state.showInherited,
          sketched: state.sketched,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-extends",
      title: "Quiz: extends",
      type: "quiz",
      prompt: "In SV, class Child extends Parent means…",
      hint: "Reuse.",
      choices: [
        "Child inherits Parent members and can add more",
        "Child replaces the Parent module in synthesis",
        "Child is always a wire",
        "extends only works inside always_ff",
      ],
      answer: "Child inherits Parent members and can add more",
    },
    {
      id: "quiz-object",
      title: "Quiz: object",
      type: "quiz",
      prompt: "A transaction / packet class is typically an…",
      hint: "Data.",
      choices: [
        "object (data + methods, constructed with new)",
        "synthesizable gate netlist",
        "SDF timing file",
        "place-and-route cell",
      ],
      answer: "object (data + methods, constructed with new)",
    },
    {
      id: "quiz-comp",
      title: "Quiz: component",
      type: "quiz",
      prompt: "Drivers and monitors in a UVM-style TB are…",
      hint: "Hierarchy.",
      choices: [
        "components in a hierarchy (build/run roles)",
        "only packed structs",
        "only continuous assigns",
        "FPGA bitstream sections",
      ],
      answer: "components in a hierarchy (build/run roles)",
    },
    {
      id: "quiz-override",
      title: "Quiz: override",
      type: "quiz",
      prompt: "A child virtual task run() that replaces the parent’s is an…",
      hint: "Polymorphism sketch.",
      choices: [
        "override of a virtual method",
        "always_comb sensitivity bug",
        "SDF annotation",
        "clock-domain crossing sync",
      ],
      answer: "override of a virtual method",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — object tree, uart_packet selected.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.tree === "object" &&
        state.selected === "uart_packet",
    },
    {
      id: "select-packet",
      title: "Select Packet",
      prompt: "Select Packet in the object tree.",
      hint: "Click Packet",
      setup: () => loadStarter(),
      check: () => state.selected === "packet",
    },
    {
      id: "select-spi",
      title: "Select SpiPacket",
      prompt: "Select SpiPacket (sibling of UartPacket).",
      hint: "Click SpiPacket",
      setup: () => loadStarter(),
      check: () => state.selected === "spi_packet",
    },
    {
      id: "parent-up",
      title: "Select parent",
      prompt: "From starter, click Select parent → Packet.",
      hint: "Select parent",
      setup: () => {
        loadStarter();
        selectParent();
      },
      check: () => state.selected === "packet" && state.lastAction === "parent",
    },
    {
      id: "load-comp",
      title: "Component tree",
      prompt: "Switch to Component tree and Load tree.",
      hint: "Tree → Component → Load tree",
      setup: () => {
        loadStarter();
        selTree.value = "component";
        loadTree();
      },
      check: () => state.tree === "component" && state.lastAction === "load-tree",
    },
    {
      id: "select-driver",
      title: "Select Driver",
      prompt: "On component tree, select Driver.",
      hint: "Load component, click Driver",
      setup: () => {
        selTree.value = "component";
        loadTree();
      },
      check: () => state.tree === "component" && state.selected === "driver",
    },
    {
      id: "select-uart-drv",
      title: "Select UartDriver",
      prompt: "Select UartDriver under Driver.",
      hint: "Click UartDriver",
      setup: () => {
        selTree.value = "component";
        loadTree();
      },
      check: () => state.selected === "uart_driver",
    },
    {
      id: "sketch",
      title: "Show sketch",
      prompt: "Show class sketch — sketch=1 and code has class.",
      hint: "Show class sketch",
      setup: () => {
        loadStarter();
        showSketch();
      },
      check: () =>
        state.sketched &&
        state.lastAction === "sketch" &&
        /class UartPacket/.test(document.getElementById("sketch-box").textContent),
    },
    {
      id: "extends-line",
      title: "Extends line",
      prompt: "Starter shows UartPacket extends Packet.",
      hint: "Load starter",
      setup: () => loadStarter(),
      check: () =>
        /UartPacket extends Packet/.test(
          document.getElementById("extends-line").textContent
        ),
    },
    {
      id: "toggle-inh",
      title: "Toggle inherited",
      prompt: "Toggle inherited off — inh=0.",
      hint: "Toggle inherited",
      setup: () => {
        loadStarter();
        if (state.showInherited) toggleInherited();
      },
      check: () => state.showInherited === false && state.lastAction === "toggle-inh",
    },
    {
      id: "inh-on",
      title: "Inherited on",
      prompt: "With inherited on, UartPacket members list includes data (from Packet).",
      hint: "Starter has inh on",
      setup: () => loadStarter(),
      check: () => {
        const text = document.getElementById("member-list").textContent;
        return state.showInherited && /data/.test(text) && /Packet/.test(text);
      },
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo override — component + uart_driver + sketch.",
      hint: "Demo override",
      setup: () => loadStarter(),
      check: () =>
        state.demoed &&
        state.tree === "component" &&
        state.selected === "uart_driver" &&
        state.sketched,
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
      id: "kind-object",
      title: "Kind object",
      prompt: "On starter, flag kind shows object.",
      hint: "Starter UartPacket",
      setup: () => loadStarter(),
      check: () => cls(state.selected).kind === "object",
    },
    {
      id: "kind-comp",
      title: "Kind component",
      prompt: "Select Monitor — kind is component.",
      hint: "Component tree → Monitor",
      setup: () => {
        selTree.value = "component";
        loadTree();
        selectClass("monitor");
      },
      check: () => state.selected === "monitor" && cls("monitor").kind === "component",
    },
    {
      id: "literacy",
      title: "Literacy sketch",
      prompt: "Literacy sketch mentions extends.",
      hint: "Read Literacy sketch",
      setup: () => loadStarter(),
      check: () => /extends/i.test(sourceSketch()),
    },
    {
      id: "root-txn",
      title: "Root TxnBase",
      prompt: "Select TxnBase — extends=0 (root).",
      hint: "Click TxnBase",
      setup: () => loadStarter(),
      check: () => state.selected === "txn_base" && !cls("txn_base").parent,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset — back to object / uart_packet.",
      hint: "Reset",
      setup: () => {
        demo();
        loadStarter();
        state.lastAction = "reset";
      },
      check: () => {
        loadStarter();
        state.lastAction = "reset";
        return state.tree === "object" && state.selected === "uart_packet";
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
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="cls-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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

  document.getElementById("cls-starter").addEventListener("click", () => {
    loadStarter();
    state.lastAction = "starter";
    setChalStatus("idle", "Idle");
    renderAll();
  });
  document.getElementById("btn-load-tree").addEventListener("click", () => loadTree());
  document.getElementById("btn-toggle-inh").addEventListener("click", () => toggleInherited());
  document.getElementById("btn-select-parent").addEventListener("click", () => selectParent());
  document.getElementById("btn-sketch").addEventListener("click", () => showSketch());
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

  loadStarter();
})();
