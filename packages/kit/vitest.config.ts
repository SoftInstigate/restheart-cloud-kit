import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    globals: false,
    globalSetup: ['src/__tests__/integration/global-setup.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    typecheck: { tsconfig: './tsconfig.test.json' },
    reporters: ['verbose', ['junit', { outputFile: './test-results/junit.xml' }], ['html', { outputFile: './test-results/index.html' }]],
  },
});
