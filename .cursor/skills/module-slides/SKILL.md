---
name: module-slides
description: >-
  Builds per-module PPTX, PDF, natural TTS audio, and short narrated videos for
  lab-driven courses under courses/ (e.g. learn_unix or learn_git moduleNN-slug). Revises
  transcripts for spoken English, syncs outline/slides, dual Track A/B callouts,
  and captures browser-lab UI snapshots (Playwright) into assets/ for Track B.
  Use when the user mentions module-slides, module PPT/pptx, PDF, transcript,
  narration, TTS, video clips, quiz.json, lab screenshot/snapshot, or media for
  a course module.
---

# Module Slides

Turn **one course module** into a short teaching clip: **slides (PPTX) → PDF → natural narration → MP4**, plus optional quiz.

**Unit of work:** `courses/<course_id>/moduleNN-<slug>/` (lab-driven syllabus).  
**Not** book chapters under `lectures/` — that legacy layout is retired; use this skill for the monorepo courses.

Work **one module at a time** unless the user asks for a course bulk run.

## Scope

| In | Out |
|----|-----|
| `transcript.md` (spoken source of truth) | Rewriting course README / CHECKLIST unless asked |
| `outline.yaml` + `slides.md` | Inventing new labs or syllabus modules |
| `slides.pptx` / `slides.pdf` | Full-course marathon videos |
| `audio/` + `video.mp4` | Fake PDFs without LibreOffice |
| Optional `quiz.json` | Committing large binaries unless asked |

**Dual tracks (when the module has them):** narration may mention Track A (real shell / examples) and Track B (browser lab) — say them as “real Unix track” / “browser lab track”, never as raw URLs in speech.

## Directory layout (per module)

```
courses/<course>/moduleNN-slug/
  README.md              # outcomes, Track A/B links (existing)
  CHECKLIST.md
  EXAMPLES.md
  examples/              # Track A trees
  transcript.md          # SOURCE OF TRUTH for slides + TTS
  outline.yaml           # machine deck (synced from transcript)
  slides.md              # Marp view (synced)
  quiz.json              # optional 3–5 formative items
  slides.pptx            # primary deck (also accept clip.pptx)
  slides.pdf
  video.mp4              # narrated clip (module root, beside slides)
  audio/full.mp3
  audio/slide_timings.json
  assets/                # optional screenshots
  outline.yaml           # already stubbed on scaffold — replace when authoring
```

| Convention | Rule |
|------------|------|
| Module folder | `module{NN}-{slug}/` with zero-padded `NN` |
| Transcript | `## Slide N — Title` blocks; prose under each = TTS |
| Deck filenames | Prefer `slides.pptx` / `slides.pdf`; scripts may still write `clip.pptx` — rename or copy if needed |
| Course map | [`syllabus.md`](../../../syllabus.md) · course `docs/MODULES.md` |

## Design principles

1. **One module ≈ one clip** — Target **3–8 minutes** spoken; hard cap **~10 minutes**.
2. **Transcript first** — Write/revise `transcript.md` for the **ear**, then sync slides. Never shorten speech to fit bullets.
3. **Bullets ≠ narration** — Slides summarize; transcript teaches.
4. **Natural speech** — Revise stub/robotic transcripts before TTS (see below).
5. **Re-sync after edits** — transcript → outline → PPTX → PDF → narrate.

## Workflow

```
Module-Slides Progress:
- [ ] 1. Read module README + syllabus row + lab status (S/P)
- [ ] 2. Draft or revise transcript.md (natural speech + ## Slide N)
- [ ] 2b. Capture lab UI snapshot into assets/ (Track B / intro tools)
- [ ] 3. Sync outline.yaml + slides.md from transcript
- [ ] 4. Build slides.pptx; verify_clip.py
- [ ] 5. Export slides.pdf (LibreOffice) when available
- [ ] 6. TTS + narrated MP4 (narrate_clips.sh / synthesize + build_video)
- [ ] 7. Optional quiz.json
- [ ] 8. Packaging report
```

### Step 1: Inventory

From the module folder and course docs:

| Field | Source |
|-------|--------|
| Title / kind | `README.md` (`intro` / `lab` / `wrap` / …) |
| Primary lab | README lab id + shipped/planned |
| Track A examples | `examples/`, `EXAMPLES.md` |
| Track B URL | tools index / lab path |
| Existing stubs | `outline.yaml`, `transcript.md` |

### Step 2: Transcript (source of truth)

Replace scaffold stubs with a full clip transcript:

```markdown
# Module NN — Title

**Module id:** moduleNN-slug
**Lab:** lab-id or none
**Tracks:** A (real shell) · B (browser lab) · or intro/wrap only

## Slide 1 — Title

Spoken prose for slide 1…

## Slide 2 — Why this matters

…
```

**Consistency (non-negotiable):**

- Every `## Slide N — Title` = one PPTX slide = one TTS segment.
- Outline `notes` for slide N = transcript body for that slide.
- After edits: re-sync → rebuild PPTX/PDF → re-narrate.

### Step 2b: Revise for natural audio (required before TTS)

Scaffold transcripts often sound like READMEs. **Revise before synthesizing.**

| Do | Don’t |
|----|--------|
| Short sentences; contractions OK (“you’ll”, “it’s”) | Wall of markdown / checklist language |
| Spoken transitions (“Next,” “Here’s the idea,” “Try this”) | “Outcomes:” / “Kind: lab” read aloud |
| Say “browser lab” / “real terminal” | Read URLs, `http://…`, or `~/unix_practice` paths as code |
| Say “module three” or “this module” | “Module 03” with leading zero in speech |
| Name each demo command and what it does | Bare command dumps with no purpose |
| One idea per slide; 45–90 seconds aloud | Cramming Track A and B demos into one breath |
| Impersonal teaching voice with warmth | Hype (“amazing”, “crucial”) or slang overload |

**Read-aloud test:** If it sounds like documentation, rewrite. Prefer:

> “In a real terminal, change into the examples folder for this module and list the files.”

over:

> “Open `examples/` under `module03-path-abs-rel` and run `ls -la`.”

Paths and commands belong on **slides** (and Track A EXAMPLES), not in every spoken sentence. Mention one demo command only when it helps the learner hear it.

**Dual-track slide pattern (lab modules):**

1. Opener + promise  
2. Concept  
3. Browser lab (Track B) — **orient, don’t tour** + UI snapshot  
4. Real shell (Track A) — **introduce examples** + try-these commands on slide  
5. Pitfall  
6. Your turn + quiz nudge  

Intro/wrap modules skip lab / examples demos.

### Pedagogy: how much to teach in the clip

| Track | Clip job | Leave for the learner |
|-------|----------|------------------------|
| **B — Browser lab** | Orient: name 2–3 UI regions (challenge, terminal/tree, Check), show **lab** snapshot (`assets/lab-starter.png`), one first action | Full challenge walkthrough, every button |
| **A — Real Unix** | Introduce `examples/`, show a **real-shell** frame (`assets/real-shell.png`) + try-these `code` slide — same environment as later Icarus/Verilator/Git work | Exhaustive EXAMPLES.md tour |

**Track B rule of thumb:** lab screenshot teaches the layout; speech says “open the lab, use the challenge panel, explore.” Do **not** narrate a full UI manual.

**Track A rule of thumb (default visual = real terminal):** Prefer a captured WSL/Linux session over the browser lab UI. EDA tools (Icarus, Verilator, Make, Git) run in a real shell — slides should look like that early. Capture with:

```bash
python .cursor/skills/module-slides/scripts/capture_real_shell.py \
  courses/<course>/moduleNN-slug \
  --example-subdir <folder> \
  --commands "pwd,ls -la,…"

# Or run a prepared demo script (learn_git pattern):
python .cursor/skills/module-slides/scripts/capture_real_shell.py \
  courses/learn_git/module02-git-graph \
  --bash-script assets/_demo_m02.sh
# → assets/real-shell.png (+ .txt)
```

### Explain every demo command (required)

Do **not** dump a bare command list. For each try-these line, the learner must hear (and preferably see) **what it does**.

| Where | Rule |
|-------|------|
| **Speech** | Name the command in spoken English and give a one-beat purpose (“print working directory”, “list including hidden files”) |
| **Code slide** | `#` comment above each command; **one blank line between command groups** |
| **Flags** | Explain non-obvious flags (`-la`, `--help`, pipes like `head`) in the same breath or comment |
| **Don’t** | Read punctuation aloud (`ls dash ell ay`); say “list with a long listing that includes hidden files” |

`build_pptx` also auto-inserts a blank line after each command when the fence omitted one, so spacing stays readable.

Pattern for Track A sections:

~~~~markdown
## Slide 4 — Real shell practice

![Real shell session](assets/real-shell.png)

In the real Unix track, open this module’s navigation example.
First, print the working directory so you know where you are.
Then list everything here, including hidden files, in the long format.
Change into the sample project folder, list again, then move up one level with two dots.

~~~~bash
# pwd — print working directory (where am I?)
pwd

# ls -la — list all entries, long format (what is here?)
ls -la

# cd sample_repo — change into this directory
cd sample_repo

# ls — list names only
ls

# cd .. — go up one directory
cd ..
~~~~
~~~~

Lab `assets/lab*` images stay full **`image`** slides (Track B). `assets/real-shell*.png` are full **`image`** slides (Track A); a following bash fence still emits a **`code`** slide. TTS skips the fence (including `#` comments); explanations live in the spoken prose above.

### Step 2b: Lab UI snapshot (Track B / intro)

For lab modules (and intro “tools map” beats), capture a real screenshot of the browser lab so the Track B slide shows the UI — not only a description.

**Prereqs**

```bash
pip install -r .cursor/skills/module-slides/scripts/requirements.txt
playwright install chromium

# Local preferred (matches Track B URLs in CHECKLIST):
python -m http.server 8080 --directory platform
```

**Capture**

```bash
# Lab id from README "Primary lab: `…`"
python .cursor/skills/module-slides/scripts/capture_lab_snapshot.py \
  courses/<course>/moduleNN-slug \
  --patch-outline

# Or explicit lab / live site:
python .cursor/skills/module-slides/scripts/capture_lab_snapshot.py \
  courses/learn_unix/module03-path-abs-rel \
  --lab path-abs-rel \
  --base https://universal-verification-methodology.github.io/learning/tools \
  --patch-outline

# Intro tools index:
python .cursor/skills/module-slides/scripts/capture_lab_snapshot.py \
  courses/learn_unix/module00-intro \
  --lab index \
  --name tools-index.png \
  --patch-outline
```

Writes `assets/lab-starter.png` (or `--name`). With `--patch-outline`, inserts/updates an `image` slide in `outline.yaml`.

**Authoring rules**

- Prefer embedding in `transcript.md` so re-sync keeps the image:

```markdown
## Slide 3 — Browser lab

![Browser lab starter](assets/lab-starter.png)

In the browser lab track, open this lab and load the starter example…
```

- Lab snapshots under `assets/lab*` become a **full-slide `image`** (not a cramped two-column) so they read clearly in PPTX/PDF/video.
- Or use `--patch-outline` after sync; re-run patch if you re-sync without the markdown image.
- Narration orients the learner (“look at the starter panel”) — do **not** read the URL aloud.
- Re-capture after lab UI changes; commit PNGs only when the user wants media in git.
- Crop with `--selector main` when chrome/header is noisy; use `--full-page` sparingly.

If Playwright/Chromium is unavailable, leave `(screenshot pending: …)` via a missing path and continue — do not invent fake UI art.

### Step 3: Sync slides from transcript

```bash
pip install -r .cursor/skills/module-slides/scripts/requirements.txt

python .cursor/skills/module-slides/scripts/transcript_to_outline.py \
  courses/<course>/moduleNN-slug
```

Writes/updates `outline.yaml` + `slides.md`. Slide bullets are summaries of prose (`prose_to_bullets.py`).

### Step 4: Build and verify PPTX

```bash
python .cursor/skills/module-slides/scripts/build_pptx.py \
  courses/<course>/moduleNN-slug

python .cursor/skills/module-slides/scripts/verify_clip.py \
  courses/<course>/moduleNN-slug
```

Also run transcript consistency:

```bash
python .cursor/skills/module-slides/scripts/verify_transcript_consistency.py \
  courses/<course>/moduleNN-slug
```

**Layout rules:** 20 pt body / 28 pt headings; max 6 bullets; ~100 chars/bullet; no auto-shrink; footer like `learn_unix — paths`.

### Step 5: PDF

```bash
bash .cursor/skills/module-slides/scripts/pptx_to_pdf.sh \
  courses/<course>/moduleNN-slug/slides.pptx
```

If the builder emitted `clip.pptx`, convert that file (or rename to `slides.pptx` first). PDF frames feed high-fidelity video. If LibreOffice is missing, report PDF deferred — do not fake it.

### Step 6: Audio + video

```bash
bash .cursor/skills/module-slides/scripts/narrate_clips.sh \
  courses/<course>/moduleNN-slug
```

Or:

```bash
bash .cursor/skills/module-slides/scripts/synthesize_audio.sh courses/<course>/moduleNN-slug
bash .cursor/skills/module-slides/scripts/build_video.sh --target-dir courses/<course>/moduleNN-slug
```

Outputs: `audio/full.mp3`, timings, `video.mp4` (module root). Default voice `en-US-JennyNeural` (`VOICE=...` to override).

TTS skips H1 / metadata / `## Slide` headings — only narration paragraphs are spoken. Still write path-free prose; rewriting in `transcript_to_speech.py` is a safety net.

### Step 7: Quiz (optional)

`quiz.json` — 3–5 items tied to **this module’s** objectives (see [reference.md](reference.md)).

### Step 8: Packaging report

```
Course: <course_id>
Module: NN — title (kind)
Lab: id (S|P|none)
Artifacts: transcript / outline / slides.md / pptx / pdf / audio / video / quiz
Natural-speech revise: yes/no
Deferred: …
```

## Bulk (when asked)

For a whole course, loop modules in syllabus order; still revise transcripts individually before narrating. Do not batch-TTS unrevised stubs.

## Quality bar

- [ ] Transcript uses `## Slide N — Title` and passes read-aloud test  
- [ ] No raw URLs or repo paths in spoken prose  
- [ ] Dual tracks described in speech when module is `lab`  
- [ ] Track B: orient + **lab** snapshot (not a full UI tour)  
- [ ] Track A: **real-shell** frame + examples / try-these (not browser-lab chrome)  
- [ ] Every demo command explained (speech + `#` comments or bullets) — not a bare dump  
- [ ] `verify_transcript_consistency.py` + `verify_clip.py` pass  
- [ ] Spoken length estimate ≤ 10 minutes (`words / 140`)  
- [ ] PPTX exists; PDF if LibreOffice available  
- [ ] MP4 only after natural transcript + PDF/frames when toolchain exists  

## Scripts (skill root)

| Script | Role |
|--------|------|
| `transcript_to_outline.py` | Transcript → outline + slides.md |
| `build_pptx.py` | outline → `slides.pptx` / `clip.pptx` |
| `verify_clip.py` | Bullet/image/deck checks |
| `verify_transcript_consistency.py` | Transcript ↔ outline notes |
| `pptx_to_pdf.sh` | LibreOffice export |
| `capture_lab_snapshot.py` | Track B lab UI → `assets/lab-starter.png` |
| `capture_real_shell.py` | Track A real WSL/bash session → `assets/real-shell.png` |
| `narrate_clips.sh` | TTS + timings + MP4 |
| `synthesize_audio.sh` / `build_video.sh` | Manual media steps |
| `prose_to_bullets.py` / `transcript_to_speech.py` | Helpers |

Install: `pip install -r .cursor/skills/module-slides/scripts/requirements.txt`

## Related

- Syllabus: [`syllabus.md`](../../../syllabus.md)  
- Example courses: `courses/learn_unix/` · `courses/learn_git/` (see [reference.md](reference.md) § learn_git)
- Schemas/templates: [reference.md](reference.md)
