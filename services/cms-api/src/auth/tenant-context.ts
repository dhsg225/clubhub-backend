/**
 * Tenant context extraction + RLS setting.
 *
 * Constitutional rule: use current_setting('app.current_enterprise_id', true)
 * two-arg form (boolean = true means return empty string if not set, not error).
 */

import type { TenantContext, UserRole } from '@clubhub/auth-types';
import type { PoolClient } from 'pg';

/**
 * Set PostgreSQL session variables for RLS enforcement.
 * Must be called at the start of every database transaction.
 */
export async function setRlsContext(
  client: PoolClient,
  tenantContext: TenantContext,
  role: UserRole,
): Promise<void> {
  // PLATFORM_ADMIN can access all tenants — set sentinel value
  const enterpriseId = tenantContext.enterprise_id ?? '';

  await client.query(
    `SET LOCAL app.current_enterprise_id = $1;
     SET LOCAL app.current_role = $2;
     SET LOCAL app.current_venue_id = $3;`,
    [enterpriseId, role, tenantContext.venue_id ?? ''],
  );
}

/**
 * Clear RLS context at end of transaction.
 * Called automatically by transaction wrapper.
 */
export async function clearRlsContext(client: PoolClient): Promise<void> {
  await client.query(`
    RESET app.current_enterprise_id;
    RESET app.current_role;
    RESET app.current_venue_id;
  `);
}

/**
 * Execute a database operation within tenant RLS context.
 * Ensures RLS is always set and always cleared.
 */
export async function withTenantContext<T>(
  client: PoolClient,
  tenantContext: TenantContext,
  role: UserRole,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await setRlsContext(client, tenantContext, role);
  try {
    return await fn(client);
  } finally {
    await clearRlsContext(client);
  }
}
