import path from 'node:path';
import { deriveScreen } from '../id/derive';

/**
 * Angular files live as `login/login.component.html`; collapse that pair to
 * `login.html` so the screen slug is `login`, not `login-login-component`.
 */
export function angularScreenPath(relativePath: string): string {
  const ext = path.extname(relativePath);
  const dir = path.dirname(relativePath);
  const base = path.basename(relativePath, ext).replace(/\.component$/, '');
  return path.basename(dir) === base ? dir + ext : path.join(dir, base + ext);
}

export function angularScreen(file: string, stripDirs?: string[]): string {
  const rel = path.isAbsolute(file) ? path.relative(process.cwd(), file) : file;
  return deriveScreen(angularScreenPath(rel), stripDirs);
}
