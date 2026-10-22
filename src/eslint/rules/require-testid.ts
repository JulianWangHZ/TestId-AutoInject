import type { Rule } from 'eslint';
import { getAttrName, getElementName, hasSpread, type JSXOpeningElement } from '../../utils/jsx';
import { stringList, targetMatcher, testidOptionsSchema } from './shared';

interface Options {
  attribute?: string;
  targets?: string[];
  allowSpread?: boolean;
}

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
    schema: testidOptionsSchema({ targets: stringList, allowSpread: { type: 'boolean' } }),
    messages: {
      missing: '<{{element}}> is missing {{attribute}}',
    },
  },
  create(context) {
    const { attribute = 'testID', targets, allowSpread = true }: Options = context.options[0] ?? {};
    const isTarget = targetMatcher(targets);

    // A spread may forward the attribute from the caller, so by default we
    // trust it rather than guess.
    const needsTestId = (el: JSXOpeningElement): boolean =>
      isTarget(getElementName(el)) &&
      !(allowSpread && hasSpread(el)) &&
      !el.attributes.some((a) => a.type === 'JSXAttribute' && getAttrName(a) === attribute);

    return {
      JSXOpeningElement(node: any) {
        const el = node as JSXOpeningElement;
        if (!needsTestId(el)) return;
        context.report({
          node,
          messageId: 'missing',
          data: { element: getElementName(el), attribute },
        });
      },
    };
  },
};

export default requireTestid;
