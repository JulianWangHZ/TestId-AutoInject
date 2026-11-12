import { test } from 'node:test';
import assert from 'node:assert/strict';

import { swc, wasmForNextVersion, type SwcOptions } from '../src/swc';

// SwcOptions must stay assignable to Next's Record<string, unknown> swcPlugins type.
const _swcOptionsIsRecord: Record<string, unknown> = {} as SwcOptions;
void _swcOptionsIsRecord;

test('swc: returns a package subpath specifier (Turbopack rejects filesystem paths)', () => {
  const [wasmSpecifier] = swc();
  assert.match(wasmSpecifier, /^testid-autoinject\/swc\/plugin-1[56](-[0345])?\.wasm$/);
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

test('wasmForNextVersion: picks the wasm whose swc_core matches the Next host', () => {
  const cases: Array<[string, string]> = [
    ['15.5.9', 'plugin-15.wasm'],
    ['16.0.0', 'plugin-16-0.wasm'],
    ['16.0.11', 'plugin-16-0.wasm'],
    ['16.1.7', 'plugin-16.wasm'],
    ['16.2.12', 'plugin-16.wasm'],
    ['16.3.0-preview.10', 'plugin-16-3.wasm'],
    ['16.3.8', 'plugin-16-3.wasm'],
    ['16.4.0', 'plugin-16-4.wasm'],
    ['16.4.6', 'plugin-16-4.wasm'],
    ['16.5.0-canary.48', 'plugin-16-5.wasm'],
    ['16.5.2', 'plugin-16-5.wasm'],
  ];
  for (const [version, wasm] of cases) {
    assert.equal(wasmForNextVersion(version), wasm, version);
  }
});

test('wasmForNextVersion: falls back to the 15.x build for unknown versions', () => {
  assert.equal(wasmForNextVersion(undefined), 'plugin-15.wasm');
  assert.equal(wasmForNextVersion('not-a-version'), 'plugin-15.wasm');
});
