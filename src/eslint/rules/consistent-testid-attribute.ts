import type { Rule } from 'eslint';
import { getAttrName } from '../../utils/jsx';

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
    schema: [
      {
        type: 'object',
        properties: {
          attribute: { type: 'string' },
          forbidden: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rename: 'Use "{{canonical}}" instead of "{{found}}"',
    },
  },
  create(context) {
    const opt = (context.options[0] ?? {}) as {
      attribute?: string;
      forbidden?: string[];
    };
    const canonical = opt.attribute ?? 'data-testid';
    const forbidden = new Set(
      opt.forbidden ?? ['data-test-id', 'data-test', 'data-cy', 'testid']
    );

    return {
      JSXAttribute(node: any) {
        const name = getAttrName(node);
        if (!name || name === canonical || !forbidden.has(name)) return;
        context.report({
          node: node.name,
          messageId: 'rename',
          data: { canonical, found: name },
          fix(fixer) {
            return fixer.replaceText(node.name, canonical);
          },
        });
      },
    };
  },
};

export default consistentTestidAttribute;
