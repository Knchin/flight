#!/usr/bin/env node
/**
 * Pre-bundle Cloudflare Pages Functions with esbuild.
 *
 * Pages Functions must be self-contained JS modules (no external imports).
 * wrangler's built-in bundler can't resolve npm packages when functions
 * import cross-directory into src/, so we bundle here first and deploy
 * with `wrangler pages deploy --no-bundle`.
 *
 * Usage:  node scripts/build-functions.js
 * Input:  functions/api/*.ts
 * Output: functions/api/*.mjs (bundled), original .ts files removed
 */

import { readdirSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { build } from 'esbuild';

const FUNCTIONS_DIR = join(import.meta.dirname, '..', 'functions', 'api');

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

    await build({
      entryPoints: [entryPoint],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      mainFields: ['module', 'main'],
      outfile: outPath,
      logLevel: 'info',
      // Keep all imports inside the bundle (no externals)
    });

    // Remove the original .ts source so wrangler --no-bundle won't touch it
    unlinkSync(entryPoint);
  }),
);

console.log('Functions bundled successfully.');
