import { relative, resolve } from 'node:path';
import { ESLint, type Linter } from 'eslint';
import plugin, { recommended } from '../eslint/index';
import type { Level, ScanOptions } from './options';
import type { Finding, ScanReport, SkippedFile } from './report';

const PREFIX = 'testid/';
const SOURCE_FILES = '**/*.{js,jsx,ts,tsx}';
const TEST_FILES = ['**/*.{test,spec}.{js,jsx,ts,tsx}', '**/{__tests__,__mocks__}/**'];

function presetLevel(entry: Linter.RuleEntry | undefined): Level {
  const raw = Array.isArray(entry) ? entry[0] : entry;
  return raw === 'error' || raw === 2 ? 'error' : 'warn';
}

/** Same rules the `recommended()` preset enables, re-targeted at one attribute. */
function scanRules(opts: ScanOptions): Linter.RulesRecord {
  const preset = recommended(opts.platform).rules ?? {};
  return Object.fromEntries(
    Object.entries(preset).map(([id, entry]) => [
      id,
      [opts.severity ?? presetLevel(entry), { attribute: opts.attribute }],
    ])
  );
}

async function createLinter(root: string, opts: ScanOptions, rules: Linter.RulesRecord): Promise<ESLint> {
  // typescript-eslint comes from the consuming project, so it is loaded on demand.
  const { parser } = (await import('typescript-eslint')) as unknown as { parser: Linter.Parser };
  return new ESLint({
    cwd: root,
    overrideConfigFile: true,
    errorOnUnmatchedPattern: false,
    overrideConfig: [
      ...(opts.includeTests ? [] : [{ ignores: TEST_FILES }]),
      {
        files: [SOURCE_FILES],
        // Target code may disable rules we never load; don't report those comments.
        linterOptions: { reportUnusedDisableDirectives: 'off' },
        languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { testid: plugin },
        rules,
      },
    ],
  });
}

export async function scanDirectory(opts: ScanOptions): Promise<ScanReport> {
  const root = resolve(process.cwd(), opts.dir);
  const rules = scanRules(opts);
  const linter = await createLinter(root, opts, rules);
  const results = await linter.lintFiles([SOURCE_FILES]);

  const findings: Finding[] = [];
  const skipped: SkippedFile[] = [];
  for (const result of results) {
    const file = relative(root, result.filePath);
    for (const m of result.messages) {
      if (m.fatal) {
        skipped.push({ file, reason: m.message });
      } else if (m.ruleId && m.ruleId in rules) {
        findings.push({
          file,
          line: m.line,
          column: m.column,
          rule: m.ruleId.slice(PREFIX.length),
          level: m.severity === 2 ? 'error' : 'warn',
          message: m.message,
        });
      }
    }
  }

  return {
    root,
    platform: opts.platform,
    attribute: opts.attribute,
    filesScanned: results.length,
    findings,
    skipped,
  };
}
