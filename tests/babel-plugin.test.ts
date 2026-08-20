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

test('web platform injects data-test-id', () => {
  const out = transform(`<button>Go</button>`, { platform: 'web' }, 'app/checkout/page.tsx');
  assert.match(out, /data-test-id="checkout-go-button"/);
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
