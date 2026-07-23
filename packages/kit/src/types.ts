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
}

export interface UserInfo {
  _id: string;
  roles: string[];
  team?: { _id: { $oid: string }; role: string };
  profile?: {
    name?: string;
    surname?: string;
    avatarUrl?: string;
  };
}

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
