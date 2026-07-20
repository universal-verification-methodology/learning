from pathlib import Path
import re

root = Path("courses/learn_cocotb")
for m in sorted(root.glob("module*")):
    t = m / "transcript.md"
    text = t.read_text(encoding="utf-8") if t.exists() else ""
    slides = len(re.findall(r"^## Slide ", text, re.M))
    words = len(text.split())
    arts = {
        "quiz": (m / "quiz.json").exists(),
        "outline": (m / "outline.yaml").exists(),
        "pptx": (m / "slides.pptx").exists() or (m / "clip.pptx").exists(),
        "pdf": (m / "slides.pdf").exists(),
        "mp4": (m / "video.mp4").exists(),
        "lab_png": (m / "assets" / "lab-starter.png").exists(),
    }
    print(
        f"{m.name}: slides={slides} words={words} "
        + " ".join(f"{k}={v}" for k, v in arts.items())
    )
