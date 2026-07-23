export { RhAuthProvider, useAuth } from './context.js';
export type { RhAuth, RhAuthProviderProps } from './context.js';
export { AuthGuard, PublicGuard } from './guards.js';
export type { GuardProps } from './guards.js';

// Re-exported so React apps only need this one package — @restheart-cloud/kit
// is an internal (non-peer) dependency of kit-react.
export * from '@restheart-cloud/kit';
