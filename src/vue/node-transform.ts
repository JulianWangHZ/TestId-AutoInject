import path from 'node:path';
import type {
  AttributeNode,
  ElementNode,
  NodeTransform,
  RootNode,
} from '@vue/compiler-core';
import { deriveScreen, deriveBaseId } from '../id/derive';
import { mineSignalFromSource } from '../id/handler-signal';
import { configureMapOutput, recordMapping } from '../map/emit';
import { DEFAULT_TARGETS } from '../babel-plugin';

export interface VueInjectOptions {
  /** Attribute to inject. Default `data-testid`. */
  attribute?: string;
  /** Only run when process.env.NODE_ENV is one of these. Default test+development. */
  envs?: string[];
  /** Element/component names to inject on. Ignored when `injectAll` is true. */
  targets?: string[];
  /** Inject on every element regardless of `targets`. Default false. */
  injectAll?: boolean;
  /** Leading path segments to drop when deriving the screen slug. */
  stripDirs?: string[];
  /** Emit an id -> source map. Default false. */
  emitMap?: boolean;
  /** Where to write the map. Default `<cwd>/testid-map.json`. */
  mapFile?: string;
  /** Keep a non-ASCII label verbatim when no English signal is found. Default true. */
  cjkFallback?: boolean;
}

// @vue/compiler-core NodeTypes / ElementTypes values. Kept as literals so the
// transform never needs a runtime import of the compiler — the host build
// (Vite, vue-loader, Nuxt) owns the compiler instance.
const ELEMENT = 1;
const TEXT = 2;
const SIMPLE_EXPRESSION = 4;
const ATTRIBUTE = 6;
const DIRECTIVE = 7;
const TAG_SLOT = 2;
const TAG_TEMPLATE = 3;

/** Static attributes, in priority order, that carry a human-meaningful label. */
const LABEL_ATTRS = ['aria-label', 'placeholder', 'title', 'label', 'name'];

/** Template events, in priority order, most likely to name the intent. */
const HANDLER_EVENTS = ['click', 'change', 'submit', 'input'];

function kebabToPascal(tag: string): string {
  return tag.replace(/(?:^|-)([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function matchesTarget(tag: string, targets: Set<string>): boolean {
  return targets.has(tag) || targets.has(kebabToPascal(tag));
}

function hasTestAttr(el: ElementNode, attribute: string): boolean {
  return el.props.some((p) => {
    if (p.type === ATTRIBUTE) return p.name === attribute;
    if (p.type === DIRECTIVE && p.name === 'bind') {
      const arg = p.arg;
      return (
        !!arg &&
        arg.type === SIMPLE_EXPRESSION &&
        arg.isStatic &&
        arg.content === attribute
      );
    }
    return false;
  });
}

function findLabel(el: ElementNode): string | null {
  for (const key of LABEL_ATTRS) {
    for (const p of el.props) {
      if (p.type === ATTRIBUTE && p.name === key && p.value?.content.trim()) {
        return p.value.content.trim();
      }
    }
  }
  for (const c of el.children) {
    if (c.type === TEXT && c.content.trim()) return c.content.trim();
  }
  return null;
}

function findHandlerSignal(el: ElementNode): string | null {
  for (const event of HANDLER_EVENTS) {
    for (const p of el.props) {
      if (p.type !== DIRECTIVE || p.name !== 'on') continue;
      const arg = p.arg;
      if (
        !arg ||
        arg.type !== SIMPLE_EXPRESSION ||
        !arg.isStatic ||
        arg.content !== event
      ) {
        continue;
      }
      const exp = p.exp;
      if (exp && exp.type === SIMPLE_EXPRESSION && exp.content) {
        const s = mineSignalFromSource(exp.content);
        if (s) return s;
      }
    }
  }
  return null;
}

/**
 * Vue template compiler transform: inject a stable `data-testid` onto
 * interactive elements at compile time, so `.vue` sources stay untouched and
 * QA automation gets deterministic selectors.
 *
 * Ids are `{screen}-{label|element}-{type}`, independent of sibling order —
 * identical semantics to the Babel/SWC pipelines. Wire it through the host
 * build's `compilerOptions.nodeTransforms` (Vite, vue-loader, Nuxt).
 */
export function vueTestId(options: VueInjectOptions = {}): NodeTransform {
  const envs = options.envs ?? ['test', 'development'];
  const enabled = envs.includes(process.env.NODE_ENV ?? '');
  const attribute = options.attribute ?? 'data-testid';
  const targets = options.injectAll
    ? null
    : new Set(options.targets ?? DEFAULT_TARGETS);
  const counts = new WeakMap<RootNode, Map<string, number>>();

  if (enabled && options.emitMap) {
    configureMapOutput(
      options.mapFile ?? path.join(process.cwd(), 'testid-map.json')
    );
  }

  return (node, context) => {
    if (!enabled || node.type !== ELEMENT) return;
    const el = node as ElementNode;
    if (el.tagType === TAG_SLOT || el.tagType === TAG_TEMPLATE) return;
    if (hasTestAttr(el, attribute)) return;
    if (targets && !matchesTarget(el.tag, targets)) return;

    const filename = context.filename || 'unknown';
    const rel = path.isAbsolute(filename)
      ? path.relative(process.cwd(), filename)
      : filename;
    const screen = deriveScreen(rel, options.stripDirs);

    // Components written kebab-case still deserve their PascalCase type
    // mapping (`van-button` -> `VanButton` -> `button`).
    const elementName = el.tag.includes('-') ? kebabToPascal(el.tag) : el.tag;
    const base = deriveBaseId({
      screen,
      elementName,
      label: findLabel(el),
      handlerSignal: findHandlerSignal(el),
      cjkFallback: options.cjkFallback,
    });

    let fileCounts = counts.get(context.root);
    if (!fileCounts) {
      fileCounts = new Map();
      counts.set(context.root, fileCounts);
    }
    const seen = fileCounts.get(base) ?? 0;
    fileCounts.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;

    // Insert at the front, not the back: later props win when the compiler
    // merges, so an injected value placed after a `v-bind="obj"` spread would
    // silently override a testid the caller passed through that spread.
    // Placing it first lets any explicit or spread value override it —
    // hand-written values win in every case.
    const loc = el.loc;
    el.props.unshift({
      type: ATTRIBUTE,
      name: attribute,
      nameLoc: loc,
      value: { type: TEXT, content: id, loc },
      loc,
    } as unknown as AttributeNode);

    if (options.emitMap) {
      recordMapping({ id, file: rel, element: el.tag, label: findLabel(el) });
    }
  };
}
