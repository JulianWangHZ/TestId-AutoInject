import type * as TS from 'typescript';
import { applyEdits, type Edit } from './edits';
import type { AngularInjectOptions } from './options';
import { angularScreen } from './screen';
import { collectTemplateEdits } from './template';

let typescript: typeof TS | null = null;

function loadTypeScript(): typeof TS {
  typescript ??= require('typescript') as typeof TS;
  return typescript;
}

/** `template:` initializers of every `@Component({...})` in the file. */
function findInlineTemplates(ts: typeof TS, sf: TS.SourceFile): TS.StringLiteralLike[] {
  const found: TS.StringLiteralLike[] = [];
  const visit = (node: TS.Node): void => {
    if (
      ts.isDecorator(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Component'
    ) {
      const arg = node.expression.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'template' &&
            ts.isStringLiteralLike(prop.initializer)
          ) {
            found.push(prop.initializer);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * Inject stable ids into inline `@Component({ template })` strings in a
 * TypeScript source. Templates with `${}` substitutions are left alone.
 */
export function injectInlineTemplates(
  source: string,
  file: string,
  options: AngularInjectOptions = {}
): string {
  if (!source.includes('@Component')) return source;
  const ts = loadTypeScript();
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const ctx = {
    screen: angularScreen(file, options.stripDirs),
    options,
    counts: new Map<string, number>(),
  };

  const edits: Edit[] = findInlineTemplates(ts, sf).flatMap((lit) => {
    const start = lit.getStart(sf) + 1;
    const raw = source.slice(start, lit.getEnd() - 1);
    const quote = source[start - 1] === '"' ? "'" : '"';
    return collectTemplateEdits(raw, { ...ctx, quote }).map((e) => ({
      offset: e.offset + start,
      text: e.text,
    }));
  });
  return applyEdits(source, edits);
}
