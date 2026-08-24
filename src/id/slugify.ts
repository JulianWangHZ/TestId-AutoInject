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

/**
 * Like {@link slugify} but preserves Unicode letters and digits (CJK, accented
 * scripts, …) instead of stripping them to ASCII.
 *
 * Used only as a readable *fallback*: when a label carries no English signal, a
 * Chinese-only button ("登入") yields a stable, meaningful `login-登入-button`
 * instead of degrading to a positional `login-button-2`. `data-testid`,
 * Appium accessibility ids, and Playwright locators all accept Unicode.
 */
export function slugifyUnicode(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
