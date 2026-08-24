# Changelog

## [0.3.0](https://github.com/JulianWangHZ/TestId-AutoInject/compare/testid-autoinject-v0.2.0...testid-autoinject-v0.3.0) (2026-08-24)


### Features

* add SWC plugin engine for Next.js 15+ (webpack & Turbopack) ([#2](https://github.com/JulianWangHZ/TestId-AutoInject/issues/2)) ([dec9171](https://github.com/JulianWangHZ/TestId-AutoInject/commit/dec9171ba6a79f86bfad7197d0bcf689e0cdd62e))
* derive stable ids from handler intent + CJK fallback ([#1](https://github.com/JulianWangHZ/TestId-AutoInject/issues/1)) ([bcf4eff](https://github.com/JulianWangHZ/TestId-AutoInject/commit/bcf4eff9ba1eca568e2d7c16ddd1cf404be35455))
* Next.js 16 support (second swc_core 54 engine with auto-selection) ([2152a7e](https://github.com/JulianWangHZ/TestId-AutoInject/commit/2152a7e788ee7527b7d61862b93ec02c6d4859e9))
* testid-autoinject v0.1.0 — stable build-time testID injection ([cc689d6](https://github.com/JulianWangHZ/TestId-AutoInject/commit/cc689d6e75f044f49f2a0db70d8b747aa3a98815))


### Bug Fixes

* use single-level glob in test script for cross-shell CI ([#4](https://github.com/JulianWangHZ/TestId-AutoInject/issues/4)) ([641dfe4](https://github.com/JulianWangHZ/TestId-AutoInject/commit/641dfe4d33cc0a37708340bc0f5de0a49f625245))

## [0.2.0]

### Added

- **Next.js 16 support** — a second SWC wasm engine built against `swc_core 54`,
  so the plugin works on Next 16+ (host swc_core ≥ 54) alongside Next 15.5.x
  (`swc_core 35`). Next 16's swc_core changed AST APIs (`JSXAttrValue::Str`,
  `Wtf8Atom`), so this is a separately-adapted build, not just a version bump.
- **Automatic version selection** — `import { swc } from 'testid-autoinject/swc'`
  returns the wasm matching your project's Next.js version. Use
  `swcPlugins: [swc({ platform: 'web' })]`; no need to pick a wasm by hand.

### Changed

- `./swc` export is now the `swc()` helper, not a direct wasm path. Two wasm
  files ship: `plugin-15.wasm` (swc_core 35, Next 15.5.x) and `plugin-16.wasm`
  (swc_core 54, Next 16+).

## [0.1.0]

### Added

- Babel plugin, ESLint plugin, and CLI scanner for stable
  `data-test-id` / `testID` injection.
- SWC wasm plugin engine (`swc_core 35`) for Next.js 15.5.x — runs inside SWC
  without opting it out, so App Router Server Actions and `next/font` stay intact.
- Stable id derivation: screen slug + English label + handler intent + CJK
  fallback, independent of sibling order.
