import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '@vue/compiler-dom';
import { vueTestId } from '../src/vue';
import type { VueInjectOptions } from '../src/vue';

process.env.NODE_ENV = 'test';

function render(
  template: string,
  options: VueInjectOptions = {},
  filename = 'src/pages/login/index.vue'
): string {
  const { code } = compile(template, {
    filename,
    nodeTransforms: [vueTestId(options)],
  });
  return code;
}

test('vue: button with English text gets {screen}-{label}-{type}', () => {
  const code = render(`<button @click="doThing">Save</button>`);
  assert.match(code, /data-testid":\s*"login-save-button"|data-testid="login-save-button"/);
});

test('vue: CJK text falls back to handler signal', () => {
  const code = render(`<button @click="handleSubmit">送出</button>`);
  assert.ok(code.includes('login-submit-button'), code);
});

test('vue: CJK text with no handler keeps the label verbatim', () => {
  const code = render(`<button>送出</button>`);
  assert.ok(code.includes('login-送出-button'), code);
});

test('vue: handler string argument names the intent', () => {
  const code = render(`<button @click="setDateType('today')">今天</button>`);
  assert.ok(code.includes('login-today-button'), code);
});

test('vue: existing static data-testid wins', () => {
  const code = render(`<button data-testid="custom">Save</button>`);
  assert.ok(code.includes('custom'), code);
  assert.ok(!code.includes('login-save-button'), code);
});

test('vue: existing bound :data-testid wins', () => {
  const code = render(`<button :data-testid="dyn">Save</button>`);
  assert.ok(!code.includes('login-save-button'), code);
});

test('vue: non-target elements are skipped by default', () => {
  const code = render(`<div @click="open">x</div>`);
  assert.ok(!code.includes('data-testid'), code);
});

test('vue: injectAll covers non-target elements', () => {
  const code = render(`<div @click="openMenu"></div>`, { injectAll: true });
  assert.ok(code.includes('login-open-menu-div'), code);
});

test('vue: duplicate base ids get a stable numeric suffix', () => {
  const code = render(`<div><button>Save</button><button>Save</button></div>`, {
    injectAll: false,
  });
  assert.ok(code.includes('login-save-button'), code);
  assert.ok(code.includes('login-save-button-2'), code);
});

test('vue: kebab-case component maps through PascalCase suffix rules', () => {
  const code = render(`<van-button>Buy</van-button>`, {
    targets: ['VanButton'],
  });
  assert.ok(code.includes('login-buy-button'), code);
});

test('vue: PascalCase component targets match', () => {
  const code = render(`<BaseInput placeholder="Email" />`, {
    targets: ['BaseInput'],
  });
  assert.ok(code.includes('login-email-input'), code);
});

test('vue: screen slug derives from the SFC path', () => {
  const code = render(`<button>Go</button>`, {}, 'src/pages/event-detail/index.vue');
  assert.ok(code.includes('event-detail-go-button'), code);
});

test('vue: disabled outside configured envs', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const code = render(`<button>Save</button>`);
    assert.ok(!code.includes('data-testid'), code);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
