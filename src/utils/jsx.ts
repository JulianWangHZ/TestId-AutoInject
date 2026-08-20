/**
 * ESTree/JSX helpers for the ESLint rules. Kept dependency-light and typed as
 * `any` at the node level because the estree-jsx node shapes are provided by
 * the parser at lint time rather than a compile-time type.
 */

export function getAttrName(attrNode: any): string | null {
  if (!attrNode || attrNode.type !== 'JSXAttribute') return null;
  const name = attrNode.name;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXNamespacedName') {
    return `${name.namespace.name}:${name.name.name}`;
  }
  return null;
}

export function getElementName(openingNode: any): string | null {
  if (!openingNode || openingNode.type !== 'JSXOpeningElement') return null;
  const name = openingNode.name;
  if (name.type === 'JSXIdentifier') return name.name;

  if (name.type === 'JSXMemberExpression') {
    const parts: string[] = [];
    let cur: any = name;
    while (cur && cur.type === 'JSXMemberExpression') {
      parts.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur && cur.type === 'JSXIdentifier') parts.unshift(cur.name);
    return parts.join('.');
  }

  if (name.type === 'JSXNamespacedName') {
    return `${name.namespace.name}:${name.name.name}`;
  }
  return null;
}

export function hasSpread(openingNode: any): boolean {
  return (openingNode?.attributes ?? []).some(
    (a: any) => a.type === 'JSXSpreadAttribute'
  );
}

export function findAttr(openingNode: any, attributeName: string): any | null {
  for (const a of openingNode?.attributes ?? []) {
    if (a.type !== 'JSXAttribute') continue;
    if (getAttrName(a) === attributeName) return a;
  }
  return null;
}
