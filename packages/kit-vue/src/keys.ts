import type { InjectionKey } from 'vue';
import type { RhAuthStore } from './store.js';
import type { RhPaymentsStore } from './payments.js';

/** Injection key under which {@link createRhAuth} provides the store. */
export const RH_AUTH_KEY: InjectionKey<RhAuthStore> = Symbol('rh-auth');

/** Injection key under which `createRhPayments` provides the payments store. */
export const RH_PAYMENTS_KEY: InjectionKey<RhPaymentsStore> = Symbol('rh-payments');
