'use strict';

/**
 * SnapshotClient — fetches authoritative governance state snapshots.
 *
 * On connect and on gap detection, the client fetches a full authoritative
 * snapshot from the server. The snapshot is the baseline for event reconciliation.
 *
 * Snapshot contract (from server):
 *   {
 *     sequence_id: number,           // event sequence baseline
 *     authority_epoch: number,       // epoch at snapshot time
 *     generated_at: ISO string,      // wall-clock server time
 *     lineage_ts: ISO string,        // governed-clock server time
 *     freeze: { frozen, reason, freeze_epoch, confirmed_at },
 *     incidents: [{ id, type, severity, state, ... }],
 *     topology: { nodes, split_brain, ... },
 *     config: { config_hash, version, ... },
 *     epoch: number,
 *     certification: { level, overall_rating, pass_count, fail_count, ... },
 *     plugins: { plugins: { name → { ... } } },
 *   }
 *
 * UI_AUTHORITY_BOUNDARY: This module is client-side transport only.
 * It must never import governance-kernel core/ or api/ modules.
 */

class SnapshotClient {
  constructor(opts = {}) {
    if (!opts.fetcher) throw new Error('opts.fetcher required');
    this._fetcher = opts.fetcher;
    this._baseUrl = opts.baseUrl || '';
    this._timeout = opts.timeout || 10_000;
    this._retries = opts.retries || 3;
    this._retryDelayMs = opts.retryDelayMs || 1_000;

    this._lastSnapshot = null;
    this._fetchCount = 0;
    this._lastFetchAt = null;
    this._lastError = null;
  }

  /**
   * Fetch a full authoritative snapshot.
   * Retries on network failure up to opts.retries times.
   * Validates required fields before returning.
   */
  async fetchSnapshot(opts = {}) {
    let lastErr;
    for (let attempt = 0; attempt < this._retries; attempt++) {
      try {
        const path = `${this._baseUrl}/governance/snapshot`;
        const params = [];
        if (opts.strong) params.push('strong=true'); // DB_AUTHORITATIVE freeze check
        const url = params.length ? `${path}?${params.join('&')}` : path;

        const snapshot = await this._fetcher(url);
        this._validate(snapshot);

        this._lastSnapshot = snapshot;
        this._fetchCount++;
        this._lastFetchAt = new Date().toISOString();
        this._lastError = null;
        return snapshot;
      } catch (err) {
        lastErr = err;
        this._lastError = err.message;
        if (attempt < this._retries - 1) {
          await _sleep(this._retryDelayMs * (attempt + 1));
        }
      }
    }
    throw new Error(`SnapshotClient: failed after ${this._retries} attempts — ${lastErr?.message}`);
  }

  getLastSnapshot() {
    return this._lastSnapshot;
  }

  getStats() {
    return {
      fetch_count: this._fetchCount,
      last_fetch_at: this._lastFetchAt,
      last_error: this._lastError,
    };
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  _validate(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Snapshot must be an object');
    }
    if (snapshot.sequence_id === undefined || snapshot.sequence_id === null) {
      throw new Error('Snapshot missing sequence_id');
    }
    if (snapshot.authority_epoch === undefined || snapshot.authority_epoch === null) {
      throw new Error('Snapshot missing authority_epoch');
    }
    if (!snapshot.generated_at) {
      throw new Error('Snapshot missing generated_at');
    }
    if (!snapshot.lineage_ts) {
      throw new Error('Snapshot missing lineage_ts (governed clock timestamp)');
    }
    // freeze is a required section for safety-critical consumers
    if (snapshot.freeze === undefined) {
      throw new Error('Snapshot missing freeze section');
    }
    return true;
  }
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { SnapshotClient };
