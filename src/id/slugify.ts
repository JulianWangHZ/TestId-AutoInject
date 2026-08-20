/**
 * Turn arbitrary text into a stable, lowercase, dash-separated slug.
 * camelCase and PascalCase boundaries become dashes so `submitButton` -> `submit-button`.
 */
export function slugify(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
