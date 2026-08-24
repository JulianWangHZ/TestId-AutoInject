# testid-autoinject SWC plugin

The SWC engine for [testid-autoinject](../../README.md). A Rust → WebAssembly
SWC plugin that injects stable `data-testid` / `testID` onto interactive JSX at
build time — the same ids the Babel engine produces, but running *inside* SWC so
it works on **Next.js 15+ with webpack and Turbopack** without opting SWC out.

## Why this exists

On Next.js 15, a `.babelrc` opts the whole project out of SWC, which breaks App
Router **Server Actions** (async functions get downleveled) and **`next/font`**.
An SWC plugin has no such problem — it *is* part of the SWC pipeline. See the
[root README](../../README.md#nextjs--swc-plugin-nextconfigts) for user setup.

## Build

```bash
rustup target add wasm32-wasip1      # once
cargo build --release --target wasm32-wasip1
# or from the repo root, which also copies the wasm into dist/swc/:
npm run build:swc
```

## Test

```bash
cargo test        # native: cross-checks id logic against the Babel engine
```

The id modules (`slugify`, `element_type`, `derive`, `handler_signal`) are pure
and assert the exact same outputs as `tests/derive.test.ts` in the Babel engine,
so both engines derive identical ids.

## swc_core version ↔ Next.js version

The wasm's `swc_core` **must** match the `swc_core` your Next.js version's SWC
host was built with, or Next fails with `failed to invoke plugin` (ABI mismatch).

| swc_core | Next.js | Notes |
|---|---|---|
| `=35.0.0` | **15.5.x** | Current pin. From `workspace.dependencies` in vercel/next.js@v15.5.9. |
| 47+ | 16.1+ | Wasm plugins are backward-compatible from swc_core 47 (Nov 2025) — a single build then covers future Next versions. |

To retarget: find the Next version's `swc_core` (its root `Cargo.toml`), update
the pin in [`Cargo.toml`](Cargo.toml), and rebuild.

## Build gotchas (learned the hard way)

- **`--allow-undefined` linker flag is mandatory** (see [`.cargo/config.toml`](.cargo/config.toml)).
  SWC host functions (`__set_transform_result`, …) are wasm imports supplied at
  runtime; without the flag, `rust-lld` fails with "undefined symbol".
- **`swc_plugin_macro` pinned to `=1.1.0`** — swc_core 35.0.0 re-exports
  `css_plugin_transform`, which 1.1.1 dropped. `swc_plugin_proxy = "=14.0.0"` is
  its matching pair.
- **No `[profile.release]` lto/opt-level overrides** — they can strip the wasm
  host-import symbols and break linking.
