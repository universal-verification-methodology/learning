/**
 * Shared concept-lab shell: starter note, 22 challenges, localStorage, idea cards.
 * Domain tools call DDVConceptLab.mount({ ... }).
 */
(function (global) {
  "use strict";

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {object} cfg
   * @param {string} cfg.id short id (storage prefix)
   * @param {string} cfg.rootId element id
   * @param {string} cfg.starterHtml HTML inside starter-note (before button)
   * @param {Array<{h3:string,p:string}>} cfg.ideas
   * @param {() => object} cfg.makeStarter
   * @param {(state:object) => void} cfg.renderLab
   * @param {(root:HTMLElement, api:object) => void} cfg.buildLab
   * @param {Array<object>} cfg.challenges  // exactly or ~22 items
   * @param {() => string} [cfg.literacy]
   */
  function mount(cfg) {
    const root = document.getElementById(cfg.rootId);
    if (!root) throw new Error("DDVConceptLab: missing #" + cfg.rootId);

    const CLEARED_KEY = "ddv-" + cfg.id + "-cleared-v1";
    const STORE_KEY = "ddv-" + cfg.id + "-session-v1";

    let clearedIds = loadJson(CLEARED_KEY, []).map(String);
    let challengeIdx = 0;
    let showHint = false;
    let quizChoice = "";
    let state = cfg.makeStarter();

    const ideas = (cfg.ideas || [])
      .map(
        (c) =>
          `<div class="idea-card"><h3>${escapeHtml(c.h3)}</h3><p>${escapeHtml(c.p)}</p></div>`
      )
      .join("");

    root.innerHTML = `
      <div class="starter-note no-print">
        ${cfg.starterHtml}
        <button type="button" class="btn btn-secondary" id="${cfg.id}-starter">Load starter example</button>
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
        <div class="idea-grid">${ideas}</div>
      </div>
      <div class="panel" style="margin-bottom:1rem" id="${cfg.id}-lab-panel">
        <div class="panel-head"><h2>Lab</h2></div>
        <div id="${cfg.id}-lab"></div>
        ${
          cfg.literacy
            ? `<h3 style="margin:0.75rem 0 0.35rem;font-size:0.95rem">Literacy sketch</h3>
               <pre class="code-box" id="${cfg.id}-literacy"></pre>`
            : ""
        }
      </div>
    `;

    const api = {
      getState: () => state,
      setState: (next) => {
        state = next;
        renderAll();
      },
      patchState: (partial) => {
        state = { ...state, ...partial };
        renderAll();
      },
      loadStarter: () => {
        state = cfg.makeStarter();
        renderAll();
      },
      setStatus: (kind, text) => setChalStatus(kind, text),
      pushLog: (line) => {
        const log = [...(state.log || []).slice(-40), line];
        state = { ...state, log };
      },
    };

    cfg.buildLab(document.getElementById(cfg.id + "-lab"), api);

    document.getElementById(cfg.id + "-starter").addEventListener("click", () => {
      api.loadStarter();
      setChalStatus("idle", "Idle");
    });

    document.getElementById("chal-hint-btn").addEventListener("click", () => {
      showHint = !showHint;
      renderChallenge();
    });
    document.getElementById("chal-check").addEventListener("click", () => checkChallenge());
    document.getElementById("chal-next").addEventListener("click", () => {
      challengeIdx = (challengeIdx + 1) % cfg.challenges.length;
      showHint = false;
      quizChoice = "";
      const ch = cfg.challenges[challengeIdx];
      if (typeof ch.setup === "function") ch.setup(api);
      renderAll();
      setChalStatus("idle", "Idle");
    });

    function setChalStatus(kind, text) {
      const el = document.getElementById("chal-status");
      el.className = "challenge-status " + kind;
      el.textContent = text;
    }

    function renderChallenge() {
      const ch = cfg.challenges[challengeIdx];
      const cleared = clearedIds.filter((id) =>
        cfg.challenges.some((c) => c.id === id)
      ).length;
      document.getElementById("chal-progress").textContent =
        `${cleared} / ${cfg.challenges.length} cleared`;
      document.getElementById("chal-prompt").textContent = ch.prompt;
      const hintEl = document.getElementById("chal-hint");
      if (showHint && ch.hint) {
        hintEl.hidden = false;
        hintEl.textContent = ch.hint;
      } else {
        hintEl.hidden = true;
      }

      const quiz = document.getElementById("chal-quiz");
      if (ch.type === "quiz") {
        quiz.hidden = false;
        quiz.innerHTML = (ch.choices || [])
          .map((c, i) => {
            const id = `q-${challengeIdx}-${i}`;
            const checked = quizChoice === c ? "checked" : "";
            return `<label class="chal-choice"><input type="radio" name="chal-q" value="${escapeAttr(
              c
            )}" ${checked}> ${escapeHtml(c)}</label>`;
          })
          .join("");
        quiz.querySelectorAll('input[type="radio"]').forEach((inp) => {
          inp.addEventListener("change", () => {
            quizChoice = inp.value;
          });
        });
      } else {
        quiz.hidden = true;
        quiz.innerHTML = "";
      }

      const catalog = document.getElementById("chal-catalog");
      catalog.innerHTML = "";
      cfg.challenges.forEach((c, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-ghost";
        const done = clearedIds.includes(c.id);
        btn.textContent = (done ? "✓ " : "") + String(i + 1);
        if (i === challengeIdx) btn.classList.add("is-active");
        btn.addEventListener("click", () => {
          challengeIdx = i;
          showHint = false;
          quizChoice = "";
          if (typeof c.setup === "function") c.setup(api);
          renderAll();
          setChalStatus("idle", "Idle");
        });
        catalog.appendChild(btn);
      });
    }

    function checkChallenge() {
      const ch = cfg.challenges[challengeIdx];
      let ok = false;
      if (ch.type === "quiz") ok = quizChoice === ch.answer;
      else if (typeof ch.check === "function") ok = !!ch.check(api);
      if (ok) {
        if (!clearedIds.includes(ch.id)) {
          clearedIds = [...clearedIds, ch.id];
          saveJson(CLEARED_KEY, clearedIds);
        }
        setChalStatus("yes", "Cleared");
      } else {
        setChalStatus("no", "Not yet");
      }
      renderChallenge();
    }

    function renderAll() {
      cfg.renderLab(state, api);
      if (cfg.literacy) {
        const lit = document.getElementById(cfg.id + "-literacy");
        if (lit) lit.textContent = cfg.literacy(state);
      }
      try {
        saveJson(STORE_KEY, { state, challengeIdx });
      } catch {
        /* ignore */
      }
      renderChallenge();
    }

    // Restore session (state only; keep starter button authoritative)
    const saved = loadJson(STORE_KEY, null);
    if (saved && saved.state && saved.state.preset) {
      state = saved.state;
      if (typeof saved.challengeIdx === "number") challengeIdx = saved.challengeIdx;
    }

    renderAll();
    return api;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  /** Helper: pad challenge list to 22 with literacy quizzes */
  function withQuizPad(base, quizzes) {
    const out = [...base];
    let i = 0;
    while (out.length < 22 && i < quizzes.length) {
      out.push(quizzes[i++]);
    }
    while (out.length < 22) {
      const n = out.length + 1;
      out.push({
        id: "pad-quiz-" + n,
        type: "quiz",
        prompt: "Browser concept labs replace a full offline toolchain.",
        choices: ["True", "False"],
        answer: "False",
        hint: "Labs are literacy; fidelity stays local.",
      });
    }
    return out.slice(0, 22);
  }

  global.DDVConceptLab = { mount, withQuizPad, escapeHtml };
})(window);
