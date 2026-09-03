import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/*/src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      exclude: [
        'packages/*/src/**/*.{test,spec}.{ts,tsx}',
        'packages/*/src/**/__tests__/**',
        'packages/widgets/src/kit/vendor-css/**',
      ],
      reporter: ['text', 'html'],
    },
  },
});
