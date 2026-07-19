(() => {
  const STORAGE_KEY = "ddv-kmap-v1";
  const CLEARED_KEY = "ddv-kmap-cleared-v1";
  const NAMES = ["A", "B", "C", "D", "E", "F"];
  const MIN_N = 2;
  const MAX_N = 6;

  /** Gray-code sequence for a given bit width. */
  function graySeq(bits) {
    const n = 1 << bits;
    const out = [];
    for (let i = 0; i < n; i++) out.push(i ^ (i >> 1));
    return out;
  }

  /** Single-map layout for 2–4 variables. */
  function layout(n) {
    const colVars = Math.ceil(n / 2);
    const rowVars = n - colVars;
    return {
      n,
      rowVars,
      colVars,
      rowNames: NAMES.slice(0, rowVars),
      colNames: NAMES.slice(rowVars, n),
      rows: graySeq(rowVars),
      cols: graySeq(colVars),
    };
  }

  /**
   * For n≤4: one Gray map.
   * For n=5–6: 2ⁿ⁻⁴ planes of a 4-var map on the LSBs (MSBs select the plane).
   */
  function mapSpec(n) {
    if (n <= 4) {
      return { n, planeBits: 0, planeNames: [], planeOrder: [0], base: layout(n) };
    }
    const planeBits = n - 4;
    const mapNames = NAMES.slice(planeBits, n);
    return {
      n,
      planeBits,
      planeNames: NAMES.slice(0, planeBits),
      planeOrder: graySeq(planeBits),
      base: {
        n: 4,
        rowVars: 2,
        colVars: 2,
        rowNames: mapNames.slice(0, 2),
        colNames: mapNames.slice(2, 4),
        rows: graySeq(2),
        cols: graySeq(2),
      },
    };
  }

  function mintermAt(lay, r, c) {
    return (lay.rows[r] << lay.colVars) | lay.cols[c];
  }

  function mintermAtPlane(spec, planeVal, r, c) {
    const mapM = mintermAt(spec.base, r, c);
    if (!spec.planeBits) return mapM;
    return (planeVal << 4) | mapM;
  }

  function planeLabel(spec, planeVal) {
    if (!spec.planeBits) return "";
    const bits = planeVal.toString(2).padStart(spec.planeBits, "0");
    return spec.planeNames.map((name, i) => `${name}=${bits[i]}`).join(", ");
  }

  function bitCount(x) {
    let n = 0;
    while (x) {
      n += x & 1;
      x >>>= 1;
    }
    return n;
  }

  /**
   * Quine–McCluskey: cells is array of '0'|'1'|'X' indexed by minterm.
   * Returns { cover: [{bits, dashes, terms}], expr, exprTerms }.
   */
  function minimize(cells) {
    const n = Math.log2(cells.length);
    if (!Number.isInteger(n) || n < 1) return { cover: [], expr: "0", exprTerms: [] };

    const onset = [];
    const dc = [];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === "1") onset.push(i);
      else if (cells[i] === "X") dc.push(i);
    }
    if (!onset.length) return { cover: [], expr: "0", exprTerms: [] };
    if (onset.length + dc.length === cells.length) {
      return { cover: [{ bits: 0, dashes: (1 << n) - 1, terms: [...onset, ...dc] }], expr: "1", exprTerms: ["1"] };
    }

    const start = [...onset, ...dc].map((m) => ({
      bits: m,
      dashes: 0,
      terms: [m],
      used: false,
    }));

    let current = start;
    const primes = [];

    while (current.length) {
      const nextMap = new Map();
      const used = new Set();
      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          const a = current[i];
          const b = current[j];
          if (a.dashes !== b.dashes) continue;
          const diff = a.bits ^ b.bits;
          if (bitCount(diff) !== 1) continue;
          if (diff & a.dashes) continue;
          const bits = a.bits & ~diff;
          const dashes = a.dashes | diff;
          const key = bits + "/" + dashes;
          const terms = [...new Set([...a.terms, ...b.terms])].sort((x, y) => x - y);
          if (!nextMap.has(key)) nextMap.set(key, { bits, dashes, terms, used: false });
          used.add(i);
          used.add(j);
        }
      }
      current.forEach((im, i) => {
        if (!used.has(i)) primes.push(im);
      });
      current = [...nextMap.values()];
    }

    // Unique primes that cover at least one onset minterm
    const uniq = [];
    const seen = new Set();
    for (const p of primes) {
      const key = p.bits + "/" + p.dashes;
      if (seen.has(key)) continue;
      seen.add(key);
      const coversOnset = onset.some((m) => covers(p, m));
      if (coversOnset) uniq.push(p);
    }

    const cover = selectCover(uniq, onset);
    const exprTerms = cover.map((p) => implicantExpr(p, n));
    const expr = exprTerms.length ? exprTerms.join(" + ") : "0";
    return { cover, expr, exprTerms };
  }

  function covers(im, m) {
    return ((m ^ im.bits) & ~im.dashes) === 0;
  }

  function selectCover(primes, onset) {
    if (!onset.length || !primes.length) return [];

    const covered = new Set();
    const chosenIdx = new Set();

    // Essential primes
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of onset) {
        if (covered.has(m)) continue;
        const opts = primes.map((p, i) => (covers(p, m) ? i : -1)).filter((i) => i >= 0);
        if (opts.length === 1) {
          chosenIdx.add(opts[0]);
          onset.forEach((mm) => {
            if (covers(primes[opts[0]], mm)) covered.add(mm);
          });
          changed = true;
        }
      }
    }

    // Greedy for the rest
    while (onset.some((m) => !covered.has(m))) {
      let best = -1;
      let bestScore = -1;
      primes.forEach((p, i) => {
        if (chosenIdx.has(i)) return;
        const score = onset.filter((m) => !covered.has(m) && covers(p, m)).length;
        const dashBonus = bitCount(p.dashes);
        if (score > bestScore || (score === bestScore && score > 0 && dashBonus > bitCount(primes[best]?.dashes || 0))) {
          bestScore = score;
          best = i;
        }
      });
      if (best < 0 || bestScore <= 0) break;
      chosenIdx.add(best);
      onset.forEach((m) => {
        if (covers(primes[best], m)) covered.add(m);
      });
    }

    return [...chosenIdx].map((i) => primes[i]);
  }

  function implicantExpr(im, n) {
    if (im.dashes === (1 << n) - 1) return "1";
    const parts = [];
    for (let b = n - 1; b >= 0; b--) {
      const mask = 1 << b;
      if (im.dashes & mask) continue;
      const vname = NAMES[n - 1 - b];
      if (im.bits & mask) parts.push(vname);
      else parts.push(vname + "'");
    }
    return parts.join("") || "1";
  }

  /** Normalize expression for comparison (sort products, sort literals). */
  function normExpr(s) {
    if (!s || s === "0") return "0";
    if (s === "1") return "1";
    return s
      .replace(/\s+/g, "")
      .replace(/·/g, "")
      .replace(/\*/g, "")
      .replace(/∧/g, "")
      .split("+")
      .map((term) => {
        const lits = [];
        for (let i = 0; i < term.length; i++) {
          const c = term[i];
          if (/[A-Fa-f]/.test(c)) {
            const next = term[i + 1];
            if (next === "'" || next === "̄" || next === "!") {
              lits.push(c.toUpperCase() + "'");
              i++;
            } else if (next === "~") {
              /* skip */
            } else lits.push(c.toUpperCase());
          } else if (c === "~" && /[A-Fa-f]/.test(term[i + 1])) {
            lits.push(term[i + 1].toUpperCase() + "'");
            i++;
          }
        }
        return lits.sort().join("");
      })
      .filter(Boolean)
      .sort()
      .join("+");
  }

  function cellsFromMinterms(n, ones, xs = []) {
    const cells = Array(1 << n).fill("0");
    ones.forEach((m) => {
      cells[m] = "1";
    });
    xs.forEach((m) => {
      cells[m] = "X";
    });
    return cells;
  }

  function targetFromPred(n, pred) {
    const cells = [];
    for (let i = 0; i < 1 << n; i++) {
      const bits = [];
      for (let b = n - 1; b >= 0; b--) bits.push((i >> b) & 1);
      // bits[0]=A ... for n vars: bit n-1 is A (MSB)
      const args = [];
      for (let v = 0; v < n; v++) args.push((i >> (n - 1 - v)) & 1);
      cells.push(pred(...args) ? "1" : "0");
    }
    return cells;
  }

  const CHALLENGES = [
    {
      id: "and2",
      title: "AND (2)",
      mode: "fill",
      n: 2,
      prompt: "Fill the map so F = 1 only when A=1 and B=1.",
      hint: "Only minterm m3 (AB) is 1.",
      target: targetFromPred(2, (a, b) => a && b),
    },
    {
      id: "or2",
      title: "OR (2)",
      mode: "fill",
      n: 2,
      prompt: "Fill F = A + B (OR).",
      hint: "Three 1s: m1, m2, m3.",
      target: targetFromPred(2, (a, b) => a || b),
    },
    {
      id: "xor2",
      title: "XOR (2)",
      mode: "fill",
      n: 2,
      prompt: "Fill F = A ⊕ B.",
      hint: "m1 and m2 are 1.",
      target: targetFromPred(2, (a, b) => a !== b),
    },
    {
      id: "xnor2",
      title: "XNOR (2)",
      mode: "fill",
      n: 2,
      prompt: "Fill F = A ⊙ B (equivalence).",
      hint: "m0 and m3 are 1.",
      target: targetFromPred(2, (a, b) => a === b),
    },
    {
      id: "nand2",
      title: "NAND (2)",
      mode: "fill",
      n: 2,
      prompt: "Fill F = (AB)' (NAND).",
      hint: "All cells 1 except m3.",
      target: targetFromPred(2, (a, b) => !(a && b)),
    },
    {
      id: "a-only",
      title: "F = A",
      mode: "fill",
      n: 2,
      prompt: "Fill so F equals A (independent of B).",
      hint: "Both cells in the A=1 row are 1.",
      target: targetFromPred(2, (a) => !!a),
    },
    {
      id: "sop-xor",
      title: "Pick SOP: XOR",
      mode: "pick",
      n: 2,
      prompt: "Map shows XOR. Pick the minimal SOP.",
      hint: "Two product terms.",
      target: targetFromPred(2, (a, b) => a !== b),
      choices: ["A'B + AB'", "AB", "A + B", "A'B'"],
      answer: "A'B + AB'",
    },
    {
      id: "sop-and",
      title: "Pick SOP: AND",
      mode: "pick",
      n: 2,
      prompt: "Map shows AND. Pick the minimal SOP.",
      hint: "Single product.",
      target: targetFromPred(2, (a, b) => a && b),
      choices: ["A", "B", "AB", "A + B"],
      answer: "AB",
    },
    {
      id: "and3",
      title: "AND (3)",
      mode: "fill",
      n: 3,
      prompt: "3-var map: F = 1 only for ABC (m7).",
      hint: "One cell at A=1, BC=11.",
      target: targetFromPred(3, (a, b, c) => a && b && c),
    },
    {
      id: "majority3",
      title: "Majority (3)",
      mode: "fill",
      n: 3,
      prompt: "F = 1 when at least two of A,B,C are 1.",
      hint: "m3,m5,m6,m7.",
      target: targetFromPred(3, (a, b, c) => a + b + c >= 2),
    },
    {
      id: "xor3-ab",
      title: "A ⊕ B (ignore C)",
      mode: "fill",
      n: 3,
      prompt: "F = A ⊕ B (same for both C).",
      hint: "Pairs of adjacent 1s across C.",
      target: targetFromPred(3, (a, b) => a !== b),
    },
    {
      id: "sop-maj",
      title: "Pick SOP: majority",
      mode: "pick",
      n: 3,
      prompt: "Majority function map — pick a minimal SOP.",
      hint: "Three pairwise products.",
      target: targetFromPred(3, (a, b, c) => a + b + c >= 2),
      choices: ["AB + AC + BC", "ABC", "A + B + C", "A'B'C'"],
      answer: "AB + AC + BC",
    },
    {
      id: "decode-101",
      title: "Decode 101",
      mode: "fill",
      n: 3,
      prompt: "F = 1 only when ABC = 101 (m5).",
      hint: "A=1, B=0, C=1.",
      target: cellsFromMinterms(3, [5]),
    },
    {
      id: "sum-m013",
      title: "Σm(0,1,3)",
      mode: "fill",
      n: 3,
      prompt: "Fill Σm(0,1,3).",
      hint: "Three 1s; groups may wrap.",
      target: cellsFromMinterms(3, [0, 1, 3]),
    },
    {
      id: "sop-m013",
      title: "Pick SOP: Σm(0,1,3)",
      mode: "pick",
      n: 3,
      prompt: "For Σm(0,1,3), pick minimal SOP.",
      hint: "A'C' + A'B (or equivalent grouping).",
      target: cellsFromMinterms(3, [0, 1, 3]),
      choices: ["A'B' + A'C", "ABC", "A + B + C", "B'C"],
      answer: "A'B' + A'C",
    },
    {
      id: "4var-one",
      title: "Single minterm (4)",
      mode: "fill",
      n: 4,
      prompt: "4-var: only m0 is 1 (A'B'C'D').",
      hint: "Top-left cell in standard AB/CD map.",
      target: cellsFromMinterms(4, [0]),
    },
    {
      id: "4var-quad",
      title: "Quad group",
      mode: "fill",
      n: 4,
      prompt: "Fill Σm(0,2,8,10) — a classic wrap quad.",
      hint: "Four corners / B'D' style grouping.",
      target: cellsFromMinterms(4, [0, 2, 8, 10]),
    },
    {
      id: "sop-quad",
      title: "Pick SOP: wrap quad",
      mode: "pick",
      n: 4,
      prompt: "Σm(0,2,8,10) — pick minimal SOP.",
      hint: "One product of two literals.",
      target: cellsFromMinterms(4, [0, 2, 8, 10]),
      choices: ["B'D'", "A'C'", "ABCD", "A + B + C + D"],
      answer: "B'D'",
    },
    {
      id: "dc-fill",
      title: "Don’t cares fill",
      mode: "fill",
      n: 3,
      prompt: "Set 1s on m0,m2 and X on m4,m6; rest 0.",
      hint: "Click cells to cycle 0→1→X→0.",
      target: cellsFromMinterms(3, [0, 2], [4, 6]),
    },
    {
      id: "sop-dc",
      title: "Pick SOP with X",
      mode: "pick",
      n: 3,
      prompt: "1s: m0,m2; X: m4,m6. Pick a minimal SOP (X help enlarge groups).",
      hint: "Can become a single literal.",
      target: cellsFromMinterms(3, [0, 2], [4, 6]),
      choices: ["C'", "A'", "ABC", "A + C"],
      answer: "C'",
    },
    {
      id: "4var-sum",
      title: "Σm(1,5,9,13)",
      mode: "fill",
      n: 4,
      prompt: "Fill Σm(1,5,9,13).",
      hint: "Often simplifies to C'D.",
      target: cellsFromMinterms(4, [1, 5, 9, 13]),
    },
    {
      id: "sop-cd",
      title: "Pick SOP: C'D",
      mode: "pick",
      n: 4,
      prompt: "Σm(1,5,9,13) — pick minimal SOP.",
      hint: "One product term.",
      target: cellsFromMinterms(4, [1, 5, 9, 13]),
      choices: ["C'D", "AB", "A'B'C'D", "C + D"],
      answer: "C'D",
    },
    {
      id: "5var-m0",
      title: "5-var m0",
      mode: "fill",
      n: 5,
      prompt: "5-var (two planes): only m0 is 1. Planes are A=0 and A=1 over BCDE.",
      hint: "Open 5 variables; set the cell m0 in the A=0 plane.",
      target: cellsFromMinterms(5, [0]),
    },
    {
      id: "5var-a",
      title: "5-var F=A",
      mode: "fill",
      n: 5,
      prompt: "Fill so F = A (all cells in the A=1 plane are 1; A=0 plane all 0).",
      hint: "Sixteen 1s when A=1.",
      target: targetFromPred(5, (a) => !!a),
    },
    {
      id: "sop-5-a",
      title: "Pick SOP: F=A (5)",
      mode: "pick",
      n: 5,
      prompt: "5-var map with F=A — pick minimal SOP.",
      hint: "One literal.",
      target: targetFromPred(5, (a) => !!a),
      choices: ["A", "B", "ABCDE", "A'"],
      answer: "A",
    },
    {
      id: "6var-m0",
      title: "6-var m0",
      mode: "fill",
      n: 6,
      prompt: "6-var (four planes AB over CDEF): only m0 is 1.",
      hint: "Plane AB=00, corner m0.",
      target: cellsFromMinterms(6, [0]),
    },
  ];

  // Fix sop-m013 answer: verify with minimizer
  // Σm(0,1,3) for ABC: m0=000, m1=001, m3=011 → A'B'C' + A'B'C + A'BC = A'B' + A'C (yes if we group 0,1 and 1,3 → A'B' and A'C overlapping m1)

  let clearedIds = [];
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) clearedIds = JSON.parse(raw).map(String);
  } catch {
    /* ignore */
  }

  const state = {
    n: 2,
    cells: ["0", "0", "0", "0"],
    challengeIdx: 0,
    showHint: false,
    pickChoice: "",
    mapLocked: false,
  };

  function loadStarter() {
    state.n = 2;
    state.cells = targetFromPred(2, (a, b) => a !== b); // XOR starter
    state.mapLocked = false;
    state.pickChoice = "";
  }

  function emptyCells(n) {
    return Array(1 << n).fill("0");
  }

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ n: state.n, cells: state.cells })
      );
    } catch {
      /* ignore */
    }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.n >= MIN_N && data.n <= MAX_N && Array.isArray(data.cells) && data.cells.length === 1 << data.n) {
        state.n = data.n;
        state.cells = data.cells.map((c) => (c === "1" || c === "X" ? c : "0"));
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  const root = document.getElementById("kmap-root");
  root.innerHTML = `
    <p class="starter-note" id="starter-note"></p>
    <div class="challenge">
      <h2>Challenge <span id="chal-progress" style="font-weight:500;color:var(--muted);font-size:0.9rem"></span></h2>
      <p id="chal-prompt"></p>
      <p class="chal-hint" id="chal-hint" hidden></p>
      <div id="chal-pick" class="sop-choices" hidden></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="chal-hint-btn">Show hint</button>
        <button type="button" class="btn btn-secondary" id="chal-check">Check</button>
        <button type="button" class="btn btn-ghost" id="chal-next">Next</button>
        <button type="button" class="btn btn-ghost" id="chal-load">Load challenge map</button>
        <span class="challenge-status idle" id="chal-status">Idle</span>
      </div>
      <div class="kbd-row" id="chal-catalog" style="margin-top:0.75rem"></div>
    </div>
    <div class="tool-layout split-wide">
      <div class="panel">
        <div class="panel-head">
          <h2>Karnaugh map</h2>
          <div class="tool-actions">
            <button type="button" class="btn btn-ghost" id="btn-starter">Load starter example</button>
            <button type="button" class="btn btn-ghost" id="btn-clear">Clear map</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="kmap-controls">
            <div class="kmap-field">
              <label for="var-n">Variables</label>
              <select id="var-n">
                <option value="2">2 (A B)</option>
                <option value="3">3 (A B C)</option>
                <option value="4">4 (A B C D)</option>
                <option value="5">5 (A | BCDE planes)</option>
                <option value="6">6 (AB | CDEF planes)</option>
              </select>
            </div>
          </div>
          <p class="locked-note" id="lock-note" hidden>Map locked for this pick-SOP challenge — use Load challenge map, then choose an expression.</p>
          <div class="kmap-grid-wrap" id="grid"></div>
          <p class="kmap-meta">Click a cell to cycle <strong>0 → 1 → X → 0</strong>. For 5–6 vars, MSB planes sit beside/above 4-var maps. Small numbers are minterm indices.</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Minimal SOP</h2></div>
        <div class="panel-body">
          <pre class="kmap-expr" id="expr">F = …</pre>
          <p class="kmap-meta" id="meta"></p>
          <div class="group-legend" id="legend"></div>
        </div>
      </div>
    </div>
  `;

  function setChalStatus(kind, msg) {
    const el = document.getElementById("chal-status");
    el.className = "challenge-status " + kind;
    el.textContent = msg;
  }

  function cycleCell(m) {
    if (state.mapLocked) return;
    const cur = state.cells[m];
    state.cells[m] = cur === "0" ? "1" : cur === "1" ? "X" : "0";
    saveSession();
    renderMap();
  }

  function setN(n) {
    if (state.mapLocked) return;
    const next = emptyCells(n);
    const copy = Math.min(state.cells.length, next.length);
    for (let i = 0; i < copy; i++) next[i] = state.cells[i];
    state.n = n;
    state.cells = next;
    saveSession();
    renderAll();
  }

  function cellsEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  function renderOneTable(spec, planeVal, cellGroup) {
    const lay = spec.base;
    const rowLabel = lay.rowNames.join("") || "·";
    const colLabel = lay.colNames.join("");
    let html = `<table class="kmap-table" aria-label="Karnaugh map"><thead><tr>
      <th class="corner">${rowLabel}\\${colLabel}</th>`;
    lay.cols.forEach((g) => {
      html += `<th>${g.toString(2).padStart(lay.colVars, "0")}</th>`;
    });
    html += `</tr></thead><tbody>`;
    for (let r = 0; r < lay.rows.length; r++) {
      const rg = lay.rows[r];
      html += `<tr><th>${rg.toString(2).padStart(lay.rowVars, "0")}</th>`;
      for (let c = 0; c < lay.cols.length; c++) {
        const m = mintermAtPlane(spec, planeVal, r, c);
        const val = state.cells[m];
        const gi = cellGroup[m];
        const gClass = gi >= 0 ? ` g${gi % 6}` : "";
        html += `<td class="kmap-cell val-${val === "X" ? "x" : val}${gClass}" data-m="${m}" title="m${m}">
          <span class="mt">m${m}</span>
          <span class="group-ring"></span>
          ${val}
        </td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    return html;
  }

  function renderMap() {
    const spec = mapSpec(state.n);
    const { cover } = minimize(state.cells);
    const cellGroup = Array(state.cells.length).fill(-1);
    cover.forEach((im, gi) => {
      for (let m = 0; m < state.cells.length; m++) {
        if (covers(im, m) && state.cells[m] !== "0") {
          if (cellGroup[m] < 0) cellGroup[m] = gi;
        }
      }
    });

    let html = `<div class="kmap-planes">`;
    for (const planeVal of spec.planeOrder) {
      const label = planeLabel(spec, planeVal);
      html += `<div class="kmap-plane">`;
      if (label) html += `<div class="plane-label">${label}</div>`;
      html += renderOneTable(spec, planeVal, cellGroup);
      html += `</div>`;
    }
    html += `</div>`;
    document.getElementById("grid").innerHTML = html;

    document.querySelectorAll(".kmap-cell").forEach((td) => {
      td.addEventListener("click", () => cycleCell(Number(td.dataset.m)));
    });

    const ones = state.cells.map((v, i) => (v === "1" ? i : -1)).filter((i) => i >= 0);
    const xs = state.cells.map((v, i) => (v === "X" ? i : -1)).filter((i) => i >= 0);
    const { expr, exprTerms, cover: cov } = minimize(state.cells);
    document.getElementById("expr").textContent = `F = ${expr}`;
    const sumStr =
      ones.length > 24 ? `Σm(${ones.length} ones)` : `Σm(${ones.join(",") || "—"})`;
    document.getElementById("meta").textContent =
      sumStr + (xs.length ? `  d(${xs.length > 16 ? xs.length + " dc" : xs.join(",")})` : "") + `  ·  ${cov.length} group(s)`;

    const legend = document.getElementById("legend");
    legend.innerHTML = cov
      .map(
        (im, i) =>
          `<span><i class="group-swatch g${i % 6}"></i>${exprTerms[i] || implicantExpr(im, state.n)}</span>`
      )
      .join("");

    document.getElementById("var-n").value = String(state.n);
    document.getElementById("lock-note").hidden = !state.mapLocked;
    document.getElementById("starter-note").textContent =
      "Starter example: 2-variable XOR (F = A'B + AB') with two groups highlighted.";
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

    const pick = document.getElementById("chal-pick");
    if (ch.mode === "pick") {
      pick.hidden = false;
      pick.innerHTML = ch.choices
        .map(
          (c) =>
            `<label><input type="radio" name="sop-pick" value="${c.replace(/"/g, "&quot;")}" ${
              state.pickChoice === c ? "checked" : ""
            }> ${c}</label>`
        )
        .join("");
      pick.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          state.pickChoice = inp.value;
        });
      });
    } else {
      pick.hidden = true;
      pick.innerHTML = "";
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
        state.pickChoice = "";
        state.mapLocked = false;
        setChalStatus("idle", "Idle");
        renderChallenge();
      });
      cat.appendChild(b);
    });
  }

  function loadChallengeMap() {
    const ch = CHALLENGES[state.challengeIdx];
    state.n = ch.n;
    state.cells = ch.target.slice();
    state.mapLocked = ch.mode === "pick";
    state.pickChoice = "";
    saveSession();
    renderAll();
    setChalStatus("idle", "Map loaded");
  }

  function checkChallenge() {
    const ch = CHALLENGES[state.challengeIdx];
    let ok = false;
    if (ch.mode === "fill") {
      ok = cellsEqual(state.cells, ch.target);
    } else {
      if (!cellsEqual(state.cells, ch.target)) {
        setChalStatus("fail", "Load challenge map first");
        return;
      }
      ok = normExpr(state.pickChoice) === normExpr(ch.answer);
      // Also accept engine's minimal form if user somehow matches it
      if (!ok) {
        const { expr } = minimize(ch.target);
        ok = normExpr(state.pickChoice) === normExpr(expr);
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
  }

  function renderAll() {
    renderMap();
    renderChallenge();
  }

  document.getElementById("var-n").addEventListener("change", (e) => {
    setN(Number(e.target.value));
  });
  document.getElementById("btn-starter").addEventListener("click", () => {
    loadStarter();
    state.mapLocked = false;
    saveSession();
    renderAll();
    setChalStatus("idle", "Idle");
  });
  document.getElementById("btn-clear").addEventListener("click", () => {
    if (state.mapLocked) return;
    state.cells = emptyCells(state.n);
    saveSession();
    renderMap();
  });
  document.getElementById("chal-hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    renderChallenge();
  });
  document.getElementById("chal-check").addEventListener("click", checkChallenge);
  document.getElementById("chal-next").addEventListener("click", () => {
    state.challengeIdx = (state.challengeIdx + 1) % CHALLENGES.length;
    state.showHint = false;
    state.pickChoice = "";
    state.mapLocked = false;
    setChalStatus("idle", "Idle");
    renderChallenge();
  });
  document.getElementById("chal-load").addEventListener("click", loadChallengeMap);

  if (!restoreSession()) loadStarter();
  renderAll();
})();
