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
}

export interface ApiError {
  status: number;
  message: string;
}
