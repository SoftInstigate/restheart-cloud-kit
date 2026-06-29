import type { AuthConfig, TenantMembership } from './types.js';
import { apiFetch } from './client.js';

export async function getTenants(config: AuthConfig): Promise<TenantMembership[]> {
  const res = await apiFetch(config, '/restheart-accounts/tenants');
  return res.json() as Promise<TenantMembership[]>;
}

export async function switchTenant(
  config: AuthConfig,
  tenantId: { $oid: string }
): Promise<void> {
  await apiFetch(config, '/restheart-accounts/tenants/switch', {
    method: 'POST',
    body: JSON.stringify({ tenantId }),
  });
}
