import type { ESLint, Linter } from 'eslint';
import { requireTestid } from './rules/require-testid';
import { consistentTestidAttribute } from './rules/consistent-testid-attribute';
import { vueRequireTestid } from './rules/vue-require-testid';

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
    'vue-require-testid': vueRequireTestid,
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

/**
 * Flat-config preset for `.vue` files. Requires `vue-eslint-parser`
 * (loaded lazily so React-only consumers never touch it).
 */
export function recommendedVue(): Linter.Config {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const parser = require('vue-eslint-parser') as Linter.Parser;
  return {
    name: 'testid-autoinject/recommended-vue',
    files: ['**/*.vue'],
    plugins: { testid: plugin },
    languageOptions: { parser },
    rules: {
      'testid/vue-require-testid': ['warn', { attribute: 'data-testid' }],
    },
  };
}

export default plugin;
export { requireTestid, consistentTestidAttribute, vueRequireTestid };
