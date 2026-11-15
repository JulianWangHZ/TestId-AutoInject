import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  injectAngularTemplate,
  injectInlineTemplates,
  angularScreenPath,
} from '../src/angular';
import type { AngularInjectOptions } from '../src/angular';

const FILE = 'src/app/login/login.component.html';

function inject(template: string, options: AngularInjectOptions = {}, file = FILE): string {
  return injectAngularTemplate(template, file, options);
}

test('angular: button with English text gets {screen}-{label}-{type}', () => {
  const out = inject(`<button (click)="doThing()">Save</button>`);
  assert.equal(out, `<button data-testid="login-save-button" (click)="doThing()">Save</button>`);
});

test('angular: CJK text falls back to handler signal', () => {
  const out = inject(`<button (click)="handleSubmit()">送出</button>`);
  assert.ok(out.includes('data-testid="login-submit-button"'), out);
});

test('angular: CJK text with no handler keeps the label verbatim', () => {
  assert.ok(inject(`<button>送出</button>`).includes('login-送出-button'));
});

test('angular: handler string argument names the intent', () => {
  const out = inject(`<button (click)="setDateType('today')">今天</button>`);
  assert.ok(out.includes('login-today-button'), out);
});

test('angular: label attribute beats text', () => {
  const out = inject(`<input placeholder="Email" />`);
  assert.ok(out.includes('login-email-input'), out);
});

test('angular: existing static data-testid wins', () => {
  const src = `<button data-testid="custom">Save</button>`;
  assert.equal(inject(src), src);
});

test('angular: existing [attr.data-testid] binding wins', () => {
  const src = `<button [attr.data-testid]="id">Save</button>`;
  assert.equal(inject(src), src);
});

test('angular: re-running is a no-op', () => {
  const once = inject(`<button>Save</button>`);
  assert.equal(inject(once), once);
});

test('angular: non-target elements are skipped by default', () => {
  const src = `<div (click)="open()">x</div>`;
  assert.equal(inject(src), src);
});

test('angular: injectAll covers non-target elements but not ng-container', () => {
  const out = inject(`<ng-container><div (click)="openMenu()"></div></ng-container>`, {
    injectAll: true,
  });
  assert.ok(out.includes('<div data-testid="login-open-menu-div"'), out);
  assert.ok(out.startsWith('<ng-container>'), out);
});

test('angular: elements inside control flow and structural directives are reached', () => {
  const out = inject(
    `@if (ok) { <button>Save</button> } @for (x of xs; track x) { <a href="/">Home</a> }` +
      `<button *ngIf="y">Cancel</button>`
  );
  assert.ok(out.includes('login-save-button'), out);
  assert.ok(out.includes('login-home-link'), out);
  assert.ok(out.includes('<button data-testid="login-cancel-button" *ngIf="y">'), out);
});

test('angular: duplicate base ids get a stable numeric suffix', () => {
  const out = inject(`<button>Save</button><button>Save</button>`);
  assert.ok(out.includes('"login-save-button"'), out);
  assert.ok(out.includes('"login-save-button-2"'), out);
});

test('angular: kebab-case component maps through PascalCase targets', () => {
  const out = inject(`<app-button>Buy</app-button>`, { targets: ['AppButton'] });
  assert.ok(out.includes('<app-button data-testid="login-buy-button">'), out);
});

test('angular: custom attribute name', () => {
  const out = inject(`<button>Save</button>`, { attribute: 'data-qa' });
  assert.ok(out.includes('data-qa="login-save-button"'), out);
});

test('angular: template with parse errors is returned unchanged', () => {
  const src = `<button>Save</div>`;
  assert.equal(inject(src), src);
});

test('angular: screen path collapses folder/file.component pairs', () => {
  assert.equal(angularScreenPath('src/app/login/login.component.html'), 'src/app/login.html');
  assert.equal(angularScreenPath('src/app/login/login.html'), 'src/app/login.html');
  assert.equal(angularScreenPath('src/app/shared/nav-bar.component.ts'), 'src/app/shared/nav-bar.ts');
});

test('angular inline: template literal in @Component is rewritten', () => {
  const src = [
    `@Component({`,
    `  selector: 'app-login',`,
    '  template: `<button (click)="submit()">Go</button>`,',
    `})`,
    `export class LoginComponent {}`,
  ].join('\n');
  const out = injectInlineTemplates(src, 'src/app/login/login.component.ts');
  assert.ok(out.includes('<button data-testid="login-go-button" (click)'), out);
  assert.ok(out.includes('export class LoginComponent {}'), out);
});

test('angular inline: double-quoted string literal gets single-quoted attribute', () => {
  const src = `@Component({ template: "<button>Go</button>" }) class A {}`;
  const out = injectInlineTemplates(src, 'src/app/login/login.component.ts');
  assert.ok(out.includes(`"<button data-testid='login-go-button'>Go</button>"`), out);
});

test('angular inline: files without @Component are returned as-is', () => {
  const src = `const template = '<button>Go</button>';`;
  assert.equal(injectInlineTemplates(src, 'src/app/x.ts'), src);
});
