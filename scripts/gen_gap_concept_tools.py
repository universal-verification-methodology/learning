#!/usr/bin/env python3
"""Emit gap-fill concept tools (HTML/CSS/JS) using ddv-concept-lab.js."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "platform" / "tools"

CSS = Path(__file__).with_name("_concept_tool.css")
# inline CSS constant below

SHARED_CSS = r"""
.idea-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.55rem;margin-bottom:.75rem}
@media(max-width:900px){.idea-grid{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.idea-grid{grid-template-columns:1fr}}
.idea-card{border:1px solid var(--line);border-radius:8px;padding:.65rem .75rem;background:var(--surface2);font-size:.88rem}
.idea-card h3{margin:0 0 .3rem;font-size:.95rem}
.lab-controls{display:flex;flex-wrap:wrap;gap:.65rem 1rem;align-items:end;margin-bottom:.85rem}
.lab-field{display:flex;flex-direction:column;gap:.25rem}
.lab-field label{font-size:.78rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.lab-field select,.lab-field input,.lab-field textarea{font-family:var(--mono);font-size:.9rem;padding:.4rem .55rem;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);min-width:8rem}
.lab-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:1rem;margin-bottom:1rem}
@media(max-width:900px){.lab-layout{grid-template-columns:1fr}}
.panel-box{border:1px solid var(--line);border-radius:10px;padding:.75rem;background:var(--surface2)}
.panel-box h3{margin:0 0 .45rem;font-size:.95rem}
.verdict{border-radius:8px;padding:.55rem .75rem;font-size:.9rem;margin-bottom:.55rem}
.verdict.idle{background:var(--surface2);border:1px solid var(--line)}
.verdict.yes{background:color-mix(in srgb,#2a7 16%,var(--surface));border:1px solid color-mix(in srgb,#2a7 45%,var(--line))}
.verdict.warn{background:color-mix(in srgb,#c90 14%,var(--surface));border:1px solid color-mix(in srgb,#c90 40%,var(--line))}
.verdict.no{background:color-mix(in srgb,#c44 12%,var(--surface));border:1px solid color-mix(in srgb,#c44 40%,var(--line))}
.flag-row{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.65rem}
.flag{font-family:var(--mono);font-size:.75rem;padding:.2rem .45rem;border-radius:5px;border:1px solid var(--line);background:var(--surface2)}
.flag.is-ok{border-color:color-mix(in srgb,#2a7 50%,var(--line));background:color-mix(in srgb,#2a7 12%,var(--surface))}
.flag.is-on{border-color:color-mix(in srgb,var(--accent) 50%,var(--line))}
.flag.is-bad{border-color:color-mix(in srgb,#c44 50%,var(--line));background:color-mix(in srgb,#c44 10%,var(--surface))}
.code-box,.trace-box,.log-box,.table-box{font-family:var(--mono);font-size:.78rem;line-height:1.45;padding:.65rem .75rem;border:1px solid var(--line);border-radius:8px;background:var(--surface2);overflow-x:auto;white-space:pre-wrap;margin:0;max-height:14rem}
.role-table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.8rem}
.role-table th,.role-table td{border:1px solid var(--line);padding:.35rem .45rem}
.role-table select{width:100%;font-family:var(--mono)}
.wave-row{display:flex;gap:.2rem;flex-wrap:wrap;margin:.35rem 0}
.wave-cell{min-width:2rem;text-align:center;padding:.35rem .25rem;border:1px solid var(--line);border-radius:4px;font-family:var(--mono);font-size:.75rem}
.wave-cell.is-cur{border-color:color-mix(in srgb,var(--accent) 55%,var(--line));background:color-mix(in srgb,var(--accent) 14%,var(--surface))}
.wave-cell.is-bad{border-color:color-mix(in srgb,#c44 50%,var(--line));background:color-mix(in srgb,#c44 12%,var(--surface))}
.chal-choice{display:block;margin:.25rem 0;font-size:.92rem}
.meta-note{font-size:.88rem;margin:.5rem 0 0;color:var(--muted)}
"""


def page(slug: str, title: str, lead: str, root: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} — Digital Design and Verification Platform</title>
  <link rel="stylesheet" href="../../assets/site.css">
  <link rel="stylesheet" href="../../assets/tools-shared.css">
  <link rel="stylesheet" href="{slug}.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="site-header-inner">
      <p class="brand"><a href="../../index.html">Digital Design and Verification Platform</a></p>
      <nav class="site-nav" aria-label="Site">
        <a href="../../index.html">Home</a>
        <a href="../index.html" class="is-active" aria-current="page">Tools</a>
      </nav>
    </div>
    <div class="site-header-crumb">
      <nav aria-label="Breadcrumb">
        <a href="../../index.html">Home</a>
        <a href="../index.html">Tools</a>
        <span class="here">{title}</span>
      </nav>
    </div>
  </header>
  <main id="main">
    <div class="eyebrow">Interactive tool</div>
    <section class="hero">
      <h1>{title}</h1>
      <p class="lead">{lead}</p>
    </section>
    <div id="{root}"></div>
  </main>
  <footer class="site-footer">Digital Design and Verification Platform — client-side concept labs.</footer>
  <script src="../../assets/ddv-concept-lab.js"></script>
  <script src="{slug}.js"></script>
  <script src="../../assets/site.js"></script>
</body>
</html>
"""


def emit(slug: str, title: str, lead: str, root: str, js: str) -> None:
    d = TOOLS / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(page(slug, title, lead, root), encoding="utf-8", newline="\n")
    (d / f"{slug}.css").write_text(SHARED_CSS, encoding="utf-8", newline="\n")
    (d / f"{slug}.js").write_text(js.strip() + "\n", encoding="utf-8", newline="\n")
    print("wrote", slug)


def main() -> None:
    # JS files live beside this script for readability
    js_dir = Path(__file__).with_name("gap_tools_js")
    specs = [
        ("pytest-assert-lab", "pytest assert / golden",
         "Compare <strong>expected vs actual</strong> with pytest-style asserts. Starter: <code>0xA5</code> matches → PASS.",
         "pytest-assert-root"),
        ("stim-as-data", "Stimulus as data",
         "Treat stimulus as a <strong>Python list of vectors</strong>. Starter: four AND-gate rows, Apply all → PASS.",
         "stim-as-data-root"),
        ("cocotb-clock-helper", "cocotb Clock helper",
         "Sketch <code>Clock(dut.clk, 10, units='ns').start()</code>. Starter: period 10, edges at 10/20/30.",
         "cocotb-clock-root"),
        ("cocotb-binary-value", "cocotb BinaryValue",
         "Poke a DUT handle via width + value. Starter: 8-bit <code>0xA5</code> → <code>10100101</code>.",
         "cocotb-bv-root"),
        ("cocotb-scoreboard", "cocotb scoreboard sketch",
         "Expect queue vs observed actuals. Starter: expect <code>0xA5</code>, observe match → PASS.",
         "cocotb-sb-root"),
        ("assert-assume-cover", "Assert / assume / cover",
         "Classify property roles. Starter: three statements correctly tagged.",
         "aac-root"),
        ("formal-bmc-bound", "Formal BMC bound",
         "Bounded model check depth <code>k</code>. Starter: bug at step 3, k=5 → CEX.",
         "bmc-root"),
        ("formal-counterexample", "Formal counterexample",
         "Step a short CEX wave. Starter: cursor on the failing cycle.",
         "fcex-root"),
        ("formal-induction", "Formal induction sketch",
         "Base + step picture (literacy). Starter: base holds, step holds → proved (sketch).",
         "finduct-root"),
        ("formal-vacuity", "Formal vacuity",
         "Antecedent never true → vacuous pass. Starter: <code>a |-> b</code> with a always 0.",
         "fvac-root"),
    ]
    for slug, title, lead, root in specs:
        js_path = js_dir / f"{slug}.js"
        if not js_path.is_file():
            raise SystemExit(f"missing {js_path}")
        emit(slug, title, lead, root, js_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
