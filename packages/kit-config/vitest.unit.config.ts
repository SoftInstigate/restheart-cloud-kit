import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Everything here runs with no live service: the clients speak `fetch`, and a
// test supplies its own through `AuthConfig.transport`. That is the whole point
// of keeping the client layer isomorphic — see docs/ADAPTERS.md.
export default defineConfig({
  resolve: {
    alias: {
      '@restheart-cloud/kit': resolve(__dirname, '../kit/src/index.ts'),
    },
  },
  test: {
    include: ['src/__tests__/unit/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
