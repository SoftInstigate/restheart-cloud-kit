import { defineConfig } from 'vitest/config';

// Everything here runs with no live service: the clients speak `fetch`, and a
// test supplies its own through `AuthConfig.transport`. That is the whole point
// of keeping the client layer isomorphic — see docs/ADAPTERS.md.
export default defineConfig({
  test: {
    include: ['src/__tests__/unit/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
