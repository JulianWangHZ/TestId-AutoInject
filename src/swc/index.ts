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

/** The consuming project's installed Next.js version, or undefined if not found. */
function detectNextVersion(): string | undefined {
  try {
    const req = createRequire(path.join(process.cwd(), 'noop.js'));
    return (req('next/package.json') as { version: string }).version;
  } catch {
    return undefined;
  }
}

/**
 * Wasm builds by the first Next 16 minor they serve, newest first. Each is
 * compiled against that minor's host swc_core; a mismatch makes Next fail with
 * `failed to invoke plugin`.
 */
const NEXT_16_WASM: ReadonlyArray<readonly [minMinor: number, wasm: string]> = [
  [5, 'plugin-16-5.wasm'], // swc_core 84
  [4, 'plugin-16-4.wasm'], // swc_core 79
  [3, 'plugin-16-3.wasm'], // swc_core 73
  [1, 'plugin-16.wasm'], // swc_core 54 (16.2 hosts 57, same AST)
  [0, 'plugin-16-0.wasm'], // swc_core 45
];

/** Map a Next.js version to its wasm. Unknown versions fall back to the 15.x build. */
export function wasmForNextVersion(version: string | undefined): string {
  const match = /^(\d+)\.(\d+)\./.exec(version ?? '');
  if (!match) return 'plugin-15.wasm';
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major < 16) return 'plugin-15.wasm'; // swc_core 35
  if (major > 16) return NEXT_16_WASM[0][1];
  return NEXT_16_WASM.find(([minMinor]) => minor >= minMinor)?.[1] ?? 'plugin-16-0.wasm';
}

/**
 * Build the `[wasmSpecifier, options]` tuple for `experimental.swcPlugins`,
 * selecting the wasm compiled against the project's Next.js host swc_core
 * (see `wasmForNextVersion`).
 *
 * ```ts
 * import { swc } from 'testid-autoinject/swc';
 * export default { experimental: { swcPlugins: [swc({ platform: 'web' })] } };
 * ```
 */
export function swc(options: SwcOptions = {}): [string, SwcOptions] {
  const file = wasmForNextVersion(detectNextVersion());
  // Package subpath, not an absolute path: Turbopack resolves swcPlugins via
  // module resolution and rejects filesystem paths (webpack accepts both).
  return [`testid-autoinject/swc/${file}`, options];
}
