# Vendored HDL engine (public API pin)

Teaching build of [systemverilog-simulator](https://github.com/universal-verification-methodology/systemverilog-simulator)
for concept labs (`loadHdlEngine()`).

| Field | Value |
|-------|--------|
| Layout | `engine.mjs` re-exports `src/` (ESM). Prefer a minified single-file `engine.mjs` from `scripts/build-engine-vendor.mjs` when esbuild matches the host OS. |
| Prefer after publish | `https://universal-verification-methodology.github.io/systemverilog-simulator/assets/engine.mjs` |

Refresh after changing the private engine:

```bash
# from systemverilog-simulator (private) — needs platform-matched esbuild
node scripts/build-engine-vendor.mjs

# or copy sources for a multi-file pin (current Windows fallback)
cp -r src ../learning/platform/vendor/systemverilog-simulator/
# engine.mjs → export * from "./src/index.js";
```

Or point tools at the Pages URL via `platform/assets/hdl-engine.js` (`prefer: "public"`).

Includes teaching API: `lintSynthesizability` / `SYNTH_LINT_RULES`.

License: MIT (simulator). Platform tools remain under the learning monorepo license.
