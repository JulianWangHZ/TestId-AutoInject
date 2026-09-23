/**
 * JSX AST helpers for the ESLint rules, typed structurally against the
 * estree-jsx shapes we actually touch so we stay parser-agnostic without
 * pulling in a types dependency.
 */

interface JSXIdentifier {
  type: 'JSXIdentifier';
  name: string;
}

interface JSXNamespacedName {
  type: 'JSXNamespacedName';
  namespace: JSXIdentifier;
  name: JSXIdentifier;
}

interface JSXMemberExpression {
  type: 'JSXMemberExpression';
  object: JSXTagName;
  property: JSXIdentifier;
}

type JSXTagName = JSXIdentifier | JSXMemberExpression | JSXNamespacedName;

export interface JSXAttribute {
  type: 'JSXAttribute';
  name: JSXIdentifier | JSXNamespacedName;
}

interface JSXSpreadAttribute {
  type: 'JSXSpreadAttribute';
}

export interface JSXOpeningElement {
  type: 'JSXOpeningElement';
  name: JSXTagName;
  attributes: Array<JSXAttribute | JSXSpreadAttribute>;
}

/** `Radio.Group` for member expressions, `svg:path` for namespaced names. */
function tagNameToString(tag: JSXTagName): string {
  switch (tag.type) {
    case 'JSXIdentifier':
      return tag.name;
    case 'JSXNamespacedName':
      return `${tag.namespace.name}:${tag.name.name}`;
    case 'JSXMemberExpression':
      return `${tagNameToString(tag.object)}.${tag.property.name}`;
  }
}

export function getAttrName(attr: JSXAttribute): string {
  return attr.name.type === 'JSXIdentifier'
    ? attr.name.name
    : `${attr.name.namespace.name}:${attr.name.name.name}`;
}

export function getElementName(opening: JSXOpeningElement): string {
  return tagNameToString(opening.name);
}

export function hasSpread(opening: JSXOpeningElement): boolean {
  return opening.attributes.some((a) => a.type === 'JSXSpreadAttribute');
}
