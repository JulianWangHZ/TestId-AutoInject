import type { Rule } from 'eslint';
import { DEFAULT_TARGETS } from '../../id/targets';

type Schema = Exclude<Rule.RuleMetaData['schema'], false | undefined>;

/** Options every rule accepts: the attribute it checks plus rule-specific extras. */
export function testidOptionsSchema(extra: Record<string, object>): Schema {
  return [
    {
      type: 'object',
      properties: { attribute: { type: 'string' }, ...extra },
      additionalProperties: false,
    },
  ];
}

export const stringList = { type: 'array', items: { type: 'string' } } as const;

/**
 * Builds the "is this element one we care about?" check from a target list.
 * A name matches when the full tag (`Form.Field`) or its last segment
 * (`UI.Button` -> `Button`) is listed.
 */
export function targetMatcher(targets: readonly string[] = DEFAULT_TARGETS): (tag: string) => boolean {
  const wanted = new Set(targets);
  return (tag) => wanted.has(tag) || wanted.has(tag.slice(tag.lastIndexOf('.') + 1));
}
