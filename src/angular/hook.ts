import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectInlineTemplates } from './inline';
import type { AngularInjectOptions } from './options';
import { injectAngularTemplate } from './template';

type ReadFileSync = typeof fs.readFileSync;

/** The app shell (`index.html`) is a document, not a component template. */
const DOCUMENT_RE = /<!doctype|<html[\s>]/i;

const warned = new Set<string>();

// A broken template must not break the build, but a missing compiler or an
// unsupported Node (no `require(esm)`) must not fail silently either.
function warnOnce(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (warned.has(message)) return;
  warned.add(message);
  process.emitWarning(`testid-autoinject: template left unchanged: ${message}`);
}

function toPath(target: unknown): string | null {
  if (typeof target === 'string') return target;
  if (target instanceof URL && target.protocol === 'file:') return fileURLToPath(target);
  return null;
}

function isProjectFile(file: string, root: string): boolean {
  const rel = path.relative(root, file);
  return !rel.startsWith('..') && !path.isAbsolute(rel) && !rel.split(path.sep).includes('node_modules');
}

function transform(source: string, file: string, options: AngularInjectOptions): string {
  if (file.endsWith('.html')) {
    return DOCUMENT_RE.test(source) ? source : injectAngularTemplate(source, file, options);
  }
  if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
    return injectInlineTemplates(source, file, options);
  }
  return source;
}

/**
 * Rewrite Angular templates as the compiler reads them from disk. The Angular
 * CLI reads `templateUrl` files and component sources through TypeScript's
 * `ts.sys.readFile` (`fs.readFileSync`), often inside a worker thread, and
 * exposes no template hook — so this is the one seam every builder shares.
 *
 * Only `.html` / `.ts` files under `root` and outside `node_modules` are
 * touched. A file that fails to transform is returned unchanged, with a
 * one-time warning. Returns a function that restores `fs.readFileSync`.
 */
export function installAngularHook(
  options: AngularInjectOptions = {},
  root: string = process.cwd()
): () => void {
  const original: ReadFileSync = fs.readFileSync;

  const patched = function (this: unknown, ...args: Parameters<ReadFileSync>) {
    const result = (original as (...a: unknown[]) => string | Buffer).apply(fs, args);
    const file = toPath(args[0]);
    if (!file || !/\.(html|ts)$/.test(file)) return result;
    const abs = path.resolve(file);
    if (!isProjectFile(abs, root)) return result;
    try {
      const source = typeof result === 'string' ? result : result.toString('utf8');
      const out = transform(source, path.relative(root, abs), options);
      if (out === source) return result;
      return typeof result === 'string' ? out : Buffer.from(out, 'utf8');
    } catch (err) {
      warnOnce(err);
      return result;
    }
  } as ReadFileSync;

  fs.readFileSync = patched;
  return () => {
    if (fs.readFileSync === patched) fs.readFileSync = original;
  };
}
