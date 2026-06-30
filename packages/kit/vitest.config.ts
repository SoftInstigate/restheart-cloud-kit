import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config(); // loads .env if present; no-op otherwise (CI uses env vars from secrets)

export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    globals: false,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    typecheck: { tsconfig: './tsconfig.test.json' },
    reporters: ['verbose', ['junit', { outputFile: './test-results/junit.xml' }], ['html', { outputFile: './test-results/index.html' }]],
  },
});
