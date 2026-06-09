'use strict';

const fs            = require('node:fs');
const path          = require('node:path');
const express       = require('express');
const { pool }      = require('../db');
const { getManifest } = require('../lib/manifestEngine');
const fleetConsensus  = require('../lib/fleet-consensus');

const router = express.Router();

// ── Lineage rejection classifications ─────────────────────────────────────────
// Tracks stale/invalid lineage reported back by screens. Non-blocking — screens
// always receive a manifest response. Rejections are recorded for operator review.
const LINEAGE_REJECTION = Object.freeze({
  STALE_EPOCH:        'STALE_EPOCH',        // screen's reported epoch < current - 1
  STALE_MANIFEST:     'STALE_MANIFEST',     // screen's reported version << current generation
  REPLAYED_MANIFEST:  'REPLAYED_MANIFEST',  // screen reports same hash twice without a new poll
  UNKNOWN_AUTHORITY:  'UNKNOWN_AUTHORITY',  // screen reports epoch 0 or null
});

const _lineageRejections = [];
const _seenScreenHashes  = new Map(); // screenId → last manifest_hash seen (for replay detection)

function _classifyLineage(screenId, reportedEpoch, reportedVersion, reportedHash) {
  const rejections = [];
  const currentEpoch = fleetConsensus.getEpoch();
  const currentGen   = fleetConsensus.getManifestGeneration();

  if (reportedEpoch === null || reportedEpoch === 0) {
    rejections.push(LINEAGE_REJECTION.UNKNOWN_AUTHORITY);
  } else if (reportedEpoch < currentEpoch - 1) {
    rejections.push(LINEAGE_REJECTION.STALE_EPOCH);
  }

  if (reportedVersion !== null && currentGen > 2 && reportedVersion < currentGen - 2) {
    rejections.push(LINEAGE_REJECTION.STALE_MANIFEST);
  }

  // Replay detection: same manifest hash on two consecutive polls without an epoch/generation bump
  const lastHash = _seenScreenHashes.get(screenId);
  if (reportedHash && lastHash && lastHash === reportedHash &&
      reportedEpoch === currentEpoch && reportedVersion === currentGen) {
    rejections.push(LINEAGE_REJECTION.REPLAYED_MANIFEST);
  }
  if (reportedHash) _seenScreenHashes.set(screenId, reportedHash);

  return rejections;
}

function _recordRejection(screenId, classifications, reported) {
  _lineageRejections.push({
    screen_id:      screenId,
    ts:             new Date().toISOString(),
    classifications,
    reported_epoch: reported.epoch,
    reported_version: reported.version,
    current_epoch:  fleetConsensus.getEpoch(),
    current_generation: fleetConsensus.getManifestGeneration(),
  });
  // Keep last 500 rejections in memory
  if (_lineageRejections.length > 500) _lineageRejections.shift();
}

function saveLineageRejections(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'lineage-rejections.json'),
      JSON.stringify({
        generated_at: new Date().toISOString(),
        total:        _lineageRejections.length,
        rejections:   _lineageRejections,
      }, null, 2)
    );
  } catch { /* non-fatal */ }
}

// Ring eligibility hash — must match OTA_GOVERNANCE.md §1 formula (same as soak.js)
function _screenHashPct(screenId) {
  let h = 0;
  for (let i = 0; i < screenId.length; i++) {
    h = ((h << 5) + h + screenId.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

// State → ring threshold mapping for eligibility check
const RING_PCT = { RING_0: 1, RING_1: 30, RING_2: 70, RING_3: 100 };

/**
 * Check if the screen should receive an OTA instruction.
 * Returns OTA payload or null.
 */
async function _getOtaInstruction(screenId) {
  try {
    const r = await pool.query(
      `SELECT rs.update_id, rs.target_version, rs.state,
              op.sha256, op.size_bytes
       FROM rollout_state rs
       LEFT JOIN ota_packages op ON op.update_id = rs.update_id
       WHERE rs.state NOT IN ('COMPLETE', 'ROLLED_BACK', 'PENDING', 'STAGING')
       LIMIT 1`
    );
    if (!r.rows.length) return null;

    const row      = r.rows[0];
    const hashPct  = _screenHashPct(screenId);
    const maxPct   = RING_PCT[row.state] ?? 0;

    // Ring 0: only screen with hash 0
    const eligible = row.state === 'RING_0'
      ? hashPct === 0
      : hashPct < maxPct;

    if (!eligible) return null;

    return {
      update_id:      row.update_id,
      target_version: row.target_version,
      ring:           row.state,
      sha256:         row.sha256,
      size_bytes:     row.size_bytes,
      download_url:   `/ota/packages/${row.update_id}`,
      instruction:    'download_and_install',
    };
  } catch {
    // OTA check failure must not break manifest delivery
    return null;
  }
}

// GET /manifest?screen_id=screen-1
//
// Response includes consensus lineage fields required for split-brain detection:
//   authority_epoch        — increments on each backend restart or authority transfer
//   manifest_generation    — increments each time manifest content changes
//
// Screens report these fields back on their next poll (via query params or headers).
// The fleet-consensus module uses the reported values to detect stale or split screens.
router.get('/', async (req, res) => {
  const { screen_id = 'screen-1' } = req.query;
  if (screen_id.length > 100) {
    return res.status(400).json({ error: 'screen_id must be 100 characters or fewer' });
  }

  // Record lineage reported back from the screen on this poll
  const reportedEpoch   = req.query.authority_epoch   ? parseInt(req.query.authority_epoch,   10) : null;
  const reportedVersion = req.query.manifest_version  ? parseInt(req.query.manifest_version,  10) : null;
  const reportedHash    = req.query.manifest_hash                                                   ?? null;
  const prevHash        = req.query.previous_manifest_hash                                          ?? null;

  if (reportedEpoch !== null) {
    // Classify lineage before recording heartbeat — detect stale/replayed submissions
    const lineageIssues = _classifyLineage(screen_id, reportedEpoch, reportedVersion, reportedHash);
    if (lineageIssues.length > 0) {
      _recordRejection(screen_id, lineageIssues, { epoch: reportedEpoch, version: reportedVersion });
    }

    fleetConsensus.recordHeartbeat(screen_id, {
      authority_epoch:        reportedEpoch,
      manifest_version:       reportedVersion,
      manifest_hash:          reportedHash,
      rollout_version:        req.query.rollout_version  ?? null,
      applied_at:             req.query.applied_at       ? parseInt(req.query.applied_at, 10) : null,
      previous_manifest_hash: prevHash,
    });
  }

  try {
    const [manifest, ota] = await Promise.all([
      getManifest(screen_id),
      _getOtaInstruction(screen_id),
    ]);
    res.json({
      ...manifest,
      ota:                ota ?? null,
      // Consensus lineage — screens must echo these back on next poll
      authority_epoch:    fleetConsensus.getEpoch(),
      manifest_generation: fleetConsensus.getManifestGeneration(),
    });
  } catch (err) {
    console.error('GET /manifest:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.saveLineageRejections = saveLineageRejections;
module.exports.LINEAGE_REJECTION     = LINEAGE_REJECTION;
