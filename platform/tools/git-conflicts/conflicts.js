(() => {
  const OURS = `module counter;
  // main branch
  parameter WIDTH = 8;
  logic [WIDTH-1:0] q;
endmodule
`;
  const THEIRS = `module counter;
  // feature branch
  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
endmodule
`;

  const CONFLICTED = `module counter;
<<<<<<< HEAD
  // main branch
  parameter WIDTH = 8;
  logic [WIDTH-1:0] q;
=======
  // feature branch
  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
>>>>>>> feature
endmodule
`;

  const GOOD = `module counter;
  // merged: keep enable, choose WIDTH intentionally
  parameter WIDTH = 16;
  logic [WIDTH-1:0] q;
  logic enable;
endmodule
`;

  const root = document.getElementById("conflict-root");
  root.innerHTML = `
    <div class="challenge">
      <h2>Scenario</h2>
      <p><code>main</code> and <code>feature</code> both edited <code>counter.v</code>. Resolve markers, then Check.</p>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="btn-reset">Reset conflict</button>
        <button type="button" class="btn btn-secondary" id="btn-ours">Take ours (HEAD)</button>
        <button type="button" class="btn btn-secondary" id="btn-theirs">Take theirs</button>
        <button type="button" class="btn btn-primary" id="btn-check">Check resolution</button>
        <span class="challenge-status idle" id="status">Not checked</span>
      </div>
    </div>
    <div class="sides">
      <div class="side-box"><h3>ours (HEAD / main)</h3>${OURS.replace(/</g, "&lt;")}</div>
      <div class="side-box"><h3>theirs (feature)</h3>${THEIRS.replace(/</g, "&lt;")}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>counter.v (working tree)</h2></div>
      <div class="panel-body">
        <textarea class="conflict-editor" id="editor" spellcheck="false"></textarea>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel-head"><h2>After resolving</h2></div>
      <div class="panel-body">
        <ul class="hint-list">
          <li>Remove all <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code>=======</code>, <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> markers</li>
          <li>Then: <code>git add counter.v</code> · <code>git commit</code> (merge commit)</li>
          <li>Good merges often keep intent from both sides — not blind “theirs”</li>
        </ul>
      </div>
    </div>
  `;

  const editor = document.getElementById("editor");
  const status = document.getElementById("status");
  editor.value = CONFLICTED;

  function setStatus(ok, msg) {
    status.className = "challenge-status " + (ok ? "pass" : "fail");
    status.textContent = msg;
  }

  document.getElementById("btn-reset").addEventListener("click", () => {
    editor.value = CONFLICTED;
    status.className = "challenge-status idle";
    status.textContent = "Not checked";
  });
  document.getElementById("btn-ours").addEventListener("click", () => {
    editor.value = OURS;
  });
  document.getElementById("btn-theirs").addEventListener("click", () => {
    editor.value = THEIRS;
  });
  document.getElementById("btn-check").addEventListener("click", () => {
    const text = editor.value;
    if (/^<<<<<<<|^=======|^>>>>>>>/m.test(text) || text.includes("<<<<<<<")) {
      setStatus(false, "Conflict markers still present");
      return;
    }
    if (!text.includes("module counter")) {
      setStatus(false, "File looks incomplete");
      return;
    }
    const hasEnable = /logic\s+enable/.test(text);
    const width16 = /WIDTH\s*=\s*16/.test(text);
    if (hasEnable && width16) {
      setStatus(true, "Passed — markers gone, kept feature WIDTH+enable");
      return;
    }
    if (!text.trim()) {
      setStatus(false, "File is empty");
      return;
    }
    setStatus(true, "Markers cleared (valid resolution — compare with suggested merge)");
  });

  // expose suggested for curious users via console note in hint — optional button
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.className = "btn btn-ghost";
  hintBtn.textContent = "Show suggested merge";
  hintBtn.addEventListener("click", () => {
    editor.value = GOOD;
  });
  document.querySelector(".tool-actions").appendChild(hintBtn);
})();
