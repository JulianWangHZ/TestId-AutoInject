/**
 * Elements that get an id by default, grouped by the kind of control they are.
 *
 * Shared by the Babel injector, the Vue transform and the lint rules. The SWC
 * engines (`packages/swc-plugin*`) keep a Rust copy that must list the same
 * names — the CI id cross-check fails if they drift.
 */
const INTERACTIVE_ELEMENTS: Record<string, readonly string[]> = {
  press: ['button', 'Button', 'Pressable', 'TouchableHighlight', 'TouchableOpacity', 'TouchableWithoutFeedback'],
  text: ['input', 'Input', 'TextInput', 'textarea'],
  choice: ['select', 'Select'],
  toggle: ['Checkbox', 'Radio', 'Switch'],
  link: ['a'],
};

export const DEFAULT_TARGETS: string[] = Object.values(INTERACTIVE_ELEMENTS).flat();
