import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React 17+ automatic JSX runtime, so test files need no `import React`.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    // Default to jsdom for the SPA/component tests; the SSR (Next) tests opt
    // into the node environment with a `// @vitest-environment node` docblock.
    environment: 'jsdom',
  },
});
