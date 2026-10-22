#!/usr/bin/env node
/**
 * `testid-scan <dir>` — audits a codebase with this package's lint rules and
 * prints the gaps, so a project can be checked before it adopts the plugin.
 *
 * Exit codes: 0 clean or warnings only, 1 error-level gaps, 2 bad usage / crash.
 */
import { parseScanOptions, ScanUsageError, USAGE } from './options';
import { formatJson, formatText } from './report';
import { scanDirectory } from './run-scan';

async function run(argv: string[]): Promise<number> {
  const request = parseScanOptions(argv);
  if (request.kind === 'help') {
    console.log(USAGE);
    return 0;
  }

  const report = await scanDirectory(request);
  console.log(request.json ? formatJson(report) : formatText(report));
  return report.findings.some((f) => f.level === 'error') ? 1 : 0;
}

run(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    if (err instanceof ScanUsageError) {
      console.error(`testid-scan: ${err.message}\n\n${USAGE}`);
    } else {
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    }
    process.exit(2);
  }
);
