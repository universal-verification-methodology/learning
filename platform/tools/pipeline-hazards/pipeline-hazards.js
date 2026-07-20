(() => {
  /**
   * Pipeline stall / forward (5-stage sketch)
   *   Stages: IF → ID → EX → MEM → WB
   *   Policies: naive | stall | forward
   *   Scenarios: alu_raw | load_use | independent
   *
   * Classic rules (teaching model):
   *   - ALU→ALU RAW: forwarding from EX/MEM (or MEM/WB) avoids stall
   *   - Load-use: data not ready until after MEM → one stall even with forward
   *   - Naive: read register file only → may use stale value
   */

  const STAGES = ["IF", "ID", "EX", "MEM", "WB"];

  const SCENARIOS = {
    alu_raw: {
      label: "ALU→ALU RAW (ADD then SUB)",
      mem: { 0: 0 },
      regs0: { 1: 5, 2: 3, 3: 0, 4: 0, 5: 1, 6: 0, 7: 0, 8: 0 },
      expect: { 3: 8, 4: 7 },
      prog: [
        { op: "add", rd: 3, rs: 1, rt: 2, text: "ADD R3, R1, R2" },
        { op: "sub", rd: 4, rs: 3, rt: 5, text: "SUB R4, R3, R5" },
      ],
    },
    load_use: {
      label: "Load-use (LW then SUB)",
      mem: { 0: 8 },
      regs0: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 0, 7: 0, 8: 0 },
      expect: { 3: 8, 4: 7 },
      prog: [
        { op: "lw", rd: 3, rs: 1, rt: 0, imm: 0, text: "LW  R3, 0(R1)" },
        { op: "sub", rd: 4, rs: 3, rt: 5, text: "SUB R4, R3, R5" },
      ],
    },
    independent: {
      label: "Independent (no RAW)",
      mem: { 0: 0 },
      regs0: { 1: 2, 2: 3, 3: 4, 4: 0, 5: 5, 6: 0, 7: 0, 8: 0 },
      expect: { 4: 5, 6: 9 },
      prog: [
        { op: "add", rd: 4, rs: 1, rt: 2, text: "ADD R4, R1, R2" },
        { op: "add", rd: 6, rs: 3, rt: 5, text: "ADD R6, R3, R5" },
      ],
    },
  };

  function cloneRegs(r) {
    return { ...r };
  }

  function writesReg(ins) {
    return !!ins && (ins.op === "add" || ins.op === "sub" || ins.op === "lw") && ins.rd > 0;
  }

  function readsRs(ins) {
    return !!ins && ins.op !== "nop" && ins.rs > 0;
  }

  function readsRt(ins) {
    return !!ins && (ins.op === "add" || ins.op === "sub") && ins.rt > 0;
  }

  function instrLabel(slot) {
    if (!slot) return "—";
    if (slot.bubble) return "BUBBLE (nop)";
    return slot.text || "?";
  }

  function makeEmptyPipe() {
    return { IF: null, ID: null, EX: null, MEM: null, WB: null };
  }

  function makeStarter() {
    return resetScenario("alu_raw", "forward");
  }

  function resetScenario(scenario, policy) {
    const sc = SCENARIOS[scenario];
    return {
      scenario,
      policy,
      cycle: 0,
      pc: 0,
      doneFetch: false,
      regs: cloneRegs(sc.regs0),
      mem: { ...sc.mem },
      pipe: makeEmptyPipe(),
      lastHazard: "",
      lastAction: "starter",
      stalledThis: false,
      forwardedThis: false,
      bubbles: 0,
      wrongRead: false,
      finished: false,
      explained: false,
      demoed: false,
      log: [],
      trace: [],
    };
  }

  function pipelineBusy(pipe) {
    return STAGES.some((s) => pipe[s]);
  }

  function sourceCode(policy) {
    if (policy === "naive") {
      return `// Naive: ID reads register file only
// No stall, no forward → RAW may see STALE value
always_ff @(posedge clk) begin
  // pipeline shifts every cycle
end
// EX uses rs_val/rt_val captured in ID (old)`;
    }
    if (policy === "stall") {
      return `// Stall on any RAW with EX/MEM producer
if (raw_with_ex || raw_with_mem) begin
  // hold IF/ID, insert bubble into EX
  stall = 1;
end`;
    }
    return `// Forward + load-use stall
// EX mux: prefer EX/MEM, else MEM/WB, else regfile
if (ex_is_load && id_needs_ex_rd)
  stall = 1;           // load-use: data after MEM
else
  forward from EX/MEM or MEM/WB when rd matches`;
  }

  /** Resolve operand for EX using policy + pipeline producers */
  function resolveOperand(state, which, exIns) {
    const regNum = which === "rs" ? exIns.rs : exIns.rt;
    if (!regNum) return { val: 0, src: "zero" };

    const mem = state.pipe.MEM;
    const wb = state.pipe.WB;
    const policy = state.policy;

    const match = (ins) => writesReg(ins) && !ins.bubble && ins.rd === regNum;

    if (policy === "forward") {
      if (match(mem) && mem.op !== "lw") {
        // ALU result already in EX/MEM (aluResult)
        return { val: mem.aluResult | 0, src: "EX/MEM" };
      }
      if (match(mem) && mem.op === "lw") {
        // shouldn't normally EX-use load in same cycle without prior stall;
        // if we get here, data not ready
        return { val: state.regs[regNum] | 0, src: "stale*" };
      }
      if (match(wb)) {
        const v = wb.op === "lw" ? wb.loadData | 0 : wb.aluResult | 0;
        return { val: v, src: "MEM/WB" };
      }
    }

    // naive / stall (after stalls clear) / forward miss: regfile
    const v = state.regs[regNum] | 0;
    // Detect naive hazard: producer still in flight writing this reg
    if (policy === "naive") {
      if (match(mem) || match(wb) || (match(state.pipe.EX) && state.pipe.EX !== exIns)) {
        state.wrongRead = true;
      }
    }
    return { val: v, src: "RF" };
  }

  function detectControl(state) {
    const id = state.pipe.ID;
    const ex = state.pipe.EX;
    const mem = state.pipe.MEM;
    const wb = state.pipe.WB;
    if (!id || id.bubble) {
      return { stall: false, reason: "", raw: false };
    }

    const needs = [];
    if (readsRs(id)) needs.push(id.rs);
    if (readsRt(id)) needs.push(id.rt);

    const hits = (ins) =>
      writesReg(ins) && !ins.bubble && needs.includes(ins.rd);

    const rawEx = hits(ex);
    const rawMem = hits(mem);
    const rawWb = hits(wb);
    // Stall-only must wait until RF write (through WB); forward can bypass
    const raw = rawEx || rawMem || (state.policy === "stall" && rawWb);

    if (!raw) return { stall: false, reason: "", raw: false };

    if (state.policy === "naive") {
      return {
        stall: false,
        reason: "RAW ignored (naive)",
        raw: rawEx || rawMem || rawWb,
      };
    }

    if (state.policy === "stall") {
      const why = rawEx ? ex : rawMem ? mem : wb;
      return {
        stall: true,
        reason: `stall: RAW with ${rawEx ? "EX" : rawMem ? "MEM" : "WB"} (${why.text})`,
        raw: true,
      };
    }

    // forward: stall only load-use (producer LW currently in EX)
    if (rawEx && ex.op === "lw") {
      return {
        stall: true,
        reason: "load-use stall (LW in EX)",
        raw: true,
      };
    }
    return {
      stall: false,
      reason: "RAW: will forward into EX",
      raw: true,
    };
  }

  function execAlu(op, a, b) {
    if (op === "add") return (a + b) | 0;
    if (op === "sub") return (a - b) | 0;
    return 0;
  }

  function stepPipeline(state) {
    const ctrl = detectControl(state);
    state.stalledThis = ctrl.stall;
    state.forwardedThis = false;
    state.lastHazard = ctrl.reason || (ctrl.raw ? "RAW" : "none");

    // Snapshot current stages
    const cur = {
      IF: state.pipe.IF,
      ID: state.pipe.ID,
      EX: state.pipe.EX,
      MEM: state.pipe.MEM,
      WB: state.pipe.WB,
    };

    // WB writeback (end of prior cycle's WB)
    if (cur.WB && !cur.WB.bubble && writesReg(cur.WB)) {
      if (cur.WB.op === "lw") state.regs[cur.WB.rd] = cur.WB.loadData | 0;
      else state.regs[cur.WB.rd] = cur.WB.aluResult | 0;
    }

    const next = makeEmptyPipe();

    // MEM → WB
    next.WB = cur.MEM
      ? {
          ...cur.MEM,
          // load data available leaving MEM
          loadData:
            cur.MEM.op === "lw"
              ? state.mem[cur.MEM.imm | 0] | 0
              : cur.MEM.loadData,
        }
      : null;

    // EX → MEM (compute EX this cycle if advancing into MEM)
    if (cur.EX && !cur.EX.bubble) {
      const ins = { ...cur.EX };
      if (ins.op === "add" || ins.op === "sub") {
        const a = resolveOperand(state, "rs", ins);
        const b = resolveOperand(state, "rt", ins);
        if (a.src === "EX/MEM" || a.src === "MEM/WB" || b.src === "EX/MEM" || b.src === "MEM/WB") {
          state.forwardedThis = true;
        }
        ins.aluResult = execAlu(ins.op, a.val, b.val);
        ins.fwdNote = `rs=${a.val}@${a.src} rt=${b.val}@${b.src}`;
        pushTrace(
          state,
          `EX ${ins.text}: ${ins.fwdNote} → ${ins.aluResult}`
        );
      } else if (ins.op === "lw") {
        // address = rs + imm (rs from RF/forward)
        const a = resolveOperand(state, "rs", ins);
        ins.aluResult = (a.val + (ins.imm | 0)) | 0;
        ins.fwdNote = `base=${a.val}@${a.src}`;
      }
      next.MEM = ins;
    } else if (cur.EX && cur.EX.bubble) {
      next.MEM = { ...cur.EX };
    } else {
      next.MEM = null;
    }

    if (ctrl.stall) {
      // hold IF/ID, bubble into EX
      next.ID = cur.ID;
      next.IF = cur.IF;
      next.EX = { bubble: true, text: "nop", op: "nop", rd: 0, rs: 0, rt: 0 };
      state.bubbles += 1;
      pushTrace(state, `c${state.cycle}: STALL — ${ctrl.reason}`);
    } else {
      next.EX = cur.ID;
      next.ID = cur.IF;
      // fetch
      const sc = SCENARIOS[state.scenario];
      if (state.pc < sc.prog.length) {
        const fetched = { ...sc.prog[state.pc] };
        next.IF = fetched;
        state.pc += 1;
      } else {
        next.IF = null;
        state.doneFetch = true;
      }
      if (ctrl.raw && state.policy === "forward") {
        pushTrace(state, `c${state.cycle}: advance (forward path armed)`);
      } else if (ctrl.raw && state.policy === "naive") {
        pushTrace(state, `c${state.cycle}: advance NAIVE — stale RF risk`);
      } else {
        pushTrace(state, `c${state.cycle}: advance`);
      }
    }

    state.pipe = next;
    state.cycle += 1;

    if (!pipelineBusy(state.pipe) && state.doneFetch) {
      state.finished = true;
    }

    // correctness snapshot vs expect when finished
    state.lastAction = "step";
  }

  function resultsCorrect(state) {
    const exp = SCENARIOS[state.scenario].expect;
    return Object.keys(exp).every((k) => (state.regs[k] | 0) === exp[k]);
  }

  function pushTrace(state, line) {
    state.trace = [...state.trace.slice(-40), line];
  }

  function pushLog(state, line) {
    state.log = [...state.log.slice(-40), line];
  }

  function runUntilDone(state, max = 24) {
    let guard = max;
    while (!state.finished && guard--) stepPipeline(state);
  }

  function explainText(state) {
    const sc = state.scenario;
    if (sc === "alu_raw") {
      return `ALU→ALU RAW: ADD writes R3; SUB reads R3 next.
With forwarding, EX of SUB takes R3 from EX/MEM of ADD — no bubble.
Stall-only inserts bubbles until ADD reaches WB/RF.
Naive may compute SUB with R3=0 (stale).`;
    }
    if (sc === "load_use") {
      return `Load-use: LW data appears only after MEM.
Even with forwarding you need one stall while LW is in EX;
then MEM/WB (or EX/MEM load data path) can forward into SUB's EX.`;
    }
    return `Independent: different destination/source regs — no RAW.
Policy should not insert bubbles; both ADDs complete cleanly.`;
  }

  const CLEARED_KEY = "ddv-pipeline-hazards-cleared-v1";
  const STORE_KEY = "ddv-pipeline-hazards-session-v1";

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
  let quizChoice = "";

  let state = makeStarter();

  const root = document.getElementById("ph-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> ALU→ALU RAW with <code>forward</code> —
        <code>ADD R3,R1,R2</code> then <code>SUB R4,R3,R5</code>. Step until done;
        R3=8, R4=7 with no (or minimal) bubbles.</p>
      <button type="button" class="btn btn-secondary" id="ph-starter">Load starter example</button>
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
        <div class="idea-card">
          <h3>RAW hazard</h3>
          <p>Consumer reads a reg before the producer writes it back.</p>
        </div>
        <div class="idea-card">
          <h3>Stall</h3>
          <p>Hold IF/ID and insert a bubble into EX until safe.</p>
        </div>
        <div class="idea-card">
          <h3>Forward</h3>
          <p>Bypass from EX/MEM or MEM/WB into EX muxes; load-use still stalls.</p>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <div class="panel-head"><h2>Lab</h2></div>
      <div class="ph-controls">
        <div class="ph-field">
          <label for="sel-scenario">Scenario</label>
          <select id="sel-scenario">
            <option value="alu_raw">ALU→ALU RAW</option>
            <option value="load_use">Load-use</option>
            <option value="independent">Independent</option>
          </select>
        </div>
        <div class="ph-field">
          <label for="sel-policy">Policy</label>
          <select id="sel-policy">
            <option value="forward">Forward (+ load-use stall)</option>
            <option value="stall">Stall only</option>
            <option value="naive">Naive (no fix)</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" id="btn-step">Step cycle</button>
        <button type="button" class="btn btn-ghost" id="btn-run">Run to end</button>
        <button type="button" class="btn btn-ghost" id="btn-demo">Demo starter</button>
        <button type="button" class="btn btn-ghost" id="btn-explain">Explain</button>
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset</button>
      </div>
      <div id="verdict" class="verdict idle">Idle</div>
      <div class="flag-row" id="flag-row"></div>
      <div class="pipe-row" id="pipe-row"></div>
      <div class="panel" style="margin:0.75rem 0;padding:0.65rem;border:1px solid var(--line);border-radius:8px">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Program</h3>
        <ol class="instr-list" id="instr-list"></ol>
      </div>
      <div class="panel" style="margin:0.75rem 0;padding:0.65rem;border:1px solid var(--line);border-radius:8px">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem">Registers</h3>
        <div class="regs" id="regs"></div>
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

  const selScenario = /** @type {HTMLSelectElement} */ (document.getElementById("sel-scenario"));
  const selPolicy = /** @type {HTMLSelectElement} */ (document.getElementById("sel-policy"));

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function applyScenarioPolicy(scenario, policy, action) {
    state = resetScenario(scenario, policy);
    state.lastAction = action || "reset";
    selScenario.value = scenario;
    selPolicy.value = policy;
    pushLog(state, `# ${scenario} / ${policy}`);
    renderAll();
  }

  function loadStarter() {
    applyScenarioPolicy("alu_raw", "forward", "starter");
    pushTrace(state, "starter: ALU RAW + forward");
    renderAll();
  }

  function renderLab() {
    selScenario.value = state.scenario;
    selPolicy.value = state.policy;

    const correct = state.finished && resultsCorrect(state);
    const wrong = state.finished && !resultsCorrect(state);
    const v = document.getElementById("verdict");
    if (!state.finished) {
      v.className = "verdict idle";
      v.textContent = `cycle ${state.cycle} · ${state.lastHazard || "warming up"} · step until pipe drains`;
    } else if (correct) {
      v.className = "verdict yes";
      v.textContent = `DONE — regs match expect (bubbles=${state.bubbles})`;
    } else {
      v.className = "verdict no";
      v.textContent = `DONE — WRONG regs (naive RAW?) bubbles=${state.bubbles}`;
    }

    document.getElementById("flag-row").innerHTML = `
      <span class="flag ${state.stalledThis ? "is-on" : ""}">stall=${state.stalledThis ? 1 : 0}</span>
      <span class="flag ${state.forwardedThis ? "is-ok" : ""}">fwd_ex=${state.forwardedThis ? 1 : 0}</span>
      <span class="flag">bubbles=${state.bubbles}</span>
      <span class="flag ${state.finished ? (correct ? "is-ok" : "is-bad") : ""}">finished=${state.finished ? 1 : 0}</span>
      <span class="flag">${state.lastHazard || "hazard: —"}</span>
    `;

    const ctrl = detectControl(state);
    document.getElementById("pipe-row").innerHTML = STAGES.map((s) => {
      const slot = state.pipe[s];
      const bubble = slot && slot.bubble;
      const haz = s === "ID" && ctrl.raw;
      const fwd = s === "EX" && state.forwardedThis;
      const cls = ["stage", bubble ? "is-bubble" : "", haz ? "is-hazard" : "", fwd ? "is-fwd" : ""]
        .filter(Boolean)
        .join(" ");
      return `<div class="${cls}"><h3>${s}</h3><div class="slot">${instrLabel(slot)}${
        slot && slot.fwdNote ? `<div>${slot.fwdNote}</div>` : ""
      }${slot && slot.aluResult !== undefined && !bubble ? `<div>alu=${slot.aluResult}</div>` : ""}</div></div>`;
    }).join("");

    const sc = SCENARIOS[state.scenario];
    document.getElementById("instr-list").innerHTML = sc.prog
      .map((p, i) => {
        const active = state.pc - 1 === i || Object.values(state.pipe).some((x) => x && x.text === p.text && !x.bubble);
        const done = state.finished || state.pc > i + 1;
        return `<li class="${active ? "is-active" : ""} ${done && !active ? "is-done" : ""}">${p.text}</li>`;
      })
      .join("");

    const hot = new Set(Object.keys(sc.expect).map(Number));
    document.getElementById("regs").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((r) => {
        const exp = sc.expect[r];
        const mark = exp !== undefined ? ` (exp ${exp})` : "";
        return `<span class="reg ${hot.has(r) ? "is-hot" : ""}">R${r}=${state.regs[r] | 0}${mark}</span>`;
      })
      .join("");

    document.getElementById("code-box").textContent = sourceCode(state.policy);
    document.getElementById("trace-box").textContent = state.trace.length
      ? state.trace.join("\n")
      : "// no cycles yet";
    document.getElementById("log-box").textContent = state.log.length
      ? state.log.join("\n")
      : "// idle";

    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          scenario: state.scenario,
          policy: state.policy,
          cycle: state.cycle,
          finished: state.finished,
        })
      );
    } catch {
      /* ignore */
    }
  }

  const CHALLENGES = [
    {
      id: "quiz-raw",
      title: "Quiz: RAW",
      type: "quiz",
      prompt: "A RAW data hazard means…",
      hint: "Read after write.",
      choices: [
        "an instruction reads a register before an earlier write has completed",
        "two writes target the same reg in one cycle only",
        "the clock is gated",
        "I-cache missed",
      ],
      answer: "an instruction reads a register before an earlier write has completed",
    },
    {
      id: "quiz-stall",
      title: "Quiz: stall",
      type: "quiz",
      prompt: "Inserting a bubble / stall typically…",
      hint: "Hold younger instrs.",
      choices: [
        "holds IF/ID and feeds a nop into EX so the producer can advance",
        "deletes the producer instruction",
        "disables forwarding forever",
        "flushes the register file",
      ],
      answer: "holds IF/ID and feeds a nop into EX so the producer can advance",
    },
    {
      id: "quiz-fwd",
      title: "Quiz: forward",
      type: "quiz",
      prompt: "Forwarding (bypassing)…",
      hint: "Mux from later stages.",
      choices: [
        "routes a producer’s result from EX/MEM or MEM/WB into EX inputs early",
        "always removes the need for every stall including load-use",
        "is the same as branch prediction",
        "only works for stores",
      ],
      answer: "routes a producer’s result from EX/MEM or MEM/WB into EX inputs early",
    },
    {
      id: "quiz-loaduse",
      title: "Quiz: load-use",
      type: "quiz",
      prompt: "Classic load-use hazard needs a stall even with forwarding because…",
      hint: "Data after MEM.",
      choices: [
        "load data is not available until after the MEM stage",
        "loads never write registers",
        "ALU results are slower than loads",
        "the PC cannot increment",
      ],
      answer: "load data is not available until after the MEM stage",
    },
    {
      id: "starter",
      title: "Starter",
      prompt: "Load starter — ALU RAW + forward.",
      hint: "Load starter example",
      setup: () => loadStarter(),
      check: () => state.lastAction === "starter" && state.scenario === "alu_raw" && state.policy === "forward",
    },
    {
      id: "step1",
      title: "Step once",
      prompt: "From starter, Step cycle at least once.",
      hint: "Step cycle",
      setup: () => loadStarter(),
      check: () => state.cycle >= 1 && state.lastAction === "step",
    },
    {
      id: "policy-fwd",
      title: "Select forward",
      prompt: "Set policy to Forward.",
      hint: "Policy dropdown",
      setup: () => applyScenarioPolicy("alu_raw", "stall", "setup"),
      check: () => state.policy === "forward",
    },
    {
      id: "policy-stall",
      title: "Select stall",
      prompt: "Set policy to Stall only.",
      hint: "Policy dropdown",
      setup: () => applyScenarioPolicy("alu_raw", "forward", "setup"),
      check: () => state.policy === "stall",
    },
    {
      id: "policy-naive",
      title: "Select naive",
      prompt: "Set policy to Naive.",
      hint: "Policy dropdown",
      setup: () => applyScenarioPolicy("alu_raw", "forward", "setup"),
      check: () => state.policy === "naive",
    },
    {
      id: "sc-load",
      title: "Load-use scenario",
      prompt: "Switch scenario to Load-use.",
      hint: "Scenario dropdown",
      setup: () => applyScenarioPolicy("alu_raw", "forward", "setup"),
      check: () => state.scenario === "load_use",
    },
    {
      id: "sc-indep",
      title: "Independent scenario",
      prompt: "Switch scenario to Independent.",
      hint: "Scenario dropdown",
      setup: () => applyScenarioPolicy("alu_raw", "forward", "setup"),
      check: () => state.scenario === "independent",
    },
    {
      id: "run-fwd-alu",
      title: "Run forward ALU",
      prompt: "ALU RAW + forward → Run to end with correct regs.",
      hint: "Demo or Run to end",
      setup: () => applyScenarioPolicy("alu_raw", "forward", "setup"),
      check: () =>
        state.scenario === "alu_raw" &&
        state.policy === "forward" &&
        state.finished &&
        resultsCorrect(state),
    },
    {
      id: "run-stall-alu",
      title: "Run stall ALU",
      prompt: "ALU RAW + stall → finish correct; expect bubbles &gt; 0.",
      hint: "Stall only, Run to end",
      setup: () => applyScenarioPolicy("alu_raw", "stall", "setup"),
      check: () =>
        state.scenario === "alu_raw" &&
        state.policy === "stall" &&
        state.finished &&
        resultsCorrect(state) &&
        state.bubbles > 0,
    },
    {
      id: "run-naive-wrong",
      title: "Naive goes wrong",
      prompt: "ALU RAW + naive → Run to end; result should be WRONG.",
      hint: "Naive policy, Run to end",
      setup: () => applyScenarioPolicy("alu_raw", "naive", "setup"),
      check: () =>
        state.scenario === "alu_raw" &&
        state.policy === "naive" &&
        state.finished &&
        !resultsCorrect(state),
    },
    {
      id: "run-load-fwd",
      title: "Load-use + forward",
      prompt: "Load-use + forward → finish correct with at least one bubble.",
      hint: "Load-use scenario, forward, Run",
      setup: () => applyScenarioPolicy("load_use", "forward", "setup"),
      check: () =>
        state.scenario === "load_use" &&
        state.policy === "forward" &&
        state.finished &&
        resultsCorrect(state) &&
        state.bubbles >= 1,
    },
    {
      id: "run-indep",
      title: "Independent clean",
      prompt: "Independent + forward → finish correct with 0 bubbles.",
      hint: "Independent scenario",
      setup: () => applyScenarioPolicy("independent", "forward", "setup"),
      check: () =>
        state.scenario === "independent" &&
        state.finished &&
        resultsCorrect(state) &&
        state.bubbles === 0,
    },
    {
      id: "demo",
      title: "Demo",
      prompt: "Click Demo starter.",
      hint: "Demo starter",
      setup: () => loadStarter(),
      check: () => state.demoed === true && state.finished,
    },
    {
      id: "explain",
      title: "Explain",
      prompt: "Click Explain.",
      hint: "Explain button",
      setup: () => loadStarter(),
      check: () => state.explained === true,
    },
    {
      id: "code-fwd",
      title: "Sketch forward",
      prompt: "With forward policy, sketch mentions load-use stall.",
      hint: "Select Forward — read Sketch",
      setup: () => applyScenarioPolicy("alu_raw", "forward", "setup"),
      check: () => state.policy === "forward" && /load-use/i.test(sourceCode(state.policy)),
    },
    {
      id: "reset",
      title: "Reset",
      prompt: "Reset back to empty pipe (cycle 0).",
      hint: "Reset",
      setup: () => {
        applyScenarioPolicy("alu_raw", "forward", "setup");
        stepPipeline(state);
        renderAll();
      },
      check: () => state.cycle === 0 && state.lastAction === "reset",
    },
    {
      id: "bubble-count",
      title: "Bubble count",
      prompt: "On ALU+stall finished run, bubbles ≥ 2 (RF wait).",
      hint: "Stall policy needs more bubbles than forward",
      setup: () => applyScenarioPolicy("alu_raw", "stall", "setup"),
      check: () =>
        state.policy === "stall" && state.finished && state.bubbles >= 2 && resultsCorrect(state),
    },
    {
      id: "compare-bubbles",
      title: "Forward fewer stalls",
      prompt: "Finish ALU+forward with bubbles = 0.",
      hint: "Forward should avoid ALU-ALU stall",
      setup: () => applyScenarioPolicy("alu_raw", "forward", "setup"),
      check: () =>
        state.policy === "forward" &&
        state.scenario === "alu_raw" &&
        state.finished &&
        resultsCorrect(state) &&
        state.bubbles === 0,
    },
  ];

  function renderChallenge() {
    const ch = CHALLENGES[challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = showHint ? "Hide hint" : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    const ansRow = document.getElementById("chal-answer-row");
    if (ch.type === "quiz") {
      ansRow.innerHTML = "";
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label style="display:block;margin:0.25rem 0"><input type="radio" name="ph-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
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
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        challengeIdx = i;
        showHint = false;
        quizChoice = "";
        answerDraft = "";
        setChalStatus("idle", "Idle");
        if (typeof CHALLENGES[i].setup === "function") CHALLENGES[i].setup();
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("ph-starter").addEventListener("click", loadStarter);
  document.getElementById("btn-step").addEventListener("click", () => {
    if (state.finished) {
      pushLog(state, "# already finished — reset");
      renderAll();
      return;
    }
    stepPipeline(state);
    pushLog(state, `# step c=${state.cycle}`);
    renderAll();
  });
  document.getElementById("btn-run").addEventListener("click", () => {
    runUntilDone(state);
    state.lastAction = "run";
    pushLog(state, `# run finished=${state.finished} ok=${resultsCorrect(state)}`);
    renderAll();
  });
  document.getElementById("btn-demo").addEventListener("click", () => {
    applyScenarioPolicy("alu_raw", "forward", "demo");
    runUntilDone(state);
    state.demoed = true;
    state.lastAction = "demo";
    pushLog(state, "# demo complete");
    renderAll();
  });
  document.getElementById("btn-explain").addEventListener("click", () => {
    state.explained = true;
    state.lastAction = "explain";
    pushTrace(state, explainText(state));
    pushLog(state, "# explain");
    renderAll();
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    applyScenarioPolicy(state.scenario, state.policy, "reset");
  });
  selScenario.addEventListener("change", () => {
    applyScenarioPolicy(selScenario.value, state.policy, "scenario");
  });
  selPolicy.addEventListener("change", () => {
    applyScenarioPolicy(state.scenario, selPolicy.value, "policy");
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
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = quizChoice === ch.answer;
    else ok = !!ch.check();
    if (ok) {
      if (!clearedIds.includes(ch.id)) {
        clearedIds = [...clearedIds, ch.id];
        try {
          localStorage.setItem(CLEARED_KEY, JSON.stringify(clearedIds));
        } catch {
          /* ignore */
        }
      }
      setChalStatus("pass", "Pass");
      renderChallenge();
    } else setChalStatus("fail", "Not yet");
  });

  // Boot: starter (ignore partial session beyond scenario hint)
  loadStarter();
})();
