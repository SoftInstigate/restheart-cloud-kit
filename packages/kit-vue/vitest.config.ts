import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globals: false,
    // Default to jsdom for the store/composable tests; the SSR (Nuxt/h3) tests
    // opt into the node environment with a `// @vitest-environment node` docblock.
    environment: 'jsdom',
  },
});
