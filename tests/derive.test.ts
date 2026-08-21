import { test } from 'node:test';
import assert from 'node:assert/strict';

import { slugify, slugifyUnicode } from '../src/id/slugify';
import { elementNameToType } from '../src/id/element-type';
import { deriveScreen, deriveBaseId } from '../src/id/derive';

test('slugify: splits camelCase and lowercases', () => {
  assert.equal(slugify('submitButton'), 'submit-button');
  assert.equal(slugify('Log In Now!'), 'log-in-now');
  assert.equal(slugify('  spaced  '), 'spaced');
});

test('slugify: strips CJK to empty (ASCII-only)', () => {
  assert.equal(slugify('今天'), '');
  assert.equal(slugify('登入 Login'), 'login');
});

test('slugifyUnicode: preserves CJK, still slugifies latin', () => {
  assert.equal(slugifyUnicode('今天'), '今天');
  assert.equal(slugifyUnicode('選擇日期'), '選擇日期');
  assert.equal(slugifyUnicode('submitButton'), 'submit-button');
  assert.equal(slugifyUnicode('登入 Login'), '登入-login');
});

test('elementNameToType: known map, suffix rules, fallback', () => {
  assert.equal(elementNameToType('Pressable'), 'button');
  assert.equal(elementNameToType('TextInput'), 'input');
  assert.equal(elementNameToType('PhoneField'), 'field');
  assert.equal(elementNameToType('Radio.Root'), 'radio');
  assert.equal(elementNameToType('WeirdThing'), 'weird-thing');
});

test('deriveScreen: strips framework dirs and trailing index', () => {
  assert.equal(deriveScreen('app/login/index.tsx'), 'login');
  assert.equal(deriveScreen('src/screens/EventDetail.tsx'), 'event-detail');
  assert.equal(deriveScreen('components/PhoneField.tsx'), 'phone-field');
  assert.equal(deriveScreen('unknown'), 'unknown');
  assert.equal(deriveScreen(''), 'screen');
});

test('deriveBaseId: prefers label, falls back to element name', () => {
  assert.equal(
    deriveBaseId({ screen: 'login', elementName: 'Pressable', label: 'Submit' }),
    'login-submit-button'
  );
  assert.equal(
    deriveBaseId({ screen: 'login', elementName: 'TextInput', label: null }),
    'login-text-input-input'
  );
});

test('deriveBaseId: English label beats handler signal', () => {
  assert.equal(
    deriveBaseId({
      screen: 'home',
      elementName: 'button',
      label: 'Search',
      handlerSignal: 'submit',
    }),
    'home-search-button'
  );
});

test('deriveBaseId: handler signal beats CJK label', () => {
  assert.equal(
    deriveBaseId({
      screen: 'home',
      elementName: 'button',
      label: '今天',
      handlerSignal: 'today',
    }),
    'home-today-button'
  );
});

test('deriveBaseId: CJK label kept when no English signal', () => {
  assert.equal(
    deriveBaseId({ screen: 'login', elementName: 'button', label: '登入' }),
    'login-登入-button'
  );
});

test('deriveBaseId: cjkFallback=false reverts to element name', () => {
  assert.equal(
    deriveBaseId({
      screen: 'login',
      elementName: 'button',
      label: '登入',
      cjkFallback: false,
    }),
    'login-button-button'
  );
});
