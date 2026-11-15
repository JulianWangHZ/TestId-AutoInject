import type * as Ng from '@angular/compiler';
import { deriveBaseId } from '../id/derive';
import { mineSignalFromSource } from '../id/handler-signal';
import { DEFAULT_TARGETS } from '../id/targets';
import { matchesTarget, templateElementName } from '../utils/tag-name';
import { applyEdits, type Edit } from './edits';
import type { AngularInjectOptions } from './options';
import { angularScreen } from './screen';

/** Static attributes, in priority order, that carry a human-meaningful label. */
const LABEL_ATTRS = ['aria-label', 'placeholder', 'title', 'label', 'name'];

/** Template events, in priority order, most likely to name the intent. */
const HANDLER_EVENTS = ['click', 'change', 'submit', 'input', 'ngSubmit', 'ngModelChange'];

/** Angular structural tags that render no DOM element of their own. */
const VIRTUAL_TAGS = new Set(['ng-container', 'ng-content', 'ng-template']);

export interface TemplateContext {
  readonly screen: string;
  readonly options: AngularInjectOptions;
  /** Per-file base id counts, shared across every template in one file. */
  readonly counts: Map<string, number>;
  /** Quote for the injected value; `'` when the template sits in a `"` string. */
  readonly quote: '"' | "'";
}

let compiler: typeof Ng | null = null;

// Loaded lazily: only Angular projects have it, and it is ESM-only
// (`require(esm)` needs Node 20.19+ / 22.12+, which Angular itself requires).
function loadCompiler(): typeof Ng {
  compiler ??= require('@angular/compiler') as typeof Ng;
  return compiler;
}

function hasTestAttr(el: Ng.TmplAstElement, attribute: string): boolean {
  return (
    el.attributes.some((a) => a.name === attribute) ||
    el.inputs.some((i) => i.name === attribute)
  );
}

function findLabel(el: Ng.TmplAstElement, ng: typeof Ng): string | null {
  for (const key of LABEL_ATTRS) {
    const value = el.attributes.find((a) => a.name === key)?.value.trim();
    if (value) return value;
  }
  for (const child of el.children) {
    if (child instanceof ng.TmplAstText && child.value.trim()) return child.value.trim();
  }
  return null;
}

function findHandlerSignal(el: Ng.TmplAstElement): string | null {
  for (const event of HANDLER_EVENTS) {
    for (const out of el.outputs) {
      if (out.name !== event) continue;
      const signal = mineSignalFromSource(out.handlerSpan.toString());
      if (signal) return signal;
    }
  }
  return null;
}

/** Offset right after the tag name in `<tag ...>`, or null if the span is off. */
function tagNameEnd(source: string, el: Ng.TmplAstElement): number | null {
  const start = el.startSourceSpan.start.offset;
  if (source[start] !== '<') return null;
  let i = start + 1;
  while (i < source.length && !/[\s/>]/.test(source[i])) i++;
  return i;
}

function nextId(base: string, counts: Map<string, number>): string {
  const seen = counts.get(base) ?? 0;
  counts.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function quoteValue(value: string, quote: '"' | "'"): string {
  const escaped = value.replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&#39;');
  return `${quote}${escaped}${quote}`;
}

/**
 * Collect `data-testid` insertions for one Angular template. Returns no edits
 * when the template does not parse — Angular reports that error itself.
 */
export function collectTemplateEdits(template: string, ctx: TemplateContext): Edit[] {
  const ng = loadCompiler();
  const parsed = ng.parseTemplate(template, 'template.html', {});
  if (parsed.errors?.length) return [];

  const attribute = ctx.options.attribute ?? 'data-testid';
  const targets = ctx.options.injectAll
    ? null
    : new Set(ctx.options.targets ?? DEFAULT_TARGETS);
  const edits: Edit[] = [];

  const visit = (el: Ng.TmplAstElement): void => {
    if (el.name.startsWith(':') || VIRTUAL_TAGS.has(el.name)) return;
    if (hasTestAttr(el, attribute)) return;
    if (targets && !matchesTarget(el.name, targets)) return;
    const offset = tagNameEnd(template, el);
    if (offset === null) return;

    const base = deriveBaseId({
      screen: ctx.screen,
      elementName: templateElementName(el.name),
      label: findLabel(el, ng),
      handlerSignal: findHandlerSignal(el),
      cjkFallback: ctx.options.cjkFallback,
    });
    const id = nextId(base, ctx.counts);
    edits.push({ offset, text: ` ${attribute}=${quoteValue(id, ctx.quote)}` });
  };

  class Visitor extends ng.TmplAstRecursiveVisitor {
    override visitElement(el: Ng.TmplAstElement): void {
      visit(el);
      super.visitElement(el);
    }
  }
  ng.tmplAstVisitAll(new Visitor(), parsed.nodes);
  return edits;
}

/**
 * Inject stable ids into an Angular template file (`templateUrl` target).
 * Ids are `{screen}-{label|element}-{type}`, independent of sibling order —
 * the same derivation as the Babel, SWC and Vue engines.
 */
export function injectAngularTemplate(
  source: string,
  file: string,
  options: AngularInjectOptions = {}
): string {
  const edits = collectTemplateEdits(source, {
    screen: angularScreen(file, options.stripDirs),
    options,
    counts: new Map(),
    quote: '"',
  });
  return applyEdits(source, edits);
}
