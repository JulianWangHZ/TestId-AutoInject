#!/usr/bin/env node
/**
 * Standalone scanner — runs the plugin's ESLint rules against a target
 * directory to report coverage, without the target project installing anything.
 *
 * Usage:
 *   testid-scan <target-dir> [--platform native|web] [--attribute <name>]
 *               [--severity warn|error] [--include-tests]
 */
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
// typescript-eslint is a peer/dev dep of the consuming project; imported lazily.
import plugin, { recommended } from '../eslint/index';

interface Args {
  target: string | null;
  platform: 'native' | 'web';
  attribute: string | null;
  severity: 'warn' | 'error' | null;
  includeTests: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    target: null,
    platform: 'web',
    attribute: null,
    severity: null,
    includeTests: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--platform') args.platform = argv[++i] as Args['platform'];
    else if (a === '--attribute') args.attribute = argv[++i];
    else if (a === '--severity') args.severity = argv[++i] as Args['severity'];
    else if (a === '--include-tests') args.includeTests = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'usage: testid-scan <target-dir> [--platform native|web] ' +
          '[--attribute <name>] [--severity warn|error] [--include-tests]'
      );
      process.exit(0);
    } else positional.push(a);
  }
  args.target = positional[0] ?? null;
  return args;
}

function buildRules(args: Args): Record<string, [string | number, ...unknown[]]> {
  const preset = recommended(args.platform);
  const rules: Record<string, [string | number, ...unknown[]]> = {};
  for (const [name, entry] of Object.entries(preset.rules ?? {})) {
    const [baseSeverity, ...opts] = Array.isArray(entry) ? entry : [entry];
    const severity = args.severity ?? (baseSeverity as string | number);
    const options = opts.map((o) =>
      args.attribute && o && typeof o === 'object'
        ? { ...o, attribute: args.attribute }
        : o
    );
    rules[name] = [severity, ...options];
  }
  return rules;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target) {
    console.error('error: target directory required (see --help)');
    process.exit(2);
  }

  const targetAbs = resolve(process.cwd(), args.target);
  const tseslint = (await import('typescript-eslint')) as any;

  const ignores = args.includeTests
    ? []
    : [
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/__tests__/**',
        '**/__mocks__/**',
      ];

  const eslint = new ESLint({
    overrideConfigFile: true,
    cwd: targetAbs,
    overrideConfig: [
      { ignores },
      {
        files: ['**/*.{js,jsx,ts,tsx}'],
        linterOptions: { reportUnusedDisableDirectives: 'off' },
        languageOptions: {
          parser: tseslint.parser,
          ecmaVersion: 'latest',
          sourceType: 'module',
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { testid: plugin },
        rules: buildRules(args) as any,
      },
    ],
  });

  const raw = await eslint.lintFiles(['**/*.{js,jsx,ts,tsx}']);
  const results = raw
    .map((r) => {
      const messages = r.messages.filter(
        (m) => typeof m.ruleId === 'string' && m.ruleId.startsWith('testid/')
      );
      return {
        ...r,
        messages,
        errorCount: messages.filter((m) => m.severity === 2).length,
        warningCount: messages.filter((m) => m.severity === 1).length,
      };
    })
    .filter((r) => r.messages.length > 0);

  const formatter = await eslint.loadFormatter('stylish');
  const output = await formatter.format(results);
  if (output.trim()) console.log(output);

  const perRule: Record<string, number> = {};
  let errors = 0;
  let warnings = 0;
  for (const r of results) {
    errors += r.errorCount;
    warnings += r.warningCount;
    for (const m of r.messages) {
      perRule[m.ruleId as string] = (perRule[m.ruleId as string] ?? 0) + 1;
    }
  }

  console.log(
    `\nscanned ${raw.length} file(s); ${results.length} with findings; ` +
      `${errors} error(s); ${warnings} warning(s)\n` +
      `target: ${targetAbs}; platform: ${args.platform}` +
      `${args.attribute ? `; attribute: ${args.attribute}` : ''}`
  );

  if (Object.keys(perRule).length > 0) {
    console.log('\nbreakdown by rule:');
    for (const [name, count] of Object.entries(perRule).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${String(count).padStart(4)}  ${name}`);
    }
  }

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(2);
});
