import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkName, entrySource, importMapFor } from '../runtime-entries.mjs';

test('chunkName flattens bare specifiers to filenames', () => {
  assert.equal(chunkName('react'), 'react');
  assert.equal(chunkName('react-dom'), 'react-dom');
  assert.equal(chunkName('react/jsx-runtime'), 'react-jsx-runtime');
  assert.equal(chunkName('@mui/material/Box'), 'mui-material-Box');
  assert.equal(chunkName('@emotion/cache'), 'emotion-cache');
  assert.equal(
    chunkName('openstack-uicore-foundation/lib/utils/config'),
    'openstack-uicore-foundation-lib-utils-config',
  );
});

test('entrySource: pure side-effect module imports and exports nothing', () => {
  const src = entrySource('a-seed', 'a-seed', { named: [], hasDefault: false, isEsm: true });
  assert.equal(src, 'import "a-seed";\nexport {};\n');
});

test('entrySource: default + named re-exports through __pick', () => {
  const src = entrySource('lib', 'lib', { named: ['alpha', 'beta'], hasDefault: true, isEsm: false });
  assert.match(src, /import \* as __ns from "lib";/);
  assert.match(src, /const __m = __ns\.default !== undefined \? __ns\.default : __ns;/);
  assert.match(src, /export const alpha = __pick\("alpha"\);/);
  assert.match(src, /export const beta = __pick\("beta"\);/);
  assert.match(src, /export default __m;/);
});

test('entrySource: imports the override specifier, not the served slot', () => {
  const src = entrySource('served-slot', 'compat-module', { named: [], hasDefault: true, isEsm: true });
  assert.match(src, /import \* as __ns from "compat-module";/);
  assert.doesNotMatch(src, /served-slot/);
});

test('entrySource: react entry back-fills useSyncExternalStore and useId without mutating the shape', () => {
  const shape = { named: ['useState'], hasDefault: true, isEsm: false };
  const src = entrySource('react', 'react', shape);
  assert.match(src, /use-sync-external-store\/shim/);
  assert.match(src, /export const useSyncExternalStore = __pick\("useSyncExternalStore"\);/);
  assert.match(src, /if \(!__m\.useId\) __m\.useId = __useId;/);
  assert.match(src, /export const useId = __pick\("useId"\);/);
  assert.deepEqual(shape.named, ['useState']);
});

test('importMapFor maps specifiers to prefixed chunk URLs in input order', () => {
  const map = importMapFor(['react', '@mui/material/Box'], '/web-components/runtime/');
  assert.deepEqual(map, {
    imports: {
      react: '/web-components/runtime/react.js',
      '@mui/material/Box': '/web-components/runtime/mui-material-Box.js',
    },
  });
  assert.deepEqual(Object.keys(map.imports), ['react', '@mui/material/Box']);
});

test('importMapFor throws on a chunk-name collision instead of overwriting', () => {
  assert.throws(
    () => importMapFor(['@a/b-c', '@a/b/c'], '/r/'),
    /chunk name collision/,
  );
});
