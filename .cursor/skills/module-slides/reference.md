# Module Slides — Reference

Schemas and patterns for **module-slides** (per-module PPT/PDF/TTS/video under `courses/`).

## Planning

| Rule | Default |
|------|---------|
| Unit | One `moduleNN-slug` → one clip |
| Duration | Target **3–8 min**; cap **~10 min** spoken |
| Estimate | `word_count / 140` ≈ minutes |
| Video | Per module `video.mp4` (beside `slides.pptx` / `slides.pdf`) |
| Quiz | Optional 3–5 items |

## Natural transcript checklist

Before TTS, the transcript should pass:

1. **Read aloud** — sounds like a teacher, not a README  
2. **No paths in prose** — no `http://`, no `courses/…`, no `` `cmd` `` spam  
3. **Slide headings only as anchors** — TTS skips `## Slide N`  
4. **Contractions, spoken English** — “you’ll open”, not “The user shall proceed to”  
5. **One job per slide** — concept / Track B / Track A / pitfall / your turn  
6. **Commands on slides** — speech points at them (“run the list command shown here”)

### Before → after (examples)

| Stub / robotic | Natural |
|----------------|---------|
| “Outcomes: After this module you can explain `path-abs-rel`.” | “By the end of this short clip, you’ll know when a path is absolute and when it’s relative — and why that matters after you change directories.” |
| “Open http://127.0.0.1:8080/tools/path-abs-rel/index.html” | “In the browser lab track, open the absolute-versus-relative paths lab from the tools page, and load the starter example.” |
| “cd module03-path-abs-rel/examples/paths” | “In the real terminal track, go into this module’s paths example folder and print the working directory.” |
| “Kind: lab · Primary lab: vfs-terminal · Shipped” | *(delete from speech — metadata is not narration)* |

## `outline.yaml` (PPTX machine source)

```yaml
title: "Module 03 — Absolute vs relative paths"
footer: "learn_unix — paths"
slides:
  - type: title
    title: "Absolute vs relative paths"
    subtitle: "Module 03 · learn_unix"
    notes: |
      Full spoken paragraph for slide 1…
  - type: bullets
    title: "Absolute paths"
    bullets:
      - "Start from the filesystem root"
      - "Do not depend on your current directory"
    notes: |
      Matching transcript body for this slide…
```

| `type` | Fields |
|--------|--------|
| `title` | `title`, optional `subtitle`, `notes` |
| `section` | `title` |
| `bullets` | `title`, `bullets` (max 6), `notes` |
| `image` | `title`, `image`, optional `caption`, `notes` |
| `two_column` | `title`, `left` bullets, `right` image |
| `code` | `title`, `code`, optional `source_file`, `notes` |

**Notes field** must match the transcript body for that slide (verify script enforces this).

## Transcript shape

```markdown
# Module 03 — Absolute vs relative paths

**Module id:** module03-path-abs-rel
**Lab:** path-abs-rel
**Tracks:** A · B

## Slide 1 — Absolute vs relative paths

Spoken opener…

## Slide 2 — Why paths break after cd

…
```

Metadata lines after the H1 are **not** spoken (skipped by TTS prep). Keep them for authors.

## `quiz.json` (optional)

```json
{
  "module": "module03-path-abs-rel",
  "title": "Paths check",
  "passing_score": 0.67,
  "items": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "A path that starts with / is…",
      "choices": ["relative", "absolute", "a glob", "a symlink"],
      "answer": 1,
      "explain": "Leading slash means from the filesystem root."
    }
  ]
}
```

Types: `multiple_choice` | `true_false` | `short_answer`. Keep items inside this module’s teaching — no trivia from later modules.

## Dual-track slide map (lab modules)

| Slide role | Content |
|------------|---------|
| Title | Module promise |
| Concept | One idea |
| Track B | **Orient** + full-slide **lab** snapshot |
| Track A | **Real-shell** frame (`assets/real-shell.png`) + try-these `code` slide |
| Pitfall | Common mistake |
| Close | Checklist / quiz nudge |

`intro` / `wrap`: title → tools map (optional snapshot) → next module.

### Track B vs Track A depth

- **B:** Lab UI snapshot + short orient. Then “explore the challenges.”
- **A:** Prefer **real terminal** frames (WSL/Linux) — matches later Icarus/Verilator/Make/Git work. Capture with `capture_real_shell.py`.
- **Commands:** Every try-these line needs a **purpose** in speech and a `#` comment (or prior bullets). Never show unexplained flags.

```bash
python .cursor/skills/module-slides/scripts/capture_real_shell.py \
  courses/learn_unix/module01-vfs-terminal \
  --example-subdir navigation
```

Track A try-these fence (TTS skips it; sync emits a `code` slide after the image):

~~~~bash
# pwd — print working directory
pwd

# ls -la — list all, long format
ls -la

# cd sample_repo — enter this folder
cd sample_repo
~~~~

## Lab UI snapshots

Capture the live lab page into `assets/` for Track B slides.

```bash
# Serve platform/ locally, then:
python .cursor/skills/module-slides/scripts/capture_lab_snapshot.py \
  courses/learn_unix/module03-path-abs-rel \
  --patch-outline
# → assets/lab-starter.png + image slide in outline.yaml
```

| Flag | Purpose |
|------|---------|
| `--lab ID` | Override README primary lab (`index` = tools catalog) |
| `--base URL` | Default `http://127.0.0.1:8080/tools`; or live Pages tools URL |
| `--name file.png` | Output under `assets/` (default `lab-starter.png`) |
| `--selector CSS` | Crop to element (e.g. `main`, `#path-root`) |
| `--full-page` | Tall full-page capture |
| `--patch-outline` | Insert/update `type: image` slide |

**Transcript embed (survives re-sync):** put the image in the Track B section body:

```markdown
## Slide 3 — Browser lab

![Browser lab starter](assets/lab-starter.png)

In the browser lab track, open this lab from the tools page and load the starter…
```

`transcript_to_outline.py` turns that into an `image` (or `two_column`) slide; image markdown is stripped from TTS notes.

Requires: `pip install playwright` + `playwright install chromium`.

## Build commands

```bash
SKILL=.cursor/skills/module-slides/scripts
MOD=courses/learn_unix/module03-path-abs-rel

python $SKILL/capture_lab_snapshot.py "$MOD" --patch-outline   # after http.server
python $SKILL/transcript_to_outline.py "$MOD"
python $SKILL/build_pptx.py "$MOD"
python $SKILL/verify_clip.py "$MOD"
python $SKILL/verify_transcript_consistency.py "$MOD"
bash $SKILL/pptx_to_pdf.sh "$MOD/slides.pptx"   # or clip.pptx
bash $SKILL/narrate_clips.sh "$MOD"
```

## Footer / naming

`build_pptx.py` accepts folders named `moduleNN-slug` and writes **`slides.pptx`** with footer `course — slug words` when it can detect `courses/<course>/` in the path.

Also accepts legacy `part-*` / `clip-*` / `chapterN` folder names if those trees still exist in a repo.