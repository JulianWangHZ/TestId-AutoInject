import { slugify, slugifyUnicode } from './slugify';
import { elementNameToType } from './element-type';

/**
 * Derive the "screen" segment from a file path relative to the project root.
 *
 * Stability: depends only on the file location, never on element order. Leading
 * framework directories are stripped and a trailing `index` is dropped so
 * `app/login/index.tsx` -> `login` and `src/screens/EventDetail.tsx` -> `event-detail`.
 */
export function deriveScreen(
  relativePath: string,
  stripDirs: string[] = ['src', 'app', 'screens', 'components', 'pages']
): string {
  const noExt = relativePath.replace(/\.[^/.]+$/, '');
  const parts = noExt.split(/[/\\]/).filter(Boolean);
  while (parts.length > 1 && stripDirs.includes(parts[0])) parts.shift();
  // Drop conventional filename segments that carry no screen meaning
  // (`index`, plus Next.js app-router `page` / `layout` / `route`).
  if (parts.length > 1 && /^(index|page|layout|route)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.map(slugify).filter(Boolean).join('-') || 'screen';
}

export interface IdInput {
  /** Slug derived from the file path, e.g. `login`. */
  screen: string;
  /** JSX element name, e.g. `Pressable` or `TextInput` or `Radio.Root`. */
  elementName: string;
  /** Best human label found on the element (accessibilityLabel, text, etc). */
  label?: string | null;
  /** English intent mined from an event handler (`onClick`, `onChange`, …). */
  handlerSignal?: string | null;
  /**
   * Keep a non-ASCII label (CJK, …) as a readable fallback instead of dropping
   * it. Default `true`; set `false` to reproduce the ASCII-only behaviour.
   */
  cjkFallback?: boolean;
}

/**
 * Build the stable base id `{screen}-{name}-{type}`.
 *
 * `name` is chosen from the first signal that yields something meaningful, in
 * priority order:
 *   1. English label attribute / text — what the user sees, when it's ASCII.
 *   2. English handler intent — reliable on non-Latin UIs where the visible
 *      text is CJK but `onClick`/`onChange` names are English.
 *   3. Non-ASCII label preserved verbatim (readable, still stable).
 *   4. The element name.
 *
 * `type` comes from the element-type map. The result is deterministic and
 * independent of sibling order — the whole point, so hardcoded
 * Appium/Playwright selectors survive refactors.
 */
export function deriveBaseId(input: IdInput): string {
  const type = elementNameToType(input.elementName);
  const asciiLabel = input.label ? slugify(input.label) : '';
  const handler = input.handlerSignal ? slugify(input.handlerSignal) : '';
  const cjkLabel =
    input.cjkFallback !== false && input.label ? slugifyUnicode(input.label) : '';
  const elementSlug = slugify(input.elementName.split('.').pop() ?? input.elementName);
  const namePart = asciiLabel || handler || cjkLabel || elementSlug;
  return [input.screen, namePart, type].filter(Boolean).join('-');
}
