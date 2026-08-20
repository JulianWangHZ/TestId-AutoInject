import { test } from 'node:test';
import assert from 'node:assert/strict';

import { slugify } from '../src/id/slugify';
import { elementNameToType } from '../src/id/element-type';
import { deriveScreen, deriveBaseId } from '../src/id/derive';

test('slugify: splits camelCase and lowercases', () => {
  assert.equal(slugify('submitButton'), 'submit-button');
  assert.equal(slugify('Log In Now!'), 'log-in-now');
  assert.equal(slugify('  spaced  '), 'spaced');
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
