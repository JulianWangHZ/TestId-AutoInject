import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installAngularHook } from '../src/angular';

function withProject(files: Record<string, string>, run: (root: string) => void): void {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'testid-ng-')));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  const uninstall = installAngularHook({}, root);
  try {
    run(root);
  } finally {
    uninstall();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('hook: templateUrl file read as string is rewritten', () => {
  withProject({ 'src/app/login/login.component.html': '<button>Save</button>' }, (root) => {
    const out = fs.readFileSync(path.join(root, 'src/app/login/login.component.html'), 'utf8');
    assert.equal(out, '<button data-testid="login-save-button">Save</button>');
  });
});

test('hook: Buffer reads (ts.sys.readFile) stay Buffers', () => {
  withProject({ 'src/app/login/login.component.html': '<button>Save</button>' }, (root) => {
    const out = fs.readFileSync(path.join(root, 'src/app/login/login.component.html'));
    assert.ok(Buffer.isBuffer(out));
    assert.ok(out.toString('utf8').includes('login-save-button'));
  });
});

test('hook: inline @Component template in .ts is rewritten', () => {
  const src = "@Component({ template: `<button>Go</button>` }) export class A {}";
  withProject({ 'src/app/home/home.component.ts': src }, (root) => {
    const out = fs.readFileSync(path.join(root, 'src/app/home/home.component.ts'), 'utf8');
    assert.ok(out.includes('data-testid="home-go-button"'), out);
  });
});

test('hook: index.html, node_modules and files outside root are untouched', () => {
  const page = '<!doctype html><html><body><button>Save</button></body></html>';
  withProject(
    { 'src/index.html': page, 'node_modules/lib/x.html': '<button>Save</button>' },
    (root) => {
      assert.equal(fs.readFileSync(path.join(root, 'src/index.html'), 'utf8'), page);
      assert.equal(
        fs.readFileSync(path.join(root, 'node_modules/lib/x.html'), 'utf8'),
        '<button>Save</button>'
      );
    }
  );
});

test('hook: uninstall restores the original readFileSync', () => {
  const before = fs.readFileSync;
  withProject({}, () => assert.notEqual(fs.readFileSync, before));
  assert.equal(fs.readFileSync, before);
});
