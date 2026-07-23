import { afterEach } from 'vitest';

// With `globals: false`, @testing-library/react cannot register its automatic
// afterEach cleanup, so the DOM from one render would leak into the next test.
// Do it explicitly. The SSR tests run in the node environment (no `document`);
// import testing-library lazily so those files never load a DOM-only module.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
