import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import * as vueParser from 'vue-eslint-parser';
import { vueRequireTestid } from '../src/eslint/rules/vue-require-testid';

const linter = new Linter();

const plugin = { rules: { 'vue-require-testid': vueRequireTestid } };

function config(options?: unknown) {
  return {
    files: ['**/*.vue'],
    plugins: { testid: plugin },
    languageOptions: { parser: vueParser },
    rules: {
      'testid/vue-require-testid':
        options === undefined ? 'error' : ['error', options],
    },
  } as never;
}

const FILE = 'src/pages/login/index.vue';

function lint(code: string, options?: unknown) {
  return linter.verify(code, config(options), FILE);
}

function fix(code: string, options?: unknown) {
  return linter.verifyAndFix(code, config(options), FILE);
}

test('vue eslint: interactive element without testid is flagged', () => {
  const msgs = lint(`<template><button @click="save">Save</button></template>`);
  assert.equal(msgs.length, 1, JSON.stringify(msgs));
  assert.match(msgs[0].message, /missing data-testid/);
});

test('vue eslint: static data-testid passes', () => {
  const msgs = lint(
    `<template><button data-testid="x">Save</button></template>`
  );
  assert.equal(msgs.length, 0, JSON.stringify(msgs));
});

test('vue eslint: bound :data-testid passes', () => {
  const msgs = lint(
    `<template><button :data-testid="dyn">Save</button></template>`
  );
  assert.equal(msgs.length, 0, JSON.stringify(msgs));
});

test('vue eslint: non-target element is ignored', () => {
  const msgs = lint(`<template><div @click="open">x</div></template>`);
  assert.equal(msgs.length, 0, JSON.stringify(msgs));
});

test('vue eslint: autofix inserts the derived id', () => {
  const result = fix(`<template><button @click="handleSubmit">送出</button></template>`);
  assert.ok(
    result.output.includes(`data-testid="login-submit-button"`),
    result.output
  );
});

test('vue eslint: autofix dedupes duplicate base ids', () => {
  const result = fix(
    `<template><div><button>Save</button><button>Save</button></div></template>`
  );
  assert.ok(result.output.includes(`data-testid="login-save-button"`), result.output);
  assert.ok(result.output.includes(`data-testid="login-save-button-2"`), result.output);
});

test('vue eslint: custom attribute option', () => {
  const msgs = lint(
    `<template><button data-test="x">Save</button></template>`,
    { attribute: 'data-test' }
  );
  assert.equal(msgs.length, 0, JSON.stringify(msgs));
});
