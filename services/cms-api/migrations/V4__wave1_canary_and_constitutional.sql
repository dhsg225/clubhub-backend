-- Wave 1: Canary Stage History + Constitutional State
-- Append-only tables for governance tracking

-- ─── Canary Stage History ────────────────────────────────────────────────────
CREATE TABLE canary_stage_history (
  canary_history_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  corpus_version_id UUID NOT NULL REFERENCES corpus_versions(corpus_version_id),
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  approved_by TEXT NOT NULL,           -- principal_id
  human_approval_token_hash TEXT NOT NULL,  -- SHA-256 of human approval token
  parity_ratio_at_approval NUMERIC(8,6),
  class3_count_at_approval INTEGER,
  class4_count_at_approval INTEGER,
  PRIMARY KEY (canary_history_id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TRIGGER canary_history_append_only
  BEFORE DELETE OR UPDATE ON canary_stage_history
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TABLE canary_stage_history_2026
  PARTITION OF canary_stage_history
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- ─── Constitutional State ────────────────────────────────────────────────────
-- One row per enterprise; upsert pattern (not append-only — state changes)
CREATE TABLE constitutional_state (
  enterprise_group_id UUID PRIMARY KEY REFERENCES enterprise_groups(enterprise_group_id),
  current_state TEXT NOT NULL DEFAULT 'INITIALIZING' CHECK (
    current_state IN (
      'INITIALIZING', 'HEALTHY', 'DEGRADED', 'CONSTITUTIONAL_RISK',
      'SHADOW_ONLY', 'PRE_DISABLED', 'READ_ONLY', 'EMERGENCY_FREEZE'
    )
  ),
  state_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to record state transitions in constitutional_freeze_log when entering EMERGENCY_FREEZE
CREATE OR REPLACE FUNCTION record_constitutional_freeze()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_state = 'EMERGENCY_FREEZE' AND OLD.current_state != 'EMERGENCY_FREEZE' THEN
    INSERT INTO constitutional_freeze_log (
      freeze_type, triggered_by, reason
    ) VALUES (
      'AUTOMATIC',
      'SYSTEM',
      COALESCE(NEW.state_reason, 'State transition to EMERGENCY_FREEZE')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER constitutional_freeze_recorder
  AFTER UPDATE ON constitutional_state
  FOR EACH ROW EXECUTE FUNCTION record_constitutional_freeze();

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (4, 'V4__wave1_canary_and_constitutional.sql', 'bootstrap');
