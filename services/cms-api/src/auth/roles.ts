/**
 * Role → permission matrix.
 *
 * Constitutional enforcement:
 * - SPONSOR_STAKEHOLDER: zero mutation authority, zero emergency authority
 * - AUDITOR: read-only access to audit records only
 */

import type { UserRole, Permission } from '@clubhub/auth-types';

type PermissionMatrix = Record<UserRole, ReadonlySet<Permission>>;

const ROLE_PERMISSIONS: PermissionMatrix = {
  PLATFORM_ADMIN: new Set<Permission>([
    'corpus_read', 'corpus_mutation', 'campaign_approve', 'override_create',
    'emergency_trigger', 'emergency_acknowledge', 'canary_advance',
    'parity_view', 'entropy_view', 'audit_view',
    'venue_manage', 'enterprise_manage', 'platform_admin',
  ]),

  ENTERPRISE_ADMIN: new Set<Permission>([
    'corpus_read', 'corpus_mutation', 'campaign_approve', 'override_create',
    'emergency_trigger', 'emergency_acknowledge',
    'entropy_view', 'audit_view', 'venue_manage', 'enterprise_manage',
  ]),

  REGIONAL_MANAGER: new Set<Permission>([
    'corpus_read', 'corpus_mutation', 'campaign_approve', 'override_create',
    'emergency_trigger', 'entropy_view', 'venue_manage',
  ]),

  VENUE_OPERATOR: new Set<Permission>([
    'corpus_read', 'override_create',
    'emergency_trigger', 'entropy_view',
  ]),

  // Constitutional: SPONSOR_STAKEHOLDER has zero mutation/emergency/audit authority
  SPONSOR_STAKEHOLDER: new Set<Permission>([
    'corpus_read', // read-only corpus (no sensitive fields)
  ]),

  AUDITOR: new Set<Permission>([
    'corpus_read', 'audit_view', 'parity_view', 'entropy_view',
  ]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  // Non-null assertion: Record<UserRole, ...> is exhaustive — all keys are present
  return ROLE_PERMISSIONS[role]!.has(permission);
}

export function requiresRole(permission: Permission): UserRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter(
    role => ROLE_PERMISSIONS[role]!.has(permission),
  );
}

// Constitutional assertion: SPONSOR_STAKEHOLDER must never have mutation authority
const SPONSOR_FORBIDDEN: Permission[] = [
  'corpus_mutation', 'campaign_approve', 'override_create',
  'emergency_trigger', 'emergency_acknowledge', 'canary_advance',
  'parity_view', 'entropy_view', 'audit_view',
  'venue_manage', 'enterprise_manage', 'platform_admin',
];

for (const forbidden of SPONSOR_FORBIDDEN) {
  if (ROLE_PERMISSIONS.SPONSOR_STAKEHOLDER!.has(forbidden)) {
    throw new Error(
      `CONSTITUTIONAL VIOLATION: SPONSOR_STAKEHOLDER must not have permission: ${forbidden}`,
    );
  }
}
