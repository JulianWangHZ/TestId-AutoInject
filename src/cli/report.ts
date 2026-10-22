import type { Level, Platform } from './options';

export interface Finding {
  /** Path relative to the scanned root. */
  file: string;
  line: number;
  column: number;
  /** Rule name without the plugin prefix, e.g. `require-testid`. */
  rule: string;
  level: Level;
  message: string;
}

export interface SkippedFile {
  file: string;
  reason: string;
}

export interface ScanReport {
  root: string;
  platform: Platform;
  attribute: string;
  filesScanned: number;
  findings: Finding[];
  /** Files the parser could not read; reported so gaps are never hidden. */
  skipped: SkippedFile[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function byFile(findings: readonly Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) groups.set(f.file, [...(groups.get(f.file) ?? []), f]);
  return new Map(
    [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, list]) => [file, [...list].sort((x, y) => x.line - y.line || x.column - y.column)])
  );
}

export function formatText(report: ScanReport): string {
  const out: string[] = [`${report.root}  (${report.platform}, ${report.attribute})`, ''];
  const groups = byFile(report.findings);

  for (const [file, list] of groups) {
    out.push(file);
    for (const f of list) {
      out.push(`  ${`${f.line}:${f.column}`.padEnd(8)}${f.level.padEnd(6)}${f.message}  [${f.rule}]`);
    }
    out.push('');
  }

  for (const s of report.skipped) out.push(`skipped ${s.file}: ${s.reason}`);
  if (report.skipped.length > 0) out.push('');

  if (report.findings.length === 0) {
    out.push(`no gaps in ${plural(report.filesScanned, 'file')}`);
  } else {
    const errors = report.findings.filter((f) => f.level === 'error').length;
    out.push(
      `${plural(report.findings.length, 'gap')} in ${groups.size} of ${plural(report.filesScanned, 'file')}` +
        ` — ${plural(errors, 'error')}, ${plural(report.findings.length - errors, 'warning')}`
    );
  }
  return out.join('\n');
}

export function formatJson(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}
