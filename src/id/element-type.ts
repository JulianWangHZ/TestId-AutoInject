import { slugify } from './slugify';

/**
 * Map a JSX element name to a short, whitelisted "type" segment used as the
 * last part of a generated id: `{screen}-{element}-{type}`.
 *
 * Covers React Native primitives and common HTML host elements. Unknown names
 * fall back to heuristics (suffix rules) and finally to a slug of the name.
 */
const TYPE_MAP: Record<string, string> = {
  // React Native — touchables / buttons
  Button: 'button',
  Pressable: 'button',
  TouchableOpacity: 'button',
  TouchableHighlight: 'button',
  TouchableWithoutFeedback: 'button',
  // React Native — inputs
  TextInput: 'input',
  Input: 'input',
  // selects / toggles
  Select: 'select',
  Switch: 'switch',
  Checkbox: 'checkbox',
  Radio: 'radio',
  // text / containers
  Text: 'text',
  Image: 'image',
  // HTML host elements
  button: 'button',
  a: 'link',
  input: 'input',
  textarea: 'input',
  select: 'select',
  form: 'form',
  img: 'image',
  label: 'label',
};

const SUFFIX_RULES: Array<[RegExp, string]> = [
  [/Button$/, 'button'],
  [/Input$/, 'input'],
  [/Field$/, 'field'],
  [/Select$/, 'select'],
  [/Checkbox$/, 'checkbox'],
  [/Switch$/, 'switch'],
  [/Link$/, 'link'],
];

export function elementNameToType(elementName: string): string {
  const segments = elementName.split('.');
  // For dotted components (`Radio.Root`) the family segment carries the meaning,
  // so check every segment against the map, left to right, before falling back.
  for (const seg of segments) {
    if (TYPE_MAP[seg]) return TYPE_MAP[seg];
  }
  const last = segments[segments.length - 1] ?? elementName;
  for (const [re, type] of SUFFIX_RULES) {
    if (re.test(last)) return type;
  }
  return slugify(last) || 'element';
}
