import type {
  JSXOpeningElement,
  Expression,
  Node,
} from '@babel/types';
import { slugify } from './slugify';

/**
 * Mine an English intent slug from an element's event handlers.
 *
 * On non-Latin UIs (e.g. Chinese) the visible text carries no ASCII signal, but
 * developers almost always name their handlers, state setters, and call
 * arguments in English (`onClick={() => setDateType("today")}`,
 * `onClick={datePicker.open}`, `onClick={handleSubmit}`). That English *is* the
 * stable, human-meaningful signal — more reliable than the label — so we prefer
 * it over a Unicode fallback.
 *
 * Returns `null` when no handler yields a meaningful slug (so the caller can
 * fall through to the next signal). Position is never consulted here.
 */

/** Event handler props, in priority order, most likely to name the intent. */
const HANDLER_ATTRS = ['onClick', 'onPress', 'onChange', 'onSubmit', 'onValueChange'];

/**
 * Slugs too generic (or too short) to make a useful id. A single-letter handler
 * (`onClick={s}`) or a bare `handle`/`callback` name tells QA nothing, so we
 * reject it and let the caller fall back to the label text.
 */
const STOPWORDS = new Set([
  'fn',
  'cb',
  'callback',
  'handler',
  'handle',
  'on',
  'e',
  'ev',
  'evt',
  'event',
]);

/** Strip the conventional `handle`/`on` prefix: `handleSubmit` -> `Submit`. */
function stripHandlerPrefix(name: string): string {
  const stripped = name.replace(/^(handle|on)(?=[A-Z_])/, '').replace(/^_+/, '');
  return stripped || name;
}

/** Reject empty, single-letter, or stopword slugs. */
function meaningful(slug: string): string | null {
  if (!slug || slug.length < 2) return null;
  if (STOPWORDS.has(slug.replace(/-/g, ''))) return null;
  return slug;
}

/** Narrow to call-like nodes (`foo()` and `foo?.()`). */
function isCall(n: Node): n is Extract<Node, { type: 'CallExpression' | 'OptionalCallExpression' }> {
  return n.type === 'CallExpression' || n.type === 'OptionalCallExpression';
}

/**
 * Pull a slug out of a call: prefer a string-literal argument that names the
 * intent (`setDateType("today")` -> `today`), else the callee name
 * (`onDotButtonClick(i)` -> `dot-button-click`, `router.push()` -> `router`).
 */
function fromCall(call: Extract<Node, { type: 'CallExpression' | 'OptionalCallExpression' }>): string | null {
  for (const arg of call.arguments) {
    if (arg.type === 'StringLiteral' && /[a-zA-Z]/.test(arg.value)) {
      const s = meaningful(slugify(arg.value));
      if (s) return s;
    }
  }
  const callee = call.callee;
  if (callee.type === 'Identifier') {
    return meaningful(slugify(stripHandlerPrefix(callee.name)));
  }
  if (callee.type === 'MemberExpression') {
    if (callee.object.type === 'Identifier') {
      const s = meaningful(slugify(callee.object.name));
      if (s) return s;
    }
    if (callee.property.type === 'Identifier') {
      return meaningful(slugify(stripHandlerPrefix(callee.property.name)));
    }
  }
  return null;
}

/** Depth-first walk returning the slug of the first meaningful call in source order. */
function firstSignalInBody(root: Node): string | null {
  let result: string | null = null;
  const visit = (n: unknown): void => {
    if (result || !n || typeof n !== 'object') return;
    const node = n as Node;
    if (typeof node.type !== 'string') return;
    if (isCall(node)) {
      const s = fromCall(node);
      if (s) {
        result = s;
        return;
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (key === 'leadingComments' || key === 'trailingComments') continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          visit(c);
          if (result) return;
        }
      } else {
        visit(child);
      }
      if (result) return;
    }
  };
  visit(root);
  return result;
}

/** Extract a slug from a single handler expression. */
function fromExpression(expr: Expression): string | null {
  switch (expr.type) {
    case 'Identifier':
      return meaningful(slugify(stripHandlerPrefix(expr.name)));
    case 'MemberExpression': {
      // `datePicker.open` -> the receiver names the intent -> `date-picker`.
      if (expr.object.type === 'Identifier') {
        const s = meaningful(slugify(expr.object.name));
        if (s) return s;
      }
      if (expr.property.type === 'Identifier') {
        return meaningful(slugify(stripHandlerPrefix(expr.property.name)));
      }
      return null;
    }
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return firstSignalInBody(expr.body);
    default:
      return null;
  }
}

export function deriveHandlerSignal(open: JSXOpeningElement): string | null {
  for (const key of HANDLER_ATTRS) {
    for (const a of open.attributes) {
      if (a.type !== 'JSXAttribute') continue;
      if (a.name.type !== 'JSXIdentifier' || a.name.name !== key) continue;
      const v = a.value;
      if (!v || v.type !== 'JSXExpressionContainer') continue;
      const expr = v.expression;
      if (expr.type === 'JSXEmptyExpression') continue;
      const s = fromExpression(expr);
      if (s) return s;
    }
  }
  return null;
}
