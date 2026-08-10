/**
 * Login mode.
 * - 'bearer' (default): token managed client-side (localStorage)
 * - 'cookie': JWT cookie managed by the backend (HttpOnly)
 */
export type LoginMode = 'bearer' | 'cookie';

export interface AuthConfig {
  apiBaseUrl: string;
  /**
   * Where the bearer token comes from.
   *
   * Defaults to the browser `localStorage` store used by SPA adapters. Server
   * runtimes (Next.js middleware/route handlers, Nuxt server middleware) have no
   * `localStorage`; they pass a source that reads the token from the request
   * cookie instead. May be async so the source can await a cookie store.
   */
  getToken?: () => string | null | Promise<string | null>;
  /**
   * Where a freshly obtained bearer token is persisted, after `login` and the
   * auto-login endpoints (`activate`, `resetPassword`, `switchTeam`).
   *
   * Defaults to the browser `localStorage` store plus a proactive refresh timer.
   * Server runtimes pass a sink that simply captures the token — so a server
   * action can write it into a response cookie — instead of touching
   * `localStorage` (which on a server would leak into a shared module global) or
   * scheduling a `setTimeout` refresh (which a server has nothing to refresh).
   *
   * When set, the localStorage store and the refresh timer are both bypassed.
   */
  setToken?: (token: string) => void;
  /**
   * How a request actually goes out. Defaults to the global `fetch`.
   *
   * The core is framework-agnostic and speaks `fetch`, which means its calls
   * bypass whatever HTTP stack the host framework has — and with it every
   * cross-cutting concern wired into that stack. In Angular that is literal:
   * an interceptor sees `HttpClient` traffic and nothing else, so a tracing
   * header, a retry policy or a global error handler would silently cover the
   * application's own requests and not the kit's.
   *
   * An adapter can close that gap by passing its framework's client here.
   * `kit-ng` does exactly this, routing every call through `HttpClient` so the
   * interceptor chain applies to all of it.
   *
   * The contract is `fetch`'s, and deliberately so — the core uses only `ok`,
   * `status`, `statusText`, `json()`, `clone()` and `headers.get()`. Two things
   * an implementation must get right: **resolve** on a non-2xx response rather
   * than rejecting (clients like `HttpClient` throw, and the core reads the
   * status itself), and reject only when the request never produced a response
   * at all.
   */
  transport?: (url: string, init?: RequestInit) => Promise<Response>;
}

/**
 * Base user document returned by `/users/me`.
 *
 * Applications whose users collection has a JSON Schema can extend this
 * with their own fields via the generic parameter:
 *
 * ```ts
 * type MyUser = UserInfo<{
 *   latestConsents?: { tos: string; pp: string; acceptedAt?: { $date: number } };
 * }>;
 *
 * const user = await checkSession<{ latestConsents?: … }>(config);
 * const accepted = user?.latestConsents?.tos === CURRENT_TOS_VERSION;
 * ```
 *
 * The fields are optional because the user document does not carry them until
 * the user accepts — which is the state a Guards rule blocks on.
 *
 * The extra properties are populated only when the server's JSON Schema
 * declares them. When no schema is configured the server silently drops
 * any properties beyond the base set — the request still succeeds with
 * `201` on registration.
 */
export type UserInfo<E extends object = Record<never, never>> = {
  _id: string;
  roles: string[];
  team?: { _id: { $oid: string }; role: string };
  profile?: {
    name?: string;
    surname?: string;
    avatarUrl?: string;
  };
} & E;

export interface TokenInfo {
  username: string;
  roles: string[];
  team?: { _id: { $oid: string }; role: string };
  expires_in: number;
  access_token: string;
  token_type: string;
}

export interface TeamMembership {
  id: { $oid: string };
  name?: string;
  description?: string;
  role: 'owner' | 'member';
  active?: boolean;
}

/** A member of a team, as returned by `listTeamMembers`. */
export interface TeamMember {
  email: string;
  name?: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface Invitation {
  email: string;
  teamName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}

/** A pending invitation as returned by `listInvitations`. */
export interface PendingInvitation {
  email: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  createdAt?: string;
  expiresAt?: string;
  expired?: boolean;
}

export interface ApiError {
  status: number;
  message: string;
}
