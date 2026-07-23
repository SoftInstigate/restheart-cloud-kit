export { createRhAuth } from './create.js';
export type { RhAuth } from './create.js';
export { createRhAuthStore } from './store.js';
export type { RhAuthStore } from './store.js';
export { useAuth } from './use-auth.js';
export { buildGuards } from './guards.js';
export type { RhGuards, GuardOptions } from './guards.js';
export { RH_AUTH_KEY } from './keys.js';

// Re-exported so Vue apps only need this one package — @restheart-cloud/kit
// is an internal (non-peer) dependency of kit-vue.
export * from '@restheart-cloud/kit';
