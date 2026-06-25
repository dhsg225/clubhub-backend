-- migrate_018.sql
-- BL-045: cognito_mappings table (D-020 — Cognito Guru as invisible engine)
-- Maps ClubHub tenant → Cognito Guru client + project for backend-to-backend bridge calls.

CREATE TABLE IF NOT EXISTS cognito_mappings (
  clubhub_tenant_id  UUID         PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cognito_client_id  VARCHAR(100) NOT NULL,
  cognito_project_id VARCHAR(100),
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- BL-046: social_jobs — store Cognito post ID for traceability
ALTER TABLE social_jobs ADD COLUMN IF NOT EXISTS cognito_post_id VARCHAR(100);
