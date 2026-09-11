#!/usr/bin/env node
/**
 * Pre-bundle Cloudflare Pages Functions with esbuild.
 *
 * Pages Functions must be self-contained JS modules (no external imports).
 * wrangler's built-in bundler can't resolve npm packages when functions
 * import cross-directory into src/, so we bundle here first and deploy
 * with `wrangler pages deploy --no-bundle`.
 *
 * Environment variables referenced as process.env.NAME inside the functions
 * are baked into the bundle as literals (server-side only, never served to
 * the browser). This makes the deployed Functions independent of Cloudflare
 * env injection. Provide them via the BUILD_BAKE_ENV env var: a
 * comma-separated list like "SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY".
 *
 * Usage:  node scripts/build-functions.js
 * Input:  functions/api/*.ts
 * Output: functions/api/*.mjs (bundled), original .ts files removed
 */

import { readdirSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { build } from 'esbuild';

const FUNCTIONS_DIR = join(import.meta.dirname, '..', 'functions', 'api');

// Env vars to bake into the bundle (if present). Configured via BUILD_BAKE_ENV
// in CI so secrets/vars from GitHub flow straight into the server bundle.
const bakeKeys = (process.env.BUILD_BAKE_ENV || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const define = {};
const baked = [];
const missing = [];
for (const key of bakeKeys) {
  const value = process.env[key];
  if (value) {
    define[`process.env.${key}`] = JSON.stringify(value);
    baked.push(key);
  } else {
    missing.push(key);
  }
}
if (baked.length > 0) {
  console.log(`Baking env vars into function bundle: ${baked.join(', ')}`);
} else {
  console.log('No env vars baked into function bundle (BUILD_BAKE_ENV empty).');
}
if (missing.length > 0) {
  console.warn(`WARNING: these requested env vars had no value in this job and were NOT baked: ${missing.join(', ')}`);
}

const tsFiles = readdirSync(FUNCTIONS_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(FUNCTIONS_DIR, f));

if (tsFiles.length === 0) {
  console.log('No function .ts files found – nothing to bundle.');
  process.exit(0);
}

console.log(`Bundling ${tsFiles.length} Pages Function(s)…`);

await Promise.all(
  tsFiles.map(async (entryPoint) => {
    const outName = basename(entryPoint).replace(/\.ts$/, '.mjs');
    const outPath = join(FUNCTIONS_DIR, outName);

    const banner = `
// Polyfill process.env for Cloudflare Workers (env is injected per-request via context.env)
if (typeof globalThis.process === 'undefined') {
  Object.defineProperty(globalThis, 'process', {
    value: { env: {} },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}
globalThis.process.env = globalThis.process.env || {};
`;

    await build({
      entryPoints: [entryPoint],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      mainFields: ['module', 'main'],
      banner: { js: banner },
      define,
      outfile: outPath,
      logLevel: 'info',
      // Keep all imports inside the bundle (no externals)
    });

    // Remove the original .ts source so wrangler --no-bundle won't touch it
    unlinkSync(entryPoint);
  }),
);

console.log('Functions bundled successfully.');
