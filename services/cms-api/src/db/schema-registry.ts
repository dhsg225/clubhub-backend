/**
 * Schema registry — tracks which tables are owned by which service.
 * No service may write directly to another service's tables.
 */

export const TABLE_OWNERSHIP = {
  // cms-api owns:
  enterprise_groups: 'cms-api',
  regional_organizations: 'cms-api',
  venues: 'cms-api',
  screen_zones: 'cms-api',
  screens: 'cms-api',
  campaigns: 'cms-api',
  schedules: 'cms-api',
  overrides: 'cms-api',
  sponsorships: 'cms-api',
  templates: 'cms-api',
  corpus_versions: 'cms-api',
  deployment_groups: 'cms-api',
  deployment_group_screens: 'cms-api',
  corpus_deployments: 'cms-api',

  // replay-service owns:
  replay_audit_records: 'replay-service',
  replay_audit_records_partitions: 'replay-service', // all monthly partitions

  // shadow-service owns:
  parity_records: 'shadow-service',

  // entropy-service owns:
  entropy_reports: 'entropy-service',
  entropy_acknowledgments: 'entropy-service',

  // auth-service owns:
  principals: 'auth-service',
  role_assignments: 'auth-service',

  // constitutional — platform-scoped:
  constitutional_freeze_log: 'platform', // permanent retention, PLATFORM_ADMIN only
  canary_stage_history: 'shadow-service',
  constitutional_state: 'platform',
} as const;

export type TableName = keyof typeof TABLE_OWNERSHIP;
export type ServiceName = (typeof TABLE_OWNERSHIP)[TableName];

export function assertTableOwnership(table: TableName, callerService: ServiceName): void {
  const owner = TABLE_OWNERSHIP[table];
  if (owner !== callerService) {
    throw new Error(
      `Service '${callerService}' attempted to write to table '${table}' owned by '${owner}'. ` +
      'Cross-service table writes are a constitutional violation.',
    );
  }
}
