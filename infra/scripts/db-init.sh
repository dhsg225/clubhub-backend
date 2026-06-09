#!/usr/bin/env bash
# Initialize PostgreSQL for ClubHub
# Run once after database creation — before migrations
#
# Constitutional requirements enforced here:
# - uuid-ossp extension for UUID primary keys
# - row_security = on at server level (backs RLS on all tenant tables)
# - session_replication_role locked to DEFAULT for application connections
#   (prevents bypass of enforce_append_only() triggers)
# - Application roles with least-privilege separation

set -euo pipefail

DB_URL="${DATABASE_URL:?DATABASE_URL required}"

echo "[db-init] Enabling required extensions..."
psql "$DB_URL" <<'EOF'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Constitutional: enable row-level security at server level
-- Backs current_setting('app.current_enterprise_id', true) RLS policies
ALTER SYSTEM SET row_security = 'on';
SELECT pg_reload_conf();

-- Constitutional: ensure session_replication_role cannot be abused
-- Application connections must use DEFAULT, never REPLICA
-- REPLICA bypasses row-level security and triggers — including enforce_append_only()
REVOKE SET ON PARAMETER session_replication_role FROM PUBLIC;
EOF

echo "[db-init] Creating application roles..."
psql "$DB_URL" <<'EOF'
DO $$
BEGIN
  -- clubhub_app: runtime application role (RLS enforced)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clubhub_app') THEN
    CREATE ROLE clubhub_app LOGIN;
  END IF;

  -- clubhub_readonly: audit query access (read replica target)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clubhub_readonly') THEN
    CREATE ROLE clubhub_readonly LOGIN;
  END IF;

  -- clubhub_migrator: schema migration role (superuser — restricted to migration CI)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clubhub_migrator') THEN
    CREATE ROLE clubhub_migrator SUPERUSER LOGIN;
  END IF;
END
$$;
EOF

echo "[db-init] Configuring partitioning prerequisites..."
psql "$DB_URL" <<'EOF'
-- Constitutional: replay_audit_records uses RANGE partitioning on created_at
-- with composite PK (audit_record_id, created_at) — cannot be retrofitted
-- This comment anchors the requirement; actual DDL is in migrations.
-- Confirm pg_partman is available if automated partition maintenance is needed.
SELECT current_database(), version();
EOF

echo "[db-init] Done. Run database migrations next (pnpm db:migrate or equivalent)."
