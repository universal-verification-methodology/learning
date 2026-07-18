/**
 * Load the public HDL engine API (systemverilog-simulator).
 * Tools import this helper so we can switch vendor pin ↔ public Pages in one place.
 */

/** @type {{ publicUrl: string, vendorUrl: string, prefer: "vendor" | "public" }} */
export const HDL_ENGINE_SPEC = {
  publicUrl:
    "https://universal-verification-methodology.github.io/systemverilog-simulator/assets/engine.mjs",
  // Relative to this file: platform/assets/ → platform/vendor/...
  vendorUrl: new URL("../vendor/systemverilog-simulator/engine.mjs", import.meta.url).href,
  // Use "public" once the org Pages release includes assets/engine.mjs
  prefer: "vendor",
};

let cached = null;

/**
 * @returns {Promise<typeof import("../vendor/systemverilog-simulator/engine.mjs")>}
 */
export async function loadHdlEngine() {
  if (cached) return cached;
  const primary =
    HDL_ENGINE_SPEC.prefer === "public" ? HDL_ENGINE_SPEC.publicUrl : HDL_ENGINE_SPEC.vendorUrl;
  const fallback =
    HDL_ENGINE_SPEC.prefer === "public" ? HDL_ENGINE_SPEC.vendorUrl : HDL_ENGINE_SPEC.publicUrl;
  try {
    cached = await import(/* webpackIgnore: true */ primary);
    return cached;
  } catch (err) {
    if (fallback && fallback !== primary) {
      cached = await import(/* webpackIgnore: true */ fallback);
      return cached;
    }
    throw err;
  }
}
