# Vendored HDL engine (public API pin)

Copy of the **public** library build (`assets/engine.mjs`) from
[systemverilog-simulator](https://github.com/universal-verification-methodology/systemverilog-simulator).

| Field | Value |
|-------|--------|
| Source | Private `src/index.js` → esbuild ESM (same recipe as public release) |
| Prefer after publish | `https://universal-verification-methodology.github.io/systemverilog-simulator/assets/engine.mjs` |

Refresh after changing the private engine:

```bash
# from systemverilog-simulator (private)
node scripts/build-engine-vendor.mjs
```

Or after a public `revN` that includes `engine.mjs`:

```bash
cp release/assets/engine.mjs \
  ../learning/platform/vendor/systemverilog-simulator/engine.mjs
```

Or point tools at the Pages URL via `platform/assets/hdl-engine.js` (`prefer: "public"`).

License: MIT (simulator). Platform tools remain under the learning monorepo license.
