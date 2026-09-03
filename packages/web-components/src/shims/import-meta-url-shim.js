/**
 * esbuild inject shim: bundled ESM that reads `import.meta.url` (e.g. pdfkit's
 * browser build resolving asset URLs) gets the loading <script>'s own URL
 * instead of esbuild's empty `import_meta` stub, whose undefined `.url` makes
 * `new URL(...)` throw at module eval. Paired with the build's
 * define { 'import.meta.url': '__import_meta_url__' }.
 */
export var __import_meta_url__ =
  typeof document !== 'undefined'
    ? (document.currentScript && document.currentScript.src) || document.baseURI
    : 'file:///';
