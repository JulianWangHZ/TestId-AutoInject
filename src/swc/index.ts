import path from 'node:path';
import { createRequire } from 'node:module';

// Type alias (not interface) so it stays assignable to Next's Record swcPlugins type.
export type SwcOptions = {
  platform?: 'web' | 'native';
  attribute?: string;
  envs?: string[];
  targets?: string[];
  injectAll?: boolean;
  stripDirs?: string[];
  cjkFallback?: boolean;
};

/** Detect the consuming project's Next.js major version, or 0 if unknown. */
function detectNextMajor(): number {
  try {
    const req = createRequire(path.join(process.cwd(), 'noop.js'));
    const version = (req('next/package.json') as { version: string }).version;
    return parseInt(version.split('.')[0], 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Build the `[wasmPath, options]` tuple for `experimental.swcPlugins`, selecting
 * the wasm compiled against the host swc_core that matches the project's Next.js
 * version: `plugin-16.wasm` (swc_core 54) for Next 16+, else `plugin-15.wasm`
 * (swc_core 35) for Next 15.x. Defaults to the 15.x build when Next isn't found.
 *
 * ```ts
 * import { swc } from 'testid-autoinject/swc';
 * export default { experimental: { swcPlugins: [swc({ platform: 'web' })] } };
 * ```
 */
export function swc(options: SwcOptions = {}): [string, SwcOptions] {
  const file = detectNextMajor() >= 16 ? 'plugin-16.wasm' : 'plugin-15.wasm';
  // Turbopack can't resolve a backslash-separated path; normalize for Windows.
  const wasmPath = path.join(__dirname, file).replace(/\\/g, '/');
  return [wasmPath, options];
}
