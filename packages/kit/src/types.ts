export interface AuthConfig {
  apiBaseUrl: string;
}

export interface UserInfo {
  _id: string;
  roles: string[];
  tenant: string;
  tenants?: TenantMembership[];
  profile?: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };
}

export interface TenantMembership {
  id: { $oid: string };
  name?: string;
  role: 'owner' | 'member';
  active?: boolean;
}

export interface Invitation {
  email: string;
  orgName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}

export interface ApiError {
  status: number;
  message: string;
}
