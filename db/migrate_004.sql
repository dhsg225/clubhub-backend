BEGIN;

-- ── Screen heartbeats (durable fleet state) ───────────────────────────────────
-- Previously held only in-memory (_screens Map in fleet-consensus.js).
-- Written on every manifest poll; loaded on startup so consensus survives restart.
CREATE TABLE IF NOT EXISTS screen_heartbeats (
  screen_id              VARCHAR(100) PRIMARY KEY,
  authority_epoch        INTEGER,
  manifest_version       INTEGER,
  manifest_hash          VARCHAR(64),
  rollout_version        VARCHAR(100),
  previous_manifest_hash VARCHAR(64),
  applied_at             BIGINT,
  received_at            BIGINT       NOT NULL,
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMIT;
