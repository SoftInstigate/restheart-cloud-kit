export { createRhAuth } from './create.js';
export type { RhAuth } from './create.js';
export { createRhAuthStore } from './store.js';
export type { RhAuthStore } from './store.js';
export { createRhPayments } from './create-payments.js';
export type { RhPayments } from './create-payments.js';
export { createRhPaymentsStore } from './payments.js';
export type { RhPaymentsStore } from './payments.js';
export { useAuth } from './use-auth.js';
export { usePayments } from './use-payments.js';
export { buildGuards } from './guards.js';
export type { RhGuards, GuardOptions } from './guards.js';
export { RH_AUTH_KEY, RH_PAYMENTS_KEY } from './keys.js';

// Re-exported so Vue apps only need this one package — @restheart-cloud/kit
// is an internal (non-peer) dependency of kit-vue.
export * from '@restheart-cloud/kit';
