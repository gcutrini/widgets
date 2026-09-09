#!/usr/bin/env node
/**
 * Copies this package's asset binaries (assets/ — the font files and static
 * CSS the generated vendor sheets reference through the __WIDGET_ASSETS__
 * placeholder) into a host-chosen directory. The host serves that directory
 * and says where in HostConfig.assetBaseUrl (empty base = site-root paths).
 *
 * Ships as the `widgets-assets` bin so the mechanism lives with the package
 * (which knows its own layout) and a host states only the destination:
 *
 *   widgets-assets --out public
 */
import { cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outIx = args.indexOf('--out');
const out = outIx !== -1 ? args[outIx + 1] : undefined;
if (!out) {
  console.error('[widgets-assets] usage: widgets-assets --out <dir>');
  process.exit(1);
}

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
if (!existsSync(src)) {
  console.error(`[widgets-assets] ${src} missing — broken install of @openeventkit/widgets`);
  process.exit(1);
}

const dest = resolve(out);
cpSync(src, dest, { recursive: true });
process.stdout.write(`[widgets-assets] assets -> ${dest}\n`);
