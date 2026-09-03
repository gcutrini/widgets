// @vitest-environment node
import { describe, it, expect } from 'vitest';
// The web-components build reads each widget manifest with a lightweight text
// scrape (readDeclaredNeeds in footprint.mjs) because its scripts are plain
// node — it cannot import the TS manifests. A manifest reformat could make
// that scrape silently misparse. This tripwire imports every manifest for
// real and asserts the scrape agrees with the live module.
import { readDeclaredNeeds } from '../packages/web-components/scripts/footprint.mjs';
import { WIDGETS } from '../packages/web-components/scripts/policy.mjs';

describe('web-components manifest scrape', () => {
  it.each(WIDGETS as string[])(
    '%s: scraped runtimeNeeds match the imported manifest',
    async (name) => {
      const scraped = await readDeclaredNeeds(name);
      const mod = await import(`@openeventkit/widgets/${name}/manifest`);
      expect(mod.manifest, `${name} manifest export`).toBeDefined();
      expect(typeof mod.manifest.load).toBe('function');
      expect(scraped.sort()).toEqual([...(mod.manifest.runtimeNeeds ?? [])].sort());
    },
  );
});
