/**
 * Course / lab / path-map page renderers (depends on site.js → window.DDV).
 */
(() => {
  const D = window.DDV;
  if (!D) return;

  function kindLabel(kind) {
    const map = { intro: "Intro", lab: "Lab", wrap: "Wrap", bridge: "Bridge", offline: "Offline" };
    return map[kind] || kind || "Lab";
  }

  function toolHref(toolId, depth) {
    if (!toolId) return null;
    const prefix = "../".repeat(depth);
    return `${prefix}tools/${toolId}/index.html`;
  }

  function moduleDir(lab) {
    return `module${lab.n}-${lab.slug}`;
  }

  /** Prefer monorepo course media when authoring on localhost. */
  function useLocalMedia(cfg) {
    const mode = String(cfg.mediaSource || "cdn").toLowerCase();
    if (mode === "local") return true;
    if (mode === "cdn") return false;
    // "auto" (default for local authoring): localhost only
    const h = (location && location.hostname) || "";
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  }

  /** Media URLs from org course repos (video.mp4, slides.pptx, …). */
  function mediaUrls(course, lab) {
    const cfg = D.cfg || {};
    const org = cfg.githubOrg || "universal-verification-methodology";
    const branch = cfg.mediaBranch || "main";
    const repo = (course && course.repo) || (course && course.id) || "";
    const dir = moduleDir(lab);
    const local = useLocalMedia(cfg);
    const cdn = (cfg.mediaCdn || "jsdelivr").toLowerCase();
    const fileUrl = (file) => {
      if (local && repo) {
        // Served from platform/course-media/<repo> → ../../courses/<repo>
        // (create with: python platform/scripts/link_course_media.py)
        const depth = document.querySelector("[data-asset-base]");
        const assetBase = (depth && depth.getAttribute("data-asset-base")) || "../../assets/";
        // asset-base is N×../assets/ ; course-media sits beside assets under platform/
        const prefix = String(assetBase).replace(/assets\/?$/, "course-media/");
        return `${prefix}${repo}/${dir}/${file}`;
      }
      if (cdn === "raw") {
        return `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${dir}/${file}`;
      }
      return `https://cdn.jsdelivr.net/gh/${org}/${repo}@${branch}/${dir}/${file}`;
    };
    return {
      org,
      repo,
      branch,
      dir,
      local,
      moduleGithub: `https://github.com/${org}/${repo}/tree/${branch}/${dir}`,
      repoGithub: `https://github.com/${org}/${repo}`,
      video: fileUrl("video.mp4"),
      slidesPptx: fileUrl("slides.pptx"),
      slidesPdf: fileUrl("slides.pdf"),
      quiz: fileUrl("quiz.json"),
      transcript: fileUrl("transcript.md"),
    };
  }

  function renderCourseList(root) {
    D.loadCatalog().then((cat) => {
      const ul = document.createElement("ul");
      ul.className = "chapter-list";
      const org = (D.cfg && D.cfg.githubOrg) || "universal-verification-methodology";
      (cat.courses || []).forEach((c) => {
        const stats = D.courseStats(c);
        const li = document.createElement("li");
        const ready = c.status === "ready";
        if (ready) {
          li.innerHTML = `<a href="${c.id}/index.html">
            <span class="tool-title">${escape(c.title)}</span>
            <div class="chapter-meta">${escape(c.focus || "")}
              ${stats.total ? ` · ${stats.done}/${stats.total} labs done (${stats.pct}%)` : ""}
            </div>
          </a>`;
        } else {
          li.className = "is-planned";
          li.innerHTML = `<span class="tool-title">${escape(c.title)}
            <span class="pill-soon">Coming soon</span></span>
            <div class="chapter-meta">${escape(c.focus || "")} · guided lab pages not published yet
              · see <a href="../syllabus.md">syllabus</a> · <a href="../tools/index.html">tools</a>
              ${c.repo ? ` · <a href="https://github.com/${escape(org)}/${escape(c.repo)}">repo</a>` : ""}</div>`;
        }
        ul.appendChild(li);
      });
      root.innerHTML = "";
      root.appendChild(ul);
    });
  }

  function renderCourseLabs(root, courseId) {
    D.loadCatalog().then((cat) => {
      const course = (cat.courses || []).find((c) => c.id === courseId);
      if (!course) {
        root.innerHTML = `<p class="lead">Course not found in catalog.</p>`;
        return;
      }
      const stats = D.courseStats(course);
      const progressEl = document.querySelector("[data-course-progress]");
      if (progressEl) {
        progressEl.innerHTML = stats.total
          ? `<div class="progress-bar" aria-label="Course progress">
               <div class="progress-bar-fill" style="width:${stats.pct}%"></div>
             </div>
             <p class="progress-meta">${stats.done} of ${stats.total} labs marked done (${stats.pct}%)
               · <button type="button" class="btn-link" data-reset-course="${courseId}">Reset progress</button></p>`
          : `<p class="progress-meta">Lab list placeholder — progress unlocks when labs ship.</p>`;
        const reset = progressEl.querySelector("[data-reset-course]");
        if (reset) {
          reset.addEventListener("click", () => {
            if (confirm("Clear saved progress for this course?")) {
              D.resetProgress(courseId);
              renderCourseLabs(root, courseId);
            }
          });
        }
      }

      if (!course.labs || !course.labs.length) {
        const media = mediaUrls(course, { n: "00", slug: "intro" });
        root.innerHTML = `
          <div class="placeholder-panel">
            <h2>Labs coming soon</h2>
            <p>Guided lab pages for <code>${escape(courseId)}</code> are not on the site yet.
            Meanwhile use the <a href="../../tools/index.html">tools shelf</a>, the
            <a href="../../syllabus.md">syllabus</a>, and the course repo
            <a href="${escape(media.repoGithub)}">${escape(media.repoGithub)}</a>.</p>
          </div>`;
        return;
      }

      const ul = document.createElement("ul");
      ul.className = "chapter-list lab-list";
      course.labs.forEach((lab) => {
        const done = D.labDone(courseId, lab.slug);
        const planned = lab.status === "planned";
        const href = `labs/${lab.slug}/index.html`;
        const li = document.createElement("li");
        if (planned) {
          li.className = "is-planned";
          li.innerHTML = `<span class="tool-title">
              <span class="lab-num">Lab ${lab.n}</span> ${escape(lab.title)}
              <span class="pill-soon">Coming soon</span>
              ${done ? '<span class="pill-done">Done</span>' : ""}
            </span>
            <div class="chapter-meta">${kindLabel(lab.kind)}${lab.toolId ? ` · tool <code>${escape(lab.toolId)}</code>` : ""}</div>`;
        } else {
          li.innerHTML = `<a href="${href}" class="${done ? "is-done" : ""}">
              <span class="tool-title">
                <span class="lab-num">Lab ${lab.n}</span> ${escape(lab.title)}
                ${done ? '<span class="pill-done">Done</span>' : ""}
              </span>
              <div class="chapter-meta">${kindLabel(lab.kind)}${lab.toolId ? ` · open tool after the clip` : ""}</div>
            </a>`;
        }
        ul.appendChild(li);
      });
      root.innerHTML = "";
      root.appendChild(ul);
    });
  }

  function renderLabPage(courseId, slug) {
    const root = document.querySelector("[data-lab-root]");
    if (!root) return;
    D.loadCatalog().then((cat) => {
      const course = (cat.courses || []).find((c) => c.id === courseId);
      const labs = (course && course.labs) || [];
      const idx = labs.findIndex((l) => l.slug === slug);
      const lab = labs[idx];
      if (!lab) {
        root.innerHTML = `<p class="lead">Lab not found.</p>`;
        return;
      }
      const prev = idx > 0 ? labs[idx - 1] : null;
      const next = idx < labs.length - 1 ? labs[idx + 1] : null;
      const done = D.labDone(courseId, slug);
      const tool = toolHref(lab.toolId, 4);
      const media = mediaUrls(course, lab);
      const titleEl = document.querySelector("[data-lab-title]");
      if (titleEl) titleEl.textContent = lab.title;
      document.title = `${lab.title} — ${course.title}`;

      const crumbHere = document.querySelector("[data-lab-crumb]");
      if (crumbHere) crumbHere.textContent = `Lab ${lab.n}`;

      root.innerHTML = `
        <div class="eyebrow">${escape(course.title)} · Guided lab</div>
        <section class="hero">
          <h1>${escape(lab.title)}</h1>
          <div class="clip-meta">
            <span class="pill">Lab ${escape(lab.n)} of ${String(labs.length).padStart(2, "0")}</span>
            <span class="pill pill-muted">${escape(kindLabel(lab.kind))}</span>
            ${lab.status === "planned" ? '<span class="pill-soon">Coming soon</span>' : ""}
            ${done ? '<span class="pill-done">Done</span>' : ""}
          </div>
          <nav class="clip-toolbar" aria-label="Lab actions">
            ${
              prev
                ? `<a class="btn btn-secondary" href="../${prev.slug}/index.html">← Previous</a>`
                : `<span class="btn btn-secondary is-disabled">← Previous</span>`
            }
            ${
              tool
                ? `<a class="btn btn-primary" href="${tool}">Open tool</a>`
                : `<span class="btn btn-ghost is-disabled">No browser tool</span>`
            }
            <a class="btn btn-secondary" href="${escape(media.slidesPptx)}">Download PPTX</a>
            <a class="btn btn-secondary" href="${escape(media.slidesPdf)}">Download PDF</a>
            <a class="btn btn-ghost" href="#quiz">Jump to quiz</a>
            <a class="btn btn-ghost" href="${escape(media.moduleGithub)}" rel="noopener">Module on GitHub</a>
            <button type="button" class="btn ${done ? "btn-ghost" : "btn-secondary"}" data-toggle-done>
              ${done ? "Mark not done" : "Mark lab done"}
            </button>
            ${
              next
                ? `<a class="btn btn-secondary" href="../${next.slug}/index.html">Next →</a>`
                : `<a class="btn btn-secondary" href="../../index.html">Course map →</a>`
            }
          </nav>
        </section>

        <section class="video-panel" aria-label="Lab video">
          <div class="video-wrap">
            <video controls preload="metadata" playsinline>
              <source src="${escape(media.video)}" type="video/mp4">
            </video>
            <div class="video-placeholder" hidden>
              Video not available yet in
              <a href="${escape(media.moduleGithub)}" rel="noopener"><code>${escape(media.dir)}/video.mp4</code></a>.
              Download the PPTX/PDF or open the tool to continue.
            </div>
          </div>
        </section>

        <h2>What to do</h2>
        <ol class="lab-steps">
          <li>Watch the clip (from the course repo) or skim the slides.</li>
          ${
            tool
              ? `<li><a href="${tool}">Open the browser tool</a>${lab.toolId ? ` (<code>${escape(lab.toolId)}</code>)` : ""} — load the starter example, then try challenges.</li>`
              : `<li>This step is ${escape(kindLabel(lab.kind)).toLowerCase()} — no primary tool; follow the module README on GitHub.</li>`
          }
          <li>Optional: practice Track A from
            <a href="${escape(media.repoGithub)}" rel="noopener">${escape(media.repo)}</a>.</li>
          <li>Mark the lab done when you are satisfied (saved in this browser only).</li>
        </ol>

        <div id="quiz" class="placeholder-panel">
          <h2>Quiz</h2>
          <p>Loading quiz from <code>quiz.json</code>…</p>
        </div>

        <p class="lead" style="margin-top:1.5rem">
          Media source:
          <a href="${escape(media.moduleGithub)}" rel="noopener"><code>${escape(media.org)}/${escape(media.repo)}/${escape(media.dir)}/</code></a>
          · <a href="../../../../syllabus.md">Syllabus</a>
        </p>
      `;

      const toggle = root.querySelector("[data-toggle-done]");
      if (toggle) {
        toggle.addEventListener("click", () => {
          D.setLabDone(courseId, slug, !D.labDone(courseId, slug));
          renderLabPage(courseId, slug);
        });
      }

      const video = root.querySelector("video");
      const ph = root.querySelector(".video-placeholder");
      if (video && ph) {
        video.addEventListener("error", () => {
          video.style.display = "none";
          ph.hidden = false;
        });
        video.style.display = "";
        ph.hidden = true;
      }

      const nextHref = next ? `../${next.slug}/index.html` : "../../index.html";
      const nextLabel = next ? "Next lab →" : "Course map →";
      loadAndMountQuiz(media.quiz, root.querySelector("#quiz"), {
        nextHref,
        nextLabel,
        onPass: () => {
          D.setLabDone(courseId, slug, true);
        },
      });
    });
  }

  function ensureQuizScript() {
    if (window.DDVQuiz) return Promise.resolve();
    const base = (document.querySelector("[data-asset-base]") || {}).getAttribute?.("data-asset-base")
      || "assets/";
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `${base}quiz.js`;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("quiz.js failed to load"));
      document.head.appendChild(s);
    });
  }

  function normalizeQuiz(quiz) {
    if (!quiz || typeof quiz !== "object") return quiz;
    if (Array.isArray(quiz.items) && quiz.items.length) return quiz;
    // Compact author form: { questions: [{ prompt, choices, answer }, …] }
    if (Array.isArray(quiz.questions) && quiz.questions.length) {
      return {
        ...quiz,
        title: quiz.title || "Check your understanding",
        items: quiz.questions.map((q, i) => ({
          id: q.id || `q${i + 1}`,
          type: q.type || "multiple_choice",
          prompt: q.prompt || "",
          choices: q.choices || [],
          answer: q.answer,
          explain: q.explain,
        })),
      };
    }
    return quiz;
  }

  function loadAndMountQuiz(quizUrl, quizRoot, opts) {
    if (!quizRoot) return;
    ensureQuizScript()
      .then(() => fetch(quizUrl, { cache: "no-cache" }))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((quiz) => {
        window.DDVQuiz.mount(quizRoot, normalizeQuiz(quiz), opts);
      })
      .catch(() => {
        quizRoot.className = "placeholder-panel";
        quizRoot.innerHTML = `
          <h2>Quiz</h2>
          <p>Quiz not available yet. When <code>quiz.json</code> is published in the module folder,
          it will load here automatically.</p>
          <p><a href="${String(quizUrl).replace(/"/g, "&quot;")}" rel="noopener">Open quiz.json URL</a></p>`;
      });
  }

  function renderPathMap(root) {
    D.loadCatalog().then((cat) => {
      const byId = Object.fromEntries((cat.courses || []).map((c) => [c.id, c]));
      const rows = [
        ["learn_unix", "learn_git"],
        ["learn_digital"],
        ["learn_verilog"],
        ["learn_systemverilog", "learn_hdl_simulator", "learn_iverilog", "learn_verilator"],
        ["learn_sv_tb", "learn_formal"],
        ["learn_uart", "learn_spi", "learn_i2c"],
        ["learn_python_hw", "learn_cocotb", "learn_pyuvm", "learn_uvm2017"],
        ["learn_verification_planning_management"],
      ];
      const html = rows
        .map((row) => {
          const cells = row
            .map((id) => {
              const c = byId[id];
              if (!c) return "";
              const stats = D.courseStats(c);
              const ready = c.status === "ready";
              const href = ready ? `../courses/${id}/index.html` : "../courses/index.html";
              const cls = [
                "ladder-node",
                ready ? "is-ready" : "is-placeholder",
                stats.pct === 100 && stats.total ? "is-complete" : "",
                stats.done > 0 && stats.pct < 100 ? "is-progress" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return `<a class="${cls}" href="${href}">
                <span class="ladder-id">${escape(id)}</span>
                <span class="ladder-title">${escape(c.title)}</span>
                <span class="ladder-meta">${ready ? `${stats.pct}%` : "Soon"}</span>
              </a>`;
            })
            .join("");
          return `<div class="ladder-row">${cells}</div>`;
        })
        .join('<div class="ladder-arrow" aria-hidden="true">↓</div>');

      root.innerHTML = `
        <div class="ladder-map">${html}</div>
        <p class="lead">Suggested order from the syllabus. Skip bridges when self-studying; prefer shipped tools before planned labs.</p>
      `;
    });
  }

  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.querySelectorAll("[data-render]").forEach((el) => {
    const mode = el.getAttribute("data-render");
    if (mode === "courses") renderCourseList(el);
    if (mode === "course-labs") renderCourseLabs(el, el.getAttribute("data-course"));
    if (mode === "path-map") renderPathMap(el);
    if (mode === "lab") {
      renderLabPage(el.getAttribute("data-course"), el.getAttribute("data-lab"));
    }
  });
})();
