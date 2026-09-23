# Changelog

## [0.3.5](https://github.com/JulianWangHZ/TestId-AutoInject/compare/v0.3.4...v0.3.5) (2026-09-23)


### Bug Fixes

* **swc:** resolve wasm via package subpath so Turbopack can load it ([#28](https://github.com/JulianWangHZ/TestId-AutoInject/issues/28)) ([7b5e53d](https://github.com/JulianWangHZ/TestId-AutoInject/commit/7b5e53ddb2eb69ce81f84b55ff0e9ba5b8d9d9e4))

## [0.3.4](https://github.com/JulianWangHZ/TestId-AutoInject/compare/v0.3.3...v0.3.4) (2026-09-23)


### Features

* **vue:** compile-time data-testid injection for Vue 3 templates ([#26](https://github.com/JulianWangHZ/TestId-AutoInject/issues/26)) ([5e41c3e](https://github.com/JulianWangHZ/TestId-AutoInject/commit/5e41c3ea34eae3c065d2507cc45f44822dd75ace))

## [0.3.3](https://github.com/JulianWangHZ/TestId-AutoInject/compare/v0.3.2...v0.3.3) (2026-08-28)


### Bug Fixes

* normalize swc wasm path for Turbopack on Windows ([#20](https://github.com/JulianWangHZ/TestId-AutoInject/issues/20)) ([3eea4e3](https://github.com/JulianWangHZ/TestId-AutoInject/commit/3eea4e3620022a704ae7d0bb0c2a5fc887238d9b))

## [0.3.2](https://github.com/JulianWangHZ/TestId-AutoInject/compare/v0.3.1...v0.3.2) (2026-08-26)


### Bug Fixes

* inject testID before spread so caller values win ([#15](https://github.com/JulianWangHZ/TestId-AutoInject/issues/15)) ([2b2e5e1](https://github.com/JulianWangHZ/TestId-AutoInject/commit/2b2e5e17f1954020993dad5e378d0aa40606864f))

## [0.3.1](https://github.com/JulianWangHZ/TestId-AutoInject/compare/v0.3.0...v0.3.1) (2026-08-26)


### Bug Fixes

* stop consistent-testid-attribute flagging the canonical name ([#13](https://github.com/JulianWangHZ/TestId-AutoInject/issues/13)) ([fb6cca7](https://github.com/JulianWangHZ/TestId-AutoInject/commit/fb6cca74f0d3cfd38ca99043503ce3f264cd2f0a))

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
