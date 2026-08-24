import type { ESLint, Linter } from 'eslint';
import { requireTestid } from './rules/require-testid';
import { consistentTestidAttribute } from './rules/consistent-testid-attribute';

/**
 * ESLint plugin — the safety net beside the Babel auto-injector. Auto-injection
 * handles first-party code silently; these rules catch what it cannot reach
 * (third-party components, non-forwarding wrappers) and keep the attribute name
 * consistent.
 */
const plugin: ESLint.Plugin = {
  meta: { name: 'testid-autoinject', version: '0.1.0' },
  rules: {
    'require-testid': requireTestid,
    'consistent-testid-attribute': consistentTestidAttribute,
  },
};

/** Flat-config preset factory. `platform` picks the default attribute. */
export function recommended(
  platform: 'native' | 'web' = 'web'
): Linter.Config {
  const attribute = platform === 'native' ? 'testID' : 'data-testid';
  return {
    name: `testid-autoinject/recommended-${platform}`,
    plugins: { testid: plugin },
    rules: {
      'testid/require-testid': ['warn', { attribute }],
      'testid/consistent-testid-attribute': ['warn', { attribute }],
    },
  };
}

export default plugin;
export { requireTestid, consistentTestidAttribute };
