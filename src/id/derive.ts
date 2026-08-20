import { slugify } from './slugify';
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
}

/**
 * Build the stable base id `{screen}-{name}-{type}`.
 *
 * `name` comes from a human label when available (so QA sees a meaningful id),
 * otherwise from the element name. `type` comes from the element-type map.
 * The result is deterministic and independent of sibling order — the whole
 * point, so hardcoded Appium/Playwright selectors survive refactors.
 */
export function deriveBaseId(input: IdInput): string {
  const type = elementNameToType(input.elementName);
  const labelSlug = input.label ? slugify(input.label) : '';
  const namePart = labelSlug || slugify(input.elementName.split('.').pop() ?? input.elementName);
  return [input.screen, namePart, type].filter(Boolean).join('-');
}
