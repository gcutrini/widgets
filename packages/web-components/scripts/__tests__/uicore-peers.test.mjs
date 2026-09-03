import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(dir, '../..');
const require = createRequire(import.meta.url);

// uicore peers this package deliberately does NOT declare, with the reason.
// Everything else must be declared here: outside the app monorepo there is no
// root install to anchor pnpm's peer materialization, and an auto-installed
// peer can resolve to an incompatible copy (found in the extraction rehearsal).
const EXCLUDED = new Map([
  // (none today)
]);

test('every uicore peerDependency is declared by this package (or excluded with a reason)', () => {
  const uicorePkg = require('openstack-uicore-foundation/package.json');
  const wc = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
  const declared = { ...wc.dependencies, ...wc.devDependencies };
  const missing = Object.keys(uicorePkg.peerDependencies ?? {}).filter(
    (name) => !declared[name] && !EXCLUDED.has(name),
  );
  assert.deepEqual(missing, [], `undeclared uicore peers: ${missing.join(', ')}`);
});
