import fs from 'node:fs';
import path from 'node:path';
import { installAngularHook } from './hook';
import type { AngularInjectOptions } from './options';

/** Optional project config, read from the working directory. */
export const CONFIG_FILE = 'testid-autoinject.json';

function loadOptions(root: string): AngularInjectOptions {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) return {};
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`testid-autoinject: ${CONFIG_FILE} must contain a JSON object`);
  }
  return parsed as AngularInjectOptions;
}

// Preload entry: `NODE_OPTIONS="--require testid-autoinject/angular/register" ng serve`.
// Node applies `--require` to worker threads too, where Angular compiles.
installAngularHook(loadOptions(process.cwd()));
