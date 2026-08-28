# testid-autoinject

Zero-touch, build-time injection of **stable** `testID` / `data-testid` for
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
4. **ID map export** (optional) — emit a `testid-map.json`
   (`id → file / element / label`). Not a frontend deliverable and not required
   to obtain ids — it's mainly for detecting id drift in CI. See
   [Discovering ids](#discovering-ids).

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

Restart Metro with a clean cache after changing Babel config: `expo start -c`.

> **EAS builds set `NODE_ENV=production`.** Every EAS build — `development`,
> `preview`, *and* `production` profiles — runs Babel with `NODE_ENV=production`,
> which is **not** in the default `envs` (`["test","development"]`). So with the
> default config, ids are injected only on your local dev server and silently
> **not** in any EAS build. If your QA automation runs against an EAS build, add
> the environment explicitly:
>
> ```js
> ['testid-autoinject/babel', { platform: 'native', envs: ['test', 'development', 'production'] }]
> ```
>
> To keep ids out of your store release, gate on a signal you control instead of
> `NODE_ENV` — e.g. a custom env var set only for QA/preview builds:
>
> ```js
> // eas.json build profile: "env": { "TESTID": "1" }
> const plugins = process.env.TESTID
>   ? [['testid-autoinject/babel', { platform: 'native', envs: ['production'] }]]
>   : [];
> ```

### Next.js — SWC plugin (`next.config.ts`)

Next.js 13+ compiles with SWC. Adding a `.babelrc` opts SWC out, which **breaks
App Router Server Actions and `next/font`** on Next 15 — so use the SWC plugin
engine instead. It runs *inside* SWC (nothing is disabled) and works on both
webpack and Turbopack.

```ts
// next.config.ts
import { swc } from 'testid-autoinject/swc';

const nextConfig = {
  experimental: {
    swcPlugins: [swc({ platform: 'web' })],
  },
};
export default nextConfig;
```

> `swc()` picks the wasm that matches your Next.js version automatically:
> `plugin-16.wasm` (`swc_core 54`) for **Next 16+**, or `plugin-15.wasm`
> (`swc_core 35`) for **Next 15.5.x** — the wasm's swc_core must match the host's
> or Next throws `failed to invoke plugin`. Both ship prebuilt in the package, so
> consumers need no Rust toolchain. The Babel engine above still covers React
> Native / Expo (Metro uses Babel). All engines share the same id-derivation
> logic, so ids are identical across them.

## Babel options

| Option | Default | Description |
|---|---|---|
| `platform` | `"web"` | `"native"` → `testID`; `"web"` → `data-testid`. |
| `attribute` | from platform | Override the attribute name entirely. |
| `envs` | `["test","development"]` | Only inject when `NODE_ENV` is one of these. |
| `targets` | interactive set | Element names to inject on. |
| `injectAll` | `false` | Inject on every element, ignoring `targets`. |
| `stripDirs` | `["src","app","screens","components","pages"]` | Leading path segments dropped from the screen slug. |
| `emitMap` | `false` | Write an id → source map. |
| `mapFile` | `<cwd>/testid-map.json` | Where to write the map. |
| `cjkFallback` | `true` | Keep a non-ASCII label (CJK, …) verbatim as a readable fallback. Set `false` for ASCII-only ids. |

Manual ids always win — an element that already has the attribute is left
untouched, so you can override any generated id by hand.

## Non-Latin UIs (CJK)

Visible text on a Chinese/Japanese/Korean UI carries no ASCII signal, so the id
name is chosen from the first meaningful source, in order:

1. **English label attribute / text** — `aria-label`, `name`, static text.
2. **English handler intent** — mined from `onClick` / `onChange` / `onSubmit`:
   the call argument (`onClick={() => setDateType("today")}` → `today`), the
   handler name (`onClick={handleSubmit}` → `submit`), or the receiver
   (`onClick={datePicker.open}` → `date-picker`). This is where most CJK
   buttons get a clean English id, because handlers are already named in English.
3. **The label text itself**, preserved verbatim (`login-登入-button`) — readable
   and stable. `data-testid`, Appium ids, and Playwright locators accept Unicode.

An id never degrades to a positional counter while any of these signals exist.

## ESLint (flat config)

```js
import { recommended } from 'testid-autoinject';

export default [
  recommended('native'), // or 'web'
];
```

### Spread-bearing elements and `allowSpread`

`require-testid` defaults to `allowSpread: true`, so it skips any element
carrying a `{...props}` spread — on the assumption the spread may already supply
the attribute. The injector makes no such assumption: it injects into those
elements anyway. So a clean lint run does **not** guarantee the output is free of
generated ids, and a shared spread-bearing component renders the *same* id at
every call site — a strict-mode violation for Playwright that the lint output
never points at.

If you want a green lint to mean "no generated ids slipped through", override the
rule with `allowSpread: false` after the preset:

```js
import { recommended } from 'testid-autoinject';

export default [
  recommended('web'),
  {
    rules: {
      'testid/require-testid': ['warn', { attribute: 'data-testid', allowSpread: false }],
    },
  },
];
```

This surfaces every spread-bearing target that lacks an explicit id, including
shared wrappers and cases where a `{...register(...)}`-style spread would
otherwise hide an injected id overriding one the component computes internally.

## CLI

```bash
npx testid-scan ./src --platform web
npx testid-scan ./app --platform native --attribute testID
```

## Discovering ids

Injected ids live in the **running app** — there is nothing the frontend has to
hand over. QA (or a test-authoring agent) can read them with whatever tool fits
their workflow; these are equivalent options, none is required:

- **Appium Inspector** — inspect a native element and read its accessibility id.
- **Browser DevTools** — inspect an element and read its `data-testid`.
- **Playwright codegen** — record interactions and let it emit locators.
- **MCP live-grab** — an agent reads the live DOM / native tree and lists ids.
- **`testid-map.json`** — an optional offline list, handy for CI drift checks.

Because ids are stable and follow `{screen}-{label|element}-{type}`, they can
often be predicted from the screen without inspecting anything.

> Ids only exist in a `test` / `development` build — point your tooling at that,
> not a production build.

## Locating elements in tests

The injected ids are ordinary selectors. Point your automation at the same
attribute the plugin wrote (`data-testid` on web, `testID` on native).

### Playwright (web — `data-testid`)

`getByTestId` resolves `data-testid` by default, so it matches the plugin's web
output with no extra config:

```ts
import { test, expect } from '@playwright/test';

test('submits the checkout form', async ({ page }) => {
  await page.goto('/checkout');

  // id shape: {screen}-{label|element}-{type}
  await page.getByTestId('checkout-email-input').fill('qa@example.com');
  await page.getByTestId('checkout-go-button').click();

  await expect(page.getByTestId('checkout-success-text')).toBeVisible();
});
```

> Using a different attribute (e.g. you set `attribute: 'data-qa'`)? Tell
> Playwright once in `playwright.config.ts`:
> `use: { testIdAttribute: 'data-qa' }`.

### Appium + WebdriverIO (native — `testID`)

React Native maps `testID` to the iOS **accessibility identifier** and the
Android **`resource-id`**. The portable selector is the accessibility-id form
(`~id`); it works as-is on iOS and on Android once the id reaches the native
tree:

```ts
import { remote } from 'webdriverio';

const driver = await remote({
  capabilities: {
    platformName: 'iOS', // or 'Android'
    'appium:automationName': 'XCUITest', // 'UiAutomator2' on Android
    'appium:app': '/path/to/app',
  },
});

// `~` is the accessibility-id selector — matches the injected testID.
await driver.$('~login-email-input').setValue('qa@example.com');
await driver.$('~login-submit-button').click();

await driver.$('~login-success-text').waitForDisplayed();
await driver.deleteSession();
```

> **Android fallback.** If `~id` does not match, the id likely arrived as a
> `resource-id` instead of a content-desc. Match it explicitly:
>
> ```ts
> await driver.$('android=new UiSelector().resourceId("login-submit-button")').click();
> ```
>
> This is the same forwarding issue described below — a wrapper component that
> drops `testID` before the native element will be invisible to either selector.

## The one thing that still needs a human

Custom wrapper components must **forward** the injected attribute to the
underlying native element, or Appium won't see it in the native tree. This is a
one-time fix per shared component — the `require-testid` rule flags where it's
needed.

## Lists: rows share one id

Injection is a **build-time** transform, so a `.map()` — one JSX node in source —
gets one literal id, and every rendered row shares it:

```tsx
// source
items.map((it) => <Button onPress={() => go(it)}>{it.name}</Button>)

// after the plugin — the SAME id on every row
items.map((it) => <Button testID="orders-list-go-button" onPress={() => go(it)}>{it.name}</Button>)
```

This is not fixable at build time: per-row uniqueness lives in runtime data
(`it.id`), which the AST cannot see. Two ways to handle it:

1. **Scope the shared id at test time** — anchor to the row, then find the
   control inside it (no app change):

   ```ts
   // Playwright — scope by row content
   const row = page.getByRole('listitem').filter({ hasText: 'Order #42' });
   await row.getByTestId('orders-list-go-button').click();

   // …or by position
   await page.getByTestId('orders-list-go-button').nth(2).click();
   // Appium/WebdriverIO: (await driver.$$('~orders-list-go-button'))[2].click()
   ```

2. **Set a per-row id by hand** when you need a stable unique selector. Manual
   ids always win, so the plugin leaves it alone:

   ```tsx
   items.map((it) => <Button testID={`orders-list-go-${it.id}`} onPress={() => go(it)}>{it.name}</Button>)
   ```

## License

MIT
