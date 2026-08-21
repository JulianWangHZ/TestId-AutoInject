import path from 'node:path';
import type { PluginObj, PluginPass } from '@babel/core';
import type {
  JSXOpeningElement,
  JSXAttribute,
  JSXElement,
  Node,
} from '@babel/types';
import { deriveScreen, deriveBaseId } from './id/derive';
import { deriveHandlerSignal } from './id/handler-signal';
import { configureMapOutput, recordMapping } from './map/emit';

export interface InjectOptions {
  /** `native` -> inject `testID`; `web` -> inject `data-test-id`. Default `web`. */
  platform?: 'native' | 'web';
  /** Override the attribute name entirely. */
  attribute?: string;
  /** Only run when process.env.NODE_ENV is one of these. Default test+development. */
  envs?: string[];
  /** Element names to inject on. Ignored when `injectAll` is true. */
  targets?: string[];
  /** Inject on every JSX element regardless of `targets`. Default false. */
  injectAll?: boolean;
  /** Leading path segments to drop when deriving the screen slug. */
  stripDirs?: string[];
  /** Emit an id -> source map. Default false. */
  emitMap?: boolean;
  /** Where to write the map. Default `<cwd>/testid-map.json`. */
  mapFile?: string;
  /**
   * Keep a non-ASCII label (CJK, …) verbatim as a readable fallback when no
   * English signal is found. Default true. Set false for ASCII-only ids.
   */
  cjkFallback?: boolean;
}

/** Interactive elements worth a stable selector, for both RN and web. */
export const DEFAULT_TARGETS = [
  'Button',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TextInput',
  'Input',
  'Select',
  'Switch',
  'Checkbox',
  'Radio',
  'button',
  'a',
  'input',
  'textarea',
  'select',
];

/** Attributes, in priority order, that carry a human-meaningful label. */
const LABEL_ATTRS = [
  'accessibilityLabel',
  'aria-label',
  'label',
  'placeholder',
  'title',
  'name',
];

function getElementName(open: JSXOpeningElement): string | null {
  const n = open.name;
  if (n.type === 'JSXIdentifier') return n.name;
  if (n.type === 'JSXMemberExpression') {
    const parts: string[] = [];
    let cur: typeof n | typeof n.object = n;
    while (cur.type === 'JSXMemberExpression') {
      parts.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur.type === 'JSXIdentifier') parts.unshift(cur.name);
    return parts.join('.');
  }
  return null; // namespaced -> skip
}

function attrName(a: JSXAttribute): string | null {
  const n = a.name;
  if (n.type === 'JSXIdentifier') return n.name;
  if (n.type === 'JSXNamespacedName') return `${n.namespace.name}:${n.name.name}`;
  return null;
}

function stringAttrValue(a: JSXAttribute): string | null {
  const v = a.value;
  if (!v) return null;
  if (v.type === 'StringLiteral') return v.value;
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression;
    if (e.type === 'StringLiteral') return e.value;
    if (e.type === 'TemplateLiteral' && e.expressions.length === 0) {
      return e.quasis[0]?.value.cooked ?? null;
    }
  }
  return null;
}

function hasAttr(open: JSXOpeningElement, name: string): boolean {
  return open.attributes.some(
    (a) => a.type === 'JSXAttribute' && attrName(a) === name
  );
}

function findLabel(open: JSXOpeningElement, children: Node[]): string | null {
  for (const key of LABEL_ATTRS) {
    for (const a of open.attributes) {
      if (a.type === 'JSXAttribute' && attrName(a) === key) {
        const s = stringAttrValue(a);
        if (s && s.trim()) return s.trim();
      }
    }
  }
  for (const c of children) {
    if (c.type === 'JSXText' && c.value.trim()) return c.value.trim();
  }
  return null;
}

/**
 * Babel plugin: inject a stable testID / data-test-id onto interactive JSX
 * elements at build time, so frontend code stays untouched and QA automation
 * (Appium, Playwright) gets deterministic selectors.
 *
 * Ids are `{screen}-{label|element}-{type}` and are independent of sibling
 * order — adding an unrelated element does not shift existing ids.
 */
export default function injectTestId({
  types: t,
}: {
  types: typeof import('@babel/types');
}): PluginObj<PluginPass & { opts: InjectOptions }> {
  return {
    name: 'inject-testid',
    visitor: {
      Program(programPath, state) {
        const opts = (state.opts ?? {}) as InjectOptions;
        const envs = opts.envs ?? ['test', 'development'];
        if (!envs.includes(process.env.NODE_ENV ?? '')) return;

        const attribute =
          opts.attribute ??
          (opts.platform === 'native' ? 'testID' : 'data-test-id');
        const targets = opts.injectAll
          ? null
          : new Set(opts.targets ?? DEFAULT_TARGETS);

        const cwd = state.cwd ?? process.cwd();
        const filename = state.filename ?? 'unknown';
        const rel = path.relative(cwd, filename);
        const screen = deriveScreen(rel, opts.stripDirs);

        if (opts.emitMap) {
          configureMapOutput(opts.mapFile ?? path.join(cwd, 'testid-map.json'));
        }

        const counts = new Map<string, number>();

        programPath.traverse({
          JSXOpeningElement(jsxPath) {
            const open = jsxPath.node;
            const name = getElementName(open);
            if (!name) return; // namespaced -> skip
            if (hasAttr(open, attribute)) return; // manual value wins

            if (targets) {
              const last = name.split('.').pop() ?? name;
              if (!targets.has(last) && !targets.has(name)) return;
            }

            const parent = jsxPath.parent;
            const children =
              parent && parent.type === 'JSXElement'
                ? (parent as JSXElement).children
                : [];
            const label = findLabel(open, children);
            const handlerSignal = deriveHandlerSignal(open);

            const base = deriveBaseId({
              screen,
              elementName: name,
              label,
              handlerSignal,
              cjkFallback: opts.cjkFallback,
            });
            const seen = counts.get(base) ?? 0;
            counts.set(base, seen + 1);
            const id = seen === 0 ? base : `${base}-${seen + 1}`;

            open.attributes.push(
              t.jsxAttribute(t.jsxIdentifier(attribute), t.stringLiteral(id))
            );

            if (opts.emitMap) {
              recordMapping({ id, file: rel, element: name, label });
            }
          },
        });
      },
    },
  };
}
