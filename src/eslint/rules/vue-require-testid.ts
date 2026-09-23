import path from 'node:path';
import type { Rule } from 'eslint';
import { DEFAULT_TARGETS } from '../../babel-plugin';
import { deriveScreen, deriveBaseId } from '../../id/derive';
import { mineSignalFromSource } from '../../id/handler-signal';

const LABEL_ATTRS = ['aria-label', 'placeholder', 'title', 'label', 'name'];
const HANDLER_EVENTS = ['click', 'change', 'submit', 'input'];

function kebabToPascal(tag: string): string {
  return tag.replace(/(?:^|-)([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function staticAttr(node: any, name: string): string | null {
  for (const attr of node.startTag.attributes) {
    if (!attr.directive && attr.key.name === name && attr.value?.value) {
      return attr.value.value as string;
    }
  }
  return null;
}

function hasTestAttr(node: any, attribute: string): boolean {
  return node.startTag.attributes.some((attr: any) => {
    if (!attr.directive) return attr.key.name === attribute;
    return (
      attr.key.name?.name === 'bind' && attr.key.argument?.name === attribute
    );
  });
}

function findLabel(node: any): string | null {
  for (const key of LABEL_ATTRS) {
    const v = staticAttr(node, key);
    if (v && v.trim()) return v.trim();
  }
  for (const c of node.children) {
    if (c.type === 'VText' && c.value.trim()) return c.value.trim();
  }
  return null;
}

function findHandlerSignal(node: any, sourceCode: any): string | null {
  for (const event of HANDLER_EVENTS) {
    for (const attr of node.startTag.attributes) {
      if (!attr.directive) continue;
      if (attr.key.name?.name !== 'on') continue;
      if (attr.key.argument?.name !== event) continue;
      const expr = attr.value?.expression;
      if (!expr) continue;
      const s = mineSignalFromSource(sourceCode.getText(expr));
      if (s) return s;
    }
  }
  return null;
}

/**
 * Vue counterpart of `require-testid`, walking `<template>` instead of JSX.
 * Beyond flagging, the autofix inserts the same derived
 * `{screen}-{label|element}-{type}` id the build-time injector would produce,
 * so a fixed file and an injected build agree on selectors.
 */
export const vueRequireTestid: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'require a data-testid on interactive elements in Vue templates',
    },
    schema: [
      {
        type: 'object',
        properties: {
          attribute: { type: 'string' },
          targets: { type: 'array', items: { type: 'string' } },
          stripDirs: { type: 'array', items: { type: 'string' } },
          cjkFallback: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing: '<{{element}}> is missing {{attribute}}',
    },
  },
  create(context) {
    const services = (context.sourceCode as any).parserServices;
    if (typeof services?.defineTemplateBodyVisitor !== 'function') return {};

    const opt = (context.options[0] ?? {}) as {
      attribute?: string;
      targets?: string[];
      stripDirs?: string[];
      cjkFallback?: boolean;
    };
    const attribute = opt.attribute ?? 'data-testid';
    const targets = new Set(opt.targets ?? DEFAULT_TARGETS);

    const filename = context.filename ?? 'unknown';
    const rel = path.isAbsolute(filename)
      ? path.relative(process.cwd(), filename)
      : filename;
    const screen = deriveScreen(rel, opt.stripDirs);
    const counts = new Map<string, number>();

    return services.defineTemplateBodyVisitor({
      VElement(node: any) {
        const tag: string = node.rawName;
        if (!targets.has(tag) && !targets.has(kebabToPascal(tag))) return;
        if (hasTestAttr(node, attribute)) return;

        const elementName = tag.includes('-') ? kebabToPascal(tag) : tag;
        const base = deriveBaseId({
          screen,
          elementName,
          label: findLabel(node),
          handlerSignal: findHandlerSignal(node, context.sourceCode),
          cjkFallback: opt.cjkFallback,
        });
        const seen = counts.get(base) ?? 0;
        counts.set(base, seen + 1);
        const id = seen === 0 ? base : `${base}-${seen + 1}`;

        const tokens = services.getTemplateBodyTokenStore();
        context.report({
          node: node.startTag,
          messageId: 'missing',
          data: { element: tag, attribute },
          fix: (fixer) =>
            fixer.insertTextAfter(
              tokens.getFirstToken(node.startTag),
              ` ${attribute}="${id}"`
            ),
        });
      },
    });
  },
};

export default vueRequireTestid;
