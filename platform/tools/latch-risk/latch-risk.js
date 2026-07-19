(() => {
  const STORAGE_KEY = "ddv-latch-risk-v1";
  const CLEARED_KEY = "ddv-latch-risk-cleared-v1";

  /**
   * Each scenario has styles. Interactive styles expose toggles that flip latch risk.
   * latch: true means inferred latch (incomplete combo assignment).
   */
  const SCENARIOS = [
    {
      id: "mux21",
      title: "2:1 mux",
      intent: "Y = S ? D1 : D0",
      styles: [
        {
          id: "assign",
          label: "assign",
          latch: false,
          reason: "Continuous assign is purely combinational — no storage.",
          code: `assign Y = S ? D1 : D0;`,
        },
        {
          id: "always-full",
          label: "always complete",
          latch: false,
          reason: "Both branches of if/else assign Y under @(*).",
          code: `always @(*) begin
  if (S) Y = D1;
  else   Y = D0;
end`,
        },
        {
          id: "always-incomplete",
          label: "always incomplete",
          latch: true,
          reason: "When S=0, Y is not assigned → holds prior value (latch).",
          code: `always @(*) begin
  if (S) Y = D1;
  // missing else → latch on Y
end`,
        },
        {
          id: "case-default",
          label: "case + default",
          latch: false,
          interactive: "case",
          reason: "All select values covered (or default assigns Y).",
          build(opts) {
            if (opts.defaultOn) {
              return {
                latch: false,
                reason: "default assigns Y for unused encodings.",
                code: `always @(*) begin
  case (S)
    1'b0: Y = D0;
    1'b1: Y = D1;
    default: Y = 1'b0;
  endcase
end`,
              };
            }
            return {
              latch: false,
              reason: "Both 0 and 1 of S assign Y — complete for 1-bit S.",
              code: `always @(*) begin
  case (S)
    1'b0: Y = D0;
    1'b1: Y = D1;
  endcase
end`,
            };
          },
        },
      ],
    },
    {
      id: "priority-if",
      title: "Priority if-chain",
      intent: "Y = I1 ? A : (I0 ? B : 0)",
      styles: [
        {
          id: "assign",
          label: "assign",
          latch: false,
          reason: "Single continuous expression — combo.",
          code: `assign Y = I1 ? A : (I0 ? B : 1'b0);`,
        },
        {
          id: "if-else-full",
          label: "if/else full",
          latch: false,
          reason: "Final else assigns a constant — every path writes Y.",
          code: `always @(*) begin
  if (I1)      Y = A;
  else if (I0) Y = B;
  else         Y = 1'b0;
end`,
        },
        {
          id: "if-no-else",
          label: "if no final else",
          latch: true,
          interactive: "else",
          reason: "No assignment when I1=I0=0 → latch.",
          build(opts) {
            if (opts.elseOn) {
              return {
                latch: false,
                reason: "Final else covers the remaining input space.",
                code: `always @(*) begin
  if (I1)      Y = A;
  else if (I0) Y = B;
  else         Y = 1'b0;
end`,
              };
            }
            return {
              latch: true,
              reason: "When both I1 and I0 are 0, Y keeps its old value.",
              code: `always @(*) begin
  if (I1)      Y = A;
  else if (I0) Y = B;
  // no else → latch
end`,
            };
          },
        },
      ],
    },
    {
      id: "dec24",
      title: "2→4 one-hot",
      intent: "Decode addr to Y[3:0]",
      styles: [
        {
          id: "assign-oh",
          label: "assign shift",
          latch: false,
          reason: "Y = 4'b0001 << addr is continuous combo.",
          code: `assign Y = 4'b0001 << addr;`,
        },
        {
          id: "case-full",
          label: "case all + default",
          latch: false,
          reason: "Every addr + default assigns all bits of Y.",
          code: `always @(*) begin
  case (addr)
    2'b00: Y = 4'b0001;
    2'b01: Y = 4'b0010;
    2'b10: Y = 4'b0100;
    2'b11: Y = 4'b1000;
    default: Y = 4'b0000;
  endcase
end`,
        },
        {
          id: "case-partial",
          label: "case partial",
          latch: true,
          interactive: "default",
          reason: "Missing arms without default leave Y unchanged for those addr.",
          build(opts) {
            if (opts.defaultOn) {
              return {
                latch: false,
                reason: "default clears Y for unused/illegal codes.",
                code: `always @(*) begin
  case (addr)
    2'b00: Y = 4'b0001;
    2'b01: Y = 4'b0010;
    // 10/11 fall to default
    default: Y = 4'b0000;
  endcase
end`,
              };
            }
            return {
              latch: true,
              reason: "addr=10 or 11 never assign Y → latch (or X in sim).",
              code: `always @(*) begin
  case (addr)
    2'b00: Y = 4'b0001;
    2'b01: Y = 4'b0010;
    // missing 10, 11 and no default → latch
  endcase
end`,
            };
          },
        },
      ],
    },
    {
      id: "enable-gate",
      title: "Enabled passthrough",
      intent: "When EN, Y=D; else Y should be 0 (combo)",
      styles: [
        {
          id: "assign-en",
          label: "assign AND",
          latch: false,
          reason: "Y = EN & D is combo gating.",
          code: `assign Y = EN & D;`,
        },
        {
          id: "if-en-else",
          label: "if EN else 0",
          latch: false,
          reason: "else drives Y to 0 — transparent combo.",
          code: `always @(*) begin
  if (EN) Y = D;
  else    Y = 1'b0;
end`,
        },
        {
          id: "if-en-only",
          label: "if EN only",
          latch: true,
          interactive: "else",
          reason: "Classic accidental latch: “update only when enable”.",
          build(opts) {
            if (opts.elseOn) {
              return {
                latch: false,
                reason: "else assigns — no hold.",
                code: `always @(*) begin
  if (EN) Y = D;
  else    Y = 1'b0;
end`,
              };
            }
            return {
              latch: true,
              reason: "EN=0 does not assign Y → level-sensitive latch on EN.",
              code: `always @(*) begin
  if (EN) Y = D;
  // intended flop enable, but @(*) + no else → LATCH
end`,
            };
          },
        },
      ],
    },
  ];

  function resolveStyle(scenario, style, opts) {
    if (style.build) {
      const built = style.build(opts);
      return { ...style, ...built };
    }
    return style;
  }

  const CHALLENGES = [
    {
      id: "quiz-what-latch",
      title: "Quiz: what is a latch?",
      type: "quiz",
      prompt: "In this lab, an inferred latch means…",
      hint: "Incomplete combo assignment.",
      choices: [
        "Y keeps its previous value when not assigned in @(*)",
        "a flip-flop with a clock",
        "only a NAND-gate SR cell in the library",
        "an always_ff mistake only",
      ],
      answer: "Y keeps its previous value when not assigned in @(*)",
    },
    {
      id: "quiz-assign-safe",
      title: "Quiz: assign",
      type: "quiz",
      prompt: "A continuous assign for Y is typically…",
      hint: "No sequential storage.",
      choices: ["latch-free combinational", "always a latch", "always a flop", "illegal in SV"],
      answer: "latch-free combinational",
    },
    {
      id: "quiz-missing-else",
      title: "Quiz: missing else",
      type: "quiz",
      prompt: "always @(*) if (EN) Y=D; with no else usually…",
      hint: "Enable-looking code.",
      choices: ["infers a latch on Y", "infers a posedge flop", "is ignored by synth", "forces Y=X always"],
      answer: "infers a latch on Y",
    },
    {
      id: "quiz-case-default",
      title: "Quiz: case default",
      type: "quiz",
      prompt: "A full case with default that assigns Y is…",
      hint: "Every path writes.",
      choices: ["combinational (no latch)", "a latch", "a flop", "unsynthesizable"],
      answer: "combinational (no latch)",
    },
    {
      id: "quiz-partial-case",
      title: "Quiz: partial case",
      type: "quiz",
      prompt: "case with only some values and no default typically…",
      hint: "Uncovered labels.",
      choices: ["risks a latch (or X)", "is always safer than assign", "creates a PLL", "forces combo XOR"],
      answer: "risks a latch (or X)",
    },
    {
      id: "quiz-star",
      title: "Quiz: @(*)",
      type: "quiz",
      prompt: "@(*) alone guarantees…",
      hint: "Sensitivity ≠ completeness.",
      choices: [
        "automatic sensitivity — not complete assignments",
        "no latches ever",
        "a clocked process",
        "blocking vs non-blocking rules",
      ],
      answer: "automatic sensitivity — not complete assignments",
    },
    {
      id: "pick-mux-bad",
      title: "Pick: mux latch",
      type: "pick-style",
      prompt: "On 2:1 mux, which style has latch risk?",
      hint: "Incomplete if.",
      scenario: "mux21",
      answerStyle: "always-incomplete",
    },
    {
      id: "pick-mux-good",
      title: "Pick: mux safe",
      type: "pick-style",
      prompt: "On 2:1 mux, which is the continuous-assign style?",
      hint: "assign keyword.",
      scenario: "mux21",
      answerStyle: "assign",
    },
    {
      id: "run-fix-else",
      title: "Fix: enable else",
      type: "run",
      prompt: "Enabled passthrough: turn on “Add else / default” so the if-EN-only style becomes latch-free.",
      hint: "Scenario Enabled passthrough · style if EN only · toggle else.",
      scenario: "enable-gate",
      style: "if-en-only",
      needElse: true,
      check: (s, resolved) => s.scenarioId === "enable-gate" && s.styleId === "if-en-only" && s.elseOn && !resolved.latch,
    },
    {
      id: "run-fix-default",
      title: "Fix: case default",
      type: "run",
      prompt: "2→4 decode partial case: enable default so latch risk clears.",
      hint: "Scenario 2→4 · case partial · Add else/default.",
      scenario: "dec24",
      style: "case-partial",
      needDefault: true,
      check: (s, resolved) => s.scenarioId === "dec24" && s.styleId === "case-partial" && s.defaultOn && !resolved.latch,
    },
    {
      id: "run-see-risk",
      title: "See: priority latch",
      type: "run",
      prompt: "Priority if-chain: select “if no final else” with else OFF — verdict must be latch risk.",
      hint: "Leave Add else unchecked.",
      scenario: "priority-if",
      style: "if-no-else",
      check: (s, resolved) => s.scenarioId === "priority-if" && s.styleId === "if-no-else" && !s.elseOn && resolved.latch,
    },
    {
      id: "run-priority-fix",
      title: "Fix: priority else",
      type: "run",
      prompt: "Same priority style — turn else ON until verdict is combo OK.",
      hint: "Toggle Add else.",
      scenario: "priority-if",
      style: "if-no-else",
      check: (s, resolved) => s.scenarioId === "priority-if" && s.styleId === "if-no-else" && s.elseOn && !resolved.latch,
    },
    {
      id: "pick-en-bad",
      title: "Pick: enable latch",
      type: "pick-style",
      prompt: "Enabled passthrough — which style is the classic accidental latch?",
      hint: "if EN only.",
      scenario: "enable-gate",
      answerStyle: "if-en-only",
    },
    {
      id: "pick-dec-partial",
      title: "Pick: partial decode",
      type: "pick-style",
      prompt: "2→4 one-hot — which style starts with latch risk before default?",
      hint: "case partial.",
      scenario: "dec24",
      answerStyle: "case-partial",
    },
    {
      id: "quiz-intent-flop",
      title: "Quiz: meant a flop?",
      type: "quiz",
      prompt: "If you meant a register enable, you should use…",
      hint: "Clocked always.",
      choices: ["always_ff @(posedge clk) if (EN) Y <= D;", "always @(*) if (EN) Y = D;", "assign Y = EN;", "case without default"],
      answer: "always_ff @(posedge clk) if (EN) Y <= D;",
    },
    {
      id: "quiz-both-paths",
      title: "Quiz: complete if",
      type: "quiz",
      prompt: "To keep combo if/else latch-free, every path must…",
      hint: "Assign the LHS.",
      choices: ["assign the output", "omit the else", "use only non-blocking", "drop @(*)"],
      answer: "assign the output",
    },
    {
      id: "run-mux-incomplete",
      title: "See: mux incomplete",
      type: "run",
      prompt: "2:1 mux · always incomplete — confirm latch risk verdict.",
      hint: "Select that style.",
      scenario: "mux21",
      style: "always-incomplete",
      check: (s, resolved) => s.scenarioId === "mux21" && s.styleId === "always-incomplete" && resolved.latch,
    },
    {
      id: "run-mux-assign",
      title: "See: mux assign OK",
      type: "run",
      prompt: "2:1 mux · assign — confirm combo OK.",
      hint: "assign style.",
      scenario: "mux21",
      style: "assign",
      check: (s, resolved) => s.scenarioId === "mux21" && s.styleId === "assign" && !resolved.latch,
    },
    {
      id: "quiz-full-case",
      title: "Quiz: full_case",
      type: "quiz",
      prompt: "Synth “full_case” pragmas are risky because…",
      hint: "They can hide incompleteness.",
      choices: [
        "they tell tools to assume completeness even if RTL isn’t",
        "they insert clocks",
        "they ban assign",
        "they force latches on purpose",
      ],
      answer: "they tell tools to assume completeness even if RTL isn’t",
    },
    {
      id: "quiz-compare",
      title: "Quiz: same function",
      type: "quiz",
      prompt: "assign vs complete always @(*) for the same mux should…",
      hint: "Both combo.",
      choices: ["both be latch-free", "always differ in Y", "one must latch", "forbid simulation"],
      answer: "both be latch-free",
    },
    {
      id: "pick-priority-full",
      title: "Pick: priority safe",
      type: "pick-style",
      prompt: "Priority if-chain — pick the fully elsed style.",
      hint: "if/else full.",
      scenario: "priority-if",
      answerStyle: "if-else-full",
    },
    {
      id: "run-dec-assign",
      title: "See: decode assign",
      type: "run",
      prompt: "2→4 · assign shift — combo OK.",
      hint: "assign shift style.",
      scenario: "dec24",
      style: "assign-oh",
      check: (s, resolved) => s.scenarioId === "dec24" && s.styleId === "assign-oh" && !resolved.latch,
    },
  ];

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const state = {
    scenarioId: "mux21",
    styleId: "assign",
    elseOn: false,
    defaultOn: false,
    challengeIdx: 0,
    showHint: false,
    quizChoice: "",
    pickStyle: "",
  };

  function scenario() {
    return SCENARIOS.find((s) => s.id === state.scenarioId) || SCENARIOS[0];
  }

  function styleMeta() {
    const sc = scenario();
    return sc.styles.find((s) => s.id === state.styleId) || sc.styles[0];
  }

  function opts() {
    return { elseOn: state.elseOn, defaultOn: state.defaultOn };
  }

  function currentResolved() {
    return resolveStyle(scenario(), styleMeta(), opts());
  }

  function loadStarter() {
    state.scenarioId = "mux21";
    state.styleId = "assign";
    state.elseOn = false;
    state.defaultOn = false;
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scenarioId: state.scenarioId,
          styleId: state.styleId,
          elseOn: state.elseOn,
          defaultOn: state.defaultOn,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!SCENARIOS.some((s) => s.id === d.scenarioId)) return false;
      state.scenarioId = d.scenarioId;
      state.styleId = d.styleId;
      state.elseOn = !!d.elseOn;
      state.defaultOn = !!d.defaultOn;
      const sc = scenario();
      if (!sc.styles.some((s) => s.id === state.styleId)) state.styleId = sc.styles[0].id;
      return true;
    } catch {
      return false;
    }
  }

  const root = document.getElementById("lr-root");
  root.innerHTML = `
    <p class="starter-note" id="starter-note"></p>
    <div class="challenge">
      <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div id="chal-quiz" class="quiz-choices" hidden></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <button type="button" class="btn btn-ghost" id="chal-load">Load challenge setup</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>Style explorer</h2>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="lr-controls">
          <div class="lr-field">
            <label for="sc-sel">Function</label>
            <select id="sc-sel"></select>
          </div>
        </div>
        <p class="lr-meta" id="intent"></p>
        <div class="style-tabs" id="style-tabs"></div>
        <div class="toggle-row" id="toggles"></div>
        <div id="verdict"></div>
        <pre class="code-block" id="code"></pre>
        <p class="lr-meta" id="reason"></p>
        <div class="compare-grid" id="compare"></div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function renderLab() {
    const sc = scenario();
    if (!sc.styles.some((s) => s.id === state.styleId)) state.styleId = sc.styles[0].id;
    const resolved = currentResolved();
    const meta = styleMeta();

    document.getElementById("starter-note").textContent =
      "Starter example: 2:1 mux as assign (combo OK). Switch to “always incomplete” to see latch risk.";
    document.getElementById("intent").textContent = `Intent: ${sc.intent}`;

    const sel = document.getElementById("sc-sel");
    sel.innerHTML = SCENARIOS.map((s) => `<option value="${s.id}">${s.title}</option>`).join("");
    sel.value = state.scenarioId;

    const tabs = document.getElementById("style-tabs");
    tabs.innerHTML = "";
    sc.styles.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      if (s.id === state.styleId) b.classList.add("active");
      b.addEventListener("click", () => {
        state.styleId = s.id;
        saveSession();
        renderAll();
      });
      tabs.appendChild(b);
    });

    const toggles = document.getElementById("toggles");
    toggles.innerHTML = "";
    if (meta.interactive === "else" || meta.interactive === "case" || meta.interactive === "default") {
      if (meta.interactive === "else") {
        toggles.innerHTML = `<label><input type="checkbox" id="tog-else" ${state.elseOn ? "checked" : ""}> Add else (complete assignment)</label>`;
        document.getElementById("tog-else").addEventListener("change", (e) => {
          state.elseOn = e.target.checked;
          saveSession();
          renderAll();
        });
      } else {
        toggles.innerHTML = `<label><input type="checkbox" id="tog-def" ${state.defaultOn ? "checked" : ""}> Add else / default</label>`;
        document.getElementById("tog-def").addEventListener("change", (e) => {
          state.defaultOn = e.target.checked;
          saveSession();
          renderAll();
        });
      }
    }

    document.getElementById("verdict").innerHTML = resolved.latch
      ? `<div class="verdict risk">Latch risk</div>`
      : `<div class="verdict ok">Combo OK</div>`;
    document.getElementById("code").textContent = resolved.code;
    document.getElementById("reason").textContent = resolved.reason;

    const compare = document.getElementById("compare");
    compare.innerHTML = sc.styles
      .map((s) => {
        const r = resolveStyle(sc, s, opts());
        return `<div class="compare-card ${r.latch ? "risk" : "ok"}">
          <h3>${s.label} · ${r.latch ? "LATCH" : "OK"}</h3>
          <pre class="code-block" style="font-size:0.75rem;padding:0.5rem">${r.code.replace(/</g, "&lt;")}</pre>
        </div>`;
      })
      .join("");
  }

  function renderChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    const cleared = clearedIds.filter((id) => CHALLENGES.some((c) => c.id === id)).length;
    document.getElementById("chal-progress").textContent = `${cleared} / ${CHALLENGES.length} cleared`;
    document.getElementById("chal-prompt").innerHTML = `<strong>${ch.title}:</strong> ${ch.prompt}`;
    const hintEl = document.getElementById("chal-hint");
    if (state.showHint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `<strong>Hint:</strong> ${ch.hint}`;
    } else hintEl.hidden = true;
    document.getElementById("chal-hint-btn").textContent = state.showHint ? "Hide hint" : "Show hint";

    const quiz = document.getElementById("chal-quiz");
    if (ch.type === "quiz") {
      quiz.hidden = false;
      quiz.innerHTML = ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="lr-quiz" value="${String(c).replace(/"/g, "&quot;")}" ${
              state.quizChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.quizChoice = inp.value;
        });
      });
    } else if (ch.type === "pick-style") {
      const sc = SCENARIOS.find((s) => s.id === ch.scenario);
      quiz.hidden = false;
      quiz.innerHTML = sc.styles
        .map(
          (s) =>
            `<label><input type="radio" name="lr-pick" value="${s.id}" ${
              state.pickStyle === s.id ? "checked" : ""
            }> ${s.label}</label>`
        )
        .join("");
      quiz.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.pickStyle = inp.value;
        });
      });
    } else {
      quiz.hidden = true;
      quiz.innerHTML = "";
    }

    const cat = document.getElementById("chal-catalog");
    cat.innerHTML = "";
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (clearedIds.includes(c.id) ? "✓ " : "") + c.title;
      if (i === state.challengeIdx) b.style.outline = "2px solid var(--accent)";
      b.addEventListener("click", () => {
        state.challengeIdx = i;
        state.showHint = false;
        state.quizChoice = "";
        state.pickStyle = "";
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function loadChallengeSetup() {
    const ch = CHALLENGES[state.challengeIdx];
    if (ch.scenario) {
      state.scenarioId = ch.scenario;
      if (ch.style) state.styleId = ch.style;
      else state.styleId = scenario().styles[0].id;
      // Start incomplete so Fix challenges require toggling
      state.elseOn = false;
      state.defaultOn = false;
      saveSession();
      renderAll();
      setChalStatus("idle", "Setup loaded");
    } else setChalStatus("idle", "Quiz — pick an answer");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.type === "quiz") ok = state.quizChoice === ch.answer;
    else if (ch.type === "pick-style") ok = state.pickStyle === ch.answerStyle;
    else {
      const resolved = currentResolved();
      ok = !!ch.check(state, resolved);
    }
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
  }

  function renderAll() {
    renderLab();
    renderChallenge();
  }

  document.getElementById("sc-sel").addEventListener("change", (e) => {
    state.scenarioId = e.target.value;
    state.styleId = scenario().styles[0].id;
    saveSession();
    renderAll();
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.quizChoice = "";
    state.pickStyle = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeSetup);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
