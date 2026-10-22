import type { Rule } from 'eslint';
import { getAttrName, type JSXOpeningElement } from '../../utils/jsx';
import { stringList, testidOptionsSchema } from './shared';

/** Spellings other test tools and older conventions use for the same thing. */
const KNOWN_ALIASES = ['data-cy', 'data-test', 'data-test-id', 'testid'];

interface Options {
  attribute?: string;
  forbidden?: string[];
}

/**
 * Rename off-convention testid attributes to the canonical one. Autofixable.
 * e.g. `data-test-id` / `data-cy` -> `data-testid`.
 */
export const consistentTestidAttribute: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'enforce a single canonical testid attribute name',
    },
    schema: testidOptionsSchema({ forbidden: stringList }),
    messages: {
      rename: 'Use "{{canonical}}" instead of "{{found}}"',
    },
  },
  create(context) {
    const { attribute: canonical = 'data-testid', forbidden = KNOWN_ALIASES }: Options =
      context.options[0] ?? {};
    // The canonical name is never an alias of itself, even if listed.
    const aliases = new Set(forbidden.filter((name) => name !== canonical));

    return {
      JSXOpeningElement(node: any) {
        for (const attr of (node as JSXOpeningElement).attributes) {
          if (attr.type !== 'JSXAttribute') continue;
          const found = getAttrName(attr);
          if (!aliases.has(found)) continue;
          const nameNode = (attr as any).name;
          context.report({
            node: nameNode,
            messageId: 'rename',
            data: { canonical, found },
            fix: (fixer) => fixer.replaceText(nameNode, canonical),
          });
        }
      },
    };
  },
};

export default consistentTestidAttribute;
