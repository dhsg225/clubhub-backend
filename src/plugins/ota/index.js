'use strict';
/**
 * OTA Plugin — registers the OTA/signage deployment system as a kernel plugin.
 *
 * The kernel governs: freeze, lineage, operator auth, incidents, resource bounds.
 * This plugin provides: ring-based deployment waves, manifest delivery, screen fleet.
 *
 * Nondeterministic paths (documented, not concealed):
 *   - lineage_ts: wall-clock audit timestamp (intentional)
 *   - received_at: screen heartbeat wall-clock (by design)
 *   - operator token iat/exp: wall-clock required for interop
 *   - ledger action IDs: sequential from DB seq (deterministic per DB, not content-addressed)
 */
const plugins = require('../../governance-kernel/plugins');

const OTAPlugin = {
  name:               'ota',
  version:            '1.0.0',
  determinismLevel:   'DETERMINISTIC_PER_DB',
  replayabilityLevel: 'PARTIALLY_REPLAYABLE',
  authorityLevel:     'DB_AUTHORITATIVE',
  haSafetyLevel:      'ACTIVE_ACTIVE_READS',
  bypassGovernance:   false,

  capabilities: Object.freeze({
    deployment_waves:  true,
    node_fleet:        true,
    artifact_delivery: true,
    operator_commands: true,
  }),

  nondeterministicPaths: Object.freeze([
    'lineage_ts — wall-clock audit timestamp (intentional)',
    'received_at — screen heartbeat wall-clock (by design)',
    'operator_token_iat_exp — wall-clock required for token interop',
    'ledger_action_ids — sequential DB seq, not content-addressed',
  ]),

  governanceGuarantees: Object.freeze({
    freeze_authority:     'DB_AUTHORITATIVE (freezeStrong)',
    epoch_authority:      'LINEARIZED (pg_advisory_xact_lock)',
    operator_auth:        'HMAC-SHA256 + JTI revocation',
    incident_ids:         'CONTENT_ADDRESSED (SHA-256)',
    config_authority:     'VERSIONED + HASH_CHAIN',
    resource_bounds:      'MAX_SCREENS=1000, MAX_INCIDENTS=500, MAX_LEDGER=10000',
    ha_ceiling:           '2-node active/active, shared PostgreSQL primary',
  }),
};

plugins.register(OTAPlugin);

module.exports = OTAPlugin;
