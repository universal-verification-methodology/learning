/**
 * Site integration keys — fill these in before going live.
 *
 * GA4: create a Google Analytics 4 property → copy Measurement ID (G-…).
 * Web3Forms: https://web3forms.com → Access Key (sent to your email).
 *
 * Leave empty strings to keep features as placeholders (forms show setup help;
 * analytics script is not loaded).
 */
window.SITE_CONFIG = {
  brand: "Digital Design and Verification Platform",
  /** Google Analytics 4 Measurement ID, e.g. "G-XXXXXXXXXX" */
  ga4MeasurementId: "G-VXR68XN19M",
  /** Web3Forms access key (UUID). Used by community feedback forms. */
  web3formsAccessKey: "ed1662a7-5909-4d45-b927-36ebfe734738",
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
  /** localStorage namespace for lab progress */
  progressKey: "ddv.progress.v1",
};
