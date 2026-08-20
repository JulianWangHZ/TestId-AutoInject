import fs from 'node:fs';
import path from 'node:path';

export interface Mapping {
  /** The generated testID / data-test-id value. */
  id: string;
  /** Source file, relative to project root. */
  file: string;
  /** JSX element name the id was attached to. */
  element: string;
  /** Human label the id was derived from, if any. */
  label?: string | null;
}

const registry = new Map<string, Mapping>();
let outFile: string | null = null;
let hookInstalled = false;

/**
 * Point the map registry at an output file and ensure it is flushed once the
 * build process exits. Safe to call many times (per source file) — the flush
 * hook is installed only once.
 */
export function configureMapOutput(file: string): void {
  outFile = file;
  if (!hookInstalled) {
    hookInstalled = true;
    process.on('exit', flushMap);
  }
}

export function recordMapping(mapping: Mapping): void {
  registry.set(mapping.id, mapping);
}

/** Write the accumulated id -> source map to disk as sorted JSON. */
export function flushMap(): void {
  if (!outFile || registry.size === 0) return;
  const list = [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(list, null, 2) + '\n');
}

/** Test hook: clear registry + output target between runs. */
export function _resetMap(): void {
  registry.clear();
  outFile = null;
}
