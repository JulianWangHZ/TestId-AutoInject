export interface AngularInjectOptions {
  /** Attribute to inject. Default `data-testid`. */
  attribute?: string;
  /** Element/component names to inject on. Ignored when `injectAll` is true. */
  targets?: string[];
  /** Inject on every element regardless of `targets`. Default false. */
  injectAll?: boolean;
  /** Leading path segments to drop when deriving the screen slug. */
  stripDirs?: string[];
  /** Keep a non-ASCII label verbatim when no English signal is found. Default true. */
  cjkFallback?: boolean;
}
