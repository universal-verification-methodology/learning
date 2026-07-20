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
            "Media loads from "
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
