(() => {
  const COMMITS = [
    { id: "a100", author: "alice", msg: "init counter", good: true, file: ["module counter;", "  logic [7:0] q;", "endmodule"] },
    { id: "b200", author: "bob", msg: "add reset", good: true, file: ["module counter;", "  logic [7:0] q;", "  logic rst;", "endmodule"] },
    { id: "c300", author: "alice", msg: "widen bus", good: true, file: ["module counter;", "  logic [15:0] q;", "  logic rst;", "endmodule"] },
    { id: "d400", author: "carol", msg: "oops off-by-one", good: false, file: ["module counter;", "  logic [15:0] q;", "  // BUG: reset clears to 1", "  logic rst;", "endmodule"] },
    { id: "e500", author: "bob", msg: "add enable", good: false, file: ["module counter;", "  logic [15:0] q;", "  // BUG: reset clears to 1", "  logic rst;", "  logic en;", "endmodule"] },
    { id: "f600", author: "alice", msg: "docs comment", good: false, file: ["module counter;", "  logic [15:0] q;", "  // BUG: reset clears to 1", "  logic rst;", "  logic en;", "  // enable when high", "endmodule"] },
  ];

  const root = document.getElementById("bb-root");
  root.innerHTML = `
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
    const head = COMMITS[COMMITS.length - 1];
    const lines = head.file;
    // attribute each line to newest commit that introduced/changed it
    const rows = lines.map((line) => {
      let author = head.author;
      let id = head.id;
      for (let i = 0; i < COMMITS.length; i++) {
        if (COMMITS[i].file.includes(line)) {
          author = COMMITS[i].author;
          id = COMMITS[i].id;
          break;
        }
      }
      // better: last commit where line appears as new vs previous
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
    document.getElementById("blame").innerHTML = rows
      .map(
        (r) =>
          `<tr><td class="hash">${r.id}</td><td class="author">${r.author}</td><td>${r.line.replace(/</g, "&lt;")}</td></tr>`
      )
      .join("");
  }

  let lo = 0; // good index
  let hi = COMMITS.length - 1; // bad index
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

  blameAtHead();
  renderBisect();
})();
