(() => {
  const COMMITS = [
    { id: "a100", author: "alice", msg: "init counter", good: true, file: ["module counter;", "  logic [7:0] q;", "endmodule"] },
    { id: "b200", author: "bob", msg: "add reset", good: true, file: ["module counter;", "  logic [7:0] q;", "  logic rst;", "endmodule"] },
    { id: "c300", author: "alice", msg: "widen bus", good: true, file: ["module counter;", "  logic [15:0] q;", "  logic rst;", "endmodule"] },
    { id: "d400", author: "carol", msg: "oops off-by-one", good: false, file: ["module counter;", "  logic [15:0] q;", "  // BUG: reset clears to 1", "  logic rst;", "endmodule"] },
    { id: "e500", author: "bob", msg: "add enable", good: false, file: ["module counter;", "  logic [15:0] q;", "  // BUG: reset clears to 1", "  logic rst;", "  logic en;", "endmodule"] },
    { id: "f600", author: "alice", msg: "docs comment", good: false, file: ["module counter;", "  logic [15:0] q;", "  // BUG: reset clears to 1", "  logic rst;", "  logic en;", "  // enable when high", "endmodule"] },
  ];

  const FIRST_BAD = "d400";
  const CLEARED_KEY = "ddv-blame-bisect-cleared-v1";
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

  function blameRows() {
    const head = COMMITS[COMMITS.length - 1];
    return head.file.map((line) => {
      let author = head.author;
      let id = head.id;
      for (let i = COMMITS.length - 1; i >= 0; i--) {
        const prev = i ? COMMITS[i - 1].file : [];
        if (COMMITS[i].file.includes(line) && !prev.includes(line)) {
          author = COMMITS[i].author;
          id = COMMITS[i].id;
          break;
        }
      }
      return { id, author, line };
    });
  }

  const CHALLENGES = [
    { id: "first-bad-id", title: "First bad id", prompt: "What is the first bad commit id? (bisect until found, or reason from the timeline).", hint: "d400 — “oops off-by-one”.", answer: "d400", type: "text" },
    { id: "first-bad-author", title: "Who introduced the bug?", prompt: "Author of the first bad commit?", hint: "carol", answer: "carol", type: "text" },
    { id: "first-bad-msg", title: "Bad commit message", prompt: "Message of the first bad commit (exact).", hint: "oops off-by-one", answer: "oops off-by-one", type: "text" },
    { id: "bisect-done", title: "Finish bisect", prompt: "Reset bisect if needed, mark good/bad until the UI shows First bad commit: d400.", hint: "a100 good … mark midpoints; bad from d400 onward.", check: () => hi - lo <= 1 && COMMITS[hi].id === FIRST_BAD, type: "state" },
    { id: "blame-bug-line", title: "Blame BUG comment", prompt: "Which commit id last introduced the “// BUG:” line?", hint: "Look at blame table — d400.", answer: "d400", type: "text" },
    { id: "blame-bug-author", title: "BUG line author", prompt: "Who wrote the BUG comment line?", hint: "carol", answer: "carol", type: "text" },
    { id: "blame-en", title: "Blame en line", prompt: "Which commit introduced `logic en;`?", hint: "e500", answer: "e500", type: "text" },
    { id: "blame-en-author", title: "en author", prompt: "Who added logic en?", hint: "bob", answer: "bob", type: "text" },
    { id: "blame-enable-comment", title: "enable when high", prompt: "Commit id for “// enable when high”?", hint: "f600", answer: "f600", type: "text" },
    { id: "blame-enable-author", title: "docs author", prompt: "Who wrote the enable-when-high comment?", hint: "alice", answer: "alice", type: "text" },
    { id: "blame-module", title: "module line", prompt: "Commit that introduced `module counter;`?", hint: "a100", answer: "a100", type: "text" },
    { id: "blame-rst", title: "rst line", prompt: "Commit that introduced `logic rst;`?", hint: "b200", answer: "b200", type: "text" },
    { id: "blame-widen", title: "15:0 widen", prompt: "Commit that widened q to [15:0]?", hint: "c300", answer: "c300", type: "text" },
    { id: "good-tip", title: "Last good", prompt: "Last known-good commit id before the bug?", hint: "c300", answer: "c300", type: "text" },
    { id: "head-id", title: "HEAD id", prompt: "What is HEAD commit id?", hint: "f600", answer: "f600", type: "text" },
    { id: "head-author", title: "HEAD author", prompt: "Author of HEAD?", hint: "alice", answer: "alice", type: "text" },
    { id: "count-commits", title: "Commit count", prompt: "How many commits in the chain? (number)", hint: "6", answer: "6", type: "text" },
    { id: "count-bad", title: "Bad commit count", prompt: "How many commits are marked bad (including first bad)?", hint: "3 (d400 e500 f600)", answer: "3", type: "text" },
    { id: "bob-commits", title: "Bob’s commits", prompt: "How many commits did bob author?", hint: "b200 and e500 → 2", answer: "2", type: "text" },
    { id: "alice-commits", title: "Alice’s commits", prompt: "How many commits did alice author?", hint: "a100 c300 f600 → 3", answer: "3", type: "text" },
    { id: "carol-only", title: "Carol’s only", prompt: "Carol’s commit id?", hint: "d400", answer: "d400", type: "text" },
    { id: "bisect-reset", title: "Reset range", prompt: "Click reset bisect so range is a100..f600 again (hi-lo > 1).", hint: "reset bisect button.", check: () => hi - lo > 1 && lo === 0 && hi === COMMITS.length - 1, type: "state" },
  ];

  const root = document.getElementById("bb-root");
  root.innerHTML = `
    <div class="starter-note no-print">
      <p><strong>Starter example:</strong> Known good <code>a100</code>, HEAD bad — bisect to find <code>d400</code>, then read blame for the BUG line.</p>
      <button type="button" class="btn btn-secondary" id="bb-starter">Reset lab</button>
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
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head"><h2>git blame counter.v (at HEAD)</h2></div>
        <div class="panel-body">
          <table class="blame-table" id="blame"></table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>git bisect</h2></div>
        <div class="panel-body">
          <p style="margin:0 0 0.65rem;color:var(--muted);font-size:0.9rem">
            Known good: <code>a100</code>. HEAD is bad. Mark the midpoint good/bad until the first bad commit appears.
          </p>
          <div class="bisect-step" id="bisect-status"></div>
          <div class="timeline" id="timeline"></div>
          <div class="tool-actions">
            <button type="button" class="btn btn-secondary" id="btn-good">good</button>
            <button type="button" class="btn btn-secondary" id="btn-bad">bad</button>
            <button type="button" class="btn btn-ghost" id="btn-reset">reset bisect</button>
          </div>
          <p id="bisect-msg" style="margin:0.75rem 0 0;font-size:0.9rem"></p>
        </div>
      </div>
    </div>
  `;

  function blameAtHead() {
    const rows = blameRows();
    document.getElementById("blame").innerHTML = rows
      .map(
        (r) =>
          `<tr><td class="hash">${r.id}</td><td class="author">${r.author}</td><td>${r.line.replace(/</g, "&lt;")}</td></tr>`
      )
      .join("");
  }

  let lo = 0;
  let hi = COMMITS.length - 1;
  let mid = 0;

  function setMid() {
    mid = Math.floor((lo + hi) / 2);
  }

  function renderBisect() {
    setMid();
    const c = COMMITS[mid];
    document.getElementById("bisect-status").textContent =
      hi - lo <= 1
        ? `First bad commit: ${COMMITS[hi].id} — ${COMMITS[hi].msg}`
        : `Bisecting: mid ${c.id} (${c.msg}) · range ${COMMITS[lo].id}..${COMMITS[hi].id}`;
    document.getElementById("timeline").innerHTML = COMMITS.map((c, i) => {
      let cls = "";
      if (i === lo) cls = "good";
      if (i === hi) cls = "bad";
      if (i === mid && hi - lo > 1) cls = "mid";
      return `<button type="button" class="${cls}" data-i="${i}">${c.id}</button>`;
    }).join("");
    const msg = document.getElementById("bisect-msg");
    if (hi - lo <= 1) {
      msg.style.color = "var(--ok)";
      msg.textContent = `Found: ${COMMITS[hi].id} introduced the bug (“${COMMITS[hi].msg}”).`;
    } else {
      msg.style.color = "var(--muted)";
      msg.textContent = `Test commit ${c.id}: is this revision good or bad?`;
    }
  }

  document.getElementById("btn-good").addEventListener("click", () => {
    if (hi - lo <= 1) return;
    lo = mid;
    renderBisect();
  });
  document.getElementById("btn-bad").addEventListener("click", () => {
    if (hi - lo <= 1) return;
    hi = mid;
    renderBisect();
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    lo = 0;
    hi = COMMITS.length - 1;
    renderBisect();
  });

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

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
    const row = document.getElementById("chal-answer-row");
    if (ch.type === "text") {
      row.innerHTML = `<label style="font-size:0.85rem">Answer <input id="chal-ans" value="${answerDraft.replace(/"/g, "&quot;")}" style="min-width:12rem;margin-left:0.35rem"></label>`;
      document.getElementById("chal-ans").addEventListener("input", (e) => {
        answerDraft = e.target.value;
      });
    } else {
      row.innerHTML = `<span style="color:var(--muted);font-size:0.9rem">Use the bisect controls, then Check.</span>`;
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
        answerDraft = "";
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  document.getElementById("bb-starter").addEventListener("click", () => {
    lo = 0;
    hi = COMMITS.length - 1;
    renderBisect();
    blameAtHead();
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    showHint = !showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", () => {
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.type === "text") {
      const ans = (document.getElementById("chal-ans")?.value || "").trim().toLowerCase();
      ok = ans === String(ch.answer).toLowerCase();
    } else {
      try {
        ok = !!ch.check();
      } catch {
        ok = false;
      }
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
  });
  document.getElementById("chal-next").addEventListener("click", () => {
    challengeIdx = (challengeIdx + 1) % CHALLENGES.length;
    showHint = false;
    answerDraft = "";
    setChalStatus("idle", "Idle");
    renderChallenge();
  });

  blameAtHead();
  renderBisect();
  renderChallenge();
})();
