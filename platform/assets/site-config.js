/**
 * Site integration keys — fill these in before going live.
 *
 * GA4: create a Google Analytics 4 property → copy Measurement ID (G-…).
 *
 * Leave empty strings to keep analytics off.
 */
window.SITE_CONFIG = {
  brand: "Digital Design and Verification Platform",
  /** Google Analytics 4 Measurement ID, e.g. "G-XXXXXXXXXX" */
  ga4MeasurementId: "G-VXR68XN19M",
  /** GitHub Issues URL used by community feedback forms. */
  feedbackIssuesUrl:
    "https://github.com/universal-verification-methodology/learning/issues/new",
  /** Public HDL Simulator Pages URL */
  simulatorUrl:
    "https://universal-verification-methodology.github.io/systemverilog-simulator/",
  /** Course media lives in org course repos (moduleNN-slug/video.mp4, slides.*) */
  githubOrg: "universal-verification-methodology",
  /** Branch used for media CDN links */
  mediaBranch: "main",
  /**
   * How to resolve media files from course repos.
   * "jsdelivr" → https://cdn.jsdelivr.net/gh/{org}/{repo}@{branch}/…
   * "raw" → https://raw.githubusercontent.com/{org}/{repo}/{branch}/…
   */
  mediaCdn: "jsdelivr",
  /**
   * Where lab pages load video / slides / quiz from.
   * "cdn"  — GitHub via mediaCdn (production / Pages)
   * "local"— /course-media/<repo>/moduleNN-slug/… (see platform/scripts/link_course_media.py)
   * "auto" — local on localhost / 127.0.0.1, otherwise cdn
   */
  mediaSource: "auto",
  /** localStorage namespace for lab progress */
  progressKey: "ddv.progress.v1",
};
