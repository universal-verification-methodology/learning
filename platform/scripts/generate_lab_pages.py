#!/usr/bin/env python3
"""Generate learn_unix lab pages from assets/catalog.json."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "assets" / "catalog.json"

TPL = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} — Unix for design</title>
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
        <a href="../../index.html">learn_unix</a>
        <span class="here" data-lab-crumb>Lab {n}</span>
      </nav>
    </div>
  </header>
  <main id="main">
    <div data-render="lab" data-course="learn_unix" data-lab="{slug}" data-lab-root data-lab-title></div>
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


def main() -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    course = next(c for c in cat["courses"] if c["id"] == "learn_unix")
    for lab in course["labs"]:
        dest = ROOT / "courses" / "learn_unix" / "labs" / lab["slug"]
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "index.html").write_text(
            TPL.format(title=lab["title"], n=lab["n"], slug=lab["slug"]),
            encoding="utf-8",
        )
    print(f"wrote {len(course['labs'])} lab pages under courses/learn_unix/labs/")


if __name__ == "__main__":
    main()
