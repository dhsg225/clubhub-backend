-- V11: Add REMOTE_COMMAND_EXPIRED to venue_timeline_events event_type
--
-- Previously, commands that expired while the screen was offline were silently
-- discarded. The player polling query filters them out (expires_at <= now())
-- and no record was written to the operator timeline.
--
-- This migration adds REMOTE_COMMAND_EXPIRED as a valid event type so that
-- the application layer can surface expiry in the operator timeline.

ALTER TABLE venue_timeline_events
  DROP CONSTRAINT venue_timeline_events_event_type_check;

ALTER TABLE venue_timeline_events
  ADD CONSTRAINT venue_timeline_events_event_type_check CHECK (event_type IN (
    'PLAYER_ENROLLED',
    'PLAYER_ONLINE',
    'PLAYER_OFFLINE',
    'CORPUS_DEPLOYED',
    'CORPUS_ROLLBACK',
    'MAINTENANCE_START',
    'MAINTENANCE_END',
    'REMOTE_COMMAND_ISSUED',
    'REMOTE_COMMAND_COMPLETED',
    'REMOTE_COMMAND_EXPIRED',
    'EMERGENCY_OVERRIDE',
    'HEALTH_WARNING',
    'HEALTH_RECOVERED',
    'ASSET_APPROVED',
    'DEPLOYMENT_APPROVED',
    'INCIDENT_OPENED',
    'INCIDENT_CLOSED',
    'OPERATOR_ACTION'
  ));

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (11, 'V11__remote_command_expired_event.sql', 'bootstrap');
