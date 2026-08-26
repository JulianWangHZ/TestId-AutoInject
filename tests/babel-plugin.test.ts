import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformSync } from '@babel/core';
import syntaxJsx from '@babel/plugin-syntax-jsx';

import injectTestId, { InjectOptions } from '../src/babel-plugin';

function transform(code: string, opts: InjectOptions = {}, filename = 'app/login/index.tsx'): string {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const out = transformSync(code, {
      filename,
      cwd: '/proj',
      babelrc: false,
      configFile: false,
      plugins: [
        syntaxJsx,
        [injectTestId, { platform: 'native', ...opts }],
      ],
    });
    return out?.code ?? '';
  } finally {
    process.env.NODE_ENV = prev;
  }
}

test('injects testID derived from a label', () => {
  const out = transform(`<Pressable accessibilityLabel="Submit" />`);
  assert.match(out, /testID="login-submit-button"/);
});

test('derives from static text child when no label attr', () => {
  const out = transform(`<Button>Log In</Button>`);
  assert.match(out, /testID="login-log-in-button"/);
});

test('manual testID always wins (not overwritten)', () => {
  const out = transform(`<Pressable testID="custom-id" accessibilityLabel="Submit" />`);
  assert.match(out, /testID="custom-id"/);
  assert.doesNotMatch(out, /login-submit-button/);
});

test('injected value is placed before a spread so the spread can override it', () => {
  // A caller may pass testID through `{...props}`. Since a later JSX attribute
  // wins, the injected value must come BEFORE the spread — otherwise it would
  // silently clobber the caller's testID.
  const out = transform(`<TextInput {...props} />`);
  const testIdIdx = out.indexOf('testID=');
  const spreadIdx = out.indexOf('...props');
  assert.ok(testIdIdx !== -1, 'expected an injected testID');
  assert.ok(spreadIdx !== -1, 'expected the spread to be preserved');
  assert.ok(testIdIdx < spreadIdx, 'injected testID must come before the spread');
});

test('non-target elements are skipped by default', () => {
  const out = transform(`<View><Text>hi</Text></View>`);
  assert.doesNotMatch(out, /testID/);
});

test('injectAll covers every element', () => {
  const out = transform(`<View />`, { injectAll: true });
  assert.match(out, /testID="login-view-view"/);
});

test('STABLE: adding an unrelated element does not shift other ids', () => {
  const a = transform(`<><Pressable accessibilityLabel="A" /><Pressable accessibilityLabel="B" /></>`);
  const b = transform(`<><Pressable accessibilityLabel="A" /><View /><Pressable accessibilityLabel="B" /></>`);
  // "B" keeps its id in both — a positional counter would have shifted it.
  assert.match(a, /testID="login-b-button"/);
  assert.match(b, /testID="login-b-button"/);
});

test('duplicate bases get a deterministic numeric suffix', () => {
  const out = transform(`<><Pressable accessibilityLabel="Go" /><Pressable accessibilityLabel="Go" /></>`);
  assert.match(out, /testID="login-go-button"/);
  assert.match(out, /testID="login-go-button-2"/);
});

test('web platform injects data-testid', () => {
  const out = transform(`<button>Go</button>`, { platform: 'web' }, 'app/checkout/page.tsx');
  assert.match(out, /data-testid="checkout-go-button"/);
});

test('CJK label with handler: English intent from the handler wins', () => {
  const out = transform(
    `<button onClick={() => setDateType("today")}>今天</button>`,
    { platform: 'web' },
    'src/features/home/SearchArea/index.tsx'
  );
  assert.match(out, /data-testid="features-home-search-area-today-button"/);
});

test('CJK label without a usable handler: text kept verbatim, not positional', () => {
  const out = transform(`<button>登入</button>`, { platform: 'web' }, 'app/login/page.tsx');
  // Babel escapes non-ASCII in generated source; the injected attribute value
  // is `login-登入-button` (readable in the DOM), serialized here as \uXXXX.
  assert.match(out, /data-testid="login-\\u767B\\u5165-button"/);
});

test('CJK labels stay stable across sibling insertion (no positional drift)', () => {
  const a = transform(
    `<><button onClick={datePicker.open}>選擇日期</button></>`,
    { platform: 'web' },
    'app/home/page.tsx'
  );
  const b = transform(
    `<><span /><button onClick={datePicker.open}>選擇日期</button></>`,
    { platform: 'web' },
    'app/home/page.tsx'
  );
  assert.match(a, /data-testid="home-date-picker-button"/);
  assert.match(b, /data-testid="home-date-picker-button"/);
});

test('cjkFallback=false: CJK-only label reverts to element name', () => {
  const out = transform(`<button>登入</button>`, { platform: 'web', cjkFallback: false }, 'app/login/page.tsx');
  // Id drops the CJK text entirely; the visible child text is untouched.
  assert.match(out, /data-testid="login-button-button"/);
  assert.doesNotMatch(out, /data-testid="[^"]*(登入|\\u767B)[^"]*"/);
});

test('does nothing when NODE_ENV is not in envs', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const out = transformSync(`<Pressable accessibilityLabel="Submit" />`, {
      filename: 'app/login/index.tsx',
      cwd: '/proj',
      babelrc: false,
      configFile: false,
      plugins: [syntaxJsx, [injectTestId, { platform: 'native' }]],
    })?.code ?? '';
    assert.doesNotMatch(out, /testID/);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
