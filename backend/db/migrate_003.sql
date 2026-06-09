BEGIN;

-- ── Durable rollout state ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rollout_state (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id      VARCHAR(255) NOT NULL UNIQUE,
  target_version VARCHAR(100) NOT NULL,
  state          VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
  previous_state VARCHAR(50),
  frozen_from    VARCHAR(50),
  ring_entered_at TIMESTAMPTZ,
  started_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  history        JSONB        NOT NULL DEFAULT '[]',
  adoption_log   JSONB        NOT NULL DEFAULT '{}',
  total_screens  INTEGER      NOT NULL DEFAULT 0,
  version        INTEGER      NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Enforce: only one non-terminal rollout globally (PostgreSQL singleton constraint trick)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_rollout
  ON rollout_state ((1))
  WHERE state NOT IN ('COMPLETE', 'ROLLED_BACK');

-- ── OTA packages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ota_packages (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id      VARCHAR(255) NOT NULL,
  target_version VARCHAR(100) NOT NULL,
  sha256         VARCHAR(64)  NOT NULL,
  size_bytes     BIGINT,
  uploaded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  uploaded_by    VARCHAR(255),
  ring_target    INTEGER      NOT NULL DEFAULT 0,
  metadata       JSONB        NOT NULL DEFAULT '{}',
  FOREIGN KEY (update_id) REFERENCES rollout_state(update_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ota_packages_update ON ota_packages(update_id);

-- ── Screen enrollment columns ─────────────────────────────────────────────────
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS enrollment_token_hash    VARCHAR(64),
  ADD COLUMN IF NOT EXISTS token_status             VARCHAR(20) DEFAULT 'UNENROLLED',
  ADD COLUMN IF NOT EXISTS enrolled_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_token_hash       VARCHAR(64),
  ADD COLUMN IF NOT EXISTS token_expires_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_revoked            BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS failed_enrollments       INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrollment_locked_until  TIMESTAMPTZ;

-- ── Enrollment tokens (one-time, provisioned by operator) ─────────────────────
CREATE TABLE IF NOT EXISTS enrollment_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id   VARCHAR(100) NOT NULL REFERENCES screens(id),
  token_hash  VARCHAR(64)  NOT NULL UNIQUE,
  status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_by  VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_screen ON enrollment_tokens(screen_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_hash   ON enrollment_tokens(token_hash);

COMMIT;
