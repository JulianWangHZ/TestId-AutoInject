import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseScanOptions, ScanUsageError } from '../src/cli/options';
import { scanDirectory } from '../src/cli/run-scan';
import { formatJson, formatText, type ScanReport } from '../src/cli/report';

// --- option parsing ---------------------------------------------------------

test('options: defaults to web platform with data-testid', () => {
  const opts = parseScanOptions(['./src']);
  assert.equal(opts.kind, 'scan');
  if (opts.kind !== 'scan') return;
  assert.equal(opts.platform, 'web');
  assert.equal(opts.attribute, 'data-testid');
  assert.equal(opts.severity, undefined);
  assert.equal(opts.includeTests, false);
  assert.equal(opts.json, false);
});

test('options: native platform defaults to testID and accepts --flag=value', () => {
  const opts = parseScanOptions(['./app', '--platform=native', '--severity', 'error']);
  assert.equal(opts.kind, 'scan');
  if (opts.kind !== 'scan') return;
  assert.equal(opts.attribute, 'testID');
  assert.equal(opts.severity, 'error');
});

test('options: explicit --attribute wins over the platform default', () => {
  const opts = parseScanOptions(['./src', '--attribute', 'data-qa', '--json']);
  assert.equal(opts.kind, 'scan');
  if (opts.kind !== 'scan') return;
  assert.equal(opts.attribute, 'data-qa');
  assert.equal(opts.json, true);
});

test('options: --help short-circuits without a directory', () => {
  assert.equal(parseScanOptions(['--help']).kind, 'help');
  assert.equal(parseScanOptions(['-h']).kind, 'help');
});

test('options: rejects bad input with a usage error', () => {
  assert.throws(() => parseScanOptions([]), ScanUsageError);
  assert.throws(() => parseScanOptions(['./src', '--platform', 'ios']), ScanUsageError);
  assert.throws(() => parseScanOptions(['./src', '--severity', 'fatal']), ScanUsageError);
  assert.throws(() => parseScanOptions(['./src', '--nope']), ScanUsageError);
  assert.throws(() => parseScanOptions(['./a', './b']), ScanUsageError);
});

// --- scanning ---------------------------------------------------------------

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'testid-scan-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const scanOpts = {
  kind: 'scan' as const,
  platform: 'web' as const,
  attribute: 'data-testid',
  severity: undefined,
  includeTests: false,
  json: false,
};

test('scan: reports gaps per file and skips test files by default', async () => {
  const root = fixture({
    'src/Login.tsx': 'export const L = () => <button onClick={go}>Go</button>;',
    'src/Ok.tsx': 'export const O = () => <button data-testid="ok">Ok</button>;',
    'src/Login.test.tsx': 'export const T = () => <button>t</button>;',
    'src/__mocks__/m.tsx': 'export const M = () => <button>m</button>;',
  });
  const report = await scanDirectory({ ...scanOpts, dir: root });

  assert.equal(report.filesScanned, 2);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].file, join('src', 'Login.tsx'));
  assert.equal(report.findings[0].rule, 'require-testid');
  assert.equal(report.findings[0].level, 'warn');
});

test('scan: --include-tests also covers test files', async () => {
  const root = fixture({ 'a.test.jsx': 'export const T = () => <button>t</button>;' });
  const report = await scanDirectory({ ...scanOpts, dir: root, includeTests: true });
  assert.equal(report.findings.length, 1);
});

test('scan: flags off-convention attribute names and honours severity', async () => {
  const root = fixture({ 'a.jsx': 'export const A = () => <button data-test-id="a">a</button>;' });
  const report = await scanDirectory({ ...scanOpts, dir: root, severity: 'error' });
  const rules = report.findings.map((f) => f.rule);
  assert.ok(rules.includes('consistent-testid-attribute'));
  assert.ok(report.findings.every((f) => f.level === 'error'));
});

test('scan: unparsable files are counted as skipped, not dropped silently', async () => {
  const root = fixture({ 'broken.jsx': 'export const = <' });
  const report = await scanDirectory({ ...scanOpts, dir: root });
  assert.equal(report.findings.length, 0);
  assert.deepEqual(report.skipped.map((s) => s.file), ['broken.jsx']);
});

test('scan: an empty directory is a clean report, not a crash', async () => {
  const report = await scanDirectory({ ...scanOpts, dir: fixture({}) });
  assert.equal(report.filesScanned, 0);
  assert.equal(report.findings.length, 0);
});

// --- reporting --------------------------------------------------------------

const sample: ScanReport = {
  root: '/repo',
  platform: 'web',
  attribute: 'data-testid',
  filesScanned: 3,
  skipped: [],
  findings: [
    { file: 'b.tsx', line: 4, column: 2, rule: 'require-testid', level: 'warn', message: '<button> is missing data-testid' },
    { file: 'a.tsx', line: 9, column: 1, rule: 'require-testid', level: 'error', message: '<input> is missing data-testid' },
    { file: 'a.tsx', line: 2, column: 7, rule: 'consistent-testid-attribute', level: 'warn', message: 'Use "data-testid" instead of "data-test-id"' },
  ],
};

test('report: text groups by file in path order and sorts by position', () => {
  const out = formatText(sample);
  const aAt = out.indexOf('a.tsx');
  const bAt = out.indexOf('b.tsx');
  assert.ok(aAt >= 0 && aAt < bAt);
  assert.ok(out.indexOf('2:7') < out.indexOf('9:1'));
  assert.match(out, /3 gaps in 2 of 3 files/);
  assert.match(out, /1 error, 2 warnings/);
});

test('report: clean scan says so', () => {
  const out = formatText({ ...sample, findings: [] });
  assert.match(out, /no gaps in 3 files/);
});

test('report: json is machine-readable and lossless', () => {
  const parsed = JSON.parse(formatJson(sample));
  assert.equal(parsed.findings.length, 3);
  assert.equal(parsed.attribute, 'data-testid');
});
