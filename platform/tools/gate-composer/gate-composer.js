(() => {
  const PRIMARY = ["A", "B", "C", "D"];
  const GATE_DEFS = {
    NOT: { arity: 1, label: "NOT", eval: (a) => (a ? 0 : 1) },
    AND: { arity: 2, label: "AND", eval: (a, b) => (a && b ? 1 : 0) },
    OR: { arity: 2, label: "OR", eval: (a, b) => (a || b ? 1 : 0) },
    XOR: { arity: 2, label: "XOR", eval: (a, b) => (a ^ b ? 1 : 0) },
    NAND: { arity: 2, label: "NAND", eval: (a, b) => (a && b ? 0 : 1) },
    NOR: { arity: 2, label: "NOR", eval: (a, b) => (a || b ? 0 : 1) },
    XNOR: { arity: 2, label: "XNOR", eval: (a, b) => (a ^ b ? 0 : 1) },
  };

  const STORAGE_KEY = "ddv-gate-composer-v1";
  const CLEARED_KEY = "ddv-gate-composer-cleared-v1";

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

  function saveCleared() {
    try {
      localStorage.setItem(CLEARED_KEY, JSON.stringify(state.clearedIds));
    } catch {
      /* ignore */
    }
  }

  function targetFrom(n, pred) {
    const t = [];
    for (let i = 0; i < 1 << n; i++) {
      const bits = [];
      for (let b = 0; b < n; b++) bits.push((i >> (n - 1 - b)) & 1);
      t.push(pred(...bits) ? 1 : 0);
    }
    return t;
  }

  const PRESETS = {
    and2: {
      title: "AND (2)",
      n: 2,
      gates: [{ id: "g1", type: "AND", ins: ["A", "B"] }],
      output: "g1",
    },
    xor2: {
      title: "XOR (2)",
      n: 2,
      gates: [{ id: "g1", type: "XOR", ins: ["A", "B"] }],
      output: "g1",
    },
    nand2: {
      title: "NAND (2)",
      n: 2,
      gates: [{ id: "g1", type: "NAND", ins: ["A", "B"] }],
      output: "g1",
    },
    majority: {
      title: "Majority (3)",
      n: 3,
      gates: [
        { id: "g1", type: "AND", ins: ["A", "B"] },
        { id: "g2", type: "AND", ins: ["A", "C"] },
        { id: "g3", type: "AND", ins: ["B", "C"] },
        { id: "g4", type: "OR", ins: ["g1", "g2"] },
        { id: "g5", type: "OR", ins: ["g4", "g3"] },
      ],
      output: "g5",
    },
    mux21: {
      title: "2:1 mux",
      n: 3,
      gates: [
        { id: "g1", type: "NOT", ins: ["A"] },
        { id: "g2", type: "AND", ins: ["g1", "B"] },
        { id: "g3", type: "AND", ins: ["A", "C"] },
        { id: "g4", type: "OR", ins: ["g2", "g3"] },
      ],
      output: "g4",
      note: "A=select, B=D0, C=D1",
    },
    faSum: {
      title: "Full-adder SUM",
      n: 3,
      gates: [
        { id: "g1", type: "XOR", ins: ["A", "B"] },
        { id: "g2", type: "XOR", ins: ["g1", "C"] },
      ],
      output: "g2",
      note: "C = Cin",
    },
  };

  const CHALLENGES = [
    {
      id: "and2",
      title: "AND (2)",
      level: "Intro",
      n: 2,
      prompt: "Compose F = A AND B.",
      hint: "One AND gate with inputs A and B.",
      target: targetFrom(2, (a, b) => a & b),
    },
    {
      id: "or2",
      title: "OR (2)",
      level: "Intro",
      n: 2,
      prompt: "Compose F = A OR B.",
      hint: "One OR gate with inputs A and B.",
      target: targetFrom(2, (a, b) => a | b),
    },
    {
      id: "not1",
      title: "Inverter",
      level: "Intro",
      n: 2,
      prompt: "Ignore B: set F = NOT A (F follows ~A for every row).",
      hint: "One NOT gate on A; set F to that gate.",
      target: targetFrom(2, (a) => !a),
    },
    {
      id: "nand2",
      title: "NAND (2)",
      level: "Intro",
      n: 2,
      prompt: "Compose F = A NAND B (NOT of AND).",
      hint: "One NAND, or AND then NOT.",
      target: targetFrom(2, (a, b) => !(a & b)),
    },
    {
      id: "implies",
      title: "Implication A → B",
      level: "Intro",
      n: 2,
      prompt: "F = 1 except when A=1 and B=0 (material implication).",
      hint: "~A | B, or NAND(A, ~B).",
      target: targetFrom(2, (a, b) => !a || !!b),
    },
    {
      id: "xor2",
      title: "XOR (2)",
      level: "Intro",
      n: 2,
      prompt: "Build A ⊕ B (F=1 when A and B differ).",
      hint: "XOR gate, or (A|B) & ~(A&B).",
      target: targetFrom(2, (a, b) => a ^ b),
    },
    {
      id: "xnor2",
      title: "Equality / XNOR",
      level: "Intro",
      n: 2,
      prompt: "F = 1 when A equals B.",
      hint: "XNOR, or ~(A^B).",
      target: targetFrom(2, (a, b) => !(a ^ b)),
    },
    {
      id: "exactly1-2",
      title: "Exactly one (2)",
      level: "Core",
      n: 2,
      prompt: "F = 1 when exactly one of A,B is 1 (same as XOR).",
      hint: "XOR, or (A&~B)|(~A&B).",
      target: targetFrom(2, (a, b) => a + b === 1),
    },
    {
      id: "majority",
      title: "Majority (3)",
      level: "Core",
      n: 3,
      prompt: "F = 1 when at least two of A,B,C are 1.",
      hint: "OR of the three pairwise ANDs.",
      target: targetFrom(3, (a, b, c) => a + b + c >= 2),
    },
    {
      id: "exactly1-3",
      title: "Exactly one (3)",
      level: "Core",
      n: 3,
      prompt: "F = 1 when exactly one of A,B,C is 1 (one-hot detect).",
      hint: "(A&~B&~C)|(~A&B&~C)|(~A&~B&C).",
      target: targetFrom(3, (a, b, c) => a + b + c === 1),
    },
    {
      id: "all-or-none",
      title: "All or none (3)",
      level: "Core",
      n: 3,
      prompt: "F = 1 when all inputs are 0, or all are 1.",
      hint: "(~A&~B&~C) | (A&B&C), or XNOR cascade ideas.",
      target: targetFrom(3, (a, b, c) => a === b && b === c),
    },
    {
      id: "mux",
      title: "2:1 mux",
      level: "Core",
      n: 3,
      prompt: "A selects: F = B when A=0, F = C when A=1.",
      hint: "(~A & B) | (A & C)",
      target: targetFrom(3, (a, b, c) => (a ? c : b)),
    },
    {
      id: "parity",
      title: "Odd parity (3)",
      level: "Core",
      n: 3,
      prompt: "F = A ⊕ B ⊕ C.",
      hint: "Cascade two XOR gates.",
      target: targetFrom(3, (a, b, c) => a ^ b ^ c),
    },
    {
      id: "fa-sum",
      title: "Full-adder SUM",
      level: "HDL",
      n: 3,
      prompt: "Full adder SUM bit: F = A ⊕ B ⊕ C (C = Cin).",
      hint: "Two XOR gates in series.",
      target: targetFrom(3, (a, b, c) => a ^ b ^ c),
    },
    {
      id: "fa-cout",
      title: "Full-adder Cout",
      level: "HDL",
      n: 3,
      prompt: "Full adder carry-out: majority of A, B, Cin.",
      hint: "(A&B)|(A&C)|(B&C) — same as majority.",
      target: targetFrom(3, (a, b, c) => a + b + c >= 2),
    },
    {
      id: "aoi",
      title: "AOI22 fragment",
      level: "HDL",
      n: 4,
      prompt: "F = ~((A&B) | (C&D)) — AND-OR-INVERT style.",
      hint: "Two ANDs into an OR, then NOT (or NOR of the ANDs).",
      target: targetFrom(4, (a, b, c, d) => !((a & b) | (c & d))),
    },
    {
      id: "demux-sel",
      title: "Active-high decode bit0",
      level: "Stretch",
      n: 2,
      prompt: "F = 1 only for A=0,B=0 (decode address 00).",
      hint: "~A & ~B, or NOR(A,B).",
      target: targetFrom(2, (a, b) => !a && !b),
    },
    {
      id: "eq2",
      title: "2-bit equality",
      level: "Stretch",
      n: 4,
      prompt: "Treat A,B as one 2-bit value and C,D as another: F=1 when equal (A==C and B==D).",
      hint: "~(A^C) & ~(B^D).",
      target: targetFrom(4, (a, b, c, d) => a === c && b === d),
    },
    {
      id: "gt1bit",
      title: "1-bit greater-than",
      level: "Stretch",
      n: 2,
      prompt: "F = 1 when A > B (unsigned 1-bit).",
      hint: "A & ~B.",
      target: targetFrom(2, (a, b) => a > b),
    },
  ];

  const state = {
    n: 2,
    gates: [{ id: "g1", type: "AND", ins: ["A", "B"] }],
    output: "g1",
    nextId: 2,
    probeRow: 0,
    challengeOn: false,
    challengeId: "majority",
    challengeHint: false,
    clearedIds: loadCleared(),
    msg: "",
    msgOk: true,
  };

  const root = document.getElementById("gc-root");

  function inputs() {
    return PRIMARY.slice(0, state.n);
  }

  function challengeById(id) {
    return CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
  }

  function nextChallengeId() {
    const i = CHALLENGES.findIndex((c) => c.id === state.challengeId);
    return CHALLENGES[(i + 1) % CHALLENGES.length].id;
  }

  function startChallenge(id) {
    const ch = challengeById(id);
    state.challengeId = ch.id;
    state.challengeOn = true;
    state.challengeHint = false;
    state.n = ch.n;
    state.gates = [];
    state.output = inputs()[0];
    state.nextId = 1;
    state.probeRow = 0;
    state.msg = `Challenge “${ch.title}” — build the net from scratch.`;
    state.msgOk = true;
  }

  function gateLabel(id) {
    const g = state.gates.find((x) => x.id === id);
    if (!g) return id;
    return `${id.toUpperCase()} (${GATE_DEFS[g.type].label})`;
  }

  function signalOptions(excludeIds = new Set()) {
    const opts = inputs().map((n) => ({ value: n, label: n }));
    for (const g of state.gates) {
      if (excludeIds.has(g.id)) continue;
      opts.push({ value: g.id, label: gateLabel(g.id) });
    }
    return opts;
  }

  function topoOrder() {
    const ids = new Set(state.gates.map((g) => g.id));
    const prim = new Set(inputs());
    const indeg = new Map();
    const adj = new Map();
    for (const g of state.gates) {
      indeg.set(g.id, 0);
      adj.set(g.id, []);
    }
    for (const g of state.gates) {
      const def = GATE_DEFS[g.type];
      const pins = g.ins.slice(0, def.arity);
      for (const src of pins) {
        if (prim.has(src)) continue;
        if (!ids.has(src)) {
          return { ok: false, error: `Gate ${g.id} references unknown ${src}` };
        }
        adj.get(src).push(g.id);
        indeg.set(g.id, indeg.get(g.id) + 1);
      }
    }
    const q = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const order = [];
    while (q.length) {
      const id = q.shift();
      order.push(id);
      for (const nxt of adj.get(id)) {
        indeg.set(nxt, indeg.get(nxt) - 1);
        if (indeg.get(nxt) === 0) q.push(nxt);
      }
    }
    if (order.length !== state.gates.length) {
      return { ok: false, error: "Cycle detected in gate wiring" };
    }
    return { ok: true, order };
  }

  function evalNet(bitMap) {
    const topo = topoOrder();
    if (!topo.ok) return { ok: false, error: topo.error, values: { ...bitMap } };
    const values = { ...bitMap };
    const byId = Object.fromEntries(state.gates.map((g) => [g.id, g]));
    for (const id of topo.order) {
      const g = byId[id];
      const def = GATE_DEFS[g.type];
      const args = g.ins.slice(0, def.arity).map((s) => {
        if (!(s in values)) throw new Error(`Missing signal ${s}`);
        return values[s];
      });
      values[id] = def.eval(...args);
    }
    if (!(state.output in values)) {
      return { ok: false, error: `Output ${state.output} not found`, values };
    }
    return { ok: true, values, f: values[state.output] };
  }

  function truthColumn() {
    const n = state.n;
    const rows = 1 << n;
    const names = inputs();
    const col = [];
    let error = null;
    for (let i = 0; i < rows; i++) {
      const bitMap = {};
      names.forEach((name, b) => {
        bitMap[name] = (i >> (n - 1 - b)) & 1;
      });
      try {
        const r = evalNet(bitMap);
        if (!r.ok) {
          error = r.error;
          col.push(null);
        } else col.push(r.f);
      } catch (e) {
        error = e.message || String(e);
        col.push(null);
      }
    }
    return { col, error, names };
  }

  function exprOf(sig, memo = new Map()) {
    if (memo.has(sig)) return memo.get(sig);
    if (inputs().includes(sig)) {
      memo.set(sig, sig);
      return sig;
    }
    const g = state.gates.find((x) => x.id === sig);
    if (!g) {
      memo.set(sig, "?");
      return "?";
    }
    const def = GATE_DEFS[g.type];
    const parts = g.ins.slice(0, def.arity).map((s) => exprOf(s, memo));
    let e;
    if (g.type === "NOT") e = `~(${parts[0]})`;
    else if (g.type === "AND") e = `(${parts[0]} & ${parts[1]})`;
    else if (g.type === "OR") e = `(${parts[0]} | ${parts[1]})`;
    else if (g.type === "XOR") e = `(${parts[0]} ^ ${parts[1]})`;
    else if (g.type === "NAND") e = `~(${parts[0]} & ${parts[1]})`;
    else if (g.type === "NOR") e = `~(${parts[0]} | ${parts[1]})`;
    else if (g.type === "XNOR") e = `~(${parts[0]} ^ ${parts[1]})`;
    else e = "?";
    memo.set(sig, e);
    return e;
  }

  function levels() {
    const topo = topoOrder();
    if (!topo.ok) return { ok: false, error: topo.error, levels: [], depth: new Map() };
    const depth = new Map();
    inputs().forEach((n) => depth.set(n, 0));
    const byId = Object.fromEntries(state.gates.map((g) => [g.id, g]));
    for (const id of topo.order) {
      const g = byId[id];
      const def = GATE_DEFS[g.type];
      const d =
        Math.max(
          ...g.ins.slice(0, def.arity).map((s) => (depth.has(s) ? depth.get(s) : 0))
        ) + 1;
      depth.set(id, d);
    }
    const maxD = Math.max(0, ...depth.values());
    const levels = Array.from({ length: maxD + 1 }, () => []);
    for (const [sig, d] of depth) levels[d].push(sig);
    return { ok: true, levels, depth, maxD };
  }

  function probeValues() {
    const names = inputs();
    const bitMap = {};
    names.forEach((name, b) => {
      bitMap[name] = (state.probeRow >> (state.n - 1 - b)) & 1;
    });
    return evalNet(bitMap);
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    state.n = p.n;
    state.gates = p.gates.map((g) => ({
      id: g.id,
      type: g.type,
      ins: [...g.ins],
    }));
    state.output = p.output;
    state.nextId =
      Math.max(0, ...state.gates.map((g) => Number(String(g.id).replace(/\D/g, "")) || 0)) + 1;
    state.probeRow = 0;
    state.msg = `Loaded preset: ${p.title}${p.note ? ` (${p.note})` : ""}.`;
    state.msgOk = true;
  }

  function addGate(type) {
    const def = GATE_DEFS[type];
    if (!def) return;
    if (state.gates.length >= 12) {
      state.msg = "Limit 12 gates — keep nets small.";
      state.msgOk = false;
      render();
      return;
    }
    const id = `g${state.nextId++}`;
    const defaults = inputs();
    const ins = [];
    for (let i = 0; i < def.arity; i++) {
      ins.push(defaults[Math.min(i, defaults.length - 1)]);
    }
    state.gates.push({ id, type, ins });
    if (!state.output) state.output = id;
    state.msg = `Added ${def.label} as ${id.toUpperCase()}.`;
    state.msgOk = true;
    render();
  }

  function removeGate(id) {
    state.gates = state.gates.filter((g) => g.id !== id);
    for (const g of state.gates) {
      const def = GATE_DEFS[g.type];
      for (let i = 0; i < def.arity; i++) {
        if (g.ins[i] === id) g.ins[i] = inputs()[0];
      }
    }
    if (state.output === id) {
      state.output = state.gates.length ? state.gates[state.gates.length - 1].id : inputs()[0];
    }
    state.msg = `Removed ${id.toUpperCase()}.`;
    state.msgOk = true;
    render();
  }

  function challengePassed() {
    if (!state.challengeOn) return false;
    const ch = challengeById(state.challengeId);
    if (state.n !== ch.n) return false;
    const { col, error } = truthColumn();
    if (error) return false;
    return ch.target.every((t, i) => col[i] === t);
  }

  function noteClearedIfPassed() {
    if (!challengePassed()) return;
    if (!state.clearedIds.includes(state.challengeId)) {
      state.clearedIds = [...state.clearedIds, state.challengeId];
      saveCleared();
    }
  }

  function challengesByLevel() {
    const order = ["Intro", "Core", "HDL", "Stretch"];
    const groups = new Map(order.map((l) => [l, []]));
    for (const c of CHALLENGES) {
      if (!groups.has(c.level)) groups.set(c.level, []);
      groups.get(c.level).push(c);
    }
    return [...groups.entries()].filter(([, list]) => list.length);
  }

  function checkChallenge() {
    const el = root.querySelector("#gc-chal-status");
    if (!el) return;
    if (!state.challengeOn) {
      el.textContent = "Idle";
      el.className = "challenge-status idle";
      return;
    }
    const ch = challengeById(state.challengeId);
    if (state.n !== ch.n) {
      el.textContent = `Set inputs to ${ch.n}`;
      el.className = "challenge-status fail";
      return;
    }
    const ok = challengePassed();
    el.textContent = ok ? `Pass — ${ch.title}` : "Not yet";
    el.className = "challenge-status " + (ok ? "pass" : "fail");
  }

  function snapshot() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      n: state.n,
      gates: state.gates.map((g) => ({ id: g.id, type: g.type, ins: [...g.ins] })),
      output: state.output,
      nextId: state.nextId,
      expr: exprOf(state.output),
    };
  }

  function restoreFromObject(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid file");
    const n = Number(data.n);
    if (!Number.isFinite(n) || n < 2 || n > 4) throw new Error("n must be 2–4");
    if (!Array.isArray(data.gates) || data.gates.length > 12) throw new Error("Bad gates");
    state.n = n;
    state.gates = data.gates.map((g) => ({
      id: String(g.id),
      type: GATE_DEFS[g.type] ? g.type : "AND",
      ins: Array.isArray(g.ins) ? g.ins.map(String) : [],
    }));
    state.output = String(data.output || (state.gates[0] && state.gates[0].id) || "A");
    state.nextId = Number(data.nextId) || state.gates.length + 1;
    state.probeRow = 0;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    } catch {
      /* ignore */
    }
  }

  function tryRestoreLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      restoreFromObject(JSON.parse(raw));
      state.msg = "Restored last net from this browser.";
      state.msgOk = true;
      return true;
    } catch {
      return false;
    }
  }

  function downloadBlob(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function renderSchematic(probe) {
    const lay = levels();
    if (!lay.ok) {
      return `<p class="gc-msg err">${escapeHtml(lay.error)}</p>`;
    }
    const colW = 140;
    const rowH = 64;
    const padX = 36;
    const padY = 28;
    const boxW = 88;
    const boxH = 40;
    const positions = new Map();
    let maxRows = 1;
    lay.levels.forEach((sigs, col) => {
      maxRows = Math.max(maxRows, sigs.length);
      sigs.forEach((sig, row) => {
        positions.set(sig, {
          x: padX + col * colW,
          y: padY + row * rowH,
          cx: padX + col * colW + boxW / 2,
          cy: padY + row * rowH + boxH / 2,
        });
      });
    });
    const width = padX * 2 + lay.maxD * colW + boxW;
    const height = padY * 2 + Math.max(1, maxRows) * rowH;

    const wires = [];
    for (const g of state.gates) {
      const def = GATE_DEFS[g.type];
      const dst = positions.get(g.id);
      if (!dst) continue;
      g.ins.slice(0, def.arity).forEach((src, pin) => {
        const sp = positions.get(src);
        if (!sp) return;
        const yOff = (pin - (def.arity - 1) / 2) * 10;
        const x1 = sp.x + boxW;
        const y1 = sp.cy;
        const x2 = dst.x;
        const y2 = dst.cy + yOff;
        const mx = (x1 + x2) / 2;
        const hot = probe.ok && probe.values[src] === 1;
        wires.push(
          `<path class="gc-wire${hot ? " is-hot" : ""}" d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" />`
        );
      });
    }

    const nodes = [];
    for (const [sig, pos] of positions) {
      const isIn = inputs().includes(sig);
      const isOut = sig === state.output;
      let label = sig.toUpperCase();
      if (!isIn) {
        const g = state.gates.find((x) => x.id === sig);
        label = g ? GATE_DEFS[g.type].label : sig;
      }
      const val = probe.ok ? probe.values[sig] : null;
      const sub = isIn ? sig : sig.toUpperCase();
      nodes.push(`
        <g transform="translate(${pos.x},${pos.y})">
          <rect class="gc-node-box${isIn ? " is-in" : ""}${isOut ? " is-out" : ""}" width="${boxW}" height="${boxH}" rx="8" />
          <text class="gc-node-label" x="${boxW / 2}" y="${boxH / 2 - 6}">${escapeHtml(label)}</text>
          <text class="gc-node-label" x="${boxW / 2}" y="${boxH / 2 + 10}" style="font-size:10px;fill:var(--muted)">${escapeHtml(
            sub
          )}${val === 0 || val === 1 ? ` · ${val}` : ""}</text>
        </g>
      `);
    }

    return `<div class="gc-schematic-wrap"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Gate schematic">${wires.join(
      ""
    )}${nodes.join("")}</svg></div>`;
  }

  function renderTruth(tt) {
    const { col, error, names } = tt;
    const rows = 1 << state.n;
    if (error) {
      return `<p class="gc-msg err">${escapeHtml(error)}</p>`;
    }
    return `
      <div class="gc-table-wrap">
        <table class="gc-table">
          <thead>
            <tr>
              <th>#</th>
              ${names.map((n) => `<th>${escapeHtml(n)}</th>`).join("")}
              <th>F</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: rows }, (_, i) => {
              const bits = names.map((_, b) => (i >> (state.n - 1 - b)) & 1);
              const f = col[i];
              const cls = f === 1 ? "f1" : f === 0 ? "f0" : "ferr";
              return `<tr class="${i === state.probeRow ? "is-probe" : ""}" data-row="${i}">
                <td>${i}</td>
                ${bits.map((b) => `<td>${b}</td>`).join("")}
                <td class="${cls}">${f === null ? "?" : f}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <p class="gc-hint">Click a row to probe that input combination on the schematic (hot wires = 1).</p>
    `;
  }

  function render() {
    const ch = challengeById(state.challengeId);
    const tt = truthColumn();
    const probe = probeValues();
    const topo = topoOrder();
    const expr = topo.ok ? exprOf(state.output) : "—";
    const passed = challengePassed();

    const nOptions = [2, 3, 4]
      .map((v) => `<option value="${v}" ${state.n === v ? "selected" : ""}>${v} inputs (${1 << v} rows)</option>`)
      .join("");

    const typeOptions = Object.keys(GATE_DEFS)
      .map((t) => `<option value="${t}">${GATE_DEFS[t].label}</option>`)
      .join("");

    const outOptions = [
      ...inputs().map((n) => ({ value: n, label: n })),
      ...state.gates.map((g) => ({ value: g.id, label: gateLabel(g.id) })),
    ]
      .map(
        (o) =>
          `<option value="${escapeAttr(o.value)}" ${state.output === o.value ? "selected" : ""}>${escapeHtml(
            o.label
          )}</option>`
      )
      .join("");

    const presetOptions = Object.entries(PRESETS)
      .map(([k, p]) => `<option value="${escapeAttr(k)}">${escapeHtml(p.title)}</option>`)
      .join("");

    noteClearedIfPassed();
    const clearedCount = state.clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    const challengeListHtml = challengesByLevel()
      .map(([level, list]) => {
        const items = list
          .map((c) => {
            const active = c.id === state.challengeId && state.challengeOn;
            const cleared = state.clearedIds.includes(c.id);
            return `
              <button type="button" class="gc-chal-item${active ? " is-active" : ""}${
              cleared ? " is-cleared" : ""
            }" data-chal="${escapeAttr(c.id)}" aria-pressed="${active ? "true" : "false"}">
                <span class="gc-chal-mark" aria-hidden="true">${cleared ? "✓" : "○"}</span>
                <span class="gc-chal-item-text">
                  <span class="gc-chal-item-title">${escapeHtml(c.title)}</span>
                  <span class="gc-chal-item-meta">${c.n} in · ${escapeHtml(c.prompt)}</span>
                </span>
              </button>`;
          })
          .join("");
        return `
          <div class="gc-chal-group">
            <h3>${escapeHtml(level)}</h3>
            <div class="gc-chal-grid">${items}</div>
          </div>`;
      })
      .join("");

    const gateCards = state.gates
      .map((g) => {
        const def = GATE_DEFS[g.type];
        const exclude = new Set([g.id]);
        // Also exclude gates that would create immediate self-deps only; topo catches cycles
        const opts = signalOptions(exclude);
        const pinSelects = Array.from({ length: def.arity }, (_, i) => {
          const cur = g.ins[i] || inputs()[0];
          return `
            <div class="gc-field">
              <label>In${i + 1}</label>
              <select data-gate="${escapeAttr(g.id)}" data-pin="${i}">
                ${opts
                  .map(
                    (o) =>
                      `<option value="${escapeAttr(o.value)}" ${o.value === cur ? "selected" : ""}>${escapeHtml(
                        o.label
                      )}</option>`
                  )
                  .join("")}
              </select>
            </div>`;
        }).join("");
        return `
          <div class="gc-gate" data-id="${escapeAttr(g.id)}">
            <div class="gc-gate-top">
              <div>
                <span class="gc-gate-id">${escapeHtml(g.id.toUpperCase())}</span>
                <span class="gc-gate-type">${escapeHtml(def.label)}</span>
                ${state.output === g.id ? `<span class="gc-out-badge">F</span>` : ""}
              </div>
              <div class="tool-actions">
                <button type="button" class="btn btn-ghost" data-make-out="${escapeAttr(g.id)}">Set as F</button>
                <button type="button" class="btn btn-ghost" data-del="${escapeAttr(g.id)}">Remove</button>
              </div>
            </div>
            <div class="gc-pins">
              <div class="gc-field">
                <label>Type</label>
                <select data-type="${escapeAttr(g.id)}">
                  ${Object.keys(GATE_DEFS)
                    .map(
                      (t) =>
                        `<option value="${t}" ${g.type === t ? "selected" : ""}>${GATE_DEFS[t].label}</option>`
                    )
                    .join("")}
                </select>
              </div>
              ${pinSelects}
            </div>
          </div>`;
      })
      .join("");

    root.innerHTML = `
      <div class="challenge">
        <div class="gc-chal-head">
          <h2>Challenges</h2>
          <span class="gc-chal-progress">${clearedCount} / ${CHALLENGES.length} cleared</span>
        </div>
        <div class="gc-chal-catalog">${challengeListHtml}</div>
        <p class="gc-chal-active-prompt"><strong>${escapeHtml(ch.title)}:</strong> ${escapeHtml(ch.prompt)}</p>
        ${
          state.challengeOn && state.challengeHint
            ? `<p class="gc-hint"><strong>Hint:</strong> ${escapeHtml(ch.hint)}</p>`
            : ""
        }
        <div class="tool-actions">
          <button type="button" class="btn btn-secondary" id="gc-chal-start">${
            state.challengeOn && state.challengeId === ch.id ? "Restart blank" : "Start selected"
          }</button>
          <button type="button" class="btn btn-ghost" id="gc-chal-hint" ${
            state.challengeOn ? "" : "disabled"
          }>${state.challengeHint ? "Hide hint" : "Show hint"}</button>
          <button type="button" class="btn btn-ghost" id="gc-chal-next" ${passed ? "" : "disabled"}>
            Next challenge
          </button>
          <button type="button" class="btn btn-ghost" id="gc-chal-stop" ${
            state.challengeOn ? "" : "disabled"
          }>Stop checking</button>
          <button type="button" class="btn btn-ghost" id="gc-chal-reset-progress">Reset progress</button>
          <span class="challenge-status idle" id="gc-chal-status">Idle</span>
          ${passed ? `<span class="challenge-status pass">Matched target table</span>` : ""}
        </div>
      </div>

      <div class="gc-toolbar no-print">
        <div class="gc-field">
          <label for="gc-n">Primary inputs</label>
          <select id="gc-n">${nOptions}</select>
        </div>
        <div class="gc-field">
          <label for="gc-add-type">Add gate</label>
          <select id="gc-add-type">${typeOptions}</select>
        </div>
        <button type="button" class="btn btn-primary" id="gc-add">Add</button>
        <div class="gc-field">
          <label for="gc-preset">Preset</label>
          <select id="gc-preset"><option value="">— choose —</option>${presetOptions}</select>
        </div>
        <div class="gc-field">
          <label for="gc-out">Output F</label>
          <select id="gc-out">${outOptions}</select>
        </div>
      </div>

      <div class="tool-layout split-wide">
        <div class="panel">
          <div class="panel-head"><h2>Netlist</h2></div>
          <div class="panel-body">
            <div class="gc-gate-list">
              ${gateCards || `<p class="gc-hint">No gates yet — add one above.</p>`}
            </div>
            <p class="gc-msg ${state.msgOk ? "ok" : "err"}">${escapeHtml(state.msg)}</p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Schematic</h2></div>
          <div class="panel-body">
            ${renderSchematic(probe)}
            <p class="gc-hint">Probe row #${state.probeRow}: ${inputs()
              .map((n, b) => `${n}=${(state.probeRow >> (state.n - 1 - b)) & 1}`)
              .join(" ")} → F=${
              probe.ok ? probe.f : "?"
            }</p>
          </div>
        </div>
      </div>

      <div class="tool-layout split-wide" style="margin-top:1rem">
        <div class="panel">
          <div class="panel-head"><h2>Truth table</h2></div>
          <div class="panel-body">${renderTruth(tt)}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Derived expression</h2></div>
          <div class="panel-body">
            <pre class="gc-expr">${escapeHtml("F = " + expr)}</pre>
            <div class="tool-actions no-print" style="margin-top:0.65rem">
              <button type="button" class="btn btn-secondary" id="gc-print">Print</button>
              <button type="button" class="btn btn-secondary" id="gc-json">Download JSON</button>
              <label class="btn btn-ghost gc-file-btn">
                Load JSON
                <input type="file" id="gc-load" accept="application/json,.json" hidden>
              </label>
              <button type="button" class="btn btn-ghost" id="gc-clear-store">Clear saved session</button>
            </div>
          </div>
        </div>
      </div>
    `;

    bind();
    checkChallenge();
    persist();
  }

  function bind() {
    root.querySelector("#gc-n").addEventListener("change", (e) => {
      const n = Number(e.target.value);
      state.n = n;
      const allowed = new Set(inputs());
      for (const g of state.gates) {
        const def = GATE_DEFS[g.type];
        for (let i = 0; i < def.arity; i++) {
          const src = g.ins[i];
          if (!allowed.has(src) && !state.gates.some((x) => x.id === src)) {
            g.ins[i] = inputs()[0];
          }
        }
      }
      if (state.probeRow >= 1 << n) state.probeRow = 0;
      state.msg = `Using ${n} primary inputs.`;
      state.msgOk = true;
      render();
    });

    root.querySelector("#gc-add").addEventListener("click", () => {
      addGate(root.querySelector("#gc-add-type").value);
    });

    root.querySelector("#gc-preset").addEventListener("change", (e) => {
      const key = e.target.value;
      if (!key) return;
      applyPreset(key);
      e.target.value = "";
      render();
    });

    root.querySelector("#gc-out").addEventListener("change", (e) => {
      state.output = e.target.value;
      state.msg = `Output F ← ${state.output.toUpperCase()}.`;
      state.msgOk = true;
      render();
    });

    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => removeGate(btn.getAttribute("data-del")));
    });
    root.querySelectorAll("[data-make-out]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.output = btn.getAttribute("data-make-out");
        render();
      });
    });
    root.querySelectorAll("[data-type]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const id = sel.getAttribute("data-type");
        const g = state.gates.find((x) => x.id === id);
        if (!g) return;
        const type = sel.value;
        const def = GATE_DEFS[type];
        g.type = type;
        while (g.ins.length < def.arity) g.ins.push(inputs()[0]);
        g.ins = g.ins.slice(0, def.arity);
        render();
      });
    });
    root.querySelectorAll("[data-gate][data-pin]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const id = sel.getAttribute("data-gate");
        const pin = Number(sel.getAttribute("data-pin"));
        const g = state.gates.find((x) => x.id === id);
        if (!g) return;
        g.ins[pin] = sel.value;
        render();
      });
    });

    root.querySelectorAll(".gc-table tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        state.probeRow = Number(tr.getAttribute("data-row"));
        render();
      });
    });

    root.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-chal");
        startChallenge(id);
        render();
      });
    });
    root.querySelector("#gc-chal-start").addEventListener("click", () => {
      startChallenge(state.challengeId);
      render();
    });
    root.querySelector("#gc-chal-hint").addEventListener("click", () => {
      if (!state.challengeOn) return;
      state.challengeHint = !state.challengeHint;
      render();
    });
    root.querySelector("#gc-chal-next").addEventListener("click", () => {
      if (!challengePassed()) return;
      startChallenge(nextChallengeId());
      render();
    });
    root.querySelector("#gc-chal-stop").addEventListener("click", () => {
      state.challengeOn = false;
      state.challengeHint = false;
      state.msg = "Challenge checking stopped.";
      state.msgOk = true;
      render();
    });
    root.querySelector("#gc-chal-reset-progress").addEventListener("click", () => {
      state.clearedIds = [];
      saveCleared();
      state.msg = "Cleared challenge progress marks.";
      state.msgOk = true;
      render();
    });

    root.querySelector("#gc-print").addEventListener("click", () => window.print());
    root.querySelector("#gc-json").addEventListener("click", () => {
      downloadBlob(`gate-composer-${stamp()}.json`, JSON.stringify(snapshot(), null, 2), "application/json");
      state.msg = "Downloaded JSON netlist.";
      state.msgOk = true;
      render();
    });
    root.querySelector("#gc-load").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          restoreFromObject(JSON.parse(String(reader.result)));
          state.msg = `Loaded ${file.name}.`;
          state.msgOk = true;
        } catch (err) {
          state.msg = err.message || String(err);
          state.msgOk = false;
        }
        render();
      };
      reader.readAsText(file);
    });
    root.querySelector("#gc-clear-store").addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      state.msg = "Cleared saved session (current net kept).";
      state.msgOk = true;
      render();
    });
  }

  if (!tryRestoreLocal()) {
    applyPreset("and2");
    state.msg = "Start from a preset, or add gates and wire them.";
    state.msgOk = true;
  }
  render();
})();
