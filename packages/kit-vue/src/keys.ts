import type { InjectionKey } from 'vue';
import type { RhAuthStore } from './store.js';

/** Injection key under which {@link createRhAuth} provides the store. */
export const RH_AUTH_KEY: InjectionKey<RhAuthStore> = Symbol('rh-auth');
