import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React's `cache` is a Server Components-only export — undefined in the
// jsdom (client) module resolution vitest uses. Any test that transitively
// imports server-only code (e.g. src/lib/auth/service.ts wraps its token
// fetcher with cache() to dedupe per-request) crashes at module load with
// "cache is not a function". Shim it to identity here — tests don't need
// the deduplication, and prod (server) still gets the real thing.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    cache: <T>(fn: T): T => fn,
  };
});


// @testing-library/react auto-cleans only when Vitest globals are enabled;
// we run with globals: false, so wire cleanup explicitly here.
afterEach(() => {
  cleanup();
});

// jsdom lacks matchMedia — MUI's useMediaQuery needs it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom lacks IntersectionObserver — used by some MUI components.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
}

// jsdom lacks ResizeObserver — used by MUI for layout-aware components.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  });
}
