# testid-autoinject

Zero-touch, build-time injection of **stable** `testID` / `data-test-id` for
React Native (Expo) and Next.js.

Frontend writes nothing. QA automation (Appium, Playwright, Detox, Maestro)
gets deterministic selectors that survive refactors.

## Why

Manually adding test ids is a recurring tax: QA asks, frontend adds, repeat.
Existing auto-injectors solve the labour but generate **positional** ids
(`file__Button_3`) that shift the moment anyone reorders JSX — breaking every
hardcoded selector in the automation suite.

`testid-autoinject` derives ids from **stable, human-meaningful signals**
(label / accessibility text / element name) instead of source position:

```
{screen}-{label|element}-{type}
login-submit-button
checkout-email-input
```

Add an unrelated element above it — the id does not change.

## How it works

1. **Babel plugin** (core) — at build time, injects a stable id onto every
   interactive element that lacks one. Runs only in `test` / `development`.
2. **ESLint plugin** (safety net) — flags elements the Babel pass cannot reach
   (third-party components, wrappers that swallow props) and keeps the attribute
   name consistent. Autofixable.
3. **CLI scanner** — report coverage on any directory without installing
   anything into the target project.
4. **ID map export** — emit a `testid-map.json` (`id → file / element / label`)
   for QA to look up selectors.

## Install

```bash
npm add -D testid-autoinject
```

## Setup

### React Native / Expo — `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['testid-autoinject/babel', { platform: 'native' }],
    ],
  };
};
```

### Next.js — `.babelrc`

```json
{
  "presets": ["next/babel"],
  "plugins": [
    ["testid-autoinject/babel", { "platform": "web" }]
  ]
}
```

> Adding `.babelrc` opts Next.js out of SWC. Accepted tradeoff for one plugin
> covering both platforms.

Restart Metro with a clean cache after changing Babel config: `expo start -c`.

## Babel options

| Option | Default | Description |
|---|---|---|
| `platform` | `"web"` | `"native"` → `testID`; `"web"` → `data-test-id`. |
| `attribute` | from platform | Override the attribute name entirely. |
| `envs` | `["test","development"]` | Only inject when `NODE_ENV` is one of these. |
| `targets` | interactive set | Element names to inject on. |
| `injectAll` | `false` | Inject on every element, ignoring `targets`. |
| `stripDirs` | `["src","app","screens","components","pages"]` | Leading path segments dropped from the screen slug. |
| `emitMap` | `false` | Write an id → source map. |
| `mapFile` | `<cwd>/testid-map.json` | Where to write the map. |

Manual ids always win — an element that already has the attribute is left
untouched, so you can override any generated id by hand.

## ESLint (flat config)

```js
import { recommended } from 'testid-autoinject';

export default [
  recommended('native'), // or 'web'
];
```

## CLI

```bash
npx testid-scan ./src --platform web
npx testid-scan ./app --platform native --attribute testID
```

## The one thing that still needs a human

Custom wrapper components must **forward** the injected attribute to the
underlying native element, or Appium won't see it in the native tree. This is a
one-time fix per shared component — the `require-testid` rule flags where it's
needed.

## License

MIT
