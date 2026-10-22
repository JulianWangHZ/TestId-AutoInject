import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';

import { consistentTestidAttribute } from '../src/eslint/rules/consistent-testid-attribute';
import { requireTestid } from '../src/eslint/rules/require-testid';

const linter = new Linter();

const plugin = {
  rules: {
    'consistent-testid-attribute': consistentTestidAttribute,
    'require-testid': requireTestid,
  },
};

function baseConfig(ruleId: string, options?: unknown) {
  return {
    plugins: { testid: plugin },
    languageOptions: {
      ecmaVersion: 'latest' as const,
      sourceType: 'module' as const,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      [`testid/${ruleId}`]: options === undefined ? 'error' : ['error', options],
    },
  };
}

function lint(code: string, ruleId: string, options?: unknown) {
  return linter.verify(code, baseConfig(ruleId, options) as never);
}

function fix(code: string, ruleId: string, options?: unknown) {
  return linter.verifyAndFix(code, baseConfig(ruleId, options) as never);
}

// --- consistent-testid-attribute -------------------------------------------

test('consistent: canonical data-testid is NOT flagged (web preset)', () => {
  const msgs = lint(`const x = <button data-testid="go" />;`, 'consistent-testid-attribute', {
    attribute: 'data-testid',
  });
  assert.equal(msgs.length, 0, `expected no report, got: ${JSON.stringify(msgs)}`);
});

test('consistent: off-convention data-test-id is flagged and fixed to data-testid', () => {
  const result = fix(`const x = <button data-test-id="go" />;`, 'consistent-testid-attribute', {
    attribute: 'data-testid',
  });
  assert.equal(result.fixed, true);
  assert.match(result.output, /data-testid="go"/);
  assert.doesNotMatch(result.output, /data-test-id/);
});

test('consistent: --fix converges (no self-rename loop on canonical)', () => {
  const result = fix(`const x = <button data-testid="go" />;`, 'consistent-testid-attribute', {
    attribute: 'data-testid',
  });
  assert.equal(result.fixed, false, 'canonical attribute must not be rewritten to itself');
  assert.equal(result.messages.length, 0);
});

test('consistent: other aliases (data-cy, testid) still get renamed', () => {
  for (const alias of ['data-cy', 'testid', 'data-test']) {
    const result = fix(`const x = <button ${alias}="go" />;`, 'consistent-testid-attribute', {
      attribute: 'data-testid',
    });
    assert.equal(result.fixed, true, `${alias} should be renamed`);
    assert.match(result.output, /data-testid="go"/);
  }
});

test('consistent: default canonical is data-testid when no option given', () => {
  const msgs = lint(`const x = <button data-testid="go" />;`, 'consistent-testid-attribute');
  assert.equal(msgs.length, 0);
});

test('consistent: pinning the old name as canonical does not self-loop', () => {
  // Migration path: users who keep `data-test-id` must not get it flagged.
  const result = fix(`const x = <button data-test-id="go" />;`, 'consistent-testid-attribute', {
    attribute: 'data-test-id',
  });
  assert.equal(result.fixed, false);
  assert.equal(result.messages.length, 0);
});

// --- require-testid ---------------------------------------------------------

test('require: interactive element missing the attribute is flagged', () => {
  const msgs = lint(`const x = <button>Go</button>;`, 'require-testid', {
    attribute: 'data-testid',
  });
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].message, /missing data-testid/);
});

test('require: element with the attribute passes', () => {
  const msgs = lint(`const x = <button data-testid="go">Go</button>;`, 'require-testid', {
    attribute: 'data-testid',
  });
  assert.equal(msgs.length, 0);
});

test('require: non-target element is ignored', () => {
  const msgs = lint(`const x = <div>Go</div>;`, 'require-testid', { attribute: 'data-testid' });
  assert.equal(msgs.length, 0);
});

test('require: spread is allowed by default (assumed to forward the attribute)', () => {
  const msgs = lint(`const x = <button {...props}>Go</button>;`, 'require-testid', {
    attribute: 'data-testid',
  });
  assert.equal(msgs.length, 0);
});

test('require: allowSpread=false flags spread elements', () => {
  const msgs = lint(`const x = <button {...props}>Go</button>;`, 'require-testid', {
    attribute: 'data-testid',
    allowSpread: false,
  });
  assert.equal(msgs.length, 1);
});

// --- behaviour pinned before the shared-helpers refactor --------------------

test('require: default attribute is testID', () => {
  const msgs = lint(`const x = <Pressable />;`, 'require-testid');
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].message, '<Pressable> is missing testID');
});

test('require: dotted components match on the full name or the last segment', () => {
  const opts = { attribute: 'testID' };
  assert.equal(lint(`const x = <UI.Button />;`, 'require-testid', opts).length, 1);
  assert.equal(lint(`const x = <UI.Card />;`, 'require-testid', opts).length, 0);
  assert.equal(
    lint(`const x = <Form.Field />;`, 'require-testid', { ...opts, targets: ['Form.Field'] }).length,
    1
  );
});

test('require: custom targets replace the defaults', () => {
  const opts = { attribute: 'testID', targets: ['Card'] };
  assert.equal(lint(`const x = <Card />;`, 'require-testid', opts).length, 1);
  assert.equal(lint(`const x = <Button />;`, 'require-testid', opts).length, 0);
});

test('require: namespaced attribute names are matched exactly', () => {
  const msgs = lint(`const x = <button qa:id="x" />;`, 'require-testid', { attribute: 'qa:id' });
  assert.equal(msgs.length, 0);
});

test('require: unknown options are rejected by the schema', () => {
  assert.throws(() => lint(`const x = <button />;`, 'require-testid', { nope: true }));
});

test('consistent: message text and fix target are the attribute name only', () => {
  const msgs = lint(`const x = <button data-cy="go" />;`, 'consistent-testid-attribute');
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].message, 'Use "data-testid" instead of "data-cy"');
  const out = fix(`const x = <button data-cy="go" />;`, 'consistent-testid-attribute').output;
  assert.equal(out, `const x = <button data-testid="go" />;`);
});

test('consistent: custom forbidden list replaces the defaults', () => {
  const opts = { attribute: 'testID', forbidden: ['qa-id'] };
  assert.equal(lint(`const x = <View qa-id="a" />;`, 'consistent-testid-attribute', opts).length, 1);
  assert.equal(lint(`const x = <View data-cy="a" />;`, 'consistent-testid-attribute', opts).length, 0);
});

test('consistent: native canonical leaves data-testid alone by default', () => {
  const opts = { attribute: 'testID' };
  assert.equal(lint(`const x = <View data-testid="a" />;`, 'consistent-testid-attribute', opts).length, 0);
  assert.equal(lint(`const x = <View testid="a" />;`, 'consistent-testid-attribute', opts).length, 1);
});

test('consistent: every off-convention attribute on one element is reported in order', () => {
  const msgs = lint(`const x = <b data-cy="a" data-test="b" />;`, 'consistent-testid-attribute');
  assert.deepEqual(
    msgs.map((m) => m.message),
    ['Use "data-testid" instead of "data-cy"', 'Use "data-testid" instead of "data-test"']
  );
});

test('consistent: unknown options are rejected by the schema', () => {
  assert.throws(() => lint(`const x = <b />;`, 'consistent-testid-attribute', { nope: 1 }));
});
