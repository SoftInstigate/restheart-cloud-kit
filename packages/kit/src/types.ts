/**
 * Login mode.
 * - 'bearer' (default): token managed client-side (localStorage)
 * - 'cookie': JWT cookie managed by the backend (HttpOnly)
 */
export type LoginMode = 'bearer' | 'cookie';

export interface AuthConfig {
  apiBaseUrl: string;
}

export interface UserInfo {
  _id: string;
  roles: string[];
  team?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };
}

export interface TokenInfo {
  username: string;
  roles: string[];
  team?: string;
  expires_in: number;
  access_token: string;
  token_type: string;
}

export interface TeamMembership {
  id: { $oid: string };
  name?: string;
  role: 'owner' | 'member';
  active?: boolean;
}

export interface Invitation {
  email: string;
  teamName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}

export interface ApiError {
  status: number;
  message: string;
}
