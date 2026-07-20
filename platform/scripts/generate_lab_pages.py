#!/usr/bin/env python3
"""Generate course lab pages from assets/catalog.json."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "assets" / "catalog.json"

COURSE_INDEX = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} — Labs</title>
  <link rel="stylesheet" href="../../assets/site.css">
</head>
<body data-asset-base="../../assets/">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="site-header-inner">
      <p class="brand"><a href="../../index.html">Digital Design and Verification Platform</a></p>
      <div class="site-header-tools">
        <nav class="site-nav" aria-label="Site">
          <a href="../../index.html">Home</a>
          <a href="../index.html" class="is-active" aria-current="page">Courses</a>
          <a href="../../tools/index.html">Tools</a>
          <a href="../../simulator/index.html">Simulator</a>
          <a href="../../path/index.html">Path</a>
          <a href="../../projects/index.html">Projects</a>
          <a href="../../community/index.html">Community</a>
        </nav>
        <div class="site-search" data-site-search></div>
      </div>
    </div>
    <div class="site-header-crumb">
      <nav aria-label="Breadcrumb">
        <a href="../../index.html">Home</a>
        <a href="../index.html">Courses</a>
        <span class="here">{course_id}</span>
      </nav>
    </div>
  </header>
  <main id="main">
    <div class="eyebrow">Course</div>
    <section class="hero">
      <h1>{title}</h1>
      <p class="lead">
        {lead}
      </p>
      <div data-course-progress></div>
      <div class="cta-row">
        <a class="btn btn-primary" href="labs/{first_lab}/index.html">Start Lab {first_n}</a>
        <a class="btn btn-secondary" href="{tools_href}">{tools_label}</a>
        <a class="btn btn-ghost" href="../../path/index.html">Path map</a>
      </div>
    </section>
    <h2>Labs</h2>
    <div data-render="course-labs" data-course="{course_id}"></div>
  </main>
  <footer class="site-footer">
    Repo: <code>courses/{course_id}/</code> · <a href="../../syllabus.md#{syllabus_anchor}">Syllabus section</a>
  </footer>
  <script src="../../assets/site-config.js"></script>
  <script src="../../assets/site.js"></script>
  <script src="../../assets/pages.js"></script>
</body>
</html>
"""

LAB_TPL = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} — {course_title}</title>
  <link rel="stylesheet" href="../../../../assets/site.css">
</head>
<body data-asset-base="../../../../assets/">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="site-header-inner">
      <p class="brand"><a href="../../../../index.html">Digital Design and Verification Platform</a></p>
      <div class="site-header-tools">
        <nav class="site-nav" aria-label="Site">
          <a href="../../../../index.html">Home</a>
          <a href="../../../index.html" class="is-active" aria-current="page">Courses</a>
          <a href="../../../../tools/index.html">Tools</a>
          <a href="../../../../simulator/index.html">Simulator</a>
          <a href="../../../../path/index.html">Path</a>
          <a href="../../../../projects/index.html">Projects</a>
          <a href="../../../../community/index.html">Community</a>
        </nav>
        <div class="site-search" data-site-search></div>
      </div>
    </div>
    <div class="site-header-crumb">
      <nav aria-label="Breadcrumb">
        <a href="../../../../index.html">Home</a>
        <a href="../../../index.html">Courses</a>
        <a href="../../index.html">{course_id}</a>
        <span class="here" data-lab-crumb>Lab {n}</span>
      </nav>
    </div>
  </header>
  <main id="main">
    <div data-render="lab" data-course="{course_id}" data-lab="{slug}" data-lab-root data-lab-title></div>
  </main>
  <footer class="site-footer">
    <a href="../../index.html">Course map</a> · progress saved in this browser only.
  </footer>
  <script src="../../../../assets/site-config.js"></script>
  <script src="../../../../assets/site.js"></script>
  <script src="../../../../assets/pages.js"></script>
</body>
</html>
"""

COURSE_META = {
    "learn_unix": {
        "lead": (
            "Shell fluency for digital design students — one guided lab at a time. "
            "Clips and decks load from "
            '<a href="https://github.com/universal-verification-methodology/learn_unix">learn_unix</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser tool, then mark the lab done."
        ),
        "tools_href": "../../tools/index.html#shell-filesystem",
        "tools_label": "Shell tools",
        "syllabus_anchor": "1-learn_unix",
        "first_lab": "vfs-terminal",
        "first_n": "01",
    },
    "learn_git": {
        "lead": (
            "Version control for coursework — graph, branches, remotes, and review. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_git">learn_git</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#version-control",
        "tools_label": "Git tools",
        "syllabus_anchor": "2-learn_git",
        "first_lab": "git-mental-model",
        "first_n": "01",
    },
    "learn_digital": {
        "lead": (
            "Digital logic foundations before deep HDL — numbers, gates, FSM, and datapath. "
            "All <strong>51</strong> modules ship narrated clips, slides, and quizzes from "
            '<a href="https://github.com/universal-verification-methodology/learn_digital">learn_digital</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#number-systems",
        "tools_label": "Digital labs",
        "syllabus_anchor": "3-learn_digital",
        "first_lab": "radix-converter",
        "first_n": "01",
    },
    "learn_verilog": {
        "lead": (
            "IEEE 1364 RTL coding — modules, always blocks, and synthesizability. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_verilog">learn_verilog</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#hdl-structure",
        "tools_label": "Verilog labs",
        "syllabus_anchor": "4-learn_verilog",
        "first_lab": "module-diagram",
        "first_n": "01",
    },
    "learn_systemverilog": {
        "lead": (
            "SystemVerilog design constructs (IEEE 1800) — not UVM. "
            "All <strong>14</strong> modules ship narrated clips, slides, and quizzes from "
            '<a href="https://github.com/universal-verification-methodology/learn_systemverilog">learn_systemverilog</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#sv-design",
        "tools_label": "SV design labs",
        "syllabus_anchor": "5-learn_systemverilog",
        "first_lab": "bit-vs-logic",
        "first_n": "01",
    },
    "learn_uvm2017": {
        "lead": (
            "UVM 2017 methodology literacy (IEEE 1800.2) — dual track: browser sketches + offline Accellera UVM. "
            "All <strong>24</strong> modules ship narrated clips, slides, and quizzes from "
            '<a href="https://github.com/universal-verification-methodology/learn_uvm2017">learn_uvm2017</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching UVM sketch, then mark done; "
            "module 22 is the offline Makefile run."
        ),
        "tools_href": "../../tools/index.html#uvm2017",
        "tools_label": "UVM 2017 sketches",
        "syllabus_anchor": "6-learn_uvm2017",
        "first_lab": "tb-layers",
        "first_n": "01",
    },
    "learn_verilator": {
        "lead": (
            "Verilator as a tool — lint, C++/DPI TB, traces, and metrics. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_verilator">learn_verilator</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#sim-literacy",
        "tools_label": "Simulation labs",
        "syllabus_anchor": "7-learn_verilator",
        "first_lab": "iverilog-vs-verilator",
        "first_n": "01",
    },
    "learn_iverilog": {
        "lead": (
            "Icarus Verilog as a tool — flags, timescale, TB timing, and waves. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_iverilog">learn_iverilog</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#sim-literacy",
        "tools_label": "Simulation labs",
        "syllabus_anchor": "8-learn_iverilog",
        "first_lab": "sim-pipeline",
        "first_n": "01",
    },
    "learn_pyuvm": {
        "lead": (
            "Python verification — cocotb → pyuvm, with shared UVM sketches. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_pyuvm">learn_pyuvm</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#pyuvm",
        "tools_label": "pyuvm / cocotb labs",
        "syllabus_anchor": "10-learn_pyuvm",
        "first_lab": "python-async-tb",
        "first_n": "01",
    },
    "learn_uart": {
        "lead": (
            "UART spec → RTL → TB → waves → VIP map. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_uart">learn_uart</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#protocols",
        "tools_label": "Protocol labs",
        "syllabus_anchor": "11-learn_uart",
        "first_lab": "uart-frame",
        "first_n": "01",
    },
    "learn_spi": {
        "lead": (
            "SPI wires & modes → RTL → TB → waves → VIP map. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_spi">learn_spi</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#protocols",
        "tools_label": "Protocol labs",
        "syllabus_anchor": "12-learn_spi",
        "first_lab": "spi-step",
        "first_n": "01",
    },
    "learn_i2c": {
        "lead": (
            "I²C open-drain → RTL → TB → waves → VIP map. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_i2c">learn_i2c</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#protocols",
        "tools_label": "Protocol labs",
        "syllabus_anchor": "13-learn_i2c",
        "first_lab": "i2c-lab",
        "first_n": "01",
    },
    "learn_hdl_simulator": {
        "lead": (
            "Guided path for the public HDL Simulator — browser <code>hdl-sim-*</code> literacy plus free IDE practice. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_hdl_simulator">learn_hdl_simulator</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching lab, then try the same idea in the live IDE."
        ),
        "tools_href": "../../tools/index.html#hdl-simulator",
        "tools_label": "HDL simulator labs",
        "syllabus_anchor": "9-learn_hdl_simulator",
        "first_lab": "hdl-sim-tour",
        "first_n": "01",
    },
    "learn_verification_planning_management": {
        "lead": (
            "Plan → coverage → regression → sign-off — interactive boards plus written plan practice. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_verification_planning_management">learn_verification_planning_management</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html#verif-plan",
        "tools_label": "Planning labs",
        "syllabus_anchor": "14-learn_verification_planning_management",
        "first_lab": "verif-plan-check",
        "first_n": "01",
    },
    "learn_python_hw": {
        "lead": (
            "Python on-ramp for hardware verification — async TB, vectors, venv/pytest — before cocotb. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_python_hw">learn_python_hw</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching lab, then practice offline."
        ),
        "tools_href": "../../tools/index.html",
        "tools_label": "Tools shelf",
        "syllabus_anchor": "15-learn_python_hw",
        "first_lab": "python-async-tb",
        "first_n": "01",
    },
    "learn_sv_tb": {
        "lead": (
            "Directed SystemVerilog testbench literacy — self-check, CRV, cover, SVA — before UVM. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_sv_tb">learn_sv_tb</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching browser lab, then mark done."
        ),
        "tools_href": "../../tools/index.html",
        "tools_label": "SV TB labs",
        "syllabus_anchor": "16-learn_sv_tb",
        "first_lab": "tb-anatomy",
        "first_n": "01",
    },
    "learn_cocotb": {
        "lead": (
            "cocotb as a Python testbench — triggers, DUT handles, self-check — before pyuvm. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_cocotb">learn_cocotb</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Open the matching lab, then run a real cocotb example offline."
        ),
        "tools_href": "../../tools/index.html",
        "tools_label": "cocotb labs",
        "syllabus_anchor": "17-learn_cocotb",
        "first_lab": "python-async-tb",
        "first_n": "01",
    },
    "learn_formal": {
        "lead": (
            "Formal verification literacy — assert / assume / cover, BMC, counterexamples — not a full commercial flow. "
            "Media loads from "
            '<a href="https://github.com/universal-verification-methodology/learn_formal">learn_formal</a> '
            "(<code>moduleNN-slug/video.mp4</code>). Use browser SVA/cover sketches, then SymbiYosys offline."
        ),
        "tools_href": "../../tools/index.html",
        "tools_label": "SVA / cover labs",
        "syllabus_anchor": "18-learn_formal",
        "first_lab": "sva-timeline",
        "first_n": "01",
    },
}


def main() -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    total = 0
    for course in cat["courses"]:
        if course.get("status") != "ready" or not course.get("labs"):
            continue
        cid = course["id"]
        meta = COURSE_META.get(cid, {})
        first = next((l for l in course["labs"] if l.get("kind") == "lab"), course["labs"][0])
        index_path = ROOT / "courses" / cid / "index.html"
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(
            COURSE_INDEX.format(
                title=course["title"],
                course_id=cid,
                lead=meta.get(
                    "lead",
                    f'Guided labs for <a href="https://github.com/universal-verification-methodology/{cid}">{cid}</a>.',
                ),
                first_lab=meta.get("first_lab", first["slug"]),
                first_n=meta.get("first_n", first["n"]),
                tools_href=meta.get("tools_href", "../../tools/index.html"),
                tools_label=meta.get("tools_label", "Tools shelf"),
                syllabus_anchor=meta.get("syllabus_anchor", cid.replace("_", "-")),
            ),
            encoding="utf-8",
        )

        for lab in course["labs"]:
            dest = ROOT / "courses" / cid / "labs" / lab["slug"]
            dest.mkdir(parents=True, exist_ok=True)
            (dest / "index.html").write_text(
                LAB_TPL.format(
                    title=lab["title"],
                    course_title=course["title"],
                    course_id=cid,
                    n=lab["n"],
                    slug=lab["slug"],
                ),
                encoding="utf-8",
            )
            total += 1
        print(f"{cid}: index + {len(course['labs'])} lab pages")

    print(f"wrote {total} lab pages total")


if __name__ == "__main__":
    main()
