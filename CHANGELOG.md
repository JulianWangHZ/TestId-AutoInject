# Changelog

## [0.3.0](https://github.com/JulianWangHZ/TestId-AutoInject/compare/v0.2.0...v0.3.0) (2026-08-24)


### ⚠ BREAKING CHANGES

* the default web attribute is now `data-testid` instead of `data-test-id`. Existing selectors targeting `data-test-id` will break unless pinned via the `attribute` option.

### Features

* rename default web attribute to data-testid ([#9](https://github.com/JulianWangHZ/TestId-AutoInject/issues/9)) ([9ffe88a](https://github.com/JulianWangHZ/TestId-AutoInject/commit/9ffe88ac13c4b003faeb357b1a15209d3bdc5332))

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
