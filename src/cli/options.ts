import { parseArgs } from 'node:util';

export type Platform = 'native' | 'web';
export type Level = 'warn' | 'error';

export interface ScanOptions {
  kind: 'scan';
  dir: string;
  platform: Platform;
  /** Resolved attribute: explicit `--attribute`, else the platform default. */
  attribute: string;
  /** Forced level for every rule; `undefined` keeps the preset's level. */
  severity: Level | undefined;
  includeTests: boolean;
  json: boolean;
}

export type CliRequest = ScanOptions | { kind: 'help' };

/** Bad flags / values. The entry point maps this to exit code 2. */
export class ScanUsageError extends Error {}

export const USAGE = `testid-scan — report elements the injector and lint rules would flag

usage: testid-scan <dir> [options]

  --platform native|web    attribute preset (default: web)
  --attribute <name>       check this attribute instead of the preset's
  --severity warn|error    force one level for every rule
  --include-tests          also scan *.test.* / *.spec.* / __tests__ / __mocks__
  --json                   print the report as JSON
  -h, --help               show this message`;

const PLATFORMS: readonly Platform[] = ['native', 'web'];
const LEVELS: readonly Level[] = ['warn', 'error'];

function oneOf<T extends string>(flag: string, value: string | undefined, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new ScanUsageError(`--${flag} must be one of ${allowed.join(', ')} (got "${value}")`);
}

export function parseScanOptions(argv: string[]): CliRequest {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        platform: { type: 'string' },
        attribute: { type: 'string' },
        severity: { type: 'string' },
        'include-tests': { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    throw new ScanUsageError(err instanceof Error ? err.message : String(err));
  }

  const { values, positionals } = parsed;
  if (values.help) return { kind: 'help' };

  if (positionals.length !== 1) {
    throw new ScanUsageError(
      positionals.length === 0 ? 'missing <dir> to scan' : `expected one <dir>, got ${positionals.length}`
    );
  }

  const platform = oneOf('platform', values.platform, PLATFORMS) ?? 'web';
  return {
    kind: 'scan',
    dir: positionals[0],
    platform,
    attribute: values.attribute ?? (platform === 'native' ? 'testID' : 'data-testid'),
    severity: oneOf('severity', values.severity, LEVELS),
    includeTests: values['include-tests'] ?? false,
    json: values.json ?? false,
  };
}
