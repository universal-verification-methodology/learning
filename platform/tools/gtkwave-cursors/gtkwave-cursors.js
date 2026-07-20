(() => {
  /**
   * GTKWave cursor literacy — browser sketch (not GTKWave itself)
   *   Primary cursor A, marker B, Δt
   *   Zoom in/out on a fixed dump window
   *   SST-style add/remove signals to the wave pane
   */

  const T_END = 100; // dump length (ns sketch)
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;

  /** Synthetic dump: time → values */
  const DUMP = {
    clk: [
      { t: 0, v: 0 },
      { t: 5, v: 1 },
      { t: 10, v: 0 },
      { t: 15, v: 1 },
      { t: 20, v: 0 },
      { t: 25, v: 1 },
      { t: 30, v: 0 },
      { t: 35, v: 1 },
      { t: 40, v: 0 },
      { t: 45, v: 1 },
      { t: 50, v: 0 },
      { t: 55, v: 1 },
      { t: 60, v: 0 },
      { t: 65, v: 1 },
      { t: 70, v: 0 },
      { t: 75, v: 1 },
      { t: 80, v: 0 },
      { t: 85, v: 1 },
      { t: 90, v: 0 },
      { t: 95, v: 1 },
    ],
    data: [
      { t: 0, v: 0 },
      { t: 12, v: 0xa5 },
      { t: 32, v: 0x3c },
      { t: 52, v: 0xff },
      { t: 72, v: 0x00 },
    ],
    valid: [
      { t: 0, v: 0 },
      { t: 12, v: 1 },
      { t: 22, v: 0 },
      { t: 32, v: 1 },
      { t: 42, v: 0 },
      { t: 52, v: 1 },
      { t: 62, v: 0 },
    ],
    rst_n: [
      { t: 0, v: 0 },
      { t: 8, v: 1 },
    ],
  };

  const ALL_SIGS = ["clk", "data", "valid", "rst_n"];

  function valueAt(name, t) {
    const edges = DUMP[name];
    let v = edges[0].v;
    for (const e of edges) {
      if (e.t <= t) v = e.v;
      else break;
    }
    return v;
  }

  function formatVal(name, v) {
    if (name === "data") return `0x${v.toString(16).padStart(2, "0")}`;
    return String(v);
  }

  function segments(name) {
    const edges = DUMP[name];
    const segs = [];
    for (let i = 0; i < edges.length; i++) {
      const t0 = edges[i].t;
      const t1 = i + 1 < edges.length ? edges[i + 1].t : T_END;
      segs.push({ t0, t1, v: edges[i].v });
    }
    return segs;
  }

  function makeStarter() {
    return {
      shown: ["clk", "valid"],
      cursorA: 20,
      markerB: 40,
      zoom: 1,
      viewStart: 0, // left edge of visible window in dump time
      lastAction: "",
      explained: false,
      addedSignal: false,
      removedSignal: false,
      zoomedIn: false,
      zoomedOut: false,
      setMarker: false,
      movedCursor: false,
      jumpedEdge: false,
      log: [],
      trace: [],
    };
  }

  function viewWidth(zoom) {
    return Math.round(T_END / zoom);
  }

  function delta(state) {
    return Math.abs(state.markerB - state.cursorA);
  }

  const CLEARED_KEY = "ddv-gtkwave-cursors-cleared-v1";
  const STORE_KEY = "ddv-gtkwave-cursors-session-v1";

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
  /** @type {ReturnType<typeof makeStarter>} */
  let state = makeStarter();

  const root = document.getElementById("gw-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> clk + valid in the wave pane —
        yellow <strong>A</strong> cursor, magenta <strong>B</strong> marker; read Δt like GTKWave.</p>
      <button type="button" class="btn btn-secondary" id="gw-starter">Load starter example</button>
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
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Core ideas</h2></div>
      <div class="panel-body">
        <div class="idea-grid">
          <div class="idea-card">
            <h3>Cursor A</h3>
            <p>Primary readout — values at the yellow line.</p>
          </div>
          <div class="idea-card">
            <h3>Marker B</h3>
            <p>Second time — Δt = |B − A| for pulse / latency.</p>
          </div>
          <div class="idea-card">
            <h3>SST → wave</h3>
            <p>Add signals from the hierarchy list into the pane.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>Wave viewer sketch</h2></div>
        <div class="panel-body">
          <p class="legend">Click a time on a track to move cursor A. Use buttons for marker, zoom, and SST add.</p>
          <div class="viewer">
            <div class="sst">
              <h3>SST (signals)</h3>
              <div id="sst-list"></div>
            </div>
            <div class="wave-pane">
              <div class="wave-toolbar">
                <span>A=<strong id="tb-a">—</strong></span>
                <span>B=<strong id="tb-b">—</strong></span>
                <span>Δt=<strong id="tb-dt">—</strong></span>
                <span>zoom=<strong id="tb-z">—</strong>×</span>
              </div>
              <div class="time-ruler" id="time-ruler"></div>
              <div class="wave-canvas" id="wave-canvas"></div>
            </div>
          </div>
          <div class="values-at" id="values-at"></div>
          <div class="action-grid">
            <button type="button" id="btn-marker">Drop marker B at A</button>
            <button type="button" id="btn-swap">Swap A ↔ B</button>
            <button type="button" id="btn-zoom-in">Zoom in</button>
            <button type="button" id="btn-zoom-out">Zoom out</button>
            <button type="button" id="btn-edge">Jump A to next clk↑</button>
            <button type="button" id="btn-home">View dump start</button>
            <button type="button" id="btn-pulse">Measure valid pulse (A/B)</button>
            <button type="button" id="btn-demo">Demo: Δt literacy</button>
            <button type="button" id="btn-explain">Explain cursors</button>
            <button type="button" id="btn-reset">Reset view</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Readout</h2></div>
        <div class="panel-body">
          <div class="status-grid">
            <div class="status-card">
              <h3>Δt (ns sketch)</h3>
              <p class="val" id="val-dt">—</p>
              <p class="note" id="note-dt"></p>
            </div>
            <div class="status-card">
              <h3>Shown signals</h3>
              <p class="val" id="val-sigs">—</p>
              <p class="note" id="note-sigs"></p>
            </div>
          </div>
          <pre class="trace-box" id="trace-box"></pre>
          <pre class="log-box" id="log-box"></pre>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>Cheat sheet</h2></div>
      <div class="panel-body">
        <table class="cheat-table">
          <thead><tr><th>GTKWave idea</th><th>Here</th></tr></thead>
          <tbody>
            <tr><td>Primary cursor</td><td>Yellow A — click wave</td></tr>
            <tr><td>Marker / baseline</td><td>Magenta B — Drop marker</td></tr>
            <tr><td>Time delta</td><td>Δt = |B−A|</td></tr>
            <tr><td>Zoom</td><td>Zoom in / out</td></tr>
            <tr><td>Append from SST</td><td>Click signal in left list</td></tr>
          </tbody>
        </table>
        <ul class="hint-list" style="margin-top:0.75rem">
          <li>Valid high from t=12→22 → pulse width 10 if A=12, B=22.</li>
          <li>This is a literacy sketch — open real VCD/FST in GTKWave for dumps.</li>
        </ul>
      </div>
    </div>
  `;

  const sstList = document.getElementById("sst-list");
  const waveCanvas = document.getElementById("wave-canvas");
  const timeRuler = document.getElementById("time-ruler");
  const valuesAt = document.getElementById("values-at");
  const tbA = document.getElementById("tb-a");
  const tbB = document.getElementById("tb-b");
  const tbDt = document.getElementById("tb-dt");
  const tbZ = document.getElementById("tb-z");
  const valDt = document.getElementById("val-dt");
  const noteDt = document.getElementById("note-dt");
  const valSigs = document.getElementById("val-sigs");
  const noteSigs = document.getElementById("note-sigs");
  const traceBox = document.getElementById("trace-box");
  const logBox = document.getElementById("log-box");

  function pushLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 40) state.log.length = 40;
  }

  function pushTrace(line) {
    state.trace.unshift(line);
    if (state.trace.length > 24) state.trace.length = 24;
  }

  function clampView() {
    const w = viewWidth(state.zoom);
    if (state.viewStart + w > T_END) state.viewStart = Math.max(0, T_END - w);
    if (state.viewStart < 0) state.viewStart = 0;
  }

  function timeFromClick(ev, trackEl) {
    const rect = trackEl.getBoundingClientRect();
    const x = Math.min(Math.max(0, ev.clientX - rect.left), rect.width);
    const w = viewWidth(state.zoom);
    return Math.round(state.viewStart + (x / rect.width) * w);
  }

  function toggleSignal(name) {
    const i = state.shown.indexOf(name);
    if (i >= 0) {
      if (state.shown.length <= 1) {
        pushLog("# keep at least one signal");
        renderAll();
        return;
      }
      state.shown.splice(i, 1);
      state.removedSignal = true;
      state.lastAction = "remove";
      pushLog(`# remove ${name}`);
    } else {
      state.shown.push(name);
      state.addedSignal = true;
      state.lastAction = "add";
      pushLog(`# add ${name}`);
    }
    pushTrace(`signals: ${state.shown.join(", ")}`);
    renderAll();
  }

  function setCursor(t) {
    state.cursorA = Math.max(0, Math.min(T_END, t));
    state.movedCursor = true;
    state.lastAction = "cursor";
    // keep A in view
    const w = viewWidth(state.zoom);
    if (state.cursorA < state.viewStart) state.viewStart = state.cursorA;
    if (state.cursorA > state.viewStart + w) state.viewStart = state.cursorA - w;
    clampView();
    pushLog(`# cursor A → ${state.cursorA}`);
    renderAll();
  }

  function dropMarker() {
    state.markerB = state.cursorA;
    state.setMarker = true;
    state.lastAction = "marker";
    pushLog(`# marker B → ${state.markerB}`);
    pushTrace(`Δt=${delta(state)}`);
    renderAll();
  }

  function jumpEdge() {
    let next = null;
    for (const e of DUMP.clk) {
      if (e.v === 1 && e.t > state.cursorA) {
        next = e.t;
        break;
      }
    }
    if (next === null) next = DUMP.clk.find((e) => e.v === 1)?.t ?? 5;
    state.jumpedEdge = true;
    state.cursorA = next;
    state.movedCursor = true;
    const w = viewWidth(state.zoom);
    if (state.cursorA < state.viewStart) state.viewStart = state.cursorA;
    if (state.cursorA > state.viewStart + w) state.viewStart = state.cursorA - w;
    clampView();
    state.lastAction = "edge";
    pushLog(`# cursor A → ${state.cursorA}`);
    pushTrace(`jump clk↑ → ${next}`);
    renderAll();
  }

  function measurePulse() {
    // first valid high pulse 12..22
    state.shown = ["clk", "valid"];
    if (!state.shown.includes("valid")) state.shown.push("valid");
    state.cursorA = 12;
    state.markerB = 22;
    state.setMarker = true;
    state.movedCursor = true;
    state.zoom = 2;
    state.zoomedIn = true;
    state.viewStart = 0;
    state.lastAction = "pulse";
    pushLog("# measure valid pulse A=12 B=22 Δt=10");
    pushTrace("valid pulse width = 10");
    renderAll();
  }

  function runDemo() {
    state.shown = ["clk", "valid", "data"];
    state.addedSignal = true;
    state.cursorA = 12;
    state.markerB = 32;
    state.setMarker = true;
    state.movedCursor = true;
    state.zoom = 2;
    state.zoomedIn = true;
    state.viewStart = 0;
    state.lastAction = "demo";
    pushLog("# demo Δt=20 between data beats");
    pushTrace("A@12 data=0xa5 · B@32 data=0x3c · Δt=20");
    renderAll();
  }

  function explain() {
    state.explained = true;
    state.lastAction = "explain";
    pushLog("# A=readout · B=marker · Δt=latency · SST=add");
    pushTrace("explain: same habits transfer to GTKWave UI");
    renderAll();
  }

  function loadStarter() {
    state = makeStarter();
    state.lastAction = "starter";
    pushLog("# starter clk+valid A=20 B=40");
    renderAll();
  }

  function pctInView(t) {
    const w = viewWidth(state.zoom);
    return ((t - state.viewStart) / w) * 100;
  }

  function renderWaves() {
    const w = viewWidth(state.zoom);
    const viewEnd = state.viewStart + w;

    // ruler
    const ticks = [];
    const step = w <= 30 ? 5 : w <= 60 ? 10 : 20;
    for (let t = Math.ceil(state.viewStart / step) * step; t <= viewEnd; t += step) {
      ticks.push(`<span style="left:${pctInView(t)}%">${t}</span>`);
    }
    timeRuler.innerHTML = ticks.join("");

    const aPct = pctInView(state.cursorA);
    const bPct = pctInView(state.markerB);
    const aVis = state.cursorA >= state.viewStart && state.cursorA <= viewEnd;
    const bVis = state.markerB >= state.viewStart && state.markerB <= viewEnd;

    let html = "";
    if (aVis) {
      html += `<div class="cursor-line" style="left:calc(4.85rem + (100% - 4.85rem) * ${aPct / 100})"></div>`;
      html += `<div class="cursor-label" style="left:calc(4.85rem + (100% - 4.85rem) * ${aPct / 100})">A</div>`;
    }
    if (bVis) {
      html += `<div class="marker-line" style="left:calc(4.85rem + (100% - 4.85rem) * ${bPct / 100})"></div>`;
      html += `<div class="marker-label" style="left:calc(4.85rem + (100% - 4.85rem) * ${bPct / 100});top:0.9rem">B</div>`;
    }

    // Simpler approach: put lines inside each track relative
    html = state.shown
      .map((name) => {
        const segs = segments(name)
          .filter((s) => s.t1 > state.viewStart && s.t0 < viewEnd)
          .map((s) => {
            const left = Math.max(0, pctInView(s.t0));
            const right = Math.min(100, pctInView(s.t1));
            const width = Math.max(0.5, right - left);
            const isBus = name === "data";
            const cls = isBus ? "is-bus" : s.v ? "is-hi" : "is-lo";
            const label = isBus ? formatVal(name, s.v) : s.v ? "1" : "0";
            return `<div class="wave-seg ${cls}" style="left:${left}%;width:${width}%">${width > 8 ? label : ""}</div>`;
          })
          .join("");
        const cursors =
          (aVis
            ? `<div class="cursor-line" style="left:${aPct}%"></div>`
            : "") +
          (bVis
            ? `<div class="marker-line" style="left:${bPct}%"></div>`
            : "");
        return `<div class="wave-row">
          <div class="wave-name">${name}</div>
          <div class="wave-track" data-track="1">${segs}${cursors}</div>
        </div>`;
      })
      .join("");

    waveCanvas.innerHTML = html;
    waveCanvas.querySelectorAll(".wave-track").forEach((track) => {
      track.addEventListener("click", (ev) => {
        setCursor(timeFromClick(ev, track));
      });
    });
  }

  function renderSst() {
    sstList.innerHTML = ALL_SIGS.map((name) => {
      const on = state.shown.includes(name) ? "is-added" : "";
      return `<button type="button" class="${on}" data-sig="${name}">${on ? "✓ " : "+ "}${name}</button>`;
    }).join("");
    sstList.querySelectorAll("[data-sig]").forEach((btn) => {
      btn.addEventListener("click", () => toggleSignal(btn.getAttribute("data-sig")));
    });
  }

  function renderAll() {
    clampView();
    renderSst();
    renderWaves();

    tbA.textContent = String(state.cursorA);
    tbB.textContent = String(state.markerB);
    tbDt.textContent = String(delta(state));
    tbZ.textContent = String(state.zoom);

    const vals = state.shown
      .map((n) => `${n}=${formatVal(n, valueAt(n, state.cursorA))}`)
      .join(" · ");
    valuesAt.textContent = `At A=${state.cursorA}: ${vals}`;

    valDt.textContent = `${delta(state)}`;
    noteDt.textContent = `|${state.markerB} − ${state.cursorA}|`;
    valSigs.textContent = String(state.shown.length);
    noteSigs.textContent = state.shown.join(", ");

    traceBox.textContent = state.trace.length ? state.trace.join("\n") : "// no activity";
    logBox.textContent = state.log.length ? state.log.join("\n") : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ shown: state.shown, a: state.cursorA, b: state.markerB })
      );
    } catch {
      /* ignore */
    }
  }

  document.getElementById("gw-starter").addEventListener("click", loadStarter);

  document.getElementById("btn-marker").addEventListener("click", dropMarker);

  document.getElementById("btn-swap").addEventListener("click", () => {
    const tmp = state.cursorA;
    state.cursorA = state.markerB;
    state.markerB = tmp;
    state.lastAction = "swap";
    pushLog(`# swap A=${state.cursorA} B=${state.markerB}`);
    renderAll();
  });

  document.getElementById("btn-zoom-in").addEventListener("click", () => {
    if (state.zoom < ZOOM_MAX) {
      state.zoom += 1;
      state.zoomedIn = true;
      // center on A
      const w = viewWidth(state.zoom);
      state.viewStart = Math.max(0, state.cursorA - Math.floor(w / 2));
      clampView();
    }
    state.lastAction = "zoom-in";
    pushLog(`# zoom → ${state.zoom}×`);
    renderAll();
  });

  document.getElementById("btn-zoom-out").addEventListener("click", () => {
    if (state.zoom > ZOOM_MIN) {
      state.zoom -= 1;
      state.zoomedOut = true;
      clampView();
    }
    state.lastAction = "zoom-out";
    pushLog(`# zoom → ${state.zoom}×`);
    renderAll();
  });

  document.getElementById("btn-edge").addEventListener("click", jumpEdge);

  document.getElementById("btn-home").addEventListener("click", () => {
    state.viewStart = 0;
    state.lastAction = "home";
    pushLog("# view → dump start");
    renderAll();
  });

  document.getElementById("btn-pulse").addEventListener("click", measurePulse);
  document.getElementById("btn-demo").addEventListener("click", runDemo);
  document.getElementById("btn-explain").addEventListener("click", explain);

  document.getElementById("btn-reset").addEventListener("click", () => {
    const explained = state.explained;
    state = makeStarter();
    state.explained = explained;
    state.lastAction = "reset";
    pushLog("# reset view");
    renderAll();
  });

  const CHALLENGES = [
    {
      id: "quiz-cursor",
      title: "Quiz: cursor",
      prompt: "Primary yellow readout line is cursor? Answer: <code>A</code>",
      hint: "primary cursor",
      type: "text",
      answer: "a",
      alt: ["cursor a", "primary", "A"],
    },
    {
      id: "quiz-marker",
      title: "Quiz: marker",
      prompt: "Second magenta time mark is? Answer: <code>B</code>",
      hint: "marker B",
      type: "text",
      answer: "b",
      alt: ["marker", "marker b", "B"],
    },
    {
      id: "quiz-delta",
      title: "Quiz: delta",
      prompt: "Time between A and B is written? Answer: <code>delta</code>",
      hint: "Δt",
      type: "text",
      answer: "delta",
      alt: ["Δt", "dt", "delta t", "time delta"],
    },
    {
      id: "quiz-sst",
      title: "Quiz: SST",
      prompt: "Signal list pane acronym (GTKWave)? Answer: <code>SST</code>",
      hint: "Signal Search Tree",
      type: "text",
      answer: "sst",
      alt: ["SST", "signal search tree"],
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — clk and valid shown.",
      hint: "Load starter example",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "starter" &&
        state.shown.includes("clk") &&
        state.shown.includes("valid"),
    },
    {
      id: "add-data",
      title: "Add data",
      prompt: "Add <code>data</code> from SST.",
      hint: "Click + data in SST",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.shown.includes("data") && state.addedSignal,
    },
    {
      id: "add-rst",
      title: "Add rst_n",
      prompt: "Add <code>rst_n</code> from SST.",
      hint: "Click + rst_n",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.shown.includes("rst_n") && state.addedSignal,
    },
    {
      id: "remove",
      title: "Remove",
      prompt: "Remove a signal from the wave pane (keep ≥1).",
      hint: "Click a ✓ signal in SST",
      type: "state",
      setup: () => {
        loadStarter();
        state.shown = ["clk", "valid", "data"];
        renderAll();
      },
      check: () => state.removedSignal && state.lastAction === "remove",
    },
    {
      id: "marker",
      title: "Drop marker",
      prompt: "Drop marker B at A.",
      hint: "Drop marker B at A",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.setMarker &&
        state.markerB === state.cursorA &&
        state.lastAction === "marker",
    },
    {
      id: "zoom-in",
      title: "Zoom in",
      prompt: "Zoom in at least once (zoom ≥ 2).",
      hint: "Zoom in",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.zoomedIn && state.zoom >= 2,
    },
    {
      id: "zoom-out",
      title: "Zoom out",
      prompt: "Zoom out (after zooming in).",
      hint: "Zoom in then Zoom out",
      type: "state",
      setup: () => {
        loadStarter();
        state.zoom = 2;
        renderAll();
      },
      check: () => state.zoomedOut && state.lastAction === "zoom-out",
    },
    {
      id: "move-cursor",
      title: "Move cursor",
      prompt: "Click a wave track to move cursor A.",
      hint: "Click on a waveform",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.movedCursor && state.lastAction === "cursor",
    },
    {
      id: "jump-edge",
      title: "Jump edge",
      prompt: "Jump A to next clk↑.",
      hint: "Jump A to next clk↑",
      type: "state",
      setup: () => {
        loadStarter();
        state.cursorA = 0;
        renderAll();
      },
      check: () =>
        state.jumpedEdge &&
        state.cursorA > 0 &&
        valueAt("clk", state.cursorA) === 1,
    },
    {
      id: "pulse",
      title: "Pulse measure",
      prompt: "Measure valid pulse — Δt=10 (A=12, B=22).",
      hint: "Measure valid pulse button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "pulse" &&
        state.cursorA === 12 &&
        state.markerB === 22 &&
        delta(state) === 10,
    },
    {
      id: "delta-20",
      title: "Delta 20",
      prompt: "Set A and B 20 apart (any position).",
      hint: "Click + Drop marker, or Demo / Swap",
      type: "state",
      setup: () => loadStarter(),
      check: () => delta(state) === 20,
    },
    {
      id: "swap",
      title: "Swap",
      prompt: "Swap A ↔ B.",
      hint: "Swap A ↔ B",
      type: "state",
      setup: () => {
        loadStarter();
        state.cursorA = 10;
        state.markerB = 30;
        renderAll();
      },
      check: () =>
        state.lastAction === "swap" &&
        state.cursorA === 30 &&
        state.markerB === 10,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Run Demo: Δt literacy.",
      hint: "Demo button",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.lastAction === "demo" &&
        delta(state) === 20 &&
        state.shown.includes("data"),
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Run Explain cursors.",
      hint: "Explain cursors",
      type: "state",
      setup: () => loadStarter(),
      check: () => state.explained && state.lastAction === "explain",
    },
    {
      id: "home",
      title: "Home",
      prompt: "View dump start (viewStart=0).",
      hint: "View dump start",
      type: "state",
      setup: () => {
        loadStarter();
        state.viewStart = 40;
        state.zoom = 2;
        renderAll();
      },
      check: () => state.viewStart === 0 && state.lastAction === "home",
    },
    {
      id: "readout",
      title: "Readout",
      prompt: "Place A at t=12 — data should read 0xa5 (add data if needed).",
      hint: "Add data, jump/click near 12",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.shown.includes("data") &&
        state.cursorA === 12 &&
        valueAt("data", 12) === 0xa5,
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset view to starter defaults.",
      hint: "Reset view",
      type: "state",
      setup: () => {
        runDemo();
      },
      check: () =>
        state.lastAction === "reset" &&
        state.cursorA === 20 &&
        state.markerB === 40 &&
        state.zoom === 1,
    },
    {
      id: "full-path",
      title: "Full path",
      prompt: "Starter → demo → explain.",
      hint: "Load → Demo → Explain",
      type: "state",
      setup: () => loadStarter(),
      check: () =>
        state.explained &&
        state.lastAction === "explain" &&
        state.shown.includes("data"),
    },
  ];

  function normalizeAns(s) {
    return String(s)
      .trim()
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");
  }

  function isCleared(id) {
    return clearedIds.includes(String(id));
  }

  function markCleared(id) {
    const sid = String(id);
    if (!clearedIds.includes(sid)) {
      clearedIds.push(sid);
      try {
        localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
      } catch {
        /* ignore */
      }
    }
  }

  function setStatus(kind, text) {
    const el = document.getElementById("chal-status");
    el.className = `challenge-status ${kind}`;
    el.textContent = text;
  }

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    document.getElementById("chal-progress").textContent =
      `(${challengeIdx + 1}/${CHALLENGES.length}` +
      (isCleared(ch.id) ? " · cleared" : "") +
      ")";
    document.getElementById("chal-prompt").innerHTML =
      `<strong>${ch.title}.</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    hintEl.hidden = !showHint;
    hintEl.textContent = showHint ? `Hint: ${ch.hint}` : "";
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      ansRow.innerHTML = `<label class="sr-only" for="chal-answer">Answer</label>
        <input type="text" id="chal-answer" class="chal-input" autocomplete="off" placeholder="Type answer…">`;
      const inp = /** @type {HTMLInputElement} */ (document.getElementById("chal-answer"));
      inp.value = answerDraft;
      inp.addEventListener("input", () => {
        answerDraft = inp.value;
      });
    } else {
      ansRow.innerHTML = "";
    }
    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = CHALLENGES.map((c, i) => {
      const cls = [
        "kbd",
        i === challengeIdx ? "is-active" : "",
        isCleared(c.id) ? "is-cleared" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-chal="${i}">${c.id}</button>`;
    }).join(" ");
    cat.querySelectorAll("[data-chal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        challengeIdx = Number(btn.getAttribute("data-chal"));
        showHint = false;
        answerDraft = "";
        setStatus("idle", "Idle");
        const next = CHALLENGES[challengeIdx];
        if (next.setup) next.setup();
        renderChallenge();
      });
    });
  }

  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });

  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setStatus("idle", "Idle");
    const next = CHALLENGES[challengeIdx];
    if (next.setup) next.setup();
    renderChallenge();
  });

  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const got = normalizeAns(answerDraft);
      const want = normalizeAns(ch.answer);
      const alts = (ch.alt || []).map(normalizeAns);
      ok = got === want || alts.includes(got);
    } else {
      ok = !!ch.check();
    }
    if (ok) {
      markCleared(ch.id);
      setStatus("ok", "Cleared");
    } else {
      setStatus("bad", "Not yet");
    }
    renderChallenge();
  });

  loadStarter();
  renderChallenge();
})();
