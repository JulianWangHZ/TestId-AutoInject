import { test } from 'node:test';
import assert from 'node:assert/strict';

import { swc, type SwcOptions } from '../src/swc';

// SwcOptions must stay assignable to Next's Record<string, unknown> swcPlugins type.
const _swcOptionsIsRecord: Record<string, unknown> = {} as SwcOptions;
void _swcOptionsIsRecord;

test('swc: returns a package subpath specifier (Turbopack rejects filesystem paths)', () => {
  const [wasmSpecifier] = swc();
  assert.match(wasmSpecifier, /^testid-autoinject\/swc\/plugin-1[56]\.wasm$/);
});

test('swc: passes options through untouched as the second tuple element', () => {
  const options: SwcOptions = { platform: 'web', attribute: 'data-testid' };
  const [, returned] = swc(options);
  assert.deepEqual(returned, options);
});

test('swc: defaults to an empty options object', () => {
  const [, returned] = swc();
  assert.deepEqual(returned, {});
});
