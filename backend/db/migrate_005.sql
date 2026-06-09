BEGIN;

-- ── Asset readiness fields on screens (BL-009 / G-09–G-11) ──────────────────
-- Populated from player heartbeat; allows CMS to observe per-screen asset state.
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS assets_required_count   INTEGER,
  ADD COLUMN IF NOT EXISTS assets_verified_count   INTEGER,
  ADD COLUMN IF NOT EXISTS content_readiness_state VARCHAR(20);

COMMIT;
