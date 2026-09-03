#!/usr/bin/env node
/**
 * Generates the widget vendor-CSS modules and copies the binary assets
 * they reference.
 *
 * Vendor stylesheets are emitted as TypeScript modules under this
 * package's `src/lib/vendor-css/` (`export const sheet = { id, css,
 * fontFaces }`). Widget shadow roots adopt the `css` text via
 * constructable stylesheets and the toolkit injects `fontFaces` into
 * `document.head` once (adopted sheets silently ignore `@font-face`).
 * Compared to a host serving CSS copies as static files:
 *
 *   1. imports are type-checked — a wrong sheet name fails the build
 *      instead of 404ing silently at runtime
 *   2. the CSS ships inside the widget chunks — fingerprinted, cached,
 *      deduped by normal chunk splitting, and version bumps flow from
 *      node_modules on the next generation instead of drifting
 *   3. a host serves no generated CSS — only the font/image binaries
 *      in `assets/`
 *
 * Relative `url()` references are rewritten by resolving them exactly as
 * the browser did when these files were served from
 * `/widget-css/<name>.css` — so `../fonts/x` → `fonts/x` and `./fonts/x`
 * → `widget-css/fonts/x`, matching where `fontSources` / `assetTargets`
 * place the binaries under this package's `assets/`. The rewritten URLs
 * carry the `__WIDGET_ASSETS__` placeholder, which `createWidgetShadow`
 * substitutes with the host's `HostConfig.assetBaseUrl` (empty base =
 * the host serves `assets/` at its site root).
 *
 * Runs via this package's `assets` script (`pnpm assets` at the
 * workspace root) — regeneration happens only in this repo. The host's
 * `copy:widget-assets` only copies the committed `assets/` into its
 * public dir; it never runs this script. Outputs are checked into git
 * so a fresh clone doesn't need to run the script before typechecking.
 */

import { createRequire } from 'node:module';
import {
  mkdirSync,
  copyFileSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');
const req = createRequire(join(pkgRoot, 'package.json'));

const assetsDir = join(pkgRoot, 'assets');
const fontsDir = join(assetsDir, 'fonts');
const vendorCssDir = join(pkgRoot, 'src/lib/vendor-css');

/**
 * Stylesheets emitted as vendor-css modules. `out` names the module file
 * (and the virtual `/widget-css/<out>` URL that relative url()s are
 * resolved against). `via` resolves the specifier through a transitive
 * dependency's scope (pnpm keeps those out of our own search path).
 */
const cssTargets = [
  // Widget-own CSS
  { specifier: 'summit-registration-lite/dist/index.css', out: 'summit-registration-lite.css' },
  { specifier: 'speakers-widget/dist/index.css', out: 'speakers-widget.css' },
  { specifier: 'full-schedule-widget/dist/index.css', out: 'full-schedule-widget.css' },
  { specifier: 'lite-schedule-widget/dist/index.css', out: 'lite-schedule-widget.css' },
  { specifier: 'schedule-filter-widget/dist/index.css', out: 'schedule-filter-widget.css' },
  { specifier: 'event-feedback-widget/dist/index.css', out: 'event-feedback-widget.css' },
  { specifier: 'my-orders-tickets-widget/dist/index.css', out: 'my-orders-tickets-widget.css' },
  { specifier: 'upcoming-events-widget/dist/index.css', out: 'upcoming-events-widget.css' },
  { specifier: 'live-event-widget/dist/index.css', out: 'live-event-widget.css' },

  // Vendor CSS. summit-registration-lite/README.md documents Bootstrap 3
  // + Font Awesome 4 as required external stylesheets. Both ship font
  // files that CSS references via `url('../fonts/…')`.
  { specifier: 'bootstrap/dist/css/bootstrap.min.css', out: 'bootstrap.min.css' },
  { specifier: 'font-awesome/css/font-awesome.min.css', out: 'font-awesome.min.css' },
  // Styles the `.form-check.abc-radio` / `.abc-checkbox` structure the
  // registration widget renders for "Ticket is for" radios and consent
  // checkboxes — hides the native control and draws a custom one.
  {
    specifier: 'awesome-bootstrap-checkbox/awesome-bootstrap-checkbox.css',
    out: 'awesome-bootstrap-checkbox.css',
  },
  // pure-react-carousel layout CSS (the upcoming-events widget's slide
  // track). The classes are precompiled CSS-Module hashes; the widget's
  // JS bundle imports the stylesheet as a side effect, which Next hoists
  // into document.head — invisible to the shadow root. Without it slides
  // stack vertically and `carousel__slide--hidden` never hides anything.
  {
    specifier: 'pure-react-carousel/dist/react-carousel.es.css',
    out: 'react-carousel.css',
    via: 'upcoming-events-widget',
  },
  // uicore CircleButton CSS (the schedule cards' add/added/enter toggle).
  // The schedule widgets render uicore's <CircleButton>, whose class names
  // are CSS-Module hashes and whose stylesheet uicore imports via JS —
  // Next hoists that import into document.head, which the widget's shadow
  // root can't see, so the button loses its shape (30px circle, absolute
  // bottom-right). Hashes are pinned to the installed uicore version.
  {
    specifier: 'openstack-uicore-foundation/lib/css/components/circle-button.css',
    out: 'uicore-circle-button.css',
  },
  // uicore ExtraQuestionsForm layout CSS (.questions-form grid, error
  // labels with the FontAwesome warning glyph).
  {
    specifier: 'openstack-uicore-foundation/lib/css/components/extra-questions.css',
    out: 'uicore-extra-questions.css',
  },
  // uicore free-text-search box CSS (the lite schedule's search input).
  // Nothing in uicore auto-imports its own lib/css — consumers must link.
  {
    specifier: 'openstack-uicore-foundation/lib/css/components/free-text-search.css',
    out: 'uicore-free-text-search.css',
  },
  // slick-carousel CSS pair — the speakers widget's dist hard-requires
  // both (its own index.css only ships .slick-* overrides). slick-theme
  // resolves './fonts/slick.*' and './ajax-loader.gif' relative to
  // itself → assets live under `assets/widget-css/` (see assetTargets).
  {
    specifier: 'slick-carousel/slick/slick.css',
    out: 'slick.css',
    via: 'speakers-widget',
  },
  {
    specifier: 'slick-carousel/slick/slick-theme.css',
    out: 'slick-theme.css',
    via: 'speakers-widget',
  },
  // react-toastify CSS — the full-schedule widget's dist requires it as a
  // side effect (sync/share toasts); Next would hoist it into
  // document.head where the shadow root can't see it.
  {
    specifier: 'react-toastify/dist/ReactToastify.css',
    out: 'react-toastify.css',
    via: 'full-schedule-widget',
  },
];

/**
 * Font-file source directories, copied wholesale into `assets/fonts/`.
 * We flatten into one dir because filenames don't collide (glyphicons-*
 * vs fontawesome-*) and the rewritten CSS url()s point at
 * `__WIDGET_ASSETS__/fonts/x`.
 */
const fontSources = [
  { packageName: 'bootstrap', subPath: 'fonts' },
  { packageName: 'font-awesome', subPath: 'fonts' },
];

/**
 * Non-CSS assets referenced by vendor stylesheets via relative url()s
 * that do NOT follow the `../fonts/` convention. Copied preserving the
 * layout the rewritten URLs expect under `assets/`.
 */
const assetTargets = [
  // slick-theme.css → url('./fonts/slick.{eot,svg,ttf,woff}')
  { via: 'speakers-widget', dir: 'slick-carousel/slick/fonts', dest: 'widget-css/fonts' },
  // slick-theme.css → url('./ajax-loader.gif')
  { via: 'speakers-widget', file: 'slick-carousel/slick/ajax-loader.gif', dest: 'widget-css' },
];

function resolverFor(via) {
  return via ? createRequire(req.resolve(`${via}/package.json`)) : req;
}

/**
 * Rewrite every relative url() to the absolute path it resolved to when
 * this stylesheet was served as `/widget-css/<out>` — data URIs,
 * absolute paths, and full URLs pass through untouched.
 */
function rewriteUrls(css, outName) {
  const virtualBase = `https://x/widget-css/${outName}`;
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) => {
    if (/^(data:|https?:|\/\/|\/)/.test(ref)) return match;
    const resolved = new URL(ref, virtualBase);
    return `url(${quote}__WIDGET_ASSETS__${resolved.pathname}${resolved.search}${resolved.hash}${quote})`;
  });
}

/**
 * Split @font-face blocks out of the CSS: adopted stylesheets silently
 * ignore @font-face, so the toolkit injects these into document.head.
 * Font-face blocks never nest braces, so a flat match is sufficient.
 */
function splitFontFaces(css) {
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const rest = blocks.length
    ? blocks.reduce((acc, b) => acc.replace(b, ''), css)
    : css;
  return { fontFaces: blocks.join('\n'), css: rest };
}

function generateCssModule(specifier, outName, via) {
  const src = resolverFor(via).resolve(specifier);
  const raw = readFileSync(src, 'utf8');
  const { fontFaces, css } = splitFontFaces(rewriteUrls(raw, outName));
  const id = outName.replace(/\.css$/, '');
  const moduleSource = `// AUTO-GENERATED by this package's scripts/generate-assets.mjs — do not edit.
// Source: ${specifier}
import type { VendorSheet } from '@openeventkit/widgets/core/vendor-sheet';

export const sheet: VendorSheet = {
  id: ${JSON.stringify(id)},
  css: ${JSON.stringify(css)},
  fontFaces: ${JSON.stringify(fontFaces)},
};
`;
  writeFileSync(join(vendorCssDir, `${id}.ts`), moduleSource);
}

mkdirSync(vendorCssDir, { recursive: true });
mkdirSync(fontsDir, { recursive: true });

let cssCount = 0;
for (const { specifier, out, via } of cssTargets) {
  generateCssModule(specifier, out, via);
  cssCount += 1;
}

let fontCount = 0;
for (const { packageName, subPath } of fontSources) {
  const pkgJsonPath = req.resolve(`${packageName}/package.json`);
  const srcDir = join(dirname(pkgJsonPath), subPath);
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    copyFileSync(join(srcDir, entry.name), join(fontsDir, entry.name));
    fontCount += 1;
  }
}

let assetCount = 0;
for (const { via, dir, file, dest } of assetTargets) {
  const resolver = resolverFor(via);
  const destDir = join(assetsDir, dest);
  mkdirSync(destDir, { recursive: true });
  if (file) {
    copyFileSync(resolver.resolve(file), join(destDir, file.split('/').pop()));
    assetCount += 1;
  } else {
    const pkgName = dir.split('/')[0];
    const pkgRoot = dirname(resolver.resolve(`${pkgName}/package.json`));
    const srcDir = join(pkgRoot, dir.slice(pkgName.length + 1));
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      copyFileSync(join(srcDir, entry.name), join(destDir, entry.name));
      assetCount += 1;
    }
  }
}

process.stdout.write(
  `[generate-assets] generated ${cssCount} vendor-css module(s), ` +
  `copied ${fontCount} font file(s) + ${assetCount} other asset(s)\n`
);
