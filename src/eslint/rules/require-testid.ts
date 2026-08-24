import type { Rule } from 'eslint';
import { getElementName, getAttrName, hasSpread } from '../../utils/jsx';
import { DEFAULT_TARGETS } from '../../babel-plugin';

/**
 * Safety net: flag interactive elements that still have no testID after build
 * injection — typically third-party components not covered by the Babel pass,
 * or custom wrappers that swallow the attribute instead of forwarding it.
 */
export const requireTestid: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'require a testID / data-testid on interactive elements not covered by auto-injection',
    },
    schema: [
      {
        type: 'object',
        properties: {
          attribute: { type: 'string' },
          targets: { type: 'array', items: { type: 'string' } },
          allowSpread: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing: '<{{element}}> is missing {{attribute}}',
    },
  },
  create(context) {
    const opt = (context.options[0] ?? {}) as {
      attribute?: string;
      targets?: string[];
      allowSpread?: boolean;
    };
    const attribute = opt.attribute ?? 'testID';
    const targets = new Set(opt.targets ?? DEFAULT_TARGETS);
    const allowSpread = opt.allowSpread ?? true;

    return {
      JSXOpeningElement(node: any) {
        const name = getElementName(node);
        if (!name) return;
        const last = name.split('.').pop() as string;
        if (!targets.has(last) && !targets.has(name)) return;
        if (allowSpread && hasSpread(node)) return;

        const has = node.attributes.some(
          (a: any) => a.type === 'JSXAttribute' && getAttrName(a) === attribute
        );
        if (!has) {
          context.report({
            node,
            messageId: 'missing',
            data: { element: name, attribute },
          });
        }
      },
    };
  },
};

export default requireTestid;
