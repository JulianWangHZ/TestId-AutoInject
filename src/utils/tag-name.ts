/** `van-button` -> `VanButton`, so kebab-case tags share the PascalCase type rules. */
export function kebabToPascal(tag: string): string {
  return tag.replace(/(?:^|-)([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Element name to feed `deriveBaseId`: kebab-case tags become PascalCase. */
export function templateElementName(tag: string): string {
  return tag.includes('-') ? kebabToPascal(tag) : tag;
}

export function matchesTarget(tag: string, targets: ReadonlySet<string>): boolean {
  return targets.has(tag) || targets.has(kebabToPascal(tag));
}
